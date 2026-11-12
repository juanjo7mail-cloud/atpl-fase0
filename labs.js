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
.f0lab .dx{background:#0f1b29;color:#dbe6f1;padding:10px 14px;border-top:1px solid #22344a;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;min-height:3em}.f0lab .dx b{color:#ffc94d}
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
/*F3*/
/* ---------- Meteorología · viento, rumbo y deriva ---------- */
Object.assign(TTL,{wind:"Lámina interactiva · el viento y el avión"});
Object.assign(CAP,{wind:"Vista desde arriba, con el norte arriba. El viento se nombra por la dirección de la que VIENE. Veer: rola en sentido horario (270° → 300°). Back: rola en sentido antihorario (270° → 240°)."});
Object.assign(FB,{wind:"<b>Viento, rumbo y deriva</b><ul><li>El viento se nombra por donde viene: 270° viene del oeste y empuja hacia el este.</li><li>Veer = rola en sentido horario; back = antihorario.</li><li>Viento por la derecha: deriva a la izquierda; se corrige con el morro a la derecha (hacia el viento).</li><li>De cara: baja la velocidad sobre el suelo. De cola: sube.</li></ul>"});
Object.assign(HTML,{wind:`<figure><canvas data-i="cv" height="420" role="img" aria-label="Avión visto desde arriba con el viento, el rumbo y la trayectoria"></canvas>
<div class="ctl"><label>Viento de <input data-i="wd" type="range" min="0" max="359" step="1" value="330"><output data-i="wdO"></output></label><label>Fuerza <input data-i="ws" type="range" min="0" max="50" step="1" value="25"><output data-i="wsO"></output></label><label>Ruta <input data-i="tk" type="range" min="0" max="359" step="1" value="90"><output data-i="tkO"></output></label></div>
<div class="ctl" style="border-top:1px solid #22344a"><button data-i="back" type="button">↺ Back 30°</button><button data-i="veer" type="button">↻ Veer 30°</button><button data-i="pH" type="button">De cara</button><button data-i="pT" type="button">De cola</button><button data-i="pR" type="button">Por la derecha</button><button data-i="pL" type="button">Por la izquierda</button><button data-i="fix" type="button" aria-pressed="true">Corregir deriva</button></div>
<div class="read"><div>El viento entra<b data-i="rRel"></b></div><div>Rumbo (heading)<b data-i="rH"></b></div><div>Trayectoria (track)<b data-i="rT"></b></div><div data-i="dB">Deriva / corrección<b data-i="rD"></b></div><div>Velocidad sobre el suelo<b data-i="rG"></b></div></div></figure>`});
Object.assign(LAB,{
 wind(root,E){
  const c=E.cv, x=c.getContext("2d"), TAS=100, R=Math.PI/180, n3=v=>String(Math.round(((v%360)+360)%360)||360).padStart(3,"0");
  let wd=+E.wd.value, tgt=wd, fix=true, last=0, pos=[0,0], T=0, msg="", msgT=0;
  const parts=Array.from({length:70},()=>[Math.random(),Math.random(),Math.random()]);
  const setW=(v,m)=>{ tgt=v; if(m){ msg=m; msgT=3.2; } };
  E.wd.addEventListener("input",()=>{ wd=tgt=+E.wd.value; });
  E.veer.addEventListener("click",()=>setW(tgt+30,"VEER · rola en sentido horario ↻"));
  E.back.addEventListener("click",()=>setW(tgt-30,"BACK · rola en sentido antihorario ↺"));
  [["pH",0],["pT",180],["pR",90],["pL",-90]].forEach(p=>E[p[0]].addEventListener("click",()=>setW(+E.tk.value+p[1],"")));
  E.fix.addEventListener("click",()=>{ fix=!fix; E.fix.setAttribute("aria-pressed",fix); pos=[0,0]; });
  E.tk.addEventListener("input",()=>{ pos=[0,0]; });
  const hash=(i,j)=>{ let h=(i*374761393+j*668265263)^(i*i*31); h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; };
  const vec=(deg,len)=>[Math.sin(deg*R)*len,-Math.cos(deg*R)*len];
  const loop=t=>{ requestAnimationFrame(loop); const dt=Math.min(.05,(t-last)/1000||0); last=t; T+=dt; if(!seen(c)||document.hidden) return;
    const d=fit(c), W=c.width, H=c.height; if(Math.abs(tgt-wd)>.3){ wd+=clamp(tgt-wd,-55*dt,55*dt); E.wd.value=Math.round(((wd%360)+360)%360); } else { wd=tgt=((tgt%360)+360)%360; }
    const ws=+E.ws.value, tk=+E.tk.value, rel=(((wd-tk)%360)+540)%360-180;   // viento respecto a la ruta: + por la derecha
    const wv=vec(wd+180,ws);   // hacia donde empuja
    let hdg, tmg, gs, wca=0;
    if(fix){ const s=clamp(ws*Math.sin(rel*R)/TAS,-1,1); wca=Math.asin(s)/R; hdg=tk+wca; gs=TAS*Math.cos(wca*R)-ws*Math.cos(rel*R); tmg=tk; }
    else { hdg=tk; const a=vec(hdg,TAS), g=[a[0]+wv[0],a[1]+wv[1]]; gs=Math.hypot(g[0],g[1]); tmg=Math.atan2(g[0],-g[1])/R; }
    const drift=(((tmg-hdg)%360)+540)%360-180, gv=vec(tmg,gs), k=.9*d;   // px por kt·s
    pos[0]+=gv[0]*dt*k; pos[1]+=gv[1]*dt*k;
    // distancia a la ruta deseada (pasa por el origen); si se aleja mucho, se reinicia
    const tn=vec(tk+90,1), off=pos[0]*tn[0]+pos[1]*tn[1]; if(Math.abs(off)>H*.36){ pos=[0,0]; }
    const cx=W*.5, cy=H*.52;
    // terreno: parcelas que se desplazan bajo el avión
    const cs=92*d, ox=((-pos[0]%cs)+cs)%cs, oy=((-pos[1]%cs)+cs)%cs, i0=Math.floor(pos[0]/cs), j0=Math.floor(pos[1]/cs);
    for(let i=-1;i<=Math.ceil(W/cs)+1;i++) for(let j=-1;j<=Math.ceil(H/cs)+1;j++){ const gi=i+i0-Math.floor(cx/cs), gj=j+j0-Math.floor(cy/cs), h=hash(gi,gj), h2=hash(gi+91,gj-37);
      const col=h<.3?[96,118,62]:h<.55?[122,132,74]:h<.75?[146,138,86]:h<.9?[84,108,60]:[70,96,58]; x.fillStyle=`rgb(${col[0]+h2*14|0},${col[1]+h2*12|0},${col[2]+h2*10|0})`;
      const px=(i-1)*cs+ox+(cx%cs), py=(j-1)*cs+oy+(cy%cs); x.fillRect(px,py,cs+1,cs+1);
      if(h2>.55){ x.strokeStyle="rgba(40,60,30,.16)"; x.lineWidth=1*d; x.beginPath(); for(let q=1;q<6;q++){ if(h>.5){ x.moveTo(px+q*cs/6,py); x.lineTo(px+q*cs/6,py+cs); } else { x.moveTo(px,py+q*cs/6); x.lineTo(px+cs,py+q*cs/6); } } x.stroke(); }
      x.strokeStyle="rgba(30,45,25,.35)"; x.lineWidth=1*d; x.strokeRect(px,py,cs,cs); }
    x.fillStyle="rgba(8,16,26,.30)"; x.fillRect(0,0,W,H);
    // ruta deseada (fija en el terreno)
    const o=[cx-pos[0],cy-pos[1]], rv=vec(tk,W+H); x.strokeStyle="rgba(255,255,255,.85)"; x.lineWidth=2.5*d; x.setLineDash([14*d,10*d]); x.beginPath(); x.moveTo(o[0]-rv[0],o[1]-rv[1]); x.lineTo(o[0]+rv[0],o[1]+rv[1]); x.stroke(); x.setLineDash([]);
    { const lp=vec(tk,H*.3); x.fillStyle="#fff"; x.font=`700 ${12*d}px system-ui,sans-serif`; x.textAlign="center"; x.fillText("RUTA "+n3(tk)+"°",clamp(o[0]+lp[0]+tn[0]*16*d,60*d,W-60*d),clamp(o[1]+lp[1]+tn[1]*16*d,20*d,H-12*d)); }
    // viento: trazos que cruzan el mapa
    if(ws>0){ const wu=vec(wd+180,1), L=(10+ws*.9)*d; x.strokeStyle="rgba(190,225,255,.55)"; x.lineWidth=1.6*d; x.lineCap="round"; x.beginPath();
      for(const p of parts){ p[0]+=wu[0]*ws*dt*.012*(.6+p[2]); p[1]+=wu[1]*ws*dt*.012*(.6+p[2]); p[0]=(p[0]%1+1)%1; p[1]=(p[1]%1+1)%1; const px=p[0]*W, py=p[1]*H; x.moveTo(px,py); x.lineTo(px-wu[0]*L,py-wu[1]*L); } x.stroke(); }
    // sombra y avión (apunta al rumbo)
    const plane=(px,py,a,col,sc)=>{ x.save(); x.translate(px,py); x.rotate(a*R); x.scale(sc,sc); x.fillStyle=col; x.beginPath();
      x.moveTo(0,-30); x.quadraticCurveTo(4.5,-24,4.5,-12); x.lineTo(34,-3); x.lineTo(34,3); x.lineTo(4.5,4); x.lineTo(3.2,20); x.lineTo(12,25); x.lineTo(12,28.5); x.lineTo(0,27); x.lineTo(-12,28.5); x.lineTo(-12,25); x.lineTo(-3.2,20); x.lineTo(-4.5,4); x.lineTo(-34,3); x.lineTo(-34,-3); x.lineTo(-4.5,-12); x.quadraticCurveTo(-4.5,-24,0,-30); x.closePath(); x.fill(); x.restore(); };
    plane(cx+10*d,cy+14*d,hdg,"rgba(0,0,0,.28)",1.5*d); plane(cx,cy,hdg,"#f4f6f9",1.5*d);
    x.save(); x.translate(cx,cy); x.rotate(hdg*R); x.fillStyle="#1d56aa"; x.fillRect(-51*d,-4.5*d,9*d,9*d); x.fillRect(42*d,-4.5*d,9*d,9*d); x.fillStyle="#23364b"; x.fillRect(-4*d,-27*d,8*d,9*d); x.restore();
    // vectores: rumbo y trayectoria
    const hv=vec(hdg,H*.3), tv=vec(tmg,H*.3*clamp(gs/TAS,.45,1.5));
    arrow(x,d,cx,cy,hv[0],hv[1],"#ffffff","HDG "+n3(hdg)+"°"); arrow(x,d,cx,cy,tv[0],tv[1],"#ffc94d","TRK "+n3(tmg)+"°",true);
    if(Math.abs(drift)>1.2){ const a0=(hdg-90)*R, a1=(tmg-90)*R; x.strokeStyle="#ffc94d"; x.lineWidth=2*d; x.beginPath(); x.arc(cx,cy,H*.18,a0,a1,drift<0); x.stroke(); const mv=vec((hdg+tmg)/2+(Math.abs(hdg-tmg)>180?180:0),H*.215); x.fillStyle="#ffc94d"; x.font=`700 ${13*d}px ui-monospace,Menlo,monospace`; x.textAlign="center"; x.fillText(Math.abs(Math.round(drift))+"°",cx+mv[0],cy+mv[1]+4*d); }
    // flecha grande de viento y rosa
    const rc=[70*d,74*d], rr=46*d; x.fillStyle="rgba(8,16,26,.78)"; x.beginPath(); x.arc(rc[0],rc[1],rr+14*d,0,7); x.fill(); x.strokeStyle="rgba(205,225,245,.5)"; x.lineWidth=1*d; x.beginPath(); x.arc(rc[0],rc[1],rr,0,7); x.stroke();
    x.fillStyle="rgba(205,225,245,.9)"; x.font=`700 ${11*d}px system-ui,sans-serif`; x.textAlign="center"; [["N",0],["E",90],["S",180],["W",270]].forEach(q=>{ const v=vec(q[1],rr+7*d); x.fillText(q[0],rc[0]+v[0],rc[1]+v[1]+4*d); });
    if(ws>0){ const f=vec(wd,rr-3*d), tI=vec(wd+180,rr*.55); arrow(x,d,rc[0]+f[0],rc[1]+f[1],tI[0]-f[0],tI[1]-f[1],"#8fd0ff",null); }
    x.fillStyle="#8fd0ff"; x.font=`700 ${13*d}px ui-monospace,Menlo,monospace`; x.textAlign="left"; x.fillText("VIENTO "+n3(wd)+"° / "+ws+" kt",rc[0]+rr+22*d,rc[1]-6*d);
    x.fillStyle="rgba(205,225,245,.85)"; x.font=`600 ${11.5*d}px system-ui,sans-serif`; x.fillText("viene del "+["N","NE","E","SE","S","SW","W","NW"][Math.round((((wd%360)+360)%360)/45)%8]+" y empuja hacia el "+["S","SW","W","NW","N","NE","E","SE"][Math.round((((wd%360)+360)%360)/45)%8],rc[0]+rr+22*d,rc[1]+12*d);
    if(msgT>0){ msgT-=dt; x.globalAlpha=clamp(msgT,0,1); x.fillStyle="#ffc94d"; x.font=`800 ${22*d}px "Barlow Condensed","Arial Narrow",sans-serif`; x.textAlign="center"; x.fillText(msg,W/2,H-22*d); x.globalAlpha=1; }
    if(!fix&&Math.abs(off)>18*d){ x.fillStyle="#ff8a7a"; x.font=`700 ${13*d}px system-ui,sans-serif`; x.textAlign="right"; x.fillText("Sin corregir: el viento te saca de la ruta",W-14*d,24*d); }
    // lecturas
    const ar=Math.abs(rel), side=rel>0?"derecha":"izquierda", where=ws===0?"Sin viento":ar<15?"De cara":ar>165?"De cola":ar>75&&ar<105?"Por la "+side:(ar<90?"De cara y por la "+side:"De cola y por la "+side);
    E.wdO.textContent=n3(wd)+"°"; E.wsO.textContent=ws+" kt"; E.tkO.textContent=n3(tk)+"°"; E.rRel.textContent=where; E.rH.textContent=n3(hdg)+"°"; E.rT.textContent=n3(tmg)+"°"; E.rG.textContent=Math.round(gs)+" kt";
    E.rD.textContent=fix?(Math.abs(wca)<.5?"0°":"WCA "+Math.abs(Math.round(wca))+"° a la "+(wca>0?"derecha":"izquierda")):(Math.abs(drift)<.5?"0°":"Deriva "+Math.abs(Math.round(drift))+"° a la "+(drift>0?"derecha":"izquierda")); E.dB.className=(!fix&&Math.abs(drift)>=.5)?"bad":""; };
  requestAnimationFrame(loop);
 }
});
/*F3END*/
/*F2*/
/* ---------- Fase 2 · AGK: giróscopo 3D, pitot-estática con obstrucciones y hélices ---------- */
Object.assign(TTL,{gyro:"Modelo 3D · giróscopo: rigidez y precesión",pitot:"Lámina interactiva · pitot-estática y obstrucciones",prop:"Lámina interactiva · paso fijo y velocidad constante"});
Object.assign(CAP,{gyro:"Arrastra para girar la vista. Rigidez: el eje de un rotor que gira rápido sigue apuntando al mismo punto del espacio aunque se mueva el soporte. Precesión: una fuerza aplicada al rotor actúa 90° más adelante en el sentido de giro. Más RPM: más rigidez y precesión más lenta.",
 pitot:"El tiempo corre 20 veces más rápido para que el cambio de altitud se vea. La aguja verde fina marca el valor real. El anemómetro compara la presión total (pitot) con la estática; el altímetro y el variómetro solo usan la estática.",
 prop:"Sección de la pala al 75 % del radio, vista desde la punta. Ángulo de ataque = ángulo de pala − ángulo de avance. Para comparar, las RPM se fijan con el mando en las dos hélices; en una de paso fijo real, las RPM suben y bajan con la velocidad."});
Object.assign(FB,{gyro:"<b>Giróscopo</b><ul><li>Rigidez: el eje del rotor mantiene su dirección en el espacio. Aumenta con las RPM y con la masa lejos del eje.</li><li>Precesión: una fuerza aplicada al rotor actúa 90° más adelante en el sentido de giro.</li><li>Más RPM: más rigidez y menos precesión para la misma fuerza.</li></ul>",
 pitot:"<b>Obstrucciones del sistema pitot-estática</b><ul><li>Estática bloqueada: altímetro congelado, variómetro a cero; el anemómetro marca de menos al subir y de más al bajar.</li><li>Pitot bloqueado con drenaje libre: el anemómetro cae a cero.</li><li>Pitot y drenaje bloqueados: el anemómetro se comporta como un altímetro (sube al ascender, baja al descender).</li></ul>",
 prop:"<b>Paso fijo y velocidad constante</b><ul><li>Ángulo de ataque de la pala = ángulo de pala − ángulo de avance (depende de TAS y RPM).</li><li>Paso fijo: solo es eficiente en una combinación de TAS y RPM.</li><li>Velocidad constante: el governor cambia el ángulo de pala para mantener las RPM; paso fino a baja velocidad, paso grueso a alta.</li></ul>"});
Object.assign(HTML,{gyro:`<figure><div class="v3" data-i="v3"><div class="ld" data-i="ld">Cargando el modelo 3D…</div><div class="msg" data-i="msg"></div></div>
<div class="ctl"><label>Rotor <input data-i="rpm" type="range" min="0" max="24000" step="500" value="15000"><output data-i="rpmO"></output></label><label>Girar el soporte <input data-i="yaw" type="range" min="-180" max="180" step="1" value="0"></label><label>Inclinar el soporte <input data-i="tilt" type="range" min="-35" max="35" step="1" value="0"></label></div>
<div class="ctl" style="border-top:1px solid #22344a"><button data-i="push" type="button" aria-pressed="false">Aplicar fuerza arriba</button><button data-i="dir" type="button">Invertir el giro del rotor</button><button data-i="rst" type="button">Recolocar</button></div>
<div class="read"><div data-i="gRb">Rigidez<b data-i="gR"></b></div><div>Precesión<b data-i="gP"></b></div><div>Eje desviado de su dirección inicial<b data-i="gD"></b></div></div></figure>`,
pitot:`<figure><canvas data-i="cv" height="470" role="img" aria-label="Esquema del sistema pitot-estática con anemómetro, altímetro y variómetro"></canvas>
<div class="ctl"><button data-i="bP" type="button" aria-pressed="false">Bloquear pitot</button><button data-i="bD" type="button" aria-pressed="false">Bloquear drenaje</button><button data-i="bS" type="button" aria-pressed="false">Bloquear estática</button><button data-i="rst" type="button">Reiniciar</button></div>
<div class="ctl" style="border-top:1px solid #22344a"><button data-i="vU" type="button" aria-pressed="false">▲ Ascenso</button><button data-i="vL" type="button" aria-pressed="true">Nivelado</button><button data-i="vD" type="button" aria-pressed="false">▼ Descenso</button><label>IAS real <input data-i="ias" type="range" min="60" max="160" step="1" value="110"><output data-i="iasO"></output></label></div>
<div class="dx" data-i="dx"></div>
<div class="read"><div data-i="pAb">Anemómetro indica<b data-i="pA"></b></div><div data-i="pHb">Altímetro indica<b data-i="pH"></b></div><div data-i="pVb">Variómetro indica<b data-i="pV"></b></div><div>Altitud real<b data-i="pR"></b></div></div></figure>`,
prop:`<figure><canvas data-i="cv" height="480" role="img" aria-label="Sección de pala de una hélice de paso fijo y de otra de velocidad constante con sus vectores de velocidad"></canvas>
<div class="ctl"><label>TAS <input data-i="tas" type="range" min="0" max="180" step="1" value="112"><output data-i="tasO"></output></label><label>RPM <input data-i="rpm" type="range" min="1800" max="2700" step="50" value="2400"><output data-i="rpmO"></output></label><button data-i="bTO" type="button">Despegue</button><button data-i="bCR" type="button">Crucero</button><button data-i="bDV" type="button">Descenso rápido</button></div>
<div class="read"><div>Ángulo de avance<b data-i="hP"></b></div><div data-i="hFb">Paso fijo · ángulo de ataque<b data-i="hF"></b></div><div data-i="hCb">Vel. constante · ángulo de ataque<b data-i="hC"></b></div><div>Rendimiento fijo / constante<b data-i="hE"></b></div></div></figure>`});
Object.assign(LAB,{
 gyro(root,E){
  const box=E.v3, T=window.THREE, W0=()=>box.clientWidth, H0=()=>box.clientHeight;
  const rnd=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"}); rnd.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1)); box.insertBefore(rnd.domElement,box.firstChild); E.ld.remove(); if(E._L){ E._L.rnd=rnd; rnd.domElement.addEventListener("webglcontextlost",ev=>{ ev.preventDefault(); fail(E._L,new Error("contexto WebGL perdido")); }); }
  const scene=new T.Scene(), cam=new T.PerspectiveCamera(38,1,.1,200);
  scene.add(new T.HemisphereLight(0xdfeeff,0x26323f,1.0)); const sun=new T.DirectionalLight(0xfff2dd,1.25); sun.position.set(6,10,7); scene.add(sun); const fill=new T.DirectionalLight(0x9cc4ff,.45); fill.position.set(-7,3,-6); scene.add(fill);
  const M=(c,o)=>new T.MeshStandardMaterial(Object.assign({color:c,roughness:.4,metalness:.35},o||{})), gold=M(0xd9a441,{metalness:.75,roughness:.28}), steel=M(0xc9d2dc,{metalness:.7,roughness:.3}), blue=M(0x2f6fc4), dark=M(0x3a4656,{roughness:.5}), mark=M(0x5a3d0a,{metalness:.2});
  const base=new T.Group(), outer=new T.Group(), inner=new T.Group(), rotor=new T.Group(); scene.add(base,outer,inner); inner.add(rotor);
  const add=(p,g,m,x,y,z)=>{ const o=new T.Mesh(g,m); o.position.set(x||0,y||0,z||0); p.add(o); return o; };
  // rotor (eje de giro = Y local del cardán interior)
  add(rotor,new T.CylinderGeometry(1.45,1.45,.3,56),gold); add(rotor,new T.CylinderGeometry(.32,.32,.5,24),steel);
  for(let i=0;i<3;i++){ const g=new T.Group(); g.rotation.y=i*2.094; rotor.add(g); add(g,new T.BoxGeometry(.7,.32,.16),mark,.85,0,0); }
  add(inner,new T.CylinderGeometry(.06,.06,3.8,12),steel); add(inner,new T.TorusGeometry(1.9,.07,12,72),steel);
  [1,-1].forEach(s=>{ add(inner,new T.CylinderGeometry(.05,.05,.42,10),dark,s*2.1,0,0).rotation.z=Math.PI/2; });
  add(outer,new T.TorusGeometry(2.3,.07,12,80),blue); [1,-1].forEach(s=>add(outer,new T.CylinderGeometry(.05,.05,.44,10),dark,0,s*2.52,0));
  add(base,new T.TorusGeometry(2.74,.09,12,90),dark); add(base,new T.CylinderGeometry(.12,.12,.4,12),dark,0,-2.95,0); add(base,new T.CylinderGeometry(1.5,1.8,.22,40),dark,0,-3.2,0);
  const nose=add(base,new T.ConeGeometry(.22,.7,16),M(0xffc94d,{emissive:0x4a3200}),2.0,-3.2,0); nose.rotation.z=-Math.PI/2;
  // dirección inicial en el espacio y flechas de fuerza
  const ref=new T.Mesh(new T.CylinderGeometry(.025,.025,9,6),new T.MeshBasicMaterial({color:0xffc94d,transparent:true,opacity:.45})); scene.add(ref);
  const aF=new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),1.5,0xff6b5a,.42,.26), aE=new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),1.5,0x6fd08c,.42,.26); scene.add(aF,aE);
  const mkTag=(col,html)=>{ const t=document.createElement("div"); t.className="tag"; t.style.color=col; t.innerHTML=html; box.appendChild(t); return t; };
  const tAx=mkTag("#ffd98a","Eje del rotor"), tF=mkTag("#ff8a7a","Fuerza aplicada"), tE=mkTag("#8df0b4","Actúa aquí<small>90° después</small>"), tB=mkTag("#cfe0f0","Soporte (avión)");
  const Y=new T.Vector3(0,1,0), Z=new T.Vector3(0,0,1), a=new T.Vector3(1,0,0), a0=new T.Vector3(1,0,0), u=new T.Vector3(), w=new T.Vector3(), p=new T.Vector3(), pe=new T.Vector3(), t1=new T.Vector3(), t2=new T.Vector3(), v=new T.Vector3();
  const Bq=new T.Quaternion(), Bp=new T.Quaternion(), q1=new T.Quaternion(), q2=new T.Quaternion(), mb=new T.Matrix4();
  const setB=(g,x,y,z)=>{ mb.makeBasis(x,y,z); g.quaternion.setFromRotationMatrix(mb); };
  let az=.95, el=.3, dist=13.5, drag=null, s=1, push=false, last=0, spin=0, moved=0;
  box.addEventListener("pointerdown",e=>{ drag=[e.clientX,e.clientY]; box.setPointerCapture(e.pointerId); box.style.cursor="grabbing"; });
  box.addEventListener("pointermove",e=>{ if(!drag) return; az-=(e.clientX-drag[0])*.008; el=clamp(el+(e.clientY-drag[1])*.006,-.4,1.3); drag=[e.clientX,e.clientY]; });
  ["pointerup","pointercancel"].forEach(ev=>box.addEventListener(ev,()=>{ drag=null; box.style.cursor="grab"; }));
  E.push.addEventListener("click",()=>{ push=!push; E.push.setAttribute("aria-pressed",push); });
  E.dir.addEventListener("click",()=>{ s=-s; });
  E.rst.addEventListener("click",()=>{ E.yaw.value=0; E.tilt.value=0; a.set(1,0,0); a0.set(1,0,0); Bp.identity(); push=false; E.push.setAttribute("aria-pressed",false); moved=0; });
  ["yaw","tilt"].forEach(k=>E[k].addEventListener("input",()=>{ moved=2.5; }));
  const place=(tag,pt,w_,h_)=>{ v.copy(pt).project(cam); tag.style.left=clamp((v.x*.5+.5)*w_,55,w_-55)+"px"; tag.style.top=clamp((-v.y*.5+.5)*h_,64,h_-16)+"px"; };
  function frame(t){
    requestAnimationFrame(frame); const dt=Math.min(.05,(t-last)/1000||0); last=t; if(!seen(box)||document.hidden) return;
    const w_=W0(), h_=H0(); if(rnd.domElement.width!==Math.round(w_*rnd.getPixelRatio())||rnd.domElement.height!==Math.round(h_*rnd.getPixelRatio())){ rnd.setSize(w_,h_,false); cam.aspect=w_/h_; cam.updateProjectionMatrix(); }
    const rpm=+E.rpm.value, rig=sst(0,5000,rpm); E.rpmO.textContent=rpm.toLocaleString("es-ES")+" rpm";
    q1.setFromAxisAngle(Y,-E.yaw.value*Math.PI/180); q2.setFromAxisAngle(Z,E.tilt.value*Math.PI/180); Bq.copy(q1).multiply(q2);
    // rigidez: sin giro, el rozamiento arrastra el eje con el soporte
    q1.copy(Bp).invert(); q2.copy(Bq).multiply(q1); t1.copy(a).applyQuaternion(q2); a.lerp(t1,1-rig).normalize(); Bp.copy(Bq);
    u.copy(Y).applyQuaternion(Bq); p.copy(u).addScaledVector(a,-a.dot(u)).normalize();
    let om=0;
    if(push){ if(rig>.02){ om=Math.min(1.5,4.5/Math.max(.5,rpm/1000)); t1.copy(p).cross(a); a.addScaledVector(t1,om*dt*s*rig); } a.addScaledVector(p,-(1-rig)*.9*dt); a.normalize(); }
    const k=a.dot(u); if(Math.abs(k)>.8){ a.addScaledVector(u,-(k-Math.sign(k)*.8)).normalize(); if(push&&rig<.5){ push=false; E.push.setAttribute("aria-pressed",false); } }
    w.copy(u).cross(a).normalize(); p.copy(u).addScaledVector(a,-a.dot(u)).normalize();
    base.quaternion.copy(Bq); t1.copy(w).cross(u); setB(outer,w,u,t1); t2.copy(w).cross(a); setB(inner,w,a,t2);
    spin+=s*(rpm?Math.min(.62,.06+rpm/24000*.56):0); rotor.rotation.y=spin;
    ref.quaternion.setFromUnitVectors(Y,a0);
    pe.copy(a).cross(p).multiplyScalar(s);
    aF.visible=tF.hidden=false; aE.visible=push&&rig>.3; tF.hidden=!push; tE.hidden=!aE.visible; aF.visible=push;
    if(push){ aF.setDirection(a); aF.position.copy(p).multiplyScalar(1.3).addScaledVector(a,-1.75); aE.setDirection(a); aE.position.copy(pe).multiplyScalar(1.3).addScaledVector(a,-1.75); }
    moved=Math.max(0,moved-dt); const dev=Math.acos(clamp(a.dot(a0),-1,1))*57.3, off=Math.abs(+E.yaw.value)>3||Math.abs(+E.tilt.value)>3;
    E.msg.innerHTML=push?(rig>.3?"Precesión<small>La fuerza empuja arriba, pero el rotor responde 90° más adelante en el sentido de giro: el eje se va de lado en vez de inclinarse.</small>":"Sin giro no hay giróscopo<small>El rotor parado se inclina justo por donde lo empujas.</small>")
      :off?(rig>.9?"Rigidez en el espacio<small>El soporte se mueve, pero el eje del rotor sigue apuntando al mismo sitio.</small>":rig>.05?"Rotor lento: poca rigidez<small>El rozamiento de los cardanes arrastra en parte el eje con el soporte.</small>":"Rotor parado: sin rigidez<small>El eje se va con el soporte, como cualquier objeto.</small>")
      :"Gira el soporte o aplica una fuerza<small>La línea amarilla marca la dirección inicial del eje en el espacio.</small>";
    E.gR.textContent=rpm===0?"Nula":rpm<5000?"Baja":rpm<12000?"Media":"Alta"; E.gRb.className=rpm<5000?"bad":rpm>=12000?"good":"";
    E.gP.textContent=push&&rig>.02?Math.round(om*rig*57.3)+" °/s":"—"; E.gD.textContent=Math.round(dev)+"°";
    cam.position.set(Math.cos(az)*Math.cos(el)*dist,Math.sin(el)*dist,Math.sin(az)*Math.cos(el)*dist); cam.lookAt(0,-.3,0); rnd.render(scene,cam);
    place(tAx,t1.copy(a).multiplyScalar(2.25),w_,h_); place(tB,t1.set(2.3,-3.75,0).applyQuaternion(Bq),w_,h_);
    if(push){ place(tF,t1.copy(p).multiplyScalar(1.3).addScaledVector(a,-2.1),w_,h_); if(aE.visible) place(tE,t1.copy(pe).multiplyScalar(1.3).addScaledVector(a,-2.2),w_,h_); }
  }
  frame(0);
 },
 pitot(root,E){
  const c=E.cv, x=c.getContext("2d"), K=20;
  const P=h=>1013.25*Math.pow(1-6.8756e-6*h,5.2559), Hof=p=>(1-Math.pow(p/1013.25,1/5.2559))/6.8756e-6, q=v=>.6125*Math.pow(v*.5144,2)/100, Vof=dp=>Math.sqrt(Math.max(0,dp)*100/.6125)/.5144;
  let alt=4000, vs=0, bp=false, bd=false, bs=false, PsL=P(alt), PtL=PsL+q(+E.ias.value), vsi=0, altP=alt, last=0, T=0;
  const tog=(b,f)=>b.addEventListener("click",()=>{ const v=f(); b.setAttribute("aria-pressed",v); });
  tog(E.bP,()=>bp=!bp); tog(E.bD,()=>bd=!bd); tog(E.bS,()=>bs=!bs);
  const setV=v=>{ vs=v; E.vU.setAttribute("aria-pressed",v>0); E.vL.setAttribute("aria-pressed",v===0); E.vD.setAttribute("aria-pressed",v<0); };
  E.vU.addEventListener("click",()=>setV(1000)); E.vL.addEventListener("click",()=>setV(0)); E.vD.addEventListener("click",()=>setV(-1000));
  E.rst.addEventListener("click",()=>{ bp=bd=bs=false; [E.bP,E.bD,E.bS].forEach(b=>b.setAttribute("aria-pressed",false)); alt=4000; setV(0); E.ias.value=110; PsL=P(alt); PtL=PsL+q(110); altP=alt; vsi=0; });
  const dial=(d,cx,cy,r,name,bad,nx,ny,sub)=>{ let g=x.createRadialGradient(cx-r*.3,cy-r*.35,r*.1,cx,cy,r*1.12); g.addColorStop(0,"#5b6878"); g.addColorStop(1,"#1a2330"); x.fillStyle=g; x.beginPath(); x.arc(cx,cy,r*1.12,0,7); x.fill();
    x.fillStyle="#0b1119"; x.beginPath(); x.arc(cx,cy,r,0,7); x.fill(); x.strokeStyle=bad?"#ff6b5a":"#3c4a5c"; x.lineWidth=(bad?3:1.5)*d; x.beginPath(); x.arc(cx,cy,r*1.06,0,7); x.stroke();
    x.fillStyle="#9fb3c8"; x.font=`700 ${Math.max(9*d,r*.15)}px "Barlow Condensed","Arial Narrow",sans-serif`; x.textAlign="center"; x.fillText(name,cx+r*nx,cy+r*ny); if(sub){ x.font=`500 ${Math.max(7.5*d,r*.1)}px system-ui,sans-serif`; x.fillText(sub,cx+r*nx,cy+r*ny+r*.13); } };
  const tick=(cx,cy,r,an,len,wd)=>{ x.lineWidth=wd; x.beginPath(); x.moveTo(cx+Math.cos(an)*r*(.94-len),cy+Math.sin(an)*r*(.94-len)); x.lineTo(cx+Math.cos(an)*r*.94,cy+Math.sin(an)*r*.94); x.stroke(); };
  const num=(cx,cy,r,an,tx)=>{ x.fillText(tx,cx+Math.cos(an)*r*.64,cy+Math.sin(an)*r*.64+r*.06); };
  const needle=(d,cx,cy,r,an,len,col,wd)=>{ x.strokeStyle=col; x.lineWidth=wd*d; x.lineCap="round"; x.beginPath(); x.moveTo(cx-Math.cos(an)*r*.14,cy-Math.sin(an)*r*.14); x.lineTo(cx+Math.cos(an)*r*len,cy+Math.sin(an)*r*len); x.stroke(); x.lineCap="butt"; };
  const hub=(d,cx,cy,r)=>{ x.fillStyle="#cfd8e2"; x.beginPath(); x.arc(cx,cy,r*.07,0,7); x.fill(); };
  const ice=(d,px,py,r)=>{ x.fillStyle="#eaf4ff"; x.beginPath(); for(let i=0;i<9;i++){ const an=i/9*6.283, rr=r*(.8+.35*((i*37)%5)/5); x.lineTo(px+Math.cos(an)*rr,py+Math.sin(an)*rr); } x.closePath(); x.fill(); x.strokeStyle="#ff6b5a"; x.lineWidth=2.5*d; x.beginPath(); x.moveTo(px-r*.5,py-r*.5); x.lineTo(px+r*.5,py+r*.5); x.moveTo(px+r*.5,py-r*.5); x.lineTo(px-r*.5,py+r*.5); x.stroke(); };
  const loop=t=>{ requestAnimationFrame(loop); const dt=Math.min(.05,(t-last)/1000||0); last=t; if(!seen(c)||document.hidden) return; T+=dt;
    const d=fit(c), W=c.width, H=c.height, ias=+E.ias.value; E.iasO.textContent=ias+" kt";
    alt+=vs/60*dt*K; if(alt>=12000){ alt=12000; setV(0); } if(alt<=0){ alt=0; setV(0); }
    const Ps=P(alt), Pt=Ps+q(ias), f=Math.min(1,dt*6);
    if(!bs) PsL+=(Ps-PsL)*f; if(!bp) PtL+=(Pt-PtL)*f; else if(!bd) PtL+=(Ps-PtL)*Math.min(1,dt*.9);
    const iasI=Vof(PtL-PsL), altI=Hof(PsL); if(dt>0){ const vt=(altI-altP)/dt*60/K; vsi+=(vt-vsi)*Math.min(1,dt*3); } altP=altI;
    bgFill(x,W,H);
    const sm=W<560*d, r=Math.min(W*.142,H*.2), cy=H*.71, CX=[W*.18,W*.5,W*.82], yP=H*.1, yS=H*.31, xT=W*.045, xTe=CX[0]-r*.15, COLP="#ff8a7a", COLS="#6fb4ff", GR="#7d8a99";
    // aire de impacto
    x.strokeStyle="rgba(190,220,255,.35)"; x.lineWidth=1.5*d; for(let i=0;i<5;i++){ const ph=((T*(.5+ias/200)+i*.2)%1), yy=yP-16*d+i*8*d; x.beginPath(); x.moveTo(xT-W*.06+ph*W*.05,yy); x.lineTo(xT-W*.06+ph*W*.05+12*d,yy); x.stroke(); }
    // tuberías
    const pipe=(pts,col,trap)=>{ x.strokeStyle="#0a121c"; x.lineWidth=9*d; x.lineJoin="round"; x.beginPath(); pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1])); x.stroke(); x.strokeStyle=trap?GR:col; x.lineWidth=4.5*d; if(trap) x.setLineDash([7*d,5*d]); x.stroke(); x.setLineDash([]); };
    const xa=xTe, xb=CX[0]+r*.5;
    pipe([[xa,yP],[xa,cy-r]],COLP,bp);
    const xS=W*.4; pipe([[xS,yS],[CX[2],yS],[CX[2],cy-r]],COLS,bs); pipe([[xb,yS],[xS,yS]],COLS,bs); pipe([[xb,yS],[xb,cy-r]],COLS,bs); pipe([[CX[1],yS],[CX[1],cy-r]],COLS,bs);
    // tubo pitot con drenaje
    x.fillStyle="#b9c3cf"; x.beginPath(); x.moveTo(xT,yP-7*d); x.lineTo(xTe,yP-7*d); x.lineTo(xTe,yP+7*d); x.lineTo(xT,yP+7*d); x.lineTo(xT-10*d,yP+3*d); x.lineTo(xT-10*d,yP-3*d); x.closePath(); x.fill();
    x.fillStyle="#0b1119"; x.fillRect(xT-10*d,yP-2*d,xTe-xT+6*d,4*d); const xD=xT+(xTe-xT)*.55; x.fillRect(xD-2*d,yP,4*d,9*d);
    if(bp&&!bd&&PtL-Ps>.3){ x.fillStyle="rgba(255,138,122,.8)"; for(let i=0;i<3;i++){ const ph=(T*1.4+i/3)%1; x.beginPath(); x.arc(xD,yP+10*d+ph*16*d,2*d*(1-ph),0,7); x.fill(); } }
    if(bp) ice(d,xT-9*d,yP,10*d); if(bd) ice(d,xD,yP+9*d,7*d);
    // toma estática
    x.fillStyle="#b9c3cf"; x.beginPath(); x.arc(xS,yS,13*d,0,7); x.fill(); x.fillStyle="#0b1119"; x.beginPath(); x.arc(xS,yS,3.5*d,0,7); x.fill(); if(bs) ice(d,xS,yS,10*d);
    // rótulos
    x.textAlign="left"; x.font=`700 ${(sm?10:12)*d}px system-ui,sans-serif`; x.fillStyle=COLP; x.fillText(sm?"PITOT":"TUBO PITOT · presión total",xT-8*d,yP-14*d); x.fillStyle="#cfe0f0"; x.font=`600 ${(sm?9.5:11)*d}px system-ui,sans-serif`; x.textAlign=sm?"right":"left"; x.fillText("drenaje",xD+(sm?-7:8)*d,yP+22*d);
    x.fillStyle=COLS; x.font=`700 ${(sm?10:12)*d}px system-ui,sans-serif`; x.textAlign="center"; x.fillText(sm?"ESTÁTICA":"TOMA ESTÁTICA",xS,yS-19*d);
    x.font=`600 ${(sm?10:11.5)*d}px ui-monospace,Menlo,Consolas,monospace`; x.textAlign="left"; x.fillStyle=bp&&bd?"#cfd6de":COLP; x.fillText((bp&&bd?"atrapada · ":"")+PtL.toFixed(0)+" hPa",xTe+12*d,yP+4*d); x.textAlign="right";
    x.fillStyle=bs?"#cfd6de":COLS; x.fillText((bs?"atrapada · ":"")+PsL.toFixed(0)+" hPa",W-10*d,yS-9*d);
    // anemómetro
    const eA=Math.abs(iasI-ias)>4, eH=Math.abs(altI-alt)>60, eV=Math.abs(vsi-vs)>150;
    let cx=CX[0]; dial(d,cx,cy,r,"IAS · kt",eA,0,-.3); x.strokeStyle="#e9eef4"; x.fillStyle="#e9eef4"; x.font=`600 ${r*.17}px system-ui,sans-serif`; x.textAlign="center";
    const aA=v=>-Math.PI/2+clamp(v,0,200)/200*5.24; for(let v=0;v<=200;v+=10){ tick(cx,cy,r,aA(v),v%20?.07:.13,(v%20?1:2)*d); if(v%40===0&&v) num(cx,cy,r,aA(v),v); }
    needle(d,cx,cy,r,aA(ias),.8,"rgba(141,240,180,.75)",1.5); needle(d,cx,cy,r,aA(iasI),.82,"#fff",3); hub(d,cx,cy,r);
    // altímetro
    cx=CX[1]; dial(d,cx,cy,r,"ALT · ft",eH,0,-.3); x.strokeStyle="#e9eef4"; x.fillStyle="#e9eef4"; x.font=`600 ${r*.19}px system-ui,sans-serif`;
    for(let i=0;i<50;i++){ const an=-Math.PI/2+i/50*6.2832; tick(cx,cy,r,an,i%5?.06:.13,(i%5?1:2)*d); if(i%5===0) num(cx,cy,r,an,i/5); }
    x.fillStyle="#0e1620"; x.fillRect(cx-r*.34,cy+r*.12,r*.68,r*.24); x.fillStyle="#fff"; x.font=`700 ${r*.19}px ui-monospace,Menlo,Consolas,monospace`; x.fillText(String(Math.round(altI/10)*10),cx,cy+r*.3);
    needle(d,cx,cy,r,-Math.PI/2+(alt%1000)/1000*6.2832,.8,"rgba(141,240,180,.75)",1.5); needle(d,cx,cy,r,-Math.PI/2+altI/10000*6.2832,.5,"#fff",5); needle(d,cx,cy,r,-Math.PI/2+(altI%1000)/1000*6.2832,.84,"#fff",2.5); hub(d,cx,cy,r);
    // variómetro
    cx=CX[2]; dial(d,cx,cy,r,"VSI",eV,.36,-.02,sm?"":"ft/min ×1000"); x.strokeStyle="#e9eef4"; x.fillStyle="#e9eef4"; x.font=`600 ${r*.18}px system-ui,sans-serif`;
    const aV=v=>Math.PI+clamp(v,-2000,2000)/2000*2.62; for(let v=-2000;v<=2000;v+=250){ tick(cx,cy,r,aV(v),v%500?.07:.13,(v%500?1:2)*d); if(v%1000===0) num(cx,cy,r,aV(v),Math.abs(v/1000)); }
    x.font=`600 ${r*.13}px system-ui,sans-serif`; x.fillStyle="#9fb3c8"; x.fillText("UP",cx-r*.28,cy-r*.2); x.fillText("DN",cx-r*.28,cy+r*.3);
    needle(d,cx,cy,r,aV(vs),.8,"rgba(141,240,180,.75)",1.5); needle(d,cx,cy,r,aV(vsi),.82,"#fff",3); hub(d,cx,cy,r);
    // estado bajo cada instrumento
    const st=(cx,ok,tx)=>{ x.font=`700 ${(sm?9.5:12)*d}px system-ui,sans-serif`; x.textAlign="center"; x.fillStyle=ok?"#8df0b4":"#ff8a7a"; x.fillText(tx,cx,cy+r*1.12+20*d); };
    st(CX[0],!eA,eA?(iasI<ias?"MARCA DE MENOS":"MARCA DE MÁS"):"CORRECTO"); st(CX[1],!eH,eH?"CONGELADO":"CORRECTO"); st(CX[2],!eV,eV?"SE QUEDA EN CERO":"CORRECTO");
    // lecturas y diagnóstico
    E.pA.textContent=Math.round(iasI)+" kt"; E.pAb.className=eA?"bad":"good"; E.pH.textContent=(Math.round(altI/10)*10).toLocaleString("es-ES")+" ft"; E.pHb.className=eH?"bad":"good"; E.pV.textContent=(Math.round(vsi/50)*50)+" ft/min"; E.pVb.className=eV?"bad":"good"; E.pR.textContent=(Math.round(alt/10)*10).toLocaleString("es-ES")+" ft";
    const m=[]; if(bs) m.push("<b>Estática bloqueada:</b> el altímetro se congela y el variómetro se queda en cero. El anemómetro marca de menos al subir y de más al bajar.");
    if(bp&&!bd) m.push("<b>Pitot bloqueado con el drenaje libre:</b> la presión total se escapa por el drenaje y el anemómetro cae a cero.");
    if(bp&&bd) m.push("<b>Pitot y drenaje bloqueados:</b> la presión total queda atrapada y el anemómetro se comporta como un altímetro: sube al ascender y baja al descender.");
    if(!bp&&bd) m.push("<b>Solo el drenaje bloqueado:</b> el anemómetro marca bien, pero el agua no puede salir del tubo.");
    if(!m.length) m.push("Todo libre: los tres instrumentos marcan bien. Bloquea una toma y cambia de altitud para ver el error."); else if(vs===0&&(bs||(bp&&bd))) m.push("Pulsa Ascenso o Descenso para ver cómo crece el error.");
    const h=m.join(" "); if(E.dx._h!==h){ E.dx._h=h; E.dx.innerHTML=h; }
  };
  loop(0);
 },
 prop(root,E){
  const c=E.cv, x=c.getContext("2d"), R75=.71, BF=22, AOPT=4, RD=Math.PI/180;
  const sec=(tas,rpm,beta)=>{ const vr=rpm*2*Math.PI/60*R75, vf=tas*.5144, phi=Math.atan2(vf,vr)/RD, a=beta-phi, cl=a<=14?.1*(a+2):Math.max(.3,1.6-(a-14)*.12), cd=.012+.045*cl*cl+(a>14?(a-14)*.03:0); let eta=0; if(cl>0&&vf>0){ const g=Math.atan2(cd,cl); eta=Math.tan(phi*RD)/Math.tan(phi*RD+g); } return {phi,a,cl,eta:clamp(eta,0,1),vr,vf}; };
  const csB=(tas,rpm)=>clamp(sec(tas,rpm,0).phi+AOPT,12,48);
  let bc=csB(+E.tas.value,+E.rpm.value), last=0, tgt=null;
  const pre=(t,r)=>{ tgt=[t,r]; }; E.bTO.addEventListener("click",()=>pre(45,2700)); E.bCR.addEventListener("click",()=>pre(112,2400)); E.bDV.addEventListener("click",()=>pre(165,2400));
  ["tas","rpm"].forEach(k=>E[k].addEventListener("input",()=>{ tgt=null; }));
  const verdict=S=>S.cl<=0?["La pala frena el avión","#ff8a7a"]:S.a>14?["Pala en pérdida","#ff8a7a"]:Math.abs(S.a-AOPT)<=2.5?["Ángulo de ataque óptimo","#8df0b4"]:S.a>AOPT?["Demasiado ángulo de ataque","#ffc94d"]:["Poco ángulo de ataque","#ffc94d"];
  const panel=(d,px,py,pw,ph,title,sub,beta,S,col)=>{
    const sm=pw<300*d, Lc=Math.min(pw*.46,150*d), ox=px+pw*.6, oy=py+ph*.66, b=beta*RD, f=S.phi*RD;
    x.fillStyle="rgba(255,255,255,.035)"; x.fillRect(px+4*d,py+4*d,pw-8*d,ph-8*d);
    x.textAlign="left"; x.fillStyle=col; x.font=`800 ${(sm?15:19)*d}px "Barlow Condensed","Arial Narrow",sans-serif`; x.fillText(title,px+12*d,py+24*d); x.fillStyle="#9fb3c8"; x.font=`600 ${(sm?10:12)*d}px system-ui,sans-serif`; x.fillText(sub,px+12*d,py+40*d);
    const V=verdict(S); x.fillStyle=V[1]; x.font=`700 ${(sm?11:13)*d}px system-ui,sans-serif`; x.fillText(sm?V[0]:V[0]+" · α "+S.a.toFixed(0)+"°",px+12*d,py+(sm?56:59)*d);
    // plano de rotación
    x.strokeStyle="rgba(207,224,240,.4)"; x.lineWidth=1*d; x.setLineDash([5*d,5*d]); x.beginPath(); x.moveTo(px+10*d,oy); x.lineTo(px+pw-10*d,oy); x.stroke(); x.setLineDash([]);
    x.fillStyle="rgba(207,224,240,.6)"; x.font=`500 ${(sm?9:10.5)*d}px system-ui,sans-serif`; x.textAlign="right"; x.fillText("plano de rotación",px+pw-12*d,oy+13*d);
    // perfil de la pala
    x.save(); x.translate(ox,oy); x.rotate(b); const g=x.createLinearGradient(0,-Lc*.14,0,Lc*.06); g.addColorStop(0,"#f1f4f8"); g.addColorStop(1,"#8794a5"); x.fillStyle=g; x.beginPath(); x.moveTo(-Lc/2,0); x.bezierCurveTo(-Lc*.5,-Lc*.13,-Lc*.1,-Lc*.17,Lc/2,0); x.bezierCurveTo(Lc*.1,Lc*.035,-Lc*.45,Lc*.05,-Lc/2,0); x.fill();
    x.strokeStyle=col; x.lineWidth=1.3*d; x.setLineDash([4*d,4*d]); x.beginPath(); x.moveTo(-Lc*.95,0); x.lineTo(Lc*.5,0); x.stroke(); x.setLineDash([]); x.restore();
    // ángulo de pala
    x.strokeStyle=col; x.lineWidth=2*d; x.beginPath(); x.arc(ox,oy,Lc*.7,Math.PI,Math.PI+b); x.stroke(); x.fillStyle=col; x.font=`700 ${(sm?10.5:12.5)*d}px system-ui,sans-serif`; x.textAlign="right"; x.fillText("pala "+beta.toFixed(0)+"°",Math.max(px+56*d,ox-Lc*.72-4*d),oy+16*d);
    // triángulo de velocidades, con la punta en el borde de ataque
    const lx=ox-Math.cos(b)*Lc/2, ly=oy-Math.sin(b)*Lc/2, sc=pw*.34/200, n=Math.hypot(S.vr,S.vf)*sc, sx=lx-Math.cos(f)*n, sy=ly-Math.sin(f)*n;
    arrow(x,d,sx,sy,S.vr*sc,0,"#6fb4ff",""); x.fillStyle="#6fb4ff"; x.font=`700 ${(sm?10:12)*d}px system-ui,sans-serif`; x.textAlign="center"; x.fillText(sm?"RPM":"giro (RPM)",sx+S.vr*sc*.5,sy-8*d); arrow(x,d,sx+S.vr*sc,sy,0,S.vf*sc-9*d,"#8df0b4",""); arrow(x,d,sx,sy,(lx-sx)-Math.cos(f)*9*d,(ly-sy)-Math.sin(f)*9*d,"#ffffff","");
    if(S.vf*sc>20*d){ x.fillStyle="#8df0b4"; x.font=`700 ${(sm?10:12)*d}px system-ui,sans-serif`; x.textAlign="left"; x.fillText(sm?"TAS":"avance (TAS)",sx+S.vr*sc+6*d,sy+S.vf*sc*.5); }
    // ángulo de ataque
    const ac=S.cl<=0||S.a>14?"#ff8a7a":Math.abs(S.a-AOPT)<=2.5?"#8df0b4":"#ffc94d", ra=Math.min(n*.55,58*d); x.strokeStyle=ac; x.lineWidth=3*d; x.beginPath(); x.arc(lx,ly,ra,Math.PI+Math.min(f,b),Math.PI+Math.max(f,b)); x.stroke();
    
    // tracción
    const th=clamp(S.cl*(S.vr*S.vr+S.vf*S.vf)/42000,-1,1.25)*ph*.2; if(Math.abs(th)>6*d) arrow(x,d,ox+(sm?-Lc*.12:Lc*.12),oy-(th>0?Lc*.1:-Lc*.06),0,-th,th>0?"#ffc94d":"#ff8a7a",th>0?"tracción":"frena");
  };
  const loop=t=>{ requestAnimationFrame(loop); const dt=Math.min(.05,(t-last)/1000||0); last=t; if(!seen(c)||document.hidden) return;
    if(tgt){ const a=+E.tas.value, b=+E.rpm.value, na=a+clamp(tgt[0]-a,-90*dt,90*dt), nb=b+clamp(tgt[1]-b,-700*dt,700*dt); E.tas.value=Math.abs(tgt[0]-na)<1?tgt[0]:na; E.rpm.value=Math.abs(tgt[1]-nb)<50?tgt[1]:nb; if(+E.tas.value===tgt[0]&&+E.rpm.value===tgt[1]) tgt=null; }
    const d=fit(c), W=c.width, H=c.height, tas=+E.tas.value, rpm=+E.rpm.value; E.tasO.textContent=Math.round(tas)+" kt"; E.rpmO.textContent=rpm+" rpm";
    const bt=csB(tas,rpm); bc+=clamp(bt-bc,-40*dt,40*dt); const SF=sec(tas,rpm,BF), SC=sec(tas,rpm,bc);
    bgFill(x,W,H); const ph=H*.63, sm=W<560*d;
    panel(d,0,0,W/2,ph,"PASO FIJO","La pala no se mueve",BF,SF,"#ffc94d"); panel(d,W/2,0,W/2,ph,sm?"VEL. CONSTANTE":"VELOCIDAD CONSTANTE",bt<=12.01?"Tope de paso fino":bt>=47.99?"Tope de paso grueso":bc<BF?"Paso fino (fine)":"Paso grueso (coarse)",bc,SC,"#8df0b4");
    x.strokeStyle="#22344a"; x.lineWidth=1*d; x.beginPath(); x.moveTo(W/2,8*d); x.lineTo(W/2,ph-4*d); x.stroke();
    // gráfica de rendimiento
    const gx=46*d, gy=ph+22*d, gw=W-gx-16*d, gh=H-gy-30*d, X=v=>gx+v/180*gw, Yv=e=>gy+gh-e*gh;
    x.fillStyle="rgba(255,255,255,.03)"; x.fillRect(gx,gy,gw,gh); x.strokeStyle="rgba(207,224,240,.18)"; x.fillStyle="#9fb3c8"; x.font=`500 ${10.5*d}px system-ui,sans-serif`;
    x.textAlign="right"; [0,.5,1].forEach(e=>{ x.beginPath(); x.moveTo(gx,Yv(e)); x.lineTo(gx+gw,Yv(e)); x.stroke(); x.fillText(e*100+" %",gx-6*d,Yv(e)+4*d); });
    x.textAlign="center"; for(let v=0;v<=180;v+=30){ x.beginPath(); x.moveTo(X(v),gy); x.lineTo(X(v),gy+gh); x.stroke(); x.fillText(v+(v===180?" kt":""),X(v),gy+gh+14*d); }
    x.textAlign="left"; x.fillStyle="#cfe0f0"; x.font=`700 ${11*d}px system-ui,sans-serif`; x.fillText("Rendimiento de la hélice según la TAS, a "+rpm+" rpm",gx,gy-7*d);
    const curve=(fn,col)=>{ x.strokeStyle=col; x.lineWidth=2.5*d; x.beginPath(); for(let v=0;v<=180;v+=2){ const e=fn(v); v?x.lineTo(X(v),Yv(e)):x.moveTo(X(v),Yv(e)); } x.stroke(); };
    curve(v=>sec(v,rpm,BF).eta,"#ffc94d"); curve(v=>sec(v,rpm,csB(v,rpm)).eta,"#8df0b4");
    x.strokeStyle="rgba(255,255,255,.55)"; x.lineWidth=1*d; x.beginPath(); x.moveTo(X(tas),gy); x.lineTo(X(tas),gy+gh); x.stroke();
    [[SF.eta,"#ffc94d"],[SC.eta,"#8df0b4"]].forEach(p=>{ x.fillStyle=p[1]; x.beginPath(); x.arc(X(tas),Yv(p[0]),5*d,0,7); x.fill(); x.strokeStyle="#0a1727"; x.lineWidth=1.5*d; x.stroke(); });
    E.hP.textContent=SF.phi.toFixed(0)+"°"; E.hF.textContent=SF.a.toFixed(0)+"°"; E.hFb.className=SF.cl<=0||SF.a>14?"bad":Math.abs(SF.a-AOPT)<=2.5?"good":""; E.hC.textContent=SC.a.toFixed(0)+"° · pala "+bc.toFixed(0)+"°"; E.hCb.className=SC.cl<=0||SC.a>14?"bad":Math.abs(SC.a-AOPT)<=2.5?"good":"";
    E.hE.textContent=Math.round(SF.eta*100)+" % / "+Math.round(SC.eta*100)+" %";
  };
  loop(0);
 }
});
/*F2END*/
function fail(L,e){ if(!L||L.dead) return; L.dead=true; try{ console.error("F0Lab",L.k,e); }catch(_){} try{ if(L.rnd){ L.rnd.dispose(); L.rnd.forceContextLoss&&L.rnd.forceContextLoss(); } }catch(_){}
  L.el.innerHTML='<p class="lt">'+TTL[L.k]+'</p><div class="fb">'+(FB[L.k]||"")+'<p class="fbn">La lámina interactiva no se ha podido mostrar en este dispositivo. <button type="button">Reintentar</button></p></div>';
  const b=L.el.querySelector("button"); if(b) b.addEventListener("click",()=>{ L.el._lab=0; build(L.el); }); }
