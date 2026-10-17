import { useEffect,useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { assignCustomerPlan, loadPortalMaster, type TenantOverview, type SubscriptionOverview, type PlanOverview } from '../infrastructure/PortalMasterRepository';
import './PortalMasterPage.css';
type PortalState={authorized:boolean;tenants:TenantOverview[];subscriptions:SubscriptionOverview[];plans:PlanOverview[]};
export function PortalMasterPage(){
 const [data,setData]=useState<PortalState|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [tenantId,setTenantId]=useState('');
 const [planId,setPlanId]=useState('');
 const [cycle,setCycle]=useState<'monthly'|'annual'>('monthly');
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState('');
 async function assign(){if(!tenantId||!planId)return;setSaving(true);setError('');setNotice('');try{await assignCustomerPlan(tenantId,planId,cycle);setNotice('Plano vinculado como pendente. Nenhuma cobrança foi ativada.');await refresh();}catch(e){setError(e instanceof Error?e.message:'Não foi possível atribuir o plano.');}finally{setSaving(false);}}
 async function refresh(){
  setLoading(true);setError('');
  try{setData(await loadPortalMaster());}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o Portal Master.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 return <section className="app-company-sections">
 <header className="app-page__section-header"><div><small>ADMINISTRAÇÃO DA PLATAFORMA</small><h1>Clientes SaaS e permissões</h1><p>Portal Master do Gestão 3.0</p></div><Button size="sm" disabled={loading} onClick={()=>void refresh()}>Atualizar</Button></header>
 {error&&<p role="alert">{error}</p>}
 {loading?<p>Carregando clientes…</p>:!data?.authorized?<p role="alert">Acesso restrito aos operadores da plataforma. O administrador de uma empresa não recebe acesso ao Portal Master automaticamente.</p>:<>
 <div className="portal-master__summary"><div><small>Clientes</small><strong>{data.tenants.length}</strong></div><div><small>Assinaturas</small><strong>{data.subscriptions.length}</strong></div><div><small>Planos</small><strong>{data.plans.length}</strong></div></div>
 <div className="portal-master__assignment"><h2>Atribuir plano ao cliente</h2><p>Cria assinatura pendente, sem cobrança automática.</p><div className="portal-master__fields"><label>Cliente<select value={tenantId} onChange={event=>setTenantId(event.target.value)}><option value="">Selecionar cliente</option>{data.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Plano<select value={planId} onChange={event=>setPlanId(event.target.value)}><option value="">Selecionar plano</option>{data.plans.filter(p=>p.slug!=='owner').map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><label>Ciclo<select value={cycle} onChange={event=>setCycle(event.target.value as 'monthly'|'annual')}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></label><Button size="sm" disabled={!tenantId||!planId||saving} onClick={()=>void assign()}>{saving?'Salvando…':'Atribuir plano'}</Button></div>{notice&&<p role="status">{notice}</p>}</div>
 <div className="portal-master__list">{data.tenants.map(t=>{const subscription=data.subscriptions.find(s=>s.tenant_id===t.id);const plan=data.plans.find(p=>p.id===subscription?.plan_id);return <article className="portal-master__tenant" key={t.id}><div><h3>{t.name}</h3><small>{t.slug}</small></div><div><small>Cliente</small><strong>{t.status}</strong></div><div><small>Plano</small><strong>{plan?.nome??'Não atribuído'}</strong></div><div><small>Assinatura</small><strong>{subscription?.status??'Sem assinatura'}</strong></div></article>;})}</div>
 {data.tenants.length===0&&<p>Nenhum cliente cadastrado.</p>}
 </>}
 </section>;
}
