import { useEffect, useRef } from 'react';
import { playSound } from '../audio/sound';
import styles from '../App.module.css';

type Props = {
  seconds: number;
  totalSeconds: number;
  muted: boolean;
  onTick: () => void;
  onDone: () => void;
};

export const TimerPanel = ({ seconds, totalSeconds, muted, onTick, onDone }: Props) => {
  const lastBeepSecond = useRef<number | null>(null);
  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, seconds / totalSeconds)) : 0;

  useEffect(() => {
    if (seconds <= 0) {
      onDone();
      return undefined;
    }

    if (seconds <= 10 && lastBeepSecond.current !== seconds) {
      lastBeepSecond.current = seconds;
      playSound('countdown', muted);
    }

    const timer = window.setTimeout(onTick, 1000);
    return () => window.clearTimeout(timer);
  }, [muted, onDone, onTick, seconds]);

  return (
    <div className={`${styles.timerPanel} ${seconds <= 10 ? styles.timerWarning : ''}`}>
      <div className={styles.timerDial} style={{ background: `conic-gradient(#d9480f ${progress * 360}deg, #e8edf5 0deg)` }}>
        <span>{seconds}</span>
      </div>
      <p>残り秒数</p>
    </div>
  );
};
