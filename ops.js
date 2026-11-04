/* ATPL Fase 0 · OPS — panel de operaciones de Cuatro Vientos (LECU). Solo en la web con cuenta (de momento, solo admin).
   Mapa satélite con las pistas y la pista estimada en uso, METAR/TAF reales (/api/wx), mínimos del SOP.4.1, Windy y sol.
   Herramienta de estudio: NO sirve para planificar un vuelo real.
   API: F0Ops.render(el, {fetchWx, allowDemo}) · F0Ops.leave() */
(function(){
"use strict";
/* Datos del aeródromo: AIP España AD 2-LECU/LEVS (ENAIRE, vigente 06-AUG-26). Rumbos magnéticos. */
const AD={icao:"LECU", wx:"LEVS", name:"Madrid / Cuatro Vientos", lat:40.37056, lon:-3.785, elev:2269,
  main:{id:"09/27", len:1500, wid:30, surf:"ASPH", pcn:"39/F/A/W/T", strip:"1740 × 80", 
    a:{id:"09",hdg:94,ll:[40.371122,-3.793928],el:2269,tora:1500,toda:1500,asda:1554,lda:1500,swy:"54 × 30"},
    b:{id:"27",hdg:274,ll:[40.370233,-3.776353],el:2250,tora:1500,toda:1500,asda:1555,lda:1500,swy:"55 × 30"}}};
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

/* ---------- datos de ejemplo (solo si el servidor no responde y se pide) ---------- */
const SCEN=[
  {n:"Día normal", m:"24008KT 9999 FEW040 SCT090 19/06 Q1020 NOSIG", t:"24010KT 9999 FEW040 TEMPO {a}/{b} 24015G25KT BECMG {c}/{d} VRB03KT CAVOK"},
  {n:"Techo bajo", m:"25006KT 6000 -RA BKN012 OVC030 11/09 Q1015 NOSIG", t:"25006KT 6000 -RA BKN012 BECMG {a}/{b} 25008KT 9999 SCT025 TEMPO {c}/{d} 4000 RA BKN008"}];
function demoData(i){
  const now=new Date(), ob=new Date(Math.floor(now/18e5)*18e5), tf=new Date(Math.floor(now/108e5)*108e5), s=SCEN[i||0];
  const h=k=>{ const x=new Date(tf.getTime()+k*36e5); return pad(x.getUTCDate())+pad(x.getUTCHours()); };
  return {metar:{raw:"METAR "+AD.wx+" "+pad(ob.getUTCDate())+pad(ob.getUTCHours())+pad(ob.getUTCMinutes())+"Z "+s.m,station:AD.wx},
    taf:{raw:"TAF "+AD.wx+" "+pad(tf.getUTCDate())+pad(tf.getUTCHours())+"00Z "+h(0)+"/"+h(24)+" "+s.t.replace("{a}",h(3)).replace("{b}",h(7)).replace("{c}",h(10)).replace("{d}",h(12)),station:AD.wx},demo:true};
}

/* ---------- horario del aeródromo (AIP: civil V 07:00 Z–ocaso, I 08:00 Z–ocaso) ---------- */
function madOff(d){ const h=+new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",hour:"numeric",hourCycle:"h23"}).format(d); return (h-d.getUTCHours()+24)%24; }
function adState(now){
  const sn=sun(now), summer=madOff(now)===2, oh=summer?7:8, op=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),oh,0));
  const st=now<op?"pre":(sn.set&&now>sn.set?"night":"open");
  return {st,open:st==="open",openAt:op,set:sn.set,rise:sn.rise,sched:summer?"V":"I"};
}

/* ---------- textos ---------- */
const NOTE={LEGT:"No hay METAR de Cuatro Vientos: se usa Getafe (LEGT), a unos 10 km", LEMD:"No hay METAR de Cuatro Vientos: se usa Madrid-Barajas (LEMD), a unos 26 km"};
const pad3=n=>String(n).padStart(3,"0");
const CATT={VFR:"Meteo VFR",MVFR:"Meteo VFR marginal",IFR:"Meteo IFR",LIFR:"Meteo IFR bajo"};
function kt(w){ if(!w) return "—"; if(w.spd===0&&!w.gst) return "Calma"; return (w.vrb?"Variable":(pad3(w.dir)+"º"))+" · "+w.spd+" kt"+(w.gst?" (rachas "+w.gst+")":"")+(w.var?" · varía "+w.var[0]+"–"+w.var[1]+"º":""); }
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
const dayZ=d=>pad(d.getUTCDate())+"/"+pad(d.getUTCMonth()+1);

