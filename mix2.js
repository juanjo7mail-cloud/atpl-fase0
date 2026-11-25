/* ✈️ Entrenador de POH y SOP de la portada: listas de memoria y duelo de limitaciones.
   Usa las utilidades de mix.js (window.F0Mix._) y s/pohsop.json (tablas de los 3 aviones y listas del POH y del SOP),
   sacado de las páginas publicadas: no se inventa ningún dato. */
(function(){
"use strict";
const M=window.F0Mix&&window.F0Mix._; if(!M) return;
const {open,close,clock,esc,shuf,pick}=M;
const lsGet=(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const getJSON=(()=>{ const c={}; return u=>c[u]||(c[u]=fetch(u,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }).catch(e=>{ delete c[u]; throw e; })); })();
const CSS=`
.mxb .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.mxb .chips button{font:600 14px/1.25 var(--body);padding:9px 12px;border-radius:9px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;text-align:left}
.mxb .chips button:disabled{opacity:.35;cursor:default}
.mxb ol.seq{margin:6px 0;padding-left:26px} .mxb ol.seq li{margin:4px 0;padding:6px 8px;border-radius:8px;background:var(--bg);border:1px solid var(--line)}
.mxb ol.seq li.ok{border-color:var(--ok);background:var(--okbg)} .mxb ol.seq li.bad{border-color:var(--bad)}
.mxb .ac{display:inline-flex;gap:6px;flex-wrap:wrap}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);

/* =====================================================================
   ✈️ ENTRENADOR DE POH Y SOP: listas de memoria y duelo de limitaciones
   ===================================================================== */
const AC=[["cz","PS-28 Cruiser",1],["c1","Cessna 172",2],["pi","Piper PA-28",3]];
// listas del POH que no están en formato de lista en la página (copiadas tal cual de POH.3.1 y POH.3.3)
const EXTRA=[
 {t:"Fallo de alternador",src:"POH.3.1",ac:["c1","pi"],when:"Luz central del panel de anunciadores. Quedan unos 30 min de batería y el motor sigue funcionando.",steps:["Carga eléctrica: reducir al mínimo","Breaker del alternador: comprobar","Interruptor del alternador: OFF","Esperar 1 segundo","Interruptor del alternador: ON","Si el amperímetro sigue sin carga: alternador OFF","Aterrizar cuanto antes (unos 30 min de batería)"]},
 {t:"Fallo de motor en la carrera de despegue",src:"POH.3.3",ac:["cz"],when:"Fallo durante la carrera de despegue.",steps:["Throttle: IDLE","Frenos","Ignición: OFF"]},
 {t:"Fuego en vuelo",src:"POH.3.3",ac:["cz"],when:"Fuego de motor en vuelo.",steps:["Selector de combustible: OFF","Throttle: MAX","Cabin heater: PUSH OFF","Ignición: OFF (cuando se consuma el combustible del carburador)","60 KIAS","Aterrizaje de emergencia","Abandonar el avión"]},
 {t:"Fuego durante el arranque",src:"POH.3.3",ac:["cz"],when:"Fuego en el arranque, en tierra.",steps:["Selector de combustible: OFF","Throttle: MAX","Ignición: OFF","MASTER BAT y GEN: OFF","Abandonar el avión","Apagarlo o llamar a los bomberos"]},
 {t:"Arranque en vuelo",src:"POH.3.3",ac:["cz"],when:"Motor parado en vuelo con altura para intentarlo.",steps:["Equipos eléctricos innecesarios: OFF","MASTER BAT ON · MFD 1 ON · FUEL P ON","Selector: LEFT o RIGHT, el de más combustible","Throttle: IDLE","Ignición: START y, con el motor arrancando, BOTH","Con el motor en marcha: MASTER GEN ON · MFD 2 ON · AVIONICS ON · FUEL P OFF · otros interruptores ON"]},
 {t:"Fuego en el arranque (Piper)",src:"SOP.3.1",ac:["pi"],when:"Fuego en el arranque, en tierra.",steps:["Seguir arrancando","Mezcla: IDLE CUT-OFF","Gases: a fondo","Bomba y selector: OFF","Master: OFF"]}];
let PS=null;
const UN=/(KIAS|kt|kg|lbs|US gal|gal|L\b|°C|°|psi|bar|RPM|BHP|HP|in\b|ft|MHz|V\b|%|g\b|m\b|min|qts)/;
const typ=v=>{ v=String(v); const u=UN.exec(v); if(u) return u[1]; if(/^[\d.,\s–\-+\/·]+$/.test(v)) return "num"; return v.length<=18&&v===v.toUpperCase()?"cmd":"txt"; };
function memLists(ac){ const L=[]; PS.chk.filter(c=>c.kind==="em"||c.kind==="mem").forEach(c=>{ const it=c.cols[ac]; if(it&&it.length>=3) L.push({t:c.t,src:c.lo||"SOP",when:c.when.replace(/^Cuándo:\s*/,""),kind:c.kind,steps:it.map(([a,b])=>b?`${a}: ${b}`:a),pairs:it}); });
  EXTRA.filter(x=>x.ac.includes(ac)).forEach(x=>L.push({t:x.t,src:x.src,when:x.when,kind:"em",steps:x.steps,pairs:null})); return L; }
function duelBank(ac){ const ci=AC.find(a=>a[0]===ac)[2], out=[];
  const okV=v=>v&&v!=="—"&&v!=="-"&&v.length<=40;
  PS.tables.forEach(t=>{ if(!/Cruiser/.test(t.h[1])||!/172/.test(t.h[2])||!/Piper/.test(t.h[3])) return;
    t.rows.forEach((r,ri)=>{ const v=r[ci]; if(!okV(v)||!r[0]) return;
      const d=[...new Set([...[1,2,3].filter(j=>j!==ci).map(j=>r[j]),...t.rows.filter((x,j)=>j!==ri).map(x=>x[ci]).filter(x=>typ(x)===typ(v))].filter(x=>okV(x)&&x!==v))];
      if(d.length<2) return; out.push({q:`${esc(t.h[0])} · <b>${esc(r[0])}</b>`,a:v,d,src:t.lo||t.src}); }); });
  // valores de las listas normales y anormales del SOP
  PS.chk.forEach(c=>{ const it=c.cols[ac]; if(!it) return; it.forEach(([a,b])=>{ if(!okV(b)||!a||/^(ON|OFF|CHK|SET|CHECK|CLEAR|AS REQUIRED|COMPLETE|COMPLETED)$/i.test(b)) return;
    const d=[...new Set([...AC.filter(x=>x[0]!==ac).map(x=>((c.cols[x[0]]||[]).find(p=>p[0]===a)||[])[1]),...PS.chk.flatMap(cc=>(cc.cols[ac]||[]).filter(p=>p[0]===a).map(p=>p[1]))].filter(x=>okV(x)&&x!==b&&typ(x)===typ(b)))];
    if(d.length<2) return; out.push({q:`Lista «${esc(c.t)}» · <b>${esc(a)}</b>`,a:b,d,src:c.lo||"SOP"}); }); });
  return out; }
function pohsop(){
  // avión propio del entrenador; si en POH/SOP filtras un solo avión («f0:ac», lista compartida por esas páginas), arranca con ese
  const okAc=v=>AC.some(a=>a[0]===v); let ac=lsGet("f0:mxac",null), tmr=0;
  if(!okAc(ac)){ const sh=lsGet("f0:ac",null); ac=Array.isArray(sh)&&sh.length===1&&okAc(sh[0])?sh[0]:"cz"; }
  const body=open("✈️ Entrenador de POH y SOP","<p>Cargando…</p>",()=>clearTimeout(tmr));
  getJSON("s/pohsop.json").then(j=>{ PS=j; home(); }).catch(e=>{ body.innerHTML=`<p>No se han podido cargar las listas (${esc(e.message)}).</p>`; });
  function home(){ clearTimeout(tmr); clock(""); const ml=memLists(ac), db=duelBank(ac);
    body.innerHTML=`<p>Para los exámenes de <b>POH</b> y <b>SOP</b>. Los datos salen de las tablas y listas de tus apuntes, avión por avión.</p>
      <div class="row">${AC.map(a=>`<button type="button" class="btn2" data-ac="${a[0]}" aria-pressed="${a[0]===ac}">${a[1]}</button>`).join("")}</div>
      <div class="row" style="align-items:stretch"><button type="button" class="btn2 pri" data-m="mem" style="flex:1 1 220px;text-align:left">🧠 Listas de memoria<br><small style="font-weight:500">${ml.length} emergencias y listas de memoria: ordénalas y completa los valores</small></button><button type="button" class="btn2 pri" data-m="duel" style="flex:1 1 220px;text-align:left">⚔️ Duelo de limitaciones<br><small style="font-weight:500">10 preguntas rápidas · ${db.length} datos: pesos, velocidades, combustible, aceite y listas del SOP</small></button></div>
      <p class="muted" style="font-size:13px">Ojo: el SOP da para el Piper (Archer III) VFE 100 · VNO 122 · VNE 155 y el POH 103 · 126 · 160. Cada pregunta dice de qué documento sale. Estos POH no dan MZFW: solo MTOW y MLW (iguales en los tres aviones).</p>`;
    body.querySelectorAll("[data-ac]").forEach(b=>b.addEventListener("click",()=>{ ac=b.dataset.ac; lsSet("f0:mxac",ac); home(); }));
    body.querySelector('[data-m="mem"]').addEventListener("click",()=>memPick());
    body.querySelector('[data-m="duel"]').addEventListener("click",()=>duel()); }
  const acName=()=>AC.find(a=>a[0]===ac)[1];
  function memPick(){ const ml=memLists(ac);
    body.innerHTML=`<p><b>${acName()}</b> · elige una lista o deja que salga una al azar. Las de <b>emergencia</b> van primero.</p><div class="chips">${ml.map((l,i)=>`<button type="button" data-l="${i}">${l.kind==="em"?"🚨 ":"📋 "}${esc(l.t)}</button>`).join("")}</div><div class="row"><button type="button" class="btn2 pri" data-rand>Al azar</button><button type="button" class="btn2" data-back>← Volver</button></div>`;
    body.querySelectorAll("[data-l]").forEach(b=>b.addEventListener("click",()=>order(ml[+b.dataset.l])));
    body.querySelector("[data-rand]").addEventListener("click",()=>order(pick(ml.filter(l=>l.kind==="em").concat(ml))));
    body.querySelector("[data-back]").addEventListener("click",home); }
  function order(L){ const idx=shuf(L.steps.map((_,i)=>i)); let seq=[];
    const draw=()=>{ body.innerHTML=`<p><span class="chip">${esc(L.src)}</span> <b>${esc(L.t)}</b> · ${acName()}</p><p class="muted">${esc(L.when)}</p><p>Toca los pasos <b>en orden</b>, de memoria:</p><ol class="seq">${seq.map(i=>`<li>${esc(L.steps[i])}</li>`).join("")}</ol><div class="chips">${idx.map(i=>`<button type="button" data-s="${i}" ${seq.includes(i)?"disabled":""}>${esc(L.steps[i])}</button>`).join("")}</div><div class="row"><button type="button" class="btn2" data-undo ${seq.length?"":"disabled"}>↶ Deshacer</button><button type="button" class="btn2 pri" data-chk ${seq.length===L.steps.length?"":"disabled"}>Comprobar</button></div>`;
      body.querySelectorAll("[data-s]").forEach(b=>b.addEventListener("click",()=>{ seq.push(+b.dataset.s); draw(); }));
      body.querySelector("[data-undo]").addEventListener("click",()=>{ seq.pop(); draw(); });
      body.querySelector("[data-chk]").addEventListener("click",check); };
    const check=()=>{ const ok=seq.filter((s,i)=>s===i).length;
      body.innerHTML=`<p><b>${esc(L.t)}</b> · ${acName()}</p><div class="row"><span class="big" style="color:${ok===L.steps.length?"var(--ok)":"var(--bad)"}">${ok}/${L.steps.length}</span><span class="muted">pasos en su sitio</span></div><p>Orden correcto:</p><ol class="seq">${L.steps.map((s,i)=>`<li class="${seq[i]===i?"ok":"bad"}">${esc(s)}${seq[i]!==i?` <small class="muted">· pusiste: ${esc(L.steps[seq[i]])}</small>`:""}</li>`).join("")}</ol><div class="row">${L.pairs?`<button type="button" class="btn2 pri" data-fill>Completa los valores →</button>`:""}<button type="button" class="btn2" data-again>Repetir</button><button type="button" class="btn2" data-other>Otra lista</button></div>`;
      const f=body.querySelector("[data-fill]"); if(f) f.addEventListener("click",()=>fill(L));
      body.querySelector("[data-again]").addEventListener("click",()=>order(L)); body.querySelector("[data-other]").addEventListener("click",memPick); };
    draw(); }
  function fill(L){ const vals=[...new Set(PS.chk.flatMap(c=>Object.values(c.cols).flat().map(p=>p[1])).filter(v=>v&&v.length<=40))];
    const items=shuf(L.pairs.map((p,i)=>({p,i})).filter(x=>x.p[1]&&!/^(ON|OFF)$/.test(x.p[1]))).slice(0,5); let i=0, ok=0, asked=0;
    if(!items.length){ memPick(); return; }
    const ask=()=>{ const it=items[i]; if(!it){ body.innerHTML=`<p><b>${esc(L.t)}</b></p><div class="row"><span class="big">${ok}/${asked}</span><span class="muted">valores correctos</span></div><div class="row"><button type="button" class="btn2 pri" data-other>Otra lista</button><button type="button" class="btn2" data-home>Menú</button></div>`; body.querySelector("[data-other]").addEventListener("click",memPick); body.querySelector("[data-home]").addEventListener("click",home); return; }
      const v0=it.p[1], key=it.p[0];
      const same=[...new Set(PS.chk.flatMap(c=>Object.values(c.cols).flat().filter(p=>p[0]===key).map(p=>p[1])))].filter(v=>v&&v!==v0);
      const like=shuf(vals.filter(v=>v!==v0&&typ(v)===typ(v0)&&!same.includes(v)));
      const opts=shuf([v0,...shuf(same).concat(like).slice(0,2)]);
      if(opts.length<3){ i++; ask(); return; }
      body.innerHTML=`<p><b>${esc(L.t)}</b> · ${acName()} · paso ${it.i+1}</p><div class="qt">${esc(it.p[0])}: <b>¿…?</b></div>${opts.map(o=>`<button type="button" class="opt" data-v="${esc(o)}">${esc(o)}</button>`).join("")}<div data-exp></div>`;
      body.querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click",()=>{ if(b.disabled) return; asked++; const good=b.dataset.v===it.p[1]; if(good) ok++;
        body.querySelectorAll("[data-v]").forEach(x=>{ x.disabled=true; if(x.dataset.v===it.p[1]) x.classList.add("ok"); else if(x===b) x.classList.add("bad"); });
        body.querySelector("[data-exp]").innerHTML=`<div class="row"><button type="button" class="btn2 pri" data-n>Siguiente →</button></div>`; body.querySelector("[data-n]").addEventListener("click",()=>{ i++; ask(); }); })); };
    ask(); }
  function duel(){ const B=shuf(duelBank(ac)).slice(0,10); let i=0, ok=0, timed=lsGet("f0:duel10",true), t1=0; const wrong=[];
    const ask=()=>{ clearTimeout(tmr); const q=B[i]; if(!q){ end(); return; } const opts=shuf([q.a,...shuf(q.d).slice(0,2)]); t1=Date.now();
      body.innerHTML=`<div class="row" style="justify-content:space-between"><span class="chip">${esc(q.src)}</span><span class="muted">${i+1} / ${B.length} · aciertos ${ok}</span></div>${timed?`<div class="bar" style="margin:4px 0 8px"><i data-left style="width:100%;background:var(--warn)"></i></div>`:""}<div class="qt">${acName()} · ${q.q}</div>${opts.map(o=>`<button type="button" class="opt" data-v="${esc(o)}">${esc(o)}</button>`).join("")}<div data-exp></div>`;
      body.querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click",()=>answer(b.dataset.v,b)));
      if(timed){ const run=()=>{ const left=10-(Date.now()-t1)/1000, bar=body.querySelector("[data-left]"); if(bar) bar.style.width=Math.max(0,left*10)+"%"; if(left<=0) answer(null,null); else tmr=setTimeout(run,100); }; run(); } };
    const answer=(v,b)=>{ const q=B[i]; if(q.done) return; q.done=1; clearTimeout(tmr); const good=v===q.a; if(good) ok++; else wrong.push(q);
      body.querySelectorAll("[data-v]").forEach(x=>{ x.disabled=true; if(x.dataset.v===q.a) x.classList.add("ok"); else if(x===b) x.classList.add("bad"); });
      body.querySelector("[data-exp]").innerHTML=`<div class="exp"><b>${good?"Correcto":v==null?"Se acabó el tiempo":"No"}</b> · ${acName()}: <b>${esc(q.a)}</b></div><div class="row"><button type="button" class="btn2 pri" data-n>${i<B.length-1?"Siguiente →":"Resultado"}</button></div>`;
      body.querySelector("[data-n]").addEventListener("click",()=>{ i++; ask(); }); body.querySelector("[data-n]").focus(); };
    const end=()=>{ clearTimeout(tmr); body.innerHTML=`<div class="row"><span class="big">${ok}/${B.length}</span><span class="muted">${acName()} · ${ok>=8?"¡muy bien!":"repasa las tablas del POH y del SOP"}</span></div>${wrong.length?`<p>Para repasar:</p><ul>${wrong.map(q=>`<li>${q.q}: <b>${esc(q.a)}</b> <small class="muted">(${esc(q.src)})</small></li>`).join("")}</ul>`:""}<div class="row"><button type="button" class="btn2 pri" data-again>Otro duelo</button><button type="button" class="btn2" data-home>Menú</button></div>`;
      body.querySelector("[data-again]").addEventListener("click",duel); body.querySelector("[data-home]").addEventListener("click",home); };
    body.innerHTML=`<p><b>Duelo de limitaciones</b> · ${acName()}. 10 preguntas sobre pesos, velocidades, combustible, aceite y valores de las listas del SOP.</p><div class="row"><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-t ${timed?"checked":""}> ⏱ 10 s por pregunta</label></div><div class="row"><button type="button" class="btn2 pri" data-go>Empezar</button><button type="button" class="btn2" data-home>← Volver</button></div>`;
    body.querySelector("[data-t]").addEventListener("change",e=>{ timed=e.target.checked; lsSet("f0:duel10",timed); });
    body.querySelector("[data-go]").addEventListener("click",ask); body.querySelector("[data-home]").addEventListener("click",home); }
}

/* ---------- montaje en la portada ---------- */
function mount(){ const bar=document.querySelector(".mxbar"); if(!bar||bar.querySelector('[data-a="pohsop"]')) return;
  const p=document.createElement("button"); p.type="button"; p.dataset.a="pohsop"; p.title="Listas de memoria y duelo de limitaciones"; p.innerHTML=`<span class="ic" aria-hidden="true">✈️</span><b><span class="lg">POH y SOP</span><span class="sh">POH/SOP</span></b>`;
  const sim=bar.querySelector('[data-a="sim"]'); bar.insertBefore(p,sim?sim.nextSibling:null); p.addEventListener("click",pohsop); }
window.F0Mix.pohsop=pohsop;
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
})();
