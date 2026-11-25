import React, { useCallback, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, AccessibilityInfo } from 'react-native';
import {
    useFonts,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    Lora_400Regular_Italic,
} from '@expo-google-fonts/lora';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import AppNavigator from './src/navigation/AppNavigator';
import { Colors } from './src/constants/theme';
import { useSettingsStore } from './src/store/settingsStore';
import { setupAuthListener } from './src/services/auth';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
    const [fontsLoaded] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        Lora_400Regular,
        Lora_500Medium,
        Lora_600SemiBold,
        Lora_700Bold,
        Lora_400Regular_Italic,
    });

    const hydrateSettings = useSettingsStore((s) => s.hydrate);
    const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
    const darkMode = useSettingsStore((s) => s.darkMode);

    useEffect(() => {
        void hydrateSettings();
        const unsubscribeAuth = setupAuthListener();

        AccessibilityInfo.isReduceMotionEnabled()
            .then((enabled) => setReducedMotion(Boolean(enabled)))
            .catch(() => {});

        const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
            setReducedMotion(Boolean(enabled));
        });

        return () => {
            unsubscribeAuth();
            sub?.remove?.();
        };
    }, [hydrateSettings, setReducedMotion]);

    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded) {
            await SplashScreen.hideAsync().catch(() => {});
        }
    }, [fontsLoaded]);

    const colors = darkMode ? Colors.dark : Colors.light;

    if (!fontsLoaded) {
        return (
            <View style={[styles.loading, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <View style={[styles.container, { backgroundColor: colors.background }]} onLayout={onLayoutRootView}>
                <AppNavigator />
            </View>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
