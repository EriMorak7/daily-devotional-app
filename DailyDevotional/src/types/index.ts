// ─── Devotional & Series Content ──────────────────────────────
export type DevotionalStatus = 'draft' | 'published' | 'archived';

export interface DevotionalSeries {
    id: string;
    title: string;
    description: string;
    startDate: string; // YYYY-MM-DD (local calendar date for Day 1)
    totalDays?: number | null;
    status: 'draft' | 'active' | 'archived';
    coverImage?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface Devotional {
    id: string;
    seriesId: string | null;
    dayNumber: number;
    /** Legacy alias kept for compatibility */
    day: number;
    date: string; // YYYY-MM-DD
    title: string;
    scriptureReference: string;
    /** Legacy alias kept for compatibility */
    scripture: string;
    scriptureText: string;
    body: string;
    prayer: string;
    reflectionPrompt: string;
    author: string;
    tags: string[];
    coverImage?: string | null;
    audioUrl?: string | null;
    status: DevotionalStatus;
    published: boolean;
    publishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AppPublicConfig {
    activeSeriesId: string | null;
    churchName: string;
    updatedAt?: string;
}

// ─── User, Streak & Progress Models ───────────────────────────
export interface UserProgress {
    currentStreak: number;
    longestStreak: number;
    totalCompleted: number;
    lastCompletedDate: string | null; // YYYY-MM-DD in user's local calendar
}

export interface NotificationPreferences {
    dailyDevotional: boolean;
    streakReminder: boolean;
    newDevotional: boolean;
    replies: boolean;
    community: boolean;
    reminderTime: string; // "HH:MM"
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
    dailyDevotional: true,
    streakReminder: true,
    newDevotional: true,
    replies: true,
    community: false,
    reminderTime: '07:00',
};

export interface UserProfile {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    churchAffiliation?: string;
    timezone: string;
    progress: UserProgress;
    notificationPrefs: NotificationPreferences;
    /** Legacy mirror fields for backwards compatibility */
    streak: number;
    lastReadDate?: string;
    isGuest: boolean;
    createdAt: string;
    updatedAt?: string;
}

export interface DevotionalCompletion {
    date: string; // YYYY-MM-DD (local calendar date, also doc ID)
    devotionalId: string;
    devotionalTitle: string;
    scriptureReference: string;
    dayNumber?: number;
    completedAt: string; // ISO timestamp
    timezone: string;
}

// ─── Journal (Notes, Reflections & Highlights) ────────────────
export type HighlightColor = 'yellow' | 'green' | 'pink';

export interface Highlight {
    id: string;
    userId: string;
    devotionalId: string;
    devotionalTitle?: string;
    scriptureReference?: string;
    devotionalDate?: string;
    section?: 'scripture' | 'body' | 'prayer';
    paragraphIndex?: number;
    text: string;
    color: HighlightColor;
    startOffset: number;
    endOffset: number;
    createdAt: string;
}

export type NoteKind = 'reflection' | 'note';

export interface Note {
    id: string;
    userId: string;
    devotionalId: string;
    devotionalTitle?: string;
    scriptureReference?: string;
    devotionalDate?: string; // YYYY-MM-DD
    dayNumber?: number;
    seriesId?: string | null;
    kind: NoteKind;
    content: string;
    highlightText?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Bookmark {
    devotionalId: string;
    userId: string;
    title: string;
    scriptureReference: string;
    date: string;
    dayNumber: number;
    createdAt: string;
}

// ─── Community (Firestore-backed reflections & replies) ───────
export type ReactionKey = 'amen' | 'heart' | 'fire';

export interface CommunityReactions {
    amen: string[];  // 🙏 Amen
    heart: string[]; // ❤️
    fire: string[];  // 🔥
}

export interface CommunityComment {
    id: string;
    devotionalId: string;
    authorId: string;
    authorName: string;
    authorPhoto?: string | null;
    parentId: string | null;
    content: string;
    reactions: CommunityReactions;
    status: 'visible' | 'hidden';
    edited: boolean;
    createdAt: string;
    updatedAt?: string;
}

/** Legacy type aliases so untouched references compile */
export type Comment = CommunityComment;
export type Reactions = CommunityReactions;

// ─── Settings ─────────────────────────────────────────────────
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface UserSettings {
    fontSize: FontSize;
    darkMode: boolean;
    notificationEnabled: boolean;
    notificationTime: string; // "HH:MM"
    notificationPrefs: NotificationPreferences;
    reducedMotion: boolean;
}

export const FONT_SIZE_VALUES: Record<FontSize, number> = {
    small: 14,
    medium: 17,
    large: 20,
    xlarge: 24,
};

export const FONT_SCALE_FACTORS: Record<FontSize, number> = {
    small: 0.86,
    medium: 1.0,
    large: 1.18,
    xlarge: 1.36,
};

export function scaleFont(baseSize: number, fontSize: FontSize): number {
    return Math.round(baseSize * (FONT_SCALE_FACTORS[fontSize] || 1));
}
