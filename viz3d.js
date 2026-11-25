/* Láminas 3D (serie 3) y esquemas interactivos: globo, ILS/VOR, meteorología 3D, derecho de paso, CG, túnel, motor, estela, espacios aéreos A–G y METAR/TAF.
   Motor 3D propio en canvas 2D (sin WebGL ni librerías): ligero y funciona en cualquier móvil.
   Se registran en F0Viz (viz16.js) y se montan en <div class="f0viz" data-viz="…">. Solo dibujan mientras están en pantalla. */
(function(){
"use strict";
const F=window.F0Viz; if(!F||!F.V) return;
const V=F.V, R=Math.PI/180, cl=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t, sst=(a,b,x)=>{ const t=cl((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const f0=x=>Math.round(x).toLocaleString("es-ES"), f1=x=>(Math.round(x*10)/10).toString().replace(".",","), d3=x=>String(Math.round(((x%360)+360)%360)).padStart(3,"0");
const RAF=(window.requestAnimationFrame||(f=>setTimeout(()=>f(performance.now()),33))).bind(window);
const CSS=`
.f0viz .v3r{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}
.f0viz .v3r[hidden]{display:none}
.f0viz .v3l{font:700 11px/1 "Barlow Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8fa3b8;min-width:4.6em}
.f0viz .v3r select{font:600 13px system-ui,sans-serif;min-height:38px;padding:6px 10px;border-radius:6px;border:1px solid #3a516b;background:#1a2b3f;color:#e9f0f7;max-width:100%}
.f0viz .v3r label.v3k{display:flex;gap:6px;align-items:center;font-weight:600;flex:0 1 auto}
.f0viz .v3r label.v3s{flex:1 1 220px;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;min-width:0}
.f0viz .v3r label.v3s input{grid-column:1/-1;width:100%;margin:0;accent-color:#ffc94d}
.f0viz .v3r label.v3s output{font:600 13px ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#ffc94d}
.f0viz .v3cv{cursor:grab;touch-action:pan-y}
.f0viz .v3cv:active{cursor:grabbing}
.f0viz .v3q button{flex:1 1 200px;text-align:left;white-space:normal;line-height:1.25}
.f0viz .v3q button.qok{background:#1f5f3a!important;border-color:#6ee7a0!important;color:#fff!important}
.f0viz .v3q button.qbad{background:#6a2420!important;border-color:#ff8a80!important;color:#fff!important}
.f0viz .out button[data-qn]{margin-left:8px;font:700 13px system-ui,sans-serif;padding:6px 10px;border-radius:6px;border:1px solid #ffc94d;background:#ffc94d;color:#12202f;cursor:pointer}
.f0viz .out .v3sc{color:#8fa3b8;font-size:13px}
`;
if(!document.getElementById("v3css")){ const s=document.createElement("style"); s.id="v3css"; s.textContent=CSS; document.head.appendChild(s); }

/* ---------- utilidades comunes ---------- */
const shell=(el,t,aria,ctl,cap)=>{ el.innerHTML=`<p class="lt">${t}</p><figure><canvas class="v3cv" role="img" aria-label="${aria}"></canvas></figure><div class="ctl">${ctl}</div><p class="out" aria-live="polite"></p><p class="cap">${cap}</p>`;
  return {c:el.querySelector("canvas"),out:el.querySelector(".out"),q:s=>el.querySelector(s),qa:s=>el.querySelectorAll(s)}; };
const row=(lab,inner,attr)=>`<div class="v3r"${attr?" "+attr:""}>${lab?`<span class="v3l">${lab}</span>`:""}${inner}</div>`;
const bt=(attr,v,txt,on)=>`<button type="button" ${attr}="${v}" aria-pressed="${on?"true":"false"}">${txt}</button>`;
const sl=(k,lab,min,max,val,step)=>`<label class="v3s">${lab}<output data-o="${k}"></output><input type="range" data-k="${k}" min="${min}" max="${max}" value="${val}" step="${step||1}" aria-label="${lab}"></label>`;
const press=(u,attr,v)=>u.qa(`[${attr}]`).forEach(b=>b.setAttribute("aria-pressed",b.getAttribute(attr)===String(v)?"true":"false"));
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], vmul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k], vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], vnorm=a=>{ const n=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/n,a[1]/n,a[2]/n]; };
/* etiqueta con fondo: x,y en píxeles del canvas */
function tag(x,px,py,t,o){ o=o||{}; const d=o.dp||1, fs=(o.fs||12)*d; x.font=`${o.w||600} ${fs}px system-ui,-apple-system,"Segoe UI",sans-serif`; const tw=x.measureText(t).width, pad=3*d;
  let lx=o.al==="r"?px-tw-pad*2:o.al==="c"?px-tw/2-pad:px, ly=py-fs*.5-pad; lx=cl(lx,2,Math.max(2,x.canvas.width-tw-pad*2-2)); x.globalAlpha=o.a==null?1:o.a; x.fillStyle=o.bg||"rgba(10,18,28,.78)"; x.fillRect(lx,ly,tw+pad*2,fs+pad*2); x.fillStyle=o.c||"#e9f0f7"; x.textBaseline="middle"; x.fillText(t,lx+pad,py); x.globalAlpha=1; }
/* vista orbital: arrastrar gira (en el móvil solo en horizontal, para no bloquear el scroll); dibuja solo si está visible */
function orbit(c,o){
  const S={yaw:o.yaw||0,pit:o.pit||0,tY:o.yaw||0,tP:o.pit||0,dp:1,W:0,H:0,vis:true,raf:0,anim:false,last:0,pmin:o.pmin==null?-15:o.pmin,pmax:o.pmax==null?89:o.pmax,x:c.getContext("2d")};
  const size=()=>{ S.dp=Math.min(2,window.devicePixelRatio||1); const cw=c.clientWidth||320, ar=typeof o.ar==='function'?o.ar(cw):(o.ar||.62), ch=Math.round(cl(cw*ar,o.hmin||260,o.hmax||460)); if(c.width!==Math.round(cw*S.dp)||c.height!==Math.round(ch*S.dp)){ c.width=Math.round(cw*S.dp); c.height=Math.round(ch*S.dp); c.style.height=ch+"px"; } S.W=c.width; S.H=c.height; };
  const frame=now=>{ S.raf=0; if(!c.isConnected) return; size(); const dt=Math.min(.05,((now||0)-S.last)/1000||.016); S.last=now||0; let mv=false;
    let dy=((S.tY-S.yaw+540)%360)-180; if(Math.abs(dy)>.05){ S.yaw+=dy*Math.min(1,dt*6); mv=true; } else S.yaw=S.tY;
    const dpi=S.tP-S.pit; if(Math.abs(dpi)>.05){ S.pit+=dpi*Math.min(1,dt*6); mv=true; } else S.pit=S.tP;
    try{ if(o.draw(S,dt,(now||0)/1000)) mv=true; }catch(e){ try{ console.error("F0Viz3D",e); }catch(_){} return; }
    if((mv||S.anim)&&S.vis&&!document.hidden) S.raf=RAF(frame); };
  S.kick=()=>{ if(!S.raf&&c.isConnected) S.raf=RAF(frame); };
  S.cam=(k,ox,oy,T,D)=>{ const cy=Math.cos(S.yaw*R), sy=Math.sin(S.yaw*R), cp=Math.cos(S.pit*R), sp=Math.sin(S.pit*R); D=D||1e6;
    S.P=p=>{ const x=p[0]-T[0], y=p[1]-T[1], z=p[2]-T[2], x1=x*cy-z*sy, z1=x*sy+z*cy, y2=y*cp-z1*sp, z2=y*sp+z1*cp, f=D/(D-z2); return [ox+x1*k*f,oy-y2*k*f,z2]; };
    S.eye=vnorm([sy*cp,sp,cy*cp]); };   // dirección hacia la cámara
  let dn=null;
  c.addEventListener("pointerdown",e=>{ dn={x:e.clientX,y:e.clientY,y0:S.tY,p0:S.tP,m:false,t:e.pointerType}; if(e.pointerType==="mouse") try{ c.setPointerCapture(e.pointerId); }catch(_){} });
  c.addEventListener("pointermove",e=>{ if(!dn) return; const dx=e.clientX-dn.x, dy=e.clientY-dn.y; if(Math.hypot(dx,dy)>5) dn.m=true; if(!dn.m) return;
    S.tY=S.yaw=dn.y0-dx*(o.ky||.45); if(dn.t==="mouse") S.tP=S.pit=cl(dn.p0+dy*.35,S.pmin,S.pmax); S.kick(); });
  const up=e=>{ if(!dn) return; const w=dn; dn=null; if(w.m||!o.tap) return; const r=c.getBoundingClientRect(); o.tap((e.clientX-r.left)*S.dp,(e.clientY-r.top)*S.dp); };
  c.addEventListener("pointerup",up); c.addEventListener("pointercancel",()=>{ dn=null; });
  if("IntersectionObserver" in window) new IntersectionObserver(es=>{ S.vis=es.some(e=>e.isIntersecting); if(S.vis) S.kick(); },{rootMargin:"60px"}).observe(c);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) S.kick(); });
  window.addEventListener("resize",()=>S.kick());
  S.go=(y,p)=>{ S.tY=y; S.tP=cl(p,S.pmin,S.pmax); S.kick(); };
  return S;
}
/* modo «Ponme a prueba»: preguntas con 3–4 opciones, explicación y marcador */
function quiz(u,bank,hook){
  const row=u.q("[data-qz]"); let cur=null, sc=[0,0], last=[];
  const next=()=>{ const pool=bank.filter(b=>!last.includes(b)); cur=pool[Math.floor(Math.random()*pool.length)]||bank[0]; last.push(cur); if(last.length>Math.min(5,bank.length-1)) last.shift(); cur.done=0;
    if(hook) hook(cur); const ord=cur.o.map((t,i)=>i).sort(()=>Math.random()-.5);
    row.innerHTML=ord.map(i=>`<button type="button" data-qi="${i}">${cur.o[i]}</button>`).join(""); row.hidden=false;
    u.out.innerHTML=`<b>Pregunta:</b> ${cur.q} <span class="v3sc">· aciertos ${sc[0]}/${sc[1]}</span>`; };
  row.addEventListener("click",e=>{ const b=e.target.closest("[data-qi]"); if(!b||!cur||cur.done) return; cur.done=1; const i=+b.dataset.qi, ok=i===cur.a; sc[1]++; if(ok) sc[0]++;
    row.querySelectorAll("[data-qi]").forEach(x=>{ const j=+x.dataset.qi; x.disabled=true; if(j===cur.a) x.classList.add("qok"); else if(j===i) x.classList.add("qbad"); });
    u.out.innerHTML=`<b class="${ok?"ok":"bad"}">${ok?"Correcto":"No"}</b> · ${cur.e} <span class="v3sc">· aciertos ${sc[0]}/${sc[1]}</span> <button type="button" data-qn>Siguiente →</button>`;
    if(cur.after) cur.after(ok); });
  u.out.addEventListener("click",e=>{ if(e.target.closest("[data-qn]")) next(); });
  return {start(){ sc=[0,0]; last=[]; next(); },stop(){ row.hidden=true; row.innerHTML=""; cur=null; }};
}

/* =====================================================================
   1 · GLOBO TERRESTRE (061): ortodrómica frente a loxodrómica, variación, ecuador magnético y husos horarios
   ===================================================================== */
