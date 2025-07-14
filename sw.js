const CACHE_NAME = 'my-web-cache-v202507141655'; // Đổi tên cache để kích hoạt cập nhật khi có code mới

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
            .then(() => self.skipWaiting())
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
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Trả về từ cache nếu có
                if (response) {
                    return response;
                }
                // Nếu không có trong cache, fetch từ network
                return fetch(event.request)
                    .catch(() => {
                        console.warn('Service Worker: Không thể fetch tài nguyên và không có trong cache:', event.request.url);
                    });
            })
    );
});
