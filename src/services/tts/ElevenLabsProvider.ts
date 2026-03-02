/**
 * ElevenLabs TTS Provider
 *
 * High-quality neural text-to-speech via ElevenLabs API.
 * Fetches audio as mp3, caches to local filesystem, plays via expo-av.
 * Falls back gracefully when API key is missing or network fails.
 *
 * expo-file-system and expo-av are lazy-loaded to avoid pulling native
 * modules into the module graph at import time (which would force a
 * global Jest mock and break unrelated test suites).
 */

const API_BASE = 'https://api.elevenlabs.io/v1';
const MODEL_ID = 'eleven_turbo_v2_5'; // Fastest model, ~150ms TTFB

/** Voice tuning for expressiveness */
export interface ElevenLabsVoiceSettings {
  stability: number;        // 0-1: lower = more expressive
  similarity_boost: number; // 0-1: higher = closer to original voice
  style: number;           // 0-1: style exaggeration
  use_speaker_boost: boolean;
}

/** Default settings tuned for expressive cat characters */
const DEFAULT_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.45,          // Expressive for character voices
  similarity_boost: 0.78,
  style: 0.35,
  use_speaker_boost: true,
};

// ────────────────────────────────────────────────
// Lazy module loading (avoids global jest mock issues)
// ────────────────────────────────────────────────

type FileSystemModule = typeof import('expo-file-system');
type AudioModule = typeof import('expo-av');

let _FileSystem: FileSystemModule | null = null;
let _Audio: AudioModule['Audio'] | null = null;

function getFileSystem(): FileSystemModule | null {
  if (!_FileSystem) {
    try {
      _FileSystem = require('expo-file-system') as FileSystemModule;
    } catch {
      console.warn('[ElevenLabs] expo-file-system not available');
    }
  }
  return _FileSystem;
}

function getAudio(): AudioModule['Audio'] | null {
  if (!_Audio) {
    try {
      const mod = require('expo-av') as AudioModule;
      _Audio = mod.Audio;
    } catch {
      console.warn('[ElevenLabs] expo-av not available');
    }
  }
  return _Audio;
}

// ────────────────────────────────────────────────
// Cache management
// ────────────────────────────────────────────────

/** Simple string hash for cache keys */
function hashKey(text: string, voiceId: string): string {
  let hash = 0;
  const str = `${voiceId}:${text}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

function getCacheDir(): string {
  const fs = getFileSystem();
  return `${fs?.cacheDirectory ?? '/tmp/'}elevenlabs-tts/`;
}

async function ensureCacheDir(): Promise<void> {
  const fs = getFileSystem();
  if (!fs) return;
  const dir = getCacheDir();
  const info = await fs.getInfoAsync(dir);
  if (!info.exists) {
    await fs.makeDirectoryAsync(dir, { intermediates: true });
  }
}

function getCachePath(text: string, voiceId: string): string {
  return `${getCacheDir()}${hashKey(text, voiceId)}.mp3`;
}

// ────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────

/** Currently playing sound — kept for stop() */
let _currentSound: any = null;

function getApiKey(): string | null {
  try {
    return process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? null;
  } catch {
    return null;
  }
}

/**
 * Speak text using ElevenLabs API.
 *
 * @returns true if speech started successfully, false if failed (caller should fallback)
 */
export async function speakWithElevenLabs(
  text: string,
  voiceId: string,
  options?: {
    voiceSettings?: Partial<ElevenLabsVoiceSettings>;
    onDone?: () => void;
    onError?: (error: Error) => void;
  },
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey || !text.trim()) return false;

  const fs = getFileSystem();
  if (!fs) return false;

  try {
    // Stop any currently playing ElevenLabs audio
    await stopElevenLabs();

    await ensureCacheDir();
    const cachePath = getCachePath(text, voiceId);

    // Check cache first
    const cached = await fs.getInfoAsync(cachePath);
    if (cached.exists) {
      return await playFromFile(cachePath, options?.onDone, options?.onError);
    }

    // Fetch from API
    const settings: ElevenLabsVoiceSettings = {
      ...DEFAULT_VOICE_SETTINGS,
      ...options?.voiceSettings,
    };

    const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: settings,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`[ElevenLabs] API error ${response.status}: ${errorText}`);
      return false;
    }

    // Convert response to base64 and write to cache
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    await fs.writeAsStringAsync(cachePath, base64, {
      encoding: fs.EncodingType.Base64,
    });

    return await playFromFile(cachePath, options?.onDone, options?.onError);
  } catch (error) {
    console.warn('[ElevenLabs] Failed:', (error as Error).message);
    options?.onError?.(error as Error);
    return false;
  }
}

/** Stop currently playing ElevenLabs audio */
export async function stopElevenLabs(): Promise<void> {
  if (_currentSound) {
    try {
      await _currentSound.stopAsync();
      await _currentSound.unloadAsync();
    } catch {
      // Ignore errors on cleanup
    }
    _currentSound = null;
  }
}

/** Check if ElevenLabs is configured (API key present) */
export function isElevenLabsAvailable(): boolean {
  return !!getApiKey();
}

/** Clear the audio cache */
export async function clearElevenLabsCache(): Promise<void> {
  const fs = getFileSystem();
  if (!fs) return;
  try {
    const dir = getCacheDir();
    const info = await fs.getInfoAsync(dir);
    if (info.exists) {
      await fs.deleteAsync(dir, { idempotent: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────

async function playFromFile(
  filePath: string,
  onDone?: () => void,
  onError?: (error: Error) => void,
): Promise<boolean> {
  const AudioMod = getAudio();
  if (!AudioMod) return false;

  try {
    const { sound } = await AudioMod.Sound.createAsync(
      { uri: filePath },
      { shouldPlay: true },
    );
    _currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        _currentSound = null;
        sound.unloadAsync().catch(() => {});
        onDone?.();
      }
    });

    return true;
  } catch (error) {
    console.warn('[ElevenLabs] Playback failed:', (error as Error).message);
    onError?.(error as Error);
    return false;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
