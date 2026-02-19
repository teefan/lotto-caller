// --- Configuration ---
const APP_VERSION = "0.0.6";
const TOTAL_NUMBERS = 90;
const SHUFFLE_DURATION_MS = 2500;
const SHUFFLE_SPEED_MS = 80;

// --- Timing Constants (no more magic numbers) ---
const TIMING = {
  TTS_SAFETY_TIMEOUT_MS: 5000,
  TEASER_PAUSE_MS: 450,
  REVEAL_PAUSE_MS: 600,
  REACTION_DELAY_MS: 800,
  MUTE_FALLBACK_LONG_MS: 1200,
  MUTE_FALLBACK_SHORT_MS: 900,
  MUTE_TEASER_PAUSE_MS: 800,
  END_CLEANUP_MS: 1000,
  VOICE_LOAD_DELAY_MS: 500,
};

// --- MC Intro Phrases (Vietnamese Lotto Style) ---
const introPhrases = [
  "Cờ ra con mấy, con mấy gì đây? ",
  "Số gì đây, số gì đây?",
  "Lặng lặng mà nghe, em kêu con cờ ra...",
  "Con số gì ra? Con số gì ra?",
  "Tèng téng teng... Con số định mệnh!",
  "Tình tính tang... Cho con số trúng nè!",
  "Bà con đợi số mấy, để em kêu cho.",
];

// --- Tịch Số Đề (Mảng 40 phần tử) ---
// Sử dụng phép chia lấy dư (number % 40) để tìm tịch.
// Lưu ý: 40 và 80 chia hết cho 40 nên dư 0 -> index 0 là Ông Táo.
const TICH_DE = [
  "Ông Táo", // 0 (40, 80)
  "con cá trắng", // 1 (1, 41, 81)
  "con ốc", // 2 (2, 42, 82)
  "con vịt", // 3 (3, 43, 83) - Đổi thành vịt cho vui tươi
  "con công", // 4 (4, 44, 84)
  "con giun", // 5 (5, 45, 85)
  "con cọp", // 6 (6, 46, 86)
  "con heo", // 7 (7, 47, 87)
  "con thỏ", // 8 (8, 48, 88)
  "con trâu", // 9 (9, 49, 89)
  "con rồng nước", // 10 (10, 50, 90)
  "con chó", // 11
  "con ngựa", // 12
  "con voi", // 13
  "con mèo nhà", // 14
  "con chuột", // 15
  "con ong", // 16
  "con chim hạc", // 17
  "con mèo rừng", // 18
  "con bướm", // 19
  "con rết", // 20
  "cô Thúy Kiều", // 21
  "chim bồ câu", // 22
  "con khỉ", // 23
  "con ếch", // 24
  "chim diều hâu", // 25
  "con rồng bay", // 26
  "con rùa", // 27
  "con gà", // 28
  "con lươn", // 29
  "con cá lóc", // 30
  "con tôm", // 31
  "con rắn", // 32
  "con nhện", // 33
  "con nai", // 34
  "con dê", // 35
  "Bà Vải", // 36
  "Ông Trời", // 37
  "Ông Địa", // 38
  "Thần Tài", // 39
];

// (traditional number-call phrases removed — MC now announces the numeric call once)

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
  const vnVoices = voices.filter((v) => v.lang.includes("vi"));

  selectedVoice =
    vnVoices.find((v) => v.name.includes("HoaiMy") && v.name.includes("Online")) ||
    vnVoices.find((v) => v.name.includes("NamMinh") && v.name.includes("Online")) ||
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
setTimeout(loadVoices, TIMING.VOICE_LOAD_DELAY_MS);

function speakHappy(text, callback) {
  if (!isSoundOn || !window.speechSynthesis) {
    if (callback) setTimeout(callback, TIMING.MUTE_FALLBACK_LONG_MS);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  if (selectedVoice) utterance.voice = selectedVoice;
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
    setTimeout(runOnce, TIMING.TTS_SAFETY_TIMEOUT_MS);
  }

  window.speechSynthesis.speak(utterance);
}

// Helper: update MC display text
function updateMcDisplay(text) {
  if (mcDisplayEl) mcDisplayEl.textContent = text;
}

// Helper: convert number to Vietnamese spoken form
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

