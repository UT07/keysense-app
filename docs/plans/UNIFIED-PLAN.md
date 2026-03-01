# Purrrfect Keys — Unified Plan

**Last Updated:** February 28, 2026
**Goal:** Production-quality piano learning app on App Store & Play Store
**Target Launch:** June 8, 2026 (16-week roadmap from Feb 17)
**Codebase Health:** 0 TypeScript errors, 2,630 tests passing, 122 suites

> **This is the single source of truth.** All historical plan files have been moved to `docs/plans/archive/`. The only other active plan file is `docs/plans/2026-02-27-arcade-concert-hall-implementation.md` (the task-by-task execution plan for Phase 10).

---

## Status Overview

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| Phase 1 | Core Loop | **COMPLETE** | Exercise Player, scoring, XP, streaks, AI coach, 30 exercises |
| Phase 2 | Gamification & Polish | **COMPLETE** | LevelMap, theme, audio rewrite, mascot system, transitions |
| Phase 3 | Firebase Auth + Sync | **COMPLETE** | Auth (4 providers), cloud sync, offline queue, cross-device |
| Phase 4+ | Adaptive Learning + UI Overhaul | **COMPLETE** | Design tokens, learner profile, Gemini generation, SplitKeyboard, 32 achievements |
| Phase 5 | Adaptive Learning Revamp | **COMPLETE** | SkillTree (100 nodes), CurriculumEngine, voice coaching, weak spots, difficulty engine |
| Phase 5.2 | 365-Day Curriculum | **COMPLETE** | 15 tiers, skill decay, multi-session mastery, session types |
| Phase 6 | Avatar Evolution & Gamification | **COMPLETE** | 4-stage evolution, gems, 12 abilities, cat collection, EvolutionReveal |
| Phase 6.5 | AI Coach Fix + Wiring | **COMPLETE** | 10 coach bugs, FreePlay key detection, gamification wiring |
| Phase 7 | UI Revamp + Game Feel | **COMPLETE** | Concert Hall palette, composable SVG cats, Salsa NPC, custom tab bar |
| Phase 7.5 | All-AI Exercise Generation | **COMPLETE** | Skill-aware AI generation for all tiers |
| — | Gem Bug Fix | **COMPLETE** | immediateSave, auto-claim, toast feedback |
| — | Cat Gallery Redesign | **COMPLETE** | Unified swipeable gallery with abilities, buy flow |
| Phase 8 | Audio Input (Mic) | **COMPLETE** | YIN pitch detection, polyphonic ONNX Basic Pitch, InputManager |
| Phase 9 | Music Library | **COMPLETE** | 124 songs in Firestore, browse/search UI, mastery tiers |
| Phase 9.5 | UX Overhaul | **COMPLETE** | Assessment fix, HomeScreen redesign, mastery tests |
| Phase 10 | Arcade Concert Hall Revamp | **COMPLETE** | Sound design, combo escalation, loot reveals, screen redesigns |
| Phase 10.5 | Social & Leaderboards | **COMPLETE** | Friends, leagues, challenges, share cards, notifications |
| — | 3D Cat Integration | **COMPLETE** | R3F v8, 4 GLB body types, accessories, color config, 3 screens wired |
| **Phase 11** | **QA + Launch + Audit** | **IN PROGRESS** | Account deletion, Cloud Functions, CI/CD, MIDI hardware, codebase audit (40 issues), Maestro E2E |

---

## Completed Phases (Summary)

### Phase 1: Core Loop
Exercise Player with PianoRoll + Keyboard, 5-dimensional scoring engine, nearest-note matching, XP/levels/streaks, AI Coach (Gemini 2.0 Flash), ContentLoader for 30 JSON exercises across 6 lessons, ExpoAudioEngine with round-robin voice pools, MIDI input architecture.

### Phase 2: Gamification & Polish
LevelMapScreen (Duolingo-style), Concert Hall dark theme, profile editing, all 30 exercises validated, audio engine rewrite (JSI WebAudio + Expo fallback), mascot system (12 cats), ScoreRing, PressableScale, transition screens, multi-touch keyboard.

### Phase 3: Firebase Auth + Sync
Firebase Auth (Email, Google, Apple, Anonymous), SyncManager with offline queue + Firestore pull/merge, cross-device sync ("highest wins"), local-to-cloud migration, auth resilience (guest fallback, 8s timeout).

### Phase 4+: Adaptive Learning + UI Overhaul
22 tasks: design tokens, learner profile store, cat dialogue engine (12 cats x 14 triggers), Gemini exercise generation + buffer manager, skill assessment screen, screen redesigns, SplitKeyboard, 32 achievements, cat quest service.

### Phase 5 + 5.2: Adaptive Learning Revamp + 365-Day Curriculum
SkillTree DAG (100 nodes, 15 tiers, 12 categories), CurriculumEngine (4 session types), skill decay (14-day half-life), AI generation for tiers 7-15, DailySessionScreen, VoiceCoachingService + TTSService, WeakSpotDetector, DifficultyEngine, FreePlayAnalyzer, 150+ new tests.

