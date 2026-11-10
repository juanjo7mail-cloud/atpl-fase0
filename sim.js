/* ATPL Fase 0 · SIMULADOR — minijuegos de estudio. Sin cuenta, sin servidor: todo corre en el navegador.
   1) Turn coordinator: viraje a régimen 1 con la bola centrada (con horizonte y giro direccional al lado).
   2) Despegue y 3) Aterrizaje: vista de cabina con perspectiva, modelo de vuelo sencillo de un monomotor ligero (tipo C172).
   4) ¿Giroscópico o de presión?: clasifica instrumentos.
   Herramienta de estudio: NO es un simulador certificado ni sirve para entrenar maniobras reales.
   API: F0Sim.render(el) · F0Sim.leave() */
(function(){
"use strict";
const D2R=Math.PI/180, KT=0.514444, FT=3.28084, G=9.81, TAU=Math.PI*2;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const wrap180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const store={ get(){ try{ return JSON.parse(localStorage.getItem("f0:sim")||"{}")||{}; }catch(e){ return {}; } },
  best(k,v){ const o=this.get(); if(v!=null&&(o[k]==null||v>o[k])){ o[k]=v; try{ localStorage.setItem("f0:sim",JSON.stringify(o)); }catch(e){} } return o[k]; } };
let root=null, stopFn=null;

/* ====================================================================== */
/*  1 · Física del turn coordinator (pura, se puede probar sin pantalla)   */
/* ====================================================================== */
function TurnSim(o){
  o=o||{};
  const s={ tas:o.tas||100, turb:o.turb||0, phi:0, hdg:o.hdg||0, w:0, p:0, ball:0, tilt:0, gust:0, t:0, rate:0 };
  s.step=function(dt,ail,rud){
    const V=s.tas*KT;
    s.gust+= (-s.gust*1.2*dt) + (Math.random()-0.5)*s.turb*1.6*dt;
    s.p = ail*0.55 + s.gust*0.35;                       // balanceo (rad/s)
    s.phi = clamp(s.phi + s.p*dt - 0.02*s.phi*dt, -55*D2R, 55*D2R);
    const wc = G*Math.tan(s.phi)/V;                     // régimen coordinado
    const adverse = -0.12*s.p;                          // guiñada adversa
    const wT = wc + adverse + rud*0.05;
    s.w += (wT - s.w)*Math.min(1, dt*2.5);
    s.hdg = (s.hdg + s.w/D2R*dt + 360)%360;
    const ar = G*Math.sin(s.phi) - V*s.w*Math.cos(s.phi);   // aceleración lateral (derecha +)
    const bt = clamp(ar/(0.15*G), -1.6, 1.6);
    s.ball += (bt - s.ball)*Math.min(1, dt*5);
    s.rate = s.w/D2R;                                   // °/s real
    s.tilt = clamp((s.rate/3)*15 + s.p/D2R*0.12, -35, 35);  // lo que enseña el turn coordinator
    s.t += dt;
  };
  return s;
}

/* ====================================================================== */
/*  2 · Física de vuelo (monomotor ligero, solo plano vertical + viraje)   */
/* ====================================================================== */
function FlightSim(mode,o){
  o=o||{};
  const m=1100, S=16.2, RHO=1.2, W=m*G, A0=0.05;
  const s={ mode, z:0, x:0, h:0, V:0, gam:0, al:0, th:0, psi:0, phi:0, y:0, thr:0, flap:0, brake:0, ail:0,
    ground:true, t:0, cross:o.cross||0, td:null, bounces:0, msg:"", crash:"", done:false, stall:false,
    liftoff:null, maxH:0, rwyEnd:false, endH:null, off:false, stopped:false, runL:1500, runW:30 };
  const CL0=f=>0.31+0.45*f, AS=f=>0.27-0.03*f;
  const CL=(a,f)=>{ const as=AS(f), c0=CL0(f); return a<as ? c0+5*a : Math.max(0.55, c0+5*as-3*(a-as)); };
  const CD=(cl,a,f)=>0.027+0.056*cl*cl+0.05*f*f+(a>AS(f)?1.5*(a-AS(f)):0);
  const Tmax=V=>Math.min(2800, 70000/Math.max(V,10));
  s.fl=()=>s.flap/3;
  s.ias=()=>s.V/KT;
  s.vs=()=>s.V*Math.sin(s.gam);
  s.stallV=f=>Math.sqrt(2*W/(RHO*S*(CL0(f)+5*AS(f))))/KT;
  s.trim=function(V,gam,flap){          // yoke y y gases para equilibrio (para arrancar la final)
    const f=flap/3, q=0.5*RHO*V*V*S, cl=W*Math.cos(gam)/q, a=(cl-CL0(f))/5;
    const d=q*CD(cl,a,f), T=d+W*Math.sin(gam);
    return { y:(a-A0)/0.22, thr:clamp(T/Tmax(V)+0.08,0,1), al:a };
  };
  if(mode==="landing"){
    const V=o.V||36, g=-3*D2R, f=2; s.flap=f;
    s.z=o.z0||-2300; s.h=(300-s.z)*Math.tan(3*D2R)-0.8; s.V=V; s.gam=g;
    s.x=o.x0!=null?o.x0:(Math.random()<.5?-1:1)*(15+Math.random()*30); s.psi=o.psi0!=null?o.psi0:0;
    const t=s.trim(V,g,f); s.y=t.y; s.thr=t.thr; s.al=t.al; s.th=g+t.al; s.ground=false;
  } else { s.z=10; s.h=0; s.V=0; s.ground=true; }
  s.step=function(dt){
    if(s.done) return;
    const f=s.fl(), V=Math.max(s.V,0.01);
    s.t+=dt;
    const q=0.5*RHO*V*V*S;
    // viraje / balanceo
    if(!s.ground){
      const p=s.ail*0.5-0.25*s.phi;
      s.phi=clamp(s.phi+p*dt,-50*D2R,50*D2R);
      s.psi+=G*Math.tan(s.phi)/Math.max(V,12)*dt;
    }
    if(s.ground){
      const auth=Math.min(1,(s.V/22)*(s.V/22));
      const tgt=s.y>0?clamp(0.28*s.y*auth,0,0.24):0;
      s.th+=(tgt-s.th)*Math.min(1,dt*2);
      s.al=s.th; s.gam=0; s.phi=0;
      const cl=CL(s.al,f), L=q*cl, D=q*CD(cl,s.al,f);
      const T=(s.thr-0.08)*Tmax(s.V);
      const N=Math.max(0,W-L), mu=0.035+(s.brake?0.5:0);
      let F=T-D-mu*N;
      if(s.V<=0.2 && F<0) F=0;
      s.V=Math.max(0,s.V+F/m*dt);
      // dirección: giro a la izquierda con gases (par motor), pedales corrigen
      const turn=-0.035*s.thr*Math.max(0,1-s.V/30)+s.ail*0.35*Math.min(1,0.25+s.V/10);
      s.psi+=turn*dt - s.psi*0.35*dt*Math.min(1,s.V/15);
      s.z+=s.V*Math.cos(s.psi)*dt; s.x+=s.V*Math.sin(s.psi)*dt;
      if(s.V<0.3 && s.mode==="landing" && s.td){ s.stopped=true; s.done=true; }
      if(s.mode==="takeoff" && L>=W && s.V>12 && s.th>0.02){ s.ground=false; s.gam=0; s.liftoff={V:s.ias(), z:s.z, t:s.t}; s.h=0.05; }
      if(s.z>s.runL+60 && s.ground){ s.crash=s.mode==="landing"?"Te has salido por el final de la pista.":"Te has salido por el final de la pista sin despegar."; s.done=true; }
      if(Math.abs(s.x)>s.runW/2+3 && s.V>3) s.off=true;
    } else {
      const aT=A0+0.22*s.y;
      const as=AS(f);
      let aT2=aT; if(s.al>as) aT2-= (s.al-as)*3;
      s.al+=(aT2-s.al)*Math.min(1,dt/0.5);
      s.stall = s.al>as;
      const cl=CL(s.al,f), L=q*cl, D=q*CD(cl,s.al,f);
      const T=(s.thr-0.08)*Tmax(s.V);
      s.V=Math.max(5,s.V+((T*Math.cos(s.al)-D-W*Math.sin(s.gam))/m)*dt);
      s.gam+=((L*Math.cos(s.phi)+T*Math.sin(s.al)-W*Math.cos(s.gam))/(m*V))*dt;
      s.gam=clamp(s.gam,-1.2,1.2);
      s.th=s.gam+s.al;
      s.h+=V*Math.sin(s.gam)*dt;
      s.z+=V*Math.cos(s.gam)*Math.cos(s.psi)*dt;
      s.x+=(V*Math.cos(s.gam)*Math.sin(s.psi)+s.cross)*dt;
      s.maxH=Math.max(s.maxH,s.h);
      if(s.mode==="takeoff"){
        if(!s.rwyEnd && s.z>=s.runL){ s.rwyEnd=true; s.endH=s.h; }
        if(s.h>=150) { s.done=true; }
      }
      if(s.h<=0){                       // contacto con el suelo
        const vs=-V*Math.sin(s.gam);
        if(!s.td){ s.td={ vs:vs, V:s.ias(), z:s.z, x:s.x, th:s.th, phi:s.phi, t:s.t, psi:s.psi }; }
        if(vs>4.0 || Math.abs(s.phi)>14*D2R){ s.crash=vs>4.0?"Impacto demasiado duro: el tren no lo aguanta.":"Tocaste con un ala: demasiado alabeo en el contacto."; s.done=true; }
        else if(vs>1.8 && s.bounces<3){ s.bounces++; s.h=0.05; s.gam=Math.min(0.12, vs*0.38/V); s.al=Math.max(0.02,s.al*0.8); }
        else { s.ground=true; s.h=0; s.gam=0; s.th=Math.max(0,s.al*0.7); s.phi=0; }
        if(s.mode==="takeoff" && !s.crash){ s.crash="Volviste a tocar la pista: tras rotar, no bajes el morro hasta tener velocidad (el avión aún está cerca de la pérdida)."; s.done=true; }
      }
    }
  };
  return s;
}

/* ====================================================================== */
/*  UI común                                                               */
/* ====================================================================== */
function injectCss(){
  if($("#f0sim-css")) return;
  const st=document.createElement("style"); st.id="f0sim-css";
  st.textContent=`
.fs{max-width:1040px;margin:0 auto;padding:14px 16px 30px;color:var(--ink)}
.fs h2{font:700 22px/1.2 var(--display,inherit);margin:4px 0 4px}
.fs .fs-sub{color:var(--muted);margin:0 0 14px;max-width:70ch}
.fs-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.fs-card{display:flex;flex-direction:column;gap:8px;text-align:left;font:inherit;color:inherit;border:1px solid var(--line);border-top:4px solid var(--c,#1D6FB0);background:var(--paper);border-radius:10px;padding:14px 16px;cursor:pointer;min-width:0}
.fs-card:hover,.fs-card:focus-visible{box-shadow:0 4px 14px rgba(20,48,74,.18);outline:none}
.fs-card b{font:700 17px/1.2 var(--display,inherit)}
.fs-card span{color:var(--muted);font-size:14px}
.fs-card i{font-style:normal;font-size:12.5px;color:var(--muted);margin-top:auto}
.fs-note{margin-top:16px;font-size:13px;color:var(--muted);max-width:75ch}
.fs-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}
.fs-bar h2{margin:0;font-size:19px}
.fs-btn{border:1px solid var(--ink);background:var(--ink);color:var(--paper);border-radius:6px;padding:8px 14px;font:600 14px/1 var(--display,inherit);cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.fs-btn.sec{background:transparent;color:var(--ink)}
.fs-btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.fs-btn:active,.fs-btn.on{filter:brightness(1.25)}
.fs-stage{position:relative;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#0b1620}
.fs-stage canvas{display:block;width:100%;height:auto;touch-action:none}
.fs-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 18px;margin:12px 0}
.fs-ctl label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}
.fs-ctl input[type=range]{width:100%;height:34px;margin:0;accent-color:var(--ink);touch-action:none}
.fs-pad{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fs-pad .fs-btn{min-width:56px;min-height:44px}
.fs-keys{font-size:12.5px;color:var(--muted);margin:6px 0 0}
.fs-keys kbd{font:600 12px var(--body,inherit);border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 5px;background:var(--paper)}
.fs-out{border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:14px 16px;margin-top:12px}
.fs-out h3{margin:0 0 6px;font:700 18px/1.2 var(--display,inherit)}
.fs-out .big{font:700 36px/1 var(--display,inherit)}
.fs-out ul{margin:8px 0 0;padding-left:20px}
.fs-out li{margin:3px 0}
.fs-ok{color:#1f8a4c}.fs-bad{color:#c0392b}.fs-mid{color:#b9770e}
.fs-card3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
.fs-bin{border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:14px 8px;font:700 15px/1.2 var(--display,inherit);cursor:pointer;min-height:64px;touch-action:manipulation}
.fs-bin small{display:block;font:500 12px var(--body,inherit);color:var(--muted);margin-top:3px}
.fs-bin:hover{border-color:var(--ink)}
.fs-q{border:1px solid var(--line);border-radius:10px;background:var(--paper);padding:22px 12px;text-align:center;font:700 22px/1.2 var(--display,inherit);margin:8px 0}
.fs-fb{min-height:44px;font-size:14.5px;margin:4px 0}
.fs-prog{height:8px;border-radius:4px;background:var(--line);overflow:hidden}.fs-prog i{display:block;height:100%;background:var(--ink);transition:width .25s}
@media (max-width:560px){.fs-card3{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.fs-prog i{transition:none}}
`;
  document.head.appendChild(st);
}

function menu(){
  if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; }
  const b=store.get();
  const bt=k=>b[k]!=null?`Mejor: ${b[k]} puntos`:"Sin jugar todavía";
  root.innerHTML=`<div class="fs">
    <h2>Simulador · minijuegos de estudio</h2>
    <p class="fs-sub">Cuatro retos cortos para <b>sentir</b> lo que estudias: el turn coordinator, el despegue, el aterrizaje y los instrumentos giroscópicos. Funcionan con el ratón, el teclado o el dedo.</p>
    <div class="fs-menu">
      <button class="fs-card" data-g="turn" style="--c:#0B747E"><b>🧭 Turn coordinator</b><span>Haz un viraje a régimen 1 con la bola centrada. Tienes también el horizonte y el giro direccional.</span><i>${bt("turn")}</i></button>
      <button class="fs-card" data-g="takeoff" style="--c:#B8500A"><b>🛫 Despegue</b><span>Gases, rotación a Vr, mantén el eje de pista y sube a 500 ft a Vy.</span><i>${bt("takeoff")}</i></button>
      <button class="fs-card" data-g="landing" style="--c:#2A7A40"><b>🛬 Aterrizaje</b><span>Final de 3°, guíate por el PAPI, reduce y recoge en el flare.</span><i>${bt("landing")}</i></button>
      <button class="fs-card" data-g="sort" style="--c:#7A41A6"><b>⚙️ ¿Giroscópico o de presión?</b><span>Clasifica los instrumentos: el tipo de pregunta de la clase de hoy.</span><i>${bt("sort")}</i></button>
    </div>
    <p class="fs-note">Es un juego de estudio con un modelo de vuelo muy simplificado de un monomotor ligero tipo C172. No sustituye a un simulador homologado ni a las instrucciones del POH.</p>
  </div>`;
  root.querySelectorAll("[data-g]").forEach(bn=>bn.onclick=()=>openGame(bn.dataset.g));
}
function openGame(g){
  if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; }
  root.innerHTML=`<div class="fs"><div class="fs-bar"><button class="fs-btn ghost" id="fsBack">← Minijuegos</button><h2 id="fsT"></h2></div><div id="fsG"></div></div>`;
  $("#fsBack",root).onclick=menu;
  const box=$("#fsG",root);
  stopFn = g==="turn"?turnGame(box):g==="sort"?sortGame(box):flightGame(box,g);
}

