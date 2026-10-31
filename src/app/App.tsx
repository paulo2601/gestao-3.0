import { BrowserRouter } from 'react-router-dom';
import { useState } from 'react';
import { getSupabaseClient } from '../shared/infrastructure/supabase/client';
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
 const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function save(){
  if(password.length<8||password!==confirm){setMessage('Informe pelo menos 8 caracteres e confirme a senha.');return;}
  setBusy(true);
  try{
   const client=getSupabaseClient();
   const session=await client.auth.getSession();
   if(!session.data.session)throw new Error('Link expirado. Solicite uma nova recuperação de senha.');
   const result=await client.auth.updateUser({password});
   if(result.error)throw new Error(result.error.message);
   await client.auth.signOut();
   window.location.replace('/');
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar a senha.');}
  finally{setBusy(false);}
 }
 return <main className="auth-page"><div className="auth-page__panel"><h2>Definir senha de acesso</h2><p>Crie sua senha para acessar o Gestão 3.0.</p><input aria-label="Nova senha" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><input aria-label="Confirmar senha" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/><button type="button" disabled={busy} onClick={()=>void save()}>Salvar senha</button><p role="status">{message}</p></div></main>;
}
export function App() {
  const session = usePlatformSession();
  if(window.location.hash.includes('type=recovery'))return <RecoveryPage/>;

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
