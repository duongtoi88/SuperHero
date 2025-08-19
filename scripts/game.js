/* scripts/game.js
   Nối Thú Siêu Anh Hùng – Core (self-contained)
   - Lưới 10x8, nối ≤ 2 góc rẽ, thời gian giảm dần theo level
   - Combo: trong 2s; combo4 +5s; điểm thưởng theo combo
   - Obstacle từ level 4
   - SVG path overlay trong #pathLayer
*/

/* ============================ CẤU HÌNH ============================ */
const ROWS = 10, COLS = 8;
const ICON_COUNT_TOTAL = 20; // theo GDD: icon_0 .. icon_19
const ICON_IDS = Array.from({ length: ICON_COUNT_TOTAL }, (_, i) => i); // 0..19
const OBSTACLE = { kind: "OB", code: -1 };

// Level config theo GDD: loại thú, thời gian; obstacle từ L4
const LEVELS = [
  { time: 150, types: 5,  obstacles: 0,  bg: 1 }, // L1
  { time: 120, types: 7,  obstacles: 0,  bg: 2 }, // L2
  { time: 100, types: 9,  obstacles: 0,  bg: 3 }, // L3
  { time: 85,  types: 11, obstacles: 8,  bg: 4 }, // L4
  { time: 70,  types: 13, obstacles: 12, bg: 5 }, // L5
  { time: 60,  types: 14, obstacles: 16, bg: 6 }, // L6
  { time: 50,  types: 15, obstacles: 22, bg: 7 }, // L7
];

// Assets map (theo GDD)
const ASSETS = {
  iconUrl: (id) => `assets/icons/icon_${id}.png`,
  obstaclePick: () => {
    // Chọn ngẫu nhiên 1 sprite obstacle (Da/Bang/Cay/Xoay), ưu tiên đá
    const pool = ["Da1", "Da2", "Da3", "Bang", "Cay", "Xoay1", "Xoay2"];
    return `assets/obstacles/${pool[Math.floor(Math.random() * pool.length)]}.png`;
  },
};

/* ============================ STATE & DOM ============================ */
const S = {
  level: 1,
  score: 0,
  combo: 0,
  lastMatchAt: 0,
  timeLeft: 0,
  timerId: null,
  shufflesLeft: 0,
  grid: [],   // có viền rỗng padding 1
  raw: [],    // ma trận hiển thị ROWSxCOLS
  sel: null,
  paused: false,
  autoShuffle: true,
  fastTimer: false,
  autoShuffleTimerId: null,
  // sound
  soundOn: true,
};

const $board = document.getElementById("board");
const $path = document.getElementById("pathLayer");
const $level = document.getElementById("level");
const $score = document.getElementById("score");
const $combo = document.getElementById("combo");
const $time = document.getElementById("time");
const $timebar = document.getElementById("timebar");
const $legend = document.getElementById("legend");
const $overlay = document.getElementById("overlay");
const $shuffles = document.getElementById("shuffles");
const $icoSound = document.getElementById("icoSound");
const $sr = document.getElementById("srLive");
const $levelBg = document.getElementById("levelBg");

// Buttons
const $btnHint = document.getElementById("btnHint");
const $btnShuffle = document.getElementById("btnShuffle");
const $btnPause = document.getElementById("btnPause");
const $btnRestart = document.getElementById("btnRestart");
const $btnResume = document.getElementById("btnResume");
const $btnRestart2 = document.getElementById("btnRestart2");
const $btnSound = document.getElementById("btnSound");

// SFX
const sfx = {
  click: document.getElementById("sfxClick"),
  hint: document.getElementById("sfxHint"),
  match: document.getElementById("sfxMatch"),
  mismatch: document.getElementById("sfxMismatch"),
  shuffle: document.getElementById("sfxShuffle"),
  win: document.getElementById("sfxWin"),
  lose: document.getElementById("sfxLose"),
};

function playSfx(aud) { if (S.soundOn && aud) { try { aud.currentTime = 0; aud.play(); } catch {} } }
function speak(msg) { if ($sr) $sr.textContent = msg; }
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  speak(msg);
  setTimeout(() => t.classList.remove("show"), 1200);
}

