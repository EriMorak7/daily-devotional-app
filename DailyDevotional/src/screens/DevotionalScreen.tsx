import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    TextInput,
    Animated,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDevotionalStore } from '../store/devotionalStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNotesStore } from '../store/notesStore';
import { useAuthStore } from '../store/authStore';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import { GlossyButton } from '../components/GlossyElements';
import { FONT_SIZE_VALUES, Devotional, HighlightColor, FontSize, scaleFont } from '../types';
import HighlightPicker from '../components/HighlightPicker';
import NoteEditor from '../components/NoteEditor';
import AudioPlayer from '../components/AudioPlayer';
import CommentSection from '../components/CommentSection';
import { EmptyState } from '../components/StateViews';
import { shareDevotional, copyDevotionalExcerpt } from '../utils/shareCard';
import { completeDevotionalForToday, signOut } from '../services/auth';
import { formatEditorialDate, toLocalDateKey } from '../lib/date';

const HIGHLIGHT_BG: Record<HighlightColor, { light: string; dark: string }> = {
    yellow: { light: Colors.light.highlightYellow, dark: Colors.dark.highlightYellow },
    green: { light: Colors.light.highlightGreen, dark: Colors.dark.highlightGreen },
    pink: { light: Colors.light.highlightPink, dark: Colors.dark.highlightPink },
};

