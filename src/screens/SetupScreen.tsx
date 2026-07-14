import styles from '../App.module.css';
import type { ScreenProps } from './screenTypes';
import type { DeckMode, Settings } from '../game/types';

const presentationOptions = [30, 60, 90, 120];

export const SetupScreen = ({ state, dispatch }: ScreenProps) => {
  const settings = state.settings;
  const validPlayers = settings.playerNames.map((name) => name.trim()).filter(Boolean);
  const canStart = validPlayers.length >= 3 && validPlayers.length <= 8;

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
              <label className={styles.nameRow} key={`${index}-${name}`}>
                <span>{index + 1}</span>
                <input value={name} maxLength={12} onChange={(event) => updateName(index, event.target.value)} />
                <button type="button" disabled={settings.playerNames.length <= 3} onClick={() => removeName(index)}>
                  削除
                </button>
              </label>
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
      </div>

      <div className={styles.actionBar}>
        <p>{canStart ? `${validPlayers.length}人で開始できます` : '3〜8人を登録してください'}</p>
        <button className={styles.primaryButton} type="button" disabled={!canStart} onClick={() => dispatch({ type: 'startGame', settings })}>
          ゲーム開始
        </button>
      </div>
    </section>
  );
};
