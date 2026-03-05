const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
let video, isPredicting = false, isLearningMode = false;
let currentTarget = "", currentWordBuffer = "";
let lastDetectedChar = "", lastDetectionTime = 0;

// LOGIN
function login() {
    const name = document.getElementById('username').value;
    if (name) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'grid';
        document.getElementById('greeting').innerText = `Welcome, ${name}`;
    }
}

// TEXT/VOICE TO SIGN DISPLAY
function manualTextSubmit() {
    const text = document.getElementById('text-input').value;
    if (text) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
        displaySignSequence(text);
    }
}

async function displaySignSequence(text) {
    const displayImg = document.getElementById('sign-display');
    const chars = text.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split('');
    for (let char of chars) {
        displayImg.src = char === ' ' ? "assets/idle.jpeg" : `assets/${char}.jpeg`;
        await sleep(800);
    }
    displayImg.src = "assets/idle.jpeg";
}

// VOICE LISTENING
function startListening() {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    document.getElementById('voice-output').innerText = "Listening...";
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('voice-output').innerText = `Heard: ${transcript}`;
        document.getElementById('text-input').value = transcript;
    };
    recognition.start();
}

// WEBCAM & AI
async function initWebcam() {
    video = document.getElementById('input-video');
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
    isPredicting = true;
    sendFrame();
}

function stopWebcam() {
    if(video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    isPredicting = false;
    document.getElementById('gesture-output').innerText = "Camera Off";
}

function sendFrame() {
    if (!isPredicting) return;
    const canvas = document.getElementById('hidden-canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
        const fd = new FormData(); fd.append('image', blob);
        try {
            const resp = await fetch('http://127.0.0.1:5000/predict', { method: 'POST', body: fd });
            const res = await resp.json();
            if (res.character) handleAIResult(res.character, res.confidence);
        } catch (e) {}
        setTimeout(sendFrame, 400);
    }, 'image/jpeg');
}

function handleAIResult(char, conf) {
    if (conf < 0.8) return;
    document.getElementById('gesture-output').innerText = `AI Sees: ${char}`;

    if (isLearningMode) {
        if (char === currentTarget) {
            document.getElementById('learning-feedback').innerText = "✅ Correct Match!";
            isLearningMode = false;
            setTimeout(pickNextPractice, 3000);
        }
    } else {
        // Continuous Detection Buffer
        if (char === "IDLE") {
            if (currentWordBuffer) { manualTextSubmit(); currentWordBuffer = ""; }
        } else if (char !== lastDetectedChar) {
            lastDetectedChar = char; lastDetectionTime = Date.now();
        } else if (Date.now() - lastDetectionTime > 1500) {
            currentWordBuffer += char;
            document.getElementById('current-translation').innerText = `Spelling: ${currentWordBuffer}`;
            lastDetectionTime = Date.now() + 3000;
        }
    }
}

// PRACTICE MODE
const tutorials = [
    { label: "A", video: "assets/hi.mp4", img: "assets/A.jpeg" },
    { label: "B", video: "assets/hello.mp4", img: "assets/B.jpeg" }
];

function startLearningMode() {
    isLearningMode = true;
    pickNextPractice();
}

function pickNextPractice() {
    isLearningMode = true;
    const item = tutorials[Math.floor(Math.random() * tutorials.length)];
    currentTarget = item.label;
    const v = document.getElementById('tutorial-video');
    v.src = item.video; v.style.display = "block"; v.play();
    document.getElementById('sign-display').src = item.img;
    document.getElementById('learning-prompt').innerText = `Sign this: ${item.label}`;
    document.getElementById('learning-feedback').innerText = "Watching...";
}