// CACHE_NAME sẽ tự động thay đổi mỗi khi bạn deploy file sw.js này lên server
// Điều này báo hiệu cho trình duyệt rằng có một phiên bản Service Worker mới
const CACHE_NAME = 'my-web-cache-v' + new Date().toISOString().replace(/[^0-9]/g, '');

const urlsToCache = [
    './', // Trang gốc (index.html)
    './index.html',
    './style.css',
    './script.js',
    './swreg.js'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Installing cache:', CACHE_NAME);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Bỏ qua giai đoạn waiting, cài đặt ngay lập tức
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
        }).then(() => self.clients.claim()) // Kiểm soát các client (tab) đang mở ngay lập tức
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .catch(() => {
                        console.warn('[Service Worker] Could not fetch resource and not in cache:', event.request.url);
                    });
            })
    );
});
