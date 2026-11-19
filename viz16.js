/* Láminas interactivas 2D/3D de los apuntes (serie 2). Se montan en <div class="f0viz" data-viz="…">. Sin librerías: SVG y canvas. */
(function(){
"use strict";
const cl=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t, R=Math.PI/180, f1=x=>(Math.round(x*10)/10).toString().replace(".",","), f0=x=>Math.round(x).toLocaleString("es-ES");
const CSS=`
.f0viz{margin:14px 0 18px;width:100%;max-width:none;box-sizing:border-box}
.f0viz figure svg{max-height:min(78vh,620px);margin:0 auto}
.f0viz .lt{font:700 12px/1 "Barlow Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5d6977;margin:0 0 6px}
.f0viz figure{margin:0;background:#12202f;border-radius:8px 8px 0 0;overflow:hidden}
.f0viz svg,.f0viz canvas{display:block;width:100%;height:auto;touch-action:pan-y}
.f0viz svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:#dfe8f1}
.f0viz .ctl .sl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px 22px}
.f0viz .ctl .bt{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.f0viz .ctl{display:grid;gap:12px;background:#0f1b29;color:#e9f0f7;padding:12px 14px;font:600 13.5px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif}
.f0viz .ctl label{flex:1 1 240px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 10px;min-width:0;color:#e9f0f7}
.f0viz .ctl label:has(input[type=checkbox]){flex:0 1 auto;display:flex}
.f0viz .ctl input[type=range]{grid-column:1/-1;order:2;width:100%;margin:0;accent-color:#ffc94d}
.f0viz .ctl .rv{order:1;text-align:right}
.f0viz .ctl .rv{white-space:nowrap}
.f0viz .ctl output{font:600 13.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace;min-width:5.5ch;color:#ffc94d}
.f0viz .ctl button{font:700 13px system-ui,sans-serif;padding:8px 12px;min-height:38px;border-radius:6px;border:1px solid #3a516b;background:#1a2b3f;color:#e9f0f7;cursor:pointer}
.f0viz .ctl button[aria-pressed=true]{background:#ffc94d;border-color:#ffc94d;color:#12202f}
.f0viz .ctl input[type=checkbox]{width:18px;height:18px;accent-color:#ffc94d}
.f0viz .out{margin:0;background:#16283b;color:#e9f0f7;border-radius:0 0 8px 8px;padding:11px 14px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:3.2em}
.f0viz .out b{color:#ffc94d}.f0viz .out .ok{color:#6ee7a0}.f0viz .out .bad{color:#ff8a80}
.f0viz .lt,.f0viz .out,.f0viz .cap,.f0viz figure,.f0viz .ctl{max-width:none!important;width:auto!important;box-sizing:border-box}
.f0viz .cap{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#5d6977;margin:7px 0 0}
`;
const V={};
const shell=(el,t,fig,ctl,cap)=>{ el.innerHTML=`<p class="lt">${t}</p><figure>${fig}</figure>${ctl?`<div class="ctl">${ctl}</div>`:""}<p class="out" aria-live="polite"></p><p class="cap">${cap}</p>`; const c=el.querySelector(".ctl"); if(c){ const sl=document.createElement("div"), bt=document.createElement("div"); sl.className="sl"; bt.className="bt"; Array.from(c.children).forEach(ch=>(ch.tagName==="LABEL"&&ch.querySelector("input[type=range]")?sl:bt).appendChild(ch)); if(sl.children.length) c.appendChild(sl); if(bt.children.length) c.appendChild(bt); }
  return {out:el.querySelector(".out"),q:s=>el.querySelector(s),qa:s=>el.querySelectorAll(s)}; };
const rng=(id,lab,min,max,val,step,unit)=>`<label>${lab}<input type="range" data-k="${id}" min="${min}" max="${max}" value="${val}" step="${step||1}" aria-label="${lab}"><span class="rv"><output data-o="${id}"></output>${unit||""}</span></label>`;
const bind=(el,fn)=>{ const get=()=>{ const o={}; el.querySelectorAll("[data-k]").forEach(i=>{ o[i.dataset.k]=i.type==="checkbox"?i.checked:+i.value; }); return o; }; const run=()=>{ try{ fn(get()); }catch(e){ try{ console.error("F0Viz",e); }catch(_){} } }; el.addEventListener("input",run); el.addEventListener("change",run); run(); return run; };
const setO=(el,k,v)=>{ const o=el.querySelector(`[data-o="${k}"]`); if(o) o.textContent=v; };
const btns=(el,attr,fn)=>{ const bs=el.querySelectorAll(`[${attr}]`); const pick=v=>{ bs.forEach(b=>b.setAttribute("aria-pressed",b.getAttribute(attr)===String(v)?"true":"false")); fn(v); }; bs.forEach(b=>b.addEventListener("click",()=>pick(b.getAttribute(attr)))); return pick; };
/* filtro global de aeronaves (POH/SOP): ver F0AC en las páginas */
const AFS=["cz","c1","pi"], acHas=a=>!window.F0AC||window.F0AC.has(a), acFirst=()=>AFS.find(acHas)||"cz";
const acBtns=(el,attr)=>{ el.querySelectorAll(`[${attr}]`).forEach(b=>{ b.hidden=!acHas(b.getAttribute(attr)); }); };
const acSub=fn=>{ if(window.F0AC) window.F0AC.onChange(()=>{ try{ fn(); }catch(e){ try{ console.error("F0Viz",e); }catch(_){} } }); };
const acNames={cz:"Cruiser",c1:"C172",pi:"Piper"};
const pol=(cx,cy,r,brg)=>[cx+r*Math.sin(brg*R),cy-r*Math.cos(brg*R)];
const wedge=(cx,cy,r,a,b)=>{ const p=pol(cx,cy,r,a), q=pol(cx,cy,r,b), big=((b-a+360)%360)>180?1:0; return `M${cx} ${cy}L${p[0].toFixed(1)} ${p[1].toFixed(1)}A${r} ${r} 0 ${big} 1 ${q[0].toFixed(1)} ${q[1].toFixed(1)}Z`; };

/* ---------- 1 · Luces de navegación en 3D ---------- */
V.navl={t:"3D · Luces de navegación: qué ves y qué significa",cap:"Roja a la izquierda y verde a la derecha, cada una visible 110° desde el morro; blanca de cola, 140° hacia atrás. Fuera de su sector solo queda el reflejo del farol. Modelo 3D: gira el avión con el deslizador.",
init(el){
  const u=shell(el,this.t,`<canvas height="250"></canvas>`,rng("psi","Rumbo del otro avión respecto a ti",0,359,35,1,"°")+`<button type="button" data-auto aria-pressed="false">Girar solo</button>`,this.cap), c=u.q("canvas"); let psi=35, auto=false, env=null, timer=0, last=0;
  const need=()=>window.F0Real&&window.F0Real.plane3D?Promise.resolve():new Promise((ok,ko)=>{ const s=document.createElement("script"); s.src=(window.F0VIZ_BASE||"../")+"real.js"; s.onload=()=>window.F0Real&&window.F0Real.plane3D?ok():ko(new Error("real.js")); s.onerror=ko; document.head.appendChild(s); });
  const say=()=>{ const PD=window.F0Real.PD, PSI=psi*R, cw=[-PD[0],-PD[1],-PD[2]], cf=cw[0]*Math.cos(PSI)+cw[2]*Math.sin(PSI), cr=-cw[0]*Math.sin(PSI)+cw[2]*Math.cos(PSI), az=Math.atan2(cr,cf)/R, a=Math.abs(az);
    u.out.innerHTML=a<8?"Ves <b>roja y verde a la vez</b>: viene <b>de frente</b>. Los dos viráis a la <b>derecha</b>.":a>112?"Ves solo la <b>blanca de cola</b>: lo tienes por detrás, dentro de su sector de 140°. Si te acercas, eres tú quien <b>alcanza</b>: te apartas y adelantas por su <b>derecha</b>.":az>0?"Ves su <b class=\"ok\">verde</b>: te enseña el costado <b>derecho</b> y cruza de tu izquierda a tu derecha. Viene por tu izquierda: <b>tú tienes preferencia</b>, pero vigílalo.":"Ves su <b class=\"bad\">roja</b>: te enseña el costado <b>izquierdo</b> y cruza de tu derecha a tu izquierda. Está a tu derecha: <b>cedes tú el paso</b>."; };
  const draw=()=>{ const d=Math.min(2,window.devicePixelRatio||1), w=Math.round((c.clientWidth||300)*d), h=Math.round(250*d); if(c.width!==w||c.height!==h){ c.width=w; c.height=h; } const x=c.getContext("2d"); x.setTransform(1,0,0,1,0,0); x.globalAlpha=1; x.globalCompositeOperation="source-over";
    const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,"#050a16"); g.addColorStop(.62,"#122036"); g.addColorStop(.63,"#0c1522"); g.addColorStop(1,"#070c14"); x.fillStyle=g; x.fillRect(0,0,w,h);
    x.fillStyle="#fff"; for(let i=0;i<40;i++){ x.globalAlpha=.25+.5*((i*37)%10)/10; x.fillRect(((i*73.7)%1+i*.618)%1*w,((i*31)%17)/17*h*.55,d,d); } x.globalAlpha=1;
    const pm=Math.min(w/15,h/6.2); window.F0Real.plane3D(x,w/2-pm*1.2*Math.cos(psi*R),h*.74,pm,{psi:psi*R,pitch:0,roll:0,ll:1},env,performance.now()/1000); x.globalAlpha=1; x.globalCompositeOperation="source-over"; };
  need().then(()=>{ env=window.F0Real.envAt(new Date(Date.UTC(2026,5,21,23,30)),.05);
    bind(el,o=>{ psi=o.psi; setO(el,"psi",String(psi).padStart(3,"0")); say(); draw(); });
    u.q("[data-auto]").addEventListener("click",e=>{ auto=!auto; e.currentTarget.setAttribute("aria-pressed",auto); });
    timer=setInterval(()=>{ if(!el.isConnected){ clearInterval(timer); return; } if(document.hidden||!c.offsetParent) return; const r=c.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight) return;
      if(auto){ psi=(psi+1.5)%360; const i=u.q('[data-k="psi"]'); i.value=Math.round(psi); setO(el,"psi",String(Math.round(psi)).padStart(3,"0")); say(); } draw(); },70);
  }).catch(()=>{ u.out.textContent="No se ha podido cargar el modelo 3D. Recarga la página con conexión."; });
}};

/* ---------- 2 · Entradas en espera ---------- */
V.hold={t:"Entradas en la espera: directa, paralela o desplazada (gota)",cap:"Espera de ejemplo con tramo de acercamiento 270°. El sector lo decide el rumbo con el que llegas al punto, con ±5° de flexibilidad en los límites. Virajes a la derecha = espera estándar; a la izquierda = no estándar. La trayectoria es esquemática (sin viento).",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 300" role="img" aria-label="Sectores de entrada en una espera y trayectoria animada"><g data-bg></g><path data-tr fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path data-tc fill="none" stroke="#ffc94d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><g data-pl><path d="M0 -11L7 9L0 5L-7 9Z" stroke="#12202f" stroke-width="1"/></g></svg>`,rng("h","Rumbo con el que llegas al punto",0,359,120,1,"°")+`<button type="button" data-side="R" aria-pressed="true">Estándar (derecha)</button><button type="button" data-side="L" aria-pressed="false">No estándar (izquierda)</button><button type="button" data-go>▶ Repetir</button>`,this.cap), svg=u.q("svg"), bg=u.q("[data-bg]"), tr=u.q("[data-tr]"), tc=u.q("[data-tc]"), pl=u.q("[data-pl]");
  const RM=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches), cx=200, cy=150, IB=270, RT=17, LG=112, DS=1.5, col=["","#f6b73c","#58c4f0","#6ee7a0"], n3=a=>((a%360)+360)%360, p3=a=>String(Math.round(n3(a))).padStart(3,"0");
  let side="R", H=120, P=[], nE=0, k=3, i=0, raf=0, last=0, wait=0, vis=true;
  function build(){ const s=side==="R"?1:-1, d=n3((H-IB)*s); k=(d<=110||d>=290)?3:d<180?2:1;
    let x=-105*Math.sin(H*R), y=-105*Math.cos(H*R), h=H; const pts=[[x,y,h]], dth=DS/RT/R;
    const mv=()=>{ x+=DS*Math.sin(h*R); y+=DS*Math.cos(h*R); pts.push([x,y,h]); };
    const fwd=dist=>{ for(let q=0;q<dist;q+=DS) mv(); }, toX=X=>{ let g=0; while(x<X&&g++<400) mv(); };
    const turn=(tg,dir)=>{ tg=n3(tg); if(!dir){ dir=n3(tg-h)<=180?1:-1; } let g=0; while(g++<600){ const df=dir>0?n3(tg-h):n3(h-tg); if(df<=dth){ h=tg; break; } h=n3(h+dir*dth); mv(); } };
    const track=()=>{ let g=0; while(x>DS&&g++<900){ const want=n3(IB-cl(y*2.6,-50,50)), df=((want-h+540)%360)-180; h=n3(h+cl(df,-dth,dth)); mv(); } x=0; y=0; h=IB; pts.push([0,0,IB]); };
    fwd(105); x=0; y=0;
    if(k===3){ turn(90,s); toX(LG); turn(IB,s); track(); }
    else if(k===2){ turn(90-30*s,0); fwd(LG*.95); turn(IB,s); track(); }
    else { turn(90,0); fwd(LG*.85); turn(IB-45*s,-s); track(); }
    nE=pts.length; turn(90,s); toX(LG); turn(IB,s); track(); P=pts; }
  function scene(){ const s=side==="R"?1:-1, y=cy-s*34, name=["","PARALELA (sector 1)","DESPLAZADA o en gota (sector 2)","DIRECTA (sector 3)"][k];
    const pos=(a,b)=>s>0?wedge(cx,cy,118,(IB+a+180)%360,(IB+b+180)%360):wedge(cx,cy,118,(IB-b+180+360)%360,(IB-a+180+360)%360), op=j=>k===j?.36:.11;
    bg.innerHTML=`<rect width="400" height="300" fill="#12202f"/>
     <path d="${pos(290,470)}" fill="${col[3]}" opacity="${op(3)}"/><path d="${pos(110,180)}" fill="${col[2]}" opacity="${op(2)}"/><path d="${pos(180,290)}" fill="${col[1]}" opacity="${op(1)}"/>
     <path d="M${cx} ${cy}H${cx+LG}A17 17 0 0 ${s>0?0:1} ${cx+LG} ${y}H${cx}A17 17 0 0 ${s>0?0:1} ${cx} ${cy}" fill="none" stroke="#dfe8f1" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="5 4"/>
     <path d="M${cx+70} ${cy-4}l-9 4 9 4z" fill="#dfe8f1" opacity=".7"/><path d="M${cx+40} ${y-4}l9 4-9 4z" fill="#dfe8f1" opacity=".7"/>
     <circle cx="${cx}" cy="${cy}" r="5" fill="#ffc94d"/><text x="${cx-9}" y="${cy+s*20+4}" font-size="11" text-anchor="end">punto de espera</text><text x="${cx+56}" y="${cy+s*15+4}" font-size="10" fill="#9fb3c8">acercamiento 270°</text>
     <text x="12" y="20" font-size="11" fill="${col[3]}">■ directa · 180°</text><text x="12" y="36" font-size="11" fill="${col[1]}">■ paralela · 110°</text><text x="12" y="52" font-size="11" fill="${col[2]}">■ desplazada · 70°</text>
     <text x="388" y="290" font-size="10.5" text-anchor="end" fill="#9fb3c8">${s>0?"virajes a la derecha":"virajes a la izquierda"}</text>`;
    tr.setAttribute("stroke",col[k]); pl.firstChild.setAttribute("fill",col[k]);
    u.out.innerHTML=`Llegas con rumbo <b>${p3(H)}°</b> → entrada <b>${name}</b>. `+(k===3?"Sobrevuelas el punto y viras directamente al tramo de alejamiento.":k===2?`Sobrevuelas el punto, tomas un rumbo <b>30° abierto</b> respecto al alejamiento (<b>${p3(IB+180-30*s)}°</b>) hacia dentro de la espera durante 1 min y viras hacia el lado de la espera para interceptar el acercamiento.`:`Sobrevuelas el punto, vuelas <b>paralelo</b> al acercamiento en sentido contrario (090°) durante 1 min, viras a la <b>${s>0?"izquierda":"derecha"}</b> (hacia el lado de la espera) y vuelves al punto.`)+` Después, el circuito normal (en amarillo).`; }
  const seg=(a,b)=>{ let d=""; for(let j=a;j<b;j++) d+=(j===a?"M":"L")+(cx+P[j][0]).toFixed(1)+" "+(cy-P[j][1]).toFixed(1); return d; };
  function paint(){ const n=Math.max(1,Math.min(P.length,Math.round(i))), p=P[n-1]; tr.setAttribute("d",seg(0,Math.min(n,nE))); tc.setAttribute("d",n>nE?seg(nE-1,n):""); pl.setAttribute("transform",`translate(${(cx+p[0]).toFixed(1)} ${(cy-p[1]).toFixed(1)}) rotate(${p[2].toFixed(1)})`); }
  function frame(now){ raf=0; if(!el.isConnected) return; if(!vis||document.hidden){ last=0; return; } const dt=Math.min(.05,last?(now-last)/1000:.016); last=now;
    if(i>=P.length){ wait+=dt; if(wait>1.6){ i=0; wait=0; } } else i+=dt*52; paint(); raf=requestAnimationFrame(frame); }
  const start=()=>{ build(); scene(); i=RM?P.length:0; wait=0; last=0; paint(); if(!RM&&!raf) raf=requestAnimationFrame(frame); };
  if("IntersectionObserver" in window) new IntersectionObserver(es=>{ vis=es.some(e=>e.isIntersecting); if(vis&&!raf&&!RM){ last=0; raf=requestAnimationFrame(frame); } }).observe(svg);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&vis&&!raf&&!RM&&el.isConnected){ last=0; raf=requestAnimationFrame(frame); } });
  u.q("[data-go]").addEventListener("click",start);
  btns(el,"data-side",v=>{ side=v; start(); }); bind(el,o=>{ H=o.h; setO(el,"h",p3(H)); start(); });
}};

