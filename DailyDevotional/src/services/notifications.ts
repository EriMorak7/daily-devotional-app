import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { NotificationPreferences } from '../types';
import { getLocalTimezone, toLocalDateKey } from '../lib/date';

export type NotificationCategory =
    | 'dailyDevotional'
    | 'streakReminder'
    | 'newDevotional'
    | 'replies'
    | 'community';

export const NOTIFICATION_CHANNELS: Record<
    NotificationCategory,
    { id: string; name: string; description: string }
> = {
    dailyDevotional: {
        id: 'daily-devotional',
        name: 'Daily Devotional Reminder',
        description: 'Morning invitation to read today’s Scripture and devotional',
    },
    streakReminder: {
        id: 'streak-reminder',
        name: 'Evening Consistency Reminder',
        description: 'Gentle evening reminder when today’s devotional has not been completed yet',
    },
    newDevotional: {
        id: 'new-devotional',
        name: 'New Devotional Published',
        description: 'Alerts when a new devotional series or special entry is published',
    },
    replies: {
        id: 'reflection-activity',
        name: 'Reflection & Comment Replies',
        description: 'Notifications when someone replies to or encourages your reflection',
    },
    community: {
        id: 'community-activity',
        name: 'Church Community Activity',
        description: 'Updates on church-wide devotional reflections and prayer moments',
    },
};

// Configure foreground presentation
if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

/**
 * Queries current OS permission status and count of active scheduled notifications.
 */
export async function getNotificationDeviceStatus(): Promise<{
    permissionGranted: boolean;
    canAskAgain: boolean;
    scheduledCount: number;
}> {
    if (Platform.OS === 'web') {
        return { permissionGranted: false, canAskAgain: false, scheduledCount: 0 };
    }
    try {
        const [perm, scheduled] = await Promise.all([
            Notifications.getPermissionsAsync(),
            Notifications.getAllScheduledNotificationsAsync(),
        ]);
        return {
            permissionGranted: perm.status === 'granted',
            canAskAgain: Boolean(perm.canAskAgain),
            scheduledCount: scheduled.length,
        };
    } catch {
        return { permissionGranted: false, canAskAgain: true, scheduledCount: 0 };
    }
}

/**
 * Requests notification permissions and sets up all 5 Android notification channels.
 * Never swallows errors silently — returns `{ granted, error }`.
 */
export async function requestNotificationPermissions(): Promise<{
    granted: boolean;
    error?: string;
}> {
    if (Platform.OS === 'web') {
        return { granted: false, error: 'Push notifications are only supported on iOS and Android devices.' };
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                },
            });
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return {
                granted: false,
                error: 'Notification permission is disabled. Open your phone’s Settings > Expo Go > Notifications and turn on Allow Notifications.',
            };
        }

        if (Platform.OS === 'android') {
            for (const ch of Object.values(NOTIFICATION_CHANNELS)) {
                await Notifications.setNotificationChannelAsync(ch.id, {
                    name: ch.name,
                    description: ch.description,
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 200, 150, 200],
                    lightColor: '#9E5A3C',
                    sound: 'default',
                });
            }
        }

        return { granted: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to configure notification permissions.';
        console.error('Notification permission error:', err);
        return { granted: false, error: message };
    }
}

/**
 * Cancels all scheduled local notifications.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
    if (Platform.OS === 'web') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Syncs the user's notification category preferences with scheduled local notifications
 * (in the user's local timezone) and persists preferences to Firestore if signed in.
 */
