// sw.js
const CACHE_NAME = 'my-web-cache-v' + new Date().toISOString().replace(/[^0-9]/g, '');

const urlsToCache = [
    '/',          
    '/index.html'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Installing cache:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Pre-caching essential app shell:', urlsToCache);
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error('[Service Worker] Cache installation failed:', error);
            })
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating and clearing old caches.');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName); 
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            if (event.request.method === 'GET') {
                                console.log('[Service Worker] Caching new network response for:', event.request.url);
                                cache.put(event.request, responseToCache);
                            }
                        })
                        .catch(error => {
                            console.warn('[Service Worker] Error caching network response:', error);
                        });
                }
                return networkResponse;
            })
            .catch(() => {
                console.warn('[Service Worker] Network request failed, falling back to cache for:', event.request.url);
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        console.log('[Service Worker] Serving from cache:', event.request.url);
                        return cachedResponse;
                    }
                    console.log('[Service Worker] Resource not in cache and network failed:', event.request.url);
                    return new Response('<h1>Offline</h1><p>The page you are looking for is not available offline.</p>', {
                        headers: { 'Content-Type': 'text/html' }
                    }); 
                });
            })
    );
});
