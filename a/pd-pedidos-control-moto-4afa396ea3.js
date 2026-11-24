/* Prueba de entrega (código o foto) · Cliente no contesta */
(function(){
  if(window.__pdPedMoto)return;window.__pdPedMoto=1;
  const $=id=>document.getElementById(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>{try{return db}catch(e){return window.db}};
  const OR=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const ME=()=>{try{return moto}catch(e){return null}};
  const ref=id=>'#'+String(id||'').slice(0,8).toUpperCase();
  const tel=t=>{const d=String(t||'').replace(/\D/g,'');if(!d)return '';return d.startsWith('51')?d:(d.length===9?'51'+d:d)};
  const aviso=t=>(window.pdAvisoMoto||window.pdAviso||alert)(t);
  const ESPERA=10;
  function hoja(titulo,html){
    let v=$('pdpeVelo');if(v)v.remove();v=document.createElement('div');v.id='pdpeVelo';v.className='pdsmVelo';
    v.innerHTML='<div class="pdsmHoja" role="dialog" aria-modal="true" aria-label="'+E(titulo)+'"><div class="pdsmTop"><strong>'+E(titulo)+'</strong><button type="button" class="pdsmX" aria-label="Cerrar">×</button></div>'+html+'</div>';
    document.body.appendChild(v);return v;
  }
  async function subir(file,pref){
    const {data:u}=await D().auth.getUser();const uid=u&&u.user&&u.user.id;if(!uid)throw new Error('Tu sesión expiró.');
    if(!/^image\//.test(file.type)||file.size>10*1024*1024)throw new Error('La foto debe ser una imagen de máximo 10 MB.');
    const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type]||'jpg';const path=uid+'/'+pref+'-'+Date.now()+'.'+ext,b=D().storage.from('fotos-motorizados');
    const up=await b.upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(up.error)throw new Error('No se pudo subir la foto: '+up.error.message);
    return b.getPublicUrl(path)?.data?.publicUrl||null;
  }
  function foto(){return new Promise(res=>{const i=document.createElement('input');i.type='file';i.accept='image/*';i.setAttribute('capture','environment');i.setAttribute('data-pd-cloud','1');i.style.display='none';document.body.appendChild(i);i.addEventListener('change',()=>{const f=i.files&&i.files[0];i.remove();res(f||null)});i.click()})}

  /* ---------- 1. Prueba de entrega ---------- */
  function pedirPrueba(o){return new Promise(res=>{
    const v=hoja('Confirma la entrega','<p class="pdpeTx">Pídele al cliente su <b>código de entrega</b> de 4 números. Lo ve en el seguimiento de su pedido.</p><input id="pdpeCod" class="pdpeCod" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="• • • •"><p class="pdpeMsg" id="pdpeMsg"></p><button type="button" class="btn" id="pdpeOk">Confirmar entrega</button><button type="button" class="pdpeAlt" id="pdpeFoto">El cliente no tiene el código: tomar foto de la entrega</button>');
    let hecho=false;const fin=r=>{if(hecho)return;hecho=true;v.remove();res(r)};
    v.querySelector('.pdsmX').onclick=()=>fin(false);v.addEventListener('click',e=>{if(e.target===v)fin(false)});
    const inp=$('pdpeCod'),msg=$('pdpeMsg');setTimeout(()=>inp.focus(),80);
    inp.addEventListener('input',()=>{inp.value=inp.value.replace(/\D/g,'').slice(0,4);msg.textContent=''});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')$('pdpeOk').click()});
    $('pdpeOk').onclick=async()=>{const c=inp.value;if(c.length!==4){msg.textContent='Escribe los 4 números.';return}
      const b=$('pdpeOk');b.disabled=true;b.textContent='Verificando…';
      try{const r=await D().rpc('verificar_entrega',{p_pedido:o.id,p_codigo:c,p_foto:null});
        if(r.error){if(/function|does not exist|schema cache/i.test(r.error.message))return fin(true);throw r.error}
        if(r.data==='ok'||r.data==='sin_codigo')return fin(true);
        msg.textContent=r.data==='incorrecto'?'Código incorrecto. Pídeselo otra vez al cliente.':'No se pudo verificar ('+r.data+').';
      }catch(err){msg.textContent='No se pudo verificar: '+(err.message||err)}
      b.disabled=false;b.textContent='Confirmar entrega'};
    $('pdpeFoto').onclick=async()=>{const f=await foto();if(!f)return;const b=$('pdpeFoto');b.disabled=true;b.textContent='Subiendo foto…';
      try{const url=await subir(f,'entrega');const r=await D().rpc('verificar_entrega',{p_pedido:o.id,p_codigo:null,p_foto:url});
        if(r.error&&!/function|does not exist|schema cache/i.test(r.error.message))throw r.error;return fin(true)}
      catch(err){msg.textContent=err.message||String(err);b.disabled=false;b.textContent='El cliente no tiene el código: tomar foto de la entrega'}};
  })}
  function envolver(){
    const orig=window.deliverOrder;if(typeof orig!=='function'||orig.__pdpe)return false;
    const w=async function(id){
      const o=OR().find(x=>String(x.id)===String(id));
      if(!o||o.entrega_verificada||!o.negocio_id||(String(o.tipo_servicio||'')==='encomienda'&&(o.guia_url||o.agencia_id)))return orig.apply(this,arguments);
      const cola=leerCola(),enCola=cola.find(x=>String(x.id)===String(id));
      if(enCola&&navigator.onLine){const r=await D().rpc('verificar_entrega',{p_pedido:o.id,p_codigo:enCola.codigo,p_foto:null}).catch(e=>({error:e}));
        if(!r.error&&r.data==='incorrecto'){guardarCola(cola.filter(x=>x!==enCola));aviso('El código que anotaste sin señal para '+ref(o.id)+' es incorrecto. Pídeselo de nuevo al cliente.');return}
        guardarCola(cola.filter(x=>x!==enCola));return orig.apply(this,arguments)}
      if(!navigator.onLine){const c=await pedirOffline(o);if(!c)return;guardarCola(cola.filter(x=>String(x.id)!==String(id)).concat([{id:String(id),codigo:c,t:Date.now()}]));pintarCola();aviso('Sin señal: la entrega de '+ref(o.id)+' quedó guardada y se enviará sola cuando vuelva el internet.');return}
      const okp=await pedirPrueba(o);if(!okp)return;
      o.entrega_verificada=o.entrega_verificada||'codigo';
      return orig.apply(this,arguments);
    };w.__pdpe=1;w.__orig=orig;window.deliverOrder=w;return true;
  }
  /* --- Modo sin señal: cola de entregas --- */
  const KC='pidemas-moto-entregas-pendientes';
  function leerCola(){try{return JSON.parse(localStorage.getItem(KC)||'[]')}catch(e){return []}}
  function guardarCola(c){try{localStorage.setItem(KC,JSON.stringify(c))}catch(e){}pintarCola()}
  function pedirOffline(o){return new Promise(res=>{
    const v=hoja('Sin señal','<p class="pdpeTx">No hay internet. Escribe el <b>código de entrega</b> del cliente y la entrega se enviará sola cuando vuelva la señal.</p><input id="pdpeCodOff" class="pdpeCod" inputmode="numeric" maxlength="4" placeholder="• • • •"><p class="pdpeMsg" id="pdpeMsgOff"></p><button type="button" class="btn" id="pdpeOkOff">Guardar entrega</button>');
    let hecho=false;const fin=r=>{if(hecho)return;hecho=true;v.remove();res(r)};v.querySelector('.pdsmX').onclick=()=>fin(null);v.addEventListener('click',e=>{if(e.target===v)fin(null)});
    const i=$('pdpeCodOff');i.oninput=()=>{i.value=i.value.replace(/\D/g,'').slice(0,4)};setTimeout(()=>i.focus(),80);
    $('pdpeOkOff').onclick=()=>{if(i.value.length!==4){$('pdpeMsgOff').textContent='Escribe los 4 números.';return}fin(i.value)};
  })}
  function pintarCola(){const c=leerCola();let b=$('pdpeCola');if(!c.length){if(b)b.remove();return}
    if(!b){b=document.createElement('div');b.id='pdpeCola';b.className='pdpeCola';document.body.appendChild(b)}
    b.textContent=(navigator.onLine?'Enviando ':'Sin señal · ')+c.length+' entrega'+(c.length===1?'':'s')+' pendiente'+(c.length===1?'':'s')+(navigator.onLine?'…':' de enviar')}
  let enviando=false;
  async function enviarCola(){if(enviando||!navigator.onLine)return;const c=leerCola();if(!c.length)return;enviando=true;pintarCola();
    try{for(const x of c){try{await window.deliverOrder(x.id)}catch(e){}}}finally{enviando=false;pintarCola()}}
  window.addEventListener('online',()=>{pintarCola();setTimeout(enviarCola,1500)});window.addEventListener('offline',pintarCola);
  setInterval(enviarCola,30000);setTimeout(()=>{pintarCola();enviarCola()},4000);
  if(!envolver()){const t=setInterval(()=>{if(envolver())clearInterval(t)},500)}

  /* ---------- 2. Cliente no contesta ---------- */
  const restante=o=>{const t=new Date(o.no_contesta_desde).getTime();return Number.isFinite(t)?Math.max(0,t+ESPERA*60000-Date.now()):null};
  async function noContesta(o){
    const now=new Date().toISOString();
    if(!o.no_contesta_desde){const r=await D().from('pedidos').update({no_contesta_desde:now}).eq('id',o.id).eq('motorizado_id',ME()?.id);if(r.error&&!/no_contesta/.test(r.error.message)){aviso('No se pudo registrar: '+r.error.message);return}o.no_contesta_desde=now}
    pintarEspera(o);
  }
  let tick=null;
  function pintarEspera(o){
    const w=tel(o.telefono_receptor||o.telefono_cliente);
    const msg='Hola, soy '+(String(ME()?.nombre_completo||'tu motorizado').split(' ')[0])+' de *Pidemás Delivery*. Estoy afuera con tu pedido '+ref(o.id)+' en '+(o.direccion_entrega||'tu dirección')+'. Por favor contéstame o sal a recibirlo. Esperaré '+ESPERA+' minutos.';
    const v=hoja('El cliente no contesta','<p class="pdpeTx">Llámalo y escríbele. Si en '+ESPERA+' minutos no responde, podrás marcar el pedido como <b>no entregado</b>. Pidemás ya ve que estás esperando.</p><div class="pdpeTimer" id="pdpeTimer">--:--</div>'
      +(w?'<a class="pdpeWa" target="_blank" rel="noopener" href="https://wa.me/'+w+'?text='+encodeURIComponent(msg)+'">Escribir por WhatsApp</a><a class="pdpeAlt" href="tel:+'+w+'">Llamar al cliente</a>':'<p class="pdpeMsg">Este pedido no tiene teléfono del cliente.</p>')
      +'<label class="pdpeLbl">Motivo<select id="pdpeMot"><option>No contesta y no sale a recibir</option><option>Dirección incorrecta o no existe</option><option>El cliente rechazó el pedido</option><option>Otro</option></select></label><input id="pdpeDet" class="pdpeIn" maxlength="120" placeholder="Detalle (opcional)"><button type="button" class="btn" id="pdpeNo" disabled>Marcar como no entregado</button><p class="pdpeMsg" id="pdpeMsg2"></p>');
    const cerrar=()=>{clearInterval(tick);v.remove()};v.querySelector('.pdsmX').onclick=cerrar;v.addEventListener('click',e=>{if(e.target===v)cerrar()});
    const upd=()=>{const r=restante(o);const el=$('pdpeTimer'),b=$('pdpeNo');if(!el)return clearInterval(tick);if(r==null){el.textContent='';b.disabled=false;return}
      const s=Math.ceil(r/1000);el.textContent=s?String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'):'Tiempo cumplido';el.classList.toggle('fin',!s);b.disabled=!!s};
    clearInterval(tick);upd();tick=setInterval(upd,1000);
    $('pdpeNo').onclick=async()=>{const mot=$('pdpeMot').value,det=($('pdpeDet').value||'').trim();const motivo=[mot!=='Otro'?mot:'',det].filter(Boolean).join(' · ')||'Cliente no contesta';
      if(!(await pdConfirmar('¿Marcar el pedido '+ref(o.id)+' como NO ENTREGADO?\nMotivo: '+motivo+'\nRegresa con el pedido según te indique Pidemás.')))return;
      const b=$('pdpeNo');b.disabled=true;b.textContent='Guardando…';
      const base={estado:'cancelado',cancelado_en:new Date().toISOString(),observaciones:[o.observaciones||'','NO ENTREGADO POR MOTORIZADO: '+motivo].filter(Boolean).join(' | ')};
      let r=await D().from('pedidos').update(Object.assign({},base,{cancelado_por:'motorizado',no_entregado:true,motivo_cancelacion:motivo})).eq('id',o.id).eq('motorizado_id',ME()?.id);
      if(r.error&&/cancelado_por|no_entregado|motivo_cancelacion|schema cache/.test(r.error.message))r=await D().from('pedidos').update(base).eq('id',o.id).eq('motorizado_id',ME()?.id);
      if(r.error){$('pdpeMsg2').textContent='No se pudo guardar: '+r.error.message;b.disabled=false;b.textContent='Marcar como no entregado';return}
      cerrar();try{const mm=$('pidemasOrderFullModal');if(mm)mm.classList.remove('is-open');document.body.classList.remove('pidemas-order-modal-lock')}catch(_){}
      (window.pdExito||aviso)('Pedido marcado como no entregado. Pidemás fue avisado.');try{await loadOrders()}catch(_){}};
  }
  function boton(){
    const m=$('pidemasOrderFullModal');if(!m||!m.getClientRects().length)return;
    const id=String(m.dataset.orderId||'');const o=OR().find(x=>String(x.id)===id);const acts=m.querySelector('.pidemas-order-modal-actions');
    const ya=m.querySelector('#pdpeNcBtn');
    if(!o||!acts||String(o.estado)!=='en_entrega'){if(ya)ya.remove();return}
    if(ya&&ya.dataset.id===id)return;if(ya)ya.remove();
    const b=document.createElement('button');b.type='button';b.id='pdpeNcBtn';b.className='pdpeNc';b.dataset.id=id;b.textContent=o.no_contesta_desde?'Cliente no contesta · ver espera':'El cliente no contesta';
    b.onclick=()=>noContesta(o);acts.appendChild(b);
  }
  setInterval(boton,700);
})();
