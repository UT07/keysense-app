/**
 * Per-cat voice configuration for TTS
 *
 * Each cat has:
 * 1. An ElevenLabs voice ID for premium neural TTS (primary)
 * 2. expo-speech settings as fallback (pitch, rate, language, iOS voice)
 *
 * ElevenLabs voices are selected to match each cat's personality:
 * - Warm/friendly cats → warm female/male voices
 * - Cool/mysterious cats → gravelly/neutral voices
 * - Energetic cats → upbeat, animated voices
 * - Calm cats → relaxed, measured voices
 *
 * Parameter guidelines:
 * - pitch: 0.97-1.03 range (subtle personality, not distortion)
 * - rate: 0.92-1.15 range (energy level variation)
 * - stability: 0.30-0.60 (lower = more expressive character voice)
 *
 * Target audience: Ireland-based users. Default language is en-IE.
 */

import { Platform, NativeModules } from 'react-native';
import type { ElevenLabsVoiceSettings } from './ElevenLabsProvider';

export interface CatVoiceSettings {
  // ElevenLabs (primary)
  elevenLabsVoiceId?: string;
  elevenLabsSettings?: Partial<ElevenLabsVoiceSettings>;

  // expo-speech (fallback)
  pitch: number;   // 0.5-2.0 (1.0 = normal)
  rate: number;    // 0.5-2.0 (1.0 = normal)
  language: string; // BCP-47 language tag
  voice?: string;  // Platform voice identifier (iOS: com.apple.voice.*)
}

/** Detect device locale, defaulting to en-IE for target market */
function getDeviceLanguage(): string {
  try {
    if (Platform.OS === 'ios') {
      const locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ??
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
        'en-IE';
      return locale.replace('_', '-');
    }
    // Android
    const locale = NativeModules.I18nManager?.localeIdentifier ?? 'en-IE';
    return locale.replace('_', '-');
  } catch {
    return 'en-IE';
  }
}

/** Default language based on device locale */
export const DEFAULT_LANGUAGE = getDeviceLanguage().startsWith('en') ? getDeviceLanguage() : 'en-IE';

// ────────────────────────────────────────────────
// ElevenLabs Voice IDs
// https://elevenlabs.io/voice-library
// ────────────────────────────────────────────────

const VOICES = {
  laura:   'FGY2WhTYpPnrIDTdsKH5', // Young female, sunny enthusiasm, quirky
  will:    'bIHbv24MWmeRgasZH58o', // Young male, conversational, laid-back
  lily:    'pFZP5JQG7iQjIQuC4Bku', // Mid female, British, velvety warmth
  sarah:   'EXAVITQu4vr4xnSDxMaL', // Young female, warm, reassuring
  charlie: 'IKne3meq5aSn9XLyUdCD', // Young male, Australian, energetic
  matilda: 'XrExE9yKIg1WjnnlVkGX', // Mid female, professional alto
  liam:    'TX3LPaxmHKxFdv7VOQHJ', // Young male, energetic, warm
  river:   'SAz9YHcvj6GT2YYXdXww', // Neutral, relaxed, even-keeled
  alice:   'Xb7hH8MSUJpSbSDYk0k2', // Mid female, British, clear educator
  callum:  'N2lVS1w4EtoT3dr4eOWO', // Mid male, gravelly, mischievous
  daniel:  'onwK4e9ZLuTAKqWW03F9', // Mid male, British, professional
  harry:   'SOYHLrjzK2X1ezoPC6cr', // Young male, animated, energetic
  jessica: 'cgSgspJ2msm6clMCkdW9', // Young female, playful, trendy
} as const;

