/* ATPL Fase 0 · CHAT «Online pilots» — solo en la web con cuenta.
   Burbuja flotante abajo a la derecha: lista de compañeros en línea y mensajes privados 1 a 1.
   Supabase Realtime (broadcast + presence). Los mensajes NO se guardan: viven en memoria y se pierden al recargar.
   API: F0Chat.start({sb,user,name}) · F0Chat.leave() · F0Chat.unread() · F0Chat.state() */
(function(){
"use strict";
const MAXLEN=500, GAP=500, KEEP=200, TTL=60*60*1000;   // los mensajes duran 60 min (solo en este dispositivo)
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const C={deps:null, ch:null, uid:"", status:"off", peers:{}, rooms:{}, unread:{}, active:null, open:false, last:0, seen:new Set(), retry:0, root:null, shown:0, names:{}, title:"", pruneT:0};

const PLANE='<path d="M10 1c.9 0 1.4.9 1.4 2v4.6l7 4.2v1.8l-7-2v3.6l1.8 1.4V19L10 18l-3.2 1v-2.4l1.8-1.4v-3.6l-7 2v-1.8l7-4.2V3C8.6 1.9 9.1 1 10 1z"/>';
const ICON='<svg viewBox="0 0 32 32" aria-hidden="true"><path class="bb" d="M16 3C8.8 3 3 8 3 14.2c0 3.3 1.7 6.3 4.4 8.3-.2 1.9-1 3.6-2.2 5 2.6-.3 4.8-1.3 6.4-2.6 1.4.4 2.9.6 4.4.6 7.200 0 13-5 13-11.300S23.200 3 16 3z"/><g class="pl" transform="translate(16 14) rotate(-45) scale(.82) translate(-10 -10)">'+PLANE+'</g></svg>';

/* ---------- estilos ---------- */
function css(){
  if($("#f0chat-css")) return;
  const s=document.createElement("style"); s.id="f0chat-css";
  s.textContent=`
.f0c{position:fixed;z-index:30;right:max(14px,env(safe-area-inset-right,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));font-family:var(--body)}
.f0c-fab{display:flex;align-items:center;gap:9px;border:0;cursor:pointer;color:#fff;background:linear-gradient(135deg,#0E7C86,#14304A);border-radius:999px;padding:7px 16px 7px 8px;box-shadow:0 6px 22px rgba(10,23,36,.35),0 1px 0 rgba(255,255,255,.18) inset;font:700 14px var(--body);position:relative;transition:transform .15s}
.f0c-fab:hover{transform:translateY(-2px)}
.f0c-fab:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px var(--accent)}
.f0c-fab svg{width:38px;height:38px;flex:none;display:block}
.f0c-fab .bb{fill:#fff}.f0c-fab .pl{fill:#0E7C86}
.f0c-fab span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;text-align:left}
.f0c-fab small{font:600 11px var(--body);opacity:.9;display:flex;align-items:center;gap:5px}
.f0c-fab small i{width:8px;height:8px;border-radius:50%;background:#6ee7a1;box-shadow:0 0 0 2px rgba(110,231,161,.3)}
.f0c-fab.off small i{background:#c0c9d0;box-shadow:none}
.f0c-fab .n{position:absolute;top:-7px;right:-4px;min-width:24px;height:24px;padding:0 6px;border-radius:12px;background:#FF3B30;color:#fff;font:700 14px/24px var(--body);text-align:center;border:2px solid var(--bg);box-shadow:0 2px 6px rgba(0,0,0,.3)}
.f0c.open .f0c-fab{display:none}
.f0c-pan{display:none;flex-direction:column;width:min(360px,calc(100vw - 28px));height:min(520px,calc(100dvh - 90px));background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:16px;box-shadow:0 14px 44px rgba(10,23,36,.4);overflow:hidden}
.f0c.open .f0c-pan{display:flex;animation:f0cin .18s ease-out}
@keyframes f0cin{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.f0c.open .f0c-pan{animation:none}.f0c-fab{transition:none}}
.f0c-hd{display:flex;align-items:center;gap:10px;padding:11px 12px;background:linear-gradient(135deg,#0E7C86,#14304A);color:#fff}
.f0c-hd svg{width:30px;height:30px;flex:none}.f0c-hd .bb{fill:#fff}.f0c-hd .pl{fill:#0E7C86}
.f0c-hd h2{margin:0;font:700 15px/1.2 var(--body);flex:1;min-width:0}
.f0c-hd h2 small{display:flex;align-items:center;gap:5px;font:500 11px var(--body);opacity:.9;margin-top:1px}
.f0c-hd h2 small i{width:8px;height:8px;border-radius:50%;background:#6ee7a1}
.f0c-hd.err h2 small i,.f0c-hd.off h2 small i{background:#f0827d}
.f0c-hd button{border:0;background:rgba(255,255,255,.16);color:#fff;border-radius:8px;min-width:34px;height:34px;padding:0 9px;font:700 15px var(--body);cursor:pointer}
.f0c-hd button:hover{background:rgba(255,255,255,.28)}
.f0c-hd button:focus-visible{outline:2px solid #fff;outline-offset:1px}
.f0c-body{flex:1;min-height:0;display:flex;flex-direction:column}
.f0c-list{flex:1;overflow:auto;padding:8px 8px 4px;display:flex;flex-direction:column;gap:2px}
.f0c-list h3{margin:8px 6px 3px;font:700 11px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.f0c-p{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;color:var(--ink);font:600 14px var(--body);padding:9px 8px;border-radius:10px;cursor:pointer}
.f0c-p:hover,.f0c-p:focus-visible{background:var(--accentbg);outline:none}
.f0c-p .av{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--bluebg);color:var(--blue);font:700 13px var(--body);position:relative}
.f0c-p .av i{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;background:var(--ok);border:2px solid var(--paper)}
.f0c-p.gone .av{opacity:.6}.f0c-p.gone .av i{display:none}
.f0c-p .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.f0c-p small{display:block;font:500 12px var(--body);color:var(--muted);overflow:hidden;text-overflow:ellipsis}
.f0c-p .u{flex:none;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#FF3B30;color:#fff;font:700 13px/22px var(--body);text-align:center}
.f0c-empty{margin:auto;text-align:center;padding:20px 22px;color:var(--muted);font:500 14px/1.5 var(--body)}
.f0c-empty svg{width:54px;height:54px;display:block;margin:0 auto 8px;opacity:.55}.f0c-empty .bb{fill:none;stroke:currentColor;stroke-width:1.5}.f0c-empty .pl{fill:currentColor}
.f0c-note{margin:0;padding:8px 12px 10px;border-top:1px solid var(--line);font:500 11.500px/1.4 var(--body);color:var(--muted)}
.f0c-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:6px;background:var(--bg)}
.f0c-m{max-width:82%;padding:7px 11px;border-radius:14px 14px 14px 3px;background:var(--paper);border:1px solid var(--line);font:15px/1.4 var(--body);overflow-wrap:anywhere;white-space:pre-wrap}
.f0c-m time{display:block;font:500 10px var(--body);color:var(--muted);margin-top:2px;text-align:right}
.f0c-m.me{align-self:flex-end;background:var(--accentbg);border-color:transparent;border-radius:14px 14px 3px 14px}
.f0c-sys{align-self:center;text-align:center;font:500 12px/1.4 var(--body);color:var(--muted);max-width:280px}
.f0c-form{display:flex;gap:8px;padding:9px;border-top:1px solid var(--line);background:var(--paper)}
.f0c-form input{flex:1;min-width:0;font:16px var(--body);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:10px 14px}
.f0c-form input:focus{outline:2px solid var(--accent);outline-offset:1px}
.f0c-form button{flex:none;width:42px;border:0;border-radius:50%;background:var(--btn,var(--accent));color:#fff;cursor:pointer;display:grid;place-items:center}
.f0c-form button svg{width:20px;height:20px;fill:currentColor}
.f0c-form button:disabled,.f0c-form input:disabled{opacity:.5;cursor:not-allowed}
@media (max-width:560px){
 .f0c{right:max(10px,env(safe-area-inset-right,0px));bottom:max(10px,env(safe-area-inset-bottom,0px))}
 .f0c-fab{padding:6px 14px 6px 6px}.f0c-fab svg{width:34px;height:34px}
 .f0c.open{left:0;right:0;bottom:0}
 .f0c-pan{width:100%;height:min(78dvh,600px);border-radius:16px 16px 0 0;border-width:1px 0 0}
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
    const a=C.rooms[k], b=a.filter(m=>m.t>lim);
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
function tick(){ if(prune()){ save(); update(); } }

/* ---------- canal ---------- */
function myName(){ try{ return String((C.deps&&C.deps.name&&C.deps.name())||"Alumno").trim().slice(0,60)||"Alumno"; }catch(e){ return "Alumno"; } }
function join(priv){
  const d=C.deps; if(!d||!d.sb||!d.user||typeof d.sb.channel!=="function") return;
  leaveChannel(); C.uid=d.user.id; C.status="conn"; update();
  let ch;
  try{ ch=d.sb.channel("f0:chat",{config:{broadcast:{self:false,ack:false},presence:{key:C.uid},private:!!priv}}); }
  catch(e){ C.status="err"; update(); return; }
  C.ch=ch;
  ch.on("broadcast",{event:"m"},m=>onMsg(m.payload||m)).on("presence",{event:"sync"},syncPeers);
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
  try{ const st=C.ch.presenceState(), o={}; Object.keys(st).forEach(k=>{ const m=st[k]&&st[k][0]; if(m&&k!==C.uid) o[k]={n:String(m.n||"Alumno").slice(0,60)}; }); C.peers=o; }catch(e){}
  update();
}
function total(){ return Object.values(C.unread).filter(n=>n>0).length; }   // personas que te han escrito (como el globo de iPhone)
function msgs(){ return Object.values(C.unread).reduce((a,b)=>a+b,0); }
function clean(x){ return String(x==null?"":x).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,"").trim().slice(0,MAXLEN); }
function viewing(room){ return C.open && C.active===room && document.visibilityState==="visible"; }
function push(room,m){
  const a=C.rooms[room]||(C.rooms[room]=[]); a.push(m); if(a.length>KEEP) a.shift();
  if(!m.me && !viewing(room)) C.unread[room]=(C.unread[room]||0)+1;
  save();
}
function onMsg(p){
  if(!p||!p.id||!p.to||p.to!==C.uid||p.f===C.uid||C.seen.has(p.id)) return;   // solo mensajes privados dirigidos a mí
  const x=clean(p.x); if(!x) return;
  C.seen.add(p.id); if(C.seen.size>2000) C.seen=new Set([...C.seen].slice(-500));
  const room=String(p.f);
  C.names[room]=String(p.n||"Alumno").slice(0,60);
  if(!C.peers[room]) C.peers[room]={n:C.names[room]};
  push(room,{id:p.id,n:String(p.n||"Alumno").slice(0,60),t:+p.t||Date.now(),x,me:false});
  update();
}
function send(text){
  const to=C.active, x=clean(text); if(!x||!to||C.status!=="on"||!C.peers[to]) return false;
  const now=Date.now(); if(now-C.last<GAP) return false; C.last=now;
  const m={id:C.uid.slice(0,6)+now.toString(36)+Math.random().toString(36).slice(2,6),f:C.uid,n:myName(),to,t:now,x};
  try{ C.ch.send({type:"broadcast",event:"m",payload:m}); }catch(e){ return false; }
  C.seen.add(m.id); C.names[to]=nameOf(to); push(to,{id:m.id,n:m.n,t:now,x,me:true}); update(); return true;
}

/* ---------- interfaz ---------- */
const hhmm=t=>{ const d=new Date(t); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
const ini=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const nameOf=r=>(C.peers[r]&&C.peers[r].n)||C.names[r]||(C.rooms[r]&&C.rooms[r].find(m=>!m.me)&&C.rooms[r].find(m=>!m.me).n)||"Compañero";
function setOpen(v){
  C.open=!!v; if(!C.root) return;
  if(!v) C.active=null; else if(C.active) C.unread[C.active]=0;
  save();
  update();
  if(v){ const t=$("#f0cIn",C.root)||$(".f0c-p",C.root)||$("#f0cX",C.root); t&&t.focus(); } else { const f=$(".f0c-fab",C.root); f&&f.focus(); }
}
function openRoom(r){ C.active=r; C.unread[r]=0; save(); update(); const i=$("#f0cIn",C.root); if(i&&!i.disabled) i.focus(); }
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
    const b=e.target.closest(".f0c-p"); if(b) openRoom(b.dataset.room);
  });
  r.addEventListener("submit",e=>{ if(!e.target.closest("#f0cForm")) return; e.preventDefault(); const i=$("#f0cIn",r); if(!i) return; const v=i.value; i.value=""; if(!send(v)) i.value=v; });
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
  const mm=$("#f0cMsgs",r), atEnd=!mm||mm.scrollHeight-mm.scrollTop-mm.clientHeight<60;
  if(!room){
    const gone=Object.keys(C.rooms).filter(k=>!C.peers[k]);
    const row=(k,sub,isOn)=>`<button class="f0c-p${isOn?"":" gone"}" data-room="${esc(k)}"><span class="av">${esc(ini(nameOf(k)))}<i></i></span><span class="nm">${esc(nameOf(k))}<small>${esc(sub)}</small></span>${C.unread[k]?`<b class="u">${C.unread[k]}</b>`:""}</button>`;
    const list=(online.length||gone.length)?`<div class="f0c-list">${online.length?"<h3>En línea</h3>"+online.map(k=>row(k,C.unread[k]?"mensaje nuevo":"toca para escribir",true)).join(""):""}${gone.length?"<h3>Conversaciones</h3>"+gone.map(k=>row(k,"ya no está en línea",false)).join(""):""}</div>`
      :`<div class="f0c-empty">${ICON}${on?"Ahora mismo no hay nadie más conectado.<br>Cuando entre un compañero aparecerá aquí.":"No se ha podido conectar el chat."}</div>`;
    pan.innerHTML=`<header class="f0c-hd ${C.status}">${ICON}<h2>Online pilots<small><i></i>${esc(stTxt)}</small></h2><button id="f0cX" type="button" aria-label="Cerrar chat">✕</button></header><div class="f0c-body">${list}<p class="f0c-note">Mensajes privados en tiempo real. Se conservan 60 minutos solo en este dispositivo (por si cierras la web sin querer) y luego se borran. No compartas datos personales ni claves.</p></div>`;
  } else {
    const off=!C.peers[room]||!on;
    const msgs=(C.rooms[room]||[]).map(m=>`<div class="f0c-m${m.me?" me":""}">${esc(m.x)}<time>${hhmm(m.t)}</time></div>`).join("");
    pan.innerHTML=`<header class="f0c-hd ${C.peers[room]?C.status:"off"}"><button id="f0cBack" type="button" aria-label="Volver a la lista">‹</button><h2>${esc(nameOf(room))}<small><i></i>${C.peers[room]?"en línea":"no está en línea"}</small></h2><button id="f0cX" type="button" aria-label="Cerrar chat">✕</button></header><div class="f0c-body"><div class="f0c-msgs" id="f0cMsgs" role="log" aria-live="polite"><div class="f0c-sys">Chat privado con ${esc(nameOf(room))}. Solo se entrega si está en línea. Los mensajes se borran a los 60 minutos.</div>${msgs}</div><form class="f0c-form" id="f0cForm" autocomplete="off"><input id="f0cIn" maxlength="${MAXLEN}" placeholder="${off?"No está en línea":"Escribe un mensaje…"}" aria-label="Mensaje" ${off?"disabled":""}><button type="submit" aria-label="Enviar" ${off?"disabled":""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg></button></form></div>`;
    const ni=$("#f0cIn",r); if(keep&&ni){ ni.value=keep.v; if(keep.f&&!ni.disabled) ni.focus(); }
    const nm=$("#f0cMsgs",r); if(nm&&(atEnd||!keep)) nm.scrollTop=nm.scrollHeight;
  }
}
function start(deps){
  const fresh=C.status==="off"||C.uid!==deps.user.id;
  C.deps=deps; build();
  if(fresh){ C.rooms={}; C.unread={}; C.names={}; C.seen=new Set(); C.active=null; C.open=false; C.uid=deps.user.id; load(); clearInterval(C.pruneT); C.pruneT=setInterval(tick,30000); join(false); }
}
function leave(){
  try{ if(C.uid) localStorage.removeItem(SK()); }catch(e){}   // al cerrar sesión se borra el chat de este dispositivo
  clearInterval(C.pruneT); try{ if(C.title) document.title=C.title; }catch(e){}
  leaveChannel(); C.status="off"; C.rooms={}; C.unread={}; C.names={}; C.seen=new Set(); C.active=null; C.open=false; C.deps=null; C.uid="";
  if(C.root){ C.root.remove(); C.root=null; }
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&C.active&&C.unread[C.active]){ C.unread[C.active]=0; save(); update(); } });
function retrack(){ if(C.ch&&C.status==="on"){ try{ C.ch.track({n:myName()}); }catch(e){} } }
window.F0Chat={start, leave, retrack, unread:total, state:()=>({status:C.status,peers:C.peers,active:C.active,open:C.open,rooms:Object.fromEntries(Object.entries(C.rooms).map(([k,v])=>[k,v.length]))}), _send:send, _open:openRoom, _toggle:setOpen};
})();