### Phase 6 + 6.5: Avatar Evolution & Gamification + AI Coach Fix
4-stage evolution (Baby/Teen/Adult/Master), gem currency, 12 abilities via AbilityEngine, CatCollectionScreen, EvolutionReveal animation, GemEarnPopup, onboarding cat selection. AI Coach: 10 bugs fixed, FreePlay expanded to 48 scales, gamification fully wired.

### Phase 7: UI Revamp + Game Feel & Polish
Concert Hall palette (black + crimson), typography/shadow/animation/glow token systems, composable SVG cat system (12 profiles), Reanimated pose system (7 poses), SalsaCoach NPC, screen redesigns (Home, CompletionModal, DailySession, Profile), custom tab bar, ExerciseLoadingScreen, cat character renames (Vinyl→Ballymakawww, Noodle→Shibu, Pixel→Bella).

### Phase 7.5: All-AI Exercise Generation
Every exercise from tier 1 onward is AI-generated. Static JSON became offline fallback only. All 6 batches: skill mastery, GenerationHints for 100 SkillTree nodes, skill-aware buffer/generation pipeline, CurriculumEngine AI-first, LevelMap/LessonIntro AI integration, offline bootstrap.

### Gem Bug Fix + Cat Gallery Redesign (Feb 23)
Race condition fix: `createImmediateSave` utility, `completeDailyChallengeAndClaim()` atomic action. Unified gallery: merged CatSwitchScreen + CatCollectionScreen, 88%-width swipeable cards, ability icons, buy flow modal, gem balance header.

### Phase 8: Audio Input — Microphone Pitch Detection (Feb 23-26)
**Monophonic:** YINPitchDetector (pure TS), NoteTracker hysteresis, AudioCapture (react-native-audio-api), MicrophoneInput, InputManager (MIDI > Mic > Touch), MicSetupScreen, onboarding 3-option input, Free Play wired.
**Polyphonic:** PolyphonicDetector (ONNX Basic Pitch, 88 note bins), MultiNoteTracker (per-note hysteresis), AmbientNoiseCalibrator (RMS-based threshold tuning). Falls back to YIN if ONNX fails.
**Latency:** Mono=100ms compensation, Poly=120ms. Both get 1.5x timing tolerance for mic input.

### Phase 9: Music Library (Feb 24)
124 songs in Firestore (37 Gemini + 50 TheSession folk + 38 PDMX classical). Song types, ABC parser (abcjs), mastery tiers (none→bronze→silver→gold→platinum), Firestore CRUD, Gemini generation, SongLibraryScreen (genre carousel, search), SongPlayerScreen (section→Exercise conversion), 6 achievements, gem rewards on tier upgrade.

### Phase 9.5: UX Overhaul (Feb 27)
Assessment skill seeding fix, challenge→AI exercise wiring, mastery tests for all 15 tiers, HomeScreen feed-style redesign with MusicLibrarySpotlight and ReviewChallengeCard.

---

## Phase 10: Arcade Concert Hall Revamp (COMPLETE)

**Execution plan:** `docs/plans/2026-02-27-arcade-concert-hall-implementation.md` (24 tasks, 10 batches)

**Goal:** Transform from functional dark-mode Duolingo into Duolingo x Clash Royale hybrid — 3D cats, dramatic game-feel, full sound design, loot reveals.

**Visual target:** Duolingo's clear progression + Clash Royale's dopamine delivery (particles, reveals, screen shake, loot, sound on everything)

### Core Philosophy: "Arcade Concert Hall"

**Duolingo DNA:** Clear skill tree, streak psychology, session structure, celebration moments, daily goal ring-fill.

**Clash Royale / Brawl Stars DNA:** Chest/loot reveals, screen shake on combos, particle trails on rewards, buttons that breathe (idle pulse), card rarity aesthetics, sound on EVERYTHING.

### Retention-Ordered Priority

| Priority | Workstream | Impact |
|----------|-----------|--------|
| **P0** | Auth + Onboarding | 40%+ first-session retention |
| **P0** | 3D Cat Avatar system | Core differentiator |
| **P1** | HomeScreen command center | Daily return driver |
| **P1** | ExercisePlayer + CompletionModal | Core loop dopamine |
| **P1** | Sound Design system | Multiplier on all visuals |
| **P2** | LevelMap Trophy Road | Progression visibility |
| **P2** | DailySession + SongLibrary | Session + content quality |
| **P3** | CatSwitch + Profile | Collection + vanity retention |

### Key Deliverables

#### 1. Sound Design System (~30 assets)

**SoundManager** (`src/audio/SoundManager.ts`): Singleton service separate from piano AudioEngine. Uses expo-av round-robin pools + expo-haptics pairing. Fire-and-forget API: `soundManager.play('button_press')`.

