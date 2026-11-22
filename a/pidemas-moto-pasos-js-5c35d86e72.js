(function(){
  const PASOS={
    compra:['Aceptado','Compra','En camino','Cobro','Entregado'],
    recojo:['Aceptado','Recojo','En camino','Cobro','Entregado'],
    pedido:['Aceptado','Local','En camino','Cobro','Entregado']
  };
  const svc=o=>{const t=String(o&&o.tipo_servicio||'').toLowerCase();return t.includes('encomienda')?'enc':t.includes('compra')?'compra':t.includes('recojo')?'recojo':'pedido'};
  const URL_RE=/https?:\/\/\S+/g;
  const pedido=id=>{try{return (typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===String(id))}catch(e){return null}};
  function pasos(modal,o){
    const s=svc(o),L=PASOS[s];if(!L)return;
    const st=modal.querySelector('.pfSteps');if(!st)return;
    const labs=st.querySelectorAll('.pfLabels span');labs.forEach((x,i)=>{if(L[i]&&x.textContent!==L[i])x.textContent=L[i]});
    const b=st.querySelector('.pfStepsTop b');const cur=[...labs].findIndex(x=>x.classList.contains('cur'));
    if(b&&cur>=0&&L[cur]&&b.textContent!==L[cur]&&b.textContent!=='Nuevo pedido')b.textContent=L[cur];
  }
   
  function lugarCompra(modal,o){
    modal.querySelectorAll('.pdMStop').forEach(stp=>{
      const k=stp.querySelector('.pdMKicker'),n=stp.querySelector('.pdMName');if(!k||!n||!/compra/i.test(k.textContent))return;
      const txt=n.textContent;const dat=String(o&&(o.direccion_recojo||o.ubicacion_recojo||o.link_recojo)||'');
      let u=(txt.match(URL_RE)||[])[0]||(dat.match(URL_RE)||[])[0];
      if(!u&&o&&Number.isFinite(Number(o.latitud_recojo))&&o.latitud_recojo!=null)u='https://www.google.com/maps?q='+o.latitud_recojo+','+o.longitud_recojo;
      if(!u)return;
      const nombre=txt.replace(URL_RE,'').replace(/[\s·\-–]+$/,'').replace(/^[\s·\-–]+/,'').trim();
      const nn=nombre||'Lugar marcado en el mapa';if(n.textContent!==nn)n.textContent=nn;
      const body=stp.querySelector('.pdMStopBody')||stp;let ch=body.querySelector('.pdMChips');
      if(!ch){ch=document.createElement('div');ch.className='pdMChips';body.appendChild(ch)}
      if(!ch.querySelector('[data-pdps-mapa]')){const a=document.createElement('a');a.className='pdMChip';a.href=u;a.target='_blank';a.rel='noopener';a.dataset.pdpsMapa='1';a.textContent='Ver ubicación';a.onclick=e=>e.stopPropagation();ch.appendChild(a)}
    });
  }
   
   
  const NOMBRE={efectivo:'Efectivo',yape:'Yape'};
  async function cambiarPago(o,nuevo){
    const antes=String(o.metodo_pago||'').toLowerCase();if(antes===nuevo)return;
    const ok=(await pdConfirmar('¿El cliente pagará con '+NOMBRE[nuevo]+' en vez de '+(NOMBRE[antes]||antes)+'?\n\nSe avisará a Administración'+(o.negocio_id?' y al negocio':'')+' y el cobro se registrará con '+NOMBRE[nuevo]+'.'));
    if(!ok)return;
    const hora=new Date().toLocaleTimeString('es-PE',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/Lima'});
    let obs=String(o.observaciones||'');
    if(nuevo==='yape')obs=obs.replace(/\s*\|?\s*__PIDEMAS_PAGO_EFECTIVO__\{[^}]*\}/,'');  
    obs=[obs,'CAMBIO DE PAGO: '+(NOMBRE[antes]||antes)+' → '+NOMBRE[nuevo]+' (lo informó el motorizado a las '+hora+')'].filter(Boolean).join(' | ');
    const c=(()=>{try{return db}catch(e){return window.db}})();if(!c)return;
    const patchPago={metodo_pago:nuevo,observaciones:obs};
    /* Si iba a pagar con el Yape del negocio y paga en efectivo, el dinero lo tiene el motorizado: el pedido pasa a «efectivo» para que Pidemás le pague los productos al negocio */
    if(String(o.pago_acordado||'')==='yape_negocio'&&nuevo==='efectivo'){patchPago.pago_acordado='efectivo';patchPago.yape_negocio_estado=null;patchPago.observaciones=obs+' | YA NO PAGA CON EL YAPE DEL NEGOCIO: PAGA EN EFECTIVO AL MOTORIZADO'}
    let q=c.from('pedidos').update(patchPago).eq('id',o.id);
    try{if(typeof moto!=='undefined'&&moto&&moto.id)q=q.eq('motorizado_id',moto.id)}catch(e){}
    window.__pdCambioPropio={code:'#'+String(o.id).slice(0,8).toUpperCase(),t:Date.now()};
    const {error}=await q;
    if(error){(window.pdAvisoMoto||alert)('No se pudo cambiar el método de pago: '+error.message);return}
    o.metodo_pago=nuevo;o.observaciones=patchPago.observaciones;if('pago_acordado' in patchPago){o.pago_acordado=patchPago.pago_acordado;o.yape_negocio_estado=null}
    try{const n=(typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===String(o.id));if(n){n.metodo_pago=nuevo;n.observaciones=obs}}catch(e){}
    try{if(typeof window.loadOrders==='function')await window.loadOrders()}catch(e){}
    try{const modal=document.getElementById('pidemasOrderFullModal');const card=document.querySelector('.order[data-order-id="'+o.id+'"]');if(modal&&card&&typeof window.populateFullOrderModal==='function')window.populateFullOrderModal(card,modal)}catch(e){}
  }
   
  new MutationObserver(()=>{const c=window.__pdCambioPropio;if(!c||Date.now()-c.t>20000)return;document.querySelectorAll('#pdAlerts .pdA').forEach(a=>{const t=a.querySelector('.pdATitle')?.textContent||'';if(t.includes(c.code)&&/modific/i.test(t))a.remove()})}).observe(document.documentElement,{childList:true,subtree:true});
  function selectorPago(modal,o){
    const box=modal.querySelector('#pidemasOrderFullModalContent .pdCobroEnt');
    const m=String(o&&o.metodo_pago||'').toLowerCase();
    if(!box||!o||o.pago_confirmado===true||!NOMBRE[m]){return}
    let sel=box.querySelector(':scope > .pdCambioPago');
    if(!sel){sel=document.createElement('div');sel.className='pdCambioPago';
      sel.innerHTML='<label>¿Cómo paga el cliente?</label><div class="seg"><button type="button" data-m="efectivo">Efectivo</button><button type="button" data-m="yape">Yape</button></div><small>Si el cliente cambió de idea, elige cómo te paga realmente. Se avisa a Administración y tu caja queda bien.</small>';
      const h=box.querySelector(':scope > h4');h?h.after(sel):box.prepend(sel);
      sel.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b||b.classList.contains('on'))return;const id=modal.dataset.orderId;const oo=pedido(id);if(oo)cambiarPago(oo,b.dataset.m)});
    }
    sel.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  }
  function casillas(modal){
    const content=modal.querySelector('#pidemasOrderFullModalContent');if(!content)return;
    const lista=[...content.querySelectorAll('.pdCompraBox,.pdCobroEnt,.peCobro,.pdCobroUI,section.recojoInfoCard,.peWrap')].filter(x=>!x.closest('.pdPaso')||x.classList.contains('pdPaso'));
    lista.forEach(b=>{
      b.classList.add('pdPaso');
      if(b.matches('.peWrap')&&!b.querySelector(':scope > .k')){b.insertAdjacentHTML('afterbegin','<span class="k">Paso · Guía y clave</span><h4>Registra la guía de cada paquete</h4>')}
      if(b.matches('section.recojoInfoCard')&&!b.querySelector(':scope > .k')){const k=document.createElement('span');k.className='k';k.textContent='Paso · Agencia y guía';b.prepend(k)}
      const k=b.querySelector(':scope > .k');if(k){const tx=k.textContent.trim();const nuevo=/^paso de la compra$/i.test(tx)?'Paso · Compra':/^cobro/i.test(tx)?'Paso · '+tx.charAt(0).toUpperCase()+tx.slice(1).toLowerCase():null;if(nuevo&&tx!==nuevo)k.textContent=nuevo}
      const h=b.matches('section.recojoInfoCard')&&b.querySelector(':scope > h4');if(h&&/gesti[oó]n de agencia/i.test(h.textContent))h.textContent='Paga el envío y registra la guía';
    });
     
    const top=lista.filter(b=>b.parentElement===content);
    const pw=content.querySelector(':scope > .pdpaW');const off=pw&&content.firstElementChild===pw?1:0;
    if(!top.every((b,i)=>content.children[i+off]===b))for(let i=top.length-1;i>=0;i--){if(pw&&pw.parentNode===content)pw.after(top[i]);else content.prepend(top[i])}
  }
  function todo(){
    const modal=document.getElementById('pidemasOrderFullModal');if(!modal||modal.hidden)return;
    const o=pedido(modal.dataset.orderId);
    try{if(o)pasos(modal,o)}catch(e){}
    try{lugarCompra(modal,o)}catch(e){}
    try{casillas(modal)}catch(e){}
    try{if(o)selectorPago(modal,o)}catch(e){}
  }
  let q=false;const pronto=()=>{if(q)return;q=true;queueMicrotask(()=>{q=false;todo()})};
  const mo=new MutationObserver(pronto);
  const engancha=()=>{const m=document.getElementById('pidemasOrderFullModal');if(m&&!m.__pdps){m.__pdps=true;mo.observe(m,{childList:true,subtree:true})}};
  setInterval(()=>{engancha();todo()},1200);engancha();
  window.pdMotoPasos=todo;
})();

 
(function(){
  window.__pdPropios=window.__pdPropios||{};
  const marcar=v=>{if(v!=null)window.__pdPropios[String(v)]=Date.now()};
  window.pdEsPropio=function(id){const c=window.__pdCambioPropio;if(c&&Date.now()-c.t<60000&&('#'+String(id).slice(0,8).toUpperCase())===c.code)return true;const t=window.__pdPropios[String(id)];return !!t&&Date.now()-t<60000};
  const envolver=()=>{const d=(()=>{try{return db}catch(e){return window.db}})();if(!d||!d.from)return false;if(d.__pdPropio)return true;
    const from=d.from.bind(d);d.__pdPropio=true;
    d.from=function(tabla){const b=from(tabla);if(tabla!=='pedidos'||!b||!b.update)return b;const up=b.update.bind(b);
      b.update=function(){const r=up.apply(null,arguments);if(r&&r.eq){const eq=r.eq.bind(r);r.eq=function(k,v){if(k==='id')marcar(v);return eq.apply(null,arguments)}}return r};return b};
    return true};
  if(!envolver()){const iv=setInterval(()=>{if(envolver())clearInterval(iv)},200);setTimeout(()=>clearInterval(iv),20000)}
})();
