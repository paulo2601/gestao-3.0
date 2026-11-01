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
