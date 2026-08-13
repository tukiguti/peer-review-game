// 1部屋 = 1インスタンスの Durable Object。
// 参加者の WebSocket を保持し、抽選・投票・一斉公開・得点をサーバ側で権威的に進行する。
// 投票の秘匿は「reveal 前は他人の投票値をスナップショットに載せない」ことで担保する。
//
// カード抽選(draw.ts)と得点計算(scoring.ts)はオフラインと同一の純粋関数を再利用する。
//
// 堅牢性の方針:
//  - 状態は ctx.storage に保存する。デプロイや DO の再起動で進行中の部屋を失わない。
//  - 端末のスリープ等で切れても、本人だけが持つ token で「ゲーム中でも」復帰できる。
//  - 全員切断や発表者不在で進行が止まらないよう、司会に締め切り・手番放棄・引き継ぎを用意する。
import type { Card, CardSlot, CardsByKind, GenreMode, Player, Vote } from '../game/types';
import { canDrawCardSlots, drawHand } from '../game/draw';
import { calculateScoring, summarizeVotes } from '../game/scoring';
import { areCardSlotsValid, DEFAULT_CARD_SLOTS, isGenreMode } from '../game/cardConfig';
import cardsData from '../data/cards.json';
import type { ClientMessage, OnlinePhase, OnlineSettings, RoomSnapshot, ServerMessage, VoteReveal } from '../online/protocol';

const cards = cardsData as unknown as CardsByKind;

const MIN_ROUNDS = 1;
const MAX_ROUNDS = 3;
// 過半数判定が成立する最小人数(発表者1 + 査読者2)。オフラインの3人下限と揃える。
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;
const STORAGE_KEY = 'room';
// これより長く放置された部屋は、同じコードで作り直せるようにする。
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;

type RoomPlayer = Player & { connected: boolean; token: string };

// storage に入れる形。WebSocket は保存できないので connected は復元時に false から始まる。
type PersistedRoom = {
  code: string;
  hostId: string | null;
  phase: OnlinePhase;
  round: number;
  presenterIndex: number;
  hand: Card[] | null;
  votes: Record<string, Vote>;
  recentHands: string[][];
  lastReveal: RoomSnapshot['reveal'];
  players: RoomPlayer[];
  genreMode: GenreMode;
  cardSlots: CardSlot[];
  totalRounds: number;
  updatedAt: number;
};

export class Room {
  private sockets = new Map<WebSocket, string>();
  private players: RoomPlayer[] = [];
  private initialized = false;
  private code = '';
  private hostId: string | null = null;
  private phase: OnlinePhase = 'lobby';
  private round = 1;
  private presenterIndex = 0;
  private hand: Card[] | null = null;
  private votes: Record<string, Vote> = {};
  private recentHands: string[][] = [];
  private lastReveal: RoomSnapshot['reveal'] = null;
  // 司会がロビーで変更できる設定（既定は査読4枚・全ジャンル・1周）。
  private genreMode: GenreMode = 'all';
  private cardSlots: CardSlot[] = DEFAULT_CARD_SLOTS.map((slot) => ({ ...slot }));
  private totalRounds = 1;
  private updatedAt = 0;

