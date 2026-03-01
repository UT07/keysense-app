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
  voice?: string;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

class TTSServiceImpl {
  private _isSpeaking = false;
  private _availableVoiceIds: Set<string> | null = null;

  /**
   * Pre-cache available voice identifiers so we can validate before speaking.
   * iOS may not have "enhanced" voices downloaded — fall back to compact voices.
   */
  private async _ensureVoiceCache(): Promise<void> {
    if (this._availableVoiceIds || !Speech) return;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      this._availableVoiceIds = new Set(voices.map(v => v.identifier));
    } catch {
      this._availableVoiceIds = new Set();
    }
  }

  /** Check if a specific voice ID is available on this device */
  private _isVoiceAvailable(voiceId: string | undefined): boolean {
    if (!voiceId || !this._availableVoiceIds) return false;
    return this._availableVoiceIds.has(voiceId);
  }

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

    // Cache available voices on first speak
    await this._ensureVoiceCache();

    const catVoice: CatVoiceSettings = options.catId
      ? getCatVoiceSettings(options.catId)
      : { pitch: 1.0, rate: 0.95, language: 'en-IE' };

    this._isSpeaking = true;

    // Validate the requested voice exists on this device.
    // Enhanced Siri voices must be downloaded by the user — fall back to compact.
    let voiceId = options.voice ?? catVoice.voice;
    if (voiceId && !this._isVoiceAvailable(voiceId)) {
      // Try compact version (drop ".enhanced" from the identifier)
      const compact = voiceId.replace('.enhanced.', '.compact.');
      if (this._isVoiceAvailable(compact)) {
        voiceId = compact;
      } else {
        // Let the system pick the best voice for the language
        voiceId = undefined;
      }
    }

    return new Promise<void>((resolve) => {
      Speech!.speak(text, {
        pitch: options.pitch ?? catVoice.pitch,
        rate: options.rate ?? catVoice.rate,
        language: options.language ?? catVoice.language,
        ...(voiceId ? { voice: voiceId } : {}),
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
