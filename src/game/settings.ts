import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  playerNames: ['田中', '佐藤', '鈴木'],
  rounds: 2,
  presentationSeconds: 60,
  preparationEnabled: true,
  rerollsPerPlayer: 2,
  deckMode: 'all',
  genreMode: 'all',
  reducedMotion: false,
};

const GENRE_MODES: Settings['genreMode'][] = ['all', 'general', 'se', 'security', 'fashion'];

const STORAGE_KEY = 'peer-review-game-settings';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const normalizeSettings = (value: Partial<Settings>): Settings => {
  const playerNames = isStringArray(value.playerNames)
    ? value.playerNames.map((name) => name.trim()).filter(Boolean).slice(0, 8)
    : DEFAULT_SETTINGS.playerNames;

  return {
    playerNames: playerNames.length >= 3 ? playerNames : DEFAULT_SETTINGS.playerNames,
    rounds: value.rounds === 1 || value.rounds === 2 || value.rounds === 3 ? value.rounds : DEFAULT_SETTINGS.rounds,
    presentationSeconds: [30, 60, 90, 120].includes(value.presentationSeconds ?? 0)
      ? (value.presentationSeconds as Settings['presentationSeconds'])
      : DEFAULT_SETTINGS.presentationSeconds,
    preparationEnabled:
      typeof value.preparationEnabled === 'boolean' ? value.preparationEnabled : DEFAULT_SETTINGS.preparationEnabled,
    rerollsPerPlayer:
      typeof value.rerollsPerPlayer === 'number' && value.rerollsPerPlayer >= 0 && value.rerollsPerPlayer <= 3
        ? value.rerollsPerPlayer
        : DEFAULT_SETTINGS.rerollsPerPlayer,
    deckMode: value.deckMode === 'serious' || value.deckMode === 'neta' || value.deckMode === 'all' ? value.deckMode : DEFAULT_SETTINGS.deckMode,
    genreMode: GENRE_MODES.includes(value.genreMode as Settings['genreMode'])
      ? (value.genreMode as Settings['genreMode'])
      : DEFAULT_SETTINGS.genreMode,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
  };
};

export const loadSettings = (): Settings => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw) as Partial<Settings>) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: Settings): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
};