V.globe=(()=>{
/* costas muy simplificadas [lon, lat]: solo para orientarse (no es una carta) */
const LAND=[
[[-168,65.6],[-164,63],[-165,60.5],[-158,58],[-152,59.5],[-150,61],[-146,60.5],[-140,59.8],[-136,58],[-132,54.5],[-128,51],[-124,48.5],[-124.5,42],[-122.5,37.5],[-120,34.5],[-117,32.5],[-114.5,30.5],[-112,29],[-110,23],[-105.5,20],[-100,17],[-94,16],[-88,13.5],[-85.5,11],[-83,8.5],[-79.5,8.8],[-77.5,8],[-79,9.5],[-83,10],[-83.5,14],[-87,15.8],[-88,18],[-87,21.4],[-90.5,21],[-91.5,18.6],[-94,18.3],[-97.5,21.5],[-97.5,26],[-94,29.5],[-89.5,29.2],[-85,29.8],[-82.8,27.8],[-81,25.2],[-80,27],[-81.3,30.5],[-76,35],[-75.5,38],[-74,40.5],[-70,41.6],[-70.5,43.5],[-66.5,45],[-61,45.5],[-64,47.5],[-59,48],[-55.5,51.5],[-60,55],[-62,58],[-65,60],[-69.5,58.8],[-77,62.5],[-78,59],[-76.5,56],[-79,52],[-82.5,52.5],[-87,55.8],[-93,58.7],[-94.5,61],[-88,64],[-86,66.5],[-82,69],[-90,68.5],[-96,68],[-100,68.2],[-108,68],[-116,69],[-125,69.5],[-135,69],[-141,69.6],[-150,70.4],[-156.5,71.3],[-162,70],[-166,68.8],[-163.5,67]],
[[-73,78],[-66,81],[-45,83],[-25,82],[-18,79],[-20,75],[-22,71],[-26,68.5],[-33,66],[-40,65],[-43,60],[-47,61],[-50,64],[-52,67],[-54,70.5],[-56,74],[-62,76]],
[[-120,74],[-110,78],[-95,80.5],[-80,83],[-62,82.5],[-70,79],[-80,76.5],[-90,74.5],[-105,73]],
[[-77.5,8.5],[-75,11],[-72,12],[-68,10.5],[-62,10.7],[-60,8.5],[-55,6],[-52,4.5],[-50,1.5],[-48.5,-1],[-44,-2.5],[-38.5,-3.8],[-35,-7],[-35,-9],[-38.5,-13],[-39,-17.5],[-40.5,-21],[-43,-23],[-48,-25.5],[-48.5,-28.5],[-50.5,-31],[-53,-34],[-57,-35],[-57,-38.5],[-62,-39],[-65,-42],[-64,-45],[-67.5,-46.5],[-66,-48.5],[-69,-51.5],[-68.5,-52.5],[-71,-54],[-74.5,-52],[-75.5,-48],[-73.5,-43],[-73.5,-37],[-71.5,-32],[-70.5,-25],[-70,-18.5],[-75.5,-15],[-78,-10],[-81,-6],[-80,-2],[-80.5,1],[-78.5,3],[-77.5,6.5]],
[[-85,21.8],[-82,23.2],[-77,22],[-74.2,20.2],[-77.7,19.9],[-80,21.6]],[[-74.4,18.4],[-72.8,19.9],[-69,19.7],[-68.4,18.6],[-71.4,17.6]],
[[-24,65.5],[-22,66.4],[-16,66.5],[-14,65.3],[-15,64.3],[-18.7,63.4],[-22.5,63.8]],
[[-5.7,50],[-3,50.6],[1.4,51.2],[1.7,52.7],[0.2,53.5],[-0.5,54.5],[-1.6,55.6],[-2.1,57.3],[-1.8,57.6],[-3.1,58.6],[-5,58.6],[-6.2,57.5],[-5.6,56],[-4.9,55.1],[-3.2,54.9],[-3.4,54.2],[-3.1,53.4],[-4.6,53.2],[-4.1,52.3],[-5.1,51.8],[-3.3,51.4]],
[[-10,51.6],[-6,52.2],[-6.2,53.9],[-5.6,54.6],[-7.3,55.3],[-8.5,54.6],[-10,54.2],[-10.3,52.2]],
[[-9.5,43],[-9,39],[-9,37],[-6,36.2],[-2,36.7],[0,38.7],[0.5,40.5],[3.2,42],[3,43.3],[6.5,43.1],[8.5,44.3],[10.5,43.5],[12.5,41.5],[16,38],[15.6,40],[18.5,40.2],[16,41.5],[13.5,44],[12.3,45.5],[13.8,45.6],[15,44.5],[19,42],[20,39.5],[22.5,36.5],[24,38],[23,40.5],[26,40.8],[29,41],[27,38],[28,36.7],[33,36.2],[36,36.5],[35.5,33.5],[34.5,31.5],[34.9,29.5],[35,28],[37,25],[39,21.5],[43,13],[45,12.8],[52,16],[55.5,17.5],[57.5,18.8],[59.8,22.5],[56.3,26.2],[54,24],[51.5,24.5],[50,26.5],[48,29.5],[50,30],[54,26.8],[57,25.7],[62,25.2],[66.5,25.4],[67.5,24],[70,21],[72.8,19],[74,15],[76.5,8.5],[78,8.2],[80,10],[80.3,13.5],[80.3,15.8],[82.5,17],[86.5,20],[88,22],[91.5,22.5],[92.3,20.7],[94,18],[94.5,16],[97.5,16.5],[98.3,13],[98.5,10],[98.2,8],[100.5,3.5],[103.5,1.3],[104.2,1.4],[103,5.5],[101,12.7],[103,11],[104.8,8.7],[106.7,10.4],[109.2,12],[108.8,15.5],[106,18.5],[106.6,20.5],[108.5,21.7],[111,21.5],[114,22.3],[117,23.5],[119.5,26],[121.5,28.5],[122,31],[120.5,33.5],[119.2,35],[122.5,37],[121,37.8],[118,38.2],[118,39.2],[121.5,40.8],[121.3,39],[124.3,40],[126.5,37.5],[129.4,35.5],[129.5,37],[128,38.5],[130,42.5],[133,42.8],[135.5,43.8],[138,46.5],[140.5,48.5],[141,52],[137.7,54],[135.2,54.7],[140.5,57.6],[143.5,59.3],[148.5,59.3],[152,59],[155,59.3],[156.7,61.5],[160,61.8],[163.5,62.7],[156.5,57.5],[156,51],[158.5,52.8],[162,56.2],[163,57.8],[162,58.3],[164.5,59.8],[170,60],[174,61.8],[177.5,62.5],[179.9,64.5],[179.9,69],[170,70],[160,69.6],[150,71],[140,72.5],[130,71],[128,73],[113,73.6],[110,76.5],[104,77.7],[98,76],[89,75.5],[80,73.5],[72,72.8],[69,73],[67,71],[70,66.5],[62,69.5],[55,68.5],[45,68.2],[44,66],[40,66.5],[35,69],[28,71],[20,70],[15,68.5],[12.5,65.5],[9,63.5],[5,62],[5.5,59],[8,58],[10.5,59.5],[12,56],[10.8,56.3],[8.5,57.5],[8,55],[8.6,53.7],[5,53.4],[3.5,51.5],[1.6,50.9],[-1.5,49.7],[-4.7,48.4],[-1.2,46],[-1.5,43.5]],
[[-17,21],[-16,24.5],[-13.5,27.8],[-9.8,30],[-9.5,32.5],[-6.5,34.5],[-5.9,35.8],[-2,35.1],[3,36.8],[10,37.3],[11,35],[10.2,33.5],[15.3,32.2],[19.8,30.5],[20,32],[23,32.7],[25,31.6],[29,30.9],[32.3,31.3],[34.2,31.3],[34.3,28],[33.5,27],[35.5,24],[37.3,21],[38.6,17.8],[39.6,15.5],[42.5,12.8],[43.4,11.6],[45,10.5],[51.2,11.8],[51,10],[48.5,5],[46,2],[41.5,-1.8],[40,-3.5],[39.3,-6.5],[39.7,-10],[40.5,-14],[40.5,-15.5],[37,-17.5],[35.3,-22],[35.5,-24],[32.8,-26],[32.4,-28.8],[31,-29.9],[28,-33],[25,-34],[22,-34.2],[20,-34.8],[18.4,-34],[18,-32],[16.5,-28.6],[15.2,-27],[14.4,-22.5],[12,-18],[11.8,-15.5],[13.5,-12],[13.1,-8.5],[12.2,-5.8],[11,-3.8],[9.3,-0.5],[9.5,2.5],[9.7,4],[8.5,4.5],[6,4.3],[4.5,6.3],[1.3,6.1],[-2,4.8],[-4,5.2],[-7.5,4.4],[-9.5,5.5],[-12.5,7.5],[-13.3,9.3],[-15,11],[-16.7,12.5],[-17.2,14.7],[-16.5,16.3],[-16.2,19.5]],
[[44,-25],[47.1,-25],[50.3,-15.5],[49.5,-12],[47,-15.5],[44,-17],[43.5,-22]],
[[130,31.3],[131.5,31.5],[132,33.8],[135,33.5],[136.9,34.3],[139,34.9],[140.9,35.7],[141,38.5],[141.9,40],[141.5,41.4],[140,40.8],[139.8,39],[138.5,37.5],[136.8,37.2],[136,35.6],[133,35.5],[131,34.2],[130,33.5]],
[[140,41.5],[141.2,41.8],[143.2,42],[145.5,43.3],[144.5,44],[141.7,45.4],[141.6,43.2],[140,42.4]],
[[120,18.5],[122.3,18.5],[122,16],[124,13],[126,9],[125.5,6],[122,7],[123,10],[121.5,13.8],[120,16]],
[[95.3,5.6],[97.5,5.2],[100.5,2],[104.5,-1.5],[106,-3.2],[106,-5.9],[104.5,-5.8],[102.3,-4],[100.5,-1],[98.8,1.7]],
[[109,1.5],[110.2,-2.9],[114.5,-4],[116.5,-3],[118,1],[119,5],[117,7],[116,6],[113.5,4],[111,2.2]],
[[105.3,-6.8],[108,-7.8],[111,-8.2],[114.5,-8.7],[114.4,-7.7],[111,-6.4],[108.5,-6.6],[106,-5.9]],
[[131,-1],[134,-0.8],[138,-1.7],[141,-2.6],[145.5,-4.3],[147.5,-6.3],[147.8,-8],[150.3,-10.5],[146,-8.5],[143.5,-9],[141,-9.2],[138,-8.3],[137.5,-5],[135,-4.4],[132.5,-3]],
[[113.5,-22],[114,-26.5],[115,-30],[115,-34],[118,-35],[123.5,-34],[126,-32.3],[131,-31.5],[134,-32.5],[136,-35],[138,-35.5],[139.6,-37.5],[141,-38.3],[144,-38.3],[146.4,-39],[150,-37.5],[151.2,-33.8],[153,-31],[153.5,-28],[153,-25],[150.8,-22.6],[149,-20.5],[146,-18.5],[145.4,-15],[143.5,-14],[142.5,-10.8],[141.6,-13],[141.6,-16.5],[140.8,-17.4],[139.3,-17.4],[137,-15.5],[135.8,-15],[136.7,-12.2],[132.7,-11.5],[131,-12.2],[129.5,-14.9],[127.5,-14],[125,-15.3],[122.2,-17.5],[121.5,-19.2],[118.7,-20.3],[116.7,-20.6]],
[[172.7,-34.4],[174.5,-36],[176,-37.6],[178.5,-37.7],[177,-39.3],[176.2,-41.2],[174.7,-41.3],[175,-39.8],[173.8,-39.3],[174.4,-37]],
[[172.7,-40.5],[174.3,-41.6],[173,-43.8],[171.2,-44.5],[170.7,-45.9],[168.4,-46.6],[166.5,-46],[167,-45],[168.3,-44],[170.8,-42.8],[172.2,-41]],
[[-180,-78],[-150,-77],[-120,-73.5],[-90,-72.5],[-60,-64],[-57,-63.3],[-65,-68],[-60,-73],[-30,-77],[0,-70],[30,-69.5],[60,-67],[90,-66.3],[120,-66.5],[150,-68.5],[170,-71.5],[180,-78],[180,-90],[-180,-90]]];
/* ecuador magnético (de inclinación) aproximado [lon, lat] */
const MEQ=[[-180,0],[-140,3],[-100,2],[-75,-10],[-50,-14],[-30,-8],[-10,4],[10,9],[40,10],[80,9],[110,8],[140,4],[180,0]];
const MNP=[86,-140], MSP=[-64,135];   // polos magnéticos (aprox. 2025)
const C={MAD:["Madrid",40.42,-3.70],NYC:["Nueva York",40.64,-73.78],LAX:["Los Ángeles",33.94,-118.41],TYO:["Tokio",35.77,140.39],SYD:["Sídney",-33.95,151.18],EZE:["Buenos Aires",-34.82,-58.54],ANC:["Anchorage",61.17,-150.0],CPT:["Ciudad del Cabo",-33.97,18.60]};
const ROUTES={ny:["MAD","NYC"],la:["MAD","LAX"],ty:["MAD","TYO"],ba:["MAD","EZE"],sy:["MAD","SYD"]};
const VAR={MAD:1,NYC:-13,LAX:11,ANC:14,TYO:-8,SYD:13,CPT:-25};   // variación aproximada 2025: + Este, − Oeste
const P3=(lat,lon,r)=>{ r=r||1; const a=lat*R, b=lon*R; return [r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b)]; };
const toLL=p=>[Math.asin(cl(p[1],-1,1))/R,Math.atan2(p[0],p[2])/R];
const gcPts=(A,B,n)=>{ const a=P3(A[0],A[1]), b=P3(B[0],B[1]), om=Math.acos(cl(vdot(a,b),-1,1)), s=Math.sin(om)||1e-9; return Array.from({length:n+1},(_,i)=>{ const t=i/n; return vadd(vmul(a,Math.sin((1-t)*om)/s),vmul(b,Math.sin(t*om)/s)); }); };
const merc=f=>Math.log(Math.tan(Math.PI/4+f*R/2));
const rlPts=(A,B,n)=>{ let dl=B[1]-A[1]; if(dl>180) dl-=360; if(dl<-180) dl+=360; const y0=merc(A[0]), y1=merc(B[0]); return Array.from({length:n+1},(_,i)=>{ const t=i/n, y=lerp(y0,y1,t), f=(2*Math.atan(Math.exp(y))-Math.PI/2)/R; return P3(f,A[1]+dl*t); }); };
const NM=3440.065;
function legs(A,B){ const f1r=A[0]*R, f2r=B[0]*R; let dl=(B[1]-A[1]); if(dl>180) dl-=360; if(dl<-180) dl+=360; const dlr=dl*R;
  const a=P3(A[0],A[1]), b=P3(B[0],B[1]), om=Math.acos(cl(vdot(a,b),-1,1)), gc=om*NM;
  const brg=(p,q)=>{ const fa=p[0]*R, fb=q[0]*R; let d=(q[1]-p[1]); if(d>180) d-=360; if(d<-180) d+=360; d*=R; return (Math.atan2(Math.sin(d)*Math.cos(fb),Math.cos(fa)*Math.sin(fb)-Math.sin(fa)*Math.cos(fb)*Math.cos(d))/R+360)%360; };
  const c0=brg(A,B), c1=(brg(B,A)+180)%360, dpsi=merc(B[0])-merc(A[0]), df=f2r-f1r, q=Math.abs(dpsi)>1e-12?df/dpsi:Math.cos(f1r), rl=Math.hypot(df,q*dlr)*NM, rc=(Math.atan2(dlr,dpsi)/R+360)%360;
  return {gc,c0,c1,rl,rc}; }
const QZ=[
 {q:"¿Cuál de las dos líneas amarillas o azules es la <b>ortodrómica</b> (great circle) entre Madrid y Tokio?",o:["La amarilla: la que se curva hacia el polo","La azul: la que corta todos los meridianos con el mismo ángulo","Las dos miden lo mismo"],a:0,e:"La ortodrómica es el arco de círculo máximo: la distancia más corta. En el hemisferio norte siempre queda del lado del <b>polo</b> respecto a la loxodrómica.",s:{m:"rt",r:"ty"}},
 {q:"Entre Madrid y Nueva York, ¿qué ruta es más <b>corta</b>?",o:["La ortodrómica (great circle)","La loxodrómica (rhumb line)","Miden lo mismo porque están a la misma latitud"],a:0,e:"Siempre la ortodrómica, salvo sobre el ecuador o un meridiano, donde coinciden. Aunque las dos ciudades estén a unos 40° N, el paralelo <b>no</b> es un círculo máximo.",s:{m:"rt",r:"ny"}},
 {q:"¿Qué línea corta <b>todos los meridianos con el mismo ángulo</b> (rumbo verdadero constante)?",o:["La loxodrómica","La ortodrómica","Ninguna: los meridianos convergen"],a:0,e:"Loxodrómica = rumbo constante. La ortodrómica cambia de rumbo verdadero al cruzar cada meridiano (convergencia de meridianos), salvo en el ecuador o siguiendo un meridiano.",s:{m:"rt",r:"la"}},
 {q:"Rumbo verdadero 270°, variación <b>13° W</b> (Nueva York). ¿Rumbo magnético?",o:["283°","257°","270°"],a:0,e:"True → Variation → Magnetic: con variación Oeste se <b>suma</b> («West is best»): 270 + 13 = 283°.",s:{m:"var",c:"NYC"}},
 {q:"Rumbo verdadero 090°, variación <b>13° E</b> (Sídney). ¿Rumbo magnético?",o:["077°","103°","090°"],a:0,e:"Con variación Este se <b>resta</b> («East is least»): 090 − 13 = 077°.",s:{m:"var",c:"SYD"}},
 {q:"¿Cuántos grados de longitud equivalen a <b>1 hora</b> de hora media local (LMT)?",o:["15°","1°","24°"],a:0,e:"360° en 24 h → 15° por hora, es decir <b>4 minutos por grado</b>. Longitud Este: la hora local va <b>por delante</b> de UTC.",s:{m:"tz"}},
 {q:"Estás en longitud <b>60° E</b> y son las 12:00 UTC. ¿Qué hora media local (LMT) es?",o:["16:00","08:00","12:00"],a:0,e:"60° × 4 min = 240 min = 4 h. Longitud Este → se suma: 12:00 + 4 h = <b>16:00 LMT</b>.",s:{m:"tz"}},
 {q:"Cruzas el <b>antimeridiano (180°)</b> volando hacia el Este. ¿Qué pasa con la fecha?",o:["Restas un día","Sumas un día","No cambia"],a:0,e:"Hacia el Este cruzando la línea de cambio de fecha se <b>resta</b> un día (vuelves a vivir la fecha); hacia el Oeste se suma.",s:{m:"tz"}},
 {q:"¿Por qué la brújula no apunta al Norte verdadero?",o:["Porque el polo magnético no coincide con el geográfico (variación) y el campo es irregular","Porque la Tierra gira","Por el desvío del avión, solo por eso"],a:0,e:"El polo norte magnético está hoy cerca de 86° N y se desplaza hacia Siberia. El ángulo entre el Norte verdadero y el magnético es la <b>variación (declinación)</b>; el desvío es otro error, el del propio avión.",s:{m:"var",c:"ANC"}}];
return {t:"3D · La Tierra: ortodrómica, loxodrómica, variación y husos horarios",
cap:"Globo esquemático: las costas están muy simplificadas y los polos y el ecuador magnético son aproximados (2025). Arrastra para girarlo (con ratón también lo inclinas). Distancias en NM sobre una Tierra esférica de radio medio 6.371 km; los rumbos son verdaderos.",
init(el){
  const ctl=row("Modo",bt("data-m","rt","Rutas",1)+bt("data-m","var","Variación")+bt("data-m","tz","Husos horarios")+bt("data-m","quiz","Ponme a prueba"))
   +row("Ruta",`<select data-rt aria-label="Ruta">${Object.keys(ROUTES).map(k=>`<option value="${k}">${C[ROUTES[k][0]][0]} → ${C[ROUTES[k][1]][0]}</option>`).join("")}</select><button type="button" data-fly aria-pressed="false">▶ Volar las dos</button>`,"data-prt")
   +row("Lugar",`<select data-vc aria-label="Lugar">${Object.keys(VAR).map(k=>`<option value="${k}">${C[k][0]} · ${Math.abs(VAR[k])}° ${VAR[k]>=0?"E":"W"}</option>`).join("")}</select>`+sl("th","Rumbo verdadero",0,359,270),"data-pvar hidden")
   +row("Vista",bt("data-v","eu","Europa")+bt("data-v","at","Atlántico")+bt("data-v","np","Polo Norte")+bt("data-v","pa","Pacífico")+`<label class="v3k"><input type="checkbox" data-mag checked> Magnetismo</label><label class="v3k"><input type="checkbox" data-lab checked> Nombres</label>`)
   +`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Globo terrestre en 3D: arrastra para girarlo",ctl,this.cap);
  let mode="rt", rk="ny", vc="NYC", th=270, mag=true, labs=true, fly=0, flying=false;
  const S=orbit(u.c,{yaw:-30,pit:32,ar:.66,hmin:300,hmax:520,pmin:-80,pmax:89,ky:.4,draw});
  const LANDP=LAND.map(poly=>poly.map(q=>P3(q[1],q[0])));
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp, k=Math.min(W,H)*.40, ox=W*.5, oy=H*.52, D=7; S.cam(k,ox,oy,[0,0,0],D);
    x.setTransform(1,0,0,1,0,0); x.globalAlpha=1; const bg=x.createLinearGradient(0,0,0,H); bg.addColorStop(0,"#050b18"); bg.addColorStop(1,"#0b1626"); x.fillStyle=bg; x.fillRect(0,0,W,H);
    for(let i=0;i<70;i++){ x.globalAlpha=.2+.6*((i*37)%11)/11; x.fillStyle="#cfe0ff"; x.fillRect(((i*97.3)%W+i*13)%W,((i*53.7)%H),d,d); } x.globalAlpha=1;
    const rl=k*D/Math.sqrt(D*D-1), P=S.P, vis=p=>P(p)[2]>.02;
    // océano con luz lateral y halo atmosférico
    const ha=x.createRadialGradient(ox,oy,rl*.96,ox,oy,rl*1.12); ha.addColorStop(0,"rgba(120,180,255,.35)"); ha.addColorStop(1,"rgba(120,180,255,0)"); x.fillStyle=ha; x.beginPath(); x.arc(ox,oy,rl*1.12,0,7); x.fill();
    const og=x.createRadialGradient(ox-rl*.35,oy-rl*.4,rl*.1,ox,oy,rl); og.addColorStop(0,"#2f6fae"); og.addColorStop(.7,"#173f6d"); og.addColorStop(1,"#0b2442"); x.fillStyle=og; x.beginPath(); x.arc(ox,oy,rl,0,7); x.fill();
    // husos horarios (bandas de 15°)
    if(mode==="tz"){ for(let z=-12;z<12;z++){ const l0=z*15-7.5, l1=z*15+7.5, pts=[]; for(let f=-80;f<=80;f+=8) pts.push(P3(f,l0)); for(let f=80;f>=-80;f-=8) pts.push(P3(f,l1));
        poly(pts,z%2?"rgba(255,201,77,.10)":"rgba(140,200,255,.07)",null); } }
    // tierras
    for(const L of LANDP){ const q=L.map(P); if(q.every(p=>p[2]<.02)) continue; x.beginPath(); q.forEach((p,i)=>{ let X=p[0], Y=p[1]; if(p[2]<.02){ const a=Math.atan2(Y-oy,X-ox); X=ox+rl*Math.cos(a); Y=oy+rl*Math.sin(a); } i?x.lineTo(X,Y):x.moveTo(X,Y); }); x.closePath();
      x.fillStyle="rgba(122,150,96,.92)"; x.fill(); x.strokeStyle="rgba(210,230,190,.45)"; x.lineWidth=.7*d; x.beginPath(); q.forEach((p,i)=>{ const o=q[(i+q.length-1)%q.length]; if(p[2]>.02&&o[2]>.02){ x.moveTo(o[0],o[1]); x.lineTo(p[0],p[1]); } }); x.stroke(); }
    // sombreado de esfera por encima de todo lo pintado
    const sg=x.createRadialGradient(ox-rl*.4,oy-rl*.45,rl*.2,ox,oy,rl*1.02); sg.addColorStop(0,"rgba(255,255,255,.10)"); sg.addColorStop(.6,"rgba(0,0,0,0)"); sg.addColorStop(1,"rgba(0,8,20,.55)"); x.fillStyle=sg; x.beginPath(); x.arc(ox,oy,rl,0,7); x.fill();
    // retícula: meridianos cada 15° (= 1 h) y paralelos cada 15°
    x.lineWidth=d; for(let l=-180;l<180;l+=15){ const pts=[]; for(let f=-90;f<=90;f+=3) pts.push(P3(f,l)); line(pts,l===0?"rgba(255,255,255,.75)":"rgba(220,235,255,.22)",l===0?1.6:1); }
    for(let f=-75;f<=75;f+=15){ const pts=[]; for(let l=-180;l<=180;l+=3) pts.push(P3(f,l)); line(pts,f===0?"rgba(255,255,255,.85)":"rgba(220,235,255,.22)",f===0?1.8:1); }
    { const pts=[]; for(let f=-90;f<=90;f+=3) pts.push(P3(f,180)); line(pts,"rgba(255,140,120,.8)",1.4,[5,4]); }
    if(mag){ const pts=[]; for(let i=0;i<MEQ.length-1;i++) for(let s=0;s<6;s++){ const a=MEQ[i], b=MEQ[i+1], tt=s/6; pts.push(P3(lerp(a[1],b[1],tt),lerp(a[0],b[0],tt))); } line(pts,"rgba(230,120,255,.9)",1.6,[3,3]); }
    // polos
    dot(P3(90,0),"#ffffff",3.2,labs?"Polo Norte verdadero · True North":null,1); dot(P3(-90,0),"#ffffff",3.2,labs?"Polo Sur · South Pole":null);
    if(mag){ dot(P3(MNP[0],MNP[1]),"#e678ff",3.6,labs?"Polo N magnético · Magnetic North":null); dot(P3(MSP[0],MSP[1]),"#e678ff",3.2,labs?"Polo S magnético":null); }
    if(labs){ lab(P3(0,-25),"Ecuador · Equator","#fff"); lab(P3(51.5,0),"Greenwich 0°","#fff"); if(mag) lab(P3(-12,-48),"Ecuador magnético","#e678ff"); lab(P3(30,180),"180° · cambio de fecha","#ff9c88"); }
    // husos: rótulos UTC
    if(mode==="tz"){ const nar=W/d<600; for(let z=-12;z<=12;z++){ if(nar&&z%2) continue; const p=P3(-3,z*15), q=P(p); if(q[2]<.45) continue; tag(x,q[0],q[1],"UTC"+(z>0?"+":z<0?"−":"±")+Math.abs(z),{dp:d,fs:11,al:"c",c:z?"#ffe7a8":"#fff",bg:"rgba(8,16,28,.7)"}); } }
    // rutas
    let moving=false;
    if(mode==="rt"||(mode==="quiz"&&qs&&qs.m==="rt")){ const A=C[ROUTES[rk][0]], B=C[ROUTES[rk][1]], a=[A[1],A[2]], b=[B[1],B[2]], gp=gcPts(a,b,90), rp=rlPts(a,b,90);
      line(rp,"#55d0ff",3.2); line(gp,"#ffd24d",3.4);
      dot(P3(a[0],a[1]),"#ffffff",3.6,A[0]); dot(P3(b[0],b[1]),"#ffffff",3.6,B[0]);
      if(flying){ fly=Math.min(1,fly+dt*.16); moving=fly<1; for(const [pts,c] of [[gp,"#ffd24d"],[rp,"#55d0ff"]]){ const i=fly*(pts.length-1), j=Math.floor(i), p=vadd(vmul(pts[j],1-(i-j)),vmul(pts[Math.min(pts.length-1,j+1)],i-j)); if(vis(p)){ const q=P(p); x.fillStyle=c; x.beginPath(); x.arc(q[0],q[1],5*d,0,7); x.fill(); x.strokeStyle="#0a1420"; x.lineWidth=1.5*d; x.stroke(); } }
        if(fly>=1) flying=false; }
      legend([["#ffd24d","Ortodrómica · Great circle"],["#55d0ff","Loxodrómica · Rhumb line"]]); }
    // variación en el lugar elegido
    if(mode==="var"||(mode==="quiz"&&qs&&qs.m==="var")){ const c=C[vc], p=P3(c[1],c[2]), la=c[1]*R, lo=c[2]*R, N=[-Math.sin(la)*Math.sin(lo),Math.cos(la),-Math.sin(la)*Math.cos(lo)], E=[Math.cos(lo),0,-Math.sin(lo)], v=VAR[vc]*R;
      const M=vadd(vmul(N,Math.cos(v)),vmul(E,Math.sin(v))), L=.32, q0=P(p);
      arrow(p,vadd(p,vmul(N,L)),"#ffffff","Nv",v<0?1:0); arrow(p,vadd(p,vmul(M,L)),"#e678ff","Nm",v<0?0:1);
      const hd=vadd(vmul(N,Math.cos(th*R)),vmul(E,Math.sin(th*R))); arrow(p,vadd(p,vmul(hd,L*.8)),"#ffd24d","");
      dot(p,"#ffffff",3.4,c[0]);
      legend([["#ffffff","Norte verdadero · True North"],["#e678ff","Norte magnético · Magnetic North"],["#ffd24d","Rumbo del avión"]]); }
    if(mode==="tz") legend([["#ffe7a8","Husos de 15° = 1 hora"],["#ff9c88","180°: línea de cambio de fecha"]]);
    return moving;
    function line(pts,col,w,dash){ x.strokeStyle=col; x.lineWidth=(w||1)*d; x.setLineDash(dash?dash.map(v=>v*d):[]); x.beginPath(); let on=false; for(const p of pts){ const q=P(p); if(q[2]>.02){ on?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]); on=true; } else on=false; } x.stroke(); x.setLineDash([]); }
    function poly(pts,fill){ const q=pts.map(P); if(q.every(p=>p[2]<.02)) return; x.beginPath(); q.forEach((p,i)=>{ let X=p[0], Y=p[1]; if(p[2]<.02){ const a=Math.atan2(Y-oy,X-ox); X=ox+rl*Math.cos(a); Y=oy+rl*Math.sin(a); } i?x.lineTo(X,Y):x.moveTo(X,Y); }); x.closePath(); x.fillStyle=fill; x.fill(); }
    function dot(p,col,r,t,up){ if(!vis(p)) return; const q=P(p); x.fillStyle=col; x.beginPath(); x.arc(q[0],q[1],r*d,0,7); x.fill(); x.strokeStyle="#0a1420"; x.lineWidth=d; x.stroke(); if(t){ const mg=col!=="#ffffff"; tag(x,mg?q[0]-7*d:q[0]+7*d,q[1]+(up?-13:mg?11:-9)*d,t,{dp:d,fs:11.5,al:mg?"r":null,c:mg?"#f2c8ff":"#e9f0f7"}); } }
    function lab(p,t,c){ if(!vis(p)) return; const q=P(p); tag(x,q[0],q[1],t,{dp:d,fs:10.5,al:"c",c,bg:"rgba(8,16,28,.55)"}); }
    function arrow(a,b,col,t,rt){ if(!vis(a)) return; const p=P(a), q=P(b), ang=Math.atan2(q[1]-p[1],q[0]-p[0]); x.strokeStyle=col; x.fillStyle=col; x.lineWidth=2.6*d; x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke();
      x.beginPath(); x.moveTo(q[0],q[1]); x.lineTo(q[0]-9*d*Math.cos(ang-.45),q[1]-9*d*Math.sin(ang-.45)); x.lineTo(q[0]-9*d*Math.cos(ang+.45),q[1]-9*d*Math.sin(ang+.45)); x.closePath(); x.fill(); if(t) tag(x,rt?q[0]+5*d:q[0]-5*d,q[1]-6*d,t,{dp:d,fs:11,c:col,al:rt?null:"r"}); }
    function legend(it){ const fs=11.5*d; x.font=`600 ${fs}px system-ui,sans-serif`; let y=H-10*d-(it.length-1)*fs*1.5; for(const [c,t] of it){ x.fillStyle="rgba(8,16,28,.72)"; x.fillRect(8*d,y-fs*.85,x.measureText(t).width+30*d,fs*1.3); x.fillStyle=c; x.fillRect(12*d,y-fs*.25,14*d,3*d); x.fillStyle="#e9f0f7"; x.textBaseline="middle"; x.fillText(t,30*d,y); y+=fs*1.5; } }
  }
  let qs=null;
  const say=()=>{ if(mode==="rt"){ const A=C[ROUTES[rk][0]], B=C[ROUTES[rk][1]], g=legs([A[1],A[2]],[B[1],B[2]]);
      u.out.innerHTML=`<b>${A[0]} → ${B[0]}</b> · Ortodrómica <b>${f0(g.gc)} NM</b>: sale con rumbo verdadero <b>${d3(g.c0)}°</b> y llega con <b>${d3(g.c1)}°</b> (cambia ${f0(Math.abs(((g.c1-g.c0+540)%360)-180))}°). Loxodrómica <b>${f0(g.rl)} NM</b> con rumbo constante <b>${d3(g.rc)}°</b>: ${f0(g.rl-g.gc)} NM más (${f1((g.rl/g.gc-1)*100)} %).`; }
    else if(mode==="var"){ const v=VAR[vc], mh=((th-v)%360+360)%360;
      u.out.innerHTML=`<b>${C[vc][0]}</b>: variación ≈ <b>${Math.abs(v)}° ${v>=0?"E":"W"}</b>. Rumbo verdadero <b>${d3(th)}°</b> ${v>=0?"−":"+"} ${Math.abs(v)}° = rumbo magnético <b>${d3(mh)}°</b>. ${v>=0?"«East is least»: con variación Este se resta.":"«West is best»: con variación Oeste se suma."} Orden: <b>T</b>rue → <b>V</b>ariation → <b>M</b>agnetic → <b>D</b>eviation → <b>C</b>ompass.`; }
    else if(mode==="tz"){ const n=new Date(), hh=n.getUTCHours()+n.getUTCMinutes()/60, lmt=l=>{ const h=((hh+l/15)%24+24)%24; return String(Math.floor(h)).padStart(2,"0")+":"+String(Math.floor((h%1)*60)).padStart(2,"0"); };
      u.out.innerHTML=`Cada <b>15° de longitud = 1 hora</b> (4 min por grado). Ahora son las <b>${lmt(0)} UTC</b>: hora media local en Madrid (3,7° W) <b>${lmt(-3.7)}</b>, en Tokio (140,4° E) <b>${lmt(140.4)}</b>, en Nueva York (73,8° W) <b>${lmt(-73.8)}</b>. Longitud <b>Este</b> → la hora local va por delante de UTC (se suma). La hora oficial de cada país puede no coincidir con su huso.`; } };
  const setMode=m=>{ mode=m; press(u,"data-m",m); u.q("[data-prt]").hidden=m!=="rt"; u.q("[data-pvar]").hidden=m!=="var"; if(m==="quiz"){ Q.start(); } else { Q.stop(); qs=null; say(); }
    if(m==="var") goTo(C[vc][1],C[vc][2]); if(m==="tz") S.go(-20,8); S.kick(); };
  const goTo=(lat,lon)=>S.go(lon,cl(lat,-60,70));
  const Q=quiz(u,QZ,c=>{ qs=c.s; if(qs.r) rk=qs.r; if(qs.c) vc=qs.c; if(qs.m==="rt"){ const A=C[ROUTES[rk][0]], B=C[ROUTES[rk][1]]; const m=toLL(vnorm(vadd(P3(A[1],A[2]),P3(B[1],B[2])))); goTo(m[0]+10,m[1]); }
    else if(qs.m==="var") goTo(C[vc][1],C[vc][2]); else S.go(-20,8); mode="quiz"; S.kick(); });
  u.qa("[data-m]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.m)));
  u.q("[data-rt]").addEventListener("change",e=>{ rk=e.target.value; fly=0; flying=false; const A=C[ROUTES[rk][0]], B=C[ROUTES[rk][1]], m=toLL(vnorm(vadd(P3(A[1],A[2]),P3(B[1],B[2])))); goTo(m[0]+10,m[1]); say(); });
  u.q("[data-fly]").addEventListener("click",()=>{ fly=0; flying=true; S.kick(); });
  u.q("[data-vc]").addEventListener("change",e=>{ vc=e.target.value; goTo(C[vc][1],C[vc][2]); say(); }); u.q("[data-vc]").value=vc;
  const thI=u.q('[data-k="th"]'), thO=u.q('[data-o="th"]'); const th0=()=>{ th=+thI.value; thO.textContent=d3(th)+"°"; say(); S.kick(); }; thI.addEventListener("input",th0); thO.textContent=d3(th)+"°";
  const VW={eu:[0,40],at:[-40,25],np:[-20,89],pa:[-160,10]};
  u.qa("[data-v]").forEach(b=>b.addEventListener("click",()=>{ const v=VW[b.dataset.v]; S.go(v[0],v[1]); }));
  u.q("[data-mag]").addEventListener("change",e=>{ mag=e.target.checked; S.kick(); });
  u.q("[data-lab]").addEventListener("change",e=>{ labs=e.target.checked; S.kick(); });
  setMode("rt"); { const A=C.MAD, B=C.NYC, m=toLL(vnorm(vadd(P3(A[1],A[2]),P3(B[1],B[2])))); S.yaw=S.tY=m[1]; S.pit=S.tP=m[0]+10; } S.kick();
}};
})();

/* =====================================================================
   2 · APROXIMACIÓN ILS / VOR EN 3D (062)
   Ejes: +x hacia el Este (pista 09, se aproxima hacia +x), y arriba, +z hacia el Sur (la derecha del piloto). Unidades: km; vertical exagerada ×4.
   ===================================================================== */
V.ils3d=(()=>{
const EX=4, KM=1.852, FT=.0003048, LOCX=3.3, GSX=.3, GSZ=-.15, VORX=-6*KM, CONE=50;
const QZ=[
 {q:"El avión está a la <b>derecha</b> del localizador. ¿Qué modulación predomina?",o:["150 Hz","90 Hz","Las dos por igual"],a:0,e:"Mirando hacia la pista, el lóbulo de <b>90 Hz</b> está a la <b>izquierda</b> y el de <b>150 Hz</b> a la <b>derecha</b>. Sobre el eje se reciben igual (DDM = 0).",s:{d:7,l:.45,h:0}},
 {q:"El avión está <b>por encima</b> de la senda de planeo. ¿Qué predomina?",o:["90 Hz","150 Hz","Ninguna: la senda no usa modulaciones"],a:0,e:"Senda: <b>90 Hz arriba</b> y <b>150 Hz abajo</b>. Truco: «el 90 manda arriba y a la izquierda».",s:{d:5,l:0,h:450}},
 {q:"La aguja del localizador está a la <b>izquierda</b> del centro. ¿Hacia dónde corriges?",o:["Hacia la izquierda","Hacia la derecha","Mantienes rumbo: es un error del instrumento"],a:0,e:"«Vuela hacia la aguja»: la aguja te enseña dónde está el eje. Si está a la izquierda, el eje (y la pista) está a tu izquierda.",s:{d:8,l:.6,h:0}},
 {q:"Senda de 3°: ¿a qué altura sobre el umbral deberías estar a <b>3 NM</b>?",o:["Unos 950 ft","Unos 600 ft","Unos 1.500 ft"],a:0,e:"Regla de los 300 ft por NM (exacto: 318 ft/NM para 3°): 3 × 318 ≈ <b>955 ft</b>.",s:{d:3,l:0,h:0}},
 {q:"Velocidad sobre el suelo 120 kt en una senda de 3°. ¿Régimen de descenso?",o:["≈ 600 ft/min","≈ 360 ft/min","≈ 1.200 ft/min"],a:0,e:"Regla rápida: <b>GS × 5</b> = 120 × 5 = 600 ft/min (exacto: GS × 5,3).",s:{d:6,l:0,h:0}},
 {q:"Pasas justo por encima del VOR. ¿Qué es fiable dentro del <b>cono de confusión</b>?",o:["Nada: la aguja oscila y TO/FROM puede cambiar","La aguja, pero no la bandera TO/FROM","Todo, si el VOR es Doppler"],a:0,e:"Encima de la estación las indicaciones no son fiables: la aguja oscila y la bandera cambia. Mantén rumbo hasta salir del cono.",s:{d:6,l:0,h:2500,ov:1}},
 {q:"Con el OBS en 090° vuelas hacia el Este y cruzas el VOR. ¿Qué pasa con la bandera?",o:["Pasa de TO a FROM","Pasa de FROM a TO","No cambia: depende del rumbo"],a:0,e:"TO/FROM depende de tu <b>posición</b> respecto a la estación y del OBS, no del rumbo. Al cruzar la estación pasa de TO a FROM.",s:{d:4,l:0,h:0}},
 {q:"¿Qué escala completa tiene la <b>senda de planeo</b> frente al localizador?",o:["±0,7° frente a ±2,5°","±2,5° frente a ±0,7°","±10° las dos"],a:0,e:"La senda es mucho más sensible: <b>±0,7°</b> a fondo de escala; el localizador, ±2,5° (en el VOR, ±10°).",s:{d:4,l:.2,h:150}}];
/* avión de línea esquemático (x morro, y arriba, z ala derecha), en km, escalado para que se vea */
const AC=(()=>{ const f=[], L=.5, w=.06, K=1.6; const box=(a,b,c)=>f.push({p:[a,b,c]});
  const nose=[L*.5,0,0], tail=[-L*.5,.01,0], q=[[0,w,0],[0,0,w],[0,-w,0],[0,0,-w]];
  for(let i=0;i<4;i++){ const a=q[i], b=q[(i+1)%4]; f.push({p:[nose,vadd(a,[L*.3,0,0]),vadd(b,[L*.3,0,0])],c:[230,234,240]}); f.push({p:[vadd(a,[L*.3,0,0]),vadd(a,[-L*.3,0,0]),vadd(b,[-L*.3,0,0]),vadd(b,[L*.3,0,0])],c:[228,232,238]}); f.push({p:[vadd(a,[-L*.3,0,0]),tail,vadd(b,[-L*.3,0,0])],c:[220,224,232]}); }
  f.push({p:[[.06,-.02,0],[-.08,-.02,.42],[-.14,-.02,.42],[-.08,-.02,0]],c:[200,208,220]}); f.push({p:[[.06,-.02,0],[-.08,-.02,-.42],[-.14,-.02,-.42],[-.08,-.02,0]],c:[200,208,220]});
  f.push({p:[[-.18,.01,0],[-.25,.01,.15],[-.27,.01,.15],[-.26,.01,0]],c:[200,208,220]}); f.push({p:[[-.18,.01,0],[-.25,.01,-.15],[-.27,.01,-.15],[-.26,.01,0]],c:[200,208,220]});
  f.push({p:[[-.17,.05,0],[-.26,.17,0],[-.28,.17,0],[-.26,.05,0]],c:[40,90,170]}); f.forEach(o=>{ o.p=o.p.map(p=>vmul(p,K)); if(!o.c) o.c=[220,224,232]; }); return f; })();
return {t:"3D · Aproximación ILS con VOR: lóbulos de 90 y 150 Hz, senda de 3° y cono de confusión",
cap:"Escena esquemática: la vertical está exagerada ×4 y el avión dibujado a mayor escala para que se vea. Pista 09 de 3 km; localizador más allá del final de pista; antena de senda a 300 m del umbral; VOR en el eje a 6 NM. Escalas como en la lámina 2D: localizador ±2,5° y senda ±0,7° a fondo de escala (2 puntos); VOR ±10°. El ángulo del cono de confusión es orientativo.",
init(el){
  const ctl=row("Modo",bt("data-m","fly","Explorar",1)+bt("data-m","quiz","Ponme a prueba")+`<button type="button" data-ap aria-pressed="false">▶ Interceptar y volar</button>`)
   +row("",sl("d","Distancia al umbral",.5,12,7,.1)+sl("l","Desvío lateral (− izq · + dcha)",-1,1,.35,.01)+sl("h","Altura sobre la senda",-600,1500,300,10))
   +row("Vista",bt("data-v","be","Detrás del avión")+bt("data-v","si","Lateral")+bt("data-v","to","Planta")+bt("data-v","34","3/4")+`<label class="v3k"><input type="checkbox" data-lb checked> Lóbulos</label><label class="v3k"><input type="checkbox" data-vo checked> VOR</label>`)
   +`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Aproximación ILS en 3D con los lóbulos del localizador y de la senda, el VOR y su cono de confusión",ctl,this.cap);
  const st={d:7,l:.35,h:300}; let lobes=true, vor=true, ap=false, mode="fly", jit=0, view="34";
  const I={}; ["d","l","h"].forEach(k=>{ I[k]=u.q(`[data-k="${k}"]`); I[k+"o"]=u.q(`[data-o="${k}"]`); I[k].addEventListener("input",()=>{ st[k]=+I[k].value; ap=false; press(u,"data-ap","x"); out(); S.kick(); }); });
  const syncI=()=>{ for(const k of ["d","l","h"]){ I[k].value=st[k]; } I.do.textContent=f1(st.d)+" NM"; I.lo.textContent=(st.l>0?"+":"")+(Math.round(st.l*100)/100).toString().replace(".",",")+" NM"; I.ho.textContent=(st.h>0?"+":"")+f0(st.h)+" ft"; };
  const geo=()=>{ const x=-st.d*KM, glide=Math.tan(3*R)*(st.d*KM+GSX)/FT, hft=Math.max(0,glide+st.h), y=hft*FT, z=st.l*KM;
    const loc=Math.atan2(z,LOCX-x)/R, gs=Math.atan2(y,GSX-x)/R-3, hv=Math.hypot(x-VORX,z), inCone=y>.02&&hv<y*Math.tan(CONE*R);
    const brg=(Math.atan2(x-VORX,-z)/R+360)%360, wr=a=>((a+540)%360)-180, toD=wr(brg-270), to=Math.abs(toD)<90, vd=to?toD:wr(brg-90);
    return {x,y,z,hft,glide,loc,gs,inCone,brg,to,vd}; };
  const S=orbit(u.c,{yaw:-62,pit:16,ar:.6,hmin:300,hmax:480,pmin:2,pmax:89,draw});
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp;
    let mv=false; if(ap){ st.d=Math.max(.5,st.d-dt*.09); st.l*=Math.exp(-dt*.35); st.h*=Math.exp(-dt*.45); syncI(); out(); mv=st.d>.5; if(!mv){ ap=false; press(u,"data-ap","x"); } }
    const g=geo(), span=st.d*KM+4.2, near=view==="be";
    const T=near?[g.x+span*.2,g.y*EX*.85,g.z*.7]:[(g.x+LOCX)/2,.8,0], k=Math.min(W,H*1.7)/(span*1.05)*(near?2.4:1), few=near||W/d<600;
    S.cam(k,W*.5,H*(near?.5:.56),T,span*6); const P=S.P;
    x.setTransform(1,0,0,1,0,0); x.globalAlpha=1; const sk=x.createLinearGradient(0,0,0,H); sk.addColorStop(0,"#5d8fc4"); sk.addColorStop(.55,"#a9c6e0"); sk.addColorStop(1,"#d7e3ea"); x.fillStyle=sk; x.fillRect(0,0,W,H);
    const fillP=(pts,col)=>{ const q=pts.map(P); x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fillStyle=col; x.fill(); };
    const ln=(pts,col,w,dash)=>{ const q=pts.map(P); x.strokeStyle=col; x.lineWidth=(w||1)*d; x.setLineDash(dash?dash.map(v=>v*d):[]); x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke(); x.setLineDash([]); };
    const lb=(p,t,c,bg,must)=>{ if(few&&!must) return; const q=P(p); tag(x,q[0],q[1],t,{dp:d,fs:11,al:"c",c:c||"#fff",bg:bg||"rgba(10,20,32,.72)"}); };
    // terreno
    const G0=g.x-span*.35, G1=LOCX+2.5, GZ=span*.55; fillP([[G0,0,-GZ],[G1,0,-GZ],[G1,0,GZ],[G0,0,GZ]],"#7d9a5b");
    x.globalAlpha=.22; for(let i=-6;i<=6;i++) ln([[G0,0,i*GZ/6],[G1,0,i*GZ/6]],"#4d6b35",1); for(let m=Math.ceil(G0/2)*2;m<G1;m+=2) ln([[m,0,-GZ],[m,0,GZ]],"#4d6b35",1); x.globalAlpha=1;
    // pista 09: 3 km × 45 m (ancho exagerado), eje y umbral
    fillP([[0,0,-.04],[3,0,-.04],[3,0,.04],[0,0,.04]],"#3c4046"); ln([[.08,0,0],[2.92,0,0]],"#f4f4f0",1,[4,4]); for(let i=-3;i<=3;i++) ln([[.01,0,i*.011],[.07,0,i*.011]],"#f4f4f0",1.2);
    lb([.05,0,.09],"09","#fff","rgba(0,0,0,.4)");
    // lóbulos
    if(lobes){ const fan=(a0,a1,col)=>{ const pts=[[LOCX,.005,0]]; for(let a=a0;a<=a1+1e-6;a+=(a1-a0)/16){ pts.push([LOCX-span*.98*Math.cos(a*R),.005,span*.98*Math.sin(a*R)]); } fillP(pts,col); };
      fan(-14,0,"rgba(255,170,40,.30)"); fan(0,14,"rgba(60,140,255,.30)"); fan(-2.5,2.5,"rgba(255,255,255,.16)");
      ln([[LOCX,.01,0],[LOCX-span*.98,.01,0]],"rgba(255,255,255,.9)",1.4,[6,4]);
      lb([LOCX-span*.55,.01,-span*.55*Math.tan(8*R)],"LOC 90 Hz","#ffd08a"); lb([LOCX-span*.55,.01,span*.55*Math.tan(8*R)],"LOC 150 Hz","#a9cbff");
      const gl=span*.95, gp=a=>[GSX-gl,Math.tan(a*R)*gl*EX,0], gm=(a,t)=>[GSX-gl*t,Math.tan(a*R)*gl*t*EX,0];
      fillP([[GSX,0,0],gp(3),gp(5)],"rgba(255,170,40,.20)"); fillP([[GSX,0,0],gp(1),gp(3)],"rgba(60,140,255,.20)");
      ln([[GSX,0,0],gp(3)],"#ffffff",1.6); lb(gm(4.2,.82),"GS 90 Hz","#ffd08a"); lb(gm(1.8,.82),"GS 150 Hz","#a9cbff"); lb(gm(3,.4),"Senda 3°","#fff",null,1);
      ln([[LOCX,0,0],[LOCX,.12*EX,0]],"#ffe08a",3); lb([LOCX,.18*EX,0],"Localizador","#ffe08a"); ln([[GSX,0,GSZ],[GSX,.06*EX,GSZ]],"#ffe08a",3); }
    // VOR y cono de confusión
    if(vor){ const hc=1.25, rc=hc*Math.tan(CONE*R); for(let i=0;i<24;i++){ const a=i/24*2*Math.PI, b=(i+1)/24*2*Math.PI; fillP([[VORX,0,0],[VORX+rc*Math.cos(a),hc*EX,rc*Math.sin(a)],[VORX+rc*Math.cos(b),hc*EX,rc*Math.sin(b)]],g.inCone?"rgba(230,120,255,.16)":"rgba(230,120,255,.08)"); }
      const ring=[]; for(let i=0;i<=40;i++){ const a=i/40*2*Math.PI; ring.push([VORX+rc*Math.cos(a),hc*EX,rc*Math.sin(a)]); } ln(ring,"rgba(230,120,255,.7)",1.2);
      fillP([[VORX-.12,0,-.12],[VORX+.12,0,-.12],[VORX+.12,0,.12],[VORX-.12,0,.12]],"#e7e2d6"); lb([VORX,.02,0],"VOR","#f2c8ff",null,1); lb([VORX,hc*EX+.2,0],"cono de confusión","#f2c8ff"); }
    // avión, sombra y línea vertical
    const A=[g.x,g.y*EX,g.z]; ln([A,[g.x,0,g.z]],"rgba(20,30,40,.45)",1,[3,3]);
    const pr=-3*R, cp=Math.cos(pr), sp=Math.sin(pr), tr=p=>[A[0]+p[0]*cp-p[1]*sp,A[1]+p[0]*sp+p[1]*cp,A[2]+p[2]];
    x.globalAlpha=.25; for(const f of AC) fillP(f.p.map(p=>[g.x+p[0],0,g.z+p[2]]),"#1e2a1a"); x.globalAlpha=1;
    const FS=AC.map(f=>{ const w=f.p.map(tr), q=w.map(P); return {q,z:q.reduce((s,p)=>s+p[2],0)/q.length,c:f.c,w}; }).sort((a,b)=>a.z-b.z);
    for(const f of FS){ const n=vnorm(vcross(vsub(f.w[1],f.w[0]),vsub(f.w[2],f.w[0]))), sh=.55+.45*Math.abs(vdot(n,vnorm([-.3,.8,.5]))); x.beginPath(); f.q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fillStyle=`rgb(${f.c.map(v=>v*sh|0)})`; x.fill(); }
    // instrumentos: ILS (LOC + GS) y VOR
    const r=cl(Math.min(W,H)*(W/d<600?.11:.13),30*d,64*d), cy=H-r-8*d; inst(W-r-10*d,cy,r,"ILS",-g.loc/1.25,g.gs/.35,null); if(vor){ if(g.inCone) jit+=dt*9; inst(W-3*r-20*d,cy,r,"VOR 090",g.inCone?Math.sin(jit*1.7)*2.2:(g.to?g.vd:-g.vd)/5,null,g.inCone?(Math.sin(jit)>0?"TO":"OFF"):(g.to?"TO":"FROM")); }
    return mv||g.inCone&&vor;
    function inst(cx,cy,r,tt,dx,dy,flag){ x.fillStyle="#0d1724"; x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); x.strokeStyle="#5d6f84"; x.lineWidth=2*d; x.stroke();
      const s=r*.32; x.fillStyle="#cfd8e3"; for(let i=-2;i<=2;i++){ if(!i) continue; x.beginPath(); x.arc(cx+i*s,cy,2*d,0,7); x.fill(); if(dy!=null){ x.beginPath(); x.arc(cx,cy+i*s,2*d,0,7); x.fill(); } }
      x.strokeStyle="#cfd8e3"; x.lineWidth=d; x.beginPath(); x.arc(cx,cy,3.5*d,0,7); x.stroke();
      const nx=cl(dx,-2.3,2.3)*s; x.strokeStyle="#ffd24d"; x.lineWidth=3*d; x.beginPath(); x.moveTo(cx+nx,cy-r*.78); x.lineTo(cx+nx,cy+r*.78); x.stroke();
      if(dy!=null){ const ny=cl(dy,-2.3,2.3)*s; x.strokeStyle="#6ee7a0"; x.beginPath(); x.moveTo(cx-r*.78,cy+ny); x.lineTo(cx+r*.78,cy+ny); x.stroke(); }
      x.font=`700 ${10*d}px system-ui,sans-serif`; x.fillStyle="#8fa3b8"; x.textAlign="center"; x.textBaseline="middle"; x.fillText(tt,cx,cy-r*.84); if(flag){ x.fillStyle=flag==="OFF"?"#ff8a80":"#fff"; x.fillText(flag,cx+r*.5,cy+r*.5); } x.textAlign="left"; }
  }
  function out(){ if(mode==="quiz") return; const g=geo(), a=Math.abs(g.loc), b=Math.abs(g.gs);
    const L=a<.05?"sobre el eje (DDM 0)":`${f1(a)}° a la <b>${g.loc>0?"derecha":"izquierda"}</b>: predomina <b>${g.loc>0?"150":"90"} Hz</b> → aguja a la <b>${g.loc>0?"izquierda":"derecha"}</b>, corriges a la ${g.loc>0?"izquierda":"derecha"}${a>2.5?" (fondo de escala)":""}`;
    const Gs=b<.03?"en la senda":`${f1(b)}° por <b>${g.gs>0?"encima":"debajo"}</b>: predomina <b>${g.gs>0?"90":"150"} Hz</b> → aguja <b>${g.gs>0?"abajo":"arriba"}</b>${b>.7?" (fondo de escala)":""}`;
    u.out.innerHTML=`A <b>${f1(st.d)} NM</b> del umbral, <b>${f0(g.hft)} ft</b> (la senda pide ${f0(g.glide)} ft). <b>LOC:</b> ${L}. <b>GS:</b> ${Gs}.${vor?` <b>VOR:</b> ${g.inCone?"<b class=\"bad\">dentro del cono de confusión</b>: aguja y bandera no fiables":`radial ${d3(g.brg)}, bandera <b>${g.to?"TO":"FROM"}</b>`}.`:""}`; }
  const VW={be:[-90,10],si:[0,8],to:[-90,89],"34":[-62,16]};
  u.qa("[data-v]").forEach(b=>b.addEventListener("click",()=>{ view=b.dataset.v; const v=VW[view]; S.go(v[0],v[1]); press(u,"data-v",view); }));
  u.q("[data-lb]").addEventListener("change",e=>{ lobes=e.target.checked; S.kick(); }); u.q("[data-vo]").addEventListener("change",e=>{ vor=e.target.checked; out(); S.kick(); });
  u.q("[data-ap]").addEventListener("click",e=>{ ap=!ap; e.currentTarget.setAttribute("aria-pressed",ap); S.kick(); });
  const Q=quiz(u,QZ,c=>{ const s=c.s; st.d=s.d; st.l=s.l; st.h=s.h; if(s.ov){ st.d=6; } ap=false; syncI(); S.kick(); });
  u.qa("[data-m]").forEach(b=>b.addEventListener("click",()=>{ mode=b.dataset.m; press(u,"data-m",mode); if(mode==="quiz") Q.start(); else { Q.stop(); out(); } }));
  syncI(); out(); S.kick();
}};
})();

