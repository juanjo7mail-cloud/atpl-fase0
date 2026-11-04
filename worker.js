// Worker de ATPL Fase 0: sirve la web estática y, además, /api/wx (METAR y TAF reales para la pestaña OPS).
// Fuente: aviationweather.gov (NOAA, datos públicos). Prueba LECU, LEVS, LEGT y LEMD por ese orden y avisa de cuál ha usado.
// Caché de 2 minutos para que 100 alumnos no golpeen la fuente.
const STATIONS = ["LECU", "LEVS", "LEGT", "LEMD"];
const AW = "https://aviationweather.gov/api/data/";
async function up(kind, id) {
  try {
    const r = await fetch(AW + kind + "?ids=" + id + "&format=json" + (kind === "metar" ? "&hours=3" : ""), { headers: { "User-Agent": "atpl-fase0-ops/1.0" } });
    if (!r.ok) return null;
    const t = await r.text(); if (!t.trim()) return null;
    const j = JSON.parse(t);
    return Array.isArray(j) && j.length ? j[0] : null;
  } catch (e) { return null; }
}
async function first(kind, key) {
  for (const id of STATIONS) { const x = await up(kind, id); if (x && x[key]) return { raw: String(x[key]).trim(), station: id }; }
  return null;
}
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname !== "/api/wx") return env.ASSETS.fetch(req);
    const ck = new Request(u.origin + "/api/wx", { method: "GET" }), cache = caches.default;
    const hit = await cache.match(ck); if (hit) return hit;
    const [metar, taf] = await Promise.all([first("metar", "rawOb"), first("taf", "rawTAF")]);
    const ok = !!(metar || taf);
    const res = new Response(JSON.stringify({ ok, metar, taf, at: Date.now() }), { status: ok ? 200 : 502, headers: { "content-type": "application/json; charset=utf-8", "cache-control": ok ? "public, max-age=120" : "no-store", "access-control-allow-origin": "*" } });
    if (ok) ctx.waitUntil(cache.put(ck, res.clone()));
    return res;
  }
};
