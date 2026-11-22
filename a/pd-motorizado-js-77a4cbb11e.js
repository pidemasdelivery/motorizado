(function(){function updateMotoDatePill(){var el=document.getElementById("motoDatePill");if(!el)return;var now=new Date();var text=now.toLocaleDateString("es-PE",{weekday:"short",day:"2-digit",month:"short"}).replace(/\./g,"");el.textContent=text;}updateMotoDatePill();})();

const SUPABASE_URL="https://escxesvzndmyfuteawey.supabase.co";
const SUPABASE_KEY="sb_publishable_pCP210JJcN3NP3a6Y2c--w_c7C0PjaU";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storageKey:'pidemas-motorizado-sesion',persistSession:true,autoRefreshToken:true}});

let session=null,moto=null,orders=[],channel=null,locationTimer=null;
const localPedidoUpdates=new Set();

const $=id=>document.getElementById(id);
function show(el,text){
  

  

  const modal=document.getElementById("pidemasOrderFullModal");
  const modalOpen=!!(modal && modal.offsetParent!==null && getComputedStyle(modal).display!=="none");
  if(modalOpen){
    let box=modal.querySelector("#pidemasModalActionNotice");
    if(!box){
      box=document.createElement("div"); box.id="pidemasModalActionNotice";
      box.setAttribute("role","status"); box.setAttribute("aria-live","polite");
      box.style.cssText="display:block;margin:12px 14px;padding:13px 15px;border:1px solid #d5d5d5;border-radius:14px;background:var(--fr-surface);color:var(--fr-ink);font-size:15px;font-weight:650;line-height:1.45;overflow-wrap:anywhere;";
      const panel=modal.querySelector(".pidemas-order-modal-panel")||modal;
      panel.prepend(box);
    }
    box.textContent=String(text??""); box.style.display="block";
    if(el){el.textContent=String(text??"");el.classList.remove("hidden");}
    return;
  }
  if(el){el.textContent=String(text??"");el.classList.remove("hidden");}
}
function hide(el){el.classList.add("hidden")}
function extractEncomiendaExtra(observaciones){
  const raw=String(observaciones||"");
  const out={dniRemitente:"",dniReceptor:"",ubicacion:"",tipoEnvio:""};
  const m1=raw.match(/DNI\s+de\s+quien\s+env[ií]a\s*:\s*([0-9]+)/i);
  const m2=raw.match(/DNI\s+de\s+quien\s+recibe\s*:\s*([0-9]+)/i);
  const m3=raw.match(/(?:Ubicaci[oó]n\s+de\s+recojo|Ubicaci[oó]n\s+de\s+recogida)\s*:\s*(https?:\/\/[^\s|]+)/i);
  const m4=raw.match(/Tipo\s+de\s+encomienda\s*:\s*([^|·]+)/i);
  if(m1) out.dniRemitente=m1[1];
  if(m2) out.dniReceptor=m2[1];
  if(m3) out.ubicacion=m3[1];
  if(m4) out.tipoEnvio=m4[1].trim().replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  return out;
}


function extractEncomiendaPackages(observaciones){
  const raw=String(observaciones||"");
  const marker="PAQUETES ADICIONALES:";
  const idx=raw.indexOf(marker);
  if(idx<0) return [];
  const tail=raw.slice(idx+marker.length).split(/\s*\|\s*PAGO_ENCOMIENDA_|\s*\|\s*PAGO_ENCOMIENDA_CAJA_CONFIRMADO/i)[0].trim();
  return tail.split(/\s*\|\|\s*/).map(part=>{
    const n=part.match(/Paquete\s+(\d+)/i);
    const a=part.match(/Agencia\s+([^;]+);/i);
    const d=part.match(/destino\s+([^;]+);/i);
    

    

    const t=part.match(/modalidad\s+([^|;]+?)(?=\s*(?:\||$))/i);
    const clean=(v)=>String(v||"").replace(/Servicio marcado como PAGADO[^|;]*/ig,"").replace(/no cobrar monto al cliente/ig,"").trim();
    return {numero:n?.[1]||"",agencia:clean(a?.[1])||"No especificada",destino:clean(d?.[1])||"No especificado",tipoPago:clean(t?.[1])||"No especificada"};
  }).filter(p=>p.numero||p.agencia!=="No especificada"||p.destino!=="No especificado");
}


function cleanEncomiendaObservaciones(observaciones){
  let raw=String(observaciones||"");
  if(!raw) return "";
  

  

  raw=raw
    .replace(/DNI\s+de\s+quien\s+env[ií]a\s*:\s*(?:[0-9]+)?\s*\|?\s*/ig,"")
    .replace(/DNI\s+de\s+quien\s+recibe\s*:\s*(?:[0-9]+)?\s*\|?\s*/ig,"")
    .replace(/Tipo\s+de\s+encomienda\s*:\s*[^|·]*\s*\|?\s*/ig," ")
    .replace(/Ubicaci[oó]n\s+de\s+recojo\s*:\s*https?:\/\/[^\s|]+\s*\|?\s*/ig,"")
    .replace(/Servicio\s+marcado\s+como\s+PAGADO\s*;?\s*/ig,"")
    .replace(/no\s+cobrar\s+monto\s+al\s+cliente\s*;?\s*/ig,"")
    .replace(/\s*\|\s*PAQUETES ADICIONALES:[\s\S]*$/i,"")
    .replace(/PAGO_ENCOMIENDA_CAJA_CONFIRMADO\s*\|?\s*/ig,"")
    .replace(/PAGO_ENCOMIENDA_[A-Z0-9_]+\s*\|?\s*/ig,"");
  return raw
    .split(/\s*\|\s*/)
    .map(part=>part.replace(/[;\s]+$/g,"").trim())
    .filter(Boolean)
    .join(" | ")
    .replace(/^[|;\s]+|[|;\s]+$/g,"")
    .trim();
}

function extractCashPayment(observaciones,total){
  const raw=String(observaciones||"");
  const marker=raw.match(/__PIDEMAS_PAGO_EFECTIVO__\s*(\{[^{}]*\})/);
  if(!marker) return {paid:null,change:null,clean:raw};
  let paid=null, change=null;
  try{
    const x=JSON.parse(marker[1]);
    const p=Number(x.monto??x.montoPago??x.paid);
    const c=Number(x.vuelto??x.change);
    if(Number.isFinite(p)) paid=p;
    if(Number.isFinite(c)) change=c;
    else if(Number.isFinite(p)) change=Math.max(0,p-Number(total||0));
  }catch(e){}
  const clean=raw
    .replace(/\s*[·|]?\s*__PIDEMAS_PAGO_EFECTIVO__\s*\{[^{}]*\}/,"")
    .replace(/\s*[·|]\s*$/,"")
    .trim();
  return {paid,change,clean};
}


function extractRecojoEntregaExtra(observaciones){
  const raw=String(observaciones||"");
  const get=(label)=>{
    const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const match=raw.match(new RegExp("(?:^|[|·]\\s*)"+escaped+"\\s*:\\s*([^|·]*)","i"));
    return match ? match[1].trim() : "";
  };
  const pickup=get("Ubicación de recojo") || get("Ubicacion de recojo");
  const delivery=get("Ubicación de entrega") || get("Ubicacion de entrega");
  const paidText=get("Monto entregado por el cliente");
  const changeText=get("Cambio para el cliente");
  const yapeText=get("Pago por Yape");
  const numeric=(v)=>{const m=String(v||"").match(/[0-9]+(?:[.,][0-9]{1,2})?/);return m?Number(m[0].replace(",",".")):null};
  let clean=raw
    .replace(/Ubicaci[oó]n\s+de\s+(?:recojo|entrega)\s*:\s*[^|·]*\s*[|·]?/ig,"")
    .replace(/(?:Monto\s+entregado\s+por\s+el\s+cliente|Cambio\s+para\s+el\s+cliente|Pago\s+por\s+Yape)\s*:\s*[^|·]*\s*[|·]?/ig,"")
    .replace(/\s*[|·]\s*$/ , "").replace(/^\s*[|·]\s*/,"").trim();
  const paid=numeric(paidText), change=numeric(changeText);
  return {pickup,delivery,paid,change,clean,
    ubicacionRecojo:pickup,ubicacionEntrega:delivery,
    montoEntregado:paidText,cambio:changeText,pagoYape:yapeText};
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}







function cleanDeliveryTariffFromObservaciones(value){
  return String(value ?? "")
    

    .replace(/(?:\s*[|·]\s*)?__PIDEMAS_DELIVERY__\s*\{[^}]*\}/ig, "")
    .replace(/(?:\s*[|·]\s*)?__PIDEMAS_DELIVERY__[^|·]*/ig, "")
    .replace(/(?:\s*[|·]\s*)?(?:TARIFA[_ ]?DELIVERY|DELIVERY[_ ]?TARIFA)\s*:\s*S?\/?\s*[0-9]+(?:[.,][0-9]{1,2})?\s*/ig, "")
    .replace(/\s*[|·]\s*$/g, "")
    .replace(/^\s*[|·]\s*/g, "")
    .trim();
}

function statusText(s){return ({pendiente:"Pendiente",confirmado:"Confirmado",asignado:"Asignado",aceptado:"Aceptado",en_camino:"En camino",en_entrega:"En entrega",entregado:"Entregado",cancelado:"Cancelado"})[s]||s}
function displayPaymentMethod(o){
  

  const obs=String(o?.observaciones||"");
  const m=String(o?.metodo_pago||"").toLowerCase();
  const nombre=m==="efectivo"?"Efectivo":m==="yape"?"Yape":(o?.metodo_pago||"No indicado");
  const cobradoPorMoto=Number(o?.monto_recibido)>0;
  const yaVeniaPagado=!cobradoPorMoto&&(/servicio marcado como PAGADO|PAGO_SERVICIO_CONFIRMADO/i.test(obs)||String(o?.pago_servicio_momento||"").toLowerCase()==="pagado"||o?.pago_acordado==="pagado"||(o?.pago_confirmado===true&&!cobradoPorMoto));
  return yaVeniaPagado?"PAGADO":nombre;
}








let notificationAudioCtx=null;
let notificationAudioReady=false;

async function unlockNotificationAudio(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return false;
    if(!notificationAudioCtx) notificationAudioCtx=new Ctx();
    if(notificationAudioCtx.state==="suspended") await notificationAudioCtx.resume();
    notificationAudioReady=notificationAudioCtx.state==="running";
    return notificationAudioReady;
  }catch(e){return false}
}



document.addEventListener("pointerdown",()=>{unlockNotificationAudio();},{once:false,passive:true});
document.addEventListener("touchstart",()=>{unlockNotificationAudio();},{once:false,passive:true});

function setupLoginOptions(){
  const key="pidemas_moto_remember_email";
  const saved=localStorage.getItem(key);
  if(saved){$("email").value=saved;$("rememberMe").checked=true;}
  $("togglePassword").onclick=()=>{
    const input=$("password");
    const show=input.type==="password";
    input.type=show?"text":"password";
    $("togglePassword").textContent=show?"◉":"◌";
    $("togglePassword").setAttribute("aria-label",show?"Ocultar contraseña":"Mostrar contraseña");
  };
}

async function init(){
  setupLoginOptions();
  $("logout").onclick=async()=>{if(window.__pidemasDeliveryTimer)clearInterval(window.__pidemasDeliveryTimer);hide($("nav"));hide($("logout"));hide($("notifTopButton"));await db.auth.signOut({scope:'local'});location.reload()};
  $("notifTopButton").onclick=()=>openNotificationsModal();
  $("closeNotifications").onclick=()=>closeNotificationsModal(true);
  document.querySelectorAll("[data-notif-filter]").forEach(b=>b.addEventListener("click",()=>{activeNotificationFilter=b.dataset.notifFilter;notificationVisibleLimit=10;document.querySelectorAll("[data-notif-filter]").forEach(x=>x.classList.toggle("active",x===b));loadNotifications();}));
  $("notificationsModal").addEventListener("click",e=>{if(e.target.id==="notificationsModal")closeNotificationsModal(true)});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeNotificationsModal(true)});
  $("loginBtn").onclick=login;
  $("loginBtn").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
  $("password").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
  $("email").addEventListener("keydown",e=>{if(e.key==="Enter")$("password").focus()});
  $("refresh").onclick=loadOrders;
  $("refreshCash").onclick=loadCash;
  $("addExpense").onclick=addExpense;
  $("addCashIn").onclick=addCashIn;
  const openCashReport=$("openCashReport");
  if(openCashReport) openCashReport.onclick=()=>{const panel=$("cashReportPanel"),opening=panel.classList.contains("hidden");panel.classList.toggle("hidden");openCashReport.setAttribute("aria-expanded",String(opening));if(opening){const today=new Date();const local=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);if(!$("cashReportTo").value)$("cashReportTo").value=local;if(!$("cashReportFrom").value)$("cashReportFrom").value=local;}};
  const downloadCashReport=$("downloadCashReport");
  if(downloadCashReport) downloadCashReport.onclick=exportCashExcel;
  $("saveProfile").onclick=saveProfile;
  document.querySelectorAll(".nav button").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  try{
    const {data,error}=await db.auth.getSession();
    if(error) throw error;
    if(data?.session){session=data.session;await enter(session.user.id)}
  }catch(e){show($("loginMsg"),"No se pudo comprobar la sesión. Revisa tu conexión e inténtalo de nuevo.");}
}
async function login(){
  const btn=$("loginBtn");
  hide($("loginMsg"));
  const email=$("email").value.trim();
  const password=$("password").value;
  if(!email||!password){show($("loginMsg"),"Ingresa tu correo y contraseña.");return}
  btn.disabled=true;
  btn.classList.add("loginLoading");
  btn.textContent="Ingresando...";
  try{
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error){show($("loginMsg"),error.message==="Invalid login credentials"?"Correo o contraseña incorrectos. Verifica los datos e inténtalo nuevamente.":"No se pudo iniciar sesión: "+error.message);return}
    if(!data?.session?.user?.id){show($("loginMsg"),"Supabase no devolvió una sesión válida. Vuelve a intentarlo.");return}
    try{
      if($("rememberMe").checked) localStorage.setItem("pidemas_moto_remember_email",email);
      else localStorage.removeItem("pidemas_moto_remember_email");
    }catch(e){}
    session=data.session;
    await enter(session.user.id);
  }catch(e){
    const msg=String(e?.message||e||"");
    show($("loginMsg"),/fetch|network|failed/i.test(msg)?"No se pudo conectar con Supabase. Comprueba tu internet y vuelve a pulsar Ingresar.":"Error al ingresar: "+(msg||"inténtalo nuevamente."));
  }finally{
    btn.disabled=false;
    btn.classList.remove("loginLoading");
    btn.textContent="Ingresar";
  }
}
async function enter(uid){
  let p=null,pe=null;
  try{
    const result=await db.from("perfiles").select("nombre_completo,telefono,rol,activo,foto_url").eq("id",uid).maybeSingle();
    p=result.data;pe=result.error;
  }catch(e){show($("loginMsg"),"La sesión se inició, pero no se pudo consultar el perfil. Revisa la conexión con Supabase.");return}
  if(pe){show($("loginMsg"),"Error al consultar el perfil: "+pe.message);return}
  if(!p||p.rol!=="motorizado"||p.activo!==true){await db.auth.signOut({scope:'local'});session=null;show($("loginMsg"),"La cuenta ingresó, pero no tiene el rol motorizado activo en la tabla perfiles.");return}
  let m=null,me=null;
  try{
    const result=await db.from("motorizados").select("*").eq("usuario_id",uid).eq("activo",true).maybeSingle();
    m=result.data;me=result.error;
  }catch(e){show($("loginMsg"),"No se pudo comprobar el registro del motorizado. Revisa la conexión con Supabase.");return}
  if(me){show($("loginMsg"),"Error al consultar el motorizado: "+me.message);return}
  if(!m){await db.auth.signOut({scope:'local'});session=null;show($("loginMsg"),"La cuenta ingresó, pero no está vinculada a un motorizado activo. Revisa usuario_id y activo en Supabase.");return}
  moto=m;
  window.__pidemasProfileRecord=p;
  $("welcome").textContent="Hola, "+(p.nombre_completo||m.nombre_completo||"Motorizado");
  populateProfile(p,m);
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("nav").classList.remove("hidden");
  $("nav").style.display="flex";
  $("nav").style.display="flex";
  $("nav").style.position="fixed";
  $("nav").style.left="0";
  $("nav").style.right="0";
  $("nav").style.bottom="0";
  $("nav").style.zIndex="9999";
  $("logout").classList.remove("hidden");
  $("notifTopButton").classList.remove("hidden");
  await loadOrders();await loadNotifications();await loadCash();if(typeof window.__pdMotoLoadSalary==="function")await window.__pdMotoLoadSalary();startRealtime();startGPS();
  

  

  setTimeout(()=>{if(moto)loadCash();},900);
}
function setProfilePhoto(url){
  const box=$("profilePhotoPreview");
  if(!box)return;
  box.innerHTML=url?`<img src="${esc(url)}" alt="Foto de perfil del motorizado">`:'<i class="ti ti-users" aria-hidden="true"></i>';
}
function populateProfile(p={},m={}){
  $("profileName").value=p.nombre_completo||m.nombre_completo||"";
  $("profilePhone").value=p.telefono||m.telefono||"";
  $("profileDocument").value=m.documento||"";
  $("profilePlate").value=m.placa||"";
  if($("profileWhatsAppGroup")) $("profileWhatsAppGroup").value=m.enlace_grupo_whatsapp||"";
  $("profileEmail").value=session?.user?.email||"";
  if($("profileDisplayName")) $("profileDisplayName").textContent=p.nombre_completo||m.nombre_completo||"Mi perfil";
  if($("profileDisplayRole")) $("profileDisplayRole").textContent="Motorizado · Pidemás";
  const hoursEl=$("motoProfileHours"), daysEl=$("motoProfileDays");
  const hours=String(m.horario_trabajo||"").trim();
  if(hoursEl) hoursEl.textContent=hours||"Pendiente de configurar por administración";
  const dayNames={lunes:"Lunes",martes:"Martes",miercoles:"Miércoles",miércoles:"Miércoles",jueves:"Jueves",viernes:"Viernes",sabado:"Sábado",sábado:"Sábado",domingo:"Domingo"};
  let days=Array.isArray(m.dias_laborables)?m.dias_laborables:[];
  if(typeof m.dias_laborables==="string") { try { const parsed=JSON.parse(m.dias_laborables); days=Array.isArray(parsed)?parsed:m.dias_laborables.split(/[,;|]/); } catch(e) { days=m.dias_laborables.split(/[,;|]/); } }
  const formatted=days.map(d=>dayNames[String(d).trim().toLowerCase()]||String(d).trim()).filter(Boolean);
  if(daysEl) daysEl.textContent=formatted.length?formatted.join(" · "):"Pendiente de configurar por administración";
  setProfilePhoto(p.foto_url||"");
}



