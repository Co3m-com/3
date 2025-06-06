var score = 0;
var lastClickTime;
var keydownActive = false;
var firstInteraction = false; // Biến cờ để kiểm tra tương tác đầu tiên
var touchStartY = null;
var touchStartX = null;
var SWIPE_THRESHOLD = 100; // Khoảng cách vuốt tối thiểu để kích hoạt tải lại

// Lấy tham chiếu đến container ảnh
const introImageContainer = document.getElementById('intro-image-container');

function resetScore() {
    score = 0;
    updateScoreDisplay();
    document.getElementById('text').style.opacity = 1;
}

function updateScoreDisplay() {
    var scoreElement = document.getElementById('score');
    scoreElement.innerText = score;
    scoreElement.style.opacity = score > 0 ? 1 : 0;
}

function getRandomColor() {
    return `hsl(${Math.random() * 360}, 100%, 50%)`;
}

function createWave(x, y) {
    var wave = document.createElement('div');
    wave.className = 'wave';
    wave.style.width = '100px';
    wave.style.height = '100px';
    wave.style.left = `${x - 50}px`;
    wave.style.top = `${y - 50}px`;
    wave.style.background = getRandomColor();

    document.body.appendChild(wave);

    wave.addEventListener('animationend', function() {
        wave.remove();
    });
}

function handleFirstInteraction() {
    if (!firstInteraction) {
        introImageContainer.classList.add('hidden'); // Thêm class 'hidden' để ẩn ảnh
        firstInteraction = true;
    }
}

function handleClick(event) {
    handleFirstInteraction(); // Gọi hàm xử lý tương tác đầu tiên

    var currentTime = new Date().getTime();

    if (lastClickTime && (currentTime - lastClickTime >= 100 && currentTime - lastClickTime <= 120)) {
        score++;
        updateScoreDisplay();
        document.getElementById('text').style.opacity = 0;
    } else {
        resetScore();
    }

    createWave(event.clientX, event.clientY);
    document.body.classList.add('clicked');
    setTimeout(() => {
        document.body.classList.remove('clicked');
    }, 300);
    lastClickTime = currentTime;

    // Xử lý thông báo giọng nói đã bị xóa
}

document.getElementById('click-area').addEventListener('click', handleClick);

document.getElementById('click-area').addEventListener('contextmenu', function(event) {
    event.preventDefault();
    handleClick(event);
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'F5') {
        event.preventDefault(); // Ngăn chặn hành vi mặc định của F5
        location.reload(); // Tải lại trang
    } else if (!keydownActive) {
        handleClick({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
        keydownActive = true;
    }
});

document.addEventListener('keyup', function(event) {
    keydownActive = false;
});

// Xử lý sự kiện vuốt trên màn hình cảm ứng
document.addEventListener('touchstart', function(event) {
    handleFirstInteraction(); // Gọi hàm xử lý tương tác đầu tiên
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
});

document.addEventListener('touchmove', function(event) {
    if (touchStartY === null || touchStartX === null) {
        return;
    }

    var touchEndY = event.touches[0].clientY;
    var touchEndX = event.touches[0].clientX;

    var deltaY = touchEndY - touchStartY;
    var deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaY) > SWIPE_THRESHOLD || Math.abs(deltaX) > SWIPE_THRESHOLD) {
        location.reload(); // Tải lại trang khi vuốt đủ khoảng cách
        touchStartY = null;
        touchStartX = null;
    }
});

document.addEventListener('touchend', function() {
    touchStartY = null;
    touchStartX = null;
});

// Thêm sự kiện click/tap vào chính container ảnh để ẩn nó
introImageContainer.addEventListener('click', handleFirstInteraction);
