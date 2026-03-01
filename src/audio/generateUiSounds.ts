/**
 * Procedural UI Sound Generator — Cheerful Arcade Edition
 *
 * Generates WAV audio data for all UI sound effects using mathematical synthesis.
 * No external .wav files needed — everything is created at runtime during preload.
 *
 * Design philosophy:
 * - BRIGHT: High-pitched, clear harmonics (think Duolingo, Candy Crush, Mario)
 * - PUNCHY: Short attack, clean decay — no washed-out reverb tails
 * - FUN: Major intervals, rising arpeggios, satisfying "pop" and "ding" sounds
 * - NO CREEPY: No formant vocal synthesis, no sub-bass rumble, no dissonant intervals
 *
 * Each sound is 30-500ms of synthesized waveform.
 */

import type { SoundName } from './SoundManager';

const SAMPLE_RATE = 44100;
const TWO_PI = 2 * Math.PI;

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
  return Math.sin(TWO_PI * freq * t);
}

function sweep(t: number, f0: number, f1: number, dur: number): number {
  const freq = f0 + (f1 - f0) * (t / dur);
  return Math.sin(TWO_PI * freq * t);
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

/** Simple early-reflection reverb. Short and bright — no washy tails. */
function withReverb(
  samples: Float32Array,
  mix: number = 0.2,
  delayMs: number = 25,
  repeats: number = 2,
): Float32Array {
  const baseSamples = Math.floor((delayMs / 1000) * SAMPLE_RATE);
  const tailSamples = baseSamples * repeats;
  const out = new Float32Array(samples.length + tailSamples);

  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i];
  }

  for (let r = 1; r <= repeats; r++) {
    const delaySamps = baseSamples * r;
    const atten = mix * Math.pow(0.4, r);
    for (let i = 0; i < samples.length; i++) {
      out[i + delaySamps] += samples[i] * atten;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// UI sounds — crisp taps and toggles
// ---------------------------------------------------------------------------

/** Soft bubble pop — like tapping a bubble */
function buttonPress(): Float32Array {
  return makeSamples(0.06, (t) => {
    const pop = sine(t, 1200) * expDecay(t, 60);
    const click = sine(t, 3200) * expDecay(t, 150) * 0.3;
    return (pop + click) * attack(t, 0.002) * 0.25;
  });
}

/** Rising two-tone chirp — "bweep!" */
function toggleOn(): Float32Array {
  return makeSamples(0.1, (t) => {
    const f = t < 0.04 ? 800 : 1200;
    const local = t < 0.04 ? t : t - 0.04;
    return sine(t, f) * expDecay(local, 25) * attack(t, 0.003) * 0.25;
  });
}

/** Falling two-tone chirp — "bwoop" */
function toggleOff(): Float32Array {
  return makeSamples(0.1, (t) => {
    const f = t < 0.04 ? 1200 : 800;
    const local = t < 0.04 ? t : t - 0.04;
    return sine(t, f) * expDecay(local, 25) * attack(t, 0.003) * 0.22;
  });
}

/** Quick whoosh — soft high-freq sweep */
function swipeSound(): Float32Array {
  return makeSamples(0.08, (t) =>
    sweep(t, 2000, 4000, 0.08) * expDecay(t, 30) * attack(t, 0.005) * 0.1,
  );
}

/** Gentle descending "boop" */
function backNavigate(): Float32Array {
  return makeSamples(0.08, (t) =>
    sweep(t, 1400, 800, 0.08) * expDecay(t, 20) * attack(t, 0.003) * 0.2,
  );
}

// ---------------------------------------------------------------------------
// Gameplay sounds — clear musical feedback
// ---------------------------------------------------------------------------

/** Bright single chime — correct note (C6 major-ish) */
function noteCorrect(): Float32Array {
  return makeSamples(0.12, (t) => {
    const f = 1047; // C6
    const sig = sine(t, f) + 0.3 * sine(t, f * 2) + 0.1 * sine(t, f * 3);
    return sig / 1.4 * expDecay(t, 18) * attack(t, 0.003) * 0.25;
  });
}

/** Bright two-note rising chime — "ding-DING!" (perfect feedback) */
function notePerfect(): Float32Array {
  return makeSamples(0.2, (t) => {
    // Two-step rising: G6 → C7
    const f = t < 0.07 ? 1568 : 2093;
    const local = t < 0.07 ? t : t - 0.07;
    const sig = sine(t, f) + 0.4 * sine(t, f * 2) + 0.15 * sine(t, f * 3);
    // Add sparkle overtone
    const sparkle = sine(t, 4186) * expDecay(t, 40) * 0.15;
    return (sig / 1.55 * expDecay(local, 12) + sparkle) * attack(t, 0.003) * 0.28;
  });
}

/** Short "bonk" — wrong note, cartoonish not scary */
function noteMiss(): Float32Array {
  return makeSamples(0.12, (t) => {
    // Descending "bwamp" — think Mario coin-miss
    const f = 400 - 200 * (t / 0.12);
    const sig = sine(t, f) + 0.3 * sine(t, f * 1.5);
    // Wood-block click at onset
    const knock = sine(t, 800) * expDecay(t, 100) * 0.3;
    return (sig / 1.3 + knock) * expDecay(t, 15) * attack(t, 0.003) * 0.22;
  });
}

/** Quick 3-note ascending — "dip-dip-DING" (5x combo) */
function combo5(): Float32Array {
  return makeSamples(0.2, (t) => {
    const step = Math.floor(t / 0.055);
    // C6 → E6 → G6 (major arpeggio, bright and happy)
    const freqs = [1047, 1319, 1568];
    const f = freqs[Math.min(step, 2)];
    const local = t - step * 0.055;
    const sig = sine(t, f) + 0.3 * sine(t, f * 2);
    return sig / 1.3 * expDecay(local, 20) * attack(local, 0.002) * 0.25;
  });
}

/** 5-note sparkle arpeggio (10x combo) — major pentatonic */
function combo10(): Float32Array {
  return makeSamples(0.25, (t) => {
    const stepDur = 0.04;
    const step = Math.floor(t / stepDur);
    // C6 → D6 → E6 → G6 → A6 (pentatonic, always sounds happy)
    const freqs = [1047, 1175, 1319, 1568, 1760];
    const f = freqs[Math.min(step, 4)];
    const local = t - step * stepDur;
    const sig = sine(t, f) + 0.35 * sine(t, f * 2) + 0.1 * sine(t, f * 3);
    return sig / 1.45 * expDecay(local, 25) * attack(local, 0.002) * 0.28;
  });
}

/** Rapid glissando up + sparkle burst (20x combo — LEGENDARY!) */
function combo20(): Float32Array {
  return makeSamples(0.35, (t) => {
    const dur = 0.35;
    // Rapid ascending sweep
    const f = 1047 + (3200 - 1047) * Math.pow(t / dur, 0.7);
    const sig = sine(t, f) + 0.4 * sine(t, f * 1.5) + 0.2 * sine(t, f * 2);
    // High sparkle layer that fades in
    const sparkle = sine(t, 4500 + 500 * sine(t, 8)) * Math.min(1, t / 0.15) * 0.15;
    return (sig / 1.6 + sparkle) * expDecay(t, 3) * attack(t, 0.005) * 0.3;
  });
}

/** Gentle descending "wah-wah" — combo broken, disappointed but not scary */
function comboBreak(): Float32Array {
  return makeSamples(0.15, (t) => {
    // Two descending tones: E5 → C5 (minor 3rd down — sad but not dissonant)
    const f = t < 0.06 ? 659 : 523;
    const local = t < 0.06 ? t : t - 0.06;
    return sine(t, f) * expDecay(local, 12) * attack(t, 0.005) * 0.2;
  });
}

/** Crisp tick — metronome-style */
function countdownTick(): Float32Array {
  return makeSamples(0.035, (t) =>
    sine(t, 1800) * expDecay(t, 90) * attack(t, 0.001) * 0.2,
  );
}

/** Bright "GO!" chime — rising C6 with harmonics */
function countdownGo(): Float32Array {
  return makeSamples(0.18, (t) => {
    const f = 2093; // C7 — bright and clear
    const sig = sine(t, f) + 0.35 * sine(t, f * 1.5) + 0.15 * sine(t, f * 2);
    return sig / 1.5 * expDecay(t, 8) * attack(t, 0.003) * 0.3;
  });
}

// ---------------------------------------------------------------------------
// Reward sounds — sparkly and satisfying
// ---------------------------------------------------------------------------

/** Sparkly star chime — like catching a star in Mario */
function starEarn(): Float32Array {
  const dry = makeSamples(0.25, (t) => {
    // Shimmer effect via slow vibrato
    const shimmer = 1 + 0.02 * sine(t, 10);
    const f = 2093 * shimmer; // C7 with shimmer
    const sig = sine(t, f) + 0.35 * sine(t, f * 2) + 0.15 * sine(t, f * 3);
    return sig / 1.5 * expDecay(t, 6) * attack(t, 0.005) * 0.25;
  });
  return withReverb(dry, 0.2, 20, 2);
}

/** Crystal clink — short, bright, metallic tap */
function gemClink(): Float32Array {
  return makeSamples(0.1, (t) => {
    const f = 3500;
    // Inharmonic partials for bell/crystal quality
    const sig = sine(t, f) + 0.5 * sine(t, f * 1.5) + 0.25 * sine(t, f * 2.3);
    return sig / 1.75 * expDecay(t, 30) * attack(t, 0.001) * 0.2;
  });
}

/** Tiny tick — subtle XP increment */
function xpTick(): Float32Array {
  return makeSamples(0.02, (t) =>
    sine(t, 2800) * expDecay(t, 150) * 0.1,
  );
}

/** Triumphant major arpeggio — C→E→G→C (level up!) */
function levelUp(): Float32Array {
  const dry = makeSamples(0.45, (t) => {
    const stepDur = 0.1;
    const step = Math.floor(t / stepDur);
    // C6 → E6 → G6 → C7
    const freqs = [1047, 1319, 1568, 2093];
    const f = freqs[Math.min(step, 3)];
    const local = t - step * stepDur;
    const sig = sine(t, f) + 0.35 * sine(t, f * 2) + 0.15 * sine(t, f * 3);
    return sig / 1.5 * expDecay(local, 4) * attack(local, 0.005) * 0.3;
  });
  return withReverb(dry, 0.25, 30, 2);
}

/** Magical unlock — rising sweep + sparkle */
function chestOpen(): Float32Array {
  const dry = makeSamples(0.4, (t) => {
    // Bright rising sweep (think treasure chest in Zelda)
    const f = 800 + 2000 * Math.pow(t / 0.4, 0.5);
    const sig = sine(t, f) + 0.3 * sine(t, f * 2);
    // Crisp onset click
    const click = sine(t, 4000) * expDecay(t, 120) * 0.2;
    return (sig / 1.3 + click) * expDecay(t, 3.5) * attack(t, 0.008) * 0.28;
  });
  return withReverb(dry, 0.25, 30, 2);
}

/** Grand rising sweep — evolution fanfare */
function evolutionStart(): Float32Array {
  const dry = makeSamples(0.5, (t) => {
    const dur = 0.5;
    // Two-layer ascending sweep for richness
    const f1 = 523 + 2000 * Math.pow(t / dur, 0.6);
    const f2 = 784 + 1500 * Math.pow(t / dur, 0.5);
    const sig = sine(t, f1) + 0.5 * sine(t, f2) + 0.2 * sine(t, f1 * 2);
    // Crescendo envelope (builds up, not instant)
    const env = Math.pow(Math.min(1, t / 0.25), 0.7) * expDecay(Math.max(0, t - 0.35), 4);
    return sig / 1.7 * env * 0.3;
  });
  return withReverb(dry, 0.25, 35, 3);
}

/** Bright major chord burst — exercise complete! */
function exerciseComplete(): Float32Array {
  const dry = makeSamples(0.4, (t) => {
    // Onset sparkle
    const onset = sine(t, 4186) * expDecay(t, 80) * 0.15;
    // Major chord: C6 + E6 + G6
    const c = sine(t, 1047) + 0.15 * sine(t, 2093);
    const e = sine(t, 1319) + 0.1 * sine(t, 2637);
    const g = sine(t, 1568) + 0.1 * sine(t, 3136);
    const chord = (c + e + g) / 3.7;
    return (onset + chord) * expDecay(t, 3.5) * attack(t, 0.008) * 0.3;
  });
  return withReverb(dry, 0.2, 25, 2);
}

// ---------------------------------------------------------------------------
// Cat sounds — cute cartoon chirps (NOT realistic vocal synthesis)
//
// These are stylized, game-like "cat" sounds: short melodic chirps, squeaks,
// and trills that SUGGEST cat-ness without attempting realistic meow simulation.
// Think: Neko Atsume, Stardew Valley, or Animal Crossing cat sounds.
// ---------------------------------------------------------------------------

/** Greeting chirp — bright rising "brrp!" like a happy cat trill */
function meowGreeting(): Float32Array {
  return makeSamples(0.15, (t) => {
    // Quick rising chirp: F5 → A5 → C6
    const dur = 0.15;
    const f = 698 + 350 * Math.pow(t / dur, 0.6);
    // Two harmonics for brightness
    const sig = sine(t, f) + 0.4 * sine(t, f * 2) + 0.15 * sine(t, f * 3);
    // Slight vibrato for liveliness
    const vib = 1 + 0.015 * sine(t, 18);
    const env = attack(t, 0.008) * (1 - Math.pow(t / dur, 2));
    return sig * vib / 1.55 * env * 0.25;
  });
}

/** Happy purr — gentle rhythmic hum (cute, not creepy) */
function purrHappy(): Float32Array {
  return makeSamples(0.3, (t) => {
    const dur = 0.3;
    // Gentle AM tremolo at ~25Hz for the "motor" feel
    const tremolo = 0.6 + 0.4 * Math.abs(sine(t, 25));
    // Mid-frequency hum (not sub-bass rumble — that was scary)
    const f = 220;
    const sig = sine(t, f) * 0.5 + sine(t, f * 2) * 0.3 + sine(t, f * 3) * 0.1;
    const env = attack(t, 0.04) * (1 - Math.pow(t / dur, 1.5));
    return sig / 0.9 * tremolo * env * 0.12;
  });
}

/** Sad mew — gentle descending "mew" (cute, not mournful) */
function meowSad(): Float32Array {
  return makeSamples(0.18, (t) => {
    const dur = 0.18;
    // Gentle descending chirp: B5 → G5
    const f = 988 - 200 * (t / dur);
    const sig = sine(t, f) + 0.35 * sine(t, f * 2) + 0.1 * sine(t, f * 3);
    const env = attack(t, 0.01) * expDecay(t, 8);
    return sig / 1.45 * env * 0.2;
  });
}

/** Celebrate chirp — excited rapid trill "prrrrp!" rising */
function meowCelebrate(): Float32Array {
  return makeSamples(0.18, (t) => {
    const dur = 0.18;
    // Rapid ascending trill — multiple quick steps
    const stepDur = 0.035;
    const step = Math.floor(t / stepDur);
    // Rising steps: E5 → G5 → B5 → D6 → E6
    const freqs = [659, 784, 988, 1175, 1319];
    const f = freqs[Math.min(step, 4)];
    const local = t - step * stepDur;
    const sig = sine(t, f) + 0.35 * sine(t, f * 2);
    const env = attack(t, 0.005) * (1 - Math.pow(t / dur, 1.5));
    return sig / 1.35 * expDecay(local, 30) * env * 0.25;
  });
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
