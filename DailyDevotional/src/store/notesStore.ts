import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    getDocs,
    query,
    orderBy,
    writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from './authStore';
import {
    Note,
    Highlight,
    HighlightColor,
    Bookmark,
    Devotional,
    NoteKind,
} from '../types';

const LOCAL_NOTES_PREFIX = '@devotional_notes_v2_';
const LOCAL_HIGHLIGHTS_PREFIX = '@devotional_highlights_v2_';
const LOCAL_BOOKMARKS_PREFIX = '@devotional_bookmarks_v2_';

function makeId(prefix: string): string {
    const time = Date.now().toString(36);
    const seq = ((Date.now() * 16807) % 2147483647).toString(36);
    return `${prefix}_${time}_${seq}`;
}

export interface SaveNoteInput {
    devotional: Devotional;
    content: string;
    kind?: NoteKind;
    highlightText?: string;
    noteId?: string;
}

interface NotesState {
    notes: Note[];
    highlights: Highlight[];
    bookmarks: Bookmark[];
    isLoading: boolean;
    error: string | null;

    // Lifecycle
    loadForUser: (uid: string, isGuest: boolean) => Promise<void>;
    migrateGuestEntriesToUser: (guestUid: string, targetUid: string) => Promise<void>;
    clearMemory: () => void;

    // Notes & Reflections
    saveReflectionForDevotional: (devotional: Devotional, content: string) => Promise<Note>;
    addNote: (
        devotionalId: string,
        content: string,
        meta?: Partial<Pick<Devotional, 'title' | 'scriptureReference' | 'date' | 'dayNumber' | 'seriesId'>>,
        kind?: NoteKind
    ) => Promise<Note>;
    updateNote: (noteId: string, content: string) => Promise<void>;
    deleteNote: (noteId: string) => Promise<void>;
    getNotesForDevotional: (devotionalId: string) => Note[];
    getReflectionForDevotional: (devotionalId: string) => Note | undefined;

    // Highlights
    addHighlight: (
        devotionalId: string,
        text: string,
        color: HighlightColor,
        startOffset: number,
        endOffset: number,
        meta?: {
            devotionalTitle?: string;
            scriptureReference?: string;
            devotionalDate?: string;
            section?: 'scripture' | 'body' | 'prayer';
            paragraphIndex?: number;
        }
    ) => Promise<Highlight>;
    removeHighlight: (highlightId: string) => Promise<void>;
    getHighlightsForDevotional: (devotionalId: string) => Highlight[];

    // Bookmarks
    toggleBookmark: (devotional: Devotional) => Promise<boolean>;
    isBookmarked: (devotionalId: string) => boolean;

    // Combined
    getDevotionalIdsWithNotes: () => string[];
}

async function saveLocalArrays(uid: string, notes: Note[], highlights: Highlight[], bookmarks: Bookmark[]) {
    try {
        await Promise.all([
            AsyncStorage.setItem(`${LOCAL_NOTES_PREFIX}${uid}`, JSON.stringify(notes)),
            AsyncStorage.setItem(`${LOCAL_HIGHLIGHTS_PREFIX}${uid}`, JSON.stringify(highlights)),
            AsyncStorage.setItem(`${LOCAL_BOOKMARKS_PREFIX}${uid}`, JSON.stringify(bookmarks)),
        ]);
    } catch (err) {
        console.warn('Failed to persist local journal data:', err);
    }
}

async function readLocalArrays(uid: string): Promise<{
    notes: Note[];
    highlights: Highlight[];
    bookmarks: Bookmark[];
}> {
    try {
        const [rawNotes, rawHighlights, rawBookmarks] = await Promise.all([
            AsyncStorage.getItem(`${LOCAL_NOTES_PREFIX}${uid}`),
            AsyncStorage.getItem(`${LOCAL_HIGHLIGHTS_PREFIX}${uid}`),
            AsyncStorage.getItem(`${LOCAL_BOOKMARKS_PREFIX}${uid}`),
        ]);
        return {
            notes: rawNotes ? (JSON.parse(rawNotes) as Note[]) : [],
            highlights: rawHighlights ? (JSON.parse(rawHighlights) as Highlight[]) : [],
            bookmarks: rawBookmarks ? (JSON.parse(rawBookmarks) as Bookmark[]) : [],
        };
    } catch {
        return { notes: [], highlights: [], bookmarks: [] };
    }
}