/* ---------- 3 · PAPI ---------- */
V.papi={t:"PAPI: lo que ves según tu senda",cap:"Cuatro luces a la izquierda de la pista. Ajustes típicos para una senda de 3°: 2°30', 2°50', 3°10' y 3°30'. «Rojo sobre blanco, vas bien; todo rojo, vas muerto.»",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 190" role="img" aria-label="Indicación del PAPI"></svg>`,rng("a","Ángulo de tu aproximación",20,40,30,1),this.cap), svg=u.q("svg"), SET=[2.5,2.83,3.17,3.5];
  bind(el,o=>{ const a=o.a/10; setO(el,"a",f1(a)+"°"); const nw=SET.filter(s=>a>s).length, x0=250, y0=150, sc=58;   // nw = luces blancas
    let L=""; for(let i=0;i<4;i++){ const white=i<nw; L+=`<circle cx="${52+i*30}" cy="52" r="11" fill="${white?"#fff":"#ff3b30"}" stroke="#0b1622" stroke-width="2"/><circle cx="${52+i*30}" cy="52" r="17" fill="${white?"#fff":"#ff3b30"}" opacity=".18"/>`; }
    const ln=(deg,c,dash)=>`<path d="M${x0} ${y0}L${x0-240} ${y0-240*Math.tan(deg*R)*sc/14}" stroke="${c}" stroke-width="${dash?1:2}" ${dash?'stroke-dasharray="4 4"':""} fill="none"/>`, py=y0-150*Math.tan(a*R)*sc/14;
    svg.innerHTML=`<rect width="400" height="190" fill="#12202f"/><text x="20" y="22" font-size="11" fill="#9fb3c8">Vista desde la cabina (lejos de la pista ← → junto a la pista)</text>${L}
      <rect x="182" y="34" width="60" height="36" rx="3" fill="#2a3442"/><path d="M212 38v28" stroke="#dfe8f1" stroke-width="2" stroke-dasharray="5 4"/><text x="212" y="86" font-size="10" text-anchor="middle" fill="#9fb3c8">pista</text>
      <path d="M0 ${y0}H400" stroke="#3a516b" stroke-width="2"/><rect x="${x0}" y="${y0-3}" width="120" height="6" fill="#2a3442"/>${ln(2.5,"#ff8a80",1)}${ln(3.5,"#fff",1)}${ln(3,"#6ee7a0")}
      <text x="18" y="${y0-240*Math.tan(3*R)*sc/14-6}" font-size="10" fill="#6ee7a0">senda de 3°</text>
      <g transform="translate(${x0-150} ${py})"><path d="M-12 0h20l5 2-5 2h-20zM-10 0l-4-7h4l5 7z" fill="#ffc94d"/></g>`;
    u.out.innerHTML=["<b class=\"bad\">4 rojas</b>: muy bajo (por debajo de 2°30'). Corrige ya o frustra.","<b>3 rojas y 1 blanca</b>: algo bajo.","<b class=\"ok\">2 blancas y 2 rojas</b>: en la senda.","<b>3 blancas y 1 roja</b>: algo alto.","<b>4 blancas</b>: muy alto (por encima de 3°30')."][nw]+" Las rojas quedan siempre del lado de la pista."; });
}};

/* ---------- 4 · Turbina: presión, temperatura y velocidad ---------- */
V.turbine={t:"Reactor: cómo cambian presión, temperatura y velocidad",cap:"Curvas cualitativas de un turborreactor simple. Lo que se pregunta: dónde está el máximo de cada una.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 230" role="img" aria-label="Sección de un reactor con sus curvas"></svg>`,`<label><input type="checkbox" data-k="p" checked>Presión</label><label><input type="checkbox" data-k="t" checked>Temperatura</label><label><input type="checkbox" data-k="v" checked>Velocidad</label>`,this.cap), svg=u.q("svg");
  const X=[20,80,190,250,310,380], pts=a=>a.map((y,i)=>`${i?"L":"M"}${X[i]} ${200-y*1.25}`).join(""), P=[14,20,100,95,34,12], T=[10,12,46,104,70,58], Vv=[30,26,22,34,48,104];
  bind(el,o=>{ svg.innerHTML=`<rect width="400" height="230" fill="#12202f"/>
     <path d="M20 44Q50 36 80 40L190 52L250 44L310 50L380 58V78L310 86L250 92L190 84L80 96Q50 100 20 92Z" fill="#1d3147" stroke="#3a516b"/>
     ${[["admisión",50],["compresor",135],["combustión",220],["turbina",280],["tobera",345]].map(a=>`<text x="${a[1]}" y="30" font-size="10" text-anchor="middle" fill="#9fb3c8">${a[0]}</text>`).join("")}
     ${X.slice(1,5).map(x=>`<path d="M${x} 36V204" stroke="#2c4159" stroke-dasharray="3 4"/>`).join("")}
     ${Array.from({length:7},(_,i)=>`<path d="M${92+i*14} 54V82" stroke="#58c4f0" stroke-width="2.5"/>`).join("")}<ellipse cx="220" cy="68" rx="20" ry="11" fill="#ff7a3c" opacity=".85"/>${[262,278,294].map(x=>`<path d="M${x} 50V86" stroke="#f6b73c" stroke-width="3"/>`).join("")}
     <path d="M20 204H384" stroke="#3a516b"/>
     ${o.p?`<path d="${pts(P)}" fill="none" stroke="#58c4f0" stroke-width="2.6"/><circle cx="190" cy="${200-125}" r="4" fill="#58c4f0"/><text x="186" y="${200-131}" font-size="10" text-anchor="end" fill="#58c4f0">P máx.</text>`:""}
     ${o.t?`<path d="${pts(T)}" fill="none" stroke="#ff8a80" stroke-width="2.6"/><circle cx="250" cy="${200-130}" r="4" fill="#ff8a80"/><text x="256" y="${200-134}" font-size="10" fill="#ff8a80">T máx.</text>`:""}
     ${o.v?`<path d="${pts(Vv)}" fill="none" stroke="#6ee7a0" stroke-width="2.6"/><circle cx="380" cy="${200-130}" r="4" fill="#6ee7a0"/><text x="376" y="${200-136}" font-size="10" text-anchor="end" fill="#6ee7a0">V máx.</text>`:""}`;
    u.out.innerHTML=`<b>Presión</b> máxima: a la salida del compresor (difusor). <b>Temperatura</b> máxima: en la cámara de combustión. <b>Velocidad</b> máxima: en la tobera de escape. En la combustión la presión se mantiene casi constante (cae un poco).`; });
}};

/* ---------- 5 · TCAS ---------- */
V.tcas={t:"TCAS II: de tráfico a resolución",cap:"Los umbrales dependen de la altitud (nivel de sensibilidad): TA entre 20 y 48 s y RA entre 15 y 35 s antes del punto de máximo acercamiento. Aquí, valores típicos de altura media.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 240" role="img" aria-label="Pantalla TCAS"></svg>`,rng("t","Tiempo hasta el punto de máximo acercamiento",0,70,60,1," s"),this.cap), svg=u.q("svg");
  bind(el,o=>{ const t=70-o.t; setO(el,"t",t); const cx=200, cy=190, y=cy-12-t*2.3, st=t<=25?3:t<=40?2:t<=55?1:0;
    const sym=[`<path d="M0 -8L7 0L0 8L-7 0Z" fill="none" stroke="#58c4f0" stroke-width="2"/>`,`<path d="M0 -8L7 0L0 8L-7 0Z" fill="#58c4f0"/>`,`<circle r="8" fill="#f6b73c"/>`,`<rect x="-8" y="-8" width="16" height="16" fill="#ff3b30"/>`][st], colr=["#58c4f0","#58c4f0","#f6b73c","#ff3b30"][st];
    svg.innerHTML=`<rect width="400" height="240" fill="#0b1622"/><circle cx="${cx}" cy="${cy}" r="${25*2.3+12}" fill="none" stroke="#ff3b30" stroke-dasharray="3 5" opacity=".7"/><circle cx="${cx}" cy="${cy}" r="${40*2.3+12}" fill="none" stroke="#f6b73c" stroke-dasharray="3 5" opacity=".7"/>
      <text x="${cx+74}" y="${cy-4}" font-size="10" fill="#ff8a80">RA ≈ 25 s</text><text x="${cx+108}" y="${cy-26}" font-size="10" fill="#f6b73c">TA ≈ 40 s</text>
      <path d="M${cx} ${cy-9}l6 14-6-3-6 3z" fill="#fff"/><g transform="translate(${cx} ${y})">${sym}<text x="13" y="-2" font-size="11" fill="${colr}">${st===3?"−02":"−0"+(t>50?"9":t>40?"6":"4")} ↑</text></g>`;
    u.out.innerHTML=[`<b>Otro tráfico</b> (rombo hueco): lejos y sin amenaza.`,`<b>Tráfico próximo</b> (rombo relleno): a menos de 6 NM y ±1 200 ft. Sin acción.`,`<b style="color:#f6b73c">TA · «TRAFFIC, TRAFFIC»</b> (círculo ámbar): búscalo fuera. <b>No maniobres</b> con un TA.`,`<b class="bad">RA · «CLIMB, CLIMB»</b> (cuadrado rojo): sigue la orden <b>vertical</b> de inmediato, aunque el ATC diga otra cosa, y avisa «TCAS RA».`][st]; });
}};

/* ---------- 6 · Balanza de masas y centrado ---------- */
V.balance={t:"Masa × brazo = momento: mueve la carga y mira el CG",cap:"Avión de ejemplo: 700 kg en vacío con el CG a 2,20 m del datum. Límites de CG: 2,15 m (delantero) y 2,45 m (trasero).",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 190" role="img" aria-label="Balanza de centrado"></svg>`,rng("m","Carga",0,300,160,5," kg")+rng("b","Brazo de la carga",150,400,300,5," m"),this.cap), svg=u.q("svg"), X=a=>40+(a-1.4)*120;
  bind(el,o=>{ const m=o.m, b=o.b/100, M0=700, B0=2.2, mt=M0+m, cg=(M0*B0+m*b)/mt, ok=cg>=2.15&&cg<=2.45; setO(el,"m",m); setO(el,"b",b.toFixed(2).replace(".",","));
    svg.innerHTML=`<rect width="400" height="190" fill="#12202f"/><rect x="${X(2.15)}" y="96" width="${X(2.45)-X(2.15)}" height="14" fill="#6ee7a0" opacity=".3"/><text x="${(X(2.15)+X(2.45))/2}" y="62" font-size="10" text-anchor="middle" fill="#6ee7a0">límites de CG</text>
      <path d="M30 110H372" stroke="#dfe8f1" stroke-width="4"/>${[1.5,2,2.5,3,3.5,4].map(a=>`<path d="M${X(a)} 110v6" stroke="#9fb3c8"/><text x="${X(a)}" y="128" font-size="9.5" text-anchor="middle" fill="#9fb3c8">${f1(a)} m</text>`).join("")}
      <rect x="${X(B0)-26}" y="${110-40}" width="52" height="38" rx="4" fill="#3a516b"/><text x="${X(B0)}" y="${110-17}" font-size="11" text-anchor="middle">700 kg</text>
      ${m?`<rect x="${X(b)-18}" y="${110-8-m*.16}" width="36" height="${6+m*.16}" rx="3" fill="#f6b73c"/><text x="${X(b)}" y="${110-12-m*.16}" font-size="11" text-anchor="middle" fill="#f6b73c">${m} kg</text>`:""}
      <path d="M${X(cg)} 114l-11 20h22z" fill="${ok?"#6ee7a0":"#ff3b30"}"/><text x="${X(cg)}" y="150" font-size="12" text-anchor="middle" fill="${ok?"#6ee7a0":"#ff8a80"}" font-weight="700">CG ${cg.toFixed(2).replace(".",",")} m</text>
      <text x="30" y="176" font-size="10" fill="#9fb3c8">datum →</text>`;
    u.out.innerHTML=`Momento total = 700 × 2,20 + ${m} × ${b.toFixed(2).replace(".",",")} = <b>${f0(M0*B0+m*b)} kg·m</b> · masa total <b>${mt} kg</b> → CG = <b>${cg.toFixed(2).replace(".",",")} m</b>. ${ok?'<span class="ok">Dentro de límites.</span>':cg<2.15?'<span class="bad">Fuera por delante: más estable, pero cuesta rotar y recoger.</span>':'<span class="bad">Fuera por detrás: inestable; es el caso más peligroso.</span>'}`; });
}};

