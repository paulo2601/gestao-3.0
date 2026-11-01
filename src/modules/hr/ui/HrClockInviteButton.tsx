import {useState} from 'react';
import {Mail} from 'lucide-react';
import {sendEmployeeClockInvite} from '../infrastructure/HrWorkspaceService';

export function HrClockInviteButton({contractId,email,disabled}:{contractId:string;email:string;disabled:boolean}){
  const [confirming,setConfirming]=useState(false);
  const [sending,setSending]=useState(false);
  const [feedback,setFeedback]=useState('');
  async function send(){
    setSending(true);
    setFeedback('');
    try {
      await sendEmployeeClockInvite(contractId);
      setFeedback('Solicitação de convite concluída.');
    } catch(error:unknown){
      setFeedback('Convite não enviado: '+(error instanceof Error?error.message:String(error)));
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }
  return <div className="hr-clock-invite" style={{marginBottom:16}}>
    {!confirming?<button type="button" disabled={disabled||sending||!email} onClick={()=>{setFeedback('');setConfirming(true);}} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:10,minHeight:48,padding:"12px 20px",borderRadius:12,border:"1px solid #0866dc",background:"#0866dc",color:"#fff",fontWeight:700,fontSize:15,boxShadow:"0 3px 10px #0866dc22",maxWidth:"100%"}}><Mail size={18}/> Enviar convite do Ponto Digital</button>:
    <div role="group" aria-label="Confirmar convite">
      <p>Enviar convite para {email}? Alterações não salvas não serão incluídas.</p>
      <button type="button" disabled={disabled||sending} onClick={()=>void send()}>{sending?'Enviando...':'Confirmar envio'}</button>
      <button type="button" disabled={sending} onClick={()=>setConfirming(false)}>Cancelar</button>
    </div>}
    {feedback&&<p role="status">{feedback}</p>}
  </div>;
}
