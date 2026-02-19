// --- Configuration ---
const APP_VERSION = "0.0.3";
let TOTAL_NUMBERS = 90;
const SHUFFLE_DURATION_MS = 2500; // Slower for more suspense
const SHUFFLE_SPEED_MS = 80; // Slightly slower flickers

// --- MC Phrases (Vietnamese Lotto Style) ---
const introPhrases = [
  "Nào bà con ơi, tập trung lại nghe cho rõ nè!",
  "Chuẩn bị tinh thần nha, con số tiếp theo xuất hiện đây!",
  "Ai đang chờ số, giơ tay nào — tôi hô đây!",
  "Nghe kỹ nè bà con, con số này chạy tới bây giờ!",
  "Quay lẹ một xí... con số tiếp theo là...",
  "Cầm vé kỹ nha, coi cho kỹ con số này!",
  "Hô con cờ ra nè, coi coi con số nào!",
  "Nào cô chú anh chị em, chuẩn bị ghi lại nào!",
  "Cờ ra con mấy, con mấy gì đây? Có ai chờ số này không?",
  "Số gì đây, số gì đây? Cầm cái vé trên tay, nhìn cho kỹ nha!",
  "Lặng lặng mà nghe, tôi kêu con cờ ra... Con số gì đây?",
  "Con số gì ra? Con số gì ra? Hồi hộp quá bà con ơi!",
  "Quay đều quay đều, tèng téng teng... Con số tiếp theo là...",
  "Xin mời bà con dò số, trúng thưởng là vui như Tết luôn!",
  "Ai đang chờ số, tôi hô số! Chuẩn bị tinh thần chưa?",
  "Dò xem, dò xem! Một con số mang lại tài lộc...",
  "Bà con chú ý, con số định mệnh sắp xuất hiện!",
  "Vé đâu vé đâu? Chuẩn bị gạch tên con số này nè!",
];

// Utility to pick a random element
function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

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
  // If muted or TTS unavailable, trigger callback quickly
  if (!isSoundOn || !window.speechSynthesis) {
    if (callback) setTimeout(callback, 800);
    return;
  }

  // Use a fresh utterance to avoid queuing issues
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN"; // Explicitly set language for consistency
  if (selectedVoice) utterance.voice = selectedVoice;

  // HAPPY SETTINGS:
  utterance.pitch = 1.1;
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

// Helper: convert number to Vietnamese "call" string (e.g. "mười sáu", "tám mươi hai")
function numberToCall(number) {
  const words = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  if (number < 10) return words[number];

  const tens = Math.floor(number / 10);
  const units = number % 10;

  if (tens === 1) {
    if (units === 0) return "mười";
    if (units === 1) return "mười một";
    if (units === 5) return "mười lăm";
    return `mười ${words[units]}`;
  }

  const tensWord = words[tens];
  if (units === 0) return `${tensWord} mươi`;

  let unitsWord = words[units];
  if (units === 1) unitsWord = "mốt";
  if (units === 5) unitsWord = "lăm";

  return `${tensWord} mươi ${unitsWord}`;
}