/* =====================================================================
   3 · METEOROLOGÍA 3D (050): frentes, cumulonimbo en sus tres fases y ley de Buys Ballot
   Maqueta: x Oeste→Este, y altura (exagerada), z Norte(−)/Sur(+). Unidades arbitrarias.
   ===================================================================== */
V.wx3d=(()=>{
let sd=11; const rnd=()=>{ sd=(sd*1664525+1013904223)>>>0; return sd/4294967296; };
const cloud=(cx,cz,w,h,top,n,col)=>{ const o=[]; for(let i=0;i<n;i++){ const t=rnd(), y=lerp(.05,1,Math.pow(t,.8)), sp=w*(1-.45*y); o.push({p:[cx+(rnd()-.5)*sp,lerp(top.b,top.t,y),cz+(rnd()-.5)*sp*.8],r:lerp(h*1.1,h*.75,y)*(.75+.5*rnd()),c:col}); } return o; };
const layer=(x0,x1,y0,y1,z0,z1,r,n,col)=>Array.from({length:n},()=>{ const t=rnd(); return {p:[lerp(x0,x1,t),lerp(y0,y1,t)+(rnd()-.5)*r*.4,lerp(z0,z1,rnd())],r:r*(.7+.6*rnd()),c:col}; });
const QZ=[
 {q:"¿En qué fase de la tormenta solo hay <b>corrientes ascendentes</b>?",o:["Cúmulo (desarrollo)","Madurez","Disipación"],a:0,e:"En la fase de <b>cúmulo</b> todo sube. La madurez empieza cuando la precipitación arrastra aire hacia abajo y llega al suelo.",s:{t:"cb",g:0}},
 {q:"¿Qué fase tiene a la vez ascendentes y descendentes, rayos, granizo y la precipitación más fuerte?",o:["Madurez","Cúmulo","Disipación"],a:0,e:"La <b>madurez</b> es la fase más peligrosa (unos 20–30 min): ascendentes y descendentes juntas, frente de racha, cizalladura, granizo y engelamiento.",s:{t:"cb",g:1}},
 {q:"¿Qué domina en la fase de <b>disipación</b>?",o:["Las descendentes","Las ascendentes","No hay movimiento vertical"],a:0,e:"Las descendentes ocupan toda la célula, cortan el aporte de aire húmedo y la nube se deshace dejando el yunque.",s:{t:"cb",g:2}},
 {q:"¿Dónde es más probable el <b>engelamiento severo</b> dentro de un CB?",o:["Entre 0 °C y −20 °C, con agua subfundida","Por debajo del nivel de congelación","Solo en el yunque"],a:0,e:"Entre <b>0 y −20 °C</b> abundan las gotas subfundidas grandes que suben con la ascendente: hielo claro (clear ice) rápido.",s:{t:"cb",g:1}},
 {q:"Hemisferio <b>Norte</b>, de espaldas al viento: ¿dónde están las bajas presiones?",o:["A la izquierda","A la derecha","Delante"],a:0,e:"Ley de <b>Buys Ballot</b>: en el hemisferio Norte, de espaldas al viento, las bajas a la <b>izquierda</b>. En el Sur, a la derecha.",s:{t:"bb",hs:"N"}},
 {q:"Hemisferio <b>Sur</b>, de espaldas al viento: ¿dónde están las bajas?",o:["A la derecha","A la izquierda","Detrás"],a:0,e:"En el hemisferio Sur la fuerza de Coriolis desvía a la izquierda: el viento gira en sentido horario alrededor de la baja y, de espaldas al viento, la baja queda a la <b>derecha</b>.",s:{t:"bb",hs:"S"}},
 {q:"Hemisferio Norte: el viento en superficie, comparado con el de 2.000 ft…",o:["Está rolado a la izquierda (backed) y es más flojo","Está rolado a la derecha (veered) y es más fuerte","Es igual"],a:0,e:"El rozamiento frena el viento, Coriolis lo desvía menos y cruza las isobaras hacia la baja: en superficie está <b>backed</b> y es más flojo. Subiendo, <b>vira (veers)</b>.",s:{t:"bb",hs:"N"}},
 {q:"¿Qué frente tiene la pendiente más <b>pronunciada</b>?",o:["El frío","El cálido","Igual"],a:0,e:"Frente <b>frío</b>: pendiente de 1:50 a 1:100 y tiempo violento en una franja estrecha (CB, chubascos). Frente <b>cálido</b>: ≈ 1:150, nubes estratiformes en cientos de km por delante.",s:{t:"fr",f:"c"}},
 {q:"Te acercas a un frente <b>cálido</b>. ¿En qué orden ves las nubes?",o:["Ci → Cs → As → Ns","Ns → As → Cs → Ci","CB → Cu → Ns"],a:0,e:"Primero los cirros, muy por delante, y la capa baja y gruesa al final: <b>Ci, Cs, As, Ns</b>, con lluvia continua y visibilidad cada vez peor.",s:{t:"fr",f:"w"}},
 {q:"Paso de un frente <b>frío</b> en el hemisferio Norte: ¿qué hace el viento?",o:["Vira (veers) y suele racheado","Rola a la izquierda (backs)","No cambia"],a:0,e:"Con el paso de cualquier frente el viento <b>vira</b> en el hemisferio Norte. Tras el frío baja la temperatura y la presión sube.",s:{t:"fr",f:"c"}}];
return {t:"3D · Meteorología: frentes, tormenta (CB) y ley de Buys Ballot",
cap:"Maqueta esquemática con la vertical muy exagerada. Pendientes típicas: frente frío 1:50–1:100, cálido ≈ 1:150. Una célula de tormenta dura alrededor de una hora: cúmulo, madurez (20–30 min) y disipación. En superficie el viento cruza las isobaras hacia la baja unos 30° sobre tierra y unos 10° sobre el mar.",
init(el){
  const t0=el.dataset.tab||"fr";
  const ctl=row("Tema",bt("data-t","fr","Frentes",t0==="fr")+bt("data-t","cb","Tormenta (CB)",t0==="cb")+bt("data-t","bb","Buys Ballot",t0==="bb")+bt("data-t","quiz","Ponme a prueba"))
   +row("Frente",bt("data-f","c","Frente frío",1)+bt("data-f","w","Frente cálido"),"data-pfr")
   +row("Fase",bt("data-g","0","1 · Cúmulo")+bt("data-g","1","2 · Madurez",1)+bt("data-g","2","3 · Disipación"),"data-pcb")
   +row("Hemisferio",bt("data-h","N","Norte",1)+bt("data-h","S","Sur")+`<span class="v3l">Viento</span>`+bt("data-z","0","En superficie",1)+bt("data-z","1","A 2.000 ft"),"data-pbb")
   +`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Maqueta meteorológica en 3D: arrástrala para girarla",ctl,this.cap);
  let tab=t0, fr="c", stg=1, hs="N", hz=0, mode="x", flash=0;
  /* nubes precalculadas */
  sd=11; const CB=[ [...cloud(0,0,.55,.13,{b:.12,t:.38},26,[235,238,242])],
    [...cloud(0,0,.62,.13,{b:.12,t:.86},60,[226,230,236]),...layer(-.28,.62,.86,.9,-.32,.32,.12,26,[236,238,242])],
    [...cloud(-.05,0,.6,.11,{b:.2,t:.6},26,[200,206,214]),...layer(-.4,.75,.84,.9,-.4,.4,.13,30,[226,229,234])] ];
  sd=5; const FRC=[...cloud(.05,-.25,.28,.1,{b:.1,t:.72},26,[226,230,236]),...cloud(.08,.1,.28,.1,{b:.1,t:.66},22,[226,230,236]),...cloud(.02,.4,.22,.09,{b:.1,t:.55},14,[226,230,236]),...cloud(-.55,.1,.12,.05,{b:.1,t:.2},6,[240,242,246]),...cloud(-.75,-.25,.1,.05,{b:.1,t:.18},5,[240,242,246])];
  sd=9; const FRW=[...layer(-.1,.25,.05,.17,-.45,.45,.09,36,[150,158,170]),...layer(.25,.55,.2,.32,-.45,.45,.08,26,[196,202,212]),...layer(.55,.8,.38,.45,-.45,.45,.06,20,[226,230,238]),...layer(.8,1.02,.52,.58,-.45,.45,.05,16,[246,248,252])];
  const S=orbit(u.c,{yaw:-28,pit:22,ar:.6,hmin:300,hmax:480,pmin:-5,pmax:89,draw});
  const parts=Array.from({length:70},(_,i)=>({u:rnd(),v:rnd(),w:rnd(),k:i%3}));
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp, k=Math.min(W*.42,H*.62), P=(S.cam(k,W*.5,H*.62,[0,.32,0],7),S.P);
    x.setTransform(1,0,0,1,0,0); x.globalAlpha=1; const sk=x.createLinearGradient(0,0,0,H); sk.addColorStop(0,"#2c4f7c"); sk.addColorStop(1,"#9fbad3"); x.fillStyle=sk; x.fillRect(0,0,W,H);
    const fillP=(pts,col)=>{ const q=pts.map(P); x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fillStyle=col; x.fill(); };
    const ln=(pts,col,w,dash)=>{ const q=pts.map(P); x.strokeStyle=col; x.lineWidth=(w||1)*d; x.setLineDash(dash?dash.map(v=>v*d):[]); x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke(); x.setLineDash([]); };
    const arr=(a,b,col,w)=>{ const p=P(a), q=P(b), an=Math.atan2(q[1]-p[1],q[0]-p[0]), L=7*d+(w||2)*d; x.strokeStyle=col; x.fillStyle=col; x.lineWidth=(w||2)*d; x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke(); x.beginPath(); x.moveTo(q[0],q[1]); x.lineTo(q[0]-L*Math.cos(an-.45),q[1]-L*Math.sin(an-.45)); x.lineTo(q[0]-L*Math.cos(an+.45),q[1]-L*Math.sin(an+.45)); x.closePath(); x.fill(); };
    const lb=(p,tt,c,al)=>{ const q=P(p); tag(x,q[0],q[1],tt,{dp:d,fs:11,al:al||"c",c:c||"#fff"}); };
    const puffs=L=>{ const q=L.map(o=>{ const s=P(o.p); return {s,o}; }).sort((a,b)=>a.s[2]-b.s[2]); for(const {s,o} of q){ const r=o.r*k, g=x.createRadialGradient(s[0]-r*.3,s[1]-r*.35,r*.1,s[0],s[1],r), f=.62+.38*cl(o.p[1]/.45,0,1), c=o.c.map(v=>v*f); g.addColorStop(0,`rgba(${Math.min(255,c[0]+22)},${Math.min(255,c[1]+22)},${Math.min(255,c[2]+22)},.97)`); g.addColorStop(.7,`rgba(${c[0]},${c[1]},${c[2]},.92)`); g.addColorStop(1,`rgba(${c[0]*.78|0},${c[1]*.8|0},${c[2]*.86|0},0)`); x.fillStyle=g; x.beginPath(); x.arc(s[0],s[1],r,0,7); x.fill(); } };
    // suelo de la maqueta
    const B=[-1.05,1.05,-.55,.55]; fillP([[B[0],0,B[3]],[B[1],0,B[3]],[B[1],-.06,B[3]],[B[0],-.06,B[3]]],"#3e5230"); fillP([[B[1],0,B[2]],[B[1],0,B[3]],[B[1],-.06,B[3]],[B[1],-.06,B[2]]],"#33452a");
    fillP([[B[0],0,B[2]],[B[1],0,B[2]],[B[1],0,B[3]],[B[0],0,B[3]]],tab==="bb"?"#6f8d52":"#7a965a");
    let mv=false; const tb=mode==="quiz"&&qc?qc.s.t:tab;
    if(tb==="fr"){ const cold=(mode==="quiz"&&qc?qc.s.f:fr)==="c";
      if(cold){ const fx=.12, top=.62, back=-.12; fillP([[B[0],0,B[2]],[fx,0,B[2]],[back,top,B[2]],[B[0],top,B[2]]],"rgba(70,140,255,.30)"); fillP([[B[0],0,B[3]],[fx,0,B[3]],[back,top,B[3]],[B[0],top,B[3]]],"rgba(70,140,255,.36)"); fillP([[fx,0,B[2]],[fx,0,B[3]],[back,top,B[3]],[back,top,B[2]]],"rgba(70,140,255,.30)");
        fillP([[fx,0,B[3]],[B[1],0,B[3]],[B[1],top,B[3]],[back,top,B[3]]],"rgba(255,120,80,.16)");
        for(let zz=B[2]+.05;zz<B[3];zz+=.13){ fillP([[fx-.02,.003,zz],[fx+.05,.003,zz+.04],[fx-.02,.003,zz+.08]],"#2f6fff"); } ln([[fx,.003,B[2]],[fx,.003,B[3]]],"#2f6fff",3);
        puffs(FRC); for(let i=0;i<26;i++){ const z=-.4+i*.032, xx=.02+(i%5)*.03; ln([[xx,.1,z],[xx-.02,0,z]],"rgba(120,160,230,.75)",1.2); }
        arr([-.8,.05,.45],[-.35,.05,.45],"#7fb2ff",3); arr([.45,.08,.45],[.18,.45,.45],"#ff9c7a",2.5); lb([-.65,.28,.45],"Aire frío · Cold air","#cfe2ff"); lb([.65,.35,.45],"Aire cálido · Warm air","#ffd2c2"); lb([.05,.8,.1],"CB · cumulonimbos","#fff"); lb([fx,.0,.62],"Frente frío · Cold front","#9fc0ff"); }
      else{ const fx=-.25, top=.5; fillP([[fx,0,B[2]],[B[1],0,B[2]],[B[1],top,B[2]]],"rgba(70,140,255,.30)"); fillP([[fx,0,B[3]],[B[1],0,B[3]],[B[1],top,B[3]]],"rgba(70,140,255,.36)"); fillP([[fx,0,B[2]],[fx,0,B[3]],[B[1],top,B[3]],[B[1],top,B[2]]],"rgba(70,140,255,.24)");
        fillP([[B[0],0,B[3]],[fx,0,B[3]],[B[1],top,B[3]],[B[1],.66,B[3]],[B[0],.66,B[3]]],"rgba(255,120,80,.16)");
        for(let zz=B[2]+.05;zz<B[3];zz+=.13){ const c=P([fx,.003,zz+.04]); x.fillStyle="#ff3d3d"; x.beginPath(); x.arc(c[0],c[1],5*d,Math.PI,0); x.fill(); } ln([[fx,.003,B[2]],[fx,.003,B[3]]],"#ff3d3d",3);
        puffs(FRW); for(let i=0;i<30;i++){ const z=-.42+i*.029, xx=-.15+(i%6)*.06; ln([[xx,.06,z],[xx,0,z]],"rgba(120,150,200,.7)",1); }
        arr([-.8,.08,.45],[-.3,.12,.45],"#ff9c7a",3); arr([.0,.1,.45],[.6,.38,.45],"#ff9c7a",2.5); arr([.85,.05,.45],[.55,.05,.45],"#7fb2ff",2.5); lb([.7,.12,.45],"Aire frío · Cold air","#cfe2ff"); lb([-.6,.4,.45],"Aire cálido · Warm air","#ffd2c2");
        lb([-.02,.24,-.5],"Ns",null); lb([.4,.37,-.5],"As"); lb([.68,.5,-.5],"Cs"); lb([.92,.64,-.5],"Ci"); lb([fx,0,.62],"Frente cálido · Warm front","#ffb0a0"); } }
    if(tb==="cb"){ const g=mode==="quiz"&&qc?qc.s.g:stg, top=g===1?.86:g===2?.88:.4;
      // niveles de temperatura
      const lvl=(y,col,tt)=>{ fillP([[B[0],y,B[2]],[B[1],y,B[2]],[B[1],y,B[3]],[B[0],y,B[3]]],col); lb([B[1]-.1,y,B[3]],tt,"#fff","r"); };
      fillP([[-.5,.3,B[2]],[.5,.3,B[2]],[.5,.3,B[3]],[-.5,.3,B[3]]],"rgba(120,200,255,.07)"); lvl(.3,"rgba(150,210,255,.10)","0 °C"); lvl(.55,"rgba(150,210,255,.10)","−20 °C"); if(g) lvl(.9,"rgba(255,255,255,.05)","tropopausa");
      puffs(CB[g]);
      // corrientes animadas
      mv=true; for(const q of parts){ q.v=(q.v+dt*(.25+.25*q.w))%1; const up=g===0||(g===1&&q.k!==0), xs=g===1?(up?-.1:.18):g===2?.05:0, xx=xs+(q.u-.5)*(g===1?.22:.34), zz=(q.w-.5)*.5, yy=up?lerp(.02,top-.05,q.v):lerp(top-.15,0,q.v);
        if(g===2&&up) continue; const p=P([xx,yy,zz]); x.fillStyle=up?"rgba(255,140,90,.9)":"rgba(110,170,255,.9)"; x.beginPath(); x.arc(p[0],p[1],2.1*d,0,7); x.fill(); const p2=P([xx,yy+(up?-.035:.035),zz]); x.strokeStyle=x.fillStyle; x.lineWidth=1.2*d; x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(p2[0],p2[1]); x.stroke(); }
      if(g===1){ for(const s of [-1,1]) arr([.18,.03,0],[.18+s*.55,.03,0],"#9fc0ff",3); lb([.62,.05,.05],"frente de racha · gust front","#cfe2ff"); lb([-.6,.12,.3],"cizalladura · windshear","#ffd08a");
        for(let i=0;i<24;i++){ const xx=.08+(i%6)*.04, z=-.2+Math.floor(i/6)*.12; ln([[xx,.12,z],[xx-.01,0,z]],"rgba(140,180,240,.8)",1.2); }
        flash-=dt; if(flash<0&&Math.random()<.012) flash=.12; if(flash>0){ const a=P([.0,.6,0]), b=P([.1,.02,.05]); x.strokeStyle="rgba(255,255,220,.95)"; x.lineWidth=2.2*d; x.beginPath(); x.moveTo(a[0],a[1]); x.lineTo(lerp(a[0],b[0],.35)+8*d,lerp(a[1],b[1],.35)); x.lineTo(lerp(a[0],b[0],.6)-6*d,lerp(a[1],b[1],.6)); x.lineTo(b[0],b[1]); x.stroke(); } }
      if(g===2) for(let i=0;i<14;i++){ const xx=-.1+(i%5)*.06, z=-.2+Math.floor(i/5)*.15; ln([[xx,.18,z],[xx,0,z]],"rgba(140,180,240,.55)",1); }
      lb([.45,.42,.4],"engelamiento: 0 a −20 °C","#bfe6ff"); lb([-.55,top*.6,-.3],["solo ascendentes","ascendentes + descendentes","solo descendentes"][g],g===2?"#a9cbff":"#ffb08a"); }
    if(tb==="bb"){ const h=(mode==="quiz"&&qc?qc.s.hs:hs)==="N"?1:-1, L=[-.42,.0], Hh=[.55,.05], ang=hz?0:30;
      for(let i=1;i<=5;i++){ const pts=[], pts2=[]; for(let a=0;a<=64;a++){ const th=a/64*2*Math.PI; pts.push([L[0]+i*.1*Math.cos(th),.004,L[1]+i*.075*Math.sin(th)]); if(i<=3) pts2.push([Hh[0]+i*.11*Math.cos(th),.004,Hh[1]+i*.08*Math.sin(th)]); } ln(pts,"rgba(255,255,255,.75)",1.3); if(i<=3) ln(pts2,"rgba(255,255,255,.75)",1.3);
        lb([L[0],.004,L[1]-i*.075],String(1012-4*(6-i)),"#e9f0f7"); }
      const Lp=P([L[0],.01,L[1]]), Hp=P([Hh[0],.01,Hh[1]]); x.font=`800 ${20*d}px system-ui,sans-serif`; x.textAlign="center"; x.textBaseline="middle"; x.fillStyle="#ff6b6b"; x.fillText("B",Lp[0],Lp[1]); x.fillStyle="#6ba8ff"; x.fillText("A",Hp[0],Hp[1]); x.textAlign="left"; lb([L[0],.01,L[1]+.06],"Baja · Low","#ffb0b0"); lb([Hh[0],.01,Hh[1]+.06],"Alta · High","#b0d0ff");
      const wind=(px,pz,c,sgn)=>{ const rx=px-c[0], rz=(pz-c[1])*1.33, n=Math.hypot(rx,rz)||1; const tx=rz/n*h*sgn, tz=-rx/n*h*sgn, ix=-rx/n*sgn, iz=-rz/n*sgn, ca=Math.cos(ang*R), sa=Math.sin(ang*R); return [tx*ca+ix*sa,tz*ca+iz*sa]; };
      for(let gx=-.95;gx<=.98;gx+=.19) for(let gz=-.45;gz<=.46;gz+=.15){ const dL=Math.hypot(gx-L[0],(gz-L[1])*1.33), dH=Math.hypot(gx-Hh[0],(gz-Hh[1])*1.33); if(dL<.07||dH<.07) continue; const v=dL<dH*1.1?wind(gx,gz,L,1):wind(gx,gz,Hh,-1), s=hz?.085:.06;
        arr([gx-v[0]*s/2,.01,gz-v[1]*s/2],[gx+v[0]*s/2,.01,gz+v[1]*s/2],hz?"#ffd24d":"#9fe0ff",hz?2.2:1.8); }
      // observador de espaldas al viento, al sur de la baja
      const ox=L[0], oz=L[1]+.36, v=wind(ox,oz,L,1), fpos=[ox,0,oz]; ln([fpos,[ox,.12,oz]],"#ffffff",3); const hd=P([ox,.14,oz]); x.fillStyle="#ffd24d"; x.beginPath(); x.arc(hd[0],hd[1],5*d,0,7); x.fill();
      arr([ox+v[0]*.12,.05,oz+v[1]*.12],[ox,.05,oz],"#9fe0ff",3); { const dx=L[0]-ox, dz=L[1]-oz, n=Math.hypot(dx,dz); arr([ox,.13,oz],[ox+dx/n*.2,.13,oz+dz/n*.2],"#ff6b6b",2.5); }   // el viento le da en la espalda; flecha roja: hacia la baja
      lb([ox,.2,oz],h>0?"de espaldas al viento: baja a la IZQUIERDA":"de espaldas al viento: baja a la DERECHA","#ffd24d");
      lb([.75,.01,-.45],hz?"2.000 ft: paralelo a las isobaras":"superficie: cruza ≈ 30° hacia la baja",hz?"#ffd24d":"#9fe0ff"); }
    return mv;
  }
  let qc=null;
  const say=()=>{ if(mode==="quiz") return;
    u.out.innerHTML=tab==="fr"?(fr==="c"?"<b>Frente frío</b>: el aire frío entra como una cuña y levanta de golpe el aire cálido. Pendiente 1:50–1:100, franja estrecha de <b>CB</b>, chubascos, rachas y posible granizo. Al pasar: el viento <b>vira</b> (HN), la temperatura baja, la presión sube y mejora la visibilidad.":"<b>Frente cálido</b>: el aire cálido sube despacio por encima del frío. Pendiente ≈ 1:150: nubes estratiformes hasta cientos de km por delante, en orden <b>Ci → Cs → As → Ns</b>, lluvia continua y techos y visibilidad cada vez peores. Al pasar: el viento <b>vira</b> (HN) y la temperatura sube.")
     :tab==="cb"?["<b>1 · Cúmulo</b>: solo ascendentes, la nube crece deprisa. Aún no hay precipitación en el suelo.","<b>2 · Madurez</b> (20–30 min): ascendentes y descendentes juntas, rayos, granizo, <b>frente de racha</b> y cizalladura en superficie. Es la fase más peligrosa; evítala por 10–20 NM.","<b>3 · Disipación</b>: las descendentes ocupan toda la célula, se corta el aire húmedo y la nube se deshace; queda el yunque."][stg]
     :`<b>Buys Ballot</b>: en el hemisferio <b>${hs==="N"?"Norte":"Sur"}</b>, de espaldas al viento, la baja queda a la <b>${hs==="N"?"izquierda":"derecha"}</b>. Alrededor de la baja el viento gira en sentido <b>${hs==="N"?"antihorario":"horario"}</b>. ${hz?"A 2.000 ft (sin rozamiento) sopla paralelo a las isobaras y más fuerte.":`En superficie el rozamiento lo frena y cruza las isobaras hacia la baja: está <b>${hs==="N"?"backed":"veered"}</b> respecto al de 2.000 ft.`}`; };
  const setTab=t=>{ if(t==="quiz"){ mode="quiz"; press(u,"data-t","quiz"); u.q("[data-pfr]").hidden=u.q("[data-pcb]").hidden=u.q("[data-pbb]").hidden=true; Q.start(); S.kick(); return; }
    mode="x"; qc=null; Q.stop(); tab=t; press(u,"data-t",t); u.q("[data-pfr]").hidden=t!=="fr"; u.q("[data-pcb]").hidden=t!=="cb"; u.q("[data-pbb]").hidden=t!=="bb"; if(t==="bb") S.go(-12,58); else S.go(-28,22); say(); S.kick(); };
  const Q=quiz(u,QZ,c=>{ qc=c; if(c.s.t==="bb") S.go(-12,58); else S.go(-28,22); S.kick(); });
  u.qa("[data-t]").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.t)));
  u.qa("[data-f]").forEach(b=>b.addEventListener("click",()=>{ fr=b.dataset.f; press(u,"data-f",fr); say(); S.kick(); }));
  u.qa("[data-g]").forEach(b=>b.addEventListener("click",()=>{ stg=+b.dataset.g; press(u,"data-g",stg); say(); S.kick(); }));
  u.qa("[data-h]").forEach(b=>b.addEventListener("click",()=>{ hs=b.dataset.h; press(u,"data-h",hs); say(); S.kick(); }));
  u.qa("[data-z]").forEach(b=>b.addEventListener("click",()=>{ hz=+b.dataset.z; press(u,"data-z",hz); say(); S.kick(); }));
  setTab(t0);
}};
})();

/* =====================================================================
   4 · DERECHO DE PASO (010, SERA.3210): lo que ves desde la cabina, de día o de noche, y qué maniobra manda
   Usa el avión y el planeador 3D de la cabecera (real.js).
   ===================================================================== */
V.row3d=(()=>{
const OP=["Mantengo rumbo y velocidad: tengo preferencia","Cedo el paso: me aparto (normalmente a la derecha) y no le cruzo por delante","Los dos alteramos el rumbo a la derecha","Lo alcanzo yo: me aparto a la derecha y lo adelanto por su derecha"];
const E={front:"<b>De frente</b> (ves roja y verde a la vez): <b>los dos</b> alteráis el rumbo a la <b>derecha</b> (SERA.3210).",
 right:"<b>Convergente por tu derecha</b>: ves su luz <b>roja</b> (te enseña su costado izquierdo). Cede quien tiene al otro a su derecha: <b>cedes tú</b>. Truco: «si ves rojo, frenas (cedes)», como en un semáforo.",
 left:"<b>Convergente por tu izquierda</b>: ves su luz <b>verde</b>. Él te tiene a su derecha, así que cede él: tú <b>mantienes rumbo y velocidad</b>, pero sin dejar de vigilarlo por si no te ha visto.",
 over:"Ves solo su luz <b>blanca de cola</b> (dentro de sus 140° traseros): <b>lo estás alcanzando</b>. El que alcanza cede: se aparta virando a la <b>derecha</b>, también si asciende o desciende.",
 gl:"Aunque venga por tu izquierda, un <b>avión de motor cede el paso a planeadores</b>, globos y dirigibles (y a quien remolca). Manda la categoría antes que el lado.",
 ba:"Un <b>globo</b> casi no puede maniobrar: todos le ceden el paso. El avión de motor cede a dirigibles, planeadores y globos."};
/* br = marcación relativa en la que lo ves (− izquierda); az = desde qué lado de su morro le miras (+ su derecha) */
const SC=[{k:"front",br:2,az:0,m:"a",a:2,n:1},{k:"front",br:-3,az:2,m:"a",a:2,n:0},{k:"right",br:55,az:-75,m:"a",a:1,n:1},{k:"right",br:40,az:-60,m:"a",a:1,n:0},{k:"left",br:-55,az:75,m:"a",a:0,n:1},{k:"left",br:-45,az:62,m:"a",a:0,n:0},
  {k:"over",br:6,az:178,m:"a",a:3,n:1},{k:"over",br:-5,az:182,m:"a",a:3,n:0},{k:"gl",br:-50,az:70,m:"g",a:1,n:0},{k:"gl",br:-35,az:55,m:"g",a:1,n:0},{k:"ba",br:-40,az:60,m:"b",a:1,n:0}];
return {t:"3D · Derecho de paso (SERA.3210): lo que ves desde la cabina y qué haces",
cap:"Tú vuelas un avión de motor y el otro va a tu misma altura y acercándose. De noche solo ves sus luces: roja a la izquierda y verde a la derecha (110° cada una desde el morro) y blanca de cola (140°). Quien tiene preferencia mantiene rumbo y velocidad; quien cede no pasa por encima, por debajo ni por delante salvo con buena separación.",
init(el){
  const ctl=row("",`<button type="button" data-nx>Otro escenario →</button><label class="v3k"><input type="checkbox" data-nt> Solo de noche</label>`)+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Vista desde la cabina con otra aeronave en conflicto",ctl,this.cap);
  u.c.style.cursor="default";
  let sc=SC[0], night=0, ph=0, envD=null, envN=null, onlyN=false;
  const need=()=>window.F0Real&&window.F0Real.plane3D?Promise.resolve():new Promise((ok,ko)=>{ const s=document.createElement("script"); s.src=(window.F0VIZ_BASE||"../")+"real.js"; s.onload=()=>window.F0Real&&window.F0Real.plane3D?ok():ko(new Error("real.js")); s.onerror=ko; document.head.appendChild(s); });
  const bank=SC.map(c=>({c,q:"",o:OP,a:c.a,e:E[c.k]}));
  const S=orbit(u.c,{yaw:0,pit:0,ar:.5,hmin:260,hmax:400,ky:0,draw});
  S.anim=true;
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp; if(!envD) return false; const env=night?envN:envD;
    ph=(ph+dt/7)%1; const near=sst(0,1,ph);
    x.setTransform(1,0,0,1,0,0); x.globalAlpha=1; x.globalCompositeOperation="source-over"; const hz=H*.56;
    const g=x.createLinearGradient(0,0,0,hz); if(night){ g.addColorStop(0,"#03060f"); g.addColorStop(1,"#0f1a2c"); } else { g.addColorStop(0,"#4f86c6"); g.addColorStop(1,"#bcd5ea"); } x.fillStyle=g; x.fillRect(0,0,W,hz);
    if(night){ x.fillStyle="#fff"; for(let i=0;i<60;i++){ x.globalAlpha=.2+.6*((i*37)%10)/10; x.fillRect(((i*73.7)%1+i*.618)%1*W,((i*31)%17)/17*hz*.9,d,d); } x.globalAlpha=1; }
    const gg=x.createLinearGradient(0,hz,0,H); if(night){ gg.addColorStop(0,"#0b1118"); gg.addColorStop(1,"#05080c"); } else { gg.addColorStop(0,"#8fa37a"); gg.addColorStop(1,"#5c7046"); } x.fillStyle=gg; x.fillRect(0,hz,W,H-hz);
    if(night){ for(let i=0;i<40;i++){ x.fillStyle=`rgba(255,${190+(i%3)*20},120,${.3+.4*((i*13)%7)/7})`; x.fillRect(((i*91.3)%W),hz+((i*17)%9)*d*2+2*d,1.4*d,1.4*d); } }
    // el otro: marcación en pantalla y tamaño según distancia
    const sx=W/2+cl(sc.br/70,-1,1)*W*.36, sy=hz-H*.06, pm=lerp(Math.min(W,H)/70,Math.min(W,H)/17,near);
    const PD=window.F0Real.PD, cw=[-PD[0],-PD[1],-PD[2]], th=Math.atan2(cw[2],cw[0]), psi=th-sc.az*R;
    if(sc.m==="b"){ const r=pm*3.2, by=sy-r*1.2; const bg=x.createRadialGradient(sx-r*.35,by-r*.4,r*.1,sx,by,r); bg.addColorStop(0,"#ffd27a"); bg.addColorStop(.5,"#e0533d"); bg.addColorStop(1,"#7a2a22"); x.fillStyle=bg; x.beginPath(); x.ellipse(sx,by,r*.85,r,0,0,7); x.fill();
      x.strokeStyle="rgba(60,30,20,.7)"; x.lineWidth=d; x.beginPath(); x.moveTo(sx-r*.4,by+r*.9); x.lineTo(sx-r*.18,by+r*1.55); x.moveTo(sx+r*.4,by+r*.9); x.lineTo(sx+r*.18,by+r*1.55); x.stroke(); x.fillStyle="#6b4a2a"; x.fillRect(sx-r*.2,by+r*1.5,r*.4,r*.32); }
    else window.F0Real.plane3D(x,sx,sy,pm,{psi,pitch:0,roll:0,ll:1,st:sc.m==="g"?1:0},env,t,0,sc.m==="g"?window.F0Real.GL:undefined);
    x.globalAlpha=1; x.globalCompositeOperation="source-over";
    // tu cabina: guardabarros, montantes y un par de relojes
    x.fillStyle=night?"#06090d":"#1b2129"; x.beginPath(); x.moveTo(0,H); x.lineTo(0,H*.82); x.quadraticCurveTo(W*.5,H*.72,W,H*.82); x.lineTo(W,H); x.closePath(); x.fill();
    x.fillStyle=night?"#0b1016":"#252c36"; x.beginPath(); x.moveTo(0,0); x.lineTo(W*.05,0); x.lineTo(W*.02,H*.82); x.lineTo(0,H*.83); x.closePath(); x.fill(); x.beginPath(); x.moveTo(W,0); x.lineTo(W*.95,0); x.lineTo(W*.98,H*.82); x.lineTo(W,H*.83); x.closePath(); x.fill();
    for(const [cx,r] of [[W*.32,H*.07],[W*.44,H*.07],[W*.56,H*.07],[W*.68,H*.07]]){ x.fillStyle="#0a0e13"; x.beginPath(); x.arc(cx,H*.92,r,0,7); x.fill(); x.strokeStyle=night?"rgba(255,120,60,.35)":"#4a5563"; x.lineWidth=1.5*d; x.stroke(); }
    tag(x,W/2,H*.05,night?"DE NOCHE · misma altura · acercándose":"DE DÍA · misma altura · acercándose",{dp:d,fs:11,al:"c",c:"#ffd24d"});
    return true; }
  const Q=quiz(u,bank,c=>{ sc=c.c; night=c.c.n?(onlyN?1:Math.random()<.5?1:0):0; if(onlyN&&!c.c.n) night=0; ph=0; c.q=`${night?"De noche":"De día"} ves esto ${Math.abs(sc.br)<10?"delante de ti":sc.br>0?"a tu derecha":"a tu izquierda"}. ¿Qué manda el reglamento?`; S.kick(); });
  u.q("[data-nx]").addEventListener("click",()=>Q.start());
  u.q("[data-nt]").addEventListener("change",e=>{ onlyN=e.target.checked; bank.length=0; SC.filter(c=>!onlyN||c.n).forEach(c=>bank.push({c,q:"",o:OP,a:c.a,e:E[c.k]})); Q.start(); });
  u.out.textContent="Cargando el modelo 3D…";
  need().then(()=>{ envD=window.F0Real.envAt(new Date(Date.UTC(2026,5,21,10,0)),.15); envN=window.F0Real.envAt(new Date(Date.UTC(2026,5,21,23,30)),.05); Q.start(); S.kick(); })
   .catch(()=>{ u.out.textContent="No se ha podido cargar el modelo 3D. Recarga la página con conexión."; });
}};
})();

/* =====================================================================
   5 · CENTRO DE GRAVEDAD ADELANTADO O RETRASADO (031/032): causa → efecto
   Modelo de equilibrio longitudinal de un monomotor de ejemplo: 1.000 kg, MAC 1,5 m, centro aerodinámico al 25 %, brazo de cola 4,5 m,
   momento de picado del ala Cm0 = −0,05 y punto neutro al 38 % MAC. Límites de CG de ejemplo: 12–30 % MAC.
   ===================================================================== */
V.cgfx=(()=>{
const W0=1000, MAC=1.5, AC=.25, LT=4.5, M0=-.05*W0*MAC, NP=38, FWD=12, AFT=30;
const tail=c=>(M0-W0*(AC-c/100)*MAC)/LT;   // fuerza en la cola, kgf (− hacia abajo)
const st=c=>{ const T=tail(c), L=W0-T, r=tail(25), Lr=W0-r; return {T,L,vs:50*Math.sqrt(L/Lr),fuel:100*(.7+.3*(L/Lr)**2+.0006*((T-r)/10)**2),to:100*(L/Lr)*(1+.6*Math.max(0,(FWD+2-c)/100)),sm:NP-c}; };
const QZ=[
 {q:"Con el CG <b>adelantado</b>, la velocidad de pérdida…",o:["Aumenta","Disminuye","No cambia"],a:0,e:"La cola tiene que empujar más hacia abajo para equilibrar, así que el ala carga con el peso <b>más</b> esa fuerza: más sustentación necesaria y <b>Vs mayor</b>.",c:8},
 {q:"Con el CG <b>retrasado</b>, la estabilidad longitudinal…",o:["Disminuye","Aumenta","No depende del CG"],a:0,e:"El margen estático es la distancia del CG al punto neutro: cuanto más atrás el CG, menor margen, <b>menos estable</b> y mandos más ligeros. Si pasa el punto neutro, es inestable.",c:33},
 {q:"¿Con qué CG gastas <b>más combustible</b> en crucero?",o:["Adelantado","Retrasado","Igual"],a:0,e:"Más fuerza de cola hacia abajo = más sustentación del ala = más resistencia inducida y de compensación: <b>más consumo</b> y algo menos de velocidad.",c:10},
 {q:"CG <b>por delante</b> del límite delantero: ¿qué riesgo hay?",o:["No poder rotar o redondear (falta de autoridad del timón de profundidad)","Entrar en barrena con facilidad","Ninguno: es lo más seguro"],a:0,e:"Con el CG demasiado adelantado el timón de profundidad puede quedarse corto para levantar el morro en la rotación o en la recogida: <b>carrera más larga</b> y aterrizaje de morro.",c:6},
 {q:"CG <b>por detrás</b> del límite trasero: ¿qué riesgo hay?",o:["Inestabilidad y difícil recuperación de pérdida o barrena","Más velocidad de pérdida","Más consumo"],a:0,e:"Poco o ningún margen de estabilidad, mandos muy ligeros (riesgo de sobrecarga) y la pérdida o la barrena pueden ser <b>irrecuperables</b>.",c:36}];
return {t:"Centro de gravedad: adelantado o retrasado, qué cambia",
cap:"Avión de ejemplo, cifras redondeadas para ver la tendencia. Vs y carrera de despegue relativas al CG al 25 % MAC (ala lisa, MTOM). La fuerza de la cola se dibuja exagerada ×5. Límites de ejemplo 12–30 % MAC; punto neutro al 38 %.",
init(el){
  const ctl=row("",sl("cg","Posición del CG",4,40,22,1))+row("",bt("data-p","8","Adelantado")+bt("data-p","22","Centrado")+bt("data-p","29","Retrasado")+bt("data-p","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Perfil del avión con el centro de gravedad, las fuerzas y sus efectos",ctl,this.cap); u.c.style.cursor="default";
  const I=u.q('[data-k="cg"]'), O=u.q('[data-o="cg"]'); let cg=22, qm=false;
  const S=orbit(u.c,{ar:w=>w<620?1.12:.52,hmin:300,hmax:470,ky:0,draw});
  function draw(S){ const x=S.x, W=S.W, H=S.H, d=S.dp, r=st(cg), r0=st(25);
    x.setTransform(1,0,0,1,0,0); const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#16283d"); g.addColorStop(1,"#0c1726"); x.fillStyle=g; x.fillRect(0,0,W,H);
    const narrow=W/d<620, pw=narrow?W:W*.6, sc=pw/9.2, ox=pw*.06, oy=H*(narrow?.24:.5), X=m=>ox+m*sc, Y=m=>oy-m*sc;
    // avión de perfil (morro a la izquierda): cortafuegos en x=1,2 m; borde de ataque del ala MAC en x=2,0 m
    const LE=2.0; x.fillStyle="#d9dee6"; x.beginPath(); x.moveTo(X(.2),Y(.05)); x.quadraticCurveTo(X(.3),Y(.45),X(1.2),Y(.5)); x.lineTo(X(2.2),Y(.95)); x.quadraticCurveTo(X(3.2),Y(1.05),X(3.6),Y(.6)); x.lineTo(X(7.6),Y(.35)); x.lineTo(X(7.9),Y(.2)); x.lineTo(X(7.6),Y(-.05)); x.lineTo(X(3.2),Y(-.35)); x.quadraticCurveTo(X(1.2),Y(-.45),X(.35),Y(-.25)); x.closePath(); x.fill();
    x.fillStyle="#9fb7d4"; x.beginPath(); x.moveTo(X(1.55),Y(.55)); x.lineTo(X(2.2),Y(.92)); x.lineTo(X(3.1),Y(.95)); x.lineTo(X(3.1),Y(.55)); x.closePath(); x.fill();
    x.fillStyle="#c5ccd6"; x.beginPath(); x.moveTo(X(6.6),Y(.35)); x.lineTo(X(7.5),Y(1.45)); x.lineTo(X(7.95),Y(1.45)); x.lineTo(X(7.85),Y(.25)); x.closePath(); x.fill();
    x.fillStyle="#aab3bf"; x.fillRect(X(LE),Y(-.08),MAC*sc,.16*sc); x.fillRect(X(6.7),Y(.36),1.2*sc,.08*sc);
    x.fillStyle="#555f6c"; x.fillRect(X(.05),Y(.7),.1*sc,1.4*sc); x.strokeStyle="#2b3442"; x.lineWidth=2*d; x.beginPath(); x.moveTo(X(1.0),Y(-.4)); x.lineTo(X(.9),Y(-.9)); x.moveTo(X(2.9),Y(-.35)); x.lineTo(X(3.1),Y(-.9)); x.stroke();
    for(const [cx,rr] of [[.9,.17],[3.1,.2]]){ x.fillStyle="#1b222c"; x.beginPath(); x.arc(X(cx),Y(-.95),rr*sc,0,7); x.fill(); }
    // escala de la MAC con límites y punto neutro
    const my=Y(-1.55), mx=p=>X(LE+p/100*MAC*2.6-.95);
    const pc=p=>X(LE)+p/100*MAC*sc; const sx0=X(.6), sx1=X(5.4), SX=p=>lerp(sx0,sx1,(p-0)/45);
    x.fillStyle="rgba(255,90,80,.35)"; x.fillRect(SX(0),my-5*d,SX(FWD)-SX(0),10*d); x.fillRect(SX(AFT),my-5*d,SX(45)-SX(AFT),10*d); x.fillStyle="rgba(110,231,160,.45)"; x.fillRect(SX(FWD),my-5*d,SX(AFT)-SX(FWD),10*d);
    x.fillStyle="#cfd8e3"; x.font=`600 ${10.5*d}px system-ui,sans-serif`; x.textAlign="center"; for(const p of [0,10,20,30,40]){ x.fillRect(SX(p)-.5*d,my+5*d,d,4*d); x.fillText(p+" %",SX(p),my+16*d); }
    x.fillStyle="#ff8a80"; x.fillRect(SX(NP)-d,my-9*d,2*d,18*d); x.fillText("punto neutro",SX(NP),my-14*d); x.fillStyle="#8fa3b8"; x.fillText("% MAC · límites de ejemplo 12–30 %",(sx0+sx1)/2,my+30*d); x.textAlign="left";
    const cx=SX(cg); x.fillStyle="#ffd24d"; x.beginPath(); x.moveTo(cx,my-6*d); x.lineTo(cx-6*d,my-16*d); x.lineTo(cx+6*d,my-16*d); x.closePath(); x.fill();
    // fuerzas: CG en el avión (sobre la cuerda MAC real)
    const gx=pc(cg), ax=pc(25), tx=X(7.3), cgY=Y(.1);
    const ar=(x0,y0,y1,col,tt,al)=>{ x.strokeStyle=col; x.fillStyle=col; x.lineWidth=3*d; x.beginPath(); x.moveTo(x0,y0); x.lineTo(x0,y1); x.stroke(); const s=Math.sign(y1-y0)||1; x.beginPath(); x.moveTo(x0,y1); x.lineTo(x0-6*d,y1-s*10*d); x.lineTo(x0+6*d,y1-s*10*d); x.closePath(); x.fill(); if(tt) tag(x,x0+(al==="r"?-8*d:8*d),(y0+y1)/2,tt,{dp:d,fs:11,c:col,al}); };
    const kL=sc*1.15/1000; ar(ax,Y(.05),Y(.05)-r.L*kL,"#6ee7a0",`Sustentación ${f0(r.L)} kgf`,"r"); ar(gx,cgY,cgY+W0*kL,"#ffd24d",`Peso 1.000 kg`); if(Math.abs(r.T)>2) ar(tx,Y(.4),Y(.4)-r.T*kL*5,r.T<0?"#ff8a80":"#6ee7a0",`Cola ${r.T<0?"↓":"↑"} ${f0(Math.abs(r.T))} kgf`,"r");
    x.fillStyle="#0c1622"; x.beginPath(); x.arc(gx,cgY,7*d,0,7); x.fill(); x.fillStyle="#ffd24d"; x.beginPath(); x.moveTo(gx,cgY); x.arc(gx,cgY,7*d,0,Math.PI/2); x.closePath(); x.fill(); x.beginPath(); x.moveTo(gx,cgY); x.arc(gx,cgY,7*d,Math.PI,Math.PI*1.5); x.closePath(); x.fill(); x.strokeStyle="#ffd24d"; x.lineWidth=1.5*d; x.beginPath(); x.arc(gx,cgY,7*d,0,7); x.stroke();
    // indicadores
    const IT=[["Estabilidad (margen estático)",cl(r.sm/30,0,1),`${f1(r.sm)} % MAC`,r.sm<4?"#ff8a80":r.sm<10?"#ffd24d":"#6ee7a0"],["Velocidad de pérdida Vs",cl((r.vs-47)/7,0,1),`${f1(r.vs)} kt`,"#ffd24d"],["Consumo en crucero",cl((r.fuel-98)/8,0,1),`${r.fuel>=r0.fuel?"+":""}${f1(r.fuel-r0.fuel)} %`,"#ffd24d"],["Carrera de despegue",cl((r.to-96)/14,0,1),`${r.to>=r0.to?"+":""}${f1(r.to-r0.to)} %`,"#ffd24d"],["Fuerza en los mandos",cl(r.sm/30,0,1),r.sm>22?"muy pesada":r.sm>12?"normal":r.sm>4?"ligera":"casi nula","#9fc0ff"]];
    const bx=narrow?W*.06:W*.64, bw=narrow?W*.88:W*.32, by0=narrow?H*.5:H*.1, step=narrow?(H*.48)/IT.length:H*.15;
    x.font=`600 ${11.5*d}px system-ui,sans-serif`; IT.forEach((it,i)=>{ const y=by0+i*step; x.fillStyle="#cfd8e3"; x.textBaseline="alphabetic"; x.fillText(it[0],bx,y+12*d); x.textAlign="right"; x.fillStyle=it[3]; x.fillText(it[2],bx+bw,y+12*d); x.textAlign="left";
      x.fillStyle="#24364b"; x.fillRect(bx,y+17*d,bw,7*d); x.fillStyle=it[3]; x.fillRect(bx,y+17*d,bw*it[1],7*d); });
    return false; }
  const say=()=>{ if(qm) return; const r=st(cg), out=cg<FWD?"<b class=\"bad\">Fuera de límites por delante</b>: puede faltar timón de profundidad para rotar o redondear.":cg>AFT?(cg>=NP?"<b class=\"bad\">Detrás del punto neutro: avión inestable</b>.":"<b class=\"bad\">Fuera de límites por detrás</b>: poco margen de estabilidad, mandos muy ligeros y recuperación de pérdida o barrena difícil."):"Dentro de límites.";
    u.out.innerHTML=`CG al <b>${cg} % MAC</b>. ${out} La cola empuja <b>${r.T<0?"hacia abajo":"hacia arriba"} ${f0(Math.abs(r.T))} kgf</b>, así que el ala sostiene <b>${f0(r.L)} kgf</b>. ${cg<22?"<b>Adelantado</b>: más estable, más Vs, más consumo y más carrera de despegue; mandos más pesados.":cg>26?"<b>Retrasado</b>: menos Vs, menos consumo y algo más de velocidad, pero menos estable y mandos más ligeros.":"Zona media: compromiso entre estabilidad y rendimiento."}`; };
  const set=v=>{ cg=+v; I.value=cg; O.textContent=cg+" %"; say(); S.kick(); };
  I.addEventListener("input",()=>{ if(qm){ qm=false; Q.stop(); } set(I.value); });
  const Q=quiz(u,QZ,c=>{ set(c.c); });
  u.qa("[data-p]").forEach(b=>b.addEventListener("click",()=>{ const v=b.dataset.p; press(u,"data-p",v); if(v==="quiz"){ qm=true; Q.start(); } else { qm=false; Q.stop(); set(v); } }));
  set(22);
}};
})();

/* =====================================================================
   6 · TÚNEL DE VIENTO 3D (081): ala con flaps y slats, líneas de corriente, centro de presiones, vórtices de punta y pérdida
   Ejes: x en la dirección del viento, y arriba, z envergadura. Cuerda 1 (unidades arbitrarias).
   ===================================================================== */
V.tun3d=(()=>{
const AF=(()=>{ const P=[]; const yt=x=>.6*(.2969*Math.sqrt(x)-.126*x-.3516*x*x+.2843*x**3-.1015*x**4), yc=x=>x<.4?.02/.16*(.8*x-x*x):.02/.36*(.2+.8*x-x*x);   // NACA 2412
  const xs=Array.from({length:15},(_,i)=>(1-Math.cos(i/14*Math.PI))/2); for(const x of xs.slice().reverse()) P.push([x,yc(x)+yt(x)]); for(const x of xs.slice(1)) P.push([x,yc(x)-yt(x)]); return P; })();
const FL={0:[0,0],10:[.3,-.5],25:[.6,-1.5],40:[.8,-3]};   // flaps: [ΔCL0, Δα crítico]
const model=(a,f,sl)=>{ const d=FL[f], ac=16+d[1]+(sl?6:0), cl0=.22+d[0], k=.1, clmax=cl0+k*ac; let c=a<=ac?cl0+k*a:clmax-(a-ac)*.09; c=Math.max(c,-.3); const st=a>ac, cm=-.05-.12*d[0];
  let cp=.25-cm/Math.max(.15,c); cp=Math.min(.62,cp); if(st) cp=Math.min(.55,.32+(a-ac)*.03); return {cl:c,ac,clmax,st,sep:st?1:sst(ac-5,ac,a)*.35,cp}; };
const f2=x=>(Math.round(x*100)/100).toString().replace(".",",");
const QZ=[
 {q:"Al aumentar el ángulo de ataque (antes de la pérdida), el <b>centro de presiones</b>…",o:["Avanza hacia el borde de ataque","Retrocede hacia el borde de salida","No se mueve"],a:0,e:"En un perfil con curvatura el CP <b>avanza</b> al subir el ángulo de ataque, hasta la pérdida; al entrar en pérdida retrocede bruscamente.",s:{a:12}},
 {q:"¿De qué depende que el ala entre en pérdida?",o:["Del ángulo de ataque crítico","De la velocidad","Del peso"],a:0,e:"La pérdida es de <b>ángulo</b>: con la misma configuración siempre ocurre al mismo ángulo crítico, a cualquier velocidad, peso o actitud.",s:{a:18}},
 {q:"Al sacar flaps, ¿qué pasa con el C<sub>L</sub> máximo y el ángulo crítico?",o:["Sube el CLmax y el ángulo crítico baja un poco","Baja el CLmax y sube el ángulo crítico","No cambian"],a:0,e:"Los flaps añaden curvatura: más C<sub>L</sub> a cada ángulo y más C<sub>L</sub>max, pero el ala entra en pérdida con un ángulo algo <b>menor</b>.",s:{a:10,f:25}},
 {q:"¿Qué hacen los <b>slats</b>?",o:["Retrasan la separación y aumentan el ángulo crítico","Aumentan la curvatura y bajan el ángulo crítico","Reducen la resistencia en crucero"],a:0,e:"El slat abre una ranura que energiza la capa límite del extradós: la separación llega más tarde y el ángulo crítico <b>sube</b> (y con él el CLmax).",s:{a:20,sl:1}},
 {q:"¿Por qué aparecen los <b>torbellinos de punta de plano</b>?",o:["El aire pasa de la alta presión del intradós a la baja del extradós por la punta","Por la hélice","Por la fricción del aire con la piel"],a:0,e:"La diferencia de presión empuja el aire alrededor de la punta: torbellinos, <b>downwash</b> y <b>resistencia inducida</b>. Son más fuertes con C<sub>L</sub> alto: lento, pesado y limpio.",s:{a:14}},
 {q:"En la pérdida, el flujo sobre el extradós…",o:["Se separa y se vuelve turbulento","Se acelera aún más","Se hace laminar"],a:0,e:"Pasado el ángulo crítico la capa límite no puede vencer el gradiente de presión adverso y <b>se desprende</b>: cae la sustentación y aparece el bataneo (buffet).",s:{a:19}}];
return {t:"3D · Túnel de viento: ángulo de ataque, flaps y slats, centro de presiones y pérdida",
cap:"Ala rectangular con perfil NACA 2412 y modelo simplificado: pendiente 0,1 por grado, ángulo crítico 16° en limpio. Flaps 10/25/40° suben el CL y bajan el ángulo crítico 0,5/1,5/3°; los slats lo suben 6°. El CP se calcula con un momento de picado constante del perfil. Las partículas de arriba corren más que las de abajo: menor presión.",
init(el){
  const ctl=row("",sl("a","Ángulo de ataque α",-4,20,6,.5))+row("Flaps",bt("data-f","0","0°",1)+bt("data-f","10","10°")+bt("data-f","25","25°")+bt("data-f","40","40°")+`<label class="v3k"><input type="checkbox" data-sl> Slats</label><label class="v3k"><input type="checkbox" data-vx checked> Vórtices</label>`)
   +row("Vista",bt("data-v","34","3/4",1)+bt("data-v","si","Perfil")+bt("data-v","re","Desde atrás")+bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Ala en 3D dentro de un túnel de viento con líneas de corriente y vórtices de punta",ctl,this.cap);
  let a=6, fl=0, sls=false, vx=true, qm=false;
  const S=orbit(u.c,{yaw:-35,pit:18,ar:.6,hmin:300,hmax:480,pmin:-20,pmax:89,draw}); S.anim=true;
  const SP=1.5, PART=[]; for(let i=0;i<260;i++) PART.push({x:Math.random()*4-1.6,y:(Math.random()-.5)*1.1,z:(Math.random()*2-1)*SP*.95,ph:Math.random()});
  const VXP=Array.from({length:90},(_,i)=>({s:Math.random(),r:Math.random(),side:i%2?1:-1}));
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp, M=model(a,fl,sls), k=Math.min(W*.24,H*.42); S.cam(k,W*.47,H*.5,[.5,0,0],9); const P=S.P;
    x.setTransform(1,0,0,1,0,0); const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#13263b"); g.addColorStop(1,"#0a1522"); x.fillStyle=g; x.fillRect(0,0,W,H);
    // suelo del túnel
    x.strokeStyle="rgba(140,170,200,.12)"; x.lineWidth=d; for(let i=-4;i<=6;i++){ const p=P([i*.5,-.75,-2.2]), q=P([i*.5,-.75,2.2]); x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke(); } for(let j=-4;j<=4;j++){ const p=P([-2,-.75,j*.5]), q=P([3,-.75,j*.5]); x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke(); }
    // ala: perfil girado α alrededor del 25 %, flap (25 % trasero) y slat (12 % delantero)
    const ar=-a*R, ca=Math.cos(ar), sa=Math.sin(ar), rot=(px,py)=>{ const X=px-.25, Y=py; return [.25+X*ca-Y*sa,X*sa+Y*ca]; };
    const fr=-fl*R, fc=Math.cos(fr), fs=Math.sin(fr), slx=sls?-.06:0, sly=sls?-.035:0;
    const prof=AF.map(([px,py])=>{ let X=px, Y=py; if(px>.75){ const dx=px-.75; X=.75+dx*fc-Y*fs*0; Y=Y+dx*fs; X=.75+dx*fc; } if(px<.12&&sls){ X+=slx*(1-px/.12)*1.4; Y+=sly*(1-px/.12)*1.4; } return rot(X,Y); });
    const items=[];
    const NZ=6; for(let j=0;j<NZ;j++){ const z0=-SP+2*SP*j/NZ, z1=-SP+2*SP*(j+1)/NZ; for(let i=0;i<prof.length-1;i++){ const a0=prof[i], a1=prof[i+1], quad=[[a0[0],a0[1],z0],[a1[0],a1[1],z0],[a1[0],a1[1],z1],[a0[0],a0[1],z1]], q=quad.map(P), n=vnorm(vcross(vsub(quad[1],quad[0]),vsub(quad[3],quad[0]))), lit=.5+.5*Math.abs(vdot(n,vnorm([-.3,.9,.4])));
        const isF=AF[i][0]>.75&&AF[i+1][0]>.75&&fl>0, isS=AF[i][0]<.12&&AF[i+1][0]<.12&&sls; items.push({z:(q[0][2]+q[2][2])/2,f:()=>{ x.beginPath(); q.forEach((p,m)=>m?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); const c=isF?[255,201,77]:isS?[110,231,160]:[214,222,232]; x.fillStyle=`rgb(${c.map(v=>v*lit|0)})`; x.fill(); x.strokeStyle="rgba(30,40,50,.25)"; x.lineWidth=.6*d; x.stroke(); }}); } }
    for(const z of [-SP,SP]){ const q=prof.map(p=>P([p[0],p[1],z])); items.push({z:q.reduce((s,p)=>s+p[2],0)/q.length,f:()=>{ x.beginPath(); q.forEach((p,m)=>m?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fillStyle="#9fb0c2"; x.fill(); }}); }
    // líneas de corriente que rodean el perfil (girado α): upwash delante, downwash detrás; el aire de arriba corre más. Tras la pérdida, extradós desprendido
    const CL=M.cl, UP=prof.slice(0,15).reverse(), LO=prof.slice(14);
    const itp=(pts,X)=>{ if(X<=pts[0][0]) return pts[0][1]; for(let i=0;i<pts.length-1;i++){ const a0=pts[i], a1=pts[i+1]; if(X<=a1[0]) return lerp(a0[1],a1[1],(X-a0[0])/((a1[0]-a0[0])||1e-6)); } return pts[pts.length-1][1]; };
    const lx0=Math.min(UP[0][0],LO[0][0]), lx1=Math.max(UP[UP.length-1][0],LO[LO.length-1][0]);
    const yAt=(X,y0,z,tt)=>{ const upr=y0>0, inf=Math.exp(-Math.max(0,Math.abs(y0)-.06)*3)*(Math.abs(z)<SP?1:Math.exp(-(Math.abs(z)-SP)*4)), w=sst(lx0-.35,lx0,X)*(1-sst(lx1,lx1+.7,X)), ys=itp(upr?UP:LO,cl1(X))*w;
      const wash=CL*(.05*sst(-1.4,lx0,X)*(1-sst(lx0,lx0+.4,X))-.11*sst(lx1-.2,lx1+1.2,X))*Math.exp(-Math.abs(y0)*1.2);
      let y=y0+(ys+wash)*inf+wash*(1-inf)*.5; const tu=upr&&X>lx0+.12+.6*(1-M.sep)&&inf>.35?(M.st?1:M.sep*.6):0; if(tu) y+=tu*(.04+.05*Math.abs(Math.sin(X*9+tt*7+z*3)));
      return [y,tu]; };
    const cl1=X=>cl(X,lx0,lx1);
    for(const z of [-1.1,-.4,.4,1.1,(SP+.25)]) for(const y0 of [-.42,-.26,-.14,-.07,.07,.14,.26,.42]){ const up=y0>0, spd=up?1.15+.35*CL*Math.exp(-Math.abs(y0)*4):.9;
      let prev=null; for(let X=-1.5;X<=2.6;X+=.12){ const r=yAt(X,y0,z,t), q=P([X,r[0],z]); if(prev){ const a0=prev, col=r[1]>.2?`rgba(255,${150-50*r[1]|0},90,.55)`:up?"rgba(120,200,255,.28)":"rgba(170,220,255,.2)"; items.push({z:(a0[2]+q[2])/2,f:()=>{ x.strokeStyle=col; x.lineWidth=1.1*d; x.beginPath(); x.moveTo(a0[0],a0[1]); x.lineTo(q[0],q[1]); x.stroke(); }}); } prev=q; }
      for(let kq=0;kq<5;kq++){ const ph=((t*.22*spd+kq/5+(y0+z)*.37)%1+1)%1, X=-1.5+ph*4.1, r=yAt(X,y0,z,t), r2=yAt(X+.09,y0,z,t), a0=P([X,r[0],z]), a1=P([X+.09,r2[0],z]), col=r[1]>.2?"rgba(255,120,80,.95)":up?"rgba(140,215,255,.95)":"rgba(190,230,255,.8)";
        items.push({z:a0[2]+.005,f:()=>{ x.strokeStyle=col; x.lineWidth=2.4*d; x.lineCap="round"; x.beginPath(); x.moveTo(a0[0],a0[1]); x.lineTo(a1[0],a1[1]); x.stroke(); }}); } }
    // vórtices de punta: hélices detrás de cada punta, más fuertes con CL alto
    if(vx&&CL>.05){ for(const v of VXP){ v.s=(v.s+dt*.35)%1; const xr=.9+v.s*1.9, ang=v.side*(t*5+v.s*18)+v.r*6, rr=.04+.12*v.s*CL/1.2, zz=v.side*(SP-.04-.12*v.s), yy=-.08*CL*v.s-.03+Math.sin(ang)*rr; const q=P([xr,yy,zz+Math.cos(ang)*rr]);
        items.push({z:q[2],f:()=>{ x.fillStyle=`rgba(230,140,255,${.75*(1-v.s)})`; x.beginPath(); x.arc(q[0],q[1],1.8*d,0,7); x.fill(); }}); } }
    items.sort((p,q)=>p.z-q.z).forEach(o=>o.f());
    // centro de presiones y sustentación
    const cpp=rot(M.cp,.03), c0=P([cpp[0],cpp[1],0]), lift=Math.max(.05,M.cl*.55), c1=P([cpp[0],cpp[1]+lift,0]);
    x.strokeStyle="#6ee7a0"; x.fillStyle="#6ee7a0"; x.lineWidth=3.5*d; x.beginPath(); x.moveTo(c0[0],c0[1]); x.lineTo(c1[0],c1[1]); x.stroke(); const an=Math.atan2(c1[1]-c0[1],c1[0]-c0[0]); x.beginPath(); x.moveTo(c1[0],c1[1]); x.lineTo(c1[0]-11*d*Math.cos(an-.45),c1[1]-11*d*Math.sin(an-.45)); x.lineTo(c1[0]-11*d*Math.cos(an+.45),c1[1]-11*d*Math.sin(an+.45)); x.closePath(); x.fill();
    x.fillStyle="#ffd24d"; x.beginPath(); x.arc(c0[0],c0[1],5*d,0,7); x.fill(); tag(x,c0[0]+8*d,c0[1]+12*d,`CP ${Math.round(M.cp*100)} %`,{dp:d,fs:11.5,c:"#ffd24d"}); tag(x,c1[0]+6*d,c1[1],"Sustentación · Lift",{dp:d,fs:11,c:"#6ee7a0"});
    if(vx&&M.cl>.4){ const q=P([2.2,-.1,SP]); tag(x,q[0],q[1],"vórtice de punta",{dp:d,fs:10.5,c:"#e6a0ff",al:"c"}); }
    if(M.st){ tag(x,W/2,22*d,"PÉRDIDA · flujo desprendido · STALL",{dp:d,fs:13,al:"c",c:"#fff",bg:"rgba(190,40,30,.85)",w:800}); }
    // curva CL-α
    const bw=Math.min(W*.3,190*d), bh=bw*.62, bx=W-bw-10*d, by=10*d; x.fillStyle="rgba(8,16,28,.82)"; x.fillRect(bx,by,bw,bh); const X=v=>bx+10*d+(v+4)/28*(bw-20*d), Y=v=>by+bh-12*d-(v+.3)/2.6*(bh-24*d);
    x.strokeStyle="rgba(200,215,230,.25)"; x.lineWidth=d; x.beginPath(); x.moveTo(X(-4),Y(0)); x.lineTo(X(24),Y(0)); x.stroke();
    x.strokeStyle="#55d0ff"; x.lineWidth=2*d; x.beginPath(); for(let v=-4;v<=24;v+=.5){ const m=model(v,fl,sls); v===-4?x.moveTo(X(v),Y(m.cl)):x.lineTo(X(v),Y(m.cl)); } x.stroke();
    x.setLineDash([3*d,3*d]); x.strokeStyle="#ff8a80"; x.beginPath(); x.moveTo(X(M.ac),by+6*d); x.lineTo(X(M.ac),by+bh-10*d); x.stroke(); x.setLineDash([]);
    x.fillStyle=M.st?"#ff8a80":"#ffd24d"; x.beginPath(); x.arc(X(a),Y(M.cl),4*d,0,7); x.fill(); x.font=`600 ${10*d}px system-ui,sans-serif`; x.fillStyle="#cfd8e3"; x.fillText("CL",bx+4*d,by+12*d); x.fillText("α",bx+bw-12*d,by+bh-3*d); x.fillStyle="#ff8a80"; x.fillText(`crítico ${f1(M.ac)}°`,Math.min(X(M.ac)+3*d,bx+bw-64*d),by+12*d);
    return true; }
  const say=()=>{ if(qm) return; const M=model(a,fl,sls), L0=model(a,0,false);
    u.out.innerHTML=`α <b>${f1(a)}°</b> · C<sub>L</sub> <b>${f2(M.cl)}</b> (máximo ${f2(M.clmax)} a ${f1(M.ac)}°) · CP al <b>${Math.round(M.cp*100)} %</b> de la cuerda. ${M.st?"<b class=\"bad\">Ala en pérdida</b>: el flujo se ha desprendido del extradós, cae la sustentación y el CP retrocede. Para salir: <b>bajar el ángulo de ataque</b>.":M.sep>.05?"<b>Cerca del ángulo crítico</b>: la separación empieza en el borde de salida y avanza; aviso de bataneo (buffet).":"Flujo adherido."} ${fl||sls?`Con ${fl?`flaps ${fl}°`:""}${fl&&sls?" y ":""}${sls?"slats":""} el C<sub>L</sub> a este ángulo es ${f2(M.cl)} frente a ${f2(L0.cl)} en limpio.`:""}`; };
  const I=u.q('[data-k="a"]'), O=u.q('[data-o="a"]'); const setA=v=>{ a=+v; I.value=a; O.textContent=f1(a)+"°"; say(); };
  I.addEventListener("input",()=>setA(I.value)); setA(6);
  u.qa("[data-f]").forEach(b=>b.addEventListener("click",()=>{ fl=+b.dataset.f; press(u,"data-f",fl); say(); }));
  u.q("[data-sl]").addEventListener("change",e=>{ sls=e.target.checked; say(); }); u.q("[data-vx]").addEventListener("change",e=>{ vx=e.target.checked; });
  const VW={"34":[-35,18],si:[0,0],re:[-90,8]}; u.qa("[data-v]").forEach(b=>b.addEventListener("click",()=>{ const v=VW[b.dataset.v]; S.go(v[0],v[1]); press(u,"data-v",b.dataset.v); }));
  const Q=quiz(u,QZ,c=>{ const s=c.s; fl=s.f||0; sls=!!s.sl; press(u,"data-f",fl); u.q("[data-sl]").checked=sls; I.value=s.a; a=s.a; O.textContent=f1(a)+"°"; });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); say(); } });
  S.kick();
}};
})();

/* =====================================================================
   7 · CARRERA DE DESPEGUE (032): masa, altitud de presión, temperatura, viento y superficie → punto de VR y margen hasta el final de pista
   Mismo avión de ejemplo que la lámina de TORA/TODA: MTOM 1.000 kg, ISA, nivel del mar, asfalto seco y sin viento: carrera 260 m, hasta 50 ft 480 m.
   ===================================================================== */
V.vrrun=(()=>{
const fx=v=>(Math.round(v*100)/100).toString().replace(".",","), MT=1000, ROLL=260, TOD=480, VR=55, VLOF=60, TORA=800, ASDA=850, TODA=900;
const SF=[["Asfalto seco",1],["Asfalto mojado",1],["Hierba seca",1.2],["Hierba mojada",1.3]];
const calc=o=>{ const h=o.pa, T=15-1.98*h/1000+o.dt, sig=Math.pow(1-6.8756e-6*h,5.2559)/((273.15+T)/288.15), vt=VLOF/Math.sqrt(sig), we=o.w>=0?o.w*.5:o.w*1.5;
  const fM=Math.pow(o.m/MT,2), fA=1+.1*h/1000, fT=Math.max(.7,1+.01*o.dt), fW=Math.pow(Math.max(.2,(vt-we)/vt),2), fS=SF[o.s][1], f=fM*fA*fT*fW*fS;
  const roll=ROLL*f, vr=VR*Math.sqrt(o.m/MT), dvr=roll*Math.pow(vr/(VLOF*Math.sqrt(o.m/MT)),2), tod=TOD*f, req=tod*1.25;
  return {roll,dvr,tod,req,vr,vrT:vr/Math.sqrt(sig),da:h+118.8*(o.dt),f,fM,fA,fT,fW,fS,ok:req<=TORA}; };
const QZ=[
 {q:"La masa sube un 10 %. ¿Cuánto crece, más o menos, la distancia de despegue?",o:["≈ 20 %","≈ 10 %","≈ 5 %"],a:0,e:"La distancia va con el cuadrado de la masa: más masa pide más velocidad (VR sube con √masa) y acelera peor. Regla práctica: <b>+10 % de masa → +20 %</b> de distancia.",s:{m:1000}},
 {q:"Despegas en un aeródromo alto y con calor. ¿Qué pasa con la VR <b>indicada</b>?",o:["Es la misma IAS, pero la TAS y la carrera aumentan","Hay que rotar a más IAS","Hay que rotar a menos IAS"],a:0,e:"El ala vuela con la presión dinámica: la VR en <b>IAS</b> no cambia, pero con menos densidad corresponde a más <b>TAS</b> (y más velocidad sobre el suelo): carrera más larga.",s:{pa:5000,dt:20}},
 {q:"¿Cómo se cuenta el viento en los cálculos de clase B?",o:["50 % del de cara y 150 % del de cola","100 % de los dos","150 % del de cara y 50 % del de cola"],a:0,e:"Por seguridad: como mucho el <b>50 % del viento de cara</b> y al menos el <b>150 % del de cola</b>. Un viento de cola corto penaliza mucho.",s:{w:-5}},
 {q:"Hierba seca frente a asfalto seco:",o:["Unos 20 % más de distancia","Igual","Menos distancia"],a:0,e:"Más rozamiento de rodadura: hierba seca <b>×1,20</b> y mojada <b>×1,30</b> (factores orientativos de la CAA).",s:{s:2}},
 {q:"Altitud de presión de 0 a 4.000 ft (misma temperatura relativa a ISA):",o:["La distancia sube ≈ 40 %","No cambia","Baja"],a:0,e:"Regla práctica: <b>+10 % por cada 1.000 ft</b> de altitud del aeródromo. Y otro +10 % por cada 10 °C por encima de la temperatura de referencia.",s:{pa:4000}}];
return {t:"Despegue: dónde rotas (VR) y cuánta pista te sobra",
cap:"Factores orientativos (CAA Safety Sense 7): masa al cuadrado; +10 % por cada 1.000 ft de altitud de presión; +10 % por cada 10 °C sobre ISA; hierba seca ×1,20 y mojada ×1,30 (en despegue el asfalto mojado no suele penalizar en estos aviones, en aterrizaje sí); viento al 50 % de cara y 150 % de cola. VR 55 KIAS a MTOM y despegue a 60 KIAS. Clase B: la distancia hasta 50 ft × 1,25 debe caber en la TORA. Siempre manda el manual del avión.",
init(el){
  const ctl=row("",sl("m","Masa",700,1000,950,10)+sl("pa","Altitud de presión",0,8000,0,250)+sl("dt","Temperatura (desviación ISA)",-20,30,0,1)+sl("w","Viento (− cola · + cara)",-10,20,0,1))
   +row("Pista",SF.map((f,i)=>bt("data-s",i,f[0],!i)).join("")+`<button type="button" data-go>▶ Despegar</button>`+bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Pista vista desde arriba y de perfil con el punto de rotación, el despegue y el margen hasta el final",ctl,this.cap); u.c.style.cursor="default";
  const o={m:950,pa:0,dt:0,w:0,s:0}; let run=-1, qm=false;
  const U={m:" kg",pa:" ft",dt:" °C",w:" kt"};
  const S=orbit(u.c,{ar:w=>w<620?.95:.42,hmin:260,hmax:420,ky:0,draw});
  function draw(S,dt){ const x=S.x, W=S.W, H=S.H, d=S.dp, r=calc(o); let mv=false;
    x.setTransform(1,0,0,1,0,0); x.fillStyle="#0f1b29"; x.fillRect(0,0,W,H);
    const L=Math.max(TODA,r.req,r.tod)+60, X0=16*d, sc=(W-32*d)/L, X=m=>X0+m*sc, yR=H*.62, rh=Math.max(16*d,H*.09);
    // perfil: altura exagerada
    const yG=H*.34; x.strokeStyle="#3a4e66"; x.lineWidth=d; x.beginPath(); x.moveTo(X(0),yG); x.lineTo(X(L),yG); x.stroke();
    x.strokeStyle="#ffd24d"; x.lineWidth=3*d; x.beginPath(); x.moveTo(X(0),yG); x.lineTo(X(r.roll),yG); x.quadraticCurveTo(X((r.roll+r.tod)/2),yG,X(r.tod),yG-H*.16); x.stroke(); x.fillStyle="#ffd24d"; x.beginPath(); x.arc(X(r.tod),yG-H*.16,4*d,0,7); x.fill(); tag(x,X(r.tod)+6*d,yG-H*.16,"50 ft",{dp:d,fs:11});
    // pista: TORA, ASDA (zona de parada), TODA (zona libre de obstáculos)
    x.fillStyle="rgba(85,208,255,.12)"; x.fillRect(X(0),yR-rh*.9,X(TODA)-X(0),rh*1.8); x.fillStyle="#6b5a2e"; x.fillRect(X(TORA),yR-rh/2,X(ASDA)-X(TORA),rh); x.fillStyle="#3c4046"; x.fillRect(X(0),yR-rh/2,X(TORA)-X(0),rh);
    x.strokeStyle="#f4f4f0"; x.setLineDash([8*d,8*d]); x.lineWidth=1.2*d; x.beginPath(); x.moveTo(X(10),yR); x.lineTo(X(TORA-10),yR); x.stroke(); x.setLineDash([]);
    const mk=(m,col,t1,up)=>{ x.strokeStyle=col; x.lineWidth=2*d; x.beginPath(); x.moveTo(X(m),yR-rh*.8); x.lineTo(X(m),yR+rh*.8); x.stroke(); tag(x,X(m),up?yR-rh*1.35:yR+rh*1.35,t1,{dp:d,fs:11,al:"c",c:col}); };
    mk(r.dvr,"#ffd24d",`VR ${Math.round(r.vr)} kt · ${Math.round(r.dvr)} m`,1); mk(r.roll,"#6ee7a0",`despega ${Math.round(r.roll)} m`,0);
    const fin=Math.min(r.req,L); x.strokeStyle=r.ok?"#6ee7a0":"#ff8a80"; x.lineWidth=2*d; x.setLineDash([4*d,3*d]); x.beginPath(); x.moveTo(X(fin),yG+6*d); x.lineTo(X(fin),yR+rh*2.2); x.stroke(); x.setLineDash([]); tag(x,X(fin),yR+rh*2.6,`TOD × 1,25 = ${Math.round(r.req)} m`,{dp:d,fs:11,al:"c",c:r.ok?"#6ee7a0":"#ff8a80"});
    tag(x,X(TORA),yR-rh*2.1,"fin de TORA 800",{dp:d,fs:10.5,al:"c",c:"#cfd8e3"}); tag(x,X(TODA),yR+rh*1.35,"TODA 900",{dp:d,fs:10,al:"c",c:"#9fd8ff"});
    // margen hasta el final de la pista desde el punto de despegue
    const mg=TORA-r.roll; x.fillStyle=mg>0?"rgba(110,231,160,.25)":"rgba(255,138,128,.35)"; x.fillRect(Math.min(X(r.roll),X(TORA)),yR-rh/2,Math.abs(X(TORA)-X(r.roll)),rh);
    // avión rodando
    if(run>=0){ run+=dt; const tt=run, a=2*r.roll/Math.pow(4.2*Math.sqrt(r.f),2), pos=Math.min(r.tod,.5*a*tt*tt); mv=pos<r.tod; const lift=pos>r.roll?(pos-r.roll)/(r.tod-r.roll):0, rot=pos>r.dvr?Math.min(1,(pos-r.dvr)/(r.roll-r.dvr+1)):0;
      const px=X(pos), py=yR; x.save(); x.translate(px,py); x.fillStyle="#fff"; x.beginPath(); x.moveTo(8*d,0); x.lineTo(-8*d,-3*d); x.lineTo(-8*d,3*d); x.closePath(); x.fill(); x.fillRect(-2*d,-9*d,3*d,18*d); x.restore();
      const gy=yG-H*.16*lift*lift; x.save(); x.translate(px,gy-4*d); x.rotate(-rot*8*R-lift*4*R); x.fillStyle="#fff"; x.fillRect(-9*d,-2*d,18*d,4*d); x.fillRect(-9*d,-7*d,3*d,6*d); x.restore();
      if(!mv) run=-1; }
    return mv; }
  const say=()=>{ if(qm) return; const r=calc(o), mg=Math.round(TORA-r.roll);
    u.out.innerHTML=`Rotas a <b>${Math.round(r.vr)} KIAS</b> (${Math.round(r.vrT)} kt TAS) tras <b>${Math.round(r.dvr)} m</b>, despegas a los <b>${Math.round(r.roll)} m</b> y llegas a 50 ft a los <b>${Math.round(r.tod)} m</b>. Te sobran <b>${mg} m</b> de pista desde el despegue. ${r.ok?`<span class="ok">Cumple</span>: TOD × 1,25 = ${Math.round(r.req)} m ≤ TORA 800 m.`:`<b class="bad">No cumple</b>: TOD × 1,25 = ${Math.round(r.req)} m > TORA 800 m. Reduce masa o espera mejores condiciones.`} Factores: masa ×${fx(r.fM)} · altitud ×${fx(r.fA)} · temperatura ×${fx(r.fT)} · viento ×${fx(r.fW)} · superficie ×${fx(r.fS)}.`; };
  const IN={}; for(const k of ["m","pa","dt","w"]){ IN[k]=u.q(`[data-k="${k}"]`); IN[k+"o"]=u.q(`[data-o="${k}"]`); IN[k].addEventListener("input",()=>{ o[k]=+IN[k].value; sync(); }); }
  const sync=()=>{ for(const k of ["m","pa","dt","w"]){ IN[k].value=o[k]; IN[k+"o"].textContent=(k==="dt"&&o[k]>0?"+":"")+f0(o[k])+U[k]; } press(u,"data-s",o.s); say(); S.kick(); };
  u.qa("[data-s]").forEach(b=>b.addEventListener("click",()=>{ o.s=+b.dataset.s; sync(); }));
  u.q("[data-go]").addEventListener("click",()=>{ run=0; S.kick(); });
  const Q=quiz(u,QZ,c=>{ Object.assign(o,{m:950,pa:0,dt:0,w:0,s:0},c.s); sync(); });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); say(); } });
  sync();
}};
})();

/* ---------- utilidades para las láminas SVG (eléctrico y radio) ---------- */
const shellS=(el,t,svg,ctl,cap)=>{ el.innerHTML=`<p class="lt">${t}</p><figure>${svg}</figure><div class="ctl">${ctl}</div><p class="out" aria-live="polite"></p><p class="cap">${cap}</p>`;
  const f=el.querySelector("figure"); if("IntersectionObserver" in window) new IntersectionObserver(es=>{ f.classList.toggle("v3pause",!es.some(e=>e.isIntersecting)); }).observe(f);
  return {svg:el.querySelector("svg"),out:el.querySelector(".out"),q:s=>el.querySelector(s),qa:s=>el.querySelectorAll(s)}; };
if(!document.getElementById("v3css2")){ const s=document.createElement("style"); s.id="v3css2"; s.textContent=`
@keyframes v3flow{to{stroke-dashoffset:-24}}
.f0viz .v3w{fill:none;stroke:#3d4b5c;stroke-width:4;stroke-linecap:round}
.f0viz .v3w.on{stroke:#ffc94d;stroke-dasharray:8 4;animation:v3flow .6s linear infinite}
.f0viz .v3w.on.rev{animation-direction:reverse}
.f0viz .v3w.on.bat{stroke:#ff9f43}
.f0viz .v3pause .v3w.on{animation-play-state:paused}
.f0viz .v3bus{rx:3}
.f0viz .v3pt{cursor:pointer}
.f0viz .v3pt:focus{outline:none}
.f0viz .v3pt:focus circle,.f0viz .v3pt:hover circle{stroke:#fff;stroke-width:3}
.f0viz .v3ph{display:grid;gap:6px;margin-top:6px}
.f0viz .v3ph div{background:#0f1b29;border-radius:6px;padding:7px 10px;border-left:3px solid #3a516b}
.f0viz .v3ph .p{border-color:#ffc94d}.f0viz .v3ph .a{border-color:#55d0ff}.f0viz .v3ph .r{border-color:#6ee7a0}
.f0viz .v3ph small{display:block;color:#8fa3b8;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px}
.f0viz .v3ph i{color:#b9c8d8}`; document.head.appendChild(s); }

/* =====================================================================
   8 · BARRAS ELÉCTRICAS (021): fallo de un alternador y de los dos, con el flujo de corriente y qué equipos quedan
   Bimotor ligero genérico de 28 V (cada avión es distinto: manda su manual).
   ===================================================================== */
V.elec=(()=>{
const LD={main:[["Luces de aterrizaje y estrobos",9],["Calefacción del pitot",6],["Bomba de combustible eléctrica",4],["Flaps eléctricos",6]],ess:[["COM 1 / NAV 1",3],["Transpondedor",1.5],["PFD · horizonte",3],["Indicadores de motor",1]],avi:[["COM 2 / NAV 2",3],["GPS · MFD",4],["Piloto automático",3]]};
const CAP=15;   // Ah útiles de la batería de ejemplo
const QZ=[
 {q:"Falla <b>un</b> alternador. ¿Qué pasa con los equipos?",o:["Siguen todos: el otro alternador alimenta la barra principal (vigila la carga)","Se pierde la barra esencial","Todo pasa a la batería"],a:0,e:"El alternador que queda alimenta todas las barras y sigue cargando la batería. Vigila el amperímetro: si la carga supera lo que da un alternador, desconecta lo no esencial.",s:{st:1}},
 {q:"Fallan los <b>dos</b> alternadores. ¿Qué alimenta ahora los equipos?",o:["Solo la batería, durante un tiempo limitado","Los magnetos","Nada: se apaga todo al instante"],a:0,e:"La batería toma toda la carga y se descarga (amperímetro negativo). Hay que <b>desconectar cargas no esenciales</b> para ganar autonomía y aterrizar cuanto antes. Los magnetos solo alimentan el encendido del motor.",s:{st:2}},
 {q:"Fallo doble de alternadores: ¿qué <b>desconectas primero</b>?",o:["El interruptor de aviónica y las cargas no esenciales","La barra esencial","El master de la batería"],a:0,e:"Quitas lo que no necesitas (aviónica secundaria, luces, calefacción si no hay hielo) y mantienes la <b>barra esencial</b>: COM 1/NAV 1, transpondedor e instrumentos básicos.",s:{st:2}},
 {q:"El amperímetro marca <b>negativo</b>. ¿Qué significa?",o:["La batería se está descargando","La batería se está cargando","Hay un cortocircuito en la barra esencial"],a:0,e:"En un amperímetro de batería, negativo = <b>descarga</b>: la batería entrega más de lo que recibe. Positivo = se está cargando.",s:{st:2}},
 {q:"¿Por qué se apaga la aviónica (avionics master) para arrancar los motores?",o:["Para protegerla de los picos de tensión del arranque","Para ahorrar combustible","Porque lo exige el transpondedor"],a:0,e:"El motor de arranque provoca caídas y picos de tensión que pueden dañar la aviónica: se conecta después del arranque y se desconecta antes de parar.",s:{st:0}}];
return {t:"Barras eléctricas: fallo de alternador y fallo doble, con el flujo de corriente",
cap:"Esquema genérico de un bimotor ligero de 28 V con barra principal, esencial y de aviónica. Consumos de ejemplo y batería de 15 Ah útiles; el tiempo es orientativo (en la práctica la batería rinde menos, sobre todo en frío). Cada avión es distinto: manda su manual.",
init(el){
  const svg=`<svg viewBox="0 0 400 320" role="img" aria-label="Esquema eléctrico con alternadores, batería y barras"><rect width="400" height="320" fill="#12202f"/>
   <g font-family="system-ui,sans-serif" font-size="10.5" fill="#dfe8f1">
   <path class="v3w" data-w="a1" d="M52 62 H110"/><path class="v3w" data-w="a2" d="M52 124 H110"/><path class="v3w" data-w="bm" d="M54 258 H82 V148 H110"/>
   <path class="v3w" data-w="be" d="M54 272 H196 V246 H230"/><path class="v3w" data-w="me" d="M120 162 V222 H230"/><path class="v3w" data-w="ma" d="M130 46 H230"/>
   <circle cx="34" cy="62" r="17" fill="#1a2b3f" stroke="#5d6f84" stroke-width="2" data-s="a1"/><text x="34" y="66" text-anchor="middle" font-weight="700">ALT 1</text>
   <circle cx="34" cy="124" r="17" fill="#1a2b3f" stroke="#5d6f84" stroke-width="2" data-s="a2"/><text x="34" y="128" text-anchor="middle" font-weight="700">ALT 2</text>
   <rect x="14" y="250" width="40" height="30" rx="4" fill="#1a2b3f" stroke="#5d6f84" stroke-width="2" data-s="bt"/><text x="34" y="269" text-anchor="middle" font-weight="700">BAT</text>
   <rect class="v3bus" x="110" y="36" width="20" height="126" fill="#3d4b5c" data-b="main"/><text x="120" y="30" text-anchor="middle" font-weight="700" font-size="10">MAIN</text>
   <rect class="v3bus" x="230" y="30" width="20" height="44" fill="#3d4b5c" data-b="avi"/><text x="240" y="24" text-anchor="middle" font-size="9.5" font-weight="700">AVIONICS</text>
   <rect class="v3bus" x="230" y="206" width="20" height="50" fill="#3d4b5c" data-b="ess"/><text x="240" y="200" text-anchor="middle" font-size="9.5" font-weight="700">ESSENTIAL</text>
   <text x="62" y="56" font-size="9" fill="#8fa3b8">contactor</text><text x="140" y="40" font-size="9" fill="#8fa3b8">interruptor de aviónica</text><text x="60" y="292" font-size="9" fill="#8fa3b8">master BAT</text>
   <text x="140" y="92" font-size="9" fill="#8fa3b8">no esenciales</text>
   <g data-l="avi" transform="translate(258 40)"></g><g data-l="ess" transform="translate(258 216)"></g><g data-l="main" transform="translate(140 106)"></g>
   <g transform="translate(150 290)"><text data-am x="0" y="0" font-size="12" font-weight="700">Amperímetro +0 A</text><text data-v x="0" y="16" font-size="10.5" fill="#8fa3b8">Barra 28 V</text></g>
   <g transform="translate(14 8)"><rect data-wa1 width="40" height="15" rx="3" fill="#2a2a2a"/><text x="20" y="11" text-anchor="middle" font-size="9" font-weight="700">ALT 1</text><rect data-wa2 x="44" width="40" height="15" rx="3" fill="#2a2a2a"/><text x="64" y="11" text-anchor="middle" font-size="9" font-weight="700">ALT 2</text></g>
   </g></svg>`;
  const ctl=row("Situación",bt("data-st","0","Normal",1)+bt("data-st","1","Fallo de alternador 1")+bt("data-st","2","Fallo de los dos alternadores"))
   +row("Mandos",`<label class="v3k"><input type="checkbox" data-av checked> Interruptor de aviónica</label><label class="v3k"><input type="checkbox" data-sh> Desconectar cargas no esenciales</label>`+bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shellS(el,this.t,svg,ctl,this.cap); let st=0, av=true, sh=false, qm=false;
  const W=k=>u.q(`[data-w="${k}"]`), B=k=>u.q(`[data-b="${k}"]`);
  const draw=()=>{ const a1=st===0, a2=st!==2, alt=a1||a2, mainOn=true, aviOn=av&&mainOn, sum=(k,on)=>on?LD[k].reduce((s,l)=>s+l[1],0):0;
    const loadMain=sh?0:sum("main",true), load=loadMain+sum("ess",true)+sum("avi",aviOn), cap1=60, bat=alt?(load>(a1&&a2?2*cap1:cap1)?-(load-cap1):+4):-load;
    const set=(k,on,cls)=>{ const w=W(k); w.classList.toggle("on",!!on); w.classList.toggle("bat",cls==="bat"); w.classList.toggle("rev",cls==="rev"); };
    set("a1",a1); set("a2",a2); set("bm",true,alt?"rev":"bat"); set("be",!alt,"bat"); set("me",alt||true,alt?"":"bat"); set("ma",aviOn,alt?"":"bat");
    u.q('[data-s="a1"]').setAttribute("stroke",a1?"#ffc94d":"#ff5a4f"); u.q('[data-s="a2"]').setAttribute("stroke",a2?"#ffc94d":"#ff5a4f"); u.q('[data-s="bt"]').setAttribute("stroke",alt?"#6ee7a0":"#ff9f43");
    u.q("[data-wa1]").setAttribute("fill",a1?"#2a2a2a":"#d9302a"); u.q("[data-wa2]").setAttribute("fill",a2?"#2a2a2a":"#d9302a");
    B("main").setAttribute("fill","#ffc94d"); B("ess").setAttribute("fill","#ffc94d"); B("avi").setAttribute("fill",aviOn?"#ffc94d":"#3d4b5c");
    for(const k of ["main","ess","avi"]){ const g=u.q(`[data-l="${k}"]`), on=k==="avi"?aviOn:k==="main"?!sh:true;
      g.innerHTML=LD[k].map((l,i)=>`<g transform="translate(0 ${i*14})"><circle cx="4" cy="-3.5" r="3.6" fill="${on?"#6ee7a0":"#4a5563"}"/><text x="12" y="0" fill="${on?"#dfe8f1":"#6b7b8c"}" font-size="9.8">${l[0]}</text></g>`).join(""); }
    u.q("[data-am]").textContent=`Amperímetro ${bat>=0?"+":"−"}${Math.abs(Math.round(bat))} A`; u.q("[data-am]").setAttribute("fill",bat>=0?"#6ee7a0":"#ff8a80");
    const mins=!alt?Math.round(CAP/load*60*.8):0; u.q("[data-v]").textContent=alt?"Barra 28 V · cargando la batería":`Barra ≈ 24 V · batería: ≈ ${mins} min con ${f1(load)} A`;
    if(qm) return;
    u.out.innerHTML=st===0?`<b>Normal</b>: los dos alternadores alimentan la barra principal y cargan la batería (amperímetro positivo). Consumo ${f1(load)} A.`
     :st===1?`<b>Fallo del alternador 1</b>: se enciende su aviso y el <b>alternador 2</b> lo alimenta todo (${f1(load)} A de unos 60 A disponibles). No se pierde ningún equipo; reduce consumo si el amperímetro se acerca al límite.`
     :`<b>Fallo de los dos alternadores</b>: la <b>batería</b> alimenta todas las barras y se descarga (${f1(load)} A → unos <b>${mins} min</b>). ${sh&&!av?"Con la aviónica y lo no esencial desconectados solo queda la <b>barra esencial</b>: COM 1/NAV 1, transpondedor e instrumentos básicos. Aterriza en el aeródromo adecuado más cercano.":"Procedimiento típico: <b>apaga la aviónica y lo no esencial</b> para quedarte con la barra esencial y ganar tiempo."}`; };
  u.qa("[data-st]").forEach(b=>b.addEventListener("click",()=>{ st=+b.dataset.st; press(u,"data-st",st); draw(); }));
  u.q("[data-av]").addEventListener("change",e=>{ av=e.target.checked; draw(); }); u.q("[data-sh]").addEventListener("change",e=>{ sh=e.target.checked; draw(); });
  const Q=quiz(u,QZ,c=>{ st=c.s.st; press(u,"data-st",st); draw(); });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); draw(); } });
  draw();
}};
})();

/* =====================================================================
   9 · CIRCUITO VFR Y FRASEOLOGÍA (090): pulsa cada punto y practica la llamada en inglés y en español
   Aeródromo y matrícula de ejemplo: Torre «Example / Ejemplo», pista 27, circuito derecha, EC-XYZ (abreviado E-YZ).
   ===================================================================== */
V.rtcirc=(()=>{
const PT=[
 {k:"in",n:"1 · Entrada por N",xy:[64,60],p:["Example Tower, EC-XYZ, over November, 2 000 feet, information Bravo, for landing.","Ejemplo Torre, EC-XYZ, sobre November, 2.000 pies, información Bravo, para aterrizar."],a:["EC-XYZ, join right-hand downwind runway 27, QNH 1015.","EC-XYZ, incorpórese a viento en cola derecha pista 27, QNH 1015."],r:["Join right-hand downwind runway 27, QNH 1015, EC-XYZ.","Viento en cola derecha pista 27, QNH 1015, EC-XYZ."],n2:"Primera llamada: indicativo completo, posición, altitud, ATIS e intenciones. Colacionas pista, tramo y QNH."},
 {k:"dw",n:"2 · Viento en cola",xy:[200,62],p:["E-YZ, downwind.","E-YZ, viento en cola."],a:["E-YZ, number 2, follow the Cessna on base.","E-YZ, número 2, siga al Cessna en base."],r:["Number 2, traffic in sight, E-YZ.","Número 2, tráfico a la vista, E-YZ."],n2:"La torre ya te ha abreviado (E-YZ): desde ahora puedes abreviar tú. Si no ves el tráfico, dilo: «negative contact»."},
 {k:"bs",n:"3 · Base",xy:[340,140],p:["E-YZ, base.","E-YZ, base."],a:["E-YZ, report final.","E-YZ, notifique final."],r:["Wilco, E-YZ.","Cumpliré, E-YZ."],n2:"«Wilco» = entendido y cumpliré (ya incluye «roger»): no se dice «roger wilco»."},
 {k:"fn",n:"4 · Final",xy:[300,228],p:["E-YZ, final.","E-YZ, final."],a:["E-YZ, runway 27, wind 250 degrees 8 knots, cleared to land.","E-YZ, pista 27, viento 250 grados 8 nudos, autorizado a aterrizar."],r:["Runway 27, cleared to land, E-YZ.","Pista 27, autorizado a aterrizar, E-YZ."],n2:"Colacionas la pista y la autorización; el viento no es obligatorio. Si la torre dice «go around»: «Going around, E-YZ» (motor y al aire)."},
 {k:"vc",n:"5 · Pista libre",xy:[96,262],p:["E-YZ, runway vacated.","E-YZ, pista libre."],a:["E-YZ, taxi to the apron via Alpha.","E-YZ, ruede a plataforma por Alfa."],r:["Taxi to the apron via Alpha, E-YZ.","Ruedo a plataforma por Alfa, E-YZ."],n2:"Se notifica «runway vacated» cuando todo el avión ha pasado el punto de espera o las marcas de la calle de salida."}];
const QZ=[
 {q:"¿Qué <b>no puede faltar</b> en la primera llamada a la torre?",o:["Indicativo completo, posición, altitud, ATIS e intenciones","Solo el indicativo y «para aterrizar»","Indicativo abreviado y QNH"],a:0,e:"En el primer contacto el indicativo va <b>completo</b>, con posición, altitud, la letra del ATIS que tienes y lo que quieres hacer.",k:"in"},
 {q:"¿Cómo se abrevia EC-XYZ y <b>cuándo</b> puedes hacerlo?",o:["E-YZ, solo después de que lo abrevie la torre","XYZ, desde la primera llamada","EC-YZ, cuando quieras"],a:0,e:"Abreviatura OACI de una matrícula: el <b>primer carácter y al menos los dos últimos</b> (E-YZ). Solo la usas después de que la estación de tierra la haya usado.",k:"dw"},
 {q:"«Join right-hand downwind runway 27, QNH 1015». ¿Qué colacionas?",o:["Tramo, pista y QNH","Solo «roger»","Solo el QNH"],a:0,e:"Se colacionan siempre las instrucciones de pista y los reglajes del altímetro: «Join right-hand downwind runway 27, QNH 1015, EC-XYZ».",k:"in"},
 {q:"«Number 2, follow the Cessna on base». Lo tienes a la vista. ¿Respuesta?",o:["Number 2, traffic in sight, E-YZ","Roger, E-YZ","Cleared number 2, E-YZ"],a:0,e:"Colacionas tu número y confirmas que ves el tráfico. Si no lo ves: «negative contact».",k:"dw"},
 {q:"¿Qué significa «<b>wilco</b>»?",o:["He entendido y cumpliré","Repita","Afirmativo"],a:0,e:"<b>Wilco</b> (will comply): entendido y lo haré. Ya incluye «roger», así que «roger wilco» sobra.",k:"bs"},
 {q:"«Runway 27, wind 250 degrees 8 knots, cleared to land». ¿Colación correcta?",o:["Runway 27, cleared to land, E-YZ","Wind 250 degrees 8 knots, E-YZ","Cleared, E-YZ"],a:0,e:"Pista y autorización, siempre. El viento no hace falta colacionarlo.",k:"fn"},
 {q:"La torre te dice «E-YZ, go around». ¿Qué contestas?",o:["Going around, E-YZ","Roger, E-YZ","Wilco go around, E-YZ"],a:0,e:"Frase estándar: «<b>Going around</b>» (en español, «motor y al aire»), y lo haces de inmediato.",k:"fn"},
 {q:"Ya has salido de la pista. ¿Qué frase usas?",o:["Runway vacated","Runway free","Out of the runway"],a:0,e:"La fraseología OACI es «<b>runway vacated</b>» («pista libre» en español), cuando todo el avión ha pasado el punto de espera.",k:"vc"}];
return {t:"Circuito de tránsito: qué dices en cada punto (inglés y español)",
cap:"Aeródromo, ATIS y matrícula de ejemplo; circuito derecha a la pista 27. Fraseología OACI (Doc 9432) y su equivalente en español. Cada aeródromo publica sus puntos de notificación y procedimientos en el AIP: mandan siempre esos.",
init(el){
  const svg=`<svg viewBox="0 0 400 300" role="img" aria-label="Circuito de tránsito con los puntos de notificación"><rect width="400" height="300" fill="#2f4a2a"/>
   <g font-family="system-ui,sans-serif" font-size="11" fill="#e9f0f7">
   <rect x="80" y="246" width="230" height="16" fill="#3c4046"/><path d="M92 254 H298" stroke="#f4f4f0" stroke-dasharray="8 6"/><text x="288" y="258" font-size="9" font-weight="700" fill="#fff">27</text><text x="84" y="258" font-size="9" font-weight="700" fill="#fff">09</text>
   <path d="M120 262 L96 282 H40" stroke="#5a5f66" stroke-width="7" fill="none"/><text x="20" y="292" font-size="9.5" fill="#cfd8e3">plataforma</text>
   <path d="M310 230 H340 V70 H90 Q60 70 60 100 V230" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2" stroke-dasharray="4 4"/>
   <path d="M64 60 L200 62" fill="none" stroke="#9fe0ff" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#v3ar)"/>
   <path d="M200 62 H322 Q340 62 340 80 V210 Q340 228 322 228 H300" fill="none" stroke="#ffd24d" stroke-width="2.5" marker-end="url(#v3ar2)"/>
   <defs><marker id="v3ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#9fe0ff"/></marker><marker id="v3ar2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#ffd24d"/></marker></defs>
   <text x="18" y="40" font-size="10.5" fill="#9fe0ff">Punto VFR N</text><text x="188" y="50" font-size="10" fill="#ffd24d">viento en cola · downwind</text><text x="352" y="150" font-size="10" fill="#ffd24d" transform="rotate(90 352 150)">base</text><text x="250" y="222" font-size="10" fill="#ffd24d">final</text>
   <g transform="translate(372 24)"><circle r="14" fill="rgba(0,0,0,.3)"/><path d="M0 -11 L4 4 L0 1 L-4 4z" fill="#fff"/><text y="-16" text-anchor="middle" font-size="9" fill="#fff">N</text></g>
   ${PT.map((p,i)=>`<g class="v3pt" data-p="${i}" tabindex="0" role="button" aria-label="${p.n}" transform="translate(${p.xy[0]} ${p.xy[1]})"><circle r="11" fill="#12202f" stroke="#ffd24d" stroke-width="2"/><text y="4" text-anchor="middle" font-weight="800" font-size="11" fill="#ffd24d">${i+1}</text></g>`).join("")}
   </g></svg>`;
  const ctl=row("Idioma",bt("data-lg","0","English",1)+bt("data-lg","1","Español")+bt("data-lg","2","Los dos")+bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shellS(el,this.t,svg,ctl,this.cap); let cur=0, lg=0, qm=false;
  const hi=i=>u.qa("[data-p]").forEach(g=>{ const on=+g.dataset.p===i; g.querySelector("circle").setAttribute("fill",on?"#ffd24d":"#12202f"); g.querySelector("text").setAttribute("fill",on?"#12202f":"#ffd24d"); });
  const show=i=>{ cur=i; hi(i); if(qm) return; const p=PT[i], L=v=>lg===2?`${v[0]}<br><i>${v[1]}</i>`:v[lg];
    u.out.innerHTML=`<b>${p.n}</b><div class="v3ph"><div class="p"><small>Tú</small>${L(p.p)}</div><div class="a"><small>Torre</small>${L(p.a)}</div><div class="r"><small>Tú · colación</small>${L(p.r)}</div></div><span style="display:block;margin-top:6px;color:#b9c8d8">${p.n2}</span>`; };
  u.qa("[data-p]").forEach(g=>{ g.addEventListener("click",()=>show(+g.dataset.p)); g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); show(+g.dataset.p); } }); });
  u.qa("[data-lg]").forEach(b=>b.addEventListener("click",()=>{ lg=+b.dataset.lg; press(u,"data-lg",lg); show(cur); }));
  const Q=quiz(u,QZ,c=>{ hi(PT.findIndex(p=>p.k===c.k)); });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); show(cur); } });
  show(0);
}};
})();

/* =====================================================================
   10 · TRIÁNGULO DE VIENTOS (problema directo) Y COMBUSTIBLE DEL TRAMO (033)
   Rumbo verdadero + TAS + viento → derrota, deriva y GS. Avión de ejemplo de pistón: 32 L/h. Reservas según la política de combustible.
   ===================================================================== */
V.wtfuel=(()=>{
const wr=a=>((a%360)+360)%360, sg=a=>((a+540)%360)-180;
const tri=o=>{ const th=o.th*R, w=(o.wd+180)*R, ax=o.tas*Math.sin(th), ay=o.tas*Math.cos(th), wx=o.ws*Math.sin(w), wy=o.ws*Math.cos(w), gx=ax+wx, gy=ay+wy;
  const tr=wr(Math.atan2(gx,gy)/R), gs=Math.hypot(gx,gy), dr=sg(tr-o.th), b=(o.wd-o.th)*R, xw=o.ws*Math.sin(b), wca=Math.asin(cl(xw/o.tas,-1,1))/R, gs2=o.tas*Math.cos(wca*R)-o.ws*Math.cos(b);
  return {ax,ay,wx,wy,gx,gy,tr,gs,dr,wca,hdg:wr(o.th+wca),gs2,xw,hw:o.ws*Math.cos(b)}; };
const QZ=[
 {q:"Rumbo 090°, viento <b>de 360°</b>. ¿Hacia dónde te deriva?",o:["Hacia la derecha (deriva a estribor): derrota mayor que el rumbo","Hacia la izquierda","No hay deriva"],a:0,e:"El viento del Norte te empuja hacia el Sur: con rumbo 090 la derrota queda por encima de 090, deriva a la <b>derecha</b>. Para corregir, apuntas el morro <b>hacia el viento</b> (a la izquierda).",s:{th:90,wd:360,ws:25}},
 {q:"Para mantener la derrota con viento de la <b>derecha</b>, el WCA lleva el morro…",o:["A la derecha, hacia el viento","A la izquierda","Recto: solo cambia la GS"],a:0,e:"Siempre se corrige <b>hacia el viento</b>: viento de la derecha → rumbo mayor que la derrota.",s:{th:360,wd:60,ws:20}},
 {q:"Viento de cara puro de 20 kt con TAS 120 kt. ¿GS?",o:["100 kt","120 kt","140 kt"],a:0,e:"Sin componente cruzada no hay deriva y la GS es TAS − viento de cara = <b>100 kt</b>.",s:{th:270,wd:270,ws:20}},
 {q:"¿De dónde viene el viento «270/20»?",o:["Del Oeste, hacia el Este","Del Este, hacia el Oeste","Del Norte"],a:0,e:"En meteorología y en el triángulo el viento se da <b>de dónde viene</b>: 270/20 sopla del Oeste a 20 kt.",s:{th:360,wd:270,ws:20}},
 {q:"Combustible de <b>contingencia</b> según la política estándar:",o:["5 % del combustible del viaje (con un mínimo)","10 % del bloque","30 min siempre"],a:0,e:"Contingencia: el mayor entre el <b>5 % del trip</b> y 5 min de espera a 1.500 ft (hay reducciones con alternativo en ruta).",s:{}},
 {q:"Reserva final (<i>final reserve</i>) de un avión de <b>pistón</b> en VFR diurno de transporte:",o:["45 min","30 min","10 min"],a:0,e:"Pistón: <b>45 min</b>. Reactor: <b>30 min</b> en espera a 1.500 ft sobre el aeródromo de destino o alternativo, en ISA.",s:{eng:"p"}}];
return {t:"Triángulo de vientos y combustible del tramo: del rumbo a la derrota",
cap:"Problema directo del computador (CR-3 / E6B): con el rumbo verdadero, la TAS y el viento sale la derrota y la GS. Para el inverso (de la derrota deseada al rumbo) tienes la lámina de 061.01.06. Combustible de ejemplo: pistón 32 L/h; contingencia 5 % del trip (mínimo 5 min); alternativo a 120 kt; reserva final 45 min (pistón) o 30 min (reactor) al consumo de espera, aquí el mismo de crucero para simplificar; rodaje 5 L.",
init(el){
  const svg=`<svg viewBox="0 0 400 330" style="max-height:440px" role="img" aria-label="Triángulo de velocidades con rumbo, viento y derrota, y desglose del combustible"><rect width="400" height="330" fill="#12202f"/><g data-g font-family="system-ui,sans-serif" font-size="11"></g></svg>`;
  const ctl=row("",sl("th","Rumbo verdadero (TH)",0,359,60,1)+sl("tas","TAS",80,200,120,1)+sl("wd","Viento: de dónde viene",0,359,330,5)+sl("ws","Viento: intensidad",0,60,25,1))
   +row("Tramo",sl("d","Distancia",20,400,150,5)+sl("alt","Distancia al alternativo",0,150,40,5)+bt("data-e","p","Pistón · 45 min",1)+bt("data-e","j","Reactor · 30 min")+bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shellS(el,this.t,svg,ctl,this.cap), G=u.q("[data-g]"); const o={th:60,tas:120,wd:330,ws:25,d:150,alt:40,eng:"p"}; let qm=false; const FF=32;
  const U={th:"°",tas:" kt",wd:"°",ws:" kt",d:" NM",alt:" NM"};
  const draw=()=>{ const r=tri(o), cx=122, cy=140, k=104/Math.max(o.tas,r.gs,1), P=(x,y)=>[cx+x*k,cy-y*k];
    const ar=(x0,y0,x1,y1,c,w,dash)=>{ const a=P(x0,y0), b=P(x1,y1), an=Math.atan2(b[1]-a[1],b[0]-a[0]); return `<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" stroke="${c}" stroke-width="${w}" fill="none"${dash?` stroke-dasharray="${dash}"`:""}/><path d="M${b[0]} ${b[1]} L${b[0]-9*Math.cos(an-.4)} ${b[1]-9*Math.sin(an-.4)} L${b[0]-9*Math.cos(an+.4)} ${b[1]-9*Math.sin(an+.4)}z" fill="${c}"/>`; };
    const lab=(x0,y0,x1,y1,t,c,side)=>{ const a=P(x0,y0), b=P(x1,y1), mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2, L=Math.hypot(b[0]-a[0],b[1]-a[1])||1, nx=-(b[1]-a[1])/L*side, ny=(b[0]-a[0])/L*side, X=cl(mx+nx*16,40,205), Y=cl(my+ny*16,14,318);
      return `<text x="${X}" y="${Y+4}" fill="${c}" font-weight="700" font-size="10.5" text-anchor="middle" paint-order="stroke" stroke="#12202f" stroke-width="3">${t}</text>`; };
    let h=`<circle cx="${cx}" cy="${cy}" r="110" fill="none" stroke="rgba(160,190,220,.15)"/><text x="${cx}" y="${cy-114}" text-anchor="middle" fill="#8fa3b8" font-size="10">N</text><circle cx="${cx}" cy="${cy}" r="3" fill="#cfd8e3"/>`;
    const sd=r.dr>=0?1:-1;
    h+=ar(0,0,r.ax,r.ay,"#55d0ff",3.5)+ar(r.ax,r.ay,r.gx,r.gy,"#9fe0ff",2.5,"5 3")+ar(0,0,r.gx,r.gy,"#ffd24d",3.5);
    [["#55d0ff",`Rumbo y TAS · TH ${d3(o.th)}° · ${o.tas} kt`,""],["#9fe0ff",`Viento · W/V ${d3(o.wd)}°/${o.ws} kt`,"5 3"],["#ffd24d",`Derrota y GS · TR ${d3(r.tr)}° · ${Math.round(r.gs)} kt`,""]].forEach(([c,t,da],i)=>{ const yy=270+i*18; h+=`<path d="M8 ${yy-4} H30" stroke="${c}" stroke-width="3"${da?` stroke-dasharray="${da}"`:""}/><text x="36" y="${yy}" fill="${c}" font-weight="700" font-size="11">${t}</text>`; });
    // combustible
    const tt=o.d/r.gs*60, trip=FF*tt/60, cont=Math.max(trip*.05,FF*5/60), alt=FF*(o.alt/120), fr=FF*(o.eng==="p"?45:30)/60, taxi=5, tot=taxi+trip+cont+alt+fr;
    const parts=[["Rodaje",taxi,"#8fa3b8"],["Trip",trip,"#ffd24d"],["Conting.",cont,"#ff9f43"],["Altern.",alt,"#b78cf0"],[`Reserva ${o.eng==="p"?45:30}'`,fr,"#ff6b6b"]];
    const bx=262, by=30, bh=240, sc=bh/Math.max(tot,1); let y=by+bh; h+=`<text x="${bx+18}" y="${by-12}" text-anchor="middle" fill="#cfd8e3" font-weight="700" font-size="10.5">Combustible</text>`;
    let ly=1e9; for(const [n,v,c] of parts){ const hh=v*sc; y-=hh; h+=`<rect x="${bx}" y="${y}" width="36" height="${Math.max(0,hh-1)}" fill="${c}"/>`; const ty=Math.min(y+hh/2+4,ly-12); ly=ty; h+=`<text x="${bx+42}" y="${ty}" fill="#dfe8f1" font-size="10">${n} ${f1(v)} L</text>`; }
    h+=`<text x="${bx+18}" y="${by+bh+18}" text-anchor="middle" fill="#ffd24d" font-weight="800" font-size="12">${f1(tot)} L</text><text x="${bx+18}" y="${by+bh+32}" text-anchor="middle" fill="#8fa3b8" font-size="10">${Math.floor(tt/60)} h ${String(Math.round(tt%60)).padStart(2,"0")} min de vuelo</text>`;
    G.innerHTML=h;
    if(qm) return;
    const dr=r.dr; u.out.innerHTML=`Rumbo <b>${d3(o.th)}°</b> con viento ${d3(o.wd)}/${o.ws}: derrota <b>${d3(r.tr)}°</b>, deriva <b>${f1(Math.abs(dr))}° ${dr>.05?"a la derecha":dr<-.05?"a la izquierda":""}</b>, GS <b>${Math.round(r.gs)} kt</b>. Para volar ${d3(o.th)}° como <b>derrota</b> harías falta un WCA de <b>${f1(Math.abs(r.wca))}° ${r.wca>0?"a la derecha":r.wca<0?"a la izquierda":""}</b> (rumbo ${d3(r.hdg)}°, GS ${Math.round(r.gs2)} kt). Componentes: ${f0(Math.abs(r.xw))} kt cruzado ${r.xw>0?"de la derecha":"de la izquierda"}${Math.abs(r.hw)<.5?" y nada de cara ni de cola":` y ${f0(Math.abs(r.hw))} kt ${r.hw>0?"de cara":"de cola"}`}. Tramo de ${o.d} NM: <b>${Math.round(o.d/r.gs*60)} min</b>, trip ${f1(trip)} L, en total <b>${f1(tot)} L</b>.`; };
  const IN={}; for(const k of ["th","tas","wd","ws","d","alt"]){ IN[k]=u.q(`[data-k="${k}"]`); IN[k+"o"]=u.q(`[data-o="${k}"]`); IN[k].addEventListener("input",()=>{ o[k]=+IN[k].value; sync(); }); }
  const sync=()=>{ for(const k of ["th","tas","wd","ws","d","alt"]){ IN[k].value=o[k]; IN[k+"o"].textContent=(k==="th"||k==="wd"?d3(o[k]):o[k])+U[k]; } press(u,"data-e",o.eng); draw(); };
  u.qa("[data-e]").forEach(b=>b.addEventListener("click",()=>{ o.eng=b.dataset.e; sync(); }));
  const Q=quiz(u,QZ,c=>{ Object.assign(o,{tas:120},c.s); sync(); });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); draw(); } });
  sync();
}};
})();