// Call number in traditional Lotto style with Tịch Số Đề:
// 1. Tease the animal + tens digit
// 2. Pause
// 3. Announce full number
function callNumber(number, callback) {
  const call = numberToCall(number);
  const tich = TICH_DE[number % 40]; // Lấy ra tên con vật/nhân vật

  // Build the numeric announcement
  const announcement =
    number < 10 ? `Đó là... con số ${call}, là con số ${call}` : `Đó là... số ${call}, là con số ${call}!`;
  const finalText = announcement;

  // Xây dựng câu gợi ý (Teaser) kết hợp Tịch và số hàng chục
  let teaser = "";
  if (number < 10) {
    teaser = `Cờ ra ${tich}... là số mấy đây?`;
  } else {
    const tens = Math.floor(number / 10);
    const tensWords = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const chuc = tens === 1 ? "Số mười" : `Số ${tensWords[tens]} mươi`;
    teaser = `Cờ ra ${tich}... ${chuc}... mấy đây?`;
  }

  updateMcDisplay(teaser);

  // Xử lý khi tắt âm thanh hoặc lỗi TTS
  if (!isSoundOn || !window.speechSynthesis) {
    setTimeout(() => {
      updateMcDisplay(finalText);
      setTimeout(() => {
        if (callback) callback();
      }, TIMING.MUTE_FALLBACK_SHORT_MS);
    }, TIMING.MUTE_TEASER_PAUSE_MS);
    return;
  }

  // Đọc câu gợi ý trước, đợi một nhịp (TEASER_PAUSE_MS) rồi mới công bố số
  speakHappy(teaser, () => {
    setTimeout(() => {
      updateMcDisplay(finalText);
      speakHappy(finalText, callback);
    }, TIMING.TEASER_PAUSE_MS);
  });
}

// --- Game Logic ---
function init() {
  stopAutoPlay();
  window.speechSynthesis.cancel(); // Stop any ongoing speech
  gridEl.innerHTML = "";
  availableNumbers = [];
  drawnNumbers = [];
  isAnimating = false;
  gridEl.style.gridTemplateColumns = "";

  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    availableNumbers.push(i);
    const ball = document.createElement("div");
    ball.classList.add("grid-ball");
    ball.id = `ball-${i}`;
    ball.textContent = i;
    gridEl.appendChild(ball);
  }

  ballFrontEl.textContent = "--";
  flipperEl.classList.remove("flipped");

  const versionEl = document.getElementById("app-version");
  if (versionEl) versionEl.textContent = `v${APP_VERSION}`;

  drawBtn.disabled = false;
  drawBtn.innerHTML = "<span>🎲</span> Quay Số";
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

  window.speechSynthesis.cancel();

  // 1. Start visual shuffle
  flipperEl.classList.remove("flipped");
  mcDisplayEl.classList.remove("visible");
  flipperEl.classList.add("shuffling");

  // Pick winner using CSPRNG for fairness
  const randomValues = new Uint32Array(2);
  window.crypto.getRandomValues(randomValues);

  const randomIndex = randomValues[0] % availableNumbers.length;
  const winner = availableNumbers[randomIndex];
  const phrase = introPhrases[randomValues[1] % introPhrases.length];

  // Shuffle animation with increasing interval for suspense
  let ticker = 0;
  let shuffleInterval = setInterval(() => {
    ballFrontEl.textContent = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
    ticker++;
    if (ticker > 20) {
      // stop the fast flicker and replace with a slower flicker using the same variable
      clearInterval(shuffleInterval);
      shuffleInterval = setInterval(() => {
        ballFrontEl.textContent = Math.floor(Math.random() * TOTAL_NUMBERS) + 1;
      }, 150);
    }
  }, SHUFFLE_SPEED_MS);

  // 2. Stop shuffle, flip to show "?"
  setTimeout(() => {
    clearInterval(shuffleInterval);
    flipperEl.classList.remove("shuffling");
    flipperEl.classList.add("flipped");

    // Update number silently while hidden behind "?"
    ballFrontEl.textContent = winner;

    // 3. MC speaks intro phrase while ball is hidden
    updateMcDisplay(phrase);
    mcDisplayEl.classList.add("visible");

    speakHappy(phrase, () => {
      setTimeout(() => {
        revealWinner(winner);
      }, TIMING.REVEAL_PAUSE_MS);
    });
  }, SHUFFLE_DURATION_MS + 500);
}

