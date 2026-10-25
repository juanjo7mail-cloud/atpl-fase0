/* Service worker: SIEMPRE intenta la red primero (así nadie ve versiones viejas); sin conexión usa lo último guardado.
   No toca peticiones a otros dominios (Supabase, etc.). */
const V = "f0-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(r, { cache: "no-cache" });
      if (res.status === 200) { try { const c = await caches.open(V); await c.put(r, res.clone()); } catch (_) {} }
      return res;
    } catch (err) {
      const m = await caches.match(r, { ignoreSearch: true });
      if (m) return m;
      if (r.mode === "navigate") { const i = (await caches.match("index.html")) || (await caches.match("./")); if (i) return i; }
      throw err;
    }
  })());
});
