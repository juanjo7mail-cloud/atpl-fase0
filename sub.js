/* Asignaturas oficiales SENASA dentro de las páginas agrupadas (AGK 021·022, Performance 031·032·033, Navegación 061·062).
   EN PRUEBAS: solo se activa para la cuenta de administrador (bandera F0_ADMIN que pone la app). Para el resto de alumnos no hace nada.
   No duplica nada: filtra el banco, el temario y los apuntes por el código oficial que ya lleva cada pregunta y cada tema. */
(function(){
"use strict";
const GROUPS={
  "021":{all:"Todo AGK", subs:[["021","Sistemas y motor"],["022","Instrumentación"]]},
  "031":{all:"Todo Performance", subs:[["031","Masa y centrado"],["032","Performance"],["033","Planificación"]]},
  "061":{all:"Todo Navegación", subs:[["061","Navegación general"],["062","Radionavegación"]]}
};
const m=/(\d{3})\.html/.exec(location.pathname), PAGE=m&&m[1], G=PAGE&&GROUPS[PAGE];
if(!G) return;
const LS="f0:sub:"+PAGE;
const isAdmin=()=>{ try{ return window.parent!==window&&!!window.parent.F0_ADMIN; }catch(e){ return false; } };
const code3=c=>String(c||"").replace(/^X\./,"").slice(0,3);
let on=false, seg="", B0=null, S0=null, BL0=null, E0=null, ready=false;
const has=n=>{ try{ return typeof window.eval(n)!=="undefined"; }catch(e){ return false; } };
const get=n=>{ try{ return window.eval(n); }catch(e){ return undefined; } };
const setBank=a=>{ try{ window.eval("BANK=__f0b"); }catch(e){} };

function snapshot(){
  if(ready) return true;
  const bank=get("BANK"); if(!bank||!bank.length) return false;
  B0=bank.slice(); const S=get("SUB"); S0=S?S.slice():null; const BL=get("BLOCKS"); BL0=BL?BL.slice():null; const E=get("EXAMS"); E0=E?Object.assign({},E):null;
  // Trial y Adaptativo siempre con todo el bloque, como hasta ahora
  const sel=get("selectQuestions");
  if(typeof sel==="function"&&!sel.__f0sub){
    const wrap=function(mode){ if(seg&&(mode==="trial"||mode==="adaptive")){ const cur=get("BANK"); window.__f0b=full(); setBank(); try{ return sel.apply(this,arguments); } finally{ window.__f0b=cur; setBank(); } } return sel.apply(this,arguments); };
    wrap.__f0sub=1; window.__f0sel=wrap; try{ window.eval("selectQuestions=__f0sel"); }catch(e){}
  }
  // si la página reconstruye el banco (progreso cargado, preguntas nuevas), se vuelve a tomar entero y se reaplica el filtro
  const bb=get("buildBank");
  if(typeof bb==="function"&&!bb.__f0sub){
    const wb=function(){ const r=bb.apply(this,arguments); try{ const nb=get("BANK")||[]; if(nb.length){ const ids=new Set(nb.map(q=>q[0])); B0=nb.concat(B0.filter(q=>!ids.has(q[0]))); } if(seg){ window.__f0b=B0.filter(q=>code3(q[1])===seg); setBank(); } }catch(e){} return r; };
    wb.__f0sub=1; window.__f0bb=wb; try{ window.eval("buildBank=__f0bb"); }catch(e){}
  }
  ready=true; return true;
}
// el banco puede crecer (preguntas generadas): se suman al original antes de filtrar
function full(){ const cur=get("BANK")||[], ids=new Set(B0.map(q=>q[0])); cur.forEach(q=>{ if(!ids.has(q[0])){ B0.push(q); ids.add(q[0]); } }); return B0.slice(); }
const quizOn=()=>{ const q=document.getElementById("quiz"); return q&&!q.hidden; };

function apply(s){
  if(!snapshot()) return;
  seg=s||""; try{ localStorage.setItem(LS,seg); }catch(e){}
  window.__f0b=seg?full().filter(q=>code3(q[1])===seg):full(); setBank();
  const S=get("SUB"); if(S&&S0) S.splice(0,S.length,...(seg?S0.filter(x=>code3(x[0])===seg):S0));
  const BL=get("BLOCKS"); if(BL&&BL0) BL.splice(0,BL.length,...(seg?BL0.filter(b=>code3(b.ex||b.code)===seg):BL0));
  const E=get("EXAMS"); if(E&&E0){ Object.keys(E).forEach(k=>delete E[k]); Object.keys(E0).forEach(k=>{ if(!seg||k===seg) E[k]=E0[k]; }); }
  // simulacro SENASA: la asignatura elegida
  ["senEx","senSubj"].forEach(id=>{ const el=document.getElementById(id); if(!el) return; [...el.options].forEach(o=>{ o.hidden=!!seg&&o.value!==seg; o.disabled=!!seg&&o.value!==seg; }); if(seg&&[...el.options].some(o=>o.value===seg)){ el.value=seg; el.dispatchEvent(new Event("change",{bubbles:true})); } });
  notes();
  ["renderNotesMeta","renderSetup","renderMap","renderHist","renderSenOpts","fillLen"].forEach(f=>{ const fn=get(f); if(typeof fn==="function"){ try{ fn(); }catch(e){} } });
  bar();
}
// apuntes: cada bloque se asigna al código de su id (lo-/ch-/ex-) o al de la asignatura que lo encabeza
function notes(){
  const N=document.getElementById("notes"); if(!N) return; let cur="";
  [...N.children].forEach(el=>{
    let c=""; const id=el.id||"", mm=/^(?:lo|ch|ex)-(?:X\.)?(\d{3})/.exec(id);
    if(mm) c=mm[1]; else if(el.matches("h2.subj")||el.classList.contains("examhead")||el.classList.contains("exsep")){ const t=/^\s*(\d{3})/.exec(el.textContent||""); if(t) c=t[1]; }
    if(el.matches("h2.subj")&&c) cur=c;
    if(!c) c=cur;
    el.classList.toggle("f0sub-off",!!seg&&!!c&&c!==seg);
  });
}
function pct(code){ const st=(get("stats")||(()=>null))(); if(!st||!st.q) return null; const qs=B0.filter(q=>code3(q[1])===code); if(!qs.length) return null; let ok=0, seen=0; qs.forEach(q=>{ const s=st.q[q[0]]; if(s){ seen++; if(s.last) ok++; } }); return {ok,seen,n:qs.length}; }
function bar(){
  let b=document.getElementById("f0sub");
  if(!on){ if(b) b.remove(); document.documentElement.classList.remove("f0sub-on"); return; }
  if(!b){ b=document.createElement("div"); b.id="f0sub"; b.setAttribute("role","radiogroup"); b.setAttribute("aria-label","Asignatura oficial");
    const nav=document.querySelector('nav[role="tablist"]'); (nav&&nav.parentNode?nav.parentNode.insertBefore(b,nav.nextSibling):document.body.prepend(b));
    b.addEventListener("click",e=>{ const x=e.target.closest("button[data-sub]"); if(!x) return; if(quizOn()){ flash("Termina o cierra el test antes de cambiar de asignatura."); return; } apply(x.dataset.sub); }); }
  document.documentElement.classList.add("f0sub-on");
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
@media (max-width:520px){#f0sub{gap:4px;padding:5px}#f0sub button{padding:4px 9px;font-size:12px}#f0sub button span,#f0sub button i,.f0sub-tag{display:none}#f0sub button .f0sub-short{display:inline}}
.f0sub-short{display:none}`;
function css(){ if(document.getElementById("f0sub-css")) return; const s=document.createElement("style"); s.id="f0sub-css"; s.textContent=CSS; document.head.appendChild(s); }
function fromHash(){ const h=/(?:^|[#&])sub=(\d{3})/.exec(location.hash); return h&&G.subs.some(s=>s[0]===h[1])?h[1]:null; }
function set(v){
  if(v===on) return; on=v;
  if(on){ css(); let tries=0; (function wait(){ if(snapshot()){ let s=fromHash(); if(s==null){ try{ s=localStorage.getItem(LS)||""; }catch(e){ s=""; } } if(s&&!G.subs.some(x=>x[0]===s)) s=""; apply(s); } else if(++tries<80) setTimeout(wait,150); })(); }
  else{ if(ready&&seg) apply(""); seg=""; bar(); }
}
addEventListener("message",e=>{ const d=e.data; if(d&&d.t==="f0-admin") set(!!d.on); });
addEventListener("hashchange",()=>{ if(on){ const s=fromHash(); if(s&&s!==seg) apply(s); } });
function init(){ set(isAdmin()); }
if(document.readyState==="complete") setTimeout(init,60); else addEventListener("load",()=>setTimeout(init,60));
// la sesión puede llegar después de cargar la página
let n=0; const iv=setInterval(()=>{ if(isAdmin()&&!on) set(true); if(++n>40) clearInterval(iv); },500);
})();
