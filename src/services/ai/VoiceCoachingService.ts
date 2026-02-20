/**
 * VoiceCoachingService
 *
 * Enhanced coaching with learner history, cat personality, and specific
 * note/timing error references. Generates both text and emphasis markers
 * for TTS delivery.
 */

import type { ExerciseScore } from '@/core/exercises/types';
import { GeminiCoach, type CoachRequest } from './GeminiCoach';
import type { LearnerProfileData } from '../../stores/learnerProfileStore';
import { getOfflineCoachingText } from '../../content/offlineCoachingTemplates';

// ============================================================================
// Types
// ============================================================================

export interface VoiceCoachingResult {
  text: string;
  emphasis: string[]; // Key phrases to emphasize in TTS
}

export interface VoiceCoachingInput {
  score: ExerciseScore;
  exerciseTitle: string;
  exerciseId: string;
  difficulty: number;
  profile: LearnerProfileData;
  catId: string;
  attemptNumber: number;
  previousScore: number | null;
}

// ============================================================================
// Cat Personality Prompts
// ============================================================================

const CAT_PERSONALITY: Record<string, string> = {
  'mini-meowww': 'warm and encouraging, like a supportive friend',
  jazzy: 'smooth and cool, uses music metaphors, laid-back vibe',
  luna: 'mystical and gentle, uses poetic language, calming',
  chonky: 'goofy and enthusiastic, uses playful language, big energy',
  'professor-whiskers': 'dignified and precise, uses proper musical terminology, distinguished',
  neko: 'bright and energetic, short punchy sentences, cheerful',
  salsa: 'sassy and confident, direct feedback, encouraging but honest',
  mochi: 'sweet and gentle, soft encouraging words, patient',
};

// ============================================================================
// Service
// ============================================================================

/**
 * Generate voice coaching feedback with cat personality and learner context.
 */
export async function generateVoiceCoaching(
  input: VoiceCoachingInput
): Promise<VoiceCoachingResult> {
  try {
    const request = buildEnhancedRequest(input);
    const text = await GeminiCoach.getFeedback(request);
    const emphasis = extractEmphasis(text);
    return { text, emphasis };
  } catch {
    const fallbackText = getOfflineCoachingText(
      input.score.overall,
      input.score.isPassed,
      input.attemptNumber,
      getMainIssue(input.score)
    );
    return { text: fallbackText, emphasis: [] };
  }
}

/**
 * Generate a brief pre-exercise coaching tip.
 */
export async function generatePreExerciseTip(
  profile: LearnerProfileData,
  exerciseTitle: string,
  catId: string
): Promise<string> {
  const personality = CAT_PERSONALITY[catId] ?? CAT_PERSONALITY['mini-meowww'];
  const weakNotesStr = profile.weakNotes.length > 0
    ? `Their weak notes are MIDI ${profile.weakNotes.slice(0, 3).join(', ')}. `
    : '';

  // Use a simplified prompt for pre-exercise tips, enriched with personality and weak notes
  const tipRequest: CoachRequest = {
    exerciseId: 'pre-tip',
    exerciseTitle: `${exerciseTitle} (Coach personality: ${personality}. ${weakNotesStr})`,
    difficulty: 1,
    score: { overall: 0, accuracy: 0, timing: 0, completeness: 0 },
    issues: { pitchErrors: [], timingErrors: [], missedCount: 0, extraCount: 0 },
    context: {
      attemptNumber: 0,
      previousScore: null,
      userLevel: 1,
      sessionMinutes: 0,
    },
  };

  try {
    const text = await GeminiCoach.getFeedback(tipRequest);
    return text;
  } catch {
    // Fallback pre-exercise tips
    const tips = [
      'Take a deep breath and relax your hands before starting.',
      'Focus on accuracy first, speed will come with practice.',
      'Keep your wrists relaxed and fingers curved.',
      'Listen to the metronome and feel the rhythm.',
      'You\'ve got this! Let\'s make some music.',
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function buildEnhancedRequest(input: VoiceCoachingInput): CoachRequest {
  const { score } = input;
  const details = score.details ?? [];

  // Extract specific errors
  const pitchErrors = details
    .filter((d) => !d.isCorrectPitch && !d.isExtraNote && !d.isMissedNote)
    .slice(0, 3)
    .map((d) => ({
      expected: `MIDI ${d.expected.note}`,
      played: d.played ? `MIDI ${d.played.note}` : 'none',
      beatPosition: d.expected.startBeat,
    }));

  const timingErrors = details
    .filter((d) => d.isCorrectPitch && Math.abs(d.timingOffsetMs) > 50)
    .sort((a, b) => Math.abs(b.timingOffsetMs) - Math.abs(a.timingOffsetMs))
    .slice(0, 3)
    .map((d) => ({
      note: `MIDI ${d.expected.note}`,
      offsetMs: d.timingOffsetMs,
      beatPosition: d.expected.startBeat,
    }));

  return {
    exerciseId: input.exerciseId,
    exerciseTitle: input.exerciseTitle,
    difficulty: input.difficulty,
    score: {
      overall: score.overall,
      accuracy: score.breakdown.accuracy,
      timing: score.breakdown.timing,
      completeness: score.breakdown.completeness,
    },
    issues: {
      pitchErrors,
      timingErrors,
      missedCount: score.missedNotes ?? 0,
      extraCount: score.extraNotes ?? 0,
    },
    context: {
      attemptNumber: input.attemptNumber,
      previousScore: input.previousScore,
      userLevel: 1,
      sessionMinutes: 0,
    },
  };
}

function extractEmphasis(text: string): string[] {
  // Extract words/phrases that should be emphasized in TTS
  // Look for specific note names, timing words, and action words
  const patterns = [
    /\b[A-G]#?\d?\b/g,                    // Note names: C4, F#, etc.
    /\b(perfect|great|good|excellent)\b/gi, // Positive words
    /\b(slow|fast|early|late|rush)\b/gi,    // Timing words
    /\b(try|focus|practice|listen)\b/gi,    // Action words
  ];

  const emphasis: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) emphasis.push(...matches);
  }
  return [...new Set(emphasis)];
}

function getMainIssue(score: ExerciseScore): 'timing' | 'pitch' | 'general' {
  const details = score.details ?? [];
  const pitchErrors = details.filter((d) => !d.isCorrectPitch && !d.isMissedNote).length;
  const timingErrors = details.filter(
    (d) => d.isCorrectPitch && Math.abs(d.timingOffsetMs) > 100
  ).length;

  if (timingErrors > pitchErrors) return 'timing';
  if (pitchErrors > 0) return 'pitch';
  return 'general';
}
