// カード構成の定数・バリデータ。DOM/localStorage に依存しない純粋モジュールなので、
// クライアント(settings.ts 経由)と Worker(部屋サーバ)の双方から安全に import できる。
import type { CardKind, CardSlot, DeckMode, GenreMode } from './types';

export const MIN_CARD_COUNT = 1;
export const MAX_CARD_COUNT = 5;

export const STANDARD_CARD_SLOTS: CardSlot[] = [
  { kind: 'field', tone: 'all' },
  { kind: 'method', tone: 'all' },
  { kind: 'constraint', tone: 'all' },
];

// 既定は「分野・手法・制約・新規性」の4枚。新規性は査読で必ず問われる観点をカード化したもの。
export const DEFAULT_CARD_SLOTS: CardSlot[] = [
  ...STANDARD_CARD_SLOTS.map((slot) => ({ ...slot })),
  { kind: 'novelty', tone: 'all' },
];

export const GENRE_MODES: GenreMode[] = ['all', 'general', 'se', 'security', 'fashion'];

export const isCardKind = (value: unknown): value is CardKind =>
  value === 'field' || value === 'method' || value === 'constraint' || value === 'novelty';

export const isDeckMode = (value: unknown): value is DeckMode =>
  value === 'serious' || value === 'neta' || value === 'all';

export const isGenreMode = (value: unknown): value is GenreMode =>
  (GENRE_MODES as string[]).includes(value as string);

export const areCardKindsValid = (value: unknown): value is CardKind[] =>
  Array.isArray(value)
  && value.length >= MIN_CARD_COUNT
  && value.length <= MAX_CARD_COUNT
  && value.every(isCardKind);

export const areCardSlotsValid = (value: unknown): value is CardSlot[] =>
  Array.isArray(value)
  && value.length >= MIN_CARD_COUNT
  && value.length <= MAX_CARD_COUNT
  && value.every((slot) => (
    typeof slot === 'object'
    && slot !== null
    && isCardKind((slot as Partial<CardSlot>).kind)
    && isDeckMode((slot as Partial<CardSlot>).tone)
  ));