async function saveProfile(){
  if(!session?.user?.id||!moto){show($("profileMsg"),"Tu sesión no está lista. Vuelve a ingresar.");return;}
  const btn=$("saveProfile");
  const nombre=$("profileName").value.trim();
  const telefono=$("profilePhone").value.trim();
  const documento=$("profileDocument").value.trim();
  const placa=$("profilePlate").value.trim().toUpperCase();
  const enlaceGrupoWhatsApp=$("profileWhatsAppGroup")?.value.trim()||"";
  if(enlaceGrupoWhatsApp && !/^https:\/\/chat\.whatsapp\.com\//i.test(enlaceGrupoWhatsApp)){show($("profileMsg"),"El enlace debe comenzar con https://chat.whatsapp.com/");return;}
  const photoInput=$("profilePhotoFile");
  const file=photoInput?.files?.[0]||null;
  if(!nombre){show($("profileMsg"),"Escribe tus nombres completos.");$("profileName").focus();return;}
  if(file&&(!/^image\/(jpeg|png|webp)$/i.test(file.type)||file.size>5*1024*1024)){
    show($("profileMsg"),"La foto debe ser JPG, PNG o WEBP y pesar máximo 5 MB.");return;
  }
  btn.disabled=true;btn.textContent="Guardando...";hide($("profileMsg"));
  try{
    let fotoUrl=window.__pidemasProfileRecord?.foto_url||null;
    if(file){
      const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[file.type]||"jpg";
      const path=`${session.user.id}/perfil-${Date.now()}.${ext}`;
      const bucket=db.storage.from("fotos-motorizados");
      

      

      const uploaded=await bucket.upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
      if(uploaded.error){
        const detail=String(uploaded.error.message||uploaded.error);
        if(/row-level security|policy|unauthorized|permission denied/i.test(detail)){
          throw new Error("Supabase bloqueó la subida de la foto por permisos del Storage (bucket fotos-motorizados). La ruta ya se envía dentro de la carpeta de tu usuario. Revisa que exista una política INSERT para usuarios autenticados que permita la carpeta auth.uid(). Detalle: "+detail);
        }
        throw new Error("No se pudo subir la foto: "+detail);
      }
      const publicResult=bucket.getPublicUrl(path);
      fotoUrl=publicResult?.data?.publicUrl||null;
      if(!fotoUrl)throw new Error("No se pudo obtener la dirección de la foto.");
    }
    const profileUpdate={nombre_completo:nombre,telefono:telefono||null};
    if(fotoUrl)profileUpdate.foto_url=fotoUrl;

    

    

    const pr=await db.from("perfiles")
      .update(profileUpdate)
      .eq("id",session.user.id)
      .select("id,nombre_completo,telefono,rol,activo,foto_url")
      .maybeSingle();
    if(pr.error)throw new Error("No se pudieron guardar los datos del perfil: "+pr.error.message);
    if(!pr.data)throw new Error("Supabase no actualizó tu perfil. Ejecuta el SQL de permisos para perfiles que te envío junto al archivo y vuelve a intentar.");
    const savedProfile=pr.data;

    const motoUpdate={nombre_completo:nombre,telefono:telefono||""};
    

    motoUpdate.documento=documento||null;
    motoUpdate.placa=placa||null;
    motoUpdate.enlace_grupo_whatsapp=enlaceGrupoWhatsApp||null;
    const mr=await db.from("motorizados").update(motoUpdate).eq("id",moto.id).eq("usuario_id",session.user.id);
    if(mr.error)throw new Error("Los datos del perfil se guardaron, pero no se pudieron actualizar los datos del motorizado: "+mr.error.message);
    moto={...moto,...motoUpdate};
    

    window.__pidemasProfileRecord={...(window.__pidemasProfileRecord||{}),...savedProfile};
    $("welcome").textContent="Hola, "+(savedProfile.nombre_completo||nombre);
    if($("profileDisplayName")) $("profileDisplayName").textContent=savedProfile.nombre_completo||nombre;
    $("profilePhone").value=savedProfile.telefono||"";
    if(savedProfile.foto_url)setProfilePhoto(savedProfile.foto_url);
    show($("profileMsg"),"✓ Perfil actualizado correctamente.");
    if(photoInput)photoInput.value="";
  }catch(e){
    show($("profileMsg"),String(e?.message||"No se pudo guardar el perfil. Inténtalo nuevamente."));
  }finally{
    btn.disabled=false;btn.textContent="Guardar cambios";
  }
}

async function loadOrders(){
  if(!moto)return;

  

  

  let data=null;
  let lastError=null;
  for(let intento=0; intento<3; intento++){
    try{
      const res=await db.from("pedidos")
        .select("*")
        .eq("motorizado_id",moto.id)
        .order("creado_en",{ascending:false});
      if(res.error){
        lastError=res.error;
      }else{
        data=res.data||[];
        lastError=null;
        break;
      }
    }catch(e){
      lastError=e;
    }
    if(intento<2) await new Promise(r=>setTimeout(r,700*(intento+1)));
  }

  if(lastError){
    const detail=String(lastError.message||lastError||"Error de conexión");
    

    

    if(!window.__motoOrdersConnectionErrorShown){
      show($("appMsg"),"No se pudo conectar con Supabase para actualizar los pedidos. Revisa tu conexión y pulsa «Actualizar pedidos». Tus pedidos anteriores se mantienen en pantalla. Detalle: "+detail);
      window.__motoOrdersConnectionErrorShown=true;
    }
    return;
  }

  

  

  window.__motoOrdersConnectionErrorShown=false;
  if(($("appMsg").textContent||"").includes("No se pudo conectar con Supabase para actualizar los pedidos")){
    hide($("appMsg"));
  }

  orders=data;
   
  try{const C=window.__pdNegCache=window.__pdNegCache||{};const nids=[...new Set(orders.map(o=>o.negocio_id).filter(Boolean))];const viejos=nids.filter(i=>!C[i]||Date.now()-C[i].__t>300000);if(viejos.length){const r=await db.from("negocios").select("*").in("id",viejos);if(!r.error)(r.data||[]).forEach(n=>{n.__t=Date.now();C[n.id]=n})}orders.forEach(o=>{const n=C[o.negocio_id];if(!n)return;if(!o.nombre_negocio)o.nombre_negocio=n.nombre||"";if(!o.direccion_negocio)o.direccion_negocio=n.direccion||"";if(!o.telefono_negocio)o.telefono_negocio=n.whatsapp||n.telefono||"";if((o.latitud_recojo==null||o.latitud_recojo==="")&&n.latitud!=null&&n.longitud!=null){o.latitud_recojo=n.latitud;o.longitud_recojo=n.longitud}if(!o.negocio_maps_url)o.negocio_maps_url=n.google_maps_url||""})}catch(e){console.warn("No se pudo leer el negocio:",e)}
  const ids=orders.map(o=>o.id).filter(Boolean);
  if(ids.length){
    try{
      const det=await db.from("detalle_pedidos").select("*").in("pedido_id",ids);
      if(!det.error){
        const byPedido={};
        (det.data||[]).forEach(d=>{(byPedido[d.pedido_id] ||= []).push(d);});
        orders.forEach(o=>{o.detalle_pedidos=byPedido[o.id]||[];});
      }else{
        orders.forEach(o=>{o.detalle_pedidos=[];});
      }
    }catch(e){
      

      orders.forEach(o=>{o.detalle_pedidos=o.detalle_pedidos||[];});
    }
  }

  

  

  

  const guideCacheHasFile=!!(window.__guideFileCache && window.__guideFileCache.size>0);
  const guideUploadInProgress=!!(window.__guideSavingIds && window.__guideSavingIds.size>0);
  const preserveGuideForm=guideCacheHasFile || guideUploadInProgress;
  if(!preserveGuideForm) hide($("appMsg"));

  

  const activeInput=document.activeElement;
  const editingCash=!!(activeInput && activeInput.id && activeInput.id.startsWith("cash_"));
  if(!editingCash && !preserveGuideForm){
    renderOrders();
  }else{
    

    window.__pidemasCashRenderPending=true;
  }
  startDeliveryTimerTicker();
}
function contactPhone(raw){
  const digits=String(raw||"").replace(/\D/g,"");
  if(!digits) return "";
  if(digits.startsWith("51")) return digits;
  if(digits.length===9) return "51"+digits;
  return digits;
}
function contactButtons(raw){
  const phone=contactPhone(raw);
  if(!phone) return "";
  return `<div class="contactActions">
    <a href="tel:+${phone}">Llamar</a>
    <a href="https://wa.me/${phone}" target="_blank" rel="noopener">WhatsApp</a>
  </div>`;
}


function formatElapsed(ms){
  const total=Math.max(0,Math.floor(ms/1000));
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const sec=total%60;
  return (h>0?String(h).padStart(2,"0")+":":"")
    +String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
}

function updateDeliveryTimers(){
  document.querySelectorAll("[data-delivery-timer]").forEach(el=>{
    const start=Date.parse(el.dataset.start||"");
    const end=el.dataset.end ? Date.parse(el.dataset.end) : Date.now();
    if(!Number.isFinite(start)) return;
    const finish=Number.isFinite(end) ? end : Date.now();
    el.textContent=formatElapsed(Math.max(0,finish-start));
  });
}

function startDeliveryTimerTicker(){
  if(window.__pidemasDeliveryTimer) clearInterval(window.__pidemasDeliveryTimer);
  updateDeliveryTimers();
  window.__pidemasDeliveryTimer=setInterval(updateDeliveryTimers,1000);
}





document.addEventListener("input",function(e){
  const el=e.target;
  if(el && el.id && el.id.startsWith("cash_")){
    const id=el.id.slice(5);
    rememberCashDraft(id,el.value);
    const order=orders.find(x=>String(x.id)===String(id));
    const out=document.getElementById("change_"+id);
    if(order && out){
      const received=Number(el.value||0);
      const total=Number(order.total||0);
      out.textContent="Vuelto: S/ "+Math.max(0,received-total).toFixed(2);
    }
  }
},true);





document.addEventListener("focusout",function(e){
  const el=e.target;
  if(!el || !el.id || !el.id.startsWith("cash_"))return;
  const id=el.id.slice(5);
  rememberCashDraft(id,el.value);
  setTimeout(()=>{
    const active=document.activeElement;
    if(active && active.id && active.id.startsWith("cash_"))return;
    if(window.__pidemasCashRenderPending){
      window.__pidemasCashRenderPending=false;
      renderOrders();
    }
  },700);
},true);





window.__pidemasCashDrafts = window.__pidemasCashDrafts || {};

function rememberCashDraft(id,value){
  id=String(id||"");
  if(!id) return;
  

  

  window.__pidemasCashDrafts[id]=String(value??"");
}

function captureCashDrafts(){
  document.querySelectorAll('input[id^="cash_"]').forEach(input=>{
    const id=input.id.slice(5);
    if(id) rememberCashDraft(id,input.value);
  });
}


const PIDEMAS_YAPE_QR="a/yape-qr-d656e70b4f.png";
window.showYapeQr=function(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  const old=document.getElementById("yapeQrOverlay"); if(old)old.remove();
  const overlay=document.createElement("div"); overlay.id="yapeQrOverlay"; overlay.className="yapeQrOverlay";
  overlay.innerHTML=`<div class="yapeQrModal" role="dialog" aria-modal="true">
    <h2 style="margin:0 0 6px">Cobro por Yape</h2>
    <div class="muted">Muestra este QR al cliente para que realice el pago.</div>
    <div style="font-size:24px;font-weight:900;margin-top:12px">S/ ${Number(o.total||0).toFixed(2)}</div>
    <img src="${PIDEMAS_YAPE_QR}" alt="QR de Yape de Grupo Pidemás EIRL">
    <div class="notice">Después de recibir el pago, guarda la captura en tu celular. Al cierre de caja podrás revisar tus pagos realizados por Yape.</div>
    <button class="yapeQrClose" onclick="document.getElementById('yapeQrOverlay')?.remove()">Cerrar</button>
  </div>`;
  overlay.addEventListener("click",e=>{if(e.target===overlay)overlay.remove()});
  document.body.appendChild(overlay);
};
window.uploadYapeProof=async function(id){
  const o=orders.find(x=>x.id===id); if(!o)return;
  const input=document.getElementById("yapeProof_"+id); const file=input?.files?.[0];
  if(!file)return show($("appMsg"),"Toma o selecciona una foto del comprobante de Yape.");
  if(!file.type.startsWith("image/"))return show($("appMsg"),"El archivo debe ser una imagen.");
  if(file.size>8*1024*1024)return show($("appMsg"),"La foto no debe superar 8 MB.");
  const btn=document.querySelector(`button[onclick="uploadYapeProof('${id}')"]`);
  if(btn){btn.disabled=true;btn.textContent="Subiendo comprobante..."}
  try{
    const ext=(file.type.split("/")[1]||"jpg").replace("jpeg","jpg");
    const path=`comprobantes_yape/pedido_${id}_${Date.now()}.${ext}`;
    const storage=db.storage.from("comprobantes_pagos");
    const up=await storage.upload(path,file,{upsert:false,contentType:file.type,cacheControl:"3600"});
    if(up.error)throw new Error("No se pudo subir la foto a Supabase Storage (bucket comprobantes_pagos): "+up.error.message);
    const publicUrl=storage.getPublicUrl(path)?.data?.publicUrl;
    if(!publicUrl)throw new Error("No se obtuvo el enlace de la foto.");
    const marker=`[COMPROBANTE_YAPE: ${publicUrl}]`;
    const oldObs=String(o.observaciones||"").trim();
    const cleanObs=oldObs.replace(/\s*\[COMPROBANTE_YAPE:\s*https?:\/\/[^\]]+\]/ig,"").trim();
    const newObs=(cleanObs?cleanObs+"\n":"")+marker;
    const {data,error}=await db.from("pedidos").update({observaciones:newObs})
      .eq("id",id).eq("motorizado_id",moto.id).select("id,observaciones").maybeSingle();
    if(error)throw new Error("La foto subió, pero no se pudo vincular al pedido: "+error.message);
    if(!data)throw new Error("No se confirmó el guardado del comprobante en este pedido.");
    o.observaciones=data.observaciones;
    show($("appMsg"),"Foto enviada. El pedido queda pendiente de confirmación del administrador.");
    await loadOrders();
  }catch(e){
    show($("appMsg"),""+(e?.message||String(e)));
    if(btn){btn.disabled=false;btn.textContent="Subir foto y enviar a administración"}
  }
};

