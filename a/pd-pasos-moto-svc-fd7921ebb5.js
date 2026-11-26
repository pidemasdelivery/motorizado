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
  const prepago=o=>tipo(o)==='compra'?false:(o.pago_acordado==='pagado'||(o.pago_confirmado===true&&!(Number(o.monto_recibido)>0)));
  /* compra: solo efectivo o Yape, y siempre se cobra (compra + servicio) al entregar */
  const compraCobrada=o=>tipo(o)==='compra'&&o.pago_confirmado===true&&Number(o.monto_recibido)>0;
  const momento=o=>{const m=String(o.pago_servicio_momento||'').toLowerCase();if(m)return m;if(o.pago_confirmado===true)return 'pagado';return yape(o)?'recojo_yape':'recojo_efectivo'};
  const alRecoger=o=>typeof window.pdCobraAlRecoger==='function'?!!window.pdCobraAlRecoger(o):false;
  const cobroRecPend=o=>alRecoger(o)&&o.pago_confirmado!==true&&Number(o.total)>0&&!['asignado','entregado','cancelado'].includes(st(o));
  const alFinal=o=>String(o.pago_servicio_momento||'').toLowerCase()==='al_final';
  const cobroEntrega=o=>tipo(o)!=='enc'&&!alFinal(o)&&!alRecoger(o)&&!prepago(o)&&aCobrar(o)>0;
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
      comp:get('Comprobante'),doc:get('DNI/RUC'),cnom:get('Nombre comprobante'),craz:get('Razón social'),cdir:get('Dirección fiscal'),ubi:link(ubi),
      obs:raw.split('|').flatMap(x=>x.split('·')).map(x=>x.trim()).filter(x=>x&&!/^(Ubicación(?: del cliente)?|Compra solicitada|Comprobante|DNI\/RUC|Nombre comprobante|Razón social|Dirección fiscal|Lugar de compra|¿De dónde desea la compra\?|¿Qué desea que compremos\?)\s*:/i.test(x)&&!/^(Servicio marcado como PAGADO|Pago en efectivo|Pago por Yape|Paga quien|Pedido a nombre de|El cliente paga al final)/i.test(x)).join(' · ')};
  }
  function notas(o){const x=extra(o);let n=String(x.clean||'');try{if(typeof cleanDeliveryTariffFromObservaciones==='function')n=cleanDeliveryTariffFromObservaciones(n)}catch(_){}
    try{if(typeof window.pdLimpiarNotas==='function')n=window.pdLimpiarNotas(n)}catch(_){}
    return String(n||'').replace(/(?:^|[|·])\s*Ubicaci[oó]n[^:|·]*:\s*[^|·]*/gi,'').replace(/https?:\/\/\S+/g,'').replace(/servicio marcado como PAGADO[^|·]*/ig,'').replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/g,'').replace(/__PIDEMAS_[A-Z_]+__\s*\{[^{}]*\}/g,'').replace(/^[\s|·]+|[\s|·]+$/g,'').trim()}

  /* ---------- encomienda: paquetes y guías ---------- */
  function paquetes(o){
    const px=arr(o.paquetes_extra).filter(x=>x&&Number(x.numero)>1);
    const ex=px.length?px.map(x=>({numero:x.numero,agencia:x.agencia,destino:x.destino,tipoPago:x.tipo_pago,recibe:x.recibe_nombre,recibeTel:x.recibe_telefono,recibeDni:x.recibe_dni}))
      :((typeof extractEncomiendaPackages==='function'?extractEncomiendaPackages(o.observaciones):[])||[]);
    const r1={recibe:o.nombre_receptor||'',recibeTel:o.telefono_receptor||'',recibeDni:o.dni_receptor||''};
    return [Object.assign({numero:1,agencia:o.agencia_destino||'',destino:o.destino_final||o.direccion_entrega||'',tipoPago:o.tipo_pago_encomienda},r1)]
      .concat(ex.map(p=>Object.assign({numero:Number(p.numero)||0,agencia:p.agencia||'',destino:p.destino||'',tipoPago:p.tipoPago},p.recibe!==undefined?{recibe:p.recibe||'',recibeTel:p.recibeTel||'',recibeDni:p.recibeDni||''}:r1)))
      .filter((p,i,a)=>p.numero&&a.findIndex(x=>x.numero===p.numero)===i);
  }
  const guardados=o=>{const g=arr(o.paquetes_envio).slice();if(!g.some(x=>Number(x.numero)===1)&&o.guia_url){const sc=String(o.clave_guia||'').trim()==='SIN_CLAVE';g.push({numero:1,guia_url:o.guia_url,clave:sc?'':String(o.clave_guia||''),sin_clave:sc||(!o.clave_guia&&String(o.observaciones||'').includes('SIN_CLAVE_GUIA_CONFIRMADO'))})}return g};
  const pkgOk=p=>!!(p&&(p.enviado_whatsapp||((p.sin_guia||(p.guia_url&&p.guia_url!=='whatsapp'&&p.guia_url!=='sin_guia'))&&(p.sin_clave||String(p.clave||'').trim()))));
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
  /* ---------- Encomiendas con varios paquetes y agencias ---------- */
  const pagoTx=t=>t==='pago_en_agencia'?'Pago en agencia':t==='pago_a_destino'?'Pago a destino':'Pago: '+(t||'—');
  /* paquete con el mismo diseño del Admin: filas Ruta, Pago del envío, Recibe · nombre, DNI y Número */
  function pkgRows(p){const li=(k,v)=>`<div class="li"><span>${k}</span><b style="text-align:right;overflow-wrap:anywhere">${v}</b></div>`,tel=String(p.recibeTel||'').replace(/\D/g,'');
    return `<div class="lbl">Paquete ${p.numero}</div>`+li('Ruta',E([p.agencia,p.destino].filter(Boolean).join(' → ')||'—'))+li('Pago del envío',E(pagoTx(p.tipoPago)))+
      li('Recibe',E(p.recibe||'—')+([p.recibeDni?'DNI '+E(p.recibeDni):'',tel?`<a href="tel:${E(tel)}" style="color:inherit;text-decoration:none">${E(p.recibeTel)}</a>`:''].filter(Boolean).length?`<div style="font-weight:500;font-size:13.5px;color:#6B5E55">${[p.recibeDni?'DNI: '+E(p.recibeDni):'',tel?`Número: <a href="tel:${E(tel)}" style="color:inherit;text-decoration:none">${E(p.recibeTel)}</a>`:''].filter(Boolean).join('<br>')}</div>`:''))}
  const cap1=v=>String(v||'').charAt(0).toUpperCase()+String(v||'').slice(1);
  function pkgHtml(p){return `<div class="sum">${pkgRows(p)}</div>`}

  const claveAg=n=>String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function grupos(o){const out=[];paquetes(o).forEach(p=>{const k=claveAg(p.agencia);let g=out.find(x=>x.clave===k);if(!g)out.push(g={clave:k,agencia:p.agencia,paquetes:[]});g.paquetes.push(p)});return out}
  const procDe=(o,g)=>arr(o.agencias_proceso).find(x=>claveAg(x.agencia)===g.clave);
  /* compatibilidad: encomiendas que ya estaban en agencia con el flujo anterior (una sola agencia) */
  const legado=(o,gi)=>gi===0&&enAgencia(o)&&!arr(o.agencias_proceso).length;
  function grupoPagado(o,g,gi){const pr=procDe(o,g);return !!(pr&&pr.pago_en)||(legado(o,gi)&&cajaPago(o))||(grupos(o).length===1&&cajaPago(o))}
  function grupoListo(o,g,gi){const sv=guardados(o);const debe=g.paquetes.some(p=>p.tipoPago==='pago_en_agencia');
    return (!debe||grupoPagado(o,g,gi))&&g.paquetes.every(p=>pkgOk(sv.find(x=>Number(x.numero)===p.numero)))}
  function montoAg(o,g,gi){const pr=procDe(o,g);if(pr&&pr.pago_en)return Number(pr.pago_monto)||0;return grupoPagado(o,g,gi)?Number(o.monto_pagado_agencia)||0:null}
  function pagadoTxt(o,g,gi){const pr=procDe(o,g);if(!g.paquetes.some(p=>p.tipoPago==='pago_en_agencia'))return '';
    return grupoPagado(o,g,gi)?U.st('Pago en '+E(g.agencia||'agencia')+' registrado'+(pr&&pr.pago_monto?' · '+M(pr.pago_monto):''),'ok'):''}
  function agActual(o){const GR=grupos(o);for(let gi=0;gi<GR.length;gi++){const g=GR[gi],pr=procDe(o,g);if(((pr&&pr.llegada_en)||legado(o,gi))&&!grupoListo(o,g,gi))return {g,gi}}return null}
  function gruposOrden(o){const GR=grupos(o).map((g,gi)=>({g,gi}));const t=x=>{const pr=procDe(o,x.g);return pr&&pr.llegada_en?new Date(pr.llegada_en).getTime():legado(o,x.gi)?1:Infinity};return GR.sort((a,b)=>t(a)-t(b)||a.gi-b.gi)}
  async function guardarProceso(o,lista,extra){
    const patch=Object.assign({agencias_proceso:lista},extra||{});
    const {data,error:e}=await D().from('pedidos').update(patch).eq('id',o.id).eq('motorizado_id',ME().id).select('id').maybeSingle();
    if(e)throw new Error(e.message);if(!data)throw new Error('Supabase no confirmó el cambio. Verifica que el pedido siga asignado a ti.');
    Object.assign(o,patch);
  }
  async function llegarAgencia(o,gi){
    error='';info='';const g=grupos(o)[gi];if(!g)return;
    const act=agActual(o);if(act&&act.gi!==gi){error='Primero termina en '+(act.g.agencia||'la agencia actual')+'.';return}
    const lista=arr(o.agencias_proceso).filter(x=>claveAg(x.agencia)!==g.clave);lista.push({agencia:g.agencia,llegada_en:new Date().toISOString()});
    try{await guardarProceso(o,lista,enAgencia(o)?{}:{pedido_en_agencia:true});info='Llegaste a '+(g.agencia||'la agencia')+'. '+(g.paquetes.some(p=>p.tipoPago==='pago_en_agencia')?'Registra el pago y luego sube las guías.':'Sube las guías de sus paquetes.');try{await loadOrders()}catch(_){}}
    catch(e){error='No se pudo registrar la llegada: '+(e.message||e)}
  }
  /* corregir el pago en una agencia mientras sigues en ella (antes de terminar sus guías) */
  async function corregirPagoAgencia(o,gi){
    error='';info='';const g=grupos(o)[gi];if(!g)return;const d=dr(o.id),pr=procDe(o,g)||{};
    const pp=g.paquetes.filter(p=>p.tipoPago==='pago_en_agencia'),porPaq=pp.length>1,montos={};
    let v;if(porPaq){for(const p of pp){const x=Number(String(d['cp'+gi+'_'+p.numero]||'').trim().replace(',','.'));if(!(x>0)){error='Escribe cuánto pagaste por el paquete '+p.numero+'.';return}montos[p.numero]=Math.round(x*100)/100}
      v=Object.values(montos).reduce((a,b)=>a+b,0)}
    else v=Number(String(d['cj'+gi]||'').trim().replace(',','.'));
    if(!(v>0)){error='Escribe cuánto pagaste en '+(g.agencia||'la agencia')+'.';return}
    v=Math.round(v*100)/100;const antes=Number(pr.pago_monto)||0;
    if(Math.abs(v-antes)<0.005&&!porPaq){delete d['fix'+gi];return}
    if(!(await pdConfirmar('¿Corregir el pago en '+(g.agencia||'la agencia')+' de '+M(antes)+' a '+M(v)+'?\nSe actualiza en tu caja.')))return;
    const desc='PAGO DE ENCOMIENDA · Agencia '+(g.agencia||'');
    try{
      const {data:mv,error:me}=await D().from('movimientos_caja').update({monto:v}).eq('motorizado_id',ME().id).eq('pedido_id',o.id).eq('tipo','retiro').eq('descripcion',desc).select('id');
      if(me)throw me;if(!mv||!mv.length)throw new Error('No se encontró el pago en tu caja.');
      const lista=arr(o.agencias_proceso).map(x=>claveAg(x.agencia)===g.clave?Object.assign({},x,{pago_monto:v},porPaq?{pago_paquetes:montos}:{}):x);
      const total=Math.round(lista.reduce((a,x)=>a+(Number(x.pago_monto)||0),0)*100)/100;
      await guardarProceso(o,lista,{monto_pagado_agencia:total});delete d['fix'+gi];delete d['cj'+gi];pp.forEach(p=>delete d['cp'+gi+'_'+p.numero]);
      info='Pago en '+(g.agencia||'la agencia')+' corregido: '+M(v)+'.';
      try{await loadOrders()}catch(_){}try{window.loadCash&&window.loadCash()}catch(_){}
    }catch(e){error='No se pudo corregir: '+(e.message||e)}
  }
  async function pagarEnAgencia(o,gi){
    error='';info='';const g=grupos(o)[gi];if(!g)return;const d=dr(o.id);
    /* varios paquetes en la misma agencia: cada uno va a un cliente distinto, así que se anota lo que costó el envío de cada uno */
    const pp=g.paquetes.filter(p=>p.tipoPago==='pago_en_agencia'),porPaq=pp.length>1,montos={};
    let v;if(porPaq){for(const p of pp){const x=Number(String(d['cp'+gi+'_'+p.numero]||'').trim().replace(',','.'));if(!(x>0)){error='Escribe cuánto pagaste por el paquete '+p.numero+'.';return}montos[p.numero]=Math.round(x*100)/100}
      v=Object.values(montos).reduce((a,b)=>a+b,0)}
    else v=Number(String(d['cj'+gi]||'').trim().replace(',','.'));
    if(!(v>0)){error='Escribe cuánto pagaste en '+(g.agencia||'la agencia')+'.';return}
    if(!(await pdConfirmar('¿Registrar '+M(v)+' pagados en '+(g.agencia||'la agencia')+'? Sale de tu caja.')))return;
    const desc='PAGO DE ENCOMIENDA · Agencia '+(g.agencia||'');
    try{
      const {data:ya}=await D().from('movimientos_caja').select('id,monto').eq('motorizado_id',ME().id).eq('pedido_id',o.id).eq('tipo','retiro').eq('descripcion',desc).limit(1);
      let monto=Math.round(v*100)/100;
      if(ya&&ya.length)monto=Number(ya[0].monto)||monto;
      else{const {error:me}=await D().from('movimientos_caja').insert({motorizado_id:ME().id,pedido_id:o.id,tipo:'retiro',monto,descripcion:desc});if(me)throw me}
      const lista=arr(o.agencias_proceso).map(x=>claveAg(x.agencia)===g.clave?Object.assign({},x,{pago_monto:monto,pago_en:new Date().toISOString()},porPaq?{pago_paquetes:montos}:{}):x);
      if(!lista.some(x=>claveAg(x.agencia)===g.clave))lista.push(Object.assign({agencia:g.agencia,llegada_en:new Date().toISOString(),pago_monto:monto,pago_en:new Date().toISOString()},porPaq?{pago_paquetes:montos}:{}));
      const total=Math.round(lista.reduce((a,x)=>a+(Number(x.pago_monto)||0),0)*100)/100;
      const extra={monto_pagado_agencia:total};
      const pend=grupos(o).filter(x=>x.paquetes.some(p=>p.tipoPago==='pago_en_agencia')&&!(lista.find(y=>claveAg(y.agencia)===x.clave&&y.pago_en)));
      if(!pend.length){const obs=String(o.observaciones||''),tag='PAGO_ENCOMIENDA_CAJA_CONFIRMADO';if(!obs.includes(tag))extra.observaciones=(obs?obs+' | ':'')+tag}
      await guardarProceso(o,lista,extra);delete d['cj'+gi];pp.forEach(p=>delete d['cp'+gi+'_'+p.numero]);
      info='Pago en '+(g.agencia||'la agencia')+' registrado: '+M(monto)+'. Ahora sube las guías.';
      try{await loadOrders()}catch(_){}try{window.loadCash&&window.loadCash()}catch(_){}
    }catch(e){error='No se pudo registrar el pago: '+(e.message||e)}
  }
  /* marca un punto de recojo adicional como recogido */
  async function marcarPunto(o,n){
    error='';info='';
    const esC=tipo(o)==='compra';if(!(await pdConfirmar(esC?'¿Ya compraste en el lugar '+n+'?':'¿Ya recogiste en el punto '+n+'?')))return;
    const lista=(Array.isArray(o.puntos_recojo)?o.puntos_recojo:[]).map(x=>Number(x.n)===n?Object.assign({},x,{recogido_en:new Date().toISOString()}):x);
    const {data,error:e}=await D().from('pedidos').update({puntos_recojo:lista}).eq('id',o.id).eq('motorizado_id',ME().id).select('id').maybeSingle();
    if(e||!data){error='No se pudo marcar el punto '+n+': '+(e?e.message:'Supabase no confirmó el cambio.');return}
    o.puntos_recojo=lista;const f=lista.filter(x=>!x.recogido_en).length;info=esC?(f?'Lugar '+n+' listo. Te falta'+(f===1?'':'n')+' '+f+'.':'Ya compraste en los lugares adicionales. Registra cuánto gastaste en total.'):f?'Punto '+n+' recogido. Te falta'+(f===1?'':'n')+' '+f+'.':'Recogiste en todos los puntos. Ya puedes ir a entregar.';
    try{await loadOrders()}catch(_){}
  }
  /* Guía de encomienda: la foto se sube a Supabase y la clave queda guardada en el pedido */
  function achicar(file){return new Promise(res=>{try{const u=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{try{const max=1600,r=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*r);c.height=Math.round(img.height*r);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>res(b&&b.size?b:file),'image/jpeg',0.82)}catch(_){res(file)}};
    img.onerror=()=>{URL.revokeObjectURL(u);res(file)};img.src=u}catch(_){res(file)}})}
  async function guardarGuia(o,n,dato){
    const lista=guardados(o).filter(x=>Number(x.numero)!==n);
    lista.push(Object.assign({numero:n},dato));lista.sort((a,b)=>a.numero-b.numero);
    const patch={paquetes_envio:lista};
    if(completo({...o,paquetes_envio:lista})){const ok=lista.filter(x=>x.guia_url&&x.guia_url!=='whatsapp'&&!x.sin_guia);
      patch.guia_url=(ok[0]&&ok[0].guia_url)||(lista.every(x=>x.sin_guia)?'sin_guia':'whatsapp');
      patch.clave_guia=lista.every(x=>x.sin_clave)?'SIN_CLAVE':lista.map(x=>x.sin_clave?'P'+x.numero+': sin clave':(lista.length>1?'P'+x.numero+': ':'')+String(x.clave||'')).join(' | ')}
    const {data,error:e}=await D().from('pedidos').update(patch).eq('id',o.id).eq('motorizado_id',ME().id).select('id').maybeSingle();
    if(e)throw new Error(e.message);if(!data)throw new Error('Supabase no confirmó el registro de la guía.');
    Object.assign(o,patch);return completo(o);
  }
  async function subirGuia(o,n){
    error='';info='';const d=dr(o.id).pk[n]||(dr(o.id).pk[n]={});
    if(!d.file&&!d.sinG){error='Toma la foto de la guía o voucher del paquete '+n+', o marca que la agencia no dio guía.';return}
    const clave=String(d.clave||'').trim();
    if(!d.sin&&!clave){error='Escribe la clave del paquete '+n+' o marca que la agencia no dio clave.';return}
    if(d.subiendo)return;d.subiendo=true;PdPasos.render();
    try{
      let url=null;
      if(!d.sinG){const {data:au}=await D().auth.getUser();const uid=au&&au.user&&au.user.id;if(!uid)throw new Error('Vuelve a iniciar sesión.');
      const blob=await achicar(d.file),path=uid+'/guias/'+o.id+'_p'+n+'_'+Date.now()+'.jpg',b=D().storage.from('fotos-motorizados');
      const up=await b.upload(path,blob,{cacheControl:'3600',upsert:false,contentType:'image/jpeg'});if(up.error)throw new Error('No se pudo subir la foto: '+up.error.message);
      url=b.getPublicUrl(path)?.data?.publicUrl;if(!url)throw new Error('No se obtuvo el enlace de la foto.')}
      const all=await guardarGuia(o,n,Object.assign({guia_url:url,clave:d.sin?'':clave,sin_clave:!!d.sin,subido_en:new Date().toISOString()},d.sinG?{sin_guia:true}:{}));
      try{if(d.url)URL.revokeObjectURL(d.url)}catch(_){}delete dr(o.id).pk[n];
      info=all?'Listo: guardaste todas las guías. Ya puedes terminar la encomienda.':'Guía del paquete '+n+' guardada. Pidemás ya la ve.';
      try{await loadOrders()}catch(_){}
    }catch(e){d.subiendo=false;error=String(e&&e.message||e)}
  }
  function compartirGuia(o,n){
    const sv=guardados(o).find(x=>Number(x.numero)===n);if(!sv)return;
    const p=paquetes(o).find(x=>x.numero===n)||{numero:n};
    const txt=textoGuia(o,p,String(sv.clave||''),!!sv.sin_clave).replace('(Foto de la guía adjunta)','Foto de la guía: '+(sv.guia_url||''));
    abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt));
  }
  async function enviarGuia(o,n,chat){
    error='';info='';const d=dr(o.id).pk[n]||{};
    if(!d.file&&!chat){error='Toma la foto de la guía o voucher del paquete '+n+'.';return}
    if(!d.sin&&!String(d.clave||'').trim()){error='Escribe la clave del paquete '+n+' o marca que la agencia no dio clave.';return}
    const p=paquetes(o).find(x=>x.numero===n)||{numero:n};const txt=textoGuia(o,p,String(d.clave||'').trim(),!!d.sin);
    const done=async()=>{try{const all=await marcarEnviado(o,n,d.sin);delete dr(o.id).pk[n];info=all?'Listo: enviaste todas las guías a Pidemás. Ya puedes terminar la encomienda.':'Paquete '+n+' enviado a Pidemás.';try{await loadOrders()}catch(_){}}
      catch(e){error='Se abrió WhatsApp, pero no se pudo registrar el envío: '+(e.message||e)}};
    if(chat){abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt.replace('(Foto de la guía adjunta)','(Te envío la foto de la guía)')));info='En el chat de Pidemás toca la cámara, toma la foto de la guía y envía.';await done();return}
    try{const fl=new File([d.file],'guia_paquete_'+n+'.'+(((d.file.type||'').split('/')[1]||'jpg').replace('jpeg','jpg')),{type:d.file.type||'image/jpeg'});
      if(navigator.canShare&&navigator.canShare({files:[fl]})){try{await navigator.share({files:[fl],text:txt,title:'Guía paquete '+n});await done()}catch(err){if(err&&err.name==='AbortError')error='No se envió la guía. Vuelve a tocar el botón y elige WhatsApp → Pidemás.';else{abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt));await done()}}return}}catch(_){}
    abrirWa('https://wa.me/'+waAdmin()+'?text='+encodeURIComponent(txt.replace('(Foto de la guía adjunta)','(Te adjunto la foto de la guía)')));info='Adjunta la foto de la guía en el chat de WhatsApp de Pidemás.';await done();
  }

  /* ---------- cobros y compra (mismas reglas que la ventana anterior) ---------- */
  async function cobrarAlRecoger(o){
    const d=dr(o.id),modo=d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo'),total=Number(o.total)||0;let paga=total;
    if(modo==='efectivo'){const raw=String(d.monto||'').trim();paga=raw===''?total:Number(raw.replace(',','.'));if(!(paga>=total-0.0001)){error='El cliente debe pagar al menos '+M(total)+'.';return}}
    let vueltoDe='';if(modo==='efectivo'&&paga-total>0.004&&typeof window.pdElegirVuelto==='function'){vueltoDe=await window.pdElegirVuelto(Math.round((paga-total)*100)/100,total,paga);if(!vueltoDe)return}
    if(modo==='yape'&&window.PdYapeP){const f=PdYapeP.falta(o);if(f){error=f;return}}
    if(!(await pdConfirmar(modo==='efectivo'?`¿Registrar cobro de ${M(total)} en efectivo?`:`¿Confirmas que el cliente ya pagó ${M(total)} por Yape al QR de Pidemás? Revisa la constancia en su celular.`)))return;
    try{
      if(modo==='yape'&&window.PdYapeP)await PdYapeP.guardar(o);
      const upd={pago_confirmado:true,metodo_pago:modo,monto_recibido:Math.round(paga*100)/100,pago_servicio_momento:modo==='yape'?'recojo_yape':'recojo_efectivo'};
      const {error:ue}=await D().from('pedidos').update(upd).eq('id',o.id).eq('motorizado_id',ME().id);if(ue)throw ue;
      try{await D().from('cobros').upsert({pedido_id:o.id,motorizado_id:ME().id,monto:total,metodo_pago:modo,confirmado:true,confirmado_en:new Date().toISOString()},{onConflict:'pedido_id'})}catch(_){}
      if(modo==='efectivo'){
        const {data:prev}=await D().from('movimientos_caja').select('id').eq('motorizado_id',ME().id).eq('pedido_id',o.id).eq('tipo','ingreso').not('descripcion','ilike','INGRESO MANUAL%').not('descripcion','ilike','EFECTIVO PARA %').limit(1);
        if(!(prev&&prev.length)){const {error:me}=await D().from('movimientos_caja').insert({motorizado_id:ME().id,pedido_id:o.id,tipo:'ingreso',monto:Math.round((vueltoDe==='propio'?paga:total)*100)/100,
          descripcion:(tipo(o)==='enc'?'Cobro de encomienda':'Cobro de recojo')+' · total S/ '+total.toFixed(2)+' · cliente pagó con S/ '+paga.toFixed(2)+' · vuelto entregado S/ '+Math.max(0,paga-total).toFixed(2)+(vueltoDe?(vueltoDe==='caja'?' · VUELTO DE CAJA':' · VUELTO CON DINERO PROPIO'):'')});if(me)throw me}
      }
      Object.assign(o,upd);d.monto='';
      try{await loadOrders()}catch(_){}try{if(typeof window.loadCash==='function')await window.loadCash()}catch(_){}
    }catch(err){error='No se pudo registrar el cobro: '+(err?.message||err)}
  }
  /* lugares de compra: el 1 vive en el pedido (punto1_*), los demás en puntos_recojo */
  function lugaresCompra(o){const cp=compra(o),PRc=Array.isArray(o.puntos_recojo)?o.puntos_recojo.filter(Boolean):[];
    return [{n:1,nombre:cp.lugar||'Lugar no indicado',que:cp.detalle,obs:cp.obs,mapa:U.maps(o.latitud_recojo,o.longitud_recojo,cp.lugar,cp.url||''),hecho:(o.punto1_listo_en&&o.punto1_monto!=null?o.punto1_listo_en:null)||(Number(o.subtotal)>0?'ok':null),monto:o.punto1_monto,foto:o.punto1_foto_url}]
      .concat(PRc.map(q=>({n:Number(q.n),nombre:q.nombre,que:q.que,obs:q.obs,costo_delivery:q.costo_delivery,mapa:U.maps(q.lat,q.lng,q.nombre,link(q.ubicacion)),hecho:(q.recogido_en&&q.monto!=null?q.recogido_en:null)||(Number(o.subtotal)>0?'ok':null),monto:q.monto,foto:q.foto_url})))}
  function lugarActual(o){const L=lugaresCompra(o),cl=dr(o.id).cl||{},ed=L.find(q=>cl[q.n]&&cl[q.n].edit);if(ed)return Object.assign({edit:true},ed);const p=L.find(q=>!q.hecho);return p||null}
  function sumaLugares(o){const L=lugaresCompra(o);if(!L.every(q=>q.hecho&&q.monto!=null&&q.monto!==''))return null;return Math.round(L.reduce((a,q)=>a+(Number(q.monto)||0),0)*100)/100}
  async function guardarLugarCompra(o,n){
    error='';info='';const z=((dr(o.id).cl=dr(o.id).cl||{})[n])||{},v=Number(String(z.monto||'').replace(',','.')),q=lugaresCompra(o).find(x=>x.n===n);if(!q)return;
    if(!(v>0)){error='Escribe cuánto gastaste en '+(q.nombre||'el lugar '+n)+'.';return}
    const ultimo=!z.edit&&lugaresCompra(o).filter(x=>!x.hecho&&x.n!==n).length===0;
    const tot=ultimo?Math.round(lugaresCompra(o).reduce((a,x)=>a+(x.n===n?v:(Number(x.monto)||0)),0)*100)/100:0,sv=servicio(o);
    const pre=(z.edit?'¿Corregir a ':'¿Guardar ')+M(v)+' gastado en '+(q.nombre||'el lugar '+n)+'?'+(z.file||(z.edit&&q.foto)?'':'\nSin foto de boleta.');
    const fin=ultimo?'\n\nCon esto se registra la compra de '+M(tot)+': sale de tu caja'+(alFinal(o)?' y el cliente le paga '+M(tot+sv)+' a Pidemás.':' y al entregar cobrarás '+M(tot+sv)+'.'):'';
    if(!(await pdConfirmar(pre+fin)))return;
    z.subiendo=true;PdPasos.render();
    try{let url=z.edit?(q.foto||null):null;
      if(z.file){const {data:au}=await D().auth.getUser();const uid=au&&au.user&&au.user.id;if(!uid)throw new Error('Vuelve a iniciar sesión.');
        const blob=await achicar(z.file),path=uid+'/compras/'+o.id+'_l'+n+'_'+Date.now()+'.jpg',b=D().storage.from('fotos-motorizados');
        const up=await b.upload(path,blob,{cacheControl:'3600',upsert:false,contentType:'image/jpeg'});if(up.error)throw new Error('No se pudo subir la foto: '+up.error.message);
        url=b.getPublicUrl(path)?.data?.publicUrl||null}
      const ahora=new Date().toISOString(),m=Math.round(v*100)/100;let upd;
      if(n===1)upd={punto1_listo_en:ahora,punto1_monto:m,punto1_foto_url:url};
      else upd={puntos_recojo:(Array.isArray(o.puntos_recojo)?o.puntos_recojo:[]).map(x=>Number(x.n)===n?Object.assign({},x,{recogido_en:ahora,monto:m,foto_url:url}):x)};
      const {data,error:ue}=await D().from('pedidos').update(upd).eq('id',o.id).eq('motorizado_id',ME().id).select('id').maybeSingle();
      if(ue||!data)throw new Error(ue?ue.message:'Supabase no confirmó el cambio.');
      Object.assign(o,upd);try{if(z.url)URL.revokeObjectURL(z.url)}catch(_){}delete dr(o.id).cl[n];
      const f=lugaresCompra(o).filter(x=>!x.hecho).length;info=f?'Guardado. Te falta'+(f===1?'':'n')+' '+f+' lugar'+(f===1?'':'es')+'.':'';
      if(!f&&sinMonto(o)){await registrarCompra(o,true);if(!error)info='Compra registrada: '+M(sumaLugares(o))+'. Ahora lleva el pedido al cliente.';return}
      try{await loadOrders()}catch(_){}
    }catch(err){error='No se pudo guardar: '+(err?.message||err);z.subiendo=false}
  }
  async function registrarCompra(o,sinPreguntar){
    error='';{const sl=sumaLugares(o);if(sl!=null)dr(o.id).gasto=String(sl)}const v=Number(String(dr(o.id).gasto||'').replace(',','.'));if(!(v>0)){error='Escribe cuánto gastaste en la compra.';return}
    const sv=servicio(o);
    if(!sinPreguntar&&!(await pdConfirmar(alFinal(o)?`¿Registrar gasto de compra de ${M(v)}?\nSale de tu caja. No cobras al entregar: el cliente le paga ${M(v+sv)} a Pidemás.`:`¿Registrar gasto de compra de ${M(v)}?\nSale de tu caja y al entregar cobrarás al cliente ${M(v+sv)} (efectivo o Yape).`)))return;
    try{
      const {data:prev}=await D().from('movimientos_caja').select('id').eq('motorizado_id',ME().id).eq('pedido_id',o.id).eq('tipo','retiro').ilike('descripcion','PAGO DE COMPRA%').limit(1);
      if(!(prev&&prev.length)){const {error:me}=await D().from('movimientos_caja').insert({motorizado_id:ME().id,pedido_id:o.id,tipo:'retiro',monto:Math.round(v*100)/100,descripcion:'PAGO DE COMPRA · Pedido #'+String(o.id).slice(0,8).toUpperCase()});if(me)throw me}
      const upd={subtotal:Math.round(v*100)/100,costo_delivery:Math.round(sv*100)/100,total:Math.round((v+sv)*100)/100};if(o.pago_confirmado===true&&!(Number(o.monto_recibido)>0))upd.pago_confirmado=false;
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
  const qrBtn=o=>{const qn=typeof window.pdQrDePedido==='function'?window.pdQrDePedido(o.id):null;
    return `<button type="button" class="qr" data-act="qr"><span class="im"${qn&&qn.url?` style="background-image:url('${E(qn.url)}')"`:''}>${qn&&qn.url?'':'QR'}</span><span class="t"><span class="k">${qn&&qn.negocio?'Yape del negocio':'Yape de Pidemás'}</span><span class="a">${E(qn&&qn.titular||qn&&qn.nombre||'')}</span><span class="b2">${E(qn&&qn.numero||'')}</span><span class="c">Toca para agrandar</span></span></button>`};
  /* cobro al recoger: mismo diseño que el cobro al entregar (encomienda, recojo y compra se ven igual) */
  function bloqueCobroRec(o){
    const d=dr(o.id),modo=d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo'),monto=Number(o.total)||0;
    let h=`<div class="amt"><div class="k">Cobro al cliente</div><div class="n">${M(monto)}</div><div class="pill">${modo==='yape'?'Yape':'Efectivo'}</div></div>`+
      U.note(tipo(o)==='enc'?'Cóbrale a quien envía antes de llevar los paquetes a la agencia.':(()=>{const PRx=Array.isArray(o.puntos_recojo)?o.puntos_recojo.filter(Boolean):[],q=PRx.find(x=>x.paga_aqui),n=q?q.n:1,nm=q?q.nombre:o.nombre_remitente;return PRx.length?'Cobra en el <b>punto '+E(n)+'</b>'+(nm?' ('+E(nm)+')':'')+': ahí pagan el total del servicio, de todos los puntos.':'Paga quien envía'+(nm?' ('+E(nm)+')':'')+': cóbrale al recoger, antes de salir a entregar.'})())+
      `<div><div class="lbl">¿Cómo paga el cliente?</div><div class="quick" data-act="modo"><button type="button" data-m="efectivo" class="${modo==='efectivo'?'on':''}">Efectivo</button><button type="button" data-m="yape" class="${modo==='yape'?'on':''}">Yape</button></div></div>`;
    if(modo==='efectivo'){const v=d.monto||'',vals=[];[10,20,50,100,200].forEach(z=>{const r=Math.ceil(monto/z)*z;if(r>monto+0.004&&!vals.includes(r))vals.push(r)});
      h+=`<div><div class="lbl">¿Con cuánto paga?</div><input class="inp" data-act="rmonto" inputmode="decimal" placeholder="${M(monto)}" value="${E(v)}"></div><div class="quick" data-act="rquick">${[monto].concat(vals.slice(0,3)).map((z,i)=>`<button type="button" data-v="${z.toFixed(2)}" class="${v!==''&&Number(v)===z?'on':''}">${i?'S/ '+z:'Exacto'}</button>`).join('')}</div><div data-vr>${I_v(v||monto,monto)}</div>`}
    else h+=qrBtn(o)+U.note('Confirma solo cuando veas la constancia del pago en el celular del cliente.')+(window.PdYapeP?PdYapeP.html(o):'');
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
    if(t==='enc'){if(completo(o)&&enAgencia(o)&&grupos(o).every((g,gi)=>grupoListo(o,g,gi)))return 4;if(enAgencia(o))return 3;if(['en_camino','camino_entrega','en_entrega','confirmando_pago'].includes(s))return 2;return 1}
    if(['aceptado','pedido_aceptado','camino_recojo'].includes(s))return 1;
    if(['en_camino','camino_entrega'].includes(s))return 2;
    if(['en_entrega','confirmando_pago'].includes(s))return cobroEntrega(o)&&(t==='compra'?!compraCobrada(o):o.pago_confirmado!==true)?3:4;
    return 1;
  }
  /* Ubicación de las agencias (la que se marca en Más › Agencias o en el formulario de encomienda) */
  const AGU={d:null,p:null};
  const agClaveU=n=>String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function agUbi(nom){
    if(!AGU.d&&!AGU.p)AGU.p=fetch('https://escxesvzndmyfuteawey.supabase.co/storage/v1/object/public/restaurantes/config/agencias.json?t='+Date.now(),{cache:'no-store'})
      .then(r=>r.ok?r.json():{}).then(j=>{AGU.d=(j&&j.agencias)||j||{};try{if(PdPasos.isOpen())PdPasos.render()}catch(_){}}).catch(()=>{AGU.d={}});
    const u=(AGU.d||{})[agClaveU(nom)];return u&&Number.isFinite(+u.lat)&&Number.isFinite(+u.lng)&&+u.lat!==0?{lat:+u.lat,lng:+u.lng}:null;
  }
  /* punto de cada agencia: el paquete 1 usa el punto de entrega del pedido si lo tiene */
  function agPunto(o,nom,primero){const la=Number(o.latitud_entrega),lo=Number(o.longitud_entrega);if(primero&&la&&lo)return {lat:la,lng:lo};return agUbi(nom)}
  function agBotones(o,lista){
    const vistos=new Set();let h='';
    lista.forEach((nom,i)=>{nom=String(nom||'').trim();if(!nom||vistos.has(agClaveU(nom)))return;vistos.add(agClaveU(nom));
      const pt=agPunto(o,nom,i===0);
      h+=pt?`<a class="b o" style="display:flex;width:100%;box-sizing:border-box;justify-content:center" href="https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}" target="_blank" rel="noopener">${(U.I&&U.I.nav)||''}Ir a la agencia ${E(nom)}</a>`
        :(AGU.d?U.note('La agencia '+E(nom)+' no tiene ubicación guardada. Márcala en Más › Agencias.'):'');
    });
    return h;
  }
  function modelo(){
    const o=L().find(x=>String(x.id)===String(abierto));if(!o)return null;
    const t=tipo(o),e=etapa(o),id=o.id,d=dr(id),x=extra(o),cp=t==='compra'?compra(o):null;
    const NOM={enc:'Encomienda',compra:'Compra',recojo:'Recojo y entrega'}[t];
    const remN=o.nombre_remitente||o.nombre_cliente||'Cliente',remT=o.telefono_remitente||o.telefono_cliente;
    const recN=t==='compra'?(o.nombre_receptor||o.nombre_cliente||o.nombre_remitente||'Cliente'):(o.nombre_receptor||o.nombre_cliente||'Quien recibe'),recT=t==='compra'?(o.telefono_receptor||o.telefono_cliente||o.telefono_remitente):(o.telefono_receptor||o.telefono_cliente);
    const cobro=cobroEntrega(o);
    const titulos=t==='enc'?['Recoger los paquetes','Llevar a la agencia','Guía y clave','Terminar encomienda']
      :[t==='compra'?'Hacer la compra':'Recoger','Llevar al cliente'].concat(cobro?['Cobrar']:[]).concat(['Confirmar entrega']);
    const etapaDe=t==='enc'?[1,2,3,4]:[1,2].concat(cobro?[3]:[]).concat([4]);
    const pos=e>=9?99:e===-1?-1:e===0?1:e;
    const steps=titulos.map((tt,i)=>({title:tt,state:pos===99||etapaDe[i]<pos?'done':etapaDe[i]===pos?'active':'locked'}));
    const S=k=>steps[etapaDe.indexOf(k)];
    if(efectivo(o)&&!draft(o.id)&&pagaCon(o)>0&&!sinMonto(o))setDraft(o.id,String(pagaCon(o)));
    const msg=(info?U.st(E(info),'ok'):'');
    /* recojo y entrega con varios puntos de recojo (el punto 1 es quien envía) */
    const PR=(t==='recojo'||t==='compra')&&Array.isArray(o.puntos_recojo)?o.puntos_recojo.filter(Boolean):[],prFalta=PR.filter(x=>!x.recogido_en).length;

    /* 1 · Recoger / comprar */
    {const s=S(1);
      if(t==='compra'){
        s.sum=(cp.lugar||'Compra')+(Number(o.subtotal)>0?' · gasto '+M(o.subtotal):'');
        const mapaLugar=cp.lugar||cp.url?U.maps(o.latitud_recojo,o.longitud_recojo,cp.lugar,cp.url||''):'';
        /* lugar de compra junto con su ubicación; el cliente (llamar / WhatsApp) va aparte */
        const irA=(u,l)=>`<a class="b o" style="display:flex;width:100%;box-sizing:border-box;justify-content:center${u?'':';opacity:.45;pointer-events:none'}"${u?` href="${E(u)}" target="_blank" rel="noopener"`:' aria-disabled="true"'}>${U.I.nav||''}${l}</a>`;
        const fotosC=o=>{const L=Array.isArray(o&&o.compra_fotos)?o.compra_fotos.filter(Boolean):[];return L.length?`<div class="lbl" style="margin-top:4px">Fotos de la compra</div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${L.map((u,i)=>`<a href="${E(u)}" target="_blank" rel="noopener" style="display:block;aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1px solid #F1E4DA;background:#FFF9F5"><img src="${E(u)}" alt="Foto ${i+1} de la compra" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></a>`).join('')}</div>`:''};
        const qComp=v=>`<div style="font-size:15px;line-height:1.5;white-space:pre-line;color:#1F1A17;overflow-wrap:anywhere">${E(v||'—')}</div>`;
        /* cada lugar de compra (1, 2, 3…): el motorizado guarda lo que gastó ahí y la foto de la boleta, uno por uno */
        const LC=lugaresCompra(o),tot=LC.length,reg=Number(o.subtotal)>0,INP='min-width:3ch;border:0;border-bottom:2px dashed #C4410C;border-radius:0;background:transparent;font:inherit;letter-spacing:inherit;text-align:center;color:#1F1A17;outline:none;padding:0;margin:0;box-shadow:none';
        const dlOk=PR.length&&PR.every(x=>x.costo_delivery!=null&&x.costo_delivery!=='');
        let h=e===1&&!reg&&LC.filter(q=>!q.hecho).length?U.note(tot>1?'Tienes <b>'+tot+' lugares de compra</b>. Ve uno por uno: escribe cuánto gastaste, toma la foto de la boleta y desliza «Guardar compra». Al guardar el último se registra la compra sola.':'Cuando compres, escribe cuánto gastaste, toma la foto de la boleta y desliza «Guardar compra».'):'';
        const curL=lugarActual(o);
        LC.forEach(q=>{const z=(d.cl=d.cl||{})[q.n]||(d.cl[q.n]={}),nom=q.nombre||'Lugar '+q.n,abierto=e===1&&!reg&&curL&&curL.n===q.n,sigue=e===1&&!reg&&!q.hecho&&!abierto;
          h+=`<div class="sum" style="gap:10px${abierto&&tot>1?';border-color:#C4410C':''}"><div class="lbl"${abierto&&tot>1?' style="color:#9A330A"':''}>${abierto&&tot>1?'Estás en este lugar · ':sigue?'Siguiente · ':''}${tot>1?'Lugar '+q.n+' de '+tot:'Lugar de compra'}${q.hecho&&q.hecho!=='ok'?' · comprado '+E(U.hora(q.hecho)):''}</div>`+U.who(nom,'Compra aquí'+(q.n===1?' · pedido '+E(U.ref(id)):''),'')+
            (q.hecho?'':irA(q.mapa,tot>1?'Ir al lugar '+q.n:'Ir al lugar de compra'))+
            (dlOk?`<div class="li"><span>Delivery de este lugar</span><b>${M(q.n===1?Math.max(0,Math.round((servicio(o)-PR.reduce((a,x)=>a+(Number(x.costo_delivery)||0),0))*100)/100):Number(q.costo_delivery))}</b></div>`:'')+
            `<div class="lbl" style="margin-top:4px">Qué comprar</div>`+qComp(q.que)+(q.n===1?fotosC(o):'')+(q.obs?`<div class="lbl" style="margin-top:4px">Observaciones</div>`+qComp(q.obs):'');
          if(q.hecho&&q.monto!=null&&!abierto){const li=(k,v,c)=>`<div class="li"><span>${k}</span><b style="text-align:right${c?';color:'+c:''}">${v}</b></div>`;
            h+=`<div style="display:flex;gap:12px;align-items:center">`+(q.foto?`<a href="${E(q.foto)}" target="_blank" rel="noopener" style="flex:0 0 84px"><img src="${E(q.foto)}" alt="Boleta del lugar ${q.n}" style="width:84px;height:84px;object-fit:cover;border-radius:12px;display:block"></a>`:'')+
              `<div style="flex:1;min-width:0;display:flex;flex-direction:column">`+li('Gastado',M(q.monto))+li('Boleta',q.foto?'Guardada ✓':'Sin boleta',q.foto?'#15803D':'')+`</div></div>`+(e===1&&!reg&&!(curL&&curL.edit)?`<button type="button" class="b" data-act="gedit${q.n}">Me equivoqué · cambiar monto o boleta</button>`:'')}
          else if(q.hecho&&!abierto)h+=U.st('Comprado aquí','ok');
          else if(abierto){const v=z.monto||'';
            h+=`<div class="amt"><div class="k">Total gastado en ${E(nom)}</div><div class="n" style="display:flex;justify-content:center;align-items:baseline;gap:8px"><span>S/</span><input data-act="gm${q.n}" inputmode="decimal" placeholder="0.00" aria-label="Cuánto gastaste en ${E(nom)}" value="${E(v)}" style="width:${Math.max(3,String(v).length||4)+0.6}ch;${INP}"></div><div class="pill">Sale de tu caja</div></div>`+
              `<button type="button" class="b soft${z.file||(z.edit&&q.foto)?' ok':''}" data-act="gshot${q.n}">${z.file?'Foto lista · tocar para cambiar':z.edit&&q.foto?'Boleta guardada · tocar para cambiarla':'Tomar foto de la boleta o factura'}</button><input type="file" data-act="gfile${q.n}" accept="image/jpeg,image/png,image/webp" capture="environment" hidden data-pd-cloud="1">`+
              ((z.url||(z.edit&&q.foto))?`<img src="${E(z.url||q.foto)}" alt="Boleta" style="width:84px;height:84px;object-fit:cover;border-radius:12px;display:block">`:'')+
              (z.edit?`<button type="button" class="b" data-act="gcan${q.n}">Cancelar el cambio</button>`:'')+U.note('Escribe arriba cuánto gastaste y desliza «'+(z.edit?'Guardar corrección':'Guardar compra en '+E(nom))+'». Sale de tu caja al registrar la compra.')}
          h+=`</div>`});
        h+=(cp.comp||cp.doc?`<div class="sum"><div class="lbl">Comprobante</div>${cp.comp?`<div class="li"><span>Tipo</span><b>${E(cap1(cp.comp))}</b></div>`:''}${cp.doc?`<div class="li"><span>${/factura/i.test(cp.comp||'')?'RUC':'DNI'}</span><b>${E(cp.doc)}</b></div>`:''}${cp.cnom?`<div class="li"><span>Nombre</span><b>${E(cp.cnom)}</b></div>`:''}${cp.craz?`<div class="li"><span>Razón social</span><b>${E(cp.craz)}</b></div>`:''}${cp.cdir?`<div class="li"><span>Dirección fiscal</span><b>${E(cp.cdir)}</b></div>`:''}</div>`:'')+
          `<div class="sum"><div class="lbl">Cliente</div>`+U.who(remN,'Quien pide la compra','',true)+U.contact(null,remT,'Hola, soy el motorizado de Pidemás por tu compra '+U.ref(id)+'.')+`</div>`;
        if(e>=1&&e<9){const sv=servicio(o);
          if(Number(o.subtotal)>0)h+=U.st('Compra registrada · gastaste '+M(o.subtotal),'ok');/* los montos y el cobro se ven en el paso Cobrar */
          else{const sum=sumaLugares(o);if(sum!=null)h+=`<div class="note" data-gt>${U.I.info}<span>Gastaste <b>${M(sum)}</b> en total. Sale de tu caja y se suma al cobro: cobrarás <b>${M(sum+sv)}</b> (servicio ${M(sv)}).</span></div>`}}
        s.body=msg+avisoVuelto(o,aCobrar(o),sinMonto(o))+h;
      }else{
        s.sum=remN+(o.direccion_recojo?' · '+o.direccion_recojo:'');
        let h=U.who(remN,(t==='enc'?'Quien envía':'Recojo aquí')+' · pedido '+E(U.ref(id))+(o.recojo_a_nombre?`<div style="margin-top:2px">A nombre de <b style="color:#1F1A17">${E(o.recojo_a_nombre)}</b></div>`:''),'',true)+U.addr(o.direccion_recojo,o.referencia_recojo)+
          U.contact(U.maps(o.latitud_recojo,o.longitud_recojo,o.direccion_recojo,link(x.ubicacionRecojo||o.ubicacion_recojo||o.link_recojo)),remT,'Hola, soy el motorizado de Pidemás por el pedido '+U.ref(id)+'.');
        if(PR.length){
          /* varios puntos de recojo: como con las agencias, el motorizado elige a cuál va primero */
          const tot=PR.length+1,exS=PR.reduce((a,x)=>a+(Number(x.costo_delivery)||0),0),exOk=PR.every(x=>x.costo_delivery!=null&&x.costo_delivery!=='');
          const p1={n:1,nombre:remN,direccion:o.direccion_recojo,referencia:o.referencia_recojo,a_nombre:o.recojo_a_nombre,telefono:remT,
            mapa:U.maps(o.latitud_recojo,o.longitud_recojo,o.direccion_recojo,link(x.ubicacionRecojo||o.ubicacion_recojo||o.link_recojo)),
            costo_delivery:exOk?Math.max(0,Math.round(((Number(o.total)||0)-exS)*100)/100):null,recogido_en:o.punto1_listo_en||(e>1?'ok':null)};
          const L=[p1].concat(PR.map(q=>Object.assign({},q,{mapa:U.maps(q.lat,q.lng,q.direccion,link(q.ubicacion))})));
          const pend=L.filter(q=>!q.recogido_en).length;
          h='';
          if(e===1&&pend>1)h+=U.note('Tienes <b>'+tot+' puntos de recojo</b>. Elige a cuál vas primero: toca «Llegué» en el punto donde estés y recoges ahí. Luego vas al siguiente.');
          L.forEach(q=>{const ok=!!q.recogido_en,aqui=e===1&&!ok&&d.ptAct===q.n,nom=q.nombre||'Punto '+q.n;
            const msgW='Hola'+(q.nombre?' '+String(q.nombre).split(' ')[0]:'')+', soy el motorizado de Pidemás. Voy a recoger el pedido '+U.ref(id)+'.';
            h+=`<div class="sum" style="gap:10px${aqui?';border-color:#C4410C':''}"><div class="lbl"${aqui?' style="color:#9A330A"':''}>${aqui?'Estás en este punto · ':''}Punto ${q.n} de ${tot}${ok&&q.recogido_en!=='ok'?' · recogido '+E(U.hora(q.recogido_en)):''}</div>`+
              U.who(nom,'Recojo aquí'+(q.n===1?' · pedido '+E(U.ref(id)):'')+(q.que?' · '+E(q.que):''),'',true)+U.addr(q.direccion,q.referencia)+
              U.contact(q.mapa,q.telefono,msgW)+
              (q.a_nombre?`<div class="li"><span>Pedido a nombre de</span><b>${E(q.a_nombre)}</b></div>`:'')+
              (q.costo_delivery!=null&&q.costo_delivery!==''?`<div class="li"><span>Delivery de este punto</span><b>${E(U.money(q.costo_delivery))}</b></div>`:'')+
              (alRecoger(o)&&o.pago_confirmado!==true&&(q.n===1?!PR.some(z=>z.paga_aqui):q.paga_aqui)?U.st('Aquí cobras el servicio · '+M(o.total)+' (todos los puntos)'):'')+
              (ok?U.st('Recogido aquí','ok'):e!==1?'':aqui?`<button type="button" class="b o" data-act="pt${q.n}">Ya recogí en el punto ${q.n}</button>`:`<button type="button" class="b o" data-act="pl${q.n}">Llegué a ${E(nom)}</button>`)+`</div>`});
        }
        if(t==='recojo'){const n=String(notas(o)||'').split(/\s*·\s*/).filter(z=>z&&!/^(Pago en efectivo|Pago por Yape|Paga quien|Servicio marcado como PAGADO|Pedido a nombre de)/i.test(z)).join(' · ');if(n)h+=`<div class="sum"><div class="lbl">Notas del servicio</div><div style="font-size:15px;line-height:1.5;color:#1F1A17;overflow-wrap:anywhere">${E(n)}</div></div>`}
        if(t==='enc'){h+=paquetes(o).map(pkgHtml).join('');const cq=compra(o),cmp=cq.comp||o.tipo_comprobante||'',doc=cq.doc||o.documento_comprobante||'';
          if((cmp&&!/no especificado/i.test(cmp))||doc)h+=`<div class="sum"><div class="lbl">Comprobante</div>${cmp?`<div class="li"><span>Tipo</span><b>${E(cap1(cmp))}</b></div>`:''}${doc?`<div class="li"><span>${/factura/i.test(cmp)?'RUC':'DNI'}</span><b>${E(doc)}</b></div>`:''}${cq.cnom?`<div class="li"><span>Nombre</span><b>${E(cq.cnom)}</b></div>`:''}${cq.craz?`<div class="li"><span>Razón social</span><b>${E(cq.craz)}</b></div>`:''}${cq.cdir?`<div class="li"><span>Dirección fiscal</span><b>${E(cq.cdir)}</b></div>`:''}</div>`}
        s.body=msg+avisoVuelto(o,aCobrar(o),false)+h;
      }
      if(e>=1&&cobroRecPend(o))s.body+=bloqueCobroRec(o);
      else if(alRecoger(o)&&o.pago_confirmado===true)s.body+=U.st('Cobro registrado · '+M(o.total)+' · '+(yape(o)?'Yape':'Efectivo'),'ok');
      else if(t==='enc'&&momento(o)==='pagado')s.body+=U.st('Ya pagado · no cobres nada','ok');
      else if(t==='enc'&&momento(o)==='al_final')s.body+=U.note('No cobres ahora: el cliente paga después de recibir la guía y la clave.');
      else if(t!=='enc'&&alFinal(o))s.body+=U.st('No cobras: el cliente le paga al final a Pidemás','ok');
      if(e===0){/* pedido nuevo: resumen completo antes de aceptar (igual que el admin) */
        const dc=v=>String(v||'').replace(/https?:\/\/\S+/g,'').replace(/[\s·,|-]+$/,'').trim(),li2=(k,v)=>`<div class="li"><span>${k}</span><b style="text-align:right;overflow-wrap:anywhere">${v}</b></div>`;
        const q2=(n,d)=>E(n||'—')+(dc(d)&&dc(d)!==String(n||'').trim()?`<div style="font-weight:500;font-size:13.5px;color:#6B5E55">${E(dc(d))}</div>`:'');
        let r='';
        if(t==='compra'){r+=li2(PR.length?'Compra · lugar 1':'Compra en',q2(cp.lugar||'—',''));PR.forEach(q=>{r+=li2('Compra · lugar '+E(q.n),q2(q.nombre,''))});r+=li2('Entrega a',q2(recN,o.direccion_entrega))}
        else if(t==='enc'){r+=li2('Recoge a',q2(remN,o.direccion_recojo));paquetes(o).forEach((p,i,A)=>{r+=li2(A.length>1?'Paquete '+p.numero:'Destino',E([p.agencia,p.destino].filter(Boolean).join(' → ')||'—'))})}
        else{r+=li2(PR.length?'Recoge · punto 1':'Recoge a',q2(remN,o.direccion_recojo));PR.forEach(q=>{r+=li2('Recoge · punto '+E(q.n),q2(q.nombre,q.direccion))});r+=li2('Entrega a',q2(recN,o.direccion_entrega))}
        r+=li2('Servicio',M(t==='compra'?servicio(o):o.total)+' · '+(alFinal(o)||momento(o)==='al_final'?'al final a Pidemás':(yape(o)?'Yape':'Efectivo')+(alRecoger(o)?' al recoger':' al entregar')));
        s.body=`<div class="sum"><div class="lbl">Resumen del pedido</div>${r}</div>`+s.body+U.note('Acepta el pedido para empezar.')}else if(e===1)s.body+=rapidos(o,'rem',1);}

    if(t==='enc'){
      /* 2 · Llevar a la agencia (si hay varias agencias, el motorizado elige a cuál va primero) */
      const GR=grupos(o),fin=['entregado','cancelado'].includes(st(o));
      {const s=S(2);s.locked='Se muestra al recoger los paquetes';s.sum=GR.map(g=>g.agencia).filter(Boolean).join(' · ')||'En agencia';
        let h=msg;
        if(GR.length>1)h+=U.note('Tienes <b>'+GR.length+' agencias</b>. Elige a cuál vas primero: toca «Llegué» en la agencia donde estés y haces todo ahí (pago y guías). Luego vas a la siguiente.');
        h+=GR.map((g,gi)=>`<div class="sum" style="gap:10px"><div class="lbl">${GR.length>1?'Agencia '+(gi+1)+' de '+GR.length:'Agencia'}</div><b style="font-size:18px">${E(g.agencia||'Agencia')}</b>`+agBotones(o,[g.agencia])+
          g.paquetes.map(pkgRows).join('<div style="height:1px;background:#F1E4DA;margin:4px 0"></div>')+
          (e===2&&GR.length>1?`<button type="button" class="b o" data-act="lleg${gi}">Llegué a ${E(g.agencia||'esta agencia')}</button>`:'')+`</div>`).join('');
        s.body=h;}
      /* 3 · Guía y clave: agencia por agencia (pago de esa agencia y guías de sus paquetes) */
      {const s=S(3);s.locked='Se muestra al llegar a la agencia';s.sum='Guías enviadas a Pidemás';
        let h=msg;const g=guardados(o),act=agActual(o),orden=gruposOrden(o);
          /* lo que se pagó en la agencia por este paquete (si varios paquetes van a la misma agencia y no se anotó por paquete, se dice que va junto) */
          const pagoGuia=p=>{const ag=E(p.agencia||'la agencia');if(p.tipoPago!=='pago_en_agencia')return U.st('Envío pago a destino','ok');const GG=grupos(o),gi=GG.findIndex(x=>x.clave===claveAg(p.agencia)),gr=GG[gi],pr=(gr&&procDe(o,gr))||{},mt=gr?montoAg(o,gr,gi):null;if(mt==null)return U.st('Pago en '+ag+' pendiente');
            const pp=pr.pago_paquetes||{},n=gr.paquetes.filter(x=>x.tipoPago==='pago_en_agencia');if(pp[p.numero]!=null)return U.st('Pago en '+ag+' registrado · '+M(pp[p.numero]),'ok');
            return U.st('Pago en '+ag+' registrado · '+M(mt)+(n.length>1?' (paquetes '+n.map(x=>x.numero).join(' y ')+')':''),'ok')};
          const guiaPkg=(p,g)=>{const sv=g.find(y=>Number(y.numero)===p.numero),ruta=E([p.agencia,p.destino].filter(Boolean).join(' → ')||'Paquete');
            if(pkgOk(sv)){const foto=sv.guia_url&&sv.guia_url!=='whatsapp'?sv.guia_url:'';
              const li=(k,v,c)=>`<div class="li"><span>${k}</span><b style="text-align:right${c?';color:'+c:''}">${v}</b></div>`;
              return `<div class="sum"><div class="lbl">Paquete ${p.numero} · ${ruta}</div><div style="display:flex;gap:12px;align-items:center">`+
                (foto?`<a href="${E(foto)}" target="_blank" rel="noopener" style="flex:0 0 84px"><img src="${E(foto)}" alt="Guía del paquete ${p.numero}" style="width:84px;height:84px;object-fit:cover;border-radius:12px;display:block"></a>`:'')+
                `<div style="flex:1;min-width:0;display:flex;flex-direction:column">`+li('Clave',sv.sin_clave?'La agencia no dio clave':E(sv.clave||'—'))+li('Guía',foto?'Guardada ✓':sv.sin_guia?'La agencia no dio guía':'Por WhatsApp',sv.sin_guia?'#B42318':'#15803D')+`</div></div>`+pagoGuia(p)+
                (foto&&!fin?`<button type="button" class="b" data-act="wa${p.numero}">Compartir también por WhatsApp (opcional)</button>`:'')+`</div>`}
            if(fin)return `<div class="sum"><div class="li"><span>Paquete ${p.numero} · ${ruta}</span><b>Sin guía</b></div></div>`;
            const k=d.pk[p.numero]||(d.pk[p.numero]={});
            return `<div class="sum"><div class="lbl">Guía · paquete ${p.numero} · ${ruta}</div>
              ${k.sinG?`<div style="display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#FDE8E8;border:1.5px solid #F4B4AE;color:#8A1C12"><span style="flex:0 0 28px;width:28px;height:28px;border-radius:50%;background:#B42318;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px">!</span><span style="display:flex;flex-direction:column;gap:3px"><b style="font-size:16px;color:#8A1C12">Sin guía</b><span style="font-size:14px;line-height:1.4">Marcaste que la agencia no dio guía ni voucher. Pidemás se lo avisará al cliente.</span></span></div><button type="button" class="b soft" style="width:100%" data-act="sing${p.numero}">Sí dio guía · tomar foto</button>`:`<button type="button" class="b soft${k.file?' ok':''}" data-act="shot${p.numero}">${k.file?'Foto lista · tocar para cambiar':'Tomar foto de la guía o voucher'}</button><input type="file" data-act="file${p.numero}" accept="image/jpeg,image/png,image/webp" capture="environment" hidden data-pd-cloud="1">${k.file?'':`<button type="button" class="b" style="color:#B42318;border-color:#F4C7C3" data-act="sing${p.numero}">La agencia no dio guía</button>`}`}
              ${!k.sinG&&k.url?`<img src="${E(k.url)}" alt="Guía del paquete ${p.numero}" style="width:100%;max-height:180px;object-fit:cover;border-radius:12px">`:''}
              ${k.sin?`<div style="display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:#FDE8E8;border:1.5px solid #F4B4AE;color:#8A1C12">
                <span style="flex:0 0 28px;width:28px;height:28px;border-radius:50%;background:#B42318;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px">!</span>
                <span style="display:flex;flex-direction:column;gap:3px"><b style="font-size:16px;color:#8A1C12">Sin clave de recojo</b><span style="font-size:14px;line-height:1.4">Marcaste que la agencia no dio clave. Pidemás se lo avisará al cliente junto con la guía.</span></span></div>
              <button type="button" class="b" data-act="sin${p.numero}">Sí dio clave · escribirla</button>`
              :`<input class="inp" data-act="clave${p.numero}" placeholder="Clave de recojo" value="${E(k.clave||'')}">
              <button type="button" class="b" style="color:#B42318;border-color:#F4C7C3" data-act="sin${p.numero}">La agencia no dio clave</button>`}
              <button type="button" class="b o" data-act="up${p.numero}"${k.subiendo?' disabled':''}>${k.subiendo?'Subiendo guía…':'Subir guía y clave'}</button></div>`};

        const listas=[];
        orden.forEach(({g:gr,gi})=>{const pr=procDe(o,gr),lleg=!!(pr&&pr.llegada_en)||(gi===0&&enAgencia(o)&&!arr(o.agencias_proceso).length),listo=grupoListo(o,gr,gi);
          const tit=(GR.length>1?'Agencia '+(gi+1)+' · ':'')+E(gr.agencia||'Agencia');
          if(listo){h+=gr.paquetes.map(p=>guiaPkg(p,g)).join('');listas.push({gr,gi});return}
          /* La siguiente agencia solo aparece cuando la actual ya está pagada y con sus guías y claves enviadas */
          if(!lleg&&act&&!fin)return;
          if(!lleg){h+=`<div class="sum" style="gap:10px"><div class="lbl">Siguiente agencia</div><b style="font-size:18px">${tit}</b>${agBotones(o,[gr.agencia])}${gr.paquetes.map(pkgRows).join('<div style="height:1px;background:#F1E4DA;margin:4px 0"></div>')}`+
            (fin?'':`<button type="button" class="b o" data-act="lleg${gi}">Llegué a ${E(gr.agencia||'esta agencia')}</button>`)+`</div>`;return}
          h+=`<div class="sum" style="gap:10px;border-color:#C4410C"><div class="lbl" style="color:#9A330A">Estás en esta agencia</div><b style="font-size:18px">${tit}</b></div>`;
          const debe=gr.paquetes.some(p=>p.tipoPago==='pago_en_agencia'),pagado=grupoPagado(o,gr,gi);
          const fix=!!d['fix'+gi]&&pagado;
          if(debe&&(!pagado||fix)&&!fin){const ppA=gr.paquetes.filter(p=>p.tipoPago==='pago_en_agencia'),v=ppA.length>1?String(ppA.reduce((a,p)=>a+(Number(String(d['cp'+gi+'_'+p.numero]||'').replace(',','.'))||0),0)||''):(d['cj'+gi]||'');
            h+=`<div class="amt"><div class="k">Total pagado en ${E(gr.agencia||'la agencia')}</div>${ppA.length>1?`<div class="n">${v?M(Number(String(v).replace(',','.'))||0):'S/ —'}</div>`:`<div class="n" style="display:flex;justify-content:center;align-items:baseline;gap:8px"><span>S/</span><input data-act="cj${gi}" inputmode="decimal" placeholder="0.00" aria-label="Monto pagado en ${E(gr.agencia||'la agencia')}" value="${E(v)}" style="width:${Math.max(3,String(v??'').length||4)+0.6}ch;min-width:3ch;border:0;border-bottom:2px dashed #C4410C;border-radius:0;background:transparent;font:inherit;letter-spacing:inherit;text-align:center;color:#1F1A17;outline:none;padding:0;margin:0;box-shadow:none"></div>`}<div class="pill">Sale de tu caja · paquete${gr.paquetes.filter(p=>p.tipoPago==='pago_en_agencia').length>1?'s':''} ${gr.paquetes.filter(p=>p.tipoPago==='pago_en_agencia').map(p=>p.numero).join(' y ')}</div></div>`+
              (ppA.length>1?ppA.map(p=>`<div><div class="lbl">Envío del paquete ${p.numero} · ${E(p.destino||'')}</div><input class="inp" data-act="cp${gi}_${p.numero}" inputmode="decimal" placeholder="S/ 0.00" value="${E(d['cp'+gi+'_'+p.numero]||'')}"></div>`).join(''):'')+(fix?`<div class="row" style="display:flex;gap:10px"><button type="button" class="b" style="flex:1" data-act="agno${gi}">Cancelar</button><button type="button" class="b o" style="flex:1.6" data-act="agok${gi}">Guardar corrección</button></div>`+U.note('Escribe el monto correcto que pagaste. Se cambia en tu caja y en Pidemás.'):U.note((ppA.length>1?'Escribe el envío de cada paquete':'Escribe arriba cuánto pagaste')+' y desliza «Pagar envío en '+E(gr.agencia||'la agencia')+'». Se registra en tu caja como <b>Pago de encomienda · '+E(gr.agencia||'Agencia')+'</b>. Después subes las guías.'));return}
          if(debe){h+=pagadoTxt(o,gr,gi);if(!fin&&gr.paquetes.some(p=>p.tipoPago==='pago_en_agencia'))h+=`<button type="button" class="b" data-act="agfix${gi}">Me equivoqué · cambiar monto pagado en ${E(gr.agencia||'la agencia')}</button>`}
          h+=gr.paquetes.map(p=>guiaPkg(p,g)).join('');
        });
        /* Pagos en agencias (igual que en el Admin): una fila por agencia lista con su monto y horas, y el total */
        if(listas.length){let tot=0;const fila=({gr,gi})=>{const pr=procDe(o,gr)||{},debe=gr.paquetes.some(p=>p.tipoPago==='pago_en_agencia'),m=debe?montoAg(o,gr,gi)||0:0;tot+=m;
            const sub=['Paquete'+(gr.paquetes.length>1?'s ':' ')+gr.paquetes.map(p=>p.numero).join(', '),pr.llegada_en?'Llegó '+U.hora(pr.llegada_en):'',pr.pago_en?'Pagó '+U.hora(pr.pago_en):(debe?'':'Pago a destino')].filter(Boolean).join(' · ');
            return `<div style="display:flex;flex-direction:column;gap:4px;padding:10px 0;border-top:1px solid #F1E4DA"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><b style="font-size:16px">${E(gr.agencia||'Agencia')}</b><b style="font-size:17px">${debe?M(m):'—'}</b></div><span style="font-size:13px;color:#6B5E55">${E(sub)}</span></div>`};
          const filas=listas.map(fila).join('');
          if(tot>0||listas.length>1)h+=`<div class="sum"><div class="lbl">Pagos en agencias</div>${filas}<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;border-top:1.5px solid #E3CFC2"><b style="font-size:15px">Total pagado</b><b style="font-size:18px">${M(tot)}</b></div></div>`}
        if(!fin&&!completo(o))h+=U.note('La foto y la clave se guardan en el pedido y Pidemás las ve al instante.');
        s.body=h;}
      /* 4 · Terminar */
      {const s=S(4);s.locked='Se muestra al enviar las guías';s.sum='Encomienda terminada';s.body=msg+U.st('Guías y claves enviadas a Pidemás. Pidemás se las manda al cliente.','ok');}
    }else{
      /* 2 · Llevar al cliente */
      {const s=S(2);s.locked=t==='compra'?'Se muestra al terminar la compra':'Se muestra al recoger';s.sum=recN+(o.direccion_entrega?' · '+o.direccion_entrega:'');
        const mapa=U.maps(o.latitud_entrega,o.longitud_entrega,o.direccion_entrega,link(o.ubicacion_entrega||x.ubicacionEntrega)||(cp&&cp.ubi));
        s.body=msg+U.who(recN,(t==='compra'?(o.nombre_receptor?'Recibe la compra (no es quien la pidió)':'Cliente'):(/Pide el servicio:\s*Quien recibe/i.test(String(o.observaciones||''))?'Quien recibe · pidió el servicio':'Quien recibe'))+' · entrega aquí','',true)+U.addr(o.direccion_entrega,o.referencia_entrega)+U.contact(mapa,recT,'')+
          rapidos(o,'rec',2);}
      /* 3 · Cobrar */
      if(cobro){const s=S(3);s.locked='Se muestra al llegar donde el cliente';const monto=aCobrar(o);
        s.sum='Cobrado '+M(monto)+' · '+(yape(o)?'Yape':'Efectivo');
        if(o.pago_confirmado===true){s.body=msg+U.st('Cobraste '+M(monto)+' · '+(yape(o)?'Yape':'Efectivo'),'ok')+(t==='compra'&&Number(o.subtotal)>0?`<div class="sum"><div class="lbl">Montos</div><div class="li"><span>Compra</span><b>${M(o.subtotal)}</b></div><div class="li"><span>Servicio</span><b>${M(servicio(o))}</b></div><div class="li t"><span>Total</span><b>${M(Number(o.subtotal)+servicio(o))}</b></div></div>`:'')}else{
        let h=msg+`<div class="amt"><div class="k">Cobro al cliente</div><div class="n">${M(monto)}</div><div class="pill">${yape(o)?'Yape':'Efectivo'}</div></div>`+(o.pago_confirmado!==true&&typeof window.pdCambiarPago==='function'?`<div><div class="lbl">¿Cómo paga el cliente?</div><div class="quick" data-act="cpago"><button type="button" data-m="efectivo" class="${efectivo(o)?'on':''}">Efectivo</button><button type="button" data-m="yape" class="${yape(o)?'on':''}">Yape</button></div></div>`:'');
        if(t==='compra'&&Number(o.subtotal)>0)h+=`<div class="sum"><div class="lbl">Montos</div><div class="li"><span>Compra</span><b>${M(o.subtotal)}</b></div><div class="li"><span>Servicio</span><b>${M(servicio(o))}</b></div><div class="li t"><span>Total</span><b>${M(Number(o.subtotal)+servicio(o))}</b></div></div>`;
        if(yape(o))h+=qrBtn(o)+U.note('Confirma solo cuando veas la constancia del pago en el celular del cliente.')+(window.PdYapeP?PdYapeP.html(o):'');
        else{const v=draft(id),vals=[];[10,20,50,100,200].forEach(z=>{const r=Math.ceil(monto/z)*z;if(r>monto+0.004&&!vals.includes(r))vals.push(r)});
          h+=`<div><div class="lbl">¿Con cuánto paga?</div><input class="inp" data-act="cash" inputmode="decimal" placeholder="${M(monto)}" value="${E(v)}"></div><div class="quick" data-act="quick">${[monto].concat(vals.slice(0,3)).map((z,i)=>`<button type="button" data-v="${z.toFixed(2)}" class="${Number(v)===z?'on':''}">${i?'S/ '+z:'Exacto'}</button>`).join('')}</div><div data-vuelto>${I_v(v,monto)}</div>`}
        if(!yape(o)&&window.PdYapeP&&PdYapeP.despuesHtml)h+=PdYapeP.despuesHtml(o);
        s.body=h;}}
      /* 4 · Confirmar entrega */
      {const s=S(4);s.locked=cobro?'Se muestra después de cobrar':'Se muestra al llegar donde el cliente';s.sum='Entregado';
        s.body=msg+(cobro?U.st('Cobrado '+M(aCobrar(o))+' · '+(yape(o)?'Yape':'Efectivo'),'ok'):U.st(alFinal(o)?'No cobras: el cliente le paga al final a Pidemás.':alRecoger(o)||prepago(o)?'Ya está pagado: no cobres nada.':'No hay nada que cobrar.','ok'))+U.note('Entrega el pedido a '+E(recN)+' y confirma.')+rapidos(o,'rec',3);}
    }

    /* no se puede deslizar si falta el monto que se necesita (se actualiza mientras escribe) */
    const nn=v=>Number(String(v??'').trim().replace(',','.'));
    const faltaY=()=>yape(o)&&window.PdYapeP?PdYapeP.falta(o):'';
    const okAg=gi=>{const g=grupos(o)[gi];if(!g)return true;const pp=g.paquetes.filter(p=>p.tipoPago==='pago_en_agencia');return pp.length>1?pp.every(p=>nn(d['cp'+gi+'_'+p.numero])>0):nn(d['cj'+gi])>0};
    const pdEsp=()=>String(o.pago_despues_estado||'')==='pendiente';
    const okCash=()=>{if(pdEsp())return false;if(!efectivo(o))return !faltaY();const v=nn(draft(id));return v>0&&v+0.004>=aCobrar(o)};
    const hCash=()=>{if(pdEsp())return 'Espera que Pidemás autorice el pago después.';if(!efectivo(o))return faltaY()||'';const v=nn(draft(id));return !(v>0)?'Escribe con cuánto te paga el cliente':v+0.004<aCobrar(o)?'El cliente debe pagar al menos '+M(aCobrar(o)):''};
    const modoR=()=>d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo');
    const okRec=()=>{if(modoR()!=='efectivo')return !(window.PdYapeP&&PdYapeP.falta(o));const raw=String(d.monto||'').trim();return !raw||nn(raw)+0.004>=Number(o.total)};
    const hRec=()=>modoR()!=='efectivo'?((window.PdYapeP&&PdYapeP.falta(o))||''):okRec()?'':'El cliente debe pagar al menos '+M(o.total);
    const vivo=(el,ok,hint)=>{try{const r=el.getRootNode(),sl=r.querySelector('.sl');if(sl){sl.classList.toggle('off',!ok);sl.setAttribute('aria-disabled',String(!ok))}const h=sl&&sl.nextElementSibling;if(h&&h.classList.contains('hint'))h.textContent=ok?'Desliza hacia la derecha para avanzar':hint}catch(_){}};
    /* «Pide el servicio» arriba, en el mismo orden en Admin y Motorizado: quién pide, qué papel tiene y quién paga */
    const pideBox=(()=>{const ob=String(o.observaciones||''),pR=/Pide el servicio:\s*Quien recibe/i.test(ob),rc=o.nombre_receptor||'';
      const rol=t==='compra'?(rc&&rc!==o.nombre_cliente?'Manda a comprar para otra persona':'Manda a comprar para sí mismo'):t==='enc'?(pR?'Quien recibe · manda a recoger la encomienda':'Quien envía la encomienda'):(pR?'Quien recibe · manda a recoger':'Quien envía · manda a recoger y entregar');
      const qp=String(o.quien_paga||''),mo2=String(o.pago_servicio_momento||'').toLowerCase();
      const paga=mo2==='pagado'?'Ya pagado':mo2==='al_final'?'Al final a Pidemás':qp==='recibe'?(t==='compra'?'Quien recibe la compra':'Quien recibe'):qp==='envia'?(t==='compra'?'Quien manda a comprar':'Quien envía'):'Quien pide el servicio';
      const otra=t==='compra'&&rc&&rc!==o.nombre_cliente;
      if(t!=='compra'){const nE=o.nombre_remitente||o.nombre_cliente||'Quien envía',tE=o.telefono_remitente||o.telefono_cliente,nR=o.nombre_receptor||'',tR=o.telefono_receptor||'';
        return `<div class="sum" style="gap:8px"><div class="lbl">${t==='enc'?'Encomienda':'Recojo y entrega'}</div>`+
          `<div class="lbl" style="margin:0">1 · Envía</div>`+U.who(nE,t==='enc'?'Entrega la encomienda':'Entrega el pedido','',true)+(tE?U.contact(null,tE,''):'')+
          `<div style="height:1px;background:#F1E4DA;margin:4px 0"></div><div class="lbl" style="margin:0">2 · Recibe</div>`+(nR?U.who(nR,t==='enc'?'Recibe la encomienda':'Recibe el pedido','',true)+(tR?U.contact(null,tR,''):''):`<div class="li"><span>Recibe</span><b>Sin nombre registrado</b></div>`)+
          `<div class="li"><span>Paga</span><b>${E(paga)}</b></div></div>`}
      return `<div class="sum" style="gap:8px"><div class="lbl">${t==='compra'?'Quien pide la compra':t==='enc'?'Quien pide la encomienda':'Quien pide el servicio'}</div>`+U.who(o.nombre_cliente||o.nombre_remitente||'Cliente',E(rol),'',true)+(o.telefono_cliente?U.contact(null,o.telefono_cliente,''):'')+
        (otra?`<div class="lbl" style="margin-top:4px">Quien recibe la compra</div>`+U.who(rc,'Otra persona · a ella le entregas','',true)+(o.telefono_receptor?U.contact(null,o.telefono_receptor,''):''):'')+
        `<div class="li"><span>Paga</span><b>${E(paga)}</b></div></div>`})();
    if(e>=1){const k0=steps.findIndex(x=>x.state==='active');const k=k0>=0?k0:0;if(steps[k])steps[k].body=pideBox+(steps[k].body||'')}
    const m={kicker:NOM+' · '+U.ref(id),steps,err:error,acts:{}};
    if(e===-1){m.title='Pedido cancelado';m.chip='Cancelado';m.chipCls='mal';steps.forEach(s=>s.state='locked');m.fin={mal:true,title:'Este pedido fue cancelado',text:o.motivo_cancelacion||'Ya no tienes que hacer nada con él.'};return m}
    if(e>=9){m.title='Entregado';m.chip='Listo';m.chipCls='ok';m.fin={title:t==='enc'?'¡Encomienda terminada!':'¡Pedido entregado!',text:o.entregado_en?'Terminado a las '+U.hora(o.entregado_en)+'.':''};return m}
    const actual=steps.findIndex(s=>s.state==='active')+1;
    m.title=e===0?'Pedido nuevo':steps[actual-1]?steps[actual-1].title:NOM;
    m.chip=e===0?'Nuevo':'Paso '+actual+' de '+steps.length;
    if(e===0){m.cta={label:'Aceptar pedido',run:()=>correr('acceptOrder',id)};m.alt=[{label:'Rechazar pedido',mal:true,run:()=>correr('rejectOrder',id)}]}
    else if(e===1){
      if(cobroRecPend(o)){const modo=d.modo||(momento(o)==='recojo_yape'?'yape':'efectivo');m.cta={label:modo==='yape'?'Ya pagó por Yape · '+M(o.total):'Ya cobré '+M(o.total),get off(){return !okRec()},get hint(){return hRec()},busy:'Registrando cobro…',run:()=>cobrarAlRecoger(o)}}
      else if(t==='compra'&&sinMonto(o)&&lugarActual(o)){const q=lugarActual(o),z=(d.cl||{})[q.n]||{},nom=q.nombre||'Lugar '+q.n,okG=()=>nn(((d.cl||{})[q.n]||{}).monto)>0;
        m.cta={label:(q.edit?'Guardar corrección en ':'Guardar compra en ')+nom,get off(){return !okG()},get hint(){return okG()?'':'Escribe cuánto gastaste en '+nom},busy:'Guardando…',run:()=>guardarLugarCompra(o,q.n)}}
      else if(t==='compra'&&sinMonto(o))m.cta={label:'Registrar compra · '+M(sumaLugares(o)),busy:'Registrando…',run:()=>registrarCompra(o)};
      else if(prFalta&&t==='recojo')m.cta={label:'Ya recogí todo',off:true,hint:dr(o.id).ptAct?'Marca «Ya recogí» en el punto donde estás':'Toca «Llegué» en el punto de recojo donde estés'};
      else m.cta={label:t==='enc'?'Recogí los paquetes':t==='compra'?'Compra lista · voy al cliente':PR.length?'Ya recogí todo · voy a entregar':'Ya recogí el pedido',run:()=>correr('startOrder',id)};
    }
    else if(e===2)m.cta=t==='enc'?(grupos(o).length>1?{label:'Llegué a la agencia',off:true,hint:'Toca «Llegué» en la agencia a la que fuiste primero'}:{label:'Llegué a la agencia',busy:'Registrando…',run:()=>llegarAgencia(o,0)}):{label:'Llegué donde el cliente',run:()=>correr('markInDelivery',id)};
    else if(e===3){
      if(t==='enc'){const a=agActual(o);m.cta=a&&!grupoPagado(o,a.g,a.gi)&&a.g.paquetes.some(p=>p.tipoPago==='pago_en_agencia')?{label:'Pagar envío en '+(a.g.agencia||'la agencia'),get off(){return !okAg(a.gi)},get hint(){return okAg(a.gi)?'':'Escribe cuánto pagaste en '+(a.g.agencia||'la agencia')},busy:'Registrando pago…',run:()=>pagarEnAgencia(o,a.gi)}
          :{label:a?'Sube las guías de '+(a.g.agencia||'la agencia'):'Ve a la siguiente agencia',off:true,hint:a?'Toma la foto y escribe la clave de cada paquete, luego toca «Subir guía y clave»':'Toca «Llegué» cuando estés en la siguiente agencia'}}
      else m.cta={label:'Ya cobré '+M(aCobrar(o)),get off(){return !okCash()},get hint(){return hCash()},busy:'Registrando cobro…',run:async()=>{if(efectivo(o)){const v=Number(String(draft(id)).replace(',','.'));if(!(v>0)){error='Escribe con cuánto te paga el cliente.';return}}if(yape(o)&&window.PdYapeP){const f=PdYapeP.falta(o);if(f){error=f;return}try{await PdYapeP.guardar(o)}catch(e){error=e.message||String(e);return}}await correr('confirmPayment',id)}};
    }
    else if(e===4)m.cta={label:t==='enc'?'Terminar encomienda':'Finalizar entrega',green:true,busy:'Finalizando…',run:()=>correr('deliverOrder',id)};
    if(e>=1&&typeof window.pdReportarProblema==='function')m.alt=[{label:'Tengo un problema',run:()=>window.pdReportarProblema(id)}];

    m.acts={
      cpago:async(box,ev)=>{const b=ev.target.closest('[data-m]');if(!b||b.classList.contains('on'))return;error='';try{await window.pdCambiarPago(o,b.dataset.m)}catch(e){error=String(e&&e.message||e)}PdPasos.render()},
      qr:()=>{if(typeof window.showYapeQr==='function')window.showYapeQr(id)},
      modo:(box,ev)=>{const b=ev.target.closest('[data-m]');if(!b)return;d.modo=b.dataset.m;error='';PdPasos.render()},
      rmonto:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');d.monto=inp.value;const n=inp.getRootNode().querySelector('[data-vr]');if(n)n.innerHTML=I_v(inp.value||o.total,Number(o.total));inp.getRootNode().querySelectorAll('.quick[data-act="rquick"] button').forEach(b=>b.classList.toggle('on',inp.value!==''&&Number(b.dataset.v)===Number(inp.value)));vivo(inp,okRec(),hRec())},
      rquick:(box,ev)=>{const b=ev.target.closest('[data-v]');if(!b)return;error='';d.monto=b.dataset.v;const inp=box.getRootNode().querySelector('[data-act="rmonto"]');if(inp){inp.value=b.dataset.v;inp.dispatchEvent(new Event('input'))}},
      gasto:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');inp.style.width=(Math.max(3,inp.value.length||4)+0.6)+'ch';d.gasto=inp.value;const n=inp.getRootNode().querySelector('[data-gt] b');if(n)n.textContent=M((Number(inp.value.replace(',','.'))||0)+servicio(o))},
      caja:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');d.caja=inp.value;const n=inp.getRootNode().querySelector('.amt .n');if(n)n.textContent=M(Number(inp.value.replace(',','.'))||0)},
      cash:inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');setDraft(id,inp.value);const n=inp.getRootNode().querySelector('[data-vuelto]');if(n)n.innerHTML=I_v(inp.value,aCobrar(o));inp.getRootNode().querySelectorAll('.quick[data-act="quick"] button').forEach(b=>b.classList.toggle('on',Number(b.dataset.v)===Number(inp.value)));vivo(inp,okCash(),hCash())},
      quick:(box,ev)=>{const b=ev.target.closest('[data-v]');if(!b)return;error='';setDraft(id,b.dataset.v);const inp=box.getRootNode().querySelector('[data-act="cash"]');if(inp){inp.value=b.dataset.v;inp.dispatchEvent(new Event('input'))}}
    };
    if(window.PdYapeP)Object.assign(m.acts,PdYapeP.acts(o));
    if(t==='compra')lugaresCompra(o).forEach(q=>{const n=q.n,k=()=>((d.cl=d.cl||{})[n]||(d.cl[n]={}));
      m.acts['gm'+n]=inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');inp.style.width=(Math.max(3,inp.value.length||4)+0.6)+'ch';k().monto=inp.value;vivo(inp,nn(inp.value)>0,'Escribe cuánto gastaste en '+(q.nombre||'el lugar '+n))};
      m.acts['gshot'+n]=b=>{const f=b.getRootNode().querySelector('[data-act="gfile'+n+'"]');if(f)f.click()};
      m.acts['gfile'+n]=inp=>{const f=inp.files&&inp.files[0];if(!f)return;const z=k();z.file=f;try{z.url=URL.createObjectURL(f)}catch(_){}PdPasos.render()};
      m.acts['gedit'+n]=()=>{const z=k();z.edit=true;z.monto=String(q.monto??'');error='';info='';PdPasos.render()};
      m.acts['gcan'+n]=()=>{const z=k();try{if(z.url)URL.revokeObjectURL(z.url)}catch(_){}delete d.cl[n];error='';PdPasos.render()};
      m.acts['gok'+n]=async b=>{if(b.disabled)return;b.disabled=true;await guardarLugarCompra(o,n);PdPasos.render()}});
    if(t==='enc')grupos(o).forEach((g,gi)=>{
      m.acts['lleg'+gi]=async b=>{if(b.disabled)return;b.disabled=true;await llegarAgencia(o,gi);PdPasos.render()};
      m.acts['agfix'+gi]=()=>{error='';info='';const pr=procDe(o,g)||{},pp=pr.pago_paquetes||{};d['fix'+gi]=1;d['cj'+gi]=String(pr.pago_monto||'');g.paquetes.forEach(p=>{if(pp[p.numero]!=null)d['cp'+gi+'_'+p.numero]=String(pp[p.numero])});PdPasos.render()};
      m.acts['agno'+gi]=()=>{delete d['fix'+gi];delete d['cj'+gi];g.paquetes.forEach(p=>delete d['cp'+gi+'_'+p.numero]);error='';PdPasos.render()};
      m.acts['agok'+gi]=async b=>{if(b.disabled)return;b.disabled=true;await corregirPagoAgencia(o,gi);PdPasos.render()};
      m.acts['cj'+gi]=inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');inp.style.width=(Math.max(3,inp.value.length||4)+0.6)+'ch';d['cj'+gi]=inp.value;const box=inp.parentElement&&inp.parentElement.previousElementSibling,v=Number(inp.value.replace(',','.'))||0;if(box&&box.classList.contains('amt'))box.querySelector('.n').textContent=v?M(v):'S/ —';vivo(inp,okAg(gi),'Escribe cuánto pagaste en '+(g.agencia||'la agencia'))};
      g.paquetes.forEach(p=>{m.acts['cp'+gi+'_'+p.numero]=inp=>{error='';inp.value=inp.value.replace(/[^\d.,]/g,'');d['cp'+gi+'_'+p.numero]=inp.value;
        const t=g.paquetes.filter(y=>y.tipoPago==='pago_en_agencia').reduce((a,y)=>a+(Number(String(d['cp'+gi+'_'+y.numero]||'').replace(',','.'))||0),0);let b=inp.parentElement;while(b&&!(b.classList&&b.classList.contains('amt')))b=b.previousElementSibling;const n=b&&b.querySelector('.n');if(n)n.textContent=t?M(t):'S/ —';vivo(inp,okAg(gi),'Escribe cuánto pagaste por cada paquete')}});
      m.acts['pg'+gi]=async b=>{if(b.disabled)return;b.disabled=true;await pagarEnAgencia(o,gi);PdPasos.render()};
    });
    PR.forEach(x=>{m.acts['pt'+x.n]=async b=>{if(b.disabled)return;b.disabled=true;await marcarPunto(o,x.n);if(!error)dr(o.id).ptAct=null;PdPasos.render()}});
    if(PR.length){for(let n=1;n<=PR.length+1;n++)m.acts['pl'+n]=()=>{error='';info='';dr(o.id).ptAct=n;PdPasos.render()};
      m.acts['pt1']=async b=>{if(b&&b.disabled)return;if(b)b.disabled=true;error='';info='';const z=dr(o.id),esC=t==='compra';
        if(!(await pdConfirmar(esC?'¿Ya compraste en el lugar 1?':'¿Ya recogiste en el punto 1?'))){if(b)b.disabled=false;return}
        const ahora=new Date().toISOString(),{data:dd,error:ee}=await D().from('pedidos').update({punto1_listo_en:ahora}).eq('id',o.id).eq('motorizado_id',ME().id).select('id').maybeSingle();
        if(ee||!dd){error='No se pudo marcar el '+(esC?'lugar':'punto')+' 1: '+(ee?ee.message:'Supabase no confirmó el cambio.');PdPasos.render();return}
        o.punto1_listo_en=ahora;z.ptAct=null;const f=PR.filter(x=>!x.recogido_en).length;info=t==='compra'?(f?'Lugar 1 listo. Te falta'+(f===1?'':'n')+' '+f+'.':'Compraste en todos los lugares. Registra cuánto gastaste.'):f?'Punto 1 recogido. Te falta'+(f===1?'':'n')+' '+f+'.':'Recogiste en todos los puntos. Ya puedes ir a entregar.';PdPasos.render()}}
    if(t==='enc')paquetes(o).forEach(p=>{const n=p.numero,k=()=>d.pk[n]||(d.pk[n]={});
      m.acts['shot'+n]=b=>{const f=b.getRootNode().querySelector('[data-act="file'+n+'"]');if(f)f.click()};
      m.acts['file'+n]=inp=>{const f=inp.files&&inp.files[0];if(!f)return;const z=k();z.file=f;try{z.url=URL.createObjectURL(f)}catch(_){}PdPasos.render()};
      m.acts['clave'+n]=inp=>{k().clave=inp.value};
      m.acts['sin'+n]=async()=>{const z=k();
        if(!z.sin){const ok=typeof window.pdConfirmar==='function'?await window.pdConfirmar('¿La agencia no te dio clave de recojo?\nRevisa bien la guía o el voucher: muchas veces la clave viene impresa. Márcalo solo si de verdad no hay clave.'):true;if(!ok)return}
        z.sin=!z.sin;if(z.sin)z.clave='';PdPasos.render()};
      m.acts['sing'+n]=async()=>{const z=k();
        if(!z.sinG){const ok=typeof window.pdConfirmar==='function'?await window.pdConfirmar('¿La agencia no te dio guía ni voucher?\nPídela antes de irte: casi siempre la dan. Márcalo solo si de verdad no hay guía.'):true;if(!ok)return}
        z.sinG=!z.sinG;if(z.sinG){z.file=null;try{if(z.url)URL.revokeObjectURL(z.url)}catch(_){}z.url=''}PdPasos.render()};
      m.acts['up'+n]=async()=>{await subirGuia(o,n);PdPasos.render()};
      m.acts['wa'+n]=()=>compartirGuia(o,n);
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
