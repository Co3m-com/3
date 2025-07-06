(function() {
    // Polyfill cho requestAnimationFrame và cancelAnimationFrame
    // Đảm bảo hoạt động trên các trình duyệt cũ.
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
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

// Hàm tiện ích để thêm sự kiện, hỗ trợ cả addEventListener và attachEvent
function addEvent(element, eventName, callback) {
    if (!element) return; // Kiểm tra an toàn
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

// --- KHAI BÁO CÁC PHẦN TỬ DOM VÀ HẰNG SỐ CẤU HÌNH ---

// Lấy các phần tử DOM một lần duy nhất
const textContainer = document.getElementById('co3m-text')?.parentNode;
const co3mText = document.getElementById('co3m-text');
const comText = document.getElementById('com-text');
const redDotStatic = document.getElementById('red-dot-static-id');
const blueDotMoving = document.getElementById('blue-dot-moving-id');
const fullscreenOverlay = document.getElementsByClassName('fullscreen-overlay')[0];

// Kiểm tra nếu không tìm thấy phần tử DOM quan trọng thì dừng thực thi
if (!textContainer || !co3mText || !comText || !redDotStatic || !blueDotMoving || !fullscreenOverlay) {
    console.error("Thiếu một hoặc nhiều phần tử DOM cần thiết. Đảm bảo tất cả các ID và class đều đúng.");
    // Có thể thêm logic xử lý lỗi khác như hiển thị thông báo cho người dùng
    throw new Error("Không thể khởi tạo trò chơi do thiếu phần tử DOM.");
}

// --- CÁC THÔNG SỐ GAME CẦN ĐIỀU CHỈNH ĐỂ TINH CHỈNH ĐỘ KHÓ VÀ CẢM GIÁC GAME ---
// CÁC GIÁ TRỊ NÀY ĐẠI DIỆN CHO PIXEL / MILI GIÂY (hoặc PIXEL / MILI GIÂY^2 cho trọng lực).
// ĐIỀU CHỈNH CHÚNG TRÊN THIẾT BỊ HIỆN ĐẠI CỦA BẠN CHO ĐẾN KHI HÀI LÒNG.
// KHI ĐÃ TINH CHỈNH ĐƯỢC, TRẢI NGHIỆM SẼ ĐỒNG NHẤT TRÊN MỌI THIẾT BỊ.

// Kích thước các đối tượng
const DOT_RATIO_TO_FONT_HEIGHT = 0.3; // Tỷ lệ kích thước chấm so với chiều cao font

// Các thông số di chuyển
const MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.002; // Tốc độ di chuyển ngang của chấm xanh (pixel/mili giây)
const MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8; // Giới hạn di chuyển ngang của chấm xanh so với tâm chấm đỏ

// Các thông số nhảy và trọng lực
const DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.27; // Chiều cao nhảy mong muốn của chấm xanh (pixel)
const GRAVITY_RATIO_TO_FONT_HEIGHT = 0.00003; // Gia tốc trọng trường tác động lên chấm xanh (pixel/mili giây^2)

// CÀI ĐẶT CƠ BẢN CỦA GAME LOOP (KHÔNG NÊN THAY ĐỔI NẾU KHÔNG CÓ KINH NGHIỆM)
const FIXED_UPDATE_INTERVAL_MS = 20; // Mili giây cho mỗi bước cập nhật vật lý. (20ms = 50 cập nhật/giây)
const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 3000;
const TEST_FONT_SIZE = 100; // Sử dụng hằng số thay vì biến

// --- KẾT THÚC CÁC THÔNG SỐ CẦN ĐIỀU CHỈNH ---

// Các biến trạng thái game
let blueDotX;
let blueDotY;
let blueDotDirection = 1; // 1 = sang phải, -1 = sang trái

let moveSpeedPx;
let actualJumpHeightPx;
let gravityPx;
let movementLimitPx;
let currentFontSizePx;

let isJumping = false;
let jumpVelocity = 0;
let blueDotBaseY; // Vị trí Y cơ sở của chấm xanh khi không nhảy

let redDotRadiusPx;
let blueDotRadiusPx;

let redDotCenterXPx;
let leftBoundaryPx;
let rightBoundaryPx;

let animationFrameId = null;
let lastTimestamp = 0;
let accumulatedTime = 0;

let prevBlueDotX; // Lưu vị trí X trước đó để nội suy
let prevBlueDotY; // Lưu vị trí Y trước đó để nội suy

// --- CÁC HÀM XỬ LÝ GAME LOGIC VÀ HIỂN THỊ ---

/**
 * Điều chỉnh kích thước font và các thông số liên quan dựa trên viewport.
 * Tính toán lại các giá trị phụ thuộc vào kích thước font.
 */
function adjustFontSize() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    // Thay đổi 18 * 5.6 thành hằng số hoặc biến rõ ràng hơn nếu có ý nghĩa cụ thể
    const desiredWidthVW = 18 * 5.6; // Ví dụ: 100.8vw
    const desiredWidthPx = (desiredWidthVW / 100) * viewportWidth;

    // Đặt font tạm thời để đo kích thước container
    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';

    // Đặt kích thước dot tạm thời
    const testDotSizePx = TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = testDotSizePx + 'px';
    redDotStatic.style.height = testDotSizePx + 'px';

    let textContainerWidthAtTestSize = textContainer.offsetWidth;
    // Đảm bảo không chia cho 0
    if (textContainerWidthAtTestSize === 0) {
        textContainerWidthAtTestSize = 1;
        console.warn("textContainer.offsetWidth is 0. Using 1 to avoid division by zero.");
    }

    let newFontSize = TEST_FONT_SIZE * (desiredWidthPx / textContainerWidthAtTestSize);
    currentFontSizePx = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    // Áp dụng kích thước font mới
    co3mText.style.fontSize = currentFontSizePx + 'px';
    comText.style.fontSize = currentFontSizePx + 'px';

    // Cập nhật kích thước các chấm và các thông số vật lý
    const dotSizePx = currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = dotSizePx + 'px';
    redDotStatic.style.height = dotSizePx + 'px';
    blueDotMoving.style.width = dotSizePx + 'px';
    blueDotMoving.style.height = dotSizePx + 'px';

    // Cập nhật các thông số vật lý dựa trên kích thước font mới
    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

    // Cập nhật lại bán kính chấm
    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    // Cập nhật lại các ranh giới di chuyển và vị trí Y cơ sở
    const redDotRect = redDotStatic.getBoundingClientRect();
    const textContainerRect = textContainer.getBoundingClientRect();

    // Tính toán vị trí tâm X của chấm đỏ tương đối với textContainer
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    // Tính toán giới hạn di chuyển của chấm xanh
    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    // Tính toán vị trí Y cơ sở của chấm xanh (ngay trên chấm đỏ)
    const redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
}

/**
 * Render vị trí của chấm xanh dựa trên nội suy (interpolation).
 * Điều này giúp chuyển động mượt mà hơn giữa các khung cập nhật vật lý.
 * @param {number} alpha Tỷ lệ nội suy (0 đến 1).
 */
function renderBlueDot(alpha) {
    const interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    const interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

    blueDotMoving.style.left = interpolatedX + 'px';
    blueDotMoving.style.top = interpolatedY + 'px';
}

/**
 * Cập nhật vị trí ngang của chấm xanh dựa trên thời gian cố định (fixedDeltaTime).
 * @param {number} fixedDeltaTime Khoảng thời gian cố định cho bước cập nhật.
 */
function moveBlueDotFixed(fixedDeltaTime) {
    blueDotX += moveSpeedPx * blueDotDirection * fixedDeltaTime;

    // Đảo chiều di chuyển khi chạm biên
    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx; // Đảm bảo chấm không vượt quá biên
        blueDotDirection *= -1;
    } else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx; // Đảm bảo chấm không vượt quá biên
        blueDotDirection *= -1;
    }
}

