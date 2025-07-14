const CACHE_NAME = 'my-web-cache-v2025062736'; 

const urlsToCache = [
    './',
    './index.html',
    './style.css?v=2025062736',
    './script.js?v=2025062736',
    './swreg.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error('[SW] Failed to cache during install:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    if (urlsToCache.includes(requestUrl.pathname) || urlsToCache.includes(requestUrl.pathname + requestUrl.search) || event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    return fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse.ok && event.request.method === 'GET') {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                            return networkResponse;
                        })
                        .catch(error => {
                            throw error;
                        });
                })
        );
    } else {
        event.respondWith(
            fetch(event.request).catch(error => {
                return caches.match(event.request);
            })
        );
    }
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME]; 
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
