# AI Image Detector — Chrome Extension

Detect if images on the current webpage are AI-generated.

## Project structure

- **frontend/** — Chrome extension (popup UI, manifest, scripts)
- **backend/** — Reserved for future API / detection logic

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

## Next steps

- Implement backend (e.g. API or local model) for AI-image detection
- Add a content script to collect images from the page and send them for analysis
- Connect the popup “Scan this page” button to the backend and display results in the results list
