/**
 * Social Store
 *
 * Manages social features:
 * - Friend code for discovery
 * - Friend connections (add/remove/status)
 * - Activity feed from friends (capped at 50 items)
 * - Friend challenges (send/receive/complete)
 * - Persisted to AsyncStorage via debounced save
 */

import { create } from 'zustand';
import type { FriendConnection, ActivityFeedItem, FriendChallenge } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

const MAX_ACTIVITY_FEED = 50;

export interface SocialStoreState {
  friendCode: string;
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

  setFriendCode: (code: string) => {
    set({ friendCode: code });
    debouncedSave(get());
  },

  addFriend: (friend: FriendConnection) => {
    set((state) => ({
      friends: [...state.friends, friend],
    }));
    debouncedSave(get());
  },

  updateFriendStatus: (uid: string, status: FriendConnection['status']) => {
    set((state) => ({
      friends: state.friends.map((f) =>
        f.uid === uid ? { ...f, status } : f
      ),
    }));
    debouncedSave(get());
  },

  removeFriend: (uid: string) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.uid !== uid),
    }));
    debouncedSave(get());
  },

  setFriends: (friends: FriendConnection[]) => {
    set({ friends });
    debouncedSave(get());
  },

  addActivityItem: (item: ActivityFeedItem) => {
    set((state) => ({
      activityFeed: [item, ...state.activityFeed].slice(0, MAX_ACTIVITY_FEED),
    }));
    debouncedSave(get());
  },

  setActivityFeed: (items: ActivityFeedItem[]) => {
    set({ activityFeed: items.slice(0, MAX_ACTIVITY_FEED) });
    debouncedSave(get());
  },

  addChallenge: (challenge: FriendChallenge) => {
    set((state) => ({
      challenges: [challenge, ...state.challenges],
    }));
    debouncedSave(get());
  },

  updateChallenge: (id: string, updates: Partial<FriendChallenge>) => {
    set((state) => ({
      challenges: state.challenges.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }));
    debouncedSave(get());
  },

  setChallenges: (challenges: FriendChallenge[]) => {
    set({ challenges });
    debouncedSave(get());
  },

  reset: () => {
    set(defaultData);
    PersistenceManager.deleteState(STORAGE_KEYS.SOCIAL);
  },
}));

/** Hydrate social store from AsyncStorage on app launch */
export async function hydrateSocialStore(): Promise<void> {
  const data = await PersistenceManager.loadState<SocialData>(STORAGE_KEYS.SOCIAL, defaultData);
  useSocialStore.setState(data);
}