/* =====================================================================
   11 · MOTOR DE PISTÓN Y HÉLICE DE PASO VARIABLE EN 3D (021)
   A: ciclo Otto con doble encendido (magnetos L y R), mezcla, detonación y preignición. B: pala con su triángulo de velocidades al 75 % del radio.
   ===================================================================== */
V.eng3d=(()=>{
const MIX={rich:["Rica",[120,170,255],"EGT baja y motor frío; algo menos de potencia y riesgo de bujías sucias."],best:["Máxima potencia",[110,220,170],"≈ 100 °F en el lado rico del pico de EGT: la mejor potencia."],lean:["Pobre",[255,210,90],"EGT cerca del pico; más eficiente, pero si te pasas el motor va áspero y pierde potencia."],det:["Detonación",[255,120,90],"Mezcla demasiado pobre, temperatura alta o combustible de octanaje bajo: el gas sin quemar explota de golpe."],pre:["Preignición",[255,90,160],"Un punto caliente (carbonilla, electrodo) enciende la mezcla ANTES de la chispa."]};
const QZ=[
 {q:"Prueba de magnetos: al pasar de BOTH a L las RPM caen un poco. ¿Por qué?",o:["Solo salta una bujía por cilindro y la combustión es más lenta","Porque se apaga un cilindro","Porque se empobrece la mezcla"],a:0,e:"Cada magneto alimenta una de las dos bujías de cada cilindro. Con una sola, el frente de llama tarda más: <b>pequeña caída de RPM</b> (en un C172, hasta 150 rpm y 50 de diferencia entre L y R).",t:"a",s:{mag:"L"}},
 {q:"Al seleccionar un solo magneto las RPM <b>no caen nada</b>. ¿Qué indica?",o:["Posible magneto sin masa (P-lead suelto): el motor puede arrancar solo","Que el motor está perfecto","Que la mezcla es rica"],a:0,e:"Ninguna caída es sospechosa: el magneto «apagado» puede no estar puesto a masa. Es peligroso: la hélice puede arrancar al moverla a mano.",t:"a",s:{mag:"R"}},
 {q:"¿Qué es la <b>detonación</b>?",o:["La combustión explosiva del gas que queda sin quemar, después de la chispa","El encendido antes de la chispa por un punto caliente","El petardeo en el escape"],a:0,e:"Detonación: tras la chispa, la mezcla del fondo explota de golpe. Causas: mezcla pobre, temperatura alta, mucha presión de admisión con pocas RPM, octanaje bajo. Remedio: <b>enriquecer</b>, reducir potencia, abrir cowl flaps.",t:"a",s:{mix:"det"}},
 {q:"¿Y la <b>preignición</b>?",o:["La mezcla se enciende antes de la chispa por un punto caliente","Una explosión después de la chispa","El fallo de un magneto"],a:0,e:"Preignición: un punto caliente (carbonilla incandescente, electrodo de bujía) enciende la mezcla <b>antes</b> de que salte la chispa. Puede acompañar a la detonación y dañar pistones.",t:"a",s:{mix:"pre"}},
 {q:"Hélice de velocidad constante: al aumentar la TAS, el gobernador…",o:["Aumenta el ángulo de pala (paso largo) para mantener RPM y ángulo de ataque","Reduce el ángulo de pala","No toca la pala: cambian las RPM"],a:0,e:"Más velocidad = más ángulo de avance. Para mantener las RPM y un ángulo de ataque eficaz, el gobernador <b>aumenta el paso</b>. Despegue: paso corto (fine) y altas RPM; crucero: paso largo (coarse).",t:"b",s:{tas:150}},
 {q:"¿Para qué sirve poner la hélice en <b>bandera</b>?",o:["Para que la pala quede de filo al viento y el motor parado frene lo mínimo","Para aumentar la tracción en el despegue","Para frenar en el aterrizaje"],a:0,e:"En bandera la pala queda a unos 85–90°, casi paralela a la corriente: la hélice deja de girar (no hace molinete) y la resistencia del motor parado es <b>mínima</b>. Clave en un bimotor con un motor parado.",t:"b",s:{pm:"f"}}];
return {t:"3D · Motor de pistón (ciclo Otto) y hélice de paso variable",
cap:"Motor en cámara lenta. Encendido adelantado unos 25° antes del punto muerto superior y válvulas que abren justo en los puntos muertos (simplificado). Hélice de ejemplo de 2 m de diámetro a 2.400 rpm; el gobernador busca unos 4° de ángulo de ataque al 75 % del radio, con tope de paso corto en 12°. Datos de la prueba de magnetos como los de un C172: cada avión tiene los suyos.",
init(el){
  const ctl=row("Vista",bt("data-t","a","A · Motor (4 tiempos)",1)+bt("data-t","b","B · Hélice")+bt("data-m","quiz","Ponme a prueba"))
   +row("Mezcla",Object.keys(MIX).map((k,i)=>bt("data-x",k,MIX[k][0],k==="best")).join(""),"data-pa")
   +row("Magnetos",bt("data-g","B","BOTH",1)+bt("data-g","L","L")+bt("data-g","R","R")+sl("rpm","RPM",1000,2700,2100,50),"data-pa2")
   +row("Hélice",bt("data-p","c","Velocidad constante",1)+bt("data-p","x","Paso fijo 22°")+bt("data-p","f","Bandera")+sl("tas","TAS",0,180,60,1),"data-pb hidden")+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Motor de pistón y hélice en 3D",ctl,this.cap);
  let tab="a", mix="best", mag="B", rpm=2100, pm="c", tas=60, ph=0, rot=0, qm=false, shake=0;
  const S=orbit(u.c,{yaw:-30,pit:14,ar:.6,hmin:300,hmax:470,pmin:-30,pmax:80,draw}); S.anim=true;
  const prop=()=>{ const om=(pm==="f"?0:2400)*2*Math.PI/60, V=tas*.5144, phi=pm==="f"?90:Math.atan2(V,om*.75)/R, beta=pm==="f"?88:pm==="x"?22:Math.max(12,Math.min(40,phi+4)); return {phi,beta,alpha:beta-phi,V}; };
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp, k=Math.min(W,H)*.32;
    x.setTransform(1,0,0,1,0,0); const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#16283d"); g.addColorStop(1,"#0b1522"); x.fillStyle=g; x.fillRect(0,0,W,H);
    const L=(pts,c,w,a)=>{ x.globalAlpha=a==null?1:a; x.strokeStyle=c; x.lineWidth=(w||1)*d; x.beginPath(); pts.forEach((p,i)=>{ const q=S.P(p); i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]); }); x.stroke(); x.globalAlpha=1; };
    const ring=(y,r,n,z0)=>Array.from({length:(n||32)+1},(_,i)=>{ const a=i/(n||32)*2*Math.PI; return [r*Math.cos(a),y,r*Math.sin(a)+(z0||0)]; });
    const fillQ=(pts,c,a)=>{ const q=pts.map(S.P); x.globalAlpha=a==null?1:a; x.fillStyle=c; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); x.globalAlpha=1; };
    if(tab==="a"){ const sh=shake>0?(Math.random()-.5)*6*d*shake:0; shake=Math.max(0,shake-dt*2);
      S.cam(k,W*.42+sh,H*.55,[0,.45,0],8);
      ph=(ph+dt*360*(.25+rpm/4200))%720; const th=ph%360*R, rc=.35, Lr=1.0, cy0=-.6, pin=[rc*Math.sin(th),cy0+rc*Math.cos(th),0], py=cy0+rc*Math.cos(th)+Math.sqrt(Lr*Lr-(rc*Math.sin(th))**2), top=py+.2, HEAD=1.3;
      const st=ph<180?0:ph<360?1:ph<540?2:3, sp=ph>=335&&ph<375, fire=ph>=355&&ph<470, det=mix==="det"&&ph>=380&&ph<420, pre=mix==="pre"&&ph>=290&&ph<360;
      if(det&&ph<386) shake=1;
      // gas en la cámara
      const mc=MIX[mix][1]; let gc=[mc[0]*.8,mc[1]*.85,mc[2]],ga=.28;
      if(st===1) { gc=[mc[0]*.9+60*(ph-180)/180,mc[1]*.8,mc[2]*.8]; ga=.32; } if(st===2){ const f=Math.max(0,1-(ph-360)/180); gc=[255,150+60*f,60]; ga=.25+.45*f; } if(st===3){ gc=[150,150,160]; ga=.22; } if(pre){ gc=[255,90,160]; ga=.5; }
      const ex=S.eye[0], ez=S.eye[2], en=Math.hypot(ex,ez)||1, sx=-ez/en, sz=ex/en;   // silueta del cilindro vista desde la cámara
      const side=(y0,y1,r)=>{ r=r||.5; const a=S.P([-sx*r,y0,-sz*r]), b=S.P([sx*r,y0,sz*r]), c=S.P([sx*r,y1,sz*r]), e=S.P([-sx*r,y1,-sz*r]); return [a,b,c,e]; };
      { const q=side(top,HEAD); x.globalAlpha=ga; x.fillStyle=`rgb(${gc.map(v=>Math.min(255,v)|0)})`; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); x.globalAlpha=1; }
      // cilindro transparente
      for(const y of [.2,.6,1.0,HEAD]) L(ring(y,.52),"#9fb7d4",1,.45); for(let i=0;i<8;i++){ const a=i/8*2*Math.PI; L([[.52*Math.cos(a),.2,.52*Math.sin(a)],[.52*Math.cos(a),HEAD,.52*Math.sin(a)]],"#9fb7d4",1,.3); }
      fillQ(ring(HEAD+.12,.6,24),"#3a4a5c",.85);
      // válvulas: admisión (izq.) abierta en el tiempo 1, escape (dcha.) en el 4
      const lift=(on,f)=>on?Math.sin(Math.PI*f)*.13:0, li=lift(st===0,ph/180), le=lift(st===3,(ph-540)/180);
      for(const [vx,lf,c,lb] of [[-.24,li,"#55d0ff","admisión"],[.24,le,"#c0c6cf","escape"]]){ L([[vx,HEAD+.35,0],[vx,HEAD-lf,0]],"#cfd8e3",3); fillQ(ring(HEAD-lf,.11,16,0).map(p=>[p[0]+vx,p[1],p[2]]),c,.95); const q=S.P([vx,HEAD+.42,0]); tag(x,q[0],q[1],lb+(lf>.01?" · abierta":""),{dp:d,fs:10.5,al:"c",c}); }
      // bujías (doble encendido)
      for(const [pz,m] of [[-.3,"L"],[.3,"R"]]){ L([[0,HEAD+.25,pz],[0,HEAD-.02,pz]],"#e9e3d3",4); const on=sp&&(mag==="B"||mag===m); if(on){ const q=S.P([0,HEAD-.04,pz]); const gr=x.createRadialGradient(q[0],q[1],0,q[0],q[1],22*d); gr.addColorStop(0,"rgba(190,230,255,1)"); gr.addColorStop(1,"rgba(120,180,255,0)"); x.fillStyle=gr; x.beginPath(); x.arc(q[0],q[1],22*d,0,7); x.fill(); } const q=S.P([0,HEAD+.3,pz]); tag(x,q[0],q[1],"bujía "+m,{dp:d,fs:10,al:"c",c:"#e9e3d3"}); }
      if(pre){ const q=S.P([-.35,HEAD-.1,.2]); x.fillStyle="#ff4fa0"; x.beginPath(); x.arc(q[0],q[1],5*d,0,7); x.fill(); tag(x,q[0]-8*d,q[1]-12*d,"punto caliente",{dp:d,fs:10.5,al:"r",c:"#ff9fd0"}); }
      if(det){ const q=S.P([.35,top+.15,-.2]); x.strokeStyle="#fff3c0"; x.lineWidth=2*d; for(let i=0;i<7;i++){ x.beginPath(); x.moveTo(q[0],q[1]); x.lineTo(q[0]+(Math.random()-.5)*60*d,q[1]+(Math.random()-.5)*40*d); x.stroke(); } tag(x,q[0]+10*d,q[1]-16*d,"¡DETONACIÓN!",{dp:d,fs:12,c:"#fff",bg:"rgba(200,40,30,.9)",w:800}); }
      // pistón, biela y cigüeñal
      fillQ(ring(top,.48,24),"#b9c2cc"); { const q=side(top,top-.3,.48); x.fillStyle="#8d97a3"; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); fillQ(ring(top-.3,.48,24),"#8d97a3"); fillQ(ring(top,.48,24),"#c3ccd6"); } L(ring(top,.48,24),"#6b7684",1.2);
      L([[0,py,0],pin],"#cfd8e3",7); L([[0,cy0,-.25],[0,cy0,.25]],"#55606d",9); fillQ(ring(0,.42,24).map(p=>[p[0],cy0+p[2]*0+p[0]*0+(p[2]),.2]).map((p,i,a)=>p),"#3d4855",.0);
      const cw=Array.from({length:25},(_,i)=>{ const a=i/24*2*Math.PI; return [.42*Math.sin(a),cy0+.42*Math.cos(a),.12]; }); fillQ(cw,"#55606d",.9); L([[0,cy0,.13],[pin[0],pin[1],.13]],"#cfd8e3",5); { const q=S.P(pin); x.fillStyle="#ffd24d"; x.beginPath(); x.arc(q[0],q[1],5*d,0,7); x.fill(); }
      // rótulo del tiempo
      const NM=["1 · Admisión · Intake","2 · Compresión · Compression","3 · Explosión · Power","4 · Escape · Exhaust"]; tag(x,W/2,18*d,NM[st],{dp:d,fs:13,al:"c",c:"#ffd24d",w:800});
      // panel: RPM, EGT y CHT
      const drop=mag==="B"?0:mag==="L"?100:115, rp=rpm-drop, egt={rich:.45,best:.75,lean:.9,det:.85,pre:.8}[mix], cht={rich:.45,best:.6,lean:.7,det:.95,pre:.95}[mix], bx=W-150*d, by=40*d;
      x.fillStyle="rgba(8,16,28,.8)"; x.fillRect(bx,by,140*d,92*d); x.font=`700 ${12*d}px system-ui,sans-serif`; x.fillStyle="#e9f0f7"; x.textBaseline="alphabetic"; x.fillText(`${rp} rpm${drop?` (−${drop})`:""}`,bx+8*d,by+18*d);
      [["EGT",egt,"#ffb08a"],["CHT",cht,cht>.9?"#ff6b6b":"#ffd24d"]].forEach(([n,v,c],i)=>{ const y=by+36*d+i*26*d; x.font=`600 ${10.5*d}px system-ui,sans-serif`; x.fillStyle="#cfd8e3"; x.fillText(n,bx+8*d,y); x.fillStyle="#24364b"; x.fillRect(bx+40*d,y-9*d,90*d,9*d); x.fillStyle=c; x.fillRect(bx+40*d,y-9*d,90*d*v,9*d); });
    } else {
      S.cam(k*.95,W*.4,H*.52,[0,0,0],8); const P=prop(); rot=(rot+dt*(pm==="f"?0:4))%(2*Math.PI);
      // buje y cono
      fillQ(Array.from({length:25},(_,i)=>{ const a=i/24*2*Math.PI; return [0,.16*Math.cos(a),.16*Math.sin(a)]; }),"#cfd8e3");
      L([[0,0,0],[.5,0,0]],"#6b7684",3); { const q=S.P([.55,0,0]); tag(x,q[0],q[1],"avance · TAS →",{dp:d,fs:10.5,c:"#9fe0ff"}); }
      // palas torsionadas (más ángulo en la raíz)
      const items=[]; for(const sg of [0,Math.PI]){ const ra=rot+sg; for(let i=0;i<10;i++){ const r0=.18+i*.1, r1=r0+.1, bl=r=>{ const tw=P.beta+(pm==="f"?0:Math.atan2(P.V||1,(2400*2*Math.PI/60)*Math.max(r,.05)*1)/R-P.phi); return (pm==="f"?88:Math.max(P.beta,Math.min(80,tw)))*R; };
          const sec=(r)=>{ const b=bl(r), c=.11*(1.1-.4*r), ca=Math.cos(ra), sa=Math.sin(ra); const pts=[[-c*Math.sin(b),r,c*Math.cos(b)],[c*Math.sin(b),r,-c*Math.cos(b)]]; return pts.map(p=>[p[0],p[1]*ca-p[2]*sa,p[1]*sa+p[2]*ca]); };
          const A=sec(r0), B=sec(r1), q=[A[0],B[0],B[1],A[1]], pq=q.map(S.P); items.push({z:pq.reduce((s,p)=>s+p[2],0)/4,q:pq,c:i===5?"#ffd24d":"#2f3a46"}); } }
      items.sort((a,b)=>a.z-b.z).forEach(it=>{ x.fillStyle=it.c; x.beginPath(); it.q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); x.strokeStyle="rgba(200,210,220,.4)"; x.lineWidth=.6*d; x.stroke(); });
      // triángulo de velocidades al 75 % del radio
      const bw=Math.min(W*.36,230*d), bh=bw*.85, bx=W-bw-10*d, by=10*d; x.fillStyle="rgba(8,16,28,.85)"; x.fillRect(bx,by,bw,bh);
      const ox=bx+bw*.15, oy=by+bh*.82, sc=bw*.7/190, om=(pm==="f"?0:2400*2*Math.PI/60*.75);
      const vec=(dx,dy,c,lab)=>{ x.strokeStyle=c; x.fillStyle=c; x.lineWidth=2.4*d; x.beginPath(); x.moveTo(ox,oy); x.lineTo(ox+dx,oy-dy); x.stroke(); if(lab){ x.font=`600 ${10*d}px system-ui,sans-serif`; x.fillText(lab,ox+dx+4*d,oy-dy); } };
      vec(om*sc,0,"#cfd8e3","giro ωr"); vec(0,P.V*sc,"#9fe0ff","TAS"); vec(om*sc,P.V*sc,"#55d0ff","");
      const cb=P.beta*R, Lc=bw*.6; x.strokeStyle="#ffd24d"; x.lineWidth=4*d; x.beginPath(); x.moveTo(ox,oy); x.lineTo(ox+Lc*Math.cos(cb),oy-Lc*Math.sin(cb)); x.stroke();
      x.font=`700 ${10.5*d}px system-ui,sans-serif`; x.fillStyle="#ffd24d"; x.fillText(`β ${f1(P.beta)}° (cuerda)`,ox+Lc*Math.cos(cb)-60*d,oy-Lc*Math.sin(cb)-6*d);
      x.fillStyle="#e9f0f7"; x.fillText(`φ ${f1(P.phi)}° · α ${f1(P.alpha)}°`,bx+8*d,by+16*d);
      tag(x,W/2,18*d,pm==="f"?"BANDERA · feather":pm==="x"?"PASO FIJO":"VELOCIDAD CONSTANTE · gobernador",{dp:d,fs:13,al:"c",c:"#ffd24d",w:800}); }
    return true; }
  const say=()=>{ if(qm) return; if(tab==="a"){ const m=MIX[mix]; u.out.innerHTML=`<b>${mix==="det"||mix==="pre"?m[0]:"Mezcla "+m[0].toLowerCase()}</b>: ${m[2]} ${mix==="det"?"Remedio: <b>enriquecer</b>, reducir potencia y abrir cowl flaps.":mix==="pre"?"Puede llevar a detonación y dañar el pistón; reducir potencia y enriquecer.":""} Magnetos: <b>${mag==="B"?"BOTH":mag}</b>${mag==="B"?" (las dos bujías de cada cilindro)":` → solo salta la bujía ${mag}: caída de ${mag==="L"?100:115} rpm, dentro del límite de ejemplo (150 rpm y 50 de diferencia).`}`; }
    else { const P=prop(); u.out.innerHTML=pm==="f"?`<b>Bandera</b>: pala a ${f1(P.beta)}°, de filo al viento. La hélice se para y el motor muerto frena lo mínimo.`:`TAS <b>${tas} kt</b> → ángulo de avance φ = <b>${f1(P.phi)}°</b> al 75 % del radio. Ángulo de pala β = <b>${f1(P.beta)}°</b> y ángulo de ataque α = β − φ = <b>${f1(P.alpha)}°</b>. ${pm==="c"?(P.beta<=12.01?"En el tope de <b>paso corto (fine)</b>: despegue y ascenso, máximas RPM.":"El gobernador <b>aumenta el paso</b> con la velocidad para mantener las RPM y un α eficaz."):P.alpha>12?"Con paso fijo y poca velocidad el α es enorme: la pala trabaja casi en pérdida (poca tracción en el despegue).":P.alpha<1?"Con paso fijo y mucha velocidad el α se acerca a cero: la hélice apenas tracciona (y las RPM se disparan).":"Paso fijo: solo es eficaz en una velocidad, la de diseño."}`; } };
  const setTab=t=>{ tab=t; press(u,"data-t",t); u.q("[data-pa]").hidden=t!=="a"; u.q("[data-pa2]").hidden=t!=="a"; u.q("[data-pb]").hidden=t!=="b"; S.go(t==="a"?-30:-40,t==="a"?14:12); say(); };
  u.qa("[data-t]").forEach(b=>b.addEventListener("click",()=>{ if(qm){ qm=false; press(u,"data-m","x"); Q.stop(); } setTab(b.dataset.t); }));
  u.qa("[data-x]").forEach(b=>b.addEventListener("click",()=>{ mix=b.dataset.x; press(u,"data-x",mix); say(); }));
  u.qa("[data-g]").forEach(b=>b.addEventListener("click",()=>{ mag=b.dataset.g; press(u,"data-g",mag); say(); }));
  u.qa("[data-p]").forEach(b=>b.addEventListener("click",()=>{ pm=b.dataset.p; press(u,"data-p",pm); say(); }));
  for(const [kk,suf] of [["rpm"," rpm"],["tas"," kt"]]){ const I=u.q(`[data-k="${kk}"]`), O=u.q(`[data-o="${kk}"]`); O.textContent=I.value+suf; I.addEventListener("input",()=>{ if(kk==="rpm") rpm=+I.value; else tas=+I.value; O.textContent=I.value+suf; say(); }); }
  const Q=quiz(u,QZ,c=>{ setTab(c.t); const s0=c.s; if(s0.mag){ mag=s0.mag; press(u,"data-g",mag); } if(s0.mix){ mix=s0.mix; press(u,"data-x",mix); } if(s0.tas!=null){ tas=s0.tas; u.q('[data-k="tas"]').value=tas; u.q('[data-o="tas"]').textContent=tas+" kt"; } if(s0.pm){ pm=s0.pm; press(u,"data-p",pm); } });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); say(); } });
  setTab("a");
}};
})();

