/**
 * YIN Pitch Detection Algorithm — pure TypeScript implementation
 *
 * Detects fundamental frequency (pitch) from monophonic audio buffers.
 * Designed for real-time piano note detection via microphone.
 *
 * Algorithm steps:
 * 1. Compute autocorrelation difference function
 * 2. Cumulative mean normalized difference
 * 3. Absolute threshold search
 * 4. Parabolic interpolation for sub-sample accuracy
 *
 * All buffers are pre-allocated to avoid GC pressure in the audio path.
 *
 * Reference: de Cheveigné, A. & Kawahara, H. (2002)
 * "YIN, a fundamental frequency estimator for speech and music"
 */

import { frequencyToNearestMidi, frequencyCentsOffset } from '../core/music/pitchUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PitchResult {
  /** Detected frequency in Hz, 0 if unvoiced */
  frequency: number;
  /** Detection confidence 0.0–1.0 */
  confidence: number;
  /** Whether a stable pitch was detected */
  voiced: boolean;
  /** MIDI note number (nearest integer), null if unvoiced */
  midiNote: number | null;
  /** Cents offset from nearest MIDI note (-50 to +50) */
  centsOffset: number;
  /** Timestamp (Date.now()) of detection */
  timestamp: number;
}

export interface PitchDetectorConfig {
  /** Audio sample rate in Hz (default: 44100) */
  sampleRate: number;
  /** Analysis buffer size in samples (default: 2048). Larger = lower min freq but higher latency */
  bufferSize: number;
  /** YIN threshold — lower = stricter pitch detection (default: 0.15) */
  threshold: number;
  /** Minimum confidence to consider a detection valid (default: 0.7) */
  minConfidence: number;
  /** Minimum detectable frequency in Hz (default: 50, ~G1) */
  minFrequency: number;
  /** Maximum detectable frequency in Hz (default: 2000, ~B6) */
  maxFrequency: number;
}

const DEFAULT_CONFIG: PitchDetectorConfig = {
  sampleRate: 44100,
  bufferSize: 2048,
  threshold: 0.15,
  minConfidence: 0.7,
  minFrequency: 50,
  maxFrequency: 2000,
};

// ---------------------------------------------------------------------------
// YIN Pitch Detector
// ---------------------------------------------------------------------------

export class YINPitchDetector {
  private readonly config: PitchDetectorConfig;
  private readonly halfSize: number;
  private readonly yinBuffer: Float32Array;
  private readonly minTau: number;
  private readonly maxTau: number;

  constructor(config?: Partial<PitchDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.halfSize = Math.floor(this.config.bufferSize / 2);

    // Pre-allocate YIN difference buffer (CRITICAL: no allocation in detect())
    this.yinBuffer = new Float32Array(this.halfSize);

    // Convert frequency bounds to lag (tau) bounds
    // tau = sampleRate / frequency
    this.minTau = Math.max(2, Math.floor(this.config.sampleRate / this.config.maxFrequency));
    this.maxTau = Math.min(this.halfSize - 1, Math.floor(this.config.sampleRate / this.config.minFrequency));
  }

  /**
   * Detect pitch from an audio buffer.
   * Buffer must be at least `bufferSize` samples.
   * Returns PitchResult with frequency, confidence, and MIDI note.
   */
  detect(audioBuffer: Float32Array): PitchResult {
    const now = Date.now();

    if (audioBuffer.length < this.config.bufferSize) {
      return { frequency: 0, confidence: 0, voiced: false, midiNote: null, centsOffset: 0, timestamp: now };
    }

    // Step 1: Difference function
    this.computeDifference(audioBuffer);

    // Step 2: Cumulative mean normalized difference
    this.cumulativeMeanNormalize();

    // Step 3: Absolute threshold — find first dip below threshold
    const tauEstimate = this.findThresholdTau();

    if (tauEstimate < 0) {
      return { frequency: 0, confidence: 0, voiced: false, midiNote: null, centsOffset: 0, timestamp: now };
    }

    // Step 4: Parabolic interpolation for sub-sample accuracy
    const refinedTau = this.parabolicInterpolation(tauEstimate);
    const frequency = this.config.sampleRate / refinedTau;
    const confidence = 1 - this.yinBuffer[tauEstimate];

    if (confidence < this.config.minConfidence) {
      return { frequency: 0, confidence, voiced: false, midiNote: null, centsOffset: 0, timestamp: now };
    }

    const midiNote = frequencyToNearestMidi(frequency);
    const centsOffset = frequencyCentsOffset(frequency);

    return {
      frequency,
      confidence,
      voiced: true,
      midiNote,
      centsOffset,
      timestamp: now,
    };
  }

  /**
   * Step 1: Compute the difference function d(tau).
   * d(tau) = sum_{j=0}^{W-1} (x[j] - x[j + tau])^2
   */
  private computeDifference(buffer: Float32Array): void {
    for (let tau = 0; tau < this.halfSize; tau++) {
      let sum = 0;
      for (let j = 0; j < this.halfSize; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      this.yinBuffer[tau] = sum;
    }
  }

  /**
   * Step 2: Cumulative mean normalized difference function.
   * d'(tau) = d(tau) / ((1/tau) * sum_{j=1}^{tau} d(j))
   * d'(0) = 1
   */
  private cumulativeMeanNormalize(): void {
    this.yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < this.halfSize; tau++) {
      runningSum += this.yinBuffer[tau];
      if (runningSum === 0) {
        this.yinBuffer[tau] = 1;
      } else {
        this.yinBuffer[tau] = this.yinBuffer[tau] * tau / runningSum;
      }
    }
  }

