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
.f0viz .ctl{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin:0;background:#0f1b29;color:#e9f0f7;padding:12px 14px;font:600 13.5px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif}
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

/* ---------- 031 · Envolvente de masa y centrado en % MAC ---------- */
V.cgmac={t:"Masa y centrado: carga el avión y sigue el CG en la envolvente (% MAC)",cap:"Avión de ejemplo (monomotor de 4 plazas, cifras redondeadas; datum en el cortafuegos): vacío 680 kg con brazo 1,00 m · asientos delanteros 0,94 m · traseros 1,85 m · equipaje 2,41 m (máx. 54 kg) · combustible 1,22 m (0,72 kg/L, máx. 200 L). LEMAC a 0,80 m y MAC de 1,50 m. MTOM 1 157 kg. Límite delantero: 6 % MAC hasta 885 kg y 16 % MAC a la MTOM; trasero: 27 % MAC.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 452" role="img" aria-label="Esquema lateral del avión con las estaciones de carga, regla de la MAC y envolvente de masa frente a CG en porcentaje de MAC"></svg>`,
    rng("f","Asientos delanteros",0,200,160,5," kg")+rng("r","Asientos traseros",0,200,0,5," kg")+rng("b","Equipaje",0,54,20,1," kg")+rng("l","Combustible al despegue",0,200,140,5," L")+rng("t","Combustible del viaje (trip)",0,200,60,5," L"),this.cap), svg=u.q("svg");
  const E={m:680,a:1.00}, LE=.80, MAC=1.50, MTOM=1157, AFT=27, KG=.72, fwd=m=>m<=885?6:6+(m-885)/(MTOM-885)*10, pc=a=>(a-LE)/MAC*100;
  const ST=[{k:"f",a:.94,n:"Delante",c:"#58c4f0"},{k:"r",a:1.85,n:"Detrás",c:"#b78cf0"},{k:"b",a:2.41,n:"Equipaje",c:"#f6b73c"},{k:"l",a:1.22,n:"Combustible",c:"#6ee7a0"}];
  const XS=a=>62+a*45;   // esquema lateral: 45 px por metro, datum (cortafuegos) en x = 62
  const XR=p=>40+p*8;    // regla de la MAC: 0–40 % en 320 px
  const XE=p=>52+(p-0)*9.4, YE=m=>436-(m-650)*.40;   // envolvente: 0–34 % MAC · 650–1 200 kg
  const fmt=x=>x.toFixed(2).replace(".",",");
  bind(el,o=>{ const t=Math.min(o.t,o.l); ["f","r","b","l"].forEach(k=>setO(el,k,o[k])); setO(el,"t",t);
    const load=fuelL=>{ const items=[[E.m,E.a],[o.f,.94],[o.r,1.85],[o.b,2.41],[fuelL*KG,1.22]], m=items.reduce((s,i)=>s+i[0],0), mo=items.reduce((s,i)=>s+i[0]*i[1],0); return {m,mo,cg:mo/m,p:pc(mo/m)}; };
    const TO=load(o.l), LD=load(o.l-t), ZF=load(0), ok=P=>P.m<=MTOM+1e-9&&P.p>=fwd(P.m)-1e-9&&P.p<=AFT+1e-9, oT=ok(TO), oL=ok(LD), oZ=ok(ZF);
    const col=b=>b?"#6ee7a0":"#ff3b30";
    // esquema lateral del avión de ala alta
    const fus=`<path d="M${XS(-1.05)} 64q4 -14 16 -16H${XS(0)}l6 -18H${XS(2.1)}l22 14H${XS(6.2)}l16 -26h10l-4 30v10l-34 4H${XS(1.6)}l-20 4H${XS(0)}l-26 -2q-10 -2 -12 -14z" fill="#2a3f57" stroke="#9fb3c8" stroke-width="1.2"/>
      <path d="M${XS(0)} 30H${XS(2.1)}" stroke="#9fb3c8" stroke-width="1"/><path d="M${XS(.15)} 34l14 -2V44h-14z M${XS(.62)} 32h22v12h-22z M${XS(1.38)} 32h18l8 12h-26z" fill="#58c4f0" opacity=".35"/>
      <rect x="${XS(LE)}" y="22" width="${MAC*45}" height="6" rx="3" fill="#dfe8f1"/><text x="${XS(LE+MAC/2)}" y="16" font-size="9.5" text-anchor="middle" fill="#9fb3c8">ala · MAC</text>
      <path d="M${XS(-1.05)+2} 52v18" stroke="#dfe8f1" stroke-width="2"/><path d="M${XS(0)} 44v56" stroke="#ffc94d" stroke-dasharray="3 3"/><text x="${XS(0)+4}" y="100" font-size="9.5" fill="#ffc94d">datum</text>
      <circle cx="${XS(-.5)}" cy="91" r="5" fill="#1a2b3f" stroke="#9fb3c8"/><circle cx="${XS(1.65)}" cy="91" r="6" fill="#1a2b3f" stroke="#9fb3c8"/>`;
    const st=ST.slice().sort((a,b)=>a.a-b.a).map((s,i)=>{ const m=s.k==="l"?o.l*KG:o[s.k], r=m>0?3+Math.sqrt(m)*.5:2.5, y=60, lx=58+i*95;
      return `<path d="M${XS(s.a)} ${y}L${XS(s.a)} 96L${lx} 112" stroke="${s.c}" stroke-width=".9" fill="none" opacity=".7"/><circle cx="${XS(s.a)}" cy="${y}" r="${r.toFixed(1)}" fill="${s.c}" fill-opacity="${m>0?.85:.25}" stroke="#12202f"/><text x="${lx}" y="124" font-size="9.5" text-anchor="middle" fill="${s.c}">${s.n} ${f0(m)} kg</text><text x="${lx}" y="135" font-size="8.5" text-anchor="middle" fill="#9fb3c8">brazo ${s.a.toFixed(2).replace(".",",")} m</text>`; }).join("");
    const cgS=`<path d="M${XS(TO.cg)} 40l-6 -10h12z" fill="${col(oT)}"/><text x="${XS(TO.cg)}" y="12" font-size="10" font-weight="700" text-anchor="middle" fill="${col(oT)}">CG</text>`;
    // regla de la MAC
    const fl=fwd(TO.m), rule=`<text x="40" y="150" font-size="10" fill="#9fb3c8">Regla de la MAC (0 % = LEMAC · 100 % = TEMAC)</text>
      <rect x="${XR(0)}" y="156" width="${XR(40)-XR(0)}" height="12" fill="#1a2b3f"/><rect x="${XR(fl)}" y="156" width="${XR(AFT)-XR(fl)}" height="12" fill="#6ee7a0" opacity=".28"/>
      ${[0,10,20,30,40].map(p=>`<path d="M${XR(p)} 168v5" stroke="#9fb3c8"/><text x="${XR(p)}" y="184" font-size="9.5" text-anchor="middle" fill="#9fb3c8">${p} %</text>`).join("")}
      <path d="M${XR(fl)} 152v20M${XR(AFT)} 152v20" stroke="#6ee7a0" stroke-width="1.5"/>
      ${[[ZF,"#9fb3c8","ZFM"],[LD,"#58c4f0","LM"],[TO,"#ffc94d","TOM"]].map(q=>`<path d="M${XR(cl(q[0].p,-2,42))} 154l-5 -8h10z" fill="${q[1]}"/>`).join("")}`;
    // envolvente
    const env=`<rect x="${XE(0)}" y="${YE(1200)}" width="${XE(34)-XE(0)}" height="${YE(650)-YE(1200)}" fill="#0f1b29"/>
      ${[700,800,900,1000,1100,1200].map(m=>`<path d="M${XE(0)} ${YE(m)}H${XE(34)}" stroke="#22364c"/><text x="${XE(0)-4}" y="${YE(m)+3}" font-size="9.5" text-anchor="end" fill="#9fb3c8">${f0(m)}</text>`).join("")}
      ${[0,5,10,15,20,25,30].map(p=>`<path d="M${XE(p)} ${YE(1200)}V${YE(650)}" stroke="#22364c"/><text x="${XE(p)}" y="${YE(650)+12}" font-size="9.5" text-anchor="middle" fill="#9fb3c8">${p}</text>`).join("")}
      <text x="${XE(17)}" y="${YE(650)+24}" font-size="10" text-anchor="middle" fill="#9fb3c8">CG en % MAC</text><text x="14" y="${YE(925)}" font-size="10" fill="#9fb3c8" transform="rotate(-90 14 ${YE(925)})" text-anchor="middle">masa (kg)</text>
      <path d="M${XE(6)} ${YE(680)}V${YE(885)}L${XE(16)} ${YE(MTOM)}H${XE(AFT)}V${YE(680)}Z" fill="#6ee7a0" fill-opacity=".14" stroke="#6ee7a0" stroke-width="1.6"/>
      <text x="${XE(21.5)}" y="${YE(MTOM)-5}" font-size="9.5" text-anchor="middle" fill="#6ee7a0">MTOM ${f0(MTOM)} kg</text>
      <path d="M${XE(cl(ZF.p,-1,35))} ${YE(ZF.m)}L${XE(cl(LD.p,-1,35))} ${YE(LD.m)}L${XE(cl(TO.p,-1,35))} ${YE(Math.min(TO.m,1210))}" stroke="#dfe8f1" stroke-width="1.3" stroke-dasharray="4 3" fill="none"/>
      ${[[ZF,"#9fb3c8","ZFM",oZ],[LD,"#58c4f0","LM",oL],[TO,"#ffc94d","TOM",oT]].map(q=>{ const x=XE(cl(q[0].p,-1,35)), y=YE(Math.min(q[0].m,1210)); return `<circle cx="${x}" cy="${y}" r="5.5" fill="${q[1]}" stroke="${q[3]?"#12202f":"#ff3b30"}" stroke-width="${q[3]?1:3}"/><text x="${x+8}" y="${y+4}" font-size="10" font-weight="700" fill="${q[1]}">${q[2]}</text>`; }).join("")}`;
    svg.innerHTML=`<rect width="400" height="452" fill="#12202f"/>${fus}${st}${cgS}${rule}${env}`;
    const line=(n,P,b)=>`<b>${n}</b>: ${f0(P.m)} kg · momento ${f0(P.mo)} kg·m · CG ${fmt(P.cg)} m = <b>${f1(P.p)} % MAC</b> ${b?'<span class="ok">✓</span>':`<span class="bad">✗ ${P.m>MTOM?"pasa la MTOM":P.p<fwd(P.m)?"por delante del límite":"por detrás del límite"}</span>`}`;
    u.out.innerHTML=`${line("Despegue (TOM)",TO,oT)}<br>${line("Aterrizaje (LM)",LD,oL)}<br>${line("Sin combustible (ZFM)",ZF,oZ)}<br>% MAC = (CG − LEMAC) ÷ MAC × 100 = (${fmt(TO.cg)} − 0,80) ÷ 1,50 × 100. ${o.l>0?(TO.cg<1.22?"El combustible (1,22 m) está <b>detrás</b> del CG: al quemarlo, el CG <b>avanza</b>.":"El combustible (1,22 m) está <b>delante</b> del CG: al quemarlo, el CG <b>se retrasa</b>."):""}`; });
}};

/* ---------- 032 · Despegue, aterrizaje y gradiente (Clase B) ---------- */
V.todr={t:"Performance: despegue, aterrizaje y ascenso frente a TORA, TODA, ASDA y LDA",cap:"Avión de ejemplo a MTOM en ISA a nivel del mar, asfalto seco, sin viento ni pendiente: despegue hasta 50 ft 480 m (carrera 260 m), aterrizaje desde 50 ft 400 m (carrera 190 m), 700 ft/min a 70 KIAS. Factores orientativos (CAA Safety Sense 7): despegue +10 %/1 000 ft, hierba seca ×1,20, mojada ×1,30, ±5 % por cada 1 % de pendiente; aterrizaje +5 %/1 000 ft, asfalto mojado ×1,15, hierba seca ×1,15, mojada ×1,35. Viento con la regla de Clase B: 50 % del de cara y 150 % del de cola. Pista: TORA 800 m · TODA 900 m (CWY 100) · ASDA 850 m (SWY 50) · LDA 700 m (umbral desplazado 100 m).",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 352" role="img" aria-label="Pista con TORA, TODA, ASDA y LDA, distancias de despegue y aterrizaje y perfil de ascenso"></svg>`,
    rng("s","Pendiente (− bajada · + subida)",-2,2,0,.5," %")+rng("w","Viento (− cola · + cara)",-10,20,0,1," kt")+rng("da","Altitud de densidad",0,8000,0,250," ft")
    +`<button type="button" data-sf="0" aria-pressed="true">Asfalto seco</button><button type="button" data-sf="1" aria-pressed="false">Asfalto mojado</button><button type="button" data-sf="2" aria-pressed="false">Hierba seca</button><button type="button" data-sf="3" aria-pressed="false">Hierba mojada</button>`
    +`<button type="button" data-fl="1" aria-pressed="true">Flaps recomendados (10° / 30°)</button><button type="button" data-fl="0" aria-pressed="false">Flaps 0°</button>`,this.cap), svg=u.q("svg");
  const RW={tora:800,toda:900,asda:850,lda:700,dth:100}, X=m=>18+m*.39, SF=[["asfalto seco",1,1],["asfalto mojado",1,1.15],["hierba seca",1.2,1.15],["hierba mojada",1.3,1.35]];
  let sf=0, fl=1, last={};
  const draw=o=>{ const w=o.w, s=o.s, da=o.da, weT=w>0?.5*w:1.5*w, wind=(V,we)=>Math.pow((V-we)/V,2);
    // despegue
    const fT=Math.pow(1.1,da/1000)*SF[sf][1]*(1+.05*s)*wind(55,weT)*(fl?1:1.12), tod=480*fT, gr=260*fT;
    // aterrizaje (pendiente: cuesta abajo alarga)
    const fL=Math.pow(1.05,da/1000)*SF[sf][2]*(1-.05*s)*wind(60,weT)*(fl?1:1.35), ld=400*fL, lr=190*fL, ldr=ld/.7;
    // ascenso: régimen cae con la altitud de densidad; flaps de despegue restan un 10 %; el gradiente es sobre el suelo
    const roc=700*(1-.07*da/1000)*(fl?.9:1), tas=70*(1+.02*da/1000), gs=tas-w, grd=roc/(gs*101.27)*100, ang=Math.atan(grd/100)/R;
    const c1=tod*1.25<=RW.tora, c2=tod<=RW.tora&&tod*1.15<=RW.toda&&tod*1.3<=RW.asda, okT=c1||c2, okL=ldr<=RW.lda;
    const dim=(a,b,y,t,c)=>`<path d="M${X(a)} ${y}H${X(b)}M${X(a)} ${y-4}v8M${X(b)} ${y-4}v8" stroke="${c}" stroke-width="1.3"/><text x="${(X(a)+X(b))/2}" y="${y-4}" font-size="9.5" text-anchor="middle" fill="${c}">${t}</text>`;
    const rwy=(y,lab,dy)=>`<rect x="${X(0)}" y="${y-5}" width="${X(RW.tora)-X(0)}" height="10" fill="#3b4652"/><rect x="${X(RW.tora)}" y="${y-5}" width="${X(RW.asda)-X(RW.tora)}" height="10" fill="#6b5a2a"/>
      <path d="M${X(RW.tora)+3} ${y-3}l5 3l-5 3M${X(RW.tora)+10} ${y-3}l5 3l-5 3" stroke="#f6b73c" fill="none"/><rect x="${X(RW.tora)}" y="${y-9}" width="${X(RW.toda)-X(RW.tora)}" height="18" fill="none" stroke="#58c4f0" stroke-dasharray="3 3"/>
      <path d="M${X(0)} ${y}H${X(RW.tora)}" stroke="#dfe8f1" stroke-dasharray="6 6" stroke-width=".8"/><text x="${X(0)}" y="${y+(dy||20)}" font-size="9.5" fill="#9fb3c8">${lab}</text>`;
    const yT=96, h50=26, xLo=X(Math.min(gr,1000)), xT=X(Math.min(tod,1000));
    const toP=`<path d="M${X(0)} ${yT-1}H${xLo}" stroke="#ffc94d" stroke-width="3"/><path d="M${xLo} ${yT-1}Q${(xLo+xT)/2} ${yT-2} ${xT} ${yT-h50}" stroke="#ffc94d" stroke-width="2.4" fill="none"/>
      <path d="M${xT} ${yT-h50}l${Math.min(60,400-xT)} ${-Math.min(60,400-xT)*Math.tan(ang*R)*6}" stroke="#ffc94d" stroke-width="1.6" stroke-dasharray="4 3"/><circle cx="${xT}" cy="${yT-h50}" r="3.5" fill="#ffc94d"/><text x="${xT>340?xT-7:xT+7}" y="${yT-h50+12}" font-size="9.5" text-anchor="${xT>340?"end":"start"}" fill="#ffc94d">50 ft</text>`;
    const yL=196, xTh=X(RW.dth), xTd=X(Math.min(RW.dth+ld-lr,1000)), xSt=X(Math.min(RW.dth+ld,1000));
    const ldP=`<path d="M${xTh} ${yL-h50}Q${(xTh+xTd)/2} ${yL-4} ${xTd} ${yL-1}" stroke="#58c4f0" stroke-width="2.4" fill="none"/><path d="M${xTd} ${yL-1}H${xSt}" stroke="#58c4f0" stroke-width="3"/><circle cx="${xTh}" cy="${yL-h50}" r="3.5" fill="#58c4f0"/>
      <path d="M${xTh} ${yL-12}v22" stroke="#dfe8f1" stroke-width="2"/><text x="${xTh}" y="${yL+20}" font-size="9.5" text-anchor="middle" fill="#dfe8f1">umbral</text>`;
    // perfil de ascenso a escala real (vertical ×5)
    const px0=40, py0=338, pxs=150/1000;   // 1 000 m horizontales = 150 px; la altura se dibuja ×3
    const prof=`<rect x="${px0-30}" y="246" width="372" height="102" fill="#0f1b29"/><text x="${px0-24}" y="262" font-size="10" fill="#9fb3c8">Ascenso tras los 50 ft (altura ×3)</text>
      <path d="M${px0} ${py0}H${px0+330}" stroke="#3a516b" stroke-width="2"/>${[0,500,1000,1500,2000].map(m=>`<path d="M${px0+m*pxs} ${py0}v4" stroke="#9fb3c8"/><text x="${px0+m*pxs}" y="${py0+13}" font-size="9" text-anchor="middle" fill="#9fb3c8">${f0(m)} m</text>`).join("")}
      <clipPath id="tdc"><rect x="${px0}" y="266" width="330" height="${py0-266}"/></clipPath>
      <g clip-path="url(#tdc)"><path d="M${px0} ${py0}l2000 ${-2000*.05*3}" stroke="#9fb3c8" stroke-width="1" stroke-dasharray="3 3"/><path d="M${px0} ${py0}l2000 ${-2000*grd/100*3}" stroke="#ffc94d" stroke-width="2.4"/></g>
      ${(()=>{ const ex=Math.min(330,(py0-270)/(grd/100*3)), e5=Math.min(330,(py0-270)/(.05*3)); return `<text x="${Math.min(px0+e5+4,360)}" y="${py0-e5*.05*3+10}" font-size="9" fill="#9fb3c8">5 %</text><text x="${Math.min(px0+ex,348)}" y="${Math.max(280,py0-ex*grd/100*3-6)}" font-size="10.5" font-weight="700" text-anchor="end" fill="#ffc94d">${f1(grd)} % · ${f1(ang)}°</text>`; })()}`;
    svg.innerHTML=`<rect width="400" height="352" fill="#12202f"/><text x="18" y="16" font-size="10.5" font-weight="700" fill="#ffc94d">DESPEGUE →</text>
      ${dim(0,RW.tora,32,"TORA "+RW.tora,"#dfe8f1")}${dim(0,RW.asda,48,"ASDA "+RW.asda,"#f6b73c")}${dim(0,RW.toda,64,"TODA "+RW.toda,"#58c4f0")}${rwy(yT,"carrera y despegue hasta 50 ft"+(s?` · pista ${s>0?"cuesta arriba":"cuesta abajo"} ${f1(Math.abs(s))} %`:""))}${toP}
      <text x="18" y="134" font-size="10.5" font-weight="700" fill="#58c4f0">ATERRIZAJE →</text>${dim(RW.dth,RW.dth+RW.lda,150,"LDA "+RW.lda,"#dfe8f1")}${dim(RW.dth,RW.dth+Math.min(ldr,900),166,"LDR = LD ÷ 0,7 · "+f0(ldr),okL?"#6ee7a0":"#ff8a80")}${rwy(yL,"desde 50 ft sobre el umbral hasta parar",32)}${ldP}${prof}`;
    u.out.innerHTML=`<b>Despegue</b> (${SF[sf][0]}, flaps ${fl?"10°":"0°"}): carrera <b>${f0(gr)} m</b> · hasta 50 ft <b>${f0(tod)} m</b> (factor ×${fT.toFixed(2).replace(".",",")}). TOD × 1,25 = ${f0(tod*1.25)} m ${c1?"≤":">"} TORA · o bien TOD ≤ TORA, × 1,15 = ${f0(tod*1.15)} ${tod*1.15<=RW.toda?"≤":">"} TODA y × 1,3 = ${f0(tod*1.3)} ${tod*1.3<=RW.asda?"≤":">"} ASDA → ${okT?'<span class="ok">cumple</span>':'<span class="bad">no cumple</span>'}.<br><b>Aterrizaje</b> (flaps ${fl?"30°":"0°"}): <b>${f0(ld)} m</b> desde 50 ft · requerida ÷ 0,7 = <b>${f0(ldr)} m</b> ${okL?'<span class="ok">≤ LDA</span>':'<span class="bad">> LDA: no cumple</span>'}.<br><b>Ascenso</b>: ${f0(roc)} ft/min a ${f0(tas)} kt TAS, ${f0(gs)} kt sobre el suelo → gradiente <b>${f1(grd)} %</b> (${f1(ang)}°). ${w>0?"El viento de cara <b>aumenta el ángulo</b> sobre el suelo, no el régimen.":w<0?"El viento de cola <b>aplana el ángulo</b> sobre el suelo.":""}${da?" La altitud de densidad alarga las carreras y reduce el régimen.":""}`; };
  btns(el,"data-sf",v=>{ sf=+v; draw(last); }); btns(el,"data-fl",v=>{ fl=+v; draw(last); });
  bind(el,o=>{ last=o; setO(el,"s",(o.s>0?"+":"")+f1(o.s)); setO(el,"w",(o.w>0?"+":"")+o.w); setO(el,"da",f0(o.da)); draw(o); });
}};

