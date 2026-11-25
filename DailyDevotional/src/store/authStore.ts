import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    UserProfile,
    UserProgress,
    DevotionalCompletion,
    DEFAULT_NOTIFICATION_PREFS,
} from '../types';
import { getLocalTimezone } from '../lib/date';
import { EMPTY_PROGRESS, computeProgressFromDates } from '../lib/streak';

const GUEST_PROFILE_KEY = '@devotional_guest_profile_v2';
const GUEST_COMPLETIONS_KEY = '@devotional_guest_completions_v2';
const SESSION_MODE_KEY = '@devotional_session_mode_v2'; // 'guest' | 'auth' | 'none'

function generateGuestUid(): string {
    const timestamp = Date.now().toString(36);
    const deterministicSuffix = ((Date.now() * 9301 + 49297) % 233280).toString(36);
    return `guest_${timestamp}_${deterministicSuffix}`;
}

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    isInitializing: boolean;
    completions: Record<string, DevotionalCompletion>; // keyed by YYYY-MM-DD

    // Actions
    login: (user: UserProfile, completions?: Record<string, DevotionalCompletion>) => void;
    setUser: (user: UserProfile) => void;
    setGuest: () => Promise<UserProfile>;
    logout: () => Promise<void>;
    setInitializing: (value: boolean) => void;
    setCompletions: (completions: Record<string, DevotionalCompletion>) => void;
    recordLocalCompletion: (completion: DevotionalCompletion, nextProgress: UserProgress) => Promise<void>;
    updateStreak: (streak: number, lastReadDate: string) => void;
    restoreGuestIfActive: () => Promise<boolean>;
    getGuestMigrationPayload: () => Promise<{
        guestUid: string | null;
        completions: DevotionalCompletion[];
    }>;
    clearGuestData: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    isAuthenticated: false,
    isGuest: false,
    isInitializing: true,
    completions: {},

    login: (user, completions) => {
        void AsyncStorage.setItem(SESSION_MODE_KEY, user.isGuest ? 'guest' : 'auth');
        set((state) => ({
            user,
            isAuthenticated: true,
            isGuest: user.isGuest,
            isInitializing: false,
            completions: completions ?? state.completions,
        }));
    },

    setUser: (user) =>
        set({
            user,
            isAuthenticated: true,
            isGuest: user.isGuest,
        }),

    setInitializing: (value) => set({ isInitializing: value }),

    setCompletions: (completions) => set({ completions }),

    setGuest: async () => {
        let existingProfile: UserProfile | null = null;
        let existingCompletions: Record<string, DevotionalCompletion> = {};

        try {
            const [rawProfile, rawCompletions] = await Promise.all([
                AsyncStorage.getItem(GUEST_PROFILE_KEY),
                AsyncStorage.getItem(GUEST_COMPLETIONS_KEY),
            ]);
            if (rawCompletions) {
                existingCompletions = JSON.parse(rawCompletions);
            }
            if (rawProfile) {
                existingProfile = JSON.parse(rawProfile);
            }
        } catch (err) {
            console.warn('Failed reading guest storage:', err);
        }

        const progress = computeProgressFromDates(
            Object.keys(existingCompletions),
            undefined,
            existingProfile?.progress?.longestStreak || 0
        );

        const profile: UserProfile = existingProfile
            ? {
                  ...existingProfile,
                  timezone: getLocalTimezone(),
                  progress,
                  streak: progress.currentStreak,
                  lastReadDate: progress.lastCompletedDate || undefined,
                  isGuest: true,
              }
            : {
                  uid: generateGuestUid(),
                  displayName: 'Friend',
                  email: '',
                  timezone: getLocalTimezone(),
                  progress,
                  notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
                  streak: progress.currentStreak,
                  lastReadDate: progress.lastCompletedDate || undefined,
                  isGuest: true,
                  createdAt: new Date().toISOString(),
              };

        try {
            await Promise.all([
                AsyncStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile)),
                AsyncStorage.setItem(SESSION_MODE_KEY, 'guest'),
            ]);
        } catch (err) {
            console.warn('Failed saving guest profile:', err);
        }

        set({
            user: profile,
            isAuthenticated: true,
            isGuest: true,
            isInitializing: false,
            completions: existingCompletions,
        });

        return profile;
    },

    restoreGuestIfActive: async () => {
        try {
            const mode = await AsyncStorage.getItem(SESSION_MODE_KEY);
            if (mode === 'guest') {
                await get().setGuest();
                return true;
            }
        } catch (err) {
            console.warn('Failed checking session mode:', err);
        }
        return false;
    },

    logout: async () => {
        try {
            await AsyncStorage.setItem(SESSION_MODE_KEY, 'none');
        } catch (err) {
            console.warn('Failed clearing session mode:', err);
        }
        set({
            user: null,
            isAuthenticated: false,
            isGuest: false,
            isInitializing: false,
            completions: {},
        });
    },

    recordLocalCompletion: async (completion, nextProgress) => {
        const state = get();
        const nextCompletions = {
            ...state.completions,
            [completion.date]: completion,
        };
        const updatedUser: UserProfile | null = state.user
            ? {
                  ...state.user,
                  progress: nextProgress,
                  streak: nextProgress.currentStreak,
                  lastReadDate: nextProgress.lastCompletedDate || completion.date,
              }
            : null;

        set({
            completions: nextCompletions,
            user: updatedUser,
        });

        if (state.isGuest && updatedUser) {
            try {
                await Promise.all([
                    AsyncStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(updatedUser)),
                    AsyncStorage.setItem(GUEST_COMPLETIONS_KEY, JSON.stringify(nextCompletions)),
                ]);
            } catch (err) {
                console.warn('Failed persisting guest completion:', err);
            }
        }
    },

    updateStreak: (streak, lastReadDate) =>
        set((state) => ({
            user: state.user
                ? {
                      ...state.user,
                      streak,
                      lastReadDate,
                      progress: {
                          ...(state.user.progress || EMPTY_PROGRESS),
                          currentStreak: streak,
                          longestStreak: Math.max(state.user.progress?.longestStreak || 0, streak),
                          lastCompletedDate: lastReadDate,
                      },
                  }
                : null,
        })),

    getGuestMigrationPayload: async () => {
        try {
            const [rawProfile, rawCompletions] = await Promise.all([
                AsyncStorage.getItem(GUEST_PROFILE_KEY),
                AsyncStorage.getItem(GUEST_COMPLETIONS_KEY),
            ]);
            const guestProfile = rawProfile ? (JSON.parse(rawProfile) as UserProfile) : null;
            const completionsMap = rawCompletions
                ? (JSON.parse(rawCompletions) as Record<string, DevotionalCompletion>)
                : {};
            return {
                guestUid: guestProfile?.uid || null,
                completions: Object.values(completionsMap),
            };
        } catch {
            return { guestUid: null, completions: [] };
        }
    },

    clearGuestData: async () => {
        try {
            await Promise.all([
                AsyncStorage.removeItem(GUEST_PROFILE_KEY),
                AsyncStorage.removeItem(GUEST_COMPLETIONS_KEY),
            ]);
        } catch (err) {
            console.warn('Failed clearing guest storage:', err);
        }
    },
}));
