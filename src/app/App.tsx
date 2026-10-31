import { BrowserRouter } from 'react-router-dom';
import { useState } from 'react';
import { SupabaseAuthGateway } from '../modules/platform/infrastructure/SupabaseAuthGateway';
import { LoginPage } from '../modules/platform/ui/LoginPage';
import { usePlatformSession } from '../modules/platform/ui/usePlatformSession';
import { LoadingState } from '../shared/ui/Feedback';
import { AppErrorBoundary } from './AppErrorBoundary';
import { AppShell } from './AppShell';
import './shell.css';
import './central-menu.css';
import './final.css';
import './privacy.css';

function RecoveryPage(){
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [showConfirm,setShowConfirm]=useState(false);
 const [message,setMessage]=useState('');
 const [success,setSuccess]=useState(false);
 const [busy,setBusy]=useState(false);
 async function save(){
  if(busy||success)return;
  if(password.length<8){setMessage('A senha deve conter pelo menos 8 caracteres.');return;}
  if(password!==confirm){setMessage('As senhas não coincidem.');return;}
  setBusy(true);setMessage('Salvando sua senha…');
  try{
   await new SupabaseAuthGateway().updatePassword(password);
   setSuccess(true);setMessage('Senha definida com sucesso! Você já pode entrar no Gestão 3.0.');
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar a senha. Solicite um novo link de recuperação.');}
  finally{setBusy(false);}
 }
 const fieldStyle={width:'100%',padding:'14px',border:'1px solid #cbd5e1',borderRadius:8,fontSize:16,boxSizing:'border-box' as const};
 return <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:20,background:'#f8fafc'}}>
  <section style={{width:'100%',maxWidth:440,padding:24,border:'1px solid #e2e8f0',borderRadius:16,background:'#fff',boxShadow:'0 6px 24px #0f172a12'}}>
   <h2 style={{marginTop:0,color:'#0f172a'}}>Definir senha de acesso</h2>
   <p style={{color:'#475569'}}>Crie sua senha para acessar o Gestão 3.0.</p>
   <label htmlFor="recovery-password" style={{display:'block',fontWeight:600,marginBottom:8}}>Nova senha</label>
   <div style={{display:'flex',gap:8,marginBottom:18}}>
    <input id="recovery-password" style={fieldStyle} type={showPassword?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||success}/>
    <button type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(!showPassword)} style={{minWidth:54,borderRadius:8,border:'1px solid #cbd5e1',background:'#fff',fontSize:21}}>{showPassword?'◉':'◎'}</button>
   </div>
   <label htmlFor="recovery-confirm" style={{display:'block',fontWeight:600,marginBottom:8}}>Confirmar senha</label>
   <div style={{display:'flex',gap:8,marginBottom:20}}>
    <input id="recovery-confirm" style={fieldStyle} type={showConfirm?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={busy||success}/>
    <button type="button" aria-label={showConfirm?'Ocultar confirmação':'Mostrar confirmação'} onClick={()=>setShowConfirm(!showConfirm)} style={{minWidth:54,borderRadius:8,border:'1px solid #cbd5e1',background:'#fff',fontSize:21}}>{showConfirm?'◉':'◎'}</button>
   </div>
   {!success&&<button type="button" disabled={busy} onClick={()=>void save()} style={{width:'100%',padding:15,border:0,borderRadius:8,color:'#fff',background:busy?'#64748b':'#2563eb',fontSize:17,fontWeight:700}}>{busy?'Salvando senha…':'Salvar senha'}</button>}
   {message&&<p role="status" aria-live="polite" style={{padding:12,borderRadius:8,background:success?'#dcfce7':busy?'#eff6ff':'#fef2f2',color:success?'#166534':busy?'#1d4ed8':'#991b1b'}}>{message}</p>}
   {success&&<a href="/" style={{display:'block',padding:15,textAlign:'center',borderRadius:8,background:'#2563eb',color:'#fff',textDecoration:'none',fontWeight:700}}>Ir para o login</a>}
  </section>
 </main>;
}
export function App() {
  const session = usePlatformSession();
  if(new URLSearchParams(window.location.search).get('recovery')==='1'||window.location.hash.includes('type=recovery'))return <RecoveryPage/>;

  if (session.status === 'loading') {
    return (
      <main className="app-page app-page--centered">
        <LoadingState label="Carregando sessão…" />
      </main>
    );
  }

  if (session.status === 'anonymous' || session.status === 'error') {
    return (
      <LoginPage
        loading={false}
        errorMessage={session.errorMessage}
        noticeMessage={session.noticeMessage}
        onSignIn={session.signIn}
        onSignInWithPasskey={session.signInWithPasskey}
        onBootstrapFirstOwner={session.bootstrapFirstOwner}
      />
    );
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppShell session={session} />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
