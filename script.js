var score = 0;
var lastClickTime = 0; // Sử dụng 0 để lần bấm đầu tiên luôn được chấp nhận
var expectedInterval = 0; // Khoảng thời gian nhịp độ mong muốn (sẽ được xác định động)

// Các biến khác
var keydownActive = false;
var firstInteraction = false;
var touchStartY = null;
var touchStartX = null;
var SWIPE_THRESHOLD = 100;

// PHẠM VI CHẤP NHẬN ĐƯỢC: Đối xứng quanh expectedInterval.
// THAY ĐỔI TỪ 20 thành 9 để tăng dung sai. Bạn có thể thử các giá trị khác (15, 25)
const SYMMETRIC_TOLERANCE = 9; // Chấp nhận +- 9ms so với expectedInterval
                               // Tổng cộng là 18ms (expectedInterval - 9 đến expectedInterval + 9)

// Ngưỡng cho lần bấm thứ hai để xác định expectedInterval (đảm bảo nhịp độ khởi đầu hợp lý)
const MIN_INITIAL_INTERVAL = 50; 
const MAX_INITIAL_INTERVAL = 1000; 

// Lấy tham chiếu đến container ảnh
const introImageContainer = document.getElementById('intro-image-container');

function resetScore() {
    score = 0;
    updateScoreDisplay();
    document.getElementById('text').style.opacity = 1;
    lastClickTime = 0; 
    expectedInterval = 0; 
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
        introImageContainer.classList.add('hidden');
        firstInteraction = true;
    }
}

function handleClick(event) {
    handleFirstInteraction();

    var currentTime = performance.now(); 
    var timeSinceLastClick = currentTime - lastClickTime;

    if (score === 0) {
        score++;
        updateScoreDisplay();
        document.getElementById('text').style.opacity = 0;
    } else if (expectedInterval === 0) {
        if (timeSinceLastClick >= MIN_INITIAL_INTERVAL && timeSinceLastClick <= MAX_INITIAL_INTERVAL) {
            expectedInterval = timeSinceLastClick; 
            score++;
            updateScoreDisplay();
        } else {
            resetScore();
        }
    } else {
        // KIỂM TRA VỚI DUNG SAI ĐỐI XỨNG
        if (timeSinceLastClick >= (expectedInterval - SYMMETRIC_TOLERANCE) &&
            timeSinceLastClick <= (expectedInterval + SYMMETRIC_TOLERANCE)) {
            score++;
            updateScoreDisplay();
        } else {
            resetScore();
        }
    }

    createWave(event.clientX, event.clientY);
    document.body.classList.add('clicked');
    setTimeout(() => {
        document.body.classList.remove('clicked');
    }, 300);
    lastClickTime = currentTime; 
}

document.getElementById('click-area').addEventListener('click', handleClick);
document.getElementById('click-area').addEventListener('contextmenu', function(event) {
    event.preventDefault();
    handleClick(event);
});
document.addEventListener('keydown', function(event) {
    if (event.key === 'F5') {
        event.preventDefault();
        location.reload();
    } else if (!keydownActive) {
        handleClick({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
        keydownActive = true;
    }
});
document.addEventListener('keyup', function(event) {
    keydownActive = false;
});
document.addEventListener('touchstart', function(event) {
    handleFirstInteraction();
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
        location.reload();
        touchStartY = null;
        touchStartX = null;
    }
});
document.addEventListener('touchend', function() {
    touchStartY = null;
    touchStartX = null;
});
introImageContainer.addEventListener('click', handleFirstInteraction);
