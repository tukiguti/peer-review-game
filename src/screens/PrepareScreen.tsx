import { useCallback } from 'react';
import { CardView } from '../components/CardView';
import { TimerPanel } from '../components/TimerPanel';
import styles from '../App.module.css';
import { currentPresenter } from '../game/selectors';
import type { ScreenProps } from './screenTypes';

const HINTS = ['タイトル', '新規性（なぜ今までなかったのか）', '手法（どう検証するか）', '想定結果', '限界'];

export const PrepareScreen = ({ state, dispatch }: ScreenProps) => {
  const presenter = currentPresenter(state);
  const startPresent = useCallback(() => dispatch({ type: 'startPresent' }), [dispatch]);
  const tick = useCallback(() => dispatch({ type: 'tickTimer' }), [dispatch]);

  if (!state.hand) {
    return null;
  }

  return (
    <section className={styles.screen}>
      <div className={styles.turnHeader}>
        <div>
          <p className={styles.eyebrow}>prepare</p>
          <h2>{presenter.name}さんの準備時間</h2>
        </div>
        <TimerPanel seconds={state.timerRemaining} totalSeconds={30} muted={state.muted} onTick={tick} onDone={startPresent} />
      </div>

      <div className={styles.cardGrid}>
        {state.hand.map((card, index) => (
          <CardView card={card} kind={state.settings.cardSlots[index].kind} slotNumber={index + 1} key={`${index}-${card.id}`} />
        ))}
      </div>

      <section className={styles.panel}>
        <h3>語るべき観点</h3>
        <div className={styles.hintGrid}>
          {HINTS.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>
      </section>

      <div className={styles.actionBar}>
        <button className={styles.primaryButton} type="button" onClick={startPresent}>
          準備完了
        </button>
      </div>
    </section>
  );
};