**Sound categories:**
- **UI (5):** button_press, toggle_on, toggle_off, swipe, back_navigate
- **Gameplay (9):** note_correct, note_perfect, note_miss, combo_5, combo_10, combo_20, combo_break, countdown_tick, countdown_go
- **Rewards (6):** star_earn, gem_clink, xp_tick, level_up, chest_open, evolution_start
- **Cat (4):** meow_greeting, purr_happy, meow_sad, meow_celebrate

**Sourcing:** Piano-derived + royalty-free + synthesized. Format: .wav, 44.1kHz, mono, normalized.

All sounds paired with `expo-haptics` feedback. PressableScale auto-plays `button_press` + Light haptic.

#### 2. Combo Escalation System

5-tier visual escalation during gameplay:

| Combo | Tier | Color | Effects |
|-------|------|-------|---------|
| 0-4 | NORMAL | — | Standard gameplay |
| 5-9 | GOOD | #FFD700 gold | Glow intensifies, golden keyboard border |
| 10-14 | FIRE | #FF6B35 orange | Screen border glow, fire trail, "FIRE!" text |
| 15-19 | SUPER | #FF1744 crimson | Screen shake, gold notes, "SUPER!" slam |
| 20+ | LEGENDARY | rainbow | Heavy shake, golden storm, "LEGENDARY!" |

**Components:** `ComboMeter` (tier badge + scale animation), `ComboGlow` (animated background overlay with tier-specific gradients).

#### 3. CompletionModal → "Loot Reveal"

Timed 10-phase sequence (Clash Royale chest-opening energy):
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

**Reward Chest System:**

| Performance | Chest | Reward |
|-------------|-------|--------|
| 3 stars + first time | Epic (purple glow) | 25 gems + cat XP boost |
| 3 stars (repeat) | Rare (blue glow) | 10 gems |
| 2 stars first time | Common (grey) | 5 gems |
| Below 2 stars | No chest | Just XP |

#### 4. 3D Cat Avatar System

**Technology:** Blender (low-poly ~5K faces) → react-three-fiber + @react-three/drei (native) → .glb with Draco compression (~200-400KB per cat)

**CatAvatar3D component:** Wraps react-three-fiber Canvas with SVG CatAvatar fallback when expo-gl unavailable. Props: `catId`, `evolutionStage`, `pose`, `size`, `interactive`.

**Performance budget:** ONE 3D canvas per screen max, 30fps, lazy-load models. ExerciseBuddy: tiny (80x80px), HomeScreen: largest (~200x200px).

**13 models:** 12 playable + Salsa NPC. Shared bone rig, per-cat mesh/texture, 4 evolution variants, 7 animations (idle, celebrate, teach, sleep, sad, play, curious).

**Fallback:** Current SVG composable system for devices without WebGL.

#### 5. Game Card Design System

**Rarity levels:** common (grey border), rare (blue glow), epic (purple glow), legendary (rainbow shimmer).

**GameCard component:** Wraps PressableScale with rarity border gradients + 3D tilt on press.

**Applied to:** HomeScreen action cards, DailySession exercise cards, SongLibrary song cards, CompletionModal reward cards.

#### 6. Screen-by-Screen Revamp

**AuthScreen → "Cinematic Intro":** 3D Salsa playing mini piano, floating musical notes particles, "Purrrfect Keys" shimmer title, tagline "Learn piano. Grow cats.", 3D-depth buttons with press animation + haptic + sound.

**OnboardingScreen → "Choose Your Starter":** Pokemon-starter energy — 3D Salsa walks in, animated skill meter, 3D piano keyboard plays actual notes, 3 starter cats on 3D pedestals, Duolingo-style goal picker.

**HomeScreen → "Command Center":** 3D cat hero (tap to pet → purr + hearts), animated 3D streak flame, Apple Watch-style ring fill, game cards with rarity borders + 3D tilt, pulsing Continue Learning CTA, shaking Daily Challenge chest.

**LevelMapScreen → "Trophy Road":** Themed environments per tier (grassy→city→concert hall→space), 3D-style landmarks instead of circles, glowing beacon on current node, animated dotted path fills gold, cat walks along path.

**DailySessionScreen:** Exercise cards as game cards (rarity borders, difficulty stars), section headers with animated icons, progress indicator.

**SongLibraryScreen → "Music Shop":** Album-art thumbnails, metallic mastery badges, genre carousel with 3D card stack, "NEW" pulsing badges.

**CatSwitchScreen → "Cat Collection":** 3D models on rotating pedestals, evolution preview, rarity borders, ability unlock glow.

**ProfileScreen → "Player Card":** Large 3D cat centerpiece, game-style stat badges, achievement grid with shimmer, dramatic streak flame.

### Technology Stack (New Dependencies)

- `react-three-fiber` + `@react-three/drei` — 3D cat rendering
- `expo-gl` — WebGL context for react-three-fiber
- `three` — Three.js core
- `@shopify/react-native-skia` — Particle effects (optional, can use Reanimated)

### Implementation Batches (24 tasks)

