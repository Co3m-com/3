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

// NEW: Ngưỡng pixel để kích hoạt nhảy tự động
var autoJumpThreshold = 5; // Điều chỉnh giá trị này để tinh chỉnh độ nhạy

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

    var redDotActualHeight = redDotStatic.offsetHeight;

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

    // LOGIC TỰ ĐỘNG NHẢY:
    // Kích hoạt nhảy tự động nếu blueDot gần redDot và không đang nhảy
    var blueDotCenter = blueDotX + blueDotRadiusPx;
    var redDotCenter = redDotCenterXPx;
    var distanceToRedDotCenter = Math.abs(blueDotCenter - redDotCenter);

    if (!isJumping && distanceToRedDotCenter < autoJumpThreshold) {
        jump(); // Tự động gọi hàm nhảy
    }

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

// ** Đã comment out các event listener cũ để ưu tiên tự động nhảy **
// Nếu bạn muốn bật lại, hãy bỏ comment các dòng này:
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

addEvent(window, 'resize', function() {
    initializeGame();
});