/**
 * Kích hoạt hành động nhảy cho chấm xanh.
 */
function jump() {
    if (!isJumping) {
        isJumping = true;
        // Công thức tính vận tốc ban đầu để đạt chiều cao nhảy mong muốn
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
    }
}

/**
 * Áp dụng trọng lực lên chấm xanh dựa trên thời gian cố định (fixedDeltaTime).
 * @param {number} fixedDeltaTime Khoảng thời gian cố định cho bước cập nhật.
 */
function applyGravityFixed(fixedDeltaTime) {
    if (isJumping) {
        blueDotY += jumpVelocity * fixedDeltaTime;
        jumpVelocity += gravityPx * fixedDeltaTime;

        // Khi chấm chạm lại mặt đất (blueDotBaseY)
        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY; // Đặt về đúng vị trí mặt đất
            isJumping = false; // Kết thúc trạng thái nhảy
            jumpVelocity = 0; // Đặt vận tốc nhảy về 0
        }
    } else {
        // Đảm bảo blueDotY luôn ở blueDotBaseY khi không nhảy
        blueDotY = blueDotBaseY;
    }
}

/**
 * Kiểm tra va chạm giữa chấm xanh và chấm đỏ.
 * Điều chỉnh vị trí chấm xanh nếu va chạm xảy ra và đảo chiều di chuyển.
 * @returns {boolean} True nếu có va chạm, ngược lại False.
 */
