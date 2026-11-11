/* ATPL Fase 0 · OPS — panel de operaciones de Cuatro Vientos (LECU). Solo en la web con cuenta (de momento, solo admin).
   Mapa satélite con las pistas y la pista estimada en uso, METAR/TAF reales (/api/wx), mínimos del SOP.4.1, Windy y sol.
   Herramienta de estudio: NO sirve para planificar un vuelo real.
   API: F0Ops.render(el, {fetchWx, allowDemo}) · F0Ops.leave() */
(function(){
"use strict";
let AD;
/* Datos del aeródromo: AIP España AD 2-LECU/LEVS (ENAIRE, vigente 06-AUG-26). Rumbos magnéticos. */
AD={icao:"LECU", wx:"LEVS", name:"Madrid / Cuatro Vientos", lat:40.37056, lon:-3.785, elev:2269,
  main:{id:"09/27", len:1500, wid:30, surf:"ASPH", pcn:"39/F/A/W/T", strip:"1740 × 80", 
    a:{id:"09",hdg:94,ll:[40.371122,-3.793928],el:2269,tora:1500,toda:1500,asda:1554,lda:1500,swy:"54 × 30"},
    b:{id:"27",hdg:274,ll:[40.370233,-3.776353],el:2250,tora:1500,toda:1500,asda:1555,lda:1500,swy:"55 × 30"}}};
AD.short="Cuatro Vientos"; AD.rw=[{len:1500,surf:"ASP",a:AD.main.a,b:AD.main.b}]; AD.ph=0;
const RAD0=Math.PI/180;
const AD0=AD;
const kmN=(a,b)=>{ const d=(b[0]-a[0])*RAD0, n=(b[1]-a[1])*RAD0, x=Math.sin(d/2)**2+Math.cos(a[0]*RAD0)*Math.cos(b[0]*RAD0)*Math.sin(n/2)**2; return Math.round(2*6371*Math.asin(Math.sqrt(x))/1.852); };
/* aeródromo activo */
const rwBrg=(a,b)=>{ const R=Math.PI/180, dn=b[0]-a[0], de=(b[1]-a[1])*Math.cos((a[0]+b[0])/2*R); return (Math.atan2(de,dn)/R+360)%360; };
const mkAD=o=>{ if(o.icao==="LECU") return AD0; const c=CHARTS[o.icao]||null, rw=o.rw.slice();
  if(c&&c.thr) c.thr.forEach(t=>{ const r=rw[t.ri], a=[t.a[1],t.a[2]], b=[t.b[1],t.b[2]]; if(r) rw[t.ri]=Object.assign({},r,{a:{id:t.a[0],hdg:Math.round(rwBrg(a,b)),ll:a},b:{id:t.b[0],hdg:Math.round(rwBrg(b,a)),ll:b}}); });
  return {icao:o.icao,wx:o.icao,name:o.name,short:o.name,lat:o.lat,lon:o.lon,elev:o.elev,rw:rw,ph:o.ph,tm:o.tm,other:true,chart:c}; };
const ends=()=>AD.rw.reduce((l,r)=>l.concat([Object.assign({len:r.len,surf:r.surf},r.a),Object.assign({len:r.len,surf:r.surf},r.b)]),[]);
/* Otros aeródromos del Reglamento de vuelos (OurAirports, no oficial): coordenadas, elevación (ft), pistas asfaltadas (longitud m, umbrales). Rumbo = número de pista × 10. */
const AEROS=[{"icao":"LEMT","name":"Casarrubios","ph":1,"tm":"00:15","lat":40.235,"lon":-4.02639,"elev":2050,"rw":[{"len":950,"surf":"ASP","a":{"id":"08","hdg":80,"ll":[40.23426,-4.031893]},"b":{"id":"26","hdg":260,"ll":[40.235742,-4.020887]},"est":1}]},{"icao":"LEOC","name":"Ocaña","ph":1,"tm":"00:30","lat":39.9375,"lon":-3.50333,"elev":2405,"rw":[{"len":1260,"surf":"ASP","a":{"id":"11","hdg":110,"ll":[39.938,-3.50791]},"b":{"id":"29","hdg":290,"ll":[39.934601,-3.49384]},"est":0}]},{"icao":"LEVD","name":"Valladolid","ph":1,"tm":"01:30","lat":41.7061,"lon":-4.85194,"elev":2776,"rw":[{"len":3000,"surf":"ASP","a":{"id":"05","hdg":50,"ll":[41.697029,-4.864785]},"b":{"id":"23","hdg":230,"ll":[41.716019,-4.839038]},"est":0}]},{"icao":"LEBG","name":"Burgos","ph":1,"tm":"01:30","lat":42.3576,"lon":-3.62076,"elev":2962,"rw":[{"len":2100,"surf":"ASP","a":{"id":"04","hdg":40,"ll":[42.350498,-3.62235]},"b":{"id":"22","hdg":220,"ll":[42.364246,-3.60499]},"est":0}]},{"icao":"LESA","name":"Salamanca","ph":1,"tm":"01:30","lat":40.9521,"lon":-5.50199,"elev":2595,"rw":[{"len":2513,"surf":"ASP","a":{"id":"03","hdg":30,"ll":[40.942024,-5.509036]},"b":{"id":"21","hdg":210,"ll":[40.962025,-5.495064]},"est":0}]},{"icao":"LEAB","name":"Albacete","ph":1,"tm":"01:45","lat":38.9485,"lon":-1.86352,"elev":2302,"rw":[{"len":2700,"surf":"ASP","a":{"id":"09","hdg":90,"ll":[38.948002,-1.87906]},"b":{"id":"27","hdg":270,"ll":[38.9491,-1.84794]},"est":0}]},{"icao":"LEBA","name":"Córdoba","ph":1,"tm":"02:00","lat":37.842,"lon":-4.84888,"elev":297,"rw":[{"len":2241,"surf":"ASP","a":{"id":"03","hdg":30,"ll":[37.834435,-4.854156]},"b":{"id":"21","hdg":210,"ll":[37.852104,-4.841833]},"est":0}]},{"icao":"LEBZ","name":"Badajoz","ph":1,"tm":"02:00","lat":38.8913,"lon":-6.82133,"elev":609,"rw":[{"len":2850,"surf":"ASP","a":{"id":"13","hdg":130,"ll":[38.8988,-6.83462]},"b":{"id":"31","hdg":310,"ll":[38.883801,-6.80789]},"est":0}]},{"icao":"LETL","name":"Teruel","ph":2,"tm":"01:45","lat":40.41027,"lon":-1.21737,"elev":3380,"rw":[{"len":2825,"surf":"ASPH","a":{"id":"18","hdg":180,"ll":[40.424732,-1.218303]},"b":{"id":"36","hdg":360,"ll":[40.399319,-1.216897]},"est":0}]},{"icao":"LELN","name":"León","ph":2,"tm":"02:00","lat":42.59071,"lon":-5.65341,"elev":3006,"rw":[{"len":3000,"surf":"ASP","a":{"id":"05","hdg":50,"ll":[42.582001,-5.66528]},"b":{"id":"23","hdg":230,"ll":[42.600911,-5.639317]},"est":0}]},{"icao":"LELO","name":"Logroño","ph":2,"tm":"02:00","lat":42.46095,"lon":-2.32224,"elev":1161,"rw":[{"len":2200,"surf":"CON","a":{"id":"11","hdg":110,"ll":[42.463726,-2.332505]},"b":{"id":"29","hdg":290,"ll":[42.45702,-2.307331]},"est":0}]},{"icao":"LESO","name":"San Sebastián","ph":2,"tm":"02:15","lat":43.3565,"lon":-1.79061,"elev":16,"rw":[{"len":1754,"surf":"ASP","a":{"id":"04","hdg":40,"ll":[43.350399,-1.7974]},"b":{"id":"22","hdg":220,"ll":[43.362701,-1.78382]},"est":0}]},{"icao":"LEGR","name":"Granada","ph":2,"tm":"02:15","lat":37.1887,"lon":-3.77736,"elev":1860,"rw":[{"len":2900,"surf":"ASP","a":{"id":"09","hdg":90,"ll":[37.188599,-3.79369]},"b":{"id":"27","hdg":270,"ll":[37.1889,-3.76103]},"est":0}]},{"icao":"LEZL","name":"Sevilla","ph":2,"tm":"02:30","lat":37.418,"lon":-5.89311,"elev":112,"rw":[{"len":3362,"surf":"ASP","a":{"id":"09","hdg":90,"ll":[37.4179,-5.91208]},"b":{"id":"27","hdg":270,"ll":[37.417999,-5.8741]},"est":0}]},{"icao":"LELC","name":"Murcia-San Javier","ph":2,"tm":"02:45","lat":37.775,"lon":-0.81239,"elev":11,"rw":[{"len":1577,"surf":"ASPH","a":{"id":"04L","hdg":40,"ll":[37.780499,-0.816839]},"b":{"id":"22R","hdg":220,"ll":[37.785999,-0.809692]},"est":0},{"len":2320,"surf":"ASPH","a":{"id":"04R","hdg":40,"ll":[37.7677,-0.821556]},"b":{"id":"22L","hdg":220,"ll":[37.7822,-0.802833]},"est":0}]},{"icao":"LEPP","name":"Pamplona","ph":3,"tm":"02:15","lat":42.77,"lon":-1.64633,"elev":1504,"rw":[{"len":2207,"surf":"ASP","a":{"id":"15","hdg":150,"ll":[42.779499,-1.65325]},"b":{"id":"33","hdg":330,"ll":[42.762001,-1.6405]},"est":0}]},{"icao":"LEXJ","name":"Santander","ph":3,"tm":"02:15","lat":43.4271,"lon":-3.82001,"elev":16,"rw":[{"len":2320,"surf":"ASP","a":{"id":"11","hdg":110,"ll":[43.430801,-3.83392]},"b":{"id":"29","hdg":290,"ll":[43.423599,-3.80702]},"est":0}]},{"icao":"LEAS","name":"Asturias","ph":3,"tm":"02:30","lat":43.5636,"lon":-6.03462,"elev":416,"rw":[{"len":2200,"surf":"ASP","a":{"id":"11","hdg":110,"ll":[43.566601,-6.04759]},"b":{"id":"29","hdg":290,"ll":[43.560501,-6.02165]},"est":0}]},{"icao":"LECH","name":"Castellón","ph":3,"tm":"02:30","lat":40.21389,"lon":0.07333,"elev":1182,"rw":[{"len":2700,"surf":"ASPH","a":{"id":"06","hdg":60,"ll":[40.2075,0.060245]},"b":{"id":"24","hdg":240,"ll":[40.220699,0.086913]},"est":0}]},{"icao":"LEAM","name":"Almería","ph":3,"tm":"02:45","lat":36.8439,"lon":-2.3701,"elev":70,"rw":[{"len":3200,"surf":"ASP","a":{"id":"07","hdg":70,"ll":[36.839699,-2.38726]},"b":{"id":"25","hdg":250,"ll":[36.848099,-2.35294]},"est":0}]},{"icao":"LEJR","name":"Jerez","ph":3,"tm":"02:45","lat":36.7446,"lon":-6.06011,"elev":93,"rw":[{"len":2300,"surf":"ASP","a":{"id":"02","hdg":20,"ll":[36.735001,-6.06481]},"b":{"id":"20","hdg":200,"ll":[36.754299,-6.05541]},"est":0}]},{"icao":"LELL","name":"Sabadell","ph":3,"tm":"03:15","lat":41.5209,"lon":2.10508,"elev":485,"rw":[{"len":1049,"surf":"ASPH","a":{"id":"13","hdg":130,"ll":[41.523346,2.100731]},"b":{"id":"31","hdg":310,"ll":[41.517643,2.110748]},"est":0}]}];
/* Cartas de aeródromo (AIP ADC 1.1, ENAIRE) colocadas sobre el mapa con los umbrales de la AIP y la escala impresa: url = carta, ovl = capa de rodaje, b = esquinas SO/NE, thr = umbrales, fq = frecuencias, sup = suplementos vigentes. */
const CHARTS={"LEAB":{"url":"ops-adc-LEAB.webp","ovl":"ops-ovl-LEAB.webp","b":[[38.9308217,-1.8872232],[38.9652102,-1.8394056]],"wef":"27-NOV-25","fq":[["TWR","122.105","Torre"],["GND","121.805","Rodaje"]],"thr":[{"ri":0,"a":["09",38.947967,-1.879119],"b":["27",38.948928,-1.847986]}],"sup":[["SUP 176/25","02/10/25","02/10/26","Riesgo de FOD en la APN E-1 por obras cercanas. Solo se admiten aeronaves remolcadas por la TWY RE-1."]]},"LEAM":{"url":"ops-adc-LEAM.webp","ovl":"ops-ovl-LEAM.webp","b":[[36.8247991,-2.393994],[36.863068,-2.3439305]],"wef":"03-SEP-26","fq":[["TWR","118.350","Torre"],["GMC","121.705","Rodaje"]],"thr":[{"ri":0,"a":["07",36.840119,-2.385647],"b":["25",36.848147,-2.352936]}]},"LEAS":{"url":"ops-adc-LEAS.webp","ovl":"ops-ovl-LEAS.webp","b":[[43.549046,-6.0562749],[43.5758797,-6.0154594]],"wef":"01-OCT-26","fq":[["TWR","118.150","Torre"],["GMC","121.705","Rodaje"]],"thr":[{"ri":0,"a":["11",43.566639,-6.047592],"b":["29",43.560497,-6.02165]}],"sup":[["SUP 209/26","29/10/26","29/10/27","Luces de obstáculo WDI CAB 11 y WDI INTERMEDIA inutilizables."]]},"LEBA":{"url":"ops-adc-LEBA.webp","ovl":"ops-ovl-LEBA.webp","b":[[37.8317839,-4.8632642],[37.8547002,-4.8333972]],"wef":"16-APR-26","fq":[["AFIS","118.305","Información"]],"thr":[{"ri":0,"a":["03",37.834436,-4.854156],"b":["21",37.850597,-4.842883]}],"sup":[["SUP 126/26","06/08/26","06/08/27","Luces de identificación de umbral de las RWY 03 y 21 inutilizables."]]},"LEBG":{"url":"ops-adc-LEBG.webp","ovl":"ops-ovl-LEBG.webp","b":[[42.3483298,-3.6346449],[42.3666972,-3.6020878]],"wef":"27-NOV-25","fq":[["AFIS","125.430","Información"]],"thr":[{"ri":0,"a":["04",42.350486,-3.622344],"b":["22",42.364283,-3.604925]}],"sup":[["SUP 103/26","11/06/26","11/06/27","Señal de barra de parada izquierda de la TWY B y letrero de pista indicativo de entrada a la TWY B inutilizables."]]},"LEBZ":{"url":"ops-adc-LEBZ.webp","ovl":"ops-ovl-LEBZ.webp","b":[[38.8792224,-6.8416114],[38.9032923,-6.8001851]],"wef":"11-JUN-26","fq":[["TWR","122.105","Torre"],["GMC","130.155","Rodaje"]],"thr":[{"ri":0,"a":["13",38.898753,-6.834617],"b":["31",38.883789,-6.807894]}]},"LECH":{"url":"ops-adc-LECH.webp","ovl":"ops-ovl-LECH.webp","b":[[40.1988652,0.0524052],[40.2283881,0.0930035]],"wef":"06-AUG-26","fq":[["TWR","120.680","Torre"],["GMC","121.830","Rodaje"]],"thr":[{"ri":0,"a":["06",40.207539,0.060236],"b":["24",40.220697,0.086906]}]},"LEGR":{"url":"ops-adc-LEGR.webp","ovl":"ops-ovl-LEGR.webp","b":[[37.168324,-3.8016827],[37.2065881,-3.7531957]],"wef":"01-OCT-26","fq":[["TWR","118.855","Torre"],["GMC","121.930","Rodaje"]],"thr":[{"ri":0,"a":["09",37.188614,-3.793681],"b":["27",37.188858,-3.761022]}]},"LEJR":{"url":"ops-adc-LEJR.webp","ovl":"ops-ovl-LEJR.webp","b":[[36.7308255,-6.0765695],[36.7608551,-6.0397388]],"wef":"19-MAR-26","fq":[["TWR","118.555","Torre"],["GMC","133.280","Rodaje"]],"thr":[{"ri":0,"a":["02",36.734975,-6.064814],"b":["20",36.754269,-6.055406]}]},"LELC":{"url":"ops-adc-LELC.webp","ovl":"ops-ovl-LELC.webp","b":[[37.7629874,-0.83094],[37.790054,-0.7940294]],"wef":"22-JAN-26","fq":[["TWR","124.425","Torre"],["GMC","121.600","Rodaje"]],"thr":[{"ri":1,"a":["04R",37.767603,-0.821653],"b":["22L",37.782183,-0.802786]},{"ri":0,"a":["04L",37.776617,-0.820406],"b":["22R",37.786528,-0.807583]}]},"LELL":{"url":"ops-adc-LELL.webp","ovl":"ops-ovl-LELL.webp","b":[[41.5171955,2.0986373],[41.5251759,2.1120677]],"wef":"22-JAN-26","fq":[["TWR","120.805","Torre"],["GMC","121.605","Rodaje"]],"thr":[{"ri":0,"a":["13",41.523344,2.100731],"b":["31",41.518458,2.109328]}],"sup":[["SUP 213/25","25/12/25","25/12/26","Luces de identificación de umbral de las RWY 13 y 31 inutilizables."]]},"LELN":{"url":"ops-adc-LELN.webp","ovl":"ops-ovl-LELN.webp","b":[[42.579322,-5.6708921],[42.6062346,-5.6299509]],"wef":"09-JUL-26","fq":[["TWR","122.105","Torre y rodaje"]],"thr":[{"ri":0,"a":["05",42.58195,-5.665275],"b":["23",42.600931,-5.639281]}]},"LELO":{"url":"ops-adc-LELO.webp","ovl":"ops-ovl-LELO.webp","b":[[42.4467799,-2.3354434],[42.4718524,-2.2965332]],"wef":"11-JUN-26","fq":[["TWR","118.580","Torre"]],"thr":[{"ri":0,"a":["11",42.463731,-2.332497],"b":["29",42.457025,-2.307322]}]},"LEPP":{"url":"ops-adc-LEPP.webp","ovl":"ops-ovl-LEPP.webp","b":[[42.7564493,-1.6708535],[42.7880711,-1.6216623]],"wef":"22-JAN-26","fq":[["TWR","118.200","Torre"],["GMC","121.705","Rodaje"]],"thr":[{"ri":0,"a":["15",42.779544,-1.653253],"b":["33",42.764419,-1.642231]}],"sup":[["SUP 184/26","01/10/26","15/05/27","Obras de ampliación de franja."]]},"LESA":{"url":"ops-adc-LESA.webp","ovl":"ops-ovl-LESA.webp","b":[[40.9372976,-5.5204154],[40.9650699,-5.481748]],"wef":"04-SEP-25","fq":[["TWR","118.105","Torre"],["GMC","121.855","Rodaje"]],"thr":[{"ri":0,"a":["03",40.942025,-5.509036],"b":["21",40.962025,-5.495064]}],"sup":[["SUP 163/25","04/09/25","04/09/26","RWY 07/25 cerrada."]]},"LESO":{"url":"ops-adc-LESO.webp","ovl":"ops-ovl-LESO.webp","b":[[43.3497862,-1.8007191],[43.3636751,-1.7796799]],"wef":"19-MAR-26","fq":[["TWR","119.855","Torre"],["GMC","121.705","Rodaje"]],"thr":[{"ri":0,"a":["04",43.351503,-1.796136],"b":["22",43.361519,-1.785106]}]},"LETL":{"url":"ops-adc-LETL.webp","ovl":"ops-ovl-LETL.webp","b":[[40.3966402,-1.2384847],[40.4293216,-1.1957957]],"wef":"09-JUL-26","fq":[],"thr":[{"ri":0,"a":["18",40.424733,-1.218303],"b":["36",40.401889,-1.217039]}]},"LEVD":{"url":"ops-adc-LEVD.webp","ovl":"ops-ovl-LEVD.webp","b":[[41.6936663,-4.87431],[41.7198056,-4.8296932]],"wef":"02-OCT-25","fq":[["TWR","122.205","Torre"]],"thr":[{"ri":0,"a":["05",41.697019,-4.864756],"b":["23",41.715989,-4.839006]}]},"LEXJ":{"url":"ops-adc-LEXJ.webp","ovl":"ops-ovl-LEXJ.webp","b":[[43.4205508,-3.8367876],[43.4326734,-3.8034041]],"wef":"22-JAN-26","fq":[["TWR","118.105","Torre"],["GMC","121.705","Rodaje"]],"thr":[{"ri":0,"a":["11",43.430789,-3.833919],"b":["29",43.423597,-3.807014]}]},"LEZL":{"url":"ops-adc-LEZL.webp","ovl":"ops-ovl-LEZL.webp","b":[[37.4085142,-5.923041],[37.4269782,-5.8631846]],"wef":"14-MAY-26","fq":[["TWR","118.105","Torre"],["GMC","121.705","Rodaje"]],"thr":[{"ri":0,"a":["09",37.417881,-5.912075],"b":["27",37.418008,-5.8741]}]}};
const AC={cz:{n:"PS-28 Cruiser",c:"Cruiser",xf:12,xs:10,t:32,ts:32}, c1:{n:"Cessna 172",c:"C172",xf:15,xs:12,t:35,ts:32}, pi:{n:"Piper PA-28",c:"Piper",xf:15,xs:12,t:35,ts:32}};
const MIN={visFi:5000,visSolo:8000,cigFi:1500,cigSolo:2500,tailFi:5,tailSolo:0,head:20};
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const S={gen:0, data:null, t:0, clk:0, root:null, opt:null, map:null, lay:null, wctl:null, scen:0};

/* ---------- METAR / TAF ---------- */
const WX={MI:"poco profundo",BC:"bancos de",PR:"parcial",DR:"ventisca baja de",BL:"ventisca de",SH:"chubascos de",TS:"tormenta con",FZ:"engelante",DZ:"llovizna",RA:"lluvia",SN:"nieve",SG:"granos de nieve",PL:"cristales de hielo",GR:"granizo",GS:"granizo pequeño",BR:"neblina",FG:"niebla",FU:"humo",VA:"ceniza volcánica",DU:"polvo",SA:"arena",HZ:"calima",SQ:"turbonada",FC:"tubo de nubes",SS:"tormenta de arena",DS:"tormenta de polvo"};
const CL={FEW:"Poca nubosidad",SCT:"Nubes dispersas",BKN:"Nubes rotas",OVC:"Cielo cubierto"};
function wxText(code){ const inten=code.startsWith("-")?" (débil)":code.startsWith("+")?" (fuerte)":""; const c0=code.replace(/^[-+]/,""), vc=c0.startsWith("VC")?" en las proximidades":""; const parts=(c0.replace(/^VC/,"").match(/.{2}/g)||[]); let t=parts.map(p=>WX[p]||p).join(" "); t=t.replace(/ con$/,""); return (t+inten+vc).trim(); }
function group(t,o){   // un grupo del METAR/TAF → campos
  let m;
  if(t==="CAVOK"){ o.vis=9999; o.cavok=true; o.clouds=[]; o.ceil=null; return true; }
  if((m=t.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/))){ let k=m[4]==="MPS"?1.944:1; o.wind={vrb:m[1]==="VRB",dir:m[1]==="VRB"?null:+m[1],spd:Math.round(+m[2]*k),gst:m[3]?Math.round(+m[3]*k):0}; return true; }
  if((m=t.match(/^(\d{3})V(\d{3})$/))){ if(o.wind) o.wind.var=[+m[1],+m[2]]; return true; }
  if(/^\d{4}$/.test(t)){ o.vis=+t; return true; }
  if(/^(-|\+)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|SQ|FC|SS|DS)+$/.test(t)||/^(-|\+)?(VC)?TS$/.test(t)){ (o.wx=o.wx||[]).push(t); return true; }
  if(t==="NSC"||t==="SKC"||t==="NCD"){ o.clouds=[]; o.ceil=null; return true; }
  if((m=t.match(/^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?$/))){ (o.clouds=o.clouds||[]).push({t:m[1],h:+m[2]*100,cb:m[3]||""}); return true; }
  if((m=t.match(/^VV(\d{3})$/))){ (o.clouds=o.clouds||[]).push({t:"VV",h:+m[1]*100,cb:""}); return true; }
  return false;
}
function ceilOf(o){ const c=(o.clouds||[]).filter(x=>x.t==="BKN"||x.t==="OVC"||x.t==="VV").map(x=>x.h); return c.length?Math.min.apply(null,c):null; }
function parseMetar(raw){
  const o={raw:raw.trim(),clouds:[],wx:[],trend:""}, tk=o.raw.split(/\s+/); let i=0;
  if(tk[i]==="METAR"||tk[i]==="SPECI") o.kind=tk[i++];
  o.station=tk[i++]; let m=(tk[i]||"").match(/^(\d{2})(\d{2})(\d{2})Z$/); if(m){ o.day=+m[1]; o.hh=+m[2]; o.mm=+m[3]; i++; }
  if(tk[i]==="AUTO"||tk[i]==="COR") i++;
  let trend=false;
  for(;i<tk.length;i++){ const t=tk[i];
    if(t==="NOSIG"||t==="BECMG"||t==="TEMPO"){ trend=true; o.trend=tk.slice(i).join(" "); break; }
    if(t==="RMK") break;
    if((m=t.match(/^(M?\d{2})\/(M?\d{2})$/))){ const n=x=>x[0]==="M"?-(+x.slice(1)):+x; o.temp=n(m[1]); o.dew=n(m[2]); continue; }
    if((m=t.match(/^Q(\d{4})$/))){ o.qnh=+m[1]; continue; }
    if((m=t.match(/^A(\d{4})$/))){ o.qnh=Math.round(+m[1]*0.338639); continue; }
    group(t,o);
  }
  o.ceil=ceilOf(o); return o;
}
function obsDate(o,now){ if(o.day==null) return null; let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),o.day,o.hh,o.mm)); if(d-now>36e5*12) d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,o.day,o.hh,o.mm)); return d; }
function parseTaf(raw){
  const tk=raw.trim().split(/\s+/); let i=0; const o={raw:raw.trim(),periods:[]};
  if(tk[i]==="TAF") i++; if(tk[i]==="AMD"||tk[i]==="COR") i++;
  o.station=tk[i++]; i++; // emisión
  const v=(tk[i]||"").match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/); if(v){ o.from=+v[2]; o.to=+v[4]; o.day=+v[1]; i++; }
  let cur={label:"BASE",kind:"base",f:{clouds:[],wx:[]},t:""};
  const push=()=>{ o.periods.push(cur); };
  for(;i<tk.length;i++){ const t=tk[i]; let m;
    if(t==="BECMG"||t==="TEMPO"||t==="PROB30"||t==="PROB40"||/^FM\d{6}$/.test(t)){
      push(); let kind=t, lab=t, prob="";
      if(/^PROB/.test(t)){ prob=t+" "; if(tk[i+1]==="TEMPO"){ i++; kind="TEMPO"; } else { kind="PROB"; } }
      let rng="";
      if(/^FM\d{6}$/.test(t)){ kind="FM"; rng="desde las "+t.slice(4,6)+":"+t.slice(6,8)+" Z"; }
      else if((m=(tk[i+1]||"").match(/^(\d{2})(\d{2})\/(\d{2})(\d{2})$/))){ rng=m[2]+"–"+m[4]+" Z"; i++; }
      cur={label:(prob+(kind==="FM"?"FM":kind)).trim(),kind,rng,f:{clouds:[],wx:[]},t:""}; continue; }
    group(t,cur.f);
  }
  push(); if(o.from!=null&&o.periods[0]) o.periods[0].rng=o.from===o.to?"24 h desde las "+pad(o.from)+" Z":pad(o.from)+"–"+pad(o.to)+" Z";
  // construir estado efectivo de cada periodo
  let base=null; const eff=[];
  o.periods.forEach(p=>{ const f=p.f; let e;
    if(p.kind==="base"){ e=Object.assign({},f); base=Object.assign({},f); }
    else { const src=(p.kind==="BECMG"||p.kind==="FM")?base:base; e=Object.assign({},src); ["wind","vis","cavok"].forEach(k=>{ if(f[k]!==undefined) e[k]=f[k]; }); if(f.clouds&&f.clouds.length||f.cavok){ e.clouds=f.clouds; if(f.cavok){ e.vis=9999; } } if(f.wx&&f.wx.length) e.wx=f.wx; else if(f.vis!==undefined||f.cavok) e.wx=[]; if(p.kind==="BECMG"||p.kind==="FM") base=Object.assign({},e); }
    e.ceil=ceilOf(e); p.e=e; });
  return o;
}

