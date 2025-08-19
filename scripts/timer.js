/* scripts/timer.js
   Nối Thú Siêu Anh Hùng – Timer
   - Mỗi level có đồng hồ đếm ngược (GDD):contentReference[oaicite:4]{index=4}
   - Combo 4 cộng +5 giây (để game.js gọi Timer.add(5)):contentReference[oaicite:5]{index=5}
   - Khi clear level, game.js quy đổi thưởng = timeLeft * 10:contentReference[oaicite:6]{index=6}
*/
(function (global) {
  const T = {
    _t0: 0,            // mốc thời gian bắt đầu (performance.now)
    _dur: 0,           // tổng thời gian level (giây)
    _left: 0,          // còn lại (giây)
    _speed: 1,         // 1x bình thường; 2x cho fastTimer
    _paused: false,
    _tickId: null,
    _tickMs: 250,      // độ mịn cập nhật
    _onTimeout: null,  // callback khi hết giờ
    _els: { timeText: null, bar: null, barMax: 1 },

    /** Khởi tạo/Reset cho level mới */
    init({ seconds, timeTextEl, barEl, onTimeout, fast = false }) {
      this.stop();
      this._dur = Math.max(0, Math.floor(seconds || 0));
      this._left = this._dur;
      this._speed = fast ? 2 : 1;
      this._paused = false;
      this._onTimeout = typeof onTimeout === 'function' ? onTimeout : null;

      this._els.timeText = timeTextEl || null;
      this._els.bar = barEl || null;
      this._els.barMax = Math.max(1, this._dur);

      this._render(true);
      return this;
    },

    /** Bắt đầu chạy (từ đầu hoặc tiếp tục với _left hiện tại) */
    start() {
      this.stop();
      this._t0 = performance.now();
      const baseLeft = this._left;

      this._tickId = setInterval(() => {
        if (this._paused) return;
        const dt = Math.floor((performance.now() - this._t0) / 1000) * this._speed;
        this._left = Math.max(0, baseLeft - dt);
        this._render();
        if (this._left <= 0) {
          this.stop();
          if (this._onTimeout) this._onTimeout();
        }
      }, this._tickMs);
      return this;
    },

    /** Tạm dừng */
    pause() { this._paused = true; return this; },

    /** Tiếp tục (không reset thời gian) */
    resume() {
      if (!this._paused) return this;
      this._paused = false;
      // bắt đầu lại tick dựa trên _left hiện tại
      const remaining = this._left;
      this.stop();
      this._t0 = performance.now();
      this._tickId = setInterval(() => {
        if (this._paused) return;
        const dt = Math.floor((performance.now() - this._t0) / 1000) * this._speed;
        this._left = Math.max(0, remaining - dt);
        this._render();
        if (this._left <= 0) {
          this.stop();
          if (this._onTimeout) this._onTimeout();
        }
      }, this._tickMs);
      return this;
    },

    /** Dừng hẳn timer */
    stop() {
      if (this._tickId) { clearInterval(this._tickId); this._tickId = null; }
      return this;
    },

    /** Đặt nhanh chế độ timer (1x/2x), giữ nguyên _left */
    setSpeed(mult) {
      this._speed = mult >= 2 ? 2 : 1;
      // khởi động lại cho chính xác
      const keep = this._left;
      const paused = this._paused;
      this.stop();
      this._left = keep;
      this._paused = paused;
      if (!paused) this.resume();
      else this._render();
      return this;
    },

    /** Cộng thời gian (ví dụ combo 4 +5s theo GDD):contentReference[oaicite:7]{index=7} */
    add(sec) {
      const v = Math.max(0, Math.floor(sec || 0));
      this._left = Math.min(this._left + v, this._dur); // không vượt quá thời gian gốc
      this._render(true); // hiệu ứng boost thanh thời gian (class .boost do CSS)
      return this._left;
    },

    /** Lấy thời gian còn lại (giây) */
    left() { return Math.max(0, Math.floor(this._left)); },

    /** Lấy tổng thời gian level */
    duration() { return this._dur; },

    /** Vẽ UI */
    _render(boost = false) {
      if (this._els.timeText) this._els.timeText.textContent = String(this.left());
      if (this._els.bar) {
        const p = Math.max(0, Math.min(1, this._left / this._els.barMax));
        this._els.bar.style.width = (p * 100) + '%';
        if (boost) {
          this._els.bar.classList.add('boost');
          setTimeout(() => this._els.bar && this._els.bar.classList.remove('boost'), 220);
        }
      }
    },
  };

  // export
  global.Timer = T;
})(window);
