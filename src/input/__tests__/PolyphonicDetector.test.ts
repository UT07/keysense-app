import { PolyphonicDetector } from '../PolyphonicDetector';

// ONNX model I/O names must match PolyphonicDetector constants
const MODEL_INPUT_NAME = 'serving_default_input_2:0';
const MODEL_OUTPUT_NOTE = 'StatefulPartitionedCall:2';
const MODEL_OUTPUT_ONSET = 'StatefulPartitionedCall:1';
const MODEL_OUTPUT_CONTOUR = 'StatefulPartitionedCall:0';
const MODEL_INPUT_SAMPLES = 43844;

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

// Helper: generate a buffer large enough to trigger inference after resampling
// At 44100→22050, we need 2x the model input samples
const TRIGGER_BUFFER_SIZE = MODEL_INPUT_SAMPLES * 2 + 100; // slightly over to ensure accumulation fills

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

function makeSilentModelOutput() {
  return {
    [MODEL_OUTPUT_NOTE]: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
    [MODEL_OUTPUT_ONSET]: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
    [MODEL_OUTPUT_CONTOUR]: {
      data: new Float32Array(264).fill(0),
      dims: [1, 1, 264],
    },
  };
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
    // Default: silence (all zeros)
    mockRun.mockResolvedValue(makeSilentModelOutput());
  });

  it('should initialize and load the ONNX model', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    expect(detector.isReady()).toBe(true);
  });

  it('should return empty frames for silence', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    const silence = new Float32Array(TRIGGER_BUFFER_SIZE).fill(0);
    const frames = await detector.detect(silence);
    expect(frames).toEqual([]);
  });

  it('should not run inference until enough audio accumulates', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    // Small buffer — not enough to trigger inference
    const smallBuffer = new Float32Array(2048).fill(0);
    const frames = await detector.detect(smallBuffer);
    expect(frames).toEqual([]);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('should detect a single note from model output', async () => {
    // Mock: C4 (note index 60-21=39 in 88-key range) active
    const noteData = new Float32Array(88).fill(0);
    noteData[39] = 0.9; // C4 = MIDI 60, index = 60 - 21 = 39
    const onsetData = new Float32Array(88).fill(0);
    onsetData[39] = 0.8;
    mockRun.mockResolvedValue({
      [MODEL_OUTPUT_NOTE]: { data: noteData, dims: [1, 1, 88] },
      [MODEL_OUTPUT_ONSET]: { data: onsetData, dims: [1, 1, 88] },
      [MODEL_OUTPUT_CONTOUR]: {
        data: new Float32Array(264).fill(0),
        dims: [1, 1, 264],
      },
    });

    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateSineWave(261.63, 44100, TRIGGER_BUFFER_SIZE);
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
      [MODEL_OUTPUT_NOTE]: { data: noteData, dims: [1, 1, 88] },
      [MODEL_OUTPUT_ONSET]: { data: onsetData, dims: [1, 1, 88] },
      [MODEL_OUTPUT_CONTOUR]: {
        data: new Float32Array(264).fill(0),
        dims: [1, 1, 264],
      },
    });

    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateChord([261.63, 329.63, 392.0], 44100, TRIGGER_BUFFER_SIZE);
    const frames = await detector.detect(buffer);
    expect(frames.length).toBeGreaterThan(0);
    const detectedNotes = frames[0].notes.map((n) => n.midiNote);
    expect(detectedNotes).toContain(60);
    expect(detectedNotes).toContain(64);
    expect(detectedNotes).toContain(67);
  });

  it('should pass correct input name and 3D tensor shape to ONNX', async () => {
    const { Tensor } = require('onnxruntime-react-native');
    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateSineWave(440, 44100, TRIGGER_BUFFER_SIZE);
    await detector.detect(buffer);
    // Verify run was called with the correct input name
    expect(mockRun).toHaveBeenCalledTimes(1);
    const feeds = mockRun.mock.calls[0][0];
    expect(feeds).toHaveProperty(MODEL_INPUT_NAME);
    // Verify Tensor was created with 3D shape [1, MODEL_INPUT_SAMPLES, 1]
    const tensorCalls = Tensor.mock.calls;
    const lastTensorCall = tensorCalls[tensorCalls.length - 1];
    expect(lastTensorCall[2]).toEqual([1, MODEL_INPUT_SAMPLES, 1]);
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

  it('should limit polyphony to maxPolyphony', async () => {
    // Mock: 8 notes active, but maxPolyphony defaults to 6
    const noteData = new Float32Array(88).fill(0);
    for (let i = 30; i < 38; i++) {
      noteData[i] = 0.6 + i * 0.01;
    }
    mockRun.mockResolvedValue({
      [MODEL_OUTPUT_NOTE]: { data: noteData, dims: [1, 1, 88] },
      [MODEL_OUTPUT_ONSET]: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
      [MODEL_OUTPUT_CONTOUR]: {
        data: new Float32Array(264).fill(0),
        dims: [1, 1, 264],
      },
    });

    detector = new PolyphonicDetector({ maxPolyphony: 6 });
    await detector.initialize();
    const buffer = generateSineWave(440, 44100, TRIGGER_BUFFER_SIZE);
    const frames = await detector.detect(buffer);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].notes.length).toBeLessThanOrEqual(6);
  });
});
