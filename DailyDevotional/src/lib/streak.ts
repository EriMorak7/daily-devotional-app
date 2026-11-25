import { UserProgress } from '../types';
import { addDaysToDateKey, daysBetweenDateKeys, isValidDateKey, toLocalDateKey } from './date';

export const EMPTY_PROGRESS: UserProgress = {
    currentStreak: 0,
    longestStreak: 0,
    totalCompleted: 0,
    lastCompletedDate: null,
};

/**
 * Pure, deterministic streak calculation from a set of local completion dates (`YYYY-MM-DD`)
 * and the user's current local date (`todayKey`).
 *
 * Rules:
 * - Duplicate dates are deduplicated automatically.
 * - If the user completed today (`todayKey`), the current streak counts backwards
 *   consecutively starting from `todayKey`.
 * - If the user has NOT completed today yet, but completed yesterday (`todayKey - 1`),
 *   their active streak is still intact and counts backwards from yesterday.
 * - If the user missed yesterday (and hasn't completed today), `currentStreak` is 0
 *   until they complete today (at which point it becomes 1).
 * - Timezone travel edge case: if a completion exists for `todayKey + 1` (user moved west
 *   after completing in an eastern timezone), it is preserved in `totalCompleted` and
 *   treated as anchoring today's continuity without double-incrementing.
 */
export function computeProgressFromDates(
    completedDateKeys: Iterable<string>,
    todayKey: string = toLocalDateKey(),
    previousLongestStreak = 0
): UserProgress {
    const validSet = new Set<string>();
    for (const key of completedDateKeys) {
        if (isValidDateKey(key)) {
            validSet.add(key);
        }
    }

    if (validSet.size === 0) {
        return {
            currentStreak: 0,
            longestStreak: Math.max(0, previousLongestStreak),
            totalCompleted: 0,
            lastCompletedDate: null,
        };
    }

    const sortedAsc = Array.from(validSet).sort();
    const lastCompletedDate = sortedAsc[sortedAsc.length - 1];

    // Compute longest streak across all historical dates
    let longest = Math.max(1, previousLongestStreak);
    let run = 1;
    for (let i = 1; i < sortedAsc.length; i++) {
        const diff = daysBetweenDateKeys(sortedAsc[i - 1], sortedAsc[i]);
        if (diff === 1) {
            run += 1;
            if (run > longest) longest = run;
        } else if (diff > 1) {
            run = 1;
        }
    }

    // Determine anchor for current streak
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const tomorrowKey = addDaysToDateKey(todayKey, 1);

    let anchorKey: string | null = null;
    if (validSet.has(tomorrowKey) && (validSet.has(todayKey) || !validSet.has(yesterdayKey))) {
        // Timezone shift westward after completing in an ahead timezone
        anchorKey = tomorrowKey;
    } else if (validSet.has(todayKey)) {
        anchorKey = todayKey;
    } else if (validSet.has(yesterdayKey)) {
        anchorKey = yesterdayKey;
    }

    let currentStreak = 0;
    if (anchorKey) {
        let cursor = anchorKey;
        while (validSet.has(cursor)) {
            currentStreak += 1;
            cursor = addDaysToDateKey(cursor, -1);
        }
        // If tomorrow AND today were both present due to timezone travel, cap to unique consecutive run
    }

    if (currentStreak > longest) {
        longest = currentStreak;
    }

    return {
        currentStreak,
        longestStreak: longest,
        totalCompleted: validSet.size,
        lastCompletedDate,
    };
}

/**
 * Computes the incremental progress update when marking `completionDateKey` complete.
 * Returns `{ progress, alreadyCompletedToday }` so callers can prevent duplicate increments.
 */
export function applyCompletionToProgress(
    current: UserProgress | undefined,
    existingDateKeys: Iterable<string>,
    completionDateKey: string = toLocalDateKey()
): { progress: UserProgress; alreadyCompleted: boolean } {
    const set = new Set<string>();
    for (const k of existingDateKeys) {
        if (isValidDateKey(k)) set.add(k);
    }

    // Also include current.lastCompletedDate if the local cache only had profile summary
    if (current?.lastCompletedDate && isValidDateKey(current.lastCompletedDate)) {
        set.add(current.lastCompletedDate);
    }

    const alreadyCompleted = set.has(completionDateKey);
    set.add(completionDateKey);

    const recomputed = computeProgressFromDates(
        set,
        completionDateKey,
        current?.longestStreak || 0
    );

    // If we didn't have the full history locally (e.g. cold login before history sync),
    // preserve streak continuity from the profile summary.
    if (!alreadyCompleted && current && current.currentStreak > 0 && current.lastCompletedDate) {
        const diff = daysBetweenDateKeys(current.lastCompletedDate, completionDateKey);
        if (diff === 1) {
            const candidateStreak = current.currentStreak + 1;
            if (candidateStreak > recomputed.currentStreak) {
                recomputed.currentStreak = candidateStreak;
            }
        } else if (diff === 0) {
            recomputed.currentStreak = Math.max(recomputed.currentStreak, current.currentStreak);
        }
        recomputed.longestStreak = Math.max(
            recomputed.longestStreak,
            current.longestStreak || 0,
            recomputed.currentStreak
        );
        recomputed.totalCompleted = Math.max(
            recomputed.totalCompleted,
            (current.totalCompleted || 0) + 1
        );
    } else if (alreadyCompleted && current) {
        recomputed.currentStreak = Math.max(recomputed.currentStreak, current.currentStreak);
        recomputed.longestStreak = Math.max(recomputed.longestStreak, current.longestStreak);
        recomputed.totalCompleted = Math.max(recomputed.totalCompleted, current.totalCompleted);
    }

    return { progress: recomputed, alreadyCompleted };
}

/**
 * Evaluates whether the user missed yesterday (had prior completions, none yesterday or today),
 * used to show gentle, non-shaming encouragement ("Missed yesterday? That's okay. Start again today.").
 */
export function didMissYesterday(
    progress: UserProgress | undefined,
    todayKey: string = toLocalDateKey()
): boolean {
    if (!progress?.lastCompletedDate || !isValidDateKey(progress.lastCompletedDate)) return false;
    const diff = daysBetweenDateKeys(progress.lastCompletedDate, todayKey);
    return diff > 1;
}
