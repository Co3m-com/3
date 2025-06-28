const CACHE_NAME = 'my-web-cache-v2025062728'; 

const urlsToCache = [
    './',
    './index.html',
    './style.css?v=2025062728',
    './script.js?v=2025062728',
    './swreg.js'
];

self.addEventListener('install', event => {
    console.log('[SW] Install Event: Caching shell assets.');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching all app shell content.');
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
                        console.log(`[SW] Serving from cache: ${event.request.url}`);
                        return cachedResponse;
                    }

                    console.log(`[SW] Not in cache, fetching from network: ${event.request.url}`);
                    return fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse.ok && event.request.method === 'GET') {
                                caches.open(CACHE_NAME).then(cache => {
                                    console.log(`[SW] Caching new network response for: ${event.request.url}`);
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                            return networkResponse;
                        })
                        .catch(error => {
                            console.error(`[SW] Fetch failed and no cache match for: ${event.request.url}`, error);
                            throw error;
                        });
                })
        );
    } else {
        event.respondWith(
            fetch(event.request).catch(error => {
                console.log(`[SW] Network fetch failed for non-app-shell: ${event.request.url}, trying cache.`);
                return caches.match(event.request);
            })
        );
    }
});

self.addEventListener('activate', event => {
    console.log('[SW] Activate Event: Cleaning old caches.');
    const cacheWhitelist = [CACHE_NAME]; 
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[SW] Deleting old cache: ${cacheName}`);
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
        console.log('[SW] Message received: Skipping waiting phase.');
        self.skipWaiting();
    }
});
