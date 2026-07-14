import { useEffect, useMemo, useRef } from 'react';
import { playSound } from '../audio/sound';
import styles from '../App.module.css';
import { kindLabel, kindToIndex } from '../game/reducer';
import type { Card, CardKind, CardsByKind, Hand } from '../game/types';

const KINDS: CardKind[] = ['field', 'method', 'constraint'];
const SLOT_ROWS = 7;
const CARD_HEIGHT = 58;

type Props = {
  cards: CardsByKind;
  hand: Hand | null;
  spinKey: number;
  spinKind: CardKind | 'all';
  spinning: boolean;
  muted: boolean;
  onFinished: () => void;
};

type ReelRefs = {
  track: HTMLDivElement | null;
  shell: HTMLDivElement | null;
};

const easeOutCubic = (value: number): number => 1 - Math.pow(1 - value, 3);
const easeOutBack = (value: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
};

const shuffle = (items: Card[]): Card[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export const SlotMachine = ({ cards, hand, spinKey, spinKind, spinning, muted, onFinished }: Props) => {
  const reelRefs = useRef<ReelRefs[]>(KINDS.map(() => ({ track: null, shell: null })));
  const reelLoops = useMemo(() => KINDS.map((kind) => shuffle(cards[kind])), [cards]);

  // 演出オフ時と停止直後も、中央の当選ラインを確定カードと一致させる。
  useEffect(() => {
    if (!hand || spinning) {
      return;
    }

    KINDS.forEach((_, index) => {
      const refs = reelRefs.current[index];
      const loop = reelLoops[index];
      const winnerIndex = Math.max(0, loop.findIndex((card) => card.id === hand[index].id));
      const itemNodes = Array.from(refs.track?.children ?? []) as HTMLDivElement[];

      itemNodes.forEach((node, row) => {
        node.textContent = loop[(winnerIndex + row - 3 + loop.length * 20) % loop.length].text;
      });
      if (refs.track) {
        refs.track.style.transform = `translateY(${-CARD_HEIGHT * 2}px)`;
      }
      refs.shell?.classList.remove(styles.reelSpinning);
      refs.shell?.classList.add(styles.reelStopped);
    });
  }, [hand, reelLoops, spinning]);

  useEffect(() => {
    if (!hand || !spinning) {
      return undefined;
    }

    let finishedCount = 0;
    let cancelled = false;
    const frameIds: number[] = [];
    const targetIndexes = spinKind === 'all' ? [0, 1, 2] : [kindToIndex(spinKind)];

    const finishOne = (index: number) => {
      const refs = reelRefs.current[index];
      refs.shell?.classList.add(styles.reelStopped);
      playSound(index === 2 ? 'finalStop' : 'stop', muted);
      finishedCount += 1;
      if (finishedCount === targetIndexes.length) {
        window.setTimeout(onFinished, 140);
      }
    };

    for (const index of targetIndexes) {
      const refs = reelRefs.current[index];
      const track = refs.track;
      const shell = refs.shell;
      const loop = reelLoops[index];
      const winner = hand[index];
      const winnerIndex = Math.max(0, loop.findIndex((card) => card.id === winner.id));
      const stopDelay = spinKind === 'all' ? 900 + index * 400 : 1050;
      const start = performance.now();
      const slowdown = index === 2 || spinKind === 'constraint' ? 560 : 420;
      const startOffset = Math.floor(Math.random() * loop.length) * CARD_HEIGHT;
      const targetOffset = (loop.length * 8 + winnerIndex) * CARD_HEIGHT;

      shell?.classList.remove(styles.reelStopped);
      shell?.classList.add(styles.reelSpinning);

      const paint = (offset: number) => {
        if (!track) {
          return;
        }
        const itemNodes = Array.from(track.children) as HTMLDivElement[];
        const centerIndex = Math.floor(offset / CARD_HEIGHT);
        const y = -(offset % CARD_HEIGHT);
        // 窓は3行分。row 3 が窓の中央(=当選ライン)に来るよう2行分せり上げる
        track.style.transform = `translateY(${y - CARD_HEIGHT * 2}px)`;

        itemNodes.forEach((node, row) => {
          const card = loop[(centerIndex + row - 3 + loop.length * 20) % loop.length];
          node.textContent = card.text;
        });
      };

      const animate = (now: number) => {
        if (cancelled) {
          return;
        }

        const elapsed = now - start;
        const speedOffset = startOffset + elapsed * 1.16;

        if (elapsed < stopDelay) {
          paint(speedOffset);
          frameIds.push(requestAnimationFrame(animate));
          return;
        }

        const slowProgress = Math.min(1, (elapsed - stopDelay) / slowdown);
        const eased = easeOutCubic(slowProgress);
        const settled = speedOffset + (targetOffset - speedOffset) * eased;
        const overshoot = slowProgress > 0.82 ? Math.sin((slowProgress - 0.82) / 0.18 * Math.PI) * CARD_HEIGHT * 0.38 : 0;
        paint(settled + overshoot);

        if (slowProgress < 1) {
          frameIds.push(requestAnimationFrame(animate));
          return;
        }

        const bounceStart = performance.now();
        const bounce = (bounceNow: number) => {
          const progress = Math.min(1, (bounceNow - bounceStart) / 120);
          const overshot = Math.sin(easeOutBack(progress) * Math.PI) * CARD_HEIGHT * 0.22;
          paint(targetOffset + overshot);

          if (progress < 1) {
            frameIds.push(requestAnimationFrame(bounce));
            return;
          }

          paint(targetOffset);
          shell?.classList.remove(styles.reelSpinning);
          finishOne(index);
        };

        frameIds.push(requestAnimationFrame(bounce));
      };

      frameIds.push(requestAnimationFrame(animate));
    }

    return () => {
      cancelled = true;
      frameIds.forEach((id) => cancelAnimationFrame(id));
    };
  }, [hand, muted, onFinished, reelLoops, spinKey, spinKind, spinning]);

  return (
    <div className={styles.slotMachine}>
      {KINDS.map((kind, reelIndex) => {
        const loop = reelLoops[reelIndex];
        return (
          <section className={styles.reelColumn} key={kind}>
            <h3>{kindLabel(kind)}</h3>
            <div
              className={styles.reelWindow}
              ref={(node) => {
                reelRefs.current[reelIndex].shell = node;
              }}
            >
              <div
                className={styles.reelTrack}
                style={{ transform: `translateY(${-CARD_HEIGHT * 2}px)` }}
                ref={(node) => {
                  reelRefs.current[reelIndex].track = node;
                }}
              >
                {Array.from({ length: SLOT_ROWS }, (_, row) => (
                  <div className={styles.reelItem} key={row}>
                    {loop[row % loop.length]?.text ?? '抽選待ち'}
                  </div>
                ))}
              </div>
            </div>
            <span className={styles.reelStatus}>{spinning && (spinKind === 'all' || spinKind === kind) ? '回転中' : hand ? '止まった' : '待機'}</span>
          </section>
        );
      })}
    </div>
  );
};
