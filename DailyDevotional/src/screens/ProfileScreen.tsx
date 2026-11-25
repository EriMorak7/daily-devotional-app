import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Switch,
    Alert,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useNotesStore } from '../store/notesStore';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import { GlossyButton } from '../components/GlossyElements';
import { FontSize, NotificationPreferences, scaleFont } from '../types';
import { signOut } from '../services/auth';
import {
    getNotificationDeviceStatus,
    sendTestNotification,
    syncNotificationSchedules,
    updateNotificationCategoryPreference,
    updateNotificationReminderTime,
} from '../services/notifications';
import { getLocalTimezone } from '../lib/date';

const REMINDER_TIMES = ['06:00', '07:00', '08:00', '09:00', '20:00'];

export default function ProfileScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets();
    const {
        darkMode,
        fontSize,
        notificationPrefs,
        toggleDarkMode,
        setFontSize,
    } = useSettingsStore();
    const { user, isGuest, completions } = useAuthStore();
    const { notes, highlights } = useNotesStore();
    const colors = darkMode ? Colors.dark : Colors.light;

    const [notificationFeedback, setNotificationFeedback] = useState<string | null>(null);
    const [permGranted, setPermGranted] = useState<boolean>(false);
    const [scheduledCount, setScheduledCount] = useState<number>(0);
    const [sendingTest, setSendingTest] = useState<boolean>(false);

    const refreshDeviceNotifStatus = useCallback(async () => {
        const st = await getNotificationDeviceStatus();
        setPermGranted(st.permissionGranted);
        setScheduledCount(st.scheduledCount);
    }, []);

    useEffect(() => {
        void refreshDeviceNotifStatus();
    }, [refreshDeviceNotifStatus, notificationPrefs]);

    const currentStreak = user?.progress?.currentStreak ?? user?.streak ?? 0;
    const longestStreak = user?.progress?.longestStreak ?? currentStreak;
    const totalCompleted = Math.max(
        user?.progress?.totalCompleted ?? 0,
        Object.keys(completions).length
    );
    const totalJournalEntries = notes.length + highlights.length;

    const scaledTitle = scaleFont(Typography.sizes.title, fontSize);
    const scaledBody = scaleFont(Typography.sizes.body, fontSize);
    const scaledCaption = scaleFont(Typography.sizes.caption, fontSize);

    const handleSignOut = () => {
        Alert.alert(
            isGuest ? 'Sign In to Account' : 'Sign Out',
            isGuest
                ? 'Your local journal entries and streak will automatically transfer when you sign in or create an account.'
                : 'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isGuest ? 'Continue to Sign In' : 'Sign Out',
                    style: isGuest ? 'default' : 'destructive',
                    onPress: () => void signOut(),
                },
            ]
        );
    };

    const handleToggleNotificationCategory = async (
        key: keyof Omit<NotificationPreferences, 'reminderTime'>,
        value: boolean
    ) => {
        setNotificationFeedback(null);
        const result = await updateNotificationCategoryPreference(key, value);
        await refreshDeviceNotifStatus();
        if (!result.ok && result.error) {
            setNotificationFeedback(result.error);
        } else {
            setNotificationFeedback(
                value ? 'Notification preference enabled & scheduled.' : 'Notification preference updated.'
            );
        }
    };

    const handleCycleReminderTime = async () => {
        const current = notificationPrefs.reminderTime || '07:00';
        const nextIdx = (REMINDER_TIMES.indexOf(current) + 1) % REMINDER_TIMES.length;
        const nextTime = REMINDER_TIMES[nextIdx];
        const result = await updateNotificationReminderTime(nextTime);
        await refreshDeviceNotifStatus();
        if (!result.ok && result.error) {
            setNotificationFeedback(result.error);
        } else {
            setNotificationFeedback(`Daily reminder time set to ${nextTime} (${getLocalTimezone()}).`);
        }
    };

    const handleSendTestNotification = async () => {
        setSendingTest(true);
        setNotificationFeedback(null);
        try {
            const res = await sendTestNotification();
            await refreshDeviceNotifStatus();
            if (res.ok) {
                setNotificationFeedback(
                    'Test notification scheduled! It will appear at the top of your screen in 2 seconds.'
                );
            } else if (res.error) {
                setNotificationFeedback(res.error);
                Alert.alert('Notifications Permission', res.error);
            }
        } finally {
            setSendingTest(false);
        }
    };

    const fontSizeOptions: { label: string; name: string; value: FontSize }[] = [
        { label: 'S', name: 'Small', value: 'small' },
        { label: 'M', name: 'Medium', value: 'medium' },
        { label: 'L', name: 'Large', value: 'large' },
        { label: 'XL', name: 'Extra Large', value: 'xlarge' },
    ];

    const notificationRows: {
        key: keyof Omit<NotificationPreferences, 'reminderTime'>;
        title: string;
        subtitle: string;
    }[] = [
        {
            key: 'dailyDevotional',
            title: 'Daily Devotional',
            subtitle: `Morning reminder (${notificationPrefs.reminderTime || '07:00'} local time)`,
        },
        {
            key: 'streakReminder',
            title: 'Streak Reminders',
            subtitle: 'Gentle evening nudge (20:00) if today’s reading is incomplete',
        },
        {
            key: 'newDevotional',
            title: 'New Devotional Published',
            subtitle: 'When a new church devotional series begins',
        },
        {
            key: 'replies',
            title: 'Reflection & Comment Activity',
            subtitle: 'Replies and encouragement on your reflections',
        },
        {
            key: 'community',
            title: 'Community Activity',
            subtitle: 'Church-wide devotional milestones',
        },
    ];

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.statusBar} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: Math.max(insets.top + 20, 52) },
                ]}
            >
                {/* ─── Identity (Name & Profile Photo) ─── */}
                <View style={styles.identitySection}>
                    <View
                        style={[
                            styles.avatarCircle,
                            { backgroundColor: colors.primarySoft, borderColor: colors.border },
                        ]}
                    >
                        {user?.photoURL ? (
                            <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
                        ) : (
                            <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                                {(user?.displayName || 'F').charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <Text style={[styles.nameText, { color: colors.text, fontSize: scaledTitle }]}>
                        {user?.displayName || 'Friend'}
                    </Text>
                    <Text style={[styles.emailText, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                        {isGuest
                            ? 'Guest session · Stored on this device'
                            : user?.email || ''}
                    </Text>
                </View>

                {/* ─── Spiritual Consistency Summary ─── */}
                <TouchableOpacity
                    style={[
                        styles.metricsGrid,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                    onPress={() => navigation.navigate('ReadingHistory')}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Devotional summary. Tap to view full reading history."
                >
                    <View style={styles.metricCell}>
                        <Text style={[styles.metricValue, { color: colors.primary }]}>
                            🔥 {currentStreak}
                        </Text>
                        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                            Current Streak
                        </Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.metricCell}>
                        <Text style={[styles.metricValue, { color: colors.text }]}>
                            {longestStreak}
                        </Text>
                        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                            Longest Streak
                        </Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.metricCell}>
                        <Text style={[styles.metricValue, { color: colors.sage }]}>
                            {totalCompleted}
                        </Text>
                        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                            Completed
                        </Text>
                    </View>
                    <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />
                    <View style={styles.metricCell}>
                        <Text style={[styles.metricValue, { color: colors.text }]}>
                            {totalJournalEntries}
                        </Text>
                        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                            Journal
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* ─── READING ─── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>
                        READING
                    </Text>
                    <View
                        style={[
                            styles.card,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <View style={styles.rowBetween}>
                            <Text style={[styles.rowTitle, { color: colors.text, fontSize: scaledBody }]}>
                                Font Size
                            </Text>
                            <Text style={[styles.rowMeta, { color: colors.primary }]}>
                                {fontSizeOptions.find((o) => o.value === fontSize)?.name || fontSize.toUpperCase()}
                            </Text>
                        </View>
                        <View style={styles.fontSizeRow}>
                            {fontSizeOptions.map((option) => {
                                const active = fontSize === option.value;
                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.fontSizeButton,
                                            {
                                                backgroundColor: active
                                                    ? colors.primary
                                                    : colors.surfaceElevated,
                                            },
                                        ]}
                                        onPress={() => setFontSize(option.value)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Set font size ${option.name}`}
                                    >
                                        <Text
                                            style={[
                                                styles.fontSizeButtonText,
                                                { color: active ? colors.onPrimary : colors.text },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Live Font Size Reading Preview */}
                        <View
                            style={[
                                styles.fontPreviewBox,
                                {
                                    backgroundColor: colors.prayerSurface,
                                    borderColor: colors.border,
                                    borderLeftColor: colors.primary,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.fontPreviewText,
                                    {
                                        color: colors.text,
                                        fontSize: scaledBody,
                                        lineHeight: Math.round(scaledBody * 1.65),
                                    },
                                ]}
                            >
                                “The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning.”
                            </Text>
                            <Text
                                style={[
                                    styles.fontPreviewRef,
                                    { color: colors.primary, fontSize: scaledCaption },
                                ]}
                            >
                                — Lamentations 3:22–23
                            </Text>
                        </View>

                        <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

                        <TouchableOpacity
                            style={styles.navRow}
                            onPress={() => navigation.navigate('ReadingHistory')}
                            accessibilityRole="button"
                            accessibilityLabel="Open reading history and calendar"
                        >
                            <Text style={[styles.rowTitle, { color: colors.text, fontSize: scaledBody }]}>
                                Reading History & Consistency
                            </Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ─── APPEARANCE ─── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>
                        APPEARANCE
                    </Text>
                    <View
                        style={[
                            styles.card,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <View style={styles.rowBetween}>
                            <View style={styles.notifTextCol}>
                                <Text style={[styles.rowTitle, { color: colors.text, fontSize: scaledBody }]}>
                                    Dark Mode
                                </Text>
                                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                                    Warm low-light theme for evening reading
                                </Text>
                            </View>
                            <Switch
                                value={darkMode}
                                onValueChange={toggleDarkMode}
                                trackColor={{ false: colors.border, true: colors.primaryLight }}
                                thumbColor={darkMode ? colors.primary : '#FFFFFF'}
                                accessibilityLabel="Toggle dark mode"
                            />
                        </View>
                    </View>
                </View>

                {/* ─── NOTIFICATIONS ─── */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>
                            NOTIFICATIONS
                        </Text>
                        <Text style={[styles.timezoneHint, { color: colors.textTertiary }]}>
                            {getLocalTimezone()}
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.card,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        {/* Live Device Notification Status & Test Button */}
                        <View
                            style={[
                                styles.notifStatusBanner,
                                {
                                    backgroundColor: permGranted
                                        ? colors.sageSoft
                                        : colors.primarySoft,
                                },
                            ]}
                        >
                            <View style={styles.notifStatusTop}>
                                <Ionicons
                                    name={
                                        permGranted
                                            ? 'checkmark-circle'
                                            : 'notifications-outline'
                                    }
                                    size={18}
                                    color={permGranted ? colors.sage : colors.primary}
                                />
                                <Text
                                    style={[
                                        styles.notifStatusTitle,
                                        { color: permGranted ? colors.sage : colors.primary },
                                    ]}
                                >
                                    {permGranted
                                        ? `Active on this phone · ${scheduledCount} scheduled`
                                        : 'Permission needed on this phone'}
                                </Text>
                            </View>

                            <GlossyButton
                                darkMode={darkMode}
                                onPress={() => void handleSendTestNotification()}
                                disabled={sendingTest}
                                accessibilityLabel="Send a test notification to this phone"
                            >
                                <Ionicons name="paper-plane-outline" size={15} color={colors.onPrimary} />
                                <Text style={[styles.testNotifBtnText, { color: colors.onPrimary }]}>
                                    {sendingTest
                                        ? 'Scheduling…'
                                        : permGranted
                                            ? 'Send Test Notification (2s)'
                                            : 'Enable & Test Notifications'}
                                </Text>
                            </GlossyButton>
                        </View>

                        {notificationFeedback && (
                            <Text style={[styles.feedbackText, { color: colors.primary }]}>
                                {notificationFeedback}
                            </Text>
                        )}

                        <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

                        <TouchableOpacity
                            style={styles.rowBetween}
                            onPress={() => void handleCycleReminderTime()}
                            accessibilityRole="button"
                            accessibilityLabel={`Reminder time ${notificationPrefs.reminderTime}. Tap to change.`}
                        >
                            <View style={styles.notifTextCol}>
                                <Text style={[styles.rowTitle, { color: colors.text, fontSize: scaledBody }]}>
                                    Daily Reminder Time
                                </Text>
                                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                                    Tap to cycle morning or evening time
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.timeBadge,
                                    { backgroundColor: colors.primarySoft },
                                ]}
                            >
                                <Text style={[styles.timeBadgeText, { color: colors.primary }]}>
                                    {notificationPrefs.reminderTime || '07:00'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {notificationRows.map((item) => (
                            <View key={item.key}>
                                <View
                                    style={[
                                        styles.rowDivider,
                                        { backgroundColor: colors.divider },
                                    ]}
                                />
                                <View style={styles.rowBetween}>
                                    <View style={styles.notifTextCol}>
                                        <Text style={[styles.rowTitle, { color: colors.text, fontSize: scaledBody }]}>
                                            {item.title}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.rowSubtitle,
                                                { color: colors.textSecondary, fontSize: scaledCaption },
                                            ]}
                                        >
                                            {item.subtitle}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={Boolean(notificationPrefs[item.key])}
                                        onValueChange={(val) =>
                                            void handleToggleNotificationCategory(item.key, val)
                                        }
                                        trackColor={{
                                            false: colors.border,
                                            true: colors.primaryLight,
                                        }}
                                        thumbColor={
                                            notificationPrefs[item.key]
                                                ? colors.primary
                                                : '#FFFFFF'
                                        }
                                        accessibilityLabel={`Toggle ${item.title} notifications`}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ─── ACCOUNT ─── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>
                        ACCOUNT
                    </Text>
                    <View
                        style={[
                            styles.card,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <View style={styles.rowBetween}>
                            <View style={styles.notifTextCol}>
                                <Text style={[styles.rowTitle, { color: colors.text, fontSize: scaledBody }]}>
                                    {isGuest ? 'Guest Account' : 'Church Member Account'}
                                </Text>
                                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                                    {isGuest
                                        ? 'Sign in to back up your journal and streak across devices'
                                        : user?.email}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.rowDivider, { backgroundColor: colors.divider }]} />

                        <TouchableOpacity
                            onPress={handleSignOut}
                            style={styles.signOutBtn}
                            accessibilityRole="button"
                            accessibilityLabel={isGuest ? 'Sign in or create account' : 'Sign out'}
                        >
                            <Ionicons
                                name={isGuest ? 'log-in-outline' : 'log-out-outline'}
                                size={18}
                                color={isGuest ? colors.primary : colors.error}
                            />
                            <Text
                                style={[
                                    styles.signOutText,
                                    { color: isGuest ? colors.primary : colors.error, fontSize: scaledBody },
                                ]}
                            >
                                {isGuest ? 'Sign In or Create Account' : 'Sign Out'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: 120,
    },
    identitySection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    avatarCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    avatarImage: {
        width: 72,
        height: 72,
    },
    avatarInitial: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.heading,
    },
    nameText: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.title,
    },
    emailText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: 4,
    },
    metricsGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderTopWidth: 1.5,
        paddingVertical: Spacing.lg,
        marginBottom: Spacing.xl,
        ...GlossyShadows.card,
    },
    metricCell: {
        flex: 1,
        alignItems: 'center',
    },
    metricValue: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.subtitle,
    },
    metricLabel: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: 10,
        marginTop: 4,
    },
    metricDivider: {
        width: 1,
        height: 28,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionEyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
    },
    timezoneHint: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
        marginBottom: Spacing.sm,
    },
    card: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderTopWidth: 1.5,
        padding: Spacing.lg,
        ...GlossyShadows.card,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: TouchTarget.minHeight,
    },
    notifTextCol: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    rowTitle: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
    },
    rowSubtitle: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: 2,
    },
    rowMeta: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    fontSizeRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    fontSizeButton: {
        flex: 1,
        minHeight: 40,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontSizeButtonText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    fontPreviewBox: {
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderLeftWidth: 3,
    },
    fontPreviewText: {
        fontFamily: Typography.fontFamily.serifItalic,
    },
    fontPreviewRef: {
        fontFamily: Typography.fontFamily.semiBold,
        marginTop: 6,
    },
    rowDivider: {
        height: 1,
        marginVertical: Spacing.md,
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 36,
    },
    notifStatusBanner: {
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
    },
    notifStatusTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    notifStatusTitle: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    testNotifBtn: {
        minHeight: 40,
        borderRadius: BorderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    testNotifBtnText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
        color: '#FFFFFF',
    },
    timeBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    timeBadgeText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    feedbackText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
        marginTop: Spacing.sm,
    },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 36,
        gap: Spacing.sm,
    },
    signOutText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
    },
});
