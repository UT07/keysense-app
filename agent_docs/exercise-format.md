# Exercise Format Specification

## Overview

Exercises are defined as JSON files in `content/exercises/`. Each exercise is a self-contained unit that defines what the user should play, how to score it, and helpful hints.

## File Location

```
content/
├── exercises/
│   ├── lesson-01/         # 5 exercises (find-middle-c, keyboard-geography, ...)
│   ├── lesson-02/         # 5 exercises (right hand melodies)
│   ├── lesson-03/         # 5 exercises (left hand basics)
│   ├── lesson-04/         # 5 exercises (both hands together)
│   ├── lesson-05/         # 5 exercises (scales & technique)
│   └── lesson-06/         # 5 exercises (popular songs)
└── lessons/
    ├── lesson-01.json     # Lesson metadata, exercise order, unlock requirements
    ├── lesson-02.json
    ├── lesson-03.json
    ├── lesson-04.json
    ├── lesson-05.json
    └── lesson-06.json
```

## Exercise Schema

```typescript
interface Exercise {
  // Identification
  id: string;                    // Unique ID: "lesson-01-ex-01"
  version: number;               // Increment when content changes
  
  // Metadata
  metadata: {
    title: string;               // "Find Middle C"
    description: string;         // "Learn to locate Middle C on the keyboard"
    difficulty: 1 | 2 | 3 | 4 | 5;
    estimatedMinutes: number;    // 2
    skills: string[];            // ["right-hand", "note-finding", "c-major"]
    prerequisites: string[];     // Exercise IDs that should be completed first
  };
  
  // Playback settings
  settings: {
    tempo: number;               // BPM (60-180)
    timeSignature: [number, number]; // [4, 4] = 4/4 time
    keySignature: string;        // "C", "G", "F", etc.
    countIn: number;             // Beats before exercise starts (0-4)
    metronomeEnabled: boolean;   // Show/play metronome
    loopEnabled: boolean;        // Allow looping for practice
  };
  
  // The notes to play
  notes: NoteEvent[];
  
  // Scoring configuration
  scoring: {
    timingToleranceMs: number;   // ±ms for "perfect" (25-50)
    timingGracePeriodMs: number; // ±ms for "good" (100-200)
    velocitySensitive: boolean;  // Score based on dynamics?
    passingScore: number;        // 0-100, required to pass
    starThresholds: [number, number, number]; // [70, 85, 95]
  };
  
  // User guidance
  hints: {
    beforeStart: string;         // Shown before exercise begins
    commonMistakes: CommonMistake[];
    successMessage: string;      // Shown on completion
  };
  
  // Visual settings
  display: {
    showFingerNumbers: boolean;
    showNoteNames: boolean;
    highlightHands: boolean;     // Color-code left/right hand
    showPianoRoll: boolean;      // Scrolling note display
    showStaffNotation: boolean;  // Traditional music notation
  };
}

interface NoteEvent {
  note: number;           // MIDI note number (60 = Middle C)
  startBeat: number;      // When to play (0 = first beat)
  durationBeats: number;  // How long (1 = quarter note in 4/4)
  hand?: 'left' | 'right'; // Which hand should play
  finger?: 1 | 2 | 3 | 4 | 5; // Suggested fingering (1=thumb)
  optional?: boolean;     // Extra credit, not required for passing
}

interface CommonMistake {
  pattern: string;        // Description of the mistake pattern
  advice: string;         // How to fix it
  triggerCondition?: {    // When to show this hint
    type: 'timing' | 'pitch' | 'sequence';
    threshold: number;
  };
}
```

## Example Exercise

