/* ATPL Fase 0 · RADIO (push-to-talk) — solo en la web con cuenta.
   Voz por Supabase Realtime (broadcast): μ-law 8 kHz, trozos de 160 ms, un solo emisor por frecuencia, filtro de radio y «roger beep».
   API: F0Radio.render(el, {sb, user, name}) · F0Radio.leave() · F0Radio.state() */
(function(){
"use strict";
const FREQS=[
  {id:"118100", f:"118.100", n:"Torre · Tower"},
  {id:"121700", f:"121.700", n:"Tierra · Ground"},
  {id:"119700", f:"119.700", n:"Aproximación · Approach"},
  {id:"132000", f:"132.000", n:"Control · Centre"},
  {id:"121500", f:"121.500", n:"Emergencia · Guard"}
];
const ROLES={atc:"ATC", pil:"Piloto", ear:"Solo escucho"};
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
  deps:null, ch:null, freq:get("freq","118100"), role:get("role","pil"), call:get("call",""), vol:+get("vol","0.9"), caps:get("caps","0")==="1", latch:get("latch","0")==="1",
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
    if(!R.tx) { acc=0; cnt=0; return; }
    const inp=e.inputBuffer.getChannelData(0);
    for(let i=0;i<inp.length;i++){ acc+=inp[i]; cnt++; phase+=1; if(phase>=ratio){ phase-=ratio; R.txBuf.push(mu(acc/cnt)); acc=0; cnt=0; } }
    while(R.txBuf.length>=CHUNK){ sendChunk(R.txBuf.splice(0,CHUNK)); }
  };
  R.src=src; R.proc=pr; return true;
}
function sendChunk(arr){
  if(!R.ch) return;
  R.stats.txChunks++;
  R.ch.send({type:"broadcast",event:"a",payload:{u:R.uid,q:R.txSeq++,d:b64(Uint8Array.from(arr))}});
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

/* ---------- interfaz ---------- */
const CSS=`
.rd{max-width:760px;display:flex;flex-direction:column}.rd .dhead{order:-3}.rd.on #rdTxCard{order:-2}.rd.on #rdCfg{order:-1}.rd summary{cursor:pointer;font:700 18px var(--display);list-style:none}.rd summary::-webkit-details-marker{display:none}.rd summary small{font:500 14px var(--body);color:var(--muted);margin-left:8px}.rd #rdCfg[open] summary{margin-bottom:10px}
.rd .card{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px;margin:0 0 12px}
.rd h2{font:700 20px/1.1 var(--display);margin:0 0 10px}
.rd .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rd .fq{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.rd .fq label{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:8px;padding:8px 10px;cursor:pointer;min-height:56px;justify-content:center}
.rd .fq input{position:absolute;opacity:0;pointer-events:none}
.rd .fq b{font:700 20px/1 var(--display);letter-spacing:.5px}
.rd .fq small{color:var(--muted);font-size:12px}
.rd .fq label:has(input:checked){border-color:var(--accent);background:var(--accentbg)}
.rd .fq label:has(input:focus-visible){outline:2px solid var(--blue);outline-offset:2px}
.rd .fq label:has(input:disabled){opacity:.55;cursor:default}
.rd select,.rd input[type=text]{font:16px var(--body);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:9px 10px;min-width:0;max-width:100%}
.rd .fld{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);flex:1 1 180px;min-width:0}
.rd .status{font-size:14px;color:var(--muted)}
.rd .st-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--muted);margin-right:6px;vertical-align:1px}
.rd .st-dot.on{background:var(--ok)} .rd .st-dot.conn{background:var(--warn)} .rd .st-dot.err{background:var(--bad)}
.rd .pttwrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0 4px}
#rdPtt{width:min(62vw,230px);aspect-ratio:1;border-radius:50%;border:6px solid var(--ink);background:var(--paper);color:var(--ink);font:700 26px/1.05 var(--display);letter-spacing:.5px;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:background .12s,border-color .12s,transform .08s}
#rdPtt small{font:600 13px var(--body);letter-spacing:0;color:var(--muted)}
#rdPtt:disabled{opacity:.45;cursor:not-allowed}
#rdPtt.tx{background:var(--bad);border-color:var(--bad);color:#fff;transform:scale(.97);animation:rdpulse 1s infinite}
#rdPtt.tx small{color:#fff}
#rdPtt.busy{background:var(--warnbg);border-color:var(--warn)}
#rdPtt.shake{animation:rdshake .25s}
@keyframes rdpulse{50%{box-shadow:0 0 0 14px color-mix(in srgb,var(--bad) 25%,transparent)}}
@keyframes rdshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (prefers-reduced-motion:reduce){#rdPtt.tx{animation:none}#rdPtt.shake{animation:none}}
.rd .bar{display:flex;align-items:center;gap:8px;min-height:28px;font-size:15px}
.rd .who{display:flex;flex-wrap:wrap;gap:6px}
.rd .who span{border:1px solid var(--line);border-radius:14px;padding:3px 10px;font-size:13px;background:var(--bg)}
.rd .who span.talk{border-color:var(--ok);background:var(--okbg);font-weight:600}
.rd .who span.atc{border-left:4px solid var(--blue)}
.rd .lg{margin:0;padding:0;list-style:none}
.rd .lg li{border-top:1px solid var(--line);padding:8px 0;font-size:14px}
.rd .lg li:first-child{border-top:0}
.rd .lg .m{color:var(--muted);font-size:12px}
.rd .lg .tx{font-style:italic;margin-top:2px}
.rd .hint{font-size:13px;color:var(--muted);margin:6px 0 0}
.rd .okl{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--ink)}
.rd .okl input{margin-top:3px;width:16px;height:16px;flex:none}
.rd .msg{color:var(--bad);font-size:14px;min-height:1.2em;margin:8px 0 0}
.rd input[type=range]{width:min(100%,220px)}
`;
function render(el,deps){
  R.deps=deps; R.uid=deps.user.id; R.el=el;
  if(!document.getElementById("rdCss")){ const s=document.createElement("style"); s.id="rdCss"; s.textContent=CSS; document.head.appendChild(s); }
  if(el.dataset.rd==="1"){ update(); return; }
  el.dataset.rd="1";
  const SR=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
  el.innerHTML=`<div class="rd" id="rdRoot">
  <div class="dhead"><div><h1>Radio</h1><p>Pulsa y habla, suelta y escucha: comunicación por frecuencia entre alumnos y profesor. Solo habla uno a la vez.</p></div></div>
  <details class="card" id="rdCfg" open><summary>Frecuencia y ajustes <small id="rdSum"></small></summary>
    <div class="fq" role="radiogroup" aria-label="Frecuencia">${FREQS.map(f=>`<label><input type="radio" name="rdF" value="${f.id}"><b>${f.f}</b><small>${f.n}</small></label>`).join("")}</div>
    <div class="row" style="margin-top:12px">
      <label class="fld">Tu papel<select id="rdRole">${Object.keys(ROLES).map(k=>`<option value="${k}">${ROLES[k]}</option>`).join("")}</select></label>
      <label class="fld">Indicativo (como te oirán)<input type="text" id="rdCall" maxlength="24" placeholder="EC-ABC, Madrid Torre…" autocomplete="off"></label>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn" id="rdConn" type="button">Conectar</button><button class="btn ghost" id="rdTest" type="button">Probar sonido</button>
      <label class="fld" style="flex:0 1 auto;flex-direction:row;align-items:center;gap:8px">Volumen <input type="range" id="rdVol" min="0.1" max="1.5" step="0.05"></label></div>
    <div class="status" id="rdSt" style="margin-top:10px"></div><p class="msg" id="rdMsg" aria-live="polite"></p>
  </details>
  <div class="card" id="rdTxCard"><div class="pttwrap"><button id="rdPtt" type="button" aria-label="Pulsar para hablar"></button>
    <div class="bar" id="rdBar" aria-live="polite"></div></div>
    <label class="okl" style="justify-content:center;margin-top:6px"><input type="checkbox" id="rdLatch"><span>Modo manos libres: un toque empieza y otro termina</span></label>
    ${SR?`<label class="okl" style="justify-content:center;margin-top:8px"><input type="checkbox" id="rdCaps"><span>Subtítulos en inglés de lo que digo (beta)</span></label>`:""}
    <p class="hint" style="text-align:center">Mantén pulsado el botón (o la barra espaciadora). Usa auriculares para evitar el eco.</p></div>
  <div class="card"><h2>En frecuencia <span id="rdN" class="muted" style="font:600 14px var(--body);color:var(--muted)"></span></h2><div class="who" id="rdWho"></div></div>
  <div class="card"><h2>Últimas transmisiones</h2><ul class="lg" id="rdLog"></ul></div></div>`;
  const q=s=>$(s,el);
  el.querySelectorAll('input[name=rdF]').forEach(i=>i.addEventListener("change",()=>{ R.freq=i.value; set("freq",R.freq); if(R.status!=="off"){ join(R.priv); } update(); }));
  q("#rdRole").addEventListener("change",e=>{ R.role=e.target.value; set("role",R.role); if(R.ch&&R.status==="on"){ try{ R.ch.track(me()); }catch(_){} } update(); });
  q("#rdCall").addEventListener("input",e=>{ R.call=e.target.value; set("call",R.call); });
  q("#rdCall").addEventListener("change",()=>{ if(R.ch&&R.status==="on"){ try{ R.ch.track(me()); }catch(_){} } });
  q("#rdVol").addEventListener("input",e=>{ R.vol=+e.target.value; set("vol",String(R.vol)); if(R.vg) R.vg.gain.value=R.vol; });
  q("#rdConn").addEventListener("click",()=>{ ensureAudio(); if(R.status==="off"||R.status==="err") join(false); else leave(); });
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
  update();
}
function update(){
  const el=R.el; if(!el||el.dataset.rd!=="1") return; const q=s=>$(s,el);
  const on=R.status==="on", fr=FREQS.find(f=>f.id===R.freq)||FREQS[0];
  q("#rdRoot").classList.toggle("on",on); if(on&&R.prev!=="on"){ q("#rdCfg").open=false; } if(!on&&R.prev=="on"){ q("#rdCfg").open=true; } R.prev=R.status;
  q("#rdSum").textContent=fr.f+" · "+(ROLES[R.role]||"");
  el.querySelectorAll('input[name=rdF]').forEach(i=>{ i.checked=i.value===R.freq; });
  q("#rdRole").value=R.role; if(document.activeElement!==q("#rdCall")) q("#rdCall").value=R.call; q("#rdVol").value=R.vol;
  q("#rdLatch").checked=R.latch; const cc=q("#rdCaps"); if(cc) cc.checked=R.caps;
  q("#rdConn").textContent=R.status==="off"||R.status==="err"?"Conectar":R.status==="conn"?"Conectando…":"Salir de la radio"; q("#rdConn").disabled=R.status==="conn";
  q("#rdSt").innerHTML=`<span class="st-dot ${R.status}"></span>`+(R.status==="on"?`Conectado a <b>${fr.f}</b> ${fr.n}`:R.status==="conn"?"Conectando…":R.status==="err"?"Sin conexión":"Desconectado");
  q("#rdMsg").textContent=R.msg||"";
  const b=q("#rdPtt"), bar=q("#rdBar"), ear=R.role==="ear";
  b.disabled=!on||ear; b.classList.toggle("tx",R.tx); b.classList.toggle("busy",!R.tx&&busy());
  if(R.tx){ const s=Math.round((Date.now()-R.txT0)/1000); b.innerHTML=`HABLA<small>transmitiendo · ${s} s</small>`; bar.textContent="Estás en el aire — suelta para escuchar"; }
  else if(busy()){ const r=R.rx; b.innerHTML=`OCUPADO<small>${esc((r.c||r.n||"").slice(0,22))}</small>`; bar.innerHTML=`🔊 <b>${esc(r.c||r.n)}</b> ${r.r?`(${esc(ROLES[r.r]||"")})`:""} está hablando`; }
  else { b.innerHTML=ear?`ESCUCHA<small>papel: solo escucho</small>`:on?`PULSA<small>y habla</small>`:`SIN RADIO<small>conecta primero</small>`; bar.textContent=on?"Frecuencia libre":""; }
  const ids=Object.keys(R.peers), talkU=R.tx?R.uid:(busy()?R.rx.u:"");
  q("#rdN").textContent=on?"("+Math.max(ids.length,1)+")":"";
  q("#rdWho").innerHTML=on?(ids.length?ids.sort((a,c)=>(R.peers[a].r==="atc"?0:1)-(R.peers[c].r==="atc"?0:1)).map(k=>{ const p=R.peers[k]; return `<span class="${p.r==="atc"?"atc":""} ${k===talkU?"talk":""}">${p.r==="atc"?"📡":p.r==="ear"?"🎧":"✈️"} ${esc(p.c||p.n)}${k===R.uid?" (tú)":""}</span>`; }).join(""):`<span class="muted">Solo tú, de momento</span>`):`<span class="muted">Conecta para ver quién hay.</span>`;
  q("#rdLog").innerHTML=R.log.length?R.log.map(l=>`<li><div><b>${esc(l.c||l.n)}</b> <span class="m">${l.r?esc(ROLES[l.r]||""):""} · ${new Date(l.at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"})} · ${l.dur} s${l.mine?" · tú":""}${l.lost?" · cortada":""}</span></div>${l.text?`<div class="tx">“${esc(l.text)}”</div>`:""}</li>`).join(""):`<li class="muted">Todavía no hay transmisiones.</li>`;
}
function stateOf(){ return {status:R.status,freq:R.freq,tx:R.tx,rx:R.rx&&{...R.rx},peers:{...R.peers},log:R.log.slice(),stats:{...R.stats},priv:R.priv,role:R.role}; }
window.F0Radio={render, leave, state:stateOf, _mu:mu, _unmu:unmu, FREQS};
})();