/* ---------- 033 · PET y PNR (PSR) animados ---------- */
V.pet={t:"PET y PNR (PSR): muévelos con el viento y la autonomía",cap:"O = velocidad sobre el suelo en la ida (TAS − viento de cara); H = en la vuelta (TAS + viento). PET = D × H ÷ (O + H). PNR: tiempo = autonomía × H ÷ (O + H) y distancia = autonomía × O × H ÷ (O + H). Autonomía segura = sin contar la reserva.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 300" role="img" aria-label="Ruta entre A y B con el PET y el PNR, y gráfica de la distancia al PNR según el viento"></svg>`,rng("d","Distancia A–B",300,1500,900,50," NM")+rng("v","TAS",120,480,300,10," kt")+rng("w","Viento en la ida (− cola · + cara)",-80,80,40,5," kt")+rng("e","Autonomía segura",2,10,4,.5," h")+`<button type="button" data-play aria-pressed="false">▶ Volar hasta el PNR y volver</button>`,this.cap), svg=u.q("svg");
  let st=null, anim=null, raf=0;
  const X=(x,D)=>30+cl(x/D,0,1.08)*320, hm=t=>{ const h=Math.floor(t), m=Math.round((t-h)*60); return (m===60?h+1:h)+" h "+String(m===60?0:m).padStart(2,"0")+" min"; };
  const draw=()=>{ const o=st, D=o.d, O=o.v-o.w, H=o.v+o.w, E=o.e, pet=D*H/(O+H), tpet=pet/O, tp=E*H/(O+H), pnr=tp*O, p0=E*o.v/2;
    let px=null, fuel=1, back=false;
    if(anim){ const k=cl((performance.now()-anim)/7000,0,1), T=k*E; back=T>tp; px=back?pnr-(T-tp)*H:T*O; fuel=1-k; if(k>=1){ anim=null; u.q("[data-play]").setAttribute("aria-pressed","false"); } }
    const dmin=E*(o.v*o.v-6400)/(2*o.v), XC=w=>40+(w+80)/160*320, YC=d=>280-(d-dmin)/Math.max(1,p0-dmin)*80;   // gráfica: viento −80…+80 kt; eje vertical ampliado entre el PNR con 80 kt y el de calma
    const curve=Array.from({length:33},(_,i)=>{ const ww=-80+i*5, dd=E*(o.v*o.v-ww*ww)/(2*o.v); return `${i?"L":"M"}${XC(ww).toFixed(1)} ${YC(dd).toFixed(1)}`; }).join("");
    const ymax=YC(p0);
    svg.innerHTML=`<rect width="400" height="300" fill="#12202f"/>
      <path d="M30 70H350" stroke="#dfe8f1" stroke-width="3"/><circle cx="30" cy="70" r="6" fill="#dfe8f1"/><circle cx="350" cy="70" r="6" fill="#dfe8f1"/><text x="30" y="94" font-size="12" text-anchor="middle">A</text><text x="350" y="94" font-size="12" text-anchor="middle">B</text>
      <path d="M190 70V36" stroke="#5d6977" stroke-dasharray="3 3"/><text x="190" y="30" font-size="9.5" text-anchor="middle" fill="#9fb3c8">mitad</text>
      <path d="M${X(pet,D)} 70V46" stroke="#6ee7a0" stroke-width="2"/><circle cx="${X(pet,D)}" cy="70" r="5" fill="#6ee7a0"/><text x="${X(pet,D)}" y="18" font-size="11" font-weight="700" text-anchor="middle" fill="#6ee7a0">PET</text>
      <path d="M${X(pnr,D)} 70V100" stroke="#f6b73c" stroke-width="2"/><circle cx="${X(pnr,D)}" cy="70" r="5" fill="#f6b73c"/><text x="${X(pnr,D)}" y="114" font-size="11" font-weight="700" text-anchor="middle" fill="#f6b73c">PNR${pnr>D?" (más allá de B)":""}</text>
      <path d="M${X(p0,D)} 66v16" stroke="#f6b73c" stroke-dasharray="2 2" opacity=".7"/><text x="${X(p0,D)+4}" y="88" font-size="9" fill="#f6b73c" opacity=".85">en calma</text>
      <path d="M${o.w>=0?320:280} 128H${o.w>=0?280:320}m0 0l${o.w>=0?7:-7} -4m${o.w>=0?-7:7} 4l${o.w>=0?7:-7} 4" stroke="#9fb3c8" stroke-width="1.6" fill="none" opacity="${o.w?1:.2}"/><text x="330" y="132" font-size="10" fill="#9fb3c8">${o.w?"viento":"calma"}</text>
      ${px!=null?`<g transform="translate(${X(px,D)} 70) scale(${back?-1:1} 1)"><path d="M10 0L-6 -3L-9 -9H-11L-9 0L-11 9H-9L-6 3Z" fill="#ffc94d"/></g>`:""}
      <rect x="30" y="122" width="120" height="8" fill="#1a2b3f"/><rect x="30" y="122" width="${120*fuel}" height="8" fill="${fuel>.15?"#6ee7a0":"#ff3b30"}"/><text x="30" y="144" font-size="9.5" fill="#9fb3c8">combustible utilizable</text>
      <rect x="30" y="160" width="350" height="136" fill="#0f1b29"/><text x="40" y="176" font-size="10" fill="#9fb3c8">Distancia al PNR según el viento (misma TAS y autonomía)</text>
      <path d="M${XC(0)} 182V284" stroke="#3a516b" stroke-dasharray="3 3"/><path d="M40 284H360" stroke="#3a516b"/><text x="360" y="276" font-size="9" text-anchor="end" fill="#9fb3c8">${f0(dmin)} NM</text><text x="44" y="${YC(p0)+14}" font-size="9" fill="#9fb3c8">${f0(p0)} NM</text>
      ${[-80,-40,0,40,80].map(ww=>`<text x="${XC(ww)}" y="${296}" font-size="9" text-anchor="middle" fill="#9fb3c8">${ww>0?"+":""}${ww}</text>`).join("")}
      <path d="${curve}" stroke="#f6b73c" stroke-width="2" fill="none"/><circle cx="${XC(o.w)}" cy="${YC(pnr)}" r="5" fill="#f6b73c"/><text x="${XC(0)}" y="${ymax-6}" font-size="9.5" text-anchor="middle" fill="#f6b73c">máximo sin viento</text>`;
    u.out.innerHTML=`O = <b>${O} kt</b> · H = <b>${H} kt</b><br><b class="ok">PET</b>: a <b>${f0(pet)} NM</b> de A (${hm(tpet)}). ${o.w>0?"Con viento de cara en la ida queda <b>pasada la mitad</b>: se desplaza hacia el viento.":o.w<0?"Con viento de cola en la ida queda <b>antes de la mitad</b>.":"Sin viento, justo en la mitad."}<br><b style="color:#f6b73c">PNR</b>: a <b>${f0(pnr)} NM</b> de A (${hm(tp)} de ida y ${hm(E-tp)} de vuelta). ${o.w?`Distancia al PNR = autonomía × (TAS² − viento²) ÷ (2 × TAS): con cualquier viento, de cara o de cola, es <b>menor</b> que en calma (${f0(p0)} NM), porque lo que ganas en un tramo lo pierdes con creces en el otro.`:"Sin viento es el máximo posible: cualquier viento lo acercará a A."}`;
    if(anim){ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ if(el.isConnected) draw(); }); } };
  u.q("[data-play]").addEventListener("click",e=>{ anim=performance.now(); e.currentTarget.setAttribute("aria-pressed","true"); draw(); });
  bind(el,o=>{ st=o; ["d","v","e"].forEach(k=>setO(el,k,String(o[k]).replace(".",","))); setO(el,"w",(o.w>0?"+":"")+o.w); draw(); });
}};

/* ---------- 040 · Ilusiones visuales en la aproximación ---------- */
V.illus={t:"Ilusiones de aproximación: lo que ves, lo que crees y la senda que acabas volando",cap:"Modelo simplificado: el piloto intenta que la pista se vea con la forma de siempre (30 m de ancho, plana, senda de 3°). El «agujero negro» sigue el experimento de Kraft: sin referencias del terreno se mantiene constante el ángulo con que se ven las luces de la pista, y la trayectoria resultante es un arco que queda muy por debajo de la senda. Pista de 2 000 m. El PAPI dice siempre la verdad.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 352" role="img" aria-label="Vista del piloto y perfil lateral de la aproximación con la senda real y la percibida"></svg>`,
    `<button type="button" data-ill="n" aria-pressed="true">Normal</button><button type="button" data-ill="w" aria-pressed="false">Pista ancha</button><button type="button" data-ill="s" aria-pressed="false">Pista estrecha</button><button type="button" data-ill="u" aria-pressed="false">Cuesta arriba</button><button type="button" data-ill="d" aria-pressed="false">Cuesta abajo</button><button type="button" data-ill="b" aria-pressed="false">Agujero negro (noche)</button>`
    +rng("W","Anchura de la pista",15,60,30,1," m")+rng("sl","Pendiente de la pista",-3,3,0,.5," %")+rng("x","Distancia a la pista",.5,5,3,.1," NM"),this.cap), svg=u.q("svg");
  const L=2000, G=3*R, NM=1852, hole={on:false};
  const set=(k,v)=>{ const i=el.querySelector(`[data-k="${k}"]`); i.value=v; };
  const flown=(dm,W,sl)=>{ if(hole.on){ const D=5*NM, h0=D*Math.tan(G), k=(D*(D+L)+h0*h0)/(2*h0), x=-dm; return k-Math.sqrt(Math.max(0,k*k-x*(x-L))); }
    const g=Math.asin(cl(Math.sin(G)*W/30,-1,1))-Math.atan(sl/100); return dm*Math.tan(Math.max(.3*R,g)); };
  const gFlown=(W,sl)=>Math.max(.3*R,Math.asin(cl(Math.sin(G)*W/30,-1,1))-Math.atan(sl/100))/R;
  const draw=o=>{ const W=o.W, sl=o.sl, dm=o.x*NM, h=dm*Math.tan(G), night=hole.on;
    // vista del piloto desde la senda correcta de 3°
    const f=dm*1.15, cx=200, cy=104, aim=300, p=Math.atan2(h,dm+aim), cp=Math.cos(p), sp=Math.sin(p);
    const P=(x,z,y0)=>{ const yy=(y0==null?Math.max(0,x)*sl/100:y0), dx=x+dm, dy=yy-h, dep=dx*cp-dy*sp, up=dx*sp+dy*cp; return [cx+f*z/dep, cy-f*up/dep]; };
    const hz=cy-f*Math.tan(p), poly=(pts)=>pts.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join("")+"Z";
    const rw=poly([P(0,-W/2),P(L,-W/2),P(L,W/2),P(0,W/2)]), gh=poly([P(0,-15,0),P(L,-15,0),P(L,15,0),P(0,15,0)]);
    const cline=Array.from({length:20},(_,i)=>{ const a=P(60+i*96,0), b=P(60+i*96+40,0); return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }).join("");
    const thb=Array.from({length:8},(_,i)=>{ const z=-W/2+W*(i+.5)/8, a=P(6,z), b=P(36,z); return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`; }).join("");
    const th=Math.atan2(h+1.5,dm+aim)/R, S=[3.5,3.17,2.83,2.5], papi=S.map((sv,i)=>{ const q=P(aim,-W/2-15-i*9,0); return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="2.6" fill="${th>sv?"#fffdf2":"#ff3b30"}"/>`; }).join("");
    const lights=night?Array.from({length:22},(_,i)=>{ const x=i*L/21, a=P(x,-W/2), b=P(x,W/2); return `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="1.5" fill="#ffe9b0"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="1.5" fill="#ffe9b0"/>`; }).join("")
      +Array.from({length:9},(_,i)=>{ const q=P(0,-W/2+W*i/8); return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1.6" fill="#6ee7a0"/>`; }).join(""):"";
    const town=night?Array.from({length:40},(_,i)=>{ const q=P(-dm*.15+((i*733)%2400)+400,((i*397)%1600)-800+(i%2?900:-900),0); return q[1]>hz&&q[1]<185?`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1" fill="#ffcf8a" opacity=".7"/>`:""; }).join(""):"";
    const view=`<defs><clipPath id="ilc"><rect x="0" y="0" width="400" height="182"/></clipPath></defs><g clip-path="url(#ilc)">
      <rect width="400" height="${Math.max(0,hz)}" fill="${night?"#060b16":"#7fb2e6"}"/><rect y="${hz}" width="400" height="${182-hz}" fill="${night?"#05080d":"#6f8a4e"}"/>
      <path d="${rw}" fill="${night?"#080b10":"#3f464f"}" stroke="${night?"none":"#cfd6dd"}" stroke-width=".8"/>${night?"":`<path d="${cline}${thb}" stroke="#f2f2ee" stroke-width="1.4"/>`}
      ${night?"":`<path d="${gh}" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="4 3" opacity=".95"/>`}${lights}${town}${papi}</g>
      <rect x="6" y="${night?156:142}" width="236" height="${night?20:34}" rx="4" fill="#12202f" opacity=".8"/><text x="12" y="${night?170:156}" font-size="10" fill="#dfe8f1">Vista con zoom desde la senda correcta de 3°</text>${night?"":`<text x="12" y="170" font-size="9.5" fill="#ffffff">- - - imagen habitual (30 m, plana)</text>`}`;
    // perfil lateral
    const X=nm=>335-nm*58, Y=ft=>336-ft*.085, ft=m=>m/.3048;
    const pts=Array.from({length:51},(_,i)=>{ const nm=5-i*.1, hh=flown(nm*NM,W,sl); return `${i?"L":"M"}${X(nm).toFixed(1)} ${Y(ft(hh)).toFixed(1)}`; }).join("");
    const ter=nm=>430*Math.max(0,1-Math.pow((nm-2.6)/.95,2));   // colina oscura antes de la pista
    const hill=night?`<path d="M${X(3.6)} ${Y(0)}${Array.from({length:41},(_,i)=>{ const nm=3.6-i*.05; return `L${X(nm).toFixed(1)} ${Y(ter(nm)).toFixed(1)}`; }).join("")}Z" fill="#2b3a2a"/>`:"";
    const hf=flown(dm,W,sl), hT=h, dFt=ft(hf-hT), plane=(x,y,c)=>`<path d="M${x+7} ${y}l-10 -3v-4h-2v4l-4 3l4 3v4h2v-4z" fill="${c}"/>`;
    const minClr=night?Math.min(...Array.from({length:41},(_,i)=>{ const nm=3.6-i*.05; return ft(flown(nm*NM,W,sl))-ter(nm); })):null;
    const prof=`<rect x="0" y="190" width="400" height="162" fill="#0f1b29"/><text x="390" y="205" font-size="10" text-anchor="end" fill="#9fb3c8">Perfil lateral (altura exagerada)</text>
      <path d="M0 ${Y(0)}H400" stroke="#3a516b" stroke-width="2"/><rect x="${X(0)}" y="${Y(0)-2}" width="${2000/NM*58}" height="4" fill="#9fb3c8"/>${hill}
      ${[0,1,2,3,4,5].map(n=>`<text x="${X(n)}" y="${Y(0)+12}" font-size="9" text-anchor="middle" fill="#9fb3c8">${n} NM</text>`).join("")}
      <path d="M${X(5)} ${Y(ft(5*NM*Math.tan(G)))}L${X(0)} ${Y(0)}" stroke="#6ee7a0" stroke-width="2"/><path d="M12 ${Y(0)-34}h18" stroke="#6ee7a0" stroke-width="2"/><text x="34" y="${Y(0)-31}" font-size="9.5" fill="#6ee7a0">senda real de 3°</text><path d="M12 ${Y(0)-20}h18" stroke="#ff8a80" stroke-width="2" stroke-dasharray="5 3"/><text x="34" y="${Y(0)-17}" font-size="9.5" fill="#ff8a80">senda que acabas volando</text>
      <clipPath id="ilp"><rect x="0" y="212" width="400" height="140"/></clipPath><path d="${pts}" stroke="#ff8a80" stroke-width="2.2" stroke-dasharray="6 4" fill="none" clip-path="url(#ilp)"/>
      ${plane(X(o.x),Y(ft(hT)),"#6ee7a0")}${plane(X(o.x),Y(ft(hf)),"#ff8a80")}<path d="M${X(o.x)} ${Y(ft(hT))}V${Y(ft(hf))}" stroke="#dfe8f1" stroke-dasharray="2 2"/>`;
    svg.innerHTML=`<rect width="400" height="352" fill="#12202f"/>${view}${prof}`;
    const g2=gFlown(W,sl), pr=Math.round(dFt);
    let msg;
    if(night) msg=`<b>Agujero negro</b>: de noche, sin luces en el terreno, solo ves la pista. Si mantienes la forma de las luces, vuelas un <b>arco por debajo de la senda</b>: a ${f1(o.x)} NM vas <b class="bad">${f0(Math.abs(pr))} ft bajo</b> y el margen mínimo con el terreno se queda en <b class="${minClr<200?"bad":""}">${f0(Math.max(0,minClr))} ft</b>. Solución: altímetro, senda ILS/PAPI y altitudes mínimas por distancia.`;
    else if(Math.abs(g2-3)<.1) msg=`Pista de 30 m y plana: la imagen coincide con la habitual y vuelas la <b class="ok">senda correcta de 3°</b>. El PAPI muestra <b>2 blancas y 2 rojas</b>.`;
    else{ const hi=g2>3; msg=`${W>30?"La pista <b>ancha</b> parece más cerca y más baja":W<30?"La pista <b>estrecha</b> parece más lejos y más alta":""}${W!==30&&sl?"; además, ":""}${sl>0?"la pendiente <b>ascendente</b> la hace parecer más empinada: crees ir <b>alto</b>":sl<0?"la pendiente <b>descendente</b> la aplana: crees ir <b>bajo</b>":""}. Para ver la imagen de siempre acabas volando una senda de <b>${f1(g2)}°</b>: a ${f1(o.x)} NM vas <b class="bad">${f0(Math.abs(pr))} ft ${hi?"alto":"bajo"}</b>. ${hi?"Riesgo: aproximación alta, recoges alto y aterrizas largo.":"Riesgo: aproximación baja, recoges tarde o tocas antes del umbral."} El <b>PAPI</b> te lo diría: desde tu posición verías ${hi?"más blancas":"más rojas"}.`; }
    u.out.innerHTML=msg.charAt(0).toUpperCase()+msg.slice(1); };
  let last=null;
  btns(el,"data-ill",v=>{ hole.on=v==="b"; const pre={n:[30,0],w:[45,0],s:[18,0],u:[30,2],d:[30,-2],b:[45,0]}[v]; set("W",pre[0]); set("sl",pre[1]); el.querySelector('[data-k="W"]').dispatchEvent(new Event("input",{bubbles:true})); });
  bind(el,o=>{ last=o; setO(el,"W",o.W); setO(el,"sl",(o.sl>0?"+":"")+f1(o.sl)); setO(el,"x",f1(o.x)); draw(o); });
}};

