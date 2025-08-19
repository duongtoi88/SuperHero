/* scripts/state.js
   Nối Thú Siêu Anh Hùng – State & Persistence
   - Quản lý cấu hình level (7 màn, độ khó tăng dần)
   - Tùy chọn người chơi: autoShuffle, fastTimer, soundOn
   - Lưu/đọc tiến độ: bestScore, lastLevel
   - Các hằng số tính điểm & combo theo GDD
*/

window.State = (function () {
  /* ===== HẰNG SỐ THEO GDD ===== */
  // Bàn 10x8; 7 level; obstacle xuất hiện từ level 4:contentReference[oaicite:2]{index=2}
  const GRID = { ROWS: 10, COLS: 8 };

  // Cửa sổ combo: 2 giây (nếu nối tiếp trong 2s thì tăng combo):contentReference[oaicite:3]{index=3}
  const COMBO_WINDOW_MS = 2000;

  // Điểm cơ bản +10; thưởng combo tăng dần; combo 4 +5s; time bonus = timeLeft * 10:contentReference[oaicite:4]{index=4}
  const BASE_SCORE = 10;
  const COMBO_BONUS = {
    1: 0,   // cú nối đầu tiên = 10 điểm cơ bản
    2: 10,
    3: 20,
    4: 30,  // +5s ở phía game logic khi đạt combo 4
    5: 40,  // 5 trở lên = 40
  };
  const TIME_BONUS_PER_SEC = 10;

  // Cấu hình 7 level: loại thú tăng, thời gian giảm; obstacle tăng từ L4:contentReference[oaicite:5]{index=5}
  const LEVELS = [
    { idx: 1, time: 150, types: 5,  obstacles: 0,  bg: 1 },
    { idx: 2, time: 120, types: 7,  obstacles: 0,  bg: 2 },
    { idx: 3, time: 100, types: 9,  obstacles: 0,  bg: 3 },
    { idx: 4, time: 85,  types: 11, obstacles: 8,  bg: 4 }, // giới thiệu đá
    { idx: 5, time: 70,  types: 13, obstacles: 12, bg: 5 }, // có thể thêm băng/bụi
    { idx: 6, time: 60,  types: 14, obstacles: 16, bg: 6 },
    { idx: 7, time: 50,  types: 15, obstacles: 22, bg: 7 },
  ];

  /* ===== PERSISTENCE ===== */
  const LS = {
    BEST: "onet_bestScore",
    LAST: "onet_lastLevel",
    OPTS: "onet_options",
  };

  const state = {
    // tiến độ
    bestScore: 0,
    lastLevel: 1,
    // tùy chọn
    options: {
      autoShuffle: true,
      fastTimer: false,
      soundOn: true,
    },
  };

  function load() {
    // best score
    const best = Number(localStorage.getItem(LS.BEST) || 0);
    state.bestScore = Number.isFinite(best) ? best : 0;

    // last level
    const last = Number(localStorage.getItem(LS.LAST) || 1);
    state.lastLevel = clamp(Math.trunc(last) || 1, 1, LEVELS.length);

    // options
    try {
      const opts = JSON.parse(localStorage.getItem(LS.OPTS) || "{}");
      if (typeof opts.autoShuffle === "boolean") state.options.autoShuffle = opts.autoShuffle;
      if (typeof opts.fastTimer === "boolean") state.options.fastTimer = opts.fastTimer;
      if (typeof opts.soundOn === "boolean") state.options.soundOn = opts.soundOn;
    } catch { /* ignore */ }

    return snapshot();
  }

  function saveOptions(partial) {
    if (partial && typeof partial === "object") {
      state.options = { ...state.options, ...partial };
    }
    localStorage.setItem(LS.OPTS, JSON.stringify(state.options));
    return { ...state.options };
  }

  function setLastLevel(lvl) {
    state.lastLevel = clamp(Math.trunc(lvl) || 1, 1, LEVELS.length);
    localStorage.setItem(LS.LAST, String(state.lastLevel));
    return state.lastLevel;
  }

  function updateBestScore(score) {
    const val = Math.max(0, Math.trunc(score) || 0);
    if (val > state.bestScore) {
      state.bestScore = val;
      localStorage.setItem(LS.BEST, String(val));
      return true; // có kỷ lục mới
    }
    return false;
  }

  /* ===== HELPERS ===== */
  function levelConfig(n) {
    const idx = clamp(Math.trunc(n) || 1, 1, LEVELS.length);
    return { ...LEVELS[idx - 1] };
  }

  function getOptions() {
    return { ...state.options };
  }

  function getBestScore() {
    return state.bestScore;
  }

  function getLastLevel() {
    return state.lastLevel;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function snapshot() {
    return {
      grid: { ...GRID },
      levels: LEVELS.map(l => ({ ...l })),
      options: { ...state.options },
      bestScore: state.bestScore,
      lastLevel: state.lastLevel,
      scoring: {
        BASE_SCORE,
        COMBO_WINDOW_MS,
        COMBO_BONUS: { ...COMBO_BONUS },
        TIME_BONUS_PER_SEC,
      },
    };
  }

  /* ===== API PUBLIC ===== */
  return {
    // init/load
    load,                 // -> snapshot()
    snapshot,             // -> đọc cấu hình/hằng số hiện tại

    // level
    levelCount: () => LEVELS.length,
    levelConfig,          // (n) -> {time, types, obstacles, bg, idx}

    // grid info
    grid: () => ({ ...GRID }),

    // persistence
    getOptions,
    saveOptions,          // (partial) -> options
    getBestScore,
    getLastLevel,
    setLastLevel,         // (n) -> n
    updateBestScore,      // (score) -> true nếu best mới

    // scoring constants (tham chiếu từ game.js)
    BASE_SCORE,
    COMBO_WINDOW_MS,
    COMBO_BONUS,
    TIME_BONUS_PER_SEC,
  };
})();
