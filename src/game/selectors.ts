import { calculateScoring, summarizeVotes } from './scoring';
import type { GameState, Player, ScoringResult, VoteSummary } from './types';

export const currentPresenter = (state: GameState): Player => state.players[state.presenterIndex];

export const voterIds = (state: GameState): string[] =>
  state.players.filter((player) => player.id !== currentPresenter(state).id).map((player) => player.id);

export const currentVoter = (state: GameState): Player | null => state.players[state.votingIndex] ?? null;

export const currentVoteSummary = (state: GameState): VoteSummary => summarizeVotes(voterIds(state), state.votes);

export const currentScoringResult = (state: GameState): ScoringResult =>
  calculateScoring(currentPresenter(state).id, voterIds(state), state.votes);

export const sortedPlayers = (players: Player[]): Player[] =>
  [...players].sort((a, b) => b.score - a.score || b.unanimousAcceptedCount - a.unanimousAcceptedCount || a.name.localeCompare(b.name, 'ja'));
