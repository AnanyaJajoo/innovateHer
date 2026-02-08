'use strict';

const BACKEND_URL = 'http://127.0.0.1:4000';
const USER_KEY = 'anonUserId';

function getOrCreateUserId() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([USER_KEY], (result) => {
        if (result && result[USER_KEY]) {
          resolve(result[USER_KEY]);
          return;
        }
        const fallback =
          (crypto && crypto.randomUUID && crypto.randomUUID()) ||
          `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const payload = {};
        payload[USER_KEY] = fallback;
        chrome.storage.local.set(payload, () => resolve(fallback));
      });
    } catch (err) {
      resolve(`anon-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GET_SITE_RISK' || !message.url) {
    sendResponse({ error: 'Missing url' });
    return true;
  }
  getOrCreateUserId().then(function (anonId) {
    // We intentionally ignore any third-party console warnings/errors on visited pages.
    // Only the explicit scan URL is logged and sent to the backend.
    console.log('[Scan] URL:', message.url, 'anonId:', anonId);
    fetch(BACKEND_URL + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: message.url, anonId: anonId, userId: 'default' }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            sendResponse({ error: data.error || 'Request failed' });
            return;
          }
          sendResponse({ riskScore: data.riskScore, reasons: data.reasons });
        });
      })
      .catch(function () {
        sendResponse({ error: 'Backend unreachable' });
      });
  });
  return true;
});
