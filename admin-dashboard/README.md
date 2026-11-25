# Church Daily Devotional — Admin Dashboard CMS

A React + TypeScript + Vite editorial CMS connected to Firebase Auth, Firestore, and Storage.

## Features
- **Authenticated Admin Gate**: Requires Firebase Auth sign-in plus server-verified authorization via `admins/{uid}` document or custom claim `admin == true`.
- **Series & Explicit Start Dates**: Manage devotional series with explicit `startDate` (`YYYY-MM-DD`) so the mobile app calculates the exact day number from Day 1.
- **Devotionals CMS**: Create, edit, duplicate, preview, publish, unpublish, archive, schedule, delete, search, filter, and paginate devotionals without touching source code.
- **Audio & Cover Media**: Paste direct URLs or upload audio/cover files to Firebase Storage (`devotional-media/...`).
- **Community Moderation**: Review member reflections, hide/unhide comments, and resolve member reports.

## Commands

```bash
cd admin-dashboard
npm install
npm run dev
```

To typecheck and build for production:

```bash
npm run build
npm run lint
```

## Granting Admin Access

1. Sign in once on the Admin Dashboard login screen (or create the user in Firebase Console -> Authentication).
2. Copy the user's UID (displayed on the "Admin Authorization Required" screen).
3. In Firebase Console -> Firestore Database, create a document at:
   `admins/{uid}` with `{ "role": "admin" }`.
4. Reload the dashboard.
