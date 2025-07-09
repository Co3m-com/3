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

// NEW: Hằng số cho chiều cao nhảy dựa trên chiều cao của chấm đỏ
// Giá trị này sẽ xác định chiều cao nhảy tính bằng "số lần chiều cao của chấm đỏ"
// Ví dụ: 1.0 nghĩa là nhảy cao bằng 1 lần chiều cao chấm đỏ
//       1.5 nghĩa là nhảy cao bằng 1.5 lần chiều cao chấm đỏ
var DESIRED_JUMP_HEIGHT_RATIO_TO_RED_DOT_HEIGHT = 1.2; // Bạn có thể điều chỉnh giá trị này

// Điều chỉnh trọng lực để phù hợp với chiều cao nhảy mới.
// GravityPxPerMsSquared cũng sẽ được tính dựa trên redDotStatic.offsetHeight
var GRAVITY_RATIO_TO_RED_DOT_HEIGHT_PER_MS_SQUARED = 0.0008 / (16 * 16); // Điều chỉnh giá trị này để tinh chỉnh trọng lực

var moveSpeedPxPerMs;
var actualJumpHeightPx;
var gravityPxPerMsSquared;
var movementLimitPx;
var currentFontSizePx; // Vẫn cần cho kích thước chấm

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

    // Tính toán lại các giá trị phụ thuộc vào kích thước thực tế của chấm đỏ sau khi nó đã được render
    // LƯU Ý: redDotStatic.offsetHeight chỉ chính xác sau khi các style đã được áp dụng và browser đã render
    // Tuy nhiên, vì adjustFontSize được gọi trong initializeGame và resize, nơi DOM đã sẵn sàng, nên nó sẽ hoạt động.
    var redDotActualHeight = redDotStatic.offsetHeight;

    moveSpeedPxPerMs = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT_PER_MS;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

    // CHỈNH SỬA: Tính toán chiều cao nhảy thực tế dựa trên chiều cao chấm đỏ
    actualJumpHeightPx = redDotActualHeight * DESIRED_JUMP_HEIGHT_RATIO_TO_RED_DOT_HEIGHT;

    // CHỈNH SỬA: Tính toán trọng lực dựa trên chiều cao chấm đỏ
    gravityPxPerMsSquared = redDotActualHeight * GRAVITY_RATIO_TO_RED_DOT_HEIGHT_PER_MS_SQUARED;

    // jumpVelocity ban đầu (đi lên là âm)
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

        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
            blueDotDirection = 1;
        } else {
            blueDotDirection = -1;
        }

        redDotStatic.style.border = '2px solid red';
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

    lastTimestamp = 0;
    isJumping = false; // Đảm bảo trạng thái nhảy được reset

    adjustFontSize(); // Tính toán lại tất cả các thông số phụ thuộc font size và kích thước chấm đỏ

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();

    // Vị trí của chấm đỏ dựa trên container của nó
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    // Đặt lại vị trí ban đầu của blueDotMoving một cách nhất quán
    blueDotX = redDotCenterXPx - blueDotRadiusPx;
    blueDotY = blueDotBaseY;

    renderBlueDot();

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
    initializeGame();
});
