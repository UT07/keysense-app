/**
 * PlayScreen - Free play mode with landscape keyboard
 *
 * Features:
 * - Landscape orientation lock (same pattern as ExercisePlayer)
 * - Full-width 3-octave scrollable keyboard
 * - Live note name display (shows what key you're pressing)
 * - Record / playback / clear your performance
 * - Beginner-friendly instruction banner (dismissible)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Keyboard } from '../components/Keyboard/Keyboard';
import { createAudioEngine } from '../audio/createAudioEngine';
import type { NoteHandle } from '../audio/types';
import type { MidiNoteEvent } from '../core/exercises/types';
import { analyzeSession, type FreePlayAnalysis } from '../services/FreePlayAnalyzer';
import type { RootStackParamList } from '../navigation/AppNavigator';

// ============================================================================
// Helpers
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

// ============================================================================
// Types
// ============================================================================

interface RecordedNote {
  note: number;
  velocity: number;
  timestamp: number;
  releaseTimestamp?: number;
}

// Auto-release notes after this duration (ms) — prevents stuck notes when
// onPressOut doesn't fire (e.g., ScrollView steals the gesture)
const NOTE_AUTO_RELEASE_MS = 1500;

// ============================================================================
// Component
// ============================================================================

export function PlayScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);
  const [highlightedNotes, setHighlightedNotes] = useState<Set<number>>(new Set());
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [currentNoteName, setCurrentNoteName] = useState<string>('');
  const [sessionNoteCount, setSessionNoteCount] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [analysis, setAnalysis] = useState<FreePlayAnalysis | null>(null);
  const recordingStartRef = useRef(0);
  const audioEngineRef = useRef(createAudioEngine());
  const activeHandlesRef = useRef<Map<number, NoteHandle>>(new Map());
  const autoReleaseTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const playbackCancelRef = useRef(false);
  const playbackHandlesRef = useRef<Map<number, NoteHandle>>(new Map());
  const playbackTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionNotesRef = useRef<Array<{ note: number; timestamp: number; velocity: number }>>([]);

  // --------------------------------------------------------------------------
  // Landscape orientation lock — same pattern as ExercisePlayer.
  // Now a full-screen stack screen (not a tab), so useEffect cleanup is reliable.
  // --------------------------------------------------------------------------
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT)
      .catch(() => {
        return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      })
      .catch((err) => console.warn('[PlayScreen] Landscape lock failed:', err));

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
        .catch(() => {});
    };
  }, []);

  // --------------------------------------------------------------------------
  // Audio engine initialization
  // --------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    const init = async (): Promise<void> => {
      try {
        await audioEngineRef.current.initialize();
        if (mounted) setIsAudioReady(true);
      } catch {
        console.warn('[PlayScreen] Audio init failed');
      }
    };
    init();
    return () => {
      mounted = false;
      // Cancel any running playback
      playbackCancelRef.current = true;
      for (const t of playbackTimersRef.current) clearTimeout(t);
      playbackTimersRef.current.clear();
      for (const handle of playbackHandlesRef.current.values()) {
        audioEngineRef.current.releaseNote(handle);
      }
      playbackHandlesRef.current.clear();
      // Release all active notes on unmount to prevent audio leak
      audioEngineRef.current.releaseAllNotes();
      activeHandlesRef.current.clear();
      // Clear all auto-release timers
      for (const t of autoReleaseTimersRef.current.values()) clearTimeout(t);
      autoReleaseTimersRef.current.clear();
      // Clear silence analysis timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // Note event handlers
  // --------------------------------------------------------------------------
  const handleNoteOn = useCallback(
    (midiNote: MidiNoteEvent) => {
      // AUDIO FIRST — play sound before any React state updates for lowest latency
      if (isAudioReady) {
        const existingHandle = activeHandlesRef.current.get(midiNote.note);
        if (existingHandle) {
          audioEngineRef.current.releaseNote(existingHandle);
          activeHandlesRef.current.delete(midiNote.note);
        }
        const existingTimer = autoReleaseTimersRef.current.get(midiNote.note);
        if (existingTimer) clearTimeout(existingTimer);

        const handle = audioEngineRef.current.playNote(midiNote.note, midiNote.velocity / 127);
        activeHandlesRef.current.set(midiNote.note, handle);

        // Auto-release safety net
        const timer = setTimeout(() => {
          const currentHandle = activeHandlesRef.current.get(midiNote.note);
          if (currentHandle === handle) {
            audioEngineRef.current.releaseNote(currentHandle);
            activeHandlesRef.current.delete(midiNote.note);
            setHighlightedNotes((prev) => {
              const next = new Set(prev);
              next.delete(midiNote.note);
              return next;
            });
          }
          autoReleaseTimersRef.current.delete(midiNote.note);
        }, NOTE_AUTO_RELEASE_MS);
        autoReleaseTimersRef.current.set(midiNote.note, timer);
      }

      // VISUALS AFTER — state updates queue re-renders but don't block audio
      setHighlightedNotes((prev) => new Set([...prev, midiNote.note]));
      setCurrentNoteName(midiToNoteName(midiNote.note));
      setSessionNoteCount((prev) => prev + 1);
      if (showInstructions) setShowInstructions(false);

      // Track all session notes for analysis (regardless of recording state)
      sessionNotesRef.current.push({
        note: midiNote.note,
        timestamp: Date.now(),
        velocity: midiNote.velocity,
      });

      // Reset silence timer for auto-analysis
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setAnalysis(null); // dismiss any existing analysis card while playing
      silenceTimerRef.current = setTimeout(() => {
        if (sessionNotesRef.current.length > 0) {
          setAnalysis(analyzeSession(sessionNotesRef.current));
        }
      }, 2000);

      // Record if actively recording
      if (isRecording) {
        setRecordedNotes((prev) => [
          ...prev,
          {
            note: midiNote.note,
            velocity: midiNote.velocity,
            timestamp: Date.now() - recordingStartRef.current,
          },
        ]);
      }
    },
    [isAudioReady, isRecording, showInstructions],
  );

  const handleNoteOff = useCallback(
    (note: number) => {
      setHighlightedNotes((prev) => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });

      // Release the audio — this is what actually stops the sound
      const handle = activeHandlesRef.current.get(note);
      if (handle) {
        audioEngineRef.current.releaseNote(handle);
        activeHandlesRef.current.delete(note);
      }
      // Clear auto-release timer since we released manually
      const timer = autoReleaseTimersRef.current.get(note);
      if (timer) {
        clearTimeout(timer);
        autoReleaseTimersRef.current.delete(note);
      }

      if (isRecording) {
        setRecordedNotes((prev) => {
          const notes = [...prev];
          for (let i = notes.length - 1; i >= 0; i--) {
            if (notes[i].note === note && !notes[i].releaseTimestamp) {
              notes[i] = {
                ...notes[i],
                releaseTimestamp: Date.now() - recordingStartRef.current,
              };
              break;
            }
          }
          return notes;
        });
      }
    },
    [isRecording],
  );

  // --------------------------------------------------------------------------
  // Recording controls
  // --------------------------------------------------------------------------
  const startRecording = useCallback(() => {
    setRecordedNotes([]);
    recordingStartRef.current = Date.now();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const stopPlayback = useCallback(() => {
    playbackCancelRef.current = true;
    // Clear all scheduled release timers
    for (const t of playbackTimersRef.current) clearTimeout(t);
    playbackTimersRef.current.clear();
    // Release all playback notes
    for (const handle of playbackHandlesRef.current.values()) {
      audioEngineRef.current.releaseNote(handle);
    }
    playbackHandlesRef.current.clear();
    setIsPlayingBack(false);
    setHighlightedNotes(new Set());
    setCurrentNoteName('');
  }, []);

  const playRecording = useCallback(async () => {
    if (recordedNotes.length === 0) return;

    // Cancel any existing playback first
    stopPlayback();
    playbackCancelRef.current = false;
    setIsPlayingBack(true);

    const baseTimestamp = recordedNotes[0].timestamp;
    const highlighted = new Set<number>();

    for (const recorded of recordedNotes) {
      if (playbackCancelRef.current) return;

      const delay = recorded.timestamp - baseTimestamp;
      await new Promise<void>((resolve) => setTimeout(resolve, delay > 0 ? delay : 0));

      if (playbackCancelRef.current) return;

      // Release previous note at same pitch before replaying
      const existing = playbackHandlesRef.current.get(recorded.note);
      if (existing) {
        audioEngineRef.current.releaseNote(existing);
        playbackHandlesRef.current.delete(recorded.note);
      }

      if (isAudioReady) {
        const handle = audioEngineRef.current.playNote(recorded.note, recorded.velocity / 127);
        playbackHandlesRef.current.set(recorded.note, handle);

        // Schedule release based on recorded duration
        const duration = recorded.releaseTimestamp
          ? recorded.releaseTimestamp - recorded.timestamp
          : 500; // fallback 500ms if no release was recorded
        const timer = setTimeout(() => {
          playbackTimersRef.current.delete(timer);
          if (playbackCancelRef.current) return;
          const current = playbackHandlesRef.current.get(recorded.note);
          if (current === handle) {
            audioEngineRef.current.releaseNote(current);
            playbackHandlesRef.current.delete(recorded.note);
            highlighted.delete(recorded.note);
            setHighlightedNotes(new Set(highlighted));
          }
        }, duration);
        playbackTimersRef.current.add(timer);
      }

      highlighted.add(recorded.note);
      setHighlightedNotes(new Set(highlighted));
      setCurrentNoteName(midiToNoteName(recorded.note));
    }

    if (playbackCancelRef.current) return;

    // Wait for last notes to finish, then clear
    const lastNote = recordedNotes[recordedNotes.length - 1];
    const lastDuration = lastNote.releaseTimestamp
      ? lastNote.releaseTimestamp - lastNote.timestamp
      : 500;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, lastDuration + 100);
      playbackTimersRef.current.add(t);
    });

    if (playbackCancelRef.current) return;

    // Natural end — clean up
    for (const handle of playbackHandlesRef.current.values()) {
      audioEngineRef.current.releaseNote(handle);
    }
    playbackHandlesRef.current.clear();
    setIsPlayingBack(false);
    setHighlightedNotes(new Set());
    setCurrentNoteName('');
  }, [recordedNotes, isAudioReady, stopPlayback]);

  const clearRecording = useCallback(() => {
    stopPlayback();
    setRecordedNotes([]);
    sessionNotesRef.current = [];
    setAnalysis(null);
  }, [stopPlayback]);

  // --------------------------------------------------------------------------
  // Navigation
  // --------------------------------------------------------------------------
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container} testID="play-screen">
      {/* Top controls bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="freeplay-back">
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.title}>Free Play</Text>

        {/* Live note display */}
        <View style={styles.noteDisplay} testID="freeplay-note-display-container">
          <Text style={styles.noteText} testID="freeplay-note-display">{currentNoteName || '\u2014'}</Text>
        </View>

        {/* Session stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>{sessionNoteCount} notes</Text>
          {recordedNotes.length > 0 && (
            <Text style={styles.statsText}>{recordedNotes.length} recorded</Text>
          )}
        </View>

        {/* Help button to re-show instructions */}
        {!showInstructions && (
          <TouchableOpacity
            onPress={() => setShowInstructions(true)}
            style={styles.helpButton}
            testID="freeplay-help"
          >
            <MaterialCommunityIcons name="help-circle-outline" size={22} color="#B0B0B0" />
          </TouchableOpacity>
        )}

        {/* Recording controls */}
        <View style={styles.recordControls}>
          {!isRecording ? (
            <TouchableOpacity onPress={startRecording} style={styles.controlTouchable} testID="freeplay-record-start">
              <MaterialCommunityIcons name="record-circle" size={22} color="#DC143C" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={stopRecording} style={styles.controlTouchable} testID="freeplay-record-stop">
              <MaterialCommunityIcons name="stop-circle" size={22} color="#FF4444" />
            </TouchableOpacity>
          )}
          {recordedNotes.length > 0 && !isRecording && (
            <>
              {isPlayingBack ? (
                <TouchableOpacity onPress={stopPlayback} style={styles.controlTouchable} testID="freeplay-record-stop-playback">
                  <MaterialCommunityIcons name="stop-circle" size={22} color="#FFA726" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={playRecording} style={styles.controlTouchable} testID="freeplay-record-playback">
                  <MaterialCommunityIcons name="play-circle" size={22} color="#00E676" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={clearRecording} style={styles.controlTouchable} testID="freeplay-record-clear">
                <MaterialCommunityIcons name="delete" size={22} color="#EF5350" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Beginner-friendly instruction banner */}
      {showInstructions && (
        <View style={styles.instructionsBanner} testID="freeplay-instructions">
          <View style={styles.instructionsContent}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#FFD700" />
            <View style={styles.instructionsTextWrap}>
              <Text style={styles.instructionsTitle}>Welcome to Free Play!</Text>
              <Text style={styles.instructionsText}>
                Tap the piano keys below to play notes. The note name shows above.{' '}
                Press the red circle to record, then play it back!
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowInstructions(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="freeplay-instructions-close"
            >
              <MaterialCommunityIcons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Note reference strip — shows octave markers and Middle C label */}
      <View style={styles.noteRefStrip} testID="freeplay-note-ref">
        <Text style={styles.noteRefLabel}>C3</Text>
        <View style={styles.noteRefSpacer} />
        <Text style={[styles.noteRefLabel, styles.noteRefMiddleC]}>Middle C (C4)</Text>
        <View style={styles.noteRefSpacer} />
        <Text style={styles.noteRefLabel}>C5</Text>
        <View style={styles.noteRefSpacer} />
        <Text style={styles.noteRefLabel}>C6</Text>
      </View>

      {/* Full-width keyboard */}
      <View style={styles.keyboardContainer}>
        <Keyboard
          startNote={48}
          octaveCount={3}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          highlightedNotes={highlightedNotes}
          expectedNotes={new Set()}
          enabled={true}
          hapticEnabled={true}
          showLabels={true}
          scrollable={true}
          keyHeight={110}
          testID="freeplay-keyboard"
        />
      </View>

      {/* Free play analysis card — appears after 2s of silence */}
      {analysis && (
        <View style={styles.analysisCard} testID="freeplay-analysis-card">
          <View style={styles.analysisHeader}>
            <MaterialCommunityIcons name="music-note-eighth" size={18} color="#2196F3" />
            <Text style={styles.analysisTitle}>Free Play Analysis</Text>
            <TouchableOpacity onPress={() => setAnalysis(null)}>
              <MaterialCommunityIcons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
          <Text style={styles.analysisSummary}>{analysis.summary}</Text>
          {analysis.detectedKey && (
            <Text style={styles.analysisDetail}>Detected key: {analysis.detectedKey}</Text>
          )}
          <TouchableOpacity
            style={styles.generateDrillBtn}
            onPress={() => {
              navigation.navigate('Exercise', { exerciseId: 'ai-mode', aiMode: true });
              setAnalysis(null);
            }}
            testID="freeplay-generate-drill"
          >
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFF" />
            <Text style={styles.generateDrillText}>Generate Drill</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noteDisplay: {
    backgroundColor: '#252525',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#DC143C',
    minWidth: 80,
    alignItems: 'center',
  },
  noteText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#DC143C',
    fontFamily: 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  statsText: {
    fontSize: 12,
    color: '#888',
  },
  helpButton: {
    padding: 4,
  },
  recordControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlTouchable: {
    padding: 4,
  },
  instructionsBanner: {
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  instructionsContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  instructionsTextWrap: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: 2,
  },
  instructionsText: {
    fontSize: 12,
    color: '#B0B0B0',
    lineHeight: 17,
  },
  noteRefStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  noteRefLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  noteRefMiddleC: {
    color: '#DC143C',
    fontSize: 11,
    fontWeight: '700',
  },
  noteRefSpacer: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  analysisCard: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  analysisSummary: {
    fontSize: 13,
    color: '#AAAAAA',
    marginBottom: 8,
  },
  analysisDetail: {
    fontSize: 12,
    color: '#2196F3',
    marginBottom: 8,
  },
  generateDrillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 8,
  },
  generateDrillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
