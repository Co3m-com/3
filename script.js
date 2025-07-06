(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz', 'ms'];
    var x;
    for(x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() {
                callback(currTime + timeToCall);
            }, timeToCall);
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
    if (!element) {
        return;
    }
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

const textContainer = document.getElementById('co3m-text')?.parentNode;
const co3mText = document.getElementById('co3m-text');
const comText = document.getElementById('com-text');
const redDotStatic = document.getElementById('red-dot-static-id');
const blueDotMoving = document.getElementById('blue-dot-moving-id');
const fullscreenOverlay = document.getElementsByClassName('fullscreen-overlay')[0];

if (!textContainer || !co3mText || !comText || !redDotStatic || !blueDotMoving || !fullscreenOverlay) {
    console.error("Error: Missing one or more essential DOM elements. Check IDs/Classes.");
    throw new Error("Game initialization failed: Missing essential DOM elements.");
}

let blueDotX;
let blueDotY;
let blueDotDirection = 1;

const DOT_RATIO_TO_FONT_HEIGHT = 0.3;

const MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.002;
const MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8;

const DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.27;
const GRAVITY_RATIO_TO_FONT_HEIGHT = 0.00003;

const FIXED_UPDATE_INTERVAL_MS = 20;

const TEST_FONT_SIZE = 100;
const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 3000;

let moveSpeedPx;
let actualJumpHeightPx;
let gravityPx;
let movementLimitPx;
let currentFontSizePx;

let isJumping = false;
let jumpVelocity = 0;
let blueDotBaseY;

let redDotRadiusPx;
let blueDotRadiusPx;

let redDotCenterXPx;
let leftBoundaryPx;
let rightBoundaryPx;

let animationFrameId = null;
let lastTimestamp = 0;
let accumulatedTime = 0;

let prevBlueDotX;
let prevBlueDotY;

function adjustFontSize() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const desiredWidthVW = 18 * 5.6;
    const desiredWidthPx = (desiredWidthVW / 100) * viewportWidth;

    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';

    const testDotSizePx = TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = testDotSizePx + 'px';
    redDotStatic.style.height = testDotSizePx + 'px';

    let textContainerWidthAtTestSize = textContainer.offsetWidth;
    if (textContainerWidthAtTestSize === 0) {
        console.warn("textContainer.offsetWidth is 0. Using 1 to prevent division by zero.");
        textContainerWidthAtTestSize = 1;
    }

    let newFontSize = TEST_FONT_SIZE * (desiredWidthPx / textContainerWidthAtTestSize);
    currentFontSizePx = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    co3mText.style.fontSize = currentFontSizePx + 'px';
    comText.style.fontSize = currentFontSizePx + 'px';

    const dotSizePx = currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT;
    redDotStatic.style.width = dotSizePx + 'px';
    redDotStatic.style.height = dotSizePx + 'px';
    blueDotMoving.style.width = dotSizePx + 'px';
    blueDotMoving.style.height = dotSizePx + 'px';

    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    const redDotRect = redDotStatic.getBoundingClientRect();
    const textContainerRect = textContainer.getBoundingClientRect();

    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    blueDotBaseY = redDotStatic.offsetTop + redDotStatic.offsetHeight - blueDotMoving.offsetHeight;
}

function renderBlueDot(alpha) {
    const interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    const interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

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
        isJumping = true;
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
        blueDotY = blueDotBaseY;
    }
}

function checkCollision() {
    const redCenterX = redDotStatic.offsetLeft + redDotRadiusPx;
    const redCenterY = redDotStatic.offsetTop + redDotRadiusPx;

    const blueCenterX = blueDotX + blueDotRadiusPx;
    const blueCenterY = blueDotY + blueDotRadiusPx;

    const dx = blueCenterX - redCenterX;
    const dy = blueCenterY - redCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const minDistance = redDotRadiusPx + blueDotRadiusPx;

    if (distance < minDistance) {
        const overlap = minDistance - distance;
        const angle = Math.atan2(dy, dx);

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
    let frameDeltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const MAX_FRAME_DELTA = FIXED_UPDATE_INTERVAL_MS * 5;
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

    const alpha = accumulatedTime / FIXED_UPDATE_INTERVAL_MS;
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
    isJumping = false;
    jumpVelocity = 0;

    adjustFontSize();

    blueDotX = redDotCenterXPx - blueDotRadiusPx;
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
    adjustFontSize();

    if (blueDotX > rightBoundaryPx) {
        blueDotX = rightBoundaryPx;
    } else if (blueDotX < leftBoundaryPx) {
        blueDotX = leftBoundaryPx;
    }

    if (!isJumping) {
        blueDotY = blueDotBaseY;
    }

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);
});
