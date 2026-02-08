(function () {
  'use strict';

  const DASHBOARD_URL = 'http://localhost:3000';
  const AI_SCORE_CUTOFF = 10;

  const elements = {
    currentUrl: document.getElementById('current-url'),
    riskValue: document.getElementById('risk-value'),
    riskLabel: document.getElementById('risk-label'),
    riskReasons: document.getElementById('risk-reasons'),
    riskError: document.getElementById('risk-error'),
    aiSection: document.getElementById('ai-section'),
    aiStatus: document.getElementById('ai-status'),
    aiScore: document.getElementById('ai-score'),
    aiScoreValue: document.getElementById('ai-score-value'),
    aiError: document.getElementById('ai-error'),
    btnDashboard: document.getElementById('btn-dashboard'),
    linkSettings: document.getElementById('link-settings'),
    linkHelp: document.getElementById('link-help'),
  };

  let baseRiskScore = null;
  let baseReasons = [];
  let aiScore = null;

  function applyAiScoreCutoff(score) {
    if (typeof score !== 'number') return null;
    return score >= AI_SCORE_CUTOFF ? score : null;
  }

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

  function combineRiskScores(baseScore, imageScore) {
    if (typeof baseScore !== 'number' && typeof imageScore !== 'number') return null;
    if (typeof baseScore !== 'number') return imageScore;
    if (typeof imageScore !== 'number') return baseScore;
    return Math.max(baseScore, imageScore);
  }

  function updateRiskDisplay() {
    const combinedScore = combineRiskScores(baseRiskScore, aiScore);
    const reasons = baseReasons.slice();
    if (typeof aiScore === 'number') {
      reasons.push('AI image detection score: ' + aiScore);
    }
    setRiskResult({ riskScore: combinedScore, reasons: reasons });
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

  function setAiLoading() {
    if (elements.aiSection) elements.aiSection.hidden = false;
    if (elements.aiStatus) {
      elements.aiStatus.textContent = 'Scanning images…';
      elements.aiStatus.hidden = false;
    }
    if (elements.aiScore) elements.aiScore.hidden = true;
    if (elements.aiError) elements.aiError.hidden = true;
  }

  function getImageReason(imageInfo) {
    if (!imageInfo || !imageInfo.debug) return '';
    return imageInfo.debug.selectedReason || '';
  }

  function setAiResult(detection, imageInfo) {
    if (!elements.aiSection) return;
    elements.aiSection.hidden = false;

    if (!detection) {
      if (elements.aiStatus) {
        const reason = getImageReason(imageInfo);
        elements.aiStatus.textContent = reason
          ? `No suitable image found (${reason})`
          : 'No suitable image found';
        elements.aiStatus.hidden = false;
      }
      if (elements.aiScore) elements.aiScore.hidden = true;
      if (elements.aiError) elements.aiError.hidden = true;
      return;
    }

    if (detection.error) {
      if (elements.aiError) {
        elements.aiError.textContent = detection.error;
        elements.aiError.hidden = false;
      }
      if (elements.aiStatus) {
        elements.aiStatus.textContent = 'Image detection failed';
        elements.aiStatus.hidden = false;
      }
      if (elements.aiScore) elements.aiScore.hidden = true;
      return;
    }

    if (typeof detection.finalScore === 'number') {
      if (elements.aiStatus) {
        elements.aiStatus.textContent = 'AI likelihood score';
        elements.aiStatus.hidden = false;
      }
      if (elements.aiScoreValue) {
        elements.aiScoreValue.textContent = detection.finalScore + '%';
      }
      if (elements.aiScore) elements.aiScore.hidden = false;
      if (elements.aiError) elements.aiError.hidden = true;
      return;
    }

    if (elements.aiStatus) {
      elements.aiStatus.textContent =
        detection.status === 'PENDING'
          ? 'Still analyzing images…'
          : 'No definitive AI signal detected';
      elements.aiStatus.hidden = false;
    }
    if (elements.aiScore) elements.aiScore.hidden = true;
    if (elements.aiError) elements.aiError.hidden = true;
  }

  function setAiError(message) {
    if (elements.aiSection) elements.aiSection.hidden = false;
    if (elements.aiStatus) {
      elements.aiStatus.textContent = 'Image detection unavailable';
      elements.aiStatus.hidden = false;
    }
    if (elements.aiError) {
      elements.aiError.textContent = message;
      elements.aiError.hidden = false;
    }
    if (elements.aiScore) elements.aiScore.hidden = true;
  }

  function fetchSiteRisk(url) {
    setRiskLoading();
    chrome.runtime.sendMessage({ type: 'GET_SITE_RISK', url: url }, function (response) {
      if (chrome.runtime.lastError) {
        baseRiskScore = null;
        baseReasons = [];
        setRiskError('Backend unreachable');
        return;
      }
      if (response && response.error) {
        baseRiskScore = null;
        baseReasons = [];
        setRiskError(response.error);
        return;
      }
      if (response) {
        baseRiskScore = response.riskScore;
        baseReasons = response.reasons || [];
        updateRiskDisplay();
      } else {
        setRiskError('Request failed');
      }
    });
  }

  function fetchAiDetection(url) {
    setAiLoading();
    chrome.runtime.sendMessage({ type: 'GET_AI_IMAGE_DETECT', url: url }, function (response) {
      if (chrome.runtime.lastError) {
        setAiError('Backend unreachable');
        return;
      }
      if (response && response.error) {
        setAiError(response.error);
        return;
      }
      const imageInfo = response && response.image ? response.image : null;
      if (response && response.detection) {
        aiScore = applyAiScoreCutoff(response.detection.finalScore);
        setAiResult(response.detection, imageInfo);
        updateRiskDisplay();
      } else {
        aiScore = null;
        setAiResult(null, imageInfo);
        updateRiskDisplay();
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
          baseRiskScore = null;
          baseReasons = [];
          aiScore = null;
          fetchSiteRisk(tab.url);
          fetchAiDetection(tab.url);
        } else {
          setRiskUnavailable();
          if (elements.aiSection) elements.aiSection.hidden = true;
        }
      } else {
        elements.currentUrl.textContent = '—';
        setRiskUnavailable();
        if (elements.aiSection) elements.aiSection.hidden = true;
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
