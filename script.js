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
            var currTime = performance.now(); // Use performance.now() for better accuracy
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

// --- Các biến và hằng số cho Thời điểm vàng ---
// Tổng quãng đường di chuyển được quy đổi thành thời gian (200ms)
// Cần khớp với MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT
var TOTAL_MOVEMENT_TIME_MS = 200;

// Khoảng thời gian vàng mong muốn (90ms đến 110ms)
// Đây là thời gian còn lại (hoặc đã trôi qua) từ tâm chấm đỏ
var GOLDEN_JUMP_MIN_MS = 90;
var GOLDEN_JUMP_MAX_MS = 110;

// Các giá trị biên bằng pixel, sẽ được tính toán
var GOLDEN_JUMP_MIN_OFFSET_PX;
var GOLDEN_JUMP_MAX_OFFSET_PX;

var isCurrentlyInGoldenZone = false; // Theo dõi nếu chấm xanh đang ở vị trí vàng
var jumpedInGoldenZone = false; // Theo dõi nếu cú nhảy xảy ra trong vùng vàng
var lastJumpWasGolden = false; // Theo dõi kết quả của cú nhảy cuối cùng

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

    // Tính toán các ngưỡng "thời điểm vàng" bằng pixel
    GOLDEN_JUMP_MIN_OFFSET_PX = GOLDEN_JUMP_MIN_MS * moveSpeedPx;
    GOLDEN_JUMP_MAX_OFFSET_PX = GOLDEN_JUMP_MAX_MS * moveSpeedPx;
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

    // --- Cập nhật trạng thái "đang ở vùng vàng" và phản hồi viền ---
    var blueDotCenterCurrentX = blueDotX + blueDotRadiusPx;
    var distanceToRedCenter = Math.abs(blueDotCenterCurrentX - redDotCenterXPx);

    var distanceFromCenterGoldenMin = GOLDEN_JUMP_MIN_OFFSET_PX;
    var distanceFromCenterGoldenMax = GOLDEN_JUMP_MAX_OFFSET_PX;

    var newGoldenZoneStatus = (distanceToRedCenter >= distanceFromCenterGoldenMin && distanceToRedCenter <= distanceFromCenterGoldenMax);

    if (newGoldenZoneStatus !== isCurrentlyInGoldenZone) {
        isCurrentlyInGoldenZone = newGoldenZoneStatus;
        if (isCurrentlyInGoldenZone) {
            // Khi vào vùng vàng, chỉ hiển thị viền vàng nếu chưa nhảy thành công
            if (!lastJumpWasGolden) { // Chỉ hiển thị viền vàng nếu cú nhảy trước không phải là vàng
                redDotStatic.style.border = '2px solid gold';
            }
        } else {
            // Khi ra khỏi vùng vàng, chỉ bỏ viền nếu cú nhảy trước đó không phải là vàng
            if (!lastJumpWasGolden) {
                redDotStatic.style.border = 'none';
            }
        }
    }
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);

        // Kiểm tra xem cú nhảy có được thực hiện trong vùng vàng không
        if (isCurrentlyInGoldenZone) {
            lastJumpWasGolden = true; // Đánh dấu cú nhảy này là vàng
            redDotStatic.style.border = '2px solid limegreen'; // Phản hồi thành công
            console.log("Cú nhảy VÀNG!");
        } else {
            lastJumpWasGolden = false; // Đánh dấu cú nhảy này không vàng
            redDotStatic.style.border = 'none'; // Không có viền khi nhảy sai thời điểm
            console.log("Cú nhảy KHÔNG VÀNG. Trở về trạng thái ban đầu.");
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
            // Sau khi chạm đất, nếu cú nhảy trước đó không phải vàng
            // và không còn trong vùng vàng, thì reset viền về mặc định
            if (!lastJumpWasGolden && !isCurrentlyInGoldenZone) {
                redDotStatic.style.border = 'none';
            } else if (lastJumpWasGolden) {
                // Nếu là cú nhảy vàng, giữ viền xanh lá cho đến khi ra khỏi vùng vàng
                // hoặc cú nhảy tiếp theo
                // (viền sẽ bị ghi đè bởi logic moveBlueDotFixed khi ra khỏi vùng vàng
                // hoặc bởi cú nhảy mới)
            }
        }
    } else {
        var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
        blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
        blueDotY = blueDotBaseY;
    }
}

function checkCollision() {
    // Vẫn giữ lại logic va chạm gốc để kiểm tra vật lý nếu cần
    var redCenterX = redDotStatic.offsetLeft + (redDotStatic.offsetWidth / 2);
    var redCenterY = redDotStatic.offsetTop + (redDotStatic.offsetHeight / 2);

    var blueCenterX = blueDotX + blueDotRadiusPx;
    var blueCenterY = blueDotY + blueDotRadiusPx;

    var dx = blueCenterX - redCenterX;
    var dy = blueCenterY - redCenterY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
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

    isCurrentlyInGoldenZone = false;
    jumpedInGoldenZone = false;
    lastJumpWasGolden = false; // Reset trạng thái nhảy
    redDotStatic.style.border = 'none'; // Đảm bảo không có viền khi khởi tạo

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
    initializeGame();
});
