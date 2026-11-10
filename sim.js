/* ATPL Fase 0 · SIM — minijuegos de vuelo. Sin cuenta, sin servidor: todo corre en el navegador.
   1) Rodaje: sigue las instrucciones de la torre por las calles de rodaje de un aeródromo (vista cenital).
   2) Despegue y 3) Aterrizaje: vista de cabina con perspectiva y un modelo de vuelo sencillo de monomotor ligero.
   4) Vectores: vuela rumbos y altitudes a lo largo de una ruta de puntos.
   Mandos táctiles: yoke tipo Boeing o sidestick tipo Airbus, palanca de gases y botones; teclado y ratón también valen.
   API: F0Sim.render(el) · F0Sim.leave() */
(function(){
"use strict";
const D2R=Math.PI/180, KT=0.514444, FT=3.28084, G=9.81, TAU=Math.PI*2, NM=1852;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const wrap180=a=>{ a=(a+180)%360; if(a<0) a+=360; return a-180; };
const store={ get(){ try{ return JSON.parse(localStorage.getItem("f0:sim")||"{}")||{}; }catch(e){ return {}; } },
  put(k,v){ const o=this.get(); o[k]=v; try{ localStorage.setItem("f0:sim",JSON.stringify(o)); }catch(e){} },
  best(k,v){ const o=this.get(); if(v!=null&&(o[k]==null||v>o[k])){ o[k]=v; try{ localStorage.setItem("f0:sim",JSON.stringify(o)); }catch(e){} } return o[k]; } };
let root=null, stopFn=null, relayout=null, curCtl=null;
const dbg={ g:null, sim:null, inp:null };       // gancho de pruebas: window.__f0simDebug()

/* ====================================================================== */
/*  Física de vuelo (monomotor ligero, plano vertical + viraje)            */
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
  s.trim=function(V,gam,flap){          // palanca y gases para equilibrio (para arrancar la final o el vuelo de crucero)
    const f=flap/3, q=0.5*RHO*V*V*S, cl=W*Math.cos(gam)/q, a=(cl-CL0(f))/5;
    const d=q*CD(cl,a,f), T=d+W*Math.sin(gam);
    return { y:(a-A0)/0.22, thr:clamp(T/Tmax(V)+0.08,0,1), al:a };
  };
  if(mode==="landing"){
    const V=o.V||36, g=-3*D2R, f=2; s.flap=f;
    s.z=o.z0||-2300; s.h=(300-s.z)*Math.tan(3*D2R)-0.8; s.V=V; s.gam=g;
    s.x=o.x0!=null?o.x0:(Math.random()<.5?-1:1)*(15+Math.random()*30); s.psi=o.psi0!=null?o.psi0:0;
    const t=s.trim(V,g,f); s.y=t.y; s.thr=t.thr; s.al=t.al; s.th=g+t.al; s.ground=false;
  } else if(mode==="air"){
    const V=o.V||46; s.V=V; s.h=o.h0||600; s.flap=0; s.gam=0; s.z=0; s.x=0; s.psi=o.psi0||0;
    const t=s.trim(V,0,0); s.y=t.y; s.thr=t.thr; s.al=t.al; s.th=t.al; s.ground=false;
  } else { s.z=10; s.h=0; s.V=0; s.ground=true; }
  s.step=function(dt){
    if(s.done) return;
    const f=s.fl(), V=Math.max(s.V,0.01);
    s.t+=dt;
    const q=0.5*RHO*V*V*S;
    if(!s.ground){
      const p = mode==="air" ? (s.ail*30*D2R - s.phi)/0.7 : s.ail*0.5-0.25*s.phi;   // en ruta el mando fija el ángulo de alabeo
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
        if(s.mode==="air"){ s.crash="Has tocado el suelo: mantén la altitud."; s.done=true; return; }
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
/*  CSS                                                                    */
/* ====================================================================== */
function injectCss(){
  if($("#f0sim-css")) return;
  const st=document.createElement("style"); st.id="f0sim-css";
  st.textContent=`
.fs{max-width:1040px;margin:0 auto;padding:14px 16px 30px;color:var(--ink)}
.fs h2{font:700 24px/1.2 var(--display,inherit);margin:4px 0 4px}
.fs .fs-sub{color:var(--muted);margin:0 0 14px;max-width:70ch}
.fs-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.fs-card{display:flex;flex-direction:column;gap:8px;text-align:left;font:inherit;color:inherit;border:1px solid var(--line);border-top:4px solid var(--c,#1D6FB0);background:var(--paper);border-radius:10px;padding:14px 16px;cursor:pointer;min-width:0}
.fs-card:hover,.fs-card:focus-visible{box-shadow:0 4px 14px rgba(20,48,74,.18);outline:none}
.fs-th{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#0b1620;display:block}
.fs-card b{font:700 18px/1.2 var(--display,inherit)}
.fs-card span{color:var(--muted);font-size:14px}
.fs-card i{font-style:normal;font-size:12.5px;color:var(--muted);margin-top:auto}
.fs-opt{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0 0;font-size:14px;color:var(--muted)}
.fs-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.fs-seg button{font:600 14px var(--display,inherit);border:0;background:var(--paper);color:var(--ink);padding:9px 14px;cursor:pointer;min-height:40px}
.fs-seg button[aria-pressed=true]{background:var(--ink);color:var(--paper)}
.fs-btn{border:1px solid var(--ink);background:var(--ink);color:var(--paper);border-radius:8px;padding:9px 14px;font:600 14px/1 var(--display,inherit);cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;min-height:40px}
.fs-btn.sec{background:transparent;color:var(--ink)}
.fs-btn:active,.fs-btn.on{filter:brightness(1.25)}
/* ---- pantalla de juego: ocupa todo el visor, nunca se corta ---- */
.fs-full{position:fixed;left:0;top:0;width:100%;z-index:35;background:#0b1620;color:#e8f0f6;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.fs-top{flex:none;display:flex;align-items:center;gap:8px;padding:6px 8px;min-height:44px;box-sizing:border-box}
.fs-top b{font:700 17px var(--display,inherit);letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs-top .sp{flex:1}
.fs-full .fs-btn{background:#1d2c3a;color:#e8f0f6;border-color:#344a5e}
.fs-full .fs-btn.ghost{background:transparent}
.fs-full .fs-btn.on{background:#2b6a8f;border-color:#5fb3e0}
.fs-body{flex:1;min-height:0;display:flex;gap:8px;padding:0 8px 8px;box-sizing:border-box;align-items:center;justify-content:center}
.fs-full.port .fs-body{flex-direction:column}
.fs-view{position:relative;flex:none;border:1px solid #243645;border-radius:10px;overflow:hidden;background:#0b1620}
.fs-view canvas{display:block;touch-action:none}
.fs-panel{flex:none;display:flex;gap:10px;box-sizing:border-box;overflow:hidden}
.fs-full.land .fs-panel{flex-direction:column;align-items:center}
.fs-full.port .fs-panel{flex-direction:row;align-items:stretch;justify-content:center}
.fs-padw{position:relative;flex:none;width:var(--pad);height:var(--pad);display:flex;gap:6px}
.fs-row2{display:flex;gap:10px;min-height:0;min-width:0;flex:1;align-items:stretch}
.fs-full.land .fs-row2{width:100%;flex:1 1 auto}
.fs-btns{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;justify-content:flex-start;overflow:hidden}
.fs-btns .fs-btn{width:100%;min-height:42px;padding:8px 6px;font-size:14px;white-space:normal;line-height:1.1}
.fs-lab{font:600 11px var(--body,inherit);color:#8aa3b8;letter-spacing:.08em;text-transform:uppercase;text-align:center}
.pad2{position:relative;flex:1;aspect-ratio:1/1;touch-action:none;cursor:grab}
.pad2 svg{width:100%;height:100%;display:block}
.pgauge{flex:none;width:12px;border-radius:6px;background:#15212c;border:1px solid #2b4054;position:relative}
.pgauge i{position:absolute;left:-3px;right:-3px;height:6px;border-radius:3px;background:#ffc247;top:50%;margin-top:-3px}
.pgauge span{position:absolute;left:50%;width:6px;margin-left:-3px;height:1px;background:#4a6378}
.lev{position:relative;flex:none;width:62px;height:var(--lev);touch-action:none;cursor:pointer}
.lev .tr{position:absolute;left:21px;width:20px;top:6px;bottom:6px;border-radius:10px;background:#15212c;border:1px solid #2b4054}
.lev .fl{position:absolute;left:23px;width:16px;bottom:8px;border-radius:8px;background:linear-gradient(0deg,#2b8f6d,#5fd0a6)}
.lev .hd{position:absolute;left:3px;width:56px;height:30px;margin-top:-15px;border-radius:8px;background:linear-gradient(180deg,#e9eef2,#aeb8c0);border:1px solid #64727d;box-shadow:0 3px 6px rgba(0,0,0,.5)}
.lev .hd:before,.lev .hd:after{content:"";position:absolute;left:10px;right:10px;height:2px;background:#6b7782;top:11px}
.lev .hd:after{top:17px}
.lev .pc{display:none;position:absolute;left:0;right:0;bottom:-14px;text-align:center;font:700 12px var(--body,inherit);color:#cfe2ef}
.tiller{position:relative;flex:1;min-width:120px;height:64px;border-radius:32px;background:#15212c;border:1px solid #2b4054;touch-action:none;cursor:grab}
.tiller i{position:absolute;top:6px;left:50%;width:52px;height:52px;margin-left:-26px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#f4f7fa,#98a6b1);border:1px solid #64727d;box-shadow:0 3px 6px rgba(0,0,0,.5)}
.tiller:before{content:"";position:absolute;left:50%;top:10px;bottom:10px;width:2px;background:#2f4559}
.fs-res{position:absolute;inset:0;background:rgba(7,14,21,.84);overflow:auto;padding:14px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
.fs-res[hidden]{display:none}
.fs-res h3{margin:0;font:700 22px/1.2 var(--display,inherit)}
.fs-res .big{font:700 40px/1 var(--display,inherit)}
.fs-res ul{margin:0;padding:0;list-style:none;text-align:left;max-width:520px;font-size:14.5px;line-height:1.4}
.fs-res li{margin:4px 0}
.fs-res .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.fs-ok{color:#4fd08c}.fs-bad{color:#ff7a6b}.fs-mid{color:#f0b84a}
.fs-hint{position:absolute;left:8px;right:8px;bottom:6px;text-align:center;font:600 12px var(--body,inherit);color:#aebfcd;pointer-events:none}
.fs-hud{position:absolute;left:6px;right:6px;top:6px;pointer-events:none;display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.fs-hud>div{background:rgba(6,12,18,.66);border-radius:6px;padding:3px 8px;text-shadow:0 1px 2px #000;max-width:100%;box-sizing:border-box}
.fs-hud .l0{display:flex;gap:12px;font:700 14px/1.3 var(--body,inherit);flex-wrap:wrap}
.fs-hud .l0 b{color:#ffc247}.fs-hud .bad{color:#ff7a6b}
.fs-hud .l1{font:700 15px/1.3 var(--body,inherit)}
.fs-hud .l2{font:500 13px/1.3 var(--body,inherit);color:#c3d6e4}
.fs-hud .l3{font:600 13px/1.3 var(--body,inherit);color:#8ff0c0}
.fs-hud .warn{font:800 17px/1.3 var(--display,inherit);color:#fff;background:rgba(200,40,30,.85);align-self:center}
.fs-hud .warn.mid{background:rgba(200,130,10,.85)}
.fs-toast{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);max-width:92%;background:rgba(6,12,18,.82);border:1px solid #344a5e;border-radius:8px;padding:6px 12px;font:600 14px/1.3 var(--body,inherit);text-align:center;pointer-events:none;z-index:2}
.fs-toast[hidden]{display:none}
.fs-full.port .fs-panel.tl{flex-direction:column}
.fs-full.cmp .fs-btns .fs-btn{min-height:34px;font-size:13px;padding:5px 4px}
.fs-full.cmp .fs-top{min-height:38px;padding:3px 6px}
.fs-full.cmp .fs-top .fs-btn{min-height:32px;padding:6px 10px}
.fs-full .fs-seg button{background:#1d2c3a;color:#e8f0f6}
.fs-full .fs-seg button[aria-pressed=true]{background:#2b6a8f}
@media (max-width:560px){.fs-hud .l1{font-size:13.5px}.fs-hud .l2{font-size:12px}.fs-hud .l0,.fs-hud .l3{font-size:12.5px}.fs-toast{font-size:13px}}
@media (prefers-reduced-motion:reduce){.fs-res{scroll-behavior:auto}}
`;
  document.head.appendChild(st);
}

/* ====================================================================== */
/*  Menú                                                                   */
/* ====================================================================== */
function menu(){
  if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; }
  const b=store.get(), ctl=b.ctl==="stick"?"stick":"yoke";
  const bt=k=>b[k]!=null?`Mejor: ${b[k]} puntos`:"Sin jugar todavía";
  root.innerHTML=`<div class="fs">
    <h2>Sim</h2>
    <p class="fs-sub">Cuatro retos para sentir lo que estudias. Se juega a pantalla completa con el dedo, el ratón o el teclado.</p>
    <div class="fs-menu">
      <button class="fs-card" data-g="taxi" style="--c:#C99A12"><img class="fs-th" src="sim-taxi.webp" alt="" loading="lazy" onerror="this.remove()"><b>🛣️ Rodaje</b><span>La torre te da la ruta por las calles de rodaje: sigue las letras, gira donde toca y para en el punto de espera.</span><i>${bt("taxi")}</i></button>
      <button class="fs-card" data-g="takeoff" style="--c:#B8500A"><img class="fs-th" src="sim-takeoff.webp" alt="" loading="lazy" onerror="this.remove()"><b>🛫 Despegue</b><span>Gases a fondo, mantén el eje, rota a Vr y sube a 500 ft a Vy.</span><i>${bt("takeoff")}</i></button>
      <button class="fs-card" data-g="landing" style="--c:#2A7A40"><img class="fs-th" src="sim-landing.webp" alt="" loading="lazy" onerror="this.remove()"><b>🛬 Aterrizaje</b><span>Final de 3°, guíate por el PAPI y recoge en el flare. Con viento cruzado si quieres.</span><i>${bt("landing")}</i></button>
      <button class="fs-card" data-g="vectors" style="--c:#0B747E"><img class="fs-th" src="sim-vectors.webp" alt="" loading="lazy" onerror="this.remove()"><b>🧭 Vectores</b><span>Sigue los rumbos y las altitudes del controlador por una ruta de puntos.</span><i>${bt("vectors")}</i></button>
    </div>
    <div class="fs-opt">Mando en pantalla:
      <span class="fs-seg" role="group" aria-label="Tipo de mando"><button data-c="yoke" aria-pressed="${ctl==="yoke"}">Yoke Boeing</button><button data-c="stick" aria-pressed="${ctl==="stick"}">Sidestick Airbus</button></span>
    </div>
  </div>`;
  root.querySelectorAll("[data-g]").forEach(bn=>bn.onclick=()=>openGame(bn.dataset.g));
  root.querySelectorAll("[data-c]").forEach(bn=>bn.onclick=()=>{ store.put("ctl",bn.dataset.c); menu(); });
}

/* ---- inclinar el dispositivo (acelerómetro / giroscopio): hace de yoke ---- */
function tiltSupported(){ return typeof window.DeviceOrientationEvent!=="undefined" && ((navigator.maxTouchPoints||0)>0 || "ontouchstart" in window); }
function makeTilt(ctx,btn,calBtn){
  const st={ on:false, cal:true, r0:0, p0:0, got:false, timer:0 };
  const h=e=>{
    if(e.beta==null||e.gamma==null) return; st.got=true;
    const b=e.beta*D2R, g=e.gamma*D2R, u=[-Math.cos(b)*Math.sin(g), Math.sin(b), Math.cos(b)*Math.cos(g)];     // vertical (hacia arriba) en ejes del aparato
    const a=(((window.screen&&screen.orientation&&screen.orientation.angle!=null)?screen.orientation.angle:(window.orientation||0)))*D2R;
    const rr=u[0]*Math.cos(a)-u[1]*Math.sin(a), ru=u[0]*Math.sin(a)+u[1]*Math.cos(a), psi=Math.atan2(u[2],ru);
    if(st.cal){ st.r0=rr; st.p0=psi; st.cal=false; }
    const dz=v=>Math.abs(v)<0.06?0:v-Math.sign(v)*0.06;
    const x=clamp(dz(-(rr-st.r0)/Math.sin(30*D2R)),-1,1), y=clamp(dz((st.p0-psi)/(18*D2R)),-1,1);
    st.x=x; st.y=y; if(curCtl&&curCtl.tilt) curCtl.tilt(x,y);
  };
  st.h=h;
  const paintBtn=()=>{ btn.textContent=st.on?"Inclinar: sí":"Inclinar"; btn.classList.toggle("on",st.on); calBtn.hidden=!st.on; };
  st.off=()=>{ if(st.on){ window.removeEventListener("deviceorientation",h); st.on=false; clearTimeout(st.timer); if(curCtl&&curCtl.tilt) curCtl.tilt(0,0); } paintBtn(); };
  async function enable(){
    try{ if(typeof DeviceOrientationEvent.requestPermission==="function"){ const r=await DeviceOrientationEvent.requestPermission(); if(r!=="granted"){ toast(ctx,"Permiso denegado. En iPad: Ajustes › Safari › Movimiento y orientación.",5); return; } } }
    catch(e){ toast(ctx,"No se pudo activar el sensor de movimiento.",4); return; }
    st.got=false; st.cal=true; window.addEventListener("deviceorientation",h); st.on=true; paintBtn();
    toast(ctx,"Sujeta el iPad como un yoke: gíralo para alabear, inclínalo para cabecear. Centrado fijado.",5);
    st.timer=setTimeout(()=>{ if(!st.got){ toast(ctx,"Este dispositivo no envía datos de movimiento.",4); st.off(); } },2000);
  }
  btn.onclick=()=>{ st.on?st.off():enable(); };
  calBtn.onclick=()=>{ st.cal=true; toast(ctx,"Centrado: esta es tu posición neutra.",2); };
  paintBtn(); dbg.tilt=st; return st;
}
const TITLES={taxi:"Rodaje",takeoff:"Despegue",landing:"Aterrizaje",vectors:"Vectores"};
function openGame(g){
  if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; }
  root.innerHTML=`<div class="fs-full" id="fsFull">
    <div class="fs-top"><button class="fs-btn ghost" id="fsBack">← Sim</button><b>${esc(TITLES[g])}</b><span class="sp"></span><button class="fs-btn ghost" id="fsCal" hidden>Centrar</button><button class="fs-btn ghost" id="fsTilt" hidden>Inclinar</button><button class="fs-btn ghost" id="fsPause">Pausa</button><button class="fs-btn ghost" id="fsNew">Reiniciar</button></div>
    <div class="fs-body"><div class="fs-view" id="fsView"><canvas id="fsC"></canvas><div class="fs-hud" id="fsHud"></div><div class="fs-toast" id="fsToast" hidden></div><div class="fs-res" id="fsRes" hidden></div></div><div class="fs-panel" id="fsPanel"></div></div>
  </div>`;
  const full=$("#fsFull",root);
  const ctx={ full, view:$("#fsView",root), cv:$("#fsC",root), panel:$("#fsPanel",root), res:$("#fsRes",root), hud:$("#fsHud",root), toast:$("#fsToast",root), pauseBtn:$("#fsPause",root), newBtn:$("#fsNew",root), paused:false, aspect:16/9, cw:960, onResize:null, onNew:null };
  ctx.pauseBtn.onclick=()=>{ ctx.paused=!ctx.paused; ctx.pauseBtn.textContent=ctx.paused?"Seguir":"Pausa"; };
  ctx.newBtn.onclick=()=>{ ctx.paused=false; ctx.pauseBtn.textContent="Pausa"; if(ctx.onNew) ctx.onNew(); };
  $("#fsBack",root).onclick=menu;
  const offKeys=keyboard({ Escape:[menu] });
  const lay=()=>layout(ctx);
  relayout=lay; window.addEventListener("resize",lay); window.addEventListener("orientationchange",lay);
  if(window.visualViewport) window.visualViewport.addEventListener("resize",lay);
  const prevOv=document.documentElement.style.overflow; document.documentElement.style.overflow="hidden"; document.body.style.overflow="hidden";
  const stopGame = g==="taxi"?taxiGame(ctx):flightGame(ctx,g);
  let tilt=null; if(tiltSupported()){ $("#fsTilt",root).hidden=false; tilt=makeTilt(ctx,$("#fsTilt",root),$("#fsCal",root)); }
  lay(); setTimeout(lay,60); setTimeout(lay,400);
  stopFn=()=>{ try{ stopGame(); }catch(e){} if(tilt) tilt.off(); offKeys(); window.removeEventListener("resize",lay); window.removeEventListener("orientationchange",lay);
    if(window.visualViewport) window.visualViewport.removeEventListener("resize",lay);
    document.documentElement.style.overflow=prevOv; document.body.style.overflow=""; relayout=null; };
}
function layout(ctx){
  const full=ctx.full; if(!full||!full.isConnected) return;
  const vv=window.visualViewport, W=Math.round(vv&&vv.width?vv.width:window.innerWidth), H=Math.round(vv&&vv.height?vv.height:window.innerHeight);
  full.style.height=H+"px"; full.style.width=W+"px"; full.style.top=((vv&&vv.offsetTop)||0)+"px"; full.style.left=((vv&&vv.offsetLeft)||0)+"px";
  const top=$(".fs-top",full).offsetHeight||46;
  const cs=getComputedStyle(full), pl=parseFloat(cs.paddingLeft)||0, pr=parseFloat(cs.paddingRight)||0, pt=parseFloat(cs.paddingTop)||0, pb=parseFloat(cs.paddingBottom)||0;
  const bw=W-pl-pr-16, bh=H-pt-pb-top-8;
  const tl=ctx.panel.classList.contains("tl"), land=W>=H*1.1;
  let cw,chh,pw,ph;
  if(land){ pw=clamp(Math.round(bh*0.6),180,300); pw=Math.min(pw,Math.round(bw*0.42)); cw=Math.min(bw-pw-8,Math.round(bh*1.9)); chh=bh; if(cw/chh<0.62) chh=Math.floor(cw/0.62); ph=bh; }
  else{ pw=bw; const pneed=clamp(Math.round(bw*0.5)+16,190,300); cw=bw; chh=bh-pneed-8; if(cw/chh>1.5) chh=Math.floor(cw/1.5); if(cw/chh<0.62) chh=Math.floor(cw/0.62); ph=bh-chh-8; }
  cw=Math.max(240,Math.floor(cw)); chh=Math.max(150,Math.floor(chh)); ph=Math.max(140,Math.floor(ph));
  full.classList.toggle("land",land); full.classList.toggle("port",!land); full.classList.toggle("cmp",ph<210||top<44);
  ctx.view.style.width=cw+"px"; ctx.view.style.height=chh+"px"; ctx.cv.style.width=cw+"px"; ctx.cv.style.height=chh+"px";
  ctx.panel.style.width=pw+"px"; ctx.panel.style.height=ph+"px";
  ctx.cw=cw; ctx.aspect=cw/chh;
  let pad, levH;
  if(tl){ pad=70; levH=land?clamp(ph-pad-56,80,200):clamp(ph-pad-44,56,200); }
  else if(land){ pad=Math.floor(Math.min(pw-24,ph*0.5,300)); levH=clamp(ph-pad-58,70,200); }
  else{ pad=Math.floor(Math.min(ph-4,pw*0.5-18,300)); levH=clamp(ph-34,90,220); }
  ctx.panel.style.setProperty("--pad",Math.max(100,pad)+"px"); ctx.panel.style.setProperty("--lev",Math.floor(levH)+"px");
  if(ctx.onResize) ctx.onResize();
}

/* ---- utilidades de dibujo / entrada ---- */
function fitCanvas(cv,w,h){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
  const c=cv.getContext("2d"); c.setTransform(dpr,0,0,dpr,0,0); return c;
}
function keyboard(map){            // map: {tecla:[abajo,arriba,repetir]} · devuelve quitar()
  const dn=e=>{ if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if(e.metaKey||e.ctrlKey||e.altKey) return; const f=map[e.key.length===1?e.key.toLowerCase():e.key]; if(f){ e.preventDefault(); if(!e.repeat&&f[0]) f[0](e); else if(e.repeat&&f[2]) f[2](e); } };
  const up=e=>{ const f=map[e.key.length===1?e.key.toLowerCase():e.key]; if(f&&f[1]){ e.preventDefault(); f[1](e); } };
  window.addEventListener("keydown",dn); window.addEventListener("keyup",up);
  return ()=>{ window.removeEventListener("keydown",dn); window.removeEventListener("keyup",up); };
}
function holdBtn(el,on,off){
  const d=e=>{ e.preventDefault(); el.classList.add("on"); on(); try{ el.setPointerCapture(e.pointerId); }catch(_){} };
  const u=()=>{ el.classList.remove("on"); off(); };
  el.addEventListener("pointerdown",d); el.addEventListener("pointerup",u); el.addEventListener("pointercancel",u); el.addEventListener("lostpointercapture",u);
  el.addEventListener("contextmenu",e=>e.preventDefault());
}

/* ====================================================================== */
/*  Mandos en pantalla: yoke Boeing · sidestick Airbus · palanca · tiller  */
/* ====================================================================== */
const PAD_STICK=`<svg viewBox="0 0 200 200" aria-label="Sidestick">
<defs><linearGradient id="gS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#47525c"/><stop offset="1" stop-color="#1b2229"/></linearGradient></defs>
<rect x="8" y="8" width="184" height="184" rx="36" fill="#15212c" stroke="#2b4054" stroke-width="3"/>
<circle cx="100" cy="100" r="70" fill="none" stroke="#2b4054" stroke-width="2" stroke-dasharray="3 6"/>
<path d="M100 22v18M100 160v18M22 100h18M160 100h18" stroke="#3c5a73" stroke-width="3" stroke-linecap="round"/>
<circle cx="100" cy="100" r="30" fill="#0e151b" stroke="#2b4054" stroke-width="2"/>
<g id="pg"><ellipse cx="6" cy="14" rx="26" ry="40" fill="rgba(0,0,0,.35)"/>
<path d="M-18 40C-30 20-28 -22-14 -40-8 -48 8 -48 14 -40 28 -22 30 20 18 40Z" fill="url(#gS)" stroke="#6a7782" stroke-width="2"/>
<circle cx="0" cy="-26" r="6" fill="#d8402e" stroke="#7a1d12" stroke-width="1.5"/><rect x="-8" y="-6" width="16" height="9" rx="4" fill="#2a343c" stroke="#59656f"/></g></svg>`;
const PAD_YOKE=`<svg viewBox="0 0 200 200" aria-label="Yoke">
<defs><linearGradient id="gY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#56626c"/><stop offset="1" stop-color="#242c33"/></linearGradient></defs>
<rect x="8" y="8" width="184" height="184" rx="36" fill="#15212c" stroke="#2b4054" stroke-width="3"/>
<rect x="88" y="120" width="24" height="76" rx="6" fill="#2a343c" stroke="#3a4650"/>
<g id="pg" transform="translate(100,100)"><g id="py">
<path d="M-62-6C-62-44-38-52-26-38L-16-30H16L26-38C38-52 62-44 62-6V26C62 48 44 56 30 56H-30C-44 56-62 48-62 26Z" fill="none" stroke="url(#gY)" stroke-width="15" stroke-linejoin="round"/>
<rect x="-72" y="-22" width="20" height="52" rx="10" fill="#10161b" stroke="#6a7782" stroke-width="2"/><rect x="52" y="-22" width="20" height="52" rx="10" fill="#10161b" stroke="#6a7782" stroke-width="2"/>
<circle cx="0" cy="12" r="19" fill="#1b232a" stroke="#6a7782" stroke-width="2.5"/><circle cx="0" cy="12" r="5" fill="#8fa3b3"/><rect x="-5" y="-26" width="10" height="9" rx="3" fill="#d8402e"/>
</g></g></svg>`;
function makePad(host,kind){
  const wrap=document.createElement("div"); wrap.className="pad2"; host.appendChild(wrap);
  const gauge=document.createElement("div"); gauge.className="pgauge"; gauge.innerHTML='<span style="top:50%"></span><i></i>'; host.insertBefore(gauge,wrap);
  const st={ x:0, y:0, kind, el:wrap, gauge:gauge.querySelector("i") };
  wrap.innerHTML=kind==="stick"?PAD_STICK:PAD_YOKE;
  const g=wrap.querySelector("#pg"), py=wrap.querySelector("#py");
  const paint=()=>{
    if(kind==="stick") g.setAttribute("transform",`translate(${100+st.x*62},${100+st.y*62}) rotate(${st.x*18}) scale(${1+st.y*0.08})`);
    else{ g.setAttribute("transform",`translate(100,${100+st.y*8}) rotate(${st.x*70}) scale(${1+st.y*0.14})`); }
  };
  paint();
  let pid=null, raf=0;
  const move=e=>{ const r=wrap.getBoundingClientRect(), R=r.width*0.31;
    let dx=(e.clientX-(r.left+r.width/2))/R, dy=(e.clientY-(r.top+r.height/2))/R; const m=Math.hypot(dx,dy); if(m>1){ dx/=m; dy/=m; }
    st.x=dx; st.y=dy; paint(); };
  const spring=()=>{ cancelAnimationFrame(raf); const t0=performance.now(), x0=st.x, y0=st.y;
    const f=t=>{ const k=Math.min(1,(t-t0)/160); st.x=x0*(1-k); st.y=y0*(1-k); paint(); if(k<1) raf=requestAnimationFrame(f); }; raf=requestAnimationFrame(f); };
  wrap.addEventListener("pointerdown",e=>{ e.preventDefault(); pid=e.pointerId; try{ wrap.setPointerCapture(pid); }catch(_){} cancelAnimationFrame(raf); move(e); });
  wrap.addEventListener("pointermove",e=>{ if(pid===e.pointerId) move(e); });
  const up=e=>{ if(pid!==e.pointerId) return; pid=null; spring(); };
  wrap.addEventListener("pointerup",up); wrap.addEventListener("pointercancel",up); wrap.addEventListener("contextmenu",e=>e.preventDefault());
  st.tiltSet=(x,y)=>{ if(pid!=null) return; cancelAnimationFrame(raf); st.x=x; st.y=y; paint(); };
  st.setPitchMark=v=>{ st.gauge.style.top=(50-clamp(v,-1,1)*46)+"%"; };
  st.destroy=()=>cancelAnimationFrame(raf);
  return st;
}
function makeLever(host,init,labEl,base){
  const el=document.createElement("div"); el.className="lev"; el.innerHTML='<div class="tr"></div><div class="fl"></div><div class="hd"></div><div class="pc"></div>'; host.appendChild(el);
  const st={ v:init||0, el }, hd=el.querySelector(".hd"), fl=el.querySelector(".fl"), pc=el.querySelector(".pc");
  const paint=()=>{ const top=6, bot=6, H=el.clientHeight-top-bot; const y=top+(1-st.v)*H; hd.style.top=y+"px"; fl.style.height=(st.v*H)+"px"; pc.textContent=""; if(labEl) labEl.textContent=base+" "+Math.round(st.v*100)+" %"; };
  st.set=v=>{ st.v=clamp(v,0,1); paint(); };
  let pid=null;
  const mv=e=>{ const r=el.getBoundingClientRect(); const top=r.top+6, H=r.height-12; st.set(1-(e.clientY-top)/H); };
  el.addEventListener("pointerdown",e=>{ e.preventDefault(); pid=e.pointerId; try{ el.setPointerCapture(pid); }catch(_){} mv(e); });
  el.addEventListener("pointermove",e=>{ if(pid===e.pointerId) mv(e); });
  const up=e=>{ if(pid===e.pointerId) pid=null; }; el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
  st.paint=paint; setTimeout(paint,0); new (window.ResizeObserver||function(){ this.observe=()=>{}; })(paint).observe(el);
  return st;
}
function makeTiller(host){
  const el=document.createElement("div"); el.className="tiller"; el.innerHTML="<i></i>"; host.appendChild(el);
  const kn=el.querySelector("i"), st={ x:0, el }; let pid=null, raf=0;
  const paint=()=>{ const w=el.clientWidth-52-12; kn.style.transform=`translateX(${st.x*w/2}px)`; };
  const mv=e=>{ const r=el.getBoundingClientRect(); st.x=clamp(((e.clientX-r.left)/r.width-0.5)*2*1.08,-1,1); paint(); };
  const spring=()=>{ cancelAnimationFrame(raf); const t0=performance.now(), x0=st.x; const f=t=>{ const k=Math.min(1,(t-t0)/180); st.x=x0*(1-k); paint(); if(k<1) raf=requestAnimationFrame(f); }; raf=requestAnimationFrame(f); };
  el.addEventListener("pointerdown",e=>{ e.preventDefault(); pid=e.pointerId; try{ el.setPointerCapture(pid); }catch(_){} cancelAnimationFrame(raf); mv(e); });
  el.addEventListener("pointermove",e=>{ if(pid===e.pointerId) mv(e); });
  const up=e=>{ if(pid!==e.pointerId) return; pid=null; spring(); }; el.addEventListener("pointerup",up); el.addEventListener("pointercancel",up);
  st.tiltSet=x=>{ if(pid!=null) return; cancelAnimationFrame(raf); st.x=x; paint(); };
  st.destroy=()=>cancelAnimationFrame(raf);
  return st;
}
/* panel: dispositivo de actitud (pad o tiller), palanca de gases y botones */
function buildPanel(panel,o){
  panel.innerHTML="";
  const r={}; curCtl=r;
  const padw=document.createElement("div"); padw.className="fs-padw";
  const row2=document.createElement("div"); row2.className="fs-row2";
  const levw=document.createElement("div"); levw.style.cssText="display:flex;flex-direction:column;align-items:center;flex:none";
  const btns=document.createElement("div"); btns.className="fs-btns";
  panel.classList.toggle("tl",!!o.tiller);
  if(o.tiller){ padw.style.cssText="width:100%;height:auto;flex:none"; r.tiller=makeTiller(padw); }
  else r.pad=makePad(padw,store.get().ctl==="stick"?"stick":"yoke");
  const lab=document.createElement("div"); lab.className="fs-lab"; lab.textContent=o.levLabel||"Gases";
  levw.appendChild(lab); r.lever=makeLever(levw,o.init||0,lab,o.levLabel||"Gases");
  row2.appendChild(levw); row2.appendChild(btns);
  panel.appendChild(padw); panel.appendChild(row2);
  r.tilt=(x,y)=>{ if(r.pad) r.pad.tiltSet(x,y); else if(r.tiller) r.tiller.tiltSet(x); };
  r.btn=(id,label,opts)=>{ const b=document.createElement("button"); b.className="fs-btn"; b.id=id; b.type="button"; b.textContent=label; btns.appendChild(b); return b; };
  return r;
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
  c.font="500 "+Math.round(r*.11)+"px system-ui,sans-serif"; c.fillText("ALT ft",0,-r*.26);
  c.font="700 "+Math.round(r*.2)+"px system-ui,sans-serif"; c.fillText(String(Math.max(0,Math.round(ftv/10)*10)),0,r*.33);
  c.font="500 "+Math.round(r*.13)+"px system-ui,sans-serif"; c.fillStyle=vsi<-700?"#ff6b5b":"#9fd3ff"; c.fillText((vsi>=0?"+":"")+Math.round(vsi/10)*10+" fpm",0,r*.58);
  c.restore();
}

/* ====================================================================== */
/*  Juego 1 · Turn coordinator                                             */

/* ====================================================================== */
/*  Escenario 3D compartido                                                */
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

/* ====================================================================== */
/*  Utilidades de juego: avisos, overlays, HUD                             */
/* ====================================================================== */
const fmt=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g," ");
function toast(ctx,t,s){ const el=ctx.toast; if(!el) return; el.textContent=t; el.hidden=false; clearTimeout(el._t); el._t=setTimeout(()=>{ el.hidden=true; },(s||2.6)*1000); }
function showOverlay(ctx,html,wire){ ctx.res.innerHTML=html; ctx.res.hidden=false; ctx.res.scrollTop=0; if(wire) wire(ctx.res); }
function hideOverlay(ctx){ ctx.res.hidden=true; ctx.res.innerHTML=""; }
function setHud(ctx,html){ if(ctx._hud!==html){ ctx._hud=html; ctx.hud.innerHTML=html; } }
function startLoop(step){
  let raf=0,last=0;
  const f=t=>{ raf=requestAnimationFrame(f); let dt=(t-last)/1000; if(!(dt>0)) dt=0.016; last=t; step(Math.min(dt,0.1)); };
  raf=requestAnimationFrame(f); return ()=>cancelAnimationFrame(raf);
}
function secs(t){ t=Math.round(t); return Math.floor(t/60)+":"+String(t%60).padStart(2,"0"); }

/* ====================================================================== */
/*  Juego 1 · RODAJE                                                       */
/*  Aeródromo de ejemplo con pista 09/27, calle paralela A, conectores     */
/*  B, C, D, J, K, calles E, F, G, H a la plataforma y 5 puestos (stands). */
/* ====================================================================== */
function buildAirport(){
  const nodes={}, edges=[];
  const N=(id,x,y)=>{ nodes[id]={id,x:Math.round(x*0.6),y,adj:[]}; };
  const E=(a,b,name,kind)=>{ const A=nodes[a],B=nodes[b],e={a,b,name,kind:kind||"twy",A,B,len:Math.hypot(A.x-B.x,A.y-B.y)}; edges.push(e); A.adj.push({to:b,e}); B.adj.push({to:a,e}); };
  [["a1",-800,170],["a2",-600,170],["a3",-300,170],["a4",0,170],["a5",300,170],["a6",600,170],["a7",800,170],
   ["hJ",-800,50],["hB",-600,50],["hC",0,50],["hD",600,50],["hK",800,50],
   ["e1",-300,330],["f0",-520,330],["f1",-450,330],["f2",-150,330],["f3",-80,330],
   ["s1",-450,405],["s2",-300,405],["s3",-150,405],["g1",300,330],["g2",420,330],["s4",300,405],["s5",420,405]].forEach(a=>N(a[0],a[1],a[2]));
  [["a1","a2"],["a2","a3"],["a3","a4"],["a4","a5"],["a5","a6"],["a6","a7"]].forEach(p=>E(p[0],p[1],"A"));
  E("a1","hJ","J"); E("a2","hB","B"); E("a4","hC","C"); E("a6","hD","D"); E("a7","hK","K");
  E("a3","e1","E"); E("f0","f1","F"); E("f1","e1","F"); E("e1","f2","F"); E("f2","f3","F");
  E("f1","s1","Stand 1","stand"); E("e1","s2","Stand 2","stand"); E("f2","s3","Stand 3","stand");
  E("a5","g1","G"); E("g1","g2","H"); E("g1","s4","Stand 4","stand"); E("g2","s5","Stand 5","stand");
  return { nodes, edges, holds:["hJ","hB","hC","hD","hK"], stands:["s1","s2","s3","s4","s5"] };
}
function taxiRoute(AP,from,to){
  const dist={},prev={},done={}; Object.keys(AP.nodes).forEach(k=>dist[k]=1e9); dist[from]=0;
  for(;;){ let u=null,b=1e9; for(const k in dist) if(!done[k]&&dist[k]<b){ b=dist[k]; u=k; } if(u==null||u===to) break; done[u]=1;
    AP.nodes[u].adj.forEach(a=>{ const nd=dist[u]+a.e.len; if(nd<dist[a.to]){ dist[a.to]=nd; prev[a.to]={u:u,e:a.e}; } }); }
  if(dist[to]>=1e9) return null;
  const nodes=[to],edges=[]; let k=to; while(k!==from){ const p=prev[k]; edges.unshift(p.e); k=p.u; nodes.unshift(k); }
  return { nodes, edges };
}
function taxiPhrase(AP,rt,to){
  const via=[]; rt.edges.forEach(e=>{ if(e.kind==="stand") return; if(via[via.length-1]!==e.name) via.push(e.name); });
  const hold=AP.holds.indexOf(to)>=0, id=to.charAt(1);
  if(hold&&via.length>1&&via[via.length-1]===id) via.pop();
  const v=via.join(", ");
  return hold ? { en:`Taxi to holding point ${id} via ${v}. Hold short of runway 09/27.`, es:`Rueda al punto de espera ${id} por ${v}. Mantén antes de la pista 09/27.` }
              : { en:`Taxi to stand ${id} via ${v}.`, es:`Rueda al stand ${id} por ${v}.` };
}
const taxiLabel=(AP,id)=>AP.holds.indexOf(id)>=0?"punto de espera "+id.charAt(1):"stand "+id.charAt(1);
function segDist(px,py,A,B){ const dx=B.x-A.x, dy=B.y-A.y, l2=dx*dx+dy*dy; let t=((px-A.x)*dx+(py-A.y)*dy)/(l2||1); t=clamp(t,0,1); return Math.hypot(px-(A.x+t*dx),py-(A.y+t*dy)); }

function drawPlaneTop(c,x,y,s,col){
  c.save(); c.translate(x,y); c.scale(s,s); c.lineWidth=0.28; c.strokeStyle="#1b2a38"; c.fillStyle=col||"#f4f6f8";
  c.beginPath(); c.rect(-5.5,-1.7,11,2.0); c.fill(); c.stroke();                       // ala alta
  c.beginPath(); c.ellipse(0,0.5,0.95,4.3,0,0,TAU); c.fill(); c.stroke();            // fuselaje
  c.beginPath(); c.rect(-2.3,3.2,4.6,1.0); c.fill(); c.stroke();                       // estabilizador
  c.fillStyle="#d8402e"; c.beginPath(); c.moveTo(-5.5,-1.7); c.lineTo(-5.5,0.3); c.lineTo(-4.6,0.3); c.lineTo(-4.6,-1.7); c.fill(); c.beginPath(); c.moveTo(5.5,-1.7); c.lineTo(5.5,0.3); c.lineTo(4.6,0.3); c.lineTo(4.6,-1.7); c.fill();
  c.strokeStyle="rgba(20,20,20,.55)"; c.lineWidth=0.35; c.beginPath(); c.moveTo(-1.7,-3.9); c.lineTo(1.7,-3.9); c.stroke();
  c.restore();
}

const RH=540;
function taxiGame(ctx){
  const cv=ctx.cv, AP=buildAirport(), dbgT={ inp:{steer:null,thr:null,brake:null} };
  let W=960,H=540,c,k=3.3,CX=480,CYp=350;
  const ctl=buildPanel(ctx.panel,{tiller:true,levLabel:"Velocidad",init:0});
  const bBrk=ctl.btn("tBrk","Frenos"), bHelp=ctl.btn("tHelp","");
  let help=store.get().help!==0;
  const setHelp=(save)=>{ bHelp.textContent="Ruta en pista: "+(help?"sí":"no"); bHelp.classList.toggle("on",help); if(save) store.put("help",help?1:0); };
  setHelp(false); bHelp.onclick=()=>{ help=!help; setHelp(true); };
  let brk=0, kS=0, kSt=0, kT=0;
  holdBtn(bBrk,()=>brk=1,()=>brk=0);
  const off=keyboard({ ArrowLeft:[()=>kS=-1,()=>kS=0], ArrowRight:[()=>kS=1,()=>kS=0], a:[()=>kS=-1,()=>kS=0], d:[()=>kS=1,()=>kS=0],
    ArrowUp:[()=>kT=1,()=>kT=0], ArrowDown:[()=>kT=-1,()=>kT=0], w:[()=>kT=1,()=>kT=0], s:[()=>kT=-1,()=>kT=0], " ":[()=>brk=1,()=>brk=0], b:[()=>brk=1,()=>brk=0] });
  function size(){ W=960; H=Math.max(380,Math.round(960/ctx.aspect)); c=fitCanvas(cv,W,H); CX=W/2; CYp=H*0.66; k=clamp(W/280,2.6,4); }
  ctx.onResize=size; size();
  const MAXV=13, WB=3.4;
  let P,legs=[],li=0,leg=null,res=[],over=false,started=false,wait=0,lastScore=0,tClock=0,pulse=0;

  function plan(){
    const out=[]; let cur=AP.stands[Math.floor(Math.random()*AP.stands.length)];
    for(let i=0;i<2;i++){ const pool=(i%2===0?AP.holds:AP.stands).filter(n=>n!==cur); const to=pool[Math.floor(Math.random()*pool.length)]; out.push({from:cur,to:to,rt:taxiRoute(AP,cur,to)}); cur=to; }
    return out;
  }
  function segsOf(rt){ const a=[]; for(let i=0;i<rt.nodes.length-1;i++) a.push({A:AP.nodes[rt.nodes[i]],B:AP.nodes[rt.nodes[i+1]]}); return a; }
  function startLeg(i){
    li=i; const L=legs[i]; const A=AP.nodes[L.from], B=AP.nodes[L.rt.nodes[1]];
    leg={ from:L.from,to:L.to,rt:L.rt,segs:segsOf(L.rt),s:{dev:0,mov:0,over:0,wrong:0,offT:0,offAcc:0,grace:0,t:0,fastT:0} };
    leg.say=taxiPhrase(AP,L.rt,L.to);
    P={x:A.x,y:A.y,th:Math.atan2(B.x-A.x,-(B.y-A.y)),v:0,steer:0};
    ctl.lever.set(0); wait=0;
    toast(ctx,i===0?"Tramo 1 de 2 · mantén el eje de la calle":"Tramo "+(i+1)+" de 2 · te recolocamos en el punto de partida",3);
  }
  function startGame(){
    hideOverlay(ctx); legs=plan(); res=[]; over=false; started=true; tClock=0; startLeg(0);
  }
  function intro(){
    started=false; over=false; ctx.paused=false;
    showOverlay(ctx,`<h3>Rodaje</h3>
      <ul><li>La torre te da una ruta por <b>calles de rodaje</b> (taxiways): sigue las letras pintadas en el suelo.</li>
      <li><b>Mando de dirección</b> (tiller) para girar y <b>palanca</b> para la velocidad. Frenos para parar.</li>
      <li>Límite: 20 kt en recta y unos 10 kt en curvas cerradas. Para exactamente en el stand o antes de la <b>línea de espera</b>.</li>
      <li class="fs-bad">Cruzar la línea de espera sin autorización es una incursión en pista: tramo fallido.</li></ul>
      <p style="margin:0;font-size:13px;color:#9fb4c5">Teclado: ←→ girar · ↑↓ velocidad · Espacio frenos</p>
      <div class="row"><button class="fs-btn" id="goB">Empezar</button></div>`,r=>{ $("#goB",r).onclick=startGame; });
  }
  ctx.onNew=intro;

  /* ---- lógica ---- */
  function nextHint(){
    const segs=leg.rt.nodes; let bi=0,bd=1e9;
    for(let i=0;i<segs.length-1;i++){ const d=segDist(P.x,P.y,AP.nodes[segs[i]],AP.nodes[segs[i+1]]); if(d<bd){ bd=d; bi=i; } }
    const nodeAt=i=>AP.nodes[segs[i]];
    const dirOf=i=>{ const a=nodeAt(i),b=nodeAt(i+1); return Math.atan2(b.x-a.x,-(b.y-a.y)); };
    let j=bi+1; const d0=dirOf(bi);
    while(j<segs.length-1){ let da=wrap180((dirOf(j)-d0)/D2R); if(Math.abs(da)>35) break; j++; }
    const n=nodeAt(j), dist=Math.hypot(n.x-P.x,n.y-P.y);
    if(j>=segs.length-1){ return `Sigue recto ${Math.round(dist)} m y para en el ${taxiLabel(AP,leg.to)}`; }
    const da=wrap180((dirOf(j)-d0)/D2R), e=leg.rt.edges[j]; const nm=e.kind==="stand"?e.name.toLowerCase():"calle "+e.name;
    return `En ${Math.round(dist)} m gira a la ${da>0?"derecha":"izquierda"} por ${nm}`;
  }
  function finishLeg(fail,why){
    const s=leg.s, avgDev=s.mov>0?s.dev/s.mov:0, overF=s.mov>0?s.over/s.mov:0, tn=AP.nodes[leg.to], sd=Math.hypot(P.x-tn.x,P.y-tn.y);
    const fid=Math.max(0,40-15*s.wrong), cen=25*clamp(1-(avgDev-1)/5,0,1), spd=Math.max(0,20*clamp(1-overF*2.5,0,1)-Math.min(10,s.offT*1.5)), stp=15*clamp(1-(sd-2)/7,0,1);
    const total=fail?0:Math.round(clamp(fid+cen+spd+stp,0,100));
    res.push({ from:leg.from,to:leg.to,total:total,fail:fail,why:why,wrong:s.wrong,avgDev:avgDev,overF:overF,sd:sd,offT:s.offT,t:s.t });
    toast(ctx,fail?why:`Tramo ${li+1} completado · ${total} puntos`,2.6);
    if(li>=1){ end(); } else { wait=2.4; leg.done=true; }
  }
  function end(){
    over=true; started=false;
    const sc=Math.round(res.reduce((a,r)=>a+r.total,0)/2), best=store.best("taxi",sc);
    const lines=res.map((r,i)=>{
      const nm=`${taxiLabel(AP,r.from)} → ${taxiLabel(AP,r.to)}`;
      if(r.fail) return `<li><b>Tramo ${i+1}</b> (${nm}): <span class="fs-bad">${esc(r.why)}</span></li>`;
      const bits=[]; bits.push(r.wrong?`<span class="fs-bad">${r.wrong} calle(s) equivocada(s)</span>`:`<span class="fs-ok">ruta correcta</span>`);
      bits.push(`eje a ${r.avgDev.toFixed(1)} m de media`);
      bits.push(r.overF>0.05?`<span class="fs-mid">exceso de velocidad ${Math.round(r.overF*100)} % del tiempo</span>`:`<span class="fs-ok">velocidad correcta</span>`);
      if(r.offT>1) bits.push(`<span class="fs-mid">${Math.round(r.offT)} s fuera del asfalto</span>`);
      bits.push(`parada a ${r.sd.toFixed(0)} m del punto`);
      return `<li><b>Tramo ${i+1}</b> (${nm}): <b>${r.total}</b> · ${bits.join(" · ")}</li>`;
    }).join("");
    showOverlay(ctx,`<h3>${sc>=80?"Rodaje limpio":sc>=50?"Rodaje correcto":"Rodaje a mejorar"}</h3>
      <div class="big ${sc>=70?"fs-ok":sc>=40?"fs-mid":"fs-bad"}">${sc} <small style="font:600 14px system-ui">puntos · mejor ${best==null?"—":best}</small></div>
      <ul>${lines}</ul>
      <div class="row"><button class="fs-btn" id="againB">Otra ruta</button><button class="fs-btn sec" id="menuB">Menú</button></div>`,r=>{ $("#againB",r).onclick=intro; $("#menuB",r).onclick=menu; });
  }
  function replan(){
    let best=null,bd=1e9;
    Object.keys(AP.nodes).forEach(id=>{ const n=AP.nodes[id], dx=n.x-P.x, dy=n.y-P.y, d=Math.hypot(dx,dy), ahead=(dx*Math.sin(P.th)-dy*Math.cos(P.th))>0, sc=d+(ahead?0:30); if(sc<bd){ bd=sc; best=n; } });
    const rt=taxiRoute(AP,best.id,leg.to);
    let be=null,bed=1e9; AP.edges.forEach(e=>{ const d=segDist(P.x,P.y,e.A,e.B); if(d<bed){ bed=d; be=e; } });
    if(rt){ leg.rt=rt; leg.segs=segsOf(rt); if(be) leg.segs.push({A:be.A,B:be.B}); leg.say=taxiPhrase(AP,rt,leg.to); }
    leg.s.grace=7; leg.s.offAcc=0;
  }
  function step(dt){
    if(!started||over||ctx.paused||!leg) return;
    pulse+=dt; tClock+=dt;
    if(wait>0){ wait-=dt; if(wait<=0) startLeg(li+1); return; }
    if(leg.done) return;
    const inp=dbgT.inp, s=leg.s;
    if(kT) ctl.lever.set(ctl.lever.v+kT*dt*0.55);
    kSt+=((kS)-kSt)*Math.min(1,dt*5);
    const thr=inp.thr!=null?inp.thr:ctl.lever.v, sx=inp.steer!=null?inp.steer:clamp(ctl.tiller.x+kSt,-1,1), bk=inp.brake!=null?inp.brake:brk;
    const vt=thr*MAXV;
    if(bk) P.v=Math.max(0,P.v-4.5*dt); else if(P.v<vt) P.v=Math.min(vt,P.v+1.6*dt); else P.v=Math.max(vt,P.v-1.4*dt);
    P.steer+=(sx-P.steer)*Math.min(1,dt*6);
    P.th+=P.v/WB*Math.tan(P.steer*0.66)*dt;
    P.x+=P.v*Math.sin(P.th)*dt; P.y-=P.v*Math.cos(P.th)*dt;
    s.t+=dt;
    // distancia al asfalto y a la ruta
    let dmin=1e9; AP.edges.forEach(e=>{ const d=segDist(P.x,P.y,e.A,e.B)-(e.kind==="stand"?6:7.5); if(d<dmin) dmin=d; });
    AP.stands.forEach(id=>{ const n=AP.nodes[id]; if(Math.abs(P.x-n.x)<20&&Math.abs(P.y-n.y+2)<15) dmin=Math.min(dmin,0); });
    let dr=1e9; leg.segs.forEach(g=>{ const d=segDist(P.x,P.y,g.A,g.B); if(d<dr) dr=d; });
    if(P.v>0.6){ s.mov+=dt; s.dev+=Math.min(dr,12)*dt; if(P.v>10.3) s.over+=dt;
      const R=leg.rt.nodes; for(let i=1;i<R.length-1;i++){ const n=AP.nodes[R[i]]; if(Math.hypot(n.x-P.x,n.y-P.y)<26){ const a=AP.nodes[R[i-1]], b=AP.nodes[R[i+1]]; const d1=Math.atan2(n.x-a.x,-(n.y-a.y)), d2=Math.atan2(b.x-n.x,-(b.y-n.y)); if(Math.abs(wrap180((d2-d1)/D2R))>=50&&P.v>5.2){ s.over+=dt; if(!s.fastSaid){ s.fastSaid=1; toast(ctx,"Demasiado rápido para esta curva (máx. ~10 kt)",2.2); } } } } }
    if(dmin>1.5){ s.offT+=dt; if(!s.offSaid&&dmin>3){ s.offSaid=1; toast(ctx,"Te sales del asfalto: vuelve a la calle",2.2); } } else s.offSaid=0;
    if(s.grace>0) s.grace-=dt;
    else if(dr>10&&dmin<=1.5){ s.offAcc+=dt; if(s.offAcc>2.2){ s.wrong++; replan(); toast(ctx,"Calle equivocada · nueva ruta: "+leg.say.es.replace(/^Rueda al /,"").replace(/^Rueda a /,""),3.4); } }
    else s.offAcc=Math.max(0,s.offAcc-dt);
    // incursión y fin de tramo
    const tn=AP.nodes[leg.to], hold=AP.holds.indexOf(leg.to)>=0;
    if(Math.abs(P.y)<28&&Math.abs(P.x)<RH+10){ P.x=tn.x; P.y=tn.y+(hold?6:0); P.v=0; finishLeg(true,"Incursión de pista: entraste en la pista sin autorización."); return; }
    if(hold&&Math.abs(P.x-tn.x)<14&&P.y<tn.y-3.5){ finishLeg(true,"Incursión de pista: cruzaste la línea de espera sin autorización."); return; }
    const near=hold?(Math.abs(P.x-tn.x)<8&&P.y>=tn.y-3.5&&P.y<=tn.y+9):(Math.hypot(P.x-tn.x,P.y-tn.y)<8);
    if(near&&P.v<0.8) finishLeg(false);
  }
  /* ---- dibujo ---- */
  const w2s=(x,y)=>{ const dx=x-P.x, dy=y-P.y, s=Math.sin(P.th), cc=Math.cos(P.th); return [CX+k*(dx*cc+dy*s), CYp+k*(-dx*s+dy*cc)]; };
  function label(x,y,t,bg,fg){ const q=w2s(x,y); if(q[0]<-30||q[0]>W+30||q[1]<-30||q[1]>H+30) return; const fs=Math.round(clamp(k*5.2,13,22)); c.font="700 "+fs+"px system-ui,sans-serif"; const w=c.measureText(t).width+fs*0.8, h=fs*1.35;
    c.fillStyle=bg||"#111"; c.fillRect(q[0]-w/2,q[1]-h/2,w,h); c.fillStyle=fg||"#f2c230"; c.textAlign="center"; c.textBaseline="middle"; c.fillText(t,q[0],q[1]+1); }
  function render(){
    c.fillStyle="#4f7340"; c.fillRect(0,0,W,H);
    c.save(); c.translate(CX,CYp); c.rotate(-P.th); c.scale(k,k); c.translate(-P.x,-P.y);
    c.fillStyle="rgba(255,255,255,.045)"; for(let i=Math.floor((P.x-260)/40);i*40<P.x+260;i++) if(i&1) c.fillRect(i*40,P.y-260,40,520);
    // pista
    c.fillStyle="#383c42"; c.fillRect(-RH,-22.5,2*RH,45);
    c.fillStyle="#e9edf0"; c.fillRect(-RH,-22.5,2*RH,0.6); c.fillRect(-RH,21.9,2*RH,0.6);
    for(let x=-RH+40;x<RH-40;x+=60) c.fillRect(x,-0.4,30,0.8);
    [-1,1].forEach(sg=>{ const x0=sg<0?-RH+4:RH-4; for(let i=-6;i<=6;i++){ if(!i) continue; c.fillRect(x0-(sg<0?0:3.5*1),i*3,3.5,1.6); } });
    c.save(); c.translate(-RH+65,0); c.rotate(Math.PI/2); c.fillStyle="#e9edf0"; c.font="bold 13px system-ui"; c.textAlign="center"; c.fillText("09",0,0); c.restore();
    c.save(); c.translate(RH-65,0); c.rotate(-Math.PI/2); c.fillStyle="#e9edf0"; c.font="bold 13px system-ui"; c.textAlign="center"; c.fillText("27",0,0); c.restore();
    // plataforma (stands)
    AP.stands.forEach(id=>{ const n=AP.nodes[id]; c.fillStyle="#4a4f56"; c.fillRect(n.x-20,n.y-17,40,30); c.strokeStyle="#e9edf0"; c.lineWidth=0.4; c.strokeRect(n.x-9,n.y-12,18,18); });
    // calles de rodaje
    c.lineCap="round"; c.lineJoin="round";
    AP.edges.forEach(e=>{ c.strokeStyle="#4a4f56"; c.lineWidth=e.kind==="stand"?12:15; c.beginPath(); c.moveTo(e.A.x,e.A.y); c.lineTo(e.B.x,e.B.y); c.stroke(); });
    c.lineCap="butt"; AP.edges.forEach(e=>{ c.strokeStyle="#f2c230"; c.lineWidth=0.5; c.beginPath(); c.moveTo(e.A.x,e.A.y); c.lineTo(e.B.x,e.B.y); c.stroke(); });
    // líneas de espera
    AP.holds.forEach(id=>{ const n=AP.nodes[id]; c.fillStyle="#f2c230"; c.fillRect(n.x-7.5,n.y,15,0.6); c.fillRect(n.x-7.5,n.y+1.3,15,0.6); for(let i=-7;i<7;i+=2) { c.fillRect(n.x+i,n.y-2.2,1,0.6); c.fillRect(n.x+i,n.y-3.5,1,0.6); } });
    // ruta (ayuda)
    if(help){ c.strokeStyle="rgba(0,225,255,.55)"; c.lineWidth=2.6; c.lineCap="round"; c.setLineDash([7,5]); c.beginPath(); leg.rt.nodes.forEach((id,i)=>{ const n=AP.nodes[id]; i?c.lineTo(n.x,n.y):c.moveTo(P.x,P.y); }); c.stroke(); c.setLineDash([]); }
    // objetivo
    const tn=AP.nodes[leg.to]; c.strokeStyle="#4fd08c"; c.lineWidth=1.2; c.globalAlpha=.55+.4*Math.sin(pulse*5); c.beginPath(); c.arc(tn.x,tn.y,9+Math.sin(pulse*5)*1.2,0,TAU); c.stroke(); c.globalAlpha=1;
    c.restore();
    // letras (siempre legibles) y puestos
    AP.edges.forEach(e=>{ if(e.kind==="stand") return; const dx=e.B.x-e.A.x, dy=e.B.y-e.A.y, l=e.len; const p=l>150?[28,l-28]:[l/2]; p.forEach(d=>label(e.A.x+dx*d/l,e.A.y+dy*d/l,e.name)); });
    AP.stands.forEach(id=>{ const n=AP.nodes[id]; label(n.x,n.y+3,"STAND "+id.charAt(1),"rgba(10,16,22,.7)","#e9edf0"); });
    AP.holds.forEach(id=>{ const n=AP.nodes[id]; label(n.x+16,n.y+10,"HOLD "+id.charAt(1),"#c0392b","#fff"); });
    const tq=w2s(tn.x,tn.y-14); if(tq[1]>0&&tq[1]<H&&tq[0]>0&&tq[0]<W){ c.fillStyle="#4fd08c"; c.beginPath(); c.moveTo(tq[0],tq[1]); c.lineTo(tq[0]-9,tq[1]-14); c.lineTo(tq[0]+9,tq[1]-14); c.closePath(); c.fill(); }
    drawPlaneTop(c,CX,CYp,k,"#f4f6f8");
    minimap();
  }
  function minimap(){
    const ms=0.26, mw=2*RH*ms, mh=450*ms, ox=8, oy=H-mh-8, X=x=>ox+(x+RH)*ms, Y=y=>oy+(y+30)*ms;
    c.fillStyle="rgba(6,12,18,.9)"; c.fillRect(ox-4,oy-4,mw+8,mh+8);
    c.fillStyle="#555b63"; c.fillRect(X(-RH),Y(-22),2*RH*ms,44*ms);
    c.strokeStyle="#8a929b"; c.lineWidth=2; AP.edges.forEach(e=>{ c.beginPath(); c.moveTo(X(e.A.x),Y(e.A.y)); c.lineTo(X(e.B.x),Y(e.B.y)); c.stroke(); });
    c.strokeStyle="#00e1ff"; c.lineWidth=3; c.beginPath(); leg.rt.nodes.forEach((id,i)=>{ const n=AP.nodes[id]; i?c.lineTo(X(n.x),Y(n.y)):c.moveTo(X(n.x),Y(n.y)); }); c.stroke();
    const tn=AP.nodes[leg.to]; c.fillStyle="#4fd08c"; c.beginPath(); c.arc(X(tn.x),Y(tn.y),6,0,TAU); c.fill();
    c.save(); c.translate(X(P.x),Y(P.y)); c.rotate(P.th); c.fillStyle="#ffc247"; c.beginPath(); c.moveTo(0,-8); c.lineTo(6,6); c.lineTo(-6,6); c.closePath(); c.fill(); c.restore();
    c.fillStyle="#9fb4c5"; c.font="600 11px system-ui"; c.textAlign="left"; c.textBaseline="top"; c.fillText("N ↑",ox+2,oy+2);
  }
  let hudT=0;
  function hud(dt){
    hudT-=dt; if(hudT>0) return; hudT=0.1;
    if(!leg||!started) return;
    const kt=Math.round(P.v/KT), cur=res.reduce((a,r)=>a+r.total,0);
    const hint=wait>0?"":nextHint();
    setHud(ctx,`<div class="l0"><b>Rodaje ${li+1}/2</b><span class="${P.v>10.3?"bad":""}">${kt} kt</span><span>${cur} pts</span></div><div class="l1">${esc(leg.say.en)}</div><div class="l2">${esc(leg.say.es)}</div>${hint?`<div class="l3">➜ ${esc(hint)}</div>`:""}`);
  }
  function frame(dt){
    if(!leg){ c.fillStyle="#4f7340"; c.fillRect(0,0,W,H); return; }
    step(dt); render(); hud(dt);
  }
  const stopLoop=startLoop(frame);
  const vis=()=>{ if(document.hidden) ctx.paused=true, ctx.pauseBtn.textContent="Seguir"; }; document.addEventListener("visibilitychange",vis);
  dbg.g=dbgT; dbgT.AP=AP; Object.defineProperty(dbgT,"P",{get:()=>P}); Object.defineProperty(dbgT,"leg",{get:()=>leg}); Object.defineProperty(dbgT,"res",{get:()=>res}); Object.defineProperty(dbgT,"over",{get:()=>over}); dbgT.start=startGame; dbgT.kind="taxi";
  intro();
  return ()=>{ stopLoop(); off(); ctl.tiller.destroy&&ctl.tiller.destroy(); document.removeEventListener("visibilitychange",vis); ctx.onResize=null; ctx.onNew=null; };
}

/* ====================================================================== */
/*  Juegos 2, 3 y 4 · Despegue, aterrizaje y vectores (vista de cabina)    */
/* ====================================================================== */
function flightGame(ctx,mode){
  const takeoff=mode==="takeoff", landing=mode==="landing", vec=mode==="vectors";
  const cv=ctx.cv, dbgF={ manual:false, kind:mode };
  let W=960,H=540,c,FOC=912,CX=480,CY=190,DR=62,SH=140,U=2;
  const ctl=buildPanel(ctx.panel,{levLabel:"Gases",init:0});
  const bFlap=vec?null:ctl.btn("flFlap","Flaps 10°"), bBrk=vec?null:ctl.btn("flBrk","Frenos");
  function size(){ W=960; H=Math.max(380,Math.round(960/ctx.aspect)); c=fitCanvas(cv,W,H); FOC=W*0.95; CX=W/2; DR=clamp(H*0.12,56,92); SH=2*DR+16; CY=(H-SH)*0.46; U=W/Math.max(300,ctx.cw||W); }
  ctx.onResize=size; size();
  const sc=makeScenery(takeoff?11:23);
  let sim=null, wind=0, over=false, started=false, route=null, gi=0, score=0, gres=[], stallT=0, kP=0, kA=0, kAv=0, brk=0, said={};
  const FLAPS=[0,10,20,30], syncFlap=()=>{ if(bFlap) bFlap.textContent="Flaps "+FLAPS[sim?sim.flap:1]+"°"; };
  const cycleFlap=()=>{ if(sim&&!over){ sim.flap=(sim.flap+1)%4; syncFlap(); } };
  if(bFlap) bFlap.onclick=cycleFlap;
  if(bBrk) holdBtn(bBrk,()=>brk=1,()=>brk=0);
  const off=keyboard({ ArrowDown:[()=>kP=1,()=>kP=0], ArrowUp:[()=>kP=-1,()=>kP=0], ArrowLeft:[()=>kA=-1,()=>kA=0], ArrowRight:[()=>kA=1,()=>kA=0],
    e:[()=>ctl.lever.set(ctl.lever.v+0.05),null,()=>ctl.lever.set(ctl.lever.v+0.04)], q:[()=>ctl.lever.set(ctl.lever.v-0.05),null,()=>ctl.lever.set(ctl.lever.v-0.04)],
    PageUp:[()=>ctl.lever.set(ctl.lever.v+0.05),null,()=>ctl.lever.set(ctl.lever.v+0.04)], PageDown:[()=>ctl.lever.set(ctl.lever.v-0.05),null,()=>ctl.lever.set(ctl.lever.v-0.04)],
    f:[cycleFlap], b:[()=>brk=1,()=>brk=0], " ":[()=>brk=1,()=>brk=0] });

  /* ---- ruta de vectores ---- */
  function makeRoute(){
    const g=[]; let x=0,z=0,hd=Math.round(Math.random()*35)*10, alt=2000; const start={hdg:hd,alt:alt};
    for(let i=0;i<5;i++){
      const tn=(Math.random()<.5?-1:1)*(35+Math.floor(Math.random()*11)*5); const prev=hd; hd=((hd+tn)%360+360)%360;
      const len=1500+Math.random()*1200; x+=len*Math.sin(hd*D2R); z+=len*Math.cos(hd*D2R);
      const opts=[-500,-300,0,300,500]; const na=Math.round(clamp(alt+opts[Math.floor(Math.random()*5)],1500,3500)/100)*100;
      const d=wrap180(hd-prev), r=d>0, p3=n=>String(n).padStart(3,"0");
      const up=na>alt, same=na===alt;
      g.push({ x:x,z:z,h:na/FT,alt:na,hdg:hd,len:len,prevAlt:alt,
        en:`Turn ${r?"right":"left"} heading ${p3(hd||360)}. ${same?"Maintain":up?"Climb and maintain":"Descend and maintain"} ${fmt(na)} ft.`,
        es:`Vira a la ${r?"derecha":"izquierda"} rumbo ${p3(hd||360)}. ${same?"Mantén":up?"Sube y mantén":"Desciende y mantén"} ${fmt(na)} ft.` });
      alt=na;
    }
    return {start:start,g:g};
  }

  /* ---- 3D ---- */
  const cam={x:0,y:0,z:0,psi:0,th:0,near:0.6};
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
  function papiLights(){ const pz=300, hl=Math.max(0,sim.h)+0.8, dist=Math.max(5,pz-sim.z), el=Math.atan2(hl,dist)/D2R; return [3.5,3.17,2.83,2.5].map(t=>({white:el>=t})); }
  const PATCH=[[88,134,72],[104,148,78],[120,150,84],[140,138,92],[96,126,86],[74,118,150]];
  function patches(){
    const ps=520, cx0=Math.floor(cam.x/ps), cz0=Math.floor(cam.z/ps);
    for(let j=9;j>=-3;j--) for(let i=-7;i<=7;i++){ const a=cx0+i, b=cz0+j; const hsh=(((a*73856093)^(b*19349663))>>>0)%97; const col=PATCH[hsh%6===5&&hsh%4?0:hsh%6===5?5:hsh%5];
      rect(a*ps+4,(a+1)*ps-4,b*ps+4,(b+1)*ps-4,col); }
  }
  function ring(g,col,w,alpha){
    const R=60, ux=Math.sin(g.hdg*D2R), uz=Math.cos(g.hdg*D2R), px=uz, pz=-ux; let prev=null;
    for(let i=0;i<=24;i++){ const a=i/24*TAU, q=[g.x+px*R*Math.cos(a), g.h+R*Math.sin(a), g.z+pz*R*Math.cos(a)]; if(prev) line3(prev,q,col,w,alpha); prev=q; }
    line3([g.x,0,g.z],[g.x,g.h-R,g.z],col,2,alpha*0.6);
  }
  function render(){
    cam.x=sim.x; cam.y=sim.h+1.6; cam.z=sim.z; cam.psi=sim.psi; cam.th=sim.th-0.02;
    c.save(); c.clearRect(0,0,W,H);
    c.translate(CX,CY); c.rotate(-sim.phi); c.translate(-CX,-CY);
    const hy=CY+FOC*Math.tan(cam.th), B=3000;
    const g1=c.createLinearGradient(0,hy-420,0,hy); g1.addColorStop(0,rgb(SKY[0])); g1.addColorStop(1,rgb(SKY[1]));
    c.fillStyle=g1; c.fillRect(-B,hy-B,W+2*B,B+1);
    const off2=-cam.psi*FOC;
    c.fillStyle="#8fa6bd"; c.beginPath(); c.moveTo(-B,hy);
    for(let i=-30;i<=40;i++){ const xx=i*70+(off2%4900), yy=hy-30-24*Math.sin(i*1.7)-18*Math.sin(i*0.63+2); c.lineTo(xx,yy); } c.lineTo(W+B,hy); c.closePath(); c.fill();
    const g2=c.createLinearGradient(0,hy,0,hy+300); g2.addColorStop(0,rgb(mix(GRASS,HAZE,.6))); g2.addColorStop(.35,rgb(mix(GRASS,HAZE,.2))); g2.addColorStop(1,rgb(GRASS));
    c.fillStyle=g2; c.fillRect(-B,hy,W+2*B,B);
    if(vec){ patches(); }
    else{
      for(let k=-12;k<=12;k++){ line3([k*250,0,cam.z-1500],[k*250,0,cam.z+9000],"#3e6a30",1,.22); }
      for(let zz=Math.floor((cam.z-300)/250)*250; zz<cam.z+9000; zz+=250){ line3([-3000,0,zz],[3000,0,zz],"#3e6a30",1,.18); }
      const RW=15, L=sim.runL;
      rect(-RW-10,RW+10,-60,L+60,[88,98,84]); rect(-RW,RW,0,L,[62,64,68]);
      rect(-RW,-RW+0.5,0,L,[240,240,240]); rect(RW-0.5,RW,0,L,[240,240,240]);
      for(let zz=20;zz<L-20;zz+=50) rect(-0.4,0.4,zz,zz+30,[240,240,240]);
      for(let i=-6;i<=6;i++){ if(i===0) continue; const cx=i*2.1; rect(cx-0.6,cx+0.6,6,36,[240,240,240]); rect(cx-0.6,cx+0.6,L-36,L-6,[240,240,240]); }
      [-1,1].forEach(sg=>rect(sg*6-1.5,sg*6+1.5,300,345,[240,240,240]));
      [150,450].forEach(pz=>{ [-1,1].forEach(sg=>{ rect(sg*8-1,sg*8+1,pz,pz+22,[240,240,240]); rect(sg*11-1,sg*11+1,pz,pz+22,[240,240,240]); }); });
      rect(-RW,RW,L-1,L,[240,240,240]);
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
      { const wx=26, wz=250, top=toCam(wx,7,wz), bs=toCam(wx,0,wz); if(top[2]>cam.near){ const a=scr(bs), b=scr(top); c.strokeStyle="#ddd"; c.lineWidth=2; c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke();
          const sc2=FOC/top[2], dirx=(sim.cross||0)>0.5?1:(sim.cross||0)<-0.5?-1:0, len=(dirx?5:3)*sc2; c.fillStyle="#ff7a1a"; c.beginPath(); c.moveTo(b[0],b[1]); c.lineTo(b[0]+dirx*len,b[1]+(dirx?0.4:2)*sc2); c.lineTo(b[0]+dirx*len,b[1]+(dirx?2.0:3.2)*sc2); c.lineTo(b[0],b[1]+0.9*sc2); c.closePath(); c.fill(); } }
      papiLights().forEach((l,i)=>{ const p=toCam(-RW-8-i*3.2,0.8,300); if(p[2]<cam.near) return; const q=scr(p), rr=Math.max(3,FOC*1.6/p[2]); c.fillStyle=l.white?"#ffffff":"#ff2d1a"; c.shadowColor=l.white?"#fff":"#ff2d1a"; c.shadowBlur=rr*2; c.beginPath(); c.arc(q[0],q[1],rr,0,TAU); c.fill(); c.shadowBlur=0; });
    }
    if(vec&&route){ for(let j=Math.min(gi+1,4);j>=gi;j--){ const g=route.g[j]; if(j===gi) ring(g,"#ffb300",Math.max(4,U*2.2),1); else ring(g,"#66d9ff",Math.max(3,U*1.6),.55); } }
    c.restore();
    strip(); extras();
  }
  function strip(){
    const y0=H-SH, n=vec?4:3, cy=y0+SH/2+2;
    c.fillStyle="#141a20"; c.fillRect(0,y0,W,SH); c.fillStyle="#222b33"; c.fillRect(0,y0,W,4);
    const xs=i=>W*(i+0.5)/n;
    drawASI(c,xs(0),cy,DR,sim.ias()); drawAI(c,xs(1),cy,DR,sim.phi,sim.th); drawALT(c,xs(2),cy,DR,sim.h*FT,sim.vs()*FT*60);
    if(vec){ const g=route&&route.g[Math.min(gi,4)]; drawDI(c,xs(3),cy,DR,((sim.psi/D2R)%360+360)%360,g?g.hdg:null); }
  }
  function extras(){
    if(landing){ const pl=papiLights(), r=7*U, gap=r*2.9, x0=W-12*U-gap*3-r, y=12*U+r+34*U*0; c.fillStyle="rgba(0,0,0,.55)"; c.fillRect(x0-r*1.6,y-r*1.6,gap*3+r*3.2,r*3.2+r*1.9);
      pl.slice().reverse().forEach((l,i)=>{ c.beginPath(); c.arc(x0+i*gap,y,r,0,TAU); c.fillStyle=l.white?"#fff":"#ff2d1a"; c.fill(); });
      c.fillStyle="#cfd6dc"; c.font="600 "+Math.round(8*U)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="alphabetic"; c.fillText("PAPI",x0+gap*1.5,y+r*2.9); }
    if(vec&&route){ // cinta de rumbo con la marca de la instrucción y la dirección al aro
      const g=route.g[Math.min(gi,4)], tw=Math.min(W-16*U,560*U*0.62*(ctx.aspect>1?1.4:1)), tx=(W-tw)/2, th=22*U, ty=H-SH-th-10*U, hd=((sim.psi/D2R)%360+360)%360, span=80, px=tw/span;
      c.fillStyle="rgba(8,14,20,.6)"; c.fillRect(tx,ty,tw,th);
      c.save(); c.beginPath(); c.rect(tx,ty,tw,th); c.clip();
      c.font="700 "+Math.round(10*U)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle";
      for(let a=Math.floor((hd-span/2)/5)*5;a<=hd+span/2;a+=5){ const xx=tx+tw/2+(a-hd)*px, A=((a%360)+360)%360; c.strokeStyle="#cfd6dc"; c.lineWidth=A%10===0?2:1; c.beginPath(); c.moveTo(xx,ty+th); c.lineTo(xx,ty+th-(A%10===0?th*.32:th*.18)); c.stroke();
        if(A%10===0){ c.fillStyle="#e8f0f6"; c.fillText(A===0?"N":A===90?"E":A===180?"S":A===270?"W":String(A/10).padStart(2,"0"),xx,ty+th*.38); } }
      const mark=(a,col,sh)=>{ const rel=clamp(wrap180(a-hd),-span/2+1,span/2-1), xx=tx+tw/2+rel*px; c.fillStyle=col; c.beginPath(); if(sh) { c.moveTo(xx,ty+th); c.lineTo(xx-6*U*.7,ty+th+8*U*.7); c.lineTo(xx+6*U*.7,ty+th+8*U*.7); } else { c.moveTo(xx,ty); c.lineTo(xx-6*U*.7,ty+8*U*.7); c.lineTo(xx+6*U*.7,ty+8*U*.7); } c.closePath(); c.fill(); };
      if(g){ mark(g.hdg,"#ff8a00",false); const brg=((Math.atan2(g.x-sim.x,g.z-sim.z)/D2R)%360+360)%360; mark(brg,"#66d9ff",true); }
      c.restore();
      c.strokeStyle="#ffc247"; c.lineWidth=2; c.beginPath(); c.moveTo(tx+tw/2,ty-3); c.lineTo(tx+tw/2,ty+th+3); c.stroke(); }
  }

  /* ---- arranque / intro ---- */
  function reset(){
    over=false; said={}; stallT=0; gres=[]; score=0; gi=0; brk=0; kP=0; kA=0; kAv=0;
    if(vec){ route=makeRoute(); sim=FlightSim("air",{V:46,h0:2000/FT,psi0:route.start.hdg*D2R}); ctl.lever.set(sim.thr); }
    else{ route=null; sim=FlightSim(mode,{cross:wind}); if(takeoff){ sim.flap=1; ctl.lever.set(0); } else ctl.lever.set(sim.thr); }
    dbg.sim=sim; dbgF.sim=sim; syncFlap();
  }
  function begin(){ hideOverlay(ctx); reset(); started=true; if(vec) toast(ctx,"Instrucción recibida · sigue el rumbo y la altitud",3); }
  const INTRO={
    takeoff:`<li>Pista de 1&nbsp;500 m, flaps 10°. <b>Gases a fondo</b> (palanca hasta arriba).</li><li>Mantén el eje con el mando a izquierda/derecha.</li><li><b>Rota a Vr ≈ 55 kt</b>: tira del mando hacia ti y suéltalo; el avión mantiene la actitud.</li><li>Sube a <b>Vy ≈ 74 kt</b> hasta 500 ft y cruza el final de pista a más de 50 ft.</li>`,
    landing:`<li>Final de 3° a unos 70 kt, flaps 20°. Guíate por el <b>PAPI</b>: 2 rojas + 2 blancas = en senda.</li><li><b>Gases = senda, mando = velocidad.</b> Corrige el eje con el mando a izquierda/derecha.</li><li>Cerca del suelo reduce gases y <b>recoge</b> suave (flare). Vref ≈ 62 kt.</li><li>Tras tocar, gases al ralentí y <b>frenos</b>.</li>`,
    vectors:`<li>El controlador te da un <b>rumbo</b> y una <b>altitud</b>. Vuela hasta el aro naranja (WPT) y pásalo a esa altitud.</li><li>El mando a izquierda/derecha <b>inclina</b> el avión (máx. 30°); al soltar, nivela.</li><li>Mando hacia ti = morro arriba. Al subir añade gases; al bajar, quítalos. Mantén 70–100 kt.</li><li>Cinta superior: marca <b>naranja</b> = rumbo pedido, <b>azul</b> = dirección al aro.</li>`
  };
  function intro(){
    started=false; over=false; ctx.paused=false;
    const opt=landing?`<div class="fs-opt" style="justify-content:center;margin:0"><span class="fs-seg" role="group" aria-label="Viento"><button data-w="0" aria-pressed="${!wind}">Sin viento</button><button data-w="1" aria-pressed="${!!wind}">Viento cruzado 10 kt</button></span></div>`:"";
    showOverlay(ctx,`<h3>${TITLES[mode]}</h3><ul>${INTRO[mode]}</ul>${opt}<p style="margin:0;font-size:13px;color:#9fb4c5">Teclado: ↑ morro abajo · ↓ morro arriba · ←→ alabeo · E/Q gases${vec?"":" · F flaps · Espacio frenos"}</p><div class="row"><button class="fs-btn" id="goB">Empezar</button></div>`,r=>{
      $("#goB",r).onclick=begin;
      r.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{ wind=+b.dataset.w?(Math.random()<.5?-1:1)*5:0; r.querySelectorAll("[data-w]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
    });
    reset();
  }
  ctx.onNew=intro;

  /* ---- fin y resultado ---- */
  function resultHtml(title,sc,lines,key){
    const best=store.best(key,Math.round(sc));
    showOverlay(ctx,`<h3>${esc(title)}</h3><div class="big ${sc>=70?"fs-ok":sc>=40?"fs-mid":"fs-bad"}">${Math.round(sc)} <small style="font:600 14px system-ui">puntos · mejor ${best==null?"—":best}</small></div><ul>${lines.map(t=>"<li>"+t+"</li>").join("")}</ul><div class="row"><button class="fs-btn" id="againB">Repetir</button><button class="fs-btn sec" id="menuB">Menú</button></div>`,r=>{ $("#againB",r).onclick=intro; $("#menuB",r).onclick=menu; });
  }
  function finish(){
    if(over) return; over=true; started=false;
    const out=[]; let sc=0, title="";
    if(takeoff){
      if(sim.crash){ title="Despegue fallido"; out.push("<span class='fs-bad'>"+sim.crash+"</span>"); }
      else{
        const lo=sim.liftoff||{V:0,z:0}, endH=sim.endH==null?0:sim.endH*FT, V=sim.ias(); let p=0;
        const vrOK=lo.V>=50&&lo.V<=62; p+=vrOK?30:lo.V<50?10:15; out.push(`Despegaste a <b>${lo.V.toFixed(0)} kt</b> tras ${Math.round(lo.z)} m ${vrOK?"<span class='fs-ok'>✔ rotación a Vr (≈55 kt)</span>":lo.V<50?"<span class='fs-bad'>· demasiado pronto: cerca de la pérdida</span>":"<span class='fs-mid'>· tarde: gastas pista</span>"}.`);
        const obs=endH>=50; p+=obs?25:endH>=20?10:0; out.push(`Altura al final de pista: <b>${Math.round(endH)} ft</b> ${obs?"<span class='fs-ok'>✔ más de 50 ft</span>":"<span class='fs-bad'>· menos de 50 ft: obstáculo en riesgo</span>"}.`);
        const vyOK=V>=68&&V<=80; p+=vyOK?25:V>=62?12:0; out.push(`Velocidad a 500 ft: <b>${V.toFixed(0)} kt</b> ${vyOK?"<span class='fs-ok'>✔ cerca de Vy (74 kt)</span>":"<span class='fs-mid'>· Vy da el mejor régimen de ascenso (74 kt)</span>"}.`);
        const cl=Math.abs(sim.x)<=7; p+=cl?20:Math.abs(sim.x)<=15?10:0; out.push(`Desviación del eje: <b>${Math.abs(sim.x).toFixed(0)} m</b> ${cl?"<span class='fs-ok'>✔</span>":""}.`);
        sc=p; title=p>=80?"Despegue limpio":"Despegue completado";
      }
    } else {
      const td=sim.td;
      if(sim.crash||!td){ title="Aterrizaje fallido"; out.push("<span class='fs-bad'>"+(sim.crash||"No llegaste a tocar la pista.")+"</span>"); }
      else{
        const fpm=td.vs*FT*60, Vt=td.V, sink=Math.round(35*clamp(1-(td.vs-1.3)/1.7,0,1)), err=Math.abs(td.z-300), pp=Math.round(25*clamp(1-(err-150)/300,0,1));
        const lat=Math.abs(td.x), lp=Math.round(15*clamp(1-(lat-3)/9,0,1)), dv=Vt<50?50-Vt:Vt>66?Vt-66:0, sp=Math.round(15*clamp(1-dv/20,0,1));
        const rl=sim.stopped&&sim.z<sim.runL&&Math.abs(sim.x)<20?10:0; sc=sink+pp+lp+sp+rl;
        out.push(`Velocidad vertical al tocar: <b>${Math.round(fpm)} fpm</b> ${td.vs<=1.3?"<span class='fs-ok'>✔ suave</span>":td.vs<=2.5?"<span class='fs-mid'>· algo dura</span>":"<span class='fs-bad'>· dura</span>"}.`);
        out.push(`Punto de toma: <b>${Math.round(td.z)} m</b> del umbral ${td.z<0?"<span class='fs-bad'>· ANTES del umbral</span>":err<=150?"<span class='fs-ok'>✔ en la zona de toma (punto de visada a 300 m)</span>":td.z<150?"<span class='fs-mid'>· corto</span>":"<span class='fs-mid'>· largo</span>"}.`);
        out.push(`Velocidad al tocar: <b>${Vt.toFixed(0)} kt</b> (Vref ≈ 62 kt; en el flare pierdes unos nudos) ${dv===0?"<span class='fs-ok'>✔</span>":Vt>66?"<span class='fs-mid'>· rápido: más recorrido y riesgo de rebote</span>":"<span class='fs-mid'>· lento: demasiado cerca de la pérdida (≈47 kt con flaps 20°)</span>"}.`);
        out.push(`Desviación del eje: <b>${lat.toFixed(0)} m</b> ${lat<=3?"<span class='fs-ok'>✔</span>":lat>15?"<span class='fs-bad'>· fuera de pista</span>":""}.`);
        out.push(sim.stopped?(rl?"Frenaste dentro de la pista <span class='fs-ok'>✔</span>.":"Te saliste de la pista al frenar."):"Aún rodando.");
        if(sim.bounces) out.push(`Rebotes: ${sim.bounces} (toque con demasiada velocidad vertical: espera en el flare).`);
        title=sc>=80?"Aterrizaje excelente":sc>=55?"Aterrizaje correcto":"Aterrizaje a mejorar";
      }
    }
    resultHtml(title,sc,out,takeoff?"takeoff":"landing");
  }
  function finishVec(){
    if(over) return; over=true; started=false;
    const pen=Math.min(10,Math.round(stallT*2)); let sc=gres.reduce((a,g)=>a+g.pts,0);
    const out=gres.map((g,i)=>`<b>WPT ${i+1}</b> · ${g.miss?"<span class='fs-bad'>aro no cruzado</span>":`a ${Math.round(g.lat)} m del centro ${g.lat<=40?"<span class='fs-ok'>✔</span>":g.lat<=100?"<span class='fs-mid'>·</span>":"<span class='fs-bad'>·</span>"} · altitud ${g.dAlt>=0?"+":""}${Math.round(g.dAlt)} ft ${Math.abs(g.dAlt)<=50?"<span class='fs-ok'>✔</span>":"<span class='fs-mid'>·</span>"} · rumbo ${g.dHdg>=0?"+":""}${Math.round(g.dHdg)}°`} → <b>${g.pts}</b>`);
    if(sim.crash){ out.unshift("<span class='fs-bad'>"+sim.crash+"</span>"); }
    if(pen) out.push(`<span class='fs-bad'>Pérdida (stall): −${pen} puntos. Con poca velocidad, baja el morro y da gases.</span>`);
    sc=Math.max(0,sc-pen);
    resultHtml(sim.crash?"Vuelo interrumpido":sc>=80?"Vectores perfectos":sc>=50?"Vectores correctos":"Vectores a mejorar",sc,out,"vectors");
  }
  /* ---- vectores: lógica de aros ---- */
  function gateLogic(){
    const g=route.g[gi], ux=Math.sin(g.hdg*D2R), uz=Math.cos(g.hdg*D2R), dx=sim.x-g.x, dz=sim.z-g.z, s=dx*ux+dz*uz, lat=Math.abs(dx*uz-dz*ux);
    const dist=Math.hypot(dx,dz);
    if(s>=0||dist>g.len*1.8+1500){
      const miss=s<0||lat>400, dAlt=(sim.h-g.h)*FT, dHdg=wrap180(((sim.psi/D2R)%360)-g.hdg);
      const pl=miss?0:Math.round(10*clamp(1-(lat-30)/120,0,1)), pa=miss?0:Math.round(6*clamp(1-(Math.abs(dAlt)-50)/200,0,1)), ph=miss?0:(Math.abs(dHdg)<=10?4:Math.abs(dHdg)<=20?2:0);
      const pts=pl+pa+ph; gres.push({miss:miss,lat:lat,dAlt:dAlt,dHdg:dHdg,pts:pts}); score+=pts;
      toast(ctx,miss?`WPT ${gi+1}: aro perdido`:`WPT ${gi+1}: a ${Math.round(lat)} m · ${dAlt>=0?"+":""}${Math.round(dAlt)} ft · +${pts}`,2.6);
      gi++; if(gi>=5) finishVec();
    }
  }
  /* ---- bucle ---- */
  let acc=0, hudT=0;
  const shape=p=>p*(0.55+0.45*Math.abs(p));
  function step(dt){
    if(!started||over||ctx.paused||!sim) return;
    const pad=ctl.pad;
    kAv+=(kA-kAv)*Math.min(1,dt*4);
    if(!dbgF.manual){
      sim.thr=ctl.lever.v; sim.ail=clamp(shape(pad.x)+kAv,-1,1); sim.brake=brk?1:0;
      let pr=clamp(pad.y+kP,-1,1); if(Math.abs(pr)<0.06) pr=0; sim.y=clamp(sim.y+Math.sign(pr)*Math.pow(Math.abs(pr),1.4)*0.9*dt,-0.8,1);
    }
    if(landing&&sim.ground) sim.y+=(0-sim.y)*Math.min(1,dt*0.8);
    pad.setPitchMark(sim.y);
    acc+=dt; let n=0; while(acc>=1/120&&n<20){ sim.step(1/120); acc-=1/120; n++; }
    if(sim.stall) stallT+=dt;
    if(landing){
      if(sim.td&&!said.td){ said.td=1; toast(ctx,"Toma de contacto · gases al ralentí y frena",3); }
      if(!sim.td&&!sim.crash){ if(sim.h>260){ sim.crash="Aproximación interrumpida: subiste sin llegar a aterrizar."; sim.done=true; } else if(sim.z>sim.runL){ sim.crash="Pasaste el final de la pista sin tocar."; sim.done=true; } }
    }
    if(takeoff){
      if(sim.liftoff&&!said.lo){ said.lo=1; toast(ctx,"Despegue a "+sim.liftoff.V.toFixed(0)+" kt · sube a Vy (74 kt)",3); }
      if(sim.ground&&!sim.liftoff&&sim.ias()>=48&&!said.rot){ said.rot=1; toast(ctx,"Vr: tira suave del mando",3); }
    }
    if(vec&&!sim.done) gateLogic();
    if(vec&&sim.done&&!over) finishVec(); else if(!vec&&(sim.crash||sim.done)) finish();
  }
  function hud(dt){
    hudT-=dt; if(hudT>0||!sim) return; hudT=0.1;
    const ias=Math.round(sim.ias()), alt=Math.max(0,Math.round(sim.h*FT/10)*10), vs=Math.round(sim.vs()*FT*60/10)*10;
    const low=!sim.ground&&sim.ias()<sim.stallV(sim.fl())+4;
    let l1="", l2="", l3="";
    if(takeoff) l1=`Pista restante ${fmt(Math.max(0,sim.runL-sim.z))} m`;
    else if(landing) l1=sim.td?`Pista restante ${fmt(Math.max(0,sim.runL-sim.z))} m`:`Distancia al umbral ${fmt(Math.max(0,-sim.z))} m`;
    else if(route&&gi<5){ const g=route.g[gi], d=Math.hypot(g.x-sim.x,g.z-sim.z)/NM; l1=g.en; l2=g.es; l3=`WPT ${gi+1}/5 · ${d.toFixed(1).replace(".",",")} NM · objetivo ${fmt(g.alt)} ft`; }
    setHud(ctx,`<div class="l0"><b>${TITLES[mode]}</b><span class="${low?"bad":""}">${ias} kt</span><span>${fmt(alt)} ft</span><span class="${vs<-700?"bad":""}">${vs>=0?"+":""}${vs} fpm</span></div>${l1?`<div class="l1">${esc(l1)}</div>`:""}${l2?`<div class="l2">${esc(l2)}</div>`:""}${l3?`<div class="l3">${esc(l3)}</div>`:""}${sim.stall?`<div class="warn">STALL · baja el morro</div>`:low&&started?`<div class="warn mid">VELOCIDAD BAJA</div>`:""}`);
  }
  function frame(dt){ if(!sim) return; step(dt); render(); hud(dt); }
  const stopLoop=startLoop(frame);
  const vis=()=>{ if(document.hidden){ ctx.paused=true; ctx.pauseBtn.textContent="Seguir"; } }; document.addEventListener("visibilitychange",vis);
  dbg.g=dbgF; dbgF.ctl=ctl; dbgF.start=begin; Object.defineProperty(dbgF,"route",{get:()=>route}); Object.defineProperty(dbgF,"gi",{get:()=>gi}); Object.defineProperty(dbgF,"over",{get:()=>over}); Object.defineProperty(dbgF,"gres",{get:()=>gres});
  intro();
  return ()=>{ stopLoop(); off(); ctl.pad&&ctl.pad.destroy&&ctl.pad.destroy(); document.removeEventListener("visibilitychange",vis); ctx.onResize=null; ctx.onNew=null; };
}

window.__f0simDebug=()=>dbg;
window.F0Sim={ render(el){ root=el; injectCss(); menu(); }, leave(){ if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; } relayout=null; root=null; }, _FlightSim:FlightSim };
})();
