import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
    onAuthStateChanged,
    User,
} from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    runTransaction,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { useAuthStore } from '../store/authStore';
import { useNotesStore } from '../store/notesStore';
import { useSettingsStore } from '../store/settingsStore';
import {
    UserProfile,
    UserProgress,
    DevotionalCompletion,
    Devotional,
    DEFAULT_NOTIFICATION_PREFS,
} from '../types';
import { getLocalTimezone, isValidDateKey, toLocalDateKey } from '../lib/date';
import {
    EMPTY_PROGRESS,
    applyCompletionToProgress,
    computeProgressFromDates,
} from '../lib/streak';

async function fetchUserCompletionsMap(uid: string): Promise<Record<string, DevotionalCompletion>> {
    const map: Record<string, DevotionalCompletion> = {};
    try {
        const snap = await getDocs(collection(db, 'users', uid, 'completions'));
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const date = isValidDateKey(data.date) ? data.date : docSnap.id;
            if (isValidDateKey(date)) {
                map[date] = {
                    date,
                    devotionalId: String(data.devotionalId || ''),
                    devotionalTitle: String(data.devotionalTitle || ''),
                    scriptureReference: String(data.scriptureReference || ''),
                    dayNumber: typeof data.dayNumber === 'number' ? data.dayNumber : undefined,
                    completedAt: String(data.completedAt || new Date().toISOString()),
                    timezone: String(data.timezone || getLocalTimezone()),
                };
            }
        });
    } catch (err) {
        console.warn('Failed fetching user completions:', err);
    }
    return map;
}

/**
 * Migrates any local guest progress (completions, notes, highlights, bookmarks)
 * into the authenticated user's Firestore account and recomputes their streak.
 */