/* ---- utilidades de dibujo / entrada ---- */
function fitCanvas(cv,w,h){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  const c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); return c;
}
function keyboard(map){            // map: {key:[down,up]} · devuelve quitar()
  const dn=e=>{ if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&e.target.type!=="range") return; const f=map[e.key.length===1?e.key.toLowerCase():e.key]; if(f){ e.preventDefault(); if(!e.repeat&&f[0]) f[0](e); else if(e.repeat&&f[2]) f[2](e); } };
  const up=e=>{ const f=map[e.key.length===1?e.key.toLowerCase():e.key]; if(f&&f[1]){ e.preventDefault(); f[1](e); } };
  window.addEventListener("keydown",dn); window.addEventListener("keyup",up);
  return ()=>{ window.removeEventListener("keydown",dn); window.removeEventListener("keyup",up); };
}
function holdBtn(el,on,off){
  const d=e=>{ e.preventDefault(); el.classList.add("on"); on(); try{ el.setPointerCapture(e.pointerId); }catch(_){} };
  const u=e=>{ el.classList.remove("on"); off(); };
  el.addEventListener("pointerdown",d); el.addEventListener("pointerup",u); el.addEventListener("pointercancel",u); el.addEventListener("lostpointercapture",u);
  el.addEventListener("contextmenu",e=>e.preventDefault());
}
function springRange(inp,onv){     // control que vuelve al centro al soltar
  const set=()=>onv(+inp.value/100);
  inp.addEventListener("input",set);
  const rel=()=>{ inp.value=0; onv(0); };
  inp.addEventListener("pointerup",rel); inp.addEventListener("pointercancel",rel); inp.addEventListener("touchend",rel);
}

