'use strict';

const BACKEND_URL = 'http://localhost:4000';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GET_SITE_RISK' || !message.url) {
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
});
