import { useMemo } from 'react';
import { playSound } from '../audio/sound';
import { CardView } from '../components/CardView';
import { SlotMachine } from '../components/SlotMachine';
import styles from '../App.module.css';
import { drawHand, filterCardsByMode, rerollCard } from '../game/draw';
import { currentPresenter } from '../game/selectors';
import type { CardKind, CardsByKind } from '../game/types';
import type { DrawScreenProps } from './screenTypes';

const KINDS: CardKind[] = ['field', 'method', 'constraint'];

export const DrawScreen = ({ state, dispatch, cards }: DrawScreenProps) => {
  const presenter = currentPresenter(state);
  const canReroll = Boolean(state.hand && !state.drawAnimating && presenter.rerollsLeft > 0);
  // 毎レンダーで新しい配列を渡すとリールが再シャッフルされ、停止位置と表示がずれる
  const reelCards: CardsByKind = useMemo(
    () => ({
      field: filterCardsByMode(cards.field, state.settings.deckMode),
      method: filterCardsByMode(cards.method, state.settings.deckMode),
      constraint: filterCardsByMode(cards.constraint, state.settings.deckMode),
    }),
    [cards, state.settings.deckMode],
  );

  const pullLever = () => {
    const hand = drawHand(cards, state.settings.deckMode, state.recentHands);
    playSound('lever', state.muted);
    navigator.vibrate?.(30);
    dispatch({ type: 'drawHand', hand, animate: !state.settings.reducedMotion });
  };

  const reroll = (kind: CardKind) => {
    if (!state.hand || presenter.rerollsLeft <= 0) {
      return;
    }

    const card = rerollCard(cards, state.settings.deckMode, state.recentHands, kind, state.hand);
    playSound('lever', state.muted);
    navigator.vibrate?.(30);
    dispatch({ type: 'rerollCard', kind, card, animate: !state.settings.reducedMotion });
  };

  return (
    <section className={styles.screen}>
      <div className={styles.turnHeader}>
        <div>
          <p className={styles.eyebrow}>
            round {state.round} / {state.settings.rounds}
          </p>
          <h2>{presenter.name}さんのテーマ抽選</h2>
        </div>
        <strong>引き直し: 残り{presenter.rerollsLeft}</strong>
      </div>

      <SlotMachine
        cards={reelCards}
        hand={state.hand}
        spinKey={state.drawSpinKey}
        spinKind={state.drawSpinKind}
        spinning={state.drawAnimating}
        muted={state.muted}
        onFinished={() => dispatch({ type: 'drawAnimationDone' })}
      />

      <div className={styles.actionBar}>
        <button className={styles.leverButton} type="button" disabled={state.drawAnimating} onClick={pullLever}>
          LEVER
        </button>
        <button className={styles.primaryButton} type="button" disabled={!state.hand || state.drawAnimating} onClick={() => dispatch({ type: 'startPrepare' })}>
          テーマ確定
        </button>
      </div>

      {state.hand && !state.drawAnimating && (
        <div className={`${styles.cardGrid} ${styles.confirmedCards}`}>
          {state.hand.map((card, index) => {
            const kind = KINDS[index];
            return (
              <div className={styles.cardWithAction} key={kind}>
                <CardView card={card} kind={kind} />
                {canReroll && (
                  <button className={styles.secondaryButton} type="button" onClick={() => reroll(kind)}>
                    🔄 引き直し
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
