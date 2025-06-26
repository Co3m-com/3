// Polyfill cho requestAnimationFrame
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

// Hàm hỗ trợ addEventListener và attachEvent
function addEvent(element, eventName, callback) {
    if (element.addEventListener) {
        element.addEventListener(eventName, callback, false);
    } else if (element.attachEvent) {
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

// Các hằng số sẽ được tính toán động dựa trên font-size
var DOT_RATIO_TO_FONT_HEIGHT = 0.3; // Dấu chấm bằng 30% chiều cao chữ
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.03; // Tốc độ di chuyển theo tỷ lệ font-size (chiều cao chữ)
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.6; // Chiều cao nhảy mong muốn theo tỷ lệ font-size (chiều cao chữ)
var GRAVITY_RATIO_TO_FONT_HEIGHT = 0.005; // Gia tốc trọng trường theo tỷ lệ font-size (chiều cao chữ)
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 2; // Giới hạn di chuyển theo tỷ lệ font-size (chiều cao chữ)

var moveSpeedPx;
var actualJumpHeightPx;
var gravityPx;
var movementLimitPx;
var currentFontSizePx; // Kích thước chữ hiện tại tính bằng pixel

var isJumping = false;
var jumpVelocity = 0;
var blueDotBaseY;

var redDotRadiusPx;
var blueDotRadiusPx;

var redDotCenterXPx;
var leftBoundaryPx;
var rightBoundaryPx;

// Hàm tính toán và áp dụng kích thước chữ mới
function adjustFontSize() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var desiredWidthVW = 18 * 3; // Gấp 3 lần 18vw = 54vw
    var desiredWidthPx = (desiredWidthVW / 100) * viewportWidth; // Chiều rộng mục tiêu bằng pixel

    // Để đo chiều rộng của văn bản một cách chính xác, chúng ta cần đặt một font-size chuẩn
    // và sau đó tính toán tỷ lệ.
    var TEST_FONT_SIZE = 100; // Đặt font-size tạm thời là 100px để đo

    // Lưu trạng thái hiện tại để khôi phục sau
    // (Lưu ý: CSS đã có font-size mặc định 50px, nên originalCo3mFontSize/ComFontSize có thể sẽ là rỗng nếu chưa bị JS ghi đè)
    var originalCo3mFontSize = co3mText.style.fontSize;
    var originalComFontSize = comText.style.fontSize;
    var originalRedDotWidth = redDotStatic.style.width;
    var originalRedDotHeight = redDotStatic.style.height;

    // Áp dụng font-size TEST_FONT_SIZE tạm thời cho văn bản
    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';

    // Đặt kích thước dấu chấm theo tỷ lệ của TEST_FONT_SIZE
    var testDotSizePx = TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = testDotSizePx + 'px';
    redDotStatic.style.height = testDotSizePx + 'px';
    // blueDotMoving không ảnh hưởng đến chiều rộng của textContainer, nên không cần đặt ở đây

    // Đo chiều rộng của toàn bộ textContainer với font-size TEST_FONT_SIZE
    var textContainerWidthAtTestSize = textContainer.offsetWidth;

    // Khôi phục lại trạng thái ban đầu của font-size và kích thước chấm
    // (Điều này có thể không cần thiết nếu bạn đặt 50px cố định trong CSS và JS sẽ tính lại ngay)
    co3mText.style.fontSize = originalCo3mFontSize; // Sẽ đặt lại là rỗng hoặc giá trị cũ
    comText.style.fontSize = originalComFontSize;   // Sẽ đặt lại là rỗng hoặc giá trị cũ
    redDotStatic.style.width = originalRedDotWidth;
    redDotStatic.style.height = originalRedDotHeight;


    // Nếu textContainerWidthAtTestSize bằng 0 hoặc quá nhỏ, tránh chia cho 0
    if (textContainerWidthAtTestSize === 0) {
         textContainerWidthAtTestSize = 1; // Fallback an toàn
    }

    // Tính toán font-size mới cần thiết để đạt desiredWidthPx
    var newFontSize = TEST_FONT_SIZE * (desiredWidthPx / textContainerWidthAtTestSize);

    // Giới hạn kích thước chữ tối đa/tối thiểu
    var MIN_FONT_SIZE = 20;
    var MAX_FONT_SIZE = 300;
    newFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    currentFontSizePx = newFontSize; // Lưu lại kích thước chữ hiện tại

    // Áp dụng font-size mới
    co3mText.style.fontSize = currentFontSizePx + 'px';
    comText.style.fontSize = currentFontSizePx + 'px';

    // Tính toán lại kích thước dấu chấm dựa trên font-size đã tính toán
    var dotSizePx = currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = dotSizePx + 'px';
    redDotStatic.style.height = dotSizePx + 'px';
    blueDotMoving.style.width = dotSizePx + 'px';
    blueDotMoving.style.height = dotSizePx + 'px';

    // Tính toán lại các hằng số chuyển động dựa trên font-size
    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;
}

function updateBlueDotPosition() {
    blueDotMoving.style.left = blueDotX + 'px';
    blueDotMoving.style.top = blueDotY + 'px';
}

function moveBlueDot() {
    blueDotX += moveSpeedPx * blueDotDirection;

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
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
    }
}

function applyGravity() {
    if (isJumping) {
        blueDotY += jumpVelocity;
        jumpVelocity += gravityPx;

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

        redDotStatic.style.border = '2px solid red';
        return true;
    } else {
        redDotStatic.style.border = 'none';
        return false;
    }
}

function gameLoop() {
    moveBlueDot();
    applyGravity();
    checkCollision();
    updateBlueDotPosition();
    window.requestAnimationFrame(gameLoop);
}

function initializeGame() {
    adjustFontSize(); // Tính toán font-size và kích thước chấm lần đầu

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
    gameLoop();
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
    }
    updateBlueDotPosition();
});
