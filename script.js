(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window['webkitRequestAnimationFrame'];
        window.cancelAnimationFrame =
            window['webkitCancelAnimationFrame'] || window['webkitCancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback) {
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
var scoreDisplay = document.getElementById('score-display');

var blueDotX;
var blueDotY;
var blueDotDirection = 1;

var DOT_RATIO_TO_FONT_HEIGHT = 0.3;
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.009;
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.5;

var DESIRED_JUMP_HEIGHT_RATIO_TO_RED_DOT_HEIGHT = 1.6;
var GRAVITY_RATIO_TO_RED_DOT_HEIGHT_PER_MS_SQUARED = 0.013 / (16 * 16);

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

var score = 0;
var blueDotSideOfRedDotBeforeJump;
var hasScoredThisJump = false;
var justScoredAndLanded = false;

var hasReversedOnCollision = false;

// Biến để lưu trạng thái game
var gameState = {
    blueDotX: 0,
    blueDotY: 0,
    blueDotDirection: 1,
    score: 0,
    isJumping: false,
    jumpVelocity: 0,
    hasScoredThisJump: false,
    justScoredAndLanded: false,
    hasReversedOnCollision: false
};

function saveGameState() {
    gameState.blueDotX = blueDotX;
    gameState.blueDotY = blueDotY;
    gameState.blueDotDirection = blueDotDirection;
    gameState.score = score;
    gameState.isJumping = isJumping;
    gameState.jumpVelocity = jumpVelocity;
    gameState.hasScoredThisJump = hasScoredThisJump;
    gameState.justScoredAndLanded = justScoredAndLanded;
    gameState.hasReversedOnCollision = hasReversedOnCollision;
    try {
        localStorage.setItem('game_state', JSON.stringify(gameState));
    } catch (e) {
        console.error("Lỗi khi lưu trạng thái game vào localStorage:", e);
    }
}

function loadGameState() {
    try {
        var savedState = localStorage.getItem('game_state');
        if (savedState) {
            gameState = JSON.parse(savedState);
            blueDotX = gameState.blueDotX;
            blueDotY = gameState.blueDotY;
            blueDotDirection = gameState.blueDotDirection;
            score = gameState.score;
            isJumping = gameState.isJumping;
            jumpVelocity = gameState.jumpVelocity;
            hasScoredThisJump = gameState.hasScoredThisJump;
            justScoredAndLanded = gameState.justScoredAndLanded;
            hasReversedOnCollision = gameState.hasReversedOnCollision;
            return true;
        }
    } catch (e) {
        console.error("Lỗi khi tải trạng thái game từ localStorage:", e);
        localStorage.removeItem('game_state'); // Xóa trạng thái lỗi
    }
    return false;
}

function resetGameToInitialState() {
    score = 0;
    isJumping = false;
    hasReversedOnCollision = false;
    blueDotDirection = 1; // Khởi tạo hướng mặc định
    hasScoredThisJump = false;
    justScoredAndLanded = false;
    // Xóa trạng thái đã lưu
    localStorage.removeItem('game_state');
}

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
    blueDotMoving.style.width = testDotSizePx + 'px';
    blueDotMoving.style.height = testDotSizePx + 'px';

    var tempOffsetWidth = textContainer.offsetWidth;

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

    var tempRedDotOffsetHeight = redDotStatic.offsetHeight;
    var tempBlueDotOffsetHeight = blueDotMoving.offsetHeight;

    var redDotActualHeight = redDotStatic.offsetHeight;
    var blueDotActualHeight = blueDotMoving.offsetHeight;

    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

    actualJumpHeightPx = redDotActualHeight * DESIRED_JUMP_HEIGHT_RATIO_TO_RED_DOT_HEIGHT;
    gravityPx = redDotActualHeight * GRAVITY_RATIO_TO_RED_DOT_HEIGHT_PER_MS_SQUARED * (FIXED_UPDATE_INTERVAL_MS * FIXED_UPDATE_INTERVAL_MS);

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotActualHeight;
}

function renderBlueDot() {
    blueDotMoving.style.left = blueDotX + 'px';
    blueDotMoving.style.top = blueDotY + 'px';
}

function moveBlueDotFixed(fixedDeltaTime) {
    var previousBlueDotDirection = blueDotDirection;

    blueDotX += moveSpeedPx * blueDotDirection * (fixedDeltaTime / FIXED_UPDATE_INTERVAL_MS);

    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx;
        blueDotDirection *= -1;
        hasReversedOnCollision = false;
        if (!isJumping && blueDotDirection !== previousBlueDotDirection) {
            if (justScoredAndLanded) {
                justScoredAndLanded = false;
            } else {
                resetScore();
            }
        }
    } else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx;
        blueDotDirection *= -1;
        hasReversedOnCollision = false;
        if (!isJumping && blueDotDirection !== previousBlueDotDirection) {
            if (justScoredAndLanded) {
                justScoredAndLanded = false;
            } else {
                resetScore();
            }
        }
    }
    saveGameState(); // Lưu trạng thái sau mỗi lần di chuyển
}

