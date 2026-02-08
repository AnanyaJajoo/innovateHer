# AI Image Detector — Chrome Extension

Detect if images on the current webpage are AI-generated.

## Project structure

- **frontend/** — Chrome extension (popup UI, manifest, scripts). **Open Dashboard** opens the metrics dashboard.
- **dashboard/** — Next.js metrics dashboard (Recharts, event stats, local storage for user id).
- **backend/** — Reserved for detection API; dashboard uses in-memory aggregation (replace with MongoDB later).

## Load the extension (Chrome)

1. Open `chrome://extensions/`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the **frontend** folder

Click the extension icon in the toolbar to open the popup.

## Frontend (current)

- **Popup UI**: Dark theme with “Scan this page” and a results area
- **Current page**: Shows the active tab’s URL
- **Scan**: Button is wired in the UI; backend integration is not implemented yet

## Metrics dashboard

- **Extension**: Click **Open Dashboard** in the popup to open the dashboard in a new tab (default: `http://127.0.0.1:3000`).
- **Dashboard**: Next.js app with Recharts — daily events, actions (ignored/left/reported), risk score bins, global vs my stats. User id from `localStorage` for “My stats”.
- **Backend stats**: `/api/stats` is proxied to the backend and reads MongoDB (`scans`, `events`, `riskassessments`, `siteriskcaches`).
- **Live visited pages**: `/api/visited` shows the last 50 pages for the current user from `scanevents` (enriched by `riskassessments` and `siteriskcaches`).
- **Run dashboard**: `cd dashboard && npm run dev`, then open http://127.0.0.1:3000.

## Dev debug series

In development, the backend `/api/stats` response includes:
- `realSeries` (from MongoDB)
- `debugSeries` (synthetic 2000+ points) when real data is sparse or `?debugSeed=1` is set

Disable debug series by using `NODE_ENV=production` or by ensuring real data spans at least 10 active days.

## Product image extraction API

- **Endpoint**: `POST /api/extract-product-image`
- **Example**:
  `curl -X POST http://localhost:4000/api/extract-product-image -H "Content-Type: application/json" -d '{"url":"https://www.amazon.com/dp/B0C0Z3QG4Y"}'`

## Next steps

- Implement backend (e.g. API or local model) for AI-image detection
- Add a content script to collect images from the page and send them for analysis
- Connect the popup “Scan this page” button to the backend and display results in the results list
- Send event logs from extension to `POST /api/events` after each scan; replace in-memory aggregation with MongoDB pipelines
