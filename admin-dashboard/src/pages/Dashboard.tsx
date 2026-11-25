import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    collection,
    collectionGroup,
    getCountFromServer,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeDevotionalDoc, toLocalDateKey } from '../types';
import type { DevotionalEntry } from '../types';

interface LiveStats {
    totalUsers: number;
    publishedDevotionals: number;
    draftDevotionals: number;
    totalComments: number;
    openReports: number;
}

export default function Dashboard() {
    const [stats, setStats] = useState<LiveStats>({
        totalUsers: 0,
        publishedDevotionals: 0,
        draftDevotionals: 0,
        totalComments: 0,
        openReports: 0,
    });
    const [recentDevotionals, setRecentDevotionals] = useState<DevotionalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadOverview = async () => {
        setLoading(true);
        setError(null);
        try {
            const [usersCount, pubCount, draftCount, commentsCount, reportsCount, recentSnap] =
                await Promise.all([
                    getCountFromServer(collection(db, 'users')).catch(() => null),
                    getCountFromServer(
                        query(collection(db, 'devotionals'), where('status', '==', 'published'))
                    ).catch(() => null),
                    getCountFromServer(
                        query(collection(db, 'devotionals'), where('status', '==', 'draft'))
                    ).catch(() => null),
                    getCountFromServer(collectionGroup(db, 'comments')).catch(() => null),
                    getCountFromServer(
                        query(collection(db, 'reports'), where('status', '==', 'open'))
                    ).catch(() => null),
                    getDocs(
                        query(collection(db, 'devotionals'), orderBy('date', 'desc'), limit(5))
                    ).catch(() => getDocs(query(collection(db, 'devotionals'), limit(5)))),
                ]);

            const recents: DevotionalEntry[] = [];
            recentSnap.forEach((d) => {
                recents.push(normalizeDevotionalDoc(d.id, d.data()));
            });

            setStats({
                totalUsers: usersCount?.data().count ?? 0,
                publishedDevotionals: pubCount?.data().count ?? recents.filter((r) => r.published).length,
                draftDevotionals: draftCount?.data().count ?? recents.filter((r) => r.status === 'draft').length,
                totalComments: commentsCount?.data().count ?? 0,
                openReports: reportsCount?.data().count ?? 0,
            });
            setRecentDevotionals(recents);
        } catch (err) {
            console.error('Error loading dashboard overview:', err);
            setError('Unable to load live metrics from Firestore.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadOverview();
    }, []);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h2>Editorial Overview</h2>
                    <p>Live devotional library and church community metrics ({toLocalDateKey()})</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => void loadOverview()}>
                        Refresh
                    </button>
                    <Link to="/devotionals" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                        Manage Devotionals →
                    </Link>
                </div>
            </div>

            {error && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <p style={{ color: 'var(--error)' }}>{error}</p>
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div>
                        <div className="stat-value">
                            {loading ? '…' : stats.totalUsers.toLocaleString()}
                        </div>
                        <div className="stat-label">Registered Members</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📖</div>
                    <div>
                        <div className="stat-value">
                            {loading ? '…' : stats.publishedDevotionals}
                        </div>
                        <div className="stat-label">Published Devotionals</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">✍️</div>
                    <div>
                        <div className="stat-value">
                            {loading ? '…' : stats.draftDevotionals}
                        </div>
                        <div className="stat-label">Drafts</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">💬</div>
                    <div>
                        <div className="stat-value">
                            {loading ? '…' : stats.totalComments}
                        </div>
                        <div className="stat-label">Community Reflections</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🛡️</div>
                    <div>
                        <div className="stat-value">
                            {loading ? '…' : stats.openReports}
                        </div>
                        <div className="stat-label">Open Reports</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3>Recent Devotional Entries</h3>
                    <Link to="/devotionals" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
                        Open Full CMS
                    </Link>
                </div>

                {loading ? (
                    <p style={{ color: 'var(--text-secondary)' }}>Loading devotionals…</p>
                ) : recentDevotionals.length === 0 ? (
                    <div className="empty-state">
                        <h4>No devotionals yet</h4>
                        <p>Go to the Devotionals tab to create and publish your first reading.</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Day</th>
                                    <th>Date</th>
                                    <th>Title</th>
                                    <th>Scripture</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentDevotionals.map((d) => (
                                    <tr key={d.id}>
                                        <td style={{ fontWeight: 600 }}>Day {d.dayNumber}</td>
                                        <td>{d.date}</td>
                                        <td>{d.title}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {d.scriptureReference}
                                        </td>
                                        <td>
                                            <span
                                                className={`badge ${
                                                    d.status === 'published'
                                                        ? 'badge-success'
                                                        : d.status === 'archived'
                                                            ? 'badge-info'
                                                            : 'badge-warning'
                                                }`}
                                            >
                                                {d.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