/* =====================================================================
   12 · ESTELA TURBULENTA EN 3D (070): los dos torbellinos bajan, se separan junto al suelo y derivan con el viento cruzado
   Metros reales. Pista de 3.000 m y 45 m de ancho; se aproxima hacia +x; el viento cruzado positivo sopla de izquierda a derecha (z+).
   ===================================================================== */
V.wake3d=(()=>{
const CAT={H:{n:"Heavy (pesado)",b:62,w0:2.4,life:150},M:{n:"Medium (medio)",b:34,w0:1.6,life:100}};
const QZ=[
 {q:"¿Cuándo genera un avión la estela <b>más fuerte</b>?",o:["Pesado, limpio (sin flaps) y lento","Ligero, con flaps y rápido","Con viento fuerte"],a:0,e:"La intensidad crece con el peso y el C<sub>L</sub>: <b>heavy, clean, slow</b>. Por eso el despegue y la aproximación (lentos) son los momentos críticos.",s:{m:"l",cw:0}},
 {q:"Aterrizas detrás de un <b>heavy</b>. ¿Qué trayectoria evita su estela?",o:["Por encima de su senda y tomando más allá de su punto de toma","Por debajo de su senda y tomando antes","Igual que la suya"],a:0,e:"Los torbellinos bajan desde su trayectoria: quédate <b>por encima</b> y toma <b>más allá</b> de donde tomó él, porque al tocar deja de generarlos.",s:{m:"l",cw:0}},
 {q:"Despegas detrás de un <b>heavy</b> que acaba de despegar. ¿Qué haces?",o:["Rotar antes de su punto de rotación y subir por encima de su trayectoria","Rotar después de su punto de rotación","Despegar enseguida y quedarte bajo"],a:0,e:"Sus torbellinos empiezan donde rotó: <b>despega antes</b> de ese punto y sube <b>por encima</b> de su trayectoria (o espera la separación de tiempo).",s:{m:"t",cw:0}},
 {q:"¿Qué viento cruzado es el <b>más peligroso</b> en la pista?",o:["Uno flojo, de unos 3–5 kt","Uno fuerte, de más de 15 kt","La calma total"],a:0,e:"Junto al suelo cada torbellino se aparta del eje a unos 2–3 kt. Un cruzado flojo de 3–5 kt frena el de <b>barlovento</b> y lo deja <b>quieto sobre la pista</b>; uno fuerte los barre a los dos.",s:{m:"l",cw:3}},
 {q:"¿Cómo se mueven los torbellinos después de formarse?",o:["Bajan unos 300–500 ft/min y se estabilizan 500–900 ft por debajo","Suben por encima del avión","Se quedan a la misma altura"],a:0,e:"Bajan a unos <b>300–500 ft/min</b> hasta unos <b>500–900 ft</b> por debajo de la trayectoria; cerca del suelo se separan lateralmente y se disipan en uno a tres minutos.",s:{m:"l",cw:0}}];
const MESH=(()=>{ const f=[], L=60, w=3.2; const q=[[0,w,0],[0,0,w],[0,-w,0],[0,0,-w]];
  for(let i=0;i<4;i++){ const a=q[i], b=q[(i+1)%4]; f.push([[L*.5,0,0],vadd(a,[L*.32,0,0]),vadd(b,[L*.32,0,0])]); f.push([vadd(a,[L*.32,0,0]),vadd(a,[-L*.35,0,0]),vadd(b,[-L*.35,0,0]),vadd(b,[L*.32,0,0])]); f.push([vadd(a,[-L*.35,0,0]),[-L*.5,1,0],vadd(b,[-L*.35,0,0])]); }
  for(const s of [1,-1]){ f.push([[6,-1,0],[-8,-1,31*s],[-13,-1,31*s],[-9,-1,0]]); f.push([[-22,1,0],[-27,1,10*s],[-29,1,10*s],[-28,1,0]]); } f.push([[-21,2,0],[-28,13,0],[-30,13,0],[-28,2,0]]); return f; })();
return {t:"3D · Estela turbulenta: torbellinos de punta de plano al aterrizar y al despegar",
cap:"Modelo simplificado con tiempo acelerado; altura y distancias laterales exageradas ×4 para que se vean. Los torbellinos bajan unos 300–500 ft/min, frenan junto al suelo (efecto suelo) y allí se separan a unos 2–3 kt cada uno; el viento cruzado los arrastra a los dos. Separación entre torbellinos ≈ 3/4 de la envergadura. Los mínimos de separación por estela los fija el ATC (OACI Doc 4444).",
init(el){
  const ctl=row("Maniobra",bt("data-mv","l","Aterrizaje detrás",1)+bt("data-mv","t","Despegue detrás")+bt("data-c","H","Heavy",1)+bt("data-c","M","Medium")+bt("data-m","quiz","Ponme a prueba"))
   +row("",sl("cw","Viento cruzado (− desde la derecha · + desde la izquierda)",-10,10,3,1)+`<button type="button" data-rs>⟲ Repetir el paso</button>`)
   +row("Vista",bt("data-v","34","3/4",1)+bt("data-v","be","Desde atrás, en el eje")+bt("data-v","si","Lateral")+bt("data-v","to","Planta"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shell(el,this.t,"Escena 3D con un avión pesado y sus torbellinos de estela sobre la pista",ctl,this.cap);
  let mv="l", cat="H", cw=3, T=0, view="34", qm=false;
  const V0=70, GS=3*R, TD=350, ROT=1700, CL=7*R, X0=-1600, EV=4, EZ=4;
  const path=x=>mv==="l"?Math.max(0,(TD-x)*Math.tan(GS)):Math.max(0,(x-ROT)*Math.tan(CL));
  const S=orbit(u.c,{yaw:-58,pit:22,ar:.6,hmin:300,hmax:480,pmin:2,pmax:89,draw}); S.anim=true;
  function draw(S,dt,t){ const x=S.x, W=S.W, H=S.H, d=S.dp, C=CAT[cat];
    T+=dt*6; const xa=mv==="l"?X0+V0*T:(T<25?.5*(V0/25)*T*T:.5*V0*25+V0*(T-25)), Tend=mv==="l"?(TD-X0)/V0+C.life:25+(3000-ROT)/V0+C.life; if(T>Tend) T=0;
    const span=3600, tgt=view==="be"?[mv==="l"?-200:ROT+300,160,0]:[mv==="l"?200:ROT+300,200,0], k=Math.min(W,H*1.6)/span*(view==="be"?1.9:1.15);
    S.cam(k,W*.5,H*.6,tgt,span*6); const P0=S.P, P=p=>P0([p[0],p[1]*EV,p[2]*EZ]);
    x.setTransform(1,0,0,1,0,0); const sk=x.createLinearGradient(0,0,0,H); sk.addColorStop(0,"#5d8fc4"); sk.addColorStop(1,"#d7e3ea"); x.fillStyle=sk; x.fillRect(0,0,W,H);
    const fillP=(pts,c,a)=>{ const q=pts.map(P); x.globalAlpha=a==null?1:a; x.fillStyle=c; x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); x.globalAlpha=1; };
    const ln=(pts,c,w,dash,a)=>{ const q=pts.map(P); x.globalAlpha=a==null?1:a; x.strokeStyle=c; x.lineWidth=(w||1)*d; x.setLineDash(dash?dash.map(v=>v*d):[]); x.beginPath(); q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke(); x.setLineDash([]); x.globalAlpha=1; };
    const lb=(p,tt,c)=>{ const q=P(p); tag(x,q[0],q[1],tt,{dp:d,fs:11,al:"c",c:c||"#fff"}); };
    fillP([[-1800,0,-320],[3200,0,-320],[3200,0,320],[-1800,0,320]],"#7d9a5b"); x.globalAlpha=.25; for(let gx=-1800;gx<=3200;gx+=500) ln([[gx,0,-320],[gx,0,320]],"#4d6b35",1); x.globalAlpha=1;
    fillP([[0,0,-22.5],[3000,0,-22.5],[3000,0,22.5],[0,0,22.5]],"#3c4046"); ln([[30,.2,0],[2970,.2,0]],"#f4f4f0",1,[6,6]);
    for(let i=-3;i<=3;i++) ln([[2,0,i*6],[40,0,i*6]],"#f4f4f0",1.5);
    // trayectorias: la del precedente (roja) y la tuya recomendada (verde)
    const pr=[], my=[]; for(let xx=X0;xx<=3000;xx+=50){ pr.push([xx,path(xx),0]); }
    if(mv==="l"){ for(let xx=X0;xx<=TD+500;xx+=50) my.push([xx,Math.max(0,(TD+450-xx)*Math.tan(3.4*R)),0]); } else { for(let xx=0;xx<=3000;xx+=50) my.push([xx,Math.max(0,(xx-1100)*Math.tan(9*R)),0]); }
    ln(pr,"#ff6b6b",2,[8,5]); ln(my,"#6ee7a0",3);
    if(mv==="l"){ ln([[TD,0,-30],[TD,0,30]],"#ff6b6b",3); lb([TD,0,-45],"su toma","#ffb0b0"); ln([[TD+450,0,-30],[TD+450,0,30]],"#6ee7a0",3); lb([TD+450,0,45],"tu toma: más allá","#b6f5cf"); lb([-1100,(TD+1550)*Math.tan(3.4*R)+25,0],"tú: por encima de su senda","#b6f5cf"); }
    else { ln([[ROT,0,-30],[ROT,0,30]],"#ff6b6b",3); lb([ROT,0,-45],"su rotación","#ffb0b0"); ln([[1100,0,-30],[1100,0,30]],"#6ee7a0",3); lb([1100,0,45],"tú: rota antes","#b6f5cf"); lb([2600,(2600-1100)*Math.tan(9*R)+25,0],"tú: por encima de su trayectoria","#b6f5cf"); }
    // torbellinos: nacen en su trayectoria cuando vuela, bajan, frenan en el suelo, se separan y derivan
    const cwm=cw*.5144, out=1.3, items=[];
    const gx0=mv==="l"?X0:ROT, gx1=Math.min(xa,mv==="l"?TD:3000);
    for(let gx=gx0;gx<=gx1;gx+=90){ const tg=mv==="l"?(gx-X0)/V0:25+(gx-ROT)/V0, age=T-tg; if(age<0||age>C.life) continue; const y0=path(gx), sink=C.w0, hmin=C.b*.5;
      const tfall=Math.max(0,(y0-hmin)/sink), yv=Math.max(hmin,y0-sink*Math.min(age,Math.min(tfall,130/sink*1.0)))-0, ground=yv<=hmin+1, tg2=Math.max(0,age-tfall);
      const st=1-age/C.life;
      for(const sd of [-1,1]){ const z=sd*C.b*.39+cwm*age+(ground?sd*out*tg2:0), cx=gx, cy=Math.max(hmin*.6,yv), r=C.b*.12, rot=sd*(t*6+gx*.03);
        for(let j=0;j<8;j++){ const a=rot+j/8*2*Math.PI; const p=[cx+j*6,cy+r*Math.sin(a)/EV*2.2,z+r*Math.cos(a)/EZ*2.2], q=P(p); items.push({z:q[2],f:()=>{ x.fillStyle=`rgba(200,110,255,${.85*st})`; x.beginPath(); x.arc(q[0],q[1],Math.max(1.4,2.2*d),0,7); x.fill(); }}); } } }
    items.sort((a,b)=>a.z-b.z).forEach(o=>o.f());
    // el avión precedente
    if(mv==="l"?xa<TD+600:true){ const ax=Math.min(xa,mv==="l"?TD+600:3500), ay=path(ax), pit=mv==="l"?-3*R:(ax>ROT?CL:0), c=Math.cos(pit), sn=Math.sin(pit);
      const K=2.6, fs=MESH.map(f=>{ const w=f.map(p=>[ax+(p[0]*c-p[1]*sn)*K,(ay+8)*EV+(p[0]*sn+p[1]*c)*K,p[2]*K]), q=w.map(P0); return {q,z:q.reduce((s,p)=>s+p[2],0)/q.length}; }).sort((a,b)=>a.z-b.z);
      for(const f of fs){ x.fillStyle="#e3e8ef"; x.strokeStyle="rgba(40,50,60,.35)"; x.lineWidth=.6*d; x.beginPath(); f.q.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath(); x.fill(); x.stroke(); }
      lb([ax,ay+8+60/EV*2.6,0],C.n,"#ffffff"); }
    tag(x,10*d,18*d,`t = ${Math.round(Math.max(0,T-(mv==="l"?(TD-X0)/V0:25)))} s tras ${mv==="l"?"su toma":"su despegue"} · viento cruzado ${Math.abs(cw)} kt`,{dp:d,fs:11.5,c:"#ffd24d"});
    return true; }
  const say=()=>{ if(qm) return; const cwk=Math.abs(cw), upw=Math.abs(2.5-cwk);
    u.out.innerHTML=`${mv==="l"?"<b>Aterrizaje detrás de un "+CAT[cat].n.split(" ")[0]+"</b>: quédate <b>por encima</b> de su senda (verde) y toma <b>más allá</b> de su punto de toma, donde deja de generar torbellinos.":"<b>Despegue detrás de un "+CAT[cat].n.split(" ")[0]+"</b>: <b>rota antes</b> de su punto de rotación y sube <b>por encima</b> de su trayectoria; si no puedes, espera la separación."} `+
      (cwk===0?"Sin viento cruzado los dos torbellinos se separan del eje a unos 2–3 kt y salen de la pista.":cwk<=5?`<b class="bad">Trampa clásica</b>: con ${cwk} kt de cruzado el torbellino de <b>barlovento</b> casi no se mueve (deriva neta ≈ ${f1(upw)} kt) y se queda <b>sobre la pista</b>.`:`Con ${cwk} kt de cruzado el viento barre los dos torbellinos fuera de la pista, hacia sotavento.`); };
  const VW={"34":[-58,22],be:[-90,6],si:[0,4],to:[-90,89]};
  u.qa("[data-v]").forEach(b=>b.addEventListener("click",()=>{ view=b.dataset.v; const v=VW[view]; S.go(v[0],v[1]); press(u,"data-v",view); }));
  u.qa("[data-mv]").forEach(b=>b.addEventListener("click",()=>{ mv=b.dataset.mv; T=0; press(u,"data-mv",mv); say(); }));
  u.qa("[data-c]").forEach(b=>b.addEventListener("click",()=>{ cat=b.dataset.c; press(u,"data-c",cat); say(); }));
  const I=u.q('[data-k="cw"]'), O=u.q('[data-o="cw"]'); const setCw=v=>{ cw=+v; I.value=cw; O.textContent=(cw>0?"+":"")+cw+" kt"; say(); }; I.addEventListener("input",()=>setCw(I.value));
  u.q("[data-rs]").addEventListener("click",()=>{ T=0; });
  const Q=quiz(u,QZ,c=>{ mv=c.s.m; press(u,"data-mv",mv); setCw(c.s.cw); T=0; });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); say(); } });
  setCw(3);
}};
})();

