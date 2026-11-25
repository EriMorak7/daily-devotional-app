import { useState, useEffect } from 'react';
import {
    collection,
    collectionGroup,
    doc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { timestampToIso } from '../types';
import type { CommunityCommentDoc, ModerationReport } from '../types';

export default function Comments() {
    const [tab, setTab] = useState<'comments' | 'reports'>('comments');
    const [comments, setComments] = useState<CommunityCommentDoc[]>([]);
    const [reports, setReports] = useState<ModerationReport[]>([]);
    const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const loadModerationData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [commentsSnap, reportsSnap] = await Promise.all([
                getDocs(
                    query(
                        collectionGroup(db, 'comments'),
                        orderBy('createdAt', 'desc'),
                        limit(60)
                    )
                ).catch(() => getDocs(query(collectionGroup(db, 'comments'), limit(60)))),
                getDocs(
                    query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50))
                ).catch(() => getDocs(collection(db, 'reports'))),
            ]);

            const loadedComments: CommunityCommentDoc[] = [];
            commentsSnap.forEach((d) => {
                const raw = d.data();
                const parentDevId =
                    typeof raw.devotionalId === 'string'
                        ? raw.devotionalId
                        : d.ref.parent.parent?.id || '';
                const reactionsObj = (raw.reactions || {}) as Record<string, unknown>;
                loadedComments.push({
                    id: d.id,
                    devotionalId: parentDevId,
                    authorId: String(raw.authorId || ''),
                    authorName: String(raw.authorName || 'Church Member'),
                    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
                    content: String(raw.content || ''),
                    reactions: {
                        amen: Array.isArray(reactionsObj.amen) ? (reactionsObj.amen as string[]) : [],
                        heart: Array.isArray(reactionsObj.heart) ? (reactionsObj.heart as string[]) : [],
                        fire: Array.isArray(reactionsObj.fire) ? (reactionsObj.fire as string[]) : [],
                    },
                    status: raw.status === 'hidden' ? 'hidden' : 'visible',
                    createdAt: timestampToIso(raw.createdAt),
                });
            });

            const loadedReports: ModerationReport[] = [];
            reportsSnap.forEach((r) => {
                const raw = r.data();
                loadedReports.push({
                    id: r.id,
                    commentId: String(raw.commentId || ''),
                    devotionalId: String(raw.devotionalId || ''),
                    reporterId: String(raw.reporterId || ''),
                    reason: String(raw.reason || ''),
                    status: raw.status === 'resolved' ? 'resolved' : 'open',
                    createdAt: timestampToIso(raw.createdAt),
                });
            });

            setComments(loadedComments);
            setReports(loadedReports);
        } catch (err) {
            console.error('Error loading moderation queue:', err);
            setError('Failed to load community reflections from Firestore.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadModerationData();
    }, []);

    const handleSetCommentStatus = async (
        comment: CommunityCommentDoc,
        nextStatus: 'visible' | 'hidden'
    ) => {
        try {
            // Firestore rules enforce `onlyChanged(['status', 'updatedAt'])` for admin moderation
            await updateDoc(
                doc(db, 'devotionals', comment.devotionalId, 'comments', comment.id),
                {
                    status: nextStatus,
                    updatedAt: serverTimestamp(),
                }
            );
            setComments((prev) =>
                prev.map((c) => (c.id === comment.id ? { ...c, status: nextStatus } : c))
            );
            showToast(nextStatus === 'hidden' ? 'Reflection hidden' : 'Reflection visible');
        } catch (err) {
            console.error('Failed updating comment status:', err);
            showToast('Failed to update comment status');
        }
    };

    const handleDeleteComment = async (comment: CommunityCommentDoc) => {
        if (!confirm('Permanently delete this community reflection?')) return;
        try {
            await deleteDoc(
                doc(db, 'devotionals', comment.devotionalId, 'comments', comment.id)
            );
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
            showToast('Reflection deleted');
        } catch (err) {
            console.error('Failed deleting comment:', err);
            showToast('Failed to delete reflection');
        }
    };

    const handleResolveReport = async (report: ModerationReport, hideCommentToo: boolean) => {
        try {
            if (hideCommentToo && report.devotionalId && report.commentId) {
                await updateDoc(
                    doc(db, 'devotionals', report.devotionalId, 'comments', report.commentId),
                    {
                        status: 'hidden',
                        updatedAt: serverTimestamp(),
                    }
                ).catch(() => {});
            }
            await updateDoc(doc(db, 'reports', report.id), {
                status: 'resolved',
            });
            setReports((prev) =>
                prev.map((r) => (r.id === report.id ? { ...r, status: 'resolved' } : r))
            );
            showToast(hideCommentToo ? 'Comment hidden & report resolved' : 'Report resolved');
        } catch (err) {
            console.error('Failed resolving report:', err);
            showToast('Error resolving report');
        }
    };

    const filteredComments =
        filter === 'all' ? comments : comments.filter((c) => c.status === filter);
    const openReportsCount = reports.filter((r) => r.status === 'open').length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Community Moderation</h2>
                    <p>Review church reflections, replies, and member reports</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        className={`btn ${tab === 'comments' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTab('comments')}
                    >
                        Reflections ({comments.length})
                    </button>
                    <button
                        className={`btn ${tab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTab('reports')}
                    >
                        Reports ({openReportsCount} open)
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="card">Loading community reflections…</div>
            ) : error ? (
                <div className="card">
                    <p style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</p>
                    <button
                        className="btn btn-secondary"
                        onClick={() => void loadModerationData()}
                    >
                        Retry
                    </button>
                </div>
            ) : tab === 'comments' ? (
                <div className="card">
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                        {(['all', 'visible', 'hidden'] as const).map((f) => (
                            <button
                                key={f}
                                className={`btn btn-sm ${
                                    filter === f ? 'btn-primary' : 'btn-secondary'
                                }`}
                                onClick={() => setFilter(f)}
                            >
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {filteredComments.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">💬</div>
                            <h4>No community reflections found</h4>
                            <p>Member reflections posted in the app will appear here in real time.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Member</th>
                                        <th>Reflection</th>
                                        <th>Devotional ID</th>
                                        <th>Reactions</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredComments.map((c) => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600 }}>{c.authorName}</td>
                                            <td style={{ maxWidth: 360 }}>{c.content}</td>
                                            <td
                                                style={{
                                                    fontSize: 12,
                                                    color: 'var(--text-secondary)',
                                                }}
                                            >
                                                {c.devotionalId}
                                            </td>
                                            <td style={{ fontSize: 12 }}>
                                                🙏 {c.reactions.amen.length} · ❤️{' '}
                                                {c.reactions.heart.length} · 🔥{' '}
                                                {c.reactions.fire.length}
                                            </td>
                                            <td>
                                                <span
                                                    className={`badge ${
                                                        c.status === 'visible'
                                                            ? 'badge-success'
                                                            : 'badge-error'
                                                    }`}
                                                >
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {c.status === 'visible' ? (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() =>
                                                                void handleSetCommentStatus(
                                                                    c,
                                                                    'hidden'
                                                                )
                                                            }
                                                        >
                                                            Hide
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() =>
                                                                void handleSetCommentStatus(
                                                                    c,
                                                                    'visible'
                                                                )
                                                            }
                                                        >
                                                            Restore
                                                        </button>
                                                    )}
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() =>
                                                            void handleDeleteComment(c)
                                                        }
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
                    )}
                </div>
            ) : (
                <div className="card">
                    {reports.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🛡️</div>
                            <h4>No reported comments</h4>
                            <p>Any community reflection flagged by members will appear here.</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Reason</th>
                                        <th>Devotional / Comment</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((r) => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{r.reason}</td>
                                            <td
                                                style={{
                                                    fontSize: 12,
                                                    color: 'var(--text-secondary)',
                                                }}
                                            >
                                                {r.devotionalId} / {r.commentId}
                                            </td>
                                            <td>
                                                <span
                                                    className={`badge ${
                                                        r.status === 'open'
                                                            ? 'badge-warning'
                                                            : 'badge-success'
                                                    }`}
                                                >
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td>
                                                {r.status === 'open' && (
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            onClick={() =>
                                                                void handleResolveReport(r, true)
                                                            }
                                                        >
                                                            Hide Comment & Resolve
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() =>
                                                                void handleResolveReport(r, false)
                                                            }
                                                        >
                                                            Dismiss Report
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {toast && <div className="toast">✅ {toast}</div>}
        </div>
    );
}