/* ---------- 040 · Tiempo útil de conciencia (TUC) ---------- */
V.tuc={t:"Hipoxia: tiempo útil de conciencia (TUC) según la altitud de cabina",cap:"Valores orientativos de la tabla de estos apuntes (sentado en reposo · con actividad moderada · tras descompresión rápida). El TUC es el tiempo para darte cuenta y actuar, no hasta perder el conocimiento; el EPT es aún más corto. Escala de tiempo logarítmica.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 290" role="img" aria-label="Gráfica del tiempo útil de conciencia frente a la altitud de cabina"></svg>`,
    rng("a","Altitud de cabina",18000,40000,30000,500," ft")+`<button type="button" data-tu="0" aria-pressed="false">Sentado en reposo</button><button type="button" data-tu="1" aria-pressed="true">Con actividad moderada</button><button type="button" data-tu="2" aria-pressed="false">Tras descompresión rápida</button>`,this.cap), svg=u.q("svg");
  const T=[[18000,[2400,1800,1350]],[20000,[600,300,180]],[25000,[300,180,120]],[30000,[90,45,30]],[35000,[45,30,20]],[40000,[25,18,12]]];
  const N=["sentado en reposo","con actividad moderada","tras descompresión rápida"], C=["#58c4f0","#ffc94d","#ff8a80"];
  const tuc=(a,k)=>{ let i=0; while(i<T.length-2&&a>T[i+1][0]) i++; const A=T[i], B=T[i+1], f=cl((a-A[0])/(B[0]-A[0]),0,1); return Math.exp(lerp(Math.log(A[1][k]),Math.log(B[1][k]),f)); };
  const X=a=>48+(a-18000)/22000*330, Y=s=>246-(Math.log10(s)-1)/(Math.log10(3600)-1)*214;
  const fmt=s=>s>=90?(s>=600?f0(s/60)+" min":f1(s/60)+" min"):f0(s)+" s";
  let k=1, last=null;
  const draw=o=>{ const a=o.a, v=tuc(a,k);
    const curves=[0,1,2].map(j=>`<path d="${Array.from({length:45},(_,i)=>{ const aa=18000+i*500; return `${i?"L":"M"}${X(aa).toFixed(1)} ${Y(tuc(aa,j)).toFixed(1)}`; }).join("")}" stroke="${C[j]}" stroke-width="${j===k?3:1.4}" fill="none" opacity="${j===k?1:.55}"/>`).join("");
    const grid=[10,30,60,300,600,1800,3600].map(s=>`<path d="M48 ${Y(s)}H378" stroke="#22364c"/><text x="44" y="${Y(s)+3}" font-size="9" text-anchor="end" fill="#9fb3c8">${s<60?s+" s":s/60+" min"}</text>`).join("")
      +[20000,25000,30000,35000,40000].map(x=>`<path d="M${X(x)} 32V246" stroke="#22364c"/><text x="${X(x)}" y="260" font-size="9" text-anchor="middle" fill="#9fb3c8">${f0(x/1000)}k</text>`).join("");
    svg.innerHTML=`<rect width="400" height="290" fill="#12202f"/>${grid}<text x="213" y="274" font-size="10" text-anchor="middle" fill="#9fb3c8">altitud de cabina (ft)</text>
      ${[0,1,2].map(j=>`<rect x="${60+j*112}" y="8" width="10" height="10" fill="${C[j]}"/><text x="${74+j*112}" y="17" font-size="9" fill="#9fb3c8">${["reposo","actividad","descompresión"][j]}</text>`).join("")}
      ${curves}<path d="M${X(a)} 32V246" stroke="#dfe8f1" stroke-dasharray="3 3"/><circle cx="${X(a)}" cy="${Y(v)}" r="6" fill="${C[k]}" stroke="#12202f" stroke-width="2"/>
      <text x="${cl(X(a),70,330)}" y="${Math.max(44,Y(v)-12)}" font-size="12" font-weight="700" text-anchor="middle" fill="${C[k]}">${fmt(v)}</text>
`;
    u.out.innerHTML=`A <b>${f0(a)} ft</b> de cabina, ${N[k]}: TUC ≈ <b>${fmt(v)}</b>${a>=25000?". Tu primera acción: <b>mascarilla de oxígeno al 100 %</b> y después descenso de emergencia; no hay tiempo para diagnosticar":". Ponte el oxígeno antes de que la euforia te quite el juicio"}. La actividad, el tabaco, el cansancio y una descompresión rápida lo <b>acortan</b>.`; };
  btns(el,"data-tu",v=>{ k=+v; if(last) draw(last); });
  bind(el,o=>{ last=o; setO(el,"a",f0(o.a)); draw(o); });
}};


/* ---------- 090 · Alcance VHF por línea de vista ---------- */
V.vhf={t:"Alcance VHF: línea de vista, curvatura de la Tierra y terreno",cap:"Fórmula de examen: d (NM) = 1,23 × (√H1 + √H2), con H en ft. Ya incluye la refracción normal (radio terrestre efectivo de 4/3). La curvatura del dibujo está muy exagerada en vertical para que se vea. La sierra se sitúa a mitad de camino.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 230" role="img" aria-label="Perfil entre la antena de tierra y el avión con el rayo de línea de vista"></svg>`,
    rng("h1","Altitud del avión (H1)",500,40000,10000,500," ft")+rng("h2","Altura de la antena de tierra (H2)",0,2500,100,25," ft")+rng("d","Distancia a la estación",10,300,120,5," NM")+rng("m","Sierra a mitad de camino",0,12000,0,250," ft"),this.cap), svg=u.q("svg");
  const RE=4587;   // radio efectivo en NM (4/3 del real) → 1,23 √h
  bind(el,o=>{ setO(el,"h1",f0(o.h1)); setO(el,"h2",f0(o.h2)); setO(el,"d",o.d); setO(el,"m",f0(o.m));
    const dmax=1.23*(Math.sqrt(o.h1)+Math.sqrt(o.h2)), D=o.d, bulge=x=>x*(D-x)/(2*RE)*6076, los=x=>lerp(o.h2,o.h1,x/D);
    let minC=1e9, xm=0; for(let i=1;i<100;i++){ const x=D*i/100, ter=Math.max(0,o.m*(1-Math.pow((x-D/2)/(D*.12),2))), c=los(x)-bulge(x)-ter; if(c<minC){ minC=c; xm=x; } }
    const ok=D<=dmax&&minC>=0, curvBlock=D>dmax, terBlock=!curvBlock&&minC<0;
    const top=Math.max(o.h1,o.m+bulge(D/2),2000)*1.12, X=x=>30+x/D*340, Y=h=>196-h/top*170;
    const ground=Array.from({length:61},(_,i)=>{ const x=D*i/60, ter=Math.max(0,o.m*(1-Math.pow((x-D/2)/(D*.12),2))); return `${i?"L":"M"}${X(x).toFixed(1)} ${Y(bulge(x)+ter).toFixed(1)}`; }).join("");
    const curve=Array.from({length:61},(_,i)=>{ const x=D*i/60; return `${i?"L":"M"}${X(x).toFixed(1)} ${Y(bulge(x)).toFixed(1)}`; }).join("");
    // en el dibujo la Tierra "sube" en medio (se representa la curvatura como un abombamiento) y el rayo es recto
    const col=ok?"#6ee7a0":"#ff8a80";
    svg.innerHTML=`<rect width="400" height="230" fill="#12202f"/>
      <path d="${ground}L${X(D)} 210L${X(0)} 210Z" fill="#2b3b2f" stroke="#55705a"/><path d="${curve}" stroke="#58c4f0" stroke-width="1" stroke-dasharray="3 3" fill="none" opacity=".6"/>
      <path d="M${X(0)} ${Y(0)}V${Y(o.h2)}" stroke="#dfe8f1" stroke-width="2.5"/><path d="M${X(0)-6} ${Y(o.h2)}l6 -8l6 8" stroke="#dfe8f1" fill="none"/><text x="${X(0)+4}" y="${Y(o.h2)-10}" font-size="9.5" fill="#9fb3c8">antena ${f0(o.h2)} ft</text>
      <path d="M${X(0)} ${Y(o.h2)}L${X(D)} ${Y(o.h1)}" stroke="${col}" stroke-width="2" ${ok?"":`stroke-dasharray="6 4"`}/>
      ${terBlock?`<circle cx="${X(xm)}" cy="${Y(los(xm))}" r="6" fill="none" stroke="#ff3b30" stroke-width="2"/>`:""}
      <g transform="translate(${X(D)} ${Y(o.h1)})"><path d="M-12 0h18l6 2-6 2h-18zM-10 0l-4-7h4l5 7z" fill="#ffc94d"/></g><text x="${X(D)-4}" y="${Y(o.h1)-10}" font-size="9.5" text-anchor="end" fill="#ffc94d">avión ${f0(o.h1)} ft</text>
      ${dmax<D*1.3?`<path d="M${X(Math.min(dmax,D))} 200v12" stroke="#ffc94d" stroke-width="2"/><text x="${Math.min(X(Math.min(dmax,D)),370)}" y="224" font-size="9.5" text-anchor="${X(Math.min(dmax,D))>330?"end":"middle"}" fill="#ffc94d">alcance ${f0(dmax)} NM</text>`:""}
      <text x="12" y="20" font-size="10" fill="#9fb3c8">√${f0(o.h1)} = ${f1(Math.sqrt(o.h1))} · √${f0(o.h2)} = ${f1(Math.sqrt(o.h2))}</text>`;
    u.out.innerHTML=`d = 1,23 × (√${f0(o.h1)} + √${f0(o.h2)}) = 1,23 × (${f1(Math.sqrt(o.h1))} + ${f1(Math.sqrt(o.h2))}) = <b>${f0(dmax)} NM</b>. `+
      (ok?`A ${o.d} NM <span class="ok">hay línea de vista</span>: comunicas.`:curvBlock?`A ${o.d} NM estás <span class="bad">por debajo del horizonte radio</span>: la curvatura de la Tierra corta la señal. Sube o acércate.`:`Dentro del alcance teórico, pero <span class="bad">la sierra corta el rayo</span>: el terreno manda sobre la fórmula.`)+
      `<br>Para duplicar el alcance hace falta <b>cuadruplicar</b> la altura (o la potencia), porque cuenta la <b>raíz</b>.`; });
}};

