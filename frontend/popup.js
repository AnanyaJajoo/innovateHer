(function () {
  'use strict';

  // Dashboard URL: use localhost in dev, replace with your deployed URL in production
  const DASHBOARD_URL = 'http://localhost:3000';

  const elements = {
    currentUrl: document.getElementById('current-url'),
    btnDashboard: document.getElementById('btn-dashboard'),
    linkSettings: document.getElementById('link-settings'),
    linkHelp: document.getElementById('link-help'),
  };

  function formatUrl(url) {
    if (!url || url === 'chrome://newtab/' || url.startsWith('chrome://')) {
      return 'Open a webpage to scan';
    }
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return url;
    }
  }

  function setCurrentTabUrl() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        elements.currentUrl.textContent = formatUrl(tab.url);
        elements.currentUrl.title = tab.url;
      } else {
        elements.currentUrl.textContent = '—';
      }
    });
  }

  elements.btnDashboard.href = DASHBOARD_URL;
  elements.btnDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: DASHBOARD_URL });
  });

  elements.linkSettings.addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: open options page
  });
  elements.linkHelp.addEventListener('click', (e) => {
    e.preventDefault();
    // TODO: open help
  });

  setCurrentTabUrl();
})();
