import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Devotional, DevotionalSeries, AppPublicConfig } from '../types';
import { normalizeDevotional, normalizeSeries } from '../data/devotionals';
import { calculateSeriesDayNumber, daysBetweenDateKeys, toLocalDateKey } from '../lib/date';

const DEVOTIONALS_CACHE_KEY = '@devotional_cached_content_v2';
const PAGE_SIZE = 30;

interface CachedDevotionalPayload {
    config: AppPublicConfig;
    seriesList: DevotionalSeries[];
    devotionals: Devotional[];
    cachedAt: string;
}

interface DevotionalState {
    config: AppPublicConfig;
    seriesList: DevotionalSeries[];
    activeSeries: DevotionalSeries | null;
    devotionals: Devotional[];
    todayDevotional: Devotional | null;
    currentDevotional: Devotional | null;
    calculatedSeriesDay: number;
    isLoading: boolean;
    isRefreshing: boolean;
    isOfflineCache: boolean;
    error: string | null;
    hasMoreArchive: boolean;
    archivePageLimit: number;

    // Actions
    loadDevotionals: (options?: { forceRefresh?: boolean }) => Promise<void>;
    loadMoreArchive: () => Promise<void>;
    setCurrentDevotional: (devotional: Devotional) => void;
    getDevotionalById: (id: string) => Devotional | undefined;
    goToDay: (dayNumber: number) => void;
    goToNext: () => Devotional | null;
    goToPrevious: () => Devotional | null;
}

/**
 * Selects today's devotional using the active series' explicit `startDate` and
 * the user's local calendar date (`YYYY-MM-DD`).
 * Never uses modulo wrap-around logic.
 */
function resolveTodaysDevotional(
    publishedDevotionals: Devotional[],
    activeSeries: DevotionalSeries | null,
    localTodayKey: string
): { todayDevotional: Devotional | null; calculatedDay: number } {
    // Never surface future-scheduled devotionals (where date > user's local today)
    const eligible = publishedDevotionals.filter(
        (d) => d.published && d.status === 'published' && daysBetweenDateKeys(d.date, localTodayKey) >= 0
    );

    const calculatedDay = activeSeries
        ? calculateSeriesDayNumber(activeSeries.startDate, localTodayKey)
        : 1;

    if (eligible.length === 0) {
        return { todayDevotional: null, calculatedDay: Math.max(1, calculatedDay) };
    }

    // 1. Exact local calendar date match inside active series
    if (activeSeries) {
        const bySeriesDate = eligible.find(
            (d) => d.seriesId === activeSeries.id && d.date === localTodayKey
        );
        if (bySeriesDate) {
            return { todayDevotional: bySeriesDate, calculatedDay: bySeriesDate.dayNumber };
        }

        // 2. Calculated day number from series.startDate
        if (calculatedDay >= 1) {
            const bySeriesDay = eligible.find(
                (d) => d.seriesId === activeSeries.id && d.dayNumber === calculatedDay
            );
            if (bySeriesDay) {
                return { todayDevotional: bySeriesDay, calculatedDay };
            }
        }
    }

    // 3. Exact local calendar date match across any published devotional
    const byExactDate = eligible.find((d) => d.date === localTodayKey);
    if (byExactDate) {
        return { todayDevotional: byExactDate, calculatedDay: byExactDate.dayNumber };
    }

    // 4. If series has a calculated day number, match dayNumber even on legacy docs without seriesId
    if (activeSeries && calculatedDay >= 1) {
        const byLegacyDay = eligible.find((d) => !d.seriesId && d.dayNumber === calculatedDay);
        if (byLegacyDay) {
            return { todayDevotional: byLegacyDay, calculatedDay };
        }
    }

    // 5. Most recent eligible devotional on or before today (sorted by date desc, then dayNumber desc)
    const sortedByRecency = [...eligible].sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.dayNumber - a.dayNumber;
    });

    const latest = sortedByRecency[0] || null;
    return {
        todayDevotional: latest,
        calculatedDay: latest ? latest.dayNumber : Math.max(1, calculatedDay),
    };
}

