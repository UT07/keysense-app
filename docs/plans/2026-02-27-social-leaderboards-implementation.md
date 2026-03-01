# Phase 10.5: Social & Leaderboards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add friends, weekly leagues, friend challenges, share cards, and push notifications to drive daily social engagement.

**Architecture:** Friend codes (6-char alphanumeric) for discovery, Firestore subcollections for friend connections + league memberships, Zustand stores for local state, expo-notifications for local reminders. Cloud Functions handle league rotation (weekly cron) and push delivery.

**Tech Stack:** Firebase Firestore (Web SDK v9 modular), Zustand, expo-notifications, expo-crypto, react-native-view-shot, expo-sharing

---

## Context for Implementer

**Store pattern:** See `src/stores/gemStore.ts` — interface + data type + `createDebouncedSave()` + `create()` + `hydrate()` export. Add new STORAGE_KEY to `src/stores/persistence.ts`. Add store reset to `resetAllStores()` in `src/stores/authStore.ts`.

**Firebase pattern:** See `src/services/firebase/firestore.ts` — import `{ doc, collection, getDoc, setDoc, ... }` from `'firebase/firestore'` + `{ db }` from `'./config'`. Use `serverTimestamp()` on writes.

**Screen pattern:** Functional component returning `React.JSX.Element`, `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`, `StyleSheet.create()`, tokens from `../theme/tokens`.

**Navigation:** `RootStackParamList` in `src/navigation/AppNavigator.tsx`. Tabs in `MainTabParamList`. Custom tab bar icons in `src/navigation/CustomTabBar.tsx`.

**Auth:** `useAuthStore((s) => s.user)` for user object. `auth.currentUser?.uid` in services. Anonymous users have `isAnonymous === true` — gate social features.

**Testing:** Jest + React Testing Library. Mocks in `__mocks__/` or inline. Run: `npx jest <path> --verbose`.

---

## Task 1: Add Social Types + Storage Key

**Files:**
- Modify: `src/stores/types.ts`
- Modify: `src/stores/persistence.ts`

**Step 1: Add social types to `src/stores/types.ts`**

Append after the last type block:

```typescript
/**
 * ============================================================================
 * SOCIAL STORE TYPES
 * ============================================================================
 */

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export type FriendStatus = 'pending_outgoing' | 'pending_incoming' | 'accepted';

export interface FriendConnection {
  uid: string;
  displayName: string;
  selectedCatId: string;
  status: FriendStatus;
  connectedAt: number; // epoch ms
}

export interface ActivityFeedItem {
  id: string;
  friendUid: string;
  friendDisplayName: string;
  friendCatId: string;
  type: 'streak_milestone' | 'level_up' | 'evolution' | 'song_mastered' | 'league_promoted';
  detail: string; // e.g. "Reached level 15"
  timestamp: number;
}

export interface LeagueMembership {
  leagueId: string;
  tier: LeagueTier;
  weekStart: string; // ISO date
  weeklyXp: number;
  rank: number;
  totalMembers: number;
}

export interface FriendChallenge {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  fromCatId: string;
  toUid: string;
  exerciseId: string;
  exerciseTitle: string;
  fromScore: number;
  toScore: number | null;
  status: 'pending' | 'completed' | 'expired';
  createdAt: number;
  expiresAt: number; // 48h from creation
}

export interface ShareCardData {
  type: 'score' | 'streak' | 'evolution' | 'league';
  title: string;
  subtitle: string;
  value: string;
  catId: string;
  evolutionStage: number;
}
```

**Step 2: Add STORAGE_KEY to `src/stores/persistence.ts`**

Add to STORAGE_KEYS object:
```typescript
SOCIAL: 'purrrfect_social_state',
LEAGUE: 'purrrfect_league_state',
```

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/stores/types.ts src/stores/persistence.ts
git commit -m "feat(social): add social types + storage keys"
```

---

## Task 2: Create socialStore

**Files:**
- Create: `src/stores/socialStore.ts`
- Modify: `src/stores/authStore.ts` (add to `resetAllStores`)

**Step 1: Create `src/stores/socialStore.ts`**

```typescript
/**
 * Social Store — friends, activity feed, friend challenges, friend code
 */
import { create } from 'zustand';
import { createDebouncedSave, PersistenceManager, STORAGE_KEYS } from './persistence';
import type { FriendConnection, ActivityFeedItem, FriendChallenge } from './types';

export interface SocialStoreState {
  // Data
  friendCode: string; // 6-char alphanumeric, generated once
  friends: FriendConnection[];
  activityFeed: ActivityFeedItem[];
  challenges: FriendChallenge[];

  // Actions
  setFriendCode: (code: string) => void;
  addFriend: (friend: FriendConnection) => void;
  updateFriendStatus: (uid: string, status: FriendConnection['status']) => void;
  removeFriend: (uid: string) => void;
  setFriends: (friends: FriendConnection[]) => void;
  addActivityItem: (item: ActivityFeedItem) => void;
  setActivityFeed: (items: ActivityFeedItem[]) => void;
  addChallenge: (challenge: FriendChallenge) => void;
  updateChallenge: (id: string, updates: Partial<FriendChallenge>) => void;
  setChallenges: (challenges: FriendChallenge[]) => void;
  reset: () => void;
}

type SocialData = Pick<SocialStoreState, 'friendCode' | 'friends' | 'activityFeed' | 'challenges'>;

const defaultData: SocialData = {
  friendCode: '',
  friends: [],
  activityFeed: [],
  challenges: [],
};

const debouncedSave = createDebouncedSave<SocialData>(STORAGE_KEYS.SOCIAL, 500);

