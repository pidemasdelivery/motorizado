/* Cobro con el Yape del negocio: el negocio confirma si le llegó y le avisa directo al motorizado */
(function(){
  if(window.__pdYNM)return;window.__pdYNM=1;
  const L=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const D=()=>{try{return db}catch(e){return window.db}};
  const money=n=>'S/ '+(Number(n)||0).toFixed(2);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cod=id=>'#'+String(id||'').replace(/-/g,'').slice(0,8).toUpperCase();
  const esYN=o=>o&&String(o.pago_acordado||'')==='yape_negocio'&&String(o.metodo_pago||'').toLowerCase()==='yape';
  const visto={};let cpBase=null;
  function banner(tipo,titulo,texto){
    let b=document.getElementById('pdYNAviso');
    if(!b){b=document.createElement('div');b.id='pdYNAviso';b.setAttribute('role','alert');document.body.appendChild(b);b.addEventListener('click',e=>{if(e.target.closest('button'))b.hidden=true})}
    b.className='t-'+tipo;b.hidden=false;
    b.innerHTML='<b>'+E(titulo)+'</b><span>'+E(texto)+'</span><button type="button">Entendido</button>';
    try{navigator.vibrate&&navigator.vibrate(tipo==='mal'?[300,120,300,120,300]:[200,80,200])}catch(e){}
  }
  async function preguntar(o){
    const now=new Date().toISOString();
    const {error}=await D().from('pedidos').update({yape_negocio_estado:'esperando',yape_negocio_en:now}).eq('id',o.id);
    if(error){banner('mal','No se pudo avisar al negocio',error.message);return}
    o.yape_negocio_estado='esperando';o.yape_negocio_en=now;visto[o.id]='esperando';
    banner('esp','Le preguntamos al negocio','Apenas confirme si le llegó el Yape de '+money(o.total)+', te avisamos aquí.');pintar();
  }
  function envolver(){
    const cp=window.confirmPayment;if(typeof cp!=='function'||cp.__yn)return;
    cpBase=cp;
    const f=async function(id){
      const o=L().find(x=>String(x.id)===String(id));
      if(!esYN(o)||o.pago_confirmado===true||o.yape_negocio_estado==='llego')return cp.apply(this,arguments);
      if(o.yape_negocio_estado==='esperando'){banner('esp','Esperando al negocio','Todavía no confirma si le llegó el Yape. Espera un momento.');return}
      return preguntar(o);
    };
    f.__yn=1;window.confirmPayment=f;
  }
  function pintar(){
    const m=document.getElementById('pidemasOrderFullModal');if(!m)return;
    const o=L().find(x=>String(x.id)===String(m.dataset.orderId||''));
    const box=m.querySelector('.pdCobroEnt');
    let st=box&&box.querySelector('.pdYNEst');
    if(!box||!esYN(o)||o.pago_confirmado===true){st&&st.remove();return}
    const e=o.yape_negocio_estado||'';
    const h=e==='esperando'?'<span class="dot"></span><span><b>Esperando al negocio…</b><small>Le preguntamos si le llegó el Yape de '+money(o.total)+'.</small></span>'
      :e==='llego'?'<span class="ok">✓</span><span><b>El negocio confirmó el Yape</b><small>Ya puedes terminar la entrega.</small></span>'
      :e==='no_llego'?'<span class="no">✗</span><span><b>Al negocio no le llegó el Yape</b><small>Pide al cliente que revise su Yape y vuelve a deslizar, o cobra en efectivo.</small></span>'
      :'<span class="in">i</span><span><b>Cobra con el Yape del negocio</b><small>Cuando el cliente yapee, desliza. El negocio confirmará si le llegó.</small></span>';
    if(!st){st=document.createElement('div');st.className='pdYNEst';const ref=box.querySelector('.pdQrInline');ref?ref.after(st):box.appendChild(st)}
    if(st.dataset.e!==e){st.dataset.e=e;st.className='pdYNEst e-'+(e||'nada');st.innerHTML=h}
  }
  function revisar(){
    L().forEach(o=>{
      if(!esYN(o))return;const e=o.yape_negocio_estado||'',a=visto[o.id];
      if(a===undefined){visto[o.id]=e;return}
      if(a===e)return;visto[o.id]=e;
      if(e==='llego'){banner('ok','✓ Le llegó el Yape al negocio','Pedido '+cod(o.id)+' · '+money(o.total)+'. Ya puedes terminar la entrega.');
        if(o.pago_confirmado!==true&&String(o.estado||'').toLowerCase()==='en_entrega'&&cpBase){Promise.resolve(cpBase(o.id)).catch(()=>{})}}
      else if(e==='no_llego')banner('mal','✗ Al negocio NO le llegó el Yape','Pedido '+cod(o.id)+' · '+money(o.total)+'. Pide al cliente que revise su Yape o cobra en efectivo.');
    });
    pintar();
  }
  async function refrescar(){
    const ids=L().filter(o=>esYN(o)&&o.yape_negocio_estado==='esperando').map(o=>o.id);if(!ids.length||!D())return;
    try{const {data}=await D().from('pedidos').select('id,yape_negocio_estado,yape_negocio_en,pago_confirmado,pago_acordado,metodo_pago').in('id',ids);
      (data||[]).forEach(r=>{const o=L().find(x=>String(x.id)===String(r.id));if(o)Object.assign(o,r)});revisar()}catch(e){}
  }
  setInterval(envolver,700);envolver();
  setInterval(revisar,1500);setInterval(refrescar,4000);
})();
