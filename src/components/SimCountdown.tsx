import { useEffect, useState } from 'react';
import { playSound } from '../audio/sound';
import styles from '../App.module.css';

const STEPS = ['3', '2', '1', 'せーの！'];

type Props = {
  muted: boolean;
  onDone: () => void;
};

// 3・2・1・せーの! を1秒刻みで表示し、最後に全員が同時に手を出す合図を出す。
// setTimeout 駆動なので、requestAnimationFrame と違い非表示タブでも確実に進む。
export const SimCountdown = ({ muted, onDone }: Props) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const isLast = step >= STEPS.length - 1;
    playSound(isLast ? 'finalStop' : 'countdown', muted);

    const timer = window.setTimeout(() => {
      if (isLast) {
        onDone();
      } else {
        setStep((current) => current + 1);
      }
    }, isLast ? 800 : 850);

    return () => window.clearTimeout(timer);
  }, [muted, onDone, step]);

  return (
    <div className={styles.countdown} role="status" aria-live="assertive">
      <span className={`${styles.countdownBig} ${step >= STEPS.length - 1 ? styles.countdownGo : ''}`}>{STEPS[step]}</span>
      <p>全員、手で Accept(パー) / Reject(グー) を用意</p>
    </div>
  );
};
