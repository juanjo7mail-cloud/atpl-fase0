/* Láminas interactivas de los apuntes: se montan en cada <div class="f0lab" data-lab="…">. El modelo 3D carga Three.js solo cuando hace falta. */
(function(){
"use strict";
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t, sst=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const still=false;
function fit(c){ const h0=c._h0||(c._h0=Math.max(120,Math.min(520,parseInt(c.getAttribute("height"),10)||340))); let d=Math.min(2,window.devicePixelRatio||1); const cw=c.clientWidth||300; if(cw*h0*d*d>2.4e6) d=Math.max(1,Math.sqrt(2.4e6/(cw*h0)));
  const w=Math.round(cw*d), h=Math.round(h0*d); if(c.style.height!==h0+"px") c.style.height=h0+"px"; if(c.width!==w||c.height!==h){ c.width=w; c.height=h; } return d; }
/* Planificador común: 30 imágenes por segundo como máximo, y si una lámina falla se sustituye por su ficha estática en vez de quedarse colgada. */
const RAF=(window.requestAnimationFrame||(f=>setTimeout(()=>f(Date.now()),33))).bind(window); let CUR=null, queue=[], pumping=false, lastPump=0;
function pump(t){ if(t-lastPump<30){ RAF(pump); return; } lastPump=t; const a=queue; queue=[]; for(const cb of a){ const L=cb._L; if(L&&L.dead) continue; CUR=L; try{ cb(t); }catch(e){ fail(L,e); } } CUR=null; if(queue.length) RAF(pump); else pumping=false; }
const requestAnimationFrame=cb=>{ cb._L=CUR; queue.push(cb); if(!pumping){ pumping=true; RAF(pump); } };
const vis=new Map(), io=("IntersectionObserver" in window)?new IntersectionObserver(es=>es.forEach(e=>vis.set(e.target,e.isIntersecting)),{rootMargin:"120px"}):null;
const seen=c=>{ if(!c.offsetParent) return false; if(io&&!vis.has(c)){ vis.set(c,true); io.observe(c); } return vis.get(c)!==false; };
const CSS=`
.f0lab{margin:14px 0 18px;max-width:880px}
.f0lab .lt{font:700 12px/1 "Barlow Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5d6977;margin:0 0 6px}
.f0lab figure{margin:0;background:#12202f;border-radius:8px;overflow:hidden;box-shadow:0 6px 16px rgba(10,20,34,.25)}
.f0lab canvas{display:block;width:100%;touch-action:pan-y}
.f0lab .sk{height:340px;border-radius:8px;display:grid;place-items:center;color:#9fb3c8;font:600 14px system-ui,sans-serif;background:linear-gradient(100deg,#12202f 30%,#1b2e43 50%,#12202f 70%) 0 0/300% 100%;animation:f0sk 1.6s linear infinite}
@keyframes f0sk{to{background-position:-150% 0}}
@media (prefers-reduced-motion:reduce){.f0lab .sk{animation:none}}
.f0lab .fb{background:#12202f;color:#e9f0f7;border-radius:8px;padding:16px 18px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.f0lab .fb b{font:700 18px/1.2 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#ffc94d}
.f0lab .fb ul{margin:8px 0 0;padding-left:20px}.f0lab .fb li{margin:4px 0;max-width:none}
.f0lab .fb .fbn{margin:12px 0 0;font-size:13px;color:#9fb3c8}.f0lab .fb button{font:600 13px system-ui,sans-serif;margin-left:6px;padding:5px 10px;border-radius:6px;border:1px solid #3a516b;background:#1a2b3f;color:#e9f0f7;cursor:pointer}
.f0lab .cap{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#5d6977;margin:7px 2px 0}
.f0lab .ctl{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;background:#0f1b29;color:#e9f0f7;padding:12px 14px;font:600 13.5px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif}
.f0lab .ctl label{display:flex;align-items:center;gap:8px;min-width:0;color:#e9f0f7}
.f0lab .ctl input[type=range]{width:min(190px,44vw);accent-color:#ffc94d}
.f0lab .ctl output{font:600 13.5px ui-monospace,"SF Mono",Menlo,Consolas,monospace;min-width:6.5ch;color:#ffc94d}
.f0lab .ctl button{font:600 13.5px system-ui,-apple-system,"Segoe UI",sans-serif;padding:7px 12px;border-radius:7px;border:1px solid #3a516b;background:#1a2b3f;color:#e9f0f7;cursor:pointer}
.f0lab .ctl button[aria-pressed="true"]{background:#ffc94d;border-color:#ffc94d;color:#1b1608}
.f0lab .ctl button:focus-visible,.f0lab .ctl input:focus-visible{outline:2px solid #ffc94d;outline-offset:2px}
.f0lab .read{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:#22344a;font:500 12px/1.2 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#9fb3c8}
.f0lab .read div{background:#0f1b29;padding:9px 12px}.f0lab .read b{display:block;font-size:19px;font-weight:600;color:#fff;font-variant-numeric:tabular-nums}
.f0lab .read .bad b{color:#ff8a7a}.f0lab .read .good b{color:#8df0b4}
.f0lab .v3{position:relative;height:380px;background:linear-gradient(180deg,#0e2136,#0a1727);touch-action:none;cursor:grab}
.f0lab .v3 canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.f0lab .v3 .tag{position:absolute;transform:translate(-50%,-50%);font:700 12px/1.15 system-ui,sans-serif;padding:3px 7px;border-radius:5px;background:rgba(8,16,26,.72);white-space:nowrap;pointer-events:none;text-align:center}
.f0lab .v3 .tag small{display:block;font-weight:500;opacity:.85}
.f0lab .v3 .msg{position:absolute;left:14px;top:12px;right:14px;font:800 22px/1.1 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.03em;color:#ffc94d;pointer-events:none}
.f0lab .v3 .msg small{display:block;font:600 13px/1.3 system-ui,sans-serif;color:#cfe0f0;letter-spacing:0}
.f0lab .v3 .ld{position:absolute;inset:0;display:grid;place-items:center;color:#9fb3c8;font:600 14px system-ui,sans-serif}
@media (max-width:640px){.f0lab .v3{height:300px}}
`;
const HTML={tunnel:`<figure>
      <canvas data-i="tun" height="340" role="img" aria-label="Perfil alar en un túnel de viento con líneas de corriente animadas"></canvas>
      <div class="ctl">
        <label>AoA <input data-i="aoa" type="range" min="-4" max="22" step="0.5" value="5"><output data-i="aoaO">5°</output></label>
        <label>IAS <input data-i="ias" type="range" min="45" max="120" step="1" value="90"><output data-i="iasO">90 kt</output></label>
        <button data-i="flap" type="button" aria-pressed="false">Flaps</button>
      </div>
      <div class="read"><div>CL<b data-i="rCL">–</b></div><div data-i="rLw">Sustentación / peso<b data-i="rL">–</b></div><div>Resistencia<b data-i="rD">–</b></div><div>Velocidad de pérdida<b data-i="rVs">–</b></div><div data-i="rSt">Estado<b data-i="rS">–</b></div></div>
    </figure>`,engine:`<figure>
      <canvas data-i="eng" height="380" role="img" aria-label="Corte animado de un cilindro con pistón, válvulas y bujía"></canvas>
      <div class="ctl">
        <button data-i="ePlay" type="button" aria-pressed="true">Pausa</button>
        <label>Ritmo <input data-i="eSp" type="range" min="0.2" max="3" step="0.1" value="1"></label>
        <button type="button" data-st="0">1 · Intake</button><button type="button" data-st="1">2 · Compression</button><button type="button" data-st="2">3 · Power</button><button type="button" data-st="3">4 · Exhaust</button>
      </div>
      <div class="read"><div>Tiempo<b data-i="eT">–</b></div><div>Cigüeñal<b data-i="eA">–</b></div><div>Válvula de admisión<b data-i="eI">–</b></div><div>Válvula de escape<b data-i="eE">–</b></div></div>
    </figure>`,altimeter:`<figure>
      <canvas data-i="alt" height="360" role="img" aria-label="Altímetro de tres agujas con ventanilla de reglaje"></canvas>
      <div class="ctl">
        <label>Altitud real <input data-i="aTrue" type="range" min="0" max="9000" step="50" value="3000"><output data-i="aTrueO">3000 ft</output></label>
        <label>QNH del día <input data-i="aQnh" type="range" min="980" max="1040" step="1" value="1003"><output data-i="aQnhO">1003</output></label>
        <label>Reglaje <input data-i="aSet" type="range" min="980" max="1040" step="1" value="1013"><output data-i="aSetO">1013</output></label>
        <button data-i="bQnh" type="button">Poner QNH</button><button data-i="bStd" type="button">Poner 1013</button>
      </div>
      <div class="read"><div>Indica<b data-i="aInd">–</b></div><div data-i="aErrB">Error<b data-i="aErr">–</b></div><div>Lectura<b data-i="aMsg">–</b></div></div>
    </figure>`,axes:`<figure><div class="v3" data-i="v3"><div class="ld" data-i="ld">Cargando el modelo 3D…</div><div class="msg" data-i="msg"></div></div>
<div class="ctl">
<label>Alerones <input data-i="ail" type="range" min="-1" max="1" step="0.02" value="0"></label>
<label>Profundidad <input data-i="ele" type="range" min="-1" max="1" step="0.02" value="0"></label>
<label>Dirección <input data-i="rud" type="range" min="-1" max="1" step="0.02" value="0"></label>
<button data-i="ctr" type="button">Centrar mandos</button>
</div>
<div class="read"><div>Alabeo · roll<b data-i="rRo">0°</b></div><div>Cabeceo · pitch<b data-i="rPi">0°</b></div><div>Guiñada · yaw<b data-i="rYa">0°</b></div></div></figure>`};
const CAP={"tunnel": "Avión de ejemplo: 1 000 kg y 16 m² de ala. Con flaps sube el CL máximo y baja la velocidad de pérdida; el ángulo crítico se reduce un poco.", "engine": "Esquema simplificado: las válvulas abren y cierran justo en los puntos muertos. En un motor real se adelantan y se retrasan (cruce de válvulas).", "altimeter": "Con un reglaje más alto que el QNH real, el altímetro marca de más: el avión está más bajo de lo que indica. Se usa 30 ft por hPa.", "axes": "Arrastra para girar la vista. Cada mando mueve su superficie y el avión gira sobre el eje que le corresponde."}, TTL={"tunnel": "Lámina interactiva · túnel de viento", "engine": "Lámina interactiva · los cuatro tiempos", "altimeter": "Lámina interactiva · altímetro y reglaje", "axes": "Modelo 3D · ejes y mandos de vuelo"};
const LAB={
 tunnel(root,E){ const c=E.tun, x=c.getContext("2d");
   let flaps=false, T=0;
  const NL=19, PP=9, parts=[]; for(let i=0;i<NL;i++) for(let k=0;k<PP;k++) parts.push({l:i,u:(k+Math.random())/PP,j:Math.random()*6.28});
  const eddies=Array.from({length:30},()=>({a:Math.random()*6.28,r:Math.random(),s:.6+Math.random(),o:Math.random()}));
  const aero=(a,f)=>{ const ac=f?14:16, cl0=f?.75:.25, clmax=cl0+.095*ac; const cl=a<=ac?cl0+.095*a:Math.max(.55,clmax-.11*Math.pow(a-ac,1.25)); const cd=.028+(f?.03:0)+.045*cl*cl+(a>ac?.035*(a-ac):0); return {cl,cd,ac,clmax}; };
  const yt=s=>.6*(.2969*Math.sqrt(s)-.126*s-.3516*s*s+.2843*s*s*s-.1036*s*s*s*s), cam=s=>.04*(s<.4?(.8*s-s*s)/.16:(.2+.8*s-s*s)/.36);
  function draw(dt){
    const d=fit(c), W=c.width, H=c.height, a=+E.aoa.value, v=+E.ias.value, A=aero(a,flaps), st=a>A.ac, ar=a*Math.PI/180, ca=Math.cos(ar), sa=Math.sin(ar);
    const plotW=W>620*d?W*.27:0, TW=W-plotW, cx=TW*.47, cy=H*.5, ch=TW*.36;
    const S=(lx,ly)=>[cx+(lx*ca+ly*sa)*ch, cy-(ly*ca-lx*sa)*ch];
    const P=(s,up)=>{ let lx=s-.25, ly=cam(s)+(up?1:-1)*yt(s); if(flaps&&s>.72){ const hx=.47, hy=cam(.72), fa=.5, dx=lx-hx, dy=ly-hy; lx=hx+dx*Math.cos(fa)+dy*Math.sin(fa); ly=hy-dx*Math.sin(fa)+dy*Math.cos(fa); } return S(lx,ly); };
    x.setTransform(1,0,0,1,0,0);
    let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0e2136"); g.addColorStop(1,"#0a1727"); x.fillStyle=g; x.fillRect(0,0,W,H);
    x.strokeStyle="rgba(120,160,200,.08)"; x.lineWidth=1; x.beginPath(); for(let gx=0;gx<TW;gx+=28*d){ x.moveTo(gx,0); x.lineTo(gx,H); } for(let gy=0;gy<H;gy+=28*d){ x.moveTo(0,gy); x.lineTo(TW,gy); } x.stroke();
    // contorno y envolventes por columnas
    const NS=70, out=[]; for(let i=0;i<=NS;i++) out.push(P(i/NS,true)); for(let i=NS;i>=0;i--) out.push(P(i/NS,false));
    const CS=3*d, NC=Math.ceil(TW/CS)+2, YU=new Float32Array(NC).fill(1e9), YL=new Float32Array(NC).fill(-1e9);
    for(let i=0;i<out.length;i++){ const p=out[i], q=out[(i+1)%out.length], n=Math.max(1,Math.ceil(Math.abs(q[0]-p[0])/CS*2)); for(let k=0;k<=n;k++){ const px=lerp(p[0],q[0],k/n), py=lerp(p[1],q[1],k/n), ci=Math.round(px/CS); if(ci>=0&&ci<NC){ if(py<YU[ci]) YU[ci]=py; if(py>YL[ci]) YL[ci]=py; } } }
    let c0=0, c1=NC-1; while(c0<NC&&YU[c0]>1e8) c0++; while(c1>0&&YU[c1]>1e8) c1--; for(let ci=c0;ci<=c1;ci++) if(YU[ci]>1e8){ YU[ci]=YU[ci-1]; YL[ci]=YL[ci-1]; }
    const xLE=c0*CS, xTE=c1*CS, yLE=(YU[c0]+YL[c0])/2, yTE=(YU[c1]+YL[c1])/2, col=px=>clamp(Math.round(px/CS),c0,c1);
    const eps=clamp(A.cl,0,2)*(st?.03:.075), ys0=yLE+ch*.075*clamp(A.cl,0,2);
    const sepS=st?clamp(.9-(a-A.ac)*.13,.1,.9):2, sp0=st?P(sepS,true):[1e9,0], sepX=sp0[0], sepY=sp0[1];
    const wake=px=>yTE+Math.tan(eps)*ch*1.4*(1-Math.exp(-(px-xTE)/(ch*1.4)));
    const lead=px=>lerp(ys0,yLE,sst(xLE-ch*1.1,xLE,px));
    const shear=px=>sepY-(px-sepX)*.04;
    const U=px=>{ if(px<xLE) return lead(px); let y=px<=xTE?YU[col(px)]:wake(px); if(st&&px>sepX){ const sl=shear(px); y=px<=xTE?Math.min(y,sl):lerp(sl,wake(px),sst(xTE,xTE+ch*1.6,px)); } return y; };
    const Lw=px=>px<xLE?lead(px):(px<=xTE?YL[col(px)]:wake(px));
    const lam=H*.2, line=(i,px)=>{ const y0=(i+.5)/NL*H, s=y0-ys0, k=Math.exp(-Math.abs(s)/lam); return y0+((s<0?U(px)-ch*.012:Lw(px)+ch*.012)-ys0)*k; };
    // halos de presión
    x.save(); x.globalCompositeOperation="lighter"; const ic=clamp(A.cl/1.8,0,1)*(st?.4:1), hp=S(-.08,.16), lp=S(-.02,-.14);
    g=x.createRadialGradient(hp[0],hp[1],0,hp[0],hp[1],ch*.6); g.addColorStop(0,`rgba(70,150,255,${.45*ic})`); g.addColorStop(1,"rgba(70,150,255,0)"); x.fillStyle=g; x.fillRect(0,0,TW,H);
    g=x.createRadialGradient(lp[0],lp[1],0,lp[0],lp[1],ch*.5); g.addColorStop(0,`rgba(255,110,80,${.28*ic})`); g.addColorStop(1,"rgba(255,110,80,0)"); x.fillStyle=g; x.fillRect(0,0,TW,H); x.restore();
    // zona desprendida
    if(st){ x.fillStyle="rgba(255,120,90,.10)"; x.beginPath(); x.moveTo(sepX,sepY); for(let px=sepX;px<=xTE+ch*1.6;px+=CS) x.lineTo(px,U(px)); for(let px=xTE+ch*1.6;px>=sepX;px-=CS) x.lineTo(px,px<=xTE?YU[col(px)]:wake(px)); x.closePath(); x.fill();
      const k=clamp((a-A.ac)/4,.2,1); for(const e of eddies){ e.a+=dt*5*e.s; e.o=(e.o+dt*.22*e.s)%1; const ex=lerp(sepX,xTE+ch*.7,e.o), top=U(ex), bot=ex<=xTE?YU[col(ex)]:wake(ex); if(bot-top<ch*.03) continue; const ey=lerp(top+ch*.012,bot-ch*.012,e.r), rr=Math.min((bot-top)*.3,ch*.03*(.5+e.s));
        x.strokeStyle=`rgba(255,150,120,${.6*k})`; x.lineWidth=1.3*d; x.beginPath(); x.arc(ex,ey,rr,e.a,e.a+4.3); x.stroke(); } }
    // líneas de corriente y partículas
    x.lineWidth=1*d; x.strokeStyle="rgba(150,190,230,.14)"; for(let i=0;i<NL;i++){ x.beginPath(); for(let px=0;px<=TW;px+=CS*2){ const y=line(i,px); px?x.lineTo(px,y):x.moveTo(px,y); } x.stroke(); }
    const sp=(.1+.0016*v)*dt; x.lineCap="round";
    for(const p of parts){ const y0=(p.l+.5)/NL*H, s=y0-ys0, near=Math.exp(-Math.abs(s)/(H*.16)); let px=p.u*TW; const over=px>xLE&&px<xTE, turb=st&&s<0&&px>sepX&&near>.45;
      const loc=over?(s<0?1+.6*near*clamp(A.cl,0,1.8)/1.4:1-.22*near):1; p.u+=sp*(turb?.55:loc); if(p.u>1){ p.u-=1; p.j=Math.random()*6.28; } px=p.u*TW;
      const jit=q=>turb?Math.sin(T*8+p.j+q*.035)*ch*.02*near:0, len=(turb?6:9+9*(loc-1))*d*(v/90);
      x.strokeStyle=turb?"rgba(255,160,130,.8)":`rgba(${s<0&&loc>1.15?"140,205,255":"205,225,245"},${.5+.4*near})`; x.lineWidth=(1.4+.6*near)*d;
      x.beginPath(); x.moveTo(px-len,line(p.l,px-len)+jit(px-len)); x.lineTo(px,line(p.l,px)+jit(px)); x.stroke(); }
    // perfil
    x.beginPath(); out.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.closePath();
    g=x.createLinearGradient(0,cy-ch*.22,0,cy+ch*.2); g.addColorStop(0,"#f4f7fa"); g.addColorStop(.5,"#c9d2dc"); g.addColorStop(1,"#77859a"); x.fillStyle=g; x.fill(); x.strokeStyle="#0b1622"; x.lineWidth=1.2*d; x.stroke();
    if(flaps){ const p=P(.72,true), q=P(.72,false); x.strokeStyle="rgba(11,22,34,.75)"; x.lineWidth=1.5*d; x.beginPath(); x.moveTo(p[0],p[1]); x.lineTo(q[0],q[1]); x.stroke(); }
    // cuerda, viento relativo y ángulo
    const cA=S(-.95,0), cB=S(.2,0); x.setLineDash([6*d,5*d]); x.lineWidth=1.2*d; x.strokeStyle="rgba(255,201,77,.9)"; x.beginPath(); x.moveTo(cA[0],cA[1]); x.lineTo(cB[0],cB[1]); x.stroke();
    x.strokeStyle="rgba(255,255,255,.45)"; x.beginPath(); x.moveTo(cx-ch*.95,cy); x.lineTo(cx+ch*.2,cy); x.stroke(); x.setLineDash([]);
    x.strokeStyle="#ffc94d"; x.lineWidth=1.8*d; x.beginPath(); x.arc(cx,cy,ch*.72,Math.PI,Math.PI+ar,ar<0); x.stroke();
    x.fillStyle="#ffc94d"; x.font=`600 ${13*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("AoA "+a.toFixed(1)+"°",Math.max(8*d,cx-ch*1.02),cy+(a>=0?18:-10)*d);
    // fuerzas
    const W0=1000*9.81, q=.5*1.225*Math.pow(v*.5144,2)*16, L=q*A.cl, D=q*A.cd, sc=ch*.34/W0, arrow=(x0,y0,dx,dy,colr,lab)=>{ const n=Math.hypot(dx,dy); if(n<4*d) return; x.strokeStyle=colr; x.fillStyle=colr; x.lineWidth=3*d; x.beginPath(); x.moveTo(x0,y0); x.lineTo(x0+dx,y0+dy); x.stroke();
      const ux=dx/n, uy=dy/n, h=9*d; x.beginPath(); x.moveTo(x0+dx+ux*h,y0+dy+uy*h); x.lineTo(x0+dx-uy*h*.55,y0+dy+ux*h*.55); x.lineTo(x0+dx+uy*h*.55,y0+dy-ux*h*.55); x.closePath(); x.fill(); x.font=`700 ${12*d}px system-ui,sans-serif`; x.fillText(lab,x0+dx+10*d,y0+dy+(dy<0?4*d:6*d)); };
    arrow(cx,cy-ch*.05,0,-clamp(L*sc,0,cy-34*d),"#6fd08c","LIFT"); arrow(cx+ch*.1,cy,clamp(D*sc*3,0,TW*.28),0,"#ff8a7a","DRAG"); arrow(cx,cy+ch*.05,0,Math.min(W0*sc,H-cy-28*d),"rgba(255,255,255,.6)","WEIGHT");
    if(st){ x.fillStyle="#ff6b5a"; x.font=`800 ${22*d}px "Barlow Condensed","Arial Narrow",sans-serif`; x.fillText("STALL · flujo desprendido",16*d,H-34*d); }
    x.fillStyle="rgba(205,225,245,.7)"; x.font=`600 ${11*d}px ui-monospace,Menlo,monospace`; x.fillText("viento relativo →",14*d,H-12*d);
    // curva CL–α
    if(plotW){ const px0=TW+18*d, py0=H-34*d, pw=plotW-36*d, ph=H-74*d, X=aa=>px0+(aa+4)/26*pw, Y=cl=>py0-cl/2.4*ph;
      x.fillStyle="#0b1622"; x.fillRect(TW,0,plotW,H); x.strokeStyle="rgba(150,190,230,.35)"; x.lineWidth=1*d; x.beginPath(); x.moveTo(px0,py0-ph); x.lineTo(px0,py0); x.lineTo(px0+pw,py0); x.stroke();
      x.strokeStyle="rgba(255,107,90,.6)"; x.setLineDash([4*d,4*d]); x.beginPath(); x.moveTo(X(A.ac),py0); x.lineTo(X(A.ac),py0-ph); x.stroke(); x.setLineDash([]);
      x.strokeStyle="#8fd0ff"; x.lineWidth=2*d; x.beginPath(); for(let aa=-4;aa<=22;aa+=.5){ const yy=Y(Math.max(0,aero(aa,flaps).cl)); aa===-4?x.moveTo(X(aa),yy):x.lineTo(X(aa),yy); } x.stroke();
      x.fillStyle=st?"#ff6b5a":"#ffc94d"; x.beginPath(); x.arc(X(a),Y(Math.max(0,A.cl)),5.5*d,0,7); x.fill();
      x.fillStyle="rgba(205,225,245,.8)"; x.font=`600 ${11*d}px ui-monospace,Menlo,monospace`; x.fillText("CL",px0+6*d,py0-ph+10*d); x.fillText("AoA",px0+pw-26*d,py0+16*d); x.fillStyle="rgba(255,107,90,.9)"; x.fillText("crítico "+A.ac+"°",Math.min(X(A.ac)-34*d,W-88*d),py0-ph-6*d); }
    // lecturas
    const vs=Math.sqrt(2*W0/(1.225*16*A.clmax))/.5144, n=L/W0;
    E.aoaO.textContent=a.toFixed(1)+"°"; E.iasO.textContent=v+" kt"; E.rCL.textContent=Math.max(0,A.cl).toFixed(2); E.rL.textContent=Math.round(Math.max(0,n)*100)+" %"; E.rD.textContent=Math.round(D)+" N"; E.rVs.textContent=Math.round(vs)+" kt";
    E.rS.textContent=st?"EN PÉRDIDA":(n<.97?"Desciende":n>1.03?"Asciende":"Vuelo nivelado"); E.rSt.className=st?"bad":(Math.abs(n-1)<=.03?"good":""); E.rLw.className=n<.97?"bad":"";
  }
  E.flap.addEventListener("click",e=>{ flaps=!flaps; e.currentTarget.setAttribute("aria-pressed",flaps); if(still) draw(0); });
  [E.aoa,E.ias].forEach(q=>q.addEventListener("input",()=>{ if(still) draw(0); }));
  let last=0; const loop=t=>{ const dt=Math.min(.05,(t-last)/1000||0); last=t; T+=dt; if(seen(c)&&!document.hidden) draw(dt); if(!still) requestAnimationFrame(loop); }; requestAnimationFrame(loop); addEventListener("resize",()=>{ if(still) draw(0); });
},
 engine(root,E){
  const c=E.eng, x=c.getContext("2d"); let th=40, play=true;
  const NAME=[["INTAKE","admisión"],["COMPRESSION","compresión"],["POWER","expansión"],["EXHAUST","escape"]];
  function draw(){
    const d=fit(c), W=c.width, H=c.height, nar=W<560*d, u=Math.min(W/(nar?330:520),H/380), cx=W/2, top=58*u, bore=120*u, r=46*u, l=128*u, st=Math.floor(th/180)%4, f=(th%180)/180, a=th*Math.PI/180;
    x.setTransform(1,0,0,1,0,0); let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0e2136"); g.addColorStop(1,"#0a1727"); x.fillStyle=g; x.fillRect(0,0,W,H);
    const cyc=top+r+l+34*u+r*0+ 96*u, ky=cyc, pinY=ky-(r*Math.cos(a)+Math.sqrt(l*l-r*r*Math.sin(a)*Math.sin(a))), tdc=ky-(r+l), pTop=pinY-34*u, headY=tdc-34*u-16*u;
    const iv=st===0?Math.sin(f*Math.PI):0, ev=st===3?Math.sin(f*Math.PI):0;
    // gases
    const col=st===0?[90,160,255,.55]:st===1?[70,120,235,.55+.35*f]:st===2?[255,lerp(210,120,f),lerp(90,40,f),.9-.45*f]:[150,150,150,.6];
    x.fillStyle=`rgba(${col[0]|0},${col[1]|0},${col[2]|0},${col[3]})`; x.fillRect(cx-bore/2,headY,bore,pTop-headY);
    if(st===2&&f<.25){ g=x.createRadialGradient(cx,headY+8*u,0,cx,headY+8*u,bore*(.2+f*2.6)); g.addColorStop(0,"rgba(255,255,220,.95)"); g.addColorStop(1,"rgba(255,170,40,0)"); x.fillStyle=g; x.fillRect(cx-bore/2,headY,bore,pTop-headY); }
    // colectores
    const duct=(side,colr,open)=>{ const s=side, x0=cx+s*bore*.27, yv=headY; x.fillStyle="#1b2c40"; x.beginPath(); x.moveTo(x0-s*20*u,yv); x.lineTo(x0-s*20*u,yv-30*u); x.quadraticCurveTo(x0-s*20*u,yv-62*u,x0+s*40*u,yv-62*u); x.lineTo(cx+s*W*.5,yv-62*u); x.lineTo(cx+s*W*.5,yv-96*u); x.lineTo(x0+s*30*u,yv-96*u); x.quadraticCurveTo(x0-s*-20*u+s*0,yv-96*u,x0+s*20*u,yv-40*u); x.lineTo(x0+s*20*u,yv); x.closePath(); x.fill();
      x.fillStyle=colr; x.globalAlpha=.25+.5*open; x.fillRect(Math.min(x0+s*40*u,cx+s*W*.5),yv-92*u,Math.abs(cx+s*W*.5-(x0+s*40*u)),26*u); x.globalAlpha=1;
      if(open>.05){ x.fillStyle=colr; for(let k=0;k<4;k++){ const t=((th/60+k/4)%1), xx=side<0?lerp(cx-W*.46,x0-10*u,t):lerp(x0+10*u,cx+W*.46,t), yy=yv-79*u; x.globalAlpha=open; x.beginPath(); x.moveTo(xx+8*u,yy); x.lineTo(xx-6*u,yy-6*u); x.lineTo(xx-6*u,yy+6*u); x.closePath(); x.fill(); } x.globalAlpha=1; } };
    duct(-1,"#5aa2ff",iv); duct(1,"#a9a9a9",ev);
    // culata y paredes
    x.fillStyle="#56657a"; x.fillRect(cx-bore/2-16*u,headY-16*u,bore+32*u,16*u); x.fillStyle="#3f4d60"; x.fillRect(cx-bore/2-16*u,headY,16*u,(ky-r*.2)-headY); x.fillRect(cx+bore/2,headY,16*u,(ky-r*.2)-headY);
    for(let k=0;k<7;k++){ x.fillStyle="#56657a"; x.fillRect(cx-bore/2-30*u,headY+8*u+k*17*u,14*u,7*u); x.fillRect(cx+bore/2+16*u,headY+8*u+k*17*u,14*u,7*u); }
    // válvulas
    const valve=(side,lift,colr)=>{ const x0=cx+side*bore*.27, y=headY+lift*20*u; x.strokeStyle="#cfd8e3"; x.lineWidth=5*u; x.beginPath(); x.moveTo(x0,y-70*u); x.lineTo(x0,y); x.stroke(); x.fillStyle="#e3e9f0"; x.beginPath(); x.moveTo(x0-20*u,y+7*u); x.lineTo(x0+20*u,y+7*u); x.lineTo(x0+7*u,y-5*u); x.lineTo(x0-7*u,y-5*u); x.closePath(); x.fill(); if(!nar){ x.fillStyle=colr; x.font=`700 ${11*u}px system-ui,sans-serif`; x.textAlign="center"; x.fillText(side<0?"INTAKE VALVE":"EXHAUST VALVE",x0+side*84*u,headY-104*u); } };
    valve(-1,iv,"#8fc2ff"); valve(1,ev,"#c9c9c9");
    // bujía
    x.fillStyle="#e9eef4"; x.fillRect(cx-5*u,headY-34*u,10*u,30*u); x.fillStyle="#9aa6b4"; x.fillRect(cx-2*u,headY-4*u,4*u,9*u);
    if((st===1&&f>.93)||(st===2&&f<.1)){ x.strokeStyle="#fff8c0"; x.lineWidth=2.5*u; x.beginPath(); for(let k=0;k<6;k++){ const an=k*1.05+th; x.moveTo(cx,headY+7*u); x.lineTo(cx+Math.cos(an)*13*u,headY+7*u+Math.abs(Math.sin(an))*13*u); } x.stroke(); }
    // pistón, biela y cigüeñal
    g=x.createLinearGradient(cx-bore/2,0,cx+bore/2,0); g.addColorStop(0,"#8a96a6"); g.addColorStop(.5,"#e2e8ef"); g.addColorStop(1,"#7b8797"); x.fillStyle=g; x.fillRect(cx-bore/2+1.5*u,pTop,bore-3*u,62*u);
    x.fillStyle="#2a3646"; for(let k=0;k<3;k++) x.fillRect(cx-bore/2+1.5*u,pTop+8*u+k*9*u,bore-3*u,3.2*u);
    const jx=cx+r*Math.sin(a), jy=ky-r*Math.cos(a);
    x.strokeStyle="#b9c3cf"; x.lineWidth=15*u; x.lineCap="round"; x.beginPath(); x.moveTo(cx,pinY); x.lineTo(jx,jy); x.stroke();
    x.fillStyle="#2a3646"; x.beginPath(); x.arc(cx,pinY,7*u,0,7); x.fill();
    x.fillStyle="#44536a"; x.beginPath(); x.arc(cx,ky,r+16*u,0,7); x.fill(); x.fillStyle="#6c7c92"; x.beginPath(); x.moveTo(cx,ky); x.arc(cx,ky,r+14*u,a+Math.PI/2-.9+Math.PI/2,a+Math.PI/2+.9+Math.PI/2); x.closePath(); x.fill();
    x.fillStyle="#d8e0e9"; x.beginPath(); x.arc(jx,jy,11*u,0,7); x.fill(); x.fillStyle="#1a2433"; x.beginPath(); x.arc(cx,ky,9*u,0,7); x.fill();
    // rótulo y dial de ciclo
    x.textAlign="left"; x.fillStyle=["#8fc2ff","#9fb0ff","#ffb14d","#c9c9c9"][st]; x.font=`800 ${30*u}px "Barlow Condensed","Arial Narrow",sans-serif`; x.fillText((st+1)+" · "+NAME[st][0],16*u,36*u);
    x.fillStyle="rgba(233,240,247,.75)"; x.font=`600 ${13*u}px system-ui,sans-serif`; x.fillText(NAME[st][1]+" · pistón "+(st%2===0?"baja":"sube"),16*u,56*u);
    const dx=W-58*u, dy=46*u, dr=30*u; ["#5aa2ff","#7d8ff0","#ffb14d","#a9a9a9"].forEach((cc,k)=>{ x.beginPath(); x.moveTo(dx,dy); x.arc(dx,dy,dr,-Math.PI/2+k*Math.PI/2,-Math.PI/2+(k+1)*Math.PI/2); x.closePath(); x.fillStyle=cc; x.globalAlpha=k===st?1:.28; x.fill(); }); x.globalAlpha=1;
    x.strokeStyle="#fff"; x.lineWidth=2.5*u; x.beginPath(); x.moveTo(dx,dy); x.lineTo(dx+Math.sin(th/720*6.283)*dr,dy-Math.cos(th/720*6.283)*dr); x.stroke();
    E.eT.textContent=(st+1)+" · "+NAME[st][0]; E.eA.textContent=Math.round(th)+"° de 720°"; E.eI.textContent=iv>.05?"Abierta":"Cerrada"; E.eE.textContent=ev>.05?"Abierta":"Cerrada";
  }
  E.ePlay.addEventListener("click",e=>{ play=!play; e.currentTarget.textContent=play?"Pausa":"Reproducir"; e.currentTarget.setAttribute("aria-pressed",play); });
  root.querySelectorAll("[data-st]").forEach(b=>b.addEventListener("click",()=>{ th=+b.dataset.st*180+60; play=false; E.ePlay.textContent="Reproducir"; E.ePlay.setAttribute("aria-pressed",false); draw(); }));
  if(still){ play=false; E.ePlay.textContent="Reproducir"; E.ePlay.setAttribute("aria-pressed",false); }
  let last=0; const loop=t=>{ const dt=Math.min(.05,(t-last)/1000||0); last=t; if(play) th=(th+dt*150*(+E.eSp.value))%720; if(seen(c)&&!document.hidden) draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
},
 altimeter(root,E){
  const c=E.alt, x=c.getContext("2d"); let shown=null;
  function draw(){
    const d=fit(c), W=c.width, H=c.height, tr=+E.aTrue.value, qnh=+E.aQnh.value, set=+E.aSet.value, ind=tr+(set-qnh)*30; if(shown==null) shown=ind; shown+=(ind-shown)*.14; if(Math.abs(ind-shown)<.5) shown=ind;
    x.setTransform(1,0,0,1,0,0); let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0e2136"); g.addColorStop(1,"#0a1727"); x.fillStyle=g; x.fillRect(0,0,W,H);
    const two=W>640*d, R=Math.min(H*.44,(two?W*.5:W)*.42), cx=two?W*.3:W/2, cy=H/2;
    // bisel
    g=x.createRadialGradient(cx-R*.3,cy-R*.35,R*.2,cx,cy,R*1.12); g.addColorStop(0,"#6d7785"); g.addColorStop(.6,"#2b323c"); g.addColorStop(1,"#0c0f13"); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,R*1.1,0,7); x.fill();
    [45,135,225,315].forEach(an=>{ const sx=cx+Math.cos(an*Math.PI/180)*R*1.03, sy=cy+Math.sin(an*Math.PI/180)*R*1.03; x.fillStyle="#9aa3ad"; x.beginPath(); x.arc(sx,sy,R*.035,0,7); x.fill(); x.strokeStyle="#2b323c"; x.lineWidth=1.5*d; x.beginPath(); x.moveTo(sx-R*.025,sy); x.lineTo(sx+R*.025,sy); x.stroke(); });
    g=x.createRadialGradient(cx,cy,R*.1,cx,cy,R); g.addColorStop(0,"#1c1f23"); g.addColorStop(1,"#0a0b0d"); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,R*.95,0,7); x.fill();
    // escala
    x.strokeStyle="#f2f2ea"; x.fillStyle="#f2f2ea"; x.textAlign="center"; x.textBaseline="middle";
    for(let i=0;i<50;i++){ const an=i/50*6.283-Math.PI/2, big=i%5===0, r1=R*(big?.76:.82); x.lineWidth=(big?3:1.4)*d; x.beginPath(); x.moveTo(cx+Math.cos(an)*r1,cy+Math.sin(an)*r1); x.lineTo(cx+Math.cos(an)*R*.9,cy+Math.sin(an)*R*.9); x.stroke(); }
    x.font=`700 ${R*.17}px "Barlow Condensed","Arial Narrow",sans-serif`; for(let n=0;n<10;n++){ const an=n/10*6.283-Math.PI/2; x.fillText(n,cx+Math.cos(an)*R*.62,cy+Math.sin(an)*R*.62); }
    x.font=`600 ${R*.075}px system-ui,sans-serif`; x.fillText("ALT",cx,cy-R*.3); x.font=`600 ${R*.06}px system-ui,sans-serif`; x.fillText("100 FEET",cx,cy-R*.2);
    // ventanilla Kollsman
    const kx=cx+R*.5, ky=cy; x.fillStyle="#000"; x.fillRect(kx-R*.17,ky-R*.085,R*.34,R*.17); x.strokeStyle="#8f98a2"; x.lineWidth=1.5*d; x.strokeRect(kx-R*.17,ky-R*.085,R*.34,R*.17);
    x.fillStyle="#ffe9a8"; x.font=`700 ${R*.12}px ui-monospace,Menlo,monospace`; x.fillText(set,kx,ky+R*.005); x.fillStyle="#9aa3ad"; x.font=`600 ${R*.05}px system-ui,sans-serif`; x.fillText("hPa",kx,ky+R*.14);
    // agujas
    const v=Math.max(0,shown), hand=(frac,len,wd,style)=>{ const an=frac*6.283; x.save(); x.translate(cx,cy); x.rotate(an); x.shadowColor="rgba(0,0,0,.6)"; x.shadowBlur=6*d; x.shadowOffsetY=2*d; x.fillStyle="#f6f6ee";
      x.beginPath(); if(style===2){ x.moveTo(-wd*.5,R*.1); x.lineTo(-wd*.5,-len*.85); x.lineTo(-wd*1.6,-len*.85); x.lineTo(0,-len); x.lineTo(wd*1.6,-len*.85); x.lineTo(wd*.5,-len*.85); x.lineTo(wd*.5,R*.1); }
      else if(style===1){ x.moveTo(-wd,R*.08); x.lineTo(-wd*1.5,-len*.55); x.lineTo(0,-len); x.lineTo(wd*1.5,-len*.55); x.lineTo(wd,R*.08); } else { x.moveTo(-wd,R*.14); x.lineTo(-wd*.7,-len*.9); x.lineTo(0,-len); x.lineTo(wd*.7,-len*.9); x.lineTo(wd,R*.14); }
      x.closePath(); x.fill(); x.restore(); };
    hand(v/100000,R*.88,R*.012,2); hand(v/10000,R*.5,R*.035,1); hand(v/1000,R*.82,R*.022,0);
    x.fillStyle="#30363e"; x.beginPath(); x.arc(cx,cy,R*.06,0,7); x.fill();
    // cristal y mando
    g=x.createLinearGradient(cx-R,cy-R,cx+R*.4,cy+R*.4); g.addColorStop(0,"rgba(255,255,255,.16)"); g.addColorStop(.45,"rgba(255,255,255,.02)"); g.addColorStop(1,"rgba(255,255,255,0)"); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,R*.95,0,7); x.fill();
    const bx=cx-R*.86, by=cy+R*.86; g=x.createRadialGradient(bx-R*.03,by-R*.03,1,bx,by,R*.13); g.addColorStop(0,"#8b949f"); g.addColorStop(1,"#16191d"); x.fillStyle=g; x.beginPath(); x.arc(bx,by,R*.13,0,7); x.fill();
    x.save(); x.translate(bx,by); x.rotate(set*.35); x.strokeStyle="#0c0e11"; x.lineWidth=2*d; for(let k=0;k<10;k++){ x.rotate(.6283); x.beginPath(); x.moveTo(R*.09,0); x.lineTo(R*.13,0); x.stroke(); } x.restore();
    // corte lateral: avión real frente a lo indicado
    if(two){ const px0=W*.6, pw=W*.36, yb=H-40*d, yt=30*d, Y=ft=>yb-(clamp(ft,0,10500)/10500)*(yb-yt);
      x.strokeStyle="rgba(150,190,230,.3)"; x.lineWidth=1*d; x.fillStyle="rgba(205,225,245,.7)"; x.font=`600 ${11*d}px ui-monospace,Menlo,monospace`; x.textAlign="right";
      for(let ft=0;ft<=10000;ft+=2000){ x.beginPath(); x.moveTo(px0,Y(ft)); x.lineTo(px0+pw,Y(ft)); x.stroke(); x.fillText(ft,px0-6*d,Y(ft)); }
      x.fillStyle="#2f5d3a"; x.fillRect(px0,yb,pw,10*d); x.textAlign="left";
      const pl=(xx,ft,col,lab)=>{ const yy=Y(ft); x.fillStyle=col; x.beginPath(); x.moveTo(xx+26*d,yy); x.lineTo(xx-10*d,yy-5*d); x.lineTo(xx-18*d,yy-14*d); x.lineTo(xx-22*d,yy-14*d); x.lineTo(xx-18*d,yy); x.lineTo(xx-22*d,yy+6*d); x.lineTo(xx-10*d,yy+4*d); x.closePath(); x.fill(); x.font=`700 ${12*d}px system-ui,sans-serif`; x.fillText(lab,xx-24*d,yy-22*d); };
      pl(px0+pw*.3,tr,"#ffffff","Real "+tr+" ft"); if(Math.abs(shown-tr)>20){ x.globalAlpha=.75; pl(px0+pw*.72,shown,"#ffc94d","Indica "+Math.round(shown/10)*10+" ft"); x.globalAlpha=1; } }
    const err=Math.round(ind-tr);
    E.aTrueO.textContent=tr+" ft"; E.aQnhO.textContent=qnh; E.aSetO.textContent=set; E.aInd.textContent=Math.round(ind/10)*10+" ft"; E.aErr.textContent=(err>0?"+":"")+err+" ft";
    E.aErrB.className=err>0?"bad":""; E.aMsg.textContent=err===0?"Correcta":(err>0?"Sobre-lee: estás más bajo":"Infra-lee: estás más alto");
  }
  E.bQnh.addEventListener("click",()=>{ E.aSet.value=E.aQnh.value; }); E.bStd.addEventListener("click",()=>{ E.aSet.value=1013; });
  const loop=()=>{ if(seen(c)&&!document.hidden) draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
},
 axes(root,E){
  const box=E.v3, T=window.THREE, W0=()=>box.clientWidth, H0=()=>box.clientHeight;
  const rnd=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"}); rnd.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1)); box.insertBefore(rnd.domElement,box.firstChild); E.ld.remove(); if(E._L){ E._L.rnd=rnd; rnd.domElement.addEventListener("webglcontextlost",ev=>{ ev.preventDefault(); fail(E._L,new Error("contexto WebGL perdido")); }); }
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(38,1,.1,200);
  scene.add(new T.HemisphereLight(0xdfeeff,0x26323f,1.05)); const sun=new T.DirectionalLight(0xfff2dd,1.15); sun.position.set(6,10,7); scene.add(sun);
  const M=(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:.45,metalness:.15},o||{})), white=M(0xf3f5f8), blue=M(0x1b56aa), dark=M(0x1d2733,{roughness:.3}), glass=M(0x243a52,{roughness:.1,metalness:.6}), amber=M(0xffc94d,{emissive:0x5a3d00});
  const plane=new T.Group(); scene.add(plane);
  const add=(g,m,x,y,z,p)=>{ const o=new T.Mesh(g,m); o.position.set(x||0,y||0,z||0); (p||plane).add(o); return o; };
  // fuselaje (morro hacia +X)
  const fus=add(new T.CylinderGeometry(.62,.62,3.2,28),white,.3,0,0); fus.rotation.z=Math.PI/2;
  const nose=add(new T.CylinderGeometry(.34,.62,1.1,28),white,2.45,0,0); nose.rotation.z=-Math.PI/2; nose.rotation.z=Math.PI/2; nose.scale.set(1,1,1); nose.rotation.set(0,0,-Math.PI/2);
  const tail=add(new T.CylinderGeometry(.62,.16,3.6,28),white,-3.1,.12,0); tail.rotation.set(0,0,-Math.PI/2);
  add(new T.SphereGeometry(.2,16,12),dark,3.1,0,0); const prop=add(new T.CylinderGeometry(1.05,1.05,.03,40),M(0x8fa3b8,{transparent:true,opacity:.28}),3.16,0,0); prop.rotation.z=Math.PI/2;
  const cab=add(new T.BoxGeometry(1.5,.5,1.02),glass,.75,.42,0); const st=add(new T.BoxGeometry(6.2,.1,1.27),blue,-.4,-.05,0); st.scale.z=1;
  // ala alta
  add(new T.BoxGeometry(1.5,.14,10.6),white,.55,.78,0); add(new T.BoxGeometry(1.5,.145,.9),blue,.55,.78,5.0); add(new T.BoxGeometry(1.5,.145,.9),blue,.55,.78,-5.0);
  [1,-1].forEach(s=>{ const m=add(new T.CylinderGeometry(.04,.04,2.1,8),dark,.6,.08,s*1.55); m.rotation.x=s*-1.05; });
  const hinge=(x,y,z,geo,mat,ox)=>{ const g=new T.Group(); g.position.set(x,y,z); plane.add(g); const o=new T.Mesh(geo,mat); o.position.set(ox,0,0); g.add(o); return g; };
  const ailR=hinge(-.2,.78,3.5,new T.BoxGeometry(.5,.1,2.6),amber,-.25), ailL=hinge(-.2,.78,-3.5,new T.BoxGeometry(.5,.1,2.6),amber,-.25);
  // cola
  add(new T.BoxGeometry(.9,.1,3.6),white,-4.35,.22,0); const elev=hinge(-4.8,.22,0,new T.BoxGeometry(.55,.09,3.6),amber,-.275);
  const fin=add(new T.BoxGeometry(1.0,1.5,.1),white,-4.3,1.0,0); add(new T.BoxGeometry(1.0,.3,.105),blue,-4.3,1.55,0); const rudd=hinge(-4.8,1.0,0,new T.BoxGeometry(.55,1.5,.09),amber,-.275);
  // tren
  [[1.9,0],[-.2,.95],[-.2,-.95]].forEach(p=>{ const l=add(new T.CylinderGeometry(.04,.04,.75,8),dark,p[0],-.9,p[1]); const w=add(new T.CylinderGeometry(.24,.24,.14,18),dark,p[0],-1.3,p[1]); w.rotation.x=Math.PI/2; });
  // ejes (fijos al avión)
  const AX=[{k:"x",c:0xff6b5a,n:"Eje longitudinal",s:"alabeo · roll",d:[1,0,0],L:5.6},{k:"z",c:0x6fd08c,n:"Eje lateral",s:"cabeceo · pitch",d:[0,0,1],L:6.6},{k:"y",c:0x6fb4ff,n:"Eje vertical",s:"guiñada · yaw",d:[0,1,0],L:3.4}];
  AX.forEach(a=>{ const m=new T.MeshBasicMaterial({color:a.c,transparent:true,opacity:.55}); a.m=m; const cy=new T.Mesh(new T.CylinderGeometry(.035,.035,a.L*2,8),m); const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(...a.d)); cy.quaternion.copy(q); plane.add(cy);
    const co=new T.Mesh(new T.ConeGeometry(.13,.4,12),m); co.quaternion.copy(q); co.position.set(a.d[0]*a.L,a.d[1]*a.L,a.d[2]*a.L); plane.add(co);
    a.tag=document.createElement("div"); a.tag.className="tag"; a.tag.style.color="#"+a.c.toString(16).padStart(6,"0"); a.tag.innerHTML=a.n+"<small>"+a.s+"</small>"; box.appendChild(a.tag); a.p=new T.Vector3(a.d[0]*(a.L+.5),a.d[1]*(a.L+.5),a.d[2]*(a.L+.5)); });
  // suelo de referencia
  const grid=new T.GridHelper(40,40,0x2c4866,0x1b3046); grid.position.y=-3.2; scene.add(grid);
  let az=.75, el=.34, dist=19, drag=null, cur={r:0,p:0,y:0};
  box.addEventListener("pointerdown",e=>{ drag=[e.clientX,e.clientY]; box.setPointerCapture(e.pointerId); box.style.cursor="grabbing"; });
  box.addEventListener("pointermove",e=>{ if(!drag) return; az-=(e.clientX-drag[0])*.008; el=clamp(el+(e.clientY-drag[1])*.006,-.25,1.3); drag=[e.clientX,e.clientY]; });
  ["pointerup","pointercancel"].forEach(ev=>box.addEventListener(ev,()=>{ drag=null; box.style.cursor="grab"; }));
  E.ctr.addEventListener("click",()=>{ E.ail.value=0; E.ele.value=0; E.rud.value=0; });
  const v=new T.Vector3();
  function frame(){
    requestAnimationFrame(frame); if(!seen(box)||document.hidden) return;
    const w=W0(), h=H0(); if(rnd.domElement.width!==Math.round(w*rnd.getPixelRatio())||rnd.domElement.height!==Math.round(h*rnd.getPixelRatio())){ rnd.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
    const a=+E.ail.value, e=+E.ele.value, r=+E.rud.value;
    ailR.rotation.z=-a*.45; ailL.rotation.z=a*.45; elev.rotation.z=-e*.5; rudd.rotation.y=r*.5; prop.rotation.x+=.5;
    cur.r+=(a*.6-cur.r)*.08; cur.p+=(e*.38-cur.p)*.08; cur.y+=(r*.5-cur.y)*.08;
    plane.rotation.set(0,0,0); plane.rotateY(-cur.y); plane.rotateZ(cur.p); plane.rotateX(cur.r);
    const act=[Math.abs(a),Math.abs(e),Math.abs(r)], mx=Math.max(...act); AX.forEach((x,i)=>{ x.m.opacity=mx<.04?.55:(act[i]===mx?1:.22); });
    E.msg.innerHTML=mx<.04?"Mueve un mando<small>Alerones, timón de profundidad o timón de dirección</small>":act[0]===mx?"Alerones → alabeo (roll)<small>Giro sobre el eje longitudinal. Sube el alerón del ala que baja.</small>":act[1]===mx?"Timón de profundidad → cabeceo (pitch)<small>Giro sobre el eje lateral. Elevador arriba, morro arriba.</small>":"Timón de dirección → guiñada (yaw)<small>Giro sobre el eje vertical. El morro va hacia el lado del pedal.</small>";
    E.rRo.textContent=Math.round(cur.r*57.3)+"°"; E.rPi.textContent=Math.round(cur.p*57.3)+"°"; E.rYa.textContent=Math.round(cur.y*57.3)+"°";
    cam.position.set(Math.cos(az)*Math.cos(el)*dist,Math.sin(el)*dist,Math.sin(az)*Math.cos(el)*dist); cam.lookAt(0,0,0); rnd.render(scene,cam);
    AX.forEach(x=>{ v.copy(x.p).applyMatrix4(plane.matrixWorld).project(cam); x.tag.style.left=clamp((v.x*.5+.5)*w,50,w-50)+"px"; x.tag.style.top=clamp((-v.y*.5+.5)*h,60,h-18)+"px"; });
  }
  frame();
}
};
/*F1*/
/* ---------- Fase 1 · Principios de vuelo: viraje, polar y estabilidad ---------- */
const bgFill=(x,W,H)=>{ const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0e2136"); g.addColorStop(1,"#0a1727"); x.fillStyle=g; x.fillRect(0,0,W,H); };
const arrow=(x,d,x0,y0,dx,dy,col,lab,dash)=>{ const n=Math.hypot(dx,dy); if(n<3*d) return; x.save(); x.strokeStyle=col; x.fillStyle=col; x.lineWidth=3*d; if(dash) x.setLineDash([6*d,5*d]); x.beginPath(); x.moveTo(x0,y0); x.lineTo(x0+dx,y0+dy); x.stroke(); x.setLineDash([]);
  const ux=dx/n, uy=dy/n, h=9*d; x.beginPath(); x.moveTo(x0+dx+ux*h,y0+dy+uy*h); x.lineTo(x0+dx-uy*h*.55,y0+dy+ux*h*.55); x.lineTo(x0+dx+uy*h*.55,y0+dy-ux*h*.55); x.closePath(); x.fill();
  if(lab){ x.font=`700 ${12*d}px system-ui,sans-serif`; x.textAlign=dx<-n*.5?"right":"left"; x.fillText(lab,x0+dx+(dx<-n*.5?-12:12)*d,y0+dy+(dy<-n*.5?-6:dy>n*.5?16:4)*d); } x.restore(); };
const sidePlane=(x,s,col)=>{   // silueta lateral, morro a la derecha, centrada en el 25 % de la cuerda; s = px por metro
  x.fillStyle=col||"#e6ebf1"; x.beginPath(); x.moveTo(2.6*s,0); x.quadraticCurveTo(2.5*s,-.5*s,1.6*s,-.62*s); x.lineTo(.9*s,-1.05*s); x.lineTo(-.5*s,-1.05*s); x.quadraticCurveTo(-1.6*s,-.5*s,-5*s,-.32*s); x.lineTo(-5.4*s,-1.75*s); x.lineTo(-5.95*s,-1.75*s); x.lineTo(-5.75*s,.02*s); x.lineTo(-1.5*s,.6*s); x.quadraticCurveTo(1.4*s,.75*s,2.6*s,0); x.closePath(); x.fill();
  x.fillStyle="#9fb0c2"; x.beginPath(); x.ellipse(.15*s,-1.12*s,1.05*s,.13*s,0,0,7); x.fill(); x.beginPath(); x.ellipse(-5.4*s,-.3*s,.75*s,.08*s,0,0,7); x.fill();
  x.fillStyle="#23364b"; x.beginPath(); x.moveTo(1.55*s,-.6*s); x.lineTo(.95*s,-1*s); x.lineTo(-.4*s,-1*s); x.lineTo(-.4*s,-.55*s); x.closePath(); x.fill(); };
Object.assign(TTL,{turn:"Lámina interactiva · fuerzas en viraje",polar:"Lámina interactiva · polar y mejor planeo",stab:"Lámina interactiva · estabilidad longitudinal"});
Object.assign(CAP,{turn:"Viraje nivelado y coordinado. El factor de carga depende solo del alabeo; el radio y el régimen dependen además de la velocidad. Velocidad de pérdida a 1 g: 50 kt.",
  polar:"Avión de ejemplo con L/D máximo de 12,7. El peso no cambia el alcance en aire en calma: cambia la velocidad a la que se consigue y la tasa de descenso.",
  stab:"Punto neutro fijo en el 35 % de la cuerda media. Margen estático = punto neutro − centro de gravedad."});
Object.assign(HTML,{
 turn:`<figure><canvas data-i="cv" height="360" role="img" aria-label="Avión visto por detrás en viraje con sus fuerzas"></canvas>
 <div class="ctl"><label>Alabeo <input data-i="bk" type="range" min="0" max="70" step="1" value="30"><output data-i="bkO"></output></label><label>TAS <input data-i="tas" type="range" min="60" max="180" step="1" value="100"><output data-i="tasO"></output></label><button data-i="r1" type="button">Régimen 1 (3°/s)</button></div>
 <div class="read"><div data-i="nB">Factor de carga<b data-i="rN"></b></div><div>Velocidad de pérdida<b data-i="rVs"></b></div><div>Radio de viraje<b data-i="rR"></b></div><div>Régimen<b data-i="rW"></b></div><div>Vuelta de 360°<b data-i="rT"></b></div></div></figure>`,
 polar:`<figure><canvas data-i="cv" height="360" role="img" aria-label="Curva polar y trayectoria de planeo"></canvas>
 <div class="ctl"><label>IAS <input data-i="v" type="range" min="48" max="125" step="1" value="90"><output data-i="vO"></output></label><label>Masa <input data-i="m" type="range" min="800" max="1200" step="20" value="1000"><output data-i="mO"></output></label><label>Viento <input data-i="w" type="range" min="-30" max="30" step="1" value="0"><output data-i="wO"></output></label><button data-i="best" type="button">Ir a mejor planeo</button></div>
 <div class="read"><div data-i="ldB">L/D<b data-i="rLD"></b></div><div>Ángulo de planeo<b data-i="rG"></b></div><div>Tasa de descenso<b data-i="rS"></b></div><div>Alcance desde 3 000 ft<b data-i="rD"></b></div><div>Mejor planeo a<b data-i="rVb"></b></div></div></figure>`,
 stab:`<figure><canvas data-i="cv" height="360" role="img" aria-label="Avión de perfil con centro de gravedad y punto neutro"></canvas>
 <div class="ctl"><label>Centro de gravedad <input data-i="cg" type="range" min="12" max="46" step="0.5" value="24"><output data-i="cgO"></output></label><button data-i="gu" type="button">Ráfaga: morro arriba</button><button data-i="gd" type="button">Ráfaga: morro abajo</button><button data-i="rs" type="button">Reiniciar</button></div>
 <div class="read"><div>Margen estático<b data-i="rM"></b></div><div data-i="stB">Estabilidad<b data-i="rE"></b></div><div>Fuerza en el mando<b data-i="rF"></b></div><div>Tras la ráfaga<b data-i="rA"></b></div></div></figure>`});
Object.assign(LAB,{
 turn(root,E){
  const c=E.cv, x=c.getContext("2d"), G=9.81; let ph=0, last=0;
  E.r1.addEventListener("click",()=>{ const v=+E.tas.value*.5144; E.bk.value=Math.round(Math.atan(v*(3*Math.PI/180)/G)*180/Math.PI); });
  const loop=t=>{ requestAnimationFrame(loop); const dt=Math.min(.05,(t-last)/1000||0); last=t; if(!seen(c)||document.hidden) return;
    const d=fit(c), W=c.width, H=c.height, b=+E.bk.value, br=b*Math.PI/180, v=+E.tas.value*.5144, n=1/Math.cos(br), R=b>0?v*v/(G*Math.tan(br)):Infinity, om=b>0?G*Math.tan(br)/v:0;
    bgFill(x,W,H); const two=W>620*d, LW=two?W*.58:W, cx=LW/2, cy=H*.56, u=Math.min(LW/640,H/360)*d/d;
    // horizonte
    x.strokeStyle="rgba(150,190,230,.22)"; x.lineWidth=1*d; x.beginPath(); x.moveTo(0,cy+H*.3); x.lineTo(LW,cy+H*.3); x.stroke();
    // avión visto por detrás (alabeo a la derecha)
    x.save(); x.translate(cx,cy); x.rotate(br); const s=u*22;
    x.fillStyle="#c9d2dc"; x.fillRect(-7*s,-.16*s,14*s,.32*s); x.fillStyle="#1d56aa"; x.fillRect(-7*s,-.16*s,1.2*s,.32*s); x.fillRect(5.8*s,-.16*s,1.2*s,.32*s);
    x.fillStyle="#e9eef4"; x.beginPath(); x.ellipse(0,.55*s,.85*s,1*s,0,0,7); x.fill(); x.fillStyle="#23364b"; x.beginPath(); x.ellipse(0,.25*s,.6*s,.42*s,0,0,7); x.fill();
    x.fillStyle="#c9d2dc"; x.fillRect(-2.2*s,.5*s,4.4*s,.14*s); x.fillRect(-.07*s,-1.5*s,.14*s,1.6*s);
    x.strokeStyle="#8b97a6"; x.lineWidth=.08*s; x.beginPath(); x.moveTo(-.5*s,1.3*s); x.lineTo(-1.1*s,2*s); x.moveTo(.5*s,1.3*s); x.lineTo(1.1*s,2*s); x.stroke(); x.fillStyle="#1c2430"; x.beginPath(); x.arc(-1.1*s,2.05*s,.26*s,0,7); x.arc(1.1*s,2.05*s,.26*s,0,7); x.fill();
    x.restore();
    // fuerzas
    const Wl=Math.min(H*.25,92*d), Ll=Wl*n, lx=Math.sin(br)*Ll, ly=-Math.cos(br)*Ll;
    arrow(x,d,cx,cy,0,Wl,"rgba(255,255,255,.75)","W");
    arrow(x,d,cx,cy,0,-Wl,"#8df0b4",null,true); arrow(x,d,cx,cy-Wl,lx,0,"#ffc94d",null,true); arrow(x,d,cx,cy,lx,ly,"#6fd08c",null);
    x.font=`700 ${12*d}px system-ui,sans-serif`; x.textAlign="right"; x.fillStyle="#8df0b4"; x.fillText("L·cos φ = W",cx-10*d,cy-Wl*.55);
    { const far=cx+lx>LW-170*d, tx=far?cx+lx-6*d:cx+lx+12*d; x.textAlign=far?"right":"left"; x.fillStyle="#6fd08c"; x.fillText("L = "+n.toFixed(2)+" W",tx,cy+ly-14*d); if(b>3){ x.fillStyle="#ffc94d"; x.fillText("L·sen φ (centrípeta)",tx,cy+ly+(far?20:8)*d); } }
    x.strokeStyle="#ffc94d"; x.lineWidth=1.6*d; x.beginPath(); x.arc(cx,cy,34*d,-Math.PI/2,-Math.PI/2+br); x.stroke(); x.fillStyle="#ffc94d"; x.font=`600 ${12*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("φ "+b+"°",cx+8*d,cy-42*d);
    // vista en planta
    if(two){ const px=LW+ (W-LW)/2, py=H/2, pr=Math.min((W-LW)*.4,H*.38), sc=pr/Math.max(250,Math.min(R,4000));
      x.fillStyle="#0b1622"; x.fillRect(LW,0,W-LW,H); x.fillStyle="rgba(205,225,245,.7)"; x.font=`600 ${11*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("vista en planta",LW+12*d,18*d);
      const rr=isFinite(R)?R*sc:0; ph+=om*dt; if(rr>2){ x.strokeStyle="rgba(143,208,255,.55)"; x.lineWidth=1.5*d; x.setLineDash([5*d,5*d]); x.beginPath(); x.arc(px,py,Math.min(rr,pr*1.6),0,7); x.stroke(); x.setLineDash([]);
        const r2=Math.min(rr,pr*1.6), ax=px+Math.cos(ph-Math.PI/2)*r2, ay=py+Math.sin(ph-Math.PI/2)*r2; x.save(); x.translate(ax,ay); x.rotate(ph); x.fillStyle="#fff"; x.beginPath(); x.moveTo(11*d,0); x.lineTo(-7*d,-6*d); x.lineTo(-3*d,0); x.lineTo(-7*d,6*d); x.closePath(); x.fill(); x.restore();
        x.strokeStyle="rgba(255,201,77,.8)"; x.lineWidth=1.2*d; x.beginPath(); x.moveTo(px,py); x.lineTo(ax,ay); x.stroke(); x.fillStyle="#ffc94d"; x.textAlign="center"; x.fillText("R = "+Math.round(R)+" m",px,py+pr*1.6>H-8*d?H-10*d:py+16*d); }
      else { x.fillStyle="#fff"; x.textAlign="center"; x.fillText("vuelo recto: sin viraje",px,py); } }
    E.bkO.textContent=b+"°"; E.tasO.textContent=E.tas.value+" kt"; E.rN.textContent=n.toFixed(2)+" g"; E.nB.className=n>=2?"bad":""; E.rVs.textContent=Math.round(50*Math.sqrt(n))+" kt";
    E.rR.textContent=isFinite(R)?(R>=1852?(R/1852).toFixed(1)+" NM":Math.round(R)+" m"):"—"; E.rW.textContent=(om*180/Math.PI).toFixed(1)+" °/s"; E.rT.textContent=om>0?(360/(om*180/Math.PI)>=120?(6/(om*180/Math.PI)).toFixed(1)+" min":Math.round(360/(om*180/Math.PI))+" s"):"—"; };
  requestAnimationFrame(loop);
 },
 polar(root,E){
  const c=E.cv, x=c.getContext("2d"), CD0=.03, K=.052, S=16, RHO=1.225, CLB=Math.sqrt(CD0/K), LDB=1/(2*Math.sqrt(CD0*K)); let ph=0, last=0;
  const vb=m=>Math.sqrt(2*m*9.81/(RHO*S*CLB))/.5144;
  E.best.addEventListener("click",()=>{ E.v.value=Math.round(vb(+E.m.value)); });
  const loop=t=>{ requestAnimationFrame(loop); const dt=Math.min(.05,(t-last)/1000||0); last=t; if(!seen(c)||document.hidden) return;
    const d=fit(c), W=c.width, H=c.height, m=+E.m.value, wk=+E.w.value, vmin=Math.sqrt(2*m*9.81/(RHO*S*1.7))/.5144; let vk=Math.max(+E.v.value,Math.ceil(vmin)); const v=vk*.5144;
    const cl=2*m*9.81/(RHO*S*v*v), cd=CD0+K*cl*cl, ld=cl/cd, gam=Math.atan(1/ld), sink=v*Math.sin(gam), gs=v*Math.cos(gam)-wk*.5144, dist=gs>0?(914.4/sink)*gs:0;
    bgFill(x,W,H); const two=W>620*d, PW=two?W*.4:W*.0, px0=46*d, py0=H-40*d, pw=PW-70*d, ph0=H-80*d, X=q=>px0+q/.2*pw, Y=q=>py0-q/1.8*ph0;
    if(two){ x.strokeStyle="rgba(150,190,230,.35)"; x.lineWidth=1*d; x.beginPath(); x.moveTo(px0,py0-ph0); x.lineTo(px0,py0); x.lineTo(px0+pw,py0); x.stroke();
      x.fillStyle="rgba(205,225,245,.8)"; x.font=`600 ${11*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("CL",px0+6*d,py0-ph0+4*d); x.fillText("CD",px0+pw-18*d,py0+16*d);
      x.strokeStyle="#8fd0ff"; x.lineWidth=2*d; x.beginPath(); for(let q=0;q<=1.72;q+=.02){ const xx=X(CD0+K*q*q), yy=Y(q); q?x.lineTo(xx,yy):x.moveTo(xx,yy); } x.stroke();
      const tb=CD0+K*CLB*CLB; x.strokeStyle="rgba(141,240,180,.7)"; x.setLineDash([5*d,4*d]); x.beginPath(); x.moveTo(X(0),Y(0)); x.lineTo(X(tb*2.1),Y(CLB*2.1)); x.stroke(); x.setLineDash([]);
      x.fillStyle="#8df0b4"; x.beginPath(); x.arc(X(tb),Y(CLB),4.5*d,0,7); x.fill(); x.fillText("L/D máx "+LDB.toFixed(1),X(tb)+8*d,Y(CLB)+14*d);
      x.strokeStyle="rgba(255,201,77,.9)"; x.lineWidth=1.5*d; x.beginPath(); x.moveTo(X(0),Y(0)); x.lineTo(X(cd),Y(cl)); x.stroke(); x.fillStyle="#ffc94d"; x.beginPath(); x.arc(X(cd),Y(cl),5.5*d,0,7); x.fill(); }
    // planeo de perfil
    const gx0=PW+26*d, gx1=W-20*d, gy0=54*d, gy1=H-46*d, maxD=13.5, sx=q=>gx0+q/maxD*(gx1-gx0);   // km
    x.fillStyle="#2f5d3a"; x.fillRect(gx0-10*d,gy1,gx1-gx0+20*d,8*d); x.strokeStyle="rgba(150,190,230,.25)"; x.lineWidth=1*d; x.fillStyle="rgba(205,225,245,.7)"; x.font=`600 ${11*d}px ui-monospace,Menlo,monospace`; x.textAlign="center";
    for(let k=0;k<=12;k+=2){ x.beginPath(); x.moveTo(sx(k),gy1); x.lineTo(sx(k),gy1+12*d); x.stroke(); x.fillText(k+" km",sx(k),gy1+26*d); }
    x.textAlign="left"; x.fillText("3 000 ft",gx0+4*d,gy0-10*d);
    const bestD=(914.4*LDB)/1000; x.strokeStyle="rgba(141,240,180,.55)"; x.setLineDash([5*d,5*d]); x.beginPath(); x.moveTo(gx0,gy0); x.lineTo(sx(Math.min(bestD,maxD)),gy1); x.stroke(); x.setLineDash([]); x.fillStyle="#8df0b4"; x.fillText("mejor planeo, sin viento",sx(Math.min(bestD,maxD))-150*d,gy1-8*d);
    const dk=Math.min(dist/1000,maxD); x.strokeStyle="#ffc94d"; x.lineWidth=2*d; x.beginPath(); x.moveTo(gx0,gy0); x.lineTo(sx(dk),gy1); x.stroke();
    ph=(ph+dt*.16)%1; const ax=lerp(gx0,sx(dk),ph), ay=lerp(gy0,gy1,ph), an=Math.atan2(gy1-gy0,sx(dk)-gx0); x.save(); x.translate(ax,ay); x.rotate(an); sidePlane(x,5.5*d); x.restore();
    if(wk){ const wy=gy0+26*d, dir=wk>0?-1:1; arrow(x,d,(gx0+gx1)/2-dir*30*d,wy,dir*60*d,0,"#8fd0ff",(wk>0?"viento en cara ":"viento en cola ")+Math.abs(wk)+" kt"); }
    E.vO.textContent=vk+" kt"; E.mO.textContent=m+" kg"; E.wO.textContent=(wk>0?"cara ":wk<0?"cola ":"")+Math.abs(wk)+" kt"; E.rLD.textContent=ld.toFixed(1); E.ldB.className=ld>LDB-.15?"good":"";
    E.rG.textContent=(gam*180/Math.PI).toFixed(1)+"°"; E.rS.textContent=Math.round(sink*196.85)+" ft/min"; E.rD.textContent=dist>0?(dist/1852).toFixed(1)+" NM":"no avanza"; E.rVb.textContent=Math.round(vb(m))+" kt"; };
  requestAnimationFrame(loop);
 },
 stab(root,E){
  const c=E.cv, x=c.getContext("2d"), NP=35; let th=0, om=0, last=0, tr=[], tAcc=0, kicked=false;
  const kick=s=>{ th=s*6; om=0; tr=[]; kicked=true; }; E.gu.addEventListener("click",()=>kick(1)); E.gd.addEventListener("click",()=>kick(-1)); E.rs.addEventListener("click",()=>{ th=0; om=0; tr=[]; kicked=false; });
  const loop=t=>{ requestAnimationFrame(loop); const dt=Math.min(.05,(t-last)/1000||0); last=t; if(!seen(c)||document.hidden) return;
    const d=fit(c), W=c.width, H=c.height, cg=+E.cg.value, sm=NP-cg;
    if(kicked){ const k=sm*.55, cdamp=.9+Math.max(0,sm)*.05; om+=(-k*th-cdamp*om)*dt; th+=om*dt; if(Math.abs(th)>32){ th=32*Math.sign(th); om=0; } tAcc+=dt; if(tAcc>.05){ tAcc=0; tr.push(th); if(tr.length>220) tr.shift(); } }
    bgFill(x,W,H); const cx=W*.5, cy=H*.42, s=Math.min(W/13.5,H/8.5), mac=1.5*s, xOf=p=>(.375-p/100*1)*mac*1+ .0;   // posición a lo largo de la cuerda (borde de ataque en +0,375·MAC respecto al 25 %... simplificado)
    const xp=p=>cx+(0.3-p/100)*s*5;   // escala ampliada para que se vea la separación
    x.strokeStyle="rgba(150,190,230,.2)"; x.lineWidth=1*d; x.setLineDash([6*d,6*d]); x.beginPath(); x.moveTo(20*d,cy); x.lineTo(W-20*d,cy); x.stroke(); x.setLineDash([]);
    const xcg=xp(cg), xnp=xp(NP), a=-th*Math.PI/180;
    x.save(); x.translate(xcg,cy); x.rotate(a); x.translate(cx-xcg,0); sidePlane(x,s);
    // regla de cuerda media
    x.strokeStyle="rgba(255,255,255,.5)"; x.lineWidth=2*d; x.beginPath(); x.moveTo(xp(0)-cx,1.05*s); x.lineTo(xp(60)-cx,1.05*s); for(let q=0;q<=60;q+=10){ x.moveTo(xp(q)-cx,1.05*s); x.lineTo(xp(q)-cx,.95*s); } x.stroke(); x.fillStyle="rgba(205,225,245,.85)"; x.font=`600 ${10.5*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("0 % MAC",xp(0)-cx+6*d,1.1*s); x.textAlign="right"; x.fillText("60 %",xp(60)-cx-6*d,1.1*s);
    // punto neutro y CG
    const mark=(xx,col,lab,dy)=>{ x.fillStyle=col; x.beginPath(); x.arc(xx-cx,0,.16*s,0,7); x.fill(); x.strokeStyle=col; x.lineWidth=1.5*d; x.beginPath(); x.moveTo(xx-cx,0); x.lineTo(xx-cx,dy*s); x.stroke(); x.font=`700 ${12*d}px system-ui,sans-serif`; x.textAlign="center"; x.fillText(lab,xx-cx,dy*s+(dy>0?14:-6)*d); };
    mark(xnp,"#8fd0ff","Punto neutro",1.55); mark(xcg,"#ffc94d","CG",2.15);
    // variación de sustentación en el punto neutro y momento resultante
    if(kicked&&Math.abs(th)>.4){ const dl=clamp(th*.09,-1.6,1.6)*s; x.save(); x.translate(xnp-cx,0); arrow(x,d,0,0,0,-dl,"#6fd08c","ΔL"); x.restore(); }
    x.restore();
    if(kicked&&Math.abs(th)>.4&&Math.abs(sm)>.3){ const rest=sm>0, dir=(th>0?1:-1)*(rest?1:-1); x.strokeStyle=rest?"#8df0b4":"#ff8a7a"; x.lineWidth=3*d; x.beginPath(); x.arc(xcg,cy,1.05*s,dir>0?-.9:Math.PI+.9,dir>0?.5:Math.PI-.5,dir<0); x.stroke();
      x.fillStyle=rest?"#8df0b4":"#ff8a7a"; x.font=`700 ${13*d}px system-ui,sans-serif`; x.textAlign="center"; x.fillText(rest?"Momento recuperador: el morro vuelve":"Momento que agrava: el morro se va",W/2,26*d); }
    // registro de cabeceo
    const gx=24*d, gw=W-48*d, gy=H-58*d, gh=44*d; x.fillStyle="rgba(8,16,26,.6)"; x.fillRect(gx,gy-gh,gw,gh*2); x.strokeStyle="rgba(150,190,230,.3)"; x.lineWidth=1*d; x.beginPath(); x.moveTo(gx,gy); x.lineTo(gx+gw,gy); x.stroke();
    x.fillStyle="rgba(205,225,245,.7)"; x.font=`600 ${10.5*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("cabeceo tras la ráfaga",gx+6*d,gy-gh+13*d);
    if(tr.length>1){ x.strokeStyle=sm>.3?"#8df0b4":sm<-.3?"#ff8a7a":"#ffc94d"; x.lineWidth=2*d; x.beginPath(); tr.forEach((q,i)=>{ const xx=gx+i/220*gw, yy=gy-clamp(q/32,-1,1)*gh*.9; i?x.lineTo(xx,yy):x.moveTo(xx,yy); }); x.stroke(); }
    E.cgO.textContent=cg.toFixed(1)+" % MAC"; E.rM.textContent=(sm>0?"+":"")+sm.toFixed(1)+" %"; E.rE.textContent=sm>.3?"Estable":sm<-.3?"Inestable":"Neutra"; E.stB.className=sm>.3?"good":sm<-.3?"bad":"";
    E.rF.textContent=sm>14?"Alta":sm>5?"Media":sm>.3?"Baja":"Nula o invertida"; E.rA.textContent=!kicked?"Pulsa una ráfaga":sm>.3?"Vuelve sola":sm<-.3?"Se aleja cada vez más":"Se queda donde la dejan"; };
  requestAnimationFrame(loop);
 }
});
/*F1END*/
const FB={
 tunnel:"<b>Ángulo de ataque y pérdida</b><ul><li>El CL crece con el ángulo de ataque hasta el ángulo crítico (unos 16°).</li><li>Pasado ese ángulo el flujo se desprende del extradós: la sustentación cae y la resistencia aumenta mucho.</li><li>El ala entra en pérdida siempre al mismo ángulo, a cualquier velocidad o peso.</li></ul>",
 engine:"<b>Los cuatro tiempos</b><ul><li>1 · Intake (admisión): pistón baja, válvula de admisión abierta.</li><li>2 · Compression (compresión): pistón sube, válvulas cerradas.</li><li>3 · Power (expansión): salta la chispa, el pistón baja y produce trabajo.</li><li>4 · Exhaust (escape): pistón sube, válvula de escape abierta.</li><li>Ciclo completo: 720° de cigüeñal.</li></ul>",
 altimeter:"<b>Altímetro y reglaje</b><ul><li>El altímetro mide desde la presión seleccionada en la ventanilla.</li><li>Reglaje más alto que el QNH real: sobre-lee (el avión está más bajo).</li><li>Por debajo de 5 000 ft, 1 hPa ≈ 30 ft.</li></ul>",
 axes:"<b>Ejes y mandos</b><ul><li>Alerones → alabeo (roll) sobre el eje longitudinal.</li><li>Timón de profundidad → cabeceo (pitch) sobre el eje lateral.</li><li>Timón de dirección → guiñada (yaw) sobre el eje vertical.</li></ul>",
 turn:"<b>Viraje nivelado</b><ul><li>Factor de carga n = 1 / cos φ: 1,15 a 30°, 1,41 a 45°, 2 a 60°.</li><li>La velocidad de pérdida crece con √n.</li><li>A más velocidad con el mismo alabeo: más radio y menos régimen de viraje.</li></ul>",
 polar:"<b>Polar y mejor planeo</b><ul><li>El mejor planeo se da a L/D máximo: la tangente a la polar desde el origen.</li><li>Más peso: mismo alcance en aire en calma, pero a más velocidad y con más tasa de descenso.</li><li>Viento en cara acorta el alcance; viento en cola lo alarga.</li></ul>",
 stab:"<b>Estabilidad longitudinal</b><ul><li>CG por delante del punto neutro: estable (vuelve sola), mandos más duros.</li><li>CG en el punto neutro: neutra.</li><li>CG por detrás: inestable.</li></ul>"};
function fail(L,e){ if(!L||L.dead) return; L.dead=true; try{ console.error("F0Lab",L.k,e); }catch(_){} try{ if(L.rnd){ L.rnd.dispose(); L.rnd.forceContextLoss&&L.rnd.forceContextLoss(); } }catch(_){}
  L.el.innerHTML='<p class="lt">'+TTL[L.k]+'</p><div class="fb">'+(FB[L.k]||"")+'<p class="fbn">La lámina interactiva no se ha podido mostrar en este dispositivo. <button type="button">Reintentar</button></p></div>';
  const b=L.el.querySelector("button"); if(b) b.addEventListener("click",()=>{ L.el._lab=0; build(L.el); }); }
let three=null; const needThree=()=>three||(three=new Promise((ok,ko)=>{ if(window.THREE) return ok(); const s=document.createElement("script"), to=setTimeout(()=>{ three=null; ko(new Error("tiempo agotado")); },12000); s.src=(window.F0LABS_BASE||"../")+"three.min.js"; s.onload=()=>{ clearTimeout(to); window.THREE?ok():ko(new Error("sin THREE")); }; s.onerror=()=>{ clearTimeout(to); three=null; ko(new Error("no carga")); }; document.head.appendChild(s); }));
function build(el){
  if(el._lab) return; const k=el.dataset.lab; el._lab=1; const L={k,el,dead:false};
  el.innerHTML='<p class="lt">'+TTL[k]+'</p>'+HTML[k]+'<p class="cap">'+CAP[k]+'</p>';
  const E={}; el.querySelectorAll("[data-i]").forEach(n=>{ E[n.dataset.i]=n; }); E._L=L;
  const go=()=>{ if(L.dead) return; CUR=L; try{ LAB[k](el,E); }catch(e){ fail(L,e); } CUR=null; };
  if(k==="axes"){ const c=document.createElement("canvas"); let gl=null; try{ gl=c.getContext("webgl2")||c.getContext("webgl"); }catch(e){} if(!gl){ fail(L,new Error("sin WebGL")); return; }
    needThree().then(go,e=>fail(L,e)); }
  else go();
}
function mount(el){
  const k=el.dataset.lab; if(el._m||!LAB[k]) return; el._m=1;
  el.innerHTML='<p class="lt">'+TTL[k]+'</p><div class="sk"><span>Cargando la lámina…</span></div>';
  if(!("IntersectionObserver" in window)){ build(el); return; }
  const o=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ o.disconnect(); build(el); } },{rootMargin:"500px"}); o.observe(el);
}
function init(){ if(!document.getElementById("f0labCss")){ const s=document.createElement("style"); s.id="f0labCss"; s.textContent=CSS; document.head.appendChild(s); } document.querySelectorAll(".f0lab[data-lab]").forEach(mount); }
window.F0Labs={init}; if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