export const useSocialStore = create<SocialStoreState>((set, get) => ({
  ...defaultData,

  setFriendCode: (code) => {
    set({ friendCode: code });
    debouncedSave(get());
  },

  addFriend: (friend) => {
    set((s) => ({ friends: [...s.friends, friend] }));
    debouncedSave(get());
  },

  updateFriendStatus: (uid, status) => {
    set((s) => ({
      friends: s.friends.map((f) => (f.uid === uid ? { ...f, status } : f)),
    }));
    debouncedSave(get());
  },

  removeFriend: (uid) => {
    set((s) => ({ friends: s.friends.filter((f) => f.uid !== uid) }));
    debouncedSave(get());
  },

  setFriends: (friends) => {
    set({ friends });
    debouncedSave(get());
  },

  addActivityItem: (item) => {
    set((s) => ({
      activityFeed: [item, ...s.activityFeed].slice(0, 50), // keep last 50
    }));
    debouncedSave(get());
  },

  setActivityFeed: (items) => {
    set({ activityFeed: items });
    debouncedSave(get());
  },

  addChallenge: (challenge) => {
    set((s) => ({ challenges: [...s.challenges, challenge] }));
    debouncedSave(get());
  },

  updateChallenge: (id, updates) => {
    set((s) => ({
      challenges: s.challenges.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    debouncedSave(get());
  },

  setChallenges: (challenges) => {
    set({ challenges });
    debouncedSave(get());
  },

  reset: () => {
    set(defaultData);
    PersistenceManager.deleteState(STORAGE_KEYS.SOCIAL);
  },
}));

export async function hydrateSocialStore(): Promise<void> {
  const data = await PersistenceManager.loadState<SocialData>(STORAGE_KEYS.SOCIAL, defaultData);
  useSocialStore.setState(data);
}
```

**Step 2: Add to `resetAllStores()` in `src/stores/authStore.ts`**

Add import: `import { useSocialStore } from './socialStore';`

Add to the `stores` array in `resetAllStores()`:
```typescript
{ name: 'social', reset: () => useSocialStore.getState().reset() },
```

**Step 3: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest src/stores/ --verbose
```

**Step 4: Commit**

```bash
git add src/stores/socialStore.ts src/stores/authStore.ts
git commit -m "feat(social): create socialStore with friends, activity feed, challenges"
```

---

## Task 3: Create leagueStore

**Files:**
- Create: `src/stores/leagueStore.ts`
- Modify: `src/stores/authStore.ts` (add to `resetAllStores`)

**Step 1: Create `src/stores/leagueStore.ts`**

```typescript
/**
 * League Store — weekly leagues, standings, promotion/demotion
 */
import { create } from 'zustand';
import { createDebouncedSave, PersistenceManager, STORAGE_KEYS } from './persistence';
import type { LeagueTier, LeagueMembership } from './types';

export interface LeagueStandingEntry {
  uid: string;
  displayName: string;
  selectedCatId: string;
  weeklyXp: number;
  rank: number;
}

export interface LeagueStoreState {
  // Data
  membership: LeagueMembership | null;
  standings: LeagueStandingEntry[];
  isLoadingStandings: boolean;

  // Actions
  setMembership: (membership: LeagueMembership | null) => void;
  setStandings: (standings: LeagueStandingEntry[]) => void;
  setLoadingStandings: (loading: boolean) => void;
  updateWeeklyXp: (xp: number) => void;
  reset: () => void;
}

type LeagueData = Pick<LeagueStoreState, 'membership'>;

const defaultData: LeagueData = {
  membership: null,
};

const debouncedSave = createDebouncedSave<LeagueData>(STORAGE_KEYS.LEAGUE, 500);

export const useLeagueStore = create<LeagueStoreState>((set, get) => ({
  ...defaultData,
  standings: [],
  isLoadingStandings: false,

  setMembership: (membership) => {
    set({ membership });
    debouncedSave(get());
  },

  setStandings: (standings) => {
    set({ standings, isLoadingStandings: false });
  },

  setLoadingStandings: (loading) => {
    set({ isLoadingStandings: loading });
  },

  updateWeeklyXp: (xp) => {
    const { membership } = get();
    if (membership) {
      const updated = { ...membership, weeklyXp: xp };
      set({ membership: updated });
      debouncedSave(get());
    }
  },

  reset: () => {
    set({ ...defaultData, standings: [], isLoadingStandings: false });
    PersistenceManager.deleteState(STORAGE_KEYS.LEAGUE);
  },
}));

export async function hydrateLeagueStore(): Promise<void> {
  const data = await PersistenceManager.loadState<LeagueData>(STORAGE_KEYS.LEAGUE, defaultData);
  useLeagueStore.setState(data);
}
```

**Step 2: Add to `resetAllStores()` in `src/stores/authStore.ts`**

Add import: `import { useLeagueStore } from './leagueStore';`

Add to `stores` array:
```typescript
{ name: 'league', reset: () => useLeagueStore.getState().reset() },
```

**Step 3: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest src/stores/ --verbose
```

**Step 4: Commit**

```bash
git add src/stores/leagueStore.ts src/stores/authStore.ts
git commit -m "feat(social): create leagueStore with membership + standings"
```

---

## Task 4: Create socialService (Firestore CRUD)

**Files:**
- Create: `src/services/firebase/socialService.ts`

**Step 1: Create `src/services/firebase/socialService.ts`**

```typescript
/**
 * Social Service — Firestore CRUD for friends, friend codes, activity, challenges
 *
 * Collections:
 *   friendCodes/{code}                → { uid }
 *   users/{uid}/friends/{friendUid}   → FriendDoc
 *   users/{uid}/activity/{itemId}     → ActivityDoc
 *   challenges/{challengeId}          → ChallengeDoc
 */
import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { auth } from './config';
import type { FriendConnection, ActivityFeedItem, FriendChallenge } from '../../stores/types';

// ============================================================================
// Friend Code
// ============================================================================

/** Generate a 6-char alphanumeric code (uppercase) */
export function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Register a friend code for the current user. Retries on collision. */
export async function registerFriendCode(uid: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFriendCode();
    const ref = doc(db, 'friendCodes', code);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { uid, createdAt: serverTimestamp() });
      return code;
    }
  }
  throw new Error('Failed to generate unique friend code after 5 attempts');
}

