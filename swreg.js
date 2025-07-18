if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, function(err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });

    // Lắng nghe sự kiện khi Service Worker mới bắt đầu kiểm soát trang
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        // Tải lại trang để đảm bảo các tài nguyên mới được sử dụng
        console.log('New Service Worker activated. Reloading page...');
        window.location.reload(); 
    });
}
