'use strict';

(function () {
  var DASHBOARD_URL = 'http://localhost:3000';
  var AI_SCORE_CUTOFF = 10;
  var MEDIUM_THRESHOLD = 30; // show popup only when score >= 30 (medium or high)
  var warningDismissed = false;
  var lastAiRequestUrl = null;
  var lastAiRequestTime = 0;
  var AI_REQUEST_THROTTLE_MS = 15000; // only one AI image-detect request per URL per 15s
  var lastCheckedPageUrl = null; // only run check once per page (one product image per page)

  function getCombinedScore(baseScore, aiScore) {
    if (typeof baseScore !== 'number' && typeof aiScore !== 'number') return null;
    if (typeof baseScore !== 'number') return aiScore;
    if (typeof aiScore !== 'number') return baseScore;
    return Math.max(baseScore, aiScore);
  }

  function applyAiScoreCutoff(score) {
    if (typeof score !== 'number') return null;
    return score >= AI_SCORE_CUTOFF ? score : null;
  }

  function isMediumOrHigh(score) {
    return typeof score === 'number' && score >= MEDIUM_THRESHOLD;
  }

  function getRiskLevel(score) {
    if (score == null || score < 30) return 'low';
    if (score < 60) return 'medium';
    return 'high';
  }

  function getWarningColors(score) {
    var level = getRiskLevel(score);
    if (level === 'medium') {
      return {
        border: '#c4a574',
        bg: '#fdf8f0',
        accent: '#b8925c',
      };
    }
    return {
      border: '#d4a0a0',
      bg: '#fdf5f5',
      accent: '#c07878',
    };
  }

  function showWarningPopup(score) {
    if (document.getElementById('innovateher-risk-popup')) return;
    if (warningDismissed) return;

    var colors = getWarningColors(score);
    var host = document.createElement('div');
    host.id = 'innovateher-risk-popup';
    host.setAttribute(
      'style',
      'position:fixed!important;top:16px!important;right:16px!important;' +
        'z-index:2147483647!important;visibility:visible!important;display:block!important;'
    );

    var root = host.attachShadow({ mode: 'open' });

    var styles =
      '@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap");' +
      '.wrap{font-family:"Nunito",system-ui,sans-serif;width:400px;max-width:calc(100vw - 32px);' +
      'background:' + colors.bg + ';border:3px solid ' + colors.border + ';border-radius:20px;' +
      'box-shadow:0 10px 40px rgba(0,0,0,0.12);overflow:hidden;position:relative;}' +
      '.inner{padding:24px 56px 24px 24px;}' +
      '.btn-close{position:absolute;top:14px;right:14px;width:36px;height:36px;border:none;' +
      'background:rgba(0,0,0,0.06);border-radius:50%;color:#5c5c6a;font-size:22px;line-height:1;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,color .2s;}' +
      '.btn-close:hover{background:rgba(0,0,0,0.1);color:#424874;}' +
      '.warning-title{margin:0 0 12px 0;font-size:18px;font-weight:700;color:#424874;line-height:1.35;}' +
      '.warning-desc{margin:0;font-size:14px;color:#5c5c6a;line-height:1.5;}' +
      '.warning-desc .pct{font-weight:700;color:' + colors.accent + ';}' +
      '.warning-desc a{color:' + colors.accent + ';font-weight:600;text-decoration:none;}' +
      '.warning-desc a:hover{text-decoration:underline;}';

    root.innerHTML =
      '<style>' + styles + '</style>' +
      '<div class="wrap">' +
      '<button type="button" class="btn-close" id="btn-close" aria-label="Close">×</button>' +
      '<div class="inner">' +
      '<p class="warning-title">WARNING: This product may be AI generated</p>' +
      '<p class="warning-desc">This item is <span class="pct" id="warning-pct">' + (score != null ? score + '%' : '—') + '</span> likely to be AI. Proceed with caution. <a href="#" id="warning-learn">Learn more here</a>.</p>' +
      '</div></div>';

    var pctEl = root.getElementById('warning-pct');
    if (pctEl && typeof score === 'number') pctEl.textContent = score + '%';

    root.getElementById('btn-close').addEventListener('click', function (e) {
      e.preventDefault();
      warningDismissed = true;
      host.remove();
    });

    root.getElementById('warning-learn').addEventListener('click', function (e) {
      e.preventDefault();
      window.open(DASHBOARD_URL, '_blank');
    });

    document.documentElement.appendChild(host);
  }

  function tryShowWarningPopup() {
    if (document.getElementById('innovateher-risk-popup')) return;
    if (warningDismissed) return;

    var pageUrl = window.location.href;
    if (lastCheckedPageUrl === pageUrl) return; // already checked this page — one product image per page
    lastCheckedPageUrl = pageUrl;

    var state = { baseScore: null, baseReasons: null, aiScore: null, siteDone: false, aiDone: false };

    function maybeShow() {
      if (!state.siteDone || !state.aiDone) return;
      var combined = getCombinedScore(state.baseScore, state.aiScore);
      if (isMediumOrHigh(combined)) showWarningPopup(combined);
    }

    chrome.runtime.sendMessage(
      { type: 'GET_SITE_RISK', url: window.location.href },
      function (response) {
        if (chrome.runtime.lastError) {
          state.baseScore = null;
          state.baseReasons = null;
        } else if (response && response.error) {
          state.baseScore = null;
          state.baseReasons = null;
        } else if (response) {
          state.baseScore = response.riskScore;
          state.baseReasons = response.reasons || [];
        }
        state.siteDone = true;
        maybeShow();
      }
    );

    var currentUrl = window.location.href;
    var isCheckableUrl =
      typeof currentUrl === 'string' &&
      (currentUrl.indexOf('http://') === 0 || currentUrl.indexOf('https://') === 0);

    if (isCheckableUrl) {
      var now = Date.now();
      if (lastAiRequestUrl === currentUrl && now - lastAiRequestTime < AI_REQUEST_THROTTLE_MS) {
        state.aiScore = null;
        state.aiDone = true;
        maybeShow();
      } else {
        lastAiRequestUrl = currentUrl;
        lastAiRequestTime = now;
        chrome.runtime.sendMessage(
          { type: 'GET_AI_IMAGE_DETECT', url: currentUrl },
          function (response) {
            if (chrome.runtime.lastError) {
              state.aiScore = null;
            } else if (response && response.detection && typeof response.detection.finalScore === 'number') {
              state.aiScore = applyAiScoreCutoff(response.detection.finalScore);
              try {
                chrome.storage.local.get(['aiDetectionCache'], function (items) {
                  var cache = items.aiDetectionCache || {};
                  cache[currentUrl] = { detection: response.detection, image: response.image || null };
                  var keys = Object.keys(cache);
                  if (keys.length > 30) {
                    keys.sort();
                    for (var i = 0; i < keys.length - 30; i++) delete cache[keys[i]];
                  }
                  chrome.storage.local.set({ aiDetectionCache: cache });
                });
              } catch (e) {}
            } else {
              state.aiScore = null;
            }
            state.aiDone = true;
            maybeShow();
          }
        );
      }
    } else {
      state.aiScore = null;
      state.aiDone = true;
      maybeShow();
    }
  }

  function ensurePopup() {
    if (!document.documentElement) {
      document.addEventListener('DOMContentLoaded', ensurePopup);
      return;
    }
    tryShowWarningPopup();
    var observer = new MutationObserver(function () {
      if (!document.getElementById('innovateher-risk-popup') && !warningDismissed) {
        tryShowWarningPopup();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  ensurePopup();
})();
