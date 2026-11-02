/* ATPL Fase 0 · CHAT «Online pilots» — solo en la web con cuenta.
   Burbuja flotante abajo a la derecha: lista de compañeros en línea y mensajes privados 1 a 1.
   Supabase Realtime (broadcast + presence). Los mensajes NO se guardan: viven en memoria y se pierden al recargar.
   API: F0Chat.start({sb,user,name}) · F0Chat.leave() · F0Chat.unread() · F0Chat.state() */
(function(){
"use strict";
const MAXLEN=500, GAP=500, KEEP=200, TTL=60*60*1000, GRACE=10*60*1000, RESEND=4000, READ_TTL=5*60*1000;   // gracia: tras desconectarse, un compañero sigue «en línea» 10 min y le llegan los mensajes al volver   // los mensajes duran 60 min (solo en este dispositivo)
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const C={dmTo:"", dmText:"", people:[], anim:0, sms:false, smsErr:"", pAt:0, dch:null, fAt:0, deps:null, ch:null, uid:"", status:"off", peers:{}, rooms:{}, unread:{}, active:null, open:false, last:0, seen:new Set(), retry:0, root:null, shown:0, names:{}, title:"", pruneT:0, out:{}, outT:0};

const PLANE='<path d="M10 1c.9 0 1.4.9 1.4 2v4.6l7 4.2v1.8l-7-2v3.6l1.8 1.4V19L10 18l-3.2 1v-2.4l1.8-1.4v-3.6l-7 2v-1.8l7-4.2V3C8.6 1.9 9.1 1 10 1z"/>';
const ICON='<svg viewBox="0 0 32 32" aria-hidden="true"><path class="bb" d="M16 3C8.8 3 3 8 3 14.2c0 3.3 1.7 6.3 4.4 8.3-.2 1.9-1 3.6-2.2 5 2.6-.3 4.8-1.3 6.4-2.6 1.4.4 2.9.6 4.4.6 7.200 0 13-5 13-11.300S23.200 3 16 3z"/><g class="pl" transform="translate(16 14) rotate(-45) scale(.82) translate(-10 -10)">'+PLANE+'</g></svg>';

/* ---------- estilos ---------- */
function css(){
  if($("#f0chat-css")) return;
  const s=document.createElement("style"); s.id="f0chat-css";
  s.textContent=`
.f0c{position:fixed;z-index:30;right:max(14px,env(safe-area-inset-right,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));font-family:var(--body)}
.f0c-fab{display:flex;align-items:center;gap:9px;cursor:pointer;color:#000;background:#FFC400;border:3px solid #000;border-radius:8px;padding:5px 14px 5px 7px;box-shadow:0 0 0 2px #FFC400,0 0 0 5px #000,0 8px 24px rgba(0,0,0,.4);font:700 14px var(--body);position:relative;transition:transform .15s}
.f0c-fab:hover{transform:translateY(-2px)}
.f0c-fab:focus-visible{outline:3px solid #fff;outline-offset:6px}
.f0c-fab svg{width:34px;height:34px;flex:none;display:block}
.f0c-fab .bb{fill:#000}.f0c-fab .pl{fill:#FFC400}
.f0c-fab span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;text-align:left;font:700 17px var(--display);letter-spacing:.07em;text-transform:uppercase}
.f0c-fab small{font:700 11px var(--body);letter-spacing:.04em;opacity:.85;display:flex;align-items:center;gap:5px;text-transform:none}
.f0c-fab small i{width:8px;height:8px;border-radius:50%;background:#12A150;box-shadow:0 0 0 2px rgba(18,161,80,.3)}
.f0c-fab.off small i{background:#6b6b6b;box-shadow:none}
.f0c-fab .n{position:absolute;top:-14px;right:-12px;min-width:24px;height:24px;padding:0 6px;border-radius:12px;background:#FF3B30;color:#fff;font:700 14px/20px var(--body);text-align:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}
.f0c.open .f0c-fab{display:none}
.f0c-pan{display:none;flex-direction:column;width:min(370px,calc(100vw - 28px));height:min(560px,calc(100dvh - 90px));background:#0B0F14;color:#fff;border:3px solid #000;outline:2px solid #FFC400;border-radius:10px;box-shadow:0 14px 44px rgba(0,0,0,.55);overflow:hidden}
.f0c.open .f0c-pan{display:flex;animation:f0cin .2s ease-out}
@keyframes f0cin{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@keyframes f0cflip{0%{transform:rotateX(90deg);opacity:0}100%{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.f0c.open .f0c-pan{animation:none}.f0c-fab{transition:none}.f0c-st{animation:none!important}}
.f0c-hd{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#000;border-bottom:3px solid #FFC400;color:#FFC400}
.f0c-hd .t{flex:1;min-width:0}
.f0c-hd h2{margin:0;font:700 21px/1.1 var(--display);letter-spacing:.07em;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f0c-hd small{display:flex;align-items:center;gap:6px;font:500 12.5px var(--body);color:#9AA7B2;margin-top:2px}
.f0c-hd small i{flex:none;width:8px;height:8px;border-radius:50%;background:#3FD08A}
.f0c-hd.err small i,.f0c-hd.off small i{background:#f0827d}
.f0c-hd button{flex:none;border:0;background:#FFC400;color:#000;border-radius:6px;min-width:34px;height:34px;padding:0 9px;font:700 18px var(--body);cursor:pointer}
.f0c-hd button:hover{background:#FFD84D}
.f0c-hd button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.f0c-body{flex:1;min-height:0;display:flex;flex-direction:column}
.f0c-colh{display:flex;gap:10px;padding:6px 14px;font:700 12px var(--display);letter-spacing:.14em;text-transform:uppercase;color:#FFC400;opacity:.75;border-bottom:1px solid rgba(255,196,0,.5)}
.f0c-colh span:nth-child(1){min-width:56px}.f0c-colh span:nth-child(2){flex:1}.f0c-colh span:nth-child(3){min-width:86px;text-align:center}
.f0c-list{flex:1;overflow:auto;padding:0 0 4px;display:flex;flex-direction:column}
.f0c-list h3{margin:14px 14px 4px;font:700 13px var(--display);letter-spacing:.14em;text-transform:uppercase;color:#FFC400;display:flex;align-items:center;gap:8px}
.f0c-list h3:after{content:"";flex:1;height:1px;background:rgba(255,196,0,.35)}
.f0c-p{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;border-bottom:1px solid #1F2C37;background:#111A22;color:#fff;font:600 14px var(--body);padding:11px 14px;cursor:pointer;transition:background .12s}
.f0c-p:nth-of-type(even){background:#0D141B}
.f0c-p:hover,.f0c-p:focus-visible{background:#1A2733;outline:none;box-shadow:inset 4px 0 0 #FFC400}
.f0c-p .cs{flex:none;min-width:56px;font:700 25px/1 var(--display);letter-spacing:.04em;color:#FFC400}
.f0c-p .nm{flex:1;min-width:0;font:600 15px/1.15 var(--display);letter-spacing:.05em;text-transform:uppercase;overflow-wrap:anywhere}
.f0c-p small{display:block;margin-top:2px;font:500 12px var(--body);letter-spacing:0;text-transform:none;color:#8FA0AE}
.f0c-st{flex:none;min-width:86px;text-align:center;font:700 12px var(--display);letter-spacing:.1em;text-transform:uppercase;padding:3px 6px;border-radius:3px}.f0c-st.an{animation:f0cflip .5s ease-out both}
.f0c-st.on{background:#12301F;color:#3FD08A}.f0c-st.away{background:#3A2E08;color:#FFC400}.f0c-st.off{background:#222B33;color:#8FA0AE}
.f0c-p .u{flex:none;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#FF3B30;color:#fff;font:700 13px/22px var(--body);text-align:center}
.f0c-empty{margin:auto;text-align:center;padding:20px 22px;color:#8FA0AE;font:500 14px/1.5 var(--body)}
.f0c-empty svg{width:54px;height:54px;display:block;margin:0 auto 8px;opacity:.6}.f0c-empty .bb{fill:none;stroke:#FFC400;stroke-width:1.5}.f0c-empty .pl{fill:#FFC400}
.f0c-note{margin:0;padding:6px 14px 10px;font:500 11.5px/1.4 var(--body);color:#8FA0AE;background:#000}
.f0c-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:6px;background:#0B0F14}
.f0c-m{max-width:82%;padding:7px 11px;border-radius:4px;background:#1B242D;color:#fff;font:15px/1.4 var(--body);overflow-wrap:anywhere;white-space:pre-wrap}
.f0c-m time{display:block;font:500 10.5px var(--body);color:#9AA7B2;margin-top:2px;text-align:right}
.f0c-m.me{align-self:flex-end;background:#FFC400;color:#000}.f0c-m.me time{color:#3A3000}
.f0c-sys{align-self:center;text-align:center;font:500 12px/1.4 var(--body);color:#8FA0AE;max-width:290px}
.f0c-form{display:flex;gap:8px;padding:9px;border-top:3px solid #FFC400;background:#000}
.f0c-form input,.f0c-dm input{flex:1;min-width:0;font:16px var(--body);color:#fff;background:#111A22;border:1px solid #2A3946;border-radius:4px;padding:10px 12px}
.f0c-form input:focus,.f0c-dm input:focus{outline:2px solid #FFC400;outline-offset:1px}
.f0c-form button,.f0c-dm button.go{flex:none;width:44px;border:0;border-radius:4px;background:#FFC400;color:#000;cursor:pointer;display:grid;place-items:center}
.f0c-form button svg,.f0c-dm button.go svg{width:20px;height:20px;fill:currentColor}
.f0c-form button:disabled,.f0c-form input:disabled,.f0c-dm input:disabled,.f0c-dm button.go:disabled{opacity:.45;cursor:not-allowed}
.f0c-dm{display:flex;flex-direction:column;gap:7px;padding:9px 9px 0;border-top:3px solid #FFC400;background:#000}
.f0c-dm .t{font:700 13px var(--display);letter-spacing:.14em;text-transform:uppercase;color:#FFC400;margin:0 4px}
.f0c-dm .chips{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 4px;-webkit-overflow-scrolling:touch}
.f0c-dm .chip{flex:none;font:600 14px var(--body);padding:5px 12px;border-radius:999px;border:1.5px solid #FFC400;background:none;color:#FFC400;cursor:pointer}
.f0c-dm .chip[aria-pressed="true"]{background:#FFC400;color:#000;font-weight:700}
.f0c-dm .hint{margin:0 4px;font:500 13px var(--body);color:#8FA0AE}
.f0c-dm .r{display:flex;gap:8px}
@media (max-width:560px){
 .f0c{right:max(10px,env(safe-area-inset-right,0px));bottom:max(10px,env(safe-area-inset-bottom,0px))}
 .f0c-fab{padding:4px 12px 4px 6px}
 .f0c.open{left:0;right:0;bottom:0}
 .f0c-pan{width:100%;height:min(80dvh,620px);border-radius:12px 12px 0 0;border-width:3px 0 0;outline:0}
}
@media print{.f0c{display:none}}`;
  document.head.appendChild(s);
}

/* ---------- persistencia 60 min (localStorage de este dispositivo) ---------- */
const SK=()=>"f0:chat:"+C.uid;
function save(){
  if(!C.uid) return;
  try{
    const rooms={}; Object.keys(C.rooms).forEach(k=>{ if(C.rooms[k].length) rooms[k]=C.rooms[k]; });
    if(!Object.keys(rooms).length){ localStorage.removeItem(SK()); return; }
    localStorage.setItem(SK(),JSON.stringify({rooms,unread:C.unread,names:C.names}));
  }catch(e){}
}
function prune(){
  const lim=Date.now()-TTL; let ch=false;
  Object.keys(C.rooms).forEach(k=>{
    const a=C.rooms[k], b=a.filter(m=>(m.s&&!m.me)?(!m.rd||m.rd>Date.now()-READ_TTL):m.t>lim);
    if(b.length!==a.length){ ch=true; C.rooms[k]=b; }
    if(!b.length){ delete C.rooms[k]; delete C.unread[k]; if(C.active===k&&!C.peers[k]) C.active=null; }
    else if((C.unread[k]||0)>b.filter(m=>!m.me).length) C.unread[k]=b.filter(m=>!m.me).length;
  });
  return ch;
}
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(SK())||"null"); if(!d||!d.rooms) return;
    C.rooms=d.rooms||{}; C.unread=d.unread||{}; C.names=d.names||{};
    prune();
    Object.values(C.rooms).forEach(a=>a.forEach(m=>C.seen.add(m.id)));
    save();
  }catch(e){}
}
function tick(){ if(prune()){ save(); update(); } try{ const k=C.root&&$("#f0cClk",C.root); if(k) k.textContent=hhmm(Date.now()); }catch(e){} if(C.sms&&document.visibilityState==="visible"&&Date.now()-C.fAt>55000) fetchInbox(); }