export async function syncNotificationSchedules(options?: {
    devotionalTitle?: string;
    scriptureReference?: string;
    promptPermissionIfNeeded?: boolean;
}): Promise<{ ok: boolean; scheduledCount?: number; error?: string }> {
    const { notificationPrefs } = useSettingsStore.getState();
    const { user, isAuthenticated, isGuest } = useAuthStore.getState();

    // Persist preferences to user profile in Firestore if signed in
    if (isAuthenticated && !isGuest && user) {
        try {
            await setDoc(
                doc(db, 'users', user.uid),
                {
                    notificationPrefs,
                    timezone: getLocalTimezone(),
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
        } catch (err) {
            console.warn('Could not sync notification prefs to Firestore:', err);
        }
    }

    if (Platform.OS === 'web') {
        return { ok: true, scheduledCount: 0 };
    }

    const anyEnabled =
        notificationPrefs.dailyDevotional ||
        notificationPrefs.streakReminder ||
        notificationPrefs.newDevotional ||
        notificationPrefs.replies ||
        notificationPrefs.community;

    try {
        if (!anyEnabled) {
            await cancelAllScheduledNotifications();
            return { ok: true, scheduledCount: 0 };
        }

        const existingPerm = await Notifications.getPermissionsAsync();
        if (existingPerm.status !== 'granted') {
            if (!options?.promptPermissionIfNeeded) {
                return { ok: false, scheduledCount: 0, error: 'Tap "Enable / Test Notification" below to grant permission on this phone.' };
            }
            const req = await requestNotificationPermissions();
            if (!req.granted) {
                return { ok: false, scheduledCount: 0, error: req.error };
            }
        }

        await cancelAllScheduledNotifications();

        const [hourStr, minuteStr] = (notificationPrefs.reminderTime || '07:00').split(':');
        const hour = Math.min(23, Math.max(0, parseInt(hourStr || '7', 10) || 7));
        const minute = Math.min(59, Math.max(0, parseInt(minuteStr || '0', 10) || 0));

        let count = 0;

        // 1. Daily devotional morning reminder (local clock hour/minute)
        if (notificationPrefs.dailyDevotional) {
            const title = options?.devotionalTitle
                ? `Today's Devotional: ${options.devotionalTitle}`
                : 'Your Daily Devotional is Ready';
            const body = options?.scriptureReference
                ? `Begin a quiet moment in ${options.scriptureReference}.`
                : 'Take a few quiet minutes with Scripture and prayer today.';

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    sound: 'default',
                    data: {
                        category: 'dailyDevotional',
                        timezone: getLocalTimezone(),
                    },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour,
                    minute,
                    channelId:
                        Platform.OS === 'android'
                            ? NOTIFICATION_CHANNELS.dailyDevotional.id
                            : undefined,
                },
            });
            count += 1;
        }

        // 2. Evening streak / consistency reminder (20:00 local time) if not yet completed today
        if (notificationPrefs.streakReminder) {
            const todayKey = toLocalDateKey();
            const completedToday = Boolean(useAuthStore.getState().completions[todayKey]);

            if (!completedToday) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: 'A Quiet Moment Before Rest',
                        body: 'Spend a few minutes reading and reflecting on today’s devotional.',
                        sound: 'default',
                        data: {
                            category: 'streakReminder',
                            timezone: getLocalTimezone(),
                        },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DAILY,
                        hour: 20,
                        minute: 0,
                        channelId:
                            Platform.OS === 'android'
                                ? NOTIFICATION_CHANNELS.streakReminder.id
                                : undefined,
                    },
                });
                count += 1;
            }
        }

        return { ok: true, scheduledCount: count };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to schedule notifications.';
        console.error('Error scheduling notifications:', err);
        return { ok: false, scheduledCount: 0, error: message };
    }
}

/**
 * Fires a real local test notification 2 seconds from now so the user can verify
 * banner, sound, and permission on their physical phone immediately.
 */
export async function sendTestNotification(): Promise<{ ok: boolean; error?: string }> {
    if (Platform.OS === 'web') {
        return { ok: false, error: 'Test notifications require an iOS or Android device.' };
    }

    const perm = await requestNotificationPermissions();
    if (!perm.granted) {
        return { ok: false, error: perm.error };
    }

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '📖 Daily Devotional Reminder',
                body: 'Notifications are active! Your daily reminder is scheduled in your local timezone.',
                sound: 'default',
                data: { category: 'test' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 2,
                repeats: false,
            },
        });
        // Also ensure regular daily schedules are synced now that permission is granted
        await syncNotificationSchedules({ promptPermissionIfNeeded: false });
        return { ok: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not trigger test notification.';
        return { ok: false, error: message };
    }
}

/**
 * Updates a single notification preference category and immediately reschedules.
 */
export async function updateNotificationCategoryPreference(
    category: keyof Omit<NotificationPreferences, 'reminderTime'>,
    enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
    useSettingsStore.getState().setNotificationCategory(category, enabled);
    return syncNotificationSchedules({ promptPermissionIfNeeded: enabled });
}

/**
 * Updates the daily reminder time ("HH:MM") in local time and reschedules.
 */
export async function updateNotificationReminderTime(
    reminderTime: string
): Promise<{ ok: boolean; error?: string }> {
    useSettingsStore.getState().setNotificationTime(reminderTime);
    return syncNotificationSchedules({ promptPermissionIfNeeded: true });
}

/**
 * Backwards-compatible wrapper for scheduling today's devotional reminder without throwing.
 */
export async function scheduleDevotionalReminder(
    devotionalTitle: string,
    scripture: string
): Promise<void> {
    await syncNotificationSchedules({
        devotionalTitle,
        scriptureReference: scripture,
        promptPermissionIfNeeded: true,
    });
}
