var score = 0;
var lastClickTime = null;
var body = document.body;
var waitingForReset = false;
var gameInterval;
var yellowActive = false; // Biến để theo dõi màu vàng

function updateScore() {
    document.getElementById('score').innerText = score;
}

function changeToYellow() {
    body.style.backgroundColor = "yellow";
    yellowActive = true; // Đánh dấu rằng màu vàng đang hoạt động
    setTimeout(() => {
        body.style.backgroundColor = ""; 
        yellowActive = false; // Đánh dấu rằng màu vàng đã không còn sử dụng
    }, 100); // Giữ màu vàng trong 100ms
}

function startAutoColorChange() {
    body.style.backgroundColor = "green";
    // Clear interval trước khi bắt đầu lại
    clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (!yellowActive) { // Chỉ thay đổi màu sang vàng nếu màu vàng chưa được sử dụng
            changeToYellow(); // Gọi hàm để thay đổi thành màu vàng
        }
    }, 900); // Đợi 900ms để thay màu vàng
}

function stopAutoColorChange() {
    clearInterval(gameInterval);
    body.style.backgroundColor = "";
    yellowActive = false; // Reset lại biến theo dõi màu vàng
}

function autoStartGame() {
    if (score === 0) {
        stopAutoColorChange();
        startAutoColorChange();
    }
}

function handleClick() {
    var now = new Date().getTime();

    if (waitingForReset) {
        score = 0; 
        stopAutoColorChange();
        waitingForReset = false;
        lastClickTime = null; 
        updateScore();
        autoStartGame();
        return;
    }

    if (lastClickTime !== null) {
        var timeDiff = now - lastClickTime;

        if (timeDiff < 900) {
            body.style.backgroundColor = "red"; 
            waitingForReset = true; 
        } else if (timeDiff >= 900 && timeDiff <= 1000) {
            score++; 
            body.style.backgroundColor = ""; 
            // Reset biến vàng sau mỗi lần tạo màu vàng
            yellowActive = false;
        } else if (timeDiff > 1000) {
            body.style.backgroundColor = "red"; 
            waitingForReset = true;
        }
    } else {
        body.style.backgroundColor = "green"; 
        startAutoColorChange();
    }

    lastClickTime = now; 
    updateScore();
    autoStartGame();
}

document.getElementById('button').addEventListener('click', handleClick);
document.addEventListener('keydown', function(event) {
    handleClick(); 
});

if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
        if (this == null) {
            throw new TypeError('"this" is null or not defined');
        }
        var O = Object(this);
        var len = O.length >>> 0; 
        if (len === 0) {
            return false;
        }
        var n = fromIndex | 0; 
        var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        while (k < len) {
            if (O[k] === searchElement) {
                return true;
            }
            k++;
        }
        return false;
    };
}

autoStartGame();