/** Look up a UID from a friend code */
export async function lookupFriendCode(code: string): Promise<string | null> {
  const ref = doc(db, 'friendCodes', code.toUpperCase().trim());
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return (snap.data() as { uid: string }).uid;
}

// ============================================================================
// Friends
// ============================================================================

interface FriendDoc {
  uid: string;
  displayName: string;
  selectedCatId: string;
  status: FriendConnection['status'];
  initiatedBy: string;
  connectedAt: ReturnType<typeof serverTimestamp> | number;
}

/** Send a friend request */
export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromDisplayName: string,
  fromCatId: string,
  toDisplayName: string,
  toCatId: string,
): Promise<void> {
  // Write to sender's friends list
  await setDoc(doc(db, 'users', fromUid, 'friends', toUid), {
    uid: toUid,
    displayName: toDisplayName,
    selectedCatId: toCatId,
    status: 'pending_outgoing',
    initiatedBy: fromUid,
    connectedAt: serverTimestamp(),
  } satisfies FriendDoc);

  // Write to receiver's friends list
  await setDoc(doc(db, 'users', toUid, 'friends', fromUid), {
    uid: fromUid,
    displayName: fromDisplayName,
    selectedCatId: fromCatId,
    status: 'pending_incoming',
    initiatedBy: fromUid,
    connectedAt: serverTimestamp(),
  } satisfies FriendDoc);
}

/** Accept a friend request */
export async function acceptFriendRequest(myUid: string, friendUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', myUid, 'friends', friendUid), { status: 'accepted' });
  await updateDoc(doc(db, 'users', friendUid, 'friends', myUid), { status: 'accepted' });
}

/** Remove a friend (or decline request) */
export async function removeFriendConnection(myUid: string, friendUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'friends', friendUid));
  await deleteDoc(doc(db, 'users', friendUid, 'friends', myUid));
}

/** Get all friends for a user */
export async function getFriends(uid: string): Promise<FriendConnection[]> {
  const q = query(collection(db, 'users', uid, 'friends'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as FriendDoc;
    return {
      uid: data.uid,
      displayName: data.displayName,
      selectedCatId: data.selectedCatId,
      status: data.status as FriendConnection['status'],
      connectedAt: typeof data.connectedAt === 'number' ? data.connectedAt : Date.now(),
    };
  });
}

// ============================================================================
// Activity Feed
// ============================================================================

/** Post an activity item visible to all friends */
export async function postActivity(uid: string, item: Omit<ActivityFeedItem, 'id'>): Promise<void> {
  const id = `${uid}_${Date.now()}`;
  await setDoc(doc(db, 'users', uid, 'activity', id), {
    ...item,
    id,
    timestamp: Date.now(),
  });
}

/** Get recent activity from a friend */
export async function getFriendActivity(
  friendUid: string,
  maxItems: number = 10,
): Promise<ActivityFeedItem[]> {
  const q = query(
    collection(db, 'users', friendUid, 'activity'),
    orderBy('timestamp', 'desc'),
    limit(maxItems),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ActivityFeedItem);
}

// ============================================================================
// Friend Challenges
// ============================================================================

/** Create a friend challenge */
export async function createChallenge(challenge: FriendChallenge): Promise<void> {
  await setDoc(doc(db, 'challenges', challenge.id), {
    ...challenge,
    createdAt: Date.now(),
    expiresAt: Date.now() + 48 * 60 * 60 * 1000,
  });
}

