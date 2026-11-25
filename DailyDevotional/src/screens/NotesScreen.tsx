import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { useNotesStore } from '../store/notesStore';
import { useDevotionalStore } from '../store/devotionalStore';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import { HighlightColor, Note, scaleFont } from '../types';
import { formatShortDate } from '../lib/date';
import { EmptyState } from '../components/StateViews';
import NoteEditor from '../components/NoteEditor';

const HIGHLIGHT_BG: Record<HighlightColor, { light: string; dark: string }> = {
    yellow: { light: Colors.light.highlightYellow, dark: Colors.dark.highlightYellow },
    green: { light: Colors.light.highlightGreen, dark: Colors.dark.highlightGreen },
    pink: { light: Colors.light.highlightPink, dark: Colors.dark.highlightPink },
};

type JournalFilter = 'all' | 'reflections' | 'highlights' | 'bookmarks';

export default function NotesScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets();
    const darkMode = useSettingsStore((s) => s.darkMode);
    const fontSize = useSettingsStore((s) => s.fontSize);
    const scaledHeading = scaleFont(Typography.sizes.heading, fontSize);
    const scaledSubtitle = scaleFont(Typography.sizes.subtitle, fontSize);
    const scaledBody = scaleFont(Typography.sizes.body, fontSize);
    const scaledCaption = scaleFont(Typography.sizes.caption, fontSize);
    const {
        notes,
        highlights,
        bookmarks,
        updateNote,
        deleteNote,
        removeHighlight,
    } = useNotesStore();
    const { devotionals, setCurrentDevotional } = useDevotionalStore();

    const colors = darkMode ? Colors.dark : Colors.light;

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<JournalFilter>('all');
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    const devotionalMap = useMemo(
        () => new Map(devotionals.map((d) => [d.id, d])),
        [devotionals]
    );

    const resolveMeta = (
        devotionalId: string,
        fallbackTitle?: string,
        fallbackScripture?: string,
        fallbackDate?: string
    ) => {
        const dev = devotionalMap.get(devotionalId);
        return {
            title: dev?.title || fallbackTitle || 'Daily Devotional',
            scriptureReference: dev?.scriptureReference || fallbackScripture || '',
            date: dev?.date || fallbackDate || '',
            dayNumber: dev?.dayNumber,
            devotional: dev,
        };
    };

    const openDevotional = (devotionalId: string) => {
        const dev = devotionalMap.get(devotionalId);
        if (dev) {
            setCurrentDevotional(dev);
            navigation.navigate('Devotional', { devotional: dev });
        } else {
            Alert.alert(
                'Devotional Not Loaded',
                'Open the Archive tab and refresh to load this devotional entry.'
            );
        }
    };

    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filteredNotes = useMemo(() => {
        return notes.filter((n) => {
            const meta = resolveMeta(
                n.devotionalId,
                n.devotionalTitle,
                n.scriptureReference,
                n.devotionalDate
            );
            if (!normalizedSearch) return true;
            return (
                n.content.toLowerCase().includes(normalizedSearch) ||
                meta.title.toLowerCase().includes(normalizedSearch) ||
                meta.scriptureReference.toLowerCase().includes(normalizedSearch)
            );
        });
    }, [notes, normalizedSearch, devotionalMap]);

    const filteredHighlights = useMemo(() => {
        return highlights.filter((h) => {
            const meta = resolveMeta(
                h.devotionalId,
                h.devotionalTitle,
                h.scriptureReference,
                h.devotionalDate
            );
            if (!normalizedSearch) return true;
            return (
                h.text.toLowerCase().includes(normalizedSearch) ||
                meta.title.toLowerCase().includes(normalizedSearch) ||
                meta.scriptureReference.toLowerCase().includes(normalizedSearch)
            );
        });
    }, [highlights, normalizedSearch, devotionalMap]);

    const filteredBookmarks = useMemo(() => {
        return bookmarks.filter((b) => {
            if (!normalizedSearch) return true;
            return (
                b.title.toLowerCase().includes(normalizedSearch) ||
                b.scriptureReference.toLowerCase().includes(normalizedSearch)
            );
        });
    }, [bookmarks, normalizedSearch]);

    const hasAnyEntries =
        notes.length > 0 || highlights.length > 0 || bookmarks.length > 0;

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
                <View style={styles.headerTopRow}>
                    <View>
                        <Text style={[styles.eyebrow, { color: colors.primary }]}>
                            PERSONAL RECORD
                        </Text>
                        <Text style={[styles.headerTitle, { color: colors.text, fontSize: scaledHeading }]}>
                            My Journal
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.historyBtn,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                        onPress={() => navigation.navigate('ReadingHistory')}
                        accessibilityRole="button"
                        accessibilityLabel="Open reading history calendar"
                    >
                        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                        <Text style={[styles.historyBtnText, { color: colors.text }]}>History</Text>
                    </TouchableOpacity>
                </View>

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
                        placeholder="Search reflections, notes, or Scripture…"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Search your journal"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            accessibilityRole="button"
                            accessibilityLabel="Clear search"
                        >
                            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Pills */}
                <View style={styles.filterRow}>
                    {(
                        [
                            { key: 'all', label: `All (${notes.length + highlights.length})` },
                            { key: 'reflections', label: `Reflections (${notes.length})` },
                            { key: 'highlights', label: `Highlights (${highlights.length})` },
                            { key: 'bookmarks', label: `Saved (${bookmarks.length})` },
                        ] as { key: JournalFilter; label: string }[]
                    ).map((tab) => {
                        const active = activeFilter === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[
                                    styles.filterPill,
                                    {
                                        backgroundColor: active
                                            ? colors.primary
                                            : colors.surface,
                                        borderColor: active ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => setActiveFilter(tab.key)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                            >
                                <Text
                                    style={[
                                        styles.filterPillText,
                                        { color: active ? colors.onPrimary : colors.textSecondary },
                                    ]}
                                >
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {!hasAnyEntries ? (
                    <EmptyState
                        title="Your devotional journey starts here."
                        message="As you read each day’s devotional, write personal reflections and highlight verses that speak to you."
                        actionLabel="Open Today’s Devotional"
                        onAction={() => navigation.navigate('Today')}
                        icon="book-outline"
                        colors={colors}
                    />
                ) : (
                    <>
                        {/* ─── Reflections & Notes ─── */}
                        {(activeFilter === 'all' || activeFilter === 'reflections') &&
                            filteredNotes.map((note) => {
                                const meta = resolveMeta(
                                    note.devotionalId,
                                    note.devotionalTitle,
                                    note.scriptureReference,
                                    note.devotionalDate
                                );
                                // Check if there is an accompanying highlight for the same devotional
                                const relatedHighlight = highlights.find(
                                    (h) => h.devotionalId === note.devotionalId
                                );

                                return (
                                    <View
                                        key={note.id}
                                        style={[
                                            styles.entryCard,
                                            {
                                                backgroundColor: colors.surface,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                    >
                                        <View style={styles.entryTopRow}>
                                            <View style={styles.entryDateRow}>
                                                <View
                                                    style={[
                                                        styles.kindBadge,
                                                        {
                                                            backgroundColor:
                                                                note.kind === 'reflection'
                                                                    ? colors.primarySoft
                                                                    : colors.surfaceElevated,
                                                        },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.kindBadgeText,
                                                            {
                                                                color:
                                                                    note.kind === 'reflection'
                                                                        ? colors.primary
                                                                        : colors.textSecondary,
                                                            },
                                                        ]}
                                                    >
                                                        {note.kind === 'reflection'
                                                            ? 'REFLECTION'
                                                            : 'NOTE'}
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.dateLabel,
                                                        { color: colors.textTertiary },
                                                    ]}
                                                >
                                                    {meta.date
                                                        ? formatShortDate(meta.date)
                                                        : formatShortDate(
                                                              note.updatedAt.split('T')[0]
                                                          )}
                                                </Text>
                                            </View>

                                            <View style={styles.entryQuickActions}>
                                                <TouchableOpacity
                                                    onPress={() => setEditingNote(note)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Edit reflection"
                                                >
                                                    <Ionicons
                                                        name="create-outline"
                                                        size={17}
                                                        color={colors.textSecondary}
                                                    />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Alert.alert(
                                                            'Delete Entry',
                                                            'Remove this entry from your journal?',
                                                            [
                                                                { text: 'Cancel', style: 'cancel' },
                                                                {
                                                                    text: 'Delete',
                                                                    style: 'destructive',
                                                                    onPress: () =>
                                                                        void deleteNote(note.id),
                                                                },
                                                            ]
                                                        );
                                                    }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Delete reflection"
                                                >
                                                    <Ionicons
                                                        name="trash-outline"
                                                        size={17}
                                                        color={colors.textTertiary}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Devotional Title & Scripture */}
                                        <TouchableOpacity
                                            onPress={() => openDevotional(note.devotionalId)}
                                            activeOpacity={0.75}
                                        >
                                            <Text
                                                style={[
                                                    styles.devotionalTitle,
                                                    { color: colors.text, fontSize: scaledSubtitle, lineHeight: Math.round(scaledSubtitle * 1.35) },
                                                ]}
                                            >
                                                {meta.dayNumber ? `Day ${meta.dayNumber}: ` : ''}
                                                {meta.title}
                                            </Text>
                                            {meta.scriptureReference ? (
                                                <Text
                                                    style={[
                                                        styles.scriptureRef,
                                                        { color: colors.primary, fontSize: scaledCaption },
                                                    ]}
                                                >
                                                    {meta.scriptureReference}
                                                </Text>
                                            ) : null}
                                        </TouchableOpacity>

                                        {/* Reflection Content */}
                                        <Text style={[styles.reflectionBody, { color: colors.text, fontSize: scaledBody, lineHeight: Math.round(scaledBody * 1.55) }]}>
                                            {note.content}
                                        </Text>

                                        {/* Optional Highlight Preview */}
                                        {relatedHighlight && (
                                            <View
                                                style={[
                                                    styles.inlineHighlightBox,
                                                    {
                                                        backgroundColor:
                                                            HIGHLIGHT_BG[relatedHighlight.color][
                                                                darkMode ? 'dark' : 'light'
                                                            ],
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.inlineHighlightText,
                                                        { color: colors.text },
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    “{relatedHighlight.text}”
                                                </Text>
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            style={styles.returnLink}
                                            onPress={() => openDevotional(note.devotionalId)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Return to devotional ${meta.title}`}
                                        >
                                            <Text
                                                style={[
                                                    styles.returnLinkText,
                                                    { color: colors.primary },
                                                ]}
                                            >
                                                Open original devotional →
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}

                        {/* ─── Highlights ─── */}
                        {(activeFilter === 'all' || activeFilter === 'highlights') &&
                            filteredHighlights.map((hl) => {
                                const meta = resolveMeta(
                                    hl.devotionalId,
                                    hl.devotionalTitle,
                                    hl.scriptureReference,
                                    hl.devotionalDate
                                );
                                return (
                                    <TouchableOpacity
                                        key={hl.id}
                                        style={[
                                            styles.entryCard,
                                            {
                                                backgroundColor: colors.surface,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                        onPress={() => openDevotional(hl.devotionalId)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.entryTopRow}>
                                            <Text
                                                style={[
                                                    styles.dateLabel,
                                                    { color: colors.textTertiary },
                                                ]}
                                            >
                                                HIGHLIGHT ·{' '}
                                                {meta.date
                                                    ? formatShortDate(meta.date)
                                                    : formatShortDate(hl.createdAt.split('T')[0])}
                                            </Text>
                                            <TouchableOpacity
                                                onPress={() => void removeHighlight(hl.id)}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                accessibilityRole="button"
                                                accessibilityLabel="Remove highlight"
                                            >
                                                <Ionicons
                                                    name="trash-outline"
                                                    size={16}
                                                    color={colors.textTertiary}
                                                />
                                            </TouchableOpacity>
                                        </View>

                                        <View
                                            style={[
                                                styles.inlineHighlightBox,
                                                {
                                                    backgroundColor:
                                                        HIGHLIGHT_BG[hl.color][
                                                            darkMode ? 'dark' : 'light'
                                                        ],
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.inlineHighlightText,
                                                    { color: colors.text },
                                                ]}
                                            >
                                                “{hl.text}”
                                            </Text>
                                        </View>

                                        <Text
                                            style={[
                                                styles.devotionalSubRef,
                                                { color: colors.textSecondary },
                                            ]}
                                        >
                                            {meta.title}
                                            {meta.scriptureReference
                                                ? ` · ${meta.scriptureReference}`
                                                : ''}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}

                        {/* ─── Bookmarks ─── */}
                        {activeFilter === 'bookmarks' &&
                            (filteredBookmarks.length === 0 ? (
                                <EmptyState
                                    title="No saved devotionals yet"
                                    message="Tap the bookmark icon inside any devotional reader to save it here."
                                    icon="bookmark-outline"
                                    colors={colors}
                                    compact
                                />
                            ) : (
                                filteredBookmarks.map((bm) => (
                                    <TouchableOpacity
                                        key={bm.devotionalId}
                                        style={[
                                            styles.entryCard,
                                            {
                                                backgroundColor: colors.surface,
                                                borderColor: colors.border,
                                            },
                                        ]}
                                        onPress={() => openDevotional(bm.devotionalId)}
                                        activeOpacity={0.8}
                                    >
                                        <Text
                                            style={[
                                                styles.dateLabel,
                                                { color: colors.primary },
                                            ]}
                                        >
                                            DAY {bm.dayNumber} · {formatShortDate(bm.date)}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.devotionalTitle,
                                                { color: colors.text, marginTop: 4 },
                                            ]}
                                        >
                                            {bm.title}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.scriptureRef,
                                                { color: colors.textSecondary },
                                            ]}
                                        >
                                            {bm.scriptureReference}
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            ))}
                    </>
                )}
            </ScrollView>

            {editingNote && (
                <NoteEditor
                    initialContent={editingNote.content}
                    isEditing
                    onSave={async (content) => {
                        await updateNote(editingNote.id, content);
                        setEditingNote(null);
                    }}
                    onCancel={() => setEditingNote(null)}
                    onDelete={async () => {
                        await deleteNote(editingNote.id);
                        setEditingNote(null);
                    }}
                    darkMode={darkMode}
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
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
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
    },
    historyBtn: {
        minHeight: 38,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    historyBtnText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
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
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    filterPill: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    filterPillText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
    },
    scrollContent: {
        padding: Spacing.xl,
        paddingBottom: 110,
        gap: Spacing.md,
    },
    entryCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderTopWidth: 1.5,
        padding: Spacing.xl,
        marginBottom: Spacing.sm,
        ...GlossyShadows.card,
    },
    entryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    entryDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    kindBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.xs,
    },
    kindBadgeText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: 10,
        letterSpacing: 1,
    },
    dateLabel: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
    },
    entryQuickActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    devotionalTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.subtitle,
        lineHeight: 25,
    },
    scriptureRef: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
        marginTop: 2,
    },
    reflectionBody: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 24,
        marginTop: Spacing.md,
    },
    inlineHighlightBox: {
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
    },
    inlineHighlightText: {
        fontFamily: Typography.fontFamily.serifItalic,
        fontSize: Typography.sizes.caption,
        lineHeight: 20,
    },
    devotionalSubRef: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
        marginTop: Spacing.sm,
    },
    returnLink: {
        marginTop: Spacing.md,
        paddingTop: Spacing.xs,
    },
    returnLinkText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
});