// Special function to call the number in "Lotto Style"
// Updated: add a suspense "teaser" for two-digit numbers (1x => "Số mười... mấy đây?",
//  2x-9x => "Số hai... mươi mấy đây?") before announcing the full number.
function callNumber(number, callback) {
  const call = numberToCall(number);

  // Helper: final spoken line used for both single- and two-digit announcements
  const finalText = number < 10 ? `Con số ${call}, là con số ${call}` : `Số ${call}, là con số ${call}!`;

  // For two-digit numbers (10-99) we first do a short "teaser" then the full call
  if (number >= 10 && number <= 99) {
    const tens = Math.floor(number / 10);
    const tensWords = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const teaser = tens === 1 ? "Số mười... mấy đây?" : `Số ${tensWords[tens]}... mươi mấy đây?`;

    // Update visual MC text immediately
    if (mcDisplayEl) mcDisplayEl.textContent = teaser;

    // When sound is disabled, simulate the same timing and text flow
    if (!isSoundOn || !window.speechSynthesis) {
      setTimeout(() => {
        if (mcDisplayEl) mcDisplayEl.textContent = finalText;
        setTimeout(() => {
          if (callback) callback();
        }, 900);
      }, 800);
      return;
    }

    // With TTS: speak teaser, short pause, then speak the final call
    speakHappy(teaser, () => {
      setTimeout(() => {
        if (mcDisplayEl) mcDisplayEl.textContent = finalText;
        speakHappy(finalText, callback);
      }, 450);
    });

    return;
  }

  // Default behavior for single-digit or out-of-range numbers
  if (mcDisplayEl) mcDisplayEl.textContent = finalText;
  if (!isSoundOn || !window.speechSynthesis) {
    if (callback) setTimeout(callback, 1200);
    return;
  }

  speakHappy(finalText, callback);
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

  // Show app version (for cache-busting visibility)
  const versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = `v${APP_VERSION}`;

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

function chooseReaction(winner) {
  const call = numberToCall(winner);
  const remaining = availableNumbers.length; // after the splice in revealWinner
  const drawnCount = drawnNumbers.length;
  const tens = Math.floor(winner / 10);
  const units = winner % 10;

  const candidates = [];

  // Context-aware selections (use specific templates + category snippets)
  if (drawnCount === 1) {
    candidates.push(`Mở màn với con số ${call}! Bắt đầu rồi bà con ơi!`);
  }

  if (remaining === 0) {
    candidates.push(`Số cuối rồi: ${call}. Hết ván!`);
  }

  if (winner < 10) {
    candidates.push(`Số nhỏ xinh: ${call}. Ai có thì giơ tay!`);
  }

  if (units === 0) {
    candidates.push(`Số tròn chục: ${call}. Dễ nhớ quá!`);
  }

  // only treat as "số kép" for two-digit numbers (11-99)
  if (winner >= 11 && winner <= 99 && tens === units) {
    candidates.push(`Số kép: ${call}! Ai có số kép là mừng rồi!`);
  }

  // 'lăm' is used when there's a tens digit (e.g. 15, 25). For single-digit 5 we keep the normal reading.
  if (units === 5 && winner >= 10) {
    candidates.push(`Có lăm nè: ${call}. May mắn lắm!`);
  }

  if (remaining > 0 && remaining <= 5) {
    candidates.push(`Còn ${remaining} con nữa thôi, giữ vé kỹ nha!`);
  }

  // If we have strong contextual candidates, return one
  if (candidates.length > 0) return pick(candidates);

  return null;
}

function revealWinner(winner, indexToRemove) {
  // 4. THE REVEAL Logic
  // We keep it flipped (showing ?) while the MC announces the number

  // Call the Number in Lotto Style
  callNumber(winner, () => {
    // OPEN THE BALL AFTER ANNOUNCEMENT
    flipperEl.classList.remove("flipped");

    // Logic Update - Move here so it only updates UI when revealed
    availableNumbers.splice(indexToRemove, 1);
    drawnNumbers.push(winner);
    countEl.textContent = drawnNumbers.length;

    // Highlight Grid - Only after reveal
    const gridBall = document.getElementById(`ball-${winner}`);
    if (gridBall) gridBall.classList.add("active");

    // Context-aware reaction (may return null to skip)
    const reaction = chooseReaction(winner);
    if (reaction) {
      setTimeout(() => {
        mcDisplayEl.textContent = reaction;
        speakHappy(reaction);
      }, 800);
    }

    // 5. Cleanup / Next Step - Triggered after reveal
    setTimeout(() => {
      isAnimating = false;

      if (availableNumbers.length === 0) {
        drawBtn.disabled = true;
        drawBtn.innerHTML = "HẾT SỐ";
        stopAutoPlay();
        speakHappy("Hết số rồi! Xin cảm ơn.");
      } else {
        drawBtn.disabled = false;
        if (isAutoPlaying) {
          autoPlayTimer = setTimeout(
            () => {
              if (isAutoPlaying) drawNumber();
            },
            autoDelaySeconds * 1000 - 3000,
          );
        }
      }
    }, 1000);
  });
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
      .then((reg) => console.log(`Service Worker registered (v${APP_VERSION})`))
      .catch((err) => console.log("Service Worker registration failed:", err));
  });
}