| Batch | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-3 | SoundManager foundation + PressableScale wiring |
| 2 | 4-5 | Design tokens (combo tiers, rarity) + GameCard component |
| 3 | 6-9 | ExercisePlayer combo escalation (ComboMeter, ComboGlow, keyboard, sound wiring) |
| 4 | 10-12 | CompletionModal loot reveal (timed sequence, chest system, chest animation) |
| 5 | 13 | HomeScreen command center redesign |
| 6 | 14 | AuthScreen cinematic intro |
| 7 | 15-17 | 3D Cat Avatar infrastructure (CatAvatar3D, HomeScreen integration, ExerciseBuddy) |
| 8 | 18 | LevelMap Trophy Road |
| 9 | 19-22 | Remaining screens (Onboarding, DailySession, SongLibrary, CatSwitch + Profile) |
| 10 | 23-24 | Verification + docs update |

Full task details: `docs/plans/2026-02-27-arcade-concert-hall-implementation.md`

---

## Phase 10.5: Social & Leaderboards (COMPLETE)

**Goal:** Social features that drive daily engagement — friends, leagues, challenges, sharing.

### Friends System

Each user gets a unique 6-character alphanumeric friend code. Adding methods: manual code entry, deep link (`purrrfectkeys.app/add/ABC123`), QR code (stretch).

**Activity feed:** Shows friend milestones with user display name + equipped cat avatar. Items expire after 7 days.

### Weekly Leagues

Duolingo-style competitive leagues with 30-person groups:

| League | Promote | Demote |
|--------|---------|--------|
| Bronze | Top 10 → Silver | — |
| Silver | Top 10 → Gold | Bottom 5 → Bronze |
| Gold | Top 10 → Diamond | Bottom 5 → Silver |
| Diamond | — | Bottom 5 → Gold |

Resets every Monday 00:00 UTC. Cloud Function `rotateLeagues()`. Opt-in.

### Friend Challenges

Challenge a friend to beat your score on a specific exercise or song. 48h window. Winner gets 10 gems, loser gets 5. Push notification via FCM.

### Share Cards

Shareable image cards via `react-native-view-shot`: score card, streak card, evolution card, league card. Native share sheet.

### Push Notifications

| Trigger | Priority | Type |
|---------|----------|------|
| Daily reminder | Normal | Local |
| Streak at risk | High | Local |
| Challenge received | High | Remote (FCM) |
| League promotion | Normal | Remote |
| Friend milestone | Low | Remote |
| Evolution approaching | Normal | Local |

**Implementation:** `@react-native-firebase/messaging` (FCM) + `expo-notifications` (local).

### Firebase Backend

```
Firestore Collections:
  users/{uid}/friends          (friend connections)
  users/{uid}/activity         (activity feed items)
  leagues/{leagueId}           (weekly league data)
  challenges/{challengeId}     (friend-to-friend)
  friendCodes/{code}           (lookup table → uid)

Cloud Functions:
  onWeekEnd → rotateLeagues()  (Monday 00:00 UTC)
  onXpChange → updateLeague()  (real-time standings)
  onChallenge → sendNotif()    (push notification)
  onMilestone → notifyFriends()(activity feed broadcast)
```

### New Files

| File | Purpose |
|------|---------|
| `src/stores/socialStore.ts` | Friends, activity feed, challenges |
| `src/stores/leagueStore.ts` | League standings, rank, promotion |
| `src/services/firebase/socialService.ts` | Firestore CRUD for friends, challenges |
| `src/services/firebase/leagueService.ts` | League queries, weekly XP |
| `src/services/notificationService.ts` | FCM + local notifications |
| `src/screens/SocialScreen.tsx` | Friends list + activity feed |
| `src/screens/LeaderboardScreen.tsx` | League standings UI |
| `src/screens/ChallengeScreen.tsx` | Active/pending challenges |
| `src/screens/AddFriendScreen.tsx` | Friend code + share link |
| `src/components/ShareCard.tsx` | Shareable images |
| `firebase/functions/leagueRotation.ts` | Weekly promote/demote |
| `firebase/functions/socialNotifications.ts` | Push on social events |

### Navigation Change

Replace "Play" tab with "Social" tab. Free Play moves to HomeScreen button.
Tab order: Home, Learn, Songs, Social, Profile.

### Exit Criteria

- Friend system with code/link adding + activity feed
- Weekly leagues (Bronze → Diamond) with promotion/demotion + leaderboard UI
- Friend challenges with 48h window
- Shareable cards
- Push notifications (local + remote via FCM)
- Cloud Functions for league rotation + social notifications
- ~50+ new tests

---

## Phase 11: QA + Launch + Comprehensive Audit (IN PROGRESS)

> **Manual Verification:** See `docs/MANUAL-VERIFICATION-CHECKLIST.md` for the hands-on runbook covering Firebase Console, DevOps, App Store, device testing, and security — things that require YOUR access and judgment.
>
> **System Design:** See `docs/system-design-analysis.md` for the full architecture assessment, cost projections, scalability analysis, and 30 prioritized recommendations.

