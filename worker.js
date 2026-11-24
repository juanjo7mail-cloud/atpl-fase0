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
// Tráfico ADS-B en vivo. Radio 15 NM alrededor del aeródromo. Pregunta a cuatro redes comunitarias a la vez y se queda con la primera que contesta bien;
// si todas fallan, devuelve el motivo de cada una (campo why) para poder diagnosticarlo.
const trSrc = icao => { const p = AERO[icao] || AERO.LECU, a = p[0], o = p[1];
  return [["adsb.lol", "https://api.adsb.lol/v2/point/" + a + "/" + o + "/15"], ["airplanes.live", "https://api.airplanes.live/v2/point/" + a + "/" + o + "/15"],
    ["adsb.fi", "https://opendata.adsb.fi/api/v2/lat/" + a + "/lon/" + o + "/dist/15"], ["adsb.one", "https://api.adsb.one/v2/point/" + a + "/" + o + "/15"],
    ["OpenSky", "https://opensky-network.org/api/states/all?lamin=" + (a - .25) + "&lomin=" + (o - .33) + "&lamax=" + (a + .25) + "&lomax=" + (o + .33)]]; };
async function traffic(icao) {
  const why = [];
  const one = async ([name, url]) => {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; atpl-fase0-ops/1.1)", "Accept": "application/json" }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) { why.push(name + ": HTTP " + r.status); throw 0; }
      const j = await r.json();
      if (j && "states" in j) return { src: name, ac: (j.states || []).filter(s => s[5] != null && s[6] != null).slice(0, 120).map(s => ({ h: s[0], f: (s[1] || "").trim(), r: "", t: "", lat: s[6], lon: s[5], gnd: !!s[8], alt: s[8] ? null : (s[7] != null ? Math.round(s[7] * 3.28084) : null), g: s[9] != null ? s[9] * 1.94384 : null, tr: s[10] })) };
      const arr = j.ac || j.aircraft;
      if (!Array.isArray(arr)) { why.push(name + ": respuesta sin lista"); throw 0; }
      return { src: name, ac: arr.filter(a => a.lat != null && a.lon != null).slice(0, 120).map(a => ({
        h: a.hex, f: (a.flight || "").trim(), r: a.r || "", t: a.t || "", lat: a.lat, lon: a.lon,
        gnd: a.alt_baro === "ground", alt: typeof a.alt_baro === "number" ? a.alt_baro : null, g: a.gs != null ? a.gs : null, tr: a.track != null ? a.track : (a.true_heading != null ? a.true_heading : null) })) };
    } catch (e) { if (e) why.push(name + ": " + (e.name || "error")); throw 0; }
  };
  try { const r = await Promise.any(trSrc(icao).map(one)); return { ac: r.ac, src: r.src }; } catch (e) { return { ac: null, why }; }
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
        const r = await fetch(FAA, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "atpl-fase0-ops/1.0", "accept": "application/json" } });
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

