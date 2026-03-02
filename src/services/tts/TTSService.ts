/**
 * Text-to-Speech Service
 *
 * Two-tier TTS pipeline:
 *   1. ElevenLabs (primary) — Neural voices with per-cat personality
 *   2. expo-speech (fallback) — Device TTS when ElevenLabs unavailable
 *
 * The service tries ElevenLabs first. If the API key is missing, the network
 * fails, or the API returns an error, it falls back to expo-speech seamlessly.
 * Cached ElevenLabs audio is served instantly on repeat phrases.
 */

import { getCatVoiceSettings, type CatVoiceSettings } from './catVoiceConfig';
import { logger } from '../../utils/logger';
import {
  speakWithElevenLabs,
  stopElevenLabs,
  isElevenLabsAvailable,
} from './ElevenLabsProvider';

// Lazy-load expo-speech to avoid crashing on dev builds without the native module.
let Speech: typeof import('expo-speech') | null = null;
try {
  Speech = require('expo-speech');
} catch {
  logger.warn('[TTSService] expo-speech native module not available — TTS disabled');
}

export interface TTSOptions {
  catId?: string;
  pitch?: number;
  rate?: number;
  language?: string;
  voice?: string;
  /** Force expo-speech even if ElevenLabs is available */
  forceLocal?: boolean;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
}

class TTSServiceImpl {
  private _isSpeaking = false;
  private _usingElevenLabs = false;
  private _availableVoiceIds: Set<string> | null = null;

  /**
   * Pre-cache available expo-speech voice identifiers.
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

  private _isVoiceAvailable(voiceId: string | undefined): boolean {
    if (!voiceId || !this._availableVoiceIds) return false;
    return this._availableVoiceIds.has(voiceId);
  }

  /**
   * Speak text aloud. Tries ElevenLabs first, falls back to expo-speech.
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!text.trim()) return;

    // Stop any current speech
    if (this._isSpeaking) {
      this.stop();
    }

    const catVoice: CatVoiceSettings = options.catId
      ? getCatVoiceSettings(options.catId)
      : { pitch: 1.0, rate: 0.95, language: 'en-IE' };

    this._isSpeaking = true;

    // Try ElevenLabs first (unless forced local)
    if (!options.forceLocal && isElevenLabsAvailable() && catVoice.elevenLabsVoiceId) {
      const success = await speakWithElevenLabs(
        text,
        catVoice.elevenLabsVoiceId,
        {
          voiceSettings: catVoice.elevenLabsSettings,
          onDone: () => {
            this._isSpeaking = false;
            this._usingElevenLabs = false;
            options.onDone?.();
          },
          onError: (error) => {
            this._isSpeaking = false;
            this._usingElevenLabs = false;
            options.onError?.(error);
          },
        },
      );

      if (success) {
        this._usingElevenLabs = true;
        return;
      }
      // ElevenLabs failed — fall through to expo-speech
      logger.log('[TTSService] ElevenLabs unavailable, falling back to expo-speech');
    }

    // Fallback: expo-speech
    if (!Speech) {
      this._isSpeaking = false;
      return;
    }

    await this._ensureVoiceCache();

    // Validate the requested voice exists on this device.
    let voiceId = options.voice ?? catVoice.voice;
    if (voiceId && !this._isVoiceAvailable(voiceId)) {
      const compact = voiceId.replace('.enhanced.', '.compact.');
      if (this._isVoiceAvailable(compact)) {
        voiceId = compact;
      } else {
        voiceId = undefined;
      }
    }

    this._usingElevenLabs = false;

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

  /** Stop any currently playing speech (ElevenLabs or expo-speech). */
  stop(): void {
    if (this._usingElevenLabs) {
      stopElevenLabs();
      this._usingElevenLabs = false;
    }
    if (Speech) {
      Speech.stop();
    }
    this._isSpeaking = false;
  }

  /** Check if TTS is currently speaking. */
  isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /** Check if TTS is available on this device. */
  async isAvailable(): Promise<boolean> {
    if (isElevenLabsAvailable()) return true;
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
