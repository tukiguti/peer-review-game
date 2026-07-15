export type Phase = 'setup' | 'draw' | 'prepare' | 'present' | 'vote' | 'result' | 'final';

export type CardTone = 'serious' | 'neta';
export type DeckMode = 'serious' | 'neta' | 'all';
export type CardGenre = 'general' | 'se' | 'security' | 'fashion';
export type GenreMode = CardGenre | 'all';
export type CardKind = 'field' | 'method' | 'constraint';
export type Vote = 'accept' | 'reject';
export type PlayerId = string;

export type Card = {
  id: string;
  text: string;
  tone: CardTone;
  genre: CardGenre;
};

export type CardsByKind = Record<CardKind, Card[]>;
export type Hand = Card[];
export type CardSlot = {
  kind: CardKind;
  tone: DeckMode;
};

export type Settings = {
  playerNames: string[];
  rounds: number;
  presentationSeconds: number;
  preparationEnabled: boolean;
  rerollsPerPlayer: number;
  genreMode: GenreMode;
  cardSlots: CardSlot[];
  reducedMotion: boolean;
};

export type Player = {
  id: PlayerId;
  name: string;
  score: number;
  presentationScore: number;
  rerollsLeft: number;
  acceptCount: number;
  rejectCount: number;
  unanimousAcceptedCount: number;
};

export type VoteEntry = {
  vote: Vote;
  comment?: string;
};

export type GameState = {
  phase: Phase;
  settings: Settings;
  players: Player[];
  round: number;
  presenterIndex: number;
  hand: Hand | null;
  votes: Record<PlayerId, VoteEntry>;
  votingIndex: number;
  recentHands: string[][];
  muted: boolean;
  timerRemaining: number;
  drawAnimating: boolean;
  drawSpinKey: number;
  drawSpinIndex: number | 'all';
  voteStep: 'handoff' | 'ballot' | 'submitted';
  voteDraft: Vote | null;
  commentDraft: string;
  resultScored: boolean;
};

export type VoteSummary = {
  accepted: boolean;
  unanimous: boolean;
  acceptCount: number;
  rejectCount: number;
  majorityVote: Vote;
};

export type ScoreDelta = {
  playerId: PlayerId;
  delta: number;
};

export type ScoringResult = {
  summary: VoteSummary;
  deltas: ScoreDelta[];
};
