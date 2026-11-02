
const PUSH_VAPID_PUBLIC='BBZlKacKv54II_CyjsjImbYcA9mfPK3WEut18aAISsy7HanNtUftmVx_2KsG_r5EwipNUZh_G0gF4BbZDj5RwQY';
function pushKey(s){const b=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function enablePontoNotifications(){
 if(!session?.access_token||!account?.enabled)throw Error('Entre na sua conta para ativar os avisos.');
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Este navegador não oferece notificações push.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('Permissão de notificações não concedida.');
 const reg=await navigator.serviceWorker.ready;
 const subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKey(PUSH_VAPID_PUBLIC)});
 const json=subscription.toJSON();
 await api('/rest/v1/employee_clock_push_subscriptions?on_conflict=endpoint','POST',{user_id:session.user.id,endpoint:subscription.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth,enabled:true});
 localStorage.setItem('ponto-push-enabled','1');
 return true;
}
async function renderPontoNotificationButton(){
 const parent=document.querySelector('.secondary-actions');if(!parent||!session?.access_token)return;
 const button=document.createElement('button');button.type='button';button.id='push-opt-in';button.textContent='🔔 Ativar lembretes de ponto';parent.after(button);
 try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub&&Notification.permission==='granted'){button.textContent='🔔 Lembretes ativados';button.disabled=true}}catch{}
 button.onclick=async()=>{button.disabled=true;try{await enablePontoNotifications();button.textContent='🔔 Lembretes ativados'}catch(e){button.disabled=false;alert(e.message)}};
}

const U='https://ogmtzxotpukddzowhqwl.supabase.co';const K='sb_publishable_vkhFOCSIvSbWifFCy6DjIg_9QJeYd38';let session=null,account=null;const el=id=>document.getElementById(id);const labels={entry:'Entrada',lunch_out:'Saída para almoço',lunch_in:'Retorno do almoço',exit:'Saída'};const kinds=Object.keys(labels);const day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));async function api(path,method='GET',data){const r=await fetch(U+path,{method,headers:{apikey:K,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},...(data?{body:JSON.stringify(data)}:{})});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.msg||d.message||d.error_description||'Falha HTTP '+r.status)}return r.status===204?null:r.text().then(t=>t?JSON.parse(t):null)}function message(t){el('message').textContent=t}const SESSION_KEY='ponto-digital-session-v1';
function saveSession(value){if(value?.refresh_token){localStorage.setItem(SESSION_KEY,JSON.stringify({refresh_token:value.refresh_token}));}}
function clearSession(){localStorage.removeItem(SESSION_KEY);session=null;account=null;}

