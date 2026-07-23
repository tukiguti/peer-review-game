// 1部屋 = 1インスタンスの Durable Object。
// 参加者の WebSocket を保持し、抽選・投票・一斉公開・得点をサーバ側で権威的に進行する。
// 投票の秘匿は「reveal 前は他人の投票値をスナップショットに載せない」ことで担保する。
//
// カード抽選(draw.ts)と得点計算(scoring.ts)はオフラインと同一の純粋関数を再利用する。
import type { Card, CardSlot, CardsByKind, Player, Vote } from '../game/types';
import { drawHand } from '../game/draw';
import { calculateScoring, summarizeVotes } from '../game/scoring';
import cardsData from '../data/cards.json';
import type { ClientMessage, OnlinePhase, RoomSnapshot, ServerMessage, VoteReveal } from '../online/protocol';

const cards = cardsData as unknown as CardsByKind;

// オンラインは既定構成（査読4枚・全ジャンル）で固定。将来ホスト設定で可変にする。
const GENRE = 'all' as const;
const CARD_SLOTS: CardSlot[] = [
  { kind: 'field', tone: 'all' },
  { kind: 'method', tone: 'all' },
  { kind: 'constraint', tone: 'all' },
  { kind: 'novelty', tone: 'all' },
];
const TOTAL_ROUNDS = 1; // 全員が1回ずつ発表したら終了。
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

type RoomPlayer = Player & { connected: boolean };

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

  constructor(_ctx: DurableObjectState, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const url = new URL(request.url);
    const code = decodeURIComponent(url.pathname.split('/').pop() ?? '').toUpperCase();
    const name = (url.searchParams.get('name') ?? '').trim().slice(0, 20);
    const create = url.searchParams.get('create') === '1';

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const fail = (message: string): Response => {
      this.send(server, { t: 'error', message });
      server.close(1008, message);
      return new Response(null, { status: 101, webSocket: client });
    };

    if (!name) return fail('名前を入力してください');
    if (create) {
      if (this.initialized) return fail('この部屋コードは使用中です。作成し直してください');
    } else {
      if (!this.initialized) return fail('部屋が見つかりません。コードを確認してください');
      if (this.phase !== 'lobby') return fail('この部屋はすでにゲーム中です');
      if (this.players.filter((p) => p.connected).length >= MAX_PLAYERS) return fail('満員です（最大8人）');
    }

    if (create) {
      this.initialized = true;
      this.code = code;
      this.phase = 'lobby';
    }

    const playerId = crypto.randomUUID();
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
    });
    if (create) this.hostId = playerId;

    this.sockets.set(server, playerId);
    server.addEventListener('message', (ev: MessageEvent) => this.onMessage(playerId, String(ev.data)));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

    this.send(server, { t: 'joined', playerId, code: this.code });
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  private onClose(ws: WebSocket): void {
    const playerId = this.sockets.get(ws);
    if (!playerId) return;
    this.sockets.delete(ws);
    if (this.phase === 'lobby') {
      // ロビー中の離脱は一覧から除去（ゲーム中は席順維持のため connected=false に留める）。
      this.players = this.players.filter((p) => p.id !== playerId);
    } else {
      const player = this.players.find((p) => p.id === playerId);
      if (player) player.connected = false;
    }
    if (this.hostId === playerId) {
      this.hostId = this.players.find((p) => p.connected)?.id ?? null;
    }
    if (this.phase === 'voting') this.maybeReveal();
    this.broadcast();
  }

  private onMessage(playerId: string, raw: string): void {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const isHost = playerId === this.hostId;
    switch (msg.t) {
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
      case 'nextRound':
        if (isHost && this.phase === 'reveal') this.advance();
        break;
      case 'restart':
        if (isHost && this.phase === 'final') this.resetToLobby();
        break;
    }
    this.broadcast();
  }

  private startGame(): void {
    if (this.players.filter((p) => p.connected).length < MIN_PLAYERS) return;
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
    this.hand = drawHand(cards, GENRE, this.recentHands, CARD_SLOTS);
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
    if (this.round > TOTAL_ROUNDS) {
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
      totalRounds: TOTAL_ROUNDS,
      presenterId: this.phase === 'lobby' ? null : presenterId,
      hand: showHand && this.hand ? this.hand.map((c, i) => ({ ...c, kind: CARD_SLOTS[i].kind })) : null,
      votedPlayerIds: this.phase === 'voting' ? Object.keys(this.votes) : [],
      myVote: this.votes[forId] ?? null,
      reveal: this.phase === 'reveal' ? this.lastReveal : null,
    };
  }

  private broadcast(): void {
    for (const [ws, pid] of this.sockets) {
      this.send(ws, { t: 'state', room: this.snapshot(pid) });
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // 送信先が既に閉じている場合は無視（close イベントで掃除される）。
    }
  }
}
