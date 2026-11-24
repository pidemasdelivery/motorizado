(function(){
 const $=id=>document.getElementById(id);let checking=false,blocked=false,watch=null,profileChannel=null;
 const originalEnter=window.enter;
 function showBlocked(tipo,rol){
   if(blocked)return;blocked=true;
   try{if(typeof window.locationTimer!=='undefined'&&window.locationTimer)clearInterval(window.locationTimer)}catch(e){}
   try{if(window.__pidemasDeliveryTimer)clearInterval(window.__pidemasDeliveryTimer)}catch(e){}
   try{if(typeof window.stopGPS==='function')window.stopGPS()}catch(e){}
   ['appView','nav','logout','notifTopButton','loginView'].forEach(id=>{const el=$(id);if(el)el.classList.add('hidden')});
   const overlay=$('pidemasSuspendedScreen');if(overlay){overlay.classList.toggle('ps-otraCuenta',tipo==='rol');overlay.style.display='flex'}
   if(tipo==='rol'){
     /* No es una suspensión: entró con una cuenta que no es de motorizado (negocio, administrador o cliente) */
     const nombres={negocio:'de negocio',admin:'de Pidemás',administrador:'de Pidemás',cliente:'de cliente'};
     const pill=document.querySelector('#pidemasSuspendedScreen .ps-pill'),h=$('pidemasSuspendedTitle'),pp=document.querySelector('#pidemasSuspendedScreen .ps-card > p'),out=$('pidemasSuspendedLogout');
     if(pill)pill.textContent='Cuenta '+(nombres[rol]||'sin acceso');
     if(h)h.textContent='Esta cuenta no es de motorizado';
     if(pp)pp.textContent=(rol&&nombres[rol]?'Entraste con una cuenta '+nombres[rol]+'. ':'')+'Este panel es solo para motorizados. Cierra sesión y entra con tu cuenta de motorizado.';
     if(out)out.textContent='Entrar con otra cuenta';
   }
   try{db.auth.signOut({scope:'local'})}catch(e){}
 }
 async function checkSuspension(){
   if(checking||blocked)return;checking=true;
   try{
     const {data:{session:current}}=await db.auth.getSession();
     if(!current){checking=false;return;}
     const {data,error}=await db.from('perfiles').select('rol,activo').eq('id',current.user.id).maybeSingle();
     if(error){console.warn('No se pudo verificar estado de cuenta:',error.message);checking=false;return;}
     /* Otra clase de cuenta (negocio, admin, cliente) o sin perfil: no es suspensión, es la cuenta equivocada */
     if(!data||data.rol!=='motorizado'){showBlocked('rol',data&&data.rol);checking=false;return;}
     if(data.activo!==true){showBlocked('suspendida');checking=false;return;}
     const {data:motoRow,error:motoError}=await db.from('motorizados').select('activo').eq('usuario_id',current.user.id).maybeSingle();
     if(!motoError&&motoRow&&motoRow.activo!==true)showBlocked('suspendida');
   }catch(e){console.warn('Verificación de suspensión temporalmente no disponible:',e)}
   checking=false;
 }
 

 if(typeof originalEnter==='function'){
   window.enter=async function(uid){await originalEnter(uid);await checkSuspension();};
 }
 function startWatch(){
   if(watch)clearInterval(watch);
   watch=setInterval(checkSuspension,5000);
   try{
     const {data:{subscription}}=db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(checkSuspension,100)});
     profileChannel=db.channel('pidemas-suspension-perfil').on('postgres_changes',{event:'UPDATE',schema:'public',table:'perfiles'},payload=>{if(payload?.new?.id===session?.user?.id&&payload.new.activo!==true)showBlocked('suspendida')}).subscribe();
   }catch(e){console.warn('Realtime de suspensión no disponible; se mantiene la comprobación periódica.',e)}
 }
 const salir=$('pidemasSuspendedLogout');if(salir)salir.addEventListener('click',async()=>{try{if(typeof db!=='undefined'&&db.auth)await db.auth.signOut({scope:'local'})}catch(e){}location.reload()});
 const contact=$('pidemasContactAdminBtn');if(contact)contact.addEventListener('click',()=>{
   let ph='986233533';try{const c=typeof window.pdYapeCfg==='function'?window.pdYapeCfg():null;if(c&&c.whatsapp_admin)ph=String(c.whatsapp_admin)}catch(_){}
   ph=ph.replace(/\D/g,'');if(ph.length===9)ph='51'+ph;
   const u='https://wa.me/'+ph+'?text='+encodeURIComponent('Hola, soy motorizado de Pidemás. Mi cuenta aparece suspendida, ¿me ayudas a reactivarla?');
   if(typeof window.pdOpenWhatsApp==='function')window.pdOpenWhatsApp(u);else window.location.href=u;
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startWatch,{once:true});else startWatch();
})();