  constructor(private ctx: DurableObjectState, _env: unknown) {
    // 復元が終わるまで受信を止める。半端な状態で fetch が走るのを防ぐ。
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<PersistedRoom>(STORAGE_KEY);
      if (saved) this.restore(saved);
    });
  }

  private restore(saved: PersistedRoom): void {
    this.initialized = true;
    this.code = saved.code;
    this.hostId = saved.hostId;
    this.phase = saved.phase;
    this.round = saved.round;
    this.presenterIndex = saved.presenterIndex;
    this.hand = saved.hand;
    this.votes = saved.votes;
    this.recentHands = saved.recentHands;
    this.lastReveal = saved.lastReveal;
    // 再起動直後は誰も繋がっていない。各自の再接続を待つ。
    this.players = saved.players.map((p) => ({ ...p, connected: false }));
    this.genreMode = saved.genreMode;
    this.cardSlots = saved.cardSlots;
    this.totalRounds = saved.totalRounds;
    this.updatedAt = saved.updatedAt;
  }

  private persist(): void {
    this.updatedAt = Date.now();
    const data: PersistedRoom = {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      presenterIndex: this.presenterIndex,
      hand: this.hand,
      votes: this.votes,
      recentHands: this.recentHands,
      lastReveal: this.lastReveal,
      players: this.players,
      genreMode: this.genreMode,
      cardSlots: this.cardSlots,
      totalRounds: this.totalRounds,
      updatedAt: this.updatedAt,
    };
    void this.ctx.storage.put(STORAGE_KEY, data);
  }

  private resetRoom(code: string): void {
    this.initialized = true;
    this.code = code;
    this.hostId = null;
    this.phase = 'lobby';
    this.round = 1;
    this.presenterIndex = 0;
    this.hand = null;
    this.votes = {};
    this.recentHands = [];
    this.lastReveal = null;
    this.players = [];
    this.genreMode = 'all';
    this.cardSlots = DEFAULT_CARD_SLOTS.map((slot) => ({ ...slot }));
    this.totalRounds = 1;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const url = new URL(request.url);
    const code = decodeURIComponent(url.pathname.split('/').pop() ?? '').toUpperCase();
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 20);
    const create = url.searchParams.get('create') === '1';
    const rejoinId = url.searchParams.get('rejoin');
    const rejoinToken = url.searchParams.get('token');

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const fail = (message: string, fatal = false): Response => {
      this.send(server, { t: 'error', message, fatal });
      server.close(1008, message);
      return new Response(null, { status: 101, webSocket: client });
    };

    // ── 再接続（ゲーム中でも可。本人の token を持っていることが条件）──
    if (rejoinId && rejoinToken) {
      const player = this.players.find((p) => p.id === rejoinId);
      if (!this.initialized || !player || player.token !== rejoinToken) {
        return fail('復帰できませんでした。もう一度参加してください', true);
      }
      // 同一プレイヤーの古い接続（別タブ等）は畳む。
      for (const [ws, pid] of this.sockets) {
        if (pid === player.id) {
          this.sockets.delete(ws);
          try {
            ws.close(1000, 'replaced');
          } catch {
            // 既に閉じている場合は無視。
          }
        }
      }
      player.connected = true;
      this.attach(server, player.id);
      this.send(server, { t: 'joined', playerId: player.id, token: player.token, code: this.code });
      this.broadcast();
      return new Response(null, { status: 101, webSocket: client });
    }

    // ── 新規の作成・参加 ──
    if (!name) return fail('名前を入力してください', true);

    if (create) {
      const stale = this.initialized && Date.now() - this.updatedAt > ROOM_TTL_MS;
      if (this.initialized && !stale) return fail('この部屋コードは使用中です。作成し直してください', true);
      this.resetRoom(code);
    } else {
      if (!this.initialized) return fail('部屋が見つかりません。コードを確認してください', true);
      if (this.phase !== 'lobby') return fail('この部屋はすでにゲーム中です', true);
      if (this.players.filter((p) => p.connected).length >= MAX_PLAYERS) return fail('満員です（最大8人）', true);
      if (this.players.some((p) => p.connected && p.name === name)) {
        return fail('同じ名前の人がいます。別の名前にしてください', true);
      }
    }

    const playerId = crypto.randomUUID();
    const token = crypto.randomUUID();
    this.players.push({
      id: playerId,
      name,
      score: 0,
      presentationScore: 0,
      rerollsLeft: 0,
      acceptCount: 0,
      rejectCount: 0,
      unanimousAcceptedCount: 0,
      connected: true,
      token,
    });
    if (create) this.hostId = playerId;

    this.attach(server, playerId);
    this.send(server, { t: 'joined', playerId, token, code: this.code });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  private attach(ws: WebSocket, playerId: string): void {
    this.sockets.set(ws, playerId);
    ws.addEventListener('message', (ev: MessageEvent) => this.onMessage(ws, playerId, String(ev.data)));
    ws.addEventListener('close', () => this.onClose(ws));
    ws.addEventListener('error', () => this.onClose(ws));
  }

  // 通信が切れただけ。席は残し、本人の復帰を待つ。
  // ロビーで席を消してしまうと、待機中に画面が消灯しただけで弾かれ、復帰もできなくなる。
  private onClose(ws: WebSocket): void {
    const playerId = this.sockets.get(ws);
    if (!playerId) return;
    this.sockets.delete(ws);
    const player = this.players.find((p) => p.id === playerId);
    if (player) player.connected = false;
    // 司会は勝手に移さない。復帰を待ち、戻らなければ claimHost で引き継ぐ。
    if (this.phase === 'voting') this.maybeReveal();
    this.broadcast();
  }

  // 本人の意思による退出。こちらは席を明け渡す。
  private handleLeave(ws: WebSocket, playerId: string): void {
    this.sockets.delete(ws);
    this.players = this.players.filter((p) => p.id !== playerId);
    if (this.hostId === playerId) {
      this.hostId = this.players.find((p) => p.connected)?.id ?? this.players[0]?.id ?? null;
    }
    if (this.presenterIndex >= this.players.length) this.presenterIndex = 0;
    try {
      ws.close(1000, 'left');
    } catch {
      // 既に閉じている場合は無視。
    }
    if (this.phase === 'voting') this.maybeReveal();
  }

  private onMessage(ws: WebSocket, playerId: string, raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    if (msg.t === 'ping') {
      this.send(ws, { t: 'pong' });
      return;
    }
    const isHost = playerId === this.hostId;
    switch (msg.t) {
      case 'setSettings':
        if (isHost && this.phase === 'lobby') this.applySettings(msg.settings);
        break;
      case 'startRound':
        if (isHost && this.phase === 'lobby') this.startGame();
        break;
      case 'openVoting':
        if (isHost && this.phase === 'present') {
          this.phase = 'voting';
          this.maybeReveal();
        }
        break;
      case 'vote':
        this.handleVote(playerId, msg.vote);
        break;
      case 'closeVoting':
        // 未投票者が戻らないときの脱出口。集まっている票だけで判定する。
        if (isHost && this.phase === 'voting') this.doReveal();
        break;
      case 'skipTurn':
        // 発表者が戻らないとき等。得点をつけずに次の手番へ。
        if (isHost && (this.phase === 'present' || this.phase === 'voting')) this.advance();
        break;
      case 'claimHost':
        this.claimHost(playerId);
        break;
      case 'leave':
        this.handleLeave(ws, playerId);
        break;
      case 'nextRound':
        if (isHost && this.phase === 'reveal') this.advance();
        break;
      case 'restart':
        if (isHost && this.phase === 'final') this.resetToLobby();
        break;
    }
    this.broadcast();
  }

  // 司会が切断中のときだけ、接続中の参加者が進行役を引き継げる。
  private claimHost(playerId: string): void {
    const host = this.players.find((p) => p.id === this.hostId);
    if (host?.connected) return;
    const claimer = this.players.find((p) => p.id === playerId);
    if (!claimer?.connected) return;
    this.hostId = claimer.id;
  }

  // クライアントも検証するが、サーバでも必ず検証してから採用する（防御）。
  private applySettings(settings: OnlineSettings): void {
    if (!settings || typeof settings !== 'object') return;
    if (!isGenreMode(settings.genreMode)) return;
    if (!areCardSlotsValid(settings.cardSlots)) return;
    if (!canDrawCardSlots(cards, settings.genreMode, settings.cardSlots)) return;
    const rounds = Math.round(settings.totalRounds);
    if (!Number.isFinite(rounds) || rounds < MIN_ROUNDS || rounds > MAX_ROUNDS) return;
    this.genreMode = settings.genreMode;
    this.cardSlots = settings.cardSlots.map((slot) => ({ ...slot }));
    this.totalRounds = rounds;
  }

  private startGame(): void {
    if (this.players.filter((p) => p.connected).length < MIN_PLAYERS) return;
    // ロビーで戻ってこなかった席はここで整理する（開始後は席順を保つので抜けない）。
    this.players = this.players.filter((p) => p.connected);
    if (!this.players.some((p) => p.id === this.hostId)) this.hostId = this.players[0]?.id ?? null;
    for (const p of this.players) {
      p.score = 0;
      p.presentationScore = 0;
      p.acceptCount = 0;
      p.rejectCount = 0;
      p.unanimousAcceptedCount = 0;
    }
    this.round = 1;
    this.presenterIndex = 0;
    this.recentHands = [];
    this.beginTurn();
  }

  private beginTurn(): void {
    this.votes = {};
    this.lastReveal = null;
    this.hand = drawHand(cards, this.genreMode, this.recentHands, this.cardSlots);
    this.recentHands.push(this.hand.map((c) => c.id));
    this.phase = 'present';
  }

  private handleVote(playerId: string, vote: Vote): void {
    if (this.phase !== 'voting') return;
    const presenterId = this.players[this.presenterIndex]?.id;
    if (playerId === presenterId) return;
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !player.connected) return;
    this.votes[playerId] = vote;
    this.maybeReveal();
  }

  // 接続中の発表者以外が全員投票し終えたら自動で公開へ。
  private maybeReveal(): void {
    if (this.phase !== 'voting') return;
    const presenterId = this.players[this.presenterIndex]?.id;
    const pending = this.players.filter((p) => p.connected && p.id !== presenterId && !(p.id in this.votes));
    const voters = this.players.filter((p) => p.id !== presenterId && p.id in this.votes);
    if (pending.length === 0 && voters.length > 0) this.doReveal();
  }

  private doReveal(): void {
    const presenter = this.players[this.presenterIndex];
    if (!presenter) return;
    // 実際に投票した人だけを査読者として集計（切断者・未投票者は数に入れない）。
    const voterIds = this.players.filter((p) => p.id !== presenter.id && p.id in this.votes).map((p) => p.id);
    const votesEntry: Record<string, { vote: Vote }> = {};
    for (const id of voterIds) votesEntry[id] = { vote: this.votes[id] };

    const summary = summarizeVotes(voterIds, votesEntry);
    const { deltas } = calculateScoring(presenter.id, voterIds, votesEntry);
    const deltaBy = new Map(deltas.map((d) => [d.playerId, d.delta]));

    for (const p of this.players) {
      const delta = deltaBy.get(p.id) ?? 0;
      p.score += delta;
      if (p.id === presenter.id) {
        p.presentationScore += delta;
        if (summary.unanimous) p.unanimousAcceptedCount += 1;
      }
      const v = this.votes[p.id];
      if (v === 'accept') p.acceptCount += 1;
      else if (v === 'reject') p.rejectCount += 1;
    }

    const revealVotes: VoteReveal[] = voterIds.map((id) => ({ playerId: id, vote: this.votes[id] }));
    this.lastReveal = {
      votes: revealVotes,
      accepted: summary.accepted,
      unanimous: summary.unanimous,
      acceptCount: summary.acceptCount,
      rejectCount: summary.rejectCount,
    };
    this.phase = 'reveal';
  }

  private advance(): void {
    this.presenterIndex += 1;
    if (this.presenterIndex >= this.players.length) {
      this.presenterIndex = 0;
      this.round += 1;
    }
    if (this.round > this.totalRounds) {
      this.phase = 'final';
    } else {
      this.beginTurn();
    }
  }

  private resetToLobby(): void {
    this.phase = 'lobby';
    this.hand = null;
    this.votes = {};
    this.lastReveal = null;
    this.round = 1;
    this.presenterIndex = 0;
    this.players = this.players.filter((p) => p.connected);
    if (!this.hostId || !this.players.some((p) => p.id === this.hostId)) {
      this.hostId = this.players[0]?.id ?? null;
    }
  }

  private snapshot(forId: string): RoomSnapshot {
    const presenterId = this.players[this.presenterIndex]?.id ?? null;
    const showHand = this.phase === 'present' || this.phase === 'voting' || this.phase === 'reveal';
    return {
      code: this.code,
      phase: this.phase,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        connected: p.connected,
        score: p.score,
        isHost: p.id === this.hostId,
      })),
      round: this.round,
      totalRounds: this.totalRounds,
      settings: {
        genreMode: this.genreMode,
        cardSlots: this.cardSlots.map((slot) => ({ ...slot })),
        totalRounds: this.totalRounds,
      },
      presenterId: this.phase === 'lobby' ? null : presenterId,
      hand: showHand && this.hand ? this.hand.map((c, i) => ({ ...c, kind: this.cardSlots[i].kind })) : null,
      votedPlayerIds: this.phase === 'voting' ? Object.keys(this.votes) : [],
      myVote: this.votes[forId] ?? null,
      reveal: this.phase === 'reveal' ? this.lastReveal : null,
    };
  }

  private broadcast(): void {
    for (const [ws, pid] of this.sockets) {
      this.send(ws, { t: 'state', room: this.snapshot(pid) });
    }
    this.persist();
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // 送信先が既に閉じている場合は無視（close イベントで掃除される）。
    }
  }
}
