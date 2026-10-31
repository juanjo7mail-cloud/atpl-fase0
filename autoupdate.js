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
      bar = document.createElement("div");
      bar.setAttribute("role", "status");
      bar.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99999;max-width:min(92vw,360px);padding:10px 12px;border-radius:10px;background:#0b3d6b;color:#fff;font:14px/1.35 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35)";
      bar.innerHTML = '<span>Hay una versión nueva de la web.</span> <button type="button" style="margin-left:6px;padding:4px 10px;border:0;border-radius:6px;background:#fff;color:#0b3d6b;font:inherit;font-weight:600;cursor:pointer">Actualizar ahora</button>';
      bar.querySelector("button").onclick = function () { reload(true); };
      document.body.appendChild(bar);
    }
    bar.style.display = "block";
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