function checkCollision() {
    // Tính toán tâm của chấm đỏ (tương đối với textContainer)
    const redCenterX = redDotStatic.offsetLeft + redDotRadiusPx;
    const redCenterY = redDotStatic.offsetTop + redDotRadiusPx; // Đã là hình tròn nên dùng radius

    // Tính toán tâm của chấm xanh
    const blueCenterX = blueDotX + blueDotRadiusPx;
    const blueCenterY = blueDotY + blueDotRadiusPx;

    // Tính khoảng cách giữa hai tâm
    const dx = blueCenterX - redCenterX;
    const dy = blueCenterY - redCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Khoảng cách tối thiểu để hai chấm chạm nhau
    const minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        // Có va chạm
        const overlap = minDistance - distance; // Độ xuyên tâm
        const angle = Math.atan2(dy, dx); // Góc từ tâm đỏ đến tâm xanh

        // Đẩy chấm xanh ra khỏi chấm đỏ để giải quyết va chạm
        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        // Đảo chiều di chuyển của chấm xanh sau va chạm.
        // Cần tinh chỉnh logic này để có cảm giác "nảy" tự nhiên hơn.
        // Hiện tại, nó chỉ đảo chiều dựa vào vị trí tương đối với tâm chấm đỏ.
        if (blueDotX + blueDotRadiusPx > redDotCenterXPx) {
            blueDotDirection = 1; // Di chuyển sang phải
        } else {
            blueDotDirection = -1; // Di chuyển sang trái
        }

        redDotStatic.style.border = '2px solid red'; // Hiệu ứng va chạm
        return true;
    } else {
        redDotStatic.style.border = 'none'; // Không va chạm
        return false;
    }
}

/**
 * Vòng lặp chính của trò chơi (game loop).
 * Sử dụng mô hình Fixed Timestep để tách biệt logic vật lý và render.
 * @param {DOMHighResTimeStamp} timestamp Thời gian hiện tại do requestAnimationFrame cung cấp.
 */
