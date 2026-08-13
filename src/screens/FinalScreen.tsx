import { ScoreTable } from '../components/ScoreTable';
import styles from '../App.module.css';
import { computeAwards } from '../game/selectors';
import type { ScreenProps } from './screenTypes';

export const FinalScreen = ({ state, dispatch }: ScreenProps) => {
  // 称号の基準はオンラインと共通（game/selectors）。
  const awards = computeAwards(state.players);

  return (
    <section className={styles.screen}>
      {/* 閉会の書面に見立てる。称号はここで読み上げる想定 */}
      <div className={styles.notice}>
        <div className={styles.noticeHead}>
          <span>閉会</span>
          <span>全 {state.settings.rounds} 周 終了</span>
        </div>
        <h2 className={styles.noticeTitle}>最終結果</h2>
        <p className={styles.noticeBody}>本会における全ての発表と査読が終了しました。各賞を以下のとおり発表します。</p>
      </div>

      <div className={styles.finalGrid}>
        <section className={styles.panel}>
          <h3>順位</h3>
          <ScoreTable players={state.players} />
        </section>
        <section className={styles.panel}>
          <h3>称号</h3>
          <div className={styles.awardList}>
            {awards.map((award) => (
              <p key={award.title}>
                <strong>{award.title}</strong>
                <span>{award.winners.length > 0 ? award.winners.join('、') : '該当者なし'}</span>
              </p>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.actionBar}>
        <button className={styles.primaryButton} type="button" onClick={() => dispatch({ type: 'resetToSetup' })}>
          設定へ戻る
        </button>
      </div>
    </section>
  );
};
