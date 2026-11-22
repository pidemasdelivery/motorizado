(function(){
  if(window.__pdNotas)return; window.__pdNotas=true;
  function limpiar(t){
    let s=String(t||'');
    s=s.replace(/__PIDEMAS_[A-Z_]+__\s*\{[\s\S]*?\}/g,'')
       .replace(/\[COMPROBANTE_YAPE:[^\]]*\]/gi,'')
       .replace(/\bPAGO_ENCOMIENDA_CAJA_CONFIRMADO\b/g,'')
       .replace(/\bSIN_CLAVE_GUIA_CONFIRMADO\b/g,'')
       .replace(/\bSIN_CLAVE\b/g,'')
       .replace(/\bPRODUCTO_MAYOR_18_VERIFICAR_DNI\b/g,'Producto +18: pedir DNI al entregar')
       .replace(/Servicio marcado como PAGADO;?\s*no cobrar monto al cliente/gi,'Servicio ya pagado: no cobrar')
       .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/g,'');
    const partes=s.split(/\s*[|·\n]\s*/).map(x=>x.trim().replace(/^[;,.\s]+|[;,\s]+$/g,'')).filter(x=>x&&!/^[^:]{2,40}:\s*$/.test(x)&&!/^PAQUETES ADICIONALES/i.test(x)&&!/^Paquete\s+\d+\s*:/i.test(x)&&!/^Ubicaci[oó]n[^:]*:\s*https?:\/\//i.test(x)&&!/^Pago en efectivo:\s*S\//i.test(x)&&!/^Pago por Yape:\s*pendiente/i.test(x));
    const vistos=new Set();
    return partes.filter(x=>{const k=x.toLowerCase();if(vistos.has(k))return false;vistos.add(k);return true}).join('\n');
  }
  window.pdLimpiarNotas=limpiar;
  

const ESC=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bonito=v=>{let x=String(v||'').trim();if(/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(x))x=x.replace(/_/g,' ');return x?x.charAt(0).toUpperCase()+x.slice(1):x};
const INFO=[[/paga al final|después de recibir la guía/i,'<i class="ti ti-cash" aria-hidden="true"></i>'],[/^Paga quien (envía|recibe)/i,'<i class="ti ti-cash" aria-hidden="true"></i>'],[/Servicio ya pagado|no cobrar/i,'<i class="ti ti-cash" aria-hidden="true"></i>'],[/\+18|DNI al entregar/i,'<i class="ti ti-ban" aria-hidden="true"></i>'],[/^Pago (en efectivo|por Yape)/i,'<i class="ti ti-cash" aria-hidden="true"></i>']];
function render(el,t){
const blk=el.closest('.pdRouteBlock,.pdMBlock');const kick=blk&&blk.querySelector('.pdRouteKicker,.pdMKicker');
if(kick&&!/nota|paquete/i.test(kick.textContent)){el.textContent=t;return}
const rows=[],info=[],free=[];
t.split('\n').map(x=>x.trim()).filter(Boolean).forEach(x=>{


if(/paga al final|después de recibir la guía|^Paga quien (envía|recibe)|Servicio ya pagado|no cobrar|^Pago (en efectivo|por Yape)/i.test(x))return;


if(el.closest('#pidemasOrderFullModal')&&/^(DNI de quien (envía|recibe)|Tipo de encomienda)\s*:/i.test(x))return;
const ic=INFO.find(([re])=>re.test(x));
if(ic){info.push(`<div class="pdNtInfo"><span>${ic[1]}</span><span>${ESC(x.replace(/;\s*/g,' · '))}</span></div>`);return}
const kv=x.match(/^([^:]{2,40}):\s*(.+)$/);
if(kv&&!/^https?$/i.test(kv[1].trim())){rows.push(`<div class="pdNtRow"><span>${ESC(kv[1].trim())}</span><b>${ESC(bonito(kv[2]))}</b></div>`);return}
free.push(x);
});
if(!rows.length&&!info.length&&!free.length){const b=el.closest('.pdRouteBlock,.pdMBlock');if(b&&/nota/i.test((kick&&kick.textContent)||''))b.style.display='none';else el.style.display='none';return}
el.classList.add('pdNtFmt');
el.innerHTML=(free.length?`<div class="pdNtFree"><span class="pdNtTag">Indicación del cliente</span>${free.map(x=>`<div>${ESC(x)}</div>`).join('')}</div>`:'')+info.join('')+(rows.length?`<div class="pdNtRows">${rows.join('')}</div>`:'');
}
function pasar(){
    document.querySelectorAll('.pdRouteNotes:not(.pdNotasOk),.pdMNotes:not(.pdNotasOk)').forEach(el=>{
      const t=limpiar(el.textContent);el.classList.add('pdNotasOk');
      if(!t){const blk=el.closest('.pdRouteBlock,.pdMBlock');(blk||el).style.display='none';return}
      render(el,t);
    });
  }
  let tm=null;new MutationObserver(()=>{clearTimeout(tm);tm=setTimeout(pasar,60)}).observe(document.documentElement,{childList:true,subtree:true});
  pasar();
})();
