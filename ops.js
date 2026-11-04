/* ATPL Fase 0 · OPS — panel de operaciones de Cuatro Vientos (LECU). Solo en la web con cuenta (de momento, solo admin).
   Mapa satélite con las pistas y la pista estimada en uso, METAR/TAF reales (/api/wx), mínimos del SOP.4.1, Windy y sol.
   Herramienta de estudio: NO sirve para planificar un vuelo real.
   API: F0Ops.render(el, {fetchWx, allowDemo}) · F0Ops.leave() */
(function(){
"use strict";
/* Datos del aeródromo (SkyVector y Wikipedia; contrastar con el AIP). Rumbos: SkyVector (verdaderos; en Madrid la declinación es casi 0). */
const AD={icao:"LECU", wx:"LEVS", name:"Madrid / Cuatro Vientos", lat:40.37056, lon:-3.785, elev:2269,
  main:{id:"09/27", len:1500, wid:30, surf:"Asfalto", a:{id:"09",hdg:94,ll:[40.371167,-3.794000],el:2269}, b:{id:"27",hdg:274,ll:[40.370167,-3.776333],el:2250}},
  sec:{id:"09L/27R", len:1127, wid:45, surf:"Tierra / hierba", a:{id:"09L",hdg:95,ll:[40.372333,-3.790667],el:2264}, b:{id:"27R",hdg:275,ll:[40.371667,-3.777667],el:2244}},
  freq:[["ATIS","118.220"],["Torre","118.700"],["Torre (alt.)","121.800 · 122.500"]]};
const AC={cz:{n:"PS-28 Cruiser",c:"Cruiser",xf:12,xs:10,t:32,ts:32}, c1:{n:"Cessna 172",c:"C172",xf:15,xs:12,t:35,ts:32}, pi:{n:"Piper PA-28",c:"Piper",xf:15,xs:12,t:35,ts:32}};
const MIN={visFi:5000,visSolo:8000,cigFi:1500,cigSolo:2500,tailFi:5,tailSolo:0,head:20};
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const S={data:null, t:0, clk:0, root:null, opt:null, map:null, lay:null, wctl:null, scen:0};

/* ---------- METAR / TAF ---------- */
const WX={MI:"poco profundo",BC:"bancos de",PR:"parcial",DR:"ventisca baja de",BL:"ventisca de",SH:"chubascos de",TS:"tormenta con",FZ:"engelante",DZ:"llovizna",RA:"lluvia",SN:"nieve",SG:"granos de nieve",PL:"cristales de hielo",GR:"granizo",GS:"granizo pequeño",BR:"neblina",FG:"niebla",FU:"humo",VA:"ceniza volcánica",DU:"polvo",SA:"arena",HZ:"calima",SQ:"turbonada",FC:"tubo de nubes",SS:"tormenta de arena",DS:"tormenta de polvo"};
const CL={FEW:"Poca nubosidad",SCT:"Nubes dispersas",BKN:"Nubes rotas",OVC:"Cielo cubierto"};
function wxText(code){ const inten=code.startsWith("-")?" (débil)":code.startsWith("+")?" (fuerte)":""; const c0=code.replace(/^[-+]/,""), vc=c0.startsWith("VC")?" en las proximidades":""; const parts=(c0.replace(/^VC/,"").match(/.{2}/g)||[]); let t=parts.map(p=>WX[p]||p).join(" "); t=t.replace(/ con$/,""); return (t+inten+vc).trim(); }
function group(t,o){   // un grupo del METAR/TAF → campos
  let m;
  if(t==="CAVOK"){ o.vis=9999; o.cavok=true; o.clouds=[]; o.ceil=null; return true; }
  if((m=t.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/))){ let k=m[4]==="MPS"?1.944:1; o.wind={vrb:m[1]==="VRB",dir:m[1]==="VRB"?null:+m[1],spd:Math.round(+m[2]*k),gst:m[3]?Math.round(+m[3]*k):0}; return true; }
  if((m=t.match(/^(\d{3})V(\d{3})$/))){ if(o.wind) o.wind.var=[+m[1],+m[2]]; return true; }
  if(/^\d{4}$/.test(t)){ o.vis=+t; return true; }
  if(/^(-|\+)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|SQ|FC|SS|DS)+$/.test(t)||/^(-|\+)?(VC)?TS$/.test(t)){ (o.wx=o.wx||[]).push(t); return true; }
  if(t==="NSC"||t==="SKC"||t==="NCD"){ o.clouds=[]; o.ceil=null; return true; }
  if((m=t.match(/^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/))){ (o.clouds=o.clouds||[]).push({t:m[1],h:+m[2]*100,cb:m[3]||""}); return true; }
  if((m=t.match(/^VV(\d{3})$/))){ (o.clouds=o.clouds||[]).push({t:"VV",h:+m[1]*100,cb:""}); return true; }
  return false;
}
function ceilOf(o){ const c=(o.clouds||[]).filter(x=>x.t==="BKN"||x.t==="OVC"||x.t==="VV").map(x=>x.h); return c.length?Math.min.apply(null,c):null; }
function parseMetar(raw){
  const o={raw:raw.trim(),clouds:[],wx:[],trend:""}, tk=o.raw.split(/\s+/); let i=0;
  if(tk[i]==="METAR"||tk[i]==="SPECI") o.kind=tk[i++];
  o.station=tk[i++]; let m=(tk[i]||"").match(/^(\d{2})(\d{2})(\d{2})Z$/); if(m){ o.day=+m[1]; o.hh=+m[2]; o.mm=+m[3]; i++; }
  if(tk[i]==="AUTO"||tk[i]==="COR") i++;
  let trend=false;
  for(;i<tk.length;i++){ const t=tk[i];
    if(t==="NOSIG"||t==="BECMG"||t==="TEMPO"){ trend=true; o.trend=tk.slice(i).join(" "); break; }
    if(t==="RMK") break;
    if((m=t.match(/^(M?\d{2})\/(M?\d{2})$/))){ const n=x=>x[0]==="M"?-(+x.slice(1)):+x; o.temp=n(m[1]); o.dew=n(m[2]); continue; }
    if((m=t.match(/^Q(\d{4})$/))){ o.qnh=+m[1]; continue; }
    if((m=t.match(/^A(\d{4})$/))){ o.qnh=Math.round(+m[1]*0.338639); continue; }
    group(t,o);
  }
  o.ceil=ceilOf(o); return o;
}
function obsDate(o,now){ if(o.day==null) return null; let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),o.day,o.hh,o.mm)); if(d-now>36e5*12) d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,o.day,o.hh,o.mm)); return d; }
function parseTaf(raw){
  const tk=raw.trim().split(/\s+/); let i=0; const o={raw:raw.trim(),periods:[]};
  if(tk[i]==="TAF") i++; if(tk[i]==="AMD"||tk[i]==="COR") i++;
  o.station=tk[i++]; i++; // emisión
  const v=(tk[i]||"").match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/); if(v){ o.from=+v[2]; o.to=+v[4]; o.day=+v[1]; i++; }
  let cur={label:"BASE",kind:"base",f:{clouds:[],wx:[]},t:""};
  const push=()=>{ o.periods.push(cur); };
  for(;i<tk.length;i++){ const t=tk[i]; let m;
    if(t==="BECMG"||t==="TEMPO"||t==="PROB30"||t==="PROB40"||/^FM\d{6}$/.test(t)){
      push(); let kind=t, lab=t, prob="";
      if(/^PROB/.test(t)){ prob=t+" "; if(tk[i+1]==="TEMPO"){ i++; kind="TEMPO"; } else { kind="PROB"; } }
      let rng="";
      if(/^FM\d{6}$/.test(t)){ kind="FM"; rng="desde las "+t.slice(4,6)+":"+t.slice(6,8)+" Z"; }
      else if((m=(tk[i+1]||"").match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/))){ rng=m[2]+"–"+m[4]+" Z"; i++; }
      cur={label:(prob+(kind==="FM"?"FM":kind)).trim(),kind,rng,f:{clouds:[],wx:[]},t:""}; continue; }
    group(t,cur.f);
  }
  push(); if(o.from!=null&&o.periods[0]) o.periods[0].rng=o.from===o.to?"24 h desde las "+pad(o.from)+" Z":pad(o.from)+"–"+pad(o.to)+" Z";
  // construir estado efectivo de cada periodo
  let base=null; const eff=[];
  o.periods.forEach(p=>{ const f=p.f; let e;
    if(p.kind==="base"){ e=Object.assign({},f); base=Object.assign({},f); }
    else { const src=(p.kind==="BECMG"||p.kind==="FM")?base:base; e=Object.assign({},src); ["wind","vis","cavok"].forEach(k=>{ if(f[k]!==undefined) e[k]=f[k]; }); if(f.clouds&&f.clouds.length||f.cavok){ e.clouds=f.clouds; if(f.cavok){ e.vis=9999; } } if(f.wx&&f.wx.length) e.wx=f.wx; else if(f.vis!==undefined||f.cavok) e.wx=[]; if(p.kind==="BECMG"||p.kind==="FM") base=Object.assign({},e); }
    e.ceil=ceilOf(e); p.e=e; });
  return o;
}

