'use strict';

(function () {
  var DASHBOARD_URL = 'http://localhost:3000';

  /* Light pastel text colors (widget bg stays white, border = light purple) */
  function getTextColor(score) {
    if (score == null) return '#b5b8c4';
    if (score < 30) return '#7ba892';
    if (score < 60) return '#c4a574';
    return '#d4a0a0';
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

  var suggestionsFetched = false;

  var expandedStyles =
    '@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap");' +
    '.panel{display:none;width:320px;background:#fefaff;border-radius:20px;box-shadow:0 8px 32px rgba(243,205,238,0.35);border:2px solid #F3CDEE;overflow:hidden;font-family:"Nunito",system-ui,sans-serif;font-size:14px;color:#5c5c6a;}' +
    '.panel.open{display:block;}' +
    '.panel-inner{padding:18px;}' +
    '.header{position:relative;margin-bottom:14px;padding-right:36px;}.title{font-size:17px;font-weight:700;margin:0;color:#424874;letter-spacing:-0.02em;}.tagline{font-size:12px;color:#b5b8c4;margin:6px 0 0;font-weight:500;}' +
    '.btn-close{position:absolute;top:0;right:0;width:28px;height:28px;border:none;background:#fdf5fc;border-radius:50%;color:#b5b8c4;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;border:2px solid #F3CDEE;transition:color .2s,background .2s;}' +
    '.btn-close:hover{background:#F3CDEE;color:#424874;}' +
    '.section{margin-top:14px;}.section .label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#b5b8c4;margin-bottom:6px;}' +
    '.current-page{background:#fdf5fc;border:2px solid #F3CDEE;border-radius:14px;padding:12px 14px;}.current-page .url{font-size:13px;margin:0;word-break:break-all;max-height:2.6em;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#5c5c6a;font-weight:600;}' +
    '.risk-section{background:#fdf5fc;border:2px solid #F3CDEE;border-radius:14px;padding:12px 14px;}' +
    '.risk-display{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-top:4px;}' +
    '.risk-value{font-size:22px;font-weight:700;}.risk-value.low{color:#7ba892;}.risk-value.medium{color:#c4a574;}.risk-value.high{color:#d4a0a0;}' +
    '.risk-label{font-size:12px;font-weight:600;color:#b5b8c4;}.risk-reasons{margin:8px 0 0;font-size:11px;color:#b5b8c4;line-height:1.45;}' +
    '.risk-error{margin:8px 0 0;font-size:12px;color:#d4a0a0;font-weight:600;}' +
    '.btn-dashboard{display:block;text-align:center;background:#424874;color:#fff;text-decoration:none;padding:12px 18px;border-radius:14px;margin-top:18px;font-weight:700;font-size:13px;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(66,72,116,0.2);}' +
    '.btn-dashboard:hover{background:#353b62;color:#fff;}' +
    '.footer{margin-top:18px;padding-top:14px;border-top:2px solid #F3CDEE;font-size:12px;text-align:center;}' +
    '.footer a{color:#424874;text-decoration:none;font-weight:600;}' +
    '.pill{cursor:pointer;user-select:none;padding:14px 20px;border-radius:16px;box-shadow:0 6px 24px rgba(243,205,238,0.3);border:2px solid #F3CDEE;font-size:16px;font-weight:700;background:#fff;color:#b5b8c4;font-family:"Nunito",system-ui,sans-serif;}' +
    '.pill:hover{box-shadow:0 8px 28px rgba(243,205,238,0.4);}' +
    '.container{display:flex;flex-direction:row-reverse;align-items:center;gap:0;}' +
    '.container.panel-open .pill{display:none!important;}' +
    '.suggestions-section{margin-top:14px;background:#fdf5fc;border:2px solid #F3CDEE;border-radius:14px;padding:12px 14px;}' +
    '.suggestions-loading{font-size:12px;color:#b5b8c4;font-style:italic;margin-top:6px;}' +
    '.suggestions-error{font-size:12px;color:#d4a0a0;font-weight:600;margin-top:6px;}' +
    '.suggestions-list{list-style:none;margin:0;padding:0;}' +
    '.suggestion-item{padding:8px 0;border-bottom:1px solid #F3CDEE;}' +
    '.suggestion-item:last-child{border-bottom:none;}' +
    '.suggestion-name{display:block;font-size:13px;font-weight:600;color:#424874;text-decoration:none;line-height:1.3;}' +
    '.suggestion-name:hover{text-decoration:underline;color:#353b62;}' +
    '.suggestion-desc{font-size:11px;color:#b5b8c4;margin-top:2px;line-height:1.3;}' +
    '.suggestion-price{font-size:11px;color:#7ba892;font-weight:600;margin-top:2px;}';

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
      '<div class="container" id="container">' +
      '<div class="panel" id="panel">' +
      '<div class="panel-inner">' +
      '<header class="header"><div class="title">AI Image Detector</div><p class="tagline">Check if images on this page are AI-generated</p><button type="button" class="btn-close" id="btn-close" aria-label="Close">×</button></header>' +
      '<section class="section current-page"><span class="label">Current page</span><p class="url" id="panel-url">—</p></section>' +
      '<section class="section risk-section"><span class="label">Risk score</span><div class="risk-display"><span class="risk-value" id="panel-score">—</span><span class="risk-label" id="panel-label"></span></div><p class="risk-reasons" id="panel-reasons"></p><p class="risk-error" id="panel-error" style="display:none;"></p></section>' +
      '<section class="section suggestions-section" id="suggestions-section" style="display:none;"><span class="label">Suggested Alternatives</span><p class="suggestions-loading" id="suggestions-loading">Finding similar products...</p><p class="suggestions-error" id="suggestions-error" style="display:none;"></p><ul class="suggestions-list" id="suggestions-list"></ul></section>' +
      '<a href="#" class="btn-dashboard" id="panel-dashboard">Open Dashboard</a>' +
      '<footer class="footer"><a href="#" id="panel-settings">Settings</a><span style="margin:0 6px;color:#F3CDEE;">·</span><a href="#" id="panel-help">Help</a></footer>' +
      '</div></div>' +
      '<div class="pill" id="pill"><span id="txt">Risk: …</span></div>' +
      '</div>';

    var container = root.getElementById('container');
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
      pill.style.background = '#fff';
      pill.style.color = '';
      txt.style.color = err ? '#b5b8c4' : getTextColor(score);
      if (err) {
        txt.textContent = 'Risk: !';
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

    function closePanel() {
      panel.classList.remove('open');
      container.classList.remove('panel-open');
    }

    function openPanel() {
      panelUrl.textContent = formatUrl(window.location.href);
      panelUrl.title = window.location.href;
      updatePanel();
      panel.classList.add('open');
      container.classList.add('panel-open');
    }

    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) {
        closePanel();
      } else {
        openPanel();
      }
    });

    root.getElementById('btn-close').addEventListener('click', function (e) {
      e.preventDefault();
      closePanel();
    });

    root.getElementById('panel-dashboard').addEventListener('click', function (e) {
      e.preventDefault();
      window.open(DASHBOARD_URL, '_blank');
    });
    root.getElementById('panel-settings').addEventListener('click', function (e) { e.preventDefault(); });
    root.getElementById('panel-help').addEventListener('click', function (e) { e.preventDefault(); });

    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !host.contains(e.target)) {
        closePanel();
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
          maybeFetchSuggestions();
        }
      }
    );

    // Fetch product suggestions — only on Amazon, Temu, or Walmart product pages
    var suggestionsSection = root.getElementById('suggestions-section');
    var suggestionsLoading = root.getElementById('suggestions-loading');
    var suggestionsError = root.getElementById('suggestions-error');
    var suggestionsList = root.getElementById('suggestions-list');

    var currentHost = window.location.hostname.toLowerCase();
    var isAmazonTemuOrWalmart =
      currentHost.includes('amazon.') ||
      currentHost.includes('temu.') ||
      currentHost.includes('walmart.');

    if (!isAmazonTemuOrWalmart || suggestionsFetched) {
      // Not supported or already fetched — skip product suggestions
      suggestionsSection.style.display = 'none';
      suggestionsLoading.style.display = 'none';
      suggestionsError.style.display = 'none';
    }

    function maybeFetchSuggestions() {
      if (!isAmazonTemuOrWalmart || suggestionsFetched) return;
      if (riskData.score === 0) {
        suggestionsSection.style.display = 'none';
        suggestionsLoading.style.display = 'none';
        suggestionsError.style.display = 'none';
        return;
      }

      suggestionsFetched = true;
      suggestionsSection.style.display = 'block';
      suggestionsLoading.style.display = 'block';
      suggestionsError.style.display = 'none';
      suggestionsList.innerHTML = '';

      chrome.runtime.sendMessage(
        { type: 'GET_PRODUCT_SUGGESTIONS', url: window.location.href },
        function (response) {
          if (chrome.runtime.lastError) {
            suggestionsLoading.style.display = 'none';
            suggestionsError.textContent = 'Backend unreachable';
            suggestionsError.style.display = 'block';
            return;
          }

          suggestionsLoading.style.display = 'none';

          if (response && response.error) {
            suggestionsError.textContent = response.error;
            suggestionsError.style.display = 'block';
            return;
          }

          if (response && response.productName) {
            console.log('[InnovateHer] Product name found:', response.productName);
          } else {
            console.log('[InnovateHer] No product name found for this page');
          }

          if (response && response.suggestions && response.suggestions.length > 0) {
            suggestionsList.innerHTML = '';

            response.suggestions.forEach(function (item) {
              var li = document.createElement('li');
              li.className = 'suggestion-item';

              var a = document.createElement('a');
              a.className = 'suggestion-name';
              a.href = item.searchUrl || item.amazonSearchUrl;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.textContent = item.name;
              li.appendChild(a);

              if (item.description) {
                var desc = document.createElement('div');
                desc.className = 'suggestion-desc';
                desc.textContent = item.description;
                li.appendChild(desc);
              }

              if (item.estimatedPriceRange) {
                var price = document.createElement('div');
                price.className = 'suggestion-price';
                price.textContent = item.estimatedPriceRange;
                li.appendChild(price);
              }

              suggestionsList.appendChild(li);
            });
          }
        }
      );
    }
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
