/**
 * Skill Assessment Screen
 * A 5-round mini-exercise during onboarding that calibrates the learner profile
 * and determines which lesson to start at.
 *
 * State machine: INTRO -> COUNT_IN -> PLAYING -> RESULT -> ... -> COMPLETE
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Button } from '../components/common';
import { VerticalPianoRoll, deriveMidiRange } from '../components/PianoRoll/VerticalPianoRoll';
import { Keyboard } from '../components/Keyboard/Keyboard';
import { computeZoomedRange } from '../components/Keyboard/computeZoomedRange';
import { MascotBubble } from '../components/Mascot/MascotBubble';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createAudioEngine, ensureAudioModeConfigured } from '../audio/createAudioEngine';
import type { NoteHandle } from '../audio/types';
import { getRandomCatMessage } from '../content/catDialogue';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';
import type { NoteEvent, MidiNoteEvent } from '../core/exercises/types';
import { InputManager, type ActiveInputMethod } from '../input/InputManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssessmentPhase = 'intro' | 'countIn' | 'playing' | 'result' | 'complete';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AssessmentRound {
  id: number;
  title: string;
  description: string;
  tempo: number;
  notes: NoteEvent[];
}

interface PlayedNote {
  note: number;
  timestamp: number;
}

export interface SkillCheckCapturedNote {
  note: number;
  noteOnTimestamp: number;
  noteOffTimestamp: number | null;
  durationMs: number;
}

interface PressReleaseScoringConfig {
  timingToleranceMs?: number;
  timingGracePeriodMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSESSMENT_COUNT_IN_BEATS = 4;
const ASSESSMENT_TIMING_TOLERANCE_MS = 75;
const ASSESSMENT_TIMING_GRACE_MS = 220;

// ---------------------------------------------------------------------------
// Round Data
// ---------------------------------------------------------------------------

export const ASSESSMENT_ROUNDS: AssessmentRound[] = [
  {
    id: 1,
    title: 'Simple Notes',
    description: 'Play these four notes',
    tempo: 60,
    notes: [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 62, startBeat: 1, durationBeats: 1 },
      { note: 64, startBeat: 2, durationBeats: 1 },
      { note: 60, startBeat: 3, durationBeats: 1 },
    ],
  },
  {
    id: 2,
    title: 'Melodic Pairs',
    description: 'Play these note pairs',
    tempo: 70,
    notes: [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 64, startBeat: 1, durationBeats: 1 },
      { note: 62, startBeat: 2, durationBeats: 1 },
      { note: 65, startBeat: 3, durationBeats: 1 },
    ],
  },
  {
    id: 3,
    title: 'First Chord',
    description: 'Play all three notes together',
    tempo: 60,
    notes: [
      { note: 60, startBeat: 0, durationBeats: 2 },
      { note: 64, startBeat: 0, durationBeats: 2 },
      { note: 67, startBeat: 0, durationBeats: 2 },
    ],
  },
  {
    id: 4,
    title: 'Sharp Notes',
    description: 'Watch for the black key!',
    tempo: 80,
    notes: [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 62, startBeat: 1, durationBeats: 1 },
      { note: 66, startBeat: 2, durationBeats: 1 },
      { note: 67, startBeat: 3, durationBeats: 1 },
    ],
  },
  {
    id: 5,
    title: 'Syncopation',
    description: 'Tricky timing!',
    tempo: 90,
    notes: [
      { note: 60, startBeat: 0, durationBeats: 0.5 },
      { note: 64, startBeat: 0.5, durationBeats: 0.5 },
      { note: 67, startBeat: 1, durationBeats: 1 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Cat Encouragement (uses the full dialogue system)
// ---------------------------------------------------------------------------

function getCatMessageForScore(catId: string, score: number): string {
  const trigger = score >= 0.6 ? 'exercise_complete_pass' : 'exercise_complete_fail';
  const condition = score >= 0.9 ? 'score_high' : score < 0.6 ? 'score_low' : undefined;
  return getRandomCatMessage(catId, trigger, condition);
}

function getCatMood(score: number): 'celebrating' | 'encouraging' | 'happy' {
  if (score >= 0.9) return 'celebrating';
  if (score >= 0.6) return 'encouraging';
  return 'happy';
}

// ---------------------------------------------------------------------------
// Pure Logic Functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Backward-compatible round score based on note-on events only.
 * Returns a score between 0 and 1.
 */
