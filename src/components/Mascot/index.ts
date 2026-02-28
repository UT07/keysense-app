/**
 * Mascot component exports
 * Salsa - the Purrrfect Keys piano mascot + Cat Character Avatar System
 */

export { MascotBubble } from './MascotBubble';
export type { MascotBubbleProps } from './MascotBubble';

export {
  getRandomTip,
  getTipForScore,
  getTipForStreak,
  TIPS,
} from './mascotTips';
export type { MascotTip, MascotMood, TipCategory } from './mascotTips';

export { CatAvatar } from './CatAvatar';
export type { CatAvatarSize } from './CatAvatar';

export { ExerciseBuddy } from './ExerciseBuddy';
export type { BuddyReaction } from './ExerciseBuddy';

export { SalsaCoach } from './SalsaCoach';

export { POSE_CONFIGS, moodToPose, reactionToPose, reactionToMood, useCatPose } from './animations';
export type { CatPose, PoseConfig, PoseKeyframe } from './animations';

export {
  CAT_CHARACTERS,
  getCatById,
  getDefaultCat,
  getUnlockedCats,
  isCatUnlocked,
  getOwnedCats,
  isCatOwned,
} from './catCharacters';
export type { CatCharacter } from './catCharacters';
