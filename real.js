/* Cabecera y cielo realistas: sol en su posición real (LECU), nubes por ruido, pista a escala y despegue con cámara de seguimiento. */
(function(){
"use strict";
const D2R=Math.PI/180, LAT=40.3706, LON=-3.785;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t, sstep=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
const css=(c,a)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a==null?1:a})`;
const mul=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
const tint=(c,l)=>[c[0]*l[0]/255,c[1]*l[1]/255,c[2]*l[2]/255];
let seed=7; const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };

/* ---------- ruido fractal en mosaico ---------- */
const N=256, NOI=new Float32Array(N*N);
(function(){ let amp=1, tot=0; for(const c of [4,8,16,32,64]){ const g=new Float32Array(c*c); for(let i=0;i<g.length;i++) g[i]=rnd();
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const u=x/N*c, v=y/N*c, i=Math.floor(u), j=Math.floor(v); let fx=u-i, fy=v-j; fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
      const i1=(i+1)%c, j1=(j+1)%c; NOI[y*N+x]+=amp*lerp(lerp(g[j*c+i],g[j*c+i1],fx),lerp(g[j1*c+i],g[j1*c+i1],fx),fy); }
    tot+=amp; amp*=.5; } for(let i=0;i<NOI.length;i++) NOI[i]/=tot; })();
const noise=(u,v)=>{ u=((u%1)+1)%1*N; v=((v%1)+1)%1*N; const i=u|0, j=v|0, fx=u-i, fy=v-j, i1=(i+1)%N, j1=(j+1)%N;
  return lerp(lerp(NOI[j*N+i],NOI[j*N+i1],fx),lerp(NOI[j1*N+i],NOI[j1*N+i1],fx),fy); };

/* ---------- sol: posición real ---------- */
function sunPos(d){
  const jd=d.getTime()/86400000+2440587.5, n=jd-2451545, L=(280.46+0.9856474*n)%360, g=(357.528+0.9856003*n)%360*D2R;
  const lam=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*D2R, eps=(23.439-0.0000004*n)*D2R;
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam)), dec=Math.asin(Math.sin(eps)*Math.sin(lam));
  const gmst=(18.697374558+24.06570982441908*n)%24, ha=((gmst*15+LON)*D2R-ra), la=LAT*D2R;
  const el=Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha));
  const az=Math.atan2(-Math.sin(ha),Math.tan(dec)*Math.cos(la)-Math.sin(la)*Math.cos(ha));
  return {el:el/D2R, az:((az/D2R)+360)%360};
}
const KEY=[[-18,"#03050c","#070b18",.10,"#161d30","#0a0e19","#ffd9a0"],[-6,"#0f1d45","#c96a4a",.33,"#6a5a78","#1c2238","#ff9a55"],[0,"#2b4f93","#ffb169",.68,"#ffc9a0","#5a5876","#ffb36b"],
  [8,"#3a74c4","#f4dcb8",.9,"#fff0dc","#8b93a8","#ffe2b0"],[25,"#2d6fc7","#bcd9f2",1,"#ffffff","#9aa6b8","#fff6e0"],[90,"#2866c2","#b4d4f0",1,"#ffffff","#9aa6b8","#fffaf0"]];
function envAt(date,cover){
  const s=sunPos(date), e=s.el; let i=0; while(i<KEY.length-2&&e>KEY[i+1][0]) i++;
  const a=KEY[i], b=KEY[i+1], t=clamp((e-a[0])/(b[0]-a[0]),0,1), m=k=>mix(hex(a[k]),hex(b[k]),t);
  const ov=sstep(.6,1,cover), grey=x=>mix(x,mul([150,156,166],lerp(a[3],b[3],t)),ov*.75);
  return {el:e, az:s.az, top:grey(m(1)), hor:grey(m(2)), amb:lerp(a[3],b[3],t)*(1-.25*ov), lit:m(4), shade:m(5), sun:m(6), night:1-sstep(-12,-3,e), cover, date};
}

/* ---------- nubes ---------- */
function clouds(ctx,x0,y0,w,h,env,drift,res,age){
  if(env.cover<=0.02) return; const cw=Math.max(40,Math.round(w/res)), ch=Math.max(12,Math.round(h/res)), cv0=ctx.canvas, now=Date.now();
  let cbuf=cv0._cb; if(!cbuf) cbuf=cv0._cb=document.createElement("canvas");
  const key=cw+"x"+ch+"|"+env.cover+"|"+(env.el*4|0);
  if(cv0._ck===key&&now-(cv0._ct||0)<(age||400)){ ctx.imageSmoothingEnabled=true; ctx.drawImage(cbuf,x0,y0,w,h); return; }
  cv0._ck=key; cv0._ct=now; cbuf.width=cw; cbuf.height=ch;
  const c=cbuf.getContext("2d"), im=c.createImageData(cw,ch), d=im.data, th=lerp(.66,.36,env.cover), L=env.lit, S=env.shade;
  for(let y=0;y<ch;y++){ const v=y/ch, dep=1/(1.18-v), fade=1-.55*v*v*v;
    for(let x=0;x<cw;x++){ const u=(x/cw-.5)*dep*.55+drift, n=noise(u*1.3,dep*.33+drift*.3)*.72+noise(u*4.1+.3,dep*1.1)*.28;
      const den=sstep(th,th+.16,n), k=clamp((n-th-.06)*3.2,0,1), o=(y*cw+x)*4;
      d[o]=lerp(L[0],S[0],k); d[o+1]=lerp(L[1],S[1],k); d[o+2]=lerp(L[2],S[2],k); d[o+3]=255*den*fade*.96; } }
  c.putImageData(im,0,0); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high"; ctx.drawImage(cbuf,x0,y0,w,h);
}
const STARS=Array.from({length:160},()=>[rnd(),rnd(),rnd()*.9+.3,rnd()*6.28]);
function skyBase(ctx,w,hz,env,t){
  const g=ctx.createLinearGradient(0,0,0,hz); g.addColorStop(0,css(env.top)); g.addColorStop(.55,css(mix(env.top,env.hor,.42))); g.addColorStop(1,css(env.hor)); ctx.fillStyle=g; ctx.fillRect(0,0,w,hz+1);
  if(env.night>0.02){ ctx.fillStyle="#fff"; for(const s of STARS){ ctx.globalAlpha=env.night*(1-env.cover*.8)*(.45+.4*Math.sin(t*1.7+s[3]))*(1-s[1]*.6); ctx.fillRect(s[0]*w,s[1]*hz*.92,s[2],s[2]); } ctx.globalAlpha=1; }
}
function sunDisc(ctx,x,y,r,env,hz){
  const vis=sstep(-7,2,env.el), dim=1-.55*sstep(.6,1,env.cover);
  ctx.save(); ctx.beginPath(); ctx.rect(0,0,ctx.canvas.width,hz); ctx.clip(); ctx.globalCompositeOperation="lighter";
  if(vis>0){ let g=ctx.createRadialGradient(x,Math.min(y,hz),0,x,Math.min(y,hz),r*9); g.addColorStop(0,css(env.sun,.5*vis*dim)); g.addColorStop(.35,css(env.sun,.16*vis*dim)); g.addColorStop(1,css(env.sun,0)); ctx.fillStyle=g; ctx.fillRect(0,0,ctx.canvas.width,hz); }
  if(env.el>-1.2){ let g=ctx.createRadialGradient(x,y,0,x,y,r*2.6); g.addColorStop(0,css([255,255,246],dim)); g.addColorStop(.36,css(mix([255,250,230],env.sun,.5),dim)); g.addColorStop(.42,css(env.sun,.55*dim)); g.addColorStop(1,css(env.sun,0)); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*2.6,0,7); ctx.fill(); }
  ctx.restore();
}
function moon(ctx,x,y,r,env){
  if(env.night<.05) return; const ph=((env.date.getTime()/86400000-10.5)%29.53+29.53)%29.53/29.53; ctx.save(); ctx.globalAlpha=env.night*(1-env.cover*.7);
  let g=ctx.createRadialGradient(x,y,r,x,y,r*4); g.addColorStop(0,"rgba(220,228,255,.22)"); g.addColorStop(1,"rgba(220,228,255,0)"); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r*4,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.clip(); ctx.fillStyle="#e9ecf2"; ctx.fillRect(x-r,y-r,2*r,2*r);
  ctx.fillStyle="rgba(120,128,150,.35)"; [[-.3,-.2,.28],[.25,.3,.2],[.1,-.45,.14]].forEach(m=>{ ctx.beginPath(); ctx.arc(x+m[0]*r,y+m[1]*r,m[2]*r,0,7); ctx.fill(); });
  ctx.fillStyle="rgba(4,7,16,.93)"; const k=Math.cos(ph*2*Math.PI); ctx.beginPath(); ctx.ellipse(x+(ph<.5?-1:1)*r*(1-k)*.0-((ph<.5?1:-1)*r*k),y,r*1.02,r*1.02,0,0,7); if(Math.abs(ph-.5)>.04) ctx.fill();
  ctx.restore();
}
function ridge(ctx,w,yb,amp,off,scale,col,row){ ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,yb+2); for(let x=0;x<=w;x+=3){ ctx.lineTo(x,yb-amp*(noise((x+off)*scale,row)*.75+noise((x+off)*scale*3.7,row+.2)*.25)); } ctx.lineTo(w,yb+2); ctx.closePath(); ctx.fill(); }

/* ---------- escena 2: cielo del Briefing ---------- */
function drawSky(cv,env,t){
  const ctx=cv.getContext("2d"), w=cv.width, h=cv.height, hz=h*.84; ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  skyBase(ctx,w,hz,env,t);
  const sx=w*lerp(.06,.94,clamp((env.az-60)/240,0,1)), sy=hz-(env.el/72)*hz*.98, r=Math.max(5,h*.045);
  moon(ctx,w*(.6+.3*((env.date.getHours()+6)%12)/12),hz*.3,r*.9,env);
  sunDisc(ctx,sx,sy,r,env,hz);
  clouds(ctx,0,0,w,hz,env,t*.0035,h>200?3:2,500);
  const haze=mix(env.hor,[255,255,255],.06);
  ridge(ctx,w,hz,h*.10,0,.0016*900/w,css(mix(haze,mul(env.top,.55),.38)),.13);
  ridge(ctx,w,hz+h*.01,h*.055,300,.004*900/w,css(mix(haze,mul([60,74,70],env.amb),.62)),.47);
  const g=ctx.createLinearGradient(0,hz,0,h); g.addColorStop(0,css(mul(tint([96,108,74],env.sun),env.amb*.9))); g.addColorStop(1,css(mul(tint([58,70,46],env.sun),env.amb*.8))); ctx.fillStyle=g; ctx.fillRect(0,hz,w,h-hz);
  const gl=ctx.createLinearGradient(0,hz-h*.12,0,hz+2); gl.addColorStop(0,css(env.hor,0)); gl.addColorStop(1,css(env.hor,.55)); ctx.fillStyle=gl; ctx.fillRect(0,hz-h*.12,w,h*.12+2);
  if(env.night>.3){ for(let i=0;i<46;i++){ const x=((i*97.3)%1)*w+ (i*53%w), y=hz+2+((i*31)%7)*h*.012; ctx.fillStyle=`rgba(255,${190+(i*13)%60},${110+(i*29)%90},${.75*env.night})`; ctx.fillRect(x%w,y,1.6,1.6); } }
}

/* ---------- escena 1: despegue ---------- */
const asph=document.createElement("canvas"); asph.width=256; asph.height=64;
(function(){ const c=asph.getContext("2d"), im=c.createImageData(256,64); for(let i=0;i<256*64;i++){ const v=118+rnd()*34+(rnd()<.03?30:0); im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v; im.data[i*4+3]=255; } c.putImageData(im,0,0); })();
/* ---------- utilidades de luz: destellos precalculados (drawImage es mucho más barato que un degradado por luz en Safari iOS) ---------- */
const GS={};
function gsp(c){ let s=GS[c]; if(!s){ s=GS[c]=document.createElement("canvas"); s.width=s.height=48; const x=s.getContext("2d"), g=x.createRadialGradient(24,24,0,24,24,24);
  g.addColorStop(0,`rgba(${c},1)`); g.addColorStop(.18,`rgba(${c},.78)`); g.addColorStop(.5,`rgba(${c},.26)`); g.addColorStop(1,`rgba(${c},0)`); x.fillStyle=g; x.fillRect(0,0,48,48); } return s; }
function glow(ctx,x,y,r,c,a){ if(!(a>.012)||!(r>.2)) return; ctx.globalAlpha=a>1?1:a; ctx.drawImage(gsp(c),x-r,y-r,2*r,2*r); }

/* ---------- avión 3D: malla propia (ala alta tipo C172) proyectada en el canvas 2D; sin WebGL ni librerías ---------- */
const PS=.52, PZ=.085, PD=(function(){ const n=Math.hypot(PS,PZ,1); return [PS/n,-PZ/n,-1/n]; })(), PDIST=34;   // proyección oblicua (cámara 3/4), dirección de la mirada y distancia para la perspectiva
function mkMesh(build){
  const F=[], O=[];
  const nrm=p=>{ let x=0,y=0,z=0; for(let i=0;i<p.length;i++){ const a=p[i], b=p[(i+1)%p.length]; x+=(a[1]-b[1])*(a[2]+b[2]); y+=(a[2]-b[2])*(a[0]+b[0]); z+=(a[0]-b[0])*(a[1]+b[1]); } const l=Math.hypot(x,y,z)||1; return [x/l,y/l,z/l]; };
  const cen=p=>{ let x=0,y=0,z=0; p.forEach(q=>{ x+=q[0]; y+=q[1]; z+=q[2]; }); return [x/p.length,y/p.length,z/p.length]; };
  function loft(secs,col,capA,capB){
    const s0=F.length, all=[].concat.apply([],secs), C=cen(all);
    for(let i=0;i<secs.length-1;i++){ const A=secs[i], Bq=secs[i+1], n=A.length, c2=cen(A.concat(Bq));
      for(let k=0;k<n;k++){ const k1=(k+1)%n, p=[A[k],A[k1],Bq[k1],Bq[k]], f={p,c:typeof col==="function"?col(i,k):col}, nn=nrm(p), cc=cen(p);
        if(nn[0]*(cc[0]-c2[0])+nn[1]*(cc[1]-c2[1])+nn[2]*(cc[2]-c2[2])<0) p.reverse(); F.push(f); } }
    [[secs[0],capA],[secs[secs.length-1],capB]].forEach(q=>{ if(q[1]===false) return; const p=q[0].slice(), nn=nrm(p), cc=cen(p); if(nn[0]*(cc[0]-C[0])+nn[1]*(cc[1]-C[1])+nn[2]*(cc[2]-C[2])<0) p.reverse(); F.push({p,c:q[1]||(typeof col==="function"?col(0,-1):col)}); });
    return s0;
  }
  // perfil genérico [x/c, y/c]
  const AF=[[0,.046],[-.12,.101],[-.42,.117],[-1,.037],[-.5,0],[-.06,0]];
  const wsec=(z,c,x0,y0,th)=>AF.map(a=>[x0+a[0]*c,y0+a[1]*c*(th||1),z]);
  const L=build({F,O,loft,wsec});
  F.forEach(f=>{ f.n=nrm(f.p); f.q=f.p.map(()=>[0,0]); });
  return {F,O,L};
}
/* avioneta de ala alta tipo C172; B = color de la librea */
function mk172(B,W){
  W=W||[244,246,250]; const G=[26,38,54], DK=[60,66,76], GR=[196,202,210];
  return mkMesh(({F,O,loft,wsec})=>{
  // fuselaje: [x, y bajo, y cintura, y techo, semiancho, semiancho techo]
  const FS=[[2.30,.92,1.50,1.53,.40,.33],[1.35,.80,1.66,1.70,.52,.45],[.70,.76,1.58,2.20,.56,.46],[-.90,.78,1.58,2.20,.54,.44],[-1.70,.92,1.62,2.02,.44,.31],[-3.60,1.22,1.60,1.80,.22,.14],[-5.65,1.45,1.58,1.68,.05,.04]];
  const ring=s=>{ const x=s[0], yb=s[1], yw=s[2], yt=s[3], w=s[4], wt=s[5], ym=yb+.3*(yw-yb), ye=yt-Math.min(.06,(yt-yw)*.5);
    return [[x,yb,.55*w],[x,ym,w],[x,yw,w],[x,ye,wt],[x,yt,.45*wt],[x,yt,-.45*wt],[x,ye,-wt],[x,yw,-w],[x,ym,-w],[x,yb,-.55*w]]; };
  loft(FS.map(ring),(i,k)=>{ if(k===0||k===8) return i<6?B:W; if(i===1&&k>=2&&k<=6) return G; if((i===2||i===3)&&(k===2||k===6)) return G; return W; },DK,W);
  F.forEach(f=>{ if(f.c===G) f.glass=1; });
  // cono de la hélice
  const sp=(x,r)=>Array.from({length:6},(_,k)=>[x,1.22+r*Math.sin(k*Math.PI/3),r*Math.cos(k*Math.PI/3)]);
  loft([sp(2.30,.17),sp(2.47,.11),sp(2.63,.012)],B,false,false);
  const WS=[[-5.5,1.10,.66,2.36],[-5.15,1.16,.68,2.35],[-2.6,1.63,.78,2.275],[0,1.63,.78,2.2],[2.6,1.63,.78,2.275],[5.15,1.16,.68,2.35],[5.5,1.10,.66,2.36]];
  loft(WS.map(s=>wsec(s[0],s[1],s[2],s[3])),(i)=>(i===0||i===5)?B:W);
  // estabilizador horizontal
  loft([[-1.72,.70,-5.05,1.63],[0,1.16,-4.72,1.61],[1.72,.70,-5.05,1.63]].map(s=>wsec(s[0],s[1],s[2],s[3],.6)),W);
  // deriva (con punta de color)
  const fin=(y,xl,xt,th)=>{ const xm=xl+(xt-xl)*.35; return [[xl,y,0],[xm,y,th],[xt,y,0],[xm,y,-th]]; };
  loft([fin(1.62,-4.25,-5.90,.055),fin(2.42,-5.08,-5.96,.04),fin(2.74,-5.42,-5.99,.028)],(i)=>i===1?B:W);
  // piezas finas: montantes, patas, ruedas, hélice
  [-1,1].forEach(s=>{ O.push({l:[[.42,.86,s*.56],[.34,2.27,s*2.55]],w:.075,c:GR}); O.push({l:[[.12,.84,s*.46],[0,.24,s*1.22]],w:.10,c:GR}); O.push({d:[0,.2,s*1.25],r:.2}); });
  O.push({l:[[1.60,.88,0],[1.66,.2,0]],w:.07,c:GR}); O.push({d:[1.66,.18,0],r:.17}); O.push({prop:[2.42,1.22,0],r:.95});
  // luces (ejes del avión: x morro, y arriba, z ala derecha): navegación verde/roja, cola blanca, baliza, estrobos y faro de rodaje/aterrizaje
  return [{p:[.25,2.40,5.52],k:"g"},{p:[.25,2.40,-5.52],k:"r"},{p:[-6.0,1.92,0],k:"w"},{p:[-5.62,2.78,0],k:"b"},{p:[.2,2.42,5.5],k:"s"},{p:[.2,2.42,-5.5],k:"s"},{p:[2.32,.98,0],k:"l"}];
  });
}
/* planeador de alto rendimiento: alas de gran alargamiento (18 m, cuerda 0,9 → 0,32), fuselaje fino de fibra, cabina larga acristalada y cola en T */
function mkGlider(){
  const W=[246,247,250], R=[214,44,40], G=[24,34,48], DK=[90,96,104];
  return mkMesh(({F,O,loft,wsec})=>{
    // fuselaje: [x, y centro, semialto, semiancho]
    const FG=[[3.30,.60,.06,.05],[2.90,.62,.30,.27],[2.20,.66,.40,.33],[1.20,.66,.43,.35],[.20,.66,.40,.33],[-.80,.70,.27,.22],[-2.4,.82,.16,.13],[-4.2,.92,.11,.09],[-5.55,.98,.08,.06]];
    const ring=s=>Array.from({length:8},(_,k)=>{ const a=k*Math.PI/4; return [s[0],s[1]+s[2]*Math.sin(a),s[3]*Math.cos(a)]; });
    loft(FG.map(ring),(i,k)=>{ if((i===1||i===2||i===3)&&(k===1||k===2||(i>1&&(k===0||k===3)))) return G; if(i===0) return R; return W; },R,W);
    F.forEach(f=>{ if(f.c===G) f.glass=1; });
    // ala media-alta con diedro creciente y puntas rojas (marca anticolisión)
    const WS=[[-9,.30,.30,1.55],[-8.6,.36,.32,1.48],[-6,.58,.40,1.26],[-3,.78,.48,1.08],[0,.90,.52,1.00],[3,.78,.48,1.08],[6,.58,.40,1.26],[8.6,.36,.32,1.48],[9,.30,.30,1.55]];
    loft(WS.map(s=>wsec(s[0],s[1],s[2],s[3],.9)),(i)=>(i===0||i===7)?R:W);
    // deriva en flecha y estabilizador en T arriba
    const fin=(y,xl,xt,th)=>{ const xm=xl+(xt-xl)*.35; return [[xl,y,0],[xm,y,th],[xt,y,0],[xm,y,-th]]; };
    loft([fin(.95,-4.55,-5.60,.06),fin(1.60,-4.95,-5.66,.045),fin(2.05,-5.18,-5.70,.035)],(i)=>i===1?R:W);
    loft([[-1.55,.30,-5.02,2.07],[0,.50,-4.98,2.06],[1.55,.30,-5.02,2.07]].map(s=>wsec(s[0],s[1],s[2],s[3],.7)),W);
    O.push({d:[.35,.18,0],r:.16});   // rueda principal
    return [{p:[-5.5,2.12,0],k:"s"}];   // estrobo blanco en la cola (FLARM/anticolisión)
  });
}
const MESH=mk172([24,84,170]), GLIDER=mkGlider(), LIV=[mk172([176,36,40]),mk172([28,110,78]),mk172([214,148,30],[240,238,232]),mk172([110,32,64])];
const LTS=MESH.L;
const sect=(az,a,b,res)=>{ const d=az<a?a-az:az>b?az-b:0; return d<=0?1:lerp(1,res,clamp(d/26,0,1)); };   // sector reglamentario: fuera de él queda solo el reflejo del farol
const SORT=[], CB=[0,0,0];
const nrm3=v=>{ const l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; };
const VW=[-PD[0],-PD[1],-PD[2]], LN=nrm3([-.35,.85,.45]), HN=nrm3([LN[0]+VW[0],LN[1]+VW[1],LN[2]+VW[2]]);   // vista hacia la cámara y luz nocturna (focos de plataforma)
/* cuerpo → mundo con la misma rotación que plane3D (para estelas de punta de plano y humo de ruedas) */
function b2w(st,b){ const cp=Math.cos(st.psi), sp=Math.sin(st.psi), ca=Math.cos(st.pitch), sa=Math.sin(st.pitch), cr=Math.cos(st.roll), sr=Math.sin(st.roll);
  const y1=b[1]*cr-b[2]*sr, z1=b[2]*cr+b[1]*sr, x2=b[0]*ca-y1*sa, y2=y1*ca+b[0]*sa; return [cp*x2-sp*z1,y2,sp*x2+cp*z1]; }
function plane3D(ctx,sx,sy,pm,st,env,t,lf,M){
  lf=lf||0; M=M||MESH;
  const cp=Math.cos(st.psi), sp=Math.sin(st.psi), ca=Math.cos(st.pitch), sa=Math.sin(st.pitch), cr=Math.cos(st.roll), sr=Math.sin(st.roll);
  // cuerpo → mundo (alabeo, cabeceo sobre las ruedas, rumbo)
  const TR=(b,o)=>{ const y1=b[1]*cr-b[2]*sr, z1=b[2]*cr+b[1]*sr, x2=b[0]*ca-y1*sa, y2=y1*ca+b[0]*sa; o[0]=cp*x2-sp*z1; o[1]=y2; o[2]=sp*x2+cp*z1; return o; };
  // amortiguadores: al tocar, el fuselaje baja unos centímetros sobre las ruedas (las ruedas y la parte baja de las patas no se mueven)
  const cm=st.cmp||0, TP=(b,o)=>{ if(cm&&b[1]>.42){ CB[0]=b[0]; CB[1]=b[1]-cm*Math.min(1,(b[1]-.42)/.4); CB[2]=b[2]; b=CB; } return TR(b,o); };
  const PR=(wv,o)=>{ const dep=wv[0]*PD[0]+wv[1]*PD[1]+wv[2]*PD[2], k=PDIST/(PDIST+dep)*pm; o[0]=sx+k*(wv[0]+PS*wv[2]); o[1]=sy+k*(-wv[1]+PZ*wv[2]); return dep; };
  const Lc=mix([255,255,255],env.sun,.4), amb=.38+.30*env.amb+.20*lf+.08*env.night, dif=.16+.56*env.amb+.10*lf, sxn=lerp(-.75,.75,clamp((env.az-60)/240,0,1)), sl=Math.hypot(sxn,.62,.55), L=[sxn/sl,.62/sl,.55/sl];
  const HV=nrm3([L[0]+VW[0],L[1]+VW[1],L[2]+VW[2]]), SD=(.18+.62*env.amb)*(1-.75*sstep(.45,1,env.cover))*(1-.85*env.night), SN=.55*sstep(.25,.8,env.night), SC=mix([255,255,255],env.sun,.35), NC=[255,222,176];
  const tv=[0,0,0], nv=[0,0,0], items=SORT; items.length=0;
  for(const f of M.F){ TR(f.n,nv); const vis=-(nv[0]*PD[0]+nv[1]*PD[1]+nv[2]*PD[2]); if(vis<=.015) continue;
    let dep=0; for(let i=0;i<f.p.length;i++){ TP(f.p[i],tv); dep+=PR(tv,f.q[i]); } f.dep=dep/f.p.length;
    const lam=Math.max(0,nv[0]*L[0]+nv[1]*L[1]+nv[2]*L[2]), sky=.5+.5*nv[1]; let c;
    const hd=Math.max(0,nv[0]*HV[0]+nv[1]*HV[1]+nv[2]*HV[2]), hn=Math.max(0,nv[0]*HN[0]+nv[1]*HN[1]+nv[2]*HN[2]);
    if(f.glass){ const g=mix(mul(env.top,.5),mul(env.hor,.85),clamp(.4+.6*lam,0,1)), fr=Math.pow(1-clamp(vis,0,1),3)*.45;
      c=mix(mix(f.c,g,.55+fr),[255,255,255],Math.pow(lam,6)*.5*env.amb); c=mix(c,SC,clamp(SD*1.6*Math.pow(hd,60),0,.9)); c=mix(c,NC,clamp(SN*1.8*Math.pow(hn,70),0,.85)); }
    else{ const k=amb*(.72+.28*sky)+dif*lam; c=[f.c[0]*k*Lc[0]/255,f.c[1]*k*Lc[1]/255,f.c[2]*k*Lc[2]/255]; c=mix(c,SC,clamp(SD*.75*Math.pow(hd,22),0,.7)); c=mix(c,NC,clamp(SN*.8*Math.pow(hn,26),0,.6)); }
    f.col=css(c); items.push(f); }
  const o2=[0,0], o3=[0,0];
  for(const p of M.O){ if(p.l){ TP(p.l[0],tv); const d1=PR(tv,o2); p.a=[o2[0],o2[1]]; TP(p.l[1],tv); const d2=PR(tv,o3); p.b=[o3[0],o3[1]]; p.dep=(d1+d2)/2-.05; }
    else if(p.d){ TP(p.d,tv); p.dep=PR(tv,o2)-.12; p.a=[o2[0],o2[1]]; }
    else{ TP(p.prop,tv); p.dep=PR(tv,o2); p.a=[o2[0],o2[1]]; TP([p.prop[0],p.prop[1]+p.r,0],tv); PR(tv,o3); p.u=[o3[0]-o2[0],o3[1]-o2[1]]; TP([p.prop[0],p.prop[1],p.r],tv); PR(tv,o3); p.v=[o3[0]-o2[0],o3[1]-o2[1]]; }
    items.push(p); }
  // hacia dónde está la cámara en ejes del avión → sectores de las luces
  const cw=[-PD[0],-PD[1],-PD[2]], cf=cw[0]*cp+cw[2]*sp, crr=-cw[0]*sp+cw[2]*cp, az=Math.atan2(crr,cf)/D2R, aab=Math.abs(az);
  const nl=.2+.8*sstep(.15,.75,env.night), kk=.36+.64*env.amb;
  for(const l of M.L){ TP(l.p,tv); l.dep=PR(tv,o2)-.3; l.x=o2[0]; l.y=o2[1]; l.lt=1; items.push(l); }
  items.sort((a,b)=>b.dep-a.dep);
  ctx.lineJoin="round"; ctx.lineCap="round";
  for(const it of items){
    if(it.q){ const q=it.q; ctx.beginPath(); ctx.moveTo(q[0][0],q[0][1]); for(let i=1;i<q.length;i++) ctx.lineTo(q[i][0],q[i][1]); ctx.closePath(); ctx.fillStyle=it.col; ctx.fill(); ctx.strokeStyle=it.col; ctx.lineWidth=.6; ctx.stroke(); }
    else if(it.l){ ctx.strokeStyle=css(mul(tint(it.c,Lc),kk*.9)); ctx.lineWidth=Math.max(1,it.w*pm); ctx.beginPath(); ctx.moveTo(it.a[0],it.a[1]); ctx.lineTo(it.b[0],it.b[1]); ctx.stroke(); }
    else if(it.d){ ctx.fillStyle=css(mul([30,32,36],.5+.5*kk)); ctx.beginPath(); ctx.arc(it.a[0],it.a[1],Math.max(1.2,it.r*pm),0,7); ctx.fill(); ctx.fillStyle=css(mul([150,154,160],kk)); ctx.beginPath(); ctx.arc(it.a[0],it.a[1],Math.max(.5,it.r*pm*.36),0,7); ctx.fill(); }
    else if(it.prop){ ctx.save(); ctx.transform(it.u[0],it.u[1],it.v[0],it.v[1],it.a[0],it.a[1]); const g=ctx.createRadialGradient(0,0,0,0,0,1); g.addColorStop(0,"rgba(30,32,36,.30)"); g.addColorStop(.25,"rgba(30,32,36,.10)"); g.addColorStop(.86,"rgba(30,32,36,.17)"); g.addColorStop(.93,"rgba(255,214,60,.30)"); g.addColorStop(1,"rgba(30,32,36,0)"); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,1,0,7); ctx.fill();
      ctx.rotate(t*31); ctx.fillStyle="rgba(24,26,30,.16)"; ctx.fillRect(-.08,-1,.16,2); ctx.restore(); }
    else{ const k=it.k; ctx.save(); ctx.globalCompositeOperation="lighter"; const R=pm*(.32+.95*nl);
      if(k==="g"){ const a=sect(az,-4,113,.3); ctx.globalAlpha=1; ctx.fillStyle="rgb(70,255,120)"; ctx.fillRect(it.x-.8,it.y-.8,1.6,1.6); glow(ctx,it.x,it.y,R*(.7+.5*a),"60,255,110",(.35+.6*nl)*a); }
      else if(k==="r"){ const a=sect(az,-113,4,.3); ctx.globalAlpha=1; ctx.fillStyle="rgb(255,60,50)"; ctx.fillRect(it.x-.8,it.y-.8,1.6,1.6); glow(ctx,it.x,it.y,R*(.7+.5*a),"255,45,35",(.35+.6*nl)*a); }
      else if(k==="w"){ const a=aab>=108?1:lerp(1,0,clamp((108-aab)/22,0,1)); glow(ctx,it.x,it.y,R*.9,"255,255,245",(.3+.6*nl)*a); }
      else if(k==="b"){ if(st.bc!==0&&((t+(st.ph||0))%1.2)<.13) glow(ctx,it.x,it.y,pm*(.5+1.3*nl),"255,40,30",.95); }
      else if(k==="s"){ if(st.st!==0&&(((t+(st.ph||0))%1.6)<.06||((t+(st.ph||0)+.2)%1.6)<.06)) glow(ctx,it.x,it.y,pm*(.6+1.9*nl),"255,255,255",.95); }
      else if(k==="l"){ const a=clamp((62-aab)/40,0,1)*st.ll; if(a>0){ glow(ctx,it.x,it.y,pm*(.5+1.8*env.night)*(.6+.4*a),"255,250,230",(.35+.65*env.night)*a); } }
      ctx.restore(); ctx.globalAlpha=1; }
  }
}

/* ---------- aeródromo lejano: se pinta una sola vez por tamaño y luz en un lienzo aparte; cada fotograma solo se copia ---------- */
const AP={len:1060, hgt:25, tower:262, radar:742, masts:[142,206,318,392], door:96};
function buildApron(buf,u,env){
  const N=sstep(.12,.7,env.night), W=Math.ceil(AP.len*u), base=Math.ceil(AP.hgt*u), Hh=base+Math.ceil(3*u)+2; buf.width=W; buf.height=Hh;
  const c=buf.getContext("2d"), haze=env.hor, M=(col,k)=>css(mix(haze,mul(tint(col,mix([255,255,255],env.sun,.3)),.25+.75*env.amb),k==null?.72:k));
  const X=a=>a*u, Y=m=>base-m*u, R=(a,m,w,h,col)=>{ c.fillStyle=col; c.fillRect(X(a),Y(m+h),Math.max(.6,w*u),Math.max(.6,h*u)); };
  const wall=M([200,204,208]), wall2=M([168,174,182]), dark=M([84,92,104]), roof=M([112,120,132]), glass=M([58,84,112]), tree=M([52,78,50],.6), tree2=M([70,98,58],.6), white=M([236,238,240],.82);
  const trees=(a0,a1,n)=>{ for(let i=0;i<n;i++){ const a=lerp(a0,a1,(i*.618)%1), r=2.2+((i*37)%10)*.22; c.fillStyle=i%2?tree:tree2; c.beginPath(); c.arc(X(a),Y(r*.9),r*u,0,7); c.fill(); } };
  const win=(a,m,w,n,h)=>{ if(N<=.02) return; for(let i=0;i<n;i++){ if((i*7+((a*3)|0))%5===0) continue; c.fillStyle=`rgba(255,${205+(i*13)%40},${130+(i*29)%50},${.9*N})`; c.fillRect(X(a+i*w/n+.3),Y(m+h),Math.max(.7,(w/n-.9)*u),Math.max(.7,h*u)); } };
  const arch=(a,w,h,rise,col,open)=>{ c.fillStyle=col; c.beginPath(); c.moveTo(X(a),Y(0)); c.lineTo(X(a),Y(h)); c.quadraticCurveTo(X(a+w/2),Y(h+rise*2),X(a+w),Y(h)); c.lineTo(X(a+w),Y(0)); c.closePath(); c.fill();
    c.fillStyle=roof; c.beginPath(); c.moveTo(X(a),Y(h)); c.quadraticCurveTo(X(a+w/2),Y(h+rise*2),X(a+w),Y(h)); c.quadraticCurveTo(X(a+w/2),Y(h+rise*2-1.2),X(a),Y(h)); c.fill();
    const dw=w*.62; R(a+(w-dw)/2,0,dw,h*.78,open&&N>.05?`rgba(255,214,150,${.25+.7*N})`:dark); if(!open){ c.fillStyle=wall2; for(let i=1;i<4;i++) c.fillRect(X(a+(w-dw)/2+dw*i/4),Y(h*.78),Math.max(.5,.25*u),h*.78*u); } };
  const gable=(a,w,h,col)=>{ R(a,0,w,h,col); c.fillStyle=roof; c.beginPath(); c.moveTo(X(a-.6),Y(h)); c.lineTo(X(a+w/2),Y(h+w*.16)); c.lineTo(X(a+w+.6),Y(h)); c.closePath(); c.fill(); R(a+w*.2,0,w*.6,h*.7,dark); };
  const plane=(a,flip)=>{ c.save(); c.translate(X(a),Y(0)); c.scale(flip?-u:u,-u); c.fillStyle=white; c.beginPath(); c.moveTo(2.4,1.2); c.lineTo(1.2,1.75); c.lineTo(-1.6,1.75); c.lineTo(-5.6,1.55); c.lineTo(-5.6,1.3); c.lineTo(-1.4,.8); c.lineTo(1.6,.8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-4.6,1.5); c.lineTo(-5.4,2.7); c.lineTo(-5.9,2.7); c.lineTo(-5.7,1.5); c.closePath(); c.fill(); c.fillStyle=wall2; c.fillRect(-.9,1.95,2.2,.28); c.fillStyle=dark; c.fillRect(-.1,.05,.5,.75); c.fillRect(1.5,.05,.4,.75); c.fillRect(-.6,1.3,1.5,.42); c.restore(); };
  trees(-6,34,9);
  arch(40,30,7,2.2,wall); arch(74,44,9,2.8,wall,true); arch(122,26,6.5,2,wall2);                    // hangares de aviación general
  R(160,0,74,6.4,wall); R(160,6.4,74,.5,roof); R(176,6.9,40,3.6,wall2); R(176,10.5,40,.45,roof);   // terminal
  R(162,1.2,70,2.6,glass); R(178,7.6,36,2,glass); win(162,1.4,70,22,2.1); win(178,7.8,36,12,1.5); R(192,0,10,3.2,dark);
  // torre de control
  { const a=AP.tower; c.fillStyle=wall; c.beginPath(); c.moveTo(X(a-2.1),Y(0)); c.lineTo(X(a-1.5),Y(15.6)); c.lineTo(X(a+1.5),Y(15.6)); c.lineTo(X(a+2.1),Y(0)); c.closePath(); c.fill(); R(a-.35,2,.7,12,wall2);
    R(a-3.6,15.6,7.2,.8,roof); c.fillStyle=N>.05?css(mix(hex("#1d3340"),[120,220,190],.35*N)):glass; c.beginPath(); c.moveTo(X(a-2.9),Y(16.4)); c.lineTo(X(a-3.8),Y(19.2)); c.lineTo(X(a+3.8),Y(19.2)); c.lineTo(X(a+2.9),Y(16.4)); c.closePath(); c.fill();
    c.fillStyle=wall2; for(let i=-1;i<=1;i++) c.fillRect(X(a+i*1.9)-.3,Y(19.2),Math.max(.5,.2*u),2.8*u); R(a-4.2,19.2,8.4,.7,roof); R(a-.12,19.9,.24,4.2,dark); R(a-1.1,19.9,2.2,.9,wall2); }
  R(280,0,22,4.6,wall2); R(280,4.6,22,.4,roof); win(281,1.2,20,7,1.6);                               // bomberos
  [150,182,300,338].forEach((a,i)=>plane(a,i%2));                                                   // plataforma
  AP.masts.forEach(a=>{ R(a-.14,0,.28,13.5,dark); R(a-1.1,13.5,2.2,.6,dark); });
  [436,449].forEach(a=>{ c.fillStyle=white; c.beginPath(); c.moveTo(X(a),Y(0)); c.lineTo(X(a),Y(5)); c.quadraticCurveTo(X(a+4.5),Y(7),X(a+9),Y(5)); c.lineTo(X(a+9),Y(0)); c.closePath(); c.fill(); });
  trees(466,540,14);
  gable(566,34,7.5,wall); gable(606,26,6.4,wall2); gable(640,40,8.4,wall);
  R(AP.radar-.4,0,.8,13,dark); R(AP.radar-2.2,0,4.4,3,wall2);
  trees(770,838,12);
  for(let i=0;i<13;i++){ const a=858+i*14+((i*5)%7), w=7+((i*3)%4), h=3.2+((i*7)%5)*.7; R(a,0,w,h,i%3?wall:wall2); c.fillStyle=M([150,96,78]); c.beginPath(); c.moveTo(X(a-.5),Y(h)); c.lineTo(X(a+w/2),Y(h+2.2)); c.lineTo(X(a+w+.5),Y(h)); c.closePath(); c.fill(); win(a+.6,1.2,w-1.2,3,1.2); }
  { const a=946; R(a,0,3.4,13,wall2); c.fillStyle=roof; c.beginPath(); c.moveTo(X(a-.3),Y(13)); c.lineTo(X(a+1.7),Y(19)); c.lineTo(X(a+3.7),Y(13)); c.closePath(); c.fill(); }
  // plataforma de hormigón bajo los edificios
  c.fillStyle=M([172,172,166],.62); c.fillRect(X(30),base,X(470)-X(30),Math.max(1.5,2.2*u));
  if(N>.03){ c.globalCompositeOperation="lighter";
    AP.masts.forEach(a=>{ glow(c,X(a),Y(14),Math.max(3,5.5*u),"255,238,196",.95*N); const g=c.createLinearGradient(0,Y(14),0,base+2.5*u); g.addColorStop(0,`rgba(255,234,186,${.30*N})`); g.addColorStop(1,"rgba(255,234,186,0)"); c.fillStyle=g; c.globalAlpha=1; c.beginPath(); c.moveTo(X(a),Y(14)); c.lineTo(X(a-17),base+2.5*u); c.lineTo(X(a+17),base+2.5*u); c.closePath(); c.fill(); });
    glow(c,X(AP.door),Y(8),Math.max(3,6*u),"255,220,160",.7*N); glow(c,X(291),Y(5),Math.max(2,3*u),"255,90,60",.6*N);
    [578,653].forEach(a=>glow(c,X(a),Y(7),Math.max(2,3.5*u),"255,226,170",.7*N));
    c.globalCompositeOperation="source-over"; c.globalAlpha=1; }
  return buf;
}


/* ---------- ciclo largo: despegue → ascenso → barrena → recuperación → viraje de vuelta → final → aterrizaje ---------- */
const TOA=2.4, TOT0=1.2, TOTR=11.3, TOTL=12.5, VD=28, AD=2.6, APP=5, RO=VD/AD, TU=5.2;
// altura tras la rotación: al cruzarse con el planeador el avión a motor nivela unos segundos (además de virar a la derecha) y luego recupera la senda
const ALT0=ta=>3.4*ta*ta/(ta+1.3), LVF=ta=>sstep(2.4,3.3,ta)*(1-sstep(5.4,6.3,ta)), ALTT=(function(){ const a=[], dt=.02; let D=0, Dm=0;
  for(let i=0;i<=1000;i++){ const ta=i*dt; if(ta<=6.3){ D+=(ALT0(ta+dt)-ALT0(ta))*LVF(ta+dt/2); Dm=D; } else D=Dm*(1-sstep(6.3,11.5,ta)); a.push(ALT0(ta)-D); } return a; })();
const ALTF=ta=>{ const i=ta/.02; if(i>=ALTT.length-1) return ALT0(ta); const k=i|0, f=i-k; return lerp(ALTT[k],ALTT[k+1],f); };
const TOP=q=>{ const tg=Math.max(0,q-TOT0), tq=Math.min(tg,TOTL-TOT0), vl=TOA*(TOTL-TOT0), ta=Math.max(0,q-TOTL);
  return {x:.5*TOA*tq*tq+(tg>tq?vl*(tg-tq)*1.04:0), z:8.5*sstep(1.6,5.6,ta), alt:ALTF(ta), pitch:(sstep(TOTR,TOTL,q)*7.5+sstep(TOTL,TOTL+2,q)*2.5)*D2R, psi:15*D2R*sstep(1.4,4.6,ta)*(1-.4*sstep(6,9,ta)),
    roll:(24*sstep(1.1,3.8,ta)*(1-sstep(5.5,9,ta))+(ta>0?2.6*Math.sin(ta*3.4)*Math.exp(-ta*.9):0))*D2R, v:tg>tq?vl*1.04:TOA*tg}; };
let CYC=null;
/* PAPI de la pista contraria (aterrizaje hacia x decreciente): 4 unidades a la izquierda de la pista, reglaje ICAO para senda de 3°.
   Cada unidad se ve blanca por encima de su ángulo y roja por debajo; la más cercana a la pista tiene el reglaje más alto. */
const PAPI={x:170, z0:-18.2, dz:2.3, G:3, eye:1.5, hf:1.2, S:[3.5,3.17,2.83,2.5]}, TG=Math.tan(PAPI.G*D2R);
/* viento: velocidad (kt) y dirección hacia la que sopla (rad, en el plano del suelo: 0 = +x, π/2 = hacia la cámara); racheado y lento */
function windAt(t){ const k=7.5+4*Math.sin(t/37)+2.2*Math.sin(t/11.3+1.7)+3*(noise(t*.031,.37)-.5), d=Math.PI/2+.95*Math.sin(t/53+2.2)+.12*Math.sin(t/7.1);
  return {kt:clamp(k,1.5,18), d}; }
/* capas de nubes bajas en el horizonte: una tira suave que se repite y se desplaza */
function hbands(env){ const c=document.createElement("canvas"), W=512, Hh=40; c.width=W; c.height=Hh; const x=c.getContext("2d"), im=x.createImageData(W,Hh), d=im.data, L=env.lit, S=env.shade, Hz=env.hor;
  for(let j=0;j<Hh;j++){ const v=j/Hh, env2=Math.sin(Math.PI*v)*Math.pow(1-v,.4);
    for(let i=0;i<W;i++){ const u=i/W, n=noise(u*3,v*.45+.21)*.65+noise(u*9+.4,v*1.3+.6)*.35, den=sstep(.47,.74,n)*env2;
      const col=mix(mix(L,S,clamp(v*1.25,0,1)),Hz,.35), o=(j*W+i)*4; d[o]=col[0]; d[o+1]=col[1]; d[o+2]=col[2]; d[o+3]=255*clamp(den*1.15,0,1); } }
  x.putImageData(im,0,0); return c; }
function cycleModel(){
  if(CYC) return CYC;
  const dt=1/30, U0=TOTL, TS=22, E=1.8, S=4.2, R=2.4, CC=10, tE=TS+E, tS=tE+S, tR=tS+R, UE=tR+CC, X1=VD*VD/(2*AD)+29*APP;
  const run=(om,keep)=>{ const P=TOP(TS), rows=[]; let x=P.x, z=P.z, alt=P.alt, psi=P.psi, v=P.v, xf=TOP(U0).x, ps=0, roll=0, pitch=0;
    for(let u=U0;u<tR+1e-6;u+=dt){
      if(u<TS){ const p=TOP(u); x=p.x; z=p.z; alt=p.alt; psi=p.psi; v=p.v; pitch=p.pitch; roll=p.roll; }
      else{ const τ=u-TS; let vz, w=0;
        if(τ<E){ const q=τ/E; v=lerp(28,10,sstep(0,1,q)); pitch=lerp(10,26,sstep(0,1,q))*D2R; roll=lerp(0,22,sstep(.4,1,q))*D2R; w=om*.25*Math.pow(sstep(.35,1,q),2); vz=lerp(3.3,-.5,q); }
        else if(τ<E+S){ const r=τ-E; v=lerp(10,4,sstep(0,1.2,r)); pitch=(lerp(26,-55,sstep(0,.55,r))+2.5*Math.sin(r*7))*D2R; roll=(28+7*Math.sin(r*5.4))*D2R; w=om*lerp(.25,1,sstep(0,.4,r)); vz=lerp(-.5,-3.3,sstep(0,.6,r)); }
        else{ const r=τ-E-S; w=om*Math.exp(-r/.3); pitch=lerp(-55,5,sstep(0,1.9,r))*D2R; roll=28*(1-sstep(0,1.1,r))*D2R; v=lerp(4,24,sstep(.3,2.4,r)); vz=-6*sstep(0,.7,r)*(1-sstep(.9,2.4,r))+(-3.3)*(1-sstep(0,.7,r)); }
        x+=v*dt; alt+=vz*dt; psi+=w*dt; }
      xf+=(x-xf)*(1-Math.exp(-dt/.3)); if(keep) rows.push({u,x,z,alt,pitch,psi,roll,v,xf}); }
    return keep?rows:psi; };
  const tgt=TOP(TS).psi+6*Math.PI; let lo=1.5, hi=7; for(let i=0;i<40;i++){ const m=(lo+hi)/2; if(run(m)<tgt) lo=m; else hi=m; }
  const rows=run((lo+hi)/2,true), L=rows[rows.length-1], φ=((L.psi%(2*Math.PI))+2*Math.PI)%(2*Math.PI), v0=L.v, m0=[v0*Math.cos(φ)*CC, v0*Math.sin(φ)*CC], m1=[-29*CC, 2.5*CC];
  const x0=L.x, z0=L.z, a0=L.alt, xf0=L.xf, un=[]; let prev=0, xf=xf0;
  for(let f=dt/CC;f<1+1e-9;f+=dt/CC){ const f2=f*f, f3=f2*f, h00=2*f3-3*f2+1, h10=f3-2*f2+f, h01=-2*f3+3*f2, h11=f3-f2, d00=6*f2-6*f, d10=3*f2-4*f+1, d01=-6*f2+6*f, d11=3*f2-2*f;
    const x=h00*x0+h10*m0[0]+h01*X1+h11*m1[0], vx=(d00*x0+d10*m0[0]+d01*X1+d11*m1[0])/CC, sn=Math.sin(Math.PI*f), z=h00*z0+h10*m0[1]+h01*-1.2+h11*m1[1]-20*sn*sn, vz=(d00*z0+d10*m0[1]+d01*-1.2+d11*m1[1])/CC-20*Math.PI*Math.sin(2*Math.PI*f)/CC;
    let a=Math.atan2(vz,vx); if(un.length){ while(a-prev>Math.PI) a-=2*Math.PI; while(a-prev<-Math.PI) a+=2*Math.PI; } else if(Math.abs(a)>Math.PI) a=0; prev=a;
    const alt=lerp(a0,9,sstep(.15,1,f)); xf+=(x-xf)*(1-Math.exp(-dt/.3)); un.push({u:tR+f*CC,x,z,alt,psi:a,v:Math.hypot(vx,vz),f,xf}); }
  const off=L.psi-un[0].psi; un.forEach(r=>r.psi+=off);
  un.forEach((r,i)=>{ const a=un[Math.max(0,i-1)], b=un[Math.min(un.length-1,i+1)], pr=(b.psi-a.psi)/((b.u-a.u)||1), da=(b.alt-a.alt)/((b.u-a.u)||1), g=sstep(0,.2,r.f)*(1-sstep(.8,1,r.f));
    r.roll=clamp(Math.atan(r.v*pr/9.81)*.55,-.66,.66)*g; r.pitch=(Math.atan2(da,r.v)+4*D2R)*(1-sstep(.8,1,r.f))+1.5*D2R*sstep(.8,1,r.f); });
  CYC={rows:rows.concat(un), U0, TS, tR, UE, dt, CC};
  return CYC;
}
function cycleAt(u){ const C=cycleModel(), i=clamp((u-C.U0)/C.dt,0,C.rows.length-1), a=C.rows[i|0], b=C.rows[Math.min(C.rows.length-1,(i|0)+1)], k=i-(i|0), o={};
  for(const key of ["x","z","alt","pitch","psi","roll","v","xf"]) o[key]=lerp(a[key],b[key],k); return o; }

/* ---------- tráfico 3D (mismas mallas, luz y proyección que el avión principal) ----------
   Reglamento del Aire (SERA.3210): el avión a motor cede el paso al planeador, así que el principal vira a la derecha y le deja por su izquierda;
   al alcanzar a otro avión lo adelanta dejándolo a su izquierda. En tierra, los aviones esperan antes de la barra de parada del punto de espera
   y solo entran en pista cuando el principal ya la ha dejado libre (despegue por detrás, «line up behind»). */
const XL=28;                                         // calle de enlace al punto de espera (m desde el inicio de la carrera)
const TQ=3;                                         // cola en la calle paralela: el segundo espera aquí
const tpath=(pts)=>{ const seg=[]; let L=0; for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1], l=Math.hypot(b[0]-a[0],b[1]-a[1]); seg.push({a,b,l,L}); L+=l; } return {seg,L}; };
const arc=(cx,cz,r,a0,a1,n)=>Array.from({length:n+1},(_,i)=>{ const a=lerp(a0,a1,i/n); return [cx+r*Math.cos(a),cz+r*Math.sin(a)]; });
function along(P,d){ d=clamp(d,0,P.L); for(const s of P.seg){ if(d<=s.L+s.l+1e-9){ const k=s.l?(d-s.L)/s.l:0; return {x:lerp(s.a[0],s.b[0],k),z:lerp(s.a[1],s.b[1],k),psi:Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0])}; } } const s=P.seg[P.seg.length-1]; return {x:s.b[0],z:s.b[1],psi:Math.atan2(s.b[1]-s.a[1],s.b[0]-s.a[0])}; }
// distancia recorrida con arranque y frenada suaves (v en m/s, a en m/s²) para ir de 0 a L empezando en t0
const ease=(t,t0,L,v,a)=>{ const ta=v/a, da=.5*a*ta*ta; let T=t-t0; if(T<=0) return 0; if(2*da>=L){ const tp=Math.sqrt(L/a); return T<tp?.5*a*T*T:T<2*tp?L-.5*a*(2*tp-T)*(2*tp-T):L; }
  const tc=(L-2*da)/v; return T<ta?.5*a*T*T:T<ta+tc?da+v*(T-ta):T<2*ta+tc?L-.5*a*(2*ta+tc-T)*(2*ta+tc-T):L; };
function traffic(S,G){
  const {u,CY,cyc}=S, out=[], zT=G.zT, zH=G.zH, zS=zH-1-2.6, r=Math.max(1.5,Math.min(5,zS-zT));
  const live=k=>LIV[((cyc+k)%3+3)%3];
  // calle paralela → giro a la derecha → punto de espera
  const toHold=tpath([[TQ,zT],[XL-r,zT]].concat(arc(XL-r,zT+r,r,-Math.PI/2,0,6).slice(1)).concat(zS>zT+r?[[XL,zS]]:[]));
  // punto de espera → cruza la barra → gira a la izquierda y se alinea en la pista
  const r2=6, inR=tpath([[XL,zS],[XL,-r2]].concat(arc(XL+r2,-r2,r2,Math.PI,Math.PI/2,6).slice(1).map(p=>[p[0],p[1]])));
  // A: esperando; entra cuando el principal ya ha pasado el enlace
  { const UA=6.0, d=ease(u,UA,inR.L,4.2,1.1); let P=along(inR,d), x=P.x, z=P.z, psi=P.psi, v=d<inR.L&&u>UA?4:0, roll=0;
    if(d>=inR.L){ const q=Math.max(0,u-(UA+inR.L/4.2+3.2)); x=XL+r2+.5*2.2*q*q; v=2.2*q; psi=0; }
    if(u<UA) psi=Math.PI/2;
    if(x<600) out.push({M:live(0),x,z,alt:0,st:{psi,pitch:0,roll,ll:u<UA?.45:1,st:z>zH?1:0,ph:.37},g:1}); }
  // B: en cola en la calle paralela; rueda al punto de espera cuando A lo deja libre y se queda ahí (con el principal aterrizando)
  { const UB=7.1, d=ease(u,UB,toHold.L,4,1), P=along(toHold,d); out.push({M:live(1),x:P.x,z:P.z,alt:0,st:{psi:d>0?P.psi:0,pitch:0,roll:0,ll:(d>0&&d<toHold.L)?1:.45,st:0,ph:.81},g:1}); }
  // C: llega por la calle paralela durante el aterrizaje y para detrás, en la cola
  { const UC=CY-21, Lc=Math.abs(TQ+130), d=ease(u,UC,Lc,7,1.2), x=-130+d; if(u>UC-1) out.push({M:live(2),x,z:zT,alt:0,st:{psi:0,pitch:0,roll:0,ll:d<Lc?1:.45,st:0,ph:.13},g:1}); }
  // planeador en térmica a la izquierda y delante del principal, a su altura; el principal vira a la derecha para cederle el paso
  { const om=2*Math.PI/17, a=om*(u-17.3)+2.2, R=8, cx=300, cz=-24;
    if(u>11&&u<24) out.push({M:GLIDER,x:cx+R*Math.cos(a),z:cz+R*Math.sin(a),alt:7.0+.12*(u-17.3),st:{psi:a+Math.PI/2,pitch:-3*D2R,roll:34*D2R,ll:0,st:1,ph:.6}}); }
  // avioneta en el circuito: el principal la alcanza en el tramo de vuelta y la adelanta dejándola a su izquierda (lado cercano), 2 m más baja
  { const uc=38.5, xc=359, vT=21; if(u>33&&u<47){ let x=xc-vT*(Math.min(u,41.5)-uc), z=13, alt=7.3, psi=Math.PI;
      if(u>41.5){ const q=u-41.5; for(let k=0,n=Math.ceil(q/.1);k<n;k++){ const qq=Math.min(q,(k+1)*.1), dt=qq-k*.1, ps=Math.PI-.5*sstep(0,4,qq); x+=vT*Math.cos(ps)*dt; z+=vT*Math.sin(ps)*dt; } psi=Math.PI-.5*sstep(0,4,q); alt+=1.4*q; }
      const q=Math.max(0,u-41.5); out.push({M:LIV[3],x,z,alt,st:{psi,pitch:(3+3*sstep(0,2,q))*D2R,roll:-26*D2R*sstep(0,1.5,q)*(1-sstep(3.5,6,q)),ll:1,ph:.21}}); } }
  return out;
}
/* ---------- escena 1: aeródromo, despegue, aterrizaje y media vuelta ---------- */
function drawTakeoff(cv,env,t,tt,o){
  o=o||{}; const ctx=cv.getContext("2d"), w=cv.width, H=cv.height, pm=H*(o.pm||.105), h=pm/.105, hz0=H*(o.hz||.62), T=18, a=2.4, t0=1.2, tr=11.3, tl=12.5;
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  const viewM=w/pm, fx0=o.x0||.2, fx1=o.x1||.5, RW=30, THR=-17;
  const TO=q=>{ const tg=Math.max(0,q-t0), tq=Math.min(tg,tl-t0), vl=a*(tl-t0), xw=.5*a*tq*tq+(tg>tq?vl*(tg-tq)*1.04:0), ta=Math.max(0,q-tl), tc=tl+1.6;
    const xc=q<=tc?xw:(.5*a*(tl-t0)*(tl-t0)+vl*1.04*(tc-tl))+vl*1.04*1.3*(1-Math.exp(-(q-tc)/1.3));
    return {xw, z:5*sstep(1.6,5,ta), alt:3.4*ta*ta/(ta+1.3), pitch:(sstep(tr,tl,q)*7.5+sstep(tl,tl+2,q)*2.5)*D2R, psi:9*D2R*sstep(1.4,4.6,ta), roll:(17*sstep(1.1,3.8,ta)+(ta>0?2.6*Math.sin(ta*3.4)*Math.exp(-ta*.9):0))*D2R,
      cam:xc-viewM*lerp(fx0,fx1,sstep(0,12,q)), v:tg>tq?vl*1.04:a*tg, ll:1}; };
  let K;
  if(!o.cycle) K=TO(tt);
  else{   // despegue → ascenso → barrena y recuperación → viraje de vuelta → final y aterrizaje por la pista contraria → rodaje → media vuelta
    const C=cycleModel(), TAK=C.UE, vd=VD, ad=AD, AP_=APP, RO_=RO, TU_=TU, CY=TAK+AP_+RO_+TU_, u=tt%CY, fr=q=>lerp(fx1,.52,sstep(TOTL,TOTL+3,q));
    if(u<TOTL) K=TO(u);
    else if(u<TAK){ const c=cycleAt(u); K={xw:c.x, z:c.z, alt:c.alt, pitch:c.pitch, psi:c.psi, roll:c.roll, v:c.v, ll:1, cam:c.xf+c.z*PS*(1-sstep(C.TS,C.TS+3,u))-viewM*fr(u)}; }
    else{ const s=u-TAK, camEnd=cycleAt(TAK).xf-viewM*fr(TAK), xtd=vd*vd/(2*ad);
      if(s<AP_+RO_){ let xp, z=0, alt=0, pitch, v, psi=Math.PI, roll=0;
        let cmp=0;
        // senda de 3° hacia el punto de visada (junto al PAPI) para el ojo del piloto: entra algo alto (4 blancas → 3 blancas), corrige a 2/2,
        // y a ~1,2 m de las ruedas empieza la recogida: baja la velocidad vertical hasta casi cero y sube el morro a ~7° para tocar con las principales
        const sf=AP_-((PAPI.x+(PAPI.hf+PAPI.eye)/TG)-xtd)/29;
        if(s<AP_){ const q=1-s/AP_; xp=xtd+29*(AP_-s);
          if(s<sf){ alt=(xp-PAPI.x)*TG-PAPI.eye+1.3*(1-sstep(0,2.2,s)); pitch=.5*D2R; }
          else{ const p=(s-sf)/(AP_-sf); alt=PAPI.hf*(.9*Math.pow(1-p,2.6)+.1*(1-p)); pitch=lerp(.5,7,sstep(0,.85,p))*D2R; }
          v=29; roll=4.5*D2R*Math.sin(s*2.3)*q*(1-sstep(sf-.6,sf,s)); psi=Math.PI-5*D2R*(1-sstep(AP_-1.3,AP_-.1,s)); z=-1.2*q; }
        else{ const r=s-AP_, zf=x=>-10*sstep(RO_-6.6,RO_-.7,x); xp=xtd-(vd*r-.5*ad*r*r); pitch=7*(1-sstep(.2,1.8,r))*D2R; v=vd-ad*r; z=zf(r); psi=Math.atan2((zf(r+.05)-z)/.05,-Math.max(.4,v)); roll=1.2*D2R*Math.sin(r*5)*Math.exp(-r*1.4);
          cmp=r<1.6?.12*Math.exp(-r*3.4)*Math.sin(r*13):0; if(cmp<0) cmp*=.5;
          const rn=r-1.75; if(rn>0&&rn<1) cmp+=.035*Math.exp(-rn*4)*Math.sin(rn*12); }   // el morro baja: pequeño rebote del tren de morro
        K={xw:xp, z, alt, pitch, v, psi, roll, ll:1, cmp, cam:lerp(camEnd, xp-viewM*lerp(.8,fx0,sstep(3,AP_+RO_,s)), sstep(0,3,s)), td:(s>=AP_&&s<AP_+1.6)?(s-AP_)/1.6:-1,
          pth:s<AP_?(s<sf?Math.atan2(alt+PAPI.eye,xp-PAPI.x)/D2R:PAPI.G):null}; }   // en la recogida el piloto ya mira la pista: el PAPI se deja en la última lectura (2 y 2)
      else{ const r=sstep(0,1,(s-AP_-RO_)/TU_), an=Math.PI*r; K={xw:-5*Math.sin(an), z:-5-5*Math.cos(an), alt:0, pitch:0, v:3.4*Math.sin(an), psi:Math.PI-an, roll:2.6*D2R*Math.sin(an), ll:1, cam:-viewM*fx0}; } } }
  if(K.td==null) K.td=-1;
  const xw=K.xw, alt=K.alt, v=K.v, cam=K.cam, X=m=>(m-cam)*pm;
  // cámara que se inclina hacia arriba siguiendo al avión: todo (cielo, sol, nubes, suelo) baja en el cuadro
  const yb1=H*(o.y1||.72), yb2=H*(o.y2||.9), dy=o.cycle?Math.max(0,alt*pm-((yb1+yb2)/2+K.z*(yb2-yb1)/RW-H*.27)):0, hz=hz0+dy;
  const y1=yb1+dy, y2=yb2+dy, yc=(y1+y2)/2, kz=(y2-y1)/(RW*pm), GP=(x,z)=>[X(x)+z*pm*PS,yc+z*pm*kz];
  const N=sstep(.12,.7,env.night), day=1-N;
  // cielo
  skyBase(ctx,w,hz,env,t);
  const sxp=w*lerp(.1,.9,clamp((env.az-60)/240,0,1)); sunDisc(ctx,sxp,hz-(env.el/38)*hz,Math.max(3,h*.035),env,hz);
  if(env.night>.05) moon(ctx,w*(.58+.3*((env.date.getHours()+6)%12)/12),hz*.34,Math.max(3,h*.045),env);
  clouds(ctx,-w*.05,dy*.5,w*1.1,hz0,env,t*.004+cam*.00012,h>150?3:2,150);
  const haze=env.hor;
  { const hk=(env.lit[0]|0)+"|"+(env.shade[0]|0)+"|"+(env.hor[2]|0); if(cv._hbk!==hk){ cv._hbk=hk; cv._hb=hbands(env); }
    const hb=cv._hb, bh=h*.16, bw=bh*512/40*2.2, A=(.28+.5*sstep(.05,.8,env.cover))*(1-.55*env.night);
    [[.0,1,.13,A],[.5,.62,.07,A*.75]].forEach(L=>{ const yy=hz-bh*L[1]-h*.01, off=(((t*L[2]*h+cam*pm*.02*L[1]+L[0]*bw)%bw)+bw)%bw; ctx.globalAlpha=L[3];
      for(let xx=-off;xx<w;xx+=bw) ctx.drawImage(hb,xx,yy,bw,bh*L[1]); }); ctx.globalAlpha=1; }
  ridge(ctx,w,hz,h*.13,cam*pm*.03,.0011*640/h*.25+.0009,css(mix(haze,mul(env.top,.5),.34)),.21);
  ridge(ctx,w,hz+1,h*.05,cam*pm*.10+500,.006*72/h+.0012,css(mix(haze,mul([52,70,56],env.amb),.66)),.63);
  const CYL=cycleModel().UE+APP+RO+TU, TS_={u:o.cycle?tt%CYL:-1,CY:CYL,cyc:Math.floor(tt/CYL)};
  // hierba lejana
  const G=(c,k)=>css(mul(tint(c,mix([255,255,255],env.sun,.3)),env.amb*k));
  let g=ctx.createLinearGradient(0,hz,0,y1); g.addColorStop(0,css(mix(haze,mul([112,124,80],env.amb),.55))); g.addColorStop(1,G([104,118,66],.95)); ctx.fillStyle=g; ctx.fillRect(0,hz,w,y1-hz+1);
  // aeródromo lejano (torre, terminal, hangares, plataforma)
  const u=pm*.115, FP=.15, ax0=w*.14-cam*pm*FP, key=(u*100|0)+"|"+(env.amb*24|0)+"|"+(N*12|0)+"|"+(env.el|0);
  let ab=cv._ab; if(!ab) ab=cv._ab=document.createElement("canvas"); if(cv._abk!==key){ cv._abk=key; buildApron(ab,u,env); }
  const base=Math.ceil(AP.hgt*u), ay=hz+h*.012-base; if(ax0<w&&ax0+ab.width>0) ctx.drawImage(ab,Math.round(ax0),Math.round(ay));
  { const ax=m=>ax0+m*u, top=m=>hz+h*.012-m*u; ctx.save(); ctx.globalCompositeOperation="lighter";
    { const bx=ax(AP.tower), by=top(21), ba=t*2*Math.PI/5;   // faro de aeródromo: dos haces opuestos (verde y blanco) que giran a 12 rpm; destello al apuntar a la cámara
      for(let k=0;k<2;k++){ const a=ba+k*Math.PI, fc=Math.sin(a), cs=Math.cos(a), col=k?"255,255,255":"120,255,150";
        if(N>.05){ const Lb=h*(1.1+.9*Math.abs(cs)), ex=bx+cs*Lb, ey=by+Lb*.025, wd=Lb*(.05+.07*Math.max(0,fc)), al=.20*N*(.3+.7*Math.max(0,fc))*Math.min(1,Math.abs(cs)*3+.15);
          const g2=ctx.createLinearGradient(bx,by,ex,ey); g2.addColorStop(0,`rgba(${col},${al})`); g2.addColorStop(1,`rgba(${col},0)`); ctx.globalAlpha=1; ctx.fillStyle=g2;
          ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(ex,ey-wd); ctx.lineTo(ex,ey+wd); ctx.closePath(); ctx.fill(); }
        if(fc>.97) glow(ctx,bx,by,Math.max(5,(3+8*N)*u*1.6),col,(.4+.55*N)*sstep(.97,1,fc)); } }
    if((t%2)<1){ glow(ctx,ax(AP.tower),top(24.2),Math.max(2,3*u),"255,50,40",.5+.45*N); glow(ctx,ax(AP.radar),top(15.4),Math.max(2,3*u),"255,50,40",.5+.45*N); glow(ctx,ax(947.7),top(19.4),Math.max(2,2.6*u),"255,50,40",.3+.5*N); }
    ctx.restore(); ctx.globalAlpha=1;
    const rw=Math.abs(Math.cos(t*1.9))*4.6*u+.8; ctx.fillStyle=css(mix(haze,mul([70,76,88],env.amb),.6)); ctx.fillRect(ax(AP.radar)-rw,top(14.6),rw*2,Math.max(1,1.5*u)); }   // radar girando
  if(N>.03){ ctx.save(); ctx.globalCompositeOperation="lighter"; for(let i=0;i<34;i++){ const xx=((i*137.5+cam*pm*.03)%(w+60)+w+60)%(w+60)-30, yy=hz-h*.004-((i*29)%9)*h*.004; glow(ctx,xx,yy,h*.011,(i%5===0)?"255,170,110":"255,226,170",.5*N); } ctx.restore(); ctx.globalAlpha=1; }
  { const hA=(.10+.16*(1-env.amb)+.18*sstep(.3,1,env.cover))*(1-.4*N), g3=ctx.createLinearGradient(0,hz-h*.05,0,y1);   // bruma atmosférica: lo lejano se funde con el color del horizonte
    g3.addColorStop(0,css(haze,0)); g3.addColorStop(.35,css(haze,hA)); g3.addColorStop(1,css(haze,hA*.15)); ctx.fillStyle=g3; ctx.fillRect(0,hz-h*.05,w,y1-hz+h*.05); }
  // calle de rodaje paralela y enlace con punto de espera, en metros reales sobre el suelo (misma proyección que la pista)
  const rng=Math.max(8,(y1-hz)/(pm*kz)), GT={zT:-15-.72*rng, w:Math.max(4,.26*rng)}; GT.zE=GT.zT+GT.w/2; GT.zH=(GT.zE-15)/2;
  const TRF=o.cycle?traffic(TS_,GT):[], stopBar=!TRF.length||!(TS_.u>5.8&&TS_.u<14);
  // más allá de la pista el suelo se ve en perspectiva: escala que cae hasta la del aeródromo lejano en el horizonte
  const sOf=z=>z>=-15?1:lerp(1,.13,clamp((-15-z)/rng,0,1)), cxv=X(XL)-15*pm*PS;
  const GM=(x,z)=>{ if(z>=-15) return GP(x,z); const e=X(x)-15*pm*PS, k=clamp((-15-z)/rng,0,1), s2=sOf(z); return [cxv+(e-cxv)*s2, y1-(y1-hz)*k]; };
  const quad=(xA,xB,zA,zB)=>{ const p1=GM(xA,zA), p2=GM(xB,zA), p3=GM(xB,zB), p4=GM(xA,zB); ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.lineTo(p3[0],p3[1]); ctx.lineTo(p4[0],p4[1]); ctx.closePath(); ctx.fill(); };
  { const xa=cam-60-viewM, xb2=cam+2*viewM+60, nearL=XL>xa-12&&XL<xb2+12;
    ctx.fillStyle=css(mul(tint([58,60,64],mix([255,255,255],env.sun,.25)),.3+.7*env.amb)); quad(xa,xb2,GT.zT-GT.w/2,GT.zE); if(nearL) quad(XL-4.5,XL+4.5,GT.zE+.05,-15);
    ctx.fillStyle=css(mul([226,186,50],.3+.6*env.amb)); quad(xa,xb2,GT.zT-.14,GT.zT+.14);   // eje amarillo
    if(nearL){ quad(XL-.14,XL+.14,GT.zT,-15); quad(XL-4.5,XL+4.5,GT.zH-.6,GT.zH-.4); quad(XL-4.5,XL+4.5,GT.zH-.3,GT.zH-.1);   // marca de punto de espera: 2 continuas + 2 discontinuas
      for(let k=0;k<6;k++){ quad(XL-4.5+k*1.6,XL-3.6+k*1.6,GT.zH+.05,GT.zH+.25); quad(XL-4.5+k*1.6,XL-3.6+k*1.6,GT.zH+.35,GT.zH+.55); } }
    if(N>.03){ ctx.save(); ctx.globalCompositeOperation="lighter";
      for(let m=Math.floor(xa/20)*20;m<xb2;m+=20){ const z1=GT.zT-GT.w/2-.4, z2=GT.zE+.4; let p=GM(m,z1); glow(ctx,p[0],p[1],pm*sOf(z1)*(.4+.6*N),"70,120,255",.8*N); p=GM(m+10,z2); glow(ctx,p[0],p[1],pm*sOf(z2)*(.4+.6*N),"70,120,255",.85*N); }
      for(let m=Math.floor(xa/8)*8;m<xb2;m+=8){ const p=GM(m+3,GT.zT); glow(ctx,p[0],p[1],pm*sOf(GT.zT)*(.3+.4*N),"80,255,140",.55*N); }
      ctx.restore(); ctx.globalAlpha=1; }
    if(nearL){ ctx.save(); ctx.globalCompositeOperation="lighter";   // barra de parada roja (encendida mientras la pista está ocupada; verde de guía al autorizar) y luces de guarda ámbar
      const zb=GT.zH-.8, sb=sOf(zb);
      for(let k=-2;k<=2;k++){ const p=GM(XL+k*1.8,zb); if(stopBar) glow(ctx,p[0],p[1],pm*sb*(.5+.6*N),"255,40,30",.5+.5*N); else glow(ctx,p[0],p[1],pm*sb*(.45+.5*N),"80,255,140",.35+.5*N); }
      const p=GM(((t*1.7)%1)<.5?XL-5.4:XL+5.4,zb); glow(ctx,p[0],p[1]-pm*sb*.5,pm*sb*(.55+.6*N),"255,200,40",.5+.4*N);
      ctx.restore(); ctx.globalAlpha=1; } }
  // PAPI (4 unidades junto al punto de visada): el color de cada una depende del ángulo real con que la ve el piloto del avión en final
  { const px0=PAPI.x, th=K.pth; if(X(px0)>-60&&X(px0)<w+60){ for(let i=0;i<4;i++){ const p=GP(px0,PAPI.z0-i*PAPI.dz); ctx.fillStyle="#2b2e33"; ctx.fillRect(p[0]-pm*.3,p[1]-pm*.32,pm*.6,pm*.32); }
      ctx.save(); ctx.globalCompositeOperation="lighter";
      for(let i=0;i<4;i++){ const p=GP(px0,PAPI.z0-i*PAPI.dz), wf=th==null?(i>=2?1:0):sstep(PAPI.S[i]-.05,PAPI.S[i]+.05,th), c=mix([255,40,30],[255,255,250],wf);
        glow(ctx,p[0],p[1]-pm*.3,pm*(.5+.45*N),(c[0]|0)+","+(c[1]|0)+","+(c[2]|0),.7+.2*N); }
      ctx.restore(); ctx.globalAlpha=1;
      for(let i=0;i<4;i++){ const p=GP(px0,PAPI.z0-i*PAPI.dz), wf=th==null?(i>=2?1:0):sstep(PAPI.S[i]-.05,PAPI.S[i]+.05,th); ctx.fillStyle=css(mix([235,30,24],[255,255,248],wf)); ctx.beginPath(); ctx.arc(p[0],p[1]-pm*.3,Math.max(1,pm*.16),0,7); ctx.fill(); } } }
  // manga de viento: cono a franjas (5 franjas ≈ 3 kt cada una; extendida del todo a 15 kt), apunta hacia donde va el viento y ondea con las rachas
  const WD=windAt(tt);
  { const m0=Math.floor((cam+40)/260)*260+96, zp=-20.5, H0=4.2, p=GP(m0,zp), Wn=clamp(WD.kt/15,0,1), SP=(x,z,y)=>{ const q=GP(x,z); return [q[0],q[1]-y*pm]; };
    ctx.strokeStyle=css(mul([210,214,220],.3+.7*env.amb)); ctx.lineWidth=Math.max(1,h*.006); ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[0],p[1]-H0*pm); ctx.stroke();
    let cx=m0, cz=zp, cy=H0; const dd=WD.d+.09*Math.sin(tt*5.3)*(.4+Wn), pts=[SP(cx,cz,cy)], R=[.42], n=5, Ls=3.6;
    for(let i=1;i<=n;i++){ const dl=(lerp(78,3,Math.pow(Wn,.8))+(i/n)*(1-Wn)*14+3.5*Math.sin(tt*7.3+i*.9)*(.25+Wn))*D2R, sl=Ls/n;
      cx+=Math.cos(dl)*Math.cos(dd)*sl; cz+=Math.cos(dl)*Math.sin(dd)*sl; cy-=Math.sin(dl)*sl; pts.push(SP(cx,cz,cy)); R.push(lerp(.42,.17,i/n)*(1-.25*(1-Wn)*(i/n))); }
    const kk=.32+.68*env.amb;
    for(let i=0;i<n;i++){ const a=pts[i], b=pts[i+1], dx=b[0]-a[0], dy=b[1]-a[1], l=Math.hypot(dx,dy)||1, nx=-dy/l, ny=dx/l, ra=R[i]*pm, rb=R[i+1]*pm, sh=.82+.18*Math.sin(i*1.7+tt*3);
      ctx.fillStyle=css(mul(i%2?[238,238,236]:[236,92,28],kk*sh)); ctx.beginPath(); ctx.moveTo(a[0]+nx*ra,a[1]+ny*ra); ctx.lineTo(b[0]+nx*rb,b[1]+ny*rb); ctx.lineTo(b[0]-nx*rb,b[1]-ny*rb); ctx.lineTo(a[0]-nx*ra,a[1]-ny*ra); ctx.closePath(); ctx.fill(); }
    if(N>.1){ ctx.save(); ctx.globalCompositeOperation="lighter"; glow(ctx,p[0],p[1]-H0*pm-pm*.4,pm*1.4,"255,236,190",.7*N); glow(ctx,p[0],p[1]-H0*pm-pm*.9,pm*.6,"255,40,30",.6*N); ctx.restore(); ctx.globalAlpha=1; } }
  // asfalto
  ctx.save(); ctx.beginPath(); ctx.rect(0,y1,w,y2-y1); ctx.clip();
  const sc=(y2-y1)/64; ctx.save(); { const P=256*sc*4; ctx.translate(-((((cam*pm)%P)+P)%P),y1); } ctx.scale(sc*4,sc); ctx.fillStyle=ctx.createPattern(asph,"repeat"); ctx.fillRect(0,0,(w/(sc*4))+260,64); ctx.restore();
  ctx.fillStyle=css(mul(tint([36,38,42],mix([255,255,255],env.sun,.25)),.35+.65*env.amb),lerp(.95,.62,env.amb)); ctx.fillRect(0,y1,w,y2-y1);
  if(X(THR)>0){ ctx.fillStyle=G([98,112,62],.95); ctx.beginPath(); const p1=GP(THR,-RW/2), p2=GP(THR,RW/2); ctx.moveTo(0,y1); ctx.lineTo(p1[0],y1); ctx.lineTo(p2[0],y2); ctx.lineTo(0,y2); ctx.closePath(); ctx.fill(); }   // antes del umbral: hierba
  // marcas: todo en metros sobre el suelo (x a lo largo, z a lo ancho)
  ctx.save(); ctx.transform(pm,0,pm*PS,pm*kz,X(0),yc);
  ctx.fillStyle="rgba(12,12,14,.36)"; for(let m=Math.floor((cam-40)/90)*90;m<cam+viewM+90;m+=90){ if(m<THR+30) continue; ctx.fillRect(m+8,-2.6,46,1.5); ctx.fillRect(m+30,1.4,38,1.3); }
  ctx.fillRect(118,-4.2,70,2.2); ctx.fillRect(126,2,62,2.4);   // goma de la zona de contacto
  const wl=css(mul(tint([236,236,230],mix([255,255,255],env.sun,.3)),.3+.7*env.amb)); ctx.fillStyle=wl;
  const xa=Math.max(THR,cam-60), xb=cam+viewM+60; ctx.fillRect(xa,-RW/2+.6,xb-xa,.9); ctx.fillRect(xa,RW/2-1.5,xb-xa,.9);
  for(let m=Math.max(30,Math.floor(cam/60)*60-60);m<xb;m+=60) ctx.fillRect(m,-.45,30,.9);
  if(X(THR+60)>-pm*40){ for(let i=0;i<8;i++){ const z=-12.6+i*3.6; ctx.fillRect(THR+6,z-.9,22,1.8); }   // umbral: 8 franjas de 1,8 m para pista de 30 m («piano keys»), a 6 m del borde
    ctx.save(); ctx.translate(THR+25,0); ctx.rotate(Math.PI/2); ctx.font="bold 9.5px Arial,Helvetica,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("27",0,0); ctx.restore(); }
  ctx.fillRect(150,-9.5,22.5,6); ctx.fillRect(150,3.5,22.5,6);   // punto de visada
  [[75,3],[240,2],[330,2],[420,1],[510,1]].forEach(q=>{ for(let k=0;k<q[1];k++){ const z0=3.5+k*3.3; ctx.fillRect(q[0],-z0-1.8,22.5,1.8); ctx.fillRect(q[0],z0,22.5,1.8); } });   // TDZ: pares de 3, 2, 2, 1, 1 franjas
  ctx.restore(); ctx.restore();
  // hierba cercana
  g=ctx.createLinearGradient(0,y2,0,H); g.addColorStop(0,G([92,108,56],.9)); g.addColorStop(1,G([66,82,40],.85)); ctx.fillStyle=g; ctx.fillRect(0,y2,w,H-y2);
  // luces de pista
  { ctx.save(); ctx.globalCompositeOperation="lighter"; const A=.16+.84*N, x0=Math.max(THR+13,Math.floor(cam/30)*30-30);
    for(let m=x0;m<xb;m+=30){ const p=GP(m,-RW/2-.6); glow(ctx,p[0],p[1],pm*(.45+.9*N),"255,246,214",.75*A); }                      // borde lejano
    for(let m=Math.max(THR+28,Math.floor(cam/15)*15-15);m<xb;m+=15){ glow(ctx,X(m+7),yc,pm*(.3+.5*N),"255,255,235",.65*N); }      // eje
    if(X(THR)>-pm*120){ for(let i=0;i<10;i++){ const p=GP(THR,-13.5+i*3); glow(ctx,p[0],p[1],pm*(.4+.7*N),"60,255,120",.25+.7*N); }   // umbral: verdes
      [-22,-19.5,-17,17,19.5,22].forEach(z=>{ const p=GP(THR,z); glow(ctx,p[0],p[1],pm*(.4+.7*N),"60,255,120",.2+.7*N); });         // barras de ala
      const fi=Math.floor(((t*1.6)%1)*9);
      for(let k=1;k<=7;k++){ const xm=THR-k*12; for(let j=-1;j<=1;j++){ const p=GP(xm,j*1.6); glow(ctx,p[0],p[1],pm*(.35+.6*N),"255,250,235",.15+.75*N); }
        if(k===3) for(let j=-4;j<=4;j++){ if(!j) continue; const p=GP(xm,j*3); glow(ctx,p[0],p[1],pm*(.35+.6*N),"255,250,235",.15+.75*N); }
        if(7-k===fi){ const p=GP(xm,0); glow(ctx,p[0],p[1],pm*(1.4+2.4*N),"255,255,255",.5+.5*N); } } }                                // destellos secuenciales de aproximación
    ctx.restore(); ctx.globalAlpha=1; }
  // sombra del avión (sobre el suelo, con su rumbo real)
  const gp=GP(xw,K.z), px=gp[0], py=gp[1]-alt*pm, sh=clamp(1-alt/14,0,1);
  if(sh>0&&(env.el>1||env.night>.5)){ const off=env.el>1?clamp(1/Math.tan(Math.max(env.el,8)*D2R),0,3)*(env.az<180?1:-1):0;
    ctx.save(); ctx.transform(pm,0,pm*PS,pm*kz,X(xw+off*(1+alt*.6)),yc); ctx.translate(0,K.z+alt*.5); ctx.rotate(K.psi); ctx.fillStyle=`rgba(0,0,0,${(.30*env.amb+.08)*sh*(1-.5*sstep(.6,1,env.cover))})`;
    ctx.beginPath(); ctx.ellipse(-1.5,0,4.1,.5,0,0,7); ctx.fill(); ctx.beginPath(); ctx.ellipse(.0,0,.72,5.4,0,0,7); ctx.fill(); ctx.beginPath(); ctx.ellipse(-5.2,0,.42,1.7,0,0,7); ctx.fill(); ctx.restore(); }
  // haz de la luz de aterrizaje sobre la pista
  if(env.night>.2&&alt<12){ const an=env.night*clamp(1-alt/12,0,1); ctx.save(); ctx.transform(pm,0,pm*PS,pm*kz,X(xw),yc); ctx.translate(0,K.z); ctx.rotate(K.psi); ctx.globalCompositeOperation="lighter";
    const q=ctx.createLinearGradient(2,0,60,0); q.addColorStop(0,`rgba(255,248,220,${.34*an})`); q.addColorStop(1,"rgba(255,248,220,0)"); ctx.fillStyle=q; ctx.beginPath(); ctx.moveTo(2.4,-.4); ctx.lineTo(60,-11); ctx.lineTo(60,11); ctx.lineTo(2.4,.4); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // borde cercano: balizas
  for(let m=Math.max(THR+13,Math.floor(cam/60)*60-60);m<xb;m+=60){ const p=GP(m+15,RW/2+.6), x=p[0], y=Math.min(p[1],y2+h*.02); ctx.fillStyle="#3a3d42"; ctx.fillRect(x-1,y-h*.02,2,h*.02);
    ctx.save(); ctx.globalCompositeOperation="lighter"; glow(ctx,x,y-h*.024,h*(.02+.04*env.night),"255,246,214",.3+.6*sstep(.1,.6,env.night)); ctx.restore(); ctx.globalAlpha=1; }
  const FX=cv._fx||(cv._fx={sm:[],tr:[],c:-1,smc:-1});
  if(o.cycle){ if(TS_.cyc!==FX.c){ FX.c=TS_.cyc; FX.sm.length=0; FX.tr.length=0; }
    const wv=WD.kt*.514;
    // humo blanco discreto al tocar: nace en las dos ruedas principales, se queda donde nació y deriva con el viento
    if(K.td>=0&&K.td<.25&&FX.smc!==TS_.cyc){ FX.smc=TS_.cyc; for(const sd of [-1,1]){ const b=b2w(K,[0,.2,sd*1.25]);
        for(let i=0;i<7;i++) FX.sm.push({x:xw+b[0]+(i-3)*.35,z:K.z+b[2]+(rnd()-.5)*.4,t0:tt+i*.035,L:1.1+rnd()*.6,r:1.3+rnd()*.9}); } }
    // estelas de condensación en las puntas de plano con factor de carga alto (viraje cerrado o recogida tras la barrena)
    const Cm=cycleModel(), uu=TS_.u; let nld=1/Math.max(.25,Math.cos(K.roll||0));
    if(uu>=TOTL&&uu<Cm.UE-.1){ const c2=cycleAt(uu+.06), qd=(c2.pitch-K.pitch)/.06; nld=Math.max(nld,1+Math.max(0,(K.v||0)*qd*Math.cos(K.roll||0))/9.81); }
    const em=sstep(1.3,2.0,nld)*(alt>1.5?1:0);
    if(em>.02) for(const sd of [-1,1]){ const b=b2w(K,[-.44,2.3,sd*5.45]); FX.tr.push({x:xw+b[0],z:K.z+b[2],a:alt+b[1],t:tt,s:sd,i:em}); }
    FX.tr=FX.tr.filter(p=>tt-p.t<1.8); FX.sm=FX.sm.filter(p=>tt-p.t0<p.L);
    if(FX.tr.length>1){ ctx.save(); ctx.lineCap="round"; ctx.lineWidth=Math.max(.8,pm*.07);
      for(const sd of [-1,1]){ let pr=null; for(const p of FX.tr){ if(p.s!==sd) continue; const q=GP(p.x+wv*Math.cos(WD.d)*(tt-p.t)*.3,p.z+wv*Math.sin(WD.d)*(tt-p.t)*.3); q[1]-=p.a*pm;
          if(pr&&p.t-pr.t<.12){ const ag=tt-p.t; ctx.strokeStyle=`rgba(255,255,255,${(.55*p.i*(1-ag/1.8)*(1-.55*N)).toFixed(3)})`; ctx.beginPath(); ctx.moveTo(pr.q[0],pr.q[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); }
          pr={t:p.t,q}; } }
      ctx.restore(); }
    for(const p of FX.sm){ const ag=tt-p.t0; if(ag<0) continue; const k=ag/p.L, q=GP(p.x+wv*Math.cos(WD.d)*ag*.6,p.z+wv*Math.sin(WD.d)*ag*.6), r=pm*lerp(.25,p.r,Math.sqrt(k));
      glow(ctx,q[0],q[1]-pm*(.3+.7*k),r,"236,236,234",.42*Math.pow(1-k,1.5)*(1-.45*N)); }
    ctx.globalAlpha=1; }
  // avión
  const fade=o.cycle?1:sstep(0,.8,tt)*(1-sstep(T-1,T-.2,tt))*(tt<T?1:0);
  const drawMain=()=>{ ctx.globalAlpha=fade; if(fade>0&&px>-14*pm&&px<w+14*pm&&py>-6*pm) plane3D(ctx,px,py,pm,K,env,t,o.lift); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over"; };
  let mainDone=false;
  if(TRF.length){ TRF.sort((a,b)=>a.z-b.z);
    for(const T of TRF){ const q=T.alt>0?GP(T.x,T.z):GM(T.x,T.z); T.sk=sOf(T.z); T.sx=q[0]; T.sy=q[1]-T.alt*pm; T.vis=T.sx>-12*pm&&T.sx<w+12*pm&&T.sy>-5*pm&&T.sy<H+3*pm;
      if(T.vis&&T.alt<8&&(env.el>1||env.night>.5)){ const sh2=clamp(1-T.alt/8,0,1), off=env.el>1?clamp(1/Math.tan(Math.max(env.el,8)*D2R),0,3)*(env.az<180?1:-1):0, gq=GM(T.x,T.z), ss=pm*T.sk;   // sombra en el suelo
        ctx.save(); ctx.translate(gq[0],gq[1]); ctx.transform(ss,0,ss*PS,ss*kz,0,0); ctx.translate(off*(1+T.alt*.6),T.alt*.5); ctx.rotate(T.st.psi); ctx.fillStyle=`rgba(0,0,0,${(.26*env.amb+.07)*sh2*(1-.5*sstep(.6,1,env.cover))})`;
        if(T.M===GLIDER){ ctx.beginPath(); ctx.ellipse(-1,0,4.4,.32,0,0,7); ctx.fill(); ctx.beginPath(); ctx.ellipse(.4,0,.45,9,0,0,7); ctx.fill(); }
        else{ ctx.beginPath(); ctx.ellipse(-1.5,0,4.1,.5,0,0,7); ctx.fill(); ctx.beginPath(); ctx.ellipse(0,0,.72,5.4,0,0,7); ctx.fill(); ctx.beginPath(); ctx.ellipse(-5.2,0,.42,1.7,0,0,7); ctx.fill(); }
        ctx.restore(); } }
    for(const T of TRF){ if(!mainDone&&T.z>K.z){ drawMain(); mainDone=true; }
      if(T.vis){ if(T.g&&env.night>.2){ const an=env.night*T.st.ll; const gq=GM(T.x,T.z), ss=pm*T.sk; ctx.save(); ctx.translate(gq[0],gq[1]); ctx.transform(ss,0,ss*PS,ss*kz,0,0); ctx.rotate(T.st.psi); ctx.globalCompositeOperation="lighter";   // haz del faro de rodaje en el suelo
          const q=ctx.createLinearGradient(2,0,22,0); q.addColorStop(0,`rgba(255,246,214,${.30*an})`); q.addColorStop(1,"rgba(255,246,214,0)"); ctx.fillStyle=q; ctx.beginPath(); ctx.moveTo(2.4,-.3); ctx.lineTo(22,-5); ctx.lineTo(22,5); ctx.lineTo(2.4,.3); ctx.closePath(); ctx.fill(); ctx.restore(); }
        plane3D(ctx,T.sx,T.sy,pm*T.sk,T.st,env,t,o.lift,T.M); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over"; } } }
  if(!mainDone) drawMain();
  // calima sobre el horizonte
  const hg=ctx.createLinearGradient(0,hz-h*.1,0,hz+h*.05); hg.addColorStop(0,css(haze,0)); hg.addColorStop(.7,css(haze,.32)); hg.addColorStop(1,css(haze,0)); ctx.fillStyle=hg; ctx.fillRect(0,hz-h*.1,w,h*.15);
  return {kt:v*1.944, alt:alt*3.281, cam, hz, dy, y1, y2, pm};
}


/* ---------- bucles ---------- */
const still=()=>!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);
const fit=(c)=>{ const dpr=Math.min(2,window.devicePixelRatio||1), w=Math.round(c.clientWidth*dpr), h=Math.round(c.clientHeight*dpr); if(!w||!h) return false; if(c.width!==w||c.height!==h){ c.width=w; c.height=h; c._ck=""; } return true; };
let cover=.25;
function header(c,o){
  if(!c||c._on) return; c._on=1; const clk=()=>(window.performance&&performance.now)?performance.now():Date.now(); let t0=clk(), last=0, raf=0, seen=0;
  const frame=()=>{ const now=clk(); if(now-last<30) return; last=now; seen=now; if(document.hidden||!fit(c)) return;
    const env=envAt(new Date(),cover), oo=Object.assign({cycle:true},typeof o==="function"?o(c.clientHeight):o);
    try{ drawTakeoff(c,env,now/1000,(now-t0)/1000,oo); }catch(e){ if(!c._err){ c._err=1; try{ console.error("F0Real",e); }catch(_){} } } };
  const tick=()=>{ raf=requestAnimationFrame(tick); frame(); };
  raf=requestAnimationFrame(tick);
  setInterval(()=>{ if(document.hidden) return; if(clk()-seen>400){ try{ cancelAnimationFrame(raf); }catch(e){} frame(); raf=requestAnimationFrame(tick); } },250);   // Safari móvil: si rAF se queda parado, se pinta por temporizador y se rearma
  ["pageshow","focus","orientationchange"].forEach(ev=>window.addEventListener(ev,()=>{ last=0; frame(); }));
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ last=0; try{ cancelAnimationFrame(raf); }catch(e){} raf=requestAnimationFrame(tick); } });
}
function sky(c,o){
  if(!c) return; if(o&&o.cover!=null) c._cov=clamp(+o.cover||0,0,1); if(c._iv&&c.isConnected) return;
  const draw=()=>{ if(document.hidden||!c.isConnected||!fit(c)) return; try{ drawSky(c,envAt(new Date(),c._cov!=null?c._cov:cover),performance.now()/1000); }catch(e){} };
  draw(); if(c._iv) clearInterval(c._iv); c._iv=setInterval(()=>{ if(!c.isConnected){ clearInterval(c._iv); return; } draw(); },still()?30000:300);
}
window.F0Real={plane3D,PD,header,sky,setCover:v=>{ if(v!=null&&isFinite(v)) cover=clamp(+v,0,1); },envAt,drawTakeoff,drawSky};
})();
