/* Asignaturas oficiales SENASA (EN PRUEBAS: solo para la cuenta de administrador; para los alumnos no hace nada).
   · AGK, Performance y Navegación: barra para estudiar cada asignatura oficial por separado (021/022, 031/032/033, 061/062).
   · «Mi plan» = Plan Completo SENASA (13): cada pregunta va a su asignatura oficial. Las que vivían en otra página
     (p. ej. brújula 022 dentro de Navegación) salen de allí y entran en la suya (xq.json). Plan Inicial (9): todo como siempre.
   No duplica nada en los ficheros: filtra el banco, el temario y los apuntes por el código oficial de cada pregunta. */
(function(){
"use strict";
const GROUPS={
  "021":{all:"Todo AGK", subs:[["021","Sistemas y motor"],["022","Instrumentación"]]},
  "031":{all:"Todo Performance", subs:[["031","Masa y centrado"],["032","Performance"],["033","Planificación"]]},
  "061":{all:"Todo Navegación", subs:[["061","Navegación general"],["062","Radionavegación"]]}
};
const m=/(\d{3})\.html/.exec(location.pathname), PAGE=m&&m[1];
if(!PAGE) return;
const G=GROUPS[PAGE]||null, LS="f0:sub:"+PAGE, ADMIN="jjc.ruano@gmail.com";
// administrador: bandera de la app o, si aún no ha llegado, la sesión guardada en este navegador
function isAdmin(){
  try{ if(window.parent!==window&&window.parent.F0_ADMIN) return true; }catch(e){}
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/^sb-.*-auth-token$/.test(k)){ const v=JSON.parse(localStorage.getItem(k)||"null"), u=v&&(v.user||(v.currentSession&&v.currentSession.user)); if(u&&String(u.email||"").toLowerCase()===ADMIN) return true; } } }catch(e){}
  return false;
}
const plan13=()=>{ try{ return localStorage.getItem("f0:plan")==="13"; }catch(e){ return false; } };
let XQ=null, RECODE={};
const code3=q=>RECODE[q[0]]||String(q[1]||"").replace(/^X\./,"").slice(0,3);
const OWN=G?G.subs.map(s=>s[0]):(PAGE==="070"?["070","071"]:[PAGE]);
let RAW=null, on=false, P13=false, seg="", B0=null, S0=null, BL0=null, E0=null, ready=false;
const get=n=>{ try{ return window.eval(n); }catch(e){ return undefined; } };
const setBank=()=>{ try{ window.eval("BANK=__f0b"); }catch(e){} };

// Plan Completo: fuera las preguntas que se han ido a su asignatura, dentro las que llegan de otras páginas
function plan(bank){
  if(!P13||!XQ) return bank;
  const out=(XQ.moved[PAGE]||[]), gone=new Set(out), ids=new Set();
  const RL=(XQ.relo&&XQ.relo[PAGE])||{};
  const res=bank.filter(q=>!gone.has(q[0])).map(q=>RL[q[0]]?[q[0],RL[q[0]]].concat(q.slice(2)):q);
  res.forEach(q=>ids.add(q[0]));
  (XQ.import[PAGE]||[]).forEach(q=>{ if(!ids.has(q[0])){ res.push(q.slice()); ids.add(q[0]); } });
  const BY=get("BYID"); if(BY&&BY.set) res.forEach(q=>{ if(!BY.has(q[0])) BY.set(q[0],q); });
  return res;
}
function snapshot(){
  if(ready) return true;
  const bank=get("BANK"); if(!bank||!bank.length) return false;
  RAW=bank.slice(); B0=plan(bank.slice()); const S=get("SUB"); S0=S?S.slice():null; const BL=get("BLOCKS"); BL0=BL?BL.slice():null; const E=get("EXAMS"); E0=E?Object.assign({},E):null;
  // Trial y Adaptativo siempre con todo el bloque, como hasta ahora
  const sel=get("selectQuestions");
  if(typeof sel==="function"&&!sel.__f0sub){
    const wrap=function(mode){ if((seg||P13)&&(mode==="trial"||mode==="adaptive")){ const cur=get("BANK"); window.__f0b=RAW.slice(); setBank(); try{ return sel.apply(this,arguments); } finally{ window.__f0b=cur; setBank(); } } return sel.apply(this,arguments); };
    wrap.__f0sub=1; window.__f0sel=wrap; try{ window.eval("selectQuestions=__f0sel"); }catch(e){}
  }
  // si la página reconstruye el banco (progreso cargado, preguntas nuevas), se vuelve a tomar y se reaplica todo
  const bb=get("buildBank");
  if(typeof bb==="function"&&!bb.__f0sub){
    const wb=function(){ const r=bb.apply(this,arguments); try{ RAW=(get("BANK")||[]).slice(); const nb=plan(RAW.slice()), ids=new Set(nb.map(q=>q[0])); B0=nb.concat(B0.filter(q=>!ids.has(q[0])&&!(XQ&&P13&&(XQ.moved[PAGE]||[]).includes(q[0])))); window.__f0b=view(); setBank(); }catch(e){} return r; };
    wb.__f0sub=1; window.__f0bb=wb; try{ window.eval("buildBank=__f0bb"); }catch(e){}
  }
  ready=true; return true;
}
// el banco puede crecer (preguntas generadas): se suman al original antes de filtrar
function full(){ const cur=get("BANK")||[], ids=new Set(B0.map(q=>q[0])); const gone=P13&&XQ?new Set(XQ.moved[PAGE]||[]):null; cur.forEach(q=>{ if(!ids.has(q[0])&&!(gone&&gone.has(q[0]))){ B0.push(q); ids.add(q[0]); } }); return B0.slice(); }
function view(){ const all=full(); if(seg) return all.filter(q=>code3(q)===seg); if(P13) return all.filter(q=>OWN.includes(code3(q))); return all; }
const quizOn=()=>{ const q=document.getElementById("quiz"); return q&&!q.hidden; };

