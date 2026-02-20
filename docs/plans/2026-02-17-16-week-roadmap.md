# Purrrfect Keys — 16-Week Development Roadmap

**Created:** February 17, 2026
**Target Launch:** June 8, 2026
**Starting State:** 64 test suites, 1488 tests, 6 lessons (36 exercises), Phases 1-4 complete
**Current State (Feb 20):** 75 test suites, 1,725 tests, Phase 5 complete

---

## Timeline Overview

```
WEEK  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
      ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
PH 5  ████████████              Adaptive Learning Revamp
AUDIO ░░░░░░░░░░░░░░░░░░░░░░████████     R&D → Sole Priority
PH 6           ████████████     Avatar Evolution & Gamification
PH 7                    ████████     Game Feel & Polish
MUSIC ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  Pipeline → UI Integration
PH 9                                  ████████  Social & Leaderboards
PH10                                        ████████  QA + Launch
RIVE  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     (design assets — parallel)
```

### Parallel Tracks
- **Audio R&D** (Weeks 1-8 background, Weeks 9-10 sole priority): Research, prototype, benchmark mic input
- **Music Library Pipeline** (Weeks 1-12 background, Weeks 11-12 UI integration): MIDI → JSON conversion, song sourcing
- **Rive Animation Assets** (Weeks 1-8): Design work in Rive editor, not code

### Monetization
- **Launch/Beta:** All features free — no paywalls, no tiers
- **Post-Launch:** 3-tier freemium model (to be designed after launch feedback)

---

## Phase 5: Adaptive Learning Revamp (Weeks 1-3) -- COMPLETED Feb 20, 2026

**Status:** All 18 tasks (5.1-5.18) across 7 batches DONE. ~150+ new tests (exceeded ~80+ estimate). 75 suites, 1,725 tests total.

**Core Principle:** The AI IS the piano teacher — not a background service. Salsa (cat coach) should feel like a real vocal instructor who knows you personally.

### Week 1 — Curriculum Engine + AI From Day 1

| # | Task | Description | Est |
|---|------|-------------|-----|
| 5.1 | SkillTree data model | Define skill tree: notes → scales → chords → songs → improv. Each node has prerequisites, target exercises, mastery threshold. Pure TS in `src/core/curriculum/` | 3h |
| 5.2 | CurriculumEngine service | AI-powered session planner. Takes LearnerProfile + SkillTree → picks today's exercises (mix of weak spots + new material + variety). Replaces static lesson ordering with dynamic paths | 4h |
| 5.3 | Rewire GeminiExerciseService | Expand from random generation to curriculum-aware. Accept skill tree node context, difficulty curve position, target skills. Generate exercises that teach specific concepts, not just random notes | 3h |
| 5.4 | AI exercise integration from Day 1 | After skill assessment, AI immediately tailors first exercises. Current 6 lessons become "anchor lessons" at milestones. Gap between anchors filled by AI | 4h |
| 5.5 | Daily session screen | New "Today's Practice" screen replacing static lesson list on HomeScreen. Shows AI-picked session: warm-up → lesson/drill → challenge. Explains WHY each exercise was chosen | 4h |
| 5.6 | Tests for Week 1 | CurriculumEngine tests, GeminiExerciseService expanded tests, integration tests | 3h |

### Week 2 — Voice Coaching Pipeline

| # | Task | Description | Est |
|---|------|-------------|-----|
| 5.7 | VoiceCoachingService | Gemini generates coaching text from LearnerProfile + ExerciseScore. System prompt encodes Salsa's personality (sassy, encouraging, SPECIFIC). "Your C-D transition was 120ms late" not "try again" | 4h |
| 5.8 | TTS integration | Expo Speech API as baseline (free, instant). Interface abstraction for future ElevenLabs upgrade. Per-cat voice settings (pitch, rate adjustments) | 3h |
| 5.9 | CompletionModal voice coaching | After exercise: Salsa speaks personalized feedback. Visual speech bubble + audio. Highest-impact touchpoint | 3h |
| 5.10 | Pre-exercise coaching | Brief voice tip before exercise starts: "Focus on your left hand this time" / "This one targets your weak F#" | 2h |
| 5.11 | Coaching text quality | Gemini prompt engineering for teacher-quality output. A/B test prompt variants. Cache coaching for offline replay | 3h |
| 5.12 | Tests for Week 2 | VoiceCoachingService tests, TTS mock tests, CompletionModal integration | 3h |

