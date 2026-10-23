/* ATPL Fase 0 · RADIO (push-to-talk) — solo en la web con cuenta.
   Voz por Supabase Realtime (broadcast): μ-law 8 kHz, trozos de 160 ms, un solo emisor por frecuencia, filtro de radio y «roger beep».
   API: F0Radio.render(el, {sb, user, name}) · F0Radio.leave() · F0Radio.state() */
(function(){
"use strict";
const FREQS=[
  {id:"118100", f:"118.100", k:"TWR", n:"Torre · Tower"},
  {id:"121700", f:"121.700", k:"GND", n:"Tierra · Ground"},
  {id:"119700", f:"119.700", k:"APP", n:"Aproximación · Approach"},
  {id:"132000", f:"132.000", k:"CTR", n:"Control · Centre"},
  {id:"121500", f:"121.500", k:"EMG", n:"Emergencia · Guard"}
];
const ROLES={atc:"ATC", pil:"Piloto", ear:"Solo escucho"};
const ICON={atc:'<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 33h24M14 33V22l6-9 6 9v11"/><path d="M20 13V6M15 9c1.5-2 3-3 5-3s3.500 1 5 3"/><circle cx="20" cy="26" r="2"/></svg>',pil:'<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><g transform="rotate(-45 20 20) translate(2 2) scale(1.8)"><path d="M10 1c.9 0 1.4.9 1.4 2v4.6l7 4.2v1.8l-7-2v3.6l1.8 1.4V19L10 18l-3.2 1v-2.4l1.8-1.4v-3.6l-7 2v-1.8l7-4.2V3C8.6 1.9 9.1 1 10 1z"/></g></svg>',ear:'<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 24v-4a13 13 0 0 1 26 0v4"/><rect x="5" y="23" width="7" height="11" rx="3" fill="currentColor"/><rect x="28" y="23" width="7" height="11" rx="3" fill="currentColor"/></svg>'};
const ROLE_SUB={atc:"profesor · torre",pil:"alumno · avión",ear:"solo oyes"};
const CHUNK=1280;                 // bytes por trozo = 160 ms a 8 kHz
const LS=k=>"f0:radio:"+k;
const get=(k,d)=>{ try{ return localStorage.getItem(LS(k))||d; }catch(e){ return d; } };
const set=(k,v)=>{ try{ localStorage.setItem(LS(k),v); }catch(e){} };
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- μ-law (G.711) ---------- */
function mu(s){ s=Math.max(-1,Math.min(1,s)); const sign=s<0?0x80:0; let x=Math.min(Math.abs(s)*32767,32635)+132, e=7;
  for(let m=0x4000;(x&m)===0&&e>0;e--,m>>=1){} return (~(sign|(e<<4)|((x>>(e+3))&0x0F)))&0xFF; }
function unmu(b){ b=(~b)&0xFF; const sign=b&0x80, e=(b>>4)&7, m=b&0x0F; const x=(((m<<3)+132)<<e)-132; return (sign?-x:x)/32768; }
function b64(u8){ let s=""; for(let i=0;i<u8.length;i+=0x4000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x4000)); return btoa(s); }
function unb64(t){ const s=atob(t), u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u; }

const R={
  sby:get("sby","121500"), deps:null, ch:null, freq:get("freq","118100"), role:get("role","pil"), call:get("call",""), vol:+get("vol","0.9"), caps:get("caps","0")==="1", latch:get("latch","0")==="1",
  status:"off", msg:"", priv:false, uid:"", ac:null, rxIn:null, noise:null, noiseG:null, stream:null, proc:null, src:null,
  tx:false, wantTx:false, txT0:0, txBuf:[], txSeq:0, txStart:0, rx:null, rxT:0, nextT:0, peers:{}, log:[], el:null, tick:null, rec:null,
  stats:{rxChunks:0, rxSamples:0, rxPeak:0, txChunks:0}
};

/* ---------- audio ---------- */
function ensureAudio(){
  if(!R.ac){
    const AC=window.AudioContext||window.webkitAudioContext; R.ac=new AC();
    const ac=R.ac, hp=ac.createBiquadFilter(), lp=ac.createBiquadFilter(), sh=ac.createWaveShaper(), cp=ac.createDynamicsCompressor(), vg=ac.createGain();
    hp.type="highpass"; hp.frequency.value=380; lp.type="lowpass"; lp.frequency.value=3200;
    const k=new Float32Array(256); for(let i=0;i<256;i++){ const x=i/128-1; k[i]=Math.tanh(2.2*x)*0.9; } sh.curve=k;
    cp.threshold.value=-26; cp.ratio.value=8;
    R.rxIn=ac.createGain(); R.rxIn.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(cp); cp.connect(vg); vg.connect(ac.destination); R.vg=vg;
    const nb=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate), d=nb.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    R.noise=ac.createBufferSource(); R.noise.buffer=nb; R.noise.loop=true; R.noiseG=ac.createGain(); R.noiseG.gain.value=0;
    const nf=ac.createBiquadFilter(); nf.type="bandpass"; nf.frequency.value=1800; nf.Q.value=0.6; R.noise.connect(nf); nf.connect(R.noiseG); R.noiseG.connect(R.rxIn); R.noise.start();
  }
  R.vg.gain.value=R.vol; if(R.ac.state==="suspended") R.ac.resume();
  return R.ac;
}
function blip(freq,dur,gain,delay){   // pitidos fuera del filtro de radio
  try{ const ac=ensureAudio(), o=ac.createOscillator(), g=ac.createGain(), t=ac.currentTime+(delay||0);
    o.frequency.value=freq; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.008); g.gain.setValueAtTime(gain,t+dur-0.012); g.gain.linearRampToValueAtTime(0,t+dur);
    o.connect(g); g.connect(R.vg); o.start(t); o.stop(t+dur+0.02); }catch(e){}
}
function squelch(at){ try{ const ac=ensureAudio(), t=Math.max(at||0,ac.currentTime); R.noiseG.gain.cancelScheduledValues(t); R.noiseG.gain.setValueAtTime(0.55,t); R.noiseG.gain.exponentialRampToValueAtTime(0.0008,t+0.11); }catch(e){} }
function playChunk(bytes){
  const ac=ensureAudio(), n=bytes.length, buf=ac.createBuffer(1,n,8000), d=buf.getChannelData(0); let pk=0;
  for(let i=0;i<n;i++){ const v=unmu(bytes[i]); d[i]=v; const a=Math.abs(v); if(a>pk) pk=a; }
  R.stats.rxChunks++; R.stats.rxSamples+=n; if(pk>R.stats.rxPeak) R.stats.rxPeak=pk;
  const s=ac.createBufferSource(); s.buffer=buf; s.connect(R.rxIn);
  const now=ac.currentTime; if(R.nextT<now+0.02){ R.nextT=now+0.2; squelch(now); }
  s.start(R.nextT); R.nextT+=n/8000;
}

