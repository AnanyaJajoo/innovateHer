# Community Reporting & Reputation - Backend

This document describes the new community reporting and domain reputation features added to the backend.

Environment
- `MONGODB_URI` (required) - connection string for MongoDB
- `URL_HASH_SALT` (recommended) - server salt used when hashing URLs for scan logs
- `NODE_ENV` - production vs development. In development, endpoints accept `x-dev-user-id` header or `userId` in request body as auth fallback.

New Models
- `Report` - community reports (domain, userId, type, category, title, body, status)
- `GlobalDomainReputation` - aggregated reputation metrics per domain
- `Scan` - logged scans (stores salted URL hash, domain, score, confidence, reasons)
- `Event` - optional telemetry with TTL (expiresAt)

New/Updated Endpoints (mounted under `/api`)
- POST `/api/reports` - create a report. Requires auth in production.
  - Body: `{ domain, type: "scam" | "bad_experience" | "false_positive", category?, title, body }`
  - Returns: `{ reportId }`

- GET `/api/domains/:domain` - fetch domain reputation and recent posts
  - Returns: `{ domain, reputation: GlobalDomainReputation|null, posts: [...] }`

- POST `/api/site-risk` - existing endpoint now integrates community reputation non-breakingly:
  - Behaviors added: consults cached reputation or recomputes it, may add reason codes `COMMUNITY_REPORTED_SCAM` or `DOMAIN_UNKNOWN`, modestly adjusts `riskScore` and `confidence`, and logs a `Scan` document (does not store raw URL).
  - Response shape preserved; an optional `communityReputation` field may be added.

- POST `/api/events` - optional telemetry endpoint. Requires auth in production. Stores event with `expiresAt` (30 days) and returns `204`.

Utilities
- `normalizeDomain(domainOrUrl)` - trim, lowercase, strip leading `www.`, accepts a full URL too
- `urlHash(value)` - salted SHA256 hex digest using `URL_HASH_SALT`

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
curl -X POST http://localhost:4000/api/reports \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: dev123" \
  -d '{"domain":"example.com","type":"scam","category":"phishing","title":"Phishy login","body":"Collected creds"}'
```

Get domain view:
```bash
curl http://localhost:4000/api/domains/example.com
```

Score an URL (existing endpoint):
```bash
curl -X POST http://localhost:4000/api/site-risk \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example.com/login","forceRefresh":true,"anonId":"anon-1"}'
```

Post telemetry event:
```bash
curl -X POST http://localhost:4000/api/events \
  -H "Content-Type: application/json" \
  -H "x-dev-user-id: dev123" \
  -d '{"anonId":"anon-1","domain":"example.com","riskScoreBucket":"70-79","actionTaken":"left"}'
```

Notes
- The system never stores raw full URLs in MongoDB. Only salted URL hashes are stored for scan logs.
- Reputation recomputation is safe to call frequently and is invoked asynchronously when reports are created.
