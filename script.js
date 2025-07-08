(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    var x;
    for (x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window['webkitRequestAnimationFrame'];
        window.cancelAnimationFrame =
            window['webkitCancelAnimationFrame'] || window['webkitCancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() {
                callback(currTime + timeToCall);
            },
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
    } else if (element.attachEvent) {
        element.attachEvent('on' + eventName, function(e) {
            e = e || window.event;
            e.target = e.target || e.srcElement;
            e.preventDefault = e.preventDefault || function() {
                e.returnValue = false;
            };
            e.stopPropagation = e.stopPropagation || function() {
                e.cancelBubble = true;
            };
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
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.29;
var GRAVITY_RATIO_TO_FONT_HEIGHT = 0.00003;

var FIXED_UPDATE_INTERVAL_MS = 10;

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
var accumulatedTime = 0;

var prevBlueDotX;
var prevBlueDotY;

// --- THAY ĐỔI BIẾN THỜI GIAN NHẢY ---
var JUMP_GOLDEN_TIMING_START_MS = 100; // Bắt đầu thời điểm vàng (sớm hơn tâm)
var JUMP_GOLDEN_TIMING_END_MS = 120;   // Kết thúc thời điểm vàng (sớm hơn tâm)
// Lưu ý: Chúng ta sẽ tính toán dựa trên khoảng cách từ tâm,
// nên giá trị này thực sự là khoảng cách từ tâm về phía trước.
// Nếu muốn 100ms TRƯỚC TÂM và 120ms SAU TÂM, logic sẽ khác.
// Hiện tại tôi hiểu là bạn muốn vùng từ 100ms đến 120ms (tính từ tâm) để nhảy.

// Nếu bạn muốn 100ms trước tâm, và 120ms sau tâm, vui lòng cho tôi biết.
// Hiện tại, tôi đang giả định thời điểm vàng là khi blue dot còn cách tâm 100-120ms (trên đường di chuyển tới tâm).
// --- KẾT THÚC THAY ĐỔI ---

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
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;
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
        // Tính toán vị trí tâm của blue dot và red dot
        var blueDotCenter = blueDotX + blueDotRadiusPx;
        var redDotCenter = redDotStatic.offsetLeft + redDotRadiusPx;

        // Tính toán khoảng cách (theo chiều ngang) từ tâm blue dot đến tâm red dot
        var distanceToRedDotCenter = redDotCenter - blueDotCenter; // Khoảng cách dương nếu blue dot ở bên trái red dot

        // Chuyển đổi khoảng cách pixel sang thời gian (ms)
        // moveSpeedPx là pixels/FIXED_UPDATE_INTERVAL_MS.
        // Tức là, moveSpeedPx / FIXED_UPDATE_INTERVAL_MS là pixels/ms
        var speedPxPerMs = moveSpeedPx / FIXED_UPDATE_INTERVAL_MS;

        // Thời gian để blue dot đến tâm red dot từ vị trí hiện tại
        // Đảm bảo speedPxPerMs không phải là 0 để tránh chia cho 0
        if (speedPxPerMs === 0) {
            console.log("Error: speedPxPerMs is zero, cannot calculate jump timing.");
            redDotStatic.style.border = '2px solid black'; // Báo lỗi hoặc trạng thái không thể nhảy
            return;
        }

        var timeToRedDotCenterMs = distanceToRedDotCenter / speedPxPerMs;

        // Kiểm tra xem thời gian còn lại để đến tâm red dot có nằm trong "thời điểm vàng" không
        // Giả sử blueDotDirection = 1 (đi từ trái sang phải)
        var isWithinGoldenTiming = false;

        // Nếu blue dot đang di chuyển về phía red dot (từ trái sang phải hoặc từ phải sang trái)
        // và đang trong khoảng thời gian vàng để bấm nhảy
        if (blueDotDirection === 1) { // Blue dot đang di chuyển từ trái sang phải
            // Thời điểm vàng là khi blue dot còn cách tâm từ 100ms đến 120ms về phía trái của tâm red dot.
            if (timeToRedDotCenterMs >= JUMP_GOLDEN_TIMING_START_MS && timeToRedDotCenterMs <= JUMP_GOLDEN_TIMING_END_MS) {
                isWithinGoldenTiming = true;
            }
        } else { // Blue dot đang di chuyển từ phải sang trái
            // Thời điểm vàng là khi blue dot còn cách tâm từ -120ms đến -100ms (tức là 120ms đến 100ms về phía phải của tâm red dot).
            if (timeToRedDotCenterMs <= -JUMP_GOLDEN_TIMING_START_MS && timeToRedDotCenterMs >= -JUMP_GOLDEN_TIMING_END_MS) {
                isWithinGoldenTiming = true;
            }
        }


        if (isWithinGoldenTiming) {
            isJumping = true;
            jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
            redDotStatic.style.border = '2px solid gold'; // Phản hồi trực quan cho cú nhảy thành công
            console.log("Golden Jump! Time to center:", timeToRedDotCenterMs.toFixed(2), "ms");
        } else {
            console.log("Jump attempt outside golden timing. No jump. Time to center:", timeToRedDotCenterMs.toFixed(2), "ms");
            redDotStatic.style.border = '2px solid red'; // Phản hồi trực quan cho cú nhảy thất bại
            // Reset border sau một thời gian ngắn để người chơi biết mình đã thất bại
            setTimeout(() => {
                redDotStatic.style.border = 'none';
            }, 300);
        }
    }
}

function applyGravityFixed(fixedDeltaTime) {
    if (isJumping) {
        blueDotY += jumpVelocity * fixedDeltaTime;
        jumpVelocity += gravityPx * fixedDeltaTime;

        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocity = 0;
            redDotStatic.style.border = 'none'; // Đặt lại viền sau khi hạ cánh
        }
    } else {
        var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
        blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
        blueDotY = blueDotBaseY;
    }
}

function checkCollision() {
    // Logic va chạm vật lý vẫn giữ nguyên, nhưng logic nhảy được quyết định ở hàm `jump()`
    var redCenterX = redDotStatic.offsetLeft + (redDotStatic.offsetWidth / 2);
    var redCenterY = redDotStatic.offsetTop + (redDotStatic.offsetHeight / 2);

    var blueCenterX = blueDotX + blueDotRadiusPx;
    var blueCenterY = blueDotY + blueDotRadiusPx;

    var dx = blueCenterX - redCenterX;
    var dy = blueCenterY - redCenterY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        // Đây là va chạm vật lý, không nhất thiết là cú nhảy thất bại nếu đã nhảy thành công
        var overlap = minDistance - distance;
        var angle = Math.atan2(dy, dx);

        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
            blueDotDirection = 1;
        } else {
            blueDotDirection = -1;
        }
        return true;
    }
    return false;
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
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);
});