/* ---------- micrófono ---------- */
async function ensureMic(){
  if(R.stream) return true;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ R.msg="Este navegador no deja usar el micrófono (hace falta HTTPS)."; update(); return false; }
  try{
    R.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  }catch(e){ R.msg="No hay permiso para el micrófono. Actívalo en el candado de la barra de direcciones."; update(); return false; }
  const ac=ensureAudio(), src=ac.createMediaStreamSource(R.stream), lp=ac.createBiquadFilter(), pr=ac.createScriptProcessor(2048,1,1), mute=ac.createGain();
  lp.type="lowpass"; lp.frequency.value=3400; mute.gain.value=0; src.connect(lp); lp.connect(pr); pr.connect(mute); mute.connect(ac.destination);
  const ratio=ac.sampleRate/8000; let acc=0, cnt=0, phase=0;
  pr.onaudioprocess=e=>{
    if(!R.tx&&!R.solo) { acc=0; cnt=0; return; }
    const inp=e.inputBuffer.getChannelData(0);
    for(let i=0;i<inp.length;i++){ acc+=inp[i]; cnt++; phase+=1; if(phase>=ratio){ phase-=ratio; R.txBuf.push(mu(acc/cnt)); acc=0; cnt=0; } }
    while(R.txBuf.length>=CHUNK){ sendChunk(R.txBuf.splice(0,CHUNK)); }
  };
  R.src=src; R.proc=pr; return true;
}
function sendChunk(arr){
  const ch=R.solo?R.solo.ch:R.ch; if(!ch) return;
  R.stats.txChunks++;
  ch.send({type:"broadcast",event:"a",payload:{u:R.uid,q:R.txSeq++,d:b64(Uint8Array.from(arr))}});
}

/* ---------- canal ---------- */
function me(){ const n=(R.deps&&R.deps.name&&R.deps.name())||"Alumno"; return {n, r:R.role, c:R.call.trim()||n.split(" ")[0]}; }
function join(priv){
  const d=R.deps; if(!d||!d.sb||!d.user) return;
  leaveChannel(); R.uid=d.user.id; R.priv=!!priv; R.status="conn"; R.msg=""; update();
  let ch;
  try{ ch=d.sb.channel("radio:"+R.freq,{config:{broadcast:{self:false,ack:false},presence:{key:R.uid},private:!!priv}}); }
  catch(e){ R.status="err"; R.msg="No se ha podido abrir la radio."; update(); return; }
  R.ch=ch;
  ch.on("broadcast",{event:"a"},m=>onAudio(m.payload||m))
    .on("broadcast",{event:"s"},m=>onStart(m.payload||m))
    .on("broadcast",{event:"e"},m=>onEnd(m.payload||m))
    .on("broadcast",{event:"x"},m=>onText(m.payload||m))
    .on("presence",{event:"sync"},()=>{ syncPeers(); });
  ch.subscribe(st=>{
    if(R.ch!==ch) return;
    if(st==="SUBSCRIBED"){ R.status="on"; R.msg=""; try{ ch.track(me()); }catch(e){} update(); }
    else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"){
      if(!priv){ join(true); return; }
      R.status="err"; R.msg="La radio no está disponible ahora (Realtime). Avisa al administrador."; update();
    } else if(st==="CLOSED"&&R.status==="on"){ R.status="err"; R.msg="Conexión perdida. Pulsa Conectar."; update(); }
  });
}
function leaveChannel(){
  if(R.tx) stopTx(true);
  if(R.ch){ try{ R.deps.sb.removeChannel(R.ch); }catch(e){} R.ch=null; }
  R.peers={}; R.rx=null;
}
function leave(){
  leaveChannel(); R.status="off"; R.msg="";
  if(R.stream){ R.stream.getTracks().forEach(t=>t.stop()); R.stream=null; }
  if(R.proc){ try{ R.proc.disconnect(); R.src.disconnect(); }catch(e){} R.proc=null; R.src=null; }
  update();
}
function syncPeers(){
  try{ const st=R.ch.presenceState(), o={}; Object.keys(st).forEach(k=>{ const m=st[k]&&st[k][0]; if(m) o[k]={n:m.n,r:m.r,c:m.c}; }); R.peers=o; }catch(e){}
  update();
}

/* ---------- recepción ---------- */
function onStart(p){
  if(!p||p.u===R.uid) return;
  // colisión: gana quien empezó antes; si empatan, el uid menor
  if(R.tx && (p.t<R.txStart || (p.t===R.txStart && p.u<R.uid))) stopTx(true,true);
  R.rx={u:p.u,n:p.n,r:p.r,c:p.c,t0:Date.now(),text:""}; R.rxT=Date.now(); R.nextT=0; update();
}
function onAudio(p){
  if(!p||p.u===R.uid||!p.d) return;
  if(!R.rx||R.rx.u!==p.u){ const pe=R.peers[p.u]||{}; R.rx={u:p.u,n:pe.n||"…",r:pe.r,c:pe.c,t0:Date.now(),text:""}; R.nextT=0; }
  R.rxT=Date.now();
  try{ playChunk(unb64(p.d)); }catch(e){}
  update();
}
function onEnd(p){
  if(!p||!R.rx||R.rx.u!==p.u) return;
  finishRx(true);
}
function onText(p){ if(p&&R.rx&&R.rx.u===p.u&&p.t){ R.rx.text=(R.rx.text+" "+p.t).trim(); } else if(p&&p.t){ const l=R.log[0]; if(l&&l.u===p.u&&!l.text) l.text=p.t; } update(); }
function finishRx(beep){
  const r=R.rx; if(!r) return; R.rx=null;
  R.log.unshift({u:r.u,n:r.n,r:r.r,c:r.c,at:Date.now(),dur:Math.round((Date.now()-r.t0)/100)/10,text:r.text,mine:false}); R.log.length=Math.min(R.log.length,30);
  if(beep){ try{ const ac=ensureAudio(), t=Math.max(R.nextT,ac.currentTime); squelch(t); blip(1100,0.09,0.12,Math.max(0,t-ac.currentTime)+0.02); }catch(e){} }
  update();
}

