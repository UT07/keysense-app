/**
 * Text-to-Speech Service
 *
 * Wraps expo-speech to provide voice coaching with per-cat voice settings.
 * Interface abstraction allows future upgrade to ElevenLabs or other providers.
 */

import { getCatVoiceSettings, type CatVoiceSettings } from './catVoiceConfig';

// Lazy-load expo-speech to avoid crashing on dev builds without the native module.
// The module is optional — TTS gracefully degrades to no-op when unavailable.
let Speech: typeof import('expo-speech') | null = null;
try {
  Speech = require('expo-speech');
} catch {
  console.warn('[TTSService] expo-speech native module not available — TTS disabled');
}

export interface TTSOptions {
  catId?: string;
  pitch?: number;
  rate?: number;
  language?: string;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

class TTSServiceImpl {
  private _isSpeaking = false;

  /**
   * Speak text aloud using the device TTS engine.
   * Voice characteristics are determined by catId.
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!text.trim() || !Speech) return;

    // Stop any current speech
    if (this._isSpeaking) {
      this.stop();
    }

    const catVoice: CatVoiceSettings = options.catId
      ? getCatVoiceSettings(options.catId)
      : { pitch: 1.0, rate: 0.95, language: 'en-US' };

    this._isSpeaking = true;

    return new Promise<void>((resolve) => {
      Speech!.speak(text, {
        pitch: options.pitch ?? catVoice.pitch,
        rate: options.rate ?? catVoice.rate,
        language: options.language ?? catVoice.language,
        onDone: () => {
          this._isSpeaking = false;
          options.onDone?.();
          resolve();
        },
        onStopped: () => {
          this._isSpeaking = false;
          options.onStopped?.();
          resolve();
        },
        onError: (error) => {
          this._isSpeaking = false;
          options.onError?.(error as Error);
          resolve();
        },
      });
    });
  }

  /** Stop any currently playing speech. */
  stop(): void {
    if (this._isSpeaking && Speech) {
      Speech.stop();
      this._isSpeaking = false;
    }
  }

  /** Check if TTS is currently speaking. */
  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /** Check if TTS is available on this device. */
  async isAvailable(): Promise<boolean> {
    if (!Speech) return false;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch {
      return false;
    }
  }
}

export const ttsService = new TTSServiceImpl();
