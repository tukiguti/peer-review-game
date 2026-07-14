import { ScoreTable } from '../components/ScoreTable';
import styles from '../App.module.css';
import { sortedPlayers } from '../game/selectors';
import type { Player } from '../game/types';
import type { ScreenProps } from './screenTypes';

const names = (players: Player[]): string => players.map((player) => player.name).join('、');

export const FinalScreen = ({ state, dispatch }: ScreenProps) => {
  const ranking = sortedPlayers(state.players);
  const topScore = ranking[0]?.score ?? 0;
  const rejectMax = Math.max(...state.players.map((player) => player.rejectCount));
  const speechMax = Math.max(...state.players.map((player) => player.unanimousAcceptedCount));
  const bestPaper = ranking.filter((player) => player.score === topScore);
  const reviewerTwo = state.players.filter((player) => player.rejectCount === rejectMax);
  const speakers = state.players.filter((player) => player.unanimousAcceptedCount === speechMax && speechMax > 0);

  return (
    <section className={styles.screen}>
      <div className={styles.screenHeader}>
        <p className={styles.eyebrow}>final</p>
        <h2>最終ランキング</h2>
      </div>

      <div className={styles.finalGrid}>
        <section className={styles.panel}>
          <h3>順位</h3>
          <ScoreTable players={state.players} />
        </section>
        <section className={styles.panel}>
          <h3>称号</h3>
          <div className={styles.awardList}>
            <p>
              <strong>最優秀論文賞</strong>
              <span>{names(bestPaper)}</span>
            </p>
            <p>
              <strong>Reviewer #2 賞</strong>
              <span>{names(reviewerTwo)}</span>
            </p>
            <p>
              <strong>話術賞</strong>
              <span>{speakers.length > 0 ? names(speakers) : '該当者なし'}</span>
            </p>
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
