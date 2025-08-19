/* scripts/utils.js
   Nối Thú Siêu Anh Hùng – Utility functions
   - Hàm chung: rand, shuffle, clone, delay
   - SFX (click, pop, combo) theo GDD:contentReference[oaicite:2]{index=2}
   - UI: toast, hint highlight
*/

window.Utils = (function(){
  /* ===== Random & Array ===== */
  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function clone2D(grid){
    return grid.map(row => row.slice());
  }

  /* ===== Async helpers ===== */
  function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

  /* ===== SFX (âm thanh) ===== */
  // Theo GDD: click khi chọn, pop khi nối, combo âm thanh đặc biệt:contentReference[oaicite:3]{index=3}
  const SFX = {
    click: new Audio('assets/sfx/click.wav'),
    pop:   new Audio('assets/sfx/pop.wav'),
    combo: new Audio('assets/sfx/combo.wav'),
    win:   new Audio('assets/sfx/win.wav'),
    lose:  new Audio('assets/sfx/lose.wav'),
    time:  new Audio('assets/sfx/time.wav'),
  };
  for(const k in SFX){ SFX[k].volume=0.6; }

  function playSfx(name, enabled=true){
    if(!enabled) return;
    const a = SFX[name];
    if(a){ try{ a.currentTime=0; a.play(); }catch{} }
  }

  /* ===== UI nhỏ ===== */
  function toast(msg, timeout=1500){
    const div = document.createElement('div');
    div.className='toast show';
    div.textContent=msg;
    document.body.appendChild(div);
    setTimeout(()=>div.remove(), timeout);
  }

  // highlight hint (2 tile)
  function highlightTiles(tiles, className='hint', ms=800){
    tiles.forEach(t=>t.classList.add(className));
    setTimeout(()=>tiles.forEach(t=>t.classList.remove(className)), ms);
  }

  /* ===== Exports ===== */
  return {
    randInt, shuffle, clone2D, delay,
    playSfx, toast, highlightTiles
  };
})();
