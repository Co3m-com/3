const CACHE_NAME = 'v1';
const CACHE_ASSETS = [
    '/', // Đây là trang chính
    'index.html',
    'style.css',
    'app.js',
];

// Thiết lập cache khi service worker được cài đặt
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CACHE_ASSETS);
        })
    );
});

// Lấy tài nguyên từ cache khi có yêu cầu
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});

// Cập nhật cache sau 7 ngày
setInterval(() => {
    caches.keys().then((cacheNames) => {
        cacheNames.forEach((name) => {
            if (name !== CACHE_NAME) {
                caches.delete(name);
            }
        });
    });
}, 7 * 24 * 60 * 60 * 1000); // 7 ngày
