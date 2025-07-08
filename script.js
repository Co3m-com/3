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

// --- THAY ĐỔI CÁCH TÍNH TOÁN ĐỘ CAO VÀ TRỌNG LỰC ---
// Không còn các biến hằng số DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT và GRAVITY_RATIO_TO_FONT_HEIGHT ở đây nữa
// Chúng sẽ được tính toán dựa trên thời gian vàng
// --- KẾT THÚC THAY ĐỔI ---

var FIXED_UPDATE_INTERVAL_MS = 10;

var moveSpeedPx;
var actualJumpHeightPx; // Sẽ được tính toán động
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

// --- BIẾN THỜI GIAN VÀNG (CÓ THỂ ĐIỀU CHỈNH ĐỂ THAY ĐỔI ĐỘ CAO) ---
var GOLDEN_TIMING_MIN_MS = 40; // Thời gian tối thiểu còn lại để đến chướng ngại vật
var GOLDEN_TIMING_MAX_MS = 50; // Thời gian tối đa còn lại để đến chướng ngại vật

// Hệ số điều chỉnh cho độ cao và trọng lực dựa trên thời điểm vàng.
// Bạn có thể điều chỉnh các hệ số này để tìm được cảm giác nhảy phù hợp.
// Đây là các giá trị thử nghiệm, có thể cần tinh chỉnh thêm.
var JUMP_HEIGHT_FACTOR = 0.0003; // Điều chỉnh độ cao nhảy tổng thể
var GRAVITY_FACTOR = 0.0000008; // Điều chỉnh trọng lực tổng thể
// --- KẾT THÚC BIẾN THỜI GIAN VÀNG ---


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

    // --- TÍNH TOÁN ĐỘ CAO VÀ TRỌNG LỰC DỰA TRÊN THỜI GIAN VÀNG ---
    // Sử dụng thời gian vàng trung bình để tính toán độ cao và trọng lực cơ bản
    var averageGoldenTiming = (GOLDEN_TIMING_MIN_MS + GOLDEN_TIMING_MAX_MS) / 2;

    // Tính toán độ cao nhảy. Ví dụ: độ cao càng lớn nếu thời gian vàng càng ngắn (cần phản ứng nhanh)
    // Hoặc độ cao càng lớn nếu thời gian vàng càng dài (để có thể nhảy qua được)
    // Tôi sẽ làm cho độ cao tăng lên khi thời gian vàng nhỏ đi (để tạo thách thức hơn cho "perfect jump")
    // Hoặc bạn có thể làm độ cao tỉ lệ thuận với thời gian vàng (thời gian vàng dài -> nhảy cao hơn)
    // Hiện tại tôi sẽ làm tỉ lệ nghịch với thời gian vàng (thời gian vàng càng ngắn, nhảy càng cao để "vượt qua thử thách")
    // Nếu bạn muốn ngược lại (thời gian vàng dài -> nhảy cao), hãy cho tôi biết.
    actualJumpHeightPx = currentFontSizePx * JUMP_HEIGHT_FACTOR / averageGoldenTiming;

    // Trọng lực sẽ giảm khi thời gian vàng ngắn, hoặc tăng khi thời gian vàng dài
    gravityPx = currentFontSizePx * GRAVITY_FACTOR * averageGoldenTiming;

    // Đảm bảo các giá trị không quá nhỏ hoặc quá lớn
    var MIN_JUMP_HEIGHT_PX = currentFontSizePx * 0.2; // Chiều cao nhảy tối thiểu
    var MAX_JUMP_HEIGHT_PX = currentFontSizePx * 0.6; // Chiều cao nhảy tối đa
    var MIN_GRAVITY_PX = currentFontSizePx * 0.00001; // Trọng lực tối thiểu
    var MAX_GRAVITY_PX = currentFontSizePx * 0.00005; // Trọng lực tối đa

    actualJumpHeightPx = Math.max(MIN_JUMP_HEIGHT_PX, Math.min(MAX_JUMP_HEIGHT_PX, actualJumpHeightPx));
    gravityPx = Math.max(MIN_GRAVITY_PX, Math.min(MAX_GRAVITY_PX, gravityPx));

    console.log("Cập nhật: Chiều cao nhảy (px):", actualJumpHeightPx.toFixed(2), "Trọng lực (px):", gravityPx.toFixed(6));

    // --- KẾT THÚC TÍNH TOÁN ---
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
        var blueDotCenter = blueDotX + blueDotRadiusPx;
        var redDotCenter = redDotStatic.offsetLeft + redDotRadiusPx;

        var distanceToRedDotCenter = redDotCenter - blueDotCenter;
        var speedPxPerMs = moveSpeedPx / FIXED_UPDATE_INTERVAL_MS;

        if (speedPxPerMs === 0) {
            console.log("Lỗi: Tốc độ bằng 0, không thể tính thời gian nhảy.");
            redDotStatic.style.border = '2px solid black';
            return;
        }

        var timeToRedDotCenterMs = distanceToRedDotCenter / speedPxPerMs;

        let isGoldenTiming = false;

        if (blueDotDirection === 1) { // Blue dot đang di chuyển từ trái sang phải
            if (timeToRedDotCenterMs >= GOLDEN_TIMING_MIN_MS && timeToRedDotCenterMs <= GOLDEN_TIMING_MAX_MS) {
                isGoldenTiming = true;
            }
        } else { // Blue dot đang di chuyển từ phải sang trái
            if (timeToRedDotCenterMs <= -GOLDEN_TIMING_MIN_MS && timeToRedDotCenterMs >= -GOLDEN_TIMING_MAX_MS) {
                isGoldenTiming = true;
            }
        }

        isJumping = true;
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);

        if (isGoldenTiming) {
            redDotStatic.style.border = '2px solid gold';
            console.log("Golden Jump! Time to center:", timeToRedDotCenterMs.toFixed(2), "ms");
        } else {
            redDotStatic.style.border = '2px solid green';
            console.log("Normal Jump. Time to center:", timeToRedDotCenterMs.toFixed(2), "ms");
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
            redDotStatic.style.border = 'none';
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

    adjustFontSize(); // Gọi adjustFontSize để tính toán lại các thông số nhảy

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
    adjustFontSize(); // Cần gọi lại khi resize để tính toán lại các thông số nhảy

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
