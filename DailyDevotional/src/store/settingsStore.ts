import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    UserSettings,
    FontSize,
    NotificationPreferences,
    DEFAULT_NOTIFICATION_PREFS,
} from '../types';

const SETTINGS_STORAGE_KEY = '@devotional_settings_v2';

interface SettingsState extends UserSettings {
    hydrated: boolean;
    hydrate: () => Promise<void>;
    setFontSize: (size: FontSize) => void;
    toggleDarkMode: () => void;
    setDarkMode: (value: boolean) => void;
    setNotificationEnabled: (enabled: boolean) => void;
    setNotificationTime: (time: string) => void;
    setNotificationCategory: (
        category: keyof Omit<NotificationPreferences, 'reminderTime'>,
        enabled: boolean
    ) => void;
    setNotificationPrefs: (prefs: Partial<NotificationPreferences>) => void;
    setReducedMotion: (reduced: boolean) => void;
}

async function persistSettings(state: UserSettings): Promise<void> {
    try {
        const payload: UserSettings = {
            fontSize: state.fontSize,
            darkMode: state.darkMode,
            notificationEnabled: state.notificationEnabled,
            notificationTime: state.notificationTime,
            notificationPrefs: state.notificationPrefs,
            reducedMotion: state.reducedMotion,
        };
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
        console.warn('Failed to persist settings:', err);
    }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    fontSize: 'medium',
    darkMode: false,
    notificationEnabled: true,
    notificationTime: '07:00',
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
    reducedMotion: false,
    hydrated: false,

    hydrate: async () => {
        try {
            const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<UserSettings>;
                const mergedPrefs: NotificationPreferences = {
                    ...DEFAULT_NOTIFICATION_PREFS,
                    ...(parsed.notificationPrefs || {}),
                };
                set({
                    fontSize: parsed.fontSize || 'medium',
                    darkMode: Boolean(parsed.darkMode),
                    notificationEnabled:
                        typeof parsed.notificationEnabled === 'boolean'
                            ? parsed.notificationEnabled
                            : mergedPrefs.dailyDevotional,
                    notificationTime: parsed.notificationTime || mergedPrefs.reminderTime || '07:00',
                    notificationPrefs: mergedPrefs,
                    reducedMotion: Boolean(parsed.reducedMotion),
                    hydrated: true,
                });
                return;
            }
        } catch (err) {
            console.warn('Failed to hydrate settings:', err);
        }
        set({ hydrated: true });
    },

    setFontSize: (size) => {
        set({ fontSize: size });
        void persistSettings(get());
    },

    toggleDarkMode: () => {
        set((state) => ({ darkMode: !state.darkMode }));
        void persistSettings(get());
    },

    setDarkMode: (value) => {
        set({ darkMode: value });
        void persistSettings(get());
    },

    setNotificationEnabled: (enabled) => {
        set((state) => ({
            notificationEnabled: enabled,
            notificationPrefs: {
                ...state.notificationPrefs,
                dailyDevotional: enabled,
            },
        }));
        void persistSettings(get());
    },

    setNotificationTime: (time) => {
        set((state) => ({
            notificationTime: time,
            notificationPrefs: {
                ...state.notificationPrefs,
                reminderTime: time,
            },
        }));
        void persistSettings(get());
    },

    setNotificationCategory: (category, enabled) => {
        set((state) => {
            const nextPrefs: NotificationPreferences = {
                ...state.notificationPrefs,
                [category]: enabled,
            };
            return {
                notificationPrefs: nextPrefs,
                notificationEnabled: nextPrefs.dailyDevotional,
            };
        });
        void persistSettings(get());
    },

    setNotificationPrefs: (prefs) => {
        set((state) => {
            const nextPrefs: NotificationPreferences = {
                ...state.notificationPrefs,
                ...prefs,
            };
            return {
                notificationPrefs: nextPrefs,
                notificationEnabled: nextPrefs.dailyDevotional,
                notificationTime: nextPrefs.reminderTime,
            };
        });
        void persistSettings(get());
    },

    setReducedMotion: (reduced) => {
        set({ reducedMotion: reduced });
        void persistSettings(get());
    },
}));