function ensureOrderModal(){
  let modal=document.getElementById('pidemasOrderFullModal');
  if(modal) return modal;
  modal=document.createElement('div');
  modal.id='pidemasOrderFullModal';
  modal.innerHTML=`<div class="pidemas-order-modal-backdrop" onclick="closeOrderFullModal(event)"></div><section class="pidemas-order-modal-panel" role="dialog" aria-modal="true" aria-label="Pedido completo"><header class="pidemas-order-modal-header"><div class="pidemas-modal-header-left"><strong>Pedido completo</strong><span class="pidemas-modal-order-number"></span></div><div class="pidemas-modal-header-right"><button type="button" class="pidemas-order-modal-x" onclick="closeOrderFullModal()" aria-label="Cerrar">×</button></div></header><div class="pidemas-order-modal-content" id="pidemasOrderFullModalContent"></div></section>`;
  document.body.appendChild(modal);
  return modal;
}
function closeOrderFullModal(event){
  if(event && event.target && !event.target.classList.contains('pidemas-order-modal-backdrop')) return;
  const modal=document.getElementById('pidemasOrderFullModal');
  if(modal) modal.classList.remove('is-open');
  document.body.classList.remove('pidemas-order-modal-lock');
}
function populateFullOrderModal(card, modal){
  if(!card || !modal) return;
  const source=card.querySelector('.orderDetails');
  if(!source) return;
  const id=String(card.dataset.orderId||'');
  const order=orders.find(o=>String(o.id)===id);
  const assigned=String(order?.estado||'').toLowerCase().trim()==='asignado';
  const panel=modal.querySelector('.pidemas-order-modal-panel');
  const content=modal.querySelector('#pidemasOrderFullModalContent');
  if(!panel || !content) return;

  

  panel.querySelector('.pidemas-order-modal-actions')?.remove();
  const fixedActions=document.createElement('div');
  fixedActions.className='pidemas-order-modal-actions';
  const temp=document.createElement('div');
  temp.innerHTML=source.innerHTML;

  const workflowPattern=/acceptOrder|startOrder|markInDelivery|deliverOrder|confirmEncomiendaAgency|showYapeQr|confirmPayment|registerPayment|uploadYapeProof|payEncomiendaFromCaja/i;
  const workflowLabel=/^(aceptar pedido|iniciar pedido|en camino|en entrega|confirmar pago|confirmar cobro|pedido entregado|finalizar pedido|pedido finalizado|en agencia|confirmar en agencia|registrar pago|subir foto y enviar a administración|mostrar qr de yape)$/i;

  if(assigned){
    

    content.innerHTML=`<div class="pd-accept-gate"><div class="pd-accept-gate-mark">PEDIDO ASIGNADO</div><h3>Confirma que aceptarás este pedido</h3><p>Para proteger los datos del cliente, la información de contacto, direcciones, ubicaciones y detalles del servicio se mostrará después de que presiones <strong>Aceptar pedido</strong>.</p><p class="pd-accept-gate-note">Revisa el tipo de servicio y el número del pedido en la cabecera antes de continuar.</p></div>`;
    let accept=[...temp.querySelectorAll('button')].find(btn=>workflowPattern.test(btn.getAttribute('onclick')||'') || /^aceptar pedido$/i.test((btn.textContent||'').trim()));
    if(!accept){
      accept=document.createElement('button');
      accept.type='button';
      accept.className='btn pd-accept-gate-button';
      accept.setAttribute('onclick',`acceptOrder('${id}')`);
    }
    accept.textContent='Aceptar pedido';
    accept.classList.add('pd-accept-gate-button');
    fixedActions.appendChild(accept);
  }else{
    content.innerHTML=temp.innerHTML;
    

    

    const sequenceButtons=[...content.querySelectorAll('button')].filter(btn=>{
      const action=String(btn.getAttribute('onclick')||'');
      const label=(btn.textContent||'').trim().replace(/^[✓✔\s]+/,'').replace(/\s+/g,' ').toLowerCase();
      return workflowPattern.test(action) || workflowLabel.test(label);
    });
    sequenceButtons.forEach(btn=>{
      

      btn.classList.add('pidemas-sequence-button');
      fixedActions.appendChild(btn);
    });
  }

  if(fixedActions.children.length) panel.appendChild(fixedActions);
  const serviceLabel=card.querySelector('.orderServiceTypeValue')?.textContent?.trim() || 'Pedido de tienda / restaurante';
  const title=modal.querySelector('.pidemas-order-modal-header strong');
  if(title){
    title.innerHTML='<span class="pidemas-modal-service-label">Tipo de servicio</span><span class="pidemas-modal-service-value"></span>';
    title.querySelector('.pidemas-modal-service-value').textContent=serviceLabel;
  }
  const orderNumber=source.querySelector('.orderHead .big, .orderHead h3, .orderHead h4');
  const numberNode=modal.querySelector('.pidemas-modal-order-number');
  if(numberNode) numberNode.textContent=orderNumber ? orderNumber.textContent.trim() : '';
  modal.querySelector('.pidemas-modal-status')?.remove();
}
function toggleOrderDetails(id, open){
  const card=[...document.querySelectorAll('#orders .order-collapsible')].find(el=>String(el.dataset.orderId)===String(id));
  if(!card)return;
  const details=card.querySelector('.orderDetails');
  if(!details)return;
  const modal=ensureOrderModal();
  modal.dataset.orderId=String(id);
  populateFullOrderModal(card,modal);
  modal.classList.add('is-open');
  document.body.classList.add('pidemas-order-modal-lock');
  const closeBtn=modal.querySelector('.pidemas-order-modal-x');
  if(closeBtn) closeBtn.focus();
}

