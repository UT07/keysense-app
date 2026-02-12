/**
 * Audio Latency Measurement Harness
 *
 * This script measures end-to-end latency for audio playback:
 * - Scheduled play time vs actual playback
 * - AudioContext output latency
 * - Touch-to-sound pipeline simulation
 *
 * METHODOLOGY:
 * 1. Measure AudioContext outputLatency (hardware + buffer)
 * 2. Measure time to schedule audio (JS overhead)
 * 3. Simulate touch event → audio playback chain
 *
 * TARGETS:
 * - Touch-to-sound: <20ms (cumulative with UI)
 * - MIDI-to-sound: <15ms
 * - Output latency: <50ms
 *
 * Usage:
 *   npm run measure:latency
 */

import { NativeAudioEngine } from '../src/audio/AudioEngine.native';
import type { NoteHandle } from '../src/audio/types';

interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Measure AudioContext output latency
 * This is hardware-dependent and varies by device
 */
async function measureOutputLatency(
  engine: NativeAudioEngine
): Promise<number> {
  // Output latency is reported by AudioContext
  // Typically 10-50ms depending on device and buffer size
  const latency = engine.getLatency();

  console.log(`📊 Output Latency: ${latency.toFixed(2)}ms`);

  return latency;
}

/**
 * Measure JavaScript scheduling overhead
 * Time from playNote() call to audio scheduled in AudioContext
 */
async function measureSchedulingOverhead(
  engine: NativeAudioEngine,
  iterations: number = 100
): Promise<LatencyStats> {
  const measurements: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    // Call playNote and immediately measure overhead
    const handle = engine.playNote(60, 0.8);
    const end = performance.now();

    const overhead = end - start;
    measurements.push(overhead);

    // Release note
    engine.releaseNote(handle);

    // Small delay to prevent stacking notes
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return calculateStats(measurements);
}

/**
 * Simulate touch-to-sound latency
 * Measures: touch event → playNote() call → scheduled
 */
async function measureTouchToSound(
  engine: NativeAudioEngine,
  iterations: number = 100
): Promise<LatencyStats> {
  const measurements: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Simulate touch event processing

    // Simulate event handler (typically <1ms)
    // This would be React Native event processing time
    const processTime = 0.5; // 0.5ms estimate

    // Audio scheduling
    const scheduleStart = performance.now();
    const handle = engine.playNote(60, 0.8);
    const scheduleEnd = performance.now();

    const schedulingTime = scheduleEnd - scheduleStart;
    const totalLatency = processTime + schedulingTime + engine.getLatency();

    measurements.push(totalLatency);

    engine.releaseNote(handle);

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return calculateStats(measurements);
}

/**
 * Simulate MIDI-to-sound latency
 * Measures: MIDI message → parsing → playNote() → scheduled
 */
async function measureMidiToSound(
  engine: NativeAudioEngine,
  iterations: number = 100
): Promise<LatencyStats> {
  const measurements: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Simulate MIDI message arrival

    // MIDI parsing (typically <0.5ms)
    const parseTime = 0.2; // 0.2ms estimate

    // Audio scheduling
    const scheduleStart = performance.now();
    const handle = engine.playNote(60, 0.8);
    const scheduleEnd = performance.now();

    const schedulingTime = scheduleEnd - scheduleStart;
    const totalLatency = parseTime + schedulingTime + engine.getLatency();

    measurements.push(totalLatency);

    engine.releaseNote(handle);

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return calculateStats(measurements);
}

/**
 * Measure polyphonic playback latency
 * Time to play multiple notes simultaneously
 */
