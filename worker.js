// Worker de ATPL Fase 0: sirve la web estática y, además, /api/wx (METAR y TAF reales para la pestaña OPS).
// Fuente: aviationweather.gov (NOAA, datos públicos). Prueba LECU, LEVS, LEGT y LEMD por ese orden y avisa de cuál ha usado.
// Caché de 2 minutos para que 100 alumnos no golpeen la fuente.
const STATIONS = ["LECU", "LEVS", "LEGT", "LEMD"];   // Cuatro Vientos (comportamiento original)
// Aeródromos del Reglamento de vuelos (coordenadas de OurAirports) y estaciones donde buscar un METAR si el aeródromo no tiene.
const AERO = {"LECU":[40.3707,-3.78514],"LEMT":[40.235,-4.02639],"LEOC":[39.9375,-3.50333],"LEVD":[41.7061,-4.85194],"LEBG":[42.3576,-3.62076],"LESA":[40.9521,-5.50199],"LEAB":[38.9485,-1.86352],"LEBA":[37.842,-4.84888],"LEBZ":[38.8913,-6.82133],"LETL":[40.41027,-1.21737],"LELN":[42.59071,-5.65341],"LELO":[42.46095,-2.32224],"LESO":[43.3565,-1.79061],"LEGR":[37.1887,-3.77736],"LEZL":[37.418,-5.89311],"LELC":[37.775,-0.81239],"LEPP":[42.77,-1.64633],"LEXJ":[43.4271,-3.82001],"LEAS":[43.5636,-6.03462],"LECH":[40.21389,0.07333],"LEAM":[36.8439,-2.3701],"LEJR":[36.7446,-6.06011],"LELL":[41.5209,2.10508]};
const CAND = {"LEMD":[40.4934,-3.5722],"LEGT":[40.2941,-3.7238],"LETO":[40.4879,-3.4568],"LEZG":[41.6662,-1.0415],"LEBL":[41.2971,2.0785],"LEVC":[39.4892,-0.481],"LEMG":[36.6782,-4.5002],"LEAL":[38.2822,-0.5582],"LEBB":[43.3011,-2.9106],"LEVX":[42.2318,-8.6268],"LEST":[42.8963,-8.4151],"LEVT":[42.8828,-2.7245],"LEMO":[37.1749,-5.6159],"LECO":[43.3021,-8.3773],"LEPA":[39.5517,2.7388],"LERS":[41.1475,1.1684],"LEGE":[41.9046,2.7618],"LEVS":[40.3707,-3.78514],"LEVD":[41.7061,-4.85194],"LEBG":[42.3576,-3.62076],"LESA":[40.9521,-5.50199],"LEBA":[37.842,-4.84888],"LEBZ":[38.8913,-6.82133],"LEAB":[38.9485,-1.86352],"LESO":[43.3565,-1.79061],"LELN":[42.59071,-5.65341],"LELO":[42.46095,-2.32224],"LEZL":[37.418,-5.89311],"LELC":[37.775,-0.81239],"LEGR":[37.1887,-3.77736],"LEPP":[42.77,-1.64633],"LEXJ":[43.4271,-3.82001],"LEAS":[43.5636,-6.03462],"LECH":[40.21389,0.07333],"LEAM":[36.8439,-2.3701],"LEJR":[36.7446,-6.06011]};
const km = (a, b) => { const R = Math.PI / 180, dl = (b[0] - a[0]) * R, dn = (b[1] - a[1]) * R, x = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dn / 2) ** 2; return Math.round(12742 * Math.asin(Math.sqrt(x))); };
function stationsFor(icao) {   // el propio aeródromo y, si no emite, las 3 estaciones conocidas más cercanas
  if (!icao || icao === "LECU") return STATIONS.map(s => [s, null]);
  const here = AERO[icao];
  return [[icao, 0]].concat(Object.keys(CAND).filter(k => k !== icao).map(k => [k, km(here, CAND[k])]).sort((p, q) => p[1] - q[1]).slice(0, 3));
}
const AW = "https://aviationweather.gov/api/data/";
async function up(kind, id) {
  try {
    const r = await fetch(AW + kind + "?ids=" + id + "&format=json" + (kind === "metar" ? "&hours=4" : ""), { headers: { "User-Agent": "atpl-fase0-ops/1.0" }, cf: { cacheTtl: 90, cacheEverything: true } });
    if (!r.ok) return null;
    const t = await r.text(); if (!t.trim()) return null;
    const j = JSON.parse(t);
    return Array.isArray(j) && j.length ? j : null;
  } catch (e) { return null; }
}
async function first(kind, key, list) {
  for (const [id, d] of list) {
    const arr = await up(kind, id);
    if (arr && arr[0] && arr[0][key]) {
      const o = { raw: String(arr[0][key]).trim(), station: id };
      if (d) o.km = d;
      if (kind === "metar") o.hist = arr.map(x => String(x[key] || "").trim()).filter(Boolean).slice(0, 5);   // más reciente primero
      return o;
    }
  }
  return null;
}
// Tráfico ADS-B en vivo (comunidad adsb.lol; si falla, airplanes.live). Radio 15 NM alrededor de Cuatro Vientos. Caché 8 s.
const trUrls = icao => { const p = AERO[icao] || AERO.LECU; return ["https://api.adsb.lol/v2/point/" + p[0] + "/" + p[1] + "/15", "https://api.airplanes.live/v2/point/" + p[0] + "/" + p[1] + "/15"]; };
async function traffic(icao) {
  for (const url of trUrls(icao)) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "atpl-fase0-ops/1.0" }, cf: { cacheTtl: 10, cacheEverything: true } }); if (!r.ok) continue;
      const j = await r.json(); if (!Array.isArray(j.ac)) continue;
      return j.ac.filter(a => a.lat != null && a.lon != null).slice(0, 80).map(a => ({
        h: a.hex, f: (a.flight || "").trim(), r: a.r || "", t: a.t || "", lat: a.lat, lon: a.lon,
        gnd: a.alt_baro === "ground", alt: typeof a.alt_baro === "number" ? a.alt_baro : null, g: a.gs != null ? a.gs : null, tr: a.track != null ? a.track : (a.true_heading != null ? a.true_heading : null) }));
    } catch (e) { /* siguiente fuente */ }
  }
  return null;
}
// Memoria en el propio isolate: la Cache API no funciona en *.workers.dev, así que agrupamos las peticiones aquí.
const MEMO = new Map();
async function memo(key, ttl, fn) {
  const h = MEMO.get(key), now = Date.now();
  if (h && now - h.t < (h.ok ? ttl : 8000)) return h.p;
  const p = fn(); const e = { t: now, ok: true, p }; MEMO.set(key, e);
  p.then(v => { e.ok = !!v.ok; }, () => { MEMO.delete(key); });
  if (MEMO.size > 200) for (const k of MEMO.keys()) { MEMO.delete(k); if (MEMO.size < 100) break; }
  return p;
}
// NOTAM reales por aeródromo: réplica pública de los NOTAM de ENAIRE en FAA NOTAM Search (sin clave). Orientativo; la fuente oficial es ENAIRE Insignia.
const NT_CODES = { LELO: ["LERJ", "LELO"] };   // Logroño: en NOTAM figura como LERJ (LELO tiene alguno antiguo)
const FAA = "https://notams.aim.faa.gov/notamSearch/search";
const iso = s => s && /^\d{10}$/.test(s) ? "20" + s.slice(0, 2) + "-" + s.slice(2, 4) + "-" + s.slice(4, 6) + "T" + s.slice(6, 8) + ":" + s.slice(8, 10) + ":00Z" : null;
function parseNotam(n) {
  const m = String(n.icaoMessage || ""), blk = (re) => { const x = re.exec(m); return x ? x[1].replace(/\r/g, "").trim() : ""; };
  const q = /Q\)\s*([A-Z]{4})\/(Q[A-Z]{4})\/([A-Z ]*)\/([A-Z ]*)\/([A-Z ]*)\/(\d{3})\/(\d{3})\//.exec(m);
  const c = /C\)\s*(PERM|\d{10})\s*(EST)?/.exec(m), b = /B\)\s*(\d{10})/.exec(m), t = /NOTAM([NRC])/.exec(m);
  return {
    id: n.notamNumber, t: t ? t[1] : "N", q: q ? q[2] : "", fir: q ? q[1] : "", tr: q ? q[3].trim() : "", lo: q ? +q[6] : null, hi: q ? +q[7] : null,
    from: b ? iso(b[1]) : null, to: c && c[1] !== "PERM" ? iso(c[1]) : null, perm: !!(c && c[1] === "PERM"), est: !!(c && c[2]),
    d: blk(/\n\s*D\)([\s\S]*?)(?=\n\s*E\)|$)/), e: blk(/\n\s*E\)([\s\S]*?)(?=\n\s*[FG]\)|$)/), f: blk(/\n\s*F\)\s*(.*?)(?=\s+G\)|\n|$)/), g: blk(/(?:\n|\s)G\)\s*([^\n]*)/)
  };
}
let NT_WHY = "";
async function notams(icao) {
  const seen = new Map(); NT_WHY = "";
  for (const code of NT_CODES[icao] || [icao]) {
    for (let off = 0; off < 90; off += 30) {
      const body = new URLSearchParams({ searchType: "0", designatorsForLocation: code, formatType: "ICAO", radius: "10", sortColumns: "5 false", sortDirection: "true", radiusSearchOnDesignator: "false", latitudeDirection: "N", longitudeDirection: "W", flightPathBuffer: "4", flightPathIncludeNavaids: "true", flightPathIncludeArtcc: "false", flightPathIncludeTfr: "true", flightPathIncludeRegulatory: "false", flightPathResultsType: "All NOTAMs", offset: String(off), notamsOnly: "false" });
      let j;
      try {
        const r = await fetch(FAA, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0 (compatible; atpl-fase0-ops/1.0)", "origin": "https://notams.aim.faa.gov", "referer": "https://notams.aim.faa.gov/notamSearch/", "accept": "application/json" } });
        if (!r.ok) { NT_WHY = "http " + r.status + " " + (await r.text().catch(() => "")).slice(0, 160).replace(/\s+/g, " "); if (off === 0 && !seen.size) return null; break; }
        j = await r.json();
      } catch (e) { NT_WHY = "exc " + String(e).slice(0, 160); if (off === 0 && !seen.size) return null; break; }
      const l = Array.isArray(j.notamList) ? j.notamList : [];
      for (const n of l) if (n.status !== "Cancelled" && !n.cancelledOrExpired && n.icaoMessage && !seen.has(n.notamNumber)) seen.set(n.notamNumber, parseNotam(n));
      if (!l.length || (j.endRecordCount || 0) >= (j.totalNotamCount || 0)) break;
    }
  }
  return [...seen.values()];
}
const J = (o, ok, age) => new Response(JSON.stringify(o), { status: ok ? 200 : 502, headers: { "content-type": "application/json; charset=utf-8", "cache-control": ok ? "public, max-age=" + age : "no-store", "access-control-allow-origin": "*" } });
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const q = (u.searchParams.get("icao") || "").toUpperCase(), icao = AERO[q] ? q : "LECU";   // solo aeródromos de la lista
    if (u.pathname === "/api/traffic") {
      const o = await memo("tr:" + icao, 15000, async () => { const ac = await traffic(icao); return { ok: !!ac, ac: ac || [], at: Date.now() }; });
      return J(o, o.ok, 15);
    }
    if (u.pathname === "/api/notam") {
      const o = await memo("nt:" + icao, 600000, async () => { const l = await notams(icao); return { ok: !!l, n: l || [], at: Date.now(), src: "FAA NOTAM Search", why: l ? undefined : NT_WHY }; });
      return J(o, o.ok, 300);
    }
    if (u.pathname !== "/api/wx") return env.ASSETS.fetch(req);
    const o = await memo("wx:" + icao, 120000, async () => {
      const list = stationsFor(icao), [metar, taf] = await Promise.all([first("metar", "rawOb", list), first("taf", "rawTAF", list)]);
      return { ok: !!(metar || taf), metar, taf, at: Date.now() };
    });
    return J(o, o.ok, 120);
  }
};