function gameLoop(timestamp) {
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
    }
    let frameDeltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Giới hạn deltaTime để tránh các bước nhảy lớn sau khi tab bị ẩn/hiện hoặc hiệu suất kém
    const MAX_FRAME_DELTA = FIXED_UPDATE_INTERVAL_MS * 5;
    if (frameDeltaTime > MAX_FRAME_DELTA) {
        frameDeltaTime = MAX_FRAME_DELTA;
    }

    accumulatedTime += frameDeltaTime;

    // Lưu vị trí hiện tại trước khi cập nhật vật lý để nội suy sau này
    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    // Cập nhật vật lý với bước thời gian cố định
    while (accumulatedTime >= FIXED_UPDATE_INTERVAL_MS) {
        moveBlueDotFixed(FIXED_UPDATE_INTERVAL_MS);
        applyGravityFixed(FIXED_UPDATE_INTERVAL_MS);
        checkCollision(); // Kiểm tra và xử lý va chạm
        accumulatedTime -= FIXED_UPDATE_INTERVAL_MS;
    }

    // Tính toán alpha cho nội suy
    const alpha = accumulatedTime / FIXED_UPDATE_INTERVAL_MS;
    renderBlueDot(alpha);

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

/**
 * Khởi tạo trạng thái ban đầu của trò chơi và bắt đầu vòng lặp game.
 */
function initializeGame() {
    // Dừng vòng lặp game hiện có nếu có
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastTimestamp = 0;
    accumulatedTime = 0;
    isJumping = false; // Đặt lại trạng thái nhảy
    jumpVelocity = 0;  // Đặt lại vận tốc nhảy

    adjustFontSize(); // Điều chỉnh kích thước và tính toán lại các thông số

    // Thiết lập vị trí ban đầu của chấm xanh
    // Đặt chấm xanh ngay trên chấm đỏ
    blueDotX = redDotCenterXPx - blueDotRadiusPx; // Đảm bảo tâm chấm xanh trùng với tâm chấm đỏ theo X
    blueDotY = blueDotBaseY;

    prevBlueDotX = blueDotX; // Đặt prevX bằng X ban đầu
    prevBlueDotY = blueDotY; // Đặt prevY bằng Y ban đầu

    renderBlueDot(1); // Render chấm xanh ở vị trí ban đầu (không nội suy)

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

/**
 * Xử lý sự kiện thay đổi kích thước cửa sổ.
 * Cập nhật lại các thông số kích thước và vị trí.
 */
function handleResize() {
    adjustFontSize(); // Cập nhật lại kích thước font và các thông số
    // Cập nhật lại các giá trị liên quan đến vị trí và ranh giới
    // Các giá trị này đã được cập nhật trong adjustFontSize,
    // nhưng cần đảm bảo blueDotX và blueDotY nằm trong giới hạn sau khi resize.

    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx;
    } else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx;
    }

    if (!isJumping) {
        blueDotY = blueDotBaseY; // Đảm bảo chấm xanh trở lại mặt đất nếu không nhảy
    }
    // else: nếu đang nhảy, để vật lý tự xử lý blueDotY

    prevBlueDotX = blueDotX; // Cập nhật prevX để render đúng
    prevBlueDotY = blueDotY; // Cập nhật prevY để render đúng

    renderBlueDot(1); // Render ngay lập tức sau khi resize
}

// --- THIẾT LẬP CÁC SỰ KIỆN ---

// Khởi tạo game khi toàn bộ tài nguyên đã được tải
addEvent(window, 'load', initializeGame);

// Các sự kiện để kích hoạt nhảy
addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);
addEvent(window, 'keydown', function(event) {
    // Ngăn chặn hành vi mặc định của phím (ví dụ: cuộn trang)
    if (event.preventDefault) {
        event.preventDefault();
    }
    jump();
});
addEvent(window, 'contextmenu', function(event) {
    // Ngăn chặn menu ngữ cảnh chuột phải
    if (event.preventDefault) {
        event.preventDefault();
    }
    jump();
});

// Sự kiện resize để thích ứng với thay đổi kích thước màn hình
addEvent(window, 'resize', handleResize);