/* ---------- viento y mínimos ---------- */
function windOn(w){   // pista (extremo) con más viento de cara; a igualdad, la 27
  const es=ends();
  if(!w||(w.spd===0&&!w.gst)) return {end:null,head:0,cross:0,calm:true,side:""};
  const v=Math.max(w.spd,w.gst||0); let best=null;
  es.forEach(r=>{ const rel=w.vrb?0:((w.dir-r.hdg)%360+360)%360, a=rel*Math.PI/180; const head=w.vrb?0:Math.cos(a)*v, cross=w.vrb?v:Math.abs(Math.sin(a))*v; const c={end:r,head,cross,side:w.vrb?"":(rel>0&&rel<180?"derecha":"izquierda")}; if(!best||c.head>best.head+0.01||(Math.abs(c.head-best.head)<=0.01&&r.id==="27")) best=c; });
  return best;
}
function flightCat(e){ const v=e.vis==null?9999:e.vis, c=e.ceil==null?99999:e.ceil;
  if(v<1600||c<500) return "LIFR"; if(v<4800||c<1000) return "IFR"; if(v<=8000||c<=3000) return "MVFR"; return "VFR"; }
function evalOne(e,mode){
  const solo=mode==="solo", w=windOn(e.wind), vis=e.vis==null?9999:e.vis, vmin=solo?MIN.visSolo:MIN.visFi, cmin=solo?MIN.cigSolo:MIN.cigFi, tmax=solo?MIN.tailSolo:MIN.tailFi;
  const cbts=(e.clouds||[]).some(c=>c.cb==="CB")||(e.wx||[]).some(x=>/TS/.test(x));
  const out={};
  Object.keys(AC).forEach(k=>{ const a=AC[k], bad=[], near=[]; const xm=solo?a.xs:a.xf, tm=solo?a.ts:a.t;
    const f={vis:vis>=vmin, cig:e.ceil==null||e.ceil>=cmin, cross:w.cross<=xm, tail:-w.head<=tmax, head:w.head<=MIN.head, temp:e.temp==null||e.temp<=tm};
    if(!f.vis) bad.push("Visibilidad "+vis+" m (mín. "+vmin+")");
    if(!f.cig) bad.push("Techo "+e.ceil+" ft (mín. "+cmin+")");
    if(!f.cross) bad.push("Viento cruzado "+Math.round(w.cross)+" kt (máx. "+xm+")"); else if(w.cross>=xm-2) near.push("Cruzado "+Math.round(w.cross)+" de "+xm+" kt: muy cerca del límite");
    if(!f.head) bad.push("Viento de cara "+Math.round(w.head)+" kt (máx. "+MIN.head+")");
    if(!f.tail) bad.push("Viento de cola "+Math.round(-w.head)+" kt (máx. "+tmax+")");
    if(!f.temp) bad.push("Temperatura "+e.temp+" ºC (máx. "+tm+")");
    out[k]={s:bad.length?"no":(cbts||near.length?"warn":"ok"),why:bad.concat(near,cbts?["Tormenta o CB: decide el HT o el CFI"]:[]),f,xm,tm}; });
  return {ac:out,w,cbts};
}

/* ---------- sol ---------- */
function sunAt(date,rising,zen){ const R=Math.PI/180, lat=AD.lat, lon=AD.lon, Y=date.getUTCFullYear(), M=date.getUTCMonth()+1, D=date.getUTCDate();
  const N1=Math.floor(275*M/9), N2=Math.floor((M+9)/12), N3=1+Math.floor((Y-4*Math.floor(Y/4)+2)/3), N=N1-N2*N3+D-30, lh=lon/15, t=N+((rising?6:18)-lh)/24;
  const Mm=0.9856*t-3.289; let L=Mm+1.916*Math.sin(Mm*R)+0.020*Math.sin(2*Mm*R)+282.634; L=(L%360+360)%360;
  let RA=Math.atan(0.91764*Math.tan(L*R))/R; RA=(RA%360+360)%360; RA=(RA+(Math.floor(L/90)*90-Math.floor(RA/90)*90))/15;
  const sd=0.39782*Math.sin(L*R), cd=Math.cos(Math.asin(sd)), ch=(Math.cos(zen*R)-sd*Math.sin(lat*R))/(cd*Math.cos(lat*R)); if(ch>1||ch<-1) return null;
  let H=(rising?360-Math.acos(ch)/R:Math.acos(ch)/R)/15; let T=H+RA-0.06571*t-6.622; let UT=((T-lh)%24+24)%24;
  return new Date(Date.UTC(Y,M-1,D)+UT*36e5); }
function sun(now){ return {rise:sunAt(now,true,90.833), set:sunAt(now,false,90.833), civEnd:sunAt(now,false,96)}; }
const fz=d=>d?pad(d.getUTCHours())+":"+pad(d.getUTCMinutes()):"--:--";

/* ---------- datos de ejemplo (solo si el servidor no responde y se pide) ---------- */
const SCEN=[
  {n:"Día normal", m:"24008KT 9999 FEW040 SCT090 19/06 Q1020 NOSIG", t:"24010KT 9999 FEW040 TEMPO {a}/{b} 24015G25KT BECMG {c}/{d} VRB03KT CAVOK"},
  {n:"Techo bajo", m:"25006KT 6000 -RA BKN012 OVC030 11/09 Q1015 NOSIG", t:"25006KT 6000 -RA BKN012 BECMG {a}/{b} 25008KT 9999 SCT025 TEMPO {c}/{d} 4000 RA BKN008"}];
function demoData(i){
  const now=new Date(), ob=new Date(Math.floor(now/18e5)*18e5), tf=new Date(Math.floor(now/108e5)*108e5), s=SCEN[i||0];
  const h=k=>{ const x=new Date(tf.getTime()+k*36e5); return pad(x.getUTCDate())+pad(x.getUTCHours()); };
  return {metar:{raw:"METAR "+AD.wx+" "+pad(ob.getUTCDate())+pad(ob.getUTCHours())+pad(ob.getUTCMinutes())+"Z "+s.m,station:AD.wx},
    taf:{raw:"TAF "+AD.wx+" "+pad(tf.getUTCDate())+pad(tf.getUTCHours())+"00Z "+h(0)+"/"+h(24)+" "+s.t.replace("{a}",h(3)).replace("{b}",h(7)).replace("{c}",h(10)).replace("{d}",h(12)),station:AD.wx},demo:true};
}