/* =====================================================================
   13 · ESPACIOS AÉREOS OACI A–G (010): corte vertical, servicios y mínimos VMC (SERA.5001, apéndice 4 de SERA)
   ===================================================================== */
V.airsp=(()=>{
const K="ABCDEFG", COL={A:"#7a2e2e",B:"#7a4a1e",C:"#2e4f7a",D:"#2e6a7a",E:"#3f6a3a",F:"#5e5a2a",G:"#4a4a4a"};
const SP="250 kt IAS por debajo de 10 000 ft AMSL";
const CL={
 A:{vfr:0,clr:"Sí (solo IFR)",rad:"Sí",sep:"Todos separados de todos: solo vuelan IFR",svc:"VFR no permitido",spd:"No aplicable"},
 B:{vfr:1,clr:"Sí, también VFR",rad:"Sí, también VFR",sep:"Todos separados de todos (IFR y VFR)",svc:"Control: separación de todo el tráfico",spd:"No aplicable"},
 C:{vfr:1,clr:"Sí, también VFR",rad:"Sí, también VFR",sep:"IFR separado de IFR y de VFR · VFR separado de IFR",svc:"Separación del IFR e información de tráfico sobre otros VFR (asesoramiento para evitarlos si lo pides)",spd:"VFR: "+SP+" · IFR: no aplicable"},
 D:{vfr:1,clr:"Sí, también VFR",rad:"Sí, también VFR",sep:"Solo IFR de IFR",svc:"Información de tráfico sobre IFR y VFR (asesoramiento para evitarlos si lo pides)",spd:"IFR y VFR: "+SP},
 E:{vfr:1,clr:"IFR sí · VFR no",rad:"IFR sí · VFR no",sep:"Solo IFR de IFR",svc:"Información de tráfico en la medida de lo posible",spd:"IFR y VFR: "+SP},
 F:{vfr:1,clr:"No",rad:"IFR que participa sí · VFR no",sep:"IFR que participa en el asesoramiento, separado en la medida de lo posible",svc:"Información de vuelo si la pides",spd:"IFR y VFR: "+SP},
 G:{vfr:1,clr:"No",rad:"IFR sí · VFR no",sep:"Ninguna",svc:"Información de vuelo si la pides",spd:"IFR y VFR: "+SP}};
const vmc=(c,alt,ter)=>{ const lim=Math.max(3000,ter+1000);
  if(alt>=10000) return {b:"a 10 000 ft AMSL o más",vis:"8 km",cld:"1 500 m en horizontal y 1 000 ft (300 m) en vertical",free:false};
  if(alt>lim||!"FG".includes(c)) return {b:alt>lim?"por debajo de 10 000 ft AMSL":"tramo bajo, pero en clase "+c+" no hay reducción",vis:"5 km",cld:"1 500 m en horizontal y 1 000 ft (300 m) en vertical",free:false};
  return {b:"tramo bajo de F y G: 3 000 ft AMSL o 1 000 ft AGL, lo más alto",vis:"5 km (1 500 m a 140 kt IAS o menos, si lo permite la autoridad)",cld:"libre de nubes y con la superficie a la vista",free:true}; };
// escala vertical por tramos: el tramo bajo se ve más grande
const H=300, Y=a=>{ const f=a<=5000?a/5000*.42:.42+(a-5000)/14500*.5; return H-14-f*(H-30); };
const QZ=[
 {q:"Clase <b>G</b>, 2 000 ft AMSL, terreno a 500 ft, 100 kt. ¿Mínimos VMC?",o:["1 500 m de visibilidad, libre de nubes y con la superficie a la vista","5 km, 1 500 m y 1 000 ft de las nubes","8 km, 1 500 m y 1 000 ft de las nubes"],a:0,e:"A 2 000 ft AMSL estás en el tramo bajo (3 000 ft AMSL o 1 000 ft AGL, lo más alto): en F y G basta <b>libre de nubes y superficie a la vista</b>, con 5 km… o 1 500 m si vas a 140 kt o menos y lo permite la autoridad.",s:{c:"G",alt:2000,ter:500}},
 {q:"Clase <b>G</b>, 3 500 ft AMSL sobre terreno a 3 000 ft. ¿Mínimos VMC?",o:["5 km · libre de nubes y con la superficie a la vista","5 km · 1 500 m y 1 000 ft de las nubes","8 km · 1 500 m y 1 000 ft de las nubes"],a:0,e:"El límite es <b>3 000 ft AMSL o 1 000 ft AGL, lo más alto</b>: aquí 3 000 + 1 000 = 4 000 ft. A 3 500 ft sigues en el tramo bajo.",s:{c:"G",alt:3500,ter:3000}},
 {q:"Clase <b>E</b>, FL 120. ¿Mínimos VMC?",o:["8 km · 1 500 m y 1 000 ft de las nubes","5 km · 1 500 m y 1 000 ft de las nubes","5 km · libre de nubes"],a:0,e:"A 10 000 ft AMSL o más: <b>8 km</b> de visibilidad y 1 500 m / 1 000 ft de las nubes, en cualquier clase.",s:{c:"E",alt:12000,ter:0}},
 {q:"Clase <b>D</b>, 2 500 ft AMSL. ¿Mínimos VMC?",o:["5 km · 1 500 m y 1 000 ft de las nubes","Libre de nubes y superficie a la vista","8 km · 1 500 m y 1 000 ft"],a:0,e:"«Libre de nubes» solo vale en <b>F y G</b>. En D, aunque vayas bajo, 5 km y 1 500 m / 1 000 ft.",s:{c:"D",alt:2500,ter:0}},
 {q:"Vuelas VFR en clase <b>E</b>. ¿Necesitas autorización ATC y radio?",o:["No: ni autorización ni radio obligatoria","Sí, las dos","Solo radio"],a:0,e:"En E el VFR no necesita autorización ni radio (salvo que sea una RMZ o TMZ). El IFR sí.",s:{c:"E",alt:5000,ter:0}},
 {q:"¿En qué clase el VFR recibe <b>separación</b> de otros VFR?",o:["Solo en B","En B y C","En B, C y D"],a:0,e:"Solo en <b>B</b> se separa a todos de todos. En C el VFR se separa del IFR, pero de otro VFR solo recibe información de tráfico.",s:{c:"B",alt:6000,ter:0}},
 {q:"En clase <b>C</b>, ¿de quién se separa a un VFR?",o:["De los IFR; de otros VFR solo información de tráfico","De todos","De nadie: solo información"],a:0,e:"Clase C: IFR separado de IFR y VFR; VFR separado de IFR y con <b>información</b> sobre otros VFR.",s:{c:"C",alt:6000,ter:0}},
 {q:"¿En qué clase <b>no</b> se puede volar VFR?",o:["A","B","F"],a:0,e:"Clase <b>A</b>: solo IFR.",s:{c:"A",alt:15000,ter:0}},
 {q:"Clase <b>D</b>, 8 000 ft AMSL. ¿Límite de velocidad?",o:["250 kt IAS","No hay límite en espacio controlado","200 kt IAS"],a:0,e:"Por debajo de 10 000 ft AMSL: <b>250 kt IAS</b> en C (solo VFR), D, E, F y G. En A y B no se aplica.",s:{c:"D",alt:8000,ter:0}},
 {q:"En un CTR, ¿cuándo no puedes despegar ni entrar VFR sin autorización especial?",o:["Con techo por debajo de 1 500 ft o visibilidad en tierra por debajo de 5 km","Con techo por debajo de 1 000 ft o visibilidad de menos de 8 km","Con cualquier nube por debajo de 3 000 ft"],a:0,e:"SERA.5005: en un CTR, con <b>techo &lt; 1 500 ft</b> o <b>visibilidad en tierra &lt; 5 km</b>, solo con autorización ATC (VFR especial).",s:{c:"D",alt:1500,ter:0}}];
return {t:"Espacios aéreos A–G: servicios y mínimos VMC según la altitud",
cap:"Mínimos VMC de SERA.5001 y servicios de su apéndice 4. AMSL = sobre el nivel del mar; AGL = sobre el terreno. El límite del tramo bajo es 3 000 ft AMSL o 1 000 ft AGL, lo que sea más alto. Por encima de FL 195 no se vuela VFR salvo autorización. Escala vertical deformada para que se vea el tramo bajo.",
init(el){
  const svg=`<svg viewBox="0 0 420 ${H}" role="img" aria-label="Corte vertical del espacio aéreo con la altitud del avión y la distancia a las nubes"><rect data-bg width="420" height="${H}" fill="${COL.D}"/>
   <rect width="420" height="${H}" fill="url(#asg)"/><defs><linearGradient id="asg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
   <g font-size="12.5" fill="#e9f0f7">${[[19500,"FL 195"],[10000,"10 000 ft AMSL"],[3000,"3 000 ft AMSL"]].map(([a,t])=>`<line x1="0" x2="420" y1="${Y(a)}" y2="${Y(a)}" stroke="#fff" stroke-opacity=".55" stroke-dasharray="${a===10000?"":"6 4"}"/><text x="6" y="${Y(a)-4}">${t}</text>`).join("")}
   <path data-ter fill="#6b5a3d" stroke="#3b2f1d"/><line data-agl x1="0" x2="420" stroke="#ffc94d" stroke-dasharray="3 4"/><text data-aglt x="6" font-size="12.5" fill="#ffc94d">1 000 ft AGL</text>
   <text data-cls x="410" y="34" text-anchor="end" font-size="30" font-weight="800" fill="#fff" opacity=".9">D</text>
   <g data-cloud><ellipse cx="0" cy="0" rx="38" ry="15" fill="#f1f4f8"/><ellipse cx="-20" cy="5" rx="24" ry="11" fill="#e3e8ef"/><ellipse cx="22" cy="5" rx="24" ry="11" fill="#e3e8ef"/></g>
   <g data-gap stroke="#ffc94d" stroke-width="1.6" fill="#ffc94d" font-size="12.5" font-weight="700"><line data-gh/><line data-gv/><text data-ght/><text data-gvt/></g>
   <g data-ac><path d="M-16 0 L10 -2 L16 0 L10 2 Z M-4 -1 L2 -12 L6 -12 L4 -1 Z M-4 1 L2 12 L6 12 L4 1 Z M-14 -1 L-12 -6 L-9 -6 L-10 -1 Z" fill="#ffc94d" stroke="#12202f" stroke-width=".8"/></g>
   <text data-alt x="6" font-size="14" font-weight="800" fill="#ffc94d"></text></g></svg>`;
  const ctl=row("Clase",[...K].map(c=>bt("data-c",c,c,c==="D")).join(""))+`<div class="sl">${sl("a","Altitud del avión (ft AMSL)",500,19500,2500,250)}${sl("t","Terreno (ft AMSL)",0,5000,0,250)}</div>`+row("",bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shellS(el,this.t,svg,ctl,this.cap); let c="D", qm=false;
  const ai=u.q('[data-k="a"]'), ti=u.q('[data-k="t"]');
  const draw=()=>{ const alt=+ai.value, ter=+ti.value; if(alt<ter+200){ ai.value=ter+250; return draw(); }
    u.q('[data-o="a"]').textContent=f0(alt)+" ft"; u.q('[data-o="t"]').textContent=f0(ter)+" ft";
    u.q("[data-bg]").setAttribute("fill",COL[c]); u.q("[data-cls]").textContent=c;
    const yt=Y(ter); u.q("[data-ter]").setAttribute("d",`M0 ${H} L0 ${yt+6} Q60 ${yt-4} 120 ${yt} T240 ${yt} T420 ${yt+3} L420 ${H} Z`);
    const ya=Y(ter+1000); u.q("[data-agl]").setAttribute("y1",ya); u.q("[data-agl]").setAttribute("y2",ya); u.q("[data-aglt]").setAttribute("y",ya-4); u.q("[data-aglt]").setAttribute("x",ter+1000>3000?6:250);
    const yac=Y(alt), m=vmc(c,alt,ter); u.q("[data-ac]").setAttribute("transform",`translate(150 ${yac})`); u.q("[data-alt]").setAttribute("y",yac-16); u.q("[data-alt]").setAttribute("x",108); u.q("[data-alt]").textContent=f0(alt)+" ft";
    // nube a la distancia mínima (esquema, sin escala horizontal)
    const cx=m.free?250:300, cy=m.free?yac-30:Math.max(28,yac-48); u.q("[data-cloud]").setAttribute("transform",`translate(${cx} ${cy})`);
    const g=u.q("[data-gap]"); g.style.display=m.free?"none":"";
    if(!m.free){ const L=(s,a)=>{ const e=u.q(s); for(const k in a) e.setAttribute(k,a[k]); }; L("[data-gh]",{x1:170,x2:cx-40,y1:yac,y2:yac}); L("[data-ght]",{x:178,y:yac+14}); u.q("[data-ght]").textContent="1 500 m";
      L("[data-gv]",{x1:cx,x2:cx,y1:cy+14,y2:yac}); L("[data-gvt]",{x:cx+6,y:(cy+14+yac)/2+4}); u.q("[data-gvt]").textContent="1 000 ft"; }
    if(qm) return;
    const k=CL[c];
    u.out.innerHTML=`<b>Clase ${c}</b>${k.vfr?"":" · <span class=\"bad\">VFR no permitido</span>"}<br>Autorización ATC: <b>${k.clr}</b> · Radio: <b>${k.rad}</b><br>Separación: ${k.sep}<br>Servicio al VFR: ${k.svc}<br>Velocidad: ${k.spd}<br><span class="ok">Mínimos VMC</span> · ${m.b}: visibilidad <b>${m.vis}</b> · nubes: <b>${m.cld}</b>${!k.vfr?" <i>(solo orientativo)</i>":""}${alt>19500?"":""}`; };
  u.qa("[data-c]").forEach(b=>b.addEventListener("click",()=>{ c=b.dataset.c; press(u,"data-c",c); draw(); }));
  [ai,ti].forEach(i=>i.addEventListener("input",draw));
  const Q=quiz(u,QZ,q=>{ c=q.s.c; press(u,"data-c",c); ti.value=q.s.ter; ai.value=q.s.alt; draw(); });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); draw(); } });
  draw();
}};
})();

