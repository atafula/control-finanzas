const SEED=[];
const CATS_KEY="mis-gastos-cats";
// Si lo guardado está estropeado, se usan las de serie (antes la app dejaba de funcionar)
let CATS;try{const v=JSON.parse(localStorage.getItem(CATS_KEY));CATS=validCats(v)?safeCats(v):DEFAULT_CATS.map(c=>[...c])}catch(e){CATS=DEFAULT_CATS.map(c=>[...c])}
// Si había algo que limpiar (repetidas, colores raros), se guarda ya limpio
try{const raw=localStorage.getItem(CATS_KEY);if(raw&&raw!==JSON.stringify(CATS))localStorage.setItem(CATS_KEY,JSON.stringify(CATS))}catch(e){}
const saveCats=()=>{try{localStorage.setItem(CATS_KEY,JSON.stringify(CATS))}catch(e){};pushCats()};
// Categorías en la nube (users/{uid}): se conservan al cambiar de móvil y el atajo las lee de "catsText"
function pushCats(){try{const u=auth&&auth.currentUser;if(!u||!db)return;
  db.collection("users").doc(u.uid).set({cats:CATS.map(([n,c])=>({n,c})),catsText:CATS.map(c=>c[0]).join("\n")},{merge:true}).catch(()=>{})}catch(e){}}

/* Gastos e ingresos fijos (se repiten cada mes). En el móvil y en users/{uid}.fijos */
const FIJOS_KEY="mis-gastos-fijos";
function loadFijos(){try{const v=JSON.parse(localStorage.getItem(FIJOS_KEY));return Array.isArray(v)?v.filter(validFijo):[]}catch(e){return[]}}
let FIJOS=loadFijos();
function pushFijos(){try{const u=auth&&auth.currentUser;if(!u||!db)return;db.collection("users").doc(u.uid).set({fijos:FIJOS},{merge:true}).catch(()=>{})}catch(e){}}
function saveFijos(push=true){try{localStorage.setItem(FIJOS_KEY,JSON.stringify(FIJOS))}catch(e){};if(push)pushFijos()}

let catsUnsub=null;
function listenCats(user){
  if(catsUnsub)catsUnsub();
  catsUnsub=db.collection("users").doc(user.uid).onSnapshot(doc=>{
    const d=doc.exists?doc.data():null;
    // Fijos: los de la nube mandan; si la nube aún no tiene, se suben los del móvil
    if(d&&Array.isArray(d.fijos)){const nf=d.fijos.filter(validFijo);
      if(JSON.stringify(nf)!==JSON.stringify(FIJOS)){FIJOS=nf;saveFijos(false);runFijos();render();renderFijosList()}}
    else if(FIJOS.length)pushFijos();
    if(!d||!Array.isArray(d.cats)||!d.cats.length){pushCats();return} // primera vez: sube las del móvil
    const next=safeCats(d.cats.filter(x=>x&&typeof x.n==="string"&&x.n.trim()).map(x=>[x.n,x.c]));
    if(!next.length)return;
    if(JSON.stringify(next)===JSON.stringify(CATS))return;
    CATS=next;try{localStorage.setItem(CATS_KEY,JSON.stringify(CATS))}catch(e){}
    buildChips();if($("catSheet").hidden)render();
  },()=>{});
}
function stopCats(){if(catsUnsub){catsUnsub();catsUnsub=null}}
const color=n=>{const c=CATS.find(x=>x[0]===n);return `var(${safeColor(c&&c[1])})`};
const incColor=n=>{const c=INCOME_CATS.find(x=>x[0]===n);return `var(${c?c[1]:"--c10"})`};
const colorOf=g=>isIngreso(g)?incColor(g.categoria):color(g.categoria);
const $=id=>document.getElementById(id);

/* Tema: automático, claro u oscuro (solo en este móvil) */
const TEMA_KEY="mis-gastos-tema";
function applyTema(t){const r=document.documentElement;if(t==="light"||t==="dark")r.dataset.theme=t;else delete r.dataset.theme;
  document.querySelectorAll("[data-tema]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tema===(t==="light"||t==="dark"?t:"auto"))))}
applyTema((()=>{try{return localStorage.getItem(TEMA_KEY)}catch(e){return null}})());

let gastos=[];           // {id, concepto, importe, categoria, fecha, ts?, importado?, tipo?:"ingreso", extra?:true, fijo?:"id"}
const KEY="mis-gastos-v3";
const UID_KEY="mis-gastos-uid";
const DEL_KEY="mis-gastos-deleted";
function load(){try{const r=localStorage.getItem(KEY);if(r){const v=JSON.parse(r);return Array.isArray(v)?v.map(fixGasto):v}}catch(e){}return null}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(gastos))}catch(e){toast("No se pudo guardar en el móvil")}}
function loadDeleted(){try{return JSON.parse(localStorage.getItem(DEL_KEY))||[]}catch(e){return[]}}
function addDeleted(id){try{const d=new Set(loadDeleted());d.add(id);localStorage.setItem(DEL_KEY,JSON.stringify([...d]))}catch(e){}}
function clearLocalData(){try{localStorage.removeItem(KEY);localStorage.removeItem(UID_KEY);localStorage.removeItem(DEL_KEY);localStorage.removeItem(PEND_KEY);localStorage.removeItem(FIJOS_KEY)}catch(e){}}
// Gastos creados/editados sin sesión que aún no están en la nube. Solo estos se suben al conectar:
// así un gasto borrado en otro dispositivo no "resucita".
const PEND_KEY="mis-gastos-pending";
function loadPending(){try{const v=JSON.parse(localStorage.getItem(PEND_KEY));return Array.isArray(v)?v:null}catch(e){return null}}
function savePending(ids){try{localStorage.setItem(PEND_KEY,JSON.stringify([...new Set(ids)]))}catch(e){}}
function addPending(ids){savePending([...(loadPending()||[]),...ids])}
function dropPending(ids){const s=new Set(ids);savePending((loadPending()||[]).filter(id=>!s.has(id)))}
// Primera vez con esta versión: si nunca se inició sesión, todo lo local está pendiente; si sí, ya estaba en la nube.
if(loadPending()===null){const l=load()||[];savePending(localStorage.getItem(UID_KEY)?[]:l.filter(g=>g&&g.id).map(g=>g.id))}
// Firebase admite 500 operaciones por lote: se trocean
function commitOps(ops){const ps=[];for(let i=0;i<ops.length;i+=400){const b=db.batch();ops.slice(i,i+400).forEach(f=>f(b));ps.push(b.commit())}return Promise.all(ps)}
const FIREBASE_CONFIG={
  apiKey: "AIzaSyBLGJM6G0epcqg1vHi3sCgwxP8lpftZQQI",
  authDomain: "mis-gastos-9f57b.firebaseapp.com",
  projectId: "mis-gastos-9f57b",
  storageBucket: "mis-gastos-9f57b.firebasestorage.app",
  messagingSenderId: "630493807566",
  appId: "1:630493807566:web:3354ad5d3bbf1febdb219f"
};
let col=null,db=null,auth=null;
if(FIREBASE_CONFIG.apiKey!=="REEMPLAZA"){
  try{
    firebase.initializeApp(FIREBASE_CONFIG);
    db=firebase.firestore();
    db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    auth=firebase.auth();
  }catch(e){}
}
let month=todayISO().slice(0,7);
let filter=null,searchQuery="",statsMode=false,statsYear=new Date().getFullYear(),catsExpanded=false;
let editing=null, selCat=null, catManual=false;
let tipo="gasto", fresh=false, fijoOn=false, extraOn=false;   // estado del formulario
let movsOpen=false, movsF="todos", movsQ="";                  // pantalla Movimientos
const syncing=new Set(); // ids que se están subiendo ahora mismo

