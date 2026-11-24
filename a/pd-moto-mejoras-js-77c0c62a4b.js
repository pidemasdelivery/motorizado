/* Ruta del día · Ganancias · Calificaciones · Descanso · Aviso de llegada · Historial · Recordatorio de cierre de caja */
(function(){
  if(window.__pdMotoMej)return;window.__pdMotoMej=1;
  const $=id=>document.getElementById(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const M=n=>'S/ '+(Number(n)||0).toFixed(2);
  const D=()=>{try{return db}catch(e){return window.db}};
  const ME=()=>{try{return moto}catch(e){return null}};
  const OR=()=>{try{return Array.isArray(orders)?orders:[]}catch(e){return []}};
  const T=v=>{const t=new Date(v).getTime();return Number.isFinite(t)?t:0};
  const ref=id=>'#'+String(id||'').slice(0,8).toUpperCase();
  const est=o=>String(o&&o.estado||'').toLowerCase();
  const tel=t=>{const d=String(t||'').replace(/\D/g,'');if(!d)return '';return d.startsWith('51')?d:(d.length===9?'51'+d:d)};
  const fH=v=>{try{return new Date(v).toLocaleString('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'short',hour:'numeric',minute:'2-digit'})}catch(e){return ''}};
  const diaLima=v=>new Date(v).toLocaleDateString('en-CA',{timeZone:'America/Lima'});
  const aviso=t=>(window.pdAvisoMoto||window.pdAviso||alert)(t);
  const ACTIVOS=['asignado','aceptado','pedido_aceptado','camino_recojo','en_camino','en_entrega','camino_entrega'];
  const RECOGIDO=['en_camino','en_entrega','camino_entrega'];
  function hoja(titulo,html){
    let v=$('pdmmVelo');if(v)v.remove();v=document.createElement('div');v.id='pdmmVelo';v.className='pdsmVelo';
    v.innerHTML='<div class="pdsmHoja" role="dialog" aria-modal="true" aria-label="'+E(titulo)+'"><div class="pdsmTop"><strong>'+E(titulo)+'</strong><button type="button" class="pdsmX" aria-label="Cerrar">×</button></div><div class="pdmmB">'+html+'</div></div>';
    document.body.appendChild(v);const c=()=>v.remove();v.querySelector('.pdsmX').onclick=c;v.addEventListener('click',e=>{if(e.target===v)c()});
    return v.querySelector('.pdmmB');
  }
  const rad=x=>x*Math.PI/180;
  const km=(a,b)=>{if(!a||!b)return null;const R=6371,dl=rad(b[0]-a[0]),dn=rad(b[1]-a[1]);const h=Math.sin(dl/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
  let pos=null;
  function leerPos(){return new Promise(res=>{if(!navigator.geolocation)return res(pos);navigator.geolocation.getCurrentPosition(p=>{pos=[p.coords.latitude,p.coords.longitude];res(pos)},()=>{const m=ME();res(pos||(m&&m.latitud&&m.longitud?[+m.latitud,+m.longitud]:null))},{enableHighAccuracy:true,timeout:8000,maximumAge:30000})})}
  const pt=(a,b)=>{const x=Number(a),y=Number(b);return Number.isFinite(x)&&Number.isFinite(y)&&x&&y?[x,y]:null};
  const negs=new Map();
  async function negocio(id){if(!id)return null;if(negs.has(id))return negs.get(id);let n=null;try{const r=await D().from('negocios').select('id,nombre,direccion,latitud,longitud').eq('id',id).maybeSingle();n=r.data||null}catch(e){}negs.set(id,n);return n}
  const gmaps=p=>'https://www.google.com/maps/search/?api=1&query='+p[0]+','+p[1];

  /* ---------- Tarjeta en Inicio ---------- */
  function tarjeta(){
    const home=$('pdHomeCard');if(!home||!home.parentNode)return;const m=ME();if(!m)return;
    let c=$('pdmmTools');
    if(!c){c=document.createElement('section');c.id='pdmmTools';c.addEventListener('click',e=>{const b=e.target.closest('[data-mm]');if(!b)return;({descanso,ruta,rendimiento,calificaciones,historial})[b.dataset.mm]()})}
    if(c.previousElementSibling!==home)home.after(c);
    const des=!!m.en_descanso,act=OR().filter(o=>ACTIVOS.includes(est(o))).length;
    const hd='<button type="button" data-mm="descanso" class="pdmmDes '+(des?'on':'')+'"><i></i><span><b>'+(des?'Estás en descanso':'Disponible para pedidos')+'</b><small>'+(des?'Toca para volver a estar disponible':'Toca si vas a almorzar o descansar')+'</small></span></button>';
    const h='<div class="pdmmGrid"><button type="button" data-mm="ruta"><b>Ruta del día</b><small>'+(act?act+' pedido'+(act===1?'':'s')+' en curso':'Sin pedidos en curso')+'</small></button><button type="button" data-mm="rendimiento"><b>Mi rendimiento</b><small>Entregas, tiempos y meta</small></button><button type="button" data-mm="calificaciones"><b>Mis calificaciones</b><small>'+(calN?'★ '+calP.toFixed(1)+' · '+calN+' opinión'+(calN===1?'':'es'):'Lo que dicen los clientes')+'</small></button><button type="button" data-mm="historial"><b>Historial</b><small>Buscar entregas pasadas</small></button></div>';
    if(c.__h!==h){c.__h=h;c.innerHTML=h}
    let d=$('pdmmDesTop');
    if(!d){d=document.createElement('section');d.id='pdmmDesTop';d.addEventListener('click',e=>{const b=e.target.closest('[data-mm]');if(!b)return;descanso()})}
    if(d.nextElementSibling!==home||d.parentNode!==home.parentNode)home.before(d);
    if(d.__h!==hd){d.__h=hd;d.innerHTML=hd}
  }

  /* ---------- 4. Descanso ---------- */
  async function descanso(){
    const m=ME();if(!m)return;const v=!m.en_descanso;
    if(v&&OR().some(o=>ACTIVOS.includes(est(o)))&&!(await pdConfirmar('Todavía tienes pedidos en curso. ¿Igual quieres ponerte en descanso? No te asignarán pedidos nuevos.')))return;
    const r=await D().from('motorizados').update({en_descanso:v,en_descanso_desde:v?new Date().toISOString():null}).eq('id',m.id);
    if(r.error){aviso(/en_descanso/.test(r.error.message)?'Esta opción todavía no está activada. Avísale a administración.':'No se pudo cambiar: '+r.error.message);return}
    m.en_descanso=v;m.en_descanso_desde=v?new Date().toISOString():null;tarjeta();
    (window.pdExito||aviso)(v?'Listo, estás en descanso. Administración ya lo ve.':'¡Bienvenido de vuelta! Ya puedes recibir pedidos.');
  }

  /* ---------- 1. Ruta del día ---------- */
  async function ruta(){
    const b=hoja('Ruta del día','<p class="pdmmMut">Calculando la mejor ruta…</p>');
    const yo=await leerPos();const paradas=[];
    for(const o of OR().filter(o=>ACTIVOS.includes(est(o)))){
      if(!RECOGIDO.includes(est(o))){let p=pt(o.latitud_recojo,o.longitud_recojo),nom=o.direccion_recojo||'';if(!p&&o.negocio_id){const n=await negocio(o.negocio_id);if(n){p=pt(n.latitud,n.longitud);nom=n.nombre||n.direccion||nom}}
        paradas.push({o,tipo:'recojo',p,nom:nom||'Punto de recojo'})}
      paradas.push({o,tipo:'entrega',p:pt(o.latitud_entrega,o.longitud_entrega),nom:o.direccion_entrega||o.nombre_cliente||'Cliente'});
    }
    if(!paradas.length){b.innerHTML='<p class="pdmmMut">No tienes pedidos en curso. Cuando te asignen pedidos, aquí verás en qué orden te conviene ir.</p>';return}
    const orden=[],hechos=new Set();let aqui=yo;
    while(orden.length<paradas.length){
      const cand=paradas.filter(s=>!orden.includes(s)&&(s.tipo==='recojo'||!paradas.some(r=>r.tipo==='recojo'&&r.o===s.o&&!orden.includes(r))));
      cand.sort((a,c)=>{const da=a.p&&aqui?km(aqui,a.p):999,dc=c.p&&aqui?km(aqui,c.p):999;return da-dc});
      const s=cand[0];if(!s)break;orden.push(s);if(s.p)aqui=s.p;
    }
    let tot=0,prev=yo;orden.forEach(s=>{if(s.p&&prev){s.d=km(prev,s.p);tot+=s.d}if(s.p)prev=s.p});
    const pts=orden.filter(s=>s.p);
    const todo='';/* sin ruta trazada: cada parada abre solo su punto */
    b.innerHTML=(tot?'<div class="pdmmStat"><span>Recorrido aproximado</span><b>'+tot.toFixed(1)+' km</b></div>':'')
      +orden.map((s,i)=>'<div class="pdmmStop"><span class="pdmmN '+s.tipo+'">'+(i+1)+'</span><span class="pdmmTx"><b>'+(s.tipo==='recojo'?'Recoger':'Entregar')+' '+E(ref(s.o.id))+'</b><small>'+E(s.nom)+(s.d!=null?' · '+s.d.toFixed(1)+' km':'')+'</small></span>'+(s.p?'<a class="pdmmGo" target="_blank" rel="noopener" href="'+gmaps(s.p)+'">Ir</a>':'<small class="pdmmSin">Sin ubicación</small>')+'</div>').join('')
      +(todo?'<a class="btn pdmmTodo" target="_blank" rel="noopener" href="'+todo+'">Abrir toda la ruta en Google Maps</a>':'')
      +'<p class="pdmmMut">Primero recoges y luego entregas, siempre yendo al punto más cercano.'+(yo?'':' Activa tu GPS para calcular mejor.')+'</p>';
  }

  /* ---------- 2. Mi rendimiento ---------- */
  const KMETA='pidemas-moto-meta-dia';
  async function rendimiento(){
    const b=hoja('Mi rendimiento','<p class="pdmmMut">Cargando…</p>');const m=ME();
    const dl=diaLima(Date.now()),[y,mo,d]=dl.split('-').map(Number);
    const iniQ=new Date(Date.UTC(y,mo-1,d<=15?1:16,5)).getTime(),ini7=Date.now()-6*864e5;
    let r=await D().from('pedidos').select('id,estado,creado_en,asignado_en,aceptado_en,en_camino_en,entregado_en,no_entregado').eq('motorizado_id',m.id).in('estado',['entregado','cancelado']).gte('creado_en',new Date(Math.min(iniQ,ini7)-864e5).toISOString()).limit(3000);
    if(r.error)r=await D().from('pedidos').select('id,estado,creado_en,asignado_en,aceptado_en,en_camino_en,entregado_en').eq('motorizado_id',m.id).in('estado',['entregado','cancelado']).gte('creado_en',new Date(Math.min(iniQ,ini7)-864e5).toISOString()).limit(3000);
    if(r.error){b.innerHTML='<p class="pdmmErr">'+E(r.error.message)+'</p>';return}
    const P=(r.data||[]).map(p=>({...p,t:T(p.entregado_en||p.creado_en)}));const ent=P.filter(p=>est(p)==='entregado');
    const cnt=f=>ent.filter(f).length;
    const nHoy=cnt(p=>diaLima(p.t)===dl),n7=cnt(p=>p.t>=ini7-864e5&&diaLima(p.t)>=diaLima(ini7)),nQ=cnt(p=>p.t>=iniQ);
    const mins=(a,c)=>a&&c?(T(c)-T(a))/60000:null,ok2=x=>x!=null&&x>=0&&x<240,avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
    const per=ent.filter(p=>p.t>=iniQ);
    const viaje=per.map(p=>mins(p.en_camino_en,p.entregado_en)).filter(ok2),acep=per.map(p=>mins(p.asignado_en,p.aceptado_en)).filter(ok2);
    const aTiempo=viaje.filter(x=>x<=25).length,noE=P.filter(p=>p.t>=iniQ&&p.no_entregado).length;
    const f=v=>v==null?'—':Math.round(v)+' min';
    let meta=+(localStorage.getItem(KMETA)||0);
    const pint=()=>{const pc=meta?Math.min(100,Math.round(nHoy*100/meta)):0;
      b.innerHTML='<div class="pdmmLbl">Entregas</div><div class="pdmmGrid3"><div><span>Hoy</span><b>'+nHoy+'</b></div><div><span>7 días</span><b>'+n7+'</b></div><div><span>Quincena</span><b>'+nQ+'</b></div></div>'
        +'<div class="pdmmLbl">Tus tiempos en la quincena</div><div class="pdmmGrid2"><div><span>Entregas en promedio</span><b>'+f(avg(viaje))+'</b><small>desde que sales con el pedido</small></div><div><span>Aceptas en promedio</span><b>'+f(avg(acep))+'</b><small>desde que te asignan</small></div><div><span>Entregas a tiempo</span><b>'+(viaje.length?Math.round(aTiempo*100/viaje.length)+'%':'—')+'</b><small>en 25 min o menos</small></div><div><span>No entregados</span><b>'+noE+'</b><small>cliente no recibió</small></div></div>'
        +'<div class="pdmmLbl">Mi meta de hoy</div>'+(meta?'<div class="pdmmBar"><s style="width:'+pc+'%"></s></div><p class="pdmmMut"><b>'+nHoy+' de '+meta+'</b> entregas'+(nHoy>=meta?' · ¡Meta cumplida! 🎉':' · te faltan '+(meta-nHoy))+'</p>':'<p class="pdmmMut">Ponte una meta de entregas para hoy.</p>')
        +'<div class="pdmmMeta"><input id="pdmmMetaIn" inputmode="numeric" maxlength="3" placeholder="Ej. 15" value="'+(meta||'')+'"><button type="button" class="btn" id="pdmmMetaOk">Guardar meta</button></div>';
      $('pdmmMetaOk').onclick=()=>{meta=Math.max(0,parseInt($('pdmmMetaIn').value,10)||0);try{localStorage.setItem(KMETA,String(meta))}catch(e){}pint()}};
    pint();
  }

  /* ---------- 3. Calificaciones ---------- */
  let calP=0,calN=0;
  async function leerCal(){const m=ME();if(!m)return [];const r=await D().from('calificaciones').select('pedido_id,estrellas_motorizado,comentario,creado_en').eq('motorizado_id',m.id).order('creado_en',{ascending:false}).limit(300);const L=(r.data||[]).filter(c=>Number(c.estrellas_motorizado)>0);calN=L.length;calP=L.length?L.reduce((s,c)=>s+Number(c.estrellas_motorizado),0)/L.length:0;return L}
  async function calificaciones(){
    const b=hoja('Mis calificaciones','<p class="pdmmMut">Cargando…</p>');const L=await leerCal().catch(()=>[]);
    if(!L.length){b.innerHTML='<p class="pdmmMut">Todavía no tienes calificaciones. Cuando los clientes califiquen tus entregas, las verás aquí.</p>';return}
    const st=v=>'★'.repeat(Math.round(v))+'☆'.repeat(5-Math.round(v));
    b.innerHTML='<div class="pdmmCal"><b>'+calP.toFixed(1)+'</b><span class="pdmmStars">'+st(calP)+'</span><small>'+L.length+' calificación'+(L.length===1?'':'es')+'</small></div>'
      +[5,4,3,2,1].map(n=>{const c=L.filter(x=>Math.round(x.estrellas_motorizado)===n).length;return '<div class="pdmmDist"><span>'+n+'★</span><i><s style="width:'+Math.round(c*100/L.length)+'%"></s></i><b>'+c+'</b></div>'}).join('')
      +'<div class="pdmmLbl">Comentarios</div>'+(L.filter(c=>c.comentario).slice(0,25).map(c=>'<div class="pdmmRow"><span><b class="pdmmStars">'+st(c.estrellas_motorizado)+'</b><small>'+E(c.comentario)+' · '+E(fH(c.creado_en))+'</small></span></div>').join('')||'<p class="pdmmMut">Sin comentarios todavía.</p>');
    tarjeta();
  }

  /* ---------- 6. Historial ---------- */
  async function historial(){
    const b=hoja('Historial de entregas','<p class="pdmmMut">Cargando…</p>');const m=ME();
    const r=await D().from('pedidos').select('id,estado,nombre_cliente,telefono_cliente,direccion_entrega,total,costo_delivery,metodo_pago,creado_en,entregado_en,motivo_cancelacion').eq('motorizado_id',m.id).in('estado',['entregado','cancelado']).gte('creado_en',new Date(Date.now()-90*864e5).toISOString()).order('creado_en',{ascending:false}).limit(500);
    if(r.error){b.innerHTML='<p class="pdmmErr">'+E(r.error.message)+'</p>';return}
    const P=r.data||[];
    b.innerHTML='<div class="pdmmFil"><input id="pdmmHq" placeholder="Cliente, dirección o código" autocomplete="off"><input id="pdmmHd" type="date"></div><div id="pdmmHl"></div>';
    const pint=()=>{const q=($('pdmmHq').value||'').trim().toLowerCase(),d=$('pdmmHd').value;
      const L=P.filter(p=>(!d||diaLima(p.entregado_en||p.creado_en)===d)&&(!q||[ref(p.id),p.nombre_cliente,p.telefono_cliente,p.direccion_entrega].join(' ').toLowerCase().includes(q)));
      $('pdmmHl').innerHTML=L.length?L.slice(0,120).map(p=>'<div class="pdmmRow"><span><b>'+E(ref(p.id))+' · '+E(p.nombre_cliente||'Cliente')+'</b><small>'+E(fH(p.entregado_en||p.creado_en))+' · '+E(p.direccion_entrega||'')+(est(p)==='cancelado'?' · <em>Anulado'+(p.motivo_cancelacion?': '+E(p.motivo_cancelacion):'')+'</em>':'')+'</small></span><b>'+M(p.total)+'</b></div>').join('')+(L.length>120?'<p class="pdmmMut">Mostrando 120 de '+L.length+'. Filtra por fecha.</p>':''):'<p class="pdmmMut">No hay pedidos con ese filtro.</p>'};
    $('pdmmHq').oninput=pint;$('pdmmHd').onchange=pint;pint();
  }

  /* ---------- 5. Aviso de llegada ---------- */
  const avisados=new Set();
  function msgLlegada(o){const m=ME();return 'Hola'+(o.nombre_cliente?' '+String(o.nombre_cliente).split(' ')[0]:'')+', soy '+String(m&&m.nombre_completo||'tu motorizado').split(' ')[0]+' de *Pidemás Delivery*. 🛵 Estoy llegando con tu pedido '+ref(o.id)+'. Por favor ten listo'+(String(o.metodo_pago||'')==='efectivo'?' el pago y':'')+' tu teléfono a la mano.'}
  function botonLlegada(){
    const m=$('pidemasOrderFullModal');if(!m||!m.getClientRects().length)return;const id=String(m.dataset.orderId||'');const o=OR().find(x=>String(x.id)===id);const acts=m.querySelector('.pidemas-order-modal-actions');
    let b=m.querySelector('#pdmmLlego');const w=o&&tel(o.telefono_receptor||o.telefono_cliente);
    if(!o||!acts||!RECOGIDO.includes(est(o))||!w){if(b)b.remove();return}
    if(b&&b.dataset.id===id)return;if(b)b.remove();
    b=document.createElement('a');b.id='pdmmLlego';b.className='pdmmLlego';b.dataset.id=id;b.target='_blank';b.rel='noopener';b.textContent='Avisar al cliente que estoy llegando';b.href='https://wa.me/'+w+'?text='+encodeURIComponent(msgLlegada(o));b.onclick=()=>avisados.add(id);acts.prepend(b);
  }
  async function cerca(){
    const L=OR().filter(o=>RECOGIDO.includes(est(o))&&!avisados.has(String(o.id))&&pt(o.latitud_entrega,o.longitud_entrega)&&tel(o.telefono_receptor||o.telefono_cliente));if(!L.length)return;
    const yo=await leerPos();if(!yo)return;
    for(const o of L){const d=km(yo,pt(o.latitud_entrega,o.longitud_entrega));if(d!=null&&d<=0.3){avisados.add(String(o.id));
      let t=$('pdmmCerca');if(t)t.remove();t=document.createElement('div');t.id='pdmmCerca';t.className='pdmmCerca';
      t.innerHTML='<span><b>Estás cerca de '+E(o.nombre_cliente||'tu cliente')+'</b><small>'+Math.round(d*1000)+' m · '+E(ref(o.id))+'</small></span><a target="_blank" rel="noopener" href="https://wa.me/'+tel(o.telefono_receptor||o.telefono_cliente)+'?text='+encodeURIComponent(msgLlegada(o))+'">Avisar</a><button type="button" aria-label="Cerrar">×</button>';
      t.querySelector('button').onclick=()=>t.remove();t.querySelector('a').onclick=()=>setTimeout(()=>t.remove(),300);document.body.appendChild(t);
      try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(_){}break}}
  }

  /* ---------- 7. Recordatorio de cierre de caja ---------- */
  function cierreCaja(){
    const m=ME();if(!m||!m.horario_fin)return;const k='pidemas-moto-cierre-'+diaLima(Date.now());try{if(localStorage.getItem(k))return}catch(e){}
    const [h,mi]=String(m.horario_fin).split(':').map(Number);if(!Number.isFinite(h))return;
    const f=new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const ahora=(+f.find(x=>x.type==='hour').value%24)*60+(+f.find(x=>x.type==='minute').value);
    if(ahora<h*60+(mi||0)||ahora>h*60+(mi||0)+180)return;
    const txt=String(window.__pidemasMotoCashBalanceText||'').trim();const val=parseFloat(txt.replace(/[^\d.-]/g,''))||0;
    try{localStorage.setItem(k,'1')}catch(e){}
    if(val<=0)return;
    const b=hoja('Fin de tu turno','<p class="pdmmTx">Tu horario terminó. Antes de irte, entrega tu caja a administración.</p><div class="pdmmStat"><span>Saldo en caja</span><b>'+E(txt)+'</b></div><button type="button" class="btn" id="pdmmIrCaja">Ir a mi caja</button>');
    $('pdmmIrCaja').onclick=()=>{$('pdmmVelo')?.remove();document.querySelector('#nav [data-tab="cash"]')?.click()};
    try{navigator.vibrate&&navigator.vibrate([300,150,300])}catch(_){}
  }

  let n=0;
  setInterval(()=>{if(!ME()||!D())return;n++;try{tarjeta()}catch(e){}try{botonLlegada()}catch(e){}
    if(n%20===5)cerca().catch(()=>{});if(n%60===10)try{cierreCaja()}catch(e){}if(n===4||n%900===0)leerCal().then(tarjeta).catch(()=>{});
    if(n%30===15){const m=ME();D().from('motorizados').select('en_descanso,en_descanso_desde').eq('id',m.id).maybeSingle().then(r=>{if(r&&r.data){m.en_descanso=!!r.data.en_descanso;m.en_descanso_desde=r.data.en_descanso_desde}}).catch(()=>{})}
  },1000);
  window.pdMotoMej={ruta,rendimiento,calificaciones,historial,descanso};
})();
