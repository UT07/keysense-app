# Purrrfect Keys Stabilization Report

**Date:** February 2026 (last updated Feb 27)
**Scope:** Codebase stabilization — tests, types, navigation, UI, adaptive learning, gamification, Phase 7 UI revamp, gem bug fix, cat gallery redesign, Phase 9 Music Library, Phase 8 polyphonic completion, Phase 9.5 UX overhaul, Phase 10 Arcade Concert Hall
**Full history:** See `docs/stabilization-report-archive.md` for detailed change narratives.

## Final State

| Metric | Before | After |
|--------|--------|-------|
| Test Suites | 18 (many failing) | ~109 passed |
| Tests | ~393 passing, 40+ failing | ~2,500+ passed, 0 failing |
| TypeScript Errors | 144+ | 0 |
| Skill Nodes | 0 | 100 (15 tiers, DAG-validated) |
| Session Types | 1 (new-material only) | 4 (new-material, review, challenge, mixed) |
| Static Exercises | 5 hardcoded locations | 30 JSON exercises across 6 lessons |
| AI Exercise Generation | None | Tiers 7-15 fully AI-generated via Gemini |
| Navigation Buttons Working | ~30% | 100% |
| App Runs on Simulator | No (build issues) | Yes (iPhone 17 Pro) |
| App Runs on Device | No | Yes (iPhone 13 Pro, Dev Build) |
| Audio Engine | Dropped notes, race conditions | Round-robin voice pools, atomic replay |
| Pause/Resume | Reset exercise on resume | Properly resumes from pause point |
| MIDI Scoring | noteOff double-counted | noteOn only, timestamp normalized |
| Google Sign-In | Missing URL scheme | Working (native module installed) |
| Cross-Device Sync | Upload-only (no pull) | Bidirectional (pull + merge on startup) |
| E2E Tests | None | 15 Detox suites |
| Auth Resilience | Crash on Firebase failure | Local guest fallback for offline/dev |

---

## Changes Summary

### Foundation (Sections 1-4)
- **Test fixes:** Zustand v5 migration, audio/MIDI/scoring mock updates (40+ failures → 0)
- **TypeScript fixes:** Type declarations, Firebase types, 49-file unused import cleanup (144 → 0 errors)
- **Navigation fixes:** Added `useNavigation()` hooks to all screens; buttons use `callback ?? navigate` pattern
- **Build fixes:** app.json config, Expo dependencies, Firebase Functions deps

### Exercise Player (Sections 5-6, 10-15, 22-25)
- **Crash fix:** `mountedRef` lifecycle guard, synchronous interval cleanup
- **Layout redesign:** Vertical stack (PianoRoll + full-width Keyboard) replacing 3-column layout
- **PianoRoll rewrite:** Transform-based scrolling replacing ScrollView (60fps smooth)
- **Scoring fix:** Nearest-note matching with ±1.5 beat window (replaced narrow 0.7-beat window)
- **Timestamp fix:** Epoch→relative conversion before scoring (was comparing trillion-ms vs relative-ms)
- **Dynamic range:** PianoRoll + Keyboard auto-adapt to exercise note range
- **Visual feedback:** PERFECT/GOOD/EARLY/LATE/MISS overlay with combo counter
- **Try Again button:** Context-aware buttons (retry on fail, next on pass)

### Content & State (Sections 7, 16-19, 23, 26, 28)
- **ContentLoader:** Static `require()` registry for 30 exercises and 6 lessons
- **XP/Level fix:** `addXp()` now recalculates level; state hydration recalculates from persisted XP
- **Next exercise navigation:** `navigation.replace('Exercise', { exerciseId })` for seamless flow
- **HomeScreen dynamic data:** Time-aware greeting, actual practice minutes, next uncompleted exercise
- **Lesson completion tracking:** Exercise scores saved to `lessonProgress`
- **Practice time tracking:** `playbackStartTimeRef` → `recordPracticeSession()` on completion
- **Content validation:** All 30 exercises pass MIDI range, sequencing, duration, scoring checks

