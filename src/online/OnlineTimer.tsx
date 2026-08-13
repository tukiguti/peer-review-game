import { useEffect, useRef, useState } from 'react';
import styles from './online.module.css';

type Props = {
  /** 発表の締切（サーバ時刻のepoch ms） */
  endsAt: number;
  /** スナップショットを作った時点のサーバ時刻。端末の時計ズレの補正に使う */
  serverNow: number;
  /** 0秒に到達したとき一度だけ呼ぶ。司会だけが渡す想定 */
  onExpire?: () => void;
};

// 全員が同じ締切（サーバ時刻）を見るタイマー。
// 端末の時計がずれていても、受信時に測ったオフセットで補正するので表示が揃う。
export const OnlineTimer = ({ endsAt, serverNow, onExpire }: Props) => {
  const offsetRef = useRef(0);
  const firedRef = useRef(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - serverNow) / 1000)));

  useEffect(() => {
    offsetRef.current = serverNow - Date.now();
  }, [serverNow]);

  useEffect(() => {
    firedRef.current = false;
  }, [endsAt]);

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, Math.ceil((endsAt - (Date.now() + offsetRef.current)) / 1000));
      setRemaining(left);
      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };
    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [endsAt, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const warning = remaining <= 10;

  return (
    <p className={`${styles.timer} ${warning ? styles.timerWarning : ''}`} role="timer" aria-live="off">
      残り {minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}秒`}
    </p>
  );
};
