import type { Card, CardKind, CardsByKind, DeckMode, Hand } from './types';

const KINDS: CardKind[] = ['field', 'method', 'constraint'];

export const filterCardsByMode = (cards: Card[], mode: DeckMode): Card[] =>
  mode === 'all' ? cards : cards.filter((card) => card.tone === mode);

export const availableCards = (cards: Card[], mode: DeckMode, recentCardIds: string[]): Card[] => {
  const filtered = filterCardsByMode(cards, mode);
  const recent = new Set(recentCardIds);
  const withoutRecent = filtered.filter((card) => !recent.has(card.id));
  return withoutRecent.length > 0 ? withoutRecent : filtered;
};

export const pickCard = (cards: Card[], random: () => number = Math.random): Card => {
  if (cards.length === 0) {
    throw new Error('抽選可能なカードがありません。');
  }

  return cards[Math.floor(random() * cards.length)];
};

export const flattenRecentCardIds = (recentHands: string[][]): string[] => recentHands.slice(-3).flat();

export const drawHand = (cardsByKind: CardsByKind, mode: DeckMode, recentHands: string[][], random: () => number = Math.random): Hand => {
  const recentCardIds = flattenRecentCardIds(recentHands);
  return KINDS.map((kind) => pickCard(availableCards(cardsByKind[kind], mode, recentCardIds), random)) as Hand;
};

export const rerollCard = (
  cardsByKind: CardsByKind,
  mode: DeckMode,
  recentHands: string[][],
  kind: CardKind,
  currentHand: Hand,
  random: () => number = Math.random,
): Card => {
  const recentCardIds = flattenRecentCardIds(recentHands);
  const currentIds = new Set(currentHand.map((card) => card.id));
  const candidates = availableCards(cardsByKind[kind], mode, recentCardIds).filter((card) => !currentIds.has(card.id));
  return pickCard(candidates.length > 0 ? candidates : availableCards(cardsByKind[kind], mode, recentCardIds), random);
};
