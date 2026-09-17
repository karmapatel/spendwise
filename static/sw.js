/*
 * Copyright (C) 2026 Karma Patel karmapatel4@gmail.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://gnu.org>.
 */

// SpendWise Service Worker
const CACHE_NAME = 'spendwise-static-v3';

// Safe static assets only - NEVER cache private financial or user data
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/api.js',
  '/static/js/app.js',
  '/static/js/auth.js',
  '/static/js/calendar.js',
  '/static/js/charts.js',
  '/static/js/filters.js',
  '/static/icons/logo.png',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/icon-apple-touch.png',
  '/manifest.json'
];

// Install Event: Pre-cache core static UI assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Strict policy - only safe static assets are cached
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. STRICT SECURITY RULE: Never cache any API requests or health checks or non-GET requests
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health'
  ) {
    // Pass straight to network without cache interaction
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Navigation request for root / HTML: Instant cache-first with background network revalidation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => caches.match(event.request).then((res) => res || caches.match('/')));

        // If cached HTML shell exists, serve instantly (0ms), otherwise await network
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, images, fonts): Cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for static assets
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache static file if valid response
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith('/static/') || url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com'))
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      });
    })
  );
});