/** Get challenges involving a user */
export async function getChallengesForUser(uid: string): Promise<FriendChallenge[]> {
  const fromQ = query(collection(db, 'challenges'), where('fromUid', '==', uid));
  const toQ = query(collection(db, 'challenges'), where('toUid', '==', uid));
  const [fromSnap, toSnap] = await Promise.all([getDocs(fromQ), getDocs(toQ)]);
  const all = [...fromSnap.docs, ...toSnap.docs].map((d) => d.data() as FriendChallenge);
  // Deduplicate by id
  const seen = new Set<string>();
  return all.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

/** Update challenge result */
export async function updateChallengeResult(
  challengeId: string,
  toScore: number,
): Promise<void> {
  await updateDoc(doc(db, 'challenges', challengeId), {
    toScore,
    status: 'completed',
  });
}
```

**Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/services/firebase/socialService.ts
git commit -m "feat(social): create socialService with friends, codes, activity, challenges"
```

---

## Task 5: Create leagueService (Firestore CRUD)

**Files:**
- Create: `src/services/firebase/leagueService.ts`

**Step 1: Create `src/services/firebase/leagueService.ts`**

```typescript
/**
 * League Service — Firestore CRUD for weekly leagues
 *
 * Collections:
 *   leagues/{leagueId}                    → League metadata
 *   leagues/{leagueId}/members/{uid}      → Member entry with weeklyXp
 */
import {
  doc,
  collection,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from './config';
import type { LeagueTier, LeagueMembership } from '../../stores/types';
import type { LeagueStandingEntry } from '../../stores/leagueStore';

// ============================================================================
// Types
// ============================================================================

interface LeagueDoc {
  id: string;
  tier: LeagueTier;
  weekStart: string; // ISO date (Monday)
  weekEnd: string; // ISO date (Sunday)
  memberCount: number;
  maxMembers: number;
}

interface LeagueMemberDoc {
  uid: string;
  displayName: string;
  selectedCatId: string;
  weeklyXp: number;
  joinedAt: ReturnType<typeof serverTimestamp> | number;
}

// ============================================================================
// Helpers
// ============================================================================

/** Get the current week's Monday as ISO date */
export function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

/** Get Sunday end date from Monday start */
function getWeekEnd(mondayIso: string): string {
  const d = new Date(mondayIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().split('T')[0];
}

// ============================================================================
// League Assignment
// ============================================================================

/** Find or create a league slot for a user. Returns the league they're in. */
export async function assignToLeague(
  uid: string,
  displayName: string,
  selectedCatId: string,
  tier: LeagueTier = 'bronze',
): Promise<LeagueMembership> {
  const weekStart = getCurrentWeekMonday();
  const weekEnd = getWeekEnd(weekStart);

  // Look for an open league at this tier + week
  const q = query(
    collection(db, 'leagues'),
    where('tier', '==', tier),
    where('weekStart', '==', weekStart),
    where('memberCount', '<', 30),
    limit(1),
  );
  const snap = await getDocs(q);

  let leagueId: string;

  if (snap.empty) {
    // Create new league
    leagueId = `${tier}_${weekStart}_${Date.now()}`;
    await setDoc(doc(db, 'leagues', leagueId), {
      id: leagueId,
      tier,
      weekStart,
      weekEnd,
      memberCount: 1,
      maxMembers: 30,
    } satisfies LeagueDoc);
  } else {
    leagueId = snap.docs[0].id;
    await updateDoc(doc(db, 'leagues', leagueId), {
      memberCount: increment(1),
    });
  }

  // Add member
  await setDoc(doc(db, 'leagues', leagueId, 'members', uid), {
    uid,
    displayName,
    selectedCatId,
    weeklyXp: 0,
    joinedAt: serverTimestamp(),
  } satisfies LeagueMemberDoc);

  return {
    leagueId,
    tier,
    weekStart,
    weeklyXp: 0,
    rank: 0,
    totalMembers: 1,
  };
}

// ============================================================================
// Standings
// ============================================================================

/** Get league standings ordered by weeklyXp */
export async function getLeagueStandings(leagueId: string): Promise<LeagueStandingEntry[]> {
  const q = query(
    collection(db, 'leagues', leagueId, 'members'),
    orderBy('weeklyXp', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => {
    const data = d.data() as LeagueMemberDoc;
    return {
      uid: data.uid,
      displayName: data.displayName,
      selectedCatId: data.selectedCatId,
      weeklyXp: data.weeklyXp,
      rank: i + 1,
    };
  });
}

/** Add XP to a user's league entry */
export async function addLeagueXp(leagueId: string, uid: string, xpAmount: number): Promise<void> {
  const ref = doc(db, 'leagues', leagueId, 'members', uid);
  await updateDoc(ref, { weeklyXp: increment(xpAmount) });
}

/** Get a user's current league membership (checks this week) */
export async function getCurrentLeagueMembership(uid: string): Promise<LeagueMembership | null> {
  const weekStart = getCurrentWeekMonday();
  // Search all leagues for this user this week
  const tiers: LeagueTier[] = ['bronze', 'silver', 'gold', 'diamond'];
  for (const tier of tiers) {
    const q = query(
      collection(db, 'leagues'),
      where('tier', '==', tier),
      where('weekStart', '==', weekStart),
    );
    const leagueSnap = await getDocs(q);
    for (const leagueDoc of leagueSnap.docs) {
      const memberRef = doc(db, 'leagues', leagueDoc.id, 'members', uid);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        const data = memberSnap.data() as LeagueMemberDoc;
        const leagueData = leagueDoc.data() as LeagueDoc;
        return {
          leagueId: leagueDoc.id,
          tier: leagueData.tier,
          weekStart: leagueData.weekStart,
          weeklyXp: data.weeklyXp,
          rank: 0, // Computed from standings
          totalMembers: leagueData.memberCount,
        };
      }
    }
  }
  return null;
}
```

**Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/services/firebase/leagueService.ts
git commit -m "feat(social): create leagueService with league assignment + standings"
```

---

## Task 6: Store Tests

**Files:**
- Create: `src/stores/__tests__/socialStore.test.ts`
- Create: `src/stores/__tests__/leagueStore.test.ts`

**Step 1: Create `src/stores/__tests__/socialStore.test.ts`**

```typescript
import { useSocialStore, hydrateSocialStore } from '../socialStore';
import { PersistenceManager } from '../persistence';
import type { FriendConnection, ActivityFeedItem, FriendChallenge } from '../types';

// Mock persistence
jest.mock('../persistence', () => ({
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
  PersistenceManager: {
    loadState: jest.fn().mockResolvedValue({}),
    saveState: jest.fn().mockResolvedValue(undefined),
    deleteState: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: { SOCIAL: 'test_social', LEAGUE: 'test_league' },
}));

const mockFriend: FriendConnection = {
  uid: 'friend-1',
  displayName: 'Alice',
  selectedCatId: 'jazzy',
  status: 'accepted',
  connectedAt: Date.now(),
};

const mockActivity: ActivityFeedItem = {
  id: 'act-1',
  friendUid: 'friend-1',
  friendDisplayName: 'Alice',
  friendCatId: 'jazzy',
  type: 'level_up',
  detail: 'Reached level 5',
  timestamp: Date.now(),
};

const mockChallenge: FriendChallenge = {
  id: 'ch-1',
  fromUid: 'me',
  fromDisplayName: 'Me',
  fromCatId: 'luna',
  toUid: 'friend-1',
  exerciseId: 'ex-1',
  exerciseTitle: 'C Major Scale',
  fromScore: 85,
  toScore: null,
  status: 'pending',
  createdAt: Date.now(),
  expiresAt: Date.now() + 48 * 60 * 60 * 1000,
};

describe('socialStore', () => {
  beforeEach(() => {
    useSocialStore.getState().reset();
  });

  it('starts with empty defaults', () => {
    const s = useSocialStore.getState();
    expect(s.friendCode).toBe('');
    expect(s.friends).toEqual([]);
    expect(s.activityFeed).toEqual([]);
    expect(s.challenges).toEqual([]);
  });

  it('sets friend code', () => {
    useSocialStore.getState().setFriendCode('ABC123');
    expect(useSocialStore.getState().friendCode).toBe('ABC123');
  });

  it('adds and removes friends', () => {
    useSocialStore.getState().addFriend(mockFriend);
    expect(useSocialStore.getState().friends).toHaveLength(1);
    useSocialStore.getState().removeFriend('friend-1');
    expect(useSocialStore.getState().friends).toHaveLength(0);
  });

  it('updates friend status', () => {
    useSocialStore.getState().addFriend({ ...mockFriend, status: 'pending_incoming' });
    useSocialStore.getState().updateFriendStatus('friend-1', 'accepted');
    expect(useSocialStore.getState().friends[0].status).toBe('accepted');
  });

  it('adds activity items and caps at 50', () => {
    for (let i = 0; i < 60; i++) {
      useSocialStore.getState().addActivityItem({ ...mockActivity, id: `act-${i}` });
    }
    expect(useSocialStore.getState().activityFeed).toHaveLength(50);
  });

  it('manages challenges', () => {
    useSocialStore.getState().addChallenge(mockChallenge);
    expect(useSocialStore.getState().challenges).toHaveLength(1);
    useSocialStore.getState().updateChallenge('ch-1', { toScore: 90, status: 'completed' });
    const updated = useSocialStore.getState().challenges[0];
    expect(updated.toScore).toBe(90);
    expect(updated.status).toBe('completed');
  });

  it('resets to defaults', () => {
    useSocialStore.getState().addFriend(mockFriend);
    useSocialStore.getState().reset();
    expect(useSocialStore.getState().friends).toEqual([]);
  });

  it('hydrates from persistence', async () => {
    (PersistenceManager.loadState as jest.Mock).mockResolvedValueOnce({
      friendCode: 'XYZ789',
      friends: [mockFriend],
      activityFeed: [],
      challenges: [],
    });
    await hydrateSocialStore();
    expect(useSocialStore.getState().friendCode).toBe('XYZ789');
    expect(useSocialStore.getState().friends).toHaveLength(1);
  });
});
```

**Step 2: Create `src/stores/__tests__/leagueStore.test.ts`**

```typescript
import { useLeagueStore, hydrateLeagueStore } from '../leagueStore';
import { PersistenceManager } from '../persistence';
import type { LeagueMembership } from '../types';

jest.mock('../persistence', () => ({
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
  PersistenceManager: {
    loadState: jest.fn().mockResolvedValue({}),
    saveState: jest.fn().mockResolvedValue(undefined),
    deleteState: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: { SOCIAL: 'test_social', LEAGUE: 'test_league' },
}));

const mockMembership: LeagueMembership = {
  leagueId: 'bronze_2026-02-24_123',
  tier: 'bronze',
  weekStart: '2026-02-24',
  weeklyXp: 150,
  rank: 5,
  totalMembers: 20,
};

describe('leagueStore', () => {
  beforeEach(() => {
    useLeagueStore.getState().reset();
  });

  it('starts with null membership', () => {
    expect(useLeagueStore.getState().membership).toBeNull();
    expect(useLeagueStore.getState().standings).toEqual([]);
  });

  it('sets membership', () => {
    useLeagueStore.getState().setMembership(mockMembership);
    expect(useLeagueStore.getState().membership).toEqual(mockMembership);
  });

  it('updates weekly XP', () => {
    useLeagueStore.getState().setMembership(mockMembership);
    useLeagueStore.getState().updateWeeklyXp(300);
    expect(useLeagueStore.getState().membership!.weeklyXp).toBe(300);
  });

  it('sets standings', () => {
    const standings = [
      { uid: '1', displayName: 'Alice', selectedCatId: 'jazzy', weeklyXp: 500, rank: 1 },
      { uid: '2', displayName: 'Bob', selectedCatId: 'luna', weeklyXp: 300, rank: 2 },
    ];
    useLeagueStore.getState().setStandings(standings);
    expect(useLeagueStore.getState().standings).toHaveLength(2);
    expect(useLeagueStore.getState().isLoadingStandings).toBe(false);
  });

  it('resets to defaults', () => {
    useLeagueStore.getState().setMembership(mockMembership);
    useLeagueStore.getState().reset();
    expect(useLeagueStore.getState().membership).toBeNull();
  });

  it('hydrates from persistence', async () => {
    (PersistenceManager.loadState as jest.Mock).mockResolvedValueOnce({
      membership: mockMembership,
    });
    await hydrateLeagueStore();
    expect(useLeagueStore.getState().membership).toEqual(mockMembership);
  });
});
```

**Step 3: Run tests**

```bash
npx jest src/stores/__tests__/socialStore.test.ts src/stores/__tests__/leagueStore.test.ts --verbose
```

**Step 4: Commit**

```bash
git add src/stores/__tests__/socialStore.test.ts src/stores/__tests__/leagueStore.test.ts
git commit -m "test(social): add socialStore + leagueStore unit tests"
```

---

## Task 7: Navigation Restructure — Replace Play Tab with Social

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`
- Modify: `src/navigation/CustomTabBar.tsx`
- Modify: `src/screens/HomeScreen.tsx` (add Free Play button)

**Step 1: Update `RootStackParamList` in `src/navigation/AppNavigator.tsx`**

Add new routes:
```typescript
Leaderboard: undefined;
Friends: undefined;
AddFriend: undefined;
```

**Step 2: Update `MainTabParamList`**

Replace `Play` with `Social`:
```typescript
export type MainTabParamList = {
  Home: undefined;
  Learn: undefined;
  Songs: undefined;
  Social: undefined;
  Profile: undefined;
};
```

**Step 3: Update tab screens in `MainTabs` component**

Replace the `<Tab.Screen name="Play" ...>` with:
```tsx
<Tab.Screen name="Social" component={SocialScreen} />
```

Add stack screens for social routes:
```tsx
<RootStack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ animation: 'slide_from_right' }} />
<RootStack.Screen name="Friends" component={FriendsScreen} options={{ animation: 'slide_from_right' }} />
<RootStack.Screen name="AddFriend" component={AddFriendScreen} options={{ animation: 'slide_from_bottom' }} />
```

For now, use placeholder components until the real screens are built:
```typescript
function SocialScreen() { return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}><Text style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>Social — Coming Soon</Text></View>; }
function LeaderboardScreen() { return <View />; }
function FriendsScreen() { return <View />; }
function AddFriendScreen() { return <View />; }
```

**Step 4: Update `CustomTabBar.tsx` TAB_ICONS**

Replace `Play` entry with:
```typescript
Social: { active: 'account-group', inactive: 'account-group-outline' },
```

**Step 5: Add Free Play button to HomeScreen**

Add a "Free Play" card/button in the quick actions area of HomeScreen that navigates to `FreePlay` route (which was previously the Play tab).

**Step 6: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest --verbose
```

**Step 7: Commit**

```bash
git add src/navigation/ src/screens/HomeScreen.tsx
git commit -m "feat(social): replace Play tab with Social tab + add Free Play to HomeScreen"
```

---

## Task 8: SocialScreen — Hub with Friends, League, Challenges

**Files:**
- Create: `src/screens/SocialScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx` (replace placeholder)

**Step 1: Create `src/screens/SocialScreen.tsx`**

The Social tab hub screen with 3 sections:
1. **League Card** — Current league tier badge, rank, weekly XP, tap → Leaderboard
2. **Friends Section** — Friend count, pending requests badge, tap → Friends screen, Add Friend button
3. **Active Challenges** — Pending/active challenge cards

Must gate behind auth: if `isAnonymous`, show a "Sign in to unlock social features" prompt with button navigating to Auth screen.

Use existing tokens: `COLORS`, `SPACING`, `BORDER_RADIUS`, `TYPOGRAPHY`, `SHADOWS`. Use `PressableScale` for interactive cards. Use `MaterialCommunityIcons` for icons. Use `ScrollView` for the layout.

League tier colors: bronze=#CD7F32, silver=#C0C0C0, gold=#FFD700, diamond=#B9F2FF.

**Step 2: Wire into AppNavigator**

Replace the placeholder `SocialScreen` with the real import.

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/SocialScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat(social): create SocialScreen hub with league card, friends, challenges"
```

---

## Task 9: LeaderboardScreen — Weekly League Standings

**Files:**
- Create: `src/screens/LeaderboardScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx` (replace placeholder)

**Step 1: Create `src/screens/LeaderboardScreen.tsx`**

- Header: League tier badge with tier name and week date range
- Standings list: FlatList of members sorted by weeklyXp
  - Top 3: Gold/Silver/Bronze medal icons, larger row
  - Current user row highlighted with `COLORS.primary` border
  - Each row: rank, cat avatar (KeysieSvg 32x32), display name, weekly XP
- Promotion/demotion zones: Top 10 highlighted green (promote), bottom 5 highlighted red (demote)
- Footer: "You're rank X of Y" summary
- Pull-to-refresh: Fetches fresh standings from leagueService

Use `useLeagueStore` for data, call `getLeagueStandings()` on mount.

**Step 2: Wire into AppNavigator**

Replace the placeholder `LeaderboardScreen` with the real import.

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/LeaderboardScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat(social): create LeaderboardScreen with league standings + promotion zones"
```

---

## Task 10: AddFriendScreen — Friend Code Entry

**Files:**
- Create: `src/screens/AddFriendScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx` (replace placeholder)

**Step 1: Create `src/screens/AddFriendScreen.tsx`**

- **Your Code section:** Large display of user's own friend code with copy-to-clipboard button + share button
- **Add Friend section:** 6-digit text input (auto-uppercase, max 6 chars), "Add" button
- **Flow:** Input code → lookupFriendCode → if found, sendFriendRequest → show success toast; if not found, show error
- Generate friend code on first visit: if `socialStore.friendCode` is empty, call `registerFriendCode(uid)` and save to store
- Use `Clipboard` from `expo-clipboard` for copy

**Step 2: Wire into AppNavigator**

Replace the placeholder with real import.

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/AddFriendScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat(social): create AddFriendScreen with friend code display + lookup"
```

---

## Task 11: FriendsScreen — Friends List + Activity Feed

**Files:**
- Create: `src/screens/FriendsScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx` (replace placeholder)

**Step 1: Create `src/screens/FriendsScreen.tsx`**

Two sections (tab toggle at top):

**"Friends" tab:**
- Pending requests section (if any): Accept/Decline buttons
- Accepted friends list: Cat avatar, display name, "Challenge" button per friend
- Empty state: "Add friends to see them here" with Add Friend button

**"Activity" tab:**
- Chronological feed of friend milestones (level_up, streak_milestone, evolution, song_mastered, league_promoted)
- Each item: friend avatar, name, description, relative timestamp
- Fetch activity from all accepted friends on mount

**Step 2: Wire into AppNavigator**

Replace placeholder.

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/FriendsScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat(social): create FriendsScreen with friend list + activity feed"
```

---

## Task 12: Wire League XP — Update After Exercise Completion

**Files:**
- Modify: `src/stores/progressStore.ts` (add league XP hook)
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` (optional — may already flow through progressStore)

**Step 1: Add league XP update to exercise completion flow**

In `progressStore.ts`, after `addXp()` is called (in `recordExerciseCompletion` or wherever XP is awarded), also update the league:

```typescript
// After XP is awarded
const leagueMembership = useLeagueStore.getState().membership;
if (leagueMembership) {
  const newWeeklyXp = leagueMembership.weeklyXp + xpAmount;
  useLeagueStore.getState().updateWeeklyXp(newWeeklyXp);
  // Fire-and-forget Firestore update
  addLeagueXp(leagueMembership.leagueId, auth.currentUser?.uid ?? '', xpAmount).catch(() => {});
}
```

Import `useLeagueStore` and `addLeagueXp` in progressStore.

**Step 2: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest src/stores/__tests__/progressStore.test.ts --verbose
```

**Step 3: Commit**

```bash
git add src/stores/progressStore.ts
git commit -m "feat(social): wire league XP updates into exercise completion flow"
```

---

## Task 13: Post Activity on Milestones

**Files:**
- Modify: `src/stores/progressStore.ts` (post activity on level_up)
- Modify: `src/stores/catEvolutionStore.ts` (post activity on evolution)

**Step 1: Post activity when user levels up**

In `progressStore.ts`, inside the level-up logic in `addXp()`:
```typescript
import { postActivity } from '../services/firebase/socialService';
import { auth } from '../services/firebase/config';
import { useSettingsStore } from './settingsStore';

// When level changes:
if (newLevel > oldLevel && auth.currentUser && !auth.currentUser.isAnonymous) {
  postActivity(auth.currentUser.uid, {
    friendUid: auth.currentUser.uid,
    friendDisplayName: auth.currentUser.displayName ?? 'Player',
    friendCatId: useSettingsStore.getState().selectedCat ?? 'mini-meowww',
    type: 'level_up',
    detail: `Reached level ${newLevel}`,
    timestamp: Date.now(),
  }).catch(() => {});
}
```

**Step 2: Post activity when cat evolves**

In `catEvolutionStore.ts`, after evolution stage changes:
```typescript
// After stage transition:
if (newStage > oldStage && auth.currentUser && !auth.currentUser.isAnonymous) {
  postActivity(auth.currentUser.uid, {
    friendUid: auth.currentUser.uid,
    friendDisplayName: auth.currentUser.displayName ?? 'Player',
    friendCatId: catId,
    type: 'evolution',
    detail: `${catId} evolved to stage ${newStage}`,
    timestamp: Date.now(),
  }).catch(() => {});
}
```

**Step 3: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest src/stores/ --verbose
```

**Step 4: Commit**

```bash
git add src/stores/progressStore.ts src/stores/catEvolutionStore.ts
git commit -m "feat(social): post activity feed items on level-up and cat evolution"
```

---

## Task 14: Share Cards — Shareable Images

**Files:**
- Create: `src/components/ShareCard.tsx`

**Step 1: Install dependencies**

```bash
npx expo install react-native-view-shot expo-sharing
```

**Step 2: Create `src/components/ShareCard.tsx`**

A component that renders a card and captures it as an image for sharing:

```typescript
/**
 * ShareCard — generates shareable image cards
 * Uses react-native-view-shot to capture + expo-sharing to share
 */
import { useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KeysieSvg } from './Mascot/KeysieSvg';
import { PressableScale } from './common/PressableScale';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, GRADIENTS } from '../theme/tokens';
import type { ShareCardData } from '../stores/types';

interface ShareCardProps {
  data: ShareCardData;
}

export function ShareCard({ data }: ShareCardProps): React.JSX.Element {
  const viewShotRef = useRef<ViewShot>(null);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current?.capture) return;
    try {
      const uri = await viewShotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your achievement',
        });
      }
    } catch (err) {
      console.warn('[ShareCard] Share failed:', err);
    }
  }, []);

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
        <LinearGradient colors={GRADIENTS.cardWarm} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{data.title}</Text>
            <Text style={styles.cardSubtitle}>{data.subtitle}</Text>
          </View>
          <View style={styles.cardCenter}>
            <KeysieSvg catId={data.catId} size={80} mood="happy" evolutionStage={data.evolutionStage} />
            <Text style={styles.cardValue}>{data.value}</Text>
          </View>
          <Text style={styles.branding}>Purrrfect Keys</Text>
        </LinearGradient>
      </ViewShot>
      <PressableScale onPress={handleShare} style={styles.shareButton}>
        <MaterialCommunityIcons name="share-variant" size={18} color={COLORS.textPrimary} />
        <Text style={styles.shareText}>Share</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardHeader: { alignItems: 'center', gap: 4 },
  cardTitle: { ...TYPOGRAPHY.heading.lg, color: COLORS.textPrimary },
  cardSubtitle: { ...TYPOGRAPHY.body.md, color: COLORS.textSecondary },
  cardCenter: { alignItems: 'center', gap: SPACING.sm },
  cardValue: { fontSize: 36, fontWeight: '800', color: COLORS.starGold },
  branding: { ...TYPOGRAPHY.caption.sm, color: COLORS.textMuted, marginTop: SPACING.sm },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  shareText: { ...TYPOGRAPHY.button.md, color: COLORS.textPrimary },
});
```

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/ShareCard.tsx package.json
git commit -m "feat(social): create ShareCard component with view-shot + expo-sharing"
```

---

## Task 15: Hydration + League Auto-Join

**Files:**
- Modify: `src/App.tsx` or wherever store hydration happens (find the hydration chain)
- Modify: `src/stores/authStore.ts` (trigger league join after sign-in)

**Step 1: Find and update the hydration chain**

Search for where `hydrateGemStore()` or similar is called (likely in App.tsx or a startup hook). Add:
```typescript
import { hydrateSocialStore } from './stores/socialStore';
import { hydrateLeagueStore } from './stores/leagueStore';

// In the hydration sequence:
await hydrateSocialStore();
await hydrateLeagueStore();
```

**Step 2: Auto-join league on first authenticated session**

In `authStore.ts`, after successful sign-in (in `triggerPostSignInSync` or the auth state change handler), check if user has a league membership:

```typescript
import { getCurrentLeagueMembership, assignToLeague } from '../services/firebase/leagueService';
import { useLeagueStore } from './leagueStore';

// After auth state resolved with non-anonymous user:
async function ensureLeagueMembership(uid: string, displayName: string, catId: string): Promise<void> {
  try {
    let membership = await getCurrentLeagueMembership(uid);
    if (!membership) {
      membership = await assignToLeague(uid, displayName, catId, 'bronze');
    }
    useLeagueStore.getState().setMembership(membership);
  } catch (err) {
    console.warn('[Social] League membership check failed:', err);
  }
}
```

Call this after auth resolves for non-anonymous users.

**Step 3: Auto-register friend code**

Similarly, if `socialStore.friendCode` is empty after hydration and user is authenticated:
```typescript
import { registerFriendCode } from '../services/firebase/socialService';
import { useSocialStore } from './socialStore';

if (!useSocialStore.getState().friendCode && !user.isAnonymous) {
  registerFriendCode(user.uid).then((code) => {
    useSocialStore.getState().setFriendCode(code);
  }).catch(() => {});
}
```

**Step 4: Run typecheck + tests**

```bash
npx tsc --noEmit
npx jest --verbose
```

**Step 5: Commit**

```bash
git add src/stores/authStore.ts <hydration-file>
git commit -m "feat(social): add social/league hydration + auto-join league on sign-in"
```

---

## Task 16: Notifications Setup (Local)

**Files:**
- Create: `src/services/notificationService.ts`

**Step 1: Install expo-notifications**

```bash
npx expo install expo-notifications
```

**Step 2: Create `src/services/notificationService.ts`**

```typescript
/**
 * Notification Service — local notifications for streak reminders,
 * league results, and challenge updates
 */
import * as Notifications from 'expo-notifications';

// Configure notification handler (shows when app is foregrounded)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request notification permissions */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Schedule a daily practice reminder */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<string> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to practice!',
      body: "Your cat misses you. Keep your streak alive!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

/** Schedule a streak-at-risk reminder (fires at 8pm if no practice today) */
export async function scheduleStreakReminder(): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Streak at risk!',
      body: 'Practice now to keep your streak going!',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
  return id;
}

/** Send an immediate local notification */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // immediate
  });
}