/* ---------- horario del aeródromo (AIP: civil V 07:00 Z–ocaso, I 08:00 Z–ocaso) ---------- */
function madOff(d){ const h=+new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Madrid",hour:"numeric",hourCycle:"h23"}).format(d); return (h-d.getUTCHours()+24)%24; }
/* Horarios AD 2.3 de la AIP (hora UTC). V = verano (horario de verano UE), I = invierno.
   s/w: {"días ISO 1=lun…7=dom": [[abre,cierra],…]} con HHMM; "SS" = ocaso. x/xs: temporada especial (LERJ).
   Solo uso/horario del aeródromo (no ATS aparte). Festivos no se calculan (se avisa en la nota). Sin entrada = sin horario en la AIP. */
const ALL="1-7", WK="1-5";
const HRS={
 LEVD:{s:{[WK]:[[600,1915]],"6-7":[[630,1830]]},w:{[WK]:[[700,2015]],"6-7":[[730,1930]]},n:"Festivos: como sábado y domingo"},
 LEBG:{s:{1:[[600,1800]],2:[[730,1700]],3:[[730,1700]],4:[[600,1800]],5:[[730,1700]],6:[[730,1630]],7:[[730,1700]]},w:{1:[[700,1900]],2:[[830,1800]],3:[[830,1800]],4:[[700,1900]],5:[[830,1800]],6:[[830,1730]],7:[[830,1800]]},n:"Uso público L-V 08:30–16:00 Z (verano); el resto es uso restringido (sin comercial)"},
 LESA:{s:{[ALL]:[[800,1900]]},w:{[ALL]:[[730,1630]]},n:"Aeródromo militar: tráfico civil limitado (AIP, apartado 20)"},
 LEAB:{s:{[ALL]:[[700,1230]]},w:{[ALL]:[[800,1330]]},n:"Base militar: civil solo VFR y con autorización previa (48 h)"},
 LEBA:{s:{[ALL]:[[700,1800]]},w:{[ALL]:[[830,1930]]},n:"AFIS solo L-V (3 h/día): fuera, consulta NOTAM"},
 LEBZ:{s:{[ALL]:[[630,1815]]},w:{[ALL]:[[730,1915]]}},
 LETL:{s:{[WK]:[[630,1630]]},w:{[WK]:[[800,1600]]},n:"Cerrado festivos de Aragón; resto con petición 24 h"},
 LELN:{s:{[ALL]:[[730,1900]]},w:{[ALL]:[[830,2000]]}},
 LELO:{s:{[WK]:[[525,2000]],6:[[630,1730]],7:[[830,1315],[1415,1930]]},w:{[WK]:[[625,2100]],6:[[730,1830]],7:[[930,1415],[1515,2030]]},
   x:d=>{ const y=d.getUTCFullYear(), sat=(m,k)=>{ const e=new Date(Date.UTC(y,m+1,0)); e.setUTCDate(e.getUTCDate()-((e.getUTCDay()+1)%7)-7*k); return e; }, a=sat(6,1), b=new Date(Date.UTC(y,8,1)); b.setUTCDate(1+((7-b.getUTCDay())%7)); return d>=a&&d<=b; },
   xs:{[WK]:[[630,1700]],6:[[630,1730]],7:[[830,1100],[1200,1830]]},n:"Uso restringido (sin IFR ni comercial) amplía el horario público"},
 LESO:{s:{[ALL]:[[530,1945]]},w:{[ALL]:[[630,2045]]},n:"PPR solo aviación comercial"},
 LEGR:{s:{[ALL]:[[430,2115]]},w:{[ALL]:[[530,2215]]}},
 LEZL:{s:{[ALL]:[[430,2300]]},w:{[ALL]:[[530,2400]]}},
 LELC:{s:{[WK]:[[530,2030]],"6-7":[[630,2030]]},w:{[WK]:[[630,2130]],"6-7":[[730,2130]]},mil:1,n:"Base militar: la AIP indica que NO está disponible para aeronaves civiles"},
 LEPP:{s:{[ALL]:[[430,2145]]},w:{[ALL]:[[530,2245]]}},
 LEXJ:{s:{[ALL]:[[430,2100]]},w:{[ALL]:[[530,2200]]}},
 LEAS:{s:{[ALL]:[[440,2330]]},w:{[ALL]:[[540,2315]]}},
 LECH:{s:{[ALL]:[[600,1800]]},w:{[ALL]:[[700,1900]]},n:"Uso público (+2 h con PPR); el uso restringido llega hasta el ocaso"},
 LEAM:{s:{[ALL]:[[510,2045]]},w:{[ALL]:[[610,2145]]}},
 LEJR:{s:{[ALL]:[[445,2100]]},w:{[ALL]:[[545,2200]]}},
 LELL:{s:{[ALL]:[[700,"SS"]]},w:{[ALL]:[[800,"SS"]]}}
};
const DOW=["dom","lun","mar","mié","jue","vie","sáb"];
function hrsExpand(t){ const o={}; for(const k in t){ const q=String(k).split("-").map(Number); for(let d=q[0];d<=(q[1]||q[0]);d++) o[d]=t[k]; } return o; }
function hrsIntervals(h,now){
  const out=[];
  for(let k=-1;k<=8;k++){
    const base=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+k)), wd=base.getUTCDay()||7, sm=madOff(new Date(base.getTime()+12*36e5))===2;
    const tb=hrsExpand(h.x&&h.x(base)?h.xs:(sm?h.s:h.w))[wd]||[];
    tb.forEach(q=>{ const t=n=>new Date(base.getTime()+(Math.floor(n/100)*60+n%100)*6e4); const a=t(q[0]), b=q[1]==="SS"?sunAt(base,false,90.833):t(q[1]); if(b&&b>a) out.push([a,b]); });
  }
  out.sort((x,y)=>x[0]-y[0]); const m=[];
  out.forEach(x=>{ const l=m[m.length-1]; if(l&&x[0]<=l[1]) l[1]=new Date(Math.max(l[1],x[1])); else m.push([x[0],x[1]]); });
  return m;
}
function hrsToday(iv,now){ const a=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()), b=a+864e5;
  return iv.filter(x=>x[0]<b&&x[1]>a).map(x=>(x[0]<a?"00:00":fz(x[0]))+"–"+(x[1]>=b?"24:00":fz(x[1]))).join(" · "); }
const fz24=d=>d&&d.getUTCHours()===0&&d.getUTCMinutes()===0?"24:00":fz(d);
const fday=(d,now)=>d.getUTCDate()===now.getUTCDate()&&d.getUTCMonth()===now.getUTCMonth()?"":DOW[d.getUTCDay()]+" ";
function adState(now){
  const sn=sun(now), day=!!(sn.rise&&sn.set&&now>=sn.rise&&now<sn.set);
  if(AD.other){
    const h=HRS[AD.icao];
    if(!h) return {st:day?"open":"night",open:day,adOpen:null,unk:true,day,set:sn.set,rise:sn.rise,openAt:sn.rise};
    const iv=hrsIntervals(h,now), cur=iv.find(x=>now>=x[0]&&now<x[1]), nx=iv.find(x=>x[0]>now), ad=!!cur, open=ad&&day;
    return {st:open?"open":ad?"night":"closed",open,adOpen:ad,day,set:sn.set,rise:sn.rise,chg:cur?cur[1]:(nx?nx[0]:null),openAt:nx?nx[0]:null,today:hrsToday(iv,now),sched:madOff(now)===2?"V":"I",h};
  }
  const summer=madOff(now)===2, oh=summer?7:8, op=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),oh,0));
  const st=now<op?"pre":(sn.set&&now>sn.set?"night":"open");
  return {st,open:st==="open",adOpen:st==="open",day:true,openAt:op,set:sn.set,rise:sn.rise,sched:summer?"V":"I"};
}

/* ---------- textos ---------- */
const NOTE={LEGT:"No hay METAR de Cuatro Vientos: se usa Getafe (LEGT), a unos 10 km", LEMD:"No hay METAR de Cuatro Vientos: se usa Madrid-Barajas (LEMD), a unos 26 km"};
const pad3=n=>String(n).padStart(3,"0");
const CATT={VFR:"Meteo VFR",MVFR:"Meteo VFR marginal",IFR:"Meteo IFR",LIFR:"Meteo IFR bajo"};
function kt(w){ if(!w) return "—"; if(w.spd===0&&!w.gst) return "Calma"; return (w.vrb?"Variable":(pad3(w.dir)+"º"))+" · "+w.spd+" kt"+(w.gst?" (rachas "+w.gst+")":"")+(w.var?" · varía "+w.var[0]+"–"+w.var[1]+"º":""); }
function visTxt(v){ return v==null?"—":v>=9999?"≥ 10 km":(v>=1000?(v/1000).toFixed(v%1000?1:0).replace(".",",")+" km":v+" m"); }
function cloudTxt(e){ if(e.cavok) return "CAVOK (sin nubes bajas)"; const c=e.clouds||[]; if(!c.length) return "Sin nubes significativas"; return c.map(x=>(x.t==="VV"?"Cielo oscurecido (VV)":CL[x.t])+" a "+x.h.toLocaleString("es-ES")+" ft"+(x.cb==="CB"?" · cumulonimbus":x.cb==="TCU"?" · cúmulo torreón":"")).join(" · "); }
function wxTxt(e){ const w=e.wx||[]; return w.length?w.map(wxText).join(", "):"Ninguno"; }
function tokCls(t){
  if(/^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(t)) return ["w","Viento: de dónde sopla (grados) y velocidad en nudos; G = rachas"];
  if(/^\d{3}V\d{3}$/.test(t)) return ["w","Viento variable entre esos rumbos"];
  if(/^\d{4}$/.test(t)) return ["v","Visibilidad en metros (9999 = 10 km o más)"]; if(t==="CAVOK") return ["v","CAVOK: visibilidad 10 km o más, sin nubes bajas ni fenómenos"];
  if(/^(FEW|SCT|BKN|OVC|VV)\d{3}/.test(t)||t==="NSC") return ["c","Nubes: cantidad y altura en cientos de pies sobre el campo"];
  if(/^M?\d{2}\/M?\d{2}$/.test(t)) return ["t","Temperatura / punto de rocío (ºC)"];
  if(/^[QA]\d{4}$/.test(t)) return ["q","Presión QNH (hPa)"];
  if(/^(-|\+)?(VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|BR|FG|FU|VA|DU|SA|HZ|SQ|FC|SS|DS)+$/.test(t)) return ["x","Fenómeno meteorológico"];
  return null; }
const rawHtml=raw=>raw.split(/\s+/).map(t=>{ const c=tokCls(t); return c?`<span class="k ${c[0]}" title="${esc(c[1])}">${esc(t)}</span>`:esc(t); }).join(" ");
const RAD=Math.PI/180;
const off=(ll,brg,m)=>[ll[0]+Math.cos(brg*RAD)*m/111320, ll[1]+Math.sin(brg*RAD)*m/(111320*Math.cos(ll[0]*RAD))];
const dayZ=d=>pad(d.getUTCDate())+"/"+pad(d.getUTCMonth()+1);

/* ---------- memoria de la pista en uso (30 min, en esta pestaña): cuando no pasa ningún avión por el eje, se recuerda el último ---------- */
function rwMem(inf){
  try{ const k="f0:rw:"+AD.icao;
    if(inf){ sessionStorage.setItem(k,JSON.stringify({id:inf.id,at:Date.now()})); return {id:inf.id,n:inf.n,live:true}; }
    const v=JSON.parse(sessionStorage.getItem(k)||"null"); if(v&&Date.now()-v.at<=30*60000) return {id:v.id,ago:Math.round((Date.now()-v.at)/60000),live:false}; }catch(e){}
  return inf?{id:inf.id,n:inf.n,live:true}:null; }
/* ---------- pista en uso según el tráfico ADS-B ---------- */
function infer(list){
  const c={}, lat0=AD.lat, lon0=AD.lon, es=ends(); es.forEach(r=>c[r.id]=0);
  (list||[]).forEach(a=>{
    if(a.lat==null||a.tr==null) return;
    if(!a.gnd&&(a.alt==null||a.alt>AD.elev+2500)) return;
    if(a.g==null||a.g<35||a.g>140) return;
    const y=(a.lat-lat0)*60, x=(a.lon-lon0)*60*Math.cos(lat0*RAD);   // millas náuticas al norte y al este del campo
    es.forEach(r=>{ const h=r.hdg*RAD, al=x*Math.sin(h)+y*Math.cos(h), cr=x*Math.cos(h)-y*Math.sin(h), d=Math.abs(((a.tr-r.hdg+540)%360)-180);
      if(d<=20&&Math.abs(cr)<0.35&&Math.abs(al)<5) c[r.id]++; });   // en el eje de la pista (aproximación, recorrido o despegue); el viento en cola queda fuera
  });
  const k=Object.keys(c).sort((p,q)=>c[q]-c[p]); return c[k[0]]>0&&(k.length<2||c[k[0]]>c[k[1]])?{id:k[0],n:c[k[0]]}:null;
}

/* ---------- mapa ---------- */
const PLANE='<svg viewBox="0 0 20 20" width="26" height="26" style="transform:rotate({r}deg)"><path d="M10 1c.9 0 1.4.9 1.4 2v4.6l7 4.2v1.8l-7-2v3.6l1.8 1.4V19L10 18l-3.2 1v-2.4l1.8-1.4v-3.6l-7 2v-1.8l7-4.2V3C8.6 1.9 9.1 1 10 1z" fill="{c}" stroke="{s}" stroke-width="1.1"/></svg>';
const isFS=a=>/^FSM/i.test((a.f||"").trim());   // Flyschool: indicativo FSM en Flightradar → azul y blanco
const CHART={url:"ops-lecu-adc.jpg",ovl:"ops-lecu-ovl.png",b:[[40.36659176,-3.79715401],[40.37154104,-3.77206957]]};
function setMode(m){
  S.mode=m; const M=S.map, R=S.root; if(!M) return;
  if(S.tile){ if(m==="aip"){ if(M.hasLayer(S.tile)) M.removeLayer(S.tile); } else if(!M.hasLayer(S.tile)) S.tile.addTo(M); }
  if(S.img){ if(m!=="aip"){ if(M.hasLayer(S.img)) M.removeLayer(S.img); } else if(!M.hasLayer(S.img)) S.img.addTo(M); }
  if(S.imgO){ if(m!=="ovl"){ if(M.hasLayer(S.imgO)) M.removeLayer(S.imgO); } else if(!M.hasLayer(S.imgO)) S.imgO.addTo(M); }
  M.getContainer().classList.toggle("aip",m==="aip");
  if(R){ R.querySelectorAll(".mseg button").forEach(b=>b.classList.toggle("on",b.dataset.m===m)); const nt=$("#opMapNote",R); if(nt) nt.hidden=m==="sat"; }
  drawMap(S.act);
}
function drawMap(act){
  const L=window.L, M=S.map; if(!L||!M) return;
  if(S.lay) S.lay.clearLayers(); else S.lay=L.layerGroup().addTo(M);
  const g=S.lay; S.act=act;
  AD.rw.forEach(r=>{ const A={a:r.a,b:r.b};
    if((S.mode||"ovl")!=="aip"){
      L.polyline([A.a.ll,A.b.ll],{color:"#FFFFFF",weight:12,opacity:.85}).addTo(g);
      L.polyline([A.a.ll,A.b.ll],{color:"#262A30",weight:8,opacity:1}).addTo(g);
      L.polyline([A.a.ll,A.b.ll],{color:"#FFFFFF",weight:1.5,opacity:.9,dashArray:"7 7"}).addTo(g); }
    const rwOn=act&&(act.id===A.a.id||act.id===A.b.id);
    if(rwOn) L.polyline([A.a.ll,A.b.ll],{color:"#FFC400",weight:16,opacity:.3}).addTo(g);
    [A.a,A.b].forEach(e=>{ const on=act&&act.id===e.id, p=off(e.ll,e.hdg+180,60);
      L.marker(p,{interactive:false,icon:L.divIcon({className:"op-lbl"+(on?" on":""),html:"<span>"+e.id+"</span>"+(on?"<em>EN USO</em>":""),iconSize:null})}).addTo(g); });
    if(rwOn){ const mid=[(A.a.ll[0]+A.b.ll[0])/2,(A.a.ll[1]+A.b.ll[1])/2];
      L.marker(mid,{interactive:false,icon:L.divIcon({className:"op-dir",html:`<svg viewBox="0 0 60 60" width="46" height="46" style="transform:rotate(${act.hdg}deg)"><path d="M30 6 L48 40 L30 32 L12 40 Z" fill="#FFC400" stroke="#262A30" stroke-width="3" stroke-linejoin="round"/></svg>`,iconSize:[46,46],iconAnchor:[23,23]})}).addTo(g); }
  });
}
function drawTraffic(){
  const L=window.L, M=S.map; if(!L||!M) return; if(S.trl) S.trl.clearLayers(); else S.trl=L.layerGroup().addTo(M);
  (S.tr||[]).slice().sort((x,y)=>isFS(x)-isFS(y)).forEach(a=>{ if(a.lat==null) return; const fs=isFS(a), alt=a.gnd?"tierra":(a.alt!=null?Math.round(a.alt/100)*100+" ft":"");
    const ico=(fs?PLANE.replace("{c}","#FFFFFF").replace("{s}","#0B4FA8").replace("stroke-width=\"1.1\"","stroke-width=\"1.6\""):PLANE.replace("{c}","#FFC400").replace("{s}","#14181D")).replace("{r}",a.tr||0);
    const m=L.marker([a.lat,a.lon],{icon:L.divIcon({className:"op-ac"+(fs?" fs":""),html:ico+`<span><b>${esc(a.f||a.r||a.h||"")}</b>${esc(alt)}</span>`,iconSize:[26,26],iconAnchor:[13,13]}),zIndexOffset:fs?900:500});
    m.bindPopup(`<b>${esc(a.f||"—")}</b> ${fs?"· Flyschool":""} ${esc(a.r||"")}<br>${esc(a.t||"")}<br>${esc(alt)}${a.g!=null?" · "+Math.round(a.g)+" kt":""}${a.tr!=null?" · rumbo "+Math.round(a.tr)+"º":""}`); m.addTo(S.trl); });
}
function initMap(){
  const L=window.L, el=$("#opMap",S.root); if(!el) return;
  if(!L){ el.innerHTML='<p class="muted" style="padding:20px">No se ha podido cargar el mapa.</p>'; return; }
  if(S.map){ S.map.remove(); S.map=null; S.lay=null; S.trl=null; }
  const M=L.map(el,{zoomSnap:0.25,scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false,zoomControl:true,attributionControl:true});
  S.tile=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagen: Esri, Maxar · ADS-B: adsb.lol"}).addTo(M);
  M.createPane("chart"); M.getPane("chart").style.zIndex=250;
  const CH=AD.other?AD.chart:CHART;
  const fit=()=>M.fitBounds(L.latLngBounds(AD.other?AD.rw.reduce((l,r)=>l.concat([r.a.ll,r.b.ll]),[]).concat([[AD.lat,AD.lon]]):[AD.main.a.ll,AD.main.b.ll,[CHART.b[0][0],AD.lon]]),{padding:[44,28],maxZoom:AD.other&&!AD.chart?15:16});
  if(AD.other&&!CH){ S.img=null; S.imgO=null; S.mode="sat"; L.control.scale({imperial:false,position:"bottomleft"}).addTo(M); S.fit=fit; fit(); S.map=M; setMode("sat"); setTimeout(()=>{ try{ M.invalidateSize(); fit(); }catch(e){} },120); return; }
  S.img=L.imageOverlay(CH.url,CH.b,{pane:"chart",interactive:false,attribution:"Carta AIP © ENAIRE"});
  S.imgO=L.imageOverlay(CH.ovl,CH.b,{pane:"chart",interactive:false,attribution:"Rodaje: carta AIP © ENAIRE"});
  const SG=L.Control.extend({options:{position:"topright"},onAdd(){ const d=L.DomUtil.create("div","mseg"); d.innerHTML='<button data-m="sat">Satélite</button><button data-m="ovl">Rodaje</button><button data-m="aip">Carta AIP</button>'; L.DomEvent.disableClickPropagation(d); d.addEventListener("click",ev=>{ const b=ev.target.closest("button"); if(b) setMode(b.dataset.m); }); return d; }}); new SG().addTo(M);
  L.control.scale({imperial:false,position:"bottomleft"}).addTo(M);
  S.fit=fit; fit(); S.map=M; setMode(S.mode||"ovl"); setTimeout(()=>{ try{ M.invalidateSize(); fit(); }catch(e){} },120);
}

