'use strict';

const BACKEND_URL = 'http://localhost:4000';

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
  return true;
});
