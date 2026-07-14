import styles from '../App.module.css';
import { currentPresenter, currentVoter, voterIds } from '../game/selectors';
import type { ScreenProps } from './screenTypes';

export const VoteScreen = ({ state, dispatch }: ScreenProps) => {
  const presenter = currentPresenter(state);
  const voter = currentVoter(state);
  const totalVoters = voterIds(state).length;
  const votedCount = Object.keys(state.votes).length;

  if (!voter) {
    return null;
  }

  return (
    <section className={`${styles.screen} ${styles.voteScreen}`}>
      <div className={styles.screenHeader}>
        <p className={styles.eyebrow}>peer review</p>
        <h2>{presenter.name}さんの査読</h2>
      </div>

      {state.voteStep === 'handoff' && (
        <div className={styles.passPanel}>
          <p className={styles.bigName}>{voter.name}さんの番です</p>
          <p>
            端末を{voter.name}さんへ渡してください。投票済み {votedCount} / {totalVoters}
          </p>
          <button className={styles.primaryButton} type="button" onClick={() => dispatch({ type: 'openBallot' })}>
            準備OK
          </button>
        </div>
      )}

      {state.voteStep === 'ballot' && (
        <div className={styles.ballotPanel}>
          <p className={styles.bigName}>{voter.name}さんの判定</p>
          <div className={styles.voteButtons}>
            <button
              className={`${styles.acceptButton} ${state.voteDraft === 'accept' ? styles.selectedVote : ''}`}
              type="button"
              onClick={() => dispatch({ type: 'setVoteDraft', vote: 'accept' })}
            >
              Accept
            </button>
            <button
              className={`${styles.rejectButton} ${state.voteDraft === 'reject' ? styles.selectedVote : ''}`}
              type="button"
              onClick={() => dispatch({ type: 'setVoteDraft', vote: 'reject' })}
            >
              Reject
            </button>
          </div>
          <label className={styles.commentBox}>
            <span>Reviewer #2 の一言</span>
            <textarea
              value={state.commentDraft}
              rows={3}
              maxLength={80}
              onChange={(event) => dispatch({ type: 'setCommentDraft', comment: event.target.value })}
            />
          </label>
          <button className={styles.primaryButton} type="button" disabled={!state.voteDraft} onClick={() => dispatch({ type: 'submitVote' })}>
            投票する
          </button>
        </div>
      )}

      {state.voteStep === 'submitted' && (
        <div className={styles.passPanel}>
          <p className={styles.bigName}>投票を受け付けました</p>
          <p>選択内容は画面に残していません。次の人へ端末を渡してください。</p>
          <button className={styles.primaryButton} type="button" onClick={() => dispatch({ type: 'continueVoting' })}>
            次の人へ
          </button>
        </div>
      )}
    </section>
  );
};
