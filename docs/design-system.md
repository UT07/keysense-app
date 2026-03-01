# Purrrfect Keys — Design System

**Version:** 3.2
**Last Updated:** February 28, 2026
**Status:** Phase 10 Arcade Concert Hall complete — Concert Hall palette (black + crimson), lava lamp gradient, typography, shadows, composable cat SVG, Salsa NPC, rarity borders, combo escalation, 3D cats, sound design

---

## 1. Current Design Tokens

### Colors (Concert Hall: Black + Crimson Red)

```typescript
// src/theme/tokens.ts — Concert Hall palette
COLORS = {
  // Core surfaces (true blacks, neutral — no purple tint)
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  surfaceOverlay: 'rgba(0, 0, 0, 0.85)',

  // Primary (crimson)
  primary: '#DC143C',          // Brand crimson
  primaryLight: '#FF2D55',
  primaryDark: '#8B0000',

  // Cards (neutral dark greys)
  cardSurface: '#181818',
  cardBorder: '#2A2A2A',
  cardHighlight: '#222222',

  // Text (clean whites and greys — no lavender)
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  textAccent: '#DC143C',

  // Status
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Gamification
  starGold: '#FFD700',
  starEmpty: '#444444',
  gemGold: '#FFD700',
  gemDiamond: '#4FC3F7',
  evolutionGlow: '#FFD54F',    // Warm gold (was purple #E1BEE7)
  evolutionFlash: '#FFFFFF',

  // Gameplay feedback
  feedbackPerfect: '#00E676',  // Bright green
  feedbackGood: '#69F0AE',     // Light green
  feedbackOk: '#FFD740',       // Amber gold
  feedbackEarly: '#40C4FF',    // Light blue
  feedbackLate: '#FFAB40',     // Warm orange
  feedbackMiss: '#FF5252',     // Red
  feedbackDefault: '#757575',  // Grey
  comboGold: '#FFD700',        // Gold

  // Streak flame tiers
  streakFlame: '#FF6B35',      // Base warm orange
  streakFlameWarm: '#FF9800',  // Tier 1 (< 7 days)
  streakFlameMedium: '#FF6B00', // Tier 2 (7-29 days)
  streakFlameHot: '#FF4500',   // Tier 3 (30+ days)
}
```

### Spacing Scale
- xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48

### Border Radius
- sm: 8, md: 12, lg: 16, xl: 24, full: 9999

### Gradients

```typescript
GRADIENTS = {
  dark: ['#141414', '#0A0A0A'],        // Neutral dark surface
  header: ['#1C1C1C', '#0A0A0A'],      // Header bar
  heroGlow: ['#2A0A0A', '#1A0A0A', '#0A0A0A'], // 3-stop dark red hero
  cardWarm: ['#1C1C1C', '#181818'],     // Elevated card
  crimson: ['#DC143C', '#8B0000'],
  gold: ['#FFD700', '#FFA500'],
  success: ['#4CAF50', '#2E7D32'],
  gem: ['#FFD700', '#FF8C00'],
  evolution: ['#FFD54F', '#FF8C00'],    // Warm gold (was purple)

  // Lava Lamp — animated gradient keyframes
  lavaLamp: {
    duration: 8000,  // full cycle time in ms
    palettes: [
      ['#1A0000', '#0A0A0A', '#0A0A0A'],  // deep red bleed at top
      ['#0A0A0A', '#1A0505', '#0A0A0A'],  // crimson ember in center
      ['#0A0A0A', '#0A0A0A', '#1A0000'],  // red glow settling to bottom
      ['#120000', '#0E0303', '#0A0A0A'],  // warm dark red wash
    ],
  },
}
```

### Animated Gradient (Lava Lamp)

The `AnimatedGradientBackground` component (`src/components/common/AnimatedGradientBackground.tsx`) provides a slowly shifting lava-lamp effect. Two `LinearGradient` layers crossfade between the `lavaLamp.palettes`, creating a subtle, always-moving dark red glow. Used on HomeScreen and AuthScreen hero sections.

### Glow System

