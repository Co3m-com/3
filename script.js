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
var blueDotDirection = 1; // 1 for right, -1 for left

// --- CÁC HẰNG SỐ MỚI ĐỂ ĐỒNG BỘ HÓA ĐỘ KHÓ ---
// Tổng thời gian cho một chu kỳ di chuyển (qua trái và phải) tính bằng mili giây.
// Phạm vi di chuyển tổng là 201ms (từ điểm này đến điểm kia và quay lại)
var TOTAL_MOVEMENT_TIME_MS = 201;

// Thời điểm mà tâm của chấm xanh trùng với tâm của chấm đỏ, tính bằng mili giây
// Đây là thời điểm chính xác cần nhảy
var OBSTACLE_CENTER_TIME_MS = 101;

// Sai số cho phép xung quanh OBSTACLE_CENTER_TIME_MS để cú nhảy được tính là "chính xác"
// Ví dụ: 5ms nghĩa là nhảy trong khoảng 96ms đến 106ms
var JUMP_ACCURACY_THRESHOLD_MS = 5;
// --- KẾT THÚC CÁC HẰNG SỐ MỚI ---

var DOT_RATIO_TO_FONT_HEIGHT = 0.3;
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.002; // Tốc độ di chuyển ban đầu (sẽ được tính lại)
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.29;
var GRAVITY_RATIO_TO_FONT_HEIGHT = 0.00003;

var FIXED_UPDATE_INTERVAL_MS = 10; // Cố định 10ms cho mỗi bước update logic

var moveSpeedPxPerMs; // Tốc độ di chuyển thực tế theo pixel/ms
var actualJumpHeightPx;
var gravityPx;
var movementLimitPx; // Giới hạn di chuyển theo pixel
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

// --- BIẾN MỚI ĐỂ THEO DÕI THỜI GIAN DI CHUYỂN ---
var timeElapsedInCurrentMovementCycle = 0; // Thời gian đã trôi qua trong chu kỳ di chuyển hiện tại
// --- KẾT THÚC BIẾN MỚI ---

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

    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;

    // --- TÍNH TOÁN LẠI MOVEMENT_LIMIT_PX VÀ MOVESPEEDPXPERMS ---
    // Tính toán moveSpeedPxPerMs dựa trên tổng thời gian di chuyển và giới hạn di chuyển.
    // Giới hạn di chuyển được tính từ tâm chấm đỏ đến một biên.
    // Ví dụ: Để di chuyển 100ms từ tâm ra biên, và tổng thời gian qua lại là 201ms.
    // Khoảng cách di chuyển một chiều (từ biên này đến biên kia) là (TOTAL_MOVEMENT_TIME_MS / 2) * moveSpeedPxPerMs
    // Hoặc, khoảng cách từ tâm đến biên là (TOTAL_MOVEMENT_TIME_MS / 2) * moveSpeedPxPerMs.

    // Để tổng thời gian di chuyển qua lại (từ trái qua phải và về trái) là 201ms,
    // thì thời gian di chuyển từ biên trái đến biên phải là 201ms / 2 = 100.5ms
    // Vậy, thời gian di chuyển từ một biên đến tâm là 100.5ms.
    // Chúng ta muốn khoảng cách từ tâm chấm đỏ đến biên di chuyển tương ứng với 100.5ms di chuyển.
    // Lấy một khoảng cách cố định dựa trên kích thước font hoặc màn hình để đảm bảo nó nhìn hợp lý.
    // Ở đây, chúng ta sẽ giữ MOVE_SPEED_RATIO_TO_FONT_HEIGHT như một tỉ lệ cơ bản cho tốc độ
    // và điều chỉnh movementLimitPx để khớp với thời gian.

    // Tính tốc độ di chuyển theo pixel/ms. Chúng ta cần một khoảng cách di chuyển hợp lý trên màn hình.
    // Giả định tốc độ cố định để đồng bộ hóa, ví dụ 1 pixel/ms để dễ tính toán.
    // Tuy nhiên, để nó tỉ lệ với kích thước màn hình, chúng ta vẫn dùng currentFontSizePx.
    // moveSpeedPxPerMs sẽ là tốc độ (pixels/ms)
    // movementLimitPx sẽ là khoảng cách tối đa từ tâm chấm đỏ đến biên của chấm xanh
    // Để tổng thời gian là 201ms, và tâm là 101ms, điều này có nghĩa là
    // từ biên trái đến tâm là 101ms, từ tâm đến biên phải là 201 - 101 = 100ms.
    // Vậy tổng quãng đường là (101 + 100) * tốc độ, nhưng thực tế là 2 * quãng đường 1 chiều.

    // Để cho dễ hiểu, chúng ta sẽ định nghĩa tốc độ di chuyển là một số pixel nhất định trong 1 mili giây.
    // Ví dụ: blueDotMoving di chuyển 1 pixel mỗi 1ms (hay 1000 pixel/giây)
    // Hoặc, giữ nguyên MOVE_SPEED_RATIO_TO_FONT_HEIGHT để tốc độ di chuyển tỉ lệ với font size.
    // Sau đó, tính toán MOVEMENT_LIMIT_PX dựa trên TOTAL_MOVEMENT_TIME_MS.

    // Tốc độ di chuyển thực tế theo pixel/mili giây.
    // MOVE_SPEED_RATIO_TO_FONT_HEIGHT * currentFontSizePx sẽ là tốc độ pixel/frame (16ms)
    // Chia cho 16 để có pixel/ms (nếu 60fps)
    moveSpeedPxPerMs = (currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT) / FIXED_UPDATE_INTERVAL_MS;

    // MovementLimitPx là khoảng cách từ tâm chấm đỏ đến biên của khoảng di chuyển của chấm xanh.
    // Thời gian một chiều từ biên trái sang biên phải là TOTAL_MOVEMENT_TIME_MS / 2 = 100.5ms
    // Vậy khoảng cách di chuyển từ biên sang tâm (hoặc ngược lại) sẽ là 100.5ms * moveSpeedPxPerMs
    // Movement limit sẽ là nửa quãng đường di chuyển của chấm xanh
    movementLimitPx = (TOTAL_MOVEMENT_TIME_MS / 2) * moveSpeedPxPerMs;
    // --- KẾT THÚC TÍNH TOÁN LẠI ---
}

