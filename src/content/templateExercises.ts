/**
 * Offline template exercises — fallback when AI generation is unavailable.
 * 15 templates (5 easy, 5 medium, 5 hard) with note-swapping logic
 * to target the player's weak notes.
 */
import type { Exercise, NoteEvent } from '@/core/exercises/types';
import { getGenerationHints } from '@/core/curriculum/SkillTree';

interface ExerciseTemplate {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  baseNotes: number[];
  tempo: number;
  keySignature: string;
  hand: 'left' | 'right' | 'both';
  skillId?: string;
  buildNotes: () => NoteEvent[];
}

// --- Helpers ---

function qn(note: number, startBeat: number, hand?: 'left' | 'right'): NoteEvent {
  return { note, startBeat, durationBeats: 1, ...(hand && { hand }) };
}

function hn(note: number, startBeat: number, hand?: 'left' | 'right'): NoteEvent {
  return { note, startBeat, durationBeats: 2, ...(hand && { hand }) };
}

function en(note: number, startBeat: number, hand?: 'left' | 'right'): NoteEvent {
  return { note, startBeat, durationBeats: 0.5, ...(hand && { hand }) };
}

// --- Templates ---

const templates: ExerciseTemplate[] = [
  // ── Easy (difficulty 1, tempo 50-60) ──
  {
    id: 'tmpl-easy-01', title: 'C Position Walk', difficulty: 1,
    baseNotes: [60, 62, 64, 65, 67], tempo: 55, keySignature: 'C', hand: 'right',
    buildNotes: () => [qn(60, 0), qn(62, 1), qn(64, 2), qn(65, 3), qn(67, 4)],
  },
  {
    id: 'tmpl-easy-02', title: 'Two-Note Bounce', difficulty: 1,
    baseNotes: [60, 64], tempo: 55, keySignature: 'C', hand: 'right',
    buildNotes: () => [qn(60, 0), qn(64, 1), qn(60, 2), qn(64, 3), qn(60, 4)],
  },
  {
    id: 'tmpl-easy-03', title: 'Mirror Steps', difficulty: 1,
    baseNotes: [48, 50, 52, 53, 55], tempo: 50, keySignature: 'C', hand: 'left',
    buildNotes: () =>
      [qn(48, 0, 'left'), qn(50, 1, 'left'), qn(52, 2, 'left'), qn(53, 3, 'left'), qn(55, 4, 'left')],
  },
  {
    id: 'tmpl-easy-04', title: 'Steady Quarters', difficulty: 1,
    baseNotes: [55], tempo: 60, keySignature: 'C', hand: 'left',
    buildNotes: () =>
      [qn(55, 0, 'left'), qn(55, 1, 'left'), qn(55, 2, 'left'), qn(55, 3, 'left')],
  },
  {
    id: 'tmpl-easy-05', title: 'C Major Triad', difficulty: 1,
    baseNotes: [60, 64, 67], tempo: 55, keySignature: 'C', hand: 'right',
    buildNotes: () => [hn(60, 0), hn(64, 2), hn(67, 4)],
  },

  // ── Medium (difficulty 2, tempo 70-80) ──
  {
    id: 'tmpl-med-01', title: 'Scale Up Down', difficulty: 2,
    baseNotes: [60, 62, 64, 65, 67], tempo: 75, keySignature: 'C', hand: 'right',
    buildNotes: () =>
      [en(60, 0), en(62, 0.5), en(64, 1), en(65, 1.5), en(67, 2), en(65, 2.5), en(64, 3), en(62, 3.5)],
  },
  {
    id: 'tmpl-med-02', title: 'Broken Chord', difficulty: 2,
    baseNotes: [60, 64, 67], tempo: 70, keySignature: 'C', hand: 'right',
    buildNotes: () =>
      [qn(60, 0), qn(64, 1), qn(67, 2), qn(64, 3), qn(60, 4), qn(64, 5), qn(67, 6), qn(64, 7)],
  },
  {
    id: 'tmpl-med-03', title: 'Bass Walk', difficulty: 2,
    baseNotes: [48, 52, 55, 60], tempo: 75, keySignature: 'C', hand: 'left',
    buildNotes: () =>
      [qn(48, 0, 'left'), qn(52, 1, 'left'), qn(55, 2, 'left'), qn(60, 3, 'left'),
       qn(55, 4, 'left'), qn(52, 5, 'left'), qn(48, 6, 'left')],
  },
  {
    id: 'tmpl-med-04', title: 'Dotted Rhythm', difficulty: 2,
    baseNotes: [60, 62, 64, 65], tempo: 80, keySignature: 'C', hand: 'right',
    buildNotes: () => [
      { note: 60, startBeat: 0, durationBeats: 1.5 },
      { note: 62, startBeat: 1.5, durationBeats: 0.5 },
      { note: 64, startBeat: 2, durationBeats: 1.5 },
      { note: 65, startBeat: 3.5, durationBeats: 0.5 },
    ],
  },
  {
    id: 'tmpl-med-05', title: 'Two Hands', difficulty: 2,
    baseNotes: [48, 52, 55, 60, 64, 67], tempo: 70, keySignature: 'C', hand: 'both',
    buildNotes: () => [
      qn(60, 0, 'right'), qn(48, 1, 'left'), qn(64, 2, 'right'),
      qn(52, 3, 'left'), qn(67, 4, 'right'), qn(55, 5, 'left'),
    ],
  },

  // ── Hard (difficulty 3, tempo 90-100) ──
  {
    id: 'tmpl-hard-01', title: 'Speed Scale', difficulty: 3,
    baseNotes: [60, 62, 64, 65, 67, 69, 71, 72], tempo: 95, keySignature: 'C', hand: 'right',
    buildNotes: () =>
      [en(60, 0), en(62, 0.5), en(64, 1), en(65, 1.5), en(67, 2), en(69, 2.5), en(71, 3), en(72, 3.5)],
  },
  {
    id: 'tmpl-hard-02', title: 'Accidentals', difficulty: 3,
    baseNotes: [60, 61, 64, 66, 67, 70, 72], tempo: 90, keySignature: 'C', hand: 'right',
    buildNotes: () =>
      [qn(60, 0), qn(61, 1), qn(64, 2), qn(66, 3), qn(67, 4), qn(70, 5), qn(72, 6)],
  },
  {
    id: 'tmpl-hard-03', title: 'Syncopation', difficulty: 3,
    baseNotes: [60, 62, 64, 67], tempo: 95, keySignature: 'C', hand: 'right',
    buildNotes: () => [
      qn(60, 0), en(62, 1.5), en(64, 2), qn(67, 3),
      en(60, 4.5), qn(64, 5), en(62, 6.5), qn(67, 7),
    ],
  },
  {
    id: 'tmpl-hard-04', title: 'Left Hand Chord', difficulty: 3,
    baseNotes: [48, 52, 55, 53, 57, 60], tempo: 90, keySignature: 'C', hand: 'left',
    buildNotes: () => [
      hn(48, 0, 'left'), hn(52, 0, 'left'), hn(55, 0, 'left'),
      hn(53, 2, 'left'), hn(57, 2, 'left'), hn(60, 2, 'left'),
    ],
  },
  {
    id: 'tmpl-hard-05', title: 'Cross Hands', difficulty: 3,
    baseNotes: [48, 50, 52, 67, 69, 71], tempo: 100, keySignature: 'C', hand: 'both',
    buildNotes: () => [
      qn(48, 0, 'left'), qn(67, 1, 'right'), qn(50, 2, 'left'),
      qn(69, 3, 'right'), qn(52, 4, 'left'), qn(71, 5, 'right'),
    ],
  },

  // ── Skill-targeted (no difficulty tier, used by getTemplateForSkill) ──
  {
    id: 'tmpl-skill-middle-c', title: 'Middle C Repeat', difficulty: 1,
    baseNotes: [60], tempo: 50, keySignature: 'C', hand: 'right',
    skillId: 'find-middle-c',
    buildNotes: () => [qn(60, 0), qn(60, 1), qn(60, 2), qn(60, 3), hn(60, 4)],
  },
  {
    id: 'tmpl-skill-keyboard-geo', title: 'Keyboard Explorer', difficulty: 1,
    baseNotes: [60, 62, 64], tempo: 50, keySignature: 'C', hand: 'right',
    skillId: 'keyboard-geography',
    buildNotes: () => [qn(60, 0), qn(62, 1), qn(64, 2), qn(62, 3), qn(60, 4)],
  },
  {
    id: 'tmpl-skill-white-keys', title: 'White Key Walk', difficulty: 1,
    baseNotes: [60, 62, 64, 65, 67, 69, 71, 72], tempo: 50, keySignature: 'C', hand: 'right',
    skillId: 'white-keys',
    buildNotes: () => [qn(60, 0), qn(62, 1), qn(64, 2), qn(65, 3), qn(67, 4), qn(69, 5), qn(71, 6), qn(72, 7)],
  },
  {
    id: 'tmpl-skill-rh-cde', title: 'C-D-E Steps', difficulty: 1,
    baseNotes: [60, 62, 64], tempo: 55, keySignature: 'C', hand: 'right',
    skillId: 'rh-cde',
    buildNotes: () => [qn(60, 0), qn(62, 1), qn(64, 2), qn(60, 3), qn(62, 4), qn(64, 5), hn(64, 6)],
  },
  {
    id: 'tmpl-skill-melodies', title: 'Simple Melody', difficulty: 1,
    baseNotes: [60, 62, 64, 65, 67], tempo: 55, keySignature: 'C', hand: 'right',
    skillId: 'simple-melodies',
    buildNotes: () => [qn(64, 0), qn(64, 1), qn(65, 2), qn(67, 3), qn(65, 4), qn(64, 5), qn(62, 6), hn(60, 7)],
  },
  {
    id: 'tmpl-skill-c-review', title: 'C Position Review', difficulty: 2,
    baseNotes: [60, 62, 64, 65, 67], tempo: 65, keySignature: 'C', hand: 'right',
    skillId: 'c-position-review',
    buildNotes: () => [
      qn(60, 0), qn(62, 1), qn(64, 2), qn(65, 3),
      qn(67, 4), qn(65, 5), qn(64, 6), qn(62, 7),
      hn(60, 8),
    ],
  },
  {
    id: 'tmpl-skill-lh-descending', title: 'Left Hand Descend', difficulty: 2,
    baseNotes: [60, 59, 57, 55, 53, 52, 50, 48], tempo: 60, keySignature: 'C', hand: 'left',
    skillId: 'lh-scale-descending',
    buildNotes: () => [
      qn(60, 0, 'left'), qn(59, 1, 'left'), qn(57, 2, 'left'), qn(55, 3, 'left'),
      qn(53, 4, 'left'), qn(52, 5, 'left'), qn(50, 6, 'left'), hn(48, 7, 'left'),
    ],
  },
  {
    id: 'tmpl-skill-lh-broken', title: 'Left Hand Broken Chord', difficulty: 2,
    baseNotes: [48, 53, 57], tempo: 65, keySignature: 'C', hand: 'left',
    skillId: 'lh-broken-chords',
    buildNotes: () => [
      qn(48, 0, 'left'), qn(53, 1, 'left'), qn(57, 2, 'left'),
      qn(53, 3, 'left'), qn(48, 4, 'left'), qn(53, 5, 'left'),
      hn(57, 6, 'left'),
    ],
  },
];

