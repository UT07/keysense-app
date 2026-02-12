# KeySense Backend Services

This directory contains all backend integration services for KeySense, including Firebase, AI coaching, and analytics.

## Architecture

```
src/services/
├── firebase/           # Firebase integration
│   ├── config.ts       # Initialization and configuration
│   ├── auth.ts         # Authentication (email, Google OAuth)
│   ├── firestore.ts    # Database operations and sync
│   └── functions.ts    # Cloud Functions client
├── ai/                 # AI coaching system
│   ├── GeminiCoach.ts  # Gemini 1.5 Flash integration
│   └── CoachingService.ts # Higher-level wrapper
└── analytics/          # Analytics and tracking
    └── PostHog.ts      # PostHog event tracking
```

## Quick Start

### 1. Initialize Firebase

```typescript
import { auth, db, functions } from '@/services/firebase/config';
import { AnalyticsService } from '@/services/analytics/PostHog';

// Initialize analytics in App.tsx
useEffect(() => {
  AnalyticsService.initialize();
}, []);
```

### 2. Authenticate Users

```typescript
import { AuthService } from '@/services/firebase/auth';

// Sign up with email
const userCred = await AuthService.signUpWithEmail(email, password, displayName);

// Sign in
const userCred = await AuthService.signInWithEmail(email, password);

// Sign in with Google (requires @react-native-google-signin/google-signin)
const userCred = await AuthService.signInWithGoogle(idToken);

// Get current user
const user = AuthService.getCurrentUser();

// Sign out
await AuthService.signOut();
```

### 3. Get AI Coaching Feedback

```typescript
import { getCoachFeedback, CoachRequest } from '@/services/ai/GeminiCoach';

const request: CoachRequest = {
  exerciseId: 'ex-001',
  exerciseTitle: 'C Major Scale',
  difficulty: 2,
  score: {
    overall: 75,
    accuracy: 80,
    timing: 70,
    completeness: 75,
  },
  issues: {
    pitchErrors: [
      { expected: 'C4', played: 'D4', beatPosition: 1 }
    ],
    timingErrors: [
      { note: 'E4', offsetMs: 150, beatPosition: 3 }
    ],
    missedCount: 1,
    extraCount: 0,
  },
  context: {
    attemptNumber: 2,
    previousScore: 65,
    userLevel: 3,
    sessionMinutes: 5,
  },
};

const feedback = await getCoachFeedback(request);
console.log(feedback);
// Output: "Your timing on beat 3 is rushing—try counting '1-2-3-4' out loud..."
```

### 4. Track Events with Analytics

```typescript
import { analyticsEvents, AnalyticsService } from '@/services/analytics/PostHog';

// Track exercise completion
analyticsEvents.exercise.completed('ex-001', 85, 2);

// Track XP earned
analyticsEvents.progress.xpEarned(35, 'exercise_complete');

// Track level up
analyticsEvents.progress.levelUp(5, 500);

// Set user properties
AnalyticsService.identifyUser(uid, {
  level: 5,
  currentStreak: 7,
  hasMidiKeyboard: true,
});
```

### 5. Sync Progress to Cloud

```typescript
import { syncProgress } from '@/services/firebase/functions';

const result = await syncProgress({
  lastSyncTimestamp: lastSync,
  localChanges: [
    {
      id: 'change-1',
      type: 'exercise_completed',
      exerciseId: 'ex-001',
      score: 85,
      timestamp: Date.now(),
      synced: false,
    },
  ],
});
```

## Service Documentation

### Firebase Services

- **config.ts**: Firebase initialization with Auth, Firestore, and Cloud Functions
- **auth.ts**: User authentication with email/password and Google OAuth
- **firestore.ts**: Database operations, data models, and conflict resolution
- **functions.ts**: Client for calling Cloud Functions

See [Firebase Documentation](/agent_docs/firebase-schema.md)

### AI Services

- **GeminiCoach.ts**: AI coaching with Gemini 1.5 Flash, caching, and fallback

See [AI Coaching Documentation](/agent_docs/ai-coaching.md)

### Analytics

- **PostHog.ts**: Event tracking with privacy-first approach

## Environment Variables

Required in `.env.local`:

```bash
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=

# Gemini
EXPO_PUBLIC_GEMINI_API_KEY=

# PostHog
EXPO_PUBLIC_POSTHOG_API_KEY=

# Development
EXPO_PUBLIC_FIREBASE_EMULATOR=false  # Set to true for local testing
```

## Data Models

### UserProfile
User account information and preferences

### LessonProgress
Tracks progress through lessons and exercises

### GamificationData
XP, levels, streaks, and achievements

### ProgressChange
Sync log entries for conflict resolution

See `firestore.ts` for complete type definitions.

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Auth signup-to-profile | <2s | Profile auto-created |
| AI feedback latency | <2s | With caching: <500ms |
| Firestore read | <1s | Indexed queries |
| Progress sync | <5s | Batched writes |
| Cache hit rate | 80%+ | Saves API costs |

## Error Handling

All services include graceful fallbacks:

- Auth errors → User-friendly messages
- Firestore errors → Retry with exponential backoff
- AI errors → Template-based fallback feedback
- Network errors → Queue for later sync

## Testing

```bash
# Unit tests
npm run test -- src/services/

# Integration tests
npm run test:integration

# Type checking
npm run typecheck
```

## Cloud Functions Deployment

```bash
cd firebase
npm install
npm run build
firebase deploy --only functions
```

## Security

- All user data is private (users can only read/write their own)
- Cloud Functions require authentication
- Firestore rules prevent unauthorized access
- Analytics don't capture PII
- Passwords never stored in client code

## Monitoring

- Firestore metrics in Firebase Console
- Cloud Functions logs: `firebase functions:log`
- PostHog dashboard for user analytics
- Error tracking for API failures

## Related Documentation

- [PRD Section 5.3](../PRD.md#53-data-models) - Data models
- [Firebase Schema](../agent_docs/firebase-schema.md) - Complete schema
- [AI Coaching](../agent_docs/ai-coaching.md) - AI coaching system details

## Support

For questions about:
- **Firebase**: Check `firebase/` directory and Firestore security rules
- **AI Coaching**: Check `agent_docs/ai-coaching.md`
- **Data Models**: Check `firestore.ts` type definitions

---

**Last Updated:** 2026-02-11
**Status:** Ready for testing and deployment