/* ============================ TIỆN ÍCH ============================ */
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
function shuffle(arr) { arr = [...arr]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function now() { return performance.now(); }

/* ============================ PERSIST ============================ */
const LS = { BEST: "onet_bestScore", LAST: "onet_lastLevel", OPTS: "onet_options" };
function saveBest(s) { const c = Number(localStorage.getItem(LS.BEST) || 0); if (s > c) { localStorage.setItem(LS.BEST, String(s)); toast(`🏆 Best mới: ${s}`); } }
function saveLastLevel(l) { localStorage.setItem(LS.LAST, String(l)); }
function saveOptions() { localStorage.setItem(LS.OPTS, JSON.stringify({ autoShuffle: S.autoShuffle, fastTimer: S.fastTimer, soundOn: S.soundOn })); }
function loadPersist() {
  const last = Number(localStorage.getItem(LS.LAST) || 1);
  const opts = JSON.parse(localStorage.getItem(LS.OPTS) || "{}");
  if (last >= 1 && last <= LEVELS.length) S.level = last;
  if (opts.autoShuffle !== undefined) S.autoShuffle = !!opts.autoShuffle;
  if (opts.fastTimer !== undefined) S.fastTimer = !!opts.fastTimer;
  if (opts.soundOn !== undefined) S.soundOn = !!opts.soundOn;
}

/* ============================ RENDER ============================ */
function setBodyLevel(n) {
  document.body.setAttribute("data-level", String(n));
  // đặt background (phòng khi CSS chưa tải)
  const bgIdx = LEVELS[n - 1]?.bg || 1;
  if ($levelBg) $levelBg.style.backgroundImage = `url(assets/bg/bg${bgIdx}.jpg)`;
}

function buildLegend() {
  $legend.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const d = document.createElement("div");
    d.className = "tile";
    const img = document.createElement("img");
    img.src = ASSETS.iconUrl(i);
    img.alt = `icon_${i}`;
    img.onerror = () => { img.remove(); d.textContent = String(i); };
    d.appendChild(img);
    $legend.appendChild(d);
  }
  const ob = document.createElement("div");
  ob.className = "tile obstacle";
  const oi = document.createElement("img");
  oi.src = ASSETS.obstaclePick();
  oi.alt = "Obstacle";
  oi.onerror = () => { oi.remove(); ob.textContent = "🪨"; };
  ob.appendChild(oi);
  $legend.appendChild(ob);
}

function drawBoard() {
  // giữ lại #pathLayer; xóa .tile cũ
  $board.querySelectorAll(".tile").forEach(el => el.remove());
  $path.innerHTML = "";
  $path.setAttribute("viewBox", `0 0 ${(COLS) * (64 + 8)} ${(ROWS) * (64 + 8)}`);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = S.raw[r][c];
      const d = document.createElement("div");
      d.className = "tile";
      d.dataset.r = String(r); d.dataset.c = String(c);
      d.setAttribute("role", "gridcell");

      if (v === "" || v === undefined) {
        d.style.visibility = "hidden";
      } else if (typeof v === "object" && v.kind === "OB") {
        d.classList.add("obstacle");
        const img = document.createElement("img");
        img.src = v.src;
        img.alt = "Obstacle";
        img.onerror = () => { img.remove(); d.textContent = "🪨"; };
        d.appendChild(img);
      } else {
        const img = document.createElement("img");
        img.src = ASSETS.iconUrl(v);
        img.alt = `icon_${v}`;
        img.onerror = () => { img.remove(); d.textContent = String(v); };
        d.appendChild(img);
      }

      d.addEventListener("click", onClickTile);
      $board.appendChild(d);
    }
  }
}

