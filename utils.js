// Funciones "puras" de Mis Gastos: no tocan la pantalla ni los datos.
// Las usan app.js y test.html (así los tests prueban el código real).

const DEFAULT_CATS=[
 ["Comida fuera","--c1"],["Súper","--c3"],["Regalos","--c2"],["Salidas y fiesta","--c4"],
 ["Transporte","--c6"],["Cafés y snacks","--c5"],["Suscripciones","--c0"],["Tecnología","--c7"],["Otros","--c8"]];
const ALL_COLORS=["--c0","--c1","--c2","--c3","--c4","--c5","--c6","--c7","--c8","--c9","--c10"];
// Categorías de ingresos (fijas)
const INCOME_CATS=[["Trabajo","--i1"],["Paga","--i0"],["Ventas","--i2"],["Regalos","--i3"],["Devoluciones","--i4"],["Otros","--c10"]];

const pad=n=>String(n).padStart(2,"0");
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
// Importe para mostrar: 12345 → "12.345,00"
const eur=v=>v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
// Importe para un campo editable: sin punto de miles (12345 → "12345,00")
const eurInput=v=>v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
// Texto → número. Acepta "12,50", "12.50", "12,50 €" y "12.345,67" (punto de miles + coma decimal)
const parseAmt=s=>{let t=String(s).replace(/\s|€/g,"");
  if(t.includes(",")&&t.includes("."))t=t.replace(/\./g,"");
  const v=parseFloat(t.replace(",","."));return isFinite(v)?Math.round(Number(v+"e2"))/100:NaN}; // redondeo exacto (1,005 → 1,01)
// Minúsculas y sin tildes, para comparar textos
const norm=s=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
function monthName(ym){const [y,m]=ym.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString("es-ES",{month:"long",year:"numeric"})}
function shiftMonth(ym,d){let [y,m]=ym.split("-").map(Number);m+=d;while(m<1){m+=12;y--}while(m>12){m-=12;y++}return `${y}-${pad(m)}`}
// Gastos del atajo: "fecha" llega con hora (2026-10-30T20:30:00); la hora se usa para ordenar
function fixGasto(g){if(g&&typeof g.importe==="string")g.importe=parseAmt(g.importe);
  if(g&&typeof g.fecha==="string"){const f=g.fecha.trim();
  if(f.length>10){const m=f.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(m&&!g.ts)g.ts=new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)).getTime()}
  g.fecha=f.slice(0,10)}return g}
// ¿Es una lista de categorías válida? [["Nombre","--cN"], ...]
const validCats=v=>Array.isArray(v)&&v.length>0&&v.every(c=>Array.isArray(c)&&typeof c[0]==="string"&&c[0].trim()&&typeof c[1]==="string");
// Categoría del gasto más reciente con ese concepto (o null)
function lastCatFor(gastos,concepto){const v=norm(String(concepto||"").trim());if(!v)return null;
  let best=null;for(const g of gastos){if(!g||!g.concepto||norm(g.concepto)!==v)continue;
    if(!best||(g.fecha||"")>(best.fecha||"")||((g.fecha||"")===(best.fecha||"")&&(g.ts||0)>(best.ts||0)))best=g}
  return best?best.categoria:null}
// Media mensual del año: entre los meses transcurridos si es el año en curso
const monthsElapsed=(year,now=new Date())=>year<now.getFullYear()?12:year>now.getFullYear()?0:now.getMonth()+1;

// Límites (los mismos que comprueban las reglas de Firestore)
const LIMITS={importe:1000000,concepto:200,categoria:60,fijo:60};
// ¿El gasto cumple las reglas de Firestore? (sin contar el id)
// Campos opcionales nuevos: tipo:"ingreso" (si no está, es un gasto), extra:true, fijo:"<id del fijo>"
function validGasto(g){return !!g&&typeof g.importe==="number"&&isFinite(g.importe)&&g.importe>0&&g.importe<LIMITS.importe
  &&typeof g.categoria==="string"&&g.categoria.trim().length>0&&g.categoria.length<=LIMITS.categoria
  &&typeof g.fecha==="string"&&g.fecha.length<=30&&/^\d{4}-\d{2}-\d{2}/.test(g.fecha)
  &&(g.concepto===undefined||(typeof g.concepto==="string"&&g.concepto.length<=LIMITS.concepto))
  &&(g.ts===undefined||typeof g.ts==="number")&&(g.importado===undefined||typeof g.importado==="boolean")
  &&(g.tipo===undefined||g.tipo==="gasto"||g.tipo==="ingreso")&&(g.extra===undefined||typeof g.extra==="boolean")
  &&(g.fijo===undefined||(typeof g.fijo==="string"&&g.fijo.length>0&&g.fijo.length<=LIMITS.fijo))}