### Audio (Sections 8-9, 14, 27, 33)
- **Sound pool lifecycle:** Pool-aware release (stop but never unload pooled sounds)
- **Round-robin voice pools:** 2 voices per note, atomic `replayAsync()`, no blocking flags
- **WebAudioEngine:** JSI-based via react-native-audio-api (factory falls back to ExpoAudioEngine)
- **Diagnostics:** Comprehensive init logging, `warmUpAudio()` primer, replay fallback

### UI & Gamification (Sections 20-21, 32, 34-35)
- **ProfileScreen:** Expandable picker chips for daily goal and volume settings
- **LearnScreen:** Smart navigation to first uncompleted exercise
- **Keysie mascot:** SVG cat avatar with 5 moods, per-mood animations, star particles
- **Transitions:** ExerciseCard (quick), LessonCompleteScreen (full celebration), AchievementToast
- **ScoreRing/PressableScale:** Reusable animated components

### Bug Fixes (Section 29, 36)
- **MIDI noteOff double-counting:** Filter to noteOn only
- **Pause resets exercise:** Save/restore elapsed time via `pauseElapsedRef`
- **Stale playedNotes:** `playedNotesRef` (useRef) for synchronous reads
- **MIDI timestamp normalization:** `Date.now()` override for consistent time domain
- **Streak logic:** Delegated to `XpSystem.recordPracticeSession()`
- **Auth resilience:** Local guest fallback, 8s timeout on `initAuth()`

### Infrastructure (Sections 30-31, 37-39)
- **Dev Build:** expo-dev-client on iPhone 13 Pro
- **MIDI testing:** Documentation, VMPK + IAC Driver setup, simulation API
- **Google Sign-In:** Native rebuild with correct CFBundleURLTypes
- **Cross-device sync:** `pullRemoteProgress()` with "highest wins" merge
- **Detox E2E:** 15 suites (896 lines) covering all screens and flows

### Phase 5: Adaptive Learning Revamp (Section 40)
- **SkillTree:** DAG of 100 skill nodes across 15 tiers with 12 categories
- **CurriculumEngine:** AI session planner with 4 session types (new-material, review, challenge, mixed)
- **Skill decay:** 14-day half-life, 0.5 threshold, multi-session mastery (requiredCompletions)
- **AI exercise generation:** Skill-aware Gemini generation; tiers 7-15 are fully AI-generated
- **DailySessionScreen:** "Today's Practice" with warm-up/lesson/challenge + session type badge
- **Voice coaching:** VoiceCoachingService + TTSService (expo-speech) + per-cat voice configs
- **Offline coaching:** 50+ pre-generated coaching strings for Gemini fallback
- **WeakSpotDetector:** Pattern-based detection (note/transition/timing/hand weaknesses)
- **DifficultyEngine:** Progressive difficulty adjustment (5 BPM per mastered exercise)
- **FreePlayAnalyzer:** Key/scale detection + drill generation from free play sessions

### Phase 6: Avatar Evolution & Gamification
- **Cat Evolution:** 4-stage evolution model (Baby/Teen/Adult/Master), XP thresholds, per-cat tracking
- **Gem Currency:** gemStore with balance, earn/spend, multipliers; earning wired to exercise scoring
- **Cat Abilities:** 12 abilities via AbilityEngine, wired to ExercisePlayer config
- **CatCollectionScreen:** Gallery with evolution progress bars, ability codex, gem-based unlocking
- **EvolutionReveal:** Full-screen Pokemon-style animation on stage transitions
- **GemEarnPopup:** Gem reward animation
- **Onboarding:** Cat selection (1 of 3 starters)

### Phase 6.5: AI Coach Fix + Wiring + FreePlay Fix (Feb 21)
- **AI Coach Pipeline (10 bugs):**
  - Fixed `pitchErrors` extraction (was always `[]` due to impossible triple-negation filter)
  - Fixed `missedCount`/`extraCount` derivation from score details (were undefined)
  - `ExerciseValidator.scoreExercise()` now populates `missedNotes`, `extraNotes`, `perfectNotes`, `goodNotes`, `okNotes`
  - `GeminiCoach` cache TTL reduced from 24h → 2h for response variety
  - `hashIssues` now includes actual error content (beat positions, offsets) — was zero-entropy
  - Gemini temperature increased from 0.7 → 0.85
  - `CompletionModal` passes real `recentScores` from progress store (was hardcoded `[]`)
  - `CompletionModal` passes real `sessionMinutes` from exercise timer
  - Offline coaching templates expanded from ~6 to ~15 per category
  - Fallback `'pitch'` branch is now live (pitchErrors populated)