/* ---------- transmisión ---------- */
function busy(){ return !!R.rx && Date.now()-R.rxT<650; }
async function startTx(){
  if(R.status!=="on"||R.role==="ear"||R.tx) return;
  R.wantTx=true;
  if(busy()){ blip(260,0.22,0.15); R.wantTx=false; flash(); return; }
  ensureAudio();
  if(!(await ensureMic())){ R.wantTx=false; return; }
  if(!R.wantTx||busy()){ R.wantTx=false; return; }
  R.tx=true; R.txBuf=[]; R.txT0=Date.now(); R.txStart=Date.now(); R.txSeq=0;
  const m=me(); R.ch.send({type:"broadcast",event:"s",payload:{u:R.uid,n:m.n,r:m.r,c:m.c,t:R.txStart}});
  blip(1500,0.05,0.08); startCaps(); update();
}
function stopTx(silent,yielded){
  R.wantTx=false; if(!R.tx) return;
  R.tx=false; stopCaps();
  if(R.txBuf.length&&R.ch&&!yielded){ sendChunk(R.txBuf.splice(0)); } R.txBuf=[];
  const dur=Math.round((Date.now()-R.txT0)/100)/10;
  if(R.ch) try{ R.ch.send({type:"broadcast",event:"e",payload:{u:R.uid,q:R.txSeq}}); }catch(e){}
  const m=me(); R.log.unshift({u:R.uid,n:m.n,r:m.r,c:m.c,at:Date.now(),dur,text:R.capText||"",mine:true,lost:!!yielded}); R.log.length=Math.min(R.log.length,30); R.capText="";
  if(!silent) blip(1100,0.07,0.1);
  if(yielded) R.msg="Otra persona ha empezado antes: has cedido la frecuencia.";
  update();
}
/* subtítulos opcionales (SpeechRecognition, Chrome/Edge/Safari reciente) */
function startCaps(){
  R.capText="";
  if(!R.caps) return; const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return;
  try{ const r=new SR(); r.lang="en-US"; r.continuous=true; r.interimResults=false;
    r.onresult=e=>{ for(let i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal){ const t=e.results[i][0].transcript.trim(); if(t){ R.capText=(R.capText+" "+t).trim(); try{ R.ch.send({type:"broadcast",event:"x",payload:{u:R.uid,t}}); }catch(_){} } } } };
    r.onerror=()=>{}; r.start(); R.rec=r; }catch(e){ R.rec=null; }
}
function stopCaps(){ if(R.rec){ const r=R.rec; R.rec=null; try{ r.stop(); }catch(e){} } }
function flash(){ const b=$("#rdPtt"); if(b){ b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); } }

