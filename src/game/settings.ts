import type { Settings, VoteMode } from './types';
import {
  areCardKindsValid,
  areCardSlotsValid,
  DEFAULT_CARD_SLOTS,
  GENRE_MODES,
  isDeckMode,
  MAX_CARD_COUNT,
  MIN_CARD_COUNT,
  STANDARD_CARD_SLOTS,
} from './cardConfig';

// カード構成の定数・バリデータは cardConfig に移設。既存の import 互換のため再エクスポートする。
export { MIN_CARD_COUNT, MAX_CARD_COUNT, STANDARD_CARD_SLOTS, DEFAULT_CARD_SLOTS, areCardKindsValid, areCardSlotsValid };

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

const STORAGE_KEY = 'peer-review-game-settings';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isVoteMode = (value: unknown): value is VoteMode =>
  value === 'passplay' || value === 'simultaneous';

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
