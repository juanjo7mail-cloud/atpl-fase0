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
const MESH=(function(){
  const F=[], W=[244,246,250], B=[24,84,170], G=[26,38,54], DK=[60,66,76], GR=[196,202,210];
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
  // fuselaje: [x, y bajo, y cintura, y techo, semiancho, semiancho techo]
  const FS=[[2.30,.92,1.50,1.53,.40,.33],[1.35,.80,1.66,1.70,.52,.45],[.70,.76,1.58,2.20,.56,.46],[-.90,.78,1.58,2.20,.54,.44],[-1.70,.92,1.62,2.02,.44,.31],[-3.60,1.22,1.60,1.80,.22,.14],[-5.65,1.45,1.58,1.68,.05,.04]];
  const ring=s=>{ const x=s[0], yb=s[1], yw=s[2], yt=s[3], w=s[4], wt=s[5], ym=yb+.3*(yw-yb), ye=yt-Math.min(.06,(yt-yw)*.5);
    return [[x,yb,.55*w],[x,ym,w],[x,yw,w],[x,ye,wt],[x,yt,.45*wt],[x,yt,-.45*wt],[x,ye,-wt],[x,yw,-w],[x,ym,-w],[x,yb,-.55*w]]; };
  loft(FS.map(ring),(i,k)=>{ if(k===0||k===8) return i<6?B:W; if(i===1&&k>=2&&k<=6) return G; if((i===2||i===3)&&(k===2||k===6)) return G; return W; },DK,W);
  F.forEach(f=>{ if(f.c===G) f.glass=1; });
  // cono de la hélice
  const sp=(x,r)=>Array.from({length:6},(_,k)=>[x,1.22+r*Math.sin(k*Math.PI/3),r*Math.cos(k*Math.PI/3)]);
  loft([sp(2.30,.17),sp(2.47,.11),sp(2.63,.012)],B,false,false);
  // perfil genérico [x/c, y/c]
  const AF=[[0,.046],[-.12,.101],[-.42,.117],[-1,.037],[-.5,0],[-.06,0]];
  const wsec=(z,c,x0,y0,th)=>AF.map(a=>[x0+a[0]*c,y0+a[1]*c*(th||1),z]);
  const WS=[[-5.5,1.10,.66,2.36],[-5.15,1.16,.68,2.35],[-2.6,1.63,.78,2.275],[0,1.63,.78,2.2],[2.6,1.63,.78,2.275],[5.15,1.16,.68,2.35],[5.5,1.10,.66,2.36]];
  loft(WS.map(s=>wsec(s[0],s[1],s[2],s[3])),(i)=>(i===0||i===5)?B:W);
  // estabilizador horizontal
  loft([[-1.72,.70,-5.05,1.63],[0,1.16,-4.72,1.61],[1.72,.70,-5.05,1.63]].map(s=>wsec(s[0],s[1],s[2],s[3],.6)),W);
  // deriva (con punta azul)
  const fin=(y,xl,xt,th)=>{ const xm=xl+(xt-xl)*.35; return [[xl,y,0],[xm,y,th],[xt,y,0],[xm,y,-th]]; };
  loft([fin(1.62,-4.25,-5.90,.055),fin(2.42,-5.08,-5.96,.04),fin(2.74,-5.42,-5.99,.028)],(i)=>i===1?B:W);
  const O=[];   // piezas finas: montantes, patas, ruedas, hélice
  [-1,1].forEach(s=>{ O.push({l:[[.42,.86,s*.56],[.34,2.27,s*2.55]],w:.075,c:GR}); O.push({l:[[.12,.84,s*.46],[0,.24,s*1.22]],w:.10,c:GR}); O.push({d:[0,.2,s*1.25],r:.2}); });
  O.push({l:[[1.60,.88,0],[1.66,.2,0]],w:.07,c:GR}); O.push({d:[1.66,.18,0],r:.17}); O.push({prop:[2.42,1.22,0],r:.95});
  F.forEach(f=>{ f.n=nrm(f.p); f.q=f.p.map(()=>[0,0]); });
  return {F,O};
})();
/* luces (ejes del avión: x morro, y arriba, z ala derecha) */
const LTS=[{p:[.25,2.40,5.52],k:"g"},{p:[.25,2.40,-5.52],k:"r"},{p:[-6.0,1.92,0],k:"w"},{p:[-5.62,2.78,0],k:"b"},{p:[.2,2.42,5.5],k:"s"},{p:[.2,2.42,-5.5],k:"s"},{p:[2.32,.98,0],k:"l"}];
const sect=(az,a,b,res)=>{ const d=az<a?a-az:az>b?az-b:0; return d<=0?1:lerp(1,res,clamp(d/26,0,1)); };   // sector reglamentario: fuera de él queda solo el reflejo del farol
const SORT=[];
function plane3D(ctx,sx,sy,pm,st,env,t){
  const cp=Math.cos(st.psi), sp=Math.sin(st.psi), ca=Math.cos(st.pitch), sa=Math.sin(st.pitch), cr=Math.cos(st.roll), sr=Math.sin(st.roll);
  // cuerpo → mundo (alabeo, cabeceo sobre las ruedas, rumbo)
  const TR=(b,o)=>{ const y1=b[1]*cr-b[2]*sr, z1=b[2]*cr+b[1]*sr, x2=b[0]*ca-y1*sa, y2=y1*ca+b[0]*sa; o[0]=cp*x2-sp*z1; o[1]=y2; o[2]=sp*x2+cp*z1; return o; };
  const PR=(wv,o)=>{ const dep=wv[0]*PD[0]+wv[1]*PD[1]+wv[2]*PD[2], k=PDIST/(PDIST+dep)*pm; o[0]=sx+k*(wv[0]+PS*wv[2]); o[1]=sy+k*(-wv[1]+PZ*wv[2]); return dep; };
  const Lc=mix([255,255,255],env.sun,.4), amb=.34+.30*env.amb, dif=.16+.56*env.amb, sxn=lerp(-.75,.75,clamp((env.az-60)/240,0,1)), sl=Math.hypot(sxn,.62,.55), L=[sxn/sl,.62/sl,.55/sl];
  const tv=[0,0,0], nv=[0,0,0], items=SORT; items.length=0;
  for(const f of MESH.F){ TR(f.n,nv); const vis=-(nv[0]*PD[0]+nv[1]*PD[1]+nv[2]*PD[2]); if(vis<=.015) continue;
    let dep=0; for(let i=0;i<f.p.length;i++){ TR(f.p[i],tv); dep+=PR(tv,f.q[i]); } f.dep=dep/f.p.length;
    const lam=Math.max(0,nv[0]*L[0]+nv[1]*L[1]+nv[2]*L[2]), sky=.5+.5*nv[1]; let c;
    if(f.glass){ const g=mix(mul(env.top,.5),mul(env.hor,.85),clamp(.4+.6*lam,0,1)); c=mix(mix(f.c,g,.55),[255,255,255],Math.pow(lam,6)*.5*env.amb); }
    else{ const k=amb*(.72+.28*sky)+dif*lam; c=[f.c[0]*k*Lc[0]/255,f.c[1]*k*Lc[1]/255,f.c[2]*k*Lc[2]/255]; }
    f.col=css(c); items.push(f); }
  const o2=[0,0], o3=[0,0];
  for(const p of MESH.O){ if(p.l){ TR(p.l[0],tv); const d1=PR(tv,o2); p.a=[o2[0],o2[1]]; TR(p.l[1],tv); const d2=PR(tv,o3); p.b=[o3[0],o3[1]]; p.dep=(d1+d2)/2-.05; }
    else if(p.d){ TR(p.d,tv); p.dep=PR(tv,o2)-.12; p.a=[o2[0],o2[1]]; }
    else{ TR(p.prop,tv); p.dep=PR(tv,o2); p.a=[o2[0],o2[1]]; TR([p.prop[0],p.prop[1]+p.r,0],tv); PR(tv,o3); p.u=[o3[0]-o2[0],o3[1]-o2[1]]; TR([p.prop[0],p.prop[1],p.r],tv); PR(tv,o3); p.v=[o3[0]-o2[0],o3[1]-o2[1]]; }
    items.push(p); }
  // hacia dónde está la cámara en ejes del avión → sectores de las luces
  const cw=[-PD[0],-PD[1],-PD[2]], cf=cw[0]*cp+cw[2]*sp, crr=-cw[0]*sp+cw[2]*cp, az=Math.atan2(crr,cf)/D2R, aab=Math.abs(az);
  const nl=.2+.8*sstep(.15,.75,env.night), kk=.36+.64*env.amb;
  for(const l of LTS){ TR(l.p,tv); l.dep=PR(tv,o2)-.3; l.x=o2[0]; l.y=o2[1]; l.lt=1; items.push(l); }
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
      else if(k==="b"){ if((t%1.2)<.13) glow(ctx,it.x,it.y,pm*(.5+1.3*nl),"255,40,30",.95); }
      else if(k==="s"){ if((t%1.6)<.06||((t+.2)%1.6)<.06) glow(ctx,it.x,it.y,pm*(.6+1.9*nl),"255,255,255",.95); }
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

/* ---------- escena 1: aeródromo, despegue, aterrizaje y media vuelta ---------- */
function drawTakeoff(cv,env,t,tt,o){
  o=o||{}; const ctx=cv.getContext("2d"), w=cv.width, H=cv.height, pm=H*(o.pm||.105), h=pm/.105, hz=H*(o.hz||.62), T=18, a=2.4, t0=1.2, tr=11.3, tl=12.5;
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  const viewM=w/pm, fx0=o.x0||.2, fx1=o.x1||.5, RW=30, THR=-17;
  const TO=q=>{ const tg=Math.max(0,q-t0), tq=Math.min(tg,tl-t0), vl=a*(tl-t0), xw=.5*a*tq*tq+(tg>tq?vl*(tg-tq)*1.04:0), ta=Math.max(0,q-tl), tc=tl+1.6;
    const xc=q<=tc?xw:(.5*a*(tl-t0)*(tl-t0)+vl*1.04*(tc-tl))+vl*1.04*1.3*(1-Math.exp(-(q-tc)/1.3));
    return {xw, z:5*sstep(1.6,5,ta), alt:3.4*ta*ta/(ta+1.3), pitch:(sstep(tr,tl,q)*7.5+sstep(tl,tl+2,q)*2.5)*D2R, psi:9*D2R*sstep(1.4,4.6,ta), roll:(17*sstep(1.1,3.8,ta)+(ta>0?2.6*Math.sin(ta*3.4)*Math.exp(-ta*.9):0))*D2R,
      cam:xc-viewM*lerp(fx0,fx1,sstep(0,12,q)), v:tg>tq?vl*1.04:a*tg, ll:1}; };
  let K;
  if(!o.cycle) K=TO(tt);
  else{   // despegue → 2 s → aterrizaje por la pista contraria → rodaje hasta el final → media vuelta de 180° → despegue
    const TA=14.5, P=2, AP_=5, vd=28, ad=2.6, RO=vd/ad, TU=5.2, CY=TA+P+AP_+RO+TU, u=tt%CY;
    if(u<TA+P) K=TO(u);
    else{ const s=u-TA-P, camEnd=TO(TA+P).cam, xtd=vd*vd/(2*ad);
      if(s<AP_+RO){ let xp, z=0, alt=0, pitch, v, psi=Math.PI, roll=0;
        if(s<AP_){ const q=1-s/AP_; xp=xtd+29*(AP_-s); alt=9*Math.pow(q,1.7); pitch=(1.5+4.5*sstep(AP_-2.2,AP_,s))*D2R; v=29; roll=4.5*D2R*Math.sin(s*2.3)*q; psi=Math.PI-5*D2R*(1-sstep(AP_-1.3,AP_-.1,s)); z=-1.2*q; }
        else{ const r=s-AP_, zf=x=>-10*sstep(RO-6.6,RO-.7,x); xp=xtd-(vd*r-.5*ad*r*r); pitch=6*(1-sstep(0,1.6,r))*D2R; v=vd-ad*r; z=zf(r); psi=Math.atan2((zf(r+.05)-z)/.05,-Math.max(.4,v)); roll=1.2*D2R*Math.sin(r*5)*Math.exp(-r*1.4); }
        K={xw:xp, z, alt, pitch, v, psi, roll, ll:1, cam:lerp(camEnd, xp-viewM*lerp(.62,fx0,sstep(3,AP_+RO,s)), sstep(0,4.5,s)), td:(s>=AP_&&s<AP_+1.6)?(s-AP_)/1.6:-1}; }
      else{ const r=sstep(0,1,(s-AP_-RO)/TU), an=Math.PI*r; K={xw:-5*Math.sin(an), z:-5-5*Math.cos(an), alt:0, pitch:0, v:3.4*Math.sin(an), psi:Math.PI-an, roll:2.6*D2R*Math.sin(an), ll:1, cam:-viewM*fx0}; } } }
  if(K.td==null) K.td=-1;
  const xw=K.xw, alt=K.alt, v=K.v, cam=K.cam, X=m=>(m-cam)*pm;
  const y1=H*(o.y1||.72), y2=H*(o.y2||.9), yc=(y1+y2)/2, kz=(y2-y1)/(RW*pm), GP=(x,z)=>[X(x)+z*pm*PS,yc+z*pm*kz];
  const N=sstep(.12,.7,env.night), day=1-N;
  // cielo
  skyBase(ctx,w,hz,env,t);
  const sxp=w*lerp(.1,.9,clamp((env.az-60)/240,0,1)); sunDisc(ctx,sxp,hz-(env.el/38)*hz,Math.max(3,h*.035),env,hz);
  if(env.night>.05) moon(ctx,w*(.58+.3*((env.date.getHours()+6)%12)/12),hz*.34,Math.max(3,h*.045),env);
  clouds(ctx,-w*.05,0,w*1.1,hz,env,t*.004+cam*.00012,h>150?3:2,150);
  const haze=env.hor;
  ridge(ctx,w,hz,h*.13,cam*pm*.03,.0011*640/h*.25+.0009,css(mix(haze,mul(env.top,.5),.34)),.21);
  ridge(ctx,w,hz+1,h*.05,cam*pm*.10+500,.006*72/h+.0012,css(mix(haze,mul([52,70,56],env.amb),.66)),.63);
  // hierba lejana
  const G=(c,k)=>css(mul(tint(c,mix([255,255,255],env.sun,.3)),env.amb*k));
  let g=ctx.createLinearGradient(0,hz,0,y1); g.addColorStop(0,css(mix(haze,mul([112,124,80],env.amb),.55))); g.addColorStop(1,G([104,118,66],.95)); ctx.fillStyle=g; ctx.fillRect(0,hz,w,y1-hz+1);
  // aeródromo lejano (torre, terminal, hangares, plataforma)
  const u=pm*.115, FP=.15, ax0=w*.14-cam*pm*FP, key=(u*100|0)+"|"+(env.amb*24|0)+"|"+(N*12|0)+"|"+(env.el|0);
  let ab=cv._ab; if(!ab) ab=cv._ab=document.createElement("canvas"); if(cv._abk!==key){ cv._abk=key; buildApron(ab,u,env); }
  const base=Math.ceil(AP.hgt*u), ay=hz+h*.012-base; if(ax0<w&&ax0+ab.width>0) ctx.drawImage(ab,Math.round(ax0),Math.round(ay));
  { const ax=m=>ax0+m*u, top=m=>hz+h*.012-m*u; ctx.save(); ctx.globalCompositeOperation="lighter";
    const ph=(t*.9)%2, on=ph<.16||(ph>1&&ph<1.16); if(on) glow(ctx,ax(AP.tower),top(21),Math.max(5,(3+8*N)*u*1.6),ph<1?"120,255,150":"255,255,255",.55+.4*N);   // faro de aeródromo: verde y blanco alternos
    if((t%2)<1){ glow(ctx,ax(AP.tower),top(24.2),Math.max(2,3*u),"255,50,40",.5+.45*N); glow(ctx,ax(AP.radar),top(15.4),Math.max(2,3*u),"255,50,40",.5+.45*N); glow(ctx,ax(947.7),top(19.4),Math.max(2,2.6*u),"255,50,40",.3+.5*N); }
    ctx.restore(); ctx.globalAlpha=1;
    const rw=Math.abs(Math.cos(t*1.9))*4.6*u+.8; ctx.fillStyle=css(mix(haze,mul([70,76,88],env.amb),.6)); ctx.fillRect(ax(AP.radar)-rw,top(14.6),rw*2,Math.max(1,1.5*u)); }   // radar girando
  if(N>.03){ ctx.save(); ctx.globalCompositeOperation="lighter"; for(let i=0;i<34;i++){ const xx=((i*137.5+cam*pm*.03)%(w+60)+w+60)%(w+60)-30, yy=hz-h*.004-((i*29)%9)*h*.004; glow(ctx,xx,yy,h*.011,(i%5===0)?"255,170,110":"255,226,170",.5*N); } ctx.restore(); ctx.globalAlpha=1; }
  // calle de rodaje paralela (luces azules de borde y verdes de eje)
  { const ty=lerp(hz,y1,.5), th=Math.max(1.5,(y1-hz)*.16), fp=.72, TX=m=>(m-cam*fp)*pm*fp+w*.08;
    ctx.fillStyle=css(mul(tint([52,54,58],mix([255,255,255],env.sun,.25)),.3+.7*env.amb)); ctx.fillRect(0,ty-th/2,w,th);
    ctx.fillStyle=css(mul([214,180,60],.25+.6*env.amb)); ctx.fillRect(0,ty-Math.max(.4,th*.07),w,Math.max(.6,th*.14));
    if(N>.03){ ctx.save(); ctx.globalCompositeOperation="lighter"; const m0=cam*fp-w*.08/(pm*fp), m1=m0+w/(pm*fp);
      for(let m=Math.floor(m0/30)*30;m<m1+30;m+=30){ glow(ctx,TX(m),ty-th/2,h*.014,"70,120,255",.8*N); glow(ctx,TX(m+15),ty+th/2,h*.016,"70,120,255",.85*N); }
      for(let m=Math.floor(m0/15)*15;m<m1+15;m+=15) glow(ctx,TX(m+4),ty,h*.008,"80,255,140",.6*N);
      ctx.restore(); ctx.globalAlpha=1; } }
  // PAPI (lado lejano) y manga
  { const px0=132; if(X(px0)>-60&&X(px0)<w+60){ for(let i=0;i<4;i++){ const p=GP(px0,-20.5-i*3.3); ctx.fillStyle="#2b2e33"; ctx.fillRect(p[0]-pm*.3,p[1]-pm*.32,pm*.6,pm*.32); }
      ctx.save(); ctx.globalCompositeOperation="lighter"; for(let i=0;i<4;i++){ const p=GP(px0,-20.5-i*3.3); glow(ctx,p[0],p[1]-pm*.3,pm*(.55+.6*N),i<2?"255,40,30":"255,255,250",.75+.25*N); } ctx.restore(); ctx.globalAlpha=1; } }
  { const m0=Math.floor((cam+40)/260)*260+96, p=GP(m0,-24), ph=5*pm*.8; ctx.strokeStyle=css(mul([210,214,220],env.amb)); ctx.lineWidth=Math.max(1,h*.006); ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[0],p[1]-ph); ctx.stroke();
    const fl=Math.sin(t*5)*.12; ctx.fillStyle=css(mul([232,96,30],.35+.65*env.amb)); ctx.beginPath(); ctx.moveTo(p[0],p[1]-ph); ctx.lineTo(p[0]+2.6*pm,p[1]-ph+pm*(.5+fl)); ctx.lineTo(p[0]+2.6*pm,p[1]-ph+pm*(.9+fl)); ctx.lineTo(p[0],p[1]-ph+pm*.8); ctx.closePath(); ctx.fill();
    if(N>.1){ ctx.save(); ctx.globalCompositeOperation="lighter"; glow(ctx,p[0],p[1]-ph-pm*.4,pm*1.4,"255,236,190",.7*N); ctx.restore(); ctx.globalAlpha=1; } }
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
  if(X(THR+60)>-pm*40){ for(let i=0;i<8;i++){ const z=-12.6+i*3.6-(i>3?0:0); ctx.fillRect(THR+2,z-1+(i>3?.0:0),12,1.9); }   // barras de umbral
    ctx.save(); ctx.translate(THR+25,0); ctx.rotate(Math.PI/2); ctx.font="bold 9.5px Arial,Helvetica,sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("27",0,0); ctx.restore(); }
  [[150,6],[240,4]].forEach(q=>{ ctx.fillRect(q[0],-9.5,22.5,q[1]); ctx.fillRect(q[0],9.5-q[1],22.5,q[1]); });   // punto de visada y zona de contacto
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
  if(K.td>=0){ const q=K.td, sp0=GP(28*28/(2*2.6),K.z), sx=sp0[0]+q*pm*9; ctx.fillStyle=`rgba(225,228,232,${.42*(1-q)})`; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(sx+i*pm*1.3*q,sp0[1]-h*.012-q*h*.05*(1+i*.3),h*(.014+.03*q)*(1+i*.2),0,7); ctx.fill(); } }
  // avión
  const fade=o.cycle?1:sstep(0,.8,tt)*(1-sstep(T-1,T-.2,tt))*(tt<T?1:0); ctx.globalAlpha=fade;
  if(fade>0&&px>-14*pm&&px<w+14*pm&&py>-6*pm) plane3D(ctx,px,py,pm,K,env,t); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  // calima sobre el horizonte
  const hg=ctx.createLinearGradient(0,hz-h*.1,0,hz+h*.05); hg.addColorStop(0,css(haze,0)); hg.addColorStop(.7,css(haze,.32)); hg.addColorStop(1,css(haze,0)); ctx.fillStyle=hg; ctx.fillRect(0,hz-h*.1,w,h*.15);
  return {kt:v*1.944, alt:alt*3.281};
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
