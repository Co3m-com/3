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

var DOT_RATIO_TO_FONT_HEIGHT = 0.3;
// We'll now define movement based on time for consistency
var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.29;
var GRAVITY_RATIO_TO_FONT_HEIGHT = 0.00003;

var FIXED_UPDATE_INTERVAL_MS = 10; // The fixed time step for physics updates

// New constants for timing-based movement
var TOTAL_MOVEMENT_DURATION_MS = 201; // Total duration for one full cycle (left to right and back)
var OBSTACLE_CENTER_TIME_MS = 101; // Time when the blue dot should be at the red dot's center

// Derived values
var HALF_MOVEMENT_DURATION_MS = TOTAL_MOVEMENT_DURATION_MS / 2; // Time to travel from one end to the other (e.g., left to right boundary)

var moveSpeedPxPerMs; // Pixels per millisecond
var actualJumpHeightPx;
var gravityPxPerMsSquared; // Pixels per millisecond squared
var movementLimitPx; // The maximum displacement from the center point

var currentFontSizePx;

var isJumping = false;
var jumpVelocityPxPerMs = 0; // Jump velocity in pixels per millisecond
var blueDotBaseY;

var redDotRadiusPx;
var blueDotRadiusPx;

var redDotCenterXPx; // X coordinate of the red dot's center relative to textContainer
var leftBoundaryPx;  // Absolute X coordinate for the left movement limit of blue dot
var rightBoundaryPx; // Absolute X coordinate for the right movement limit of blue dot

var animationFrameId = null;
var lastTimestamp = 0;
var accumulatedTime = 0;

var prevBlueDotX;
var prevBlueDotY;

// Track the current time in the movement cycle
var currentMovementTimeMs = 0;

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

    // Recalculate physics parameters based on new font size
    actualJumpHeightPx = currentFontSizePx * DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT;
    gravityPxPerMsSquared = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;

    // The maximum displacement for the blue dot from the red dot's center.
    // This defines the total horizontal travel distance.
    movementLimitPx = (currentFontSizePx * DOT_RATIO_TO_FONT_HEIGHT) * 3; // Example: 3 times the dot size as movement limit. Adjust as needed for visual range.

    // Calculate speed based on the desired movement time and pixel range
    // moveSpeedPxPerMs = (movementLimitPx * 2) / TOTAL_MOVEMENT_DURATION_MS;
    // For a more precise setup: the dot moves 'movementLimitPx' in 'HALF_MOVEMENT_DURATION_MS'
    moveSpeedPxPerMs = movementLimitPx / HALF_MOVEMENT_DURATION_MS;
}

function renderBlueDot(alpha) {
    // Interpolate for smooth animation between fixed updates
    var interpolatedX = prevBlueDotX + (blueDotX - prevBlueDotX) * alpha;
    var interpolatedY = prevBlueDotY + (blueDotY - prevBlueDotY) * alpha;

    blueDotMoving.style.left = interpolatedX + 'px';
    blueDotMoving.style.top = interpolatedY + 'px';
}

function moveBlueDotFixed(fixedDeltaTime) {
    // Update the movement time
    currentMovementTimeMs += fixedDeltaTime;

    // Ensure currentMovementTimeMs stays within one full cycle
    currentMovementTimeMs %= TOTAL_MOVEMENT_DURATION_MS;

    // Calculate blue dot's position based on time in the cycle
    var positionInCycle = currentMovementTimeMs;

    if (positionInCycle <= HALF_MOVEMENT_DURATION_MS) {
        // Moving from left extreme towards right extreme (0 to HALF_MOVEMENT_DURATION_MS)
        // Position will go from -movementLimitPx to 0, then 0 to movementLimitPx
        // From 0 to HALF_MOVEMENT_DURATION_MS, relative position goes from -movementLimitPx to +movementLimitPx
        var progress = positionInCycle / HALF_MOVEMENT_DURATION_MS; // 0 to 1
        var relativeX = -movementLimitPx + (2 * movementLimitPx * progress); // -movementLimitPx to +movementLimitPx
        blueDotX = redDotCenterXPx + relativeX - blueDotRadiusPx;
    } else {
        // Moving from right extreme back towards left extreme (HALF_MOVEMENT_DURATION_MS to TOTAL_MOVEMENT_DURATION_MS)
        // From HALF_MOVEMENT_DURATION_MS to TOTAL_MOVEMENT_DURATION_MS, relative position goes from +movementLimitPx to -movementLimitPx
        var timeAfterHalf = positionInCycle - HALF_MOVEMENT_DURATION_MS;
        var progress = timeAfterHalf / HALF_MOVEMENT_DURATION_MS; // 0 to 1
        var relativeX = movementLimitPx - (2 * movementLimitPx * progress); // +movementLimitPx to -movementLimitPx
        blueDotX = redDotCenterXPx + relativeX - blueDotRadiusPx;
    }

    // Set direction for collision logic, though the primary movement is now time-based
    if (blueDotX > prevBlueDotX) {
        blueDotDirection = 1; // Moving right
    } else if (blueDotX < prevBlueDotX) {
        blueDotDirection = -1; // Moving left
    }
}