/* ---------- 7 · Vx, Vy y el viento ---------- */
V.climb={t:"Vx y Vy: el viento cambia el ángulo, no el régimen",cap:"Avión de ejemplo: Vx 62 kt con 640 ft/min y Vy 76 kt con 720 ft/min. Obstáculo de 300 ft a 0,5 NM del final de la pista.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 210" role="img" aria-label="Trayectorias de ascenso"></svg>`,rng("w","Viento (− en cola · + en cara)",-25,25,0,1," kt"),this.cap), svg=u.q("svg");
  bind(el,o=>{ const hw=o.w; setO(el,"w",(hw>0?"+":"")+hw); const A=[{n:"Vx",tas:62,roc:640,c:"#f6b73c"},{n:"Vy",tas:76,roc:720,c:"#58c4f0"}], D=.5, XS=440, YS=.3, x0=40, y0=180;
    A.forEach(a=>{ a.gs=a.tas-hw; a.hd=a.roc*(D/a.gs*60); a.gr=a.roc/(a.gs*101.27)*100; });
    svg.innerHTML=`<rect width="400" height="210" fill="#12202f"/><path d="M0 ${y0}H400" stroke="#3a516b" stroke-width="2"/><rect x="0" y="${y0-3}" width="${x0}" height="6" fill="#2a3442"/>
      <rect x="${x0+D*XS-6}" y="${y0-300*YS}" width="12" height="${300*YS}" fill="#5d6977"/><text x="${x0+D*XS}" y="${y0-300*YS-5}" font-size="10" text-anchor="middle" fill="#9fb3c8">300 ft</text>
      ${A.map(a=>{ const xe=.76, he=a.roc*(xe/a.gs*60), yy=Math.max(8,y0-he*YS), xx=he*YS>y0-8?x0+xe*XS*((y0-8)/(he*YS)):x0+xe*XS; return `<path d="M${x0} ${y0}L${xx.toFixed(1)} ${yy.toFixed(1)}" stroke="${a.c}" stroke-width="2.6"/><text x="${Math.min(372,xx+4)}" y="${yy+4}" font-size="11" fill="${a.c}">${a.n}</text><circle cx="${x0+D*XS}" cy="${Math.max(8,y0-a.hd*YS)}" r="3.5" fill="${a.c}"/>`; }).join("")}
      <text x="${x0+D*XS/2}" y="${y0+18}" font-size="10" text-anchor="middle" fill="#9fb3c8">0,5 NM</text><g transform="translate(330 30)"><path d="M${hw>=0?24:-24} 0H${hw>=0?-18:18}m0 0l${hw>=0?8:-8} -5m${hw>=0?-8:8} 5l${hw>=0?8:-8} 5" stroke="#dfe8f1" stroke-width="2" fill="none" opacity="${hw?1:.25}"/><text y="20" font-size="10" text-anchor="middle" fill="#9fb3c8">${hw>0?"viento en cara":hw<0?"viento en cola":"calma"}</text></g>`;
    u.out.innerHTML=A.map(a=>`<b style="color:${a.c}">${a.n}</b>: ${a.roc} ft/min · gradiente <b>${f1(a.gr)} %</b> · sobre el obstáculo a <b class="${a.hd>=350?"ok":a.hd>=300?"":"bad"}">${f0(a.hd)} ft</b>`).join("<br>")+`<br>El régimen (ft/min) no cambia con el viento; el gradiente sobre el suelo, sí: el viento en cara lo <b>mejora</b>.`; });
}};

/* ---------- 8 · PET y PSR ---------- */
V.pet={t:"PET y PSR: muévelos con el viento",cap:"O = velocidad sobre el suelo en la ida; H = en la vuelta. PET = D × H ÷ (O + H). PSR (tiempo) = autonomía × H ÷ (O + H).",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 150" role="img" aria-label="Posición del PET y del PSR en la ruta"></svg>`,rng("d","Distancia A–B",300,1500,900,50," NM")+rng("v","TAS",120,480,300,10," kt")+rng("w","Viento en la ida (− cola · + cara)",-80,80,40,5," kt")+rng("e","Autonomía segura",2,10,5,.5," h"),this.cap), svg=u.q("svg");
  bind(el,o=>{ const D=o.d, O=o.v-o.w, H=o.v+o.w, E=o.e; ["d","v","e"].forEach(k=>setO(el,k,String(o[k]).replace(".",","))); setO(el,"w",(o.w>0?"+":"")+o.w);
    const pet=D*H/(O+H), tpet=pet/O, tp=E*H/(O+H), psr=tp*O, X=x=>30+cl(x/D,0,1.06)*320;
    svg.innerHTML=`<rect width="400" height="150" fill="#12202f"/><path d="M30 80H350" stroke="#dfe8f1" stroke-width="3"/><circle cx="30" cy="80" r="6" fill="#dfe8f1"/><circle cx="350" cy="80" r="6" fill="#dfe8f1"/><text x="30" y="104" font-size="12" text-anchor="middle">A</text><text x="350" y="104" font-size="12" text-anchor="middle">B</text>
      <path d="M190 80V44" stroke="#5d6977" stroke-dasharray="3 3"/><text x="190" y="38" font-size="9.5" text-anchor="middle" fill="#9fb3c8">mitad</text>
      <path d="M${X(pet)} 80V54" stroke="#6ee7a0" stroke-width="2"/><circle cx="${X(pet)}" cy="80" r="5" fill="#6ee7a0"/><text x="${X(pet)}" y="26" font-size="11" text-anchor="middle" fill="#6ee7a0">PET</text>
      <path d="M${X(psr)} 80V112" stroke="#f6b73c" stroke-width="2"/><circle cx="${X(psr)}" cy="80" r="5" fill="#f6b73c"/><text x="${X(psr)}" y="128" font-size="11" text-anchor="middle" fill="#f6b73c">PSR${psr>D?" (más allá de B)":""}</text>
      <path d="M${o.w>=0?120:80} 138H${o.w>=0?80:120}m0 0l${o.w>=0?7:-7} -4m${o.w>=0?-7:7} 4l${o.w>=0?7:-7} 4" stroke="#9fb3c8" stroke-width="1.6" fill="none" opacity="${o.w?1:.2}"/><text x="130" y="142" font-size="10" fill="#9fb3c8">${o.w?"viento":"sin viento"}</text>`;
    const hm=t=>{ const h=Math.floor(t), m=Math.round((t-h)*60); return h+" h "+String(m).padStart(2,"0")+" min"; };
    u.out.innerHTML=`O = <b>${O} kt</b> · H = <b>${H} kt</b><br><b class="ok">PET</b>: a <b>${f0(pet)} NM</b> de A (${hm(tpet)}). ${o.w>0?"Con viento en cara en la ida queda <b>más allá de la mitad</b>: se desplaza hacia el viento.":o.w<0?"Con viento en cola en la ida queda <b>antes de la mitad</b>.":"Sin viento, justo en la mitad."}<br><b style="color:#f6b73c">PSR</b>: a <b>${f0(psr)} NM</b> de A (${hm(tp)} de ida). ${o.w?"Cualquier viento lo <b>acorta</b> respecto a la calma ("+f0(E*o.v/2)+" NM).":"Es el máximo: con viento siempre será menor."}`; });
}};

/* ---------- 9 · Estabilidad: ELR frente a DALR y SALR ---------- */
V.stabil={t:"Estabilidad: compara el gradiente real con las adiabáticas",cap:"DALR 1 °C/100 m (3 °C/1 000 ft) · SALR 0,6 °C/100 m (≈ 1,8 °C/1 000 ft) de media. ELR = gradiente real del ambiente.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 240" role="img" aria-label="Curvas de estado y adiabáticas"></svg>`,rng("e","Gradiente real (ELR)",-4,14,7,1," °C/100 m"),this.cap), svg=u.q("svg"), X=t=>60+(t+20)*7.6, Y=h=>210-h*.062;
  bind(el,o=>{ const e=o.e/10; setO(el,"e",f1(e)); const ln=(g,c,w,d)=>`<path d="M${X(20)} ${Y(0)}L${X(20-g*30)} ${Y(3000)}" stroke="${c}" stroke-width="${w}" ${d?`stroke-dasharray="${d}"`:""} fill="none"/>`;
    const k=e>1?0:e>.6?1:e>0?2:e===0?3:4, col=["#ff8a80","#f6b73c","#6ee7a0","#6ee7a0","#58c4f0"][k];
    svg.innerHTML=`<rect width="400" height="240" fill="#12202f"/><path d="M60 14V210H384" stroke="#3a516b" fill="none"/>${[0,1000,2000,3000].map(h=>`<text x="54" y="${Y(h)+4}" font-size="9.5" text-anchor="end" fill="#9fb3c8">${h} m</text><path d="M60 ${Y(h)}H384" stroke="#1d3147"/>`).join("")}
      ${[-20,-10,0,10,20].map(t=>`<text x="${X(t)}" y="226" font-size="9.5" text-anchor="middle" fill="#9fb3c8">${t} °C</text>`).join("")}
      <path d="M${X(20)} ${Y(0)}L${X(-10)} ${Y(3000)}L${X(2)} ${Y(3000)}Z" fill="#f6b73c" opacity=".12"/>
      ${ln(1,"#dfe8f1",1.6,"6 4")}${ln(.6,"#dfe8f1",1.6,"2 4")}${ln(e,col,3.2)}
      <text x="${X(-10)-4}" y="${Y(3000)-5}" font-size="10" text-anchor="end">DALR</text><text x="${X(2)+4}" y="${Y(3000)-5}" font-size="10">SALR</text><text x="${cl(X(20-e*30),70,350)}" y="${Y(3000)+14}" font-size="10" text-anchor="middle" fill="${col}" font-weight="700">ELR</text>`;
    u.out.innerHTML=[`<b class="bad">Inestabilidad absoluta</b> (ELR mayor que la DALR): cualquier burbuja sigue subiendo, saturada o no. Convección fuerte.`,`<b style="color:#f6b73c">Inestabilidad condicional</b> (ELR entre SALR y DALR): estable para el aire <b>seco</b>, inestable si está <b>saturado</b>. Es lo más habitual.`,`<b class="ok">Estabilidad absoluta</b> (ELR menor que la SALR): la burbuja queda más fría que el entorno y vuelve a bajar. Estratos, calima, aire tranquilo.`,`<b class="ok">Isotermia</b>: la temperatura no cambia con la altura. Muy estable.`,`<b style="color:#58c4f0">Inversión</b>: la temperatura <b>sube</b> con la altura. Estabilidad máxima: tapa la convección, atrapa humo y niebla, y suele traer cizalladura.`][k]; });
}};

/* ---------- 10 · Fases de la tormenta ---------- */
V.tstorm={t:"Las tres fases de una tormenta",cap:"Una célula aislada dura alrededor de una hora. La fase de madurez empieza con la primera precipitación que llega al suelo.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 230" role="img" aria-label="Fases de una célula de tormenta"></svg>`,`<button type="button" data-ph="0" aria-pressed="true">1 · Cúmulo</button><button type="button" data-ph="1" aria-pressed="false">2 · Madurez</button><button type="button" data-ph="2" aria-pressed="false">3 · Disipación</button>`,this.cap), svg=u.q("svg");
  const up=(x,y1,y2)=>`<path d="M${x} ${y1}V${y2}m0 0l-6 9m6-9l6 9" stroke="#ff8a80" stroke-width="2.6" fill="none"/>`, dn=(x,y1,y2)=>`<path d="M${x} ${y1}V${y2}m0 0l-6 -9m6 9l6 -9" stroke="#58c4f0" stroke-width="2.6" fill="none"/>`;
  const rain=(x0,x1,n)=>Array.from({length:n},(_,i)=>`<path d="M${x0+(x1-x0)*i/(n-1)} 176l-4 22" stroke="#9fd0ff" stroke-width="1.6"/>`).join("");
  btns(el,"data-ph",v=>{ v=+v; const cloud=["M150 170Q130 168 134 150Q118 140 136 122Q134 96 164 96Q176 70 204 82Q236 70 246 100Q272 104 264 130Q282 148 258 164Q254 172 240 170Z",
      "M120 172Q98 168 106 146Q88 128 112 112Q104 80 138 74Q120 50 96 44H316Q288 50 270 74Q300 86 290 116Q312 134 292 152Q300 170 276 172Z",
      "M130 150Q112 148 118 130Q104 112 130 100Q112 70 84 62H326Q296 70 276 98Q296 112 282 132Q292 148 270 150Z"][v];
    svg.innerHTML=`<rect width="400" height="230" fill="#12202f"/><path d="M0 200H400" stroke="#3a516b" stroke-width="2"/><path d="${cloud}" fill="${v===2?"#5d6977":"#aab8c8"}" opacity="${v===2?.8:.92}"/>
      ${v===0?up(170,166,112)+up(200,170,98)+up(232,166,112):v===1?up(150,166,90)+up(180,170,70)+dn(232,86,188)+dn(262,96,188)+rain(222,276,6)+`<path d="M92 200q30-18 60 0" stroke="#58c4f0" stroke-width="2" fill="none" stroke-dasharray="4 4"/><text x="60" y="216" font-size="10" fill="#58c4f0">frente de racha</text>`:dn(160,96,188)+dn(200,90,188)+dn(240,96,188)+rain(150,250,7)}
      <text x="12" y="20" font-size="11" fill="#9fb3c8">${["tropopausa lejos · techo en ascenso","yunque en la tropopausa","solo queda el yunque"][v]}</text><text x="388" y="20" font-size="11" text-anchor="end" fill="#ffc94d">${["15–20 min","20–30 min","30 min o más"][v]}</text>`;
    u.out.innerHTML=[`<b>Cúmulo</b> (crecimiento): <b>solo ascendencias</b>, sin precipitación al suelo. Engelamiento y turbulencia dentro de la nube.`,`<b class="bad">Madurez</b>: <b>ascendencias y descendencias</b> a la vez. Empieza con la primera lluvia. Es la más violenta: granizo, rayos, turbulencia severa, frente de racha y microrráfagas.`,`<b>Disipación</b>: <b>solo descendencias</b>. La lluvia afloja y la nube se deshace desde abajo, pero aún puede haber rayos y cizalladura.`][v]; })(0);
}};

