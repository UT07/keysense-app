# Production Readiness Redesign — "Neon Arcade" Edition

**Date:** 2026-03-01
**Status:** Approved Design
**Target:** Clash Royale x Duolingo feel — loot reveals, combo escalation, screen shake, arena energy, character depth, habit systems
**Approach:** Full Figma redesign → implement screen-by-screen
**Prerequisite:** Audio input verification on physical device before UI work begins

---

## Table of Contents

1. [Visual Identity: Neon Arcade](#1-visual-identity-neon-arcade)
2. [Cat Customization: Cat Studio](#2-cat-customization-cat-studio)
3. [Social Revamp: The Arena](#3-social-revamp-the-arena)
4. [Screen Redesign Plan](#4-screen-redesign-plan)
5. [Figma Workflow](#5-figma-workflow)
6. [Audio Input Prerequisite](#6-audio-input-prerequisite)

---

## 1. Visual Identity: Neon Arcade

### Backgrounds
- Replace flat `#0A0A0A` with **animated gradient meshes** (slow drift, per-screen accent):
  - Home: warm purple → dark magenta
  - Social/Arena: cool blue → dark teal
  - Learn/LevelMap: green → dark emerald
  - Songs: amber → dark gold
  - Cat Studio: pink → dark violet
- Add **subtle particle systems** on key screens:
  - Home: floating musical notes
  - Learn: falling stars
  - Social: tiny gem sparkles
  - Cat Studio: swirling cat paw prints

### Cards & Surfaces
- **Glassmorphism** treatment: semi-transparent backgrounds with backdrop blur
- Active/highlighted cards: **neon glow border** (pulsing, color matches screen accent)
- Every card has a **subtle inner gradient** (not flat color)
- Shadow depth increases on interaction (press → deeper shadow)

### 3D Cat Quality
- Ambient light: 0.8 → **1.2**
- Material roughness: 0.7 → **0.3-0.4** (shinier, anime look)
- Add **rim lighting** (backlight) for silhouette definition
- Brighten darkest cats' body colors by 20-30%
- Add **glow halo** behind cat (per-cat accent color, subtle)
- Cat scale increased 10% across all screens for more presence

### Transitions
- Shared element transitions for cat avatars between screens
- Screen pushes: **spring physics** (bouncy, not linear)
- Tab switches: **crossfade + slide** (not instant swap)
- Every button: scale 0.95 + haptic + sound on press
- Modal entries: scale from 0.8 + fade (not slide up)

---

## 2. Cat Customization: Cat Studio

Replaces current CatSwitchScreen with a Bitmoji-inspired customization interface.

### Layout

```
┌─────────────────────────────────┐
│  [<Back]   Cat Studio    [Gems]│
├─────────────────────────────────┤
│     ┌───────────────────┐       │
│     │   3D Cat Preview  │       │  240px, animated, reactive to changes
│     │   (spins slowly,  │       │  Tap = pose, swipe = rotate
│     │    shows equipped) │       │
│     └───────────────────┘       │
│                                 │
│  [Cat Selector: horizontal scroll]
│  Active cat = lifted + glow     │
│                                 │
├─────────────────────────────────┤
│  Category tabs (swipeable):     │
│  [Hats] [Glasses] [Outfits]    │
│  [Capes] [Collars] [Effects]   │
│                                 │
│  Accessory grid (3 columns):    │
│  Owned = full color             │
│  Locked = silhouette + gem cost │
│  Tap = live preview on cat      │
│  Buy = confirm modal            │
└─────────────────────────────────┘
```

### 6 Accessory Categories

| Category | Items (5-8 each) | Price Range |
|----------|-------------------|-------------|
| Hats | Crown, Beret, Top Hat, Santa Hat, Pirate Hat, Wizard Hat, Cat Ears Headband, Bow | 10-150 gems |
| Glasses | Sunglasses, Monocle, Round Glasses, Star Glasses, Heart Glasses | 10-75 gems |
| Outfits | Tuxedo, Hawaiian Shirt, Hoodie, Superhero Cape+Suit, Royal Robe | 25-150 gems |
| Capes/Back | Cape, Wings, Backpack, Guitar Case, Music Notes Trail | 20-100 gems |
| Collars/Neck | Bowtie, Scarf, Necklace, Bandana, Medal | 10-50 gems |
| Effects | Sparkle aura, Fire aura, Rainbow trail, Musical notes cloud, Star halo | 50-200 gems |

### Pricing Tiers
- Common: 10-25 gems
- Rare: 30-50 gems
- Epic: 60-100 gems
- Legendary: 150+ gems

### Evolution-Gated Accessories
- Baby: No accessories
- Teen: Common accessories unlocked
- Adult: Rare + Epic accessible
- Master: Legendary accessible + 1 exclusive free accessory per cat

### Technical Implementation
- **State:** `settingsStore.equippedAccessories: Record<string, string>` (category → accessory ID)
- **State:** `settingsStore.ownedAccessories: string[]` (purchased accessory IDs)
- **3D rendering:** Accessories positioned relative to cat mesh bones (head bone for hats, neck for collars)
- **SVG fallback:** Overlay SVG accessories at predefined anchor points on CatAvatar
- **Displayed everywhere:** Home, Exercise, Completion, Social, Profile, Leaderboard

---

## 3. Social Revamp: The Arena

### Social Tab → "The Arena"

#### Arena Entrance
- Tab tap: screen dims → arena gates slide open → camera zooms through → your cat walks to center
- 1.5s animation, skippable by tap
- Arena background: animated parallax (stage lights, crowd silhouettes, floating musical notes)
- Tier-specific arena skin:
  - Bronze: small practice room
  - Silver: rehearsal studio
  - Gold: concert hall
  - Diamond: stadium with crowd

#### League Card (Hero Section)
- Animated tier border (pulsing with tier color)
- Pulsing shield icon
- Tier-colored gradient background
- Your rank, weekly XP, time remaining
- "View Standings" → Leaderboard

#### Friend Activity Feed
- Activity items show **friend's cat avatar** (3D thumbnail, 32px, with their accessories)
- Each activity has contextual text + cat reaction emoji
- **Reaction system:** Tap activity item → send reaction (clap, fire, heart, wow)
- Reactions appear as floating emoji bubbles

#### Battle Log (Clash Royale-style)
- Challenges displayed as **battle cards**:
  - Your cat (left) vs opponent cat (right), facing each other
  - Score comparison bar (red vs blue, animated fill)
  - Win/Loss crown display
  - Replay button (shows ghost note pattern — stretch goal)

#### Music Guilds (Bands)
- Create/join a "Band" (8-12 members)
- Band leaderboard (aggregated weekly XP from all members)
- Band chat (emoji reactions only — no free text, kid-safe)
- Band challenges (band vs band weekly score race)
- Band banner customization (icon + accent color)

### Leaderboard → "League Arena"

- **Podium:** Top-3 players shown as 3D cat avatars on podium blocks (1st center/tall, 2nd left, 3rd right)
- Promotion zone: green glow cards + upward arrow animation
- Demotion zone: red-tinted cards + subtle shake
- **Your row** pinned at bottom if scrolled off-screen + "Jump to rank" button
- League promotion: full-screen ceremony (arena gates → new tier badge slams down → confetti → fireworks)
- League demotion: subtle red fade + downward slide (not punishing but visible)

### Friend Profile Cards
- Tap friend → see their cat with accessories, evolution stage, recent achievements
- Prominent "Challenge" button
- Their league tier, streak count, level visible

---

## 4. Screen Redesign Plan

### Priority 0 — Prerequisite
Audio input verification on physical device (see Section 6)

### Priority 1 — First Impression Screens (Design in Figma)

| Screen | Key Changes |
|--------|-------------|
| **Onboarding** | Neon Arcade intro, animated cat selection with live 3D preview, gradient mesh background, spring transitions between steps |
| **Auth Screen** | Animated gradient mesh, glassmorphism auth buttons, larger cat with glow halo, neon app title |
| **Home Screen** | Gradient mesh background, glassmorphism cards, particle system, cat with accessories, neon-glow CTA cards |
| **Cat Studio** (new) | Full Bitmoji-style editor replacing CatSwitchScreen |
| **The Arena** (Social) | Arena entrance, battle log, animated league card, friend cat avatars, music guilds |
| **Leaderboard** | Podium with 3D cats, promotion/demotion animations, tier arena skins |

### Priority 2 — Gameplay Screens

| Screen | Key Changes |
|--------|-------------|
| **Exercise Player** | Cat with accessories as ExerciseBuddy, improved combo glow (neon), glassmorphism score overlay |
| **Completion Modal** | 3D chest open animation, gem rain, cat celebrates with accessories, neon star burst |
| **Level Map** | Gradient zones per tier, tier arena backgrounds, cat companions with accessories at milestones |
| **Daily Session** | Glassmorphism exercise cards, neon session-type badge, Salsa with speech bubble |

### Priority 3 — Supporting Screens

| Screen | Key Changes |
|--------|-------------|
| **Profile** | Large cat with accessories + glow halo, glassmorphism stat cards, animated streak flame, achievement grid with shimmer |
| **Song Library** | Genre cards with album-art gradients, metallic mastery badges, featured song spotlight with neon border |
| **Add Friend** | Neon code display, cat preview on lookup |
| **Friends List** | Cat avatars in rows, reaction bubbles |

### Not Being Redesigned
- Settings screen (functional, low visual weight)
- MicSetup (functional wizard)
- Internal dev/debug screens

---

## 5. Figma Workflow

### Phase 1: Design System Setup
1. Create Figma design system rules matching `src/theme/tokens.ts`
2. Build component library in Figma: glassmorphism cards, neon borders, gradient meshes, cat avatars, accessory items
3. Define the 5 screen-specific color palettes (Home/Social/Learn/Songs/CatStudio)

### Phase 2: Screen Design (Priority 1)
4. Design each Priority 1 screen in Figma
5. Review with user after each screen
6. Iterate until approved

### Phase 3: Screen Design (Priority 2-3)
7. Design Priority 2 screens (gameplay)
8. Design Priority 3 screens (supporting)
9. Final review pass for consistency

### Phase 4: Implementation
10. Use `get_design_context` to extract code from approved Figma designs
11. Implement screen-by-screen, starting with Priority 1
12. Each screen: extract from Figma → adapt to React Native → wire up state → test

---

## 6. Audio Input Prerequisite

Before any UI work begins, verify on physical device:

| Test | Expected | Status |
|------|----------|--------|
| Mic permission request completes within 5s | Permission dialog appears, doesn't hang | Pending |
| Mic capture produces audio buffers | Buffer count > 0 after 3s | Pending |
| YIN pitch detection (monophonic) | Correct note within ±1 semitone for C4-C5 | Pending |
| ONNX Basic Pitch (polyphonic) | Model loads without crash, detects chords | Pending |
| Ambient noise calibration | RMS measurement completes, adjusts thresholds | Pending |
| Input method switch (touch → mic → touch) | No hang, no slowdown, method updates immediately | Pending |
| Preference persists | Kill app, reopen → same input method selected | Pending |
| Auto mode with mic granted | Selects mic when MIDI unavailable | Pending |
| Auto mode without mic granted | Falls back to touch, no permission prompt | Pending |
| Exercise loads with mic selected | Exercise loads within 10s regardless of mic outcome | Fixed (timeout protection) |

### Code Fixes Already Applied (This Session)
1. `AudioCapture.ts`: 5s timeout on `requestMicrophonePermission()`, 3s on `checkMicrophonePermission()`
2. `InputManager.ts`: Auto mode checks existing permission (non-blocking), 8s timeout on `createMicrophoneInput()`
3. `useExercisePlayback.ts`: 10s safety timeout on `manager.initialize()`
4. `InputManager.test.ts`: Updated test expectations for new auto-detection behavior (26 tests passing)

---

## 7. Tech Stack Assessment

### Keep (No Changes Needed)
- **React Native (Expo SDK 52)** — Stable, well-tested, no reason to migrate
- **Reanimated 3** — UI transitions, spring physics, gesture handling
- **Zustand** — State management, 15 stores all working
- **Firebase** — Auth, Firestore, Cloud Functions
- **expo-av (ExpoAudioEngine)** — Primary audio playback until RN 0.77 enables react-native-audio-api codegen

### Add
- **@shopify/react-native-skia** — Required for arcade-quality 2D effects:
  - Particle systems (musical notes, sparkles, fire trails)
  - Glassmorphism blur (BackdropFilter)
  - Gradient mesh backgrounds
  - Hit effect shaders (glow bursts, dissolves)
  - Combo fire/rainbow trails
- **Note:** Skia handles 2D visual effects; Three.js/R3F stays for 3D cat rendering only

### Fix (Not Replace)
- **3D Cats (react-three-fiber v8)** — Keep existing R3F pipeline, improve quality:
  - Reduce material roughness: 0.7 → 0.3-0.4 (shinier anime look)
  - Increase ambient light: 0.8 → 1.2
  - Add rim lighting for silhouette definition
  - Brighten darkest cats' body colors by 20-30%
  - Add glow halo behind cat (per-cat accent color)
  - Scale up 10% across all screens
- **ONNX Basic Pitch** — Optimize inference latency, test accuracy on device

### Evaluate Later
- **react-native-audio-api (WebAudioEngine)** — Blocked on RN 0.77+ for codegen. Currently JSI fallback.
- **ElevenLabs/OpenAI TTS** — Higher quality cat voices (currently expo-speech)
- **Lottie/Rive** — For complex pre-built animations if Reanimated + Skia aren't sufficient

---

## Success Criteria

The redesign is complete when:
1. Every screen matches its Figma design within 95% fidelity
2. Cat accessories display correctly on all 12 cats across all screens
3. The Arena social hub has arena entrance, battle log, guilds, and friend cat avatars
4. 3D cats look polished (no black silhouettes, rim lighting, anime-style materials)
5. All transitions use spring physics and have haptic + sound feedback
6. Audio input works reliably on physical device (all 10 tests pass)
7. Full test suite passes (2,600+ tests, 0 failures)
8. TypeScript: 0 errors