/* ---------- 090 · Señales luminosas de la torre ---------- */
V.lgun={t:"Pistola de señales luminosas de la torre: qué te ordenan",cap:"Señales de la torre a aeronaves (Anexo 2 de OACI y SERA, apéndice 1). Acuse de recibo: en vuelo, de día alabeando (salvo en base y final) y de noche con dos destellos de los faros o de las luces de navegación; en tierra, de día moviendo alerones o timón y de noche con dos destellos de los faros.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 200" role="img" aria-label="Torre emitiendo la señal luminosa elegida hacia el avión"></svg>`,
    `<button type="button" data-gw="air" aria-pressed="true">En vuelo</button><button type="button" data-gw="gnd" aria-pressed="false">En tierra</button>`
    +`<button type="button" data-sg="G" aria-pressed="true">Verde fija</button><button type="button" data-sg="g" aria-pressed="false">Destellos verdes</button><button type="button" data-sg="R" aria-pressed="false">Roja fija</button><button type="button" data-sg="r" aria-pressed="false">Destellos rojos</button><button type="button" data-sg="w" aria-pressed="false">Destellos blancos</button><button type="button" data-sg="W" aria-pressed="false">Blanca fija</button><button type="button" data-sg="p" aria-pressed="false">Bengala roja</button>`,this.cap), svg=u.q("svg");
  const M={air:{G:"Autorizado a <b>aterrizar</b>.",g:"<b>Regrese para aterrizar</b>: se le dará la autorización para aterrizar y rodar a su debido tiempo.",R:"<b>Ceda el paso</b> a otras aeronaves y <b>siga en el circuito</b>.",r:"<b>Aeródromo peligroso: no aterrice.</b>",w:"<b>Aterrice en este aeródromo y diríjase a la plataforma</b>; la autorización para aterrizar y rodar se dará a su debido tiempo.",W:"La blanca fija <b>no tiene significado</b> en la tabla de señales de la torre. Trampa típica: solo existen <b>destellos</b> blancos.",p:"<b>A pesar de cualquier instrucción anterior, no aterrice por ahora.</b>"},
           gnd:{G:"Autorizado a <b>despegar</b>.",g:"Autorizado a <b>rodar</b>.",R:"<b>Pare.</b>",r:"<b>Apártese del área de aterrizaje</b> en uso.",w:"<b>Regrese al punto de partida</b> en el aeródromo.",W:"La blanca fija <b>no tiene significado</b> en la tabla de señales de la torre.",p:"La bengala roja es una señal para aeronaves <b>en vuelo</b>: no hay significado en tierra."}};
  const C={G:"#3dff7a",g:"#3dff7a",R:"#ff3b30",r:"#ff3b30",w:"#ffffff",W:"#ffffff",p:"#ff5a3c"};
  let gw="air", sg="G", raf=0;
  const draw=()=>{ const t=performance.now()/1000, flash="grw".includes(sg), on=sg==="p"?true:!flash||(t%1)<.5, c=C[sg];
    const air=gw==="air", ax=air?300:300, ay=air?60:166;
    const beam=on&&!(sg==="p")?`<path d="M96 54L${ax-14} ${ay-10}L${ax-14} ${ay+10}Z" fill="${c}" opacity=".22"/><circle cx="96" cy="54" r="7" fill="${c}"/><circle cx="96" cy="54" r="16" fill="${c}" opacity=".25"/>`:`<circle cx="96" cy="54" r="7" fill="#3a516b"/>`;
    const pyro=sg==="p"?(()=>{ const k=(t%2.2)/2.2, x=96+k*120, y=54-Math.sin(k*Math.PI)*46; return `<path d="M96 54Q${96+60} ${54-92} ${x} ${y}" stroke="#ff9a7a" stroke-width="1.5" stroke-dasharray="2 3" fill="none"/><circle cx="${x}" cy="${y}" r="5" fill="${c}"/><circle cx="${x}" cy="${y}" r="12" fill="${c}" opacity=".3"/>`; })():"";
    svg.innerHTML=`<rect width="400" height="200" fill="#0c1726"/><path d="M0 180H400" stroke="#3a516b" stroke-width="2"/><rect x="0" y="180" width="400" height="20" fill="#16283b"/>
      <path d="M78 180L84 66H108L114 180Z" fill="#3a516b"/><path d="M74 66L70 40H122L118 66Z" fill="#58c4f0" opacity=".35" stroke="#9fb3c8"/><path d="M68 40H124" stroke="#9fb3c8" stroke-width="2"/><text x="96" y="196" font-size="9.5" text-anchor="middle" fill="#9fb3c8">torre</text>
      ${beam}${pyro}
      <g transform="translate(${ax} ${ay})"><path d="M-18 0h28l8 3-8 3h-28zM-16 0l-6-10h6l8 10zM-4 3l-8 10h6l10-10z" fill="#ffc94d"/></g>
      <text x="${ax}" y="${air?30:150}" font-size="10" text-anchor="middle" fill="#9fb3c8">${air?"avión en vuelo":"avión en tierra"}</text>`;
    u.out.innerHTML=`<b style="color:${c==="#ffffff"?"#dfe8f1":c}">${{G:"Verde fija",g:"Destellos verdes",R:"Roja fija",r:"Destellos rojos",w:"Destellos blancos",W:"Blanca fija",p:"Bengala roja"}[sg]}</b> · ${air?"en vuelo":"en tierra"}: ${M[gw][sg]}`;
    cancelAnimationFrame(raf); if(el.isConnected&&("grwp".includes(sg))) raf=requestAnimationFrame(()=>{ const r=svg.getBoundingClientRect(); if(r.bottom>0&&r.top<innerHeight&&!document.hidden) draw(); else setTimeout(draw,400); }); };
  btns(el,"data-gw",v=>{ gw=v; draw(); }); btns(el,"data-sg",v=>{ sg=v; draw(); }); draw();
}};

