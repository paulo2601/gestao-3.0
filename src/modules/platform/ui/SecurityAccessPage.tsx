import { useEffect, useState } from 'react';
import { SupabaseAuthGateway } from '../infrastructure/SupabaseAuthGateway';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';

type RegisteredPasskey={id:string;friendly_name?:string;created_at:string};
const gateway=new SupabaseAuthGateway();
export function SecurityAccessPage(){
 const [keys,setKeys]=useState<RegisteredPasskey[]>([]);
 const [busy,setBusy]=useState(false);
 const [pendingRemoval,setPendingRemoval]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 async function refresh(){
  try{setKeys(await gateway.listPasskeys());setError('');}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível consultar as credenciais.');}
 }
 useEffect(()=>{void refresh();},[]);
 async function register(){
  setBusy(true);setMessage('');setError('');
  try{await gateway.registerPasskey();await refresh();setMessage('Biometria cadastrada. Saia e use Entrar com biometria / passkey para testar.');}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível cadastrar a biometria.');}
  finally{setBusy(false);}
 }
 async function remove(id:string){
  setBusy(true);setMessage('');setError('');
  try{await gateway.deletePasskey(id);setPendingRemoval(null);await refresh();setMessage('Credencial removida.');}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível remover a credencial.');}
  finally{setBusy(false);}
 }
 return <section className="app-company-sections"><header className="app-page__section-header"><div><small>ADMINISTRAÇÃO</small><h1>Segurança e acesso</h1><p>Cadastre e gerencie passkeys para entrar com biometria, PIN ou bloqueio seguro do aparelho.</p></div></header><Card><h2>Biometria e passkeys</h2><p>Entre com sua senha normalmente antes de cadastrar a primeira credencial. O cadastro depende do navegador e do gerenciador de senhas do dispositivo.</p><Button disabled={busy} onClick={()=>void register()}>{busy?'Aguarde…':'Cadastrar biometria'}</Button>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}<h3>Dispositivos cadastrados</h3>{keys.length===0?<p>Nenhuma passkey cadastrada nesta conta.</p>:<ul>{keys.map(key=><li key={key.id}>{key.friendly_name||'Credencial de acesso'} — {new Date(key.created_at).toLocaleDateString('pt-BR')} <Button variant="secondary" disabled={busy} onClick={()=>setPendingRemoval(key.id)}>Remover</Button></li>)}</ul>}</Card><Dialog open={pendingRemoval!==null} title="Remover biometria" description="Esta credencial deixará de funcionar para entrar no Gestão 3.0. O login por senha continuará disponível." loading={busy} onClose={()=>setPendingRemoval(null)} footer={<><Button variant="secondary" disabled={busy} onClick={()=>setPendingRemoval(null)}>Cancelar</Button><Button disabled={busy} onClick={()=>{if(pendingRemoval)void remove(pendingRemoval);}}>Confirmar remoção</Button></>}/></section>;
}
