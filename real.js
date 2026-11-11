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
function plane(ctx,px,py,s,pitch,env,t,dir){
  const L=mix([255,255,255],env.sun,.35), k=.36+.64*env.amb, C=c=>css(mul(tint(c,L),k));
  dir=dir==null?1:dir; if(Math.abs(dir)<.05) dir=dir<0?-.05:.05;
  ctx.save(); ctx.translate(px,py); ctx.scale(dir,1); ctx.rotate(-pitch); ctx.scale(s,s); ctx.translate(-6,-19); ctx.lineJoin="round";
  // estabilizador y deriva
  ctx.fillStyle=C([226,230,236]); ctx.beginPath(); ctx.moveTo(-34,-5); ctx.quadraticCurveTo(-41,-12,-46,-23); ctx.lineTo(-52,-23); ctx.lineTo(-50.5,-3); ctx.closePath(); ctx.fill();
  ctx.fillStyle=C([24,84,170]); ctx.beginPath(); ctx.moveTo(-44.6,-19); ctx.lineTo(-51.7,-19); ctx.lineTo(-51.4,-14); ctx.lineTo(-42.2,-14); ctx.closePath(); ctx.fill();
  ctx.fillStyle=C([205,210,218]); ctx.beginPath(); ctx.ellipse(-45,-3.2,8.5,1.1,0,0,7); ctx.fill();
  // tren
  ctx.strokeStyle=C([170,176,186]); ctx.lineWidth=1.3; ctx.lineCap="round";
  ctx.beginPath(); ctx.moveTo(11,6); ctx.lineTo(6.5,15.5); ctx.moveTo(36,6.5); ctx.lineTo(37,15.6); ctx.stroke();
  ctx.fillStyle=C([28,30,34]); ctx.beginPath(); ctx.arc(6,16,3.1,0,7); ctx.arc(37,16.3,2.7,0,7); ctx.fill();
  ctx.fillStyle=C([150,154,160]); ctx.beginPath(); ctx.arc(6,16,1.1,0,7); ctx.arc(37,16.3,1,0,7); ctx.fill();
  // montante
  ctx.strokeStyle=C([196,202,210]); ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(15,5.5); ctx.lineTo(17,-14); ctx.stroke();
  // fuselaje
  const g=ctx.createLinearGradient(0,-15,0,9); g.addColorStop(0,C([255,255,255])); g.addColorStop(.55,C([236,239,244])); g.addColorStop(1,C([158,166,178]));
  ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(50,1.5); ctx.quadraticCurveTo(48,-4.5,42,-5.5); ctx.lineTo(31,-7); ctx.lineTo(23.5,-14.5); ctx.lineTo(3,-14.5); ctx.quadraticCurveTo(-4,-10,-12,-7.5);
  ctx.lineTo(-46,-4.2); ctx.quadraticCurveTo(-51.5,-3,-50,-1.2); ctx.lineTo(-14,5.2); ctx.quadraticCurveTo(8,8.6,30,8); ctx.quadraticCurveTo(46,7.4,50,1.5); ctx.closePath(); ctx.fill();
  // franja azul y capó
  ctx.strokeStyle=C([24,84,170]); ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(47,1.6); ctx.quadraticCurveTo(10,3.2,-47,-2.6); ctx.stroke();
  ctx.strokeStyle=C([120,128,140]); ctx.lineWidth=.35; ctx.beginPath(); ctx.moveTo(31,-7); ctx.lineTo(30,7.8); ctx.moveTo(19,-6.2); ctx.lineTo(19,6.6); ctx.lineTo(7,6); ctx.lineTo(7,-6.2); ctx.stroke();
  // ventanas
  const wg=ctx.createLinearGradient(0,-14,0,-6); wg.addColorStop(0,css(mul(mix(env.top,[20,30,44],.45),.9))); wg.addColorStop(1,css(mul(mix(env.hor,[30,40,54],.5),.8))); ctx.fillStyle=wg;
  ctx.beginPath(); ctx.moveTo(30,-7.2); ctx.lineTo(23.2,-13.6); ctx.lineTo(20,-13.6); ctx.lineTo(20,-6.4); ctx.closePath(); ctx.fill();
  ctx.fillRect(7.6,-13.4,11.4,7); ctx.beginPath(); ctx.moveTo(6.2,-13.4); ctx.lineTo(3.4,-13.4); ctx.quadraticCurveTo(-3,-10,-7,-7.8); ctx.lineTo(6.2,-6.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.18)"; ctx.beginPath(); ctx.moveTo(28,-8.6); ctx.lineTo(24,-12.6); ctx.lineTo(22.6,-12.6); ctx.lineTo(26.4,-8.4); ctx.closePath(); ctx.fill();
  // ala alta
  const ag=ctx.createLinearGradient(0,-18,0,-14); ag.addColorStop(0,C([250,251,253])); ag.addColorStop(1,C([150,158,170])); ctx.fillStyle=ag;
  ctx.beginPath(); ctx.moveTo(29,-15.4); ctx.quadraticCurveTo(29.6,-17.6,24,-17.9); ctx.lineTo(2,-17); ctx.lineTo(-1,-15.6); ctx.lineTo(3,-14.3); ctx.lineTo(25,-14.2); ctx.closePath(); ctx.fill();
  // hélice
  ctx.fillStyle=C([40,44,50]); ctx.beginPath(); ctx.moveTo(50,-1); ctx.quadraticCurveTo(54.5,1.5,50,4); ctx.closePath(); ctx.fill();
  const pg=ctx.createLinearGradient(0,-12,0,15); pg.addColorStop(0,"rgba(30,32,36,0)"); pg.addColorStop(.12,"rgba(30,32,36,.20)"); pg.addColorStop(.5,"rgba(30,32,36,.10)"); pg.addColorStop(.88,"rgba(30,32,36,.20)"); pg.addColorStop(1,"rgba(30,32,36,0)");
  ctx.fillStyle=pg; ctx.beginPath(); ctx.ellipse(51.6,1.5,1.5,13,0,0,7); ctx.fill();
  ctx.fillStyle=`rgba(255,220,60,${.35+.2*Math.sin(t*40)})`; ctx.fillRect(51,-11.4,1.2,1.4); ctx.fillRect(51,13,1.2,1.4);
  // luces
  const nl=sstep(.25,.75,env.night)*.85+.15; ctx.globalCompositeOperation="lighter";
  const glow=(x,y,r,c,a)=>{ const q=ctx.createRadialGradient(x,y,0,x,y,r); q.addColorStop(0,`rgba(${c},${a})`); q.addColorStop(1,`rgba(${c},0)`); ctx.fillStyle=q; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); };
  if((t%1.2)<.12) glow(-49,-23.5,3+7*nl,"255,40,30",.95);
  if((t%1.6)<.07||((t+.18)%1.6)<.07) glow(26,-16,3+9*nl,"255,255,255",.95);
  glow(28.6,-15.6,1.6+2*nl,"60,255,110",.9*nl);
  if(env.night>.2){ glow(44,6.5,5,"255,250,230",.9*env.night); const q=ctx.createLinearGradient(44,6,120,20); q.addColorStop(0,`rgba(255,248,220,${.28*env.night})`); q.addColorStop(1,"rgba(255,248,220,0)"); ctx.fillStyle=q; ctx.beginPath(); ctx.moveTo(44,6); ctx.lineTo(125,6); ctx.lineTo(120,30); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawTakeoff(cv,env,t,tt,o){
  o=o||{}; const ctx=cv.getContext("2d"), w=cv.width, H=cv.height, pm=H*(o.pm||.105), h=pm/.105, hz=H*(o.hz||.62), T=18, a=2.4, t0=1.2, tr=11.3, tl=12.5;
  ctx.setTransform(1,0,0,1,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation="source-over";
  const viewM=w/pm, fx0=o.x0||.2, fx1=o.x1||.5;
  const TO=q=>{ const tg=Math.max(0,q-t0), tq=Math.min(tg,tl-t0), vl=a*(tl-t0), xw=.5*a*tq*tq+(tg>tq?vl*(tg-tq)*1.04:0), ta=Math.max(0,q-tl), tc=tl+1.6;
    const xc=q<=tc?xw:(.5*a*(tl-t0)*(tl-t0)+vl*1.04*(tc-tl))+vl*1.04*1.3*(1-Math.exp(-(q-tc)/1.3));
    return {xw, alt:3.4*ta*ta/(ta+1.3), pitch:(sstep(tr,tl,q)*7.5+sstep(tl,tl+2,q)*2.5)*D2R, cam:xc-viewM*lerp(fx0,fx1,sstep(0,12,q)), dir:1, v:tg>tq?vl*1.04:a*tg}; };
  let K;
  if(!o.cycle) K=TO(tt);
  else{   // despegue → 2 s → aterrizaje por la pista contraria → rodaje hasta el final → media vuelta → despegue
    const TA=14.5, P=2, AP=5, vd=28, ad=2.6, RO=vd/ad, TU=4.6, CY=TA+P+AP+RO+TU, u=tt%CY;
    if(u<TA+P) K=TO(u);
    else{ const s=u-TA-P, camEnd=TO(TA+P).cam, xtd=vd*vd/(2*ad);
      if(s<AP+RO){ let xp, alt=0, pitch, v;
        if(s<AP){ const q=1-s/AP; xp=xtd+29*(AP-s); alt=9*Math.pow(q,1.7); pitch=(1.5+4.5*sstep(AP-2.2,AP,s))*D2R; v=29; }
        else{ const r=s-AP; xp=xtd-(vd*r-.5*ad*r*r); pitch=6*(1-sstep(0,1.6,r))*D2R; v=vd-ad*r; }
        K={xw:xp, alt, pitch, v, dir:-1, cam:lerp(camEnd, xp-viewM*lerp(.62,fx0,sstep(3,AP+RO,s)), sstep(0,4.5,s))}; }
      else{ const r=sstep(0,1,(s-AP-RO)/TU), an=Math.PI*r; K={xw:-5*Math.sin(an), alt:0, pitch:0, v:3*Math.sin(an), dir:-Math.cos(an), turn:Math.sin(an), cam:-viewM*fx0}; } } }
  if(K.td==null&&o.cycle){ const u=tt%(14.5+2+5+28/2.6+4.6), s=u-21.5; K.td=(s>=0&&s<1.6)?s/1.6:-1; }
  const xw=K.xw, alt=K.alt, pitch=K.pitch, v=K.v, cam=K.cam, X=m=>(m-cam)*pm;
  const y1=H*(o.y1||.72), y2=H*(o.y2||.9), yc=(y1+y2)/2-h*.01;
  skyBase(ctx,w,hz,env,t);
  const sxp=w*lerp(.1,.9,clamp((env.az-60)/240,0,1)); sunDisc(ctx,sxp,hz-(env.el/38)*hz,Math.max(3,h*.035),env,hz);
  clouds(ctx,-w*.05,0,w*1.1,hz,env,t*.004+cam*.00012,h>150?3:2,150);
  const haze=env.hor;
  ridge(ctx,w,hz,h*.11,cam*pm*.03,.0011*640/h*.25+.0009,css(mix(haze,mul(env.top,.5),.34)),.21);
  ridge(ctx,w,hz+1,h*.05,cam*pm*.12+500,.006*72/h+.0012,css(mix(haze,mul([52,70,56],env.amb),.66)),.63);
  // hangares y torre lejanos
  const far=.34, fx=m=>(m-cam*far)*pm*.28+w*.3, bc=css(mix(haze,mul([170,176,182],env.amb),.6)), bd=css(mix(haze,mul([90,98,108],env.amb),.62));
  [[60,26,7],[98,34,8.5],[150,22,6],[420,30,7.5],[470,40,9]].forEach(b=>{ const x=fx(b[0]), bw=b[1]*pm*.28, bh=b[2]*pm*.28; if(x>w||x+bw<0) return; ctx.fillStyle=bc; ctx.fillRect(x,hz-bh,bw,bh+1); ctx.fillStyle=bd; ctx.fillRect(x,hz-bh,bw,bh*.16); ctx.fillRect(x+bw*.12,hz-bh*.62,bw*.5,bh*.62); });
  { const x=fx(250), th=17*pm*.28; ctx.fillStyle=bc; ctx.fillRect(x,hz-th,3.2*pm*.28,th); ctx.fillStyle=bd; ctx.fillRect(x-1.6*pm*.28,hz-th-2.6*pm*.28,6.4*pm*.28,2.8*pm*.28); if(env.night>.3){ ctx.fillStyle=`rgba(255,60,40,${.9*((t%2)<1?1:.2)})`; ctx.fillRect(x+pm*.3,hz-th-3.4*pm*.28,2,2); } }
  if(env.night>.12){ const N=sstep(.12,.7,env.night), u=pm*.28; ctx.save(); ctx.globalCompositeOperation="lighter";
    const glow=(x,y,r,c,a)=>{ const q=ctx.createRadialGradient(x,y,0,x,y,r); q.addColorStop(0,`rgba(${c},${a})`); q.addColorStop(1,`rgba(${c},0)`); ctx.fillStyle=q; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); };
    [[60,26,7],[98,34,8.5],[150,22,6],[420,30,7.5],[470,40,9]].forEach((b,bi)=>{ const x=fx(b[0]), bw=b[1]*u, bh=b[2]*u; if(x>w+40||x+bw<-40) return;
      ctx.fillStyle=`rgba(255,214,140,${.85*N})`; for(let k=0;k<Math.floor(b[1]/5);k++){ if((k*7+bi*3)%4===0) continue; ctx.fillRect(x+bw*.08+k*5*u,hz-bh*.42,Math.max(1.2,1.6*u),Math.max(1.2,1.4*u)); }
      const lx=x+bw*.5, ly=hz-bh-1.5*u; glow(lx,ly,Math.max(5,9*u),"255,236,190",.95*N); const q=ctx.createLinearGradient(0,ly,0,hz+h*.05); q.addColorStop(0,`rgba(255,232,180,${.34*N})`); q.addColorStop(1,"rgba(255,232,180,0)"); ctx.fillStyle=q; ctx.beginPath(); ctx.moveTo(lx,ly); ctx.lineTo(lx-bw*.7,hz+h*.05); ctx.lineTo(lx+bw*.7,hz+h*.05); ctx.closePath(); ctx.fill(); });
    { const x=fx(250)+1.6*u, y=hz-17*u-3.6*u, ph=(t*.9)%2, on=ph<.16||(ph>1&&ph<1.16); if(on) glow(x,y,Math.max(8,16*u),ph<1?"120,255,150":"255,255,255",.95*N); glow(x,hz-17*u-1.2*u,Math.max(3,5*u),"255,230,170",.8*N); }
    for(let i=0;i<70;i++){ const xx=((i*137.5+cam*pm*.03)%(w+60)+w+60)%(w+60)-30, yy=hz-h*.006-((i*29)%9)*h*.004; glow(xx,yy,h*.012,(i%5===0)?"255,170,110":"255,226,170",.55*N); }
    for(let m=Math.floor(cam/60)*60;m<cam+viewM+60;m+=60){ glow(X(m+45),y1+h*.004,h*(.012+.02*N),"255,246,214",.8*N); }
    for(let m=Math.floor(cam/30)*30;m<cam+viewM+30;m+=30){ glow((m-cam*.8)*pm*.8+w*.1,lerp(hz,y1,.55),h*.016,"70,120,255",.75*N); }
    for(let m=Math.floor(cam/15)*15;m<cam+viewM+15;m+=15){ glow(X(m+7),(y1+y2)/2-h*.01,h*.011,"255,255,235",.6*N); }
    ctx.restore(); }
  // hierba
  const G=(c,k)=>css(mul(tint(c,mix([255,255,255],env.sun,.3)),env.amb*k));
  let g=ctx.createLinearGradient(0,hz,0,y1); g.addColorStop(0,css(mix(haze,mul([112,124,80],env.amb),.55))); g.addColorStop(1,G([104,118,66],.95)); ctx.fillStyle=g; ctx.fillRect(0,hz,w,y1-hz+1);
  // asfalto
   ctx.save(); ctx.beginPath(); ctx.rect(0,y1,w,y2-y1); ctx.clip();
  const sc=(y2-y1)/64; ctx.save(); { const P=256*sc*4; ctx.translate(-((((cam*pm)%P)+P)%P),y1); } ctx.scale(sc*4,sc); ctx.fillStyle=ctx.createPattern(asph,"repeat"); ctx.fillRect(0,0,(w/(sc*4))+260,64); ctx.restore();
  ctx.fillStyle=css(mul(tint([36,38,42],mix([255,255,255],env.sun,.25)),1),lerp(.92,.62,env.amb)); ctx.fillRect(0,y1,w,y2-y1);
  ctx.fillStyle="rgba(12,12,14,.34)"; for(let m=Math.floor(cam/90)*90;m<cam+viewM+90;m+=90){ ctx.fillRect(X(m+8),yc-h*.022,46*pm,h*.012); ctx.fillRect(X(m+30),yc+h*.014,38*pm,h*.011); }
  const wl=css(mul(tint([236,236,230],mix([255,255,255],env.sun,.3)),.3+.7*env.amb)); ctx.fillStyle=wl;
  ctx.fillRect(0,y1+h*.008,w,Math.max(1,h*.007)); ctx.fillRect(0,y2-h*.022,w,Math.max(1.5,h*.013));
  for(let m=Math.floor(cam/60)*60;m<cam+viewM+60;m+=60) ctx.fillRect(X(m),yc-h*.005,30*pm,Math.max(1.2,h*.011));
  ctx.restore();
  // hierba cercana
  g=ctx.createLinearGradient(0,y2,0,H); g.addColorStop(0,G([92,108,56],.9)); g.addColorStop(1,G([66,82,40],.85)); ctx.fillStyle=g; ctx.fillRect(0,y2,w,H-y2);
  ctx.strokeStyle=G([120,134,74],.9); ctx.lineWidth=1; ctx.beginPath(); for(let m=Math.floor(cam/1.5)*1.5;m<cam+viewM+2;m+=1.5){ const x=X(m), q=noise(m*.31,.7); ctx.moveTo(x,y2+h*.02+q*h*.07); ctx.lineTo(x+h*.012,y2+h*.02+q*h*.07-h*.03*q); } ctx.stroke();
  // sombra
  const tn=K.turn||0, px=X(xw), py=yc-alt*pm+tn*(y2-yc)*.55, s=pm*.083*(1+.14*tn), sh=clamp(1-alt/14,0,1);
  if(env.el>1||env.night>.5){ const off=env.el>1?clamp(1/Math.tan(Math.max(env.el,6)*D2R),0,4)*(env.az<180?1:-1)*pm*.8:0; ctx.fillStyle=`rgba(0,0,0,${(.34*env.amb+.08)*sh*(1-.5*sstep(.6,1,env.cover))})`; ctx.beginPath(); ctx.ellipse(px+6*s*K.dir+off*.25+alt*pm*.3*K.dir,yc+h*.012,48*s*(1+alt*.03),Math.max(1.4,2.6*s),0,0,7); ctx.fill(); }
  // luces de borde y manga
  for(let m=Math.floor(cam/60)*60;m<cam+viewM+60;m+=60){ const x=X(m+15), y=y2-h*.004; ctx.fillStyle="#3a3d42"; ctx.fillRect(x-1,y-h*.02,2,h*.02);
    const A=.25+.75*sstep(.1,.6,env.night), q=ctx.createRadialGradient(x,y-h*.024,0,x,y-h*.024,h*(.02+.07*env.night)); q.addColorStop(0,`rgba(255,246,214,${A})`); q.addColorStop(1,"rgba(255,246,214,0)"); ctx.fillStyle=q; ctx.beginPath(); ctx.arc(x,y-h*.024,h*(.02+.07*env.night),0,7); ctx.fill(); }
  { const m0=Math.floor((cam+40)/260)*260+120, x=(m0-cam)*pm, yb=hz+h*.085, ph=5*pm*.8; ctx.strokeStyle=css(mul([210,214,220],env.amb)); ctx.lineWidth=Math.max(1,h*.006); ctx.beginPath(); ctx.moveTo(x,yb); ctx.lineTo(x,yb-ph); ctx.stroke();
    const fl=Math.sin(t*5)*.12; ctx.fillStyle=css(mul([232,96,30],.35+.65*env.amb)); ctx.beginPath(); ctx.moveTo(x,yb-ph); ctx.lineTo(x+2.6*pm,yb-ph+pm*(.5+fl)); ctx.lineTo(x+2.6*pm,yb-ph+pm*(.9+fl)); ctx.lineTo(x,yb-ph+pm*.8); ctx.closePath(); ctx.fill(); }
  if(K.td>=0){ const q=K.td, sx=X(28*28/(2*2.6))+q*pm*9; ctx.fillStyle=`rgba(225,228,232,${.42*(1-q)})`; for(let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(sx+i*pm*1.3*q,yc-h*.012-q*h*.05*(1+i*.3),h*(.014+.03*q)*(1+i*.2),0,7); ctx.fill(); } }
  // avión
  const fade=o.cycle?1:sstep(0,.8,tt)*(1-sstep(T-1,T-.2,tt))*(tt<T?1:0); ctx.globalAlpha=fade; if(px>-80*s&&px<w+80*s&&py>-40*s) plane(ctx,px,py,s,pitch,env,t,K.dir); ctx.globalAlpha=1;
  // calima sobre el horizonte
  const hg=ctx.createLinearGradient(0,hz-h*.1,0,hz+h*.05); hg.addColorStop(0,css(haze,0)); hg.addColorStop(.7,css(haze,.4)); hg.addColorStop(1,css(haze,0)); ctx.fillStyle=hg; ctx.fillRect(0,hz-h*.1,w,h*.15);
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
window.F0Real={header,sky,setCover:v=>{ if(v!=null&&isFinite(v)) cover=clamp(+v,0,1); },envAt,drawTakeoff,drawSky};
})();
