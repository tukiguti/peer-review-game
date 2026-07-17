import { describe, expect, it } from 'vitest';
import { availableCards, canDrawCardSlots, drawHand, filterCards, hasRerollCandidate, rerollCard } from './draw';
import { createInitialState, gameReducer } from './reducer';
import { calculateScoring } from './scoring';
import { areCardSlotsValid, arePlayerNamesValid, DEFAULT_SETTINGS, normalizeSettings } from './settings';
import cardsData from '../data/cards.json';
import type { CardKind, CardSlot, CardsByKind, DeckMode, Hand, Settings, VoteEntry } from './types';

const cards = cardsData as CardsByKind;
const makeSlots = (kinds: CardKind[], tone: DeckMode = 'all'): CardSlot[] => kinds.map((kind) => ({ kind, tone }));

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
      novelty: [{ id: 'n1', text: 'N1', tone: 'serious', genre: 'general' }],
    };

    const hand = drawHand(cardsByKind, 'all', [['f1', 'm1', 'c1']], makeSlots(['field', 'method', 'constraint'], 'serious'), () => 0);

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

  it('分野×3でも重複しない3枚を引く', () => {
    const hand = drawHand(cards, 'general', [], makeSlots(['field', 'field', 'field']), () => 0);

    expect(hand).toHaveLength(3);
    expect(hand.every((card) => card.genre === 'general')).toBe(true);
    expect(new Set(hand.map((card) => card.id)).size).toBe(3);
  });

  it('同じ種類でもスロットごとに真面目・ネタを混在して引ける', () => {
    const hand = drawHand(cards, 'general', [], [
      { kind: 'field', tone: 'serious' },
      { kind: 'field', tone: 'neta' },
      { kind: 'constraint', tone: 'neta' },
    ], () => 0);

    expect(hand.map((card) => card.tone)).toEqual(['serious', 'neta', 'neta']);
    expect(new Set(hand.map((card) => card.id)).size).toBe(3);
  });

  it('新規性スロットは新規性デッキからだけ引く', () => {
    const hand = drawHand(cards, 'all', [], makeSlots(['field', 'method', 'constraint', 'novelty']), () => 0);
    const noveltyIds = new Set(cards.novelty.map((card) => card.id));

    expect(hand).toHaveLength(4);
    expect(noveltyIds.has(hand[3].id)).toBe(true);
    expect(hand.map((card) => card.text)).toEqual([
      cards.field[0].text,
      cards.method[0].text,
      cards.constraint[0].text,
      cards.novelty[0].text,
    ]);
  });

  it('1〜5枚の任意構成を指定順で引く', () => {
    const cardKinds = ['constraint', 'field', 'method', 'field', 'constraint'] as CardKind[];
    const hand = drawHand(cards, 'all', [], makeSlots(cardKinds), () => 0);

    expect(hand).toHaveLength(5);
    expect(hand.map((card) => card.id)).toEqual([
      cards.constraint[0].id,
      cards.field[0].id,
      cards.method[0].id,
      cards.field[1].id,
      cards.constraint[1].id,
    ]);
  });

  it('同種カードで未使用候補があれば引き直せる', () => {
    const slot = { kind: 'field', tone: 'serious' } as const;
    const hand = drawHand(cards, 'general', [], [slot, slot, slot], () => 0);

    expect(hasRerollCandidate(cards, 'general', slot, hand)).toBe(true);
    const replacement = rerollCard(cards, 'general', [], slot, hand, () => 0);
    expect(hand.map((card) => card.id)).not.toContain(replacement.id);
  });

  it('引き直しでも対象スロットの真面目・ネタ設定を守る', () => {
    const slot = { kind: 'method', tone: 'neta' } as const;
    const hand = drawHand(cards, 'security', [], [slot, slot], () => 0);
    const replacement = rerollCard(cards, 'security', [], slot, hand, () => 0);

    expect(replacement.tone).toBe('neta');
    expect(hand.map((card) => card.id)).not.toContain(replacement.id);
  });

  it('スロット別の雰囲気と絞り込み後の候補数を検証する', () => {
    const netaMethods = makeSlots(Array(4).fill('method'), 'neta');

    expect(canDrawCardSlots(cards, 'fashion', netaMethods)).toBe(true);
    expect(canDrawCardSlots(cards, 'fashion', [...netaMethods, { kind: 'method', tone: 'neta' }])).toBe(false);
    expect(canDrawCardSlots(cards, 'fashion', [
      { kind: 'method', tone: 'serious' },
      { kind: 'method', tone: 'neta' },
      { kind: 'method', tone: 'all' },
    ])).toBe(true);
  });
});

