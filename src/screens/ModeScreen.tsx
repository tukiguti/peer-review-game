import styles from '../App.module.css';

type Props = {
  onOffline: () => void;
  onOnline: () => void;
};

export const ModeScreen = ({ onOffline, onOnline }: Props) => (
  <section className={styles.screen}>
    <div className={styles.screenHeader}>
      <p className={styles.eyebrow}>start</p>
      <h2>遊び方を選ぶ</h2>
    </div>

    <div className={styles.modeGrid}>
      <button type="button" className={styles.modeCard} onClick={onOffline}>
        <span className={styles.modeIcon} aria-hidden="true">🎴</span>
        <strong>オフラインプレイ</strong>
        <span className={styles.modeDesc}>この1台をみんなで囲んで対面で。「せーの（全員同時公開）」か「パスプレイ（1人ずつ）」を選べます。</span>
        <span className={styles.modeReady}>今すぐ遊べる</span>
      </button>

      <button type="button" className={styles.modeCard} onClick={onOnline}>
        <span className={styles.modeIcon} aria-hidden="true">📱</span>
        <strong>オンラインプレイ</strong>
        <span className={styles.modeDesc}>各自のスマホから部屋に参加して、同時に秘密投票。離れた相手とも遊べます。</span>
        <span className={styles.modeBadge}>準備中</span>
      </button>
    </div>
  </section>
);
