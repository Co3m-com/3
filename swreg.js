if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker: Registration successful with scope: ', registration.scope);

                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('Service Worker: New content available, asking to skip waiting.');
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            }
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Service Worker: Registration failed: ', error);
            });
        
        // Đoạn code này đã được loại bỏ để ngăn tự động tải lại trang khi có cập nhật Service Worker.
        // Người dùng sẽ tiếp tục sử dụng phiên bản cũ cho đến khi họ tự refresh trang.
        // navigator.serviceWorker.addEventListener('controllerchange', () => {
        //     console.log('Service Worker: Controller changed, reloading page for update.');
        //     window.location.reload(); 
        // });
    });
}
