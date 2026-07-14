import styles from '../App.module.css';
import { sortedPlayers } from '../game/selectors';
import type { Player } from '../game/types';

type Props = {
  players: Player[];
};

export const ScoreTable = ({ players }: Props) => {
  const ranking = sortedPlayers(players);

  return (
    <div className={styles.scoreTable} aria-label="得点表">
      {ranking.map((player, index) => {
        const rank = index > 0 && ranking[index - 1].score === player.score
          ? ranking.findIndex((candidate) => candidate.score === player.score) + 1
          : index + 1;

        return (
          <div className={styles.scoreRow} key={player.id}>
            <span className={styles.rank}>{rank}</span>
            <span>{player.name}</span>
            <strong>{player.score}点</strong>
          </div>
        );
      })}
    </div>
  );
};
