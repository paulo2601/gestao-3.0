const U='https://ogmtzxotpukddzowhqwl.supabase.co';const K='sb_publishable_vkhFOCSIvSbWifFCy6DjIg_9QJeYd38';let session=null,account=null;const el=id=>document.getElementById(id);const labels={entry:'Entrada',lunch_out:'Saída para almoço',lunch_in:'Retorno do almoço',exit:'Saída'};const kinds=Object.keys(labels);const day=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));async function api(path,method='GET',data){const r=await fetch(U+path,{method,headers:{apikey:K,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},...(data?{body:JSON.stringify(data)}:{})});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.msg||d.message||d.error_description||'Falha HTTP '+r.status)}return r.status===204?null:r.text().then(t=>t?JSON.parse(t):null)}function message(t){el('message').textContent=t}async function events(){return await api('/rest/v1/employee_clock_events?select=*&employment_contract_id=eq.'+account.employment_contract_id+'&order=captured_at.desc&limit=100')}async function home(){
 const all=await events();
 const today=day(new Date().toISOString());
 const current=all.filter(x=>day(x.captured_at)===today);
 const next=kinds.find(k=>!current.some(x=>x.punch_kind===k));
 el('main').innerHTML='<div class="day-heading"><div class="eyebrow">MINHA JORNADA</div><h2>Registrar ponto</h2><p id="clock-date"></p></div><div id="rows" class="punch-list"></div><button id="mark"></button><div class="secondary-actions"><button id="history">Meus registros</button><button id="help">Ajuda</button></div><button id="logout">Sair da conta</button><p id="message" role="status" aria-live="polite"></p>';
 el('clock-date').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Sao_Paulo'}).format(new Date());
 const rows=el('rows');
 for(const k of kinds){
  const v=current.find(x=>x.punch_kind===k);
  const d=document.createElement('div');d.className='punch-row';
  const label=document.createElement('span');label.className='punch-label';label.textContent=labels[k];
  const status=document.createElement('span');status.className='punch-status '+(v?'done':'pending');
  status.textContent=v?new Date(v.captured_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}):'Pendente';
  d.append(label,status);rows.append(d);
 }
 el('mark').textContent=next?'Registrar '+labels[next]:'Jornada registrada';
 el('mark').disabled=!next;
 el('mark').onclick=async()=>{
  el('mark').disabled=true;
  try{
   await api('/rest/v1/employee_clock_events','POST',{id:crypto.randomUUID(),user_id:session.user.id,employment_contract_id:account.employment_contract_id,punch_kind:next,captured_at:new Date().toISOString(),device_id:localStorage.getItem('ponto_device')||(()=>{const id=crypto.randomUUID();localStorage.setItem('ponto_device',id);return id})(),offline:false});
   await home();message('Marcação confirmada no servidor');
  }catch(e){message(e.message);el('mark').disabled=false}
 };
 el('history').onclick=()=>{
  el('main').innerHTML='<div class="day-heading"><div class="eyebrow">HISTÓRICO DE JORNADA</div><h2>Meus registros</h2><p>Consulte suas marcações por dia.</p></div><div class="history-filters"><label for="history-month">Mês</label><input id="history-month" type="month"></div><div id="history-summary" class="history-summary"></div><div id="history-days" class="history-days"></div><button id="back">Voltar</button><p id="message" role="status" aria-live="polite"></p>';
  const dateFmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const timeFmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const filter=el('history-month');filter.value=day(new Date().toISOString()).slice(0,7);
  function renderHistory(){
   const selected=filter.value;
   const records=all.filter(v=>day(v.captured_at).startsWith(selected));
   const groups=new Map();
   for(const v of records){const date=day(v.captured_at);if(!groups.has(date))groups.set(date,[]);groups.get(date).push(v)}
   const container=el('history-days');container.replaceChildren();
   el('history-summary').textContent=groups.size+' dia(s) com marcações · '+records.length+' registro(s)';
   if(!groups.size){const empty=document.createElement('p');empty.className='history-empty';empty.textContent='Nenhuma marcação encontrada neste mês.';container.append(empty);return}
   for(const [date,items] of [...groups].sort((a,b)=>b[0].localeCompare(a[0]))){
    const card=document.createElement('details');card.className='history-day';card.open=date===day(new Date().toISOString());
    const heading=document.createElement('summary');const name=document.createElement('strong');name.textContent=dateFmt.format(new Date(date+'T12:00:00-03:00'));const count=document.createElement('span');count.textContent=items.length+' de 4 marcações';heading.append(name,count);card.append(heading);
    const byKind=new Map(items.map(v=>[v.punch_kind,v]));
    for(const kind of kinds){const v=byKind.get(kind);const row=document.createElement('div');row.className='history-record';const label=document.createElement('span');label.textContent=labels[kind];const status=document.createElement('strong');status.className=v?'history-time':'history-pending';status.textContent=v?timeFmt.format(new Date(v.captured_at))+(v.offline?' · offline':''):'Pendente';row.append(label,status);card.append(row)}
    const entry=byKind.get('entry'),lunchOut=byKind.get('lunch_out'),lunchIn=byKind.get('lunch_in'),exit=byKind.get('exit');
    if(entry&&exit){let minutes=(new Date(exit.captured_at)-new Date(entry.captured_at))/60000;if(lunchOut&&lunchIn)minutes-=(new Date(lunchIn.captured_at)-new Date(lunchOut.captured_at))/60000;if(minutes>=0){const total=document.createElement('div');total.className='history-total';total.textContent='Horas registradas: '+Math.floor(minutes/60)+'h '+String(Math.floor(minutes%60)).padStart(2,'0')+'min';card.append(total)}}
    container.append(card);
   }
  }
  filter.onchange=renderHistory;renderHistory();el('back').onclick=home;
 };
 el('help').onclick=()=>{
  el('main').innerHTML='<h2>Ajuda</h2><p>Registre cada marcação na ordem. O horário é capturado automaticamente e enviado ao RH.</p><button id="back">Voltar</button><p id="message"></p>';
  el('back').onclick=home;
 };
 el('logout').onclick=()=>location.reload();
}
el('login').onsubmit=async e=>{e.preventDefault();try{session=await api('/auth/v1/token?grant_type=password','POST',{email:el('email').value,password:el('password').value});const a=await api('/rest/v1/employee_clock_accounts?select=*&user_id=eq.'+session.user.id);if(a.length!==1||!a[0].enabled)throw Error('Conta ainda não habilitada pelo RH');account=a[0];await home()}catch(err){message(err.message)}};const h=new URLSearchParams(location.hash.slice(1));if(h.has('access_token')&&['invite','recovery'].includes(h.get('type'))){session={access_token:h.get('access_token')};el('login').innerHTML='<h2>Definir senha</h2><input id="newpass" type="password" minlength="8" placeholder="Nova senha" required><button>Salvar senha</button>';el('login').onsubmit=async e=>{e.preventDefault();try{await api('/auth/v1/user','PUT',{password:el('newpass').value});location.replace(location.pathname)}catch(err){message(err.message)}}}

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
