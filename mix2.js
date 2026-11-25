/* Quinto paquete de la portada: 🔥 Sesión rápida de 15 min, ✈️ Entrenador de POH y SOP y la barra de constancia
   (racha, objetivo diario y alas de dominio). Usa las utilidades de mix.js (window.F0Mix._) y estos datos:
   s/s15.json   → tarjetas (Clave, Truco, Trampa) y esquemas interactivos de cada asignatura
   s/pohsop.json → tablas de los 3 aviones y listas de memoria del POH y del SOP
   s/mixbank.json → preguntas de todas las asignaturas (también POH y SOP)
   Todo sale de las páginas publicadas; no se inventa ningún dato. */
(function(){
"use strict";
const M=window.F0Mix&&window.F0Mix._; if(!M) return;
const {open,close,clock,mmss,esc,shuf,pick,loadBank,failedIds,tally}=M;
const G=n=>{ try{ return Function("return typeof "+n+"!=='undefined'?"+n+":undefined")(); }catch(e){ return undefined; } };   // globales del hub (const/let de index.html)
const today=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Madrid"});
const dayOf=d=>new Date(d).toLocaleDateString("sv-SE",{timeZone:"Europe/Madrid"});
const lsGet=(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const getJSON=(()=>{ const c={}; return u=>c[u]||(c[u]=fetch(u,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }).catch(e=>{ delete c[u]; throw e; })); })();
const CSS=`
.mxeng{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px;margin:4px 0 10px}
.mxeng>div{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);min-width:0}
.mxeng .big2{font:800 26px/1 var(--display);min-width:1.6em;text-align:center}
.mxeng small{display:block;color:var(--muted);font-size:12px;line-height:1.25}
.mxeng b{font:700 15px/1.15 var(--display);letter-spacing:.02em}
.mxeng .gbar{height:7px;border-radius:5px;background:var(--line);overflow:hidden;margin-top:5px}
.mxeng .gbar i{display:block;height:100%;background:var(--accent);transition:width .4s}
.mxeng button.gl{font:600 12px var(--body);border:0;background:none;color:var(--accent);cursor:pointer;padding:0;margin-left:4px;text-decoration:underline}
.mxeng .wings{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}
.mxeng .wings span{display:inline-flex;flex-direction:column;align-items:center;font:700 9px/1 var(--display);color:var(--muted);width:30px}
.mxeng .wings svg{width:28px;height:14px}
.mxbar button.hot{border-color:var(--accent);background:var(--accentbg)}
.mxb .card2{border:1.5px solid var(--line);border-radius:12px;padding:14px;background:var(--bg);min-height:120px}
.mxb .card2 .lo{font:700 11px/1 var(--display);letter-spacing:.1em;color:var(--muted);text-transform:uppercase}
.mxb .card2 h4{margin:6px 0 8px;font:700 17px/1.25 var(--display)}
.mxb .card2 .bk{font-size:15px;line-height:1.5}
.mxb .card2 .bk ul{margin:4px 0;padding-left:20px}
.mxb .steps3{display:flex;gap:6px;margin:0 0 10px}
.mxb .steps3 span{flex:1;text-align:center;font:700 12px/1 var(--display);letter-spacing:.06em;padding:7px 4px;border-radius:8px;background:var(--line);color:var(--muted)}
.mxb .steps3 span.on{background:var(--accent);color:#fff}
.mxb .steps3 span.ok{background:var(--okbg);color:var(--ok)}
.mxb iframe.s15f{width:100%;height:min(64vh,560px);border:1px solid var(--line);border-radius:10px;background:#fff}
.mxb .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.mxb .chips button{font:600 14px/1.25 var(--body);padding:9px 12px;border-radius:9px;border:1.5px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer;text-align:left}
.mxb .chips button:disabled{opacity:.35;cursor:default}
.mxb ol.seq{margin:6px 0;padding-left:26px} .mxb ol.seq li{margin:4px 0;padding:6px 8px;border-radius:8px;background:var(--bg);border:1px solid var(--line)}
.mxb ol.seq li.ok{border-color:var(--ok);background:var(--okbg)} .mxb ol.seq li.bad{border-color:var(--bad)}
.mxb .ac{display:inline-flex;gap:6px;flex-wrap:wrap}
@media (max-width:560px){
 .mxeng{grid-template-columns:1fr 1fr;gap:8px}
 .mxeng>div{padding:8px 10px;gap:8px}
 .mxeng>div:nth-child(3){grid-column:1/-1}
 .mxeng .big2{font-size:20px;min-width:1.2em}
 .mxeng>div:nth-child(1) small,.mxeng>div:nth-child(3) small{display:none}
 .mxbar{grid-template-columns:1fr 1fr;gap:8px}
 .mxbar button{padding:9px 10px;gap:8px}
 .mxbar button .ic{font-size:20px}
 .mxbar button b{font-size:15px}
 .mxbar button small{display:none}
 .mxbar button.hot{grid-column:1/-1}
 .mxbar button.hot small{display:block}
}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);

/* =====================================================================
   Barra de constancia: racha · objetivo diario · alas de dominio
   ===================================================================== */
const WING=on=>`<svg viewBox="0 0 56 28" aria-hidden="true"><path d="M28 14c-6-9-17-11-27-9 6 2 9 5 11 8-3 0-6 1-9 2 6 1 10 3 13 6 3-3 7-5 12-7z" fill="${on?"#E8BF45":"none"}" stroke="${on?"#B8901E":"currentColor"}" stroke-width="1.6"/><path d="M28 14c6-9 17-11 27-9-6 2-9 5-11 8 3 0 6 1 9 2-6 1-10 3-13 6-3-3-7-5-12-7z" fill="${on?"#E8BF45":"none"}" stroke="${on?"#B8901E":"currentColor"}" stroke-width="1.6"/><circle cx="28" cy="15" r="3.4" fill="${on?"#B8901E":"currentColor"}"/></svg>`;
function todayCount(){ const STATE=G("STATE")||{}, SUBJ=G("SUBJ")||[], d=today(); let n=0;
  SUBJ.forEach(s=>{ const a=(STATE[s.k]||{}).attempts; if(Array.isArray(a)) a.forEach(x=>{ if(x&&!x.ignore&&x.total>0&&x.date&&dayOf(x.date)===d) n+=x.total; }); });
  const o=lsGet("f0:mxday",null); if(o&&o.d===d) n+=o.n||0; return n; }
function eng(){ const box=document.querySelector(".mxeng"); if(!box) return; const SUBJ=G("SUBJ")||[], summary=G("summary"), streakInfo=G("streakInfo");
  let sk={count:0,today:false}; try{ if(streakInfo) sk=streakInfo(); }catch(e){}
  const goal=lsGet("f0:goal",50), n=todayCount(), pc=Math.min(100,Math.round(n/goal*100));
  const W=SUBJ.map(s=>{ let m={n:0,avg5:null}; try{ m=summary(s.k); }catch(e){} return {k:s.k,code:s.code.split("·")[0],on:m.n>=5&&m.avg5>=85,avg:m.avg5,n:m.n}; }), won=W.filter(w=>w.on).length;
  box.innerHTML=`<div title="Días seguidos con 10 o más preguntas (se perdona 1 día de descanso por semana)"><span class="big2">🔥</span><span><b>${sk.count} ${sk.count===1?"día":"días"} de racha</b><small>${sk.today?"Hoy ya cuenta ✓":"Hoy aún no: haz 10 preguntas para sumar"}</small></span></div>
   <div><span class="big2">📊</span><span style="flex:1;min-width:0"><b>Hoy: ${n}/${goal} preguntas</b><button type="button" class="gl" data-goal aria-label="Cambiar el objetivo diario">cambiar</button><small>${n>=goal?"¡Objetivo cumplido!":"Te faltan "+(goal-n)}</small><div class="gbar"><i style="width:${pc}%"></i></div></span></div>
   <div><span class="big2">🪽</span><span style="min-width:0"><b>Alas de dominio: ${won}/${W.length}</b><small>Asignatura con 85 % o más de media en sus 5 últimos tests</small><div class="wings">${W.map(w=>`<span title="${w.code}: ${w.n?`media 5 ${w.avg} % · ${w.n} tests`:"sin tests"}${w.on?" · ¡alas!":w.n<5?" · faltan tests":""}" style="${w.on?"color:var(--ink)":""}">${WING(w.on)}${esc(w.code)}</span>`).join("")}</div></span></div>`;
  box.querySelector("[data-goal]").addEventListener("click",()=>{ const G2=[20,30,50,80,100,150], i=G2.indexOf(goal); lsSet("f0:goal",G2[(i+1)%G2.length]); eng(); }); }

/* =====================================================================
   🔥 SESIÓN RÁPIDA DE 15 MINUTOS: 5 tarjetas · 1 esquema · 10 preguntas
   ===================================================================== */
const NAME=k=>{ const s=(G("SUBJ")||[]).find(x=>x.k===k); return s?`${s.code} · ${s.short}`:k; };
function weakest(){ const SUBJ=G("SUBJ")||[], summary=G("summary"); const L=SUBJ.map(s=>{ let m={n:0,avg5:null}; try{ m=summary(s.k); }catch(e){} return {k:s.k,m,f:failedIds(s.k).size}; });
  const low=L.filter(x=>x.m.n>0&&x.m.avg5<80).sort((a,b)=>a.m.avg5-b.m.avg5||b.f-a.f);
  if(low.length) return {k:low[0].k,why:`media de tus 5 últimos tests: ${low[0].m.avg5} %`,list:L};
  const fl=L.filter(x=>x.f>0).sort((a,b)=>b.f-a.f); if(fl.length) return {k:fl[0].k,why:`${fl[0].f} preguntas falladas pendientes`,list:L};
  const nw=L.slice().sort((a,b)=>a.m.n-b.m.n)[0]; return {k:nw.k,why:nw.m.n?`la que menos has practicado (${nw.m.n} tests)`:"aún no has hecho tests de ella",list:L}; }
const pre=(a,b)=>{ let i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++; return i; };
function session(){
  let t0=0, tmr=0, alive=true;
  const body=open("🔥 Sesión rápida · 15 min","<p>Preparando tu sesión…</p>",()=>{ alive=false; clearTimeout(tmr); }); const tick=()=>{ if(!alive) return; const left=900-(Date.now()-t0)/1000; clock(left>0?mmss(left):"+"+mmss(-left)); tmr=setTimeout(tick,1000); };
  const W=weakest(), k=W.k;
  Promise.all([getJSON("s/s15.json"),loadBank()]).then(([S15,BANK])=>{
    const byId={}; Object.keys(BANK.subj).forEach(pg=>BANK.subj[pg].forEach(q=>{ byId[q[0]]={q,pg}; }));
    const fl=[...failedIds(k)], loCount={}; fl.forEach(id=>{ const x=byId[id]; if(x&&x.q[1]) loCount[x.q[1]]=(loCount[x.q[1]]||0)+1; });
    const topLO=Object.keys(loCount).sort((a,b)=>loCount[b]-loCount[a]);
    const P=S15.p[k]||{c:[],v:[]};
    // 1 · cinco tarjetas: primero de los temas que más fallas, una por tema
    const score=c=>topLO.length?Math.max(...topLO.slice(0,6).map((lo,i)=>pre(lo,c[0])>=6?(10-i)+(pre(lo,c[0])>=9?3:0):0)):0;
    const cards=[], usedLO=new Set(); shuf(P.c).sort((a,b)=>score(b)-score(a)).forEach(c=>{ if(cards.length<5&&!usedLO.has(c[0])){ cards.push(c); usedLO.add(c[0]); } });
    shuf(P.c).forEach(c=>{ if(cards.length<5&&!cards.includes(c)) cards.push(c); });
    // 2 · un esquema: el que más se acerca a tus fallos
    const vz=P.v.length?P.v.slice().sort((a,b)=>Math.max(0,...topLO.slice(0,5).map(lo=>pre(lo,b[0])))-Math.max(0,...topLO.slice(0,5).map(lo=>pre(lo,a[0])))||Math.random()-.5)[0]:null;
    // 3 · diez preguntas de tus fallos: asignatura floja primero, luego las de menos del 80 %
    const order=[k,...W.list.filter(x=>x.k!==k&&x.m.n>0&&x.m.avg5<80).sort((a,b)=>a.m.avg5-b.m.avg5).map(x=>x.k),...W.list.filter(x=>x.k!==k&&!(x.m.n>0&&x.m.avg5<80)).map(x=>x.k)];
    let qs=[]; order.forEach(pg=>{ if(qs.length>=10) return; shuf([...failedIds(pg)]).forEach(id=>{ const x=byId[id]; if(qs.length<10&&x&&x.pg===pg) qs.push({...x,fail:true}); }); });
    if(qs.length<10){ const pool=(BANK.subj[k]||[]).filter(q=>!qs.some(x=>x.q[0]===q[0])); const near=pool.filter(q=>topLO.slice(0,4).some(lo=>pre(lo,q[1])>=6)); shuf(near).concat(shuf(pool)).forEach(q=>{ if(qs.length<10&&!qs.some(x=>x.q[0]===q[0])) qs.push({q,pg:k,fail:false}); }); }
    qs=qs.map(x=>({...x,ord:shuf(x.q[3].map((_,j)=>j)),ans:null}));
    const head=s=>`<div class="steps3"><span class="${s>1?"ok":"on"}">1 · Tarjetas</span><span class="${s>2?"ok":s===2?"on":""}">2 · Esquema</span><span class="${s===3?"on":""}">3 · 10 preguntas</span></div>`;
    body.innerHTML=`<p>Tu asignatura más floja ahora es <b>${esc(NAME(k))}</b> (${esc(W.why)}).</p><p>Sesión guiada en 3 pasos, unos 15 minutos:</p><ol><li><b>5 tarjetas clave</b> de ${esc(NAME(k))}${topLO.length?", de los temas que más fallas":""}.</li><li><b>1 esquema interactivo</b>${vz?`: «${esc(vz[2])}»`:""}.</li><li><b>10 preguntas</b> ${qs.filter(x=>x.fail).length?`de tus fallos (${qs.filter(x=>x.fail).length} de ellas ya las fallaste)`:"de esta asignatura"}.</li></ol><div class="row"><button type="button" class="btn2 pri" data-go>Empezar</button></div>`;
    body.querySelector("[data-go]").addEventListener("click",()=>{ t0=Date.now(); tick(); step1(0); });
    function step1(i){ const c=cards[i]; if(!c){ step2(); return; }
      body.innerHTML=`${head(1)}<p class="muted">Tarjeta ${i+1} de ${cards.length}. Intenta recordarla antes de darle la vuelta.</p><div class="card2"><div class="lo">${esc(c[0])} · ${esc(c[2])}</div><h4>${esc(c[1])}</h4><div class="bk" data-bk hidden>${c[4]}</div></div><div class="row" data-r1><button type="button" class="btn2 pri" data-flip>Darle la vuelta</button></div>`;
      body.querySelector("[data-flip]").addEventListener("click",()=>{ body.querySelector("[data-bk]").hidden=false; const r=body.querySelector("[data-r1]"); r.innerHTML=`<button type="button" class="btn2" data-n>La sabía ✓</button><button type="button" class="btn2" data-n>Repasar ✗</button>`; r.querySelectorAll("[data-n]").forEach(b=>b.addEventListener("click",()=>step1(i+1))); }); }
    function step2(){ if(!vz){ step3(0); return; }
      body.innerHTML=`${head(2)}<p><b>${esc(vz[2])}</b> <span class="muted">(${esc(vz[0])})</span>. Juega con él un par de minutos: mueve los mandos y usa «Ponme a prueba» si lo tiene.</p><iframe class="s15f" title="Esquema interactivo" src="s/${k}.html"></iframe><div class="row"><button type="button" class="btn2 pri" data-n>Continuar · 10 preguntas →</button></div>`;
      const f=body.querySelector("iframe");
      f.addEventListener("load",()=>{ try{ f.contentWindow.postMessage({t:"f0-cmd",tab:"notes"},"*"); }catch(e){}
        setTimeout(()=>{ try{ const d=f.contentDocument, root=d.getElementById("notes")||d.body, det=root.querySelectorAll("details")[vz[1]]; if(!det) return; for(let x=det;x;x=x.parentElement) if(x.tagName==="DETAILS") x.open=true;
          const v=det.querySelector(vz[3].map(n=>`.f0viz[data-viz="${n}"],.f0lab[data-lab="${n}"]`).join(","))||det; v.scrollIntoView({block:"start"}); }catch(e){} },500); });
      body.querySelector("[data-n]").addEventListener("click",()=>step3(0)); }
    function step3(i){ const q=qs[i]; if(!q){ finish(); return; }
      body.innerHTML=`${head(3)}<div class="row" style="justify-content:space-between"><span class="chip">${esc(NAME(q.pg))}${q.fail?" · la fallaste":""}</span><span class="muted">${i+1} / ${qs.length}</span></div><div class="qt">${esc(q.q[2])}</div>${q.ord.map(j=>`<button type="button" class="opt" data-o="${j}">${esc(q.q[3][j])}</button>`).join("")}<div data-exp></div>`;
      body.querySelectorAll("[data-o]").forEach(b=>b.addEventListener("click",()=>{ if(q.ans!=null) return; q.ans=+b.dataset.o; const ok=q.ans===0;
        body.querySelectorAll("[data-o]").forEach(x=>{ const v=+x.dataset.o; x.disabled=true; if(v===0) x.classList.add("ok"); else if(v===q.ans) x.classList.add("bad"); });
        body.querySelector("[data-exp]").innerHTML=`<div class="exp"><b>${ok?"Correcto":"No"}</b>${q.q[4]?" · "+esc(q.q[4]):""}</div><div class="row"><button type="button" class="btn2 pri" data-n>${i<qs.length-1?"Siguiente →":"Terminar"}</button></div>`;
        body.querySelector("[data-n]").addEventListener("click",()=>step3(i+1)); body.querySelector("[data-n]").focus(); })); }
    async function finish(){ alive=false; clearTimeout(tmr); const ok=qs.filter(q=>q.ans===0).length, el=(Date.now()-t0)/1000, fixed=qs.filter(q=>q.fail&&q.ans===0).length;
      body.innerHTML=`<div class="row"><span class="big">${ok}/${qs.length}</span><span class="muted">en ${mmss(el)}${fixed?` · has corregido ${fixed} ${fixed===1?"fallo":"fallos"}`:""}</span></div><p>${ok>=8?"Muy bien: estas preguntas suben de nivel en tu repaso.":"Las que has vuelto a fallar volverán en «Repasar hoy» de su asignatura."}</p><div class="row"><button type="button" class="btn2 pri" data-again>Otra sesión</button><button type="button" class="btn2" data-go2>Test de ${esc(NAME(k))}</button></div><p class="muted" data-saved style="font-size:13px"></p>`;
      body.querySelector("[data-again]").addEventListener("click",()=>{ close(); session(); });
      body.querySelector("[data-go2]").addEventListener("click",()=>{ close(); if(typeof window.show==="function") window.show(k,{tab:"test",mode:"adaptive"}); });
      try{ const saveSubj=G("saveSubj"), pages={}; qs.filter(q=>q.ans!=null).forEach(q=>(pages[q.pg]||(pages[q.pg]=[])).push(q)); const now=new Date().toISOString(), tag=Date.now().toString(36);
        for(const pg of Object.keys(pages)){ const L=pages[pg], sc=L.filter(q=>q.ans===0).length, byLO={}; L.forEach(q=>{ const b=byLO[q.q[1]]||(byLO[q.q[1]]={ok:0,total:0}); b.total++; if(q.ans===0) b.ok++; });
          if(saveSubj) await saveSubj(pg,{attempts:[{id:"q"+tag+pg,date:now,mode:"s15",score:sc,total:L.length,pct:Math.round(sc/L.length*100),byLO,items:L.map(q=>({q:q.q[0],ok:q.ans===0,a:q.q[3][q.ans]}))}]}); }
        body.querySelector("[data-saved]").textContent="Guardado en tu progreso: cuenta para la racha y el objetivo de hoy."; eng(); }
      catch(e){ try{ console.error("s15",e); }catch(_){} body.querySelector("[data-saved]").textContent="No se ha podido guardar el resultado."; } }
  }).catch(e=>{ body.innerHTML=`<p>No se ha podido preparar la sesión (${esc(e.message)}). Revisa la conexión y vuelve a intentarlo.</p>`; });
}

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
  let ac=lsGet("f0:ac","cz"), tmr=0;
  const body=open("✈️ Entrenador de POH y SOP","<p>Cargando…</p>",()=>clearTimeout(tmr));
  getJSON("s/pohsop.json").then(j=>{ PS=j; home(); }).catch(e=>{ body.innerHTML=`<p>No se han podido cargar las listas (${esc(e.message)}).</p>`; });
  function home(){ clearTimeout(tmr); clock(""); const ml=memLists(ac), db=duelBank(ac);
    body.innerHTML=`<p>Para los exámenes de <b>POH</b> y <b>SOP</b>. Los datos salen de las tablas y listas de tus apuntes, avión por avión.</p>
      <div class="row">${AC.map(a=>`<button type="button" class="btn2" data-ac="${a[0]}" aria-pressed="${a[0]===ac}">${a[1]}</button>`).join("")}</div>
      <div class="row" style="align-items:stretch"><button type="button" class="btn2 pri" data-m="mem" style="flex:1 1 220px;text-align:left">🧠 Listas de memoria<br><small style="font-weight:500">${ml.length} emergencias y listas de memoria: ordénalas y completa los valores</small></button><button type="button" class="btn2 pri" data-m="duel" style="flex:1 1 220px;text-align:left">⚔️ Duelo de limitaciones<br><small style="font-weight:500">10 preguntas rápidas · ${db.length} datos: pesos, velocidades, combustible, aceite y listas del SOP</small></button></div>
      <p class="muted" style="font-size:13px">Ojo: el SOP da para el Piper (Archer III) VFE 100 · VNO 122 · VNE 155 y el POH 103 · 126 · 160. Cada pregunta dice de qué documento sale. Estos POH no dan MZFW: solo MTOW y MLW (iguales en los tres aviones).</p>`;
    body.querySelectorAll("[data-ac]").forEach(b=>b.addEventListener("click",()=>{ ac=b.dataset.ac; lsSet("f0:ac",ac); home(); }));
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
    const check=()=>{ const ok=seq.filter((s,i)=>s===i).length; tally(1);
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
      body.querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click",()=>{ if(b.disabled) return; asked++; const good=b.dataset.v===it.p[1]; if(good) ok++; tally(1);
        body.querySelectorAll("[data-v]").forEach(x=>{ x.disabled=true; if(x.dataset.v===it.p[1]) x.classList.add("ok"); else if(x===b) x.classList.add("bad"); });
        body.querySelector("[data-exp]").innerHTML=`<div class="row"><button type="button" class="btn2 pri" data-n>Siguiente →</button></div>`; body.querySelector("[data-n]").addEventListener("click",()=>{ i++; ask(); }); })); };
    ask(); }
  function duel(){ const B=shuf(duelBank(ac)).slice(0,10); let i=0, ok=0, timed=lsGet("f0:duel10",true), t1=0; const wrong=[];
    const ask=()=>{ clearTimeout(tmr); const q=B[i]; if(!q){ end(); return; } const opts=shuf([q.a,...shuf(q.d).slice(0,2)]); t1=Date.now();
      body.innerHTML=`<div class="row" style="justify-content:space-between"><span class="chip">${esc(q.src)}</span><span class="muted">${i+1} / ${B.length} · aciertos ${ok}</span></div>${timed?`<div class="bar" style="margin:4px 0 8px"><i data-left style="width:100%;background:var(--warn)"></i></div>`:""}<div class="qt">${acName()} · ${q.q}</div>${opts.map(o=>`<button type="button" class="opt" data-v="${esc(o)}">${esc(o)}</button>`).join("")}<div data-exp></div>`;
      body.querySelectorAll("[data-v]").forEach(b=>b.addEventListener("click",()=>answer(b.dataset.v,b)));
      if(timed){ const run=()=>{ const left=10-(Date.now()-t1)/1000, bar=body.querySelector("[data-left]"); if(bar) bar.style.width=Math.max(0,left*10)+"%"; if(left<=0) answer(null,null); else tmr=setTimeout(run,100); }; run(); } };
    const answer=(v,b)=>{ const q=B[i]; if(q.done) return; q.done=1; clearTimeout(tmr); tally(1); const good=v===q.a; if(good) ok++; else wrong.push(q);
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
function mount(){ const bar=document.querySelector(".mxbar"); if(!bar||document.querySelector(".mxeng")) return;
  const e=document.createElement("div"); e.className="mxeng"; bar.parentNode.insertBefore(e,bar);
  const s=document.createElement("button"); s.type="button"; s.className="hot"; s.innerHTML=`<span class="ic">🔥</span><span><b>Sesión rápida · 15 min</b><small>5 tarjetas · 1 esquema · 10 preguntas de tus fallos</small></span>`; bar.insertBefore(s,bar.firstChild);
  const p=document.createElement("button"); p.type="button"; p.innerHTML=`<span class="ic">✈️</span><span><b>POH y SOP</b><small>Listas de memoria y duelo de limitaciones</small></span>`;
  const sim=bar.querySelector('[data-a="sim"]'); bar.insertBefore(p,sim?sim.nextSibling:null);
  s.addEventListener("click",session);
  p.addEventListener("click",pohsop);
  eng(); const g=document.getElementById("grid"); if(g&&"MutationObserver" in window) new MutationObserver(()=>eng()).observe(g,{childList:true});
  window.addEventListener("f0-mx",eng); window.addEventListener("storage",eng); }
window.F0Mix.session=session; window.F0Mix.pohsop=pohsop; window.F0Mix.eng=eng;
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",mount); else mount();
})();