### Completed (Feb 28)

#### Account Deletion (GDPR Compliance)
- **Cloud Function** (`firebase/functions/src/deleteUserData.ts`): Admin SDK deletion of 9 subcollections, friend codes, league membership, challenges, bidirectional friend cleanup, root document
- **Client-side fallback** in `src/services/firebase/firestore.ts`: `deleteUserData()` tries Cloud Function first, falls back to client-side deletion — ensures cleanup even without deployed functions
- **10 new tests** in `deleteUserData.test.ts`

#### Gemini API Moved to Cloud Functions
- **3 Cloud Functions** in `firebase/functions/src/`: `generateExercise.ts`, `generateSong.ts`, `generateCoachFeedback.ts`
- All use `httpsCallable` with Firebase Auth verification
- Client services fall back to direct Gemini API calls if Cloud Function unavailable
- API key secured server-side when functions are deployed

#### GitHub Actions CI/CD
- **`.github/workflows/ci.yml`**: typecheck + lint + test on every push/PR
- **`.github/workflows/build.yml`**: EAS Build (iOS preview) triggered on `v*` tags

#### Environment Security Audit
- `.env.example` updated with all required variables
- PostHog env var mismatch fixed
- EAS channels configured (preview + production)

#### Sound Enhancement
- Procedural synthesis: formant-based cat vocals, bandpass filters, reverb, deterministic noise
- SoundManager haptic-only fallback when .wav files missing

#### Bug Fixes
- `textShadowColor` Reanimated error in AuthScreen (replaced with static style)
- AddFriendScreen anonymous user auth gate (prompt to sign in)
- Skeleton code cleanup (SignatureExercise, RiveCatAvatar removed)

#### 3D Cat Models
- `chonky-cat.glb` exported: 9 named meshes, 7 NLA animations, Draco compression
- Blender MCP integration configured (`.mcp.json`)

#### MIDI Hardware Integration
- `@motiz88/react-native-midi` package (Expo Modules, Web MIDI API)
- NativeMidiInput rewritten for raw MIDI byte parsing
- Needs dev build for hardware testing

#### Codebase Audit
- Comprehensive audit identified **40 issues**: 8 P0, 13 P1, 7 P2, 12 P3
- Categories: crash risks, security, performance, UX, code quality

### In Progress

#### Maestro E2E Testing
- 12 flow YAML files planned covering: onboarding, exercise player, daily session, song library, social, cat gallery, settings, auth flows, free play, level map, achievements, notifications
- Setup: `npm install -g @mobile.dev/maestro-cli`

#### Deep Testing Strategy (Planned)
- Crash monitoring (Crashlytics integration)
- Security scanning (Firebase rules audit, API key exposure check)
- Performance profiling (startup time, frame rates, memory leaks)
- Accessibility audit (VoiceOver labels, touch targets, color contrast)
- Bundle analysis (JS bundle size, asset inventory)
- Visual regression (screenshot comparison)
- Memory leak detection (30-minute session profiling)
- Network resilience (offline mode, intermittent connectivity)

#### Cat Voice TTS Upgrade (Planned)
- Evaluate ElevenLabs and OpenAI TTS for per-cat unique voices
- Currently using expo-speech with pitch/rate tuning per cat

### Deep Audit Checklist

Every item below must be verified on a physical device (not just simulator) where indicated.

#### 1. Core Exercise Loop (Device Required)
- [ ] Play all 30 static exercises end-to-end (6 lessons x 5 exercises)
- [ ] Verify scoring produces reasonable results for touch input
- [ ] Verify scoring with MIDI keyboard (if dev build with native module)
- [ ] Verify count-in timing matches metronome beats
- [ ] Test pause/resume mid-exercise (state preserved)
- [ ] Test force-quit mid-exercise, re-open (no crash, clean state)
- [ ] Verify PianoRoll scrolls smoothly at 60fps during playback
- [ ] Verify Keyboard auto-zooms correctly for each exercise note range
- [ ] Verify CompletionModal loot reveal plays full 10-phase sequence
- [ ] Verify star thresholds: 70/85/95 match scoring output
- [ ] Verify combo counter increments and resets correctly
- [ ] Verify combo tier escalation (5=GOOD, 10=FIRE, 15=SUPER, 20=LEGENDARY)
- [ ] Verify "Try Again" vs "Next Exercise" buttons are context-correct
- [ ] Test landscape orientation lock (ExercisePlayer only)

#### 2. AI Exercise Generation
- [ ] Generate exercises for ALL 15 tiers via DailySessionScreen
- [ ] Verify generated exercises are playable (no out-of-range notes, valid durations)
- [ ] Verify generated exercises match the requested skill category
- [ ] Verify offline fallback works when Gemini API is unreachable
- [ ] Verify template exercises load correctly for mastery tests (tiers 7-15)
- [ ] Test 20+ AI coaching scenarios (various score ranges + attempt counts)
- [ ] Verify AI coach responses are non-generic and reference actual errors
- [ ] Verify coaching cache works (same scenario → cached response)
- [ ] Verify rate limiting prevents excessive API calls