// --- Note swapping ---

function swapNotes(notes: NoteEvent[], baseNotes: number[], weakNotes: number[]): NoteEvent[] {
  if (weakNotes.length === 0) return notes;

  // Build a map: old MIDI note -> new MIDI note
  const swapMap = new Map<number, number>();
  const availableBase = [...baseNotes];

  for (const weak of weakNotes) {
    // Skip if already present in the template
    if (availableBase.includes(weak)) continue;
    if (availableBase.length === 0) break;

    // Find the closest base note (within 12 semitones)
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < availableBase.length; i++) {
      const dist = Math.abs(availableBase[i] - weak);
      if (dist <= 12 && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      swapMap.set(availableBase[bestIdx], weak);
      availableBase.splice(bestIdx, 1);
    }
  }

  if (swapMap.size === 0) return notes;

  return notes.map((n) => {
    const replacement = swapMap.get(n.note);
    return replacement !== undefined ? { ...n, note: replacement } : n;
  });
}

// --- Build full Exercise from template ---

function templateToExercise(template: ExerciseTemplate, swappedNotes: NoteEvent[]): Exercise {
  return {
    id: template.id,
    version: 1,
    metadata: {
      title: `Practice: ${template.title}`,
      description: 'AI fallback exercise targeting your weak areas',
      difficulty: template.difficulty,
      estimatedMinutes: 2,
      skills: ['adaptive', template.hand === 'both' ? 'two-hands' : `${template.hand}-hand`],
      prerequisites: [],
    },
    settings: {
      tempo: template.tempo,
      timeSignature: [4, 4],
      keySignature: template.keySignature,
      countIn: 4,
      metronomeEnabled: true,
    },
    notes: swappedNotes,
    scoring: {
      timingToleranceMs: template.difficulty === 1 ? 100 : template.difficulty === 2 ? 80 : 65,
      timingGracePeriodMs: 200,
      passingScore: 60,
      starThresholds: [70, 85, 95],
    },
    hints: {
      beforeStart: 'Practice exercise \u2014 play along with the metronome!',
      commonMistakes: [],
      successMessage: 'Great practice session!',
    },
    hands: template.hand,
  };
}