  /**
   * Step 3: Find the first tau where d'(tau) dips below the threshold,
   * then follow the valley to its minimum.
   */
  private findThresholdTau(): number {
    for (let tau = this.minTau; tau < this.maxTau; tau++) {
      if (this.yinBuffer[tau] < this.config.threshold) {
        // Walk down to the bottom of the valley
        while (tau + 1 < this.maxTau && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
          tau++;
        }
        return tau;
      }
    }
    return -1; // No pitch found
  }

  /**
   * Step 4: Parabolic interpolation around the estimated tau
   * for sub-sample accuracy.
   */
  private parabolicInterpolation(tau: number): number {
    if (tau <= 0 || tau >= this.halfSize - 1) {
      return tau;
    }

    const s0 = this.yinBuffer[tau - 1];
    const s1 = this.yinBuffer[tau];
    const s2 = this.yinBuffer[tau + 1];

    const denominator = 2 * (2 * s1 - s2 - s0);
    if (denominator === 0) return tau;

    const adjustment = (s2 - s0) / denominator;
    return tau + adjustment;
  }

  /** Get the configured sample rate */
  getSampleRate(): number {
    return this.config.sampleRate;
  }

  /** Get the configured buffer size */
  getBufferSize(): number {
    return this.config.bufferSize;
  }

  /** Get latency of one detection cycle in milliseconds */
  getLatencyMs(): number {
    return (this.config.bufferSize / this.config.sampleRate) * 1000;
  }
}

// ---------------------------------------------------------------------------
// Note tracker — adds hysteresis to prevent rapid note flickering
// ---------------------------------------------------------------------------

export interface NoteTrackerConfig {
  /** Minimum time (ms) a note must be sustained before emitting noteOn (default: 40) */
  onsetHoldMs: number;
  /** Minimum time (ms) of silence before emitting noteOff (default: 80) */
  releaseHoldMs: number;
  /** Maximum cents deviation to consider same note (default: 40) */
  sameCentsThreshold: number;
}

const DEFAULT_TRACKER_CONFIG: NoteTrackerConfig = {
  onsetHoldMs: 40,
  releaseHoldMs: 80,
  sameCentsThreshold: 40,
};

export interface NoteEvent {
  type: 'noteOn' | 'noteOff';
  midiNote: number;
  confidence: number;
  timestamp: number;
}

/**
 * Tracks pitch detections over time and emits stable noteOn/noteOff events.
 * Prevents rapid flickering by requiring sustained detection before onset
 * and sustained silence before release.
 */
export class NoteTracker {
  private readonly config: NoteTrackerConfig;
  private currentNote: number | null = null;
  private candidateNote: number | null = null;
  private candidateStartTime = 0;
  private lastVoicedTime = 0;
  private callback: ((event: NoteEvent) => void) | null = null;

  constructor(config?: Partial<NoteTrackerConfig>) {
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config };
  }

  /** Register callback for note events */
  onNoteEvent(callback: (event: NoteEvent) => void): () => void {
    this.callback = callback;
    return () => { this.callback = null; };
  }

  /** Feed a new pitch detection result */
  update(result: PitchResult): void {
    const now = result.timestamp;

    if (result.voiced && result.midiNote !== null) {
      this.lastVoicedTime = now;

      if (result.midiNote === this.currentNote) {
        // Same note sustained — reset candidate
        this.candidateNote = null;
        return;
      }

      if (result.midiNote === this.candidateNote) {
        // Candidate sustained — check if held long enough
        if (now - this.candidateStartTime >= this.config.onsetHoldMs) {
          // Emit noteOff for previous note (if any)
          if (this.currentNote !== null) {
            this.emit({ type: 'noteOff', midiNote: this.currentNote, confidence: 0, timestamp: now });
          }
          // Emit noteOn for new note
          this.currentNote = result.midiNote;
          this.candidateNote = null;
          this.emit({ type: 'noteOn', midiNote: this.currentNote, confidence: result.confidence, timestamp: now });
        }
      } else {
        // New candidate
        this.candidateNote = result.midiNote;
        this.candidateStartTime = now;
      }
    } else {
      // Unvoiced — check for release
      this.candidateNote = null;
      if (this.currentNote !== null && now - this.lastVoicedTime >= this.config.releaseHoldMs) {
        this.emit({ type: 'noteOff', midiNote: this.currentNote, confidence: 0, timestamp: now });
        this.currentNote = null;
      }
    }
  }

  /** Force release any active note */
  reset(): void {
    if (this.currentNote !== null) {
      this.emit({ type: 'noteOff', midiNote: this.currentNote, confidence: 0, timestamp: Date.now() });
    }
    this.currentNote = null;
    this.candidateNote = null;
    this.candidateStartTime = 0;
    this.lastVoicedTime = 0;
  }

  /** Get currently active note (or null) */
  getCurrentNote(): number | null {
    return this.currentNote;
  }

  private emit(event: NoteEvent): void {
    this.callback?.(event);
  }
}