function drawPath(nodes) {
  const svg = $path;
  svg.innerHTML = "";
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "url(#grad)");
  poly.setAttribute("stroke-width", "6");
  // điểm theo cell 64 & gap 8, pad 12 (khớp base.css)
  const pts = nodes.map(([R, C]) => {
    const x = (C - 1) * (64 + 8) + 32 + 12;
    const y = (R - 1) * (64 + 8) + 32 + 12;
    return `${x},${y}`;
  }).join(" ");
  poly.setAttribute("points", pts);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  grad.id = "grad";
  grad.setAttribute("x1", "0%"); grad.setAttribute("x2", "100%");
  grad.setAttribute("y1", "0%"); grad.setAttribute("y2", "0%");
  const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s1.setAttribute("offset", "0%"); s1.setAttribute("stop-color", "#34d399");
  const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s2.setAttribute("offset", "100%"); s2.setAttribute("stop-color", "#22d3ee");
  grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
  svg.appendChild(defs); svg.appendChild(poly);

  // auto clear
  setTimeout(() => svg.innerHTML = "", 280);
}

/* ============================ LOGIC KẾT NỐI ============================ */
// S.grid là ma trận (ROWS+2)x(COLS+2) có viền rỗng
function isEmpty(R, C) { return S.grid[R] && S.grid[R][C] === ""; }
function clearLine(R1, C1, R2, C2) {
  if (R1 === R2) {
    const [a, b] = C1 < C2 ? [C1, C2] : [C2, C1];
    for (let c = a + 1; c < b; c++) if (S.grid[R1][c] !== "") return false;
    return true;
  }
  if (C1 === C2) {
    const [a, b] = R1 < R2 ? [R1, R2] : [R2, R1];
    for (let r = a + 1; r < b; r++) if (S.grid[r][C1] !== "") return false;
    return true;
  }
  return false;
}

function canConnect(r1, c1, r2, c2) {
  if (r1 === r2 && c1 === c2) return null;
  // chỉ nối nếu cùng icon id & không phải obstacle/trống
  if (S.grid[r1][c1] !== S.grid[r2][c2]) return null;
  if (S.grid[r1][c1] === "" || typeof S.grid[r1][c1] === "object") return null;

  const val = S.grid[r1][c1];
  // tạm rỗng để dò đường
  S.grid[r1][c1] = ""; S.grid[r2][c2] = "";

  // 0 góc rẽ
  if (clearLine(r1, c1, r2, c2)) { restore(); return [[r1, c1], [r2, c2]]; }
  // 1 góc rẽ
  if (isEmpty(r1, c2) && clearLine(r1, c1, r1, c2) && clearLine(r1, c2, r2, c2)) { restore(); return [[r1, c1], [r1, c2], [r2, c2]]; }
  if (isEmpty(r2, c1) && clearLine(r1, c1, r2, c1) && clearLine(r2, c1, r2, c2)) { restore(); return [[r1, c1], [r2, c1], [r2, c2]]; }
  // 2 góc rẽ (quét cột & hàng)
  for (let cc = 0; cc < S.grid[0].length; cc++) {
    if (cc === c1 || cc === c2) continue;
    if (isEmpty(r1, cc) && isEmpty(r2, cc) && clearLine(r1, c1, r1, cc) && clearLine(r1, cc, r2, cc) && clearLine(r2, cc, r2, c2)) {
      restore(); return [[r1, c1], [r1, cc], [r2, cc], [r2, c2]];
    }
  }
  for (let rr = 0; rr < S.grid.length; rr++) {
    if (rr === r1 || rr === r2) continue;
    if (isEmpty(rr, c1) && isEmpty(rr, c2) && clearLine(r1, c1, rr, c1) && clearLine(rr, c1, rr, c2) && clearLine(rr, c2, r2, c2)) {
      restore(); return [[r1, c1], [rr, c1], [rr, c2], [r2, c2]];
    }
  }
  restore(); return null;

  function restore() { S.grid[r1][c1] = val; S.grid[r2][c2] = val; }
}