/* ---------- viento y mínimos ---------- */
function windOn(w){   // pista (extremo) con más viento de cara; a igualdad, la 27
  const ends=[AD.main.a,AD.main.b];
  if(!w||(w.spd===0&&!w.gst)) return {end:null,head:0,cross:0,calm:true,side:""};
  const v=Math.max(w.spd,w.gst||0); let best=null;
  ends.forEach(r=>{ const rel=w.vrb?0:((w.dir-r.hdg)%360+360)%360, a=rel*Math.PI/180; const head=w.vrb?0:Math.cos(a)*v, cross=w.vrb?v:Math.abs(Math.sin(a))*v; const c={end:r,head,cross,side:w.vrb?"":(rel>0&&rel<180?"derecha":"izquierda")}; if(!best||c.head>best.head+0.01||(Math.abs(c.head-best.head)<=0.01&&r.id==="27")) best=c; });
  return best;
}
function flightCat(e){ const v=e.vis==null?9999:e.vis, c=e.ceil==null?99999:e.ceil;
  if(v<1600||c<500) return "LIFR"; if(v<4800||c<1000) return "IFR"; if(v<=8000||c<=3000) return "MVFR"; return "VFR"; }
function evalOne(e,mode){
  const solo=mode==="solo", w=windOn(e.wind), vis=e.vis==null?9999:e.vis, vmin=solo?MIN.visSolo:MIN.visFi, cmin=solo?MIN.cigSolo:MIN.cigFi, tmax=solo?MIN.tailSolo:MIN.tailFi;
  const cbts=(e.clouds||[]).some(c=>c.cb==="CB")||(e.wx||[]).some(x=>/TS/.test(x));
  const out={};
  Object.keys(AC).forEach(k=>{ const a=AC[k], bad=[], near=[]; const xm=solo?a.xs:a.xf, tm=solo?a.ts:a.t;
    const f={vis:vis>=vmin, cig:e.ceil==null||e.ceil>=cmin, cross:w.cross<=xm, tail:-w.head<=tmax, head:w.head<=MIN.head, temp:e.temp==null||e.temp<=tm};
    if(!f.vis) bad.push("Visibilidad "+vis+" m (mín. "+vmin+")");
    if(!f.cig) bad.push("Techo "+e.ceil+" ft (mín. "+cmin+")");
    if(!f.cross) bad.push("Viento cruzado "+Math.round(w.cross)+" kt (máx. "+xm+")"); else if(w.cross>=xm-2) near.push("Cruzado "+Math.round(w.cross)+" de "+xm+" kt: muy cerca del límite");
    if(!f.head) bad.push("Viento de cara "+Math.round(w.head)+" kt (máx. "+MIN.head+")");
    if(!f.tail) bad.push("Viento de cola "+Math.round(-w.head)+" kt (máx. "+tmax+")");
    if(!f.temp) bad.push("Temperatura "+e.temp+" ºC (máx. "+tm+")");
    out[k]={s:bad.length?"no":(cbts||near.length?"warn":"ok"),why:bad.concat(near,cbts?["Tormenta o CB: decide el HT o el CFI"]:[]),f,xm,tm}; });
  return {ac:out,w,cbts};
}

