(function(){
  const DB=()=>{try{return db}catch(e){return window.db}};
  if(window.__pdQrMoto)return;window.__pdQrMoto=true;
  let cfg=null;
  async function load(){
    try{if(!DB())return;const u=DB().storage.from('restaurantes').getPublicUrl('config/yape.json').data.publicUrl+'?t='+Date.now();const r=await fetch(u,{cache:'no-store'});if(r.ok)cfg=await r.json()}catch(e){}
  }
  window.pdYapeCfg=()=>cfg;
  const NY={},NYp={};
  window.pdNegYapeCfg=function(nid){
    nid=String(nid||'');if(!nid)return null;
    if(NY[nid]&&Date.now()-NY[nid].t<10*60*1000)return NY[nid].d;
    if(!NYp[nid]&&DB()){NYp[nid]=1;Promise.resolve(DB().from('negocios').select('id,nombre,yape_qr_url,yape_numero,yape_titular').eq('id',nid).maybeSingle()).then(r=>{if(r&&r.data)NY[nid]={t:Date.now(),d:{url:r.data.yape_qr_url||'',numero:r.data.yape_numero||'',titular:r.data.yape_titular||'',nombre:r.data.nombre||''}}}).catch(()=>{}).finally(()=>{delete NYp[nid]})}
    return NY[nid]?NY[nid].d:null;
  };
  /* Pedido donde el cliente paga todo con el Yape del negocio */
  window.pdQrDePedido=function(id){
    let o=null;try{o=(Array.isArray(orders)?orders:[]).find(x=>String(x.id)===String(id))}catch(e){}
    if(o&&String(o.pago_acordado||'')==='yape_negocio'){const n=window.pdNegYapeCfg(o.negocio_id);return {negocio:true,cargando:!n,url:n&&n.url||'',numero:n&&n.numero||'',titular:n&&n.titular||'',nombre:n&&n.nombre||'el negocio'}}
    return {negocio:false,url:cfg&&cfg.url||'',numero:cfg&&cfg.numero||'',titular:cfg&&cfg.titular||'',nombre:'Pidemás'};
  };
  const base=window.showYapeQr;
  window.showYapeQr=function(id){
    if(typeof base==='function')base(id);
    const ov=document.getElementById('yapeQrOverlay');if(!ov)return;
    const qn=window.pdQrDePedido(id);if(qn.negocio){aplicarNeg(ov,qn,id);return}
    if(!cfg){load().then(()=>{if(cfg&&document.getElementById('yapeQrOverlay')===ov)apply(ov)});return}
    apply(ov);load();
  };
  function aplicarNeg(ov,q,id){
    if(q.cargando){setTimeout(()=>{if(document.getElementById('yapeQrOverlay')===ov)aplicarNeg(ov,window.pdQrDePedido(id),id)},600);return}
    const img=ov.querySelector('img');if(img&&q.url)img.src=q.url;if(img)img.alt='QR de Yape de '+q.nombre;
    const old=ov.querySelector('.pdQrDatos');if(old)old.remove();
    const m=ov.querySelector('.muted');if(m){const d=document.createElement('div');d.className='pdQrDatos';d.style.cssText='margin-top:8px;font:700 15px Inter,Arial,sans-serif;color:var(--fr-ink)';d.textContent=['Yape de '+q.nombre,q.numero,q.titular].filter(Boolean).join(' · ');m.after(d)}
  }
  function apply(ov){
    const img=ov.querySelector('img');
    if(img&&cfg.url){const fallback=img.src;img.onerror=()=>{img.onerror=null;img.src=fallback};img.src=cfg.url}
    if(cfg.numero||cfg.titular){const m=ov.querySelector('.muted');if(m&&!ov.querySelector('.pdQrDatos')){const d=document.createElement('div');d.className='pdQrDatos';d.style.cssText='margin-top:8px;font:700 15px Inter,Arial,sans-serif;color:var(--fr-ink)';d.textContent=[cfg.numero?'Yape '+cfg.numero:'',cfg.titular||''].filter(Boolean).join(' · ');m.after(d)}if(img&&cfg.titular)img.alt='QR de Yape de '+cfg.titular}
  }
  const boot=()=>{let n=0;const t=setInterval(()=>{if(DB()){clearInterval(t);load();setInterval(load,10*60*1000)}else if(++n>40)clearInterval(t)},300)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
