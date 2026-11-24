(function(){
  if(window.__pdFlowMoto)return; window.__pdFlowMoto=true;
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'S/ '+(Number(n)||0).toFixed(2);
  const ARROW='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#141413" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>';
  const LABELS=['Aceptado','Recojo','En camino','Cobro','Entregado'];
  const st=o=>String(o?.estado||'').toLowerCase().trim();
  const svcKey=o=>{const t=String(o?.tipo_servicio||'').toLowerCase();return t.includes('encomienda')?'enc':t.includes('compra')?'compra':t.includes('recojo')?'recojo':'pedido'};
  const isNegocio=o=>svcKey(o)==='pedido'&&!!o?.negocio_id;
  function stepIndex(o){
    const s=st(o);
    if(s==='asignado')return 0;
    if(['aceptado','pedido_aceptado','camino_recojo'].includes(s))return 1;
    if(['en_camino','camino_entrega'].includes(s))return 2;
    if(['en_entrega','confirmando_pago'].includes(s))return 3;
    if(s==='entregado')return 4;
    return 0;
  }
  const prepaid=o=>o?.pago_confirmado===true&&!(Number(o?.monto_recibido)>0);
  const hhmm=d=>d.toLocaleTimeString('es-PE',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/Lima'});

  function slider(label,green,onDone){
    const wrap=document.createElement('div');wrap.className='pfSlide'+(green?' green':'');
    wrap.innerHTML=`<button type="button" class="pfKnob" aria-label="${E(label)}">${ARROW.replace('#141413',green?'#067647':'#141413')}</button><span class="pfTxt">${E(label)}</span>`;
    const knob=wrap.querySelector('.pfKnob');let x0=null,dx=0,done=false;
    const max=()=>wrap.clientWidth-knob.offsetWidth-10;
    const set=v=>{knob.style.transform=`translateX(${v}px)`};
    const finish=()=>{if(done)return;done=true;set(max());wrap.classList.add('busy');wrap.querySelector('.pfTxt').textContent='Procesando…';Promise.resolve().then(onDone).catch(()=>{}).finally(()=>setTimeout(()=>{done=false;wrap.classList.remove('busy');knob.style.transition='transform .2s';set(0);wrap.querySelector('.pfTxt').textContent=label;setTimeout(()=>knob.style.transition='',220)},1800))};
    knob.addEventListener('pointerdown',e=>{if(done)return;x0=e.clientX;dx=0;knob.setPointerCapture(e.pointerId);knob.style.transition=''});
    knob.addEventListener('pointermove',e=>{if(x0===null)return;dx=Math.max(0,Math.min(max(),e.clientX-x0));set(dx)});
    const up=()=>{if(x0===null)return;x0=null;if(dx>=max()*0.8)finish();else{knob.style.transition='transform .2s';set(0);setTimeout(()=>knob.style.transition='',220)}};
    knob.addEventListener('pointerup',up);knob.addEventListener('pointercancel',up);
    knob.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();finish()}});
    knob.addEventListener('click',e=>e.preventDefault());
    return wrap;
  }

  async function marcarEnLocal(id){
    const now=new Date().toISOString();
    const {data,error}=await db.from('pedidos').update({en_local_en:now}).eq('id',id).eq('motorizado_id',moto.id).select('id,en_local_en').maybeSingle();
    if(error||!data){show($('appMsg'),'No se pudo marcar la llegada al local. '+(error?.message||'')+(/column/i.test(error?.message||'')?' (Falta correr el SQL de la etapa 2.)':''));return}
    const o=orders.find(x=>String(x.id)===String(id));if(o)o.en_local_en=now;
    await loadOrders();
  }

  const MOTIVOS=['El cliente no contesta','No encuentro la dirección','El negocio no tiene el pedido listo','Falta un producto','Tuve un accidente o problema con la moto','Otro problema'];
  function problema(id){
    document.getElementById('pfSheet')?.remove();
    const d=document.createElement('div');d.id='pfSheet';
    d.innerHTML=`<div class="pfBox" role="dialog" aria-label="Reportar un problema"><span class="pfGrip"></span><h3>¿Qué pasó?</h3>${MOTIVOS.map(m=>`<button type="button" data-m="${E(m)}">${E(m)}</button>`).join('')}<button type="button" class="pfCancel">Cancelar</button></div>`;
    d.addEventListener('click',async e=>{
      if(e.target===d||e.target.closest('.pfCancel')){d.remove();return}
      const b=e.target.closest('[data-m]');if(!b)return;
      let motivo=b.dataset.m;
      if(motivo==='Otro problema'){const t=(await pdPedir('Describe el problema brevemente:'));if(!t)return;motivo=t.slice(0,200)}
      d.remove();
      await enviarProblema(id,motivo);
    });
    document.body.appendChild(d);
  }
  async function enviarProblema(id,motivo){
      

      try{
        const o0=orders.find(x=>String(x.id)===String(id))||{};
        const cfgQ=typeof window.pdYapeCfg==='function'?window.pdYapeCfg():null;
        let ph=String(cfgQ&&cfgQ.whatsapp_admin||'986233533').replace(/\D/g,'');if(ph.length===9)ph='51'+ph;
        const tipo=({recojo_entrega:'recojo y entrega',compra:'compra',encomienda:'encomienda'})[String(o0.tipo_servicio||'').toLowerCase()]||'pedido de tienda';
        const txt=['*PIDEMÁS · PROBLEMA EN PEDIDO*','Pedido #'+String(id).slice(0,8).toUpperCase()+' ('+tipo+')','Motorizado: '+String(moto?.nombre_completo||'').trim(),'Problema: '+motivo,o0.nombre_cliente?'Cliente: '+o0.nombre_cliente+(o0.telefono_cliente?' · '+o0.telefono_cliente:''):'',o0.estado?'Estado: '+String(o0.estado).replace(/_/g,' '):''].filter(Boolean).join('\n');
        const url='https://wa.me/'+ph+'?text='+encodeURIComponent(txt);
        if(typeof window.pdOpenWhatsApp==='function')window.pdOpenWhatsApp(url);else window.open(url,'_blank');
      }catch(_){}
      const {error}=await db.from('pedidos').update({incidencia:motivo,incidencia_en:new Date().toISOString(),incidencia_resuelta:false}).eq('id',id).eq('motorizado_id',moto.id);
      if(error){show($('appMsg'),'No se pudo avisar a Pidemás: '+error.message);return}
      const o=orders.find(x=>String(x.id)===String(id));if(o){o.incidencia=motivo;o.incidencia_resuelta=false}
      show($('appMsg'),'Aviso enviado a Pidemás: '+motivo);
      await loadOrders();
  }
  window.pdReportarProblema=problema;window.pdEnviarProblema=enviarProblema;
  window.__pfSlider=slider;
  if(typeof window.confirmPayment==='function'){
    const cp=window.confirmPayment;
    window.confirmPayment=async function(id){
      const o=(typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===String(id));
      if(!o||o.pago_acordado!=='solo_delivery')return cp.apply(this,arguments);
      const total=o.total;o.total=Number(o.costo_delivery||0);
      try{return await cp.apply(this,arguments)}finally{const n=(typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===String(id));if(n&&n.total===Number(o.costo_delivery||0)&&n===o)n.total=total}
    };
  }

  const SLIDES=[
    {re:/acceptOrder\(/,txt:()=>'Desliza para aceptar',green:true},
    {re:/startOrder\(/,txt:o=>isNegocio(o)?'Desliza: recogí el pedido':'Desliza: en camino'},
    {re:/continueEncomienda\(/,txt:()=>'Desliza para continuar'},
    {re:/markInDelivery\(/,txt:()=>'Desliza: llegué donde el cliente'},
    {re:/deliverOrder\(/,txt:()=>'Desliza: pedido entregado',green:true},
    {re:/confirmPayment\(/,txt:(o,b)=>(o&&o.pago_acordado==='yape_negocio'&&String(o.metodo_pago||'').toLowerCase()==='yape'?'Desliza: ya yapeó ':'Desliza: cobré ')+(((b&&b.textContent)||'').match(/S\/\s*[\d.,]+/)||[money(o.total)])[0]}
  ];

  function enhance(modal){
    const id=String(modal?.dataset?.orderId||'');
    const o=(typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===id);
    if(!o)return;
    const s=st(o),content=modal.querySelector('#pidemasOrderFullModalContent'),acts=modal.querySelector('.pidemas-order-modal-actions');
    if(!content)return;
    if(svcKey(o)==='enc'||['cancelado'].includes(s))return; 

    const idx=stepIndex(o);
    

    const head=document.createElement('div');head.className='pfSteps';
    head.innerHTML=`<div class="pfStepsTop"><span>Paso ${Math.min(idx+1,5)} de 5</span><b>${E(s==='asignado'?'Nuevo pedido':LABELS[idx])}</b></div><div class="pfBars">${LABELS.map((_,i)=>`<span class="${i<=idx&&s!=='asignado'?'on':''}"></span>`).join('')}</div><div class="pfLabels">${LABELS.map((l,i)=>`<span class="${i<=idx&&s!=='asignado'?'on':''}${i===idx&&s!=='asignado'?' cur':''}">${l}</span>`).join('')}</div>`;
    {const band=content.querySelector('.pdMBand');band?band.append(head):content.prepend(head);}
    

    const cards=[];
    if(o.incidencia&&o.incidencia_resuelta!==true)cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Problema reportado:</b> ${E(o.incidencia)}<br>Pidemás ya fue avisado.</span></div>`);
    if(String(o.observaciones||'').includes('PRODUCTO_MAYOR_18'))cards.push(`<div class="pfCard dark"><span><b>PRODUCTO +18</b><small>Pide el DNI al entregar. Si es menor de edad, no entregues y avisa a Pidemás.</small></span></div>`);
    if(/__PIDEMAS_DESCARTABLES__/.test(String(o.observaciones||'')))cards.push(`<div class="pfCard"><span class="pfDot"></span><span><b>Con descartables</b><br>Al recoger, confirma que el negocio incluyó: ${E(((String(o.observaciones||'').match(/"n":"([^"]+)"/g)||[]).map(x=>x.slice(5,-1)).concat(/"cubiertos":true/.test(String(o.observaciones||''))?['Cubiertos']:[])).join(', ')||'los descartables')}.</span></div>`);
    if(isNegocio(o)&&idx===1){
      if(o.listo_para_recojo===true)cards.push(`<div class="pfCard ok"><span class="pfDot"></span><span><b>El negocio marcó: pedido listo</b>${o.en_local_en?'':'<br>Ya puedes ir a recogerlo.'}</span></div>`);
      else if(o.negocio_aceptado_en&&Number(o.tiempo_preparacion_min)>0){const t=new Date(new Date(o.negocio_aceptado_en).getTime()+Number(o.tiempo_preparacion_min)*60000);cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>El negocio está preparando</b><br>Listo aprox. a las ${E(hhmm(t))}</span></div>`)}

      if(o.codigo_recojo&&o.negocio_id)cards.push(`<div class="pfCard dark"><span><b>CÓDIGO DE RECOJO</b><small>Díselo al local para que te entreguen</small></span><span class="pfCode">${E(o.codigo_recojo)}</span></div>`);
    }
    

    if(idx<2&&svcKey(o)==='compra'&&!prepaid(o)&&o.pago_confirmado!==true&&String(o.metodo_pago||'').toLowerCase()==='efectivo'&&typeof extractCashPayment==='function'){
      const pc=extractCashPayment(o.observaciones,o.total);
      if(pc.paid!=null)cards.unshift(Number(o.subtotal)>0?`<div class="pfCard warn"><span class="pfDot"></span><span><b>Lleva S/ ${Math.max(0,Number(pc.paid)-Number(o.total)).toFixed(2)} de vuelto</b><br>El cliente pagará ${E(money(o.total))} con S/ ${Number(pc.paid).toFixed(2)}.</span></div>`:`<div class="pfCard warn"><span class="pfDot"></span><span><b>El cliente pagará con S/ ${Number(pc.paid).toFixed(2)}</b><br>Lleva sencillo. El vuelto exacto se calcula cuando registres cuánto gastaste en la compra.</span></div>`);
    }
    if(idx<2&&svcKey(o)!=='compra'&&!prepaid(o)&&o.pago_confirmado!==true&&String(o.metodo_pago||'').toLowerCase()==='efectivo'&&typeof extractCashPayment==='function'){
      const pc=extractCashPayment(o.observaciones,o.total);
      if(pc.paid!=null&&Number(pc.change)>0)cards.unshift(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Lleva S/ ${Number(pc.change).toFixed(2)} de vuelto</b><br>${svcKey(o)==='recojo'?((typeof window.pdCobraAlRecoger==='function'&&window.pdCobraAlRecoger(o))?'Quien envía pagará al recoger':'Quien recibe pagará al entregar'):'El cliente pagará'} ${E(money(o.total))} con S/ ${Number(pc.paid).toFixed(2)}. Sal con sencillo.</span></div>`);
    }
    if(idx>=2&&idx<4&&s!=='asignado'){
      const m=String(o.metodo_pago||'').toLowerCase(),tot=money(o.total);
      if(prepaid(o))cards.push(`<div class="pfCard ok"><span class="pfDot"></span><span><b>Ya pagado · no cobres nada</b><br>${o.pago_acordado==='pagado'?'El cliente pagó productos y delivery al negocio.':'El cliente ya pagó.'}</span></div>`);
      else if(o.pago_acordado==='solo_delivery'&&o.pago_confirmado!==true)cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Cobra solo el delivery: ${E(money(o.costo_delivery))}</b><br>Los productos ya están pagados al negocio. Efectivo o Yape (QR).</span></div>`);
      else if(o.pago_confirmado===true)cards.push(`<div class="pfCard ok"><span class="pfDot"></span><span><b>Cobro registrado · ${E(money(o.total))}</b>${(typeof window.pdCobraAlRecoger==='function'&&window.pdCobraAlRecoger(o))?'<br>Cobrado al recoger: no cobres al entregar.':''}</span></div>`);
      else if(o.pago_acordado==='yape_negocio')cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Cobra ${E(tot)} con el Yape del negocio</b><br>Muestra el QR del negocio al llegar (no el de Pidemás).</span></div>`);
      else if(m==='yape')cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Cobra ${E(tot)} con Yape</b><br>Muestra el QR al llegar.</span></div>`);
      else{const pc=(svcKey(o)!=='compra'||Number(o.subtotal)>0)&&typeof extractCashPayment==='function'?extractCashPayment(o.observaciones,o.total):{};cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Cobra ${E(tot)} en efectivo</b><br>${pc.paid!=null?`Paga con S/ ${Number(pc.paid).toFixed(2)} · lleva <b>S/ ${Number(pc.change||0).toFixed(2)}</b> de vuelto`:'Al llegar, escribe el monto que te dan.'}</span></div>`)}
    }
    if(cards.length){const box=document.createElement('div');box.className='pfCards';box.innerHTML=cards.join('');(head.closest('.pdMBand')||head).after(box)}
    if(!acts)return;
    

    const startBtn=[...acts.querySelectorAll('button')].find(b=>/startOrder\(/.test(b.getAttribute('onclick')||'')||(idx===1&&/^(en camino|iniciar pedido)$/i.test((b.textContent||'').trim())));
    if(isNegocio(o)&&idx===1&&startBtn){
      if(!o.en_local_en){
        startBtn.classList.add('pfHidden');
        acts.prepend(slider('Desliza: llegué al local',false,()=>marcarEnLocal(id)));
      }else if(startBtn.disabled||!/startOrder\(/.test(startBtn.getAttribute('onclick')||'')){
        startBtn.textContent='Esperando que el local marque "listo"';
      }
    }
    

    [...acts.querySelectorAll('button')].forEach(b=>{
      if(b.classList.contains('pfHidden')||b.classList.contains('pfKnob'))return;
      const on=b.getAttribute('onclick')||'';
      const def=SLIDES.find(x=>x.re.test(on));if(!def||b.disabled)return;
      b.classList.add('pfHidden');
      b.after(slider(def.txt(o,b),!!def.green,()=>b.click()));
    });
    

    if(!['asignado','entregado','cancelado'].includes(s)){
      const loc=!!o.en_local_en,cob=idx===3;
      const R=idx<=1&&!loc?[['🏪','Negocio cerrado','El negocio está cerrado'],['🧭','No encuentro el local','No encuentro la dirección']]
        :idx<=1?[['⏳','Está demorando','El negocio no tiene el pedido listo'],['📦','Falta algo','Falta un producto']]
        :idx===2?[['📵','Cliente no contesta','El cliente no contesta'],['📍','Dirección errada','No encuentro la dirección']]
        :String(o.metodo_pago||'').toLowerCase()==='yape'?[['⌛','El Yape no llega','El Yape del cliente no llega'],['💵','Pagará en efectivo','El cliente pagará en efectivo, no por Yape']]
        :[['💸','No tiene sencillo','No tengo sencillo para dar vuelto'],['⚠️','Problema con el pago','Problema con el pago del cliente']];
      const box=document.createElement('div');box.className='pfReps';
      box.innerHTML=R.map(r=>`<button type="button" data-rep="${E(r[2])}"><i>${r[0]}</i>${E(r[1])}</button>`).join('')+'<button type="button" data-rep=""><i>⚠️</i>Otro</button>';
      box.addEventListener('click',async e=>{const b=e.target.closest('[data-rep]');if(!b)return;const m=b.dataset.rep;
        if(!m){problema(id);return}
        if(window.pdConfirmar&&!(await pdConfirmar('¿Avisar a Pidemás? '+m)))return;
        await enviarProblema(id,m)});
      acts.appendChild(box);
    }
  }

  if(typeof window.populateFullOrderModal==='function'){
    const orig=window.populateFullOrderModal;
    window.populateFullOrderModal=function(card,modal){const out=orig.apply(this,arguments);try{enhance(modal)}catch(e){console.warn('Botonera paso a paso:',e)}return out};
  }
})();
