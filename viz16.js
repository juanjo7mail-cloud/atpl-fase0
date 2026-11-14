/* Láminas interactivas 2D/3D de los apuntes (serie 2). Se montan en <div class="f0viz" data-viz="…">. Sin librerías: SVG y canvas. */
(function(){
"use strict";
const cl=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t, R=Math.PI/180, f1=x=>(Math.round(x*10)/10).toString().replace(".",","), f0=x=>Math.round(x).toLocaleString("es-ES");
const CSS=`
.f0viz{margin:14px 0 18px;max-width:880px}
.f0viz .lt{font:700 12px/1 "Barlow Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5d6977;margin:0 0 6px}
.f0viz figure{margin:0;background:#12202f;border-radius:8px 8px 0 0;overflow:hidden}
.f0viz svg,.f0viz canvas{display:block;width:100%;height:auto;touch-action:pan-y}
.f0viz svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:#dfe8f1}
.f0viz .ctl{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;background:#0f1b29;color:#e9f0f7;padding:12px 14px;font:600 13.5px/1.25 system-ui,-apple-system,"Segoe UI",sans-serif}
.f0viz .ctl label{display:flex;align-items:center;gap:8px;min-width:0;color:#e9f0f7;flex-wrap:wrap}
.f0viz .ctl input[type=range]{width:min(200px,46vw);accent-color:#ffc94d}
.f0viz .ctl .rv{white-space:nowrap}
.f0viz .ctl output{font:600 13.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace;min-width:5.5ch;color:#ffc94d}
.f0viz .ctl button{font:700 13px system-ui,sans-serif;padding:8px 12px;min-height:38px;border-radius:6px;border:1px solid #3a516b;background:#1a2b3f;color:#e9f0f7;cursor:pointer}
.f0viz .ctl button[aria-pressed=true]{background:#ffc94d;border-color:#ffc94d;color:#12202f}
.f0viz .ctl input[type=checkbox]{width:18px;height:18px;accent-color:#ffc94d}
.f0viz .out{margin:0;background:#16283b;color:#e9f0f7;border-radius:0 0 8px 8px;padding:11px 14px;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:3.2em}
.f0viz .out b{color:#ffc94d}.f0viz .out .ok{color:#6ee7a0}.f0viz .out .bad{color:#ff8a80}
.f0viz .cap{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#5d6977;margin:7px 2px 0}
`;
const V={};
const shell=(el,t,fig,ctl,cap)=>{ el.innerHTML=`<p class="lt">${t}</p><figure>${fig}</figure>${ctl?`<div class="ctl">${ctl}</div>`:""}<p class="out" aria-live="polite"></p><p class="cap">${cap}</p>`; return {out:el.querySelector(".out"),q:s=>el.querySelector(s),qa:s=>el.querySelectorAll(s)}; };
const rng=(id,lab,min,max,val,step,unit)=>`<label>${lab}<input type="range" data-k="${id}" min="${min}" max="${max}" value="${val}" step="${step||1}" aria-label="${lab}"><span class="rv"><output data-o="${id}"></output>${unit||""}</span></label>`;
const bind=(el,fn)=>{ const get=()=>{ const o={}; el.querySelectorAll("[data-k]").forEach(i=>{ o[i.dataset.k]=i.type==="checkbox"?i.checked:+i.value; }); return o; }; const run=()=>{ try{ fn(get()); }catch(e){ try{ console.error("F0Viz",e); }catch(_){} } }; el.addEventListener("input",run); el.addEventListener("change",run); run(); return run; };
const setO=(el,k,v)=>{ const o=el.querySelector(`[data-o="${k}"]`); if(o) o.textContent=v; };
const btns=(el,attr,fn)=>{ const bs=el.querySelectorAll(`[${attr}]`); const pick=v=>{ bs.forEach(b=>b.setAttribute("aria-pressed",b.getAttribute(attr)===String(v)?"true":"false")); fn(v); }; bs.forEach(b=>b.addEventListener("click",()=>pick(b.getAttribute(attr)))); return pick; };
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
V.hold={t:"Entradas en la espera: directa, paralela o desplazada",cap:"Espera con tramo de acercamiento 270°. El sector se decide con el rumbo con el que llegas al punto, con ±5° de flexibilidad en los límites.",
init(el){
  const u=shell(el,this.t,`<svg viewBox="0 0 400 300" role="img" aria-label="Sectores de entrada en una espera"></svg>`,rng("h","Rumbo con el que llegas al punto",0,359,120,1,"°")+`<button type="button" data-side="R" aria-pressed="true">Virajes a la derecha</button><button type="button" data-side="L" aria-pressed="false">A la izquierda</button>`,this.cap), svg=u.q("svg"); let side="R", H=120;
  const draw=()=>{ const cx=200, cy=150, s=side==="R"?1:-1, IB=270, d=((H-IB)*s%360+360)%360; let k, name;
    if(d<=110||d>=290){ k=3; name="DIRECTA (sector 3)"; } else if(d<180){ k=2; name="DESPLAZADA o en gota (sector 2)"; } else { k=1; name="PARALELA (sector 1)"; }
    // posiciones desde las que se llega = rumbo + 180
    const pos=(a,b)=>s>0?wedge(cx,cy,118,(IB+a+180)%360,(IB+b+180)%360):wedge(cx,cy,118,(IB-b+180+360)%360,(IB-a+180+360)%360);
    const col=["","#f6b73c","#58c4f0","#6ee7a0"], op=i=>k===i?.42:.13, y=cy-s*34, pl=pol(cx,cy,104,H+180);
    svg.innerHTML=`<rect width="400" height="300" fill="#12202f"/>
     <path d="${pos(290,470)}" fill="${col[3]}" opacity="${op(3)}"/><path d="${pos(110,180)}" fill="${col[2]}" opacity="${op(2)}"/><path d="${pos(180,290)}" fill="${col[1]}" opacity="${op(1)}"/>
     <path d="M${cx} ${cy}H${cx+112}" stroke="#dfe8f1" stroke-width="2.4"/><path d="M${cx+112} ${cy}A17 17 0 0 ${s>0?0:1} ${cx+112} ${y}H${cx}A17 17 0 0 ${s>0?0:1} ${cx} ${cy}" fill="none" stroke="#dfe8f1" stroke-width="2.4"/>
     <path d="M${cx+70} ${cy-4}l-9 4 9 4z" fill="#dfe8f1"/><path d="M${cx+40} ${y-4}l9 4-9 4z" fill="#dfe8f1"/>
     <circle cx="${cx}" cy="${cy}" r="5" fill="#ffc94d"/><text x="${cx-8}" y="${cy+20}" font-size="11" text-anchor="end">punto de espera</text><text x="${cx+60}" y="${cy+16}" font-size="10" fill="#9fb3c8">acercamiento 270°</text>
     <g transform="translate(${pl[0].toFixed(1)} ${pl[1].toFixed(1)}) rotate(${H})"><path d="M0 -11L7 9L0 5L-7 9Z" fill="${col[k]}" stroke="#12202f" stroke-width="1"/></g>
     <text x="12" y="20" font-size="11" fill="${col[3]}">■ directa · 180°</text><text x="12" y="36" font-size="11" fill="${col[1]}">■ paralela · 110°</text><text x="12" y="52" font-size="11" fill="${col[2]}">■ desplazada · 70°</text>`;
    u.out.innerHTML=`Llegas con rumbo <b>${String(H).padStart(3,"0")}°</b> → entrada <b>${name}</b>. `+(k===3?"Sobrevuelas el punto y viras directamente al tramo de alejamiento.":k===2?`Sobrevuelas el punto, tomas un rumbo <b>30° abierto</b> respecto al alejamiento (${String((IB+180-30*s+360)%360).padStart(3,"0")}°) hacia dentro de la espera durante 1 min y viras para interceptar el acercamiento.`:"Sobrevuelas el punto, vuelas <b>paralelo</b> al acercamiento en sentido contrario durante 1 min, viras hacia el lado de la espera y vuelves al punto."); };
  btns(el,"data-side",v=>{ side=v; draw(); }); bind(el,o=>{ H=o.h; setO(el,"h",String(H).padStart(3,"0")); draw(); });
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

function mount(el){ const k=el.dataset.viz, v=V[k]; if(!v||el._v) return; el._v=1;
  const go=()=>{ try{ v.init(el); }catch(e){ try{ console.error("F0Viz",k,e); }catch(_){} el.innerHTML=`<p class="lt">${v.t}</p><p class="out">No se ha podido cargar esta lámina.</p>`; } };
  if(!("IntersectionObserver" in window)){ go(); return; }
  el.innerHTML=`<p class="lt">${v.t}</p>`; const o=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ o.disconnect(); go(); } },{rootMargin:"400px"}); o.observe(el); }
function init(){ if(!document.getElementById("f0vizCss")){ const s=document.createElement("style"); s.id="f0vizCss"; s.textContent=CSS; document.head.appendChild(s); } document.querySelectorAll(".f0viz[data-viz]").forEach(mount); }
window.F0Viz={init,V}; if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