### Week 3 — Weak Spot Detection + Free Play Analysis

| # | Task | Description | Est |
|---|------|-------------|-----|
| 5.13 | Weak spot drill generator | AI detects struggling patterns (not just weak notes — timing issues, hand transitions, tempo drops). Auto-generates targeted 30-second drills | 4h |
| 5.14 | Progressive difficulty engine | AI gradually increases tempo, adds notes, introduces hand independence based on mastery. No sudden difficulty spikes | 3h |
| 5.15 | FreePlayAnalyzer service | Captures notes played during free play. After user stops (2s silence): analyzes key/scale, identifies patterns, suggests exercises. "Want me to create a drill for that C→B transition?" | 4h |
| 5.16 | Free play coaching UI | Free play mode with floating Salsa. Post-play feedback card with analysis + "Generate drill" CTA | 3h |
| 5.17 | Offline coaching fallback | 50+ pre-generated coaching templates for common scenarios (perfect score, just missed, specific weak areas). Used when Gemini unavailable | 2h |
| 5.18 | Tests + integration | End-to-end: play exercise → get voice feedback → AI picks next exercise → difficulty adjusts. Free play analysis tests | 4h |

### Phase 5 Exit Criteria
- [x] AI picks exercises from Day 1 (no more "finish 6 lessons first")
- [x] Voice coaching speaks after every exercise with specific feedback
- [x] Free play mode with post-play analysis and drill generation
- [x] 365-day content framework operational (skill tree + AI generation)
- [x] ~80+ new tests (actual: ~150+ new tests)

---

## Phase 6: Avatar Evolution & Gamification (Weeks 4-6)

**Core Concept:** Pokemon-style cat evolution with gameplay-relevant abilities. Dual currency: XP (progression/evolution) + Gems (purchasing/unlocking).

### Currency System

| Currency | Earned From | Used For |
|----------|------------|----------|
| **XP** | Completing exercises, daily goals, streaks | Level progression, cat evolution stages |
| **Gems** | High scores (90%+ = 5, 100% = 15), bonus exercises (10), daily challenge (20), streak milestones (7-day = 50, 30-day = 200), achievements (varies) | Unlock locked cats, future cosmetics |

### Cat System

| Concept | How It Works |
|---------|-------------|
| **Onboarding** | User picks 1 of 3 starter cats. Other 2 become LOCKED with gem price shown |
| **Evolution** | Selected cat evolves via XP milestones: Baby (0) → Teen (500) → Adult (2000) → Master (5000 XP) |
| **Unlocking** | Locked starter cats: 500 gems each. Additional rare cats: 1000-2000 gems |
| **Abilities** | Each cat has unique abilities that ENHANCE learning (never bypass it) |

### Week 4 — Evolution Data Model + Gem System

| # | Task | Description | Est |
|---|------|-------------|-----|
| 6.1 | Evolution data model | `CatEvolution` type: 4 stages (baby/teen/adult/master), XP thresholds per stage, visual changes per stage, ability unlocks. Refactor `catCharacters.ts` from 8 flat cats to 3 starters + unlockable cats with evolution chains | 4h |
| 6.2 | Gem currency store | New `gemStore.ts`: gem balance, earn/spend transactions, earning sources with multipliers. Persisted to MMKV | 3h |
| 6.3 | Cat abilities system | 12+ abilities: slow tempo start, extra retries, extended ghost notes, XP multiplier, wider timing window, hint frequency boost, combo shield (1 miss forgiven), practice reminder. Each cat gets unique ability set that deepens with evolution | 4h |
| 6.4 | Evolution store | New `catEvolutionStore.ts`: tracks selected cat, evolution stage, ability levels, evolution XP progress. Compute evolution triggers from XP milestones | 3h |
| 6.5 | Onboarding cat selection | Rework OnboardingScreen: pick 1 of 3 starters. Each shows personality, starter ability, evolution preview. Remaining 2 shown as locked with gem cost. Choice feels meaningful | 4h |
| 6.6 | Wire abilities to ExercisePlayer | Ability effects applied during gameplay: slower starting tempo, extra ghost notes, wider timing windows, combo shield. Must enhance learning, never bypass it | 4h |
| 6.7 | Gem earning integration | Wire gem earning into: exercise scoring (high score bonuses), daily challenges, streak milestones, achievement unlocks. Show gem popup on earn | 3h |
| 6.8 | Tests for Week 4 | Evolution model tests, gem store tests, ability calculation tests | 3h |

