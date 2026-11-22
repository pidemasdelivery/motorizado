window.PdSueldo=window.PdSueldo||(function(){
const BASE=25.625,GAS=8,GAS_CAP=24,HOURS=5,SBM=1230,DAY8=SBM/30;
const FIXED_FROM='2026-10-16',GAS_Q=12,DESC_FROM='2026-10-16';
const HOLIDAYS=new Set(['2026-01-01','2026-04-02','2026-04-03','2026-05-01','2026-06-07','2026-06-29','2026-07-23','2026-07-28','2026-07-29','2026-08-06','2026-08-30','2026-10-08','2026-11-01','2026-12-08','2026-12-09','2026-12-25',
'2027-01-01','2027-03-25','2027-03-26','2027-05-01','2027-06-07','2027-06-29','2027-07-23','2027-07-28','2027-07-29','2027-08-06','2027-08-30','2027-10-08','2027-11-01','2027-12-08','2027-12-09','2027-12-25']);
const KEYS=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const LABEL={domingo:'Domingo',lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>new Date(String(s).slice(0,10)+'T12:00:00');
const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
const r2=n=>Math.round(n*100)/100;
const rHalfDown=n=>Math.ceil(Math.round(n*1e6)/1e4-0.5)/100;
function limaNow(){
const p={};new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).forEach(x=>{if(x.type!=='literal')p[x.type]=x.value});
return new Date(+p.year,+p.month-1,+p.day,(+p.hour)%24,+p.minute,0);
}
const todayIso=()=>iso(limaNow());
function parseDays(raw){
let arr=raw;
if(typeof raw==='string'){try{arr=JSON.parse(raw)}catch(e){arr=raw.split(/[,;|]/)}}
return Array.isArray(arr)?arr.map(norm).filter(k=>KEYS.includes(k)):[];
}
function parseTimes(h){
const out=[...String(h||'').matchAll(/(\d{1,2}):(\d{2})\s*([ap])?\.?\s*m?\.?/gi)].map(m=>{let hh=+m[1];const ap=(m[3]||'').toLowerCase();if(ap==='p'&&hh<12)hh+=12;if(ap==='a'&&hh===12)hh=0;return hh*60+(+m[2])});
return out.length>=2?{start:out[0],end:out[1]}:null;
}
const fmtTime=min=>{const h=Math.floor(min/60),m=min%60;return (h%12||12)+(m?':'+pad(m):'')+' '+(h>=12?'p. m.':'a. m.')};
const atTime=min=>((Math.floor(min/60)%12||12)===1?'a la ':'a las ')+fmtTime(min);
function periodOf(dateIso){
const d=parse(dateIso),y=d.getFullYear(),m=d.getMonth(),first=d.getDate()<=15;
const s=new Date(y,m,first?1:16,12),e=new Date(y,m,first?15:new Date(y,m+1,0).getDate(),12);
return {start:iso(s),end:iso(e),key:iso(s)+'_'+iso(e),label:(first?'1.ª':'2.ª')+' quincena de '+s.toLocaleDateString('es-PE',{month:'long',year:'numeric'})};
}
const isHourly=m=>norm(m&&m.tipo_sueldo).replace(/\s+/g,'_')==='por_horas';
function hourly(h){h=Math.max(0,Number(h)||0);return {sueldo:r2(BASE*h/HOURS),gas:r2(GAS*h/HOURS),sunday:false}}
function shift(r){
const d=String(r.descripcion||'');
let h=Number(r.horas);if(!Number.isFinite(h)||r.horas==null){const m=d.match(/(\d+(?:[.,]\d+)?)\s*h\b/i);h=m?Number(m[1].replace(',','.')):0}
let g=Number(r.gasolina);if(!Number.isFinite(g)||r.gasolina==null){const m=d.match(/gasolina\s*S\/\s*(\d+(?:[.,]\d+)?)/i);g=m?Number(m[1].replace(',','.')):hourly(h,r.fecha).gas}
return {horas:h,sueldo:Number(r.monto||0),gas:g};
}
function config(m){
const hourlyMode=isHourly(m);
const hire=m&&m.fecha_ingreso?String(m.fecha_ingreso).slice(0,10):'';
const days=parseDays(m&&m.dias_laborables);
const times=parseTimes(m&&m.horario_trabajo);
const missing=[];
if(!hourlyMode){if(!hire)missing.push('fecha de ingreso');if(!times)missing.push('horario');if(!days.length)missing.push('días laborables')}
return {hire,days,times,hourly:hourlyMode,ok:!missing.length,missing};
}
function baseFor(m){
const t=parseTimes(m&&m.horario_trabajo);
if(!t)return BASE;
const h=t.end>t.start?(t.end-t.start)/60:HOURS;
return DAY8*Math.min(8,Math.max(0,h))/8;
}
function calc(m,rows,now){
now=now||limaNow();
const cfg=config(m);const BASE_D=baseFor(m);
const today=iso(now),nowMin=now.getHours()*60+now.getMinutes();
const cur=periodOf(today);
if(!cfg.ok)return {ok:false,cfg,current:{...cur,days:[],earned:0,paid:0,balance:0},periods:[],today};
const faltas=new Map(),pagos=[],jornadas=[],descs=[],adel=new Map();
(rows||[]).forEach(r=>{const t=norm(r.tipo),f=String(r.fecha||'').slice(0,10);if(t==='falta'&&f&&!faltas.has(f))faltas.set(f,r);else if(t==='pago')pagos.push(r);else if(t==='descuento')descs.push(r);else if(t==='jornada'&&f){if(/^d[ií]a adelantado/i.test(String(r.descripcion||''))){if(!adel.has(f))adel.set(f,r)}else jornadas.push(r)}});
const periods=new Map();const monthGas={};
const getP=k=>{if(!periods.has(k.key))periods.set(k.key,{...k,days:[],shifts:[],worked:0,rest:0,faltas:0,gasDays:0,gasAdj:0,adj:0,hours:0,gasTotal:0,earned:0,paid:0,payments:[],desc:0,descSet:false,descRows:[],needsDesc:k.start.slice(8,10)==='16'&&k.start>=DESC_FROM});return periods.get(k.key)};
getP(cur);
let endMin=null;
if(cfg.hourly){
jornadas.sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))).forEach(r=>{
const di=String(r.fecha).slice(0,10),P=getP(periodOf(di)),s=shift(r);
P.shifts.push({...s,date:di,row:r});P.worked++;P.hours+=s.horas;P.gasTotal+=s.gas;P.earned+=s.sueldo+s.gas;
});
}else{
endMin=cfg.times.end>cfg.times.start?cfg.times.end:24*60-1;
const startIso=periodOf(cfg.hire).start;
for(let d=parse(startIso);iso(d)<=cur.end;d.setDate(d.getDate()+1)){
const di=iso(d),P=getP(periodOf(di)),key=KEYS[d.getDay()],hol=HOLIDAYS.has(di);
const isWork=cfg.days.includes(key)&&!hol;
const isRest=!isWork&&(d.getDay()===0||hol);
const day={date:di,dow:key,label:LABEL[key],holiday:hol,work:isWork,rest:isRest,status:'',base:0,gas:0};
if(di<cfg.hire){day.status='antes';P.days.push(day);continue}
const passedN=di<today||(di===today&&nowMin>=endMin);const passed=passedN||(adel.has(di)&&di<=cur.end);if(passed&&!passedN){day.adel=adel.get(di)}
if(d.getDate()===31){day.status='dia31';P.days.push(day);continue}
const falta=faltas.get(di);
if(falta&&(isWork||isRest)){day.status='falta';day.falta=falta;if(passed)P.faltas++;}
else if(isWork||isRest){
if(!passed)day.status=di===today?'hoy':'futuro';
else if(isWork){
day.status='trabajado';day.base=BASE_D;P.worked++;
const mo=di.slice(0,7);monthGas[mo]=monthGas[mo]||0;
if(P.start>=FIXED_FROM?(d.getDay()!==0&&P.gasDays<GAS_Q):(d.getDay()!==0&&monthGas[mo]<GAS_CAP)){day.gas=GAS;monthGas[mo]++;P.gasDays++;}
}else{day.status='descanso';day.base=BASE_D;P.rest++;}
}else day.status='libre';
P.earned+=day.base+day.gas;P.days.push(day);
const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
if(d.getDate()===last&&last<30){
for(let n=last+1;n<=30;n++){
const vd=(d.getDay()+(n-last))%7;
const adj={date:di,adjDay:n,dow:KEYS[vd],label:'Día '+n,status:passed?'ajuste':'ajusteFuturo',base:0,gas:0,work:false,rest:false,sunday:vd===0};
if(passed){adj.base=BASE_D;adj.gas=vd===0||(P.start>=FIXED_FROM&&P.gasDays>=GAS_Q)?0:GAS;P.adj++;if(adj.gas)P.gasDays++;P.earned+=adj.base+adj.gas}
P.days.push(adj);
}
}
if(P.start>=FIXED_FROM&&P.start>=cfg.hire&&passed&&(d.getDate()===15||d.getDate()===Math.min(last,30))){
const unpaid=Math.max(0,15-(P.worked+P.rest+P.adj));
const target=Math.max(0,GAS_Q-unpaid),delta=target-P.gasDays;
if(delta){P.gasAdj=delta*GAS;P.earned+=P.gasAdj;P.gasDays=target}
}
}
}
const list=[...periods.values()];
pagos.forEach(r=>{const k=String(r.periodo||'');let P=periods.get(k);if(!P){const f=String(r.fecha||'').slice(0,10);P=f?getP(periodOf(f)):null}if(!P)P=periods.get(cur.key);if(P){P.paid+=Number(r.monto||0);P.payments.push(r)}});
descs.forEach(r=>{const k=String(r.periodo||'');let P=periods.get(k);if(!P){const f=String(r.fecha||'').slice(0,10);P=f?getP(periodOf(f)):null}if(!P)P=periods.get(cur.key);if(P){P.desc+=Number(r.monto||0);if(/AFP|ONP/i.test(String(r.descripcion||'')))P.descSet=true;P.descRows.push(r)}});
const all=[...periods.values()];
all.forEach(P=>{P.earned=P.start.slice(8,10)==='16'?rHalfDown(P.earned):r2(P.earned);P.hours=r2(P.hours);P.gasTotal=r2(P.gasTotal);P.desc=r2(P.desc);P.balance=r2(P.earned-P.desc-P.paid);P.isCurrent=P.key===cur.key});
all.sort((a,b)=>b.start.localeCompare(a.start));
const current=periods.get(cur.key);
const previousDue=all.filter(P=>!P.isCurrent&&P.balance>0.004).reduce((s,P)=>s+P.balance,0);
return {ok:true,cfg,hourly:cfg.hourly,endMin,endLabel:endMin!=null?fmtTime(endMin):'',endAt:endMin!=null?atTime(endMin):'',today,current,periods:all,previousDue:r2(previousDue)};
}
return {BASE,baseFor,SBM,DAY8,GAS,GAS_CAP,GAS_Q,FIXED_FROM,HOURS,KEYS,LABEL,calc,config,periodOf,limaNow,todayIso,parseTimes,fmtTime,atTime,iso,parse,hourly,shift,isHourly};
})();
