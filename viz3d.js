/* Láminas 3D (serie 3): globo terrestre, aproximación ILS/VOR, meteorología 3D, derecho de paso y centro de gravedad.
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

F.init();
})();