```typescript
GLOW = {
  crimson: 'rgba(220, 20, 60, 0.3)',
  gold: 'rgba(255, 215, 0, 0.3)',
  dark: 'rgba(28, 28, 28, 0.3)',
  success: 'rgba(76, 175, 80, 0.3)',
}
// + glowColor(hex, opacity) helper
// + shadowGlow(color, radius) for colored shadow effects
```

### Shadows

```typescript
SHADOWS = {
  sm: { shadowOffset: {0,1}, opacity: 0.15, radius: 3 / elevation: 2 },
  md: { shadowOffset: {0,4}, opacity: 0.20, radius: 8 / elevation: 4 },
  lg: { shadowOffset: {0,8}, opacity: 0.25, radius: 16 / elevation: 8 },
}
```

---

## 2. Typography

**System:** Defined typography scale in `TYPOGRAPHY` object (Phase 7 Batch 1).

```typescript
TYPOGRAPHY = {
  display:  { lg: 36/44, md: 28/36, sm: 24/32 },  // Hero text, celebrations
  heading:  { lg: 20/28, md: 18/26, sm: 16/24 },   // Section headers
  body:     { lg: 16/24, md: 14/22, sm: 13/20 },    // Content text
  caption:  { lg: 12/18, md: 11/16, sm: 10/14 },    // Labels, hints
  button:   { lg: 16/24, md: 14/22, sm: 12/18 },    // Button labels
  special:  { score: 48/56, badge: 11/14 uppercase } // Score display, badges
}
```

Font: System default (no custom fonts). Future: consider adding a branded font.

---

## 3. Component Library

### Core Components
| Component | Location | Purpose |
|-----------|----------|---------|
| Button | `components/common/Button.tsx` | Primary/secondary buttons |
| PressableScale | `components/common/PressableScale.tsx` | Animated press feedback |
| ScoreRing | `components/common/ScoreRing.tsx` | Animated SVG circle score indicator |
| CatAvatar | `components/Mascot/CatAvatar.tsx` | Composable SVG cat (8 moods, 4 sizes, evolution stages, per-cat profiles) |
| SalsaCoach | `components/Mascot/SalsaCoach.tsx` | NPC coach cat (grey with green eyes, teaching poses, catchphrases) |
| MascotBubble | `components/Mascot/MascotBubble.tsx` | Speech bubble for cat dialogue |
| ExerciseBuddy | `components/Mascot/ExerciseBuddy.tsx` | In-exercise cat companion |
| Keyboard | `components/Keyboard/Keyboard.tsx` | Interactive piano keyboard |
| SplitKeyboard | `components/Keyboard/SplitKeyboard.tsx` | Two-hand split keyboard |
| VerticalPianoRoll | `components/PianoRoll/VerticalPianoRoll.tsx` | Falling notes display |
| AchievementToast | `components/transitions/AchievementToast.tsx` | XP/level-up notification |
| EvolutionReveal | `components/transitions/EvolutionReveal.tsx` | Full-screen evolution animation |
| GemEarnPopup | `components/GemEarnPopup.tsx` | Gem reward animation |
| ExerciseCard | `components/transitions/ExerciseCard.tsx` | Quick between-exercise transition |
| LessonCompleteScreen | `components/transitions/LessonCompleteScreen.tsx` | Full lesson celebration |
| FunFactCard | `components/FunFact/FunFactCard.tsx` | Music fun fact display |

### Screens (21 total)
| Screen | Purpose |
|--------|---------|
| AuthScreen | Login/signup with Salsa hero, shimmer title, floating notes |
| EmailAuthScreen | Email/password auth form |
| OnboardingScreen | 4-step new user onboarding (input method, cat selection) |
| SkillAssessmentScreen | Initial skill calibration |
| HomeScreen | Command center with Salsa, daily goal, music spotlight, continue learning |
| DailySessionScreen | "Today's Practice" AI-picked session with GameCard rarity |
| LevelMapScreen | Trophy road with 15 themed tiers, winding path, cat companions |
| PlayScreen | Free play keyboard with optional song reference |
| ExercisePlayer | Core exercise with combo escalation, loot reveal completion |
| ProfileScreen | Player card with stat badges, achievement shimmer, streak flame |
| AccountScreen | Account management + account deletion |
| CatSwitchScreen | Unified cat gallery: swipeable cards, evolution, abilities, buy flow |
| MidiSetupScreen | MIDI device wizard |
| MicSetupScreen | Microphone permission wizard |
| LessonIntroScreen | Pre-lesson objectives |
| SongLibraryScreen | Music library: genre carousel, search, mastery badges |
| SongPlayerScreen | Section-based song playback with layer toggle |
| SocialScreen | Social hub: league card, friends, challenges |
| LeaderboardScreen | Weekly league standings with promotion/demotion zones |
| AddFriendScreen | Friend code display/copy + code lookup |
| FriendsScreen | Friends list + activity feed (two-tab) |

