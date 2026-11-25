import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HighlightColor } from '../types';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget } from '../constants/theme';

interface HighlightPickerProps {
    visible: boolean;
    selectedText?: string;
    onSelectColor: (color: HighlightColor) => void;
    onCopyPassage?: () => void;
    onAddNoteForPassage?: () => void;
    onDismiss: () => void;
    darkMode: boolean;
}

const HIGHLIGHT_COLORS: { key: HighlightColor; light: string; dark: string; label: string }[] = [
    { key: 'yellow', light: Colors.light.highlightYellow, dark: Colors.dark.highlightYellow, label: 'Gold' },
    { key: 'green', light: Colors.light.highlightGreen, dark: Colors.dark.highlightGreen, label: 'Sage' },
    { key: 'pink', light: Colors.light.highlightPink, dark: Colors.dark.highlightPink, label: 'Rose' },
];

export default function HighlightPicker({
    visible,
    selectedText,
    onSelectColor,
    onCopyPassage,
    onAddNoteForPassage,
    onDismiss,
    darkMode,
}: HighlightPickerProps) {
    const colors = darkMode ? Colors.dark : Colors.light;

    if (!visible) return null;

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    shadowColor: colors.cardShadow,
                },
            ]}
            accessible
            accessibilityLabel="Highlight passage actions"
        >
            <View style={styles.header}>
                <Ionicons name="color-wand-outline" size={16} color={colors.primary} />
                <Text style={[styles.title, { color: colors.text }]}>Highlight Passage</Text>
                <TouchableOpacity
                    onPress={onDismiss}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close highlight picker"
                >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {selectedText ? (
                <Text
                    style={[styles.previewText, { color: colors.textSecondary }]}
                    numberOfLines={2}
                >
                    “{selectedText}”
                </Text>
            ) : null}

            <View style={styles.colorsRow}>
                {HIGHLIGHT_COLORS.map((hc) => (
                    <TouchableOpacity
                        key={hc.key}
                        style={[
                            styles.colorButton,
                            {
                                backgroundColor: darkMode ? hc.dark : hc.light,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => onSelectColor(hc.key)}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={`Highlight with ${hc.label}`}
                    >
                        <Text style={[styles.colorLabel, { color: colors.text }]}>{hc.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {(onCopyPassage || onAddNoteForPassage) && (
                <View style={styles.extraActionsRow}>
                    {onCopyPassage && (
                        <TouchableOpacity
                            style={[styles.extraBtn, { backgroundColor: colors.surfaceElevated }]}
                            onPress={onCopyPassage}
                            accessibilityRole="button"
                            accessibilityLabel="Copy passage text"
                        >
                            <Ionicons name="copy-outline" size={16} color={colors.text} />
                            <Text style={[styles.extraBtnText, { color: colors.text }]}>Copy</Text>
                        </TouchableOpacity>
                    )}
                    {onAddNoteForPassage && (
                        <TouchableOpacity
                            style={[styles.extraBtn, { backgroundColor: colors.surfaceElevated }]}
                            onPress={onAddNoteForPassage}
                            accessibilityRole="button"
                            accessibilityLabel="Write a note on this passage"
                        >
                            <Ionicons name="create-outline" size={16} color={colors.text} />
                            <Text style={[styles.extraBtnText, { color: colors.text }]}>Add Note</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xxl,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        borderTopWidth: 1,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    title: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
        flex: 1,
    },
    previewText: {
        fontFamily: Typography.fontFamily.serifItalic,
        fontSize: Typography.sizes.caption,
        lineHeight: 19,
        marginBottom: Spacing.md,
    },
    colorsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    colorButton: {
        flex: 1,
        minHeight: TouchTarget.minHeight,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    colorLabel: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    extraActionsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.md,
    },
    extraBtn: {
        flex: 1,
        minHeight: TouchTarget.minHeight,
        borderRadius: BorderRadius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    extraBtnText: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
    },
});
