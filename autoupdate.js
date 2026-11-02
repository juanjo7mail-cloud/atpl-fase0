/* Actualización automática: si hay una versión nueva de la web, se recarga sola
   cuando no estás haciendo un test y llevas 1 minuto sin tocar nada.
   Si estás en mitad de un test, solo avisa y espera a que lo termines. */
(function () {
  var B = window.F0_BUILD;
  if (!B || location.protocol === "file:") return;
  var IDLE = 60 * 1000, EVERY = 5 * 60 * 1000, KEY = "f0:upd";
  var last = Date.now(), pending = false, bar = null, target = null, checking = false;
  function st() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} }
  // si venimos de una recarga con ?nc=, se limpia la URL; si ya estamos en la versión buscada, se borra el aviso
  try { if (/[?&]nc=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash); } catch (_) {}
  (function () { var s0 = st(); if (s0.v === B) save({}); })();
  function touch() { last = Date.now(); }
  var EV = ["pointerdown", "keydown", "scroll", "touchstart", "wheel", "mousemove"];
  EV.forEach(function (e) { addEventListener(e, touch, { passive: true, capture: true }); });
  function watchFrames() {
    var fr = document.querySelectorAll("iframe");
    for (var i = 0; i < fr.length; i++) {
      try {
        var w = fr[i].contentWindow;
        if (w && fr[i]._f0w !== w) { fr[i]._f0w = w; EV.forEach(function (e) { w.addEventListener(e, touch, { passive: true, capture: true }); }); }
      } catch (_) {}
    }
  }
  function testRunning() {
    var fr = document.querySelectorAll("iframe");
    for (var i = 0; i < fr.length; i++) {
      try {
        var q = fr[i].contentDocument && fr[i].contentDocument.getElementById("quiz");
        if (q && !q.hidden) return true;
      } catch (_) {}
    }
    return false;
  }
  // Recarga saltando cualquier caché (CDN, navegador, service worker): URL nueva con ?nc=
  // y como mucho 2 intentos por versión; si tras eso sigue igual, no se insiste.
  function reload(force) {
    var s0 = st();
    if (!target) return;
    if (force || s0.v !== target) s0 = { v: target, n: 0 };
    if (s0.n >= 2) { pending = false; banner(false); return; }
    save({ v: target, n: s0.n + 1, t: Date.now() });
    location.replace(location.pathname + "?nc=" + target + location.hash);
  }
  function banner(show) {
    if (!show) { if (bar) bar.style.display = "none"; return; }
    if (!bar) {
      var st = document.createElement("style");
      st.textContent = "#f0upd{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom,0px));z-index:99999;display:flex;align-items:center;gap:9px;max-width:calc(100vw - 24px);padding:6px 6px 6px 12px;border-radius:999px;background:var(--head,#14304A);color:#E3ECF2;border:1px solid rgba(232,191,69,.45);box-shadow:0 8px 24px rgba(0,0,0,.35);font:600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;white-space:nowrap;transform:translateX(-50%);-webkit-animation:f0updin .35s cubic-bezier(.2,1.3,.4,1) both;animation:f0updin .35s cubic-bezier(.2,1.3,.4,1) both}" +
        "#f0upd svg{flex:none;color:#E8BF45}" +
        "#f0upd button{font:inherit;font-weight:800;color:#14304A;background:linear-gradient(180deg,#F4D26A,#E0AD2A);border:0;border-radius:999px;min-height:32px;padding:0 14px;cursor:pointer}" +
        "#f0upd button:active{transform:translateY(1px)}#f0upd button:focus-visible{outline:2px solid #fff;outline-offset:2px}" +
        "@-webkit-keyframes f0updin{from{opacity:0;-webkit-transform:translate(-50%,16px)}}@keyframes f0updin{from{opacity:0;transform:translate(-50%,16px)}}" +
        "@media (prefers-reduced-motion:reduce){#f0upd{-webkit-animation:none;animation:none}}";
      document.head.appendChild(st);
      bar = document.createElement("div");
      bar.id = "f0upd";
      bar.setAttribute("role", "status");
      bar.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M20 20v-4h-4"/></svg><span>Versión nueva</span><button type="button">Actualizar</button>';
      bar.querySelector("button").onclick = function () { reload(true); };
      document.body.appendChild(bar);
    }
    bar.style.display = "flex";
  }
  function decide() {
    if (!pending) return;
    watchFrames();
    if (testRunning()) { banner(true); return; }
    if (Date.now() - last >= IDLE || document.hidden) { reload(false); return; }
    banner(true);
  }
  // Solo hay versión nueva si el HTML recién descargado (sin caché) trae otro identificador que el de esta página.
  function check() {
    if (!navigator.onLine || checking) return;
    checking = true;
    fetch("version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.v || j.v === B) { checking = false; return null; }
        return fetch(location.pathname + "?nc=" + Date.now(), { cache: "no-store" })
          .then(function (r) { return r.ok ? r.text() : ""; })
          .then(function (h) {
            var m = /F0_BUILD="([a-f0-9]+)"/.exec(h || "");
            checking = false;
            if (m && m[1] !== B) { target = m[1]; pending = true; decide(); }
          });
      })
      .catch(function () { checking = false; });
  }
  setInterval(watchFrames, 15000);
  setInterval(check, EVERY);
  setInterval(decide, 20000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { last = Date.now() - IDLE; check(); decide(); } });
  addEventListener("online", check);
  setTimeout(check, 4000);
})();
