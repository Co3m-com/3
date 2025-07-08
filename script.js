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

// --- Các hằng số gốc của game (thiết kế trên một màn hình tham chiếu) ---
// Đơn vị: pixel cho kích thước, pixel/giây cho tốc độ, pixel/giây^2 cho gia tốc
var BASE_DOT_SIZE = 30; // Kích thước chấm cơ bản (ví dụ: 30px)

// Các thông số điều chỉnh độ khó nhảy so với kích thước chấm
// Ví dụ: JUMP_HEIGHT_MULTIPLIER = 3 nghĩa là chiều cao nhảy sẽ gấp 3 lần kích thước chấm.
var JUMP_HEIGHT_MULTIPLIER = 3.5; // Chiều cao nhảy mong muốn (gấp X lần kích thước chấm)
var GRAVITY_SCALER = 2.0; // Gia tốc trọng trường (tỉ lệ với chiều cao nhảy và tốc độ)
                          // Điều chỉnh giá trị này để thay đổi cảm giác rơi.
                          // Giá trị lớn hơn => rơi nhanh hơn, khó giữ trên không.

var BASE_MOVE_SPEED = 200; // Tốc độ di chuyển ngang cơ bản (ví dụ: 200px/giây)
var BASE_MOVEMENT_LIMIT = 300; // Giới hạn di chuyển ngang từ tâm (ví dụ: 300px)


// --- Tỉ lệ khung hình thiết kế của game ---
// Đặt tỉ lệ này phù hợp với tỉ lệ khung hình mà bạn muốn game hiển thị tốt nhất.
// Ví dụ: 1600x900 cho màn hình ngang phổ biến (16:9), hoặc 900x1600 cho màn hình dọc.
// Chọn một tỉ lệ cố định để đảm bảo sự đồng nhất.
var GAME_DESIGN_WIDTH = 1600; 
var GAME_DESIGN_HEIGHT = 900; 

// Đặt FIXED_UPDATE_INTERVAL_MS thành khoảng 16.67ms (60 FPS) để cân bằng hiệu suất và độ chính xác
var FIXED_UPDATE_INTERVAL_MS = 1000 / 60; 

var moveSpeedPx;
var actualJumpHeightPx;
var gravityPx;
var movementLimitPx;
var currentFontSizePx; // Dùng để điều chỉnh kích thước text hiển thị

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

// Hàm điều chỉnh kích thước và các thông số game dựa trên tỉ lệ màn hình
function adjustGameScale() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    // Tính toán scaleFactor để game vừa vặn nhất có thể mà vẫn giữ tỉ lệ.
    // Sử dụng Math.min để đảm bảo game luôn hiển thị đầy đủ, không bị cắt.
    var scaleFactor = Math.min(viewportWidth / GAME_DESIGN_WIDTH, viewportHeight / GAME_DESIGN_HEIGHT);

    // Áp dụng scaleFactor cho font size (nếu bạn muốn font cũng thay đổi theo tỉ lệ game)
    // Ví dụ: font size 50px trên màn hình thiết kế 1600px
    currentFontSizePx = 50 * scaleFactor; 

    co3mText.style.fontSize = currentFontSizePx + 'px';
    comText.style.fontSize = currentFontSizePx + 'px';

    // --- Tính toán kích thước chấm và sau đó chiều cao nhảy, trọng lực dựa trên đó ---
    var dotSizePx = BASE_DOT_SIZE * scaleFactor;
    redDotStatic.style.width = dotSizePx + 'px';
    redDotStatic.style.height = dotSizePx + 'px';
    blueDotMoving.style.width = dotSizePx + 'px';
    blueDotMoving.style.height = dotSizePx + 'px';

    // Chiều cao nhảy và trọng lực được tính toán dựa trên kích thước chấm đã được tỉ lệ
    actualJumpHeightPx = dotSizePx * JUMP_HEIGHT_MULTIPLIER;
    // Trọng lực có thể tính dựa trên chiều cao nhảy mong muốn.
    // Công thức: v^2 = 2 * g * h => g = v^2 / (2 * h) hoặc g = 2 * h / t^2
    // Để giữ cảm giác nhảy đồng nhất, chúng ta muốn có một tỷ lệ cố định giữa chiều cao nhảy và gia tốc.
    // GRAVITY_SCALER điều chỉnh độ "nặng" của trọng lực so với chiều cao nhảy.
    // Ví dụ: GRAVITY_SCALER = 2.0 có nghĩa là thời gian rơi sẽ được điều chỉnh để phù hợp với chiều cao.
    gravityPx = actualJumpHeightPx * GRAVITY_SCALER; // Điều chỉnh GRAVITY_SCALER để tinh chỉnh.

    // Áp dụng scaleFactor cho tốc độ và giới hạn di chuyển
    moveSpeedPx = BASE_MOVE_SPEED * scaleFactor;
    movementLimitPx = BASE_MOVEMENT_LIMIT * scaleFactor;

    // --- Cập nhật các ranh giới và vị trí ban đầu của chấm ---
    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    // Điều chỉnh vị trí chấm xanh nếu game đang chạy và bị tràn ra ngoài giới hạn
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
        // blueDotY sẽ tự động được điều chỉnh bởi logic trọng lực trong gameLoop
    }
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1); // Render ngay lập tức sau khi thay đổi tỉ lệ
}


function renderBlueDot(alpha) {
    var interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    var interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

    blueDotMoving.style.left = interpolatedX + 'px';
    blueDotMoving.style.top = interpolatedY + 'px';
}

function moveBlueDotFixed(fixedDeltaTime) {
    // Chia fixedDeltaTime cho 1000 để chuyển từ miligiay sang giây
    blueDotX += moveSpeedPx * blueDotDirection * (fixedDeltaTime / 1000); 

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
        // jumpVelocity được tính theo px/giây
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
    }
}

function applyGravityFixed(fixedDeltaTime) {
    if (isJumping) {
        // Chia fixedDeltaTime cho 1000 để chuyển từ miligiay sang giây
        blueDotY += jumpVelocity * (fixedDeltaTime / 1000); 
        jumpVelocity += gravityPx * (fixedDeltaTime / 1000); 

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

    adjustGameScale(); // Gọi hàm điều chỉnh tỉ lệ mới

    // Vị trí ban đầu của blueDotX cần được đặt lại dựa trên redDotCenterXPx sau khi scale
    blueDotX = redDotCenterXPx - blueDotRadiusPx; // Đặt blueDot ở giữa redDot ban đầu
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

var resizeTimeout;
addEvent(window, 'resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        adjustGameScale(); // Gọi hàm điều chỉnh tỉ lệ mới
    }, 200); // Đợi 200ms sau khi resize dừng lại
});
