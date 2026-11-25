import { useState, useEffect, useMemo } from 'react';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
    addDaysToDateKey,
    daysBetweenDateKeys,
    isValidDateKey,
    normalizeDevotionalDoc,
    toLocalDateKey,
} from '../types';
import type {
    DevotionalEntry,
    DevotionalSeries,
    DevotionalStatus,
} from '../types';

const PAGE_SIZE = 15;

const EMPTY_FORM: Omit<DevotionalEntry, 'id'> = {
    seriesId: null,
    dayNumber: 1,
    date: toLocalDateKey(),
    title: '',
    scriptureReference: '',
    scriptureText: '',
    body: '',
    prayer: '',
    reflectionPrompt: 'What is God teaching you through this passage today?',
    author: 'Pastoral Team',
    tags: [],
    coverImage: null,
    audioUrl: null,
    status: 'draft',
    published: false,
};

export default function Devotionals() {
    const [entries, setEntries] = useState<DevotionalEntry[]>([]);
    const [seriesList, setSeriesList] = useState<DevotionalSeries[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters & Pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | DevotionalStatus | 'scheduled'>('all');
    const [seriesFilter, setSeriesFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);

    // Modals
    const [showEditorModal, setShowEditorModal] = useState(false);
    const [editing, setEditing] = useState<DevotionalEntry | null>(null);
    const [form, setForm] = useState<Omit<DevotionalEntry, 'id'>>(EMPTY_FORM);
    const [tagInput, setTagInput] = useState('');
    const [uploadingMedia, setUploadingMedia] = useState<'cover' | 'audio' | null>(null);

    const [previewEntry, setPreviewEntry] = useState<DevotionalEntry | null>(null);
    const [scheduleTarget, setScheduleTarget] = useState<DevotionalEntry | null>(null);
    const [scheduleDate, setScheduleDate] = useState('');

    const [toast, setToast] = useState('');

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(''), 3200);
    };

    const loadAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [seriesSnap, devSnap] = await Promise.all([
                getDocs(collection(db, 'series')),
                getDocs(query(collection(db, 'devotionals'), orderBy('date', 'desc'))).catch(() =>
                    getDocs(collection(db, 'devotionals'))
                ),
            ]);

            const loadedSeries: DevotionalSeries[] = [];
            const seriesStartById = new Map<string, string>();
            seriesSnap.forEach((s) => {
                const data = s.data();
                const startDate = isValidDateKey(data.startDate) ? data.startDate : toLocalDateKey();
                seriesStartById.set(s.id, startDate);
                loadedSeries.push({
                    id: s.id,
                    title: String(data.title || 'Series'),
                    description: String(data.description || ''),
                    startDate,
                    totalDays: typeof data.totalDays === 'number' ? data.totalDays : null,
                    status:
                        data.status === 'draft' || data.status === 'archived'
                            ? data.status
                            : 'active',
                    coverImage: typeof data.coverImage === 'string' ? data.coverImage : null,
                });
            });

            const loadedEntries: DevotionalEntry[] = [];
            devSnap.forEach((d) => {
                const raw = d.data();
                const sId = typeof raw.seriesId === 'string' ? raw.seriesId : undefined;
                const startDate = sId ? seriesStartById.get(sId) : undefined;
                loadedEntries.push(normalizeDevotionalDoc(d.id, raw, startDate));
            });

            loadedEntries.sort((a, b) => {
                if (a.date !== b.date) return b.date.localeCompare(a.date);
                return b.dayNumber - a.dayNumber;
            });

            setSeriesList(loadedSeries);
            setEntries(loadedEntries);
        } catch (err) {
            console.error('Error loading devotionals:', err);
            setError('Failed to load devotionals from Firestore.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAll();
    }, []);

    const todayKey = toLocalDateKey();

    const isScheduledFuture = (entry: DevotionalEntry): boolean => {
        return entry.status === 'published' && daysBetweenDateKeys(todayKey, entry.date) > 0;
    };

    const filteredEntries = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return entries.filter((e) => {
            if (seriesFilter !== 'all' && (e.seriesId || 'none') !== seriesFilter) {
                return false;
            }
            if (statusFilter === 'scheduled') {
                if (!(e.status === 'published' && daysBetweenDateKeys(todayKey, e.date) > 0)) return false;
            } else if (statusFilter !== 'all' && e.status !== statusFilter) {
                return false;
            }
            if (dateFrom && e.date < dateFrom) return false;
            if (dateTo && e.date > dateTo) return false;

            if (q) {
                const matchesTitle = e.title.toLowerCase().includes(q);
                const matchesScripture = e.scriptureReference.toLowerCase().includes(q);
                const matchesAuthor = e.author.toLowerCase().includes(q);
                const matchesTags = e.tags.some((t) => t.toLowerCase().includes(q));
                if (!matchesTitle && !matchesScripture && !matchesAuthor && !matchesTags) {
                    return false;
                }
            }
            return true;
        });
    }, [entries, seriesFilter, statusFilter, dateFrom, dateTo, searchQuery, todayKey]);

    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredEntries.slice(start, start + PAGE_SIZE);
    }, [filteredEntries, currentPage]);

    const computeDateForSeriesDay = (seriesId: string | null, dayNumber: number): string => {
        const s = seriesList.find((item) => item.id === seriesId);
        if (s && isValidDateKey(s.startDate)) {
            return addDaysToDateKey(s.startDate, Math.max(0, dayNumber - 1));
        }
        return form.date || toLocalDateKey();
    };

    const openCreate = () => {
        const defaultSeries =
            seriesList.find((s) => s.status === 'active') || seriesList[0] || null;
        const maxDayInSeries = entries
            .filter((e) => (defaultSeries ? e.seriesId === defaultSeries.id : true))
            .reduce((max, e) => Math.max(max, e.dayNumber), 0);
        const nextDay = maxDayInSeries + 1;
        const computedDate = defaultSeries
            ? addDaysToDateKey(defaultSeries.startDate, nextDay - 1)
            : toLocalDateKey();

        setEditing(null);
        setForm({
            ...EMPTY_FORM,
            seriesId: defaultSeries?.id || null,
            dayNumber: nextDay,
            date: computedDate,
        });
        setTagInput('');
        setShowEditorModal(true);
    };

    const openEdit = (entry: DevotionalEntry) => {
        setEditing(entry);
        setForm({
            seriesId: entry.seriesId,
            dayNumber: entry.dayNumber,
            date: entry.date,
            title: entry.title,
            scriptureReference: entry.scriptureReference,
            scriptureText: entry.scriptureText,
            body: entry.body,
            prayer: entry.prayer,
            reflectionPrompt: entry.reflectionPrompt,
            author: entry.author,
            tags: entry.tags,
            coverImage: entry.coverImage,
            audioUrl: entry.audioUrl,
            status: entry.status,
            published: entry.published,
        });
        setTagInput(entry.tags.join(', '));
        setShowEditorModal(true);
    };

    const buildFirestorePayload = (
        base: Omit<DevotionalEntry, 'id'>,
        statusOverride?: DevotionalStatus,
        dateOverride?: string
    ) => {
        const finalStatus = statusOverride ?? base.status;
        const finalDate = dateOverride ?? base.date;
        const isPublished = finalStatus === 'published';

        return {
            seriesId: base.seriesId || null,
            dayNumber: Math.max(1, Math.floor(base.dayNumber)),
            day: Math.max(1, Math.floor(base.dayNumber)), // legacy mirror
            date: finalDate,
            title: base.title.trim(),
            scriptureReference: base.scriptureReference.trim(),
            scripture: base.scriptureReference.trim(), // legacy mirror
            scriptureText: base.scriptureText.trim(),
            body: base.body.trim(),
            prayer: base.prayer.trim(),
            reflectionPrompt:
                base.reflectionPrompt.trim() ||
                'What is God teaching you through this passage today?',
            author: base.author.trim() || 'Pastoral Team',
            tags: base.tags,
            coverImage: base.coverImage?.trim() || null,
            audioUrl: base.audioUrl?.trim() || null,
            status: finalStatus,
            published: isPublished,
            publishedAt: isPublished ? serverTimestamp() : null,
            updatedAt: serverTimestamp(),
        };
    };

    const handleSave = async () => {
        if (!form.title.trim() || !form.scriptureReference.trim() || !form.body.trim()) {
            showToast('Title, Scripture Reference, and Devotional Body are required.');
            return;
        }
        if (!isValidDateKey(form.date)) {
            showToast('Date must be in YYYY-MM-DD format.');
            return;
        }

        const tags = tagInput
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        // Warn if duplicate dayNumber exists in same series
        const duplicate = entries.find(
            (e) =>
                e.id !== editing?.id &&
                e.seriesId === form.seriesId &&
                e.dayNumber === form.dayNumber
        );
        if (duplicate) {
            const proceed = confirm(
                `Day ${form.dayNumber} already exists in this series ("${duplicate.title}"). Save anyway?`
            );
            if (!proceed) return;
        }

        const payload = buildFirestorePayload({ ...form, tags });

        try {
            if (editing) {
                await updateDoc(doc(db, 'devotionals', editing.id), payload);
                showToast('Devotional updated');
            } else {
                await addDoc(collection(db, 'devotionals'), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                showToast('Devotional created');
            }
            setShowEditorModal(false);
            await loadAll();
        } catch (err) {
            console.error('Error saving devotional:', err);
            showToast('Error saving devotional');
        }
    };

    const handleQuickStatusChange = async (
        entry: DevotionalEntry,
        nextStatus: DevotionalStatus,
        nextDate?: string
    ) => {
        try {
            const payload = buildFirestorePayload(entry, nextStatus, nextDate);
            await updateDoc(doc(db, 'devotionals', entry.id), payload);
            await loadAll();
            showToast(
                nextStatus === 'published'
                    ? nextDate && daysBetweenDateKeys(todayKey, nextDate) > 0
                        ? `Scheduled for ${nextDate}`
                        : 'Devotional published'
                    : nextStatus === 'archived'
                        ? 'Devotional archived'
                        : 'Moved to draft'
            );
        } catch (err) {
            console.error('Failed updating status:', err);
            showToast('Failed to update status');
        }
    };

    const handleDuplicate = async (entry: DevotionalEntry) => {
        const nextDay = entry.dayNumber + 1;
        const nextDate = computeDateForSeriesDay(entry.seriesId, nextDay);
        const copyPayload = buildFirestorePayload(
            {
                ...entry,
                dayNumber: nextDay,
                date: nextDate,
                title: `${entry.title} (Copy)`,
            },
            'draft'
        );

        try {
            await addDoc(collection(db, 'devotionals'), {
                ...copyPayload,
                createdAt: serverTimestamp(),
            });
            showToast('Devotional duplicated as draft');
            await loadAll();
        } catch (err) {
            console.error('Duplicate error:', err);
            showToast('Error duplicating devotional');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to permanently delete this devotional?')) return;
        try {
            await deleteDoc(doc(db, 'devotionals', id));
            setEntries((prev) => prev.filter((e) => e.id !== id));
            showToast('Devotional deleted');
        } catch (err) {
            console.error('Error deleting devotional:', err);
            showToast('Error deleting devotional');
        }
    };

    const handleMediaUpload = async (file: File, kind: 'cover' | 'audio') => {
        setUploadingMedia(kind);
        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const targetId = editing?.id || 'drafts';
            const storageRef = ref(
                storage,
                `devotional-media/${targetId}/${Date.now()}-${safeName}`
            );
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            if (kind === 'cover') {
                setForm((prev) => ({ ...prev, coverImage: url }));
            } else {
                setForm((prev) => ({ ...prev, audioUrl: url }));
            }
            showToast(kind === 'cover' ? 'Cover image uploaded' : 'Audio file uploaded');
        } catch (err) {
            console.error('Upload error:', err);
            showToast('Upload failed — you can also paste a direct media URL.');
        } finally {
            setUploadingMedia(null);
        }
    };

    const handleUpgradeLegacyDocs = async () => {
        try {
            const snap = await getDocs(collection(db, 'devotionals'));
            const batch = writeBatch(db);
            let upgradedCount = 0;

            snap.forEach((d) => {
                const raw = d.data();
                const needsUpgrade =
                    typeof raw.dayNumber !== 'number' ||
                    typeof raw.scriptureReference !== 'string' ||
                    typeof raw.published !== 'boolean' ||
                    !isValidDateKey(raw.date);

                if (needsUpgrade) {
                    const norm = normalizeDevotionalDoc(d.id, raw);
                    batch.set(
                        doc(db, 'devotionals', d.id),
                        buildFirestorePayload(norm, norm.status),
                        { merge: true }
                    );
                    upgradedCount += 1;
                }
            });

            if (upgradedCount > 0) {
                await batch.commit();
                showToast(`Upgraded ${upgradedCount} legacy devotional document(s)`);
                await loadAll();
            } else {
                showToast('All devotionals already match the production schema');
            }
        } catch (err) {
            console.error('Legacy migration error:', err);
            showToast('Failed upgrading legacy documents');
        }
    };

    const renderStatusBadge = (entry: DevotionalEntry) => {
        if (isScheduledFuture(entry)) {
            return <span className="badge badge-warning">Scheduled ({entry.date})</span>;
        }
        if (entry.status === 'published') {
            return <span className="badge badge-success">Published</span>;
        }
        if (entry.status === 'archived') {
            return <span className="badge badge-info">Archived</span>;
        }
        return <span className="badge badge-warning">Draft</span>;
    };

    const seriesTitle = (seriesId: string | null) =>
        seriesList.find((s) => s.id === seriesId)?.title || 'Unassigned';

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Devotionals CMS</h2>
                    <p>Create, schedule, preview, and publish church devotionals</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => void handleUpgradeLegacyDocs()}
                        title="Normalizes any older MVP documents to the new schema"
                    >
                        Normalize Legacy Docs
                    </button>
                    <button className="btn btn-primary" onClick={openCreate}>
                        + New Devotional
                    </button>
                </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="filters-grid">
                    <div>
                        <label className="small-label">Search Title / Scripture / Author</label>
                        <input
                            className="form-control"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search…"
                        />
                    </div>
                    <div>
                        <label className="small-label">Publish Status</label>
                        <select
                            className="form-control"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value as typeof statusFilter);
                                setPage(1);
                            }}
                        >
                            <option value="all">All Statuses</option>
                            <option value="published">Published</option>
                            <option value="scheduled">Scheduled (Future Date)</option>
                            <option value="draft">Draft</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label className="small-label">Series</label>
                        <select
                            className="form-control"
                            value={seriesFilter}
                            onChange={(e) => {
                                setSeriesFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="all">All Series</option>
                            {seriesList.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.title}
                                </option>
                            ))}
                            <option value="none">Unassigned</option>
                        </select>
                    </div>
                    <div>
                        <label className="small-label">From Date</label>
                        <input
                            className="form-control"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <div>
                        <label className="small-label">To Date</label>
                        <input
                            className="form-control"
                            type="date"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card">
                {loading ? (
                    <div style={{ padding: 24 }}>Loading devotionals…</div>
                ) : error ? (
                    <div style={{ padding: 24 }}>
                        <p style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</p>
                        <button className="btn btn-secondary" onClick={() => void loadAll()}>
                            Retry
                        </button>
                    </div>
                ) : paginatedEntries.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📖</div>
                        <h4>No devotionals match your filter</h4>
                        <p>Create a new devotional entry or clear your current filters.</p>
                    </div>
                ) : (
                    <>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Day / Date</th>
                                        <th>Title & Series</th>
                                        <th>Scripture</th>
                                        <th>Media</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedEntries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>
                                                    Day {entry.dayNumber}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: 'var(--text-secondary)',
                                                    }}
                                                >
                                                    {entry.date}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{entry.title}</div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    {seriesTitle(entry.seriesId)} · {entry.author}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                                {entry.scriptureReference}
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                {entry.audioUrl ? '🔊 Audio ' : ''}
                                                {entry.coverImage ? '🖼️ Cover' : ''}
                                                {!entry.audioUrl && !entry.coverImage ? '—' : ''}
                                            </td>
                                            <td>{renderStatusBadge(entry)}</td>
                                            <td>
                                                <div className="action-buttons-wrap">
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setPreviewEntry(entry)}
                                                    >
                                                        Preview
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => openEdit(entry)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => void handleDuplicate(entry)}
                                                    >
                                                        Duplicate
                                                    </button>
                                                    {entry.status !== 'published' ? (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() =>
                                                                void handleQuickStatusChange(
                                                                    entry,
                                                                    'published'
                                                                )
                                                            }
                                                        >
                                                            Publish
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() =>
                                                                void handleQuickStatusChange(
                                                                    entry,
                                                                    'draft'
                                                                )
                                                            }
                                                        >
                                                            Unpublish
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => {
                                                            setScheduleTarget(entry);
                                                            setScheduleDate(entry.date);
                                                        }}
                                                    >
                                                        Schedule
                                                    </button>
                                                    {entry.status !== 'archived' && (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() =>
                                                                void handleQuickStatusChange(
                                                                    entry,
                                                                    'archived'
                                                                )
                                                            }
                                                        >
                                                            Archive
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => void handleDelete(entry.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <div className="pagination-bar">
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                Showing {paginatedEntries.length} of {filteredEntries.length}{' '}
                                devotionals (Page {currentPage} of {totalPages})
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={currentPage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    ← Previous
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ─── Create / Edit Modal ─── */}
            {showEditorModal && (
                <div className="modal-backdrop" onClick={() => setShowEditorModal(false)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 780 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>{editing ? 'Edit Devotional' : 'Create Devotional'}</h3>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Series</label>
                                <select
                                    className="form-control"
                                    value={form.seriesId || ''}
                                    onChange={(e) => {
                                        const nextSeriesId = e.target.value || null;
                                        const nextDate = computeDateForSeriesDay(
                                            nextSeriesId,
                                            form.dayNumber
                                        );
                                        setForm({
                                            ...form,
                                            seriesId: nextSeriesId,
                                            date: nextDate,
                                        });
                                    }}
                                >
                                    <option value="">— No Series —</option>
                                    {seriesList.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.title} (Starts {s.startDate})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Publish Status</label>
                                <select
                                    className="form-control"
                                    value={form.status}
                                    onChange={(e) => {
                                        const st = e.target.value as DevotionalStatus;
                                        setForm({
                                            ...form,
                                            status: st,
                                            published: st === 'published',
                                        });
                                    }}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">
                                        Published (or Scheduled if future date)
                                    </option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Day Number *</label>
                                <input
                                    className="form-control"
                                    type="number"
                                    min={1}
                                    value={form.dayNumber}
                                    onChange={(e) => {
                                        const nextDay = Math.max(
                                            1,
                                            parseInt(e.target.value, 10) || 1
                                        );
                                        const nextDate = computeDateForSeriesDay(
                                            form.seriesId,
                                            nextDay
                                        );
                                        setForm({
                                            ...form,
                                            dayNumber: nextDay,
                                            date: nextDate,
                                        });
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Date (YYYY-MM-DD, auto-calculated from Series Start) *</label>
                                <input
                                    className="form-control"
                                    type="date"
                                    value={form.date}
                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Devotional Title *</label>
                                <input
                                    className="form-control"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="New Mercies Every Morning"
                                />
                            </div>
                            <div className="form-group">
                                <label>Author</label>
                                <input
                                    className="form-control"
                                    value={form.author}
                                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                                    placeholder="Pastor / Ministry Author"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Scripture Reference *</label>
                            <input
                                className="form-control"
                                value={form.scriptureReference}
                                onChange={(e) =>
                                    setForm({ ...form, scriptureReference: e.target.value })
                                }
                                placeholder="Lamentations 3:22-23"
                            />
                        </div>

                        <div className="form-group">
                            <label>Scripture Text *</label>
                            <textarea
                                className="form-control"
                                style={{ minHeight: 80 }}
                                value={form.scriptureText}
                                onChange={(e) =>
                                    setForm({ ...form, scriptureText: e.target.value })
                                }
                                placeholder="The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning…"
                            />
                        </div>

                        <div className="form-group">
                            <label>Devotional Body * (Separate paragraphs with a blank line)</label>
                            <textarea
                                className="form-control"
                                style={{ minHeight: 160 }}
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                placeholder="Write the main devotional reading…"
                            />
                        </div>

                        <div className="form-group">
                            <label>Reflection Prompt</label>
                            <input
                                className="form-control"
                                value={form.reflectionPrompt}
                                onChange={(e) =>
                                    setForm({ ...form, reflectionPrompt: e.target.value })
                                }
                                placeholder="What is God teaching you today?"
                            />
                        </div>

                        <div className="form-group">
                            <label>Closing Prayer</label>
                            <textarea
                                className="form-control"
                                style={{ minHeight: 84 }}
                                value={form.prayer}
                                onChange={(e) => setForm({ ...form, prayer: e.target.value })}
                                placeholder="Father, thank You that Your mercies are new today…"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Audio URL (MP3/M4A) or Upload File</label>
                                <input
                                    className="form-control"
                                    value={form.audioUrl || ''}
                                    onChange={(e) =>
                                        setForm({ ...form, audioUrl: e.target.value || null })
                                    }
                                    placeholder="https://.../devotional-day-1.mp3"
                                />
                                <input
                                    type="file"
                                    accept="audio/*"
                                    style={{ marginTop: 6, fontSize: 12 }}
                                    disabled={uploadingMedia !== null}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleMediaUpload(file, 'audio');
                                    }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Cover Image URL or Upload Image</label>
                                <input
                                    className="form-control"
                                    value={form.coverImage || ''}
                                    onChange={(e) =>
                                        setForm({ ...form, coverImage: e.target.value || null })
                                    }
                                    placeholder="https://.../cover.jpg"
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ marginTop: 6, fontSize: 12 }}
                                    disabled={uploadingMedia !== null}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleMediaUpload(file, 'cover');
                                    }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Tags (comma separated)</label>
                            <input
                                className="form-control"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                placeholder="grace, mercy, faithfulness"
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowEditorModal(false)}
                            >
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={() => void handleSave()}>
                                {editing ? 'Update Devotional' : 'Create Devotional'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Editorial Reader Preview Modal ─── */}
            {previewEntry && (
                <div className="modal-backdrop" onClick={() => setPreviewEntry(null)}>
                    <div
                        className="modal reader-preview-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="preview-eyebrow">
                            DAY {previewEntry.dayNumber} · {previewEntry.date}
                        </div>
                        <h2 className="preview-title">{previewEntry.title}</h2>
                        <div className="preview-author">By {previewEntry.author}</div>

                        <div className="preview-scripture">
                            <div className="preview-scripture-ref">
                                {previewEntry.scriptureReference}
                            </div>
                            <p>“{previewEntry.scriptureText}”</p>
                        </div>

                        <div className="preview-body">
                            {previewEntry.body
                                .split(/\n\s*\n/)
                                .filter(Boolean)
                                .map((p, idx) => (
                                    <p key={idx}>{p}</p>
                                ))}
                        </div>

                        <div className="preview-reflection">
                            <div className="preview-eyebrow">TODAY’S REFLECTION</div>
                            <p>“{previewEntry.reflectionPrompt}”</p>
                        </div>

                        {previewEntry.prayer && (
                            <div className="preview-prayer">
                                <div className="preview-eyebrow">CLOSING PRAYER</div>
                                <p>{previewEntry.prayer}</p>
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setPreviewEntry(null)}
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Schedule Dialog ─── */}
            {scheduleTarget && (
                <div className="modal-backdrop" onClick={() => setScheduleTarget(null)}>
                    <div
                        className="modal"
                        style={{ maxWidth: 420 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Schedule Devotional</h3>
                        <p
                            style={{
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                marginBottom: 16,
                            }}
                        >
                            Set the calendar release date for{' '}
                            <strong>{scheduleTarget.title}</strong>. The mobile app will
                            automatically reveal it on that local calendar date.
                        </p>
                        <div className="form-group">
                            <label>Release Date (YYYY-MM-DD)</label>
                            <input
                                className="form-control"
                                type="date"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                            />
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setScheduleTarget(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={async () => {
                                    if (!isValidDateKey(scheduleDate)) {
                                        showToast('Please select a valid date.');
                                        return;
                                    }
                                    const target = scheduleTarget;
                                    setScheduleTarget(null);
                                    await handleQuickStatusChange(
                                        target,
                                        'published',
                                        scheduleDate
                                    );
                                }}
                            >
                                Schedule & Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="toast">✅ {toast}</div>}
        </div>
    );
}
