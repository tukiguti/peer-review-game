// カード構成のプリセット。オフラインの設定画面とオンラインのロビー設定で共有する。
import type { CardKind, CardSlot, DeckMode } from './types';

export const slots = (kinds: CardKind[], tone: DeckMode = 'all'): CardSlot[] =>
  kinds.map((kind) => ({ kind, tone }));

export const CARD_PRESETS: { label: string; description: string; slots: CardSlot[] }[] = [
  { label: '査読4枚', description: '分野・手法・制約・新規性', slots: slots(['field', 'method', 'constraint', 'novelty']) },
  { label: '標準3枚', description: '分野・手法・制約', slots: slots(['field', 'method', 'constraint']) },
  { label: '分野×3', description: '3テーマを合体', slots: slots(['field', 'field', 'field']) },
  { label: 'ライト2枚', description: '分野・手法', slots: slots(['field', 'method']) },
  { label: '盛り盛り5枚', description: '分野2・手法・制約・新規性', slots: slots(['field', 'field', 'method', 'constraint', 'novelty']) },
];

export const sameSlots = (left: CardSlot[], right: CardSlot[]): boolean =>
  left.length === right.length
  && left.every((slot, index) => slot.kind === right[index].kind && slot.tone === right[index].tone);
