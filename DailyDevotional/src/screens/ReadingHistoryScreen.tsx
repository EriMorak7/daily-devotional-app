import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useDevotionalStore } from '../store/devotionalStore';
import { useNotesStore } from '../store/notesStore';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import {
    formatShortDate,
    getCurrentWeekDays,
    getMonthCalendarGrid,
    toLocalDateKey,
} from '../lib/date';

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ReadingHistoryScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets();
    const darkMode = useSettingsStore((s) => s.darkMode);
    const { user, completions } = useAuthStore();
    const { devotionals, setCurrentDevotional } = useDevotionalStore();
    const notes = useNotesStore((s) => s.notes);

    const colors = darkMode ? Colors.dark : Colors.light;
    const now = new Date();
    const [calendarYear, setCalendarYear] = useState(now.getFullYear());
    const [calendarMonth, setCalendarMonth] = useState(now.getMonth());

    const todayKey = toLocalDateKey();
    const weekDays = useMemo(() => getCurrentWeekDays(todayKey), [todayKey]);

    const currentStreak = user?.progress?.currentStreak ?? user?.streak ?? 0;
    const longestStreak = user?.progress?.longestStreak ?? currentStreak;
    const totalCompleted = Math.max(
        user?.progress?.totalCompleted ?? 0,
        Object.keys(completions).length
    );

    const calendarGrid = useMemo(
        () => getMonthCalendarGrid(calendarYear, calendarMonth),
        [calendarYear, calendarMonth]
    );

    const monthlyCompletedCount = useMemo(() => {
        const prefix = `${calendarYear}-${calendarMonth + 1 < 10 ? '0' : ''}${calendarMonth + 1}-`;
        return Object.keys(completions).filter((k) => k.startsWith(prefix)).length;
    }, [completions, calendarYear, calendarMonth]);

    const weeklyCompletedCount = useMemo(() => {
        return weekDays.filter((d) => Boolean(completions[d.dateKey])).length;
    }, [weekDays, completions]);

    const weeklyReflectionsCount = useMemo(() => {
        const weekSet = new Set(weekDays.map((d) => d.dateKey));
        return notes.filter((n) => n.devotionalDate && weekSet.has(n.devotionalDate)).length;
    }, [weekDays, notes]);

    const sortedHistory = useMemo(() => {
        return Object.values(completions).sort((a, b) => b.date.localeCompare(a.date));
    }, [completions]);

    const handlePreviousMonth = () => {
        if (calendarMonth === 0) {
            setCalendarYear((y) => y - 1);
            setCalendarMonth(11);
        } else {
            setCalendarMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (calendarMonth === 11) {
            setCalendarYear((y) => y + 1);
            setCalendarMonth(0);
        } else {
            setCalendarMonth((m) => m + 1);
        }
    };

    const openCompletedDevotional = (devotionalId: string) => {
        const found = devotionals.find((d) => d.id === devotionalId);
        if (found) {
            setCurrentDevotional(found);
            navigation.navigate('Devotional', { devotional: found });
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.statusBar} />

            {/* Top Header */}
            <View
                style={[
                    styles.topBar,
                    {
                        paddingTop: Math.max(insets.top + 8, 42),
                        backgroundColor: colors.background,
                        borderBottomColor: colors.divider,
                    },
                ]}
            >
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.topBarTitle, { color: colors.text }]}>Reading History</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ─── Top Metrics Row ─── */}
                <View style={styles.statsRow}>
                    <View
                        style={[
                            styles.statCard,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <Text style={[styles.statNumber, { color: colors.primary }]}>
                            🔥 {currentStreak}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Current Streak
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statCard,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <Text style={[styles.statNumber, { color: colors.text }]}>
                            {longestStreak}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Longest Streak
                        </Text>
                    </View>

                    <View
                        style={[
                            styles.statCard,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <Text style={[styles.statNumber, { color: colors.sage }]}>
                            ✓ {totalCompleted}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                            Completed
                        </Text>
                    </View>
                </View>

                {/* ─── Weekly Spiritual Growth Recap ─── */}
                <View
                    style={[
                        styles.card,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    <View style={styles.cardHeaderRow}>
                        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR WEEK</Text>
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                            {weeklyCompletedCount} of 7 days
                        </Text>
                    </View>

                    <View style={styles.weekRow}>
                        {weekDays.map((day) => {
                            const done = Boolean(completions[day.dateKey]);
                            return (
                                <View key={day.dateKey} style={styles.weekCol}>
                                    <Text
                                        style={[
                                            styles.weekHeaderChar,
                                            { color: colors.textTertiary },
                                        ]}
                                    >
                                        {day.shortLabel}
                                    </Text>
                                    <View
                                        style={[
                                            styles.weekDot,
                                            done
                                                ? {
                                                      backgroundColor: colors.sage,
                                                      borderColor: colors.sage,
                                                  }
                                                : {
                                                      backgroundColor: 'transparent',
                                                      borderColor: day.isToday
                                                          ? colors.primary
                                                          : colors.border,
                                                  },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.weekMark,
                                                {
                                                    color: done
                                                        ? colors.onPrimary
                                                        : colors.textSecondary,
                                                },
                                            ]}
                                        >
                                            {done ? '✓' : '○'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    <Text style={[styles.recapFootnote, { color: colors.textSecondary }]}>
                        ✓ {weeklyCompletedCount} devotional{weeklyCompletedCount === 1 ? '' : 's'} completed · 📝{' '}
                        {weeklyReflectionsCount} reflection{weeklyReflectionsCount === 1 ? '' : 's'} written this week
                    </Text>
                </View>

                {/* ─── Monthly Consistency Calendar ─── */}
                <View
                    style={[
                        styles.card,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    <View style={styles.monthNavRow}>
                        <TouchableOpacity
                            onPress={handlePreviousMonth}
                            style={styles.monthNavBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Previous month"
                        >
                            <Ionicons name="chevron-back" size={20} color={colors.text} />
                        </TouchableOpacity>

                        <View style={styles.monthTitleCenter}>
                            <Text style={[styles.monthTitle, { color: colors.text }]}>
                                {calendarGrid.monthTitle.toUpperCase()}
                            </Text>
                            <Text style={[styles.monthSub, { color: colors.textSecondary }]}>
                                {monthlyCompletedCount} day{monthlyCompletedCount === 1 ? '' : 's'} in the Word
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleNextMonth}
                            style={styles.monthNavBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Next month"
                        >
                            <Ionicons name="chevron-forward" size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* S M T W T F S headers */}
                    <View style={styles.calHeaderRow}>
                        {WEEKDAY_HEADERS.map((h, i) => (
                            <Text
                                key={i}
                                style={[styles.calHeaderCell, { color: colors.textTertiary }]}
                            >
                                {h}
                            </Text>
                        ))}
                    </View>

                    {calendarGrid.weeks.map((week, wIdx) => (
                        <View key={wIdx} style={styles.calWeekRow}>
                            {week.map((cell, cIdx) => {
                                if (!cell) {
                                    return <View key={cIdx} style={styles.calCell} />;
                                }
                                const done = Boolean(completions[cell.dateKey]);
                                return (
                                    <View key={cell.dateKey} style={styles.calCell}>
                                        <View
                                            style={[
                                                styles.calDayCircle,
                                                done
                                                    ? {
                                                          backgroundColor: colors.sage,
                                                          borderColor: colors.sage,
                                                      }
                                                    : cell.isToday
                                                        ? {
                                                              backgroundColor: colors.primarySoft,
                                                              borderColor: colors.primary,
                                                              borderWidth: 1.5,
                                                          }
                                                        : undefined,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.calDayText,
                                                    {
                                                        color: done
                                                            ? colors.onPrimary
                                                            : cell.isFuture
                                                                ? colors.textTertiary
                                                                : colors.text,
                                                    },
                                                ]}
                                            >
                                                {done ? '✓' : cell.day}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>

                {/* ─── Completed Devotional History ─── */}
                <View style={styles.historyListSection}>
                    <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                        COMPLETED DEVOTIONALS
                    </Text>

                    {sortedHistory.length === 0 ? (
                        <Text style={[styles.emptyHistoryText, { color: colors.textSecondary }]}>
                            When you mark a daily devotional complete, it will appear in your history here.
                        </Text>
                    ) : (
                        sortedHistory.map((item) => (
                            <TouchableOpacity
                                key={item.date}
                                style={[
                                    styles.historyItemCard,
                                    {
                                        backgroundColor: colors.surface,
                                        borderColor: colors.border,
                                    },
                                ]}
                                onPress={() => openCompletedDevotional(item.devotionalId)}
                                activeOpacity={0.8}
                            >
                                <View
                                    style={[
                                        styles.historyCheckCircle,
                                        { backgroundColor: colors.sageSoft },
                                    ]}
                                >
                                    <Ionicons name="checkmark" size={16} color={colors.sage} />
                                </View>
                                <View style={styles.historyItemBody}>
                                    <Text
                                        style={[
                                            styles.historyItemDate,
                                            { color: colors.textTertiary },
                                        ]}
                                    >
                                        {formatShortDate(item.date)}
                                        {item.dayNumber ? ` · Day ${item.dayNumber}` : ''}
                                    </Text>
                                    <Text
                                        style={[styles.historyItemTitle, { color: colors.text }]}
                                        numberOfLines={1}
                                    >
                                        {item.devotionalTitle || 'Daily Devotional'}
                                    </Text>
                                    {item.scriptureReference ? (
                                        <Text
                                            style={[
                                                styles.historyItemScripture,
                                                { color: colors.primary },
                                            ]}
                                        >
                                            {item.scriptureReference}
                                        </Text>
                                    ) : null}
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={colors.textTertiary}
                                />
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
    },
    backBtn: {
        minWidth: TouchTarget.minWidth,
        minHeight: TouchTarget.minHeight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.subtitle,
    },
    scrollContent: {
        padding: Spacing.xl,
        paddingBottom: 90,
        gap: Spacing.lg,
    },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    statCard: {
        flex: 1,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderTopWidth: 1.5,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.sm,
        alignItems: 'center',
        ...GlossyShadows.card,
    },
    statNumber: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.title,
    },
    statLabel: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
        marginTop: 4,
    },
    card: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderTopWidth: 1.5,
        padding: Spacing.xl,
        ...GlossyShadows.card,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    eyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.4,
    },
    cardMeta: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    weekCol: {
        alignItems: 'center',
        gap: 6,
    },
    weekHeaderChar: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
    },
    weekDot: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    weekMark: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    recapFootnote: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: Spacing.xs,
    },
    monthNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    monthNavBtn: {
        minWidth: TouchTarget.minWidth,
        minHeight: TouchTarget.minHeight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    monthTitleCenter: {
        alignItems: 'center',
    },
    monthTitle: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
        letterSpacing: 1.2,
    },
    monthSub: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
        marginTop: 2,
    },
    calHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    calHeaderCell: {
        flex: 1,
        textAlign: 'center',
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    calWeekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 4,
    },
    calCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 36,
    },
    calDayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calDayText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    historyListSection: {
        gap: Spacing.sm,
    },
    emptyHistoryText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        lineHeight: 20,
        marginTop: Spacing.xs,
    },
    historyItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.md,
    },
    historyCheckCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    historyItemBody: {
        flex: 1,
    },
    historyItemDate: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
    },
    historyItemTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.body,
        marginTop: 2,
    },
    historyItemScripture: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
        marginTop: 2,
    },
});