/* ============================ KHOI TẠO LEVEL ============================ */
function startLevel(n) {
  S.level = n;
  setBodyLevel(n);
  const cfg = LEVELS[n - 1];
  $level.textContent = String(n);
  S.combo = 0; updateCombo();
  S.score = S.score || 0; updateScore();
  S.timeLeft = cfg.time; updateTime();
  S.shufflesLeft = 3; $shuffles.textContent = String(S.shufflesLeft);

  // tạo cặp icon id theo types
  const pairsCount = Math.floor((ROWS * COLS - cfg.obstacles) / 2);
  const set = ICON_IDS.slice(0, cfg.types);
  const pairs = [];
  for (let i = 0; i < pairsCount; i++) { const id = set[i % set.length]; pairs.push(id, id); }
  const cells = shuffle(pairs);

  // chèn obstacle
  const flat = cells.slice(0, ROWS * COLS - cfg.obstacles);
  for (let i = 0; i < cfg.obstacles; i++) flat.splice(randInt(0, flat.length), 0, { ...OBSTACLE, src: ASSETS.obstaclePick() });
  const clipped = flat.slice(0, ROWS * COLS);

  S.raw = Array.from({ length: ROWS }, (_, r) => clipped.slice(r * COLS, (r + 1) * COLS));
  // grid có viền rỗng
  S.grid = Array.from({ length: ROWS + 2 }, () => Array(COLS + 2).fill(""));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) S.grid[r + 1][c + 1] = S.raw[r][c];

  drawBoard();
  resetTimer();
}

/* ============================ TƯƠNG TÁC ============================ */
function onClickTile(e) {
  if (S.paused) return;
  const r = +e.currentTarget.dataset.r, c = +e.currentTarget.dataset.c;
  const v = S.raw[r][c];
  if (v === "" || v === undefined || (typeof v === "object" && v.kind === "OB")) { playSfx(sfx.mismatch); return; }

  playSfx(sfx.click);

  if (!S.sel) {
    S.sel = { r, c, v, el: e.currentTarget };
    e.currentTarget.classList.add("sel");
    return;
  }
  const a = S.sel, b = { r, c, v, el: e.currentTarget };
  if (a.r === b.r && a.c === b.c) { a.el.classList.remove("sel"); S.sel = null; return; }
  if (a.v !== b.v) {
    a.el.classList.remove("sel"); S.sel = b; b.el.classList.add("sel");
    playSfx(sfx.mismatch);
    return;
  }

  const path = canConnect(a.r + 1, a.c + 1, b.r + 1, b.c + 1);
  if (path) {
    drawPath(path);
    doMatch(a, b);
  } else {
    toast("Không nối được!");
    a.el.classList.remove("sel"); S.sel = b; b.el.classList.add("sel");
    playSfx(sfx.mismatch);
  }
}

function doMatch(a, b) {
  // xoá trong raw+grid
  S.raw[a.r][a.c] = ""; S.raw[b.r][b.c] = "";
  S.grid[a.r + 1][a.c + 1] = ""; S.grid[b.r + 1][b.c + 1] = "";
  a.el.classList.remove("sel"); a.el.classList.add("matched"); b.el.classList.add("matched");
  S.sel = null;

  // điểm & combo (theo GDD)
  const base = 10;
  const t = now();
  if (t - S.lastMatchAt <= 2000) S.combo++; else S.combo = 1;
  S.lastMatchAt = t;

  let bonus = 0;
  if (S.combo === 2) bonus = 10;
  else if (S.combo === 3) bonus = 20;
  else if (S.combo === 4) { bonus = 30; addTime(5, true); toast("+5s ✨ Combo 4"); }
  else if (S.combo >= 5) bonus = 40;

  S.score += base + bonus;
  updateScore(); updateCombo();
  playSfx(sfx.match);

  // gravity + redraw
  applyGravity();
  drawBoard();

  // thắng level?
  if (isBoardCleared()) levelClear();
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const stack = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = S.raw[r][c];
      if (v === "") continue;
      stack.push(v);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      S.raw[r][c] = stack[ROWS - 1 - r] ?? "";
    }
  }
  // sync grid
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) S.grid[r + 1][c + 1] = S.raw[r][c];
}

