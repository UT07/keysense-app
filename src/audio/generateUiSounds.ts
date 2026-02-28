/**
 * Procedural UI Sound Generator
 *
 * Generates WAV audio data for all UI sound effects using mathematical synthesis.
 * No external .wav files needed — everything is created at runtime during preload.
 *
 * Each sound is a short (30-500ms) synthesized waveform using combinations of
 * sine waves, frequency sweeps, harmonics, and amplitude envelopes.
 */

import type { SoundName } from './SoundManager';

const SAMPLE_RATE = 44100;

// ---------------------------------------------------------------------------
// WAV builder
// ---------------------------------------------------------------------------

function createWav(samples: Float32Array): ArrayBuffer {
  const numSamples = samples.length;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * (bitsPerSample / 8);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const w = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  w(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, bitsPerSample, true);
  w(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }

  return buffer;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += alphabet[(a >> 2) & 0x3f];
    out += alphabet[((a << 4) | (b >> 4)) & 0x3f];
    out += i + 1 < bytes.length ? alphabet[((b << 2) | (c >> 6)) & 0x3f] : '=';
    out += i + 2 < bytes.length ? alphabet[c & 0x3f] : '=';
  }
  return out;
}

// ---------------------------------------------------------------------------
// Synthesis primitives
// ---------------------------------------------------------------------------

function sine(t: number, freq: number): number {
  return Math.sin(2 * Math.PI * freq * t);
}

function sweep(t: number, f0: number, f1: number, dur: number): number {
  const freq = f0 + (f1 - f0) * (t / dur);
  return Math.sin(2 * Math.PI * freq * t);
}

function expDecay(t: number, rate: number): number {
  return Math.exp(-t * rate);
}

function attack(t: number, dur: number): number {
  return Math.min(1, t / dur);
}