function jump() {
    if (!isJumping) {
        isJumping = true;
        // Calculate initial jump velocity based on desired jump height and gravity
        jumpVelocityPxPerMs = -Math.sqrt(2 * gravityPxPerMsSquared * actualJumpHeightPx);
    }
}

function applyGravityFixed(fixedDeltaTime) {
    if (isJumping) {
        blueDotY += jumpVelocityPxPerMs * fixedDeltaTime;
        jumpVelocityPxPerMs += gravityPxPerMsSquared * fixedDeltaTime;

        if (blueDotY >= blueDotBaseY) {
            blueDotY = blueDotBaseY;
            isJumping = false;
            jumpVelocityPxPerMs = 0;
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
        // Collision detected
        var overlap = minDistance - distance;
        var angle = Math.atan2(dy, dx);

        // Adjust blue dot position to prevent overlap
        blueDotX += Math.cos(angle) * overlap;
        blueDotY += Math.sin(angle) * overlap;

        redDotStatic.style.border = '2px solid red'; // Indicate collision visually
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

    // Cap the frame delta to prevent "spiral of death" in case of major lag
    var MAX_FRAME_DELTA = FIXED_UPDATE_INTERVAL_MS * 5;
    if (frameDeltaTime > MAX_FRAME_DELTA) {
        frameDeltaTime = MAX_FRAME_DELTA;
    }

    accumulatedTime += frameDeltaTime;

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    // Fixed update loop
    while (accumulatedTime >= FIXED_UPDATE_INTERVAL_MS) {
        moveBlueDotFixed(FIXED_UPDATE_INTERVAL_MS);
        applyGravityFixed(FIXED_UPDATE_INTERVAL_MS);
        checkCollision();
        accumulatedTime -= FIXED_UPDATE_INTERVAL_MS;
    }

    // Render with interpolation for smoothness
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
    currentMovementTimeMs = 0; // Reset movement time on initialization

    adjustFontSize();

    redDotRadiusPx = redDotStatic.offsetWidth / 2;
    blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

    var redDotRect = redDotStatic.getBoundingClientRect();
    var textContainerRect = textContainer.getBoundingClientRect();

    // Calculate red dot's center relative to its parent container (textContainer)
    redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

    // Initialize blue dot at the "center" of its movement cycle
    // We want the blue dot to be precisely at the red dot's center when currentMovementTimeMs is OBSTACLE_CENTER_TIME_MS (101ms)
    // The current logic sets it to 0ms. Let's adjust the starting currentMovementTimeMs
    currentMovementTimeMs = OBSTACLE_CENTER_TIME_MS; // Start the game with the blue dot at the obstacle's center time

    // Calculate initial position based on currentMovementTimeMs
    var positionInCycle = currentMovementTimeMs;
    if (positionInCycle <= HALF_MOVEMENT_DURATION_MS) {
        var progress = positionInCycle / HALF_MOVEMENT_DURATION_MS;
        var relativeX = -movementLimitPx + (2 * movementLimitPx * progress);
        blueDotX = redDotCenterXPx + relativeX - blueDotRadiusPx;
    } else {
        var timeAfterHalf = positionInCycle - HALF_MOVEMENT_DURATION_MS;
        var progress = timeAfterHalf / HALF_MOVEMENT_DURATION_MS;
        var relativeX = movementLimitPx - (2 * movementLimitPx * progress);
        blueDotX = redDotCenterXPx + relativeX - blueDotRadiusPx;
    }

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    blueDotY = blueDotBaseY;

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1); // Render immediately after initialization

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

    // Re-calculate blue dot's position based on the current movement time
    // This helps maintain visual consistency during resize.
    var positionInCycle = currentMovementTimeMs;
    if (positionInCycle <= HALF_MOVEMENT_DURATION_MS) {
        var progress = positionInCycle / HALF_MOVEMENT_DURATION_MS;
        var relativeX = -movementLimitPx + (2 * movementLimitPx * progress);
        blueDotX = redDotCenterXPx + relativeX - blueDotRadiusPx;
    } else {
        var timeAfterHalf = positionInCycle - HALF_MOVEMENT_DURATION_MS;
        var progress = timeAfterHalf / HALF_MOVEMENT_DURATION_MS;
        var relativeX = movementLimitPx - (2 * movementLimitPx * progress);
        blueDotX = redDotCenterXPx + relativeX - blueDotRadiusPx;
    }

    var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
    blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

    if (!isJumping) {
        blueDotY = blueDotBaseY;
    }
    // If jumping, blueDotY is already being managed by gravity, so don't reset it

    prevBlueDotX = blueDotX;
    prevBlueDotY = blueDotY;

    renderBlueDot(1);
});
