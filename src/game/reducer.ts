import { applyScoring } from './scoring';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';
import type { Card, CardKind, GameState, Hand, Settings, Vote } from './types';

export type GameAction =
  | { type: 'updateSettings'; settings: Settings }
  | { type: 'startGame'; settings: Settings }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'drawHand'; hand: Hand; animate: boolean }
  | { type: 'rerollCard'; kind: CardKind; card: Card; animate: boolean }
  | { type: 'drawAnimationDone' }
  | { type: 'startPrepare' }
  | { type: 'startPresent' }
  | { type: 'tickTimer' }
  | { type: 'startVote' }
  | { type: 'openBallot' }
  | { type: 'setVoteDraft'; vote: Vote }
  | { type: 'setCommentDraft'; comment: string }
  | { type: 'submitVote' }
  | { type: 'continueVoting' }
  | { type: 'showResult' }
  | { type: 'nextTurn' }
  | { type: 'resetToSetup' };

const makePlayers = (settings: Settings) =>
  settings.playerNames.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    score: 0,
    rerollsLeft: settings.rerollsPerPlayer,
    acceptCount: 0,
    rejectCount: 0,
    unanimousAcceptedCount: 0,
  }));

export const createInitialState = (settings = DEFAULT_SETTINGS): GameState => ({
  phase: 'setup',
  settings: normalizeSettings(settings),
  players: [],
  round: 1,
  presenterIndex: 0,
  hand: null,
  votes: {},
  votingIndex: 0,
  recentHands: [],
  muted: false,
  timerRemaining: 0,
  drawAnimating: false,
  drawSpinKey: 0,
  drawSpinKind: 'all',
  voteStep: 'handoff',
  voteDraft: null,
  commentDraft: '',
  resultScored: false,
});

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'updateSettings':
      return { ...state, settings: normalizeSettings(action.settings) };
    case 'startGame': {
      const settings = normalizeSettings(action.settings);
      return {
        ...createInitialState(settings),
        phase: 'draw',
        settings,
        players: makePlayers(settings),
        muted: state.muted,
      };
    }
    case 'setMuted':
      return { ...state, muted: action.muted };
    case 'drawHand':
      return {
        ...state,
        hand: action.hand,
        drawAnimating: action.animate,
        drawSpinKey: state.drawSpinKey + 1,
        drawSpinKind: 'all',
      };
    case 'rerollCard': {
      if (!state.hand) {
        return state;
      }

      const kindIndex = kindToIndex(action.kind);
      const nextHand = [...state.hand] as Hand;
      nextHand[kindIndex] = action.card;
      const presenter = state.players[state.presenterIndex];

      return {
        ...state,
        hand: nextHand,
        drawAnimating: action.animate,
        drawSpinKey: state.drawSpinKey + 1,
        drawSpinKind: action.kind,
        players: state.players.map((player) =>
          player.id === presenter.id ? { ...player, rerollsLeft: Math.max(0, player.rerollsLeft - 1) } : player,
        ),
      };
    }
    case 'drawAnimationDone':
      return { ...state, drawAnimating: false };
    case 'startPrepare':
      return {
        ...state,
        phase: state.settings.preparationEnabled ? 'prepare' : 'present',
        timerRemaining: state.settings.preparationEnabled ? 30 : state.settings.presentationSeconds,
      };
    case 'startPresent':
      return { ...state, phase: 'present', timerRemaining: state.settings.presentationSeconds };
    case 'tickTimer':
      return { ...state, timerRemaining: Math.max(0, state.timerRemaining - 1) };
    case 'startVote':
      return {
        ...state,
        phase: 'vote',
        votes: {},
        votingIndex: firstVoterIndex(state),
        voteStep: 'handoff',
        voteDraft: null,
        commentDraft: '',
      };
    case 'openBallot':
      return { ...state, voteStep: 'ballot', voteDraft: null, commentDraft: '' };
    case 'setVoteDraft':
      return { ...state, voteDraft: action.vote };
    case 'setCommentDraft':
      return { ...state, commentDraft: action.comment.slice(0, 80) };
    case 'submitVote': {
      const voter = state.players[state.votingIndex];
      if (!voter || !state.voteDraft) {
        return state;
      }

      return {
        ...state,
        votes: {
          ...state.votes,
          [voter.id]: {
            vote: state.voteDraft,
            comment: state.commentDraft.trim() || undefined,
          },
        },
        voteStep: 'submitted',
        voteDraft: null,
        commentDraft: '',
      };
    }
    case 'continueVoting': {
      const nextIndex = nextVoterIndex(state, state.votingIndex + 1);
      const presenter = state.players[state.presenterIndex];
      return nextIndex === null
        ? {
            ...state,
            phase: 'result',
            players: state.resultScored ? state.players : applyScoring(state.players, presenter.id, state.votes),
            voteStep: 'handoff',
            votingIndex: 0,
            resultScored: true,
          }
        : {
            ...state,
            votingIndex: nextIndex,
            voteStep: 'handoff',
            voteDraft: null,
            commentDraft: '',
          };
    }
    case 'showResult':
      return {
        ...state,
        phase: 'result',
        resultScored: true,
        players: state.resultScored ? state.players : applyScoring(state.players, state.players[state.presenterIndex].id, state.votes),
      };
    case 'nextTurn': {
      if (!state.hand) {
        return state;
      }

      const nextRecentHands = [...state.recentHands, state.hand.map((card) => card.id)].slice(-3);
      const atLastPresenter = state.presenterIndex === state.players.length - 1;
      const nextRound = atLastPresenter ? state.round + 1 : state.round;
      const gameDone = atLastPresenter && nextRound > state.settings.rounds;

      return {
        ...state,
        phase: gameDone ? 'final' : 'draw',
        round: gameDone ? state.round : nextRound,
        presenterIndex: gameDone ? state.presenterIndex : atLastPresenter ? 0 : state.presenterIndex + 1,
        hand: null,
        votes: {},
        votingIndex: 0,
        recentHands: nextRecentHands,
        timerRemaining: 0,
        drawAnimating: false,
        voteStep: 'handoff',
        voteDraft: null,
        commentDraft: '',
        resultScored: false,
      };
    }
    case 'resetToSetup':
      return { ...createInitialState(state.settings), muted: state.muted };
    default:
      return state;
  }
};

export const kindToIndex = (kind: CardKind): 0 | 1 | 2 => {
  if (kind === 'field') {
    return 0;
  }
  if (kind === 'method') {
    return 1;
  }
  return 2;
};

export const kindLabel = (kind: CardKind): string => {
  if (kind === 'field') {
    return '分野';
  }
  if (kind === 'method') {
    return '手法';
  }
  return '制約';
};

const firstVoterIndex = (state: GameState): number => nextVoterIndex(state, 0) ?? 0;

const nextVoterIndex = (state: GameState, fromIndex: number): number | null => {
  for (let index = fromIndex; index < state.players.length; index += 1) {
    if (index !== state.presenterIndex) {
      return index;
    }
  }

  return null;
};