// --- Public API ---

export function getTemplateExercise(
  difficulty: 1 | 2 | 3,
  weakNotes: number[] = [],
): Exercise {
  // Filter to generic templates (no skillId) to keep tempo ranges predictable
  const tier = templates.filter((t) => t.difficulty === difficulty && !t.skillId);

  // Rank by overlap with weak notes (descending)
  const ranked = tier
    .map((t) => ({
      template: t,
      overlap: t.baseNotes.filter((n) => weakNotes.includes(n)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap);

  let chosen: ExerciseTemplate;
  if (ranked[0].overlap > 0) {
    // Pick from templates with the best overlap
    const bestOverlap = ranked[0].overlap;
    const best = ranked.filter((r) => r.overlap === bestOverlap);
    chosen = best[Math.floor(Math.random() * best.length)].template;
  } else {
    // No overlap — random from tier
    chosen = tier[Math.floor(Math.random() * tier.length)];
  }

  const rawNotes = chosen.buildNotes();
  const swappedNotes = swapNotes(rawNotes, chosen.baseNotes, weakNotes);

  // No transposition — it breaks the title/keySignature contract
  // (e.g. "C Position Walk" would contain F# notes after +7 semitones).
  // Weak-note swapping already provides enough variety.
  const exercise = templateToExercise(chosen, swappedNotes);

  // Slight tempo variation (±5 BPM) so repeated fallbacks feel different
  const tempoVariation = Math.floor(Math.random() * 11) - 5;
  exercise.settings.tempo = Math.max(40, exercise.settings.tempo + tempoVariation);

  return exercise;
}

/**
 * Get a template exercise targeting a specific skill.
 * Falls back to `getTemplateExercise()` if no skill-specific template exists.
 *
 * To prevent repetition when the buffer is empty, templates are randomly
 * transposed to different keys and given slight tempo variation.
 */
/**
 * Build a simple exercise directly from GENERATION_HINTS when no
 * skill-specific template exists. Uses the targetMidi notes to create
 * a pattern that actually matches the skill's key and hand.
 */
function buildExerciseFromHints(
  skillId: string,
  _weakNotes: number[] = [],
): Exercise | null {
  const hints = getGenerationHints(skillId);
  if (!hints || !hints.targetMidi || hints.targetMidi.length === 0) return null;

  const midi = hints.targetMidi;
  const hand = hints.hand ?? 'right';
  const difficulty = hints.minDifficulty ?? 1;
  const keySignature = hints.keySignature ?? 'C major';

  // Build a simple ascending-descending pattern from the available notes
  const noteSequence: NoteEvent[] = [];
  let beat = 0;

  // Ascending
  for (const note of midi) {
    noteSequence.push({
      note,
      startBeat: beat,
      durationBeats: 1,
      ...(hand !== 'both' && { hand }),
      ...(hand === 'both' && { hand: note < 60 ? 'left' as const : 'right' as const }),
    });
    beat += 1;
  }

  // Descending (skip first and last to avoid repetition)
  if (midi.length > 2) {
    const descending = [...midi].reverse().slice(1, -1);
    for (const note of descending) {
      noteSequence.push({
        note,
        startBeat: beat,
        durationBeats: 1,
        ...(hand !== 'both' && { hand }),
        ...(hand === 'both' && { hand: note < 60 ? 'left' as const : 'right' as const }),
      });
      beat += 1;
    }
  }

  // Derive a title from the keySignature
  const keyShort = keySignature.replace(' major', '').replace(' minor', 'm');
  const titleSuffix = hints.exerciseTypes?.[0] === 'chord' ? 'Chord Practice'
    : hints.exerciseTypes?.[0] === 'scale' ? 'Scale Practice'
    : hints.exerciseTypes?.[0] === 'rhythm' ? 'Rhythm Practice'
    : 'Practice';
  const title = `${keyShort} ${titleSuffix}`;

  // Base tempo from difficulty
  const baseTempo = difficulty <= 1 ? 55 : difficulty <= 2 ? 65 : 80;
  const tempoVariation = Math.floor(Math.random() * 11) - 5;

  return {
    id: `tmpl-hints-${skillId}`,
    version: 1,
    metadata: {
      title: `Practice: ${title}`,
      description: hints.promptHint ?? 'Practice exercise targeting your current skill',
      difficulty: Math.min(difficulty, 3) as 1 | 2 | 3 | 4 | 5,
      estimatedMinutes: 2,
      skills: ['adaptive', hand === 'both' ? 'two-hands' : `${hand}-hand`],
      prerequisites: [],
    },
    settings: {
      tempo: Math.max(40, baseTempo + tempoVariation),
      timeSignature: [4, 4],
      keySignature,
      countIn: 4,
      metronomeEnabled: true,
    },
    notes: noteSequence,
    scoring: {
      timingToleranceMs: difficulty <= 1 ? 100 : difficulty <= 2 ? 80 : 65,
      timingGracePeriodMs: 200,
      passingScore: 60,
      starThresholds: [70, 85, 95],
    },
    hints: {
      beforeStart: hints.promptHint ?? 'Practice exercise \u2014 play along with the metronome!',
      commonMistakes: [],
      successMessage: 'Great practice session!',
    },
    hands: hand,
  };
}

export function getTemplateForSkill(
  skillId: string,
  weakNotes: number[] = [],
): Exercise {
  // Find templates matching this skill
  const matches = templates.filter((t) => t.skillId === skillId);

  if (matches.length === 0) {
    // No skill-specific template — try to build from GENERATION_HINTS
    // so notes/key/hand actually match the skill
    const hintsExercise = buildExerciseFromHints(skillId, weakNotes);
    if (hintsExercise) return hintsExercise;

    // Last resort: use difficulty 1 generic template (no transposition)
    return getTemplateExercise(1, weakNotes);
  }

  // Pick the best match based on weak note overlap, with randomization for ties
  const ranked = matches
    .map((t) => ({
      template: t,
      overlap: t.baseNotes.filter((n) => weakNotes.includes(n)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap);

  const bestOverlap = ranked[0].overlap;
  const best = ranked.filter((r) => r.overlap === bestOverlap);
  const chosen = best[Math.floor(Math.random() * best.length)].template;

  const rawNotes = chosen.buildNotes();
  const swappedNotes = swapNotes(rawNotes, chosen.baseNotes, weakNotes);

  // No transposition — it breaks the title/keySignature contract.
  const exercise = templateToExercise(chosen, swappedNotes);

  // Apply slight tempo variation (±5 BPM)
  const tempoVariation = Math.floor(Math.random() * 11) - 5;
  exercise.settings.tempo = Math.max(40, exercise.settings.tempo + tempoVariation);

  return exercise;
}
