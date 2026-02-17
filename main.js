// --- Configuration ---
let TOTAL_NUMBERS = 90;
const SHUFFLE_DURATION_MS = 2500; // Slower for more suspense
const SHUFFLE_SPEED_MS = 80; // Slightly slower flickers

// --- MC Phrases (Vietnamese Lotto Style) ---
const introPhrases = [
  "Cờ ra con mấy, con mấy gì đây? Có ai chờ số này không?",
  "Số gì đây, số gì đây? Cầm cái vé trên tay, nhìn cho kỹ nha!",
  "Lặng lặng mà nghe, tôi kêu con cờ ra... Con số gì đây?",
  "Con số gì ra? Con số gì ra? Hồi hộp quá bà con ơi!",
  "Quay đều quay đều, tèng téng teng... Con số tiếp theo là...",
  "Xin mời bà con dò số, trúng thưởng là vui như Tết luôn!",
  "Trăm năm Kiều vẫn là Kiều, số này mà trúng là tiêu hết tiền!",
  "Ai đang chờ số, tôi hô số! Chuẩn bị tinh thần chưa?",
  "Dò xem, dò xem! Một con số mang lại tài lộc...",
  "Bà con chú ý, con số định mệnh sắp xuất hiện!",
  "Vé đâu vé đâu? Chuẩn bị gạch tên con số này nè!",
];

// --- State ---
let availableNumbers = [];
let drawnNumbers = [];
let isAnimating = false;
let isSoundOn = true;
let isAutoPlaying = false;
let autoPlayTimer = null;
let autoDelaySeconds = 8;
let voices = [];
let selectedVoice = null;

// --- DOM Elements ---
const gridEl = document.getElementById("grid");
const flipperEl = document.getElementById("flipper");
const ballFrontEl = document.getElementById("ball-front");
const drawBtn = document.getElementById("draw-btn");
const countEl = document.getElementById("count");
const mcDisplayEl = document.getElementById("mc-display");
const soundIconEl = document.getElementById("sound-icon");
const autoToggleEl = document.getElementById("auto-toggle");
const voiceStatusEl = document.getElementById("voice-status");

// --- Audio & TTS Logic ---
function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  // Try to find a Vietnamese voice (Prefer Microsoft Online for quality)
  const vnVoices = voices.filter((v) => v.lang.includes("vi"));

  // High quality Edge/Online voices
  selectedVoice =
    vnVoices.find((v) => v.name.includes("HoaiMy") && v.name.includes("Online")) || // Female (Natural)
    vnVoices.find((v) => v.name.includes("NamMinh") && v.name.includes("Online")) || // Male (Natural)
    vnVoices.find((v) => v.name.includes("Microsoft") && v.name.includes("Online")) ||
    vnVoices.find((v) => v.name.includes("Google")) ||
    vnVoices[0];

  if (selectedVoice) {
    let name = selectedVoice.name
      .replace("Microsoft ", "")
      .replace(" Online (Natural) - Vietnamese", "")
      .replace(" (Natural)", "");
    voiceStatusEl.textContent = `🎤 MC: ${name}`;
  } else {
    voiceStatusEl.textContent = "⚠️ Dùng Edge để có giọng hay nhất";
  }
}

if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
setTimeout(loadVoices, 500);

// Function to speak with "Happy/Excited" parameters
function speakHappy(text, callback) {
  if (!isSoundOn) {
    if (callback) setTimeout(callback, 500); // Trigger callback faster if muted
    return;
  }

  // Use a fresh utterance to avoid queuing issues
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN"; // Explicitly set language for consistency
  if (selectedVoice) utterance.voice = selectedVoice;

  // HAPPY SETTINGS:
  utterance.pitch = 1.4;
  utterance.rate = 1.0;
  utterance.volume = 1.0;

  if (callback) {
    let hasCallbackRun = false;
    const runOnce = () => {
      if (!hasCallbackRun) {
        hasCallbackRun = true;
        callback();
      }
    };

    utterance.onend = runOnce;
    // Safety timeout in case onend never fires (rare browser bug)
    setTimeout(runOnce, 5000);
  }

  window.speechSynthesis.speak(utterance);
}

// Special function to call the number in "Lotto Style"
function callNumber(number, callback) {
  if (!isSoundOn) {
    if (callback) setTimeout(callback, 1000);
    return;
  }

  // Vietnamese lotto caller style often repeats the digits or the whole number
  // e.g., "Con số 8, số 8" or "8 mươi 2, 8 mươi 2"
  const text = `Số ${number}. ${number}!`;
  speakHappy(text, callback);
}

// --- Game Logic ---
function init() {
  stopAutoPlay();
  gridEl.innerHTML = "";
  availableNumbers = [];
  drawnNumbers = [];
  isAnimating = false;

  // Set grid template columns based on total numbers
  if (TOTAL_NUMBERS === 100) {
    gridEl.style.gridTemplateColumns = "repeat(10, 1fr)";
  } else {
    gridEl.style.gridTemplateColumns = "";
  }

  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    availableNumbers.push(i);
    const ball = document.createElement("div");
    ball.classList.add("grid-ball");
    ball.id = `ball-${i}`;
    ball.textContent = i;
    gridEl.appendChild(ball);
  }

  ballFrontEl.textContent = "--";
  // Ensure front is visible at start
  flipperEl.classList.remove("flipped");

  drawBtn.disabled = false;
  drawBtn.innerHTML = "<span>🎲</span> Quay Số"; // Restore button text if it was "HẾT SỐ"
  countEl.textContent = "0";
  mcDisplayEl.classList.remove("visible");
}

