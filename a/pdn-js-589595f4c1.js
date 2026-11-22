(function(){
  const $=id=>document.getElementById(id);
  const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'S/ '+(Number(n)||0).toFixed(2);
  const code=id=>'#'+String(id||'').slice(0,8).toUpperCase();
  const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

   
  const Snd={ctx:null,on:LS.get('pd_sound','on')!=='off',
    async ready(){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;if(!this.ctx)this.ctx=new C();if(this.ctx.state==='suspended')await this.ctx.resume();return this.ctx.state==='running'}catch(e){return false}},
    seq(notes,vol){const c=this.ctx;if(!c)return;const t0=c.currentTime+0.02;notes.forEach(([f,at,dur,type])=>{const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t0+at);g.gain.setValueAtTime(0.0001,t0+at);g.gain.exponentialRampToValueAtTime(vol||0.35,t0+at+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+at+dur);o.connect(g);g.connect(c.destination);o.start(t0+at);o.stop(t0+at+dur+0.05)})},
    PAT:{
      nuevo:{n:[[784,0,.16,'square'],[1047,.16,.16,'square'],[1319,.32,.26,'square'],[784,.75,.16,'square'],[1047,.91,.16,'square'],[1319,1.07,.32,'square']],v:.22,vib:[400,150,400,150,600]},
      cancel:{n:[[988,0,.22,'triangle'],[740,.24,.22,'triangle'],[494,.48,.45,'triangle']],v:.4,vib:[600,200,600]},
      cambio:{n:[[880,0,.14],[1175,.16,.24]],v:.35,vib:[200,100,200]},
      caja:{n:[[1568,0,.09,'triangle'],[2093,.1,.28,'triangle']],v:.35,vib:[120,60,120]},
      sueldo:{n:[[1047,0,.16],[1319,.17,.16],[1568,.34,.3]],v:.3,vib:[150,80,150]},
      info:{n:[[988,0,.25]],v:.3,vib:[150]}},
    async play(kind){
      const p=this.PAT[kind]||this.PAT.info;
      try{if(navigator.vibrate)navigator.vibrate(p.vib)}catch(e){}
      if(!this.on)return true;
      const ok=await this.ready();if(ok)this.seq(p.n,p.v);return ok;
    }};
  window.PdSound=Snd;
  

  ['click','touchend','keydown'].forEach(ev=>document.addEventListener(ev,()=>{Snd.ready().then(ok=>{if(ok){LS.set('pd_sound_ok','1');setTimeout(updateBanner,400)}})},{passive:true}));

   
  let swReg=null;
  if('serviceWorker' in navigator&&window.isSecureContext){
    navigator.serviceWorker.register('sw.js').then(r=>{swReg=r}).catch(()=>{});
    navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='pd-open'&&e.data.pedidoId)openOrder(e.data.pedidoId)});
  }
  async function osNotify(title,body,opt){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    if(document.visibilityState==='visible'&&document.hasFocus())return;
    const o=Object.assign({body,icon:undefined,tag:'pidemas-'+(opt.tag||Date.now()),renotify:true,vibrate:opt.vib||[200,100,200],requireInteraction:!!opt.sticky,data:{pedidoId:opt.pedidoId||null}},{});
    try{const r=swReg||(await navigator.serviceWorker?.getRegistration?.());if(r&&r.showNotification){await r.showNotification(title,o);return}}catch(e){}
    try{const n=new Notification(title,o);n.onclick=()=>{window.focus();if(opt.pedidoId)openOrder(opt.pedidoId);n.close()}}catch(e){}
  }

   
  const ICON={nuevo:'<i class="ti ti-receipt" aria-hidden="true"></i>',cancel:'<i class="ti ti-ban" aria-hidden="true"></i>',cambio:'<i class="ti ti-receipt" aria-hidden="true"></i>',caja:'<i class="ti ti-wallet" aria-hidden="true"></i>',sueldo:'<i class="ti ti-cash" aria-hidden="true"></i>',info:'<i class="ti ti-bell" aria-hidden="true"></i>'};
  const ringing=new Map();const baseTitle=document.title;let titleTimer=null;
  function flashTitle(on,txt){
    clearInterval(titleTimer);
    if(!on){document.title=baseTitle;return}
    let f=false;titleTimer=setInterval(()=>{f=!f;document.title=f?'• '+txt:baseTitle},1000);
  }
  function stopRing(key){const r=ringing.get(key);if(r){clearInterval(r);ringing.delete(key)}if(!ringing.size)flashTitle(false)}
  function dismiss(card){if(!card)return;stopRing(card.dataset.key);card.remove()}
  async function alertUser({kind,title,text,pedidoId,sticky,key,actions}){
    const box=$('pdAlerts');if(!box)return;
    key=key||kind+':'+(pedidoId||Date.now());
    box.querySelector(`[data-key="${CSS.escape(key)}"]`)?.remove();
    const card=document.createElement('div');
    card.className='pdA'+(kind==='nuevo'?' urgent':kind==='cancel'?' cancel':'');card.dataset.key=key;card.setAttribute('role','alert');
    const acts=actions||(pedidoId?[{label:'Ver pedido',main:true,run:()=>openOrder(pedidoId)}]:[]);
    card.innerHTML=`<span class="pdAIcon">${ICON[kind]||'<i class="ti ti-bell" aria-hidden="true"></i>'}</span><span class="pdATitle">${E(title)}</span><button type="button" class="pdAClose" aria-label="Cerrar">×</button><span class="pdAText">${E(text||'')}</span>${acts.length?`<div class="pdAActs">${acts.map((a,i)=>`<button type="button" data-i="${i}" class="${a.main?'main':''}">${E(a.label)}</button>`).join('')}</div>`:''}<span class="pdASound" hidden>Toca aquí para activar el sonido de los avisos.</span>`;
    card.querySelector('.pdAClose').onclick=e=>{e.stopPropagation();dismiss(card)};
    card.querySelectorAll('.pdAActs button').forEach(b=>b.onclick=async e=>{e.stopPropagation();const a=acts[+b.dataset.i];dismiss(card);try{await a.run()}catch(err){}});
    card.addEventListener('click',()=>{Snd.ready();card.querySelector('.pdASound').hidden=true});
    box.prepend(card);
    while(box.children.length>4)dismiss(box.lastElementChild);
    const ok=await Snd.play(kind);
    if(!ok&&Snd.on)card.querySelector('.pdASound').hidden=false;
    osNotify(title,text,{tag:key,pedidoId,sticky,vib:(Snd.PAT[kind]||Snd.PAT.info).vib});
    if(sticky){
      flashTitle(true,title);
      let n=0;const t=setInterval(()=>{if(!document.body.contains(card)||++n>15){stopRing(key);return}Snd.play(kind)},12000);
      ringing.set(key,t);
    }else setTimeout(()=>{if(document.body.contains(card))dismiss(card)},9000);
    logActivity({kind,title,text,pedidoId});
  }
  window.pdAlert=alertUser;
  

  function logActivity(a){
    try{const arr=JSON.parse(LS.get('pd_activity','[]'));arr.unshift({...a,at:new Date().toISOString()});LS.set('pd_activity',JSON.stringify(arr.slice(0,40)))}catch(e){}
  }

   
  async function openOrder(id){
    try{if(typeof switchTab==='function')switchTab('home')}catch(e){}
    try{const m=$('notificationsModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true')}}catch(e){}
    const find=()=>[...document.querySelectorAll('#orders .order-collapsible')].find(el=>String(el.dataset.orderId)===String(id));
    if(!find()&&typeof loadOrders==='function'){try{await loadOrders()}catch(e){}}
    const el=find();
    if(el){const d=el.querySelector('.orderDetails');if(typeof toggleOrderDetails==='function'&&(!d||d.classList.contains('hidden')))toggleOrderDetails(id);setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60)}
    ackOrder(id);
  }
  window.pdOpenOrder=openOrder;
  function ackOrder(id){document.querySelectorAll('#pdAlerts .pdA').forEach(c=>{if(c.dataset.key==='nuevo:'+id)dismiss(c)});stopRing('nuevo:'+id)}

   
  const RIDER_STATES=['aceptado','en_camino','en_entrega','entregado','camino_recojo','camino_entrega','pedido_recibido','confirmando_pago'];
  const FIELDS={direccion_entrega:'dirección de entrega',direccion_recojo:'dirección de recojo',referencia_entrega:'referencia',total:'monto',nombre_cliente:'cliente',telefono_cliente:'teléfono del cliente',telefono_receptor:'teléfono de quien recibe',tipo_servicio:'tipo de servicio'};
  const norm=v=>String(v??'').trim();
  const cleanObs=v=>{let t=norm(v);try{if(typeof cleanDeliveryTariffFromObservaciones==='function')t=cleanDeliveryTariffFromObservaciones(t)}catch(e){}return t.replace(/\b[A-Z][A-Z_]{5,}\b/g,'').replace(/servicio marcado como PAGADO/ig,'').replace(/[\s|·]+/g,' ').trim()};
  const snap=o=>{const s={estado:String(o.estado||'').toLowerCase(),obs:cleanObs(o.observaciones)};Object.keys(FIELDS).forEach(k=>s[k]=norm(o[k]));return s};
  const svc=o=>{const t=String(o.tipo_servicio||'pedido').toLowerCase();return t.includes('encomienda')?'Encomienda':t.includes('compra')?'Compra':t.includes('recojo')?'Recojo y entrega':'Pedido'};
  let prevOrders=null;
  function diffOrders(list){
    const cur=new Map((list||[]).map(o=>[String(o.id),o]));
    if(prevOrders===null){
      prevOrders=new Map([...cur].map(([k,o])=>[k,snap(o)]));
      const pend=(list||[]).filter(o=>String(o.estado).toLowerCase()==='asignado');
      if(pend.length)alertUser({kind:'nuevo',sticky:true,key:'nuevo:'+pend[0].id,pedidoId:pend[0].id,title:pend.length>1?`Tienes ${pend.length} pedidos por aceptar`:'Tienes un pedido por aceptar',text:describe(pend[0]),actions:acceptActions(pend[0])});
      return;
    }
    for(const [id,o] of cur){
      const now=snap(o),before=prevOrders.get(id);
      if(!before){
        if(['asignado','pendiente'].includes(now.estado))alertUser({kind:'nuevo',sticky:true,key:'nuevo:'+id,pedidoId:id,title:newTitle(o)+' '+code(id),text:describe(o),actions:acceptActions(o)});
        else alertUser({kind:'cambio',pedidoId:id,title:'Se te asignó el pedido '+code(id),text:describe(o)});
        continue;
      }
      if(now.estado!==before.estado){
        if(now.estado==='cancelado'){ackOrder(id);alertUser({kind:'cancel',pedidoId:id,title:'Pedido '+code(id)+' cancelado',text:'Administración canceló este pedido. No lo entregues.'+(o.direccion_entrega?' Entrega: '+o.direccion_entrega:'')});}
        else if(now.estado==='asignado')alertUser({kind:'nuevo',sticky:true,key:'nuevo:'+id,pedidoId:id,title:'Pedido '+code(id)+' asignado de nuevo',text:describe(o),actions:acceptActions(o)});
        else if(before.estado==='asignado')ackOrder(id);
        else if(!RIDER_STATES.includes(now.estado))alertUser({kind:'cambio',pedidoId:id,title:'Pedido '+code(id)+' cambió de estado',text:'Ahora: '+(typeof statusText==='function'?statusText(now.estado):now.estado)});
      }
      const changes=Object.keys(FIELDS).filter(k=>now[k]!==before[k]&&(before[k]||now[k]));
      if(now.obs!==before.obs&&now.obs)changes.push('obs');
      if(changes.length&&now.estado!=='cancelado'&&now.estado!=='entregado'&&!(window.pdEsPropio&&window.pdEsPropio(id))){
        const parts=changes.slice(0,3).map(k=>k==='obs'?'nuevas indicaciones: «'+((a,b)=>{const L=v=>String(v||'').replace(/(Ubicación(?: de (?:recojo|entrega))?:\s*)?https?:\/\/\S+/gi,' ').replace(/\s+/g,' ').trim();const A=L(a),B=L(b);let n=B.startsWith(A)?B.slice(A.length):B;n=n.trim();return n||'ubicación actualizada'})(before.obs,now.obs).slice(0,110)+'»':k==='total'?'monto '+money(before.total)+' → '+money(now.total):'nueva '+FIELDS[k]+': '+(now[k]||'—'));
        alertUser({kind:'cambio',pedidoId:id,key:'cambio:'+id,title:'Pedido '+code(id)+' modificado por administración',text:parts.join(' · ')+(changes.length>3?' · y '+(changes.length-3)+' cambio(s) más':'')});
      }
    }
    for(const [id,before] of prevOrders){
      if(!cur.has(id)&&!['entregado','cancelado'].includes(before.estado)){ackOrder(id);alertUser({kind:'cancel',title:'Pedido '+code(id)+' retirado de tu lista',text:'Administración lo reasignó o lo eliminó. Ya no está a tu cargo.'+(before.direccion_entrega?' Entrega: '+before.direccion_entrega:'')});}
    }
    prevOrders=new Map([...cur].map(([k,o])=>[k,snap(o)]));
  }
  function newTitle(o){const k=svc(o);return k==='Compra'?'Nueva compra asignada':k==='Encomienda'?'Nueva encomienda asignada':k==='Recojo y entrega'?'Nuevo recojo y entrega':'Nuevo pedido asignado'}
  function describe(o){
    const from=o.direccion_recojo||o.direccion_negocio||'',to=o.direccion_entrega||'';
    const tot=Number(o.total);
    return [from?'Recojo: '+from:'',to?'Entrega: '+to:'',Number.isFinite(tot)&&tot>0?money(tot)+(o.metodo_pago?' · '+o.metodo_pago:''):''].filter(Boolean).join(' · ')||svc(o);
  }
  function acceptActions(o){
    const acts=[{label:'Ver pedido',run:()=>openOrder(o.id)}];
    if(typeof window.acceptOrder==='function')acts.push({label:'Aceptar',main:true,run:async()=>{ackOrder(o.id);await window.acceptOrder(o.id)}});
    else acts[0].main=true;
    return acts;
  }
  if(typeof window.loadOrders==='function'){
    const _lo=window.loadOrders;
    window.loadOrders=async function(){const out=await _lo.apply(this,arguments);try{if(typeof moto!=='undefined'&&moto)diffOrders(orders)}catch(e){console.warn('Avisos pedidos',e)}return out};
  }
  

  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[onclick*="acceptOrder"]');if(b){const m=String(b.getAttribute('onclick')).match(/acceptOrder\('([^']+)'/);if(m)ackOrder(m[1])}},true);

   
  let prevCash=null;
  document.addEventListener('pd:caja',e=>{
    const list=e.detail||[];const ids=new Map(list.map(m=>[String(m.id),m]));
    if(prevCash===null){prevCash=ids;return}
    for(const [id,m] of ids){
      if(prevCash.has(id))continue;
      const d=String(m.descripcion||'');const amt=Number(m.monto||0);
      if(/^INGRESO DE ADMINISTRADOR/i.test(d))alertUser({kind:'caja',title:'Administración te dio '+money(amt),text:d.replace(/^INGRESO DE ADMINISTRADOR\s*[·:]?\s*/i,'')||'Efectivo agregado a tu caja.'});
      else if(/LIQUIDACI[ÓO]N DE CAJA/i.test(d))alertUser({kind:'caja',title:'Caja recibida: '+money(amt),text:'Administración recibió tu caja completa. Empiezas una caja nueva en S/ 0.00.'});
      else if(/^ENTREGA PARCIAL DE CAJA/i.test(d))alertUser({kind:'caja',title:'Entrega parcial registrada: '+money(amt),text:'Administración registró que le entregaste parte de tu caja.'});
      else if(/REINICIO DE CAJA/i.test(d))alertUser({kind:'caja',title:'Tu caja fue reiniciada',text:'Administración inició una caja nueva.'});
    }
    for(const [id,m] of prevCash){if(!ids.has(id))alertUser({kind:'cambio',title:'Se corrigió un movimiento de tu caja',text:'Administración borró: '+(String(m.descripcion||'movimiento').replace(/^(INGRESO DE ADMINISTRADOR|INGRESO MANUAL DE CAJA)\s*[·:]?\s*/i,''))+' ('+money(m.monto)+').'})}
    prevCash=ids;
  });

   
  let prevSal=null;
  document.addEventListener('pd:sueldo',e=>{
    const list=e.detail||[];const ids=new Map(list.map(r=>[String(r.id),r]));
    if(prevSal===null){prevSal=ids;return}
    const fd=f=>new Date(String(f).slice(0,10)+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
    for(const [id,r] of ids){if(prevSal.has(id))continue;const t=String(r.tipo||'').toLowerCase();
      if(t==='pago')alertUser({kind:'sueldo',title:'Pago de sueldo registrado: '+money(r.monto),text:r.descripcion||'Revisa tu Billetera.'});
      else if(t==='jornada'){const s=window.PdSueldo?window.PdSueldo.shift(r):{horas:'',sueldo:Number(r.monto||0),gas:0};alertUser({kind:'sueldo',title:'Jornada registrada: '+fd(r.fecha),text:s.horas+' h · '+money(s.sueldo+s.gas)+' (incluye gasolina '+money(s.gas)+')'})}
      else if(t==='falta')alertUser({kind:'cambio',title:'Se registró una falta el '+fd(r.fecha),text:(r.descripcion&&r.descripcion!=='Falta'?r.descripcion+' · ':'')+'Ese día no se suma a tu sueldo.'});}
    for(const [id,r] of prevSal){if(ids.has(id))continue;const t=String(r.tipo||'').toLowerCase();
      if(t==='falta')alertUser({kind:'sueldo',title:'Se quitó la falta del '+fd(r.fecha),text:'Ese día vuelve a sumarse a tu sueldo.'});
      else if(t==='pago')alertUser({kind:'cambio',title:'Se anuló un pago de sueldo',text:money(r.monto)+' · revisa tu Billetera.'});}
    prevSal=ids;
  });

   
  let lastNotif=LS.get('pd_last_notif','');let checking=false;
  async function checkNotifs(){
    if(checking||typeof session==='undefined'||!session?.user?.id||typeof db==='undefined')return;checking=true;
    try{
      const {data}=await db.from('notificaciones').select('id,titulo,mensaje,pedido_id,creado_en,leida').eq('usuario_id',session.user.id).order('creado_en',{ascending:false}).limit(5);
      const list=data||[];
      if(!lastNotif){lastNotif=list[0]?String(list[0].creado_en):'0';LS.set('pd_last_notif',lastNotif);return}
      const fresh=list.filter(n=>String(n.creado_en)>lastNotif).reverse();
      for(const n of fresh){
        

        const dup=n.pedido_id&&document.querySelector(`#pdAlerts [data-key$=":${CSS.escape(String(n.pedido_id))}"]`);
        if(!dup)alertUser({kind:/cancel/i.test(n.titulo+n.mensaje)?'cancel':'info',pedidoId:n.pedido_id||null,title:n.titulo||'Aviso de Pidemás',text:n.mensaje||''});
      }
      if(list[0]){lastNotif=String(list[0].creado_en);LS.set('pd_last_notif',lastNotif)}
    }catch(e){}finally{checking=false}
  }
  

  window.notifyNewEvent=function(){setTimeout(()=>{try{loadOrders()}catch(e){}checkNotifs()},400)};
  setInterval(checkNotifs,15000);

   
  function updateBanner(){
    const b=$('pdnBanner');if(!b)return;
    const needPerm='Notification' in window&&Notification.permission==='default';
    const granted='Notification' in window&&Notification.permission==='granted';
    const locked=Snd.on&&(!Snd.ctx||Snd.ctx.state!=='running')&&LS.get('pd_sound_ok','')!=='1'&&!granted;
    if(needPerm){b.hidden=false;b.querySelector('span').textContent='Activa los avisos para enterarte de cada pedido aunque tengas el teléfono bloqueado.';b.querySelector('button').textContent='Activar avisos'}
    else if(locked){b.hidden=false;b.querySelector('span').textContent='Toca para activar el sonido de los pedidos nuevos.';b.querySelector('button').textContent='Activar sonido'}
    else b.hidden=true;
  }
  function buildBanner(){
    const head=$('gpsStatus')?.parentElement;if(!head||$('pdnBanner'))return;
    head.insertAdjacentHTML('beforeend','<div id="pdnBanner" hidden><span></span><button type="button"></button></div>');
    $('pdnBanner').querySelector('button').onclick=async()=>{
      await Snd.ready();LS.set('pd_sound_ok','1');
      if('Notification' in window&&Notification.permission==='default'){try{await Notification.requestPermission()}catch(e){}}
      Snd.play('info');updateBanner();
    };
    updateBanner();
  }

   
  function groupOrders(){
    const box=$('orders');if(!box)return;
    const cards=[...box.querySelectorAll(':scope>.order-collapsible')];
    if(!cards.length){
      if(box.querySelector('.notice')&&/no tienes pedidos/i.test(box.textContent))box.innerHTML='<div class="pdEmptyOrders"><b>Sin pedidos por ahora</b>Cuando te asignen uno, sonará y aparecerá aquí.</div>';
      return;
    }
    const st=id=>String((orders.find(o=>String(o.id)===String(id))||{}).estado||'').toLowerCase();
    const today=new Date().toLocaleDateString('en-CA');
    const g={nuevo:[],curso:[],done:[],cancel:[]};
    cards.forEach(c=>{const s=st(c.dataset.orderId);if(s==='asignado'||s==='pendiente')g.nuevo.push(c);else if(s==='entregado')g.done.push(c);else if(s==='cancelado')g.cancel.push(c);else g.curso.push(c)});
    const frag=document.createDocumentFragment();
    const head=(t,n,u)=>{const h=document.createElement('div');h.className='pdGroupHead'+(u?' urgent':'');h.innerHTML=`${E(t)} <b>${n}</b>`;return h};
    if(g.nuevo.length){frag.appendChild(head('Por aceptar',g.nuevo.length,true));g.nuevo.forEach(c=>frag.appendChild(c))}
    if(g.curso.length){frag.appendChild(head('En curso',g.curso.length));g.curso.forEach(c=>frag.appendChild(c))}
    if(!g.nuevo.length&&!g.curso.length){const e=document.createElement('div');e.className='pdEmptyOrders';e.innerHTML='<b>Sin pedidos por ahora</b>Cuando te asignen uno, sonará y aparecerá aquí.';frag.appendChild(e)}
    

    const OPEN=window.__pdGroupOpen=window.__pdGroupOpen||new Set();
    const mk=(t,arr,open)=>{if(!arr.length)return;const d=document.createElement('details');d.className='pdDone';d.dataset.k=t;if(open)d.open=true;d.innerHTML=`<summary>${E(t)} (${arr.length})</summary>`;arr.forEach(c=>d.appendChild(c));d.addEventListener('toggle',()=>{if(d.open)OPEN.add(t);else OPEN.delete(t)});frag.appendChild(d)};
    const wasOpen=k=>OPEN.has(k)||!!box.querySelector(`details.pdDone[data-k="${k}"][open]`);
    mk('Entregados',g.done,wasOpen('Entregados'));mk('Cancelados',g.cancel,wasOpen('Cancelados'));
    box.innerHTML='';box.appendChild(frag);
  }
  if(typeof window.renderOrders==='function'){
    const _ro=window.renderOrders;
    window.renderOrders=function(){const out=_ro.apply(this,arguments);try{groupOrders()}catch(e){console.warn('Agrupar pedidos',e)}return out};
  }

   
  const CAT_ICON={pedidos:'<i class="ti ti-receipt" aria-hidden="true"></i>',caja:'<i class="ti ti-wallet" aria-hidden="true"></i>',sistema:'<i class="ti ti-bell" aria-hidden="true"></i>'};
  
  const SRV_ICON={recojo:'<i class="ti ti-arrows-exchange" aria-hidden="true"></i>',compra:'<i class="ti ti-shopping-cart" aria-hidden="true"></i>',encomienda:'<i class="ti ti-package" aria-hidden="true"></i>'};
  function pdnIcon(n){const t=(String(n.title||'')+' '+String(n.message||'')).toLowerCase();if(/recojo\s+y\s+entrega/.test(t))return SRV_ICON.recojo;if(/servicio de compra/.test(t))return SRV_ICON.compra;if(/encomienda/.test(t))return SRV_ICON.encomienda;return CAT_ICON[n.category]||'<i class="ti ti-bell" aria-hidden="true"></i>'}
  const ago=d=>{const t=new Date(d).getTime();if(!t)return '';const m=Math.round((Date.now()-t)/60000);if(m<1)return 'ahora';if(m<60)return 'hace '+m+' min';const h=Math.round(m/60);if(h<24)return 'hace '+h+' h';return new Date(t).toLocaleDateString('es-PE',{day:'2-digit',month:'short'})};
  if(typeof window.renderNotifications==='function'){
    window.renderNotifications=function(items){
      const box=$('notifications');if(!box)return;
      const f=typeof activeNotificationFilter!=='undefined'?activeNotificationFilter:'todos';
      const list=f==='todos'?items:items.filter(n=>n.category===f);
      if(!list.length){box.innerHTML='<div class="notice">No hay avisos en esta categoría.</div>';return}
      const lim=typeof notificationVisibleLimit!=='undefined'?notificationVisibleLimit:10;
      box.innerHTML=list.slice(0,lim).map(n=>`<article class="pdnItem notifItem ${E(n.category)} ${n.unread?'unread':''}${n.pedidoId?' notifHasOrder':''}" ${n.pedidoId?`data-pedido-id="${E(n.pedidoId)}" data-notif-id="${E(n.notifId||'')}" role="button" tabindex="0"`:''}><span class="pdnIco">${pdnIcon(n)}</span><div class="pdnTop"><strong>${E((window.pdTxt||String)(n.title))}</strong><time>${E(ago(n.createdAt))}</time></div><div class="pdnMsg">${E((window.pdTxt||String)(n.message))}</div>${n.pedidoId?`<button type="button" class="notifOpenOrder">Ver pedido ${E(code(n.pedidoId))}</button>`:''}</article>`).join('')+(list.length>lim?`<button type="button" id="showMoreNotifications" style="width:100%;min-height:44px;margin:10px 0;border:1px dashed var(--fr-line);border-radius:12px;background:#fff;color:var(--fr-ink);font-weight:700">Ver más (${list.length-lim})</button>`:'');
      const more=$('showMoreNotifications');if(more)more.onclick=()=>{try{notificationVisibleLimit+=10}catch(e){}window.renderNotifications(items)};
    };
  }
  function buildSettings(){
    const tools=document.querySelector('#notificationsModal .notifTools');if(!tools||$('pdnSettings'))return;
    tools.insertAdjacentHTML('afterend','<div class="pdnSettings" id="pdnSettings"><button type="button" id="pdnSoundToggle"></button><button type="button" id="pdnTest">Probar sonido</button></div>');
    const paint=()=>{$('pdnSoundToggle').textContent=Snd.on?'Sonido activado':'Sonido apagado';$('pdnSoundToggle').classList.toggle('on',Snd.on);
    };
    $('pdnSoundToggle').onclick=()=>{Snd.on=!Snd.on;LS.set('pd_sound',Snd.on?'on':'off');paint();if(Snd.on)Snd.play('info')};
    $('pdnTest').onclick=async()=>{await Snd.ready();await Snd.play('nuevo')};
    paint();
  }

   
  function boot(){
    buildBanner();buildSettings();
    const nav=document.querySelector('#nav [data-tab="home"] .navLabel');if(nav)nav.textContent='Inicio';
    const ordersCard=$('orders')?.closest('.card');
    if(ordersCard&&!ordersCard.querySelector('.pdOrdersHead')){const h=ordersCard.querySelector('h2'),r=$('refresh');if(h&&r){const w=document.createElement('div');w.className='pdOrdersHead';h.before(w);w.append(h,r);h.textContent='Mis pedidos';r.setAttribute('aria-label','Actualizar pedidos')}}
    const w=$('welcome');if(w&&typeof moto!=='undefined'&&moto&&moto.nombre_completo)w.textContent='Hola, '+String(moto.nombre_completo).trim().split(/\s+/)[0];
    try{groupOrders()}catch(e){}
    const q=new URLSearchParams(location.search).get('pedido');if(q)setTimeout(()=>openOrder(q),1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  

  setInterval(()=>{const w=$('welcome');if(w&&typeof moto!=='undefined'&&moto&&moto.nombre_completo&&!/^Hola,/.test(w.textContent))w.textContent='Hola, '+String(moto.nombre_completo).trim().split(/\s+/)[0];updateBanner()},3000);
})();
