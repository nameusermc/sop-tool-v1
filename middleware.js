// Vercel Edge Middleware — Geo-based cookie consent detection
// Sets a cookie for EU/EEA/UK visitors so the client-side banner knows to show

import { NextResponse } from 'next/server';

// EU/EEA countries + UK (GDPR + UK GDPR)
const CONSENT_REQUIRED_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', // EU 27
  'IS', 'LI', 'NO', // EEA non-EU
  'GB' // UK GDPR
]);

export function middleware(request) {
  const response = NextResponse.next();
  const country = request.geo?.country || '';

  // Only set the cookie if visitor is in a consent-required region
  // and doesn't already have the cookie (avoid resetting on every request)
  const existingCookie = request.cookies.get('geo-consent-required');

  if (CONSENT_REQUIRED_COUNTRIES.has(country) && !existingCookie) {
    response.cookies.set('geo-consent-required', '1', {
      httpOnly: false, // Client JS needs to read this
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: '/'
    });
  }

  return response;
}

// Run on all page requests, skip static assets and API routes
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon|apple-touch|og-image|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|json|xml|txt|webmanifest)).*)'
  ]
};
