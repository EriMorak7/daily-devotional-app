import {
    collection,
    doc,
    addDoc,
    getDocs,
    deleteDoc,
    runTransaction,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    getCountFromServer,
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuthStore } from '../store/authStore';
import { CommunityComment, CommunityReactions, ReactionKey } from '../types';

function timestampToIso(value: unknown): string {
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

function normalizeReactions(raw: unknown): CommunityReactions {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const toUidArray = (arr: unknown): string[] =>
        Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];

    return {
        amen: toUidArray(obj.amen ?? obj['🙏']),
        heart: toUidArray(obj.heart ?? obj['❤️']),
        fire: toUidArray(obj.fire ?? obj['🔥']),
    };
}

export function normalizeCommunityComment(
    id: string,
    devotionalId: string,
    raw: Record<string, unknown>
): CommunityComment {
    return {
        id,
        devotionalId: typeof raw.devotionalId === 'string' ? raw.devotionalId : devotionalId,
        authorId: typeof raw.authorId === 'string'
            ? raw.authorId
            : typeof raw.userId === 'string'
                ? raw.userId
                : '',
        authorName: typeof raw.authorName === 'string'
            ? raw.authorName
            : typeof raw.userName === 'string'
                ? raw.userName
                : 'Church Member',
        authorPhoto: typeof raw.authorPhoto === 'string' ? raw.authorPhoto : null,
        parentId: typeof raw.parentId === 'string' && raw.parentId ? raw.parentId : null,
        content: typeof raw.content === 'string' ? raw.content : '',
        reactions: normalizeReactions(raw.reactions),
        status: raw.status === 'hidden' ? 'hidden' : 'visible',
        edited: Boolean(raw.edited),
        createdAt: timestampToIso(raw.createdAt),
        updatedAt: raw.updatedAt ? timestampToIso(raw.updatedAt) : undefined,
    };
}

/**
 * Fetches visible community reflections & replies for a devotional from Firestore.
 * Never returns fake or mock comments.
 */
export async function fetchDevotionalComments(
    devotionalId: string,
    maxItems = 60
): Promise<CommunityComment[]> {
    if (!devotionalId) return [];

    const commentsRef = collection(db, 'devotionals', devotionalId, 'comments');
    try {
        const q = query(
            commentsRef,
            where('status', '==', 'visible'),
            orderBy('createdAt', 'asc'),
            limit(maxItems)
        );
        const snap = await getDocs(q);
        const list: CommunityComment[] = [];
        snap.forEach((docSnap) => {
            list.push(normalizeCommunityComment(docSnap.id, devotionalId, docSnap.data()));
        });
        return list;
    } catch {
        // Fallback if composite index is still building
        const snap = await getDocs(query(commentsRef, limit(maxItems)));
        const list: CommunityComment[] = [];
        snap.forEach((docSnap) => {
            const c = normalizeCommunityComment(docSnap.id, devotionalId, docSnap.data());
            if (c.status === 'visible') list.push(c);
        });
        return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
}

/**
 * Fetches the church-wide completion count for a devotional ("X members completed today").
 */
export async function fetchDevotionalCompletionCount(devotionalId: string): Promise<number> {
    if (!devotionalId) return 0;
    try {
        const coll = collection(db, 'devotionals', devotionalId, 'completions');
        const snap = await getCountFromServer(coll);
        return snap.data().count;
    } catch {
        return 0;
    }
}

/**
 * Posts a new community reflection or threaded reply to Firestore.
 * Requires an authenticated (non-guest) church member account.
 */
export async function postCommunityComment(params: {
    devotionalId: string;
    content: string;
    parentId?: string | null;
}): Promise<CommunityComment> {
    const { user, isAuthenticated, isGuest } = useAuthStore.getState();
    if (!isAuthenticated || isGuest || !user) {
        throw new Error('Please sign in to your account to share with the church community.');
    }

    const trimmed = params.content.trim();
    if (!trimmed) {
        throw new Error('Please write a reflection before posting.');
    }
    if (trimmed.length > 1000) {
        throw new Error('Reflections must be 1,000 characters or fewer.');
    }

    const payload = {
        devotionalId: params.devotionalId,
        authorId: user.uid,
        authorName: user.displayName || 'Church Member',
        authorPhoto: user.photoURL || null,
        parentId: params.parentId || null,
        content: trimmed,
        reactions: { amen: [], heart: [], fire: [] },
        status: 'visible' as const,
        edited: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(
        collection(db, 'devotionals', params.devotionalId, 'comments'),
        payload
    );

    const nowIso = new Date().toISOString();
    return {
        id: docRef.id,
        devotionalId: params.devotionalId,
        authorId: user.uid,
        authorName: user.displayName || 'Church Member',
        authorPhoto: user.photoURL || null,
        parentId: params.parentId || null,
        content: trimmed,
        reactions: { amen: [], heart: [], fire: [] },
        status: 'visible',
        edited: false,
        createdAt: nowIso,
        updatedAt: nowIso,
    };
}

/**
 * Toggles the signed-in user's reaction (`amen`, `heart`, or `fire`) on a comment
 * inside a Firestore transaction, complying with the `onlyChanged(['reactions'])` rule.
 */
export async function toggleCommunityReaction(params: {
    devotionalId: string;
    commentId: string;
    reaction: ReactionKey;
}): Promise<CommunityReactions> {
    const { user, isAuthenticated, isGuest } = useAuthStore.getState();
    if (!isAuthenticated || isGuest || !user) {
        throw new Error('Please sign in to react to community reflections.');
    }

    const commentRef = doc(db, 'devotionals', params.devotionalId, 'comments', params.commentId);

    return runTransaction(db, async (tx) => {
        const snap = await tx.get(commentRef);
        if (!snap.exists()) {
            throw new Error('This reflection is no longer available.');
        }
        const current = normalizeReactions(snap.data().reactions);
        const list = current[params.reaction];
        const hasReacted = list.includes(user.uid);
        const nextList = hasReacted
            ? list.filter((id) => id !== user.uid)
            : [...Array.from(new Set(list)), user.uid];

        const nextReactions: CommunityReactions = {
            ...current,
            [params.reaction]: nextList,
        };

        tx.update(commentRef, { reactions: nextReactions });
        return nextReactions;
    });
}

/**
 * Deletes a user's own comment from Firestore.
 */
export async function deleteOwnCommunityComment(params: {
    devotionalId: string;
    commentId: string;
}): Promise<void> {
    const { user, isAuthenticated, isGuest } = useAuthStore.getState();
    if (!isAuthenticated || isGuest || !user) {
        throw new Error('You must be signed in to delete your comment.');
    }

    await deleteDoc(doc(db, 'devotionals', params.devotionalId, 'comments', params.commentId));
}

/**
 * Reports an inappropriate community comment for pastoral/admin moderation.
 */
export async function reportCommunityComment(params: {
    devotionalId: string;
    commentId: string;
    reason: string;
}): Promise<void> {
    const { user, isAuthenticated, isGuest } = useAuthStore.getState();
    if (!isAuthenticated || isGuest || !user) {
        throw new Error('Please sign in to report content for review.');
    }

    const cleanReason = params.reason.trim().slice(0, 500) || 'Flagged for pastoral review';
    await addDoc(collection(db, 'reports'), {
        commentId: params.commentId,
        devotionalId: params.devotionalId,
        reporterId: user.uid,
        reason: cleanReason,
        status: 'open',
        createdAt: serverTimestamp(),
    });
}
