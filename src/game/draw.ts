import type { Card, CardKind, CardsByKind, DeckMode, GenreMode, Hand } from './types';

export const filterCards = (cards: Card[], mode: DeckMode, genre: GenreMode): Card[] =>
  cards.filter((card) => (mode === 'all' || card.tone === mode) && (genre === 'all' || card.genre === genre));

export const availableCards = (cards: Card[], mode: DeckMode, genre: GenreMode, recentCardIds: string[]): Card[] => {
  const filtered = filterCards(cards, mode, genre);
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

export const drawHand = (
  cardsByKind: CardsByKind,
  mode: DeckMode,
  genre: GenreMode,
  recentHands: string[][],
  cardKinds: CardKind[],
  random: () => number = Math.random,
): Hand => {
  const recentCardIds = flattenRecentCardIds(recentHands);
  const selected: Card[] = [];

  for (const kind of cardKinds) {
    const selectedIds = new Set(selected.map((card) => card.id));
    const preferred = availableCards(cardsByKind[kind], mode, genre, recentCardIds)
      .filter((card) => !selectedIds.has(card.id));
    const fallback = filterCards(cardsByKind[kind], mode, genre)
      .filter((card) => !selectedIds.has(card.id));
    selected.push(pickCard(preferred.length > 0 ? preferred : fallback, random));
  }

  return selected;
};

export const rerollCard = (
  cardsByKind: CardsByKind,
  mode: DeckMode,
  genre: GenreMode,
  recentHands: string[][],
  kind: CardKind,
  currentHand: Hand,
  random: () => number = Math.random,
): Card => {
  const recentCardIds = flattenRecentCardIds(recentHands);
  const currentIds = new Set(currentHand.map((card) => card.id));
  const pool = availableCards(cardsByKind[kind], mode, genre, recentCardIds);
  const candidates = pool.filter((card) => !currentIds.has(card.id));
  const fallback = filterCards(cardsByKind[kind], mode, genre).filter((card) => !currentIds.has(card.id));
  return pickCard(candidates.length > 0 ? candidates : fallback, random);
};

export const hasRerollCandidate = (
  cardsByKind: CardsByKind,
  mode: DeckMode,
  genre: GenreMode,
  kind: CardKind,
  currentHand: Hand,
): boolean => {
  const currentIds = new Set(currentHand.map((card) => card.id));
  return filterCards(cardsByKind[kind], mode, genre).some((card) => !currentIds.has(card.id));
};

export const findUnavailableCardKind = (
  cardsByKind: CardsByKind,
  mode: DeckMode,
  genre: GenreMode,
  cardKinds: CardKind[],
  rerollsPerPlayer: number,
): CardKind | undefined => {
  const counts = cardKinds.reduce<Record<CardKind, number>>(
    (result, kind) => ({ ...result, [kind]: result[kind] + 1 }),
    { field: 0, method: 0, constraint: 0 },
  );

  return (['field', 'method', 'constraint'] as CardKind[]).find((kind) => {
    const availableCount = filterCards(cardsByKind[kind], mode, genre).length;
    const reserveForReroll = rerollsPerPlayer > 0 && counts[kind] > 0 ? 1 : 0;
    return counts[kind] + reserveForReroll > availableCount;
  });
};
