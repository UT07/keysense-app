# Arcade Concert Hall — Full App Revamp Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** February 27, 2026
**Status:** Approved
**Goal:** Transform Purrrfect Keys from functional dark-mode Duolingo into a Duolingo x Clash Royale hybrid with 3D cats, dramatic game-feel, full sound design, and Phase 10 social features.
**Visual Target:** Duolingo's clear progression + Clash Royale's dopamine delivery (particles, reveals, screen shake, loot, sound on everything)

---

## Core Philosophy

**"Arcade Concert Hall"** = Concert Hall dark aesthetic + arcade game energy

### Duolingo DNA
- Clear skill tree with visible locks/unlocks
- Streak psychology (flame, freeze, guilt)
- Session structure (warm-up → lesson → challenge)
- "You're on fire!" celebration moments
- Daily goals with ring-fill progress

### Clash Royale / Brawl Stars DNA
- Chest/loot reveals after exercises (not just a score screen)
- Screen shake on big combos
- Particle trails on earned gems/XP
- Buttons that breathe — idle pulse animations
- Card rarity aesthetics (common/rare/epic glow borders)
- Sound on EVERYTHING — taps, swipes, rewards, transitions
- Trophy road feel on LevelMap

---

## Retention-Ordered Priority

| Priority | Workstream | Scope | Impact |
|----------|-----------|-------|--------|
| **P0** | Auth + Onboarding | Cinematic first impression | 40%+ first-session retention |
| **P0** | 3D Cat Avatar system | Low-poly Blender models via react-three-fiber | Core differentiator |
| **P1** | HomeScreen | Command center with 3D cat hero, game cards | Daily return driver |
| **P1** | ExercisePlayer + CompletionModal | 3D-styled notes, combo system, loot reveals | Core loop dopamine |
| **P1** | Sound Design system | Audio + haptic feedback on everything | Multiplier on all visuals |
| **P2** | LevelMap (Trophy Road) | Themed environments, 3D landmarks, cat walks path | Progression visibility |
| **P2** | DailySessionScreen | Game cards, section animations, energy | Session quality |
| **P2** | SongLibraryScreen | Album art, mastery badges, genre carousel | Content breadth |
| **P3** | CatSwitchScreen | 3D pedestals, rarity borders, evolution preview | Collection drive |
| **P3** | ProfileScreen | Player card, achievement showcase | Vanity retention |
| **P4** | Phase 10: Social & Leaderboards | Friends, leagues, challenges, share cards | Long-term retention |

---

## Section 1: 3D Cat Avatar System

### Technology
- **Modeling:** Blender (low-poly, ~5K faces, Crossy Road / Neko Atsume style)
- **Runtime:** `react-three-fiber` + `@react-three/drei` (native)
- **Format:** .glb with Draco compression (~200-400KB per cat)
- **Fallback:** Current SVG composable system for devices without WebGL

### Cat Model Pipeline
```
Blender (.glb) → react-three-fiber → CatAvatar3D component
                                    ├── idle (breathing, tail swish, ear twitch)
                                    ├── celebrate (jump, spin, confetti burst)
                                    ├── teach (Salsa pointing, waving)
                                    ├── sleep (curled up, Z particles)
                                    ├── sad (droopy ears, slow tail)
                                    ├── play (batting at notes)
                                    └── curious (head tilt, lean forward)
```

### Evolution Stages
- **Baby (Stage 1):** 50% scale, round body, huge head, stubby limbs, no accessories, pastel colors, wobbly animations
- **Teen (Stage 2):** 75% scale, more proportional, first accessory (bow tie/small hat), energetic animations
- **Adult (Stage 3):** Full size, sleek, glasses/scarves/instruments, confident animations
- **Master (Stage 4):** 110% scale, regal posture, crown/cape/monocle, magical aura particles, majestic animations

### Roster (13 models)
12 playable cats + Salsa NPC coach. Each uses shared bone rig with per-cat:
- Unique mesh proportions (body shape, ear shape, tail style)
- 512x512 texture atlas (matching catProfiles.ts colors)
- Emissive map for glow effects (eyes, accessories)
- 4 evolution variants (size + proportion + accessory changes)

### Performance Budget
- ONE 3D canvas per screen max
- 30fps render (not 60) — cat animations are slow enough
- CatSwitchScreen: active card = 3D, others = 2D pre-rendered thumbnail
- ExerciseBuddy: tiny canvas (80x80px)
- HomeScreen hero: largest canvas (~200x200px), idle only
- Lazy-load models per cat (~5-8MB total, not all at once)

### CatAvatar3D Component
```typescript
interface CatAvatar3DProps {
  catId: string;
  evolutionStage: 1 | 2 | 3 | 4;
  pose: 'idle' | 'celebrate' | 'teach' | 'sleep' | 'sad' | 'play' | 'curious';
  size: number;
  interactive?: boolean;  // Tap to pet → purr + hearts
}
```

---

## Section 2: Screen-by-Screen Revamp

### P0: AuthScreen → "Cinematic Intro"

