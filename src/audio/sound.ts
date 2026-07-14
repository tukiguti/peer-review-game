export type SoundName = 'lever' | 'stop' | 'finalStop' | 'countdown' | 'resultAccept' | 'resultReject';

let audioContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  audioContext ??= new AudioContextClass();
  return audioContext;
};

const tone = (context: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType, gainValue: number) => {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
};

export const playSound = (name: SoundName, muted: boolean): void => {
  if (muted) {
    return;
  }

  const context = getContext();
  if (!context) {
    return;
  }

  void context.resume();
  const now = context.currentTime;

  if (name === 'lever') {
    tone(context, 120, now, 0.06, 'sawtooth', 0.08);
    tone(context, 240, now + 0.045, 0.08, 'square', 0.06);
    return;
  }

  if (name === 'stop') {
    tone(context, 440, now, 0.045, 'square', 0.06);
    tone(context, 180, now + 0.035, 0.08, 'triangle', 0.08);
    return;
  }

  if (name === 'finalStop') {
    tone(context, 330, now, 0.05, 'square', 0.07);
    tone(context, 520, now + 0.06, 0.1, 'triangle', 0.08);
    return;
  }

  if (name === 'countdown') {
    tone(context, 760, now, 0.055, 'sine', 0.04);
    return;
  }

  if (name === 'resultAccept') {
    tone(context, 440, now, 0.08, 'triangle', 0.05);
    tone(context, 660, now + 0.08, 0.12, 'triangle', 0.05);
    return;
  }

  tone(context, 220, now, 0.1, 'sawtooth', 0.05);
  tone(context, 140, now + 0.09, 0.16, 'sawtooth', 0.04);
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