function renderBlueDot(alpha) {
    var interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    var interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

    blueDotMoving.style.left = interpolatedX + 'px';
    blueDotMoving.style.top = interpolatedY + 'px';
}

function moveBlueDotFixed(fixedDeltaTime) {
    blueDotX += moveSpeedPxPerMs * blueDotDirection * fixedDeltaTime;
    timeElapsedInCurrentMovementCycle += fixedDeltaTime;

    // Nếu chấm xanh đã vượt qua biên phải
    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx; // Đặt lại vị trí tại biên
        blueDotDirection *= -1;     // Đổi hướng
        timeElapsedInCurrentMovementCycle = 0; // Reset thời gian cho chu kỳ mới (từ phải sang trái)
    }
    // Nếu chấm xanh đã vượt qua biên trái
    else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx;  // Đặt lại vị trí tại biên
        blueDotDirection *= -1;     // Đổi hướng
        timeElapsedInCurrentMovementCycle = 0; // Reset thời gian cho chu kỳ mới (từ trái sang phải)
    }
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);

        // --- KIỂM TRA ĐỘ CHÍNH XÁC CỦA CÚ NHẢY DỰA TRÊN THỜI GIAN ---
        var timeFromStartOfCycle = timeElapsedInCurrentMovementCycle; // Thời gian hiện tại trong chu kỳ di chuyển

        // Điều chỉnh timeFromStartOfCycle để nó luôn là thời gian từ biên gần nhất đến vị trí hiện tại
        // Nếu blueDotDirection là -1 (đang đi sang trái), thì thời gian được tính từ biên phải.
        // Khoảng cách từ biên phải đến tâm là (TOTAL_MOVEMENT_TIME_MS - OBSTACLE_CENTER_TIME_MS)
        // Nếu blueDotDirection là 1 (đang đi sang phải), thì thời gian được tính từ biên trái.
        // Khoảng cách từ biên trái đến tâm là OBSTACLE_CENTER_TIME_MS

        var adjustedTimeForCheck;
        if (blueDotDirection === 1) { // Đang đi từ trái sang phải
            adjustedTimeForCheck = timeFromStartOfCycle;
        } else { // Đang đi từ phải sang trái
            // Tính thời gian từ biên phải đến vị trí hiện tại
            // Tổng thời gian 1 chiều là TOTAL_MOVEMENT_TIME_MS / 2
            // Thời gian đã đi trong chu kỳ ngược (từ phải sang trái) là timeFromStartOfCycle
            // Vậy thời gian còn lại để đến biên trái là (TOTAL_MOVEMENT_TIME_MS / 2) - timeFromStartOfCycle
            // Hoặc đơn giản hơn, nếu đang đi từ phải sang trái, chúng ta quan tâm đến thời điểm
            // so với điểm bắt đầu của chu kỳ đó.
            // Ví dụ: Total 201ms.
            // 0ms (biên trái) -> 101ms (tâm) -> 201ms (biên phải)
            // Nếu đang đi từ phải sang trái: 0ms (biên phải) -> 100ms (tâm) -> 201ms (biên trái)
            // Để đồng nhất, ta sẽ làm như sau:
            // Nếu đang đi sang trái, thời điểm "tâm" xảy ra ở OBSTACLE_CENTER_TIME_MS trong chu kỳ đi từ trái sang phải.
            // Thời gian từ biên phải đến tâm sẽ là TOTAL_MOVEMENT_TIME_MS - OBSTACLE_CENTER_TIME_MS = 201 - 101 = 100ms
            adjustedTimeForCheck = (TOTAL_MOVEMENT_TIME_MS / 2) - timeFromStartOfCycle;
            // Dòng trên có thể gây nhầm lẫn. Cần xác định rõ timeElapsedInCurrentMovementCycle reset khi nào.
            // Nó reset khi chạm biên.
            // Nếu đang đi sang phải: timeElapsedInCurrentMovementCycle tăng từ 0 đến TOTAL_MOVEMENT_TIME_MS/2.
            // Nếu đang đi sang trái: timeElapsedInCurrentMovementCycle tăng từ 0 đến TOTAL_MOVEMENT_TIME_MS/2.
            // Để có thời gian tương ứng với trục tọa độ ảo:
            if (blueDotDirection === 1) { // Đi từ biên trái về phải
                adjustedTimeForCheck = timeElapsedInCurrentMovementCycle;
            } else { // Đi từ biên phải về trái
                // Khi đang đi từ phải sang trái, timeElapsedInCurrentMovementCycle là thời gian đã đi từ biên phải.
                // Để tính thời gian so với điểm bắt đầu ảo (biên trái) của chu kỳ tổng:
                // Ta có (TOTAL_MOVEMENT_TIME_MS / 2) là thời gian cho 1 chiều.
                // Thời gian còn lại để đến biên trái là (TOTAL_MOVEMENT_TIME_MS / 2) - timeElapsedInCurrentMovementCycle.
                // Thời điểm này tương ứng với thời điểm nào trong chu kỳ TOTAL_MOVEMENT_TIME_MS?
                // Nó sẽ là OBSTACLE_CENTER_TIME_MS nếu đang ở tâm.
                // Điều này có nghĩa là blueDotX sẽ khớp với redDotCenterXPx.
                // Thay vì tính toán dựa trên `timeElapsedInCurrentMovementCycle` phức tạp.
                // Chúng ta chỉ cần xem `blueDotX` có ở gần `redDotCenterXPx` không.
                // Tuy nhiên, yêu cầu là "nếu bấm đúng chính xác thời điểm 101 miligiay thì sẽ bay qua chướng ngại vật".
                // Điều này ám chỉ một hệ thống thời gian tuyệt đối.
                // Chúng ta sẽ giả sử một chu kỳ bắt đầu từ leftBoundaryPx và kết thúc ở rightBoundaryPx (100.5ms)
                // và sau đó quay lại (100.5ms). Tổng cộng 201ms.
                // OBSTACLE_CENTER_TIME_MS = 101ms là thời điểm tính từ blueDotX bắt đầu từ leftBoundaryPx.
                // Để làm điều này chính xác, chúng ta cần theo dõi tổng thời gian di chuyển.

                // Chúng ta sẽ điều chỉnh logic kiểm tra va chạm để nó linh hoạt hơn.
                // Khi nhảy, nếu blueDotX nằm trong một khoảng x quanh redDotCenterXPx, thì coi là thành công.
                // Phạm vi cho phép là 101ms +/- JUMP_ACCURACY_THRESHOLD_MS
                // Tương ứng với blueDotX là redDotCenterXPx +/- (JUMP_ACCURACY_THRESHOLD_MS * moveSpeedPxPerMs)
                var allowedXRange = JUMP_ACCURACY_THRESHOLD_MS * moveSpeedPxPerMs;
                var targetX = redDotCenterXPx - blueDotRadiusPx; // Tâm chấm xanh trùng với tâm chấm đỏ

                if (Math.abs(blueDotX - targetX) <= allowedXRange) {
                    // Nếu bấm đúng, không làm gì (cho phép nhảy qua)
                    redDotStatic.style.border = '2px solid green'; // Đánh dấu thành công
                    // Có thể thêm logic điểm số hoặc hiệu ứng thành công ở đây
                } else {
                    // Nếu bấm sai, gây va chạm hoặc phạt người chơi
                    redDotStatic.style.border = '2px solid orange'; // Đánh dấu thất bại
                    // Thêm logic game over hoặc giảm điểm ở đây
                }
            }
        // --- KẾT THÚC KIỂM TRA ĐỘ CHÍNH XÁC ---
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
            // Reset border sau khi cú nhảy kết thúc nếu không có va chạm liên tục
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
        // Va chạm xảy ra
        if (!isJumping) { // Chỉ va chạm nếu không đang nhảy
            var overlap = minDistance - distance;
            var angle = Math.atan2(dy, dx);

            // Đẩy chấm xanh ra khỏi chấm đỏ để tránh dính
            blueDotX += Math.cos(angle) * overlap;
            blueDotY += Math.sin(angle) * overlap;

            // Đổi hướng khi va chạm (nếu không nhảy)
            if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
                blueDotDirection = 1;
            } else {
                blueDotDirection = -1;
            }

            redDotStatic.style.border = '2px solid red'; // Đánh dấu va chạm
            return true;
        } else {
            // Khi đang nhảy, chúng ta không muốn nó va chạm và đổi hướng ngay lập tức.
            // Logic va chạm khi nhảy sẽ được xử lý ở hàm `jump()` để kiểm tra độ chính xác.
            // Ở đây, nếu đang nhảy và có khoảng cách < minDistance, thì không làm gì
            // hoặc có thể thêm hiệu ứng khác.
            redDotStatic.style.border = '2px solid black'; // Có thể là màu khác để chỉ ra "suýt va chạm"
            return false;
        }
    } else {
        // Không va chạm (chỉ reset màu border nếu không đang nhảy hoặc không có thông báo đặc biệt)
        if (!isJumping) {
            redDotStatic.style.border = 'none';
        }
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
        checkCollision(); // Kiểm tra va chạm liên tục
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

    // redDotCenterXPx là vị trí tâm chấm đỏ so với gốc của textContainer
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    // leftBoundaryPx và rightBoundaryPx là giới hạn di chuyển của tâm chấm xanh
    // Để tâm chấm xanh có thể di chuyển ra xa tâm chấm đỏ một khoảng movementLimitPx
    leftBoundaryPx = redDotCenterXPx - movementLimitPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    // Khởi tạo vị trí chấm xanh ở một trong hai biên để bắt đầu chu kỳ di chuyển
    // Để đảm bảo 201ms tổng di chuyển, ta có thể khởi tạo ở biên trái hoặc biên phải.
    // Nếu khởi tạo ở biên trái, thời gian đến tâm là 101ms.
    blueDotX = leftBoundaryPx;
    blueDotY = blueDotBaseY;

    // Khởi tạo hướng và thời gian chu kỳ
    blueDotDirection = 1; // Bắt đầu di chuyển sang phải
    timeElapsedInCurrentMovementCycle = 0; // Reset thời gian chu kỳ

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
    // Khi thay đổi kích thước cửa sổ, cần cập nhật lại các giá trị phụ thuộc vào kích thước
    // nhưng không reset trạng thái game (nhảy, vị trí đang di chuyển).
    // Chỉ cần gọi adjustFontSize() và cập nhật lại các boundary.
    adjustFontSize();

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    // Cập nhật lại biên di chuyển
    leftBoundaryPx = redDotCenterXPx - movementLimitPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    // Đảm bảo chấm xanh vẫn nằm trong phạm vi mới sau khi resize
    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx;
    } else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx;
    }
    if (!isJumping) { // Nếu không đang nhảy, đảm bảo nó ở trên mặt đất mới
        blueDotY = blueDotBaseY;
    }

    // Cần cập nhật lại thời gian chu kỳ nếu vị trí blueDotX bị thay đổi do resize
    // hoặc có thể giữ nguyên timeElapsedInCurrentMovementCycle để tránh giật.
    // Tuy nhiên, việc recalculate timeElapsedInCurrentMovementCycle dựa trên vị trí hiện tại
    // sẽ đảm bảo đồng bộ hóa tốt hơn.
    // Tính lại thời gian đã trôi qua dựa trên vị trí X hiện tại
    var currentDistanceFromLeftBoundary = blueDotX - leftBoundaryPx;
    timeElapsedInCurrentMovementCycle = currentDistanceFromLeftBoundary / moveSpeedPxPerMs;
    if (blueDotDirection === -1) { // Nếu đang đi sang trái, cần điều chỉnh lại
        timeElapsedInCurrentMovementCycle = (TOTAL_MOVEMENT_TIME_MS / 2) - timeElapsedInCurrentMovementCycle;
        if (timeElapsedInCurrentMovementCycle < 0) timeElapsedInCurrentMovementCycle = 0; // Đảm bảo không âm
    }


    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);
});
