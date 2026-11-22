(function(){
 const S=window.PdSueldo;if(!S)return;
 const $=id=>document.getElementById(id);
 const money=n=>'S/ '+Number(n||0).toFixed(2);
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmtD=i=>S.parse(i).toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
 const SHORT={lunes:'Lun',martes:'Mar',miercoles:'Mié',jueves:'Jue',viernes:'Vie',sabado:'Sáb',domingo:'Dom'};
 const ORDER=['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
 const cap=t=>t?t.charAt(0).toUpperCase()+t.slice(1):t;
 const r2=n=>Math.round((Number(n)||0)*100)/100;
 

 function breakdown(P,res,amt){
  const gas=res.hourly?r2(P.gasTotal):r2(P.gasDays*S.GAS);
  const sueldo=r2(P.earned-gas);
  const dias=P.worked+P.adj+P.rest;
  const sSub=res.hourly?`${P.worked} jornada${P.worked===1?'':'s'} · ${P.hours} h`:`${dias} día${dias===1?'':'s'} pagado${dias===1?'':'s'}`;
  const gSub=res.hourly?`${P.hours} h trabajadas`:`${P.gasDays} día${P.gasDays===1?'':'s'} × ${money(S.GAS)}`;
  const row=(label,sub,val,cls)=>`<div class="pdslBrRow${cls?' '+cls:''}"><span>${label}${sub?`<small>${sub}</small>`:''}</span><b>${val}</b></div>`;
  return `<div class="pdslBreak">${row('Sueldo',sSub,money(sueldo))}${row('Gasolina',gSub,money(gas))}${row('Ganado','',money(P.earned),'tot')}${(P.descRows||[]).length?(()=>{const g=new Map();(P.descRows||[]).forEach(r=>{const d=String(r.descripcion||'Descuento').replace(/^Descuento\s+/i,'').replace(/\s*·.*$/,'');const k=/AFP|ONP/i.test(d)?'AFP/ONP':/^cuota/i.test(d)?'Cuota de préstamo':/^tardanza/i.test(d)?'Tardanzas':/faltante/i.test(d)?'Faltante de caja':d;g.set(k,(g.get(k)||0)+(Number(r.monto)||0))});return [...g].map(([k,v])=>row('Descuento '+k,'','− '+money(v),'neg')).join('')})():''}${row('Pagado','',money(P.paid))}${row('Por cobrar','',amt,'fin')}</div>`;
 }
 window.__pdSueldoDetalle=breakdown;
 

 function hoyMsg(P,res){
  const d=(P.days||[]).find(x=>x.date===res.today);
  const suma='Tu jornada de hoy se suma '+(res.endAt||'al terminar tu horario');
  if(!d)return suma;
  switch(d.status){
   case 'dia31':return 'Hoy es día 31: ya va incluido en el día 30';
   case 'falta':return 'Hoy tienes una falta registrada: no se suma';
   case 'libre':return 'Hoy no es un día de trabajo: no se suma';
   case 'trabajado':case 'descanso':return 'Tu jornada de hoy ya se sumó';
   default:return suma;
  }
 }
 window.__pdHoyMsg=hoyMsg;
 let state=null;
 function render(){
  if(!state)return;
  const res=S.calc(state.moto,state.rows),cfg=res.cfg,P=res.current;
  const amt=res.ok?money(Math.max(0,P.balance)):money(0);
  const hb=$('homeSalaryBalance');if(hb)hb.textContent=amt;
  $('pdwCfg').innerHTML=cfg.hourly?`<span>Tipo</span><b>Por horas</b><span>Ingreso</span><b>${cfg.hire?E(S.parse(cfg.hire).toLocaleDateString('es-PE')):'—'}</b><span>Pago</span><b>S/ 25.625 + S/ 8 de gasolina por cada 5 h</b>`:`<span>Ingreso</span><b>${cfg.hire?E(S.parse(cfg.hire).toLocaleDateString('es-PE')):'Pendiente'}</b><span>Horario</span><b>${cfg.times?E(S.fmtTime(cfg.times.start)+' – '+S.fmtTime(cfg.times.end)):'Pendiente'}</b><span>Días</span><b>${cfg.days.length?E(ORDER.filter(d=>cfg.days.includes(d)).map(d=>SHORT[d]).join(', ')):'Pendiente'}</b>`;
  if(!res.ok){
   $('pdslHero').innerHTML=`<span class="pdslKick">${E(P.label)}</span><span class="pdslHeroAmt" id="pdMotoSalaryAmount">${amt}</span><div class="pdslAlert">Tu sueldo empezará a contarse cuando Administración registre: ${E(cfg.missing.join(', '))}.</div>`;
   $('pdslCal').innerHTML='<span class="pdslMuted" style="grid-column:1/-1">Aún no hay asistencia para mostrar.</span>';
   window.pdPintarPagosMoto=function(){const pays=state.rows.filter(r=>String(r.tipo||'').toLowerCase()==='pago').sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).slice(0,10);$('pdwPays').innerHTML=pays.length?pays.map(r=>{const adv=/^adelanto/i.test(String(r.descripcion||''));return `<div class="pdslRow"><span><strong>${money(r.monto)}</strong><small>${E(fmtD(r.fecha))}${r.descripcion?' · '+E(r.descripcion):''}${r.periodo?' · '+E(S.periodOf(String(r.periodo).slice(0,10)).label):''}</small></span><span class="pdslPill ${adv?'adv':'ok'}">${adv?'Adelanto':'Recibido'}</span></div>`}).join(''):'<span class="pdslMuted">Aún no tienes pagos registrados.</span>'};window.pdPintarPagosMoto();$('pdslHistory').innerHTML='<span class="pdslMuted">Aún no hay quincenas anteriores.</span>';return;
  }
  if(res.hourly){
   $('pdslHero').innerHTML=`<span class="pdslKick">${E(P.label)} · por horas</span>
   <span class="pdslHeroAmt" id="pdMotoSalaryAmount">${amt}</span><span class="pdslHeroSub">Por cobrar de esta quincena${P.balance<-0.004?' · ya te adelantaron '+money(-P.balance):''}</span>
   <div class="pdslStats"><div><span>Jornadas</span><strong>${P.worked}</strong></div><div><span>Horas</span><strong>${P.hours}</strong></div><div><span>Gasolina</span><strong>${money(P.gasTotal)}</strong></div><div><span>Pagado</span><strong>${money(P.paid)}</strong></div></div>
   ${breakdown(P,res,amt)}
   <span class="pdslHeroSub">Administración registra cada jornada que trabajas.</span>
   ${res.previousDue>0.004?`<div class="pdslAlert">Pendiente de quincenas anteriores: ${money(res.previousDue)}</div>`:''}`;
   $('pdslCalTitle').textContent=cap(P.label)||'Quincena actual';
   const sh=(P.shifts||[]).slice().reverse();
   $('pdslCal').innerHTML=sh.length?sh.map(s=>`<div class="pdslRow" style="grid-column:1/-1"><span><strong>${E(fmtD(s.date))} · ${s.horas} h</strong><small>Sueldo ${money(s.sueldo)} · gasolina ${money(s.gas)}</small></span><span class="pdslPill">${money(s.sueldo+s.gas)}</span></div>`).join(''):'<span class="pdslMuted" style="grid-column:1/-1">Aún no hay jornadas registradas en esta quincena.</span>';
  }else{
  $('pdslHero').innerHTML=`<span class="pdslKick">${E(P.label)}</span>
   <span class="pdslHeroAmt" id="pdMotoSalaryAmount">${amt}</span><span class="pdslHeroSub">Por cobrar de esta quincena${P.balance<-0.004?' · ya te adelantaron '+money(-P.balance):''}</span>
   <div class="pdslStats"><div><span>Trabajados</span><strong>${P.worked+P.adj}</strong></div><div><span>Descansos</span><strong>${P.rest}</strong></div><div><span>Gasolina</span><strong>${P.gasDays}</strong></div><div><span>Faltas</span><strong>${P.faltas}</strong></div></div>
   ${breakdown(P,res,amt)}
   <span class="pdslHeroSub">${E(hoyMsg(P,res))} · mes de 30 días${P.start>=S.FIXED_FROM?' · sueldo fijo '+money(Math.ceil(Math.round((15*(S.baseFor?S.baseFor(state.moto):S.BASE)+S.GAS_Q*S.GAS)*1e6)/1e4-0.5)/100)+' por quincena':''}</span>
   ${res.previousDue>0.004?`<div class="pdslAlert">Pendiente de quincenas anteriores: ${money(res.previousDue)}</div>`:''}`;
  $('pdslCalTitle').textContent=cap(P.label)||'Quincena actual';
  $('pdslCal').innerHTML=(P.days||[]).map(d=>{const n=d.adjDay||S.parse(d.date).getDate();
   const sub={ajuste:'Ajuste 30 días',ajusteFuturo:'Se suma al cerrar',dia31:'Incluido en el 30',trabajado:'Trabajado'+(d.gas?' + gas':''),descanso:d.holiday?'Feriado pagado':'Descanso pagado',falta:'Falta',hoy:'Hoy · '+res.endAt,futuro:d.work?'Laborable':(d.rest?'Descanso':'—'),libre:'Libre',antes:'Antes del ingreso'}[d.status]||'';
   const adv=d.adjDay?0:state.rows.filter(r=>String(r.tipo||'').toLowerCase()==='pago'&&/^adelanto/i.test(String(r.descripcion||''))&&String(r.fecha).slice(0,10)===d.date).reduce((a,r)=>a+(Number(r.monto)||0),0);
    return `<div class="pdslDay ${d.status}${d.adel?' adelantado':''}" data-date="${d.date}"><small>${E(d.adjDay?'Feb':SHORT[d.dow])}</small><b>${n}</b><small>${E(sub)}</small>${adv>0?`<i class="pdslAdvTag">Adelanto<b>${money(adv)}</b></i>`:''}</div>`}).join('');
  }
  window.pdPintarPagosMoto=function(){const pays=state.rows.filter(r=>String(r.tipo||'').toLowerCase()==='pago').sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).slice(0,10);$('pdwPays').innerHTML=pays.length?pays.map(r=>{const adv=/^adelanto/i.test(String(r.descripcion||''));return `<div class="pdslRow"><span><strong>${money(r.monto)}</strong><small>${E(fmtD(r.fecha))}${r.descripcion?' · '+E(r.descripcion):''}${r.periodo?' · '+E(S.periodOf(String(r.periodo).slice(0,10)).label):''}</small></span><span class="pdslPill ${adv?'adv':'ok'}">${adv?'Adelanto':'Recibido'}</span></div>`}).join(''):'<span class="pdslMuted">Aún no tienes pagos registrados.</span>'};window.pdPintarPagosMoto();
  const hist=res.periods.filter(p=>!p.isCurrent);
  $('pdslHistory').innerHTML=hist.length?hist.map(p=>`<div class="pdslRow"><span><strong>${E(cap(p.label))}</strong><small>${res.hourly?p.worked+' jornadas · '+p.hours+' h':p.worked+p.adj+' trabajados · '+p.rest+' descansos · '+p.faltas+' faltas'} · ganado ${money(p.earned)}${p.desc>0.004?' · descuento '+money(p.desc):''} · pagado ${money(p.paid)}</small></span>${p.balance>0.004?`<span class="pdslPill due">Debe ${money(p.balance)}</span>`:'<span class="pdslPill ok">Pagado</span>'}</div>`).join(''):'<span class="pdslMuted">Aún no hay quincenas anteriores.</span>';
 }
 async function load(){
  const box=$('pdMotoSalaryMsg');if(!box)return;
  if(typeof db==='undefined'||typeof moto==='undefined'||!moto){box.textContent='Inicia sesión para consultar tu sueldo.';return}
  try{
   const {data:m,error:e1}=await db.from('motorizados').select('*').eq('id',moto.id).maybeSingle();if(e1)throw e1;
   const cfg=S.config(m||{});
   let q=db.from('control_sueldos').select('*').eq('motorizado_id',moto.id).order('fecha',{ascending:true});
   if(cfg.hire)q=q.gte('fecha',S.periodOf(cfg.hire).start);
   const {data,error}=await q;if(error)throw error;
   state={moto:m||{},rows:data||[]};box.textContent='';render();
   try{document.dispatchEvent(new CustomEvent('pd:sueldo',{detail:state.rows}))}catch(e){}
  }catch(e){box.textContent='No se pudo leer tu sueldo: '+(e&&e.message?e.message:'revisa la conexión.');console.error(e)}
 }
 window.__pdMotoLoadSalary=load;
 $('pdWalletRefresh')?.addEventListener('click',async()=>{const b=$('pdWalletRefresh');b.classList.add('spin');try{await load()}finally{b.classList.remove('spin')}});
 document.addEventListener('click',e=>{if(e.target.closest('#refreshCash'))setTimeout(load,500)});
 window.addEventListener('load',()=>setTimeout(load,1200));
 setInterval(render,60000);
 setInterval(()=>{if(!document.hidden)load()},5*60000);
})();