---

## 4. Cat Avatar System

### Current: Composable SVG System (Phase 7 Batches 3-4)

The cat avatar system was overhauled from a single-silhouette SVG to a composable part-based system:

#### Architecture
- **`CatParts.tsx`** — Reusable SVG components: CatBody (4 shapes: slim/standard/round/chonky), CatHead, CatEars (3 variants: pointed/rounded/folded), CatEyes (4 variants: round/almond/big-sparkly/sleepy), CatMouth (mood-dependent), CatTail (3 variants: curled/straight/fluffy), CatWhiskers, CatNose
- **`catProfiles.ts`** — Maps each cat ID to a unique combination of body/ears/eyes/tail/cheekFluff/blush
- **`CatAccessories.tsx`** — Evolution-stage accessories (BowTie, Sunglasses, Fedora, Crown, Cape, Monocle)
- **`KeysieSvg.tsx`** — Composable renderer: looks up profile → renders parts → adds accessories
- **`catAnimations.ts`** — Pose system with Reanimated: idle/celebrate/teach/sleep/play/curious/sad

#### Cat Roster (12 Playable + 1 NPC)

| Cat | ID | Body | Pattern | Eyes | Personality |
|-----|----|------|---------|------|-------------|
| Mini Meowww | mini-meowww | slim | tuxedo | big-sparkly | Sweet kitten, encouraging |
| Jazzy | jazzy | slim | solid | almond | Cool jazz cat |
| Luna | luna | standard | solid | almond | Mysterious night owl |
| Biscuit | biscuit | round | tabby | round | Warm, nurturing |
| Ballymakawww | ballymakawww | round | tabby | round | Irish folk enthusiast |
| Aria | aria | slim | solid | big-sparkly | Classical diva |
| Tempo | tempo | slim | solid | round | Rhythm specialist |
| Shibu | shibu | slim | siamese | almond | Zen Japanese Bobtail |
| Bella | bella | round | solid | big-sparkly | Regal white Persian |
| Sable | sable | slim | solid | almond | Moody midnight cat |
| Coda | coda | standard | tabby | round | Cheerful finale cat |
| Chonky Monké | chonky-monke | chonky | spotted | round | Legendary meme cat |
| **Salsa (NPC)** | salsa | standard | solid | big-sparkly | Coach — grey with green eyes |

#### Mood System
Moods: happy, neutral, sleepy, excited, sad, teaching, encouraging, curious
- Eyes change shape per mood
- Mouth expressions per mood
- Pose animations via Reanimated (body translateY/scale, head rotate, tail wag, ear twitch)

#### Evolution Stages
baby → teen → adult → master, with XP thresholds. Each stage unlocks accessories and abilities.

### Current: 3D Cat System (Phase 10 — react-three-fiber)

The 3D cat system uses react-three-fiber v8 + @react-three/drei for native 3D rendering:

#### Architecture
- **`CatAvatar3D.tsx`** — Wraps R3F Canvas with SVG CatAvatar fallback when expo-gl unavailable
- **4 GLB body types**: `salsa-cat.glb` (standard), `slim-cat.glb`, `round-cat.glb`, `chonky-cat.glb`
- **Material color overrides**: Per-cat body/ear/eye/nose colors applied at runtime
- **`CatAccessories3D.tsx`** — Programmatic Three.js geometry for 30+ evolution accessories
- **Evolution glow**: pointLight + aura sphere for adult/master stages
- **Performance**: ONE 3D canvas per screen max, 30fps target

#### Fallback
SVG composable system (`KeysieSvg.tsx`) used when `forceSVG=true` or WebGL unavailable.

---

