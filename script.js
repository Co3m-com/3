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

var FIXED_UPDATE_INTERVAL_MS = 10; // Cố định tốc độ cập nhật logic game

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
    // Giả sử tâm của vùng an toàn là 0ms.
    // Khoảng cách 2 bên 200ms nghĩa là từ -100ms đến +100ms từ tâm.
    // Nếu thời điểm vàng là 90-110ms, có thể hiểu là 90-110ms trước khi chấm xanh đến tâm.
    // Hoặc, nếu "200ms" là tổng thời gian di chuyển qua khu vực đỏ,
    // thì 90-110ms là 90-110ms tính từ một điểm mốc cố định (ví dụ: mép trái của vùng 200ms).
    // Tôi sẽ giả định "90-110ms" là khoảng thời gian TỪ KHI CHẤM XANH BẮT ĐẦU VÀO VÙNG "VÀNG"
    // cho đến khi nó rời khỏi vùng đó.
    // Định nghĩa này cần phải rất rõ ràng trong game của bạn.
    // Ví dụ đơn giản: tâm chấm đỏ là 0. Khoảng cách vàng là +/- N pixel so với tâm.
    // Tạm thời, tôi sẽ tính khoảng cách này dựa trên thời gian di chuyển từ tâm.
    // Nếu bạn muốn 90ms đến 110ms *cách tâm*, thì đó là:
    
    // Khoảng cách từ tâm chấm đỏ (pixel)
    // Ví dụ: tâm = 0px. Biên xa nhất = MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT * currentFontSizePx
    // Thời gian để đi từ tâm ra biên xa nhất: (MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT * currentFontSizePx) / moveSpeedPx
    // Tạm giả định "90-110ms" là khoảng thời gian "đối xứng" quanh tâm chấm đỏ.
    // Nếu 200ms là tổng thời gian từ biên trái đến biên phải của vùng di chuyển (2 * movementLimitPx),
    // thì 100ms là thời gian đến tâm.
    // 90ms đến 110ms có thể được hiểu là -10ms đến +10ms so với tâm 100ms.
    // Vậy khoảng cách pixel tương ứng sẽ là:
    // MIN: (100 - (TOTAL_MOVEMENT_TIME_MS / 2) + GOLDEN_JUMP_MIN_MS) * moveSpeedPx;
    // MAX: (100 - (TOTAL_MOVEMENT_TIME_MS / 2) + GOLDEN_JUMP_MAX_MS) * moveSpeedPx;

    // Cách đơn giản hơn: Khoảng cách tính từ tâm chấm đỏ.
    // Nếu 90ms và 110ms là khoảng thời gian từ tâm, thì:
    GOLDEN_JUMP_MIN_OFFSET_PX = GOLDEN_JUMP_MIN_MS * moveSpeedPx;
    GOLDEN_JUMP_MAX_OFFSET_PX = GOLDEN_JUMP_MAX_MS * moveSpeedPx;

    // Lưu ý: Nếu chấm xanh di chuyển từ trái sang phải, thì khi nó cách tâm một đoạn là Golden_Jump_Min_Offset_Px
    // và tiếp tục đi cho đến Golden_Jump_Max_Offset_Px, đó là vùng vàng.
    // Tức là: redDotCenterXPx - GOLDEN_JUMP_MAX_OFFSET_PX đến redDotCenterXPx - GOLDEN_JUMP_MIN_OFFSET_PX (khi đi vào)
    // và redDotCenterXPx + GOLDEN_JUMP_MIN_OFFSET_PX đến redDotCenterXPx + GOLDEN_JUMP_MAX_OFFSET_PX (khi đi ra)
    // Để dễ hơn, tôi sẽ xác định vùng vàng là một khoảng cách tuyệt đối từ tâm.
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

    // --- Cập nhật trạng thái "đang ở vùng vàng" ---
    var blueDotCenterCurrentX = blueDotX + blueDotRadiusPx;
    var distanceToRedCenter = Math.abs(blueDotCenterCurrentX - redDotCenterXPx);

    // Vùng vàng là khi khoảng cách từ tâm chấm đỏ nằm trong một ngưỡng nhất định.
    // Tôi sẽ định nghĩa "vàng" là khi khoảng cách từ tâm chấm đỏ (theo trục X)
    // nằm trong khoảng tương ứng với 90ms đến 110ms từ tâm.
    // Điều này có nghĩa là khi chấm xanh cách tâm một khoảng `distanceFromCenterGoldenMin` đến `distanceFromCenterGoldenMax`
    // (ví dụ: khoảng cách 90px đến 110px nếu tốc độ là 1px/ms)
    // Lưu ý: Khoảng cách này là tuyệt đối từ tâm, không phải theo chiều.
    var distanceFromCenterGoldenMin = GOLDEN_JUMP_MIN_OFFSET_PX;
    var distanceFromCenterGoldenMax = GOLDEN_JUMP_MAX_OFFSET_PX;

    if (distanceToRedCenter >= distanceFromCenterGoldenMin && distanceToRedCenter <= distanceFromCenterGoldenMax) {
        if (!isCurrentlyInGoldenZone) {
            isCurrentlyInGoldenZone = true;
            redDotStatic.style.border = '2px solid gold'; // Đánh dấu vùng vàng
        }
    } else {
        if (isCurrentlyInGoldenZone) {
            isCurrentlyInGoldenZone = false;
            if (!jumpedInGoldenZone) { // Chỉ bỏ viền nếu chưa nhảy thành công
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
            jumpedInGoldenZone = true;
            redDotStatic.style.border = '2px solid limegreen'; // Phản hồi thành công
            console.log("Cú nhảy VÀNG!");
        } else {
            jumpedInGoldenZone = false;
            redDotStatic.style.border = '2px solid red'; // Phản hồi không thành công
            console.log("Cú nhảy KHÔNG VÀNG.");
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
            // Sau khi chạm đất, reset trạng thái nhảy thành công
            jumpedInGoldenZone = false;
            if (!isCurrentlyInGoldenZone) { // Nếu không còn trong vùng vàng, bỏ viền
                redDotStatic.style.border = 'none';
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
        // Có va chạm, nhưng chúng ta không thay đổi hành vi nhảy ở đây.
        // Đây là va chạm vật lý, không phải điều kiện "thời điểm vàng".
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
        checkCollision(); // Vẫn gọi để xử lý va chạm nếu bạn có thêm logic khác
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

    adjustFontSize(); // Gọi lại để đảm bảo tính toán lại các biến kích thước và tốc độ

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();

    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    blueDotX = redDotCenterXPx + redDotRadiusPx; // Khởi tạo vị trí ban đầu
    blueDotY = blueDotBaseY;

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    isCurrentlyInGoldenZone = false;
    jumpedInGoldenZone = false;
    redDotStatic.style.border = 'none'; // Đảm bảo không có viền khi khởi tạo

    renderBlueDot(1);

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

addEvent(window, 'load', initializeGame);

// Bắt sự kiện nhảy
addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);
addEvent(window, 'keydown', function(event) {
    // Ngăn chặn hành vi mặc định của phím (ví dụ: cuộn trang)
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
    // Khi thay đổi kích thước cửa sổ, khởi tạo lại game để điều chỉnh kích thước và vị trí
    initializeGame();
});
