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
  SafeAreaView,
  ScrollView as RNScrollView,
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
import { ttsService } from '../services/tts/TTSService';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, glowColor } from '../theme/tokens';
import { computeZoomedRange } from '../components/Keyboard/computeZoomedRange';
import type { NoteEvent } from '../core/exercises/types';
import type { SongSection } from '../core/songs/songTypes';
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
// Horizontal Note Strip — left-to-right piano roll for song mode
// ============================================================================

const PIXELS_PER_BEAT = 60;
const NOTE_ROW_HEIGHT = 28;
const NOTE_COLORS = [
  '#FF3B5C', '#FF6D1F', '#FFA726', '#FFD54F', '#A5D64A', '#66CC66',
  '#26C6A0', '#29D6E6', '#42A5F5', '#5C6BC0', '#BA68C8', '#F06292',
];

function noteColor(midiNote: number): string {
  return NOTE_COLORS[midiNote % 12];
}

function HorizontalNoteStrip({
  notes,
  highlightedNotes,
}: {
  notes: NoteEvent[];
  highlightedNotes: Set<number>;
}): React.JSX.Element | null {
  if (notes.length === 0) {
    return (
      <View style={songStyles.emptyStrip}>
        <MaterialCommunityIcons name="music-note-off" size={32} color={COLORS.textMuted} />
        <Text style={songStyles.emptyStripText}>No notes in this section</Text>
      </View>
    );
  }

  const minNote = Math.min(...notes.map((n) => n.note));
  const maxNote = Math.max(...notes.map((n) => n.note));
  const totalBeats = Math.max(...notes.map((n) => n.startBeat + n.durationBeats));
  const noteSpan = maxNote - minNote + 1;
  const stripHeight = noteSpan * NOTE_ROW_HEIGHT;
  const stripWidth = (totalBeats + 2) * PIXELS_PER_BEAT;

  return (
    <View style={songStyles.noteStripWrapper}>
      {/* Note name labels on the left */}
      <View style={[songStyles.noteLabels, { height: stripHeight }]}>
        {Array.from({ length: noteSpan }, (_, i) => {
          const midi = minNote + (noteSpan - 1 - i);
          return (
            <View key={midi} style={[songStyles.noteLabelRow, { height: NOTE_ROW_HEIGHT }]}>
              <Text style={[songStyles.noteLabelText, { color: noteColor(midi) }]}>
                {NOTE_NAMES[midi % 12]}{Math.floor(midi / 12) - 1}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Scrollable note area */}
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        style={songStyles.noteStripScroll}
        contentContainerStyle={{ width: stripWidth, height: stripHeight }}
      >
        {/* Horizontal grid lines */}
        {Array.from({ length: noteSpan }, (_, i) => (
          <View
            key={`grid-${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * NOTE_ROW_HEIGHT,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          />
        ))}

        {/* Beat markers */}
        {Array.from({ length: Math.ceil(totalBeats) + 1 }, (_, i) => (
          <View
            key={`beat-${i}`}
            style={{
              position: 'absolute',
              left: i * PIXELS_PER_BEAT,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: i % 4 === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
            }}
          />
        ))}

        {/* Note blocks */}
        {notes.map((note, i) => {
          const isHighlighted = highlightedNotes.has(note.note);
          const row = maxNote - note.note; // Higher notes at top
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: note.startBeat * PIXELS_PER_BEAT + 1,
                top: row * NOTE_ROW_HEIGHT + 1,
                width: Math.max(note.durationBeats * PIXELS_PER_BEAT - 2, 10),
                height: NOTE_ROW_HEIGHT - 2,
                backgroundColor: isHighlighted
                  ? COLORS.success
                  : noteColor(note.note),
                borderRadius: 4,
                opacity: isHighlighted ? 1 : 0.9,
                justifyContent: 'center',
                paddingHorizontal: 3,
              }}
            >
              {note.durationBeats * PIXELS_PER_BEAT > 30 && (
                <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
                  {NOTE_NAMES[note.note % 12]}{Math.floor(note.note / 12) - 1}
                </Text>
              )}
            </View>
          );
        })}
      </RNScrollView>
    </View>
  );
}

function SongSectionPills({
  sections,
  selectedIndex,
  onSelect,
}: {
  sections: SongSection[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}): React.JSX.Element {
  return (
    <RNScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={songStyles.sectionPillsRow}
    >
      {sections.map((section, i) => (
        <TouchableOpacity
          key={section.id}
          style={[songStyles.sectionPill, i === selectedIndex && songStyles.sectionPillSelected]}
          onPress={() => onSelect(i)}
        >
          <Text
            style={[
              songStyles.sectionPillText,
              i === selectedIndex && songStyles.sectionPillTextSelected,
            ]}
          >
            {section.label}
          </Text>
        </TouchableOpacity>
      ))}
    </RNScrollView>
  );
}

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
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
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
  const [songLoadError, setSongLoadError] = useState<string | null>(null);
  const loadSong = useSongStore((s) => s.loadSong);
  const currentSong = useSongStore((s) => s.currentSong);
  const isLoadingSong = useSongStore((s) => s.isLoadingSong);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);

  // Song mode: when a song is loaded, switch to portrait with note strip
  const songMode = !!(currentSong?.sections && selectedSongTitle);
  const songNotes: NoteEvent[] = songMode
    ? (currentSong?.sections[selectedSectionIndex]?.layers?.melody ?? [])
    : [];

  // Compute keyboard range from song notes (zoom to the relevant octaves)
  const songKeyboardRange = React.useMemo(() => {
    if (songNotes.length === 0) return { startNote: 48, octaveCount: 2 };
    const allMidi = songNotes.map((n) => n.note);
    return computeZoomedRange(allMidi, 2);
  }, [songNotes]);

  // --------------------------------------------------------------------------
  // Orientation: portrait for song mode, landscape for free play
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (songMode) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT).catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [songMode]);

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
      // Stop any ongoing TTS
      ttsService.stop();
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
          const result = analyzeSession(sessionNotesRef.current);
          setAnalysis(result);
          // Voice summary using the user's selected cat
          if (result.detectedKey) {
            const voiceSummary = result.suggestedDrillType
              ? `You played in ${result.detectedKey}. Try a ${result.suggestedDrillType} drill to improve.`
              : `You played in ${result.detectedKey}. Nice session!`;
            ttsService.speak(voiceSummary, { catId: selectedCatId });
          }
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
    async (songId: string, songTitle: string) => {
      setSelectedSongTitle(songTitle);
      setShowSongPicker(false);
      setSongLoadError(null);
      await loadSong(songId);
      // loadSong swallows errors — check if song actually loaded
      const loaded = useSongStore.getState().currentSong;
      if (!loaded) {
        setSongLoadError('Could not load song. Try again later.');
      }
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
  // Render — Song Loading / Error State
  // --------------------------------------------------------------------------
  if (selectedSongTitle && !currentSong) {
    return (
      <SafeAreaView style={songStyles.container} testID="play-screen">
        <View style={songStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={songStyles.headerCenter}>
            <Text style={songStyles.headerTitle} numberOfLines={1}>
              {selectedSongTitle}
            </Text>
            <Text style={songStyles.headerSubtitle}>
              {isLoadingSong ? 'Loading...' : songLoadError ?? 'Song unavailable'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { setSelectedSongTitle(null); setSongLoadError(null); }}
            style={songStyles.closeSongBtn}
          >
            <MaterialCommunityIcons name="close" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {isLoadingSong ? (
            <Text style={{ color: COLORS.textSecondary, ...TYPOGRAPHY.body }}>Loading song...</Text>
          ) : (
            <TouchableOpacity onPress={() => { setSelectedSongTitle(null); setSongLoadError(null); }}>
              <Text style={{ color: COLORS.info, ...TYPOGRAPHY.body }}>
                {songLoadError ?? 'Could not load song.'} Tap to dismiss.
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------------------------------
  // Render — Song Mode (portrait, note strip + keyboard at bottom)
  // --------------------------------------------------------------------------
  if (songMode) {
    return (
      <SafeAreaView style={songStyles.container} testID="play-screen">
        {/* Compact header */}
        <View style={songStyles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={songStyles.headerCenter}>
            <Text style={songStyles.headerTitle} numberOfLines={1}>
              {selectedSongTitle}
            </Text>
            <Text style={songStyles.headerSubtitle}>
              {currentSong?.metadata?.artist ?? ''} · {currentSong?.settings?.tempo ?? 120} BPM · {currentSong?.settings?.keySignature ?? 'C'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { setSelectedSongTitle(null); }}
            style={songStyles.closeSongBtn}
          >
            <MaterialCommunityIcons name="close" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section selector */}
        {(currentSong?.sections?.length ?? 0) > 1 && (
          <SongSectionPills
            sections={currentSong?.sections ?? []}
            selectedIndex={selectedSectionIndex}
            onSelect={setSelectedSectionIndex}
          />
        )}

        {/* Horizontal note strip — the "music sheet" going left to right */}
        <View style={songStyles.noteStripContainer}>
          <HorizontalNoteStrip notes={songNotes} highlightedNotes={highlightedNotes} />
        </View>

        {/* Controls row */}
        <View style={songStyles.controlsBar}>
          <View style={styles.controlsRow}>
            {!isRecording ? (
              <TouchableOpacity
                onPress={startRecording}
                style={[styles.controlBtn, styles.controlRecord]}
              >
                <MaterialCommunityIcons name="record-circle" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={stopRecording}
                style={[styles.controlBtn, styles.controlStop]}
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
                  >
                    <MaterialCommunityIcons name="stop-circle" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={playRecording}
                    style={[styles.controlBtn, styles.controlPlayback]}
                  >
                    <MaterialCommunityIcons name="play-circle" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={clearRecording}
                  style={[styles.controlBtn, styles.controlClear]}
                >
                  <MaterialCommunityIcons name="delete" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Live note + stats */}
          <View style={songStyles.liveNote}>
            <Text style={styles.noteText}>{currentNoteName || '\u2014'}</Text>
          </View>
          <Text style={styles.statsText}>{sessionNoteCount} notes</Text>
        </View>

        {/* Keyboard at the bottom — zoomed to song range */}
        <View style={songStyles.keyboardContainer}>
          <PianoKeyboard
            startNote={songKeyboardRange.startNote}
            octaveCount={songKeyboardRange.octaveCount}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
            highlightedNotes={highlightedNotes}
            enabled={true}
            hapticEnabled={true}
            showLabels={true}
            scrollable={songKeyboardRange.octaveCount > 2}
            keyHeight={130}
            testID="freeplay-keyboard-song"
          />
        </View>

        {/* Analysis card */}
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

  // --------------------------------------------------------------------------
  // Render — Free Play Mode (landscape, side-by-side keyboards)
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

// ============================================================================
// Song Mode Styles — portrait layout with note strip + keyboard at bottom
// ============================================================================

const songStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.textMuted,
  },
  closeSongBtn: {
    padding: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Section pills
  sectionPillsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sectionPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sectionPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sectionPillText: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  sectionPillTextSelected: {
    color: '#fff',
  },

  // Note strip
  noteStripContainer: {
    flex: 1,
    minHeight: 120,
    marginHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  noteStripWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  noteLabels: {
    width: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
  },
  noteLabelRow: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
  noteLabelText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  noteStripScroll: {
    flex: 1,
  },
  emptyStrip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  emptyStripText: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textMuted,
  },

  // Controls bar
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  liveNote: {
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
    minWidth: 48,
    alignItems: 'center',
    marginLeft: 'auto',
  },

  // Keyboard
  keyboardContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
});