/* ---------- pista en uso según el tráfico ADS-B ---------- */
function infer(list){
  const c={}, lat0=AD.lat, lon0=AD.lon; [AD.main.a,AD.main.b].forEach(r=>c[r.id]=0);
  (list||[]).forEach(a=>{
    if(a.lat==null||a.tr==null) return;
    if(!a.gnd&&(a.alt==null||a.alt>AD.elev+2500)) return;
    if(a.g==null||a.g<35||a.g>140) return;
    const y=(a.lat-lat0)*60, x=(a.lon-lon0)*60*Math.cos(lat0*RAD);   // millas náuticas al norte y al este del campo
    [AD.main.a,AD.main.b].forEach(r=>{ const h=r.hdg*RAD, al=x*Math.sin(h)+y*Math.cos(h), cr=x*Math.cos(h)-y*Math.sin(h), d=Math.abs(((a.tr-r.hdg+540)%360)-180);
      if(d<=20&&Math.abs(cr)<0.35&&Math.abs(al)<5) c[r.id]++; });   // en el eje de la pista (aproximación, recorrido o despegue); el viento en cola queda fuera
  });
  const k=Object.keys(c).sort((p,q)=>c[q]-c[p]); return c[k[0]]>0&&c[k[0]]>c[k[1]]?{id:k[0],n:c[k[0]]}:null;
}