function getActiveUserContext(): { uid: string; isGuest: boolean } {
    const { user, isGuest } = useAuthStore.getState();
    if (!user || !user.uid) {
        return { uid: 'guest_local', isGuest: true };
    }
    return { uid: user.uid, isGuest };
}

export const useNotesStore = create<NotesState>((set, get) => ({
    notes: [],
    highlights: [],
    bookmarks: [],
    isLoading: false,
    error: null,

    clearMemory: () => set({ notes: [], highlights: [], bookmarks: [], error: null }),

    loadForUser: async (uid, isGuest) => {
        if (!uid) return;
        set({ isLoading: true, error: null });

        // Always load cached local copy first for instant offline access
        const cached = await readLocalArrays(uid);
        set({
            notes: cached.notes,
            highlights: cached.highlights,
            bookmarks: cached.bookmarks,
        });

        if (isGuest) {
            set({ isLoading: false });
            return;
        }

        try {
            const [notesSnap, hlSnap, bmSnap] = await Promise.all([
                getDocs(query(collection(db, 'users', uid, 'notes'), orderBy('updatedAt', 'desc'))),
                getDocs(query(collection(db, 'users', uid, 'highlights'), orderBy('createdAt', 'desc'))),
                getDocs(query(collection(db, 'users', uid, 'bookmarks'), orderBy('createdAt', 'desc'))),
            ]);

            const notes: Note[] = [];
            notesSnap.forEach((d) => {
                const data = d.data();
                notes.push({
                    id: d.id,
                    userId: uid,
                    devotionalId: String(data.devotionalId || ''),
                    devotionalTitle: data.devotionalTitle ? String(data.devotionalTitle) : undefined,
                    scriptureReference: data.scriptureReference ? String(data.scriptureReference) : undefined,
                    devotionalDate: data.devotionalDate ? String(data.devotionalDate) : undefined,
                    dayNumber: typeof data.dayNumber === 'number' ? data.dayNumber : undefined,
                    seriesId: typeof data.seriesId === 'string' ? data.seriesId : null,
                    kind: data.kind === 'reflection' ? 'reflection' : 'note',
                    content: String(data.content || ''),
                    highlightText: data.highlightText ? String(data.highlightText) : undefined,
                    createdAt: String(data.createdAt || new Date().toISOString()),
                    updatedAt: String(data.updatedAt || new Date().toISOString()),
                });
            });

            const highlights: Highlight[] = [];
            hlSnap.forEach((d) => {
                const data = d.data();
                highlights.push({
                    id: d.id,
                    userId: uid,
                    devotionalId: String(data.devotionalId || ''),
                    devotionalTitle: data.devotionalTitle ? String(data.devotionalTitle) : undefined,
                    scriptureReference: data.scriptureReference ? String(data.scriptureReference) : undefined,
                    devotionalDate: data.devotionalDate ? String(data.devotionalDate) : undefined,
                    section: data.section,
                    paragraphIndex: typeof data.paragraphIndex === 'number' ? data.paragraphIndex : undefined,
                    text: String(data.text || ''),
                    color: (data.color as HighlightColor) || 'yellow',
                    startOffset: Number(data.startOffset || 0),
                    endOffset: Number(data.endOffset || 0),
                    createdAt: String(data.createdAt || new Date().toISOString()),
                });
            });

            const bookmarks: Bookmark[] = [];
            bmSnap.forEach((d) => {
                const data = d.data();
                bookmarks.push({
                    devotionalId: d.id,
                    userId: uid,
                    title: String(data.title || ''),
                    scriptureReference: String(data.scriptureReference || ''),
                    date: String(data.date || ''),
                    dayNumber: Number(data.dayNumber || 1),
                    createdAt: String(data.createdAt || new Date().toISOString()),
                });
            });

            set({ notes, highlights, bookmarks, isLoading: false, error: null });
            await saveLocalArrays(uid, notes, highlights, bookmarks);
        } catch (err) {
            console.warn('Error loading cloud journal entries (using local cache):', err);
            set({
                isLoading: false,
                error: 'Offline mode: showing saved journal entries on this device.',
            });
        }
    },

    migrateGuestEntriesToUser: async (guestUid, targetUid) => {
        if (!guestUid || !targetUid || guestUid === targetUid) return;
        const guestData = await readLocalArrays(guestUid);
        if (
            guestData.notes.length === 0 &&
            guestData.highlights.length === 0 &&
            guestData.bookmarks.length === 0
        ) {
            return;
        }

        try {
            const batch = writeBatch(db);
            for (const note of guestData.notes) {
                const migrated: Note = { ...note, userId: targetUid };
                batch.set(doc(db, 'users', targetUid, 'notes', migrated.id), migrated, { merge: true });
            }
            for (const hl of guestData.highlights) {
                const migrated: Highlight = { ...hl, userId: targetUid };
                batch.set(doc(db, 'users', targetUid, 'highlights', migrated.id), migrated, { merge: true });
            }
            for (const bm of guestData.bookmarks) {
                const migrated: Bookmark = { ...bm, userId: targetUid };
                batch.set(doc(db, 'users', targetUid, 'bookmarks', migrated.devotionalId), migrated, { merge: true });
            }
            await batch.commit();

            // Clear guest local entries after successful migration
            await Promise.all([
                AsyncStorage.removeItem(`${LOCAL_NOTES_PREFIX}${guestUid}`),
                AsyncStorage.removeItem(`${LOCAL_HIGHLIGHTS_PREFIX}${guestUid}`),
                AsyncStorage.removeItem(`${LOCAL_BOOKMARKS_PREFIX}${guestUid}`),
            ]);
        } catch (err) {
            console.warn('Failed migrating guest journal entries to Firestore:', err);
        }
    },

    saveReflectionForDevotional: async (devotional, content) => {
        const { uid, isGuest } = getActiveUserContext();
        const now = new Date().toISOString();
        const reflectionId = `reflection_${devotional.id}`;
        const existing = get().notes.find((n) => n.id === reflectionId);

        const reflection: Note = {
            id: reflectionId,
            userId: uid,
            devotionalId: devotional.id,
            devotionalTitle: devotional.title,
            scriptureReference: devotional.scriptureReference,
            devotionalDate: devotional.date,
            dayNumber: devotional.dayNumber,
            seriesId: devotional.seriesId,
            kind: 'reflection',
            content: content.trim(),
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        };

        const nextNotes = existing
            ? get().notes.map((n) => (n.id === reflectionId ? reflection : n))
            : [reflection, ...get().notes];

        set({ notes: nextNotes });
        await saveLocalArrays(uid, nextNotes, get().highlights, get().bookmarks);

        if (!isGuest) {
            await setDoc(doc(db, 'users', uid, 'notes', reflectionId), reflection, { merge: true });
        }

        return reflection;
    },

    addNote: async (devotionalId, content, meta, kind = 'note') => {
        const { uid, isGuest } = getActiveUserContext();
        const now = new Date().toISOString();
        const newNote: Note = {
            id: makeId('note'),
            userId: uid,
            devotionalId,
            devotionalTitle: meta?.title,
            scriptureReference: meta?.scriptureReference,
            devotionalDate: meta?.date,
            dayNumber: meta?.dayNumber,
            seriesId: meta?.seriesId ?? null,
            kind,
            content: content.trim(),
            createdAt: now,
            updatedAt: now,
        };

        const nextNotes = [newNote, ...get().notes];
        set({ notes: nextNotes });
        await saveLocalArrays(uid, nextNotes, get().highlights, get().bookmarks);

        if (!isGuest) {
            await setDoc(doc(db, 'users', uid, 'notes', newNote.id), newNote);
        }

        return newNote;
    },

    updateNote: async (noteId, content) => {
        const { uid, isGuest } = getActiveUserContext();
        const now = new Date().toISOString();
        let updatedNote: Note | null = null;

        const nextNotes = get().notes.map((n) => {
            if (n.id === noteId) {
                updatedNote = { ...n, userId: uid, content: content.trim(), updatedAt: now };
                return updatedNote;
            }
            return n;
        });

        set({ notes: nextNotes });
        await saveLocalArrays(uid, nextNotes, get().highlights, get().bookmarks);

        if (!isGuest && updatedNote) {
            await setDoc(doc(db, 'users', uid, 'notes', noteId), updatedNote, { merge: true });
        }
    },

    deleteNote: async (noteId) => {
        const { uid, isGuest } = getActiveUserContext();
        const nextNotes = get().notes.filter((n) => n.id !== noteId);
        set({ notes: nextNotes });
        await saveLocalArrays(uid, nextNotes, get().highlights, get().bookmarks);

        if (!isGuest) {
            await deleteDoc(doc(db, 'users', uid, 'notes', noteId));
        }
    },

    getNotesForDevotional: (devotionalId) => {
        return get().notes.filter((n) => n.devotionalId === devotionalId);
    },

    getReflectionForDevotional: (devotionalId) => {
        return get().notes.find(
            (n) => n.devotionalId === devotionalId && n.kind === 'reflection'
        );
    },

    addHighlight: async (devotionalId, text, color, startOffset, endOffset, meta) => {
        const { uid, isGuest } = getActiveUserContext();
        const trimmed = text.trim();

        // Prevent duplicate highlight of identical passage in the same devotional
        const existing = get().highlights.find(
            (h) => h.devotionalId === devotionalId && h.text === trimmed
        );
        if (existing) {
            const updated: Highlight = { ...existing, color };
            const nextHighlights = get().highlights.map((h) => (h.id === existing.id ? updated : h));
            set({ highlights: nextHighlights });
            await saveLocalArrays(uid, get().notes, nextHighlights, get().bookmarks);
            if (!isGuest) {
                await setDoc(doc(db, 'users', uid, 'highlights', existing.id), updated, { merge: true });
            }
            return updated;
        }

        const newHighlight: Highlight = {
            id: makeId('hl'),
            userId: uid,
            devotionalId,
            devotionalTitle: meta?.devotionalTitle,
            scriptureReference: meta?.scriptureReference,
            devotionalDate: meta?.devotionalDate,
            section: meta?.section,
            paragraphIndex: meta?.paragraphIndex,
            text: trimmed,
            color,
            startOffset,
            endOffset,
            createdAt: new Date().toISOString(),
        };

        const nextHighlights = [newHighlight, ...get().highlights];
        set({ highlights: nextHighlights });
        await saveLocalArrays(uid, get().notes, nextHighlights, get().bookmarks);

        if (!isGuest) {
            await setDoc(doc(db, 'users', uid, 'highlights', newHighlight.id), newHighlight);
        }

        return newHighlight;
    },

    removeHighlight: async (highlightId) => {
        const { uid, isGuest } = getActiveUserContext();
        const nextHighlights = get().highlights.filter((h) => h.id !== highlightId);
        set({ highlights: nextHighlights });
        await saveLocalArrays(uid, get().notes, nextHighlights, get().bookmarks);

        if (!isGuest) {
            await deleteDoc(doc(db, 'users', uid, 'highlights', highlightId));
        }
    },

    getHighlightsForDevotional: (devotionalId) => {
        return get().highlights.filter((h) => h.devotionalId === devotionalId);
    },

    toggleBookmark: async (devotional) => {
        const { uid, isGuest } = getActiveUserContext();
        const exists = get().bookmarks.some((b) => b.devotionalId === devotional.id);

        if (exists) {
            const nextBookmarks = get().bookmarks.filter((b) => b.devotionalId !== devotional.id);
            set({ bookmarks: nextBookmarks });
            await saveLocalArrays(uid, get().notes, get().highlights, nextBookmarks);
            if (!isGuest) {
                await deleteDoc(doc(db, 'users', uid, 'bookmarks', devotional.id));
            }
            return false;
        } else {
            const bookmark: Bookmark = {
                devotionalId: devotional.id,
                userId: uid,
                title: devotional.title,
                scriptureReference: devotional.scriptureReference,
                date: devotional.date,
                dayNumber: devotional.dayNumber,
                createdAt: new Date().toISOString(),
            };
            const nextBookmarks = [bookmark, ...get().bookmarks];
            set({ bookmarks: nextBookmarks });
            await saveLocalArrays(uid, get().notes, get().highlights, nextBookmarks);
            if (!isGuest) {
                await setDoc(doc(db, 'users', uid, 'bookmarks', devotional.id), bookmark);
            }
            return true;
        }
    },

    isBookmarked: (devotionalId) => {
        return get().bookmarks.some((b) => b.devotionalId === devotionalId);
    },

    getDevotionalIdsWithNotes: () => {
        const state = get();
        const noteIds = state.notes.map((n) => n.devotionalId);
        const highlightIds = state.highlights.map((h) => h.devotionalId);
        return [...new Set([...noteIds, ...highlightIds])];
    },
}));
