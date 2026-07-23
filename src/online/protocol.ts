// クライアント(ブラウザ)とサーバ(Durable Object)で共有する通信プロトコル。
// このファイルは DOM / Worker いずれの実行環境にも依存しない純粋な型のみを置く。
import type { Card, CardGenre, CardKind, CardTone, Vote } from '../game/types';

export type { Vote };

// オンライン部屋のフェーズ。オフラインの Phase とは別物（部屋の進行状態）。
export type OnlinePhase = 'lobby' | 'present' | 'voting' | 'reveal' | 'final';

// 抽選されたカード。どのスロット種別かを自己記述するため kind を持たせる。
export type HandCard = { id: string; text: string; tone: CardTone; genre: CardGenre; kind: CardKind } & Partial<Card>;

export type PlayerView = {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  isHost: boolean;
};

// reveal 時のみ各自の投票内容を公開する。
export type VoteReveal = { playerId: string; vote: Vote };

// サーバが各クライアント向けに作る部屋のスナップショット。
// voting 中は他人の投票値を含めない（votedPlayerIds は「投票済みか」だけ）。
export type RoomSnapshot = {
  code: string;
  phase: OnlinePhase;
  players: PlayerView[];
  round: number;
  totalRounds: number;
  presenterId: string | null;
  hand: HandCard[] | null;
  votedPlayerIds: string[];
  myVote: Vote | null;
  reveal: {
    votes: VoteReveal[];
    accepted: boolean;
    unanimous: boolean;
    acceptCount: number;
    rejectCount: number;
  } | null;
};

// クライアント → サーバ。参加/作成は接続時の URL クエリで渡すためメッセージには含めない。
export type ClientMessage =
  | { t: 'startRound' }
  | { t: 'openVoting' }
  | { t: 'vote'; vote: Vote }
  | { t: 'nextRound' }
  | { t: 'restart' };

// サーバ → クライアント。
export type ServerMessage =
  | { t: 'joined'; playerId: string; code: string }
  | { t: 'state'; room: RoomSnapshot }
  | { t: 'error'; message: string };
