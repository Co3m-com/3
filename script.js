(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    var x;
    for(x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window['webkitRequestAnimationFrame'];
        window.cancelAnimationFrame =
          window['webkitCancelAnimationFrame'] || window['webkitCancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());

function addEvent(element, eventName, callback) {
    if (element.addEventListener) {
        element.addEventListener(eventName, callback, false);
    }
    else if (element.attachEvent) {
        element.attachEvent('on' + eventName, function(e) {
            e = e || window.event;
            e.target = e.target || e.srcElement;
            e.preventDefault = e.preventDefault || function() { e.returnValue = false; };
            e.stopPropagation = e.stopPropagation || function() { e.cancelBubble = true; };
            callback.call(element, e);
        });
    }
}

var textContainer = document.getElementById('co3m-text').parentNode;
var co3mText = document.getElementById('co3m-text');
var comText = document.getElementById('com-text');
var redDotStatic = document.getElementById('red-dot-static-id');
var blueDotMoving = document.getElementById('blue-dot-moving-id');
var fullscreenOverlay = document.getElementsByClassName('fullscreen-overlay')[0];

var blueDotX;
var blueDotY;
var blueDotDirection = 1;

// --- CÁC THÔNG SỐ GAME CẦN ĐIỀU CHỈNH ---
// HƯỚNG DẪN:
// - TRỌNG LỰC VÀ NHẢY: Các giá trị này tính theo PIXEL / GIÂY (hoặc PIXEL / GIÂY^2).
//   Đây là phần mà bạn muốn giữ cảm giác "đẹp, chậm, dễ nhìn" của code cũ.
// - TỐC ĐỘ DI CHUYỂN: Giá trị này tính theo PIXEL / MILI GIÂY.
//   Bạn có thể tinh chỉnh tốc độ di chuyển ngang rất chính xác ở đây.

var DOT_RATIO_TO_FONT_HEIGHT = 0.3; // Tỷ lệ kích thước chấm so với chiều cao font

// NHẢY VÀ TRỌNG LỰC: Cảm giác như code cũ bạn thích (sử dụng Delta Time tính bằng GIÂY)
// Tăng DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT để nhảy cao hơn
// Tăng GRAVITY_RATIO_TO_FONT_HEIGHT để rơi nhanh hơn (giảm giá trị này để rơi chậm hơn)
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.3; // Chiều cao nhảy mong muốn (pixel)
var GRAVITY_RATIO_TO_FONT_HEIGHT = 33; // Gia tốc trọng trường (pixel/giây^2)

// TỐC ĐỘ DI CHUYỂN NGANG: Tinh chỉnh chính xác (sử dụng Delta Time tính bằng MILI GIÂY)
// Giảm giá trị này để chấm xanh di chuyển CHẬM HƠN
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.003; // Tốc độ di chuyển ngang (pixel/mili giây)
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8; // Giới hạn di chuyển ngang

// --- KẾT THÚC CÁC THÔNG SỐ CẦN ĐIỀU CHỈNH ---

var moveSpeedPx;
var actualJumpHeightPx;
var gravityPx;
var movementLimitPx;
var currentFontSizePx;

var isJumping = false;
var jumpVelocity = 0;
var blueDotBaseY;

var redDotRadiusPx;
var blueDotRadiusPx;

var redDotCenterXPx;
var leftBoundaryPx;
var rightBoundaryPx;

var animationFrameId = null;
var lastTimestamp = 0;

function adjustFontSize() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var desiredWidthVW = 18 * 5.6;
    var desiredWidthPx = (desiredWidthVW / 100) * viewportWidth;

    var TEST_FONT_SIZE = 100;

    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';

    var testDotSizePx = TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = testDotSizePx + 'px';
    redDotStatic.style.height = testDotSizePx + 'px';

    var textContainerWidthAtTestSize = textContainer.offsetWidth;

    if (textContainerWidthAtTestSize === 0) {
         textContainerWidthAtTestSize = 1;
    }

    var newFontSize = TEST_FONT_SIZE * (desiredWidthPx / textContainerWidthAtTestSize);

    var MIN_FONT_SIZE = 20;
    var MAX_FONT_SIZE = 3000;
    newFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    currentFontSizePx = newFontSize;

    co3mText.style.fontSize = currentFontSizePx + 'px';
    comText.style.fontSize = currentFontSizePx + 'px';

    var dotSizePx = currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = dotSizePx + 'px';
    redDotStatic.style.height = dotSizePx + 'px';
    blueDotMoving.style.width = dotSizePx + 'px';
    blueDotMoving.style.height = dotSizePx + 'px';

    // Cập nhật các thông số vật lý theo font size mới
    // Tốc độ di chuyển ngang (pixel/mili giây)
    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    // Chiều cao nhảy và trọng lực (pixel/giây và pixel/giây^2)
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;
}

function updateBlueDotPosition() {
    blueDotMoving.style.left = blueDotX + 'px';
    blueDotMoving.style.top = blueDotY + 'px';
}

function moveBlueDot(deltaTimeMilliseconds) {
    // Vận tốc nhân với deltaTimeMilliseconds (tính bằng mili giây)
    blueDotX += moveSpeedPx * blueDotDirection * deltaTimeMilliseconds;

    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx;
        blueDotDirection *= -1;
    } else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx;
        blueDotDirection *= -1;
    }
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        // Công thức tính vận tốc ban đầu cho cú nhảy dựa trên trọng lực và chiều cao mong muốn
        // Vận tốc này tính theo pixel/giây
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
    }
}

