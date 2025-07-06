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
// - Các giá trị này bây giờ ĐẠI DIỆN cho pixel / giây (hoặc pixel / giây^2 cho trọng lực).
// - Bạn cần điều chỉnh chúng dựa trên cảm nhận trên thiết bị hiện đại của mình.
// - Ví dụ: nếu trước đây bạn thấy 0.03 là phù hợp ở 60FPS, thì bây giờ hãy thử 0.03 * 60 = 1.8.
// - Khi đã tinh chỉnh được, cảm giác này sẽ đồng nhất trên mọi thiết bị.

var DOT_RATIO_TO_FONT_HEIGHT = 0.3; // Tỷ lệ kích thước chấm so với chiều cao font
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 1.8; // Tốc độ di chuyển ngang của chấm xanh (pixel/giây)
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.277; // Chiều cao nhảy mong muốn của chấm xanh (pixel)
var GRAVITY_RATIO_TO_FONT_HEIGHT = 35; // Gia tốc trọng trường tác động lên chấm xanh (pixel/giây^2)
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8; // Giới hạn di chuyển ngang của chấm xanh so với tâm chấm đỏ

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
var lastTimestamp = 0; // Biến để tính Delta Time

function adjustFontSize() {
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    // Giá trị '18 * 5.6' này có vẻ là một hằng số cố định, có thể cần xem xét lại nếu bạn muốn
    // thiết kế responsive hơn cho các kích thước màn hình rất khác nhau.
    var desiredWidthVW = 18 * 5.6;
    var desiredWidthPx = (desiredWidthVW / 100) * viewportWidth;

    var TEST_FONT_SIZE = 100;

    // Đặt font size tạm thời để đo kích thước thực tế của text container
    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';

    var testDotSizePx = TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = testDotSizePx + 'px';
    redDotStatic.style.height = testDotSizePx + 'px';

    var textContainerWidthAtTestSize = textContainer.offsetWidth;

    // Tránh chia cho 0 nếu container chưa được render hoặc có width = 0
    if (textContainerWidthAtTestSize === 0) {
         textContainerWidthAtTestSize = 1;
    }

    // Tính toán font size mới dựa trên tỷ lệ chiều rộng mong muốn
    var newFontSize = TEST_FONT_SIZE * (desiredWidthPx / textContainerWidthAtTestSize);

    // Giới hạn font size để tránh quá nhỏ hoặc quá lớn
    var MIN_FONT_SIZE = 20;
    var MAX_FONT_SIZE = 3000;
    newFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    currentFontSizePx = newFontSize;

    // Áp dụng font size cuối cùng
    co3mText.style.fontSize = currentFontSizePx + 'px';
    comText.style.fontSize = currentFontSizePx + 'px';

    // Cập nhật kích thước các chấm và các thông số vật lý theo font size mới
    var dotSizePx = currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = dotSizePx + 'px';
    redDotStatic.style.height = dotSizePx + 'px';
    blueDotMoving.style.width = dotSizePx + 'px';
    blueDotMoving.style.height = dotSizePx + 'px';

    // Các giá trị này hiện tại là pixel/giây và pixel/giây^2, dựa trên các HẰNG SỐ CẦN ĐIỀU CHỈNH
    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;
}

function updateBlueDotPosition() {
    blueDotMoving.style.left = blueDotX + 'px';
    blueDotMoving.style.top = blueDotY + 'px';
}

function moveBlueDot(deltaTime) {
    // Cập nhật vị trí ngang: Tốc độ (pixel/giây) * DeltaTime (giây) = Quãng đường di chuyển (pixel)
    blueDotX += moveSpeedPx * blueDotDirection * deltaTime;

    // Đảo chiều di chuyển nếu chạm biên
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
        // Tính toán vận tốc nhảy ban đầu cần thiết để đạt chiều cao mong muốn
        // Công thức: v = -sqrt(2gh)
        // jumpVelocity này cũng tính theo pixel/giây, và âm vì nhảy lên là ngược chiều Y
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
    }
}

function applyGravity(deltaTime) {
    if (isJumping) {
        // Cập nhật vị trí dọc: Vận tốc (pixel/giây) * DeltaTime (giây) = Quãng đường di chuyển (pixel)
        blueDotY += jumpVelocity * deltaTime;
        // Cập nhật vận tốc: Gia tốc (pixel/giây^2) * DeltaTime (giây) = Thay đổi vận tốc (pixel/giây)
        jumpVelocity += gravityPx * deltaTime;

        // Nếu chấm xanh chạm mặt đất (hoặc vượt qua), đặt lại vị trí và trạng thái
        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocity = 0;
        }
    } else {
        // Đảm bảo chấm xanh luôn nằm trên mặt đất khi không nhảy
        var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
        blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
        blueDotY = blueDotBaseY;
    }
}

