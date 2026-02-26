/**
 * Ambient noise calibration for microphone input.
 * Records 2 seconds of ambient audio, measures RMS energy,
 * and auto-tunes detection thresholds accordingly.
 */

export interface CalibrationResult {
  ambientRMS: number;
  yinThreshold: number;
  yinConfidence: number;
  noteThreshold: number;
}

export class AmbientNoiseCalibrator {
  computeRMS(buffer: Float32Array): number {
    if (buffer.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    return Math.sqrt(sumSquares / buffer.length);
  }

  computeThresholds(ambientRMS: number): CalibrationResult {
    // Scale thresholds based on ambient noise level
    // Quiet room: RMS ~0.01  → standard thresholds
    // Moderate:    RMS ~0.05  → slightly raised
    // Noisy:       RMS ~0.15+ → highly raised
    const noiseFactor = Math.min(ambientRMS / 0.1, 1.0); // 0-1 scale

    return {
      ambientRMS,
      yinThreshold: 0.15 + noiseFactor * 0.15,       // 0.15 (quiet) → 0.30 (noisy)
      yinConfidence: 0.5 + noiseFactor * 0.3,         // 0.5 (quiet) → 0.8 (noisy)
      noteThreshold: 0.3 + noiseFactor * 0.3,         // 0.3 (quiet) → 0.6 (noisy)
    };
  }

  /**
   * Run full calibration: record 2s of ambient audio, compute thresholds.
   * Requires AudioCapture to be initialized and started.
   */
  async calibrate(getAudioBuffer: () => Promise<Float32Array[]>): Promise<CalibrationResult> {
    const buffers = await getAudioBuffer();
    if (buffers.length === 0) {
      return this.computeThresholds(0);
    }
    // Compute average RMS across all buffers
    let totalRMS = 0;
    for (const buf of buffers) {
      totalRMS += this.computeRMS(buf);
    }
    const avgRMS = totalRMS / buffers.length;
    return this.computeThresholds(avgRMS);
  }
}
