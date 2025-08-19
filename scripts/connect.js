/* scripts/connect.js
   Nối Thú Siêu Anh Hùng – Connect (pathfinding ≤ 2 góc rẽ)
   Làm việc với:
   - grid: ma trận (ROWS+2) x (COLS+2) có viền rỗng ở quanh mép
           grid[r][c] ∈ {'', number(iconId), {kind:'OB', ...}}
   - raw:  ma trận ROWS x COLS để hiển thị
   Quy tắc:
   - Chỉ nối giữa 2 icon cùng id
   - Đường đi rỗng, tối đa 2 góc rẽ (0, 1 hoặc 2 khúc)
*/

window.Connect = (function () {
  // ---------- Helpers ----------
  function isEmpty(grid, R, C) {
    // Hợp lệ & rỗng ('')
    return !!(grid[R] && grid[R][C] === '');
  }

  function isObstacle(v) {
    // Vật cản là object có kind === 'OB'
    return typeof v === 'object' && v && v.kind === 'OB';
  }

  function clearLine(grid, R1, C1, R2, C2) {
    // Đường thẳng giữa (R1,C1) và (R2,C2) không đi qua ô không trống
    if (R1 === R2) {
      const [a, b] = C1 < C2 ? [C1, C2] : [C2, C1];
      for (let c = a + 1; c < b; c++) if (grid[R1][c] !== '') return false;
      return true;
    }
    if (C1 === C2) {
      const [a, b] = R1 < R2 ? [R1, R2] : [R2, R1];
      for (let r = a + 1; r < b; r++) if (grid[r][C1] !== '') return false;
      return true;
    }
    return false;
  }

  // ---------- Core: canConnect ----------
  // Tọa độ vào đây là tọa độ có padding (grid), tức là từ 1..ROWS & 1..COLS
  // Trả về mảng node [[R,C], ...] nếu nối được; null nếu không.
  function canConnect(grid, r1, c1, r2, c2) {
    if (r1 === r2 && c1 === c2) return null;

    const v1 = grid[r1][c1];
    const v2 = grid[r2][c2];

    // Cùng icon id & không phải obstacle/trống
    if (v1 !== v2) return null;
    if (v1 === '' || isObstacle(v1)) return null;

    // Tạm rỗng 2 điểm để dò đường
    grid[r1][c1] = '';
    grid[r2][c2] = '';

    // 0 góc rẽ (đường thẳng)
    if (clearLine(grid, r1, c1, r2, c2)) {
      restore(); return [[r1, c1], [r2, c2]];
    }

    // 1 góc rẽ (L): thử 2 điểm giao (r1,c2) và (r2,c1)
    if (isEmpty(grid, r1, c2) &&
        clearLine(grid, r1, c1, r1, c2) &&
        clearLine(grid, r1, c2, r2, c2)) {
      restore(); return [[r1, c1], [r1, c2], [r2, c2]];
    }
    if (isEmpty(grid, r2, c1) &&
        clearLine(grid, r1, c1, r2, c1) &&
        clearLine(grid, r2, c1, r2, c2)) {
      restore(); return [[r1, c1], [r2, c1], [r2, c2]];
    }

    // 2 góc rẽ (Z): quét theo cột trung gian & hàng trung gian
    // Quét cột
    for (let cc = 0; cc < grid[0].length; cc++) {
      if (cc === c1 || cc === c2) continue;
      if (isEmpty(grid, r1, cc) &&
          isEmpty(grid, r2, cc) &&
          clearLine(grid, r1, c1, r1, cc) &&
          clearLine(grid, r1, cc, r2, cc) &&
          clearLine(grid, r2, cc, r2, c2)) {
        restore(); return [[r1, c1], [r1, cc], [r2, cc], [r2, c2]];
      }
    }
    // Quét hàng
    for (let rr = 0; rr < grid.length; rr++) {
      if (rr === r1 || rr === r2) continue;
      if (isEmpty(grid, rr, c1) &&
          isEmpty(grid, rr, c2) &&
          clearLine(grid, r1, c1, rr, c1) &&
          clearLine(grid, rr, c1, rr, c2) &&
          clearLine(grid, rr, c2, r2, c2)) {
        restore(); return [[r1, c1], [rr, c1], [rr, c2], [r2, c2]];
      }
    }

    restore();
    return null;

    function restore() {
      grid[r1][c1] = v1;
      grid[r2][c2] = v2;
    }
  }

  // ---------- Utility: tìm một cặp hợp lệ để gợi ý ----------
  // raw: ROWS x COLS (giá trị '' | iconId | {kind:'OB',...})
  // Trả về { r1, c1, r2, c2, path } với path là node array theo tọa độ grid (có padding)
  function findAnyPair(raw, grid) {
    const ROWS = raw.length;
    const COLS = raw[0]?.length ?? 0;

    for (let r1 = 0; r1 < ROWS; r1++) for (let c1 = 0; c1 < COLS; c1++) {
      const v = raw[r1][c1];
      if (!v || (typeof v === 'object' && v.kind === 'OB')) continue;

      for (let r2 = r1; r2 < ROWS; r2++) for (let c2 = 0; c2 < COLS; c2++) {
        if (r1 === r2 && c2 <= c1) continue;
        if (raw[r2][c2] !== v) continue;

        // chú ý +1 do grid có padding 1
        const path = canConnect(grid, r1 + 1, c1 + 1, r2 + 1, c2 + 1);
        if (path) return { r1, c1, r2, c2, path };
      }
    }
    return null;
  }

  // ---------- Exports ----------
  return {
    canConnect,   // (grid, r1,c1,r2,c2) -> nodes[] | null    // r,c là tọa độ grid (có padding)
    findAnyPair,  // (raw, grid) -> {r1,c1,r2,c2,path} | null // r,c là tọa độ raw; path theo grid
    clearLine: (grid, R1, C1, R2, C2) => clearLine(grid, R1, C1, R2, C2),
    isEmpty: (grid, R, C) => isEmpty(grid, R, C),
    isObstacle,
  };
})();
