var score = 0;
var lastClickTime = null;
var body = document.body;
var waitingForReset = false;
var gameInterval;
var yellowActive = false; // Biến để theo dõi màu vàng

function updateScore() {
    // Chỉ cập nhật điểm nếu không phải 0, và làm cho nó hiển thị
    if (score > 0) {
        document.getElementById('score').innerText = score;
        document.getElementById('score').style.opacity = '1'; // Hiện số điểm
        document.getElementById('instruction').style.opacity = '0'; // Ẩn hướng dẫn khi điểm số tăng
    } else {
        document.getElementById('score').style.opacity = '0'; // Ẩn số 0
        document.getElementById('instruction').style.opacity = '1'; // Hiện hướng dẫn
    }

    // Ẩn chữ "CO3M.COM" nếu điểm số tăng
    const siteName = document.getElementById('site-name');
    if (score > 0) {
        siteName.style.opacity = '0'; // Ẩn chữ
    } else {
        siteName.style.opacity = '1'; // Hiện chữ
    }
}

function changeToYellow() {
    body.style.backgroundColor = "yellow";
    yellowActive = true; // Đánh dấu rằng màu vàng đang hoạt động
    setTimeout(() => {
        body.style.backgroundColor = ""; 
        yellowActive = false; // Đánh dấu rằng màu vàng đã không còn
    }, 100); // Giữ màu vàng trong 100ms
}

function startAutoColorChange() {
    body.style.backgroundColor = "green";
    clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (!yellowActive) {
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

autoStartGame();