/* ── utilidades de pantalla ── */
const MINUS="−";
const signed=v=>`${v<0?MINUS:v>0?"+":""}${eur(Math.abs(v))} €`;
const plural=(n,a,b)=>`${n} ${n===1?a:b}`;
const tint=c=>`background:color-mix(in srgb,${c} 15%,transparent);color:${c}`;
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function cicEl(cat,c,icon){const d=el("div","cic");d.style.cssText=tint(c);d.innerHTML=ico(icon||catIcon(cat));return d}
function setTotal(v){const [a,b]=eur(v).split(",");const t=$("total");t.innerHTML="";t.append(el("span",null,a),el("span","cent",","+b),el("span","eur","€"))}
function setPills(list){const s=$("sub");s.innerHTML="";list.forEach(([txt,cls])=>s.appendChild(el("span","pill"+(cls?" "+cls:""),txt)))}
const curMonth=()=>todayISO().slice(0,7);

/* Fila de un movimiento: icono, concepto, categoría (+ Fijo/Extra) e importe */
function rowEl(g){
  const b=el("button","item");b.type="button";
  b.appendChild(cicEl(g.categoria,colorOf(g)));
  const t=el("span","t"),m=el("div","m",g.categoria);
  if(g.fijo)m.appendChild(el("span","tag","Fijo"));
  if(g.extra&&!isIngreso(g))m.appendChild(el("span","tag","Extra"));
  t.append(el("div","c",g.concepto||g.categoria),m);
  b.append(t,el("span","a num"+(isIngreso(g)?" pos":""),(isIngreso(g)?"+":MINUS)+eur(g.importe)+" €"));
  b.onclick=()=>openSheet(g);
  return b;
}
// Lista agrupada por día con el neto de cada día
function renderGroups(box,list,empty){
  box.innerHTML="";
  if(!list.length){box.appendChild(empty());return}
  const today=todayISO(),yr=today.slice(0,4);
  groupByDay(list).forEach(d=>{
    const ok=/^\d{4}-\d{2}-\d{2}$/.test(d.fecha);
    const h=el("div","day");
    h.append(el("span",null,ok?dayLabel(d.fecha,today)+(d.fecha.slice(0,4)!==yr?" "+d.fecha.slice(0,4):""):d.fecha||"Sin fecha"),el("span","num"+(d.neto>0?" pos":""),signed(d.neto)));
    box.appendChild(h);
    d.items.forEach(g=>box.appendChild(rowEl(g)));
  });
}
const emptyMonth=()=>{const e=el("div","empty");e.innerHTML="Aquí aparecerán tus movimientos.<br>Pulsa <b>Añadir</b> para apuntar el primero.";return e};

/* Tarjeta «Ingresos y gastos» */
function renderFlow(s,cuando){
  $("flowIn").textContent="+"+eur(s.ingresos)+" €";
  $("flowOut").textContent=MINUS+eur(s.gastos)+" €";
  const max=Math.max(s.ingresos,s.gastos)||1;
  $("cmpIn").style.width=(s.ingresos/max*100)+"%";$("cmpOut").style.width=(s.gastos/max*100)+"%";
  $("balanceWhen").textContent=cuando;
  const b=$("balance");b.textContent=signed(s.balance);b.className="num"+(s.balance<0?" neg":s.balance>0?" pos":"");
  $("balanceHint").hidden=!s.hayExtra;
  const n=$("balanceNormal");n.textContent=signed(s.balanceNormal);n.className="num"+(s.balanceNormal<0?" neg":s.balanceNormal>0?" pos":"");
}
/* Gráfico de barras (días del mes o meses del año) */
function renderChart(series,todayIdx,labels){
  const max=Math.max(1,...series.map(d=>d.total));
  const c=$("chart");c.innerHTML="";
  series.forEach((d,i)=>{const b=el("i","bar");
    if(d.extra){b.classList.add("extra");b.style.height="100%"}
    else if(d.total>0){b.style.height=Math.max(6,d.total/max*100)+"%";if(i===todayIdx)b.classList.add("today")}
    else{b.classList.add("zero");b.style.height="4%"}
    c.appendChild(b)});
  const a=$("axis");a.innerHTML="";labels.forEach(l=>a.appendChild(el("span",null,l)));
}
/* Tarjeta «Por categoría» (solo gastos) */
function renderCats(list,clickable){
  const rows=byCategory(list);
  $("stack").innerHTML="";rows.forEach(r=>{const i=el("i");i.style.cssText=`flex:${r.total};background:${color(r.categoria)}`;$("stack").appendChild(i)});
  const cats=$("cats");cats.innerHTML="";
  const shown=catsExpanded?rows:rows.slice(0,4);
  shown.forEach(r=>{
    const b=el("button","cat-row"+(filter===r.categoria?" on":""));b.type="button";
    const t=el("span","t");t.append(el("div","name",r.categoria),el("div","csub",plural(r.count,"gasto","gastos")));
    const a=el("span","amt num",eur(r.total)+" €");a.appendChild(el("small",null,Math.round(r.pct)+"%"));
    b.append(cicEl(r.categoria,color(r.categoria)),t,a);
    if(clickable)b.onclick=()=>{filter=filter===r.categoria?null:r.categoria;render()};
    cats.appendChild(b);
  });
  if(!rows.length)cats.appendChild(el("div","empty-cats","Cuando apuntes gastos verás aquí en qué se va el dinero."));
  const more=$("catsMore");more.hidden=rows.length<=4;more.textContent=catsExpanded?"Ver menos":`Ver las ${rows.length} categorías`;
}

