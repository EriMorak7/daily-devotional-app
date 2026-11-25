import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDevotionalStore } from '../store/devotionalStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useNotesStore } from '../store/notesStore';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import { GlossyCard, GlossyButton } from '../components/GlossyElements';
import { CommunityComment, scaleFont } from '../types';
import {
    formatEditorialDate,
    getCurrentWeekDays,
    getLocalGreeting,
    toLocalDateKey,
} from '../lib/date';
import { didMissYesterday } from '../lib/streak';
import { fetchDevotionalComments, fetchDevotionalCompletionCount } from '../services/community';
import { syncNotificationSchedules } from '../services/notifications';
import { DevotionalSkeleton, EmptyState, ErrorState } from '../components/StateViews';

export default function HomeScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets();
    const {
        todayDevotional,
        activeSeries,
        config,
        isLoading,
        isRefreshing,
        isOfflineCache,
        error,
        loadDevotionals,
        setCurrentDevotional,
    } = useDevotionalStore();

    const darkMode = useSettingsStore((s) => s.darkMode);
    const fontSize = useSettingsStore((s) => s.fontSize);
    const { user, completions } = useAuthStore();
    const notes = useNotesStore((s) => s.notes);

    const colors = darkMode ? Colors.dark : Colors.light;
    const todayKey = toLocalDateKey();

    const scaledGreeting = scaleFont(Typography.sizes.title, fontSize);
    const scaledHeading = scaleFont(Typography.sizes.heading, fontSize);
    const scaledSubtitle = scaleFont(Typography.sizes.subtitle, fontSize);
    const scaledBody = scaleFont(Typography.sizes.body, fontSize);
    const scaledCaption = scaleFont(Typography.sizes.caption, fontSize);

    const [recentReflections, setRecentReflections] = useState<CommunityComment[]>([]);
    const [churchCompletionCount, setChurchCompletionCount] = useState<number>(0);

    useEffect(() => {
        void loadDevotionals();
    }, [loadDevotionals]);

    // Prompt for permission if enabled & schedule daily + evening reminders in local timezone
    useEffect(() => {
        void syncNotificationSchedules({
            devotionalTitle: todayDevotional?.title,
            scriptureReference: todayDevotional?.scriptureReference,
            promptPermissionIfNeeded: true,
        });
    }, [todayDevotional?.id]);

    const loadCommunityPreview = useCallback(async (devId: string) => {
        try {
            const [comments, count] = await Promise.all([
                fetchDevotionalComments(devId, 5),
                fetchDevotionalCompletionCount(devId),
            ]);
            setRecentReflections(comments.filter((c) => !c.parentId).slice(0, 3));
            setChurchCompletionCount(count);
        } catch {
            // Non-blocking preview
        }
    }, []);

    useEffect(() => {
        if (todayDevotional?.id) {
            void loadCommunityPreview(todayDevotional.id);
        }
    }, [todayDevotional?.id, loadCommunityPreview]);

    const handleRefresh = () => {
        void loadDevotionals({ forceRefresh: true });
        if (todayDevotional?.id) {
            void loadCommunityPreview(todayDevotional.id);
        }
    };

    const openReader = (options?: { focusReflection?: boolean; focusCommunity?: boolean }) => {
        if (!todayDevotional) return;
        setCurrentDevotional(todayDevotional);
        navigation.navigate('Devotional', {
            devotional: todayDevotional,
            focusReflection: options?.focusReflection,
            focusCommunity: options?.focusCommunity,
        });
    };

    const weekDays = useMemo(() => getCurrentWeekDays(todayKey), [todayKey]);
    const completedToday = Boolean(completions[todayKey]);
    const currentStreak = user?.progress?.currentStreak ?? user?.streak ?? 0;
    const missedYesterday = didMissYesterday(user?.progress, todayKey) && !completedToday;

    const todaysSavedReflection = useMemo(() => {
        if (!todayDevotional) return undefined;
        return notes.find(
            (n) => n.devotionalId === todayDevotional.id && n.kind === 'reflection'
        );
    }, [notes, todayDevotional]);

    // Weekly spiritual growth summary
    const weeklySummary = useMemo(() => {
        const weekKeySet = new Set(weekDays.map((d) => d.dateKey));
        const weekCompletions = Object.values(completions).filter((c) => weekKeySet.has(c.date));
        const weekReflections = notes.filter(
            (n) => n.devotionalDate && weekKeySet.has(n.devotionalDate)
        );
        return {
            completedCount: weekCompletions.length,
            reflectionsCount: weekReflections.length,
        };
    }, [weekDays, completions, notes]);

    const firstName = useMemo(() => {
        const name = user?.displayName?.trim();
        if (!name || name === 'Guest' || name === 'User') return 'Friend';
        return name.split(' ')[0];
    }, [user?.displayName]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.statusBar} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: Math.max(insets.top + 16, 48) },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* ─── Top Greeting & Date ─── */}
                <View style={styles.greetingSection}>
                    <View style={styles.greetingTopRow}>
                        <View style={styles.greetingLeft}>
                            <Text style={[styles.churchEyebrow, { color: colors.textTertiary }]}>
                                {(config.churchName || 'DAILY DEVOTIONAL').toUpperCase()}
                            </Text>
                            <Text
                                style={[
                                    styles.greetingTitle,
                                    {
                                        color: colors.text,
                                        fontSize: scaledGreeting,
                                        lineHeight: Math.round(scaledGreeting * 1.35),
                                    },
                                ]}
                            >
                                {getLocalGreeting()}, {firstName}
                            </Text>
                            <Text style={[styles.dateText, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                                {formatEditorialDate(todayKey)}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.streakPill,
                                GlossyShadows.pill,
                                {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                    borderTopColor: colors.borderHighlight,
                                },
                            ]}
                            onPress={() => navigation.navigate('ReadingHistory')}
                            accessibilityRole="button"
                            accessibilityLabel={`${currentStreak} day devotional streak. Tap to view reading history.`}
                        >
                            <Text style={styles.streakEmoji}>🔥</Text>
                            <Text style={[styles.streakCount, { color: colors.text }]}>
                                {currentStreak}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {isOfflineCache && (
                        <View style={[styles.offlineBanner, { backgroundColor: colors.surfaceElevated }]}>
                            <Ionicons name="cloud-offline-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
                                Offline mode · Reading saved devotional
                            </Text>
                        </View>
                    )}
                </View>

                {/* ─── Main Content States ─── */}
                {isLoading && !todayDevotional ? (
                    <DevotionalSkeleton darkMode={darkMode} />
                ) : error && !todayDevotional ? (
                    <ErrorState
                        title="Could not load today’s devotional"
                        message={error}
                        actionLabel="Refresh"
                        onAction={handleRefresh}
                        colors={colors}
                    />
                ) : !todayDevotional ? (
                    <EmptyState
                        title="Your next devotional isn’t available yet."
                        message="Check back soon or refresh when your church publishes the next daily reading."
                        actionLabel="Refresh"
                        onAction={handleRefresh}
                        icon="sunny-outline"
                        colors={colors}
                    />
                ) : (
                    <>
                        {/* ─── Hero Today's Devotional ─── */}
                        <GlossyCard darkMode={darkMode} style={styles.heroSection}>
                            <View style={styles.dayMetaRow}>
                                <Text style={[styles.dayBadgeText, { color: colors.primary }]}>
                                    DAY {todayDevotional.dayNumber}
                                    {activeSeries ? ` · ${activeSeries.title.toUpperCase()}` : ''}
                                </Text>
                                {completedToday && (
                                    <View style={[styles.completedBadge, { backgroundColor: colors.sageSoft }]}>
                                        <Ionicons name="checkmark-circle" size={14} color={colors.sage} />
                                        <Text style={[styles.completedBadgeText, { color: colors.sage }]}>
                                            Completed
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <Text
                                style={[
                                    styles.devotionalTitle,
                                    {
                                        color: colors.text,
                                        fontSize: scaledHeading,
                                        lineHeight: Math.round(scaledHeading * 1.3),
                                    },
                                ]}
                            >
                                {todayDevotional.title}
                            </Text>

                            <Text style={[styles.scriptureRef, { color: colors.primary, fontSize: scaledCaption }]}>
                                {todayDevotional.scriptureReference}
                            </Text>

                            <View
                                style={[
                                    styles.scriptureQuoteBox,
                                    { borderLeftColor: colors.primaryLight },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.scriptureExcerpt,
                                        {
                                            color: colors.textSecondary,
                                            fontSize: scaledBody,
                                            lineHeight: Math.round(scaledBody * 1.6),
                                        },
                                    ]}
                                    numberOfLines={4}
                                >
                                    “{todayDevotional.scriptureText}”
                                </Text>
                            </View>

                            <GlossyButton
                                darkMode={darkMode}
                                onPress={() => openReader()}
                                style={{ marginTop: Spacing.xl }}
                                accessibilityLabel={
                                    completedToday
                                        ? 'Read today’s devotional again'
                                        : 'Begin reading today’s devotional'
                                }
                            >
                                <Text style={[styles.primaryCtaText, { color: colors.onPrimary }]}>
                                    {completedToday ? 'READ AGAIN' : 'BEGIN READING'}
                                </Text>
                                <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
                            </GlossyButton>
                        </GlossyCard>

                        {/* ─── YOUR JOURNEY (Weekly Consistency & Streak) ─── */}
                        <GlossyCard
                            darkMode={darkMode}
                            style={styles.sectionBlock}
                            onPress={() => navigation.navigate('ReadingHistory')}
                            accessibilityLabel="Your weekly devotional consistency. Tap to open full reading history."
                        >
                            <View style={styles.sectionHeaderRow}>
                                <View>
                                    <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>
                                        YOUR JOURNEY
                                    </Text>
                                    <Text style={[styles.sectionHeading, { color: colors.text, fontSize: scaledSubtitle }]}>
                                        Weekly Reading Consistency
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                            </View>

                            {/* M T W T F S S row */}
                            <View style={styles.weekRow}>
                                {weekDays.map((day) => {
                                    const isDone = Boolean(completions[day.dateKey]);
                                    return (
                                        <View key={day.dateKey} style={styles.weekDayCol}>
                                            <Text
                                                style={[
                                                    styles.weekDayLabel,
                                                    {
                                                        color: day.isToday
                                                            ? colors.primary
                                                            : colors.textTertiary,
                                                        fontFamily: day.isToday
                                                            ? Typography.fontFamily.bold
                                                            : Typography.fontFamily.medium,
                                                    },
                                                ]}
                                            >
                                                {day.shortLabel}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.weekCircle,
                                                    isDone
                                                        ? {
                                                              backgroundColor: colors.sage,
                                                              borderColor: colors.sage,
                                                          }
                                                        : day.isToday
                                                            ? {
                                                                  backgroundColor: colors.primarySoft,
                                                                  borderColor: colors.primary,
                                                              }
                                                            : {
                                                                  backgroundColor: 'transparent',
                                                                  borderColor: colors.border,
                                                              },
                                                ]}
                                            >
                                                {isDone ? (
                                                    <Ionicons name="checkmark" size={15} color={colors.onPrimary} />
                                                ) : (
                                                    <Text
                                                        style={[
                                                            styles.weekDateNumber,
                                                            {
                                                                color: day.isToday
                                                                    ? colors.primary
                                                                    : colors.textTertiary,
                                                            },
                                                        ]}
                                                    >
                                                        {day.dayOfMonth}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={[styles.streakSummaryRow, { borderTopColor: colors.divider }]}>
                                <Text style={[styles.streakSummaryText, { color: colors.text, fontSize: scaledCaption }]}>
                                    🔥 {currentStreak} day streak
                                </Text>
                                <Text style={[styles.weekRecapMeta, { color: colors.textSecondary }]}>
                                    {weeklySummary.completedCount} read · {weeklySummary.reflectionsCount} reflection
                                    {weeklySummary.reflectionsCount === 1 ? '' : 's'} this week
                                </Text>
                            </View>

                            {missedYesterday && (
                                <Text style={[styles.gentleEncouragement, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                                    Missed yesterday? That’s okay. Grace is new every morning — start again today.
                                </Text>
                            )}
                        </GlossyCard>

                        {/* ─── TODAY'S REFLECTION ─── */}
                        <GlossyCard darkMode={darkMode} soft style={styles.sectionBlock}>
                            <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>
                                TODAY’S REFLECTION
                            </Text>
                            <Text
                                style={[
                                    styles.reflectionPromptText,
                                    {
                                        color: colors.text,
                                        fontSize: scaledSubtitle,
                                        lineHeight: Math.round(scaledSubtitle * 1.4),
                                    },
                                ]}
                            >
                                “{todayDevotional.reflectionPrompt}”
                            </Text>

                            {todaysSavedReflection ? (
                                <View style={styles.savedReflectionPreview}>
                                    <Text
                                        style={[
                                            styles.savedReflectionBody,
                                            {
                                                color: colors.textSecondary,
                                                fontSize: scaledBody,
                                                lineHeight: Math.round(scaledBody * 1.5),
                                            },
                                        ]}
                                        numberOfLines={3}
                                    >
                                        {todaysSavedReflection.content}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.inlineLinkBtn}
                                        onPress={() => openReader({ focusReflection: true })}
                                        accessibilityRole="button"
                                        accessibilityLabel="Edit your reflection"
                                    >
                                        <Text style={[styles.inlineLinkText, { color: colors.primary }]}>
                                            Edit reflection →
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[
                                        styles.outlineCta,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    onPress={() => openReader({ focusReflection: true })}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel="Write reflection for today’s devotional"
                                >
                                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                                    <Text style={[styles.outlineCtaText, { color: colors.text }]}>
                                        Write reflection
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </GlossyCard>

                        {/* ─── COMMUNITY PREVIEW ─── */}
                        <GlossyCard darkMode={darkMode} style={styles.sectionBlock}>
                            <View style={styles.sectionHeaderRow}>
                                <View>
                                    <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>
                                        COMMUNITY
                                    </Text>
                                    <Text style={[styles.sectionHeading, { color: colors.text, fontSize: scaledSubtitle }]}>
                                        Seeking God Together
                                    </Text>
                                </View>
                                {churchCompletionCount > 0 && (
                                    <Text style={[styles.communityCountLabel, { color: colors.sage }]}>
                                        {churchCompletionCount} completed today
                                    </Text>
                                )}
                            </View>

                            {recentReflections.length === 0 ? (
                                <Text style={[styles.emptyCommunityHint, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                                    Be the first to share what today’s devotional taught you.
                                </Text>
                            ) : (
                                <View style={styles.communityPreviewList}>
                                    {recentReflections.map((item) => (
                                        <View
                                            key={item.id}
                                            style={[
                                                styles.communityQuoteRow,
                                                { borderBottomColor: colors.divider },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.communityQuoteText,
                                                    {
                                                        color: colors.text,
                                                        fontSize: scaledBody,
                                                        lineHeight: Math.round(scaledBody * 1.45),
                                                    },
                                                ]}
                                                numberOfLines={2}
                                            >
                                                “{item.content}”
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.communityQuoteAuthor,
                                                    { color: colors.textTertiary },
                                                ]}
                                            >
                                                — {item.authorName}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.inlineLinkBtn}
                                onPress={() => openReader({ focusCommunity: true })}
                                accessibilityRole="button"
                                accessibilityLabel="Open today’s community reflections"
                            >
                                <Text style={[styles.inlineLinkText, { color: colors.primary }]}>
                                    Join today’s conversation →
                                </Text>
                            </TouchableOpacity>
                        </GlossyCard>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xxxl,
    },
    greetingSection: {
        marginBottom: Spacing.xl,
    },
    greetingTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    greetingLeft: {
        flex: 1,
        paddingRight: Spacing.md,
    },
    churchEyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    greetingTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.title,
        lineHeight: Typography.lineHeights.title,
    },
    dateText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: 2,
    },
    streakPill: {
        minHeight: TouchTarget.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        gap: 6,
    },
    streakEmoji: {
        fontSize: 15,
    },
    streakCount: {
        fontFamily: Typography.fontFamily.bold,
        fontSize: Typography.sizes.body,
    },
    offlineBanner: {
        marginTop: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
        gap: Spacing.xs,
    },
    offlineText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
    },
    // Hero Today Card
    heroSection: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        padding: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    dayMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    dayBadgeText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.5,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
        gap: 4,
    },
    completedBadgeText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    devotionalTitle: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.heading,
        lineHeight: Typography.lineHeights.heading,
        marginTop: 2,
    },
    scriptureRef: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
        marginTop: Spacing.sm,
    },
    scriptureQuoteBox: {
        marginTop: Spacing.lg,
        paddingLeft: Spacing.md,
        borderLeftWidth: 2,
    },
    scriptureExcerpt: {
        fontFamily: Typography.fontFamily.serifItalic,
        fontSize: Typography.sizes.body,
        lineHeight: 25,
    },
    primaryCta: {
        marginTop: Spacing.xl,
        minHeight: 50,
        borderRadius: BorderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    primaryCtaText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
        letterSpacing: 1.2,
        color: '#FFFFFF',
    },
    // Sections
    sectionBlock: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        padding: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    sectionEyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.4,
    },
    sectionHeading: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.subtitle,
        marginTop: 2,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    weekDayCol: {
        alignItems: 'center',
        gap: Spacing.xs,
    },
    weekDayLabel: {
        fontSize: Typography.sizes.micro,
    },
    weekCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    weekDateNumber: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    streakSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.md,
        borderTopWidth: 1,
    },
    streakSummaryText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    weekRecapMeta: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
    },
    gentleEncouragement: {
        fontFamily: Typography.fontFamily.serifItalic,
        fontSize: Typography.sizes.caption,
        marginTop: Spacing.sm,
        lineHeight: 19,
    },
    reflectionPromptText: {
        fontFamily: Typography.fontFamily.serifMedium,
        fontSize: Typography.sizes.subtitle,
        lineHeight: 26,
        marginTop: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    savedReflectionPreview: {
        gap: Spacing.sm,
    },
    savedReflectionBody: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 23,
    },
    outlineCta: {
        minHeight: TouchTarget.minHeight,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    outlineCtaText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
    },
    inlineLinkBtn: {
        paddingVertical: Spacing.xs,
        alignSelf: 'flex-start',
    },
    inlineLinkText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    communityCountLabel: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    emptyCommunityHint: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        lineHeight: 20,
        marginBottom: Spacing.md,
    },
    communityPreviewList: {
        marginBottom: Spacing.md,
        gap: Spacing.md,
    },
    communityQuoteRow: {
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
    },
    communityQuoteText: {
        fontFamily: Typography.fontFamily.serifItalic,
        fontSize: Typography.sizes.body,
        lineHeight: 23,
    },
    communityQuoteAuthor: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
        marginTop: 4,
    },
});
