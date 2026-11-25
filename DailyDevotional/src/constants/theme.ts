/**
 * Centralized Design System — Glossy White & Black Edition
 *
 * Aesthetic direction: Polished monochrome glass ("Pearl & Piano-Black").
 * Multi-stop specular gradients, crisp top-edge rim highlights, and soft deep
 * ambient elevation in both Light and Dark mode.
 */

export const Colors = {
    light: {
        // Brand & Accents (Polished Piano-Black & Pearl White)
        primary: '#0F0F10',
        primaryDark: '#000000',
        primaryLight: '#3C3C40',
        primarySoft: '#ECEEF2',
        onPrimary: '#FFFFFF',
        accent: '#0F0F10',
        accentLight: '#E4E6EB',
        sage: '#0F0F10',
        sageSoft: '#ECEEF2',

        // Glossy Surfaces
        background: '#F2F4F8',       // Cool pearl backdrop so glossy white cards gleam
        surface: '#FFFFFF',
        surfaceElevated: '#F7F8FA',
        surfaceMuted: '#ECEEF3',
        prayerSurface: '#F9FAFC',

        // Specular & Glass Borders
        border: '#DCE0E8',
        borderHighlight: '#FFFFFF',  // Top specular rim highlight
        divider: '#EBEFF5',
        glassOverlay: 'rgba(255, 255, 255, 0.65)',

        // Text
        text: '#0C0C0E',
        textSecondary: '#4E5058',
        textTertiary: '#8A8D96',

        // Semantic
        success: '#0F0F10',
        warning: '#4E5058',
        error: '#C62828',

        // Highlights
        highlightYellow: '#F5F2E4',
        highlightGreen: '#E8ECEF',
        highlightPink: '#F2EAEB',

        // Chrome
        cardShadow: '#000000',
        overlay: 'rgba(10, 10, 14, 0.48)',
        tabBar: 'rgba(255, 255, 255, 0.96)',
        tabBarBorder: '#DCE0E8',
        statusBar: 'dark-content' as const,

        // Multi-stop Glossy Gradients
        gradients: {
            primaryButton: ['#3E3E42', '#17171A', '#050506'] as const,
            card: ['#FFFFFF', '#FDFDFE', '#F5F7FA'] as const,
            softCard: ['#FFFFFF', '#F7F9FC', '#EFF2F7'] as const,
            headerSheen: ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'] as const,
        },
    },
    dark: {
        // Brand & Accents (Obsidian Glass & Specular Pearl)
        primary: '#FFFFFF',
        primaryDark: '#E2E4EC',
        primaryLight: '#AEAFB8',
        primarySoft: '#232429',
        onPrimary: '#0A0A0C',
        accent: '#FFFFFF',
        accentLight: '#282930',
        sage: '#FFFFFF',
        sageSoft: '#232429',

        // Glossy Surfaces
        background: '#060608',       // Deep obsidian
        surface: '#131317',          // Smoked glass surface
        surfaceElevated: '#1D1E24',
        surfaceMuted: '#17181C',
        prayerSurface: '#15161B',

        // Specular & Glass Borders
        border: 'rgba(255, 255, 255, 0.14)',
        borderHighlight: 'rgba(255, 255, 255, 0.30)',
        divider: 'rgba(255, 255, 255, 0.08)',
        glassOverlay: 'rgba(255, 255, 255, 0.07)',

        // Text
        text: '#FFFFFF',
        textSecondary: '#A8ABB5',
        textTertiary: '#6C6F7A',

        // Semantic
        success: '#FFFFFF',
        warning: '#D0D2DC',
        error: '#FF5252',

        // Highlights
        highlightYellow: '#2B2920',
        highlightGreen: '#23252A',
        highlightPink: '#2C2326',

        // Chrome
        cardShadow: '#000000',
        overlay: 'rgba(0, 0, 0, 0.78)',
        tabBar: '#0C0C0F',
        tabBarBorder: 'rgba(255, 255, 255, 0.14)',
        statusBar: 'light-content' as const,

        // Multi-stop Glossy Gradients
        gradients: {
            primaryButton: ['#FFFFFF', '#F2F4F8', '#D8DCE6'] as const,
            card: ['#23242B', '#15161B', '#0F1014'] as const,
            softCard: ['#1E1F26', '#14151A', '#101115'] as const,
            headerSheen: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] as const,
        },
    },
};

export const GlossyShadows = {
    card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 6,
    },
    cardDark: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.55,
        shadowRadius: 22,
        elevation: 8,
    },
    button: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 6,
    },
    pill: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.09,
        shadowRadius: 10,
        elevation: 3,
    },
};

export const Typography = {
    fontFamily: {
        regular: 'Inter_400Regular',
        medium: 'Inter_500Medium',
        semiBold: 'Inter_600SemiBold',
        bold: 'Inter_700Bold',
        serifRegular: 'Lora_400Regular',
        serifMedium: 'Lora_500Medium',
        serifSemiBold: 'Lora_600SemiBold',
        serifBold: 'Lora_700Bold',
        serifItalic: 'Lora_400Regular_Italic',
    },
    sizes: {
        micro: 11,
        caption: 13,
        body: 16,
        reading: 18,
        subtitle: 19,
        title: 23,
        heading: 28,
        hero: 34,
    },
    lineHeights: {
        micro: 15,
        caption: 18,
        body: 24,
        reading: 31,
        subtitle: 27,
        title: 31,
        heading: 36,
        hero: 42,
    },
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
};

export const BorderRadius = {
    xs: 6,
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    full: 9999,
};

export const TouchTarget = {
    minHeight: 44,
    minWidth: 44,
};

export type ThemeMode = 'light' | 'dark';
export type ThemeColors = typeof Colors.light | typeof Colors.dark;
