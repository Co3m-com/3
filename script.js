(function () {
var lastTime = 0;
var vendors = ['webkit', 'moz'];
var x;
for (x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
window.requestAnimationFrame = window['webkitRequestAnimationFrame'];
window.cancelAnimationFrame =
window['webkitCancelAnimationFrame'] ||
window['webkitCancelRequestAnimationFrame'];
}

if (!window.requestAnimationFrame) {
window.requestAnimationFrame = function (callback, element) {
var currTime = new Date().getTime();
var timeToCall = Math.max(0, 16 - (currTime - lastTime));
var id = window.setTimeout(function () {
callback(currTime + timeToCall);
}, timeToCall);
lastTime = currTime + timeToCall;
return id;
};
}

if (!window.cancelAnimationFrame) {
window.cancelAnimationFrame = function (id) {
clearTimeout(id);
};
}
})();

function addEvent(element, eventName, callback) {
if (element.addEventListener) {
element.addEventListener(eventName, callback, false);
} else if (element.attachEvent) {
element.attachEvent('on' + eventName, function (e) {
e = e || window.event;
e.target = e.target || e.srcElement;
e.preventDefault = e.preventDefault || function () { e.returnValue = false; };
e.stopPropagation = e.stopPropagation || function () { e.cancelBubble = true; };
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
var blueDotDirection = 1; // 1 = sang phải, -1 = sang trái

var DOT_RATIO_TO_FONT_HEIGHT = 0.3;
var MOVE_SPEED_RATIO_TO_FONT_HEIGHT = 0.03;
// var DESIRED_JUMP_HEIGHT_RATIO_TO_FONT_HEIGHT = 0.35; // Không dùng nữa
var GRAVITY_RATIO_TO_FONT_HEIGHT = 0.005;
var MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT = 0.8;

var DESIRED_JUMP_HEIGHT_VW = 5; // Chiều cao nhảy mong muốn là 4vw

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

var score = 0;
var blueDotSideOfRedDotBeforeJump;
var hasScoredThisJump = false;

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

// Tính toán chiều cao nhảy dựa trên 4vw
actualJumpHeightPx = (DESIRED_JUMP_HEIGHT_VW / 100) * viewportWidth;

// Các giá trị khác vẫn tính dựa trên currentFontSizePx nếu bạn muốn chúng tương đối với kích thước văn bản
moveSpeedPx = currentFontSizePx * MOVE_SPEED_RATIO_TO_FONT_HEIGHT;
gravityPx = currentFontSizePx * GRAVITY_RATIO_TO_FONT_HEIGHT;
movementLimitPx = currentFontSizePx * MOVEMENT_LIMIT_RATIO_TO_FONT_HEIGHT;

// Đã loại bỏ dòng này để CSS xử lý font-size của scoreDisplay
// scoreDisplay.style.fontSize = (currentFontSizePx * 1.6) + 'px';
}

function updateBlueDotPosition() {
blueDotMoving.style.left = blueDotX + 'px';
blueDotMoving.style.top = blueDotY + 'px';
}

function moveBlueDot(deltaTime) {
blueDotX += moveSpeedPx * blueDotDirection * deltaTime * 60;

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
hasScoredThisJump = false;

var blueDotCenter = blueDotX + blueDotRadiusPx;
if (blueDotCenter < redDotCenterXPx) {
blueDotSideOfRedDotBeforeJump = 'left';
} else {
blueDotSideOfRedDotBeforeJump = 'right';
}
}
}

function applyGravity(deltaTime) {
if (isJumping) {
blueDotY += jumpVelocity * deltaTime * 60;
jumpVelocity += gravityPx * deltaTime * 60;

if (blueDotY >= blueDotBaseY) {
blueDotY = blueDotBaseY;
isJumping = false;
jumpVelocity = 0;

var blueDotCenter = blueDotX + blueDotRadiusPx;
var blueDotSideOfRedDotAfterJump;

if (blueDotCenter < redDotCenterXPx) {
blueDotSideOfRedDotAfterJump = 'left';
} else {
blueDotSideOfRedDotAfterJump = 'right';
}

if (blueDotSideOfRedDotBeforeJump !== blueDotSideOfRedDotAfterJump) {
if (!hasScoredThisJump) {
score++;
updateScoreDisplay();
hideCo3mComText();
hasScoredThisJump = true;
}
} else {
resetScore();
}
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
redDotStatic.style.border = '2px solid red';

var overlap = minDistance - distance;
var angle = Math.atan2(dy, dx);

blueDotX += Math.cos(angle) * overlap;
blueDotY += Math.sin(angle) * overlap;

blueDotDirection *= -1;

if (hasScoredThisJump && !isJumping) {
resetScore();
}

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
var deltaTime = (timestamp - lastTimestamp) / 1000;
lastTimestamp = timestamp;

moveBlueDot(deltaTime);
applyGravity(deltaTime);
checkCollision();
updateBlueDotPosition();
animationFrameId = window.requestAnimationFrame(gameLoop);
}

function updateScoreDisplay() {
if (score > 0) {
scoreDisplay.textContent = score;
scoreDisplay.style.opacity = '0.7'; // Hoặc 1 nếu bạn muốn nó hiện rõ
} else {
scoreDisplay.style.opacity = '0';
scoreDisplay.textContent = ''; // Xóa nội dung khi ẩn
}
}

function resetScore() {
score = 0;
updateScoreDisplay();
showCo3mComText();
hasScoredThisJump = false;
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
resetScore();

adjustFontSize(); // Gọi để cập nhật các giá trị kích thước

redDotRadiusPx = redDotStatic.offsetWidth / 2;
blueDotRadiusPx = blueDotMoving.offsetWidth / 2;

var redDotRect = redDotStatic.getBoundingClientRect();
var textContainerRect = textContainer.getBoundingClientRect();

redDotCenterXPx = redDotRect.left + redDotRadiusPx - textContainerRect.left;

leftBoundaryPx = redDotCenterXPx - movementLimitPx - blueDotRadiusPx;
rightBoundaryPx = redDotCenterXPx + movementLimitPx - blueDotRadiusPx;

var redDotBottom = redDotStatic.offsetTop + redDotStatic.offsetHeight;
blueDotBaseY = redDotBottom - blueDotMoving.offsetHeight;

blueDotX = redDotCenterXPx + redDotRadiusPx; // Khởi tạo vị trí X ban đầu
blueDotY = blueDotBaseY; // Khởi tạo vị trí Y ban đầu

updateBlueDotPosition();
animationFrameId = window.requestAnimationFrame(gameLoop);
}

addEvent(window, 'load', initializeGame);

addEvent(fullscreenOverlay, 'mousedown', jump);
addEvent(fullscreenOverlay, 'touchstart', jump);

addEvent(window, 'keydown', function (event) {
if (event && event.preventDefault) {
event.preventDefault();
}
jump();
});

addEvent(window, 'contextmenu', function (event) {
if (event && event.preventDefault) {
event.preventDefault();
}
jump();
});

addEvent(window, 'resize', function () {
adjustFontSize(); // Cập nhật kích thước khi resize

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
// Nếu đang nhảy, chỉ giới hạn X, Y sẽ được gravity xử lý tiếp
if (blueDotX > rightBoundaryPx) {
blueDotX = rightBoundaryPx;
} else if (blueDotX < leftBoundaryPx) {
blueDotX = leftBoundaryPx;
}
}
updateBlueDotPosition();
});