function makeSamples(duration: number, fn: (t: number) => number): Float32Array {
  const n = Math.floor(SAMPLE_RATE * duration);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = fn(i / SAMPLE_RATE);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sound recipes
// ---------------------------------------------------------------------------

function buttonPress(): Float32Array {
  return makeSamples(0.04, (t) =>
    sine(t, 1800) * expDecay(t, 80) * attack(t, 0.003) * 0.3,
  );
}

function toggleOn(): Float32Array {
  return makeSamples(0.08, (t) =>
    sweep(t, 600, 1400, 0.08) * expDecay(t, 20) * attack(t, 0.005) * 0.3,
  );
}

function toggleOff(): Float32Array {
  return makeSamples(0.08, (t) =>
    sweep(t, 1200, 500, 0.08) * expDecay(t, 20) * attack(t, 0.005) * 0.25,
  );
}

function swipeSound(): Float32Array {
  return makeSamples(0.1, (t) => {
    const noise = Math.random() * 2 - 1;
    return noise * sweep(t, 400, 1200, 0.1) * expDecay(t, 15) * 0.1;
  });
}

function backNavigate(): Float32Array {
  return makeSamples(0.1, (t) =>
    sweep(t, 1000, 500, 0.1) * expDecay(t, 15) * attack(t, 0.003) * 0.25,
  );
}

function noteCorrect(): Float32Array {
  return makeSamples(0.12, (t) => {
    const f = 880;
    const sig = sine(t, f) + 0.3 * sine(t, f * 2) + 0.1 * sine(t, f * 3);
    return sig / 1.4 * expDecay(t, 15) * attack(t, 0.005) * 0.3;
  });
}

function notePerfect(): Float32Array {
  return makeSamples(0.2, (t) => {
    const f = t < 0.08 ? 880 : 1320;
    const sig = sine(t, f) + 0.4 * sine(t, f * 2) + 0.15 * sine(t, f * 3);
    return sig / 1.55 * expDecay(t, 8) * attack(t, 0.005) * 0.35;
  });
}

function noteMiss(): Float32Array {
  return makeSamples(0.15, (t) => {
    const sig = sweep(t, 300, 150, 0.15) + 0.3 * sine(t, 73);
    return sig / 1.3 * expDecay(t, 12) * attack(t, 0.005) * 0.25;
  });
}

function combo5(): Float32Array {
  return makeSamples(0.2, (t) => {
    const n = Math.floor(t / 0.06);
    const freqs = [880, 1100, 1320];
    const f = freqs[Math.min(n, 2)];
    return sine(t, f) * expDecay(t % 0.06, 25) * attack(t, 0.003) * 0.3;
  });
}

function combo10(): Float32Array {
  return makeSamples(0.25, (t) => {
    const n = Math.floor(t / 0.05);
    const freqs = [880, 1047, 1175, 1320, 1568];
    const f = freqs[Math.min(n, 4)];
    return sine(t, f) * expDecay(t % 0.05, 30) * attack(t, 0.003) * 0.35;
  });
}

function combo20(): Float32Array {
  return makeSamples(0.35, (t) => {
    const f = 880 + (1760 - 880) * (t / 0.35);
    const sig = sine(t, f) + 0.5 * sine(t, f * 1.5);
    return sig / 1.5 * expDecay(t, 3) * attack(t, 0.005) * 0.35;
  });
}

function comboBreak(): Float32Array {
  return makeSamples(0.2, (t) =>
    sweep(t, 500, 150, 0.2) * expDecay(t, 8) * attack(t, 0.005) * 0.25,
  );
}

function countdownTick(): Float32Array {
  return makeSamples(0.03, (t) =>
    sine(t, 1200) * expDecay(t, 100) * attack(t, 0.002) * 0.25,
  );
}

function countdownGo(): Float32Array {
  return makeSamples(0.2, (t) => {
    const f = 1047; // C6
    const sig = sine(t, f) + 0.5 * sine(t, f * 1.5) + 0.2 * sine(t, f * 2);
    return sig / 1.7 * expDecay(t, 6) * attack(t, 0.005) * 0.4;
  });
}

function starEarn(): Float32Array {
  return makeSamples(0.3, (t) => {
    const shimmer = 1 + 0.02 * sine(t, 8);
    const f = 1568 * shimmer; // G6 with shimmer
    const sig = sine(t, f) + 0.4 * sine(t, f * 2) + 0.2 * sine(t, f * 3);
    return sig / 1.6 * expDecay(t, 5) * attack(t, 0.008) * 0.3;
  });
}

function gemClink(): Float32Array {
  return makeSamples(0.15, (t) => {
    const f = 3000;
    const sig = sine(t, f) + 0.6 * sine(t, f * 1.5) + 0.3 * sine(t, f * 2.7);
    return sig / 1.9 * expDecay(t, 25) * attack(t, 0.002) * 0.25;
  });
}

function xpTick(): Float32Array {
  return makeSamples(0.025, (t) =>
    sine(t, 2200) * expDecay(t, 120) * 0.12,
  );
}

function levelUp(): Float32Array {
  return makeSamples(0.5, (t) => {
    // C-E-G-C arpeggio
    const step = Math.floor(t / 0.12);
    const freqs = [523, 659, 784, 1047];
    const f = freqs[Math.min(step, 3)];
    const local = t - step * 0.12;
    const sig = sine(t, f) + 0.4 * sine(t, f * 2) + 0.15 * sine(t, f * 3);
    return sig / 1.55 * expDecay(local, 4) * attack(local, 0.008) * 0.35;
  });
}

function chestOpen(): Float32Array {
  return makeSamples(0.4, (t) => {
    const sig = sweep(t, 200, 1200, 0.4) + 0.3 * sweep(t, 300, 1800, 0.4);
    return sig / 1.3 * expDecay(t, 3) * attack(t, 0.01) * 0.3;
  });
}

function evolutionStart(): Float32Array {
  return makeSamples(0.6, (t) => {
    const sig = sweep(t, 150, 2000, 0.6) + 0.5 * sweep(t, 225, 3000, 0.6);
    const gain = t < 0.3 ? t / 0.3 : expDecay(t - 0.3, 3);
    return sig / 1.5 * gain * 0.35;
  });
}

function exerciseComplete(): Float32Array {
  return makeSamples(0.45, (t) => {
    // Major chord: C5 + E5 + G5
    const sig = sine(t, 523) + sine(t, 659) + sine(t, 784);
    return sig / 3 * expDecay(t, 3) * attack(t, 0.01) * 0.4;
  });
}

function meowGreeting(): Float32Array {
  return makeSamples(0.25, (t) =>
    sweep(t, 600, 900, 0.12) * expDecay(t, 6) * attack(t, 0.01) * 0.3,
  );
}

function purrHappy(): Float32Array {
  return makeSamples(0.4, (t) => {
    const purr = sine(t, 25) * 0.3 + sine(t, 50) * 0.2;
    const rumble = (Math.random() * 2 - 1) * 0.05;
    return (purr + rumble) * (1 - t / 0.5) * 0.25;
  });
}

function meowSad(): Float32Array {
  return makeSamples(0.3, (t) =>
    sweep(t, 800, 400, 0.3) * expDecay(t, 5) * attack(t, 0.01) * 0.25,
  );
}

function meowCelebrate(): Float32Array {
  return makeSamples(0.2, (t) =>
    sweep(t, 700, 1200, 0.2) * expDecay(t, 8) * attack(t, 0.008) * 0.3,
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const GENERATORS: Record<SoundName, () => Float32Array> = {
  button_press: buttonPress,
  toggle_on: toggleOn,
  toggle_off: toggleOff,
  swipe: swipeSound,
  back_navigate: backNavigate,
  note_correct: noteCorrect,
  note_perfect: notePerfect,
  note_miss: noteMiss,
  combo_5: combo5,
  combo_10: combo10,
  combo_20: combo20,
  combo_break: comboBreak,
  countdown_tick: countdownTick,
  countdown_go: countdownGo,
  star_earn: starEarn,
  gem_clink: gemClink,
  xp_tick: xpTick,
  level_up: levelUp,
  chest_open: chestOpen,
  evolution_start: evolutionStart,
  exercise_complete: exerciseComplete,
  meow_greeting: meowGreeting,
  purr_happy: purrHappy,
  meow_sad: meowSad,
  meow_celebrate: meowCelebrate,
};

/**
 * Generate a base64 data URI for a given sound name.
 * Returns `data:audio/wav;base64,...` string ready for expo-av.
 */
export function generateSoundUri(name: SoundName): string {
  const samples = GENERATORS[name]();
  const wav = createWav(samples);
  return `data:audio/wav;base64,${toBase64(wav)}`;
}

/**
 * Generate all sound URIs at once.
 * Called during SoundManager.preload().
 */
export function generateAllSoundUris(): Record<SoundName, string> {
  const result = {} as Record<SoundName, string>;
  for (const name of Object.keys(GENERATORS) as SoundName[]) {
    result[name] = generateSoundUri(name);
  }
  return result;
}