/* ---------- 081 · Capa límite: transición, desprendimiento, generadores de vórtices y slat ---------- */
V.blayer={t:"Capa límite: laminar, turbulenta y desprendida; qué cambian los generadores de vórtices y el slat",cap:"Modelo cualitativo de un perfil con pérdida desde el borde de salida. La capa laminar roza menos pero aguanta poco el gradiente de presión adverso; la turbulenta tiene más energía cerca de la pared y tarda más en desprenderse. Los generadores de vórtices la energizan; el slat abre una ranura que sopla aire rápido sobre el extradós.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 300" role="img" aria-label="Perfil con la capa límite y gráfica de coeficiente de sustentación frente al ángulo de ataque"></svg>`,
    rng("a","Ángulo de ataque",0,26,6,.5,"°")+`<button type="button" data-vg aria-pressed="false">Generadores de vórtices</button><button type="button" data-sl aria-pressed="false">Slat extendido</button>`,this.cap), svg=u.q("svg");
  let vg=false, sl=false, A=6;
  const yt=x=>.6*(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x*x*x-.1015*x*x*x*x), yc=x=>.04*(x<.4?(2*.4*x-x*x)/.16:((1-2*.4)+2*.4*x-x*x)/.36);
  const C=240, ox=70, oy=120, P=(x,up)=>[ox+x*C, oy-(yc(x)+(up?1:-1)*yt(x))*C];
  const model=()=>{ const as=15+(vg?2.5:0)+(sl?7:0), a0=9+(vg?3:0)+(sl?6:0), clmax=1.45+(vg?.1:0)+(sl?.45:0);
    const xt=cl(.42-.02*A,.04,.42), xs=A<=a0?1:cl(1-(A-a0)/(as-a0)*.62,.15,1), stall=A>as;
    const CL=a=>a<=as?Math.min(clmax,.2+.1*a*(clmax/(.2+.1*as))):Math.max(.55,clmax-(a-as)*.09);
    return {as,a0,clmax,xt,xs:stall?Math.min(xs,.3):xs,stall,CL}; };
  const draw=()=>{ const m=model(), N=60;
    const up=Array.from({length:N+1},(_,i)=>P(i/N,true)), lo=Array.from({length:N+1},(_,i)=>P(i/N,false));
    const foil=`M${up.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")}L${lo.slice().reverse().map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")}Z`;
    // capa límite sobre el extradós: laminar fina, turbulenta más gruesa, desprendida tras xs
    const nrm=x=>{ const a=P(Math.max(0,x-.01),true), b=P(Math.min(1,x+.01),true), dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy); return [dy/l,-dx/l]; };
    const th=x=>x<m.xt?1.5+x*4:3+(x-m.xt)*(18+(vg?-4:0));
    const layer=(x0,x1,col,o)=>{ if(x1<=x0) return ""; const n=24, a=[], b=[]; for(let i=0;i<=n;i++){ const x=lerp(x0,x1,i/n), p=P(x,true), q=nrm(x), t=th(x); a.push(p); b.push([p[0]+q[0]*t,p[1]+q[1]*t]); }
      return `<path d="M${a.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")}L${b.reverse().map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")}Z" fill="${col}" opacity="${o}"/>`; };
    const sep=m.xs<1?(()=>{ const p=P(m.xs,true), e=P(1,true); const r=8+ (1-m.xs)*40; let s=`<path d="M${p[0]} ${p[1]}Q${(p[0]+e[0])/2} ${p[1]-r*1.6} ${e[0]+30} ${e[1]-r*.6}" stroke="#ff8a80" stroke-width="1.6" fill="none"/>`;
      for(let i=0;i<4;i++){ const k=(i+.5)/4, x=lerp(p[0],e[0]+20,k), y=lerp(p[1],e[1],k)-r*.7*Math.sin(Math.PI*k); s+=`<path d="M${(x+5).toFixed(1)} ${y.toFixed(1)}a5 5 0 1 1 -3 -4" stroke="#ff8a80" stroke-width="1.3" fill="none"/>`; } return s; })():"";
    const stream=Array.from({length:4},(_,i)=>{ const y=40+i*16-(i===3?0:0); return `<path d="M10 ${y}H60" stroke="#58c4f0" stroke-width="1" opacity=".5"/>`; }).join("");
    const vgs=vg?[.11,.15,.19].map(x=>{ const p=P(x,true); return `<path d="M${(p[0]-3).toFixed(1)} ${(p[1]-.5).toFixed(1)}l3 -6l3 6" stroke="#ffc94d" stroke-width="1.4" fill="none"/>`; }).join(""):"";
    const slat=sl?(()=>{ const a=P(0,true); return `<path d="M${a[0]-22} ${a[1]+14}Q${a[0]-26} ${a[1]-8} ${a[0]-4} ${a[1]-12}Q${a[0]-14} ${a[1]-2} ${a[0]-14} ${a[1]+12}Z" fill="#9fb3c8"/><path d="M${a[0]-26} ${a[1]+22}Q${a[0]-8} ${a[1]+6} ${a[0]+14} ${a[1]-10}" stroke="#6ee7a0" stroke-width="1.6" fill="none"/>`; })():"";
    const CLx=a=>238+a/26*150, CLy=c=>286-c/2.1*70;
    const curve=Array.from({length:53},(_,i)=>{ const a=i*.5; return `${i?"L":"M"}${CLx(a).toFixed(1)} ${CLy(m.CL(a)).toFixed(1)}`; }).join("");
    svg.innerHTML=`<rect width="400" height="300" fill="#12202f"/>${stream}
      <g transform="rotate(${A} ${ox+.25*C} ${oy})">${slat}<path d="${foil}" fill="#dfe8f1"/>
        ${layer(0,Math.min(m.xt,m.xs),"#58c4f0",.85)}${layer(m.xt,m.xs,"#f6b73c",.8)}${sep}${vgs}
        ${m.xt<m.xs?`<path d="M${P(m.xt,true)[0]} ${P(m.xt,true)[1]-4}v-14" stroke="#f6b73c"/><text x="${P(m.xt,true)[0]}" y="${P(m.xt,true)[1]-21}" font-size="9.5" text-anchor="middle" fill="#f6b73c">transición</text>`:""}
        ${m.xs<1?`<circle cx="${P(m.xs,true)[0]}" cy="${P(m.xs,true)[1]}" r="3.5" fill="#ff3b30"/>`:""}</g>
      <rect x="12" y="12" width="10" height="10" fill="#58c4f0"/><text x="26" y="21" font-size="10" fill="#58c4f0">laminar</text><rect x="78" y="12" width="10" height="10" fill="#f6b73c"/><text x="92" y="21" font-size="10" fill="#f6b73c">turbulenta</text><rect x="160" y="12" width="10" height="10" fill="#ff8a80"/><text x="174" y="21" font-size="10" fill="#ff8a80">desprendida</text>
      <rect x="226" y="208" width="168" height="88" fill="#0f1b29"/><path d="M238 286H392M238 286V212" stroke="#3a516b"/><text x="232" y="220" font-size="9" fill="#9fb3c8">CL</text><text x="390" y="282" font-size="9" text-anchor="end" fill="#9fb3c8">AoA</text>
      <path d="${curve}" stroke="#6ee7a0" stroke-width="2" fill="none"/><circle cx="${CLx(A)}" cy="${CLy(m.CL(A))}" r="4" fill="${m.stall?"#ff3b30":"#ffc94d"}"/>
      <text x="${CLx(m.as)}" y="${CLy(m.clmax)-6}" font-size="9" text-anchor="middle" fill="#6ee7a0">CLmáx ${f1(m.clmax)} a ${f1(m.as)}°</text>`;
    u.out.innerHTML=`AoA <b>${f1(A)}°</b>: transición laminar→turbulenta al <b>${f0(m.xt*100)} %</b> de la cuerda; ${m.xs>=1?"la capa límite sigue <b class=\"ok\">pegada</b> hasta el borde de salida.":m.stall?"<b class=\"bad\">PÉRDIDA</b>: el desprendimiento ha avanzado por casi todo el extradós y el CL cae.":`desprendimiento desde el <b>${f0(m.xs*100)} %</b> de la cuerda (avanza desde el borde de salida al subir el ángulo).`}<br>`
      +`Al subir el ángulo, el punto de transición <b>avanza</b> y el de desprendimiento también. ${vg?"Los <b>generadores de vórtices</b> mezclan aire rápido en la capa límite: retrasan el desprendimiento y suben un poco el ángulo de pérdida, a cambio de algo más de resistencia. ":""}${sl?"El <b>slat</b> abre una ranura que re-energiza la capa límite desde el borde de ataque: el CLmáx y el ángulo de pérdida suben mucho, así que la pérdida llega a un ángulo de ataque mayor (más morro arriba). ":""}${!vg&&!sl?"Prueba con los generadores de vórtices y con el slat.":""}`; };
  btns(el,"data-vg",()=>{ vg=!vg; u.q("[data-vg]").setAttribute("aria-pressed",vg); draw(); }); btns(el,"data-sl",()=>{ sl=!sl; u.q("[data-sl]").setAttribute("aria-pressed",sl); draw(); });
  bind(el,o=>{ A=o.a; setO(el,"a",f1(A)); draw(); });
}};

/* ---------- 081 · Dutch roll frente a inestabilidad espiral ---------- */
V.dynstab={t:"Dutch roll frente a inestabilidad espiral: quién manda, la lateral o la direccional",cap:"Modelo cualitativo tras una ráfaga que alabea el avión 10°. Dutch roll: oscilación acoplada de alabeo y guiñada cuando la estabilidad lateral (diedro, flecha) domina sobre la direccional (deriva). Espiral: cuando domina la direccional, el alabeo crece despacio y el avión se mete en una espiral descendente cada vez más cerrada.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 230" role="img" aria-label="Vista desde atrás del avión y trayectoria vista desde arriba"></svg>`,
    rng("lat","Estabilidad lateral (diedro)",1,10,7,1,"")+rng("dir","Estabilidad direccional (deriva)",1,10,4,1,"")+`<button type="button" data-yd aria-pressed="false">Amortiguador de guiñada</button><button type="button" data-go>▶ Ráfaga</button>`,this.cap), svg=u.q("svg");
  let lat=7, dir=4, yd=false, t0=performance.now(), raf=0, vis=true;
  const RM=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
  const sim=T=>{ const r=lat/dir, dr=cl((r-.9)*1.3,0,1.6), zeta=.18/(1+dr)+(yd?.9:0), w=2.6, sp=.11*(dir-lat)/9;
    let phi=0, psi=0, x=0, y=0; const tr=[]; const dt=1/20;
    for(let t=0;t<=T;t+=dt){ const dutch=10*Math.exp(-zeta*t)*Math.sin(w*t)*(.2+dr), spiral=10*Math.exp(sp*t*1.6)*(sp>0?1:Math.exp(sp*t*2));
      phi=cl(dutch+(sp>0?spiral:spiral*.6),-75,75); const beta=dutch*.6*Math.cos(w*t);
      psi+=Math.tan(phi*R)*9.81/60*dt*3; x+=Math.sin(psi)*dt*6; y-=Math.cos(psi)*dt*6; tr.push([x,y]); }
    return {phi,psi,tr,dr,sp}; };
  const draw=()=>{ raf=0; if(!el.isConnected) return; const T=RM?6:((performance.now()-t0)/1000)%14, s=sim(T), phi=s.phi;
    const tr=s.tr.map((p,i)=>`${i?"L":"M"}${(300+p[0]).toFixed(1)} ${(196+p[1]).toFixed(1)}`).join(""), L=s.tr[s.tr.length-1];
    svg.innerHTML=`<rect width="400" height="230" fill="#12202f"/><text x="100" y="18" font-size="10" text-anchor="middle" fill="#9fb3c8">Vista desde atrás</text><text x="300" y="18" font-size="10" text-anchor="middle" fill="#9fb3c8">Trayectoria vista desde arriba</text>
      <path d="M200 26V222" stroke="#22364c"/>
      <g transform="translate(100 120)"><path d="M-90 0H90" stroke="#58c4f0" stroke-dasharray="4 4" opacity=".5"/>
        <g transform="rotate(${phi.toFixed(1)})"><path d="M-70 ${-2}L-6 2H6L70 -2" stroke="#dfe8f1" stroke-width="4" fill="none" transform="translate(0 0)"/><path d="M-70 -2L-6 4M70 -2L6 4" stroke="#dfe8f1" stroke-width="3" opacity="${lat/12}"/><circle r="9" fill="#dfe8f1"/><path d="M0 -8V-34" stroke="#dfe8f1" stroke-width="3"/><path d="M-20 -6H20" stroke="#dfe8f1" stroke-width="2.5"/></g>
        <text y="72" font-size="12" font-weight="700" text-anchor="middle" fill="${Math.abs(phi)>30?"#ff8a80":"#ffc94d"}">alabeo ${f0(phi)}°</text></g>
      <path d="${tr}" stroke="#ffc94d" stroke-width="2" fill="none"/><circle cx="${(300+L[0]).toFixed(1)}" cy="${(196+L[1]).toFixed(1)}" r="4" fill="#ffc94d"/><circle cx="300" cy="196" r="3" fill="#9fb3c8"/>`;
    const mode=s.dr>.15&&s.sp<=0?"dutch":s.sp>0?"spiral":"ok";
    u.out.innerHTML=(mode==="dutch"?`<b>Dutch roll</b>: la estabilidad <b>lateral (${lat})</b> domina sobre la <b>direccional (${dir})</b>. El avión se balancea y guiña a la vez, con el morro dibujando un «ocho»; es rápido e incómodo. ${yd?"El <b class=\"ok\">amortiguador de guiñada</b> lo apaga en pocos ciclos.":"Remedio: <b>amortiguador de guiñada</b> (yaw damper)."}`
      :mode==="spiral"?`<b class="bad">Inestabilidad espiral</b>: la estabilidad <b>direccional (${dir})</b> domina sobre la <b>lateral (${lat})</b>. La deriva mete el morro en el viraje, el ala exterior va más rápida y sustenta más, y el alabeo crece poco a poco: espiral descendente cada vez más cerrada. Es <b>lenta</b>: el piloto la corrige con alabeo.`
      :`Equilibrio razonable entre estabilidad lateral y direccional: la perturbación se amortigua sola.`)+`<br>Regla: <b>mucho diedro → Dutch roll</b>; <b>mucha deriva → espiral</b>. Los diseñadores aceptan algo de inestabilidad espiral porque es lenta y fácil de corregir.`;
    if(!RM&&vis&&!document.hidden) raf=requestAnimationFrame(draw); };
  if("IntersectionObserver" in window) new IntersectionObserver(es=>{ vis=es.some(e=>e.isIntersecting); if(vis&&!raf) raf=requestAnimationFrame(draw); }).observe(svg);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&vis&&!raf&&el.isConnected) raf=requestAnimationFrame(draw); });
  u.q("[data-go]").addEventListener("click",()=>{ t0=performance.now(); if(!raf) draw(); });
  u.q("[data-yd]").addEventListener("click",e=>{ yd=!yd; e.currentTarget.setAttribute("aria-pressed",yd); t0=performance.now(); if(!raf) draw(); });
  bind(el,o=>{ lat=o.lat; dir=o.dir; setO(el,"lat",lat); setO(el,"dir",dir); t0=performance.now(); if(!raf) draw(); });
}};


