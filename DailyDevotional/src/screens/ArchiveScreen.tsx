import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SectionList,
    StatusBar,
    TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDevotionalStore } from '../store/devotionalStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import { Devotional, scaleFont } from '../types';
import { formatShortDate, getMonthKeyAndLabel } from '../lib/date';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';

type BrowseMode = 'month' | 'series' | 'date';

export default function ArchiveScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets();
    const {
        devotionals,
        seriesList,
        isLoading,
        error,
        hasMoreArchive,
        loadDevotionals,
        loadMoreArchive,
        setCurrentDevotional,
    } = useDevotionalStore();
    const darkMode = useSettingsStore((s) => s.darkMode);
    const fontSize = useSettingsStore((s) => s.fontSize);
    const scaledHeading = scaleFont(Typography.sizes.heading, fontSize);
    const scaledBody = scaleFont(Typography.sizes.body, fontSize);
    const scaledCaption = scaleFont(Typography.sizes.caption, fontSize);
    const completions = useAuthStore((s) => s.completions);

    const colors = darkMode ? Colors.dark : Colors.light;

    const [browseMode, setBrowseMode] = useState<BrowseMode>('month');
    const [searchQuery, setSearchQuery] = useState('');

    const seriesTitleById = useMemo(() => {
        const map = new Map<string, string>();
        seriesList.forEach((s) => map.set(s.id, s.title));
        return map;
    }, [seriesList]);

    const completedDevotionalIds = useMemo(() => {
        const ids = new Set<string>();
        Object.values(completions).forEach((c) => {
            if (c.devotionalId) ids.add(c.devotionalId);
        });
        return ids;
    }, [completions]);

    const filteredDevotionals = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const list = [...devotionals].sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.dayNumber - a.dayNumber;
        });
        if (!q) return list;
        return list.filter(
            (d) =>
                d.title.toLowerCase().includes(q) ||
                d.scriptureReference.toLowerCase().includes(q) ||
                d.tags.some((t) => t.toLowerCase().includes(q)) ||
                `day ${d.dayNumber}`.includes(q)
        );
    }, [devotionals, searchQuery]);

    const sections = useMemo(() => {
        if (browseMode === 'date') {
            return filteredDevotionals.length > 0
                ? [{ title: 'All Devotionals (Newest First)', data: filteredDevotionals }]
                : [];
        }

        if (browseMode === 'series') {
            const groups = new Map<string, Devotional[]>();
            filteredDevotionals.forEach((d) => {
                const label =
                    (d.seriesId && seriesTitleById.get(d.seriesId)) || 'Daily Walk Series';
                if (!groups.has(label)) groups.set(label, []);
                groups.get(label)!.push(d);
            });
            return Array.from(groups.entries()).map(([title, data]) => ({
                title,
                data: data.sort((a, b) => a.dayNumber - b.dayNumber),
            }));
        }

        // Default: group by Month
        const monthGroups = new Map<string, { title: string; data: Devotional[] }>();
        filteredDevotionals.forEach((d) => {
            const { key, label } = getMonthKeyAndLabel(d.date);
            if (!monthGroups.has(key)) {
                monthGroups.set(key, { title: label, data: [] });
            }
            monthGroups.get(key)!.data.push(d);
        });

        return Array.from(monthGroups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([, group]) => group);
    }, [filteredDevotionals, browseMode, seriesTitleById]);

    const isDevotionalCompleted = (d: Devotional): boolean => {
        return Boolean(completions[d.date] || completedDevotionalIds.has(d.id));
    };

    const renderDevotionalItem = ({ item }: { item: Devotional }) => {
        const completed = isDevotionalCompleted(item);

        return (
            <TouchableOpacity
                style={[
                    styles.entryCard,
                    {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    },
                ]}
                onPress={() => {
                    setCurrentDevotional(item);
                    navigation.navigate('Devotional', { devotional: item });
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Day ${item.dayNumber}, ${item.title}, ${item.scriptureReference}${completed ? ', Completed' : ''}`}
            >
                <View
                    style={[
                        styles.dayBadge,
                        completed
                            ? { backgroundColor: colors.sageSoft, borderColor: colors.sage }
                            : { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                >
                    {completed ? (
                        <Ionicons name="checkmark" size={16} color={colors.sage} />
                    ) : (
                        <Text style={[styles.dayNumberText, { color: colors.primary }]}>
                            {item.dayNumber}
                        </Text>
                    )}
                </View>

                <View style={styles.entryBody}>
                    <Text style={[styles.entryMeta, { color: colors.textTertiary }]}>
                        DAY {item.dayNumber} · {formatShortDate(item.date)}
                    </Text>
                    <Text
                        style={[styles.entryTitle, { color: colors.text, fontSize: scaledBody }]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    <Text
                        style={[styles.entryScripture, { color: colors.primary, fontSize: scaledCaption }]}
                        numberOfLines={1}
                    >
                        {item.scriptureReference}
                    </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.statusBar} />

            {/* ─── Header ─── */}
            <View
                style={[
                    styles.header,
                    {
                        paddingTop: Math.max(insets.top + 16, 48),
                        backgroundColor: colors.background,
                        borderBottomColor: colors.divider,
                    },
                ]}
            >
                <Text style={[styles.eyebrow, { color: colors.primary }]}>LIBRARY</Text>
                <Text style={[styles.headerTitle, { color: colors.text, fontSize: scaledHeading }]}>
                    Devotional Archive
                </Text>

                {/* Search Input */}
                <View
                    style={[
                        styles.searchBar,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search by title, Scripture, or day…"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Search devotional archive"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            accessibilityRole="button"
                            accessibilityLabel="Clear archive search"
                        >
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Browse Mode Segmented Tabs (Month / Series / Date) */}
                <View style={styles.modeRow}>
                    {(
                        [
                            { key: 'month', label: 'By Month' },
                            { key: 'series', label: 'By Series' },
                            { key: 'date', label: 'By Date' },
                        ] as { key: BrowseMode; label: string }[]
                    ).map((m) => {
                        const active = browseMode === m.key;
                        return (
                            <TouchableOpacity
                                key={m.key}
                                style={[
                                    styles.modeTab,
                                    {
                                        backgroundColor: active
                                            ? colors.primary
                                            : colors.surface,
                                        borderColor: active ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => setBrowseMode(m.key)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                            >
                                <Text
                                    style={[
                                        styles.modeTabText,
                                        { color: active ? colors.onPrimary : colors.textSecondary },
                                    ]}
                                >
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ─── Content ─── */}
            {isLoading && devotionals.length === 0 ? (
                <LoadingState label="Loading devotional archive…" colors={colors} />
            ) : error && devotionals.length === 0 ? (
                <ErrorState
                    title="Unable to load archive"
                    message={error}
                    actionLabel="Retry"
                    onAction={() => void loadDevotionals({ forceRefresh: true })}
                    colors={colors}
                />
            ) : sections.length === 0 ? (
                <EmptyState
                    title={
                        searchQuery.trim()
                            ? 'No matching devotionals'
                            : 'Your next devotional isn’t available yet.'
                    }
                    message={
                        searchQuery.trim()
                            ? 'Try searching for a different Scripture book, keyword, or day number.'
                            : 'Published church devotionals will appear here as each day unfolds.'
                    }
                    actionLabel={searchQuery.trim() ? 'Clear Search' : 'Refresh'}
                    onAction={() => {
                        if (searchQuery.trim()) {
                            setSearchQuery('');
                        } else {
                            void loadDevotionals({ forceRefresh: true });
                        }
                    }}
                    icon="library-outline"
                    colors={colors}
                />
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                                {title.toUpperCase()}
                            </Text>
                        </View>
                    )}
                    renderItem={renderDevotionalItem}
                    ListFooterComponent={
                        <View style={styles.footerBox}>
                            {hasMoreArchive && (
                                <TouchableOpacity
                                    style={[
                                        styles.loadMoreBtn,
                                        {
                                            backgroundColor: colors.surface,
                                            borderColor: colors.border,
                                        },
                                    ]}
                                    onPress={() => void loadMoreArchive()}
                                    accessibilityRole="button"
                                    accessibilityLabel="Load earlier devotionals"
                                >
                                    <Text style={[styles.loadMoreText, { color: colors.primary }]}>
                                        Load earlier devotionals
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
    },
    eyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.5,
    },
    headerTitle: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.heading,
        marginTop: 2,
        marginBottom: Spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: TouchTarget.minHeight,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        paddingVertical: Spacing.xs,
    },
    modeRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    modeTab: {
        flex: 1,
        minHeight: 36,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeTabText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: 110,
    },
    sectionHeader: {
        marginTop: Spacing.xl,
        marginBottom: Spacing.sm,
    },
    sectionHeaderText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.4,
    },
    entryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderTopWidth: 1.5,
        marginBottom: Spacing.sm,
        gap: Spacing.md,
        ...GlossyShadows.card,
    },
    dayBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayNumberText: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.body,
    },
    entryBody: {
        flex: 1,
    },
    entryMeta: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
        letterSpacing: 0.8,
    },
    entryTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.body,
        marginTop: 2,
    },
    entryScripture: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
        marginTop: 2,
    },
    footerBox: {
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    loadMoreBtn: {
        minHeight: TouchTarget.minHeight,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadMoreText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
});
