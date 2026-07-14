import { describe, expect, it } from 'vitest';
import { availableCards, drawHand, filterCards } from './draw';
import { calculateScoring } from './scoring';
import cardsData from '../data/cards.json';
import type { CardsByKind, VoteEntry } from './types';

const cards = cardsData as CardsByKind;

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
      { id: 'a', text: 'A', tone: 'serious' as const, genre: 'general' as const },
      { id: 'b', text: 'B', tone: 'serious' as const, genre: 'general' as const },
      { id: 'c', text: 'C', tone: 'serious' as const, genre: 'general' as const },
    ];

    expect(availableCards(cards, 'all', 'all', ['a', 'b']).map((card) => card.id)).toEqual(['c']);
  });

  it('除外すると空になる場合はデッキを戻して抽選できる', () => {
    const cardsByKind: CardsByKind = {
      field: [{ id: 'f1', text: 'F1', tone: 'serious', genre: 'general' }],
      method: [{ id: 'm1', text: 'M1', tone: 'serious', genre: 'general' }],
      constraint: [{ id: 'c1', text: 'C1', tone: 'serious', genre: 'general' }],
    };

    const hand = drawHand(cardsByKind, 'serious', 'all', [['f1', 'm1', 'c1']], () => 0);

    expect(hand.map((card) => card.id)).toEqual(['f1', 'm1', 'c1']);
  });

  it('ジャンルを指定すると、そのジャンルのカードだけが抽選対象になる', () => {
    const cards = [
      { id: 'se1', text: '技術的負債', tone: 'serious' as const, genre: 'se' as const },
      { id: 'sec1', text: 'ゼロデイ脆弱性', tone: 'serious' as const, genre: 'security' as const },
      { id: 'fa1', text: 'バーチャル試着', tone: 'serious' as const, genre: 'fashion' as const },
      { id: 'g1', text: '味噌の熟成', tone: 'neta' as const, genre: 'general' as const },
    ];

    expect(filterCards(cards, 'all', 'se').map((card) => card.id)).toEqual(['se1']);
    expect(filterCards(cards, 'all', 'security').map((card) => card.id)).toEqual(['sec1']);
    expect(filterCards(cards, 'all', 'fashion').map((card) => card.id)).toEqual(['fa1']);
    expect(filterCards(cards, 'all', 'all')).toHaveLength(4);
  });

  it('ジャンルと真面目/ネタの絞り込みは同時に効く', () => {
    const cards = [
      { id: 'se1', text: '技術的負債', tone: 'serious' as const, genre: 'se' as const },
      { id: 'se2', text: '動かないビルド', tone: 'neta' as const, genre: 'se' as const },
      { id: 'sec1', text: 'ゼロデイ脆弱性', tone: 'serious' as const, genre: 'security' as const },
    ];

    expect(filterCards(cards, 'neta', 'se').map((card) => card.id)).toEqual(['se2']);
  });
});

describe('cards.json', () => {
  it('全カードが3ジャンル+汎用のいずれかに属し、各ジャンルで3種の山札が揃っている', () => {
    const genres = ['general', 'se', 'security', 'fashion'] as const;
    const kinds = ['field', 'method', 'constraint'] as const;

    for (const kind of kinds) {
      for (const card of cards[kind]) {
        expect(genres).toContain(card.genre);
      }

      for (const genre of genres) {
        // どのジャンルを選んでも3種の山札が空にならない(抽選が失敗しない)
        expect(filterCards(cards[kind], 'all', genre).length).toBeGreaterThan(0);
      }
    }
  });
});
