'use strict';

(function () {
  var DASHBOARD_URL = 'http://localhost:3000';

  function getColor(score) {
    if (score == null) return '#6b7280';
    if (score < 30) return '#059669';
    if (score < 60) return '#ca8a04';
    return '#dc2626';
  }

  function riskLabel(score) {
    if (score == null) return '';
    if (score < 30) return 'Low risk';
    if (score < 60) return 'Medium risk';
    return 'High risk';
  }

  function riskValueClass(score) {
    if (score == null) return '';
    if (score < 30) return 'low';
    if (score < 60) return 'medium';
    return 'high';
  }

  function formatUrl(url) {
    if (!url) return '—';
    try {
      var u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return url;
    }
  }

  var expandedStyles =
    '.panel{display:none;width:320px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);border:1px solid #e5e5e7;overflow:hidden;font-family:system-ui,sans-serif;font-size:14px;color:#1d1d1f;}' +
    '.panel.open{display:block;}' +
    '.panel-inner{padding:16px;}' +
    '.header{margin-bottom:12px;}.title{font-size:16px;font-weight:600;margin:0;}.tagline{font-size:12px;color:#6e6e73;margin:4px 0 0;}' +
    '.section{margin-top:12px;}.section .label{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6e6e73;margin-bottom:4px;}' +
    '.current-page{background:#f5f5f7;border:1px solid #e5e5e7;border-radius:8px;padding:10px 12px;}.current-page .url{font-size:12px;margin:0;word-break:break-all;max-height:2.6em;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}' +
    '.risk-section{background:#f5f5f7;border:1px solid #e5e5e7;border-radius:8px;padding:10px 12px;}' +
    '.risk-display{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin-top:4px;}' +
    '.risk-value{font-size:20px;font-weight:700;}.risk-value.low{color:#0d9488;}.risk-value.medium{color:#d97706;}.risk-value.high{color:#c53929;}' +
    '.risk-label{font-size:12px;color:#6e6e73;}.risk-reasons{margin:6px 0 0;font-size:11px;color:#6e6e73;line-height:1.4;}' +
    '.risk-error{margin:6px 0 0;font-size:12px;color:#c53929;}' +
    '.btn-dashboard{display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;margin-top:16px;font-weight:600;font-size:13px;}' +
    '.btn-dashboard:hover{background:#6d28d9;color:#fff;}' +
    '.footer{margin-top:16px;padding-top:12px;border-top:1px solid #e5e5e7;font-size:12px;text-align:center;}' +
    '.footer a{color:#7c3aed;text-decoration:none;}' +
    '.pill{cursor:pointer;user-select:none;padding:12px 18px;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.2);border:3px solid #7c3aed;font-size:16px;font-weight:700;color:#fff;}' +
    '.pill:hover{opacity:0.95;}.container{display:flex;flex-direction:row-reverse;align-items:center;gap:0;}';

  function showPopup() {
    if (document.getElementById('innovateher-risk-popup')) return;

    var host = document.createElement('div');
    host.id = 'innovateher-risk-popup';
    host.setAttribute(
      'style',
      'position:fixed!important;top:50%!important;right:16px!important;transform:translateY(-50%)!important;' +
        'z-index:2147483647!important;visibility:visible!important;display:block!important;'
    );

    var root = host.attachShadow({ mode: 'open' });
    var riskData = { score: null, reasons: null, error: null };

    root.innerHTML =
      '<style>' + expandedStyles + '</style>' +
      '<div class="container">' +
      '<div class="panel" id="panel">' +
      '<div class="panel-inner">' +
      '<header class="header"><div class="title">AI Image Detector</div><p class="tagline">Check if images on this page are AI-generated</p></header>' +
      '<section class="section current-page"><span class="label">Current page</span><p class="url" id="panel-url">—</p></section>' +
      '<section class="section risk-section"><span class="label">Risk score</span><div class="risk-display"><span class="risk-value" id="panel-score">—</span><span class="risk-label" id="panel-label"></span></div><p class="risk-reasons" id="panel-reasons"></p><p class="risk-error" id="panel-error" style="display:none;"></p></section>' +
      '<a href="#" class="btn-dashboard" id="panel-dashboard">Open Dashboard</a>' +
      '<footer class="footer"><a href="#" id="panel-settings">Settings</a><span style="margin:0 6px;color:#ccc;">·</span><a href="#" id="panel-help">Help</a></footer>' +
      '</div></div>' +
      '<div class="pill" id="pill"><span id="txt">Risk: …</span></div>' +
      '</div>';

    var pill = root.getElementById('pill');
    var panel = root.getElementById('panel');
    var txt = root.getElementById('txt');
    var panelUrl = root.getElementById('panel-url');
    var panelScore = root.getElementById('panel-score');
    var panelLabel = root.getElementById('panel-label');
    var panelReasons = root.getElementById('panel-reasons');
    var panelError = root.getElementById('panel-error');

    panelUrl.textContent = formatUrl(window.location.href);
    panelUrl.title = window.location.href;

    function updatePill(score, err) {
      var bg = getColor(score);
      host.style.background = 'transparent';
      pill.style.background = bg;
      if (err) {
        txt.textContent = 'Risk: !';
        pill.style.background = '#6b7280';
      } else if (score != null) {
        txt.textContent = 'Risk: ' + score;
      } else {
        txt.textContent = 'Risk: …';
      }
    }

    function updatePanel() {
      var d = riskData;
      panelScore.textContent = d.score != null ? String(d.score) : '—';
      panelScore.className = 'risk-value ' + riskValueClass(d.score);
      panelLabel.textContent = riskLabel(d.score);
      if (d.error) {
        panelError.textContent = d.error;
        panelError.style.display = 'block';
        panelReasons.style.display = 'none';
      } else {
        panelError.style.display = 'none';
        if (d.reasons && d.reasons.length) {
          panelReasons.textContent = d.reasons.join(' · ');
          panelReasons.style.display = 'block';
        } else {
          panelReasons.style.display = 'none';
        }
      }
    }

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) {
        panel.classList.remove('open');
      } else {
        panelUrl.textContent = formatUrl(window.location.href);
        panelUrl.title = window.location.href;
        updatePanel();
        panel.classList.add('open');
      }
    });

    root.getElementById('panel-dashboard').addEventListener('click', function (e) {
      e.preventDefault();
      window.open(DASHBOARD_URL, '_blank');
    });
    root.getElementById('panel-settings').addEventListener('click', function (e) { e.preventDefault(); });
    root.getElementById('panel-help').addEventListener('click', function (e) { e.preventDefault(); });

    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !host.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    document.documentElement.appendChild(host);

    chrome.runtime.sendMessage(
      { type: 'GET_SITE_RISK', url: window.location.href },
      function (response) {
        if (chrome.runtime.lastError) {
          riskData.error = 'Backend unreachable';
          updatePill(null, true);
          updatePanel();
          return;
        }
        if (response && response.error) {
          riskData.error = response.error;
          updatePill(null, true);
          updatePanel();
          return;
        }
        if (response) {
          riskData.score = response.riskScore;
          riskData.reasons = response.reasons || null;
          riskData.error = null;
          updatePill(riskData.score, false);
          updatePanel();
        }
      }
    );
  }

  function ensurePopup() {
    if (document.documentElement) {
      showPopup();
      var observer = new MutationObserver(function () {
        if (!document.getElementById('innovateher-risk-popup')) {
          showPopup();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', ensurePopup);
    }
  }

  ensurePopup();
})();
