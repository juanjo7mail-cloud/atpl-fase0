/* ATPL Fase 0 · SIM — minijuegos de vuelo. Sin cuenta, sin servidor: todo corre en el navegador.
   Rodaje (vista cenital) y seis juegos en cabina: despegue, aterrizaje, circuito de tráfico, vectores,
   fallo de motor y aproximación ILS. Modelo de vuelo de monomotor ligero con viento, rachas y resbale.
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
.fs-colL{display:flex;flex-direction:column;gap:6px;flex:none;align-items:center}
.tiller.ped{height:44px;border-radius:22px;width:calc(var(--pad) + 18px);flex:none;min-width:0}
.tiller.ped i{width:36px;height:36px;top:3px;margin-left:-18px}
.tiller.ped:after{content:"PEDALES";position:absolute;left:12px;top:15px;font:600 9px var(--body,inherit);letter-spacing:.1em;color:#5d778c;pointer-events:none}
.fs-brow{display:flex;gap:6px}
.fs-brow .fs-btn{flex:1;min-width:0}
.fs-opt small{flex-basis:100%;font-size:12.5px}
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
.fs-full.port .fs-colL{justify-content:center}
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
const GAMES=[
  ["taxi","#C99A12","🛣️ Rodaje","La torre te da la ruta por las calles de rodaje: sigue las letras, gira donde toca y para en el punto de espera."],
  ["takeoff","#B8500A","🛫 Despegue","Gases a fondo, mantén el eje, rota a Vr y sube a 500 ft a Vy. Con el viento que elijas."],
  ["landing","#2A7A40","🛬 Aterrizaje","Final de 3°, PAPI y recogida. Con viento cruzado o racheado tendrás que corregir la deriva."],
  ["circuit","#7A4FB5","🔁 Circuito de tráfico","Despegue, viento cruzado, viento en cola, base y final a 1 000 ft: el circuito completo."],
  ["vectors","#0B747E","🧭 Vectores","Sigue los rumbos y las altitudes del controlador por una ruta de puntos."],
  ["engine","#B3261E","🔥 Fallo de motor","El motor se para en crucero: mejor planeo, elige campo y aterriza contra el viento."],
  ["ils","#33566F","🌫️ Aproximación ILS","Sin ver nada: intercepta el localizador, baja por la senda y aterriza al salir de la nube."]
];
function menu(){
  if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; }
  const b=store.get(), ctl=b.ctl==="stick"?"stick":"yoke", ped=b.ped==="man"?"man":"auto";
  const bt=k=>b[k]!=null?`Mejor: ${b[k]} puntos`:"Sin jugar todavía";
  root.innerHTML=`<div class="fs">
    <h2>Sim</h2>
    <p class="fs-sub">Siete retos para sentir lo que estudias. Se juega a pantalla completa con el dedo, el ratón, el teclado o inclinando el iPad.</p>
    <div class="fs-menu">${GAMES.map(g=>`<button class="fs-card" data-g="${g[0]}" style="--c:${g[1]}"><img class="fs-th" src="sim-${g[0]}.webp" alt="" loading="lazy" onerror="this.remove()"><b>${g[2]}</b><span>${g[3]}</span><i>${bt(g[0])}</i></button>`).join("")}</div>
    <div class="fs-opt">Mando en pantalla:
      <span class="fs-seg" role="group" aria-label="Tipo de mando"><button data-c="yoke" aria-pressed="${ctl==="yoke"}">Yoke Boeing</button><button data-c="stick" aria-pressed="${ctl==="stick"}">Sidestick Airbus</button></span>
    </div>
    <div class="fs-opt">Pedales (timón de dirección):
      <span class="fs-seg" role="group" aria-label="Pedales"><button data-p="auto" aria-pressed="${ped==="auto"}">Automáticos</button><button data-p="man" aria-pressed="${ped==="man"}">Manuales</button></span>
      <small>${ped==="man"?"Tú coordinas los virajes, guías en pista con los pedales y quitas la deriva al aterrizar.":"El avión vuela coordinado solo; en pista se guía con el mando."}</small>
    </div>
  </div>`;
  root.querySelectorAll("[data-g]").forEach(bn=>bn.onclick=()=>openGame(bn.dataset.g));
  root.querySelectorAll("[data-c]").forEach(bn=>bn.onclick=()=>{ store.put("ctl",bn.dataset.c); menu(); });
  root.querySelectorAll("[data-p]").forEach(bn=>bn.onclick=()=>{ store.put("ped",bn.dataset.p); menu(); });
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
const TITLES={taxi:"Rodaje",takeoff:"Despegue",landing:"Aterrizaje",vectors:"Vectores",circuit:"Circuito de tráfico",engine:"Fallo de motor",ils:"Aproximación ILS"};
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
  else if(land){ const pd=ctx.panel.classList.contains("pd")?50:0; pad=Math.floor(Math.min(pw-24,(ph-pd)*0.5,300)); levH=clamp(ph-pad-pd-58,64,200); }
  else{ const pd=ctx.panel.classList.contains("pd")?50:0; pad=Math.floor(Math.min(ph-4-pd,pw*0.5-18,300)); levH=clamp(ph-34,90,220); }
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
  const paint=()=>{ const w=el.clientWidth-(kn.offsetWidth||52)-12; kn.style.transform=`translateX(${st.x*w/2}px)`; };
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
  const colL=document.createElement("div"); colL.className="fs-colL";
  const padw=document.createElement("div"); padw.className="fs-padw";
  const row2=document.createElement("div"); row2.className="fs-row2";
  const levw=document.createElement("div"); levw.style.cssText="display:flex;flex-direction:column;align-items:center;flex:none";
  const btns=document.createElement("div"); btns.className="fs-btns";
  panel.classList.toggle("tl",!!o.tiller); panel.classList.toggle("pd",!!o.pedals);
  if(o.tiller){ padw.style.cssText="width:100%;height:auto;flex:none"; r.tiller=makeTiller(padw); colL.style.width="100%"; }
  else r.pad=makePad(padw,store.get().ctl==="stick"?"stick":"yoke");
  colL.appendChild(padw);
  if(o.pedals){ r.ped=makeTiller(colL); r.ped.el.classList.add("ped"); }
  const lab=document.createElement("div"); lab.className="fs-lab"; lab.textContent=o.levLabel||"Gases";
  levw.appendChild(lab); r.lever=makeLever(levw,o.init||0,lab,o.levLabel||"Gases");
  row2.appendChild(levw); row2.appendChild(btns);
  panel.appendChild(colL); panel.appendChild(row2);
  r.tilt=(x,y)=>{ if(r.pad) r.pad.tiltSet(x,y); else if(r.tiller) r.tiller.tiltSet(x); };
  r.btn=(id,label,host)=>{ const b=document.createElement("button"); b.className="fs-btn"; b.id=id; b.type="button"; b.textContent=label; (host||btns).appendChild(b); return b; };
  r.row=()=>{ const d=document.createElement("div"); d.className="fs-brow"; btns.appendChild(d); return d; };
  return r;
}

/* ====================================================================== */
/*  Física de vuelo · monomotor ligero tipo C172                           */
/*  Polar calibrada: mejor planeo ≈ 68 kt (L/D ≈ 9), Vs ≈ 50 kt limpio,     */
/*  Vy ≈ 74 kt (≈ 750 fpm), Vr ≈ 55 kt. Viento con gradiente y rachas,      */
/*  efecto suelo, resbale (β) con pedales y deriva real sobre el terreno.   */
/* ====================================================================== */
function FlightSim(o){
  o=o||{};
  const m=1100, S=16.2, RHO=1.2, W=m*G, A0=0.05, SPAN=11, CD0=0.050, KI=0.058, PWR=95000, TST=2300;
  const s={ x:o.x||0, z:o.z||0, h:o.h||0, V:o.V||0, gam:o.gam||0, al:0, th:0, psi:o.psi||0, chi:o.psi||0, phi:0, p:0, y:0, thr:0, flap:o.flap||0,
    brake:0, ail:0, rud:0, ground:!(o.h>0), t:0, engine:true, autoRud:o.autoRud!==false, mu:0.035, muBrake:0.45,
    wind:{ dir:(o.wind&&o.wind.dir)||0, spd:(o.wind&&o.wind.spd)||0, gust:(o.wind&&o.wind.gust)||0 }, turb:o.turb||0,
    td:null, tdN:0, bounces:0, crash:"", liftoff:null, stall:false, stallT:0, maxH:0, Vg:0, beta:0,
    _g:0, _gT:0, _gN:0, _b:0, _r:0, _wx:null, _wz:null, _sd:0, _gf:o.gam||0 };
  const CL0=f=>0.31+0.45*f, AS=f=>0.27-0.03*f;
  const CLf=(a,f)=>{ const as=AS(f), c0=CL0(f); return a<as ? c0+5*a : Math.max(0.6, c0+5*as-3.2*(a-as)); };
  const GE=h=>{ if(h>=SPAN) return 1; const r=16*Math.max(h,0.3)/SPAN; return r*r/(1+r*r); };          // efecto suelo: menos resistencia inducida
  const CDf=(cl,a,f,h)=>CD0+0.07*f*f+0.012*f+KI*cl*cl*GE(h)+(a>AS(f)?1.6*(a-AS(f)):0);
  const Tmax=V=>Math.min(TST, PWR/Math.max(V,8));
  const thrust=()=>s.engine ? ((s.thr-0.04)/0.96)*Tmax(s.V) : -90;                                      // sin motor: hélice en molinete
  s.fl=()=>s.flap/3;
  s.ias=()=>s.V/KT;
  s.vs=()=>s.ground?0:s.V*Math.sin(s.gam);
  s.gs=()=>s.Vg/KT;
  s.hdg=()=>((s.psi/D2R)%360+360)%360;
  s.stallV=f=>Math.sqrt(2*W/(RHO*S*(CL0(f)+5*AS(f))))/KT;
  s.windVec=function(h){ const w=s.wind; if(!w.spd&&!w.gust) return [0,0]; const sp=Math.max(0,(w.spd+s._g))*(0.75+0.5*clamp(h/300,0,1))*KT, d=w.dir*D2R; return [-sp*Math.sin(d), -sp*Math.cos(d)]; };
  s.trim=function(V,gam,flap){ const f=flap/3, q=0.5*RHO*V*V*S, cl=W*Math.cos(gam)/q, a=(cl-CL0(f))/5, d=q*CDf(cl,a,f,99), T=d+W*Math.sin(gam);
    return { y:(a-A0)/0.22, thr:clamp(T/Tmax(V)*0.96+0.04,0,1), al:a }; };
  s.alignTrack=function(trk){            // rumbo y trayectoria aérea para que la derrota sobre el suelo sea «trk» (rad)
    const w=s.windVec(Math.max(s.h,2)), cw=w[0]*Math.cos(trk)-w[1]*Math.sin(trk); s.chi=trk-Math.asin(clamp(cw/Math.max(s.V,10),-0.6,0.6)); s.psi=s.chi; };
  s.setTrim=function(){ const t=s.trim(s.V,s.gam,s.flap); s.y=t.y; s.thr=t.thr; s.al=t.al; s.th=s.gam+t.al; };
  if(!s.ground){ s.setTrim(); const w=s.windVec(s.h); s.Vg=Math.hypot(s.V*Math.sin(s.chi)+w[0], s.V*Math.cos(s.chi)+w[1]); }
  const rnd=()=>Math.random()*2-1;
  s.step=function(dt){
    if(s.crash) return;
    s.t+=dt;
    const f=s.fl();
    // rachas y turbulencia (ruido filtrado)
    if(s.wind.gust){ s._gN-=dt; if(s._gN<=0){ s._gN=1.5+Math.random()*3; s._gT=s.wind.gust*(Math.random()*1.3-0.3); } s._g+=(s._gT-s._g)*Math.min(1,dt/1.1); }
    if(s.turb){ s._b+=(rnd()*s.turb*0.03-s._b)*Math.min(1,dt*3); s._r+=(rnd()*s.turb*0.5-s._r)*Math.min(1,dt*2.5); }
    const wv=s.windVec(Math.max(s.h,2)), wx=wv[0], wz=wv[1];
    if(s.ground){
      const sp=Math.sin(s.psi), cp=Math.cos(s.psi), hw=-(wx*sp+wz*cp), cwR=wx*cp-wz*sp;
      s.V=Math.max(0,s.Vg+hw);
      const q=0.5*RHO*s.V*s.V*S, auth=Math.min(1,(s.V/22)*(s.V/22));
      const tgt=s.y>0?clamp(0.28*s.y*auth,0,0.24):0;
      s.th+=(tgt-s.th)*Math.min(1,dt*2); s.al=s.th; s.gam=0; s.phi=0; s.p=0;
      const cl=CLf(s.al,f), L=q*cl, D=q*CDf(cl,s.al,f,0.3), T=thrust(), N=Math.max(0,W-L), mu=s.mu+(s.brake?s.muBrake:0);
      let F=T-D-mu*N; if(s.Vg<=0.2&&F<0) F=0;
      s.Vg=Math.max(0,s.Vg+F/m*dt);
      const st=s.autoRud?clamp(s.ail+s.rud,-1,1):s.rud, ease=s.autoRud?0.4:1;
      const turn=st*0.45*Math.min(1,0.25+s.Vg/10)*(s.Vg>0.3?1:0) - ease*(s.engine?0.045*s.thr*Math.max(0,1-s.Vg/32):0)*(s.Vg>0.3?1:0) - ease*0.010*cwR*Math.min(1,s.Vg/12);
      s.psi+=turn*dt; s.chi=s.psi; s.beta=0;
      s.x+=s.Vg*Math.sin(s.psi)*dt; s.z+=s.Vg*Math.cos(s.psi)*dt;
      if(L>=W&&s.V>12&&s.th>0.02&&(!s.td||s.thr>0.5)){                                   // despegue: el avión pasa a moverse con la masa de aire
        const ax=s.Vg*Math.sin(s.psi)-wx, az=s.Vg*Math.cos(s.psi)-wz;
        s.ground=false; s._gf=0.012; s.V=Math.hypot(ax,az); s.chi=Math.atan2(ax,az); if(s.autoRud) s.psi=s.chi; s.gam=0.012; s.h=0.05; s._wx=wx; s._wz=wz;
        if(!s.liftoff) s.liftoff={V:s.ias(),z:s.z,x:s.x,t:s.t};
      }
      return;
    }
    // ---- en el aire ----
    if(s._wx!=null){ const dx=wx-s._wx, dz=wz-s._wz; if(dx||dz){ s.V-=dx*Math.sin(s.chi)+dz*Math.cos(s.chi); s.chi-=(dx*Math.cos(s.chi)-dz*Math.sin(s.chi))/Math.max(s.V,15); } }
    s._wx=wx; s._wz=wz;
    const V=Math.max(s.V,5), q=0.5*RHO*V*V*S, as=AS(f);
    let beta=s.psi-s.chi; beta=Math.atan2(Math.sin(beta),Math.cos(beta)); s.beta=beta;
    s._gf+=(s.gam-s._gf)*Math.min(1,dt/5);                                // el piloto «sujeta la actitud»: amortigua el fugoide sin cambiar el trimado
    let aT=A0+0.22*s.y-clamp(0.7*(s.gam-s._gf),-0.07,0.07); if(s.al>as) aT-=(s.al-as)*3;
    s.al+=(aT-s.al)*Math.min(1,dt/0.5);
    const wasStall=s.stall; s.stall=s.al>as; if(s.stall){ s.stallT+=dt; if(!wasStall) s._sd=Math.random()<.5?-1:1; }
    const aE=s.al+s._b, cl=CLf(aE,f), L=q*cl, D=q*(CDf(cl,aE,f,s.h)+0.7*beta*beta), T=thrust();
    const pT=s.ail*1.15*clamp(V/30,0.4,1.2)-0.06*s.phi+0.5*beta+s._r+(s.stall?s._sd*0.55:0);
    s.p+=(pT-s.p)*Math.min(1,dt/0.18); s.phi=clamp(s.phi+s.p*dt,-1.25,1.25);
    s.V=Math.max(5,V+((T*Math.cos(s.al)-D-W*Math.sin(s.gam))/m)*dt);
    s.gam=clamp(s.gam+((L*Math.cos(s.phi)+T*Math.sin(s.al)-W*Math.cos(s.gam))/(m*V))*dt,-1.2,1.2);
    const turn=(L*Math.sin(s.phi))/(m*V*Math.max(0.3,Math.cos(s.gam)));
    s.chi+=(turn+0.14*(V/40)*beta)*dt;
    if(s.autoRud) s.psi=s.chi;
    else s.psi+=(turn-1.6*beta+0.38*s.rud*clamp(V/35,0.3,1.3)-(s.engine?0.05*s.thr*Math.max(0,1-V/45):0))*dt;
    s.th=s.gam+s.al;
    const gvx=s.V*Math.cos(s.gam)*Math.sin(s.chi)+wx, gvz=s.V*Math.cos(s.gam)*Math.cos(s.chi)+wz;
    s.x+=gvx*dt; s.z+=gvz*dt; s.h+=s.V*Math.sin(s.gam)*dt; s.Vg=Math.hypot(gvx,gvz); s.maxH=Math.max(s.maxH,s.h);
    if(s.h<=0){                                                      // contacto con el suelo
      const vs=-s.V*Math.sin(s.gam), trk=Math.atan2(gvx,gvz); let dr=s.psi-trk; dr=Math.atan2(Math.sin(dr),Math.cos(dr));
      const side=s.autoRud?0:Math.abs(gvx*Math.cos(s.psi)-gvz*Math.sin(s.psi));        // con pedales automáticos el avión quita la deriva solo al tocar
      if(!s.td) s.td={ vs:vs, V:s.ias(), z:s.z, x:s.x, th:s.th, phi:s.phi, psi:s.psi, t:s.t, drift:dr/D2R, side:side, gs:s.Vg/KT, trk:trk };
      s.tdN++;
      if(vs>4.2){ s.crash="Impacto demasiado duro: el tren no lo aguanta."; s.h=0; return; }
      if(Math.abs(s.phi)>0.26){ s.crash="Tocaste con un ala: demasiado alabeo en el contacto."; s.h=0; return; }
      if(side>5.5){ s.crash="Tocaste muy atravesado: el tren no aguanta esa carga lateral."; s.h=0; return; }
      if(vs>1.9&&s.bounces<3){ s.bounces++; s.h=0.05; s.gam=Math.min(0.12,vs*0.38/V); s.al=Math.max(0.02,s.al*0.8); return; }
      s.ground=true; s.h=0; s.gam=0; s.th=Math.max(0,s.al*0.7); s.phi=0; s.p=0;
      if(s.autoRud) s.psi=trk;
      s.Vg=Math.max(0,gvx*Math.sin(s.psi)+gvz*Math.cos(s.psi)); s.chi=s.psi;
    }
  };
  return s;
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
  c.fillStyle="rgba(14,19,24,.82)"; c.fillRect(-r*.5,-r*.4,r,r*.28); c.fillRect(-r*.5,r*.2,r,r*.3);
  c.fillStyle="#fff"; c.textAlign="center"; c.textBaseline="middle";
  c.font="500 "+Math.round(r*.11)+"px system-ui,sans-serif"; c.fillText("ALT ft",0,-r*.26);
  c.font="700 "+Math.round(r*.2)+"px system-ui,sans-serif"; c.fillText(String(Math.max(0,Math.round(ftv/10)*10)),0,r*.33);
  c.restore();
}

