(function(){
  if(window.__pdFixCobro)return;window.__pdFixCobro=true;
  const DB=()=>{try{return db}catch(e){return window.db}};
  const ME=()=>{try{return typeof moto!=='undefined'?moto:null}catch(e){return null}};
  const IS_MOTO=true;
  function totalDe(desc){
    const d=String(desc||'');if(!/vuelto/i.test(d))return null;
    const m=d.match(/total(?:\s+pedido)?\s*S\/\s*([0-9]+(?:[.,][0-9]{1,2})?)/i);if(!m)return null;
    const t=Number(m[1].replace(',','.'));return Number.isFinite(t)&&t>0?t:null;
  }
window.pdCobroCorrecto=m=>{if(!m||m.tipo!=='ingreso'||!/^\s*cobro de pedido/i.test(String(m.descripcion||'')))return null;const t=totalDe(m.descripcion);return t!=null&&Number(m.monto)>t+0.004?t:null};
  

  

  (function(){
    const c=DB();if(!c||c.__pdCajaFix)return;c.__pdCajaFix=true;const orig=c.from.bind(c);
    const info=window.__pdPedInfo=window.__pdPedInfo||{};
    

    const skip=m=>{const i=m.pedido_id&&info[m.pedido_id];return !!(i&&i.compra&&!i.pagaCon)};
    const fixRes=async r=>{try{if(r&&Array.isArray(r.data)){
      const cand=r.data.filter(m=>window.pdCobroCorrecto(m)!=null);
      const need=[...new Set(cand.map(m=>m.pedido_id).filter(id=>id&&!info[id]))];
      if(need.length){try{const {data:ps}=await new Promise((ok,ko)=>orig('pedidos').select('id,tipo_servicio,observaciones').in('id',need.slice(0,200)).then(ok,ko));(ps||[]).forEach(p=>{info[p.id]={compra:String(p.tipo_servicio||'').toLowerCase().includes('compra'),pagaCon:String(p.observaciones||'').includes('__PIDEMAS_PAGO_EFECTIVO__')}})}catch(e){}}
      cand.forEach(m=>{if(skip(m))return;const t=window.pdCobroCorrecto(m);if(t!=null){m.monto_original=m.monto;m.monto=t}})}}catch(e){}return r};
    const wrap=q=>new Proxy(q,{get(tg,p){
      if(p==='then')return (res,rej)=>new Promise((ok,ko)=>tg.then(ok,ko)).then(fixRes).then(res,rej);
      const v=tg[p];
      if(typeof v==='function')return (...a)=>{const out=v.apply(tg,a);return out&&(typeof out==='object'||typeof out==='function')&&typeof out.then==='function'?wrap(out):out};
      return v}});
    
    c.from=function(t){const q=orig(t);return t==='movimientos_caja'&&q&&(typeof q==='object'||typeof q==='function')?wrap(q):q};
  })();
  async function run(){
    const c=DB();if(!c)return false;
    let q=c.from('movimientos_caja').select('id,motorizado_id,pedido_id,tipo,monto,descripcion,creado_en').eq('tipo','ingreso').not('pedido_id','is',null).ilike('descripcion','%vuelto%').limit(2000);
    if(IS_MOTO){const me=ME();if(!me||!me.id)return false;q=q.eq('motorizado_id',me.id)}
    const {data,error}=await q;if(error){console.warn('Revisión de cobros con vuelto:',error.message);return true}
    

    let bq=c.from('movimientos_caja').select('motorizado_id,creado_en,descripcion').or('descripcion.ilike.%LIQUIDACI%,descripcion.ilike.%REINICIO DE CAJA%').limit(5000);
    if(IS_MOTO)bq=bq.eq('motorizado_id',ME().id);
    const {data:bs,error:be}=await bq;if(be){console.warn('Revisión de cobros con vuelto:',be.message);return true}
    const lastClose={};(bs||[]).forEach(b=>{const k=String(b.motorizado_id),tm=new Date(b.creado_en).getTime();if(!(lastClose[k]>=tm))lastClose[k]=tm});
    let fixed=0;
    for(const m of (data||[])){
      const lc=lastClose[String(m.motorizado_id)];if(lc&&!(new Date(m.creado_en).getTime()>lc))continue;
      const t=(m.monto_original!=null&&Number(m.monto_original)>Number(m.monto)+0.004)?Number(m.monto):null;if(t==null)continue;
      const desc=String(m.descripcion||'');
      const {data:u,error:ue}=await c.from('movimientos_caja').update({monto:t}).eq('id',m.id).eq('tipo','ingreso').select('id');
      if(!ue&&u&&u.length)fixed++;else console.warn('No se pudo corregir el cobro',m.id,ue&&ue.message);
    }
    if(fixed){
      try{if(typeof window.loadCash==='function')await window.loadCash()}catch(e){}
      try{document.getElementById('refreshCashAdmin')?.click()}catch(e){}
    }
    return true;
  }
  let n=0;const t=setInterval(async()=>{n++;let done=false;try{done=await run()}catch(e){done=true}if(done||n>600)clearInterval(t)},3000);
})();
