import { Devotional, DevotionalSeries, DevotionalStatus } from '../types';
import { coerceToDateKey, dateKeyForSeriesDay, toLocalDateKey } from '../lib/date';

const DEFAULT_REFLECTION_PROMPT = 'What is God teaching you through this passage today?';

function timestampToIso(value: unknown, fallback: string): string {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
        try {
            return (value as { toDate: () => Date }).toDate().toISOString();
        } catch {
            return fallback;
        }
    }
    return fallback;
}

/**
 * Normalizes a raw Firestore devotional document into the strict `Devotional` interface,
 * seamlessly supporting both the new production schema and legacy MVP documents.
 */
export function normalizeDevotional(
    id: string,
    raw: Record<string, unknown>,
    series?: DevotionalSeries | null
): Devotional {
    const nowIso = new Date().toISOString();
    const dayNumberRaw = typeof raw.dayNumber === 'number'
        ? raw.dayNumber
        : typeof raw.day === 'number'
            ? raw.day
            : 1;
    const dayNumber = Math.max(1, Math.floor(dayNumberRaw));

    const computedFallbackDate = series?.startDate
        ? dateKeyForSeriesDay(series.startDate, dayNumber)
        : toLocalDateKey();

    const date = coerceToDateKey(raw.date, computedFallbackDate);

    const scriptureReference =
        (typeof raw.scriptureReference === 'string' && raw.scriptureReference.trim()) ||
        (typeof raw.scripture === 'string' && raw.scripture.trim()) ||
        '';

    const rawStatus = typeof raw.status === 'string' ? raw.status : undefined;
    let status: DevotionalStatus = 'published';
    if (rawStatus === 'draft' || rawStatus === 'archived' || rawStatus === 'published') {
        status = rawStatus;
    } else if (rawStatus === 'scheduled') {
        status = 'published';
    } else if (typeof raw.published === 'boolean') {
        status = raw.published ? 'published' : 'draft';
    }

    const published = status === 'published';

    const tags = Array.isArray(raw.tags)
        ? raw.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];

    const reflectionPrompt =
        typeof raw.reflectionPrompt === 'string' && raw.reflectionPrompt.trim().length > 0
            ? raw.reflectionPrompt.trim()
            : DEFAULT_REFLECTION_PROMPT;

    return {
        id,
        seriesId: typeof raw.seriesId === 'string' ? raw.seriesId : series?.id ?? null,
        dayNumber,
        day: dayNumber,
        date,
        title: typeof raw.title === 'string' ? raw.title.trim() : 'Untitled Devotional',
        scriptureReference,
        scripture: scriptureReference,
        scriptureText: typeof raw.scriptureText === 'string' ? raw.scriptureText.trim() : '',
        body: typeof raw.body === 'string' ? raw.body.trim() : '',
        prayer: typeof raw.prayer === 'string' ? raw.prayer.trim() : '',
        reflectionPrompt,
        author: typeof raw.author === 'string' && raw.author.trim() ? raw.author.trim() : 'Church Pastoral Team',
        tags,
        coverImage: typeof raw.coverImage === 'string' && raw.coverImage.trim() ? raw.coverImage.trim() : null,
        audioUrl: typeof raw.audioUrl === 'string' && raw.audioUrl.trim() ? raw.audioUrl.trim() : null,
        status,
        published,
        publishedAt: raw.publishedAt ? timestampToIso(raw.publishedAt, nowIso) : null,
        createdAt: timestampToIso(raw.createdAt, nowIso),
        updatedAt: timestampToIso(raw.updatedAt, nowIso),
    };
}

export function normalizeSeries(id: string, raw: Record<string, unknown>): DevotionalSeries {
    const nowIso = new Date().toISOString();
    const rawStatus = typeof raw.status === 'string' ? raw.status : 'active';
    const status: DevotionalSeries['status'] =
        rawStatus === 'draft' || rawStatus === 'archived' || rawStatus === 'active'
            ? rawStatus
            : 'active';

    return {
        id,
        title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Daily Walk',
        description: typeof raw.description === 'string' ? raw.description.trim() : '',
        startDate: coerceToDateKey(raw.startDate, toLocalDateKey()),
        totalDays: typeof raw.totalDays === 'number' ? raw.totalDays : null,
        status,
        coverImage: typeof raw.coverImage === 'string' ? raw.coverImage : null,
        createdAt: timestampToIso(raw.createdAt, nowIso),
        updatedAt: timestampToIso(raw.updatedAt, nowIso),
    };
}
