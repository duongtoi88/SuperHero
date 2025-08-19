/* scripts/board.js
   Nối Thú Siêu Anh Hùng – Board & Path Layer
   - Render lưới 10x8 bằng ảnh từ assets
   - SVG path overlay hiển thị đường nối (≤ 2 góc rẽ, vẽ polyline phát sáng)
   - Hàm applyGravity để nén cột sau khi xóa cặp
*/

window.Board = (function(){
  // ---- cấu hình mặc định (có thể override bằng init) ----
  let CFG = {
    rows: 10,
    cols: 8,
    cell: 64,   // px
    gap: 8,     // px
    pad: 12,    // px, khớp CSS --pad
    assets: {
      iconUrl: id => `assets/icons/icon_${id}.png`,
      obstacleUrlPick: () => {
        const pool = ["Da1","Da2","Da3","Bang","Cay","Xoay1","Xoay2"];
        return `assets/obstacles/${pool[Math.floor(Math.random()*pool.length)]}.png`;
      }
    }
  };

  // ---- DOM refs (thiết lập bởi init) ----
  let $board = null;      // .board
  let $path  = null;      // #pathLayer (SVG)
  let $legend = null;     // #legend (tuỳ chọn)
  let $levelBg = null;    // #levelBg (tuỳ chọn)

  // ---- tiện ích nội bộ ----
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));

  function viewBoxSize(){
    // khớp với CSS: cell 64, gap 8, pad 12 (điểm giữa ô là + cell/2 + pad)
    const w = CFG.cols * (CFG.cell + CFG.gap);
    const h = CFG.rows * (CFG.cell + CFG.gap);
    return { w, h };
  }

  // ---- khởi tạo module Board ----
  function init({ boardEl, pathEl, legendEl, levelBgEl, rows, cols, cell, gap, pad, assets }){
    $board = boardEl;
    $path  = pathEl;
    $legend = legendEl || null;
    $levelBg = levelBgEl || null;

    if(rows) CFG.rows = rows;
    if(cols) CFG.cols = cols;
    if(cell) CFG.cell = cell;
    if(gap)  CFG.gap  = gap;
    if(pad)  CFG.pad  = pad;
    if(assets){
      CFG.assets.iconUrl = assets.iconUrl || CFG.assets.iconUrl;
      CFG.assets.obstacleUrlPick = assets.obstacleUrlPick || CFG.assets.obstacleUrlPick;
    }

    if($board) $board.style.setProperty('--cols', CFG.cols);

    // set viewBox cho SVG path
    if($path){
      const {w,h} = viewBoxSize();
      $path.setAttribute('viewBox', `0 0 ${w} ${h}`);
      $path.innerHTML = '';
    }
  }

  // ---- render legend (tuỳ chọn) ----
  function buildLegend(iconCount = 8){
    if(!$legend) return;
    $legend.innerHTML = '';
    for(let i=0;i<iconCount;i++){
      const d = document.createElement('div');
      d.className = 'tile';
      const img = document.createElement('img');
      img.alt = `icon_${i}`;
      img.src = CFG.assets.iconUrl(i);
      img.onerror = ()=>{ img.remove(); d.textContent = String(i); };
      d.appendChild(img);
      $legend.appendChild(d);
    }
    const ob = document.createElement('div');
    ob.className = 'tile obstacle';
    const oi = document.createElement('img');
    oi.alt = 'Obstacle';
    oi.src = CFG.assets.obstacleUrlPick();
    oi.onerror = ()=>{ oi.remove(); ob.textContent = '🪨'; };
    ob.appendChild(oi);
    $legend.appendChild(ob);
  }

  // ---- render board từ ma trận raw ----
  // raw[r][c]: '' | number(iconId) | {kind:"OB", src:string, dataKind?:string}
  // onTileClick(r,c,div) do game.js cung cấp
  function render(raw, onTileClick){
    if(!$board) return;
    // xoá mọi tile cũ, giữ nguyên SVG path
    $board.querySelectorAll('.tile').forEach(el=>el.remove());

    // đảm bảo path đúng viewBox
    if($path){
      const {w,h} = viewBoxSize();
      $path.setAttribute('viewBox', `0 0 ${w} ${h}`);
      $path.innerHTML = '';
    }

    for(let r=0;r<CFG.rows;r++){
      for(let c=0;c<CFG.cols;c++){
        const v = raw[r][c];
        const d = document.createElement('div');
        d.className = 'tile';
        d.dataset.r = String(r);
        d.dataset.c = String(c);
        d.setAttribute('role','gridcell');

        if(v === '' || v === undefined){
          d.style.visibility = 'hidden';
        }
        else if(typeof v === 'object' && v.kind === 'OB'){
          d.classList.add('obstacle');
          if(v.dataKind) d.dataset.kind = v.dataKind;
          const img = document.createElement('img');
          img.alt = 'Obstacle';
          img.src = v.src || CFG.assets.obstacleUrlPick();
          img.onerror = ()=>{ img.remove(); d.textContent = '🪨'; };
          d.appendChild(img);
        }
        else {
          const img = document.createElement('img');
          img.alt = `icon_${v}`;
          img.src = CFG.assets.iconUrl(v);
          img.onerror = ()=>{ img.remove(); d.textContent = String(v); };
          d.appendChild(img);
        }

        if(onTileClick) on(d,'click', e=>{
          const rr = +d.dataset.r, cc = +d.dataset.c;
          onTileClick(rr, cc, d, e);
        });

        $board.appendChild(d);
      }
    }
  }

  // ---- vẽ đường nối bằng polyline ----
  // nodes: [[R,C], ...] theo toạ độ có "viền padding" (grid ROWS+2, COLS+2)
  function drawPath(nodes){
    if(!$path) return;
    $path.innerHTML = '';

    const poly = document.createElementNS('http://www.w3.org/2000/svg','polyline');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', 'url(#grad)');
    poly.setAttribute('stroke-width', '6');

    // chuyển node (R,C) => pixel (x,y)
    // mỗi cell: (cell+gap), tâm ô: + cell/2, offset pad (khớp CSS)
    const pts = nodes.map(([R,C])=>{
      const x = (C-1) * (CFG.cell + CFG.gap) + (CFG.cell/2) + CFG.pad;
      const y = (R-1) * (CFG.cell + CFG.gap) + (CFG.cell/2) + CFG.pad;
      return `${x},${y}`;
    }).join(' ');
    poly.setAttribute('points', pts);

    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    const grad = document.createElementNS('http://www.w3.org/2000/svg','linearGradient');
    grad.id='grad'; grad.setAttribute('x1','0%'); grad.setAttribute('x2','100%');
    grad.setAttribute('y1','0%'); grad.setAttribute('y2','0%');
    const s1=document.createElementNS('http://www.w3.org/2000/svg','stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','#34d399');
    const s2=document.createElementNS('http://www.w3.org/2000/svg','stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','#22d3ee');
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
    $path.appendChild(defs);
    $path.appendChild(poly);

    // auto fade
    setTimeout(()=>{ if($path) $path.innerHTML=''; }, 280);
  }

  function clearPath(){
    if($path) $path.innerHTML = '';
  }

  // ---- nén cột (gravity) cho ma trận raw ----
  function applyGravity(raw){
    const rows = raw.length, cols = raw[0]?.length ?? 0;
    for(let c=0;c<cols;c++){
      const stack = [];
      for(let r=rows-1;r>=0;r--){
        const v = raw[r][c];
        if(v === '') continue;
        stack.push(v);
      }
      for(let r=rows-1;r>=0;r--){
        raw[r][c] = stack[rows-1-r] ?? '';
      }
    }
    return raw; // trả về cùng tham chiếu để game.js sync grid
  }

  // ---- đổi nền theo level (1..7) & set data-level để CSS skin theo GDD ----
  function setLevelBg(levelIndex){
    const n = clamp(levelIndex, 1, 7);
    document.body.setAttribute('data-level', String(n));
    if($levelBg){
      $levelBg.style.backgroundImage = `url(assets/bg/bg${n}.jpg)`;
    }
  }

  return {
    init,
    render,
    buildLegend,
    drawPath,
    clearPath,
    applyGravity,
    setLevelBg,
  };
})();
