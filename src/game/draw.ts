import type { Card, CardsByKind, DeckMode, GenreMode, Hand, CardSlot } from './types';

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
  genre: GenreMode,
  recentHands: string[][],
  cardSlots: CardSlot[],
  random: () => number = Math.random,
): Hand => {
  const recentCardIds = flattenRecentCardIds(recentHands);
  const selected: Array<Card | undefined> = Array(cardSlots.length).fill(undefined);
  const slotOrder = cardSlots
    .map((slot, index) => ({ index, poolSize: filterCards(cardsByKind[slot.kind], slot.tone, genre).length }))
    .sort((left, right) => left.poolSize - right.poolSize || left.index - right.index);

  for (const { index } of slotOrder) {
    const slot = cardSlots[index];
    const selectedIds = new Set(selected.filter((card): card is Card => Boolean(card)).map((card) => card.id));
    const preferred = availableCards(cardsByKind[slot.kind], slot.tone, genre, recentCardIds)
      .filter((card) => !selectedIds.has(card.id));
    const fallback = filterCards(cardsByKind[slot.kind], slot.tone, genre)
      .filter((card) => !selectedIds.has(card.id));
    selected[index] = pickCard(preferred.length > 0 ? preferred : fallback, random);
  }

  return selected as Card[];
};

export const rerollCard = (
  cardsByKind: CardsByKind,
  genre: GenreMode,
  recentHands: string[][],
  slot: CardSlot,
  currentHand: Hand,
  random: () => number = Math.random,
): Card => {
  const recentCardIds = flattenRecentCardIds(recentHands);
  const currentIds = new Set(currentHand.map((card) => card.id));
  const pool = availableCards(cardsByKind[slot.kind], slot.tone, genre, recentCardIds);
  const candidates = pool.filter((card) => !currentIds.has(card.id));
  const fallback = filterCards(cardsByKind[slot.kind], slot.tone, genre).filter((card) => !currentIds.has(card.id));
  return pickCard(candidates.length > 0 ? candidates : fallback, random);
};

export const hasRerollCandidate = (
  cardsByKind: CardsByKind,
  genre: GenreMode,
  slot: CardSlot,
  currentHand: Hand,
): boolean => {
  const currentIds = new Set(currentHand.map((card) => card.id));
  return filterCards(cardsByKind[slot.kind], slot.tone, genre).some((card) => !currentIds.has(card.id));
};

export const canDrawCardSlots = (
  cardsByKind: CardsByKind,
  genre: GenreMode,
  cardSlots: CardSlot[],
): boolean => {
  const pools = cardSlots
    .map((slot, index) => ({ index, cards: filterCards(cardsByKind[slot.kind], slot.tone, genre) }))
    .sort((left, right) => left.cards.length - right.cards.length || left.index - right.index);

  const assign = (position: number, usedIds: Set<string>): boolean => {
    if (position >= pools.length) {
      return true;
    }

    for (const card of pools[position].cards) {
      if (usedIds.has(card.id)) {
        continue;
      }
      usedIds.add(card.id);
      if (assign(position + 1, usedIds)) {
        return true;
      }
      usedIds.delete(card.id);
    }
    return false;
  };

  return assign(0, new Set());
};
