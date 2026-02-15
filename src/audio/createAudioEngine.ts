/**
 * Audio Engine Factory
 *
 * Creates the best available IAudioEngine implementation.
 *
 * Selection order:
 * 1. WebAudioEngine (react-native-audio-api oscillator synthesis) — preferred
 *    Uses JSI for low-latency audio (<10ms). Available in Dev Builds where
 *    react-native-audio-api's native module is loaded.
 *
 * 2. ExpoAudioEngine (expo-av) — fallback
 *    Uses async bridge with round-robin voice pools. Higher latency (~20-30ms)
 *    but works everywhere including Expo Go.
 *
 * Detection: We try to instantiate WebAudioEngine. If the native module isn't
 * available (e.g., Expo Go), the import or constructor will throw, and we
 * fall back to ExpoAudioEngine.
 */

import type { IAudioEngine } from './types';
import { ExpoAudioEngine } from './ExpoAudioEngine';

/**
 * Singleton instance managed by the factory
 */
let factoryInstance: IAudioEngine | null = null;

/**
 * Try to create a WebAudioEngine. Returns null if react-native-audio-api
 * is not available (e.g., running in Expo Go without the native module).
 */
function tryCreateWebAudioEngine(): IAudioEngine | null {
  try {
    // Dynamic require so Metro includes the module only if it's in node_modules,
    // and the import doesn't crash at bundle time if the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { WebAudioEngine } = require('./WebAudioEngine');
    return new WebAudioEngine();
  } catch {
    return null;
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

  const webEngine = tryCreateWebAudioEngine();
  if (webEngine) {
    factoryInstance = webEngine;
    console.log('[createAudioEngine] Using WebAudioEngine (react-native-audio-api, low-latency)');
  } else {
    factoryInstance = new ExpoAudioEngine();
    console.log('[createAudioEngine] Using ExpoAudioEngine (expo-av fallback)');
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
  }
}
