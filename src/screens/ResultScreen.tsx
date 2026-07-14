import { useEffect } from 'react';
import { playSound } from '../audio/sound';
import { ScoreTable } from '../components/ScoreTable';
import styles from '../App.module.css';
import { currentPresenter, currentScoringResult } from '../game/selectors';
import type { ScreenProps } from './screenTypes';

export const ResultScreen = ({ state, dispatch }: ScreenProps) => {
  const presenter = currentPresenter(state);
  const result = currentScoringResult(state);
  const nextIsFinal = state.round === state.settings.rounds && state.presenterIndex === state.players.length - 1;

  useEffect(() => {
    playSound(result.summary.accepted ? 'resultAccept' : 'resultReject', state.muted);
  }, [result.summary.accepted, state.muted]);

  return (
    <section className={styles.screen}>
      <div className={styles.resultStampWrap}>
        <div className={`${styles.resultStamp} ${result.summary.accepted ? styles.acceptedStamp : styles.rejectedStamp}`}>
          {result.summary.accepted ? 'ACCEPTED' : 'REJECTED'}
        </div>
        <p>
          Accept {result.summary.acceptCount} / Reject {result.summary.rejectCount}
          {result.summary.unanimous ? ' 満場一致採択' : ''}
        </p>
      </div>

      <div className={styles.resultGrid}>
        <section className={styles.panel}>
          <h3>投票内訳</h3>
          <div className={styles.voteRevealList}>
            {state.players
              .filter((player) => player.id !== presenter.id)
              .map((player) => (
                <div className={styles.voteReveal} key={player.id}>
                  <span>{player.name}</span>
                  <strong>{state.votes[player.id]?.vote === 'accept' ? 'Accept' : 'Reject'}</strong>
                </div>
              ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h3>査読コメント</h3>
          <div className={styles.comments}>
            {Object.entries(state.votes)
              .filter(([, vote]) => vote.comment)
              .map(([playerId, vote]) => (
                <blockquote key={playerId}>
                  <p>{vote.comment}</p>
                  <footer>— {state.players.find((player) => player.id === playerId)?.name ?? '匿名査読者'}</footer>
                </blockquote>
              ))}
            {Object.values(state.votes).every((vote) => !vote.comment) && <p>コメントなし</p>}
          </div>
        </section>

        <section className={styles.panel}>
          <h3>現在の得点表</h3>
          <ScoreTable players={state.players} />
        </section>
      </div>

      <div className={styles.actionBar}>
        <button className={styles.primaryButton} type="button" onClick={() => dispatch({ type: 'nextTurn' })}>
          {nextIsFinal ? '最終結果へ' : '次の発表者へ'}
        </button>
      </div>
    </section>
  );
};