/* ---------- canal ---------- */
function myName(){ try{ return String((C.deps&&C.deps.name&&C.deps.name())||"Alumno").trim().slice(0,60)||"Alumno"; }catch(e){ return "Alumno"; } }
function join(priv){
  const d=C.deps; if(!d||!d.sb||!d.user||typeof d.sb.channel!=="function") return;
  leaveChannel(); C.uid=d.user.id; C.status="conn"; update();
  let ch;
  try{ ch=d.sb.channel("f0:chat",{config:{broadcast:{self:false,ack:false},presence:{key:C.uid},private:!!priv}}); }
  catch(e){ C.status="err"; update(); return; }
  C.ch=ch;
  ch.on("broadcast",{event:"m"},m=>onMsg(m.payload||m)).on("broadcast",{event:"a"},m=>onAck(m.payload||m)).on("presence",{event:"sync"},syncPeers);
  ch.subscribe(st=>{
    if(C.ch!==ch) return;
    if(st==="SUBSCRIBED"){ C.status="on"; C.retry=0; try{ ch.track({n:myName()}); }catch(e){} update(); }
    else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"){
      if(!priv){ join(true); return; }
      C.status="err"; update();
      if(C.retry++<3) setTimeout(()=>{ if(C.deps&&C.status==="err") join(false); },4000*C.retry);
    } else if(st==="CLOSED"&&C.status==="on"){ C.status="err"; update(); if(C.retry++<3) setTimeout(()=>{ if(C.deps&&C.status==="err") join(false); },3000); }
  });
}
function leaveChannel(){ if(C.ch){ try{ C.deps.sb.removeChannel(C.ch); }catch(e){} C.ch=null; } C.peers={}; }
function syncPeers(){
  const now=Date.now(), cur={}; let back=[];
  try{ const st=C.ch.presenceState(); Object.keys(st).forEach(k=>{ const m=st[k]&&st[k][0]; if(m&&k!==C.uid) cur[k]={n:String(m.n||"Alumno").slice(0,60)}; }); }catch(e){}
  const o=Object.assign({},cur);
  Object.keys(C.peers).forEach(k=>{
    const p=C.peers[k];
    if(cur[k]){ if(p.away) back.push(k); return; }
    if(p.away){ if(p.until>now) o[k]=p; }                                   // sigue en su minuto de gracia
    else o[k]={n:p.n,away:true,until:now+GRACE};                              // acaba de desaparecer: gracia de 60 s
  });
  C.peers=o; back.forEach(flush); update();
}
function expire(){   // quita a los que han agotado la gracia y gestiona el reenvío de pendientes
  const now=Date.now(); let ch=false;
  Object.keys(C.peers).forEach(k=>{ const p=C.peers[k]; if(p.away&&p.until<=now){ delete C.peers[k]; ch=true; } });
  Object.keys(C.out).forEach(id=>{
    const e=C.out[id], p=C.peers[e.to];
    if(now-e.t0>GRACE+30000){ delete C.out[id]; mark(e.to,id,2); ch=true; return; }   // no se ha podido entregar
    if(p&&!p.away&&now-e.last>=RESEND){ e.last=now; xmit(e.m); }
  });
  if(ch){ save(); update(); }
}
function xmit(m){ try{ C.ch&&C.ch.send({type:"broadcast",event:"m",payload:m}); }catch(e){} }
function flush(k){ const now=Date.now(); Object.keys(C.out).forEach(id=>{ const e=C.out[id]; if(e.to===k){ e.last=now; xmit(e.m); } }); }
function mark(room,id,v){ const a=C.rooms[room]; if(!a) return; const m=a.find(x=>x.id===id); if(m){ if(v) m.p=v; else delete m.p; } }
function total(){ return Object.values(C.unread).filter(n=>n>0).length; }   // personas que te han escrito (como el globo de iPhone)
function msgs(){ return Object.values(C.unread).reduce((a,b)=>a+b,0); }
function clean(x){ return String(x==null?"":x).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,"").trim().slice(0,MAXLEN); }
function viewing(room){ return C.open && C.active===room && document.visibilityState==="visible"; }
function push(room,m){
  const a=C.rooms[room]||(C.rooms[room]=[]); a.push(m); if(a.length>KEEP) a.shift();
  if(!m.me && !viewing(room)) C.unread[room]=(C.unread[room]||0)+1;
  save();
}
function ack(p){ try{ C.ch&&C.ch.send({type:"broadcast",event:"a",payload:{id:p.id,to:p.f}}); }catch(e){} }
function onAck(p){ if(!p||p.to!==C.uid||!C.out[p.id]) return; const e=C.out[p.id]; delete C.out[p.id]; mark(e.to,p.id,0); save(); update(); }
function onMsg(p){
  if(!p||!p.id||!p.to||p.to!==C.uid||p.f===C.uid) return;   // solo mensajes privados dirigidos a mí
  if(C.seen.has(p.id)){ ack(p); return; }                    // reenvío: ya lo tengo, solo confirmo
  const x=clean(p.x); if(!x) return;
  C.seen.add(p.id); if(C.seen.size>2000) C.seen=new Set([...C.seen].slice(-500));
  const room=String(p.f);
  C.names[room]=String(p.n||"Alumno").slice(0,60);
  if(!C.peers[room]) C.peers[room]={n:C.names[room]};
  push(room,{id:p.id,n:String(p.n||"Alumno").slice(0,60),t:+p.t||Date.now(),x,me:false});
  ack(p); update();
}
function send(text,toArg){
  const to=toArg||C.active, x=clean(text); if(!x||!to) return false;
  const live=C.status==="on"&&C.peers[to]&&!C.peers[to].away;
  if(!live&&C.sms) return sendSms(to,x);                                   // sin conexión: se guarda y le llega siempre
  if(C.status!=="on"||!C.peers[to]) return false;
  const now=Date.now(); if(now-C.last<GAP) return false; C.last=now;
  const m={id:C.uid.slice(0,6)+now.toString(36)+Math.random().toString(36).slice(2,6),f:C.uid,n:myName(),to,t:now,x};
  try{ C.ch.send({type:"broadcast",event:"m",payload:m}); }catch(e){ return false; }
  C.out[m.id]={m,to,t0:now,last:now};                                      // se reenvía hasta que el otro confirme (o pasen ~90 s)
  C.seen.add(m.id); C.names[to]=nameOf(to); push(to,{id:m.id,n:m.n,t:now,x,me:true,p:1}); update(); return true;
}