#### 3. AI Coach Quality
- [ ] Score 95%+ → celebratory response, suggests next challenge
- [ ] Score 70-80% → specific timing or pitch tip
- [ ] Score <50% → encouraging, focused on one issue
- [ ] Attempt #5+ → acknowledges persistence
- [ ] Verify no "As an AI" or technical jargon in responses
- [ ] Verify offline coaching templates are contextually appropriate
- [ ] Verify cat personality is reflected in VoiceCoachingService responses
- [ ] Test TTS playback of coaching (TTSService via expo-speech)

#### 4. Microphone Input (Device Required)
- [ ] Grant microphone permission flow (MicSetupScreen)
- [ ] Deny permission → graceful fallback to touch
- [ ] YIN monophonic detection: play single notes C4-C5, verify recognition
- [ ] Polyphonic detection (if ONNX model loads): play 2-3 note chords
- [ ] Verify mic timing compensation (100ms mono, 120ms poly)
- [ ] Verify 1.5x timing tolerance multiplier for mic input
- [ ] Test in quiet room vs noisy environment
- [ ] AmbientNoiseCalibrator: verify threshold auto-tune
- [ ] Verify ONNX → YIN fallback when model fails to load
- [ ] Test mic input during Free Play (PlayScreen)

#### 5. Music Library
- [ ] Browse all genres in SongLibraryScreen carousel
- [ ] Search: test 5+ queries, verify results filter correctly
- [ ] Difficulty filter: verify songs match selected difficulty
- [ ] Load a song from each genre → SongPlayerScreen
- [ ] Play each section of a multi-section song
- [ ] Toggle melody/full layers
- [ ] Verify mastery tier calculation (bronze 70+, silver 80+, gold 90+, platinum 95+)
- [ ] Verify gem rewards on tier upgrade
- [ ] Verify section-to-exercise conversion produces valid exercises
- [ ] Test song request FAB (Gemini generation if daily limit not hit)
- [ ] Verify all 124 songs have valid ABC notation that parses
- [ ] Spot-check 10 songs: play through, verify notes sound correct

#### 6. Adaptive Learning & Curriculum
- [ ] Verify SkillTree DAG: no circular dependencies (unit tests cover this)
- [ ] Verify CurriculumEngine produces 4 session types
- [ ] DailySessionScreen: verify warm-up/lesson/challenge sections populate
- [ ] Skill decay: set a skill's lastPracticed to 15+ days ago → ReviewChallengeCard appears
- [ ] WeakSpotDetector: intentionally miss notes → verify weak spot detection
- [ ] DifficultyEngine: complete exercises → verify tempo increases by 5 BPM
- [ ] Assessment screen: complete assessment → verify correct lesson placement
- [ ] Post-assessment: verify all prerequisite skills are seeded

#### 7. Gamification & Progression
- [ ] XP awards match scoring: pass=10, per star=10, first=25, perfect=20
- [ ] Level-up triggers at correct XP thresholds
- [ ] Streak increments daily, resets after 2 missed days (no freeze)
- [ ] Streak freeze: verify covers exactly 1 missed day
- [ ] Daily goal tracking: minutes practiced → goal progress
- [ ] Daily challenge: verify challenge type matches `getDailyChallengeForDate()`
- [ ] Daily challenge completion → gem reward
- [ ] Weekly bonus challenge: appears on correct day, harder thresholds
- [ ] Monthly challenge: 48h window, multi-exercise requirement
- [ ] Achievement unlocks: trigger 5+ different achievement types
- [ ] AchievementToast animation plays on unlock
- [ ] Gem earn/spend: verify balance is correct after transactions
- [ ] GemEarnPopup: verify animation plays on gem earn

#### 8. Cat Evolution System
- [ ] Starting cat selection during onboarding (3 starters)
- [ ] Cat XP accumulates from exercise completion
- [ ] Evolution stage transitions: baby→teen→adult→master at correct thresholds
- [ ] EvolutionReveal animation plays on stage change
- [ ] Accessories render correctly per evolution stage (3D and SVG)
- [ ] Cat abilities unlock at correct stages
- [ ] AbilityEngine applies ability effects to exercise config
- [ ] Cat Gallery: swipe between all 12 cats
- [ ] Locked cats: dim avatar with lock badge
- [ ] Gem purchase flow: buy modal → gem deduction → cat unlocked
- [ ] Chonky Monke: verify legendary unlock conditions
- [ ] Cat mood system: verify mood reflects recent performance
- [ ] Daily reward calendar: claim rewards, verify gem balance

