import { describe, expect, it } from 'vitest';
import { availableCards, drawHand, filterCards } from './draw';
import { createInitialState, gameReducer } from './reducer';
import { calculateScoring } from './scoring';
import { arePlayerNamesValid, DEFAULT_SETTINGS, normalizeSettings } from './settings';
import cardsData from '../data/cards.json';
import type { CardsByKind, Hand, Settings, VoteEntry } from './types';

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

  it('IDが全体で一意で、全モードの組み合わせに抽選候補がある', () => {
    const genres = ['general', 'se', 'security', 'fashion'] as const;
    const tones = ['serious', 'neta'] as const;
    const kinds = ['field', 'method', 'constraint'] as const;
    const allCards = kinds.flatMap((kind) => cards[kind]);

    expect(new Set(allCards.map((card) => card.id)).size).toBe(allCards.length);
    for (const card of allCards) {
      expect(card.id.trim()).not.toBe('');
      expect(card.text.trim()).not.toBe('');
    }

    for (const kind of kinds) {
      for (const genre of genres) {
        for (const tone of tones) {
          expect(filterCards(cards[kind], tone, genre).length, `${kind}/${genre}/${tone}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('settings', () => {
  it('入力途中の空欄と重複名を開始不可にする', () => {
    expect(arePlayerNamesValid(['田中', '', '鈴木'])).toBe(false);
    expect(arePlayerNamesValid(['田中', '田中', '鈴木'])).toBe(false);
    expect(arePlayerNamesValid([' 田中 ', '佐藤', '鈴木'])).toBe(true);
  });

  it('小数の引き直し回数は既定値へ戻す', () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, rerollsPerPlayer: 1.5 }).rerollsPerPlayer).toBe(
      DEFAULT_SETTINGS.rerollsPerPlayer,
    );
  });
});

describe('game reducer', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    playerNames: ['発表者', '査読A', '査読B'],
    rounds: 1,
    preparationEnabled: false,
    rerollsPerPlayer: 1,
    reducedMotion: true,
  };
  const firstHand = [cards.field[0], cards.method[0], cards.constraint[0]] as Hand;
  const secondHand = [cards.field[1], cards.method[1], cards.constraint[1]] as Hand;

  it('セットアップの名前を空欄にしても既定名へ巻き戻さない', () => {
    const initial = createInitialState(settings);
    const editing = { ...settings, playerNames: ['発表者', '', '査読B'] };
    const next = gameReducer(initial, { type: 'updateSettings', settings: editing });

    expect(next.settings.playerNames).toEqual(editing.playerNames);
    expect(gameReducer(next, { type: 'startGame', settings: editing })).toBe(next);
  });

  it('初回抽選後の無料再抽選を拒否し、引き直し上限を守る', () => {
    let state = gameReducer(createInitialState(settings), { type: 'startGame', settings });
    state = gameReducer(state, { type: 'drawHand', hand: firstHand, animate: false });

    expect(gameReducer(state, { type: 'drawHand', hand: secondHand, animate: false })).toBe(state);

    state = gameReducer(state, { type: 'rerollCard', kind: 'field', card: secondHand[0], animate: false });
    expect(state.hand?.[0].id).toBe(secondHand[0].id);
    expect(state.players[0].rerollsLeft).toBe(0);
    expect(gameReducer(state, { type: 'rerollCard', kind: 'method', card: secondHand[1], animate: false })).toBe(state);
  });

  it('全員の秘密投票後だけ得点し、同数ならReject側だけを加点する', () => {
    let state = gameReducer(createInitialState(settings), { type: 'startGame', settings });
    state = gameReducer(state, { type: 'drawHand', hand: firstHand, animate: false });
    state = gameReducer(state, { type: 'startPrepare' });
    state = gameReducer(state, { type: 'startVote' });

    expect(state.phase).toBe('vote');
    expect(gameReducer(state, { type: 'continueVoting' })).toBe(state);

    state = gameReducer(state, { type: 'openBallot' });
    state = gameReducer(state, { type: 'setVoteDraft', vote: 'accept' });
    state = gameReducer(state, { type: 'submitVote' });
    state = gameReducer(state, { type: 'continueVoting' });
    expect(state.phase).toBe('vote');
    expect(state.votingIndex).toBe(2);

    state = gameReducer(state, { type: 'openBallot' });
    state = gameReducer(state, { type: 'setVoteDraft', vote: 'reject' });
    state = gameReducer(state, { type: 'submitVote' });
    state = gameReducer(state, { type: 'continueVoting' });

    expect(state.phase).toBe('result');
    expect(state.players.map((player) => player.score)).toEqual([0, 0, 1]);
    expect(state.players.map((player) => player.presentationScore)).toEqual([0, 0, 0]);
    expect(state.players.map((player) => player.rejectCount)).toEqual([0, 0, 1]);
  });

  it('結果画面以外から次の手番へ進めない', () => {
    const state = gameReducer(createInitialState(settings), { type: 'startGame', settings });
    expect(gameReducer(state, { type: 'nextTurn' })).toBe(state);
  });

  it('3人1周を全フェーズ通して最終結果へ進める', () => {
    const settingsWithPreparation = { ...settings, preparationEnabled: true };
    let state = gameReducer(createInitialState(settingsWithPreparation), {
      type: 'startGame',
      settings: settingsWithPreparation,
    });

    for (let turn = 0; turn < 3; turn += 1) {
      state = gameReducer(state, { type: 'drawHand', hand: firstHand, animate: false });
      state = gameReducer(state, { type: 'startPrepare' });
      expect(state.phase).toBe('prepare');
      state = gameReducer(state, { type: 'startPresent' });
      state = gameReducer(state, { type: 'startVote' });

      while (state.phase === 'vote') {
        state = gameReducer(state, { type: 'openBallot' });
        state = gameReducer(state, { type: 'setVoteDraft', vote: 'accept' });
        state = gameReducer(state, { type: 'submitVote' });
        state = gameReducer(state, { type: 'continueVoting' });
      }

      expect(state.phase).toBe('result');
      state = gameReducer(state, { type: 'nextTurn' });
    }

    expect(state.phase).toBe('final');
    expect(state.players.map((player) => player.score)).toEqual([5, 5, 5]);
    expect(state.players.map((player) => player.presentationScore)).toEqual([3, 3, 3]);
    expect(state.players.map((player) => player.unanimousAcceptedCount)).toEqual([1, 1, 1]);
    expect(gameReducer(state, { type: 'resetToSetup' }).phase).toBe('setup');
  });
});