/* ---------- 11 · Mach crítico y onda de choque ---------- */
V.mach={t:"Del Mach crítico a la onda de choque",cap:"Perfil de ejemplo con Mcrit = 0,72. El aire se acelera sobre el extradós: allí se alcanza Mach 1 mucho antes de que el avión vuele a Mach 1.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 200" role="img" aria-label="Perfil con zona supersónica y onda de choque"></svg>`,rng("m","Mach de vuelo",60,98,66,1),this.cap), svg=u.q("svg");
  bind(el,o=>{ const M=o.m/100, MC=.72; setO(el,"m","M "+M.toFixed(2).replace(".",",")); const k=cl((M-MC)/.24,0,1), xs=150+k*150, hs=10+k*46, lo=cl((M-.84)/.14,0,1), xl=190+lo*105;
    svg.innerHTML=`<rect width="400" height="200" fill="#12202f"/>${[40,70,150,180].map((y,i)=>`<path d="M10 ${y}H60Q200 ${y+(i<2?-16*(2-i)*.5:6)} 390 ${y}" stroke="#2c4159" fill="none"/>`).join("")}
      ${M>MC?`<path d="M96 100Q${(96+xs)/2} ${100-hs*1.9} ${xs} ${112-k*4}Z" fill="#ff8a80" opacity=".28"/><path d="M${xs} ${112-k*4}V${112-k*4-hs*1.05}" stroke="#ff3b30" stroke-width="3"/><text x="${xs+5}" y="${104-hs}" font-size="10" fill="#ff8a80">onda de choque</text><text x="${(100+xs)/2}" y="${92-hs*.4}" font-size="10" text-anchor="middle" fill="#ffc9c4">M &gt; 1</text>${k>.25?`<path d="M${xs+3} ${112-k*4}q14 -${6+k*9} 30 -2q14 -${4+k*8} 28 0" stroke="#f6b73c" stroke-width="1.6" fill="none"/><text x="${Math.min(330,xs+34)}" y="${128-k*4}" font-size="9.5" fill="#f6b73c">flujo desprendido</text>`:""}`:""}
      ${lo>0?`<path d="M120 122Q${(120+xl)/2} ${124+lo*30} ${xl} 120Z" fill="#ff8a80" opacity=".22"/><path d="M${xl} 120V${120+10+lo*22}" stroke="#ff3b30" stroke-width="2.4"/>`:""}
      <path d="M70 116Q76 96 130 92Q230 88 340 118Q230 128 130 126Q78 126 70 116Z" fill="#dfe8f1"/>
      <text x="14" y="22" font-size="11" fill="#9fb3c8">flujo libre →</text>`;
    u.out.innerHTML=M<MC-.005?`Por debajo de <b>Mcrit</b>: todo el flujo es subsónico. Solo cuenta la compresibilidad.`:M<MC+.03?`<b>Mcrit (0,72)</b>: aparece el primer punto a <b>Mach 1 local</b> sobre el extradós. Todavía sin onda de choque apreciable ni aumento brusco de resistencia.`:M<.86?`Zona supersónica sobre el ala, cerrada por una <b>onda de choque normal</b>. Detrás, la capa límite se desprende: <b>resistencia de onda</b> y bataneo de alta velocidad. La resistencia se dispara (Mach de divergencia).`:`La onda del extradós se va hacia el borde de salida y aparece otra en el intradós. El centro de presiones se retrasa: el avión tiende a <b>picar (Mach tuck)</b>; lo compensa el Mach trim.`; });
}};

/* ---------- 12 · RNP ---------- */
V.rnp={t:"RNP: qué significa el número",cap:"El avión debe estar dentro de ±1 × RNP el 95 % del tiempo de vuelo. El límite de contención es ±2 × RNP. RNP = RNAV + vigilancia y alerta a bordo.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 170" role="img" aria-label="Pasillo de navegación RNP"></svg>`,[["10","RNAV 10"],["4","RNP 4"],["5","RNAV 5"],["1","RNAV 1 / RNP 1"],["0.3","RNP APCH final"]].map((a,i)=>`<button type="button" data-rnp="${a[0]}|${a[1]}" aria-pressed="${i===3}">${a[1]}</button>`).join(""),this.cap), svg=u.q("svg");
  const USE={"RNAV 10":"oceánico y remoto; se sigue llamando «RNP 10» aunque <b>no exige</b> alerta a bordo.","RNP 4":"oceánico y remoto con separaciones reducidas; exige alerta a bordo.","RNAV 5":"ruta continental (B-RNAV en Europa).","RNAV 1 / RNP 1":"salidas, llegadas y tramos iniciales (P-RNAV en Europa para RNAV 1).","RNP APCH final":"tramo final de una aproximación RNP: 0,3 NM (1 NM en inicial, intermedio y frustrada)."};
  btns(el,"data-rnp",v=>{ const [n,name]=v.split("|"), x=+n, h=x>=10?30:x>=4?26:x>=1?20:13;
    svg.innerHTML=`<rect width="400" height="170" fill="#12202f"/><rect x="20" y="${85-2*h}" width="360" height="${4*h}" fill="#f6b73c" opacity=".14"/><rect x="20" y="${85-h}" width="360" height="${2*h}" fill="#6ee7a0" opacity=".22"/>
      <path d="M20 85H380" stroke="#dfe8f1" stroke-dasharray="8 6"/><path d="M40 ${85+h*.4}q60 -${h*.9} 120 -${h*.2}t120 ${h*.5}t80 -${h*.6}" stroke="#ffc94d" stroke-width="2" fill="none"/><path d="M356 ${85-h*.42}l14 3-10 8z" fill="#ffc94d"/>
      <text x="386" y="${85-h+4}" font-size="10" text-anchor="end" fill="#6ee7a0">±${String(x).replace(".",",")} NM · 95 %</text><text x="386" y="${85-2*h+12}" font-size="10" text-anchor="end" fill="#f6b73c">±${String(2*x).replace(".",",")} NM · contención</text>`;
    u.out.innerHTML=`<b>${name}</b>: precisión lateral de <b>${String(x).replace(".",",")} NM</b> el 95 % del tiempo. Uso: ${USE[name]}`; })("1|RNAV 1 / RNP 1");
}};

/* ---------- 13 · Microrráfaga en aproximación ---------- */
V.wshear={t:"Microrráfaga en final: lo que le pasa al avión",cap:"Diámetro de unos 4 km y vida de 1 a 5 minutos. La primera señal (la IAS sube) invita a quitar potencia: es justo lo contrario de lo que hará falta después.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 220" role="img" aria-label="Aproximación a través de una microrráfaga"></svg>`,rng("x","Posición en la aproximación",0,100,10,1," %"),this.cap), svg=u.q("svg");
  bind(el,o=>{ const p=o.x/100; setO(el,"x",o.x); const x=30+p*300, gs=y=>70+(y-30)*.393, dev=p<.3?-14*Math.sin(p/.3*Math.PI/2):p<.5?-14+ (p-.3)/.2*14:p<.85?(p-.5)/.35*34:34, y=gs(x)+dev, ph=p<.3?0:p<.5?1:p<.85?2:3;
    const ar=(x1,y1,x2,y2)=>{ const a=Math.atan2(y2-y1,x2-x1); return `<path d="M${x1} ${y1}L${x2} ${y2}M${x2} ${y2}l${-8*Math.cos(a-.5)} ${-8*Math.sin(a-.5)}M${x2} ${y2}l${-8*Math.cos(a+.5)} ${-8*Math.sin(a+.5)}" stroke="#58c4f0" stroke-width="2" fill="none"/>`; };
    svg.innerHTML=`<rect width="400" height="220" fill="#12202f"/><path d="M110 8Q90 6 96 22Q84 34 104 40H250Q270 34 258 22Q262 6 240 8Z" fill="#5d6977"/>
      ${ar(160,44,160,150)}${ar(180,44,180,160)}${ar(200,44,200,150)}${ar(152,172,78,180)}${ar(208,172,282,180)}
      <path d="M0 190H400" stroke="#3a516b" stroke-width="2"/><rect x="330" y="187" width="70" height="6" fill="#2a3442"/><path d="M30 70L330 ${gs(330)}" stroke="#6ee7a0" stroke-dasharray="6 5"/><text x="34" y="62" font-size="10" fill="#6ee7a0">senda</text>
      <g transform="translate(${x} ${y}) rotate(${ph===2?12:ph===3?-10:6})"><path d="M-14 0h22l6 2.5-6 2.5h-22zM-12 0l-4-8h4l6 8z" fill="#ffc94d"/></g>
      <text x="${x}" y="${y-14}" font-size="11" text-anchor="middle" fill="${["#6ee7a0","#f6b73c","#ff8a80","#6ee7a0"][ph]}" font-weight="700">${["IAS ↑","se hunde","IAS ↓↓","recuperando"][ph]}</text>`;
    u.out.innerHTML=[`<b>1 · Viento en cara que aumenta</b>: la IAS sube y el avión se va <b>por encima</b> de la senda. La tentación es reducir potencia: no lo hagas.`,`<b>2 · Descendencia</b>: bajo el núcleo, el aire cae y el régimen de descenso se dispara.`,`<b class="bad">3 · Viento en cola</b>: la IAS se desploma y el avión queda <b>por debajo</b> de la senda, con poca energía y cerca del suelo.`,`<b class="ok">Recuperación</b>: <b>empuje máximo</b>, actitud de cabeceo de escape y <b>sin tocar tren ni flaps</b> hasta estar fuera. Lo mejor: no entrar; frustra o espera.`][ph]; });
}};