### Week 5 — Evolution UI + Collection Screen

| # | Task | Description | Est |
|---|------|-------------|-----|
| 6.9 | Evolution screen | Replace CatSwitchScreen with evolution/collection screen. Shows: current cat with evolution progress bar, next evolution preview (silhouette), ability tree, gem balance | 5h |
| 6.10 | Evolution animation | When cat evolves: dramatic reveal (glow → transform → new form). Reanimated sequence with particles, screen flash, celebration | 4h |
| 6.11 | Gem shop / Cat collection | Gallery showing all cats: owned (with current stage), locked (with gem price + progress bar). Tap to preview full evolution chain + abilities before purchase | 4h |
| 6.12 | Unlock flow | Gem spending confirmation, unlock animation, "New cat!" celebration. Switch to new cat or keep current | 3h |
| 6.13 | ExerciseBuddy evolution | ExerciseBuddy during gameplay reflects current evolution stage. Higher stages have more expressive reactions, unique dialogue | 2h |
| 6.14 | Tests for Week 5 | Evolution screen tests, unlock logic tests, gem transaction tests | 3h |

### Week 6 — Gamification Polish + Achievement Expansion

| # | Task | Description | Est |
|---|------|-------------|-----|
| 6.15 | Achievement expansion | Add evolution-related achievements: "First Evolution", "Max Evolution", "Collect All Cats", "Use ability 50 times", gem milestones. Expand from 32 to 50+ | 3h |
| 6.16 | Daily reward system | Daily login streak rewards: XP bonuses, gems, evolution XP boosts, streak freezes. Calendar UI showing upcoming rewards | 4h |
| 6.17 | Cat personality in coaching | Wire cat personality into Gemini coaching prompts. Each cat gives feedback in their voice (Jazzy = smooth, Chonky = goofy, Luna = mystical) | 3h |
| 6.18 | Ability balancing | Playtest and balance all abilities. Ensure none bypass learning. Tune gem earning rates so unlocks feel achievable but not instant | 3h |
| 6.19 | Integration testing | Full flow: onboard → pick cat → play → earn XP + gems → cat evolves → abilities activate → save gems → unlock new cat | 3h |
| 6.20 | Tests for Week 6 | Achievement tests, daily reward tests, personality coaching tests | 3h |

### Phase 6 Exit Criteria
- [ ] 3 starter cats with 4 evolution stages each
- [ ] 1-of-3 pick during onboarding, other 2 locked
- [ ] Gem currency: earning + spending + balance tracking
- [ ] 12+ abilities wired into gameplay
- [ ] Evolution animations + collection/shop screen
- [ ] 50+ achievements
- [ ] Daily reward system
- [ ] ~80+ new tests

---

## Phase 7: Game Feel & Polish (Weeks 7-8)

### Week 7 — Micro-interactions + Transitions

| # | Task | Description | Est |
|---|------|-------------|-----|
| 7.1 | Screen transitions | Custom animated transitions between screens: slide-up for exercises, cross-fade for navigation, bounce-in for modals | 3h |
| 7.2 | Button animations | PressableScale everywhere, haptic feedback on key presses, satisfying "pop" on correct notes | 2h |
| 7.3 | Progress bar animations | Animated XP bar fill, gem earn animation, level-up celebration sequence, streak flame growth | 3h |
| 7.4 | Pre-level fun fact screen | Animated screen before each exercise: fun music fact + cat reaction + 3-2-1 countdown | 3h |
| 7.5 | Sound design | UI sounds: button taps, correct/wrong note feedback, level up fanfare, achievement chime, evolution reveal, gem collect | 4h |
| 7.6 | Loading states | Skeleton screens for all data-loading states. No blank screens ever | 2h |

### Week 8 — Rive Animations + Final Polish