## 5. Known Patterns & Gotchas

### textShadowColor + Reanimated
**Do NOT animate `textShadowColor`, `textShadowOffset`, or `textShadowRadius` inside `useAnimatedStyle`.** Reanimated does not support text shadow animation properties. This was discovered on the AuthScreen where animated text shadows caused a runtime error.

**Pattern:** Use a static `style` prop for text shadows, not `useAnimatedStyle`:
```typescript
// BAD — will crash
const animStyle = useAnimatedStyle(() => ({
  textShadowColor: 'rgba(220,20,60,0.5)',
  textShadowRadius: 10,
}));

// GOOD — static style, animate other properties separately
const staticShadow = { textShadowColor: 'rgba(220,20,60,0.5)', textShadowRadius: 10 };
<Animated.Text style={[animatedOpacity, staticShadow]} />
```

### Auth Gating for Social Screens
Anonymous users must not access Firestore social features (friend codes, leagues, challenges). All social screens (AddFriendScreen, SocialScreen, FriendsScreen, LeaderboardScreen) should check `isAnonymous` from `authStore` and show a sign-in prompt instead of attempting Firestore operations.

**Pattern:**
```typescript
const { user, isAnonymous } = useAuthStore();
if (!user || isAnonymous) {
  return <SignInPrompt message="Sign in to add friends" />;
}
```

---

## 6. Visual Debt Status (Phase 7 Progress)

### Resolved (Batches 1-6)
1. ~~Cat avatars are static pixel art~~ → **FIXED:** Composable SVG part system, 12 unique profiles, Reanimated poses
2. ~~Pure black backgrounds~~ → **FIXED:** Concert Hall palette (black + crimson) with lava lamp animated gradient
3. ~~No typography system~~ → **FIXED:** Full TYPOGRAPHY scale in tokens.ts
4. ~~Cards lack polish~~ → **FIXED:** SHADOWS sm/md/lg, warm card backgrounds, consistent borders
5. ~~Salsa has no persistent presence~~ → **FIXED:** SalsaCoach component on every screen
6. ~~Home screen is cramped~~ → **FIXED:** Hero redesign with Salsa at center, token-based layout
7. ~~Daily challenge card has debug border~~ → **FIXED:** Proper token-based styling
8. ~~Profile screen is plain settings list~~ → **FIXED:** Cat avatar with evolution badge, stats grid
9. ~~Exercise completion feels abrupt~~ → **FIXED:** ExerciseLoadingScreen interstitial + enhanced CompletionModal

### Resolved (Phase 10 — Arcade Concert Hall)
10. ~~Auth screens still need Salsa hero~~ → **FIXED:** AuthScreen has larger Salsa (2x), shimmer title, floating musical notes
11. ~~LevelMapScreen needs warm background~~ → **FIXED:** 15 unique tier themes with per-tier colors, backgrounds, zone labels
12. ~~No screen transition animations~~ → **PARTIALLY FIXED:** FadeInUp stagger on DailySession, LevelMap nodes
13. ~~No button press sound effects~~ → **FIXED:** SoundManager with haptic pairing, PressableScale auto-plays button_press
14. No loading/skeleton states (stretch)
15. No animated progress bars (stretch)

### Low Priority
16. No dark/light mode support
17. No reduced motion support
18. No haptic patterns beyond basic impact
19. Fun facts lack illustrations
20. Streak calendar not visualized

---

## 7. Design Principles (Target)

1. **Salsa is the app.** Every screen should feel like Salsa is your companion. She's large, animated, and central — not a tiny icon in the corner.

2. **Concert Hall feel.** Dark theme should feel like a concert hall — true blacks, crimson accents, slowly shifting dark-red lava lamp gradients. No purple hues anywhere.

3. **Playful geometry.** Rounded corners everywhere, organic shapes, gentle curves. Nothing should feel like a spreadsheet.

4. **Motion is meaning.** Every state change has a transition. XP fills, gems sparkle, cats bounce. Static screens feel broken.

5. **One thing per view.** Each screen has one clear primary action. Don't make users scan — guide their eyes.

6. **Celebrate everything.** Correct note? Flash. Combo? Shake. Star earned? Particles. Level up? Full screen. Evolution? Cinematic.
