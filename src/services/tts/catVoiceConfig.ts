/**
 * Per-cat voice configuration for TTS
 *
 * Each cat has unique pitch, rate, language, and (on iOS) voice identifier
 * that give it a distinct personality when speaking.
 *
 * Parameter guidelines:
 * - pitch: 0.97-1.03 range (subtle personality, not distortion)
 * - rate: 0.92-1.15 range (energy level variation)
 * - Each cat should use a unique iOS voice to avoid sameness
 *
 * iOS voice IDs: Use enhanced/premium Siri voices for natural speech.
 * Omit `voice` to use system default. expo-speech uses the `voice` property
 * to select a specific voice by identifier.
 */

export interface CatVoiceSettings {
  pitch: number;   // 0.5-2.0 (1.0 = normal)
  rate: number;    // 0.5-2.0 (1.0 = normal)
  language: string; // BCP-47 language tag
  voice?: string;  // Platform voice identifier (iOS: com.apple.voice.*)
}

const CAT_VOICE_MAP: Record<string, CatVoiceSettings> = {
  // Mini Meowww — friendly beginner companion, warm and approachable
  'mini-meowww': { pitch: 1.01, rate: 1.0, language: 'en-US', voice: 'com.apple.voice.enhanced.en-US.Samantha' },

  // Jazzy — smooth, laid-back, cool jazz energy
  jazzy: { pitch: 0.98, rate: 0.95, language: 'en-US', voice: 'com.apple.voice.enhanced.en-US.Nicky' },

  // Luna — mystical, calm, slightly ethereal
  luna: { pitch: 1.02, rate: 0.93, language: 'en-AU', voice: 'com.apple.voice.enhanced.en-AU.Karen' },

  // Biscuit — gentle, sweet, encouraging
  biscuit: { pitch: 1.03, rate: 0.97, language: 'en-US', voice: 'com.apple.voice.enhanced.en-US.Allison' },

  // Ballymakawww — Irish folk cat, lively and warm
  ballymakawww: { pitch: 0.99, rate: 1.05, language: 'en-IE', voice: 'com.apple.voice.enhanced.en-IE.Moira' },

  // Aria — operatic, expressive, confident
  aria: { pitch: 1.02, rate: 1.0, language: 'en-ZA', voice: 'com.apple.voice.enhanced.en-ZA.Tessa' },

  // Tempo — precise, energetic, upbeat
  tempo: { pitch: 1.0, rate: 1.12, language: 'en-US', voice: 'com.apple.voice.enhanced.en-US.Tom' },

  // Shibu — zen, calm, meditative pace
  shibu: { pitch: 0.97, rate: 0.92, language: 'en-IN', voice: 'com.apple.voice.enhanced.en-IN.Rishi' },

  // Bella — regal Persian, poised and graceful
  bella: { pitch: 1.01, rate: 0.96, language: 'en-GB', voice: 'com.apple.voice.enhanced.en-GB.Kate' },

  // Sable — mysterious, cool, slightly reserved
  sable: { pitch: 0.98, rate: 0.98, language: 'en-SC', voice: 'com.apple.voice.enhanced.en-GB.Fiona' },

  // Coda — analytical, precise, clear diction
  coda: { pitch: 0.99, rate: 1.08, language: 'en-IN', voice: 'com.apple.voice.enhanced.en-IN.Veena' },

  // Chonky Monke — goofy, enthusiastic, big energy
  'chonky-monke': { pitch: 0.97, rate: 1.15, language: 'en-GB', voice: 'com.apple.voice.enhanced.en-GB.Daniel' },

  // Salsa — NPC coach, sassy, confident, steady
  salsa: { pitch: 1.0, rate: 1.02, language: 'en-US', voice: 'com.apple.voice.enhanced.en-US.Ava' },
};

const DEFAULT_VOICE: CatVoiceSettings = {
  pitch: 1.0,
  rate: 1.0,
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