**Current:** Black void. Static cat in circle. 4 flat buttons.
**Target:**
- 3D Salsa model playing a mini piano (idle animation loop)
- Floating musical notes particle system in background
- App name "Purrrfect Keys" with shimmer/glow animation
- Tagline "Learn piano. Grow cats."
- Buttons with 3D depth, press animation, haptic + sound
- Animated gradient background (slow lava-lamp)

### P0: OnboardingScreen → "Choose Your Starter"

Pokemon-starter energy:
1. "Welcome" — 3D Salsa walks in, waves, speech bubble
2. "Experience" — Animated skill meter
3. "How will you play?" — 3D piano keyboard plays actual notes on tap
4. **"Choose your cat!"** — 3 starter cats on 3D pedestals, rotating. Tap to select → celebrate animation
5. "Daily Goal" — Duolingo-style goal picker

### P1: HomeScreen → "Command Center"

- **Hero:** 3D cat avatar (user's cat at evolution stage), tap to pet → purr + heart particles
- **Streak flame:** Animated 3D fire (not flat icon)
- **Daily goal:** Apple Watch-style ring fill animation
- **Action cards as game cards:** Rarity border glow (common=grey, AI=blue, challenge=gold), 3D tilt on press
- **Continue Learning:** Large, pulsing CTA (80% of taps should go here)
- **Daily Challenge:** Chest icon that shakes when available

### P1: ExercisePlayer → "The Arena"

#### 3D-Styled Notes (Skia 2D with 3D illusion — NOT full Three.js)
- Gradient fills (top-light, bottom-dark) for depth
- Glow halo around each note (hand-colored: blue right, orange left)
- Shadow underneath each note
- Hit effect: Skia particle burst (star/gem shapes scatter)
- Miss effect: Crack texture → fade red → dissolve
- Combo trail: Notes in combo streak get trailing glow

#### Combo System Visual Escalation
- **0-4:** Normal
- **5-9 (GOOD):** Glow intensifies, golden keyboard border
- **10-14 (FIRE):** Screen border glows orange, fire trail, cat bobs, "FIRE!" text
- **15-19 (SUPER):** Screen shake, gold notes, particle rain, cat plays, "SUPER!" slam
- **20+ (LEGENDARY):** Rainbow glow, heavy shake, golden storm, cat spins, "LEGENDARY!"

#### Keyboard Upgrade
- Visible depth (3D shadow on edges, bevel)
- Press: key physically pushes down (translateY + scale)
- Active note: key glows from within (radial gradient pulse)
- Correct: green flash + star particle from key
- Wrong: red flash + subtle shake

### P1: CompletionModal → "Loot Reveal" (Clash Royale chest-opening)

Timed sequence:
1. **0.0s** — Screen dims, cat slides to center
2. **0.3s** — "EXERCISE COMPLETE!" SLAM text (0→120%→100% + impact sound)
3. **0.8s** — Score ring fills (2s), number counts up
4. **2.3s** — Stars appear ONE BY ONE with starburst + escalating sound
5. **3.5s** — "NEW RECORD!" banner (if applicable)
6. **4.0s** — Gems rain down into counter (each with clink sound)
7. **4.8s** — XP bar fills (level up = FLASH + fanfare)
8. **5.5s** — Cat reaction (celebrate/curious/sad based on score)
9. **6.0s** — AI coaching tip (calm contrast)
10. **6.5s** — Action buttons: "Open Reward Chest" / "Next Exercise" / "Try Again"

#### Reward Chest System
| Performance | Chest | Reward |
|-------------|-------|--------|
| 3 stars + first time | Epic (purple glow) | 25 gems + cat XP boost |
| 3 stars (repeat) | Rare (blue glow) | 10 gems |
| 2 stars first time | Common (grey) | 5 gems |
| Below 2 stars | No chest | Just XP |

Chest opening: lid flies off → light beam → rewards float out → cat jumps

### P2: LevelMapScreen → "Trophy Road"

- Themed environments per tier (grassy tier 1, city tier 5, concert hall tier 10, space tier 15)
- Nodes: 3D-style landmarks instead of circles
- Current node: glowing beacon with particles
- Completed: gold checkmark, miniature trophy
- Locked: greyed, chains/lock silhouette
- Path: animated dotted line fills gold as you progress
- Cat companion: walks along path to current position

### P2: DailySessionScreen
- **Back button added** (fixed bug — was missing)
- Exercise cards as game cards (rarity borders, difficulty stars)
- Section headers with animated icons
- Progress indicator ("2/4 exercises done")

### P2: SongLibraryScreen → "Music Shop"
- Album-art thumbnails
- Metallic mastery tier badges
- Genre carousel with 3D card stack effect
- "NEW" pulsing badges
- Difficulty as star crystals

### P3: CatSwitchScreen → "Cat Collection"
- 3D models on rotating pedestals
- Evolution preview (Baby → Master transformation)
- Rarity borders (starter=common, purchasable=rare, legendary=rainbow)
- Ability icons with unlock glow

### P3: ProfileScreen → "Player Card"
- Large 3D cat centerpiece
- Game-style stat badges/shields
- Achievement grid with shimmer
- Dramatic streak flame
- Collapsible settings sections

---

## Section 3: Sound Design System (~30 assets)

### Sound Palette: Piano-Derived Game Sounds

**UI Taps:**
- `button_press` — single piano key (C5), quick attack, 150ms
- `toggle_on` — ascending C5→E5, 200ms
- `toggle_off` — descending E5→C5, 200ms
- `swipe` — quick 3-note glissando, 250ms
- `back_navigate` — soft whoosh + dampened note, 300ms

**Gameplay:**
- `note_correct` — bright bell chime + played note, 200ms
- `note_perfect` — above + sparkle overlay, 300ms
- `note_miss` — soft thud + muted string, 200ms
- `combo_5` — ascending C-E-G arpeggio, 400ms
- `combo_10` — power chord + whoosh, 500ms
- `combo_20` — orchestral stab + cymbal crash, 700ms
- `combo_break` — glass breaking + descending minor 3rd, 400ms
- `countdown_tick` — metronome wood block, 100ms
- `countdown_go` — cymbal crash + energy, 500ms

**Rewards:**
- `star_earn` — bright chime (unique per star count), 300ms
- `gem_clink` — glass/crystal clink, 150ms
- `xp_tick` — soft pip (repeating as counter fills), 50ms
- `level_up` — 4-note brass fanfare + cymbal, 1.5s
- `chest_open` — creaking lid + sparkle reveal, 1.2s
- `evolution_start` — timpani roll → orchestral hit, 2s

**Cat Sounds:**
- `meow_greeting` — friendly "mew!", 3 pitch variants, 400ms
- `purr_happy` — soft rumbling purr loop, 2s
- `meow_sad` — droopy "mrow...", 600ms
- `meow_celebrate` — excited double meow, 500ms

### SoundManager Architecture
```typescript
// src/audio/SoundManager.ts
class SoundManager {
  preload(): Promise<void>;       // Load all .wav at app launch
  play(name: SoundName): void;    // Fire-and-forget playback + haptic
  setVolume(vol: number): void;   // UI sound volume (separate from piano)
  setEnabled(on: boolean): void;  // Respect device silent mode + settings
}
```

All sounds paired with `expo-haptics` feedback. PressableScale auto-plays `button_press` + Light haptic.

### Sourcing Strategy
1. Piano-derived: from app's own piano samples, processed in DAW
2. Cat sounds: royalty-free packs (freesound.org)
3. Orchestral: free one-shot samples
4. Synthesized: generate UI sounds in DAW (Logic/GarageBand/LMMS)
5. Format: .wav, 44.1kHz, mono, normalized

---

## Section 4: Phase 10 — Social & Leaderboards

**Existing design doc:** `docs/plans/2026-02-24-phase10-social-leaderboards-design.md`

Additions for Arcade Concert Hall aesthetic:
- **Leaderboard:** Trophy Road style with animated rank changes, glow + particles
- **Friend activity:** Game-card notifications with friend's 3D cat avatar
- **Challenge cards:** "Battle request" aesthetic — glowing border, timer, opponent's cat
- **Share cards:** Include 3D cat render, score, app branding, QR code
- **League shields:** Metallic materials, promotion/demotion animations

### Navigation Change
```
Current:  Home | Learn | Songs | Play    | Profile
Target:   Home | Learn | Songs | Social  | Profile
```
Free Play moves to HomeScreen button.

---

## Section 5: 3D Assets Production Plan

### Phase A: Cat Models (parallel, can start immediately)
- 13 low-poly Blender models (~5K faces each)
- Shared bone rig (head, spine, tail, 4 legs, ears, jaw)
- 4 evolution variants per cat
- 7 animations each (idle, celebrate, teach, sleep, sad, play, curious)
- Export as .glb with Draco compression
- Total: ~5-8MB lazy-loaded

### Phase B: Gameplay 3D Assets
- Note gems (3 variants: quarter/half/whole, increasing size)
- Particle textures (starburst, gem trail, combo flame)
- Chest models (common/rare/epic)

### Phase C: UI 3D Elements
- Gem currency model (spinning diamond)
- Trophy models per league tier
- Crown/accessories for evolved cats

### Phase D: Environments
- LevelMap tier backgrounds (5 themed)
- Auth screen floating piano/notes scene

---

## Exit Criteria

- [ ] 3D cat avatars render on HomeScreen, CatSwitch, ExercisePlayer
- [ ] Auth + Onboarding screens feel cinematic
- [ ] ExercisePlayer has combo escalation + visual effects
- [ ] CompletionModal has full loot reveal sequence + chest system
- [ ] SoundManager with 30+ assets wired to all interactions
- [ ] LevelMap feels like trophy road
- [ ] All screens use game-card aesthetics
- [ ] Phase 10: friends, leagues, challenges, share cards, push notifications
- [ ] 60+ new tests covering new features
- [ ] 0 TypeScript errors, all existing tests pass
