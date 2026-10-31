import { UpdateNotice } from './UpdateNotice';
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
 return <main className="recovery-page">
  <section className="recovery-panel">
   <h2 className="recovery-title">Definir senha de acesso</h2>
   <p className="recovery-description">Crie sua senha para acessar o Gestão 3.0.</p>
   <label htmlFor="recovery-password" className="recovery-label">Nova senha</label>
   <div className="recovery-input-row">
    <input id="recovery-password" className="recovery-input" type={showPassword?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={busy||success}/>
    <button type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(!showPassword)} className="recovery-toggle">{showPassword?'◉':'◎'}</button>
   </div>
   <label htmlFor="recovery-confirm" className="recovery-label">Confirmar senha</label>
   <div className="recovery-input-row recovery-input-row--last">
    <input id="recovery-confirm" className="recovery-input" type={showConfirm?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={busy||success}/>
    <button type="button" aria-label={showConfirm?'Ocultar confirmação':'Mostrar confirmação'} onClick={()=>setShowConfirm(!showConfirm)} className="recovery-toggle">{showConfirm?'◉':'◎'}</button>
   </div>
   {!success&&<button type="button" disabled={busy} onClick={()=>void save()} className="recovery-submit">{busy?'Salvando senha…':'Salvar senha'}</button>}
   {message&&<p role="status" aria-live="polite" className={`recovery-message ${success?'recovery-message--success':busy?'recovery-message--busy':'recovery-message--error'}`}>{message}</p>}
   {success&&<a href="/" className="recovery-login-link">Ir para o login</a>}
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
    <><UpdateNotice/><AppErrorBoundary>
      <BrowserRouter>
        <AppShell session={session} />
      </BrowserRouter>
    </AppErrorBoundary></>
  );
}
