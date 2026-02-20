/**
 * Per-cat voice configuration for TTS
 *
 * Each cat has unique pitch, rate, and language settings
 * that give it a distinct personality when speaking.
 */

export interface CatVoiceSettings {
  pitch: number;   // 0.5-2.0 (1.0 = normal)
  rate: number;    // 0.5-2.0 (1.0 = normal)
  language: string; // BCP-47 language tag
}

const CAT_VOICE_MAP: Record<string, CatVoiceSettings> = {
  // Mini Meowww — friendly beginner companion, warm and clear
  'mini-meowww': { pitch: 1.1, rate: 0.9, language: 'en-US' },

  // Jazzy — smooth, laid-back, slightly deeper voice
  jazzy: { pitch: 0.85, rate: 0.85, language: 'en-US' },

  // Luna — mystical, slightly ethereal higher pitch
  luna: { pitch: 1.2, rate: 0.95, language: 'en-US' },

  // Chonky — goofy, enthusiastic, faster pace
  chonky: { pitch: 0.95, rate: 1.05, language: 'en-US' },

  // Professor Whiskers — dignified, measured, clear
  'professor-whiskers': { pitch: 0.9, rate: 0.85, language: 'en-GB' },

  // Neko — energetic, bright, slightly faster
  neko: { pitch: 1.15, rate: 1.0, language: 'en-US' },

  // Salsa — sassy, confident, medium pace
  salsa: { pitch: 1.05, rate: 0.95, language: 'en-US' },

  // Mochi — cute, gentle, softer delivery
  mochi: { pitch: 1.25, rate: 0.9, language: 'en-US' },
};

const DEFAULT_VOICE: CatVoiceSettings = {
  pitch: 1.0,
  rate: 0.95,
  language: 'en-US',
};

/** Get voice settings for a specific cat. Falls back to default. */
export function getCatVoiceSettings(catId: string): CatVoiceSettings {
  return CAT_VOICE_MAP[catId] ?? DEFAULT_VOICE;
}

/** Get all available cat IDs with voice settings. */
export function getAvailableCatVoices(): string[] {
  return Object.keys(CAT_VOICE_MAP);
}