describe('cards.json', () => {
  it('全カードが3ジャンル+汎用のいずれかに属し、各ジャンルで4種の山札が揃っている', () => {
    const genres = ['general', 'se', 'security', 'fashion'] as const;
    const kinds = ['field', 'method', 'constraint', 'novelty'] as const;

    for (const kind of kinds) {
      for (const card of cards[kind]) {
        expect(genres).toContain(card.genre);
      }

      for (const genre of genres) {
        // どのジャンルを選んでも4種の山札が空にならない(抽選が失敗しない)
        expect(filterCards(cards[kind], 'all', genre).length).toBeGreaterThan(0);
      }
    }
  });

  it('IDが全体で一意で、全モードの組み合わせに抽選候補がある', () => {
    const genres = ['general', 'se', 'security', 'fashion'] as const;
    const tones = ['serious', 'neta'] as const;
    const kinds = ['field', 'method', 'constraint', 'novelty'] as const;
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

  it('カードスロットは1〜5枚と雰囲気を保存し、不正な構成は既定の4枚へ戻す', () => {
    const customSlots: CardSlot[] = [
      { kind: 'field', tone: 'serious' },
      { kind: 'novelty', tone: 'neta' },
      { kind: 'constraint', tone: 'all' },
    ];
    expect(areCardSlotsValid(customSlots)).toBe(true);
    expect(areCardSlotsValid([{ kind: 'novelty', tone: 'all' }])).toBe(true);
    expect(areCardSlotsValid([])).toBe(false);
    expect(areCardSlotsValid(Array(6).fill({ kind: 'field', tone: 'all' }))).toBe(false);
    expect(areCardSlotsValid([{ kind: 'field', tone: 'unknown' }])).toBe(false);

    expect(normalizeSettings({ ...DEFAULT_SETTINGS, cardSlots: customSlots }).cardSlots).toEqual(customSlots);
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, cardSlots: [] }).cardSlots).toEqual([
      { kind: 'field', tone: 'all' },
      { kind: 'method', tone: 'all' },
      { kind: 'constraint', tone: 'all' },
      { kind: 'novelty', tone: 'all' },
    ]);
  });

  it('旧cardKindsと全体deckModeをスロット形式へ移行する', () => {
    const { cardSlots: _cardSlots, ...legacyBase } = DEFAULT_SETTINGS;
    const migrated = normalizeSettings({ ...legacyBase, cardKinds: ['field', 'field', 'constraint'], deckMode: 'neta' });

    expect(migrated.cardSlots).toEqual([
      { kind: 'field', tone: 'neta' },
      { kind: 'field', tone: 'neta' },
      { kind: 'constraint', tone: 'neta' },
    ]);
  });
});

