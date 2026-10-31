import { useEffect, useState } from 'react';
import './update-notice.css';
export function UpdateNotice(){
 const [version,setVersion]=useState<string|null>(null);
 const [deferred,setDeferred]=useState(false);
 useEffect(()=>{const handler=(event:Event)=>{const detail=(event as CustomEvent<{version:string}>).detail;if(detail?.version){setVersion(detail.version);}};window.addEventListener('gestao-update-available',handler);return()=>window.removeEventListener('gestao-update-available',handler);},[]);
 if(!version||deferred)return null;
 function confirmUpdate(){
  const editing=document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement||document.activeElement instanceof HTMLSelectElement||Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).some(el=>el instanceof HTMLInputElement?el.value!==el.defaultValue:el instanceof HTMLTextAreaElement?el.value!==el.defaultValue:false);
  if(editing&&!window.confirm('Você pode ter alterações não salvas. Salve seus lançamentos antes de atualizar. Deseja atualizar mesmo assim?'))return;
  window.dispatchEvent(new Event('gestao-update-confirmed'));
 }
 return <aside className="gestao-update-notice" role="status" aria-live="polite"><strong>Nova atualização disponível</strong><p>Uma nova versão do Gestão 3.0 está pronta. Salve seus lançamentos antes de atualizar.</p><div><button type="button" onClick={confirmUpdate}>Atualizar agora</button><button type="button" onClick={()=>setDeferred(true)}>Depois</button></div></aside>;
}
