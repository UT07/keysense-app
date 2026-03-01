# Purrrfect Keys — Product Requirements Document

**Version:** 3.0
**Last Updated:** February 28, 2026
**Author:** Product Team
**Status:** Phase 11 QA + Launch (Phases 1-10.5 complete)

---

## 1. Product Vision

Purrrfect Keys is the Duolingo of piano — an AI-powered mobile app that teaches anyone to play piano through bite-sized, gamified practice sessions guided by a personal cat coach named Salsa.

**One-liner:** Learn piano with an AI cat teacher who knows your weaknesses, evolves with you, and makes practice feel like a game.

**Core promise:** Open the app → get a personalized 5-minute practice session → feel progress → come back tomorrow.

---

## 2. Target Users

### Primary: Complete Beginners (70%)
- Age 16-35, no piano experience
- Own a smartphone, may or may not own a keyboard
- Motivated by gamification (Duolingo/game players)
- Want to learn piano but find traditional lessons expensive, intimidating, or inconvenient

### Secondary: Lapsed Players (20%)
- Took lessons as a child, quit, want to restart
- Have a keyboard at home gathering dust
- Need motivation and structure more than instruction

### Tertiary: Casual Hobbyists (10%)
- Can play a bit, want to improve specific skills
- Interested in learning specific songs
- Value the free play analysis and drill generation

---

## 3. Core Experience

### 3.1 The Daily Loop

```
Open App → Salsa greets you → "Today's Practice" (5-10 min)
  ├── Warm-up (review decayed skill)
  ├── New material (next skill tree node)
  └── Challenge (slightly above current level)
→ Score + Coaching → XP + Gems → Cat Evolution → Come back tomorrow
```

### 3.2 Salsa — The AI Coach

Salsa is a grey cat with green eyes who serves as the user's personal piano teacher. She is NOT a background service or an afterthought — she IS the app's personality.

**Salsa's role:**
- Greets the user by name on the home screen with context-aware messages
- Picks each practice session and explains WHY ("Your C-D transitions have been shaky lately")
- Coaches during exercises with real-time reactions (bounce on perfect, droop on miss)
- Gives specific, actionable post-exercise feedback ("Beat 3 was 120ms late — try counting out loud")
- Speaks via TTS with her unique voice (pitch/rate tuned for her personality)
- Evolves visually as the user progresses (Baby → Teen → Adult → Master)
- Has personality traits: encouraging but honest, a little sassy, celebrates small wins

**Salsa is always visible:** Home screen (large), exercise player (buddy), completion screen, daily session, profile. She's the face of the app.

### 3.3 Cat Evolution System

Evolution is NOT cosmetic — it reflects the learner's real progress:

| Stage | XP Required | Meaning | Visual Change |
|-------|-------------|---------|---------------|
| Baby | 0 | Just started | Small, simple, big eyes |
| Teen | 500 | Committed learner | Slightly larger, more expressive |
| Adult | 2,000 | Intermediate player | Full-size, confident pose |
| Master | 5,000 | Advanced player | Glowing aura, accessories |

**Evolution reveal:** Full-screen Pokemon-style animation when the cat evolves. This is a major moment — not a toast notification.

**Abilities:** Each evolution stage unlocks a gameplay ability (wider timing window, combo shield, XP multiplier, etc.). These make the game feel easier as the player improves, creating a positive feedback loop.

### 3.4 Gem Economy

| Source | Amount | Frequency |
|--------|--------|-----------|
| First exercise completion | 25 | Once per exercise |
| Score 90%+ | 5 | Per attempt |
| Perfect score (100%) | 15 | Per attempt |
| 7-day streak | 50 | Weekly |
| 30-day streak | 200 | Monthly |
| Daily challenge | 20 | Daily |

**Spending:** Unlock new cats (500-2000 gems). Future: cosmetics, themes.

---

## 4. Feature Requirements

### 4.1 Onboarding (P0)
- [ ] Cat selection: pick 1 of 3 starters (Salsa is default/recommended)
- [ ] Skill assessment: 3-exercise mini-test to calibrate starting point
- [ ] Input method selection: MIDI keyboard / phone mic / on-screen
- [ ] Daily goal setting: 5/10/15/20 minutes

### 4.2 Home Screen (P0)
- [ ] Large Salsa avatar (evolution stage visible) with speech bubble
- [ ] Context-aware greeting from Salsa (time of day, streak status, recent progress)
- [ ] "Start Practice" primary CTA → DailySessionScreen
- [ ] Daily goal progress ring
- [ ] Streak display with flame animation
- [ ] XP/Level display
- [ ] Gem balance
- [ ] Daily challenge card (if not completed)

### 4.3 Exercise Player (P0)
- [x] Vertical piano roll with falling notes
- [x] Dynamic keyboard range per exercise
- [x] Real-time scoring with visual feedback (PERFECT/GOOD/EARLY/LATE/MISS)
- [x] Combo counter
- [x] Salsa as ExerciseBuddy with contextual reactions
- [x] Completion modal with score ring, AI coaching, star rating
- [x] Gem popup on high scores
- [x] Evolution reveal on stage transition
- [ ] Demo mode (watch before playing)
- [ ] Slow-down ability integration