/** Cancel all scheduled notifications */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
```

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/services/notificationService.ts package.json
git commit -m "feat(social): create notificationService with local daily/streak reminders"
```

---

## Task 17: Social Store Tests + Service Tests

**Files:**
- Create: `src/services/firebase/__tests__/socialService.test.ts`
- Create: `src/services/firebase/__tests__/leagueService.test.ts`

**Step 1: Create `src/services/firebase/__tests__/socialService.test.ts`**

Test the pure functions (generateFriendCode) and mock Firestore for CRUD:

```typescript
import { generateFriendCode } from '../socialService';

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('../config', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

describe('socialService', () => {
  describe('generateFriendCode', () => {
    it('generates a 6-character code', () => {
      const code = generateFriendCode();
      expect(code).toHaveLength(6);
    });

    it('uses only valid characters (no I/O/0/1)', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateFriendCode();
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      }
    });

    it('generates unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateFriendCode());
      }
      // Very high probability of uniqueness with 6 chars from 32-char alphabet
      expect(codes.size).toBeGreaterThan(90);
    });
  });
});
```

**Step 2: Create `src/services/firebase/__tests__/leagueService.test.ts`**

```typescript
import { getCurrentWeekMonday } from '../leagueService';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  updateDoc: jest.fn(),
  increment: jest.fn((n) => n),
}));

jest.mock('../config', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

describe('leagueService', () => {
  describe('getCurrentWeekMonday', () => {
    it('returns a date string in YYYY-MM-DD format', () => {
      const result = getCurrentWeekMonday();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a Monday', () => {
      const result = getCurrentWeekMonday();
      const date = new Date(result + 'T00:00:00Z');
      expect(date.getUTCDay()).toBe(1); // 1 = Monday
    });
  });
});
```

