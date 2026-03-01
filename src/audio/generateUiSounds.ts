/**
 * Procedural UI Sound Generator
 *
 * Generates WAV audio data for all UI sound effects using mathematical synthesis.
 * No external .wav files needed — everything is created at runtime during preload.
 *
 * Each sound is a short (30-600ms) synthesized waveform using combinations of
 * sine waves, frequency sweeps, harmonics, amplitude envelopes, formant filters,
 * and reverb simulation.
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

// ---------------------------------------------------------------------------
// Advanced synthesis utilities
// ---------------------------------------------------------------------------

/**
 * 2nd-order IIR bandpass filter (resonant).
 * Processes an entire Float32Array in-place and returns it.
 * centerFreq: centre frequency in Hz
 * bandwidth: -3dB bandwidth in Hz
 */
function bandpass(
  samples: Float32Array,
  centerFreq: number,
  bandwidth: number,
): Float32Array {
  const omega = TWO_PI * centerFreq / SAMPLE_RATE;
  const sinOmega = Math.sin(omega);
  const cosOmega = Math.cos(omega);
  const alpha = sinOmega * Math.sinh((Math.log(2) / 2) * (bandwidth / centerFreq) * (omega / sinOmega));

  // Transfer function coefficients (normalised by a0)
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const b1 = 0;
  const b2 = -alpha / a0;
  const a1 = (-2 * cosOmega) / a0;
  const a2 = (1 - alpha) / a0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
    samples[i] = y0;
  }
  return samples;
}

/**
 * Simulate simple early-reflection reverb by mixing delayed copies.
 * Returns a NEW buffer (longer than input by the tail).
 * mix: wet/dry ratio (0-1), delayMs: base reflection delay,
 * repeats: number of reflection taps.
 */
function withReverb(
  samples: Float32Array,
  mix: number = 0.3,
  delayMs: number = 40,
  repeats: number = 3,
): Float32Array {
  const baseSamples = Math.floor((delayMs / 1000) * SAMPLE_RATE);
  const tailSamples = baseSamples * repeats;
  const out = new Float32Array(samples.length + tailSamples);

  // Copy dry signal
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i];
  }

  // Add reflection taps — each delayed further and attenuated more
  for (let r = 1; r <= repeats; r++) {
    const delaySamps = baseSamples * r;
    const atten = mix * Math.pow(0.55, r); // exponential decay per tap
    for (let i = 0; i < samples.length; i++) {
      out[i + delaySamps] += samples[i] * atten;
    }
  }

  return out;
}


// ---------------------------------------------------------------------------
// Deterministic noise (seeded LCG for reproducible cat sounds)
// ---------------------------------------------------------------------------

