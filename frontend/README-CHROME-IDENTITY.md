# Chrome identity (no external login tools)

The extension uses Chrome’s built-in **identity** API to get the signed-in Chrome user’s name and email. No Firebase or other external auth is used in the extension.

## Setup: Google OAuth client ID

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select (or create) a project.
2. Go to **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
3. Application type: **Chrome extension**.
4. Enter your extension ID (from `chrome://extensions` when the extension is loaded, or leave blank and add the ID later under “Allowed app IDs”).
5. Create and copy the **Client ID** (e.g. `123456789-abc.apps.googleusercontent.com`).
6. In the extension’s **manifest.json**, replace `YOUR_GOOGLE_CLIENT_ID` in `oauth2.client_id` with your client ID:
   ```json
   "oauth2": {
     "client_id": "123456789-abc.apps.googleusercontent.com",
     "scopes": ["email", "profile", "openid"]
   }
   ```
7. Reload the extension.

## Flow

- **Popup:** On open, the extension calls `chrome.identity.getAuthToken({ interactive: false })`. If the user is already signed into Chrome with a Google account, it fetches name and email from Google’s userinfo API and shows them in the footer.
- **Sign in:** If not signed in, the user clicks “Sign in with Google”. The extension calls `getAuthToken({ interactive: true })`, Chrome shows the Google sign-in flow, and then the extension fetches and displays name/email.
- **Storage:** The extension stores `{ userId, displayName, email }` in `chrome.storage.local` under the key `illume_user`. `userId` is the user’s **email** so the backend can key MongoDB by it.

## Backend (MongoDB)

The backend already supports `userId` in:

- **Events** – `userId` on event documents.
- **Stats** – `scope=user` and `userId` query param.
- **Profile** – `userId` for money saved and scams detected.

When the extension (or dashboard) sends requests that should be attributed to a user, send `userId` (the same email stored in the extension). The backend does not implement login; it only uses the `userId` you send to separate data per user in MongoDB.