#### 9. 3D Cat Rendering (Device Required)
- [ ] HomeScreen: 3D cat renders with correct colors
- [ ] CompletionModal: pose matches score (celebrate/play/curious)
- [ ] CatSwitchScreen: owned cats render in 3D, locked in SVG
- [ ] Evolution accessories visible at teen/adult/master stages
- [ ] Evolution glow visible at adult/master stages
- [ ] SVG fallback works when forceSVG=true
- [ ] No GL context crashes on low-end devices
- [ ] Performance: single canvas per screen rule respected

#### 10. Firebase Auth & Sync
- [ ] Anonymous sign-in (first launch)
- [ ] Email sign-up + sign-in
- [ ] Google Sign-In (native module required)
- [ ] Apple Sign-In (iOS only, native module required)
- [ ] Account linking (anonymous → email/Google/Apple)
- [ ] Cross-device sync: sign in on second device → data merges ("highest wins")
- [ ] Offline mode: core loop works without network
- [ ] Sync queue: offline changes push when reconnected
- [ ] Auth timeout: verify 8s timeout + local guest fallback
- [ ] Sign out: verify data preserved locally
- [ ] Delete account: verify data removal

#### 11. Social & Leaderboards
- [ ] SocialScreen: renders for authenticated users, gates for anonymous
- [ ] Friend code generation + registration
- [ ] Add friend by code → friend connection established
- [ ] Accept/decline friend requests
- [ ] Activity feed: shows friend milestones
- [ ] Activity feed: posts on level-up and cat evolution
- [ ] League auto-join on sign-in
- [ ] LeaderboardScreen: standings render with correct zones
- [ ] League XP updates atomically (Firestore increment)
- [ ] Friend challenges: create, 48h window, winner/loser rewards
- [ ] ShareCard: generate and share score/streak/evolution cards
- [ ] Notifications: daily reminder fires at correct time
- [ ] Notifications: streak-at-risk reminder when streak endangered
- [ ] Navigation: Social tab replaces Play, Free Play on HomeScreen

#### 12. Sound Design & Haptics (Device Required)
- [ ] SoundManager initializes without crash
- [ ] button_press sound + Light haptic on PressableScale tap
- [ ] Verify all SoundName entries have corresponding .wav files (or no crash for missing)
- [ ] Exercise sounds: note_correct, note_perfect, note_miss
- [ ] Combo sounds: combo_5, combo_10, combo_20, combo_break
- [ ] Reward sounds: star_earn, gem_clink, chest_open, evolution_start
- [ ] Verify sounds don't overlap/clip when fired rapidly
- [ ] Verify haptic feedback matches sound events

#### 13. Navigation & UI Polish
- [ ] All 5 tabs navigate correctly (Home, Learn, Songs, Social, Profile)
- [ ] CustomTabBar: active indicator renders, animations smooth
- [ ] All screen back buttons work (goBack or navigate)
- [ ] Deep link handling (if implemented)
- [ ] Onboarding: 4 steps complete → main tabs
- [ ] LevelMap: nodes match lesson progress (completed/current/locked)
- [ ] LevelMap: auto-scrolls to current node
- [ ] ProfileScreen: all settings toggles work
- [ ] ProfileScreen: input method picker updates settingsStore
- [ ] ExerciseLoadingScreen: shows tips while AI exercises load
- [ ] MusicLibrarySpotlight on HomeScreen: navigates to Songs tab
- [ ] ReviewChallengeCard: appears when skills are decaying

#### 14. Performance Profiling (Device Required)
- [ ] App cold start: <3s to interactive
- [ ] Exercise Player: keyboard touch → sound <20ms (touch input)
- [ ] PianoRoll: 60fps during scrolling (no jank)
- [ ] Memory: no steady growth during 30-min session
- [ ] No memory leaks from exercise re-mounts
- [ ] 3D canvas: <16ms frame time (30fps target)
- [ ] Audio engine: no dropped sounds during rapid note sequences
- [ ] Bundle size: check total JS bundle and asset sizes
- [ ] Firestore reads: verify caching prevents excessive network calls

#### 15. Edge Cases & Error Handling
- [ ] Kill app during exercise → re-open → no crash, clean state
- [ ] Airplane mode: core loop works, sync deferred
- [ ] Switch to background during exercise → pause/resume
- [ ] Low storage: verify graceful degradation
- [ ] Rapid screen transitions (back-forward quickly)
- [ ] Rotate device during exercise (should stay locked)
- [ ] Firebase quota exceeded → error handling (no crash)
- [ ] Gemini API error → offline fallback coaching
- [ ] Malformed exercise JSON → ContentLoader handles gracefully
- [ ] Max combo (100+) → no integer overflow or visual glitch

#### 16. Security
- [ ] Firebase Security Rules: users can only read/write their own data
- [ ] No API keys committed to git (.env.local only)
- [ ] No PII in Gemini AI prompts
- [ ] Audio data processed on-device (never transmitted)
- [ ] Input sanitization on friend codes (6-char restricted alphabet)
- [ ] Rate limiting on song generation requests
- [ ] No SQL injection vectors (Firestore uses typed queries)