function checkCollision() {
    // Tính toán tâm của chấm đỏ và chấm xanh
    var redCenterX = redDotStatic.offsetLeft + (redDotStatic.offsetWidth / 2);
    var redCenterY = redDotStatic.offsetTop + (redDotStatic.offsetHeight / 2);

    var blueCenterX = blueDotX + blueDotRadiusPx;
    var blueCenterY = blueDotY + blueDotRadiusPx;

    var dx = blueCenterX - redCenterX;
    var dy = blueCenterY - redCenterY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        // Nếu va chạm, điều chỉnh vị trí để không bị chồng lấn
        var overlap = minDistance - distance;
        var angle = Math.atan2(dy, dx);

        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        // Giữ lại logic đổi hướng khi va chạm nếu bạn muốn chấm xanh bật lại
        if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
            blueDotDirection = 1;
        } else {
            blueDotDirection = -1;
        }

        redDotStatic.style.border = '2px solid red'; // Hiệu ứng va chạm trực quan
        return true;
    } else {
        redDotStatic.style.border = 'none';
        return false;
    }
}

function gameLoop(timestamp) {
    // Khởi tạo lastTimestamp cho khung hình đầu tiên
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
    }
    // Tính toán Delta Time (thời gian đã trôi qua kể từ khung hình trước, tính bằng giây)
    var deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp; // Cập nhật lastTimestamp cho khung hình tiếp theo

    // Gọi các hàm cập nhật vật lý và chuyển động với Delta Time
    moveBlueDot(deltaTime);
    applyGravity(deltaTime);
    checkCollision();
    updateBlueDotPosition();

    // Yêu cầu khung hình tiếp theo
    animationFrameId = window.requestAnimationFrame(gameLoop);
}

function initializeGame() {
    // Hủy bỏ bất kỳ animation frame nào đang chạy trước đó
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastTimestamp = 0; // Đặt lại lastTimestamp khi khởi tạo game để tính Delta Time đúng từ đầu

    adjustFontSize(); // Cập nhật kích thước và các thông số ban đầu

    // Tính toán bán kính các chấm
    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    // Lấy vị trí tương đối của chấm đỏ và container text
    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();

    // Tính toán tâm X của chấm đỏ so với container text
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    // Tính toán giới hạn di chuyển ngang của chấm xanh
    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    // Tính toán vị trí Y cơ sở của chấm xanh (mặt đất)
    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    // Đặt vị trí ban đầu của chấm xanh
    blueDotX = redDotCenterXPx + redDotRadiusPx; // Đặt nó ở bên phải tâm chấm đỏ một chút
    blueDotY = blueDotBaseY;

    updateBlueDotPosition(); // Cập nhật vị trí CSS của chấm xanh
    animationFrameId = window.requestAnimationFrame(gameLoop); // Bắt đầu vòng lặp game
}

// Gắn các sự kiện
addEvent(window, 'load', initializeGame); // Khởi tạo game khi trang tải xong

// Các sự kiện nhảy (mouse click, touch, keydown, right click)
addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);
addEvent(window, 'keydown', function(event) {
    if (event && event.preventDefault) {
        event.preventDefault(); // Ngăn chặn hành vi mặc định của phím (ví dụ: cuộn trang)
    }
    jump();
});
addEvent(window, 'contextmenu', function(event) {
    if (event && event.preventDefault) {
        event.preventDefault(); // Ngăn chặn menu ngữ cảnh chuột phải
    }
    jump();
});

// Xử lý sự kiện thay đổi kích thước cửa sổ để điều chỉnh font size và các thông số
addEvent(window, 'resize', function() {
    adjustFontSize(); // Cập nhật font size và các thông số liên quan

    // Cập nhật lại các thông số vị trí và giới hạn sau khi resize
    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    // Điều chỉnh vị trí của chấm xanh nếu đang không nhảy hoặc nếu nó bị đẩy ra khỏi biên
    if (!isJumping) {
        if (blueDotX > rightBoundaryPx) {
            blueDotX = rightBoundaryPx;
        } else if (blueDotX < leftBoundaryPx) {
            blueDotX = leftBoundaryPx;
        }
        blueDotY = blueDotBaseY; // Đặt lại về mặt đất
    } else {
        // Nếu đang nhảy, chỉ giới hạn vị trí ngang
        if (blueDotX > rightBoundaryPx) {
            blueDotX = rightBoundaryPx;
        } else if (blueDotX < leftBoundaryPx) {
            blueDotX = leftBoundaryPx;
        }
        // blueDotY không thay đổi nếu đang nhảy để tránh giật hình do đặt lại vị trí Y
    }
    updateBlueDotPosition(); // Cập nhật vị trí CSS sau khi resize
});