function isBoardCleared() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = S.raw[r][c];
    if (v && !(typeof v === "object" && v.kind === "OB")) return false;
  }
  return true;
}

function levelClear() {
  stopTimer();
  const remain = Math.max(0, S.timeLeft);
  const bonus = remain * 10; // quy đổi như GDD
  S.score += bonus;
  updateScore();
  toast(`Hoàn thành level! +${bonus} điểm`);
  saveBest(S.score);
  saveLastLevel(Math.min(S.level + 1, LEVELS.length));
  saveOptions();
  playSfx(sfx.win);

  if (S.level < LEVELS.length) {
    setTimeout(() => startLevel(S.level + 1), 900);
  } else {
    setTimeout(() => alert(`🎉 Thắng game! Tổng điểm: ${S.score}`), 600);
  }
}

/* ============================ TIMER ============================ */
function resetTimer(resume = false) {
  stopTimer();
  const cfg = LEVELS[S.level - 1];
  const total = resume ? S.timeLeft : cfg.time;
  const speed = S.fastTimer ? 2 : 1;
  const t0 = performance.now();
  S.timerId = setInterval(() => {
    if (S.paused) return;
    const dt = Math.floor((performance.now() - t0) / 1000) * speed;
    S.timeLeft = Math.max(0, total - dt);
    updateTime();
    if (S.timeLeft <= 0) gameOver();
  }, 250);
}
function stopTimer() { if (S.timerId) { clearInterval(S.timerId); S.timerId = null; } }
function addTime(sec, boost = false) {
  S.timeLeft += sec;
  updateTime(boost);
}
function updateTime(boost = false) {
  $time.textContent = String(S.timeLeft);
  const cfg = LEVELS[S.level - 1];
  const p = Math.max(0, Math.min(1, S.timeLeft / cfg.time));
  $timebar.style.width = (p * 100) + "%";
  if (boost) {
    $timebar.classList.add("boost");
    setTimeout(() => $timebar.classList.remove("boost"), 220);
  }
}
function updateScore() { $score.textContent = String(S.score); }
function updateCombo() { $combo.textContent = String(S.combo); }

function gameOver() {
  stopTimer();
  playSfx(sfx.lose);
  alert("⏰ Hết thời gian!");
  saveBest(S.score);
  saveLastLevel(1);
  saveOptions();
  S.score = 0; updateScore();
  startLevel(1);
}

/* ============================ HINT & SHUFFLE ============================ */
function findAnyPair() {
  for (let r1 = 0; r1 < ROWS; r1++) for (let c1 = 0; c1 < COLS; c1++) {
    const v = S.raw[r1][c1];
    if (!v || (typeof v === "object" && v.kind === "OB")) continue;
    for (let r2 = r1; r2 < ROWS; r2++) for (let c2 = 0; c2 < COLS; c2++) {
      if (r1 === r2 && c2 <= c1) continue;
      if (S.raw[r2][c2] !== v) continue;
      const path = canConnect(r1 + 1, c1 + 1, r2 + 1, c2 + 1);
      if (path) return { r1, c1, r2, c2, path };
    }
  }
  return null;
}
function hint() {
  if (S.paused) return;
  const p = findAnyPair();
  if (!p) { toast("Không còn nước đi!"); playSfx(sfx.hint); return; }
  const idx1 = p.r1 * COLS + p.c1, idx2 = p.r2 * COLS + p.c2;
  const tiles = [...$board.querySelectorAll(".tile")];
  tiles[idx1].classList.add("sel");
  tiles[idx2].classList.add("sel");
  drawPath(p.path);
  setTimeout(() => { tiles[idx1].classList.remove("sel"); tiles[idx2].classList.remove("sel"); }, 500);
  playSfx(sfx.hint);
}