/* ---------- 14 · SIGWX de alto nivel: lee la etiqueta y mira qué cruzas ---------- */
V.sigwx={t:"SIGWX de alto nivel: qué dice cada elemento y qué cruzas a tu nivel",cap:"Mapa de ejemplo (FL250–FL630). Toca un elemento para ver cómo se lee su etiqueta y mueve tu nivel de vuelo para ver cuáles te afectan. Los niveles se dan siempre como base/cima en centenas de pies.",
init(el){
  const FL={cat:[280,380],cb:[200,420],jet:[300,390],tp:350}, EX={
   jet:["Corriente en chorro","Flecha gruesa con púas: cada púa larga = <b>10 kt</b>, la corta <b>5 kt</b>, el triángulo <b>50 kt</b>. Se dibuja si el viento máximo es de <b>80 kt o más</b>. La caja <b>FL340</b> es el nivel del núcleo y los números a los lados (+/−) dan hasta dónde sigue el viento por encima y por debajo. Aquí: 120 kt en el núcleo, cizalladura fuerte en los bordes."],
   cat:["Turbulencia en aire claro (CAT)","Zona <b>discontinua</b> con la etiqueta de intensidad (MOD o SEV) y la capa <b>base/cima</b>. Aquí MOD entre FL280 y FL380. No la ves en el radar ni en el cielo: se evita cambiando de nivel o de ruta. Suele ir pegada al jet y a la tropopausa."],
   cb:["Cumulonimbos (CB)","Contorno <b>festoneado</b> (como una nube). <b>ISOL</b> = aislados, <b>OCNL</b> = ocasionales, <b>FRQ</b> = frecuentes; <b>EMBD</b> = ocultos dentro de otras nubes. La cifra es <b>base/cima</b>: aquí FL200/FL420. Se bordean por barlovento a ≥10 NM (20 NM si es severa) y nunca por debajo del yunque."],
   tp:["Altura de la tropopausa","Número dentro de un recuadro, en centenas de pies: <b>350</b> = FL350. Un <b>H</b> marca el máximo y una <b>L</b> el mínimo local. Más alta sobre el ecuador y las altas presiones, más baja hacia los polos y en las bajas. El jet está justo bajo la tropopausa."],
   fr:["Frente frío en superficie","Línea con <b>triángulos</b> hacia donde avanza; el número y la flecha son la <b>velocidad de desplazamiento</b> en kt. Los frentes se dibujan solo si llevan fenómenos significativos asociados (CB, turbulencia)."]};
  const u=shell(el,this.t,`<svg viewBox="0 0 400 250" role="img" aria-label="Mapa SIGWX de alto nivel de ejemplo"></svg>`,rng("l","Tu nivel de vuelo FL",250,450,340,10,"")+`<button type="button" data-s="jet" aria-pressed="false">Jet</button><button type="button" data-s="cat" aria-pressed="false">CAT</button><button type="button" data-s="cb" aria-pressed="false">CB</button><button type="button" data-s="tp" aria-pressed="false">Tropopausa</button><button type="button" data-s="fr" aria-pressed="false">Frente</button>`,this.cap), svg=u.q("svg"); let sel="";
  const hit=(r,l)=>l>=r[0]&&l<=r[1];
  const draw=l=>{ const ac=(k,r)=>hit(r,l)?"#ff6a5c":"#9fb3c8", op=k=>sel===k?1:.88, ring=k=>sel===k?` stroke-width="3.4"`:``;
    const barb=(x,y,n)=>`<path d="M${x} ${y}l-4 -9m4 9l0 0" stroke="#dfe8f1" stroke-width="1.6"/>`;
    svg.innerHTML=`<rect width="400" height="250" fill="#12202f"/>
     <g stroke="#2a3f57" stroke-width=".8" fill="none">${[40,90,140,190].map(y=>`<path d="M10 ${y}H390"/>`).join("")}${[60,130,200,270,340].map(x=>`<path d="M${x} 10V210"/>`).join("")}</g>
     <path d="M10 160C40 150 60 120 95 126C130 132 150 100 190 108C210 112 230 90 260 98C300 110 330 84 390 90V210H10Z" fill="#1b3047" opacity=".7"/>
     <g opacity="${op("cat")}"><path d="M120 80L215 66L252 98L226 146L150 150L112 118Z" fill="${hit(FL.cat,l)?"#ff6a5c":"#58c4f0"}" fill-opacity=".1" stroke="${ac("cat",FL.cat)}" stroke-dasharray="7 5" stroke-width="2"${ring("cat")}/><text x="182" y="125" font-size="10.5" text-anchor="middle" font-weight="700" fill="${ac("cat",FL.cat)}">MOD CAT</text><text x="182" y="138" font-size="10" text-anchor="middle" fill="${ac("cat",FL.cat)}">FL280/380</text></g>
     <g opacity="${op("jet")}"><path d="M20 170C90 120 170 112 250 96S350 60 382 40" fill="none" stroke="${hit(FL.jet,l)?"#ff6a5c":"#6ee7a0"}" stroke-width="${sel==="jet"?6:4.4}" stroke-linecap="round"/><path d="M382 40l-14 3 8 11z" fill="${hit(FL.jet,l)?"#ff6a5c":"#6ee7a0"}"/>
       <path d="M350 55l-7 -15l11 4zM336 62l-5 -13M326 67l-5 -13M316 71l-5 -9" stroke="#dfe8f1" stroke-width="1.8" fill="#dfe8f1"/>
       <rect x="205" y="86" width="64" height="18" rx="2" fill="#12202f" stroke="#dfe8f1"/><text x="237" y="99" font-size="11" text-anchor="middle" font-weight="700">120/FL340</text><text x="296" y="34" font-size="9.5" fill="#9fb3c8">+20</text><text x="296" y="46" font-size="9.5" fill="#9fb3c8">−30</text></g>
     <g opacity="${op("cb")}"><path d="M268 150q-8-12 6-16q-2-13 14-12q4-12 18-6q14-8 20 6q16 0 12 14q12 8 0 16q2 12-14 10q-8 12-22 4q-14 8-22-4q-18 2-12-12q-10-4-0-0z" fill="${hit(FL.cb,l)?"#ff6a5c":"#f6b73c"}" fill-opacity=".14" stroke="${ac("cb",FL.cb)}" stroke-width="2.2"${ring("cb")}/><text x="308" y="147" font-size="9" text-anchor="middle" font-weight="700" fill="${ac("cb",FL.cb)}">ISOL EMBD CB</text><text x="308" y="160" font-size="10" text-anchor="middle" fill="${ac("cb",FL.cb)}">200/420</text></g>
     <g opacity="${op("tp")}">${[[56,60,"390"],[318,196,"300"]].map(a=>`<rect x="${a[0]-17}" y="${a[1]-10}" width="34" height="19" rx="2" fill="#12202f" stroke="${sel==="tp"?"#ffc94d":"#9fb3c8"}" stroke-width="${sel==="tp"?2.6:1.2}"/><text x="${a[0]}" y="${a[1]+4}" font-size="11.5" text-anchor="middle" font-weight="700">${a[2]}</text>`).join("")}<text x="34" y="40" font-size="13" font-weight="700" fill="#ffc94d">H</text><text x="344" y="196" font-size="13" font-weight="700" fill="#ffc94d">L</text></g>
     <g opacity="${op("fr")}"><path d="M54 198C84 176 104 150 112 118" fill="none" stroke="#58c4f0" stroke-width="${sel==="fr"?3.6:2.4}"/>${[[64,190],[84,172],[98,152]].map(p=>`<path d="M${p[0]} ${p[1]}l10 -2l-3 -9z" fill="#58c4f0"/>`).join("")}<text x="48" y="214" font-size="10" fill="#9fb3c8">30 kt →</text></g>
     <rect x="10" y="222" width="380" height="20" rx="3" fill="#0f1b29"/><text x="18" y="236" font-size="11" font-weight="700" fill="#ffc94d">FL${l}</text>
     ${[["CAT",FL.cat],["CB",FL.cb],["JET",FL.jet]].map((a,i)=>`<text x="${70+i*100}" y="236" font-size="11" fill="${hit(a[1],l)?"#ff8a80":"#6ee7a0"}">${a[0]} ${hit(a[1],l)?"dentro":"libre"}</text>`).join("")}`;
    const sf=l>FL.tp?"estratosfera (sobre la tropopausa de FL350)":"troposfera (bajo la tropopausa de FL350)";
    const L=[]; L.push(hit(FL.cb,l)?`<b class="bad">CB</b>: tu nivel está <b>dentro</b> de la capa FL200/FL420. Desvío lateral por barlovento ≥10 NM; no se sube por encima del yunque ni se pasa por debajo.`:`<b class="ok">CB</b>: la capa FL200/FL420 no incluye tu nivel; con la cima por encima te toca rodear igualmente. `);
    L.push(hit(FL.cat,l)?`<b class="bad">CAT moderada</b> (FL280/380): abróchate, y pide otro nivel o ruta.`:`<b class="ok">CAT</b>: fuera de FL280/380.`); L.push(hit(FL.jet,l)?`<b>Jet</b>: estás en su capa (FL300/390); cizalladura vertical fuerte en los bordes.`:`<b>Jet</b>: fuera de su capa.`);
    u.out.innerHTML=(sel?`<b style="color:#ffc94d">${EX[sel][0]}.</b> ${EX[sel][1]}<br><br>`:"")+`A <b>FL${l}</b> vas en ${sf}.<br>`+L.join("<br>"); };
  let lv=340; bind(el,o=>{ lv=o.l; setO(el,"l",o.l); draw(lv); });
  btns(el,"data-s",v=>{ sel=sel===v?"":v; el.querySelectorAll("[data-s]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.s===sel?"true":"false")); draw(lv); });
}};

/* ---------- 15 · Triángulo de velocidades ---------- */
V.wtri={t:"Triángulo de velocidades: del rumbo deseado al heading y la GS",cap:"Aire + viento = suelo. El viento se da «de dónde viene»; el vector viento apunta hacia donde sopla. WCA = asen(V·sen β ÷ TAS) y GS = TAS·cos WCA − V·cos β, con β = dirección del viento − track.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 270" role="img" aria-label="Triángulo de velocidades"></svg>`,rng("t","Track deseado",0,359,90,1,"°")+rng("a","TAS",100,480,220,5," kt")+rng("d","Viento de",0,359,30,1,"°")+rng("v","Viento",0,90,40,1," kt"),this.cap), svg=u.q("svg");
  const p3=n=>String(Math.round((n%360+360)%360)||360).padStart(3,"0");
  bind(el,o=>{ ["t","d"].forEach(k=>setO(el,k,p3(o[k]))); setO(el,"a",o.a); setO(el,"v",o.v);
    const TAS=o.a, W=o.v, b=(o.d-o.t)*R, s=W*Math.sin(b)/TAS;
    if(Math.abs(s)>=1){ svg.innerHTML=`<rect width="400" height="270" fill="#12202f"/><text x="200" y="135" font-size="13" text-anchor="middle" fill="#ff8a80">El viento transversal supera a la TAS</text>`; u.out.innerHTML=`<b class="bad">No hay solución</b>: con ese viento de costado no puedes mantener el track ni apuntando el morro contra él.`; return; }
    const wca=Math.asin(s)/R, hdg=o.t+wca, gs=TAS*Math.cos(wca*R)-W*Math.cos(b), xw=W*Math.sin(b), hw=W*Math.cos(b);
    const sc=Math.min(1.05,190/Math.max(TAS,gs,1)), O=[70,190], pt=(a,l)=>[O[0]+l*Math.sin(a*R)*sc, O[1]-l*Math.cos(a*R)*sc], A=pt(hdg,TAS), G=pt(o.t,gs), wd=(o.d+180);
    const ar=(P,Q,c,w)=>{ const a=Math.atan2(Q[1]-P[1],Q[0]-P[0]), h=9; return `<path d="M${P[0].toFixed(1)} ${P[1].toFixed(1)}L${Q[0].toFixed(1)} ${Q[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" fill="none"/><path d="M${Q[0].toFixed(1)} ${Q[1].toFixed(1)}l${(-h*Math.cos(a-.4)).toFixed(1)} ${(-h*Math.sin(a-.4)).toFixed(1)}l${(h*.9*Math.sin(a)).toFixed(1)} ${(-h*.9*Math.cos(a)).toFixed(1)}z" fill="${c}"/>`; };
    const sw=pt(o.d,70), ex=[60,230];
    svg.innerHTML=`<rect width="400" height="270" fill="#12202f"/><circle cx="${O[0]}" cy="${O[1]}" r="3" fill="#dfe8f1"/><path d="M${O[0]} ${O[1]}V30" stroke="#2f4560" stroke-dasharray="4 4"/><text x="${O[0]+5}" y="34" font-size="10" fill="#9fb3c8">N</text>
     ${ar(O,A,"#ffc94d",3)}${ar(A,G,"#ff8a80",3)}${ar(O,G,"#6ee7a0",3)}
     <text x="${(O[0]+A[0])/2-8}" y="${(O[1]+A[1])/2-6}" font-size="11" text-anchor="end" fill="#ffc94d">HDG ${p3(hdg)} · TAS ${TAS}</text>
     <text x="${(A[0]+G[0])/2+8}" y="${(A[1]+G[1])/2}" font-size="11" fill="#ff8a80">viento ${W} kt</text>
     <text x="${(O[0]+G[0])/2+8}" y="${(O[1]+G[1])/2+16}" font-size="11" fill="#6ee7a0">TRK ${p3(o.t)} · GS ${Math.round(gs)}</text>
     <g transform="translate(330 60)"><circle r="34" fill="none" stroke="#2f4560"/><text y="-40" font-size="9.5" text-anchor="middle" fill="#9fb3c8">viene de ${p3(o.d)}</text><g transform="rotate(${wd})"><path d="M0 -24V24M0 24l-6 -9m6 9l6 -9" stroke="#ff8a80" stroke-width="2.4" fill="none"/></g></g>`;
    u.out.innerHTML=`β = ${p3(o.d)} − ${p3(o.t)} = <b>${Math.round(o.d-o.t)}°</b> → componente de costado <b>${Math.abs(Math.round(xw))} kt</b> ${xw>0?"por la <b>derecha</b>":xw<0?"por la <b>izquierda</b>":""}; ${hw>=0?"de cara":"de cola"} <b>${Math.abs(Math.round(hw))} kt</b>.<br>WCA <b>${wca>=0?"+":"−"}${Math.abs(wca).toFixed(1).replace(".",",")}°</b> → <b>HDG ${p3(hdg)}°</b> (corriges <b>hacia el viento</b>) · <b class="ok">GS ${Math.round(gs)} kt</b>.`; });
}};