function drawTC(c,x,y,r,rate,beta){                 // rate en °/s (3 = régimen estándar), beta = resbale (rad)
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#0e1318"; c.fill();
  c.strokeStyle="#fff"; c.lineWidth=3; [[-90,0],[-70,1],[90,0],[70,1]].forEach(a=>{ c.save(); c.rotate(a[0]*D2R); c.beginPath(); c.moveTo(0,-r+2); c.lineTo(0,-r+(a[1]?13:9)); c.stroke(); c.restore(); });
  c.fillStyle="#fff"; c.font="600 "+Math.round(r*.14)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle"; c.fillText("L",-r*.62,r*.36); c.fillText("R",r*.62,r*.36);
  c.font="500 "+Math.round(r*.1)+"px system-ui,sans-serif"; c.fillText("2 MIN",0,r*.82);
  c.save(); c.rotate(clamp(rate/3,-1.6,1.6)*20*D2R); c.strokeStyle="#fff"; c.lineWidth=4; c.lineCap="round";
  c.beginPath(); c.moveTo(-r*.7,0); c.lineTo(r*.7,0); c.moveTo(0,0); c.lineTo(0,-r*.2); c.moveTo(-r*.16,-r*.02); c.lineTo(r*.16,-r*.02); c.stroke(); c.beginPath(); c.arc(0,0,r*.09,0,TAU); c.fill(); c.restore();
  const ty=r*.52, tw=r*.5; c.fillStyle="#d9d4c4"; c.beginPath(); c.moveTo(-tw,ty-r*.1); c.quadraticCurveTo(0,ty+r*.02,tw,ty-r*.1); c.lineTo(tw,ty+r*.07); c.quadraticCurveTo(0,ty+r*.2,-tw,ty+r*.07); c.closePath(); c.fill();
  c.strokeStyle="#111"; c.lineWidth=1.5; [-1,1].forEach(g=>{ c.beginPath(); c.moveTo(g*r*.11,ty-r*.06); c.lineTo(g*r*.11,ty+r*.14); c.stroke(); });
  const bx=clamp(-beta/(8*D2R),-1,1)*tw*.8; c.fillStyle="#111"; c.beginPath(); c.arc(bx,ty+r*.04-Math.abs(bx)*0.12,r*.085,0,TAU); c.fill();
  c.restore();
}
function drawVSI(c,x,y,r,fpm){
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#0e1318"; c.fill();
  const ang=v=>Math.PI+clamp(v,-2000,2000)/2000*150*D2R;
  c.fillStyle="#fff"; c.strokeStyle="#fff"; c.font="600 "+Math.round(r*.15)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle";
  for(let v=-2000;v<=2000;v+=500){ const a=ang(v); c.lineWidth=v%1000===0?2.5:1.5; c.beginPath(); c.moveTo(Math.cos(a)*r*.95,Math.sin(a)*r*.95); c.lineTo(Math.cos(a)*r*(v%1000===0?.82:.87),Math.sin(a)*r*(v%1000===0?.82:.87)); c.stroke();
    if(v%1000===0&&Math.abs(v)<2000||v===0) c.fillText(String(Math.abs(v)/100),Math.cos(a)*r*.66,Math.sin(a)*r*.66); }
  c.font="500 "+Math.round(r*.1)+"px system-ui,sans-serif"; c.fillText("VSI",r*.3,-r*.12); c.fillText("100 ft/min",r*.3,r*.1); c.fillText("UP",-r*.42,-r*.32); c.fillText("DN",-r*.42,r*.32);
  const a=ang(fpm); c.strokeStyle=fpm<-800?"#ff6b5b":"#fff"; c.lineWidth=3; c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8); c.stroke(); c.beginPath(); c.arc(0,0,4,0,TAU); c.fillStyle="#fff"; c.fill();
  c.restore();
}
function drawCDI(c,x,y,r,loc,gs,okL,okG){            // loc, gs: posición de la aguja en puntos (−5…+5); se vuela hacia la aguja
  dialFace(c,x,y,r);
  c.save(); c.translate(x,y); c.beginPath(); c.arc(0,0,r,0,TAU); c.fillStyle="#0e1318"; c.fill(); c.clip();
  c.fillStyle="#fff"; const d=r*.14;
  for(let i=-5;i<=5;i++){ if(!i) continue; c.beginPath(); c.arc(i*d,0,r*.028,0,TAU); c.fill(); c.beginPath(); c.arc(0,i*d,r*.028,0,TAU); c.fill(); }
  c.strokeStyle="#fff"; c.lineWidth=2; c.beginPath(); c.arc(0,0,r*.08,0,TAU); c.stroke();
  c.font="600 "+Math.round(r*.13)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle"; c.fillText("LOC",-r*.55,-r*.72); c.fillText("GS",r*.6,-r*.72);
  if(okL){ const nx=clamp(loc,-5.4,5.4)*d; c.strokeStyle="#ffd24a"; c.lineWidth=4; c.beginPath(); c.moveTo(nx,-r*.72); c.lineTo(nx,r*.72); c.stroke(); }
  else{ c.fillStyle="#d8402e"; c.fillRect(-r*.7,-r*.56,r*.34,r*.2); c.fillStyle="#fff"; c.font="700 "+Math.round(r*.11)+"px system-ui"; c.fillText("OFF",-r*.53,-r*.46); }
  if(okG){ const ny=clamp(gs,-5.4,5.4)*d; c.strokeStyle="#7fe0ff"; c.lineWidth=4; c.beginPath(); c.moveTo(-r*.72,ny); c.lineTo(r*.72,ny); c.stroke(); }
  else{ c.fillStyle="#d8402e"; c.fillRect(r*.42,-r*.56,r*.34,r*.2); c.fillStyle="#fff"; c.font="700 "+Math.round(r*.11)+"px system-ui"; c.fillText("OFF",r*.59,-r*.46); }
  c.restore();
}

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
/*  Juegos en cabina: despegue, aterrizaje, circuito, vectores,            */
/*  fallo de motor y aproximación ILS. Pista 36/18 sobre el eje norte.      */
/* ====================================================================== */
const RW={ len:1500, hw:15 };
const WXS=[
  { k:"calm",  t:"Calma",            w:()=>({dir:0,spd:0,gust:0}), turb:0 },
  { k:"head",  t:"En cara 10 kt",    w:()=>({dir:350+Math.round(Math.random()*2)*10,spd:10,gust:0}), turb:0.3 },
  { k:"cross", t:"Cruzado 10 kt",    w:()=>({dir:Math.random()<.5?270:90,spd:10,gust:0}), turb:0.3 },
  { k:"gust",  t:"Racheado 12G22",   w:()=>({dir:Math.random()<.5?320:40,spd:12,gust:10}), turb:1 }
];
const p3=n=>String(Math.round(n)).padStart(3,"0");
function windTxt(w){ return w&&w.spd?`${p3(w.dir||360)}°/${w.spd}${w.gust?"G"+(w.spd+w.gust):""} kt`:"calma"; }
/* dígitos de pista (7 segmentos sobre el asfalto) */
const SEG7={ "0":"abcdef","1":"bc","2":"abged","3":"abgcd","6":"afgedc","8":"abcdefg","9":"abfgcd" };

