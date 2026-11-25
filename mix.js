/* Repaso y examen desde la portada: ⚡ Flash-Check visual, 🎯 Simulacro Global y 📋 Fórmulas y velocidades V.
   El Simulacro Global usa s/mixbank.json (banco extraído de las páginas de cada asignatura) y guarda el resultado en el progreso de cada una,
   así los fallos entran en «Repasar hoy» y en «Solo fallos». */
(function(){
"use strict";
const $=s=>document.querySelector(s), esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuf=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const pick=a=>a[Math.floor(Math.random()*a.length)];
const CSS=`
.mxbar{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 12px}
.mxbar button{display:inline-flex;gap:7px;align-items:center;min-height:36px;padding:6px 14px 6px 10px;border-radius:999px;border:1px solid var(--line);background:var(--paper);color:var(--ink);cursor:pointer;font:inherit;line-height:1}
.mxbar button:hover{border-color:var(--accent)}
.mxbar .ic{font-size:17px;line-height:1}
.mxbar b{font:700 14px/1 var(--display);letter-spacing:.03em;white-space:nowrap}
.mxbar .sh{display:none}
@media (max-width:560px){
 .mxbar{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 10px}
 .mxbar button{flex-direction:column;gap:3px;min-height:0;padding:7px 2px 6px;border-radius:10px;justify-content:center}
 .mxbar .ic{font-size:18px}
 .mxbar b{font-size:12px;letter-spacing:.02em}
 .mxbar .lg{display:none} .mxbar .sh{display:inline}
}
.mx{position:fixed;inset:0;z-index:9000;background:rgba(6,14,22,.62);display:flex;align-items:flex-start;justify-content:center;padding:max(10px,env(safe-area-inset-top,0px)) 10px 10px;overflow-y:auto;-webkit-overflow-scrolling:touch}
.mxp{width:min(860px,100%);background:var(--paper);color:var(--ink);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden;margin:min(5vh,36px) 0 24px}
.mxh{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--head);color:#fff}
.mxh b{font:700 20px/1.1 var(--display);letter-spacing:.03em;flex:1}
.mxh .mxt{font:700 15px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#ffd24d}
.mxh button{background:transparent;border:1px solid rgba(255,255,255,.35);color:#fff;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit}
.mxb{padding:14px 16px 18px}
.mxb .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
.mxb .btn2{font:700 14px/1.2 var(--body);padding:10px 14px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
.mxb .btn2.pri{background:var(--accent);border-color:var(--accent);color:#fff}
.mxb .btn2[aria-pressed=true]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.mxb .opt{display:block;width:100%;text-align:left;margin:7px 0;padding:11px 13px;border-radius:10px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);font:500 15.5px/1.35 var(--body);cursor:pointer}
.mxb .opt:hover{border-color:var(--accent)}
.mxb .opt.sel{border-color:var(--accent);background:var(--accentbg)}
.mxb .opt.ok{border-color:var(--ok);background:var(--okbg)}
.mxb .opt.bad{border-color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,transparent)}
.mxb .qt{font:600 17px/1.4 var(--body);margin:6px 0 10px}
.mxb .chip{display:inline-block;font:700 11px/1 var(--display);letter-spacing:.1em;text-transform:uppercase;padding:4px 8px;border-radius:20px;background:var(--bluebg);color:var(--blue)}
.mxb .exp{margin:10px 0 0;padding:9px 12px;border-left:3px solid var(--accent);background:var(--accentbg);border-radius:4px;font-size:14.5px;line-height:1.45}
.mxb .bar{height:8px;border-radius:5px;background:var(--line);overflow:hidden}
.mxb .bar i{display:block;height:100%;background:var(--accent)}
.mxb .vis{background:#0f1b29;border-radius:10px;overflow:hidden;margin:4px 0 8px}
.mxb .vis svg{display:block;width:100%;height:auto;max-height:260px}
.mxb .prog{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0 10px}
.mxb .prog i{width:12px;height:12px;border-radius:3px;background:var(--line);cursor:pointer}
.mxb .prog i.a{background:var(--blue)} .mxb .prog i.c{outline:2px solid var(--ink)}
.mxb table{width:100%;border-collapse:collapse;font-size:14px}
.mxb th,.mxb td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
.mxb th{font:700 12px/1.2 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.mxb .scroll{overflow-x:auto}
.mxb .sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:6px;border:1px solid rgba(0,0,0,.2)}
.mxb input[type=search]{width:100%;font:500 16px var(--body);padding:11px 13px;border-radius:10px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);box-sizing:border-box}
.mxb mark{background:#ffe27a;color:#14304A;border-radius:2px}
.mxb .big{font:800 44px/1 var(--display)}
.mxb .muted{color:var(--muted)}
.mxb details{margin:6px 0} .mxb summary{cursor:pointer;font-weight:700}
@media (max-width:560px){ .mxb .qt{font-size:16px} .mxh b{font-size:17px}
 .mxb table.cards tr:first-child{display:none} .mxb table.cards tr{display:block;padding:9px 0;border-bottom:1px solid var(--line)} .mxb table.cards td{display:block;border:0;padding:2px 0} .mxb table.cards td:first-child{font-size:15.5px} .mxb table.cards td[data-l]::before{content:attr(data-l) " · ";font:700 11px/1 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)} }
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);

/* ---------- ventana ---------- */
let OV=null, onClose=null;
function open(title,html,cb){ close(); OV=document.createElement("div"); OV.className="mx"; OV.setAttribute("role","dialog"); OV.setAttribute("aria-modal","true"); OV.setAttribute("aria-label",title);
  OV.innerHTML=`<div class="mxp"><div class="mxh"><b>${title}</b><span class="mxt" data-clock></span><button type="button" data-x aria-label="Cerrar">✕</button></div><div class="mxb">${html}</div></div>`;
  document.body.appendChild(OV); document.documentElement.style.overflow="hidden"; OV.querySelector("[data-x]").addEventListener("click",()=>close()); OV.addEventListener("click",e=>{ if(e.target===OV) close(); }); onClose=cb||null; OV.querySelector("[data-x]").focus(); return OV.querySelector(".mxb"); }
function close(){ if(!OV) return; if(onClose){ try{ onClose(); }catch(e){} } OV.remove(); OV=null; onClose=null; document.documentElement.style.overflow=""; }
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&OV) close(); });
const clock=t=>{ if(OV){ const c=OV.querySelector("[data-clock]"); if(c) c.textContent=t; } };
const mmss=s=>{ s=Math.max(0,Math.round(s)); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };

/* =====================================================================
   ⚡ FLASH-CHECK VISUAL: 10 preguntas con imagen, de las láminas interactivas
   ===================================================================== */
const SVG=(w,h,inner)=>`<svg viewBox="0 0 ${w} ${h}" role="img" font-family="system-ui,sans-serif">${inner}</svg>`;
const glow=(x,y,c,r)=>`<circle cx="${x}" cy="${y}" r="${r*3}" fill="${c}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${r*1.6}" fill="${c}" opacity=".45"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x}" cy="${y}" r="${r*.75}" fill="${c}"/>`;
const night=(inner)=>SVG(400,200,`<rect width="400" height="200" fill="#060b16"/>${Array.from({length:40},(_,i)=>`<rect x="${(i*97)%400}" y="${(i*53)%130}" width="1.4" height="1.4" fill="#fff" opacity="${.3+(i%5)/8}"/>`).join("")}<rect y="150" width="400" height="50" fill="#0b1118"/><path d="M0 200 L0 175 Q200 150 400 175 L400 200z" fill="#141b24"/>${inner}`);
const GEN={
  lights(){ const S=pick([
     {pos:"delante de ti",l:[[180,"#2bd96b"],[220,"#ff3b3b"]],a:"Los dos alteramos el rumbo a la derecha",e:"Ves <b>verde a tu izquierda y roja a tu derecha</b>: viene de frente. SERA.3210: los dos viráis a la <b>derecha</b>."},
     {pos:"a tu derecha",l:[[300,"#ff3b3b"]],a:"Cedo el paso: está a mi derecha",e:"Solo su <b>roja</b>: te enseña su costado izquierdo y cruza de tu derecha a tu izquierda. Cede quien tiene al otro a su derecha: <b>tú</b>."},
     {pos:"a tu izquierda",l:[[100,"#2bd96b"]],a:"Mantengo rumbo y velocidad: tengo preferencia",e:"Solo su <b>verde</b>: viene por tu izquierda y te tiene a su derecha, así que cede él. Tú mantienes rumbo y velocidad, vigilando."},
     {pos:"delante, a tu misma altura y cada vez más cerca",l:[[200,"#ffffff"]],a:"Lo estoy alcanzando: me aparto a la derecha y lo adelanto por su derecha",e:"Solo su <b>blanca de cola</b>: estás detrás, en su sector de 140°. El que alcanza cede y adelanta por la <b>derecha</b>."}]);
    const O=["Los dos alteramos el rumbo a la derecha","Cedo el paso: está a mi derecha","Mantengo rumbo y velocidad: tengo preferencia","Lo estoy alcanzando: me aparto a la derecha y lo adelanto por su derecha"];
    return {cat:"Luces · SERA.3210",svg:night(S.l.map(([x,c])=>glow(x,110,c,5)).join("")+`<text x="10" y="22" fill="#ffd24d" font-size="13" font-weight="700">De noche, misma altura · ${S.pos}</text>`),q:"¿Qué manda el reglamento?",o:[S.a,...shuf(O.filter(x=>x!==S.a)).slice(0,2)],e:S.e,go:"010"}; },
  pitot(){ const S=pick([
     {t:"Subes de 2.000 a 5.000 ft con la velocidad real constante.",r:[["ASI","100 → 125 kt","#ff8a80"],["ALT","2.000 → 5.000","#6ee7a0"],["VSI","+500 ft/min","#6ee7a0"]],a:"Pitot y su drenaje obstruidos",e:"Con el pitot (y su drenaje) tapado, el ASI se comporta como un <b>altímetro</b>: marca de más al subir. Altímetro y VSI siguen bien porque usan la estática."},
     {t:"Subes de 2.000 a 5.000 ft con la velocidad real constante.",r:[["ASI","100 → 85 kt","#ff8a80"],["ALT","fijo en 2.000","#ff8a80"],["VSI","0 ft/min","#ff8a80"]],a:"Toma estática obstruida",e:"Estática tapada: el altímetro se <b>congela</b>, el VSI se queda a <b>cero</b> y el ASI marca de <b>menos</b> al subir (de más al bajar)."},
     {t:"Bajas de 6.000 a 3.000 ft con la velocidad real constante.",r:[["ASI","110 → 125 kt","#ff8a80"],["ALT","fijo en 6.000","#ff8a80"],["VSI","0 ft/min","#ff8a80"]],a:"Toma estática obstruida",e:"En descenso con la estática tapada el ASI marca de <b>más</b>: riesgo de volar más lento de lo que crees… o de pasarte si te fías de él."},
     {t:"En crucero nivelado seleccionas la estática alternativa (cabina sin presurizar).",r:[["ASI","marca algo más","#ffd24d"],["ALT","marca algo más","#ffd24d"],["VSI","sube un momento","#ffd24d"]],a:"Es normal: en la cabina la presión es algo menor",e:"La presión en la cabina es algo <b>menor</b> que la exterior: altímetro y ASI marcan un poco <b>de más</b> y el VSI da un salto de ascenso momentáneo."}]);
    const O=["Pitot y su drenaje obstruidos","Toma estática obstruida","Es normal: en la cabina la presión es algo menor","Fallo del giróscopo del horizonte"];
    const box=(i,[n,v,c])=>`<g transform="translate(${18+i*128} 60)"><rect width="116" height="84" rx="10" fill="#16283b" stroke="#3a516b"/><text x="58" y="26" fill="#8fa3b8" font-size="13" font-weight="700" text-anchor="middle">${n}</text><text x="58" y="58" fill="${c}" font-size="13.5" font-weight="700" text-anchor="middle">${v}</text></g>`;
    return {cat:"Pitot-estática",svg:SVG(400,170,`<rect width="400" height="170" fill="#0f1b29"/><text x="14" y="30" fill="#e9f0f7" font-size="13">${esc(S.t)}</text>${S.r.map((r,i)=>box(i,r)).join("")}`),q:"¿Qué está pasando?",o:[S.a,...shuf(O.filter(x=>x!==S.a)).slice(0,2)],e:S.e,go:"021"}; },
  cdi(){ const S=pick([
     {obs:"090",flag:"TO",n:-1,g:null,a:"Al oeste de la estación y al sur de su radial 270",o2:["Al oeste de la estación y al norte de su radial 270","Al este de la estación y al sur de su radial 090"],e:"OBS 090 con <b>TO</b>: estás en el lado oeste (vas hacia la estación). La aguja a la <b>izquierda</b> dice que la línea del curso queda a tu izquierda (al norte): estás <b>al sur</b>."},
     {obs:"090",flag:"FROM",n:1,g:null,a:"Al este de la estación y al norte de su radial 090",o2:["Al este de la estación y al sur de su radial 090","Al oeste de la estación y al norte de su radial 270"],e:"OBS 090 con <b>FROM</b>: ya has pasado la estación, estás al este. Aguja a la <b>derecha</b>: el curso queda a tu derecha (al sur), así que estás <b>al norte</b>."},
     {obs:"ILS",flag:"",n:-1,g:1,a:"A la derecha del localizador y por encima de la senda",o2:["A la izquierda del localizador y por debajo de la senda","A la derecha del localizador y por debajo de la senda"],e:"«Vuela hacia las agujas»: localizador a la <b>izquierda</b> = el eje está a tu izquierda (estás a la derecha). Senda <b>abajo</b> = la senda está por debajo (estás alto)."},
     {obs:"ILS",flag:"",n:1,g:-1,a:"A la izquierda del localizador y por debajo de la senda",o2:["A la derecha del localizador y por encima de la senda","A la izquierda del localizador y por encima de la senda"],e:"Localizador a la <b>derecha</b>: el eje queda a tu derecha (estás a la izquierda). Senda <b>arriba</b>: estás por <b>debajo</b>; no bajes hasta interceptarla."}]);
    const cx=200, cy=100, r=78, s=24; const dots=[-2,-1,1,2].map(i=>`<circle cx="${cx+i*s}" cy="${cy}" r="3.4" fill="#cfd8e3"/>`+(S.g!=null?`<circle cx="${cx}" cy="${cy+i*s}" r="3.4" fill="#cfd8e3"/>`:"")).join("");
    const nx=cx+S.n*s*1.6, gy=S.g!=null?cy+S.g*s*1.4:null;
    return {cat:S.obs==="ILS"?"ILS":"VOR",svg:SVG(400,200,`<rect width="400" height="200" fill="#0f1b29"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0b1420" stroke="#5d6f84" stroke-width="3"/>${dots}<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#cfd8e3"/><line x1="${nx}" y1="${cy-r*.8}" x2="${nx}" y2="${cy+r*.8}" stroke="#ffd24d" stroke-width="4"/>${gy!=null?`<line x1="${cx-r*.8}" y1="${gy}" x2="${cx+r*.8}" y2="${gy}" stroke="#6ee7a0" stroke-width="4"/>`:""}<text x="${cx}" y="${cy-r*.55}" fill="#8fa3b8" font-size="12" font-weight="700" text-anchor="middle">${S.obs==="ILS"?"ILS · pista 09":"OBS "+S.obs}</text>${S.flag?`<text x="${cx+40}" y="${cy+44}" fill="#fff" font-size="13" font-weight="800">${S.flag}</text>`:""}`),q:S.obs==="ILS"?"Vas en final con rumbo de pista. ¿Dónde estás?":"Vuelas con rumbo 090. ¿Dónde estás?",o:[S.a,...S.o2],e:S.e,go:"061"}; },
  radio(){ const P=[["Viento en cola","E-YZ, downwind."],["Final","E-YZ, final."],["Pista libre","E-YZ, runway vacated."],["Entrada por N","Example Tower, EC-XYZ, over November, 2 000 feet, information Bravo, for landing."]]; const i=Math.floor(Math.random()*P.length), S=P[i];
    const XY=[[200,40],[330,150],[100,175],[50,40]], c=XY[i];
    const svg=SVG(400,200,`<rect width="400" height="200" fill="#2f4a2a"/><rect x="80" y="158" width="230" height="14" fill="#3c4046"/><path d="M200 40 H322 Q340 40 340 58 V140 Q340 150 322 150 H300" fill="none" stroke="#ffd24d" stroke-width="2.5"/><path d="M50 40 L200 40" stroke="#9fe0ff" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${c[0]}" cy="${c[1]}" r="12" fill="#ffd24d"/><text x="${c[0]}" y="${c[1]+4}" text-anchor="middle" font-weight="800" fill="#12202f">▲</text><text x="12" y="22" fill="#fff" font-size="13" font-weight="700">Circuito derecha · pista 27 · ¿qué dices aquí?</text>`);
    return {cat:"Radio · circuito VFR",svg,q:"Estás en el punto marcado (▲). ¿Qué llamada haces?",o:[S[1],...shuf(P.filter((p,j)=>j!==i).map(p=>p[1])).slice(0,2)],e:`En ${S[0].toLowerCase()} la llamada estándar es «${esc(S[1])}». Recuerda: el indicativo completo solo en el primer contacto; abrevias (E-YZ) cuando la torre lo haya hecho.`,go:"090"}; },
  wake(){ const L=Math.random()<.5; const svg=SVG(400,180,`<rect width="400" height="180" fill="#9fbad3"/><rect y="150" width="400" height="30" fill="#7d9a5b"/><rect x="${L?210:40}" y="146" width="${L?180:200}" height="6" fill="#3c4046"/>
      ${L?`<path fill="none" d="M10 50 L250 148" stroke="#ff6b6b" stroke-width="3" stroke-dasharray="7 5"/><path fill="none" d="M10 34 L300 148" stroke="#6ee7a0" stroke-width="3"/><path fill="none" d="M10 70 L228 148" stroke="#3a6dd8" stroke-width="3"/><text x="250" y="140" font-size="11" fill="#7a1f1f" font-weight="700">toma del heavy</text>`
         :`<path fill="none" d="M40 148 L180 148 L390 60" stroke="#ff6b6b" stroke-width="3" stroke-dasharray="7 5"/><path fill="none" d="M40 148 L120 148 L390 30" stroke="#6ee7a0" stroke-width="3"/><path fill="none" d="M40 148 L240 148 L390 100" stroke="#3a6dd8" stroke-width="3"/><text x="160" y="140" font-size="11" fill="#7a1f1f" font-weight="700">rotación del heavy</text>`}
      <text x="12" y="20" font-size="13" font-weight="700" fill="#14304A">${L?"Aterrizas detrás de un heavy (rojo)":"Despegas detrás de un heavy (rojo)"} · ¿verde o azul?</text>`);
    return {cat:"Estela turbulenta",svg,q:L?"¿Qué trayectoria evita su estela?":"¿Qué trayectoria evita su estela?",o:L?["La verde: por encima de su senda y tomando más allá","La azul: por debajo y tomando antes","Cualquiera: la estela sube"]:["La verde: rotar antes de su punto de rotación y subir por encima","La azul: rotar después y quedarse por debajo","Cualquiera: la estela se disipa al instante"],e:L?"Los torbellinos bajan desde su trayectoria y dejan de generarse al tocar: quédate <b>por encima</b> y toma <b>más allá</b>.":"Los torbellinos empiezan donde rota: <b>rota antes</b> y sube <b>por encima</b> de su trayectoria.",go:"070"}; },
  front(){ const C=Math.random()<.5; const svg=SVG(400,170,`<rect width="400" height="170" fill="#2c4f7c"/><rect y="140" width="400" height="30" fill="#5a7a45"/>
      ${C?`<path d="M120 140 L170 20 L210 20" fill="#e9eef4" opacity=".9"/><circle cx="160" cy="45" r="30" fill="#f1f4f8"/><circle cx="175" cy="75" r="34" fill="#e3e8ef"/><circle cx="150" cy="100" r="30" fill="#d3d9e2"/>${Array.from({length:10},(_,i)=>`<line x1="${130+i*8}" y1="120" x2="${126+i*8}" y2="140" stroke="#9fc0ff" stroke-width="2"/>`).join("")}<text x="230" y="60" fill="#fff" font-size="12">franja estrecha de CB</text><text x="230" y="80" fill="#fff" font-size="12">chubascos y rachas</text><text x="230" y="100" fill="#fff" font-size="12">al pasar: baja la temperatura</text>`
         :`${[[60,120,"Ns"],[150,95,"As"],[240,70,"Cs"],[330,45,"Ci"]].map(([x,y,n])=>`<ellipse cx="${x}" cy="${y}" rx="48" ry="${n==="Ns"?18:9}" fill="${n==="Ns"?"#9aa3ae":"#e9eef4"}" opacity=".9"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="12" font-weight="700" fill="#1b2a3a">${n}</text>`).join("")}${Array.from({length:12},(_,i)=>`<line x1="${30+i*6}" y1="132" x2="${30+i*6}" y2="140" stroke="#9fc0ff" stroke-width="1.5"/>`).join("")}<text x="12" y="20" fill="#fff" font-size="12">Te acercas: Ci → Cs → As → Ns, lluvia continua</text>`}`);
    return {cat:"Meteorología · frentes",svg,q:"¿Qué frente es?",o:C?["Frente frío","Frente cálido","Oclusión cálida"]:["Frente cálido","Frente frío","Línea de turbonada"],e:C?"<b>Frío</b>: pendiente fuerte (1:50–1:100), CB en franja estrecha, chubascos y rachas; tras pasar baja la temperatura, sube la presión y el viento vira (HN).":"<b>Cálido</b>: pendiente suave (≈ 1:150), nubes estratiformes que llegan muy por delante en orden <b>Ci, Cs, As, Ns</b> y lluvia continua.",go:"050"}; }};
function flash(){
  const body=open("⚡ Flash-Check visual","");
  let qs=[], i=0, ok=0, t0=0, tq=0, timer=0, on15=true, done=false, wrong=[];
  const start=()=>{ const keys=Object.keys(GEN); qs=shuf([...keys,...keys]).slice(0,10).map(k=>{ const g=GEN[k](); const ord=shuf(g.o.map((t,j)=>j)); return Object.assign(g,{ord}); }); i=0; ok=0; wrong=[]; done=false; t0=performance.now(); show(); };
  const tick=()=>{ if(!OV||done) return; const el=(performance.now()-t0)/1000; clock(mmss(el)); if(on15&&!qs[i].ans){ const left=15-(performance.now()-tq)/1000; const b=body.querySelector("[data-left]"); if(b) b.style.width=Math.max(0,left/15*100)+"%"; if(left<=0) answer(-1); } timer=requestAnimationFrame(tick); };
  const show=()=>{ const q=qs[i]; tq=performance.now();
    body.innerHTML=`<div class="row" style="justify-content:space-between"><span class="chip">${esc(q.cat)}</span><span class="muted">${i+1} / 10 · aciertos ${ok}</span></div>${on15?`<div class="bar" style="margin:4px 0 8px"><i data-left style="width:100%;background:var(--warn)"></i></div>`:""}<div class="vis">${q.svg}</div><div class="qt">${q.q}</div>${q.ord.map(j=>`<button type="button" class="opt" data-o="${j}">${esc(q.o[j]).replace(/&lt;b&gt;|&lt;\/b&gt;/g,"")}</button>`).join("")}<div data-exp></div>`;
    body.querySelectorAll("[data-o]").forEach(b=>b.addEventListener("click",()=>answer(+b.dataset.o)));
    cancelAnimationFrame(timer); timer=requestAnimationFrame(tick); };
  const answer=j=>{ const q=qs[i]; if(q.ans) return; q.ans=1; const good=j===0; if(good) ok++; else wrong.push(q);
    body.querySelectorAll("[data-o]").forEach(b=>{ const v=+b.dataset.o; b.disabled=true; if(v===0) b.classList.add("ok"); else if(v===j) b.classList.add("bad"); });
    body.querySelector("[data-exp]").innerHTML=`<div class="exp"><b>${good?"Correcto":j<0?"Se acabó el tiempo":"No"}</b> · ${q.e}</div><div class="row"><button type="button" class="btn2 pri" data-n>${i<9?"Siguiente →":"Ver resultado"}</button></div>`;
    body.querySelector("[data-n]").addEventListener("click",()=>{ if(i<9){ i++; show(); } else end(); }); body.querySelector("[data-n]").focus(); };
  const end=()=>{ done=true; cancelAnimationFrame(timer); const el=(performance.now()-t0)/1000; clock(mmss(el)); const cats={}; wrong.forEach(q=>cats[q.cat]=(cats[q.cat]||0)+1);
    body.innerHTML=`<div class="row"><span class="big">${ok}/10</span><span class="muted">en ${mmss(el)} · ${ok>=8?"¡muy bien!":ok>=6?"bien, repasa lo fallado":"toca repasar estas láminas"}</span></div>${wrong.length?`<p>Fallos por tema: ${Object.keys(cats).map(c=>`<span class="chip">${esc(c)} · ${cats[c]}</span>`).join(" ")}</p><p class="muted">Cada tema tiene su lámina interactiva en los apuntes de la asignatura:</p><div class="row">${[...new Set(wrong.map(q=>q.go))].map(k=>`<button type="button" class="btn2" data-go2="${k}">Abrir ${k}</button>`).join("")}</div>`:""}<div class="row"><button type="button" class="btn2 pri" data-again>Otra ráfaga de 10</button></div>`;
    body.querySelector("[data-again]").addEventListener("click",start);
    body.querySelectorAll("[data-go2]").forEach(b=>b.addEventListener("click",()=>{ const k=b.dataset.go2; close(); if(typeof window.show==="function") window.show(k,{tab:"notes"}); })); };
  body.innerHTML=`<p>Diez preguntas con imagen sacadas de las láminas interactivas: luces y prioridad de paso, pitot-estática, VOR e ILS en el CDI, llamadas del circuito, estela turbulenta y frentes. Objetivo: <b>menos de 60 segundos</b>.</p><div class="row"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-15 checked> ⏱ 15 s por pregunta</label></div><div class="row"><button type="button" class="btn2 pri" data-go>Empezar</button></div>`;
  body.querySelector("[data-15]").addEventListener("change",e=>{ on15=e.target.checked; });
  body.querySelector("[data-go]").addEventListener("click",start);
  onClose=()=>{ done=true; cancelAnimationFrame(timer); };
}

/* =====================================================================
   🎯 SIMULACRO GLOBAL: mezcla proporcional de las 13 asignaturas EASA
   ===================================================================== */
// [código, nombre, preguntas del examen real, minutos, página, filtro por LO]
const S13=[["010","Derecho Aéreo",44,60,"010",null],["021","AGK · Célula y motores",80,120,"021",lo=>!/^022/.test(lo)],["022","AGK · Instrumentación",60,90,"021",lo=>/^022/.test(lo)],
  ["031","Masa y centrado",25,75,"031",lo=>/^031/.test(lo)],["032","Performance",45,120,"031",lo=>/^032/.test(lo)],["033","Planificación",42,120,"031",lo=>/^(033|050)/.test(lo)],
  ["040","Factores humanos",48,90,"040",null],["050","Meteorología",84,120,"050",null],["061","Navegación general",55,135,"061",lo=>!/^062/.test(lo)],["062","Radionavegación",66,90,"061",lo=>/^062/.test(lo)],
  ["070","Procedimientos operacionales",42,75,"070",null],["081","Principios de vuelo",46,90,"081",null],["090","Comunicaciones",34,60,"090",null]];
let BANK=null;
const loadBank=()=>BANK?Promise.resolve(BANK):fetch("s/mixbank.json",{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }).then(j=>(BANK=j));
function failedIds(page){ const st=(window.STATE||{})[page]||(typeof STATE!=="undefined"?STATE[page]:null); const last={}; if(!st||!Array.isArray(st.attempts)) return new Set();
  st.attempts.filter(a=>a&&Array.isArray(a.items)).sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(a=>a.items.forEach(it=>{ if(it&&it.q) last[it.q]=!!it.ok; }));
  return new Set(Object.keys(last).filter(k=>last[k]===false)); }
function quotas(N){ const tot=S13.reduce((s,x)=>s+x[2],0); const raw=S13.map(x=>N*x[2]/tot); const q=raw.map(v=>Math.max(1,Math.floor(v))); let left=N-q.reduce((a,b)=>a+b,0);
  raw.map((v,i)=>[v-Math.floor(v),i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{ if(left>0){ q[i]++; left--; } }); while(left<0){ const i=q.indexOf(Math.max(...q)); q[i]--; left++; } return q; }
function build(N){ const Q=quotas(N), out=[]; let stState=(typeof STATE!=="undefined"?STATE:window.STATE)||{};
  S13.forEach((s,i)=>{ const pool=(BANK.subj[s[4]]||[]).filter(q=>!s[5]||s[5](q[1]||"")); if(!pool.length) return; const n=Math.min(Q[i],pool.length), used=new Set(), sel=[];
    const take=(arr,max)=>{ for(const q of shuf(arr)){ if(sel.length>=n||max<=0) break; if(used.has(q[0])) continue; used.add(q[0]); sel.push(q); max--; } };
    if(s[0]==="081") take(pool.filter(q=>BANK.key.includes(q[0])),Math.ceil(n*.5));   // prioridad: las 34 preguntas clave de POF
    const fl=failedIds(s[4]); take(pool.filter(q=>fl.has(q[0])),Math.ceil(n*.4));        // prioridad: lo que más fallas
    take(pool,n);
    sel.forEach(q=>out.push({s:s[0],page:s[4],id:q[0],lo:q[1],t:q[2],o:q[3],e:q[4],ord:shuf(q[3].map((x,j)=>j)),ans:null,key:s[0]==="081"&&BANK.key.includes(q[0]),fail:fl.has(q[0])})); });
  return shuf(out); }
function globalSim(){
  const body=open("🎯 Simulacro global","<p>Cargando el banco de preguntas…</p>");
  loadBank().then(()=>setup()).catch(e=>{ body.innerHTML=`<p>No se ha podido cargar el banco (${esc(e.message)}). Revisa la conexión y vuelve a intentarlo.</p>`; });
  let qs=[], i=0, end=0, timer=0, fin=false;
  function setup(){ const tot=Object.values(BANK.subj).reduce((s,a)=>s+a.length,0);
    body.innerHTML=`<p>Examen mezclado con las <b>13 asignaturas EASA</b> en su proporción oficial (671 preguntas del examen real), todas revueltas para entrenar el cambio de chip. Dentro de cada asignatura van primero las preguntas que <b>más fallas</b> (hasta un 40 %) y, en Principios de vuelo, las <b>34 preguntas clave</b> (hasta la mitad). Tiempo proporcional al de los exámenes reales.</p>
      <div class="row">${[[40,"Rápido"],[80,"Medio"],[134,"Largo (1/5 del real)"]].map(([n,l],j)=>`<button type="button" class="btn2" data-n="${n}" aria-pressed="${j===0}">${l} · ${n} preg.</button>`).join("")}</div>
      <p class="muted" data-info></p><div class="row"><button type="button" class="btn2 pri" data-start>Empezar el simulacro</button></div><p class="muted" style="font-size:13px">Banco: ${tot.toLocaleString("es-ES")} preguntas de los apuntes y tests de la web (sin las que necesitan figura). El resultado se guarda en cada asignatura y tus fallos entran en «Repasar hoy».</p>`;
    let N=40; const info=()=>{ const Q=quotas(N), mins=Math.round(S13.reduce((s,x,i)=>s+Q[i]*x[3]/x[2],0)); body.querySelector("[data-info]").innerHTML=`${N} preguntas · <b>${mins} min</b> · ${S13.map((x,i)=>`${x[0]} ${Q[i]}`).join(" · ")}`; };
    body.querySelectorAll("[data-n]").forEach(b=>b.addEventListener("click",()=>{ N=+b.dataset.n; body.querySelectorAll("[data-n]").forEach(x=>x.setAttribute("aria-pressed",x===b)); info(); })); info();
    body.querySelector("[data-start]").addEventListener("click",()=>{ qs=build(N); const Q=quotas(N); const mins=S13.reduce((s,x,i)=>s+Q[i]*x[3]/x[2],0); end=Date.now()+mins*60000; i=0; fin=false; show(); tick(); }); }
  const nameOf=c=>(S13.find(x=>x[0]===c)||[])[1]||c;
  function tick(){ if(!OV||fin) return; const left=(end-Date.now())/1000; clock(mmss(left)); if(left<=0){ grade(true); return; } timer=setTimeout(tick,500); }
  function show(){ const q=qs[i];
    body.innerHTML=`<div class="prog">${qs.map((x,j)=>`<i class="${x.ans!=null?"a":""} ${j===i?"c":""}" data-j="${j}" title="${j+1}"></i>`).join("")}</div>
      <div class="row" style="justify-content:space-between"><span class="chip">${q.s} · ${esc(nameOf(q.s))}${q.key?" · clave":""}${q.fail?" · la fallaste":""}</span><span class="muted">${i+1} / ${qs.length}</span></div>
      <div class="qt">${esc(q.t)}</div>${q.ord.map(j=>`<button type="button" class="opt ${q.ans===j?"sel":""}" data-o="${j}">${esc(q.o[j])}</button>`).join("")}
      <div class="row" style="justify-content:space-between"><button type="button" class="btn2" data-p ${i?"":"disabled"}>← Anterior</button><button type="button" class="btn2" data-f>Entregar</button><button type="button" class="btn2 pri" data-nx>${i<qs.length-1?"Siguiente →":"Revisar y entregar"}</button></div>`;
    body.querySelectorAll("[data-o]").forEach(b=>b.addEventListener("click",()=>{ q.ans=+b.dataset.o; if(i<qs.length-1){ i++; show(); } else show(); }));
    body.querySelectorAll("[data-j]").forEach(b=>b.addEventListener("click",()=>{ i=+b.dataset.j; show(); }));
    body.querySelector("[data-p]").addEventListener("click",()=>{ if(i){ i--; show(); } });
    body.querySelector("[data-nx]").addEventListener("click",()=>{ if(i<qs.length-1){ i++; show(); } else confirmEnd(); });
    body.querySelector("[data-f]").addEventListener("click",confirmEnd); }
  function confirmEnd(){ const n=qs.filter(q=>q.ans==null).length; if(!n){ grade(false); return; }
    body.insertAdjacentHTML("beforeend",`<div class="exp" data-cf>Te quedan <b>${n}</b> sin contestar (cuentan como fallo). <button type="button" class="btn2 pri" data-yes>Entregar igualmente</button> <button type="button" class="btn2" data-no>Seguir</button></div>`);
    body.querySelector("[data-yes]").addEventListener("click",()=>grade(false)); body.querySelector("[data-no]").addEventListener("click",()=>body.querySelector("[data-cf]").remove()); }
  async function grade(timeout){ fin=true; clearTimeout(timer); const by={}; qs.forEach(q=>{ const b=by[q.s]||(by[q.s]={ok:0,n:0}); b.n++; if(q.ans===0) b.ok++; });
    const ok=qs.filter(q=>q.ans===0).length, pct=Math.round(ok/qs.length*100);
    const rows=S13.filter(x=>by[x[0]]).map(x=>({c:x[0],nm:x[1],...by[x[0]],p:Math.round(by[x[0]].ok/by[x[0]].n*100)})).sort((a,b)=>a.p-b.p||b.n-a.n);
    const weak=rows.filter(r=>r.n>=2)[0]||rows[0];
    body.innerHTML=`${timeout?`<p class="exp"><b>Se acabó el tiempo.</b> Lo no contestado cuenta como fallo.</p>`:""}<div class="row"><span class="big" style="color:${pct>=75?"var(--ok)":"var(--bad)"}">${pct} %</span><span class="muted">${ok} de ${qs.length} · ${pct>=75?"aprobado (75 %)":"por debajo del 75 %"}</span></div>
      ${weak?`<p>La que más flojea: <b>${weak.c} · ${esc(weak.nm)}</b> (${weak.ok}/${weak.n}).</p>`:""}
      <div class="scroll"><table><tr><th>Asignatura</th><th>Aciertos</th><th style="width:40%">Nota</th></tr>${rows.map(r=>`<tr><td><b>${r.c}</b> ${esc(r.nm)}</td><td>${r.ok}/${r.n}</td><td><div class="bar"><i style="width:${r.p}%;background:${r.p>=75?"var(--ok)":r.p>=50?"var(--warn)":"var(--bad)"}"></i></div><small class="muted">${r.p} %</small></td></tr>`).join("")}</table></div>
      <p class="muted" style="font-size:13px">Con pocas preguntas por asignatura la nota de cada una es orientativa: fíjate en la tendencia de varios simulacros.</p>
      <details><summary>Ver las ${qs.length-ok} falladas con su explicación</summary>${qs.filter(q=>q.ans!==0).map(q=>`<div style="margin:10px 0;padding-bottom:8px;border-bottom:1px solid var(--line)"><span class="chip">${q.s}</span><div class="qt" style="font-size:15px">${esc(q.t)}</div><div>✔ <b>${esc(q.o[0])}</b>${q.ans!=null?`<br>✘ <span class="muted">${esc(q.o[q.ans])}</span>`:"<br><span class=\"muted\">sin contestar</span>"}</div>${q.e?`<div class="exp">${esc(q.e)}</div>`:""}</div>`).join("")}</details>
      <div class="row"><button type="button" class="btn2 pri" data-again>Otro simulacro</button>${weak?`<button type="button" class="btn2" data-go2="${(S13.find(x=>x[0]===weak.c)||[])[4]}">Repasar ${weak.c}</button>`:""}</div><p class="muted" data-saved style="font-size:13px"></p>`;
    body.querySelector("[data-again]").addEventListener("click",setup);
    const g=body.querySelector("[data-go2]"); if(g) g.addEventListener("click",()=>{ close(); if(typeof window.show==="function") window.show(g.dataset.go2,{tab:"test"}); });
    // guardar: un intento por página (modo «global»), con sus preguntas, para que los fallos entren en el repaso
    try{ const pages={}; qs.forEach(q=>(pages[q.page]||(pages[q.page]=[])).push(q)); const now=new Date().toISOString(), tag=Date.now().toString(36);
      for(const pg of Object.keys(pages)){ const L=pages[pg], sc=L.filter(q=>q.ans===0).length, byLO={}; L.forEach(q=>{ const b=byLO[q.lo]||(byLO[q.lo]={ok:0,total:0}); b.total++; if(q.ans===0) b.ok++; });
        const att={id:"g"+tag+pg,date:now,mode:"global",score:sc,total:L.length,pct:Math.round(sc/L.length*100),byLO,items:L.map(q=>({q:q.id,ok:q.ans===0,a:q.ans==null?null:q.o[q.ans]}))};
        if(typeof saveSubj==="function") await saveSubj(pg,{attempts:[att]}); }
      body.querySelector("[data-saved]").textContent="Guardado en tu progreso: las falladas vuelven en «Repasar hoy» de cada asignatura."; }
    catch(e){ try{ console.error("mix",e); }catch(_){} body.querySelector("[data-saved]").textContent="No se ha podido guardar el resultado en tu progreso."; } }
  onClose=()=>{ fin=true; clearTimeout(timer); };
}

/* =====================================================================
   📋 FÓRMULAS Y VELOCIDADES V (chuletario con buscador)
   ===================================================================== */
const VS=[
 ["VS0","Pérdida con flaps y tren fuera (configuración de aterrizaje)","Inicio del arco blanco","#ffffff","Sube con el peso (∝ √masa). En IAS casi no cambia con la altitud (en TAS sí sube)."],
 ["VS1","Pérdida en una configuración dada (normalmente limpio)","Inicio del arco verde","#2bb35a","Igual: ∝ √masa y ∝ √n en viraje (60° → ×1,41)."],
 ["VFE","Máxima con flaps extendidos","Final del arco blanco","#ffffff","Límite estructural de los flaps: no cambia con el peso."],
 ["VNO","Máxima de crucero estructural","Final del arco verde · empieza el amarillo","#2bb35a","Por encima, solo con aire en calma."],
 ["Arco amarillo","Zona de precaución, de VNO a VNE","VNO → VNE","#f2c200","Solo en aire en calma y con suavidad en los mandos."],
 ["VNE","Velocidad que nunca se debe superar","Línea roja","#e53935","Límite fijo en IAS en ligeros (riesgo de flameo, flutter)."],
 ["VA","Velocidad de maniobra","No está en el anemómetro","#9e9e9e","Baja con menos peso: Va ∝ √masa. Por debajo, el ala entra en pérdida antes de romperse."],
 ["VLO","Máxima para operar el tren (subirlo o bajarlo)","—","#9e9e9e","Suele ser menor que VLE."],
 ["VLE","Máxima con el tren extendido","—","#9e9e9e","El tren ya fuera aguanta más que en movimiento."],
 ["VX","Mejor ángulo de ascenso","—","#9e9e9e","Más altura por distancia (obstáculos). Al subir, la Vx (IAS) aumenta."],
 ["VY","Mejor régimen de ascenso","—","#9e9e9e","Más altura por minuto. Al subir, la Vy (IAS) baja; Vx y Vy se juntan en el techo absoluto."],
 ["V1","Velocidad de decisión en el despegue","—","#9e9e9e","Hasta V1 puedes abortar; desde V1 sigues. Sube con el peso."],
 ["VR","Velocidad de rotación","—","#9e9e9e","Sube con el peso (∝ √masa). Igual en IAS a cualquier altitud; más TAS y carrera en caliente y alto."],
 ["V2","Velocidad de seguridad en el despegue","—","#9e9e9e","A alcanzar a 35 ft con un motor parado (aviones de transporte); ≥ 1,13 VSR y ≥ 1,1 VMCA."],
 ["VYSE · línea azul","Mejor régimen con un motor parado (bimotor)","Línea azul","#1e6fe0","Solo en bimotores ligeros."],
 ["VMCA · línea roja radial","Mínima de control con el motor crítico parado","Línea roja radial","#e53935","Solo en bimotores ligeros; por debajo no se puede mantener la dirección."]];
const FX=[
 ["Sustentación","L = ½ ρ V² S C<sub>L</sub>","Doble de velocidad → cuádruple de sustentación.","aerodinámica"],
 ["Resistencia","D = ½ ρ V² S C<sub>D</sub> · inducida ∝ 1/V² · parásita ∝ V²","Resistencia mínima (y mejor L/D) donde inducida = parásita.","aerodinámica"],
 ["Factor de carga en viraje","n = 1 / cos φ","30° → 1,15 · 45° → 1,41 · 60° → 2. Vs en viraje = Vs × √n.","aerodinámica"],
 ["Radio de viraje","r = V² / (g · tan φ)","Viraje estándar (rate one, 3°/s): alabeo ≈ TAS/10 + 7.","aerodinámica"],
 ["Mach","M = TAS / a · a = 38,94 √T(K) kt","ISA a nivel del mar: a ≈ 661 kt. La velocidad del sonido solo depende de la temperatura.","alta velocidad"],
 ["ISA","15 °C · 1013,25 hPa · −1,98 °C/1.000 ft","Tropopausa a 36.090 ft (11 km) con −56,5 °C.","meteorología altimetría"],
 ["Presión y altura","1 hPa ≈ 27 ft (30 ft en las cuentas rápidas)","«De alta a baja, mira abajo».","altimetría"],
 ["Altitud de presión","PA = elevación + (1013 − QNH) × 27","Con QNH bajo la PA es mayor que la elevación.","altimetría performance"],
 ["Altitud de densidad","DA ≈ PA + 120 × (OAT − ISA)","Calor y altura → DA alta → peor performance (hot, high, humid).","performance"],
 ["Error por temperatura","4 % de la altura por cada 10 °C de desviación ISA","Con frío el altímetro marca de más: estás más bajo.","altimetría"],
 ["TAS rápida","TAS ≈ IAS + 2 % por cada 1.000 ft","Para cuentas mentales.","navegación"],
 ["Regla de 1 en 60","1 NM a 60 NM = 1°","Error (°) = desvío × 60 / distancia volada.","navegación"],
 ["Deriva máxima","Deriva máx. (°) ≈ 60 × W / TAS","Con viento a 90° del rumbo.","navegación"],
 ["Componentes del viento","Cruzado = W · sen θ · de cara = W · cos θ","Rápido: 30° → ½ · 45° → 0,7 · 60° → 0,9 del viento.","navegación performance"],
 ["Tiempo, distancia, velocidad","t = d / GS · combustible = t × consumo","GS en kt = NM por hora; minutos = NM × 60 / GS.","navegación planificación"],
 ["Descenso de 3°","300 ft por NM · régimen ≈ GS × 5","Inicio del descenso (NM) ≈ altura a perder (ft) / 300.","navegación"],
 ["Gradiente de ascenso","Gradiente (%) ≈ régimen (ft/min) / GS (kt)","700 ft/min a 70 kt ≈ 10 %.","performance"],
 ["Planeo","Distancia = altura × L/D","L/D 10 desde 6.000 ft ≈ 10 NM.","aerodinámica"],
 ["Convergencia","Δlongitud × sen(latitud media)","Ángulo de conversión = la mitad.","navegación"],
 ["Departure","Δlong (′) × cos(latitud) = NM","Sobre un paralelo.","navegación"],
 ["Alcance VHF","d (NM) ≈ 1,23 √h (ft)","10.000 ft → ≈ 123 NM.","comunicaciones radionavegación"],
 ["Hidroplaneo","Vp ≈ 9 √P (psi) kt · rueda sin girar ≈ 7,7 √P","Pista contaminada: más distancia, menos frenada.","operaciones"],
 ["Viento en los cálculos","50 % del de cara · 150 % del de cola","Clase B y regla general de performance.","performance"],
 ["Despegue clase B","TOD × 1,25 ≤ TORA","+10 % por 1.000 ft · +10 % por 10 °C · hierba ×1,2 · masa ×(m/m₀)².","performance"],
 ["Contingencia","5 % del trip (mínimo 5 min de espera)","Hay reducciones con alternativo en ruta.","combustible planificación"],
 ["Reserva final","Reactor 30 min · pistón 45 min","En espera a 1.500 ft, ISA.","combustible planificación"],
 ["Masas","BEM → DOM → ZFM → TOM → LM","«Bebe Dos Zumos, Tómalos Lento».","masa centrado"],
 ["CG","CG = Σ momentos / Σ masas · % MAC = (CG − LEMAC) / MAC × 100","Momento = masa × brazo.","masa centrado"]];
const CV=[["1 NM","1.852 m · 6.076 ft"],["1 ft","0,3048 m"],["1 kt","0,514 m/s · 1,852 km/h"],["1 inHg","33,86 hPa"],["1 USG","3,785 L"],["1 lb","0,4536 kg"],["AVGAS","≈ 0,72 kg/L"],["Jet A-1","≈ 0,80 kg/L"],["°F","°C × 9/5 + 32"],["1° de latitud","60 NM"],["15° de longitud","1 hora"],["1 m/s","≈ 2 kt · ≈ 200 ft/min"]];
const RG=[["Luces","Roja izquierda, verde derecha (110°), blanca de cola (140°). Si ves roja, cedes."],["Prioridad de paso","Globo › planeador › dirigible › motor. De frente, los dos a la derecha. Si alcanzas, adelantas por la derecha."],["Squawk","7500 interferencia ilícita · 7600 sin radio · 7700 emergencia."],["VMC","8 km en FL100 o más · 5 km por debajo · nubes a 1.500 m y 1.000 ft."],["ICE-T","IAS → CAS → EAS → TAS."],["TVMDC","True → Variation → Magnetic → Deviation → Compass. East is least, West is best."],["ANDS / UNOS (HN)","Accelerate North, Decelerate South · Undershoot North, Overshoot South."],["Buys Ballot","HN: de espaldas al viento, la baja a la izquierda."],["Pitot tapado","El ASI hace de altímetro. Estática tapada: ALT congelado, VSI a cero."],["Estela","Heavy, clean, slow. Por encima de su senda y más allá de su toma; rota antes que él."],["Cizalladura","Si mejora de golpe, desconfía: potencia máxima y sin tocar configuración."],["CAVOK","10 km · sin nubes por debajo de 5.000 ft (o MSA) · sin CB/TCU · sin fenómenos."],["Hipoxia","HASH: hipóxica, anémica, por estancamiento, histotóxica."],["IM SAFE","Illness, Medication, Stress, Alcohol, Fatigue, Eating."],["MAYDAY / PAN PAN","Socorro (ayuda inmediata) / urgencia (sin ayuda inmediata), ×3."],["Barrena: PARE","Power idle · Ailerons neutral · Rudder opuesto · Elevator adelante."]];
function cheat(){
  const body=open("📋 Fórmulas y velocidades V","");
  let tab="v", qy="";
  const hl=s=>{ if(!qy) return s; const re=new RegExp("("+qy.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"); return s.replace(/(<[^>]+>)|([^<]+)/g,(m,tag,txt)=>tag||txt.replace(re,"<mark>$1</mark>")); };
  const norm=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const match=(...a)=>!qy||norm(a.join(" ").replace(/<[^>]+>/g,"")).includes(norm(qy));
  const asi=()=>{ const A=(v)=>{ const a=(-220+v/180*300)*Math.PI/180; return [100+80*Math.cos(a),100+80*Math.sin(a)]; }, arc=(v0,v1,r,c,w)=>{ const p=A(v0), q=A(v1); const P=(v,rr)=>{ const a=(-220+v/180*300)*Math.PI/180; return [100+rr*Math.cos(a),100+rr*Math.sin(a)]; }; const s=P(v0,r), e=P(v1,r); return `<path d="M${s[0]} ${s[1]} A${r} ${r} 0 ${(v1-v0)/180*300>180?1:0} 1 ${e[0]} ${e[1]}" stroke="${c}" stroke-width="${w}" fill="none"/>`; };
    const tk=[0,40,60,80,100,120,140,160].map(v=>{ const a=(-220+v/180*300)*Math.PI/180; return `<line x1="${100+70*Math.cos(a)}" y1="${100+70*Math.sin(a)}" x2="${100+78*Math.cos(a)}" y2="${100+78*Math.sin(a)}" stroke="#cfd8e3"/><text x="${100+58*Math.cos(a)}" y="${104+58*Math.sin(a)}" fill="#cfd8e3" font-size="10" text-anchor="middle">${v}</text>`; }).join("");
    const red=(()=>{ const a=(-220+163/180*300)*Math.PI/180; return `<line x1="${100+70*Math.cos(a)}" y1="${100+70*Math.sin(a)}" x2="${100+90*Math.cos(a)}" y2="${100+90*Math.sin(a)}" stroke="#e53935" stroke-width="4"/>`; })();
    return `<div class="vis" style="max-width:480px">${SVG(480,200,`<rect width="420" height="200" fill="#0f1b29"/><circle cx="100" cy="100" r="92" fill="#0b1420" stroke="#5d6f84" stroke-width="3"/>${arc(40,85,84,"#ffffff",6)}${arc(48,129,77,"#2bb35a",6)}${arc(129,163,77,"#f2c200",6)}${red}${tk}<text x="100" y="78" fill="#8fa3b8" font-size="10" text-anchor="middle">KIAS · ejemplo</text>
      <g font-size="12" fill="#e9f0f7"><rect x="215" y="28" width="14" height="6" fill="#fff"/><text x="236" y="35">Arco blanco: VS0 → VFE (flaps)</text><rect x="215" y="58" width="14" height="6" fill="#2bb35a"/><text x="236" y="65">Arco verde: VS1 → VNO (normal)</text><rect x="215" y="88" width="14" height="6" fill="#f2c200"/><text x="236" y="95">Arco amarillo: VNO → VNE (calma)</text><rect x="215" y="118" width="14" height="6" fill="#e53935"/><text x="236" y="125">Línea roja: VNE</text><text x="215" y="160" fill="#8fa3b8" font-size="11">Va no aparece en el anemómetro</text></g>`)}</div>`; };
  const render=()=>{ const r=body.querySelector("[data-r]"); let h="";
    const showV=tab==="v"||qy, showF=tab==="f"||qy, showC=tab==="c"||qy, showR=tab==="r"||qy;
    if(showV){ const L=VS.filter(v=>match(...v)); if(L.length) h+=`${qy?"<h3>Velocidades V</h3>":asi()}<div class="scroll"><table class="cards"><tr><th>V</th><th>Qué es</th><th>Anemómetro</th><th>Con peso y altitud</th></tr>${L.map(v=>`<tr><td><b>${hl(v[0])}</b></td><td>${hl(v[1])}</td><td data-l="Anemómetro"><span class="sw" style="background:${v[3]}"></span>${hl(v[2])}</td><td data-l="Peso y altitud">${hl(v[4])}</td></tr>`).join("")}</table></div>`; }
    if(showF){ const L=FX.filter(v=>match(...v)); if(L.length) h+=`${qy?"<h3>Fórmulas</h3>":""}<div class="scroll"><table class="cards"><tr><th>Qué</th><th>Fórmula</th><th>Para recordarla</th></tr>${L.map(v=>`<tr><td><b>${hl(v[0])}</b> <small class="muted">${v[3]}</small></td><td style="font-weight:600">${hl(v[1])}</td><td class="muted">${hl(v[2])}</td></tr>`).join("")}</table></div>`; }
    if(showC){ const L=CV.filter(v=>match(...v)); if(L.length) h+=`${qy?"<h3>Conversiones</h3>":""}<div class="scroll"><table><tr><th>Unidad</th><th>Equivale a</th></tr>${L.map(v=>`<tr><td><b>${hl(v[0])}</b></td><td>${hl(v[1])}</td></tr>`).join("")}</table></div>`; }
    if(showR){ const L=RG.filter(v=>match(...v)); if(L.length) h+=`${qy?"<h3>Reglas de oro</h3>":""}<div class="scroll"><table class="cards"><tr><th>Regla</th><th>Resumen</th></tr>${L.map(v=>`<tr><td><b>${hl(v[0])}</b></td><td>${hl(v[1])}</td></tr>`).join("")}</table></div>`; }
    r.innerHTML=h||`<p class="muted">Nada encontrado con «${esc(qy)}».</p>`; };
  body.innerHTML=`<input type="search" data-q placeholder="Busca: hidroplaneo, arco blanco, Mach, 1 en 60, reserva…" aria-label="Buscar en el chuletario"><div class="row" data-tabs>${[["v","Velocidades V"],["f","Fórmulas"],["c","Conversiones"],["r","Reglas de oro"]].map(([k,l])=>`<button type="button" class="btn2" data-t="${k}" aria-pressed="${k===tab}">${l}</button>`).join("")}</div><div data-r></div>`;
  body.querySelectorAll("[data-t]").forEach(b=>b.addEventListener("click",()=>{ tab=b.dataset.t; body.querySelectorAll("[data-t]").forEach(x=>x.setAttribute("aria-pressed",x===b)); render(); }));
  body.querySelector("[data-q]").addEventListener("input",e=>{ qy=e.target.value.trim(); body.querySelector("[data-tabs]").style.opacity=qy?.4:1; render(); });
  render();
}

/* ---------- accesos en la portada ---------- */
function mount(){ const g=document.getElementById("grid"); if(!g||document.querySelector(".mxbar")) return;
  const bar=document.createElement("div"); bar.className="mxbar";
  bar.setAttribute("aria-label","Herramientas de repaso");
  const B=(a,ic,lg,sh,tt)=>`<button type="button" data-a="${a}" title="${tt}"><span class="ic" aria-hidden="true">${ic}</span><b><span class="lg">${lg}</span><span class="sh">${sh}</span></b></button>`;
  bar.innerHTML=B("flash","⚡","Flash-Check","Flash","10 preguntas con imagen en 60 s")+B("sim","🎯","Simulacro global","Simulacro","13 asignaturas mezcladas, con nota por asignatura")+B("cheat","📋","Fórmulas y velocidades V","Fórmulas","Fórmulas, velocidades V, conversiones y reglas, con buscador");
  g.parentNode.insertBefore(bar,g);
  bar.querySelector('[data-a="flash"]').addEventListener("click",flash); bar.querySelector('[data-a="sim"]').addEventListener("click",globalSim); bar.querySelector('[data-a="cheat"]').addEventListener("click",cheat); }
window.F0Mix={flash,globalSim,cheat,_:{open,close,clock,mmss,esc,shuf,pick,SVG,loadBank,failedIds,bank:()=>BANK}};
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
})();
