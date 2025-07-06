(function() {
    if (!window.requestAnimationFrame) {
        let lastTime = 0;
        window.requestAnimationFrame = function(callback) {
            const currTime = performance.now();
            const timeToCall = Math.max(0, 16 - (currTime - lastTime));
            const id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
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
        element.addEventListener(eventName, callback, { passive: true });
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

const textContainer = document.getElementById('co3m-text').parentNode;
const co3mText = document.getElementById('co3m-text');
const comText = document.getElementById('com-text');
const redDotStatic = document.getElementById('red-dot-static-id');
const blueDotMoving = document.getElementById('blue-dot-moving-id');
const fullscreenOverlay = document.getElementsByClassName('fullscreen-overlay')[0];

let blueDotX;
let blueDotY;
let blueDotDirection = 1;

const DOT_RATIO_TO_FONT_HEIGHT = 0.3;
const MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.1;
const MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8;
const DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.09;
const GRAVITY_RATIO_TO_FONT_HEIGHT = 0.00003;
const FIXED_UPDATE_INTERVAL_MS = 10;

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

    const TEST_FONT_SIZE = 100;
    const MIN_FONT_SIZE = 20;
    const MAX_FONT_SIZE = 3000;

    co3mText.style.fontSize = TEST_FONT_SIZE + 'px';
    comText.style.fontSize = TEST_FONT_SIZE + 'px';
    redDotStatic.style.width = (TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT) + 'px';
    redDotStatic.style.height = (TEST_FONT_SIZE * DOT_RATIO_TO_FONT_HEIGHT) + 'px';

    let textContainerWidthAtTestSize = textContainer.offsetWidth;
    if (textContainerWidthAtTestSize === 0) {
        textContainerWidthAtTestSize = 1;
    }

    let newFontSize = TEST_FONT_SIZE * (desiredWidthPx / textContainerWidthAtTestSize);
    newFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newFontSize));

    if (newFontSize !== currentFontSizePx) {
        currentFontSizePx = newFontSize;

        co3mText.style.fontSize = currentFontSizePx + 'px';
        comText.style.fontSize = currentFontSizePx + 'px';

        const dotSizePx = currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT;
        redDotStatic.style.width = dotSizePx + 'px';
        redDotStatic.style.height = dotSizePx + 'px';
        blueDotMoving.style.width = dotSizePx + 'px';
        blueDotMoving.style.height = dotSizePx + 'px';
    }

    moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
    movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;
}

function renderBlueDot(alpha) {
    const interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    const interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;
    blueDotMoving.style.transform = `translate(${interpolatedX}px, ${interpolatedY}px)`;
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
    const blueCenterX = blueDotX + blueDotRadiusPx;
    const blueCenterY = blueDotY + blueDotRadiusPx;

    const dx = blueCenterX - redDotCenterXPx;
    const dy = blueCenterY - (redDotStatic.offsetTop + redDotRadiusPx);

    const distanceSquared = dx * dx + dy * dy;
    const minDistanceSquared = (redDotRadiusPx + blueDotRadiusPx) * (redDotRadiusPx + blueDotRadiusPx);

    if (distanceSquared < minDistanceSquared) {
        if (redDotStatic.style.border !== '2px solid red') {
            redDotStatic.style.border = '2px solid red';
        }

        if (dx > 0) {
            blueDotDirection = 1;
        } else {
            blueDotDirection = -1;
        }
        return true;
    } else {
        if (redDotStatic.style.border !== 'none') {
            redDotStatic.style.border = 'none';
        }
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

    adjustFontSize();

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    const redDotRect = redDotStatic.getBoundingClientRect();
    const textContainerRect = textContainer.getBoundingClientRect();

    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;
    blueDotBaseY = redDotRect.bottom - blueDotMoving.offsetHeight - textContainerRect.top;

    leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
    rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

    blueDotX = Math.min(rightBoundaryPx, Math.max(leftBoundaryPx, redDotCenterXPx + redDotRadiusPx));
    blueDotY = blueDotBaseY;

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);

    animationFrameId = window.requestAnimationFrame(gameLoop);
}

addEvent(window, 'DOMContentLoaded', initializeGame);

addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);

addEvent(window, 'keydown', function(event) {
    if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        jump();
    }
});

addEvent(window, 'resize', function() {
    if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = window.requestAnimationFrame(() => {
        adjustFontSize();
        redDotRadiusPx = redDotStatic.offsetWidth / 2;
        blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

        const redDotRect = redDotStatic.getBoundingClientRect();
        const textContainerRect = textContainer.getBoundingClientRect();
        redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

        leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
        rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

        blueDotBaseY = redDotRect.bottom - blueDotMoving.offsetHeight - textContainerRect.top;

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
        lastTimestamp = performance.now();
        accumulatedTime = 0;
        animationFrameId = window.requestAnimationFrame(gameLoop);
    });
});
