import { useEffect, useReducer } from 'react';
import cardsData from './data/cards.json';
import { gameReducer, createInitialState } from './game/reducer';
import { loadSettings, saveSettings } from './game/settings';
import type { CardsByKind } from './game/types';
import styles from './App.module.css';
import { SetupScreen } from './screens/SetupScreen';
import { DrawScreen } from './screens/DrawScreen';
import { PrepareScreen } from './screens/PrepareScreen';
import { PresentScreen } from './screens/PresentScreen';
import { VoteScreen } from './screens/VoteScreen';
import { ResultScreen } from './screens/ResultScreen';
import { FinalScreen } from './screens/FinalScreen';

const cards = cardsData as CardsByKind;

export const App = () => {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState(loadSettings()));

  useEffect(() => {
    saveSettings(state.settings);
  }, [state.settings]);

  return (
    <div className={styles.appShell}>
      <header className={styles.topBar}>
        <div>
          <p className={styles.eyebrow}>1画面パスプレイ</p>
          <h1>査読ゲーム</h1>
        </div>
        <button
          aria-label={state.muted ? '効果音をオンにする' : '効果音をミュートする'}
          aria-pressed={state.muted}
          className={styles.muteButton}
          type="button"
          onClick={() => dispatch({ type: 'setMuted', muted: !state.muted })}
        >
          {state.muted ? 'ミュート中' : '音あり'}
        </button>
      </header>

      <main className={styles.main}>
        {state.phase === 'setup' && <SetupScreen state={state} dispatch={dispatch} cards={cards} />}
        {state.phase === 'draw' && <DrawScreen state={state} dispatch={dispatch} cards={cards} />}
        {state.phase === 'prepare' && <PrepareScreen state={state} dispatch={dispatch} />}
        {state.phase === 'present' && <PresentScreen state={state} dispatch={dispatch} />}
        {state.phase === 'vote' && <VoteScreen state={state} dispatch={dispatch} />}
        {state.phase === 'result' && <ResultScreen state={state} dispatch={dispatch} />}
        {state.phase === 'final' && <FinalScreen state={state} dispatch={dispatch} />}
      </main>
    </div>
  );
};