// Atajo por dirección: ?importe=12,50&concepto=Kebab&cat=comida  →  {importe, concepto, cat, confirmar} o null
function parseShortcut(search,cats,gastos){const p=new URLSearchParams(search);
  if(!p.has("importe")&&!p.has("concepto"))return null;
  const importe=parseAmt(p.get("importe")||"");
  const concepto=(p.get("concepto")||"").trim().slice(0,LIMITS.concepto);
  const q=norm((p.get("cat")||p.get("categoria")||"").trim());
  let cat=q?((cats.find(c=>norm(c[0])===q)||cats.find(c=>norm(c[0]).startsWith(q))||[])[0]||null):null;
  if(!cat&&concepto){const c=lastCatFor(gastos,concepto);if(c&&cats.some(x=>x[0]===c))cat=c}
  return {importe,concepto,cat,confirmar:p.get("confirmar")==="1"}}
// Nombre libre: "Nueva categoría", "Nueva categoría 2", "Nueva categoría 3"…
function uniqueName(base,names){const s=new Set(names);if(!s.has(base))return base;let i=2;while(s.has(`${base} ${i}`))i++;return `${base} ${i}`}
// Quita categorías repetidas (se queda con la primera)
const dedupeCats=cats=>{const seen=new Set();return cats.filter(c=>!seen.has(c[0])&&seen.add(c[0]))};
// Color de categoría seguro: solo los de la paleta (evita que un valor manipulado inyecte código)
const safeColor=c=>ALL_COLORS.includes(c)?c:"--c8";
const safeCats=cats=>dedupeCats(cats).map(([n,c])=>[n,safeColor(c)]);
/* ═══ Rediseño: ingresos, extraordinarios, fijos, teclado y gráficos ═══ */
const isIngreso=g=>!!g&&g.tipo==="ingreso";
const r2=n=>Math.round((n+Number.EPSILON)*100)/100;
const sumImp=list=>r2(list.reduce((s,g)=>s+g.importe,0));
const daysIn=ym=>{const [y,m]=ym.split("-").map(Number);return new Date(y,m,0).getDate()};
const addDaysISO=(iso,n)=>{const [y,m,d]=iso.split("-").map(Number);const t=new Date(y,m-1,d+n);return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`};
// "Octubre 2026" (como en el diseño)
const monthTitle=ym=>{const n=monthName(ym).replace(" de "," ");return n.charAt(0).toUpperCase()+n.slice(1)};

// Teclado numérico: estado como texto ("13,5") y una tecla ("0"-"9", ",", "del")
function keypad(s,k){s=s||"";
  if(k==="del")return s.slice(0,-1);
  if(k===",")return s.includes(",")?s:(s===""?"0,":s+",");
  if(!/^\d$/.test(k))return s;
  const [i,d]=s.split(",");
  if(d!==undefined)return d.length>=2?s:s+k;
  if(i==="0")return k;
  return i.length>=6?s:s+k}
// Lo que se ve en grande: ["12.345","60"]
function amountParts(s){const v=parseAmt(s||"0");const [a,b]=eur(isFinite(v)?v:0).split(",");return [a,b]}

// Resumen de un mes: gastos, ingresos, balance y media diaria (sin extraordinarios)
function monthSummary(list,ym,today){
  const ms=list.filter(g=>(g.fecha||"").slice(0,7)===ym);
  const gs=ms.filter(g=>!isIngreso(g)),is=ms.filter(isIngreso);
  const gastos=sumImp(gs),ingresos=sumImp(is),normales=sumImp(gs.filter(g=>!g.extra));
  const dias=today.slice(0,7)===ym?+today.slice(8,10):daysIn(ym);
  return {gastos,ingresos,normales,balance:r2(ingresos-gastos),balanceNormal:r2(ingresos-normales),
    nGastos:gs.length,nIngresos:is.length,hayExtra:gs.some(g=>g.extra),media:normales/dias}}
// Por categoría: [{categoria,total,count,pct}] de mayor a menor
function byCategory(list){const t=sumImp(list),m=new Map();
  list.forEach(g=>{const c=m.get(g.categoria)||{categoria:g.categoria,total:0,count:0};c.total=r2(c.total+g.importe);c.count++;m.set(g.categoria,c)});
  return [...m.values()].map(c=>({...c,pct:t?c.total/t*100:0})).sort((a,b)=>b.total-a.total)}
// Gasto por día del mes: total = normal, extraImp = extraordinarios (y extra marca si hubo alguno)
function dailySeries(list,ym){const d=Array.from({length:daysIn(ym)},(_,i)=>({day:i+1,total:0,extra:false,extraImp:0}));
  list.forEach(g=>{if(isIngreso(g)||(g.fecha||"").slice(0,7)!==ym)return;const x=d[+g.fecha.slice(8,10)-1];if(!x)return;
    if(g.extra){x.extra=true;x.extraImp=r2(x.extraImp+g.importe)}else x.total=r2(x.total+g.importe)});return d}
// Lo mismo por meses de un año
function monthlySeries(list,year){const d=Array.from({length:12},(_,i)=>({day:i+1,total:0,extra:false,extraImp:0}));
  list.forEach(g=>{if(isIngreso(g)||!(g.fecha||"").startsWith(year+"-"))return;const x=d[+g.fecha.slice(5,7)-1];
    if(g.extra){x.extra=true;x.extraImp=r2(x.extraImp+g.importe)}else x.total=r2(x.total+g.importe)});return d}
// Agrupa por día (lo más reciente arriba) con el neto de cada día
function groupByDay(list){const m=new Map();list.forEach(g=>{const f=(g.fecha||"").slice(0,10);if(!m.has(f))m.set(f,[]);m.get(f).push(g)});
  return [...m.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([fecha,items])=>({fecha,
    items:items.sort((a,b)=>(b.ts||0)-(a.ts||0)),neto:r2(items.reduce((s,g)=>s+(isIngreso(g)?g.importe:-g.importe),0))}))}
// "Hoy · sábado, 31 oct", "Ayer · …" o "jueves, 29 oct"
function dayLabel(f,today){const [y,m,d]=f.split("-").map(Number);
  const t=new Date(y,m-1,d).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"short"}).replace(".","");
  return f===today?"Hoy · "+t:f===addDaysISO(today,-1)?"Ayer · "+t:t}
// Filtros de la pantalla Movimientos
function filterMovs(list,f){return list.filter(g=>f==="gastos"?!isIngreso(g):f==="ingresos"?isIngreso(g):f==="fijos"?!!g.fijo:true)}

// Icono para una categoría según su nombre (las categorías se pueden renombrar)
const CAT_ICONS=[["heart",["pareja","novi","amor"]],["utensils",["comida","restaurante","kebab","cena"]],["shopping-cart",["super","compra","mercado"]],
  ["bus",["transporte","bus","tren","coche","gasolina"]],["coffee",["cafe","snack","desayuno"]],["repeat",["suscrip"]],["gamepad-2",["tecno","juego","consola"]],
  ["gift",["regalo"]],["party-popper",["fiesta","salida","ocio"]],["beer",["bar","copa","cerveza","dyj"]],["graduation-cap",["uni","estudio","clase","libro"]],
  ["briefcase",["trabajo","sueldo","nomina"]],["wallet",["paga"]],["tag",["venta"]],["undo-2",["devoluc","reembolso"]],["house",["casa","hogar","alquiler"]],
  ["dumbbell",["gym","gimnasio","deporte"]],["pill",["salud","farmacia","medic"]],["shirt",["ropa"]],["plane",["viaje"]]];
function catIcon(name){const n=norm(name||"");for(const [ic,keys] of CAT_ICONS)if(keys.some(k=>n.includes(k)))return ic;return "shapes"}

// Categoría sugerida para un concepto: la última usada con ese concepto (mismo tipo) o por palabras conocidas
const CAT_WORDS={gasto:[["Súper",["mercadona","lidl","alimerka","carrefour","aldi","eroski","primaprix","alcampo","dia","super"]],
  ["Comida fuera",["kebab","pizza","burger","mcdonalds","montaditos","restaurante","chino","sushi","telepizza"]],
  ["Transporte",["bus","renfe","tren","metro","taxi","uber","cabify","gasolina","alsa"]],["Cafés y snacks",["cafe","batido","chuches","agua","snack"]],
  ["Suscripciones",["prime","netflix","spotify","claude","hbo","disney","icloud","youtube"]],["Salidas y fiesta",["fiesta","copas","discoteca","cine","concierto"]],
  ["Tecnología",["switch","funda","cargador","auriculares","steam"]],["Regalos",["regalo","cumple"]]],
  ingreso:[["Trabajo",["trabajo","nomina","sueldo","turno","clases"]],["Paga",["paga"]],["Ventas",["wallapop","vinted","venta","vendido"]],
  ["Regalos",["regalo","cumple"]],["Devoluciones",["devolucion","reembolso","bizum"]]]};
function suggestCat(list,concepto,tipo,names){const v=norm(String(concepto||"").trim());if(!v)return null;
  const same=list.filter(g=>(isIngreso(g)?"ingreso":"gasto")===tipo);
  const c=lastCatFor(same,v);if(c&&names.includes(c))return c;
  const words=v.split(/\s+/);
  for(const [cat,keys] of CAT_WORDS[tipo]||[])if(names.includes(cat)&&keys.some(k=>words.includes(k)||(k.length>=4&&v.startsWith(k))))return cat;
  return null}

// Fijos: {id,concepto,importe,categoria,tipo,dia,ultimo:"AAAA-MM"} ("ultimo" = último mes ya apuntado)
function fijoFrom(g,id){return {id,concepto:g.concepto||"",importe:g.importe,categoria:g.categoria,tipo:isIngreso(g)?"ingreso":"gasto",dia:+g.fecha.slice(8,10),ultimo:g.fecha.slice(0,7)}}
const validFijo=f=>!!f&&typeof f.id==="string"&&f.id.length>0&&f.id.length<=LIMITS.fijo&&typeof f.dia==="number"&&f.dia>=1&&f.dia<=31
  &&/^\d{4}-\d{2}$/.test(f.ultimo||"")&&validGasto({concepto:f.concepto,importe:f.importe,categoria:f.categoria,fecha:f.ultimo+"-01",tipo:f.tipo});
// Qué toca apuntar hoy: {nuevos:[gastos], fijos:[con "ultimo" al día], cambiado}
function dueFijos(fijos,today){const nowYM=today.slice(0,7),nowD=+today.slice(8,10);const nuevos=[];let cambiado=false;
  const out=fijos.map(f=>{let ym=shiftMonth(f.ultimo,1),last=f.ultimo;const lim=shiftMonth(nowYM,-12);if(ym<lim)ym=lim;
    for(;ym<=nowYM;ym=shiftMonth(ym,1)){const d=Math.min(f.dia,daysIn(ym));if(ym===nowYM&&d>nowD)break;
      const g={id:`fijo-${f.id}-${ym}`,concepto:f.concepto,importe:f.importe,categoria:f.categoria,fecha:`${ym}-${pad(d)}`,fijo:f.id,ts:new Date(+ym.slice(0,4),+ym.slice(5)-1,d,8).getTime()};
      if(f.tipo==="ingreso")g.tipo="ingreso";nuevos.push(g);last=ym}
    if(last!==f.ultimo){cambiado=true;return {...f,ultimo:last}}return f});
  return {nuevos,fijos:out,cambiado}}