### 4.4 Adaptive Learning (P0)
- [x] 100-node skill tree across 15 tiers
- [x] 4 session types (new-material, review, challenge, mixed)
- [x] Skill decay with 14-day half-life
- [x] AI exercise generation for tiers 7-15
- [x] Weak spot detection and targeted drill generation
- [x] Progressive difficulty adjustment

### 4.5 Free Play (P1)
- [x] Full piano keyboard for free playing
- [x] Key/scale detection (24 major + minor keys)
- [x] Post-play analysis with drill suggestion
- [x] AI drill generation from analysis
- [ ] Floating Salsa with real-time commentary

### 4.6 Cat Collection (P1)
- [x] Collection gallery with all 12 cats
- [x] Per-cat evolution progress bars
- [x] Ability codex per cat
- [x] Gem-based unlocking
- [ ] Cat personality preview before purchase

### 4.7 Social (P2 — Phase 10.5) **COMPLETE**
- [x] Friend list with practice streaks (6-char friend codes, activity feed)
- [x] Weekly leaderboards (opt-in, 4-tier leagues: Bronze/Silver/Gold/Diamond)
- [x] Share score cards (react-native-view-shot + expo-sharing)
- [x] Practice challenges (friend vs friend, 48h window)
- [x] Local notifications (daily reminder, streak-at-risk)

### 4.8 Audio Input (P2 — Phase 8) **COMPLETE**
- [x] Phone microphone input for real piano detection
- [x] Monophonic pitch detection (YIN algorithm, <150ms latency)
- [x] Polyphonic chord detection (ONNX Basic Pitch model)
- [x] Adaptive timing windows per input method (1.5x multiplier for mic)
- [x] Ambient noise calibration flow (RMS-based threshold auto-tune)

### 4.9 Account Management (P0 — Phase 11) **IN PROGRESS**
- [x] Account deletion with GDPR compliance (Cloud Function + client-side fallback)
- [x] Gemini API moved to Cloud Functions (secure server-side API keys)
- [x] CI/CD pipelines (GitHub Actions: test/lint/typecheck + EAS Build)
- [ ] Maestro E2E testing (12 flow YAML files planned)
- [ ] App Store submission preparation

---

## 5. Non-Functional Requirements

### Performance
- Touch → Sound: <20ms
- MIDI → Sound: <15ms
- Screen transitions: <300ms
- Exercise load: <1s
- 60fps during gameplay on iPhone 13+

### Reliability
- Offline-first: core loop works without network
- Graceful degradation: AI coaching falls back to templates
- Local-first data: progress never lost on network failure
- Cross-device sync on re-connect

### Quality
- 0 TypeScript errors at all times
- >90% test coverage on core business logic
- Detox E2E tests for all primary flows
- No crashes in production

---

## 6. Success Metrics

### Engagement (North Star)
- **D1 retention:** >60% (Duolingo benchmark: 55%)
- **D7 retention:** >30%
- **D30 retention:** >15%
- **Daily practice minutes:** avg 8+ min

### Learning
- **Exercises completed per session:** avg 3+
- **Score improvement per exercise:** avg +5% on retry
- **Skill tree progression:** avg 2 nodes/week

### Monetization (Post-Launch)
- **Conversion to premium:** >5% of D7 retained users
- **Gem purchase rate:** >2% of DAU

---

## 7. Current State (Feb 28, 2026)

**Completed:** Phases 1-10.5 (Core Loop, Gamification, Auth, Adaptive Learning, Avatar Evolution, UI Revamp, All-AI Exercises, Audio Input + Polyphonic Detection, Music Library with 124 songs, Arcade Concert Hall, Social & Leaderboards, 3D Cat Integration)
**In Progress:** Phase 11 — QA + Launch (account deletion, Cloud Functions, CI/CD done; Maestro E2E, deep testing underway)
**Codebase:** 122 test suites, 2,630 tests, 0 TypeScript errors
**Content:** 30 static exercises across 6 lessons, AI generation for tiers 7-15, 124 songs in Firestore

**Key milestone:** The app is feature-complete. Phase 11 focuses on quality assurance, security hardening (GDPR-compliant account deletion, server-side API keys via Cloud Functions), and launch preparation. A comprehensive codebase audit identified 40 issues (8 P0, 13 P1, 7 P2, 12 P3) being addressed.

---

## 8. Competitive Landscape

| App | Strengths | Weaknesses | Our Advantage |
|-----|-----------|------------|---------------|
| Simply Piano | Mic detection, song library | Generic, no personality, expensive | AI personalization, cat companions, free |
| Flowkey | Beautiful UI, real songs | No gamification, passive learning | Active gameplay, evolution system |
| Duolingo (model) | Gamification gold standard | Not for piano | We apply their engagement model to piano |
| Piano Marvel | MIDI support, sight-reading | Desktop-focused, dated UI | Mobile-first, modern design |

**Our moat:** The combination of AI-adaptive curriculum + character-driven gamification doesn't exist in piano learning apps today.