export function scoreRound(
  expectedNotes: NoteEvent[],
  playedNotes: PlayedNote[],
  tempo: number,
  roundStartTime: number,
): number {
  if (expectedNotes.length === 0) return 0;

  const msPerBeat = 60000 / tempo;
  let correctPitches = 0;
  let totalTimingScore = 0;
  let matchedCount = 0;

  const consumedPlayedIndices = new Set<number>();

  for (const expected of expectedNotes) {
    const expectedTimeMs = expected.startBeat * msPerBeat;

    let bestMatchIndex = -1;
    let bestTimingOffset = Infinity;

    for (let i = 0; i < playedNotes.length; i++) {
      if (consumedPlayedIndices.has(i)) continue;

      const played = playedNotes[i];
      if (played.note === expected.note) {
        const playedTimeMs = played.timestamp - roundStartTime;
        const offset = Math.abs(playedTimeMs - expectedTimeMs);
        if (offset < bestTimingOffset) {
          bestTimingOffset = offset;
          bestMatchIndex = i;
        }
      }
    }

    if (bestMatchIndex >= 0) {
      consumedPlayedIndices.add(bestMatchIndex);
      correctPitches++;
      matchedCount++;
      const timingScore = Math.max(0, 1 - bestTimingOffset / 500);
      totalTimingScore += timingScore;
    }
  }

  const pitchScore = correctPitches / expectedNotes.length;
  const avgTimingScore = matchedCount > 0 ? totalTimingScore / matchedCount : 0;

  return pitchScore * 0.6 + avgTimingScore * 0.4;
}

export function calculateTimingScore01(
  offsetMs: number,
  toleranceMs: number,
  gracePeriodMs: number,
): number {
  const absOffset = Math.abs(offsetMs);

  if (absOffset <= toleranceMs) {
    return 1;
  }

  if (absOffset <= gracePeriodMs) {
    const t = (absOffset - toleranceMs) / Math.max(1, gracePeriodMs - toleranceMs);
    return 1 - t * 0.5;
  }

  if (absOffset <= gracePeriodMs * 2) {
    const t = (absOffset - gracePeriodMs) / Math.max(1, gracePeriodMs);
    return Math.max(0, 0.5 * (1 - t));
  }

  return 0;
}

/**
 * Score each expected note on pitch, press timing, and release timing.
 * Output remains normalized to 0..1 for existing placement logic.
 */
