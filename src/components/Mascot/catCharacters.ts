/**
 * Cat Character Avatar System
 * 12 unique music-themed cat characters with distinct visual identities,
 * evolution stages, abilities, and gem costs.
 *
 * 3 starters (free pick, others 500 gems)
 * 8 gem-unlockable (750-3000 gems)
 * 1 legendary: Chonky Monké (300-day streak OR 100 skills mastered)
 */

import type { EvolutionStage, CatAbility, CatStageVisuals, AbilityEffect } from '@/stores/types';
import { getCatColors } from './catColorPalette';

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
  /** Is this a starter cat (free pick during onboarding) */
  starterCat: boolean;
  /** Gem cost to unlock. null = starter or legendary (special unlock) */
  gemCost: number | null;
  /** Whether this is a legendary cat with special unlock requirements */
  legendary: boolean;
  /** Per-stage visual overrides for evolution rendering */
  evolutionVisuals: Record<EvolutionStage, CatStageVisuals>;
  /** Abilities unlocked at each evolution stage */
  abilities: CatAbility[];
}

function paletteToVisuals(catId: string, pattern: CatPattern): CatVisuals {
  const c = getCatColors(catId);
  return {
    bodyColor: c.body,
    bellyColor: c.belly,
    earInnerColor: c.earInner,
    eyeColor: c.eye,
    noseColor: c.nose,
    pattern,
  };
}

function ability(
  id: string,
  name: string,
  description: string,
  icon: string,
  effect: AbilityEffect,
  unlockedAtStage: EvolutionStage,
): CatAbility {
  return { id, name, description, icon, effect, unlockedAtStage };
}

