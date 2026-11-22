(function(){
  if(window.__pdNoFlicker||typeof window.populateFullOrderModal!=='function')return;window.__pdNoFlicker=true;
  window.__pdModalVer=window.__pdModalVer||0;
  const prev=window.populateFullOrderModal;
  const list=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const typingIn=m=>{const a=document.activeElement;return !!(a&&m&&m.contains(a)&&(/^(TEXTAREA|SELECT)$/.test(a.tagName)||(a.tagName==='INPUT'&&!/^(button|submit|checkbox|radio|file)$/i.test(a.type||''))))};
  function sigOf(modal){
    const id=String(modal?.dataset?.orderId||'');const o=list().find(x=>String(x.id)===id);
    return id+'|'+window.__pdModalVer+'|'+(o?JSON.stringify(o):'none');
  }
  window.pdForceModal=()=>{window.__pdModalVer++};
  window.populateFullOrderModal=function(card,modal){
    try{
      const content=modal&&modal.querySelector('#pidemasOrderFullModalContent');
      const sig=sigOf(modal);
      const filled=content&&content.children.length>0;
      if(filled&&modal.dataset.pdSig===sig)return;          

      if(filled&&modal.dataset.pdSigId===String(modal.dataset.orderId)&&typingIn(modal)){modal.dataset.pdPending='1';return} 

      modal.dataset.pdSig=sig;modal.dataset.pdSigId=String(modal.dataset.orderId||'');delete modal.dataset.pdPending;
    }catch(e){}
    const out=prev.apply(this,arguments);
    

    try{const id=String(modal.dataset.orderId||''),d=(window.__pidemasCashDrafts||{})[id];
      if(d!==undefined&&d!==''){modal.querySelectorAll('[id="cash_'+id+'"]').forEach(i=>{if(!i.value){i.value=d}});
        const o=list().find(x=>String(x.id)===id),ch=modal.querySelector('[id="change_'+id+'"]');if(o&&ch)ch.textContent='Vuelto: S/ '+Math.max(0,Number(d)-Number(o.total||0)).toFixed(2)}}catch(e){}
    return out;
  };
  

  document.addEventListener('focusout',()=>{setTimeout(()=>{
    const m=document.getElementById('pidemasOrderFullModal');
    if(!m||m.dataset.pdPending!=='1'||typingIn(m))return;
    try{if(typeof renderOrders==='function')renderOrders()}catch(e){}
  },250)},true);
})();
