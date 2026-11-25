import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Dashboard from './pages/Dashboard';
import Devotionals from './pages/Devotionals';
import SeriesPage from './pages/Series';
import Comments from './pages/Comments';
import Notifications from './pages/Notifications';
import './index.css';

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setIsAdmin(false);
                setAuthLoading(false);
                return;
            }
            try {
                const [tokenResult, adminSnap] = await Promise.all([
                    u.getIdTokenResult(),
                    getDoc(doc(db, 'admins', u.uid)),
                ]);
                const granted =
                    Boolean(tokenResult.claims.admin === true) || adminSnap.exists();
                setIsAdmin(granted);
            } catch {
                // If rules aren't deployed yet or network issue, check admin doc softly
                setIsAdmin(false);
            } finally {
                setAuthLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError(null);
        if (!email.trim() || !password.trim()) {
            setLoginError('Please enter your admin email and password.');
            return;
        }
        setSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Sign-in failed.';
            setLoginError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <p style={{ color: 'var(--text-secondary)' }}>Verifying admin session…</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <div className="sidebar-brand" style={{ borderBottom: 'none', padding: 0, marginBottom: 24 }}>
                        <div className="sidebar-brand-icon">📖</div>
                        <div>
                            <h1>Church Devotional CMS</h1>
                            <span>Pastoral & Editorial Administration</span>
                        </div>
                    </div>

                    <form onSubmit={handleSignIn}>
                        <div className="form-group">
                            <label>Admin Email</label>
                            <input
                                className="form-control"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="pastor@church.org"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Password</label>
                            <input
                                className="form-control"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        {loginError && (
                            <div className="alert-error" style={{ marginBottom: 16 }}>
                                {loginError}
                            </div>
                        )}
                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={submitting}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            {submitting ? 'Signing In…' : 'Sign In to CMS'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="auth-shell">
                <div className="auth-card">
                    <h2 style={{ marginBottom: 8 }}>Admin Authorization Required</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                        You are signed in as <strong>{user.email}</strong>, but your account does not
                        have an entry in the <code>admins</code> Firestore collection yet.
                    </p>
                    <div className="code-box" style={{ marginTop: 16, marginBottom: 20 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            CREATE DOCUMENT IN FIREBASE CONSOLE:
                        </div>
                        <code>admins/{user.uid}</code>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => window.location.reload()}
                        >
                            Recheck Access
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => void signOut(auth)}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <div className="app-layout">
                <aside className="sidebar">
                    <div className="sidebar-brand">
                        <div className="sidebar-brand-icon">📖</div>
                        <div>
                            <h1>Daily Devotional</h1>
                            <span>Editorial CMS</span>
                        </div>
                    </div>
                    <nav className="sidebar-nav">
                        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="icon">📊</span> Overview
                        </NavLink>
                        <NavLink to="/devotionals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="icon">✍️</span> Devotionals
                        </NavLink>
                        <NavLink to="/series" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="icon">📚</span> Series & Start Dates
                        </NavLink>
                        <NavLink to="/comments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="icon">💬</span> Community Moderation
                        </NavLink>
                        <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="icon">🔔</span> Announcements
                        </NavLink>
                    </nav>
                    <div className="sidebar-footer">
                        <div className="admin-user-pill">
                            <div className="admin-email" title={user.email || ''}>
                                {user.email}
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => void signOut(auth)}
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </aside>

                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/devotionals" element={<Devotionals />} />
                        <Route path="/series" element={<SeriesPage />} />
                        <Route path="/comments" element={<Comments />} />
                        <Route path="/notifications" element={<Notifications />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
