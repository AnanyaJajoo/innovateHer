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
  if (message.type === 'GET_SITE_RISK') {
    if (!message.url) {
      sendResponse({ error: 'Missing url' });
      return true;
    }
    fetch(BACKEND_URL + '/api/site-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: message.url }),
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
    return true;
  }
<<<<<<< HEAD
  getOrCreateUserId().then(function (anonId) {
    // We intentionally ignore any third-party console warnings/errors on visited pages.
    // Only the explicit scan URL is logged and sent to the backend.
    console.log('[Scan] URL:', message.url, 'anonId:', anonId);
    fetch(BACKEND_URL + '/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: message.url, anonId: anonId, userId: 'default' }),
=======

  if (message.type === 'GET_PRODUCT_SUGGESTIONS') {
    if (!message.url) {
      sendResponse({ error: 'Missing url', suggestions: [] });
      return true;
    }
    fetch(BACKEND_URL + '/api/product-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: message.url }),
>>>>>>> origin/main
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
<<<<<<< HEAD
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
=======
            sendResponse({ error: data.error || 'Request failed', suggestions: [] });
            return;
          }
          if (data.productName) {
            console.log('[InnovateHer] Product name found:', data.productName);
          } else {
            console.log('[InnovateHer] No product name found for URL:', message.url);
          }
          sendResponse({
            productName: data.productName,
            suggestions: data.suggestions || [],
          });
        });
      })
      .catch(function () {
        sendResponse({ error: 'Backend unreachable', suggestions: [] });
      });
    return true;
  }

  sendResponse({ error: 'Unknown message type' });
>>>>>>> origin/main
  return true;
});
