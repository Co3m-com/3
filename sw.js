const CACHE_NAME = 'my-web-cache-v20250714'; 

const urlsToCache = [
    './',
    './index.html',
    './style.css', // Bỏ tham số query string
    './script.js', // Bỏ tham số query string
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

    // Xử lý các tài nguyên trong urlsToCache và các yêu cầu điều hướng (navigate requests)
    if (urlsToCache.some(url => requestUrl.pathname.endsWith(url.replace('./', '')) || requestUrl.href === new URL(url, self.location.origin).href) || event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        console.log(`[SW] Serving from cache: ${event.request.url}`);
                        return cachedResponse;
                    }

                    // Nếu không có trong cache, fetch từ network và cache lại
                    console.log(`[SW] Not in cache, fetching from network and caching: ${event.request.url}`);
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
                            console.error(`[SW] Fetch failed for: ${event.request.url} and no cache match.`, error);
                            throw error;
                        });
                })
        );
    } else {
        // Đối với các tài nguyên không nằm trong urlsToCache, vẫn cho phép network request.
        // Nếu bạn muốn chặn hoàn toàn mọi network request, có thể bỏ phần này.
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
