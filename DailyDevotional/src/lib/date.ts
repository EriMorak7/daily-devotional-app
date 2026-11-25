/**
 * Local calendar date & timezone utilities.
 *
 * IMPORTANT: Never use `new Date().toISOString().split('T')[0]` for daily
 * devotional or streak calculations — that produces a UTC date and causes
 * off-by-one errors across timezones (e.g. WAT UTC+1 around midnight or Americas).
 */

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

function pad2(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Formats a Date into the user's local calendar `YYYY-MM-DD`.
 */
export function toLocalDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
}

/**
 * Checks whether a string is a valid `YYYY-MM-DD` date key.
 */
export function isValidDateKey(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Parses a `YYYY-MM-DD` string into a local Date set at 12:00 noon
 * (noon avoids DST midnight shifts).
 */
export function parseLocalDateKey(dateKey: string): Date {
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Attempts to coerce legacy free-text dates (e.g. "January 1, 2025" or ISO timestamps)
 * into a canonical `YYYY-MM-DD` key. Falls back to `fallbackDateKey`.
 */
export function coerceToDateKey(raw: unknown, fallbackDateKey?: string): string {
    if (isValidDateKey(raw)) return raw;
    if (typeof raw === 'string' && raw.trim().length > 0) {
        const trimmed = raw.trim();
        // ISO timestamp prefix
        if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
            const parsed = new Date(trimmed);
            if (!isNaN(parsed.getTime())) return toLocalDateKey(parsed);
        }
        // "January 15, 2025" or "January 15"
        const monthMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
        if (monthMatch) {
            const mIdx = MONTH_NAMES.findIndex(
                (m) => m.toLowerCase() === monthMatch[1].toLowerCase()
            );
            if (mIdx >= 0) {
                const day = Number(monthMatch[2]);
                const year = monthMatch[3] ? Number(monthMatch[3]) : new Date().getFullYear();
                const candidate = `${year}-${pad2(mIdx + 1)}-${pad2(day)}`;
                if (isValidDateKey(candidate)) return candidate;
            }
        }
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            return toLocalDateKey(parsed);
        }
    }
    return fallbackDateKey || toLocalDateKey();
}

/**
 * Adds `days` calendar days to a `YYYY-MM-DD` date key, returning a new `YYYY-MM-DD`.
 * Uses UTC arithmetic on parsed components so DST transitions never skip or repeat a day.
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
    const [y, m, d] = dateKey.split('-').map(Number);
    const utcMs = Date.UTC(y, (m || 1) - 1, (d || 1) + days);
    const dt = new Date(utcMs);
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Whole calendar days between `startDateKey` and `endDateKey` (`end - start`).
 * E.g. daysBetween('2026-11-22', '2026-11-23') === 1.
 */
