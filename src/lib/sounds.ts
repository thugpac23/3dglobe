// Web Audio API sound system — no external audio files needed
let audioCtx: AudioContext | null = null;
let soundEnabled = true;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch { return null; }
  }
  return audioCtx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.25) {
  if (!soundEnabled) return;
  const c = ctx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch { /* ignore */ }
}

function arpeggio(freqs: number[], noteMs: number, vol = 0.25) {
  freqs.forEach((f, i) => setTimeout(() => tone(f, noteMs / 1000, 'sine', vol), i * noteMs));
}

export const sounds = {
  click:       () => tone(880, 0.07, 'sine', 0.18),
  add:         () => arpeggio([523, 659, 784], 90),
  remove:      () => tone(300, 0.2, 'sawtooth', 0.15),
  achievement: () => arpeggio([523, 659, 784, 1047], 110),
  levelUp:     () => arpeggio([330, 415, 494, 659, 784], 100, 0.3),
  quizCorrect: () => arpeggio([523, 659, 784], 80),
  quizWrong:   () => { tone(220, 0.15, 'sawtooth', 0.2); setTimeout(() => tone(180, 0.2, 'sawtooth', 0.15), 150); },
  stamp:       () => { tone(150, 0.06, 'square', 0.3); setTimeout(() => tone(120, 0.12, 'square', 0.2), 60); },
};

export function setSoundEnabled(v: boolean) { soundEnabled = v; }
export function isSoundEnabled() { return soundEnabled; }

// Resume AudioContext on first user gesture (required by browsers)
export function resumeAudio() { ctx()?.resume().catch(() => {}); }
