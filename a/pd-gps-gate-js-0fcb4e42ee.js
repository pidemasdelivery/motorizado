(function(){
 if(window.__pdGpsGate)return;window.__pdGpsGate=true;
 if(typeof window.PD_GPS_OBLIGATORIO==='undefined')window.PD_GPS_OBLIGATORIO=true;
 var since=null,box=null,lastCause='';
 function logged(){try{return typeof moto!=='undefined'&&moto&&moto.id}catch(e){return false}}
 function txt(){var e=document.getElementById('gpsStatusText');return e?String(e.textContent||''):''}
 function ok(){return /^GPS activo/i.test(txt())}
 function cause(){var t=txt();if(/denegad|bloquead|permiso gps/i.test(t))return 'denied';if(/no disponible|activa el gps/i.test(t))return 'off';if(/tiempo agotado/i.test(t))return 'timeout';if(/https/i.test(t))return 'https';return 'wait'}
 var STEPS={
  denied:['Toca el icono junto a la dirección web (candado o ajustes).','Entra a Permisos y elige Ubicación.','Marca Permitir.','Vuelve aquí y toca Activar GPS.'],
  off:['Desliza hacia abajo desde la parte de arriba de la pantalla.','Enciende Ubicación (GPS).','Vuelve aquí y toca Activar GPS.'],
  timeout:['Sal a un lugar abierto o acércate a una ventana.','Revisa que la Ubicación del teléfono esté en Alta precisión.','Toca Activar GPS.'],
  https:['Abre el panel desde su dirección oficial (https://).'],
  wait:['Si el teléfono te pregunta por la ubicación, toca Permitir.','Si no aparece nada, toca Activar GPS.']
 };
 var TITLE={denied:'Tienes bloqueado el permiso de ubicación',off:'La ubicación de tu teléfono está apagada',timeout:'No se pudo obtener tu ubicación',https:'El GPS necesita conexión segura',wait:'Tu GPS no está activo'};
 function build(){
  if(box)return box;
  box=document.createElement('div');box.id='pdGpsGate';box.setAttribute('role','alert');
  box.innerHTML='<p class="gt" id="pdGgT"></p><p class="gs">Sin GPS no podemos ubicarte ni asignarte pedidos.</p><div class="gb"><button type="button" class="pri" id="pdGgGo">Activar GPS</button><button type="button" id="pdGgHow">Cómo activarlo</button></div><ol id="pdGgSteps"></ol>';
  document.body.appendChild(box);
  box.querySelector('#pdGgGo').onclick=function(){
   if(cause()==='denied'){box.classList.add('steps');return}
   try{if(typeof startGPS==='function')startGPS()}catch(e){}
  };
  box.querySelector('#pdGgHow').onclick=function(){box.classList.toggle('steps')};
  return box;
 }
 function paint(){
  var c=cause();var b=build();
  if(c!==lastCause){lastCause=c;b.querySelector('#pdGgT').textContent=TITLE[c];b.querySelector('#pdGgSteps').innerHTML=STEPS[c].map(function(x){return '<li>'+x+'</li>'}).join('');if(c==='denied')b.classList.add('steps')}
 }
 function tick(){
  if(!logged()){since=null;if(box)box.classList.remove('show','steps');return}
  if(ok()){since=null;if(box)box.classList.remove('show','steps');lastCause='';return}
  if(since==null)since=Date.now();
  if(Date.now()-since>6000){paint();box.classList.add('show')}
 }
 setInterval(tick,2000);
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){since=Date.now()-5000;tick()}});
 try{if(navigator.permissions&&navigator.permissions.query)navigator.permissions.query({name:'geolocation'}).then(function(p){p.onchange=function(){if(p.state==='granted'&&logged()&&typeof startGPS==='function')startGPS()}}).catch(function(){})}catch(e){}
 

 document.addEventListener('click',function(e){
  if(!window.PD_GPS_OBLIGATORIO||!logged()||ok())return;
  var b=e.target.closest&&e.target.closest('.pd-accept-gate-button,button[onclick^="acceptOrder"]');
  if(!b)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  since=Date.now()-10000;paint();build().classList.add('show','steps');
  try{window.scrollTo({top:0,behavior:'smooth'})}catch(x){}
 },true);
})();