/* =====================================================================
   14 · METAR Y TAF: DESCIFRADOR GRUPO A GRUPO, EJEMPLOS Y PARTES REALES (050)
   ===================================================================== */
V.metar=(()=>{
const EX=[
 ["CAVOK","METAR LEMD 251030Z 02008KT 340V060 CAVOK 12/M01 Q1027 NOSIG="],
 ["Chubascos y CB","METAR LEBL 251000Z 17012G25KT 9000 -SHRA FEW020CB SCT030 BKN080 16/11 Q1009 TEMPO 4000 TSRA="],
 ["Niebla engelante","METAR LEVS 250630Z 00000KT 0300 R13/0450N FZFG VV001 M02/M02 Q1031 BECMG 2000 BR="],
 ["Tormenta con granizo","METAR LEZG 251500Z 31025G38KT 6000 +TSRAGR BKN015CB OVC040 18/14 Q1004 RETS NOSIG="],
 ["SPECI","SPECI LECU 251145Z 25015G27KT 3000 RA BKN008 OVC015 10/09 Q1001="],
 ["TAF con TEMPO y PROB","TAF LEMD 250500Z 2506/2612 21010KT 9999 SCT040 BECMG 2512/2514 24018G30KT TEMPO 2515/2520 4000 SHRA BKN030CB PROB30 TEMPO 2602/2606 0800 FG="],
 ["TAF con TX/TN","TAF LEBB 251100Z 2512/2618 33012KT 6000 BKN012 TX18/2514Z TN09/2606Z BECMG 2516/2518 9999 NSW SCT025="]];
const WX={MI:"baja (shallow)",BC:"en bancos",PR:"parcial",DR:"levantado a poca altura",BL:"levantado (ventisca)",SH:"chubascos de",TS:"tormenta",FZ:"engelante (gotas subfundidas)",
 DZ:"llovizna",RA:"lluvia",SN:"nieve",SG:"cinarra",PL:"hielo granulado",GR:"granizo (5 mm o más)",GS:"granizo pequeño o nieve granulada",UP:"precipitación desconocida",IC:"cristales de hielo",
 BR:"neblina (1 000–5 000 m)",FG:"niebla (menos de 1 000 m)",FU:"humo",VA:"ceniza volcánica",DU:"polvo",SA:"arena",HZ:"calima",PO:"remolinos de polvo",SQ:"turbonada",FC:"nube de embudo (tornado)",SS:"tempestad de arena",DS:"tempestad de polvo"};
const COV={FEW:"pocas (1–2 octas)",SCT:"dispersas (3–4 octas)",BKN:"muy nubosas (5–7 octas)",OVC:"cubierto (8 octas)"};
const day=(d,h,m)=>`día ${+d} a las ${h}${m!=null?":"+m:":00"} UTC`;
function parse(raw){ const tk=raw.replace(/=+\s*$/,"").trim().split(/\s+/), out=[]; let kind="METAR", pos=0, rmk=false;
  const P=(t,c,m)=>out.push({t,c,m});
  for(const t of tk){ let m;
    if(rmk){ P(t,"x","Observación nacional (RMK): no se usa en el examen."); continue; }
    if(/^(METAR|SPECI|TAF)$/.test(t)){ kind=t; P(t,"id",t==="METAR"?"Informe <b>rutinario</b> de aeródromo (cada 30 o 60 min).":t==="SPECI"?"Informe <b>especial</b>: se emite cuando el tiempo cambia de forma significativa.":"<b>Pronóstico</b> de aeródromo (TAF)."); pos=1; continue; }
    if(pos===1&&/^[A-Z]{4}$/.test(t)&&!/^(AUTO|CAVOK|NSIG|NOSIG|TEMPO|BECMG)$/.test(t)){ P(t,"id",`Indicador OACI del aeródromo. <b>LE</b> = España.`); pos=2; continue; }
    if(/^(AMD|COR|AUTO|NIL|CNL)$/.test(t)){ P(t,"id",{AMD:"TAF <b>enmendado</b>.",COR:"Informe <b>corregido</b>.",AUTO:"Informe <b>automático</b>, sin observador.",NIL:"Informe <b>vacío</b> (no hay datos).",CNL:"TAF <b>cancelado</b>."}[t]); continue; }
    if((m=/^(\d{2})(\d{2})(\d{2})Z$/.exec(t))){ P(t,"tm",(kind==="TAF"?"Emitido el ":"Observado el ")+day(m[1],m[2],m[3])+"."); continue; }
    if((m=/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/.exec(t))){ P(t,"tm",`Periodo: del ${day(m[1],m[2])} al ${day(m[3],m[4])}.`); continue; }
    if((m=/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/.exec(t))){ const u=m[4]==="KT"?"kt":"m/s";
      P(t,"wd",t.startsWith("00000")?"Viento en <b>calma</b>.":`Viento ${m[1]==="VRB"?"de dirección <b>variable</b>":`de <b>${m[1]}°</b> (verdadero)`} a <b>${+m[2]} ${u}</b>${m[3]?` con <b>rachas de ${+m[3]} ${u}</b>`:""}.`); continue; }
    if((m=/^(\d{3})V(\d{3})$/.exec(t))){ P(t,"wd",`La dirección <b>varía entre ${m[1]}° y ${m[2]}°</b>.`); continue; }
    if(t==="CAVOK"){ P(t,"vs","<b>CAVOK</b>: visibilidad de 10 km o más, ninguna nube por debajo de 5 000 ft (o de la altitud mínima de sector, la mayor), <b>ningún CB ni TCU</b> y ningún fenómeno significativo."); continue; }
    if((m=/^(\d{4})(NDV)?$/.exec(t))){ const v=+m[1]; P(t,"vs",v===9999?"Visibilidad de <b>10 km o más</b>.":v===0?"Visibilidad de <b>menos de 50 m</b>.":`Visibilidad de <b>${f0(v)} m</b>.`); continue; }
    if((m=/^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/.exec(t))){ P(t,"vs",`Visibilidad mínima de <b>${f0(+m[1])} m</b> hacia el ${m[2]}.`); continue; }
    if((m=/^R(\d{2}[LCR]?)\/([PM])?(\d{4})(?:V([PM])?(\d{4}))?(FT)?([UDN])?$/.exec(t))){ const pre=x=>x==="P"?"más de ":x==="M"?"menos de ":"";
      P(t,"rv",`<b>RVR</b> (alcance visual en pista) de la pista ${m[1]}: <b>${pre(m[2])}${f0(+m[3])}${m[6]?" ft":" m"}</b>${m[5]?` variando hasta ${pre(m[4])}${f0(+m[5])} m`:""}${m[7]?` · tendencia: <b>${{U:"aumentando",D:"disminuyendo",N:"sin cambios"}[m[7]]}</b>`:""}.`); continue; }
    if((m=/^(RE)?(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|PL|GR|GS|UP|IC|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)*)$/.exec(t))&&(m[3]||m[4])){
      const ph=(m[4].match(/../g)||[]).map(x=>WX[x]), it=m[2]==="+"?"fuerte":m[2]==="-"?"débil":"", vc=m[2]==="VC";
      let s=m[3]==="TS"?"tormenta"+(ph.length?" con "+ph.join(" y "):""):m[3]==="SH"?(ph.length?"chubascos de "+ph.join(" y "):"chubascos"):m[3]?ph.join(" y ")+" "+WX[m[3]]:ph.join(" y ");
      P(t,"wx",`${m[1]?"<b>Tiempo reciente</b> (en la última hora, ya no ahora): ":"Tiempo presente: "}<b>${s}${it?" "+it:""}</b>${vc?" <b>en las proximidades</b> (8–16 km)":""}.`); continue; }
    if(t==="NSW"){ P(t,"wx","<b>NSW</b>: se acaba el tiempo significativo."); continue; }
    if((m=/^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/.exec(t))){ P(t,"cl",`Nubes <b>${COV[m[1]]}</b> con base a <b>${m[2]==="///"?"?":f0(+m[2]*100)} ft</b> sobre el aeródromo${m[3]==="CB"?" · <b>cumulonimbos</b>":m[3]==="TCU"?" · <b>cúmulos en torre</b>":""}.${/BKN|OVC/.test(m[1])?" Cuenta como <b>techo</b>.":""}`); continue; }
    if((m=/^VV(\d{3}|\/\/\/)$/.exec(t))){ P(t,"cl",`Cielo oculto · <b>visibilidad vertical de ${m[1]==="///"?"?":f0(+m[1]*100)} ft</b> (cuenta como techo).`); continue; }
    if(/^(NSC|NCD|SKC|CLR)$/.test(t)){ P(t,"cl",{NSC:"<b>NSC</b>: sin nubes significativas (ninguna por debajo de 5 000 ft o de la MSA y sin CB ni TCU).",NCD:"<b>NCD</b>: la estación automática no detecta nubes.",SKC:"<b>SKC</b>: cielo despejado.",CLR:"<b>CLR</b>: sin nubes por debajo de 12 000 ft (estación automática)."}[t]); continue; }
    if((m=/^(M?\d{2})\/(M?\d{2})$/.exec(t))){ const T=x=>(x[0]==="M"?-1:1)*+x.replace("M",""); P(t,"tp",`Temperatura <b>${T(m[1])} °C</b> y punto de rocío <b>${T(m[2])} °C</b>${T(m[1])-T(m[2])<=2?" · muy juntos: riesgo de niebla o nubes bajas":""}.`); continue; }
    if((m=/^Q(\d{4})$/.exec(t))){ P(t,"pr",`<b>QNH ${+m[1]} hPa</b>.`); continue; }
    if((m=/^A(\d{4})$/.exec(t))){ P(t,"pr",`QNH <b>${m[1].slice(0,2)},${m[1].slice(2)} inHg</b>.`); continue; }
    if((m=/^T([XN])(M?\d{2})\/(\d{2})(\d{2})Z$/.exec(t))){ P(t,"tp",`Temperatura <b>${m[1]==="X"?"máxima":"mínima"} de ${(m[2][0]==="M"?"-":"")+(+m[2].replace("M",""))} °C</b> prevista el ${day(m[3],m[4])}.`); continue; }
    if(t==="NOSIG"){ P(t,"tr","<b>NOSIG</b>: sin cambios significativos previstos en las <b>próximas 2 horas</b>."); continue; }
    if(t==="BECMG"){ P(t,"tr","<b>BECMG</b>: cambio <b>gradual y duradero</b>; lo que sigue se queda al final del periodo."); continue; }
    if(t==="TEMPO"){ P(t,"tr","<b>TEMPO</b>: cambios <b>temporales</b>; cada uno dura menos de 1 hora y, en total, menos de la mitad del periodo."); continue; }
    if((m=/^PROB(30|40)$/.exec(t))){ P(t,"tr",`<b>Probabilidad del ${m[1]} %</b> de lo que sigue.`); continue; }
    if((m=/^FM(\d{2})(\d{2})(\d{2})$/.exec(t))){ P(t,"tr",`<b>Desde</b> el ${day(m[1],m[2],m[3])}: cambio rápido a lo que sigue.`); continue; }
    if((m=/^(TL|AT)(\d{2})(\d{2})$/.exec(t))){ P(t,"tr",`${m[1]==="TL"?"Hasta":"A"} las ${m[2]}:${m[3]} UTC.`); continue; }
    if(t==="WS"){ P(t,"wx","<b>Cizalladura</b> (windshear) en la pista o la senda."); continue; }
    if(t==="RMK"){ rmk=true; P(t,"x","Empiezan las observaciones nacionales (RMK)."); continue; }
    if(/^R\d{2}[LCR]?\/[\d\/]{6}$|^\d{8}$/.test(t)){ P(t,"rv","Estado de la pista (depósitos, espesor y frenado)."); continue; }
    P(t,"x","Grupo que este descifrador no reconoce.");
  }
  return out; }
const CC={id:"#8fa3b8",tm:"#9fe0ff",wd:"#6ee7a0",vs:"#ffc94d",rv:"#ffb07a",wx:"#ff8a80",cl:"#c9a6ff",tp:"#7dd3fc",pr:"#f9a8d4",tr:"#fde68a",x:"#64748b"};
const QZ=[
 {q:"¿Qué garantiza <b>CAVOK</b>?",o:["10 km o más, sin nubes bajo 5 000 ft (o MSA), sin CB ni TCU y sin fenómenos significativos","Cielo completamente despejado","8 km o más y techo de 1 500 ft o más"],a:0,e:"CAVOK no es cielo despejado: puede haber nubes por encima de 5 000 ft (o de la MSA). Lo que nunca puede haber es CB o TCU.",x:0},
 {q:"¿Qué significa <b>340V060</b>?",o:["La dirección del viento varía entre 340° y 060°","Viento de 340° a 60 kt","Visibilidad variable entre 340 y 600 m"],a:0,e:"El grupo dddVddd da los extremos de la dirección cuando varía 60° o más.",x:0},
 {q:"En LEBL, ¿qué indica <b>FEW020CB</b>?",o:["1–2 octas de cumulonimbos con base a 2 000 ft sobre el aeródromo","Pocas nubes a 20 000 ft","Techo de cumulonimbos a 200 ft"],a:0,e:"Altura en centenares de pies sobre el aeródromo: 020 = 2 000 ft. FEW = 1–2 octas.",x:1},
 {q:"En LEBL, ¿qué significa <b>TEMPO 4000 TSRA</b>?",o:["Ratos de menos de 1 h con 4 000 m de visibilidad, tormenta y lluvia","El tiempo cambia de forma definitiva a 4 000 m con tormenta","Tormenta durante 4 horas"],a:0,e:"TEMPO = fluctuaciones temporales: cada una menos de 1 h y, sumadas, menos de la mitad del periodo.",x:1},
 {q:"En LEVS, ¿cuál es el <b>techo</b>?",o:["100 ft: VV001 (cielo oculto, visibilidad vertical)","No hay techo: no hay nubes cifradas","1 000 ft"],a:0,e:"VV001 = visibilidad vertical de 100 ft. Cuenta como techo.",x:2},
 {q:"En LEVS, ¿qué es <b>R13/0450N</b>?",o:["RVR de la pista 13: 450 m, sin cambios","Pista 13 cerrada durante 450 minutos","Viento de 130° a 45 kt"],a:0,e:"R + pista / valor en metros + tendencia (U aumenta, D disminuye, N sin cambios).",x:2},
 {q:"En LEVS, ¿qué es <b>FZFG</b>?",o:["Niebla engelante: gotas subfundidas, visibilidad bajo 1 000 m y temperatura bajo 0 °C","Llovizna engelante","Neblina helada por encima de 1 000 m"],a:0,e:"FZ + FG. Las gotas siguen líquidas bajo 0 °C y se congelan al tocar el avión.",x:2},
 {q:"En LEZG, ¿qué significa <b>RETS</b>?",o:["Hubo tormenta en la última hora, pero ya no ahora","Tormenta prevista","Tormenta en las proximidades"],a:0,e:"RE = tiempo reciente: ocurrió en la última hora (o desde el último informe) y ya no está.",x:3},
 {q:"SPECI de LECU. ¿Se puede entrar VFR en el CTR sin autorización especial?",o:["No: techo de 800 ft (BKN008) y visibilidad de 3 km, por debajo de 1 500 ft y 5 km","Sí: la visibilidad es de 3 km","Sí: BKN no cuenta como techo"],a:0,e:"SERA.5005: en un CTR hacen falta techo de 1 500 ft y 5 km de visibilidad en tierra; si no, solo VFR especial con autorización.",x:4},
 {q:"TAF de LEMD: ¿qué dice <b>BECMG 2512/2514 24018G30KT</b>?",o:["Entre las 12 y las 14 UTC del día 25 el viento pasa a 240/18 con rachas de 30 y se queda así","El viento sopla así solo entre las 12 y las 14","Rachas de 30 kt a las 25:12"],a:0,e:"BECMG: cambio gradual dentro del periodo indicado; a partir del final, manda lo nuevo.",x:5},
 {q:"TAF de LEMD: ¿qué significa <b>PROB30 TEMPO 2602/2606 0800 FG</b>?",o:["30 % de probabilidad de ratos de niebla con 800 m entre las 02 y las 06 UTC del día 26","Niebla segura de 02 a 06 UTC","Visibilidad de 30 m con niebla"],a:0,e:"PROB30 o PROB40 + TEMPO: probabilidad de fluctuaciones temporales.",x:5},
 {q:"TAF de LEBB: ¿qué es <b>TX18/2514Z</b>?",o:["Máxima de 18 °C el día 25 a las 14 UTC","Visibilidad de 18 km","Viento máximo de 18 kt"],a:0,e:"TX máxima, TN mínima, con el día y la hora en que se esperan.",x:6}];
return {t:"METAR y TAF: toca cada grupo y se ilumina su significado",
cap:"Ejemplos con el formato OACI (Anexo 3) que usa AEMET; los aeródromos y valores son de ejemplo. «En vivo» trae el último METAR y TAF publicados (aviationweather.gov) a través de esta web. Alturas de nubes sobre el aeródromo; vientos en grados verdaderos.",
init(el){
  const fig=`<div class="mtr" style="background:#12202f;padding:12px 14px;min-height:150px"><div data-raw style="font:600 16px/2 ui-monospace,'SF Mono',Menlo,Consolas,monospace;display:flex;flex-wrap:wrap;gap:4px 6px"></div><div data-lg style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px;font:12px system-ui,sans-serif;color:#8fa3b8"></div></div>`;
  const ctl=row("Ejemplo",EX.map((e,i)=>bt("data-e",i,e[0],!i)).join(""))+row("En vivo",["LEMD","LEBL","LEVS","LECU","LEPA","LEBB"].map(c=>bt("data-live",c,c)).join(""))+row("",bt("data-all","1","Leer todo")+bt("data-m","quiz","Ponme a prueba"))+`<div class="v3r v3q" data-qz hidden></div>`;
  const u=shellS(el,this.t,fig,ctl,this.cap); let toks=[], qm=false, all=false, sel=-1;
  const LG=[["wd","viento"],["vs","visibilidad"],["rv","RVR"],["wx","tiempo"],["cl","nubes"],["tp","temperatura"],["pr","presión"],["tr","tendencia"],["tm","fecha y hora"]];
  u.q("[data-lg]").innerHTML=LG.map(([k,n])=>`<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${CC[k]};margin-right:4px"></i>${n}</span>`).join("");
  const say=i=>{ sel=i; u.qa("[data-t]").forEach(b=>{ const on=+b.dataset.t===i; b.style.background=on?CC[toks[+b.dataset.t].c]:"transparent"; b.style.color=on?"#12202f":CC[toks[+b.dataset.t].c]; });
    if(qm) return; if(all){ u.out.innerHTML=toks.map(t=>`<span style="color:${CC[t.c]};font-family:ui-monospace,Menlo,monospace">${esc3(t.t)}</span> · ${t.m}`).join("<br>"); return; }
    u.out.innerHTML=i<0?"Toca o pasa el ratón por cada grupo.":`<span style="font-family:ui-monospace,Menlo,monospace;color:${CC[toks[i].c]}">${esc3(toks[i].t)}</span> · ${toks[i].m}`; };
  const esc3=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  const load=(raws,head)=>{ toks=[]; const parts=raws.map(r=>parse(r)); u.q("[data-raw]").innerHTML=(head?`<div style="flex-basis:100%;font:12px system-ui,sans-serif;color:#8fa3b8">${head}</div>`:"")+parts.map((p,k)=>{ const s=p.map(t=>{ toks.push(t); const i=toks.length-1; return `<button type="button" data-t="${i}" style="font:inherit;background:transparent;color:${CC[t.c]};border:1px solid ${CC[t.c]}55;border-radius:4px;padding:0 5px;cursor:pointer;line-height:1.7">${esc3(t.t)}</button>`; }).join(""); return (k?'<div style="flex-basis:100%;height:6px"></div>':"")+s; }).join("");
    u.qa("[data-t]").forEach(b=>{ const i=+b.dataset.t; b.addEventListener("click",()=>say(i)); b.addEventListener("pointerenter",e=>{ if(e.pointerType==="mouse") say(i); }); b.addEventListener("focus",()=>say(i)); }); say(-1); };
  u.qa("[data-e]").forEach(b=>b.addEventListener("click",()=>{ press(u,"data-e",b.dataset.e); press(u,"data-live",""); load([EX[+b.dataset.e][1]]); }));
  u.qa("[data-live]").forEach(b=>b.addEventListener("click",async()=>{ const ic=b.dataset.live; press(u,"data-live",ic); press(u,"data-e",""); u.out.textContent="Buscando el último METAR y TAF de "+ic+"…";
    try{ const r=await fetch("/api/wx?icao="+ic,{cache:"no-store"}); if(!r.ok) throw new Error(r.status); const d=await r.json(); const L=[];
      if(d.metar&&d.metar.raw) L.push(/^(METAR|SPECI) /.test(d.metar.raw)?d.metar.raw:"METAR "+d.metar.raw); if(d.taf&&d.taf.raw) L.push(/^TAF /.test(d.taf.raw)?d.taf.raw:"TAF "+d.taf.raw);
      if(!L.length) throw new Error("sin datos"); const st=(d.metar&&d.metar.station)||ic; load(L,`Real · ${st}${st!==ic?` (estación más cercana a ${ic})`:""} · ${new Date(d.at||Date.now()).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`); }
    catch(e){ u.out.innerHTML=`No se ha podido traer el parte de ${ic} ahora mismo (sin conexión o sin datos). Usa los ejemplos.`; } }));
  u.q("[data-all]").addEventListener("click",e=>{ all=!all; e.currentTarget.setAttribute("aria-pressed",all); say(sel); });
  const Q=quiz(u,QZ,q=>{ press(u,"data-e",q.x); press(u,"data-live",""); load([EX[q.x][1]]); });
  u.q('[data-m="quiz"]').addEventListener("click",e=>{ qm=!qm; e.currentTarget.setAttribute("aria-pressed",qm); if(qm) Q.start(); else { Q.stop(); say(sel); } });
  load([EX[0][1]]);
}};
})();

F.init();
})();
