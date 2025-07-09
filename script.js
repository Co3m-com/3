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

var DOT_RATIO_TO_FONT_HEIGHT = 0.3;
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT_PER_MS = 0.03 / 16;
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8;

var DESIRED_JUMP_HEIGHT_RATIO_TO_RED_DOT_HEIGHT = 1.0;
var GRAVITY_RATIO_TO_RED_DOT_HEIGHT_PER_MS_SQUARED = 0.025 / (16 * 16);

var moveSpeedPxPerMs;
var actualJumpHeightPx;
var gravityPxPerMsSquared;
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

var jumpScheduled = false;
var autoJumpTimeoutId = null;

// THÊM MỚI: Biến để lưu trữ thông tin về chướng ngại vật đã va chạm
var lastCollidedObstacleInfo = null;

function adjustFontSize() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var desiredWidthVW = 18 * 5.6;
    var desiredWidthPx = (desiredWidthVW / 100) * viewportWidth;

    var TEST_FONT_SIZE = 100;

    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';

    var testDotSizePx = TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = testDotDotSizePx + 'px';
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

    var redDotActualHeight = redDotStatic.offsetHeight;
    var redDotActualWidth = redDotStatic.offsetWidth;

    moveSpeedPxPerMs = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT_PER_MS;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

    actualJumpHeightPx = redDotActualHeight * DESIRED_JUMP_HEIGHT_RATIO_TO_RED_DOT_HEIGHT;
    gravityPxPerMsSquared = redDotActualHeight * GRAVITY_RATIO_TO_RED_DOT_HEIGHT_PER_MS_SQUARED;

    jumpVelocity = -Math.sqrt(2 * gravityPxPerMsSquared * actualJumpHeightPx);
}

function renderBlueDot() {
    blueDotMoving.style.left = blueDotX + 'px';
    blueDotMoving.style.top = blueDotY + 'px';
}

function moveBlueDot(deltaTime) {
    blueDotX += moveSpeedPxPerMs * blueDotDirection * deltaTime;

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
        // jumpVelocity được tính lại mỗi khi nhảy (đảm bảo nó đúng với các tham số hiện tại)
        jumpVelocity = -Math.sqrt(2 * gravityPxPerMsSquared * actualJumpHeightPx);

        // THÊM MỚI: Điều chỉnh vị trí X của chấm xanh ngay trước khi nhảy
        // để đảm bảo nó ở vị trí thuận lợi nhất để nhảy qua chướng ngại vật
        if (lastCollidedObstacleInfo) {
            var redDotLeft = lastCollidedObstacleInfo.left;
            var redDotRight = lastCollidedObstacleInfo.right;
            var blueDotWidth = blueDotMoving.offsetWidth;

            // Nếu blueDot bị bật sang trái của chướng ngại vật
            if (blueDotX + blueDotWidth / 2 < redDotLeft + (redDotRight - redDotLeft) / 2) {
                // Đặt blueDot ở vị trí ngay trước chướng ngại vật
                blueDotX = redDotLeft - blueDotWidth - 5; // -5px để tạo khoảng cách nhỏ
            } else { // Nếu blueDot bị bật sang phải của chướng ngại vật
                // Đặt blueDot ở vị trí ngay sau chướng ngại vật (nếu hướng đi cho phép)
                blueDotX = redDotRight + 5; // +5px để tạo khoảng cách nhỏ
            }
            // Đảm bảo hướng đi khớp với vị trí mới
            if (blueDotX + blueDotWidth / 2 < redDotCenterXPx) {
                 blueDotDirection = 1; // Đi về phía chướng ngại vật
            } else {
                 blueDotDirection = -1; // Đi về phía chướng ngại vật (từ phía bên kia)
            }
            lastCollidedObstacleInfo = null; // Xóa thông tin chướng ngại vật sau khi đã sử dụng
        }
    }
}