function createNoiseGen(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return (state / 0x7fffffff) * 2 - 1;
  };
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
  const noise = createNoiseGen(42);
  return makeSamples(0.1, (t) => {
    const n = noise();
    return n * sweep(t, 400, 1200, 0.1) * expDecay(t, 15) * 0.1;
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

/**
 * note_perfect: Bright "ding" transient at onset + sustained harmonics.
 * The transient is a short high-frequency burst (3-5kHz) that decays fast,
 * followed by a rich tone.
 */
function notePerfect(): Float32Array {
  return makeSamples(0.25, (t) => {
    // Bright transient "ding" — very short, high-frequency burst
    const transient =
      (sine(t, 4200) + 0.6 * sine(t, 5600) + 0.3 * sine(t, 7000))
      * expDecay(t, 120) * 0.4;

    // Main tone — two-step pitch (A5 -> E6) with rich harmonics
    const f = t < 0.08 ? 880 : 1320;
    const body =
      (sine(t, f) + 0.45 * sine(t, f * 2) + 0.2 * sine(t, f * 3) + 0.08 * sine(t, f * 4))
      * expDecay(t, 7) * attack(t, 0.005) * 0.3;

    return transient + body;
  });
}

/**
 * note_miss: Dissonant — root note + minor 2nd interval (semitone clash).
 * More gritty with subtle distortion-like overtones.
 */
function noteMiss(): Float32Array {
  return makeSamples(0.18, (t) => {
    const f1 = 250; // root
    const f2 = f1 * Math.pow(2, 1 / 12); // minor 2nd (~265 Hz)
    const f3 = 73; // sub-bass rumble

    // Two clashing tones + sweep down for "sad" feel
    const root = sine(t, f1) + 0.2 * sine(t, f1 * 3);   // slightly buzzy
    const clash = sine(t, f2) + 0.15 * sine(t, f2 * 3);
    const sweepDown = sweep(t, 350, 120, 0.18) * 0.3;
    const sub = sine(t, f3) * 0.2;

    const sig = root * 0.5 + clash * 0.4 + sweepDown + sub;
    return sig / 1.6 * expDecay(t, 10) * attack(t, 0.005) * 0.28;
  });
}

/**
 * combo_5: Quick 3-note ascending arpeggio (C-E-G) with bright attack.
 * Moderate energy.
 */
function combo5(): Float32Array {
  return makeSamples(0.22, (t) => {
    const n = Math.floor(t / 0.06);
    const freqs = [880, 1100, 1320]; // A5, ~C#6, E6
    const f = freqs[Math.min(n, 2)];
    const local = t - n * 0.06;

    // Add harmonics for brightness
    const sig = sine(t, f) + 0.35 * sine(t, f * 2) + 0.1 * sine(t, f * 3);
    return sig / 1.45 * expDecay(local, 22) * attack(local, 0.003) * 0.3;
  });
}

/**
 * combo_10: Faster 5-note arpeggio with more harmonics and shimmer.
 * Higher energy, brighter.
 */
function combo10(): Float32Array {
  return makeSamples(0.28, (t) => {
    const stepDur = 0.045;
    const n = Math.floor(t / stepDur);
    const freqs = [880, 1047, 1175, 1320, 1568]; // A5, C6, D6, E6, G6
    const f = freqs[Math.min(n, 4)];
    const local = t - n * stepDur;

    // Richer harmonics + slight vibrato
    const vibrato = 1 + 0.01 * sine(t, 12);
    const sig =
      sine(t, f * vibrato) +
      0.45 * sine(t, f * 2 * vibrato) +
      0.2 * sine(t, f * 3) +
      0.08 * sine(t, f * 4);
    return sig / 1.73 * expDecay(local, 28) * attack(local, 0.002) * 0.35;
  });
}

/**
 * combo_20: Intense upward sweep with layered harmonics, fast shimmer,
 * and a bright "sparkle" overlay.
 */
function combo20(): Float32Array {
  return makeSamples(0.4, (t) => {
    const dur = 0.4;
    const f = 880 + (2200 - 880) * (t / dur);
    const shimmer = 1 + 0.015 * sine(t, 16);

    // Dense harmonic stack
    const sig =
      sine(t, f * shimmer) +
      0.5 * sine(t, f * 1.5 * shimmer) +
      0.3 * sine(t, f * 2) +
      0.15 * sine(t, f * 3) +
      0.08 * sine(t, f * 4);

    // High sparkle layer
    const sparkle = sine(t, 4000 + 1000 * sine(t, 6)) * expDecay(t, 5) * 0.12;

    return (sig / 2.03 + sparkle) * expDecay(t, 2.5) * attack(t, 0.005) * 0.38;
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

/**
 * star_earn: Shimmering celestial chime with reverb tail.
 */
function starEarn(): Float32Array {
  const dry = makeSamples(0.3, (t) => {
    const shimmer = 1 + 0.025 * sine(t, 9);
    const f = 1568 * shimmer; // G6 with slow shimmer
    const sig =
      sine(t, f) +
      0.4 * sine(t, f * 2) +
      0.2 * sine(t, f * 3) +
      0.1 * sine(t, f * 4);
    return sig / 1.7 * expDecay(t, 5) * attack(t, 0.008) * 0.3;
  });
  return withReverb(dry, 0.35, 35, 4);
}

/**
 * gem_clink: Crystalline metallic tap with reverb sparkle.
 */
function gemClink(): Float32Array {
  const dry = makeSamples(0.15, (t) => {
    const f = 3000;
    // Inharmonic partials for metallic quality
    const sig =
      sine(t, f) +
      0.6 * sine(t, f * 1.5) +
      0.3 * sine(t, f * 2.7) +
      0.15 * sine(t, f * 3.4);
    return sig / 2.05 * expDecay(t, 25) * attack(t, 0.002) * 0.25;
  });
  return withReverb(dry, 0.3, 30, 3);
}

function xpTick(): Float32Array {
  return makeSamples(0.025, (t) =>
    sine(t, 2200) * expDecay(t, 120) * 0.12,
  );
}

/**
 * level_up: Major arpeggio (C-E-G-C) with full harmonics and reverb tail.
 */
function levelUp(): Float32Array {
  const dry = makeSamples(0.5, (t) => {
    // C-E-G-C arpeggio
    const step = Math.floor(t / 0.12);
    const freqs = [523, 659, 784, 1047];
    const f = freqs[Math.min(step, 3)];
    const local = t - step * 0.12;
    const sig =
      sine(t, f) +
      0.4 * sine(t, f * 2) +
      0.2 * sine(t, f * 3) +
      0.1 * sine(t, f * 4);
    return sig / 1.7 * expDecay(local, 3.5) * attack(local, 0.008) * 0.35;
  });
  return withReverb(dry, 0.35, 45, 4);
}

/**
 * chest_open: Dramatic upward sweep with reverb "room" effect.
 */
function chestOpen(): Float32Array {
  const dry = makeSamples(0.45, (t) => {
    // Two-layer sweep for richness
    const s1 = sweep(t, 200, 1200, 0.4);
    const s2 = sweep(t, 300, 1800, 0.4) * 0.3;
    // Add a bright "click" at onset
    const click = sine(t, 3500) * expDecay(t, 150) * 0.2;
    const sig = s1 + s2 + click;
    return sig / 1.5 * expDecay(t, 2.8) * attack(t, 0.01) * 0.32;
  });
  return withReverb(dry, 0.4, 50, 4);
}

/**
 * evolution_start: Grand ascending sweep with harmonic layering and reverb.
 */
function evolutionStart(): Float32Array {
  const dry = makeSamples(0.6, (t) => {
    const dur = 0.6;
    const s1 = sweep(t, 150, 2000, dur);
    const s2 = sweep(t, 225, 3000, dur) * 0.5;
    // Add octave doublings that fade in
    const s3 = sweep(t, 300, 4000, dur) * 0.2 * Math.min(1, t / 0.3);
    const gain = t < 0.3 ? t / 0.3 : expDecay(t - 0.3, 3);
    return (s1 + s2 + s3) / 1.7 * gain * 0.35;
  });
  return withReverb(dry, 0.4, 55, 5);
}

/**
 * exercise_complete: Major chord (C5+E5+G5) with a bright onset and reverb.
 */
function exerciseComplete(): Float32Array {
  const dry = makeSamples(0.5, (t) => {
    // Bright transient at the start
    const onset = sine(t, 3000) * expDecay(t, 100) * 0.15;
    // Rich major chord
    const c = sine(t, 523) + 0.2 * sine(t, 1046);
    const e = sine(t, 659) + 0.15 * sine(t, 1318);
    const g = sine(t, 784) + 0.15 * sine(t, 1568);
    const chord = (c + e + g) / 3.5;
    return (onset + chord) * expDecay(t, 2.8) * attack(t, 0.01) * 0.4;
  });
  return withReverb(dry, 0.35, 45, 4);
}

// ---------------------------------------------------------------------------
// Cat sounds — formant-based vocal synthesis
// ---------------------------------------------------------------------------

/**
 * meow_greeting: "Mee-ow" with two-formant vocal tract model.
 * The fundamental sweeps ~400->350Hz (like a real cat meow).
 * F1 sweeps ~800->600Hz (open->closed vowel), F2 ~1800->1200Hz.
 */
function meowGreeting(): Float32Array {
  const dur = 0.3;
  const noise = createNoiseGen(123);

  // Source: glottal pulse train with slight breathiness
  const source = (t: number): number => {
    // Fundamental pitch sweep: "mee" (higher) -> "ow" (lower)
    const f0 = 420 - 80 * (t / dur);
    // Glottal pulse approximation: fundamental + harmonics with rolloff
    let pulse = 0;
    for (let h = 1; h <= 8; h++) {
      pulse += sine(t, f0 * h) * (1 / (h * h));
    }
    // Add slight breathiness (noise)
    const breath = noise() * 0.08;
    return pulse + breath;
  };

  // Phase 1: "mee" (0 -> 60% duration) — open front vowel
  // Phase 2: "ow" (60% -> 100%) — rounded back vowel
  const crossover = 0.6;

  const raw = makeSamples(dur, source);

  // Apply time-varying formants by processing in short chunks
  const chunkSize = Math.floor(SAMPLE_RATE * 0.01); // 10ms chunks
  const numChunks = Math.ceil(raw.length / chunkSize);
  const result = new Float32Array(raw.length);

  for (let c = 0; c < numChunks; c++) {
    const start = c * chunkSize;
    const end = Math.min(start + chunkSize, raw.length);
    const chunkLen = end - start;
    const tNorm = (c * chunkSize / raw.length); // 0-1

    // Interpolate formant frequencies across the meow
    let f1Freq: number, f1Bw: number;
    let f2Freq: number, f2Bw: number;

    if (tNorm < crossover) {
      // "Mee" phase: F1 ~800Hz, F2 ~1800Hz
      const p = tNorm / crossover;
      f1Freq = 800 - 100 * p;
      f1Bw = 180;
      f2Freq = 1800 - 200 * p;
      f2Bw = 220;
    } else {
      // "Ow" phase: F1 drops to ~550Hz, F2 drops to ~1100Hz
      const p = (tNorm - crossover) / (1 - crossover);
      f1Freq = 700 - 150 * p;
      f1Bw = 200;
      f2Freq = 1600 - 500 * p;
      f2Bw = 250;
    }

    // Extract chunk, filter through parallel formants, sum
    const chunk1 = new Float32Array(chunkLen);
    const chunk2 = new Float32Array(chunkLen);
    for (let i = 0; i < chunkLen; i++) {
      chunk1[i] = raw[start + i];
      chunk2[i] = raw[start + i];
    }

    bandpass(chunk1, f1Freq, f1Bw);
    bandpass(chunk2, f2Freq, f2Bw);

    for (let i = 0; i < chunkLen; i++) {
      result[start + i] = chunk1[i] * 0.6 + chunk2[i] * 0.4;
    }
  }

  // Amplitude envelope: quick attack, sustain, smooth release
  for (let i = 0; i < result.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = attack(t, 0.015) * (t < dur * 0.85 ? 1.0 : expDecay(t - dur * 0.85, 15));
    result[i] *= env * 0.4;
  }

  return result;
}

/**
 * purr_happy: Realistic cat purr using amplitude modulation at ~27Hz.
 * The characteristic motor-like purr effect comes from AM on a low rumble.
 */
function purrHappy(): Float32Array {
  const dur = 0.45;
  const noise = createNoiseGen(456);
  const purrRate = 27; // Hz — real cat purr is 25-30Hz

  return makeSamples(dur, (t) => {
    // Amplitude modulation envelope: rhythmic on-off at purr rate
    // Use a squared sine for sharper on/off transitions (more pulse-like)
    const mod = 0.5 + 0.5 * Math.pow(Math.abs(sine(t, purrRate)), 0.6);

    // Source: low sub-harmonic rumble
    const fundamental = sine(t, 26) * 0.35;
    const harmonic2 = sine(t, 52) * 0.25;
    const harmonic3 = sine(t, 78) * 0.1;

    // Turbulent breathiness — deterministic noise filtered low
    const breathNoise = noise() * 0.06;

    const sig = (fundamental + harmonic2 + harmonic3 + breathNoise) * mod;

    // Gentle envelope: fade in and fade out
    const env = attack(t, 0.06) * (1 - Math.pow(t / dur, 2));
    return sig * env * 0.3;
  });
}

/**
 * meow_sad: Descending "meee-owww" with wider formant spacing and drooping pitch.
 * Longer duration, falling F0 for a plaintive quality.
 */
function meowSad(): Float32Array {
  const dur = 0.4;
  const noise = createNoiseGen(789);

  const source = (t: number): number => {
    // Drooping fundamental: starts ~380Hz, falls to ~220Hz
    const f0 = 380 - 160 * (t / dur);
    let pulse = 0;
    for (let h = 1; h <= 7; h++) {
      pulse += sine(t, f0 * h) * (1 / (h * h));
    }
    const breath = noise() * 0.1;
    return pulse + breath;
  };

  const raw = makeSamples(dur, source);

  // Time-varying formants — drooping open vowel
  const chunkSize = Math.floor(SAMPLE_RATE * 0.012);
  const numChunks = Math.ceil(raw.length / chunkSize);
  const result = new Float32Array(raw.length);

  for (let c = 0; c < numChunks; c++) {
    const start = c * chunkSize;
    const end = Math.min(start + chunkSize, raw.length);
    const chunkLen = end - start;
    const tNorm = c * chunkSize / raw.length;

    // Sad meow: formants descend throughout
    const f1Freq = 750 - 200 * tNorm;
    const f2Freq = 1700 - 600 * tNorm;
    const f1Bw = 200 + 50 * tNorm;
    const f2Bw = 250 + 80 * tNorm;

    const chunk1 = new Float32Array(chunkLen);
    const chunk2 = new Float32Array(chunkLen);
    for (let i = 0; i < chunkLen; i++) {
      chunk1[i] = raw[start + i];
      chunk2[i] = raw[start + i];
    }

    bandpass(chunk1, f1Freq, f1Bw);
    bandpass(chunk2, f2Freq, f2Bw);

    for (let i = 0; i < chunkLen; i++) {
      result[start + i] = chunk1[i] * 0.55 + chunk2[i] * 0.45;
    }
  }

  // Envelope: slow attack, long tail
  for (let i = 0; i < result.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = attack(t, 0.03) * (1 - Math.pow(t / dur, 1.5));
    result[i] *= env * 0.35;
  }

  return result;
}

/**
 * meow_celebrate: Excited upward chirpy "mrrrow!" with rising pitch.
 * Three formants, short and bright.
 */
function meowCelebrate(): Float32Array {
  const dur = 0.22;
  const noise = createNoiseGen(321);

  const source = (t: number): number => {
    // Rising fundamental: ~350Hz -> ~550Hz (excited, rising inflection)
    const f0 = 350 + 200 * Math.pow(t / dur, 0.7);
    let pulse = 0;
    for (let h = 1; h <= 9; h++) {
      pulse += sine(t, f0 * h) * (1 / (h * h));
    }
    // More breath for excitement
    const breath = noise() * 0.07;
    return pulse + breath;
  };

  const raw = makeSamples(dur, source);

  // Three formants for a brighter, more open vowel
  const chunkSize = Math.floor(SAMPLE_RATE * 0.008);
  const numChunks = Math.ceil(raw.length / chunkSize);
  const result = new Float32Array(raw.length);

  for (let c = 0; c < numChunks; c++) {
    const start = c * chunkSize;
    const end = Math.min(start + chunkSize, raw.length);
    const chunkLen = end - start;
    const tNorm = c * chunkSize / raw.length;

    // Celebratory: formants rise (opening up)
    const f1Freq = 700 + 200 * tNorm;
    const f2Freq = 1600 + 400 * tNorm;
    const f3Freq = 2800 + 200 * tNorm;

    const chunk1 = new Float32Array(chunkLen);
    const chunk2 = new Float32Array(chunkLen);
    const chunk3 = new Float32Array(chunkLen);
    for (let i = 0; i < chunkLen; i++) {
      chunk1[i] = raw[start + i];
      chunk2[i] = raw[start + i];
      chunk3[i] = raw[start + i];
    }

    bandpass(chunk1, f1Freq, 200);
    bandpass(chunk2, f2Freq, 250);
    bandpass(chunk3, f3Freq, 300);

    for (let i = 0; i < chunkLen; i++) {
      result[start + i] = chunk1[i] * 0.45 + chunk2[i] * 0.35 + chunk3[i] * 0.2;
    }
  }

  // Envelope: snappy attack, moderate sustain, quick release
  for (let i = 0; i < result.length; i++) {
    const t = i / SAMPLE_RATE;
    const env = attack(t, 0.01) * expDecay(t, 5);
    result[i] *= env * 0.4;
  }

  return result;
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