/* ---------- Partes del avión en 3D: gira, toca, mueve los mandos ---------- */
V.parts3d=(()=>{
const PT={   // clave: [español, inglés (examen), explicación]
  fuselage:["Fuselaje","Fuselage","Cuerpo principal: aloja tripulación, pasaje y carga, y une alas, empenaje y tren. Casi todos son <b>semi-monocoque</b> (cuadernas + larguerillos + larguerones + piel). <b>Trampa:</b> en el monocoque puro la carga la lleva solo la piel."],
  cockpit:["Cabina y parabrisas","Cockpit · windshield","Puesto de pilotaje. En los presurizados el parabrisas es <b>multicapa y calefactado</b>: el calor sirve de anti-hielo y lo hace más flexible frente al impacto de aves."],
  engine:["Motor y capó","Engine · cowling","El capó canaliza el aire de refrigeración; las <b>cowl flaps</b> regulan la temperatura de culata (abiertas en ascenso, cerradas en descenso)."],
  prop:["Hélice y cono","Propeller · spinner","La pala tiene más ángulo de paso en la <b>raíz</b> que en la <b>punta</b> (torsión) para que el ángulo de ataque sea parecido en toda la pala, porque la punta va mucho más rápida."],
  firewall:["Cortafuegos","Firewall","Mamparo resistente al fuego entre el motor y la cabina. Detrás del cortafuegos empieza la cabina: por eso suele ser el <b>datum</b> de masa y centrado en muchos ligeros."],
  wing:["Ala","Wing","Genera la sustentación y en muchos aviones lleva el combustible. Puede ser <b>cantilever</b> (sin montantes) o arriostrada con montantes (<b>strut-braced</b>, como la C172). El combustible en el ala alivia la flexión en la raíz."],
  le:["Borde de ataque","Leading edge","Lo primero que encuentra el aire y donde más hielo se acumula. Aquí van el <b>slat</b>, el flap Krueger y las botas o el anti-hielo."],
  te:["Borde de salida","Trailing edge","Donde se juntan extradós e intradós. Aquí van el <b>flap</b> (hacia la raíz) y el <b>alerón</b> (hacia la punta)."],
  root:["Raíz del ala","Wing root","Unión ala-fuselaje. Soporta el <b>mayor momento flector</b> y tiene la cuerda más larga. En vuelo el ala flexa hacia arriba y la raíz es la que más trabaja."],
  tip:["Punta del ala","Wingtip","Lleva la luz de navegación (<b>roja a la izquierda, verde a la derecha</b>). Aquí nace el torbellino de punta, origen de la resistencia inducida; los winglets la reducen."],
  aileron:["Alerón","Aileron","Borde de salida, hacia la <b>punta</b>. Mando primario de <b>alabeo</b> (eje longitudinal). Se mueven al revés uno del otro. <b>Guiñada adversa:</b> el alerón que baja da más resistencia y el morro se va al lado contrario del viraje; se corrige con alerón diferencial o Frise y con timón."],
  flap:["Flap","Flap","Borde de salida, hacia la <b>raíz</b>. Aumenta el <b>CL máx</b> y la resistencia, baja la velocidad de pérdida y <b>reduce el α crítico</b>. El Fowler además retrocede y aumenta la superficie."],
  slat:["Slat","Slat","Por delante del borde de ataque: al salir deja una <b>ranura</b> que energiza la capa límite y <b>aumenta el α crítico</b> y el CL máx. No es un flap: el flap de borde de ataque es el <b>Krueger</b>."],
  spoiler:["Spoiler / aerofreno","Spoiler · speed brake","En el <b>extradós</b>, delante del flap. Quita sustentación y mete resistencia. En vuelo: aerofreno simétrico o ayuda al alabeo (sale solo en el <b>ala que baja</b>). En tierra: ground spoilers para cargar el peso en las ruedas y frenar mejor."],
  hstab:["Estabilizador horizontal","Horizontal stabiliser · tailplane","Da la <b>estabilidad longitudinal</b> (cabeceo). Normalmente empuja hacia <b>abajo</b> para equilibrar el morro pesado. Si es todo móvil se llama <b>stabilator</b> (Piper)."],
  elevator:["Timón de profundidad","Elevator","Mando primario de <b>cabeceo</b> (eje lateral). Tirar → elevator <b>arriba</b> → la cola baja → morro arriba."],
  trim:["Compensador","Trim tab","Se mueve al <b>contrario</b> que su superficie y la mantiene deflectada sin fuerza en los mandos. Trim morro arriba → tab <b>abajo</b> → elevator arriba. Quita fuerza, no cambia la estabilidad."],
  fin:["Estabilizador vertical (deriva)","Fin · vertical stabiliser","Da la <b>estabilidad direccional</b> (guiñada): como una veleta, devuelve el morro hacia el viento relativo. Si domina sobre la lateral, aparece la inestabilidad espiral."],
  rudder:["Timón de dirección","Rudder","Mando primario de <b>guiñada</b> (eje vertical). Pedal derecho → rudder a la derecha → morro a la derecha. Coordina los virajes y corrige la guiñada adversa y, en bimotor, la de fallo de motor."],
  nosegear:["Tren de morro","Nose gear","En triciclo, se dirige con los pedales o un tiller (<b>nose-wheel steering</b>). El <b>shimmy damper</b> evita la vibración de la rueda."],
  maingear:["Tren principal","Main gear","Justo <b>detrás del CG</b>: lleva ≈ <b>90 %</b> del peso. Amortiguador oleoneumático: el <b>nitrógeno</b> hace de muelle y el <b>aceite</b> amortigua (o ballesta de acero en muchos ligeros)."],
  spar:["Larguero","Spar","Viga principal de raíz a punta: aguanta la <b>flexión</b> (cargas verticales). Suele haber delantero y trasero; con la piel forman el <b>cajón de torsión</b> (wing box). Trial: «stresses due to vertical loads» → spar."],
  rib:["Costilla","Rib","≈ <b>Perpendicular</b> al larguero. Da la <b>forma del perfil</b> y pasa la carga de la piel al larguero. Trial: «maintain the aerodynamic shape» → ribs."],
  stringer:["Larguerillo","Stringer","<b>Paralelo</b> al larguero (o a lo largo del fuselaje). Rigidiza la piel para que no pandee. Stringer ≠ rib."],
  skin:["Revestimiento","Skin","Da y mantiene la forma aerodinámica y, en el semi-monocoque, también trabaja: lleva cortante y torsión."],
  frame:["Cuaderna","Frame · former","Anillos del <b>fuselaje</b> que le dan la forma. <b>No confundir:</b> cuadernas en el fuselaje, costillas en el ala."],
  longeron:["Larguerón de fuselaje","Longeron","Elemento longitudinal robusto del fuselaje: lleva la mayor parte de la flexión del fuselaje. Más fuerte que un larguerillo."]
};
const STR=["spar","rib","stringer","skin","frame","longeron","firewall"];
const CT={   // mandos: [etiqueta, explicación, deflexiones]
  roll:["Palanca a la derecha","Alerón derecho <b>arriba</b> (menos sustentación) e izquierdo <b>abajo</b> (más) → alabeo a la derecha sobre el eje <b>longitudinal</b>. El spoiler del ala que baja también sube un poco. La guiñada adversa lleva el morro a la izquierda: pedal derecho para coordinar."],
  pitch:["Tirar de la palanca","Elevator <b>arriba</b> → la cola baja → <b>morro arriba</b>, sobre el eje <b>lateral</b>."],
  yaw:["Pedal derecho","Rudder a la <b>derecha</b> → la cola va a la izquierda → <b>morro a la derecha</b>, sobre el eje <b>vertical</b>."],
  trim:["Trim morro arriba","Tab <b>abajo</b> → la fuerza del aire en el tab empuja el elevator <b>arriba</b> y lo deja ahí sin esfuerzo. El compensador siempre va al <b>contrario</b> que su superficie."],
  flaps:["Flaps abajo","Más curvatura (y superficie, si es Fowler): ↑ CL máx, ↑ resistencia, ↓ velocidad de pérdida y ↓ α crítico. Suele aparecer un momento de morro abajo."],
  slats:["Slats fuera","Se abre una ranura en el borde de ataque: ↑ α crítico y ↑ CL máx. La ranura sopla aire rápido sobre el extradós."],
  spoil:["Aerofrenos","Los dos spoilers arriba a la vez: menos sustentación y más resistencia para descender o frenar sin acelerar."]
};
const GR={
  wing:{t:"3D · El ala: gírala, toca cada parte y mueve alerones, flaps, slats y spoilers",n:"el ala",p:["wing","le","te","root","tip","aileron","flap","slat","spoiler"],s:["spar","rib","stringer","skin"],c:["roll","flaps","slats","spoil"],v:[-28,34]},
  tail:{t:"3D · Empenaje: estabilizadores, timones y compensador",n:"el empenaje",p:["hstab","elevator","trim","fin","rudder"],s:["spar","rib","skin"],c:["pitch","yaw","trim"],v:[-140,18]},
  controls:{t:"3D · Mandos de vuelo: mueve cada superficie y mira qué hace",n:"los mandos de vuelo",p:["aileron","elevator","rudder","trim","flap","slat","spoiler"],s:["spar","rib"],c:["roll","pitch","yaw","trim","flaps","slats","spoil"],v:[-40,26]},
  gear:{t:"3D · Tren de aterrizaje triciclo",n:"el tren",p:["nosegear","maingear","fuselage","wing"],s:["frame","spar"],c:[],v:[-38,-9],z:1.45},
  fuselage:{t:"3D · Fuselaje, cabina, motor y estructura",n:"el fuselaje",p:["fuselage","cockpit","engine","prop","firewall"],s:["frame","longeron","stringer","skin","firewall"],c:[],v:[-52,14]}
};
GR.all={n:"el avión",p:["fuselage","cockpit","engine","prop","wing","le","te","root","tip","aileron","flap","slat","spoiler","hstab","elevator","trim","fin","rudder","nosegear","maingear"],s:["spar","rib","stringer","skin","frame","longeron","firewall"],c:["roll","pitch","yaw","trim","flaps","slats","spoil"],v:[-35,24]};
const QZ=[["la viga que aguanta la flexión (cargas verticales)","spar"],["la pieza perpendicular al larguero que da la forma del perfil","rib"],["la pieza paralela al larguero que rigidiza la piel","stringer"],["el dispositivo que aumenta el α crítico","slat"],
  ["la superficie que sale solo en el ala que baja y le quita sustentación","spoiler"],["la superficie que sube el CL máx pero reduce el α crítico","flap"],["el mando primario de alabeo","aileron"],["el mando primario de cabeceo","elevator"],["el mando primario de guiñada","rudder"],
  ["la superficie que se mueve al contrario que su mando","trim"],["lo que da la estabilidad direccional","fin"],["lo que da la estabilidad longitudinal","hstab"],["donde se acumula más hielo","le"],["la zona con el mayor momento flector","root"],["donde está la luz verde","tip"],
  ["el tren que lleva ≈ 90 % del peso","maingear"],["el tren con shimmy damper","nosegear"],["los anillos que dan forma al fuselaje","frame"],["el mamparo entre motor y cabina","firewall"],["el borde donde van flap y alerón","te"]];
/* geometría (m): x adelante (morro +), y arriba, z hacia la punta derecha */
const vs=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], va=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vm=(a,k)=>[a[0]*k,a[1]*k,a[2]*k], vx=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], vd=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], vn=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }, vl=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const rotA=(p,a,b,ang)=>{ if(!ang) return p; const k=vn(vs(b,a)), v=vs(p,a), c=Math.cos(ang*R), s=Math.sin(ang*R); return va(a,va(va(vm(v,c),vm(vx(k,v),s)),vm(k,vd(k,v)*(1-c)))); };
const naca=f=>5*(.2969*Math.sqrt(f)-.126*f-.3516*f*f+.2843*f*f*f-.1036*f*f*f*f);
const COL={fuselage:[232,236,241],cockpit:[54,84,116],engine:[214,220,228],prop:[70,74,82],spin:[196,52,46],firewall:[176,118,64],wing:[222,227,233],le:[222,227,233],te:[222,227,233],root:[222,227,233],tip:[222,227,233],tipR:[200,40,36],tipG:[40,170,90],
  aileron:[176,194,216],flap:[176,194,216],slat:[176,194,216],spoiler:[160,180,206],hstab:[222,227,233],elevator:[176,194,216],trim:[150,170,198],fin:[222,227,233],rudder:[176,194,216],stripe:[30,90,170],
  nosegear:[120,128,140],maingear:[120,128,140],tyre:[38,42,48],spar:[232,150,60],rib:[120,190,240],stringer:[160,220,170],skin:[200,215,230],frame:[120,190,240],longeron:[232,150,60]};