function toggleSound() {
  isSoundOn = !isSoundOn;
  soundIconEl.textContent = isSoundOn ? "🔊" : "🔇";
  if (isSoundOn) speakHappy("Bật âm thanh");
}

// --- Auto Play Logic ---
function updateSpeed(val) {
  autoDelaySeconds = parseInt(val);
  document.getElementById("speed-val").textContent = val;
}

function toggleAutoPlay() {
  isAutoPlaying = autoToggleEl.checked;
  if (isAutoPlaying) {
    if (!isAnimating && availableNumbers.length > 0) {
      drawNumber();
    }
  } else {
    stopAutoPlay();
  }
}

function stopAutoPlay() {
  isAutoPlaying = false;
  autoToggleEl.checked = false;
  clearTimeout(autoPlayTimer);
}

function manualDraw() {
  stopAutoPlay();
  drawNumber();
}

// --- THE MAIN DRAWING SEQUENCE ---
function drawNumber() {
  if (isAnimating || availableNumbers.length === 0) return;

  isAnimating = true;
  drawBtn.disabled = true;

  // Clear previous speech before starting a new sequence
  window.speechSynthesis.cancel();

  // 1. Start Shuffling (Visual Only)
  flipperEl.classList.remove("flipped");
  mcDisplayEl.classList.remove("visible");
  flipperEl.classList.add("shuffling"); // Let's ensure the visual shake is on

  // Pick Winner & Phrase (Using CSPRNG for absolute fairness)
  const randomValues = new Uint32Array(2);
  window.crypto.getRandomValues(randomValues);

  const randomIndex = randomValues[0] % availableNumbers.length;
  const winner = availableNumbers[randomIndex];
  const phrase = introPhrases[randomValues[1] % introPhrases.length];

  // Animation Loop (Rapid numbers on front - Math.random is fine for visual only)
  let ticker = 0;
  let shuffleInterval = setInterval(() => {
    const visualNum = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
    ballFrontEl.textContent = visualNum;
    ticker++;
    // Add extra suspense: the last few flickers slow down even more
    if (ticker > 20) {
      clearInterval(shuffleInterval);
      shuffleInterval = setInterval(() => {
        const visualNum = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
        ballFrontEl.textContent = visualNum;
      }, 150);
    }
  }, SHUFFLE_SPEED_MS);

  // 2. Stop Shuffling & HIDE (Flip to Back)
  setTimeout(() => {
    clearInterval(shuffleInterval);
    flipperEl.classList.remove("shuffling");

    // FLIP TO BACK (Show ?)
    flipperEl.classList.add("flipped");

    // Update the front value silently while hidden
    ballFrontEl.textContent = winner;

    // 3. MC Speaks Intro Phrase (While ball is hidden)
    mcDisplayEl.textContent = phrase;
    mcDisplayEl.classList.add("visible");

    // Speak Intro, THEN Reveal
    speakHappy(phrase, () => {
      // Small pause after the intro phrase for "heart-stopping" tension
      setTimeout(() => {
        revealWinner(winner, randomIndex);
      }, 600);
    });
  }, SHUFFLE_DURATION_MS + 500); // Extended for the ticker logic
}

function revealWinner(winner, indexToRemove) {
  // 4. THE REVEAL (Flip back to Front)
  flipperEl.classList.remove("flipped");

  // Call the Number in Lotto Style
  callNumber(winner);

  // Logic Update
  availableNumbers.splice(indexToRemove, 1);
  drawnNumbers.push(winner);
  countEl.textContent = drawnNumbers.length;

  // Highlight Grid
  const gridBall = document.getElementById(`ball-${winner}`);
  if (gridBall) gridBall.classList.add("active");

  // 5. Cleanup / Next Step
  // Wait a moment for speech to finish before enabling next button or auto-play
  setTimeout(() => {
    isAnimating = false;

    if (availableNumbers.length === 0) {
      drawBtn.disabled = true;
      drawBtn.innerHTML = "HẾT SỐ";
      stopAutoPlay();
      speakHappy("Hết số rồi! Xin cảm ơn.");
    } else {
      drawBtn.disabled = false;
      // Trigger next auto draw?
      if (isAutoPlaying) {
        autoPlayTimer = setTimeout(
          () => {
            if (isAutoPlaying) drawNumber();
          },
          autoDelaySeconds * 1000 - 2000,
        ); // Adjust for animation time
      }
    }
  }, 1500);
}

function resetGame() {
  if (confirm("Chơi ván mới nhé?")) {
    init();
  }
}

function setTotalNumbers(num) {
  if (drawnNumbers.length > 0) {
    if (!confirm("Thay đổi số lượng sẽ bắt đầu ván mới. Tiếp tục?")) return;
  }

  TOTAL_NUMBERS = num;

  // Update UI
  const totalDisplay = document.getElementById("total-display");
  if (totalDisplay) totalDisplay.textContent = num;

  document.querySelectorAll(".mode-btn").forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`mode-${num}`);
  if (activeBtn) activeBtn.classList.add("active");

  init();
}

init();

// --- Service Worker Registration ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => console.log("Service Worker registered"))
      .catch((err) => console.log("Service Worker registration failed:", err));
  });
}
