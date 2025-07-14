const CACHE_NAME = 'my-web-cache-v202507141503'; // Cập nhật phiên bản cache

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
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);

    // Xử lý yêu cầu điều hướng (ví dụ: tải trang chính) hoặc tài nguyên trong danh sách cache
    if (urlsToCache.includes(requestUrl.pathname) || urlsToCache.includes(requestUrl.pathname + requestUrl.search) || event.request.mode === 'navigate') {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    // Nếu có trong cache, phục vụ từ cache
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Nếu không có trong cache, cố gắng lấy từ mạng
                    return fetch(event.request)
                        .then(networkResponse => {
                            // Nếu thành công và là GET, lưu vào cache
                            if (networkResponse.ok && event.request.method === 'GET') {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // Khi mất mạng và không có trong cache (điều này không nên xảy ra với các tài nguyên cốt lõi)
                            // Trả về một phản hồi rỗng hoặc một trang lỗi ngoại tuyến tùy chỉnh nếu bạn muốn.
                            // Với yêu cầu "không load lại bất cứ điều gì", chúng ta không trả về gì đặc biệt ở đây
                            // và hy vọng rằng trình duyệt sẽ giữ nguyên trạng thái.
                            // Đối với các tài nguyên đã cache, chúng sẽ được phục vụ bình thường.
                            // Đối với các tài nguyên chưa cache (ví dụ: ảnh động mới, API call), chúng sẽ thất bại
                            // nhưng không làm crash ứng dụng nếu JS của bạn xử lý lỗi fetch.
                            return new Response(null, { status: 503, statusText: 'Service Unavailable - Offline' });
                        });
                })
        );
    } else {
        // Đối với các tài nguyên không nằm trong danh sách cache (ví dụ: các tài nguyên động, API)
        // Cố gắng lấy từ mạng trước, sau đó tìm trong cache nếu mạng thất bại.
        event.respondWith(
            fetch(event.request).catch(() => {
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