function chooseReaction(winner, remainingCount) {
  const call = numberToCall(winner);
  const drawnCount = drawnNumbers.length;
  const tens = Math.floor(winner / 10);
  const units = winner % 10;

  const candidates = [];

  // --- 1. PHẢN ỨNG THEO CÁC SỐ ĐẶC BIỆT (VĂN HÓA / PHONG THỦY) ---
  switch (winner) {
    case 13:
      candidates.push("Số mười ba... Tây kiêng ta không kiêng!");
      break;
    case 33:
      candidates.push("Ba mươi ba... Bắt được con ba ba!");
      break;
    case 38:
      candidates.push("Ba mươi tám... Ông Địa nhỏ tới chơi!");
      break;
    case 39:
      candidates.push("Ba mươi chín... Thần Tài nhỏ gõ cửa!");
      break;
    case 44:
      candidates.push("Bốn mươi bốn... Hai cây búa chà bá!");
      break;
    case 49:
      candidates.push("Bốn mươi chín... Bước qua năm tuổi nha!");
      break;
    case 53:
      candidates.push("Năm mươi ba... Xui xẻo bay xa!");
      break;
    case 68:
      candidates.push("Sáu mươi tám... Lộc phát, lộc phát!");
      break;
    case 78:
      candidates.push("Bảy mươi tám... Ông Địa lớn hiển linh!");
      break;
    case 79:
      candidates.push("Bảy mươi chín... Thần Tài lớn rước lộc vào nhà!");
      break;
    case 83:
      candidates.push("Tám mươi ba... Phát tài, phát tài!");
      break;
    case 86:
      candidates.push("Tám mươi sáu... Phát lộc, phát lộc!");
      break;
    case 88:
      candidates.push("Tám mươi tám... Đại phát đại lợi!");
      break;
    case 99:
      candidates.push("Chín mươi chín... Trường trường cửu cửu!");
      break;
  }

  // --- 2. LOGIC TRẠNG THÁI GAME ---
  if (drawnCount === 1) {
    candidates.push(`Mở màn ${call}!`);
  }

  if (remainingCount === 0) {
    candidates.push(`Số cuối ${call}. Hết ván!`);
  }

  if (winner < 10) {
    candidates.push(`Số nhỏ xinh ${call}.`);
  }

  if (units === 0 && winner > 0) {
    candidates.push(`Số tròn chục ${call}.`);
  }

  // Số kép (11, 22, 55, 77...)
  if (winner >= 11 && winner <= 99 && tens === units) {
    candidates.push(`Số kép ${call}!`);
    // Thêm các hình tượng dân gian cho số kép
    if (winner === 11) candidates.push("Mười một... Giống hai cái cẳng!");
    if (winner === 22) candidates.push("Hai mươi hai... Một cặp vịt bầu!");
    if (winner === 55) candidates.push("Năm mươi lăm... Hai cái còng số tám!");
    if (winner === 77) candidates.push("Bảy mươi bảy... Hai cây cuốc chim!");
  }

  if (units === 5 && winner >= 10 && winner !== 55) {
    candidates.push(`Có lăm nè ${call}.`);
  }

  if (remainingCount > 0 && remainingCount <= 5) {
    candidates.push(`Trời ơi, còn ${remainingCount} con nữa thôi!`);
  }

  // Chọn ngẫu nhiên một câu bình luận trong danh sách ứng viên
  if (candidates.length > 0) return pick(candidates);

  return null;
}

function revealWinner(winner) {
  // Announce number before revealing (ball still shows "?")
  callNumber(winner, () => {
    // Flip back to show the number
    flipperEl.classList.remove("flipped");

    // Find winner's index by VALUE at the moment of reveal (safe and always correct)
    const indexToRemove = availableNumbers.indexOf(winner);
    if (indexToRemove === -1) return; // safety guard
    availableNumbers.splice(indexToRemove, 1);
    drawnNumbers.push(winner);
    countEl.textContent = drawnNumbers.length;

    // Highlight on grid
    const gridBall = document.getElementById(`ball-${winner}`);
    if (gridBall) gridBall.classList.add("active");

    // Pass remaining count to chooseReaction to avoid timing ambiguity
    const remainingCount = availableNumbers.length;
    const reaction = chooseReaction(winner, remainingCount);
    if (reaction) {
      setTimeout(() => {
        updateMcDisplay(reaction);
        speakHappy(reaction);
      }, TIMING.REACTION_DELAY_MS);
    }

    // Cleanup and schedule next auto-draw
    setTimeout(() => {
      isAnimating = false;

      if (availableNumbers.length === 0) {
        drawBtn.disabled = true;
        drawBtn.innerHTML = "HẾT SỐ";
        stopAutoPlay();
        speakHappy("Hết số rồi! Xin cảm ơn bà con!");
      } else {
        drawBtn.disabled = false;
        if (isAutoPlaying) {
          const delay = Math.max(1000, autoDelaySeconds * 1000 - 3000);
          autoPlayTimer = setTimeout(() => {
            if (isAutoPlaying) drawNumber();
          }, delay);
        }
      }
    }, TIMING.END_CLEANUP_MS);
  });
}

function resetGame() {
  if (confirm("Chơi ván mới nhé?")) {
    init();
  }
}

init();

// --- Service Worker Registration ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log(`Service Worker registered (v${APP_VERSION})`))
      .catch((err) => console.log("Service Worker registration failed:", err));
  });
}