/* ---------- 16 · ILS: aguja del localizador y de la senda ---------- */
V.ils={t:"ILS: qué marcan las agujas según dónde estés",cap:"Localizador: escala completa a ±2,5° (2 puntos = ±2,5°). Senda de planeo: escala completa a ±0,7° (2 puntos = ±0,7°). «Vuela hacia la aguja»: si la aguja está a la izquierda, la pista está a la izquierda.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 270" role="img" aria-label="Vista superior, lateral e indicador ILS"></svg>`,rng("d","Distancia al umbral",1,12,6,.5," NM")+rng("x","Desviación lateral (+ derecha de la pista)",-900,900,350,25," m")+rng("h","Desviación vertical (+ por encima)",-500,500,-150,25," ft"),this.cap), svg=u.q("svg");
  bind(el,o=>{ const D=o.d, NM=1852, loc=Math.atan(o.x/(D*NM))/R, nom=Math.tan(3*R)*D*6076, gs=Math.atan2(o.h,D*6076)/R, kL=cl(-loc/1.25,-2,2), kG=cl(gs/.35,-2,2);
    setO(el,"d",f1(D)); setO(el,"x",(o.x>0?"+":"")+o.x); setO(el,"h",(o.h>0?"+":"")+o.h);
    const px=x=>10+(12-x)/12*190, lx=px(D), ly=60+(o.x/900)*34, ys=h=>235-h/4000*100, cx=300, cy=135, dx=kL*26;
    svg.innerHTML=`<rect width="400" height="270" fill="#12202f"/>
     <text x="10" y="16" font-size="10.5" fill="#9fb3c8">Vista superior</text><path d="M10 60H200" stroke="#2f4560" stroke-dasharray="4 4"/><path d="M200 60L${px(12)} ${60-38}M200 60L${px(12)} ${60+38}" stroke="#58c4f0" stroke-opacity=".5"/><path d="M200 60L${px(6)} ${60-19}M200 60L${px(6)} ${60+19}" stroke="#58c4f0" stroke-opacity=".25"/><rect x="198" y="55" width="10" height="10" fill="#3a516b"/><text x="196" y="82" font-size="9.5" text-anchor="end" fill="#9fb3c8">pista</text>
     <g transform="translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(90)"><path d="M0 -8L5.5 7L0 3.5L-5.5 7Z" fill="#ffc94d"/></g>
     <text x="10" y="120" font-size="10.5" fill="#9fb3c8">Vista lateral</text><path d="M10 235H200" stroke="#3a516b" stroke-width="2"/><path d="M200 235L10 ${ys(Math.tan(3*R)*12*6076)}" stroke="#6ee7a0" stroke-width="2"/><text x="16" y="${ys(Math.tan(3*R)*12*6076)+16}" font-size="9.5" fill="#6ee7a0">senda de 3°</text>
     <g transform="translate(${lx.toFixed(1)} ${ys(nom+o.h).toFixed(1)})"><path d="M-9 0h16l5 2-5 2h-16zM-8 0l-4-6h4l5 6z" fill="#ffc94d"/></g>
     <rect x="252" y="87" width="96" height="96" rx="8" fill="#0b1622" stroke="#3a516b"/>${[-2,-1,1,2].map(i=>`<circle cx="${cx+i*26}" cy="${cy}" r="3.4" fill="none" stroke="#9fb3c8"/><circle cx="${cx}" cy="${cy+i*20}" r="3.4" fill="none" stroke="#9fb3c8"/>`).join("")}
     <path d="M${cx-20} ${cy}H${cx+20}M${cx} ${cy-20}V${cy+20}" stroke="#2f4560"/>
     <path d="M${(cx+dx).toFixed(1)} 96V174" stroke="${Math.abs(kL)>=2?"#ff8a80":"#ffc94d"}" stroke-width="4" stroke-linecap="round"/><path d="M262 ${(cy+kG*20).toFixed(1)}H338" stroke="${Math.abs(kG)>=2?"#ff8a80":"#ffc94d"}" stroke-width="4" stroke-linecap="round"/>
     <text x="300" y="206" font-size="10.5" text-anchor="middle" fill="#9fb3c8">LOC ${loc>=0?"+":""}${loc.toFixed(2).replace(".",",")}° · GS ${gs>=0?"+":""}${gs.toFixed(2).replace(".",",")}°</text>`;
    const side=Math.abs(kL)<.15?"centrado":(kL<0?"a la <b>izquierda</b>":"a la <b>derecha</b>"), upd=Math.abs(kG)<.15?"centrada":(kG>0?"<b>abajo</b>":"<b>arriba</b>"), c1=kL<-.15?"izquierda":kL>.15?"derecha":"";
    u.out.innerHTML=`Estás ${Math.abs(Math.round(o.x))} m ${o.x>0?"a la derecha":o.x<0?"a la izquierda":"sobre el eje"} y ${Math.abs(Math.round(o.h))} ft ${o.h>0?"sobre":o.h<0?"bajo":"en"} la senda. Aguja del LOC ${side} (${Math.abs(kL)>=2?"<b class='bad'>tope</b>":(Math.abs(loc/1.25)).toFixed(1).replace(".",",")+" puntos"}), aguja de la senda ${upd} (${Math.abs(kG)>=2?"<b class='bad'>tope</b>":Math.abs(gs/.35).toFixed(1).replace(".",",")+" puntos"}).<br>`+(c1?`<b>Vuela hacia la aguja</b>: corrige a la <b>${o.x>0?"izquierda":"derecha"}</b>.`:`Rumbo correcto.`)+` ${kG>.15?"Estás alto: aumenta el régimen de descenso.":kG<-.15?"Estás bajo: no desciendas más hasta recuperar la senda.":""}<br><span style="color:#9fb3c8">Con los mismos ${Math.abs(o.x)} m, a 2 NM la aguja se va a tope y a 10 NM apenas se mueve: la sensibilidad crece al acercarte al umbral.</span>`; });
}};

/* ---------- 17 · VOR / NDB: dónde estás y qué marcan CDI y RMI ---------- */
V.radnav={t:"VOR y NDB: arrastra el avión y mira el CDI, el RMI y la marcación relativa",cap:"Arrastra el avión (o toca el mapa) para cambiar de radial. El CDI solo depende de dónde estás y del curso seleccionado, nunca de tu rumbo: escala completa ±10° (5 puntos, 2° por punto). La aguja del RMI siempre apunta a la estación: la punta marca el QDM y la cola el QDR. RB = QDM − rumbo.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 270" role="img" aria-label="Mapa alrededor de la estación con CDI y RMI"><g data-bg></g><g data-dy></g><g data-ac style="touch-action:none;cursor:grab"><circle r="24" fill="#fff" fill-opacity="0"/><path d="M0 -15L10 12L0 7L-10 12Z" fill="#ffc94d" stroke="#12202f" stroke-width="1.2"/></g></svg>`,rng("c","Curso seleccionado (OBS)",0,359,90,1,"°")+rng("h","Tu rumbo",0,359,60,1,"°")+`<button type="button" data-m="V" aria-pressed="true">VOR</button><button type="button" data-m="N" aria-pressed="false">NDB (ADF)</button>`,this.cap), svg=u.q("svg"), bg=u.q("[data-bg]"), dy=u.q("[data-dy]"), ac=u.q("[data-ac]");
  const SX=125, SY=135, n3=a=>((a%360)+360)%360, p3=a=>String(Math.round(n3(a))||360).padStart(3,"0"), n180=a=>((a+540)%360)-180;
  let px=70, py=-52, mode="V", C=90, HD=60;
  bg.innerHTML=`<rect width="400" height="270" fill="#12202f"/><circle cx="${SX}" cy="${SY}" r="112" fill="#16283b" stroke="#2f4560"/>`+[0,30,60,90,120,150,180,210,240,270,300,330].map(a=>{ const p=pol(SX,SY,112,a), q=pol(SX,SY,101,a), t=pol(SX,SY,91,a); return `<path d="M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="#58708c"/><text x="${t[0].toFixed(1)}" y="${(t[1]+3.5).toFixed(1)}" font-size="9" text-anchor="middle" fill="#7f95ad">${a?String(a).padStart(3,"0"):"N"}</text>`; }).join("");
  const dial=(cx,cy,lab)=>`<circle cx="${cx}" cy="${cy}" r="48" fill="#0b1622" stroke="#3a516b" stroke-width="1.5"/><text x="${cx}" y="${cy+62}" font-size="10" text-anchor="middle" fill="#9fb3c8">${lab}</text>`;
  function draw(){ const dist=Math.hypot(px,py), qdr=n3(Math.atan2(px,-py)/R), qdm=n3(qdr+180), rb=n3(qdm-HD), d=n180(qdr-C), from=Math.abs(d)<=90, e=from?d:n180(qdr-C-180), amb=Math.abs(Math.abs(d)-90)<4, right=from?d>0:e<0, dots=cl((from?-d:e)/2,-5,5), V_=mode==="V";
    const a=pol(SX,SY,112,C), b=pol(SX,SY,112,C+180), ax=SX+px, ay=SY+py;
    ac.setAttribute("transform",`translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${HD})`);
    // CDI
    const cx=325, c1=60, c2=196, nx=cx+dots*7.6;
    let s=`<path d="M${SX} ${SY}L${ax.toFixed(1)} ${ay.toFixed(1)}" stroke="#ffc94d" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    if(V_) s+=`<path d="M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${a[0].toFixed(1)} ${a[1].toFixed(1)}" stroke="#6ee7a0" stroke-width="2"/><g transform="translate(${a[0].toFixed(1)} ${a[1].toFixed(1)}) rotate(${C})"><path d="M0 -3L6 9H-6Z" fill="#6ee7a0"/></g>`;
    s+=V_?`<circle cx="${SX}" cy="${SY}" r="7" fill="#12202f" stroke="#dfe8f1" stroke-width="1.6"/><path d="M${SX-4} ${SY-3.5}h8l4 3.5-4 3.5h-8l-4-3.5z" fill="#dfe8f1"/>`:`<circle cx="${SX}" cy="${SY}" r="8" fill="none" stroke="#dfe8f1" stroke-dasharray="2 2.5" stroke-width="1.6"/><circle cx="${SX}" cy="${SY}" r="3" fill="#dfe8f1"/>`;
    s+=dial(cx,c1,V_?`CDI · OBS ${p3(C)}`:"CDI: el ADF no tiene");
    if(V_){ s+=[-5,-4,-3,-2,-1,1,2,3,4,5].map(j=>`<circle cx="${cx+j*7.6}" cy="${c1}" r="1.9" fill="#9fb3c8"/>`).join("")+`<circle cx="${cx}" cy="${c1}" r="4" fill="none" stroke="#9fb3c8"/>
      <path d="M${nx.toFixed(1)} ${c1-36}V${c1+36}" stroke="${Math.abs(dots)>=5?"#ff8a80":"#ffc94d"}" stroke-width="3.4" stroke-linecap="round"/>
      <rect x="${cx-15}" y="${c1+16}" width="30" height="14" rx="2" fill="#12202f" stroke="#3a516b"/><text x="${cx}" y="${c1+26.5}" font-size="9.5" text-anchor="middle" font-weight="700" fill="${amb?"#ff8a80":"#fff"}">${amb?"OFF":from?"FROM":"TO"}</text>
      <path d="${from?`M${cx} ${c1-16}l-6 -9h12z`:`M${cx} ${c1-25}l-6 9h12z`}" fill="${amb?"none":"#fff"}"/>`; }
    else s+=`<text x="${cx}" y="${c1+4}" font-size="10" text-anchor="middle" fill="#58708c">solo aguja (RMI/RBI)</text>`;
    // RMI
    s+=dial(cx,c2,`RMI · rumbo ${p3(HD)}`)+`<g transform="rotate(${-HD} ${cx} ${c2})">`+[0,30,60,90,120,150,180,210,240,270,300,330].map(t=>{ const p=pol(cx,c2,46,t), q=pol(cx,c2,40,t), w=pol(cx,c2,32,t); return `<path d="M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}" stroke="#dfe8f1"/><text x="${w[0].toFixed(1)}" y="${(w[1]+3).toFixed(1)}" font-size="8.5" text-anchor="middle" transform="rotate(${t} ${w[0].toFixed(1)} ${w[1].toFixed(1)})" fill="${t%90?"#9fb3c8":"#fff"}">${t===0?"N":t===90?"E":t===180?"S":t===270?"W":t/10}</text>`; }).join("")+`</g>
      <path d="M${cx} ${c2-50}l-5 -8h10z" fill="#ff8a80"/>
      <g transform="rotate(${rb} ${cx} ${c2})"><path d="M${cx} ${c2+26}V${c2-24}" stroke="#ffc94d" stroke-width="3" stroke-linecap="round"/><path d="M${cx} ${c2-31}l-6 11h12z" fill="#ffc94d"/><circle cx="${cx}" cy="${c2}" r="3" fill="#0b1622" stroke="#ffc94d"/></g>`;
    dy.innerHTML=s;
    const where=rb<=20||rb>=340?"delante":rb<160?"a tu <b>derecha</b>":rb<=200?"detrás":"a tu <b>izquierda</b>";
    let t=`Estás en el <b>radial ${p3(qdr)}</b> (QDR ${p3(qdr)} · <b>QDM ${p3(qdm)}</b>). Con rumbo ${p3(HD)}°: <b>RB ${p3(rb)}°</b> → la estación queda ${where}.<br>`;
    if(V_){ t+=amb?`CDI con OBS ${p3(C)}: <b class="bad">zona de ambigüedad</b> (estás a 90° del curso): bandera OFF y aguja sin información útil.`:`CDI con OBS ${p3(C)}: bandera <b>${from?"FROM":"TO"}</b> y aguja ${Math.abs(dots)<.25?"<b class='ok'>centrada</b>":`<b>${f1(Math.abs(dots))} puntos a la ${dots<0?"izquierda":"derecha"}</b>${Math.abs(dots)>=5?" (a tope)":""}`}. `+(Math.abs(dots)<.25?`Estás sobre el curso.`:`El curso ${p3(C)} te queda a la <b>${right?"izquierda":"derecha"}</b>: para interceptarlo con 30°, rumbo <b>${p3(C+(right?-30:30))}°</b>.`);
      if(!amb&&Math.abs(n180(HD-C))>90) t+=` <span style="color:#9fb3c8">Ojo: vuelas en sentido contrario al curso seleccionado, así que la aguja parece ir «al revés».</span>`; }
    else t+=`ADF: no hay curso que seleccionar. Para ir a la estación sin viento, pon la aguja arriba (RB 000): rumbo <b>${p3(qdm)}°</b>. En el RMI lees el QDM en la punta sin hacer cuentas; con un RBI fijo, QDM = rumbo + RB.`;
    u.out.innerHTML=t; }
  const toV=e=>{ const r=svg.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*400-SX,(e.clientY-r.top)/r.height*270-SY]; };
  const place=(x,y)=>{ const dd=Math.hypot(x,y)||1, k=cl(dd,22,104)/dd; px=x*k; py=y*k; draw(); };
  let drag=false; ac.addEventListener("pointerdown",e=>{ drag=true; try{ ac.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); });
  ac.addEventListener("pointermove",e=>{ if(drag){ const p=toV(e); place(p[0],p[1]); } }); const end=()=>{ drag=false; }; ac.addEventListener("pointerup",end); ac.addEventListener("pointercancel",end);
  svg.addEventListener("click",e=>{ const p=toV(e); if(Math.hypot(p[0],p[1])<=114) place(p[0],p[1]); });
  btns(el,"data-m",v=>{ mode=v; draw(); }); bind(el,o=>{ C=o.c; HD=o.h; setO(el,"c",p3(C)); setO(el,"h",p3(HD)); draw(); });
}};

