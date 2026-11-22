/* ===== Pidemás · Motorizado · servicios por pasos =====
   Recojo y entrega, compra y encomienda con la misma vista por pasos que los pedidos de tienda.
   Usa las mismas acciones que ya tenía la app (aceptar, en camino, en agencia, cobrar, entregar). */
(function(){
  if(window.__pdPasosSvc||!window.PdPasos)return;window.__pdPasosSvc=1;
  const U=PdPasos.util,E=U.E,M=U.money;
  const L=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const D=()=>{try{return db}catch(e){return window.db}};
  const ME=()=>{try{return moto}catch(e){return null}};
  const tipo=o=>{const t=String(o?.tipo_servicio||'').toLowerCase();return t.includes('encomienda')?'enc':t.includes('compra')?'compra':t.includes('recojo')?'recojo':''};
  const esSvc=o=>!!o&&!!tipo(o);
  const st=o=>String(o?.estado||'').toLowerCase().trim();
  const yape=o=>String(o.metodo_pago||'').toLowerCase()==='yape';
  const efectivo=o=>!yape(o)&&String(o.metodo_pago||'').toLowerCase()!=='plim';
  const aCobrar=o=>o.pago_acordado==='solo_delivery'?Number(o.costo_delivery||0):Number(o.total||0);
  const prepago=o=>o.pago_acordado==='pagado'||(o.pago_confirmado===true&&!(Number(o.monto_recibido)>0));
  const momento=o=>{const m=String(o.pago_servicio_momento||'').toLowerCase();if(m)return m;if(o.pago_confirmado===true)return 'pagado';return yape(o)?'recojo_yape':'recojo_efectivo'};
  const alRecoger=o=>typeof window.pdCobraAlRecoger==='function'?!!window.pdCobraAlRecoger(o):false;
  const cobroRecPend=o=>alRecoger(o)&&o.pago_confirmado!==true&&Number(o.total)>0&&!['asignado','entregado','cancelado'].includes(st(o));
  const cobroEntrega=o=>tipo(o)!=='enc'&&!alRecoger(o)&&!prepago(o)&&aCobrar(o)>0;
  const servicio=o=>Number(o.costo_delivery)>0?Number(o.costo_delivery):(Number(o.subtotal)>0?Math.max(0,Number(o.total)-Number(o.subtotal)):Number(o.total)||0);
  const sinMonto=o=>tipo(o)==='compra'&&!(Number(o.subtotal)>0);
  const draft=id=>{const d=window.__pidemasCashDrafts||{};return d[String(id)]||''};
  const setDraft=(id,v)=>{(window.__pidemasCashDrafts=window.__pidemasCashDrafts||{})[String(id)]=v};
  const extra=o=>{try{return typeof extractRecojoEntregaExtra==='function'?extractRecojoEntregaExtra(o.observaciones):{}}catch(e){return {}}};
  const link=v=>{const t=String(v||'').trim();if(!t)return '';return /^https?:\/\//i.test(t)?t:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(t)};
  const arr=v=>{if(Array.isArray(v))return v;try{const p=JSON.parse(v||'[]');return Array.isArray(p)?p:[]}catch(e){return []}};
  let abierto=null,error='',info='';
  const DR={};const dr=id=>DR[id]||(DR[id]={modo:null,monto:'',gasto:'',caja:'',pk:{}});

  /* ---------- datos de compra (vienen escritos en las observaciones) ---------- */
  function compra(o){
    const raw=String(o.observaciones||'').replace(/__PIDEMAS_[A-Z_]+__\s*\{[^{}]*\}/g,'').replace(/\[COMPROBANTE_YAPE:[^\]]*\]/gi,'').replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/g,'');
    const get=(...ls)=>{for(const l of ls){const x=l.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=raw.match(new RegExp('(?:^|[|]\\s*)'+x+'\\s*:\\s*([^|]*)','i'));if(m&&m[1].trim())return m[1].trim()}return ''};
    const ubi=get('Ubicación','Ubicación del cliente');
    return {url:(String(o.direccion_recojo||get('Lugar de compra','¿De dónde desea la compra?')||'').match(/https?:\/\/\S+/)||[''])[0],lugar:String(o.direccion_recojo||get('Lugar de compra','¿De dónde desea la compra?')||'').replace(/https?:\/\/\S+/g,'').replace(/[\s·,|-]+$/,'').trim(),detalle:get('Compra solicitada','¿Qué desea que compremos?'),
      comp:get('Comprobante'),doc:get('DNI/RUC'),ubi:link(ubi),
      obs:raw.split('|').flatMap(x=>x.split('·')).map(x=>x.trim()).filter(x=>x&&!/^(Ubicación(?: del cliente)?|Compra solicitada|Comprobante|DNI\/RUC|Lugar de compra|¿De dónde desea la compra\?|¿Qué desea que compremos\?)\s*:/i.test(x)&&!/^(Servicio marcado como PAGADO|Pago en efectivo|Pago por Yape|Paga quien|Pedido a nombre de)/i.test(x)).join(' · ')};
  }
  function notas(o){const x=extra(o);let n=String(x.clean||'');try{if(typeof cleanDeliveryTariffFromObservaciones==='function')n=cleanDeliveryTariffFromObservaciones(n)}catch(_){}
    try{if(typeof window.pdLimpiarNotas==='function')n=window.pdLimpiarNotas(n)}catch(_){}
    return String(n||'').replace(/servicio marcado como PAGADO[^|·]*/ig,'').replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/g,'').replace(/__PIDEMAS_[A-Z_]+__\s*\{[^{}]*\}/g,'').replace(/^[\s|·]+|[\s|·]+$/g,'').trim()}

  /* ---------- encomienda: paquetes y guías ---------- */
  function paquetes(o){
    const ex=(typeof extractEncomiendaPackages==='function'?extractEncomiendaPackages(o.observaciones):[])||[];
    return [{numero:1,agencia:o.agencia_destino||'',destino:o.destino_final||o.direccion_entrega||'',tipoPago:o.tipo_pago_encomienda}]
      .concat(ex.map(p=>({numero:Number(p.numero)||0,agencia:p.agencia||'',destino:p.destino||'',tipoPago:p.tipoPago})))
      .filter((p,i,a)=>p.numero&&a.findIndex(x=>x.numero===p.numero)===i);
  }
  const guardados=o=>{const g=arr(o.paquetes_envio).slice();if(!g.some(x=>Number(x.numero)===1)&&o.guia_url){const sc=String(o.clave_guia||'').trim()==='SIN_CLAVE';g.push({numero:1,guia_url:o.guia_url,clave:sc?'':String(o.clave_guia||''),sin_clave:sc||(!o.clave_guia&&String(o.observaciones||'').includes('SIN_CLAVE_GUIA_CONFIRMADO'))})}return g};
  const pkgOk=p=>!!(p&&(p.enviado_whatsapp||(p.guia_url&&p.guia_url!=='whatsapp'&&(p.sin_clave||String(p.clave||'').trim()))));
  const completo=o=>{const g=guardados(o);return paquetes(o).every(p=>pkgOk(g.find(x=>Number(x.numero)===p.numero)))};
  const enAgencia=o=>o.pedido_en_agencia===true||String(o.pedido_en_agencia||'').toLowerCase()==='true';
  const pagoAg=o=>o.tipo_pago_encomienda==='pago_en_agencia';
  const cajaPago=o=>String(o.observaciones||'').includes('PAGO_ENCOMIENDA_CAJA_CONFIRMADO');
  function waAdmin(){const c=typeof window.pdYapeCfg==='function'?window.pdYapeCfg():null;let ph=String(c&&c.whatsapp_admin||'986233533').replace(/\D/g,'');if(ph.length===9)ph='51'+ph;return ph}
  function textoGuia(o,p,clave,sin){
    return ['*PIDEMÁS · GUÍA DE ENCOMIENDA*','Pedido #'+String(o.id).slice(0,8).toUpperCase(),'Paquete '+p.numero+': '+([p.agencia,p.destino].filter(Boolean).join(' → ')||'—'),
      'Clave de recojo: '+(sin?'la agencia no dio clave':clave),'Cliente: '+(o.nombre_remitente||o.nombre_cliente||'—')+((o.telefono_remitente||o.telefono_cliente)?' · '+(o.telefono_remitente||o.telefono_cliente):''),
      'Motorizado: '+String(ME()?.nombre_completo||'').trim(),'(Foto de la guía adjunta)'].join('\n');
  }
  async function marcarEnviado(o,n,sin){
    const lista=guardados(o).filter(x=>Number(x.numero)!==n&&!(x.guia_url==='whatsapp'));
    lista.push({numero:n,enviado_whatsapp:true,sin_clave:!!sin,enviado_en:new Date().toISOString()});
    lista.sort((a,b)=>a.numero-b.numero);
    const patch={paquetes_envio:lista};
    if(completo({...o,paquetes_envio:lista})){patch.guia_url='whatsapp';patch.clave_guia='ENVIADA_POR_WHATSAPP'}
    const {data,error:e}=await D().from('pedidos').update(patch).eq('id',o.id).eq('motorizado_id',ME().id).select('id').maybeSingle();
    if(e)throw new Error(e.message);if(!data)throw new Error('Supabase no confirmó el registro del envío.');
    Object.assign(o,patch);return completo(o);
  }
  const abrirWa=url=>{if(typeof window.pdOpenWhatsApp==='function')window.pdOpenWhatsApp(url);else window.open(url,'_blank')};
  async function enviarGuia(o,n,chat){
    error='';info='';const d=dr(o.id).pk[n]||{};
    if(!d.file&&!chat){error='Toma la foto de la guía o voucher del paquete '+n+'.';return}
    if(!d.sin&&!String(d.clave||'').trim()){error='Escribe la clave del paquete '+n+' o marca que la agencia no dio clave.';return}
    const p=paquetes(o).find(x=>x.numero===n)||{numero:n};const txt=textoGuia(o,p,String(d.clave||'').trim(),!!d.sin);
    const done=async()=>{try{const all=await marcarEnviado(o,n,d.sin);delete dr(o.id).pk[n];info=all?'Listo: enviaste todas las guías a Administración. Ya puedes terminar la encomienda.':'Paquete '+n+' enviado a Administración.';try{await loadOrders()}catch(_){}}
      catch(e){error='Se abrió WhatsApp, pero no se pudo registrar el envío: '+(e.message||e)}};
    if(chat){abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt.replace('(Foto de la guía adjunta)','(Te envío la foto de la guía)')));info='En el chat del admin toca la cámara, toma la foto de la guía y envía.';await done();return}
    try{const fl=new File([d.file],'guia_paquete_'+n+'.'+(((d.file.type||'').split('/')[1]||'jpg').replace('jpeg','jpg')),{type:d.file.type||'image/jpeg'});
      if(navigator.canShare&&navigator.canShare({files:[fl]})){try{await navigator.share({files:[fl],text:txt,title:'Guía paquete '+n});await done()}catch(err){if(err&&err.name==='AbortError')error='No se envió la guía. Vuelve a tocar el botón y elige WhatsApp → Administración.';else{abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt));await done()}}return}}catch(_){}
    abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt.replace('(Foto de la guía adjunta)','(Te adjunto la foto de la guía)')));info='Adjunta la foto de la guía en el chat de WhatsApp de Administración.';await done();
  }

  /* ---------- cobros y compra (mismas reglas que la ventana anterior) ---------- */
  async function cobrarAlRecoger(o){
    const d=dr(o.id),modo=d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo'),total=Number(o.total)||0;let paga=total;
    if(modo==='efectivo'){const raw=String(d.monto||'').trim();paga=raw===''?total:Number(raw.replace(',','.'));if(!(paga>=total-0.0001)){error='El cliente debe pagar al menos '+M(total)+'.';return}}
    let vueltoDe='';if(modo==='efectivo'&&paga-total>0.004&&typeof window.pdElegirVuelto==='function'){vueltoDe=await window.pdElegirVuelto(Math.round((paga-total)*100)/100,total,paga);if(!vueltoDe)return}
    if(!(await pdConfirmar(modo==='efectivo'?`¿Registrar cobro de ${M(total)} en efectivo?`:`¿Confirmas que el cliente ya pagó ${M(total)} por Yape al QR de Pidemás? Revisa la constancia en su celular.`)))return;
    try{
      const upd={pago_confirmado:true,metodo_pago:modo,monto_recibido:Math.round(paga*100)/100};
      const {error:ue}=await D().from('pedidos').update(upd).eq('id',o.id).eq('motorizado_id',ME().id);if(ue)throw ue;
      try{await D().from('cobros').upsert({pedido_id:o.id,motorizado_id:ME().id,monto:total,metodo_pago:modo,confirmado:true,confirmado_en:new Date().toISOString()},{onConflict:'pedido_id'})}catch(_){}
      if(modo==='efectivo'){
        const {data:prev}=await D().from('movimientos_caja').select('id').eq('motorizado_id',ME().id).eq('pedido_id',o.id).eq('tipo','ingreso').not('descripcion','ilike','INGRESO MANUAL%').limit(1);
        if(!(prev&&prev.length)){const {error:me}=await D().from('movimientos_caja').insert({motorizado_id:ME().id,pedido_id:o.id,tipo:'ingreso',monto:Math.round(total*100)/100,
          descripcion:(tipo(o)==='enc'?'Cobro de encomienda':'Cobro de recojo')+' · total S/ '+total.toFixed(2)+' · cliente pagó con S/ '+paga.toFixed(2)+' · vuelto entregado S/ '+Math.max(0,paga-total).toFixed(2)+(vueltoDe?(vueltoDe==='caja'?' · VUELTO DE CAJA':' · VUELTO CON DINERO PROPIO'):'')});if(me)throw me}
      }
      Object.assign(o,upd);d.monto='';
      try{await loadOrders()}catch(_){}try{if(typeof window.loadCash==='function')await window.loadCash()}catch(_){}
    }catch(err){error='No se pudo registrar el cobro: '+(err?.message||err)}
  }
  async function registrarCompra(o){
    error='';const v=Number(String(dr(o.id).gasto||'').replace(',','.'));if(!(v>0)){error='Escribe cuánto gastaste en la compra.';return}
    const sv=servicio(o),pre=o.pago_confirmado===true;
    if(!(await pdConfirmar(`¿Registrar gasto de compra de ${M(v)}?\nSale de tu caja y ${pre?'el pedido ya está pagado.':'cobrarás al cliente '+M(v+sv)+'.'}`)))return;
    try{
      const {data:prev}=await D().from('movimientos_caja').select('id').eq('motorizado_id',ME().id).eq('pedido_id',o.id).eq('tipo','retiro').ilike('descripcion','PAGO DE COMPRA%').limit(1);
      if(!(prev&&prev.length)){const {error:me}=await D().from('movimientos_caja').insert({motorizado_id:ME().id,pedido_id:o.id,tipo:'retiro',monto:Math.round(v*100)/100,descripcion:'PAGO DE COMPRA · Pedido #'+String(o.id).slice(0,8).toUpperCase()});if(me)throw me}
      const upd={subtotal:Math.round(v*100)/100,costo_delivery:Math.round(sv*100)/100};if(!pre)upd.total=Math.round((v+sv)*100)/100;
      const {error:ue}=await D().from('pedidos').update(upd).eq('id',o.id).eq('motorizado_id',ME().id);if(ue)throw ue;
      Object.assign(o,upd);dr(o.id).gasto='';
      try{await loadOrders()}catch(_){}try{if(typeof window.loadCash==='function')await window.loadCash()}catch(_){}
    }catch(err){error='No se pudo registrar la compra: '+(err?.message||err)}
  }
  async function pagarAgencia(o){
    const v=String(dr(o.id).caja||'').trim();if(!(Number(v.replace(',','.'))>0)){error='Escribe cuánto pagaste en la agencia.';return}
    const i=document.createElement('input');i.id='encCaja_'+o.id;i.value=v;i.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(i);
    try{await correr('payEncomiendaFromCaja',o.id)}finally{i.remove()}
  }
  async function correr(fn,id){
    error='';info='';
    if(typeof window[fn]!=='function'){error='Esta acción no está disponible. Actualiza la app.';return}
    const box=document.getElementById('appMsg');const antes=box?box.textContent:'';
    try{await window[fn](id)}catch(e){error=String(e?.message||e)}
    const ahora=box&&!box.classList.contains('hidden')?String(box.textContent||'').trim():'';
    if(!error&&ahora&&ahora!==antes&&!/^✓|correctamente|devuelto|Encomienda marcada/i.test(ahora))error=ahora;
  }
  function I_v(v,tot){const n=Number(String(v||'').replace(',','.'));
    if(!(n>0))return U.I.info+'<span>Escribe con cuánto te paga para calcular el vuelto.</span>';
    if(n+0.004<tot)return U.I.info+'<span>Es menos que el total ('+M(tot)+').</span>';
    const vu=Math.round((n-tot)*100)/100;return U.I.info+'<span>Paga con <b>'+M(n)+'</b>'+(vu>0.004?' · lleva <b>'+M(vu)+'</b> de vuelto':' · sin vuelto')+'</span>'}
  const qrBtn=o=>{const qn=typeof window.pdQrDePedido==='function'?window.pdQrDePedido(o.id):null;
    return `<button type="button" class="qr" data-act="qr"><span class="im"${qn&&qn.url?` style="background-image:url('${E(qn.url)}')"`:''}>${qn&&qn.url?'':'QR'}</span><span class="t"><span class="k">${qn&&qn.negocio?'Yape del negocio':'Yape de Pidemás'}</span><span class="a">${E(qn&&qn.titular||qn&&qn.nombre||'')}</span><span class="b2">${E(qn&&qn.numero||'')}</span><span class="c">Toca para agrandar</span></span></button>`};
  function bloqueCobroRec(o){
    const d=dr(o.id),modo=d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo');
    let h=`<div class="amt"><div class="k">Cobra al recoger</div><div class="n">${M(o.total)}</div><div class="pill">${modo==='yape'?'Yape':'Efectivo'}</div></div>`+
      U.note(tipo(o)==='enc'?'Cóbrale a quien envía antes de llevar los paquetes a la agencia.':'Paga quien envía'+(o.nombre_remitente?' ('+E(o.nombre_remitente)+')':'')+': cóbrale al recoger, antes de salir a entregar.')+
      `<div class="quick" data-act="modo"><button type="button" data-m="efectivo" class="${modo==='efectivo'?'on':''}">Efectivo</button><button type="button" data-m="yape" class="${modo==='yape'?'on':''}">Yape</button></div>`;
    if(modo==='efectivo')h+=`<div><div class="lbl">¿Con cuánto paga? (vacío = exacto)</div><input class="inp" data-act="rmonto" inputmode="decimal" placeholder="${M(o.total)}" value="${E(d.monto)}"></div><div class="note" data-vr>${I_v(d.monto||o.total,Number(o.total))}</div>`;
    else h+=qrBtn(o)+U.note('Revisa en el celular del cliente que el Yape se hizo y guarda la captura para el cierre de caja.');
    return h;
  }

  /* ---------- el modelo de la vista ---------- */
  function rapidos(o,quien,etapaN){
    {const eN=etapa(o);if(eN>=9||eN<0)return '';if(etapaN!=null&&!(eN===etapaN||(etapaN===3&&eN>=3)))return ''}/* mensajes rápidos solo en el paso que estás haciendo */
    const yo=String(ME()?.nombre_completo||'tu motorizado').split(' ')[0],ref=U.ref(o.id);
    const nom=quien==='rem'?(o.nombre_remitente||o.nombre_cliente):(tipo(o)==='compra'?o.nombre_cliente:(o.nombre_receptor||o.nombre_cliente));
    const tel=quien==='rem'?(o.telefono_remitente||o.telefono_cliente):(tipo(o)==='compra'?o.telefono_cliente:(o.telefono_receptor||o.telefono_cliente));
    const h='Hola'+(nom?' '+String(nom).split(' ')[0]:'')+', soy '+yo+' de *Pidemás Delivery* 🛵. ';
    const cob=quien!=='rem'&&cobroEntrega(o)?(efectivo(o)?' Ten listo '+M(aCobrar(o))+' en efectivo, por favor.':' Ten listo tu Yape para pagar '+M(aCobrar(o))+', por favor.'):'';
    const cobR=quien==='rem'&&cobroRecPend(o)?' Ten listo '+M(o.total)+' para el pago del servicio, por favor.':'';
    let L;
    if(quien==='rem')L=tipo(o)==='compra'?[['Estoy haciendo tu compra',h+'Ya estoy haciendo tu compra del pedido '+ref+'. Te aviso cualquier cosa.'],['No hay un producto, ¿lo cambio?',h+'No encuentro uno de los productos de tu compra '+ref+'. ¿Lo cambio por otro o lo quito?']]
      :[['Voy a recoger el paquete',h+'Ya voy a recoger tu envío '+ref+'.'+cobR],['Llego en 5 minutos a recoger',h+'Llego en unos 5 minutos a recoger tu envío '+ref+'.'+cobR],['Ya llegué, estoy afuera',h+'Ya llegué para recoger tu envío '+ref+'. Estoy afuera, ¿puedes salir?'+cobR],['No encuentro la dirección',h+'No encuentro la dirección de recojo. ¿Me envías tu ubicación o una referencia, por favor?']];
    else L=[[tipo(o)==='compra'?'Ya tengo tu compra, voy en camino':'Ya recogí el pedido, voy en camino',h+(tipo(o)==='compra'?'Ya hice tu compra ':'Ya tengo tu pedido ')+ref+' y voy en camino.'+cob],['Llego en unos 5 minutos',h+'Llego en unos 5 minutos con tu pedido '+ref+'.'+cob],['Ya llegué, estoy afuera',h+'Ya llegué, estoy afuera de tu domicilio con tu pedido '+ref+'. ¿Puedes salir a recibirlo?'+cob],['No encuentro la dirección',h+'Estoy cerca pero no encuentro tu dirección. ¿Me envías tu ubicación o una referencia, por favor?'],['Te estoy llamando',h+'Te estoy llamando para entregarte tu pedido '+ref+'. Por favor contesta o escríbeme.'],['Hay tráfico, me demoro un poco',h+'Hay bastante tráfico, me demoro unos minutos más con tu pedido '+ref+'. ¡Gracias por tu paciencia!']];
    return U.rapidos(tel,L,quien==='rem'?(tipo(o)==='compra'?'Mensajes rápidos al cliente':'Mensajes rápidos a quien envía'):'Mensajes rápidos a quien recibe');
  }
  function etapa(o){
    const s=st(o),t=tipo(o);
    if(s==='entregado')return 9;if(s==='cancelado')return -1;if(s==='asignado')return 0;
    if(t==='enc'){if(completo(o)&&enAgencia(o))return 4;if(enAgencia(o))return 3;if(['en_camino','camino_entrega','en_entrega','confirmando_pago'].includes(s))return 2;return 1}
    if(['aceptado','pedido_aceptado','camino_recojo'].includes(s))return 1;
    if(['en_camino','camino_entrega'].includes(s))return 2;
    if(['en_entrega','confirmando_pago'].includes(s))return cobroEntrega(o)&&o.pago_confirmado!==true?3:4;
    return 1;
  }
  function modelo(){
    const o=L().find(x=>String(x.id)===String(abierto));if(!o)return null;
    const t=tipo(o),e=etapa(o),id=o.id,d=dr(id),x=extra(o),cp=t==='compra'?compra(o):null;
    const NOM={enc:'Encomienda',compra:'Compra',recojo:'Recojo y entrega'}[t];
    const remN=o.nombre_remitente||o.nombre_cliente||'Cliente',remT=o.telefono_remitente||o.telefono_cliente;
    const recN=t==='compra'?(o.nombre_cliente||o.nombre_remitente||'Cliente'):(o.nombre_receptor||o.nombre_cliente||'Quien recibe'),recT=t==='compra'?(o.telefono_cliente||o.telefono_remitente):(o.telefono_receptor||o.telefono_cliente);
    const cobro=cobroEntrega(o);
    const titulos=t==='enc'?['Recoger los paquetes','Llevar a la agencia','Guía y clave','Terminar encomienda']
      :[t==='compra'?'Hacer la compra':'Recoger','Llevar al cliente'].concat(cobro?['Cobrar']:[]).concat(['Confirmar entrega']);
    const etapaDe=t==='enc'?[1,2,3,4]:[1,2].concat(cobro?[3]:[]).concat([4]);
    const pos=e>=9?99:e===-1?-1:e===0?1:e;
    const steps=titulos.map((tt,i)=>({title:tt,state:pos===99||etapaDe[i]<pos?'done':etapaDe[i]===pos?'active':'locked'}));
    const S=k=>steps[etapaDe.indexOf(k)];
    const msg=(info?U.st(E(info),'ok'):'');

    /* 1 · Recoger / comprar */
    {const s=S(1);
      if(t==='compra'){
        s.sum=(cp.lugar||'Compra')+(Number(o.subtotal)>0?' · gasto '+M(o.subtotal):'');
        const mapaLugar=cp.lugar||cp.url?U.maps(o.latitud_recojo,o.longitud_recojo,cp.lugar,cp.url||''):'';
        /* lugar de compra junto con su ubicación; el cliente (llamar / WhatsApp) va aparte */
        let h=U.who(cp.lugar||'Lugar no indicado','Compra aquí · pedido '+E(U.ref(id)),'')+
          `<a class="b o" style="display:flex;width:100%;box-sizing:border-box;justify-content:center${mapaLugar?'':';opacity:.45;pointer-events:none'}"${mapaLugar?` href="${E(mapaLugar)}" target="_blank" rel="noopener"`:' aria-disabled="true"'}>${U.I.nav||''}Ir al lugar de compra</a>`+
          `<div class="sum"><div class="lbl">Qué comprar</div><div style="font-size:15px;line-height:1.5;white-space:pre-line;color:#1F1A17;overflow-wrap:anywhere">${E(cp.detalle||'—')}</div></div>`+(cp.comp||cp.doc?`<div class="sum"><div class="lbl">Comprobante</div>${cp.comp?`<div class="li"><span>Tipo</span><b>${E(cp.comp)}</b></div>`:''}${cp.doc?`<div class="li"><span>DNI/RUC</span><b>${E(cp.doc)}</b></div>`:''}</div>`:'')+
          (cp.obs?U.note(E(cp.obs)):'')+
          `<div class="sum"><div class="lbl">Cliente</div>`+U.who(remN,'Quien pide la compra','',true)+U.contact(null,remT,'Hola, soy el motorizado de Pidemás por tu compra '+U.ref(id)+'.')+`</div>`;
        if(e>=1&&e<9){const sv=servicio(o);
          if(Number(o.subtotal)>0)h+=`<div class="sum"><div class="lbl">Montos</div><div class="li"><span>Gasto de la compra</span><b>${M(o.subtotal)}</b></div><div class="li"><span>Servicio</span><b>${M(sv)}</b></div><div class="li t"><span>${o.pago_confirmado===true?'Ya pagado':'Cobrarás al cliente'}</span><b>${M(o.pago_confirmado===true?0:Number(o.subtotal)+sv)}</b></div></div>`;
          else h+=`<div><div class="lbl">¿Cuánto gastaste en la compra?</div><input class="inp" data-act="gasto" inputmode="decimal" placeholder="S/ 0.00" value="${E(d.gasto)}"></div><div class="note" data-gt>${U.I.info}<span>Sale de tu caja y se suma al cobro: cobrarás <b>${M((Number(d.gasto)||0)+sv)}</b> (servicio ${M(sv)}).</span></div>`}
        s.body=msg+h;
      }else{
        s.sum=remN+(o.direccion_recojo?' · '+o.direccion_recojo:'');
        let h=U.who(remN,(t==='enc'?'Quien envía':'Recoges aquí')+' · pedido '+E(U.ref(id))+(o.recojo_a_nombre?`<div style="margin-top:2px">A nombre de <b style="color:#1F1A17">${E(o.recojo_a_nombre)}</b></div>`:''),'',true)+U.addr(o.direccion_recojo,o.referencia_recojo)+
          U.contact(U.maps(o.latitud_recojo,o.longitud_recojo,o.direccion_recojo,link(x.ubicacionRecojo||o.ubicacion_recojo||o.link_recojo)),remT,'Hola, soy el motorizado de Pidemás por el pedido '+U.ref(id)+'.');
        if(t==='recojo'){const n=String(notas(o)||'').split(/\s*·\s*/).filter(z=>z&&!/^(Pago en efectivo|Pago por Yape|Paga quien|Servicio marcado como PAGADO|Pedido a nombre de)/i.test(z)).join(' · ');if(n)h+=`<div class="sum"><div class="lbl">Notas del servicio</div><div style="font-size:15px;line-height:1.5;color:#1F1A17;overflow-wrap:anywhere">${E(n)}</div></div>`}
        if(t==='enc')h+=`<div class="sum"><div class="lbl">Paquetes</div>${paquetes(o).map(p=>`<div class="li"><span>${p.numero} · ${E([p.agencia,p.destino].filter(Boolean).join(' → ')||'—')}</span><b>${p.tipoPago==='pago_en_agencia'?'Pago en agencia':'Pago a destino'}</b></div>`).join('')}</div>`;
        s.body=msg+h;
      }
      if(e>=1&&cobroRecPend(o))s.body+=bloqueCobroRec(o);
      else if(alRecoger(o)&&o.pago_confirmado===true)s.body+=U.st('Cobro registrado · '+M(o.total)+' · '+(yape(o)?'Yape':'Efectivo'),'ok');
      else if(t==='enc'&&momento(o)==='pagado')s.body+=U.st('Ya pagado · no cobres nada','ok');
      else if(t==='enc'&&momento(o)==='al_final')s.body+=U.note('No cobres ahora: el cliente paga después de recibir la guía y la clave.');
      if(e===0)s.body+=U.note('Acepta el pedido para empezar.');else if(e===1)s.body+=rapidos(o,'rem',1);}

    if(t==='enc'){
      /* 2 · Llevar a la agencia */
      {const s=S(2);s.locked='Se muestra al recoger los paquetes';const ps=paquetes(o);s.sum=ps.map(p=>p.agencia).filter(Boolean).join(' · ')||'En agencia';
        s.body=msg+`<div class="sum"><div class="lbl">Lleva a</div>${ps.map(p=>`<div class="li"><span>Paquete ${p.numero}</span><b style="text-align:right">${E([p.agencia,p.destino].filter(Boolean).join(' → ')||'—')}</b></div>`).join('')}</div>`+
          U.who(o.nombre_receptor||'—','Quien recibe en destino'+(o.telefono_receptor?' · '+E(o.telefono_receptor):''),'',true);}
      /* 3 · Guía y clave */
      {const s=S(3);s.locked='Se muestra al llegar a la agencia';s.sum='Guías enviadas a Administración';const fin=['entregado','cancelado'].includes(st(o));
        let h=msg;
        if(pagoAg(o)&&!cajaPago(o)&&!fin){h+=`<div class="amt"><div class="k">Pagas el envío en la agencia</div><div class="n">${d.caja?M(Number(String(d.caja).replace(',','.'))||0):'S/ —'}</div><div class="pill">Sale de tu caja</div></div><div><div class="lbl">Total pagado en la agencia</div><input class="inp" data-act="caja" inputmode="decimal" placeholder="S/ 0.00" value="${E(d.caja)}"></div>`+U.note('Se registra en tu caja como <b>Pago de encomienda</b>.')}
        else{if(pagoAg(o)&&cajaPago(o))h+=U.st('Pago en agencia registrado en tu caja','ok');
          const g=guardados(o);
          h+=paquetes(o).map(p=>{const sv=g.find(y=>Number(y.numero)===p.numero),ruta=E([p.agencia,p.destino].filter(Boolean).join(' → ')||'Paquete');
            if(pkgOk(sv))return `<div class="sum"><div class="li"><span>Paquete ${p.numero} · ${ruta}</span><b style="color:#15803D">${sv.enviado_whatsapp?'Enviado':'Completo'}</b></div></div>`;
            if(fin)return `<div class="sum"><div class="li"><span>Paquete ${p.numero} · ${ruta}</span><b>Sin guía</b></div></div>`;
            const k=d.pk[p.numero]||(d.pk[p.numero]={});
            return `<div class="sum"><div class="lbl">Paquete ${p.numero} · ${ruta}</div>
              <button type="button" class="b soft" data-act="shot${p.numero}">${k.file?'Foto lista · tocar para cambiar':'Tomar foto de la guía o voucher'}</button><input type="file" data-act="file${p.numero}" accept="image/jpeg,image/png,image/webp" capture="environment" hidden data-pd-cloud="1">
              ${k.url?`<img src="${E(k.url)}" alt="Guía del paquete ${p.numero}" style="width:100%;max-height:180px;object-fit:cover;border-radius:12px">`:''}
              <input class="inp" data-act="clave${p.numero}" placeholder="Clave de recojo" value="${E(k.clave||'')}"${k.sin?' disabled':''}>
              <button type="button" class="b" data-act="sin${p.numero}">${k.sin?'✓ ':''}La agencia no dio clave</button>
              <div class="btns b2"><button type="button" class="b o" data-act="wa${p.numero}">Enviar por WhatsApp</button><button type="button" class="b g" data-act="chat${p.numero}">Chat del admin</button></div></div>`}).join('');}
        s.body=h;}
      /* 4 · Terminar */
      {const s=S(4);s.locked='Se muestra al enviar las guías';s.sum='Encomienda terminada';s.body=msg+U.st('Guías y claves enviadas a Administración. Administración se las manda al cliente.','ok');}
    }else{
      /* 2 · Llevar al cliente */
      {const s=S(2);s.locked=t==='compra'?'Se muestra al terminar la compra':'Se muestra al recoger';s.sum=recN+(o.direccion_entrega?' · '+o.direccion_entrega:'');
        const mapa=U.maps(o.latitud_entrega,o.longitud_entrega,o.direccion_entrega,link(o.ubicacion_entrega||x.ubicacionEntrega)||(cp&&cp.ubi));
        s.body=msg+U.who(recN,(t==='compra'?'Cliente':'Quien recibe')+' · entregas aquí','',true)+U.addr(o.direccion_entrega,o.referencia_entrega)+U.contact(mapa,recT,'')+
          rapidos(o,'rec',2);}
      /* 3 · Cobrar */
      if(cobro){const s=S(3);s.locked='Se muestra al llegar donde el cliente';const monto=aCobrar(o);
        s.sum='Cobrado '+M(monto)+' · '+(yape(o)?'Yape':'Efectivo');
        let h=msg+`<div class="amt"><div class="k">Cobra al cliente</div><div class="n">${M(monto)}</div><div class="pill">${yape(o)?'Yape':'Efectivo'}</div></div>`;
        if(t==='compra'&&Number(o.subtotal)>0)h+=`<div class="sum"><div class="lbl">Montos</div><div class="li"><span>Compra</span><b>${M(o.subtotal)}</b></div><div class="li"><span>Servicio</span><b>${M(servicio(o))}</b></div><div class="li t"><span>Total</span><b>${M(Number(o.subtotal)+servicio(o))}</b></div></div>`;
        if(yape(o))h+=qrBtn(o)+U.note('Confirma solo cuando veas la constancia del pago en el celular del cliente.');
        else{const v=draft(id),vals=[];[10,20,50,100,200].forEach(z=>{const r=Math.ceil(monto/z)*z;if(r>monto+0.004&&!vals.includes(r))vals.push(r)});
          h+=`<div><div class="lbl">¿Con cuánto paga?</div><input class="inp" data-act="cash" inputmode="decimal" placeholder="${M(monto)}" value="${E(v)}"></div><div class="quick" data-act="quick">${[monto].concat(vals.slice(0,3)).map((z,i)=>`<button type="button" data-v="${z.toFixed(2)}" class="${Number(v)===z?'on':''}">${i?'S/ '+z:'Exacto'}</button>`).join('')}</div><div class="note" data-vuelto>${I_v(v,monto)}</div>`}
        s.body=h;}
      /* 4 · Confirmar entrega */
      {const s=S(4);s.locked=cobro?'Se muestra después de cobrar':'Se muestra al llegar donde el cliente';s.sum='Entregado';
        s.body=msg+(cobro?U.st('Cobrado '+M(aCobrar(o))+' · '+(yape(o)?'Yape':'Efectivo'),'ok'):U.st(alRecoger(o)||prepago(o)?'Ya está pagado: no cobres nada.':'No hay nada que cobrar.','ok'))+U.note('Entrega el pedido a '+E(recN)+' y confirma.')+rapidos(o,'rec',3);}
    }

    const m={kicker:NOM+' · '+U.ref(id),steps,err:error,acts:{}};
    if(e===-1){m.title='Pedido cancelado';m.chip='Cancelado';m.chipCls='mal';steps.forEach(s=>s.state='locked');m.fin={mal:true,title:'Este pedido fue cancelado',text:o.motivo_cancelacion||'Ya no tienes que hacer nada con él.'};return m}
    if(e>=9){m.title='Entregado';m.chip='Listo';m.chipCls='ok';m.fin={title:t==='enc'?'¡Encomienda terminada!':'¡Pedido entregado!',text:o.entregado_en?'Terminado a las '+U.hora(o.entregado_en)+'.':''};return m}
    const actual=steps.findIndex(s=>s.state==='active')+1;
    m.title=e===0?'Pedido nuevo':steps[actual-1]?steps[actual-1].title:NOM;
    m.chip=e===0?'Nuevo':'Paso '+actual+' de '+steps.length;
    if(e===0){m.cta={label:'Aceptar pedido',run:()=>correr('acceptOrder',id)};m.alt=[{label:'Rechazar pedido',mal:true,run:()=>correr('rejectOrder',id)}]}
    else if(e===1){
      if(cobroRecPend(o)){const modo=d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo');m.cta={label:modo==='yape'?'Ya pagó por Yape · '+M(o.total):'Ya cobré '+M(o.total),busy:'Registrando cobro…',run:()=>cobrarAlRecoger(o)}}
      else if(t==='compra'&&sinMonto(o))m.cta={label:'Registrar compra',busy:'Registrando…',run:()=>registrarCompra(o)};
      else m.cta={label:t==='enc'?'Recogí los paquetes':t==='compra'?'Compra lista · voy al cliente':'Ya recogí el pedido',run:()=>correr('startOrder',id)};
    }
    else if(e===2)m.cta=t==='enc'?{label:'Llegué a la agencia',run:()=>correr('confirmEncomiendaAgency',id)}:{label:'Llegué donde el cliente',run:()=>correr('markInDelivery',id)};
    else if(e===3){
      if(t==='enc'){if(pagoAg(o)&&!cajaPago(o))m.cta={label:'Pagar envío con mi caja',busy:'Registrando pago…',run:()=>pagarAgencia(o)};else m.cta={label:'Envía las guías al admin',off:true,hint:'Toma la foto y la clave de cada paquete y envíalas por WhatsApp'}}
      else m.cta={label:'Ya cobré '+M(aCobrar(o)),busy:'Registrando cobro…',run:async()=>{if(efectivo(o)){const v=Number(String(draft(id)).replace(',','.'));if(!(v>0)){error='Escribe con cuánto te paga el cliente.';return}}await correr('confirmPayment',id)}};
    }
    else if(e===4)m.cta={label:t==='enc'?'Terminar encomienda':'Finalizar entrega',green:true,busy:'Finalizando…',run:()=>correr('deliverOrder',id)};
    if(e>=1&&typeof window.pdReportarProblema==='function')m.alt=[{label:'Tengo un problema',run:()=>window.pdReportarProblema(id)}];

    m.acts={
      qr:()=>{if(typeof window.showYapeQr==='function')window.showYapeQr(id)},
      modo:(box,ev)=>{const b=ev.target.closest('[data-m]');if(!b)return;d.modo=b.dataset.m;error='';PdPasos.render()},
      rmonto:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');d.monto=inp.value;const n=inp.getRootNode().querySelector('[data-vr]');if(n)n.innerHTML=I_v(inp.value||o.total,Number(o.total))},
      gasto:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');d.gasto=inp.value;const n=inp.getRootNode().querySelector('[data-gt] b');if(n)n.textContent=M((Number(inp.value.replace(',','.'))||0)+servicio(o))},
      caja:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');d.caja=inp.value;const n=inp.getRootNode().querySelector('.amt .n');if(n)n.textContent=M(Number(inp.value.replace(',','.'))||0)},
      cash:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');setDraft(id,inp.value);const n=inp.getRootNode().querySelector('[data-vuelto]');if(n)n.innerHTML=I_v(inp.value,aCobrar(o));inp.getRootNode().querySelectorAll('.quick[data-act="quick"] button').forEach(b=>b.classList.toggle('on',Number(b.dataset.v)===Number(inp.value)))},
      quick:(box,ev)=>{const b=ev.target.closest('[data-v]');if(!b)return;error='';setDraft(id,b.dataset.v);const inp=box.getRootNode().querySelector('[data-act="cash"]');if(inp){inp.value=b.dataset.v;inp.dispatchEvent(new Event('input'))}}
    };
    if(t==='enc')paquetes(o).forEach(p=>{const n=p.numero,k=()=>d.pk[n]||(d.pk[n]={});
      m.acts['shot'+n]=b=>{const f=b.getRootNode().querySelector('[data-act="file'+n+'"]');if(f)f.click()};
      m.acts['file'+n]=inp=>{const f=inp.files&&inp.files[0];if(!f)return;const z=k();z.file=f;try{z.url=URL.createObjectURL(f)}catch(_){}PdPasos.render()};
      m.acts['clave'+n]=inp=>{k().clave=inp.value};
      m.acts['sin'+n]=()=>{const z=k();z.sin=!z.sin;if(z.sin)z.clave='';PdPasos.render()};
      m.acts['wa'+n]=async()=>{await enviarGuia(o,n,false);PdPasos.render()};
      m.acts['chat'+n]=async()=>{await enviarGuia(o,n,true);PdPasos.render()};
    });
    return m;
  }

  function abrir(id){abierto=String(id);error='';info='';PdPasos.open(modelo,{onClose:()=>{abierto=null}})}
  window.pdAbrirPasosMotoSvc=abrir;
  window.pdEsServicioMoto=o=>esSvc(o);
  /* La tarjeta del pedido abre esta vista también en recojo, compra y encomienda. */
  function enganchar(){
    const orig=window.toggleOrderDetails;if(typeof orig!=='function'||orig.__svc)return;
    const f=function(id){const o=L().find(x=>String(x.id)===String(id));if(esSvc(o))return abrir(id);return orig.apply(this,arguments)};
    f.__svc=1;f.__pasos=orig.__pasos;f.__orig=orig.__orig||orig;window.toggleOrderDetails=f;
  }
  enganchar();setInterval(enganchar,1000);
})();
