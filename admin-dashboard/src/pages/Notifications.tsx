import { useState, useEffect } from 'react';
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    orderBy,
    query,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { timestampToIso } from '../types';

interface AnnouncementItem {
    id: string;
    title: string;
    body: string;
    status: 'draft' | 'queued';
    createdBy: string;
    createdAt: string;
}

export default function Notifications() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<AnnouncementItem[]>([]);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3200);
    };

    const loadAnnouncements = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(
                query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
            );
            const list: AnnouncementItem[] = [];
            snap.forEach((d) => {
                const raw = d.data();
                list.push({
                    id: d.id,
                    title: String(raw.title || ''),
                    body: String(raw.body || ''),
                    status: raw.status === 'draft' ? 'draft' : 'queued',
                    createdBy: String(raw.createdBy || ''),
                    createdAt: timestampToIso(raw.createdAt),
                });
            });
            setHistory(list);
        } catch (err) {
            console.error('Failed loading announcements:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAnnouncements();
    }, []);

    const handleQueueAnnouncement = async (status: 'draft' | 'queued') => {
        if (!title.trim() || !body.trim()) {
            showToast('Please enter both an announcement title and message body.');
            return;
        }
        setSaving(true);
        try {
            await addDoc(collection(db, 'announcements'), {
                title: title.trim(),
                body: body.trim(),
                status,
                createdBy: auth.currentUser?.email || auth.currentUser?.uid || 'admin',
                createdAt: serverTimestamp(),
            });
            setTitle('');
            setBody('');
            showToast(
                status === 'queued'
                    ? 'Announcement saved & queued in Firestore'
                    : 'Announcement saved as draft'
            );
            await loadAnnouncements();
        } catch (err) {
            console.error('Error saving announcement:', err);
            showToast('Failed to save announcement');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this announcement record?')) return;
        try {
            await deleteDoc(doc(db, 'announcements', id));
            setHistory((prev) => prev.filter((item) => item.id !== id));
            showToast('Announcement deleted');
        } catch (err) {
            console.error('Failed deleting announcement:', err);
            showToast('Failed to delete announcement');
        }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Church Announcements & Reminders</h2>
                    <p>
                        Record church-wide devotional announcements in Firestore. (Daily &
                        streak reminders are scheduled locally on each member’s device in their
                        own timezone.)
                    </p>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <h3>New Announcement</h3>
                </div>

                <div className="form-group">
                    <label>Announcement Title</label>
                    <input
                        className="form-control"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="New 30-Day Advent Devotional Series Begins Tomorrow"
                    />
                </div>

                <div className="form-group">
                    <label>Message Body</label>
                    <textarea
                        className="form-control"
                        style={{ minHeight: 90 }}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Join our church family as we walk through the Gospel of Luke together…"
                    />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => void handleQueueAnnouncement('queued')}
                    >
                        {saving ? 'Saving…' : 'Queue Announcement'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        disabled={saving}
                        onClick={() => void handleQueueAnnouncement('draft')}
                    >
                        Save as Draft
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>Announcement History</h3>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading announcements…</p>
                ) : history.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🔔</div>
                        <h4>No announcements queued yet</h4>
                        <p>Announcements saved here are stored in the Firestore announcements collection.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Message</th>
                                    <th>Author</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.id}>
                                        <td style={{ fontWeight: 600 }}>{item.title}</td>
                                        <td>{item.body}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {item.createdBy}
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${
                                                    item.status === 'queued'
                                                        ? 'badge-success'
                                                        : 'badge-warning'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => void handleDelete(item.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {toast && <div className="toast">✅ {toast}</div>}
        </div>
    );
}