/* ---------- 18 · Altimetría: QNH, QFE, 1013, transición y temperatura ---------- */
V.altim={t:"Altimetría: QNH, QFE, nivel de transición y temperatura",cap:"Cifras de examen: 27 ft por hPa y 4 % de la altura sobre el aeródromo por cada 10 °C de desviación ISA (4 ft por cada 1 000 ft y °C). Altitud de transición del ejemplo: 6 000 ft; el nivel de transición es el primer nivel de vuelo utilizable por encima de ella (aquí, niveles cada 500 ft). «De alta a baja, peligro abajo»: al volar hacia menos presión o más frío sin corregir, el avión está más bajo de lo que indica.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 270" role="img" aria-label="Corte vertical con niveles de presión, terreno y avión"></svg>`,rng("q","QNH real",960,1050,1013,1," hPa")+rng("e","Elevación del aeródromo",0,5000,2000,100," ft")+rng("t","Temperatura respecto a ISA",-30,30,0,5," °C")+rng("i","El altímetro indica",1000,12000,8000,100," ft")+`<button type="button" data-sub="Q" aria-pressed="true">Reglado en QNH</button><button type="button" data-sub="S" aria-pressed="false">Reglado en 1013</button>`,this.cap), svg=u.q("svg"); let sub="Q", O=null;
  const Y=ft=>236-ft*216/13000, TA=6000, sg=n=>(n>0?"+":n<0?"−":"")+f0(Math.abs(n));
  const draw=()=>{ const o=O; if(!o) return; const k=1+.004*o.t, tr=h=>h<=o.e?h:o.e+(h-o.e)*k, d13=(1013-o.q)*27, altQ=o.i+(sub==="S"?-d13:0), tru=tr(altQ), qfe=o.q-o.e/27, pa=altQ+d13, tlfl=(Math.floor((TA+d13)/500+1e-9)+1)*5, tlalt=tlfl*100-d13, layer=tlalt-TA, s13=-d13, agl=tru-o.e, err=tru-o.i;
    const ye=Y(o.e), yI=Y(cl(o.i,-900,13000)), yT=Y(cl(tru,-900,13000));
    let s=`<rect width="400" height="270" fill="#12202f"/><rect x="0" y="${Y(0)}" width="400" height="${270-Y(0)}" fill="#14324a"/><path d="M0 ${Y(0)}H400" stroke="#58c4f0" stroke-width="1.4"/><text x="394" y="${Y(0)+12}" font-size="9.5" text-anchor="end" fill="#58c4f0">nivel del mar</text>`;
    for(let h=2000;h<=12000;h+=2000){ if(h<=o.e) continue; const y=Y(tr(h)); if(y<8) continue; s+=`<path d="M40 ${y.toFixed(1)}H400" stroke="#3a516b" stroke-width="1" stroke-dasharray="3 5"/><text x="36" y="${(y+3.5).toFixed(1)}" font-size="9" text-anchor="end" fill="#7f95ad">${h/1000}k</text>`; }
    s+=`<path d="M0 270V${ye+4}Q20 ${ye} 46 ${ye}H178Q204 ${ye} 222 ${ye+14}T268 ${Math.min(Y(0)+1,ye+60)}T330 ${Y(0)+1}H400V270Z" fill="#2b3b2f" stroke="#55705a"/><rect x="70" y="${ye-2.5}" width="90" height="3.6" fill="#9fb3c8"/><text x="115" y="${ye+14}" font-size="9.5" text-anchor="middle" fill="#cfe0d2">aeródromo ${f0(o.e)} ft · QFE ${Math.round(qfe)}</text>`;
    const y13=Y(cl(tr(s13),-1100,13500)); s+=`<path d="M0 ${y13.toFixed(1)}H400" stroke="#f6b73c" stroke-width="1.6" stroke-dasharray="9 4"/><text x="6" y="${(y13-4).toFixed(1)}" font-size="9.5" fill="#f6b73c">1013 hPa${Math.abs(d13)<1?" = nivel del mar":s13>0?" (sobre el mar)":" (bajo el mar)"}</text>`;
    const yTA=Y(tr(TA)), yTL=Y(tr(tlalt)); if(TA>o.e){ s+=`<path d="M210 ${yTA.toFixed(1)}H400" stroke="#6ee7a0" stroke-width="1.5"/><text x="396" y="${(yTA+11).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#6ee7a0">TA 6 000 ft</text><path d="M210 ${yTL.toFixed(1)}H400" stroke="#e58bd8" stroke-width="1.5"/><text x="396" y="${(yTL-4).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#e58bd8">TL FL${String(tlfl).padStart(3,"0")}</text>`; }
    const pln=(x,y,f,st)=>`<g transform="translate(${x} ${y.toFixed(1)})"><path d="M-13 0h20l7 2.4-7 2.4h-20zM-12 0l-5-7h5l6 7zM-3 2l-6 7h5l7-7z" fill="${f}" ${st}/></g>`;
    if(Math.abs(yT-yI)>3) s+=pln(250,yI-2,"none",`stroke="#9fb3c8" stroke-width="1.2" stroke-dasharray="3 2"`)+`<text x="232" y="${(yI+1).toFixed(1)}" font-size="9.5" text-anchor="end" fill="#9fb3c8">indica ${f0(o.i)}</text>`;
    if(Math.abs(yT-yI)>3) s+=`<path d="M250 ${(yI+(yT>yI?6:-6)).toFixed(1)}V${(yT+(yT>yI?-8:10)).toFixed(1)}" stroke="${err<0?"#ff8a80":"#6ee7a0"}" stroke-width="1.6"/>`;
    s+=pln(250,yT-2,agl<=0?"#ff8a80":"#ffc94d","")+`<text x="270" y="${(yT+2).toFixed(1)}" font-size="10" font-weight="700" fill="${err<-20?"#ff8a80":"#ffc94d"}">real ${f0(tru)} ft</text>`;
    svg.innerHTML=s;
    const why=[]; if(sub==="S"&&Math.abs(d13)>=1) why.push(`1013 puesto con QNH ${o.q}: ${sg(-d13)} ft`); if(o.t&&altQ>o.e) why.push(`ISA ${o.t>0?"+":"−"}${Math.abs(o.t)} °C: ${sg((altQ-o.e)*(k-1))} ft`);
    u.out.innerHTML=`Altitud <b>indicada ${f0(o.i)} ft</b> → <b class="${err<-20?"bad":err>20?"ok":""}">verdadera ${f0(tru)} ft</b>`+(why.length?` (${why.join(" · ")})`:` (sin error: atmósfera ISA y reglaje correcto)`)+`. ${agl<=0?`<b class="bad">Por debajo del terreno del aeródromo.</b>`:`Sobre el aeródromo: <b>${f0(agl)} ft</b>.`}`+(err<-20?` <b class="bad">Estás más bajo de lo que crees: peligro abajo.</b>`:err>20?` Estás más alto de lo que indica: margen a favor.`:"")+
      `<br><b>QFE ${Math.round(qfe)} hPa</b> (= QNH − elevación ÷ 27): con él leerías la altura sobre la pista. Altitud de presión <b>${f0(pa)} ft</b> (FL${String(Math.max(0,Math.round(pa/100))).padStart(3,"0")}).`+
      `<br>Transición: TA 6 000 ft → <b>TL FL${String(tlfl).padStart(3,"0")}</b>; capa de transición de <b>${f0(layer)} ft</b>. ${o.q<1013?"Con QNH bajo, el nivel de transición sube.":o.q>1013?"Con QNH alto, el nivel de transición baja.":""}`; };
  btns(el,"data-sub",v=>{ sub=v; draw(); }); bind(el,o=>{ O=o; setO(el,"q",o.q); setO(el,"e",f0(o.e)); setO(el,"t",(o.t>0?"+":o.t<0?"−":"")+Math.abs(o.t)); setO(el,"i",f0(o.i)); draw(); });
}};