function render(){
  $("prev").disabled=false;
  $("statsToggle").setAttribute("aria-pressed",String(statsMode));
  $("flowCard").hidden=false;$("chartCard").hidden=false;$("seeAll").hidden=false;
  if(statsMode){$("searchToggle").hidden=true;$("editCatsBtn").hidden=true;renderStats();if(movsOpen)renderMovs();return}
  $("editCatsBtn").hidden=false;
  $("searchToggle").hidden=false;
  if(searchQuery){renderSearch();return}
  const today=todayISO(),isNow=month===curMonth();
  $("heroLabel").textContent=isNow?"Gastado este mes":"Gastado en "+monthName(month).split(" ")[0];
  $("monthLabel").textContent=monthTitle(month);
  $("next").disabled = month>=curMonth();
  const inMonth=gastos.filter(g=>(g.fecha||"").slice(0,7)===month);
  const s=monthSummary(gastos,month,today);
  setTotal(s.gastos);
  setPills(s.nGastos||s.nIngresos?[[`${eur(s.media)} € al día`],[plural(s.nGastos,"gasto","gastos")],...(s.nIngresos?[[plural(s.nIngresos,"ingreso","ingresos"),"inc"]]:[])]:[["Sin movimientos este mes"]]);
  $("flowTitle").textContent="Ingresos y gastos";
  renderFlow(s,"del mes");
  $("chartTitle").textContent="Gasto diario";$("normalLabel").textContent="Mes normal";
  renderChart(dailySeries(gastos,month),isNow?+today.slice(8,10)-1:-1,["1","8","15","22",String(daysIn(month))]);
  $("mesNormal").textContent=eur(s.normales)+" €";
  renderCats(inMonth.filter(g=>!isIngreso(g)),true);
  $("listTitle").firstChild.textContent=filter?filter:"Movimientos";
  renderGroups($("list"),inMonth.filter(g=>!filter||g.categoria===filter),emptyMonth);
  if(movsOpen)renderMovs();
}

/* hoja de añadir/editar */
const catsFor=t=>t==="ingreso"?INCOME_CATS:CATS;
function buildChips(){
  const box=$("chips");box.innerHTML="";
  catsFor(tipo).forEach(([n,v])=>{
    const b=el("button","chip");b.type="button";b.setAttribute("aria-pressed","false");
    const c=el("span","cic");c.style.cssText=tint(`var(${tipo==="ingreso"?v:safeColor(v)})`);c.innerHTML=ico(catIcon(n));
    b.append(c,el("span",null,n));
    b.onclick=()=>{selCat=n;catManual=true;markChips();validate()};
    box.appendChild(b);
  });
  markChips();
}
function markChips(){[...$("chips").children].forEach(c=>c.setAttribute("aria-pressed",String(c.textContent===selCat)))}
function updateAmount(){
  const v=$("importe").value,[a,b]=amountParts(v),box=$("amountView");box.innerHTML="";
  if(tipo==="ingreso")box.appendChild(el("span",null,"+"));
  box.append(el("span",null,a),el("span","cent",","+b),el("span","caret"),el("span","eur","€"));
  $("amountBox").classList.toggle("zero",!(parseAmt(v)>0));
}
function validate(){const v=parseAmt($("importe").value),good=v>0&&v<LIMITS.importe;
  $("save").disabled=!(good&&selCat);
  $("save").innerHTML=ico("check")+(good?(tipo==="ingreso"?"Guardar ingreso de ":"Guardar ")+eur(v)+" €":"Guardar");}
function updateSuggestion(auto){
  const s=editing?null:suggestCat(gastos,$("concepto").value,tipo,catsFor(tipo).map(c=>c[0]));
  const b=$("suggestion");b.hidden=!s;
  if(s){b.innerHTML=ico("sparkles");b.appendChild(el("span",null,s));b.dataset.cat=s}
  if(auto&&s&&!catManual){selCat=s;markChips();validate()}
}
function setTipo(t,keepCat){
  tipo=t;$("sheet").classList.toggle("is-ingreso",t==="ingreso");
  $("typeGasto").setAttribute("aria-pressed",String(t!=="ingreso"));$("typeIngreso").setAttribute("aria-pressed",String(t==="ingreso"));
  $("tgExtra").hidden=t==="ingreso";if(t==="ingreso")extraOn=false;
  $("tgFijoTxt").textContent=t==="ingreso"?"Se repite cada mes":"Cada mes";
  if(!keepCat){selCat=null;catManual=false}
  buildChips();markToggles();updateAmount();validate();updateSuggestion(!keepCat);
}
function markToggles(){$("tgFijo").setAttribute("aria-checked",String(fijoOn));$("tgExtra").setAttribute("aria-checked",String(extraOn))}
function shortDay(f){const [y,m,d]=f.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("es-ES",{day:"numeric",month:"short"}).replace(".","")+(String(y)!==todayISO().slice(0,4)?" "+y:"")}
function markFecha(){
  const v=$("fecha").value||todayISO(),t=todayISO(),w=v===t?"h":v===addDaysISO(t,-1)?"a":"o";
  $("dHoy").setAttribute("aria-pressed",String(w==="h"));$("dAyer").setAttribute("aria-pressed",String(w==="a"));$("dOtro").setAttribute("aria-pressed",String(w==="o"));
  $("dOtroTxt").textContent=w==="o"&&/^\d{4}-\d{2}-\d{2}$/.test(v)?shortDay(v):"Otro día";
}
function setFecha(v){$("fecha").value=v;markFecha()}
function showSheet(id){$("scrim").hidden=false;$(id).hidden=false;document.body.style.overflow="hidden";
  requestAnimationFrame(()=>{$("scrim").classList.add("show");$(id).classList.add("show")})}