export default function DevotionalScreen({ route, navigation }: { route: any; navigation: any }) {
    const insets = useSafeAreaInsets();
    const devotionalFromRoute: Devotional | undefined = route?.params?.devotional;
    const storeDevotional = useDevotionalStore((s) => s.currentDevotional);
    const todayDevotional = useDevotionalStore((s) => s.todayDevotional);
    const devotionals = useDevotionalStore((s) => s.devotionals);
    const goToNext = useDevotionalStore((s) => s.goToNext);
    const goToPrevious = useDevotionalStore((s) => s.goToPrevious);

    const { darkMode, fontSize, setFontSize, toggleDarkMode, reducedMotion } = useSettingsStore();
    const notes = useNotesStore((s) => s.notes);
    const highlights = useNotesStore((s) => s.highlights);
    const bookmarks = useNotesStore((s) => s.bookmarks);
    const {
        addNote,
        updateNote,
        deleteNote,
        saveReflectionForDevotional,
        addHighlight,
        removeHighlight,
        toggleBookmark,
    } = useNotesStore();

    const { completions } = useAuthStore();

    const colors = darkMode ? Colors.dark : Colors.light;
    const bodyFontSize = FONT_SIZE_VALUES[fontSize];
    const scaledHeroTitle = scaleFont(Typography.sizes.hero, fontSize);
    const scaledSectionTitle = scaleFont(Typography.sizes.title, fontSize);
    const scaledCaption = scaleFont(Typography.sizes.caption, fontSize);
    const devotional = devotionalFromRoute || storeDevotional || todayDevotional;

    // UI State
    const [showReaderTools, setShowReaderTools] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [selectedPassage, setSelectedPassage] = useState<{
        text: string;
        section: 'scripture' | 'body' | 'prayer';
        paragraphIndex?: number;
    } | null>(null);
    const [showNoteEditor, setShowNoteEditor] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [reflectionInput, setReflectionInput] = useState('');
    const [isCompleting, setIsCompleting] = useState(false);
    const [completionBanner, setCompletionBanner] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const checkScaleAnim = useRef(new Animated.Value(1)).current;

    const existingNotes = useMemo(
        () =>
            devotional
                ? notes.filter((n) => n.devotionalId === devotional.id && n.kind === 'note')
                : [],
        [devotional?.id, notes]
    );

    const existingReflection = useMemo(
        () =>
            devotional
                ? notes.find((n) => n.devotionalId === devotional.id && n.kind === 'reflection')
                : undefined,
        [devotional?.id, notes]
    );

    const existingHighlights = useMemo(
        () => (devotional ? highlights.filter((h) => h.devotionalId === devotional.id) : []),
        [devotional?.id, highlights]
    );

    const bookmarked = useMemo(
        () => (devotional ? bookmarks.some((b) => b.devotionalId === devotional.id) : false),
        [devotional?.id, bookmarks]
    );

    useEffect(() => {
        setReflectionInput(existingReflection?.content || '');
        setCompletionBanner(null);
    }, [devotional?.id, existingReflection?.content]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2400);
    };

    if (!devotional) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <EmptyState
                    title="No devotional selected"
                    message="Return to Today or browse the Archive to choose a devotional reading."
                    actionLabel="Go Back"
                    onAction={() => navigation.goBack()}
                    colors={colors}
                />
            </View>
        );
    }

    const currentIndex = devotionals.findIndex((d) => d.id === devotional.id);
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex + 1 < devotionals.length;

    const todayKey = toLocalDateKey();
    const isCompletedForDate = Boolean(
        completions[devotional.date] ||
            (todayDevotional?.id === devotional.id && completions[todayKey])
    );

    const bodyParagraphs = devotional.body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

    const handleNext = () => {
        const next = goToNext();
        if (next) {
            navigation.setParams({ devotional: next });
        }
    };

    const handlePrevious = () => {
        const prev = goToPrevious();
        if (prev) {
            navigation.setParams({ devotional: prev });
        }
    };

    const openPassageSelector = (
        text: string,
        section: 'scripture' | 'body' | 'prayer',
        paragraphIndex?: number
    ) => {
        setSelectedPassage({ text, section, paragraphIndex });
        setShowHighlightPicker(true);
    };

    const handleHighlightColor = async (color: HighlightColor) => {
        if (selectedPassage && devotional) {
            await addHighlight(
                devotional.id,
                selectedPassage.text,
                color,
                0,
                selectedPassage.text.length,
                {
                    devotionalTitle: devotional.title,
                    scriptureReference: devotional.scriptureReference,
                    devotionalDate: devotional.date,
                    section: selectedPassage.section,
                    paragraphIndex: selectedPassage.paragraphIndex,
                }
            );
            showToast('Passage highlighted');
        }
        setShowHighlightPicker(false);
        setSelectedPassage(null);
    };

    const handleCopySelectedPassage = async () => {
        if (!selectedPassage) return;
        const ok = await copyDevotionalExcerpt(devotional, selectedPassage.text);
        setShowHighlightPicker(false);
        if (ok) showToast('Passage copied to clipboard');
    };

    const handleNoteOnSelectedPassage = () => {
        setShowHighlightPicker(false);
        setEditingNoteId(null);
        setShowNoteEditor(true);
    };

    const handleSaveNote = async (content: string) => {
        if (editingNoteId) {
            await updateNote(editingNoteId, content);
            showToast('Note updated');
        } else {
            await addNote(
                devotional.id,
                content,
                {
                    title: devotional.title,
                    scriptureReference: devotional.scriptureReference,
                    date: devotional.date,
                    dayNumber: devotional.dayNumber,
                    seriesId: devotional.seriesId,
                },
                'note'
            );
            showToast('Saved to your journal');
        }
        setShowNoteEditor(false);
        setEditingNoteId(null);
        setSelectedPassage(null);
    };

    const handleDeleteNote = async () => {
        if (editingNoteId) {
            await deleteNote(editingNoteId);
            setShowNoteEditor(false);
            setEditingNoteId(null);
            showToast('Note removed');
        }
    };

    const handleToggleBookmark = async () => {
        const saved = await toggleBookmark(devotional);
        showToast(saved ? 'Saved to bookmarks' : 'Removed from bookmarks');
    };

    const handleSaveReflectionOnly = async () => {
        const trimmed = reflectionInput.trim();
        if (!trimmed) {
            Alert.alert('Reflection Empty', 'Write a few thoughts first to save to your journal.');
            return;
        }
        await saveReflectionForDevotional(devotional, trimmed);
        showToast('Reflection saved to My Journal');
    };

    const handleMarkAsComplete = async () => {
        if (isCompleting) return;
        setIsCompleting(true);
        try {
            const { progress, alreadyCompletedToday } = await completeDevotionalForToday(
                devotional,
                reflectionInput.trim() || undefined
            );

            if (!reducedMotion) {
                Animated.sequence([
                    Animated.timing(checkScaleAnim, {
                        toValue: 1.07,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                    Animated.timing(checkScaleAnim, {
                        toValue: 1,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                ]).start();
            }

            setCompletionBanner(
                alreadyCompletedToday
                    ? `Reflection saved · ${progress.currentStreak} day devotional streak`
                    : `Devotional completed · 🔥 ${progress.currentStreak} day streak`
            );
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unable to save completion.';
            Alert.alert('Completion Error', msg);
        } finally {
            setIsCompleting(false);
        }
    };

    const editingNote = editingNoteId
        ? existingNotes.find((n) => n.id === editingNoteId)
        : undefined;

    const fontSizeOptions: { label: string; value: FontSize }[] = [
        { label: 'S', value: 'small' },
        { label: 'M', value: 'medium' },
        { label: 'L', value: 'large' },
        { label: 'XL', value: 'xlarge' },
    ];

    const getParagraphHighlight = (text: string) =>
        existingHighlights.find((h) => h.text === text.trim());

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.statusBar} />

            {/* ─── Top Bar (BACK + Reader Controls) ─── */}
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
                    style={styles.iconActionBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>

                <Text style={[styles.topBarEyebrow, { color: colors.textSecondary }]}>
                    DAY {devotional.dayNumber}
                </Text>

                <View style={styles.topBarRight}>
                    <TouchableOpacity
                        onPress={() => setShowReaderTools(!showReaderTools)}
                        style={styles.iconActionBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Toggle font size and appearance settings"
                    >
                        <Ionicons name="text-outline" size={20} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleToggleBookmark}
                        style={styles.iconActionBtn}
                        accessibilityRole="button"
                        accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark devotional'}
                    >
                        <Ionicons
                            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                            size={20}
                            color={bookmarked ? colors.primary : colors.text}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={async () => {
                            const ok = await copyDevotionalExcerpt(devotional);
                            if (ok) showToast('Devotional copied to clipboard');
                        }}
                        style={styles.iconActionBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Copy devotional text"
                    >
                        <Ionicons name="copy-outline" size={19} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => shareDevotional(devotional)}
                        style={styles.iconActionBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Share devotional"
                    >
                        <Ionicons name="share-outline" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ─── Inline Font Size & Appearance Drawer ─── */}
            {showReaderTools && (
                <View
                    style={[
                        styles.readerToolsBar,
                        { backgroundColor: colors.surface, borderBottomColor: colors.border },
                    ]}
                >
                    <View style={styles.fontSizeSelector}>
                        {fontSizeOptions.map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.fontSizeBtn,
                                    {
                                        backgroundColor:
                                            fontSize === opt.value
                                                ? colors.primary
                                                : colors.surfaceElevated,
                                    },
                                ]}
                                onPress={() => setFontSize(opt.value)}
                                accessibilityRole="button"
                                accessibilityLabel={`Font size ${opt.value}`}
                            >
                                <Text
                                    style={[
                                        styles.fontSizeBtnText,
                                        { color: fontSize === opt.value ? colors.onPrimary : colors.text },
                                    ]}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        onPress={toggleDarkMode}
                        style={[
                            styles.themeToggleBtn,
                            { backgroundColor: colors.surfaceElevated },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        <Ionicons
                            name={darkMode ? 'sunny-outline' : 'moon-outline'}
                            size={18}
                            color={colors.text}
                        />
                        <Text style={[styles.themeToggleText, { color: colors.text }]}>
                            {darkMode ? 'Light' : 'Dark'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ─── Editorial Reading Canvas ─── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* DAY NUMBER & DATE */}
                <Text style={[styles.metaDayDate, { color: colors.primary }]}>
                    DAY {devotional.dayNumber} · {formatEditorialDate(devotional.date, true).toUpperCase()}
                </Text>

                {/* TITLE */}
                <Text
                    style={[
                        styles.titleText,
                        {
                            color: colors.text,
                            fontSize: scaledHeroTitle,
                            lineHeight: Math.round(scaledHeroTitle * 1.24),
                        },
                    ]}
                    selectable
                >
                    {devotional.title}
                </Text>

                {devotional.author ? (
                    <Text style={[styles.authorByline, { color: colors.textTertiary, fontSize: scaledCaption }]}>
                        By {devotional.author}
                    </Text>
                ) : null}

                {/* AUDIO PLAYER (compact inline above Scripture) */}
                <View style={styles.audioSection}>
                    <AudioPlayer devotional={devotional} darkMode={darkMode} compact />
                </View>

                {/* SCRIPTURE REFERENCE & SCRIPTURE TEXT */}
                <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => openPassageSelector(devotional.scriptureText, 'scripture')}
                    style={[
                        styles.scriptureBlock,
                        {
                            backgroundColor: getParagraphHighlight(devotional.scriptureText)
                                ? HIGHLIGHT_BG[getParagraphHighlight(devotional.scriptureText)!.color][
                                      darkMode ? 'dark' : 'light'
                                  ]
                                : colors.surface,
                            borderColor: colors.border,
                            borderLeftColor: colors.primary,
                        },
                    ]}
                    accessibilityLabel={`Scripture: ${devotional.scriptureReference}. ${devotional.scriptureText}. Long press to highlight or copy.`}
                >
                    <View style={styles.scriptureHeaderRow}>
                        <Text style={[styles.scriptureReference, { color: colors.primary }]}>
                            {devotional.scriptureReference}
                        </Text>
                        <TouchableOpacity
                            onPress={() => openPassageSelector(devotional.scriptureText, 'scripture')}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Highlight or copy Scripture passage"
                        >
                            <Ionicons name="color-wand-outline" size={16} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                    <Text
                        style={[
                            styles.scriptureText,
                            {
                                color: colors.text,
                                fontSize: bodyFontSize + 1,
                                lineHeight: (bodyFontSize + 1) * 1.65,
                            },
                        ]}
                        selectable
                    >
                        “{devotional.scriptureText}”
                    </Text>
                </TouchableOpacity>

                {/* DEVOTIONAL BODY */}
                <View style={styles.bodySection}>
                    <Text style={[styles.tapHint, { color: colors.textTertiary }]}>
                        Tip: Long-press any paragraph to highlight, copy, or add a note.
                    </Text>
                    {bodyParagraphs.map((paragraph, index) => {
                        const matchedHl = getParagraphHighlight(paragraph);
                        const hlBg = matchedHl
                            ? HIGHLIGHT_BG[matchedHl.color][darkMode ? 'dark' : 'light']
                            : 'transparent';

                        return (
                            <TouchableOpacity
                                key={index}
                                activeOpacity={0.9}
                                onLongPress={() => openPassageSelector(paragraph, 'body', index)}
                                style={[
                                    styles.paragraphContainer,
                                    matchedHl && {
                                        backgroundColor: hlBg,
                                        paddingHorizontal: Spacing.md,
                                        paddingVertical: Spacing.sm,
                                        borderRadius: BorderRadius.sm,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.bodyParagraph,
                                        {
                                            color: colors.text,
                                            fontSize: bodyFontSize,
                                            lineHeight: bodyFontSize * 1.72,
                                        },
                                    ]}
                                    selectable
                                >
                                    {paragraph}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Active Highlights & Personal Notes List */}
                {(existingHighlights.length > 0 || existingNotes.length > 0) && (
                    <View
                        style={[
                            styles.annotationsBlock,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                        ]}
                    >
                        <View style={styles.annotationsHeader}>
                            <Text style={[styles.sectionEyebrow, { color: colors.textSecondary }]}>
                                YOUR HIGHLIGHTS & NOTES
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setEditingNoteId(null);
                                    setShowNoteEditor(true);
                                }}
                                style={styles.addSmallBtn}
                            >
                                <Ionicons name="add" size={16} color={colors.primary} />
                                <Text style={[styles.addSmallText, { color: colors.primary }]}>
                                    Add Note
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {existingHighlights.map((hl) => (
                            <View key={hl.id} style={styles.highlightRow}>
                                <View
                                    style={[
                                        styles.highlightSwatch,
                                        {
                                            backgroundColor:
                                                HIGHLIGHT_BG[hl.color][darkMode ? 'dark' : 'light'],
                                        },
                                    ]}
                                />
                                <Text
                                    style={[styles.highlightExcerpt, { color: colors.text }]}
                                    numberOfLines={2}
                                >
                                    “{hl.text}”
                                </Text>
                                <TouchableOpacity
                                    onPress={() => removeHighlight(hl.id)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Remove highlight"
                                >
                                    <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {existingNotes.map((note) => (
                            <TouchableOpacity
                                key={note.id}
                                style={[
                                    styles.savedNoteCard,
                                    {
                                        backgroundColor: colors.surfaceElevated,
                                        borderColor: colors.border,
                                    },
                                ]}
                                onPress={() => {
                                    setEditingNoteId(note.id);
                                    setShowNoteEditor(true);
                                }}
                            >
                                <Text style={[styles.savedNoteText, { color: colors.text }]}>
                                    {note.content}
                                </Text>
                                <Text style={[styles.savedNoteAction, { color: colors.primary }]}>
                                    Tap to edit
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* PRAYER */}
                {devotional.prayer ? (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={() => openPassageSelector(devotional.prayer, 'prayer')}
                        style={[
                            styles.prayerSection,
                            {
                                backgroundColor: colors.prayerSurface,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>
                            CLOSING PRAYER
                        </Text>
                        <Text
                            style={[
                                styles.prayerText,
                                {
                                    color: colors.text,
                                    fontSize: bodyFontSize,
                                    lineHeight: bodyFontSize * 1.68,
                                },
                            ]}
                            selectable
                        >
                            {devotional.prayer}
                        </Text>
                    </TouchableOpacity>
                ) : null}

                {/* REFLECTION PROMPT, REFLECTION INPUT & COMPLETION ACTION */}
                <Animated.View
                    style={[
                        styles.reflectionSection,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            transform: [{ scale: checkScaleAnim }],
                        },
                    ]}
                >
                    <Text style={[styles.sectionEyebrow, { color: colors.primary }]}>
                        DAILY REFLECTION & CHECK-IN
                    </Text>
                    <Text
                        style={[
                            styles.reflectionPromptTitle,
                            {
                                color: colors.text,
                                fontSize: scaledSectionTitle,
                                lineHeight: Math.round(scaledSectionTitle * 1.3),
                            },
                        ]}
                    >
                        {devotional.reflectionPrompt || 'How did today’s devotional speak to you?'}
                    </Text>
                    <Text style={[styles.reflectionSubtitle, { color: colors.textSecondary, fontSize: scaledCaption }]}>
                        Your reflection is saved privately to your personal journal.
                    </Text>

                    <TextInput
                        style={[
                            styles.reflectionInput,
                            {
                                color: colors.text,
                                backgroundColor: colors.background,
                                borderColor: colors.border,
                                fontSize: bodyFontSize,
                                lineHeight: Math.round(bodyFontSize * 1.45),
                            },
                        ]}
                        value={reflectionInput}
                        onChangeText={setReflectionInput}
                        placeholder="Write what stood out to you or a prayer response…"
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        accessibilityLabel="Daily reflection input"
                    />

                    <View style={styles.reflectionButtonsRow}>
                        {reflectionInput.trim().length > 0 && (
                            <TouchableOpacity
                                style={[
                                    styles.saveDraftBtn,
                                    { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
                                ]}
                                onPress={handleSaveReflectionOnly}
                                accessibilityRole="button"
                                accessibilityLabel="Save reflection to journal"
                            >
                                <Text style={[styles.saveDraftText, { color: colors.text }]}>
                                    Save to Journal
                                </Text>
                            </TouchableOpacity>
                        )}

                        <GlossyButton
                            darkMode={darkMode}
                            onPress={handleMarkAsComplete}
                            disabled={isCompleting}
                            accessibilityLabel={
                                isCompletedForDate
                                    ? 'Today’s devotional completed. Tap to update reflection.'
                                    : 'Mark today’s devotional as complete'
                            }
                        >
                            <Ionicons
                                name={isCompletedForDate ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                size={20}
                                color={colors.onPrimary}
                            />
                            <Text style={[styles.completeButtonText, { color: colors.onPrimary }]}>
                                {isCompletedForDate
                                    ? 'DEVOTIONAL COMPLETED'
                                    : 'MARK AS COMPLETE'}
                            </Text>
                        </GlossyButton>
                    </View>

                    {completionBanner && (
                        <View style={[styles.confirmationBanner, { backgroundColor: colors.sageSoft }]}>
                            <Ionicons name="sparkles-outline" size={16} color={colors.sage} />
                            <Text style={[styles.confirmationText, { color: colors.sage }]}>
                                {completionBanner}
                            </Text>
                        </View>
                    )}
                </Animated.View>

                {/* Quick Add Note Button */}
                <TouchableOpacity
                    style={[
                        styles.addAdditionalNoteBtn,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                    onPress={() => {
                        setEditingNoteId(null);
                        setShowNoteEditor(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Add an additional study note"
                >
                    <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    <Text style={[styles.addAdditionalNoteText, { color: colors.text }]}>
                        Add Study Note
                    </Text>
                </TouchableOpacity>

                {/* PREVIOUS / NEXT NAVIGATION */}
                <View style={styles.prevNextRow}>
                    <TouchableOpacity
                        onPress={handlePrevious}
                        disabled={!hasPrevious}
                        style={[
                            styles.navButton,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                opacity: hasPrevious ? 1 : 0.4,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Previous devotional"
                    >
                        <Ionicons name="chevron-back" size={18} color={colors.text} />
                        <Text style={[styles.navText, { color: colors.text }]}>Previous</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleNext}
                        disabled={!hasNext}
                        style={[
                            styles.navButton,
                            {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                                opacity: hasNext ? 1 : 0.4,
                            },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Next devotional"
                    >
                        <Text style={[styles.navText, { color: colors.text }]}>Next</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* COMMUNITY SECTION */}
                <CommentSection
                    devotionalId={devotional.id}
                    darkMode={darkMode}
                    onRequireSignIn={() => signOut()}
                />
            </ScrollView>

            {/* Toast Notification */}
            {toastMessage && (
                <View style={[styles.toastPill, { backgroundColor: colors.text }]}>
                    <Text style={[styles.toastText, { color: colors.background }]}>
                        {toastMessage}
                    </Text>
                </View>
            )}

            {/* Highlight Picker Bottom Sheet */}
            <HighlightPicker
                visible={showHighlightPicker}
                selectedText={selectedPassage?.text}
                onSelectColor={handleHighlightColor}
                onCopyPassage={handleCopySelectedPassage}
                onAddNoteForPassage={handleNoteOnSelectedPassage}
                onDismiss={() => {
                    setShowHighlightPicker(false);
                    setSelectedPassage(null);
                }}
                darkMode={darkMode}
            />

            {/* Note Editor Bottom Sheet */}
            {showNoteEditor && (
                <NoteEditor
                    initialContent={
                        editingNote?.content ||
                        (selectedPassage ? `“${selectedPassage.text}”\n\n` : '')
                    }
                    isEditing={Boolean(editingNoteId)}
                    onSave={handleSaveNote}
                    onCancel={() => {
                        setShowNoteEditor(false);
                        setEditingNoteId(null);
                        setSelectedPassage(null);
                    }}
                    onDelete={editingNoteId ? handleDeleteNote : undefined}
                    darkMode={darkMode}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderBottomWidth: 1,
    },
    iconActionBtn: {
        minWidth: TouchTarget.minWidth,
        minHeight: TouchTarget.minHeight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarEyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
        letterSpacing: 1.2,
    },
    topBarRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    readerToolsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        gap: Spacing.md,
    },
    fontSizeSelector: {
        flex: 1,
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    fontSizeBtn: {
        flex: 1,
        minHeight: 36,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fontSizeBtnText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    themeToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 36,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.sm,
        gap: 6,
    },
    themeToggleText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    scrollContent: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        paddingBottom: 120,
    },
    metaDayDate: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.5,
    },
    titleText: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.hero,
        lineHeight: Typography.lineHeights.hero,
        marginTop: Spacing.sm,
    },
    authorByline: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: Spacing.xs,
    },
    audioSection: {
        marginTop: Spacing.xl,
    },
    scriptureBlock: {
        marginTop: Spacing.xl,
        padding: Spacing.xl,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderLeftWidth: 3,
        ...GlossyShadows.card,
    },
    scriptureHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    scriptureReference: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    scriptureText: {
        fontFamily: Typography.fontFamily.serifItalic,
    },
    bodySection: {
        marginTop: Spacing.xxl,
    },
    tapHint: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.micro,
        marginBottom: Spacing.md,
    },
    paragraphContainer: {
        marginBottom: Spacing.lg,
    },
    bodyParagraph: {
        fontFamily: Typography.fontFamily.regular,
    },
    annotationsBlock: {
        marginTop: Spacing.lg,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    annotationsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    sectionEyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.4,
    },
    addSmallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    addSmallText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    highlightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: 4,
    },
    highlightSwatch: {
        width: 10,
        height: 28,
        borderRadius: 4,
    },
    highlightExcerpt: {
        flex: 1,
        fontFamily: Typography.fontFamily.serifItalic,
        fontSize: Typography.sizes.caption,
    },
    savedNoteCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        marginTop: Spacing.xs,
    },
    savedNoteText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 22,
    },
    savedNoteAction: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.micro,
        marginTop: 6,
    },
    prayerSection: {
        marginTop: Spacing.xl,
        padding: Spacing.xl,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        ...GlossyShadows.card,
    },
    prayerText: {
        fontFamily: Typography.fontFamily.serifItalic,
        marginTop: Spacing.sm,
    },
    reflectionSection: {
        marginTop: Spacing.xxl,
        padding: Spacing.xl,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        ...GlossyShadows.card,
    },
    reflectionPromptTitle: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.title,
        lineHeight: 30,
        marginTop: Spacing.xs,
    },
    reflectionSubtitle: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
        marginTop: 4,
        marginBottom: Spacing.lg,
    },
    reflectionInput: {
        minHeight: 110,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 23,
        textAlignVertical: 'top',
    },
    reflectionButtonsRow: {
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    saveDraftBtn: {
        minHeight: TouchTarget.minHeight,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveDraftText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    completeButton: {
        minHeight: 52,
        borderRadius: BorderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    completeButtonText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
        letterSpacing: 1.2,
        color: '#FFFFFF',
    },
    confirmationBanner: {
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    confirmationText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    addAdditionalNoteBtn: {
        marginTop: Spacing.lg,
        minHeight: TouchTarget.minHeight,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    addAdditionalNoteText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
    prevNextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.xl,
        gap: Spacing.md,
    },
    navButton: {
        flex: 1,
        minHeight: TouchTarget.minHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    navText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    toastPill: {
        position: 'absolute',
        bottom: 36,
        alignSelf: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    toastText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
});