function applyGravity(deltaTime) {
    if (isJumping) {
        blueDotY += jumpVelocity * deltaTime;
        jumpVelocity += gravityPxPerMsSquared * deltaTime;

        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocity = 0;
        }
    } else {
        var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
        blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
        blueDotY = blueDotBaseY;
    }
}

function checkCollision() {
    var redCenterX = redDotStatic.offsetLeft + (redDotStatic.offsetWidth / 2);
    var redCenterY = redDotStatic.offsetTop + (redDotStatic.offsetHeight / 2);

    var blueCenterX = blueDotX + blueDotRadiusPx;
    var blueCenterY = blueDotY + blueDotRadiusPx;

    var dx = blueCenterX - redCenterX;
    var dy = blueCenterY - redCenterY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        var overlap = minDistance - distance;
        var angle = Math.atan2(dy, dx);

        // Giữ lại logic đẩy ra để không bị đè lên
        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        // Giữ lại logic đổi hướng khi va chạm
        if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
            blueDotDirection = 1;
        } else {
            blueDotDirection = -1;
        }

        redDotStatic.style.border = '2px solid red';

        // THÊM MỚI: Lưu thông tin chướng ngại vật hiện tại
        lastCollidedObstacleInfo = {
            left: redDotStatic.offsetLeft,
            right: redDotStatic.offsetLeft + redDotStatic.offsetWidth,
            center: redDotCenterXPx
        };

        // Lập lịch nhảy sau 100ms nếu chưa nhảy và chưa có lịch nhảy
        if (!isJumping && !jumpScheduled) {
            jumpScheduled = true;
            // Xóa bất kỳ lịch nhảy nào đang chờ để tránh nhảy liên tục nếu va chạm kéo dài
            if (autoJumpTimeoutId) {
                clearTimeout(autoJumpTimeoutId);
            }
            autoJumpTimeoutId = setTimeout(function() {
                jump();
                jumpScheduled = false; // Reset sau khi nhảy được kích hoạt
                autoJumpTimeoutId = null; // Xóa ID timeout
            }, 100); // Nhảy sau 100 miligiây
        }
        return true;
    } else {
        redDotStatic.style.border = 'none';
        // Nếu không còn va chạm, hủy lịch nhảy nếu có
        if (jumpScheduled && autoJumpTimeoutId) {
            clearTimeout(autoJumpTimeoutId);
            jumpScheduled = false;
            autoJumpTimeoutId = null;
        }
        return false;
    }
}

function gameLoop(timestamp) {
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
    }
    var deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    var MAX_DELTA_TIME = 100;
    if (deltaTime > MAX_DELTA_TIME) {
        deltaTime = MAX_DELTA_TIME;
    }

    moveBlueDot(deltaTime);
    applyGravity(deltaTime);
    checkCollision();

    renderBlueDot();

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

function initializeGame() {
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (autoJumpTimeoutId) {
        clearTimeout(autoJumpTimeoutId);
        autoJumpTimeoutId = null;
    }
    jumpScheduled = false;
    lastCollidedObstacleInfo = null; // Reset thông tin chướng ngại vật

    lastTimestamp = 0;
    isJumping = false;

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

    blueDotX = redDotCenterXPx - blueDotRadiusPx;
    blueDotY = blueDotBaseY;

    renderBlueDot();

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

addEvent(window, 'load', initializeGame);
addEvent(window, 'resize', function() {
    initializeGame();
});

// Bạn có thể bỏ chú thích các sự kiện này nếu muốn người dùng vẫn có thể nhảy thủ công
// addEvent(fullscreenOverlay, 'mousedown', jump);
// addEvent(fullscreenOverlay, 'touchstart', jump);
// addEvent(window, 'keydown', function(event) {
//     if (event && event.preventDefault) {
//         event.preventDefault();
//     }
//     jump();
// });
// addEvent(window, 'contextmenu', function(event) {
//     if (event && event.preventDefault) {
//         event.preventDefault();
//     }
//     jump();
// });