/* ====================================================================== */
/*  Instrumentos (canvas)                                                  */
/* ====================================================================== */
function dialFace(c,x,y,r){
  c.save(); c.beginPath(); c.arc(x,y,r+6,0,TAU); c.fillStyle="#1b232c"; c.fill();
  c.lineWidth=2; c.strokeStyle="#59656f"; c.stroke(); c.restore();
}
function drawAI(c,x,y,r,phi,pitch){
  dialFace(c,x,y,r);
  c.save(); c.beginPath(); c.arc(x,y,r,0,TAU); c.clip();
  c.translate(x,y); c.rotate(-phi);
  const py=pitch*r*2.2;
  c.fillStyle="#3C8BD6"; c.fillRect(-r*2,-r*2+py,r*4,r*2);
  c.fillStyle="#8A5A2B"; c.fillRect(-r*2,py,r*4,r*2);
  c.strokeStyle="#fff"; c.lineWidth=2; c.beginPath(); c.moveTo(-r*2,py); c.lineTo(r*2,py); c.stroke();
  c.lineWidth=1.5; [-15,-10,-5,5,10,15].forEach(k=>{ const yy=py-k*D2R*r*2.2, w=(Math.abs(k)%10===0?r*.32:r*.2); c.beginPath(); c.moveTo(-w,yy); c.lineTo(w,yy); c.stroke(); });
  c.restore();
  // escala de alabeo
  c.save(); c.translate(x,y); c.strokeStyle="#fff"; c.fillStyle="#fff"; c.lineWidth=2;
  [-60,-45,-30,-20,-10,0,10,20,30,45,60].forEach(a=>{ c.save(); c.rotate(a*D2R); c.beginPath(); c.moveTo(0,-r+1); c.lineTo(0,-r+(a%30===0?14:8)); c.stroke(); c.restore(); });
  c.save(); c.rotate(-phi); c.beginPath(); c.moveTo(0,-r+16); c.lineTo(-6,-r+28); c.lineTo(6,-r+28); c.closePath(); c.fillStyle="#ffb300"; c.fill(); c.restore();
  // avioncito fijo
  c.strokeStyle="#ffb300"; c.lineWidth=4; c.beginPath(); c.moveTo(-r*.55,0); c.lineTo(-r*.18,0); c.lineTo(-r*.1,r*.1); c.moveTo(r*.55,0); c.lineTo(r*.18,0); c.lineTo(r*.1,r*.1); c.stroke();
  c.fillStyle="#ffb300"; c.beginPath(); c.arc(0,0,3,0,TAU); c.fill();
  c.restore();
}
function drawDI(c,x,y,r,hdg,bug){
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#0e1318"; c.fill();
  c.rotate(-hdg*D2R);
  for(let a=0;a<360;a+=5){ c.save(); c.rotate(a*D2R); c.strokeStyle="#fff"; c.lineWidth=a%10===0?2:1; c.beginPath(); c.moveTo(0,-r+2); c.lineTo(0,-r+(a%30===0?14:a%10===0?9:5)); c.stroke();
    if(a%30===0){ c.fillStyle="#fff"; c.font="600 "+Math.round(r*.15)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle"; const t=a===0?"N":a===90?"E":a===180?"S":a===270?"W":String(a/10); c.fillText(t,0,-r+26); } c.restore(); }
  if(bug!=null){ c.save(); c.rotate(bug*D2R); c.fillStyle="#ff8a00"; c.beginPath(); c.moveTo(0,-r+1); c.lineTo(-7,-r-1); c.lineTo(-7,-r+12); c.lineTo(0,-r+8); c.lineTo(7,-r+12); c.lineTo(7,-r-1); c.closePath(); c.globalAlpha=.9; c.fill(); c.restore(); }
  c.restore();
  c.save(); c.translate(x,y); c.fillStyle="#fff";
  c.beginPath(); c.moveTo(0,-r*.42); c.lineTo(5,-r*.1); c.lineTo(r*.34,r*.08); c.lineTo(r*.34,r*.16); c.lineTo(5,r*.06); c.lineTo(4,r*.28); c.lineTo(r*.14,r*.38); c.lineTo(r*.14,r*.44); c.lineTo(0,r*.4); c.lineTo(-r*.14,r*.44); c.lineTo(-r*.14,r*.38); c.lineTo(-4,r*.28); c.lineTo(-5,r*.06); c.lineTo(-r*.34,r*.16); c.lineTo(-r*.34,r*.08); c.lineTo(-5,-r*.1); c.closePath(); c.fill();
  c.fillStyle="#ff3b30"; c.beginPath(); c.moveTo(0,-r-6); c.lineTo(-6,-r+8); c.lineTo(6,-r+8); c.closePath(); c.fill();
  c.restore();
}
function drawTC(c,x,y,r,tilt,ball){
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#101418"; c.fill();
  c.fillStyle="#cfd6dc"; c.font="600 "+Math.round(r*.085)+"px system-ui,sans-serif"; c.textAlign="center";
  c.fillText("TURN COORDINATOR",0,-r*.62);
  c.font="700 "+Math.round(r*.13)+"px system-ui,sans-serif"; c.fillText("L",-r*.7,r*.12); c.fillText("R",r*.7,r*.12);
  c.font="600 "+Math.round(r*.1)+"px system-ui,sans-serif"; c.fillText("2 MIN",0,r*.68); c.font="500 "+Math.round(r*.065)+"px system-ui,sans-serif"; c.fillText("NO PITCH INFORMATION",0,r*.8);
  // marcas de rate 1 (±15°)
  c.strokeStyle="#fff"; c.lineWidth=4; c.lineCap="round";
  [-1,1].forEach(sg=>{ c.save(); c.rotate(sg*15*D2R); c.beginPath(); c.moveTo(sg*r*.66,0); c.lineTo(sg*r*.88,0); c.restore(); });
  // avioncito inclinado
  c.save(); c.rotate(tilt*D2R); c.strokeStyle="#fff"; c.fillStyle="#fff"; c.lineWidth=5;
  c.beginPath(); c.moveTo(-r*.62,0); c.lineTo(r*.62,0); c.stroke();
  c.beginPath(); c.arc(0,0,r*.07,0,TAU); c.fill();
  c.lineWidth=4; c.beginPath(); c.moveTo(0,-r*.07); c.lineTo(0,-r*.22); c.moveTo(-r*.1,-r*.2); c.lineTo(r*.1,-r*.2); c.stroke();
  c.restore();
  // tubo y bola
  const ty=r*.42, tw=r*.55;
  c.lineWidth=r*.12; c.strokeStyle="#2b333b"; c.beginPath(); c.arc(0,ty-r*.38,r*.52+r*.0,Math.PI*.18,Math.PI*.82); c.stroke();
  c.lineWidth=2; c.strokeStyle="#fff"; [-.16,.16].forEach(k=>{ c.beginPath(); c.moveTo(k*r*1.1,ty-r*.04); c.lineTo(k*r*1.1,ty+r*.08); c.stroke(); });
  const bx=clamp(ball,-1.6,1.6)*r*.2, by=ty+Math.abs(bx)*.02;
  c.beginPath(); c.arc(bx,by,r*.085,0,TAU); c.fillStyle="#111"; c.strokeStyle="#cfd6dc"; c.lineWidth=2; c.fill(); c.stroke();
  c.restore();
}
function drawASI(c,x,y,r,kt){
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#0e1318"; c.fill();
  const ang=v=>(135+(clamp(v,0,200)/200)*270)*D2R;   // 0 kt abajo a la izquierda, 200 kt abajo a la derecha
  const arc=(a,b,col,rad,w)=>{ c.beginPath(); c.arc(0,0,rad,ang(a),ang(b)); c.lineWidth=w; c.strokeStyle=col; c.stroke(); };
  arc(40,85,"#fff",r*.9,4); arc(48,129,"#2ecc71",r*.84,7); arc(129,163,"#f1c40f",r*.84,7);
  c.beginPath(); c.moveTo(Math.cos(ang(163))*r*.78,Math.sin(ang(163))*r*.78); c.lineTo(Math.cos(ang(163))*r*.97,Math.sin(ang(163))*r*.97); c.strokeStyle="#e74c3c"; c.lineWidth=4; c.stroke();
  c.fillStyle="#fff"; c.font="600 "+Math.round(r*.14)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle";
  for(let v=20;v<=180;v+=20){ const a=ang(v); c.fillText(String(v),Math.cos(a)*r*.62,Math.sin(a)*r*.62); }
  c.font="500 "+Math.round(r*.11)+"px system-ui,sans-serif"; c.fillText("KNOTS",0,r*.32); c.fillText("IAS",0,-r*.25);
  const a=ang(kt); c.strokeStyle="#fff"; c.lineWidth=3; c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8); c.stroke();
  c.beginPath(); c.arc(0,0,4,0,TAU); c.fillStyle="#fff"; c.fill();
  c.restore();
}
function drawALT(c,x,y,r,ftv,vsi){
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#0e1318"; c.fill();
  c.fillStyle="#fff"; c.font="600 "+Math.round(r*.16)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle";
  for(let i=0;i<10;i++){ const a=(i/10)*TAU-Math.PI/2; c.fillText(String(i),Math.cos(a)*r*.72,Math.sin(a)*r*.72); c.strokeStyle="#fff"; c.lineWidth=2; c.beginPath(); c.moveTo(Math.cos(a)*r*.93,Math.sin(a)*r*.93); c.lineTo(Math.cos(a)*r*.86,Math.sin(a)*r*.86); c.stroke(); }
  const a1=((ftv%1000)/1000)*TAU-Math.PI/2; c.strokeStyle="#fff"; c.lineWidth=4; c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a1)*r*.8,Math.sin(a1)*r*.8); c.stroke();
  const a2=((ftv%10000)/10000)*TAU-Math.PI/2; c.lineWidth=5; c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a2)*r*.5,Math.sin(a2)*r*.5); c.stroke();
  c.fillStyle="rgba(14,19,24,.82)"; c.fillRect(-r*.5,-r*.4,r,r*.28); c.fillRect(-r*.5,r*.18,r,r*.55);
  c.fillStyle="#fff"; c.textAlign="center"; c.textBaseline="middle";
  c.font="500 "+Math.round(r*.11)+"px system-ui,sans-serif"; c.fillText("ALT ft AGL",0,-r*.26);
  c.font="700 "+Math.round(r*.2)+"px system-ui,sans-serif"; c.fillText(String(Math.max(0,Math.round(ftv/10)*10)),0,r*.33);
  c.font="500 "+Math.round(r*.13)+"px system-ui,sans-serif"; c.fillStyle=vsi<-700?"#ff6b5b":"#9fd3ff"; c.fillText((vsi>=0?"+":"")+Math.round(vsi/10)*10+" fpm",0,r*.58);
  c.restore();
}

