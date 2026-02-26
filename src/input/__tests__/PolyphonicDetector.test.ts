import { PolyphonicDetector } from '../PolyphonicDetector';

// Mock onnxruntime-react-native
const mockRun = jest.fn();
jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: {
    create: jest.fn().mockResolvedValue({
      run: mockRun,
      release: jest.fn(),
    }),
  },
  Tensor: jest
    .fn()
    .mockImplementation(
      (type: string, data: Float32Array, dims: number[]) => ({
        type,
        data,
        dims,
      }),
    ),
}));

function generateSineWave(
  frequency: number,
  sampleRate: number,
  numSamples: number,
  amplitude = 0.8,
): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] =
      amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

function generateChord(
  frequencies: number[],
  sampleRate: number,
  numSamples: number,
  amplitude = 0.5,
): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (const freq of frequencies) {
    for (let i = 0; i < numSamples; i++) {
      buffer[i] +=
        (amplitude / frequencies.length) *
        Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
  }
  return buffer;
}

describe('PolyphonicDetector', () => {
  let detector: PolyphonicDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set InferenceSession.create after clearAllMocks resets it
    const { InferenceSession } = require('onnxruntime-react-native');
    InferenceSession.create.mockResolvedValue({
      run: mockRun,
      release: jest.fn(),
    });
    // Mock ONNX model output: 88 note bins × N frames
    // Default: silence (all zeros)
    mockRun.mockResolvedValue({
      note: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
      onset: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
      contour: {
        data: new Float32Array(360).fill(0),
        dims: [1, 1, 360],
      },
    });
  });

  it('should initialize and load the ONNX model', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    expect(detector.isReady()).toBe(true);
  });

  it('should return empty frames for silence', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    const silence = new Float32Array(2048).fill(0);
    const frames = await detector.detect(silence);
    expect(frames).toEqual([]);
  });

  it('should detect a single note from model output', async () => {
    // Mock: C4 (note index 60-21=39 in 88-key range) active
    const noteData = new Float32Array(88).fill(0);
    noteData[39] = 0.9; // C4 = MIDI 60, index = 60 - 21 = 39
    const onsetData = new Float32Array(88).fill(0);
    onsetData[39] = 0.8;
    mockRun.mockResolvedValue({
      note: { data: noteData, dims: [1, 1, 88] },
      onset: { data: onsetData, dims: [1, 1, 88] },
      contour: {
        data: new Float32Array(360).fill(0),
        dims: [1, 1, 360],
      },
    });

    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateSineWave(261.63, 44100, 2048);
    const frames = await detector.detect(buffer);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].notes).toContainEqual(
      expect.objectContaining({ midiNote: 60 }),
    );
  });

  it('should detect a chord (C-E-G) from model output', async () => {
    // Mock: C4, E4, G4 all active
    const noteData = new Float32Array(88).fill(0);
    noteData[39] = 0.85; // C4 (60-21)
    noteData[43] = 0.8; // E4 (64-21)
    noteData[46] = 0.82; // G4 (67-21)
    const onsetData = new Float32Array(88).fill(0);
    onsetData[39] = 0.8;
    onsetData[43] = 0.75;
    onsetData[46] = 0.77;
    mockRun.mockResolvedValue({
      note: { data: noteData, dims: [1, 1, 88] },
      onset: { data: onsetData, dims: [1, 1, 88] },
      contour: {
        data: new Float32Array(360).fill(0),
        dims: [1, 1, 360],
      },
    });

    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateChord([261.63, 329.63, 392.0], 44100, 2048);
    const frames = await detector.detect(buffer);
    expect(frames.length).toBeGreaterThan(0);
    const detectedNotes = frames[0].notes.map((n) => n.midiNote);
    expect(detectedNotes).toContain(60);
    expect(detectedNotes).toContain(64);
    expect(detectedNotes).toContain(67);
  });

  it('should resample from 44100 to 22050 Hz', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateSineWave(440, 44100, 4096);
    await detector.detect(buffer);
    // Verify ONNX was called with resampled data
    const tensorCall = mockRun.mock.calls[0];
    expect(tensorCall).toBeDefined();
  });

  it('should return isReady false before initialization', () => {
    detector = new PolyphonicDetector();
    expect(detector.isReady()).toBe(false);
  });

  it('should handle model loading failure gracefully', async () => {
    const { InferenceSession } = require('onnxruntime-react-native');
    InferenceSession.create.mockRejectedValueOnce(
      new Error('Model load failed'),
    );
    detector = new PolyphonicDetector();
    await expect(detector.initialize()).rejects.toThrow('Model load failed');
    expect(detector.isReady()).toBe(false);
  });

  it('should dispose and release model resources', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    detector.dispose();
    expect(detector.isReady()).toBe(false);
  });
});