/* ---------- pintado ---------- */
const mark=(arr)=>arr.every(Boolean)?'<i class="m ok">✔</i>':arr.some(Boolean)?'<i class="m mid" title="Cumple solo algún avión">▲</i>':'<i class="m no">✖</i>';
function wCompass(w){ const calm=!w||(w.spd===0&&!w.gst), vr=w&&w.vrb;
  return `<svg viewBox="0 0 60 60" width="58" height="58"><circle cx="30" cy="30" r="27" fill="none" stroke="var(--ln)" stroke-width="2"/>${calm?'<text x="30" y="35" text-anchor="middle" font-size="12" font-weight="700" fill="var(--mu)">CALMA</text>':vr?'<text x="30" y="35" text-anchor="middle" font-size="14" font-weight="700" fill="var(--mu)">VRB</text>':`<g transform="rotate(${w.dir+180} 30 30)"><path d="M30 6 L40 42 L30 34 L20 42 Z" fill="var(--ink)"/></g>`}</svg>`; }
const ageTxt=m=>m<1?"ahora":m<60?m+" min":Math.floor(m/60)+" h "+(m%60?(m%60)+" min":"");
function decShort(e){ const w=e.wind, ws=!w?"—":(w.spd===0&&!w.gst?"Calma":(w.vrb?"VRB":pad3(w.dir)+"º")+" "+w.spd+(w.gst?"G"+w.gst:"")+" kt");
  const cl=e.cavok?"CAVOK":((e.clouds||[]).map(x=>x.t+" "+x.h.toLocaleString("es-ES")).join(" · ")||"sin nubes");
  return ws+" · "+visTxt(e.vis)+((e.wx&&e.wx.length)?" · "+e.wx.map(wxText).join(", "):"")+" · "+cl+" · "+(e.temp!=null?e.temp+"/"+e.dew+" ºC":"")+(e.qnh?" · QNH "+e.qnh:""); }
function wrow(c,txt,age){ return `<div class="wr"><span class="cc ${c}">${c}</span><span class="wt">${txt}</span>${age==null?"":`<em>${ageTxt(age)}</em>`}</div>`; }
function tile(h,b,s,x,c){ return `<div class="tl ${c||""}"><small>${h}</small>${x||""}<b>${b}</b>${s?`<span>${s}</span>`:""}</div>`; }
function fill(){
  const d=S.data, R=S.root; if(!d||!R) return; const now=new Date(), e=d.m, cat=flightCat(e), st=adState(now);
  $("#opAd",R).className="ad "+(st.unk?"unk":st.adOpen?"open":"closed");
  $("#opAd",R).innerHTML=AD.other?(st.unk?`<b>HORARIO ?</b><small>no consta en la AIP</small>`:st.adOpen?`<b>AD ABIERTO</b><small>${st.h&&st.h.mil?"militar · ":""}hasta ${fz24(st.chg)} Z</small>`:`<b>AD CERRADO</b><small>${st.openAt?"abre "+fday(st.openAt,now)+fz(st.openAt)+" Z":"consulta NOTAM"}</small>`):st.open?`<b>AD ABIERTO</b><small>hasta el ocaso · ${fz(st.set)} Z</small>`:`<b>AD CERRADO</b><small>${st.st==="night"?"noche · ocaso "+fz(st.set)+" Z":"abre "+fz(st.openAt)+" Z"}</small>`;
  const cb=$("#opCat",R); cb.hidden=false; cb.className="cat "+cat; const sn0=sun(now), night=!(sn0.rise&&sn0.set&&now>=sn0.rise&&now<sn0.set); cb.title=night?"Categoría solo por visibilidad y techo de nubes. De noche, el VFR exige habilitación nocturna y aeródromo abierto.":"Categoría por visibilidad y techo de nubes"; cb.innerHTML="<b>"+cat+"</b><small>"+CATT[cat]+(night?" · noche":"")+"</small>"; $("#opTop",R).classList.toggle("cl",AD.other?st.adOpen===false:!st.open);
  const age=d.obs?Math.round((now-d.obs)/60000):null;
  const nte=AD.other?(d.mSt&&d.mSt!==AD.icao?"No hay METAR de "+AD.name+": se usa "+d.mSt+(d.mKm?", a unos "+d.mKm+" km":""):""):(NOTE[d.mSt]||"");
  $("#opSub",R).innerHTML=`${nte||d.demo?`<span class="${nte?"old":""}">${nte}${d.demo?' <b class="dm">DATOS DE EJEMPLO</b>':""}</span>`:""}`+(age==null?"":`<span class="${age>75?"old":""}">${age>75?"Dato antiguo · ":"Observado "}${age<1?"ahora":"hace "+age+" min"} · ${fz(d.obs)} Z</span>`)+`<span>☀ Orto ${fz(st.rise)} Z · Ocaso ${fz(st.set)} Z</span>`+(AD.other&&st.h?`<span>Horario AIP (${st.sched==="V"?"verano":"invierno"}) hoy: ${st.today||"cerrado"} Z</span>${st.h.n?`<span class="${st.h.mil?"old":""}">${st.h.n}</span>`:""}`:"")+(AD.other&&st.unk?`<span class="old">Sin horario publicado en la AIP: confirma por teléfono o NOTAM</span>`:"")+((d.tp&&d.tp.station&&(AD.other?d.tp.station!==AD.icao:!/^(LECU|LEVS)$/.test(d.tp.station)))?`<span class="old">TAF de ${d.tp.station==="LEMD"?"Barajas (LEMD)":d.tp.station}${AD.other&&d.tKm?", a unos "+d.tKm+" km":""}</span>`:"");
  // fichas compactas
  const ce=e.cavok?"CAVOK":e.ceil!=null?e.ceil.toLocaleString("es-ES")+" ft":((e.clouds&&e.clouds.length)?"Sin techo":"Despejado");
  $("#opTiles",R).innerHTML=tile("Viento",e.wind&&e.wind.spd===0&&!e.wind.gst?"Calma":(e.wind?(e.wind.vrb?"VRB":pad3(e.wind.dir)+"º")+" · "+e.wind.spd+" kt":"—"),e.wind&&e.wind.gst?"rachas "+e.wind.gst+" kt":(e.wind&&e.wind.var?"varía "+e.wind.var[0]+"–"+e.wind.var[1]+"º":""),wCompass(e.wind),"wd")
   +tile("Visibilidad",visTxt(e.vis),wxTxt(e)==="Ninguno"?"":wxTxt(e),"","vs")
   +tile("Nubes",ce,e.cavok?"":((e.clouds||[]).map(x=>x.t+" "+(x.h/100)).join(" · ")))
   +tile("Temp.",e.temp!=null?e.temp+" ºC":"—",e.dew!=null?"rocío "+e.dew+" ºC":"")
   +tile("QNH hPa",e.qnh?String(e.qnh):"—","");
  const rm=S.rawMode!==false; const cx=$("#opRawT",R); if(cx) cx.checked=rm;
  const hist=(d.hist&&d.hist.length?d.hist:[d.metar]).slice(0,5);
  $("#opMet",R).innerHTML=hist.map((r,i)=>{ const q=i===0?e:parseMetar(r), ob=obsDate(q,now), ag=ob?Math.round((now-ob)/60000):null; return wrow(flightCat(q),rm?rawHtml(r.replace(/^METAR\s+/,"")):esc(decShort(q)),ag); }).join("")+(!AD.other&&/\sAUTO\s/.test(d.metar)?'<div class="auto">METAR automático: no informa de precipitación (AIP).</div>':"");
  const tp=d.tp;
  $("#opTaf",R).innerHTML=!tp||!d.taf?'<div class="auto">No hay TAF disponible.</div>':(rm?wrow(flightCat(tp.periods[0].e),rawHtml(d.taf.replace(/^TAF\s+(AMD\s+|COR\s+)?/,"")),null):tp.periods.map(p=>`<div class="wr"><span class="cc ${flightCat(p.e)}">${flightCat(p.e)}</span><span class="wt"><b>${esc(p.label)}</b>${p.rng?` <small>${esc(p.rng)}</small>`:""}<br>${esc(decShort(p.e))}</span></div>`).join(""));
  // pista en uso
  const evF=evalOne(e,"fi"), evS=evalOne(e,"solo"), w=evF.w, wind=(e.wind&&!e.wind.vrb&&Math.max(e.wind.spd,e.wind.gst||0)>=3)?w.end:null, live=S.tr?infer(S.tr):null, trf=rwMem(live), act=st.open?(trf?(ends().find(x=>x.id===trf.id)||wind):wind):null;
  let rt;
  if(!st.open) rt=`<div class="sign dim">—</div><div class="rt"><b>${AD.other?(st.adOpen===false?"Aeródromo cerrado":"De noche"):"Aeródromo cerrado"}</b><span>${AD.other?(st.adOpen===false?(st.openAt?"Abre "+fday(st.openAt,now)+fz(st.openAt)+" Z (AIP)":"Consulta NOTAM"):"Está abierto, pero es de noche: los vuelos de la escuela son de día"):st.st==="night"?"Es de noche: el civil abre de día (orto–ocaso)":"Aún no ha abierto"}</span>${wind?`<span>Por viento sería la <b>${wind.id}</b></span>`:""}</div>`;
  else if(trf) rt=`<div class="sign${trf.live?"":" est"}">${trf.id}</div><div class="rt"><b>${trf.live?"En uso según el tráfico":"En uso hace poco"}</b><span>${trf.live?trf.n+" "+(trf.n>1?"aviones alineados":"avión alineado")+" con la pista (ADS-B)":"Último avión alineado: hace "+(trf.ago<1?"menos de 1":trf.ago)+" min (ADS-B)"}</span>${wind?`<span>Por viento: <b>${wind.id}</b> · cara ${Math.round(w.head)} kt · cruzado ${Math.round(w.cross)} kt</span>`:""}</div>`;
  else if(wind) rt=`<div class="sign est">${wind.id}</div><div class="rt"><b>Estimada por el viento</b><span>No hay tráfico en la pista para saber la real</span><span>${w.head>=0?"Cara":"Cola"} <b>${Math.abs(Math.round(w.head))} kt</b> · cruzado <b>${Math.round(w.cross)} kt</b>${w.side?" por la "+w.side:""}</span></div>`;
  else rt=`<div class="sign dim">—</div><div class="rt"><b>Sin pista preferente</b><span>Viento flojo o variable (menos de 3 kt)</span></div>`;
  $("#opRwy",R).innerHTML=rt; drawMap(act);
  // mínimos
  const f1=evF.ac.cz.f, f2=evS.ac.cz.f, all=(ev,k)=>Object.keys(AC).map(a=>ev.ac[a].f[k]), open=st.open;
  const cell=(ok,txt,nn)=>`<td class="lim ${nn&&!open?"n":(ok===true?"g":ok===false?"r":"a")}">${txt}</td>`;
  const tri=arr=>arr.every(Boolean)?true:arr.some(Boolean)?null:false;
  const chips=ev=>Object.keys(AC).map(k=>{ const s=open?ev.ac[k].s:"no", why=open?(ev.ac[k].why.join(" · ")||"Dentro de todos los mínimos"):(AD.other&&st.adOpen?"De noche":"Aeródromo cerrado"); return `<span class="ac ${s}" title="${esc(why)}">${AC[k].c}</span>`; }).join("");
  $("#opMin",R).innerHTML=`<table class="mn"><thead><tr><th></th><th>Ahora</th><th>Instructor</th><th>Solo</th></tr></thead><tbody>
   <tr><th>Horario</th><td><b class="${open?"":"r"}">${open?"Día":(AD.other&&st.adOpen===false?"Cerrado":"Noche")}</b></td>${cell(open,"de día")}${cell(open,"de día")}</tr>
   <tr><th>Visibilidad</th><td><b>${visTxt(e.vis)}</b></td>${cell(f1.vis,"≥ 5 km",1)}${cell(f2.vis,"≥ 8 km",1)}</tr>
   <tr><th>Techo</th><td><b>${e.ceil==null?"Sin techo":e.ceil.toLocaleString("es-ES")+" ft"}</b></td>${cell(f1.cig,"≥ 1.500 ft",1)}${cell(f2.cig,"≥ 2.500 ft",1)}</tr>
   <tr><th>Cruzado</th><td><b>${Math.round(w.cross)} kt</b></td>${cell(tri(all(evF,"cross")),"≤ 12 · 15 · 15",1)}${cell(tri(all(evS,"cross")),"≤ 10 · 12 · 12",1)}</tr>
   <tr><th>De cara</th><td><b>${Math.max(0,Math.round(w.head))} kt</b></td>${cell(f1.head,"≤ 20 kt",1)}${cell(f2.head,"≤ 20 kt",1)}</tr>
   <tr><th>De cola</th><td><b>${Math.max(0,Math.round(-w.head))} kt</b></td>${cell(f1.tail,"≤ 5 kt",1)}${cell(f2.tail,"0 kt",1)}</tr>
   <tr><th>Temp.</th><td><b>${e.temp!=null?e.temp+" ºC":"—"}</b></td>${cell(tri(all(evF,"temp")),"≤ 32 · 35 · 35",1)}${cell(tri(all(evS,"temp")),"≤ 32 ºC",1)}</tr>
   <tr class="res"><th>¿Se puede?</th><td></td><td>${chips(evF)}</td><td>${chips(evS)}</td></tr></tbody></table>
   <p class="nt">${open?"":(AD.other&&st.adOpen?"De noche: ":"Fuera de horario: ")+"el resto de límites no aplican. "}Orientativo: decide el HT o el CFI.</p>`;
  const pe=$("#opPist",R); if(pe) pe.innerHTML=pistHTML(e);
  const ts=$("#opTrSt",R); if(ts) ts.textContent=S.tr?("✈ "+S.tr.length+" aviones"+(S.tr.some(isFS)?" · "+S.tr.filter(isFS).length+" Flyschool":"")+" · ADS-B"+(S.trSrc?" ("+S.trSrc+")":"")+" · "+fz(S.trAt)+" Z"):"ADS-B no disponible"+(S.trWhy?" ("+S.trWhy+")":"");
}
/* Distancias declaradas (AIP AD 2.12/2.13, uso civil, sin salidas por intersección): [pista, elev. umbral ft, TORA, TODA, ASDA, LDA] por pares de cabeceras */
const DD={"LEVD":[["05",2767,3005,3305,3005,3005],["23",2775,3005,3211,3005,3005]],"LEBG":[["04",2941,2099,2099,2099,2099],["22",2962,2099,2099,2099,2099]],"LESA":[["03",2595,2513,2513,2788,2513],["21",2586,2513,2513,2788,2513]],"LEAB":[["09",2281,2700,3080,2700,2700],["27",2301,2700,3080,2700,2700]],"LEBA":[["03",291,2076,2136,2076,2050],["21",305,2241,2301,2241,2050]],"LEBZ":[["13",578,2852,3152,3152,2852],["31",608,2852,3152,3152,2852]],"LETL":[["18",3297,2539,2539,2825,2539],["36",3366,2825,2825,2825,2539]],"LELN":[["05",2994,3000,3000,3000,3000],["23",2996,3000,3000,3000,3000]],"LELO":[["11",1156,2200,2260,2200,2200],["29",1139,2200,2260,2200,2200]],"LESO":[["04",10,1590,1753,1590,1427],["22",14,1590,1753,1590,1427]],"LEGR":[["09",1842,2900,2960,2900,2900],["27",1860,2900,2960,2900,2900]],"LEZL":[["09",83,3364,3424,3364,3364],["27",111,3364,3424,3364,3364]],"LELC":[["04R",12,2320,2516,2320,2320],["22L",6,2320,2508,2320,2320],["04L",29,1317,1377,1746,1577],["22R",17,1268,1328,1714,1577]],"LEPP":[["15",1467,2205,2285,2205,2205],["33",1500,2405,2505,2405,1907]],"LEXJ":[["11",11,2320,2380,2320,2320],["29",12,2320,2380,2320,2320]],"LEAS":[["11",399,2205,2355,2205,2205],["29",399,2205,2325,2205,2205]],"LECH":[["06",1093,2700,2770,2770,2700],["24",1182,2700,2770,2770,2700]],"LEAM":[["07",26,3165,3225,3165,3050],["25",70,3165,3260,3165,3165]],"LEJR":[["02",68,2300,2300,2300,2300],["20",93,2300,2300,2300,2300]],"LELL":[["13",485,899,899,899,899],["31",445,899,899,899,899]]}, DDN={"LETL":"36: umbral desplazado 286 m (LDA < TORA).","LEPP":"33: umbral desplazado 500 m.","LEAM":"07: umbral desplazado 115 m.","LESO":"Ambos umbrales desplazados 163 m.","LELL":"13: últimos 150 m inutilizables (aterrizaje y despegue). 31: umbral desplazado 150 m y últimos 150 m inutilizables para despegar. Pista útil real: 899 m.","LELC":"Base militar: la AIP no la publica para civiles. Pistas 04L/22R solo militares (valores militares).","LEBG":"Salida por intersección C: pista 04 → 822 m; 22 → 1292 m (de día, VMC, envergadura ≤ 15 m, avisar al AFIS).","LEAB":"ASDA civil. Las intersecciones no publican LDA."};
const ddTbl=(rows,t)=>{ const o=[]; for(let i=0;i+1<rows.length;i+=2) o.push([rows[i],rows[i+1]]);
  return o.map(([a,b])=>`<table class="tbl rw"><thead><tr><th></th><th><span class="sign sm">${a[0]}</span></th><th><span class="sign sm">${b[0]}</span></th></tr></thead><tbody><tr><th>Elevación umbral</th><td>${a[1]} ft</td><td>${b[1]} ft</td></tr>${["TORA","TODA","ASDA","LDA"].map((k,j)=>`<tr><th>${k}</th><td>${a[j+2]} m</td><td>${b[j+2]} m</td></tr>`).join("")}</tbody></table>`).join(""); };