**Step 3: Run tests**

```bash
npx jest src/services/firebase/__tests__/socialService.test.ts src/services/firebase/__tests__/leagueService.test.ts --verbose
```

**Step 4: Commit**

```bash
git add src/services/firebase/__tests__/
git commit -m "test(social): add socialService + leagueService unit tests"
```

---

## Task 18: Full Test Suite Verification

**Files:** None (verification only)

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

**Step 2: Run full test suite**

```bash
npx jest --verbose 2>&1 | tail -20
```

Expected: All suites pass (should be ~120+ suites now)

**Step 3: Fix any regressions**

If any tests fail due to missing mocks (e.g., new imports in existing files), update the test mocks accordingly.

**Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix(social): resolve test regressions from social feature integration"
```

---

## Task 19: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `agent_docs/stabilization-report.md`
- Modify: `docs/plans/UNIFIED-PLAN.md`

**Step 1: Update CLAUDE.md**

- Update test counts
- Mark Phase 10.5 as COMPLETE
- Add new files to project structure and Key Files table:
  - `src/stores/socialStore.ts`
  - `src/stores/leagueStore.ts`
  - `src/services/firebase/socialService.ts`
  - `src/services/firebase/leagueService.ts`
  - `src/services/notificationService.ts`
  - `src/screens/SocialScreen.tsx`
  - `src/screens/LeaderboardScreen.tsx`
  - `src/screens/FriendsScreen.tsx`
  - `src/screens/AddFriendScreen.tsx`
  - `src/components/ShareCard.tsx`

**Step 2: Update stabilization-report.md**

Add a Phase 10.5 section documenting all changes.

**Step 3: Update UNIFIED-PLAN.md**

Mark Phase 10.5 as COMPLETE.

**Step 4: Commit**

```bash
git add CLAUDE.md agent_docs/stabilization-report.md docs/plans/UNIFIED-PLAN.md
git commit -m "docs: update docs for Phase 10.5 Social & Leaderboards"
```

---

## Implementation Batches Summary

| Batch | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-3 | Types, stores (socialStore + leagueStore) |
| 2 | 4-5 | Firebase services (socialService + leagueService) |
| 3 | 6-7 | Store tests + navigation restructure |
| 4 | 8-11 | Screens (Social hub, Leaderboard, AddFriend, Friends) |
| 5 | 12-13 | Wiring (league XP, activity feed posts) |
| 6 | 14-16 | Share cards, hydration, notifications |
| 7 | 17-19 | Tests, verification, documentation |

**Total: 19 tasks, 7 batches**

**Exit Criteria:**
- Social tab replaces Play tab (Free Play moved to HomeScreen)
- Friend system with 6-char code + add/accept/decline
- Weekly leagues (Bronze → Diamond) with standings UI
- Friend challenges (48h window)
- Share cards via react-native-view-shot
- Local notifications for daily reminder + streak risk
- Activity feed showing friend milestones
- League XP updates after every exercise
- All tests pass, 0 TypeScript errors
