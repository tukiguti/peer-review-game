import { calculateScoring, summarizeVotes } from './scoring';
import type { GameState, Player, ScoringResult, VoteSummary } from './types';

export const currentPresenter = (state: GameState): Player => state.players[state.presenterIndex];

export const voterIds = (state: GameState): string[] =>
  state.players.filter((player) => player.id !== currentPresenter(state).id).map((player) => player.id);

export const currentVoter = (state: GameState): Player | null => state.players[state.votingIndex] ?? null;

export const currentVoteSummary = (state: GameState): VoteSummary => summarizeVotes(voterIds(state), state.votes);

export const currentScoringResult = (state: GameState): ScoringResult =>
  calculateScoring(currentPresenter(state).id, voterIds(state), state.votes);

export const sortedPlayers = <T extends { score: number; unanimousAcceptedCount: number; name: string }>(players: T[]): T[] =>
  [...players].sort((a, b) => b.score - a.score || b.unanimousAcceptedCount - a.unanimousAcceptedCount || a.name.localeCompare(b.name, 'ja'));

// 称号の判定に必要な最小限の形。オフラインの Player とオンラインの PlayerView の両方が満たす。
export type AwardCandidate = {
  name: string;
  score: number;
  presentationScore: number;
  rejectCount: number;
  unanimousAcceptedCount: number;
};

export type Award = { title: string; winners: string[] };

// 最終画面の称号。オフラインとオンラインで同じ基準を使うためここに集約する。
// 実績が0件の称号は winners を空にし、表示側で「該当者なし」とする。
export const computeAwards = <T extends AwardCandidate>(players: T[]): Award[] => {
  if (players.length === 0) return [];
  const best = (pick: (player: T) => number, requirePositive: boolean): string[] => {
    const max = Math.max(...players.map(pick));
    if (requirePositive && max <= 0) return [];
    return players.filter((player) => pick(player) === max).map((player) => player.name);
  };

  return [
    { title: '学会MVP', winners: best((p) => p.score, false) },
    { title: '最優秀論文賞', winners: best((p) => p.presentationScore, true) },
    { title: 'Reviewer #2 賞', winners: best((p) => p.rejectCount, true) },
    { title: '話術賞', winners: best((p) => p.unanimousAcceptedCount, true) },
  ];
};
