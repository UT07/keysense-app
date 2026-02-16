/**
 * Cat Character Avatar System
 * 8 unique music-themed cat characters with distinct visual identities
 */

export type CatVariant = 'default' | 'tuxedo';
export type CatPattern = 'solid' | 'tuxedo' | 'tabby' | 'siamese' | 'spotted';

export interface CatVisuals {
  bodyColor: string;
  bellyColor: string;
  earInnerColor: string;
  eyeColor: string;
  noseColor: string;
  pattern: CatPattern;
}

export interface CatCharacter {
  id: string;
  name: string;
  emoji: string;
  backstory: string;
  musicSkill: string;
  personality: string;
  /** Accent color for headphones, UI elements */
  color: string;
  unlockLevel: number;
  variant?: CatVariant;
  visuals: CatVisuals;
}

export const CAT_CHARACTERS: CatCharacter[] = [
  {
    id: 'mini-meowww',
    name: 'Mini Meowww',
    emoji: '🐱✨',
    backstory:
      'The tiniest tuxedo cat you\'ve ever seen — she fits in a teacup but has the confidence of a concert pianist. She snuck into Juilliard in someone\'s coat pocket and graduated top of her class before anyone noticed. Her paws are so small she can only play one key at a time, but she makes every single note count.',
    musicSkill: 'Precision & Expression',
    personality: 'Tiny but Mighty',
    color: '#DC143C',
    unlockLevel: 1,
    variant: 'tuxedo',
    visuals: {
      bodyColor: '#1A1A1A',
      bellyColor: '#F5F5F5',
      earInnerColor: '#DC143C',
      eyeColor: '#2ECC71',
      noseColor: '#DC143C',
      pattern: 'tuxedo',
    },
  },
  {
    id: 'jazzy',
    name: 'Jazzy',
    emoji: '\uD83D\uDE0E\uD83C\uDFB7',
    backstory:
      'A cool alley cat from New Orleans who taught herself saxophone on the rooftops at midnight. The neighborhood dogs howled along at first, but now they quietly gather below to listen. She once improvised a solo so smooth that a pigeon fell asleep mid-flight.',
    musicSkill: 'Jazz Improvisation',
    personality: 'Cool & Smooth',
    color: '#9B59B6',
    unlockLevel: 2,
    visuals: {
      bodyColor: '#4A4A6A',
      bellyColor: '#6B6B8A',
      earInnerColor: '#9B59B6',
      eyeColor: '#D4A5FF',
      noseColor: '#9B59B6',
      pattern: 'solid',
    },
  },
  {
    id: 'chonky-monke',
    name: 'Chonky Monké',
    emoji: '🍊🐈',
    backstory:
      'An absolute UNIT of an orange & white cat who weighs 22 pounds and is proud of every single one. He learned piano by sitting on the keys — turns out when you\'re that chonky, you hit perfect chords every time. His signature move is the "Belly Slam Fortissimo" where he flops onto the keyboard for a dramatic finale. Has his own trading card.',
    musicSkill: 'Power Chords & Bass',
    personality: 'Absolute Unit',
    color: '#FF8C00',
    unlockLevel: 3,
    visuals: {
      bodyColor: '#E8871E',
      bellyColor: '#FFF3E0',
      earInnerColor: '#FFB74D',
      eyeColor: '#FFD54F',
      noseColor: '#FF8C00',
      pattern: 'tabby',
    },
  },
  {
    id: 'luna',
    name: 'Luna',
    emoji: '\uD83D\uDC08\uD83C\uDF19',
    backstory:
      'A mysterious black cat who only plays haunting melodies under the full moon. Legend says she learned piano from a ghost in an abandoned concert hall. Nobody has ever heard her play the same piece twice, and those who listen swear the music follows them home.',
    musicSkill: 'Moonlight Compositions',
    personality: 'Mysterious',
    color: '#5B6EAE',
    unlockLevel: 5,
    visuals: {
      bodyColor: '#1C1C3A',
      bellyColor: '#2A2A52',
      earInnerColor: '#5B6EAE',
      eyeColor: '#7EB8FF',
      noseColor: '#3D4F8A',
      pattern: 'solid',
    },
  },
  {
    id: 'biscuit',
    name: 'Biscuit',
    emoji: '\uD83D\uDE3B\uD83C\uDF6A',
    backstory:
      'A fluffy persian who refuses to play in any key except C major because "it feels like warm cookies fresh from the oven." She practices exclusively on a pink grand piano and takes a nap between every piece. Her recitals always include a snack break.',
    musicSkill: 'C Major Specialist',
    personality: 'Cozy & Warm',
    color: '#F39C9C',
    unlockLevel: 8,
    visuals: {
      bodyColor: '#F5D5C8',
      bellyColor: '#FFF0EB',
      earInnerColor: '#F39C9C',
      eyeColor: '#81D4FA',
      noseColor: '#F48FB1',
      pattern: 'solid',
    },
  },
  {
    id: 'vinyl',
    name: 'Vinyl',
    emoji: '\uD83E\uDDD0\uD83C\uDFB6',
    backstory:
      'A hipster cat with tiny round glasses who owns 3,000 vinyl records and insists everything sounds better on analog. He DJs underground warehouse parties for cats and somehow always finds the most obscure B-sides. He calls mainstream music "basic meow-sic."',
    musicSkill: 'DJ & Mixing',
    personality: 'Hipster',
    color: '#1ABC9C',
    unlockLevel: 12,
    visuals: {
      bodyColor: '#607D8B',
      bellyColor: '#90A4AE',
      earInnerColor: '#1ABC9C',
      eyeColor: '#1ABC9C',
      noseColor: '#546E7A',
      pattern: 'spotted',
    },
  },
  {
    id: 'aria',
    name: 'Aria',
    emoji: '\uD83D\uDC08\uD83C\uDFB5',
    backstory:
      'An elegant siamese with perfect pitch who trained at La Scala in Milan. She can shatter a wine glass with a high C and once sang a duet with a nightingale that made the entire garden weep. She considers herself a "vocal athlete" and does warm-ups at 5 AM.',
    musicSkill: 'Opera & Perfect Pitch',
    personality: 'Elegant',
    color: '#FFD700',
    unlockLevel: 15,
    visuals: {
      bodyColor: '#F5E6D3',
      bellyColor: '#FFF8F0',
      earInnerColor: '#8B6914',
      eyeColor: '#4FC3F7',
      noseColor: '#8B6914',
      pattern: 'siamese',
    },
  },
  {
    id: 'tempo',
    name: 'Tempo',
    emoji: '\uD83D\uDE3C\u26A1',
    backstory:
      'A hyperactive ginger kitten who can play any song at double speed without missing a single note. Scientists tried to study his paws but he moved too fast for the cameras. He has been banned from three music schools for "unauthorized tempo modifications."',
    musicSkill: 'Speed Playing',
    personality: 'Hyperactive',
    color: '#E74C3C',
    unlockLevel: 20,
    visuals: {
      bodyColor: '#D4553A',
      bellyColor: '#FFCCBC',
      earInnerColor: '#E74C3C',
      eyeColor: '#FFEB3B',
      noseColor: '#E74C3C',
      pattern: 'tabby',
    },
  },
];

/** Get a cat character by its ID */
export function getCatById(id: string): CatCharacter | undefined {
  return CAT_CHARACTERS.find((cat) => cat.id === id);
}

/** Get the default cat (lowest unlock level) */
export function getDefaultCat(): CatCharacter {
  return CAT_CHARACTERS[0];
}

/** Get all cats available at a given level */
export function getUnlockedCats(level: number): CatCharacter[] {
  return CAT_CHARACTERS.filter((cat) => cat.unlockLevel <= level);
}

/** Check if a specific cat is unlocked at the given level */
export function isCatUnlocked(catId: string, level: number): boolean {
  const cat = getCatById(catId);
  if (!cat) return false;
  return cat.unlockLevel <= level;
}
