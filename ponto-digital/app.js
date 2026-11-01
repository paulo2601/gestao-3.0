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
  el('main').innerHTML='<h2>Meus registros</h2><div id="rows"></div><button id="back">Voltar</button><p id="message"></p>';
  for(const v of all){const d=document.createElement('div');d.className='row';d.textContent=labels[v.punch_kind]+' — '+new Date(v.captured_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+(v.offline?' (offline)':'');el('rows').append(d)}
  el('back').onclick=home;
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
