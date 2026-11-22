/* Hoja del código de entrega siempre al frente: capa superior (popover) o dentro del <dialog> modal abierto, y pegada al teclado */
(function(){
  if(window.__pdFixHoja)return;window.__pdFixHoja=1;
  var vv=window.visualViewport,SEL='#pdpeVelo,#pdmmVelo',busy=false;
  function host(){var d=null;try{d=document.querySelector('dialog:modal')}catch(e){}return d||document.body}
  function fit(){
    if(busy)return;var list=document.querySelectorAll(SEL);if(!list.length)return;busy=true;
    try{
      var h=vv?vv.height:window.innerHeight,top=vv?vv.offsetTop:0,H=host();
      list.forEach(function(v){
        if(v.parentElement!==H||(H===document.body&&v.nextElementSibling)){try{if(v.matches(':popover-open'))v.hidePopover()}catch(e){}H.appendChild(v)}
        if(!v.hasAttribute('popover'))v.setAttribute('popover','manual');
        try{if(!v.matches(':popover-open'))v.showPopover()}catch(e){}
        v.style.top=top+'px';v.style.height=h+'px';
        var c=v.querySelector('.pdsmHoja');if(c)c.style.maxHeight=Math.max(220,h-16)+'px';
        var i=v.querySelector('input:focus');if(i){try{i.scrollIntoView({block:'center'})}catch(e){}}
      });
    }finally{busy=false}
  }
  window.__pdFitHoja=fit;
  if(vv){vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit)}
  window.addEventListener('resize',fit);
  new MutationObserver(function(){fit();setTimeout(fit,100);setTimeout(fit,350)}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('focusin',function(e){if(e.target&&e.target.closest&&e.target.closest(SEL))setTimeout(fit,250)});
  setInterval(fit,700);
})();