function hideSheet(id){$("scrim").classList.remove("show");$(id).classList.remove("show");
  setTimeout(()=>{if(!$(id).classList.contains("show")){$(id).hidden=true;if(["sheet","catSheet","settingsSheet"].every(s=>!$(s).classList.contains("show"))){$("scrim").hidden=true;if(!movsOpen)document.body.style.overflow=""}}},250)}
function openSheet(g){
  editing=g||null;
  $("sheetTitle").textContent=g?(isIngreso(g)?"Editar ingreso":"Editar gasto"):"Nuevo movimiento";
  $("importe").value=g?eurInput(g.importe):"";fresh=!!g;
  $("concepto").value=g?g.concepto:"";
  setFecha(g?g.fecha:todayISO());
  selCat=g?g.categoria:null;catManual=false;
  fijoOn=!!(g&&g.fijo);extraOn=!!(g&&g.extra);
  setTipo(g&&isIngreso(g)?"ingreso":"gasto",true);
  $("del").hidden=!g;$("del").classList.remove("armed");$("del").textContent="Borrar";
  showSheet("sheet");
}
function closeSheet(){document.activeElement&&document.activeElement.blur();hideSheet("sheet")}
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove("show"),1800)}

// Guarda un gasto/ingreso en el móvil y (si hay sesión) en la nube
function saveOne(g){
  const {id,...body}=g;
  const i=gastos.findIndex(x=>x.id===id);if(i>=0)gastos[i]=g;else gastos.push(g);
  addPending([id]);persist();
  if(col){syncing.add(id);
    col.doc(id).set(body).then(()=>dropPending([id])).catch(err=>{
      if(err&&err.code==="permission-denied"){dropPending([id]);toast("Firebase ha rechazado el movimiento")}
      else if(err&&err.code!=="unavailable")toast("No se pudo guardar. Inténtalo otra vez");
    }).then(()=>syncing.delete(id));}
}
const newFijoId=()=>"f"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

$("form").addEventListener("submit",async e=>{
  e.preventDefault();
  const body={concepto:$("concepto").value.trim().slice(0,LIMITS.concepto),importe:parseAmt($("importe").value),categoria:selCat,fecha:$("fecha").value||todayISO(),ts:editing&&editing.ts?editing.ts:Date.now()};
  if(!(body.importe>0)||!selCat)return;
  if(body.importe>=LIMITS.importe){toast("El importe es demasiado grande");return}
  if(editing&&editing.importado&&body.fecha===editing.fecha) body.importado=true;
  if(tipo==="ingreso")body.tipo="ingreso";
  if(extraOn&&tipo!=="ingreso")body.extra=true;
  // Se repite cada mes
  let fid=editing&&editing.fijo||null;
  if(fijoOn){
    const f=fid&&FIJOS.find(x=>x.id===fid);
    if(f)Object.assign(f,{concepto:body.concepto,importe:body.importe,categoria:body.categoria,tipo});
    else{fid=fid||newFijoId();FIJOS.push(fijoFrom(body,fid))}
    saveFijos();body.fijo=fid;
  }else if(fid){FIJOS=FIJOS.filter(f=>f.id!==fid);saveFijos()}
  $("save").disabled=true;
  const id=editing?editing.id:(col?col.doc().id:"g"+Date.now());
  saveOne({id,...body});
  toast(`${tipo==="ingreso"?"Ingreso":"Gasto"} ${editing?"actualizado":"guardado"}`);
  month=body.fecha.slice(0,7);
  if(filter&&filter!==body.categoria)filter=null; // si no, el movimiento nuevo no se vería
  render(); // muestra el mes del movimiento guardado
  closeSheet();
});
$("del").onclick=async()=>{
  const b=$("del");
  if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="¿Seguro?";return}
  try{
    const delId=editing.id;
    gastos=gastos.filter(g=>g!==editing);persist();render();
    addDeleted(delId);dropPending([delId]);
    if(col) col.doc(delId).delete().catch(()=>{});
    toast("Borrado");
    closeSheet()
  }catch(e){toast("No se pudo borrar")}
};
$("importe").addEventListener("input",()=>{fresh=false;updateAmount();validate()});
function pressKey(k){let v=$("importe").value;if(fresh){fresh=false;if(k!=="del")v=""}
  $("importe").value=keypad(v,k);updateAmount();validate()}