```json
{
  "id": "lesson-01-ex-03",
  "version": 1,
  "metadata": {
    "title": "C-D-E Ascending",
    "description": "Play the first three notes of the C major scale with your right hand.",
    "difficulty": 1,
    "estimatedMinutes": 2,
    "skills": ["right-hand", "c-major", "quarter-notes", "finger-placement"],
    "prerequisites": ["lesson-01-ex-01", "lesson-01-ex-02"]
  },
  "settings": {
    "tempo": 60,
    "timeSignature": [4, 4],
    "keySignature": "C",
    "countIn": 4,
    "metronomeEnabled": true,
    "loopEnabled": true
  },
  "notes": [
    { "note": 60, "startBeat": 0, "durationBeats": 1, "hand": "right", "finger": 1 },
    { "note": 62, "startBeat": 1, "durationBeats": 1, "hand": "right", "finger": 2 },
    { "note": 64, "startBeat": 2, "durationBeats": 1, "hand": "right", "finger": 3 },
    { "note": 60, "startBeat": 4, "durationBeats": 1, "hand": "right", "finger": 1 },
    { "note": 62, "startBeat": 5, "durationBeats": 1, "hand": "right", "finger": 2 },
    { "note": 64, "startBeat": 6, "durationBeats": 1, "hand": "right", "finger": 3 }
  ],
  "scoring": {
    "timingToleranceMs": 50,
    "timingGracePeriodMs": 150,
    "velocitySensitive": false,
    "passingScore": 70,
    "starThresholds": [70, 85, 95]
  },
  "hints": {
    "beforeStart": "Place your thumb (finger 1) on Middle C. Keep your wrist relaxed and fingers curved.",
    "commonMistakes": [
      {
        "pattern": "rushing",
        "advice": "Try counting '1-2-3-4' out loud with the metronome. Each note should land exactly on a beat.",
        "triggerCondition": { "type": "timing", "threshold": -100 }
      },
      {
        "pattern": "wrong-finger",
        "advice": "Use thumb-index-middle (1-2-3) for C-D-E. This fingering will help with longer scales."
      }
    ],
    "successMessage": "Great job! You've played your first scale pattern. Ready for more notes?"
  },
  "display": {
    "showFingerNumbers": true,
    "showNoteNames": true,
    "highlightHands": true,
    "showPianoRoll": true,
    "showStaffNotation": false
  }
}
```

## MIDI Note Reference

```
Octave:  0    1    2    3    4    5    6    7    8
C:      12   24   36   48   60   72   84   96   108
                         ↑
                    Middle C (C4)

Common notes:
- Middle C (C4): 60
- A440 (A4): 69
- Low bass C (C2): 36
- High treble C (C6): 84
```

## Beat and Duration Reference

```
4/4 Time Signature (most common):
- Whole note:    4 beats
- Half note:     2 beats
- Quarter note:  1 beat
- Eighth note:   0.5 beats
- Sixteenth:     0.25 beats

Dotted notes (1.5x duration):
- Dotted half:   3 beats
- Dotted quarter: 1.5 beats

Example measure:
Beat:     0     1     2     3     4
          |-----|-----|-----|-----|
Quarter:  [  Q  ][  Q  ][  Q  ][  Q  ]
Eighth:   [E][E][E][E][E][E][E][E]
```

## Validation Rules

Before an exercise can be used:

1. **ID Uniqueness:** No duplicate exercise IDs
2. **Note Range:** All notes between 21-108 (piano range)
3. **Beat Alignment:** Notes don't overlap (unless chords)
4. **Duration Valid:** All durations > 0
5. **Scoring Sensible:** passingScore ≤ starThresholds[0]
6. **Prerequisites Exist:** All referenced exercises exist

## Creating New Exercises

1. Copy an existing exercise as a template
2. Update the ID (must be unique)
3. Modify notes using the beat/MIDI reference
4. Set appropriate scoring tolerances:
   - Beginners: 75ms timing, 200ms grace
   - Intermediate: 50ms timing, 150ms grace
   - Advanced: 25ms timing, 100ms grace
5. Write helpful hints for common mistakes
6. Run `npm run validate:exercises` to check for errors
7. Test the exercise manually before committing

## Lesson Manifest

Lessons group exercises and define unlock requirements:

```json
{
  "id": "lesson-01",
  "title": "Getting Started",
  "description": "Learn the basics of the keyboard",
  "exercises": [
    "lesson-01-ex-01",
    "lesson-01-ex-02",
    "lesson-01-ex-03"
  ],
  "unlockRequirement": null,
  "xpReward": 100,
  "estimatedMinutes": 10
}

{
  "id": "lesson-02",
  "title": "Right Hand Melodies",
  "description": "Simple melodies using C-D-E-F-G",
  "exercises": [...],
  "unlockRequirement": {
    "type": "lesson-complete",
    "lessonId": "lesson-01"
  },
  "xpReward": 150,
  "estimatedMinutes": 15
}
```
