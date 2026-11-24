(function(){
  const C=window.PdCaja,tab=document.getElementById('cashTab');if(!C||!tab)return;
  const $=id=>document.getElementById(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'S/ '+(Number(n)||0).toFixed(2);
  const REF='<svg viewBox="0 0 24 24" stroke-width="2"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>';
  const dayKey=d=>new Date(d).toLocaleDateString('es-PE',{weekday:'long',day:'2-digit',month:'short'});
  const hm=d=>new Date(d).toLocaleTimeString('es-PE',{hour:'numeric',minute:'2-digit'});
  const dt=d=>new Date(d).toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'});
  const keep=id=>{const el=$(id);if(el)el.remove();return el};
  

  const refresh=keep('refreshCash'),bal=keep('cashBalance'),only=keep('cashOnly'),pays=keep('cashPayments');
  const inA=keep('cashInAmount'),inS=keep('cashInSource'),inO=keep('cashInOtherSource'),inB=keep('addCashIn'),inM=keep('cashInMsg');
  const exA=keep('expenseAmount'),exR=keep('expenseReason'),exO=keep('expenseOtherReason'),exB=keep('addExpense'),exM=keep('expenseMsg');
  const rep=keep('openCashReport'),repP=keep('cashReportPanel'),repM=keep('cashExportMsg'),movBox=keep('cashMovements');
  [...tab.children].forEach(ch=>ch.remove());
  const root=document.createElement('div');root.className='pdcj';
  root.innerHTML=`<div class="pdcjTop"><span class="pdcjTitle"><span class="pdcjKick">Mi caja</span><strong>Caja</strong></span><button type="button" class="pdcjIcon" id="pdcjmRefresh" aria-label="Actualizar caja">${REF}</button></div>
  <section class="pdcjCard dark" id="pdcjmHero"><span class="pdcjKick">Saldo en caja</span><span class="pdcjAmt" id="pdcjmAmtSlot"></span><span class="pdcjSub" id="pdcjmSub">Cargando…</span><div class="pdcjStats" id="pdcjmStats"></div></section>
  <section class="pdcjCard">
    <div class="pdcjSeg"><button type="button" class="on" data-pane="cobro">Cobro</button><button type="button" data-pane="pago">Pago</button></div>
    <div class="pdcjPane" id="pdcjmCobro"><div class="pdcjField"><label for="cashInAmount">Monto recibido (S/)</label><span id="pdcjmInA"></span></div><div class="pdcjField"><label>¿De quién recibiste el efectivo?</label><span id="pdcjmInS"></span></div></div>
    <div class="pdcjPane" id="pdcjmPago" hidden><div class="pdcjField"><label for="expenseAmount">Monto pagado (S/)</label><span id="pdcjmExA"></span></div><div class="pdcjField"><label>¿Para qué usaste el efectivo?</label><span id="pdcjmExS"></span></div></div>
  </section>
  <section class="pdcjCard"><div class="pdcjHead"><span><span class="pdcjKick">Caja abierta</span><strong>Movimientos</strong></span><span id="pdcjmRep"></span></div><div id="pdcjmRepSlot"></div><div id="pdcjmMovSlot"></div></section>
  <section class="pdcjCard"><div class="pdcjHead"><span><span class="pdcjKick">Historial</span><strong>Cajas entregadas</strong></span></div><div id="pdcjmClosed"></div></section>
  <div hidden id="pdcjmLegacy"></div>`;
  tab.appendChild(root);
  const put=(slot,...els)=>{const s=$(slot);els.forEach(el=>{if(el)s.parentNode.insertBefore(el,s)});s.remove()};
  if(bal){bal.className='';$('pdcjmAmtSlot').appendChild(bal)}
  put('pdcjmInA',inA);put('pdcjmInS',inS,inO,inB,inM);put('pdcjmExA',exA);put('pdcjmExS',exR,exO,exB,exM);
  put('pdcjmRep',rep);put('pdcjmRepSlot',repP,repM);put('pdcjmMovSlot',movBox);
  [refresh,only,pays].forEach(el=>{if(el)$('pdcjmLegacy').appendChild(el)});
  if(inA)inA.placeholder='0.00';if(exA)exA.placeholder='0.00';
  if(inB)inB.textContent='Registrar cobro';if(exB)exB.textContent='Registrar pago';
  

  function chips(sel,box){
    if(!sel||!box)return;
    const build=()=>{box.innerHTML=[...sel.options].filter(o=>o.value).map(o=>`<button type="button" data-v="${E(o.value)}">${E(o.textContent.replace(/^De /,'').replace(/^Gast[eé] en /,'').replace(/^Entregue al /,'Al '))}</button>`).join('');sync()};
    const sync=()=>box.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===sel.value));
    box.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;sel.value=b.dataset.v;sel.dispatchEvent(new Event('change',{bubbles:true}));sync()});
    sel.addEventListener('change',sync);build();setInterval(sync,800);
  }
  
  root.querySelector('.pdcjSeg').addEventListener('click',e=>{const b=e.target.closest('[data-pane]');if(!b)return;root.querySelectorAll('.pdcjSeg button').forEach(x=>x.classList.toggle('on',x===b));$('pdcjmCobro').hidden=b.dataset.pane!=='cobro';$('pdcjmPago').hidden=b.dataset.pane!=='pago'});

  let limit=40,closedLimit=10,last=null,reqId=0;
  function movRow(m){
    const k=C.kind(m),a=C.amount(m),inc=m.tipo==='ingreso';
    return `<div class="pdcjMov"><span><strong>${E(C.clean(m))}${C.vueltoTag?C.vueltoTag(m):''}${C.revTag?C.revTag(m):''}<span class="pdcjTag ${inc?'in':''}">${E(k==='fondo'?'Efectivo de Pidemás':C.LABEL[k])}</span></strong><small>${E(hm(m.creado_en))}${m.pedido_id?' · Pedido #'+E(String(m.pedido_id).slice(0,8).toUpperCase()):''}</small>${C.extra?C.extra(m,'moto'):''}</span><span class="pdcjMovR"><b class="${inc?'':'out'}">${inc?'+':'−'} ${money(a)}</b></span></div>`;
  }
  const grouped=list=>{let l='';return list.map(m=>{const k=dayKey(m.creado_en);const h=k!==l?`<div class="pdcjDay"><span>${E(k)}</span></div>`:'';l=k;return h+movRow(m)}).join('')};
  function render(){
    if(!last)return;
    const sp=C.split(last),s=C.summary(sp.current);
    const txt=money(s.balance);
    window.__pidemasMotoCashBalanceText=txt;
    if(bal)bal.textContent=txt;const home=$('homeCashBalance');if(home)home.textContent=txt;
    if(only)only.textContent=money(s.cobros+s.fondos);if(pays)pays.textContent=money(s.pagos);
    $('pdcjmSub').textContent=(s.balance<0?'Pagaste más de lo que cobraste; Pidemás te lo repondrá.':'Efectivo que debes entregar a Pidemás')+(sp.openedAt?' · caja abierta desde '+dt(sp.openedAt):'');
    $('pdcjmStats').innerHTML=`<div><span>Cobros</span><strong>${money(s.cobros)}</strong></div><div><span>Me dieron</span><strong>${money(s.fondos)}</strong></div><div><span>Pagos</span><strong>${money(s.pagos)}</strong></div><div><span>Gastos y entregas</span><strong>${money(s.gastos+s.entregas)}</strong></div>`;
    const cur=sp.current;
    movBox.innerHTML=cur.length?grouped(cur.slice(0,limit))+(cur.length>limit?`<button type="button" class="pdcjMore" data-more="1">Ver más (${cur.length-limit} restantes)</button>`:''):'<div class="pdcjEmpty">Sin movimientos desde tu última entrega.</div>';
    const cl=sp.closed;
    $('pdcjmClosed').innerHTML=cl.length?cl.slice(0,closedLimit).map(c=>{const reset=C.kind(c.closer)==='reinicio';return `<details class="pdcjClosed"><summary><span><strong>${reset?'Reinicio de caja':'Entregaste '+money(C.amount(c.closer))}</strong><small>${E(dt(c.closer.creado_en))} · ${c.summary.count} movimientos · cobros ${money(c.summary.cobros)} · pagos ${money(c.summary.pagos)}</small></span><span class="pdcjTag">${reset?'Reinicio':'Cerrada'}</span></summary><div>${c.movs.length?grouped(c.movs):'<div class="pdcjEmpty">Sin movimientos.</div>'}</div></details>`}).join('')+(cl.length>closedLimit?`<button type="button" class="pdcjMore" data-more-closed="1">Ver más cajas (${cl.length-closedLimit})</button>`:''):'<div class="pdcjEmpty">Todavía no has entregado ninguna caja.</div>';
  }
  root.addEventListener('click',e=>{if(e.target.closest('[data-more]')){limit+=40;render()}if(e.target.closest('[data-more-closed]')){closedLimit+=10;render()}});
  async function loadCash(){
    if(typeof moto==='undefined'||!moto)return;
    const id=++reqId;const b=$('pdcjmRefresh');b.classList.add('spin');
    if(!last)movBox.innerHTML='<div class="pdcjEmpty">Cargando movimientos…</div>';
    try{
      const {data,error}=await fetchMotoCashMovements('id,tipo,monto,descripcion,creado_en,pedido_id,comprobante_url,revision,revision_nota',false);
      if(id!==reqId)return;
      if(error)throw error;
      last=data||[];render();
      try{document.dispatchEvent(new CustomEvent('pd:caja',{detail:last}))}catch(e){}
    }catch(e){
      if(!last){movBox.innerHTML='<div class="pdcjEmpty">No se pudo cargar tu caja: '+E(e.message||e)+'</div>';if(bal)bal.textContent='No disponible'}
      console.warn('Caja:',e);
    }finally{b.classList.remove('spin')}
  }
  window.loadCash=loadCash;
  $('pdcjmRefresh').addEventListener('click',loadCash);
  if(refresh)refresh.onclick=loadCash;
  if(typeof moto!=='undefined'&&moto)loadCash();
})();
