/**
 * Audio Engine Factory
 *
 * Creates the best available IAudioEngine implementation.
 *
 * Selection order:
 * 1. WebAudioEngine (react-native-audio-api oscillator synthesis) — preferred
 *    Uses JSI for low-latency audio (<7ms). Available in Dev Builds where
 *    react-native-audio-api's native module is loaded.
 *    Optimized: 3-harmonic synthesis, pre-warmed pipeline, O(1) eviction.
 *
 * 2. ExpoAudioEngine (expo-av) — fallback
 *    Uses async bridge with round-robin voice pools. Higher latency (~20-30ms)
 *    but works everywhere including Expo Go.
 *
 * Detection: We try to instantiate WebAudioEngine. If the native module isn't
 * available (e.g., Expo Go), the import or constructor will throw, and we
 * fall back to ExpoAudioEngine.
 */

import { Platform } from 'react-native';
import type { IAudioEngine } from './types';
import { ExpoAudioEngine } from './ExpoAudioEngine';

/**
 * Singleton instance managed by the factory
 */
let factoryInstance: IAudioEngine | null = null;
let audioModeConfigured = false;
let audioModeRecordingEnabled = false;

/**
 * Try to create a WebAudioEngine. Returns null if react-native-audio-api
 * is not available (e.g., running in Expo Go without the native module).
 */
function tryCreateWebAudioEngine(): IAudioEngine | null {
  const start = Date.now();
  try {
    // Dynamic require so Metro includes the module only if it's in node_modules,
    // and the import doesn't crash at bundle time if the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { WebAudioEngine } = require('./WebAudioEngine');
    const engine = new WebAudioEngine();
    console.log(`[createAudioEngine] WebAudioEngine created in ${Date.now() - start}ms`);
    return engine;
  } catch (error) {
    console.warn(
      `[createAudioEngine] WebAudioEngine unavailable after ${Date.now() - start}ms:`,
      (error as Error).message
    );
    return null;
  }
}

/**
 * Configure iOS audio session for playback and optional recording.
 *
 * Uses react-native-audio-api's AudioManager (SYNCHRONOUS) instead of expo-av's
 * Audio.setAudioModeAsync (async) to avoid a race condition:
 *
 *   createAudioEngine() fires ensureAudioModeConfigured() → starts ASYNC expo-av call
 *   InputManager calls configureAudioSessionForRecording() → SYNC AudioManager call
 *   The async expo-av call resolves later → OVERWRITES PlayAndRecord back to Playback
 *   → Mic input dies silently
 *
 * Both expo-av and react-native-audio-api share the same iOS AVAudioSession singleton
 * but maintain separate internal state. Using AudioManager for ALL session config
 * eliminates the cross-library conflict entirely.
 *
 * Falls back to expo-av only when AudioManager is unavailable (e.g., Expo Go).
 */
export async function ensureAudioModeConfigured(allowRecording = false): Promise<void> {
  // Re-configure if recording was requested but not previously enabled
  if (audioModeConfigured && !allowRecording) return;
  if (audioModeConfigured && allowRecording && audioModeRecordingEnabled) return;

  audioModeConfigured = true;
  if (allowRecording) audioModeRecordingEnabled = true;

  // Primary: use AudioManager from react-native-audio-api (SYNCHRONOUS — no race condition)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AudioManager } = require('react-native-audio-api');
    AudioManager.setAudioSessionOptions({
      iosCategory: allowRecording ? 'playAndRecord' : 'playback',
      iosMode: 'default',
      iosOptions: allowRecording
        ? ['defaultToSpeaker', 'allowBluetooth']
        : ['defaultToSpeaker'],
      iosAllowHaptics: true,
    });
    console.log(
      `[createAudioEngine] Audio session configured via AudioManager ` +
      `(category=${allowRecording ? 'playAndRecord' : 'playback'})`
    );
    return;
  } catch (audioManagerError) {
    console.warn('[createAudioEngine] AudioManager unavailable, falling back to expo-av:', audioManagerError);
  }

  // Fallback: expo-av (async — only used when react-native-audio-api is not available)
  try {
    const { Audio } = require('expo-av');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: allowRecording,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      ...(allowRecording ? { interruptionModeIOS: 1 } : {}),
    });
    console.log(
      `[createAudioEngine] iOS audio mode configured via expo-av ` +
      `(allowsRecordingIOS=${allowRecording})`
    );
  } catch (error) {
    console.warn('[createAudioEngine] Audio mode configuration failed:', error);
    if (allowRecording) {
      audioModeRecordingEnabled = false;
    }
  }
}

/**
 * Create the best available audio engine.
 *
 * Prefers WebAudioEngine (low-latency oscillator synthesis via JSI)
 * when react-native-audio-api is available. Falls back to ExpoAudioEngine
 * (expo-av with round-robin voice pools) for Expo Go.
 *
 * Subsequent calls return the same instance (singleton pattern).
 */
export function createAudioEngine(): IAudioEngine {
  if (factoryInstance) {
    return factoryInstance;
  }

  const selectionStart = Date.now();

  // Configure iOS audio session eagerly (fire-and-forget — resolves before first playNote)
  ensureAudioModeConfigured();

  // Log device/platform info for debugging audio latency across environments
  console.log(
    `[createAudioEngine] Platform: ${Platform.OS} ${Platform.Version ?? 'unknown'}, ` +
    `isTV=${Platform.isTV}`
  );

  const webEngine = tryCreateWebAudioEngine();
  if (webEngine) {
    factoryInstance = webEngine;
    const estimatedLatency = webEngine.getLatency();
    console.log(
      `[createAudioEngine] Selected WebAudioEngine (JSI, 3-harmonic, pre-warmed) ` +
      `in ${Date.now() - selectionStart}ms — estimated latency: ${estimatedLatency}ms`
    );
  } else {
    factoryInstance = new ExpoAudioEngine();
    const estimatedLatency = factoryInstance.getLatency();
    console.log(
      `[createAudioEngine] Selected ExpoAudioEngine (expo-av fallback) ` +
      `in ${Date.now() - selectionStart}ms — estimated latency: ${estimatedLatency}ms`
    );
  }

  return factoryInstance;
}

/**
 * Reset the factory singleton (for testing or engine switching)
 * Disposes the current engine before clearing the reference
 */
export function resetAudioEngineFactory(): void {
  if (factoryInstance) {
    factoryInstance.dispose();
    factoryInstance = null;
    console.log('[createAudioEngine] Factory reset — engine disposed');
  }
}
