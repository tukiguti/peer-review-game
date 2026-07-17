import type { CardKind, CardSlot, DeckMode, Settings, VoteMode } from './types';

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

export const DEFAULT_SETTINGS: Settings = {
  playerNames: ['田中', '佐藤', '鈴木'],
  rounds: 2,
  presentationSeconds: 60,
  preparationEnabled: true,
  rerollsPerPlayer: 2,
  genreMode: 'all',
  cardSlots: DEFAULT_CARD_SLOTS,
  voteMode: 'simultaneous',
  reducedMotion: false,
};

const GENRE_MODES: Settings['genreMode'][] = ['all', 'general', 'se', 'security', 'fashion'];

const STORAGE_KEY = 'peer-review-game-settings';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isCardKind = (value: unknown): value is CardKind =>
  value === 'field' || value === 'method' || value === 'constraint' || value === 'novelty';

const isDeckMode = (value: unknown): value is DeckMode =>
  value === 'serious' || value === 'neta' || value === 'all';

const isVoteMode = (value: unknown): value is VoteMode =>
  value === 'passplay' || value === 'simultaneous';

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

type LegacySettingsInput = Partial<Settings> & {
  cardKinds?: unknown;
  deckMode?: unknown;
};

export const cleanPlayerNames = (playerNames: string[]): string[] =>
  playerNames.map((name) => name.trim()).filter(Boolean).slice(0, 8);

export const arePlayerNamesValid = (playerNames: string[]): boolean => {
  const cleaned = cleanPlayerNames(playerNames);
  return cleaned.length === playerNames.length && cleaned.length >= 3 && new Set(cleaned).size === cleaned.length;
};

export const normalizeSettings = (value: LegacySettingsInput): Settings => {
  const playerNames = isStringArray(value.playerNames)
    ? cleanPlayerNames(value.playerNames)
    : DEFAULT_SETTINGS.playerNames;
  const legacyTone = isDeckMode(value.deckMode) ? value.deckMode : 'all';
  const cardSlots = areCardSlotsValid(value.cardSlots)
    ? value.cardSlots.map((slot) => ({ ...slot }))
    : areCardKindsValid(value.cardKinds)
      ? value.cardKinds.map((kind) => ({ kind, tone: legacyTone }))
      : DEFAULT_CARD_SLOTS.map((slot) => ({ ...slot }));

  return {
    playerNames: playerNames.length >= 3 ? playerNames : DEFAULT_SETTINGS.playerNames,
    rounds: value.rounds === 1 || value.rounds === 2 || value.rounds === 3 ? value.rounds : DEFAULT_SETTINGS.rounds,
    presentationSeconds: [30, 60, 90, 120].includes(value.presentationSeconds ?? 0)
      ? (value.presentationSeconds as Settings['presentationSeconds'])
      : DEFAULT_SETTINGS.presentationSeconds,
    preparationEnabled:
      typeof value.preparationEnabled === 'boolean' ? value.preparationEnabled : DEFAULT_SETTINGS.preparationEnabled,
    rerollsPerPlayer:
      typeof value.rerollsPerPlayer === 'number' && Number.isInteger(value.rerollsPerPlayer) && value.rerollsPerPlayer >= 0 && value.rerollsPerPlayer <= 3
        ? value.rerollsPerPlayer
        : DEFAULT_SETTINGS.rerollsPerPlayer,
    genreMode: GENRE_MODES.includes(value.genreMode as Settings['genreMode'])
      ? (value.genreMode as Settings['genreMode'])
      : DEFAULT_SETTINGS.genreMode,
    cardSlots,
    voteMode: isVoteMode(value.voteMode) ? value.voteMode : DEFAULT_SETTINGS.voteMode,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
  };
};

export const loadSettings = (): Settings => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw) as LegacySettingsInput) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: Settings): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // ストレージが無効・容量超過でも、ゲーム自体は継続できる。
  }
};