async function migrateGuestProgressIfPresent(
    targetUid: string,
    existingCompletions: Record<string, DevotionalCompletion>,
    previousLongestStreak: number
): Promise<{
    completions: Record<string, DevotionalCompletion>;
    progress: UserProgress;
}> {
    const authStore = useAuthStore.getState();
    const { guestUid, completions: guestCompletions } = await authStore.getGuestMigrationPayload();

    const mergedCompletions: Record<string, DevotionalCompletion> = { ...existingCompletions };
    const newlyAdded: DevotionalCompletion[] = [];

    for (const c of guestCompletions) {
        if (isValidDateKey(c.date) && !mergedCompletions[c.date]) {
            mergedCompletions[c.date] = c;
            newlyAdded.push(c);
        }
    }

    if (guestUid) {
        await useNotesStore.getState().migrateGuestEntriesToUser(guestUid, targetUid);
    }

    const progress = computeProgressFromDates(
        Object.keys(mergedCompletions),
        toLocalDateKey(),
        previousLongestStreak
    );

    if (newlyAdded.length > 0) {
        try {
            const batch = writeBatch(db);
            for (const c of newlyAdded) {
                batch.set(doc(db, 'users', targetUid, 'completions', c.date), c, { merge: true });
            }
            batch.set(
                doc(db, 'users', targetUid),
                {
                    progress,
                    streak: progress.currentStreak,
                    lastReadDate: progress.lastCompletedDate,
                    timezone: getLocalTimezone(),
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
            await batch.commit();
        } catch (err) {
            console.warn('Failed committing guest completion migration:', err);
        }
    }

    await authStore.clearGuestData();
    return { completions: mergedCompletions, progress };
}

function buildUserProfileFromDoc(
    uid: string,
    email: string,
    displayName: string,
    photoURL: string | undefined,
    raw: Record<string, unknown> | undefined,
    computedProgress: UserProgress
): UserProfile {
    const rawPrefs = (raw?.notificationPrefs as Record<string, unknown> | undefined) || {};
    const notificationPrefs = {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...rawPrefs,
    };

    return {
        uid,
        displayName,
        email,
        photoURL,
        churchAffiliation: typeof raw?.churchAffiliation === 'string' ? raw.churchAffiliation : undefined,
        timezone: typeof raw?.timezone === 'string' ? raw.timezone : getLocalTimezone(),
        progress: computedProgress,
        notificationPrefs,
        streak: computedProgress.currentStreak,
        lastReadDate: computedProgress.lastCompletedDate || undefined,
        isGuest: false,
        createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    };
}

/**
 * Register a new user with email and password, migrating any guest progress automatically.
 */
export async function registerWithEmail(
    email: string,
    password: string,
    displayName: string
): Promise<void> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    await updateProfile(user, { displayName });

    const { completions, progress } = await migrateGuestProgressIfPresent(user.uid, {}, 0);
    const nowIso = new Date().toISOString();
    const timezone = getLocalTimezone();
    const notificationPrefs = useSettingsStore.getState().notificationPrefs;

    const profileDoc = {
        displayName,
        email,
        timezone,
        progress,
        notificationPrefs,
        streak: progress.currentStreak,
        lastReadDate: progress.lastCompletedDate || null,
        isGuest: false,
        createdAt: nowIso,
        updatedAt: nowIso,
    };

    await setDoc(doc(db, 'users', user.uid), profileDoc, { merge: true });

    const fullProfile: UserProfile = {
        uid: user.uid,
        ...profileDoc,
        lastReadDate: progress.lastCompletedDate || undefined,
    };

    useAuthStore.getState().login(fullProfile, completions);
    await useNotesStore.getState().loadForUser(user.uid, false);
}

/**
 * Sign in with email and password, migrating any guest session data if the user was browsing as guest.
 */
export async function loginWithEmail(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    const [profileSnap, existingCompletions] = await Promise.all([
        getDoc(doc(db, 'users', user.uid)),
        fetchUserCompletionsMap(user.uid),
    ]);

    const profileData = profileSnap.data() as Record<string, unknown> | undefined;

    // Include legacy lastReadDate in completions map if no completions subdoc exists yet
    const legacyLastRead =
        typeof profileData?.lastReadDate === 'string' ? profileData.lastReadDate : undefined;
    if (legacyLastRead && isValidDateKey(legacyLastRead) && !existingCompletions[legacyLastRead]) {
        existingCompletions[legacyLastRead] = {
            date: legacyLastRead,
            devotionalId: 'legacy',
            devotionalTitle: 'Previous Devotional',
            scriptureReference: '',
            completedAt: new Date().toISOString(),
            timezone: getLocalTimezone(),
        };
    }

    const prevLongest =
        (profileData?.progress as UserProgress | undefined)?.longestStreak ||
        (typeof profileData?.streak === 'number' ? profileData.streak : 0);

    const { completions, progress } = await migrateGuestProgressIfPresent(
        user.uid,
        existingCompletions,
        prevLongest
    );

    const profile = buildUserProfileFromDoc(
        user.uid,
        user.email || email,
        user.displayName || (typeof profileData?.displayName === 'string' ? profileData.displayName : 'Beloved'),
        user.photoURL || undefined,
        profileData,
        progress
    );

    useAuthStore.getState().login(profile, completions);
    useSettingsStore.getState().setNotificationPrefs(profile.notificationPrefs);
    await useNotesStore.getState().loadForUser(user.uid, false);
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
    const { isGuest } = useAuthStore.getState();
    if (!isGuest) {
        try {
            await firebaseSignOut(auth);
        } catch (err) {
            console.warn('Firebase sign out warning:', err);
        }
    }
    useNotesStore.getState().clearMemory();
    await useAuthStore.getState().logout();
}

/**
 * Continue as guest (persisted locally in AsyncStorage).
 */
export async function continueAsGuest(): Promise<void> {
    const profile = await useAuthStore.getState().setGuest();
    await useNotesStore.getState().loadForUser(profile.uid, true);
}

/**
 * Marks a devotional complete for the user's local calendar date (`YYYY-MM-DD`).
 *
 * - Prevents duplicate streak increments on the same local date across reopens and devices.
 * - Persists authenticated user streak and completion doc in a Firestore transaction.
 * - Records church-wide completion count doc under `devotionals/{id}/completions/{uid}`.
 * - Persists guest completions in AsyncStorage.
 */
export async function completeDevotionalForToday(
    devotional: Devotional,
    reflectionText?: string
): Promise<{ progress: UserProgress; alreadyCompletedToday: boolean }> {
    const authState = useAuthStore.getState();
    const { user, isAuthenticated, isGuest, completions } = authState;

    if (!user || !isAuthenticated) {
        throw new Error('Please sign in or continue as guest to complete today’s devotional.');
    }

    const todayKey = toLocalDateKey();
    const timezone = getLocalTimezone();

    // Save optional reflection to the user's personal journal
    if (reflectionText && reflectionText.trim().length > 0) {
        await useNotesStore.getState().saveReflectionForDevotional(devotional, reflectionText.trim());
    }

    const completion: DevotionalCompletion = {
        date: todayKey,
        devotionalId: devotional.id,
        devotionalTitle: devotional.title,
        scriptureReference: devotional.scriptureReference,
        dayNumber: devotional.dayNumber,
        completedAt: new Date().toISOString(),
        timezone,
    };

    const { progress: localNextProgress, alreadyCompleted } = applyCompletionToProgress(
        user.progress,
        Object.keys(completions),
        todayKey
    );

    await authState.recordLocalCompletion(completion, localNextProgress);

    if (isGuest) {
        return { progress: localNextProgress, alreadyCompletedToday: alreadyCompleted };
    }

    // Authenticated user: run idempotent Firestore transaction keyed by `users/{uid}/completions/{YYYY-MM-DD}`
    const userRef = doc(db, 'users', user.uid);
    const completionRef = doc(db, 'users', user.uid, 'completions', todayKey);

    try {
        const txResult = await runTransaction(db, async (tx) => {
            const [userSnap, compSnap] = await Promise.all([
                tx.get(userRef),
                tx.get(completionRef),
            ]);

            const userData = userSnap.exists() ? userSnap.data() : {};
            const remoteProgress: UserProgress | undefined = userData.progress || {
                currentStreak: typeof userData.streak === 'number' ? userData.streak : 0,
                longestStreak: typeof userData.streak === 'number' ? userData.streak : 0,
                totalCompleted: Object.keys(completions).length,
                lastCompletedDate: typeof userData.lastReadDate === 'string' ? userData.lastReadDate : null,
            };

            const knownDates = new Set<string>(Object.keys(completions));
            if (compSnap.exists()) {
                knownDates.add(todayKey);
            }
            if (remoteProgress?.lastCompletedDate && isValidDateKey(remoteProgress.lastCompletedDate)) {
                knownDates.add(remoteProgress.lastCompletedDate);
            }

            const { progress: computedProgress, alreadyCompleted: wasAlreadyDone } =
                applyCompletionToProgress(remoteProgress, knownDates, todayKey);

            if (!compSnap.exists()) {
                tx.set(completionRef, completion);
            }

            tx.set(
                userRef,
                {
                    progress: computedProgress,
                    streak: computedProgress.currentStreak,
                    lastReadDate: computedProgress.lastCompletedDate,
                    timezone,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );

            return { progress: computedProgress, alreadyCompletedToday: wasAlreadyDone };
        });

        // Also record anonymous church-wide completion marker (ignore if already exists)
        try {
            const publicCompRef = doc(db, 'devotionals', devotional.id, 'completions', user.uid);
            const existingPublic = await getDoc(publicCompRef);
            if (!existingPublic.exists()) {
                await setDoc(publicCompRef, {
                    uid: user.uid,
                    completedAt: serverTimestamp(),
                });
            }
        } catch {
            // Non-fatal if offline or rules not yet deployed
        }

        // Sync final transaction progress to local store
        await authState.recordLocalCompletion(completion, txResult.progress);
        return txResult;
    } catch (err) {
        console.warn('Firestore completion transaction failed (saved locally):', err);
        return { progress: localNextProgress, alreadyCompletedToday: alreadyCompleted };
    }
}

/**
 * Legacy helper retained so any existing caller compiles; delegates to explicit completion flow
 * only when called with a devotional. Does NOT auto-increment on screen open.
 */
export async function updateReadingStreak(devotional?: Devotional): Promise<void> {
    if (!devotional) return;
    await completeDevotionalForToday(devotional);
}

/**
 * Listen for Firebase Auth state changes and restore user or guest session on cold start.
 */
export function setupAuthListener(): () => void {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        if (firebaseUser) {
            try {
                const [profileDoc, completions] = await Promise.all([
                    getDoc(doc(db, 'users', firebaseUser.uid)),
                    fetchUserCompletionsMap(firebaseUser.uid),
                ]);
                const profileData = profileDoc.data() as Record<string, unknown> | undefined;

                const legacyLastRead =
                    typeof profileData?.lastReadDate === 'string' ? profileData.lastReadDate : undefined;
                if (legacyLastRead && isValidDateKey(legacyLastRead) && !completions[legacyLastRead]) {
                    completions[legacyLastRead] = {
                        date: legacyLastRead,
                        devotionalId: 'legacy',
                        devotionalTitle: 'Previous Devotional',
                        scriptureReference: '',
                        completedAt: new Date().toISOString(),
                        timezone: getLocalTimezone(),
                    };
                }

                const prevLongest =
                    (profileData?.progress as UserProgress | undefined)?.longestStreak ||
                    (typeof profileData?.streak === 'number' ? profileData.streak : 0);

                const progress = computeProgressFromDates(
                    Object.keys(completions),
                    toLocalDateKey(),
                    prevLongest
                );

                // If profile had a higher active streak without completion subdocs, preserve it if consecutive
                const remoteProgress = profileData?.progress as UserProgress | undefined;
                if (remoteProgress && remoteProgress.currentStreak > progress.currentStreak) {
                    progress.currentStreak = remoteProgress.currentStreak;
                    progress.longestStreak = Math.max(progress.longestStreak, remoteProgress.longestStreak);
                    progress.totalCompleted = Math.max(progress.totalCompleted, remoteProgress.totalCompleted);
                }

                const profile = buildUserProfileFromDoc(
                    firebaseUser.uid,
                    firebaseUser.email || '',
                    firebaseUser.displayName ||
                        (typeof profileData?.displayName === 'string' ? profileData.displayName : 'Beloved'),
                    firebaseUser.photoURL || undefined,
                    profileData,
                    progress
                );

                useAuthStore.getState().login(profile, completions);
                await useNotesStore.getState().loadForUser(firebaseUser.uid, false);
            } catch (err) {
                console.warn('Restoring session offline fallback:', err);
                const fallbackProfile: UserProfile = {
                    uid: firebaseUser.uid,
                    displayName: firebaseUser.displayName || 'Beloved',
                    email: firebaseUser.email || '',
                    timezone: getLocalTimezone(),
                    progress: EMPTY_PROGRESS,
                    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
                    streak: 0,
                    isGuest: false,
                    createdAt: new Date().toISOString(),
                };
                useAuthStore.getState().login(fallbackProfile, {});
                await useNotesStore.getState().loadForUser(firebaseUser.uid, false);
            }
        } else {
            // No Firebase user: check if an active guest session exists in AsyncStorage
            const restoredGuest = await useAuthStore.getState().restoreGuestIfActive();
            if (restoredGuest) {
                const guestUser = useAuthStore.getState().user;
                if (guestUser) {
                    await useNotesStore.getState().loadForUser(guestUser.uid, true);
                }
            } else {
                useAuthStore.getState().setInitializing(false);
            }
        }
    });

    return unsubscribe;
}
