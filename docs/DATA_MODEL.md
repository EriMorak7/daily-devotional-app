# Data Model (Firestore)

All user-facing "day" logic uses the **user's local calendar date** as a `YYYY-MM-DD`
string (never `toISOString()`), produced by `src/lib/date.ts#toLocalDateKey`.

## Public content

### `app_config/public`
| field | type | notes |
|---|---|---|
| activeSeriesId | string \| null | series used to compute "today" |
| churchName | string | shown in app header/auth screen |
| updatedAt | Timestamp | |

### `series/{seriesId}`
| field | type | notes |
|---|---|---|
| title | string | |
| description | string | |
| startDate | `YYYY-MM-DD` | **Day 1** of the series, in the church's calendar |
| totalDays | number \| null | optional cap |
| status | `draft` \| `active` \| `archived` | drafts are admin-only |
| coverImage | string \| null | URL |
| createdAt / updatedAt | Timestamp | |

Today's day number = `daysBetween(series.startDate, localToday) + 1`.

### `devotionals/{devotionalId}`
| field | type | notes |
|---|---|---|
| seriesId | string \| null | |
| dayNumber | number | 1-based within series |
| date | `YYYY-MM-DD` | = series.startDate + (dayNumber − 1); admin auto-fills |
| title | string | |
| scriptureReference | string | e.g. "Lamentations 3:22-23" |
| scriptureText | string | |
| body | string | paragraphs separated by a blank line |
| prayer | string | |
| reflectionPrompt | string | e.g. "What is God teaching you today?" |
| author | string | |
| tags | string[] | |
| coverImage | string \| null | URL |
| audioUrl | string \| null | URL to an mp3/m4a; app falls back to text-to-speech |
| status | `draft` \| `published` \| `archived` | **only `published` is readable by users** |
| published | boolean | mirror of `status == 'published'` |
| publishedAt | Timestamp \| null | |
| createdAt / updatedAt | Timestamp | |

"Scheduled" = `status: published` with a future `date`. The app never shows a
devotional whose `date` is after the user's local today.

Legacy fields (`day`, `scripture`, free-text `date`) are tolerated by the app's
normaliser and can be upgraded from the admin dashboard.

### `devotionals/{id}/comments/{commentId}` — community reflections
| field | type | notes |
|---|---|---|
| devotionalId | string | must equal parent id |
| authorId | string | must equal `request.auth.uid` |
| authorName | string | |
| authorPhoto | string \| null | |
| parentId | string \| null | null = top-level reflection; otherwise id of a top-level comment |
| content | string | 1–1000 chars |
| reactions | `{ amen: uid[], heart: uid[], fire: uid[] }` | a user may only add/remove their own uid |
| status | `visible` \| `hidden` | `hidden` set by admins |
| edited | boolean | |
| createdAt / updatedAt | Timestamp (server) | |

### `devotionals/{id}/completions/{uid}` — church-wide activity
`{ uid, completedAt }` — create-only by that user; counted with an aggregation
query ("23 people completed today's devotional"). No personal content.

### `reports/{reportId}`
`{ commentId, devotionalId, reporterId, reason, status: 'open'|'resolved', createdAt }`
— create by any signed-in user, read/update by admins.

### `announcements/{id}` (admin only)
`{ title, body, status: 'draft'|'queued', createdBy, createdAt }`. Delivering
push notifications requires a server (Cloud Function + Expo Push API).

## Private user data — `users/{uid}`
| field | type |
|---|---|
| displayName, email, photoURL | string |
| timezone | IANA string (e.g. `Africa/Lagos`) |
| progress | `{ currentStreak, longestStreak, totalCompleted, lastCompletedDate }` |
| notificationPrefs | `{ dailyDevotional, streakReminder, newDevotional, replies, community, reminderTime: 'HH:MM' }` |
| createdAt / updatedAt | Timestamp |

Sub-collections (owner read/write only):
- `completions/{YYYY-MM-DD}` — `{ date, devotionalId, devotionalTitle, scriptureReference, completedAt, timezone }`. **Doc id = local date → idempotent**, so a second device or a double tap cannot double-count. Streak increments happen inside a transaction.
- `notes/{noteId}` — journal entries `{ devotionalId, devotionalTitle, scriptureReference, devotionalDate, dayNumber, kind: 'reflection'|'note', content, highlightText, createdAt, updatedAt }`. The daily reflection uses id `reflection_<devotionalId>`.
- `highlights/{id}` — `{ devotionalId, devotionalTitle, section: 'scripture'|'body'|'prayer', paragraphIndex, text, color, createdAt }`.
- `bookmarks/{devotionalId}` — `{ devotionalId, title, scriptureReference, date, createdAt }`.
- `devices/{id}` — push token registration `{ token, platform, updatedAt }`.

## Admins — `admins/{uid}`
Existence of this document grants admin rights. It **cannot be written by any
client** (rules: `write: if false`); create it in the Firebase console or with the
Admin SDK. A custom claim `admin: true` is also accepted.

## Guests
Guests have no Firebase account. Their data lives in AsyncStorage under a random
local id (`guest_<random>`). On sign-in/sign-up the app migrates guest notes,
highlights, bookmarks and completions into `users/{uid}` and recomputes the streak
from the union of completion dates.