$("keys").addEventListener("click",e=>{const b=e.target.closest(".key");if(b)pressKey(b.dataset.k)});
// Con teclado físico (ordenador): números, coma y borrar
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){if(!$("sheet").hidden)closeSheet();else if(!$("settingsSheet").hidden)closeSettings();else if(!$("catSheet").hidden)closeCatsSheet();else if(movsOpen)closeMovs();return}
  if($("sheet").hidden||document.activeElement===$("concepto")||e.metaKey||e.ctrlKey)return;
  const k=/^\d$/.test(e.key)?e.key:(e.key===","||e.key===".")?",":e.key==="Backspace"?"del":null;
  if(k){e.preventDefault();pressKey(k)}
});
$("concepto").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();e.target.blur()}});
$("concepto").addEventListener("input",()=>updateSuggestion(true));
$("suggestion").onclick=()=>{selCat=$("suggestion").dataset.cat;catManual=true;markChips();validate()};
$("typeGasto").onclick=()=>{if(tipo!=="gasto")setTipo("gasto")};
$("typeIngreso").onclick=()=>{if(tipo!=="ingreso")setTipo("ingreso")};
$("tgFijo").onclick=()=>{fijoOn=!fijoOn;markToggles()};
$("tgExtra").onclick=()=>{extraOn=!extraOn;markToggles()};
$("dHoy").onclick=()=>setFecha(todayISO());
$("dAyer").onclick=()=>setFecha(addDaysISO(todayISO(),-1));
// «Otro día»: en el ordenador tocar el campo no abre el calendario; se pide explícitamente (en iPhone ya se abre solo)
$("fecha").addEventListener("click",e=>{try{e.currentTarget.showPicker()}catch(err){}});
$("fecha").addEventListener("input",markFecha);$("fecha").addEventListener("change",markFecha);
$("fab").onclick=()=>openSheet(null);
$("close").onclick=closeSheet;
$("scrim").onclick=()=>{if(!$("catSheet").hidden)closeCatsSheet();else if(!$("settingsSheet").hidden)closeSettings();else closeSheet()};
$("editCatsBtn").onclick=()=>openCatsSheet();
$("closeCatsBtn").onclick=closeCatsSheet;
$("catsMore").onclick=()=>{catsExpanded=!catsExpanded;render()};
$("addCatBtn").onclick=()=>{
  const next=ALL_COLORS.find(c=>!CATS.some(x=>x[1]===c))||ALL_COLORS[CATS.length%ALL_COLORS.length];
  CATS.push([uniqueName("Nueva categoría",CATS.map(c=>c[0])),next]);saveCats();buildChips();openCatsSheet();
  setTimeout(()=>{const ins=$("catList").querySelectorAll(".cat-name");const l=ins[ins.length-1];l.select();l.focus()},50);
};
$("prev").onclick=()=>{if(statsMode){statsYear--;render();return}month=shiftMonth(month,-1);filter=null;render()};
$("next").onclick=()=>{if(statsMode){statsYear++;render();return}month=shiftMonth(month,1);filter=null;render()};
$("statsToggle").onclick=()=>{statsMode=!statsMode;statsYear=+month.slice(0,4);filter=null;searchQuery="";$("searchInput").value="";$("searchWrap").classList.remove("open");render()};
$("searchToggle").onclick=()=>{const open=$("searchWrap").classList.toggle("open");$("searchToggle").setAttribute("aria-pressed",String(open));if(!open){searchQuery="";$("searchInput").value="";render()}else setTimeout(()=>$("searchInput").focus(),50)};
$("searchInput").addEventListener("input",e=>{searchQuery=e.target.value.trim();render()});

function openCatsSheet(){
  const list=$("catList");list.innerHTML="";
  CATS.forEach(([name,cv])=>{
    let catName=name;
    const used=gastos.some(g=>!isIngreso(g)&&g.categoria===catName);
    const row=el("div","cat-edit-row");
    const inp=el("input","cat-name");inp.value=catName;inp.maxLength=LIMITS.categoria+20;
    const delBtn=el("button","cat-del","Borrar");delBtn.type="button";delBtn.disabled=used||CATS.length<=1;
    row.append(cicEl(catName,`var(${safeColor(cv)})`),inp,delBtn);
    inp.addEventListener("change",async()=>{
      const newName=inp.value.trim().slice(0,LIMITS.categoria);if(!newName){inp.value=catName;return}if(newName===catName)return;
      const old=catName;
      // Si ya existe una categoría con ese nombre, se fusionan
      if(CATS.some(x=>x[0]===newName))CATS=CATS.filter(x=>x[0]!==old);
      else{const cat=CATS.find(x=>x[0]===old);if(cat)cat[0]=newName}
      catName=newName;saveCats();
      if(filter===old)filter=newName;
      const ids=gastos.filter(g=>!isIngreso(g)&&g.categoria===old).map(g=>g.id);
      gastos.forEach(g=>{if(!isIngreso(g)&&g.categoria===old)g.categoria=newName});persist();
      let fc=false;FIJOS.forEach(f=>{if(f.tipo!=="ingreso"&&f.categoria===old){f.categoria=newName;fc=true}});if(fc)saveFijos();
      if(col){
        const pend=new Set(loadPending()||[]);
        const up=ids.filter(id=>!pend.has(id));
        const ops=up.map(id=>b=>b.set(col.doc(id),{categoria:newName},{merge:true}));
        if(ops.length){addPending(up);commitOps(ops).then(()=>dropPending(up)).catch(()=>toast("No se pudo cambiar la categoría en la nube"))}
      }else addPending(ids);
      buildChips();render();openCatsSheet();
    });
    delBtn.onclick=()=>{
      if(gastos.some(g=>!isIngreso(g)&&g.categoria===catName)||CATS.length<=1)return; // la última no se borra
      if(!delBtn.classList.contains("armed")){delBtn.classList.add("armed");delBtn.textContent="¿Seguro?";return}
      const idx=CATS.findIndex(x=>x[0]===catName);
      if(idx!==-1)CATS.splice(idx,1);
      saveCats();buildChips();openCatsSheet();render();
    };
    list.appendChild(row);
  });
  if($("catSheet").hidden)showSheet("catSheet");
}
function closeCatsSheet(){hideSheet("catSheet")}

