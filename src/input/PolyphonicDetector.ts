/**
 * Polyphonic pitch detection using Spotify Basic Pitch ONNX model.
 * Detects multiple simultaneous notes (chords) from audio input.
 *
 * Pipeline: AudioBuffer → resample to 22050Hz → ONNX inference → note extraction
 */

// onnxruntime-react-native is imported lazily in initialize() to avoid
// crashing when the native module isn't linked in the current build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let OnnxRuntime: any = null;

// Basic Pitch model constants
const MODEL_SAMPLE_RATE = 22050;
const MODEL_NOTE_BINS = 88; // Piano range: A0 (21) to C8 (108)
const MIDI_OFFSET = 21; // Lowest note in model output = MIDI 21 (A0)
const NOTE_THRESHOLD = 0.5; // Minimum activation to consider a note present
const ONSET_THRESHOLD = 0.5; // Minimum onset activation

export interface DetectedNote {
  midiNote: number;
  confidence: number;
  isOnset: boolean;
}

export interface PolyphonicFrame {
  notes: DetectedNote[];
  timestamp: number;
}

export interface PolyphonicDetectorConfig {
  modelPath?: string;
  inputSampleRate?: number;
  noteThreshold?: number;
  onsetThreshold?: number;
  maxPolyphony?: number;
}

export class PolyphonicDetector {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;
  private ready = false;
  private readonly config: Required<PolyphonicDetectorConfig>;
  // Pre-allocated resampling buffer
  private resampleBuffer: Float32Array;

  constructor(config?: Partial<PolyphonicDetectorConfig>) {
    this.config = {
      modelPath: config?.modelPath ?? 'basic-pitch.onnx',
      inputSampleRate: config?.inputSampleRate ?? 44100,
      noteThreshold: config?.noteThreshold ?? NOTE_THRESHOLD,
      onsetThreshold: config?.onsetThreshold ?? ONSET_THRESHOLD,
      maxPolyphony: config?.maxPolyphony ?? 6,
    };
    // Pre-allocate resample buffer (halved for 44100→22050)
    const maxResampledSize = Math.ceil(
      (4096 * MODEL_SAMPLE_RATE) / this.config.inputSampleRate,
    );
    this.resampleBuffer = new Float32Array(maxResampledSize);
  }

  async initialize(): Promise<void> {
    // Lazy-load onnxruntime to avoid crash when native module isn't linked
    if (!OnnxRuntime) {
      try {
        OnnxRuntime = require('onnxruntime-react-native');
      } catch {
        throw new Error(
          'onnxruntime-react-native native module not available. ' +
          'Install with: npx expo install onnxruntime-react-native'
        );
      }
    }

    // Resolve model path using expo-file-system for runtime file checking.
    // NOTE: We do NOT use require() for the .onnx file because Metro bundler
    // resolves require() at build time — if the file is missing, the entire
    // app crashes with "Unable to resolve module" before any code runs.
    // Instead, we check for the model at runtime via the filesystem.
    let modelUri = this.config.modelPath;
    if (!modelUri.includes('/') && !modelUri.includes(':')) {
      try {
        const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
        const modelDir = FileSystem.documentDirectory + 'models/';
        const modelFile = modelDir + this.config.modelPath;
        const info = await FileSystem.getInfoAsync(modelFile);
        if (info.exists) {
          modelUri = modelFile;
        } else {
          // Also check bundle directory as fallback
          const bundlePath = FileSystem.bundleDirectory
            ? FileSystem.bundleDirectory + 'assets/models/' + this.config.modelPath
            : null;
          if (bundlePath) {
            const bundleInfo = await FileSystem.getInfoAsync(bundlePath);
            if (bundleInfo.exists) {
              modelUri = bundlePath;
            } else {
              throw new Error('not found');
            }
          } else {
            throw new Error('not found');
          }
        }
      } catch {
        throw new Error(
          `[PolyphonicDetector] ONNX model '${this.config.modelPath}' not found. ` +
          'Download basic-pitch.onnx and place in the app documents/models/ directory. ' +
          'Polyphonic detection disabled — falling back to monophonic mode.'
        );
      }
    }

    try {
      this.session = await OnnxRuntime.InferenceSession.create(modelUri);
      this.ready = true;
    } catch (err) {
      throw new Error(
        `Failed to load ONNX model from '${modelUri}'. ` +
        `Download basic-pitch.onnx and place in assets/models/. Error: ${err}`
      );
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  async detect(audioBuffer: Float32Array): Promise<PolyphonicFrame[]> {
    if (!this.session || !this.ready) return [];

    // Resample to 22050Hz if needed
    const resampled = this.resample(audioBuffer);
    if (resampled.length === 0) return [];

    // Create input tensor
    const inputTensor = new OnnxRuntime.Tensor('float32', resampled, [1, resampled.length]);

    // Run inference
    const results = await this.session.run({ audio: inputTensor });

    // Extract notes from model output
    return this.extractNotes(
      results as unknown as Record<string, { data: Float32Array }>,
    );
  }

  private resample(buffer: Float32Array): Float32Array {
    if (this.config.inputSampleRate === MODEL_SAMPLE_RATE) {
      return buffer;
    }

    const ratio = MODEL_SAMPLE_RATE / this.config.inputSampleRate;
    const outputLength = Math.floor(buffer.length * ratio);

    // Ensure buffer is large enough
    if (this.resampleBuffer.length < outputLength) {
      this.resampleBuffer = new Float32Array(outputLength);
    }

    // Simple linear interpolation resampling (sufficient for 2:1 downsampling)
    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i / ratio;
      const srcIdxFloor = Math.floor(srcIdx);
      const frac = srcIdx - srcIdxFloor;
      const a = buffer[srcIdxFloor] ?? 0;
      const b = buffer[Math.min(srcIdxFloor + 1, buffer.length - 1)] ?? 0;
      this.resampleBuffer[i] = a + frac * (b - a);
    }

    return this.resampleBuffer.subarray(0, outputLength);
  }

  private extractNotes(
    results: Record<string, { data: Float32Array }>,
  ): PolyphonicFrame[] {
    const noteOutput = results.note?.data as Float32Array | undefined;
    const onsetOutput = results.onset?.data as Float32Array | undefined;

    if (!noteOutput) return [];

    const numFrames = Math.floor(noteOutput.length / MODEL_NOTE_BINS);
    const frames: PolyphonicFrame[] = [];

    for (let f = 0; f < numFrames; f++) {
      const frameOffset = f * MODEL_NOTE_BINS;
      const notes: DetectedNote[] = [];

      for (let n = 0; n < MODEL_NOTE_BINS; n++) {
        const noteActivation = noteOutput[frameOffset + n];
        if (noteActivation >= this.config.noteThreshold) {
          const onsetActivation = onsetOutput
            ? onsetOutput[frameOffset + n]
            : 0;

          notes.push({
            midiNote: n + MIDI_OFFSET,
            confidence: noteActivation,
            isOnset: onsetActivation >= this.config.onsetThreshold,
          });
        }
      }

      // Limit polyphony to maxPolyphony (keep highest confidence)
      if (notes.length > this.config.maxPolyphony) {
        notes.sort((a, b) => b.confidence - a.confidence);
        notes.length = this.config.maxPolyphony;
      }

      if (notes.length > 0) {
        frames.push({ notes, timestamp: Date.now() });
      }
    }

    return frames;
  }

  dispose(): void {
    if (this.session) {
      (this.session as { release: () => void }).release();
      this.session = null;
    }
    this.ready = false;
  }
}