describe('game reducer', () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    playerNames: ['発表者', '査読A', '査読B'],
    rounds: 1,
    preparationEnabled: false,
    rerollsPerPlayer: 1,
    voteMode: 'passplay',
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

    state = gameReducer(state, { type: 'rerollCard', index: 0, card: secondHand[0], animate: false });
    expect(state.hand?.[0].id).toBe(secondHand[0].id);
    expect(state.players[0].rerollsLeft).toBe(0);
    expect(gameReducer(state, { type: 'rerollCard', index: 1, card: secondHand[1], animate: false })).toBe(state);
  });

  it('同じ種類が複数あっても指定したスロットだけを引き直す', () => {
    const fieldSettings = { ...settings, cardSlots: makeSlots(['field', 'field', 'field']) };
    const fieldHand = [cards.field[0], cards.field[1], cards.field[2]];
    let state = gameReducer(createInitialState(fieldSettings), { type: 'startGame', settings: fieldSettings });
    state = gameReducer(state, { type: 'drawHand', hand: fieldHand, animate: false });
    state = gameReducer(state, { type: 'rerollCard', index: 1, card: cards.field[3], animate: false });

    expect(state.hand?.map((card) => card.id)).toEqual([cards.field[0].id, cards.field[3].id, cards.field[2].id]);
    expect(state.drawSpinIndex).toBe(1);
    expect(state.players[0].rerollsLeft).toBe(0);
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

  it('せーの方式: ready→countdown→tally→result へ進み、全員入力まで結果に進めない', () => {
    const simSettings: Settings = { ...settings, voteMode: 'simultaneous' };
    let state = gameReducer(createInitialState(simSettings), { type: 'startGame', settings: simSettings });
    state = gameReducer(state, { type: 'drawHand', hand: firstHand, animate: false });
    state = gameReducer(state, { type: 'startPrepare' });
    expect(state.phase).toBe('present');
    state = gameReducer(state, { type: 'startVote' });
    expect(state.phase).toBe('vote');
    expect(state.voteStep).toBe('ready');

    state = gameReducer(state, { type: 'beginCountdown' });
    expect(state.voteStep).toBe('countdown');
    state = gameReducer(state, { type: 'countdownDone' });
    expect(state.voteStep).toBe('tally');

    // 発表者(p1)は集計対象外
    expect(gameReducer(state, { type: 'setTallyVote', playerId: 'p1', vote: 'accept' })).toBe(state);

    // 全員ぶんの手が入るまで結果へ進めない
    state = gameReducer(state, { type: 'setTallyVote', playerId: 'p2', vote: 'accept' });
    expect(gameReducer(state, { type: 'revealResult' })).toBe(state);

    state = gameReducer(state, { type: 'setTallyVote', playerId: 'p3', vote: 'reject' });
    state = gameReducer(state, { type: 'revealResult' });

    expect(state.phase).toBe('result');
    // 1 Accept / 1 Reject = 同数 → 不採択。多数派(Reject)側の査読者だけ+1
    expect(state.players.map((player) => player.score)).toEqual([0, 0, 1]);
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

  it('8人3周でも各発表者を飛ばして7人が1回ずつ投票する', () => {
    const maxSettings: Settings = {
      ...settings,
      playerNames: Array.from({ length: 8 }, (_, index) => `参加者${index + 1}`),
      rounds: 3,
    };
    let state = gameReducer(createInitialState(maxSettings), { type: 'startGame', settings: maxSettings });

    for (let turn = 0; turn < 24; turn += 1) {
      const presenterId = state.players[state.presenterIndex].id;
      state = gameReducer(state, { type: 'drawHand', hand: firstHand, animate: false });
      state = gameReducer(state, { type: 'startPrepare' });
      state = gameReducer(state, { type: 'startVote' });

      while (state.phase === 'vote') {
        state = gameReducer(state, { type: 'openBallot' });
        state = gameReducer(state, { type: 'setVoteDraft', vote: 'accept' });
        state = gameReducer(state, { type: 'submitVote' });
        state = gameReducer(state, { type: 'continueVoting' });
      }

      expect(Object.keys(state.votes)).toHaveLength(7);
      expect(state.votes[presenterId]).toBeUndefined();
      state = gameReducer(state, { type: 'nextTurn' });
    }

    expect(state.phase).toBe('final');
    expect(state.players.map((player) => player.score)).toEqual(Array(8).fill(30));
    expect(state.players.map((player) => player.presentationScore)).toEqual(Array(8).fill(9));
    expect(state.recentHands).toHaveLength(3);
  });
});
