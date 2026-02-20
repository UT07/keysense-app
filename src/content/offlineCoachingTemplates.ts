/**
 * Offline Coaching Templates
 *
 * 50+ pre-generated coaching strings for use when Gemini is unavailable.
 * Keyed by scenario: score range, attempt number, and issue type.
 */

// ============================================================================
// Template Categories
// ============================================================================

const PERFECT_SCORE = [
  "Wow, that was flawless! You've totally mastered this one.",
  "Perfect score! Your fingers are really dancing today.",
  "That was incredible! You nailed every single note.",
  "Absolutely perfect! Ready for something more challenging?",
  "You crushed it! Every note, every beat, right on point.",
  "Amazing work! Time to level up to something harder.",
];

const HIGH_SCORE = [
  "Really strong performance! Just a tiny bit more practice and it'll be perfect.",
  "That was great! Your timing is getting really solid.",
  "So close to perfect! Focus on those last few tricky notes.",
  "Excellent work! You're really getting the feel for this piece.",
  "Almost there! A couple more tries and you'll have it down.",
  "Beautiful playing! Just clean up those last few spots.",
];

const GOOD_SCORE = [
  "Good progress! Keep practicing and you'll see those scores climb.",
  "You're getting the hang of it! Focus on the tricky parts.",
  "Nice work! Try slowing down on the harder sections.",
  "You're making real progress! Every attempt gets you closer.",
  "That's coming along well! Practice the challenging bits separately.",
  "Good effort! Try playing it slower first, then build up speed.",
];

const STRUGGLING = [
  "Don't worry, everyone starts here. Take it one measure at a time.",
  "This is a tough one! Try practicing just the first few notes.",
  "Keep going! Learning piano is all about patient practice.",
  "Break it into smaller chunks. Master each part, then put it together.",
  "It's okay to struggle — that's how learning happens. You've got this!",
  "Try listening to the demo first, then play along very slowly.",
];

const FIRST_ATTEMPT = [
  "Great first try! Now you know what to expect.",
  "Good start! The first attempt is always the hardest.",
  "Nice first run! You'll improve a lot on the second try.",
  "Not bad for a first go! Now you know the tricky parts.",
];

const RETURNING_AFTER_BREAK = [
  "Welcome back! Let's ease back in with some practice.",
  "Good to see you again! Your muscle memory will kick in soon.",
  "You're back! A little warm-up and you'll be right where you left off.",
];

const TIMING_ISSUES = [
  "Try counting along with the beat — '1-2-3-4' out loud helps a lot.",
  "Your notes are right, just work on the timing. Tap your foot to keep steady.",
  "Focus on the metronome clicks. Each note should land right on a beat.",
  "The rhythm is the tricky part here. Try clapping the pattern before playing.",
  "Slow it down and focus on staying with the beat. Speed comes later.",
  "Listen to the count-in carefully and keep that tempo in your head.",
  "Try playing with a metronome at half speed first.",
  "Great note accuracy! Now let's get the timing locked in.",
];

const PITCH_ISSUES = [
  "Watch the highlighted keys carefully — they show you what's coming next.",
  "Some wrong notes there. Try playing the tricky section very slowly.",
  "Focus on reading the notes one at a time. No rush!",
  "Double-check your hand position — make sure your thumb is on the right key.",
  "Take a moment to look at which keys light up before you press them.",
  "Try the demo mode to see which keys to press, then try it yourself.",
  "A few wrong notes, but your rhythm was solid! Focus on accuracy this time.",
  "Keep your eyes on the piano roll — it shows you exactly what's coming.",
];

const GENERAL_ENCOURAGEMENT = [
  "Every practice session makes you better, even when it doesn't feel like it.",
  "Piano takes patience. You're building skills that will last a lifetime.",
  "Remember: even professional pianists practiced these basics once.",
  "You're further along than you think! Compare this to your first ever try.",
  "Progress isn't always visible day-to-day, but it adds up fast.",
  "The fact that you're practicing is what matters most. Keep it up!",
];

// ============================================================================
// Template Selector
// ============================================================================

function pickRandom(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Get an appropriate offline coaching text based on score context.
 */
export function getOfflineCoachingText(
  overallScore: number,
  _isPassed: boolean,
  attemptNumber: number,
  mainIssue: 'timing' | 'pitch' | 'general' = 'general'
): string {
  // First attempt gets special treatment
  if (attemptNumber <= 1 && overallScore < 90) {
    return pickRandom(FIRST_ATTEMPT);
  }

  // Perfect score
  if (overallScore >= 95) {
    return pickRandom(PERFECT_SCORE);
  }

  // High score
  if (overallScore >= 80) {
    return pickRandom(HIGH_SCORE);
  }

  // Good score with specific issue
  if (overallScore >= 60) {
    if (mainIssue === 'timing') return pickRandom(TIMING_ISSUES);
    if (mainIssue === 'pitch') return pickRandom(PITCH_ISSUES);
    return pickRandom(GOOD_SCORE);
  }

  // Struggling
  if (mainIssue === 'timing') return pickRandom(TIMING_ISSUES);
  if (mainIssue === 'pitch') return pickRandom(PITCH_ISSUES);
  return pickRandom(STRUGGLING);
}

/**
 * Get a general encouragement message (not score-specific).
 */
export function getEncouragementText(): string {
  return pickRandom(GENERAL_ENCOURAGEMENT);
}

/**
 * Get a returning-after-break message.
 */
export function getReturningText(): string {
  return pickRandom(RETURNING_AFTER_BREAK);
}