function jump() {
    if (!isJumping) {
        isJumping = true;
        jumpVelocity = -Math.sqrt(2 * gravityPx * actualJumpHeightPx);
        hasScoredThisJump = false;
        justScoredAndLanded = false;
        hasReversedOnCollision = false;

        var blueDotCenter = blueDotX + blueDotRadiusPx;
        var margin = redDotRadiusPx * 0.1;

        if (blueDotCenter < redDotCenterXPx - margin) {
            blueDotSideOfRedDotBeforeJump = 'left';
        } else if (blueDotCenter > redDotCenterXPx + margin) {
            blueDotSideOfRedDotBeforeJump = 'right';
        } else {
            if (blueDotDirection === 1) {
                blueDotSideOfRedDotBeforeJump = 'left';
            } else {
                blueDotSideOfRedDotBeforeJump = 'right';
            }
        }
        saveGameState(); // Lưu trạng thái sau khi nhảy
    }
}

function applyGravityFixed(fixedDeltaTime) {
    if (isJumping) {
        blueDotY += jumpVelocity * (fixedDeltaTime / FIXED_UPDATE_INTERVAL_MS);
        jumpVelocity += gravityPx * (fixedDeltaTime / FIXED_UPDATE_INTERVAL_MS);

        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocity = 0;
            hasReversedOnCollision = false;

            var blueDotCenter = blueDotX + blueDotRadiusPx;
            var blueDotSideOfRedDotAfterJump;
            var margin = redDotRadiusPx * 0.1;

            if (blueDotCenter < redDotCenterXPx - margin) {
                blueDotSideOfRedDotAfterJump = 'left';
            } else if (blueDotCenter > redDotCenterXPx + margin) {
                blueDotSideOfRedDotAfterJump = 'right';
            } else {
                if (blueDotDirection === 1) {
                    blueDotSideOfRedDotAfterJump = 'right';
                } else {
                    blueDotSideOfRedDotAfterJump = 'left';
                }
            }

            if (blueDotSideOfRedDotBeforeJump !== blueDotSideOfRedDotAfterJump) {
                if (!hasScoredThisJump) {
                    score++;
                    updateScoreDisplay();
                    hideCo3mComText();
                    hasScoredThisJump = true;
                    justScoredAndLanded = true;
                }
            } else {
                resetScore();
                justScoredAndLanded = false;
            }
        }
    } else {
        var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
        blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;
        blueDotY = blueDotBaseY;
    }
    saveGameState(); // Lưu trạng thái sau khi áp dụng trọng lực
}