function renderOrders(){
  

  

  const expandedOrderIds = new Set(
    [...document.querySelectorAll('#orders .order-collapsible')]
      .filter(card => {
        const details = card.querySelector('.orderDetails');
        return details && !details.classList.contains('hidden');
      })
      .map(card => String(card.dataset.orderId))
  );
  

  

  

  captureCashDrafts();
  const unsavedCash={...window.__pidemasCashDrafts};

  const active=orders.filter(o=>!["entregado","cancelado"].includes(o.estado)).length;
  {const _el=$("activeCount");if(_el)_el.textContent=active;}
  const pending=orders.filter(o=>["pendiente","asignado"].includes(String(o.estado||"").toLowerCase())).length;
  {const _el=$("pendingCount");if(_el)_el.textContent=pending;}
  const todayKey=new Date().toLocaleDateString("en-CA");
  const deliveredToday=orders.filter(o=>String(o.estado||"").toLowerCase()==="entregado" && o.entregado_en && new Date(o.entregado_en).toLocaleDateString("en-CA")===todayKey).length;
  {const _el=$("deliveredCount");if(_el)_el.textContent=deliveredToday;}
  try{
    let _best=null;
    orders.forEach(o=>{
      if(String(o.estado||"").toLowerCase()!=="entregado"||!o.entregado_en||!o.en_camino_en)return;
      if(new Date(o.entregado_en).toLocaleDateString("en-CA")!==todayKey)return;
      const _ms=Date.parse(o.entregado_en)-Date.parse(o.en_camino_en);
      if(Number.isFinite(_ms)&&_ms>=0&&(_best===null||_ms<_best))_best=_ms;
    });
    window.__pdBestTime=_best===null?"—":formatElapsed(_best);
  }catch(e){window.__pdBestTime="—";}
  

  

  

  const list=$("orders");list.innerHTML="";
  if(!orders.length){list.innerHTML='<div class="notice">No tienes pedidos asignados.</div>';return}

  orders.forEach(o=>{
    const bloqueado = o.estado === "cancelado";
    const details=(o.detalle_pedidos||[]).map(d=>`${esc(d.nombre_producto)} × ${d.cantidad||1}`).join("<br>")||"Sin detalle";
    let buttons="";

    if(String(o.estado||"").toLowerCase().trim()==="asignado") buttons=`
      <button class="btn moto-accept-attention" onclick="acceptOrder('${o.id}')">Aceptar pedido</button>
    `;

    const servicioNormalizado=String(o.tipo_servicio||"").toLowerCase().replace(/[á\s_-]+/g, "");
    const enviadoPorAdmin = ["recojoyentrega", "recojoentrega", "compra"].includes(servicioNormalizado);
    if(o.estado==="aceptado") buttons=(o.tipo_servicio==="encomienda" || enviadoPorAdmin)
      ? `<button class="btn" onclick="startOrder('${o.id}')">${o.tipo_servicio==="encomienda" ? "Iniciar pedido" : "En camino"}</button>`
      : `<button class="btn" onclick="startOrder('${o.id}')">En camino</button>`;

    if(o.estado==="en_camino"){
      if(o.tipo_servicio==="encomienda"){
        const guideReady=!!o.guia_url && (
          String(o.clave_guia||"").trim()==="SIN_CLAVE" ||
          !!String(o.clave_guia||"").trim()
        );
        

        const inAgency = o.pedido_en_agencia===true ||
          String(o.pedido_en_agencia||"").toLowerCase()==="true";
        const finalReady=guideReady && inAgency;

        

        

        buttons = !inAgency
          ? `<button class="btn" onclick="confirmEncomiendaAgency('${o.id}')">En agencia</button>`
          : (finalReady
              ? `<button class="btn" onclick="deliverOrder('${o.id}')">Finalizar pedido</button>`
              : "");
      }else{
        

        

        buttons = `<button class="btn" onclick="markInDelivery('${o.id}')">En entrega</button>`;
      }
    }

    if(o.estado==="en_entrega"){
      if(o.tipo_servicio==="encomienda"){
        buttons = `<button class="btn" onclick="deliverOrder('${o.id}')">Finalizar pedido</button>`;
      }else{
        const method=String(o.metodo_pago||"").toLowerCase();
        const paid=o.pago_confirmado===true;
        if(paid){
          buttons = `
            <div class="notice" style="margin:0 0 10px">✓ Pago confirmado${method==="yape"?" por administración":""}.</div>
            <button class="btn" onclick="deliverOrder('${o.id}')">Pedido entregado</button>
          `;
        }else if(method==="yape"){
          buttons = `
            <div class="notice" style="margin:0 0 10px">Muestra el QR al cliente. Cuando verifiques que pagó, presiona Confirmar pago y guarda la captura en tu celular para el cierre de caja.</div>
            <button class="btn" onclick="showYapeQr('${o.id}')">▦ Mostrar QR de Yape</button>
            <button class="btn" onclick="confirmPayment('${o.id}')">Confirmar pago</button>
          `;
        }else{
          const cashField=method==="efectivo"?`
            <div class="notice" style="margin:0 0 10px"><b>Total del pedido:</b> S/ ${Number(o.total||0).toFixed(2)}</div>
            <div class="field" style="margin-bottom:10px">
              <label>Monto cobrado</label>
              <input id="cash_${o.id}" type="number" min="${Number(o.total||0).toFixed(2)}" step="0.01" inputmode="decimal" placeholder="¿Con cuánto te paga?">
            </div>`:"";
          buttons = `${cashField}
            <button class="btn" onclick="confirmPayment('${o.id}')">Confirmar pago</button>`;
        }
      }
    }


    if(o.estado==="entregado"){
      buttons = `<button class="btn" disabled>✓ Pedido finalizado</button>`;
    }
    if(bloqueado) buttons="";

    let encomiendaBox="";
    let encPkgsHtml="",encFrom=null,encTo=null;
    if(o.tipo_servicio==="encomienda"){
      const extra=extractEncomiendaExtra(o.observaciones);
      const dniRemitente=String(o.dni_remitente||extra.dniRemitente||"").trim();
      const dniReceptor=String(o.dni_receptor||extra.dniReceptor||"").trim();
      const pickupUrl=(o.latitud_recojo!=null&&o.longitud_recojo!=null)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.latitud_recojo+","+o.longitud_recojo)}`
        : (extra.ubicacion || (o.direccion_recojo ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.direccion_recojo)}` : ""));
      const deliveryLat=o.latitud_entrega;
      const deliveryLng=o.longitud_entrega;
      const deliveryUrl=(deliveryLat!=null&&deliveryLng!=null)
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryLat+","+deliveryLng)}`
        : (o.destino_final ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.destino_final)}` : (o.direccion_entrega ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.direccion_entrega)}` : ""));
      const pagoAgencia=o.tipo_pago_encomienda==="pago_en_agencia";
      const guideOk=!!o.guia_url;
      const keyOk=!!String(o.clave_guia||"").trim();
      const sinClave=String(o.clave_guia||"").trim()==="SIN_CLAVE";
      const amountOk=Number(o.monto_pagado_agencia||0)>0;
      const cajaPago=(o.observaciones||"").includes("PAGO_ENCOMIENDA_CAJA_CONFIRMADO");
      const agenciaConfirmada=o.pedido_en_agencia===true;

      encFrom={label:"Recojo · Quien envía",name:o.nombre_remitente||o.nombre_cliente||"",extra:dniRemitente?"DNI "+dniRemitente:"",addr:o.direccion_recojo||"",phone:o.telefono_remitente||o.telefono_cliente||"",map:pickupUrl};
      encTo={label:"Destino · Quien recibe",name:o.nombre_receptor||"",extra:dniReceptor?"DNI "+dniReceptor:"",addr:[o.agencia_destino,o.destino_final||o.direccion_entrega].filter(Boolean).join(" → "),phone:o.telefono_receptor||"",map:""};
      const pkgRows=[{numero:1,agencia:o.agencia_destino||"—",destino:o.destino_final||o.direccion_entrega||"—",tipo:extra.tipoEnvio||"",pago:pagoAgencia?"Pago en agencia":"Pago a destino"}]
        .concat((typeof extractEncomiendaPackages==="function"?extractEncomiendaPackages(o.observaciones):[]).map(p=>({numero:p.numero,agencia:p.agencia||"—",destino:p.destino||"—",tipo:"",pago:p.tipoPago==="pago_en_agencia"?"Pago en agencia":"Pago a destino"})));
      const encObs=cleanEncomiendaObservaciones(o.observaciones);
      encPkgsHtml=`<div class="pdMBlock"><div class="pdMKicker">Paquetes</div>${pkgRows.map(p=>`<div class="pdMPkg"><span class="pdMPkgNum">${esc(p.numero)}</span><span class="pdMPkgInfo"><span class="pdMPkgMain">${esc(p.agencia)} → ${esc(p.destino)}</span>${p.tipo?`<span class="pdMPkgSub">${esc(p.tipo)}</span>`:""}</span><span class="pdMPkgPay">${esc(p.pago)}</span></div>`).join("")}${encObs?`<div class="pdMNotes">${esc(encObs)}</div>`:""}</div>`;
      encomiendaBox=`
      ${agenciaConfirmada?`
        <section class="recojoInfoCard">
          <h4>Gestión de agencia y guía</h4>
          ${pagoAgencia?`
            <div class="encActions">
              <label><b>Total pagado</b></label>
              <input id="encCaja_${o.id}" type="number" min="0.01" step="0.01" placeholder="Total pagado por el envío" value="${o.monto_pagado_agencia||""}" ${cajaPago||bloqueado?"disabled":""}>
              <button class="btn ${cajaPago?"caja-pago-completado":""}" type="button" onclick="payEncomiendaFromCaja('${o.id}')" ${cajaPago||bloqueado?"disabled":""}>${cajaPago?"✓ Pago registrado en caja":"Pagar encomienda con caja"}</button>
              ${cajaPago?`<div class="encCajaWarn">Pago realizado desde tu caja y registrado como <b>Pago de encomienda</b>.</div>`:""}
            </div>`:""}
          ${pagoAgencia && !cajaPago ? `
            <div class="encActions encGuideWaiting" style="padding:16px;border:1px solid var(--fr-line);border-radius:14px;background:var(--fr-surface);color:var(--fr-muted);line-height:1.5">
              Después de registrar el pago de la encomienda con caja, aparecerá aquí la opción para subir la foto de la guía y guardar la clave.
            </div>` : `
          <div class="encActions">
            <label><b>Foto de la guía</b></label>
            ${guideOk ? `<div class="encGuideState ok">✓ Foto de la guía ya subida</div>` : `<input id="guia_${o.id}" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" ${guideOk?"disabled":""} onchange="window.cacheGuideFile(this,'${o.id}')">`}
            <input id="clave_${o.id}" type="text" maxlength="120" placeholder="Clave de la guía" value="${sinClave?"":esc(o.clave_guia||"")}" ${keyOk?"disabled":""} ${sinClave?"disabled":""}>
            <div style="display:flex;align-items:center;gap:10px;margin:10px 0 8px;font-weight:700">
              <input id="sinClave_${o.id}" type="checkbox" ${sinClave?"checked":""} ${keyOk?"disabled":""} onchange="toggleSinClave('${o.id}')" style="width:20px;height:20px;accent-color:var(--fr-ink)">
              <label for="sinClave_${o.id}">Sin clave</label>
            </div>
            <button class="btn saveGuideBtn ${guideOk && (String(o.clave_guia||"").trim() || String(o.observaciones||"").includes("SIN_CLAVE_GUIA_CONFIRMADO")) ? "guia-clave-completada" : ""}" type="button" data-pedido-id="${o.id}" data-guide-save="1" ${guideOk && (String(o.clave_guia||"").trim() || String(o.observaciones||"").includes("SIN_CLAVE_GUIA_CONFIRMADO")) ? "disabled" : ""} onclick="window.saveEncomiendaGuide('${o.id}', this)">${guideOk && (String(o.clave_guia||"").trim() || String(o.observaciones||"").includes("SIN_CLAVE_GUIA_CONFIRMADO")) ? "✓ Guía y clave enviada con éxito" : "Guardar guía y clave"}</button>
          </div>`}
        </section>
      `:""}`;
    }

    const isRecojoEntrega=["recojo_entrega","recojo y entrega","recojo-entrega"].includes(String(o.tipo_servicio||"").toLowerCase().trim());
    const recojoExtra=isRecojoEntrega?extractRecojoEntregaExtra(o.observaciones):{};
    const recojoBox=isRecojoEntrega?`
      <section class="recojoInfoCard">
        <h4>Información de quien envía</h4>
        <div class="line"><b>Nombre:</b> ${esc(o.nombre_remitente||o.nombre_cliente||"—")}</div>
        <div class="line"><b>Número:</b> ${esc(o.telefono_remitente||o.telefono_cliente||"—")}</div>
        ${contactButtons(o.telefono_remitente||o.telefono_cliente)}
        <div class="line"><b>Dirección:</b> ${esc(o.direccion_recojo||"—")}</div>
        <div class="line"><b>Ubicación:</b></div>
        <div class="recojoLocationRow">
          ${recojoExtra.ubicacionRecojo?`<a class="locationBtn" href="${esc(recojoExtra.ubicacionRecojo)}" target="_blank" rel="noopener">Abrir ubicación</a>`:`<span class="locationBtn locationBtnDisabled" aria-disabled="true">Ubicación no indicada</span>`}
        </div>
      </section>
      <section class="recojoInfoCard">
        <h4>Información de quien recibe</h4>
        <div class="line"><b>Nombre:</b> ${esc(o.nombre_receptor||"—")}</div>
        <div class="line"><b>Número:</b> ${esc(o.telefono_receptor||"—")}</div>
        ${contactButtons(o.telefono_receptor)}
        <div class="line"><b>Dirección:</b> ${esc(o.direccion_entrega||"—")}</div>
        <div class="line"><b>Ubicación:</b></div>
        <div class="recojoLocationRow">
          ${recojoExtra.ubicacionEntrega?`<a class="locationBtn" href="${esc(recojoExtra.ubicacionEntrega)}" target="_blank" rel="noopener">Abrir ubicación</a>`:`<span class="locationBtn locationBtnDisabled" aria-disabled="true">Ubicación no indicada</span>`}
        </div>
      </section>
      <section class="recojoInfoCard recojoPaymentCard">
        <h4>Información de pago del servicio</h4>
        <div class="line"><b>Monto a cobrar:</b> <span class="moneyInline">S/ ${Number(o.total||0).toFixed(2)}</span></div>
        <div class="line"><b>${String(displayPaymentMethod(o)||'').trim().toUpperCase() === 'PAGADO' ? 'Servicio:' : 'Método de pago del servicio:'}</b> ${esc(displayPaymentMethod(o))}</div>
      </section>
    `:"";

    const isCompra=String(o.tipo_servicio||"").toLowerCase().trim()==="compra";
    const compraRawObs=String(o.observaciones||"").replace(/__PIDEMAS_[A-Z_]+__\s*\{[^{}]*\}/g,"").replace(/\[COMPROBANTE_YAPE:[^\]]*\]/gi,"").replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/g,"");
    const compraGet=(...labels)=>{
      for(const label of labels){
        const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const m=compraRawObs.match(new RegExp("(?:^|[|]\\s*)"+escaped+"\\s*:\\s*([^|]*)","i"));
        if(m&&m[1].trim()) return m[1].trim();
      }
      return "";
    };
    const compraLugar=String(o.direccion_recojo||compraGet("Lugar de compra","¿De dónde desea la compra?")||"").trim();
    const compraDetalle=compraGet("Compra solicitada","¿Qué desea que compremos?");
    const compraComprobante=compraGet("Comprobante")||"No especificado";
    const compraDocumento=compraGet("DNI/RUC");
    const compraUbicacion=compraGet("Ubicación","Ubicación del cliente");
    

    

    const compraObs=compraRawObs.split("|").flatMap(x=>x.split("·")).map(x=>x.trim()).filter(x=>x && !/^(Ubicación(?: del cliente)?|Compra solicitada|Comprobante|DNI\/RUC|Lugar de compra|¿De dónde desea la compra\?|¿Qué desea que compremos\?)\s*:/i.test(x)).join(" · ");
    const compraUrl=/^https?:\/\//i.test(compraUbicacion)?compraUbicacion:(compraUbicacion?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(compraUbicacion)}`:"");
    const compraBox=isCompra?`
      <section class="recojoInfoCard compraMotoCard">
        <h4>Información del cliente</h4>
        <div class="line"><b>Nombre:</b> ${esc(o.nombre_cliente||o.nombre_remitente||"—")}</div>
        <div class="line"><b>Número:</b> ${esc(o.telefono_cliente||o.telefono_remitente||"—")}</div>
        ${contactButtons(o.telefono_cliente||o.telefono_remitente)}
        <div class="line"><b>Dirección:</b> ${esc(o.direccion_entrega||"—")}</div>
        <div class="line"><b>Ubicación:</b> ${compraUrl?`<br><a class="locationBtn" href="${esc(compraUrl)}" target="_blank" rel="noopener">Abrir ubicación en Maps</a>`:"No indicada"}</div>
      </section>
      <section class="recojoInfoCard compraMotoCard">
        <h4>Información de la compra</h4>
        <div class="line"><b>¿De dónde desea la compra?</b> ${esc(compraLugar||"—")}</div>
        <div class="line"><b>¿Qué desea que compremos?</b> ${esc(compraDetalle||"—").replace(/\n/g,"<br>")}</div>
        ${compraObs?`<div class="line"><b>Observaciones:</b> ${esc(compraObs)}</div>`:""}
      </section>
      <section class="recojoInfoCard compraMotoCard">
        <h4>Información del comprobante</h4>
        <div class="line"><b>Boleta o factura:</b> ${esc(compraComprobante)}</div>
        <div class="line"><b>DNI / RUC:</b> ${esc(compraDocumento||"—")}</div>
      </section>
      <section class="recojoInfoCard recojoPaymentCard compraMotoCard">
        <h4>Información de pago del servicio</h4>
        <div class="line"><b>Monto a cobrar:</b> <span class="moneyInline">S/ ${Number(o.total||0).toFixed(2)}</span></div>
        <div class="line"><b>${String(displayPaymentMethod(o)||'').trim().toUpperCase() === 'PAGADO' ? 'Servicio:' : 'Método de pago del servicio:'}</b> ${esc(displayPaymentMethod(o))}</div>
      </section>`:"";

    const tipoServicioLabel=(()=>{
      const tipo=String(o.tipo_servicio||"").toLowerCase().trim().replace(/[_-]+/g," ");
      if(tipo==="compra") return "Compra";
      if(tipo==="encomienda") return "Encomienda";
      if(tipo==="recojo entrega"||tipo==="recojo y entrega") return "Recojo y entrega";
      if(tipo.includes("restaurante")||tipo==="tienda"||tipo==="pedido") return "Pedido de tienda / restaurante";
      return tipo ? tipo.replace(/\b\w/g,c=>c.toUpperCase()) : "Pedido de tienda / restaurante";
    })();

    const pedidoEstaAbierto = expandedOrderIds.has(String(o.id));
    const guiaYClaveListas = String(o.tipo_servicio||"").toLowerCase().trim()==="encomienda" && !!String(o.guia_url||"").trim() && !!String(o.clave_guia||"").trim() && (o.pedido_en_agencia===true || String(o.pedido_en_agencia||"").toLowerCase()==="true");
    const estadoVisiblePedido = guiaYClaveListas ? "Guía y clave enviada" : (o.pedido_en_agencia ? "En agencia" : statusText(o.estado));
    

    const pdMIdx=(()=>{const st=String(o.estado||"").toLowerCase().trim();if(st==="cancelado")return -1;if(st==="entregado")return 5;if(st==="en_entrega"||st==="confirmando_pago")return 4;if(st==="en_camino")return 3;if(st==="aceptado")return 2;if(st==="asignado")return 1;return 0;})();
    const pdMSteps=["Pedido recibido","Motorizado asignado","Pedido aceptado","En camino","En entrega","Entregado"];
    const pdMBars=pdMSteps.map((_,n)=>`<span class="${pdMIdx>=0&&n<=pdMIdx?"on":""}"></span>`).join("");
    const pdMDate=(()=>{const d=new Date(o.creado_en||"");return isNaN(d)?"":d.toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"});})();
    const pdMLink=v=>{const t=String(v||"").trim();if(!t)return "";return /^https?:\/\//i.test(t)?t:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(t);};
    const pdMLatLng=(a,b)=>(a!=null&&b!=null&&a!==""&&b!=="")?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(a+","+b):"";
    const pdMChips=(phone,map)=>{const ph=contactPhone(phone);let h="";if(ph)h+=`<a class="pdMChip" href="tel:+${ph}" onclick="event.stopPropagation()">Llamar</a><a class="pdMChip" href="https://wa.me/${ph}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>`;if(map)h+=`<a class="pdMChip" href="${esc(map)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ubicación</a>`;return h?`<div class="pdMChips">${h}</div>`:"";};
    const pdMTipo=String(o.tipo_servicio||"").toLowerCase().trim();
    let pdMFrom,pdMTo,pdMMiddle="",pdMIsTienda=false;
    if(pdMTipo==="encomienda"&&encFrom){pdMFrom=encFrom;pdMTo=encTo;pdMMiddle=encPkgsHtml;}
    else if(isRecojoEntrega){
      pdMFrom={label:"Recojo · Quien envía",name:o.nombre_remitente||o.nombre_cliente||"",addr:o.direccion_recojo||"",phone:o.telefono_remitente||o.telefono_cliente||"",map:pdMLink(recojoExtra.ubicacionRecojo)};
      pdMTo={label:"Entrega · Quien recibe",name:o.nombre_receptor||"",addr:o.direccion_entrega||"",phone:o.telefono_receptor||"",map:pdMLink(recojoExtra.ubicacionEntrega)};
      const n=cleanDeliveryTariffFromObservaciones(recojoExtra.clean).replace(/servicio marcado como PAGADO[^|·]*/ig,"").replace(/^[\s|·]+|[\s|·]+$/g,"");
      if(n)pdMMiddle=`<div class="pdMBlock"><div class="pdMKicker">Notas del servicio</div><div class="pdMNotes">${esc(n)}</div></div>`;
    }else if(isCompra){
      pdMFrom={label:"Compra en",name:compraLugar||"Lugar no indicado",addr:"",phone:"",map:""};
      pdMTo={label:"Entrega · Cliente",name:o.nombre_cliente||o.nombre_remitente||"",addr:o.direccion_entrega||"",phone:o.telefono_cliente||o.telefono_remitente||"",map:compraUrl};
      pdMMiddle=`<div class="pdMBlock"><div class="pdMKicker">Qué comprar</div><div class="pdMNotes">${esc(compraDetalle||"—").replace(/\n/g,"<br>")}</div>${compraObs?`<div class="pdMLine"><span>Observaciones</span><span class="pdMRight">${esc(compraObs)}</span></div>`:""}<div class="pdMLine"><span>Comprobante</span><strong>${esc(compraComprobante)}</strong></div>${compraDocumento?`<div class="pdMLine"><span>DNI / RUC</span><strong>${esc(compraDocumento)}</strong></div>`:""}</div>`;
    }else{
      pdMIsTienda=true;
      const ex=extractRecojoEntregaExtra(o.observaciones);
      pdMFrom={label:"Recojo · Negocio",name:o.nombre_negocio||o.negocio_nombre||o.restaurante_nombre||o.nombre_restaurante||"Negocio",addr:o.direccion_negocio||o.direccion_recojo||"",phone:o.telefono_negocio||"",map:pdMLink(ex.pickup)||pdMLatLng(o.latitud_recojo,o.longitud_recojo)||pdMLink(o.negocio_maps_url)};
      pdMTo={label:"Entrega · Cliente",name:o.nombre_cliente||"",addr:o.direccion_entrega||"No indicada",ref:o.referencia_entrega||"",phone:o.telefono_cliente||"",map:pdMLatLng(o.latitud_entrega,o.longitud_entrega)||pdMLink(ex.delivery)};
      const prods=(o.detalle_pedidos||[]);
      if(prods.length)pdMMiddle+=`<div class="pdMBlock"><div class="pdMKicker">Productos</div>${prods.map(d=>{const q=Number(d.cantidad||1),u=Number(d.precio_unitario??d.precio),sub=Number(d.subtotal??(Number.isFinite(u)?u*q:NaN));return `<div class="pdMLine"><span>${q} × ${esc(d.nombre_producto||"Producto")}</span><span>${Number.isFinite(sub)?"S/ "+sub.toFixed(2):""}</span></div>`;}).join("")}</div>`;
      const cashInfo=extractCashPayment(o.observaciones,o.total);
      const vis=cleanDeliveryTariffFromObservaciones(extractRecojoEntregaExtra(cashInfo.clean).clean).replace(/(?:^|\s*[|·]\s*)Pago Yape:[^|·]*/gi,m=>o.pago_acordado?"":m).replace(/^\s*[|·]\s*/,"").trim().replace(/__PIDEMAS_[A-Z0-9_]+__/g,"").replace(/[\[{]\s*"[\s\S]*[}\]]/g,"").replace(/^[\s|·,]+|[\s|·,]+$/g,"").trim();
      if(vis)pdMMiddle+=`<div class="pdMBlock"><div class="pdMKicker">Observaciones</div><div class="pdMNotes">${esc(vis)}</div></div>`;
    }
    const pdMStop=(st,last)=>`<div class="pdMStop${last?" is-last":""}"><span class="pdMDot"></span><div class="pdMStopBody"><div class="pdMKicker">${esc(st.label)}</div><div class="pdMName">${esc(st.name||"No registrado")}</div>${st.extra?`<div class="pdMRef">${esc(st.extra)}</div>`:""}${st.addr?`<div class="pdMAddr">${esc(st.addr)}</div>`:""}${st.ref?`<div class="pdMRef">Referencia: ${esc(st.ref)}</div>`:""}${pdMChips(st.phone,st.map)}</div></div>`;
    const pdMMethod=displayPaymentMethod(o);
    const pdMTotal=Number(o.total||0);
    let pdMPayExtra="";
    if(String(o.metodo_pago||"").toLowerCase()==="efectivo"&&o.pago_confirmado!==true&&(!String(o.tipo_servicio||"").toLowerCase().includes("compra")||Number(o.subtotal)>0)){const ci=extractCashPayment(o.observaciones,o.total);const ex2=extractRecojoEntregaExtra(o.observaciones);const paid=ci.paid??ex2.paid;if(paid!=null){const ch=ci.change??ex2.change??Math.max(0,Number(paid)-pdMTotal);pdMPayExtra=""; }}
    const pdMAlFinal=String(o.tipo_servicio||"").toLowerCase().includes("encomienda")&&String(o.pago_servicio_momento||"").toLowerCase()==="al_final"&&o.pago_confirmado!==true;
    const pdMPayState=pdMAlFinal?"Paga después de recibir la guía":String(pdMMethod).toUpperCase()==="PAGADO"?"Pagado":o.pago_confirmado===true?(Number(o.monto_recibido)>0?"Cobrado":"Pago confirmado"):"Por cobrar";
    const pdMPay=`<div class="pdMPay"><div class="pdMLine"><span>Método de pago</span><strong>${esc(String(pdMMethod||"").charAt(0).toUpperCase()+String(pdMMethod||"").slice(1).toLowerCase())}</strong></div><div class="pdMLine"><span>Estado del pago</span><span class="pdMPill">${pdMPayState}</span></div>${pdMPayExtra}<div class="pdMTotal"><span>${pdMAlFinal?"Monto (no lo cobras tú)":pdMPayState==="Cobrado"?"Total cobrado":pdMPayState==="Pagado"?"Monto (ya pagado)":pdMIsTienda?"Total":"Monto a cobrar"}</span><strong>S/ ${pdMTotal.toFixed(2)}</strong></div></div>`;
    const pdMBand=`<div class="pdMBand"><div class="pdMBandTop"><span class="pdMBandKicker">${esc(tipoServicioLabel)}</span><span class="pdMBandPill">${esc(estadoVisiblePedido)}</span></div><div class="pdMCode">#${esc(o.id.slice(0,8).toUpperCase())}</div>${pdMDate?`<div class="pdMMeta">${esc(pdMDate)}</div>`:""}<div class="pdMBars">${pdMBars}</div><div class="pdMMeta">${pdMIdx<0?"Pedido cancelado":"Paso "+(pdMIdx+1)+" de 6 · "+pdMSteps[pdMIdx]}</div></div>`;
    const pdMDetail=`<div class="pdMStops">${pdMStop(pdMFrom,false)}${pdMStop(pdMTo,true)}</div>${pdMMiddle}${pdMPay}${pdMTipo==="encomienda"?encomiendaBox:""}`;
    const pdMAssigned=String(o.estado||"").toLowerCase().trim()==="asignado";
    const pdMList=`<span class="orderServiceTypeValue" hidden style="display:none">${esc(tipoServicioLabel)}</span><div class="pdMList"><div class="pdMListTop"><span class="pdMListKicker">${esc(tipoServicioLabel)}</span><span class="pdMListPill${pdMAssigned?" is-new":""}${pdMIdx<0?" is-off":""}">${pdMAssigned?"Nuevo · Por aceptar":esc(estadoVisiblePedido)}</span></div><div class="pdMListCode">#${esc(o.id.slice(0,8).toUpperCase())}</div>${pdMDate?`<div class="pdMListMeta">${esc(pdMDate)}</div>`:""}<div class="pdMBars pdMListBars">${pdMBars}</div>${pdMAssigned?`<div class="pdMListGate">Acepta el pedido para ver direcciones y contactos.</div>`:`<div class="pdMListRoute"><span class="pdMListDot"></span><span class="pdMListPlace">${esc(pdMFrom.name||"—")}</span><span class="pdMListArrow" aria-hidden="true">→</span><span class="pdMListDot is-end"></span><span class="pdMListPlace">${esc(pdMTo.name||"—")}</span></div>`}<div class="pdMListFoot"><span>${esc(pdMMethod)}</span><strong>S/ ${pdMTotal.toFixed(2)}</strong></div></div>`;
    list.insertAdjacentHTML("beforeend",`
      <article class="order order-collapsible order-card-tappable${String(o.estado||"").toLowerCase().trim()==="asignado"?" order-assigned-attention":""}" data-order-id="${esc(o.id)}" role="button" tabindex="0" aria-label="Abrir pedido ${esc(o.id.slice(0,8).toUpperCase())}" onclick="toggleOrderDetails('${esc(o.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleOrderDetails('${esc(o.id)}')}">
        ${pdMList}
        <div class="orderDetails${pedidoEstaAbierto ? '' : ' hidden'}" id="orderDetails_${esc(o.id)}">
        ${pdMBand}
        <div class="orderHead"><div class="big">Pedido #${esc(o.id.slice(0,8).toUpperCase())}</div><span class="status">${esc(estadoVisiblePedido)}</span></div>
        ${o.en_camino_en ? `<div class="deliveryTimeBox">
          <div class="deliveryTimeLabel"><i class="ti ti-gauge" aria-hidden="true"></i> Tiempo del pedido</div>
          <div class="deliveryTimeValue" data-delivery-timer data-start="${esc(o.en_camino_en)}" ${o.entregado_en?`data-end="${esc(o.entregado_en)}"`:''}>00:00</div>
          <div class="deliveryTimeState">${o.entregado_en ? 'Tiempo total' : 'En curso'}</div>
        </div>` : ''}
        ${bloqueado?`<div class="notice"><b>Pedido cancelado por administración.</b><br>Este pedido ya no permite continuar con las acciones normales.</div>`:""}
        ${pdMDetail}
        ${o.tipo_servicio==="encomienda" ? "" : `<div class="grid" style="margin-top:14px">${buttons}</div>`}
        ${o.tipo_servicio==="encomienda" && buttons ? `<div class="grid" style="margin-top:14px">${buttons}</div>` : ""}
        </div>
      </article>`); 
  });

  orders.forEach(o=>{
    const input=document.getElementById("guia_"+o.id);
    if(input && o.guia_url) input.disabled=true;
    window.updateGuideSaveButton?.(o.id);

    

    const cashInput=document.getElementById("cash_"+o.id);
    if(cashInput && Object.prototype.hasOwnProperty.call(unsavedCash,String(o.id))){
      cashInput.value=unsavedCash[String(o.id)];
      if(cashInput.value!=="" || unsavedCash[String(o.id)]===""){
        cashInput.dispatchEvent(new Event("input",{bubbles:false}));
      }
    }
  });

  

  

  const openOrderModal=document.getElementById("pidemasOrderFullModal");
  if(openOrderModal?.classList.contains("is-open") && openOrderModal.dataset.orderId){
    const currentId=String(openOrderModal.dataset.orderId);
    const currentCard=[...document.querySelectorAll('#orders .order-collapsible')]
      .find(el=>String(el.dataset.orderId)===currentId);
    const currentDetails=currentCard?.querySelector('.orderDetails');
    const modalContent=openOrderModal.querySelector('#pidemasOrderFullModalContent');
    if(currentDetails && modalContent){
      

      populateFullOrderModal(currentCard,openOrderModal);
    }
  }
}


async function changeState(id,newState,extra={}){
  try{
    const {data,error}=await db.from("pedidos").update({estado:newState,...extra})
      .eq("id",id).eq("motorizado_id",moto.id).select("id,estado").maybeSingle();
    if(error){localPedidoUpdates.delete(id);show($("appMsg"),"No se pudo actualizar el pedido: "+(error.message||error));return false}
    if(!data){localPedidoUpdates.delete(id);show($("appMsg"),"No se actualizó el pedido. Verifica que siga asignado a tu cuenta y vuelve a intentarlo.");return false}
    const local=orders.find(x=>String(x.id)===String(id));
    if(local){local.estado=newState;Object.assign(local,extra)}
    hide($("appMsg"));
    await loadOrders();
    try{await loadReport()}catch(reportError){console.warn("No se pudo actualizar el reporte del pedido:",reportError)}
    return true;
  }catch(err){
    localPedidoUpdates.delete(id);
    show($("appMsg"),"Error al actualizar el pedido: "+(err?.message||String(err)));
    return false;
  }
}
window.acceptOrder=async id=>{
  const o=orders.find(x=>String(x.id)===String(id));
  if(!o || o.estado!=="asignado")return;
  const btns=[...document.querySelectorAll(`button[onclick*="acceptOrder('${id}')"]`)];
  btns.forEach(b=>b.disabled=true);
  const ok=await changeState(id,"aceptado",{aceptado_en:new Date().toISOString()});
  if(!ok)btns.forEach(b=>b.disabled=false);
};
window.rejectOrder=async id=>{
  const o=orders.find(x=>String(x.id)===String(id));
  if(!o || o.estado!=="asignado")return;
  if(!(await pdConfirmar("¿Rechazar este pedido? Se devolverá a Administración para que pueda asignarlo a otro motorizado.")))return;
  const btns=[...document.querySelectorAll(`button[onclick*="rejectOrder('${id}')"]`)];
  btns.forEach(b=>{b.disabled=true;b.textContent="Rechazando...";});
  localPedidoUpdates.add(id);
  const {data,error}=await db.from("pedidos")
    .update({estado:"pendiente",motorizado_id:null})
    .eq("id",id).eq("motorizado_id",moto.id).eq("estado","asignado")
    .select("id,estado").maybeSingle();
  if(error || !data){
    localPedidoUpdates.delete(id);
    show($("appMsg"),"No se pudo rechazar el pedido. Puede que Administración lo haya actualizado. "+(error?.message||""));
    btns.forEach(b=>{b.disabled=false;b.textContent="Rechazar pedido";});
    return;
  }
  window.__pidemasCashDrafts && delete window.__pidemasCashDrafts[id];
  show($("appMsg"),"Pedido rechazado y devuelto a Administración para una nueva asignación.");
  await loadOrders();
};
window.startOrder=async id=>{
  const o=orders.find(x=>String(x.id)===String(id));
  if(!o)return;
  const servicioNormalizado=String(o.tipo_servicio||"").toLowerCase().replace(/[á\s_-]+/g, "");
  const enviadoPorAdmin=["recojoyentrega", "recojoentrega", "compra"].includes(servicioNormalizado);
  /* si Administración ya asignó el pedido, el negocio ya lo confirmó: no se espera la marca de «listo» */
  

  await changeState(id,"en_camino",{en_camino_en:new Date().toISOString()});
};
window.markInDelivery=async id=>{
  const o=orders.find(x=>String(x.id)===String(id));
  if(!o || o.estado!=="en_camino")return;
  await changeState(id,"en_entrega",{en_entrega_en:new Date().toISOString()});
};
window.continueEncomienda=async id=>{await changeState(id,"en_entrega",{en_entrega_en:new Date().toISOString()})};
function showPaymentValidation(message){
  

  const orderModal=document.getElementById("pidemasOrderFullModal");
  if(orderModal && orderModal.offsetParent!==null && getComputedStyle(orderModal).display!=="none"){
    show(null,message);
    return;
  }
  

  let notice=document.getElementById("pidemasPaymentValidationNotice");
  if(!notice){
    notice=document.createElement("div");
    notice.id="pidemasPaymentValidationNotice";
    notice.setAttribute("role","alert");
    notice.setAttribute("aria-live","assertive");
    notice.style.cssText="position:fixed;left:20px;right:20px;top:calc(env(safe-area-inset-top, 0px) + 18px);z-index:2147483647;display:block;margin:0 auto;max-width:620px;padding:18px 18px 16px;border:1px solid #d7d7d7;border-radius:20px;background:#fff;color:var(--fr-ink);font-size:16px;font-weight:700;line-height:1.45;box-shadow:0 12px 36px rgba(0,0,0,.28);box-sizing:border-box;text-align:left;";
    document.body.appendChild(notice);
  }
  notice.innerHTML="";
  const title=document.createElement("div");
  title.textContent=/registrado correctamente/i.test(String(message||"")) ? "Pago registrado correctamente" : "No se puede confirmar el pago";
  title.style.cssText="font-size:18px;font-weight:800;margin-bottom:8px;color:var(--fr-ink)";
  const body=document.createElement("div");
  body.textContent=message;
  body.style.cssText="font-size:15px;font-weight:500;color:var(--fr-ink)";
  const close=document.createElement("button");
  close.type="button";close.textContent="Entendido";
  close.style.cssText="display:block;margin:14px 0 0 auto;padding:10px 18px;border:0;border-radius:12px;background:var(--fr-orange);color:#fff;font-size:15px;font-weight:700";
  close.onclick=()=>{notice.style.display="none"};
  notice.append(title,body,close);
  notice.style.display="block";
  clearTimeout(window.__pidemasPaymentNoticeTimer);
  window.__pidemasPaymentNoticeTimer=setTimeout(()=>{if(notice?.isConnected)notice.style.display="none";},9000);
}

window.confirmPayment=async id=>{
  let paymentValidationFailed=false;
  const pressed=[...document.querySelectorAll(`button[onclick*="confirmPayment('${id}')"]`)];
  if(pressed.some(b=>b.dataset.processing==="1"))return;
  pressed.forEach(b=>{b.dataset.processing="1";b.disabled=true;b.textContent="Procesando pago...";});
  try{
  const o=orders.find(x=>String(x.id)===String(id));if(!o)return;
  if(o.estado!=="en_entrega"){
    show($("appMsg"),"Primero confirma el botón En entrega y luego registra el pago.");
    return;
  }
  const method=String(o.metodo_pago||"").toLowerCase();
  

  

  

  let amount=Number(o.total||0);
  if(method==="efectivo"){
    

    

    const cashFields=[...document.querySelectorAll(`[id="cash_${id}"]`)];
    const visibleCashField=cashFields.find(el=>el.getClientRects().length>0 && getComputedStyle(el).visibility!=="hidden" && getComputedStyle(el).display!=="none");
    const draftMap=window.__pidemasCashDrafts||{};
    const typedValue=visibleCashField ? visibleCashField.value : (Object.prototype.hasOwnProperty.call(draftMap,String(id)) ? draftMap[String(id)] : "");
    amount=Number(String(typedValue).trim().replace(",","."));
    const total=Number(o.total||0);
    if(!Number.isFinite(amount)||amount<=0){
      paymentValidationFailed=true;
      showPaymentValidation("Ingresa el monto cobrado.");
      return;
    }
    if(amount + 0.0001 < total){
      paymentValidationFailed=true;
      showPaymentValidation("No puedes cobrar menos del total del pedido (S/ "+total.toFixed(2)+"). Puedes ingresar el mismo monto o uno mayor.");
      return;
    }
  }
  const validationNotice=document.getElementById("pidemasPaymentValidationNotice");
  if(validationNotice) validationNotice.style.display="none";
  let vueltoDe='';
  {const _t=Number(o.total||0),_v=method==="efectivo"&&_t>0?Math.round((amount-_t)*100)/100:0;
   const _compra=String(o.tipo_servicio||"").toLowerCase().includes("compra")&&!(Number(o.subtotal)>0);
   if(_v>0.004&&!_compra&&typeof window.pdElegirVuelto==="function"){vueltoDe=await window.pdElegirVuelto(_v,_t,amount);if(!vueltoDe)return;}}
  

  

  const cashInput=[...document.querySelectorAll(`[id="cash_${id}"]`)].find(el=>el.getClientRects().length>0) || document.getElementById("cash_"+id);
  if(cashInput){
    window.__pidemasCashDrafts=window.__pidemasCashDrafts||{};
    window.__pidemasCashDrafts[id]=cashInput.value;
    cashInput.blur();
  }
  window.__pidemasCashRenderPending=false;
  const ok=await changeState(id,"en_entrega",{pago_confirmado:true,monto_recibido:amount});
  if(!ok){
    

    await loadOrders();
    return;
  }
  const totalPedidoParaVuelto=Number(o.total||0);
  

  

  const vuelto=method==="efectivo" ? (totalPedidoParaVuelto>0 ? Math.max(0,amount-totalPedidoParaVuelto) : 0) : 0;
  const {error:ce}=await db.from("cobros").upsert({
    pedido_id:id,motorizado_id:moto.id,monto:Number(o.total||0),metodo_pago:method,confirmado:true,confirmado_en:new Date().toISOString()
  },{onConflict:"pedido_id"});
  if(ce){show($("appMsg"),"El pago se confirmó pero no se pudo registrar el cobro: "+ce.message);return}
  if(method==="efectivo"){
    const totalPedido=Number(o.total||0);
    

    const {data:existingMovement,error:checkMovementError}=await db.from("movimientos_caja")
      .select("id").eq("motorizado_id",moto.id).eq("pedido_id",id).eq("tipo","ingreso").not("descripcion","ilike","INGRESO MANUAL%").limit(1);
    if(checkMovementError){
      show($("appMsg"),"Pago confirmado, pero no se pudo verificar el movimiento de caja: "+checkMovementError.message);
      await loadOrders();await loadCash();return;
    }
    

    

    

    

    

    

    const pagoCliente=Number(amount.toFixed(2));
    const compraSinMonto=String(o.tipo_servicio||"").toLowerCase().includes("compra")&&!(Number(o.subtotal)>0);
    const efectivoRecibido=totalPedido>0&&!compraSinMonto?Number(Math.min(pagoCliente,totalPedido).toFixed(2)):pagoCliente;
    const descripcionCaja=compraSinMonto
      ? "Cobro de compra · servicio S/ "+totalPedido.toFixed(2)+" · cliente pagó S/ "+pagoCliente.toFixed(2)+" (incluye la compra)"
      : "Cobro de pedido · total S/ "+totalPedido.toFixed(2)+" · cliente pagó con S/ "+pagoCliente.toFixed(2)+" · vuelto entregado S/ "+vuelto.toFixed(2)+(vuelto>0.004&&vueltoDe?(vueltoDe==="caja"?" · VUELTO DE CAJA":" · VUELTO CON DINERO PROPIO"):"");
    if((existingMovement||[]).length){
      const {error:me}=await db.from("movimientos_caja")
        .update({monto:efectivoRecibido,descripcion:descripcionCaja})
        .eq("id",existingMovement[0].id).eq("motorizado_id",moto.id).eq("pedido_id",id);
      if(me){show($("appMsg"),"Pago confirmado, pero no se pudo actualizar el movimiento de caja: "+me.message);await loadOrders();await loadCash();return;}
    }else{
      const {error:me}=await db.from("movimientos_caja").insert({motorizado_id:moto.id,pedido_id:id,tipo:"ingreso",monto:efectivoRecibido,descripcion:descripcionCaja});
      if(me){show($("appMsg"),"Pago confirmado, pero no se pudo registrar el movimiento de caja: "+me.message);await loadOrders();await loadCash();return;}
    }
  }
  await loadOrders();await loadCash();
  

  if(typeof renderOrders==="function") renderOrders();
  }catch(err){
    show($("appMsg"),"No se pudo confirmar el pago: "+(err?.message||String(err)));
  }finally{
    pressed.forEach(b=>{delete b.dataset.processing;});
    

    const current=orders.find(x=>String(x.id)===String(id));
    if(paymentValidationFailed){
      pressed.forEach(b=>{b.disabled=false;b.textContent="Confirmar pago";});
    } else if(current && current.estado==="en_entrega" && current.pago_confirmado!==true){
      setTimeout(()=>{try{renderOrders()}catch(e){console.error(e)}},0);
    }
  }
};
window.deliverOrder=async id=>{
  const buttons=[...document.querySelectorAll(`button[onclick*="deliverOrder('${id}')"]`)];
  if(buttons.some(b=>b.dataset.processing==="1"))return;
  buttons.forEach(b=>{b.dataset.processing="1";b.disabled=true;b.textContent="Finalizando...";});
  try{
    const ok=await changeState(id,"entregado",{entregado_en:new Date().toISOString()});
    if(!ok){buttons.forEach(b=>{delete b.dataset.processing;b.disabled=false;b.textContent="Pedido entregado";});return;}
    const local=orders.find(x=>String(x.id)===String(id));
    if(local)local.estado="entregado";
    await loadOrders();
    startDeliveryTimerTicker();
    show($("appMsg"),"✓ Pedido finalizado correctamente.");
  }catch(err){
    show($("appMsg"),"No se pudo finalizar el pedido: "+(err?.message||String(err)));
    buttons.forEach(b=>{delete b.dataset.processing;b.disabled=false;b.textContent="Pedido entregado";});
  }
};




window.payEncomiendaFromCaja=async function(id){
  const btn=document.querySelector(`button[onclick*="payEncomiendaFromCaja('${id}')"]`);
  if(btn){if(btn.disabled)return;btn.disabled=true;}
  try{
    const o=orders.find(x=>String(x.id)===String(id));
    if(!o){showPaymentValidation("No se encontró esta encomienda en la lista actual. Pulsa Actualizar pedidos y vuelve a intentarlo.");return;}
    if(!moto || !moto.id){showPaymentValidation("No se pudo identificar tu cuenta de motorizado. Cierra sesión e ingresa nuevamente.");return;}
    

    

    const inputs=[...document.querySelectorAll('[id^="encCaja_"]')].filter(el=>el.id==="encCaja_"+String(id));
    const input=inputs.find(el=>String(el.value||"").trim()!=="" && el.getClientRects().length)
      || inputs.find(el=>el.getClientRects().length)
      || inputs.find(el=>String(el.value||"").trim()!=="")
      || inputs[0];
    if(!input){showPaymentValidation("No se encontró el campo Total pagado. Cierra y vuelve a abrir el pedido para actualizarlo.");return;}
    const amount=Number(String(input.value||"").trim().replace(",","."));
    if(!Number.isFinite(amount)||amount<=0){showPaymentValidation("Ingresa el importe que pagaste en la agencia antes de continuar.");input.focus();return;}

    

    const {data:existing,error:ee}=await db.from("movimientos_caja")
      .select("id,monto,descripcion,creado_en")
      .eq("motorizado_id",moto.id).eq("pedido_id",id).eq("tipo","retiro")
      .ilike("descripcion","PAGO DE ENCOMIENDA%")
      .order("creado_en",{ascending:false}).limit(1);
    if(ee)throw ee;
    if(existing?.length){
      const paidAmount=Number(existing[0].monto||0);
      const obs=String(o.observaciones||"");
      const tag="PAGO_ENCOMIENDA_CAJA_CONFIRMADO";
      const newObs=obs.includes(tag)?obs:(obs?obs+" | ":"")+tag;
      const {error:up}=await db.from("pedidos").update({monto_pagado_agencia:paidAmount,observaciones:newObs})
        .eq("id",id).eq("motorizado_id",moto.id);
      if(up)throw up;
      showPaymentValidation(`Este pago ya estaba registrado en caja por S/ ${paidAmount.toFixed(2)}. No se descontó nuevamente.`);
      await loadOrders();await loadCash();return;
    }

    

    const {data:movs,error:me}=await fetchMotoCashMovements("tipo,monto,descripcion,creado_en,pedido_id",false);
    if(me)throw me;
    

    const eligible=(movs||[]);
    const cycleMarkers=eligible.filter(m=>
      (m.tipo==="retiro"&&/LIQUIDACI[ÓO]N DE CAJA/i.test(String(m.descripcion||""))) ||
      /REINICIO DE CAJA/i.test(String(m.descripcion||""))
    ).sort((a,b)=>new Date(b.creado_en)-new Date(a.creado_en));
    const cycleStart=cycleMarkers.length?new Date(cycleMarkers[0].creado_en).getTime():0;
    const active=eligible.filter(m=>!cycleStart||new Date(m.creado_en).getTime()>cycleStart);
    const income=active.filter(m=>m.tipo==="ingreso").reduce((sum,m)=>sum+Number(m.monto||0),0);
    const withdrawals=active.filter(m=>m.tipo==="retiro").reduce((sum,m)=>sum+Number(m.monto||0),0);
    const balance=Math.round((income-withdrawals)*100)/100;
    


    const {error:re}=await db.from("movimientos_caja").insert({
      motorizado_id:moto.id,pedido_id:id,tipo:"retiro",monto:Math.round(amount*100)/100,
      descripcion:"PAGO DE ENCOMIENDA · Agencia"
    });
    if(re)throw re;

    const obs=String(o.observaciones||"");
    const tag="PAGO_ENCOMIENDA_CAJA_CONFIRMADO";
    const newObs=obs.includes(tag)?obs:(obs?obs+" | ":"")+tag;
    const {error:up}=await db.from("pedidos").update({monto_pagado_agencia:Math.round(amount*100)/100,observaciones:newObs})
      .eq("id",id).eq("motorizado_id",moto.id);
    if(up)throw up;
    showPaymentValidation(`Pago de encomienda registrado correctamente. Se descontaron S/ ${amount.toFixed(2)} de tu caja.`);
    await loadOrders();await loadCash();
  }catch(e){showPaymentValidation("No se pudo registrar el pago en caja. " + (e?.message||String(e)||"Verifica la conexión y los permisos de Supabase."))}
  finally{if(btn)btn.disabled=false;}
};

window.toggleSinClave=function(id){
  const check=$("sinClave_"+id);
  const input=$("clave_"+id);
  const btn=document.querySelector(`.saveGuideBtn[data-pedido-id="${id}"]`);
  if(!check)return;

  if(check.checked){
    if(input){
      input.value="";
      input.disabled=true;
    }
  }else{
    if(input){
      input.disabled=false;
      input.value="";
    }
  }
  window.updateGuideSaveButton(id);
};

window.updateGuideSaveButton=function(id){
  const fileInput=document.getElementById("guia_"+id);
  const keyInput=document.getElementById("clave_"+id);
  const check=document.getElementById("sinClave_"+id);
  const btn=document.querySelector(`.saveGuideBtn[data-pedido-id="${id}"]`);
  if(!keyInput||!check||!btn)return;

  const pedido=orders.find(o=>o.id===id);
  const alreadyUploaded=!!String(pedido?.guia_url||"").trim();
  const hasFile=!!fileInput?.files?.[0];
  const hasKey=String(keyInput.value||"").trim().length>0;
  const hasSinClave=!!check.checked;
   
  const claveGuardada=String(pedido?.clave_guia||"").trim();
  const sinClaveConfirmada=String(pedido?.observaciones||"").includes("SIN_CLAVE_GUIA_CONFIRMADO");
  const completado=alreadyUploaded && (!!claveGuardada || sinClaveConfirmada);
  btn.disabled=completado;
  btn.classList.toggle("guia-clave-completada",completado);
  if(completado) btn.textContent="✓ Guía y clave enviada con éxito";
};

window.updateAllGuideSaveButtons=function(){
  document.querySelectorAll(".saveGuideBtn[data-pedido-id]").forEach(btn=>{
    window.updateGuideSaveButton(btn.dataset.pedidoId);
  });
};

window.saveEncomiendaGuide=async function(id, buttonEl){
  const msg=document.getElementById("appMsg");
  window.__guideSavingIds=window.__guideSavingIds || new Set();
  if(window.__guideSavingIds.has(String(id))) return;
  window.__guideSavingIds.add(String(id));
  const notify=(text)=>{
    try{ if(msg) show(msg,text); else console.info(text); }catch(err){ console.error(err); }
    if(!msg){ try{ pdAviso(text); }catch(_){} }
  };

  try{
    

    const clickedButton=buttonEl || document.querySelector(`.saveGuideBtn[data-pedido-id="${id}"]`);
    const cardScope=clickedButton?.closest(".recojoInfoCard") || clickedButton?.parentElement || document;
    const escapedId=CSS.escape(String(id));
    const allFileInputs=[...document.querySelectorAll(`[id="guia_${String(id).replace(/"/g, '\\"')}"]`)];
    const input=allFileInputs.find(el=>el.files && el.files.length>0)
      || cardScope.querySelector(`#guia_${escapedId}`)
      || allFileInputs.find(el=>el.getClientRects().length>0)
      || allFileInputs[0];
    const file=(input?.files?.length ? input.files[0] : null) || window.__guideFileCache?.get(String(id)) || null;
    const fieldScope=input?.closest(".recojoInfoCard") || cardScope;
    const keyInput=fieldScope.querySelector(`#clave_${escapedId}`)
      || cardScope.querySelector(`#clave_${escapedId}`)
      || document.querySelector(`#clave_${escapedId}`);
    const check=fieldScope.querySelector(`#sinClave_${escapedId}`)
      || cardScope.querySelector(`#sinClave_${escapedId}`)
      || document.querySelector(`#sinClave_${escapedId}`);
    const sinClave=!!check?.checked;
    let clave=String(keyInput?.value||"").trim();

    let o=orders.find(x=>x.id===id);

     
    if(!o){
      const {data,error}=await db.from("pedidos")
        .select("id,tipo_servicio,tipo_pago_encomienda,guia_url,clave_guia,monto_pagado_agencia,motorizado_id")
        .eq("id",id).eq("motorizado_id",moto.id).maybeSingle();
      if(error)throw error;
      o=data;
    }

    if(!o)return notify("No se encontró el pedido.");

     
    if(!sinClave && !clave) clave=String(o.clave_guia||"").trim();
    const existingGuide=String(o.guia_url||"").trim();

    if(!existingGuide && !file){
      return notify("Selecciona primero el archivo de la guía.");
    }

    if(!sinClave && !clave){
      return notify("Ingresa la clave de la guía o marca Sin clave.");
    }

    const amountInput=(fieldScope?.querySelector("#encCaja_"+CSS.escape(String(id))) || cardScope?.querySelector("#encCaja_"+CSS.escape(String(id)) ) || document.getElementById("encCaja_"+id));
    const amountRaw=String(amountInput?.value||o.monto_pagado_agencia||"").trim();
    const amount=Number(amountRaw);

    if(o.tipo_pago_encomienda==="pago_en_agencia" &&
       (!Number.isFinite(amount)||amount<=0)){
      return notify("Ingresa cuánto pagaste por el envío.");
    }

    const claveFinal=sinClave ? "SIN_CLAVE" : clave;

    const btn=clickedButton;
    if(btn)btn.disabled=true;
    notify("Guardando guía y clave...");

     
    if(existingGuide){
      const {data:saved,error}=await db.from("pedidos").update({
        clave_guia:claveFinal,
        ...(Number.isFinite(amount)&&amount>0 ? {monto_pagado_agencia:amount} : {})
      }).eq("id",id).eq("motorizado_id",moto.id)
        .select("id,guia_url,clave_guia,monto_pagado_agencia")
        .maybeSingle();

      if(error)throw new Error(error.message);
      if(!saved)throw new Error("Supabase no confirmó el guardado del pedido.");
      if(!saved.guia_url)throw new Error("La guía no quedó registrada.");
      if(String(saved.clave_guia||"")!==claveFinal)throw new Error("La clave no quedó registrada.");

      const local=orders.find(x=>x.id===id);
      if(local){
        local.guia_url=saved.guia_url;
        local.clave_guia=saved.clave_guia;
        if(saved.monto_pagado_agencia!=null) local.monto_pagado_agencia=saved.monto_pagado_agencia;
      }
      if(btn)btn.disabled=true;
      try{window.__guideFileCache?.delete(String(id));}catch(_){}
      notify("Guía y clave guardadas. La foto quedó registrada en el pedido.");
      window.__guideSavingIds.delete(String(id));
      renderOrders();
      await loadOrders();
      return;
    }

    

    const allowedTypes=["image/jpeg","image/png","image/webp"];
    if(file && file.type && !allowedTypes.includes(file.type))
      throw new Error("La guía debe ser una imagen JPG, PNG o WEBP.");
    if(file && file.size>8*1024*1024)
      throw new Error("La foto debe pesar como máximo 8 MB.");

    const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"})[file.type]||"jpg";
    const stamp=Date.now();
    const storage=db.storage.from("comprobantes_pagos");
    let path=`guias_encomiendas/pedido_${id}_${stamp}.${ext}`;
    let up=await storage.upload(path,file,{
      upsert:false,
      contentType:file.type||"image/jpeg",
      cacheControl:"3600"
    });
    if(up.error){
      const firstError=up.error.message||String(up.error);
      path=`comprobantes_yape/guia_pedido_${id}_${stamp}.${ext}`;
      up=await storage.upload(path,file,{
        upsert:false,
        contentType:file.type||"image/jpeg",
        cacheControl:"3600"
      });
      if(up.error)throw new Error(`No se pudo subir la foto a Supabase Storage. Ruta de guías: ${firstError}. Ruta alternativa: ${up.error.message||String(up.error)}`);
    }

    const publicData=storage.getPublicUrl(path);
    const url=publicData?.data?.publicUrl;
    if(!url)throw new Error("La foto se subió, pero Supabase no generó el enlace público. Revisa que el bucket comprobantes_pagos sea público.");

    const {data:saved,error}=await db.from("pedidos").update({
      guia_url:url,
      clave_guia:claveFinal,
      ...(Number.isFinite(amount)&&amount>0 ? {monto_pagado_agencia:amount} : {})
    }).eq("id",id).eq("motorizado_id",moto.id)
      .select("id,guia_url,clave_guia,monto_pagado_agencia")
      .maybeSingle();

    if(error)throw new Error(error.message);
    if(!saved)throw new Error("Supabase no confirmó el guardado del pedido.");
    if(!saved.guia_url)throw new Error("La guía no quedó registrada.");
    if(String(saved.clave_guia||"")!==claveFinal)throw new Error("La clave no quedó registrada.");

    const local=orders.find(x=>x.id===id);
    if(local){
      local.guia_url=saved.guia_url;
      local.clave_guia=saved.clave_guia;
      if(saved.monto_pagado_agencia!=null) local.monto_pagado_agencia=saved.monto_pagado_agencia;
    }
    if(btn)btn.disabled=true;
    try{window.__guideFileCache?.delete(String(id));}catch(_){}
    notify("Guía y clave guardadas. La foto quedó registrada en el pedido.");
    window.__guideSavingIds.delete(String(id));
    renderOrders();
    await loadOrders();

  }catch(e){
    window.__guideSavingIds?.delete(String(id));
    notify("No se pudo guardar: "+(e?.message||String(e)));
    const btn=document.querySelector(`.saveGuideBtn[data-pedido-id="${id}"]`);
    if(btn)btn.disabled=false;
  }
};

window.__guideFileCache=window.__guideFileCache || new Map();
window.cacheGuideFile=function(input,id){
  try{
    const file=input && input.files && input.files.length ? input.files[0] : null;
    if(file) window.__guideFileCache.set(String(id),file);
    else if(!window.__guideFileCache.has(String(id))) window.__guideFileCache.delete(String(id));
    window.updateGuideSaveButton(String(id));
    if(file) show($("appMsg"),"Guía seleccionada. Presiona Guardar guía y clave para subirla.");
  }catch(e){console.error("No se pudo conservar la foto seleccionada",e);}
};
document.addEventListener("change",function(ev){
  const el=ev.target;
  if(!el)return;
  const id=(el.id||"").replace(/^(guia_|clave_|sinClave_)/,"");
  if((el.id||"").startsWith("guia_") && el.files && el.files[0]){
     
    window.__guideFileCache.set(String(id),el.files[0]);
  }
  if(["guia_"+id,"clave_"+id,"sinClave_"+id].includes(el.id)){
    window.updateGuideSaveButton(id);
  }
});
document.addEventListener("input",function(ev){
  const el=ev.target;
  if(el && el.id && el.id.startsWith("clave_")){
    window.updateGuideSaveButton(el.id.replace("clave_",""));
  }
});

 


window.confirmEncomiendaAgency=async function(id){
  try{
    const o=orders.find(x=>x.id===id); if(!o)return;
    if(o.estado!=="en_camino")return show($("appMsg"),"Primero debes iniciar el pedido y marcarlo En camino.");

    const {data,error}=await db.from("pedidos").update({
      pedido_en_agencia:true
    }).eq("id",id).eq("motorizado_id",moto.id).select("id").maybeSingle();
    if(error)throw error;
    if(!data){show($("appMsg"),"No se actualizó la encomienda. Verifica que siga asignada a tu cuenta.");return;}

    show($("appMsg"),"Encomienda marcada como En agencia. Ahora puedes registrar el pago y la guía.");
    await loadOrders();
  }catch(e){show($("appMsg"),"No se pudo marcar la encomienda en agencia: "+(e.message||e))}
};

function toggleCashInOther(){
  const source=$("cashInSource");
  const otherInput=$("cashInOtherSource");
  if(!source || !otherInput) return;
  const showOther=source.value==="Otros";
  otherInput.style.display=showOther ? "block" : "none";
  otherInput.required=showOther;
  if(!showOther) otherInput.value="";
  if(showOther) otherInput.focus();
}

async function addCashIn(){
  if(!moto){
    $("cashInMsg").textContent="Inicia sesión para registrar dinero en tu caja.";
    return;
  }

  const amount=Number($("cashInAmount").value);
  const source=$("cashInSource").value;
  const otherInput=$("cashInOtherSource");
  const otherDescription=(otherInput?.value||"").trim();
  const description=source==="Otros"?otherDescription:source;
  const msg=$("cashInMsg");
  if(!Number.isFinite(amount)||amount<=0){
    msg.textContent="Ingresa un monto mayor que S/ 0.00.";
    return;
  }
  if(!source || !description){
    msg.textContent=source==="Otros"?"Escribe el origen del dinero al seleccionar Otros.":"Elige de quién recibiste el efectivo.";
    return;
  }

  const btn=$("addCashIn");
  btn.disabled=true;
  msg.textContent="Registrando ingreso...";
  try{
    const {error}=await db.from("movimientos_caja").insert({
      motorizado_id:moto.id,
      tipo:"ingreso",
      monto:Math.round(amount*100)/100,
      descripcion:"INGRESO MANUAL DE CAJA · "+description
    });
    if(error)throw error;

    $("cashInAmount").value="";
    $("cashInSource").value="";
    

    

    const legacyCashDescription=$("cashInDescription");
    if(legacyCashDescription) legacyCashDescription.value="";
    toggleCashInOther();
    msg.textContent="Ingreso registrado correctamente.";
    await loadCash();
  }catch(e){
    msg.textContent="No se pudo agregar el dinero: "+String(e?.message||e);
  }finally{
    btn.disabled=false;
  }
}

function toggleExpenseOther(){
  const reason=$("expenseReason");
  const other=$("expenseOtherReason");
  if(!reason || !other) return;
  const showOther=reason.value==="Otros";
  other.style.display=showOther ? "block" : "none";
  other.required=showOther;
  if(!showOther) other.value="";
  if(showOther) other.focus();
}

async function addExpense(){
  if(!moto)return;

  const amount=Number($("expenseAmount").value);
  const reason=$("expenseReason").value;
  const other=($("expenseOtherReason").value||"").trim();
  const description=reason==="Otros"?other:reason;
  const msg=$("expenseMsg");

  if(!Number.isFinite(amount)||amount<=0){
    msg.textContent="Ingresa un monto válido.";
    return;
  }
  if(!reason || !description){
    msg.textContent=reason==="Otros"?"Escribe el detalle del pago al seleccionar Otros.":"Elige para qué usaste el efectivo.";
    return;
  }

  const btn=$("addExpense");
  btn.disabled=true;
  msg.textContent="Registrando pago...";
  try{
    const {error}=await db.from("movimientos_caja").insert({
      motorizado_id:moto.id,
      tipo:"retiro",
      monto:Math.round(amount*100)/100,
      descripcion:description
    });
    if(error)throw error;

    $("expenseAmount").value="";
    $("expenseReason").value="";
    $("expenseOtherReason").value="";
    toggleExpenseOther();
    msg.textContent="Pago registrado correctamente.";
    await loadCash();
  }catch(e){
    msg.textContent="No se pudo registrar el pago: "+String(e?.message||e);
  }finally{
    btn.disabled=false;
  }
}
















async function fetchMotoCashMovements(columns, ascending=false){
  const all=[];
  const pageSize=1000;
  for(let from=0; ; from+=pageSize){
    const {data,error}=await db.from("movimientos_caja")
      .select(columns)
      .eq("motorizado_id",moto.id)
      .order("creado_en",{ascending})
      .range(from,from+pageSize-1);
    if(error)return {data:null,error};
    const page=data||[];
    all.push(...page);
    if(page.length<pageSize)break;
    if(all.length>=100000)return {data:null,error:new Error("El historial supera los 100.000 movimientos. No se calculará un saldo parcial.")};
  }
  return {data:all,error:null};
}

let cashLoadRequestId = 0;
window.loadCash = async function loadCash(){
  if(!moto)return;
  const requestId = ++cashLoadRequestId;
  const box = $("cashMovements");
  if(box && !box.innerHTML.trim()) box.innerHTML='<div class="notice">Cargando movimientos...</div>';
  let timeoutId;
  try{
    await Promise.race([
      loadCashCore(requestId),
      new Promise((_,reject)=>{ timeoutId=setTimeout(()=>reject(new Error('La consulta de caja tardó demasiado. Revisa la conexión y vuelve a intentarlo.')),12000); })
    ]);
  }catch(err){
    if(requestId===cashLoadRequestId && box){
      box.innerHTML='<div class="notice">'+esc(err?.message||'No se pudieron cargar los movimientos.')+'<br><button class="btn alt" style="margin-top:10px" type="button" onclick="loadCash()">Reintentar carga</button></div>';
    }
    console.warn('Carga de caja:',err);
  }finally{
    clearTimeout(timeoutId);
  }
}

async function loadCashCore(requestId){
  if(!moto)return;
  const box=$("cashMovements");
  if(box && !box.innerHTML.trim()) box.innerHTML='<div class="notice">Cargando movimientos...</div>';

  

  

  const {data:movs,error}=await fetchMotoCashMovements("id,tipo,monto,descripcion,creado_en,pedido_id,comprobante_url,revision,revision_nota",false);

  if(requestId!==undefined && requestId!==cashLoadRequestId) return;

  if(error){
    const msg='No se pudieron cargar los movimientos de caja: '+esc(error.message||"Error de conexión");
    if(box) box.innerHTML='<div class="notice">'+msg+'</div>';
    const homeBalanceEl=$("homeCashBalance");
    const cashBalanceEl=$("cashBalance");
    if(homeBalanceEl) homeBalanceEl.textContent="No disponible";
    if(cashBalanceEl) cashBalanceEl.textContent="No disponible";
    console.warn("No se pudo actualizar el saldo de caja:",error.message);
    return;
  }

  

  

  

  for(const m of (movs||[])){
    const desc=String(m.descripcion||"");
    if(m.tipo!=="ingreso" || !m.pedido_id || Number(m.monto||0)!==0) continue;
    const match=desc.match(/recibido\s*S\/?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
    if(!match) continue;
    const received=Number(match[1].replace(",","."));
    if(!Number.isFinite(received) || received<=0) continue;
    

    

    

    

    const totM=desc.match(/total(?:\s+pedido)?\s*S\/?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);
    const totN=totM?Number(totM[1].replace(",",".")):0;
    const repairedAmount=Number((totN>0?Math.min(received,totN):received).toFixed(2));
    m.monto=repairedAmount;
    const {error:repairError}=await db.from("movimientos_caja")
      .update({monto:repairedAmount})
      .eq("id",m.id).eq("motorizado_id",moto.id).eq("pedido_id",m.pedido_id).eq("tipo","ingreso").eq("monto",0);
    if(repairError) console.warn("El saldo usa el efectivo descrito, pero Supabase no permitió guardar la reparación del movimiento",m.id,repairError.message);
  }

  if(requestId!==undefined && requestId!==cashLoadRequestId) return;

  

  

  

  const eligible=(movs||[]);
  const cycleMarkers=eligible.filter(m=>
    (m.tipo==="retiro" && /LIQUIDACI[ÓO]N DE CAJA/i.test(String(m.descripcion||""))) ||
    /REINICIO DE CAJA/i.test(String(m.descripcion||""))
  ).sort((a,b)=>new Date(b.creado_en)-new Date(a.creado_en));
  const cycleStart=cycleMarkers.length?new Date(cycleMarkers[0].creado_en).getTime():0;
  const cycleMovs=eligible.filter(m=>!cycleStart || new Date(m.creado_en).getTime()>cycleStart);

  const incomeMovs=cycleMovs.filter(m=>m.tipo==="ingreso");
  const income=incomeMovs.reduce((sum,m)=>sum+Number(m.monto||0),0);
  const isManualIncome=m=>/^(INGRESO MANUAL DE CAJA|INGRESO DE ADMINISTRADOR)\s*[·:]?/i.test(String(m.descripcion||"").trim());
  const extraIncome=incomeMovs.filter(isManualIncome).reduce((sum,m)=>sum+Number(m.monto||0),0);
  const orderIncome=income-extraIncome;
  const isPayment=m=>/^(PAGO DE ENCOMIENDA|PAGO DE COMPRA)/i.test(String(m.descripcion||"").trim());
  const payments=cycleMovs.filter(m=>m.tipo==="retiro"&&isPayment(m)).reduce((sum,m)=>sum+Number(m.monto||0),0);
  const expenses=cycleMovs.filter(m=>m.tipo==="retiro"&&!isPayment(m)).reduce((sum,m)=>sum+Number(m.monto||0),0);
  const totalOutflows=payments+expenses;
  const balance=Math.round((income-totalOutflows)*100)/100;

  const formattedBalance="S/ "+balance.toFixed(2);
  

  

  window.__pidemasMotoCashBalanceText=formattedBalance;
  function syncMotoCashBalanceCards(){
    const homeBalanceEl=document.getElementById("homeCashBalance");
    const cashBalanceEl=document.getElementById("cashBalance");
    if(homeBalanceEl) homeBalanceEl.textContent=window.__pidemasMotoCashBalanceText;
    if(cashBalanceEl) cashBalanceEl.textContent=window.__pidemasMotoCashBalanceText;
  }
  syncMotoCashBalanceCards();
  

  requestAnimationFrame(syncMotoCashBalanceCards);
  setTimeout(syncMotoCashBalanceCards, 150);
  setTimeout(syncMotoCashBalanceCards, 600);
  if($("cashOnly")) $("cashOnly").textContent="S/ "+income.toFixed(2);
  if($("cashOrderIncome")) $("cashOrderIncome").textContent="S/ "+orderIncome.toFixed(2);
  if($("cashExtraIncome")) $("cashExtraIncome").textContent="S/ "+extraIncome.toFixed(2);
  if($("cashTotalOutflows")) $("cashTotalOutflows").textContent="S/ "+totalOutflows.toFixed(2);
  

  $("cashPayments").textContent="S/ "+payments.toFixed(2);
  if($("cashExpenses")) $("cashExpenses").textContent="S/ "+expenses.toFixed(2);

  

  const items=(movs||[]).map(m=>{
    const date=new Date(m.creado_en), isIncome=m.tipo==="ingreso";
    const rawDescription=String(m.descripcion||"").trim();
    const d=rawDescription.toUpperCase();
    const esPago=isPayment(m), esLiquidacion=/LIQUIDACI[ÓO]N DE CAJA/.test(d);
    const esIngresoManual=/^(INGRESO MANUAL DE CAJA|INGRESO DE ADMINISTRADOR)\s*[·:]?/i.test(rawDescription);
    const label=esLiquidacion?"ENTREGA DE CAJA":esPago?"PAGO":isIncome?(m.pedido_id?"COBRO DE PEDIDO":"COBRO"):"PAGO";
    

    const cleanDescription=rawDescription
      .replace(/^(INGRESO MANUAL DE CAJA|INGRESO DE ADMINISTRADOR)\s*[·:]\s*/i,"")
      .replace(/^GASTO MANUAL\s*:\s*/i,"")
      .trim() || (isIncome ? "Cobro" : "Pago");
    return {date,html:`<div class="order"><div class="orderHead"><div class="big">${isIncome?"+":"−"} S/ ${Number(m.monto||0).toFixed(2)}</div><span class="status">${label}</span></div><div class="line"><b>${isIncome?"Motivo":(esPago?"Pago":"Motivo")}:</b> ${esc(cleanDescription)}</div>${m.pedido_id?`<div class="line"><b>Pedido:</b> #${esc(String(m.pedido_id).slice(0,8).toUpperCase())}</div>`:""}<div class="line"><b>Fecha:</b> ${esc(date.toLocaleString("es-PE"))}</div></div>`};
  }).sort((a,b)=>b.date-a.date);
  cashMovementItems=items;
  renderMotoCashMovements();
}





let cashMovementItems=[];
let cashMovementDisplayLimit=10;
function renderMotoCashMovements(){
  const box=$("cashMovements");
  if(!box)return;
  const grouped=new Map();
  cashMovementItems.forEach(item=>{
    const key=item.date.toLocaleDateString("es-PE",{day:"2-digit",month:"2-digit",year:"numeric"});
    if(!grouped.has(key)) grouped.set(key,[]);
    grouped.get(key).push(item);
  });
  const allDays=[...grouped.entries()].sort((a,b)=>{
    const da=a[1][0]?.date?.getTime?.()||0, db=b[1][0]?.date?.getTime?.()||0;
    return db-da;
  });
  const visibleDays=allDays.slice(0,cashMovementDisplayLimit);
  const todayKey=new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"2-digit",year:"numeric"});
  const groupHtml=visibleDays.map(([date,group])=>{
    const isToday=date===todayKey;
    const title=isToday?`Hoy · ${date}`:date;
    return `<details class="cashDateGroup" ${isToday?"open":""}>
      <summary class="cashDateSummary"><span>${esc(title)} <small>(${group.length})</small></span><span class="cashDateToggle" aria-hidden="true"></span></summary>
      <div class="cashDateContent">${group.map(x=>x.html).join("")}</div>
    </details>`;
  }).join("");
  const remaining=allDays.length-visibleDays.length;
  const moreButton=remaining>0?`<button class="btn alt" type="button" id="showMoreCashMovements">Ver más días (${Math.min(10,remaining)} más)</button>`:"";
  box.innerHTML=allDays.length?groupHtml+moreButton:'<div class="notice">Aún no hay movimientos.</div>';
  const more=$("showMoreCashMovements");
  if(more)more.addEventListener("click",()=>{cashMovementDisplayLimit+=10;renderMotoCashMovements();});
}
function excelEscape(value){
  const v=String(value==null?"":value);
  return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function excelCell(value,type="String"){
  if(type==="Number" && Number.isFinite(Number(value))) return `<Cell><Data ss:Type="Number">${Number(value)}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${excelEscape(value)}</Data></Cell>`;
}
async function exportCashExcel(){
  const btn=$("downloadCashReport"), status=$("cashExportMsg");
  if(!moto){if(status)status.textContent="Inicia sesión para exportar tu caja.";return;}
  if(btn)btn.disabled=true;
  if(status)status.textContent="Preparando Excel con el detalle de los movimientos…";
  try{
    const {data:raw,error}=await fetchMotoCashMovements("id,motorizado_id,pedido_id,tipo,monto,descripcion,creado_en",true);
    if(error)throw error;
    

    const eligible=(raw||[]);
    const cycleMarkers=eligible.filter(m=>
      (m.tipo==="retiro"&&/LIQUIDACI[ÓO]N DE CAJA/i.test(String(m.descripcion||""))) ||
      /REINICIO DE CAJA/i.test(String(m.descripcion||""))
    ).sort((a,b)=>new Date(b.creado_en)-new Date(a.creado_en));
    const cycleStart=cycleMarkers.length?new Date(cycleMarkers[0].creado_en).getTime():0;
    let movs=eligible.filter(m=>!cycleStart||new Date(m.creado_en).getTime()>cycleStart);
    const reportDate=$("cashReportDate")?.value||"";
    if(!reportDate)throw new Error("Selecciona el día que deseas reportar.");
    const start=new Date(reportDate+"T00:00:00").getTime();
    const end=new Date(reportDate+"T23:59:59.999").getTime();
    movs=movs.filter(m=>{const t=new Date(m.creado_en).getTime();return t>=start&&t<=end;});
    movs.sort((a,b)=>new Date(a.creado_en)-new Date(b.creado_en));
    const isPayment=m=>/^(PAGO DE ENCOMIENDA|PAGO DE COMPRA)/i.test(String(m.descripcion||"").trim());
    const isManual=m=>/^(INGRESO MANUAL DE CAJA|INGRESO DE ADMINISTRADOR)\s*[·:]?/i.test(String(m.descripcion||"").trim());
    let running=0,totalIncome=0,totalOut=0,totalOrders=0,totalExtra=0,totalPayments=0,totalExpenses=0;
    const rows=movs.map(m=>{
      const date=new Date(m.creado_en),income=m.tipo==="ingreso",amount=Math.round(Number(m.monto||0)*100)/100;
      const desc=String(m.descripcion||"").trim();
      const clean=desc.replace(/^(INGRESO MANUAL DE CAJA|INGRESO DE ADMINISTRADOR)\s*[·:]\s*/i,"").replace(/^GASTO MANUAL\s*:\s*/i,"").trim();
      const payment=!income&&isPayment(m);
      const category= /LIQUIDACI[ÓO]N DE CAJA/i.test(desc)?"Entrega de caja":payment?( /^PAGO DE ENCOMIENDA/i.test(desc)?"Pago de encomienda":"Pago de compra"):income?(m.pedido_id?"Cobro de pedido":isManual(m)?"Cobro extra":"Ingreso"):"Gasto";
      if(income){totalIncome+=amount;running+=amount;if(m.pedido_id)totalOrders+=amount;else if(isManual(m))totalExtra+=amount;}
      else {totalOut+=amount;running-=amount;if(payment)totalPayments+=amount;else totalExpenses+=amount;}
      return {id:m.id,fecha:date.toLocaleDateString("es-PE"),hora:date.toLocaleTimeString("es-PE"),tipo:income?"COBRO":"PAGO",categoria:category,descripcion:clean,pedido:m.pedido_id||"",monto:amount,ingreso:income?amount:0,egreso:income?0:amount,saldo:Math.round(running*100)/100};
    });
    const headers=["ID movimiento","Fecha","Hora","Motorizado","ID motorizado","Tipo","Categoría","Descripción / origen / motivo","ID pedido","Monto (S/) ","Ingreso (S/) ","Egreso (S/) ","Saldo acumulado (S/) "];
    const detailRows=rows.map(r=>`<Row>${[
      excelCell(r.id),excelCell(r.fecha),excelCell(r.hora),excelCell(moto.nombre||moto.email||"Motorizado"),excelCell(moto.id,"Number"),excelCell(r.tipo),excelCell(r.categoria),excelCell(r.descripcion),excelCell(r.pedido),excelCell(r.monto,"Number"),excelCell(r.ingreso,"Number"),excelCell(r.egreso,"Number"),excelCell(r.saldo,"Number")
    ].join("")}</Row>`).join("");
    const summary=[
      ["REPORTE DETALLADO DE CAJA — PIDEMÁS",""],
      ["Motorizado",moto.nombre||moto.email||"Motorizado"],
      ["ID motorizado",moto.id],
      ["Fecha de exportación",new Date().toLocaleString("es-PE")],
      ["Movimientos incluidos",rows.length],
      ["Total de cobros (S/)",Math.round(totalIncome*100)/100],
      ["Cobros de pedidos (S/)",Math.round(totalOrders*100)/100],
      ["Cobros extra (S/)",Math.round(totalExtra*100)/100],
      ["Total egresos (S/)",Math.round(totalOut*100)/100],
      ["Pagos de compras/encomiendas (S/)",Math.round(totalPayments*100)/100],
      ["Otros pagos (S/)",Math.round(totalExpenses*100)/100],
      ["Saldo calculado del periodo (S/)",Math.round((totalIncome-totalOut)*100)/100]
    ];
    const summaryRows=summary.map((r,i)=>`<Row>${excelCell(r[0])}${excelCell(r[1],i>0&&typeof r[1]==="number"?"Number":"String")}</Row>`).join("");
    const workbook=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#111111" ss:Pattern="Solid"/></Style><Style ss:ID="money"><NumberFormat ss:Format="0.00"/></Style></Styles><Worksheet ss:Name="Resumen"><Table>${summaryRows}</Table></Worksheet><Worksheet ss:Name="Movimientos detallados"><Table><Row>${headers.map(h=>`<Cell ss:StyleID="head"><Data ss:Type="String">${excelEscape(h)}</Data></Cell>`).join("")}</Row>${detailRows}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenRows>1</FrozenRows></WorksheetOptions></Worksheet></Workbook>`;
    const blob=new Blob(["\ufeff",workbook],{type:"application/vnd.ms-excel;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    const stamp=reportDate;
    a.href=url;a.download=`Pidemas_Caja_${String(moto.nombre||"Motorizado").trim().replace(/[^a-z0-9_-]+/gi,"_")}_${stamp}.xls`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    if(status)status.textContent=`Reporte generado: ${rows.length} movimientos del ${reportDate}.`;
  }catch(e){
    console.error("Exportación de caja:",e);
    if(status)status.textContent="No se pudo generar el Excel: "+(e?.message||"error de conexión");
  }finally{if(btn)btn.disabled=false;}
}

let activeNotificationFilter="todos";
let notificationVisibleLimit=10;
function notificationCategory(n){
  const text=(String(n.titulo||"")+" "+String(n.mensaje||"")).toLowerCase();
  if(/caja|liquid|saldo|cobro|ingreso|gasto|retiro|dinero|monto|efectivo|pago confirmado/.test(text))return "caja";
  if(/pedido|servicio|encomienda|compra|entrega|asignad|cancelad|en camino|recibido/.test(text))return "pedidos";
  return "sistema";
}
function renderNotifications(items){
  const box=$("notifications"); if(!box)return;
  const filtered=activeNotificationFilter==="todos"?items:items.filter(n=>n.category===activeNotificationFilter);
  box.innerHTML="";
  if(!filtered.length){box.innerHTML='<div class="notice">No hay avisos en esta categoría.</div>';return;}
  const visible=filtered.slice(0,notificationVisibleLimit);
  visible.forEach(n=>{
    const date=n.createdAt?new Date(n.createdAt):null;
    const dateText=date&&!Number.isNaN(date.getTime())?date.toLocaleString("es-PE",{dateStyle:"short",timeStyle:"short"}):"";
    box.insertAdjacentHTML("beforeend",`<article class="notifItem ${n.unread?"unread":""}${n.pedidoId?" notifHasOrder":""}" data-category="${esc(n.category)}"${n.pedidoId?` data-pedido-id="${esc(n.pedidoId)}" data-notif-id="${esc(n.notifId||"")}" role="button" tabindex="0" aria-label="Abrir pedido de este aviso"`:""}><div class="notifItemTitle">${esc(n.title)}</div><div class="notifItemMessage">${esc(n.message)}</div><span class="notifTag">${n.category==="pedidos"?"PEDIDOS":n.category==="caja"?"CAJA":"SISTEMA"}</span><time>${esc(dateText)}</time>${n.pedidoId?`<button type="button" class="notifOpenOrder">Ver pedido #${esc(String(n.pedidoId).slice(0,8).toUpperCase())}</button>`:""}</article>`);
  });
  if(filtered.length>visible.length){
    box.insertAdjacentHTML("beforeend",`<button type="button" id="showMoreNotifications" style="width:100%;min-height:44px;margin:2px 0 8px;border:1px solid var(--fr-line);border-radius:12px;background:var(--fr-surface);color:var(--fr-ink);font-size:14px;font-weight:700">Ver más (${filtered.length-visible.length})</button>`);
    $("showMoreNotifications").addEventListener("click",()=>{notificationVisibleLimit+=10;renderNotifications(items);});
  }
}
async function loadNotifications(){
  const box=$("notifications");
  if(!box)return;
  if(!session?.user?.id){
    box.innerHTML='<div class="notice">Inicia sesión para consultar tus avisos.</div>';
    return;
  }
  

  

  const modal=$("notificationsModal");
  const modalIsOpen=!!(modal && modal.classList.contains("open"));
  if(!modalIsOpen || !box.innerHTML.trim()){
    box.innerHTML='<div class="notice" role="status">Cargando avisos y actividad…</div>';
  }
  try{
    const {data,error}=await db.from("notificaciones").select("*").eq("usuario_id",session.user.id).order("creado_en",{ascending:false}).limit(50);
    if(error)throw error;
    const leidosLocal=(typeof pdReadLocal==='function')?pdReadLocal():new Set();
    const unread=(data||[]).filter(n=>!n.leida&&!leidosLocal.has(String(n.id))).length;
    const count=$("notifCount"),topBadge=$("topNotifBadge");
    if(count)count.textContent=unread;if(topBadge)topBadge.textContent=unread;
    const navBadge=$("navNotifBadge");if(navBadge){navBadge.textContent=unread;navBadge.classList.toggle("hasUnread",unread>0);}
    const items=(data||[]).map(n=>({id:n.id,title:n.titulo||"Aviso de Pidemás",message:n.mensaje||"Hay una actualización en tu cuenta.",createdAt:n.creado_en,unread:!n.leida&&!leidosLocal.has(String(n.id)),category:notificationCategory(n),pedidoId:n.pedido_id||null,notifId:n.id}));
    

    if(moto?.id){
      const cash=await db.from("movimientos_caja").select("id,tipo,monto,descripcion,creado_en,pedido_id,comprobante_url,revision,revision_nota").eq("motorizado_id",moto.id).order("creado_en",{ascending:false}).limit(20);
      if(cash.error)console.warn("No se pudieron cargar los movimientos de caja en avisos",cash.error);
      else (cash.data||[]).forEach(m=>{
        const desc=String(m.descripcion||"");
        const isLiquid=/LIQUIDACI[ÓO]N DE CAJA/i.test(desc);
        const isPayment=/PAGO|GASTO|RETIRO/i.test(desc)||m.tipo==="retiro";
        const title=isLiquid?"Liquidación de caja registrada":isPayment?"Movimiento de salida de caja":"Ingreso a caja";
        const amount=Number(m.monto||0).toFixed(2);
        const visibleDesc=desc.replace(/^\s*INGRESO MANUAL DE CAJA\s*[·:]?\s*/i,"").trim();
        items.push({id:"cash-"+m.id,title,message:`${visibleDesc||title}. Importe: S/ ${amount}.`,createdAt:m.creado_en,unread:false,category:"caja",pedidoId:m.pedido_id||null});
      });
    }
    const unique=new Map();items.forEach(n=>unique.set(String(n.id),n));
    const all=[...unique.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)).slice(0,70);
    renderNotifications(all);
    if(!all.length)box.innerHTML='<div class="notice">No tienes avisos ni movimientos recientes.</div>';
  }catch(e){
    console.error("No se pudieron cargar los avisos",e);
    box.innerHTML='<div class="notice" role="alert" style="margin-bottom:10px"><strong>No se pudieron cargar los avisos.</strong><br>Comprueba tu conexión e inténtalo de nuevo.<br><small style="display:block;margin-top:6px;color:var(--fr-muted)">'+esc(e?.message||e?.details||"Error de conexión o permisos de Supabase")+'</small></div><button type="button" id="retryLoadNotifications" style="width:100%;min-height:42px;border:1px solid var(--fr-line);border-radius:12px;background:var(--fr-peach-soft);color:var(--fr-ink);font-weight:700">Reintentar carga</button>';
    const retry=$("retryLoadNotifications");if(retry)retry.onclick=loadNotifications;
  }
}
async function markAllNotificationsRead(){
  if(!session?.user?.id)return;
  const btn=$("markAllNotificationsRead");if(btn)btn.disabled=true;
  try{
    const {error}=await db.from("notificaciones").update({leida:true}).eq("usuario_id",session.user.id).eq("leida",false);
    if(error)throw error;
    await loadNotifications();
  }catch(e){console.warn("No se pudieron marcar los avisos como leídos",e);}
  finally{if(btn)btn.disabled=false;}
}

async function loadReport(){
  if(!moto)return;
  

  

  const reportEl=$("report");
  if(!reportEl)return;

  const {data,error}=await db.from("reporte_tiempos_entrega")
    .select("pedido_id,minutos_hasta_salir,minutos_de_entrega,minutos_totales,entregado_en")
    .eq("motorizado_id",moto.id)
    .order("entregado_en",{ascending:false})
    .limit(50);

  if(error){
    $("report").innerHTML='<div class="notice">No se pudo cargar el rendimiento.</div>';
    return;
  }

  if(!data?.length){
    $("report").innerHTML='<div class="notice">Aún no hay entregas registradas.</div>';
    return;
  }

  const valid=data.filter(x=>Number.isFinite(Number(x.minutos_de_entrega)));
  const avg=valid.length
    ? valid.reduce((s,x)=>s+Number(x.minutos_de_entrega),0)/valid.length
    : 0;

  

  $("report").innerHTML=
    `<div class="row">
      <div class="card">
        <div class="muted">Entregas</div>
        <div class="money">${valid.length}</div>
      </div>
      <div class="card">
        <div class="muted">Promedio</div>
        <div class="money">${avg.toFixed(0)} min</div>
      </div>
    </div>`+
    valid.map(x=>`
      <div class="order">
        <div class="line"><b>Tiempo de entrega:</b> ${Math.round(Number(x.minutos_de_entrega))} min</div>
      </div>
    `).join("");
}

function startRealtime(){
  if(channel)db.removeChannel(channel);
  if(window.__motoRealtimePoll)clearInterval(window.__motoRealtimePoll);
  window.__motoRealtimePoll=setInterval(()=>{loadOrders();loadNotifications();loadCash();},8000);
  channel=db.channel("moto-"+moto.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"pedidos",filter:"motorizado_id=eq."+moto.id},async(payload)=>{
      if(payload.eventType==="INSERT"){
        notifyNewEvent("Nuevo pedido asignado");
      }else if(payload.eventType==="UPDATE"){
        const id=payload.new?.id;
        const local=localPedidoUpdates.has(id);
        if(local) localPedidoUpdates.delete(id);
        else if(payload.new?.estado==="cancelado") notifyNewEvent("Pedido cancelado por administración");
        else notifyNewEvent("Pedido actualizado por administración");
      }else if(payload.eventType==="DELETE"){
        notifyNewEvent("Pedido eliminado por administración");
      }
      await loadOrders();
    })
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"notificaciones",filter:"usuario_id=eq."+session.user.id},async(payload)=>{
      notifyNewEvent("Nueva notificación");
      await loadNotifications();
    })
    

    

    .on("postgres_changes",{event:"*",schema:"public",table:"movimientos_caja",filter:"motorizado_id=eq."+moto.id},async(payload)=>{
      await loadCash();
      await loadNotifications();
      if(payload.eventType==="INSERT")notifyNewEvent("Nuevo movimiento en tu caja");
    }).subscribe();
}
function setGpsStatus(text,state=""){
  const box=$("gpsStatus"), label=$("gpsStatusText");
  if(box&&label){
    box.classList.remove("ok","err");
    if(state)box.classList.add(state);
    label.textContent=text;
  }
  const retry=$("gpsRetryBtn"), help=$("gpsHelp");
  const failed=state==="err";
  if(retry)retry.classList.remove("hidden");
  if(help)help.classList.toggle("hidden",!(failed && /permiso|denegad|bloquead/i.test(text)));
}
let gpsRequestInProgress=false;
function startGPS(){
  if(locationTimer){clearInterval(locationTimer);locationTimer=null;}
  if(!navigator.geolocation){setGpsStatus("GPS no disponible en este dispositivo","err");return;}
  if(!window.isSecureContext){setGpsStatus("El GPS requiere conexión HTTPS","err");return;}
  setGpsStatus("Solicitando permiso de ubicación GPS...","");
  const send=()=>{
    if(gpsRequestInProgress)return;
    gpsRequestInProgress=true;
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude,longitude,accuracy}=pos.coords;
        const now=new Date(), iso=now.toISOString();
        setGpsStatus("GPS activo · guardando ubicación...","ok");
        const updateRes=await db.from("motorizados")
          .update({latitud:latitude,longitud:longitude,ultima_ubicacion:iso})
          .eq("id",moto.id).eq("usuario_id",session.user.id);
        const historyRes=await db.from("ubicaciones_motorizados")
          .insert({motorizado_id:moto.id,latitud:latitude,longitud:longitude,precision_metros:accuracy});
        if(updateRes.error){
          setGpsStatus("GPS activo, pero Supabase no permitió guardar la ubicación","err");
          console.warn("No se pudo actualizar la ubicación del motorizado:",updateRes.error.message);
        }else{
          setGpsStatus("GPS activo · última ubicación "+now.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}),"ok");
        }
        if(historyRes.error)console.warn("No se pudo guardar el historial GPS:",historyRes.error.message);
      }catch(e){
        setGpsStatus("GPS activo, pero ocurrió un error al guardar la ubicación","err");
        console.warn("Error guardando GPS:",e);
      }finally{gpsRequestInProgress=false;}
    },err=>{
      gpsRequestInProgress=false;
      const msg=err?.code===1?"Permiso GPS denegado o bloqueado":err?.code===2?"Ubicación no disponible; activa el GPS del teléfono":"Tiempo agotado al obtener GPS; vuelve a intentarlo";
      setGpsStatus(msg,"err");
      console.warn("GPS motorizado:",err?.message||msg);
    },{enableHighAccuracy:true,maximumAge:0,timeout:25000});
  };
  send();
  locationTimer=setInterval(send,30000);
}
document.addEventListener("DOMContentLoaded",()=>{
  const retry=$("gpsRetryBtn");
  if(retry)retry.addEventListener("click",()=>{
    if(!navigator.geolocation){setGpsStatus("GPS no disponible en este dispositivo","err");return;}
    if(navigator.permissions?.query){
      navigator.permissions.query({name:"geolocation"}).then(p=>{
        if(p.state==="denied"){
          setGpsStatus("Permiso GPS denegado o bloqueado","err");
          const help=$("gpsHelp");if(help)help.classList.remove("hidden");
          pdAviso("Chrome tiene bloqueado el permiso de ubicación para este sitio. En Chrome, toca el icono junto a la dirección web > Permisos del sitio > Ubicación > Permitir. Luego vuelve aquí y pulsa Activar / reintentar GPS.");
        }else startGPS();
      }).catch(()=>startGPS());
    }else startGPS();
  });
});
function scrollSectionToTop(){
  requestAnimationFrame(()=>{
    window.scrollTo({top:0,left:0,behavior:"smooth"});
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
  });
}