function build(D,str){   // D: deflexiones (grados)
  const F=[];   // caras: {p,k(part),c(color),a,l(línea)}
  const face=(p,k,c,a)=>F.push({p,k,c:c||COL[k],a:a==null?1:a}), line=(p,k,w,cl)=>F.push({p,k,c:COL[k],a:1,l:w||2,cl});
  /* fuselaje: secciones (x, semiancho, alto arriba, alto abajo) */
  const ST=[[3.6,.40,.36,.40],[3.05,.50,.46,.48],[2.2,.57,.55,.52],[1.45,.60,.86,.55],[.45,.60,.90,.55],[-.6,.56,.82,.50],[-1.8,.45,.62,.40],[-3.0,.32,.46,.28],[-3.95,.2,.34,.16],[-4.6,.11,.27,.08]], NR=16;
  const ring=i=>{ const s=ST[i], o=[]; for(let k=0;k<NR;k++){ const t=2*Math.PI*k/NR, sn=Math.sin(t), cs=Math.cos(t); o.push([s[0],(cs>=0?s[2]:s[3])*Math.sign(cs)*Math.pow(Math.abs(cs),.8),s[1]*Math.sign(sn)*Math.pow(Math.abs(sn),.8)]); } return o; };
  const RG=ST.map((s,i)=>ring(i));
  for(let i=0;i<ST.length-1;i++) for(let k=0;k<NR;k++){ const a=RG[i][k], b=RG[i][(k+1)%NR], c=RG[i+1][(k+1)%NR], d=RG[i+1][k], x0=ST[i][0], x1=ST[i+1][0], cm=Math.cos(2*Math.PI*(k+.5)/NR);
    let p="fuselage"; if(x1>=2.2) p="engine"; else if(x0<=2.2&&x1>=1.45&&cm>.2) p="cockpit"; else if(x0<=1.45&&x1>=-.6&&cm>.25&&cm<.8) p="cockpit";
    const stripe=p==="fuselage"&&Math.abs(cm+.05)<.2&&x1<2.2;
    face([a,b,c,d],str&&p!=="engine"&&p!=="cockpit"?"skin":p,stripe?COL.stripe:null,str&&p!=="engine"?.16:1); }
  face(RG[0].slice().reverse(),"engine"); face(RG[ST.length-1],str?"skin":"fuselage",null,str?.16:1);
  if(str){ face(RG[2],"firewall",null,.9);
    for(let i=1;i<ST.length-1;i++) if(i!==2) line(RG[i],"frame",2.2,1);
    for(const k of [2,6,10,14]) line(RG.map(r=>r[k]),"longeron",3); for(const k of [0,4,8,12]) line(RG.slice(2).map(r=>r[k]),"stringer",1.6); }
  /* hélice */
  { const tip=[4.02,0,0], base=[3.6,0,0], n=10; for(let k=0;k<n;k++){ const t0=2*Math.PI*k/n, t1=2*Math.PI*(k+1)/n; face([tip,[3.6,.24*Math.cos(t0),.24*Math.sin(t0)],[3.6,.24*Math.cos(t1),.24*Math.sin(t1)]],"prop",COL.spin); }
    for(const ph of [D.ph,D.ph+180]){ const c=Math.cos(ph*R), s=Math.sin(ph*R), r0=.2, r1=1.0, w0=.13, w1=.07; const P=(r,w,sg)=>[3.72+sg*w*.35,r*c-sg*w*s*.94,r*s+sg*w*c*.94];
      face([P(r0,w0,1),P(r1,w1,1),P(r1,w1,-1),P(r0,w0,-1)],"prop"); } }
  /* superficie sustentadora genérica */
  const surf=(o)=>{ const N=o.v?[0,0,1]:[0,1,0];
    const P=(s,f,sd)=>{ const le=vl(o.R,o.T,s), c=lerp(o.c0,o.c1,s); return va(va(le,[-c*f,0,0]),vm(N,sd*o.th*c*naca(f)*(sd?1:0)+(o.cm||0)*c*4*f*(1-f))); };
    const mv=o.mv||{}, own=(fm,sm,top)=>o.part(fm,sm,top);
    const tf=(p,pt,s)=>{ const M=mv[pt]; return M?M(p,s):p; };
    for(let j=0;j<o.S.length-1;j++) for(let i=0;i<o.F.length-1;i++){ const f0=o.F[i], f1=o.F[i+1], s0=o.S[j], s1=o.S[j+1], fm=(f0+f1)/2, sm=(s0+s1)/2;
      for(const sd of [1,-1]){ const pt=own(fm,sm,sd>0); const q=[P(s0,f0,sd),P(s0,f1,sd),P(s1,f1,sd),P(s1,f0,sd)].map(p=>tf(p,pt,sm));
        face(q,str?"skin":pt,o.col&&o.col(pt,sm,sd),str?.16:1); } }
    // tapas de punta y de superficies móviles
    const cap=(s,fa,fb,pt)=>{ const fs=o.F.filter(f=>f>=fa-1e-6&&f<=fb+1e-6), top=fs.map(f=>P(s,f,1)), bot=fs.slice().reverse().map(f=>P(s,f,-1)); const q=top.concat(bot).map(p=>tf(p,pt,s)); face(q,str?"skin":pt,null,str?.16:1); };
    cap(1,0,1,o.tipPart||o.base); for(const c of o.caps||[]) for(const s of [c[2],c[3]]) cap(s,c[0],c[1],c[4]);
    if(o.le) line(o.S.map(s=>P(s,0,0)),"le",4); if(o.te) line(o.S.map(s=>tf(P(s,1,0),own(.99,s===1?.999:s+1e-3,true),s)),"te",4);
    if(str){ for(const f of o.spars||[]) for(let j=0;j<o.S.length-1;j++){ const s0=o.S[j], s1=o.S[j+1]; if(s1>.95) continue; face([P(s0,f,1),P(s1,f,1),P(s1,f,-1),P(s0,f,-1)],"spar",null,.95); }
      for(const s of o.ribs||[]){ const fs=o.F.filter(f=>f<=.74); face(fs.map(f=>P(s,f,1)).concat(fs.slice().reverse().map(f=>P(s,f,-1))),"rib",null,.85); }
      for(const f of o.strg||[]){ line(o.S.filter(s=>s<=.95).map(s=>P(s,f,1)),"stringer",1.8); line(o.S.filter(s=>s<=.95).map(s=>P(s,f,-1)),"stringer",1.8); } }
    return P; };
  /* alas */
  for(const sg of [1,-1]){ const R0=[1.15,-.32,.5*sg], T0=[.78,.12,5.6*sg], c0=1.75, c1=1.05, side=sg>0?"R":"L";
    const pf=(fm,sm,top)=>fm>.74&&sm>.06&&sm<.57?"flap":fm>.74&&sm>.60&&sm<.94?"aileron":fm<.12&&sm>.40&&sm<.94?"slat":top&&fm>.55&&fm<.70&&sm>.30&&sm<.57?"spoiler":sm>.94?"tip":sm<.06?"root":"wing";
    const Pm=(s,f)=>{ const le=vl(R0,T0,s), c=lerp(c0,c1,s); return va(le,[-c*f,.02*c*4*f*(1-f),0]); };
    const hinge=(f,s0,s1)=>{ let a=Pm(s0,f), b=Pm(s1,f); if(b[2]<a[2]){ const t=a; a=b; b=t; } return [a,b]; };
    const hA=hinge(.74,.60,.94), hF=hinge(.74,.06,.57), hS=hinge(.55,.30,.57), hL=hinge(.12,.40,.94);
    const ail=sg>0?-D.ail:D.ail, spl=Math.max(D.spl,sg>0?D.sroll:0), fl=D.flap, sl=D.slat;
    const mv={aileron:p=>rotA(p,hA[0],hA[1],ail),
      flap:(p,s)=>{ const c=lerp(c0,c1,s); return va(rotA(p,hF[0],hF[1],fl),[-.16*c*fl/35,-.03*c*fl/35,0]); },
      spoiler:p=>rotA(p,hS[0],hS[1],-spl),
      slat:(p,s)=>{ const c=lerp(c0,c1,s), k=sl/20; return va(rotA(p,hL[0],hL[1],-14*k),[.11*c*k,-.05*c*k,0]); }};
    surf({R:R0,T:T0,c0,c1,th:.13,cm:.02,F:[0,.03,.12,.25,.40,.55,.70,.74,.87,1],S:[0,.06,.18,.30,.40,.57,.60,.77,.94,1],part:pf,mv,base:"wing",tipPart:"tip",le:1,te:1,
      caps:[[.74,1,.06,.57,"flap"],[.74,1,.60,.94,"aileron"],[0,.12,.40,.94,"slat"]],
      col:(pt,sm,sd)=>pt==="tip"&&sm>.97?(sg>0?COL.tipG:COL.tipR):null,
      spars:[.25,.70],ribs:[.06,.18,.30,.40,.57,.77,.94],strg:[.42,.6]}); }
  /* estabilizador horizontal, timón de profundidad y compensador */
  for(const sg of [1,-1]){ const R0=[-3.55,.2,.1*sg], T0=[-3.98,.24,1.9*sg], c0=1.0, c1=.62;
    const Pm=(s,f)=>va(vl(R0,T0,s),[-lerp(c0,c1,s)*f,0,0]); const hg=(f,s0,s1)=>{ let a=Pm(s0,f), b=Pm(s1,f); if(b[2]<a[2]){ const t=a; a=b; b=t; } return [a,b]; };
    const hE=hg(.62,0,1), hT=hg(.86,.2,.6);
    const pf=(fm,sm)=>fm>.86&&sg>0&&sm>.2&&sm<.6?"trim":fm>.62?"elevator":"hstab";
    const mv={elevator:p=>rotA(p,hE[0],hE[1],D.elev),trim:p=>rotA(rotA(p,hT[0],hT[1],D.tab),hE[0],hE[1],D.elev)};
    surf({R:R0,T:T0,c0,c1,th:.09,F:[0,.05,.15,.3,.45,.62,.74,.86,1],S:[0,.2,.4,.6,.8,1],part:pf,mv,base:"hstab",tipPart:"hstab",caps:sg>0?[[.86,1,.2,.6,"trim"]]:[],spars:[.3],ribs:[.2,.6]}); }
  /* deriva y timón de dirección */
  { const R0=[-3.25,.38,0], T0=[-4.12,1.78,0], c0=1.35, c1=.72, Pm=(s,f)=>va(vl(R0,T0,s),[-lerp(c0,c1,s)*f,0,0]), a=Pm(0,.62), b=Pm(1,.62);
    surf({v:1,R:R0,T:T0,c0,c1,th:.09,F:[0,.05,.15,.3,.45,.62,.74,.86,1],S:[0,.25,.5,.75,1],part:fm=>fm>.62?"rudder":"fin",mv:{rudder:p=>rotA(p,a,b,D.rud)},base:"fin",tipPart:"fin",spars:[.3],ribs:[.25,.5,.75]}); }
  /* tren triciclo */
  const wheel=(c,r,w,k)=>{ const n=12, A=[], B=[]; for(let i=0;i<n;i++){ const t=2*Math.PI*i/n; A.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t),c[2]-w/2]); B.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t),c[2]+w/2]); }
    for(let i=0;i<n;i++) face([A[i],A[(i+1)%n],B[(i+1)%n],B[i]],k,COL.tyre); face(A,k,[150,156,166]); face(B.slice().reverse(),k,[150,156,166]); };
  const leg=(a,b,k,w)=>{ face([va(a,[w,0,0]),va(b,[w,0,0]),va(b,[-w,0,0]),va(a,[-w,0,0])],k); face([va(a,[0,0,w]),va(b,[0,0,w]),va(b,[0,0,-w]),va(a,[0,0,-w])],k); };
  leg([2.55,-.45,0],[2.55,-1.05,0],"nosegear",.05); wheel([2.55,-1.08,0],.2,.12,"nosegear"); face([[2.75,-.88,-.1],[2.35,-.88,-.1],[2.35,-.88,.1],[2.75,-.88,.1]],"nosegear");
  for(const sg of [1,-1]){ leg([-.1,-.45,.45*sg],[-.2,-1.02,1.3*sg],"maingear",.06); wheel([-.2,-1.04,1.36*sg],.26,.16,"maingear"); }
  return F;
}
return {t:"3D · Partes del avión: gíralo, toca cada pieza y mueve los mandos",
cap:"Avión genérico de ala baja con tren triciclo. Para que lo veas todo en un modelo, lleva también slats y spoilers, que en un monomotor ligero real no existen: son de los aviones de transporte. Arrastra para girar (en el móvil, en horizontal). Toca una pieza o elígela en los botones.",
init(el){
  const G=GR[el.dataset.part]||GR.all, gk=el.dataset.part||"all";
  const chip=k=>`<button type="button" data-p="${k}" aria-pressed="false">${PT[k][0]}</button>`;
  const ctl=`<div class="p3r"><span class="p3l">Modo</span><button type="button" data-m="ext" aria-pressed="true">Exterior</button><button type="button" data-m="str" aria-pressed="false">Estructura</button>${G.c.length?`<button type="button" data-m="ctl" aria-pressed="false">Mandos</button>`:""}<button type="button" data-m="quiz" aria-pressed="false">Ponme a prueba</button></div>
  <div class="p3r"><span class="p3l">Vista</span><button type="button" data-v="34">3/4</button><button type="button" data-v="top">Planta</button><button type="button" data-v="side">Lado</button><button type="button" data-v="front">Frente</button><button type="button" data-v="rear">Atrás</button><label class="p3c"><input type="checkbox" data-lab checked> Nombres</label></div>
  <div class="p3r" data-pe>${G.p.map(chip).join("")}</div><div class="p3r" data-ps hidden>${G.s.map(chip).join("")}</div>
  <div class="p3r" data-pc hidden>${G.c.map(k=>`<button type="button" data-c="${k}" aria-pressed="false">${CT[k][0]}</button>`).join("")}<button type="button" data-c="0">Neutro</button></div>
  <div class="p3r"><select data-all aria-label="Otra pieza"><option value="">Otra pieza del avión…</option>${Object.keys(PT).map(k=>`<option value="${k}">${PT[k][0]} · ${PT[k][1]}</option>`).join("")}</select></div>`;
  const u=shell(el,G.t||this.t,`<canvas class="p3cv" aria-label="Avión en 3D: arrastra para girarlo y toca una pieza"></canvas>`,ctl,this.cap), c=u.q("canvas"), ctx=c.getContext("2d");
  if(!document.getElementById("p3css")){ const s=document.createElement("style"); s.id="p3css"; s.textContent=`.f0viz .p3r{flex:1 1 100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}.f0viz .p3r[hidden]{display:none}.f0viz .p3l{font:700 11px/1 "Barlow Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8fa3b8;min-width:4.2em}.f0viz .p3c{flex:0 1 auto!important;display:flex!important;gap:6px;align-items:center;font-weight:600}.f0viz .p3r select{font:600 13px system-ui,sans-serif;min-height:38px;padding:6px 10px;border-radius:6px;border:1px solid #3a516b;background:#1a2b3f;color:#e9f0f7;max-width:100%}.f0viz .p3cv{cursor:grab;touch-action:pan-y}.f0viz .p3cv:active{cursor:grabbing}.f0viz .ctl .p3r button{min-height:36px;padding:7px 11px}`; document.head.appendChild(s); }
  const VW={"34":G.v,top:[0,89],side:[0,4],front:[90,8],rear:[-90,12]};
  let yaw=G.v[0], pit=G.v[1], tY=yaw, tP=pit, mode="ext", sel=null, quiz=null, score=[0,0], labs=true, raf=0, drawn=[], lastT=0, vis=true;
  const D={ail:0,elev:0,rud:0,tab:0,flap:0,slat:0,spl:0,sroll:0,ph:20}, DT={...D}, on=new Set();
  const setCtl=()=>{ DT.ail=on.has("roll")?22:0; DT.sroll=on.has("roll")?18:0; DT.elev=(on.has("pitch")?-18:0)+(on.has("trim")?-9:0); DT.tab=on.has("trim")?16:0; DT.rud=on.has("yaw")?22:0; DT.flap=on.has("flaps")?35:0; DT.slat=on.has("slats")?20:0; DT.spl=on.has("spoil")?40:0;
    u.qa("[data-c]").forEach(b=>b.setAttribute("aria-pressed",on.has(b.dataset.c)?"true":"false")); };
  const say=h=>{ u.out.innerHTML=h; };
  const info=k=>`<b>${PT[k][0]}</b> · <i>${PT[k][1]}</i> — ${PT[k][2]}`;
  const parts=()=>mode==="str"?G.s:G.p;
  const pick=k=>{ sel=k; u.qa("[data-p]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===k?"true":"false")); const s=u.q("[data-all]"); if(s) s.value=PT[k]&&!u.q(`[data-p="${k}"]`)?k:"";
    if(k&&STR.includes(k)&&mode!=="str"&&mode!=="quiz") setMode("str",1); if(k&&!STR.includes(k)&&mode==="str") setMode("ext",1);
    if(k) say(info(k)); kick(); };
  const ask=()=>{ const pool=QZ.filter(q=>(G.p.includes(q[1])||G.s.includes(q[1]))&&(!quiz||q[1]!==quiz[1])); quiz=pool[Math.floor(Math.random()*pool.length)]||QZ[0]; sel=null; say(`Toca <b>${quiz[0]}</b> <span style="color:#8fa3b8">· aciertos ${score[0]}/${score[1]}</span>`); kick(); };
  function setMode(m,keep){ mode=m; u.qa("[data-m]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===m?"true":"false"));
    u.q("[data-pe]").hidden=m==="str"||m==="ctl"; u.q("[data-ps]").hidden=m!=="str"; const pc=u.q("[data-pc]"); if(pc) pc.hidden=m!=="ctl";
    if(m!=="ctl"&&on.size){ on.clear(); setCtl(); }
    if(m==="quiz"){ score=[0,0]; quiz=null; ask(); return; }
    quiz=null; if(!keep){ sel=null; u.qa("[data-p]").forEach(b=>b.setAttribute("aria-pressed","false"));
      say(m==="str"?`Piel casi transparente para ver por dentro. Toca: ${G.s.filter(x=>x!=="skin").map(x=>"<b>"+PT[x][0].toLowerCase()+"</b>").join(", ")} o la piel.`:m==="ctl"?"Pulsa un mando y mira qué superficie se mueve y hacia dónde. Puedes combinar varios.":`Toca cualquier pieza (aquí, ${G.n}) o elígela en los botones. Arrastra para girar.`); }
    kick(); }
  /* proyección y dibujo */
  let W=0,H=0,dp=1;
  const size=()=>{ dp=Math.min(2,window.devicePixelRatio||1); const cw=c.clientWidth||320, ch=Math.round(cl(cw*.5,260,420)); if(c.width!==Math.round(cw*dp)||c.height!==Math.round(ch*dp)){ c.width=Math.round(cw*dp); c.height=Math.round(ch*dp); c.style.height=ch+"px"; } W=c.width; H=c.height; };
  const proj=(p,cy,sy,cp,sp,k,ox,oy)=>{ const x1=p[0]*cy+p[2]*sy, z1=-p[0]*sy+p[2]*cy, y2=(p[1]-.1)*cp-z1*sp, z2=(p[1]-.1)*sp+z1*cp, f=24/(24-z2); return [ox+x1*k*f,oy-y2*k*f,z2,x1,y2]; };
  const L=vn([-.35,.62,.7]);
  function draw(now){ raf=0; size(); const dt=Math.min(.05,((now||0)-lastT)/1000||.016); lastT=now||0; let moving=false;
    const ez=(a,b,r)=>{ const d=b-a; if(Math.abs(d)>.05){ moving=true; return a+d*Math.min(1,dt*r); } return b; };
    let dy=((tY-yaw+540)%360)-180; yaw=Math.abs(dy)>.1?(moving=true,yaw+dy*Math.min(1,dt*5)):tY; pit=ez(pit,tP,5);
    for(const k of ["ail","elev","rud","tab","flap","slat","spl","sroll"]) D[k]=ez(D[k],DT[k],4.5);
    if(sel==="prop"||sel==="engine"){ D.ph=(D.ph+dt*240)%360; moving=true; }
    const F=build(D,mode==="str"||(mode==="quiz"&&quiz&&STR.includes(quiz[1]))), cy=Math.cos(yaw*R), sy=Math.sin(yaw*R), cp=Math.cos(pit*R), sp=Math.sin(pit*R), k=Math.min((W-(labs&&mode!=="quiz"&&W/dp>=560?240*dp:16*dp))/12.2,H/(5.4+2.6*Math.abs(Math.sin(pit*R))+1.4*Math.abs(Math.sin(yaw*R))))*(G.z||1), ox=W*.5, oy=H*(.5+.06*Math.sin(pit*R));
    for(const f of F){ f.q=f.p.map(p=>proj(p,cy,sy,cp,sp,k,ox,oy)); let z=0; for(const q of f.q) z+=q[2]; f.z=z/f.q.length+(f.l?.05:0)+(f.k==="skin"?-.02:0); }
    F.sort((a,b)=>a.z-b.z);
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#1b3048"); g.addColorStop(.62,"#12202f"); g.addColorStop(1,"#0c1622"); ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    { const gy=[0,-1.32,0]; ctx.strokeStyle="rgba(140,170,200,.10)"; ctx.lineWidth=dp; for(let i=-8;i<=8;i++){ for(const sw of [0,1]){ const a=proj(sw?[i,gy[1],-8]:[-8,gy[1],i],cy,sy,cp,sp,k,ox,oy), b=proj(sw?[i,gy[1],8]:[8,gy[1],i],cy,sy,cp,sp,k,ox,oy); if(pit>-2){ ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); } } } }
    const act=new Set(); if(mode==="ctl"){ const M={roll:["aileron","spoiler"],pitch:["elevator"],yaw:["rudder"],trim:["trim","elevator"],flaps:["flap"],slats:["slat"],spoil:["spoiler"]}; on.forEach(x=>M[x].forEach(p=>act.add(p))); } if(sel) act.add(sel);
    const hi=act.size?act:null, dim=mode!=="ctl"&&!!sel, AC=[255,201,77]; drawn=[];
    for(const f of F){ const q=f.q, isS=!!hi&&hi.has(f.k); let c3=f.c;
      if(f.l){ ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); for(let i=1;i<q.length;i++) ctx.lineTo(q[i][0],q[i][1]); if(f.cl) ctx.closePath();
        const col=isS?AC:dim?mixC(c3,[60,76,94],.55):c3; ctx.strokeStyle=`rgb(${col.map(Math.round)})`; ctx.lineWidth=(isS?f.l+2:f.l)*dp; ctx.lineJoin="round"; ctx.globalAlpha=f.k==="le"||f.k==="te"?(isS?1:mode==="str"?0:.0):1; if(ctx.globalAlpha>0) ctx.stroke(); ctx.globalAlpha=1; drawn.push(f); continue; }
      const n=vn(vx(vs([q[1][3],q[1][4],q[1][2]],[q[0][3],q[0][4],q[0][2]]),vs([q[2][3],q[2][4],q[2][2]],[q[0][3],q[0][4],q[0][2]]))), sh=.42+.58*Math.abs(vd(n,L));
      if(isS) c3=AC; else if(dim) c3=mixC(c3,[64,80,98],.5);
      const glass=f.k==="cockpit"&&!isS, spec=glass?Math.pow(Math.abs(vd(n,vn([L[0]*.4,L[1],L[2]+.6]))),12)*120:0;
      const col=c3.map(v=>cl(v*sh+spec,0,255)|0); ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); for(let i=1;i<q.length;i++) ctx.lineTo(q[i][0],q[i][1]); ctx.closePath();
      ctx.globalAlpha=isS&&f.a<.5?.55:f.a; ctx.fillStyle=`rgb(${col})`; ctx.fill(); ctx.strokeStyle=f.a<.5?`rgba(190,210,230,${isS?.9:.28})`:`rgb(${col.map(v=>v*.86|0)})`; ctx.lineWidth=(f.a<.5?.8:.7)*dp; ctx.stroke(); ctx.globalAlpha=1; drawn.push(f); }
    // contorno del seleccionado por encima de todo, para que se vea aunque quede detrás
    if(hi){ ctx.save(); ctx.strokeStyle="rgba(255,201,77,.85)"; ctx.lineWidth=1.6*dp; ctx.setLineDash([4*dp,3*dp]); for(const f of F) if(hi.has(f.k)&&!f.l){ const q=f.q; ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); for(let i=1;i<q.length;i++) ctx.lineTo(q[i][0],q[i][1]); ctx.closePath(); ctx.stroke(); } ctx.restore(); }
    // nombres con líneas guía en dos columnas
    if(labs&&mode!=="quiz"){ const ks=(mode==="str"?G.s.filter(x=>x!=="skin"):mode==="ctl"?["aileron","elevator","rudder","trim","flap","slat","spoiler"].filter(x=>G.p.includes(x)||gk==="controls"||gk==="all"):G.p);
      const narrow=W/dp<560, ks2=narrow?(sel&&ks.includes(sel)?[sel]:sel?[sel]:[]):ks; const C=[]; for(const kk of ks2){ const fk=F.filter(f=>f.k===kk); if(!fk.length) continue; let z0=1e9, z1=-1e9; for(const f of fk){ z0=Math.min(z0,f.z); z1=Math.max(z1,f.z); }
        let ax=0, ay=0, wt=0; for(const f of fk){ if(f.z<z1-.35*(z1-z0)-1e-6) continue; let cx2=0, cy2=0; for(const q of f.q){ cx2+=q[0]; cy2+=q[1]; } cx2/=f.q.length; cy2/=f.q.length; let A=1; if(!f.l&&f.q.length>2){ A=0; for(let a=0,b=f.q.length-1;a<f.q.length;b=a++) A+=f.q[b][0]*f.q[a][1]-f.q[a][0]*f.q[b][1]; A=Math.abs(A)/2+1; } else if(f.l) A=50*dp; ax+=cx2*A; ay+=cy2*A; wt+=A; }
        C.push({k:kk,ax:ax/wt,ay:ay/wt}); }
      const fs=Math.round(cl(W/dp/48,10.5,13))*dp; ctx.font=`600 ${fs}px system-ui,-apple-system,"Segoe UI",sans-serif`; const gap=fs*1.55;
      for(const side of [0,1]){ const S=C.filter(o=>side?o.ax>=W/2:o.ax<W/2).sort((a,b)=>a.ay-b.ay); let y=fs*1.2; for(const o of S){ o.ly=Math.max(y,Math.min(o.ay,H-fs*.8)); y=o.ly+gap; }
        let over=y-gap-(H-fs*.8); if(over>0) for(let i=S.length-1;i>=0;i--){ S[i].ly-=over; over=Math.max(0,(i>0?S[i-1].ly+gap-S[i].ly:0)); }
        for(const o of S){ const t=PT[o.k][0], tw=ctx.measureText(t).width, lx=side?W-8*dp-tw:8*dp, ex=side?lx-5*dp:lx+tw+5*dp, isS=!!hi&&hi.has(o.k);
          ctx.strokeStyle=isS?"rgba(255,201,77,.95)":"rgba(220,232,244,.45)"; ctx.lineWidth=dp*(isS?1.5:1); ctx.beginPath(); ctx.moveTo(ex,o.ly-fs*.32); ctx.lineTo(o.ax,o.ay); ctx.stroke(); ctx.fillStyle=isS?"#ffc94d":"rgba(220,232,244,.55)"; ctx.beginPath(); ctx.arc(o.ax,o.ay,2.2*dp,0,7); ctx.fill();
          ctx.fillStyle="rgba(12,22,34,.72)"; ctx.fillRect(lx-3*dp,o.ly-fs*.95,tw+6*dp,fs*1.3); ctx.fillStyle=isS?"#ffc94d":"#e3ecf5"; ctx.fillText(t,lx,o.ly); } } }
    // ejes de referencia en modo mandos
    if(mode==="ctl"){ ctx.font=`600 ${11*dp}px system-ui,sans-serif`; ctx.fillStyle="rgba(200,215,230,.7)"; ctx.fillText("Arrastra para verlo desde otro ángulo",8*dp,H-8*dp); }
    if(moving&&vis) raf=requestAnimationFrame(draw); }
  const mixC=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
  const kick=()=>{ if(!raf&&el.isConnected) raf=requestAnimationFrame(draw); };
  /* selección por toque */
  const hit=(x,y)=>{ const P=[], segD=(px,py,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], l=dx*dx+dy*dy||1, t=cl(((px-a[0])*dx+(py-a[1])*dy)/l,0,1); return Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy); };
    for(let i=drawn.length-1;i>=0;i--){ const f=drawn[i]; if(f.l){ if(f.k==="le"||f.k==="te"){ if(mode==="str") continue; } for(let j=0;j<f.q.length-1;j++) if(segD(x,y,f.q[j],f.q[j+1])<7*dp){ P.push(f.k); break; } continue; }
      const q=f.q; let ins=false; for(let a=0,b=q.length-1;a<q.length;b=a++){ if(((q[a][1]>y)!==(q[b][1]>y))&&(x<(q[b][0]-q[a][0])*(y-q[a][1])/(q[b][1]-q[a][1])+q[a][0])) ins=!ins; } if(ins) P.push(f.k); }
    if(!P.length) return null;
    const pref=["le","te"]; const edge=P.find(k=>pref.includes(k)); if(edge&&P.indexOf(edge)<3) return edge;
    if(P[0]==="skin"){ const inner=P.find(k=>k!=="skin"); if(inner) return inner; } return P[0]; };
  let dn=null;
  c.addEventListener("pointerdown",e=>{ dn={x:e.clientX,y:e.clientY,y0:yaw,p0:pit,m:false,t:e.pointerType}; if(e.pointerType==="mouse") c.setPointerCapture(e.pointerId); });
  c.addEventListener("pointermove",e=>{ if(!dn) return; const dx=e.clientX-dn.x, dy=e.clientY-dn.y; if(Math.hypot(dx,dy)>5) dn.m=true; if(!dn.m) return; tY=yaw=dn.y0-dx*.45; if(dn.t==="mouse") tP=pit=cl(dn.p0+dy*.35,-60,89); kick(); });
  const up=e=>{ if(!dn) return; const was=dn; dn=null; if(was.m) return; const r=c.getBoundingClientRect(), k=hit((e.clientX-r.left)*dp,(e.clientY-r.top)*dp); if(!k) return;
    if(mode==="quiz"&&quiz){ score[1]++; const ok=k===quiz[1]; if(ok) score[0]++; sel=k; kick();
      say(`<b class="${ok?"ok":"bad"}">${ok?"Correcto":"No"}</b> · ${info(k)}${ok?"":`<br>Buscabas: ${info(quiz[1])}`}`); const q0=quiz; setTimeout(()=>{ if(mode==="quiz"&&quiz===q0) ask(); },ok?1900:4200); return; }
    if(mode==="ctl"){ sel=k; say(info(k)); kick(); return; }
    if(STR.includes(k)&&mode!=="str") setMode("str",1); pick(k); };
  c.addEventListener("pointerup",up); c.addEventListener("pointercancel",()=>{ dn=null; });
  u.qa("[data-m]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.m)));
  u.qa("[data-v]").forEach(b=>b.addEventListener("click",()=>{ const v=VW[b.dataset.v]; tY=v[0]; tP=v[1]; kick(); }));
  u.qa("[data-p]").forEach(b=>b.addEventListener("click",()=>pick(b.dataset.p)));
  u.qa("[data-c]").forEach(b=>b.addEventListener("click",()=>{ const k=b.dataset.c; if(k==="0") on.clear(); else if(on.has(k)) on.delete(k); else on.add(k); setCtl();
    say(k==="0"||!on.size?"Todo en neutro.":[...on].map(x=>`<b>${CT[x][0]}:</b> ${CT[x][1]}`).join("<br>")); kick(); }));
  const sa=u.q("[data-all]"); sa.addEventListener("change",()=>{ if(sa.value){ const k=sa.value; if(mode==="quiz"||mode==="ctl") setMode(STR.includes(k)?"str":"ext",1); pick(k); } });
  u.q("[data-lab]").addEventListener("change",e=>{ labs=e.currentTarget.checked; kick(); });
  if("IntersectionObserver" in window) new IntersectionObserver(es=>{ vis=es.some(e=>e.isIntersecting); if(vis) kick(); }).observe(c);
  window.addEventListener("resize",kick);
  setMode("ext");
}};
})();

function mount(el){ const k=el.dataset.viz, v=V[k]; if(!v||el._v) return; el._v=1;
  const go=()=>{ try{ v.init(el); }catch(e){ try{ console.error("F0Viz",k,e); }catch(_){} el.innerHTML=`<p class="lt">${v.t}</p><p class="out">No se ha podido cargar esta lámina.</p>`; } };
  if(!("IntersectionObserver" in window)){ go(); return; }
  el.innerHTML=`<p class="lt">${v.t}</p>`; const o=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ o.disconnect(); go(); } },{rootMargin:"400px"}); o.observe(el); }
function init(){ if(!document.getElementById("f0vizCss")){ const s=document.createElement("style"); s.id="f0vizCss"; s.textContent=CSS; document.head.appendChild(s); } document.querySelectorAll(".f0viz[data-viz]").forEach(mount); }
window.F0Viz={init,V}; if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