/* ---------- 19 · Cinta de velocidades: todas las V de cada avión ---------- */
V.tape={t:"Cinta de velocidades: arcos de colores y todas las V",cap:"Valores de los apuntes (Cruiser · C172 · Piper). Toca un marcador para ver qué protege o qué consigue, y mueve «Tu velocidad» para ver en qué arco estás. Límites con el POH; VR, Vx, Vy y planeo con el SOP.",
init(el){
  const D={
   cz:{n:"PS-28 Cruiser",s0:31,s1:37,r:55,x:55,y:62,g:60,fe:75,a:[88,88],no:108,ne:138,xw:"12 kt"},
   c1:{n:"Cessna 172",s0:41,s1:47,r:60,x:60,y:70,g:65,fe:85,a:[80,97],no:128,ne:160,xw:null},
   pi:{n:"Piper PA-28",s0:44,s1:50,r:65,x:64,y:75,g:73,fe:103,a:[88,111],no:126,ne:160,xw:null}};
  const I={s0:["VS0 · pérdida con flaps","Inicio del arco blanco. Por debajo no se sostiene el vuelo ni en configuración de aterrizaje."],s1:["VS1 · pérdida limpia","Inicio del arco verde. Con flaps arriba y potencia mínima, por debajo de aquí el ala entra en pérdida."],
   r:["VR · rotación","Aquí tiras de la palanca y levantas el morro. Rotar antes deja el ala sin velocidad suficiente; rotar muy tarde alarga la carrera."],x:["Vx · mejor ángulo","El mayor ascenso por distancia recorrida: se usa para superar un obstáculo. Es menor que Vy."],
   y:["Vy · mejor régimen","El mayor ascenso por minuto: llegas antes a la altitud, con menos ángulo. Es la velocidad de ascenso normal."],g:["Mejor planeo","Con el motor parado da la máxima distancia: es el primer paso del fallo de motor (Planear)."],
   fe:["VFE · flaps extendidos","Fin del arco blanco. Por encima, con flaps abajo, se puede dañar la estructura del flap."],a:["VA · maniobra","Por debajo, un mando a fondo entra en pérdida antes de romper el avión; por encima, no. Baja si baja la masa. Su rango depende del peso."],
   no:["VNO · operación normal","Fin del arco verde. Por encima (arco amarillo) solo en aire en calma: la turbulencia puede sobrecargar la estructura."],ne:["VNE · nunca exceder","Línea roja: nunca, ni en aire en calma."],xw:["Viento cruzado máximo","Componente de través máximo demostrado. No es un límite estructural, pero sí tu referencia."]};
  const u=shell(el,this.t,`<svg viewBox="0 0 420 316" role="img" aria-label="Cinta de velocidades"></svg>`,rng("v","Tu velocidad",20,170,70,1," kt")+`<button type="button" data-a="cz" aria-pressed="true">Cruiser</button><button type="button" data-a="c1" aria-pressed="false">Cessna 172</button><button type="button" data-a="pi" aria-pressed="false">Piper</button>`,this.cap), svg=u.q("svg");
  let ac="cz", sel="s1", V0=70; const Y=v=>292-(v-10)*1.62;
  const draw=()=>{ const d=D[ac], v=V0; let s=`<rect width="420" height="316" fill="#12202f"/><rect x="40" y="8" width="62" height="300" rx="4" fill="#0b1622" stroke="#3a516b"/>`;
    for(let t=10;t<=180;t+=5){ const y=Y(t); if(y<10||y>306) continue; const big=t%10===0; s+=`<path d="M${big?86:94} ${y.toFixed(1)}H102" stroke="#9fb3c8" stroke-width="${big?1.4:1}"/>`+(t%20===0?`<text x="80" y="${(y+4).toFixed(1)}" font-size="11" text-anchor="end">${t}</text>`:""); }
    const ar=(a,b,x,w,c)=>`<rect x="${x}" y="${Y(b).toFixed(1)}" width="${w}" height="${(Y(a)-Y(b)).toFixed(1)}" fill="${c}"/>`;
    s+=ar(d.s0,d.fe,102,5,"#f2f4f6")+ar(d.s1,d.no,107,7,"#2eaa55")+ar(d.no,d.ne,107,7,"#e6b422")+`<path d="M102 ${Y(d.ne).toFixed(1)}H122" stroke="#e5382f" stroke-width="3.4"/>`;
    const mk=[["s0",d.s0],["s1",d.s1],["r",d.r],["x",d.x],["y",d.y],["g",d.g],["fe",d.fe],["a",d.a[0]],["no",d.no],["ne",d.ne]].filter(m=>true).sort((a,b)=>b[1]-a[1]); let last=-99; const pos=[]; mk.forEach(m=>{ let y=Y(m[1]); if(y-last<14) y=last+14; pos.push([m,y]); last=y; });
    const lab={s0:"VS0",s1:"VS1",r:"VR",x:"VX",y:"VY",g:"PLANEO",fe:"VFE",a:"VA",no:"VNO",ne:"VNE"}, col={s0:"#f2f4f6",s1:"#6ee7a0",r:"#58c4f0",x:"#58c4f0",y:"#58c4f0",g:"#e58bd8",fe:"#f2f4f6",a:"#ffc94d",no:"#e6b422",ne:"#ff8a80"};
    pos.forEach(([m,y])=>{ const k=m[0], yy=Y(m[1]), on=sel===k, val=k==="a"?(d.a[0]===d.a[1]?d.a[0]:d.a[0]+"–"+d.a[1]):m[1];
      s+=`<g data-m="${k}" style="cursor:pointer"><path d="M124 ${yy.toFixed(1)}L${on?146:140} ${(y).toFixed(1)}H150" fill="none" stroke="${col[k]}" stroke-width="${on?2:1}" opacity="${on?1:.7}"/><rect x="150" y="${(y-9).toFixed(1)}" width="${on?150:128}" height="18" rx="3" fill="${on?col[k]:"#16283b"}" stroke="${col[k]}" stroke-opacity=".6"/><text x="156" y="${(y+4).toFixed(1)}" font-size="11.5" font-weight="700" style="fill:${on?"#0b1622":col[k]}">${lab[k]}</text><text x="${on?294:272}" y="${(y+4).toFixed(1)}" font-size="11.5" font-weight="700" text-anchor="end" style="fill:${on?"#0b1622":"#dfe8f1"}">${val}</text></g>`; });
    const vy=cl(Y(v),12,304); s+=`<path d="M30 ${vy.toFixed(1)}l10 -7v14z" fill="#ffc94d"/><rect x="2" y="${(vy-10).toFixed(1)}" width="30" height="20" rx="3" fill="#0b1622" stroke="#ffc94d"/><text x="17" y="${(vy+4.5).toFixed(1)}" font-size="12" font-weight="700" text-anchor="middle" style="fill:#ffc94d">${v}</text>`;
    s+=`<text x="316" y="22" font-size="11" style="fill:#9fb3c8">${d.n}</text><text x="316" y="38" font-size="10" style="fill:#9fb3c8">kt · KIAS</text>`;
    svg.innerHTML=s;
    const st=v<d.s0?["bad","Por debajo de VS0: pérdida en cualquier configuración."]:v<d.s1?["bad","Entre VS0 y VS1: solo se sostiene con flaps. Limpio, estás en pérdida."]:v<=d.fe?["ok","Arco verde y blanco: puedes usar flaps."]:v<=d.no?["ok","Arco verde: flaps arriba obligatoriamente (superas VFE)."]:v<=d.ne?["bad","Arco amarillo: solo en aire en calma, mandos suaves."]:["bad","Por encima de VNE: fuera de límites."];
    const i=I[sel], val=sel==="a"?(d.a[0]===d.a[1]?d.a[0]:d.a[0]+" a "+d.a[1]):(sel==="xw"?d.xw:d[sel]);
    u.out.innerHTML=`<b style="color:#ffc94d">${i[0]}${val?` · ${val}${sel==="xw"?"":" KIAS"}`:""}.</b> ${i[1]}<br><b class="${st[0]}">A ${v} kt:</b> ${st[1]}`+(d.xw?` <span style="color:#9fb3c8">· Viento cruzado máx. demostrado: ${d.xw}.</span>`:` <span style="color:#9fb3c8">· Viento cruzado máx.: no consta en tus apuntes.</span>`); };
  svg.addEventListener("click",e=>{ const g=e.target.closest("[data-m]"); if(g){ sel=g.dataset.m; draw(); } });
  btns(el,"data-a",v=>{ ac=v; el.querySelectorAll("[data-a]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.a===v?"true":"false")); draw(); });
  bind(el,o=>{ V0=o.v; setO(el,"v",V0); draw(); });
  const capEl=u.q(".cap"), cap0=capEl?capEl.textContent:"";
  const vs=()=>{ acBtns(el,"data-a"); if(!acHas(ac)){ ac=acFirst(); el.querySelectorAll("[data-a]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.a===ac?"true":"false")); }
    if(capEl) capEl.textContent=cap0.replace("(Cruiser · C172 · Piper)","("+AFS.filter(acHas).map(k=>acNames[k]).join(" · ")+")"); draw(); };
  acSub(vs); vs();
}};

/* ---------- 20 · Sistemas: los tres aviones cara a cara ---------- */
V.syscmp={t:"Sistemas de los tres aviones, cara a cara",cap:"Resumen visual de los apuntes. Cada pestaña compara lo que más cae: tensiones, tren, combustible, flaps y mandos, instrumentos.",
init(el){
  const C={cz:["PS-28 Cruiser","#e58bd8"],c1:["Cessna 172","#58c4f0"],pi:["Piper PA-28","#ffc94d"]};
  const bar=(v,m,c)=>`<span style="display:inline-block;width:14px;height:${Math.round(v/m*46)+4}px;background:${c};border-radius:2px 2px 0 0;vertical-align:bottom"></span>`;
  const spring=c=>`<svg viewBox="0 0 30 44" width="30" height="44"><path d="M15 2v6l-8 3 16 5-16 5 16 5-16 5 8 3v6" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
  const oleo=c=>`<svg viewBox="0 0 30 44" width="30" height="44"><rect x="9" y="2" width="12" height="20" rx="2" fill="none" stroke="${c}" stroke-width="2"/><rect x="12" y="14" width="6" height="26" fill="${c}"/><path d="M11 8h8M11 12h8" stroke="${c}" stroke-width="1.4" opacity=".6"/></svg>`;
  const free=c=>`<svg viewBox="0 0 30 44" width="30" height="44"><path d="M15 4v22" stroke="${c}" stroke-width="2.4"/><circle cx="15" cy="34" r="7" fill="none" stroke="${c}" stroke-width="2"/><path d="M4 12a14 14 0 0 1 22 0M26 12l-4 -1M26 12l-1 4" fill="none" stroke="${c}" stroke-width="1.5"/></svg>`;
  const flaps=(arr,cont,c)=>{ const x=a=>10+a/40*180; return `<svg viewBox="0 0 200 34" width="100%" height="34"><path d="M10 14H190" stroke="#3a516b" stroke-width="2"/>${cont?`<rect x="10" y="11" width="${x(30)-10}" height="6" rx="3" fill="${c}" opacity=".35"/>`:""}${arr.map(a=>`<circle cx="${x(a)}" cy="14" r="5" fill="${c}"/><text x="${x(a)}" y="31" font-size="10" text-anchor="middle" style="fill:#9fb3c8">${a}°</text>`).join("")}</svg>`; };
  const T={
   e:{n:"Eléctrico",m:"Cessna 24/28 · Piper 12/14 · Cruiser 12: la batería y el alternador, un número por encima.",
     k:{cz:["12 V",`${bar(12,28,"#e58bd8")}<small> batería</small>`,"Generador 250 W AC → regulador-rectificador 12 V 20 A DC. Una sola bus bar."],c1:["24 / 28 V",`${bar(24,28,"#58c4f0")}${bar(28,28,"#58c4f0")}<small> batería · alternador</small>`,"Batería 24 V 14 Ah y alternador 28 V 60 A. Primary bus y avionics bus."],pi:["12 / 14 V",`${bar(12,28,"#ffc94d")}${bar(14,28,"#ffc94d")}<small> batería · alternador</small>`,"Batería de plomo-ácido 12 V y alternador 14 V 60 A."]}},
   t:{n:"Tren y frenos",m:"Muelle = Cessna (principal) y Cruiser (doble muelle). Aire-aceite = Piper en las dos y Cessna solo en el morro.",
     k:{cz:["Doble muelle",spring("#e58bd8")+free("#e58bd8")+"<small> principal · morro libre</small>","Principal mecánica de doble muelle. Morro libre (free castering): se gira con frenado diferencial."],c1:["Muelle + aire-aceite",spring("#58c4f0")+oleo("#58c4f0")+"<small> principal · morro</small>","Principal de muelle con frenos de disco hidráulicos. Morro aire-aceite: 10°, hasta 30° con frenos."],pi:["Aire-aceite",oleo("#ffc94d")+oleo("#ffc94d")+"<small> 24 psi · 30 psi</small>","Principal 24 psi (4,5 in) y morro 30 psi (3,25 in). Frenos solo en las principales, incluido el de parking."]}},
   f:{n:"Combustible",m:"Piper = 3 drenajes y 2 bombas. Cessna = BOTH. Cruiser = gascolator y Left/Right/Off.",
     k:{cz:["Left · Right · Off","<small>bomba del motor (retorno) + eléctrica · gascolator</small>","2 depósitos ventilados. Si el izquierdo está lleno, empieza con LEFT. Diferencia máxima entre depósitos: 30 L."],c1:["BOTH","<small>selector con posición BOTH</small>","2 depósitos (izquierdo y derecho). Primer y filtro en el diagrama."],pi:["3 drenajes","<small>bomba eléctrica + bomba del motor</small>","2 depósitos principales con válvula selectora. Tras el selector: filtro, bombas y carburador."]}},
   m:{n:"Flaps y mandos",m:"Piper manual · Cessna y Cruiser eléctricos. Solo el Piper lleva stabilator.",
     k:{cz:["Up · 12° · 30°",flaps([0,12,30],true,"#e58bd8"),"Flaps eléctricos continuos. Compensadores eléctricos (alabeo en el alerón derecho). Elevador."],c1:["10° · 20° · Full",flaps([0,10,20,40],false,"#58c4f0"),"Flaps eléctricos. Cola con elevador y mandos por cables. Full = 40° según el SOP."],pi:["10° · 25° · 40°",flaps([0,10,25,40],false,"#ffc94d"),"Flaps manuales de tres posiciones. Stabilator con anti-balance tab y compensadores manuales."]}},
   i:{n:"Instrumentos",m:"Cruiser = pantallas Dynon. Piper = relojes + vacío. Pitot siempre en el ala izquierda.",
     k:{cz:["Dynon SkyView","<small>PFD y MAP</small>","SV-D1000. La pitot-estática bajo el ala izquierda alimenta los instrumentos de reserva y las pantallas."],c1:["Estática en el fuselaje","<small>pitot bajo el ala izquierda</small>","La estática va a los lados del fuselaje. Estática alterna desde la cabina con ventanas cerradas, calefacción y defroster."],pi:["Relojes + vacío","<small>presión total y estática: ala izquierda</small>","El vacío mueve el horizonte, el DGI y el coordinador de virajes. Poca succión: filtro bloqueado."]}}};
  const u=shell(el,this.t,`<div data-g style="padding:12px"></div>`,Object.keys(T).map((k,i)=>`<button type="button" data-t="${k}" aria-pressed="${i?"false":"true"}">${T[k].n}</button>`).join(""),this.cap), g=u.q("[data-g]");
  const draw=k=>{ const t=T[k]; g.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:10px">`+["cz","c1","pi"].filter(acHas).map(a=>`<div style="background:#0b1622;border:1px solid #2f4560;border-top:3px solid ${C[a][1]};border-radius:6px;padding:10px 12px;min-width:0"><div style="font:700 11px/1 system-ui;letter-spacing:.12em;text-transform:uppercase;color:${C[a][1]}">${C[a][0]}</div><div style="font:700 21px/1.15 'Barlow Condensed','Arial Narrow',system-ui,sans-serif;margin:8px 0 6px;color:#f4f8fb">${t.k[a][0]}</div><div style="display:flex;align-items:flex-end;gap:6px;min-height:50px;color:#9fb3c8;font-size:11.5px;flex-wrap:wrap">${t.k[a][1].replace(/<small>/g,"<small style=\"font:500 11.5px system-ui\">")}</div><div style="margin-top:8px;font:500 12.5px/1.4 system-ui;color:#cfdbe7">${t.k[a][2]}</div></div>`).join("")+`</div>`;
    const tm=window.F0AC&&!window.F0AC.all()?t.m.replace(/\.\s+/g,".\u0001").split("\u0001").filter(x=>window.F0AC.okText(x)).join(" "):t.m;
    u.out.innerHTML=tm?`<b style="color:#ffc94d">Truco:</b> ${tm}`:""; };
  let curT="e";
  btns(el,"data-t",v=>{ curT=v; el.querySelectorAll("[data-t]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.t===v?"true":"false")); draw(v); }); draw("e");
  acSub(()=>draw(curT));
}};

/* ---------- 21 · SOP: fallo de motor tras el despegue ---------- */
V.efail={t:"Fallo de motor sin pista: planear, elegir campo, asegurar cabina",cap:"P·E·A = Planear · Elegir campo · Asegurar cabina. El límite de 500 ft es siempre sobre el terreno (AGL). El alabeo máximo es 2/3 del arco: ±30° → 20°; ±45° → 30°.",
init(el){
  const A={cz:["PS-28 Cruiser",60,["Fuel pump · OFF","Fuel selector · OFF","Flaps · as required","TWR · MAYDAY + intenciones","Ignition · OFF","BATT & GEN · OFF","Objetos punzantes · REMOVE","Canopy / puertas · UNLOCK"]],c1:["Cessna 172",65,["Mixture · IDLE CUT-OFF","Fuel selector · OFF","Flaps · as required","TWR · MAYDAY + intenciones","Ignition · OFF","BATT & GEN · OFF","Objetos punzantes · REMOVE","Puertas / ventanas · UNLOCK"]],pi:["Piper PA-28",73,["Mixture · IDLE CUT-OFF","Fuel pump · OFF","Fuel selector · OFF","Flaps · as required","TWR · MAYDAY + intenciones","Ignition · OFF","BATT & GEN · OFF","Objetos punzantes · REMOVE","Puertas / ventanas · UNLOCK"]]};
  const grp=(a,i)=>{ const fc=a==="pi"?3:2; return i<fc?"c":i===fc?"f":i===fc+1?"m":i<fc+4?"e":"s"; };
  const u=shell(el,this.t,`<svg viewBox="0 0 400 270" role="img" aria-label="Zona de campos posibles según la altura"></svg><div data-l style="padding:8px 12px 12px"></div>`,rng("h","Altura sobre el terreno",100,1000,300,50," ft AGL")+`<button type="button" data-a="cz" aria-pressed="true">Cruiser</button><button type="button" data-a="c1" aria-pressed="false">Cessna 172</button><button type="button" data-a="pi" aria-pressed="false">Piper</button><button type="button" data-n>Asegurar cabina ▸</button>`,this.cap), svg=u.q("svg"), L=u.q("[data-l]");
  let ac="cz", H=300, n=-1; const p=(a,r)=>[200+r*Math.sin(a*R),170-r*Math.cos(a*R)], fan=(a,r,c,o)=>{ const [x1,y1]=p(-a,r), [x2,y2]=p(a,r); return `<path d="M200 170L${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${c}" fill-opacity="${o}" stroke="${c}"/>`; };
  const draw=()=>{ const lo=H<500, th=lo?30:45, bank=lo?20:30, a=A[ac];
    svg.innerHTML=`<rect width="400" height="270" fill="#12202f"/><rect x="190" y="196" width="20" height="64" fill="#2b3b4d"/><path d="M200 200V256" stroke="#9fb3c8" stroke-dasharray="6 5"/><text x="216" y="238" font-size="10" style="fill:#9fb3c8">pista</text>
     ${fan(80,128,"#ff8a80",.12)}${fan(th,128,"#6ee7a0",.28)}${!lo?`<path d="M200 170L200 250" stroke="#ffc94d" stroke-width="2" stroke-dasharray="4 4"/><text x="206" y="204" font-size="10" style="fill:#ffc94d">o pista contraria</text>`:""}
     <g transform="translate(200 170)"><path d="M0 -14L9 12L0 7L-9 12Z" fill="#ffc94d" stroke="#12202f"/></g>
     <text x="200" y="22" font-size="12" font-weight="700" text-anchor="middle" style="fill:#6ee7a0">Campos a ±${th}° del rumbo · alabeo máx. ${bank}°</text><text x="200" y="38" font-size="10.5" text-anchor="middle" style="fill:#9fb3c8">${lo?"Por debajo de 500 ft: no vuelvas, elige delante":"Por encima de 500 ft: ±45° o la pista contraria"}</text>
     <text x="22" y="112" font-size="10.5" style="fill:#ff8a80">zona no válida</text><text x="${200+80*Math.sin(th*R)}" y="${170-96*Math.cos(th*R)-4}" font-size="10" style="fill:#6ee7a0">${th}°</text>
     <rect x="12" y="236" width="104" height="24" rx="4" fill="#0b1622" stroke="#e58bd8"/><text x="64" y="252" font-size="11.5" font-weight="700" text-anchor="middle" style="fill:#e58bd8">Planeo ${a[1]} kt</text>`;
    L.innerHTML=`<div style="font:700 11px/1 system-ui;letter-spacing:.1em;color:#9fb3c8;margin-bottom:6px">3 · ASEGURAR CABINA · ${a[0].toUpperCase()}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:5px">`+a[2].map((s,i)=>{ const g=grp(ac,i), c={c:"#f6b73c",f:"#58c4f0",m:"#ff8a80",e:"#e58bd8",s:"#6ee7a0"}[g], on=i<=n; return `<div style="padding:6px 8px;border-radius:5px;border-left:4px solid ${c};background:${on?"#1e3550":"#0b1622"};color:${on?"#fff":"#9fb3c8"};font:600 12.5px/1.3 system-ui;opacity:${i>n&&n>=0?.55:1}">${i+1}. ${s}</div>`; }).join("")+`</div><div style="margin-top:6px;font:500 11.5px/1.4 system-ui;color:#9fb3c8"><span style="color:#f6b73c">■</span> combustible · <span style="color:#58c4f0">■</span> flaps · <span style="color:#ff8a80">■</span> MAYDAY · <span style="color:#e58bd8">■</span> electricidad · <span style="color:#6ee7a0">■</span> seguridad</div>`;
    u.out.innerHTML=`<b style="color:#ffc94d">${a[0]}:</b> mejor planeo <b>${a[1]} kt</b>. A <b>${f0(H)} ft AGL</b> ${lo?"tienes menos de 500 ft: campo delante, ±30°, alabeo máx. 20°":"superas 500 ft: ±45° o pista contraria, alabeo máx. 30°"}. Cabina en orden: 3 de combustible · flaps · MAYDAY · 2 de electricidad · 2 de seguridad.`; };
  btns(el,"data-a",v=>{ ac=v; n=-1; el.querySelectorAll("[data-a]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.a===v?"true":"false")); draw(); });
  u.q("[data-n]").addEventListener("click",()=>{ n=n+1; if(n>=A[ac][2].length) n=-1; draw(); });
  bind(el,o=>{ H=o.h; setO(el,"h",f0(H)); draw(); });
  const vs=()=>{ acBtns(el,"data-a"); if(!acHas(ac)){ ac=acFirst(); n=-1; el.querySelectorAll("[data-a]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.a===ac?"true":"false")); } draw(); };
  acSub(vs); vs();
}};

function mount(el){ const k=el.dataset.viz, v=V[k]; if(!v||el._v) return; el._v=1;
  const go=()=>{ try{ v.init(el); }catch(e){ try{ console.error("F0Viz",k,e); }catch(_){} el.innerHTML=`<p class="lt">${v.t}</p><p class="out">No se ha podido cargar esta lámina.</p>`; } };
  if(!("IntersectionObserver" in window)){ go(); return; }
  el.innerHTML=`<p class="lt">${v.t}</p>`; const o=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ o.disconnect(); go(); } },{rootMargin:"400px"}); o.observe(el); }
function init(){ if(!document.getElementById("f0vizCss")){ const s=document.createElement("style"); s.id="f0vizCss"; s.textContent=CSS; document.head.appendChild(s); } document.querySelectorAll(".f0viz[data-viz]").forEach(mount); }
window.F0Viz={init,V}; if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