let three=null; const needThree=()=>three||(three=new Promise((ok,ko)=>{ if(window.THREE) return ok(); const s=document.createElement("script"), to=setTimeout(()=>{ three=null; ko(new Error("tiempo agotado")); },12000); s.src=(window.F0LABS_BASE||"../")+"three.min.js"; s.onload=()=>{ clearTimeout(to); window.THREE?ok():ko(new Error("sin THREE")); }; s.onerror=()=>{ clearTimeout(to); three=null; ko(new Error("no carga")); }; document.head.appendChild(s); }));
function build(el){
  if(el._lab) return; const k=el.dataset.lab; el._lab=1; const L={k,el,dead:false};
  el.innerHTML='<p class="lt">'+TTL[k]+'</p>'+HTML[k]+'<p class="cap">'+CAP[k]+'</p>';
  const E={}; el.querySelectorAll("[data-i]").forEach(n=>{ E[n.dataset.i]=n; }); E._L=L;
  const go=()=>{ if(L.dead) return; CUR=L; try{ LAB[k](el,E); }catch(e){ fail(L,e); } CUR=null; };
  if(k==="axes"||k==="gyro"){ const c=document.createElement("canvas"); let gl=null; try{ gl=c.getContext("webgl2")||c.getContext("webgl"); }catch(e){} if(!gl){ fail(L,new Error("sin WebGL")); return; }
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
