const CACHE_NAME = 'my-web-cache-v2025062707'; // Đã cập nhật phiên bản

const urlsToCache = [
    './', // Cache the root URL
    './index.html',
    './style.css?v=2025062707', // Đã cập nhật phiên bản
    './script.js?v=2025062707'  // Đã cập nhật phiên bản
];

self.addEventListener('install', event => {
    console.log('Service Worker: Installing cache:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching all essential content for offline use.');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache during install:', error);
            })
    );
});

self.addEventListener('fetch', event => {
    // For navigation requests (main HTML page), try network first, then cache
    // This is useful for always getting the latest HTML if online, but providing offline fallback
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('Service Worker: Network failed for document, trying cache.');
                return caches.match(event.request);
            })
        );
        return; // Important to return here to not fall through to the next respondWith
    }

    // For other requests (CSS, JS, images), try cache first, then network
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // Serve from cache if found
                }
                // If not in cache, fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Optionally cache the new response for future use
                        return caches.open(CACHE_NAME).then(cache => {
                            // Only cache valid responses (e.g., 200 OK)
                            if (networkResponse.ok) {
                                cache.put(event.request, networkResponse.clone());
                            }
                            return networkResponse;
                        });
                    })
                    .catch(error => {
                        console.error('Service Worker: Fetch failed and no cache match -', event.request.url, error);
                        // You could return an offline page here for other assets if needed
                        // return caches.match('/offline.html');
                    });
            })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activating new Service Worker.');
    const cacheWhitelist = [CACHE_NAME]; // Only keep the current cache
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Deleting old cache -', cacheName);
                        return caches.delete(cacheName); // Delete old caches
                    }
                })
            );
        })
    );
    return self.clients.claim(); // Immediately take control of any open clients
});