/* ====================================================================== */
/*  Juego 1 · Turn coordinator                                             */
/* ====================================================================== */
function turnGame(box){
  $("#fsT",root).textContent="Turn coordinator";
  box.innerHTML=`<p class="fs-sub" id="tgBrief"></p>
  <div class="fs-stage"><canvas id="tgC"></canvas></div>
  <div class="fs-ctl">
    <label>Alerones (arrastra: ← izquierda · derecha →)<input type="range" id="tgAil" min="-100" max="100" value="0"></label>
    <label>Timón de dirección (pedal izquierdo ← · derecho →)<input type="range" id="tgRud" min="-100" max="100" value="0"></label>
  </div>
  <div class="fs-pad"><button class="fs-btn sec" id="tgNew">Nuevo reto</button><button class="fs-btn ghost" id="tgHelp">Ayuda: alabeo orientativo</button><span id="tgHint" class="fs-keys"></span></div>
  <p class="fs-keys">Teclado: <kbd>←</kbd><kbd>→</kbd> alerones · <kbd>A</kbd><kbd>D</kbd> pedales · <kbd>R</kbd> nuevo reto. Regla: <b>pie del lado de la bola</b>.</p>
  <div id="tgOut"></div>`;
  const cv=$("#tgC",box), W=900, H=300, c=fitCanvas(cv,W,H);
  let sim, mis, ail=0, rud=0, kA=0, kR=0, raf=0, last=0, run=false, help=false, ok=0, tot=0, acc=0, started=false, hintT=0;
  const readIn=()=>({a:clamp(ail+kA,-1,1), r:clamp(rud+kR,-1,1)});
  function newMission(){
    const dir=Math.random()<.5?1:-1, ang=[90,180,270,360][Math.floor(Math.random()*4)], tas=[90,100,110,120,140][Math.floor(Math.random()*5)];
    const h0=Math.floor(Math.random()*36)*10;
    mis={dir,ang,tas,h0,tgt:(h0+dir*ang+720)%360};
    sim=TurnSim({tas, turb:0.25, hdg:h0});
    ok=0; tot=0; acc=0; started=false; run=true; $("#tgOut",box).innerHTML="";
    $("#tgBrief",box).innerHTML=`<b>Reto:</b> viraje a la <b>${dir>0?"derecha":"izquierda"}</b> de <b>${ang}°</b> a <b>régimen 1</b> (3 °/s), TAS <b>${tas} kt</b>, desde el rumbo ${String(h0).padStart(3,"0")}. Sal con las alas niveladas en el rumbo <b>${String(mis.tgt===0?360:mis.tgt).padStart(3,"0")}</b> (marca naranja). Aguja en la marca L/R y <b>bola centrada</b>.`;
  }
  function end(why){
    run=false;
    const err=Math.abs(acc-mis.ang), frac=tot>0?ok/tot:0;
    let sc=Math.round(100*frac*(1-Math.min(1,err/15)));
    if(why==="wrong") sc=0;
    const best=store.best("turn",sc);
    const tips=[];
    if(why==="wrong") tips.push("Giraste hacia el lado contrario.");
    else{
      tips.push(`Tiempo con régimen 1 y bola centrada: <b>${Math.round(frac*100)} %</b>.`);
      tips.push(`Error de rumbo al salir: <b>${err.toFixed(0)}°</b>${err<=5?" ✔":err<=15?"":" (ajusta la salida unos grados antes)"}.`);
      tips.push(`Alabeo orientativo para rate 1: TAS/10 + 7 = <b>${Math.round(mis.tas/10+7)}°</b> (el cálculo exacto da ${Math.round(Math.atan(0.0524*mis.tas*KT/G)/D2R)}°). Con más velocidad hace falta más alabeo.`);
      tips.push("Bola fuera del viraje = derrape (falta alabeo); bola dentro = resbale (sobra alabeo). Pie del lado de la bola.");
    }
    $("#tgOut",box).innerHTML=`<div class="fs-out"><div class="big ${sc>=70?"fs-ok":sc>=40?"fs-mid":"fs-bad"}">${sc} <small style="font:600 14px system-ui">puntos · mejor ${best}</small></div><ul>${tips.map(t=>"<li>"+t+"</li>").join("")}</ul></div>`;
  }
  function frame(t){
    raf=requestAnimationFrame(frame);
    const dt=Math.min(0.05,(t-last)/1000||0.016); last=t;
    if(run){
      const u=readIn(), h0=sim.hdg; sim.step(dt,u.a,u.r);
      const bank=Math.abs(sim.phi)/D2R;
      if(!started && bank>4) started=true;
      if(started){
        acc+=wrap180(sim.hdg-h0)*mis.dir; tot+=dt;
        if(Math.abs(sim.rate-3*mis.dir)<=0.7 && Math.abs(sim.ball)<=0.3 && bank>5) ok+=dt;
        if(acc<-35) end("wrong");
        else if(acc>=mis.ang-30 && bank<2.5) end("done");
        else if(acc>mis.ang+30 || sim.t>240) end("done");
      }
      hintT-=dt;
      if(hintT<=0){ hintT=0.5; const b=sim.ball, h=$("#tgHint",box);
        h.textContent = Math.abs(b)>0.45 ? (b<0?"Bola a la izquierda: pisa el pedal izquierdo (o más alabeo si giras a la derecha).":"Bola a la derecha: pisa el pedal derecho (o más alabeo si giras a la izquierda).") : (help?`Alabeo orientativo ≈ ${Math.round(mis.tas/10+7)}° · alabeo actual ${Math.abs(sim.phi/D2R).toFixed(0)}°`:"");
      }
    }
    // dibujar
    c.clearRect(0,0,W,H); c.fillStyle="#0b1620"; c.fillRect(0,0,W,H);
    drawAI(c,150,150,110,sim.phi,0);
    drawTC(c,450,150,120,sim.tilt,sim.ball);
    drawDI(c,750,150,110,sim.hdg,mis.tgt);
    c.fillStyle="#9fb3c4"; c.font="600 12px system-ui,sans-serif"; c.textAlign="center";
    c.fillText("HORIZONTE ARTIFICIAL",150,288); c.fillText("TURN COORDINATOR",450,292); c.fillText("GIRO DIRECCIONAL",750,288);
    c.textAlign="left"; c.fillStyle="#e3ecf2"; c.font="600 13px system-ui,sans-serif";
    c.fillText("Régimen "+(sim.rate>=0?"+":"")+sim.rate.toFixed(1)+" °/s",14,22);
    c.textAlign="right"; c.fillText("TAS "+mis.tas+" kt",W-14,22);
  }
  newMission(); raf=requestAnimationFrame(frame);
  springRange($("#tgAil",box),v=>ail=v); springRange($("#tgRud",box),v=>rud=v);
  $("#tgNew",box).onclick=newMission;
  $("#tgHelp",box).onclick=()=>{ help=!help; $("#tgHelp",box).classList.toggle("on",help); };
  const unkey=keyboard({ ArrowLeft:[()=>kA=-1,()=>kA=0], ArrowRight:[()=>kA=1,()=>kA=0], a:[()=>kR=-1,()=>kR=0], d:[()=>kR=1,()=>kR=0], r:[newMission] });
  return ()=>{ cancelAnimationFrame(raf); unkey(); };
}