- **FreePlayAnalyzer Key Detection:**
  - Expanded from 5 hardcoded scales to all 24 major + 24 minor keys
  - Added tonic weighting (first/last notes get +2 weight)
  - Added root bonus and out-of-scale penalty for better discrimination
  - `suggestDrill()` now derives tempo, difficulty, noteCount from session analysis
- **Gamification Wiring:**
  - `EvolutionReveal` wired into ExercisePlayer (detects stage change before/after XP)
  - Gem stats row added to CompletionModal
  - `evolutionStage` prop passed to CatAvatar on HomeScreen, ProfileScreen, CatCollectionScreen, CompletionModal
- **Tests:** 84 suites, 1,991 tests, 0 failures

### Phase 7: UI Revamp + Game Feel & Polish (Batches 1-6)

#### Batch 1: Design System Foundation
- **Warm color palette:** Replaced cold blacks with warm dark purples (background #0D0D0D → #0E0B1A, surface #1A1A1A → #1A1628, etc.)
- **Typography scale:** TYPOGRAPHY object with display/heading/body/caption/button/special presets
- **Shadow system:** SHADOWS sm/md/lg with iOS/Android platform handling + `shadowGlow()` function
- **Animation timing:** Duration tokens (instant/fast/normal/slow), spring presets (snappy/bouncy/gentle), stagger delays
- **Gradients:** heroGlow (3-stop), cardWarm, plus existing purple/gold/success/crimson/header/gem/evolution
- **Glow utilities:** GLOW object + `glowColor()` helper function

#### Batch 2: Bug Fixes
- **Chonky Monke unlock bug:** Added `validateOwnedCats()` to hydration — legendary cats stripped if unlock conditions not met
- **CatAvatar mood:** Now accepts `mood` prop (was hardcoded to 'encouraging')
- **MascotBubble:** Now accepts optional `catId` prop to render user's selected cat

#### Batch 3: Cat Avatar Architecture Overhaul
- **Composable SVG parts:** CatParts.tsx with CatBody (4 shapes), CatHead, CatEars (3 variants), CatEyes (4 variants), CatMouth, CatTail (3 variants), CatWhiskers, CatNose
- **Per-cat profiles:** catProfiles.ts maps each cat ID to unique body/ears/eyes/tail/cheekFluff/blush combination
- **Accessories:** CatAccessories.tsx renders evolution-stage accessories (BowTie, Sunglasses, Fedora, Crown, Cape, Monocle)
- **KeysieSvg rewrite:** Composable renderer using profiles + parts, backward compatible

#### Batch 4: Cat Animations (Reanimated Poses)
- **Pose system:** catAnimations.ts with idle/celebrate/teach/sleep/play/curious/sad poses
- **Animated CatAvatar:** useAnimatedStyle on individual SVG groups for pose-specific transforms
- **ExerciseBuddy mapping:** Reactions → poses (perfect→celebrate, good→curious, miss→sad, combo→play)

#### Batch 5: Salsa's Central Presence
- **SalsaCoach component:** Dedicated NPC coach (grey cat, green eyes), larger default size, teaching pose, catchphrase bubble
- **HomeScreen hero:** Salsa at center with greeting speech bubble, user's cat at smaller size with name badge
- **Screen coverage:** Salsa added to DailySessionScreen, LevelMapScreen, PlayScreen, AuthScreen

#### Batch 6: High-Impact Screen Redesigns
- **HomeScreen:** All hardcoded hex → COLORS tokens, TYPOGRAPHY scale, SHADOWS.md on cards, GRADIENTS.heroGlow on hero
- **CompletionModal:** Larger CatAvatar, mood-based scoring, score ring with glow, golden stars, warm card backgrounds
- **DailySessionScreen:** Token-based section colors, typography scale, warm exercise cards, removed debug orange border
- **ProfileScreen:** Cat avatar with evolution badge, stats grid with shadow cards, styled settings list

#### Cat Character Updates
- **Salsa visuals fixed:** bodyColor #FF8A65 → #7A7A8A (grey), eyeColor #FFD740 → #2ECC71 (green), pattern spotted → solid
- **Vinyl → Ballymakawww:** Irish folk cat, tabby pattern, ginger-and-white, full personality + dialogue
- **Noodle → Shibu:** Japanese Bobtail, zen personality, siamese pattern, calming dialogue
- **Pixel → Bella:** White Persian, regal personality, solid white, sophisticated dialogue
- **All 12 cats now have unique SVG profiles:** Each with distinct body shape, eyes, ears, tail, blush
- **Dialogue:** All cats now have personality-specific dialogue for 14 trigger types

#### Exercise Loading Screen
- **ExerciseLoadingScreen:** Full-screen interstitial overlay shown while AI exercises load
- **Loading tips:** 20 practice tips Salsa "says" during loading (posture, technique, rhythm, motivation)
- **Minimum display time:** 2-second minimum ensures smooth transition even for fast loads
- **Custom Tab Bar:** Built in src/navigation/CustomTabBar.tsx with animated icons and active indicators

- **Tests:** 88 suites, 2,064 tests, 0 failures

### Gem Bug Fix + Cat Gallery Redesign (Feb 23)

#### Gem Redemption Bug Fix (Workstream 1)
- **Root cause:** Race condition between `completeDailyChallenge()` and `claimDailyReward()` — 500ms debounced save could lose `lastDailyChallengeDate` before HomeScreen reads it
- **`createImmediateSave`:** New persistence utility in `persistence.ts` — same API as `createDebouncedSave` but with 0ms delay for critical state
- **`completeDailyChallenge()` fix:** Now uses `immediateSave(get())` instead of `debouncedSave(get())` ensuring `lastDailyChallengeDate` persists before user leaves ExercisePlayer
- **`completeDailyChallengeAndClaim()`:** New combined action that marks challenge complete + auto-claims today's reward in one atomic operation, removing friction of finding the DailyRewardCalendar cell manually
- **Claim failure toast:** HomeScreen shows "Complete today's challenge first!" when manual claim fails (auto-dismiss 2.5s)
- **DailyChallengeCard reward display:** Shows "+X gems claimed!" when reward has been collected (instead of just "Completed!")

#### Cat Gallery Redesign (Workstream 2)
- **Unified gallery:** Merged `CatSwitchScreen` + `CatCollectionScreen` into single swipeable gallery (`CatSwitchScreen.tsx`)
- **Card layout:** 88% screen width (up from 78%) — large KeysieSvg avatar (140px), evolution stage badge, name/personality, music skill, evolution progress bar (XP to next stage), 4 ability icons, action button
- **Ability display:** `AbilityIconRow` with stage-based lock badges; tappable to expand inline `AbilityDetail` (name + description + unlock stage)
- **Buy flow modal:** Styled `BuyModal` replacing `Alert.alert` — shows cat preview, gem cost, balance, confirm/cancel with haptic feedback
- **Action button states:** "Select" (owned), "Selected" (current), "Unlock for X gems" (purchasable), "Legendary" (Chonky Monké)
- **Navigation consolidation:** `CatCollection` route now renders `CatSwitchScreen`; `CatCollectionScreen.tsx` deprecated
- **Gem balance header:** Shows current gem count in gallery header

- **Tests:** 90 suites, 2,135 tests, 0 failures

### Cat Gallery Sneak Peek, Enhanced Challenges, Tier Reorder (Feb 23)

#### Cat Gallery Sneak Peek
- **Locked cats now show actual avatar:** Replaced blank lock circle with dimmed (opacity 0.4) KeysieSvg + lock badge overlay
- Users can now see what each locked cat looks like before purchasing

#### Tier Reordering
- **Songs moved from tier 6 to tier 10:** Songs at tier 6 was too early since Music Library is planned. Black Keys and theory content now come first.
- **New tier order:** 1-Note Finding, 2-Right Hand, 3-Left Hand, 4-Both Hands, 5-Scales, 6-Black Keys, 7-G&F Major, 8-Minor Keys, 9-Chords, 10-Songs, 11-Rhythm, 12-Arpeggios, 13-Expression, 14-Sight Reading, 15-Performance
- Updated SkillTree.ts (40+ nodes reordered), LevelMapScreen TIER_META/TIER_CAT_COMPANIONS, TierIntroScreen TIER_META/MASCOT_MESSAGES
- DAG validation: all 31 SkillTree tests pass (no circular deps, all prereqs point to lower tiers)

#### Enhanced Challenge System
- **New file: `src/core/challenges/challengeSystem.ts`** — Pure TypeScript challenge engine
  - 7 daily challenge types: any-exercise, specific-category, score-threshold, combo-streak, speed-run, perfect-notes, practice-minutes
  - Deterministic date-hash selection: ~40% category-specific, ~60% template-based
  - Weekly bonus challenge: one random day per week, harder thresholds (90% score, 10-note combo), 50 gems + 3x XP
  - Monthly challenge: one random day per month, 3-5 exercises in 48h window, 150 gems + 3x XP
  - All generators are deterministic from date strings (no randomness)
- **DailyChallengeCard updated:** Now shows specific challenge label, icon, description, and gem reward (was generic motivational text)
- **New components:** WeeklyChallengeCard (gold/crimson, crown icon, only visible on challenge day), MonthlyChallengeCard (purple, progress bar, 48h countdown)
- **HomeScreen wiring:** Weekly + monthly cards render below daily challenge (auto-hide when not active)
- **progressStore updated:** `recordExerciseCompletion` now accepts optional `ExerciseChallengeContext` for challenge validation (score, maxCombo, perfectNotes, playbackSpeed, category, minutesPracticedToday)
- **ExercisePlayer updated:** Constructs challenge context from score details (computes maxCombo from consecutive correct notes, looks up SkillTree category)
- **23 new tests** for challengeSystem (determinism, variety, all validation types)

- **Tests:** 94 suites, 2,243 tests, 0 failures

### Phase 8: Audio Input — Mic Pipeline (Feb 23)

#### Batch 8A: Core Pitch Detection
- **YINPitchDetector (PitchDetector.ts):** Pure TS YIN algorithm with pre-allocated buffers, parabolic interpolation, configurable frequency range (50-2000Hz)
- **NoteTracker:** Hysteresis layer — 40ms onset hold, 80ms release hold prevents rapid note flickering
- **AudioCapture (AudioCapture.ts):** react-native-audio-api AudioRecorder wrapper with buffer streaming callbacks
- **MicrophoneInput (MicrophoneInput.ts):** Composes AudioCapture + YINPitchDetector + NoteTracker → MidiNoteEvent (same interface as MIDI)
- **pitchUtils (src/core/music/pitchUtils.ts):** frequencyToNearestMidi, frequencyCentsOffset

#### Batch 8B: InputManager & Exercise Integration
- **InputManager (src/input/InputManager.ts):** Unified input factory — auto-detects MIDI > Mic > Touch, runtime method switching
- **Timing compensation:** Per-method latency: MIDI=0ms, Touch=20ms, Mic=100ms. Mic gets 1.5x timing tolerance multiplier
- **useExercisePlayback:** Fully integrated with InputManager — initializes preferred input, subscribes to events, compensates latency in scoring
- **settingsStore:** Added `preferredInputMethod` ('auto'|'midi'|'mic'|'touch') + `setPreferredInputMethod()`

#### Batch 8C: MicSetupScreen & Settings
- **MicSetupScreen:** Permission wizard (intro → requesting → granted/denied), privacy assurance, tip card
- **ProfileScreen:** Input method selector in settings section

#### Batch 8D: Onboarding & Free Play Integration
- **Onboarding Step 3 redesigned:** "How Will You Play?" with 3 options (MIDI / Microphone / On-Screen Keyboard), replaces old binary MIDI Yes/No
- **Post-onboarding mic setup:** Users who choose mic are navigated to MicSetupScreen after onboarding completes
- **PlayScreen (Free Play):** InputManager wired for mic/MIDI input alongside touch keyboard. Active input badge shows current method. Instructions adapt to input method.
- **Playback speed defaults:** MIDI=1.0x, Mic=0.75x, Touch=0.5x

- **Tests:** 94 suites, 2,243 tests, 0 failures

### Phase 9: Music Library (Feb 24)

#### Code (11 Batches — merged to master)
- **Song types + ABC parser:** `songTypes.ts`, `abcParser.ts` (via `abcjs`), `songMastery.ts`
- **Firestore service:** `songService.ts` — songs collection CRUD + per-user mastery subcollection + rate limiting
- **Gemini generation:** `songGenerationService.ts` → extracted pure functions to `songAssembler.ts` for Node.js script reuse
- **Song store:** `songStore.ts` — Zustand with persistence, filters, pagination cursor, loading/generation states
- **Browse UI:** `SongLibraryScreen.tsx` — genre carousel, 400ms debounced search, difficulty filter, song cards, request FAB
- **Playback UI:** `SongPlayerScreen.tsx` — section pills, layer toggle (melody/full), loop, `sectionToExercise()` → ExercisePlayer
- **Navigation:** Songs tab (5 tabs: Home, Learn, Songs, Play, Profile), SongPlayer stack route
- **6 achievements:** first-song-mastered, genre-explorer, classical-connoisseur, platinum-pianist, song-collector, melody-master
- **Mastery tiers:** none → bronze (70+/melody) → silver (80+/melody) → gold (90+/full) → platinum (95+/full)
- **Gem rewards on tier upgrade:** bronze=10, silver=20, gold=40, platinum=75

#### Content Import (124 songs uploaded to Firestore)
- **songAssembler.ts extraction:** Pure functions (buildSongPrompt, validateGeneratedSong, assembleSong) extracted from songGenerationService to `src/core/songs/songAssembler.ts` — enables Node.js scripts without Firebase/React Native deps
- **generate-songs.ts refactor:** Standalone Gemini 2.0 Flash API calls (no Firebase), resume support, JSON output, 50 curated songs → 37 successful
- **import-thesession.ts rewrite:** Two-step API (search → individual tune detail), constructs ABC headers from metadata, 50 folk tunes (20 reels + 15 waltzes + 15 jigs)
- **PDMX conversion (Python + music21):** Curated selection of 38 iconic classical pieces — 12 Beethoven (Op.18, Razumovsky, Harp Quartet, Große Fuge), 13 Mozart (K.545 Piano Sonata, The Hunt Quartet, K.155, K.156, K.80), 5 Haydn, 5 Bach chorales, Handel, Joplin, Chopin
- **upload-songs-to-firestore.ts:** Batch upload via Firebase client SDK, skip-existing, dry-run support
- **Final catalogue:** 124 songs (37 Gemini AI + 50 TheSession folk + 38 PDMX classical) across 6 genres (55 folk, 47 classical, 10 film, 7 game, 6 holiday)

- **Tests:** 103 suites, 2,413 tests (102 passing, 4 pre-existing failures in catEvolutionStore)

### Phase 8 Completion: Polyphonic Detection + Polish (Feb 26)

#### Polyphonic Detection Pipeline
- **PolyphonicDetector (src/input/PolyphonicDetector.ts):** ONNX Runtime wrapper for Spotify Basic Pitch model — resamples 44.1kHz→22.05kHz, runs inference on 88 note bins (A0-C8), extracts DetectedNote[] with confidence + onset flags, configurable thresholds (note=0.5, onset=0.5), max polyphony limit (default 6), pre-allocated resampling buffer
- **MultiNoteTracker (src/input/MultiNoteTracker.ts):** Per-note hysteresis for polyphonic input — 30ms onset hold, 60ms release hold, tracks Map<midiNote, {startTime, lastSeen}>, emits same NoteEvent interface as monophonic NoteTracker
- **AmbientNoiseCalibrator (src/input/AmbientNoiseCalibrator.ts):** Records ambient audio, computes RMS energy, auto-tunes YIN threshold (0.15-0.30), confidence (0.5-0.8), and ONNX note threshold (0.3-0.6) based on noise level

#### Integration
- **MicrophoneInput:** Now supports `mode: 'monophonic' | 'polyphonic'` — polyphonic uses PolyphonicDetector + MultiNoteTracker; falls back to YIN if ONNX fails
- **InputManager:** Reads `micDetectionMode` from settingsStore, passes to MicrophoneInput, adjusts latency compensation (100ms mono / 120ms poly)
- **settingsStore:** Added `micDetectionMode: 'monophonic' | 'polyphonic'` with setter
- **ProfileScreen:** Mic Detection picker (Single Notes / Chords) shown when input method is mic or auto

#### Infrastructure
- **onnxruntime-react-native:** Added as dependency (^1.17)
- **Metro config:** Added `.onnx` to asset extensions
- **Model docs:** assets/models/README.md with download instructions

- **Tests:** 106 suites, 2,441 tests, 0 failures, 0 TypeScript errors

### Phase 9.5: UX Overhaul (Feb 27)

#### Assessment Skill Seeding Fix
- **`getSkillsToSeedForLesson()`:** Now collects ALL prerequisite skills for the determined start lesson and all prior lessons (was only seeding 3 basic skills — `find-middle-c`, `keyboard-geography`, `white-keys` — regardless of placement at lesson-03 or higher)
- **LESSON_PREREQS map:** Explicit prerequisite chains for lessons 1-6, ensuring LevelMap shows correct tier progress after assessment

#### Challenge → AI Exercise Wiring
- **DailyChallengeCard "Play Now":** Now navigates to ExercisePlayer with `aiMode: true` and a challenge-category-mapped skill ID (was navigating to Learn tab with no exercise context)
- **Category mapping:** Challenge categories (e.g., `specific-category: 'scales'`) mapped to corresponding SkillTree skill IDs for targeted AI exercise generation

#### Mastery Tests for All 15 Tiers
- **Tiers 1-6:** Use existing static test exercises from JSON content
- **Tiers 7-15:** Use AI-generated tests via expanded `templateExercises.ts` with tier-specific skill mapping
- **`templateExercises.ts` expanded:** Added tier-to-skill mapping functions, enabling mastery test generation for all 15 tiers including AI-generated tiers

#### HomeScreen Redesign (Feed-Style Layout)
- **MusicLibrarySpotlight card:** Most prominent element after hero — gradient background, song count (124), genre count (6), featured song with play button, "Browse Library" CTA navigating to Songs tab
- **Continue Learning moved up:** Now immediately below Music Library spotlight (was buried below Salsa coach and daily rewards)
- **ReviewChallengeCard:** Conditional card shown when skills are decaying (14+ days unpracticed) — shows count badge and "Start Review" navigation
- **Quick Actions updated:** "Practice" replaced with "Songs" (music note icon, navigates to Songs tab) to drive Music Library engagement
- **Weekly/Monthly challenge cards removed:** Folded into daily challenge to reduce HomeScreen clutter

#### New Components
- **`MusicLibrarySpotlight.tsx`:** Gradient card with song/genre stats, featured song row (daily rotation), difficulty dots, Browse Library button
- **`ReviewChallengeCard.tsx`:** Warning-styled card with refresh icon, decay count badge, skill names, chevron CTA — returns null when no skills are decaying

- **Tests:** ~109 suites, ~2,500+ tests, 0 failures, 0 TypeScript errors

### Phase 10: Arcade Concert Hall (Feb 27)

#### Foundation (Batches 1-2)
- **SoundManager:** Singleton service with `SoundName` type union (20+ sounds), expo-av sound pools, `useSoundManager` hook, haptic mapping per sound, `HAPTIC_MAP` for fallback. Wired into PressableScale for button_press haptic.
- **Design Tokens:** `RARITY` system (common/rare/epic/legendary border+glow colors), `COMBO_TIERS` (fire/skull/crown thresholds+colors), `ANIMATION_CONFIG` for consistent timing
- **GameCard:** Rarity-bordered card component with subtle glow, used across HomeScreen, DailySessionScreen, and future screens

#### ExercisePlayer Combo Escalation (Batch 3)
- **ComboMeter:** Combo count display with tier escalation (fire at 5x, skull at 15x, crown at 25x), pulsing scale animation on milestone hits
- **ComboGlow:** Full-screen animated border overlay (Reanimated), color synced to combo tier, opacity pulse matching combo rhythm
- **Keyboard depth:** 3D-style key press animation with subtle shadow and glow on active keys

#### CompletionModal Loot Reveal (Batch 4)
- **RewardChest system:** `getChestType(stars, isFirstCompletion)` → common/rare/epic/legendary, `getChestReward(chestType)` → gem amount with randomized range per tier
- **Timed reveal:** 10-phase animation sequence (0-6.5s): dim→title→score→stars→record→chest→gems→xp→cat→actions. Each section guarded by `phaseReached()`. `skipAnimation` prop for tests.
- **Sound integration:** `exercise_complete` at title, `star_earn` per star, `gem_clink` at gems, `chest_open` for chest

#### Screen Redesigns (Batches 5-9)
- **HomeScreen:** Sections wrapped with GameCard (rare/epic/common rarity), pulsing Continue Learning CTA, shaking Daily Challenge
- **AuthScreen:** Larger Salsa (2x), shimmer app name, "Learn piano. Grow cats." tagline, 6 floating musical notes, FadeInUp/FadeInDown
- **LevelMapScreen:** 15 unique `TIER_THEMES` with per-tier nodeColor/pathColor/backgroundGradient, tier zone labels
- **DailySessionScreen:** Exercise cards wrapped with GameCard by section type (warmup=common, lesson=rare, challenge=epic), FadeInUp stagger
- **SongLibraryScreen:** Metallic mastery badges (bronze/silver/gold/platinum), pulsing "NEW" badge, difficulty star crystals with per-level colors
- **CatSwitchScreen:** Rarity-colored borders (common=grey starters, rare=blue purchasable, legendary=gold animated shimmer), 4 evolution stage dots
- **ProfileScreen:** Shield-style stat badges with icon watermarks and colored glow, achievement shimmer pulse, animated streak flame (orange→red), larger cat avatar with halo glow

#### PlayScreen Song Mode (Bug Fix)
- **Song note visualization:** When a song reference is loaded, PlayScreen switches to portrait mode with a horizontal piano roll (notes going left-to-right) above the keyboard. Color-coded note blocks by pitch, beat grid lines, note labels. Section pills for multi-section songs. Keyboard auto-zoomed to song note range.

#### Daily Reward Expiry Fix
- **No retroactive claiming:** Changed `claimDailyReward()` guard from `day > actualDay` to `day !== actualDay` — only today's reward is claimable, past days expire at midnight. UI updated to show X icon for missed days.

- **Tests:** 116 suites, 2,548 tests, 0 failures, 0 TypeScript errors

---

## Known Remaining Items

1. **Worker teardown warning**: Jest reports "worker process has failed to exit gracefully" (timer leak, non-blocking)
2. **Native audio engine**: ExpoAudioEngine primary; react-native-audio-api requires RN 0.77+ for codegen
3. **Native MIDI module**: `react-native-midi` not installed yet (needs RN 0.77+). VMPK + IAC Driver ready
4. **Open bugs on GitHub**: ~45 remaining open issues
5. **Rive animation files**: .riv files not created (need Rive editor design work) — SVG composable system is working alternative
6. **Phase 8 remaining**: Real-device testing (mic accuracy >95%, ONNX model loading on device, ambient calibration UX), Basic Pitch ONNX model download
7. **Sound assets**: SoundManager skeleton in place but actual .wav files not yet sourced (30+ sounds needed)
8. **3D cat infrastructure**: Deferred (expo-gl + three.js could break RN 0.76 build, no Blender models yet)
9. **Phase 11+**: Social & Leaderboards, QA + Launch
