import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, TouchTarget, GlossyShadows } from '../constants/theme';
import { GlossyCard, GlossyButton } from '../components/GlossyElements';
import { useSettingsStore } from '../store/settingsStore';
import { registerWithEmail, loginWithEmail, continueAsGuest } from '../services/auth';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
    const insets = useSafeAreaInsets();
    const [mode, setMode] = useState<AuthMode>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const darkMode = useSettingsStore((s) => s.darkMode);
    const colors = darkMode ? Colors.dark : Colors.light;

    const handleSubmit = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Missing Fields', 'Please enter your email address and password.');
            return;
        }

        if (mode === 'register') {
            if (!name.trim()) {
                Alert.alert('Missing Name', 'Please enter your name.');
                return;
            }
            if (password !== confirmPassword) {
                Alert.alert('Password Mismatch', 'Your passwords do not match.');
                return;
            }
            if (password.length < 6) {
                Alert.alert('Weak Password', 'Password must be at least 6 characters.');
                return;
            }
        }

        setLoading(true);
        try {
            if (mode === 'register') {
                await registerWithEmail(email.trim(), password, name.trim());
            } else {
                await loginWithEmail(email.trim(), password);
            }
        } catch (error: unknown) {
            const rawMsg = error instanceof Error ? error.message : String(error);
            const message = rawMsg.includes('auth/')
                ? formatFirebaseError(rawMsg)
                : 'Unable to sign in right now. Please check your connection and try again.';
            Alert.alert('Authentication Error', message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuest = () => {
        void continueAsGuest();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.statusBar} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingTop: Math.max(insets.top + 32, 64) },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Editorial Brand Header */}
                    <View style={styles.brandSection}>
                        <View
                            style={[
                                styles.iconBadge,
                                { backgroundColor: colors.primarySoft, borderColor: colors.border },
                            ]}
                        >
                            <Ionicons name="sunny-outline" size={28} color={colors.primary} />
                        </View>
                        <Text style={[styles.eyebrow, { color: colors.primary }]}>
                            CHURCH DAILY DEVOTIONAL
                        </Text>
                        <Text style={[styles.title, { color: colors.text }]}>
                            A Quiet Moment in the Word
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Read Scripture, reflect in your personal journal, and walk in faith with your church community.
                        </Text>
                    </View>

                    {/* Form Card */}
                    <GlossyCard darkMode={darkMode} style={styles.formCard}>
                        {/* Mode Switcher */}
                        <View
                            style={[
                                styles.modeTabs,
                                { backgroundColor: colors.surfaceElevated },
                            ]}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.modeTab,
                                    mode === 'login' && { backgroundColor: colors.primary },
                                ]}
                                onPress={() => setMode('login')}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: mode === 'login' }}
                            >
                                <Text
                                    style={[
                                        styles.modeTabText,
                                        { color: mode === 'login' ? colors.onPrimary : colors.textSecondary },
                                    ]}
                                >
                                    Sign In
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modeTab,
                                    mode === 'register' && { backgroundColor: colors.primary },
                                ]}
                                onPress={() => setMode('register')}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: mode === 'register' }}
                            >
                                <Text
                                    style={[
                                        styles.modeTabText,
                                        {
                                            color:
                                                mode === 'register'
                                                    ? colors.onPrimary
                                                    : colors.textSecondary,
                                        },
                                    ]}
                                >
                                    Create Account
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {mode === 'register' && (
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Full Name
                                </Text>
                                <View
                                    style={[
                                        styles.inputContainer,
                                        {
                                            borderColor: colors.border,
                                            backgroundColor: colors.background,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="person-outline"
                                        size={18}
                                        color={colors.textTertiary}
                                    />
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="Your name"
                                        placeholderTextColor={colors.textTertiary}
                                        autoCapitalize="words"
                                        accessibilityLabel="Full name"
                                    />
                                </View>
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                Email Address
                            </Text>
                            <View
                                style={[
                                    styles.inputContainer,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor: colors.background,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="mail-outline"
                                    size={18}
                                    color={colors.textTertiary}
                                />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="you@example.com"
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    accessibilityLabel="Email address"
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                Password
                            </Text>
                            <View
                                style={[
                                    styles.inputContainer,
                                    {
                                        borderColor: colors.border,
                                        backgroundColor: colors.background,
                                    },
                                ]}
                            >
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={18}
                                    color={colors.textTertiary}
                                />
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.textTertiary}
                                    secureTextEntry={!showPassword}
                                    accessibilityLabel="Password"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    accessibilityRole="button"
                                    accessibilityLabel={
                                        showPassword ? 'Hide password' : 'Show password'
                                    }
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={18}
                                        color={colors.textTertiary}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {mode === 'register' && (
                            <View style={styles.inputGroup}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                                    Confirm Password
                                </Text>
                                <View
                                    style={[
                                        styles.inputContainer,
                                        {
                                            borderColor: colors.border,
                                            backgroundColor: colors.background,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={18}
                                        color={colors.textTertiary}
                                    />
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="••••••••"
                                        placeholderTextColor={colors.textTertiary}
                                        secureTextEntry={!showPassword}
                                        accessibilityLabel="Confirm password"
                                    />
                                </View>
                            </View>
                        )}

                        <GlossyButton
                            darkMode={darkMode}
                            onPress={handleSubmit}
                            disabled={loading}
                            style={{ marginTop: Spacing.sm }}
                            accessibilityLabel={mode === 'login' ? 'Sign In' : 'Create Account'}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.onPrimary} />
                            ) : (
                                <Text style={[styles.submitText, { color: colors.onPrimary }]}>
                                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                                </Text>
                            )}
                        </GlossyButton>

                        <View style={styles.dividerRow}>
                            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>
                                or
                            </Text>
                            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        </View>

                        <TouchableOpacity
                            onPress={handleGuest}
                            style={[
                                styles.guestButton,
                                {
                                    borderColor: colors.border,
                                    backgroundColor: colors.surfaceElevated,
                                },
                            ]}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Continue as guest"
                        >
                            <Ionicons
                                name="book-outline"
                                size={18}
                                color={colors.textSecondary}
                            />
                            <Text style={[styles.guestText, { color: colors.text }]}>
                                Continue as Guest
                            </Text>
                        </TouchableOpacity>
                    </GlossyCard>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

function formatFirebaseError(message: string): string {
    if (message.includes('user-not-found') || message.includes('invalid-credential')) {
        return 'Incorrect email or password.';
    }
    if (message.includes('wrong-password')) return 'Incorrect password.';
    if (message.includes('email-already-in-use')) {
        return 'An account with this email already exists.';
    }
    if (message.includes('invalid-email')) return 'Please enter a valid email address.';
    if (message.includes('weak-password')) {
        return 'Password is too weak. Use at least 6 characters.';
    }
    if (message.includes('too-many-requests')) {
        return 'Too many attempts. Please wait a moment and try again.';
    }
    if (message.includes('network-request-failed')) {
        return 'Network error. Please check your connection.';
    }
    return 'Authentication failed. Please try again.';
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xxxl,
    },
    brandSection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    iconBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    eyebrow: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.micro,
        letterSpacing: 1.6,
    },
    title: {
        fontFamily: Typography.fontFamily.serifBold,
        fontSize: Typography.sizes.heading,
        lineHeight: Typography.lineHeights.heading,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    subtitle: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        lineHeight: 23,
        textAlign: 'center',
        marginTop: Spacing.sm,
        maxWidth: 320,
    },
    formCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        padding: Spacing.xl,
    },
    modeTabs: {
        flexDirection: 'row',
        borderRadius: BorderRadius.md,
        padding: 4,
        marginBottom: Spacing.xl,
    },
    modeTab: {
        flex: 1,
        minHeight: 40,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeTabText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.caption,
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    inputLabel: {
        fontFamily: Typography.fontFamily.medium,
        fontSize: Typography.sizes.caption,
        marginBottom: 6,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        minHeight: 48,
        gap: Spacing.sm,
    },
    input: {
        flex: 1,
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.body,
        paddingVertical: Spacing.sm,
    },
    submitButton: {
        marginTop: Spacing.sm,
        minHeight: 50,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
        color: '#FFFFFF',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
        gap: Spacing.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontFamily: Typography.fontFamily.regular,
        fontSize: Typography.sizes.caption,
    },
    guestButton: {
        minHeight: TouchTarget.minHeight,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    guestText: {
        fontFamily: Typography.fontFamily.semiBold,
        fontSize: Typography.sizes.body,
    },
});