| # | Task | Description | Est |
|---|------|-------------|-----|
| 7.7 | Rive animation integration | Wire .riv files into RiveCatAvatar. State machine: idle, happy, sad, celebrating, teaching, sleeping. Per-evolution-stage animations | 4h |
| 7.8 | Rive ExerciseBuddy | Upgrade ExerciseBuddy from SVG to Rive. Reactive animations: bounce on perfect, droop on miss, spin on combo | 3h |
| 7.9 | Onboarding overhaul | Smooth animated onboarding: app intro → cat selection (Rive preview) → skill assessment → first AI session | 4h |
| 7.10 | Performance audit | Profile on iPhone 13 Pro: 60fps during gameplay, <2s screen loads, no jank during animations | 3h |
| 7.11 | Accessibility pass | VoiceOver labels, dynamic type support, color contrast check, reduced motion support | 3h |
| 7.12 | Tests for Phase 7 | Animation trigger tests, transition tests, accessibility tests | 3h |

### Phase 7 Exit Criteria
- [ ] Every interaction has animation + haptic feedback
- [ ] Rive avatars replace SVG (with SVG fallback)
- [ ] No blank loading states
- [ ] 60fps during gameplay on target devices
- [ ] ~30+ new tests

---

## Audio Input System (Parallel R&D → Phase 8 Sole Priority)

### Parallel R&D Track (Weeks 1-8, background)

| # | Task | Week | Description |
|---|------|------|-------------|
| A.1 | Research ML models | 1-2 | Evaluate Basic Pitch, SPICE, MT3, Crepe for on-device polyphonic detection. Benchmark model size, accuracy, latency |
| A.2 | Native mic capture prototype | 2-3 | React Native native module for real-time audio capture from phone microphone. Test FFT on raw audio stream |
| A.3 | Monophonic YIN prototype | 3-4 | Implement YIN autocorrelation for single-note detection. Benchmark on iPhone mic with real keyboard |
| A.4 | ML model conversion | 4-6 | Convert best polyphonic model to TFLite/CoreML. Test on-device inference speed |
| A.5 | Latency benchmarking | 6-8 | Measure end-to-end: mic capture → FFT/ML → note detection. Target: <300ms |
| A.6 | Exercise-aware detection | 7-8 | Use expected notes from exercise as prior to improve accuracy (semi-supervised) |

### Input Method Hierarchy

| Method | Polyphonic? | Latency | Default Speed | Timing Window |
|--------|------------|---------|---------------|---------------|
| MIDI keyboard (USB/BT) | Perfect | <15ms | 1.0x | ±50ms |
| Phone mic + keyboard | ML-based | ~200-300ms | 0.75x | ±200ms |
| On-screen keyboard | Tap | Instant | 0.5x | ±100ms |

### Sole Priority Sprint (Weeks 9-10)

| # | Task | Description | Est |
|---|------|-------------|-----|
| 8.1 | PitchDetector native module | Production-ready native module wrapping R&D prototype. iOS (CoreML) + Android (TFLite). Clean interface matching MidiInput API shape | 5h |
| 8.2 | InputMethodSelector | Onboarding + settings: "How will you play?" → MIDI / Piano + mic / On-screen. Auto-detect MIDI connection | 3h |
| 8.3 | Adaptive timing windows | ExerciseValidator adjusts tolerance per input method. MIDI: ±50ms, Mic: ±200ms, On-screen: ±100ms | 3h |
| 8.4 | Default speed per input | MIDI: 1.0x, Mic: 0.75x, On-screen: 0.5x. User can override. Persisted per method | 2h |
| 8.5 | Polyphonic chord detection | Wire ML model for 2-4 simultaneous notes. Test with chord exercises | 4h |
| 8.6 | Mic calibration flow | First-time: "Play middle C" → confirm detection → adjust sensitivity. Noise level detection | 3h |
| 8.7 | Visual mic feedback | Highlight detected notes on keyboard in real-time. Confidence indicator for uncertain detections | 3h |
| 8.8 | Mic → Free Play wiring | Free play mode works with mic input, same analysis pipeline as MIDI | 2h |
| 8.9 | Edge cases + fallbacks | Background noise handling, multiple instruments, distance from mic, bluetooth audio routing | 3h |
| 8.10 | Tests + device testing | Detection accuracy tests, timing window tests, calibration flow tests. Physical device testing | 4h |

