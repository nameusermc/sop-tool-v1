// Cookie Consent Banner — EU/EEA/UK only
// Calls /api/geo on first visit to determine if consent is needed
// Sets geo-consent-required cookie (0 or 1) so future visits skip the API call
// Manages GA4 Consent Mode v2 updates

(function() {
  'use strict';

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;secure;samesite=lax';
  }

  function updateConsent(granted) {
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        'analytics_storage': granted ? 'granted' : 'denied'
      });
    }
  }

  function showBanner() {
    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML =
      '<div style="max-width:960px;margin:0 auto;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">' +
        '<p style="margin:0;flex:1;min-width:200px;font-size:0.9rem;line-height:1.4;">' +
          'We use cookies for analytics to improve your experience. ' +
          '<a href="/privacy" style="color:#a5b4fc;text-decoration:underline;">Privacy Policy</a>' +
        '</p>' +
        '<div style="display:flex;gap:0.5rem;flex-shrink:0;">' +
          '<button id="cc-decline" style="padding:0.5rem 1rem;border:1px solid #64748b;background:transparent;color:#e2e8f0;border-radius:6px;cursor:pointer;font-size:0.85rem;">Decline</button>' +
          '<button id="cc-accept" style="padding:0.5rem 1rem;border:none;background:#6366f1;color:#fff;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:500;">Accept</button>' +
        '</div>' +
      '</div>';

    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:#e2e8f0;padding:1rem 1.5rem;z-index:99999;box-shadow:0 -2px 10px rgba(0,0,0,0.3);border-top:1px solid #334155;';

    document.body.appendChild(banner);

    document.getElementById('cc-accept').addEventListener('click', function() {
      setCookie('cookie-consent', 'accepted', 365);
      updateConsent(true);
      banner.remove();
    });

    document.getElementById('cc-decline').addEventListener('click', function() {
      setCookie('cookie-consent', 'declined', 365);
      banner.remove();
    });
  }

  // --- Main logic ---

  var geoValue = getCookie('geo-consent-required');
  var consentChoice = getCookie('cookie-consent');

  // Case 1: Geo already known — non-EU
  if (geoValue === '0') {
    updateConsent(true);
    return;
  }

  // Case 2: Geo already known — EU, choice already made
  if (geoValue === '1' && consentChoice) {
    if (consentChoice === 'accepted') updateConsent(true);
    return;
  }

  // Case 3: Geo already known — EU, no choice yet
  if (geoValue === '1' && !consentChoice) {
    showBanner();
    return;
  }

  // Case 4: First visit — no geo cookie. Call API.
  fetch('/api/geo')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.consent_required) {
        setCookie('geo-consent-required', '1', 90);
        showBanner();
      } else {
        setCookie('geo-consent-required', '0', 90);
        updateConsent(true);
      }
    })
    .catch(function() {
      // API failed — default to not showing banner (fail open for UX)
      // GA4 stays in denied mode from inline default — safe for privacy
    });
})();