function pistHTML(e){
  const w=e.wind, v=w?Math.max(w.spd,w.gst||0):0, es=ends(), calm=!w||v===0;
  const rows=es.map(r=>{ const rel=(!w||w.vrb)?0:((w.dir-r.hdg)%360+360)%360, a=rel*RAD, hd=calm?0:(w.vrb?0:Math.cos(a)*v), cr=calm?0:(w.vrb?v:Math.abs(Math.sin(a))*v), side=(w&&!w.vrb&&rel>0&&rel<180)?"derecha":"izquierda"; return {r,hd,cr,side}; });
  const best=calm?null:rows.reduce((b,x)=>!b||x.hd>b.hd+0.01?x:b,null);
  const body=rows.map(x=>{ const hc=calm?"":(x.hd>=0?"g":(-x.hd>MIN.tailFi?"r":"a")), cc=calm?"":(x.cr<=12?"g":x.cr<=15?"a":"r");
    return `<tr class="${best&&best.r.id===x.r.id?"best":""}"><th><span class="sign sm">${x.r.id}</span></th><td>${x.r.hdg}º</td><td>${x.r.len} m<small>${x.r.surf}</small></td><td class="lim ${hc}">${calm?"—":Math.abs(Math.round(x.hd))+" kt"}<small>${calm?"":x.hd>=0?"de cara":"de cola"}</small></td><td class="lim ${cc}">${calm?"—":Math.round(x.cr)+" kt"}<small>${calm?"":"por la "+x.side}</small></td></tr>`; }).join("");
  let h=`<table class="tbl pst"><thead><tr><th>Pista</th><th>Rumbo</th><th>Longitud</th><th>Viento</th><th>Cruzado</th></tr></thead><tbody>${body}</tbody></table>
   ${AD.other?`<p class="src">${AD.chart&&AD.chart.thr?"Umbrales: AIP ADC 1.1 · longitudes: OurAirports (no oficial).":"Datos de OurAirports (no oficial): confirma en la AIP."}</p>`:""}`;
  if(AD.other){ const r=DD[AD.icao]; h+=r?`<div class="hs">Distancias declaradas · AIP</div>${ddTbl(r)}<p class="src">AIP AD 2.12/2.13, uso civil, despegue desde el umbral (sin salidas por intersección).${DDN[AD.icao]?" "+DDN[AD.icao]:""}</p>`:`<p class="src">Sin ficha en la AIP: no hay distancias declaradas. Confirma la longitud útil con el aeródromo.</p>`; }
  if(!AD.other){ const A=AD.main; h+=`<div class="hs">Distancias declaradas · AIP</div><table class="tbl rw"><thead><tr><th></th><th><span class="sign sm">${A.a.id}</span></th><th><span class="sign sm">${A.b.id}</span></th></tr></thead><tbody>
      <tr><th>Elevación umbral</th><td>${A.a.el} ft</td><td>${A.b.el} ft</td></tr><tr><th>TORA</th><td>${A.a.tora} m</td><td>${A.b.tora} m</td></tr><tr><th>TODA</th><td>${A.a.toda} m</td><td>${A.b.toda} m</td></tr><tr><th>ASDA</th><td>${A.a.asda} m</td><td>${A.b.asda} m</td></tr><tr><th>LDA</th><td>${A.a.lda} m</td><td>${A.b.lda} m</td></tr><tr><th>Zona de parada</th><td>${A.a.swy} m</td><td>${A.b.swy} m</td></tr></tbody></table>`; }
  return h; }
/* ---------- cielo de la cabecera: sol y luna reales (fórmulas tipo SunCalc) según la hora Z y el aeródromo ---------- */
const E0=RAD0*23.4397, toD=d=>d.valueOf()/864e5-0.5+2440588-2451545;
const rAsc=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(E0)-Math.tan(b)*Math.sin(E0),Math.cos(l)), decl=(l,b)=>Math.asin(Math.sin(b)*Math.cos(E0)+Math.cos(b)*Math.sin(E0)*Math.sin(l));
const azAlt=(H,phi,dec)=>({az:Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi)),alt:Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H))});
function skyAt(date){
  const d=toD(date), phi=AD.lat*RAD0, st=RAD0*(280.16+360.9856235*d)+AD.lon*RAD0;
  const M=RAD0*(357.5291+0.98560028*d), Ls=M+RAD0*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M))+RAD0*102.9372+Math.PI, sdec=decl(Ls,0), sra=rAsc(Ls,0);
  const Lm=RAD0*(218.316+13.176396*d), Mm=RAD0*(134.963+13.064993*d), Fm=RAD0*(93.272+13.22935*d), lm=Lm+RAD0*6.289*Math.sin(Mm), bm=RAD0*5.128*Math.sin(Fm), mdist=385001-20905*Math.cos(Mm), mra=rAsc(lm,bm), mdec=decl(lm,bm);
  const sa=azAlt(st-sra,phi,sdec), ma=azAlt(st-mra,phi,mdec), sd=149598000;
  const ph=Math.acos(Math.sin(sdec)*Math.sin(mdec)+Math.cos(sdec)*Math.cos(mdec)*Math.cos(sra-mra)), inc=Math.atan2(sd*Math.sin(ph),mdist-sd*Math.cos(ph)), ang=Math.atan2(Math.cos(sdec)*Math.sin(sra-mra),Math.sin(sdec)*Math.cos(mdec)-Math.cos(sdec)*Math.sin(mdec)*Math.cos(sra-mra));
  return {sun:{az:sa.az/RAD0,alt:sa.alt/RAD0}, moon:{az:ma.az/RAD0,alt:ma.alt/RAD0,ph:0.5+0.5*inc*(ang<0?-1:1)/Math.PI}};
}
const cl01=x=>Math.max(0,Math.min(1,x)), lerp=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t)), rgb=c=>"rgb("+c.join(",")+")";
function moonSVG(p){ const r=18, q=p<0.5?p:1-p, k=Math.cos(2*Math.PI*q), rx=(Math.abs(k)*r).toFixed(2);
  return `<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="${r}" fill="#2B3350"/><g${p<0.5?"":' transform="translate(40 0) scale(-1 1)"'}><path d="M20 2A${r} ${r} 0 0 1 20 38A${rx} ${r} 0 0 ${k>0?0:1} 20 2Z" fill="#F4F1DE"/></g><circle cx="20" cy="20" r="${r}" fill="none" stroke="rgba(255,255,255,.25)"/></svg>`; }
/* ---------- tiempo en la cabecera (como Windy): las nubes del METAR pasan por delante del sol y la luna; lluvia, nieve, niebla y tormenta ---------- */
const CLD=[[8,30,150,70],[62,12,130,90],[34,48,170,64],[84,40,140,80],[20,6,120,100],[50,30,160,76],[72,2,150,84],[92,16,110,96],[2,52,130,88],[44,0,140,110]];
const CSVG='<svg viewBox="0 0 120 50"><g fill="currentColor"><ellipse cx="35" cy="32" rx="30" ry="14"/><ellipse cx="62" cy="22" rx="26" ry="16"/><ellipse cx="90" cy="33" rx="27" ry="13"/><rect x="35" y="30" width="55" height="16" rx="8"/></g></svg>';
function wxOf(m){
  const o={cov:0,rain:0,snow:0,fog:0,ts:0,dark:0};
  if(!m) return o;
  const cs=m.clouds||[]; o.cov=m.cavok?0:cs.reduce((a,c)=>Math.max(a,c.t==="FEW"?0.2:c.t==="SCT"?0.45:c.t==="BKN"?0.75:1),0);
  if(cs.some(c=>c.cb)) o.dark=1;
  (m.wx||[]).forEach(w=>{ const k=w[0]==="+"?1:w[0]==="-"?0.45:0.75;
    if(/SN|SG|PL|GS/.test(w)) o.snow=Math.max(o.snow,k);
    else if(/RA|DZ|GR/.test(w)) o.rain=Math.max(o.rain,/DZ/.test(w)?0.35:k);
    if(/TS/.test(w)){ o.ts=1; o.dark=1; o.rain=Math.max(o.rain,0.6); }
    if(/FG|FZFG/.test(w)) o.fog=Math.max(o.fog,0.85); else if(/BR|HZ|FU|DU|SA/.test(w)) o.fog=Math.max(o.fog,0.35); });
  if(m.vis!=null&&m.vis<1000) o.fog=Math.max(o.fog,0.85);
  if(o.rain||o.snow) o.cov=Math.max(o.cov,0.9);
  return o;
}
function skyWx(){
  const R=S.root, w=R&&$("#opWx",R); if(!w) return;
  const x=wxOf(S.data&&S.data.m); S.skyW=x;
  const n=x.cov>=0.95?9:x.cov>=0.7?7:x.cov>=0.4?4:x.cov>0?2:0, ord=[0,1,2,3,4,5,6,7,8,9], key=[n,x.rain,x.snow,x.fog,x.ts].join();
  if(w.dataset.k===key){ skyUpdate(); return; } w.dataset.k=key;
  w.innerHTML=ord.slice(0,n).map(i=>{ const c=CLD[i]; return `<div class="cd" style="left:${c[0]}%;top:${c[1]}%;width:${c[2]}px;animation-duration:${c[3]}s;animation-delay:-${(i*13)%c[3]}s">${CSVG}</div>`; }).join("")
    +'<div class="veil"></div>'+(x.fog?'<div class="fog"></div>':"")+(x.snow?'<div class="snow"></div>':"")+(x.rain?'<div class="rain"></div>':"")+(x.ts?'<div class="fl"></div>':"");
  skyUpdate();
}
/* Cielo de la tarjeta de INICIO: mismo sol y luna reales que la cabecera (LECU), con una paleta más oscura para que el texto se lea. */
function skyCard(now){
  const sv=AD; AD=AD0; let k; try{ k=skyAt(now||new Date()); }finally{ AD=sv; }
  const alt=k.sun.alt, t=cl01((alt+12)/24), warm=cl01(1-Math.abs(alt-1)/9);
  let top=lerp([8,12,30],[34,86,156],t), bot=lerp([18,28,58],[92,156,212],t);
  top=lerp(top,[64,52,100],warm*0.55); bot=lerp(bot,[226,126,70],warm*0.85);
  const pl=(a,op)=>({l:Math.max(5,Math.min(95,50+a.az/110*44)).toFixed(1),b:Math.max(-20,a.alt).toFixed(1),o:(op*cl01((a.alt+4)/6)).toFixed(2)});
  return {bg:"linear-gradient(180deg,"+rgb(top)+","+rgb(bot)+")", st:cl01(1-(alt+3)/14).toFixed(2), alt,
    stars:STARS, sun:Object.assign(pl(k.sun,0.95),{bg:"radial-gradient(circle,"+(warm>0.25?"#FFE2A8":"#FFF6C8")+" 0,#FFC400 55%,rgba(255,196,0,0) 72%)"}),
    moon:Object.assign(pl(k.moon,0.95*(1-0.6*t)),{svg:moonSVG(k.moon.ph)})};
}
function skyUpdate(){
  const R=S.root, sk=R&&$("#opSky",R); if(!sk) return;
  const k=skyAt(new Date()), alt=k.sun.alt, t=cl01((alt+12)/24), warm=cl01(1-Math.abs(alt-1)/9);
  let top=lerp([6,10,26],[120,184,240],t), bot=lerp([18,28,58],[214,236,252],t);
  top=lerp(top,[64,56,104],warm*0.55); bot=lerp(bot,[236,132,74],warm*0.9);
  const W=S.skyW||{cov:0,rain:0,snow:0,fog:0,ts:0,dark:0}, gc=lerp([30,36,48],[150,160,172],t), wet=Math.max(W.rain,W.snow*0.6,W.dark);
  top=lerp(top,gc,W.cov*(0.55+0.25*wet)); bot=lerp(bot,gc,W.cov*(0.5+0.3*wet));
  const cc=lerp(lerp([78,88,108],[248,250,253],t),[92,100,114],Math.min(1,wet*0.65+(W.cov>=0.95?0.15:0)));
  const vl=Math.max(0,W.cov-0.7)*1.6, dim=Math.max(0.12,(1-vl*1.1)*(1-0.6*W.fog));
  sk.style.setProperty("--cc",rgb(cc)); sk.style.setProperty("--vl",vl.toFixed(2)); sk.style.setProperty("--ra",W.rain.toFixed(2)); sk.style.setProperty("--sn",W.snow.toFixed(2)); sk.style.setProperty("--fg",W.fog.toFixed(2));
  sk.style.background="linear-gradient(180deg,"+rgb(top)+","+rgb(bot)+")";
  const lum=(0.299*(top[0]+bot[0])+0.587*(top[1]+bot[1])+0.114*(top[2]+bot[2]))/510; $("#opTop",R).classList.toggle("lt",lum>0.6);
  sk.style.setProperty("--st",cl01(1-(alt+3)/14).toFixed(2));
  const place=(el,a,op)=>{ el.style.left=Math.max(5,Math.min(95,50+a.az/110*44))+"%"; el.style.bottom=Math.max(-20,a.alt/70*70)+"%"; el.style.opacity=(op*cl01((a.alt+4)/6)).toFixed(2); };
  const sun=$("#opSun",R), moon=$("#opMoon",R);
  place(sun,k.sun,dim); sun.style.background="radial-gradient(circle,"+(warm>0.25?"#FFE2A8":"#FFF6C8")+" 0,#FFC400 55%,rgba(255,196,0,.0) 72%)";
  place(moon,k.moon,(lum>0.6?0.35:1)*dim); moon.innerHTML=moonSVG(k.moon.ph);
}
function clock(){ const R=S.root; if(!R) return; const n=new Date(), z=$("#opZ",R), dd=$("#opD",R); if(z) z.textContent=pad(n.getUTCHours())+":"+pad(n.getUTCMinutes()); if(dd) dd.textContent=dayZ(n); skyUpdate(); }
function setData(raw){
  const m=parseMetar(raw.metar.raw), tp=raw.taf?parseTaf(raw.taf.raw):null;
  S.data={m,tp,hist:raw.metar.hist||null,metar:raw.metar.raw,taf:raw.taf?raw.taf.raw:"",mSt:raw.metar.station,mKm:raw.metar.km||0,tKm:raw.taf?raw.taf.km||0:0,obs:obsDate(m,new Date()),demo:!!raw.demo};
  const er=$("#opErr",S.root); if(er) er.hidden=true; fill(); skyWx();
}
/* Resumen compacto de LECU para la tarjeta de INICIO (sin pintar OPS). Devuelve {cat,temp,wind,vis,ad,age} o lanza error. */
function brief(fetchWx){
  return fetchWx().then(r=>{ if(!r||!r.metar) throw 0;
    const m=parseMetar(r.metar.raw), now=new Date(), od=obsDate(m,now), sv=AD; AD=AD0; let st; try{ st=adState(now); }finally{ AD=sv; }
    const w=m.wind, wt=!w?"—":(w.spd===0&&!w.gst?"Viento calma":(w.vrb?"VRB":pad3(w.dir)+"º")+" "+w.spd+(w.gst?"G"+w.gst:"")+" kt"),
      vv=m.vis==null||m.vis>=9999?"≥10 km":(m.vis>=1000?(Math.round(m.vis/100)/10)+" km":m.vis+" m");
    return {cat:flightCat(m),temp:m.temp,wind:wt,vis:vv,qnh:m.qnh,ad:st.adOpen,adTxt:st.adOpen?"abierto":"cerrado",age:od?Math.round((now-od)/6e4):null};
  });
}
function load(){
  const f0=S.opt&&S.opt.fetchWx, R=S.root, g=S.gen, f=f0&&(()=>f0(S.opt.multi?AD.icao:undefined));
  const fail=()=>{ const er=$("#opErr",R); if(er){ er.hidden=false; } };
  if(!f){ setData(demoData(S.scen)); return; }
  f().then(r=>{ if(g!==S.gen) return; if(!r||!r.metar) throw 0; setData(r); }).catch(()=>{ if(g===S.gen) fail(); });
}
/* Tráfico: primero el Worker; si falla (las redes ADS-B a veces bloquean a Cloudflare), el navegador las pide directamente. */
const TRDIR=(la,lo)=>{ const a=(+la).toFixed(4), o=(+lo).toFixed(4), dy=0.25, dx=0.25/Math.cos(la*Math.PI/180);
  return [["adsb.lol",`https://api.adsb.lol/v2/point/${a}/${o}/15`],["airplanes.live",`https://api.airplanes.live/v2/point/${a}/${o}/15`],
    ["adsb.fi",`https://opendata.adsb.fi/api/v2/lat/${a}/lon/${o}/dist/15`],
    ["OpenSky",`https://opensky-network.org/api/states/all?lamin=${(la-dy).toFixed(3)}&lomin=${(lo-dx).toFixed(3)}&lamax=${(la+dy).toFixed(3)}&lomax=${(lo+dx).toFixed(3)}`]]; };
