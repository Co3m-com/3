const CACHE_NAME = 'my-web-cache-v202507141659'; // Đổi tên cache để kích hoạt cập nhật khi có code mới

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './swreg.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting()) // Đảm bảo dòng này có
            .catch(error => {
                console.error('Service Worker: Lỗi khi cài đặt cache:', error);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // Xóa cache cũ
                    }
                })
            );
        }).then(() => self.clients.claim()) // Đảm bảo dòng này có
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
                        console.warn('Service Worker: Không thể fetch tài nguyên và không có trong cache:', event.request.url);
                    });
            })
    );
});
