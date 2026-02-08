# Fraud Detection Extension

Detect risky websites and AI-generated listings, then visualize real activity in the dashboard.

## Project structure

- `frontend/` - Chrome extension (popup UI, manifest, background scripts). The popup opens the dashboard.
- `dashboard/` - Next.js metrics dashboard (Recharts). Uses `/api/stats` and `/api/visited` proxies.
- `backend/` - Express + MongoDB (Atlas) API for scans, risk assessments, and metrics.

## Data flow (end to end)

1. Extension collects signals on product/checkout pages and calls `POST /api/score`.
2. Backend aggregates signals (existing scraper + 3rd-party checks + heuristics) and returns `{ riskScore, confidence, reasons[] }`.
3. Backend writes to MongoDB on cache misses:
   - `scanevents` (page activity)
   - `scans` (audit trail)
   - `riskassessments` (detailed risk output)
   - `siteriskcaches` (dashboard primary cache)
4. Dashboard calls `/api/stats` and `/api/visited` to show global vs user stats and live visited pages.

## System Contract

- **Canonical scoring endpoint**: `POST /api/score`
  - Input: `{ url, domain?, title?, price?, sellerText?, reviewSnippets?, checkoutText?, imageUrls?[], userId?, anonId? }`
  - Output: `{ riskScore (0-100), confidence (0-1), reasons[] }`
- **Cache-first**:
  - `siteriskcaches` is the primary cache.
  - If `(domain + urlHash)` is found and `checkedAt < 24h`, return cached result immediately.
  - Still append a `scanevents` record for every `/score` call.
  - Do not re-run scraping/detectors on cache hit.
- **Persistence on cache miss**:
  - `scanevents` (append-only, per request)
  - `scans` (audit trail per scan)
  - `riskassessments` (signals + score)
  - `siteriskcaches` (upsert latest result)
- **Scoping rules**:
  - Global stats = all users.
  - User stats = filter by `userId` OR `anonId` only.
  - Missing identifier for `scope=user` returns `400 { error: "missing_user_identifier" }`.

Important:
- No raw HTML is stored.
- No third-party console warnings are stored.
- URLs are normalized and hashed before storage (no raw paths).

## Collections (existing)

- `scanevents` - append-only page activity for metrics.
- `scans` - per-scan audit trail with risk score and reasons.
- `riskassessments` - detailed fraud output and signals.
- `siteriskcaches` - primary cache for dashboard data.
- `events` - user actions (ignored/left/reported/proceeded).
- `flagevents` - explicit flags for top domains/vendors.
- `reports` - community reports feeding domain reputation.
- `globaldomainreputations` - aggregated domain reputation.
- `scamintels` - shared scam signals (domains, vendors, image hashes).

## Metrics and definitions

- **Scams detected**: count of `riskassessments` where `riskScore >= RISK_HIGH_THRESHOLD` (default 80).
- **Scam websites visited**: distinct domains for a user where at least one `riskassessment` is high-risk.
- **Total high-risk visits**: count of `scanevents` for a user whose urlHash appears in a high-risk `riskassessment`.
- **Unique domains**:
  - Global: distinct `domain` from `siteriskcaches` by day.
  - User: distinct `domain` from `scans` by day.
- **Safe vs risky domain lists**:
  - Global lists come from latest per-domain `siteriskcaches`.
  - User lists come from latest per-domain `scans` filtered by `userId`/`anonId`.

## Simulated global series (dev only)

Simulated series is **global-only** and **opt-in**.

Enable simulated series with:
- `GET /api/stats?scope=global&days=31&simulated=1`, or
- `SIMULATED_GLOBAL_STATS=1` env var.

Default behavior is always real MongoDB-backed data.

## API quick checks

- Health: `curl http://127.0.0.1:4000/health`
- Score: `curl -X POST http://127.0.0.1:4000/api/score -H "Content-Type: application/json" -d '{"url":"https://example.com","anonId":"anon-123"}'`
- Stats (global): `curl "http://127.0.0.1:4000/api/stats?scope=global&days=31"`
- Stats (user): `curl "http://127.0.0.1:4000/api/stats?scope=user&days=31&anonId=anon-123"`
- Visited (user): `curl "http://127.0.0.1:4000/api/visited?userId=default&limit=50"`

## Testing checklist

- `POST /api/score` with `anonId` and a URL; confirm `{ riskScore, confidence, reasons }`.
- Repeat the same `/score` call and confirm cache hit (fast, no re-scrape).
- `GET /api/stats?scope=global` and `GET /api/stats?scope=user&anonId=...`; confirm user differs from global.
- Open dashboard; “My stats” loads without 400 and shows user-only data.
- Verify MongoDB writes: `scanevents`, `scans`, `riskassessments`, `siteriskcaches` increment on cache miss.

## Run locally

1. Backend: `npm -C backend run dev`
2. Dashboard: `npm -C dashboard run dev`
3. Open: `http://127.0.0.1:3000`

If Windows Defender or antivirus locks `dashboard/.next`, exclude the repo (or `dashboard/.next`) from scanning.
