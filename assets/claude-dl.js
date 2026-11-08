/* Downloads and image viewing when the site runs inside a Claude artifact page.
   There, new tabs and the download attribute are blocked, so links to files go
   through the artifact "downloads" capability and images open in an overlay.
   On GitHub Pages or any normal host window.claude is absent and nothing changes. */
(function () {
  if (!window.claude || typeof window.claude.use !== 'function') return;
  var dlP = null;
  function dl() { return dlP || (dlP = window.claude.use('downloads').catch(function () { return null; })); }
  function name(href) { return decodeURIComponent(href.split('?')[0].split('/').slice(-2).join('-')); }

  var css = document.createElement('style');
  css.textContent = '.cdl-ov{position:fixed;inset:0;z-index:100;background:rgba(20,24,28,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px}' +
    '.cdl-ov img{max-width:100%;max-height:calc(100vh - 96px);object-fit:contain;border-radius:8px;background:#fff}' +
    '.cdl-bar{display:flex;gap:8px}.cdl-bar button{font:inherit;font-size:16px;min-height:44px;padding:8px 20px;border-radius:12px;border:0;cursor:pointer;background:#fff;color:#1d1d1f}' +
    '.cdl-bar button.p{background:#1f8fbf;color:#fff}' +
    '.cdl-msg{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:101;background:#1d1d1f;color:#fff;padding:8px 16px;border-radius:10px;font-size:15px}';
  document.head.appendChild(css);

  function toast(t) {
    var m = document.createElement('div'); m.className = 'cdl-msg'; m.textContent = t;
    document.body.appendChild(m); setTimeout(function () { m.remove(); }, 3000);
  }

  function save(href) {
    toast('جارٍ تجهيز الملف…');
    return Promise.all([dl(), fetch(href).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })])
      .then(function (v) {
        if (!v[0]) { toast('التنزيل غير متاح هنا'); return; }
        return v[0].save({ filename: name(href), data: v[1] }).catch(function (e) {
          if (e && e.code === 'declined') return;
          toast(e && e.code === 'rejected_extension' ? 'هذا النوع من الملفات لا يُنزَّل هنا' : 'تعذّر التنزيل، حاول مرة أخرى');
        });
      })
      .catch(function () { toast('الملف غير موجود في هذه النسخة'); });
  }

  function view(href) {
    var ov = document.createElement('div'); ov.className = 'cdl-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    var img = document.createElement('img'); img.src = href; img.alt = '';
    var bar = document.createElement('div'); bar.className = 'cdl-bar';
    var b1 = document.createElement('button'); b1.className = 'p'; b1.textContent = 'تنزيل الصورة';
    var b2 = document.createElement('button'); b2.textContent = 'إغلاق';
    b1.onclick = function () { save(href); };
    function close() { ov.remove(); document.removeEventListener('keydown', esc); }
    function esc(e) { if (e.key === 'Escape') close(); }
    b2.onclick = close; ov.onclick = function (e) { if (e.target === ov) close(); };
    document.addEventListener('keydown', esc);
    bar.append(b1, b2); ov.append(img, bar); document.body.appendChild(ov); b2.focus();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!/^assets\//.test(href)) return;
    var isFile = /\.(pdf|jpe?g|png|webp|mp4|pptx|docx|zip)(\?|$)/i.test(href);
    if (!isFile) return;
    if (a.hasAttribute('download')) { e.preventDefault(); save(href); return; }
    if (a.target === '_blank') {
      e.preventDefault();
      if (/\.(jpe?g|png|webp)(\?|$)/i.test(href)) view(href); else save(href);
    }
  }, true);
})();
