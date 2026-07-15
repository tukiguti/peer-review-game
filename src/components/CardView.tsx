import styles from '../App.module.css';
import { kindLabel } from '../game/reducer';
import type { Card, CardKind } from '../game/types';

type Props = {
  card: Card;
  kind: CardKind;
  slotNumber?: number;
  compact?: boolean;
};

export const CardView = ({ card, kind, slotNumber, compact = false }: Props) => (
  <article className={`${styles.card} ${compact ? styles.compactCard : ''}`}>
    <span className={styles.cardKind}>{slotNumber ? `${slotNumber}. ` : ''}{kindLabel(kind)}</span>
    <strong>{card.text}</strong>
    <span className={styles.cardTone}>{card.tone === 'serious' ? '真面目寄せ' : 'ネタ寄せ'}</span>
  </article>
);