export function daysBetweenDateKeys(startDateKey: string, endDateKey: string): number {
    const [y1, m1, d1] = startDateKey.split('-').map(Number);
    const [y2, m2, d2] = endDateKey.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the 1-based devotional day number from a series `startDate` (`YYYY-MM-DD`)
 * and the user's current local date key.
 * Day 1 is `startDate`. Returns <= 0 if the series has not started yet.
 */
export function calculateSeriesDayNumber(
    seriesStartDate: string,
    targetDateKey: string = toLocalDateKey()
): number {
    if (!isValidDateKey(seriesStartDate) || !isValidDateKey(targetDateKey)) return 1;
    return daysBetweenDateKeys(seriesStartDate, targetDateKey) + 1;
}

/**
 * Computes the `YYYY-MM-DD` date for a 1-based `dayNumber` in a series starting on `seriesStartDate`.
 */
export function dateKeyForSeriesDay(seriesStartDate: string, dayNumber: number): string {
    const safeDay = Math.max(1, Math.floor(dayNumber));
    return addDaysToDateKey(seriesStartDate, safeDay - 1);
}

/**
 * User's IANA timezone string (e.g. "Africa/Lagos").
 */
export function getLocalTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Formats a `YYYY-MM-DD` date key as a warm editorial date (e.g. "Monday, November 23").
 */
export function formatEditorialDate(dateKey: string = toLocalDateKey(), includeYear = false): string {
    const dt = parseLocalDateKey(dateKey);
    const weekday = WEEKDAY_NAMES[dt.getDay()];
    const month = MONTH_NAMES[dt.getMonth()];
    const day = dt.getDate();
    return includeYear ? `${weekday}, ${month} ${day}, ${dt.getFullYear()}` : `${weekday}, ${month} ${day}`;
}

/**
 * Formats a `YYYY-MM-DD` date key as "Nov 23, 2026" or "Nov 23".
 */
export function formatShortDate(dateKey: string, includeYear = true): string {
    if (!isValidDateKey(dateKey)) return dateKey;
    const dt = parseLocalDateKey(dateKey);
    const month = SHORT_MONTH_NAMES[dt.getMonth()];
    const day = dt.getDate();
    return includeYear ? `${month} ${day}, ${dt.getFullYear()}` : `${month} ${day}`;
}

/**
 * Returns the `YYYY-MM` month key and human label ("November 2026") for a `YYYY-MM-DD`.
 */
export function getMonthKeyAndLabel(dateKey: string): { key: string; label: string } {
    const safe = coerceToDateKey(dateKey);
    const dt = parseLocalDateKey(safe);
    const key = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}`;
    const label = `${MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`;
    return { key, label };
}

/**
 * Time-of-day greeting in the user's local clock.
 */
export function getLocalGreeting(now: Date = new Date()): string {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

/**
 * Returns the 7 days of the current week (Monday -> Sunday) in the user's local calendar.
 */
export function getCurrentWeekDays(referenceDateKey: string = toLocalDateKey()): {
    dateKey: string;
    shortLabel: string; // M T W T F S S
    dayOfMonth: number;
    isToday: boolean;
    isFuture: boolean;
}[] {
    const refDate = parseLocalDateKey(referenceDateKey);
    const jsDay = refDate.getDay(); // 0 (Sun) - 6 (Sat)
    const offsetFromMonday = jsDay === 0 ? -6 : 1 - jsDay;
    const mondayKey = addDaysToDateKey(referenceDateKey, offsetFromMonday);
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const todayKey = toLocalDateKey();

    return labels.map((shortLabel, idx) => {
        const dateKey = addDaysToDateKey(mondayKey, idx);
        const dt = parseLocalDateKey(dateKey);
        return {
            dateKey,
            shortLabel,
            dayOfMonth: dt.getDate(),
            isToday: dateKey === todayKey,
            isFuture: daysBetweenDateKeys(todayKey, dateKey) > 0,
        };
    });
}

/**
 * Builds a calendar matrix for a given year and 0-based month (Sunday-first week rows).
 */
export function getMonthCalendarGrid(year: number, monthIndex: number): {
    monthTitle: string;
    weeks: ({ dateKey: string; day: number; isToday: boolean; isFuture: boolean } | null)[][];
} {
    const firstDay = new Date(year, monthIndex, 1, 12, 0, 0);
    const daysInMonth = new Date(year, monthIndex + 1, 0, 12, 0, 0).getDate();
    const startWeekday = firstDay.getDay(); // 0 = Sun
    const todayKey = toLocalDateKey();

    const cells: ({ dateKey: string; day: number; isToday: boolean; isFuture: boolean } | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${pad2(monthIndex + 1)}-${pad2(d)}`;
        cells.push({
            dateKey,
            day: d,
            isToday: dateKey === todayKey,
            isFuture: daysBetweenDateKeys(todayKey, dateKey) > 0,
        });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: ({ dateKey: string; day: number; isToday: boolean; isFuture: boolean } | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    return {
        monthTitle: `${MONTH_NAMES[monthIndex]} ${year}`,
        weeks,
    };
}
