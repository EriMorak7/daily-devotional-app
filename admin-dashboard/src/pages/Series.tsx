import { useState, useEffect } from 'react';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    setDoc,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { toLocalDateKey, isValidDateKey } from '../types';
import type { DevotionalSeries, AppPublicConfig } from '../types';

const EMPTY_SERIES: Omit<DevotionalSeries, 'id'> = {
    title: '',
    description: '',
    startDate: toLocalDateKey(),
    totalDays: 30,
    status: 'active',
    coverImage: null,
};

export default function SeriesPage() {
    const [seriesList, setSeriesList] = useState<DevotionalSeries[]>([]);
    const [config, setConfig] = useState<AppPublicConfig>({
        activeSeriesId: null,
        churchName: 'Sufficient Grace Church',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<DevotionalSeries | null>(null);
    const [form, setForm] = useState<Omit<DevotionalSeries, 'id'>>(EMPTY_SERIES);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3200);
    };

    const loadAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [seriesSnap, cfgSnap] = await Promise.all([
                getDocs(query(collection(db, 'series'), orderBy('startDate', 'desc'))),
                getDoc(doc(db, 'app_config', 'public')),
            ]);

            const list: DevotionalSeries[] = [];
            seriesSnap.forEach((d) => {
                const raw = d.data();
                list.push({
                    id: d.id,
                    title: String(raw.title || ''),
                    description: String(raw.description || ''),
                    startDate: isValidDateKey(raw.startDate) ? raw.startDate : toLocalDateKey(),
                    totalDays: typeof raw.totalDays === 'number' ? raw.totalDays : null,
                    status:
                        raw.status === 'draft' || raw.status === 'archived'
                            ? raw.status
                            : 'active',
                    coverImage: typeof raw.coverImage === 'string' ? raw.coverImage : null,
                });
            });

            if (cfgSnap.exists()) {
                const c = cfgSnap.data();
                setConfig({
                    activeSeriesId: typeof c.activeSeriesId === 'string' ? c.activeSeriesId : null,
                    churchName:
                        typeof c.churchName === 'string' && c.churchName.trim()
                            ? c.churchName
                            : 'Sufficient Grace Church',
                });
            }

            setSeriesList(list);
        } catch (err) {
            console.error('Error loading series:', err);
            setError('Failed to load series configuration.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAll();
    }, []);

    const handleSaveConfig = async (nextActiveSeriesId: string | null, nextChurchName = config.churchName) => {
        try {
            await setDoc(
                doc(db, 'app_config', 'public'),
                {
                    activeSeriesId: nextActiveSeriesId,
                    churchName: nextChurchName.trim() || 'Sufficient Grace Church',
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            setConfig({
                activeSeriesId: nextActiveSeriesId,
                churchName: nextChurchName.trim() || 'Sufficient Grace Church',
            });
            showToast('Church configuration updated');
        } catch (err) {
            console.error('Failed saving app_config:', err);
            showToast('Failed to update configuration');
        }
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ ...EMPTY_SERIES, startDate: toLocalDateKey() });
        setShowModal(true);
    };

    const openEdit = (s: DevotionalSeries) => {
        setEditing(s);
        setForm({
            title: s.title,
            description: s.description,
            startDate: s.startDate,
            totalDays: s.totalDays,
            status: s.status,
            coverImage: s.coverImage,
        });
        setShowModal(true);
    };

    const handleSaveSeries = async () => {
        if (!form.title.trim() || !isValidDateKey(form.startDate)) {
            showToast('Please provide a series title and a valid start date (YYYY-MM-DD).');
            return;
        }

        const payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            startDate: form.startDate,
            totalDays: form.totalDays && form.totalDays > 0 ? form.totalDays : null,
            status: form.status,
            coverImage: form.coverImage?.trim() || null,
            updatedAt: serverTimestamp(),
        };

        try {
            if (editing) {
                await updateDoc(doc(db, 'series', editing.id), payload);
                showToast('Series updated');
            } else {
                const ref = await addDoc(collection(db, 'series'), {
                    ...payload,
                    createdAt: serverTimestamp(),
                });
                if (!config.activeSeriesId && form.status === 'active') {
                    await handleSaveConfig(ref.id);
                }
                showToast('Series created');
            }
            setShowModal(false);
            await loadAll();
        } catch (err) {
            console.error('Error saving series:', err);
            showToast('Error saving series');
        }
    };

    const handleDeleteSeries = async (id: string) => {
        if (!confirm('Delete this devotional series? Devotionals inside it will not be deleted.')) {
            return;
        }
        try {
            await deleteDoc(doc(db, 'series', id));
            if (config.activeSeriesId === id) {
                await handleSaveConfig(null);
            }
            setSeriesList((prev) => prev.filter((s) => s.id !== id));
            showToast('Series deleted');
        } catch (err) {
            console.error('Failed deleting series:', err);
            showToast('Error deleting series');
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Series & Start Dates</h2>
                    <p>
                        Define explicit series start dates so each user’s devotional day is
                        calculated accurately from Day 1.
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    + New Series
                </button>
            </div>

            {/* Church Name & Active Series Bar */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Church / Ministry Name (shown in app)</label>
                        <input
                            className="form-control"
                            value={config.churchName}
                            onChange={(e) => setConfig({ ...config, churchName: e.target.value })}
                            placeholder="Sufficient Grace Church"
                        />
                    </div>
                    <div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => void handleSaveConfig(config.activeSeriesId, config.churchName)}
                        >
                            Save Church Identity
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="card">Loading series…</div>
            ) : error ? (
                <div className="card">
                    <p style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</p>
                    <button className="btn btn-secondary" onClick={() => void loadAll()}>
                        Retry
                    </button>
                </div>
            ) : seriesList.length === 0 ? (
                <div className="card empty-state">
                    <div className="icon">📚</div>
                    <h4>No devotional series created yet</h4>
                    <p>Create your first series with an explicit start date to anchor Day 1.</p>
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Series Title</th>
                                    <th>Start Date (Day 1)</th>
                                    <th>Total Days</th>
                                    <th>Status</th>
                                    <th>Active in App</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {seriesList.map((s) => {
                                    const isActive = config.activeSeriesId === s.id;
                                    return (
                                        <tr key={s.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s.title}</div>
                                                {s.description && (
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        {s.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td>{s.startDate}</td>
                                            <td>{s.totalDays || 'Open-ended'}</td>
                                            <td>
                                                <span
                                                    className={`badge ${
                                                        s.status === 'active'
                                                            ? 'badge-success'
                                                            : s.status === 'draft'
                                                                ? 'badge-warning'
                                                                : 'badge-info'
                                                    }`}
                                                >
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td>
                                                {isActive ? (
                                                    <span className="badge badge-success">★ Active Series</span>
                                                ) : (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => void handleSaveConfig(s.id)}
                                                    >
                                                        Set Active
                                                    </button>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => openEdit(s)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => void handleDeleteSeries(s.id)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{editing ? 'Edit Series' : 'New Devotional Series'}</h3>

                        <div className="form-group">
                            <label>Series Title *</label>
                            <input
                                className="form-control"
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Walking in Grace — Winter 2026"
                            />
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                className="form-control"
                                style={{ minHeight: 72 }}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="A 30-day journey through the epistles…"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Explicit Start Date (Day 1) *</label>
                                <input
                                    className="form-control"
                                    type="date"
                                    value={form.startDate}
                                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Total Days (optional)</label>
                                <input
                                    className="form-control"
                                    type="number"
                                    min={1}
                                    value={form.totalDays ?? ''}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            totalDays: e.target.value
                                                ? parseInt(e.target.value, 10)
                                                : null,
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    className="form-control"
                                    value={form.status}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            status: e.target.value as DevotionalSeries['status'],
                                        })
                                    }
                                >
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Cover Image URL (optional)</label>
                                <input
                                    className="form-control"
                                    value={form.coverImage ?? ''}
                                    onChange={(e) =>
                                        setForm({ ...form, coverImage: e.target.value || null })
                                    }
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={() => void handleSaveSeries()}>
                                {editing ? 'Update Series' : 'Create Series'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="toast">✅ {toast}</div>}
        </div>
    );
}