function flightGame(ctx,mode){
  const takeoff=mode==="takeoff", landing=mode==="landing", vec=mode==="vectors", circuit=mode==="circuit", engine=mode==="engine", ils=mode==="ils";
  const usesRunway=!vec&&!engine, manRud=store.get().ped==="man";
  const cv=ctx.cv, dbgF={ manual:false, kind:mode };
  let W=960,H=540,c,FOC=912,CX=480,CY=190,DR=62,SH=140,U=2,ROWS=1;
  const ctl=buildPanel(ctx.panel,{levLabel:"Gases",init:0,pedals:manRud});
  let bFlapUp=null,bFlapDn=null,bBrk=null;
  if(!vec){ const r=ctl.row(); bFlapUp=ctl.btn("flFu","Flaps −",r); bFlapDn=ctl.btn("flFd","Flaps +",r); bBrk=ctl.btn("flBrk","Frenos"); }
  function size(){ W=960; H=Math.max(380,Math.round(960/ctx.aspect)); c=fitCanvas(cv,W,H); FOC=W*0.95; CX=W/2; U=W/Math.max(300,ctx.cw||W);
    ROWS=ctx.aspect>=1.2?1:2; DR=ROWS===1?Math.min(W/12-9,H*0.125):Math.min(W/6-16,H*0.095); DR=Math.max(46,DR); SH=ROWS*(2*DR+18)+10; CY=(H-SH)*0.47; }
  ctx.onResize=size; size();
  const sc=makeScenery(takeoff?11:23);
  let sim=null, wxK=store.get().wx||"calm", wx=WXS[0], ceil=200, over=false, started=false, score=0, kP=0, kA=0, kAv=0, kR=0, kRv=0, brk=0, said={}, T=0, st={};
  if(!WXS.some(w=>w.k===wxK)) wxK="calm";
  const FLAPS=[0,10,20,30];
  const flap=d=>{ if(sim&&!over){ sim.flap=clamp(sim.flap+d,0,3); toast(ctx,"Flaps "+FLAPS[sim.flap]+"°",1.2); } };
  if(bFlapUp){ bFlapUp.onclick=()=>flap(-1); bFlapDn.onclick=()=>flap(1); holdBtn(bBrk,()=>brk=1,()=>brk=0); }
  const lv=d=>ctl.lever.set(ctl.lever.v+d);
  const off=keyboard({ ArrowDown:[()=>kP=1,()=>kP=0], ArrowUp:[()=>kP=-1,()=>kP=0], ArrowLeft:[()=>kA=-1,()=>kA=0], ArrowRight:[()=>kA=1,()=>kA=0],
    z:[()=>kR=-1,()=>kR=0], x:[()=>kR=1,()=>kR=0], e:[()=>lv(0.05),null,()=>lv(0.04)], q:[()=>lv(-0.05),null,()=>lv(-0.04)], PageUp:[()=>lv(0.05),null,()=>lv(0.04)], PageDown:[()=>lv(-0.05),null,()=>lv(-0.04)],
    f:[()=>flap(1)], r:[()=>flap(-1)], b:[()=>brk=1,()=>brk=0], " ":[()=>brk=1,()=>brk=0] });

  /* ---------------- 3D ---------------- */
  const cam={x:0,y:0,z:0,psi:0,th:0,near:0.6};
  let vis=12000, FOG=HAZE, inCloud=false;
  const TODS={ day:{t:"Día",sky:SKY,fog:HAZE,amb:[1,1,1],m1:[143,166,189],m2:[169,188,205],cl:[255,255,255],cl2:[201,214,226],ca:0.8},
    dusk:{t:"Atardecer",sky:[[40,58,108],[240,150,90]],fog:[190,146,128],amb:[0.8,0.63,0.56],m1:[84,76,104],m2:[128,102,116],cl:[255,190,146],cl2:[146,106,120],ca:0.75},
    night:{t:"Noche",sky:[[3,6,16],[16,24,46]],fog:[13,19,34],amb:[0.15,0.18,0.26],m1:[8,12,24],m2:[12,17,31],cl:[36,44,62],cl2:[20,26,40],ca:0.5} };
  let todK=store.get().tod||"day"; if(!TODS[todK]) todK="day";
  let PAL=TODS.day, NIGHT=false, dyn=[];
  const lit=c=>[c[0]*PAL.amb[0],c[1]*PAL.amb[1],c[2]*PAL.amb[2]];
  const STARS=(function(){ let s=11; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; const a=[]; for(let i=0;i<110;i++) a.push([r()*TAU,0.06+r()*1.2,0.6+r()*1.2]); return a; })();
  function skyDir(az,el){ const a=az-cam.psi, d=[Math.sin(a)*Math.cos(el),Math.sin(el),Math.cos(a)*Math.cos(el)], cp=Math.cos(cam.th), sp=Math.sin(cam.th), y1=d[1]*cp-d[2]*sp, z1=d[1]*sp+d[2]*cp; return z1>0.08?[CX+FOC*d[0]/z1, CY-FOC*y1/z1]:null; }
  const fogF=d=>1-Math.exp(-d/vis);
  const toCam=(X,Y,Z)=>{ const dx=X-cam.x, dy=Y-cam.y, dz=Z-cam.z, cy=Math.cos(cam.psi), sy=Math.sin(cam.psi), cp=Math.cos(cam.th), sp=Math.sin(cam.th);
    const x1=dx*cy-dz*sy, z1=dx*sy+dz*cy; return [x1, dy*cp-z1*sp, dy*sp+z1*cp]; };
  const scr=p=>[CX+FOC*p[0]/p[2], CY-FOC*p[1]/p[2]];
  function clipNear(pts){ const out=[]; for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length], ai=a[2]>=cam.near, bi=b[2]>=cam.near;
      if(ai) out.push(a); if(ai!==bi){ const t=(cam.near-a[2])/(b[2]-a[2]); out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),cam.near]); } } return out; }
  function poly(pts3,col,alpha){ const cp=clipNear(pts3.map(p=>toCam(p[0],p[1],p[2]))); if(cp.length<3) return; let zs=0; c.beginPath(); cp.forEach((p,i)=>{ const q=scr(p); zs+=p[2]; i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]); }); c.closePath();
    const hz=fogF(zs/cp.length); if(hz>0.985) return; c.globalAlpha=alpha==null?1:alpha; c.fillStyle=rgb(mix(lit(col),FOG,hz)); c.fill(); c.globalAlpha=1; }
  function line3(a,b,col,w,alpha){ let p=toCam(a[0],a[1],a[2]), q=toCam(b[0],b[1],b[2]); if(p[2]<cam.near&&q[2]<cam.near) return; if(p[2]<cam.near){ const t=(cam.near-p[2])/(q[2]-p[2]); p=[lerp(p[0],q[0],t),lerp(p[1],q[1],t),cam.near]; } else if(q[2]<cam.near){ const t=(cam.near-q[2])/(p[2]-q[2]); q=[lerp(q[0],p[0],t),lerp(q[1],p[1],t),cam.near]; }
    const hz=fogF((p[2]+q[2])/2); if(hz>0.98) return; const s1=scr(p), s2=scr(q); c.globalAlpha=(alpha==null?1:alpha)*(1-hz); c.strokeStyle=col; c.lineWidth=w; c.beginPath(); c.moveTo(s1[0],s1[1]); c.lineTo(s2[0],s2[1]); c.stroke(); c.globalAlpha=1; }
  const rect=(x0,x1,z0,z1,col,y)=>poly([[x0,y||0,z0],[x1,y||0,z0],[x1,y||0,z1],[x0,y||0,z1]],col);
  function light(x,y,z,col,size){ const p=toCam(x,y,z); if(p[2]<cam.near) return; const a=Math.exp(-p[2]/(vis*2.4)); if(a<0.04) return; const q=scr(p), rr=clamp(FOC*(size||0.5)/p[2],1.3*U*0.5,5*U*0.5);
    if(NIGHT){ c.globalAlpha=Math.min(1,a)*0.22; c.fillStyle=col; c.beginPath(); c.arc(q[0],q[1],rr*2.8,0,TAU); c.fill(); }
    c.globalAlpha=Math.min(1,a*1.2); c.fillStyle=col; c.beginPath(); c.arc(q[0],q[1],rr,0,TAU); c.fill(); c.globalAlpha=1; }
  function label3(x,y,z,t,bg){ const p=toCam(x,y,z); if(p[2]<cam.near+5) return; const q=scr(p); if(q[0]<-40||q[0]>W+40||q[1]<0||q[1]>H-SH) return; const fs=Math.round(12*U); c.font="700 "+fs+"px system-ui,sans-serif"; const w=c.measureText(t).width+fs*0.9;
    c.fillStyle=bg||"rgba(8,14,20,.75)"; c.fillRect(q[0]-w/2,q[1]-fs*1.5,w,fs*1.4); c.fillStyle="#fff"; c.textAlign="center"; c.textBaseline="middle"; c.fillText(t,q[0],q[1]-fs*0.78);
    c.strokeStyle="rgba(255,255,255,.7)"; c.lineWidth=1.5; c.beginPath(); c.moveTo(q[0],q[1]-fs*0.1); c.lineTo(q[0],q[1]+fs*0.9); c.stroke(); }
  function papiLights(){ const hl=Math.max(0,sim.h)+0.8, dist=Math.max(5,300-sim.z), el=Math.atan2(hl,dist)/D2R; return [3.5,3.17,2.83,2.5].map(t=>({white:el>=t})); }
  const PATCH=[[88,134,72],[104,148,78],[120,150,84],[146,140,92],[96,126,86],[112,138,70],[74,118,150]];
  const hsh3=(a,b,k)=>((((a*73856093)^(b*19349663)^(k*83492791))>>>0)%10007)/10007;
  function patches(){
    const ps=520, cx0=Math.floor(cam.x/ps), cz0=Math.floor(cam.z/ps), R=vis<4000?Math.min(10,Math.ceil(vis*2.6/ps)):10; dyn=[];
    for(let b=cz0-R;b<=cz0+R;b++) for(let a=cx0-R;a<=cx0+R;a++){
      const mx=(a+0.5)*ps, mz=(b+0.5)*ps, pc=toCam(mx,0,mz); if(pc[2]<-ps*0.75) continue; const d=Math.hypot(mx-cam.x,mz-cam.z); if(d>R*ps) continue;
      const hsh=(((a*73856093)^(b*19349663))>>>0)%97; let col=PATCH[hsh%6], kind=0; if(hsh%19===0){ col=PATCH[6]; kind=1; } else if(hsh%11===3){ col=[52,92,54]; kind=2; } else if(hsh%13===5){ col=[128,126,112]; kind=3; }
      if(usesRunway&&Math.abs(mx)<960&&mz>-1200&&mz<RW.len+800){ col=GRASS; kind=0; }
      const fd=clamp((d-0.5*R*ps)/(0.5*R*ps),0,1); if(fd>0) col=mix(col,GRASS,fd*fd);
      rect(a*ps+5,(a+1)*ps-5,b*ps+5,(b+1)*ps-5,col);
      if(kind===2&&d<1700){ for(let k=0;k<9;k++) dyn.push({k:"t",o:{x:a*ps+30+hsh3(a,b,k)*(ps-60),z:b*ps+30+hsh3(a,b,k+40)*(ps-60),h:9+hsh3(a,b,k+80)*7}}); }
      if(kind===3){ if(d<2300){ for(let k=0;k<6;k++){ const w=8+hsh3(a,b,k+7)*6; dyn.push({k:"b",o:{x:a*ps+60+hsh3(a,b,k)*(ps-120),z:b*ps+60+hsh3(a,b,k+20)*(ps-120),w:w,d:7+hsh3(a,b,k+30)*6,h:4+hsh3(a,b,k+50)*4,c:[196,186,170],roof:[150,84,62]}}); } }
        if(PAL!==TODS.day){ for(let k=0;k<5;k++) light(a*ps+60+hsh3(a,b,k)*(ps-120),3,b*ps+60+hsh3(a,b,k+20)*(ps-120),"#ffd27a",0.6); } }
    }
  }
  function digits(txt,zc,flip){          // pinta el número de pista con rectángulos
    const dw=3.2, dh=9, th=0.9, gap=2.2, tot=txt.length*dw+(txt.length-1)*gap, wht=[236,238,240];
    const R=(x0,x1,z0,z1)=>{ if(flip) rect(-x1,-x0,RW.len-z1,RW.len-z0,wht); else rect(x0,x1,z0,z1,wht); };
    [...txt].forEach((ch,i)=>{ const x0=-tot/2+i*(dw+gap), z0=zc, s=SEG7[ch]||"";
      if(s.includes("a")) R(x0,x0+dw,z0+dh-th,z0+dh); if(s.includes("g")) R(x0,x0+dw,z0+dh/2-th/2,z0+dh/2+th/2); if(s.includes("d")) R(x0,x0+dw,z0,z0+th);
      if(s.includes("f")) R(x0,x0+th,z0+dh/2,z0+dh); if(s.includes("b")) R(x0+dw-th,x0+dw,z0+dh/2,z0+dh); if(s.includes("e")) R(x0,x0+th,z0,z0+dh/2); if(s.includes("c")) R(x0+dw-th,x0+dw,z0,z0+dh/2); });
  }
  function airfield(){
    const L=RW.len, hw=RW.hw, wht=[236,238,240], asp=[60,63,68];
    rect(-hw-12,hw+12,-70,L+70,[86,104,80]); rect(-hw,hw,0,L,asp);
    rect(-hw,-hw+0.5,0,L,wht); rect(hw-0.5,hw,0,L,wht);
    for(let zz=95;zz<L-95;zz+=50) rect(-0.4,0.4,zz,zz+30,wht);
    for(let i=-6;i<=6;i++){ if(i===0) continue; const cx=i*2.1; rect(cx-0.6,cx+0.6,6,36,wht); rect(cx-0.6,cx+0.6,L-36,L-6,wht); }
    digits("36",46,false); digits("18",46,true);
    [-1,1].forEach(sg=>{ rect(sg*6-1.5,sg*6+1.5,300,345,wht); rect(sg*6-1.5,sg*6+1.5,L-345,L-300,wht); });
    [150,450].forEach(pz=>{ [-1,1].forEach(sg=>{ rect(sg*8-1,sg*8+1,pz,pz+22,wht); rect(sg*11-1,sg*11+1,pz,pz+22,wht); }); });
    // calle de rodaje paralela, enlaces y plataforma
    const tx=-70, tc=[78,82,88];
    rect(tx-5,tx+5,40,L-40,tc); [60,760,L-60].forEach(z=>rect(tx,-hw,z-5,z+5,tc)); rect(-150,tx-5,860,1100,[84,88,94]);
    line3([tx,0.02,45],[tx,0.02,L-45],"#e6b422",1.2,.8);
  }
  function objects(){
    const items=[]; if(usesRunway){ sc.trees.forEach(t=>items.push({k:"t",o:t,d:toCam(t.x,0,t.z)[2]})); sc.boxes.forEach(b=>items.push({k:"b",o:b,d:toCam(b.x,0,b.z)[2]})); }
    dyn.forEach(it=>{ it.d=toCam(it.o.x,0,it.o.z)[2]; items.push(it); });
    items.sort((a,b)=>b.d-a.d);
    items.forEach(it=>{
      if(it.d<cam.near+1||fogF(it.d)>0.97) return;
      if(it.k==="t"){ const t=it.o, b=toCam(t.x,0,t.z), tp=toCam(t.x,t.h,t.z); const sb=scr(b), stp=scr(tp), hh=sb[1]-stp[1]; if(hh<1.5) return;
        const hz=fogF(it.d); c.fillStyle=rgb(mix(lit([40,78,40]),FOG,hz)); c.beginPath(); c.ellipse(sb[0],sb[1]-hh*.6,hh*.22,hh*.4,0,0,TAU); c.fill();
        c.fillStyle=rgb(mix(lit([80,60,40]),FOG,hz)); c.fillRect(sb[0]-hh*.025,sb[1]-hh*.25,hh*.05,hh*.25); }
      else{ const b=it.o, x0=b.x-b.w/2, x1=b.x+b.w/2, z0=b.z, z1=b.z+b.d;
        poly([[x0,0,z0],[x1,0,z0],[x1,b.h,z0],[x0,b.h,z0]],mix(b.c,[0,0,0],.12)); poly([[x1,0,z0],[x1,0,z1],[x1,b.h,z1],[x1,b.h,z0]],mix(b.c,[0,0,0],.28)); poly([[x0,0,z0],[x0,0,z1],[x0,b.h,z1],[x0,b.h,z0]],mix(b.c,[0,0,0],.22)); poly([[x0,0,z1],[x1,0,z1],[x1,b.h,z1],[x0,b.h,z1]],mix(b.c,[0,0,0],.18)); poly([[x0,b.h,z0],[x1,b.h,z0],[x1,b.h,z1],[x0,b.h,z1]],b.roof); }
    });
  }
  function windsock(){
    const wx0=26, wz0=250, top=toCam(wx0,7,wz0), bs=toCam(wx0,0,wz0); if(top[2]<cam.near||fogF(top[2])>0.9) return;
    const a=scr(bs), b=scr(top); c.strokeStyle="#ddd"; c.lineWidth=2; c.beginPath(); c.moveTo(a[0],a[1]); c.lineTo(b[0],b[1]); c.stroke();
    const wv=sim.windVec(8), sp=Math.hypot(wv[0],wv[1]), len=4.5, droop=clamp(1-sp/8,0,1);
    const ex=sp>0.3?wv[0]/sp:0, ez=sp>0.3?wv[1]/sp:0, tip=[wx0+ex*len*(1-droop*0.8), 7-droop*3.6-0.3, wz0+ez*len*(1-droop*0.8)];
    const q=toCam(tip[0],tip[1],tip[2]); if(q[2]<cam.near) return; const e=scr(q), s2=FOC/top[2];
    c.fillStyle="#ff7a1a"; c.beginPath(); c.moveTo(b[0],b[1]-0.5*s2); c.lineTo(e[0],e[1]-0.2*s2); c.lineTo(e[0],e[1]+0.3*s2); c.lineTo(b[0],b[1]+0.6*s2); c.closePath(); c.fill();
  }
  function rwyLights(){
    const L=RW.len, hw=RW.hw;
    for(let z=0;z<=L;z+=60){ light(-hw-1,0.4,z,"#fff7d6",0.45); light(hw+1,0.4,z,"#fff7d6",0.45); }
    for(let x=-hw;x<=hw;x+=3){ light(x,0.3,-1,"#39e06a",0.4); light(x,0.3,L+1,"#ff3b30",0.4); }
    if(ils){ for(let z=-30;z>=-420;z-=30) light(0,0.6,z,"#ffffff",0.7); for(let x=-12;x<=12;x+=3) light(x,0.6,-300,"#ffffff",0.6); }
    papiLights().forEach((l,i)=>light(-hw-8-i*3.2,0.8,300,l.white?"#ffffff":"#ff2d1a",1.5));
  }
  const CLOUDS=(function(){ let s=5; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; }; const a=[]; for(let i=0;i<18;i++) a.push({x:(r()-.5)*26000,z:(r()-.5)*26000+3000,y:1300+r()*700,r:500+r()*600}); return a; })();
  function clouds(){
    CLOUDS.map(cl=>({cl:cl,p:toCam(cl.x,cl.y,cl.z)})).filter(o=>o.p[2]>200).sort((a,b)=>b.p[2]-a.p[2]).forEach(o=>{
      const q=scr(o.p), rr=FOC*o.cl.r/o.p[2], a=0.8*(1-fogF(o.p[2]*0.35)); if(rr<3||a<0.05) return;
      c.globalAlpha=a*PAL.ca/0.8; c.fillStyle=rgb(PAL.cl); c.beginPath(); c.ellipse(q[0],q[1],rr,rr*0.26,0,0,TAU); c.fill(); c.beginPath(); c.ellipse(q[0]-rr*0.35,q[1]-rr*0.1,rr*0.5,rr*0.2,0,0,TAU); c.fill(); c.beginPath(); c.ellipse(q[0]+rr*0.3,q[1]-rr*0.14,rr*0.45,rr*0.22,0,0,TAU); c.fill();
      c.fillStyle=rgb(PAL.cl2); c.globalAlpha=a*0.5; c.beginPath(); c.ellipse(q[0],q[1]+rr*0.1,rr*0.9,rr*0.12,0,0,TAU); c.fill(); c.globalAlpha=1; });
  }
  function render(){
    const eye=sim.ground?1.5:1.6;
    cam.x=sim.x; cam.y=sim.h+eye; cam.z=sim.z; cam.psi=sim.psi; cam.th=sim.th-0.02;
    // visibilidad: en el ILS hay techo de nubes; por encima no se ve nada
    if(ils){ const cb=ceil/FT; inCloud=cam.y>cb; vis=inCloud?clamp(140+(cb+60-cam.y)*0,90,140):lerp(700,3200,clamp((cb-cam.y)/25,0,1)); FOG=[168,174,180]; }
    else{ PAL=TODS[todK]; NIGHT=todK==="night"; vis=(wxK==="gust"?9000:13000)*(NIGHT?0.75:1); FOG=PAL.fog; inCloud=false; }
    if(ils){ PAL=TODS.day; NIGHT=false; }
    c.save(); c.clearRect(0,0,W,H);
    c.translate(CX,CY); c.rotate(-sim.phi); c.translate(-CX,-CY);
    const hy=CY+FOC*Math.tan(cam.th), B=3200;
    if(ils){ c.fillStyle=rgb(FOG); c.fillRect(-B,hy-B,W+2*B,B+1); c.fillStyle=rgb(mix(GRASS,FOG,inCloud?1:clamp(1-Math.exp(-(cam.y*6+60)/vis),0,1))); c.fillRect(-B,hy,W+2*B,B);
      const g2=c.createLinearGradient(0,hy,0,hy+260); g2.addColorStop(0,rgb(FOG)); g2.addColorStop(1,"rgba(168,174,180,0)"); c.fillStyle=g2; c.fillRect(-B,hy,W+2*B,260); }
    else{
      const g1=c.createLinearGradient(0,hy-480,0,hy); g1.addColorStop(0,rgb(PAL.sky[0])); g1.addColorStop(1,rgb(PAL.sky[1])); c.fillStyle=g1; c.fillRect(-B,hy-B,W+2*B,B+1);
      if(NIGHT){ c.fillStyle="#fff"; STARS.forEach(sd=>{ const q=skyDir(sd[0],sd[1]); if(q){ c.globalAlpha=0.35+0.4*(sd[2]-0.6); c.fillRect(q[0],q[1],sd[2]*U*0.8,sd[2]*U*0.8); } }); c.globalAlpha=1; }
      // sol (o luna)
      { const q=todK==="day"?skyDir(135*D2R,34*D2R):todK==="dusk"?skyDir(272*D2R,3.5*D2R):skyDir(200*D2R,38*D2R);
        if(q){ const R=todK==="dusk"?230:170, rg=c.createRadialGradient(q[0],q[1],0,q[0],q[1],R); if(todK==="night"){ rg.addColorStop(0,"rgba(236,240,250,.95)"); rg.addColorStop(0.07,"rgba(236,240,250,.9)"); rg.addColorStop(0.09,"rgba(200,214,240,.16)"); rg.addColorStop(1,"rgba(200,214,240,0)"); }
          else if(todK==="dusk"){ rg.addColorStop(0,"rgba(255,236,190,.98)"); rg.addColorStop(0.1,"rgba(255,170,90,.6)"); rg.addColorStop(1,"rgba(255,140,80,0)"); } else { rg.addColorStop(0,"rgba(255,250,225,.95)"); rg.addColorStop(0.12,"rgba(255,244,200,.55)"); rg.addColorStop(1,"rgba(255,244,200,0)"); }
          c.fillStyle=rg; c.fillRect(q[0]-R,q[1]-R,2*R,2*R); } }
      clouds();
      const off2=-cam.psi*FOC;
      c.fillStyle=rgb(PAL.m1); c.beginPath(); c.moveTo(-B,hy); for(let i=-34;i<=44;i++){ const xx=i*70+(off2%4900), yy=hy-26-22*Math.sin(i*1.7)-16*Math.sin(i*0.63+2); c.lineTo(xx,yy); } c.lineTo(W+B,hy); c.closePath(); c.fill();
      c.fillStyle=rgb(PAL.m2); c.beginPath(); c.moveTo(-B,hy); for(let i=-34;i<=44;i++){ const xx=i*90+((off2*0.8)%6300), yy=hy-10-12*Math.sin(i*2.3+1)-8*Math.sin(i*0.9); c.lineTo(xx,yy); } c.lineTo(W+B,hy); c.closePath(); c.fill();
      const g2=c.createLinearGradient(0,hy,0,hy+300); g2.addColorStop(0,rgb(mix(lit(GRASS),FOG,.62))); g2.addColorStop(.35,rgb(mix(lit(GRASS),FOG,.22))); g2.addColorStop(1,rgb(lit(GRASS))); c.fillStyle=g2; c.fillRect(-B,hy,W+2*B,B);
    }
    if(!inCloud){
      patches();
      if(usesRunway) airfield();
      objects();
      if(usesRunway){ windsock(); rwyLights(); }
      if(M.draw3d) M.draw3d();
    }
    c.restore();
    cockpit(); if(M.overlay) M.overlay();
  }
  /* ---------------- cabina ---------------- */
  function cockpit(){
    const y0=H-SH;
    // capó y parabrisas
    c.fillStyle="#0c1116"; c.beginPath(); c.moveTo(0,y0+2); c.lineTo(0,y0-6*U*0.4); c.quadraticCurveTo(W/2,y0-34*U*0.5,W,y0-6*U*0.4); c.lineTo(W,y0+2); c.closePath(); c.fill();
    if(sim&&!sim.engine){ c.save(); c.translate(W/2,y0-14*U*0.5); c.rotate(-0.5); c.fillStyle="#15191d"; c.beginPath(); c.moveTo(-7*U,0); c.quadraticCurveTo(-3*U,-70*U*0.6,-1.5*U,-120*U*0.6); c.lineTo(3*U,-120*U*0.6); c.quadraticCurveTo(7*U,-60*U*0.6,7*U,0); c.closePath(); c.fill(); c.fillStyle="#e6b422"; c.fillRect(-1.5*U,-120*U*0.6,4.5*U,7*U*0.6); c.restore(); }
    else if(sim){ c.strokeStyle="rgba(230,236,242,.10)"; c.lineWidth=3*U*0.5; c.beginPath(); c.ellipse(W/2,y0-6*U,W*0.17,W*0.15,0,Math.PI*1.08,Math.PI*1.92); c.stroke(); }
    c.fillStyle="#1a2128"; c.beginPath(); c.ellipse(W/2,y0+2,W*0.15,15*U*0.5,0,Math.PI,TAU); c.fill(); c.fillStyle="#0c1116"; c.beginPath(); c.ellipse(W/2,y0-9*U*0.5,W*0.022,5*U*0.5,0,0,TAU); c.fill();
    const pg=c.createLinearGradient(0,y0,0,H); pg.addColorStop(0,"#1c232b"); pg.addColorStop(1,"#11161b"); c.fillStyle=pg; c.fillRect(0,y0,W,SH); c.fillStyle="#2b353f"; c.fillRect(0,y0,W,3);
    const n=ROWS===1?6:3, cw=W/n, pos=i=>ROWS===1?[cw*(i+0.5),y0+SH/2+2]:[cw*((i%3)+0.5), y0+8+(DR+9)*(1+2*Math.floor(i/3))];
    const vsf=sim.vs()*FT*60, rate=sim.ground?0:(G*Math.tan(sim.phi)/Math.max(sim.V,15))/D2R;
    let p=pos(0); drawASI(c,p[0],p[1],DR,sim.ias());
    p=pos(1); drawAI(c,p[0],p[1],DR,sim.phi,sim.th);
    p=pos(2); drawALT(c,p[0],p[1],DR,sim.h*FT,vsf);
    p=pos(3); if(M.cdi){ const d=M.cdi(); drawCDI(c,p[0],p[1],DR,d.loc,d.gs,d.okL,d.okG); } else drawTC(c,p[0],p[1],DR,rate,sim.beta);
    p=pos(4); drawDI(c,p[0],p[1],DR,sim.hdg(),M.bug?M.bug():null);
    p=pos(5); drawVSI(c,p[0],p[1],DR,vsf);
  }
  function papiInset(){
    const pl=papiLights(), r=7*U, gap=r*2.9, x0=12*U+r, y=H-SH-22*U-r; c.fillStyle="rgba(0,0,0,.55)"; c.fillRect(x0-r*1.6,y-r*1.6,gap*3+r*3.2,r*3.2+r*1.9);
    pl.slice().reverse().forEach((l,i)=>{ c.beginPath(); c.arc(x0+i*gap,y,r,0,TAU); c.fillStyle=l.white?"#fff":"#ff2d1a"; c.fill(); });
    c.fillStyle="#cfd6dc"; c.font="600 "+Math.round(8*U)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="alphabetic"; c.fillText("PAPI",x0+gap*1.5,y+r*2.9);
  }
  function tape(bug,brg){
    const tw=Math.min(W-16*U,ctx.aspect>1?480*U*0.75:W-16*U), tx=(W-tw)/2, th=22*U, ty=H-SH-th-10*U, hd=sim.hdg(), span=80, px=tw/span;
    c.fillStyle="rgba(8,14,20,.6)"; c.fillRect(tx,ty,tw,th);
    c.save(); c.beginPath(); c.rect(tx,ty-9*U,tw,th+18*U); c.clip();
    c.font="700 "+Math.round(10*U)+"px system-ui,sans-serif"; c.textAlign="center"; c.textBaseline="middle";
    for(let a=Math.floor((hd-span/2)/5)*5;a<=hd+span/2;a+=5){ const xx=tx+tw/2+(a-hd)*px, A=((a%360)+360)%360; c.strokeStyle="#cfd6dc"; c.lineWidth=A%10===0?2:1; c.beginPath(); c.moveTo(xx,ty+th); c.lineTo(xx,ty+th-(A%10===0?th*.32:th*.18)); c.stroke();
      if(A%10===0){ c.fillStyle="#e8f0f6"; c.fillText(A===0?"N":A===90?"E":A===180?"S":A===270?"W":String(A/10).padStart(2,"0"),xx,ty+th*.38); } }
    const mark=(a,col,below)=>{ const rel=clamp(wrap180(a-hd),-span/2+1,span/2-1), xx=tx+tw/2+rel*px, k=5*U; c.fillStyle=col; c.beginPath(); if(below){ c.moveTo(xx,ty+th); c.lineTo(xx-k,ty+th+k*1.4); c.lineTo(xx+k,ty+th+k*1.4); } else { c.moveTo(xx,ty); c.lineTo(xx-k,ty-k*1.4); c.lineTo(xx+k,ty-k*1.4); } c.closePath(); c.fill(); };
    if(bug!=null) mark(bug,"#ff8a00",false); if(brg!=null) mark(brg,"#66d9ff",true);
    c.restore();
    c.strokeStyle="#ffc247"; c.lineWidth=2; c.beginPath(); c.moveTo(tx+tw/2,ty-3); c.lineTo(tx+tw/2,ty+th+3); c.stroke();
  }
  function minimap(o){               // o: {cx,cz,range, rects:[{x0,x1,z0,z1,col,t}], path:[[x,z]…], rwy:bool}
    const ms=Math.min(150*U,W*0.3,(H-SH)*0.42), ox=W-ms-8*U, oy=H-SH-ms-14*U, k=ms/(2*o.range), X=x=>ox+ms/2+(x-o.cx)*k, Y=z=>oy+ms/2-(z-o.cz)*k;
    c.save(); c.fillStyle="rgba(6,12,18,.72)"; c.fillRect(ox,oy,ms,ms); c.strokeStyle="#344a5e"; c.lineWidth=1.5; c.strokeRect(ox,oy,ms,ms); c.beginPath(); c.rect(ox,oy,ms,ms); c.clip();
    (o.rects||[]).forEach(r=>{ c.fillStyle=r.col; c.fillRect(X(r.x0),Y(r.z1),Math.max(3,(r.x1-r.x0)*k),Math.max(3,(r.z1-r.z0)*k)); if(r.t){ c.fillStyle="#fff"; c.font="700 "+Math.round(10*U)+"px system-ui"; c.textAlign="center"; c.textBaseline="middle"; c.fillText(r.t,X((r.x0+r.x1)/2)+9*U,Y((r.z0+r.z1)/2)); } });
    if(o.path){ c.strokeStyle="rgba(102,217,255,.75)"; c.lineWidth=1.5*U*0.6; c.setLineDash([5,4]); c.beginPath(); o.path.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1]))); c.stroke(); c.setLineDash([]); }
    if(o.rwy){ c.fillStyle="#e9edf0"; c.fillRect(X(0)-1.5*U*0.6,Y(RW.len),3*U*0.6,RW.len*k); }
    if(o.wind){ const wv=sim.windVec(100), sp=Math.hypot(wv[0],wv[1]); if(sp>0.3){ const ax=ox+16*U, ay=oy+16*U, ex=wv[0]/sp, ez=wv[1]/sp, L2=11*U; c.strokeStyle="#ffc247"; c.fillStyle="#ffc247"; c.lineWidth=2; c.beginPath(); c.moveTo(ax-ex*L2,ay+ez*L2); c.lineTo(ax+ex*L2,ay-ez*L2); c.stroke();
        const tx=ax+ex*L2, ty=ay-ez*L2, nx=-ez, nz=-ex; c.beginPath(); c.moveTo(tx,ty); c.lineTo(tx-ex*6*U*0.7+nx*4*U*0.7,ty+ez*6*U*0.7-nz*4*U*0.7*-1); c.lineTo(tx-ex*6*U*0.7-nx*4*U*0.7,ty+ez*6*U*0.7+nz*4*U*0.7*-1); c.closePath(); c.fill(); } }
    c.translate(clamp(X(sim.x),ox+4,ox+ms-4),clamp(Y(sim.z),oy+4,oy+ms-4)); c.rotate(sim.psi); c.fillStyle="#ffc247"; const a=6*U*0.8; c.beginPath(); c.moveTo(0,-a*1.3); c.lineTo(a,a); c.lineTo(0,a*0.5); c.lineTo(-a,a); c.closePath(); c.fill();
    c.restore();
    c.fillStyle="#9fb4c5"; c.font="600 "+Math.round(8*U)+"px system-ui"; c.textAlign="right"; c.textBaseline="top"; c.fillText("N ↑",ox+ms-3*U,oy+3*U);
  }

  /* ---------------- puntuación de la toma (aterrizaje, circuito, ILS) ---------------- */
  function landScore(){
    const td=sim.td, out=[]; if(sim.crash||!td) return { pts:0, lines:["<span class='fs-bad'>"+(sim.crash||"No llegaste a tocar la pista.")+"</span>"], ok:false };
    const fpm=td.vs*FT*60, Vt=td.V, sink=Math.round(30*clamp(1-(td.vs-1.3)/1.7,0,1)), err=Math.abs(td.z-300), pp=Math.round(20*clamp(1-(err-150)/300,0,1));
    const lat=Math.abs(td.x), lp=Math.round(15*clamp(1-(lat-3)/9,0,1)), dv=Vt<50?50-Vt:Vt>66?Vt-66:0, sp=Math.round(15*clamp(1-dv/20,0,1));
    const dr=Math.abs(td.drift), dp=manRud?Math.round(10*clamp(1-(dr-3)/9,0,1)):10, rl=st.stopped&&sim.z<RW.len&&Math.abs(sim.x)<RW.hw+3?10:0;
    out.push(`Velocidad vertical al tocar: <b>${Math.round(fpm)} fpm</b> ${td.vs<=1.3?"<span class='fs-ok'>✔ suave</span>":td.vs<=2.5?"<span class='fs-mid'>· algo dura</span>":"<span class='fs-bad'>· dura</span>"}.`);
    out.push(`Punto de toma: <b>${Math.round(td.z)} m</b> del umbral ${err<=150?"<span class='fs-ok'>✔ en la zona de toma (visada a 300 m)</span>":td.z<150?"<span class='fs-mid'>· corto</span>":"<span class='fs-mid'>· largo</span>"}.`);
    out.push(`Velocidad al tocar: <b>${Vt.toFixed(0)} kt</b> (Vref ≈ 62 kt) ${dv===0?"<span class='fs-ok'>✔</span>":Vt>66?"<span class='fs-mid'>· rápido: más carrera y riesgo de rebote</span>":"<span class='fs-mid'>· lento: cerca de la pérdida</span>"}.`);
    out.push(`Desviación del eje: <b>${lat.toFixed(0)} m</b> ${lat<=3?"<span class='fs-ok'>✔</span>":""}.`);
    if(sim.wind.spd) out.push(manRud?`Deriva al tocar: <b>${dr.toFixed(0)}°</b> ${dr<=3?"<span class='fs-ok'>✔ morro alineado con la pista</span>":"<span class='fs-mid'>· tocaste atravesado: quita la deriva con el pedal y baja el ala al viento</span>"}.`:`Viento ${windTxt(sim.wind)}: con pedales automáticos no se puntúa la deriva al tocar.`);
    out.push(st.stopped?(rl?"Frenaste dentro de la pista <span class='fs-ok'>✔</span>.":"<span class='fs-mid'>Te saliste de la pista al frenar.</span>"):"Aún rodando.");
    if(sim.bounces) out.push(`Rebotes: ${sim.bounces} (demasiada velocidad vertical: espera en la recogida).`);
    return { pts:sink+pp+lp+sp+dp+rl, lines:out, ok:true };
  }
  /* comprobaciones comunes de pista tras tocar */
  function runwayChecks(){
    if(sim.td&&!st.tdChecked){ st.tdChecked=1; const t=sim.td; if(Math.abs(t.x)>RW.hw+4||t.z<-15||t.z>RW.len){ sim.crash=t.z<-15?"Tocaste antes del umbral, fuera de la pista.":"Tocaste fuera de la pista."; return; } toast(ctx,"Toma de contacto · gases al ralentí y frena",3); }
    if(sim.ground&&sim.td){ if(sim.z>RW.len+50) sim.crash="Te saliste por el final de la pista."; else if(Math.abs(sim.x)>RW.hw+18&&sim.Vg>4) sim.crash="Te saliste de la pista por un lado."; else if(sim.Vg<0.3){ st.stopped=true; end(); } }
  }

  /* ---------------- misiones ---------------- */
  const pickWx=()=>{ wx=WXS.find(w=>w.k===wxK)||WXS[0]; return { wind:wx.w(), turb:wx.turb, autoRud:!manRud }; };
  const MIS={};
  MIS.takeoff={
    wxOpt:true,
    intro:`<li>Pista 36 de 1&nbsp;500 m, flaps 10°. <b>Gases a fondo</b> (palanca arriba) y mantén el eje.</li><li><b>Rota a Vr ≈ 55 kt</b>: tira del mando hacia ti y suéltalo; el avión mantiene la actitud.</li><li>Sube a <b>Vy ≈ 74 kt</b> hasta 500 ft. Cruza el final de pista a más de 50 ft.</li><li>Con viento cruzado, el avión tiende a girar hacia el viento en la carrera.</li>`,
    start(){ sim=FlightSim(Object.assign({z:10,flap:1},pickWx())); ctl.lever.set(0); },
    tick(){ if(sim.liftoff&&!said.lo){ said.lo=1; toast(ctx,"En el aire a "+sim.liftoff.V.toFixed(0)+" kt · sube a Vy (74 kt)",3); }
      if(sim.ground&&!sim.liftoff&&sim.ias()>=50&&!said.rot){ said.rot=1; toast(ctx,"Vr: tira suave del mando",2.5); }
      if(!st.endH&&st.endH!==0&&sim.z>=RW.len){ st.endH=sim.h; }
      st.maxX=Math.max(st.maxX||0,sim.ground?Math.abs(sim.x):0);
      if(sim.ground&&!sim.liftoff){ if(sim.z>RW.len+50) sim.crash="Te saliste por el final de la pista sin despegar."; else if(Math.abs(sim.x)>RW.hw+15) sim.crash="Te saliste de la pista por un lado: corrige antes el eje."; }
      if(sim.liftoff&&sim.tdN>0&&!sim.crash) sim.crash="Volviste a tocar la pista: tras rotar no bajes el morro hasta tener velocidad.";
      if(sim.h>=150||sim.crash) end(); },
    hud(){ return [sim.liftoff?`Sube a 500 ft · Vy 74 kt`:`Pista restante ${fmt(Math.max(0,RW.len-sim.z))} m`]; },
    result(){ const out=[]; if(sim.crash) return { title:"Despegue fallido", sc:0, lines:["<span class='fs-bad'>"+sim.crash+"</span>"] };
      const lo=sim.liftoff||{V:0,z:0}, endH=(st.endH==null?sim.h:st.endH)*FT, V=sim.ias(); let p=0;
      const vrOK=lo.V>=52&&lo.V<=66; p+=vrOK?30:lo.V<52?10:15; out.push(`En el aire a <b>${lo.V.toFixed(0)} kt</b> tras ${Math.round(lo.z)} m ${vrOK?"<span class='fs-ok'>✔ rotación a Vr (≈55 kt)</span>":lo.V<52?"<span class='fs-bad'>· demasiado pronto: cerca de la pérdida</span>":"<span class='fs-mid'>· tarde: gastas pista</span>"}.`);
      const obs=endH>=50; p+=obs?25:endH>=20?10:0; out.push(`Altura al final de pista: <b>${Math.round(endH)} ft</b> ${obs?"<span class='fs-ok'>✔ más de 50 ft</span>":"<span class='fs-bad'>· menos de 50 ft</span>"}.`);
      const vyOK=V>=68&&V<=80; p+=vyOK?25:V>=62?12:0; out.push(`Velocidad a 500 ft: <b>${V.toFixed(0)} kt</b> ${vyOK?"<span class='fs-ok'>✔ cerca de Vy (74 kt)</span>":"<span class='fs-mid'>· Vy da el mejor régimen de ascenso (74 kt)</span>"}.`);
      const mx=st.maxX||0, cl=mx<=5; p+=cl?20:mx<=10?10:0; out.push(`Desviación máxima del eje en la carrera: <b>${mx.toFixed(0)} m</b> ${cl?"<span class='fs-ok'>✔</span>":""}.`);
      if(sim.wind.spd) out.push(`Viento ${windTxt(sim.wind)}.`);
      return { title:p>=80?"Despegue limpio":"Despegue completado", sc:p, lines:out }; }
  };
  function finalStart(z0,xoff){ const o=pickWx(); sim=FlightSim(Object.assign({z:z0,x:xoff,h:1,V:36,flap:2},o)); sim.alignTrack(0); const wv=sim.windVec(100), gs=36-(-(wv[1])); sim.gam=-3*D2R*clamp((36+wv[1])/36,0.6,1.3); sim.h=(300-z0)*Math.tan(3*D2R)-0.8; sim.setTrim(); ctl.lever.set(sim.thr); }
  MIS.landing={
    wxOpt:true, papi:true,
    intro:`<li>Final de 3° a unos 70 kt, flaps 20°. Guíate por el <b>PAPI</b>: 2 rojas + 2 blancas = en senda.</li><li><b>Gases = senda, mando = velocidad.</b> Corrige el eje con el mando a izquierda/derecha.</li><li>Con viento cruzado el avión vuela «de lado» (crab): la pista se ve desplazada. Es normal.</li><li>Cerca del suelo reduce gases y <b>recoge</b> suave. Vref ≈ 62 kt. Tras tocar: ralentí y <b>frenos</b>.</li>`,
    start(){ finalStart(-2300,(Math.random()<.5?-1:1)*(15+Math.random()*30)); },
    tick(){ runwayChecks(); if(!sim.td&&!sim.crash){ if(sim.h>280) sim.crash="Aproximación frustrada: subiste sin llegar a aterrizar."; else if(sim.z>RW.len) sim.crash="Pasaste el final de la pista sin tocar."; } if(sim.crash) end(); },
    hud(){ return [sim.td?`Pista restante ${fmt(Math.max(0,RW.len-sim.z))} m`:`Distancia al umbral ${fmt(Math.max(0,-sim.z))} m`]; },
    result(){ const r=landScore(); return { title:!r.ok?"Aterrizaje fallido":r.pts>=80?"Aterrizaje excelente":r.pts>=55?"Aterrizaje correcto":"Aterrizaje a mejorar", sc:r.pts, lines:r.lines }; }
  };
  /* ---- circuito de tráfico (izquierdas, 1 000 ft) ---- */
  const CIR={ dx:-1500, alt:1000 };
  MIS.circuit={
    wxOpt:true, papi:true,
    intro:`<li>Circuito a <b>izquierdas</b> de la pista 36 a <b>1&nbsp;000 ft</b>. Despega y sube recto hasta 500 ft (<b>upwind</b>).</li><li><b>Crosswind</b>: vira a rumbo 270 y sigue subiendo. <b>Downwind</b>: rumbo 180, 1&nbsp;000 ft, 80–90 kt, a la altura de la línea del mapa.</li><li>Al pasar el umbral: reduce gases y flaps 10°. <b>Base</b>: rumbo 090, bajando, flaps 20°.</li><li><b>Final</b>: rumbo 360, PAPI, 65–70 kt y a tierra.</li>`,
    start(){ sim=FlightSim(Object.assign({z:10,flap:1},pickWx())); ctl.lever.set(0); st.ph=0; st.dw={n:0,alt:0,dx:0,spdBad:0}; },
    bug(){ return [0,270,180,90,0][st.ph]; },
    tick(dt){
      const hd=sim.hdg(), near=(a,tol)=>Math.abs(wrap180(hd-a))<=tol, altF=sim.h*FT;
      if(st.ph===0){ if(!sim.ground&&altF<450&&Math.abs(wrap180(hd))>25) st.early=true; if(near(270,30)&&!sim.ground){ st.ph=1; toast(ctx,"CROSSWIND · sigue subiendo a 1 000 ft",3); } }
      else if(st.ph===1){ if(near(180,25)&&sim.x<-700){ st.ph=2; toast(ctx,"DOWNWIND · 1 000 ft, 80–90 kt",3); } }
      else if(st.ph===2){ if(sim.z<RW.len&&sim.z>0){ st.dw.n+=dt; st.dw.alt+=Math.abs(altF-CIR.alt)*dt; st.dw.dx+=Math.abs(sim.x-CIR.dx)*dt; if(sim.ias()<72||sim.ias()>100) st.dw.spdBad+=dt; }
        if(sim.z<0&&!said.abeam){ said.abeam=1; toast(ctx,"Umbral pasado: reduce gases, flaps 10°",3.2); }
        if(near(90,30)&&sim.z<400){ st.ph=3; toast(ctx,"BASE · bajando, flaps 20°, 70 kt",3); } }
      else if(st.ph===3){ if(near(0,25)&&sim.z<-200){ st.ph=4; toast(ctx,"FINAL · PAPI y 65–70 kt",3); } }
      else if(st.ph===4){ if(!st.stab&&sim.h<=91&&!sim.td){ st.stab={ x:Math.abs(sim.x), v:sim.ias(), fl:sim.flap }; } }
      if(sim.liftoff) st.wasUp=true;
      if(st.ph>=1||(st.wasUp&&sim.h<3)){ if(sim.td&&st.ph<3&&!sim.crash&&sim.tdN>0&&st.ph>0) sim.crash="Tocaste el suelo fuera del circuito."; }
      if(st.ph===0&&sim.ground&&!sim.liftoff){ if(sim.z>RW.len+50) sim.crash="Te saliste por el final de la pista sin despegar."; else if(Math.abs(sim.x)>RW.hw+15) sim.crash="Te saliste de la pista por un lado."; }
      if(st.ph===0&&sim.liftoff&&sim.tdN>0&&!sim.crash) sim.crash="Volviste a tocar la pista tras despegar.";
      if(st.ph>=3) runwayChecks();
      if(sim.h>700) sim.crash="Te fuiste muy por encima del circuito (más de 2 300 ft).";
      if(T>600) sim.crash="Tiempo agotado: el circuito debe cerrarse en unos 6 minutos.";
      if(sim.crash) end(); },
    hud(){ const n=["UPWIND (viento en cara): sube recto hasta 500 ft","CROSSWIND (viento cruzado): vira a la izquierda, rumbo 270","DOWNWIND (viento en cola): rumbo 180 · 1 000 ft · 80–90 kt","BASE: rumbo 090 · desciende · flaps 20°","FINAL: rumbo 360 · PAPI · 65–70 kt"]; return [n[st.ph], st.ph===2?`Separación de la pista ${(Math.abs(sim.x)/NM).toFixed(1).replace(".",",")} NM (objetivo 0,8)`:null]; },
    overlay(){ minimap({cx:-800,cz:500,range:2900,rwy:true,wind:true,path:[[0,0],[0,RW.len+900],[CIR.dx,RW.len+900],[CIR.dx,-1500],[0,-1500],[0,0]]}); },
    result(){ const out=[]; let p=0;
      if(st.ph<4&&(sim.crash||!sim.td)) return { title:"Circuito interrumpido", sc:0, lines:["<span class='fs-bad'>"+(sim.crash||"No completaste el circuito.")+"</span>"] };
      const up=!st.early; p+=up?10:0; out.push(`Upwind: ${up?"<span class='fs-ok'>✔ recto hasta 500 ft</span>":"<span class='fs-bad'>viraste por debajo de 500 ft</span>"}.`);
      const d=st.dw, n=Math.max(d.n,0.01), ea=d.alt/n, ex=d.dx/n, pa=Math.round(15*clamp(1-(ea-100)/200,0,1)), px=Math.round(10*clamp(1-(ex-300)/500,0,1)), ps=Math.round(5*clamp(1-(d.spdBad/n)*2,0,1));
      if(d.n<5){ out.push("<span class='fs-bad'>Downwind: no volaste el tramo paralelo a la pista.</span>"); } else { p+=pa+px+ps; out.push(`Downwind: altitud a <b>${Math.round(ea)} ft</b> de media de los 1 000 ft ${ea<=100?"<span class='fs-ok'>✔</span>":"<span class='fs-mid'>· tolerancia ±100 ft</span>"} · separación a ${Math.round(ex)} m de la ideal ${ex<=300?"<span class='fs-ok'>✔</span>":""} · velocidad ${d.spdBad/n<0.15?"<span class='fs-ok'>✔</span>":"<span class='fs-mid'>fuera de 75–100 kt</span>"}.`); }
      if(st.stab){ const ok=st.stab.x<=30&&st.stab.v>=58&&st.stab.v<=78&&st.stab.fl>=1; p+=ok?15:st.stab.x<=60?7:0; out.push(`Final a 300 ft: a ${Math.round(st.stab.x)} m del eje, ${st.stab.v.toFixed(0)} kt, flaps ${FLAPS[st.stab.fl]}° ${ok?"<span class='fs-ok'>✔ aproximación estabilizada</span>":"<span class='fs-mid'>· no estabilizada (eje ±30 m, 60–78 kt, con flaps)</span>"}.`); }
      const r=landScore(); p+=Math.round(r.pts*0.45); out.push("<b>Aterrizaje</b> ("+r.pts+"/100):"); r.lines.forEach(l=>out.push(l));
      return { title:!r.ok?"Circuito sin aterrizaje":p>=80?"Circuito de libro":p>=55?"Circuito correcto":"Circuito a mejorar", sc:p, lines:out }; }
  };
  /* ---- vectores ---- */
  MIS.vectors={
    intro:`<li>El controlador te da un <b>rumbo</b> y una <b>altitud</b>. Vuela hasta el aro naranja (WPT) y pásalo a esa altitud.</li><li>El mando a izquierda/derecha <b>inclina</b> el avión; para virar a régimen estándar basta con unos 15–20° de alabeo.</li><li>En el viraje el morro cae: tira un poco. Al subir añade gases; al bajar, quítalos. Mantén 70–100 kt.</li><li>Cinta inferior: marca <b>naranja</b> = rumbo pedido, <b>azul</b> = dirección al aro.</li>`,
    start(){ const g=[]; let x=0,z=0,hd=Math.round(Math.random()*35)*10, alt=2000; const h0=hd;
      for(let i=0;i<5;i++){ const tn=(Math.random()<.5?-1:1)*(35+Math.floor(Math.random()*11)*5), prev=hd; hd=((hd+tn)%360+360)%360; const len=1900+Math.random()*1300; x+=len*Math.sin(hd*D2R); z+=len*Math.cos(hd*D2R);
        const na=Math.round(clamp(alt+[-500,-300,0,300,500][Math.floor(Math.random()*5)],1500,3500)/100)*100, r=wrap180(hd-prev)>0, up=na>alt, same=na===alt;
        g.push({ x:x,z:z,h:na/FT,alt:na,hdg:hd,len:len, en:`Turn ${r?"right":"left"} heading ${p3(hd||360)}. ${same?"Maintain":up?"Climb and maintain":"Descend and maintain"} ${fmt(na)} ft.`, es:`Vira a la ${r?"derecha":"izquierda"} rumbo ${p3(hd||360)}. ${same?"Mantén":up?"Sube y mantén":"Desciende y mantén"} ${fmt(na)} ft.` }); alt=na; }
      st.g=g; st.gi=0; st.res=[]; sim=FlightSim({V:46,h:2000/FT,psi:h0*D2R,autoRud:!manRud}); ctl.lever.set(sim.thr); },
    bug(){ const g=st.g[Math.min(st.gi,4)]; return g?g.hdg:null; },
    tick(){ if(sim.h<=0&&!sim.crash) sim.crash="Has tocado el suelo: mantén la altitud."; if(sim.crash){ end(); return; }
      const g=st.g[st.gi], ux=Math.sin(g.hdg*D2R), uz=Math.cos(g.hdg*D2R), dx=sim.x-g.x, dz=sim.z-g.z, s=dx*ux+dz*uz, lat=Math.abs(dx*uz-dz*ux), dist=Math.hypot(dx,dz);
      if(s>=0||dist>g.len*1.8+1500){ const miss=s<0||lat>400, dAlt=(sim.h-g.h)*FT, dHdg=wrap180(sim.hdg()-g.hdg);
        const pl=miss?0:Math.round(10*clamp(1-(lat-30)/120,0,1)), pa=miss?0:Math.round(6*clamp(1-(Math.abs(dAlt)-50)/200,0,1)), ph=miss?0:(Math.abs(dHdg)<=10?4:Math.abs(dHdg)<=20?2:0), pts=pl+pa+ph;
        st.res.push({miss:miss,lat:lat,dAlt:dAlt,dHdg:dHdg,pts:pts}); toast(ctx,miss?`WPT ${st.gi+1}: aro perdido`:`WPT ${st.gi+1}: a ${Math.round(lat)} m · ${dAlt>=0?"+":""}${Math.round(dAlt)} ft · +${pts}`,2.6);
        st.gi++; if(st.gi>=5) end(); } },
    hud(){ if(st.gi>=5) return []; const g=st.g[st.gi], d=Math.hypot(g.x-sim.x,g.z-sim.z)/NM; return [g.en,g.es,`WPT ${st.gi+1}/5 · ${d.toFixed(1).replace(".",",")} NM · objetivo ${fmt(g.alt)} ft`]; },
    draw3d(){ const ring=(g,col,w,alpha)=>{ const R=60, ux=Math.sin(g.hdg*D2R), uz=Math.cos(g.hdg*D2R), px=uz, pz=-ux; let prev=null; for(let i=0;i<=24;i++){ const a=i/24*TAU, q=[g.x+px*R*Math.cos(a), g.h+R*Math.sin(a), g.z+pz*R*Math.cos(a)]; if(prev) line3(prev,q,col,w,alpha); prev=q; } line3([g.x,0,g.z],[g.x,g.h-R,g.z],col,2,alpha*0.6); };
      for(let j=Math.min(st.gi+1,4);j>=st.gi&&j<5;j--){ if(j===st.gi) ring(st.g[j],"#ffb300",Math.max(4,U*2.2),1); else ring(st.g[j],"#66d9ff",Math.max(3,U*1.6),.55); } },
    overlay(){ const g=st.g[Math.min(st.gi,4)]; tape(g?g.hdg:null, g?((Math.atan2(g.x-sim.x,g.z-sim.z)/D2R)%360+360)%360:null); },
    result(){ const pen=Math.min(10,Math.round(sim.stallT*2)); let scv=st.res.reduce((a,g)=>a+g.pts,0);
      const out=st.res.map((g,i)=>`<b>WPT ${i+1}</b> · ${g.miss?"<span class='fs-bad'>aro no cruzado</span>":`a ${Math.round(g.lat)} m del centro ${g.lat<=40?"<span class='fs-ok'>✔</span>":""} · altitud ${g.dAlt>=0?"+":""}${Math.round(g.dAlt)} ft ${Math.abs(g.dAlt)<=50?"<span class='fs-ok'>✔</span>":""} · rumbo ${g.dHdg>=0?"+":""}${Math.round(g.dHdg)}°`} → <b>${g.pts}</b>`);
      if(sim.crash) out.unshift("<span class='fs-bad'>"+sim.crash+"</span>"); if(pen) out.push(`<span class='fs-bad'>Pérdida (stall): −${pen} puntos. Con poca velocidad, baja el morro y da gases.</span>`);
      scv=Math.max(0,scv-pen); return { title:sim.crash?"Vuelo interrumpido":scv>=80?"Vectores perfectos":scv>=50?"Vectores correctos":"Vectores a mejorar", sc:scv, lines:out }; }
  };
  /* ---- fallo de motor ---- */
  const FKIND={ good:{t:"largo y llano",col:[150,186,96],mm:"#9ad06a",pts:15}, short:{t:"corto",col:[150,186,96],mm:"#9ad06a",pts:6}, plough:{t:"arado, con surcos",col:[132,98,66],mm:"#a57a4e",pts:4} };
  MIS.engine={
    intro:`<li>Vuelas en crucero a 2&nbsp;500 ft y <b>el motor se para</b>. Lo primero: <b>velocidad de mejor planeo, 68 kt</b> (morro arriba para frenar, luego mantén).</li><li><b>Elige campo</b> en el mapa: largo, llano y sin surcos. Los marrones están arados; los pequeños son cortos.</li><li>Aterriza <b>contra el viento</b> (flecha amarilla del mapa = hacia dónde sopla). Planea un circuito: no llegues ni alto ni corto.</li><li>Flaps solo cuando tengas el campo asegurado. Tras tocar, frena dentro del campo.</li>`,
    start(){ const h0=Math.round(Math.random()*35)*10, wd=[360,360,180][Math.floor(Math.random()*3)]; st.wd=wd;
      sim=FlightSim({V:46,h:2500/FT,psi:h0*D2R,autoRud:!manRud,wind:{dir:wd,spd:10,gust:0},turb:0.3,x:9000,z:9000}); ctl.lever.set(sim.thr);
      const b0=Math.random()*360, mk=(kind,brg,dist,w,l)=>{ const x=sim.x+dist*Math.sin(brg*D2R), z=sim.z+dist*Math.cos(brg*D2R); return {kind:kind,x0:x-w/2,x1:x+w/2,z0:z-l/2,z1:z+l/2}; };
      st.f=[ mk("good",b0,2300+Math.random()*500,90,650), mk("short",b0+110+Math.random()*40,1300+Math.random()*400,60,230), mk("plough",b0+230+Math.random()*40,1700+Math.random()*500,110,520), mk("plough",b0+60,3200,100,480) ];
      "ABCD".split("").forEach((L,i)=>{ const k=[2,0,3,1][i]; st.f[k].t=L; });
      st.failAt=3+Math.random()*3; st.spd={n:0,e:0}; st.center=[sim.x,sim.z]; },
    tick(dt){
      if(sim.engine&&T>=st.failAt){ sim.engine=false; toast(ctx,"¡FALLO DE MOTOR! · mejor planeo 68 kt · elige campo",4.5); }
      if(!sim.engine&&!sim.td&&sim.h>40){ st.spd.n+=dt; st.spd.e+=Math.abs(sim.ias()-68)*dt; }
      const inF=(x,z)=>st.f.find(f=>x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1);
      if(sim.td&&!st.tdChecked){ st.tdChecked=1; st.field=inF(sim.td.x,sim.td.z)||null; if(!st.field){ sim.crash="Tocaste fuera de un campo: terreno no apto (árboles, vallas, zanjas)."; } else { sim.mu=0.09; sim.muBrake=0.32; if(st.field.kind==="plough"&&sim.td.gs>30){ sim.crash="Campo arado: las ruedas se clavan en los surcos y el avión capota."; } else toast(ctx,"En el campo "+st.field.t+" · frena",3); } }
      if(sim.ground&&sim.td&&!sim.crash){ if(!inF(sim.x,sim.z)&&sim.Vg>6){ st.ranOut=true; sim.crash="Te saliste del campo rodando: no había espacio para frenar."; } else if(sim.Vg<0.3){ st.stopped=true; end(); } }
      if(sim.crash) end(); },
    hud(){ const l=[]; l.push(sim.engine?"Crucero · 2 500 ft":`MOTOR PARADO · mejor planeo 68 kt (ahora ${Math.round(sim.ias())})`); l.push(`Viento ${windTxt(sim.wind)} · aterriza con rumbo ${p3(st.wd)}`); return l; },
    draw3d(){ st.f.forEach(f=>{ const k=FKIND[f.kind]; rect(f.x0,f.x1,f.z0,f.z1,k.col,0.05); if(f.kind==="plough"){ for(let x=f.x0+6;x<f.x1;x+=9) line3([x,0.08,f.z0],[x,0.08,f.z1],"#5d4329",1,.6); }
        [[f.x0,f.z0,f.x1,f.z0],[f.x1,f.z0,f.x1,f.z1],[f.x1,f.z1,f.x0,f.z1],[f.x0,f.z1,f.x0,f.z0]].forEach(e=>line3([e[0],0.1,e[1]],[e[2],0.1,e[3]],"#f4f1d0",1.5,.7)); });
      st.f.forEach(f=>label3((f.x0+f.x1)/2,12,(f.z0+f.z1)/2,f.t)); },
    overlay(){ minimap({cx:st.center[0],cz:st.center[1],range:3600,wind:true,rects:st.f.map(f=>({x0:f.x0,x1:f.x1,z0:f.z0,z1:f.z1,col:FKIND[f.kind].mm,t:f.t}))}); },
    result(){ const out=[]; let p=0; const n=Math.max(st.spd.n,0.01), es=st.spd.e/n, ps=Math.round(20*clamp(1-(es-4)/12,0,1)); p+=ps;
      out.push(`Planeo: a <b>${es.toFixed(0)} kt</b> de media de los 68 kt ${es<=5?"<span class='fs-ok'>✔ mejor planeo mantenido</span>":"<span class='fs-mid'>· cada nudo de más o de menos acorta el planeo</span>"}.`);
      const f=st.field;
      if(!f){ out.unshift("<span class='fs-bad'>"+(sim.crash||"No llegaste a ningún campo.")+"</span>"); return { title:"Aterrizaje forzoso fallido", sc:Math.round(p*0.5), lines:out }; }
      const k=FKIND[f.kind]; p+=20; out.push(`Llegaste al campo <b>${f.t}</b> (${k.t}) <span class='fs-ok'>✔</span>.`);
      p+=k.pts; out.push(f.kind==="good"?"Elección de campo: <span class='fs-ok'>✔ el mejor disponible</span>.":`Elección de campo: <span class='fs-mid'>había uno largo y llano mejor</span>.`);
      const td=sim.td, into=Math.abs(wrap180(td.psi/D2R-st.wd))<=45; p+=into?15:0; out.push(into?`Aterrizaste contra el viento <span class='fs-ok'>✔</span> (velocidad sobre el suelo ${td.gs.toFixed(0)} kt).`:`<span class='fs-bad'>Aterrizaste con viento en cola o cruzado</span>: ${td.gs.toFixed(0)} kt sobre el suelo, mucha más carrera.`);
      const soft=Math.round(15*clamp(1-(td.vs-1.5)/2,0,1)); p+=soft; out.push(`Velocidad vertical al tocar: <b>${Math.round(td.vs*FT*60)} fpm</b> ${td.vs<=1.5?"<span class='fs-ok'>✔</span>":"<span class='fs-mid'>· dura</span>"}.`);
      if(sim.crash){ out.unshift("<span class='fs-bad'>"+sim.crash+"</span>"); } else if(st.stopped){ p+=15; out.push("Parado dentro del campo <span class='fs-ok'>✔</span>."); }
      if(sim.stallT>1){ p-=10; out.push("<span class='fs-bad'>Entraste en pérdida durante el planeo: −10.</span>"); }
      p=clamp(p,0,100); return { title:sim.crash?"Aterrizaje forzoso con daños":p>=80?"Aterrizaje forzoso de manual":"Aterrizaje forzoso completado", sc:p, lines:out }; }
  };
  /* ---- ILS ---- */
  const ilsDev=()=>{ const loc=Math.atan2(sim.x,RW.len+300-sim.z)/D2R, gsA=Math.atan2(sim.h,Math.max(1,300-sim.z))/D2R; return { loc:-loc/0.5, gs:(gsA-3)/0.14, okL:sim.z<RW.len, okG:sim.z<250 }; };   // puntos (5 = fondo de escala): LOC 2,5°, GS 0,7°
  MIS.ils={
    papi:false, ceilOpt:true,
    intro:`<li>Estás en nubes a 1&nbsp;500 ft, a 4 NM de la pista 36. <b>Vuela con los instrumentos</b>: fuera no se ve nada.</li><li>Instrumento <b>LOC/GS</b>: aguja amarilla vertical = localizador; azul horizontal = senda. <b>Vuela hacia la aguja</b>.</li><li>Intercepta el localizador (rumbo final 360) y mantén 1&nbsp;500 ft hasta que la senda baje al centro. Luego desciende a unos 450 fpm con 85–90 kt.</li><li>Al salir de la nube verás las luces: flaps, 70 kt y aterriza. Si a la altitud de decisión no ves la pista, motor y al aire.</li>`,
    start(){ const o=pickWx(); o.wind={dir:0,spd:0,gust:0}; o.turb=0.4; const side=Math.random()<.5?-1:1; sim=FlightSim(Object.assign({z:-8600,x:side*1000,h:1500/FT,V:45,psi:-side*30*D2R,flap:0},o)); ctl.lever.set(sim.thr); st.loc={n:0,e:0}; st.gsd={n:0,e:0}; st.cap=false; },
    cdi(){ const d=ilsDev(); d.gs=-d.gs; return d; },
    bug(){ return 0; },
    tick(dt){ const d=ilsDev();
      if(!st.cap&&Math.abs(d.loc)<1.2){ st.cap=true; toast(ctx,"Localizador capturado · rumbo 360",3); }
      if(!st.gcap&&st.cap&&Math.abs(d.gs)<0.6){ st.gcap=true; toast(ctx,"Senda capturada · desciende ≈ 450 fpm",3); }
      if(st.cap&&sim.h>61&&!sim.td){ st.loc.n+=dt; st.loc.e+=Math.min(5,Math.abs(d.loc))*dt; }
      if(st.gcap&&sim.h>61&&!sim.td){ st.gsd.n+=dt; st.gsd.e+=Math.min(5,Math.abs(d.gs))*dt; }
      if(!said.da&&sim.h*FT<=ceil+60&&st.cap){ said.da=1; toast(ctx,"Aproximando mínimos · busca las luces",2.5); }
      runwayChecks();
      if(!sim.td&&!sim.crash){ if(sim.z>RW.len) sim.crash="Pasaste la pista sin aterrizar."; else if(sim.h<=0.01&&sim.ground) sim.crash="Tocaste el suelo antes de la pista."; else if(sim.h>900) sim.crash="Te saliste del procedimiento por arriba."; else if(Math.abs(sim.x)>4500||sim.z<-14000) sim.crash="Te saliste del área de la aproximación."; }
      if(sim.crash) end(); },
    hud(){ const d=ilsDev(), dme=Math.max(0,-sim.z)/NM, a=v=>Math.abs(v)<0.3?"centrado":Math.abs(v).toFixed(1).replace(".",",")+" pt"; return [`ILS RWY 36 · DME ${dme.toFixed(1).replace(".",",")} NM · DA ${ceil} ft`, `LOC ${d.okL?(Math.abs(d.loc)<0.3?"centrado":(d.loc>0?"vuela a la derecha ":"vuela a la izquierda ")+a(d.loc)):"—"} · GS ${d.okG?(Math.abs(d.gs)<0.3?"centrada":(d.gs>0?"estás alto ":"estás bajo ")+a(d.gs)):"—"}`]; },
    result(){ const out=[]; let p=0; const ln=Math.max(st.loc.n,0.01), gn=Math.max(st.gsd.n,0.01), el=st.loc.e/ln, eg=st.gsd.e/gn;
      if(!st.cap){ out.push("<span class='fs-bad'>No llegaste a interceptar el localizador.</span>"); } else { const pl=Math.round(30*clamp(1-(el-0.5)/2.5,0,1)); p+=pl; out.push(`Localizador: <b>${el.toFixed(1).replace(".",",")} puntos</b> de desviación media ${el<=1?"<span class='fs-ok'>✔ dentro de 1 punto</span>":"<span class='fs-mid'>· correcciones más pequeñas y antes</span>"}.`); }
      if(!st.gcap){ out.push("<span class='fs-bad'>No llegaste a capturar la senda.</span>"); } else { const pg=Math.round(30*clamp(1-(eg-0.5)/2.5,0,1)); p+=pg; out.push(`Senda: <b>${eg.toFixed(1).replace(".",",")} puntos</b> de desviación media ${eg<=1?"<span class='fs-ok'>✔</span>":"<span class='fs-mid'>· ajusta con gases el régimen de descenso</span>"}.`); }
      const r=landScore(); p+=Math.round(r.pts*0.4); out.push("<b>Aterrizaje</b> ("+r.pts+"/100):"); r.lines.forEach(l=>out.push(l));
      return { title:!r.ok?"Aproximación sin aterrizaje":p>=80?"ILS de precisión":p>=55?"ILS correcto":"ILS a mejorar", sc:p, lines:out }; }
  };
  const M=MIS[mode];

  /* ---------------- arranque, intro, fin ---------------- */
  function reset(){ over=false; said={}; st={}; score=0; brk=0; kP=0; kA=0; kR=0; kAv=0; kRv=0; T=0; M.start(); sim.autoRud=!manRud; dbg.sim=sim; dbgF.sim=sim; dbgF.st=st; }
  function begin(){ hideOverlay(ctx); reset(); started=true; if(vec) toast(ctx,"Instrucción recibida · sigue el rumbo y la altitud",3); if(sim.wind.spd) toast(ctx,"Viento "+windTxt(sim.wind),3); }
  function intro(){
    started=false; over=false; ctx.paused=false;
    const wopt=M.wxOpt?`<div class="fs-opt" style="justify-content:center;margin:0"><span class="fs-seg" role="group" aria-label="Viento">${WXS.map(w=>`<button data-w="${w.k}" aria-pressed="${w.k===wxK}">${w.t}</button>`).join("")}</span></div>`:"";
    const copt=M.ceilOpt?`<div class="fs-opt" style="justify-content:center;margin:0">Techo de nubes: <span class="fs-seg" role="group" aria-label="Techo">${[500,300,200].map(v=>`<button data-ce="${v}" aria-pressed="${v===ceil}">${v} ft</button>`).join("")}</span></div>`:"";
    const topt=ils?"":`<div class="fs-opt" style="justify-content:center;margin:0"><span class="fs-seg" role="group" aria-label="Hora del día">${Object.keys(TODS).map(k=>`<button data-td="${k}" aria-pressed="${k===todK}">${TODS[k].t}</button>`).join("")}</span></div>`;
    showOverlay(ctx,`<h3>${TITLES[mode]}</h3><ul>${M.intro}</ul>${wopt}${topt}${copt}<p style="margin:0;font-size:13px;color:#9fb4c5">${manRud?"Pedales manuales: barra bajo el mando (teclas Z / X). ":""}Teclado: ↑ morro abajo · ↓ morro arriba · ←→ alabeo · E/Q gases${vec?"":" · F/R flaps · Espacio frenos"}</p><div class="row"><button class="fs-btn" id="goB">Empezar</button></div>`,r=>{
      $("#goB",r).onclick=begin;
      r.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{ wxK=b.dataset.w; store.put("wx",wxK); r.querySelectorAll("[data-w]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
      r.querySelectorAll("[data-td]").forEach(b=>b.onclick=()=>{ todK=b.dataset.td; store.put("tod",todK); r.querySelectorAll("[data-td]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
      r.querySelectorAll("[data-ce]").forEach(b=>b.onclick=()=>{ ceil=+b.dataset.ce; r.querySelectorAll("[data-ce]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
    });
    reset();
  }
  ctx.onNew=intro;
  function end(){
    if(over) return; over=true; started=false;
    const r=M.result(), scv=Math.round(clamp(r.sc,0,100)), best=store.best(mode,scv);
    showOverlay(ctx,`<h3>${esc(r.title)}</h3><div class="big ${scv>=70?"fs-ok":scv>=40?"fs-mid":"fs-bad"}">${scv} <small style="font:600 14px system-ui">puntos · mejor ${best==null?"—":best}</small></div><ul>${r.lines.map(t=>"<li>"+t+"</li>").join("")}</ul><div class="row"><button class="fs-btn" id="againB">Repetir</button><button class="fs-btn sec" id="menuB">Menú</button></div>`,rr=>{ $("#againB",rr).onclick=intro; $("#menuB",rr).onclick=menu; });
  }
  /* ---------------- bucle ---------------- */
  let acc=0, hudT=0;
  const shape=p=>p*(0.55+0.45*Math.abs(p));
  function step(dt){
    if(!started||over||ctx.paused||!sim) return;
    T+=dt;
    const pad=ctl.pad;
    kAv+=(kA-kAv)*Math.min(1,dt*4); kRv+=(kR-kRv)*Math.min(1,dt*5);
    if(!dbgF.manual){
      sim.thr=ctl.lever.v; sim.ail=clamp(shape(pad.x)+kAv,-1,1); sim.rud=manRud?clamp((ctl.ped?ctl.ped.x:0)+kRv,-1,1):0; sim.brake=brk?1:0;
      let pr=clamp(pad.y+kP,-1,1); if(Math.abs(pr)<0.06) pr=0; sim.y=clamp(sim.y+Math.sign(pr)*Math.pow(Math.abs(pr),1.4)*0.9*dt,-0.8,1);
      if(sim.ground&&sim.td) sim.y+=(0-sim.y)*Math.min(1,dt*0.8);
    }
    pad.setPitchMark(sim.y);
    acc+=dt; let n=0; while(acc>=1/120&&n<20){ sim.step(1/120); acc-=1/120; n++; }
    M.tick(dt);
  }
  function hud(dt){
    hudT-=dt; if(hudT>0||!sim) return; hudT=0.1;
    const ias=Math.round(sim.ias()), alt=Math.max(0,Math.round(sim.h*FT/10)*10), vs=Math.round(sim.vs()*FT*60/10)*10, low=!sim.ground&&sim.ias()<sim.stallV(sim.fl())+4;
    const L=(M.hud()||[]).filter(Boolean), cls=["l1","l2","l3"];
    const wtxt=sim.wind.spd&&!engine?`<span>💨 ${windTxt(sim.wind)}</span>`:"";
    setHud(ctx,`<div class="l0"><b>${TITLES[mode]}</b><span class="${low?"bad":""}">${ias} kt</span><span>${fmt(alt)} ft</span><span class="${vs<-800?"bad":""}">${vs>=0?"+":""}${vs} fpm</span>${vec?"":`<span>F${FLAPS[sim.flap]}</span>`}${wtxt}</div>${L.map((t,i)=>`<div class="${cls[Math.min(i,2)]}">${esc(t)}</div>`).join("")}${sim.stall&&!sim.ground?`<div class="warn">STALL · baja el morro</div>`:low&&started?`<div class="warn mid">VELOCIDAD BAJA</div>`:""}`);
  }
  function frame(dt){ if(!sim) return; step(dt); render(); if(M.papi&&!over&&sim.z<RW.len) papiInset(); hud(dt); }
  const stopLoop=startLoop(frame);
  const visH=()=>{ if(document.hidden){ ctx.paused=true; ctx.pauseBtn.textContent="Seguir"; } }; document.addEventListener("visibilitychange",visH);
  dbg.g=dbgF; dbgF.ctl=ctl; dbgF.start=begin; Object.defineProperty(dbgF,"over",{get:()=>over}); Object.defineProperty(dbgF,"T",{get:()=>T}); dbgF.setWx=k=>{ wxK=k; }; dbgF.setTod=k=>{ todK=k; }; dbgF.setCeil=v=>{ ceil=v; };
  intro();
  return ()=>{ stopLoop(); off(); ctl.pad&&ctl.pad.destroy&&ctl.pad.destroy(); ctl.ped&&ctl.ped.destroy&&ctl.ped.destroy(); document.removeEventListener("visibilitychange",visH); ctx.onResize=null; ctx.onNew=null; };
}

window.__f0simDebug=()=>dbg;
window.F0Sim={ render(el){ root=el; injectCss(); menu(); }, leave(){ if(stopFn){ try{ stopFn(); }catch(e){} stopFn=null; } relayout=null; root=null; }, _FlightSim:FlightSim };
})();
