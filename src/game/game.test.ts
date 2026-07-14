import { describe, expect, it } from 'vitest';
import { availableCards, drawHand } from './draw';
import { calculateScoring } from './scoring';
import type { CardsByKind, VoteEntry } from './types';

describe('scoring', () => {
  it('賛成反対同数は不採択', () => {
    const votes: Record<string, VoteEntry> = {
      p2: { vote: 'accept' },
      p3: { vote: 'accept' },
      p4: { vote: 'reject' },
      p5: { vote: 'reject' },
    };

    const result = calculateScoring('p1', ['p2', 'p3', 'p4', 'p5'], votes);

    expect(result.summary.accepted).toBe(false);
    expect(result.summary.majorityVote).toBe('reject');
    expect(result.deltas.find((delta) => delta.playerId === 'p1')?.delta).toBe(0);
  });

  it('満場一致は+3で+2と重複加算しない', () => {
    const votes: Record<string, VoteEntry> = {
      p2: { vote: 'accept' },
      p3: { vote: 'accept' },
      p4: { vote: 'accept' },
    };

    const result = calculateScoring('p1', ['p2', 'p3', 'p4'], votes);

    expect(result.summary.accepted).toBe(true);
    expect(result.summary.unanimous).toBe(true);
    expect(result.deltas.find((delta) => delta.playerId === 'p1')?.delta).toBe(3);
  });

  it('多数派に投票した査読者は+1', () => {
    const votes: Record<string, VoteEntry> = {
      p2: { vote: 'accept' },
      p3: { vote: 'accept' },
      p4: { vote: 'reject' },
    };

    const result = calculateScoring('p1', ['p2', 'p3', 'p4'], votes);

    expect(result.deltas).toContainEqual({ playerId: 'p2', delta: 1 });
    expect(result.deltas).toContainEqual({ playerId: 'p3', delta: 1 });
    expect(result.deltas).not.toContainEqual({ playerId: 'p4', delta: 1 });
  });
});

describe('draw', () => {
  it('直近3手番のカードを抽選から除外する', () => {
    const cards = [
      { id: 'a', text: 'A', tone: 'serious' as const },
      { id: 'b', text: 'B', tone: 'serious' as const },
      { id: 'c', text: 'C', tone: 'serious' as const },
    ];

    expect(availableCards(cards, 'all', ['a', 'b']).map((card) => card.id)).toEqual(['c']);
  });

  it('除外すると空になる場合はデッキを戻して抽選できる', () => {
    const cardsByKind: CardsByKind = {
      field: [{ id: 'f1', text: 'F1', tone: 'serious' }],
      method: [{ id: 'm1', text: 'M1', tone: 'serious' }],
      constraint: [{ id: 'c1', text: 'C1', tone: 'serious' }],
    };

    const hand = drawHand(cardsByKind, 'serious', [['f1', 'm1', 'c1']], () => 0);

    expect(hand.map((card) => card.id)).toEqual(['f1', 'm1', 'c1']);
  });
});
