/* Actualización automática: si hay una versión nueva de la web, se recarga sola
   cuando no estás haciendo un test y llevas 1 minuto sin tocar nada.
   Si estás en mitad de un test, solo avisa y espera a que lo termines. */
(function () {
  var B = window.F0_BUILD;
  if (!B || location.protocol === "file:") return;
  var IDLE = 60 * 1000, EVERY = 5 * 60 * 1000;
  var last = Date.now(), pending = false, bar = null;
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
  function reload() {
    try {
      var t = +sessionStorage.getItem("f0:autoreload") || 0;
      if (Date.now() - t < EVERY) return;           // evita bucles
      sessionStorage.setItem("f0:autoreload", String(Date.now()));
    } catch (_) {}
    location.reload();
  }
  function banner(show) {
    if (!show) { if (bar) bar.style.display = "none"; return; }
    if (!bar) {
      bar = document.createElement("div");
      bar.setAttribute("role", "status");
      bar.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:99999;max-width:min(92vw,360px);padding:10px 12px;border-radius:10px;background:#0b3d6b;color:#fff;font:14px/1.35 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35)";
      bar.innerHTML = '<span>Hay una versión nueva de la web. Se actualizará sola al terminar el test.</span> <button type="button" style="margin-left:6px;padding:4px 10px;border:0;border-radius:6px;background:#fff;color:#0b3d6b;font:inherit;font-weight:600;cursor:pointer">Actualizar ahora</button>';
      bar.querySelector("button").onclick = function () { try { sessionStorage.removeItem("f0:autoreload"); } catch (_) {} location.reload(); };
      document.body.appendChild(bar);
    }
    bar.style.display = "block";
  }
  function decide() {
    if (!pending) return;
    watchFrames();
    if (testRunning()) { banner(true); return; }
    if (Date.now() - last >= IDLE || document.hidden) { reload(); return; }
    banner(true);
  }
  function check() {
    if (!navigator.onLine) return;
    fetch("version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.v && j.v !== B) { pending = true; decide(); } })
      .catch(function () {});
  }
  setInterval(watchFrames, 15000);
  setInterval(check, EVERY);
  setInterval(decide, 20000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { last = Date.now() - IDLE; check(); decide(); } });
  addEventListener("online", check);
  setTimeout(check, 4000);
})();