const CAT_VOICE_MAP: Record<string, CatVoiceSettings> = {
  // Mini Meowww — friendly beginner companion, warm and approachable
  'mini-meowww': {
    elevenLabsVoiceId: VOICES.laura,
    elevenLabsSettings: { stability: 0.40, style: 0.40 },
    pitch: 1.01, rate: 1.0, language: 'en-US',
    voice: 'com.apple.voice.enhanced.en-US.Samantha',
  },

  // Jazzy — smooth, laid-back, cool jazz energy
  jazzy: {
    elevenLabsVoiceId: VOICES.will,
    elevenLabsSettings: { stability: 0.55, style: 0.30 },
    pitch: 0.98, rate: 0.95, language: 'en-US',
    voice: 'com.apple.voice.enhanced.en-US.Nicky',
  },

  // Luna — mystical, calm, slightly ethereal
  luna: {
    elevenLabsVoiceId: VOICES.lily,
    elevenLabsSettings: { stability: 0.50, style: 0.45 },
    pitch: 1.02, rate: 0.93, language: 'en-AU',
    voice: 'com.apple.voice.enhanced.en-AU.Karen',
  },

  // Biscuit — gentle, sweet, encouraging
  biscuit: {
    elevenLabsVoiceId: VOICES.sarah,
    elevenLabsSettings: { stability: 0.45, style: 0.35 },
    pitch: 1.03, rate: 0.97, language: 'en-US',
    voice: 'com.apple.voice.enhanced.en-US.Allison',
  },

  // Ballymakawww — Irish folk cat, lively and warm
  ballymakawww: {
    elevenLabsVoiceId: VOICES.charlie,
    elevenLabsSettings: { stability: 0.38, style: 0.45 },
    pitch: 0.99, rate: 1.05, language: 'en-IE',
    voice: 'com.apple.voice.enhanced.en-IE.Moira',
  },

  // Aria — operatic, expressive, confident
  aria: {
    elevenLabsVoiceId: VOICES.matilda,
    elevenLabsSettings: { stability: 0.42, style: 0.50 },
    pitch: 1.02, rate: 1.0, language: 'en-ZA',
    voice: 'com.apple.voice.enhanced.en-ZA.Tessa',
  },

  // Tempo — precise, energetic, upbeat
  tempo: {
    elevenLabsVoiceId: VOICES.liam,
    elevenLabsSettings: { stability: 0.35, style: 0.40 },
    pitch: 1.0, rate: 1.12, language: 'en-US',
    voice: 'com.apple.voice.enhanced.en-US.Tom',
  },

  // Shibu — zen, calm, meditative pace
  shibu: {
    elevenLabsVoiceId: VOICES.river,
    elevenLabsSettings: { stability: 0.60, style: 0.20 },
    pitch: 0.97, rate: 0.92, language: 'en-IN',
    voice: 'com.apple.voice.enhanced.en-IN.Rishi',
  },

  // Bella — regal Persian, poised and graceful
  bella: {
    elevenLabsVoiceId: VOICES.alice,
    elevenLabsSettings: { stability: 0.50, style: 0.35 },
    pitch: 1.01, rate: 0.96, language: 'en-GB',
    voice: 'com.apple.voice.enhanced.en-GB.Kate',
  },

  // Sable — mysterious, cool, slightly reserved
  sable: {
    elevenLabsVoiceId: VOICES.callum,
    elevenLabsSettings: { stability: 0.48, style: 0.40 },
    pitch: 0.98, rate: 0.98, language: 'en-SC',
    voice: 'com.apple.voice.enhanced.en-GB.Fiona',
  },

  // Coda — analytical, precise, clear diction
  coda: {
    elevenLabsVoiceId: VOICES.daniel,
    elevenLabsSettings: { stability: 0.55, style: 0.25 },
    pitch: 0.99, rate: 1.08, language: 'en-IN',
    voice: 'com.apple.voice.enhanced.en-IN.Veena',
  },

  // Chonky Monke — goofy, enthusiastic, big energy
  'chonky-monke': {
    elevenLabsVoiceId: VOICES.harry,
    elevenLabsSettings: { stability: 0.30, style: 0.55 },
    pitch: 0.97, rate: 1.15, language: 'en-GB',
    voice: 'com.apple.voice.enhanced.en-GB.Daniel',
  },

  // Salsa — NPC coach, sassy, confident, direct. Primary voice of the app.
  salsa: {
    elevenLabsVoiceId: VOICES.jessica,
    elevenLabsSettings: { stability: 0.40, style: 0.45 },
    pitch: 1.0, rate: 1.02, language: 'en-IE',
    voice: 'com.apple.voice.enhanced.en-IE.Moira',
  },
};

const DEFAULT_VOICE: CatVoiceSettings = {
  elevenLabsVoiceId: VOICES.sarah,
  pitch: 1.0,
  rate: 1.0,
  language: DEFAULT_LANGUAGE,
};

/** Get voice settings for a specific cat. Falls back to default. */
export function getCatVoiceSettings(catId: string): CatVoiceSettings {
  return CAT_VOICE_MAP[catId] ?? DEFAULT_VOICE;
}

/** Get all available cat IDs with voice settings. */
export function getAvailableCatVoices(): string[] {
  return Object.keys(CAT_VOICE_MAP);
}
