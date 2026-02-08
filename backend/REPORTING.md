# Community Reporting & Reputation - Backend

This document describes the new community reporting and domain reputation features added to the backend.

Environment
- `MONGODB_URI` (required) - connection string for MongoDB
- `HASH_SALT` or `URL_HASH_SALT` (recommended) - server salt used when hashing URLs for scan logs
- `NODE_ENV` - production vs development. In development, endpoints accept `x-dev-user-id` header or `userId` in request body as auth fallback.
- `RISK_HIGH_THRESHOLD` - high-risk threshold (default 80)
- `DEFAULT_AVG_ORDER_VALUE` - fallback price for protected dollars (default 75)
- `PROTECTION_FACTOR_CRITICAL` - risk >= 90 (default 0.8)
- `PROTECTION_FACTOR_HIGH` - risk 80-89 (default 0.5)
- `PROTECTION_FACTOR_ELEVATED` - risk 70-79 (default 0.2)

Collections
- `Report` - community reports (domain, userId, reportType, category, title, body, publishStatus)
- `GlobalDomainReputation` - aggregated reputation metrics per domain
- `Scan` - logged scans (stores salted URL hash, domain, score, confidence, reasons)
- `Event` - optional telemetry with TTL (expiresAt)
- `ScanEvent` - per scan metrics event (risk tier + protected dollars)
- `RiskAssessment` - risk score + confidence + signals
- `FlagEvent` - user flags (reports or reported action)
- `ScamIntel` - scam indicators repository

New/Updated Endpoints (mounted under `/api`)
- POST `/api/report` - create a report. Requires auth in production.
  - Body: `{ domain, reportType: "scam" | "bad_experience" | "false_positive", category?, title, body, userId?, anonId?, vendorId?, vendorName? }`
  - Returns: `{ ok, stored, reportId, reputation }`

- GET `/api/domain-reputation/:domain` - fetch domain reputation
  - Returns: `{ domain, totalReports, scamReports, falsePositiveReports, aggregateRiskScore, confidence }`

- GET `/api/reports/:domain` - fetch reports for a domain
  - Returns: `{ reports: [...] }`

- POST `/api/site-risk` - logs `ScanEvent`, `Scan`, updates `SiteRiskCache`, and writes `RiskAssessment` when analysis ran.
  - Response shape preserved.

- POST `/api/event` - optional telemetry endpoint. Requires auth in production. Stores event with `expiresAt` (30 days).

- GET `/api/metrics/summary` - global metrics summary
- GET `/api/metrics/users/:userId/summary` - per-user metrics summary
- GET `/api/metrics/users/:userId/improvement` - weekly improvement series
- GET `/api/metrics/top-domains` - top flagged domains
- GET `/api/metrics/top-vendors` - top flagged vendors
- GET `/api/stats` - daily stats used by the dashboard

Utilities
- `normalizeDomain(domainOrUrl)` - trim, lowercase, strip leading `www.`, accepts a full URL too
- `urlHash(value)` - SHA256 hex digest
- `hashWithSalt(value, salt)` - SHA256 hex digest with a server-side salt (used for path hashing)

Testing & Quick Checks
1. Ensure MongoDB is available and `MONGODB_URI` is set.
2. Set `URL_HASH_SALT` (recommended).
3. From repository root run:

```bash
cd backend
npm install
npm run build
```

4. Start server in development (example, uses ts-node-dev):

```bash
cd backend
npm run dev
```

5. Example curl commands (development with `x-dev-user-id`):

Create a report:
```bash
curl -X POST http://localhost:4000/api/report \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: dev123" \
  -d '{"domain":"example.com","reportType":"scam","category":"phishing","title":"Phishy login","body":"Collected creds"}'
```

Get domain view:
```bash
curl http://localhost:4000/api/domain-reputation/example.com
```

Score an URL (existing endpoint):
```bash
curl -X POST http://localhost:4000/api/site-risk \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example.com/login","forceRefresh":true,"anonId":"anon-1"}'
```

Post telemetry event:
```bash
curl -X POST http://localhost:4000/api/event \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: dev123" \
  -d '{"anonId":"anon-1","domain":"example.com","riskScoreBucket":"70-79","actionTaken":"left"}'
```

Notes
- The system never stores raw full URLs in MongoDB. Only hashed URL paths are stored for scan logs.
- Third-party console warnings/errors are ignored and never stored.
- Reputation recomputation is safe to call frequently and is invoked asynchronously when reports are created.
