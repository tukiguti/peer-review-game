import styles from '../App.module.css';
import { findUnavailableCardKind } from '../game/draw';
import { kindLabel } from '../game/reducer';
import { areCardKindsValid, arePlayerNamesValid, cleanPlayerNames, MAX_CARD_COUNT, MIN_CARD_COUNT } from '../game/settings';
import type { CardsScreenProps } from './screenTypes';
import type { CardKind, DeckMode, GenreMode, Settings } from '../game/types';

const presentationOptions = [30, 60, 90, 120];

const CARD_PRESETS: { label: string; description: string; kinds: CardKind[] }[] = [
  { label: '標準3枚', description: '分野・手法・制約', kinds: ['field', 'method', 'constraint'] },
  { label: '分野×3', description: '3テーマを合体', kinds: ['field', 'field', 'field'] },
  { label: 'ライト2枚', description: '分野・手法', kinds: ['field', 'method'] },
  { label: '盛り盛り4枚', description: '分野2枚・手法・制約', kinds: ['field', 'field', 'method', 'constraint'] },
];

const sameKinds = (left: CardKind[], right: CardKind[]): boolean =>
  left.length === right.length && left.every((kind, index) => kind === right[index]);

export const SetupScreen = ({ state, dispatch, cards }: CardsScreenProps) => {
  const settings = state.settings;
  const validPlayers = cleanPlayerNames(settings.playerNames);
  const hasDuplicateNames = new Set(validPlayers).size !== validPlayers.length;
  const hasBlankNames = validPlayers.length !== settings.playerNames.length;
  const unavailableKind = findUnavailableCardKind(
    cards,
    settings.deckMode,
    settings.genreMode,
    settings.cardKinds,
    settings.rerollsPerPlayer,
  );
  const cardKindsValid = areCardKindsValid(settings.cardKinds) && !unavailableKind;
  const canStart = arePlayerNamesValid(settings.playerNames) && cardKindsValid;

  const update = (patch: Partial<Settings>) => {
    dispatch({ type: 'updateSettings', settings: { ...settings, ...patch } });
  };

  const updateName = (index: number, name: string) => {
    const names = [...settings.playerNames];
    names[index] = name;
    update({ playerNames: names });
  };

  const removeName = (index: number) => {
    update({ playerNames: settings.playerNames.filter((_, currentIndex) => currentIndex !== index) });
  };

  const updateCardKind = (index: number, kind: CardKind) => {
    const cardKinds = [...settings.cardKinds];
    cardKinds[index] = kind;
    update({ cardKinds });
  };

  const removeCardSlot = (index: number) => {
    update({ cardKinds: settings.cardKinds.filter((_, currentIndex) => currentIndex !== index) });
  };

  return (
    <section className={styles.screen}>
      <div className={styles.screenHeader}>
        <p className={styles.eyebrow}>setup</p>
        <h2>プレイヤーと設定</h2>
      </div>

      <div className={styles.setupGrid}>
        <section className={styles.panel}>
          <h3>プレイヤー名</h3>
          <div className={styles.nameList}>
            {settings.playerNames.map((name, index) => (
              <div className={styles.nameRow} key={index}>
                <span aria-hidden="true">{index + 1}</span>
                <input
                  aria-label={`プレイヤー${index + 1}の名前`}
                  value={name}
                  maxLength={12}
                  onChange={(event) => updateName(index, event.target.value)}
                />
                <button
                  aria-label={`プレイヤー${index + 1}を削除`}
                  type="button"
                  disabled={settings.playerNames.length <= 3}
                  onClick={() => removeName(index)}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={settings.playerNames.length >= 8}
            onClick={() => update({ playerNames: [...settings.playerNames, `参加者${settings.playerNames.length + 1}`] })}
          >
            プレイヤー追加
          </button>
        </section>

        <section className={styles.panel}>
          <h3>ゲーム設定</h3>
          <label className={styles.fieldLine}>
            <span>周回数</span>
            <select value={settings.rounds} onChange={(event) => update({ rounds: Number(event.target.value) })}>
              <option value={1}>1周</option>
              <option value={2}>2周</option>
              <option value={3}>3周</option>
            </select>
          </label>
          <label className={styles.fieldLine}>
            <span>発表時間</span>
            <select value={settings.presentationSeconds} onChange={(event) => update({ presentationSeconds: Number(event.target.value) })}>
              {presentationOptions.map((seconds) => (
                <option value={seconds} key={seconds}>
                  {seconds}秒
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLine}>
            <span>引き直し回数</span>
            <select value={settings.rerollsPerPlayer} onChange={(event) => update({ rerollsPerPlayer: Number(event.target.value) })}>
              <option value={0}>0回</option>
              <option value={1}>1回</option>
              <option value={2}>2回</option>
              <option value={3}>3回</option>
            </select>
          </label>
          <label className={styles.fieldLine}>
            <span>ジャンル</span>
            <select value={settings.genreMode} onChange={(event) => update({ genreMode: event.target.value as GenreMode })}>
              <option value="all">全部</option>
              <option value="se">ソフトウェア工学</option>
              <option value="security">セキュリティ</option>
              <option value="fashion">ファッション</option>
              <option value="general">汎用</option>
            </select>
          </label>
          <label className={styles.fieldLine}>
            <span>使用デッキ</span>
            <select value={settings.deckMode} onChange={(event) => update({ deckMode: event.target.value as DeckMode })}>
              <option value="serious">真面目寄せ</option>
              <option value="neta">ネタ寄せ</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className={styles.toggleLine}>
            <input
              type="checkbox"
              checked={settings.preparationEnabled}
              onChange={(event) => update({ preparationEnabled: event.target.checked })}
            />
            <span>準備時間あり</span>
          </label>
          <label className={styles.toggleLine}>
            <input type="checkbox" checked={settings.reducedMotion} onChange={(event) => update({ reducedMotion: event.target.checked })} />
            <span>演出オフ</span>
          </label>
        </section>

        <section className={styles.panel}>
          <h3>カード構成</h3>
          <p className={styles.settingHelp}>1〜5枚。1〜2枚は遊びやすく、4〜5枚は90秒以上の発表がおすすめです。</p>
          <div className={styles.compositionPresets}>
            {CARD_PRESETS.map((preset) => {
              const selected = sameKinds(settings.cardKinds, preset.kinds);
              return (
                <button
                  aria-pressed={selected}
                  className={`${styles.presetButton} ${selected ? styles.selectedPreset : ''}`}
                  type="button"
                  key={preset.label}
                  onClick={() => update({ cardKinds: [...preset.kinds] })}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.compositionList}>
            {settings.cardKinds.map((kind, index) => (
              <div className={styles.compositionRow} key={index}>
                <span>{index + 1}</span>
                <select
                  aria-label={`カード${index + 1}の種類`}
                  value={kind}
                  onChange={(event) => updateCardKind(index, event.target.value as CardKind)}
                >
                  <option value="field">分野</option>
                  <option value="method">手法</option>
                  <option value="constraint">制約</option>
                </select>
                <button
                  aria-label={`カード${index + 1}を削除`}
                  type="button"
                  disabled={settings.cardKinds.length <= MIN_CARD_COUNT}
                  onClick={() => removeCardSlot(index)}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={settings.cardKinds.length >= MAX_CARD_COUNT}
            onClick={() => update({ cardKinds: [...settings.cardKinds, 'field'] })}
          >
            カードを追加
          </button>
          {unavailableKind && (
            <p className={styles.compositionError} role="alert">
              現在のジャンル・デッキでは「{kindLabel(unavailableKind)}」の候補が足りません。枚数を減らすか、絞り込みを変更してください。
            </p>
          )}
        </section>
      </div>

      <section className={`${styles.panel} ${styles.rulesPanel}`}>
        <h3>遊び方</h3>
        <ol>
          <li>設定した構成でカードを引き、発表者が架空の研究を組み立てます。</li>
          <li>引いたカードをすべて使って、制限時間内に発表します。</li>
          <li>ほかの人は「筋が通っていたか」を端末を回して秘密投票します。</li>
          <li>過半数 Accept で発表者+2点、満場一致なら+3点。判定側と同じ票の査読者も+1点です。</li>
        </ol>
      </section>

      <div className={styles.actionBar}>
        <p aria-live="polite" role="status">
          {canStart
            ? `${validPlayers.length}人・カード${settings.cardKinds.length}枚で開始できます`
            : !cardKindsValid
              ? 'カード構成または絞り込みを調整してください'
              : hasDuplicateNames
              ? '同じ名前は使えません'
              : hasBlankNames
                ? '空欄のプレイヤー名を入力するか、その行を削除してください'
                : '空欄のないプレイヤー名を3〜8人分登録してください'}
        </p>
        <button className={styles.primaryButton} type="button" disabled={!canStart} onClick={() => dispatch({ type: 'startGame', settings })}>
          ゲーム開始
        </button>
      </div>
    </section>
  );
};
