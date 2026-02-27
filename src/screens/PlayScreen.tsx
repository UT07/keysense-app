/**
 * PlayScreen - Free play mode (landscape, side-by-side keyboards)
 *
 * Features:
 * - Landscape orientation (locked on mount, restored on unmount)
 * - Side-by-side keyboards: Left (C2-B3) + Right (C4-C6)
 * - Optional song reference — minimal song title indicator
 * - Floating action bar for Record / Play / Clear
 * - Live note name display + session stats + free play analysis
 * - MIDI and microphone input via InputManager
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Keyboard as PianoKeyboard } from '../components/Keyboard/Keyboard';
import { SongReferencePicker } from '../components/SongReferencePicker';
import { createAudioEngine } from '../audio/createAudioEngine';
import type { NoteHandle } from '../audio/types';
import type { MidiNoteEvent } from '../core/exercises/types';
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

// Keyboard ranges
const LEFT_KB_START = 36; // C2
const LEFT_KB_OCTAVES = 2; // C2 - B3
const RIGHT_KB_START = 60; // C4
const RIGHT_KB_OCTAVES = 2; // C4 - C6

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
  const [selectedSongTitle, setSelectedSongTitle] = useState<string | null>(null);
  const loadSong = useSongStore((s) => s.loadSong);

  // --------------------------------------------------------------------------
  // Landscape orientation lock
  // --------------------------------------------------------------------------
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
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
    [isAudioReady, isRecording],
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
  // Highlighted notes split by keyboard range
  // --------------------------------------------------------------------------
  const leftHighlighted = React.useMemo(() => {
    const s = new Set<number>();
    for (const n of highlightedNotes) {
      if (n < RIGHT_KB_START) s.add(n);
    }
    return s;
  }, [highlightedNotes]);

  const rightHighlighted = React.useMemo(() => {
    const s = new Set<number>();
    for (const n of highlightedNotes) {
      if (n >= RIGHT_KB_START) s.add(n);
    }
    return s;
  }, [highlightedNotes]);

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
    for (const t of playbackTimersRef.current) clearTimeout(t);
    playbackTimersRef.current.clear();
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

        const duration = recorded.releaseTimestamp
          ? recorded.releaseTimestamp - recorded.timestamp
          : 500;
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

    const lastNote = recordedNotes[recordedNotes.length - 1];
    const lastDuration = lastNote.releaseTimestamp
      ? lastNote.releaseTimestamp - lastNote.timestamp
      : 500;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, lastDuration + 100);
      playbackTimersRef.current.add(t);
    });

    if (playbackCancelRef.current) return;

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
      setSelectedSongTitle(songTitle);
      setShowSongPicker(false);
      loadSong(songId);
    },
    [loadSong],
  );

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
    <View style={styles.container} testID="play-screen">
      {/* Top bar — compact for landscape */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="freeplay-back">
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Free Play</Text>

        {/* Active input method badge */}
        {activeInput !== 'touch' && (
          <View style={styles.inputBadge} testID="freeplay-input-badge">
            <MaterialCommunityIcons
              name={activeInput === 'midi' ? 'piano' : 'microphone'}
              size={12}
              color={COLORS.success}
            />
            <Text style={styles.inputBadgeText}>
              {activeInput === 'midi' ? 'MIDI' : 'Mic'}
            </Text>
          </View>
        )}

        {/* Song indicator */}
        {selectedSongTitle ? (
          <TouchableOpacity
            style={styles.songIndicator}
            onPress={() => setShowSongPicker(true)}
          >
            <MaterialCommunityIcons name="music-note" size={14} color={COLORS.primary} />
            <Text style={styles.songIndicatorText} numberOfLines={1}>{selectedSongTitle}</Text>
            <TouchableOpacity
              onPress={() => setSelectedSongTitle(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={14} color={COLORS.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.loadSongBtn}
            onPress={() => setShowSongPicker(true)}
            testID="freeplay-load-song"
          >
            <MaterialCommunityIcons name="music-note-plus" size={16} color={COLORS.primary} />
            <Text style={styles.loadSongBtnText}>Song</Text>
          </TouchableOpacity>
        )}

        <View style={styles.topBarSpacer} />

        {/* Live note display */}
        <View style={styles.noteDisplay} testID="freeplay-note-display-container">
          <Text style={styles.noteText} testID="freeplay-note-display">{currentNoteName || '\u2014'}</Text>
        </View>

        {/* Recording controls — inline in top bar */}
        <View style={styles.controlsRow}>
          {!isRecording ? (
            <TouchableOpacity
              onPress={startRecording}
              style={[styles.controlBtn, styles.controlRecord]}
              testID="freeplay-record-start"
            >
              <MaterialCommunityIcons name="record-circle" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={stopRecording}
              style={[styles.controlBtn, styles.controlStop]}
              testID="freeplay-record-stop"
            >
              <MaterialCommunityIcons name="stop-circle" size={18} color="#fff" />
            </TouchableOpacity>
          )}

          {recordedNotes.length > 0 && !isRecording && (
            <>
              {isPlayingBack ? (
                <TouchableOpacity
                  onPress={stopPlayback}
                  style={[styles.controlBtn, styles.controlPlayback]}
                  testID="freeplay-record-stop-playback"
                >
                  <MaterialCommunityIcons name="stop-circle" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={playRecording}
                  style={[styles.controlBtn, styles.controlPlayback]}
                  testID="freeplay-record-playback"
                >
                  <MaterialCommunityIcons name="play-circle" size={18} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={clearRecording}
                style={[styles.controlBtn, styles.controlClear]}
                testID="freeplay-record-clear"
              >
                <MaterialCommunityIcons name="delete" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Stats */}
        <Text style={styles.statsText}>{sessionNoteCount} notes</Text>
        {analysis?.detectedKey && (
          <Text style={styles.statsKeyText}>{analysis.detectedKey}</Text>
        )}
      </View>

      {/* Side-by-side keyboards */}
      <View style={styles.keyboardRow}>
        {/* Left hand keyboard — lower octaves */}
        <View style={styles.keyboardHalf}>
          <View style={styles.handBadge}>
            <Text style={styles.handBadgeText}>L</Text>
          </View>
          <PianoKeyboard
            startNote={LEFT_KB_START}
            octaveCount={LEFT_KB_OCTAVES}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            highlightedNotes={leftHighlighted}
            enabled={true}
            hapticEnabled={true}
            showLabels={true}
            scrollable={false}
            keyHeight={140}
            testID="freeplay-keyboard-left"
          />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Right hand keyboard — higher octaves */}
        <View style={styles.keyboardHalf}>
          <View style={styles.handBadge}>
            <Text style={styles.handBadgeText}>R</Text>
          </View>
          <PianoKeyboard
            startNote={RIGHT_KB_START}
            octaveCount={RIGHT_KB_OCTAVES}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            highlightedNotes={rightHighlighted}
            enabled={true}
            hapticEnabled={true}
            showLabels={true}
            scrollable={false}
            keyHeight={140}
            testID="freeplay-keyboard-right"
          />
        </View>
      </View>

      {/* Free play analysis card — appears after 2s of silence */}
      {analysis && (
        <View style={styles.analysisCard} testID="freeplay-analysis-card">
          <View style={styles.analysisHeader}>
            <MaterialCommunityIcons name="music-note-eighth" size={16} color={COLORS.info} />
            <Text style={styles.analysisTitle}>Analysis</Text>
            <TouchableOpacity onPress={() => setAnalysis(null)}>
              <MaterialCommunityIcons name="close" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.analysisSummary}>{analysis.summary}</Text>
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
            <MaterialCommunityIcons name="lightning-bolt" size={14} color={COLORS.textPrimary} />
            <Text style={styles.generateDrillText}>Drill</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Song reference picker modal */}
      <SongReferencePicker
        visible={showSongPicker}
        onSelect={handleSongSelect}
        onClose={() => setShowSongPicker(false)}
      />
    </View>
  );
}

// ============================================================================
// Styles — landscape-optimized layout
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Top bar ─────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: SPACING.sm,
    height: 40,
  },
  backButton: {
    padding: 2,
  },
  title: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  inputBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  inputBadgeText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '600',
  },
  songIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: glowColor(COLORS.primary, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    maxWidth: 180,
  },
  songIndicatorText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  loadSongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: glowColor(COLORS.primary, 0.08),
  },
  loadSongBtnText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  topBarSpacer: {
    flex: 1,
  },
  noteDisplay: {
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
    minWidth: 52,
    alignItems: 'center',
  },
  noteText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    fontFamily: 'monospace',
  },

  // ── Controls (inline) ──────────────────────────────────────────────────
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlRecord: {
    backgroundColor: COLORS.primary,
  },
  controlStop: {
    backgroundColor: COLORS.error,
  },
  controlPlayback: {
    backgroundColor: COLORS.success,
  },
  controlClear: {
    backgroundColor: COLORS.cardSurface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  statsText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  statsKeyText: {
    fontSize: 11,
    color: COLORS.info,
    fontWeight: '600',
  },

  // ── Keyboards (side-by-side) ───────────────────────────────────────────
  keyboardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyboardHalf: {
    flex: 1,
    position: 'relative',
  },
  handBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  divider: {
    width: 2,
    backgroundColor: COLORS.cardBorder,
  },

  // ── Analysis overlay ──────────────────────────────────────────────────
  analysisCard: {
    ...SHADOWS.md,
    position: 'absolute',
    bottom: 80,
    right: SPACING.md,
    width: 220,
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: glowColor(COLORS.info, 0.3),
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  analysisTitle: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  analysisSummary: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 6,
    lineHeight: 15,
  },
  generateDrillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.info,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  generateDrillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