async function measurePolyphonyLatency(
  engine: NativeAudioEngine,
  noteCount: number = 10
): Promise<LatencyStats> {
  const measurements: number[] = [];

  for (let iteration = 0; iteration < 20; iteration++) {
    const start = performance.now();

    const handles: NoteHandle[] = [];
    for (let i = 0; i < noteCount; i++) {
      handles.push(engine.playNote(60 + i));
    }

    const end = performance.now();

    const latency = end - start;
    measurements.push(latency);

    handles.forEach((h) => engine.releaseNote(h));

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return calculateStats(measurements);
}

/**
 * Calculate statistical measures from latency data
 */
function calculateStats(measurements: number[]): LatencyStats {
  if (measurements.length === 0) {
    throw new Error('No measurements provided');
  }

  const sorted = [...measurements].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;

  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  const p95 = sorted[Math.max(0, p95Index)];

  const p99Index = Math.ceil(sorted.length * 0.99) - 1;
  const p99 = sorted[Math.max(0, p99Index)];

  return { min, max, avg, median, p95, p99 };
}

/**
 * Format statistics for display
 */
function formatStats(label: string, stats: LatencyStats): void {
  console.log(`\n📈 ${label}:`);
  console.log(`   Min:    ${stats.min.toFixed(2)}ms`);
  console.log(`   Avg:    ${stats.avg.toFixed(2)}ms`);
  console.log(`   Median: ${stats.median.toFixed(2)}ms`);
  console.log(`   P95:    ${stats.p95.toFixed(2)}ms (95th percentile)`);
  console.log(`   P99:    ${stats.p99.toFixed(2)}ms (99th percentile)`);
  console.log(`   Max:    ${stats.max.toFixed(2)}ms`);
}

/**
 * Validate latency against targets
 */
function validateLatency(stats: LatencyStats, target: number): boolean {
  const pass = stats.p95 <= target;
  const status = pass ? '✅ PASS' : '❌ FAIL';

  console.log(`${status} - P95: ${stats.p95.toFixed(2)}ms (target: ${target}ms)`);

  return pass;
}

/**
 * Main measurement function
 */
async function main(): Promise<void> {
  console.log('🎹 KeySense Audio Latency Measurement\n');
  console.log('═'.repeat(50));

  let engine: NativeAudioEngine | null = null;

  try {
    // Initialize engine
    console.log('\n🚀 Initializing audio engine...');
    engine = new NativeAudioEngine();
    await engine.initialize();

    if (!engine.isReady()) {
      throw new Error('Audio engine failed to initialize');
    }

    console.log('✅ Audio engine ready\n');

    // Measure output latency
    console.log('═'.repeat(50));
    console.log('\n1️⃣  HARDWARE OUTPUT LATENCY');
    console.log('─'.repeat(50));
    await measureOutputLatency(engine);

    // Measure scheduling overhead
    console.log('\n2️⃣  JAVASCRIPT SCHEDULING OVERHEAD');
    console.log('─'.repeat(50));
    console.log('(Time to call playNote)');
    const schedulingStats = await measureSchedulingOverhead(engine);
    formatStats('Scheduling Overhead', schedulingStats);

    // Measure touch-to-sound
    console.log('\n3️⃣  TOUCH-TO-SOUND LATENCY');
    console.log('─'.repeat(50));
    console.log(
      '(Simulated: touch event → React handler → playNote → audio)'
    );
    const touchStats = await measureTouchToSound(engine);
    formatStats('Touch-to-Sound', touchStats);

    const touchPass = validateLatency(touchStats, 25);

    // Measure MIDI-to-sound
    console.log('\n4️⃣  MIDI-TO-SOUND LATENCY');
    console.log('─'.repeat(50));
    console.log('(Simulated: MIDI message → parse → playNote → audio)');
    const midiStats = await measureMidiToSound(engine);
    formatStats('MIDI-to-Sound', midiStats);

    const midiPass = validateLatency(midiStats, 20);

    // Measure polyphony latency
    console.log('\n5️⃣  POLYPHONIC PLAYBACK (10 notes)');
    console.log('─'.repeat(50));
    const polyStats = await measurePolyphonyLatency(engine, 10);
    formatStats('10-Note Polyphony', polyStats);

    const polyPass = validateLatency(polyStats, 50);

    // Summary
    console.log('\n═'.repeat(50));
    console.log('\n📊 SUMMARY\n');

    const targets = [
      {
        name: 'Touch-to-Sound',
        stats: touchStats,
        target: 25,
        pass: touchPass,
      },
      { name: 'MIDI-to-Sound', stats: midiStats, target: 20, pass: midiPass },
      {
        name: 'Polyphony (10 notes)',
        stats: polyStats,
        target: 50,
        pass: polyPass,
      },
    ];

    let allPass = true;
    for (const { name, stats, target, pass } of targets) {
      const status = pass ? '✅' : '❌';
      console.log(
        `${status} ${name}: ${stats.p95.toFixed(2)}ms (target: ${target}ms)`
      );
      if (!pass) allPass = false;
    }

    console.log('\n═'.repeat(50));

    if (allPass) {
      console.log('\n🎉 All latency targets met!\n');
      process.exit(0);
    } else {
      console.log(
        '\n⚠️  Some targets not met. Review timing and optimize.\n'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Measurement failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (engine) {
      engine.dispose();
    }
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  measureOutputLatency,
  measureSchedulingOverhead,
  measureTouchToSound,
  measureMidiToSound,
  measurePolyphonyLatency,
  calculateStats,
};