function shuffleBoard(force = false) {
  if (S.paused) return;
  if (!force) {
    if (S.shufflesLeft <= 0) { toast("Hết lượt xáo trộn"); playSfx(sfx.mismatch); return; }
    S.shufflesLeft--; $shuffles.textContent = String(S.shufflesLeft);
  }
  const items = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = S.raw[r][c];
    if (v && !(typeof v === "object" && v.kind === "OB")) items.push(v);
  }
  const mixed = shuffle(items); let k = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const v = S.raw[r][c];
    if (typeof v === "object" && v.kind === "OB") continue;
    if (v !== "") S.raw[r][c] = mixed[k++];
  }
  // sync grid
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) S.grid[r + 1][c + 1] = S.raw[r][c];

  drawBoard();
  playSfx(sfx.shuffle);
}

/* ============================ PAUSE / RESUME ============================ */
function setButtonsDisabled(dis) {
  $btnHint.disabled = dis;
  $btnShuffle.disabled = dis;
  $btnRestart.disabled = dis;
}
function pauseGame() {
  if (S.paused) return;
  S.paused = true;
  stopTimer();
  setButtonsDisabled(true);
  $overlay.hidden = false;
  toast("Đã tạm dừng");
}
function resumeGame() {
  if (!S.paused) return;
  S.paused = false;
  resetTimer(true);
  setButtonsDisabled(false);
  $overlay.hidden = true;
  toast("Tiếp tục");
}

/* ============================ BIND UI ============================ */
function bindUI() {
  $btnHint.addEventListener("click", () => { hint(); $btnHint.classList.add("clicked"); setTimeout(() => $btnHint.classList.remove("clicked"), 120); });
  $btnShuffle.addEventListener("click", () => { shuffleBoard(false); $btnShuffle.classList.add("clicked"); setTimeout(() => $btnShuffle.classList.remove("clicked"), 120); });
  $btnPause.addEventListener("click", () => S.paused ? resumeGame() : pauseGame());
  $btnRestart.addEventListener("click", () => { S.score = 0; updateScore(); startLevel(1); saveLastLevel(1); });
  $btnResume.addEventListener("click", resumeGame);
  $btnRestart2.addEventListener("click", () => { $overlay.hidden = true; S.score = 0; updateScore(); startLevel(1); saveLastLevel(1); });

  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "p") { S.paused ? resumeGame() : pauseGame(); }
    else if (k === "h" && !S.paused) { hint(); }
    else if (k === "r") { S.score = 0; updateScore(); startLevel(1); saveLastLevel(1); }
  });

  // sound toggle
  $btnSound.addEventListener("click", () => {
    S.soundOn = !S.soundOn;
    $icoSound.src = S.soundOn ? "assets/ui/onsound.png" : "assets/ui/offsound.png";
    saveOptions();
  });

  // options
  const $optAuto = document.getElementById("optAutoShuffle");
  const $optFast = document.getElementById("optFastTimer");
  if ($optAuto) {
    $optAuto.checked = S.autoShuffle;
    $optAuto.addEventListener("change", () => {
      S.autoShuffle = $optAuto.checked;
      saveOptions();
      if (S.autoShuffle) startAutoShuffle(); else stopAutoShuffle();
    });
  }
  if ($optFast) {
    $optFast.checked = S.fastTimer;
    $optFast.addEventListener("change", () => {
      S.fastTimer = $optFast.checked;
      saveOptions();
      if (!S.paused) resetTimer(true);
    });
  }
}

function startAutoShuffle() {
  stopAutoShuffle();
  S.autoShuffleTimerId = setInterval(() => {
    if (S.paused || !S.autoShuffle) return;
    if (!findAnyPair()) shuffleBoard(true);
  }, 2000);
}
function stopAutoShuffle() {
  if (S.autoShuffleTimerId) { clearInterval(S.autoShuffleTimerId); S.autoShuffleTimerId = null; }
}

/* ============================ BOOT ============================ */
(function boot() {
  // an toàn: rule ẩn overlay khi [hidden]
  const styleFix = document.createElement("style");
  styleFix.textContent = ".overlay[hidden]{display:none!important}";
  document.head.appendChild(styleFix);

  loadPersist();
  buildLegend();
  bindUI();
  startLevel(S.level || 1);
  startAutoShuffle();
})();