// Fila offline por colaborador: IDs fixos permitem reenvio idempotente.
const OFFLINE_KEY='ponto-digital-offline-v1',ACCOUNT_KEY='ponto-digital-account-v1',EVENTS_KEY='ponto-digital-events-v1';
const getJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
const offlineQueue=()=>getJson(OFFLINE_KEY,[]);
const saveQueue=q=>localStorage.setItem(OFFLINE_KEY,JSON.stringify(q));
const cachedEvents=()=>getJson(EVENTS_KEY,[]);
const cacheAccount=()=>{if(account&&session?.user?.id)localStorage.setItem(ACCOUNT_KEY,JSON.stringify({user_id:session.user.id,account}))};
let syncing=false;
async function syncPending(){if(syncing||!navigator.onLine||!session?.access_token||!account)return;syncing=true;try{const pending=offlineQueue();for(const record of pending){if(record.user_id!==session.user.id||record.employment_contract_id!==account.employment_contract_id)continue;try{await api('/rest/v1/employee_clock_events?on_conflict=id','POST',record);saveQueue(offlineQueue().filter(item=>item.id!==record.id));localStorage.removeItem('ponto-last-sync-error')}catch(error){if(/409|duplicate|already exists/i.test(error.message)){const existing=await api('/rest/v1/employee_clock_events?select=id&id=eq.'+encodeURIComponent(record.id)).catch(()=>[]);if(existing.length){saveQueue(offlineQueue().filter(item=>item.id!==record.id));continue}}console.warn('Ponto offline aguardando sincronização:',error);localStorage.setItem('ponto-last-sync-error',String(error.message||error));break}}}finally{syncing=false}}
function offlineAccount(){const cached=getJson(ACCOUNT_KEY,null);if(!cached?.account?.enabled)return false;account=cached.account;session={user:{id:cached.user_id},access_token:null};return true}
window.addEventListener('online',()=>{void (async()=>{if(!session?.access_token){await restoreSession();return}await syncPending();if(account)await home()})().catch(console.warn)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine&&session?.access_token)void syncPending()});
async function loadAccount(){const a=await api('/rest/v1/employee_clock_accounts?select=*&user_id=eq.'+encodeURIComponent(session.user.id));if(a.length!==1||!a[0].enabled)throw Error('Conta ainda não habilitada pelo RH');account=a[0];try{const name=await api('/rest/v1/rpc/ponto_digital_my_name','POST',{});if(typeof name==='string'&&name.trim())account.full_name=name.trim()}catch(error){console.warn('Nome do colaborador indisponível:',error)}cacheAccount();}
async function restoreSession(){let stored;try{stored=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{clearSession();return}if(!stored?.refresh_token)return;try{session=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:stored.refresh_token});saveSession(session);await loadAccount();await syncPending();await home()}catch(err){if(/401|403|invalid|expired|revoked|refresh.token|Conta ainda não habilitada/i.test(err.message)){clearSession()}else if(offlineAccount()){await home();message('Modo offline: as marcações serão sincronizadas quando houver internet.')}else{session=null;account=null;message('Conecte-se à internet ao menos uma vez para ativar o modo offline.')}}}
async function applyClockCorrections(records){
 const cacheKey='ponto-digital-adjustments-'+(session?.user?.id||'offline');
 let adjustments=getJson(cacheKey,[]);
 if(navigator.onLine&&session?.access_token){
  try{adjustments=await api('/rest/v1/rpc/ponto_digital_my_adjustments','POST',{});localStorage.setItem(cacheKey,JSON.stringify(adjustments))}
  catch(error){console.warn('Correções do RH indisponíveis:',error)}
 }
 const cancelKey='ponto-digital-cancellations-'+(session?.user?.id||'offline');
 let cancellations=getJson(cancelKey,[]);
 if(navigator.onLine&&session?.access_token){
  try{cancellations=await api('/rest/v1/rpc/ponto_digital_my_cancellations_v2','POST',{});localStorage.setItem(cancelKey,JSON.stringify(cancellations))}
  catch(error){console.warn('Cancelamentos do RH indisponíveis:',error)}
 }
 // Uma exclusão do RH cancela apenas as batidas anteriores à exclusão.
 // Novas marcações posteriores devem aparecer e ser aceitas normalmente.
 records=records.filter(record=>record.pending_sync||!cancellations.some(c=>
  c.attendance_date===day(record.captured_at)&&
  (c.punch_kind==='all'||c.punch_kind===record.punch_kind)&&
  !!c.cancelled_at&&new Date(record.captured_at).getTime()<=new Date(c.cancelled_at).getTime()
 ));
 const corrections=new Map(adjustments.map(a=>[a.attendance_date+'|'+a.punch_kind,a.corrected_time]));
 const updated=records.map(record=>{
  const localDate=day(record.captured_at);
  const corrected=corrections.get(localDate+'|'+record.punch_kind);
  if(!corrected||record.pending_sync)return record;
  const hhmm=String(corrected).slice(0,5);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))return record;
  return {...record,original_captured_at:record.captured_at,captured_at:localDate+'T'+hhmm+':00-03:00',corrected_by_hr:true};
 });
 // Uma marcação esquecida aprovada não possui evento bruto: exibir registro virtual
 // sem gravar batida fictícia no histórico imutável.
 for(const adjustment of adjustments){
  const date=adjustment.attendance_date,kind=adjustment.punch_kind;
  const hhmm=String(adjustment.corrected_time||'').slice(0,5);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!kinds.includes(kind)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm))continue;
  if(updated.some(record=>day(record.captured_at)===date&&record.punch_kind===kind))continue;
  if(cancellations.some(c=>c.attendance_date===date&&(c.punch_kind==='all'||c.punch_kind===kind)))continue;
  updated.push({id:'rh-adjustment-'+date+'-'+kind,employment_contract_id:account.employment_contract_id,punch_kind:kind,captured_at:date+'T'+hhmm+':00-03:00',corrected_by_hr:true,approved_adjustment:true});
 }
 return updated.sort((a,b)=>new Date(b.captured_at).getTime()-new Date(a.captured_at).getTime());
}
async function events(){let remote=cachedEvents();if(navigator.onLine&&session?.access_token){try{remote=await api('/rest/v1/employee_clock_events?select=*&employment_contract_id=eq.'+account.employment_contract_id+'&order=captured_at.desc&limit=100');localStorage.setItem(EVENTS_KEY,JSON.stringify(remote))}catch(error){console.warn('Histórico offline:',error)}}const pending=offlineQueue().filter(v=>v.user_id===session?.user?.id&&v.employment_contract_id===account.employment_contract_id);return applyClockCorrections([...pending.map(v=>({...v,pending_sync:true})),...remote.filter(v=>!pending.some(p=>p.id===v.id))])}async function home(){
 const all=await events();
 const today=day(new Date().toISOString());
 if(navigator.onLine&&session?.access_token)await syncPending();
 let mySchedule=null;
 try{
  const schedules=await api('/rest/v1/employee_work_schedules?select=effective_on,weekdays,tolerance_minutes&employment_contract_id=eq.'+encodeURIComponent(account.employment_contract_id)+'&effective_on=lte.'+today+'&order=effective_on.desc&limit=1');
  mySchedule=schedules?.[0]??null;
 }catch(error){console.warn('Jornada não disponível para consulta:',error);}
 const weekday=(new Date(today+'T12:00:00Z').getUTCDay()+6)%7;
 const planned=mySchedule?.weekdays?.[weekday];
 const plannedText=planned?(planned.active?'Horário previsto: '+planned.entry+'–'+planned.lunchOut+' / '+planned.lunchIn+'–'+planned.exit:'Folga prevista'):'Jornada prevista não cadastrada';
 const current=all.filter(x=>day(x.captured_at)===today);
 const next=kinds.find(k=>!current.some(x=>x.punch_kind===k));
 const formatMinutes=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')+' h';
 const duration=items=>{const m=new Map(items.map(v=>[v.punch_kind,v]));if(!m.has('entry')||!m.has('exit'))return null;let n=(new Date(m.get('exit').captured_at)-new Date(m.get('entry').captured_at))/60000;if(m.has('lunch_out')&&m.has('lunch_in'))n-=(new Date(m.get('lunch_in').captured_at)-new Date(m.get('lunch_out').captured_at))/60000;return n>=0?Math.floor(n):null};
 const month=day(new Date().toISOString()).slice(0,7);
 const previous=new Date(month+'-01T12:00:00Z');previous.setUTCMonth(previous.getUTCMonth()-1);
 const previousMonth=previous.toISOString().slice(0,7);
 const byDate=new Map();for(const v of all){const d=day(v.captured_at);if(!byDate.has(d))byDate.set(d,[]);byDate.get(d).push(v)}
 const monthData=[...byDate].filter(([d])=>d.startsWith(month));
 const completed=monthData.map(([,items])=>duration(items)).filter(n=>n!==null);
 const worked=completed.reduce((a,b)=>a+b,0);
 const recentDays=[...byDate.entries()].sort(([a],[b])=>b.localeCompare(a)).slice(0,4);
 const timeShort=v=>new Date(v.captured_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
 const escapeText=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const preview=recentDays.map(([date,items])=>{const byKind=new Map(items.map(v=>[v.punch_kind,v]));const mins=duration(items);const dateLabel=new Date(date+'T12:00:00-03:00');const label=new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'America/Sao_Paulo'}).format(dateLabel).replace('.','');
 const lines=[['entry','Entrada'],['lunch_out','Almoço'],['lunch_in','Retorno'],['exit','Saída']].map(([k,l])=>'<span class="clock-recent-line"><span>'+l+'</span><strong>'+(byKind.has(k)?timeShort(byKind.get(k)):'—')+'</strong></span>').join('');
 return '<article class="clock-recent-day"><div class="clock-recent-date"><strong>'+date.slice(8)+'</strong><span>'+new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'America/Sao_Paulo'}).format(dateLabel).replace('.','')+'</span><small>'+escapeText(label)+'</small></div><div class="clock-recent-times">'+lines+'</div><div class="clock-recent-state '+(mins===null?'incomplete':'')+'"><strong>'+(mins===null?'Pendente':'✓ Registrado')+'</strong><small>'+(mins===null?'Incompleto':formatMinutes(mins))+'</small></div></article>'}).join('');
 const todayMinutes=duration(current);
 const interval=(()=>{const a=current.find(v=>v.punch_kind==='lunch_out'),b=current.find(v=>v.punch_kind==='lunch_in');return a&&b?Math.max(0,Math.floor((new Date(b.captured_at)-new Date(a.captured_at))/60000)):null})();
 el('main').className='clock-home';
 el('main').innerHTML='<div class="clock-profile"><div class="clock-brand"><img src="./icon.svg" alt="" aria-hidden="true"><div><strong>Ponto Digital</strong><small>Gestão de Jornada</small></div></div><div class="clock-welcome"><small id="clock-date"></small><h1 id="clock-greeting">Olá!</h1><p>Pronto para registrar sua jornada?</p></div></div><div class="clock-action-card"><div><small>Horário atual</small><strong id="live-clock"></strong></div><button type="button" id="mark"></button></div><section class="clock-frequency"><h2>▣ Resumo da frequência <small id="frequency-month"></small></h2><div class="clock-metrics"><div class="metric green"><span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/></svg></span><small>Dias trabalhados</small><strong id="freq-days"></strong></div><div class="metric red"><span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M9 14l6 5m0-5-6 5"/></svg></span><small>Faltas</small><strong>—</strong></div><div class="metric amber"><span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><small>Atrasos</small><strong>—</strong></div><div class="metric purple"><span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/></svg></span><small>Horas trabalhadas</small><strong id="freq-hours"></strong></div><div class="metric cyan"><span class="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h18M5 9V19M10 9V19M14 9V19M19 9V19M3 20h18M12 3l9 5H3z"/></svg></span><small>Banco de horas</small><strong>—</strong></div></div><p class="frequency-note">Faltas, atrasos e banco de horas dependem da apuração oficial do RH.</p></section><div class="clock-section-title"><h2>Minha Jornada – Últimos dias</h2><span id="clock-state"></span></div><div class="clock-recent-days">'+(preview||'<p class="clock-recent-empty">Nenhuma jornada registrada ainda.</p>')+'</div><div class="clock-today-toggle"><strong>Marcações de hoje</strong><span id="clock-today-status"></span></div><div id="rows" class="clock-rows"></div><div class="clock-totals"><div><small>Horas do dia</small><strong id="today-total"></strong></div><div><small>Intervalo</small><strong id="today-break"></strong></div><div><small>Horas extras</small><strong>—</strong></div></div><div class="secondary-actions"><button id="history">☷ Meus registros</button><button id="help">ⓘ Ajuda</button></div><button id="logout">⇥ Sair da conta</button><p id="message" role="status" aria-live="polite"></p>';
 const scheduleNote=document.createElement('p');scheduleNote.className='frequency-note';scheduleNote.textContent=plannedText;el('main').querySelector('.clock-action-card')?.after(scheduleNote);
 el('clock-date').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Sao_Paulo'}).format(new Date());
 const name=(account?.full_name||account?.employee_name||session?.user?.user_metadata?.full_name||session?.user?.user_metadata?.name||'').trim().split(/\s+/)[0];el('clock-greeting').textContent=name?'Olá, '+name+'!':'Olá!';
 el('frequency-month').textContent='– '+new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
 el('freq-days').textContent=String(completed.length);
 el('freq-hours').textContent=formatMinutes(worked);
 el('today-total').textContent=todayMinutes===null?'—':formatMinutes(todayMinutes);
 el('today-break').textContent=interval===null?'—':formatMinutes(interval);
 el('clock-state').textContent=next?'● Em andamento':'✓ Jornada concluída';
 el('clock-today-status').textContent=next?'Próxima: '+labels[next]:'4 marcações concluídas';
 const tick=()=>{const clock=el('live-clock');if(clock)clock.textContent=new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})};tick();clearInterval(window.pontoClockInterval);window.pontoClockInterval=setInterval(tick,1000);
 const rows=el('rows');
 for(const k of kinds){const v=current.find(x=>x.punch_kind===k);const row=document.createElement('div');row.className='clock-row '+(v?'is-done':'is-pending');const symbol=document.createElement('span');symbol.className='clock-symbol '+k;symbol.textContent={entry:'↪',lunch_out:'♜',lunch_in:'↶',exit:'⇥'}[k];const label=document.createElement('strong');label.textContent=labels[k];const time=document.createElement('span');time.className='clock-time';time.textContent=v?new Date(v.captured_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):'--:--';const status=document.createElement('small');status.className=v?'clock-done':'clock-pending';status.textContent=v?(v.pending_sync?'◷ A sincronizar':'✓ Registrado'):'◷ Pendente';row.append(symbol,label,time,status);rows.append(row)}
 el('mark').textContent=next?'◉ Bater ponto':'✓ Jornada registrada';el('mark').setAttribute('aria-label',next?'Registrar '+labels[next]:'Jornada registrada');
 el('mark').disabled=!next;
 el('mark').onclick=async()=>{
  el('mark').disabled=true;
  const record={id:crypto.randomUUID(),user_id:session.user.id,employment_contract_id:account.employment_contract_id,punch_kind:next,captured_at:new Date().toISOString(),device_id:localStorage.getItem('ponto_device')||(()=>{const id=crypto.randomUUID();localStorage.setItem('ponto_device',id);return id})(),offline:false};
  try{
   // Persistir primeiro: a marcação sobrevive ao fechamento do aplicativo.
   const queue=offlineQueue();queue.push(record);saveQueue(queue);
   if(navigator.onLine&&session.access_token)await syncPending();
   await home();message(offlineQueue().some(item=>item.id===record.id)?'Marcação guardada neste aparelho, mas NÃO confirmada no servidor. '+(localStorage.getItem('ponto-last-sync-error')||'Aguardando conexão ou sincronização.'):'Marcação confirmada no servidor');
  }catch(e){message('Não foi possível concluir: '+e.message);el('mark').disabled=false}
 };

 el('history').onclick=()=>{
  const fmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const tf=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const monthFmt=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
  const now=day(new Date().toISOString()).slice(0,7);
  let selected=now,mode='day',expanded=day(new Date().toISOString());
  const clock=v=>{const n=Math.max(0,Math.floor(v));return String(Math.floor(n/60)).padStart(2,'0')+'h'+String(n%60).padStart(2,'0')};
  const duration=items=>{const m=new Map(items.map(x=>[x.punch_kind,x]));const e=m.get('entry'),o=m.get('lunch_out'),i=m.get('lunch_in'),x=m.get('exit');if(!e||!x)return null;let t=(new Date(x.captured_at)-new Date(e.captured_at))/60000;if(o&&i)t-=(new Date(i.captured_at)-new Date(o.captured_at))/60000;return Number.isFinite(t)&&t>=0?Math.floor(t):null};
  const records=all.reduce((m,v)=>{const d=day(v.captured_at);if(!m.has(d))m.set(d,[]);m.get(d).push(v);return m},new Map());
  const node=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x};
  el('main').className='history-screen';
  el('main').innerHTML='<div class="history-toolbar"><button type="button" id="hist-back" aria-label="Voltar">‹</button><div class="history-brand"><strong>Ponto Digital</strong><small>Meus registros</small></div><button type="button" id="hist-period">▣ Período</button><button type="button" id="hist-filter" aria-label="Filtrar">☷</button></div><div class="history-tabs"><button data-mode="day" class="active">▣ Por dia</button><button data-mode="month">▥ Por mês</button><button data-mode="competence">◇ Por competência</button></div><div class="history-navigation"><button id="hist-prev" aria-label="Período anterior">‹</button><strong id="hist-title"></strong><button id="hist-next" aria-label="Próximo período">›</button></div><div id="hist-list"></div><div id="hist-detail"></div><div id="hist-stats"></div><input id="hist-picker" type="month" aria-label="Escolher mês" hidden><p id="message" role="status"></p>';
  const picker=el('hist-picker');picker.value=selected;
  function changeMonth(delta){const [y,m]=selected.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+delta,1));selected=d.toISOString().slice(0,7);picker.value=selected;expanded='';render()}
  function render(){
   const [y,m]=selected.split('-').map(Number);el('hist-title').textContent=monthFmt.format(new Date(Date.UTC(y,m-1,1)));
   document.querySelectorAll('.history-tabs button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode))});
   const dates=[...records.keys()].filter(d=>d.startsWith(selected)).sort().reverse();
   const list=el('hist-list');list.replaceChildren();const detail=el('hist-detail');detail.replaceChildren();
   const totals=dates.map(d=>duration(records.get(d))).filter(v=>v!==null);
   const sum=totals.reduce((a,b)=>a+b,0);
   if(!dates.length)list.append(node('p','history-empty','Nenhuma marcação encontrada neste período.'));
   for(const d of dates){
    const items=records.get(d),mins=duration(items),date=new Date(d+'T12:00:00-03:00');
    const label=fmt.format(date);const card=node('button','history-list-card'+(expanded===d?' selected':''));card.type='button';
    const dateBox=node('span','history-datebox');dateBox.append(node('small','',new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(date).replace('.','').toUpperCase()),node('strong','',d.slice(8)));
    const info=node('span','history-list-info');info.append(node('strong','',label.charAt(0).toUpperCase()+label.slice(1)),node('small','',items.length+' marcações'));
    card.append(dateBox,info,node('span','history-hour'+(mins===null?' incomplete':''),mins===null?'Pendente':clock(mins)),node('span','history-chevron',expanded===d?'⌄':'›'));
    card.onclick=()=>{expanded=expanded===d?'':d;render()};
    list.append(card);
   }
   if(mode==='day'&&expanded&&dates.includes(expanded)){
    const items=records.get(expanded),mins=duration(items),byKind=new Map(items.map(v=>[v.punch_kind,v]));
    const box=node('section','history-detail-card');
    const head=node('div','history-detail-head');const left=node('div','');left.append(node('strong','',fmt.format(new Date(expanded+'T12:00:00-03:00'))),node('small','',items.length+' marcações registradas'));head.append(left,node('strong','history-hour',mins===null?'Pendente':clock(mins)));box.append(head);
    const symbols={entry:'↪',lunch_out:'♜',lunch_in:'↶',exit:'⇥'};
    for(const k of kinds){const v=byKind.get(k),row=node('div','history-detail-row');row.append(node('span','history-kind-icon '+k,symbols[k]),node('strong','history-kind-label',labels[k]),node('strong','history-kind-time',v?tf.format(new Date(v.captured_at)):'—'),node('span',v?'history-ok':'history-wait',v?'✓ Registrado':'Pendente'));box.append(row)}
    if(mins!==null&&mins===0)box.append(node('div','history-note','Marcação de curta duração. O cálculo considera os horários registrados.'));
    detail.append(box);
   }
   const stats=node('div','history-stats');
   const values=[['Total do período',dates.length+' dias'],['Total trabalhado',clock(sum)],['Média diária',totals.length?clock(Math.floor(sum/totals.length)):'00h00']];
   for(const [label,value] of values){const item=node('div','history-stat');item.append(node('small','',label),node('strong','',value));stats.append(item)}
   el('hist-stats').replaceChildren(stats);
   if(mode==='month'){detail.replaceChildren();list.prepend(node('div','history-mode-note','Resumo mensal das jornadas registradas.'))}
   if(mode==='competence'){detail.replaceChildren();list.prepend(node('div','history-mode-note','Competência: '+selected.split('-').reverse().join('/')+' · '+dates.length+' dias registrados'))}
  }
  el('hist-back').onclick=()=>{el('main').className='';home()};
  el('hist-prev').onclick=()=>changeMonth(-1);el('hist-next').onclick=()=>changeMonth(1);
  el('hist-period').onclick=()=>{picker.showPicker?picker.showPicker():picker.click()};
  el('hist-filter').onclick=()=>{picker.showPicker?picker.showPicker():picker.click()};
  picker.onchange=()=>{if(picker.value){selected=picker.value;expanded='';render()}};
  document.querySelectorAll('.history-tabs button').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render()});
  render();
 };
 el('help').onclick=()=>{
  el('main').innerHTML='<h2>Ajuda</h2><p>Registre cada marcação na ordem. O horário é capturado automaticamente e enviado ao RH.</p><button id="back">Voltar</button><p id="message"></p>';
  el('back').onclick=home;
 };

 // Solicitações não alteram a marcação original: dependem de aprovação do RH.
 const correctionButton=document.createElement('button');
 correctionButton.type='button';
 correctionButton.id='request-correction';
 correctionButton.textContent='✎ Solicitar correção de ponto';
 correctionButton.style.cssText='background:#fff;color:#14518d;border:1px solid #b7cee9;margin:10px 0';
 document.querySelector('.secondary-actions')?.after(correctionButton);
 correctionButton.onclick=async()=>{
  if(!navigator.onLine||!session?.access_token){alert('Conecte-se à internet para solicitar uma correção.');return}
  el('main').className='correction-screen';
  el('main').innerHTML='<h2>Solicitar correção de ponto</h2><p>Informe a marcação esquecida. O RH analisará a solicitação antes de atualizar sua jornada.</p><form id="correction-form"><label>Data<input id="correction-date" type="date" required></label><label>Marcação<select id="correction-kind" required style="width:100%;padding:13px;border:1px solid #bdcee0;border-radius:8px"><option value="entry">Entrada</option><option value="lunch_out">Saída para almoço</option><option value="lunch_in">Retorno do almoço</option><option value="exit">Saída final</option></select></label><label>Horário esquecido<input id="correction-time" type="time" required></label><label>Justificativa<textarea id="correction-reason" minlength="10" maxlength="1000" required style="box-sizing:border-box;width:100%;min-height:100px;padding:12px;border:1px solid #bdcee0;border-radius:8px" placeholder="Explique por que não registrou o ponto"></textarea></label><button type="submit" id="correction-submit">Enviar solicitação ao RH</button></form><button id="correction-back" type="button" style="background:#eef3f9;color:#14518d">Voltar</button><h3>Minhas solicitações</h3><div id="correction-list" aria-live="polite">Carregando...</div><p id="message" role="status"></p>';
  const dateInput=el('correction-date');dateInput.value=day(new Date().toISOString());dateInput.max=dateInput.value;
  el('correction-back').onclick=home;
  const renderRequests=async()=>{
   try{
    const rows=await api('/rest/v1/employee_clock_correction_requests?select=attendance_date,punch_kind,requested_time,status,decision_reason,created_at&order=created_at.desc&limit=30');
    const list=el('correction-list');if(!list)return;
    list.replaceChildren();
    if(!rows?.length){list.textContent='Nenhuma solicitação registrada.';return}
    for(const item of rows){
     const card=document.createElement('div');card.className='row';card.style.display='block';
     const title=document.createElement('strong');title.textContent=item.attendance_date.split('-').reverse().join('/')+' · '+(labels[item.punch_kind]||item.punch_kind)+' · '+String(item.requested_time).slice(0,5);
     const detail=document.createElement('p');detail.textContent=({pending:'Aguardando RH',approved:'Aprovada',rejected:'Rejeitada'}[item.status]||item.status)+(item.decision_reason?' — '+item.decision_reason:'');
     card.append(title,detail);list.append(card);
    }
   }catch(error){if(el('correction-list'))el('correction-list').textContent='Não foi possível carregar solicitações: '+error.message}
  };
  el('correction-form').onsubmit=async event=>{
   event.preventDefault();const submit=el('correction-submit');submit.disabled=true;
   try{
    const date=el('correction-date').value,kind=el('correction-kind').value,time=el('correction-time').value,reason=el('correction-reason').value.trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>day(new Date().toISOString()))throw Error('Informe uma data válida, até hoje.');
    if(!kinds.includes(kind)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||reason.length<10)throw Error('Confira o horário e informe uma justificativa de pelo menos 10 caracteres.');
    const existing=await events();
    if(existing.some(item=>day(item.captured_at)===date&&item.punch_kind===kind))throw Error('Esta marcação já está registrada. Solicite ao RH uma revisão do horário existente.');
    await api('/rest/v1/employee_clock_correction_requests','POST',{user_id:session.user.id,employment_contract_id:account.employment_contract_id,attendance_date:date,punch_kind:kind,requested_time:time,reason,status:'pending'});
    message('Solicitação enviada. Aguarde a análise do RH.');el('correction-reason').value='';await renderRequests();
   }catch(error){message('Não foi possível enviar: '+error.message)}finally{submit.disabled=false}
  };
  await renderRequests();
 };
 void renderPontoNotificationButton();
 el('logout').onclick=async()=>{const token=session?.access_token;clearSession();if(token){try{await fetch(U+'/auth/v1/logout',{method:'POST',headers:{apikey:K,Authorization:'Bearer '+token}})}catch{}}location.replace(location.pathname)};
}
el('login').onsubmit=async e=>{e.preventDefault();try{session=await api('/auth/v1/token?grant_type=password','POST',{email:el('email').value,password:el('password').value});await loadAccount();saveSession(session);await syncPending();await home()}catch(err){message(err.message)}};const h=new URLSearchParams(location.hash.slice(1));if(h.has('access_token')&&['invite','recovery'].includes(h.get('type'))){session={access_token:h.get('access_token')};el('login').innerHTML='<h2>Definir senha</h2><input id="newpass" type="password" minlength="8" placeholder="Nova senha" required><button>Salvar senha</button>';el('login').onsubmit=async e=>{e.preventDefault();try{await api('/auth/v1/user','PUT',{password:el('newpass').value});location.replace(location.pathname)}catch(err){message(err.message)}}}

