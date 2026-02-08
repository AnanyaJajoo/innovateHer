# Illume (innovateHer)

Detect risky websites and AI-generated listings, then visualize activity in the dashboard. Chrome extension + Next.js dashboard + Express/MongoDB backend.

## Project structure

| Folder       | Description |
|-------------|-------------|
| **frontend/** | Chrome extension (Illume): popup UI, content script in-page widget, background service worker. Uses Chrome identity for Google sign-in; popup opens the dashboard with user params. |
| **dashboard/** | Next.js app (Recharts): stats charts, global vs user scope, visited sites. Proxies `/api/stats`, `/api/visited`, `/api/events`, and backend health/site-risk. User identity from URL params (when opened from extension) or from session/localStorage. |
| **backend/**   | Express + MongoDB API: scoring, risk assessments, scans, metrics, stats, visited, events. |

## Run locally

1. **Backend** (default port 4000):
   ```bash
   npm -C backend run dev
   ```
2. **Dashboard** (default port 3000):
   ```bash
   npm -C dashboard run dev
   ```
3. Open **dashboard**: [http://localhost:3000](http://localhost:3000)
4. **Load the extension**: Chrome → `chrome://extensions` → “Load unpacked” → select the `frontend/` folder.  
   For “Sign in with Google” in the popup, configure a Google OAuth client ID (Chrome app type) and set it in `frontend/manifest.json` → see [frontend/README-CHROME-IDENTITY.md](frontend/README-CHROME-IDENTITY.md).

If Windows Defender or antivirus locks `dashboard/.next`, exclude the repo (or `dashboard/.next`) from scanning.

## Extension → dashboard user flow

- **Sign in (extension):** In the popup, click “Sign in with Google”. The extension uses Chrome’s `identity` API and stores `{ userId, displayName, email }` in `chrome.storage.local` (key: `illume_user`). `userId` is the user’s email.
- **Open Dashboard:** Click “Open Dashboard” in the popup. The extension opens the dashboard URL with query params `?userId=...&displayName=...` when a user is stored, so the footer shows the Google username instead of “Guest”.
- **Dashboard identity:** The dashboard reads `userId` and `displayName` from the URL (or from sessionStorage/localStorage). It uses `userId` for user-scoped stats and shows `displayName` in the footer. For users who open the dashboard without signing in via the extension, an anonymous ID (`anonId`) is used for user-scope when provided.

## Data flow (end to end)

1. Extension collects signals on product/checkout pages and calls `POST /api/score` (or uses the site-risk endpoint for the current tab).
2. Backend aggregates signals (scraper + 3rd-party checks + heuristics) and returns `{ riskScore, confidence, reasons[] }`.
3. On cache miss, backend writes to MongoDB: `scanevents`, `scans`, `riskassessments`, `siteriskcaches`.
4. Dashboard calls `/api/stats` and `/api/visited` (and optionally `/api/events`) to show global vs user stats and visited pages.

## System contract

- **Canonical scoring endpoint**: `POST /api/score`
  - Input: `{ url, domain?, title?, price?, sellerText?, reviewSnippets?, checkoutText?, imageUrls?[], userId?, anonId? }`
  - Output: `{ riskScore (0-100), confidence (0-1), reasons[] }`
- **Cache-first**: `siteriskcaches` is the primary cache. If `(domain + urlHash)` is found and `checkedAt < 24h`, return cached result and still append a `scanevents` record. Do not re-run scraping/detectors on cache hit.
- **Persistence on cache miss**: `scanevents`, `scans`, `riskassessments`, `siteriskcaches`.
- **Scoping**: Global stats = all users. User stats = filter by `userId` OR `anonId`. Missing identifier for `scope=user` returns `400 { error: "missing_user_identifier" }`.

No raw HTML or third-party console warnings are stored; URLs are normalized and hashed.

## Collections

- `scanevents` – append-only page activity for metrics
- `scans` – per-scan audit trail
- `riskassessments` – detailed fraud output and signals
- `siteriskcaches` – primary cache for dashboard data
- `events` – user actions (ignored/left/reported/proceeded)
- `flagevents`, `reports`, `globaldomainreputations`, `scamintels` – flags, reports, reputation, scam intel

## Metrics

- **Scams detected**: count of high-risk `riskassessments` (e.g. riskScore ≥ 80).
- **Scam websites visited**: distinct domains for a user with at least one high-risk assessment.
- **User vs global**: stats support `scope=user` (with `userId` or `anonId`) and `scope=global`.

## API quick checks

- Health: `curl http://127.0.0.1:4000/health`
- Score: `curl -X POST http://127.0.0.1:4000/api/score -H "Content-Type: application/json" -d '{"url":"https://example.com","anonId":"anon-123"}'`
- Stats (global): `curl "http://127.0.0.1:4000/api/stats?scope=global&days=31"`
- Stats (user): `curl "http://127.0.0.1:4000/api/stats?scope=user&days=31&anonId=anon-123"`
- Visited: `curl "http://127.0.0.1:4000/api/visited?userId=default&limit=50"`

## Simulated global series (dev only)

- `GET /api/stats?scope=global&days=31&simulated=1` or set `SIMULATED_GLOBAL_STATS=1`. Default is real MongoDB-backed data.

## Testing checklist

- `POST /api/score` with `anonId` and a URL; confirm `{ riskScore, confidence, reasons }`; repeat and confirm cache hit.
- `GET /api/stats?scope=global` and `GET /api/stats?scope=user&anonId=...`; confirm user differs from global.
- Open dashboard from extension after signing in; footer shows Google username; “My stats” loads without 400.
- Verify MongoDB: `scanevents`, `scans`, `riskassessments`, `siteriskcaches` increment on cache miss.
