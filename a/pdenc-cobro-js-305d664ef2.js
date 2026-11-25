(function(){
  if(window.__pdEncCobro)return;window.__pdEncCobro=true;
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'S/ '+(Number(n)||0).toFixed(2);
  const list=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const isEnc=o=>String(o?.tipo_servicio||'').toLowerCase().includes('encomienda');
  function momento(o){const m=String(o.pago_servicio_momento||'').toLowerCase();if(m)return m;if(o.pago_confirmado===true)return 'pagado';return String(o.metodo_pago||'').toLowerCase()==='yape'?'recojo_yape':'recojo_efectivo'}
  const isRec=o=>String(o?.tipo_servicio||'').toLowerCase().includes('recojo');
  

  const alRecoger=o=>{if(isEnc(o)){const m=momento(o);return m==='recojo_efectivo'||m==='recojo_yape'}if(isRec(o)){const m=String(o.pago_servicio_momento||'').toLowerCase();return m==='recojo_efectivo'||m==='recojo_yape'}return false};
  window.pdCobraAlRecoger=alRecoger;
  const pendiente=o=>{const s=String(o.estado||'').toLowerCase();return alRecoger(o)&&o.pago_confirmado!==true&&Number(o.total)>0&&!['asignado','entregado','cancelado'].includes(s)};
  const ST=window.__peCobroState=window.__peCobroState||{};
  function html(o){
    const st=ST[o.id]||(ST[o.id]={modo:(isEnc(o)?momento(o):String(o.pago_servicio_momento||'').toLowerCase())==='recojo_yape'?'yape':'efectivo',monto:''});
    let pc=null;try{pc=typeof extractCashPayment==='function'?extractCashPayment(o.observaciones,o.total):null}catch(e){}
    if(st.monto===''&&pc&&pc.paid!=null)st.monto=String(Number(pc.paid).toFixed(2));
    return `<div class="peCobro pdCobroUI" data-id="${E(o.id)}"><span class="k">Cobro al recoger</span><h4>Cobra ${money(o.total)}</h4>
      <p>${isEnc(o)?'Cóbrale a quien envía antes de llevar los paquetes a la agencia.':'Paga quien envía'+(o.nombre_remitente?' ('+E(o.nombre_remitente)+')':'')+': cóbrale al recoger, antes de salir a entregar.'}</p>
      ${pc&&pc.paid!=null?`<div class="pc">Paga con ${money(pc.paid)} · lleva <b>${money(Math.max(0,Number(pc.paid)-Number(o.total)))}</b> de vuelto</div>`:''}
      <div class="seg"><button type="button" data-m="efectivo" class="${st.modo==='efectivo'?'on':''}">Efectivo</button><button type="button" data-m="yape" class="${st.modo==='yape'?'on':''}">Yape</button></div>
      ${st.modo==='efectivo'?`<input type="number" inputmode="decimal" min="0" step="0.01" class="peCobroMonto" placeholder="¿Con cuánto te paga? (vacío = exacto)" aria-label="Monto que entrega el cliente"><div class="vu"></div>`:`<button type="button" class="qr" onclick="showYapeQr('${E(o.id)}')">Mostrar QR de Yape</button><p>Revisa en el celular del cliente que el Yape se hizo y guarda la captura para el cierre de caja.</p>`}
      <button type="button" class="go">${st.modo==='efectivo'?'Confirmar cobro de '+money(o.total):'Ya pagó por Yape · confirmar cobro'}</button><span class="msg"></span></div>`;
  }
  function vuelto(box,o){
    const i=box.querySelector('.peCobroMonto'),v=box.querySelector('.vu');if(!i||!v)return true;
    const raw=String(i.value||'').trim(),p=raw===''?Number(o.total):Number(raw.replace(',','.'));
    if(!(p>=Number(o.total)-0.0001)){v.className='vu err';v.textContent='El cliente debe pagar al menos '+money(o.total);return false}
    v.className='vu';v.textContent='Vuelto: '+money(p-Number(o.total));return true;
  }
  function decorate(){
    const modal=document.getElementById('pidemasOrderFullModal');if(!modal)return;
    const id=String(modal.dataset.orderId||'');const o=list().find(x=>String(x.id)===id);
    const content=modal.querySelector('#pidemasOrderFullModalContent');if(!content)return;
    let box=content.querySelector(':scope > .peCobro');
    if(!o||!pendiente(o)){box&&box.remove();return}
    

    content.querySelectorAll('.pfCards .pfCard').forEach(c=>{if(/^\s*Cobra /.test(c.textContent))c.style.display='none'});
    const st=ST[o.id]||{};const key=o.id+'|'+(st.modo||'')+'|'+o.total;
    if(box&&box.dataset.key===key)return;
    const w=document.createElement('div');w.innerHTML=html(o);const nb=w.firstElementChild;nb.dataset.key=o.id+'|'+ST[o.id].modo+'|'+o.total;
    

    if(box)box.replaceWith(nb);else{const pay=content.querySelector(':scope > .pdMPay');if(pay)pay.before(nb);else{const ref=content.querySelector(':scope > .pfCards')||content.querySelector(':scope > .pdMBand');ref?ref.after(nb):content.prepend(nb)}}
    const i=nb.querySelector('.peCobroMonto');if(i){i.value=ST[o.id].monto||'';i.addEventListener('input',()=>{ST[o.id].monto=i.value;vuelto(nb,o)});vuelto(nb,o)}
  }
  async function registrar(box,o){
    const st=ST[o.id],msg=box.querySelector('.msg'),btn=box.querySelector('.go')||document.createElement('button');msg.textContent='';
    const total=Number(o.total)||0;let paga=total;
    if(st.modo==='efectivo'){if(!vuelto(box,o))return;const raw=String(box.querySelector('.peCobroMonto').value||'').trim();paga=raw===''?total:Number(raw.replace(',','.'))}
    let vueltoDe='';if(st.modo==='efectivo'&&paga-total>0.004&&typeof window.pdElegirVuelto==='function'){vueltoDe=await window.pdElegirVuelto(Math.round((paga-total)*100)/100,total,paga);if(!vueltoDe)return}
    if(!(await pdConfirmar(st.modo==='efectivo'?`¿Registrar cobro de ${money(total)} en efectivo?`:`¿Confirmas que el cliente ya pagó ${money(total)} por Yape al QR de Pidemás? Revisa la constancia en su celular.`)))return;
    btn.disabled=true;btn.textContent='Registrando…';
    try{
      const upd={pago_confirmado:true,metodo_pago:st.modo,monto_recibido:Math.round(paga*100)/100};
      const {error:ue}=await db.from('pedidos').update(upd).eq('id',o.id).eq('motorizado_id',moto.id);if(ue)throw ue;
      try{await db.from('cobros').upsert({pedido_id:o.id,motorizado_id:moto.id,monto:total,metodo_pago:st.modo,confirmado:true,confirmado_en:new Date().toISOString()},{onConflict:'pedido_id'})}catch(_){}
      if(st.modo==='efectivo'){
        const {data:prev}=await db.from('movimientos_caja').select('id').eq('motorizado_id',moto.id).eq('pedido_id',o.id).eq('tipo','ingreso').not('descripcion','ilike','INGRESO MANUAL%').not('descripcion','ilike','EFECTIVO PARA %').limit(1);
        if(!(prev&&prev.length)){
          const {error:me}=await db.from('movimientos_caja').insert({motorizado_id:moto.id,pedido_id:o.id,tipo:'ingreso',monto:Math.round((vueltoDe==='propio'?paga:total)*100)/100,
            descripcion:(isEnc(o)?'Cobro de encomienda':'Cobro de recojo')+' · total S/ '+total.toFixed(2)+' · cliente pagó con S/ '+paga.toFixed(2)+' · vuelto entregado S/ '+Math.max(0,paga-total).toFixed(2)+(vueltoDe?(vueltoDe==='caja'?' · VUELTO DE CAJA':' · VUELTO CON DINERO PROPIO'):'')});
          if(me)throw me;
        }
      }
      Object.assign(o,upd);delete ST[o.id];
      try{if(typeof loadOrders==='function')await loadOrders()}catch(_){}
      try{if(typeof window.loadCash==='function')await window.loadCash()}catch(_){}
      decorate();
    }catch(err){msg.textContent='No se pudo registrar el cobro: '+(err?.message||err);btn.disabled=false;btn.textContent=st.modo==='efectivo'?'Confirmar cobro de '+money(o.total):'Ya pagó por Yape · confirmar cobro'}
  }
  document.addEventListener('click',e=>{
    const box=e.target.closest&&e.target.closest('#pidemasOrderFullModal .peCobro');if(!box)return;
    const o=list().find(x=>String(x.id)===String(box.dataset.id));if(!o)return;
    const m=e.target.closest('.seg button[data-m]');if(m){ST[o.id].modo=m.dataset.m;decorate();return}
    if(e.target.closest('.go'))registrar(box,o);
  });
  

  const so=window.startOrder;
  if(typeof so==='function')window.startOrder=async function(id){const o=list().find(x=>String(x.id)===String(id));
    if(o&&pendiente(o)&&(window.pdAvisoMoto?(pdAvisoMoto('Primero registra el cobro de '+money(o.total)+'. Es obligatorio antes de salir.','.peCobro'),true):!(await pdConfirmar(`Aún no registras el cobro de ${money(o.total)}.\n¿Seguir sin cobrar?`)))){const b=document.querySelector('#pidemasOrderFullModal .peCobro');b&&b.scrollIntoView({behavior:'smooth',block:'center'});return}
    return so.apply(this,arguments)};
  function boton(){
    const modal=document.getElementById('pidemasOrderFullModal');if(!modal)return;
    const acts=modal.querySelector('.pidemas-order-modal-actions');if(!acts)return;
    const o=list().find(x=>String(x.id)===String(modal.dataset.orderId||''));
    let b=acts.querySelector('.peCobroGo');
    if(!o||!pendiente(o)){b&&b.remove();return}
    const yp=(ST[o.id]||{}).modo==='yape';
    const txt=yp?'Ya pagó por Yape · confirmar '+money(o.total):'Confirmar cobro de '+money(o.total);
    if(!b){b=document.createElement('button');b.type='button';b.className='peCobroGo';
      

      b.addEventListener('click',()=>{const x=document.querySelector('#pidemasOrderFullModal .peCobro');if(!x)return;const oo=list().find(y=>String(y.id)===String(x.dataset.id));if(!oo)return;
        if(!x.getBoundingClientRect().height||x.getBoundingClientRect().top<0||x.getBoundingClientRect().bottom>innerHeight)x.scrollIntoView({behavior:'smooth',block:'center'});
        registrar(x,oo).then(()=>{b.disabled=false})});
      acts.prepend(b)}
    if(b.textContent!==txt)b.textContent=txt;
  }
  let t=null;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{try{decorate();boton()}catch(e){}},80)}).observe(document.body,{childList:true,subtree:true});
})();