### Phase 8 Exit Criteria
- [ ] Monophonic detection: >95% accuracy, <200ms latency
- [ ] Polyphonic detection: >85% accuracy for 2-3 note chords, <300ms
- [ ] Input method selector in onboarding + settings
- [ ] Adaptive timing windows + speed defaults per input type
- [ ] Mic calibration flow
- [ ] Free play works with mic
- [ ] ~40+ new tests

---

## Music Library (Parallel Pipeline → Integration)

### Parallel Content Pipeline (Weeks 1-10, background)

| # | Task | Week | Description |
|---|------|------|-------------|
| M.1 | Song data format | 1-2 | Extend Exercise JSON: layers (melody, leftHand, full), sections (verse/chorus/bridge), difficulty per section, source attribution |
| M.2 | MIDI → Exercise pipeline | 2-4 | Script to convert public domain MIDI → Exercise JSON. Handle tempo, quantization, hand splitting, section detection |
| M.3 | Classical songs (10) | 3-5 | Fur Elise, Ode to Joy, Moonlight Sonata, Canon in D, etc. All public domain |
| M.4 | Pop simplified (8) | 4-6 | Simplified arrangements of recognizable melodies |
| M.5 | Film/TV + Folk + Games (12) | 5-8 | Star Wars, Harry Potter themes (simplified), traditional folk songs, game music |
| M.6 | Quality validation | 8-10 | Play-test all 30+ songs, verify difficulty ratings, fix wrong notes, smooth curves |

### UI Integration Sprint (Weeks 11-12)

| # | Task | Description | Est |
|---|------|-------------|-----|
| M.7 | Browse screen | Genre carousel, song cards with difficulty/duration, search bar, filter by difficulty/genre/hand | 5h |
| M.8 | Song player integration | ExercisePlayer adapted for songs: section markers, loop section, skip to chorus | 4h |
| M.9 | Song mastery system | Per-song mastery tiers (Bronze → Platinum) based on section scores. Visual progress per song | 3h |
| M.10 | AI song coaching | Gemini identifies trouble spots, generates isolated drills for hard measures, tracks section mastery | 3h |
| M.11 | Song-related achievements + gems | "First song mastered", "Genre collector", "Platinum pianist". Gem rewards for song milestones | 2h |
| M.12 | Tests | Song format validation, pipeline tests, browse screen tests, mastery calculation tests | 4h |

### Music Library Exit Criteria
- [ ] 30+ playable songs across 5 genres
- [ ] Browse/search/filter UI
- [ ] Section-based practice with AI coaching
- [ ] Mastery tiers + gem rewards per song
- [ ] ~40+ new tests

---

## Phase 9: Social & Leaderboards (Weeks 11-12)

| # | Task | Description | Est |
|---|------|-------------|-----|
| 9.1 | Friends system | Add friends via code/link. Friends list with last-active status. Activity feed showing friends' milestones | 4h |
| 9.2 | Weekly leagues | Bronze → Silver → Gold → Diamond. 30-person leagues, weekly XP competition. Top 10 promote, bottom 5 demote | 5h |
| 9.3 | Leaderboard UI | League standings with animated rank changes. Your position highlighted. Promotion/demotion at week end | 4h |
| 9.4 | Friend challenges | Challenge a friend to beat your score on an exercise. Notification on challenge received | 3h |
| 9.5 | Share achievements | Share evolution milestones, scores, streaks to social media. Deep link back to app | 3h |
| 9.6 | Firebase backend | Firestore: leagues, friendships, challenges. Cloud Functions for weekly league rotation | 4h |
| 9.7 | Push notifications | FCM: daily reminders, challenges, league status, streak-at-risk, evolution milestone approaching | 3h |
| 9.8 | Tests | Friends system, league calculation, challenge flow, notification trigger tests | 4h |

### Phase 9 Exit Criteria
- [ ] Friend system with activity feed
- [ ] Weekly leagues with promotion/demotion
- [ ] Challenge friends on exercises
- [ ] Push notifications
- [ ] ~35+ new tests

---

## Phase 10: Pre-Launch QA + Launch (Weeks 13-16)

### Week 13-14 — QA Sprint