/* ---------- mapa ---------- */
const PLANE='<svg viewBox="0 0 20 20" width="26" height="26" style="transform:rotate({r}deg)"><path d="M10 1c.9 0 1.4.9 1.4 2v4.6l7 4.2v1.8l-7-2v3.6l1.8 1.4V19L10 18l-3.2 1v-2.4l1.8-1.4v-3.6l-7 2v-1.8l7-4.2V3C8.6 1.9 9.1 1 10 1z" fill="#FFC400" stroke="#14181D" stroke-width="1.1"/></svg>';
function drawMap(act){
  const L=window.L, M=S.map; if(!L||!M) return;
  if(S.lay) S.lay.clearLayers(); else S.lay=L.layerGroup().addTo(M);
  const g=S.lay, A=AD.main;
  L.polyline([A.a.ll,A.b.ll],{color:"#FFFFFF",weight:12,opacity:.85}).addTo(g);
  L.polyline([A.a.ll,A.b.ll],{color:"#262A30",weight:8,opacity:1}).addTo(g);
  L.polyline([A.a.ll,A.b.ll],{color:"#FFFFFF",weight:1.5,opacity:.9,dashArray:"7 7"}).addTo(g);
  if(act) L.polyline([A.a.ll,A.b.ll],{color:"#FFC400",weight:16,opacity:.3}).addTo(g);
  [A.a,A.b].forEach(r=>{ const on=act&&act.id===r.id, p=off(r.ll,r.hdg+180,60);
    L.marker(p,{interactive:false,icon:L.divIcon({className:"op-lbl"+(on?" on":""),html:"<span>"+r.id+"</span>"+(on?"<em>EN USO</em>":""),iconSize:null})}).addTo(g); });
  if(act){ const mid=[(A.a.ll[0]+A.b.ll[0])/2,(A.a.ll[1]+A.b.ll[1])/2];
    L.marker(mid,{interactive:false,icon:L.divIcon({className:"op-dir",html:`<svg viewBox="0 0 60 60" width="46" height="46" style="transform:rotate(${act.hdg}deg)"><path d="M30 6 L48 40 L30 32 L12 40 Z" fill="#FFC400" stroke="#262A30" stroke-width="3" stroke-linejoin="round"/></svg>`,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(g); }
}
function drawTraffic(){
  const L=window.L, M=S.map; if(!L||!M) return; if(S.trl) S.trl.clearLayers(); else S.trl=L.layerGroup().addTo(M);
  (S.tr||[]).forEach(a=>{ if(a.lat==null) return; const alt=a.gnd?"tierra":(a.alt!=null?Math.round(a.alt/100)*100+" ft":"");
    const m=L.marker([a.lat,a.lon],{icon:L.divIcon({className:"op-ac",html:PLANE.replace("{r}",a.tr||0)+`<span><b>${esc(a.f||a.r||a.h||"")}</b>${esc(alt)}</span>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:500});
    m.bindPopup(`<b>${esc(a.f||"—")}</b> ${esc(a.r||"")}<br>${esc(a.t||"")}<br>${esc(alt)}${a.g!=null?" · "+Math.round(a.g)+" kt":""}${a.tr!=null?" · rumbo "+Math.round(a.tr)+"º":""}`); m.addTo(S.trl); });
}
function initMap(){
  const L=window.L, el=$("#opMap",S.root); if(!el) return;
  if(!L){ el.innerHTML='<p class="muted" style="padding:20px">No se ha podido cargar el mapa.</p>'; return; }
  if(S.map){ S.map.remove(); S.map=null; S.lay=null; S.trl=null; }
  const M=L.map(el,{scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false,zoomControl:true,attributionControl:true});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagen: Esri, Maxar, Earthstar Geographics · ADS-B: comunidad adsb.lol"}).addTo(M);
  L.control.scale({imperial:false,position:"bottomleft"}).addTo(M);
  const fit=()=>M.fitBounds(L.latLngBounds([AD.main.a.ll,AD.main.b.ll]),{padding:[50,50],maxZoom:15});
  fit(); S.map=M; setTimeout(()=>{ try{ M.invalidateSize(); fit(); }catch(e){} },120);
}

/* ---------- pintado ---------- */
const mark=(arr)=>arr.every(Boolean)?'<i class="m ok">✔</i>':arr.some(Boolean)?'<i class="m mid" title="Cumple solo algún avión">▲</i>':'<i class="m no">✖</i>';
function wCompass(w){ const calm=!w||(w.spd===0&&!w.gst), vr=w&&w.vrb;
  return `<svg viewBox="0 0 60 60" width="58" height="58"><circle cx="30" cy="30" r="27" fill="none" stroke="var(--ln)" stroke-width="2"/>${calm?'<text x="30" y="35" text-anchor="middle" font-size="12" font-weight="700" fill="var(--mu)">CALMA</text>':vr?'<text x="30" y="35" text-anchor="middle" font-size="14" font-weight="700" fill="var(--mu)">VRB</text>':`<g transform="rotate(${w.dir+180} 30 30)"><path d="M30 6 L40 42 L30 34 L20 42 Z" fill="var(--ink)"/></g>`}</svg>`; }
function tile(h,b,s,x,c){ return `<div class="tl ${c||""}"><small>${h}</small>${x||""}<b>${b}</b><span>${s||""}</span></div>`; }
function fill(){
  const d=S.data, R=S.root; if(!d||!R) return; const now=new Date(), e=d.m, cat=flightCat(e), st=adState(now);
  $("#opAd",R).className="ad "+(st.open?"open":"closed"); $("#opAd",R).innerHTML=st.open?`<b>AD ABIERTO</b><small>hasta el ocaso · ${fz(st.set)} Z</small>`:`<b>AD CERRADO</b><small>${st.st==="night"?"noche · ocaso "+fz(st.set)+" Z":"abre "+fz(st.openAt)+" Z"}</small>`;
  const cb=$("#opCat",R); cb.className="cat "+cat; cb.innerHTML="<b>"+cat+"</b><small>"+CATT[cat]+"</small>";
  const age=d.obs?Math.round((now-d.obs)/60000):null;
  $("#opSub",R).innerHTML=`${NOTE[d.mSt]||d.demo?`<span class="${NOTE[d.mSt]?"old":""}">${NOTE[d.mSt]||""}${d.demo?' <b class="dm">DATOS DE EJEMPLO</b>':""}</span>`:""}`+(age==null?"":`<span class="${age>75?"old":""}">${age>75?"Dato antiguo · ":"Observado "}${age<1?"ahora":"hace "+age+" min"} · ${fz(d.obs)} Z</span>`)+`<span>☀ Orto ${fz(st.rise)} Z · Ocaso ${fz(st.set)} Z</span>`;
  // fichas tipo Windy
  const ce=e.cavok?"CAVOK":e.ceil!=null?e.ceil.toLocaleString("es-ES")+" ft":((e.clouds&&e.clouds.length)?"Sin techo":"Despejado");
  $("#opTiles",R).innerHTML=tile("Viento",e.wind&&e.wind.spd===0&&!e.wind.gst?"Calma":(e.wind?(e.wind.vrb?"VRB":pad3(e.wind.dir)+"º")+" · "+e.wind.spd+" kt":"—"),e.wind&&e.wind.gst?"rachas "+e.wind.gst+" kt":(e.wind&&e.wind.var?"varía "+e.wind.var[0]+"–"+e.wind.var[1]+"º":"en superficie"),wCompass(e.wind),"wd")
   +tile("Visibilidad",visTxt(e.vis),wxTxt(e)==="Ninguno"?"sin fenómenos":wxTxt(e))
   +tile("Nubes",ce,e.cavok?"sin nubes bajas":((e.clouds||[]).map(x=>x.t+" "+(x.h/100)).join(" · ")||"—"))
   +tile("Temperatura",e.temp!=null?e.temp+" ºC":"—",e.dew!=null?"rocío "+e.dew+" ºC":"")
   +tile("QNH",e.qnh?e.qnh+" hPa":"—",e.trend?(/NOSIG/.test(e.trend)?"sin cambios (NOSIG)":esc(e.trend)):"");
  $("#opMetRaw",R).innerHTML=rawHtml(d.metar)+(/\sAUTO\s/.test(d.metar)?'<div class="auto">METAR automático: no informa de precipitación (AIP).</div>':"");
  const tp=d.tp, tl=$("#opTafSt",R); if(tl) tl.textContent=tp&&tp.station?("de "+tp.station+(tp.station==="LEMD"?" (Barajas)":"")):"";
  $("#opTafRaw",R).innerHTML=tp&&d.taf?rawHtml(d.taf):"No hay TAF disponible.";
  $("#opTafTb",R).innerHTML=tp&&tp.periods.length?`<table class="tf"><thead><tr><th>Periodo (Z)</th><th>Viento</th><th>Visib.</th><th>Nubes / tiempo</th><th></th></tr></thead><tbody>${tp.periods.map(p=>{ const q=p.e, c=flightCat(q); return `<tr><td><b>${esc(p.label)}</b>${p.rng?`<small>${esc(p.rng)}</small>`:""}</td><td>${kt(q.wind)}</td><td>${visTxt(q.vis)}</td><td>${(q.wx&&q.wx.length?q.wx.map(wxText).join(", ")+" · ":"")+(q.cavok?"CAVOK":(q.clouds&&q.clouds.length?q.clouds.map(k=>k.t+" "+(k.h/100)).join(" "):"sin nubes"))}</td><td><span class="cc ${c}">${c}</span></td></tr>`; }).join("")}</tbody></table>`:"";
  // pista en uso
  const evF=evalOne(e,"fi"), evS=evalOne(e,"solo"), w=evF.w, wind=(e.wind&&!e.wind.vrb&&Math.max(e.wind.spd,e.wind.gst||0)>=3)?w.end:null, trf=S.tr?infer(S.tr):null, act=st.open?(trf?(AD.main.a.id===trf.id?AD.main.a:AD.main.b):wind):null;
  let rt;
  if(!st.open) rt=`<div class="sign dim">—</div><div class="rt"><b>Aeródromo cerrado</b><span>${st.st==="night"?"Es de noche: el civil abre de día (orto–ocaso)":"Aún no ha abierto"}</span>${wind?`<span>Por viento sería la <b>${wind.id}</b></span>`:""}</div>`;
  else if(trf) rt=`<div class="sign">${trf.id}</div><div class="rt"><b>En uso según el tráfico</b><span>${trf.n} ${trf.n>1?"aviones alineados":"avión alineado"} con la pista (ADS-B)</span>${wind?`<span>Por viento: <b>${wind.id}</b> · cara ${Math.round(w.head)} kt · cruzado ${Math.round(w.cross)} kt</span>`:""}</div>`;
  else if(wind) rt=`<div class="sign est">${wind.id}</div><div class="rt"><b>Estimada por el viento</b><span>No hay tráfico en la pista para saber la real</span><span>${w.head>=0?"Cara":"Cola"} <b>${Math.abs(Math.round(w.head))} kt</b> · cruzado <b>${Math.round(w.cross)} kt</b>${w.side?" por la "+w.side:""}</span></div>`;
  else rt=`<div class="sign dim">—</div><div class="rt"><b>Sin pista preferente</b><span>Viento flojo o variable (menos de 3 kt)</span></div>`;
  $("#opRwy",R).innerHTML=rt; drawMap(act);
  // mínimos
  const f1=evF.ac.cz.f, f2=evS.ac.cz.f, all=(ev,k)=>Object.keys(AC).map(a=>ev.ac[a].f[k]), open=st.open;
  const cell=(ok,txt)=>`<td class="lim">${txt} ${ok}</td>`;
  const chips=ev=>Object.keys(AC).map(k=>{ const s=open?ev.ac[k].s:"no", why=open?(ev.ac[k].why.join(" · ")||"Dentro de todos los mínimos"):"Aeródromo cerrado"; return `<span class="ac ${s}" title="${esc(why)}">${AC[k].c}</span>`; }).join("");
  $("#opMin",R).innerHTML=`<table class="mn"><thead><tr><th></th><th>Ahora</th><th>Con instructor</th><th>Solo</th></tr></thead><tbody>
   <tr><th>Horario</th><td><b>${open?"Día":"Noche"}</b></td>${cell(mark([open]),"de día")}${cell(mark([open]),"de día")}</tr>
   <tr><th>Visibilidad</th><td><b>${visTxt(e.vis)}</b></td>${cell(mark([f1.vis]),"≥ 5 km")}${cell(mark([f2.vis]),"≥ 8 km")}</tr>
   <tr><th>Techo</th><td><b>${e.ceil==null?"Sin techo":e.ceil.toLocaleString("es-ES")+" ft"}</b></td>${cell(mark([f1.cig]),"≥ 1.500 ft")}${cell(mark([f2.cig]),"≥ 2.500 ft")}</tr>
   <tr><th>Viento cruzado</th><td><b>${Math.round(w.cross)} kt</b></td>${cell(mark(all(evF,"cross")),"≤ 12 · 15 · 15 kt")}${cell(mark(all(evS,"cross")),"≤ 10 · 12 · 12 kt")}</tr>
   <tr><th>Viento de cara</th><td><b>${Math.max(0,Math.round(w.head))} kt</b></td>${cell(mark([f1.head]),"≤ 20 kt")}${cell(mark([f2.head]),"≤ 20 kt")}</tr>
   <tr><th>Viento de cola</th><td><b>${Math.max(0,Math.round(-w.head))} kt</b></td>${cell(mark([f1.tail]),"≤ 5 kt")}${cell(mark([f2.tail]),"0 kt")}</tr>
   <tr><th>Temperatura</th><td><b>${e.temp!=null?e.temp+" ºC":"—"}</b></td>${cell(mark(all(evF,"temp")),"≤ 32 · 35 · 35 ºC")}${cell(mark(all(evS,"temp")),"≤ 32 ºC")}</tr>
   <tr class="res"><th>¿Se puede?</th><td></td><td>${chips(evF)}</td><td>${chips(evS)}</td></tr></tbody></table>
   <p class="nt">Límites por avión: Cruiser · C172 · Piper (SOP.4.1). El horario es el del AIP (civil). Orientativo: decide el HT o el CFI.</p>`;
  const ts=$("#opTrSt",R); if(ts) ts.textContent=S.tr?("✈ "+S.tr.length+" aviones · ADS-B · "+fz(S.trAt)+" Z"):"ADS-B no disponible";
}
function clock(){ const R=S.root; if(!R) return; const n=new Date(), z=$("#opZ",R), dd=$("#opD",R); if(z) z.textContent=pad(n.getUTCHours())+":"+pad(n.getUTCMinutes()); if(dd) dd.textContent=dayZ(n); }
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
function loadTr(){
  const f=S.opt&&S.opt.fetchTr; if(!f) return;
  f().then(r=>{ if(!r||!r.ac) throw 0; S.tr=r.ac; S.trAt=new Date(); }).catch(()=>{ S.tr=null; }).then(()=>{ if(!S.root) return; drawTraffic(); if(S.data) fill(); });
}
const CSS=`.op{--bg:#E6E9EC;--pn:#FFFFFF;--ink:#171C21;--mu:#5E6873;--ln:#D2D7DD;--hd:#1C2128;--am:#FFC400;--vfr:#1E9E44;--mvfr:#2F6FD0;--ifr:#D23A2F;--lifr:#B02FA5;--ok:#1E8A42;--no:#C9372C;--mid:#B7791F;--okb:#E3F3E8;--nob:#FBE5E3;--midb:#FFF1D6;--k1:#0B5CAD;--k2:#8A4B00;--k3:#5A3E9B;--k4:#9A2A2A;--k5:#0B7A6B;
 min-height:100%;background:var(--bg);color:var(--ink);font:15px/1.45 Barlow,system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .op{--bg:#0D1013;--pn:#161A1F;--ink:#E6E9EC;--mu:#8E98A3;--ln:#2A3037;--hd:#090B0E;--okb:#12301E;--nob:#3A1917;--midb:#33290F;--ok:#4CC97A;--no:#F0746B;--mid:#E3B341;--k1:#6CB4FF;--k2:#E9A95B;--k3:#B7A2F2;--k4:#F08E8E;--k5:#5CD1BE}}
:root[data-theme="dark"] .op{--bg:#0D1013;--pn:#161A1F;--ink:#E6E9EC;--mu:#8E98A3;--ln:#2A3037;--hd:#090B0E;--okb:#12301E;--nob:#3A1917;--midb:#33290F;--ok:#4CC97A;--no:#F0746B;--mid:#E3B341;--k1:#6CB4FF;--k2:#E9A95B;--k3:#B7A2F2;--k4:#F08E8E;--k5:#5CD1BE}
.op *{box-sizing:border-box}.op .muted{color:var(--mu)}.op a{color:var(--k1)}
.op-top{background:var(--hd);color:#fff;display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;padding:12px max(16px,env(safe-area-inset-right,0px)) 12px max(16px,env(safe-area-inset-left,0px))}
.op-top .id b{display:block;font:700 40px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.04em}.op-top .id span{color:#9AA5B1;font-size:14px}
.cat,.ad{display:flex;flex-direction:column;border-radius:6px;padding:4px 12px;background:var(--vfr);color:#fff;min-width:120px}.cat b,.ad b{font:700 22px/1.1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.06em}.cat small,.ad small{font:600 12px Barlow,sans-serif;letter-spacing:.03em;opacity:.95}
.cat.MVFR{background:var(--mvfr)}.cat.IFR{background:var(--ifr)}.cat.LIFR{background:var(--lifr)}
.ad.open{background:#2D3640;border:1px solid #4B5663}.ad.closed{background:#8E1B1B;border:1px solid #D45A5A}
.op-top .tm{margin-left:auto;text-align:right}.op-top .tm small{display:block;font:600 11px Barlow,sans-serif;letter-spacing:.14em;color:#9AA5B1}.op-top .tm b{font:600 34px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.05em;font-variant-numeric:tabular-nums;color:var(--am)}.op-top .tm b i{font-style:normal;font-size:18px;color:#fff;margin-left:4px}
.op-sub{display:flex;flex-wrap:wrap;gap:4px 22px;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));background:var(--pn);border-bottom:1px solid var(--ln);font-size:14px;color:var(--mu)}.op-sub .old{color:var(--no);font-weight:600}.op-sub .dm{color:var(--mid)}
.op-err{margin:12px max(16px,env(safe-area-inset-left,0px)) 0;padding:10px 14px;border:1px solid var(--no);background:var(--nob);border-radius:6px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}.op-err[hidden]{display:none!important}.op-err a,.op-err button{font:600 14px Barlow,sans-serif;color:var(--ink);border:1px solid var(--ink);background:transparent;border-radius:6px;padding:6px 12px;text-decoration:none;cursor:pointer}
.op-in{max-width:1240px;margin:0 auto;padding:14px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px));display:grid;gap:14px}
.op-hero{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
@media (min-width:980px){.op-hero{grid-template-columns:minmax(0,2fr) minmax(300px,1fr)}.op-two{grid-template-columns:1fr 1fr!important}}
.pn{background:var(--pn);border:1px solid var(--ln);border-radius:8px;min-width:0}
.pn>h2{margin:0;padding:10px 14px;border-bottom:1px solid var(--ln);font:700 16px/1.2 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mu);display:flex;justify-content:space-between;gap:8px}
.pn>h2 small{font:600 12px Barlow,sans-serif;letter-spacing:.04em;text-transform:none}.pn .bd{padding:12px 14px}
.tiles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:12px}
.tl{border:1px solid var(--ln);border-radius:8px;padding:10px 12px;display:grid;gap:2px;align-content:start;position:relative;min-height:92px}.tl small{font:600 12px Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mu)}.tl b{font:700 26px/1.1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.02em}.tl span{font-size:13px;color:var(--mu)}.tl svg{position:absolute;right:10px;top:10px}.tl.wd{grid-column:span 2}.tl.wd b{font-size:30px}.tl.wd svg{width:64px;height:64px;top:12px;right:14px}
.fq{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0;font-size:14.5px}.fq dt{color:var(--mu)}.fq dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.sign.sm{display:inline-block;font-size:26px;min-width:0;padding:5px 10px;outline-offset:-5px;border-radius:5px}.tbl.rw th{text-transform:none;letter-spacing:0;font:600 14.5px Barlow,sans-serif;color:var(--mu)}.tbl.rw thead th{text-align:left}.tbl.rw td{font-weight:600}
.op-map{overflow:hidden;position:relative}#opMap{height:clamp(340px,62vh,580px);background:#2B3138}
.op-lbl{white-space:nowrap}.op-lbl span{display:inline-block;transform:translate(-50%,-50%);background:#14181D;color:#fff;font:700 15px/1 Barlow,sans-serif;border:2px solid #fff;border-radius:5px;padding:3px 7px}
.op-lbl.on span{background:var(--am);color:#14181D;border-color:#14181D;font-size:17px}.op-lbl em{position:absolute;left:0;top:16px;transform:translateX(-50%);font:700 11px Barlow,sans-serif;font-style:normal;letter-spacing:.08em;background:#14181D;color:var(--am);padding:2px 6px;border-radius:4px}
.op-dir svg{filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}
.op-ac{position:relative}.op-ac svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}.op-ac span{position:absolute;left:24px;top:2px;white-space:nowrap;font:600 11px/1.15 Barlow,sans-serif;color:#fff;background:rgba(20,24,29,.82);border-radius:3px;padding:1px 4px}.op-ac span b{display:block;font-size:12px}
.leaflet-container{font-family:Barlow,system-ui,sans-serif}
.op-side{display:grid;gap:14px;align-content:start}
.rwy{display:flex;gap:14px;align-items:center}.sign{background:#000;color:#FFD100;font:700 52px/1 "Barlow Condensed",Arial,sans-serif;letter-spacing:.04em;padding:8px 18px;border-radius:6px;outline:2px solid #FFD100;outline-offset:-7px;min-width:88px;text-align:center}.sign.est{color:#C9B13A;outline-color:#C9B13A;outline-style:dashed}.sign.dim{color:#665400;outline-color:#665400}
.rt{display:grid;gap:2px;font-size:14.5px}.rt b{font-size:16px}
.tbl{width:100%;border-collapse:collapse;font-size:14.5px}.tbl th,.tbl td{text-align:left;padding:6px 6px;border-bottom:1px solid var(--ln)}.tbl th{font:600 12px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}.tbl tr:last-child td{border-bottom:0}
.src{margin:8px 0 0;font-size:12.5px;color:var(--mu)}.hs{font:700 13px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);margin:14px 0 4px}
.op-two{display:grid;gap:14px;grid-template-columns:1fr}
.raw{font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere;padding:10px 12px;border:1px solid var(--ln);border-radius:6px;background:var(--bg);margin-bottom:10px}.raw .auto{font:13px Barlow,sans-serif;color:var(--mu);margin-top:4px}
.raw .k{border-bottom:2px solid;cursor:help}.k.w{color:var(--k1);border-color:var(--k1)}.k.v{color:var(--k2);border-color:var(--k2)}.k.c{color:var(--k3);border-color:var(--k3)}.k.t{color:var(--k5);border-color:var(--k5)}.k.q{color:var(--k4);border-color:var(--k4)}.k.x{color:var(--k4);border-color:var(--k4)}
table.tf,table.mn{width:100%;border-collapse:collapse;font-size:14.5px}.tf th,.mn th{font:600 12px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);text-align:left;padding:5px 8px}.tf td,.mn td,.mn tbody th{padding:8px;border-top:1px solid var(--ln);vertical-align:top;text-align:left}.tf td small{display:block;color:var(--mu)}
.mn tbody th{font:600 15px Barlow,sans-serif;text-transform:none;letter-spacing:0;color:var(--ink)}
.cc{display:inline-block;font:700 12px Barlow,sans-serif;letter-spacing:.04em;color:#fff;border-radius:4px;padding:2px 7px;background:var(--vfr)}.cc.MVFR{background:var(--mvfr)}.cc.IFR{background:var(--ifr)}.cc.LIFR{background:var(--lifr)}
.m{font-style:normal;font-weight:700;margin-left:4px}.m.ok{color:var(--ok)}.m.no{color:var(--no)}.m.mid{color:var(--mid)}
.mn td.lim{color:var(--mu)}.mn tr.res td{padding-top:10px}.ac{display:inline-block;font:700 12.5px Barlow,sans-serif;border-radius:4px;padding:3px 8px;margin:2px 4px 2px 0;border:1px solid}.ac.ok{color:var(--ok);background:var(--okb);border-color:var(--ok)}.ac.warn{color:var(--mid);background:var(--midb);border-color:var(--mid)}.ac.no{color:var(--no);background:var(--nob);border-color:var(--no)}
.nt{margin:10px 0 0;font-size:13px;color:var(--mu)}
.st{font:600 12px Barlow,sans-serif;border-radius:4px;padding:2px 6px;white-space:nowrap}.st.ok{color:var(--ok);background:var(--okb)}.st.no{color:var(--no);background:var(--nob)}.st.mid{color:var(--mid);background:var(--midb)}
.op-wy{position:relative;height:clamp(380px,60vh,560px);background:#2B3138}.op-wy iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.lk{display:flex;flex-wrap:wrap;gap:8px}.lk a{font:600 14.5px Barlow,sans-serif;color:var(--ink)!important;text-decoration:none;border:1px solid var(--ln);border-radius:6px;padding:8px 12px;background:var(--pn)}.lk a:hover{border-color:var(--ink)}
.op-note{font-size:13px;color:var(--mu);padding:0 2px}.op-note b{color:var(--ink)}
@media (max-width:560px){.op-top{display:grid;grid-template-columns:1fr 1fr;gap:10px}.op-top .id{grid-column:1}.op-top .tm{grid-column:2;grid-row:1;margin:0;justify-self:end}.op-top .ad,.op-top .cat{min-width:0}.tiles{grid-template-columns:1fr 1fr}.pn>h2{font-size:15px}.op-lbl span{font-size:13px}.tf,.mn,.tbl{font-size:13px!important}.tf td,.mn td,.mn tbody th,.tbl td{padding:6px 4px!important}.tf th,.mn th{padding:4px!important}.op-top .id b{font-size:32px}.op-top .tm{margin-left:0}.sign{font-size:44px}}`;
const FQ=[["TWR","118.705","Torre","ok"],["GND (GMC)","121.805","Rodaje","ok"],["ATIS","118.230","Información","ok"],["Emergencia","121.500","H24","ok"],["TWR (reserva)","122.505","Back-up","ok"]];
function render(el,opt){
  S.opt=opt||{}; S.root=el; S.tr=null; S.trAt=null;
  const A=AD.main, wy="https://embed.windy.com/embed2.html?lat=40.37&lon=-3.785&detailLat=40.37&detailLon=-3.785&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=true&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1";
  el.innerHTML=`<style>${CSS}</style><div class="op">
   <header class="op-top"><div class="id"><b>${AD.icao}</b><span>${AD.name}</span></div><div class="ad closed" id="opAd"><b>AD</b><small>…</small></div><div class="cat" id="opCat"><b>—</b><small>cargando</small></div><div class="tm"><small>HORA UTC (Z)</small><div><b id="opZ">--:--</b><b><i id="opD"></i></b></div></div></header>
   <div class="op-sub" id="opSub"><span>Cargando METAR y TAF…</span></div>
   <div class="op-err" id="opErr" hidden><span><b>No se han podido cargar el METAR y el TAF.</b> Consulta la AEMET.</span><a target="_blank" rel="noopener" href="https://ama.aemet.es/">AEMET</a>${S.opt.allowDemo?'<button type="button" id="opDemo">Ver con datos de ejemplo</button>':""}</div>
   <div class="op-in">
    <section class="pn"><h2>Tiempo <small>METAR y TAF · hora Z</small></h2><div class="bd"><div class="tiles" id="opTiles"></div>
     <div class="op-two"><div><div class="hs">METAR <span id="opMetSt"></span></div><div class="raw" id="opMetRaw"></div></div><div><div class="hs">TAF <span id="opTafSt"></span></div><div class="raw" id="opTafRaw"></div></div></div>
     <div id="opTafTb"></div></div></section>
    <div class="op-hero">
     <section class="pn op-map"><h2>Cuatro Vientos <small id="opTrSt">tráfico ADS-B…</small></h2><div id="opMap"></div></section>
     <aside class="op-side">
      <section class="pn"><h2>Pista en uso</h2><div class="bd"><div class="rwy" id="opRwy"></div><p class="src">La pista real la fija la torre o el ATIS (118.230). Aquí se deduce del tráfico ADS-B en vivo y, si no hay, del viento.</p></div></section>
      <section class="pn"><h2>Horario del AD <small>AIP</small></h2><div class="bd"><dl class="fq"><dt>Civil, invierno</dt><dd>08:00 Z – ocaso</dd><dt>Civil, verano</dt><dd>07:00 Z – ocaso</dd></dl><p class="src">Cerrado el primer domingo de cada mes por exhibición aérea (salvo enero y agosto). Militar: lunes a viernes, de orto a ocaso.</p></div></section>
     </aside>
    </div>
    <section class="pn"><h2>Pista ${A.id} <small>AIP AD 2-LECU/LEVS</small></h2><div class="bd">
     <table class="tbl rw"><thead><tr><th></th><th><span class="sign sm">${A.a.id}</span></th><th><span class="sign sm">${A.b.id}</span></th></tr></thead><tbody>
      <tr><th>Rumbo magnético</th><td>${A.a.hdg}º</td><td>${A.b.hdg}º</td></tr>
      <tr><th>Elevación del umbral</th><td>${A.a.el} ft</td><td>${A.b.el} ft</td></tr>
      <tr><th>Zona de parada</th><td>${A.a.swy} m</td><td>${A.b.swy} m</td></tr>
      <tr><th>Medidas</th><td colspan="2">${A.len.toLocaleString("es-ES")} × ${A.wid} m</td></tr>
      <tr><th>Superficie</th><td colspan="2">Asfalto (${A.surf}) · PCN ${A.pcn}</td></tr>
      <tr><th>Franja</th><td colspan="2">${A.strip} m</td></tr></tbody></table>
     <div class="hs">Distancias declaradas (m)</div>
     <table class="tbl"><thead><tr><th>Pista</th><th>TORA</th><th>TODA</th><th>ASDA</th><th>LDA</th></tr></thead><tbody>
      <tr><td><b>${A.a.id}</b></td><td>${A.a.tora}</td><td>${A.a.toda}</td><td>${A.a.asda}</td><td>${A.a.lda}</td></tr>
      <tr><td><b>${A.b.id}</b></td><td>${A.b.tora}</td><td>${A.b.toda}</td><td>${A.b.asda}</td><td>${A.b.lda}</td></tr>
      <tr><td>09 desde K-1</td><td>1278</td><td>1278</td><td>1332</td><td>–</td></tr></tbody></table>
     <p class="src">Elevación del aeródromo 2.269 ft. La pista de tierra paralela está cerrada al tráfico civil.</p>
     <div class="lk" style="margin-top:10px"><a target="_blank" rel="noopener" href="https://aip.enaire.es/AIP/#LECU/LEVS">Cartas AIP (ADC, rodaje, VAC)</a><a target="_blank" rel="noopener" href="https://aip.enaire.es/aip/contenido_AIP/AD/AD2/LECU_LEVS/LE_AD_2_LECU_LEVS_en.pdf">AIP LECU/LEVS en PDF</a><a target="_blank" rel="noopener" href="https://aip.aero/es/en/vfr/?LECU=">Cartas VFR (aip.aero)</a></div></div></section>
    <section class="pn"><h2>Frecuencias <small>AIP</small></h2><div class="bd"><table class="tbl"><tbody>${FQ.map(f=>`<tr><td>${f[0]}</td><td><b>${f[1]}</b></td><td class="muted">${f[2]}</td></tr>`).join("")}</tbody></table>
</div></section>
    <section class="pn"><h2>Mínimos de la escuela <small>SOP.4.1 + horario AIP</small></h2><div class="bd" id="opMin"></div></section>
    <section class="pn"><h2>Viento y tiempo <small>Windy</small></h2><div class="op-wy"><iframe title="Mapa de viento Windy" src="${wy}" referrerpolicy="no-referrer" allow="fullscreen"></iframe></div><div class="bd"><span class="muted">¿No carga? </span><a href="https://www.windy.com/40.37/-3.785?wind,8" target="_blank" rel="noopener">Abrir en Windy</a></div></section>
    <section class="pn"><h2>Enlaces</h2><div class="bd lk"><a target="_blank" rel="noopener" href="https://www.flightradar24.com/40.37,-3.79/12">FlightRadar24</a><a target="_blank" rel="noopener" href="https://globe.adsbexchange.com/?lat=40.37&lon=-3.785&zoom=11">ADS-B Exchange</a><a target="_blank" rel="noopener" href="https://ama.aemet.es/">AEMET · METAR y TAF oficiales</a><a target="_blank" rel="noopener" href="https://insignia.enaire.es/">NOTAM · ENAIRE</a></div></section>
    <p class="op-note"><b>Herramienta de estudio.</b> No sirve para planificar ni decidir un vuelo real: la fuente oficial es la AEMET (meteo), el AIS de ENAIRE (NOTAM y cartas) y tu instructor. La pista en uso y los mínimos del día los confirma OPS. Todas las horas, en UTC (Z).</p>
   </div></div>`;
  el.addEventListener("click",ev=>{ const b=ev.target.closest("#opDemo"); if(b){ S.opt.fetchWx=null; setData(demoData(S.scen)); } });
  initMap(); load(); loadTr(); clock();
  clearInterval(S.clk); S.clk=setInterval(clock,10000); clearInterval(S.t); S.t=setInterval(()=>{ if(S.opt.fetchWx) load(); else if(S.data) fill(); },5*60000);
  clearInterval(S.tt); S.tt=setInterval(loadTr,12000);
}
function leave(){ clearInterval(S.clk); clearInterval(S.t); clearInterval(S.tt); try{ if(S.map) S.map.remove(); }catch(e){} S.map=null; S.lay=null; S.trl=null; S.root=null; }
window.F0Ops={render,leave,_t:{parseMetar,parseTaf,evalOne,sun,windOn,wxText,flightCat,infer,adState}};
})();