/* ====================================================================== */
/*  Juegos 2 y 3 · Despegue y aterrizaje (vista de cabina)                 */
/* ====================================================================== */
const SKY=[[110,170,235],[196,222,244]], GRASS=[96,146,74], HAZE=[196,214,230];
const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const rgb=a=>"rgb("+(a[0]|0)+","+(a[1]|0)+","+(a[2]|0)+")";
function makeScenery(seed){
  let s=seed||7; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const trees=[], boxes=[];
  for(let z=-3200;z<3600;z+=26+r()*40){ [-1,1].forEach(sg=>{ if(r()<.55){ trees.push({x:sg*(60+r()*220),z:z+r()*20,h:7+r()*8}); } }); }
  for(let i=0;i<90;i++){ const sg=r()<.5?-1:1; trees.push({x:sg*(300+r()*1500),z:-3000+r()*6500,h:8+r()*10}); }
  boxes.push({x:-95,z:980,w:36,d:60,h:11,c:[190,196,204],roof:[120,60,50]},{x:-95,z:1060,w:30,d:40,h:9,c:[200,190,170],roof:[110,70,60]},{x:-140,z:900,w:22,d:22,h:8,c:[230,230,226],roof:[90,90,100]});
  trees.sort((a,b)=>b.z-a.z);
  return {trees,boxes};
}
function flightGame(box,mode){
  const takeoff=mode==="takeoff";
  $("#fsT",root).textContent=takeoff?"Despegue":"Aterrizaje";
  box.innerHTML=`<p class="fs-sub">${takeoff
    ? "Pista de 1.500 m, flaps 10°. <b>Gases a fondo</b>, mantén el eje, <b>rota a Vr ≈ 55 kt</b> tirando suave de la palanca y sube a <b>Vy ≈ 74 kt</b> hasta 500 ft. Debes cruzar el final de pista por encima de 50 ft."
    : "Final de 3° a unos 70 kt con flaps 20°. Guíate por el <b>PAPI</b> (2 rojas + 2 blancas = en senda). <b>Potencia = senda, palanca = velocidad.</b> Cerca del suelo, reduce gases y recoge suave (flare). Vref ≈ 62 kt."}</p>
  <div class="fs-stage"><canvas id="flC"></canvas></div>
  <div class="fs-ctl">
    <label>Gases<input type="range" id="flThr" min="0" max="100" value="${takeoff?0:50}"></label>
    <label>Palanca (← picar · cabrear →)<input type="range" id="flYoke" min="-100" max="100" value="0"></label>
  </div>
  <div class="fs-pad">
    <button class="fs-btn" id="flL">◀ Izq.</button><button class="fs-btn" id="flR">Der. ▶</button>
    <button class="fs-btn sec" id="flFlap">Flaps 10°</button>
    <button class="fs-btn sec" id="flBrk">Frenos</button>
    <button class="fs-btn ghost" id="flPause">Pausa</button><button class="fs-btn ghost" id="flNew">Reiniciar</button>
    ${takeoff?"":`<button class="fs-btn ghost" id="flWind">Viento cruzado: no</button>`}
  </div>
  <p class="fs-keys"><kbd>↑</kbd><kbd>↓</kbd> morro · <kbd>←</kbd><kbd>→</kbd> alabeo/dirección · <kbd>E</kbd><kbd>Q</kbd> gases · <kbd>F</kbd> flaps · <kbd>B</kbd> frenos · <kbd>C</kbd> centrar palanca · <kbd>P</kbd> pausa · <kbd>R</kbd> reiniciar</p>
  <div id="flOut"></div>`;
  const cv=$("#flC",box), W=960, H=540, c=fitCanvas(cv,W,H);
  const sc=makeScenery(takeoff?11:23);
  let sim, raf=0, last=0, paused=false, wind=0, kY=0, kA=0, brakeKey=0, msgT=0, msg="", over=false;
  const thr=$("#flThr",box), yoke=$("#flYoke",box);
  const FOC=W*0.95, CX=W/2, CY=H*0.40;
  function reset(){
    sim=FlightSim(mode,{cross:wind});
    if(!takeoff){ thr.value=Math.round(sim.thr*100); yoke.value=Math.round(clamp(sim.y,-1,1)*100); }
    else{ thr.value=0; yoke.value=0; sim.flap=1; }
    over=false; $("#flOut",box).innerHTML=""; msg=""; syncBtn();
  }
  function syncBtn(){ $("#flFlap",box).textContent="Flaps "+[0,10,20,30][sim.flap]+"°"; }
  /* ---- 3D ---- */
  let cam={x:0,y:0,z:0,psi:0,th:0,near:0.6};
  const toCam=(X,Y,Z)=>{ const dx=X-cam.x, dy=Y-cam.y, dz=Z-cam.z, cy=Math.cos(cam.psi), sy=Math.sin(cam.psi), cp=Math.cos(cam.th), sp=Math.sin(cam.th);
    const x1=dx*cy-dz*sy, z1=dx*sy+dz*cy; return [x1, dy*cp-z1*sp, dy*sp+z1*cp]; };
  const scr=p=>[CX+FOC*p[0]/p[2], CY-FOC*p[1]/p[2]];
  function clipNear(pts){ const out=[]; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length], ai=a[2]>=cam.near, bi=b[2]>=cam.near;
      if(ai) out.push(a); if(ai!==bi){ const t=(cam.near-a[2])/(b[2]-a[2]); out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),cam.near]); } } return out; }
  function poly(pts3,col,alpha){ const cp=clipNear(pts3.map(p=>toCam(p[0],p[1],p[2]))); if(cp.length<3) return; let zs=0; c.beginPath(); cp.forEach((p,i)=>{ const q=scr(p); zs+=p[2]; i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]); }); c.closePath();
    const hz=clamp((zs/cp.length)/7000,0,1)*0.65; c.globalAlpha=alpha==null?1:alpha; c.fillStyle=rgb(mix(col,HAZE,hz)); c.fill(); c.globalAlpha=1; }
  function line3(a,b,col,w,alpha){ let p=toCam(a[0],a[1],a[2]), q=toCam(b[0],b[1],b[2]); if(p[2]<cam.near&&q[2]<cam.near) return; if(p[2]<cam.near){ const t=(cam.near-p[2])/(q[2]-p[2]); p=[lerp(p[0],q[0],t),lerp(p[1],q[1],t),cam.near]; } else if(q[2]<cam.near){ const t=(cam.near-q[2])/(p[2]-q[2]); q=[lerp(q[0],p[0],t),lerp(q[1],p[1],t),cam.near]; }
    const s1=scr(p), s2=scr(q); c.globalAlpha=alpha==null?1:alpha; c.strokeStyle=col; c.lineWidth=w; c.beginPath(); c.moveTo(s1[0],s1[1]); c.lineTo(s2[0],s2[1]); c.stroke(); c.globalAlpha=1; }
  const rect=(x0,x1,z0,z1,col,y)=>poly([[x0,y||0,z0],[x1,y||0,z0],[x1,y||0,z1],[x0,y||0,z1]],col);
  function papiLights(){
    const pz=300, hl=Math.max(0,sim.h)+0.8;
    const dist=Math.max(5,pz-sim.z), el=Math.atan2(hl,dist)/D2R;       // elevación desde la luz
    const th=[3.5,3.17,2.83,2.5];                                         // i=0 junto a la pista (umbral más alto) … i=3 el más exterior
    return th.map(t=>({white:el>=t}));
  }
  function render(){
    // cámara: ojos 1,6 m sobre el tren principal
    cam.x=sim.x; cam.y=sim.h+1.6; cam.z=sim.z; cam.psi=sim.psi; cam.th=sim.th-0.02;
    c.save(); c.clearRect(0,0,W,H);
    // cielo y suelo con alabeo
    c.translate(CX,CY); c.rotate(-sim.phi); c.translate(-CX,-CY);
    const hy=CY+FOC*Math.tan(cam.th), B=2600;
    const g1=c.createLinearGradient(0,hy-420,0,hy); g1.addColorStop(0,rgb(SKY[0])); g1.addColorStop(1,rgb(SKY[1]));
    c.fillStyle=g1; c.fillRect(-B,hy-B,W+2*B,B+1);
    // montañas lejanas (desplazadas con el rumbo)
    const off=-cam.psi*FOC;
    c.fillStyle="#8fa6bd"; c.beginPath(); c.moveTo(-B,hy);
    for(let i=-30;i<=40;i++){ const xx=i*70+ (off%4900), yy=hy-30-24*Math.sin(i*1.7)-18*Math.sin(i*0.63+2); c.lineTo(xx,yy); } c.lineTo(W+B,hy); c.closePath(); c.fill();
    const g2=c.createLinearGradient(0,hy,0,hy+300); g2.addColorStop(0,rgb(mix(GRASS,HAZE,.6))); g2.addColorStop(.35,rgb(mix(GRASS,HAZE,.2))); g2.addColorStop(1,rgb(GRASS));
    c.fillStyle=g2; c.fillRect(-B,hy,W+2*B,B);
    // cuadrícula de campos
    for(let k=-12;k<=12;k++){ line3([k*250,0,cam.z-1500],[k*250,0,cam.z+9000],"#3e6a30",1,.22); }
    for(let zz=Math.floor((cam.z-300)/250)*250; zz<cam.z+9000; zz+=250){ line3([-3000,0,zz],[3000,0,zz],"#3e6a30",1,.18); }
    // pista
    const RW=15, L=sim.runL;
    rect(-RW-10,RW+10,-60,L+60,[88,98,84]);            // franja
    rect(-RW,RW,0,L,[62,64,68]);                        // asfalto
    rect(-RW,-RW+0.5,0,L,[240,240,240]); rect(RW-0.5,RW,0,L,[240,240,240]);
    for(let zz=20;zz<L-20;zz+=50) rect(-0.4,0.4,zz,zz+30,[240,240,240]);
    for(let i=-6;i<=6;i++){ if(i===0) continue; const cx=i*2.1; rect(cx-0.6,cx+0.6,6,36,[240,240,240]); rect(cx-0.6,cx+0.6,L-36,L-6,[240,240,240]); } // umbrales
    [-1,1].forEach(sg=>rect(sg*6-1.5,sg*6+1.5,300,345,[240,240,240]));
    [150,450].forEach(pz=>{ [-1,1].forEach(sg=>{ rect(sg*8-1,sg*8+1,pz,pz+22,[240,240,240]); rect(sg*11-1,sg*11+1,pz,pz+22,[240,240,240]); }); });
    rect(-RW,RW,L-1,L,[240,240,240]);
    // objetos (de lejos a cerca)
    const items=[]; sc.trees.forEach(t=>items.push({k:"t",o:t,d:toCam(t.x,0,t.z)[2]})); sc.boxes.forEach(b=>items.push({k:"b",o:b,d:toCam(b.x,0,b.z)[2]}));
    items.sort((a,b)=>b.d-a.d);
    items.forEach(it=>{
      if(it.d<cam.near+1) return;
      if(it.k==="t"){ const t=it.o, b=toCam(t.x,0,t.z), tp=toCam(t.x,t.h,t.z); const sb=scr(b), st=scr(tp), hh=sb[1]-st[1]; if(hh<1.5) return;
        const hz=clamp(it.d/7000,0,1)*0.65; c.fillStyle=rgb(mix([40,78,40],HAZE,hz)); c.beginPath(); c.ellipse(sb[0],sb[1]-hh*.6,hh*.22,hh*.4,0,0,TAU); c.fill();
        c.fillStyle=rgb(mix([80,60,40],HAZE,hz)); c.fillRect(sb[0]-hh*.025,sb[1]-hh*.25,hh*.05,hh*.25); }
      else{ const b=it.o, x0=b.x-b.w/2, x1=b.x+b.w/2, z0=b.z, z1=b.z+b.d;
        poly([[x0,0,z0],[x1,0,z0],[x1,b.h,z0],[x0,b.h,z0]],mix(b.c,[0,0,0],.12)); poly([[x1,0,z0],[x1,0,z1],[x1,b.h,z1],[x1,b.h,z0]],mix(b.c,[0,0,0],.28)); poly([[x0,0,z0],[x0,0,z1],[x0,b.h,z1],[x0,b.h,z0]],mix(b.c,[0,0,0],.22)); poly([[x0,b.h,z0],[x1,b.h,z0],[x1,b.h,z1],[x0,b.h,z1]],b.roof); }
    });
    // manga de viento
    { const wx=26, wz=250, top=toCam(wx,7,wz), bs=toCam(wx,0,wz); if(top[2]>cam.near){ const a=scr(bs), b=scr(top); c.strokeStyle="#ddd"; c.lineWidth=2; c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke();
        const sc2=FOC/top[2], dirx=(sim.cross||0)>0.5?1:(sim.cross||0)<-0.5?-1:0, len=(dirx?5:3)*sc2; c.fillStyle="#ff7a1a"; c.beginPath(); c.moveTo(b[0],b[1]); c.lineTo(b[0]+dirx*len,b[1]+(dirx?0.4:2)*sc2); c.lineTo(b[0]+dirx*len,b[1]+(dirx?2.0:3.2)*sc2); c.lineTo(b[0],b[1]+0.9*sc2); c.closePath(); c.fill(); } }
    // PAPI
    papiLights().forEach((l,i)=>{ const p=toCam(-RW-8-i*3.2,0.8,300); if(p[2]<cam.near) return; const q=scr(p), rr=Math.max(3,FOC*1.6/p[2]); c.fillStyle=l.white?"#ffffff":"#ff2d1a"; c.shadowColor=l.white?"#fff":"#ff2d1a"; c.shadowBlur=rr*2; c.beginPath(); c.arc(q[0],q[1],rr,0,TAU); c.fill(); c.shadowBlur=0; });
    c.restore();
    cockpit();
  }
  function cockpit(){
    // capó / panel
    const py=H-168;
    c.fillStyle="#141a20"; c.fillRect(0,py,W,168);
    c.fillStyle="#222b33"; c.fillRect(0,py,W,4);
    c.beginPath(); c.moveTo(0,py); c.lineTo(W*.22,py-26); c.lineTo(W*.78,py-26); c.lineTo(W,py); c.closePath(); c.fillStyle="#1a2128"; c.fill();
    drawASI(c,W*.2,py+84,66,sim.ias());
    drawAI(c,W*.5,py+84,66,sim.phi,sim.th);
    drawALT(c,W*.8,py+84,66,sim.h*FT,sim.vs()*FT*60);
    c.fillStyle="#cfd6dc"; c.font="600 13px system-ui,sans-serif"; c.textAlign="left";
    c.fillText("GASES "+Math.round(sim.thr*100)+" %",14,py+30); c.fillText("FLAPS "+[0,10,20,30][sim.flap]+"°",14,py+50); c.fillText(sim.brake?"FRENOS":"",14,py+70);
    c.textAlign="right"; c.fillText("RUMBO "+String(Math.round(((270+sim.psi/D2R)%360+360)%360)||360).padStart(3,"0"),W-14,py+30);
    c.textAlign="left"; c.fillStyle="#e3ecf2"; c.font="700 14px system-ui,sans-serif";
    const rows=[]; rows.push(takeoff?`Pista restante ${Math.max(0,Math.round(sim.runL-sim.z))} m`:`Dist. a umbral ${Math.round(-sim.z)} m`);
    if(sim.ground) rows.push(`Velocidad ${Math.round(sim.ias())} kt`);
    c.fillText(rows.join("   ·   "),14,22);
    if(sim.stall||(!sim.ground&&sim.ias()<sim.stallV(sim.fl())+4)){ c.textAlign="center"; c.fillStyle=sim.stall?"#ff3b30":"#ffb300"; c.font="800 26px system-ui,sans-serif"; c.fillText(sim.stall?"STALL":"VELOCIDAD BAJA",CX,66); }
    if(!takeoff){ const pl=papiLights(); c.fillStyle="rgba(0,0,0,.55)"; c.fillRect(W-132,36,118,46); pl.slice().reverse().forEach((l,i)=>{ c.beginPath(); c.arc(W-112+i*26,54,9,0,TAU); c.fillStyle=l.white?"#fff":"#ff2d1a"; c.fill(); });
      c.fillStyle="#cfd6dc"; c.font="600 11px system-ui,sans-serif"; c.textAlign="center"; c.fillText("PAPI",W-73,76); }
    if(msg&&msgT>0){ c.textAlign="center"; c.fillStyle="rgba(0,0,0,.55)"; c.fillRect(CX-260,H-215,520,30); c.fillStyle="#fff"; c.font="600 15px system-ui,sans-serif"; c.fillText(msg,CX,H-194); }
  }
  function say(t,s){ msg=t; msgT=s||2.5; }
  /* ---- fin y resultado ---- */
  function finish(){
    if(over) return; over=true;
    const out=[]; let score=0, title="";
    if(takeoff){
      if(sim.crash){ title="Despegue fallido"; out.push("<span class='fs-bad'>"+sim.crash+"</span>"); }
      else{
        const lo=sim.liftoff||{V:0,z:0}, endH=sim.endH==null?0:sim.endH*FT, V=sim.ias();
        let p=0;
        const vrOK=lo.V>=50&&lo.V<=62; p+=vrOK?30:lo.V<50?10:15; out.push(`Despegaste a <b>${lo.V.toFixed(0)} kt</b> tras ${Math.round(lo.z)} m ${vrOK?"<span class='fs-ok'>✔ rotación a Vr (≈55 kt)</span>":lo.V<50?"<span class='fs-bad'>· demasiado pronto: cerca de la pérdida</span>":"<span class='fs-mid'>· tarde: gastas pista</span>"}.`);
        const obs=endH>=50; p+=obs?25:endH>=20?10:0; out.push(`Altura al final de pista: <b>${Math.round(endH)} ft</b> ${obs?"<span class='fs-ok'>✔ más de 50 ft</span>":"<span class='fs-bad'>· menos de 50 ft: obstáculo en riesgo</span>"}.`);
        const vyOK=V>=68&&V<=80; p+=vyOK?25:V>=62?12:0; out.push(`Velocidad a 500 ft: <b>${V.toFixed(0)} kt</b> ${vyOK?"<span class='fs-ok'>✔ cerca de Vy (74 kt)</span>":"<span class='fs-mid'>· Vy da el mejor régimen de ascenso (74 kt)</span>"}.`);
        const cl=Math.abs(sim.x)<=7; p+=cl?20:Math.abs(sim.x)<=15?10:0; out.push(`Desviación del eje: <b>${Math.abs(sim.x).toFixed(0)} m</b> ${cl?"<span class='fs-ok'>✔</span>":""}.`);
        score=p; title=p>=80?"Despegue limpio":"Despegue completado";
      }
    } else {
      const td=sim.td;
      if(sim.crash||!td){ title="Aterrizaje fallido"; out.push("<span class='fs-bad'>"+(sim.crash||"No llegaste a tocar la pista.")+"</span>"); }
      else{
        const fpm=td.vs*FT*60, Vt=td.V;
        const sink=Math.round(35*clamp(1-(td.vs-1.3)/1.7,0,1));
        const err=Math.abs(td.z-300), pp=Math.round(25*clamp(1-(err-150)/300,0,1));
        const lat=Math.abs(td.x), lp=Math.round(15*clamp(1-(lat-3)/9,0,1));
        const dv=Vt<50?50-Vt:Vt>66?Vt-66:0, sp=Math.round(15*clamp(1-dv/20,0,1));
        const rl=sim.stopped&&sim.z<sim.runL&&Math.abs(sim.x)<20?10:0;
        score=sink+pp+lp+sp+rl;
        out.push(`Velocidad vertical al tocar: <b>${Math.round(fpm)} fpm</b> ${td.vs<=1.3?"<span class='fs-ok'>✔ suave</span>":td.vs<=2.5?"<span class='fs-mid'>· algo dura</span>":"<span class='fs-bad'>· dura</span>"}.`);
        out.push(`Punto de toma: <b>${Math.round(td.z)} m</b> del umbral ${td.z<0?"<span class='fs-bad'>· ANTES del umbral</span>":err<=150?"<span class='fs-ok'>✔ en la zona de toma (punto de visada a 300 m)</span>":td.z<150?"<span class='fs-mid'>· corto</span>":"<span class='fs-mid'>· largo</span>"}.`);
        out.push(`Velocidad al tocar: <b>${Vt.toFixed(0)} kt</b> (en final, Vref ≈ 62 kt; en el flare pierdes unos nudos) ${dv===0?"<span class='fs-ok'>✔</span>":Vt>66?"<span class='fs-mid'>· rápido: más recorrido y riesgo de rebote</span>":"<span class='fs-mid'>· lento: demasiado cerca de la pérdida (≈47 kt con flaps 20°)</span>"}.`);
        out.push(`Desviación del eje: <b>${lat.toFixed(0)} m</b> ${lat<=3?"<span class='fs-ok'>✔</span>":lat>15?"<span class='fs-bad'>· fuera de pista</span>":""}.`);
        out.push(sim.stopped?(rl?"Frenaste dentro de la pista <span class='fs-ok'>✔</span>.":"Te saliste de la pista al frenar."):"Aún rodando.");
        if(sim.bounces) out.push(`Rebotes: ${sim.bounces} (toque con demasiada velocidad vertical: espera en el flare).`);
        title=score>=80?"Aterrizaje excelente":score>=55?"Aterrizaje correcto":"Aterrizaje a mejorar";
      }
    }
    const best=store.best(takeoff?"takeoff":"landing",Math.round(score));
    $("#flOut",box).innerHTML=`<div class="fs-out"><h3>${title}</h3><div class="big ${score>=70?"fs-ok":score>=40?"fs-mid":"fs-bad"}">${Math.round(score)} <small style="font:600 14px system-ui">puntos · mejor ${best==null?"—":best}</small></div><ul>${out.map(t=>"<li>"+t+"</li>").join("")}</ul></div>`;
  }
  /* ---- bucle ---- */
  let acc=0;
  function frame(t){
    raf=requestAnimationFrame(frame);
    const dt=Math.min(0.1,(t-last)/1000||0.016); last=t;
    if(!paused&&!over){
      sim.thr=+thr.value/100;
      sim.y=clamp(+yoke.value/100,-1,1);
      sim.ail=clamp(kA,-1,1); sim.brake=brakeKey?1:0;
      acc+=dt; let n=0; while(acc>=1/120&&n<20){ sim.step(1/120); acc-=1/120; n++; }
      msgT-=dt;
      if(!takeoff&&sim.td&&!sim.tdSaid){ sim.tdSaid=1; say("Toma de contacto · frena con B",3); }
      if(takeoff&&sim.liftoff&&!sim.loSaid){ sim.loSaid=1; say("Despegue a "+sim.liftoff.V.toFixed(0)+" kt · sube a Vy",3); }
      if(!takeoff&&!sim.td&&!sim.crash){
        if(sim.h>260){ sim.crash="Aproximación interrumpida: subiste sin llegar a aterrizar."; sim.done=true; }
        else if(sim.z>sim.runL){ sim.crash="Pasaste el final de la pista sin tocar."; sim.done=true; }
      }
      if(takeoff&&sim.ground&&!sim.liftoff&&sim.ias()>=48&&!sim.rotSaid){ sim.rotSaid=1; say("Vr: tira suave de la palanca",3); }
      if(sim.crash||sim.done) finish();
    }
    render();
  }
  reset(); raf=requestAnimationFrame(frame);
  const yTimer=setInterval(()=>{ if(kY!==0&&!paused){ yoke.value=clamp(+yoke.value+kY*6,-100,100); } },50);
  // flechas arriba/abajo mueven la palanca de forma sostenida; no se centra al soltar
  const unkey=keyboard({
    ArrowUp:[()=>kY=1,()=>kY=0], ArrowDown:[()=>kY=-1,()=>kY=0], ArrowLeft:[()=>kA=-1,()=>kA=0], ArrowRight:[()=>kA=1,()=>kA=0],
    e:[()=>thr.value=clamp(+thr.value+4,0,100),null,()=>thr.value=clamp(+thr.value+4,0,100)], q:[()=>thr.value=clamp(+thr.value-4,0,100),null,()=>thr.value=clamp(+thr.value-4,0,100)],
    f:[()=>{ sim.flap=(sim.flap+1)%4; syncBtn(); }], b:[()=>brakeKey=1,()=>brakeKey=0], " ":[()=>brakeKey=1,()=>brakeKey=0],
    c:[()=>yoke.value=0], p:[()=>{ paused=!paused; $("#flPause",box).textContent=paused?"Seguir":"Pausa"; }], r:[()=>reset()]
  });
  holdBtn($("#flL",box),()=>kA=-1,()=>kA=0); holdBtn($("#flR",box),()=>kA=1,()=>kA=0);
  holdBtn($("#flBrk",box),()=>brakeKey=1,()=>brakeKey=0);
  $("#flFlap",box).onclick=()=>{ sim.flap=(sim.flap+1)%4; syncBtn(); };
  $("#flPause",box).onclick=()=>{ paused=!paused; $("#flPause",box).textContent=paused?"Seguir":"Pausa"; };
  $("#flNew",box).onclick=reset;
  const wb=$("#flWind",box); if(wb) wb.onclick=()=>{ wind=wind?0:(Math.random()<.5?-1:1)*5; wb.textContent="Viento cruzado: "+(wind?(wind>0?"de la izquierda · 10 kt":"de la derecha · 10 kt"):"no"); reset(); };
  const vis=()=>{ if(document.hidden) paused=true; }; document.addEventListener("visibilitychange",vis);
  window.__f0simDebug=()=>sim;
  return ()=>{ cancelAnimationFrame(raf); clearInterval(yTimer); unkey(); document.removeEventListener("visibilitychange",vis); };
}