#### 17. Accessibility
- [ ] VoiceOver: all interactive elements have accessible labels
- [ ] Dynamic Type: text scales with system font size
- [ ] Color contrast: meets WCAG AA (4.5:1 for text)
- [ ] Reduced Motion: disable animations when system setting enabled
- [ ] Keyboard navigation: Tab order is logical (if applicable)
- [ ] Touch targets: minimum 44x44pt

#### 18. Codebase Health
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run test` → all pass (122 suites, 2630+ tests)
- [ ] `npm run lint` → 0 warnings/errors
- [ ] No `any` types in production code
- [ ] No unused imports or dead code
- [ ] All stores have persistence wired (AsyncStorage)
- [ ] All stores have reset() method for sign-out
- [ ] No console.log in production code (use analytics instead)

### Beta Release
- [ ] App icon designed and exported (1024x1024 + all sizes)
- [ ] App Store screenshots (6.7" and 6.1" iPhone)
- [ ] App Store description and keywords
- [ ] Privacy policy URL (required for App Store)
- [ ] EAS production build (iOS)
- [ ] EAS production build (Android)
- [ ] TestFlight upload + internal testing group (5-10 testers)
- [ ] 5-day beta window for critical bug reports
- [ ] Priority fixes from beta feedback

### Launch
- [ ] Final bug fixes from beta
- [ ] App Store submission (iOS)
- [ ] Play Store submission (Android)
- [ ] Launch monitoring: Crashlytics dashboard, PostHog analytics
- [ ] Post-launch hotfix plan documented
- [ ] Reassess and plan Phase 12+ (monetization, new content)

**Launch is 100% free** — monetization (3-tier freemium) designed post-launch.

---

## Execution Priority

```
[DONE]     Phases 1-10.5 + 3D cats   All complete
[ACTIVE]   Phase 11: QA + Launch     Account deletion, Cloud Functions, CI/CD, MIDI done
                                      Maestro E2E, deep testing, TTS upgrade in progress
```

---

## Timeline (Weeks from Feb 17)

```
WEEK  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
      ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
PH1-9.5                              DONE
PH10-ACH                         ████████████  DONE
PH10.5-SOC                                ████  DONE
3D-CATS                                   ██  DONE
PH11-QA                                    ████████  ← ACTIVE
```

Currently in **Week 2** (Feb 28). All implementation phases complete. Phase 11 QA in progress — account deletion, Cloud Functions, CI/CD, environment audit, and MIDI integration done. Maestro E2E testing and deep audit underway.

---

## Known Technical Constraints

1. **react-native-screens** pinned to 4.4.0 (Fabric codegen bug with RN 0.76)
2. **Native MIDI module**: `@motiz88/react-native-midi` installed, NativeMidiInput rewritten for Web MIDI API — needs dev build for actual hardware
3. **Native audio engine** (react-native-audio-api) requires RN 0.77+. ExpoAudioEngine is primary
4. **Jest worker teardown warning** — timer leak, non-blocking
5. **~45 open GitHub issues** — to be triaged during QA sprint (40 identified in codebase audit: 8 P0, 13 P1, 7 P2, 12 P3)
6. **R3F v8.18.0** pinned (v9 requires React 19 + RN 0.78+)
7. **Sound assets**: SoundManager has procedural synthesis improvements, but dedicated .wav files not yet sourced (~30 sounds needed)
8. **ONNX Basic Pitch model**: Downloaded (`assets/models/basic-pitch.onnx`, 230KB), needs real-device testing
9. **3D cat models**: 4 body types only (not 13 unique per-cat meshes). Color overrides differentiate cats
10. **Cloud Functions**: 4 functions written (deleteUserData, generateExercise, generateSong, generateCoachFeedback) — need Firebase project deployment
11. **Cat voice TTS**: Currently expo-speech; ElevenLabs/OpenAI evaluation planned for higher-quality per-cat voices

---

## 3D Assets Status

### Phase A: Cat Body Models — COMPLETE
- 4 GLB body types: `salsa-cat.glb` (standard), `slim-cat.glb`, `round-cat.glb`, `chonky-cat.glb`
- Created via Blender MCP, stored in `assets/models/`
- R3F v8.18.0 + expo-gl rendering in React Native
- Material color override system (13 cats + Salsa NPC)
- SVG fallback for devices without WebGL

### Phase B: Evolution Accessories — COMPLETE
- Programmatic Three.js geometry (`CatAccessories3D.tsx`)
- 30+ named accessories mapped to geometry primitives
- Per-cat, per-stage accessory rendering from `catCharacters.ts` data
- Evolution glow (pointLight + aura sphere) for adult/master stages

### Phase C: Remaining 3D Assets (STRETCH — post-launch)
- Per-cat mesh variations (currently all use same body type mesh with color overrides)
- Gameplay 3D: note gems, particle textures, chest models
- UI 3D: gem currency model, trophy models per league tier
- Environments: LevelMap tier backgrounds, Auth screen scene
- Bone-rigged skeletal animations (currently idle float only)
- Draco compression for smaller bundles
