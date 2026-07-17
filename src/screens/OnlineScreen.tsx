import styles from '../App.module.css';

type Props = {
  onBack: () => void;
};

// C（各自スマホ・リアルタイム秘密投票）の入口。実装は次フェーズ（Cloudflare/PartyKit）。
export const OnlineScreen = ({ onBack }: Props) => (
  <section className={styles.screen}>
    <div className={styles.screenHeader}>
      <p className={styles.eyebrow}>online</p>
      <h2>オンラインプレイ</h2>
    </div>

    <div className={styles.passPanel}>
      <span className={styles.modeIcon} aria-hidden="true">📱</span>
      <p className={styles.bigName}>準備中</p>
      <p>
        各自のスマホから部屋コード / QR で参加し、発表のあと全員が同時に秘密投票 → 一斉公開する方式です。
        <br />
        リアルタイム基盤（Cloudflare / PartyKit）で近日追加します。
      </p>
      <button className={styles.secondaryButton} type="button" onClick={onBack}>
        ← 遊び方の選択へ戻る
      </button>
    </div>
  </section>
);