/* ---------- sol ---------- */
function sunAt(date,rising,zen){ const R=Math.PI/180, lat=AD.lat, lon=AD.lon, Y=date.getUTCFullYear(), M=date.getUTCMonth()+1, D=date.getUTCDate();
  const N1=Math.floor(275*M/9), N2=Math.floor((M+9)/12), N3=1+Math.floor((Y-4*Math.floor(Y/4)+2)/3), N=N1-N2*N3+D-30, lh=lon/15, t=N+((rising?6:18)-lh)/24;
  const Mm=0.9856*t-3.289; let L=Mm+1.916*Math.sin(Mm*R)+0.020*Math.sin(2*Mm*R)+282.634; L=(L%360+360)%360;
  let RA=Math.atan(0.91764*Math.tan(L*R))/R; RA=(RA%360+360)%360; RA=(RA+(Math.floor(L/90)*90-Math.floor(RA/90)*90))/15;
  const sd=0.39782*Math.sin(L*R), cd=Math.cos(Math.asin(sd)), ch=(Math.cos(zen*R)-sd*Math.sin(lat*R))/(cd*Math.cos(lat*R)); if(ch>1||ch<-1) return null;
  let H=(rising?360-Math.acos(ch)/R:Math.acos(ch)/R)/15; let T=H+RA-0.06571*t-6.622; let UT=((T-lh)%24+24)%24;
  return new Date(Date.UTC(Y,M-1,D)+UT*36e5); }
function sun(now){ return {rise:sunAt(now,true,90.833), set:sunAt(now,false,90.833), civEnd:sunAt(now,false,96)}; }
const fz=d=>d?pad(d.getUTCHours())+":"+pad(d.getUTCMinutes()):"--:--";
const fl=d=>d?new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Madrid"}).format(d):"--:--";

/* ---------- datos de ejemplo (solo si el servidor no responde y se pide) ---------- */
const SCEN=[
  {n:"Día normal", m:"24008KT 9999 FEW040 SCT090 19/06 Q1020 NOSIG", t:"24010KT 9999 FEW040 TEMPO {a}/{b} 24015G25KT BECMG {c}/{d} VRB03KT CAVOK"},
  {n:"Viento cruzado", m:"18018G28KT 9999 SCT045 22/08 Q1012 NOSIG", t:"18016G26KT 9999 SCT045 BECMG {a}/{b} 24010KT FEW040"},
  {n:"Techo bajo", m:"25006KT 6000 -RA BKN012 OVC030 11/09 Q1015 NOSIG", t:"25006KT 6000 -RA BKN012 BECMG {a}/{b} 25008KT 9999 SCT025 TEMPO {c}/{d} 4000 RA BKN008"},
  {n:"Niebla", m:"00000KT 0800 FG VV002 02/02 Q1026 NOSIG", t:"VRB02KT 0800 FG VV002 BECMG {a}/{b} 05005KT 6000 BR SCT008 BECMG {c}/{d} 9999 FEW040"},
  {n:"Calor y tormenta", m:"VRB05KT 9999 FEW040CB SCT060 36/12 Q1010 NOSIG", t:"VRB05KT 9999 FEW040CB SCT060 TEMPO {a}/{b} 27020G35KT 3000 TSRA BKN030CB BECMG {c}/{d} 24008KT 9999 FEW050"}];
function demoData(i){
  const now=new Date(), ob=new Date(Math.floor(now/18e5)*18e5), tf=new Date(Math.floor(now/108e5)*108e5), s=SCEN[i];
  const h=k=>{ const x=new Date(tf.getTime()+k*36e5); return pad(x.getUTCDate())+pad(x.getUTCHours()); };
  return {metar:{raw:"METAR "+AD.wx+" "+pad(ob.getUTCDate())+pad(ob.getUTCHours())+pad(ob.getUTCMinutes())+"Z "+s.m,station:AD.wx},
    taf:{raw:"TAF "+AD.wx+" "+pad(tf.getUTCDate())+pad(tf.getUTCHours())+"00Z "+h(0)+"/"+h(24)+" "+s.t.replace("{a}",h(3)).replace("{b}",h(7)).replace("{c}",h(10)).replace("{d}",h(12)),station:AD.wx},demo:true};
}

/* ---------- pintado ---------- */
const NOTE={LECU:"METAR de Cuatro Vientos (LECU)", LEVS:"METAR de LEVS (parte militar de Cuatro Vientos)", LEGT:"No hay METAR de Cuatro Vientos: se usa Getafe (LEGT), a unos 10 km", LEMD:"No hay METAR de Cuatro Vientos: se usa Madrid-Barajas (LEMD), a unos 26 km"};
const CATT={VFR:"Condiciones VFR",MVFR:"VFR marginal",IFR:"Condiciones IFR",LIFR:"IFR bajo"};
function kt(w){ if(!w) return "—"; if(w.spd===0&&!w.gst) return "Calma"; return (w.vrb?"Variable":(pad3(w.dir)+"º"))+" · "+w.spd+" kt"+(w.gst?" (rachas "+w.gst+")":"")+(w.var?" · varía "+w.var[0]+"–"+w.var[1]+"º":""); }
const pad3=n=>String(n).padStart(3,"0");
function visTxt(v){ return v==null?"—":v>=9999?"≥ 10 km":(v>=1000?(v/1000).toFixed(v%1000?1:0).replace(".",",")+" km":v+" m"); }
function cloudTxt(e){ if(e.cavok) return "CAVOK (sin nubes bajas)"; const c=e.clouds||[]; if(!c.length) return "Sin nubes significativas"; return c.map(x=>(x.t==="VV"?"Cielo oscurecido (VV)":CL[x.t])+" a "+x.h.toLocaleString("es-ES")+" ft"+(x.cb==="CB"?" · cumulonimbus":x.cb==="TCU"?" · cúmulo torreón":"")).join(" · "); }
function wxTxt(e){ const w=e.wx||[]; return w.length?w.map(wxText).join(", "):"Ninguno"; }
function tokCls(t){
  if(/^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(t)) return ["w","Viento: de dónde sopla (grados) y velocidad en nudos; G = rachas"];
  if(/^\d{3}V\d{3}$/.test(t)) return ["w","Viento variable entre esos rumbos"];
  if(/^\d{4}$/.test(t)) return ["v","Visibilidad en metros (9999 = 10 km o más)"]; if(t==="CAVOK") return ["v","CAVOK: visibilidad 10 km o más, sin nubes bajas ni fenómenos"];
  if(/^(FEW|SCT|BKN|OVC|VV)\d{3}/.test(t)||t==="NSC") return ["c","Nubes: cantidad y altura en cientos de pies sobre el campo"];
  if(/^M?\d{2}\/M?\d{2}$/.test(t)) return ["t","Temperatura / punto de rocío (ºC)"];
  if(/^[QA]\d{4}$/.test(t)) return ["q","Presión QNH (hPa)"];
  if(/^(-|\+)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|SQ|FC|SS|DS)+$/.test(t)) return ["x","Fenómeno meteorológico"];
  return null; }