// ---- /api/news: titulares RSS públicos (EASA, AESA, Aviation Herald). Sin IA, sin claves. Caché 6 h; últimos 50 sin duplicar URL.
const GN = (q, es) => "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + (es ? "&hl=es&gl=ES&ceid=ES:es" : "&hl=en-GB&gl=GB&ceid=GB:en");   // Google News RSS (búsqueda abierta). Los títulos acaban en « - Medio»: se separa en readFeed
const FEEDS = [   // Solo fuentes abiertas. ✓ = verificada con datos; ? = sin verificar (si devuelve 0 se omite sola; /api/news?debug=1 muestra el recuento por feed). r = ES España · EU Europa · INT mundo
  { src: "EASA", cat: "Regulación", url: "https://www.easa.europa.eu/en/newsroom-and-events/news/rss.xml" },                   // ? regulación (se mantiene)
  { src: "Simple Flying", cat: "Industria", url: "https://simpleflying.com/feed/" },                                              // ✓ flota, compras, curiosidades
  { src: "AeroTime", cat: "Industria", url: "https://www.aerotime.aero/rss" },                                                    // ✓ actualidad e industria
  { src: "Aviation24.be", cat: "Industria", url: "https://www.aviation24.be/feed/" },                                             // ? actualidad aérea
  { src: "Airliner Watch", cat: "Flota", url: "https://airlinerwatch.com/feed/" },                                                // ? flotas y pedidos
  { src: "Airline Weekly", cat: "Industria", url: "https://airlineweekly.skift.com/feed/" },                                      // ✓
  { src: "Flightradar24", cat: "Seguridad", url: "https://www.flightradar24.com/blog/category/aviation-safety/feed/" },          // ✓ accidentes
  { src: "The Aviationist", cat: "Seguridad", url: "https://theaviationist.com/category/aviation-safety/feed/" },                // ✓ accidentes
  { src: "Google News · Flota", cat: "Flota", url: GN("aerolínea pedido aviones flota", true), gn: 1 },                           // ? búsqueda abierta, respaldo de flota
  // ---------- EMPLEO (foco): portales especializados ----------
  { src: "Pilot Career News", cat: "Empleo", r: "INT", url: "https://pilotcareernews.com/feed/" },                                // ? empleo de pilotos
  { src: "Latest Pilot Jobs", cat: "Empleo", r: "INT", url: "https://www.latestpilotjobs.com/feed/" },                            // ? ofertas de piloto
  { src: "AviationJobSearch", cat: "Empleo", r: "INT", url: "https://www.aviationjobsearch.com/blog/feed" },                     // ? blog/ofertas
  { src: "Pilot Job Board", cat: "Empleo", r: "INT", url: "https://www.pilotjobsboard.com/feed/" },                              // ? ofertas
  { src: "Aviacionline", cat: "Empleo", r: "ES", url: "https://www.aviacionline.com/feed/", kwOnly: 1 },                         // ? prensa en español; solo entran los titulares de empleo
  { src: "Preferente", cat: "Empleo", r: "ES", url: "https://www.preferente.com/feed", kwOnly: 1 },                              // ? prensa aérea española; solo empleo
  { src: "Aviación Digital", cat: "Empleo", r: "ES", url: "https://www.aviaciondigital.com/feed/", kwOnly: 1 },                  // ? idem
  // ---------- EMPLEO: búsquedas abiertas en Google News (últimos 30 días) ----------
  { src: "Google News · Empleo ES", cat: "Empleo", r: "ES", gn: 1, url: GN("pilotos aerolínea contratación OR convocatoria OR oferta when:30d", true) },
  { src: "Google News · Iberia/Air Europa", cat: "Empleo", r: "ES", gn: 1, url: GN("(Iberia OR \"Air Europa\" OR Vueling OR Binter OR Volotea OR \"Iberia Express\" OR Ryanair OR Level) pilotos contratación OR cadetes OR selección when:60d", true) },
  { src: "Google News · Cadetes ES", cat: "Empleo", r: "ES", gn: 1, url: GN("convocatoria cadetes pilotos OR \"programa cadete\" OR \"escuela de vuelo\" OR \"piloto cadete\" when:60d", true) },
  { src: "Google News · Instructores", cat: "Empleo", r: "ES", gn: 1, url: GN("\"instructor de vuelo\" OR \"instructores de vuelo\" oferta OR busca OR contrata when:90d", true) },
  { src: "Google News · Pilot jobs EU", cat: "Empleo", r: "EU", gn: 1, url: GN("airline pilot recruitment Europe OR \"cadet programme\" OR \"first officer\" hiring when:30d", false) },
  { src: "Google News · Cadet schemes", cat: "Empleo", r: "EU", gn: 1, url: GN("\"cadet pilot\" OR \"pilot academy\" OR \"pilot training scheme\" airline Europe when:60d", false) },
  { src: "Google News · Cargo pilots", cat: "Empleo", r: "EU", gn: 1, url: GN("cargo airline pilot hiring OR recruitment OR \"first officer\" (DHL OR Cargolux OR \"Air Atlanta\" OR \"ASL Airlines\" OR \"Swiftair\" OR \"Air Hamburg\" OR \"Atlas Air\" OR FedEx OR UPS OR Challenge OR \"Tarom\" OR \"Qatar Cargo\") when:60d", false) },
  { src: "Google News · Business aviation", cat: "Empleo", r: "EU", gn: 1, url: GN("business aviation pilot jobs OR hiring OR \"bizjet\" captain OR \"first officer\" (NetJets OR Flexjet OR VistaJet OR \"Luxaviation\" OR \"Jetfly\" OR \"Air Hamburg\" OR \"Eastern Airways\") when:60d", false) },
  { src: "Google News · FI / flight schools", cat: "Empleo", r: "EU", gn: 1, url: GN("\"flight instructor\" OR \"FI\" OR \"CRI\" vacancy OR hiring OR recruiting \"flight school\" OR \"ATO\" Europe when:60d", false) },
  { src: "Google News · Aerotime careers", cat: "Empleo", r: "EU", gn: 1, url: GN("site:aerotime.aero (pilots OR hiring OR recruitment OR cadet OR careers) when:60d", false) },
  { src: "Google News · FlightGlobal jobs", cat: "Empleo", r: "INT", gn: 1, url: GN("site:flightglobal.com pilots (recruitment OR hiring OR shortage OR cadets) when:60d", false) },
  { src: "Google News · AviationJobSearch", cat: "Empleo", r: "INT", gn: 1, url: GN("aviationjobsearch OR \"aviation job search\" pilot jobs when:60d", false) },
  { src: "Google News · Wizz/Ryanair/easyJet", cat: "Empleo", r: "EU", gn: 1, url: GN("(Ryanair OR easyJet OR \"Wizz Air\" OR Transavia OR Lufthansa OR KLM OR \"Air France\" OR TAP OR ITA OR SAS OR Norwegian OR Jet2 OR TUI OR Condor OR Eurowings) pilot recruitment OR \"cadet\" OR \"direct entry\" OR hiring when:45d", false) },
  // ---------- FUENTES VIGILADAS (v:1 → ★ en el Radar; wl:1 → los titulares de oferta entran siempre en Empleo; keep:1 → la fuente se muestra con su nombre) ----------
  { src: "Aviation Insider", cat: "Empleo", r: "EU", v: 1, wl: 1, url: "https://aviationinsider.com/category/pilot-recruitment/feed/" },   // ? WordPress: categoría de reclutamiento
  { src: "Aviation Insider", cat: "Industria", r: "EU", v: 1, wl: 1, url: "https://aviationinsider.com/feed/" },
  { src: "Aviation Insider", cat: "Empleo", r: "EU", v: 1, wl: 1, url: "https://www.aviationinsider.com/category/pilot-recruitment/feed/" },   // ? candidata
  { src: "Aviation Insider", cat: "Industria", r: "EU", v: 1, wl: 1, url: "https://www.aviationinsider.com/feed/" },   // ? candidata
  { src: "Aviation Insider", cat: "Industria", r: "EU", v: 1, wl: 1, url: "https://aviationinsider.com/feed" },   // ? candidata
  { src: "Aviation Insider", cat: "Industria", r: "EU", v: 1, wl: 1, url: "https://aviationinsider.com/rss.xml" },   // ? candidata
  { src: "Aviation Insider", cat: "Industria", r: "EU", v: 1, wl: 1, url: "https://aviationinsider.com/blog-feed.xml" },   // ? candidata
  { src: "FCi Aviation", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://fci.aero/feed/" },   // ? candidata
  { src: "FCi Aviation", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://fci.aero/?feed=job_feed" },   // ? candidata
  { src: "FCi Aviation", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://fci.aero/jobs/feed/" },   // ? candidata
  { src: "FCi Aviation", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://careers.fci.aero/rss" },   // ? candidata
  { src: "Aviatory", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://aviatory.app/feed" },   // ? candidata
  { src: "Aviatory", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://aviatory.app/rss.xml" },   // ? candidata
  { src: "Aviatory", cat: "Empleo", r: "INT", v: 1, wl: 1, url: "https://aviatory.app/blog/rss.xml" },   // ? candidata                              // ? WordPress: feed general (solo entra lo que habla de empleo)
  { src: "Aviation Insider", cat: "Empleo", r: "EU", v: 1, wl: 1, keep: 1, gn: 1, url: GN("site:aviationinsider.com (pilot OR recruitment OR \"first officer\" OR cadet OR hiring) when:120d", false) },
  { src: "Brookfield Aviation", cat: "Industria", r: "INT", v: 1, wl: 1, url: "https://www.brookfieldav.com/blog-feed.xml" },                   // ? Wix: resúmenes mensuales «Aviation Jobs Worldwide»
  { src: "Brookfield Aviation", cat: "Empleo", r: "INT", v: 1, wl: 1, keep: 1, gn: 1, url: GN("site:brookfieldav.com (pilot OR jobs OR \"first officer\" OR captain) when:120d", false) },
  { src: "FCi Aviation", cat: "Empleo", r: "INT", v: 1, wl: 1, keep: 1, gn: 1, url: GN("site:fci.aero (pilot OR captain OR \"first officer\" OR jobs) when:120d", false) },   // sin RSS público: respaldo por búsqueda
  { src: "Aviatory", cat: "Empleo", r: "INT", v: 1, wl: 1, keep: 1, gn: 1, url: GN("site:aviatory.app (pilot OR \"first officer\" OR hiring OR jobs) when:120d", false) }              // sin RSS público: respaldo por búsqueda
];
// Fuentes vigiladas: enlace directo a su zona de ofertas. Se sirven al Radar (panel «Fuentes vigiladas»).
const WATCH = [
  { n: "Aviation Insider", u: "https://aviationinsider.com/category/pilot-recruitment/", d: "Convocatorias europeas y procesos low-hour, con guías de entrevista y simulador.", ig: "aviation.insider" },
  { n: "FCi Aviation", u: "https://fci.aero/job-category/captains-and-first-officers/", d: "Reclutamiento internacional y contratos commuting (E190, A320, B737…).", ig: "fci_crews" },
  { n: "Brookfield Aviation", u: "https://www.brookfieldav.com/airline-pilot-jobs", d: "Contratos de Primer Oficial y Comandante (E190/E195, A320…). El detalle de cada oferta pide registro.", ig: "brookfieldaviation" },
  { n: "Aviatory", u: "https://aviatory.app", d: "Resúmenes semanales de aerolíneas que buscan Primer Oficial.", ig: "aviatoryapp" }
];
// Convocatorias verificadas a mano el 24/11/26 contra la página original. «ver» = fecha de comprobación; si cambia o cierra, se retira aquí.
const JOBS = [
  { u: "https://www.flightdeckfriend.com/job/brussels-airlines-non-rated-first-officers-5/", src: "Brussels Airlines (vía FlightDeckFriend)", t: "Brussels Airlines · Primer Oficial A320neo sin habilitación", pos: "Primer Oficial", ac: "A320neo (flota Airbus)", base: "Bruselas (Bélgica)", hrs: "Sin mínimo: admiten low-hour", tr: "No la exige (acepta con y sin TR)", req: "ATPL(A) o CPL(A)/IR con ATPL teórico, ME/IR, MCC, UPRT avanzado, inglés ICAO 4, holandés o francés (B2), CMA1, certificado de buena conducta", r: "EU", lh: 1, open: 0, ver: "24/11/26", note: "Proceso cerrado hoy; se repite en oleadas." },
  { u: "https://fci.aero/jobs/royal-air-maroc-e190-captains-first-officers-436692/", src: "FCi Aviation", t: "Royal Air Maroc · Comandantes y Primeros Oficiales E190", pos: "Comandante y Primer Oficial", ac: "E190", base: "Marruecos (contrato commuting)", hrs: "PO: 300 h en E190/170 · Cte: 1.000 h PIC en E190/170", tr: "Sí, TR vigente", req: "CMA1; contrato de 5 años renovable, 7 días libres al mes y 24 de vacaciones; incorporaciones mensuales", r: "INT", lh: 0, open: 1, ver: "24/11/26", note: "Cerca de España, pero pide TR y horas en el tipo." },
  { u: "https://fci.aero/jobs/a320-tr-ntr-captain-opportunities-with-european-carrier-i-non-eu-pilots-438517/", src: "FCi Aviation", t: "Wizz Air · Comandantes A320 con y sin habilitación", pos: "Comandante", ac: "A320", base: "Malta (pilotos no UE: Tirana, Iași, Chișinău)", hrs: "3.500 h factorizadas; 1.000 h PIC en jet multipiloto >50 t (sin TR)", tr: "Acepta con y sin TR", req: "ATPL EASA con IR, CMA1, inglés ICAO 4; permanente, completo o parcial, con rotación commuting", r: "EU", lh: 0, open: 1, ver: "24/11/26", note: "Referencia de mercado: aún no es para ti (comandante)." },
  { u: "https://pilotsdb.brookfieldav.com/showjob/01292/E190-195-First-Officers---Air-Peace", src: "Brookfield Aviation", t: "Air Peace · Primeros Oficiales E190/E195", pos: "Primer Oficial", ac: "E190/E195", base: "Lagos (Nigeria)", hrs: "3.000 h totales, 500 h como SIC en E175/195", tr: "Sí, habilitación E175/195", req: "ATP con la habilitación, CMA1, inglés ICAO 4; 1 año renovable, 8 semanas dentro y 3 fuera, 7.000 USD al mes", r: "INT", lh: 0, open: 1, ver: "24/11/26", note: "Referencia: pide experiencia en el tipo." }
];
// Si el titular lo dice, manda el tema del titular sobre el del feed (orden = prioridad)
const KW = [
  ["Seguridad", /\b(crash(es|ed)?|accident|incident|emergency|runway excursion|collision|mayday|evacuat\w*|engine failure|investigation|fatal|diverts?|diverted)\b|accidente|incidente|emergencia/i],
  ["Empleo", /\b(hiring|recruit\w*|cadets?|pilot (shortage|training|jobs?|pay|salar\w*|academy|scheme|programme|program)|first officers?|vacanc\w*|careers?|apprentice\w*|job openings?|direct entry|type rating|flight instructors?|pilot positions?|now hiring|open(s|ing)? applications?)\b|contrataci[oó]n|contrata(n|rá)?\b|ofertas? de (empleo|trabajo)|busca[n]? pilotos|piloto[s]? cadete|cadetes|convocatoria|instructor(es)? de vuelo|selecci[oó]n de pilotos|bolsa de (empleo|trabajo)|se buscan/i],
  ["Flota", /\b(orders?|delivers|deliver(y|ies)|fleet|leases?|buys|acquires|a3[1-5]\d|a220|737|787|777|e2|atr|retire[sd]?)\b|pedido|flota|entrega de|adquiere|compra de/i],
  ["Regulación", /\b(EASA|AESA|FAA|ICAO|regulation|rules?|directive|airworthiness|licen[cs]e|AD|normativa)\b/i],
  ["Curiosidades", /\b(longest|shortest|record|world'?s (first|largest|smallest|longest|busiest)|why|how (do|does|did|is|are)|facts?|history|unusual|strange|rare|secret|myths?|explained|vintage|retro)\b|curiosidad\w*|por qu[eé]|historia de|r[eé]cord/i]
];
// región de una oferta/convocatoria: ES (España), EU (Europa) o INT (resto). Manda el texto; si no dice nada, la del feed.
const REG_ES = /\b(iberia|air europa|vueling|binter|volotea|iberia express|air nostrum|swiftair|aesa|espa[nñ]a|espa[nñ]ol\w*|madrid|barcelona|canarias|baleares|sevilla|valencia|m[aá]laga|enaire|saerco|aena)\b/i;
const REG_EU = /\b(europe\w*|eu|easa|uk|u\.k\.|britain|ireland|ryanair|easyjet|wizz|lufthansa|klm|air france|tap|ita airways|sas|norwegian|jet2|tui|condor|eurowings|transavia|luxembourg|cargolux|german\w*|france|french|italy|italian|netherlands|dutch|poland|polish|portugal|portuguese|sweden|swedish|norway|finland|greece|hungary|romania|czech|swiss|switzerland|austria|belgium|denmark|dublin|london|paris|frankfurt|amsterdam)\b/i;
// Empleo = SOLO puestos de vuelo (comandante, primer/segundo oficial, instructor, cadetes). Excluye oficina, tierra y técnicos.
const EMP_IN_I = /\b(captains?|commanders?|first officers?|second officers?|co-?pilots?|flight instructors?|cadets?(hip)?|cadete\w*|comandantes?|capit[aá]n(es)?|primer(es)? oficial(es)?|segundo(s)? oficial(es)?|copiloto\w*|instructor(es)? de vuelo|(pilot|piloto)s? (wanted|needed|vacanc\w*|positions?|jobs?|hiring|recruit\w*|programme|program|scheme|academy|openings?|ofertas?|convocatoria|selecci[oó]n)|(hiring|recruiting|recruitment|vacancy|vacancies|se buscan|busca[n]?|contrata[n]?|oferta de empleo|convocatoria)[^.]{0,40}\b(pilots?|pilotos?)|(pilots?|pilotos?)[^.]{0,40}\b(hiring|recruit\w*|vacanc\w*|contrataci[oó]n|convocatoria))\b/i;
const EMP_IN_C = /\b(FO|F\/O|SO|FI|TRI|SFI|CRI|IRI|SEP|ATPL|CPL)\b/;   // siglas: solo en mayúsculas
const EMP_OUT_I = /\b(project managers?|engineers?|engineering|mechanics?|technicians?|cabin crew|flight attendants?|dispatch\w*|ground|marketing|sales|interns?|internship|ingenier\w*|mec[aá]nic\w*|t[eé]cnic\w*|tripulante\w*|TCP|auxiliar(es)? de vuelo|azafat\w*|handling|ventas|pr[aá]cticas|manager|analyst|accountant|recruiter|coordinator|administrat\w*)\b/i;
const EMP_OUT_C = /\b(IT|HR)\b/;
const isFlightJob = t => { if (EMP_OUT_C.test(t)) return false; const cad = /cadet|cadete/i.test(t); let o = t.match(EMP_OUT_I); if (o && !(cad && /^interns?|internship|pr[aá]cticas$/i.test(o[0]))) return false; return EMP_IN_I.test(t) || (EMP_IN_C.test(t) && /\b(pilots?|pilotos?|instructor|officer|captain|cadet|jobs?|hiring|recruit\w*|vacanc\w*)\b/i.test(t)); };
const JOBW = /\b(first officers?|captains?|cadets?|jobs?|hiring|recruit\w*|vacanc\w*|type rating|low[- ]?hours?|openings?)\b/i;   // sin «pilot»/«career» sueltos: colarían artículos generales
const LH_I = /\b(low[- ]?hours?|no type rating|without (a )?type rating|non[- ]?type[- ]?rated|non[- ]?rated|ab[- ]?initio|zero[- ]?hours?|frozen ATPL|junior first officers?|new(ly)? (qualified|licen[cs]ed)|sin habilitaci[oó]n|sin type rating|sin experiencia)\b/i;
const LH_C = /\b(NTR|MPL)\b/;   // siglas: solo en mayúsculas
const CAD = /\bcadets?\b|cadete\w*/i;
const regionOf = (t, s, fr) => REG_ES.test(t) ? "ES" : REG_EU.test(t + " " + s) ? "EU" : (fr || "INT");
const txt = (x, t) => { const m = x.match(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">", "i")); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim() : ""; };
async function readFeed(f) {
  try {
    const r = await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; atpl-rss/1.1)" }, cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!r.ok) return [];
    const x = await r.text(), out = [];
    for (const m of x.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
      const b = m[0], title = txt(b, "title"); let link = txt(b, "link");
      if (!link) { const h = b.match(/<link[^>]*href="([^"]+)"/i); link = h ? h[1] : ""; }
      const d = Date.parse(txt(b, "pubDate") || txt(b, "updated") || txt(b, "published") || txt(b, "dc:date"));
      if (title && /^https?:\/\//.test(link)) {
        let t = title, s = f.src;
        if (f.gn) { const g = t.match(/^(.*\S)\s+-\s+([^-]{2,60})$/); if (g) { t = g[1]; if (!f.keep) s = g[2].trim(); } }   // Google News: «Titular - Medio» → el medio pasa a ser la fuente
        let c = f.cat, hit = false; for (const [k, re] of KW) if (re.test(t)) { c = k; hit = k === "Empleo"; break; }
        const jobish = f.wl && JOBW.test(t) && !EMP_OUT_I.test(t) && !EMP_OUT_C.test(t);   // fuentes vigiladas: cualquier titular de oferta/convocatoria de vuelo
        if (jobish) { c = "Empleo"; hit = true; }
        if (c === "Empleo" && !jobish && !isFlightJob(t)) continue;   // Empleo: solo tripulación de vuelo
        if (f.kwOnly && !hit) continue;   // prensa general: solo entra lo que habla de empleo
        out.push({ t: t.slice(0, 220), u: link, s, c, d: isNaN(d) ? 0 : d, ...(f.v ? { v: 1 } : {}), ...(c === "Empleo" ? { r: regionOf(t, s, f.r), ...(LH_I.test(t) || LH_C.test(t) ? { lh: 1 } : {}), ...(CAD.test(t) ? { cd: 1 } : {}) } : {}) });
      }
    }
    return out;
  } catch (e) { return []; }
}
async function news() {
  const per = await Promise.all(FEEDS.map(readFeed)), all = per.flat(), seen = new Set(), seenT = new Set(), cnt = {}, emp = [], rest = [];
  all.sort((a, b) => b.d - a.d);
  const nt = t => t.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, " ").trim().slice(0, 70);
  for (const n of all) {
    const key = n.s + "|" + n.c, k2 = nt(n.t);
    if (seen.has(n.u) || seenT.has(k2)) continue;
    const lim = n.c === "Empleo" ? 10 : 14; if ((cnt[key] || 0) >= lim) continue;   // ninguna fuente acapara
    seen.add(n.u); seenT.add(k2); cnt[key] = (cnt[key] || 0) + 1;
    if (n.c === "Empleo") { if (emp.length < 70) emp.push(n); } else if (rest.length < 80) rest.push(n);   // Empleo tiene cupo propio: hasta 70 de 150
  }
  const out = emp.concat(rest).sort((a, b) => b.d - a.d);
  out.feeds = FEEDS.map((f, i) => f.src + " · " + f.url + " → " + per[i].length);
  return out;
}
export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    const q = (u.searchParams.get("icao") || "").toUpperCase(), icao = AERO[q] ? q : "LECU";   // solo aeródromos de la lista
    if (u.pathname === "/api/traffic") {
      const o = await memo("tr:" + icao, 15000, async () => { const r = await traffic(icao); return { ok: !!r.ac, ac: r.ac || [], src: r.src, why: r.why, at: Date.now() }; });
      return J(o, o.ok, 15);
    }
    if (u.pathname === "/api/notam") {
      const o = await memo("nt:" + icao, 600000, async () => { const l = await notams(icao); return { ok: !!l, n: l || [], at: Date.now(), src: "FAA NOTAM Search", why: l ? undefined : NT_WHY }; });
      return J(o, o.ok, 300);
    }
    if (u.pathname === "/api/news") {
      const o = await memo("news5", 21600000, async () => { const n = await news(); return { ok: n.length > 0, n, at: Date.now(), feeds: n.feeds, j: JOBS, w: WATCH }; });
      if (u.searchParams.get("debug")) return J({ feeds: o.feeds, ok: o.ok, count: (o.n || []).length }, true, 0);
      return J(o, o.ok, 900);
    }
    if (u.pathname !== "/api/wx") return env.ASSETS.fetch(req);
    const o = await memo("wx:" + icao, 120000, async () => {
      const list = stationsFor(icao), [metar, taf] = await Promise.all([first("metar", "rawOb", list), first("taf", "rawTAF", list)]);
      return { ok: !!(metar || taf), metar, taf, at: Date.now() };
    });
    return J(o, o.ok, 120);
  }
};
