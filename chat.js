/* ATPL Fase 0 · CHAT entre compañeros — solo en la web con cuenta.
   Supabase Realtime (broadcast + presence). Los mensajes NO se guardan: viven en memoria y se pierden al recargar.
   API: F0Chat.start({sb,user,name,onBadge}) · F0Chat.render(el) · F0Chat.leave() · F0Chat.unread() · F0Chat.state() */
(function(){
"use strict";
const MAXLEN=500, GAP=500, KEEP=200;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const C={deps:null, ch:null, uid:"", status:"off", peers:{}, rooms:{all:[]}, unread:{}, active:"all", el:null, last:0, seen:new Set(), retry:0, mobileChat:false};

/* ---------- estilos (una sola vez) ---------- */
function css(){
  if($("#f0chat-css")) return;
  const s=document.createElement("style"); s.id="f0chat-css";
  s.textContent=`
.chb{font-style:normal;display:inline-block;min-width:16px;padding:0 4px;margin-left:5px;border-radius:9px;background:var(--bad);color:#fff;font:700 11px/16px var(--body);text-align:center;vertical-align:middle}
.cht{display:grid;grid-template-columns:260px minmax(0,1fr);gap:0;border:1px solid var(--line);border-radius:12px;background:var(--paper);overflow:hidden;height:min(640px,calc(100dvh - 190px));min-height:360px}
.cht-side{border-right:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.cht-side h3{margin:0;padding:12px 14px 8px;font:700 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.cht-list{overflow:auto;flex:1;padding:0 6px 8px;display:flex;flex-direction:column;gap:2px}
.cht-p{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;background:none;color:var(--ink);font:600 14px var(--body);padding:9px 10px;border-radius:9px;cursor:pointer}
.cht-p:hover{background:var(--accentbg)}
.cht-p[aria-current=true]{background:var(--accentbg);box-shadow:inset 3px 0 0 var(--accent)}
.cht-p .av{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--bluebg);color:var(--blue);font:700 12px var(--body);position:relative}
.cht-p .av i{position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:var(--ok);border:2px solid var(--paper)}
.cht-p .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cht-p small{display:block;font:500 11px var(--body);color:var(--muted)}
.cht-main{display:flex;flex-direction:column;min-width:0;min-height:0}
.cht-top{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line);font:700 15px var(--body)}
.cht-top small{font:500 12px var(--body);color:var(--muted)}
.cht-back{display:none;border:1px solid var(--line);background:none;color:var(--ink);border-radius:8px;padding:4px 10px;font:600 13px var(--body);cursor:pointer}
.cht-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:6px;background:var(--bg)}
.cht-m{max-width:min(78%,520px);padding:7px 11px;border-radius:12px 12px 12px 3px;background:var(--paper);border:1px solid var(--line);font:15px/1.4 var(--body);overflow-wrap:anywhere;white-space:pre-wrap}
.cht-m b{display:block;font:700 11px var(--body);color:var(--blue);margin-bottom:1px}
.cht-m time{display:block;font:500 10px var(--body);color:var(--muted);margin-top:2px;text-align:right}
.cht-m.me{align-self:flex-end;background:var(--accentbg);border-color:transparent;border-radius:12px 12px 3px 12px}
.cht-m.me b{display:none}
.cht-sys{align-self:center;text-align:center;font:500 12px/1.4 var(--body);color:var(--muted);max-width:420px}
.cht-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
.cht-form input{flex:1;min-width:0;font:16px var(--body);color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:10px 12px}
.cht-form input:focus{outline:2px solid var(--accent);outline-offset:1px}
.cht-form button{border:0;border-radius:9px;background:var(--btn,var(--accent));color:#fff;font:700 14px var(--body);padding:0 16px;cursor:pointer}
.cht-form button:disabled,.cht-form input:disabled{opacity:.5;cursor:not-allowed}
.cht-note{margin:0 0 10px;font:500 13px/1.45 var(--body);color:var(--muted)}
.cht-st{display:flex;align-items:center;gap:7px;font:600 12px var(--body);color:var(--muted);padding:12px 14px 0}
.cht-st i{width:8px;height:8px;border-radius:50%;background:var(--muted)}
.cht-st.on i{background:var(--ok)} .cht-st.err i{background:var(--bad)}
@media (max-width:640px){
 .cht{grid-template-columns:1fr;height:calc(100dvh - 200px)}
 .cht-side{border-right:0} .cht-main{display:none}
 .cht.in .cht-side{display:none} .cht.in .cht-main{display:flex}
 .cht-back{display:inline-block}
}`;
  document.head.appendChild(s);
}

/* ---------- canal ---------- */
function myName(){ try{ return String((C.deps&&C.deps.name&&C.deps.name())||"Alumno").trim().slice(0,60)||"Alumno"; }catch(e){ return "Alumno"; } }
function join(priv){
  const d=C.deps; if(!d||!d.sb||!d.user||typeof d.sb.channel!=="function") return;
  leaveChannel(); C.uid=d.user.id; C.status="conn"; update();
  let ch;
  try{ ch=d.sb.channel("f0:chat",{config:{broadcast:{self:false,ack:false},presence:{key:C.uid},private:!!priv}}); }
  catch(e){ C.status="err"; update(); return; }
  C.ch=ch;
  ch.on("broadcast",{event:"m"},m=>onMsg(m.payload||m))
    .on("presence",{event:"sync"},syncPeers);
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
function total(){ return Object.values(C.unread).reduce((a,b)=>a+b,0); }
function badge(){ try{ C.deps&&C.deps.onBadge&&C.deps.onBadge(total()); }catch(e){} }
function clean(x){ return String(x==null?"":x).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,"").trim().slice(0,MAXLEN); }
function push(room,m){
  const a=C.rooms[room]||(C.rooms[room]=[]); a.push(m); if(a.length>KEEP) a.shift();
  const viewing = C.active===room && C.el && document.body.contains(C.el) && document.visibilityState==="visible" && (!C.el.closest("[hidden]"));
  if(!m.me && !viewing){ C.unread[room]=(C.unread[room]||0)+1; badge(); }
}
function onMsg(p){
  if(!p||!p.id||p.f===C.uid||C.seen.has(p.id)) return;
  const x=clean(p.x); if(!x) return;
  if(p.to && p.to!==C.uid) return;                 // privado para otra persona
  C.seen.add(p.id); if(C.seen.size>2000) C.seen=new Set([...C.seen].slice(-500));
  const room=p.to?String(p.f):"all";
  if(p.to && p.n && !C.peers[p.f]) C.peers[p.f]={n:String(p.n).slice(0,60)};
  push(room,{id:p.id,f:p.f,n:String(p.n||"Alumno").slice(0,60),t:+p.t||Date.now(),x,me:false});
  update();
}
function send(text){
  const x=clean(text); if(!x||C.status!=="on") return false;
  const now=Date.now(); if(now-C.last<GAP) return false; C.last=now;
  const to=C.active==="all"?null:C.active;
  if(to&&!C.peers[to]) return false;
  const m={id:C.uid.slice(0,6)+now.toString(36)+Math.random().toString(36).slice(2,6),f:C.uid,n:myName(),to,t:now,x};
  try{ C.ch.send({type:"broadcast",event:"m",payload:m}); }catch(e){ return false; }
  C.seen.add(m.id);
  push(to||"all",{id:m.id,f:C.uid,n:m.n,t:now,x,me:true});
  update(); return true;
}

/* ---------- pintado ---------- */
const hhmm=t=>{ const d=new Date(t); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
const ini=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
function roomName(r){ return r==="all"?"Sala general":((C.peers[r]&&C.peers[r].n)||(C.rooms[r]&&C.rooms[r][0]&&C.rooms[r][0].n)||"Compañero"); }
function open(room){ C.active=room; C.unread[room]=0; C.mobileChat=true; badge(); update(); const i=$("#chtIn",C.el); if(i&&!i.disabled) i.focus(); }
function update(){
  const el=C.el; if(!el||!document.body.contains(el)) return;
  const online=Object.keys(C.peers).sort((a,b)=>C.peers[a].n.localeCompare(C.peers[b].n,"es"));
  // personas con las que hay conversación aunque se hayan ido
  const gone=Object.keys(C.rooms).filter(r=>r!=="all"&&!C.peers[r]);
  const stTxt={on:"Conectado",conn:"Conectando…",err:"Chat no disponible ahora. Reintentando…",off:"Desconectado"}[C.status];
  const row=(r,name,sub,online_)=>`<button class="cht-p" data-room="${esc(r)}" aria-current="${C.active===r}"><span class="av">${r==="all"?"👥":esc(ini(name))}${online_?"<i></i>":""}</span><span class="nm">${esc(name)}<small>${esc(sub)}</small></span>${C.unread[r]?`<i class="chb">${C.unread[r]}</i>`:""}</button>`;
  const side=`<div class="cht-side"><div class="cht-st ${C.status}"><i></i>${stTxt}</div><h3>Salas</h3><div class="cht-list">${row("all","Sala general",online.length+" en línea además de ti",false)}</div><h3>En línea (${online.length})</h3><div class="cht-list">${online.map(u=>row(u,C.peers[u].n,"mensaje privado",true)).join("")||'<p class="cht-note" style="padding:0 10px">Nadie más ahora mismo. Cuando entre alguien aparecerá aquí.</p>'}${gone.length?'<h3 style="padding-left:6px">Sin conexión</h3>'+gone.map(u=>row(u,roomName(u),"no está en línea",false)).join(""):""}</div></div>`;
  const msgs=(C.rooms[C.active]||[]);
  const peerOff=C.active!=="all"&&!C.peers[C.active];
  const list=msgs.map(m=>`<div class="cht-m${m.me?" me":""}"><b>${esc(m.n)}</b>${esc(m.x)}<time>${hhmm(m.t)}</time></div>`).join("");
  const hint=C.active==="all"?"Todos los que estén en línea ven este chat. Los mensajes no se guardan: si recargas o entras más tarde, no verás lo anterior.":"Mensaje privado con "+roomName(C.active)+". Solo se entrega si está en línea y no se guarda.";
  const main=`<div class="cht-main"><div class="cht-top"><button class="cht-back" type="button" id="chtBack">‹ Atrás</button><div>${esc(roomName(C.active))}<small style="display:block">${C.active==="all"?"Chat de todos":(peerOff?"No está en línea":"En línea")}</small></div></div><div class="cht-msgs" id="chtMsgs" role="log" aria-live="polite"><div class="cht-sys">${esc(hint)}</div>${list}</div><form class="cht-form" id="chtForm" autocomplete="off"><input id="chtIn" maxlength="${MAXLEN}" placeholder="${peerOff?"No puedes escribirle: no está en línea":"Escribe un mensaje…"}" aria-label="Mensaje" ${(peerOff||C.status!=="on")?"disabled":""}><button type="submit" ${(peerOff||C.status!=="on")?"disabled":""}>Enviar</button></form></div>`;
  const keep=$("#chtIn",el)?{v:$("#chtIn",el).value,f:document.activeElement===$("#chtIn",el)}:null;
  const mm=$("#chtMsgs",el), atEnd=!mm||mm.scrollHeight-mm.scrollTop-mm.clientHeight<60;
  const box=$(".cht",el); box.className="cht"+(C.mobileChat?" in":""); box.innerHTML=side+main;
  const ni=$("#chtIn",el); if(keep&&ni){ ni.value=keep.v; if(keep.f) ni.focus(); }
  const nm=$("#chtMsgs",el); if(nm&&atEnd) nm.scrollTop=nm.scrollHeight;
  if(C.active!=="all"&&!C.peers[C.active]&&!(C.rooms[C.active]||[]).length){ /* sala vacía de alguien que se fue */ }
}
function render(el){
  css(); C.el=el;
  el.innerHTML=`<h2 style="margin:0 0 4px;font:700 22px var(--head,var(--body))">Chat entre compañeros</h2><p class="cht-note">Habla en tiempo real con quien esté en línea para comentar dudas. No es privado de verdad ni queda guardado: no compartas datos personales, contraseñas ni claves.</p><div class="cht"></div>`;
  if(!el._f0c){ el._f0c=1;
  el.addEventListener("click",e=>{ const b=e.target.closest(".cht-p"); if(b) open(b.dataset.room); if(e.target.closest("#chtBack")){ C.mobileChat=false; update(); } });
  el.addEventListener("submit",e=>{ if(!e.target.closest("#chtForm")) return; e.preventDefault(); const i=$("#chtIn",el); if(i&&send(i.value)){ i.value=""; } });
  }
  C.unread[C.active]=0; badge(); update();
  if(C.status==="off"&&C.deps) join(false);
}
function start(deps){
  C.deps=deps; css();
  if(C.status==="off"||C.uid!==deps.user.id){ C.rooms={all:[]}; C.unread={}; C.seen=new Set(); C.active="all"; C.mobileChat=false; join(false); }
}
function leave(){ leaveChannel(); C.status="off"; C.rooms={all:[]}; C.unread={}; C.seen=new Set(); C.active="all"; C.deps=null; C.uid=""; C.el=null; badge(); }
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible"&&C.unread[C.active]){ C.unread[C.active]=0; badge(); update(); } });
window.F0Chat={start, render, leave, unread:total, state:()=>({status:C.status,peers:C.peers,active:C.active,rooms:Object.fromEntries(Object.entries(C.rooms).map(([k,v])=>[k,v.length]))}), _send:send, _open:open};
})();
