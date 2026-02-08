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
    getOrCreateUserId().then(function (anonId) {
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
  }

  if (message.type === 'GET_PRODUCT_SUGGESTIONS') {
    if (!message.url) {
      sendResponse({ error: 'Missing url', suggestions: [] });
      return true;
    }
    fetch(BACKEND_URL + '/api/product-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: message.url }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            sendResponse({ error: data.error || 'Request failed', suggestions: [] });
            return;
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

  if (message.type === 'GET_AI_IMAGE_DETECT') {
    if (!message.url) {
      sendResponse({ error: 'Missing url' });
      return true;
    }
    fetch(BACKEND_URL + '/api/extract-product-image-detect', {
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
          sendResponse({ detection: data.detection || null, image: data.image || null });
        });
      })
      .catch(function () {
        sendResponse({ error: 'Backend unreachable' });
      });
    return true;
  }

  sendResponse({ error: 'Unknown message type' });
  return true;
});
