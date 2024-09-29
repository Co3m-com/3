var score = 0;
var lastClickTime = null;
var body = document.body; // Lưu body vào biến để sử dụng sau
var waitingForReset = false; // Biến để theo dõi việc chờ reset

function updateScore() {
    document.getElementById('score').innerText = score; // Cập nhật điểm
}

function handleClick() {
    var now = new Date().getTime();

    // Nếu trạng thái đang chờ reset (nền màu đỏ)
    if (waitingForReset) {
        score = 0; // Đặt lại điểm
        body.style.backgroundColor = ""; // Đặt màu nền về mặc định
        waitingForReset = false; // Đặt lại trạng thái chờ reset
        lastClickTime = null; // Đặt lại thời gian nhấn
        updateScore(); // Cập nhật điểm
        return; // Dừng xử lý
    }

    // Nếu đã có thời gian nhấn trước đó
    if (lastClickTime !== null) {
        var timeDiff = now - lastClickTime;

        // Nếu chạm sớm hơn 900ms
        if (timeDiff < 900) {
            body.style.backgroundColor = "red"; // Đổi màu nền thành đỏ
            waitingForReset = true; // Đặt trạng thái chờ reset
        } 
        // Trường hợp chạm trong khoảng 900ms đến 1000ms
        else if (timeDiff >= 900 && timeDiff <= 1000) {
            score++;
            body.style.backgroundColor = ""; // Đặt màu nền về mặc định chỉ khi điểm tăng
        } 
        // Nếu chạm quá 1000ms
        else if (timeDiff > 1000) {
            body.style.backgroundColor = "red"; // Đổi màu nền thành đỏ
            waitingForReset = true; // Đặt trạng thái chờ reset
        }
    }

    lastClickTime = now; // Cập nhật thời gian nhấn
    updateScore(); // Cập nhật điểm
}

// Sử dụng addEventListener cho tất cả các ứng dụng
document.getElementById('button').addEventListener('click', handleClick);

// Đảm bảo rằng keydown được xử lý đúng cách
document.addEventListener('keydown', function(event) {
    handleClick(); // Xử lý nhấn phím
});

// Thêm polyfill cho `Array.prototype.includes` nếu cần
if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
        if (this == null) {
            throw new TypeError('"this" is null or not defined');
        }
        var O = Object(this);
        var len = O.length >>> 0; // Chuyển đổi thành số nguyên không dấu
        if (len === 0) {
            return false;
        }
        var n = fromIndex | 0; // Toán tử bitwise OR để chuyển đổi
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