function apply(s){
  if(!snapshot()) return;
  seg=G?(s||""):""; if(G){ try{ localStorage.setItem(LS,seg); }catch(e){} }
  window.__f0b=view(); setBank();
  const keep=c=>seg?c===seg:(P13&&G?OWN.includes(c):true);
  const S=get("SUB"); if(S&&S0) S.splice(0,S.length,...S0.filter(x=>keep(String(x[0]).replace(/^X\./,"").slice(0,3))));
  const BL=get("BLOCKS"); if(BL&&BL0) BL.splice(0,BL.length,...BL0.filter(b=>keep(String(b.ex||b.code||"").slice(0,3))));
  const E=get("EXAMS"); if(E&&E0){ Object.keys(E).forEach(k=>delete E[k]); Object.keys(E0).forEach(k=>{ if(!seg||k===seg) E[k]=E0[k]; }); }
  // simulacro SENASA: la asignatura elegida
  ["senEx","senSubj"].forEach(id=>{ const el=document.getElementById(id); if(!el) return; [...el.options].forEach(o=>{ o.hidden=!!seg&&o.value!==seg; o.disabled=!!seg&&o.value!==seg; }); if(seg&&[...el.options].some(o=>o.value===seg)){ el.value=seg; el.dispatchEvent(new Event("change",{bubbles:true})); } });
  const R=document.documentElement; R.dataset.f0seg=seg; R.classList.toggle("f0p13",P13);
  notes();
  ["renderNotesMeta","renderSetup","renderMap","renderHist","renderSenOpts","fillLen"].forEach(f=>{ const fn=get(f); if(typeof fn==="function"){ try{ fn(); }catch(e){} } });
  bar();
}
// apuntes: cada bloque se asigna al código de su id (lo-/ch-/ex-) o al de la asignatura que lo encabeza
function notes(){
  const N=document.getElementById("notes"); if(!N||!G) return; let cur="";
  [...N.children].forEach(el=>{
    let c=""; const id=el.id||"", mm=/^(?:lo|ch|ex)-(?:X\.)?(\d{3})/.exec(id);
    if(mm) c=mm[1]; else if(el.matches("h2.subj")||el.classList.contains("examhead")||el.classList.contains("exsep")){ const t=/^\s*(\d{3})/.exec(el.textContent||""); if(t) c=t[1]; }
    if(el.matches("h2.subj")&&c) cur=c;
    if(!c) c=cur;
    el.classList.toggle("f0sub-off",!!c&&(seg?c!==seg:(P13&&!OWN.includes(c))));
  });
}
function pct(code){ const st=(get("stats")||(()=>null))(); if(!st||!st.q) return null; const qs=full().filter(q=>code3(q)===code); if(!qs.length) return null; let ok=0; qs.forEach(q=>{ const s=st.q[q[0]]; if(s&&s.last) ok++; }); return {ok,n:qs.length}; }
function bar(){
  let b=document.getElementById("f0sub");
  if(!on||!G){ if(b) b.remove(); return; }
  if(!b){ b=document.createElement("div"); b.id="f0sub"; b.setAttribute("role","radiogroup"); b.setAttribute("aria-label","Asignatura oficial");
    const nav=document.querySelector('nav[role="tablist"]'); (nav&&nav.parentNode?nav.parentNode.insertBefore(b,nav.nextSibling):document.body.prepend(b));
    b.addEventListener("click",e=>{ const x=e.target.closest("button[data-sub]"); if(!x) return; if(quizOn()){ flash("Termina o cierra el test antes de cambiar de asignatura."); return; } apply(x.dataset.sub); }); }
  const pill=(k,label,code)=>{ const p=code?pct(code):null, n=p?Math.round(100*p.ok/p.n):null;
    return `<button type="button" role="radio" data-sub="${k}" aria-checked="${seg===k}"${seg===k?' class="on"':""}><b>${code||""}</b>${code?" ":""}<span>${label}</span>${code?"":`<span class="f0sub-short">Todo</span>`}${n!=null?`<i title="${p.ok} de ${p.n} preguntas acertadas en su último intento">${n} %</i>`:""}</button>`; };
  b.innerHTML=`<span class="f0sub-tag" title="Solo lo ves tú (administrador)">Pruebas</span>`+pill("",G.all,"")+G.subs.map(s=>pill(s[0],s[1],s[0])).join("")+`<small class="f0sub-note"${seg?"":" hidden"}>Trial y Adaptativo siguen usando todo el bloque.</small><small class="f0sub-msg" hidden></small>`;
}
function flash(t){ const m=document.querySelector("#f0sub .f0sub-msg"); if(!m) return; m.textContent=t; m.hidden=false; clearTimeout(flash._t); flash._t=setTimeout(()=>{ m.hidden=true; },2600); }
const CSS=`#f0sub{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 4px;padding:6px;border:1px dashed rgba(127,211,255,.55);border-radius:12px;background:rgba(127,211,255,.06)}
#f0sub button{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(140,163,182,.45);background:transparent;color:inherit;border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;cursor:pointer;min-height:32px}
#f0sub button b{font-variant-numeric:tabular-nums;opacity:.85}
#f0sub button i{font-style:normal;font-size:11px;opacity:.7;padding-left:2px}
#f0sub button.on{background:#1D6FB0;border-color:#1D6FB0;color:#fff}
#f0sub button:focus-visible{outline:2px solid #7FD3FF;outline-offset:1px}
.f0sub-tag{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#7FD3FF;border:1px solid rgba(127,211,255,.6);border-radius:4px;padding:1px 5px}
.f0sub-note,.f0sub-msg{flex-basis:100%;font-size:12px;opacity:.75}
.f0sub-msg{color:#E8BF45;opacity:1}
.f0sub-off{display:none!important}
.f0sub-short{display:none}
html.f0p13 #hotCard,html.f0p13 #failCard{display:none!important}
@media (max-width:520px){#f0sub{gap:4px;padding:5px}#f0sub button{padding:4px 9px;font-size:12px}#f0sub button span,#f0sub button i,.f0sub-tag{display:none}#f0sub button .f0sub-short{display:inline}}`;
function css(){ if(document.getElementById("f0sub-css")) return; const s=document.createElement("style"); s.id="f0sub-css"; s.textContent=CSS; document.head.appendChild(s); }
function fromHash(){ const h=/(?:^|[#&])sub=(\d{3})/.exec(location.hash); return h&&G&&G.subs.some(s=>s[0]===h[1])?h[1]:null; }
function start(){
  let tries=0;
  (function wait(){
    if(snapshot()){ let s=null; if(G){ s=fromHash(); if(s==null){ try{ s=localStorage.getItem(LS)||""; }catch(e){ s=""; } } if(s&&!G.subs.some(x=>x[0]===s)) s=""; } apply(s); }
    else if(++tries<80) setTimeout(wait,150);
  })();
}
function set(v){
  if(v===on) return; on=v;
  if(on){ css(); P13=plan13();
    if(P13&&!XQ){ fetch("xq.json?v=2",{cache:"no-cache"}).then(r=>r.json()).then(j=>{ XQ=j; RECODE=(j.recode&&j.recode[PAGE])||{}; start(); }).catch(()=>{ P13=false; start(); }); }
    else start(); }
  else{ if(ready&&(seg||P13)) location.reload(); seg=""; bar(); }
}
addEventListener("message",e=>{ const d=e.data; if(!d) return;
  if(d.t==="f0-admin") set(!!d.on);
  else if(d.t==="f0-sub"&&on&&G){ if(!quizOn()) apply(d.sub||""); }
  else if(d.t==="f0-plan"&&on){ if(plan13()!==P13&&!quizOn()) location.reload(); } });
addEventListener("hashchange",()=>{ if(on&&G){ const s=fromHash(); if(s&&s!==seg) apply(s); } });
function init(){ set(isAdmin()); }
if(document.readyState==="complete") setTimeout(init,60); else addEventListener("load",()=>setTimeout(init,60));
// la sesión puede llegar después de cargar la página
let n=0; const iv=setInterval(()=>{ if(isAdmin()&&!on) set(true); if(++n>60) clearInterval(iv); },500);
})();
