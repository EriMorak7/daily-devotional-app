import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Colors, Typography } from '../constants/theme';
import { Devotional } from '../types';

// Screens
import HomeScreen from '../screens/HomeScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import NotesScreen from '../screens/NotesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DevotionalScreen from '../screens/DevotionalScreen';
import ReadingHistoryScreen from '../screens/ReadingHistoryScreen';
import AuthScreen from '../screens/AuthScreen';

export type MainTabParamList = {
    Today: undefined;
    Archive: undefined;
    Journal: undefined;
    Profile: undefined;
};

export type RootStackParamList = {
    Auth: undefined;
    MainTabs: undefined;
    Devotional: {
        devotional?: Devotional;
        focusReflection?: boolean;
        focusCommunity?: boolean;
    };
    ReadingHistory: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
    const darkMode = useSettingsStore((s) => s.darkMode);
    const colors = darkMode ? Colors.dark : Colors.light;

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.tabBar,
                    borderTopColor: colors.borderHighlight,
                    borderTopWidth: 1.5,
                    paddingBottom: 10,
                    paddingTop: 8,
                    height: 68,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: darkMode ? 0.45 : 0.08,
                    shadowRadius: 16,
                    elevation: 10,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarLabelStyle: {
                    fontFamily: Typography.fontFamily.medium,
                    fontSize: 11,
                    marginTop: 2,
                },
                tabBarIcon: ({ focused, color }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'sunny-outline';

                    switch (route.name) {
                        case 'Today':
                            iconName = focused ? 'sunny' : 'sunny-outline';
                            break;
                        case 'Archive':
                            iconName = focused ? 'library' : 'library-outline';
                            break;
                        case 'Journal':
                            iconName = focused ? 'book' : 'book-outline';
                            break;
                        case 'Profile':
                            iconName = focused ? 'person' : 'person-outline';
                            break;
                    }

                    return <Ionicons name={iconName} size={21} color={color} />;
                },
            })}
        >
            <Tab.Screen
                name="Today"
                component={HomeScreen}
                options={{ tabBarAccessibilityLabel: 'Today devotional tab' }}
            />
            <Tab.Screen
                name="Archive"
                component={ArchiveScreen}
                options={{ tabBarAccessibilityLabel: 'Devotional archive tab' }}
            />
            <Tab.Screen
                name="Journal"
                component={NotesScreen}
                options={{ tabBarAccessibilityLabel: 'Personal journal tab' }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarAccessibilityLabel: 'Profile and preferences tab' }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const darkMode = useSettingsStore((s) => s.darkMode);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const isInitializing = useAuthStore((s) => s.isInitializing);
    const colors = darkMode ? Colors.dark : Colors.light;

    if (isInitializing) {
        return (
            <View style={[styles.splashWait, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const lightTheme = {
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            background: Colors.light.background,
            card: Colors.light.surface,
            text: Colors.light.text,
            border: Colors.light.border,
            primary: Colors.light.primary,
        },
    };

    const darkThemeCustom = {
        ...DarkTheme,
        colors: {
            ...DarkTheme.colors,
            background: Colors.dark.background,
            card: Colors.dark.surface,
            text: Colors.dark.text,
            border: Colors.dark.border,
            primary: Colors.dark.primary,
        },
    };

    return (
        <NavigationContainer theme={darkMode ? darkThemeCustom : lightTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!isAuthenticated ? (
                    <Stack.Screen
                        name="Auth"
                        component={AuthScreen}
                        options={{ animation: 'fade' }}
                    />
                ) : (
                    <>
                        <Stack.Screen name="MainTabs" component={MainTabs} />
                        <Stack.Screen
                            name="Devotional"
                            component={DevotionalScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                        <Stack.Screen
                            name="ReadingHistory"
                            component={ReadingHistoryScreen}
                            options={{ animation: 'slide_from_right' }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    splashWait: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
