# Test Plan for InnovateHer Scam Detection

## Root Cause Analysis

### Issue 1: Stats 400 Error
**Root Cause**: Dashboard was reading `localStorage.getItem("anonUserId")` which was empty when opening dashboard directly (not from extension). Extension stores anonId in `chrome.storage.local`, not `localStorage`, so dashboard couldn't access it.

**Fix**: Dashboard now generates its own `anonUserId` in localStorage if not present, using same logic as extension.

### Issue 2: Image Detection Scoring (~20% vs ~90%)
**Root Cause**: The "original detector" is the **site-risk endpoint** using rule-based detection (riskRules.ts), which can score up to ~80-90 points. The AI image detector (RealityDefender) is a separate feature for detecting AI-generated images, not website scam risk.

**Important**:
- `/api/site-risk` = Original fraud detection (domain rules + Safe Browsing) → scores 0-100
- `/api/ai-image-detect` = AI-generated image detection (RealityDefender) → scores 0-100
- Extension uses `/api/site-risk` only

## Prerequisites

1. MongoDB running and accessible
2. Backend `.env` configured:
   ```
   MONGODB_URI=<your-mongo-uri>
   GOOGLE_SAFE_BROWSING_KEY=<your-key>
   REALITY_DEFENDER_API_KEY=<your-key>
   URL_HASH_SALT=<some-salt>
   HASH_SALT=<some-salt>
   ```

## Test Execution

### 1. Backend Health Check

```bash
# Start backend
cd backend
npm install
npm run dev

# Health check (in new terminal)
curl http://localhost:4000/health
# Expected: {"status":"ok","db":"connected"}
```

### 2. Site Risk Scan (Main Detection)

This is what the extension uses - rule-based fraud detection.

```bash
# Generate test anonId
ANON_ID="test-user-$(date +%s)"

# Scan a risky domain (should score ~40-60)
curl -X POST http://localhost:4000/api/site-risk \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"http://verify-account-login-crypto.xyz\",\"anonId\":\"$ANON_ID\"}"

# Expected response (example):
# {
#   "domain": "verify-account-login-crypto.xyz",
#   "normalizedUrl": "http://verify-account-login-crypto.xyz/",
#   "riskScore": 65,
#   "reasons": [
#     "Suspicious top-level domain",
#     "Site is not using HTTPS",
#     "URL contains high-risk keywords"
#   ],
#   "cached": false
# }

# Repeat same scan (should use cache)
curl -X POST http://localhost:4000/api/site-risk \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"http://verify-account-login-crypto.xyz\",\"anonId\":\"$ANON_ID\"}"

# Expected: Same response with "cached": true
```

### 3. Verify MongoDB Writes

```bash
# Connect to MongoDB and check collections
mongo <your-mongo-uri>

# Check writes
db.siteriskcaches.find({ domain: "verify-account-login-crypto.xyz" }).pretty()
# Should have 1 document with riskScore, reasons, checkedAt

db.scanevents.find({ domain: "verify-account-login-crypto.xyz" }).count()
# Should be 2 (one per scan, even cache hits)

db.scans.find({ domain: "verify-account-login-crypto.xyz" }).pretty()
# Should have 1 document with userId/anonId

db.riskassessments.find({ domain: "verify-account-login-crypto.xyz" }).count()
# Should be 1 (only created on cache miss)
```

### 4. Test Global Stats

```bash
# Global stats (no user filter required)
curl "http://localhost:4000/api/stats?scope=global&days=7"

# Expected response structure:
# {
#   "scope": "global",
#   "days": 7,
#   "stats": [ /* array of daily stats */ ],
#   "realSeries": [ /* same as stats */ ],
#   "debugSeries": [ /* debug data if in dev mode */ ],
#   "debugUsed": true/false
# }
```

### 5. Test User Stats

```bash
# User stats with anonId
curl "http://localhost:4000/api/stats?scope=user&anonId=$ANON_ID&days=7"

# Expected: 200 OK with filtered stats for this anonId

# User stats without identifier (should fail)
curl "http://localhost:4000/api/stats?scope=user&days=7"

# Expected: 400 Bad Request
# {
#   "error": "User scope requires either userId or anonId parameter"
# }
```

