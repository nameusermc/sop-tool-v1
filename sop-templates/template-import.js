/**
 * template-import.js
 * 
 * Runs on SEO template pages (/sop-templates/*.html).
 * Reads each SOP card's title, description, and steps from the HTML,
 * then adds a "Use this template →" button that links into the app
 * with the template data encoded in the URL.
 * 
 * Progressive enhancement — pages work fine without this script.
 */
(function () {
    'use strict';

    var cards = document.querySelectorAll('.tp-sop-card');
    if (!cards.length) return;

    // Inject button styles once
    var style = document.createElement('style');
    style.textContent = '.tp-import-btn{display:inline-block;margin-top:1rem;padding:0.5rem 1.25rem;font-size:0.9rem;font-weight:600;color:#fff;background:#4338ca;border-radius:6px;text-decoration:none;transition:background 0.15s;}.tp-import-btn:hover{background:#3730a3;}';
    document.head.appendChild(style);

    cards.forEach(function (card) {
        var h3 = card.querySelector('h3');
        var desc = card.querySelector('.tp-sop-desc');
        var stepEls = card.querySelectorAll('.tp-sop-steps li');

        if (!h3 || !stepEls.length) return;

        // Strip leading emoji + whitespace from title
        var title = h3.textContent.replace(/^[\s\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]+/u, '').trim();
        var description = desc ? desc.textContent.trim() : '';
        var steps = [];
        stepEls.forEach(function (li) {
            var text = li.textContent.trim();
            if (text) steps.push({ text: text });
        });

        if (!steps.length) return;

        // Build the template payload
        var payload = JSON.stringify({
            title: title,
            description: description,
            steps: steps
        });

        // Base64 encode (safe for URL with unicode support)
        var encoded = btoa(unescape(encodeURIComponent(payload)));
        var href = '/?import=' + encodeURIComponent(encoded);

        // Create the button
        var btn = document.createElement('a');
        btn.href = href;
        btn.textContent = 'Use this template \u2192';
        btn.className = 'tp-import-btn';
        card.appendChild(btn);
    });
})();
