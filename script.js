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
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.002;
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8;

// Các hằng số mới để điều chỉnh chiều cao nhảy và trọng lực dựa trên chấm đỏ
var JUMP_HEIGHT_MULTIPLIER_OF_RED_DOT = 1.0; // Chiều cao nhảy gấp 2 lần đường kính chấm đỏ
var TIME_TO_PEAK_JUMP_MS = 120; // Thời gian mong muốn để đạt đến đỉnh nhảy (miligiây)

var FIXED_UPDATE_INTERVAL_MS = 10;

var moveSpeedPx;
var actualJumpHeightPx;
var gravityPx; // Sẽ được tính toán động
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
var accumulatedTime = 0;

var prevBlueDotX;
var prevBlueDotY;

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

    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

    // Tính toán lại actualJumpHeightPx và gravityPx dựa trên kích thước chấm đỏ
    // Đảm bảo redDotStatic đã có kích thước trước khi tính
    var redDotDiameter = redDotStatic.offsetWidth; // Lấy đường kính của chấm đỏ
    actualJumpHeightPx = redDotDiameter * JUMP_HEIGHT_MULTIPLIER_OF_RED_DOT;

    // Tính toán trọng lực dựa trên chiều cao nhảy mong muốn và thời gian lên đỉnh
    // Công thức: h = 0.5 * g * t^2 => g = 2 * h / t^2 (đơn vị: px/s^2)
    var timeToPeakSeconds = TIME_TO_PEAK_JUMP_MS / 1000; // Đổi miligiây sang giây
    gravityPx = (2 * actualJumpHeightPx) / (timeToPeakSeconds * timeToPeakSeconds);

    // Điều chỉnh gravityPx để phù hợp với đơn vị FIXED_UPDATE_INTERVAL_MS (px/ms^2)
    // gravityPx ban đầu là px/s^2, cần chia cho (1000ms/s)^2
    gravityPx = gravityPx / (1000 * 1000);
}

function renderBlueDot(alpha) {
    var interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    var interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

    blueDotMoving.style.left = interpolatedX + 'px';
    blueDotMoving.style.top = interpolatedY + 'px';
}

function moveBlueDotFixed(fixedDeltaTime) {
    blueDotX += moveSpeedPx * blueDotDirection * fixedDeltaTime;

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
        // jumpVelocity sẽ âm để đi lên
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
    }
}

function applyGravityFixed(fixedDeltaTime) {
    // Luôn cập nhật blueDotBaseY để đảm bảo nó ở đúng vị trí trên chấm đỏ
    // khi chấm đỏ thay đổi kích thước/vị trí (ví dụ, khi resize)
    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    if (isJumping) {
        blueDotY += jumpVelocity * fixedDeltaTime;
        jumpVelocity += gravityPx * fixedDeltaTime;

        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocity = 0;
        }
    } else {
        // Đảm bảo chấm xanh luôn nằm trên chấm đỏ khi không nhảy
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
    var frameDeltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    var MAX_FRAME_DELTA = FIXED_UPDATE_INTERVAL_MS * 5;
    if (frameDeltaTime > MAX_FRAME_DELTA) {
        frameDeltaTime = MAX_FRAME_DELTA;
    }

    accumulatedTime += frameDeltaTime;

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    while (accumulatedTime >= FIXED_UPDATE_INTERVAL_MS) {
        moveBlueDotFixed(FIXED_UPDATE_INTERVAL_MS);
        applyGravityFixed(FIXED_UPDATE_INTERVAL_MS);
        checkCollision();
        accumulatedTime -= FIXED_UPDATE_INTERVAL_MS;
    }

    var alpha = accumulatedTime / FIXED_UPDATE_INTERVAL_MS;
    renderBlueDot(alpha);

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

function initializeGame() {
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastTimestamp = 0;
    accumulatedTime = 0;

    adjustFontSize(); // Gọi adjustFontSize trước để đảm bảo kích thước các chấm đã được thiết lập

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

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);

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
    adjustFontSize(); // Điều chỉnh kích thước font và các thành phần

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    // Cập nhật lại blueDotBaseY sau khi resize
    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    if (!isJumping) {
        // Đảm bảo blueDotX vẫn nằm trong giới hạn mới
        if (blueDotX > rightBoundaryPx) {
            blueDotX = rightBoundaryPx;
        } else if (blueDotX < leftBoundaryPx) {
            blueDotX = leftBoundaryPx;
        }
        blueDotY = blueDotBaseY; // Đặt lại vị trí Y nếu không nhảy
    } else {
        // Nếu đang nhảy, chỉ cập nhật giới hạn X
        if (blueDotX > rightBoundaryPx) {
            blueDotX = rightBoundaryPx;
        } else if (blueDotX < leftBoundaryPx) {
            blueDotX = leftBoundaryPx;
        }
        // Vị trí Y sẽ tự điều chỉnh bởi trọng lực
    }
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);
});