export function scoreRoundPressRelease(
  expectedNotes: NoteEvent[],
  playedNotes: SkillCheckCapturedNote[],
  tempo: number,
  beatZeroEpochMs: number,
  config: PressReleaseScoringConfig = {},
): number {
  if (expectedNotes.length === 0) return 0;

  const toleranceMs = config.timingToleranceMs ?? ASSESSMENT_TIMING_TOLERANCE_MS;
  const gracePeriodMs = config.timingGracePeriodMs ?? ASSESSMENT_TIMING_GRACE_MS;
  const msPerBeat = 60000 / tempo;

  const sortedExpected = [...expectedNotes].sort((a, b) => a.startBeat - b.startBeat);
  const consumedPlayed = new Set<number>();
  let aggregateScore = 0;

  for (const expected of sortedExpected) {
    const expectedPress = beatZeroEpochMs + expected.startBeat * msPerBeat;
    const expectedRelease = expectedPress + expected.durationBeats * msPerBeat;

    let bestIndex = -1;
    let bestPressDistance = Infinity;

    for (let i = 0; i < playedNotes.length; i++) {
      if (consumedPlayed.has(i)) continue;
      const played = playedNotes[i];
      if (played.note !== expected.note) continue;
      const pressDistance = Math.abs(played.noteOnTimestamp - expectedPress);
      if (pressDistance < bestPressDistance) {
        bestPressDistance = pressDistance;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      for (let i = 0; i < playedNotes.length; i++) {
        if (consumedPlayed.has(i)) continue;
        const played = playedNotes[i];
        const pressDistance = Math.abs(played.noteOnTimestamp - expectedPress);
        if (pressDistance < bestPressDistance) {
          bestPressDistance = pressDistance;
          bestIndex = i;
        }
      }
    }

    if (bestIndex < 0) {
      continue;
    }

    consumedPlayed.add(bestIndex);
    const played = playedNotes[bestIndex];

    const pitchScore = played.note === expected.note ? 1 : 0;
    const pressScore = calculateTimingScore01(
      played.noteOnTimestamp - expectedPress,
      toleranceMs,
      gracePeriodMs,
    );

    const releaseScore = played.noteOffTimestamp == null
      ? 0
      : calculateTimingScore01(
          played.noteOffTimestamp - expectedRelease,
          toleranceMs,
          gracePeriodMs,
        );

    const noteScore =
      pitchScore * 0.5 +
      pressScore * 0.25 +
      releaseScore * 0.25;

    aggregateScore += noteScore;
  }

  return Math.max(0, Math.min(1, aggregateScore / sortedExpected.length));
}

/**
 * Determine which lesson to start at based on round scores.
 */
export function determineStartLesson(roundScores: number[]): string {
  const allPerfect = roundScores.every((s) => s >= 0.9);
  const first3Perfect = roundScores.slice(0, 3).every((s) => s >= 0.9);
  const first2Perfect = roundScores.slice(0, 2).every((s) => s >= 0.9);

  if (allPerfect) return 'post-curriculum';
  if (first3Perfect) return 'lesson-05';
  if (first2Perfect) return 'lesson-03';

  const firstFail = roundScores.findIndex((s) => s < 0.6);
  if (firstFail <= 0) return 'lesson-01';
  if (firstFail <= 1) return 'lesson-02';
  if (firstFail <= 2) return 'lesson-03';
  return 'lesson-04';
}

// ---------------------------------------------------------------------------
// Screen Component
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function SkillAssessmentScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();
  const catId = useSettingsStore((s) => s.selectedCatId) || 'mini-meowww';
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);

  const [phase, setPhase] = useState<AssessmentPhase>('intro');
  const phaseRef = useRef<AssessmentPhase>('intro');
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [startLesson, setStartLesson] = useState('lesson-01');

  const capturedNotesRef = useRef<SkillCheckCapturedNote[]>([]);
  const activeCapturedByNoteRef = useRef<Map<number, number[]>>(new Map());

  const roundStartEpochRef = useRef(0);
  const beatZeroEpochRef = useRef(0);
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Prevents double-fire of finishRound from both interval and timeout */
  const roundFinishedRef = useRef(false);
  /** Prevents state updates on unmounted component */
  const mountedRef = useRef(true);

  const audioEngineRef = useRef(createAudioEngine());
  const audioReadyRef = useRef(false);
  const activeNoteHandlesRef = useRef<Map<number, NoteHandle>>(new Map());

  // InputManager for mic/MIDI input support
  const inputManagerRef = useRef<InputManager | null>(null);
  const inputUnsubRef = useRef<(() => void) | null>(null);
  const [activeInputMethod, setActiveInputMethod] = useState<ActiveInputMethod>('touch');
  // Stable refs for InputManager subscription (avoids stale closures)
  const handleNoteOnRef = useRef<(event: MidiNoteEvent) => void>(() => {});
  const handleNoteOffRef = useRef<(note: number) => void>(() => {});

  const currentRound = ASSESSMENT_ROUNDS[currentRoundIndex];

  // Apply playback speed multiplier to round tempo (matches ExercisePlayer behavior)
  const effectiveTempo = currentRound
    ? Math.round(currentRound.tempo * playbackSpeed)
    : 60;

  // Sync phaseRef immediately on state change (useEffect runs after render,
  // which is too late for interval callbacks that check phaseRef.current)
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Helper that updates both state and ref synchronously to prevent stale reads
  const setPhaseSync = useCallback((newPhase: AssessmentPhase) => {
    phaseRef.current = newPhase;
    if (mountedRef.current) {
      setPhase(newPhase);
    }
  }, []);

  const clearRoundTimers = useCallback(() => {
    if (beatIntervalRef.current) {
      clearInterval(beatIntervalRef.current);
      beatIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const releaseAllAudioNotes = useCallback(() => {
    try {
      audioEngineRef.current.releaseAllNotes();
    } catch {
      // Audio cleanup is best-effort.
    }
    activeNoteHandlesRef.current.clear();
  }, []);

  const closeCapturedNote = useCallback((note: number, noteOffTimestamp: number) => {
    const noteStack = activeCapturedByNoteRef.current.get(note);
    if (!noteStack || noteStack.length === 0) return;

    const noteIndex = noteStack.pop()!;
    if (noteStack.length === 0) {
      activeCapturedByNoteRef.current.delete(note);
    }

    const captured = capturedNotesRef.current[noteIndex];
    if (!captured || captured.noteOffTimestamp != null) return;

    captured.noteOffTimestamp = noteOffTimestamp;
    captured.durationMs = Math.max(0, noteOffTimestamp - captured.noteOnTimestamp);
  }, []);

  const closeAllCapturedNotes = useCallback((noteOffTimestamp: number) => {
    for (const [note, stack] of activeCapturedByNoteRef.current.entries()) {
      while (stack.length > 0) {
        closeCapturedNote(note, noteOffTimestamp);
      }
    }
    activeCapturedByNoteRef.current.clear();
  }, [closeCapturedNote]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Read preferred input from store (avoid adding to deps)
      const preferredInput = useSettingsStore.getState().preferredInputMethod ?? 'auto';
      const needsMic = preferredInput === 'mic' || preferredInput === 'auto';

      // 1. Configure audio mode (with recording if mic may be used)
      try {
        await ensureAudioModeConfigured(needsMic);
        if (!audioEngineRef.current.isReady()) {
          await audioEngineRef.current.initialize();
        }
        if (mounted) {
          audioReadyRef.current = true;
        }
      } catch (error) {
        console.warn('[SkillAssessment] Audio init failed. Continuing without sound.', error);
        if (mounted) {
          audioReadyRef.current = false;
        }
      }

      if (!mounted) return;

      // 2. Initialize InputManager for mic/MIDI support
      try {
        const manager = new InputManager({ preferred: preferredInput });
        inputManagerRef.current = manager;
        await manager.initialize();

        if (!mounted) {
          manager.dispose();
          inputManagerRef.current = null;
          return;
        }

        setActiveInputMethod(manager.activeMethod);

        // Subscribe to non-touch events (keyboard component handles touch)
        if (manager.activeMethod !== 'touch') {
          inputUnsubRef.current = manager.onNoteEvent((event) => {
            if (event.type === 'noteOn') {
              handleNoteOnRef.current(event);
            } else if (event.type === 'noteOff') {
              handleNoteOffRef.current(event.note);
            }
          });
        }
      } catch (e) {
        console.warn('[SkillAssessment] InputManager init failed:', e);
      }
    };

    init();

    return () => {
      mounted = false;
      mountedRef.current = false;
      clearRoundTimers();
      closeAllCapturedNotes(Date.now());
      releaseAllAudioNotes();
      inputUnsubRef.current?.();
      inputUnsubRef.current = null;
      inputManagerRef.current?.dispose();
      inputManagerRef.current = null;
    };
  }, [clearRoundTimers, closeAllCapturedNotes, releaseAllAudioNotes]);

  const playAudioNote = useCallback((note: number, velocity: number = 0.8) => {
    if (!audioReadyRef.current) return;

    try {
      const existingHandle = activeNoteHandlesRef.current.get(note);
      if (existingHandle) {
        audioEngineRef.current.releaseNote(existingHandle);
      }

      const handle = audioEngineRef.current.playNote(note, velocity);
      activeNoteHandlesRef.current.set(note, handle);
    } catch (error) {
      console.warn('[SkillAssessment] Failed to play note:', error);
    }
  }, []);

  const releaseAudioNote = useCallback((note: number) => {
    if (!audioReadyRef.current) return;

    const handle = activeNoteHandlesRef.current.get(note);
    if (!handle) return;

    try {
      audioEngineRef.current.releaseNote(handle);
      activeNoteHandlesRef.current.delete(note);
    } catch {
      activeNoteHandlesRef.current.delete(note);
    }
  }, []);

  const finishRound = useCallback(() => {
    // Guard: only finish once per round (prevents double-fire from interval + timeout)
    if (roundFinishedRef.current) return;
    if (phaseRef.current !== 'countIn' && phaseRef.current !== 'playing') {
      return;
    }

    roundFinishedRef.current = true;
    clearRoundTimers();
    closeAllCapturedNotes(Date.now());
    releaseAllAudioNotes();
    // Stop mic/MIDI listening
    inputManagerRef.current?.stop();

    const round = ASSESSMENT_ROUNDS[currentRoundIndex];
    if (!round) return;

    const score = scoreRoundPressRelease(
      round.notes,
      capturedNotesRef.current,
      effectiveTempo,
      beatZeroEpochRef.current,
      {
        timingToleranceMs: ASSESSMENT_TIMING_TOLERANCE_MS,
        timingGracePeriodMs: ASSESSMENT_TIMING_GRACE_MS,
      },
    );

    if (mountedRef.current) {
      setCurrentScore(score);
      setRoundScores((prev) => [...prev, score]);
      setPhaseSync('result');
    }
  }, [clearRoundTimers, closeAllCapturedNotes, releaseAllAudioNotes, currentRoundIndex, effectiveTempo, setPhaseSync]);

  const startRound = useCallback(() => {
    if (!currentRound) return;

    clearRoundTimers();
    releaseAllAudioNotes();

    // Reset the double-fire guard for the new round
    roundFinishedRef.current = false;

    capturedNotesRef.current = [];
    activeCapturedByNoteRef.current.clear();

    const msPerBeat = 60000 / effectiveTempo;
    const maxBeat = Math.max(...currentRound.notes.map((n) => n.startBeat + n.durationBeats));

    roundStartEpochRef.current = Date.now();
    beatZeroEpochRef.current = roundStartEpochRef.current + ASSESSMENT_COUNT_IN_BEATS * msPerBeat;

    setCurrentBeat(-ASSESSMENT_COUNT_IN_BEATS);
    setPhaseSync('countIn');

    // Start mic/MIDI listening for this round
    inputManagerRef.current?.start();

    beatIntervalRef.current = setInterval(() => {
      // Guard: stop processing if round already finished or component unmounted
      if (roundFinishedRef.current || !mountedRef.current) {
        return;
      }
      // Guard: only update during active phases
      if (phaseRef.current !== 'countIn' && phaseRef.current !== 'playing') {
        return;
      }

      const elapsed = Date.now() - roundStartEpochRef.current;
      const beat = elapsed / msPerBeat - ASSESSMENT_COUNT_IN_BEATS;
      setCurrentBeat(beat);

      if (beat >= 0 && phaseRef.current === 'countIn') {
        setPhaseSync('playing');
      }

      if (beat >= maxBeat + 2) {
        finishRound();
      }
    }, 50);

    const totalDurationMs = (ASSESSMENT_COUNT_IN_BEATS + maxBeat + 2) * msPerBeat;
    timeoutRef.current = setTimeout(() => {
      finishRound();
    }, totalDurationMs + 500);
  }, [currentRound, effectiveTempo, clearRoundTimers, finishRound, releaseAllAudioNotes, setPhaseSync]);

  const handleNoteOn = useCallback((event: MidiNoteEvent) => {
    playAudioNote(event.note, event.velocity / 127);

    if (phaseRef.current !== 'countIn' && phaseRef.current !== 'playing') {
      return;
    }

    if (event.timestamp < beatZeroEpochRef.current) {
      return;
    }

    const noteIndex = capturedNotesRef.current.length;
    capturedNotesRef.current.push({
      note: event.note,
      noteOnTimestamp: event.timestamp,
      noteOffTimestamp: null,
      durationMs: 0,
    });

    const stack = activeCapturedByNoteRef.current.get(event.note) ?? [];
    stack.push(noteIndex);
    activeCapturedByNoteRef.current.set(event.note, stack);
  }, [playAudioNote]);

  const handleNoteOff = useCallback((note: number) => {
    releaseAudioNote(note);

    if (phaseRef.current !== 'countIn' && phaseRef.current !== 'playing') {
      return;
    }

    const timestamp = Date.now();
    if (timestamp < beatZeroEpochRef.current) {
      return;
    }

    closeCapturedNote(note, timestamp);
  }, [closeCapturedNote, releaseAudioNote]);

  // Keep refs in sync for InputManager subscription
  handleNoteOnRef.current = handleNoteOn;
  handleNoteOffRef.current = handleNoteOff;

  const handleNextRound = useCallback(() => {
    if (currentRoundIndex + 1 >= ASSESSMENT_ROUNDS.length) {
      const allScores =
        roundScores.length >= ASSESSMENT_ROUNDS.length
          ? roundScores.slice(0, ASSESSMENT_ROUNDS.length)
          : [...roundScores, currentScore];

      const lesson = determineStartLesson(allScores);
      setStartLesson(lesson);

      const profileStore = useLearnerProfileStore.getState();
      const progressStore = useProgressStore.getState();

      let totalPitchScore = 0;
      let totalTimingScore = 0;

      for (let i = 0; i < ASSESSMENT_ROUNDS.length; i++) {
        const round = ASSESSMENT_ROUNDS[i];
        const score = allScores[i] ?? 0;
        const noteResults = round.notes.map((n) => ({
          midiNote: n.note,
          accuracy: score,
        }));
        profileStore.recordExerciseResult({
          tempo: Math.round(round.tempo * playbackSpeed),
          score,
          noteResults,
        });

        totalPitchScore += Math.min(1, score / 0.6) * 0.6;
        totalTimingScore += Math.min(1, score / 0.4) * 0.4;
      }

      const avgPitchScore = totalPitchScore / ASSESSMENT_ROUNDS.length;
      const avgTimingScore = totalTimingScore / ASSESSMENT_ROUNDS.length;
      profileStore.updateSkill('pitchAccuracy', avgPitchScore);
      profileStore.updateSkill('timingAccuracy', avgTimingScore);

      const avgScore = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;
      useLearnerProfileStore.setState({
        lastAssessmentDate: new Date().toISOString().split('T')[0],
        assessmentScore: Math.round(avgScore * 100),
      });

      const lessonNumber = parseInt(lesson.replace('lesson-', ''), 10);
      if (!isNaN(lessonNumber) && lessonNumber > 1) {
        for (let i = 1; i < lessonNumber; i++) {
          const lessonId = `lesson-${String(i).padStart(2, '0')}`;
          progressStore.updateLessonProgress(lessonId, {
            lessonId,
            status: 'completed',
            exerciseScores: {},
            bestScore: 100,
            completedAt: Date.now(),
            totalAttempts: 0,
            totalTimeSpentSeconds: 0,
          });
        }
      }

      // Seed mastered skills based on assessment performance.
      // 80%+ average → mark foundational skills as mastered so
      // DailySession starts at an appropriate difficulty.
      if (avgScore >= 0.8) {
        const earlySkills = ['find-middle-c', 'keyboard-geography', 'white-keys'];
        for (const skillId of earlySkills) {
          profileStore.markSkillMastered(skillId);
        }
      }
      if (avgScore >= 0.6) {
        profileStore.markSkillMastered('find-middle-c');
      }

      setPhaseSync('complete');
    } else {
      setCurrentRoundIndex((prev) => prev + 1);
      setCurrentBeat(0);
      setPhaseSync('intro');
    }
  }, [currentRoundIndex, roundScores, currentScore, playbackSpeed, setPhaseSync]);

  const handleContinue = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const focusNote = useMemo(() => {
    if (!currentRound || currentRound.notes.length === 0) return undefined;
    const notes = currentRound.notes.map((n) => n.note);
    return Math.round(notes.reduce((a, b) => a + b, 0) / notes.length);
  }, [currentRound]);

  // MIDI range for the VerticalPianoRoll display
  const pianoRollRange = useMemo(() => {
    if (!currentRound) return { min: 48, max: 72, range: 24 };
    return deriveMidiRange(currentRound.notes);
  }, [currentRound]);

  const keyboardRange = useMemo(() => {
    if (!currentRound || currentRound.notes.length === 0) {
      return { startNote: 48, octaveCount: 2 };
    }

    const noteValues = currentRound.notes.map((n) => n.note);
    const uniqueNotes = Array.from(new Set(noteValues));
    // Use note SPAN to determine octave count, not note count.
    // Most assessment rounds span less than an octave — 2 octaves gives
    // plenty of room while keeping keys large enough to tap accurately.
    const span = Math.max(...uniqueNotes) - Math.min(...uniqueNotes);
    const octaveCount = span > 12 ? 2 : 2; // Always 2 octaves for assessment
    return computeZoomedRange(uniqueNotes, octaveCount);
  }, [currentRound]);

  // Freeze notes during countdown — they stay still until playing begins.
  // Use -0.5 so beat-0 notes sit just above the hit line as a clear target.
  // Once playing starts, switch to live currentBeat so notes scroll normally.
  const skillCheckBeat = phase === 'countIn' ? -0.5 : currentBeat;
  const countdownValue = Math.max(1, Math.ceil(-currentBeat));

  const renderIntro = () => (
    <View style={styles.centeredContent} testID="assessment-intro">
      <View style={styles.roundBadge}>
        <Text style={styles.roundBadgeText}>
          Round {currentRoundIndex + 1} of {ASSESSMENT_ROUNDS.length}
        </Text>
      </View>

      <Text style={styles.title}>{currentRound.title}</Text>
      <Text style={styles.description}>{currentRound.description}</Text>

      <View style={styles.tempoInfo}>
        <Text style={styles.tempoLabel}>Tempo: {effectiveTempo} BPM{playbackSpeed < 1.0 ? ` (${playbackSpeed}x)` : ''}</Text>
      </View>

      <MascotBubble
        mood="encouraging"
        message={getRandomCatMessage(catId, 'exercise_start')}
        size="medium"
      />

      <Button
        title="Start"
        onPress={startRound}
        size="large"
        style={styles.actionButton}
        testID="assessment-start-round"
      />
    </View>
  );

  const renderPlaying = () => {
    // Compute keyboard props: use non-scrollable when keys fit on screen
    const whiteKeyCount = Math.round(keyboardRange.octaveCount * 7);
    const screenW = SCREEN_WIDTH;
    const fitsOnScreen = whiteKeyCount * 56 <= screenW; // 56px min white key width

    return (
      <View style={styles.playingContainer} testID="assessment-playing">
        <View style={styles.roundHeader}>
          <View style={styles.roundHeaderRow}>
            <Text style={styles.roundHeaderText}>
              Round {currentRoundIndex + 1} of {ASSESSMENT_ROUNDS.length}
            </Text>
            {activeInputMethod !== 'touch' && (
              <View style={styles.inputBadge}>
                <Text style={styles.inputBadgeText}>
                  {activeInputMethod === 'mic' ? 'Mic' : 'MIDI'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.roundTitle}>{currentRound.title}</Text>
        </View>

        <View style={styles.pianoRollContainer}>
          <VerticalPianoRoll
            notes={currentRound.notes}
            currentBeat={skillCheckBeat}
            tempo={effectiveTempo}
            containerWidth={screenW - SPACING.sm * 2}
            containerHeight={250}
            midiMin={pianoRollRange.min}
            midiMax={pianoRollRange.max}
            timingGracePeriodMs={ASSESSMENT_TIMING_GRACE_MS}
            testID="assessment-piano-roll"
          />

          {phase === 'countIn' && (
            <View style={styles.countInOverlay} testID="assessment-countin">
              <Text style={styles.countInLabel}>Get Ready</Text>
              <Text style={styles.countInValue} testID="assessment-countin-value">{countdownValue}</Text>
            </View>
          )}
        </View>

        <View style={styles.keyboardContainer}>
          <Keyboard
            startNote={keyboardRange.startNote}
            octaveCount={keyboardRange.octaveCount}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            expectedNotes={undefined}
            enabled={true}
            showLabels={true}
            scrollable={!fitsOnScreen}
            scrollEnabled={false}
            focusNote={focusNote}
            keyHeight={120}
            testID="assessment-keyboard"
          />
        </View>
      </View>
    );
  };

  const renderResult = () => {
    const percentage = Math.round(currentScore * 100);
    const passed = currentScore >= 0.6;

    return (
      <View style={styles.centeredContent} testID="assessment-result">
        <View style={styles.roundBadge}>
          <Text style={styles.roundBadgeText}>
            Round {currentRoundIndex + 1} of {ASSESSMENT_ROUNDS.length}
          </Text>
        </View>

        <View style={[styles.scoreCircle, passed ? styles.scoreCirclePassed : styles.scoreCircleFailed]}>
          <Text style={styles.scoreText}>{percentage}%</Text>
        </View>

        <Text style={styles.resultLabel}>
          {passed ? 'Passed' : 'Not Quite'}
        </Text>

        <MascotBubble
          mood={getCatMood(currentScore)}
          message={getCatMessageForScore(catId, currentScore)}
          size="medium"
        />

        <Button
          title={
            currentRoundIndex + 1 >= ASSESSMENT_ROUNDS.length
              ? 'See Results'
              : 'Next Round'
          }
          onPress={handleNextRound}
          size="large"
          style={styles.actionButton}
          testID="assessment-next-round"
        />
      </View>
    );
  };

  const renderComplete = () => {
    const avgScore =
      roundScores.length > 0
        ? roundScores.reduce((a, b) => a + b, 0) / roundScores.length
        : 0;
    const percentage = Math.round(avgScore * 100);

    const lessonLabel =
      startLesson === 'post-curriculum'
        ? 'Advanced Exercises'
        : `Lesson ${parseInt(startLesson.replace('lesson-', ''), 10)}`;

    return (
      <View style={styles.centeredContent} testID="assessment-complete">
        <Text style={styles.completeTitle}>Assessment Complete!</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Overall Score</Text>
          <Text style={styles.summaryScore}>{percentage}%</Text>

          <View style={styles.roundScoresRow}>
            {roundScores.map((score, index) => (
              <View key={index} style={styles.roundScoreItem}>
                <Text style={styles.roundScoreLabel}>R{index + 1}</Text>
                <View
                  style={[
                    styles.roundScoreDot,
                    score >= 0.6
                      ? styles.roundScoreDotPass
                      : styles.roundScoreDotFail,
                  ]}
                >
                  <Text style={styles.roundScoreDotText}>
                    {Math.round(score * 100)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.startingAtCard}>
          <Text style={styles.startingAtLabel}>Starting at</Text>
          <Text style={styles.startingAtValue}>{lessonLabel}</Text>
        </View>

        <MascotBubble
          mood="celebrating"
          message={getRandomCatMessage(catId, 'level_up')}
          size="medium"
        />

        <Button
          title="Continue"
          onPress={handleContinue}
          size="large"
          style={styles.actionButton}
          testID="assessment-continue"
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} testID="skill-assessment-screen">
      {phase !== 'complete' && (
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Skill Check</Text>
          <View style={styles.progressDots}>
            {ASSESSMENT_ROUNDS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < currentRoundIndex
                    ? styles.dotCompleted
                    : i === currentRoundIndex
                      ? styles.dotCurrent
                      : styles.dotPending,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {phase === 'intro' && renderIntro()}
      {(phase === 'countIn' || phase === 'playing') && renderPlaying()}
      {phase === 'result' && renderResult()}
      {phase === 'complete' && renderComplete()}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressHeader: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  progressTitle: {
    ...TYPOGRAPHY.heading.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  progressDots: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCompleted: {
    backgroundColor: COLORS.success,
  },
  dotCurrent: {
    backgroundColor: COLORS.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotPending: {
    backgroundColor: COLORS.cardBorder,
  },
  centeredContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  playingContainer: {
    flex: 1,
  },
  roundBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.lg,
  },
  roundBadgeText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  title: {
    ...TYPOGRAPHY.display.md,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  description: {
    ...TYPOGRAPHY.body.lg,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  tempoInfo: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  tempoLabel: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  roundHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  roundHeaderText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roundTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  pianoRollContainer: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    position: 'relative',
    minHeight: 200,
  },
  countInOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.sm,
  },
  countInLabel: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  countInValue: {
    fontSize: 64,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 72,
  },
  keyboardContainer: {
    marginTop: 'auto' as const,
    paddingBottom: SPACING.md,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    marginBottom: SPACING.md,
  },
  scoreCirclePassed: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  scoreCircleFailed: {
    borderColor: COLORS.error,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  scoreText: {
    ...TYPOGRAPHY.display.lg,
    fontSize: 36,
    color: COLORS.textPrimary,
  },
  resultLabel: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  completeTitle: {
    ...TYPOGRAPHY.display.md,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  summaryCard: {
    ...SHADOWS.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: SCREEN_WIDTH - SPACING.lg * 2,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  summaryLabel: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  summaryScore: {
    ...TYPOGRAPHY.special.score,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  roundScoresRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  roundScoreItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  roundScoreLabel: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  roundScoreDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundScoreDotPass: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  roundScoreDotFail: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  roundScoreDotText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  startingAtCard: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  startingAtLabel: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  startingAtValue: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.primary,
  },
  roundHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputBadge: {
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  inputBadgeText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600',
    color: COLORS.primary,
  },
  actionButton: {
    marginTop: SPACING.lg,
    width: '100%',
  },
});

export default SkillAssessmentScreen;
