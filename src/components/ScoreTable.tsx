import styles from '../App.module.css';
import { sortedPlayers } from '../game/selectors';
import type { Player } from '../game/types';

type Props = {
  players: Player[];
};

export const ScoreTable = ({ players }: Props) => (
  <div className={styles.scoreTable} aria-label="得点表">
    {sortedPlayers(players).map((player, index) => (
      <div className={styles.scoreRow} key={player.id}>
        <span className={styles.rank}>{index + 1}</span>
        <span>{player.name}</span>
        <strong>{player.score}点</strong>
      </div>
    ))}
  </div>
);
