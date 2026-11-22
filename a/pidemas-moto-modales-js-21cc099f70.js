(function(){
  if(window.__pdMotoModales)return;window.__pdMotoModales=true;
  var TIT={cash:'Caja',wallet:'Mi billetera',profile:'Mi perfil'},ID={cash:'cashTab',wallet:'walletTab',profile:'profileTab'};
  var actual=null,orig=null;
  function $(i){return document.getElementById(i)}
  function fondo(){var b=$('pdmBg');if(!b){b=document.createElement('div');b.id='pdmBg';b.hidden=true;b.addEventListener('click',function(){cerrar()});document.body.appendChild(b)}return b}
  function abrir(k){
    if(actual===k)return;
    if(actual)cerrar(true);
    try{if(document.body.classList.contains('pdpm-open')){var px=document.querySelector('#pdpmOverlay .pdpm-x');if(px)px.click()}}catch(e){}
    try{var nm=$('notificationsModal');if(nm&&nm.classList.contains('open')&&typeof closeNotificationsModal==='function')closeNotificationsModal(true)}catch(e){}
    try{orig.call(window,k)}catch(e){}
    var home=$('homeTab');if(home)home.classList.remove('hidden');
    document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',b.dataset.tab==='home')});
    var tab=$(ID[k]);if(!tab)return;
    tab.classList.remove('hidden');tab.classList.add('pdmSheet');
    if(!tab.querySelector(':scope > .pdmTop')){
      var h=document.createElement('div');h.className='pdmTop';h.innerHTML='<b>'+TIT[k]+'</b><button type="button" aria-label="Cerrar">&times;</button>';
      var cb=h.querySelector('button');cb.addEventListener('click',function(){cerrar()});
      tab.insertBefore(h,tab.firstChild)}
    (function(){var rid=(k==='wallet')?'pdWalletRefresh':(k==='cash')?'pdcjmRefresh':'';if(!rid)return;var n=0;
      (function mover(){var h=tab.querySelector(':scope > .pdmTop'),rf=$(rid);if(!h)return;
        if(rf&&rf.parentNode!==h.querySelector('.pdmActs')){var g=h.querySelector('.pdmActs');
          if(!g){var cb=h.querySelector('button');g=document.createElement('div');g.className='pdmActs';h.appendChild(g);g.appendChild(cb)}
          g.insertBefore(rf,g.firstChild)}
        else if(!rf&&++n<20)setTimeout(mover,250)})()})();
    var nav=$('nav');if(nav)nav.classList.add('hidden');
    fondo().hidden=false;actual=k;document.body.classList.add('pdm-open');tab.scrollTop=0;
  }
  function cerrar(sinVolver){
    if(!actual)return;var k=actual;actual=null;
    document.body.classList.remove('pdm-open');var b=$('pdmBg');if(b)b.hidden=true;
    var nav=$('nav');if(nav)nav.classList.remove('hidden');
    var tab=$(ID[k]);if(tab){tab.classList.remove('pdmSheet');tab.classList.add('hidden')}
  }
  window.pdCerrarModalMoto=function(){cerrar()};
  function enganchar(){
    if(typeof window.switchTab!=='function'||window.switchTab.__pdm)return !!(window.switchTab&&window.switchTab.__pdm);
    orig=window.switchTab;
    var f=function(tab){if(ID[tab]){abrir(tab);return}if(actual)cerrar(true);return orig.apply(this,arguments)};f.__pdm=true;window.switchTab=f;return true;
  }
  if(!enganchar()){var n=0,t=setInterval(function(){if(enganchar()||++n>40)clearInterval(t)},250)}
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&actual)cerrar()});
})();
