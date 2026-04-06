# MoneyGuy 2.0 — Project Instructions

## What This Is
Personal household finance app with Telegram bot ingestion and a Vite+React web dashboard. Multi-user: each person has their own Telegram bot, their own data, their own view.

## Running
```bash
cd /Users/cake/dev/moneyguy-ai
npm run dev          # starts backend (port 3002) + frontend (port 5173) concurrently
```
Frontend accessible at http://localhost:5173 and http://100.90.81.105:5173 (Tailscale).

## Architecture

### Backend (Express + SQLite)
- **Entry**: `backend/index.js` — Express server, middleware, route registration, bot startup
- **Database**: `backend/db.js` — schema, migrations, seeds. SQLite via `better-sqlite3`. DB file: `backend/moneyguy.db`
- **Routes**: `backend/routes/` — transactions, accounts, budgets, categories, upload, export, ai, admin
- **Services**: `backend/services/` — telegramBot.js (multi-bot manager), ai.js (OpenRouter queries), parser.js (PDF/CSV/image parsing), categorizer.js (merchant rule matching)

### Frontend (Vite + React + TailwindCSS)
- **Entry**: `frontend/src/App.jsx` — tab-based SPA with user switcher in header
- **Pages**: `frontend/src/pages/` — Dashboard, Transactions, Accounts, Upload, AIChat, Trends, Review, Budgets, Categories, Settings
- **Components**: `frontend/src/components/` — TransactionTable, TransactionSummary, SearchBar, CategoryBadge, ErrorBoundary, ChartWidget
- **User Context**: `frontend/src/UserContext.jsx` — UserProvider, useUser hook, apiFetch helper

### Multi-User System
- `users` table: id, name, emoji, telegram_bot_token, telegram_user_id
- `user_id` column on: accounts, transactions, statements, budgets, audit_log
- Categories and merchant_rules are global (shared household)
- Frontend sends `X-User-Id` header on every API call via `apiFetch()`
- Backend middleware reads header, injects `req.userId` (defaults to 1)
- Telegram bot manager starts one polling instance per user with a bot token
- New bot auto-captures telegram_user_id on first message

### Users
| ID | Name  | Emoji | Bot Username        | Bot Token Prefix |
|----|-------|-------|---------------------|------------------|
| 1  | Me    | 💰    | @moneymaster8888_bot | 8725244577:AAG... |
| 2  | Wifey | 👩    | @themoneyguy_bot     | 8775743198:AAE... |

## Key Conventions
- **Amounts**: stored as INTEGER cents in DB. Frontend divides by 100 for display.
- **API calls in frontend**: always use `apiFetch()` from UserContext.jsx, never bare `fetch()`.
- **All DB queries**: must include `WHERE user_id = ?` (or `req.userId`) for user-scoped tables.
- **AI queries**: ai.js injects user_id into the system prompt so generated SQL filters by user.
- **No passwords/JWT**: household app, user switcher only. User ID stored in localStorage.

## Environment (.env)
```
OPENROUTER_API_KEY=sk-or-v1-...
PORT=3002
TELEGRAM_BOT_TOKEN=...        # User 1's bot (also seeded in DB)
TELEGRAM_AUTHORIZED_USER=...  # User 1's telegram ID
RESET_PIN=9999
```
Bot tokens are now primarily stored in the `users` DB table. Env vars are fallback for initial seed only.

## Database Migrations
All in `backend/db.js` `migrate()`. Uses CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN pattern. SQLite limitation: ALTER can't add foreign key constraints, so user_id columns use `INTEGER DEFAULT 1` without FK.

## Build
```bash
npm run build --workspace=frontend   # outputs to frontend/dist/
```
Backend serves frontend/dist/ in production mode.
