(function () {
  'use strict';

  // Dashboard URL: use localhost in dev, replace with your deployed URL in production
  const DASHBOARD_URL = 'http://localhost:3000';

  const elements = {
    currentUrl: document.getElementById('current-url'),
    btnScan: document.getElementById('btn-scan'),
    btnDashboard: document.getElementById('btn-dashboard'),
    resultsSection: document.getElementById('results-section'),
    resultsList: document.getElementById('results-list'),
    resultsCount: document.getElementById('results-count'),
    emptyState: document.getElementById('empty-state'),
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

  function setScanLoading(loading) {
    elements.btnScan.disabled = loading;
    elements.btnScan.classList.toggle('loading', loading);
    elements.btnScan.textContent = loading ? 'Scanning…' : 'Scan this page';
  }

  function showEmptyState() {
    elements.emptyState.hidden = false;
    elements.resultsCount.textContent = '';
  }

  function showResults(items) {
    elements.emptyState.hidden = true;
    elements.resultsCount.textContent = items.length === 0
      ? 'No images'
      : `${items.length} image${items.length === 1 ? '' : 's'}`;

    elements.resultsList.querySelectorAll('.result-item').forEach((el) => el.remove());

    items.forEach((item) => {
      const div = document.createElement('div');
      div.className = `result-item ${item.isAi ? 'ai-detected' : 'human'}`;
      div.innerHTML = `
        <img class="result-thumb" src="${escapeHtml(item.src)}" alt="" />
        <div class="result-body">
          <div class="result-status">${item.isAi ? 'Likely AI-generated' : 'Likely human-made'}</div>
          <div class="result-src" title="${escapeHtml(item.src)}">${escapeHtml(shortSrc(item.src))}</div>
        </div>
      `;
      elements.resultsList.appendChild(div);
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function shortSrc(src) {
    if (!src || src.length <= 50) return src || '';
    return src.slice(0, 24) + '…' + src.slice(-20);
  }

  function onScanClick() {
    setScanLoading(true);
    // Backend not implemented yet — show empty results after a short delay
    setTimeout(() => {
      setScanLoading(false);
      showResults([]);
    }, 800);
  }

  elements.btnScan.addEventListener('click', onScanClick);

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
