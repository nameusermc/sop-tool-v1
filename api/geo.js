/**
 * /api/geo.js — Geo-detection for cookie consent
 * 
 * Reads Vercel's x-vercel-ip-country header and returns whether
 * the visitor is in a GDPR/UK-GDPR region.
 * 
 * Called once per visitor by cookie-consent.js (result cached in cookie).
 * 
 * This is serverless function #5 of 12 (Vercel Hobby limit).
 */

const CONSENT_REQUIRED = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    'IS', 'LI', 'NO',
    'GB'
]);

module.exports = (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const country = req.headers['x-vercel-ip-country'] || '';
    const needsConsent = CONSENT_REQUIRED.has(country);

    // Cache for 24 hours — geo doesn't change mid-session
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).json({ consent_required: needsConsent });
};
