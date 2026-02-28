/**
 * League Service — Firestore CRUD for weekly leagues
 *
 * Firestore paths:
 *   leagues/{leagueId}                  — League document (tier, weekStart, memberCount)
 *   leagues/{leagueId}/members/{uid}    — Member document (displayName, catId, weeklyXp)
 */

import {
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import type { LeagueTier, LeagueMembership } from '../../stores/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeagueStandingEntry {
  uid: string;
  displayName: string;
  selectedCatId: string;
  weeklyXp: number;
  rank: number;
}

interface LeagueDocument {
  tier: LeagueTier;
  weekStart: string;
  memberCount: number;
  createdAt: number;
}

interface LeagueMemberDocument {
  uid: string;
  displayName: string;
  selectedCatId: string;
  weeklyXp: number;
  joinedAt: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const MAX_LEAGUE_SIZE = 30;

/**
 * Returns the ISO date string (YYYY-MM-DD) for the Monday of the current week (UTC).
 */
export function getCurrentWeekMonday(): string {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;

  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);

  return monday.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// League Assignment
// ---------------------------------------------------------------------------

/**
 * Assign a user to a league for the current week.
 * Finds an existing league with space (memberCount < 30), or creates a new one.
 * Adds the user as a member with 0 weeklyXp.
 */
export async function assignToLeague(
  uid: string,
  displayName: string,
  selectedCatId: string,
  tier: LeagueTier = 'bronze',
): Promise<LeagueMembership> {
  const weekStart = getCurrentWeekMonday();

  // Find a candidate league with space (query outside transaction — Firestore
  // transactions don't support queries, but the transaction body verifies capacity)
  const leaguesCol = collection(db, 'leagues');
  const openLeagueQuery = query(
    leaguesCol,
    where('tier', '==', tier),
    where('weekStart', '==', weekStart),
    where('memberCount', '<', MAX_LEAGUE_SIZE),
    limit(1),
  );
  const openSnap = await getDocs(openLeagueQuery);

  // Use a transaction for the read-then-write to prevent race conditions
  const result = await runTransaction(db, async (transaction) => {
    let leagueId: string;
    let memberCount: number;

    if (openSnap.empty) {
      // Create a new league
      const newLeagueRef = doc(collection(db, 'leagues'));
      leagueId = newLeagueRef.id;
      memberCount = 0;

      const leagueDoc: LeagueDocument = {
        tier,
        weekStart,
        memberCount: 1, // We're the first member
        createdAt: Date.now(),
      };
      transaction.set(newLeagueRef, leagueDoc);
    } else {
      const candidateRef = doc(db, 'leagues', openSnap.docs[0].id);
      const freshSnap = await transaction.get(candidateRef);

      if (!freshSnap.exists()) {
        // League was deleted between query and transaction — create new
        const newLeagueRef = doc(collection(db, 'leagues'));
        leagueId = newLeagueRef.id;
        memberCount = 0;
        transaction.set(newLeagueRef, {
          tier,
          weekStart,
          memberCount: 1,
          createdAt: Date.now(),
        } as LeagueDocument);
      } else {
        const leagueData = freshSnap.data() as LeagueDocument;
        if (leagueData.memberCount >= MAX_LEAGUE_SIZE) {
          // League filled up between query and transaction — create new
          const newLeagueRef = doc(collection(db, 'leagues'));
          leagueId = newLeagueRef.id;
          memberCount = 0;
          transaction.set(newLeagueRef, {
            tier,
            weekStart,
            memberCount: 1,
            createdAt: Date.now(),
          } as LeagueDocument);
        } else {
          leagueId = candidateRef.id;
          memberCount = leagueData.memberCount;
          transaction.update(candidateRef, { memberCount: increment(1) });
        }
      }
    }

    // Add user as a member
    const memberRef = doc(db, 'leagues', leagueId, 'members', uid);
    const memberDoc: LeagueMemberDocument = {
      uid,
      displayName,
      selectedCatId,
      weeklyXp: 0,
      joinedAt: Date.now(),
    };
    transaction.set(memberRef, memberDoc);

    return {
      leagueId,
      tier,
      weekStart,
      weeklyXp: 0,
      rank: memberCount + 1,
      totalMembers: memberCount + 1,
    } as LeagueMembership;
  });

  return result;
}

// ---------------------------------------------------------------------------
// League Standings
// ---------------------------------------------------------------------------

/**
 * Get league standings ordered by weeklyXp descending.
 * Returns all members with their computed rank.
 */
export async function getLeagueStandings(
  leagueId: string,
): Promise<LeagueStandingEntry[]> {
  const membersCol = collection(db, 'leagues', leagueId, 'members');
  const q = query(membersCol, orderBy('weeklyXp', 'desc'));
  const snap = await getDocs(q);

  return snap.docs.map((d, index) => {
    const data = d.data() as LeagueMemberDocument;
    return {
      uid: data.uid,
      displayName: data.displayName,
      selectedCatId: data.selectedCatId,
      weeklyXp: data.weeklyXp,
      rank: index + 1,
    };
  });
}

// ---------------------------------------------------------------------------
// XP Updates
// ---------------------------------------------------------------------------

/**
 * Add XP to a league member's weekly total.
 * Uses Firestore increment() for atomic updates.
 */
export async function addLeagueXp(
  leagueId: string,
  uid: string,
  xpAmount: number,
): Promise<void> {
  const memberRef = doc(db, 'leagues', leagueId, 'members', uid);
  await updateDoc(memberRef, { weeklyXp: increment(xpAmount) });
}

// ---------------------------------------------------------------------------
// League Lookup
// ---------------------------------------------------------------------------

/**
 * Find the current league membership for a user this week.
 * Searches across all leagues for the current week.
 * Returns null if the user is not assigned to any league.
 */
export async function getCurrentLeagueMembership(
  uid: string,
): Promise<LeagueMembership | null> {
  const weekStart = getCurrentWeekMonday();

  // Find leagues for this week
  const leaguesCol = collection(db, 'leagues');
  const weekQuery = query(
    leaguesCol,
    where('weekStart', '==', weekStart),
  );
  const leagueSnap = await getDocs(weekQuery);

  // Search each league for the user
  for (const leagueDoc of leagueSnap.docs) {
    const memberRef = doc(db, 'leagues', leagueDoc.id, 'members', uid);
    const memberSnap = await getDoc(memberRef);

    if (memberSnap.exists()) {
      const leagueData = leagueDoc.data() as LeagueDocument;
      const memberData = memberSnap.data() as LeagueMemberDocument;

      // Get standings to compute rank
      const standings = await getLeagueStandings(leagueDoc.id);
      const myEntry = standings.find((s) => s.uid === uid);

      return {
        leagueId: leagueDoc.id,
        tier: leagueData.tier,
        weekStart: leagueData.weekStart,
        weeklyXp: memberData.weeklyXp,
        rank: myEntry?.rank ?? standings.length,
        totalMembers: standings.length,
      };
    }
  }

  return null;
}
