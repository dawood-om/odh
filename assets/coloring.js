/* On-screen coloring for coloring.html.
   Two stacked canvases: #cbColor holds the paint, #cbLines holds the line art
   (multiplied on top so lines always stay crisp). Fill uses the line art as walls. */
(function () {
  var W = 930, H = 1316, WALL = 170, MAX_UNDO = 10;
  var titles = window.CB_PAGES || [];
  var cc = document.getElementById('cbColor'), lc = document.getElementById('cbLines');
  if (!cc || !lc) return;
  var frame = document.getElementById('cbFrame'), load = document.getElementById('cbLoad'), cap = document.getElementById('cbCap');
  var tools = document.querySelector('.cb-tools'), undoBtn = document.getElementById('cbUndo');
  cc.width = lc.width = W; cc.height = lc.height = H;
  var cx = cc.getContext('2d', { willReadFrequently: true }), lx = lc.getContext('2d', { willReadFrequently: true });
  var wall = null, page = '01', tool = 'fill', color = '#1f6fb2', size = 14, undo = [], token = 0;

  function key(p) { return 'cb-page-' + p; }
  function store(p, v) { try { if (v) localStorage.setItem(key(p), v); else localStorage.removeItem(key(p)); } catch (e) {} }
  function stored(p) { try { return localStorage.getItem(key(p)); } catch (e) { return null; } }
  function toast(t) { var m = document.createElement('div'); m.className = 'cb-toast'; m.textContent = t; document.body.appendChild(m); setTimeout(function () { m.remove(); }, 2600); }

  function blank() { cx.globalCompositeOperation = 'source-over'; cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); }
  function pushUndo() { undo.push(cx.getImageData(0, 0, W, H)); if (undo.length > MAX_UNDO) undo.shift(); undoBtn.disabled = false; }
  var saveT = 0;
  function persist() { clearTimeout(saveT); var p = page; saveT = setTimeout(function () { store(p, cc.toDataURL('image/png')); }, 400); }

  function open(p) {
    var my = ++token; page = p; undo = []; undoBtn.disabled = true; load.hidden = false;
    var n = parseInt(p, 10); cap.textContent = n + '. ' + (titles[n - 1] || '');
    document.querySelectorAll('.cb-th').forEach(function (b) { var on = b.dataset.p === p; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
    lc.setAttribute('aria-label', 'صفحة التلوين: ' + (titles[n - 1] || ''));
    var img = new Image();
    img.onload = function () {
      if (my !== token) return;
      lx.fillStyle = '#fff'; lx.fillRect(0, 0, W, H); lx.drawImage(img, 0, 0, W, H);
      var d = lx.getImageData(0, 0, W, H).data; wall = new Uint8Array(W * H);
      for (var i = 0, j = 0; i < wall.length; i++, j += 4) wall[i] = (d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11) < WALL ? 1 : 0;
      blank();
      var saved = stored(p);
      if (saved) { var s = new Image(); s.onload = function () { if (my === token) cx.drawImage(s, 0, 0, W, H); load.hidden = true; }; s.onerror = function () { load.hidden = true; }; s.src = saved; }
      else load.hidden = true;
    };
    img.onerror = function () { if (my === token) load.textContent = 'تعذّر تحميل الصفحة'; };
    img.src = 'assets/coloring/page-' + p + '.png';
  }

  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

  function fill(x, y, hex) {
    if (!wall) return;
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    var start = y * W + x;
    if (wall[start]) { // tapped on a line: find nearby open pixel
      var found = -1;
      for (var r = 1; r < 6 && found < 0; r++) for (var dy = -r; dy <= r && found < 0; dy++) for (var dx = -r; dx <= r; dx++) {
        var xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        if (!wall[yy * W + xx]) { found = yy * W + xx; break; }
      }
      if (found < 0) return; start = found;
    }
    var mask = new Uint8Array(W * H), stack = [start]; mask[start] = 1;
    while (stack.length) {
      var i = stack.pop(), px = i % W;
      if (px > 0 && !mask[i - 1] && !wall[i - 1]) { mask[i - 1] = 1; stack.push(i - 1); }
      if (px < W - 1 && !mask[i + 1] && !wall[i + 1]) { mask[i + 1] = 1; stack.push(i + 1); }
      if (i >= W && !mask[i - W] && !wall[i - W]) { mask[i - W] = 1; stack.push(i - W); }
      if (i < W * (H - 1) && !mask[i + W] && !wall[i + W]) { mask[i + W] = 1; stack.push(i + W); }
    }
    pushUndo();
    var img = cx.getImageData(0, 0, W, H), d = img.data, c = rgb(hex);
    // paint the region and spread 2px under the lines so no white halo is left
    for (var k = 0; k < mask.length; k++) {
      var paint = mask[k];
      if (!paint && wall[k]) {
        var kx = k % W;
        for (var oy = -2; oy <= 2 && !paint; oy++) for (var ox = -2; ox <= 2; ox++) {
          var nx = kx + ox, n = k + oy * W + ox; if (nx < 0 || nx >= W || n < 0 || n >= mask.length) continue;
          if (mask[n]) { paint = 1; break; }
        }
      }
      if (paint) { var q = k * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255; }
    }
    cx.putImageData(img, 0, 0); persist();
  }

  function pos(e) { var r = lc.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  var drawing = false, last = null;
  lc.addEventListener('pointerdown', function (e) {
    if (e.button && e.button !== 0) return;
    var p = pos(e);
    if (tool === 'fill') { fill(p[0], p[1], color); return; }
    e.preventDefault(); lc.setPointerCapture && lc.setPointerCapture(e.pointerId);
    pushUndo(); drawing = true; last = p; stroke(p, p);
  });
  lc.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pos(e); stroke(last, p); last = p; });
  function end() { if (drawing) { drawing = false; persist(); } }
  lc.addEventListener('pointerup', end); lc.addEventListener('pointercancel', end); lc.addEventListener('pointerleave', end);
  function stroke(a, b) {
    cx.globalCompositeOperation = 'source-over';
    cx.strokeStyle = tool === 'erase' ? '#fff' : color; cx.lineWidth = size * (W / 620); cx.lineCap = cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0] + 0.01, b[1]); cx.stroke();
  }

  function setTool(t) {
    tool = t;
    document.querySelectorAll('.cb-tool').forEach(function (b) { var on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    var brushy = t !== 'fill'; tools.classList.toggle('brushy', brushy); frame.classList.toggle('brushy', brushy);
  }
  document.querySelectorAll('.cb-tool').forEach(function (b) { b.onclick = function () { setTool(b.dataset.t); }; });
  document.querySelectorAll('.cb-sz').forEach(function (b) { b.onclick = function () { size = +b.dataset.s; document.querySelectorAll('.cb-sz').forEach(function (o) { o.classList.toggle('on', o === b); o.setAttribute('aria-pressed', o === b); }); if (tool === 'fill') setTool('brush'); }; });
  document.querySelectorAll('.cb-sw').forEach(function (b) { b.onclick = function () { color = b.dataset.c; document.querySelectorAll('.cb-sw').forEach(function (o) { o.classList.toggle('on', o === b); o.setAttribute('aria-pressed', o === b); }); if (tool === 'erase') setTool('brush'); }; });
  document.querySelectorAll('.cb-th').forEach(function (b) { b.onclick = function () { open(b.dataset.p); }; });
  document.querySelectorAll('.cb-go').forEach(function (b) { b.onclick = function () { open(b.dataset.p); document.getElementById('studio').scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });

  undoBtn.onclick = function () { var u = undo.pop(); if (u) { cx.putImageData(u, 0, 0); persist(); } undoBtn.disabled = !undo.length; };
  document.getElementById('cbClear').onclick = function () { pushUndo(); blank(); store(page, null); };

  function composite() {
    var o = document.createElement('canvas'); o.width = W; o.height = H; var ox = o.getContext('2d');
    ox.drawImage(cc, 0, 0); ox.globalCompositeOperation = 'multiply'; ox.drawImage(lc, 0, 0); return o;
  }
  document.getElementById('cbSave').onclick = function () {
    var name = 'coloring-page-' + page + '.png';
    composite().toBlob(function (blob) {
      if (!blob) return;
      if (window.claude && typeof window.claude.use === 'function') {
        window.claude.use('downloads').then(function (d) { return d.save({ filename: name, data: blob }); })
          .catch(function (e) { if (!e || e.code !== 'declined') toast('تعذّر الحفظ، حاول مرة أخرى'); });
        return;
      }
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('حُفظت صورتك');
    }, 'image/png');
  };
  document.getElementById('cbPrint').onclick = function () {
    var im = document.getElementById('cbPrintImg');
    im.onload = function () { document.body.classList.add('cb-printing'); setTimeout(function () { window.print(); }, 50); };
    im.src = composite().toDataURL('image/png');
  };
  window.addEventListener('afterprint', function () { document.body.classList.remove('cb-printing'); });

  var pr = document.querySelector('.cb-print'); if (pr) document.body.appendChild(pr);
  var startP = (location.hash.match(/^#p(\d\d)$/) || [])[1] || '01';
  open(startP);
})();
