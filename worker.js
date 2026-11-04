// Worker de ATPL Fase 0: sirve la web estática y, además, /api/wx (METAR y TAF reales para la pestaña OPS).
// Fuente: aviationweather.gov (NOAA, datos públicos). Prueba LECU, LEVS, LEGT y LEMD por ese orden y avisa de cuál ha usado.
// Caché de 2 minutos para que 100 alumnos no golpeen la fuente.
const STATIONS = ["LECU", "LEVS", "LEGT", "LEMD"];
const AW = "https://aviationweather.gov/api/data/";
async function up(kind, id) {
  try {
    const r = await fetch(AW + kind + "?ids=" + id + "&format=json" + (kind === "metar" ? "&hours=4" : ""), { headers: { "User-Agent": "atpl-fase0-ops/1.0" } });
    if (!r.ok) return null;
    const t = await r.text(); if (!t.trim()) return null;
    const j = JSON.parse(t);
    return Array.isArray(j) && j.length ? j : null;
  } catch (e) { return null; }
}
async function first(kind, key) {
  for (const id of STATIONS) {
    const arr = await up(kind, id);
    if (arr && arr[0] && arr[0][key]) {
      const o = { raw: String(arr[0][key]).trim(), station: id };
      if (kind === "metar") o.hist = arr.map(x => String(x[key] || "").trim()).filter(Boolean).slice(0, 5);   // más reciente primero
      return o;
    }
  }
  return null;
}
// Tráfico ADS-B en vivo (comunidad adsb.lol; si falla, airplanes.live). Radio 15 NM alrededor de Cuatro Vientos. Caché 8 s.
const TR = ["https://api.adsb.lol/v2/point/40.3706/-3.785/15", "https://api.airplanes.live/v2/point/40.3706/-3.785/15"];
async function traffic() {
  for (const url of TR) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "atpl-fase0-ops/1.0" } }); if (!r.ok) continue;
      const j = await r.json(); if (!Array.isArray(j.ac)) continue;
      return j.ac.filter(a => a.lat != null && a.lon != null).slice(0, 80).map(a => ({
        h: a.hex, f: (a.flight || "").trim(), r: a.r || "", t: a.t || "", lat: a.lat, lon: a.lon,
        gnd: a.alt_baro === "ground", alt: typeof a.alt_baro === "number" ? a.alt_baro : null, g: a.gs != null ? a.gs : null, tr: a.track != null ? a.track : (a.true_heading != null ? a.true_heading : null) }));
    } catch (e) { /* siguiente fuente */ }
  }
  return null;
}
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === "/api/traffic") {
      const ck2 = new Request(u.origin + "/api/traffic", { method: "GET" }), c2 = caches.default, h2 = await c2.match(ck2); if (h2) return h2;
      const ac = await traffic(), ok2 = !!ac;
      const r2 = new Response(JSON.stringify({ ok: ok2, ac: ac || [], at: Date.now() }), { status: ok2 ? 200 : 502, headers: { "content-type": "application/json; charset=utf-8", "cache-control": ok2 ? "public, max-age=8" : "no-store", "access-control-allow-origin": "*" } });
      if (ok2) ctx.waitUntil(c2.put(ck2, r2.clone()));
      return r2;
    }
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
