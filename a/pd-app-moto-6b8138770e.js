/* ===== Pidemás · Motorizado · app nueva =====
   Toda la app (Inicio, Pedidos, Caja, Billetera, Perfil, Avisos, Ruta, Rendimiento, Calificaciones e
   Historial) como páginas completas dentro de una caja aislada (Shadow DOM), con el diseño del pedido
   por pasos. Usa los datos y las acciones de la app de siempre. */
(function(){
  if(window.__pdAppMoto||!window.PdPasos)return;window.__pdAppMoto=1;
  const U=PdPasos.util,E=U.E,M=U.money;
  const $=id=>document.getElementById(id);
  const L=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const ME=()=>{try{return moto}catch(e){return null}};
  const est=o=>String(o?.estado||'').toLowerCase().trim();
  const FIN=['entregado','cancelado'];
  const svc=o=>{const t=String(o?.tipo_servicio||'').toLowerCase();return t.includes('encomienda')?'Encomienda':t.includes('compra')?'Compra':t.includes('recojo')?'Recojo y entrega':'Pedido de negocio'};
  const neg=o=>{try{return (window.__pdNegCache||{})[o.negocio_id]||{}}catch(e){return {}}};
  const S=d=>'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
  const IC={
    home:S('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),box:S('<path d="M4 7h16v13H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M9 11h6"/>'),
    cash:S('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),wallet:S('<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4z"/><path d="M4 7V5h12"/><path d="M16 13.5h.01"/>'),
    user:S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),bell:S('<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    help:S('<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>'),
    chev:S('<path d="M9 6l6 6-6 6"/>'),route:S('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M6 16.5V11a4 4 0 0 1 4-4h5.5"/>'),
    chart:S('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),star:S('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
    clock:S('<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>'),group:S('<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3 6"/>'),
    refresh:S('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),coffee:S('<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>'),
    pin:S('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),gps:S('<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>')
  };
  /* ===== Tarjetas de pedido (diseño C): en curso grandes con avance y motorizado; terminados en filas ===== */
  const C_SV={'Compra':['#E1F1E6','#1F6F43','<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'],'Recojo y entrega':['#FDEBDF','#C4410C','<path d="M4 8h14l-4-4"/><path d="M20 16H6l4 4"/>'],'Encomienda':['#E2ECF8','#1D4F91','<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'],'Negocio':['#F1E8FA','#6D3FA0','<path d="M3 10l1.5-5h15L21 10"/><path d="M4 10v10h16V10"/><path d="M9 20v-6h6v6"/>']};
  const cSvg=(d,s)=>`<svg viewBox="0 0 24 24" width="${s||14}" height="${s||14}" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const cTel=t=>{const d=String(t||'').replace(/\D/g,'');return d?(d.length===9?'51'+d:d):''};
  const C_CSS=`
.oC{display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;text-align:left;color:#1F1A17;background:#FFFFFF;border:1px solid #F1E4DA;border-radius:22px;padding:16px;cursor:pointer;box-shadow:0 8px 22px rgba(31,26,23,.06)}
.oC.a{border:1.5px solid #C4410C}.oC.cNw{border:2px solid #C4410C;animation:cLate 1.6s ease-out infinite}
@keyframes cLate{0%{box-shadow:0 0 0 0 rgba(196,65,12,.45),0 8px 22px rgba(31,26,23,.06)}100%{box-shadow:0 0 0 12px rgba(196,65,12,0),0 8px 22px rgba(31,26,23,.06)}}
@media (prefers-reduced-motion:reduce){.oC.cNw{animation:none;box-shadow:0 0 0 4px rgba(196,65,12,.25)}}.oC.sl2{border:1.5px solid #C4410C;background:#FFF4EC}
.oC .cTp{display:flex;align-items:center;gap:8px;min-width:0}
.oC .cCh{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border-radius:999px;font-size:13px;font-weight:800;white-space:nowrap;min-width:0;overflow:hidden;flex:0 1 auto}.oC .cCh span{overflow:hidden;text-overflow:ellipsis}.oC .cCh svg{flex:0 0 auto}
.oC .cCod{font-size:12.5px;font-weight:800;color:#6B5E55;letter-spacing:.02em;margin-bottom:2px}
.oC .cPr{margin-left:auto;font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;flex:0 0 auto}
.oC .cNm{font-size:18px;font-weight:800;letter-spacing:-.01em;line-height:1.25;overflow-wrap:anywhere}
.oC .cDr{font-size:14px;color:#6B5E55;margin-top:2px;line-height:1.35;overflow-wrap:anywhere}
.oC .cStp{display:grid;gap:6px}
.oC .cStp>span{display:flex;flex-direction:column;gap:6px;min-width:0}
.oC .cStp i{height:5px;border-radius:3px;background:#EFE5DD}
.oC .cStp small{font-size:11px;font-weight:700;color:#8A7B71;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oC .cStp .d i{background:#15803D}.oC .cStp .d small{color:#0F5E2E}
.oC .cStp .a i{background:#C4410C}.oC .cStp .a small{color:#9A330A}
.oC .cFt{display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid #F4EBE4}
.oC .cMo{flex:0 0 36px;width:36px;height:36px;border-radius:18px;background:#F6EFE9;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#6B5E55}
.oC .cMt{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}.oC .cMt b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.oC .cMt span{font-size:12px;color:#6B5E55}
.oC .cIk{flex:0 0 44px;width:44px;height:44px;border-radius:14px;border:1px solid #F1E4DA;background:#FFFFFF;display:flex;align-items:center;justify-content:center;color:#1F1A17;text-decoration:none}
.oC .cIk.g{background:#15803D;border-color:#15803D;color:#FFFFFF}
.oC .sel{flex:0 0 26px}
.oC .cAv{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:#FDEBDF;color:#9A330A;font-size:14px;font-weight:800}.oC .cAv i{width:8px;height:8px;border-radius:4px;background:#C4410C}.oC .cAv em{margin-left:auto;font-style:normal;font-weight:700}
.oR{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 14px;background:#FFFFFF;border:1px solid #F1E4DA;border-radius:16px;text-align:left;font:inherit;color:#1F1A17;min-height:62px;cursor:pointer}
.oR.sl2{border:1.5px solid #C4410C;background:#FFF4EC}
.oR .cOk{flex:0 0 32px;width:32px;height:32px;border-radius:16px;background:#E9F6EE;color:#15803D;display:flex;align-items:center;justify-content:center}
.oR .cOk.no{background:#FDE8E8;color:#B42318}
.oR .cMd{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}.oR .cMd b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.oR .cMd span{font-size:13px;color:#6B5E55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oR .cMd i{font-style:normal;font-size:12.5px;font-weight:800;color:#6B5E55;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oR em{font-style:normal;font-weight:800;font-size:15px;white-space:nowrap}
.oSec{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:800;letter-spacing:.08em;color:#6B5E55;margin:6px 4px 0;text-transform:uppercase}
`;
  /* d: {id,ref,sv,neg,precio,cliente,dir,hace,fase:{n,k,txt},pasos:[5 textos],moto:{nombre,tel,rol},sel:html,arriba:html,abajo:html,act:bool,attr} */
  function cGrande(d){
    const c=C_SV[d.sv]||C_SV['Negocio'];
    const bars=(d.pasos||[]).map((t,i)=>{const k=i+1,n=d.fase.n;const cl=n===0?'':(k<n||n>=d.pasos.length)?'d':k===n?'a':'';return `<span class="${cl}"><i></i><small>${E(t)}</small></span>`}).join('');
    const m=d.moto||null,mt=m&&cTel(m.tel);
    return `<div class="oC${d.act?' a':''}${d.nuevo?' cNw':''}${d.marcado?' sl2':''}" ${d.attr||''} role="button" tabindex="0">${d.arriba||''}
      <div class="cTp">${d.sel||''}<span class="cCh" style="background:${c[0]};color:${c[1]}">${cSvg(c[2])}<span>${E(d.neg||d.sv)}</span></span><span class="cPr">${E(d.precio)}</span></div>
      <div><div class="cCod">${E(d.ref)}${d.hace?' · '+E(d.hace):''}</div><div class="cNm">${E(d.cliente||'Cliente')}</div>${d.dir?`<div class="cDr">${E(d.dir)}</div>`:''}</div>
      ${d.pasos&&d.fase.n?`<div class="cStp" style="grid-template-columns:repeat(${d.pasos.length},minmax(0,1fr))" aria-label="Avance: ${E(d.fase.txt||'')}">${bars}</div>`:''}
      ${m&&m.nombre?`<div class="cFt"><span class="cMo">${E(String(m.nombre).trim().charAt(0).toUpperCase())}</span><span class="cMt"><b>${E(m.nombre)}</b><span>${E(m.rol||'Motorizado')}</span></span>${mt?`<a class="cIk" data-lnk href="tel:+${mt}" aria-label="Llamar a ${E(m.nombre)}">${cSvg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',20)}</a><a class="cIk g" data-lnk href="https://wa.me/${mt}" target="_blank" rel="noopener" aria-label="WhatsApp a ${E(m.nombre)}">${cSvg('<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/>',20)}</a>`:''}</div>`:''}${d.abajo||''}</div>`;
  }
  function cFila(d){
    const no=d.fase.k==='no';
    return `<button type="button" class="oR${d.marcado?' sl2':''}" ${d.attr||''}>${d.sel||`<span class="cOk${no?' no':''}">${no?cSvg('<path d="M6 6l12 12M18 6L6 18"/>',16):cSvg('<path d="M5 12l5 5L19 7"/>',16)}</span>`}<span class="cMd"><i>${E([d.ref,d.cuando].filter(Boolean).join(' · '))}</i><b>${E(d.cliente||'Cliente')}</b><span>${E([d.neg||d.sv,d.moto&&d.moto.nombre?String(d.moto.nombre).split(' ')[0]:''].filter(Boolean).join(' · '))}</span></span><em>${E(d.precio)}</em></button>`;
  }
  const cPasos=(sv,neg)=>['Recibido','Asignado',sv==='Compra'?'Compra':neg?'En el local':'Recojo','En camino','Entregado'];
  const ESTILO=PdPasos.css+C_CSS+`
:host{z-index:2147482000}
.app{animation:none}
.hd{background:#FFFFFF;border-bottom:1px solid #F1E4DA;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px 14px;display:flex;align-items:center;gap:12px;flex:0 0 auto}
.ib{position:relative;width:44px;height:44px;flex:0 0 44px;border-radius:12px;border:1px solid #F1E4DA;background:#FFFFFF;display:flex;align-items:center;justify-content:center;color:#1F1A17;padding:0;cursor:pointer}
.bd{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#C4410C;color:#FFFFFF;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #FFFFFF;box-sizing:border-box}
.ava{flex:0 0 48px;width:48px;height:48px;border-radius:50%;background:#FDEBDF center/cover no-repeat;color:#C4410C;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800}
.dsp{display:flex;align-items:center;gap:12px;padding:14px;border-radius:18px;background:#FFFFFF;border:1px solid #F1E4DA}
.dsp .pt{flex:0 0 12px;width:12px;height:12px;border-radius:50%;background:#15803D;box-shadow:0 0 0 5px rgba(21,128,61,.15)}
.dsp.off .pt{background:#A8988C;box-shadow:0 0 0 5px rgba(168,152,140,.18)}
.dsp .bt{height:40px;padding:0 12px;border-radius:12px;border:1px solid #F1E4DA;background:#FFFFFF;color:#1F1A17;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer}
.dsp .bt svg{color:#C4410C;width:18px;height:18px}
.oc{display:block;width:100%;text-align:left;color:#1F1A17;background:#FFFFFF;border:1px solid #F1E4DA;border-radius:18px;padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:10px}
.oc.a{border:1.5px solid #C4410C;box-shadow:0 6px 18px rgba(196,65,12,.10)}
.oc .r1{display:flex;align-items:center;gap:8px}.oc .r1 b{font-size:17px}.oc .r1 small{font-size:12px;font-weight:700;color:#6B5E55;text-transform:uppercase;letter-spacing:.05em}.oc .r1 em{margin-left:auto;font-style:normal;font-size:18px;font-weight:800;color:#1F1A17}
.oc .pls{display:flex;gap:8px;flex-wrap:wrap}
.pl{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#FDEBDF;color:#9A330A;font-size:13px;font-weight:800}
.pl.n{background:#FFFFFF;border:1px solid #F1E4DA;color:#1F1A17;font-weight:700}.pl.g{background:#E9F6EE;color:#0F5E2E}
.oc .bars{display:grid;gap:6px}
.oc .ad{display:flex;gap:10px;align-items:flex-start}.oc .ad svg{color:#C4410C;flex:0 0 20px;width:20px;height:20px}.oc .ad b{display:block;font-size:15px}.oc .ad span{font-size:14px;color:#6B5E55}
.kick{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#C4410C}
.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.mt{text-align:left;padding:14px;border-radius:18px;background:#FFFFFF;border:1px solid #F1E4DA;display:flex;flex-direction:column;gap:4px;color:#1F1A17;cursor:pointer}
.mt span{font-size:13px;font-weight:600;color:#6B5E55}.mt b{font-size:24px;color:#1F1A17}.mt small{font-size:12px;color:#6B5E55}
.tl{display:flex;gap:12px;align-items:center;padding:14px;border-radius:18px;background:#FFFFFF;border:1px solid #F1E4DA;color:#1F1A17;cursor:pointer;width:100%;text-align:left}
.tl .ic{flex:0 0 44px;width:44px;height:44px;border-radius:12px;background:#FDEBDF;color:#C4410C;display:flex;align-items:center;justify-content:center}
.tl .tx{flex:1 1 0%;min-width:0;display:flex;flex-direction:column;gap:2px}.tl .tx b{font-size:16px}.tl .tx span{font-size:13px;color:#6B5E55}
.tl>svg{color:#6B5E55;flex:0 0 auto}
.seg{display:grid;gap:4px;padding:4px;border-radius:14px;background:#F6EFE9}
.seg button{height:40px;border-radius:10px;border:0;background:transparent;color:#6B5E55;font-size:14px;font-weight:600;cursor:pointer}
.seg button.on{background:#FFFFFF;box-shadow:0 1px 3px rgba(31,26,23,.10);color:#1F1A17;font-weight:800}
.vac{padding:28px 16px;text-align:center;color:#6B5E55;font-size:15px;border-radius:18px;border:1px dashed #E3CFC2;background:#FFFFFF}
.nv{flex:0 0 auto;display:flex;background:#FFFFFF;border-top:1px solid #F1E4DA;padding:2px 6px calc(env(safe-area-inset-bottom,0px) + 8px)}
.nv button{position:relative;flex:1 1 0%;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 4px;border:0;background:transparent;color:#6B5E55;font-size:12px;font-weight:600;cursor:pointer}
.nv button span.i{width:52px;height:30px;border-radius:999px;display:flex;align-items:center;justify-content:center}
.nv button.on{color:#C4410C;font-weight:800}.nv button.on span.i{background:#FDEBDF}
.nv .bd{top:2px;right:calc(50% - 26px)}
.gps{display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:14px;background:#FDE8E8;color:#9B1C1C;font-size:14px;font-weight:700}
.gps button{margin-left:auto;height:36px;padding:0 12px;border-radius:10px;border:0;background:#C4410C;color:#FFFFFF;font-weight:800;cursor:pointer}
`;
  /* ---------- estilos extra de las páginas ---------- */
  const ESTILO2=`
.back2{width:44px;height:44px;flex:0 0 44px;border-radius:12px;border:1px solid #F1E4DA;background:#FFFFFF;display:flex;align-items:center;justify-content:center;color:#1F1A17;padding:0;cursor:pointer}
.fld{display:flex;flex-direction:column;gap:6px}.fld label{font-size:14px;font-weight:700}
.fld input,.fld select{width:100%;height:54px;border-radius:14px;border:1.5px solid #F1E4DA;background:#FFFFFF;padding:0 16px;font:600 16px PdInter,Inter,system-ui,sans-serif;color:#1F1A17;outline:none;box-sizing:border-box;-webkit-appearance:none;appearance:none}
.fld input:focus,.fld select:focus{border-color:#C4410C}
.mv{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #F1E4DA}.mv:last-child{border-bottom:0}
.mv .ic{flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.mv .tx{flex:1 1 0%;min-width:0}.mv .tx b{display:block;font-size:15px;overflow-wrap:anywhere}.mv .tx span{font-size:13px;color:#6B5E55}
.mv .am{font-size:16px;font-weight:800;white-space:nowrap}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.kp{padding:14px;border-radius:18px;background:#FFFFFF;border:1px solid #F1E4DA;display:flex;flex-direction:column;gap:2px}
.kp span{font-size:13px;color:#6B5E55;font-weight:600}.kp b{font-size:22px}.kp small{font-size:12px;color:#6B5E55}
.cd{background:#FFFFFF;border:1px solid #F1E4DA;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.slc{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.slc>small{text-align:center;font-size:12px;font-weight:800;color:#6B5E55;padding:2px 0}.slc>div{min-height:60px;height:auto;border-radius:12px;border:1px solid #F1E4DA;background:#FFFFFF;color:#1F1A17;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px 1px;font:inherit;min-width:0}.slc>div b{font-size:17px;font-weight:800;line-height:1.1}.slc>div small{font-size:10px;font-weight:700;color:#6B5E55;line-height:1.1;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.slc>div em{font-style:normal;font-size:9px;font-weight:800;color:#9A330A;background:#FDEBDF;border-radius:6px;padding:1px 3px;max-width:100%;overflow:hidden;white-space:nowrap}.slc .trabajado,.slc .ajuste{background:#E9F6EE;border-color:#CDEBD7}.slc .trabajado small,.slc .ajuste small{color:#0F5E2E}.slc .descanso{background:#FFF4EC;border-color:#F6D9C4}.slc .descanso small{color:#9A330A}.slc .falta{background:#FDE8E8;border-color:#F4C7C3}.slc .falta small,.slc .falta b{color:#9B1C1C}.slc .hoy{border:2px solid #C4410C}.slc .hoy small{color:#C4410C}.slc .libre,.slc .antes,.slc .dia31,.slc .ajusteFuturo{background:#F6EFE9;color:#9C8F86}.slc .adel{box-shadow:inset 0 0 0 2px #15803D}.slc>div{position:relative}.slc .vacp{background:#EAF1FE;border-color:#C9DBFB}.slc .vacp small,.slc .vacp b{color:#1D4ED8}.slc .vacn small{color:#9B1C1C}
.cal div{display:flex;flex-direction:column;align-items:center;gap:3px}.cal small{font-size:11px;color:#6B5E55;font-weight:700}
.cal i{width:100%;max-width:40px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;font-weight:800;background:#F6EFE9;color:#6B5E55}
.cal i.t{background:#E9F6EE;color:#0F5E2E}.cal i.r{background:#FDEBDF;color:#9A330A}.cal i.f{background:#FDE8E8;color:#9B1C1C}.cal i.h{background:#FFFFFF;border:1.5px solid #C4410C;color:#C4410C}
.ley{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#6B5E55}
.bar{height:10px;border-radius:999px;background:#F6EFE9;overflow:hidden}.bar s{display:block;height:100%;background:#C4410C;border-radius:999px}
.stars{color:#C4410C;letter-spacing:2px;font-size:16px}
.cols3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.stop{display:flex;gap:12px;align-items:center;padding:12px 14px;background:#FFFFFF;border:1px solid #F1E4DA;border-radius:16px}
.stop .n{flex:0 0 30px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;background:#C4410C;color:#FFFFFF}
.stop .tg{display:inline-flex;height:22px;align-items:center;padding:0 8px;border-radius:999px;font-size:12px;font-weight:800}
.ph{display:flex;gap:14px;align-items:center;padding:16px;border-radius:18px;background:#FFFFFF;border:1px solid #F1E4DA}
.ph .ava{flex:0 0 64px;width:64px;height:64px;font-size:26px}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
.chips button{flex:0 0 auto;height:38px;padding:0 14px;border-radius:999px;border:1px solid #F1E4DA;background:#FFFFFF;color:#1F1A17;font-size:14px;font-weight:700;cursor:pointer}
.chips button.on{border:0;background:#C4410C;color:#FFFFFF}
.av2{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:18px;background:#FFFFFF;border:1px solid #F1E4DA;text-align:left;width:100%;color:#1F1A17}
.av2 .ic{flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#FDEBDF;color:#C4410C}
.av2 .tx{flex:1 1 0%;min-width:0}.av2 .tx b{display:block;font-size:15px}.av2 .tx span{display:block;font-size:14px;color:#6B5E55;margin-top:2px;line-height:1.4}.av2 .tx small{display:block;font-size:12px;color:#6B5E55;margin-top:6px;font-weight:600}
.av2 .pt{flex:0 0 10px;width:10px;height:10px;border-radius:50%;background:#C4410C;margin-top:6px}
.list{scrollbar-width:none}.list::-webkit-scrollbar{display:none}
.opt span{font-size:13px;color:#6B5E55}
.msgok{padding:10px 12px;border-radius:12px;background:#E9F6EE;color:#0F5E2E;font-size:14px;font-weight:700}
.load{padding:24px;text-align:center;color:#6B5E55;font-size:15px}
`;
  const XI={
    plus:S('<path d="M12 5v14M5 12h14"/>'),minus:S('<path d="M5 12h14"/>'),doc:S('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>'),
    send:S('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'),camera:S('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
    logout:S('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),search:S('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    back:S('<path d="M15 18l-6-6 6-6"/>'),check:S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),nav:S('<path d="M3 11l18-8-8 18-2-8-8-2z"/>')
  };
  const D=()=>{try{return db}catch(e){return window.db}};
  const SES=()=>{try{return session}catch(e){return null}};
  const ref=U.ref,hora=U.hora;
  const diaLima=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'America/Lima'});
  const fecha=t=>{if(!t)return '';const d=new Date(t);return diaLima(d)===diaLima(Date.now())?'Hoy '+hora(d):d.toLocaleDateString('es-PE',{day:'2-digit',month:'short',timeZone:'America/Lima'}).replace('.','')+' · '+hora(d)};
  const aviso=t=>(window.pdAvisoMoto||window.pdAviso||alert)(t);
  const wa=u=>{if(typeof window.pdOpenWhatsApp==='function')window.pdOpenWhatsApp(u);else window.open(u,'_blank')};
  const adminTel=()=>{let ph='986233533';try{const c=typeof window.pdYapeCfg==='function'?window.pdYapeCfg():null;if(c&&c.whatsapp_admin)ph=String(c.whatsapp_admin)}catch(_){}ph=ph.replace(/\D/g,'');return ph.length===9?'51'+ph:ph};

  window.pdEnPagina=()=>!!sub||tab!=='inicio'||!!(window.PdPasos&&PdPasos.isOpen());
  let host=null,root=null,tab='inicio',sub=null,seg='nuevos',key='',scrollMem={},tocando=false;
  const C={};/* datos cargados por página */
  function cargar(k,fn,force){const c=C[k];if(c&&!force&&(c.busy||Date.now()-c.t<45000))return c;C[k]={busy:true,t:Date.now(),data:c&&c.data,err:null};
    Promise.resolve().then(fn).then(d=>{C[k]={t:Date.now(),data:d}},e=>{C[k]={t:Date.now(),data:c&&c.data,err:String(e&&e.message||e)}}).finally(()=>{key='';pintar()});return C[k]}
  const nuevos=()=>L().filter(o=>est(o)==='asignado');
  const curso=()=>L().filter(o=>!FIN.includes(est(o))&&est(o)!=='asignado'&&est(o)!=='pendiente');
  const hoyEnt=()=>{const k=diaLima(Date.now());return L().filter(o=>est(o)==='entregado'&&o.entregado_en&&diaLima(o.entregado_en)===k)};
  function paso(o){const s=est(o);
    if(s==='asignado')return ['Nuevo · acéptalo',0];
    if(['aceptado','pedido_aceptado','camino_recojo'].includes(s))return o.en_local_en?['Recoge el pedido',1]:['Ve al local',0];
    if(['en_camino','camino_entrega'].includes(s))return ['Lleva el pedido',2];
    if(['en_entrega','confirmando_pago'].includes(s))return o.pago_confirmado===true?['Confirma la entrega',4]:['Cobra al cliente',3];
    if(s==='entregado')return ['Entregado',5];return ['En curso',0]}
  function tarjeta(o,dest){
    const [txt,i]=paso(o),n=neg(o),nom=n.nombre||o.nombre_negocio||'';const s=est(o);
    const sv0=svc(o),sv=C_SV[sv0]?sv0:'Negocio';
    const hace=o.creado_en?Math.max(0,Math.round((Date.now()-new Date(o.creado_en).getTime())/60000)):null;
    const hTxt=hace==null?'':hace<1?'ahora':hace<60?'hace '+hace+' min':hora(o.creado_en);
    const nv=s==='asignado';/* pedido que te asignaron: aviso y botones para aceptar o rechazar */
    const tel=o.telefono_cliente||o.telefono_receptor||'';
    const d={ref:ref(o.id),sv,neg:sv==='Negocio'?nom:'',precio:M(o.total),
      cliente:nv?(o.direccion_entrega?'Entrega en '+String(o.direccion_entrega).split(',').slice(-1)[0].trim():'Entrega al cliente'):(o.nombre_cliente||o.nombre_receptor||'Cliente'),
      dir:nv?'Acepta para ver los datos del cliente':(o.direccion_entrega||''),hace:nv?hTxt:txt,
      fase:{n:s==='entregado'?6:i+1,k:s==='entregado'?'ok':s==='cancelado'?'no':'new',txt},
      pasos:[sv==='Compra'?'Comprar':sv==='Negocio'?'Al local':'Llegar','Recoger','Llevar','Cobrar','Entregar'],
      moto:!nv&&tel?{nombre:o.nombre_cliente||o.nombre_receptor||'Cliente',tel,rol:'Cliente'}:null,act:!!(dest||nv),attr:`data-o="${E(o.id)}"`,
      cuando:o.entregado_en?hora(o.entregado_en):hTxt};
    if(s==='entregado'||s==='cancelado')return cFila(d);
    if(nv)d.nuevo=1;if(nv)d.arriba=`<div class="cAv"><i></i>Pedido para ti<em>${E(hTxt)}</em></div>`;
    return cGrande(d)+(nv?`<div class="nvA"><button type="button" class="b" style="color:#B42318;border-color:#F4C7C3" data-a="rech:${E(o.id)}">Rechazar</button><button type="button" class="b g" data-a="acep:${E(o.id)}">Aceptar</button></div>`:'');
  }
  const top=(kick,title,right,back)=>`<div class="top"><div class="row">${back?`<button type="button" class="back2" data-a="volver" aria-label="Volver">${XI.back}</button>`:''}<div class="ttl"><div class="kick" style="color:#6B5E55">${E(kick)}</div><div class="h1">${E(title)}</div></div>${right||''}</div></div>`;
  const tl=(a,ic,t,s)=>`<button type="button" class="tl" data-a="${a}"><span class="ic">${ic}</span><span class="tx"><b>${t}</b><span>${s}</span></span>${IC.chev}</button>`;

  /* =============== INICIO =============== */
  function inicio(){
    const m=ME()||{},pr=window.__pidemasProfileRecord||{};
    const nombre=String(pr.nombre_completo||m.nombre_completo||'Motorizado').split(' ')[0];
    const des=!!m.en_descanso;const nv=nuevos(),cu=curso();
    const gpsEl=$('gpsStatus');const gpsMal=gpsEl&&!gpsEl.classList.contains('hidden')&&gpsEl.getClientRects().length&&/no|error|activa|permiso/i.test(gpsEl.textContent||'');
    let h='';
    if(gpsMal)h+=`<div class="gps">${IC.gps}<span>${E(($('gpsStatusText')||gpsEl).textContent.trim().slice(0,90))}</span><button type="button" data-a="gps">Activar</button></div>`;
    h+=`<div class="dsp${des?' off':''}"><span class="pt"></span><span style="flex:1 1 0%"><b style="display:block;font-size:16px">${des?'Estás en descanso':'Disponible para pedidos'}</b><span style="font-size:13px;color:#6B5E55">${des?'No te asignan pedidos nuevos':'Te pueden asignar pedidos ahora'}</span></span><button type="button" class="bt" data-a="descanso">${des?IC.refresh+'Volver':IC.coffee+'Descanso'}</button></div>`;
    nv.forEach(o=>h+=`<div class="kick">Pedido nuevo</div>`+tarjeta(o,true));
    cu.forEach((o,i)=>h+=(i===0?`<div class="kick">${cu.length>1?'Pedidos en curso':'Pedido en curso'}</div>`:'')+tarjeta(o,i===0&&!nv.length));
    if(!nv.length&&!cu.length)h+=`<div class="vac">No tienes pedidos en curso.<br>Te avisamos con sonido cuando te asignen uno.</div>`;
    const sal=($('homeSalaryBalance')||{}).textContent||'S/ 0.00',caj=($('homeCashBalance')||{}).textContent||'S/ 0.00';
    h+=`<div class="two"><button type="button" class="mt" data-t="billetera"><span>Sueldo acumulado</span><b>${E(sal.trim())}</b><small>Abrir billetera</small></button><button type="button" class="mt" data-t="caja"><span>Saldo en caja</span><b>${E(caj.trim())}</b><small>Por entregar a Pidemás</small></button></div>`;
    h+=tl('p:ruta',IC.route,'Ruta del día',cu.length?cu.length+' pedido'+(cu.length===1?'':'s')+' en curso':'Sin pedidos en curso')+tl('p:rendimiento',IC.chart,'Mi rendimiento','Entregas, tiempos y meta')+tl('p:calificaciones',IC.star,'Mis calificaciones','Lo que dicen los clientes')+tl('p:historial',IC.clock,'Historial','Buscar entregas pasadas');
    h+=`<div class="btns b2"><button type="button" class="b g" data-a="grupo">${U.I.wa}Abrir grupo</button><button type="button" class="b" data-a="act">${IC.refresh}Actualizar</button></div>`;
    const foto=pr.foto_url||'';const nb=noLeidos();
    const f=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'short',timeZone:'America/Lima'}).replace('.','');
    return {head:`<div class="hd"><span class="ava"${foto?` style="background-image:url('${E(foto)}')"`:''}>${foto?'':E(nombre.charAt(0))}</span><div style="flex:1 1 0%;min-width:0"><div class="kick" style="color:#6B5E55">${E(f)}</div><div class="h1">Hola, ${E(nombre)}</div></div><button type="button" class="ib" data-a="ayuda" aria-label="Soporte">${IC.help}</button><button type="button" class="ib" data-a="p:avisos" aria-label="Avisos">${IC.bell}${nb?`<span class="bd">${nb>99?'99+':nb}</span>`:''}</button></div>`,body:h};
  }
  let entLim=30;
  const entTodos=()=>L().filter(o=>est(o)==='entregado').sort((a,b)=>new Date(b.entregado_en||b.creado_en)-new Date(a.entregado_en||a.creado_en));
  function entLista(T){const out=[],hk=diaLima(Date.now()),ak=diaLima(Date.now()-864e5);let last='';T.slice(0,entLim).forEach(o=>{const k=diaLima(o.entregado_en||o.creado_en);if(k!==last){last=k;const n=T.filter(x=>diaLima(x.entregado_en||x.creado_en)===k).length;out.push(`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6B5E55"><span>${k===hk?'Hoy':k===ak?'Ayer':E(new Date(k+'T12:00:00').toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'short'}).replace('.',''))}</span><span>${n} pedido${n===1?'':'s'}</span></div>`)}out.push(tarjeta(o,false))});if(T.length>entLim)out.push(`<button type="button" class="b" data-a="entmas">Ver más entregados</button>`);return out.join('')}
  /* =============== PEDIDOS =============== */
  function pedidos(){
    const nv=nuevos(),cu=curso(),ho=hoyEnt();const lista={nuevos:nv,curso:cu,hoy:ho}[seg];
    let h=`<div class="seg" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[['nuevos','Nuevos',nv.length],['curso','En curso',cu.length],['hoy','Entregados',entTodos().length]].map(x=>`<button type="button" data-s="${x[0]}" class="${seg===x[0]?'on':''}">${x[1]} · ${x[2]}</button>`).join('')}</div>`;
    const ET=seg==='hoy'?entTodos():null;
    h+=ET?(ET.length?entLista(ET):`<div class="vac">Todavía no tienes pedidos entregados.</div>`):lista.length?lista.map(o=>tarjeta(o,seg==='nuevos')).join(''):`<div class="vac">${seg==='nuevos'?'No tienes pedidos nuevos.':seg==='curso'?'No tienes pedidos en curso.':'Aún no entregas pedidos hoy.'}</div>`;
    if(seg==='nuevos'&&nv.length)h+=U.note('Ábrelo para aceptarlo o rechazarlo.');
    return {head:top('Mis pedidos','Pedidos',`<button type="button" class="ib" data-a="act" aria-label="Actualizar">${IC.refresh}</button>`),body:h};
  }
  /* =============== CAJA =============== */
  const F={caja:{modo:'ingreso',monto:'',origen:'',otro:'',msg:'',ok:''},perfil:null,hist:{q:'',d:''},av:'todos'};
  function caja(){
    const c=cargar('caja',async()=>{const r=await (typeof fetchMotoCashMovements==='function'?fetchMotoCashMovements('id,motorizado_id,pedido_id,tipo,monto,descripcion,creado_en',false):D().from('movimientos_caja').select('*').eq('motorizado_id',ME().id).order('creado_en',{ascending:false}).limit(2000));if(r.error)throw r.error;return r.data||[]});
    const P=window.PdCaja;let h='';
    if(!c.data||!P)return {head:top('Mi caja','Caja',`<button type="button" class="ib" data-a="caja:act" aria-label="Actualizar">${IC.refresh}</button>`),body:c.err?`<div class="err">${E(c.err)}</div>`:'<div class="load">Cargando tu caja…</div>'};
    const sp=P.split(c.data),s=P.summary(sp.current);
    const k=diaLima(Date.now()),hoyM=sp.current.filter(m=>diaLima(m.creado_en)===k),sh=P.summary(hoyM);
    h+=`<div class="amt"><div class="k">Saldo en caja</div><div class="n">${M(s.balance)}</div><div class="pill">Por entregar a Pidemás</div></div>`;
    h+=`<div class="g2"><div class="kp"><span>Entró hoy</span><b>+ ${M(sh.ingresos)}</b><small>Cobros ${M(sh.cobros)} · Pidemás ${M(sh.fondos)}</small></div><div class="kp"><span>Salió hoy</span><b>− ${M(sh.retiros)}</b><small>Pagos, gastos y entregas</small></div></div>`;
    h+=`<div class="btns b2"><button type="button" class="b" style="height:50px;background:#15803D;border-color:#15803D;color:#FFFFFF" data-a="reg:ingreso">${XI.plus}Registrar ingreso</button><button type="button" class="b" style="height:50px;background:#B42318;border-color:#B42318;color:#FFFFFF" data-a="reg:salida">${XI.minus}Registrar salida</button></div>`;
    if(F.caja.ok)h+=`<div class="msgok">${E(F.caja.ok)}</div>`;
    /* movimientos */
    /* detalle ordenado: qué fue, montos (total · pagó con · vuelto) y la hora, cada cosa en su línea */
    const mvTx=m=>{const d=String(P.clean(m)||''),parts=d.split(/\s+·\s+/).map(x=>x.trim()).filter(Boolean),num=v=>Number(String(v).replace(/[^\d.]/g,''))||0;let tot=null,pc=null,vu=null;const otros=[];
      parts.forEach(x=>{let r;if((r=/^total\s+(S\/\s*[\d.,]+)/i.exec(x)))tot=r[1];else if((r=/^(?:el )?cliente pag[oó] con\s+(S\/\s*[\d.,]+)/i.exec(x)))pc=r[1];else if((r=/^vuelto(?: entregado)?\s+(S\/\s*[\d.,]+)/i.exec(x)))vu=r[1];else otros.push(x)});
      const t0=otros.length&&/^(cobro de |compra$|encomienda$)/i.test(otros[0])?otros.shift():'';
      const tit=(t0||(P.LABEL[P.kind(m)]||'Movimiento'))+(m.pedido_id?' · '+U.ref(m.pedido_id):'');
      const mon=[tot?'Total '+tot:'',pc&&num(pc)!==num(tot)?'pagó con '+pc:'',vu!=null?(num(vu)>0?'vuelto '+vu:(pc||tot?'sin vuelto':'')):''].filter(Boolean).join(' · ');
      const ln=(t,st)=>t?`<span style="display:block${st||''}">${E(t)}</span>`:'';
      return `<span class="tx"><b>${E(tit)}</b>${ln(otros.join(' · '))}${ln(mon,';color:#1F1A17;font-weight:600')}${ln(fecha(m.creado_en),';font-size:13px')}</span>`};
    const ico=m=>{const k2=P.kind(m);return k2==='cobro_pedido'?IC.box:k2==='fondo'?IC.user:k2==='entrega'||k2==='liquidacion'?IC.cash:m.tipo==='ingreso'?XI.plus:XI.minus};
    const mv=sp.current.slice(0,40).map(m=>`<div class="mv"><span class="ic" style="background:${m.tipo==='ingreso'?'#FDEBDF':'#F6EFE9'};color:${m.tipo==='ingreso'?'#C4410C':'#6B5E55'}">${ico(m)}</span>${mvTx(m)}<span class="am">${m.tipo==='ingreso'?'+':'−'} ${M(P.amount(m))}</span></div>`).join('');
    h+=`<div class="cd"><div class="lbl">Movimientos de la caja abierta</div>${mv||'<div style="color:#6B5E55;font-size:15px">Todavía no hay movimientos.</div>'}</div>`;
    h+=`<div class="btns b2"><button type="button" class="b g" data-a="caja:wa">${U.I.wa}Enviar resumen</button><button type="button" class="b" data-a="caja:excel">${XI.doc}Descargar Excel</button></div>`;
    if(sp.closed.length){const ab=window.__pdCajaAb??-1,fila=m=>`<div class="mv" style="padding-left:6px"><span class="ic" style="background:${m.tipo==='ingreso'?'#FDEBDF':'#F6EFE9'};color:${m.tipo==='ingreso'?'#C4410C':'#6B5E55'}">${ico(m)}</span>${mvTx(m)}<span class="am">${m.tipo==='ingreso'?'+':'−'} ${M(P.amount(m))}</span></div>`;
      /* al tocar una caja entregada se despliegan sus movimientos */
      h+=`<div class="cd"><div class="lbl">Cajas entregadas</div>${sp.closed.slice(0,8).map((x,i)=>{const on=ab===i,L=(x.movs||[]).slice().sort((a,b)=>new Date(b.creado_en)-new Date(a.creado_en));
        return `<button type="button" class="mv" data-a="cajac:${i}" aria-expanded="${on}" style="width:100%;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer;padding-left:0;padding-right:0"><span class="ic" style="background:#E9F6EE;color:#15803D">${XI.check}</span><span class="tx"><b>Entregada ${E(fecha(x.closer.creado_en))}</b><span>${x.summary.count} movimientos · cobros ${M(x.summary.cobros)} · ${on?'ocultar':'ver detalle'}</span></span><span class="am">${M(P.amount(x.closer))}</span></button>`+
          (on?`<div style="margin:0 0 8px 0;padding:6px 10px;border-radius:14px;background:#FBF6F2">${L.length?L.map(fila).join(''):'<div style="color:#6B5E55;font-size:14px;padding:8px 0">Sin movimientos.</div>'}${fila(x.closer)}</div>`:'')}).join('')}</div>`}
    window.__pdCajaResumen={s,sh};
    return {head:top('Mi caja','Caja',`<button type="button" class="ib" data-a="caja:act" aria-label="Actualizar">${IC.refresh}</button>`),body:h};
  }
  function registrar(){
    const f=F.caja,ing=f.modo==='ingreso';
    const SUB={'De Administrador':'Para vueltos o gastos','Otros':'Escribe el detalle','Entregue al administrador':'Le entregaste efectivo a Pidemás','Gaste en gasolina':'Combustible de la moto','Gaste en encomienda':'Pagaste una encomienda','Gasté en compra':'Pagaste una compra de un cliente'};
    const ops=[...(($(ing?'cashInSource':'expenseReason')||{}).options||[])].filter(o=>o.value).map(o=>[o.value,o.textContent.trim()]);
    const monto=Number(String(f.monto).replace(',','.'))||0;
    let h=`<div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button type="button" data-cm="ingreso" class="${ing?'on':''}">Ingreso</button><button type="button" data-cm="salida" class="${!ing?'on':''}">Salida</button></div>`;
    h+=`<div class="amt"><label for="cjM" class="k" style="display:block">Monto</label><div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px"><span class="n">S/</span><input id="cjM" inputmode="decimal" placeholder="0.00" value="${E(f.monto)}" data-in="monto" style="width:${Math.max(4,String(f.monto||'0.00').length)+0.6}ch;min-width:0;border:0;background:transparent;font:800 44px PdInter,Inter,system-ui,sans-serif;color:#1F1A17;outline:none;text-align:left;padding:0"></div></div>`;
    h+=`<div class="fld"><label>${ing?'¿De quién recibiste el efectivo?':'¿Para qué usaste el efectivo?'}</label><div class="opts">${ops.map(o=>`<button type="button" class="opt${f.origen===o[0]?' on':''}" data-og="${E(o[0])}"><b>${E(o[1])}</b>${SUB[o[0]]?`<span>${E(SUB[o[0]])}</span>`:''}</button>`).join('')}</div></div>`;
    if(f.origen==='Otros')h+=`<div class="fld"><label for="cjO">Detalle</label><input id="cjO" value="${E(f.otro)}" data-in="otro" placeholder="Escribe el detalle"></div>`;
    if(f.msg)h+=`<div class="err">${E(f.msg)}</div>`;
    const lista=monto>0&&f.origen&&(f.origen!=='Otros'||f.otro.trim());
    const lbl=(ing?'Guardar ingreso':'Guardar salida')+(monto>0?' de '+M(monto):'');
    return {head:top('Caja',ing?'Registrar ingreso':'Registrar salida',null,true),body:h,
      foot:`<button type="button" class="sl${lista?'':' off'}" data-slide="caja:guardar" aria-label="${E(lbl)}"${lista?'':' aria-disabled="true"'}><span class="fill"></span><span class="lb">${E(lbl)}</span><span class="kn">${U.I.arrow}</span></button><div class="hint">${lista?'Desliza para confirmar':'Escribe el monto y elige una opción'}</div>`};
  }
  async function cajaGuardar(){
    const f=F.caja,ing=f.modo==='ingreso';f.msg='';f.ok='';
    const ids=ing?['cashInAmount','cashInSource','cashInOtherSource','addCashIn','cashInMsg']:['expenseAmount','expenseReason','expenseOtherReason','addExpense','expenseMsg'];
    const [a,o,ot,,ms]=ids.map($);if(!a||!o){f.msg='No se encontró el formulario de caja. Actualiza la app.';return}
    if(!(Number(String(f.monto).replace(',','.'))>0)){f.msg='Escribe un monto mayor que S/ 0.00.';return}
    if(!f.origen){f.msg=ing?'Elige de quién recibiste el efectivo.':'Elige para qué usaste el efectivo.';return}
    a.value=String(f.monto).replace(',','.');o.value=f.origen;o.dispatchEvent(new Event('change',{bubbles:true}));if(ot)ot.value=f.otro;
    try{await (ing?window.addCashIn||addCashIn:window.addExpense||addExpense)()}catch(e){f.msg=String(e.message||e);return}
    const t=String(ms&&ms.textContent||'').trim();
    if(a.value===''||/registrad|guardad|correct/i.test(t)){f.ok=(ing?'Ingreso':'Salida')+' de '+M(f.monto)+' guardado.';f.monto='';f.origen='';f.otro='';C.caja=null;sub=null;if(history.state?.pdApp){ignorarPop=true;history.back()}}else f.msg=t||'No se pudo guardar.';
  }
  /* =============== BILLETERA =============== */
  function billetera(){
    const S2=window.PdSueldo;
    const c=cargar('sueldo',async()=>{const m=ME();const [a,b]=await Promise.all([D().from('motorizados').select('*').eq('id',m.id).maybeSingle(),D().from('control_sueldos').select('*').eq('motorizado_id',m.id).order('fecha',{ascending:true})]);if(b.error)throw b.error;return {moto:a.data||m,rows:b.data||[]}});
    const head=top('Mi billetera','Billetera',`<button type="button" class="ib" data-a="sueldo:act" aria-label="Actualizar">${IC.refresh}</button>`);
    if(!c.data||!S2)return {head,body:c.err?`<div class="err">${E(c.err)}</div>`:'<div class="load">Cargando tu sueldo…</div>'};
    let res;try{res=S2.calc(c.data.moto,c.data.rows)}catch(e){return {head,body:`<div class="err">${E(e.message)}</div>`}}
    const cfg=res.cfg,P=res.current,saldo=res.ok?Math.max(0,P.balance):0;
    let h=`<div class="amt"><div class="k">${E(P.label||'Quincena actual')}</div><div class="n">${M(saldo)}</div><div class="pill">Por cobrar de esta quincena</div></div>`;
    if(!res.ok)h+=U.st('Tu sueldo empieza a contarse cuando Pidemás registre: '+E((cfg.missing||[]).join(', '))+'.');
    else{const gas=res.hourly?P.gasTotal:P.gasDays*(S2.GAS||8);const desc=(P.descRows||[]).reduce((s,r)=>s+(Number(r.monto)||0),0);
      h+=`<div class="cd"><div class="lbl">Cómo se calcula</div><div class="li"><span>Sueldo</span><b>${M(P.earned-gas)}</b></div><div class="li"><span>Gasolina</span><b>${M(gas)}</b></div><div class="li"><span>Ganado</span><b>${M(P.earned)}</b></div>${desc?`<div class="li"><span>Descuentos</span><b>− ${M(desc)}</b></div>`:''}<div class="li"><span>Ya pagado</span><b>− ${M(P.paid)}</b></div><div class="li" style="border-top:1px solid #F1E4DA;padding-top:8px"><span>Por cobrar</span><b style="font-size:18px">${M(saldo)}</b></div></div>`;
      if(typeof window.__pdHoyMsg==='function')try{h+=U.note(E(window.__pdHoyMsg(P,res)))}catch(_){}}
    const DS={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'},ORD=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
    h+=`<div class="cd"><div class="lbl">Mi contrato</div><div class="li"><span>Ingreso</span><b>${cfg.hire?E(S2.parse(cfg.hire).toLocaleDateString('es-PE')):'Pendiente'}</b></div><div class="li"><span>Horario</span><b>${cfg.hourly?'Por horas':cfg.times?E(S2.fmtTime(cfg.times.start)+' – '+S2.fmtTime(cfg.times.end)):'Pendiente'}</b></div><div class="li"><span>Días</span><b>${(cfg.days||[]).length?E(ORD.filter(d=>cfg.days.includes(d)).map(d=>DS[d]).join(', ')):'Pendiente'}</b></div></div>`;
    if(res.ok&&!res.hourly){const cal=U.calSueldo(P,c.data.rows);if(cal)h+=`<div class="cd"><div class="lbl">Mi calendario de la quincena</div>${cal}</div>`}
    /* quincenas (la actual primero): al tocar una se despliega su detalle: días, faltas, gasolina, descuentos, adelantos y pagos */
    {const ab=window.__pdQuinAb||null,fd=v=>new Date(String(v).slice(0,10)+'T12:00:00').toLocaleDateString('es-PE',{weekday:'short',day:'2-digit',month:'short'}).replace('.','');
      const Q=(res.periods||[]).slice().sort((a,b)=>String(b.start).localeCompare(String(a.start)));
      const pays=c.data.rows.filter(r=>String(r.tipo||'').toLowerCase()==='pago');
      const det=p=>{const li=(k,v,c2)=>`<div class="li"><span>${k}</span><b${c2?` style="color:${c2}"`:''}>${v}</b></div>`;
        const gas=res.hourly?p.gasTotal:(p.gasDays||0)*(S2.GAS||8);
        const fal=(p.days||[]).filter(d=>d.status==='falta'&&d.falta),dsc=p.descRows||[],pg=(p.payments&&p.payments.length?p.payments:pays.filter(r=>String(r.periodo||'')===p.key)).slice().sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
        const dsT=dsc.reduce((a,r)=>a+(Number(r.monto)||0),0),bal=Math.max(0,Number(p.balance!=null?p.balance:(p.earned-dsT-p.paid))||0);
        let x=`<div style="margin:0 0 8px;padding:10px 12px;border-radius:14px;background:#FBF6F2;display:flex;flex-direction:column;gap:6px">`;
        x+=res.hourly?li('Turnos trabajados',String(p.worked||0))+li('Horas',String(Math.round((p.hours||0)*10)/10)):li('Días trabajados',String(p.worked||0))+li('Descansos pagados',String((p.rest||0)+(p.adj||0)))+li('Faltas',String(p.faltas||0),p.faltas?'#B42318':'');
        if(fal.length)x+=`<div style="font-size:13.5px;color:#B42318">${fal.map(d=>E(fd(d.date))+(d.falta.descripcion?' · '+E(d.falta.descripcion):'')).join('<br>')}</div>`;
        x+=`<div style="height:1px;background:#F1E4DA;margin:2px 0"></div>`+li('Sueldo',M(p.earned-gas))+li('Gasolina',M(gas))+li('Ganado',M(p.earned));
        if(dsc.length)x+=dsc.map(r=>li('Descuento'+(r.descripcion?' · '+E(r.descripcion):''),'− '+M(r.monto),'#B42318')).join('');
        if(pg.length)x+=pg.map(r=>{const ad=/^adelanto/i.test(String(r.descripcion||''));return li((ad?'Adelanto':'Pago')+' · '+E(fd(r.fecha))+(r.descripcion&&!ad?' · '+E(r.descripcion):''),'− '+M(r.monto),'#15803D')}).join('');
        else x+=li('Pagos y adelantos','Ninguno');
        x+=`<div class="li" style="border-top:1px solid #F1E4DA;padding-top:8px"><span>${bal>0.004?'Por cobrar':'Saldo'}</span><b style="font-size:17px">${M(bal)}</b></div></div>`;return x};
      h+=`<div class="cd"><div class="lbl">Mis quincenas</div>${Q.length?Q.map(p=>{const on=ab===p.key,dsT=(p.descRows||[]).reduce((a,r)=>a+(Number(r.monto)||0),0),bal=Math.max(0,Number(p.balance!=null?p.balance:(p.earned-dsT-p.paid))||0),act=P&&p.key===P.key;
        return `<button type="button" class="mv" data-a="quin:${E(p.key)}" aria-expanded="${on}" style="width:100%;border:0;background:transparent;text-align:left;font:inherit;color:inherit;cursor:pointer;padding-left:0;padding-right:0"><span class="ic" style="background:${act?'#FDEBDF':bal>0.004?'#FFF4E5':'#E9F6EE'};color:${act?'#C4410C':bal>0.004?'#9A5B00':'#15803D'}">${bal>0.004||act?XI.doc:XI.check}</span><span class="tx"><b>${E(p.label)}${act?' · actual':''}</b><span>Ganado ${M(p.earned)} · pagado ${M(p.paid)} · ${on?'ocultar':'ver detalle'}</span></span><span class="am">${bal>0.004?M(bal):'Pagada'}</span></button>`+(on?det(p):'')}).join(''):'<div style="color:#6B5E55;font-size:15px">Aún no hay quincenas.</div>'}</div>`}
    return {head,body:h};
  }
  /* =============== PERFIL =============== */
  function perfil(){
    const m=ME()||{},pr=window.__pidemasProfileRecord||{};
    if(!F.perfil)F.perfil={nombre:pr.nombre_completo||m.nombre_completo||'',tel:pr.telefono||m.telefono||'',doc:m.documento||'',placa:m.placa||'',grupo:m.enlace_grupo_whatsapp||'',file:null,prev:'',msg:'',ok:''};
    const f=F.perfil,foto=f.prev||pr.foto_url||'';
    if(f.kAb){const ti=f.kVer?'text':'password';
      let hk=`<div class="cd"><div class="fld"><label for="pfK1">Nueva contraseña</label><input id="pfK1" type="${ti}" autocomplete="new-password" maxlength="72" value="${E(f.k1||'')}" data-in="pf:k1"></div><div class="fld"><label for="pfK2">Repite la nueva contraseña</label><input id="pfK2" type="${ti}" autocomplete="new-password" maxlength="72" value="${E(f.k2||'')}" data-in="pf:k2"></div><button type="button" class="b" style="height:42px" data-a="pf:kver"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>${f.kVer?'Ocultar contraseñas':'Mostrar contraseñas'}</button><span style="font-size:13px;color:#6B5E55">Usa al menos 6 caracteres. Al cambiarla, entrarás con la nueva clave en todos tus teléfonos.</span></div>`;
      if(f.kMsg)hk+=`<div class="err">${E(f.kMsg)}</div>`;
      return {head:top('Seguridad','Cambiar contraseña',null,true).replace('data-a="volver"','data-a="pf:kx"'),body:hk,foot:`<button type="button" class="b o" style="height:54px;font-size:16px" data-a="pf:kok">Guardar contraseña</button>`}}
    const DS2={lunes:'Lun',martes:'Mar',miercoles:'Mié','miércoles':'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb','sábado':'Sáb',domingo:'Dom'};const dias=(Array.isArray(m.dias_laborables)?m.dias_laborables:String(m.dias_laborables||'').split(/[,;|]/)).map(d=>DS2[String(d).trim().toLowerCase()]||String(d).trim()).filter(Boolean).join(', ');
    let h=`<div class="ph"><label class="avaW" aria-label="Cambiar mi foto"><span class="ava"${foto?` style="background-image:url('${E(foto)}')"`:''}>${foto?'':E(String(f.nombre||'M').charAt(0))}</span><span class="avaC"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></span><input type="file" accept="image/jpeg,image/png,image/webp" data-in="foto" style="display:none"></label><div style="flex:1 1 0%;min-width:0"><b style="display:block;font-size:20px">${E(f.nombre||'Motorizado')}</b><span class="pl g" style="margin-top:4px">Motorizado · Activo</span></div></div>`;
    if(foto&&!f.prev)h+=`<button type="button" class="b" style="height:40px;color:#B42318;border-color:#F4C7C3" data-a="pf:fotoq">Quitar foto</button>`;
    h+=`<div class="cd"><div class="lbl">Mi trabajo</div><div class="li"><span>Horario</span><b style="white-space:normal;text-align:right">${E(m.horario_trabajo||'Lo configura Pidemás.')}</b></div><div class="li"><span>Días</span><b style="white-space:normal;text-align:right">${E(dias||'Lo configura Pidemás.')}</b></div><div class="li"><span>Ingreso</span><b>${E(m.fecha_ingreso||'Pendiente')}</b></div><div style="font-size:13px;color:#6B5E55">Si algo no es correcto, avísale a Pidemás.</div></div>`;
    const fl=(id,l,k,t,ph)=>`<div class="fld"><label for="${id}">${l}</label><input id="${id}" type="${t||'text'}" value="${E(f[k])}" data-in="pf:${k}"${ph?` placeholder="${E(ph)}"`:''}></div>`;
    h+=`<div class="cd"><div class="lbl">Mis datos</div>${fl('pfN','Nombres completos','nombre')}${fl('pfT','Teléfono','tel','tel')}${fl('pfD','DNI / documento','doc')}${fl('pfP','Placa de la moto','placa')}${fl('pfG','Enlace del grupo de WhatsApp','grupo','url','https://chat.whatsapp.com/…')}<div class="fld"><label>Correo</label><input value="${E(SES()?.user?.email||'')}" disabled></div></div>`;
    if(f.msg)h+=`<div class="err">${E(f.msg)}</div>`;if(f.ok)h+=`<div class="msgok">${E(f.ok)}</div>`;
    h+=`<button type="button" class="b o" style="height:54px;font-size:16px" data-a="pf:guardar">Guardar cambios</button>`+tl('pf:kab','<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>','Contraseña','Cambia la clave de tu panel')+(window.PdAvisos?window.PdAvisos.card('data-a','Suena cuando te asignan un pedido nuevo.'):'')+`<button type="button" class="b" style="height:54px;font-size:16px;color:#B42318;border-color:#F4C7C3;background:#FFFFFF" data-a="salir">${XI.logout}Cerrar sesión</button>`;
    return {head:top('Mi cuenta','Mi perfil'),body:h};
  }
  async function perfilGuardar(){
    const f=F.perfil;f.msg='';f.ok='';
    const set=(id,v)=>{const el=$(id);if(el)el.value=v};
    set('profileName',f.nombre);set('profilePhone',f.tel);set('profileDocument',f.doc);set('profilePlate',f.placa);set('profileWhatsAppGroup',f.grupo);
    const fi=$('profilePhotoFile');if(fi&&f.file){try{const dt=new DataTransfer();dt.items.add(f.file);fi.files=dt.files}catch(_){}}
    const box=$('profileMsg');const antes=box?box.textContent:'';
    try{await (window.saveProfile||saveProfile)()}catch(e){f.msg=String(e.message||e);return}
    const t=String(box&&box.textContent||'').trim();
    if(t&&t!==antes&&!/guardad|actualizad|correct/i.test(t))f.msg=t;else{f.ok='Cambios guardados.';f.file=null}
  }
  /* =============== AVISOS =============== */
  function avisos(){
    const c=cargar('avisos',async()=>{const r=await D().from('notificaciones').select('*').eq('usuario_id',SES().user.id).order('creado_en',{ascending:false}).limit(60);if(r.error)throw r.error;return r.data||[]});
    const head=top('Notificaciones','Avisos',null,true);
    if(!c.data)return {head,body:c.err?`<div class="err">${E(c.err)}</div>`:'<div class="load">Cargando avisos…</div>'};
    const cat=n=>typeof window.notificationCategory==='function'?window.notificationCategory(n):(typeof notificationCategory==='function'?notificationCategory(n):'sistema');
    const leido=n=>n.leida||(typeof pdReadLocal==='function'&&pdReadLocal().has(String(n.id)));
    const L2=c.data.filter(n=>F.av==='todos'||cat(n)===F.av);
    let h=`<div class="chips">${[['todos','Todos'],['pedidos','Pedidos'],['caja','Caja'],['sistema','Sistema']].map(x=>`<button type="button" data-av="${x[0]}" class="${F.av===x[0]?'on':''}">${x[1]}</button>`).join('')}</div>`;
    h+=L2.length?L2.map(n=>`<button type="button" class="av2"${n.pedido_id?` data-o="${E(n.pedido_id)}"`:''}><span class="ic">${cat(n)==='caja'?IC.cash:cat(n)==='pedidos'?IC.box:/sueldo|billetera|adelanto|pago a motorizado/i.test(String(n.titulo||'')+' '+String(n.mensaje||''))?IC.wallet:/cuenta|perfil|contraseñ|suspend|reactiv/i.test(String(n.titulo||''))?IC.user:IC.home}</span><span class="tx"><b>${E(n.titulo||'Aviso de Pidemás')}</b><span>${E(n.mensaje||'')}</span><small>${E(fecha(n.creado_en))}${n.pedido_id?' · Ver pedido '+E(ref(n.pedido_id)):''}</small></span>${leido(n)?'':'<span class="pt"></span>'}</button>`).join(''):'<div class="vac">No hay avisos en esta categoría.</div>';
    if(c.data.some(n=>!leido(n)))h+=`<button type="button" class="b" style="height:46px" data-a="av:leer">${XI.check}Marcar todo como leído</button>`;
    return {head,body:h};
  }
  function noLeidos(){const c=C.avisos;if(c&&c.data)return c.data.filter(n=>!n.leida&&!(typeof pdReadLocal==='function'&&pdReadLocal().has(String(n.id)))).length;return Number(($('topNotifBadge')||{}).textContent)||0}
  /* =============== RUTA DEL DÍA =============== */
  const pt=(a,b)=>a!=null&&b!=null&&a!==''&&b!==''&&!isNaN(a)&&!isNaN(b)?[+a,+b]:null;
  const km=(a,b)=>{const R=6371,r=x=>x*Math.PI/180,dl=r(b[0]-a[0]),dn=r(b[1]-a[1]);const h=Math.sin(dl/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
  function ruta(){
    const head=top('Hoy','Ruta del día',null,true);
    const c=cargar('ruta',async()=>{
      const yo=await new Promise(res=>{try{navigator.geolocation.getCurrentPosition(p=>res([p.coords.latitude,p.coords.longitude]),()=>res(null),{timeout:6000,maximumAge:60000})}catch(e){res(null)}});
      const RECOG=['en_camino','camino_entrega','en_entrega','confirmando_pago'];const par=[];
      for(const o of curso().concat(nuevos())){const n=neg(o);
        if(!RECOG.includes(est(o)))par.push({o,tipo:'recojo',p:pt(o.latitud_recojo,o.longitud_recojo)||pt(n.latitud,n.longitud),nom:n.nombre||o.direccion_recojo||'Punto de recojo'});
        par.push({o,tipo:'entrega',p:pt(o.latitud_entrega,o.longitud_entrega),nom:o.direccion_entrega||o.nombre_cliente||'Cliente'})}
      const orden=[];let aqui=yo;
      while(orden.length<par.length){const cand=par.filter(s=>!orden.includes(s)&&(s.tipo==='recojo'||!par.some(r=>r.tipo==='recojo'&&r.o===s.o&&!orden.includes(r))));
        cand.sort((a,b)=>(a.p&&aqui?km(aqui,a.p):999)-(b.p&&aqui?km(aqui,b.p):999));const s=cand[0];if(!s)break;orden.push(s);if(s.p)aqui=s.p}
      let tot=0,prev=yo;orden.forEach(s=>{if(s.p&&prev){s.d=km(prev,s.p);tot+=s.d}if(s.p)prev=s.p});return {yo,orden,tot}});
    if(!c.data)return {head,body:'<div class="load">Calculando la mejor ruta…</div>'};
    const {yo,orden,tot}=c.data;
    if(!orden.length)return {head,body:'<div class="vac">No tienes pedidos en curso. Cuando te asignen pedidos, aquí verás en qué orden te conviene ir.</div>'};
    const pts=orden.filter(s=>s.p);
    const todo='';/* sin ruta trazada: cada parada abre solo su punto */
    let h=tot?`<div class="amt"><div class="k">Recorrido aproximado</div><div class="n">${tot.toFixed(1)} km</div><div class="pill">${orden.length} paradas</div></div>`:'';
    h+=orden.map((s,i)=>`<div class="stop"><span class="n">${i+1}</span><span style="flex:1 1 0%;min-width:0"><span class="tg" style="background:${s.tipo==='recojo'?'#FDEBDF;color:#9A330A':'#E9F6EE;color:#0F5E2E'}">${s.tipo==='recojo'?'Recojo':'Entrega'} · ${E(ref(s.o.id))}</span><b style="display:block;font-size:16px;margin-top:4px">${E(s.nom)}</b><span style="font-size:13px;color:#6B5E55">${s.d!=null?s.d.toFixed(1)+' km':'Sin ubicación'}</span></span>${s.p?`<a class="b o" style="height:40px;padding:0 14px" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${s.p.join(',')}">${XI.nav}Ir</a>`:''}</div>`).join('');
    h+=U.note('Primero recoges y luego entregas, siempre yendo al punto más cercano.'+(yo?'':' Activa tu GPS para calcular mejor.'));
    return {head,body:h,foot:todo?`<a class="b o" style="height:54px" target="_blank" rel="noopener" href="${E(todo)}">${XI.nav}Abrir toda la ruta en Google Maps</a>`:''};
  }
  /* =============== RENDIMIENTO =============== */
  function rendimiento(){
    const head=top('Mis números','Mi rendimiento',null,true);
    const c=cargar('rend',async()=>{const m=ME();const dl=diaLima(Date.now()),[y,mo,d]=dl.split('-').map(Number);const iniQ=new Date(Date.UTC(y,mo-1,d<=15?1:16,5)).getTime(),ini7=Date.now()-6*864e5;
      let r=await D().from('pedidos').select('id,estado,creado_en,asignado_en,aceptado_en,en_camino_en,entregado_en,no_entregado').eq('motorizado_id',m.id).in('estado',['entregado','cancelado']).gte('creado_en',new Date(Math.min(iniQ,ini7)-864e5).toISOString()).limit(3000);
      if(r.error)r=await D().from('pedidos').select('id,estado,creado_en,asignado_en,aceptado_en,en_camino_en,entregado_en').eq('motorizado_id',m.id).in('estado',['entregado','cancelado']).gte('creado_en',new Date(Math.min(iniQ,ini7)-864e5).toISOString()).limit(3000);
      if(r.error)throw r.error;const T=x=>new Date(x).getTime();
      const P=(r.data||[]).map(p=>({...p,t:T(p.entregado_en||p.creado_en)})),ent=P.filter(p=>est(p)==='entregado');
      const mins=(a,b)=>a&&b?(T(b)-T(a))/60000:null,ok2=x=>x!=null&&x>=0&&x<240,avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
      const per=ent.filter(p=>p.t>=iniQ),viaje=per.map(p=>mins(p.en_camino_en,p.entregado_en)).filter(ok2),acep=per.map(p=>mins(p.asignado_en,p.aceptado_en)).filter(ok2);
      return {hoy:ent.filter(p=>diaLima(p.t)===dl).length,d7:ent.filter(p=>diaLima(p.t)>=diaLima(ini7)).length,q:per.length,viaje:avg(viaje),acep:avg(acep),aTiempo:viaje.length?Math.round(viaje.filter(x=>x<=25).length*100/viaje.length):null,noE:P.filter(p=>p.t>=iniQ&&p.no_entregado).length}});
    if(!c.data)return {head,body:c.err?`<div class="err">${E(c.err)}</div>`:'<div class="load">Cargando…</div>'};
    const d=c.data,f=v=>v==null?'—':Math.round(v)+' min';let meta=0;try{meta=+(localStorage.getItem('pidemas-moto-meta-dia')||0)}catch(_){}
    let h=`<div class="lbl">Entregas</div><div class="cols3"><div class="kp"><span>Hoy</span><b>${d.hoy}</b></div><div class="kp"><span>7 días</span><b>${d.d7}</b></div><div class="kp"><span>Quincena</span><b>${d.q}</b></div></div>`;
    h+=`<div class="lbl">Tus tiempos en la quincena</div><div class="g2"><div class="kp"><span>Entregas en</span><b>${f(d.viaje)}</b><small>desde que sales con el pedido</small></div><div class="kp"><span>Aceptas en</span><b>${f(d.acep)}</b><small>desde que te asignan</small></div><div class="kp"><span>A tiempo</span><b>${d.aTiempo==null?'—':d.aTiempo+'%'}</b><small>en 25 min o menos</small></div><div class="kp"><span>No entregados</span><b>${d.noE}</b><small>cliente no recibió</small></div></div>`;
    const pc=meta?Math.min(100,Math.round(d.hoy*100/meta)):0;
    h+=`<div class="cd"><div class="lbl">Mi meta de hoy</div>${meta?`<div class="li"><b>${d.hoy} de ${meta} entregas</b><span style="color:#6B5E55">${pc}%</span></div><div class="bar"><s style="width:${pc}%"></s></div>`:'<div style="color:#6B5E55;font-size:15px">Ponte una meta de entregas para hoy.</div>'}<div style="display:flex;gap:8px"><div class="fld" style="flex:1"><label for="rmM" style="position:absolute;width:1px;height:1px;overflow:hidden">Meta</label><input id="rmM" inputmode="numeric" maxlength="3" placeholder="Ej. 15" value="${meta||''}" data-in="meta"></div><button type="button" class="b o" style="height:54px" data-a="meta">Guardar meta</button></div></div>`;
    return {head,body:h};
  }
  /* =============== CALIFICACIONES =============== */
  function calificaciones(){
    const head=top('Clientes','Mis calificaciones',null,true);
    const c=cargar('cal',async()=>{const r=await D().from('calificaciones').select('pedido_id,estrellas_motorizado,comentario,creado_en').eq('motorizado_id',ME().id).order('creado_en',{ascending:false}).limit(300);if(r.error)throw r.error;return (r.data||[]).filter(x=>Number(x.estrellas_motorizado)>0)});
    if(!c.data)return {head,body:c.err?`<div class="err">${E(c.err)}</div>`:'<div class="load">Cargando…</div>'};
    const L2=c.data;if(!L2.length)return {head,body:'<div class="vac">Todavía no tienes calificaciones. Cuando los clientes califiquen tus entregas, las verás aquí.</div>'};
    const p=L2.reduce((s,x)=>s+Number(x.estrellas_motorizado),0)/L2.length,st=v=>'★'.repeat(Math.round(v))+'☆'.repeat(5-Math.round(v));
    let h=`<div class="amt"><div class="k">Tu promedio</div><div class="n">${p.toFixed(1)}</div><div class="pill"><span class="stars">${st(p)}</span>&nbsp;${L2.length} opinión${L2.length===1?'':'es'}</div></div>`;
    h+=`<div class="cd">${[5,4,3,2,1].map(n=>{const k=L2.filter(x=>Math.round(x.estrellas_motorizado)===n).length;return `<div style="display:flex;align-items:center;gap:10px"><b style="width:28px">${n}★</b><div class="bar" style="flex:1"><s style="width:${Math.round(k*100/L2.length)}%"></s></div><b style="width:24px;text-align:right">${k}</b></div>`}).join('')}</div>`;
    const com=L2.filter(x=>x.comentario).slice(0,25);
    h+=`<div class="cd"><div class="lbl">Comentarios</div>${com.length?com.map(x=>`<div class="mv"><span class="tx"><span class="stars">${st(x.estrellas_motorizado)}</span><b style="font-weight:500">${E(x.comentario)}</b><span>${E(fecha(x.creado_en))}</span></span></div>`).join(''):'<div style="color:#6B5E55;font-size:15px">Sin comentarios todavía.</div>'}</div>`;
    return {head,body:h};
  }
  /* =============== HISTORIAL =============== */
  function historial(){
    const head=top('Entregas pasadas','Historial',null,true);
    const c=cargar('hist',async()=>{const r=await D().from('pedidos').select('id,estado,nombre_cliente,telefono_cliente,direccion_entrega,total,metodo_pago,creado_en,entregado_en,motivo_cancelacion').eq('motorizado_id',ME().id).in('estado',['entregado','cancelado']).gte('creado_en',new Date(Date.now()-90*864e5).toISOString()).order('creado_en',{ascending:false}).limit(500);if(r.error)throw r.error;return r.data||[]});
    let h=`<div class="fld" style="position:relative"><label for="hQ" style="position:absolute;width:1px;height:1px;overflow:hidden">Buscar</label><input id="hQ" type="search" placeholder="Cliente, dirección o n.º de pedido" value="${E(F.hist.q)}" data-in="hq" style="padding-left:16px"></div>`;
    const hoyK=diaLima(Date.now()),ayK=diaLima(Date.now()-864e5);
    h+=`<div class="chips">${[['','Todos'],[hoyK,'Hoy'],[ayK,'Ayer']].map(x=>`<button type="button" data-hd="${x[0]}" class="${F.hist.d===x[0]?'on':''}">${x[1]}</button>`).join('')}</div>`;
    if(!c.data)return {head,body:h+(c.err?`<div class="err">${E(c.err)}</div>`:'<div class="load">Cargando…</div>')};
    const q=F.hist.q.trim().toLowerCase();
    const L2=c.data.filter(p=>(!F.hist.d||diaLima(p.entregado_en||p.creado_en)===F.hist.d)&&(!q||[ref(p.id),p.nombre_cliente,p.telefono_cliente,p.direccion_entrega].join(' ').toLowerCase().includes(q)));
    h+=`<div id="hLista">${histLista(L2)}</div>`;
    return {head,body:h};
  }
  const histLista=L2=>L2.length?L2.slice(0,120).map(p=>{const an=est(p)==='cancelado';return `<div class="stop" style="margin-bottom:8px"><span class="n" style="background:${an?'#FDE8E8':'#E9F6EE'};color:${an?'#9B1C1C':'#15803D'}">${an?'×':XI.check.replace('width="22" height="22"','width="16" height="16"')}</span><span style="flex:1 1 0%;min-width:0"><b style="display:block;font-size:15px">${E(p.nombre_cliente||'Cliente')} <span style="color:#6B5E55;font-weight:600">· ${E(ref(p.id))}</span></b><span style="font-size:13px;color:#6B5E55">${E(fecha(p.entregado_en||p.creado_en))}${an?' · Anulado'+(p.motivo_cancelacion?': '+E(p.motivo_cancelacion):''):' · '+E(p.direccion_entrega||'')}</span></span><b>${M(p.total)}</b></div>`}).join(''):'<div class="vac">No hay pedidos con ese filtro.</div>';

  /* =============== MENÚ Y PINTADO =============== */
  function nav(){
    const n=nuevos().length;const act=sub?(regreso||tab):tab;/* se marca la pestaña desde donde se abrió */
    const it=[['inicio','Inicio',IC.home],['pedidos','Pedidos',IC.box],['caja','Caja',IC.cash],['billetera','Billetera',IC.wallet],['perfil','Perfil',IC.user]];
    return `<nav class="nv" aria-label="Menú principal">${it.map(x=>`<button type="button" data-t="${x[0]}" class="${act===x[0]?'on':''}"${act===x[0]?' aria-current="page"':''}><span class="i">${x[2]}</span>${x[1]}${x[0]==='pedidos'&&n?`<span class="bd">${n}</span>`:''}</button>`).join('')}</nav>`;
  }
  /* Ventanas viejas de la app que quedan DEBAJO de esta pantalla (no las de confirmación, que van encima): si alguna se abre, esta pantalla se aparta */
  function tapada(){
    const W=innerWidth,H=innerHeight;
    for(const el of document.body.children){
      if(el.id==='pdAppShell'||el.tagName==='PD-PASOS-PEDIDO'||el.tagName==='SCRIPT'||el.tagName==='STYLE')continue;
      const cs=getComputedStyle(el);if(cs.position!=='fixed'||cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)continue;
      const z=parseInt(cs.zIndex,10)||0;if(z>=2147482000)continue;
      const r=el.getBoundingClientRect();if(r.width*r.height<W*H*0.45)continue;
      if(el.id==='appView'||el.id==='loginView')continue;
      return true;
    }
    return false;
  }
  function visible(){
    const m=ME();const av=$('appView');
    if(!m||!av||av.classList.contains('hidden'))return false;
    const ht=$('homeTab');if(ht&&ht.classList.contains('hidden')&&typeof window.switchTab==='function')try{window.switchTab('home')}catch(_){}
    if(tapada())return false;
    return true;
  }
  function vista(){
    if(sub)return ({avisos,ruta,rendimiento,calificaciones,historial,registrar})[sub]();
    return ({inicio,pedidos,caja,billetera,perfil})[tab]();
  }
  function pintar(){
    if(!visible()){if(host&&host.style.display!=='none'){host.style.display='none';document.documentElement.style.overflow=''}return}
    if(!host){
      host=document.createElement('pd-app-moto');
      const wrap=document.createElement('header');wrap.id='pdAppShell';wrap.style.cssText='display:contents';wrap.appendChild(host);document.body.appendChild(wrap);
      root=host.attachShadow({mode:'open'});try{PdPasos.flechas(root)}catch(_){}
      root.addEventListener('click',clic);root.addEventListener('input',entrada);root.addEventListener('change',entrada);
      root.addEventListener('pointerdown',()=>{tocando=Date.now()});root.addEventListener('pointerup',()=>setTimeout(()=>{tocando=false},150),true);root.addEventListener('click',()=>setTimeout(()=>{tocando=false},60),true);root.addEventListener('pointercancel',()=>{tocando=false});
    }
    if(host.style.display==='none')host.style.display='';
    if(tocando&&Date.now()-tocando<1500)return;tocando=false;/* un toque que no terminó no deja la pantalla congelada *//* no redibujar en medio de un toque */
    /* no redibujar mientras escribe */
    const v=vista();const pag=sub||tab;
    {const act=root.activeElement;if(act&&act.tagName==='INPUT'&&act.type!=='file'){if(root.__pag===pag)return;try{act.blur()}catch(_){}}}/* escribiendo: no redibuja; si cambió de página, sí */
    const k=pag+'|'+v.head+v.body+(v.foot||'')+nav();
    if(k===key)return;key=k;
    const lst=root.querySelector('.list');if(lst&&root.__pag)scrollMem[root.__pag]=lst.scrollTop;
    root.innerHTML=`<style>${ESTILO}${ESTILO2}</style><div class="app">${v.head}<div class="list">${v.body}</div>${v.foot?`<div class="foot">${v.foot}</div>`:''}${nav()}</div>`;
    const nl=root.querySelector('.list');if(nl)nl.scrollTop=root.__pag===pag?(scrollMem[pag]||0):(scrollMem[pag]=0,0);root.__pag=pag;
    if(document.documentElement.style.overflow!=='hidden')document.documentElement.style.overflow='hidden';
    armarSlide();
  }
  function actSlide(){const sl=root&&root.querySelector('[data-slide]');if(!sl)return;const f=F.caja,ing=f.modo==='ingreso',monto=Number(String(f.monto).replace(',','.'))||0;
    const ok=monto>0&&f.origen&&(f.origen!=='Otros'||f.otro.trim());sl.classList.toggle('off',!ok);
    const lb=(ing?'Guardar ingreso':'Guardar salida')+(monto>0?' de '+M(monto):'');sl.querySelector('.lb').textContent=lb;const hn=sl.nextElementSibling;if(hn)hn.textContent=ok?'Desliza para confirmar':'Escribe el monto y elige una opción'}
  function armarSlide(){
    const sl=root.querySelector('[data-slide]');if(!sl)return;
    const kn=sl.querySelector('.kn'),fill=sl.querySelector('.fill'),lb=sl.querySelector('.lb');let x0=null,dx=0,busy=false;
    const max=()=>sl.clientWidth-kn.offsetWidth-12;const set=v=>{kn.style.transform=`translateX(${v}px)`;fill.style.width=v>0?(v+57)+'px':'0';lb.style.opacity=Math.max(0,1-v/180)};
    const reset=()=>{kn.style.transition=fill.style.transition='transform .25s,width .25s';set(0);setTimeout(()=>{kn.style.transition=fill.style.transition=''},260)};
    const go=async()=>{if(busy||sl.classList.contains('off'))return reset();busy=true;set(max());lb.style.opacity=1;lb.textContent='Guardando…';
      if(sl.dataset.slide==='caja:guardar'){await cajaGuardar();try{window.loadCash&&window.loadCash()}catch(_){}}
      busy=false;key='';pintar()};
    sl.addEventListener('pointerdown',e=>{if(busy||sl.classList.contains('off'))return;x0=e.clientX;dx=0;try{sl.setPointerCapture(e.pointerId)}catch(_){}});
    sl.addEventListener('pointermove',e=>{if(x0===null)return;dx=Math.max(0,Math.min(max(),e.clientX-x0));set(dx)});
    const up=()=>{if(x0===null)return;x0=null;tocando=false;if(dx>=max()*0.8)go();else reset()};
    sl.addEventListener('pointerup',up);sl.addEventListener('pointercancel',up);
    sl.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}});
  }
  var regreso=null;/* pestaña desde donde se abrió la página, para volver ahí */
  function ir(t,s){
    const antes=sub||tab;if(s&&t&&t!==tab&&!sub)regreso=tab;else if(!s)regreso=null;tab=t||tab;sub=s||null;key='';
    if(sub&&!history.state?.pdApp)try{history.pushState({pdApp:1},'')}catch(_){}
    if(antes!==(sub||tab)){scrollMem[sub||tab]=0;if(sub)C[{ruta:'ruta',rendimiento:'rend',calificaciones:'cal',historial:'hist',avisos:'avisos'}[sub]]&&(C[{ruta:'ruta',rendimiento:'rend',calificaciones:'cal',historial:'hist',avisos:'avisos'}[sub]].t=0)}
    if(tab==='caja'&&!sub&&C.caja)C.caja.t=0;if(tab==='caja'&&!sub&&antes!=='registrar')F.caja.ok='';if(tab==='billetera'&&!sub&&C.sueldo)C.sueldo.t=0;
    if(tab==='perfil'&&!sub)F.perfil=null;
    pintar();
  }
  let ignorarPop=false;
  addEventListener('popstate',()=>{if(window.__pdPopPropio)return;if(ignorarPop){ignorarPop=false;return}if(!sub&&tab==='perfil'&&F.perfil&&F.perfil.kAb){Object.assign(F.perfil,{kAb:false,k1:'',k2:'',kMsg:''});key='';pintar();return}if(sub){sub=null;if(regreso){tab=regreso;regreso=null}key='';pintar()}});
  function abrirPedido(id){
    const o=L().find(x=>String(x.id)===String(id));const t=String(o?.tipo_servicio||'').toLowerCase();
    if(typeof window.pdAbrirPasosMoto==='function'&&o&&o.negocio_id&&!/encomienda|compra|recojo/.test(t))return window.pdAbrirPasosMoto(id);
    if(typeof window.pdAbrirPasosMotoSvc==='function'&&o&&/encomienda|compra|recojo/.test(t))return window.pdAbrirPasosMotoSvc(id);
    const f=window.toggleOrderDetails;const orig=f&&f.__orig||f;
    if(typeof orig==='function'){if(!document.querySelector(`#orders .order-collapsible[data-order-id="${CSS.escape(String(id))}"]`)&&typeof window.renderOrders==='function')try{window.renderOrders()}catch(_){}orig(id)}
  }
  function entrada(e){
    const el=e.target;const k=el.dataset&&el.dataset.in;if(!k)return;
    if(k==='monto'){el.value=el.value.replace(/[^\d.,]/g,'');F.caja.monto=el.value;el.style.width=(Math.max(4,(el.value||'0.00').length)+0.6)+'ch';actSlide()}
    else if(k==='otro'){F.caja.otro=el.value;actSlide()}
    else if(k==='hq'){F.hist.q=el.value;const c=C.hist;const box=root.getElementById('hLista');if(c&&c.data&&box){const q=el.value.trim().toLowerCase();box.innerHTML=histLista(c.data.filter(p=>(!F.hist.d||diaLima(p.entregado_en||p.creado_en)===F.hist.d)&&(!q||[ref(p.id),p.nombre_cliente,p.telefono_cliente,p.direccion_entrega].join(' ').toLowerCase().includes(q))))}}
    else if(k.startsWith('pf:'))F.perfil[k.slice(3)]=el.value;
    else if(k==='foto'&&e.type==='change'){const fl=el.files&&el.files[0];if(fl){const f=F.perfil;f.file=fl;f.prev=URL.createObjectURL(fl);key='';el.blur();pintar();perfilGuardar().then(()=>{if(F.perfil===f){if(f.ok)f.ok='Foto actualizada.';f.prev='';f.file=null}key='';pintar()})}}
  }
  async function clic(e){
    if(e.target.closest('[data-lnk]'))return;/* llamar / WhatsApp: abre el enlace sin abrir el pedido */
    tocando=false;
    const t=e.target.closest('[data-t]');if(t){if(window.PdPasos&&PdPasos.isOpen())PdPasos.close();ir(t.dataset.t,null);return}
    const s=e.target.closest('[data-s]');if(s){seg=s.dataset.s;key='';pintar();return}
    const cm=e.target.closest('[data-cm]');if(cm){F.caja.modo=cm.dataset.cm;F.caja.origen='';F.caja.msg='';F.caja.ok='';key='';pintar();return}
    const og=e.target.closest('[data-og]');if(og){F.caja.origen=og.dataset.og;key='';pintar();return}
    const av=e.target.closest('[data-av]');if(av){F.av=av.dataset.av;key='';pintar();return}
    const hd=e.target.closest('[data-hd]');if(hd){F.hist.d=hd.dataset.hd;key='';pintar();return}
    const o=e.target.closest('[data-o]');if(o){abrirPedido(o.dataset.o);return}
    const a=e.target.closest('[data-a]');if(!a)return;const A=a.dataset.a;const mm=window.pdMotoMej||{};
    if(A.startsWith('p:')){ir(tab,A.slice(2));return}
    if(A.startsWith('avs:')){if(a.disabled)return;a.disabled=true;try{if(window.PdAvisos)await window.PdAvisos.accion(A.slice(4))}finally{a.disabled=false;key='';pintar()}return}
    if(A.startsWith('acep:')||A.startsWith('rech:')){if(a.disabled)return;a.disabled=true;try{const id=A.slice(5);if(A[0]==='a'){if(typeof window.acceptOrder==='function')await window.acceptOrder(id)}else if(typeof window.rejectOrder==='function')await window.rejectOrder(id)}finally{a.disabled=false;key='';pintar()}return}
    if(A.startsWith('quin:')){const k=A.slice(5),cur=window.__pdQuinAb;window.__pdQuinAb=cur===k?null:k;key='';pintar();return}
    if(A.startsWith('cajac:')){const i=+A.slice(6);window.__pdCajaAb=window.__pdCajaAb===i?-1:i;key='';pintar();return}
    const ocupado=async fn=>{if(a.disabled)return;a.disabled=true;const tx=a.innerHTML;a.textContent='Un momento…';try{await fn()}finally{key='';pintar()}};
    switch(A){
      case 'volver':sub=null;if(regreso){tab=regreso;regreso=null}key='';pintar();if(history.state?.pdApp){ignorarPop=true;history.back()}break;
      case 'descanso':mm.descanso&&await mm.descanso();key='';pintar();break;
      case 'entmas':entLim+=30;key='';pintar();break;
      case 'act':try{window.loadOrders&&window.loadOrders()}catch(_){}break;
      case 'gps':$('gpsRetryBtn')?.click();break;
      case 'grupo':{let u='';try{u=String((ME()||{}).enlace_grupo_whatsapp||'').trim()}catch(_){}
        if(/^https:\/\/chat\.whatsapp\.com\//i.test(u))wa(u);else{aviso('Aún no tienes el enlace de tu grupo de WhatsApp. Pégalo en Perfil › Enlace del grupo de WhatsApp.');ir('perfil',null)}break}
      case 'ayuda':wa('https://wa.me/'+adminTel()+'?text='+encodeURIComponent('Hola, soy motorizado de Pidemás y necesito ayuda.'));break;
      case 'caja:act':C.caja&&(C.caja.t=0);try{window.loadCash&&window.loadCash()}catch(_){}key='';pintar();break;
      case 'reg:ingreso':case 'reg:salida':F.caja={modo:A==='reg:ingreso'?'ingreso':'salida',monto:'',origen:'',otro:'',msg:'',ok:''};ir('caja','registrar');break;
      case 'caja:wa':{const r=window.__pdCajaResumen;if(!r)break;const m=ME()||{};
        const txt=['*PIDEMÁS · RESUMEN DE CAJA*','Motorizado: '+(m.nombre_completo||''),'Fecha: '+new Date().toLocaleDateString('es-PE'),'','Saldo en caja: '+M(r.s.balance),'Cobros de hoy: '+M(r.sh.cobros),'Recibido de Pidemás hoy: '+M(r.sh.fondos),'Pagos y gastos de hoy: '+M(r.sh.pagos+r.sh.gastos),'Entregado hoy: '+M(r.sh.entregas)].join('\n');
        wa('https://wa.me/'+adminTel()+'?text='+encodeURIComponent(txt));break}
      case 'caja:excel':{const d=$('cashReportDate');if(d&&!d.value)d.value=diaLima(Date.now());await ocupado(async()=>{try{await (window.exportCashExcel||exportCashExcel)()}catch(err){aviso('No se pudo descargar: '+(err.message||err))}});break}
      case 'sueldo:act':C.sueldo&&(C.sueldo.t=0);key='';pintar();break;
      case 'pf:guardar':await ocupado(perfilGuardar);break;
      case 'pf:fotoq':{if(!(await (window.pdConfirmar?window.pdConfirmar('¿Quitar tu foto de perfil?'):Promise.resolve(confirm('¿Quitar tu foto de perfil?')))))break;
        await ocupado(async()=>{const f=F.perfil,uid=SES()?.user?.id;f.msg='';f.ok='';if(!uid)return;const q=await D().from('perfiles').update({foto_url:null}).eq('id',uid).select('id').maybeSingle();
          if(q.error){f.msg='No se pudo quitar la foto: '+q.error.message;return}if(window.__pidemasProfileRecord)window.__pidemasProfileRecord.foto_url=null;try{const im=$('profilePhotoPreview');if(im)im.removeAttribute('src')}catch(_){}f.prev='';f.file=null;f.ok='Foto eliminada.'});break}
      case 'pf:kab':Object.assign(F.perfil,{kAb:true,k1:'',k2:'',kMsg:'',kVer:false,ok:'',msg:''});try{history.pushState({pdApp:1,pdClave:1},'')}catch(_){}key='';pintar();setTimeout(()=>{try{(document.querySelector('pd-app-moto')?.shadowRoot||document).getElementById('pfK1')?.focus()}catch(_){}},60);break;
      case 'pf:kx':Object.assign(F.perfil,{kAb:false,k1:'',k2:'',kMsg:''});if(history.state?.pdClave){ignorarPop=true;history.back()}key='';pintar();break;
      case 'pf:kver':F.perfil.kVer=!F.perfil.kVer;key='';pintar();break;
      case 'pf:kok':await ocupado(async()=>{const f=F.perfil,n=String(f.k1||''),r=String(f.k2||'');f.kMsg='';
        if(n.length<6){f.kMsg='La nueva contraseña debe tener al menos 6 caracteres.';return}if(n!==r){f.kMsg='Las contraseñas no coinciden.';return}
        const {data,error}=await D().functions.invoke('cambiar-mi-password',{body:{password:n}});
        if(error){let m='';try{const j=await error.context.clone().json();m=j&&j.error||''}catch(_){}f.kMsg=m||'No se pudo cambiar la contraseña. Revisa tu internet.';return}
        if(data&&data.error){f.kMsg=data.error;return}
        Object.assign(f,{kAb:false,k1:'',k2:'',kVer:false});if(history.state?.pdClave){ignorarPop=true;history.back()}f.ok='Contraseña actualizada. Desde ahora entra con la nueva.'});key='';pintar();break;
      case 'salir':if(await (window.pdConfirmar?window.pdConfirmar('¿Cerrar sesión en este celular?'):Promise.resolve(confirm('¿Cerrar sesión?'))))$('logout')?.click();break;
      case 'av:leer':await ocupado(async()=>{try{await (window.markAllNotificationsRead||markAllNotificationsRead)()}catch(_){}C.avisos&&(C.avisos.t=0)});break;
      case 'meta':{const v=root.getElementById('rmM');const n=Math.max(0,parseInt(v&&v.value,10)||0);try{localStorage.setItem('pidemas-moto-meta-dia',String(n))}catch(_){}key='';pintar();break}
    }
  }
  setInterval(pintar,700);
  setInterval(()=>{if(host&&host.style.display!=='none')cargar('avisos',async()=>{const r=await D().from('notificaciones').select('*').eq('usuario_id',SES().user.id).order('creado_en',{ascending:false}).limit(60);if(r.error)throw r.error;return r.data||[]})},60000);
  window.pdAppMoto={pintar,ir,navH:()=>{if(!host||host.style.display==='none'||!root)return 0;const n=root.querySelector('.nv');return n?n.offsetHeight:0}};
})();
