var score = 0;
var lastClickTime;
var keydownActive = false;
var firstClickHandled = false;
var notificationInterval;

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

function speak(message) {
    var utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'vi-VN';  // Ngôn ngữ tiếng Việt
    window.speechSynthesis.speak(utterance);
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

    // Xử lý thông báo giọng nói
    if (!firstClickHandled) {
        firstClickHandled = true;
        speak("Hãy chạm thật nhanh hơn nữa để tăng điểm!");
        notificationInterval = setInterval(() => {
            speak("Hãy chạm thật nhanh hơn nữa để tăng điểm!");
        }, 5); // Lặp lại sau mỗi 5 phút
    }
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
