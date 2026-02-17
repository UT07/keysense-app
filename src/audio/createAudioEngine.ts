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
import { Audio } from 'expo-av';
import type { IAudioEngine } from './types';
import { ExpoAudioEngine } from './ExpoAudioEngine';

/**
 * Singleton instance managed by the factory
 */
let factoryInstance: IAudioEngine | null = null;
let audioModeConfigured = false;

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
 * Configure iOS audio session for playback in silent mode.
 * Must be called before any audio engine initialization.
 * Uses expo-av's Audio.setAudioModeAsync which works regardless of
 * which engine (WebAudio/ExpoAV) is ultimately used for synthesis.
 */
async function ensureAudioModeConfigured(): Promise<void> {
  if (audioModeConfigured) return;
  audioModeConfigured = true;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    console.log('[createAudioEngine] iOS audio mode configured (playsInSilentModeIOS=true)');
  } catch (error) {
    console.warn('[createAudioEngine] Audio mode configuration failed:', error);
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
