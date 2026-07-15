import { useMemo } from 'react';
import { playSound } from '../audio/sound';
import { CardView } from '../components/CardView';
import { SlotMachine } from '../components/SlotMachine';
import styles from '../App.module.css';
import { drawHand, filterCards, hasRerollCandidate, rerollCard } from '../game/draw';
import { currentPresenter } from '../game/selectors';
import type { CardsScreenProps } from './screenTypes';

export const DrawScreen = ({ state, dispatch, cards }: CardsScreenProps) => {
  const presenter = currentPresenter(state);
  const canReroll = Boolean(state.hand && !state.drawAnimating && presenter.rerollsLeft > 0);
  const { cardSlots, genreMode } = state.settings;
  // 毎レンダーで新しい配列を渡すとリールが再シャッフルされ、停止位置と表示がずれる
  const reelCards = useMemo(
    () => cardSlots.map((slot) => filterCards(cards[slot.kind], slot.tone, genreMode)),
    [cardSlots, cards, genreMode],
  );

  const pullLever = () => {
    if (state.hand || state.drawAnimating) {
      return;
    }

    const hand = drawHand(cards, genreMode, state.recentHands, cardSlots);
    playSound('lever', state.muted);
    navigator.vibrate?.(30);
    dispatch({ type: 'drawHand', hand, animate: !state.settings.reducedMotion });
  };

  const reroll = (index: number) => {
    if (!state.hand || presenter.rerollsLeft <= 0) {
      return;
    }

    const slot = cardSlots[index];
    const card = rerollCard(cards, genreMode, state.recentHands, slot, state.hand);
    playSound('lever', state.muted);
    navigator.vibrate?.(30);
    dispatch({ type: 'rerollCard', index, card, animate: !state.settings.reducedMotion });
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
        reelCards={reelCards}
        cardSlots={cardSlots}
        hand={state.hand}
        spinKey={state.drawSpinKey}
        spinIndex={state.drawSpinIndex}
        spinning={state.drawAnimating}
        muted={state.muted}
        onFinished={() => dispatch({ type: 'drawAnimationDone' })}
      />

      <div className={styles.actionBar}>
        <button className={styles.leverButton} type="button" disabled={state.drawAnimating || Boolean(state.hand)} onClick={pullLever}>
          {state.hand ? '抽選済み' : `LEVER — ${cardSlots.length}枚抽選`}
        </button>
        <button className={styles.primaryButton} type="button" disabled={!state.hand || state.drawAnimating} onClick={() => dispatch({ type: 'startPrepare' })}>
          テーマ確定
        </button>
      </div>

      {state.hand && !state.drawAnimating && (
        <div className={`${styles.cardGrid} ${styles.confirmedCards}`}>
          {state.hand.map((card, index) => {
            const slot = cardSlots[index];
            const canRerollThisCard = canReroll && hasRerollCandidate(cards, genreMode, slot, state.hand!);
            return (
              <div className={styles.cardWithAction} key={`${index}-${slot.kind}-${slot.tone}`}>
                <CardView card={card} kind={slot.kind} slotNumber={index + 1} />
                {canRerollThisCard && (
                  <button className={styles.secondaryButton} type="button" onClick={() => reroll(index)}>
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
