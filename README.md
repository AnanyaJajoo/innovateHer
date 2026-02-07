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

- **Extension**: Click **Open Dashboard** in the popup to open the dashboard in a new tab (default: `http://localhost:3000`).
- **Dashboard**: Next.js app with Recharts — daily events, actions (ignored/left/reported), risk score bins, global vs my stats. User id from `localStorage` for “My stats”.
- **Event log** (for when extension sends data): `{ timestamp, domain, riskScore, category, price?, actionTaken }`. POST to `/api/events`. Privacy: store hashed URL paths; keep only domain + score bins.
- **Run dashboard**: `cd dashboard && npm run dev`, then open http://localhost:3000.

## Next steps

- Implement backend (e.g. API or local model) for AI-image detection
- Add a content script to collect images from the page and send them for analysis
- Connect the popup “Scan this page” button to the backend and display results in the results list
- Send event logs from extension to `POST /api/events` after each scan; replace in-memory aggregation with MongoDB pipelines