function checkCollision() {
    var redCenterX = redDotStatic.offsetLeft + (redDotStatic.offsetWidth / 2);
    var redCenterY = redDotStatic.offsetTop + (redDotStatic.offsetHeight / 2);

    var blueDotCurrentCenterX = blueDotX + blueDotRadiusPx;
    var blueDotCurrentCenterY = blueDotY + blueDotRadiusPx;

    var dx = blueDotCurrentCenterX - redCenterX;
    var dy = blueDotCurrentCenterY - redCenterY;
    var distance = Math.sqrt(dx * dx + dy * dy);

    var minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        redDotStatic.style.border = '2px solid red';

        var overlap = minDistance - distance;
        var angle = Math.atan2(dy, dx);

        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        if (!hasReversedOnCollision) {
            blueDotDirection *= -1;
            hasReversedOnCollision = true;
        }
        saveGameState(); // Lưu trạng thái sau khi va chạm
        return true;
    } else {
        redDotStatic.style.border = 'none';
        hasReversedOnCollision = false;
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

    while (accumulatedTime >= FIXED_UPDATE_INTERVAL_MS) {
        moveBlueDotFixed(FIXED_UPDATE_INTERVAL_MS);
        applyGravityFixed(FIXED_UPDATE_INTERVAL_MS);
        checkCollision();
        accumulatedTime -= FIXED_UPDATE_INTERVAL_MS;
    }

    renderBlueDot();

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

function updateScoreDisplay() {
    if (score > 0) {
        scoreDisplay.textContent = score;
        scoreDisplay.style.opacity = '0.7';

        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        scoreDisplay.style.fontSize = (viewportHeight * 0.8) + 'px';

        scoreDisplay.style.marginLeft = - (scoreDisplay.offsetWidth / 2) + 'px';
        scoreDisplay.style.marginTop = - (scoreDisplay.offsetHeight / 2) + 'px';

    } else {
        scoreDisplay.style.opacity = '0';
        scoreDisplay.textContent = '';
    }
}

function resetScore() {
    score = 0;
    updateScoreDisplay();
    showCo3mComText();
    hasScoredThisJump = false;
    justScoredAndLanded = false;
    localStorage.removeItem('game_state'); // Xóa trạng thái game khi reset điểm
}

function hideCo3mComText() {
    co3mText.style.opacity = '0';
    comText.style.opacity = '0';
}

function showCo3mComText() {
    co3mText.style.opacity = '1';
    comText.style.opacity = '1';
}

function initializeGame() {
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastTimestamp = 0;
    accumulatedTime = 0;

    adjustFontSize();

    var tempRedDotOffsetWidth = redDotStatic.offsetWidth;
    var tempBlueDotOffsetWidth = blueDotMoving.offsetWidth;

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();

    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    if (!loadGameState()) {
        // Nếu không có trạng thái đã lưu, khởi tạo game mới
        resetGameToInitialState();
        // Đặt vị trí ban đầu của blueDot khi game mới
        blueDotX = redDotCenterXPx + redDotRadiusPx;
        blueDotY = blueDotBaseY;
    } else {
        // Nếu có trạng thái đã lưu, đảm bảo blueDotY được tính toán lại sau resize
        blueDotY = blueDotBaseY; // Đặt lại blueDotY dựa trên kích thước hiện tại
    }

    updateScoreDisplay(); // Cập nhật hiển thị điểm khi khởi tạo game

    if (score > 0) { // Nếu có điểm, ẩn chữ CO3M.COM
        hideCo3mComText();
    } else { // Nếu không có điểm, hiển thị chữ CO3M.COM
        showCo3mComText();
    }
    
    renderBlueDot();
    animationFrameId = window.requestAnimationFrame(gameLoop);
}

addEvent(window, 'load', initializeGame);
addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);
addEvent(window, 'keydown', function(event) {
    if (event.code === 'Space' || event.key === ' ' || event.keyCode === 32) {
        event.preventDefault();
        jump();
    }
});
addEvent(window, 'contextmenu', function(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    jump();
});
addEvent(window, 'resize', function() {
    // Không reset score khi resize
    var currentScore = score; // Lưu điểm hiện tại
    var currentBlueDotX = blueDotX; // Lưu vị trí X hiện tại
    var currentBlueDotY = blueDotY; // Lưu vị trí Y hiện tại
    var currentBlueDotDirection = blueDotDirection; // Lưu hướng hiện tại
    var currentIsJumping = isJumping;
    var currentJumpVelocity = jumpVelocity;
    var currentHasScoredThisJump = hasScoredThisJump;
    var currentJustScoredAndLanded = justScoredAndLanded;
    var currentHasReversedOnCollision = hasReversedOnCollision;

    adjustFontSize(); // Chỉ điều chỉnh kích thước

    // Sau khi adjustFontSize, các biến liên quan đến vị trí và kích thước đã được cập nhật
    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    // Khôi phục trạng thái game
    score = currentScore;
    blueDotX = currentBlueDotX;
    blueDotY = currentBlueDotY;
    blueDotDirection = currentBlueDotDirection;
    isJumping = currentIsJumping;
    jumpVelocity = currentJumpVelocity;
    hasScoredThisJump = currentHasScoredThisJump;
    justScoredAndLanded = currentJustScoredAndLanded;
    hasReversedOnCollision = currentHasReversedOnCollision;
    blueDotBaseY = redDotStatic.offsetTop + redDotStatic.offsetHeight - blueDotMoving.offsetHeight; // Đảm bảo blueDotBaseY cập nhật đúng sau resize

    updateScoreDisplay();
    if (score > 0) {
        hideCo3mComText();
    } else {
        showCo3mComText();
    }
    renderBlueDot(); // Cập nhật vị trí hiển thị ngay lập tức
});

// Lắng nghe sự kiện offline/online để kiểm soát Service Worker
addEvent(window, 'offline', function() {
    console.log('Bạn đang offline. Trò chơi sẽ tiếp tục.');
});

addEvent(window, 'online', function() {
    console.log('Bạn đã online trở lại.');
});

