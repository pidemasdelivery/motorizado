(function(){
  if(window.__pdCompraGuard)return;window.__pdCompraGuard=true;
  const list=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const isCompra=o=>String(o?.tipo_servicio||'').toLowerCase().includes('compra');
  const sinMonto=o=>isCompra(o)&&!(Number(o.subtotal)>0);
  

  function vuelto(){
    const m=document.getElementById('pidemasOrderFullModal');if(!m)return;
    m.querySelectorAll('input[id^="cash_"]').forEach(i=>{
      if(!i.getClientRects().length)return;const id=i.id.slice(5);
      if(m.querySelector('[id="change_'+id+'"]'))return;
      const o=list().find(x=>String(x.id)===id);if(!o)return;
      const d=document.createElement('div');d.id='change_'+id;d.className='pdChange';
      d.style.cssText='margin-top:8px;padding:10px 12px;border-radius:12px;background:var(--fr-surface);font:800 15px Inter,Arial,sans-serif;color:var(--fr-ink)';
      d.textContent='Vuelto: S/ '+Math.max(0,(Number(i.value)||0)-Number(o.total||0)).toFixed(2);i.after(d);
    });
  }
  let t=null;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(vuelto,80)}).observe(document.body,{childList:true,subtree:true});
  const ask=async (o,txt)=>{if(!sinMonto(o))return true;if((await pdConfirmar(txt)))return true;
    const b=document.querySelector('#pidemasOrderFullModal .pdCompraBox');if(b){b.scrollIntoView({behavior:'smooth',block:'center'});b.querySelector('input')?.focus()}return false};
  ['startOrder','markInDelivery'].forEach(fn=>{const f=window[fn];if(typeof f!=='function')return;
    window[fn]=async function(id){const o=list().find(x=>String(x.id)===String(id));
      if(o&&(fn==='markInDelivery'?(sinMonto(o)?(window.pdAvisoMoto&&pdAvisoMoto('Registra cuánto gastaste en la compra antes de ir a entregar.','.pdCompraBox'),true):false):!(await ask(o,'Aún no registras cuánto gastaste en la compra.\n¿Seguir sin registrarlo?'))))return;return f.apply(this,arguments)}});
  const cp=window.confirmPayment;
  if(typeof cp==='function')window.confirmPayment=async function(id){const o=list().find(x=>String(x.id)===String(id));
    if(o&&!(await ask(o,'No registraste cuánto gastaste en la compra.\nTodo lo que cobres entrará a tu caja y la compra no se descontará.\n¿Confirmar el cobro igual?')))return;return cp.apply(this,arguments)};
})();
