import { AmbientNoiseCalibrator, CalibrationResult } from '../AmbientNoiseCalibrator';

describe('AmbientNoiseCalibrator', () => {
  let calibrator: AmbientNoiseCalibrator;

  beforeEach(() => {
    calibrator = new AmbientNoiseCalibrator();
  });

  it('should compute RMS from silence (near-zero)', () => {
    const result = calibrator.computeRMS(new Float32Array(1024).fill(0));
    expect(result).toBeCloseTo(0, 5);
  });

  it('should compute RMS from a constant signal', () => {
    const buffer = new Float32Array(1024).fill(0.5);
    const rms = calibrator.computeRMS(buffer);
    expect(rms).toBeCloseTo(0.5, 2);
  });

  it('should recommend appropriate thresholds from quiet environment', () => {
    const thresholds = calibrator.computeThresholds(0.01); // Very quiet
    expect(thresholds.yinConfidence).toBeGreaterThanOrEqual(0.5);
    expect(thresholds.yinConfidence).toBeLessThanOrEqual(0.9);
    expect(thresholds.noteThreshold).toBeGreaterThanOrEqual(0.3);
  });

  it('should recommend higher thresholds for noisy environment', () => {
    const thresholds = calibrator.computeThresholds(0.15); // Moderate noise
    // Noisy = needs higher confidence to avoid false positives
    expect(thresholds.yinConfidence).toBeGreaterThan(0.5);
    expect(thresholds.noteThreshold).toBeGreaterThan(0.3);
  });

  it('should return calibration result with all fields', () => {
    const thresholds = calibrator.computeThresholds(0.05);
    expect(thresholds).toHaveProperty('yinConfidence');
    expect(thresholds).toHaveProperty('yinThreshold');
    expect(thresholds).toHaveProperty('noteThreshold');
    expect(thresholds).toHaveProperty('ambientRMS');
  });

  it('should handle empty buffer', () => {
    const result = calibrator.computeRMS(new Float32Array(0));
    expect(result).toBe(0);
  });

  it('should calibrate from multiple audio buffers', async () => {
    const buffers = [
      new Float32Array(1024).fill(0.1),
      new Float32Array(1024).fill(0.1),
    ];
    const result = await calibrator.calibrate(async () => buffers);
    expect(result.ambientRMS).toBeCloseTo(0.1, 2);
    expect(result.yinConfidence).toBeGreaterThan(0.5);
  });

  it('should handle empty buffer array in calibrate', async () => {
    const result = await calibrator.calibrate(async () => []);
    expect(result.ambientRMS).toBe(0);
    expect(result.yinConfidence).toBe(0.5); // quiet default
  });
});
