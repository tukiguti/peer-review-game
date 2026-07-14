import type { Player, PlayerId, ScoringResult, VoteEntry, VoteSummary } from './types';

export const summarizeVotes = (voterIds: PlayerId[], votes: Record<PlayerId, VoteEntry>): VoteSummary => {
  const acceptCount = voterIds.filter((id) => votes[id]?.vote === 'accept').length;
  const rejectCount = voterIds.length - acceptCount;
  const accepted = acceptCount * 2 > voterIds.length;
  const unanimous = accepted && acceptCount === voterIds.length;

  return {
    accepted,
    unanimous,
    acceptCount,
    rejectCount,
    majorityVote: accepted ? 'accept' : 'reject',
  };
};

export const calculateScoring = (
  presenterId: PlayerId,
  voterIds: PlayerId[],
  votes: Record<PlayerId, VoteEntry>,
): ScoringResult => {
  const summary = summarizeVotes(voterIds, votes);
  const deltas = [{ playerId: presenterId, delta: summary.unanimous ? 3 : summary.accepted ? 2 : 0 }];

  for (const voterId of voterIds) {
    if (votes[voterId]?.vote === summary.majorityVote) {
      deltas.push({ playerId: voterId, delta: 1 });
    }
  }

  return { summary, deltas };
};

export const applyScoring = (
  players: Player[],
  presenterId: PlayerId,
  votes: Record<PlayerId, VoteEntry>,
): Player[] => {
  const voterIds = players.filter((player) => player.id !== presenterId).map((player) => player.id);
  const { summary, deltas } = calculateScoring(presenterId, voterIds, votes);
  const deltaByPlayer = new Map(deltas.map((delta) => [delta.playerId, delta.delta]));

  return players.map((player) => {
    const vote = votes[player.id]?.vote;
    return {
      ...player,
      score: player.score + (deltaByPlayer.get(player.id) ?? 0),
      presentationScore:
        player.presentationScore + (player.id === presenterId ? (deltaByPlayer.get(player.id) ?? 0) : 0),
      acceptCount: player.acceptCount + (vote === 'accept' ? 1 : 0),
      rejectCount: player.rejectCount + (vote === 'reject' ? 1 : 0),
      unanimousAcceptedCount:
        player.id === presenterId && summary.unanimous
          ? player.unanimousAcceptedCount + 1
          : player.unanimousAcceptedCount,
    };
  });
};