// Fluxo independente de recuperação de senha do Ponto Digital.
if(!new URLSearchParams(location.hash.slice(1)).has('access_token')){
 const form=el('login');
 const recoveryButton=document.createElement('button');
 recoveryButton.type='button';
 recoveryButton.textContent='Esqueci minha senha';
 recoveryButton.onclick=()=>{
  form.innerHTML='<h2>Recuperar acesso ao Ponto Digital</h2><input id="email" type="email" placeholder="E-mail do colaborador" required><button type="submit">Enviar link de recuperação</button><button id="back-login" type="button">Voltar</button>';
  el('back-login').onclick=()=>location.replace(location.pathname);
  form.onsubmit=async event=>{
   event.preventDefault();
   const email=el('email').value.trim();
   try{
    const response=await fetch(U+'/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+'/'),{method:'POST',headers:{apikey:K,'Content-Type':'application/json'},body:JSON.stringify({email})});
    if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.msg||error.message||'Não foi possível enviar o e-mail');}
    message('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha do Ponto Digital.');
   }catch(error){message(error.message);}
  };
 };
 form.append(recoveryButton);
}

// Restaurar a sessão apenas na abertura normal; convites e recuperação têm prioridade.
if(!new URLSearchParams(location.hash.slice(1)).has('access_token')){void restoreSession().finally(()=>document.documentElement.classList.remove('ponto-restoring'))}else{document.documentElement.classList.remove('ponto-restoring')}
