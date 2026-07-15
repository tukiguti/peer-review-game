import { useCallback } from 'react';
import { CardView } from '../components/CardView';
import { TimerPanel } from '../components/TimerPanel';
import styles from '../App.module.css';
import { currentPresenter } from '../game/selectors';
import type { ScreenProps } from './screenTypes';

export const PresentScreen = ({ state, dispatch }: ScreenProps) => {
  const presenter = currentPresenter(state);
  const startVote = useCallback(() => dispatch({ type: 'startVote' }), [dispatch]);
  const tick = useCallback(() => dispatch({ type: 'tickTimer' }), [dispatch]);

  if (!state.hand) {
    return null;
  }

  return (
    <section className={styles.screen}>
      <div className={styles.turnHeader}>
        <div>
          <p className={styles.eyebrow}>present</p>
          <h2>{presenter.name}さんの発表</h2>
        </div>
        <TimerPanel
          seconds={state.timerRemaining}
          totalSeconds={state.settings.presentationSeconds}
          muted={state.muted}
          onTick={tick}
          onDone={startVote}
        />
      </div>

      <div className={styles.cardGrid}>
        {state.hand.map((card, index) => (
          <CardView card={card} kind={state.settings.cardKinds[index]} slotNumber={index + 1} key={`${index}-${card.id}`} compact />
        ))}
      </div>

      <div className={styles.presentationStage}>
        <p>この{state.hand.length}枚に沿った研究をそれらしく語ってください。</p>
      </div>

      <div className={styles.actionBar}>
        <button className={styles.primaryButton} type="button" onClick={startVote}>
          発表終了
        </button>
      </div>
    </section>
  );
};