const rawHtml=raw=>raw.split(/\s+/).map(t=>{ const c=tokCls(t); return c?`<span class="k ${c[0]}" title="${esc(c[1])}">${esc(t)}</span>`:esc(t); }).join(" ");
const RAD=Math.PI/180;
const off=(ll,brg,m)=>[ll[0]+Math.cos(brg*RAD)*m/111320, ll[1]+Math.sin(brg*RAD)*m/(111320*Math.cos(ll[0]*RAD))];

function drawMap(act,w,e){
  const L=window.L, M=S.map; if(!L||!M) return;
  if(S.lay) S.lay.clearLayers(); else S.lay=L.layerGroup().addTo(M);
  const g=S.lay, A=AD.main, B=AD.sec;
  L.polyline([B.a.ll,B.b.ll],{color:"#E8E2C8",weight:6,opacity:.85}).addTo(g);
  L.polyline([A.a.ll,A.b.ll],{color:"#FFFFFF",weight:12,opacity:.9}).addTo(g);
  L.polyline([A.a.ll,A.b.ll],{color:"#262A30",weight:8,opacity:1}).addTo(g);
  L.polyline([A.a.ll,A.b.ll],{color:"#FFFFFF",weight:1.5,opacity:.9,dashArray:"7 7"}).addTo(g);
  if(act){ L.polyline([A.a.ll,A.b.ll],{color:"#FFC400",weight:14,opacity:.28}).addTo(g); }
  [[A.a,0],[A.b,0]].forEach(([r])=>{ const on=act&&act.id===r.id, p=off(r.ll,r.hdg+180,55);
    L.marker(p,{interactive:false,icon:L.divIcon({className:"op-lbl"+(on?" on":""),html:"<span>"+r.id+"</span>"+(on?"<em>EN USO</em>":""),iconSize:null})}).addTo(g); });
  L.marker(off(B.a.ll,B.a.hdg+180,45),{interactive:false,icon:L.divIcon({className:"op-lbl sec",html:"<span>"+B.a.id+"</span>",iconSize:null})}).addTo(g);
  L.marker(off(B.b.ll,B.b.hdg+180,45),{interactive:false,icon:L.divIcon({className:"op-lbl sec",html:"<span>"+B.b.id+"</span>",iconSize:null})}).addTo(g);
  if(act){ const mid=[(A.a.ll[0]+A.b.ll[0])/2,(A.a.ll[1]+A.b.ll[1])/2];
    L.marker(mid,{interactive:false,icon:L.divIcon({className:"op-dir",html:`<svg viewBox="0 0 60 60" width="46" height="46" style="transform:rotate(${act.hdg}deg)"><path d="M30 6 L48 40 L30 32 L12 40 Z" fill="#FFC400" stroke="#262A30" stroke-width="3" stroke-linejoin="round"/></svg>`,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(g); }
  const wc=$("#opWind"); if(wc){ const calm=!w||(w.spd===0&&!w.gst), vr=w&&w.vrb;
    wc.innerHTML=`<svg viewBox="0 0 60 60" width="54" height="54"><circle cx="30" cy="30" r="27" fill="#14181D" stroke="#FFC400" stroke-width="2"/>${calm?'<text x="30" y="35" text-anchor="middle" font-size="13" font-weight="700" fill="#FFC400">CALMA</text>':vr?'<text x="30" y="35" text-anchor="middle" font-size="14" font-weight="700" fill="#FFC400">VRB</text>':`<g transform="rotate(${w.dir+180} 30 30)"><path d="M30 8 L39 40 L30 33 L21 40 Z" fill="#FFC400"/></g>`}</svg><div><b>${calm?"Calma":(vr?"VRB":pad3(w.dir)+"º")+" · "+w.spd+" kt"}</b><small>${w&&w.gst?"rachas "+w.gst+" kt":"viento en superficie"}</small></div>`; }
}
function initMap(){
  const L=window.L, el=$("#opMap",S.root); if(!el) return;
  if(!L){ el.innerHTML='<p class="muted" style="padding:20px">No se ha podido cargar el mapa.</p>'; return; }
  if(S.map){ S.map.remove(); S.map=null; S.lay=null; }
  const M=L.map(el,{scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false,zoomControl:true,attributionControl:true});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagen: Esri, Maxar, Earthstar Geographics"}).addTo(M);
  L.control.scale({imperial:false,position:"bottomleft"}).addTo(M);
  const C=L.Control.extend({options:{position:"topleft"},onAdd(){ const d=L.DomUtil.create("div","op-wind"); d.id="opWind"; return d; }}); new C().addTo(M);
  M.fitBounds(L.latLngBounds([AD.main.a.ll,AD.main.b.ll,AD.sec.a.ll,AD.sec.b.ll]),{padding:[40,40],maxZoom:16});
  S.map=M; setTimeout(()=>{ try{ M.invalidateSize(); M.fitBounds(L.latLngBounds([AD.main.a.ll,AD.main.b.ll,AD.sec.a.ll,AD.sec.b.ll]),{padding:[40,40],maxZoom:16}); }catch(e){} },120);
}
const mark=(arr)=>arr.every(Boolean)?'<i class="m ok">✔</i>':arr.some(Boolean)?'<i class="m mid" title="Cumple solo algún avión">▲</i>':'<i class="m no">✖</i>';
function fill(){
  const d=S.data, R=S.root; if(!d||!R) return; const now=new Date(), e=d.m, cat=flightCat(e);
  const cb=$("#opCat",R); cb.className="cat "+cat; cb.innerHTML="<b>"+cat+"</b><small>"+CATT[cat]+"</small>";
  const age=d.obs?Math.round((now-d.obs)/60000):null, sn=sun(now);
  $("#opSub",R).innerHTML=`<span>${NOTE[d.mSt]||("METAR de "+esc(d.mSt||"?"))}${d.demo?' · <b class="dm">DATOS DE EJEMPLO</b>':""}</span>`+(age==null?"":`<span class="${age>75?"old":""}">${age>75?"Dato antiguo · ":"Observado "}${age<1?"ahora":"hace "+age+" min"} · ${fz(d.obs)} Z</span>`)+`<span>☀ Amanecer ${fl(sn.rise)} · Ocaso ${fl(sn.set)} · Noche desde ${fl(sn.civEnd)} <i>(hora local)</i></span>`;
  const evF=evalOne(e,"fi"), evS=evalOne(e,"solo"), w=evF.w, act=w.end;
  $("#opRwy",R).innerHTML=act?`<div class="sign">${act.id}</div><div class="rt"><b>Pista estimada en uso</b><span>Viento ${kt(e.wind)}</span><span>${w.head>=0?"Cara":"Cola"} <b>${Math.abs(Math.round(w.head))} kt</b> · cruzado <b>${Math.round(w.cross)} kt</b>${w.side?" por la "+w.side:""}</span></div>`:`<div class="sign dim">—</div><div class="rt"><b>Calma: sin pista preferente</b><span>${kt(e.wind)}</span></div>`;
  drawMap(act,e.wind,e);
  $("#opMetRaw",R).innerHTML=rawHtml(d.metar);
  $("#opMetDec",R).innerHTML=`<dl><dt>Viento</dt><dd>${kt(e.wind)}</dd><dt>Visibilidad</dt><dd>${visTxt(e.vis)}</dd><dt>Fenómenos</dt><dd>${wxTxt(e)}</dd><dt>Nubes</dt><dd>${cloudTxt(e)}</dd><dt>Temperatura</dt><dd>${e.temp!=null?e.temp+" ºC · rocío "+e.dew+" ºC":"—"}</dd><dt>QNH</dt><dd>${e.qnh?e.qnh+" hPa":"—"}</dd><dt>Tendencia</dt><dd>${e.trend?(/NOSIG/.test(e.trend)?"Sin cambios significativos (NOSIG)":esc(e.trend)):"—"}</dd></dl>`;
  const tp=d.tp; 
  const ts=$("#opTafSt",R); if(ts) ts.textContent=tp&&tp.station?("de "+tp.station+(tp.station==="LEMD"?" (Barajas)":"")):"pronóstico"; const ms=$("#opMetSt",R); if(ms) ms.textContent=d.mSt||"";
  $("#opTafRaw",R).innerHTML=tp&&d.taf?rawHtml(d.taf):"No hay TAF disponible.";
  $("#opTafTb",R).innerHTML=tp&&tp.periods.length?`<table class="tf"><thead><tr><th>Periodo</th><th>Viento</th><th>Visib.</th><th>Tiempo</th><th></th></tr></thead><tbody>${tp.periods.map(p=>{ const q=p.e, c=flightCat(q); return `<tr><td><b>${esc(p.label)}</b>${p.rng?`<small>${esc(p.rng)}</small>`:""}</td><td>${kt(q.wind)}</td><td>${visTxt(q.vis)}</td><td>${(q.wx&&q.wx.length?q.wx.map(wxText).join(", ")+" · ":"")+(q.cavok?"CAVOK":(q.clouds&&q.clouds.length?q.clouds.map(c=>c.t+" "+(c.h/100)).join(" "):"sin nubes"))}</td><td><span class="cc ${c}">${c}</span></td></tr>`; }).join("")}</tbody></table>`:"";
  // mínimos
  const f1=evF.ac.cz.f, f2=evS.ac.cz.f, all=(ev,k)=>Object.keys(AC).map(a=>ev.ac[a].f[k]);
  const cell=(ok,txt)=>`<td class="lim">${txt} ${ok}</td>`;
  const chips=ev=>Object.keys(AC).map(k=>`<span class="ac ${ev.ac[k].s}" title="${esc(ev.ac[k].why.join(" · ")||"Dentro de todos los mínimos")}">${AC[k].c}</span>`).join("");
  $("#opMin",R).innerHTML=`<table class="mn"><thead><tr><th></th><th>Ahora</th><th>Con instructor</th><th>Solo</th></tr></thead><tbody>
   <tr><th>Visibilidad</th><td><b>${visTxt(e.vis)}</b></td>${cell(mark([f1.vis]),"≥ 5 km")}${cell(mark([f2.vis]),"≥ 8 km")}</tr>
   <tr><th>Techo</th><td><b>${e.ceil==null?"Sin techo":e.ceil.toLocaleString("es-ES")+" ft"}</b></td>${cell(mark([f1.cig]),"≥ 1.500 ft")}${cell(mark([f2.cig]),"≥ 2.500 ft")}</tr>
   <tr><th>Viento cruzado</th><td><b>${Math.round(w.cross)} kt</b></td>${cell(mark(all(evF,"cross")),"≤ 12 · 15 · 15 kt")}${cell(mark(all(evS,"cross")),"≤ 10 · 12 · 12 kt")}</tr>
   <tr><th>Viento de cara</th><td><b>${Math.max(0,Math.round(w.head))} kt</b></td>${cell(mark([f1.head]),"≤ 20 kt")}${cell(mark([f2.head]),"≤ 20 kt")}</tr>
   <tr><th>Viento de cola</th><td><b>${Math.max(0,Math.round(-w.head))} kt</b></td>${cell(mark([f1.tail]),"≤ 5 kt")}${cell(mark([f2.tail]),"0 kt")}</tr>
   <tr><th>Temperatura</th><td><b>${e.temp!=null?e.temp+" ºC":"—"}</b></td>${cell(mark(all(evF,"temp")),"≤ 32 · 35 · 35 ºC")}${cell(mark(all(evS,"temp")),"≤ 32 ºC")}</tr>
   <tr class="res"><th>¿Se puede?</th><td></td><td>${chips(evF)}</td><td>${chips(evS)}</td></tr></tbody></table>
   <p class="nt">Límites por avión: Cruiser · C172 · Piper (SOP.4.1). Orientativo: decide el HT o el CFI, que pueden despachar fuera de estos límites.</p>`;
}

function clock(){ const R=S.root; if(!R) return; const n=new Date(); const z=$("#opZ",R), l=$("#opL",R); if(z) z.textContent=pad(n.getUTCHours())+":"+pad(n.getUTCMinutes()); if(l) l.textContent=fl(n); }
function setData(raw){
  const m=parseMetar(raw.metar.raw), tp=raw.taf?parseTaf(raw.taf.raw):null;
  S.data={m,tp,metar:raw.metar.raw,taf:raw.taf?raw.taf.raw:"",mSt:raw.metar.station,obs:obsDate(m,new Date()),demo:!!raw.demo};
  const er=$("#opErr",S.root); if(er) er.hidden=true; fill();
}
function load(){
  const f=S.opt&&S.opt.fetchWx, R=S.root;
  const fail=()=>{ const er=$("#opErr",R); if(er){ er.hidden=false; } };
  if(!f){ setData(demoData(S.scen)); return; }
  f().then(r=>{ if(!r||!r.metar) throw 0; setData(r); }).catch(fail);
}
const CSS=`.op{--bg:#E6E9EC;--pn:#FFFFFF;--ink:#171C21;--mu:#5E6873;--ln:#D2D7DD;--hd:#1C2128;--am:#FFC400;--vfr:#1E9E44;--mvfr:#2F6FD0;--ifr:#D23A2F;--lifr:#B02FA5;--ok:#1E8A42;--no:#C9372C;--mid:#B7791F;--okb:#E3F3E8;--nob:#FBE5E3;--midb:#FFF1D6;--k1:#0B5CAD;--k2:#8A4B00;--k3:#5A3E9B;--k4:#9A2A2A;--k5:#0B7A6B;
 min-height:100%;background:var(--bg);color:var(--ink);font:15px/1.45 Barlow,system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .op{--bg:#0D1013;--pn:#161A1F;--ink:#E6E9EC;--mu:#8E98A3;--ln:#2A3037;--hd:#090B0E;--okb:#12301E;--nob:#3A1917;--midb:#33290F;--ok:#4CC97A;--no:#F0746B;--mid:#E3B341;--k1:#6CB4FF;--k2:#E9A95B;--k3:#B7A2F2;--k4:#F08E8E;--k5:#5CD1BE}}
:root[data-theme="dark"] .op{--bg:#0D1013;--pn:#161A1F;--ink:#E6E9EC;--mu:#8E98A3;--ln:#2A3037;--hd:#090B0E;--okb:#12301E;--nob:#3A1917;--midb:#33290F;--ok:#4CC97A;--no:#F0746B;--mid:#E3B341;--k1:#6CB4FF;--k2:#E9A95B;--k3:#B7A2F2;--k4:#F08E8E;--k5:#5CD1BE}
.op *{box-sizing:border-box}.op .muted{color:var(--mu)}
.op-top{background:var(--hd);color:#fff;display:flex;flex-wrap:wrap;align-items:center;gap:10px 24px;padding:12px max(16px,env(safe-area-inset-right,0px)) 12px max(16px,env(safe-area-inset-left,0px))}
.op-top .id b{display:block;font:700 40px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.04em}.op-top .id span{color:#9AA5B1;font-size:14px}
.cat{display:flex;align-items:center;gap:10px;border-radius:6px;padding:4px 14px 4px 10px;background:var(--vfr);color:#fff}.cat b{font:700 26px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.06em}.cat small{font:600 12px Barlow,sans-serif;letter-spacing:.04em;text-transform:uppercase;opacity:.95}
.cat.MVFR{background:var(--mvfr)}.cat.IFR{background:var(--ifr)}.cat.LIFR{background:var(--lifr)}
.op-top .tm{margin-left:auto;display:flex;gap:22px}.op-top .tm div{text-align:right}.op-top .tm small{display:block;font:600 11px Barlow,sans-serif;letter-spacing:.14em;color:#9AA5B1}.op-top .tm b{font:600 30px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.05em;font-variant-numeric:tabular-nums;color:var(--am)}
.op-sub{display:flex;flex-wrap:wrap;gap:4px 22px;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));background:var(--pn);border-bottom:1px solid var(--ln);font-size:14px;color:var(--mu)}.op-sub .old{color:var(--no);font-weight:600}.op-sub i{font-style:normal;opacity:.8}.op-sub .dm{color:var(--mid)}
.op-err[hidden]{display:none!important}.op-err{margin:12px max(16px,env(safe-area-inset-left,0px)) 0;padding:10px 14px;border:1px solid var(--no);background:var(--nob);border-radius:6px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}.op-err a,.op-err button{font:600 14px Barlow,sans-serif;color:var(--ink);border:1px solid var(--ink);background:transparent;border-radius:6px;padding:6px 12px;text-decoration:none;cursor:pointer}
.op-in{max-width:1240px;margin:0 auto;padding:14px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px));display:grid;gap:14px}
.op-hero{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
@media (min-width:980px){.op-hero{grid-template-columns:minmax(0,2fr) minmax(300px,1fr)}.op-two{grid-template-columns:1fr 1fr!important}}
.pn{background:var(--pn);border:1px solid var(--ln);border-radius:8px;min-width:0}
.pn>h2{margin:0;padding:10px 14px;border-bottom:1px solid var(--ln);font:700 16px/1.2 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mu);display:flex;justify-content:space-between;gap:8px}
.pn>h2 small{font:600 12px Barlow,sans-serif;letter-spacing:.04em;text-transform:none}.pn .bd{padding:12px 14px}
.op-map{overflow:hidden;position:relative}#opMap{height:clamp(340px,62vh,580px);background:#2B3138}
.op-wind{display:flex;align-items:center;gap:8px;background:rgba(20,24,29,.88);color:#fff;border:1px solid #3A424B;border-radius:8px;padding:4px 12px 4px 4px;margin:10px!important}.op-wind b{display:block;font:700 18px/1.1 Barlow,sans-serif}.op-wind small{color:#B7C0CA;font-size:12px}
.op-lbl{white-space:nowrap}.op-lbl span{display:inline-block;transform:translate(-50%,-50%);background:#14181D;color:#fff;font:700 15px/1 Barlow,sans-serif;border:2px solid #fff;border-radius:5px;padding:3px 7px}
.op-lbl.on span{background:var(--am);color:#14181D;border-color:#14181D;font-size:17px}.op-lbl em{position:absolute;left:0;top:16px;transform:translateX(-50%);font:700 11px Barlow,sans-serif;font-style:normal;letter-spacing:.08em;background:#14181D;color:var(--am);padding:2px 6px;border-radius:4px}
.op-lbl.sec span{background:rgba(20,24,29,.75);font-size:12px;border-width:1px}
.op-dir svg{filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}
.leaflet-container{font-family:Barlow,system-ui,sans-serif}
.op-side{display:grid;gap:14px;align-content:start}
.rwy{display:flex;gap:14px;align-items:center}.sign{background:#000;color:#FFD100;font:700 52px/1 "Barlow Condensed",Arial,sans-serif;letter-spacing:.04em;padding:8px 18px;border-radius:6px;outline:2px solid #FFD100;outline-offset:-7px;min-width:88px;text-align:center}.sign.dim{color:#665400;outline-color:#665400}
.rt{display:grid;gap:2px;font-size:14.5px}.rt b{font-size:16px}
.tbl{width:100%;border-collapse:collapse;font-size:14.5px}.tbl th,.tbl td{text-align:left;padding:6px 6px;border-bottom:1px solid var(--ln)}.tbl th{font:600 12px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}.tbl tr:last-child td{border-bottom:0}
.fq{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0;font-size:14.5px}.fq dt{color:var(--mu)}.fq dd{margin:0;font-variant-numeric:tabular-nums;font-weight:600}
.src{margin:8px 0 0;font-size:12.5px;color:var(--mu)}
.op-two{display:grid;gap:14px;grid-template-columns:1fr}
.raw{font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere;padding:10px 12px;border:1px solid var(--ln);border-radius:6px;background:var(--bg);margin-bottom:10px}
.raw .k{border-bottom:2px solid;cursor:help}.k.w{color:var(--k1);border-color:var(--k1)}.k.v{color:var(--k2);border-color:var(--k2)}.k.c{color:var(--k3);border-color:var(--k3)}.k.t{color:var(--k5);border-color:var(--k5)}.k.q{color:var(--k4);border-color:var(--k4)}.k.x{color:var(--k4);border-color:var(--k4)}
.op dl{display:grid;grid-template-columns:auto 1fr;gap:5px 16px;margin:0}.op dt{color:var(--mu);font-weight:600}.op dd{margin:0}
table.tf,table.mn{width:100%;border-collapse:collapse;font-size:14.5px}.tf th,.mn th{font:600 12px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);text-align:left;padding:5px 8px}.tf td,.mn td,.mn tbody th{padding:8px;border-top:1px solid var(--ln);vertical-align:top;text-align:left}.tf td small{display:block;color:var(--mu)}
.mn tbody th{font:600 15px Barlow,sans-serif;text-transform:none;letter-spacing:0;color:var(--ink)}
.cc{display:inline-block;font:700 12px Barlow,sans-serif;letter-spacing:.04em;color:#fff;border-radius:4px;padding:2px 7px;background:var(--vfr)}.cc.MVFR{background:var(--mvfr)}.cc.IFR{background:var(--ifr)}.cc.LIFR{background:var(--lifr)}
.m{font-style:normal;font-weight:700;margin-left:4px}.m.ok{color:var(--ok)}.m.no{color:var(--no)}.m.mid{color:var(--mid)}
.mn td.lim{color:var(--mu)}.mn tr.res td{padding-top:10px}.ac{display:inline-block;font:700 12.5px Barlow,sans-serif;border-radius:4px;padding:3px 8px;margin:2px 4px 2px 0;border:1px solid}.ac.ok{color:var(--ok);background:var(--okb);border-color:var(--ok)}.ac.warn{color:var(--mid);background:var(--midb);border-color:var(--mid)}.ac.no{color:var(--no);background:var(--nob);border-color:var(--no)}
.nt{margin:10px 0 0;font-size:13px;color:var(--mu)}
.op-wy{position:relative;height:clamp(380px,60vh,560px);background:#2B3138}.op-wy iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.lk{display:flex;flex-wrap:wrap;gap:8px}.lk a{font:600 14.5px Barlow,sans-serif;color:var(--ink);text-decoration:none;border:1px solid var(--ln);border-radius:6px;padding:8px 12px;background:var(--pn)}.lk a:hover{border-color:var(--ink)}
.op a{color:var(--k1)}.lk a{color:var(--ink)!important}.op-note{font-size:13px;color:var(--mu);padding:0 2px}.op-note b{color:var(--ink)}
@media (max-width:560px){.tf,.mn,.tbl{font-size:13px!important}.tf td,.mn td,.mn tbody th,.tbl td{padding:6px 4px!important}.tf th,.mn th{padding:4px!important}.op-top .id b{font-size:32px}.op-top .tm{margin-left:0}.mn th:nth-child(1),.mn tbody th{width:28%}.sign{font-size:44px}}`;
function render(el,opt){
  S.opt=opt||{}; S.root=el;
  const wy="https://embed.windy.com/embed2.html?lat=40.37&lon=-3.785&detailLat=40.37&detailLon=-3.785&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=true&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1";
  el.innerHTML=`<style>${CSS}</style><div class="op">
   <header class="op-top"><div class="id"><b>${AD.icao}</b><span>${AD.name}</span></div><div class="cat" id="opCat"><b>—</b><small>cargando</small></div><div class="tm"><div><small>UTC</small><b id="opZ">--:--</b></div><div><small>LOCAL</small><b id="opL">--:--</b></div></div></header>
   <div class="op-sub" id="opSub"><span>Cargando METAR y TAF…</span></div>
   <div class="op-err" id="opErr" hidden><span><b>No se han podido cargar el METAR y el TAF.</b> Consulta la AEMET.</span><a target="_blank" rel="noopener" href="https://ama.aemet.es/">AEMET</a>${S.opt.allowDemo?'<button type="button" id="opDemo">Ver con datos de ejemplo</button>':""}</div>
   <div class="op-in">
    <div class="op-hero">
     <section class="pn op-map"><h2>Cuatro Vientos <small>imagen satélite · norte arriba</small></h2><div id="opMap"></div></section>
     <aside class="op-side">
      <section class="pn"><h2>Pista en uso <small>estimada</small></h2><div class="bd"><div class="rwy" id="opRwy"></div><p class="src">Estimada con el viento y el rumbo de la pista. La pista en uso real la fija la torre o el ATIS (118.220).</p></div></section>
      <section class="pn"><h2>Pistas</h2><div class="bd"><table class="tbl"><thead><tr><th>Pista</th><th>Rumbo</th><th>Medidas</th><th>Superficie</th></tr></thead><tbody>
       <tr><td><b>${AD.main.id}</b></td><td>${AD.main.a.hdg}º / ${AD.main.b.hdg}º</td><td>${AD.main.len.toLocaleString("es-ES")} × ${AD.main.wid} m</td><td>${AD.main.surf}</td></tr>
       <tr><td><b>${AD.sec.id}</b></td><td>${AD.sec.a.hdg}º / ${AD.sec.b.hdg}º</td><td>${AD.sec.len.toLocaleString("es-ES")} × ${AD.sec.wid} m</td><td>${AD.sec.surf}</td></tr></tbody></table>
       <p class="src">Elevación ${AD.elev.toLocaleString("es-ES")} ft · umbral 09: ${AD.main.a.el} ft · umbral 27: ${AD.main.b.el} ft</p></div></section>
      <section class="pn"><h2>Frecuencias</h2><div class="bd"><dl class="fq">${AD.freq.map(f=>`<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join("")}</dl><p class="src">Datos de SkyVector y Wikipedia: contrasta con el AIP antes de usarlos.</p></div></section>
     </aside>
    </div>
    <div class="op-two">
     <section class="pn"><h2>METAR <small id="opMetSt"></small></h2><div class="bd"><div class="raw" id="opMetRaw"></div><div id="opMetDec"></div></div></section>
     <section class="pn"><h2>TAF <small id="opTafSt">pronóstico</small></h2><div class="bd"><div class="raw" id="opTafRaw"></div><div id="opTafTb"></div></div></section>
    </div>
    <section class="pn"><h2>Mínimos de la escuela <small>SOP.4.1</small></h2><div class="bd" id="opMin"></div></section>
    <section class="pn"><h2>Viento y tiempo <small>Windy</small></h2><div class="op-wy"><iframe title="Mapa de viento Windy" src="${wy}" referrerpolicy="no-referrer" allow="fullscreen"></iframe></div><div class="bd"><span class="muted">¿No carga? </span><a href="https://www.windy.com/40.37/-3.785?wind,8" target="_blank" rel="noopener">Abrir en Windy</a></div></section>
    <section class="pn"><h2>Enlaces</h2><div class="bd lk"><a target="_blank" rel="noopener" href="https://globe.adsbexchange.com/?lat=40.37&lon=-3.785&zoom=11">✈ Tráfico en vivo (ADS-B)</a><a target="_blank" rel="noopener" href="https://www.flightradar24.com/40.37,-3.79/11">FlightRadar24</a><a target="_blank" rel="noopener" href="https://ama.aemet.es/">AEMET · METAR y TAF oficiales</a><a target="_blank" rel="noopener" href="https://aip.enaire.es/">AIP España · cartas</a><a target="_blank" rel="noopener" href="https://insignia.enaire.es/">NOTAM · ENAIRE</a></div></section>
    <p class="op-note"><b>Herramienta de estudio.</b> No sirve para planificar ni decidir un vuelo real: la fuente oficial es la AEMET (meteo), el AIS de ENAIRE (NOTAM y cartas) y tu instructor. La pista en uso y los mínimos del día los confirma OPS.</p>
   </div></div>`;
  el.addEventListener("click",ev=>{ const b=ev.target.closest("#opDemo"); if(b){ S.opt.fetchWx=null; setData(demoData(S.scen)); } });
  initMap(); load(); clock(); clearInterval(S.clk); S.clk=setInterval(clock,10000); clearInterval(S.t); S.t=setInterval(()=>{ if(S.opt.fetchWx) load(); else if(S.data) fill(); },5*60000);
}
function leave(){ clearInterval(S.clk); clearInterval(S.t); try{ if(S.map) S.map.remove(); }catch(e){} S.map=null; S.lay=null; S.root=null; }
window.F0Ops={render,leave,_t:{parseMetar,parseTaf,evalOne,sun,windOn,wxText,flightCat}};
})();
