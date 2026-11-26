/* ===== Pidemás · Motorizado · pedido por pasos =====
   Reemplaza la ventana vieja del detalle en los pedidos de negocio. Usa las mismas
   acciones que ya tenía la app (aceptar, en camino, cobrar, entregar con código). */
(function(){
  if(window.__pdPasosMoto||!window.PdPasos)return;window.__pdPasosMoto=1;
  const U=PdPasos.util,E=U.E,M=U.money;
  const L=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const D=()=>{try{return db}catch(e){return window.db}};
  const ME=()=>{try{return moto}catch(e){return null}};
  const svc=o=>{const t=String(o?.tipo_servicio||'').toLowerCase();return t.includes('encomienda')?'enc':t.includes('compra')?'compra':t.includes('recojo')?'recojo':'pedido'};
  const esNegocio=o=>!!o&&svc(o)==='pedido'&&!!o.negocio_id;
  const neg=o=>{try{return (window.__pdNegCache||{})[o.negocio_id]||{}}catch(e){return {}}};
  const st=o=>String(o?.estado||'').toLowerCase().trim();
  const aCobrar=o=>o.pago_acordado==='solo_delivery'?Number(o.costo_delivery||0):Number(o.total||0);
  const prepago=o=>o.pago_acordado==='pagado'||(o.pago_confirmado===true&&!(Number(o.monto_recibido)>0));
  const hayCobro=o=>!prepago(o)&&aCobrar(o)>0;
  const yape=o=>String(o.metodo_pago||'').toLowerCase()==='yape';
  const efectivo=o=>!yape(o)&&String(o.metodo_pago||'').toLowerCase()!=='plim';
  const draft=id=>{const d=window.__pidemasCashDrafts||{};return d[String(id)]||''};
  const setDraft=(id,v)=>{(window.__pidemasCashDrafts=window.__pidemasCashDrafts||{})[String(id)]=v};
  let abierto=null,error='';
  const COD={};/* código de entrega que va escribiendo el motorizado, por pedido */
  const pideCod=o=>!o.entrega_verificada&&!!o.negocio_id&&!(String(o.tipo_servicio||'')==='encomienda'&&(o.guia_url||o.agencia_id));

  function etapa(o){
    const s=st(o);
    if(s==='entregado')return 9;if(s==='cancelado')return -1;
    if(s==='asignado')return 0;
    if(['aceptado','pedido_aceptado','camino_recojo'].includes(s))return o.en_local_en?1:0.5;
    if(['en_camino','camino_entrega'].includes(s))return 2;
    if(['en_entrega','confirmando_pago'].includes(s))return hayCobro(o)&&o.pago_confirmado!==true?3:4;
    return 0;
  }
  async function enLocal(id){
    const now=new Date().toISOString();
    const {data,error:e}=await D().from('pedidos').update({en_local_en:now}).eq('id',id).eq('motorizado_id',ME().id).select('id,en_local_en').maybeSingle();
    if(e||!data){error='No se pudo marcar la llegada al local. '+(e?.message||'');return}
    const o=L().find(x=>String(x.id)===String(id));if(o)o.en_local_en=now;
    try{await loadOrders()}catch(_){}
  }
  async function correr(fn,id){
    error='';
    if(typeof window[fn]!=='function'){error='Esta acción no está disponible. Actualiza la app.';return}
    const box=document.getElementById('appMsg');const antes=box?box.textContent:'';
    try{await window[fn](id)}catch(e){error=String(e?.message||e)}
    /* los avisos de error de la app quedan debajo de esta vista: se repiten aquí */
    const ahora=box&&!box.classList.contains('hidden')?String(box.textContent||'').trim():'';
    if(!error&&ahora&&ahora!==antes&&!/^✓|correctamente|devuelto/i.test(ahora))error=ahora;
  }
  function rapidosCliente(o,etapaN){
    if(/^(entregado|cancelado|rechazado)$/.test(String(o.estado||'').toLowerCase()))return '';/* pedido terminado: sin mensajes rápidos */
    const m=ME(),yo=String(m&&m.nombre_completo||'tu motorizado').split(' ')[0],cli=o.nombre_cliente?' '+String(o.nombre_cliente).split(' ')[0]:'',ref=U.ref(o.id),neg=(neg_(o)||'el negocio');
    const cob=hayCobro(o)?(efectivo(o)?' Ten listo '+M(aCobrar(o))+' en efectivo, por favor.':' Ten listo tu Yape para pagar '+M(aCobrar(o))+', por favor.'):'';
    const h='Hola'+cli+', soy '+yo+' de *Pidemás Delivery* 🛵. ';
    const L=etapaN<2?[['Voy al local por tu pedido',h+'Ya voy a '+neg+' a recoger tu pedido '+ref+'. Te aviso cuando salga.'],['El local aún lo prepara',h+'Ya estoy en '+neg+'; están terminando de preparar tu pedido '+ref+'. En breve salgo.']]
      :[['Ya recogí tu pedido, voy en camino',h+'Ya tengo tu pedido '+ref+' y voy en camino.'+cob],['Llego en unos 5 minutos',h+'Llego en unos 5 minutos con tu pedido '+ref+'.'+cob],['Ya llegué, estoy afuera',h+'Ya llegué, estoy afuera de tu domicilio con tu pedido '+ref+'. ¿Puedes salir a recibirlo?'+cob],['No encuentro la dirección',h+'Estoy cerca pero no encuentro tu dirección. ¿Me envías tu ubicación o una referencia, por favor?'],['Te estoy llamando',h+'Te estoy llamando para entregarte tu pedido '+ref+'. Por favor contesta o escríbeme.'],['Hay tráfico, me demoro un poco',h+'Hay bastante tráfico, me demoro unos minutos más con tu pedido '+ref+'. ¡Gracias por tu paciencia!']];
    return U.rapidos(o.telefono_cliente,L);
  }
  const neg_=o=>{const n=neg(o);return n.nombre||o.nombre_negocio||''};
  function llegada(o){
    const m=ME();const nom=o.nombre_cliente?' '+String(o.nombre_cliente).split(' ')[0]:'';
    return 'Hola'+nom+', soy '+String(m&&m.nombre_completo||'tu motorizado').split(' ')[0]+' de *Pidemás Delivery*. 🛵 Estoy llegando con tu pedido '+U.ref(o.id)+'. Por favor ten listo'+(efectivo(o)&&hayCobro(o)?' el pago y':'')+' tu teléfono a la mano.';
  }

  /* Cuando la app recarga los pedidos, por un momento llegan sin productos ni datos del negocio:
     se guarda lo último que se vio para que la vista no salte. */
  const memo={};
  function estable(o){
    const k=String(o.id),g=memo[k]||(memo[k]={});
    if(Array.isArray(o.detalle_pedidos)&&o.detalle_pedidos.length)g.det=o.detalle_pedidos;else if(g.det)o=Object.assign({},o,{detalle_pedidos:g.det});
    ['nombre_negocio','direccion_negocio','telefono_negocio','negocio_maps_url','latitud_recojo','longitud_recojo'].forEach(f=>{if(o[f]!=null&&o[f]!=='')g[f]=o[f];else if(g[f]!=null){if(o===L().find(x=>x===o))o=Object.assign({},o);o[f]=g[f]}});
    return o;
  }
  function modelo(){
    let o=L().find(x=>String(x.id)===String(abierto));
    if(!o){if(memo.__ultimo&&Date.now()-memo.__t<6000)return memo.__ultimo;return null}
    o=estable(o);
    const n=neg(o),e=etapa(o),cobro=hayCobro(o);
    const negNom=n.nombre||o.nombre_negocio||'Negocio';
    const negDir=n.direccion||o.direccion_negocio||'';
    const cli=o.nombre_cliente||'Cliente';
    const prep=o.negocio_aceptado_en&&o.tiempo_preparacion_min?U.hora(new Date(new Date(o.negocio_aceptado_en).getTime()+o.tiempo_preparacion_min*60000)):'';
    const listo=!!o.listo_para_recojo;
    const titulos=['Ir al local','Recoger con código','Llevar al cliente'].concat(cobro?['Cobrar']:[]).concat(['Confirmar entrega']);
    const etapaDe=[0,1,2].concat(cobro?[3]:[]).concat([4]);
    const pos=e>=9?99:e===-1?-1:Math.floor(e===0.5?0:e);
    const steps=titulos.map((t,i)=>({title:t,state:pos===99||etapaDe[i]<pos?'done':etapaDe[i]===pos?'active':'locked'}));
    const S=k=>steps[etapaDe.indexOf(k)];
    if(efectivo(o)&&!draft(o.id)&&pagaCon(o)>0)setDraft(o.id,String(pagaCon(o)));

    /* 1 · Ir al local */
    {const s=S(0);s.sum=negNom+(negDir?' · '+negDir:'');
      const estado=listo?U.st('El pedido está listo para recoger','ok'):prep?U.st('El negocio está preparando · listo aprox. '+E(prep)):o.negocio_aceptado_en?U.st('El negocio está preparando el pedido'):U.st('Esperando que el negocio confirme el pedido');
      s.body=U.who(negNom,'Recojo aquí · pedido '+E(U.ref(o.id)),n.logo_url||n.imagen_url||'')+U.addr(negDir,'')+
        U.contact(U.maps(o.latitud_recojo??n.latitud,o.longitud_recojo??n.longitud,negDir,n.google_maps_url||o.negocio_maps_url),n.telefono||o.telefono_negocio,'Hola, soy el motorizado de Pidemás por el pedido '+U.ref(o.id)+'.')+estado+avisoVuelto(o,aCobrar(o),false)+
        (e===0?U.note('Al aceptar verás el código de recojo y los datos del cliente.'):rapidosCliente(o,0));}
    /* 2 · Recoger con código */
    {const s=S(1);s.locked='Se muestra al llegar al local';const c=o.codigo_recojo||'';
      s.sum=(c?'Código '+c+' · ':'')+'pedido recogido';
      s.body=(listo?U.st('El pedido está listo para recoger','ok'):U.st(prep?'Aún lo preparan · listo aprox. '+E(prep):'Aún lo están preparando'))+
        (c?U.code('Código de recojo',c,'Díselo al local para que te entreguen'):U.code('Pedido',U.ref(o.id),'Muéstrale este número al local'))+
        U.note(E(negNom)+' ya sabe que llegaste'+(c?' y comparará este código.':'.'))+U.items('Qué recoges',o.detalle_pedidos,false);}
    /* 3 · Llevar al cliente */
    {const s=S(2);s.locked='Se muestra cuando recojas el pedido';s.sum=cli+(o.direccion_entrega?' · '+o.direccion_entrega:'');
      s.body=U.who(cli,'Cliente · entrega aquí','',true)+U.addr(o.direccion_entrega,o.referencia_entrega)+
        U.contact(U.maps(o.latitud_entrega,o.longitud_entrega,o.direccion_entrega,o.ubicacion_entrega),o.telefono_cliente,'')+
        rapidosCliente(o,2)+
        (o.observaciones&&typeof window.pdDetalleTxt!=='function'?'':'');}
    /* 4 · Cobrar */
    if(cobro){const s=S(3);s.locked='Se muestra al llegar donde el cliente';
      const monto=aCobrar(o),sd=o.pago_acordado==='solo_delivery';
      const qn=yape(o)&&typeof window.pdQrDePedido==='function'?window.pdQrDePedido(o.id):null;
      s.sum='Cobrado '+M(o.monto_recibido>0&&efectivo(o)?Math.min(o.monto_recibido,monto):monto)+' · '+(yape(o)?(qn&&qn.negocio?'Yape del negocio':'Yape'):'Efectivo');
      let h=`<div class="amt"><div class="k">${sd?'Cobro solo del delivery':'Cobro al cliente'}</div><div class="n">${M(monto)}</div><div class="pill">${yape(o)?'Yape':'Efectivo'}</div></div>`+
        `<div class="sum"><div class="lbl">Montos</div><div class="li"><span>Productos</span><b>${sd?'Pagado':M(o.subtotal)}</b></div><div class="li"><span>Delivery</span><b>${M(o.costo_delivery)}</b></div></div>`+(o.pago_confirmado!==true&&typeof window.pdCambiarPago==='function'?`<div><div class="lbl">¿Cómo paga el cliente?</div><div class="quick" data-act="cpago"><button type="button" data-m="efectivo" class="${efectivo(o)?'on':''}">Efectivo</button><button type="button" data-m="yape" class="${yape(o)?'on':''}">Yape</button></div></div>`:'');
      if(yape(o)){
        h+=`<button type="button" class="qr" data-act="qr"><span class="im"${qn&&qn.url?` style="background-image:url('${E(qn.url)}')"`:''}>${qn&&qn.url?'':'QR'}</span><span class="t"><span class="k">${qn&&qn.negocio?'Yape del negocio':'Yape de Pidemás'}</span><span class="a">${E(qn&&qn.titular||qn&&qn.nombre||'')}</span><span class="b2">${E(qn&&qn.numero||'')}</span><span class="c">Toca para agrandar</span></span></button>`;
        const ye=o.yape_negocio_estado||'';
        if(qn&&qn.negocio)h+=ye==='esperando'?U.st('Esperando que el negocio confirme si le llegó el Yape…'):ye==='llego'?U.st('El negocio confirmó el Yape','ok'):ye==='no_llego'?U.st('Al negocio no le llegó el Yape. Pide al cliente que revise y vuelve a deslizar.','mal'):'';
        h+=U.note('Confirma solo cuando veas la constancia del pago en el celular del cliente.');
        if(!(qn&&qn.negocio))h+=(window.PdYapeP?PdYapeP.html(o):'');
      }else{
        const v=draft(o.id);const tot=monto;const vals=[];[10,20,50,100,200].forEach(x=>{const r=Math.ceil(tot/x)*x;if(r>tot+0.004&&!vals.includes(r))vals.push(r)});
        h+=`<div><div class="lbl">¿Con cuánto paga?</div><input class="inp" data-act="cash" inputmode="decimal" placeholder="${M(tot)}" value="${E(v)}"></div>`+
          `<div class="quick" data-act="quick">${[tot].concat(vals.slice(0,3)).map((x,i)=>`<button type="button" data-v="${x.toFixed(2)}" class="${Number(v)===x?'on':''}">${i?'S/ '+x:'Exacto'}</button>`).join('')}</div>`+
          `<div data-vuelto>${I_v(v,tot)}</div>`;
      }
      s.body=h;}
    /* 5 · Confirmar entrega */
    {const s=S(4);s.locked=cobro?'Se muestra después de cobrar':'Se muestra al llegar donde el cliente';s.sum='Código verificado';
      s.body=(pideCod(o)?U.note('Pide al cliente su <b>código de entrega</b>: son 4 dígitos que ve en su app. Escríbelo aquí y luego desliza para finalizar.')+
        `<div><div class="lbl">Código de entrega</div><input class="inp pdCod" style="text-align:center;font-size:30px;letter-spacing:.45em;height:64px;padding-left:.45em" data-act="cod" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="• • • •" value="${E(COD[o.id]||'')}"></div>`+
        `<div style="display:flex;align-items:center;gap:10px;margin:4px 0;color:#A8988C;font:700 12px PdInter,Inter,system-ui,sans-serif;letter-spacing:.06em"><span style="flex:1;height:1px;background:#F1E4DA"></span>SI NO TIENE EL CÓDIGO<span style="flex:1;height:1px;background:#F1E4DA"></span></div><button type="button" class="b soft" style="width:100%" data-act="sincod">Tomar foto de la entrega</button>`
        :U.note('Entrega el pedido al cliente y desliza para finalizar.'))+
        (cobro?U.st('Cobrado '+M(aCobrar(o))+' · '+(yape(o)?'Yape':'Efectivo'),'ok'):U.st(prepago(o)?'El pedido ya está pagado: no cobres nada.':'No hay nada que cobrar.','ok'))+rapidosCliente(o,3);}

    const T=['Pedido nuevo','Ve al local','Recoge el pedido','Lleva el pedido','Cobra al cliente','Confirma la entrega'];
    const m={kicker:'Pedido '+U.ref(o.id),steps,err:error,acts:{}};
    if(e===-1){m.title='Pedido cancelado';m.chip='Cancelado';m.chipCls='mal';steps.forEach(s=>s.state='locked');m.fin={mal:true,title:'Este pedido fue cancelado',text:o.motivo_cancelacion||'Ya no tienes que hacer nada con él.'};return m}
    if(e>=9){m.title='Entregado';m.chip='Listo';m.chipCls='ok';
      m.fin={title:'¡Pedido entregado!',text:o.entregado_en?'Entregado a las '+U.hora(o.entregado_en)+'.':'',lines:cobro?[E('Cobrado '+M(aCobrar(o))+' · '+(yape(o)?'Yape':'Efectivo'))]:[]};return m}
    const total=steps.length,actual=steps.findIndex(s=>s.state==='active')+1;
    m.title=e===0?'Pedido nuevo':T[Math.min(5,Math.floor(e)+1)]||'';
    m.chip=e===0&&st(o)==='asignado'?'Nuevo':'Paso '+actual+' de '+total;
    const id=o.id;
    if(st(o)==='asignado'){m.cta={label:'Aceptar pedido',run:()=>correr('acceptOrder',id)};m.alt=[{label:'Rechazar pedido',mal:true,run:()=>correr('rejectOrder',id)}]}
    else if(e===0.5)m.cta={label:'Llegué al local',run:()=>enLocal(id)};
    else if(e===1)m.cta={label:'Ya recogí el pedido',run:()=>correr('startOrder',id)};
    else if(e===2)m.cta={label:'Llegué donde el cliente',run:()=>correr('markInDelivery',id)};
    else if(e===3){
      const qn=yape(o)&&typeof window.pdQrDePedido==='function'?window.pdQrDePedido(o.id):null;
      if(qn&&qn.negocio&&o.yape_negocio_estado==='esperando')m.cta={label:'Esperando al negocio…',off:true,hint:'Te avisamos apenas confirme si le llegó el Yape'};
      else m.cta={label:'Ya cobré '+M(aCobrar(o)),busy:'Registrando cobro…',run:async()=>{
        if(efectivo(o)){const v=Number(String(draft(id)).replace(',','.'));if(!(v>0)){error='Escribe con cuánto te paga el cliente.';return}}
        if(yape(o)&&!(qn&&qn.negocio)&&window.PdYapeP){const f=PdYapeP.falta(o);if(f){error=f;return}try{await PdYapeP.guardar(o)}catch(e){error=e.message||String(e);return}}
        await correr('confirmPayment',id)}};
    }
    else if(e===4){
      if(!pideCod(o))m.cta={label:'Finalizar entrega',green:true,busy:'Finalizando…',run:()=>correr('deliverOrder',id)};
      else if(String(COD[id]||'').length!==4)m.cta={label:'Escribe el código para finalizar',off:true,hint:'Pide al cliente los 4 dígitos que ve en su app'};
      else m.cta={label:'Finalizar entrega',green:true,busy:'Verificando código…',run:async()=>{
        error='';
        if(!navigator.onLine)return correr('deliverOrder',id);/* sin señal: la app lo guarda y lo envía después */
        let r;try{r=await D().rpc('verificar_entrega',{p_pedido:id,p_codigo:COD[id],p_foto:null})}catch(x){r={error:x}}
        if(r.error&&!/function|does not exist|schema cache/i.test(r.error.message||'')){error='No se pudo verificar el código: '+(r.error.message||r.error);return}
        if(!r.error&&r.data==='incorrecto'){error='Código incorrecto. Pídeselo otra vez al cliente.';COD[id]='';return}
        if(!r.error&&r.data!=='ok'&&r.data!=='sin_codigo'){error='No se pudo verificar ('+r.data+').';return}
        o.entrega_verificada=o.entrega_verificada||'codigo';delete COD[id];
        await correr('deliverOrder',id)}};
    }
    m.acts={
      cod:(inp)=>{const a=String(COD[id]||'').length===4;inp.value=inp.value.replace(/\D/g,'').slice(0,4);COD[id]=inp.value;if(error){error=''}
        if((inp.value.length===4)!==a){if(inp.value.length===4)inp.blur();PdPasos.render()}},
      sincod:async(b)=>{error='';if(typeof window.pdEntregaConFoto!=='function'){await correr('deliverOrder',id);PdPasos.render();return}
        const t=b.textContent;try{b.disabled=true;b.textContent='Abriendo cámara…';const ok=await window.pdEntregaConFoto(id);if(!ok){b.disabled=false;b.textContent=t;return}
          b.textContent='Subiendo foto y finalizando…';await correr('deliverOrder',id)}catch(x){error='No se pudo subir la foto: '+(x.message||x)}
        PdPasos.render()},
      cpago:async(box,ev)=>{const b=ev.target.closest('[data-m]');if(!b||b.classList.contains('on'))return;error='';try{await window.pdCambiarPago(o,b.dataset.m)}catch(e){error=String(e&&e.message||e)}PdPasos.render()},
      qr:()=>{if(typeof window.showYapeQr==='function')window.showYapeQr(id)},
      cash:(inp)=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');setDraft(id,inp.value);const n=inp.getRootNode().querySelector('[data-vuelto]');if(n)n.innerHTML=I_v(inp.value,aCobrar(o));inp.getRootNode().querySelectorAll('.quick button').forEach(b=>b.classList.toggle('on',Number(b.dataset.v)===Number(inp.value)))},
      quick:(box,ev)=>{const b=ev.target.closest('[data-v]');if(!b)return;error='';setDraft(id,b.dataset.v);const inp=box.getRootNode().querySelector('[data-act="cash"]');if(inp){inp.value=b.dataset.v;inp.dispatchEvent(new Event('input'))}}
    };
    if(window.PdYapeP)Object.assign(m.acts,PdYapeP.acts(o));
    memo.__ultimo=m;memo.__t=Date.now();
    return m;
  }
  /* Con cuánto paga el cliente (lo anota el admin o la tienda): al iniciar el pedido avisa cuánto vuelto llevar */
  const pagaCon=o=>{try{if(typeof extractCashPayment!=='function')return 0;const p=extractCashPayment(o.observaciones,o.total);return Number(p&&p.paid)>0?Number(p.paid):0}catch(_){return 0}};
  function avisoVuelto(o,cobra,sinTotal){const pc=pagaCon(o);if(!(pc>0)||!efectivo(o)||o.pago_confirmado===true)return '';
    if(sinTotal)return '<div class="vto info"><span>Lleva sencillo para el vuelto<small style="display:block;margin-top:2px;font-size:13.5px;font-weight:600;opacity:.85">El cliente paga con un billete de '+M(pc)+'. El vuelto exacto sale al registrar cuánto gastaste.</small></span></div>';
    const vu=Math.round((pc-cobra)*100)/100,sub=t=>'<small style="display:block;margin-top:2px;font-size:13.5px;font-weight:600;opacity:.85">'+t+'</small>';
    return vu>0.004?'<div class="vto"><span>Lleva '+M(vu)+' de sencillo para el vuelto'+sub('Cobras '+M(cobra)+' y el cliente paga con un billete de '+M(pc))+'</span></div>'
      :'<div class="vto"><span>No necesitas sencillo'+sub('Cobras '+M(cobra)+' y el cliente paga exacto')+'</span></div>'}
  function I_v(v,tot){const n=Number(String(v||'').replace(',','.'));
    if(!(n>0))return '<div class="vto info"><span>Escribe con cuánto paga</span><b>S/ —</b></div>';
    if(n+0.004<tot)return '<div class="vto bad"><span>Le faltan</span><b>'+M(Math.round((tot-n)*100)/100)+'</b></div>';
    const vu=Math.round((n-tot)*100)/100;return vu>0.004?'<div class="vto"><span>Su vuelto</span><b>'+M(vu)+'</b></div>':'<div class="vto"><span>Paga exacto</span><b>Sin vuelto</b></div>'}

  function abrir(id){abierto=String(id);error='';PdPasos.open(modelo,{onClose:()=>{abierto=null}})}
  window.pdAbrirPasosMoto=abrir;
  /* La tarjeta del pedido abre esta vista en los pedidos de negocio; los demás siguen igual. */
  function enganchar(){
    const orig=window.toggleOrderDetails;if(typeof orig!=='function'||orig.__pasos)return;
    const f=function(id){const o=L().find(x=>String(x.id)===String(id));if(esNegocio(o))return abrir(id);return orig.apply(this,arguments)};
    f.__pasos=1;f.__orig=orig;window.toggleOrderDetails=f;
  }
  enganchar();setInterval(enganchar,1000);
})();