function applyGravity(deltaTimeSeconds) {
    if (isJumping) {
        // Cập nhật vị trí dựa trên vận tốc và deltaTimeSeconds (tính bằng giây)
        blueDotY += jumpVelocity * deltaTimeSeconds;
        // Cập nhật vận tốc dựa trên gia tốc trọng trường và deltaTimeSeconds (tính bằng giây)
        jumpVelocity += gravityPx * deltaTimeSeconds;

        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocity = 0;
        }
    } else {
        // Đảm bảo chấm xanh luôn nằm trên mặt đất khi không nhảy
        var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
        blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
        blueDotY = blueDotBaseY;
    }
}

function checkCollision() {
    var redCenterX = redDotStatic.offsetLeft + (redDotStatic.offsetWidth / 2);
    var redCenterY = redDotStatic.offsetTop + (redDotStatic.offsetHeight / 2);

    var dx = blueDotX + blueDotRadiusPx - redCenterX;
    var dy = blueDotY + blueDotRadiusPx - redCenterY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        var overlap = minDistance - distance;
        var angle = Math.atan2(dy, dx);

        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
            blueDotDirection = 1;
        } else {
            blueDotDirection = -1;
        }

        redDotStatic.style.border = '2px solid red'; // Hiệu ứng va chạm
        return true;
    } else {
        redDotStatic.style.border = 'none';
        return false;
    }
}

function gameLoop(timestamp) {
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
    }
    // Delta time tính bằng mili giây (cho di chuyển ngang)
    var deltaTimeMilliseconds = (timestamp - lastTimestamp);
    // Delta time tính bằng giây (cho nhảy và trọng lực)
    var deltaTimeSeconds = deltaTimeMilliseconds / 1000;
    lastTimestamp = timestamp;

    // Di chuyển ngang sử dụng deltaTimeMilliseconds
    moveBlueDot(deltaTimeMilliseconds);
    // Trọng lực và nhảy sử dụng deltaTimeSeconds
    applyGravity(deltaTimeSeconds);
    
    checkCollision();
    updateBlueDotPosition();
    animationFrameId = window.requestAnimationFrame(gameLoop);
}

function initializeGame() {
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastTimestamp = 0; // Đặt lại lastTimestamp khi khởi tạo game

    adjustFontSize();

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();

    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    blueDotX = redDotCenterXPx + redDotRadiusPx;
    blueDotY = blueDotBaseY;

    updateBlueDotPosition();
    animationFrameId = window.requestAnimationFrame(gameLoop);
}

addEvent(window, 'load', initializeGame);

addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);

addEvent(window, 'keydown', function(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    jump();
});

addEvent(window, 'contextmenu', function(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    jump();
});

addEvent(window, 'resize', function() {
    adjustFontSize();

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    if (!isJumping) {
        if (blueDotX > rightBoundaryPx) {
            blueDotX = rightBoundaryPx;
        } else if (blueDotX < leftBoundaryPx) {
            blueDotX = leftBoundaryPx;
        }
        blueDotY = blueDotBaseY;
    } else {
        if (blueDotX > rightBoundaryPx) {
            blueDotX = rightBoundaryPx;
        } else if (blueDotX < leftBoundaryPx) {
            blueDotX = leftBoundaryPx;
        }
    }
    updateBlueDotPosition();
});
