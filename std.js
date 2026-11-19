/* Misma estructura y limpieza en todas las asignaturas (para todos los alumnos):
   · «SENASA ATPL · dónde están las N preguntas» siempre lo primero de los apuntes.
   · Códigos de capítulo y asignatura de esa barra clicables: llevan a su sitio en los apuntes (desplegando la lección).
   · «Lo que más fallas» en una fila por tema; sin el duplicado «Conceptos que más fallas» del Mapa.
   · Chuleta de fórmulas de Navegación como desplegable, filtrable por 061 / 062.
   · «Tu evolución» sin fechas amontonadas en el eje; historial sin el párrafo gris de temas.
   · Sin el encabezado repetido justo antes del título de cada asignatura. */
(function(){
"use strict";
const m=/(\d{3})\.html/.exec(location.pathname), PAGE=m&&m[1];
if(!PAGE) return;
const $=s=>document.querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const CSS=`
#hotFails .hot,#failTop .fitem{display:flex;align-items:center;gap:10px;padding:7px 0;margin:0;border-top:1px solid var(--line,rgba(0,0,0,.12))}
#hotFails .hot:first-child,#failTop .fitem:first-child{border-top:0}
#hotFails .hot .crow,#failTop .fitem .crow{flex:1 1 auto;display:flex;align-items:baseline;gap:12px;min-width:0;margin:0}
#hotFails .hot .crow b,#failTop .fitem .crow b{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
#hotFails .hot .crow span,#failTop .fitem .crow span{flex:none;white-space:nowrap;font-size:13px}
#failTop .fitem .crow span{color:var(--fail,#b3202f)}
#hotFails .hot>p,#failTop .fitem>p,#failTop .fitem>.muted.small{display:none}
#hotFails .hot .row,#failTop .fitem .row{flex:none;margin:0;gap:6px;flex-wrap:nowrap}
#hotFails .hot .row .btn,#failTop .fitem .row .btn{padding:3px 9px;font-size:12px;min-height:0}
@media (max-width:520px){#hotFails .hot .row .btn:not([data-go^="lo-"]),#failTop .fitem .row .btn:not([data-go^="lo-"]){display:none}}
.f0code{cursor:pointer;text-decoration:underline;text-decoration-color:rgba(29,111,176,.35);text-underline-offset:3px}
.f0code:hover,.f0code:focus-visible{color:#1D6FB0;text-decoration-color:currentColor;outline:none}
.f0hide{display:none!important}
details#formCard>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}
details#formCard>summary::-webkit-details-marker{display:none}
details#formCard>summary::after{content:"▾";margin-left:auto;transition:transform .2s;opacity:.6}
details#formCard[open]>summary::after{transform:rotate(180deg)}
details#formCard>summary small{font-weight:400;opacity:.65}
html[data-f0seg="061"] #formCard .fr[data-c="062"],html[data-f0seg="062"] #formCard .fr[data-c="061"]{display:none}
`;
function css(){ if($("#f0std-css")) return; const s=document.createElement("style"); s.id="f0std-css"; s.textContent=CSS; document.head.appendChild(s); }

// 1) orden: la tarjeta SENASA arriba del todo
function order(){
  const N=$("#notes"); if(!N) return;
  const sen=[...N.children].find(e=>e.classList.contains("card")&&/^\s*SENASA ATPL/.test((e.querySelector("b")||{}).textContent||""));
  if(sen&&N.firstElementChild!==sen) N.insertBefore(sen,N.firstElementChild);
  const hot=$("#hotCard")||$("#failCard"); if(sen&&hot&&hot.parentNode===N&&sen.nextElementSibling!==hot) N.insertBefore(hot,sen.nextElementSibling);
}
// 2) encabezado repetido justo antes del título de la asignatura
function dups(){
  const N=$("#notes"); if(!N) return;
  $$("p.exsep, div.examhead",N).forEach(e=>{ const nx=e.nextElementSibling; const c1=/^\s*(\d{3})/.exec(e.textContent||""), c2=nx&&/^\s*(\d{3})/.exec(nx.textContent||"");
    if(nx&&nx.matches("h2.subj")&&c1&&c2&&c1[1]===c2[1]) e.classList.add("f0hide"); });
}
// 3) ir a un código en los apuntes
function target(code){
  const ids=["lo-"+code,"ch-"+code]; for(const id of ids){ const el=document.getElementById(id); if(el) return el; }
  const N=$("#notes"); if(!N) return null;
  const firstLo=N.querySelector(`details[id^="lo-${code}."]`);
  const head=$$("h2,h3,section,div.examhead",N).find(h=>new RegExp("^\\s*"+code.replace(/\./g,"\\.")+"\\b").test((h.querySelector("h2,h3")||h).textContent||""));
  if(head&&!/^\d{3}$/.test(code)&&firstLo){ firstLo.open=true; }
  return head||firstLo;
}
function goCode(code){
  const el=target(code); if(!el) return;
  if(/^\d{3}\.\d{2}$/.test(code)){ const fl=document.querySelector(`#notes details[id^="lo-${code}."]`); if(fl) fl.open=true; }   // capítulo: se despliega su primera lección
  if(!el.id) el.id="f0c-"+code.replace(/\./g,"-");
  if(typeof window.openNotes==="function") window.openNotes(el.id);
  else { el.scrollIntoView({behavior:"smooth",block:"start"}); }
  if(el.tagName!=="DETAILS"){ const d=el.matches("details")?el:null; if(d) d.open=true; }
}
function codes(){
  const X=$("#examBar"); if(!X) return;
  $$(".xlab b, .xrl b, .xexl b",X).forEach(b=>{ if(b.classList.contains("f0code")) return; let c=(b.textContent||"").trim();
    if(/^\d{2}$/.test(c)) c=PAGE+"."+c;   // Meteorología muestra solo «01», «02»…
    if(!/^\d{3}(\.\d{2})*$/.test(c)) return;
    b.classList.add("f0code"); b.dataset.code=c; b.setAttribute("role","link"); b.tabIndex=0; b.title="Ir a "+c+" en los apuntes"; });
  $$("#hotFails .crow b, #failTop .crow b").forEach(b=>{ if(b.dataset.code) return; const it=b.closest(".hot,.fitem"), bt=it&&it.querySelector('[data-go^="lo-"]'); if(bt){ b.dataset.code=bt.dataset.go.slice(3); b.dataset.go1=bt.dataset.go; } });
}
document.addEventListener("click",e=>{ const b=e.target.closest(".f0code,[data-go1]"); if(!b) return; e.preventDefault(); if(b.dataset.go1&&typeof window.openNotes==="function") window.openNotes(b.dataset.go1); else if(b.dataset.code) goCode(b.dataset.code); });
document.addEventListener("keydown",e=>{ if((e.key==="Enter"||e.key===" ")&&e.target.classList&&e.target.classList.contains("f0code")){ e.preventDefault(); goCode(e.target.dataset.code); } });
// 4) Mapa: fuera el duplicado «Conceptos que más fallas»
function mapDup(){ const M=$("#map"); if(!M) return; $$(":scope > .card",M).forEach(c=>{ if(/^\s*Conceptos que más fallas/.test((c.querySelector("b")||{}).textContent||"")) c.classList.add("f0hide"); }); }
// 5) chuleta de fórmulas (Navegación) como desplegable; cada fórmula marcada 061 / 062
const RADIO=/\b(VOR|NDB|ADF|DME|ILS|QDM|QDR|QTE|QUJ|RMI|HSI|radial|radar|PRF|frecuencia|frequency|MHz|kHz|longitud de onda|wavelength|λ|GNSS|GPS|SSR|transpondedor|alcance VHF|line of sight|línea de vista|onda)/i;
function formulas(){
  const F=$("#formCard"); if(!F||F.tagName==="DETAILS") return;
  const d=document.createElement("details"); d.id="formCard"; d.className=F.className;
  const t=F.querySelector(":scope > b"), s=document.createElement("summary");
  s.innerHTML=(t?t.outerHTML:"<b>Chuleta de fórmulas</b>")+` <small>${F.querySelectorAll(".fr").length} fórmulas</small>`; if(t) t.remove();
  d.appendChild(s); while(F.firstChild) d.appendChild(F.firstChild); F.replaceWith(d);
  $$(".fr",d).forEach(fr=>{ fr.dataset.c=RADIO.test(fr.textContent||"")?"062":"061"; });
}
// 6) «Tu evolución»: sin fechas en el eje horizontal
const DATE=/^\s*\d{1,2}\/\d{1,2}\s*$/;
function evo(){ $$("#evoMap svg text, #histEvo svg text, #evoHist svg text").forEach(t=>{ if(DATE.test(t.textContent||"")) t.remove(); }); }
// 7) historial: sin el párrafo gris de temas bajo cada intento
function hist(){ $$("table.hist td.los").forEach(td=>{ const tr=td.parentElement; if(tr&&tr.children.length===1) tr.classList.add("f0hide"); else td.classList.add("f0hide"); }); }

function all(){ try{ order(); dups(); codes(); mapDup(); formulas(); evo(); hist(); }catch(e){} }
function init(){
  css(); all();
  let t=0; const mo=new MutationObserver(()=>{ if(t) return; t=requestAnimationFrame(()=>{ t=0; mo.disconnect(); all(); watch(); }); });
  const watch=()=>{ [["#notes",false],["#map",false],["#examBar",true],["#hotFails",true],["#failTop",true],["#evoMap",true],["#histEvo",true],["#histBody",true]].forEach(([s,sub])=>{ const el=$(s); if(el) mo.observe(el,{childList:true,subtree:sub}); }); };
  watch();
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(init,30)); else setTimeout(init,30);
addEventListener("load",()=>setTimeout(all,200));
})();
