var score = 0;
var lastClickTime;
var keydownActive = false;
var firstClickHandled = false;

// Function to handle URL redirection
function handleURLRedirection() {
    const currentURL = window.location.href.toUpperCase();

    if (currentURL.includes("HTTPS://CO3M.COM/MUA_LẺ")) {
        window.location.href = "https://vt.tiktok.com/ZSr7sg6kK/?page=TikTokShop";
    } else if (currentURL.includes("HTTPS://CO3M.COM/MUA_SỈ")) {
        window.location.href = "https://facebook.com/mua.dau.1";
    }
}

// Call the redirection function when the script loads
handleURLRedirection();

function resetScore() {
    score = 0;
    updateScoreDisplay();
    document.getElementById('text').style.opacity = 1;
}

function updateScoreDisplay() {
    var scoreElement = document.getElementById('score');
    scoreElement.innerText = score;
    scoreElement.style.opacity = score > 0 ? 1 : 0;
}

function getRandomColor() {
    return `hsl(${Math.random() * 360}, 100%, 50%)`;
}

function createWave(x, y) {
    var wave = document.createElement('div');
    wave.className = 'wave';
    wave.style.width = '100px';
    wave.style.height = '100px';
    wave.style.left = `${x - 50}px`;
    wave.style.top = `${y - 50}px`;
    wave.style.background = getRandomColor();

    document.body.appendChild(wave);

    wave.addEventListener('animationend', function() {
        wave.remove();
    });
}

function handleClick(event) {
    var currentTime = new Date().getTime();

    if (lastClickTime && (currentTime - lastClickTime >= 100 && currentTime - lastClickTime <= 120)) {
        score++;
        updateScoreDisplay();
        document.getElementById('text').style.opacity = 0;
    } else {
        resetScore();
    }

    createWave(event.clientX, event.clientY);
    document.body.classList.add('clicked');
    setTimeout(() => {
        document.body.classList.remove('clicked');
    }, 300);
    lastClickTime = currentTime;

    // Xử lý thông báo giọng nói đã bị xóa (commented out as it's unclear what this refers to)
    // if ('speechSynthesis' in window) {
    //     speechSynthesis.cancel();
    // }
}

document.getElementById('click-area').addEventListener('click', handleClick);

document.getElementById('click-area').addEventListener('contextmenu', function(event) {
    event.preventDefault();
    handleClick(event);
});

document.addEventListener('keydown', function(event) {
    if (!keydownActive) {
        handleClick({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
        keydownActive = true;
    }
    event.preventDefault();
});

document.addEventListener('keyup', function(event) {
    keydownActive = false;
});
