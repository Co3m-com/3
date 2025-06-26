const CACHE_NAME = 'my-web-cache-v2025062601';

const urlsToCache = [
    './',
    './index.html',
    './style.css?v=2025062601',
    './script.js?v=2025062601'
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
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request).catch(() => {
                console.log('Service Worker: Network failed for document, trying cache.');
                return caches.match(event.request);
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(networkResponse => {
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    })
                    .catch(error => {
                        console.error('Service Worker: Fetch failed and no cache match -', event.request.url, error);
                    });
            })
    );
});

self.addEventListener('activate', event => {
    console.log('Service Worker: Activating new Service Worker.');
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Deleting old cache -', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});