/* ---------- prueba en solitario: micro → servidor Realtime → tú mismo ---------- */
async function solo(){
  const d=R.deps; if(!d||!d.sb||!d.user||R.solo) return;
  const say=t=>{ R.msg=t; update(); };
  ensureAudio(); say("Conectando con el servidor de radio…");
  const res={rtt:null,sent:0,got:0,peak:0,err:""}; let ch;
  try{ ch=d.sb.channel("radio:selftest:"+d.user.id,{config:{broadcast:{self:true,ack:false}}}); }catch(e){ say("No se ha podido abrir el canal de prueba."); return; }
  const done=new Promise(ok=>{ ch.subscribe(st=>{ if(st==="SUBSCRIBED") ok(true); else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT") ok(false); }); });
  ch.on("broadcast",{event:"p"},m=>{ const p=m.payload||m; if(p&&p.t) res.rtt=Math.round(performance.now()-p.t); });
  ch.on("broadcast",{event:"a"},m=>{ const p=m.payload||m; if(p&&p.d){ res.got++; const b=unb64(p.d); for(let i=0;i<b.length;i++){ const a=Math.abs(unmu(b[i])); if(a>res.peak) res.peak=a; } playChunk(b); } });
  const ok=await Promise.race([done,new Promise(r=>setTimeout(()=>r(false),8000))]);
  if(!ok){ try{ d.sb.removeChannel(ch); }catch(e){} say("❌ El servidor de radio no responde. Comprueba que Realtime está activado en Supabase (Project Settings → Realtime) y vuelve a probar."); return; }
  ch.send({type:"broadcast",event:"p",payload:{t:performance.now()}}); await new Promise(r=>setTimeout(r,900));
  if(res.rtt==null){ try{ d.sb.removeChannel(ch); }catch(e){} say("❌ El canal abre pero no devuelve mensajes. Revisa Realtime en Supabase."); return; }
  say("✅ Servidor conectado ("+res.rtt+" ms). Ahora el micrófono…");
  if(!(await ensureMic())){ try{ d.sb.removeChannel(ch); }catch(e){} return; }
  R.solo={ch}; R.txBuf=[]; R.txSeq=0; R.nextT=0; R.stats.txChunks=0; blip(1500,0.05,0.08);
  for(let s=4;s>0;s--){ say("🎙️ Habla ahora… "+s+" s (te oirás por los auriculares)"); await new Promise(r=>setTimeout(r,1000)); }
  if(R.txBuf.length) sendChunk(R.txBuf.splice(0)); res.sent=R.stats.txChunks;
  R.solo=null; R.txBuf=[]; say("Escuchando tu transmisión de vuelta…");
  await new Promise(r=>setTimeout(r,2200)); try{ d.sb.removeChannel(ch); }catch(e){}
  const okAll=res.got>=res.sent*0.8&&res.sent>0&&res.peak>0.02;
  say(okAll?"✅ Todo funciona: micrófono, servidor ("+res.rtt+" ms) y sonido de radio. Ya puedes hablar con otra persona.":
    res.sent===0?"❌ No se ha captado audio del micrófono. Revisa el permiso y el micrófono elegido en el sistema.":
    res.peak<=0.02?"⚠️ Llega silencio: el micrófono parece mudo o sin volumen.":
    "⚠️ Llegaron "+res.got+" de "+res.sent+" trozos de audio. La conexión pierde paquetes; prueba con mejor cobertura.");
}

/* ---------- interfaz ---------- */
const CSS=`
.rd{max-width:760px;display:flex;flex-direction:column;--pn:#0A1016;--pn2:#131D27;--ac:#FFB000;--ac2:#35E0C2;--tx:#E8F0F6;--mu:#8CA0B2;--rd:#FF3B3B;--ln:#2A3A49}
.rd.skin-pil{--pn:#17191D;--pn2:#23272D;--ac:#3CFF7A;--ac2:#6FD3FF;--ln:#3A4048}
.rd .dhead{order:-5}.rd #rdRoles{order:-4}.rd #rdCon{order:-2}.rd:not(.on) #rdCfg{order:-3}.rd.on #rdCfg{order:-1}
.rd summary{cursor:pointer;font:700 18px var(--display);list-style:none}.rd summary::-webkit-details-marker{display:none}.rd summary small{font:500 14px var(--body);color:var(--muted);margin-left:8px}
.rd .card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px;margin:0 0 12px}
.rd h2{font:700 20px/1.1 var(--display);margin:0 0 10px}
.rd .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rd select,.rd input[type=text]{font:16px var(--body);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:9px 10px;min-width:0;max-width:100%}
.rd .fld{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);flex:1 1 180px;min-width:0}
.rd .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.rd .status{font-size:14px;color:var(--muted)}
.rd .st-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--muted);margin-right:6px;vertical-align:1px}
.rd .st-dot.on{background:var(--ok)} .rd .st-dot.conn{background:var(--warn)} .rd .st-dot.err{background:var(--bad)}
.rd .msg{color:var(--bad);font-size:14px;min-height:1.2em;margin:8px 0 0}
.rd input[type=range]{width:min(100%,220px)}
.rd .hint{font-size:13px;color:var(--mu);margin:8px 0 0;text-align:center}
.rd .okl{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--tx);justify-content:center}
.rd .okl input{margin-top:3px;width:16px;height:16px;flex:none;accent-color:var(--ac)}
/* elegir papel */
#rdRoles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 12px}
.rcard{display:flex;flex-direction:column;align-items:center;gap:6px;border:2px solid var(--line);background:var(--paper);color:var(--ink);border-radius:14px;padding:12px 6px 10px;cursor:pointer;min-height:96px;font:700 15px/1.1 var(--display);letter-spacing:.4px;text-align:center;transition:transform .15s,border-color .15s,box-shadow .15s}
.rcard svg{width:38px;height:38px;color:var(--accent)}
.rcard small{font:500 11.5px var(--body);color:var(--muted);letter-spacing:0}
.rcard:hover{transform:translateY(-2px)}
.rcard[aria-pressed="true"]{border-color:var(--accent);background:var(--accentbg);box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 28%,transparent)}
.rcard:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
/* consola */
#rdCon{position:relative;border-radius:20px;padding:16px 14px 14px;margin:0 0 12px;color:var(--tx);overflow:hidden;isolation:isolate;
  background:linear-gradient(180deg,var(--pn2),var(--pn));border:1px solid var(--ln);box-shadow:0 18px 40px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08),inset 0 0 0 5px rgba(0,0,0,.25)}
#rdCon::before{content:"";position:absolute;inset:0;z-index:-1;opacity:.9;pointer-events:none;
  background:radial-gradient(120% 80% at 50% -10%,color-mix(in srgb,var(--ac) 14%,transparent),transparent 60%)}
.skin-atc #rdCon::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
.skin-pil #rdCon{background:linear-gradient(180deg,#2B3037,#15171A 55%,#1E2227);}
.skin-pil #rdCon::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.5;background:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)}
.screw{position:absolute;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#9AA6B2,#38424D 70%);box-shadow:0 1px 1px rgba(0,0,0,.6);z-index:3}
.screw::after{content:"";position:absolute;left:1px;right:1px;top:4px;height:2px;background:#1B2229;transform:rotate(35deg)}
.screw.a{left:9px;top:9px}.screw.b{right:9px;top:9px}.screw.c{left:9px;bottom:9px}.screw.d{right:9px;bottom:9px}
.con-top{display:flex;align-items:center;gap:10px;margin:0 8px 10px;font:700 14px/1 var(--display);letter-spacing:.14em;color:var(--mu);text-transform:uppercase}
.con-top b{flex:1;color:var(--tx);letter-spacing:.1em;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.con-top .clk{font:600 13px ui-monospace,Menlo,monospace;letter-spacing:.05em;color:var(--ac);white-space:nowrap}
.leds{display:flex;gap:10px;margin:0 8px 12px;flex-wrap:wrap}
.led{display:flex;align-items:center;gap:6px;font:700 11px var(--body);letter-spacing:.12em;color:var(--mu)}
.led i{width:12px;height:12px;border-radius:50%;background:#26323D;box-shadow:inset 0 1px 2px rgba(0,0,0,.7);transition:background .1s,box-shadow .1s}
.led.on.g i{background:#3CFF7A;box-shadow:0 0 10px #3CFF7A,0 0 2px #fff inset}
.led.on.r i{background:#FF3B3B;box-shadow:0 0 12px #FF3B3B,0 0 2px #fff inset}
.led.on.y i{background:#FFB000;box-shadow:0 0 10px #FFB000,0 0 2px #fff inset}
.led.on{color:var(--tx)}
.lcd{position:relative;border-radius:12px;background:#05090C;border:1px solid #000;box-shadow:inset 0 3px 14px rgba(0,0,0,.9),0 1px 0 rgba(255,255,255,.07);padding:10px 14px 10px;margin:0 0 12px}
.lcd .nm{grid-column:1/-1;font:700 12px var(--body);letter-spacing:.22em;color:color-mix(in srgb,var(--ac) 70%,#000);text-transform:uppercase;display:flex;justify-content:space-between;gap:8px}
.lcd .fr{font:700 clamp(46px,14vw,72px)/1 var(--display);letter-spacing:.04em;color:var(--ac);text-shadow:0 0 14px color-mix(in srgb,var(--ac) 65%,transparent);font-variant-numeric:tabular-nums;white-space:nowrap}
.lcd .fr small{font-size:.42em;letter-spacing:.1em;margin-left:6px;color:color-mix(in srgb,var(--ac) 70%,#000)}
.lcd .sb{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px;font:700 13px ui-monospace,Menlo,monospace;letter-spacing:.06em;color:var(--ac2);text-shadow:0 0 8px color-mix(in srgb,var(--ac2) 60%,transparent)}
.lcd .sb button{border:1px solid var(--ac2);color:var(--ac2);background:transparent;border-radius:6px;font:700 12px var(--body);letter-spacing:.08em;padding:5px 10px;cursor:pointer;min-height:30px}
.lcd .sb button:hover{background:color-mix(in srgb,var(--ac2) 18%,transparent)}
.rd.off .lcd .fr{opacity:.35;text-shadow:none}
/* teclas de frecuencia */
.keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px;margin:0 0 12px}
.keys label{position:relative;display:flex;flex-direction:column;gap:2px;border-radius:9px;padding:10px 8px 8px;cursor:pointer;min-height:54px;justify-content:center;text-align:center;background:linear-gradient(180deg,#27323D,#18212A);border:1px solid #33424F;box-shadow:0 3px 0 #0A0F14,inset 0 1px 0 rgba(255,255,255,.08);color:var(--tx);transition:transform .08s,box-shadow .08s}
.keys label::before{content:"";position:absolute;left:10px;right:10px;top:5px;height:3px;border-radius:2px;background:#202B35}
.keys input{position:absolute;opacity:0;pointer-events:none}
.keys b{font:700 19px/1 var(--display);letter-spacing:.06em;margin-top:4px}
.keys small{font:600 10.5px var(--body);letter-spacing:.1em;color:var(--mu);text-transform:uppercase}
.keys label:has(input:checked){background:linear-gradient(180deg,#2F3F4D,#1C2832);border-color:var(--ac);transform:translateY(2px);box-shadow:0 1px 0 #0A0F14,0 0 14px color-mix(in srgb,var(--ac) 35%,transparent)}
.keys label:has(input:checked)::before{background:var(--ac);box-shadow:0 0 8px var(--ac)}
.keys label:has(input:focus-visible){outline:2px solid var(--ac2);outline-offset:2px}
.skin-pil .keys label{border-radius:999px;min-height:46px;padding:8px 6px}
.skin-pil .keys label::before{display:none}
.skin-pil .keys small{display:none}
/* medidor */
.mtr{display:flex;align-items:flex-end;gap:3px;height:30px;margin:0 8px 14px}
.mtr i{flex:1;border-radius:2px;background:#1B2631;height:18%;transition:height .09s,background .09s}
.mtr i.on{background:var(--ac);box-shadow:0 0 6px color-mix(in srgb,var(--ac) 60%,transparent)}
.mtr i.hot.on{background:var(--rd);box-shadow:0 0 6px var(--rd)}
/* PTT */
.rd .pttwrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:2px 0 4px}
#rdPtt{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:700 26px/1.05 var(--display);letter-spacing:.14em;color:var(--tx);text-transform:uppercase;transition:transform .08s,box-shadow .12s,background .12s,border-color .12s}
#rdPtt small{font:600 12px var(--body);letter-spacing:.06em;color:var(--mu);text-transform:none}
.skin-atc #rdPtt{width:100%;min-height:96px;border-radius:14px;background:linear-gradient(180deg,#2C3946,#17202A);border:2px solid #3A4A59;box-shadow:0 6px 0 #070B0F,inset 0 1px 0 rgba(255,255,255,.12)}
.skin-atc #rdPtt:not(:disabled):hover{border-color:var(--ac)}
.skin-atc #rdPtt:not(:disabled):not(.tx){border-color:color-mix(in srgb,var(--ac) 70%,#000)}
.skin-pil #rdPtt{width:min(58vw,190px);aspect-ratio:1;border-radius:50%;border:10px solid #0D0F11;background:radial-gradient(circle at 38% 30%,#FF6A5E,#C21B14 62%,#7E0D09);box-shadow:0 0 0 3px #3A4048,0 10px 0 #070809,0 16px 24px rgba(0,0,0,.55),inset 0 2px 6px rgba(255,255,255,.3);color:#fff;font-size:28px}
.skin-pil #rdPtt small{color:rgba(255,255,255,.85)}
#rdPtt:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.5)}
.skin-atc #rdPtt.tx{background:linear-gradient(180deg,#FF5A4D,#B01D14);border-color:#FF8A80;color:#fff;transform:translateY(4px);box-shadow:0 2px 0 #070B0F,0 0 28px rgba(255,59,59,.65);animation:rdpulse 1s infinite}
.skin-pil #rdPtt.tx{transform:translateY(5px) scale(.97);box-shadow:0 0 0 3px #FF8A80,0 4px 0 #070809,0 0 38px rgba(255,59,59,.85),inset 0 2px 6px rgba(255,255,255,.3);animation:rdpulse 1s infinite}
#rdPtt.tx small{color:#fff}
#rdPtt.busy{background:linear-gradient(180deg,#5C4300,#2C2100)!important;border-color:var(--ac)!important;color:var(--ac)}
#rdPtt.busy small{color:var(--ac)}
#rdPtt.shake{animation:rdshake .25s}
@keyframes rdpulse{50%{filter:brightness(1.18)}}
@keyframes rdshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.rd .bar{display:flex;align-items:center;justify-content:center;gap:8px;min-height:26px;font:600 14px var(--body);color:var(--ac2);text-align:center}
.rd .bar b{color:var(--tx)}
/* tiras de progreso */
.strips{display:flex;flex-direction:column;gap:6px}
.strip{display:grid;grid-template-columns:7px 1fr auto;align-items:center;gap:10px;background:#F4EFD9;color:#1B2630;border-radius:4px;border:1px solid #CFC7A4;box-shadow:0 2px 0 rgba(0,0,0,.18);padding:7px 10px 7px 0;font:600 14px ui-monospace,Menlo,monospace;min-height:44px;overflow:hidden}
.strip::before{content:"";align-self:stretch;background:#2F6FA3}
.strip.pil::before{background:#C8102E}.strip.ear::before{background:#7C8791}
.strip .cs{font:700 18px/1.1 var(--display);letter-spacing:.06em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.strip .cs small{display:block;font:600 11px ui-monospace,Menlo,monospace;color:#5B6670;letter-spacing:.04em}
.strip .tg{font-size:11px;font-weight:700;letter-spacing:.1em;color:#5B6670}
.strip.talk{background:#FFF2B8;border-color:#E0B800;box-shadow:0 0 0 2px #FFB000,0 0 18px rgba(255,176,0,.6)}
.strip.talk .tg{color:#B04A00;animation:rdblink 1s infinite}
@keyframes rdblink{50%{opacity:.3}}
.rd .lg{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.rd .lg li{background:#F4EFD9;color:#1B2630;border-radius:4px;border:1px solid #CFC7A4;padding:7px 10px;font:600 13px ui-monospace,Menlo,monospace;box-shadow:0 2px 0 rgba(0,0,0,.14)}
.rd .lg li.empty{background:transparent;border:1px dashed var(--line);box-shadow:none;color:var(--muted)}
.rd .lg .m{color:#5B6670;font-size:11.5px;font-weight:600}
.rd .lg .tx{font:italic 600 13px var(--body);margin-top:3px;color:#33414D}
@media (prefers-color-scheme:dark){.strip,.rd .lg li{background:#E8E2C8}}
@media (max-width:420px){.keys{grid-template-columns:repeat(3,minmax(0,1fr))}.keys b{font-size:17px}.rcard{min-height:88px}.lcd .fr{font-size:clamp(42px,17vw,60px)}}
@media (prefers-reduced-motion:reduce){#rdPtt.tx,#rdPtt.shake,.strip.talk .tg{animation:none}.rcard{transition:none}}
`;
function render(el,deps){
  R.deps=deps; R.uid=deps.user.id; R.el=el;
  if(!document.getElementById("rdCss")){ const s=document.createElement("style"); s.id="rdCss"; s.textContent=CSS; document.head.appendChild(s); }
  if(el.dataset.rd==="1"){ update(); return; }
  el.dataset.rd="1";
  const SR=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  const mtr=Array.from({length:22},(_,i)=>`<i class="${i>16?"hot":""}"></i>`).join("");
  el.innerHTML=`<div class="rd skin-pil off" id="rdRoot">
  <div class="dhead"><div><h1>Radio</h1><p>Elige tu papel, sintoniza una frecuencia y habla. Solo uno a la vez, como en la radio de verdad.</p></div></div>
  <div id="rdRoles" role="group" aria-label="Tu papel">${Object.keys(ROLES).map(k=>`<button type="button" class="rcard" data-r="${k}" aria-pressed="false">${ICON[k]}${k==="atc"?"Controlador":k==="pil"?"Piloto":"Escucha"}<small>${ROLE_SUB[k]}</small></button>`).join("")}</div>
  <details class="card" id="rdCfg" open><summary>Conexión y ajustes <small id="rdSum"></small></summary>
    <div class="row" style="margin-top:12px">
      <select id="rdRole" class="sr" aria-label="Tu papel">${Object.keys(ROLES).map(k=>`<option value="${k}">${ROLES[k]}</option>`).join("")}</select>
      <label class="fld">Indicativo (como te oirán)<input type="text" id="rdCall" maxlength="24" placeholder="EC-ABC, Madrid Torre…" autocomplete="off"></label>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn" id="rdConn" type="button">Conectar</button><button class="btn ghost" id="rdTest" type="button">Probar sonido</button><button class="btn ghost" id="rdSolo" type="button">Prueba en solitario</button>
      <label class="fld" style="flex:0 1 auto;flex-direction:row;align-items:center;gap:8px">Volumen <input type="range" id="rdVol" min="0.1" max="1.5" step="0.05"></label></div>
    <div class="status" id="rdSt" style="margin-top:10px"></div><p class="msg" id="rdMsg" aria-live="polite"></p>
  </details>
  <section id="rdCon" aria-label="Consola de radio"><i class="screw a"></i><i class="screw b"></i><i class="screw c"></i><i class="screw d"></i>
    <div class="con-top"><span id="rdKind"></span><b id="rdId"></b><span class="clk" id="rdClock"></span></div>
    <div class="leds"><span class="led r" id="rdLedTx"><i></i>TX</span><span class="led g" id="rdLedRx"><i></i>RX</span><span class="led y" id="rdLedBz"><i></i>OCUPADA</span><span class="led g" id="rdLedLk"><i></i>ENLACE</span></div>
    <div class="lcd"><div class="nm"><span id="rdLcdName"></span><span id="rdLcdRole"></span></div><div class="fr" id="rdLcd"></div><div class="sb" id="rdLcdSb"></div></div>
    <div class="keys" role="radiogroup" aria-label="Frecuencia">${FREQS.map(f=>`<label><input type="radio" name="rdF" value="${f.id}"><b>${f.f}</b><small>${f.k} · ${f.n.split(" · ")[0]}</small></label>`).join("")}</div>
    <div class="mtr" id="rdMeter" aria-hidden="true">${mtr}</div>
    <div class="pttwrap"><button id="rdPtt" type="button" aria-label="Pulsar para hablar"></button>
    <div class="bar" id="rdBar" aria-live="polite"></div></div>
    <label class="okl" style="margin-top:8px"><input type="checkbox" id="rdLatch"><span>Modo manos libres: un toque empieza y otro termina</span></label>
    ${SR?`<label class="okl" style="margin-top:8px"><input type="checkbox" id="rdCaps"><span>Subtítulos en inglés de lo que digo (beta)</span></label>`:""}
    <p class="hint">Mantén pulsado el botón (o la barra espaciadora). Usa auriculares para evitar el eco.</p></section>
  <div class="card"><h2>En frecuencia <span id="rdN" class="muted" style="font:600 14px var(--body);color:var(--muted)"></span></h2><div class="strips" id="rdWho"></div></div>
  <div class="card"><h2>Registro de transmisiones</h2><ul class="lg" id="rdLog"></ul></div></div>`;
  const q=s=>$(s,el);
  el.querySelectorAll('input[name=rdF]').forEach(i=>i.addEventListener("change",()=>{ if(i.value!==R.freq){ R.sby=R.freq; set("sby",R.sby); } R.freq=i.value; set("freq",R.freq); if(R.status!=="off"){ join(R.priv); } update(); }));
  el.querySelectorAll(".rcard").forEach(b=>b.addEventListener("click",()=>{ R.role=b.dataset.r; set("role",R.role); try{ blip(R.role==="atc"?700:1000,0.04,0.05); }catch(_){} if(R.ch&&R.status==="on"){ try{ R.ch.track(me()); }catch(_){} } update(); }));
  el.addEventListener("click",e=>{ if(e.target.closest("#rdFlip")){ const o=R.freq; R.freq=R.sby; R.sby=o; set("freq",R.freq); set("sby",R.sby); if(R.status!=="off") join(R.priv); update(); } });
  q("#rdRole").addEventListener("change",e=>{ R.role=e.target.value; set("role",R.role); if(R.ch&&R.status==="on"){ try{ R.ch.track(me()); }catch(_){} } update(); });
  q("#rdCall").addEventListener("input",e=>{ R.call=e.target.value; set("call",R.call); });
  q("#rdCall").addEventListener("change",()=>{ if(R.ch&&R.status==="on"){ try{ R.ch.track(me()); }catch(_){} } });
  q("#rdVol").addEventListener("input",e=>{ R.vol=+e.target.value; set("vol",String(R.vol)); if(R.vg) R.vg.gain.value=R.vol; });
  q("#rdConn").addEventListener("click",()=>{ ensureAudio(); if(R.status==="off"||R.status==="err") join(false); else leave(); });
  q("#rdSolo").addEventListener("click",()=>{ solo(); });
  q("#rdTest").addEventListener("click",()=>{ ensureAudio(); const ac=R.ac; R.nextT=0; const b=new Uint8Array(CHUNK*3); for(let i=0;i<b.length;i++) b[i]=mu(0.35*Math.sin(2*Math.PI*900*i/8000)*(i<80?i/80:1)); playChunk(b); setTimeout(()=>{ squelch(); blip(1100,0.09,0.12); },b.length/8+260); });
  q("#rdLatch").addEventListener("change",e=>{ R.latch=e.target.checked; set("latch",R.latch?"1":"0"); });
  const caps=q("#rdCaps"); if(caps) caps.addEventListener("change",e=>{ R.caps=e.target.checked; set("caps",R.caps?"1":"0"); });
  const b=q("#rdPtt"); let down=false;
  const press=e=>{ e.preventDefault(); if(R.latch){ if(R.tx) stopTx(); else startTx(); return; } if(down) return; down=true; try{ b.setPointerCapture(e.pointerId); }catch(_){} startTx(); };
  const rel=e=>{ if(R.latch) return; if(!down) return; down=false; stopTx(); };
  b.addEventListener("pointerdown",press); b.addEventListener("pointerup",rel); b.addEventListener("pointercancel",rel); b.addEventListener("lostpointercapture",rel);
  b.addEventListener("contextmenu",e=>e.preventDefault());
  window.addEventListener("blur",()=>{ if(R.tx&&!R.latch) stopTx(); });
  document.addEventListener("visibilitychange",()=>{ if(document.hidden&&R.tx&&!R.latch) stopTx(); });
  let kd=false;
  document.addEventListener("keydown",e=>{ if(e.code!=="Space"||e.repeat||!R.el||R.el.closest("[hidden]")||/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test((document.activeElement||{}).tagName||"")&&document.activeElement.id!=="rdPtt") return; e.preventDefault(); if(R.latch){ if(R.tx) stopTx(); else startTx(); return; } kd=true; startTx(); });
  document.addEventListener("keyup",e=>{ if(e.code==="Space"&&kd){ kd=false; if(!R.latch) stopTx(); } });
  if(!R.tick) R.tick=setInterval(()=>{ if(R.rx&&Date.now()-R.rxT>900) finishRx(true); else if(R.tx||R.rx) update(); },250);
  if(!R.mt) R.mt=setInterval(meter,90);
  update();
}
let mphase=0;
function meter(){
  const el=R.el; if(!el||el.dataset.rd!=="1"||el.closest("[hidden]")) return;
  const bars=el.querySelectorAll("#rdMeter i"); if(!bars.length) return; mphase+=1;
  const act=R.tx||busy(); const lv=act?Math.max(0.08,Math.min(1,0.45+0.35*Math.sin(mphase*0.9)+0.28*Math.sin(mphase*2.3)+(Math.random()-0.5)*0.3)):0.03;
  bars.forEach((b,i)=>{ b.classList.toggle("on",i/bars.length<lv); });
  const c=el.querySelector("#rdClock"); if(c){ const d=new Date(); c.textContent=String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0")+":"+String(d.getUTCSeconds()).padStart(2,"0")+"Z"; }
}
function update(){
  const el=R.el; if(!el||el.dataset.rd!=="1") return; const q=s=>$(s,el);
  const on=R.status==="on", fr=FREQS.find(f=>f.id===R.freq)||FREQS[0], sb=FREQS.find(f=>f.id===R.sby)||FREQS[4], pil=R.role==="pil", ear=R.role==="ear";
  const root=q("#rdRoot"); root.classList.toggle("on",on); root.classList.toggle("off",!on); root.classList.toggle("skin-pil",pil); root.classList.toggle("skin-atc",!pil);
  if(on&&R.prev!=="on"){ q("#rdCfg").open=false; } if(!on&&R.prev=="on"){ q("#rdCfg").open=true; } R.prev=R.status;
  q("#rdSum").textContent=fr.f+" · "+(ROLES[R.role]||"");
  el.querySelectorAll(".rcard").forEach(b=>b.setAttribute("aria-pressed",b.dataset.r===R.role?"true":"false"));
  el.querySelectorAll('input[name=rdF]').forEach(i=>{ i.checked=i.value===R.freq; });
  q("#rdRole").value=R.role; if(document.activeElement!==q("#rdCall")) q("#rdCall").value=R.call; q("#rdVol").value=R.vol;
  q("#rdLatch").checked=R.latch; const cc=q("#rdCaps"); if(cc) cc.checked=R.caps;
  q("#rdConn").textContent=R.status==="off"||R.status==="err"?"Conectar":R.status==="conn"?"Conectando…":"Salir de la radio"; q("#rdConn").disabled=R.status==="conn";
  q("#rdSt").innerHTML=`<span class="st-dot ${R.status}"></span>`+(R.status==="on"?`Conectado a <b>${fr.f}</b> ${fr.n}`:R.status==="conn"?"Conectando…":R.status==="err"?"Sin conexión":"Desconectado");
  q("#rdMsg").textContent=R.msg||"";
  const cs=(R.call||"").trim()||((me().n||"").split(" ")[0]);
  q("#rdKind").textContent=pil?"COM 1":ear?"MONITOR":"ATC · VCS";
  q("#rdId").textContent=(cs||"—").toUpperCase();
  q("#rdLcdName").textContent=fr.k+" · "+fr.n.split(" · ")[0];
  q("#rdLcdRole").textContent=pil?"ACTIVA":ear?"MONITOR":"SQL ON";
  q("#rdLcd").innerHTML=fr.f+"<small>MHz</small>";
  q("#rdLcdSb").innerHTML=pil?`<button type="button" id="rdFlip" aria-label="Intercambiar con la frecuencia en espera">⇄ CAMBIAR</button><span>EN ESPERA ${sb.f}</span>`:`<span>${on?"CANAL ABIERTO":"SIN ENLACE"}</span><span>${R.role==="ear"?"RX":"RX/TX"}</span>`;
  const bz=busy();
  q("#rdLedTx").classList.toggle("on",R.tx); q("#rdLedRx").classList.toggle("on",bz); q("#rdLedBz").classList.toggle("on",bz&&!R.tx); q("#rdLedLk").classList.toggle("on",on);
  const b=q("#rdPtt"), bar=q("#rdBar");
  b.disabled=!on||ear; b.classList.toggle("tx",R.tx); b.classList.toggle("busy",!R.tx&&bz);
  if(R.tx){ const s=Math.round((Date.now()-R.txT0)/1000); b.innerHTML=`${pil?"TX":"EN EL AIRE"}<small>transmitiendo · ${s} s</small>`; bar.textContent="Estás en el aire — suelta para escuchar"; }
  else if(bz){ const r=R.rx; b.innerHTML=`OCUPADO<small>${esc((r.c||r.n||"").slice(0,22))}</small>`; bar.innerHTML=`🔊 <b>${esc(r.c||r.n)}</b> ${r.r?`(${esc(ROLES[r.r]||"")})`:""} está hablando`; }
  else { b.innerHTML=ear?`MONITOR<small>solo escuchas</small>`:on?`${pil?"PTT":"TX"}<small>pulsa y habla</small>`:`SIN RADIO<small>conecta primero</small>`; bar.textContent=on?"Frecuencia libre":""; }
  const ids=Object.keys(R.peers), talkU=R.tx?R.uid:(bz?R.rx.u:"");
  q("#rdN").textContent=on?"("+Math.max(ids.length,1)+")":"";
  const tagOf=p=>p.r==="atc"?"ATC":p.r==="ear"?"ESCUCHA":"PILOTO";
  q("#rdWho").innerHTML=on?(ids.length?ids.sort((a,c)=>(R.peers[a].r==="atc"?0:1)-(R.peers[c].r==="atc"?0:1)).map(k=>{ const p=R.peers[k]; return `<div class="strip ${p.r||"pil"} ${k===talkU?"talk":""}"><div class="cs">${esc((p.c||p.n||"").toUpperCase())}${k===R.uid?" (TÚ)":""}<small>${esc(p.n||"")}</small></div><span class="tg">${k===talkU?"● EN EL AIRE":tagOf(p)}</span></div>`; }).join(""):`<div class="strip ear"><div class="cs">SOLO TÚ<small>esperando a más gente</small></div></div>`):`<div class="strip ear"><div class="cs">SIN ENLACE<small>conecta para ver quién hay</small></div></div>`;
  q("#rdLog").innerHTML=R.log.length?R.log.map(l=>`<li><div><b>${esc((l.c||l.n||"").toUpperCase())}</b> <span class="m">${l.r?esc(ROLES[l.r]||""):""} · ${new Date(l.at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"})} · ${l.dur} s${l.mine?" · tú":""}${l.lost?" · cortada":""}</span></div>${l.text?`<div class="tx">“${esc(l.text)}”</div>`:""}</li>`).join(""):`<li class="empty">Todavía no hay transmisiones.</li>`;
}
function stateOf(){ return {status:R.status,freq:R.freq,tx:R.tx,rx:R.rx&&{...R.rx},peers:{...R.peers},log:R.log.slice(),stats:{...R.stats},priv:R.priv,role:R.role}; }
window.F0Radio={render, leave, state:stateOf, _mu:mu, _unmu:unmu, FREQS};
})();
