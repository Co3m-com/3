if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);

            // Không cần lắng nghe 'updatefound' hay 'statechange' ở đây
            // vì chúng ta muốn tự động cập nhật, không thông báo

        }, function(err) {
            console.log('ServiceWorker registration failed: ', err);
        });
    });

    // Lắng nghe sự kiện khi Service Worker mới bắt đầu kiểm soát trang
    navigator.serviceWorker.addEventListener('controllerchange', function() {
        // Service Worker mới đã được kích hoạt và đang kiểm soát trang
        // Tải lại trang để đảm bảo các tài nguyên mới được sử dụng
        console.log('Service Worker mới đã được kích hoạt. Đang tải lại trang...');
        window.location.reload(); 
    });
}
