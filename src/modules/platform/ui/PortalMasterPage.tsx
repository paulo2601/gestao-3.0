import { useEffect,useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { loadPortalMaster, type TenantOverview, type SubscriptionOverview, type PlanOverview } from '../infrastructure/PortalMasterRepository';
import './PortalMasterPage.css';
type PortalState={authorized:boolean;tenants:TenantOverview[];subscriptions:SubscriptionOverview[];plans:PlanOverview[]};
export function PortalMasterPage(){
 const [data,setData]=useState<PortalState|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  try{setData(await loadPortalMaster());}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o Portal Master.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 return <section className="app-company-sections">
 <header className="app-page__section-header"><div><small>ADMINISTRAÇÃO DA PLATAFORMA</small><h1>Clientes SaaS e permissões</h1><p>Portal Master do Gestão 3.0</p></div><Button size="sm" disabled={loading} onClick={()=>void refresh()}>Atualizar</Button></header>
 {loading?<p>Carregando clientes…</p>:error?<p role="alert">{error}</p>:!data?.authorized?<p role="alert">Acesso restrito aos operadores da plataforma. O administrador de uma empresa não recebe acesso ao Portal Master automaticamente.</p>:<>
 <div className="portal-master__summary"><div><small>Clientes</small><strong>{data.tenants.length}</strong></div><div><small>Assinaturas</small><strong>{data.subscriptions.length}</strong></div><div><small>Planos</small><strong>{data.plans.length}</strong></div></div>
 <p>Consulta administrativa disponível. Cadastro, edição e suspensão serão liberados após configurar o operador Master e as operações protegidas no servidor.</p>
 <div className="portal-master__list">{data.tenants.map(t=>{const subscription=data.subscriptions.find(s=>s.tenant_id===t.id);const plan=data.plans.find(p=>p.id===subscription?.plan_id);return <article className="portal-master__tenant" key={t.id}><div><h3>{t.name}</h3><small>{t.slug}</small></div><div><small>Cliente</small><strong>{t.status}</strong></div><div><small>Plano</small><strong>{plan?.nome??'Não atribuído'}</strong></div><div><small>Assinatura</small><strong>{subscription?.status??'Sem assinatura'}</strong></div></article>;})}</div>
 {data.tenants.length===0&&<p>Nenhum cliente cadastrado.</p>}
 </>}
 </section>;
}
