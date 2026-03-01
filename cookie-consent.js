// Cookie Consent Banner — EU/EEA/UK only
// Reads geo-consent-required cookie set by middleware.js
// Manages GA4 Consent Mode v2 updates

(function() {
  'use strict';

  // Check if consent is required (EU visitor) and no choice made yet
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;secure;samesite=lax';
  }

  var needsConsent = getCookie('geo-consent-required') === '1';
  var consentChoice = getCookie('cookie-consent'); // 'accepted' or 'declined'

  // Not an EU visitor or already made a choice — nothing to do
  if (!needsConsent || consentChoice) return;

  // Build and inject the banner
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

  // Banner styles
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:#e2e8f0;padding:1rem 1.5rem;z-index:99999;box-shadow:0 -2px 10px rgba(0,0,0,0.3);border-top:1px solid #334155;';

  document.body.appendChild(banner);

  // Handle Accept
  document.getElementById('cc-accept').addEventListener('click', function() {
    setCookie('cookie-consent', 'accepted', 365);
    // Update GA4 consent
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        'analytics_storage': 'granted'
      });
    }
    banner.remove();
  });

  // Handle Decline
  document.getElementById('cc-decline').addEventListener('click', function() {
    setCookie('cookie-consent', 'declined', 365);
    // Analytics stays denied — no update needed
    banner.remove();
  });
})();
