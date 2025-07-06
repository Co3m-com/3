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

// --- CÁC HẰNG SỐ CẦN ĐIỀU CHỈNH ĐỂ TINH CHỈNH ĐỘ KHÓ VÀ CẢM GIÁC GAME ---
// HƯỚNG DẪN:
// - Các giá trị này bây giờ ĐẠI DIỆN cho pixel / mili giây (hoặc pixel / mili giây^2 cho trọng lực).
// - Bạn sẽ điều chỉnh chúng TƯƠNG ỨNG với đơn vị mili giây.
// - Ví dụ:
//   - Tốc độ: Nếu bạn muốn 100 pixel/giây, thì = 100 / 1000 = 0.1 pixel/mili giây.
//   - Trọng lực: Nếu bạn muốn 9.8 pixel/giây^2, thì = 9.8 / (1000*1000) = 0.0000098 pixel/mili giây^2.
// - Chiều cao nhảy sẽ xác định VẬN TỐC nhảy ban đầu.
// - THỬ NGHIỆM trên trình duyệt hiện đại cho đến khi đạt được cảm giác mong muốn.
// - Khi đã tinh chỉnh được, cảm giác này sẽ ĐỒNG NHẤT trên mọi thiết bị.

var DOT_RATIO_TO_FONT_HEIGHT = 0.3; // Tỷ lệ kích thước chấm so với chiều cao font
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.1; // Tốc độ di chuyển ngang của chấm xanh (pixel/mili giây)
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.277; // Chiều cao nhảy mong muốn của chấm xanh (pixel)
var GRAVITY_RATIO_TO_FONT_HEIGHT = 0.000035; // Gia tốc trọng trường tác động lên chấm xanh (pixel/mili giây^2)
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8; // Giới hạn di chuyển ngang của chấm xanh so với tâm chấm đỏ

// --- THỜI GIAN CỐ ĐỊNH CHO CẬP NHẬT VẬT LÝ ---
// Đây là thời gian của một "tick" vật lý. Nên là một số nhỏ và nguyên.
// Ví dụ: 20ms tương đương 50 cập nhật vật lý mỗi giây (1000ms / 20ms = 50)
var FIXED_UPDATE_INTERVAL_MS = 20; // Mili giây cho mỗi bước cập nhật vật lý

// --- KẾT THÚC CÁC HẰNG SỐ CẦN ĐIỀU CHỈNH ---

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
var lastTimestamp = 0; // Biến để tính Delta Time tổng thể
var accumulatedTime = 0; // Thời gian tích lũy cho fixed timestep

// Biến lưu trạng thái trước đó để nội suy (interpolation)
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

    // Các giá trị này hiện tại là pixel/mili giây và pixel/mili giây^2, dựa trên các HẰNG SỐ CẦN ĐIỀU CHỈNH
    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;
}

// Hàm cập nhật vị trí thực tế của chấm xanh (không nội suy)
function updateBlueDotPositionPhysics() {
    // Không làm gì ở đây, các giá trị blueDotX, blueDotY đã được cập nhật trong moveBlueDot và applyGravity
}

// Hàm để vẽ chấm xanh lên màn hình, có thể sử dụng nội suy
function renderBlueDot(alpha) {
    // Nội suy vị trí để đảm bảo chuyển động mượt mà
    // alpha là tỷ lệ giữa thời gian tích lũy còn lại và FIXED_UPDATE_INTERVAL_MS
    var interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    var interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

    blueDotMoving.style.left = interpolatedX + 'px';
    blueDotMoving.style.top = interpolatedY + 'px';
}

// Các hàm vật lý này sẽ nhận FIXED_UPDATE_INTERVAL_MS làm delta thời gian
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
        // Công thức tính vận tốc ban đầu cho cú nhảy dựa trên trọng lực và chiều cao mong muốn
        // jumpVelocity này tính theo pixel/mili giây
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
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
    // Tính delta thời gian thực giữa các khung hình (cho đồ họa)
    var frameDeltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Giới hạn frameDeltaTime để tránh lỗi khi tab bị ẩn hoặc lag cực độ
    // (ví dụ: không cập nhật vật lý quá nhiều trong một lần)
    var MAX_FRAME_DELTA = FIXED_UPDATE_INTERVAL_MS * 5; // Giới hạn tối đa 5 bước cập nhật vật lý trong 1 khung hình
    if (frameDeltaTime > MAX_FRAME_DELTA) {
        frameDeltaTime = MAX_FRAME_DELTA;
    }

    accumulatedTime += frameDeltaTime;

    // Lưu vị trí hiện tại trước khi cập nhật vật lý (cho nội suy)
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    // Vòng lặp cập nhật vật lý với bước thời gian cố định
    while (accumulatedTime >= FIXED_UPDATE_INTERVAL_MS) {
        moveBlueDotFixed(FIXED_UPDATE_INTERVAL_MS);
        applyGravityFixed(FIXED_UPDATE_INTERVAL_MS);
        checkCollision(); // Kiểm tra va chạm sau mỗi bước vật lý
        accumulatedTime -= FIXED_UPDATE_INTERVAL_MS;
    }

    // Tính toán alpha cho nội suy
    var alpha = accumulatedTime / FIXED_UPDATE_INTERVAL_MS;
    renderBlueDot(alpha); // Vẽ chấm xanh với nội suy để chuyển động mượt mà

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

function initializeGame() {
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastTimestamp = 0; // Đặt lại lastTimestamp
    accumulatedTime = 0; // Đặt lại thời gian tích lũy

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

    // Khởi tạo prevBlueDotX/Y bằng vị trí hiện tại
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1); // Vẽ lần đầu mà không cần nội suy

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
    // Cập nhật prevBlueDotX/Y để tránh giật hình sau resize khi đang nhảy
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1); // Vẽ lại sau resize
});
