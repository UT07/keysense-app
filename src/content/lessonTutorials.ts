/**
 * Lesson Tutorial Content
 * Beginner-friendly instructions for each lesson explaining what to do.
 * Shown as a dismissible overlay before the first exercise, toggleable in settings.
 */

export interface LessonTutorial {
  lessonId: string;
  title: string;
  steps: Array<{
    icon: string; // MaterialCommunityIcons name
    text: string;
  }>;
  tip: string;
}

const LESSON_TUTORIALS: Record<string, LessonTutorial> = {
  'lesson-01': {
    lessonId: 'lesson-01',
    title: 'How This Works',
    steps: [
      { icon: 'piano', text: 'Tap the highlighted keys on the piano when they light up' },
      { icon: 'music-note', text: 'Notes fall from top to bottom — play them as they reach the line' },
      { icon: 'timer-outline', text: 'Try to match the timing — earlier or later affects your score' },
      { icon: 'star-outline', text: 'Score 60% or higher to pass and move to the next exercise' },
    ],
    tip: 'Start slow — accuracy matters more than speed!',
  },
  'lesson-02': {
    lessonId: 'lesson-02',
    title: 'Playing Melodies',
    steps: [
      { icon: 'hand-pointing-right', text: 'Place your right thumb on Middle C (labeled on the keyboard)' },
      { icon: 'arrow-right', text: 'Your fingers cover C-D-E-F-G — one finger per key' },
      { icon: 'metronome', text: 'Listen for the count-in beat before each exercise starts' },
      { icon: 'music-note-eighth', text: 'Some notes are shorter (eighth notes) — tap quickly!' },
    ],
    tip: 'If you miss a note, keep going — the next one is coming!',
  },
  'lesson-03': {
    lessonId: 'lesson-03',
    title: 'Using Your Left Hand',
    steps: [
      { icon: 'hand-pointing-left', text: 'Place your left pinky on C3 (one octave below Middle C)' },
      { icon: 'arrow-down', text: 'Left hand plays bass notes — the lower keys on the keyboard' },
      { icon: 'swap-horizontal', text: 'The keyboard scrolls to show where you need to play' },
      { icon: 'music-clef-bass', text: 'Bass notes are deeper — you\'ll feel the difference!' },
    ],
    tip: 'Practice each hand separately before trying them together.',
  },
  'lesson-04': {
    lessonId: 'lesson-04',
    title: 'Both Hands Together',
    steps: [
      { icon: 'hand-back-left', text: 'Left hand plays bass (lower keys), right hand plays melody (higher keys)' },
      { icon: 'eye', text: 'Watch the piano roll — notes for each hand appear at different heights' },
      { icon: 'turtle', text: 'Start very slowly — coordinating two hands takes practice' },
      { icon: 'repeat', text: 'Retry exercises as many times as you need — your best score is saved' },
    ],
    tip: 'Focus on getting each hand comfortable separately first, then combine.',
  },
  'lesson-05': {
    lessonId: 'lesson-05',
    title: 'Scale Technique',
    steps: [
      { icon: 'stairs', text: 'Scales go up and down the keyboard step by step' },
      { icon: 'speedometer', text: 'These exercises get faster — build speed gradually' },
      { icon: 'hand-wave', text: 'Keep your fingers curved and relaxed, not flat' },
      { icon: 'sync', text: 'Parallel scales: both hands move in the same direction at once' },
    ],
    tip: 'Evenness is key — every note should be the same volume and length.',
  },
  'lesson-06': {
    lessonId: 'lesson-06',
    title: 'Playing Real Songs',
    steps: [
      { icon: 'music', text: 'These are real songs you\'ll recognize — have fun with them!' },
      { icon: 'headphones', text: 'Listen to the melody in your head first, then play along' },
      { icon: 'heart', text: 'Expression matters — try playing some notes louder or softer' },
      { icon: 'trophy', text: 'Aim for 3 stars on each song — you\'ve earned it!' },
    ],
    tip: 'You\'ve come a long way — enjoy making real music!',
  },
};

export function getLessonTutorial(lessonId: string): LessonTutorial | null {
  return LESSON_TUTORIALS[lessonId] ?? null;
}

export function getAllLessonTutorials(): LessonTutorial[] {
  return Object.values(LESSON_TUTORIALS);
}
