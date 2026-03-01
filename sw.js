/**
 * WithoutMe Service Worker
 * 
 * Caches the app shell for instant repeat loads.
 * Network-first for HTML (always get latest), cache-first for static assets.
 * Never caches API calls or third-party scripts.
 */

const CACHE_NAME = 'withoutme-v1';

// Core app shell files to pre-cache on install
const APP_SHELL = [
    '/',
    '/app.js',
    '/modules/dashboard.js',
    '/modules/sop-create.js',
    '/modules/checklist.js',
    '/modules/landing.js',
    '/lib/storage-adapter.js',
    '/lib/supabase-client.js',
    '/lib/module-integration.js',
    '/lib/paddle-billing.js',
    '/favicon-192.png',
    '/favicon-512.png',
    '/apple-touch-icon.png',
    '/og-image.png'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: network-first for navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip: non-GET, API calls, third-party, chrome-extension
    if (event.request.method !== 'GET') return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.origin !== self.location.origin) return;

    // Navigation requests (HTML pages): network-first with cache fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Cache the fresh copy
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request) || caches.match('/'))
        );
        return;
    }

    // Static assets: cache-first with network fallback
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Only cache successful same-origin responses
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