/* ---------- mensajes sin conexión (como un SMS): se guardan en Supabase, llegan siempre y se borran 5 min tras leerlos ---------- */
const dbErr=e=>{ const m=String((e&&(e.message||e.code))||""); return /42P01|PGRST|does not exist|schema cache|not found|404|function/i.test(m); };
async function loadPeople(){
  const d=C.deps; if(!d||!d.sb||typeof d.sb.rpc!=="function") return;
  C.pAt=Date.now();
  try{
    const r=await d.sb.rpc("chat_people");
    if(!r||r.error||!Array.isArray(r.data)){ C.sms=false; C.smsErr=String((r&&r.error&&(r.error.code||r.error.message))||"sin datos").slice(0,60); update(); return; }
    C.smsErr="";
    C.people=r.data.map(x=>({id:String(x.user_id),n:String(x.full_name||"Alumno").slice(0,60)})).filter(x=>x.id!==C.uid);
    C.people.forEach(x=>{ C.names[x.id]=x.n; }); C.sms=true;
  }catch(e){ C.sms=false; C.smsErr=String((e&&(e.code||e.message))||"error").slice(0,60); }
  update();
}
function subDb(){
  const d=C.deps; if(!d||!d.sb||typeof d.sb.channel!=="function"||C.dch) return;
  try{
    C.dch=d.sb.channel("f0:chatdb:"+C.uid).on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:"to_id=eq."+C.uid},p=>{ if(p&&p.new) onSms(p.new); });
    C.dch.subscribe(()=>{});
  }catch(e){ C.dch=null; }
}
function smsInit(){ loadPeople().then(()=>{ if(C.sms){ fetchInbox(); subDb(); } }); }
async function fetchInbox(){
  const d=C.deps; if(!d||!C.sms||C.fetching) return; C.fetching=true; C.fAt=Date.now();
  try{
    const r=await d.sb.from("chat_messages").select("id,from_id,from_name,body,created_at,read_at").eq("to_id",C.uid).is("read_at",null).order("created_at",{ascending:true}).limit(100);
    if(r&&!r.error&&Array.isArray(r.data)) r.data.forEach(onSms);
  }catch(e){}
  C.fetching=false;
}
function onSms(row){
  if(!row||!row.id||String(row.to_id||C.uid)!==C.uid||row.read_at) return;
  const id="s"+row.id, room=String(row.from_id); if(room===C.uid) return;
  const x=clean(row.body); if(!x) return;
  if(C.seen.has(id)) return;
  C.seen.add(id); if(C.seen.size>2000) C.seen=new Set([...C.seen].slice(-500));
  C.names[room]=String(row.from_name||C.names[room]||"Alumno").slice(0,60);
  push(room,{id,n:C.names[room],t:+new Date(row.created_at)||Date.now(),x,me:false,s:1,sid:String(row.id)});
  if(viewing(room)) markRead(room);
  update();
}
function markRead(room){
  const d=C.deps, a=C.rooms[room]; if(!d||!a) return;
  const ms=a.filter(m=>m.s&&!m.me&&!m.rd&&m.sid); if(!ms.length) return;
  const now=Date.now(); ms.forEach(m=>{ m.rd=now; }); save();
  try{
    Promise.resolve(d.sb.from("chat_messages").update({read_at:new Date().toISOString()}).in("id",ms.map(m=>m.sid)).is("read_at",null)).then(r=>{
      if(r&&r.error){ ms.forEach(m=>{ delete m.rd; }); save(); }
    },()=>{ ms.forEach(m=>{ delete m.rd; }); save(); });
  }catch(e){ ms.forEach(m=>{ delete m.rd; }); save(); }
}
function sendSms(to,x){
  const d=C.deps; if(!d||!d.sb||typeof d.sb.from!=="function") return false;
  const now=Date.now(); if(now-C.last<GAP) return false; C.last=now;
  const id="m"+C.uid.slice(0,6)+now.toString(36)+Math.random().toString(36).slice(2,6);
  C.seen.add(id); C.names[to]=nameOf(to);
  push(to,{id,n:myName(),t:now,x,me:true,s:1,p:1}); update();
  const fail=()=>{ mark(to,id,2); save(); update(); };
  try{
    Promise.resolve(d.sb.from("chat_messages").insert({to_id:to,body:x})).then(r=>{ if(r&&r.error){ if(dbErr(r.error)) C.sms=false; fail(); } else { mark(to,id,3); save(); update(); } },fail);
  }catch(e){ fail(); }
  return true;
}

