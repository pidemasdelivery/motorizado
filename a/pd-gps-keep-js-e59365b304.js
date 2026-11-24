(function(){
  if(window.__pdGpsKeep)return;window.__pdGpsKeep=true;
  const list=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const activo=()=>list().some(o=>['aceptado','pedido_aceptado','camino_recojo','en_camino','camino_entrega','en_entrega','confirmando_pago'].includes(String(o.estado||'').toLowerCase()));
  const logged=()=>{try{return typeof moto!=='undefined'&&moto&&moto.id}catch(e){return false}};
  let lock=null,hiddenAt=null;
  async function wake(){
    try{
      if(!('wakeLock' in navigator)||document.visibilityState!=='visible')return;
      if(activo()&&logged()){if(!lock){lock=await navigator.wakeLock.request('screen');lock.addEventListener('release',()=>{lock=null})}}
      else if(lock){await lock.release();lock=null}
    }catch(e){lock=null}
  }
  function aviso(min){
    if(document.getElementById('pdGpsBack'))return;
    const d=document.createElement('div');d.id='pdGpsBack';
    d.innerHTML=`<div class="bx" role="dialog" aria-label="GPS detenido"><h3>Tu GPS estuvo detenido</h3><div class="warn">Durante ${min} min no se envió tu ubicación.</div><p>Mientras tengas un pedido en curso, mantén esta página abierta. Si cierras la página o cambias de app, Pidemás y el cliente dejan de ver dónde estás.</p><button type="button">Entendido</button></div>`;
    d.addEventListener('click',e=>{if(e.target===d||e.target.closest('button'))d.remove()});
    document.body.appendChild(d);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){hiddenAt=Date.now();return}
    const away=hiddenAt?Date.now()-hiddenAt:0;hiddenAt=null;
    if(logged()){try{if(typeof startGPS==='function')startGPS()}catch(e){}}   

    if(away>=60000&&activo()&&logged())aviso(Math.max(1,Math.round(away/60000)));
    wake();
  });
  setInterval(wake,15000);
})();
