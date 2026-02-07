(function () {
  'use strict';

  const DASHBOARD_URL = 'http://localhost:3000';
  const BACKEND_URL = 'http://localhost:4000';

  const elements = {
    currentUrl: document.getElementById('current-url'),
    riskValue: document.getElementById('risk-value'),
    riskLabel: document.getElementById('risk-label'),
    riskReasons: document.getElementById('risk-reasons'),
    riskError: document.getElementById('risk-error'),
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

  function isCheckableUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http://') || url.startsWith('https://');
  }

  function riskClass(score) {
    if (score == null) return '';
    if (score < 40) return 'low';
    if (score < 70) return 'medium';
    return 'high';
  }

  function riskLabel(score) {
    if (score == null) return '';
    if (score < 40) return 'Low risk';
    if (score < 70) return 'Medium risk';
    return 'High risk';
  }

  function setRiskLoading() {
    elements.riskValue.textContent = '…';
    elements.riskValue.className = 'risk-value';
    elements.riskLabel.textContent = '';
    elements.riskReasons.textContent = '';
    elements.riskReasons.hidden = true;
    elements.riskError.hidden = true;
  }

  function setRiskResult(data) {
    const score = data.riskScore;
    elements.riskValue.textContent = score != null ? String(score) : '—';
    elements.riskValue.className = 'risk-value ' + riskClass(score);
    elements.riskLabel.textContent = riskLabel(score);
    if (data.reasons && data.reasons.length) {
      elements.riskReasons.textContent = data.reasons.join(' · ');
      elements.riskReasons.hidden = false;
    } else {
      elements.riskReasons.textContent = '';
      elements.riskReasons.hidden = true;
    }
    elements.riskError.hidden = true;
  }

  function setRiskError(message) {
    elements.riskValue.textContent = '—';
    elements.riskValue.className = 'risk-value';
    elements.riskLabel.textContent = '';
    elements.riskReasons.textContent = '';
    elements.riskReasons.hidden = true;
    elements.riskError.textContent = message;
    elements.riskError.hidden = false;
  }

  function setRiskUnavailable() {
    elements.riskValue.textContent = '—';
    elements.riskValue.className = 'risk-value';
    elements.riskLabel.textContent = '';
    elements.riskReasons.textContent = 'Not a web page';
    elements.riskReasons.hidden = false;
    elements.riskError.hidden = true;
  }

  function fetchSiteRisk(url) {
    setRiskLoading();
    fetch(BACKEND_URL + '/api/site-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            setRiskError(data.error || 'Request failed');
            return;
          }
          setRiskResult(data);
        });
      })
      .catch(function () {
        setRiskError('Backend unreachable. Is it running on ' + BACKEND_URL + '?');
      });
  }

  function setCurrentTabUrlAndRisk() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs[0];
      if (tab?.url) {
        elements.currentUrl.textContent = formatUrl(tab.url);
        elements.currentUrl.title = tab.url;
        if (isCheckableUrl(tab.url)) {
          fetchSiteRisk(tab.url);
        } else {
          setRiskUnavailable();
        }
      } else {
        elements.currentUrl.textContent = '—';
        setRiskUnavailable();
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

  setCurrentTabUrlAndRisk();
})();
