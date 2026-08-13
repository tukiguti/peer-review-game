// クライアント(ブラウザ)とサーバ(Durable Object)で共有する通信プロトコル。
// このファイルは DOM / Worker いずれの実行環境にも依存しない純粋な型のみを置く。
import type { Card, CardGenre, CardKind, CardSlot, CardTone, GenreMode, Vote } from '../game/types';

export type { Vote };

// オンライン部屋のフェーズ。オフラインの Phase とは別物（部屋の進行状態）。
export type OnlinePhase = 'lobby' | 'present' | 'voting' | 'reveal' | 'final';

// 司会がロビーで決める設定（オフラインの該当項目のオンライン版）。
export type OnlineSettings = {
  genreMode: GenreMode;
  cardSlots: CardSlot[];
  totalRounds: number;
  /** 発表時間（秒）。0 はタイマーなし */
  presentationSeconds: number;
};

// 抽選されたカード。どのスロット種別かを自己記述するため kind を持たせる。
export type HandCard = { id: string; text: string; tone: CardTone; genre: CardGenre; kind: CardKind } & Partial<Card>;

export type PlayerView = {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  isHost: boolean;
  // 称号の判定に使う内訳。オフラインの最終画面と同じ基準で表彰するために配る。
  presentationScore: number;
  rejectCount: number;
  unanimousAcceptedCount: number;
};

// reveal 時のみ各自の投票内容を公開する。コメントも同じタイミングで開く。
export type VoteReveal = { playerId: string; vote: Vote; comment?: string };

// サーバが各クライアント向けに作る部屋のスナップショット。
// voting 中は他人の投票値を含めない（votedPlayerIds は「投票済みか」だけ）。
export type RoomSnapshot = {
  code: string;
  phase: OnlinePhase;
  players: PlayerView[];
  round: number;
  totalRounds: number;
  settings: OnlineSettings;
  presenterId: string | null;
  hand: HandCard[] | null;
  votedPlayerIds: string[];
  myVote: Vote | null;
  myComment: string | null;
  /** 発表の締切（サーバ時刻のepoch ms）。タイマーなし・発表中以外は null */
  presentEndsAt: number | null;
  /** このスナップショットを作った時点のサーバ時刻。端末の時計ズレを補正するために使う */
  serverNow: number;
  reveal: {
    votes: VoteReveal[];
    accepted: boolean;
    unanimous: boolean;
    acceptCount: number;
    rejectCount: number;
  } | null;
};

// クライアント → サーバ。参加/作成/復帰は接続時の URL クエリで渡すためメッセージには含めない。
export type ClientMessage =
  | { t: 'setSettings'; settings: OnlineSettings } // 司会がロビーで設定変更
  | { t: 'startRound' }
  | { t: 'openVoting' }
  | { t: 'vote'; vote: Vote; comment?: string }
  | { t: 'closeVoting' } // 司会: 未投票者を待たずに締め切って公開する（進行不能の脱出口）
  | { t: 'skipTurn' } // 司会: 発表者が戻らない等でこの手番を放棄し次へ
  | { t: 'claimHost' } // 司会が切断中のとき、他の参加者が進行役を引き継ぐ
  | { t: 'leave' } // 自分の意思での退出。通信断とは区別し、席を明け渡す
  | { t: 'nextRound' }
  | { t: 'restart' }
  | { t: 'ping' }; // 無通信で切断されないための保持

// サーバ → クライアント。
// token は本人にだけ送る復帰用の秘密。players[].id は全員に見えるため、再接続の認証には使わない。
export type ServerMessage =
  | { t: 'joined'; playerId: string; token: string; code: string }
  | { t: 'state'; room: RoomSnapshot }
  | { t: 'error'; message: string; fatal?: boolean } // fatal: 保存済みの復帰情報を捨てる
  | { t: 'pong' };