/* Ajustes: tema, fijos, copia de seguridad y cuenta */
function renderFijosList(){
  const box=$("fijosList");box.innerHTML="";
  if(!FIJOS.length){box.appendChild(el("p","note","No tienes gastos ni ingresos fijos. Activa «Cada mes» al apuntar uno y se añadirá solo cada mes."));return}
  FIJOS.forEach(f=>{
    const row=el("div","srow"),g=el("span","grow");
    g.append(el("span",null,f.concepto||f.categoria),el("small",null,`${f.tipo==="ingreso"?"+":MINUS}${eur(f.importe)} € · ${f.categoria} · día ${f.dia}`));
    const q=el("button","quitar","Quitar");q.type="button";q.dataset.quitar=f.id;
    q.onclick=()=>{if(!q.classList.contains("armed")){q.classList.add("armed");q.textContent="¿Quitar?";return}
      FIJOS=FIJOS.filter(x=>x.id!==f.id);saveFijos();renderFijosList();toast("Ya no se repetirá")};
    row.append(cicEl(f.categoria,f.tipo==="ingreso"?incColor(f.categoria):color(f.categoria)),g,q);box.appendChild(row);
  });
}
function openSettings(){renderFijosList();showSheet("settingsSheet")}
function closeSettings(){hideSheet("settingsSheet")}
$("settingsBtn").onclick=openSettings;
$("closeSettings").onclick=closeSettings;
document.querySelectorAll("[data-tema]").forEach(b=>b.onclick=()=>{const t=b.dataset.tema;try{localStorage.setItem(TEMA_KEY,t)}catch(e){}applyTema(t)});