/* ---------- interfaz ---------- */
const hhmm=t=>{ const d=new Date(t); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
const ini=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const sign=n=>{ const w=String(n).trim().split(/\s+/).filter(Boolean); let g=w.slice(0,3).map(x=>x[0]).join(""); if(g.length<3&&w[0]) g=(g+w[0].slice(1)).slice(0,3); return (g||"???").toUpperCase(); };
const nameOf=r=>(C.peers[r]&&C.peers[r].n)||C.names[r]||(C.rooms[r]&&C.rooms[r].find(m=>!m.me)&&C.rooms[r].find(m=>!m.me).n)||"Compañero";
function setOpen(v){
  C.open=!!v; if(v) C.anim=Date.now(); if(!C.root) return;
  if(!v){ C.active=null; } else if(C.active){ C.unread[C.active]=0; markRead(C.active); }
  save();
  update();
  if(v){ const t=$("#f0cIn",C.root)||$(".f0c-p",C.root)||$("#f0cX",C.root); t&&t.focus(); } else { const f=$(".f0c-fab",C.root); f&&f.focus(); }
}
function openRoom(r){ C.active=r; C.unread[r]=0; save(); markRead(r); update(); const i=$("#f0cIn",C.root); if(i&&!i.disabled) i.focus(); }
function build(){
  if(C.root) return; css();
  C.title=String(document.title||"").replace(/^\(\d+\)\s*/,"");
  const r=document.createElement("aside"); r.className="f0c"; r.setAttribute("aria-label","Chat con compañeros");
  r.innerHTML='<button class="f0c-fab" type="button" aria-expanded="false" aria-haspopup="dialog"></button><section class="f0c-pan" role="dialog" aria-label="Online pilots"></section>';
  document.body.appendChild(r); C.root=r;
  r.addEventListener("click",e=>{
    if(e.target.closest(".f0c-fab")) return setOpen(true);
    if(e.target.closest("#f0cX")) return setOpen(false);
    if(e.target.closest("#f0cBack")){ C.active=null; return update(); }
    const ch=e.target.closest("[data-dm]"); if(ch){ C.dmTo=C.dmTo===ch.dataset.dm?"":ch.dataset.dm; update(); const di=$("#f0cDmIn",r); if(di&&!di.disabled) di.focus(); return; }
    const b=e.target.closest(".f0c-p"); if(b) openRoom(b.dataset.room);
  });
  r.addEventListener("input",e=>{ if(e.target.id==="f0cDmIn") C.dmText=e.target.value; });
    r.addEventListener("submit",e=>{
    if(e.target.closest("#f0cDm")){ e.preventDefault(); const i=$("#f0cDmIn",r); if(!i) return;
      const to=C.dmTo, v=i.value; if(!to){ return; } if(!clean(v)){ i.focus(); return; }
      if(send(v,to)){ C.dmText=""; C.dmTo=""; openRoom(to); } return; }
    if(!e.target.closest("#f0cForm")) return; e.preventDefault(); const i=$("#f0cIn",r); if(!i) return; const v=i.value; i.value=""; if(!send(v)) i.value=v; });
  r.addEventListener("keydown",e=>{ if(e.key==="Escape"&&C.open){ e.stopPropagation(); setOpen(false); } });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&C.open&&C.root&&C.root.contains(document.activeElement)) setOpen(false); });
  update();
}
function update(){
  const r=C.root; if(!r) return;
  const online=Object.keys(C.peers).sort((a,b)=>C.peers[a].n.localeCompare(C.peers[b].n,"es"));
  const un=total(), n=online.length, on=C.status==="on";
  const fab=$(".f0c-fab",r);
  fab.className="f0c-fab"+(on?"":" off"); fab.setAttribute("aria-expanded",String(C.open));
  fab.setAttribute("aria-label","Online pilots: "+(on?n+" en línea":"sin conexión")+(un?", "+(un===1?"1 persona te ha escrito":un+" personas te han escrito"):""));
  fab.innerHTML=ICON+`<span>Online pilots<small><i></i>${on?(n===1?"1 en línea":n+" en línea"):(C.status==="conn"?"conectando…":"sin conexión")}</small></span>${un?`<b class="n" data-k="${un}">${un>9?"9+":un}</b>`:""}`;
  if(un>C.shown&&!matchMedia("(prefers-reduced-motion: reduce)").matches){ const b=$(".f0c-fab .n",r); if(b) b.animate([{transform:"scale(.3)"},{transform:"scale(1.3)"},{transform:"scale(1)"}],{duration:320,easing:"ease-out"}); }
  C.shown=un;
  r.classList.toggle("open",C.open);
  try{ document.title=(un?"("+un+") ":"")+C.title; }catch(e){}
  const pan=$(".f0c-pan",r); if(!C.open){ pan.innerHTML=""; return; }
  const stTxt={on:n===1?"1 compañero en línea":n+" compañeros en línea",conn:"Conectando…",err:"Sin conexión. Reintentando…",off:"Desconectado"}[C.status];
  const room=C.active;
  const keep=$("#f0cIn",r)?{v:$("#f0cIn",r).value,f:document.activeElement===$("#f0cIn",r)}:null;
  const dmI=$("#f0cDmIn",r), dmKeep=dmI&&document.activeElement===dmI?{a:dmI.selectionStart,b:dmI.selectionEnd}:null, dmSelFocus=document.activeElement===$("#f0cTo",r);
  const mm=$("#f0cMsgs",r), atEnd=!mm||mm.scrollHeight-mm.scrollTop-mm.clientHeight<60;
  if(!room){
    if(Date.now()-C.pAt>(C.sms?30000:8000)) loadPeople();
    const offIds=[...new Set([...C.people.map(x=>x.id),...Object.keys(C.rooms)])].filter(k=>!C.peers[k]);
    offIds.sort((a,b)=>nameOf(a).localeCompare(nameOf(b),"es"));
    const offl=C.people.filter(x=>!C.peers[x.id]||C.peers[x.id].away);
    const canDm=C.sms&&offl.length>0;
    const first=x=>String(x.n).split(/\s+/)[0], dup=x=>offl.filter(y=>first(y).toLowerCase()===first(x).toLowerCase()).length>1;
    const chipLbl=x=>dup(x)?first(x)+" "+((String(x.n).split(/\s+/)[1]||"")[0]||"")+".":first(x);
    const dmHint=!C.sms?("No disponible"+(C.smsErr?" · "+C.smsErr:"")):(offl.length?"":"Todos están en línea");
    const dm=`<form class="f0c-dm" id="f0cDm" autocomplete="off"><div class="t">Mensaje sin conexión</div>${canDm?`<div class="chips" role="group" aria-label="Elegir compañero que no está en línea">${offl.map(x=>`<button type="button" class="chip" data-dm="${esc(x.id)}" aria-pressed="${x.id===C.dmTo}">${esc(chipLbl(x))}</button>`).join("")}</div>`:`<p class="hint">${esc(dmHint)}</p>`}<div class="r"><input id="f0cDmIn" maxlength="${MAXLEN}" placeholder="${C.dmTo&&canDm?"Escribe para "+esc(first({n:nameOf(C.dmTo)}))+"…":"Elige un compañero…"}" aria-label="Mensaje sin conexión" ${canDm&&C.dmTo?"":"disabled"}><button type="submit" class="go" aria-label="Enviar" ${canDm&&C.dmTo?"":"disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></div></form>`;
    const sub=(k,st)=>C.unread[k]?"mensaje nuevo":st==="away"?"ausente un momento · le llegará":"";
    const an=Date.now()-C.anim<800?" an":"";
    const row=(k,st)=>`<button class="f0c-p${st==="off"?" gone":""}" data-room="${esc(k)}"><span class="cs">${esc(sign(nameOf(k)))}</span><span class="nm">${esc(nameOf(k))}${sub(k,st)?`<small>${esc(sub(k,st))}</small>`:""}</span><span class="f0c-st ${st}${an}">${{on:"En línea",away:"Ausente",off:"Sin conexión"}[st]}</span>${C.unread[k]?`<b class="u">${C.unread[k]}</b>`:""}</button>`;
    const list=(online.length||offIds.length)?`<div class="f0c-colh"><span>Indicativo</span><span>Piloto</span><span>Estado</span></div><div class="f0c-list">${online.length?"<h3>En línea</h3>"+online.map(k=>row(k,C.peers[k].away?"away":"on")).join(""):""}${offIds.length?"<h3>Sin conexión</h3>"+offIds.map(k=>row(k,"off")).join(""):""}</div>`
      :`<div class="f0c-empty">${ICON}${on?"Ahora mismo no hay nadie más conectado.<br>Cuando entre un compañero aparecerá aquí.":"No se ha podido conectar el chat."}</div>`;
    pan.innerHTML=`<header class="f0c-hd ${C.status}"><div class="t"><h2>Online pilots</h2><small><i></i><span id="f0cClk">${hhmm(Date.now())}</span> · ${esc(stTxt)}</small></div><button id="f0cX" type="button" aria-label="Cerrar chat">✕</button></header><div class="f0c-body">${list}${dm}<p class="f0c-note">Mensajes privados en tiempo real. Se conservan 60 minutos</p></div>`;
    const ti=$("#f0cDmIn",r); if(ti) ti.value=C.dmText;
    if(dmKeep&&ti){ ti.focus(); try{ ti.setSelectionRange(dmKeep.a,dmKeep.b); }catch(e){} }
  } else {
    const live=on&&C.peers[room]&&!C.peers[room].away, off=!live&&!C.sms&&(!C.peers[room]||!on);
    const msgs=(C.rooms[room]||[]).map(m=>`<div class="f0c-m${m.me?" me":""}">${esc(m.x)}<time>${hhmm(m.t)}${m.p===1?" · enviando…":m.p===2?" · no entregado":m.p===3?" · enviado":""}</time></div>`).join("");
    pan.innerHTML=`<header class="f0c-hd ${C.peers[room]?C.status:"off"}"><button id="f0cBack" type="button" aria-label="Volver a la lista">‹</button><div class="t"><h2>${esc(nameOf(room))}</h2><small><i></i>${C.peers[room]?(C.peers[room].away?"ausente un momento":"en línea"):(C.sms?"sin conexión · le llegará":"no está en línea")}</small></div><button id="f0cX" type="button" aria-label="Cerrar chat">✕</button></header><div class="f0c-body"><div class="f0c-msgs" id="f0cMsgs" role="log" aria-live="polite"><div class="f0c-sys">Chat privado con ${esc(nameOf(room))}. ${C.sms?(live?"":"Si no está en línea, le llega igualmente (como un SMS) y se borra 5 minutos después de leerlo."):"Se entrega si está en línea o vuelve en menos de 10 minutos."}</div>${msgs}</div><form class="f0c-form" id="f0cForm" autocomplete="off"><input id="f0cIn" maxlength="${MAXLEN}" placeholder="${off?"No está en línea":(live?"Escribe un mensaje…":"Mensaje sin conexión…")}" aria-label="Mensaje" ${off?"disabled":""}><button type="submit" aria-label="Enviar" ${off?"disabled":""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></form></div>`;
    const ni=$("#f0cIn",r); if(keep&&ni){ ni.value=keep.v; if(keep.f&&!ni.disabled) ni.focus(); }
    const nm=$("#f0cMsgs",r); if(nm&&(atEnd||!keep)) nm.scrollTop=nm.scrollHeight;
  }
}
function start(deps){
  const fresh=C.status==="off"||C.uid!==deps.user.id;
  C.deps=deps; build();
  if(fresh){ C.rooms={}; C.unread={}; C.names={}; C.seen=new Set(); C.active=null; C.open=false; C.uid=deps.user.id; load(); clearInterval(C.pruneT); C.pruneT=setInterval(tick,30000); clearInterval(C.outT); C.outT=setInterval(expire,2000); C.out={}; C.people=[]; C.sms=false; C.pAt=0; C.fAt=0; join(false); smsInit(); }
}
function leave(){
  try{ if(C.uid) localStorage.removeItem(SK()); }catch(e){}   // al cerrar sesión se borra el chat de este dispositivo
  clearInterval(C.pruneT); clearInterval(C.outT); C.out={}; try{ if(C.title) document.title=C.title; }catch(e){}
  leaveChannel(); if(C.dch){ try{ C.deps.sb.removeChannel(C.dch); }catch(e){} C.dch=null; } C.people=[]; C.sms=false; C.status="off"; C.rooms={}; C.unread={}; C.names={}; C.seen=new Set(); C.active=null; C.open=false; C.deps=null; C.uid="";
  if(C.root){ C.root.remove(); C.root=null; }
}
function wake(){   // al volver a la pestaña (o recuperar red): si el canal se cayó, se reconecta; si no, se vuelve a anunciar la presencia
  if(!C.deps) return;
  if(C.sms) fetchInbox(); else if(Date.now()-C.pAt>30000) smsInit();
  if(!C.ch||C.status==="err"||C.status==="off"){ C.retry=0; join(false); } else retrack();
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"){ wake(); if(C.active&&C.unread[C.active]){ C.unread[C.active]=0; save(); update(); } if(C.active&&viewing(C.active)) markRead(C.active); } });
addEventListener("pageshow",wake); addEventListener("online",wake);
function retrack(){ if(C.ch&&C.status==="on"){ try{ C.ch.track({n:myName()}); }catch(e){} } }
window.F0Chat={start, leave, retrack, unread:total, _drop(){ if(C.ch){ try{ C.deps.sb.removeChannel(C.ch); }catch(e){} C.ch=null; C.status="err"; update(); } }, _wake:wake, _expire:expire, _peers:()=>C.peers, _out:()=>Object.keys(C.out).length, _setGrace(ms){ Object.keys(C.peers).forEach(k=>{ if(C.peers[k].away) C.peers[k].until=Date.now()+ms; }); }, state:()=>({status:C.status,peers:C.peers,active:C.active,open:C.open,rooms:Object.fromEntries(Object.entries(C.rooms).map(([k,v])=>[k,v.length]))}), _send:send, _open:openRoom, _toggle:setOpen};
})();
