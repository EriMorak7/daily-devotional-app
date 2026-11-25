import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, ThemeColors } from '../constants/theme';
import { useSettingsStore } from '../store/settingsStore';
import { scaleFont } from '../types';

interface StateViewProps {
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    colors: ThemeColors;
    compact?: boolean;
}

export function EmptyState({
    title,
    message,
    actionLabel,
    onAction,
    icon = 'book-outline',
    colors,
    compact = false,
}: StateViewProps) {
    const fontSize = useSettingsStore((s) => s.fontSize);
    return (
        <View
            style={[styles.container, compact && styles.compactContainer]}
            accessible
            accessibilityRole="summary"
        >
            <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={icon} size={compact ? 22 : 28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontSize: scaleFont(Typography.sizes.subtitle, fontSize) }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary, fontSize: scaleFont(Typography.sizes.body, fontSize), lineHeight: Math.round(scaleFont(Typography.sizes.body, fontSize) * 1.45) }]}>{message}</Text>
            {actionLabel && onAction && (
                <TouchableOpacity
                    style={[
                        styles.button,
                        {
                            backgroundColor: colors.primary,
                            borderColor: colors.borderHighlight,
                        },
                    ]}
                    onPress={onAction}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                >
                    <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export function ErrorState({
    title = 'Unable to load content',
    message,
    actionLabel = 'Retry',
    onAction,
    icon = 'cloud-offline-outline',
    colors,
    compact = false,
}: StateViewProps) {
    return (
        <View
            style={[styles.container, compact && styles.compactContainer]}
            accessible
            accessibilityRole="alert"
        >
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name={icon} size={compact ? 22 : 28} color={colors.error} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
            {onAction && (
                <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={onAction}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                >
                    <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                    <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{actionLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

export function LoadingState({
    label = 'Preparing your devotional...',
    colors,
    compact = false,
}: {
    label?: string;
    colors: ThemeColors;
    compact?: boolean;
}) {
    return (
        <View style={[styles.container, compact && styles.compactContainer]}>
            <ActivityIndicator size={compact ? 'small' : 'large'} color={colors.primary} />
            <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

export function DevotionalSkeleton({ darkMode }: { darkMode: boolean }) {
    const colors = darkMode ? Colors.dark : Colors.light;
    const blockBg = colors.surfaceElevated;

    return (
        <View style={styles.skeletonWrapper} accessibilityLabel="Loading devotional content">
            <View style={[styles.skeletonLine, { width: 110, height: 14, backgroundColor: blockBg }]} />
            <View style={[styles.skeletonLine, { width: 170, height: 16, backgroundColor: blockBg, marginTop: 8 }]} />
            <View style={[styles.skeletonLine, { width: '85%', height: 32, backgroundColor: blockBg, marginTop: 24 }]} />
            <View style={[styles.skeletonLine, { width: '55%', height: 18, backgroundColor: blockBg, marginTop: 12 }]} />
            <View style={[styles.skeletonCard, { backgroundColor: blockBg, marginTop: 28 }]} />
            <View style={[styles.skeletonLine, { width: '100%', height: 50, backgroundColor: blockBg, marginTop: 20, borderRadius: BorderRadius.md }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xxxl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactContainer: {
        paddingVertical: Spacing.xl,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontFamily: Typography.fontFamily.serifSemiBold,
        fontSize: Typography.sizes.subtitle,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    message: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: Typography.lineHeights.body,
        textAlign: 'center',
        maxWidth: 320,
    },
    button: {
        marginTop: Spacing.xl,
        minHeight: TouchTarget.minHeight,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
        elevation: 6,
    },
    buttonText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
        color: '#FFFFFF',
    },
    secondaryButton: {
        marginTop: Spacing.lg,
        minHeight: TouchTarget.minHeight,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    secondaryButtonText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
    },
    loadingLabel: {
        marginTop: Spacing.md,
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
    },
    skeletonWrapper: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xxl,
    },
    skeletonLine: {
        borderRadius: BorderRadius.xs,
    },
    skeletonCard: {
        width: '100%',
        height: 120,
        borderRadius: BorderRadius.lg,
    },
});
