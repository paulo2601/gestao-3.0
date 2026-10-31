import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { SupabaseAuthGateway } from '../infrastructure/SupabaseAuthGateway';

export interface LoginPageProps {
  loading: boolean;
  errorMessage: string | null;
  noticeMessage: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onBootstrapFirstOwner: (input: {
    email: string;
    password: string;
    bootstrapCode: string;
    tenantName: string;
    companyName: string;
  }) => Promise<void>;
}

export function LoginPage({ loading, errorMessage, noticeMessage, onSignIn, onBootstrapFirstOwner }: LoginPageProps) {
  const [setupMode, setSetupMode] = useState(false);
  const [passkeyBusy,setPasskeyBusy]=useState(false);
  const [passkeyError,setPasskeyError]=useState('');
  async function signInWithPasskey(){
    setPasskeyBusy(true);setPasskeyError('');
    try{await new SupabaseAuthGateway().signInWithPasskey();}
    catch(e){setPasskeyError(e instanceof Error?e.message:'Não foi possível autenticar com biometria.');}
    finally{setPasskeyBusy(false);}
  }
  const [recoveryNotice,setRecoveryNotice]=useState('');
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  async function requestRecovery(){
    if(!email.trim()){setValidationMessage('Informe o e-mail antes de solicitar a recuperação.');return;}
    setRecoveryBusy(true);setValidationMessage(null);setRecoveryNotice('');
    try {await new SupabaseAuthGateway().requestPasswordRecovery(email.trim());setRecoveryNotice('Se o e-mail estiver cadastrado, você receberá um link para definir sua senha.');}
    catch(e){setValidationMessage(e instanceof Error?e.message:'Não foi possível solicitar recuperação.');}
    finally{setRecoveryBusy(false);}
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [bootstrapCode, setBootstrapCode] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationMessage(null);
    if (setupMode) {
      if (password !== confirmPassword) {
        setValidationMessage('As senhas informadas não são iguais.');
        return;
      }
      void onBootstrapFirstOwner({
        email: email.trim(),
        password,
        bootstrapCode: bootstrapCode.trim(),
        tenantName: '',
        companyName: '',
      });
      return;
    }
    void onSignIn(email.trim(), password);
  }

  function toggleSetupMode() {
    setValidationMessage(null);
    setConfirmPassword('');
    setSetupMode((current) => !current);
  }

  return (
    <main className="auth-page">
      <div className="auth-page__panel">
        <div className="auth-page__brand" aria-label="Gestão — Sua gestão, mais simples">
          <img className="auth-page__logo" src="/gestao-brand.svg" alt="Gestão — Sua gestão, mais simples" />
        </div>
        <Card>
          <form className="ui-stack" onSubmit={handleSubmit}>
            {setupMode && (
              <>
                <Feedback
                  tone="success"
                  title="Primeiro acesso"
                  message="Este acesso configurará o proprietário da organização e concederá acesso administrativo às empresas já vinculadas."
                />
                <Input
                  label="Código inicial"
                  value={bootstrapCode}
                  onChange={(event) => setBootstrapCode(event.target.value)}
                  required
                />
              </>
            )}
            <Input label="E-mail" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            <Input label="Senha" type="password" autoComplete={setupMode ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required />
            {setupMode && <Input label="Confirmar senha" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />}
            {recoveryNotice && <Feedback tone="success" title="Recuperação de acesso" message={recoveryNotice} />}
            {noticeMessage && <Feedback tone="success" title="Primeiro acesso" message={noticeMessage} />}
            {validationMessage && <Feedback tone="danger" title="Confira os dados" message={validationMessage} />}
            {errorMessage && <Feedback tone="danger" title={setupMode ? 'Não foi possível criar o acesso' : 'Não foi possível entrar'} message={errorMessage} />}
            <Button type="submit" size="lg" disabled={loading} loading={loading}>{setupMode ? 'Criar primeiro acesso' : 'Entrar'}</Button>
            {!setupMode && <Button type="button" variant="secondary" disabled={loading||passkeyBusy} onClick={()=>void signInWithPasskey()}>{passkeyBusy?'Aguardando biometria…':'Entrar com biometria / passkey'}</Button>}
            {passkeyError&&<Feedback tone="danger" title="Acesso biométrico" message={passkeyError}/>}
            {!setupMode && <Button type="button" variant="tertiary" disabled={loading||recoveryBusy} onClick={()=>void requestRecovery()}>Definir ou recuperar senha</Button>}
            <Button type="button" variant="tertiary" disabled={loading} onClick={toggleSetupMode}>{setupMode ? 'Voltar para entrar' : 'Configurar primeiro acesso'}</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
