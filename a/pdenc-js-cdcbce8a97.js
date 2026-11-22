(function(){
  if(window.__pdEncMoto)return; window.__pdEncMoto=true;
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'S/ '+(Number(n)||0).toFixed(2);
  const LABELS=['Aceptado','Recojo','Agencia','Guía y clave','Listo'];
  const isEnc=o=>String(o?.tipo_servicio||'').toLowerCase().includes('encomienda');
  const arr=v=>{if(Array.isArray(v))return v;try{const p=JSON.parse(v||'[]');return Array.isArray(p)?p:[]}catch(e){return []}};
  function paquetes(o){
    const extra=(typeof extractEncomiendaPackages==='function'?extractEncomiendaPackages(o.observaciones):[])||[];
    return [{numero:1,agencia:o.agencia_destino||'',destino:o.destino_final||o.direccion_entrega||'',tipoPago:o.tipo_pago_encomienda}]
      .concat(extra.map(p=>({numero:Number(p.numero)||0,agencia:p.agencia||'',destino:p.destino||'',tipoPago:p.tipoPago})))
      .filter((p,i,a)=>p.numero&&a.findIndex(x=>x.numero===p.numero)===i);
  }
  const guardados=o=>{const g=arr(o.paquetes_envio).slice();if(!g.some(x=>Number(x.numero)===1)&&o.guia_url){const sc=String(o.clave_guia||'').trim()==='SIN_CLAVE';g.push({numero:1,guia_url:o.guia_url,clave:sc?'':String(o.clave_guia||''),sin_clave:sc||(!o.clave_guia&&String(o.observaciones||'').includes('SIN_CLAVE_GUIA_CONFIRMADO'))})}return g};
  const DRAFT=window.__peDraft=window.__peDraft||{};
  const pkgOk=p=>!!(p&&(p.enviado_whatsapp||(p.guia_url&&p.guia_url!=='whatsapp'&&(p.sin_clave||String(p.clave||'').trim()))));
  function completo(o){const g=guardados(o);return paquetes(o).every(p=>pkgOk(g.find(x=>Number(x.numero)===p.numero)))}
  function momento(o){
    const m=String(o.pago_servicio_momento||'').toLowerCase();
    if(m)return m;
    if(o.pago_confirmado===true)return 'pagado';
    return String(o.metodo_pago||'').toLowerCase()==='yape'?'recojo_yape':'recojo_efectivo';
  }
  function idxOf(o){
    const s=String(o.estado||'').toLowerCase();
    if(s==='asignado')return 0;
    if(s==='entregado'||completo(o))return 4;
    if(o.pedido_en_agencia===true)return 3;
    if(['en_camino','camino_entrega','en_entrega'].includes(s))return 2;
    return 1;
  }

  async function subir(id,n,file){
    const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type]||'jpg';
    const st=db.storage.from('comprobantes_pagos'),stamp=Date.now();
    let path=`guias_encomiendas/pedido_${id}_p${n}_${stamp}.${ext}`;
    let up=await st.upload(path,file,{upsert:false,contentType:file.type||'image/jpeg',cacheControl:'3600'});
    if(up.error){path=`comprobantes_yape/guia_pedido_${id}_p${n}_${stamp}.${ext}`;up=await st.upload(path,file,{upsert:false,contentType:file.type||'image/jpeg',cacheControl:'3600'});if(up.error)throw new Error('No se pudo subir la foto: '+(up.error.message||up.error))}
    const url=st.getPublicUrl(path)?.data?.publicUrl;
    if(!url)throw new Error('La foto se subió, pero no se generó el enlace público.');
    return url;
  }
  

  

  function waAdmin(){const c=typeof window.pdYapeCfg==='function'?window.pdYapeCfg():null;let ph=String(c&&c.whatsapp_admin||'986233533').replace(/\D/g,'');if(ph.length===9)ph='51'+ph;return ph}
  function textoGuia(o,p,clave,sin){
    return ['*PIDEMÁS · GUÍA DE ENCOMIENDA*','Pedido #'+String(o.id).slice(0,8).toUpperCase(),'Paquete '+p.numero+': '+([p.agencia,p.destino].filter(Boolean).join(' → ')||'—'),
      'Clave de recojo: '+(sin?'la agencia no dio clave':clave),'Cliente: '+(o.nombre_remitente||o.nombre_cliente||'—')+((o.telefono_remitente||o.telefono_cliente)?' · '+(o.telefono_remitente||o.telefono_cliente):''),
      'Motorizado: '+String(moto?.nombre_completo||'').trim(),'(Foto de la guía adjunta)'].join('\n');
  }
  async function marcarEnviado(o,n,sin){
    const lista=guardados(o).filter(x=>Number(x.numero)!==n&&!(x.guia_url==='whatsapp'));
    lista.push({numero:n,enviado_whatsapp:true,sin_clave:!!sin,enviado_en:new Date().toISOString()});
    lista.sort((a,b)=>a.numero-b.numero);
    const patch={paquetes_envio:lista};
    if(completo({...o,paquetes_envio:lista})){patch.guia_url='whatsapp';patch.clave_guia='ENVIADA_POR_WHATSAPP'}
    const {data,error}=await db.from('pedidos').update(patch).eq('id',o.id).eq('motorizado_id',moto.id).select('id').maybeSingle();
    if(error)throw new Error(error.message+(/paquetes_envio/.test(error.message)?' (Falta correr el SQL de la etapa 3.)':''));
    if(!data)throw new Error('Supabase no confirmó el registro del envío.');
    Object.assign(o,patch);return completo(o);
  }
  function guardar(id,n,card,modo){
    const o=orders.find(x=>String(x.id)===String(id));if(!o)return;
    if(['entregado','cancelado'].includes(String(o.estado||'').toLowerCase())){show($('appMsg'),'Esta encomienda ya está finalizada: ya no se pueden enviar guías.');return}
    const dk=id+':'+n,dr=DRAFT[dk]||{};
    const btn=card.querySelector('.peSave'),file=card.querySelector('input[type=file]')?.files?.[0]||dr.file||null;
    const sin=!!card.querySelector('.peSin input')?.checked,clave=String(card.querySelector('.peClave')?.value||'').trim();
    if(!file&&modo!=='chat'){show($('appMsg'),'Toma la foto de la guía o voucher del paquete '+n+'.');return}
    if(!sin&&!clave){show($('appMsg'),'Escribe la clave del paquete '+n+' o marca que la agencia no dio clave.');return}
    const p=paquetes(o).find(x=>x.numero===n)||{numero:n};
    const txt=textoGuia(o,p,clave,sin);
    const done=async()=>{
      btn.disabled=true;btn.textContent='Registrando envío…';
      try{const all=await marcarEnviado(o,n,sin);delete DRAFT[dk];
        show($('appMsg'),all?'Listo: enviaste todas las guías a Administración. Ya puedes finalizar la encomienda.':'Paquete '+n+' enviado a Administración.');
        await loadOrders();
      }catch(e){show($('appMsg'),'Se abrió WhatsApp, pero no se pudo registrar el envío: '+(e.message||e));btn.disabled=false;btn.textContent='Enviar al admin por WhatsApp'}
    };
    

    if(modo==='chat'){
      if(file)try{const u=URL.createObjectURL(file);const a=document.createElement('a');a.href=u;a.download='guia_'+String(o.id).slice(0,8).toUpperCase()+'_paquete'+n+'.'+(((file.type||'').split('/')[1]||'jpg').replace('jpeg','jpg'));document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(_){}
      const url='https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt.replace('(Foto de la guía adjunta)','(Te envío la foto de la guía)'));
      if(typeof window.pdOpenWhatsApp==='function')window.pdOpenWhatsApp(url);else window.open(url,'_blank'); 

      show($('appMsg'),'En el chat del admin toca la cámara, toma la foto de la guía y envía.');
      done();return;
    }
    

    try{
      const fl=new File([file],'guia_paquete_'+n+'.'+(((file.type||'').split('/')[1]||'jpg').replace('jpeg','jpg')),{type:file.type||'image/jpeg'});
      if(navigator.canShare&&navigator.canShare({files:[fl]})){
        navigator.share({files:[fl],text:txt,title:'Guía paquete '+n}).then(done).catch(err=>{if(err&&err.name==='AbortError')show($('appMsg'),'No se envió la guía. Vuelve a tocar el botón y elige WhatsApp → Administración.');else{abrirTexto()}});
        return;
      }
    }catch(_){}
    abrirTexto();
    function abrirTexto(){
      

      const url='https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt.replace('(Foto de la guía adjunta)','(Te adjunto la foto de la guía)'));
      if(typeof window.pdOpenWhatsApp==='function')window.pdOpenWhatsApp(url);else window.open(url,'_blank');
      show($('appMsg'),'Adjunta la foto de la guía en el chat de WhatsApp de Administración.');
      done();
    }
  }

  function enhance(modal){
    const id=String(modal?.dataset?.orderId||'');
    const o=(typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===id);
    if(!o||!isEnc(o)||String(o.estado||'').toLowerCase()==='cancelado')return;
    const content=modal.querySelector('#pidemasOrderFullModalContent'),acts=modal.querySelector('.pidemas-order-modal-actions');
    if(!content)return;
    const idx=idxOf(o),asig=String(o.estado||'').toLowerCase()==='asignado';
    const head=document.createElement('div');head.className='pfSteps';
    head.innerHTML=`<div class="pfStepsTop"><span>Paso ${Math.min(idx+1,5)} de 5 · encomienda</span><b>${E(asig?'Nueva encomienda':LABELS[idx])}</b></div><div class="pfBars">${LABELS.map((_,i)=>`<span class="${!asig&&i<=idx?'on':''}"></span>`).join('')}</div><div class="pfLabels">${LABELS.map((l,i)=>`<span class="${!asig&&i<=idx?'on':''}${!asig&&i===idx?' cur':''}">${l}</span>`).join('')}</div>`;
    {const band=content.querySelector('.pdMBand');band?band.append(head):content.prepend(head);}
    const cards=[];
    if(o.incidencia&&o.incidencia_resuelta!==true)cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Problema reportado:</b> ${E(o.incidencia)}</span></div>`);
    if(asig&&momento(o)==='recojo_efectivo'&&o.pago_confirmado!==true&&typeof extractCashPayment==='function'){
      const pc=extractCashPayment(o.observaciones,o.total);
      if(pc.paid!=null&&Number(pc.change)>0)cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Lleva S/ ${Number(pc.change).toFixed(2)} de vuelto</b><br>Al recoger, el cliente pagará ${E(money(o.total))} con S/ ${Number(pc.paid).toFixed(2)}. Sal con sencillo.</span></div>`);
    }
    if(!asig&&idx<=2){
      const m=momento(o),tot=money(o.total);
      if((m==='recojo_efectivo'||m==='recojo_yape')&&o.pago_confirmado===true){cards.push(`<div class="pfCard ok"><span class="pfDot"></span><span><b>Cobro registrado · ${E(money(o.total))}</b><br>${String(o.metodo_pago||'').toLowerCase()==='yape'?'Pagó con Yape.':'En efectivo.'}</span></div>`)}else
      if(m==='pagado')cards.push(`<div class="pfCard ok"><span class="pfDot"></span><span><b>Ya pagado · no cobres nada</b><br>El cliente pagó a Administración.</span></div>`);
      else if(m==='al_final')cards.push(`<div class="pfCard"><span class="pfDot"></span><span><b>No cobres ahora</b><br>El cliente paga después de recibir la guía y la clave.</span></div>`);
      else if(m==='recojo_yape')cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Cobra ${E(tot)} con Yape al recoger</b><br><button type="button" class="peQr" onclick="showYapeQr('${E(id)}')">Mostrar QR</button></span></div>`);
      else{const pc=typeof extractCashPayment==='function'?extractCashPayment(o.observaciones,o.total):{};cards.push(`<div class="pfCard warn"><span class="pfDot"></span><span><b>Cobra ${E(tot)} al recoger</b><br>En efectivo o con Yape (QR).${pc.paid!=null?`<br>Si paga en efectivo: paga con S/ ${Number(pc.paid).toFixed(2)} · lleva <b>S/ ${Number(pc.change||0).toFixed(2)}</b> de vuelto`:''}<br><button type="button" class="peQr" onclick="showYapeQr('${E(id)}')">Mostrar QR</button></span></div>`)}
    }
    if(idx===4&&!asig)cards.push(`<div class="pfCard ok"><span class="pfDot"></span><span><b>Guías y claves enviadas a Administración</b><br>Administración se las mandará al cliente.</span></div>`);
    if(cards.length){const box=document.createElement('div');box.className='pfCards';box.innerHTML=cards.join('');(head.closest('.pdMBand')||head).after(box)}

    

    const pagoAg=o.tipo_pago_encomienda==='pago_en_agencia',cajaPago=String(o.observaciones||'').includes('PAGO_ENCOMIENDA_CAJA_CONFIRMADO');
    const fin=['entregado','cancelado'].includes(String(o.estado||'').toLowerCase());
    if(fin){
      

      content.querySelectorAll('.encActions').forEach(x=>x.classList.add('peHide'));
      content.querySelectorAll('input[id^="guia_"],input[id^="clave_"],input[id^="sinClave_"],input[id^="encCaja_"],.saveGuideBtn').forEach(x=>{x.disabled=true;(x.closest('.encActions')||x).classList.add('peHide')});
    }
    if(o.pedido_en_agencia===true&&(!pagoAg||cajaPago)){
      const old=content.querySelector('input[id^="guia_"]')?.closest('.encActions')||content.querySelector('.saveGuideBtn')?.closest('.encActions')||content.querySelector('.encGuideState')?.closest('.encActions');
      if(old)old.classList.add('peHide');
      const g=guardados(o);
      const wrap=document.createElement('div');wrap.className='peWrap';
      wrap.innerHTML=paquetes(o).map(p=>{
        const sv=g.find(x=>Number(x.numero)===p.numero);
        const ruta=[p.agencia,p.destino].filter(Boolean).join(' → ')||'Paquete';
        if(fin&&!pkgOk(sv))return `<div class="pePkg"><div class="pePkgHead"><b>Paquete ${p.numero} · ${E(ruta)}</b><span class="pePill">Sin guía</span></div><span style="font-size:13px;color:var(--fr-muted)">La encomienda se finalizó sin registrar la guía de este paquete.</span></div>`;
        if(pkgOk(sv)&&!(DRAFT[id+':'+p.numero]||{}).resend){
          if(sv.enviado_whatsapp)return `<div class="pePkg done"><div class="pePkgHead"><b>Paquete ${p.numero} · ${E(ruta)}</b><span class="pePill">Enviado</span></div><div class="peDone"><span><b>Guía y clave enviadas al admin</b>Por WhatsApp${sv.enviado_en?' · '+E(new Date(sv.enviado_en).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})):''}</span></div>${fin?'':`<button type="button" class="peResend" data-n="${p.numero}">Volver a enviar</button>`}</div>`;
          return `<div class="pePkg done"><div class="pePkgHead"><b>Paquete ${p.numero} · ${E(ruta)}</b><span class="pePill">Completo</span></div><div class="peDone"><img src="${E(sv.guia_url)}" alt="Guía del paquete ${p.numero}"><span><b>${sv.sin_clave?'Sin clave':'Clave ••'+E(String(sv.clave).slice(-2))}</b>Foto de la guía guardada</span></div></div>`;}
        return `<div class="pePkg" data-n="${p.numero}"><div class="pePkgHead"><b>Paquete ${p.numero} · ${E(ruta)}</b><span class="pePill">${p.tipoPago==='pago_en_agencia'?'Pagas en agencia':'Paga a destino'}</span></div>
          <button type="button" class="pePhoto"><span class="peTxt">Tomar foto de la guía o voucher</span><small>Que se lean el número de guía y el monto</small></button><input type="file" class="peFile" data-pd-cloud="1" hidden accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Foto de la guía del paquete ${p.numero}">
          <input class="peClave" type="text" inputmode="text" maxlength="60" placeholder="Clave de recojo" aria-label="Clave del paquete ${p.numero}">
          <label class="peSin"><input type="checkbox"> La agencia no dio clave</label>
          <button type="button" class="peSave">Enviar foto por WhatsApp</button>
          <button type="button" class="peChat">Abrir chat del admin</button><small class="peWaHint peWaHint2">Se abre el chat del admin con el pedido y la clave ya escritos. En WhatsApp toca la cámara, toma la foto de la guía y envía.</small></div>`;
      }).join('');
      {

       const stops=content.querySelector(':scope > .pdMStops');let ref=stops;
       while(ref&&ref.nextElementSibling&&ref.nextElementSibling.classList.contains('pdMBlock'))ref=ref.nextElementSibling;
       if(ref)ref.after(wrap);else{const anc=head.closest('.pdMBand')||head;(anc.nextElementSibling&&anc.nextElementSibling.classList.contains('pfCards')?anc.nextElementSibling:anc).after(wrap);}}
      wrap.querySelectorAll('.pePkg[data-n]').forEach(card=>{
        const n=Number(card.dataset.n);
        const dk=id+':'+n,dr=DRAFT[dk]=DRAFT[dk]||{};
        const inp=card.querySelector('input[type=file]'),lab=card.querySelector('.pePhoto'),cl=card.querySelector('.peClave'),sn=card.querySelector('.peSin input');
        const prev=f=>{lab.classList.add('has');if(!dr.url||dr.urlFor!==f){dr.url=URL.createObjectURL(f);dr.urlFor=f}lab.querySelector('.peTxt').innerHTML=`<img src="${dr.url}" alt="Vista previa">`;lab.querySelector('small').textContent='Toca para cambiar la foto'};
        if(dr.file)prev(dr.file);
        if(dr.clave)cl.value=dr.clave;
        if(dr.sin){sn.checked=true;cl.disabled=true}
        lab.addEventListener('click',()=>inp.click());
        inp.addEventListener('change',()=>{const f=inp.files?.[0];if(!f)return;dr.file=f;prev(f)});
        cl.addEventListener('input',()=>{dr.clave=cl.value});
        sn.addEventListener('change',e=>{dr.sin=e.target.checked;cl.disabled=e.target.checked;if(e.target.checked){cl.value='';dr.clave=''}});
        card.querySelector('.peSave').addEventListener('click',()=>{const d=DRAFT[id+':'+n];if(d)delete d.resend;guardar(id,n,card)});
        card.querySelector('.peChat')?.addEventListener('click',()=>{const d=DRAFT[id+':'+n];if(d)delete d.resend;guardar(id,n,card,'chat')});
      });
    }

    content.querySelectorAll('.peResend').forEach(b=>b.addEventListener('click',()=>{const k=id+':'+b.dataset.n;DRAFT[k]=DRAFT[k]||{};DRAFT[k].resend=true;try{window.pdForceModal&&window.pdForceModal();renderOrders()}catch(_){}}));
    

    if(acts&&typeof window.__pfSlider==='function'){
      const DEF=[[/acceptOrder\(/,'Desliza para aceptar',true],[/startOrder\(/,'Desliza: recogí los paquetes'],[/confirmEncomiendaAgency\(/,'Desliza: llegué a la agencia'],[/continueEncomienda\(/,'Desliza para continuar'],[/deliverOrder\(/,'Desliza: terminar encomienda',true]];
      [...acts.querySelectorAll('button')].forEach(b=>{
        if(b.classList.contains('pfHidden')||b.classList.contains('pfKnob')||b.disabled)return;
        const d=DEF.find(x=>x[0].test(b.getAttribute('onclick')||''));if(!d)return;
        b.classList.add('pfHidden');b.after(window.__pfSlider(d[1],!!d[2],()=>b.click()));
      });
      if(!['asignado','entregado'].includes(String(o.estado||'').toLowerCase())&&typeof window.pdReportarProblema==='function'&&!acts.querySelector('.pfProblem')){
        const p=document.createElement('button');p.type='button';p.className='pfProblem';p.textContent='Tengo un problema';p.addEventListener('click',()=>window.pdReportarProblema(id));acts.appendChild(p);
      }
      

      content.querySelectorAll('.recojoInfoCard').forEach(c=>{
        if(!/Pago realizado desde tu caja/i.test(c.textContent)||c.dataset.peDone)return;c.dataset.peDone='1';
        c.style.setProperty('display','none','important');
        const okc=document.createElement('div');okc.className='pfCard ok';okc.innerHTML='<span class="pfDot"></span><span><b>Pago en agencia registrado</b><br>Se descontó de tu caja como pago de encomienda.</span>';
        const w=content.querySelector('.peWrap');(w||c).before(okc);
      });
      

      if(acts.querySelector('.pfSlide'))acts.querySelectorAll('button:disabled').forEach(b=>b.classList.add('pfHidden'));
      

      const pend=[...content.querySelectorAll('.pePkg[data-n]')];
      if(pend.length&&!acts.querySelector('.peGoGuide')){
        acts.querySelectorAll('button:disabled').forEach(b=>b.classList.add('pfHidden'));
        const g=document.createElement('button');g.type='button';g.className='peGoGuide';
        g.textContent=pend.length>1?`Enviar guía y clave al admin · faltan ${pend.length}`:`Enviar guía y clave del paquete ${pend[0].dataset.n} al admin`;
        g.addEventListener('click',()=>{const t=content.querySelector('.pePkg[data-n]');if(t){t.scrollIntoView({behavior:'smooth',block:'start'});t.classList.add('peFlash');setTimeout(()=>t.classList.remove('peFlash'),1200)}});
        const pr=acts.querySelector('.pfProblem');pr?pr.before(g):acts.appendChild(g);
      }
    }
  }
  if(typeof window.populateFullOrderModal==='function'){
    const orig=window.populateFullOrderModal;
    window.populateFullOrderModal=function(card,modal){const out=orig.apply(this,arguments);try{enhance(modal)}catch(e){console.warn('Encomienda paso a paso:',e)}return out};
  }
  

  ['saveEncomiendaGuide','payEncomiendaFromCaja','confirmEncomiendaAgency'].forEach(fn=>{
    const f=window[fn];if(typeof f!=='function')return;
    window[fn]=function(id){const o=(typeof orders!=='undefined'?orders:[]).find(x=>String(x.id)===String(id));if(o&&['entregado','cancelado'].includes(String(o.estado||'').toLowerCase())){show($('appMsg'),'Esta encomienda ya está finalizada: ya no se puede modificar.');return}return f.apply(this,arguments)};
  });
})();
