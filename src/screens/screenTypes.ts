import type { Dispatch } from 'react';
import type { GameAction } from '../game/reducer';
import type { CardsByKind, GameState } from '../game/types';

export type ScreenProps = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
};

export type DrawScreenProps = ScreenProps & {
  cards: CardsByKind;
};