### 6. Test AI Image Detection (Separate Feature)

This is for detecting AI-generated images, not primary scam detection.

```bash
# Create test image file (or use existing)
# test-image.jpg

# Scan image
curl -X POST http://localhost:4000/api/ai-image-detect \
  -F "image=@test-image.jpg" \
  -F "anonId=$ANON_ID" \
  -F "domain=test.com"

# Expected response (example):
# {
#   "requestId": "...",
#   "status": "COMPLETE",
#   "finalScore": 15,  # 0-100, where high = likely AI-generated
#   "reasons": []
# }

# Note: Score depends on RealityDefender API analysis
# - Low score (0-30): Likely real/authentic image
# - High score (70-100): Likely AI-generated/manipulated
```

### 7. Dashboard Verification

```bash
# Start dashboard
cd dashboard
npm install
npm run dev

# Open browser to http://localhost:3000
```

**Steps:**
1. Open browser A (incognito)
2. Check DevTools → localStorage → should see `anonUserId` auto-generated
3. Note the anonId value (e.g., `anon-1234...`)
4. Click "Global" tab → should show data (or debug data in dev mode)
5. Click "My stats" tab → should load without 400 error
   - Will show empty if no scans for this anonId yet

6. Open browser B (different incognito window)
7. Should have different `anonUserId`
8. "My stats" should show different data (or empty)

9. Run some scans with specific anonIds via curl:
   ```bash
   USER_A="user-a-test"
   USER_B="user-b-test"

   # Scan 2 sites as User A
   curl -X POST http://localhost:4000/api/site-risk \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"http://test1.com\",\"anonId\":\"$USER_A\"}"

   curl -X POST http://localhost:4000/api/site-risk \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"http://test2.com\",\"anonId\":\"$USER_A\"}"

   # Scan 3 sites as User B
   curl -X POST http://localhost:4000/api/site-risk \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"http://test3.com\",\"anonId\":\"$USER_B\"}"

   curl -X POST http://localhost:4000/api/site-risk \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"http://test4.com\",\"anonId\":\"$USER_B\"}"

   curl -X POST http://localhost:4000/api/site-risk \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"http://test5.com\",\"anonId\":\"$USER_B\"}"
   ```

10. Manually set localStorage in browser A:
    ```javascript
    // In DevTools console
    localStorage.setItem('anonUserId', 'user-a-test')
    location.reload()
    ```

11. Check "My stats" → should show 2 scans

12. Manually set localStorage in browser B:
    ```javascript
    localStorage.setItem('anonUserId', 'user-b-test')
    location.reload()
    ```

13. Check "My stats" → should show 3 scans

14. Check "Global" in either browser → should show 5 total scans

## Expected MongoDB Collections

After tests, these collections should have data:

- `siteriskcaches` - Cached risk scores by domain/url
- `scanevents` - Individual scan events with timestamps
- `scans` - User audit trail of scans
- `riskassessments` - Detailed risk assessment records

These collections should remain empty unless specific features are used:
- `events` - User actions (flagging, reporting)
- `flagevents` - Flagged suspicious sites
- `reports` - User-submitted reports
- `globaldomainreputations` - Aggregate domain reputation
- `scamintels` - Scam intelligence data

## Cache Verification

```bash
# First scan (cache miss)
time curl -X POST http://localhost:4000/api/site-risk \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example-test.com","anonId":"cache-test"}'

# Response should have "cached": false

# Second scan (cache hit, should be faster)
time curl -X POST http://localhost:4000/api/site-risk \
  -H "Content-Type: application/json" \
  -d '{"url":"http://example-test.com","anonId":"cache-test"}'

# Response should have "cached": true
# Should be noticeably faster (no Safe Browsing API call)
```

## Success Criteria

✅ Backend health check returns 200
✅ Site risk scan returns score 0-100 with reasons
✅ Repeated scan returns cached result
✅ MongoDB has records in siteriskcaches, scanevents, scans, riskassessments
✅ Global stats returns 200 for all users
✅ User stats returns 200 with anonId/userId
✅ User stats returns 400 without identifier
✅ Dashboard generates anonId automatically
✅ Dashboard "My stats" loads without 400 error
✅ Different anonIds see different stats
✅ Global stats shows aggregate of all users