/* Pantalla Movimientos */
function openMovs(){movsOpen=true;const v=$("movsView");v.classList.add("show");v.setAttribute("aria-hidden","false");v.scrollTop=0;document.body.style.overflow="hidden";renderMovs()}
function closeMovs(){movsOpen=false;const v=$("movsView");v.classList.remove("show");v.setAttribute("aria-hidden","true");document.body.style.overflow=""}
function renderMovs(){
  $("mvLabel").textContent=monthTitle(month);$("mvNext").disabled=month>=curMonth();
  const inM=gastos.filter(g=>(g.fecha||"").slice(0,7)===month),s=monthSummary(gastos,month,todayISO());
  const ms=$("msum");ms.innerHTML="";
  const a=el("span",null,"Entra "),b=el("span",null,"Sale ");a.appendChild(el("b","pos","+"+eur(s.ingresos)+" €"));b.appendChild(el("b",null,MINUS+eur(s.gastos)+" €"));ms.append(a,b);
  document.querySelectorAll("#movsFilters [data-f]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.f===movsF)));
  const q=norm(movsQ.trim());
  const list=filterMovs(inM,movsF).filter(g=>!q||norm(g.concepto||"").includes(q)||norm(g.categoria||"").includes(q));
  renderGroups($("movsList"),list,()=>el("div","empty",inM.length?"No hay movimientos con este filtro.":"Aún no hay movimientos este mes."));
}
$("seeAll").onclick=openMovs;
$("flowDetail").onclick=openMovs;
$("movsBack").onclick=closeMovs;
$("mvPrev").onclick=()=>{month=shiftMonth(month,-1);filter=null;render()};
$("mvNext").onclick=()=>{month=shiftMonth(month,1);filter=null;render()};
$("movsFilters").addEventListener("click",e=>{const b=e.target.closest("[data-f]");if(b){movsF=b.dataset.f;renderMovs()}});
$("movsSearchBtn").onclick=()=>{const w=$("movsSearchWrap");w.hidden=!w.hidden;$("movsSearchBtn").setAttribute("aria-pressed",String(!w.hidden));
  if(w.hidden){movsQ="";$("movsSearch").value="";renderMovs()}else $("movsSearch").focus()};
$("movsSearch").addEventListener("input",e=>{movsQ=e.target.value;renderMovs()});

/* Iconos fijos de la pantalla */
[["prev","chevron-left"],["next","chevron-right"],["mvPrev","chevron-left"],["mvNext","chevron-right"],["movsBack","chevron-left"],
 ["searchToggle","search"],["statsToggle","chart-column"],["settingsBtn","settings-2"],["movsSearchBtn","search"],["searchIco","search"],["movsSearchIco","search"],
 ["flowInIco","arrow-down-left"],["flowOutIco","arrow-up-right"],["fabIco","plus"],["close","x"],["closeCatsBtn","x"],["closeSettings","x"],
 ["dOtroIco","calendar"],["tgFijoIco","repeat"],["tgExtraIco","sparkles"],["exportIco","download"],["importIco","upload"],["csvIco","file-spreadsheet"],
 ["loginIco","log-in"],["logoutIco","log-out"]].forEach(([id,n])=>{const e=$(id);if(e)e.innerHTML=ico(n)});
document.querySelector('.key[data-k="del"]').innerHTML=ico("delete");

/* Fondo de puntitos: se apaga al bajar */
{let p=false;const f=()=>{p=false;document.documentElement.style.setProperty("--dots",(1-Math.min(window.scrollY/320,1)).toFixed(3))};
 window.addEventListener("scroll",()=>{if(!p){p=true;requestAnimationFrame(f)}},{passive:true})}

buildChips();

/* copia de seguridad */
$("exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(gastos,null,1)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`gastos-${todayISO()}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};
$("csvBtn").onclick=()=>{
  const rows=[["fecha","tipo","concepto","categoria","importe","extraordinario"],...gastos.map(g=>[g.fecha,isIngreso(g)?"ingreso":"gasto",g.concepto,g.categoria,String(g.importe).replace(".",","),g.extra?"sí":""])];
  const csv="﻿"+rows.map(r=>r.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(";")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`gastos-${todayISO()}.csv`;
  document.body.appendChild(a);a.click();a.remove();
};
$("importFile").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const data=JSON.parse(await f.text());if(!Array.isArray(data))throw 0;
    const valid=data.filter(g=>g&&typeof g.importe==="number"&&typeof g.categoria==="string"&&typeof g.fecha==="string")
      .map((g,i)=>{const x=fixGasto({concepto:String(g.concepto||"").slice(0,LIMITS.concepto),importe:g.importe,categoria:g.categoria.trim(),fecha:g.fecha});
        if(typeof g.ts==="number")x.ts=g.ts;if(g.importado===true)x.importado=true;
        if(g.tipo==="ingreso")x.tipo="ingreso";else if(g.extra===true)x.extra=true;
        if(typeof g.fijo==="string"&&g.fijo)x.fijo=g.fijo.slice(0,LIMITS.fijo);
        x.id=g.id?String(g.id):(col?col.doc().id:`g${Date.now()}_${i}`);return x}).filter(g=>validGasto((({id,...d})=>d)(g)));
    // Si alguno se había borrado, deja de estar "borrado"
    {const ids=new Set(valid.map(g=>g.id));try{localStorage.setItem(DEL_KEY,JSON.stringify(loadDeleted().filter(id=>!ids.has(id))))}catch(e){}}
    // Categorías de gasto que vengan en la copia y no existan
    valid.forEach(g=>{if(!isIngreso(g)&&!CATS.some(c=>c[0]===g.categoria)){const used=new Set(CATS.map(c=>c[1]));CATS.push([g.categoria,ALL_COLORS.find(c=>!used.has(c))||"--c8"])}});
    saveCats();buildChips();
    // Se mezcla con lo que hay (no se borra nada); si un gasto ya existe, se sustituye
    const m=new Map(gastos.map(g=>[g.id,g]));valid.forEach(g=>m.set(g.id,g));gastos=[...m.values()];persist();render();
    if(col){const ids=valid.map(g=>g.id);addPending(ids);
      commitOps(valid.map(g=>b=>{const{id,...d}=g;b.set(col.doc(id),d)})).then(()=>dropPending(ids)).catch(()=>toast("No se pudo subir la copia a la nube"))}
    else addPending(valid.map(g=>g.id));
    toast(`Importados ${valid.length} movimientos`)}
  catch(err){toast("Ese archivo no es una copia de Mis Gastos")}
  e.target.value="";
};

/* arranque */
const seedGastos=()=>SEED.map((s,i)=>({id:"oct"+String(i+1).padStart(2,"0"),concepto:s[0],importe:s[1],categoria:s[2],fecha:s[3]||"2026-10-01",importado:true,ts:i+1}));

// Apunta los fijos que tocan (una vez por mes; si se borra uno, no vuelve)
function runFijos(){
  if(!FIJOS.length)return;
  const r=dueFijos(FIJOS,todayISO());if(!r.cambiado)return;
  const del=new Set(loadDeleted());
  const nuevos=r.nuevos.filter(g=>!del.has(g.id)&&!gastos.some(x=>x.id===g.id));
  FIJOS=r.fijos;saveFijos();
  nuevos.forEach(saveOne);
}

const MESES=["E","F","M","A","M","J","J","A","S","O","N","D"];
function renderStats(){
  const yr=statsYear,curYr=new Date().getFullYear(),today=todayISO();
  const years=gastos.map(g=>+(g.fecha||"").slice(0,4)).filter(Boolean);
  $("monthLabel").textContent="Resumen "+yr;
  $("heroLabel").textContent=yr===curYr?"Gastado este año":"Gastado en "+yr;
  $("prev").disabled=!years.some(y=>y<yr);$("next").disabled=yr>=curYr;
  const all=gastos.filter(g=>(g.fecha||"").startsWith(yr+"-"));
  const gs=all.filter(g=>!isIngreso(g)),is=all.filter(isIngreso);
  const tot=sumImp(gs),ing=sumImp(is),norm_=sumImp(gs.filter(g=>!g.extra));
  setTotal(tot);
  setPills(all.length?[[`${eur(tot/Math.max(1,monthsElapsed(yr)))} € al mes`],[plural(gs.length,"gasto","gastos")],...(is.length?[[plural(is.length,"ingreso","ingresos"),"inc"]]:[])]:[["Sin gastos este año"]]);
  $("flowTitle").textContent="Ingresos y gastos del año";
  renderFlow({ingresos:ing,gastos:tot,balance:r2(ing-tot),balanceNormal:r2(ing-norm_),hayExtra:gs.some(g=>g.extra)},"del año");
  $("chartTitle").textContent="Gasto mensual";$("normalLabel").textContent="Año normal";
  renderChart(monthlySeries(gastos,yr),yr===curYr?+today.slice(5,7)-1:-1,MESES);
  $("mesNormal").textContent=eur(norm_)+" €";
  renderCats(gs,false);
  const months=[...new Set(all.map(g=>(g.fecha||"").slice(0,7)))].filter(Boolean).sort().reverse();
  $("listTitle").firstChild.textContent="Por mes";$("seeAll").hidden=true;
  const list=$("list");
  if(!months.length){list.innerHTML=`<div class="empty">Sin gastos este año.</div>`;return}
  list.innerHTML="";
  months.forEach(m=>{
    const mg=all.filter(g=>(g.fecha||"").startsWith(m)&&!isIngreso(g));
    const row=el("button","item");row.type="button";
    const t=el("span","t");t.append(el("div","c",monthTitle(m).replace(/ \d+$/,"")),el("div","m",plural(mg.length,"gasto","gastos")));
    row.append(cicEl("",`var(--accent)`,"calendar"),t,el("span","a num",eur(sumImp(mg))+" €"));
    row.onclick=()=>{statsMode=false;month=m;filter=null;render()};
    list.appendChild(row);
  });
}

function renderSearch(){
  const q=norm(searchQuery);
  $("prev").disabled=true;$("next").disabled=true;
  $("flowCard").hidden=true;$("chartCard").hidden=true;$("seeAll").hidden=true;
  const results=gastos.filter(g=>norm(g.concepto||"").includes(q)||norm(g.categoria||"").includes(q));
  const gs=results.filter(g=>!isIngreso(g));
  $("monthLabel").textContent="Búsqueda";
  $("heroLabel").textContent="Total encontrado";
  setTotal(sumImp(gs));
  setPills([[results.length?plural(results.length,"resultado","resultados"):"Sin resultados"]]);
  renderCats(gs,false);
  $("listTitle").firstChild.textContent=`"${searchQuery}"`;
  renderGroups($("list"),results,()=>el("div","empty",`Sin resultados para "${searchQuery}".`));
}

function setAuthUI(loggedIn){
  $("logoutBtn").style.display=loggedIn?"":"none";
  $("loginBtn").style.display=loggedIn?"none":"";
  $("backupNote").textContent=loggedIn
    ?"Tus gastos se sincronizan con Google. Descarga una copia de vez en cuando."
    :"Tus gastos se guardan solo en este móvil. Descarga una copia de vez en cuando.";
}
/* arranque con auth */
if(auth){
  const provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:"select_account"});
  const signIn=()=>auth.signInWithPopup(provider).catch(err=>{
    if(err.code==="auth/popup-blocked"||err.code==="auth/popup-cancelled")return auth.signInWithRedirect(provider);
    if(err.code!=="auth/popup-closed-by-user")toast(err.message);
  });
  $("logoutBtn").onclick=()=>signIn();
  $("loginBtn").onclick=signIn;
  auth.getRedirectResult().then(r=>{
    if(r&&r.user) return; // onAuthStateChanged disparará solo
  }).catch(err=>{if(err.code&&!err.code.includes("cancelled"))toast(err.message)});
  // Mostrar datos locales al instante, sin esperar auth ni red
  const _saved=load();if(_saved&&_saved.length){gastos=_saved}else{gastos=seedGastos();persist()}
  runFijos();
  render();
  $("loadingScreen").hidden=true;$("status").textContent="";
  setAuthUI(false);
  let unsub=null,listening=false,retryT=null,retryDelay=3000;
  auth.onAuthStateChanged(user=>{
    if(user){
      setAuthUI(true);
      // Si el UID cambió, limpiar datos del usuario anterior
      const prevUid=localStorage.getItem(UID_KEY);
      if(prevUid&&prevUid!==user.uid){
        clearLocalData();savePending([]);gastos=[];FIJOS=[];
        // No llevar las categorías de la otra cuenta: se cargan las de esta (o las de serie)
        CATS=DEFAULT_CATS.map(c=>[...c]);try{localStorage.setItem(CATS_KEY,JSON.stringify(CATS))}catch(e){}
        buildChips();render()}
      localStorage.setItem(UID_KEY,user.uid);
      col=db.collection("users").doc(user.uid).collection("gastos");
      $("status").textContent="";
      listen(user);
      listenCats(user);
    }else{
      setAuthUI(false);
      stopListen();
      stopCats();
      col=null;
      // No borrar datos locales al cerrar sesión — seguir en modo local
    }
  });
  // Reconectar al volver a la app o recuperar conexión
  const revive=()=>{const u=auth.currentUser;if(u&&!listening)listen(u)};
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")revive()});
  window.addEventListener("online",revive);
  function stopListen(){if(unsub){unsub();unsub=null}listening=false;clearTimeout(retryT)}
  function listen(user){
      stopListen();
      listening=true;
      unsub=col.onSnapshot({includeMetadataChanges:true},snap=>{
        retryDelay=3000;
        const deleted=loadDeleted();
        const local=load()||[];
        if(!snap.metadata.fromCache){ // solo con datos reales del servidor
          const serverIds=new Set(snap.docs.map(d=>d.id));
          const toDelete=deleted.filter(id=>serverIds.has(id));
          const pend=new Set(loadPending()||[]);
          // (las que ya se están subiendo no se repiten)
          const up=local.filter(g=>g&&g.id&&pend.has(g.id)&&!deleted.includes(g.id)&&!syncing.has(g.id)&&validGasto((({id,...d})=>d)(g)));
          const del=toDelete.filter(id=>!syncing.has(id));
          const ops=[...del.map(id=>b=>b.delete(col.doc(id))),...up.map(g=>b=>{const{id,...d}=g;b.set(col.doc(id),d)})];
          if(ops.length){const ids=[...del,...up.map(g=>g.id)];ids.forEach(id=>syncing.add(id));
            commitOps(ops).then(()=>dropPending(up.map(g=>g.id))).catch(()=>{}).then(()=>ids.forEach(id=>syncing.delete(id)))}
          // Los borrados que ya no están en el servidor ya no hace falta recordarlos
          try{localStorage.setItem(DEL_KEY,JSON.stringify(deleted.filter(id=>serverIds.has(id))))}catch(e){}
        }
        gastos=snap.docs.map(d=>fixGasto({id:d.id,...d.data()})).filter(g=>!deleted.includes(g.id));
        // Que los pendientes de subir no desaparezcan de la pantalla mientras se suben
        const pend=new Set(loadPending()||[]);
        if(pend.size){const ids=new Set(gastos.map(g=>g.id));local.forEach(g=>{if(g&&pend.has(g.id)&&!ids.has(g.id)&&!deleted.includes(g.id))gastos.push(g)})}
        persist();render();
        $("status").textContent="";
      },err=>{
        // Antes la escucha moría aquí para siempre; ahora se reintenta
        listening=false;unsub=null;
        $("status").textContent="Sin conexión";
        const saved=load();if(saved&&saved.length){gastos=saved;render()}
        const authErr=err&&(err.code==="permission-denied"||err.code==="unauthenticated");
        clearTimeout(retryT);
        retryT=setTimeout(()=>{
          const u=auth.currentUser;if(!u||listening)return;
          (authErr?u.getIdToken(true):Promise.resolve()).then(()=>listen(u)).catch(()=>{listening=false});
        },retryDelay);
        retryDelay=Math.min(retryDelay*2,60000);
      });
  }
}else{
  $("loadingScreen").hidden=true;
  const saved=load();
  if(saved){gastos=saved}else{gastos=seedGastos();persist()}
  $("status").textContent="";
  runFijos();
  render();
}
// Al volver a la app otro día: apunta los fijos que toquen
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){runFijos();render()}});
/* Atajo de iPhone: ?importe=12,50&concepto=Café&cat=Cafés y snacks
   Con importe y categoría válidos guarda directamente; si falta algo, abre el formulario relleno. */
(function fromShortcut(){
  const sc=parseShortcut(location.search,CATS,gastos.filter(g=>!isIngreso(g)));if(!sc)return;
  history.replaceState(null,"",location.pathname); // evita duplicar al recargar
  openSheet(null);
  if(sc.importe>0)$("importe").value=eurInput(sc.importe);
  $("concepto").value=sc.concepto;
  if(sc.cat){selCat=sc.cat;markChips()}
  updateAmount();validate();
  if(sc.importe>0&&sc.importe<LIMITS.importe&&sc.cat&&!sc.confirmar)$("form").requestSubmit();
})();
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(()=>{})}