const BASE_STAGE_VISUALS: Record<EvolutionStage, CatStageVisuals> = {
  baby: { accessories: [], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
  teen: { accessories: ['accessory-1'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
  adult: { accessories: ['accessory-1', 'accessory-2'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
  master: { accessories: ['accessory-1', 'accessory-2', 'accessory-3'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.7 },
};

function makeStageVisuals(overrides?: Partial<Record<EvolutionStage, Partial<CatStageVisuals>>>): Record<EvolutionStage, CatStageVisuals> {
  const stages: EvolutionStage[] = ['baby', 'teen', 'adult', 'master'];
  const result = {} as Record<EvolutionStage, CatStageVisuals>;
  for (const stage of stages) {
    result[stage] = { ...BASE_STAGE_VISUALS[stage], ...overrides?.[stage] };
  }
  return result;
}

export const CAT_CHARACTERS: CatCharacter[] = [
  // ═══════════════════════════════════════════════
  // STARTERS (pick 1 free, others 500 gems each)
  // ═══════════════════════════════════════════════

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
    starterCat: true,
    gemCost: null,
    legendary: false,
    visuals: paletteToVisuals('mini-meowww', 'tuxedo'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['bow-tie'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['bow-tie', 'scarf'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
      master: { accessories: ['bow-tie', 'cape', 'crown'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.8 },
    }),
    abilities: [
      ability('mm-note-preview', 'Note Preview', 'See the next note highlighted before it arrives', 'eye-outline', { type: 'note_preview', previewBeats: 1 }, 'baby'),
      ability('mm-timing-window', 'Wider Timing', 'Timing window expanded by 20%', 'timer-outline', { type: 'timing_window_multiplier', multiplier: 1.2 }, 'teen'),
      ability('mm-xp-boost', 'XP Multiplier', 'Earn 25% more XP from exercises', 'arrow-up-bold', { type: 'xp_multiplier', multiplier: 1.25 }, 'adult'),
      ability('mm-perfect-shield', 'Perfect Shield', '1 "almost perfect" still counts as perfect per exercise', 'shield-star', { type: 'perfect_shield', shieldsPerExercise: 1 }, 'master'),
    ],
  },

  {
    id: 'jazzy',
    name: 'Jazzy',
    emoji: '😎🎷',
    backstory:
      'A cool alley cat from New Orleans who taught herself saxophone on the rooftops at midnight. The neighborhood dogs howled along at first, but now they quietly gather below to listen. She once improvised a solo so smooth that a pigeon fell asleep mid-flight.',
    musicSkill: 'Jazz Improvisation',
    personality: 'Cool & Smooth',
    color: '#9B59B6',
    unlockLevel: 1,
    starterCat: true,
    gemCost: null,
    legendary: false,
    visuals: paletteToVisuals('jazzy', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['sunglasses'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['sunglasses', 'fedora'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
      master: { accessories: ['sunglasses', 'trilby', 'sax'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.7 },
    }),
    abilities: [
      ability('jz-slow-start', 'Chill Start', 'Exercises start 10 BPM slower', 'speedometer-slow', { type: 'tempo_reduction', bpmReduction: 10 }, 'baby'),
      ability('jz-combo-shield', 'Combo Shield', '1 miss forgiven in combo chain', 'shield-half-full', { type: 'combo_shield', missesForgivenPerExercise: 1 }, 'teen'),
      ability('jz-hint-boost', 'Hint Frequency', 'Get hints 50% more often', 'lightbulb-on', { type: 'hint_frequency_boost', multiplier: 1.5 }, 'adult'),
      ability('jz-streak-saver', 'Streak Saver', '1 free streak save per week', 'fire', { type: 'streak_saver', freeSavesPerWeek: 1 }, 'master'),
    ],
  },

  {
    id: 'luna',
    name: 'Luna',
    emoji: '🐈🌙',
    backstory:
      'A mysterious black cat who only plays haunting melodies under the full moon. Legend says she learned piano from a ghost in an abandoned concert hall. Nobody has ever heard her play the same piece twice, and those who listen swear the music follows them home.',
    musicSkill: 'Moonlight Compositions',
    personality: 'Mysterious',
    color: '#5B6EAE',
    unlockLevel: 1,
    starterCat: true,
    gemCost: null,
    legendary: false,
    visuals: paletteToVisuals('luna', 'tabby'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['crescent-collar'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['crescent-collar', 'tiara'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.4 },
      master: { accessories: ['crescent-collar', 'tiara', 'constellation'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.9 },
    }),
    abilities: [
      ability('ln-ghost-extend', 'Ghost Notes', 'Ghost notes appear after 2 fails instead of 3', 'ghost-outline', { type: 'ghost_notes_extended', extraFailsBeforeTrigger: -1 }, 'baby'),
      ability('ln-extra-retries', 'Extra Retries', '1 extra retry before exercise locks', 'refresh', { type: 'extra_retries', extraRetries: 1 }, 'teen'),
      ability('ln-score-boost', 'Moonlight Boost', '+5% score on all exercises', 'arrow-up-circle', { type: 'score_boost', percentageBoost: 5 }, 'adult'),
      ability('ln-lucky-gems', 'Lucky Gems', '20% chance for double gem rewards', 'diamond-stone', { type: 'lucky_gems', bonusGemMultiplier: 2 }, 'master'),
    ],
  },

  // ═══════════════════════════════════════════════
  // GEM-UNLOCKABLE CATS
  // ═══════════════════════════════════════════════

  {
    id: 'biscuit',
    name: 'Biscuit',
    emoji: '😻🍪',
    backstory:
      'A fluffy persian who refuses to play in any key except C major because "it feels like warm cookies fresh from the oven." She practices exclusively on a pink grand piano and takes a nap between every piece. Her recitals always include a snack break.',
    musicSkill: 'C Major Specialist',
    personality: 'Cozy & Warm',
    color: '#F39C9C',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 750,
    legendary: false,
    visuals: paletteToVisuals('biscuit', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['pink-bow'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['pink-bow', 'apron'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
      master: { accessories: ['pink-bow', 'chef-hat', 'cookie-wand'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.6 },
    }),
    abilities: [
      ability('bs-reminder', 'Practice Reminder', 'Gentle nudge to practice daily', 'bell-ring', { type: 'daily_xp_boost', multiplier: 1.1 }, 'baby'),
      ability('bs-ghost-ext', 'Extended Ghost Notes', 'Ghost notes last 2 extra beats', 'ghost-outline', { type: 'ghost_notes_extended', extraFailsBeforeTrigger: -1 }, 'teen'),
      ability('bs-daily-xp', 'Daily XP Boost', '15% more XP on first 3 exercises', 'star-circle', { type: 'daily_xp_boost', multiplier: 1.15 }, 'adult'),
      ability('bs-gem-magnet', 'Gem Magnet', '10% chance for bonus gems', 'magnet', { type: 'gem_magnet', bonusGemChance: 0.1 }, 'master'),
    ],
  },

  {
    id: 'ballymakawww',
    name: 'Ballymakawww',
    emoji: '☘️🐱',
    backstory:
      'A boisterous ginger-and-white Irish cat who learned piano in a Cork pub by ear. He plays jigs, reels, and folk ballads at twice the speed anyone thinks possible. When he\'s not hammering out trad sets, he\'s telling wildly exaggerated stories about "the time he played for the Queen\'s corgis." Every performance ends with him standing on the keys yelling "ANOTHER!"',
    musicSkill: 'Folk & Traditional',
    personality: 'Boisterous & Storyteller',
    color: '#1ABC9C',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 1000,
    legendary: false,
    visuals: paletteToVisuals('ballymakawww', 'tabby'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['flat-cap'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['flat-cap', 'scarf'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
      master: { accessories: ['flat-cap', 'scarf', 'fiddle'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.7 },
    }),
    abilities: [
      ability('bk-slow-start', 'Pub Tempo', 'Start 8 BPM slower', 'metronome', { type: 'tempo_reduction', bpmReduction: 8 }, 'baby'),
      ability('bk-score-boost', 'Folk Boost', '+3% score on exercises', 'trending-up', { type: 'score_boost', percentageBoost: 3 }, 'teen'),
      ability('bk-hint-boost', 'Storyteller\'s Wisdom', 'Hints 30% more frequent', 'lightbulb-outline', { type: 'hint_frequency_boost', multiplier: 1.3 }, 'adult'),
      ability('bk-double-gems', 'Pot of Gold', '25% chance for double gems', 'cash-multiple', { type: 'lucky_gems', bonusGemMultiplier: 2 }, 'master'),
    ],
  },

  {
    id: 'aria',
    name: 'Aria',
    emoji: '🐈🎵',
    backstory:
      'An elegant siamese with perfect pitch who trained at La Scala in Milan. She can shatter a wine glass with a high C and once sang a duet with a nightingale that made the entire garden weep. She considers herself a "vocal athlete" and does warm-ups at 5 AM.',
    musicSkill: 'Opera & Perfect Pitch',
    personality: 'Elegant',
    color: '#FFD700',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 1500,
    legendary: false,
    visuals: paletteToVisuals('aria', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['pearl-necklace'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['pearl-necklace', 'tiara-gold'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.4 },
      master: { accessories: ['pearl-necklace', 'tiara-gold', 'golden-cape'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.8 },
    }),
    abilities: [
      ability('ar-note-preview', 'Perfect Pitch', 'See the next note highlighted', 'eye-circle', { type: 'note_preview', previewBeats: 1 }, 'baby'),
      ability('ar-timing', 'Opera Timing', 'Timing window +15%', 'clock-fast', { type: 'timing_window_multiplier', multiplier: 1.15 }, 'teen'),
      ability('ar-combo-shield', 'Diva Shield', '1 miss forgiven in combo', 'shield-outline', { type: 'combo_shield', missesForgivenPerExercise: 1 }, 'adult'),
      ability('ar-xp-mult', 'Prima Donna', '50% XP multiplier', 'star-four-points', { type: 'xp_multiplier', multiplier: 1.5 }, 'master'),
    ],
  },

  {
    id: 'tempo',
    name: 'Tempo',
    emoji: '😼⚡',
    backstory:
      'A hyperactive ginger kitten who can play any song at double speed without missing a single note. Scientists tried to study his paws but he moved too fast for the cameras. He has been banned from three music schools for "unauthorized tempo modifications."',
    musicSkill: 'Speed Playing',
    personality: 'Hyperactive',
    color: '#E74C3C',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 2000,
    legendary: false,
    visuals: paletteToVisuals('tempo', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['lightning-collar'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['lightning-collar', 'racing-goggles'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.4 },
      master: { accessories: ['lightning-collar', 'racing-goggles', 'speed-aura'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.8 },
    }),
    abilities: [
      ability('tp-retries', 'Quick Retry', '1 extra retry per exercise', 'replay', { type: 'extra_retries', extraRetries: 1 }, 'baby'),
      ability('tp-slow-start', 'Warm Up', 'Start 12 BPM slower', 'speedometer-slow', { type: 'tempo_reduction', bpmReduction: 12 }, 'teen'),
      ability('tp-combo-shield', 'Speed Shield', '1 miss forgiven in combo', 'shield-lightning', { type: 'combo_shield', missesForgivenPerExercise: 1 }, 'adult'),
      ability('tp-score-boost', 'Turbo Score', '+10% score boost', 'flash', { type: 'score_boost', percentageBoost: 10 }, 'master'),
    ],
  },

  {
    id: 'shibu',
    name: 'Shibu',
    emoji: '🌸🐱',
    backstory:
      'A cream-and-brown Japanese Bobtail who learned piano at a temple in Kyoto. She plays with the stillness and precision of a tea ceremony — every note placed with intention, every rest meaningful. She meditates before every practice session and insists that "the silence between the notes is where the real music lives." She once played so peacefully that a koi pond froze mid-ripple.',
    musicSkill: 'Meditative & Ambient',
    personality: 'Zen & Serene',
    color: '#FF7043',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 1000,
    legendary: false,
    visuals: paletteToVisuals('shibu', 'siamese'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['temple-bell'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['temple-bell', 'kimono-sash'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
      master: { accessories: ['temple-bell', 'kimono-sash', 'cherry-blossom'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.6 },
    }),
    abilities: [
      ability('sh-slow-start', 'Zen Tempo', 'Start 8 BPM slower', 'music-rest-half', { type: 'tempo_reduction', bpmReduction: 8 }, 'baby'),
      ability('sh-timing', 'Mindful Timing', 'Timing window +10%', 'metronome-tick', { type: 'timing_window_multiplier', multiplier: 1.1 }, 'teen'),
      ability('sh-xp-boost', 'Inner Peace', '20% more XP', 'trending-up', { type: 'xp_multiplier', multiplier: 1.2 }, 'adult'),
      ability('sh-gem-magnet', 'Temple Offering', '15% bonus gem chance', 'diamond-stone', { type: 'gem_magnet', bonusGemChance: 0.15 }, 'master'),
    ],
  },

  {
    id: 'bella',
    name: 'Bella',
    emoji: '👑🤍',
    backstory:
      'A magnificent white Persian with impossibly fluffy fur and eyes like sapphires. She considers herself royalty and honestly? She kind of is. She only plays on white grand pianos, refuses to touch anything dusty, and has a personal assistant (a small mouse named Geoffrey) who turns her sheet music pages. Her Debussy is breathtaking. Her attitude is immaculate. She has never once played a wrong note — or if she has, she insists it was "artistic interpretation."',
    musicSkill: 'Classical & Debussy',
    personality: 'Regal & Refined',
    color: '#90CAF9',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 1500,
    legendary: false,
    visuals: paletteToVisuals('bella', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['pearl-necklace'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['pearl-necklace', 'tiara-silver'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
      master: { accessories: ['pearl-necklace', 'tiara-silver', 'royal-cape-white'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.7 },
    }),
    abilities: [
      ability('bl-retries', 'Royal Pardon', '1 extra retry', 'heart-plus', { type: 'extra_retries', extraRetries: 1 }, 'baby'),
      ability('bl-combo', 'Regal Composure', '1 miss forgiven in combo', 'shield-star-outline', { type: 'combo_shield', missesForgivenPerExercise: 1 }, 'teen'),
      ability('bl-score', 'Purrfect Poise', '+5% score boost', 'trophy', { type: 'score_boost', percentageBoost: 5 }, 'adult'),
      ability('bl-xp', 'Royal Decree', '30% XP multiplier', 'crown', { type: 'xp_multiplier', multiplier: 1.3 }, 'master'),
    ],
  },

  {
    id: 'sable',
    name: 'Sable',
    emoji: '🖤🎹',
    backstory:
      'A sleek black cat with a flair for the dramatic. She only plays minor keys and wears a velvet cape to every recital. Her specialty is playing Chopin in candlelight while rain patters on the window. Neighborhood cats call her "extra" — she calls it "atmosphere."',
    musicSkill: 'Romantic & Minor Keys',
    personality: 'Dramatic',
    color: '#AB47BC',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 2000,
    legendary: false,
    visuals: paletteToVisuals('sable', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['velvet-ribbon'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['velvet-ribbon', 'cape-purple'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.4 },
      master: { accessories: ['velvet-ribbon', 'cape-purple', 'candelabra'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.8 },
    }),
    abilities: [
      ability('sb-ghost', 'Phantom Notes', 'Ghost notes after 2 fails', 'ghost', { type: 'ghost_notes_extended', extraFailsBeforeTrigger: -1 }, 'baby'),
      ability('sb-timing', 'Rubato', 'Timing window +20%', 'clock-outline', { type: 'timing_window_multiplier', multiplier: 1.2 }, 'teen'),
      ability('sb-streak', 'Dark Persistence', '1 free streak save/week', 'weather-night', { type: 'streak_saver', freeSavesPerWeek: 1 }, 'adult'),
      ability('sb-score', 'Dramatic Finale', '+8% score boost', 'drama-masks', { type: 'score_boost', percentageBoost: 8 }, 'master'),
    ],
  },

  {
    id: 'coda',
    name: 'Coda',
    emoji: '🎼🐈',
    backstory:
      'A dignified russian blue who conducts a full cat orchestra every Sunday in the park. She studied at the Vienna Conservatory and insists on perfect posture at all times. She\'s the only cat who can sight-read a full orchestral score while napping.',
    musicSkill: 'Orchestral Conducting',
    personality: 'Distinguished',
    color: '#42A5F5',
    unlockLevel: 1,
    starterCat: false,
    gemCost: 3000,
    legendary: false,
    visuals: paletteToVisuals('coda', 'solid'),
    evolutionVisuals: makeStageVisuals({
      teen: { accessories: ['monocle'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
      adult: { accessories: ['monocle', 'baton'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.4 },
      master: { accessories: ['monocle', 'baton', 'conductor-coat'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.8 },
    }),
    abilities: [
      ability('cd-preview', 'Score Reading', 'See the next note highlighted', 'file-music', { type: 'note_preview', previewBeats: 1.5 }, 'baby'),
      ability('cd-timing', 'Conductor Timing', 'Timing window +25%', 'metronome', { type: 'timing_window_multiplier', multiplier: 1.25 }, 'teen'),
      ability('cd-combo', 'Orchestra Shield', '2 misses forgiven in combo', 'shield-music', { type: 'combo_shield', missesForgivenPerExercise: 2 }, 'adult'),
      ability('cd-xp', 'Encore', '40% XP multiplier', 'star-shooting', { type: 'xp_multiplier', multiplier: 1.4 }, 'master'),
    ],
  },

  // ═══════════════════════════════════════════════
  // LEGENDARY — Chonky Monké (300-day streak OR 100 skills mastered)
  // ═══════════════════════════════════════════════

  {
    id: 'chonky-monke',
    name: 'Chonky Monké',
    emoji: '🍊🐈',
    backstory:
      'An absolute UNIT of an orange & white cat who weighs 22 pounds and is proud of every single one. He learned piano by sitting on the keys — turns out when you\'re that chonky, you hit perfect chords every time. His signature move is the "Belly Slam Fortissimo" where he flops onto the keyboard for a dramatic finale. Has his own trading card. Only reveals himself to the most dedicated pianists.',
    musicSkill: 'Power Chords & Bass',
    personality: 'Absolute Unit',
    color: '#FF8C00',
    unlockLevel: 1,
    starterCat: false,
    gemCost: null, // Cannot be bought — legendary unlock only
    legendary: true,
    visuals: paletteToVisuals('chonky-monke', 'tabby'),
    evolutionVisuals: makeStageVisuals({
      baby: { accessories: ['tiny-crown'], hasGlow: false, hasParticles: false, hasCrown: true, auraIntensity: 0 },
      teen: { accessories: ['gold-chain', 'tiny-crown'], hasGlow: true, hasParticles: false, hasCrown: true, auraIntensity: 0.2 },
      adult: { accessories: ['gold-chain', 'royal-robe', 'golden-headphones'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.5 },
      master: { accessories: ['gold-chain', 'royal-robe', 'golden-headphones', 'piano-throne'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 1.0 },
    }),
    abilities: [
      ability('ck-combo-shield', 'Belly Block', '2 misses forgiven in combo', 'shield-crown', { type: 'combo_shield', missesForgivenPerExercise: 2 }, 'baby'),
      ability('ck-xp-mult', 'Chonk Energy', '30% XP multiplier', 'weight', { type: 'xp_multiplier', multiplier: 1.3 }, 'teen'),
      ability('ck-lucky-gems', 'Golden Belly', '30% chance for double gems', 'treasure-chest', { type: 'lucky_gems', bonusGemMultiplier: 2 }, 'adult'),
      ability('ck-all-half', 'Absolute Unit', 'All other cat abilities at half power', 'infinity', { type: 'all_abilities_half', description: 'Combines all abilities from every cat at reduced power' }, 'master'),
    ],
  },
];

// ═══════════════════════════════════════════════
// NPC: Salsa — AI Coach (non-playable)
// ═══════════════════════════════════════════════

export interface CoachCharacter {
  id: string;
  name: string;
  emoji: string;
  backstory: string;
  personality: string;
  voiceStyle: string;
  color: string;
  visuals: CatVisuals;
  catchphrases: string[];
}

export const SALSA_COACH: CoachCharacter = {
  id: 'salsa',
  name: 'Salsa',
  emoji: '💃🐱',
  backstory:
    'A sleek grey cat with piercing green eyes, a dancer\'s rhythm, and a teacher\'s patience — but make it spicy. She trained in Havana, Buenos Aires, and Nashville before settling down to teach. She doesn\'t just teach piano — she teaches you to FEEL the music. Every lesson is a performance. Every mistake is "just seasoning." Her catchphrase: "¡Mira! You\'re not playing notes, you\'re telling a STORY."',
  personality: 'Sassy, encouraging, dramatic, warm. Think passionate dance teacher meets motivational speaker.',
  voiceStyle: 'Warm, expressive, slightly theatrical. Uses occasional Spanish exclamations. Never boring.',
  color: '#FF5252',
  visuals: paletteToVisuals('salsa', 'solid'),
  catchphrases: [
    '¡Mira! You\'re not playing notes, you\'re telling a STORY.',
    'Oh honey, that was *chef\'s kiss*!',
    'Every mistake is just seasoning, cariño.',
    'Feel it in your PAWS!',
    'Now THAT\'S what I call music!',
    'Close your eyes. Breathe. Now play it like you mean it.',
    'You think that was good? You have NO idea how amazing you\'re about to be.',
    'Más! More feeling! I want the piano to CRY!',
    'That rhythm? *muah* Perfecto.',
    'Take it from the top, but this time? Make me DANCE.',
  ],
};

/** Get a cat character by its ID */
export function getCatById(id: string): CatCharacter | undefined {
  return CAT_CHARACTERS.find((cat) => cat.id === id);
}

/** Get the default cat (first starter) */
export function getDefaultCat(): CatCharacter {
  return CAT_CHARACTERS[0];
}

/** Get all starter cats */
export function getStarterCats(): CatCharacter[] {
  return CAT_CHARACTERS.filter((cat) => cat.starterCat);
}

/** Get all gem-purchasable cats (non-starter, non-legendary) */
export function getGemCats(): CatCharacter[] {
  return CAT_CHARACTERS.filter((cat) => !cat.starterCat && !cat.legendary && cat.gemCost !== null);
}

/** Get the legendary cat(s) */
export function getLegendaryCats(): CatCharacter[] {
  return CAT_CHARACTERS.filter((cat) => cat.legendary);
}

/**
 * Get all cats available at a given level.
 * @deprecated Use getOwnedCats(ownedCatIds) instead — level-gating is defunct.
 */
export function getUnlockedCats(level: number): CatCharacter[] {
  return CAT_CHARACTERS.filter((cat) => cat.unlockLevel <= level);
}

/**
 * Check if a specific cat is unlocked at the given level.
 * @deprecated Use isCatOwned(catId, ownedCatIds) instead — level-gating is defunct.
 */
export function isCatUnlocked(catId: string, level: number): boolean {
  const cat = getCatById(catId);
  if (!cat) return false;
  return cat.unlockLevel <= level;
}

/** Get CatCharacter objects for owned cats (use ownedCats from catEvolutionStore) */
export function getOwnedCats(ownedCatIds: string[]): CatCharacter[] {
  return CAT_CHARACTERS.filter((cat) => ownedCatIds.includes(cat.id));
}

/** Check if a specific cat is owned */
export function isCatOwned(catId: string, ownedCatIds: string[]): boolean {
  return ownedCatIds.includes(catId);
}
