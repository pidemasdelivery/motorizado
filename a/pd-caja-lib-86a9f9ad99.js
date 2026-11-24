window.PdCaja=window.PdCaja||(function(){
  const RX_ADMIN=/^INGRESO DE ADMINISTRADOR\s*[·:—-]?\s*/i;
  const RX_MANUAL=/^INGRESO MANUAL DE CAJA\s*[·:—-]?\s*/i;
  const RX_PAY=/^PAGO DE (ENCOMIENDA|COMPRA)\s*[·:—-]?\s*/i;
  const RX_LIQ=/LIQUIDACI[ÓO]N DE CAJA/i,RX_RESET=/REINICIO DE CAJA/i,RX_PART=/^ENTREGA PARCIAL DE CAJA\s*[·:—-]?\s*/i,RX_TOADMIN=/entregu[eé] al administrador/i;
  const time=m=>{const t=new Date(m&&m.creado_en).getTime();return Number.isFinite(t)?t:0};
  const r2=n=>Math.round((Number(n)||0)*100)/100;
  function amount(m){
    let a=Number(m&&m.monto||0);
    if(m&&m.tipo==='ingreso'&&m.pedido_id&&a===0){const x=String(m.descripcion||'').match(/recibido\s*S\/?\.?\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);if(x)a=Number(x[1].replace(',','.'))||0}
    return r2(a);
  }
  const isBoundary=m=>!!m&&((m.tipo==='retiro'&&RX_LIQ.test(String(m.descripcion||'')))||RX_RESET.test(String(m.descripcion||'')));
  function kind(m){
    const d=String(m.descripcion||'').trim();
    if(m.tipo==='ingreso'){
      if(RX_ADMIN.test(d)||(RX_MANUAL.test(d)&&/de administrador/i.test(d)))return 'fondo';
      if(m.pedido_id||/COBRO DE PEDIDO/i.test(d))return 'cobro_pedido';
      return 'cobro';
    }
    if(RX_LIQ.test(d))return 'liquidacion';
    if(RX_RESET.test(d))return 'reinicio';
    if(RX_PART.test(d)||RX_TOADMIN.test(d))return 'entrega';
    if(RX_PAY.test(d))return 'pago';
    return 'gasto';
  }
  const LABEL={fondo:'Efectivo de Pidemás',cobro_pedido:'Cobro de pedido',cobro:'Cobro',liquidacion:'Entrega total de caja',reinicio:'Reinicio de caja',entrega:'Entrega parcial',pago:'Pago',gasto:'Gasto'};
  function clean(m){
    const raw=String(m.descripcion||'').trim(),pay=raw.match(RX_PAY);
    if(pay){const rest=raw.replace(RX_PAY,'').trim();return (pay[1].toLowerCase()==='compra'?'Compra':'Encomienda')+(rest?' · '+rest:'')}
    const d=raw
      .replace(/^(INGRESO MANUAL DE CAJA|INGRESO DE ADMINISTRADOR|GASTO MANUAL|COBRO DE PEDIDO|LIQUIDACI[ÓO]N DE CAJA|REINICIO DE CAJA|ENTREGA PARCIAL DE CAJA)\s*[·:—-]?\s*/i,'').trim();
    return String(d||LABEL[kind(m)]).replace(/\(administraci[oó]n\)/gi,'(Pidemás)').replace(/\bal administrador\b/gi,'a Pidemás').replace(/administraci[oó]n|administrador(a)?/gi,'Pidemás');
  }
  

  function split(movs){
    const list=(Array.isArray(movs)?movs:[]).filter(m=>m&&time(m)).slice()
      .sort((a,b)=>time(a)-time(b)||(isBoundary(b)?1:0)-(isBoundary(a)?1:0));
    const closed=[];let cur=[];
    for(const m of list){if(isBoundary(m)){closed.push({closer:m,movs:cur});cur=[]}else cur.push(m)}
    const desc=a=>a.slice().sort((x,y)=>time(y)-time(x));
    return {current:desc(cur),closed:closed.reverse().map(c=>({closer:c.closer,movs:desc(c.movs),summary:summary(c.movs)})),openedAt:closed.length?closed[closed.length-1].closer.creado_en:null};
  }
  function summary(movs){
    const s={cobros:0,fondos:0,pagos:0,gastos:0,entregas:0,ingresos:0,retiros:0,count:0};
    (movs||[]).forEach(m=>{if(isBoundary(m))return;const a=amount(m),k=kind(m);s.count++;
      if(m.tipo==='ingreso'){s.ingresos+=a;if(k==='fondo')s.fondos+=a;else s.cobros+=a}
      else{s.retiros+=a;if(k==='pago')s.pagos+=a;else if(k==='entrega')s.entregas+=a;else s.gastos+=a}});
    Object.keys(s).forEach(k=>{if(k!=='count')s[k]=r2(s[k])});
    s.balance=r2(s.ingresos-s.retiros);
    return s;
  }
  function balance(movs){return summary(split(movs).current).balance}
  

  function cycleWithAmounts(movs){return split(movs).current.map(m=>Object.assign({},m,{monto:amount(m)}))}
  return {amount,kind,LABEL,clean,split,summary,balance,isBoundary,cycleWithAmounts,r2};
})();
try{(function(){const C=window.PdCaja;if(!C||C.vueltoTag)return;const RX=/\s*·\s*VUELTO (DE CAJA|CON DINERO PROPIO)/i;const c0=C.clean;
C.clean=function(m){return String(c0.call(this,m)||'').replace(RX,'')};
C.vueltoTag=function(m){const x=String((m&&m.descripcion)||'').match(RX);if(!x)return '';return /CAJA/i.test(x[1])?'<span class="pdcjVu caja">Vuelto de su caja</span>':'<span class="pdcjVu">Vuelto de su bolsillo</span>'};})()}catch(e){}
try{(function(){const C=window.PdCaja;if(!C||C.extra)return;
const a0=C.amount;C.amount=function(m){if(m&&m.tipo==='retiro'&&m.revision==='rechazado')return 0;return a0.call(this,m)};
const s0=C.summary;C.summary=function(movs){return s0.call(this,(movs||[]).map(m=>m&&m.tipo==='retiro'&&m.revision==='rechazado'?Object.assign({},m,{monto:0}):m))};C.balance=function(movs){return C.summary(C.split(movs).current).balance};C.cycleWithAmounts=function(movs){return C.split(movs).current.map(m=>Object.assign({},m,{monto:C.amount(m)}))};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
C.revTag=function(m){if(!m||m.tipo!=='retiro'||!m.revision)return '';return m.revision==='aprobado'?'<span class="pdcjRev ok">Aprobado</span>':m.revision==='rechazado'?'<span class="pdcjRev bad">Rechazado · no se descuenta</span>':'<span class="pdcjRev pend">Por revisar</span>'};
/* modo: 'moto' (puede adjuntar foto) o 'admin' (puede aprobar o rechazar) */
C.extra=function(m,modo,editado){let h='';
  if(m.revision==='rechazado'&&m.revision_nota)h+='<em class="pdcjNota">Motivo: '+esc(m.revision_nota)+'</em>';
  const acts=[];
  if(m.comprobante_url)acts.push('<a class="pdcjAct" href="'+esc(m.comprobante_url)+'" target="_blank" rel="noopener">Ver comprobante</a>');
  else if(m.tipo==='retiro'&&m.revision&&m.revision!=='aprobado')acts.push(modo==='moto'?'<button type="button" class="pdcjAct fuerte" data-adj="'+esc(m.id)+'">Adjuntar foto</button>':'<span class="pdcjAct gris">Sin comprobante</span>');
  if(modo==='moto'&&m.comprobante_url&&m.revision==='rechazado')acts.push('<button type="button" class="pdcjAct" data-adj="'+esc(m.id)+'">Cambiar foto</button>');
  if(modo==='admin'&&m.tipo==='retiro'&&m.revision==='pendiente'){acts.push('<button type="button" class="pdcjAct ok" data-aprobar="'+esc(m.id)+'">Aprobar</button>');acts.push('<button type="button" class="pdcjAct bad" data-rechazar="'+esc(m.id)+'">Rechazar</button>')}
  if(modo==='admin'&&m.tipo==='retiro'&&m.revision&&m.revision!=='pendiente')acts.push('<button type="button" class="pdcjAct" data-revertir="'+esc(m.id)+'">Volver a revisar</button>');
  if(editado)acts.push('<button type="button" class="pdcjAct edit" data-hist="'+esc(m.id)+'">Editado · ver cambios</button>');
  if(acts.length)h+='<span class="pdcjActs">'+acts.join('')+'</span>';
  return h};
})()}catch(e){}

/* Pagos de compra y de encomienda: ya tienen su pedido (compra registrada, guía de la agencia); se descuentan de la caja sin «Por revisar» */
try{(function(){const C=window.PdCaja;if(!C||C.autoPago)return;C.autoPago=1;
const auto=m=>!!(m&&m.tipo==='retiro'&&m.pedido_id&&/^PAGO DE (COMPRA|ENCOMIENDA)/i.test(String(m.descripcion||''))&&m.revision!=='rechazado');
const rt=C.revTag,ex=C.extra;
if(rt)C.revTag=function(m){return auto(m)?'':rt.apply(this,arguments)};
if(ex)C.extra=function(m){const a=[].slice.call(arguments);if(auto(m))a[0]=Object.assign({},m,{revision:null});return ex.apply(this,a)};
})()}catch(e){}
