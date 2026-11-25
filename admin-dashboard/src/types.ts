export type DevotionalStatus = 'draft' | 'published' | 'archived';

export interface DevotionalSeries {
    id: string;
    title: string;
    description: string;
    startDate: string; // YYYY-MM-DD (Day 1 of series)
    totalDays: number | null;
    status: 'draft' | 'active' | 'archived';
    coverImage: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface DevotionalEntry {
    id: string;
    seriesId: string | null;
    dayNumber: number;
    date: string; // YYYY-MM-DD
    title: string;
    scriptureReference: string;
    scriptureText: string;
    body: string;
    prayer: string;
    reflectionPrompt: string;
    author: string;
    tags: string[];
    coverImage: string | null;
    audioUrl: string | null;
    status: DevotionalStatus;
    published: boolean;
    publishedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface AppPublicConfig {
    activeSeriesId: string | null;
    churchName: string;
    updatedAt?: string;
}

export interface CommunityCommentDoc {
    id: string;
    devotionalId: string;
    authorId: string;
    authorName: string;
    parentId: string | null;
    content: string;
    reactions: {
        amen: string[];
        heart: string[];
        fire: string[];
    };
    status: 'visible' | 'hidden';
    createdAt: string;
}

export interface ModerationReport {
    id: string;
    commentId: string;
    devotionalId: string;
    reporterId: string;
    reason: string;
    status: 'open' | 'resolved';
    createdAt: string;
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

export function toLocalDateKey(d: Date = new Date()): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isValidDateKey(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const utcMs = Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + days);
    const dt = new Date(utcMs);
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function daysBetweenDateKeys(startDateKey: string, endDateKey: string): number {
    const [y1, m1, d1] = startDateKey.split('-').map(Number);
    const [y2, m2, d2] = endDateKey.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

export function coerceToDateKey(raw: unknown, fallback = toLocalDateKey()): string {
    if (isValidDateKey(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        const dt = new Date(raw.trim());
        if (!isNaN(dt.getTime())) return toLocalDateKey(dt);
    }
    return fallback;
}

export function timestampToIso(value: unknown): string {
    if (!value) return new Date().toISOString();
    if (typeof value === 'string') return value;
    if (
        typeof value === 'object' &&
        value !== null &&
        'toDate' in value &&
        typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
        try {
            return (value as { toDate: () => Date }).toDate().toISOString();
        } catch {
            return new Date().toISOString();
        }
    }
    return new Date().toISOString();
}

export function normalizeDevotionalDoc(
    id: string,
    raw: Record<string, unknown>,
    seriesStartDate?: string
): DevotionalEntry {
    const dayRaw =
        typeof raw.dayNumber === 'number'
            ? raw.dayNumber
            : typeof raw.day === 'number'
                ? raw.day
                : 1;
    const dayNumber = Math.max(1, Math.floor(dayRaw));

    const fallbackDate =
        seriesStartDate && isValidDateKey(seriesStartDate)
            ? addDaysToDateKey(seriesStartDate, dayNumber - 1)
            : toLocalDateKey();

    const date = coerceToDateKey(raw.date, fallbackDate);

    const scriptureReference =
        (typeof raw.scriptureReference === 'string' && raw.scriptureReference.trim()) ||
        (typeof raw.scripture === 'string' && raw.scripture.trim()) ||
        '';

    const rawStatus = typeof raw.status === 'string' ? raw.status : 'draft';
    let status: DevotionalStatus = 'draft';
    if (rawStatus === 'published' || rawStatus === 'archived' || rawStatus === 'draft') {
        status = rawStatus;
    } else if (rawStatus === 'scheduled') {
        status = 'published';
    } else if (raw.published === true) {
        status = 'published';
    }

    const tags = Array.isArray(raw.tags)
        ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];

    return {
        id,
        seriesId: typeof raw.seriesId === 'string' ? raw.seriesId : null,
        dayNumber,
        date,
        title: typeof raw.title === 'string' ? raw.title : '',
        scriptureReference,
        scriptureText: typeof raw.scriptureText === 'string' ? raw.scriptureText : '',
        body: typeof raw.body === 'string' ? raw.body : '',
        prayer: typeof raw.prayer === 'string' ? raw.prayer : '',
        reflectionPrompt:
            typeof raw.reflectionPrompt === 'string' && raw.reflectionPrompt.trim()
                ? raw.reflectionPrompt
                : 'What is God teaching you through this passage today?',
        author: typeof raw.author === 'string' && raw.author.trim() ? raw.author : 'Pastoral Team',
        tags,
        coverImage: typeof raw.coverImage === 'string' && raw.coverImage.trim() ? raw.coverImage : null,
        audioUrl: typeof raw.audioUrl === 'string' && raw.audioUrl.trim() ? raw.audioUrl : null,
        status,
        published: status === 'published',
        publishedAt: raw.publishedAt ? timestampToIso(raw.publishedAt) : null,
        createdAt: timestampToIso(raw.createdAt),
        updatedAt: timestampToIso(raw.updatedAt),
    };
}