function openNotificationsModal(){
  const bottomNav=$("nav");
  if(bottomNav)bottomNav.classList.add("hidden");
  $("notificationsModal").classList.add("open");
  $("notificationsModal").setAttribute("aria-hidden","false");
  loadNotifications();
}
function closeNotificationsModal(userRequested=false){
  if(userRequested!==true)return;
  const modal=$("notificationsModal");if(!modal)return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden","true");
  const restoreHomeBottomNav=()=>{
    const bottomNav=$("nav");
    const homeTab=$("homeTab");
    const appView=$("appView");
    const stillInHome=!!(bottomNav&&homeTab&&appView&&
      !appView.classList.contains("hidden")&&
      !homeTab.classList.contains("hidden")&&
      !modal.classList.contains("open")&&
      !document.body.classList.contains("pdm-open"));
    if(bottomNav)bottomNav.classList.toggle("hidden",!stillInHome);
  };
  restoreHomeBottomNav();
  requestAnimationFrame(()=>requestAnimationFrame(restoreHomeBottomNav));
  setTimeout(restoreHomeBottomNav,120);
}


(function bindHomeCashShortcut(){
  function openCashFromCard(event){
    const card=event.target && event.target.closest ? event.target.closest('[data-open-cash="true"], [data-open-wallet="true"]') : null;
    if(!card) return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof switchTab === "function") switchTab(card.hasAttribute("data-open-wallet") ? "wallet" : "cash");
  }
  document.addEventListener("click", openCashFromCard, true);
  document.addEventListener("keydown", function(event){
    const card=event.target && event.target.closest ? event.target.closest('[data-open-cash="true"], [data-open-wallet="true"]') : null;
    if(card && (event.key === "Enter" || event.key === " ")){
      event.preventDefault();
      event.stopPropagation();
      if(typeof switchTab === "function") switchTab(card.hasAttribute("data-open-wallet") ? "wallet" : "cash");
    }
  }, true);
})();
function switchTab(tab){
  const bottomNav=$("nav");
  if(bottomNav)bottomNav.classList.toggle("hidden",tab!=="home");
  if(tab==="notif"){openNotificationsModal();return;}
  $("homeTab").classList.toggle("hidden",tab!=="home");
  $("notifTab").classList.toggle("hidden",tab!=="notif");
  $("cashTab").classList.toggle("hidden",tab!=="cash");
  $("walletTab").classList.toggle("hidden",tab!=="wallet");
  $("profileTab").classList.toggle("hidden",tab!=="profile");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="notif")loadNotifications();
  if(tab==="cash")loadCash();
  

  

  if(tab==="home"&&moto){
    

    if(window.__pidemasMotoCashBalanceText){
      const homeBalanceEl=document.getElementById("homeCashBalance");
      if(homeBalanceEl)homeBalanceEl.textContent=window.__pidemasMotoCashBalanceText;
    }
    loadCash();
    setTimeout(()=>{if(moto)loadCash();},250);
  }
  if(tab==="wallet"&&window.__pdMotoLoadSalary)window.__pdMotoLoadSalary();
  if(tab==="profile"&&window.__pidemasProfileRecord)populateProfile(window.__pidemasProfileRecord,moto||{});

  scrollSectionToTop();
}


window.addEventListener("focus",()=>{if(moto)loadCash();});
window.addEventListener("pageshow",()=>{if(moto)loadCash();});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&moto)loadCash();});
init();