| # | Test Area | Scope |
|---|-----------|-------|
| 10.1 | AI quality audit | Generate 100 exercises, rate quality. Test coaching feedback on 20+ scenarios. Voice coaching clarity check |
| 10.2 | Mic input testing | Test in 5+ environments (quiet room, noise, distance). Monophonic + polyphonic accuracy benchmarks |
| 10.3 | Performance profiling | Every screen on iPhone 13 Pro + budget Android. <20ms touch-to-sound, 60fps PianoRoll, <2s loads |
| 10.4 | Full 30-day journey | Simulated playthrough: onboarding → lessons → AI → evolution → songs → leagues. Identify progression gaps |
| 10.5 | Gamification balance | XP curve, gem earning rates, evolution milestones, ability power levels. Ensure fair progression |
| 10.6 | Edge cases | Kill mid-exercise, airplane mode, low battery, background/foreground, rapid navigation, account switching |
| 10.7 | Content review | All 36 curated exercises + 30+ songs: verify notes, difficulty curve, descriptions |
| 10.8 | Accessibility | VoiceOver walkthrough, dynamic type, color contrast, reduced motion |
| 10.9 | Security | Firebase rules audit, API key review, input sanitization, auth flow review |
| 10.10 | Demo mode | Test on all lessons + songs. Demo plays correctly, ghost notes work, auto-fade triggers |

### Week 15 — Beta Release

| # | Task | Description |
|---|------|-------------|
| 10.11 | App Store assets | Icon (1024x1024), screenshots (6.7" + 5.5"), description, keywords, privacy policy |
| 10.12 | EAS production builds | iOS + Android. Code signing, provisioning profiles, bundle optimization |
| 10.13 | TestFlight + Internal Testing | 5-10 beta testers, 5-day feedback window |
| 10.14 | Critical bug fixes | Address beta feedback, crash reports, performance issues |

### Week 16 — Launch

| # | Task | Description |
|---|------|-------------|
| 10.15 | Final fixes | Last round of fixes from beta feedback |
| 10.16 | App Store submission | Submit to iOS App Store + Google Play Store |
| 10.17 | Launch monitoring | Crashlytics, analytics dashboard, user feedback pipeline |
| 10.18 | Post-launch hotfix plan | Rapid response process for critical issues |

### Launch Exit Criteria
- [ ] All QA tests passing
- [ ] Beta tester feedback addressed
- [ ] App Store + Play Store approved
- [ ] Monitoring dashboards active
- [ ] All features FREE (no paywalls)

---

## Post-Launch: Monetization (TBD)

- **Not in 16-week scope** — designed after launch feedback
- **3-tier freemium model** — tiers and pricing to be discussed
- **Launch is 100% free** — all features accessible during beta + initial launch

---

## Projected Metrics at Launch

| Metric | Current (Feb 17) | At Launch (Jun 8) |
|--------|-------------------|-------------------|
| Test suites | 64 | ~130+ |
| Total tests | 1,488 | ~3,000+ |
| Curated exercises | 36 | 36 + unlimited AI-generated |
| Songs | 0 | 30+ |
| Achievements | 32 | 50+ |
| Cat characters | 8 (flat, cosmetic) | 3 starters + unlockable, 4 evolution stages, abilities |
| Input methods | MIDI only | MIDI + Mic (polyphonic) + On-screen |
| AI features | Post-lesson coaching | Voice coaching, curriculum engine, free play analysis, song coaching |
| Voice coaching | None | Full TTS with per-cat personality |
| Social | None | Friends, leagues, challenges, push notifications |
| Monetization | N/A | Free (3-tier freemium post-launch) |
| Currencies | XP only | XP + Gems |

---

## Dependencies & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rive animation assets not ready | Phase 7 delayed | SVG fallback already works; Rive is enhancement not blocker |
| Polyphonic ML model too slow on device | Phase 8 degraded | Fall back to monophonic + use exercise context as prior |
| Gemini voice coaching feels robotic | Phase 5 quality | Extensive prompt engineering + ElevenLabs upgrade path |
| Song licensing issues | Phase Music reduced | Stick to public domain only, 30 is achievable |
| Beta feedback reveals major UX issues | Launch delayed | Week 15 buffer for iteration; core UX tested throughout |