export const useDevotionalStore = create<DevotionalState>((set, get) => ({
    config: { activeSeriesId: null, churchName: 'Sufficient Grace' },
    seriesList: [],
    activeSeries: null,
    devotionals: [],
    todayDevotional: null,
    currentDevotional: null,
    calculatedSeriesDay: 1,
    isLoading: false,
    isRefreshing: false,
    isOfflineCache: false,
    error: null,
    hasMoreArchive: false,
    archivePageLimit: PAGE_SIZE,

    loadDevotionals: async (options) => {
        const isForce = Boolean(options?.forceRefresh);
        const currentList = get().devotionals;
        set({
            isLoading: currentList.length === 0,
            isRefreshing: isForce && currentList.length > 0,
            error: null,
        });

        const localTodayKey = toLocalDateKey();

        // Hydrate from local cache first if store is empty so slow/offline networks render immediately
        if (currentList.length === 0) {
            try {
                const rawCache = await AsyncStorage.getItem(DEVOTIONALS_CACHE_KEY);
                if (rawCache) {
                    const cached = JSON.parse(rawCache) as CachedDevotionalPayload;
                    const activeSeries =
                        cached.seriesList.find((s) => s.id === cached.config.activeSeriesId) ||
                        cached.seriesList.find((s) => s.status === 'active') ||
                        cached.seriesList[0] ||
                        null;
                    const { todayDevotional, calculatedDay } = resolveTodaysDevotional(
                        cached.devotionals,
                        activeSeries,
                        localTodayKey
                    );
                    set({
                        config: cached.config,
                        seriesList: cached.seriesList,
                        activeSeries,
                        devotionals: cached.devotionals,
                        todayDevotional,
                        currentDevotional: get().currentDevotional || todayDevotional,
                        calculatedSeriesDay: calculatedDay,
                        isOfflineCache: true,
                    });
                }
            } catch (cacheErr) {
                console.warn('Failed reading devotional cache:', cacheErr);
            }
        }

        try {
            // 1. Load public config & active series
            let config: AppPublicConfig = { activeSeriesId: null, churchName: 'Sufficient Grace' };
            try {
                const cfgSnap = await getDoc(doc(db, 'app_config', 'public'));
                if (cfgSnap.exists()) {
                    const data = cfgSnap.data();
                    config = {
                        activeSeriesId: typeof data.activeSeriesId === 'string' ? data.activeSeriesId : null,
                        churchName:
                            typeof data.churchName === 'string' && data.churchName.trim()
                                ? data.churchName.trim()
                                : 'Sufficient Grace',
                    };
                }
            } catch {
                // Config doc is optional
            }

            const seriesList: DevotionalSeries[] = [];
            try {
                const seriesSnap = await getDocs(
                    query(collection(db, 'series'), where('status', 'in', ['active', 'archived']))
                );
                seriesSnap.forEach((docSnap) => {
                    seriesList.push(normalizeSeries(docSnap.id, docSnap.data()));
                });
            } catch {
                // Series collection may be empty on legacy setup
            }

            const activeSeries =
                seriesList.find((s) => s.id === config.activeSeriesId) ||
                seriesList.find((s) => s.status === 'active') ||
                seriesList[0] ||
                null;

            // 2. Fetch published devotionals (bounded page limit for performance on budget devices)
            const currentLimit = get().archivePageLimit;
            let rawDocs: { id: string; data: Record<string, unknown> }[] = [];

            try {
                const publishedQuery = query(
                    collection(db, 'devotionals'),
                    where('status', '==', 'published'),
                    orderBy('date', 'desc'),
                    limit(currentLimit)
                );
                const snap = await getDocs(publishedQuery);
                snap.forEach((d) => rawDocs.push({ id: d.id, data: d.data() }));
            } catch {
                // Fallback for legacy databases before composite index or `status` migration
                const legacySnap = await getDocs(query(collection(db, 'devotionals'), limit(currentLimit)));
                legacySnap.forEach((d) => rawDocs.push({ id: d.id, data: d.data() }));
            }

            // Normalize and strictly keep only published devotionals whose date <= localTodayKey
            const seriesById = new Map(seriesList.map((s) => [s.id, s]));
            const normalized = rawDocs
                .map((item) => {
                    const docSeriesId =
                        typeof item.data.seriesId === 'string' ? item.data.seriesId : activeSeries?.id;
                    const s = (docSeriesId && seriesById.get(docSeriesId)) || activeSeries;
                    return normalizeDevotional(item.id, item.data, s);
                })
                .filter((d) => d.published && d.status === 'published' && daysBetweenDateKeys(d.date, localTodayKey) >= 0)
                .sort((a, b) => {
                    if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
                    return a.date.localeCompare(b.date);
                });

            const { todayDevotional, calculatedDay } = resolveTodaysDevotional(
                normalized,
                activeSeries,
                localTodayKey
            );

            const previousCurrent = get().currentDevotional;
            const refreshedCurrent = previousCurrent
                ? normalized.find((d) => d.id === previousCurrent.id) || todayDevotional
                : todayDevotional;

            set({
                config,
                seriesList,
                activeSeries,
                devotionals: normalized,
                todayDevotional,
                currentDevotional: refreshedCurrent,
                calculatedSeriesDay: calculatedDay,
                isLoading: false,
                isRefreshing: false,
                isOfflineCache: false,
                hasMoreArchive: rawDocs.length >= currentLimit,
                error: null,
            });

            // Save to local cache for offline reading
            const cachePayload: CachedDevotionalPayload = {
                config,
                seriesList,
                devotionals: normalized,
                cachedAt: new Date().toISOString(),
            };
            await AsyncStorage.setItem(DEVOTIONALS_CACHE_KEY, JSON.stringify(cachePayload));
        } catch (error) {
            console.error('Error loading devotionals:', error);
            const hasCached = get().devotionals.length > 0;
            set({
                isLoading: false,
                isRefreshing: false,
                isOfflineCache: hasCached,
                error: hasCached
                    ? null
                    : 'Unable to connect to the church devotional library. Please check your connection and try again.',
            });
        }
    },

    loadMoreArchive: async () => {
        const nextLimit = get().archivePageLimit + PAGE_SIZE;
        set({ archivePageLimit: nextLimit });
        await get().loadDevotionals({ forceRefresh: true });
    },

    setCurrentDevotional: (devotional) => {
        set({ currentDevotional: devotional });
    },

    getDevotionalById: (id) => {
        return get().devotionals.find((d) => d.id === id);
    },

    goToDay: (dayNumber) => {
        const { devotionals, activeSeries } = get();
        const match =
            (activeSeries &&
                devotionals.find((d) => d.seriesId === activeSeries.id && d.dayNumber === dayNumber)) ||
            devotionals.find((d) => d.dayNumber === dayNumber);
        if (match) {
            set({ currentDevotional: match });
        }
    },

    goToNext: () => {
        const { currentDevotional, devotionals } = get();
        if (!currentDevotional) return null;
        const idx = devotionals.findIndex((d) => d.id === currentDevotional.id);
        if (idx >= 0 && idx + 1 < devotionals.length) {
            const next = devotionals[idx + 1];
            set({ currentDevotional: next });
            return next;
        }
        return null;
    },

    goToPrevious: () => {
        const { currentDevotional, devotionals } = get();
        if (!currentDevotional) return null;
        const idx = devotionals.findIndex((d) => d.id === currentDevotional.id);
        if (idx > 0) {
            const prev = devotionals[idx - 1];
            set({ currentDevotional: prev });
            return prev;
        }
        return null;
    },
}));