/* ====================================================================== */
/*  Juego 4 · ¿Giroscópico o de presión?                                   */
/* ====================================================================== */
const SORT_ITEMS=[
 ["Airspeed indicator","P","Mide presión total (pitot) frente a presión estática."],
 ["Altimeter","P","Presión estática y cápsula aneroide."],
 ["Vertical speed indicator","P","Variación de la presión estática: pies por minuto."],
 ["Machmeter","P","Es un instrumento de presión: compara presión total y estática."],
 ["Attitude indicator","G","Giróscopo tipo earth gyro, eje vertical, pitch y roll."],
 ["Directional gyro (heading indicator)","G","Giróscopo con eje horizontal: rumbo estable, hay que sincronizarlo."],
 ["Turn coordinator","G","Rate gyro con un grado de libertad (más la bola)."],
 ["Turn and slip indicator","G","Rate gyro: régimen de viraje (más la bola)."],
 ["Artificial horizon","G","Es el attitude indicator: giróscopo."],
 ["Direct-reading magnetic compass","M","Un imán alineado con el campo magnético: sin giróscopo ni presión."],
 ["Suction gauge (vacuum)","P","Mide la presión de la succión que mueve los giróscopos; es un manómetro, no un giróscopo."],
 ["Slip ball (inclinometer)","M","Un péndulo: acelerómetro sencillo; ni giróscopo ni presión."]
];
function sortGame(box){
  $("#fsT",root).textContent="¿Giroscópico o de presión?";
  box.innerHTML=`<p class="fs-sub">Diez instrumentos. Di si funciona con un <b>giróscopo</b>, con <b>presión</b> (pitot-estática o manómetro), o con <b>otro principio</b> (imán, péndulo…). Pregunta típica de clase.</p>
  <div class="fs-prog"><i id="soP" style="width:0"></i></div>
  <div class="fs-q" id="soQ"></div>
  <div class="fs-card3">
    <button class="fs-bin" data-a="G">Giroscópico<small>attitude · DI · turn</small></button>
    <button class="fs-bin" data-a="P">De presión<small>ASI · altímetro · VSI…</small></button>
    <button class="fs-bin" data-a="M">Otro principio<small>imán, péndulo…</small></button>
  </div>
  <div class="fs-fb" id="soF"></div><div id="soOut"></div>`;
  let list=[], i=0, ok=0, lock=false, t0=0;
  const names={G:"Giroscópico",P:"De presión",M:"Otro principio"};
  function start(){ list=SORT_ITEMS.slice().sort(()=>Math.random()-.5).slice(0,10); i=0; ok=0; lock=false; t0=Date.now(); $("#soOut",box).innerHTML=""; $("#soF",box).textContent=""; show(); }
  function show(){ $("#soQ",box).textContent=list[i][0]; $("#soP",box).style.width=(100*i/list.length)+"%"; }
  box.querySelectorAll(".fs-bin").forEach(b=>b.onclick=()=>{
    if(lock||i>=list.length) return; lock=true;
    const it=list[i], good=b.dataset.a===it[1]; if(good) ok++;
    $("#soF",box).innerHTML=(good?"<b class='fs-ok'>Correcto.</b> ":"<b class='fs-bad'>No: es "+names[it[1]].toLowerCase()+".</b> ")+esc(it[2]);
    setTimeout(()=>{ lock=false; i++; if(i>=list.length){ done(); } else { $("#soF",box).textContent=""; show(); } }, good?900:2300);
  });
  function done(){
    const sec=Math.round((Date.now()-t0)/1000), sc=Math.max(0,Math.round(ok*10-Math.max(0,sec-60)/6));
    const best=store.best("sort",sc);
    $("#soP",box).style.width="100%"; $("#soQ",box).textContent="";
    $("#soOut",box).innerHTML=`<div class="fs-out"><div class="big ${ok>=9?"fs-ok":ok>=7?"fs-mid":"fs-bad"}">${ok}/10 <small style="font:600 14px system-ui">${sc} puntos · mejor ${best}</small></div><ul><li>Giroscópicos: horizonte artificial, giro direccional y turn coordinator.</li><li>De presión: anemómetro, altímetro, variómetro y machmeter.</li><li>La brújula magnética y la bola no llevan giróscopo.</li></ul><p><button class="fs-btn" id="soAgain">Otra ronda</button></p></div>`;
    $("#soAgain",box).onclick=start;
  }
  start();
  return ()=>{};
}

window.F0Sim={ render(el){ root=el; injectCss(); menu(); }, leave(){ if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; } }, _TurnSim:TurnSim, _FlightSim:FlightSim };
})();
