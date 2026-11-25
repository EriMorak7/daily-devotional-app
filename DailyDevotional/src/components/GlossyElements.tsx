import React from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    ViewStyle,
    StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, GlossyShadows, Spacing } from '../constants/theme';

interface GlossyCardProps {
    darkMode: boolean;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    soft?: boolean;
    onPress?: () => void;
    accessibilityLabel?: string;
}

/**
 * Glossy glass-finish container with a multi-stop vertical gradient,
 * a bright top specular rim highlight, and deep soft drop shadow.
 */
export function GlossyCard({
    darkMode,
    children,
    style,
    soft = false,
    onPress,
    accessibilityLabel,
}: GlossyCardProps) {
    const colors = darkMode ? Colors.dark : Colors.light;
    const shadow = darkMode ? GlossyShadows.cardDark : GlossyShadows.card;
    const gradientColors = soft ? colors.gradients.softCard : colors.gradients.card;

    const content = (
        <LinearGradient
            colors={[...gradientColors]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={[
                styles.cardInner,
                {
                    borderColor: colors.border,
                    borderTopColor: colors.borderHighlight,
                },
                style,
            ]}
        >
            {/* Top specular sheen reflection */}
            <LinearGradient
                colors={[...colors.gradients.headerSheen]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                pointerEvents="none"
                style={styles.topSheen}
            />
            {children}
        </LinearGradient>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                activeOpacity={0.86}
                onPress={onPress}
                style={[styles.shadowWrap, shadow]}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return <View style={[styles.shadowWrap, shadow]}>{content}</View>;
}

interface GlossyButtonProps {
    darkMode: boolean;
    onPress: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    accessibilityLabel?: string;
}

/**
 * Piano-black (in light mode) or pearl-white (in dark mode) glossy pill button
 * with an upper glass highlight reflection and rich elevation.
 */
export function GlossyButton({
    darkMode,
    onPress,
    disabled,
    children,
    style,
    accessibilityLabel,
}: GlossyButtonProps) {
    const colors = darkMode ? Colors.dark : Colors.light;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.88}
            style={[
                styles.buttonShadow,
                GlossyShadows.button,
                disabled && { opacity: 0.55 },
                style,
            ]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <LinearGradient
                colors={[...colors.gradients.primaryButton]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[
                    styles.buttonGradient,
                    {
                        borderColor: darkMode
                            ? '#FFFFFF'
                            : 'rgba(255, 255, 255, 0.25)',
                    },
                ]}
            >
                {/* Upper specular glass shine across top half of pill */}
                <LinearGradient
                    colors={
                        darkMode
                            ? ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']
                            : ['rgba(255,255,255,0.26)', 'rgba(255,255,255,0.02)']
                    }
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    pointerEvents="none"
                    style={styles.buttonTopGloss}
                />
                {children}
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    shadowWrap: {
        borderRadius: BorderRadius.lg,
    },
    cardInner: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderTopWidth: 1.5,
        padding: Spacing.xl,
        overflow: 'hidden',
    },
    topSheen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 44,
    },
    buttonShadow: {
        borderRadius: BorderRadius.full,
    },
    buttonGradient: {
        minHeight: 52,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        overflow: 'hidden',
    },
    buttonTopGloss: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '52%',
    },
});
