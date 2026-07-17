import { useCallback } from 'react';
import styles from '../App.module.css';
import { SimCountdown } from '../components/SimCountdown';
import { currentPresenter, currentVoter, voterIds } from '../game/selectors';
import type { ScreenProps } from './screenTypes';

// せーの同時公開: 全員が手で Accept(パー)/Reject(グー) を用意 → カウントダウン → 一斉公開 → 出た手を記録
const SimultaneousVote = ({ state, dispatch }: ScreenProps) => {
  const presenter = currentPresenter(state);
  const reviewers = state.players.filter((player) => player.id !== presenter.id);
  const allVoted = reviewers.every((player) => state.votes[player.id]);
  const onCountdownDone = useCallback(() => dispatch({ type: 'countdownDone' }), [dispatch]);

  return (
    <section className={`${styles.screen} ${styles.voteScreen}`}>
      <div className={styles.screenHeader}>
        <p className={styles.eyebrow}>peer review</p>
        <h2>{presenter.name}さんの査読（せーの同時公開）</h2>
      </div>

      {state.voteStep === 'ready' && (
        <div className={styles.passPanel}>
          <p className={styles.bigName}>全員で一斉ジャッジ</p>
          <p>
            発表者以外の{reviewers.length}人が、手で合図を用意します。
            <br />
            パー = Accept、グー = Reject。準備できたらスタート。
          </p>
          <button className={styles.primaryButton} type="button" onClick={() => dispatch({ type: 'beginCountdown' })}>
            せーの！を始める
          </button>
        </div>
      )}

      {state.voteStep === 'countdown' && <SimCountdown muted={state.muted} onDone={onCountdownDone} />}

      {state.voteStep === 'tally' && (
        <div className={styles.tallyPanel}>
          <p className={styles.bigName}>出た手を記録</p>
          <p>各自が出した手を、そのままタップして入力してください（公開済みなので伏せる必要はありません）。</p>
          <div className={styles.tallyList}>
            {reviewers.map((player) => {
              const vote = state.votes[player.id]?.vote;
              return (
                <div className={styles.tallyRow} key={player.id}>
                  <span className={styles.tallyName}>{player.name}</span>
                  <div className={styles.tallyVoteButtons}>
                    <button
                      aria-pressed={vote === 'accept'}
                      className={`${styles.acceptButton} ${vote === 'accept' ? styles.selectedVote : ''}`}
                      type="button"
                      onClick={() => dispatch({ type: 'setTallyVote', playerId: player.id, vote: 'accept' })}
                    >
                      Accept
                    </button>
                    <button
                      aria-pressed={vote === 'reject'}
                      className={`${styles.rejectButton} ${vote === 'reject' ? styles.selectedVote : ''}`}
                      type="button"
                      onClick={() => dispatch({ type: 'setTallyVote', playerId: player.id, vote: 'reject' })}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className={styles.primaryButton} type="button" disabled={!allVoted} onClick={() => dispatch({ type: 'revealResult' })}>
            結果を見る
          </button>
        </div>
      )}
    </section>
  );
};

export const VoteScreen = ({ state, dispatch }: ScreenProps) => {
  if (state.settings.voteMode === 'simultaneous') {
    return <SimultaneousVote state={state} dispatch={dispatch} />;
  }

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
          <div className={styles.reviewCriteria}>
            <strong>Accept の目安</strong>
            <span>全{state.settings.cardSlots.length}枚を使った</span>
            <span>カード同士のつなぎ方に筋が通った</span>
            <span>制約への言い訳・工夫に納得できた</span>
          </div>
          <div className={styles.voteButtons}>
            <button
              aria-pressed={state.voteDraft === 'accept'}
              className={`${styles.acceptButton} ${state.voteDraft === 'accept' ? styles.selectedVote : ''}`}
              type="button"
              onClick={() => dispatch({ type: 'setVoteDraft', vote: 'accept' })}
            >
              Accept
            </button>
            <button
              aria-pressed={state.voteDraft === 'reject'}
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