function trMap(j){
  const arr=j&&(j.ac||j.aircraft);
  if(Array.isArray(arr)) return arr.filter(a=>a.lat!=null&&a.lon!=null).slice(0,120).map(a=>({h:a.hex,f:(a.flight||"").trim(),r:a.r||"",t:a.t||"",lat:a.lat,lon:a.lon,
    gnd:a.alt_baro==="ground",alt:typeof a.alt_baro==="number"?a.alt_baro:null,g:a.gs!=null?a.gs:null,tr:a.track!=null?a.track:(a.true_heading!=null?a.true_heading:null)}));
  if(j&&"states" in j) return (j.states||[]).filter(s=>s[5]!=null&&s[6]!=null).slice(0,120).map(s=>({h:s[0],f:(s[1]||"").trim(),r:"",t:"",lat:s[6],lon:s[5],gnd:!!s[8],
    alt:s[8]?null:(s[7]!=null?Math.round(s[7]*3.28084):null),g:s[9]!=null?s[9]*1.94384:null,tr:s[10]}));
  return null;
}
async function trDirect(){
  const why=[];
  for(const [n,u] of TRDIR(AD.lat,AD.lon)){
    const c=new AbortController(), to=setTimeout(()=>c.abort(),7000);
    try{ const r=await fetch(u,{signal:c.signal,cache:"no-store"}); if(!r.ok){ why.push(n+" "+r.status); continue; } const ac=trMap(await r.json()); if(ac) return {ac,src:n}; why.push(n+" sin datos"); }
    catch(e){ why.push(n+(e&&e.name==="AbortError"?" sin respuesta":" bloqueado")); }
    finally{ clearTimeout(to); }
  }
  throw new Error(why.join(" · "));
}
function loadTr(){
  const f0=S.opt&&S.opt.fetchTr, g=S.gen; if(!f0) return;
  const viaW=Date.now()-(S.trWbad||0)>300000;   // si el Worker falló hace menos de 5 min, directo
  const p=viaW?f0(S.opt.multi?AD.icao:undefined).then(r=>{ if(!r||!r.ac||r.ok===false) throw new Error("servidor"); return r; })
    .catch(e=>{ S.trWbad=Date.now(); S.trWwhy=String(e&&e.message||"servidor"); return trDirect(); }):trDirect();
  p.then(r=>{ if(g!==S.gen) return; S.tr=r.ac; S.trSrc=r.src||""; S.trAt=new Date(); S.trWhy=""; })
   .catch(e=>{ if(g===S.gen){ S.tr=null; S.trWhy=String(e&&e.message||"sin respuesta").slice(0,200); } })
   .then(()=>{ if(!S.root||g!==S.gen) return; drawTraffic(); if(S.data) fill(); });
}
const CSS=`.op{--bg:#E6E9EC;--pn:#FFFFFF;--ink:#171C21;--mu:#5E6873;--ln:#D2D7DD;--hd:#1C2128;--am:#FFC400;--vfr:#1E9E44;--mvfr:#2F6FD0;--ifr:#D23A2F;--lifr:#B02FA5;--ok:#1E8A42;--no:#C9372C;--mid:#B7791F;--okb:#E3F3E8;--nob:#FBE5E3;--midb:#FFF1D6;--k1:#0B5CAD;--k2:#8A4B00;--k3:#5A3E9B;--k4:#9A2A2A;--k5:#0B7A6B;
 min-height:65vh;background:var(--bg);color:var(--ink);font:15px/1.45 Barlow,system-ui,-apple-system,"Segoe UI",sans-serif}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .op{--bg:#0D1013;--pn:#161A1F;--ink:#E6E9EC;--mu:#8E98A3;--ln:#2A3037;--hd:#090B0E;--okb:#12301E;--nob:#3A1917;--midb:#33290F;--ok:#4CC97A;--no:#F0746B;--mid:#E3B341;--k1:#6CB4FF;--k2:#E9A95B;--k3:#B7A2F2;--k4:#F08E8E;--k5:#5CD1BE}
}
:root[data-theme="dark"] .op{--bg:#0D1013;--pn:#161A1F;--ink:#E6E9EC;--mu:#8E98A3;--ln:#2A3037;--hd:#090B0E;--okb:#12301E;--nob:#3A1917;--midb:#33290F;--ok:#4CC97A;--no:#F0746B;--mid:#E3B341;--k1:#6CB4FF;--k2:#E9A95B;--k3:#B7A2F2;--k4:#F08E8E;--k5:#5CD1BE}
.op *{box-sizing:border-box}
.op .muted{color:var(--mu)}
.op a{color:var(--k1)}
.op .op-top{background:var(--hd);color:#fff;display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;padding:12px max(16px,env(safe-area-inset-right,0px)) 12px max(16px,env(safe-area-inset-left,0px))}
.op .op-top .id b{display:block;font:700 40px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.04em}
.op .op-top .id span{color:#9AA5B1;font-size:14px}
.op .cat,.op .ad{display:flex;flex-direction:column;border-radius:6px;padding:4px 12px;background:var(--vfr);color:#fff;min-width:120px}
.op .cat b,.op .ad b{font:700 22px/1.1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.06em}
.op .cat small,.op .ad small{font:600 12px Barlow,sans-serif;letter-spacing:.03em;opacity:.95}
.op .cat.MVFR{background:var(--mvfr)}
.op .cat.IFR{background:var(--ifr)}
.op .cat.LIFR{background:var(--lifr)}
.op .ad.open{background:#2D3640;border:1px solid #4B5663}
.op .ad.closed{background:#8E1B1B;border:1px solid #D45A5A}
.op .ad.unk{background:#4B5663;border:1px solid #7A8794}
.op .op-top .tm{margin-left:auto;text-align:right}
.op .op-top .tm small{display:block;font:600 11px Barlow,sans-serif;letter-spacing:.14em;color:#9AA5B1}
.op .op-top .tm b{font:600 34px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.05em;font-variant-numeric:tabular-nums;color:var(--am)}
.op .op-top .tm b i{font-style:normal;font-size:18px;color:#fff;margin-left:4px}
.op .op-sub{display:flex;flex-wrap:wrap;gap:4px 22px;padding:8px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));background:var(--pn);border-bottom:1px solid var(--ln);font-size:14px;color:var(--mu)}
.op .op-sub .old{color:var(--no);font-weight:600}
.op .op-sub .dm{color:var(--mid)}
.op .op-err{margin:12px max(16px,env(safe-area-inset-left,0px)) 0;padding:10px 14px;border:1px solid var(--no);background:var(--nob);border-radius:6px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.op .op-err[hidden]{display:none!important}
.op .op-err a,.op .op-err button{font:600 14px Barlow,sans-serif;color:var(--ink);border:1px solid var(--ink);background:transparent;border-radius:6px;padding:6px 12px;text-decoration:none;cursor:pointer}
.op .op-in{max-width:1240px;margin:0 auto;padding:14px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px));display:grid;gap:14px}
.op .op-hero{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
@media (min-width:980px){.op .op-hero{grid-template-columns:minmax(0,2fr) minmax(300px,1fr)}
.op .op-two{grid-template-columns:1fr 1fr!important}
}
.op .pn{background:var(--pn);border:1px solid var(--ln);border-radius:8px;min-width:0}
.op .pn>h2{margin:0;padding:10px 14px;border-bottom:1px solid var(--ln);font:700 16px/1.2 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mu);display:flex;justify-content:space-between;gap:8px}
.op .pn>h2 small{font:600 12px Barlow,sans-serif;letter-spacing:.04em;text-transform:none}
.op .pn .bd{padding:12px 14px}
.op .tiles{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:12px}
.op .tl{border:1px solid var(--ln);border-radius:8px;padding:10px 12px;display:grid;gap:2px;align-content:start;position:relative;min-height:92px}
.op .tl small{font:600 12px Barlow,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mu)}
.op .tl b{font:700 26px/1.1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.02em}
.op .tl span{font-size:13px;color:var(--mu)}
.op .tl svg{position:absolute;right:10px;top:10px}
.op .tl.wd{grid-column:span 2}
.op .tl.wd b{font-size:30px}
.op .tl.wd svg{width:64px;height:64px;top:12px;right:14px}
.op .fq{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0;font-size:14.5px}
.op .fq dt{color:var(--mu)}
.op .fq dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.op .sign.sm{display:inline-block;font-size:26px;min-width:0;padding:5px 10px;outline-offset:-5px;border-radius:5px}
.op .tbl.rw th{text-transform:none;letter-spacing:0;font:600 14.5px Barlow,sans-serif;color:var(--mu)}
.op .tbl.rw thead th{text-align:left}
.op .tbl.rw td{font-weight:600}
.op .op-map{overflow:hidden;position:relative}
.op #opMap{height:clamp(300px,52vh,560px);background:#2B3138}
.op .op-lbl{white-space:nowrap}
.op .op-lbl span{display:inline-block;transform:translate(-50%,-50%);background:#14181D;color:#fff;font:700 15px/1 Barlow,sans-serif;border:2px solid #fff;border-radius:5px;padding:3px 7px}
.op .op-lbl.on span{background:var(--am);color:#14181D;border-color:#14181D;font-size:17px}
.op .op-lbl em{position:absolute;left:0;top:16px;transform:translateX(-50%);font:700 11px Barlow,sans-serif;font-style:normal;letter-spacing:.08em;background:#14181D;color:var(--am);padding:2px 6px;border-radius:4px}
.op .op-dir svg{filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}
.op .mseg{display:flex;background:rgba(20,24,29,.9);border:1px solid #3A424B;border-radius:8px;overflow:hidden;margin:10px!important}
.op .mseg button{font:600 12.5px Barlow,sans-serif;color:#C9D1D9;background:transparent;border:0;padding:6px 10px;cursor:pointer}
.op .mseg button.on{background:var(--am);color:#14181D}
.op #opMap.aip{background:#fff}
.op 
.op .mapnote{padding:6px 12px;margin:0;border-top:1px solid var(--ln)}
.op .op-ac{position:relative}
.op .op-ac svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}
.op .op-ac span{position:absolute;left:24px;top:2px;white-space:nowrap;font:600 11px/1.15 Barlow,sans-serif;color:#fff;background:rgba(20,24,29,.82);border-radius:3px;padding:1px 4px}
.op .op-ac span b{display:block;font-size:12px}
.op .op-ac.fs svg{filter:drop-shadow(0 0 3px #0B4FA8) drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.op .op-ac.fs span{background:#0B4FA8;color:#fff;border:1px solid #fff}
.op .leaflet-container{font-family:Barlow,system-ui,sans-serif}
.op .op-side{display:grid;gap:14px;align-content:start}
.op .rwy{display:flex;gap:14px;align-items:center}
.op .sign{background:#000;color:#FFD100;font:700 52px/1 "Barlow Condensed",Arial,sans-serif;letter-spacing:.04em;padding:8px 18px;border-radius:6px;outline:2px solid #FFD100;outline-offset:-7px;min-width:88px;text-align:center}
.op .sign.est{color:#C9B13A;outline-color:#C9B13A;outline-style:dashed}
.op .sign.dim{color:#665400;outline-color:#665400}
.op .rt{display:grid;gap:2px;font-size:14.5px}
.op .rt b{font-size:16px}
.op .tbl{width:100%;border-collapse:collapse;font-size:14.5px}
.op .tbl th,.op .tbl td{text-align:left;padding:6px 6px;border-bottom:1px solid var(--ln)}
.op .tbl th{font:600 12px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu)}
.op .tbl tr:last-child td{border-bottom:0}
.op .src{margin:8px 0 0;font-size:12.5px;color:var(--mu)}
.op .hs{font:700 13px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);margin:14px 0 4px}
.op .op-two{display:grid;gap:14px;grid-template-columns:1fr}
.op .raw{font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere;padding:10px 12px;border:1px solid var(--ln);border-radius:6px;background:var(--bg);margin-bottom:10px}
.op .raw .auto{font:13px Barlow,sans-serif;color:var(--mu);margin-top:4px}
.op .raw .k{border-bottom:2px solid;cursor:help}
.op .k.w{color:var(--k1);border-color:var(--k1)}
.op .k.v{color:var(--k2);border-color:var(--k2)}
.op .k.c{color:var(--k3);border-color:var(--k3)}
.op .k.t{color:var(--k5);border-color:var(--k5)}
.op .k.q{color:var(--k4);border-color:var(--k4)}
.op .k.x{color:var(--k4);border-color:var(--k4)}
.op table.tf,.op table.mn{width:100%;border-collapse:collapse;font-size:14.5px}
.op .tf th,.op .mn th{font:600 12px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--mu);text-align:left;padding:5px 8px}
.op .tf td,.op .mn td,.op .mn tbody th{padding:8px;border-top:1px solid var(--ln);vertical-align:top;text-align:left}
.op .tf td small{display:block;color:var(--mu)}
.op .mn tbody th{font:600 15px Barlow,sans-serif;text-transform:none;letter-spacing:0;color:var(--ink)}
.op .cc{display:inline-block;font:700 12px Barlow,sans-serif;letter-spacing:.04em;color:#fff;border-radius:4px;padding:2px 7px;background:var(--vfr)}
.op .cc.MVFR{background:var(--mvfr)}
.op .cc.IFR{background:var(--ifr)}
.op .cc.LIFR{background:var(--lifr)}
.op .m{font-style:normal;font-weight:700;margin-left:4px}
.op .m.ok{color:var(--ok)}
.op .m.no{color:var(--no)}
.op .m.mid{color:var(--mid)}
.op .mn td.lim{color:var(--mu)}
.op .mn tr.res td{padding-top:10px}
.op .ac{display:inline-block;font:700 12.5px Barlow,sans-serif;border-radius:4px;padding:3px 8px;margin:2px 4px 2px 0;border:1px solid}
.op .ac.ok{color:var(--ok);background:var(--okb);border-color:var(--ok)}
.op .ac.warn{color:var(--mid);background:var(--midb);border-color:var(--mid)}
.op .ac.no{color:var(--no);background:var(--nob);border-color:var(--no)}
.op .nt{margin:10px 0 0;font-size:13px;color:var(--mu)}
.op .st{font:600 12px Barlow,sans-serif;border-radius:4px;padding:2px 6px;white-space:nowrap}
.op .st.ok{color:var(--ok);background:var(--okb)}
.op .st.no{color:var(--no);background:var(--nob)}
.op .st.mid{color:var(--mid);background:var(--midb)}
.op .op-wy{position:relative;height:clamp(300px,52vh,520px);background:#2B3138}
.op .op-wy iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.op .lk{display:flex;flex-wrap:wrap;gap:8px}
.op .lk a{font:600 14.5px Barlow,sans-serif;color:var(--ink)!important;text-decoration:none;border:1px solid var(--ln);border-radius:6px;padding:8px 12px;background:var(--pn)}
.op .lk a:hover{border-color:var(--ink)}
.op .op-note{font-size:13px;color:var(--mu);padding:0 2px}
.op .op-note b{color:var(--ink)}
.op .cat[hidden]{display:none}
.op .tiles.strip{display:grid;gap:8px;grid-template-columns:repeat(6,minmax(0,1fr));margin-bottom:10px}
.op .strip .tl{grid-column:span 2;padding:8px 10px;min-height:0;gap:0}
.op .strip .tl.wd,.op .strip .tl.vs{grid-column:span 3}
.op .strip .tl small{font-size:11px}
.op .strip .tl b{font-size:22px}
.op .strip .tl span{font-size:12px;line-height:1.25}
.op .strip .tl.wd svg{width:40px;height:40px;top:8px;right:10px}
@media (min-width:720px){.op .tiles.strip{grid-template-columns:repeat(5,minmax(0,1fr))}
.op .strip .tl,.op .strip .tl.wd,.op .strip .tl.vs{grid-column:auto}
}
.op .wh{display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px}
.op .wh b{font:700 15px "Barlow Condensed",Barlow,sans-serif;letter-spacing:.1em;color:var(--mid)}
.op .wh .hz{font-size:12px;color:var(--mu)}
.op .sw{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--mu);cursor:pointer}
.op .sw input{position:absolute;opacity:0;pointer-events:none}
.op .sw i{width:30px;height:18px;border-radius:9px;background:var(--ln);position:relative;transition:background .15s}
.op .sw i:after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}
.op .sw input:checked+i{background:var(--vfr)}
.op .sw input:checked+i:after{left:14px}
.op .wl{display:grid}
.op .wr{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--ln)}
.op .wr:first-child{border-top:0}
.op .wr .cc{flex:none;margin-top:2px;min-width:40px;text-align:center}
.op .wr .wt{flex:1;min-width:0;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow-wrap:anywhere}
.op .wr .wt small{font:12px Barlow,sans-serif;color:var(--mu)}
.op .wr .wt b{font-family:Barlow,sans-serif}
.op .wr em{flex:none;font-style:normal;font-size:12.5px;color:var(--mu);margin-top:3px}
.op .wl .auto{font-size:12.5px;color:var(--mu);padding:4px 0}
.op .wr .wt:not(:has(.k)){font-family:Barlow,system-ui,sans-serif;font-size:14.5px}
.op .rad{position:relative;border-radius:12px;padding:12px 12px 10px;background:linear-gradient(180deg,#2a2d31,#17191c);border:1px solid #3a3e44;box-shadow:inset 0 1px 0 #4a4f56,0 2px 8px rgba(0,0,0,.25);color:#D9DEE3;min-width:0}
.op .rad::before,.op .rad::after{content:"";position:absolute;top:7px;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#8a9098,#33373c);box-shadow:0 0 0 1px #0c0d0f}
.op .rad::before{left:8px}.op .rad::after{right:8px}
.op .rad .rh{display:flex;align-items:center;justify-content:space-between;margin:0 14px 8px;font:700 10px Barlow,sans-serif;letter-spacing:.16em;color:#9AA3AC}
.op .rad .rh a{color:#9AA3AC!important;text-decoration:none;font-weight:600;letter-spacing:.06em}
.op .rad .lcd{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch}
.op .rad .scr{background:#070806;border-radius:6px;padding:6px 10px 7px;box-shadow:inset 0 2px 6px #000,0 0 0 1px #000,0 1px 0 #4a4f56;min-width:0}
.op .rad .scr small{display:block;font:700 10px Barlow,sans-serif;letter-spacing:.14em;color:#8a6a1a}
.op .rad .scr b{display:block;font:700 34px/1.05 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.04em;font-variant-numeric:tabular-nums;color:#FFB000;text-shadow:0 0 8px rgba(255,176,0,.55);white-space:nowrap}
.op .rad .scr.st b{color:#9AD7FF;text-shadow:0 0 8px rgba(120,200,255,.45)}.op .rad .scr.st small{color:#4b7a96}
.op .rad .scr i{display:block;font:600 11px Barlow,sans-serif;font-style:normal;color:#b8bdc2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.op .rad .flip{align-self:center;width:38px;height:38px;border-radius:50%;border:1px solid #555b63;background:radial-gradient(circle at 35% 30%,#555b63,#26292d);color:#EEF1F4;font:700 18px/1 Barlow,sans-serif;cursor:pointer;box-shadow:0 2px 3px rgba(0,0,0,.5)}
.op .rad .flip:active{transform:translateY(1px)}
.op .rad .keys{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:10px}
.op .rad .key{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px 5px;border-radius:6px;border:1px solid #444950;background:linear-gradient(180deg,#34383d,#222528);color:#E6E9EC;cursor:pointer;box-shadow:0 2px 3px rgba(0,0,0,.45);font-family:Barlow,sans-serif;min-width:0}
.op .rad .key:active{transform:translateY(1px)}
.op .rad .key small{font:700 10px Barlow,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#aeb5bc;white-space:nowrap}
.op .rad .key b{font:700 14px "Barlow Condensed",Barlow,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
.op .rad .key.on{border-color:#FFB000;box-shadow:0 0 0 1px #FFB000,0 2px 3px rgba(0,0,0,.45)}
.op .rad .key.sb{border-color:#6FC3F5}
.op .rad .key:focus-visible,.op .rad .flip:focus-visible{outline:2px solid #fff;outline-offset:2px}
.op .rad .rf{margin:8px 4px 0;font:500 11px Barlow,sans-serif;color:#8E98A3}
.op .rad-d{display:none}
@media (min-width:980px){.op .rad-d{display:block}.op .rad-m{display:none}}
@media (max-width:360px){.op .rad .scr b{font-size:28px}.op .rad .key b{font-size:13px}}
.op .nt-sum{padding:2px 0 10px;font:600 15px Barlow,sans-serif;color:var(--mu)}.op .nt-sum b{font:700 22px "Barlow Condensed",Barlow,sans-serif;color:var(--ink);margin-right:2px}.op .nt-sum .ok{color:var(--ok)}.op .nt-sum .pr{color:var(--mid)}
.op .nt-f{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.op .ntf{border:1px solid var(--ln);background:transparent;color:var(--ink);border-radius:99px;padding:5px 12px;font:600 13px Barlow,sans-serif;cursor:pointer;min-height:32px}.op .ntf i{font-style:normal;color:var(--mu);margin-left:3px}.op .ntf.on{background:var(--hd);color:#fff;border-color:var(--hd)}.op .ntf.on i{color:#C9D1D9}
.op .nt-l{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))}
.op .nt{border:1px solid var(--ln);border-left:4px solid var(--ok);border-radius:8px;padding:10px 12px;background:var(--pn)}.op .nt.fut{border-left-color:var(--mid)}
.op .nt header{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.op .nt header b{font:700 15px "JetBrains Mono",ui-monospace,monospace}.op .nt .ch{font:600 12px Barlow,sans-serif;background:var(--bg);border-radius:99px;padding:2px 9px;color:var(--mu)}.op .nt .ch.c2{background:var(--midb);color:var(--mid)}
.op .nt header em{margin-left:auto;font:700 11px Barlow,sans-serif;letter-spacing:.08em;font-style:normal;padding:3px 8px;border-radius:4px}.op .nt header em.ok{background:var(--okb);color:var(--ok)}.op .nt header em.pr{background:var(--midb);color:var(--mid)}
.op .nt .nv{margin:6px 0 4px;font:600 13px "JetBrains Mono",ui-monospace,monospace;color:var(--mu)}.op .nt .nx{margin:0;font:500 14px/1.4 Barlow,sans-serif;white-space:pre-line;overflow-wrap:anywhere}.op .nt .nd{margin:6px 0 0;display:flex;flex-wrap:wrap;gap:4px 14px;font:500 13px Barlow,sans-serif;color:var(--mu)}
.op .nt footer{margin-top:7px;display:flex;gap:10px;font:500 12px Barlow,sans-serif;color:var(--mu)}.op .nt footer code{font:600 12px "JetBrains Mono",ui-monospace,monospace}
.op .nt-s,.op .nt-e{margin:6px 0;color:var(--mu)}.op .nt-e{padding:10px 12px;border:1px solid var(--no);background:var(--nob);border-radius:8px;color:var(--ink)}.op .nt-src{margin-top:12px}
.op [data-t][hidden]{display:none!important}
.op .op-top.skyh{position:relative;overflow:hidden;transition:color .6s}
.op .op-top.skyh>*:not(.sk){position:relative;z-index:1}
.op .sk{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;background:var(--hd)}
.op .sk .star{position:absolute;border-radius:50%;background:#fff;opacity:var(--st,1)}
.op .sk .orb{position:absolute;width:46px;height:46px;margin:0 0 -23px -23px;border-radius:50%;transition:left 10s linear,bottom 10s linear,opacity 1s}
.op .sk .orb.moon{width:40px;height:40px;margin:0 0 -20px -20px;box-shadow:0 0 18px rgba(244,241,222,.35)}
.op .sk .orb.sun{box-shadow:0 0 26px 6px rgba(255,196,0,.35)}
.op .sk .wx{position:absolute;inset:0}
.op .sk .cd{position:absolute;color:var(--cc,#fff);opacity:.93;animation:opdrift linear infinite alternate;transition:color 1s}
.op .sk .cd svg{display:block;width:100%;height:auto;filter:drop-shadow(0 2px 3px rgba(0,0,0,.14))}
@keyframes opdrift{from{transform:translateX(-16%)}to{transform:translateX(16%)}}
.op .sk .veil{position:absolute;inset:0;background:var(--cc,#fff);opacity:var(--vl,0);transition:opacity 1s}
.op .sk .rain,.op .sk .snow,.op .sk .fog,.op .sk .fl{position:absolute;inset:0}
.op .sk .rain{opacity:var(--ra,0);background:linear-gradient(100deg,transparent 47%,rgba(200,222,250,.75) 50%,transparent 53%) 0 0/13px 24px;animation:oprain .55s linear infinite}
@keyframes oprain{to{background-position:-5px 24px}}
.op .sk .snow{opacity:var(--sn,0);background:radial-gradient(circle,#fff 0 1.6px,transparent 2.2px) 0 0/21px 21px,radial-gradient(circle,rgba(255,255,255,.8) 0 1.2px,transparent 1.8px) 10px 7px/17px 17px;animation:opsnow 4s linear infinite}
@keyframes opsnow{to{background-position:6px 21px,14px 24px}}
.op .sk .fog{opacity:var(--fg,0);background:linear-gradient(0deg,var(--cc,#dde3ea),transparent 92%)}
.op .sk .fl{background:#fff;opacity:0;animation:opfl 7s infinite}
@keyframes opfl{0%,91%,95%,100%{opacity:0}92%{opacity:.7}93%{opacity:.05}94%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.op .sk .cd,.op .sk .rain,.op .sk .snow,.op .sk .fl{animation:none}}
.op .sup .su{padding:8px 0;border-top:1px solid var(--ln)}.op .sup .su:first-child{border-top:0;padding-top:0}
.op .sup .su b{font:700 14px Barlow,sans-serif;color:#9A5B00;margin-right:8px}.op .sup .su span{font:500 12px Barlow,sans-serif;color:var(--mu)}
.op .sup .su p{margin:3px 0 0;font:500 14px/1.35 Barlow,sans-serif}.op .sup .su p.sl{font-size:12px;color:var(--mu)}
.op .op-top.lt{color:#0E2233}
.op .op-top.lt .idsel span,.op .op-top.lt .id span,.op .op-top.lt .tm small{color:#33506A}
.op .op-top.lt .idsel b i{color:#B36B00}
.op .op-top.lt .tm b{color:#8A5200}.op .op-top.lt .tm b i{color:#0E2233}
.op .idsel{display:block;background:none;border:0;padding:0;margin:0;color:inherit;font:inherit;text-align:left;cursor:pointer}
.op .idsel b{display:block;font:700 40px/1 "Barlow Condensed",Barlow,sans-serif;letter-spacing:.04em}
.op .idsel b i{font-style:normal;font-size:20px;margin-left:8px;color:var(--am);vertical-align:middle}
.op .idsel span{color:#C9D3DD;font-size:14px;text-shadow:0 1px 2px rgba(0,0,0,.35)}
.op .idsel:focus-visible{outline:2px solid var(--am);outline-offset:4px;border-radius:4px}
.op .op-dd{background:var(--pn);border-bottom:1px solid var(--ln);padding:6px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));max-width:100%}
.op .op-dd[hidden]{display:none}
.op .op-dd .gp{columns:3 280px;column-gap:20px}
.op .op-dd .ar{break-inside:avoid}
.op .op-dd .gh{font:700 12px Barlow,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--mu);padding:8px 4px 4px}
.op .op-dd .ar{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:baseline;width:100%;padding:8px 8px;border:0;border-top:1px solid var(--ln);background:none;color:var(--ink);text-align:left;cursor:pointer;font:inherit;border-radius:0}
.op .op-dd .ar b{font:700 18px "Barlow Condensed",Barlow,sans-serif;letter-spacing:.04em}
.op .op-dd .ar span{font-size:14.5px}
.op .op-dd .ar em{font-style:normal;font-size:12.5px;color:var(--mu);white-space:nowrap}
.op .op-dd .ar:hover{background:var(--bg)}
.op .op-dd .ar.sel{background:var(--okb);box-shadow:inset 3px 0 0 var(--vfr)}
.op .op-dd .dn{column-span:all;margin-top:8px}
.op .op-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;background:var(--pn);border-bottom:1px solid var(--ln);padding:0 max(10px,env(safe-area-inset-right,0px)) 0 max(10px,env(safe-area-inset-left,0px))}
.op .op-tabs::-webkit-scrollbar{display:none}
.op .op-tabs button,.op .op-tabs a{flex:none;font:600 15px Barlow,sans-serif;color:var(--mu)!important;padding:12px 14px;border:0;border-bottom:3px solid transparent;background:none;text-decoration:none;cursor:pointer;white-space:nowrap}
.op .op-tabs button.on{color:var(--ink)!important;border-bottom-color:var(--am)}
.op .op-tabs a{margin-left:auto}.op .op-tabs a+a{margin-left:0}
.op .tbl.pst td small,.op .tbl.pst th small{display:block;font-weight:500;font-size:12px;color:var(--mu)}
.op .tbl.pst tr.best{background:var(--okb)}
.op .tbl.pst th{vertical-align:middle}
.op .tbl.pst td{vertical-align:middle;font-weight:600}
.op table.mn{table-layout:fixed}
.op .mn th:nth-child(1),.op .mn tbody th{width:21%}
.op .mn th:nth-child(2){width:19%}
.op .mn td.lim{overflow-wrap:anywhere}
.op .mn tr.res td{display:table-cell}
.op .mn tr.res td .ac{margin:2px 3px 2px 0;padding:2px 6px;font-size:12px}
.op .lim.g{color:var(--ok);font-weight:600}
.op .lim.r{color:var(--no);font-weight:600}
.op .lim.a{color:var(--mid);font-weight:600}
.op .lim.n{color:var(--mu)}
.op .mn b.r{color:var(--no)}
.op .pn>h2 small a{color:var(--k1);text-decoration:none}
.op .op-note a{color:var(--mu);text-decoration:underline}
.op .op-note{line-height:1.6}
.op .pn .bd{padding:10px 14px}
.op .tbl.rw td,.op .tbl.rw th{padding:5px 6px}
@media (max-width:560px){.op .tbl.pst th:nth-child(2),.op .tbl.pst td:nth-child(2){display:none}.op .tbl.pst th,.op .tbl.pst td{padding:5px 4px}.op .tbl.pst .sign.sm{font-size:22px;padding:4px 8px}
.op .strip .tl.wd{padding-right:48px}.op .strip .tl.wd b{font-size:19px;white-space:nowrap}.op .strip .tl.wd svg{width:34px;height:34px;right:8px}
.op .mn,.op .mn td,.op .mn tbody th{font-size:13px!important}
.op .mn tbody th{font-size:13.5px!important}
.op .op-top{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.op .op-top .id{grid-column:1}
.op .op-top .tm{grid-column:2;grid-row:1;margin:0;justify-self:end}
.op .op-top .ad,.op .op-top .cat{min-width:0}
.op .op-top .ad b,.op .op-top .cat b{white-space:nowrap;font-size:20px}
.op .pn>h2{font-size:15px}
.op .op-lbl span{font-size:13px}
.op .tf,.op .mn,.op .tbl{font-size:13px!important}
.op .tf td,.op .mn td,.op .mn tbody th,.op .tbl td{padding:6px 4px!important}
.op .tf th,.op .mn th{padding:4px!important}
.op .op-top .id b{font-size:32px}
.op .op-top .tm{margin-left:0}
.op .sign{font-size:44px}
}
`;
const FQ0=[["TWR","118.705","Torre","ok"],["GND (GMC)","121.805","Rodaje","ok"],["ATIS","118.230","Información","ok"],["Emergencia","121.500","H24","ok"],["TWR (reserva)","122.505","Back-up","ok"]];
S.rad={a:0,s:1};
const aipLink=()=>"https://aip.enaire.es/AIP/#"+(AD.other?(AD.icao==="LELO"?"LERJ":AD.icao):"LECU/LEVS");
const fqList=()=>AD.other?(AD.chart&&AD.chart.fq&&AD.chart.fq.length?AD.chart.fq.concat([["Emergencia","121.500","H24"]]):null):FQ0;
function radHTML(cls){
  const mt=S.opt&&S.opt.multi?' data-t="res map"':"", FQ=fqList();
  if(!FQ) return `<section class="pn rad-na ${cls}"${mt}><h2>Frecuencias <small><a target="_blank" rel="noopener" href="${aipLink()}">Ver en la AIP ↗</a></small></h2></section>`;
  const a=FQ[Math.min(S.rad.a,FQ.length-1)], b=FQ[Math.min(S.rad.s,FQ.length-1)];
  return `<section class="rad ${cls}"${mt} aria-label="Frecuencias de ${esc(AD.short||AD.name)}"><div class="rh"><span>COM · ${AD.icao}</span><a target="_blank" rel="noopener" href="${aipLink()}">AIP ↗</a></div>
   <div class="lcd"><div class="scr"><small>ACTIVA</small><b>${a[1]}</b><i>${a[0]} · ${a[2]}</i></div><button type="button" class="flip" aria-label="Intercambiar activa y en espera" title="Intercambiar">⇄</button><div class="scr st"><small>EN ESPERA</small><b>${b[1]}</b><i>${b[0]} · ${b[2]}</i></div></div>
   <div class="keys" style="grid-template-columns:repeat(${FQ.length},minmax(0,1fr))">${FQ.map((f,i)=>`<button type="button" class="key${i===S.rad.a?" on":i===S.rad.s?" sb":""}" data-fq="${i}" aria-label="${f[0]} ${f[1]}"><small>${f[0].replace("TWR (reserva)","TWR 2").replace(/ \(.*/,"").replace("Emergencia","EMER")}</small><b>${f[1]}</b></button>`).join("")}</div>
   ${S.opt&&S.opt.multi?"":'<p class="rf">Toca una frecuencia para ponerla en espera y ⇄ para activarla. Frecuencias de la AIP (AD 2-LECU).</p>'}</section>`;
}
function radDraw(){ if(!S.root) return; S.root.querySelectorAll(".rad").forEach(r=>{ const c=r.classList.contains("rad-d")?"rad-d":"rad-m"; r.outerHTML=radHTML(c); }); }
const supEnd=d=>{ const m=/^(\d\d)\/(\d\d)\/(\d\d)$/.exec(d||""); return m?new Date(Date.UTC(2000+ +m[3],+m[2]-1,+m[1],23,59)):null; };
const supHTML=()=>{ const c=AD.chart, l=c&&c.sup; if(!l||!l.length) return ""; const now=Date.now(); return `<section class="pn sup" data-t="res pist map"><h2>Avisos de la AIP <small><a target="_blank" rel="noopener" href="${aipLink()}">Ver en la AIP ↗</a></small></h2><div class="bd">${l.map(x=>{ const e=supEnd(x[2]), late=e&&e.getTime()<now; return `<div class="su"><b>${esc(x[0])}</b><span>${esc(x[1])} → ${esc(x[2])} (est.)</span><p>${esc(x[3])}</p>${late?`<p class="sl">Fin estimado superado: sigue vigente hasta que lo cancele un NOTAM, SUP o enmienda AIP.</p>`:""}</div>`; }).join("")}</div></section>`; };
const chartNote=()=>{ const c=AD.chart; return c?`<p class="src mapnote" id="opMapNote">Carta AIP ADC 1.1 · WEF ${c.wef} · © ENAIRE. ${c.nt?c.nt+" ":""}Colocada con los umbrales de la AIP: orientativa. Consulta la vigente en <a target="_blank" rel="noopener" href="${aipLink()}">Cartas AIP ↗</a></p>`:""; };
const wyUrl=()=>"https://embed.windy.com/embed2.html?lat="+AD.lat.toFixed(3)+"&lon="+AD.lon.toFixed(3)+"&detailLat="+AD.lat.toFixed(3)+"&detailLon="+AD.lon.toFixed(3)+"&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=true&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1";
const rwyNote=()=>AD.other?"La pista real la fija la torre o el AFIS. Aquí se deduce del tráfico ADS-B y, si no hay, del viento. Horario: AIP AD 2.3 (UTC); fuera de horario, PPR o NOTAM.":"La pista real la fija la torre o el ATIS (118.230). Aquí se deduce del tráfico ADS-B y, si no hay, del viento. AD civil: 08:00 Z-ocaso (invierno), 07:00 Z-ocaso (verano). Cerrado el primer domingo de mes (salvo enero y agosto).";
const STARS=(()=>{ let x=7,o=""; const r=()=>(x=(x*9301+49297)%233280)/233280; for(let i=0;i<34;i++) o+=`<i class="star" style="left:${(r()*100).toFixed(1)}%;top:${(r()*80).toFixed(1)}%;width:${(1+r()*1.6).toFixed(1)}px;height:${(1+r()*1.6).toFixed(1)}px"></i>`; return o; })();
/* ---------- NOTAM (pestaña): /api/notam → réplica de ENAIRE en FAA NOTAM Search ---------- */
const NT_G=[["all","Todos"],["pist","Pista y rodaje"],["luz","Luces"],["ayu","Ayudas"],["proc","Procedimientos"],["esp","Espacio aéreo"],["obs","Obstáculos"],["otr","Otros"]];
const ntGrp=q=>{ const c=(q||"")[1]||""; return c==="M"?"pist":c==="L"?"luz":"IJNGC".includes(c)&&c?"ayu":c==="P"?"proc":"RAWS".includes(c)&&c?"esp":c==="O"?"obs":"otr"; };
const NT_C={LC:"cerrado",AS:"no operativo",AU:"no disponible",CE:"instalado",HW:"obras",AK:"operativo de nuevo",AL:"operativo con limitaciones",LT:"limitado",CA:"activado",CD:"desactivado",LA:"operativo con limitaciones",CH:"cambiado",CC:"completado"};
const ntD=i=>{ const d=new Date(i), p=n=>String(n).padStart(2,"0"); return p(d.getUTCDate())+"/"+p(d.getUTCMonth()+1)+"/"+String(d.getUTCFullYear()).slice(2)+" "+p(d.getUTCHours())+":"+p(d.getUTCMinutes())+" Z"; };
function ntList(r){ const now=Date.now(); return (r.n||[]).map(x=>{ const f=x.from?Date.parse(x.from):0, t=x.to?Date.parse(x.to):Infinity; return Object.assign({},x,{F:f,T:t,act:f<=now&&t>=now,fut:f>now,grp:ntGrp(x.q)}); }).filter(x=>x.T>=now).sort((a,b)=>(b.act-a.act)||(a.act?b.F-a.F:a.F-b.F)); }
function ntHTML(){
  const R=S.nt; if(!R) return `<p class="nt-s">Cargando NOTAM…</p>`;
  if(R.err) return `<div class="nt-e"><b>No se han podido cargar los NOTAM ahora.</b> Consulta la fuente oficial.</div><p class="nt-s"><a target="_blank" rel="noopener" href="https://insignia.enaire.es/">ENAIRE Insignia ↗</a></p>`;
  const L=ntList(R.r), na=L.filter(x=>x.act).length, nf=L.length-na, F=S.ntF||"all", cnt=g=>g==="all"?L.length:L.filter(x=>x.grp===g).length;
  const chips=NT_G.filter(g=>g[0]==="all"||cnt(g[0])).map(g=>`<button type="button" class="ntf${g[0]===F?" on":""}" data-g="${g[0]}">${g[1]} <i>${cnt(g[0])}</i></button>`).join("");
  const V=L.filter(x=>F==="all"||x.grp===F);
  const card=x=>{ const cond=NT_C[(x.q||"").slice(3,5)]||"", gl=(NT_G.find(g=>g[0]===x.grp)||[0,"Otros"])[1];
    const alt=(x.f||x.g)?`<span>Límites: ${esc(x.f||"—")} – ${esc(x.g||"—")}</span>`:"";
    return `<article class="nt ${x.act?"act":"fut"}"><header><b>${esc(x.id)}</b><span class="ch">${esc(gl)}</span>${cond?`<span class="ch c2">${esc(cond)}</span>`:""}<em class="${x.act?"ok":"pr"}">${x.act?"ACTIVO":"PRÓXIMO"}</em></header>
     <p class="nv">${x.from?ntD(x.from):"—"} → ${x.perm?"permanente":(x.to?ntD(x.to)+(x.est?" (est.)":""):"—")}</p>
     <p class="nx">${esc(x.e||"(sin texto)")}</p>${(x.d||alt)?`<p class="nd">${x.d?`<span>Horario: ${esc(x.d)}</span>`:""}${alt}</p>`:""}<footer><code>${esc(x.q||"")}</code>${x.t==="R"?"<span>reemplaza a otro</span>":""}</footer></article>`; };
  return `<div class="nt-sum"><b>${L.length}</b> NOTAM · <span class="ok">${na} activos</span>${nf?` · <span class="pr">${nf} próximos</span>`:""}</div>
   <div class="nt-f">${chips}</div>${V.length?`<div class="nt-l">${V.map(card).join("")}</div>`:`<p class="nt-s">No hay NOTAM vigentes${F==="all"?" para este aeródromo":" en esta categoría"}.</p>`}
   <p class="src nt-src">Fuente: FAA NOTAM Search (copia de los NOTAM de ENAIRE) · actualizado ${ntD(R.r.at||Date.now())} · Horas en UTC. Orientativo: la fuente oficial es <a target="_blank" rel="noopener" href="https://insignia.enaire.es/">ENAIRE Insignia ↗</a>.</p>`;
}
function ntDraw(){ const e=$("#opNt",S.root); if(e) e.innerHTML=ntHTML(); }
function loadNt(force){
  const f0=S.opt&&S.opt.fetchNt, g=S.gen, ic=AD.icao; if(!f0) return;
  if(!force&&S.nt&&S.nt.ic===ic&&!S.nt.err&&Date.now()-S.nt.t<5*60000) { ntDraw(); return; }
  S.nt=null; ntDraw();
  f0(ic).then(r=>{ if(!r||!r.ok) throw 0; return r; }).then(r=>{ if(g===S.gen&&AD.icao===ic) S.nt={ic,t:Date.now(),r}; }).catch(()=>{ if(g===S.gen&&AD.icao===ic) S.nt={ic,t:0,err:1}; }).then(()=>{ if(S.root&&g===S.gen) ntDraw(); });
}
const TABS=[["res","Resumen"],["pist","Pistas"],["wx","METAR · TAF"],["ntm","NOTAM"],["map","Mapa"]];
function ddHTML(){
  const here=[AD0.lat,AD0.lon], L=[{icao:"LECU",name:"Cuatro Vientos",lat:AD0.lat,lon:AD0.lon,tm:""}].concat(AEROS).sort((x,y)=>x.name.localeCompare(y.name,"es"));
  return `<div class="gp">`+L.map(o=>{ const d=o.icao==="LECU"?"":kmN(here,[o.lat,o.lon])+" NM"; return `<button type="button" class="ar${o.icao===AD.icao?" sel":""}" data-ic="${o.icao}"><b>${o.icao}</b><span>${o.name}</span><em>${d}${o.tm?(d?" · ":"")+o.tm:""}</em></button>`; }).join("")+"</div>"
   ;
}
function showTab(t){
  S.tab=t; const R=S.root; if(!R) return;
  R.querySelectorAll("[data-t]").forEach(x=>{ x.hidden=!x.dataset.t.split(" ").includes(t); });
  R.querySelectorAll("#opTabs [data-tab]").forEach(b=>{ b.classList.toggle("on",b.dataset.tab===t); b.setAttribute("aria-selected",b.dataset.tab===t); });
  if(t==="ntm") loadNt();
  if(S.map&&(t==="res"||t==="map")) setTimeout(()=>{ try{ S.map.invalidateSize(); S.fit&&S.fit(); }catch(e){} },30);
}
function pick(ic){ const o=ic==="LECU"?null:AEROS.find(x=>x.icao===ic); AD=o?mkAD(o):AD0; S.mode=null; S.rad={a:0,s:1}; S.data=null; S.tr=null; S.act=null; render(S.root,S.opt,true); }
function render(el,opt,keep){
  S.opt=opt||{}; S.root=el; S.tr=null; S.trAt=null; S.skyW=null; S.nt=null; S.ntF="all"; S.gen++;
  const mu=!!S.opt.multi; if(!keep){ AD=AD0; S.tab="res"; }
  const A=AD0.main, wy=wyUrl(), ww=AD.lat.toFixed(3)+"/"+AD.lon.toFixed(3), tb=mu?S.tab||"res":null;
  el.innerHTML=`<style>${CSS}</style><div class="op">
   <header class="op-top${mu?" skyh":""}" id="opTop">${mu?`<div class="sk" id="opSky" aria-hidden="true">${STARS}<div class="orb sun" id="opSun"></div><div class="orb moon" id="opMoon"></div><div class="wx" id="opWx"></div></div>`:""}<div class="id">${mu?`<button type="button" class="idsel" id="opSel" aria-expanded="false" aria-controls="opDD"><b>${AD.icao}<i>▾</i></b><span>${AD.name}</span></button>`:`<b>${AD.icao}</b><span>${AD.name}</span>`}</div><div class="ad closed" id="opAd"><b>AD</b><small>…</small></div><div class="cat" id="opCat"><b>—</b><small>cargando</small></div><div class="tm"><small>HORA UTC (Z)</small><div><b id="opZ">--:--</b><b><i id="opD"></i></b></div></div></header>
   ${mu?`<div class="op-dd" id="opDD" hidden>${ddHTML()}</div>`:""}
   <div class="op-sub" id="opSub"><span>Cargando METAR y TAF…</span></div>
   <div class="op-err" id="opErr" hidden><span><b>No se han podido cargar el METAR y el TAF.</b> Consulta la AEMET.</span><a target="_blank" rel="noopener" href="https://ama.aemet.es/">AEMET</a>${S.opt.allowDemo?'<button type="button" id="opDemo">Ver con datos de ejemplo</button>':""}</div>
   ${mu?`<nav class="op-tabs" id="opTabs" aria-label="Secciones">${TABS.filter(t=>t[0]!=="ntm"||S.opt.fetchNt).map(t=>`<button type="button" data-tab="${t[0]}" class="${t[0]===tb?"on":""}" aria-selected="${t[0]===tb}">${t[1]}</button>`).join("")}<a target="_blank" rel="noopener" href="https://insignia.enaire.es/">Insignia ↗</a><a target="_blank" rel="noopener" href="https://www.windy.com/${ww}?webcams,${AD.lat.toFixed(3)},${AD.lon.toFixed(3)},11">Webcams ↗</a></nav>`:""}
   <div class="op-in">
    ${supHTML()}
    <section class="pn" data-t="res wx"><div class="bd"><div class="tiles strip" id="opTiles"></div>
     <div class="wh"><b>METAR</b><label class="sw"><input type="checkbox" id="opRawT" checked><i></i>raw mode</label></div><div class="wl" id="opMet"></div>
     <div class="wh"><b>TAF</b><span class="hz">hora Z</span></div><div class="wl" id="opTaf"></div></div></section>
    <div class="op-hero" data-t="res map">
     <section class="pn op-map"><h2>${AD.short} <small id="opTrSt">tráfico ADS-B…</small></h2><div id="opMap"></div>${mu?chartNote():'<p class="src mapnote" id="opMapNote">AD 2-LECU/LEVS ADC 1.1 (WEF 25-DEC-25, AIRAC AMDT 13/25), parte civil · © ENAIRE. Comprueba siempre la vigente en <a target="_blank" rel="noopener" href="https://aip.enaire.es/AIP/#LECU/LEVS">Cartas AIP ↗</a></p>'}</section>
     <aside class="op-side">
      <section class="pn"><h2>Pista en uso</h2><div class="bd"><div class="rwy" id="opRwy"></div>${mu?"":`<p class="src">${rwyNote()}</p>`}</div></section>
      ${radHTML("rad-d")}
     </aside>
    </div>
    ${mu?`<section class="pn" data-t="pist"><h2>Pistas ${AD.icao} <small><a target="_blank" rel="noopener" href="${aipLink()}">Cartas AIP ↗</a></small></h2><div class="bd" id="opPist"></div></section>`:`<section class="pn"><h2>Pista ${A.id} <small><a target="_blank" rel="noopener" href="https://aip.enaire.es/AIP/#LECU/LEVS">Cartas AIP ↗</a></small></h2><div class="bd">
     <table class="tbl rw"><thead><tr><th></th><th><span class="sign sm">${A.a.id}</span></th><th><span class="sign sm">${A.b.id}</span></th></tr></thead><tbody>
      <tr><th>Rumbo magnético</th><td>${A.a.hdg}º</td><td>${A.b.hdg}º</td></tr>
      <tr><th>Elevación umbral</th><td>${A.a.el} ft</td><td>${A.b.el} ft</td></tr>
      <tr><th>TORA</th><td>${A.a.tora} m</td><td>${A.b.tora} m</td></tr>
      <tr><th>TODA</th><td>${A.a.toda} m</td><td>${A.b.toda} m</td></tr>
      <tr><th>ASDA</th><td>${A.a.asda} m</td><td>${A.b.asda} m</td></tr>
      <tr><th>LDA</th><td>${A.a.lda} m</td><td>${A.b.lda} m</td></tr>
      <tr><th>Zona de parada</th><td>${A.a.swy} m</td><td>${A.b.swy} m</td></tr></tbody></table></div></section>`}
    ${mu&&S.opt.fetchNt?`<section class="pn" data-t="ntm"><h2>NOTAM ${AD.icao} <small><a target="_blank" rel="noopener" href="https://insignia.enaire.es/">ENAIRE Insignia ↗</a></small></h2><div class="bd" id="opNt"></div></section>`:""}
    <section class="pn" data-t="res"><h2>Mínimos de la escuela <small>SOP.4.1</small></h2><div class="bd" id="opMin"></div></section>
    <section class="pn" data-t="wx"><h2>Viento y tiempo <small><a href="https://www.windy.com/${ww}?wind,8" target="_blank" rel="noopener">Windy ↗</a></small></h2><div class="op-wy"><iframe title="Mapa de viento Windy" src="${wy}" referrerpolicy="no-referrer" allow="fullscreen" loading="lazy"></iframe></div></section>
    ${radHTML("rad-m")}
    <p class="op-note"><a target="_blank" rel="noopener" href="https://ama.aemet.es/">AEMET</a> · <a target="_blank" rel="noopener" href="https://www.flightradar24.com/${AD.lat.toFixed(2)},${AD.lon.toFixed(2)}/12">FlightRadar24</a></p>
   </div></div>`;
  el.onclick=ev=>{
    if(ev.target.closest("#opDemo")){ S.opt.fetchWx=null; setData(demoData(S.scen)); return; }
    const k=ev.target.closest(".rad .key"), f=ev.target.closest(".rad .flip");
    if(k){ const i=+k.dataset.fq; if(i===S.rad.a) return; S.rad.s=i; radDraw(); return; }
    if(f){ const t=S.rad.a; S.rad.a=S.rad.s; S.rad.s=t; radDraw(); return; }
    const nf=ev.target.closest(".ntf"); if(nf){ S.ntF=nf.dataset.g; ntDraw(); return; }
    if(!S.opt.multi) return;
    const sel=ev.target.closest("#opSel"), ar=ev.target.closest("#opDD .ar"), tab=ev.target.closest("#opTabs [data-tab]"), dd=$("#opDD",el);
    if(sel){ dd.hidden=!dd.hidden; sel.setAttribute("aria-expanded",!dd.hidden); return; }
    if(ar){ if(ar.dataset.ic===AD.icao){ dd.hidden=true; $("#opSel",el).setAttribute("aria-expanded","false"); } else pick(ar.dataset.ic); return; }
    if(tab){ showTab(tab.dataset.tab); return; }
  };
  el.onchange=ev=>{ if(ev.target.id==="opRawT"){ S.rawMode=ev.target.checked; fill(); } };
  if(mu) showTab(tb);
  initMap(); load(); loadTr(); clock();
  clearInterval(S.clk); S.clk=setInterval(clock,10000); clearInterval(S.t); S.t=setInterval(()=>{ if(S.opt.fetchWx) load(); else if(S.data) fill(); },5*60000);
  clearInterval(S.tt); S.tt=setInterval(()=>{ if(!document.hidden) loadTr(); },20000);
}
function leave(){ clearInterval(S.clk); clearInterval(S.t); clearInterval(S.tt); try{ if(S.map) S.map.remove(); }catch(e){} S.map=null; S.lay=null; S.trl=null; S.tile=null; S.img=null; S.imgO=null; if(S.root) S.root.innerHTML=""; S.root=null; }
window.F0Ops={brief,render,leave,skyCard,_t:{skyAt,wxOf,parseMetar,parseTaf,evalOne,sun,windOn,wxText,flightCat,infer,adState}};
})();
