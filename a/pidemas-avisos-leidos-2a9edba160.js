function pdUid(){try{return (typeof session!=='undefined'&&session&&session.user&&session.user.id)||null}catch(e){return null}}
function pdReadKey(){return 'pd_notif_leidas_'+(pdUid()||'x')}
function pdReadLocal(){try{return new Set(JSON.parse(localStorage.getItem(pdReadKey())||'[]'))}catch(e){return new Set()}}
function pdReadSave(set){try{localStorage.setItem(pdReadKey(),JSON.stringify(Array.from(set).slice(-300)))}catch(e){}}
function pdPaintZero(){['topNotifBadge','notifCount','navNotifBadge'].forEach(function(id){var e=document.getElementById(id);if(e){e.textContent='0';e.classList.remove('hasUnread')}})}
async function pdMarkAllRead(){
 var uid=pdUid(),d=(typeof db!=='undefined'?db:null);if(!uid||!d)return;
 var set=pdReadLocal();
 try{var r=await d.from('notificaciones').select('id').eq('usuario_id',uid).eq('leida',false);(r.data||[]).forEach(function(x){set.add(String(x.id))});pdReadSave(set)}catch(e){}
 pdPaintZero();
 try{await d.from('notificaciones').update({leida:true}).eq('usuario_id',uid).eq('leida',false)}catch(e){}
 if(typeof loadNotifications==='function'){try{await loadNotifications()}catch(e){}}
}
function pdMarkOneLocal(id){var set=pdReadLocal();set.add(String(id));pdReadSave(set);if(typeof loadNotifications==='function'){try{loadNotifications()}catch(e){}}}
(function(){
 function init(){
  var m=document.getElementById('notificationsModal');if(!m)return;var t=null;
  new MutationObserver(function(){
   if(m.classList.contains('open')){clearTimeout(t);t=setTimeout(function(){if(m.classList.contains('open'))pdMarkAllRead()},1800)}else{clearTimeout(t)}
  }).observe(m,{attributes:true,attributeFilter:['class']});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
