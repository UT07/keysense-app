/**
 * PlayScreen - Free play mode (portrait, split keyboard, song reference)
 *
 * Features:
 * - Portrait orientation (no landscape lock)
 * - SplitKeyboard for two-handed play (Left: C2-B3, Right: C4-C6)
 * - Song reference panel — load any song from the Music Library as a visual note guide
 * - Floating action bar for Record / Play / Clear
 * - Live note name display + session stats + free play analysis
 * - MIDI and microphone input via InputManager
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SplitKeyboard } from '../components/Keyboard/SplitKeyboard';
import { SongReferencePicker } from '../components/SongReferencePicker';
import { createAudioEngine } from '../audio/createAudioEngine';
import type { NoteHandle } from '../audio/types';
import { SalsaCoach } from '../components/Mascot/SalsaCoach';
import type { MidiNoteEvent, NoteEvent } from '../core/exercises/types';
import { InputManager } from '../input/InputManager';
import type { ActiveInputMethod } from '../input/InputManager';
import { useSettingsStore } from '../stores/settingsStore';
import { useSongStore } from '../stores/songStore';
import { analyzeSession, type FreePlayAnalysis } from '../services/FreePlayAnalyzer';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, glowColor } from '../theme/tokens';
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

// Empty NoteEvent array constant for SplitKeyboard (avoids re-allocation)
const EMPTY_NOTES: NoteEvent[] = [];

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
  const [activeInput, setActiveInput] = useState<ActiveInputMethod>('touch');
  const preferredInput = useSettingsStore((s) => s.preferredInputMethod);
  const recordingStartRef = useRef(0);
  const audioEngineRef = useRef(createAudioEngine());
  const inputManagerRef = useRef<InputManager | null>(null);
  const activeHandlesRef = useRef<Map<number, NoteHandle>>(new Map());
  const autoReleaseTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const playbackCancelRef = useRef(false);
  const playbackHandlesRef = useRef<Map<number, NoteHandle>>(new Map());
  const playbackTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionNotesRef = useRef<Array<{ note: number; timestamp: number; velocity: number }>>([]);

  // Song reference state
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedSongTitle, setSelectedSongTitle] = useState<string | null>(null);
  const currentSong = useSongStore((s) => s.currentSong);
  const loadSong = useSongStore((s) => s.loadSong);
  const isLoadingSong = useSongStore((s) => s.isLoadingSong);

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
  // InputManager — MIDI and Mic input (runs alongside touch keyboard)
  // --------------------------------------------------------------------------
  const handleNoteOnRef = useRef<(event: MidiNoteEvent) => void>(() => {});
  const handleNoteOffRef = useRef<(note: number) => void>(() => {});

  useEffect(() => {
    const resolvedInput = preferredInput ?? 'auto';
    // Touch-only users don't need InputManager overhead
    if (resolvedInput === 'touch') {
      setActiveInput('touch');
      return;
    }

    let mounted = true;

    const initInput = async (): Promise<void> => {
      try {
        const manager = new InputManager({ preferred: resolvedInput });
        await manager.initialize();
        if (!mounted) { manager.dispose(); return; }

        inputManagerRef.current = manager;
        setActiveInput(manager.activeMethod);

        // Subscribe to MIDI/Mic note events
        manager.onNoteEvent((event) => {
          if (event.type === 'noteOn') {
            handleNoteOnRef.current(event);
          } else if (event.type === 'noteOff') {
            handleNoteOffRef.current(event.note);
          }
        });

        await manager.start();
      } catch {
        // Non-fatal — touch keyboard is always available
        if (mounted) setActiveInput('touch');
      }
    };

    initInput();

    return () => {
      mounted = false;
      inputManagerRef.current?.dispose();
      inputManagerRef.current = null;
    };
  }, [preferredInput]);

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

  // Keep refs in sync so InputManager events call latest handlers
  useEffect(() => { handleNoteOnRef.current = handleNoteOn; }, [handleNoteOn]);
  useEffect(() => { handleNoteOffRef.current = handleNoteOff; }, [handleNoteOff]);

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
  // Song reference
  // --------------------------------------------------------------------------
  const handleSongSelect = useCallback(
    (songId: string, songTitle: string) => {
      setSelectedSongId(songId);
      setSelectedSongTitle(songTitle);
      setShowSongPicker(false);
      loadSong(songId);
    },
    [loadSong],
  );

  const handleClearSong = useCallback(() => {
    setSelectedSongId(null);
    setSelectedSongTitle(null);
  }, []);

  // Build note names from loaded song for reference display
  const songNoteNames = React.useMemo(() => {
    if (!currentSong || currentSong.id !== selectedSongId) return [];
    const names: string[] = [];
    const seen = new Set<number>();
    for (const section of currentSong.sections) {
      for (const note of section.layers.melody) {
        if (!seen.has(note.note)) {
          seen.add(note.note);
          names.push(midiToNoteName(note.note));
        }
      }
    }
    // Sort by MIDI number (ascending)
    return names.sort((a, b) => {
      const midiA = noteNameToApproxMidi(a);
      const midiB = noteNameToApproxMidi(b);
      return midiA - midiB;
    });
  }, [currentSong, selectedSongId]);

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="freeplay-back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Free Play</Text>

        {/* Active input method badge */}
        {activeInput !== 'touch' && (
          <View style={styles.inputBadge} testID="freeplay-input-badge">
            <MaterialCommunityIcons
              name={activeInput === 'midi' ? 'piano' : 'microphone'}
              size={14}
              color={COLORS.success}
            />
            <Text style={styles.inputBadgeText}>
              {activeInput === 'midi' ? 'MIDI' : 'Mic'}
            </Text>
          </View>
        )}

        <View style={styles.headerSpacer} />

        {/* Live note display */}
        <View style={styles.noteDisplay} testID="freeplay-note-display-container">
          <Text style={styles.noteText} testID="freeplay-note-display">{currentNoteName || '\u2014'}</Text>
        </View>

        {/* Load Song button */}
        <TouchableOpacity
          style={styles.loadSongButton}
          onPress={() => setShowSongPicker(true)}
          testID="freeplay-load-song"
        >
          <MaterialCommunityIcons name="music-note-plus" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Beginner-friendly instruction banner */}
      {showInstructions && (
        <View style={styles.instructionsBanner} testID="freeplay-instructions">
          <View style={styles.instructionsContent}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={COLORS.starGold} />
            <View style={styles.instructionsTextWrap}>
              <Text style={styles.instructionsTitle}>Welcome to Free Play!</Text>
              <Text style={styles.instructionsText}>
                {activeInput === 'mic'
                  ? 'Play notes on your piano or sing — the app will detect them! You can also tap the on-screen keys.'
                  : activeInput === 'midi'
                    ? 'Play your MIDI keyboard and see note names in real time. You can also tap the on-screen keys.'
                    : 'Tap the piano keys below to play notes. The note name shows above.'
                }{' '}
                Press the red circle to record, then play it back!
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowInstructions(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="freeplay-instructions-close"
            >
              <MaterialCommunityIcons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Song reference panel */}
      <View style={styles.songRefPanel} testID="freeplay-song-ref">
        {selectedSongTitle ? (
          <View style={styles.songRefLoaded}>
            <View style={styles.songRefHeader}>
              <MaterialCommunityIcons name="music-note" size={16} color={COLORS.primary} />
              <Text style={styles.songRefTitle} numberOfLines={1}>{selectedSongTitle}</Text>
              <TouchableOpacity
                onPress={() => setShowSongPicker(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.songRefChange}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleClearSong}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            {isLoadingSong ? (
              <Text style={styles.songRefLoading}>Loading notes...</Text>
            ) : songNoteNames.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.songNotesScroll}
              >
                {songNoteNames.map((name, i) => (
                  <View key={`${name}-${i}`} style={styles.songNoteBadge}>
                    <Text style={styles.songNoteText}>{name}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.songRefLoading}>No melody notes found</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.songRefPlaceholder}
            onPress={() => setShowSongPicker(true)}
          >
            <MaterialCommunityIcons name="music-note-plus" size={20} color={COLORS.textMuted} />
            <Text style={styles.songRefPlaceholderText}>Load a song for note reference</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Note reference strip — shows octave markers */}
      <View style={styles.noteRefStrip} testID="freeplay-note-ref">
        <Text style={styles.noteRefLabel}>C2</Text>
        <View style={styles.noteRefSpacer} />
        <Text style={[styles.noteRefLabel, styles.noteRefMiddleC]}>Middle C (C4)</Text>
        <View style={styles.noteRefSpacer} />
        <Text style={styles.noteRefLabel}>C6</Text>
      </View>

      {/* Split keyboard (flex fill) */}
      <View style={styles.keyboardContainer}>
        <SplitKeyboard
          notes={EMPTY_NOTES}
          splitPoint={60}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          highlightedNotes={highlightedNotes}
          enabled={true}
          hapticEnabled={true}
          showLabels={true}
          keyHeight={90}
          testID="freeplay-keyboard"
        />
      </View>

      {/* Floating action bar */}
      <View style={styles.actionBar} testID="freeplay-action-bar">
        <View style={styles.actionRow}>
          {/* Record / Stop */}
          {!isRecording ? (
            <TouchableOpacity
              onPress={startRecording}
              style={[styles.actionButton, styles.actionRecord]}
              testID="freeplay-record-start"
            >
              <MaterialCommunityIcons name="record-circle" size={24} color={COLORS.textPrimary} />
              <Text style={styles.actionLabel}>Record</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={stopRecording}
              style={[styles.actionButton, styles.actionStop]}
              testID="freeplay-record-stop"
            >
              <MaterialCommunityIcons name="stop-circle" size={24} color={COLORS.textPrimary} />
              <Text style={styles.actionLabel}>Stop</Text>
            </TouchableOpacity>
          )}

          {/* Play / Stop playback */}
          {recordedNotes.length > 0 && !isRecording && (
            <>
              {isPlayingBack ? (
                <TouchableOpacity
                  onPress={stopPlayback}
                  style={[styles.actionButton, styles.actionPlayback]}
                  testID="freeplay-record-stop-playback"
                >
                  <MaterialCommunityIcons name="stop-circle" size={24} color={COLORS.textPrimary} />
                  <Text style={styles.actionLabel}>Stop</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={playRecording}
                  style={[styles.actionButton, styles.actionPlayback]}
                  testID="freeplay-record-playback"
                >
                  <MaterialCommunityIcons name="play-circle" size={24} color={COLORS.textPrimary} />
                  <Text style={styles.actionLabel}>Play</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={clearRecording}
                style={[styles.actionButton, styles.actionClear]}
                testID="freeplay-record-clear"
              >
                <MaterialCommunityIcons name="delete" size={24} color={COLORS.textPrimary} />
                <Text style={styles.actionLabel}>Clear</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>{sessionNoteCount} notes</Text>
          {recordedNotes.length > 0 && (
            <Text style={styles.statsText}>{recordedNotes.length} recorded</Text>
          )}
          {analysis?.detectedKey && (
            <Text style={styles.statsKeyText}>Key of {analysis.detectedKey}</Text>
          )}

          <View style={styles.statsSpacer} />

          {/* Help button to re-show instructions */}
          {!showInstructions && (
            <TouchableOpacity
              onPress={() => setShowInstructions(true)}
              style={styles.helpButton}
              testID="freeplay-help"
            >
              <MaterialCommunityIcons name="help-circle-outline" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Salsa mini avatar */}
          <SalsaCoach mood="happy" size="small" />
        </View>
      </View>

      {/* Free play analysis card — appears after 2s of silence */}
      {analysis && (
        <View style={styles.analysisCard} testID="freeplay-analysis-card">
          <View style={styles.analysisHeader}>
            <MaterialCommunityIcons name="music-note-eighth" size={18} color={COLORS.info} />
            <Text style={styles.analysisTitle}>Free Play Analysis</Text>
            <TouchableOpacity onPress={() => setAnalysis(null)}>
              <MaterialCommunityIcons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.analysisSummary}>{analysis.summary}</Text>
          {analysis.detectedKey && (
            <Text style={styles.analysisDetail}>Detected key: {analysis.detectedKey}</Text>
          )}
          <TouchableOpacity
            style={styles.generateDrillBtn}
            onPress={() => {
              navigation.navigate('Exercise', {
                exerciseId: 'ai-mode',
                aiMode: true,
                freePlayContext: {
                  detectedKey: analysis.detectedKey,
                  suggestedDrillType: analysis.suggestedDrillType,
                  weakNotes: analysis.uniqueNotes.slice(0, 6),
                },
              });
              setAnalysis(null);
            }}
            testID="freeplay-generate-drill"
          >
            <MaterialCommunityIcons name="lightning-bolt" size={16} color={COLORS.textPrimary} />
            <Text style={styles.generateDrillText}>Generate Drill</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Song reference picker modal */}
      <SongReferencePicker
        visible={showSongPicker}
        onSelect={handleSongSelect}
        onClose={() => setShowSongPicker(false)}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Utility — approximate MIDI from note name for sorting
// ============================================================================

function noteNameToApproxMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 0;
  const noteIdx = NOTE_NAMES.indexOf(match[1]);
  const octave = parseInt(match[2], 10);
  return (octave + 1) * 12 + noteIdx;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Header ────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: SPACING.sm,
  },
  backButton: {
    padding: 4,
  },
  title: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
  },
  inputBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  inputBadgeText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  headerSpacer: {
    flex: 1,
  },
  noteDisplay: {
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: SPACING.xs,
    borderWidth: 2,
    borderColor: COLORS.primary,
    minWidth: 64,
    alignItems: 'center',
  },
  noteText: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  loadSongButton: {
    padding: 6,
    backgroundColor: glowColor(COLORS.primary, 0.1),
    borderRadius: BORDER_RADIUS.sm,
  },

  // ── Instructions banner ───────────────────────────────────────────────
  instructionsBanner: {
    backgroundColor: glowColor(COLORS.starGold, 0.06),
    borderBottomWidth: 1,
    borderBottomColor: glowColor(COLORS.starGold, 0.12),
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  instructionsContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  instructionsTextWrap: {
    flex: 1,
  },
  instructionsTitle: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '700' as const,
    color: COLORS.starGold,
    marginBottom: 2,
  },
  instructionsText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  // ── Song reference panel ──────────────────────────────────────────────
  songRefPanel: {
    backgroundColor: COLORS.cardSurface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    minHeight: 52,
  },
  songRefPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  songRefPlaceholderText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textMuted,
  },
  songRefLoaded: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  songRefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  songRefTitle: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  songRefChange: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: SPACING.xs,
  },
  songRefLoading: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  songNotesScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  songNoteBadge: {
    backgroundColor: glowColor(COLORS.primary, 0.12),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  songNoteText: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'monospace',
  },

  // ── Note reference strip ──────────────────────────────────────────────
  noteRefStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  noteRefLabel: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.textMuted,
    fontWeight: '600' as const,
    fontFamily: 'monospace',
  },
  noteRefMiddleC: {
    color: COLORS.primary,
    ...TYPOGRAPHY.caption.md,
    fontWeight: '700' as const,
  },
  noteRefSpacer: {
    flex: 1,
  },

  // ── Keyboard container ────────────────────────────────────────────────
  keyboardContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },

  // ── Floating action bar ───────────────────────────────────────────────
  actionBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  actionRecord: {
    backgroundColor: COLORS.primary,
  },
  actionStop: {
    backgroundColor: COLORS.error,
  },
  actionPlayback: {
    backgroundColor: COLORS.success,
  },
  actionClear: {
    backgroundColor: COLORS.cardSurface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionLabel: {
    ...TYPOGRAPHY.button.sm,
    color: COLORS.textPrimary,
  },

  // ── Stats row ─────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statsText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textMuted,
  },
  statsKeyText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.info,
    fontWeight: '600',
  },
  statsSpacer: {
    flex: 1,
  },
  helpButton: {
    padding: 4,
  },

  // ── Analysis overlay ──────────────────────────────────────────────────
  analysisCard: {
    ...SHADOWS.md,
    position: 'absolute',
    bottom: 160,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: glowColor(COLORS.info, 0.3),
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  analysisTitle: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
    flex: 1,
  },
  analysisSummary: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  analysisDetail: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.info,
    marginBottom: SPACING.sm,
  },
  generateDrillBtn: {
    ...SHADOWS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.info,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  generateDrillText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.textPrimary,
  },
});
