(function () {
  'use strict';

  const DASHBOARD_URL = 'http://localhost:3000';

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
    return url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
  }

  function riskLabel(score) {
    if (score == null) return '';
    if (score < 30) return 'Low risk';
    if (score < 60) return 'Medium risk';
    return 'High risk';
  }

  function riskClass(score) {
    if (score == null) return '';
    if (score < 30) return 'low';
    if (score < 60) return 'medium';
    return 'high';
  }

  function setRiskLoading() {
    if (elements.riskValue) elements.riskValue.textContent = '…';
    if (elements.riskValue) elements.riskValue.className = 'risk-value';
    if (elements.riskLabel) elements.riskLabel.textContent = '';
    if (elements.riskReasons) {
      elements.riskReasons.textContent = '';
      elements.riskReasons.hidden = true;
    }
    if (elements.riskError) elements.riskError.hidden = true;
  }

  function setRiskResult(data) {
    const score = data.riskScore;
    if (elements.riskValue) {
      elements.riskValue.textContent = score != null ? String(score) : '—';
      elements.riskValue.className = 'risk-value ' + riskClass(score);
    }
    if (elements.riskLabel) elements.riskLabel.textContent = riskLabel(score);
    if (elements.riskReasons) {
      if (data.reasons && data.reasons.length) {
        elements.riskReasons.textContent = data.reasons.join(' · ');
        elements.riskReasons.hidden = false;
      } else {
        elements.riskReasons.textContent = '';
        elements.riskReasons.hidden = true;
      }
    }
    if (elements.riskError) elements.riskError.hidden = true;
  }

  function setRiskError(message) {
    if (elements.riskValue) {
      elements.riskValue.textContent = '—';
      elements.riskValue.className = 'risk-value';
    }
    if (elements.riskLabel) elements.riskLabel.textContent = '';
    if (elements.riskReasons) {
      elements.riskReasons.textContent = '';
      elements.riskReasons.hidden = true;
    }
    if (elements.riskError) {
      elements.riskError.textContent = message;
      elements.riskError.hidden = false;
    }
  }

  function setRiskUnavailable() {
    if (elements.riskValue) elements.riskValue.textContent = '—';
    if (elements.riskValue) elements.riskValue.className = 'risk-value';
    if (elements.riskLabel) elements.riskLabel.textContent = '';
    if (elements.riskReasons) {
      elements.riskReasons.textContent = 'Not a web page';
      elements.riskReasons.hidden = false;
    }
    if (elements.riskError) elements.riskError.hidden = true;
  }

  function fetchSiteRisk(url) {
    setRiskLoading();
    chrome.runtime.sendMessage({ type: 'GET_SITE_RISK', url: url }, function (response) {
      if (chrome.runtime.lastError) {
        setRiskError('Backend unreachable');
        return;
      }
      if (response && response.error) {
        setRiskError(response.error);
        return;
      }
      if (response) {
        setRiskResult({ riskScore: response.riskScore, reasons: response.reasons });
      } else {
        setRiskError('Request failed');
      }
    });
  }

  function setCurrentTabUrlAndRisk() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
  });
  elements.linkHelp.addEventListener('click', (e) => {
    e.preventDefault();
  });

  setCurrentTabUrlAndRisk();
})();
