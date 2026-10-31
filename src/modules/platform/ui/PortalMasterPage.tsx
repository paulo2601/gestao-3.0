import { useEffect,useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { loadPortalMaster, loadCustomerModules, setCustomerModule, resetCustomerModule, saveSaasCustomer, saveSaasSubscription, linkCustomerOwner, inviteCustomerOwner, type CommercialStatus, type CustomerModule, type TenantOverview, type SubscriptionOverview, type PlanOverview } from '../infrastructure/PortalMasterRepository';
import './PortalMasterPage.css';
type PortalState={authorized:boolean;tenants:TenantOverview[];subscriptions:SubscriptionOverview[];plans:PlanOverview[]};
const statuses:CommercialStatus[]=['pending','trial','active','past_due','suspended','cancelled'];
export function PortalMasterPage(){
 const [data,setData]=useState<PortalState|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [customerId,setCustomerId]=useState<string|null>(null);
 const [customerName,setCustomerName]=useState('');
 const [customerSlug,setCustomerSlug]=useState('');
 const [ownerTenant,setOwnerTenant]=useState('');
 const [ownerEmail,setOwnerEmail]=useState('');
 const [ownerCompany,setOwnerCompany]=useState('');
 const [customerStatus,setCustomerStatus]=useState<'active'|'inactive'>('active');
 const [tenantId,setTenantId]=useState('');
 const [planId,setPlanId]=useState('');
 const [cycle,setCycle]=useState<'monthly'|'annual'>('monthly');
 const [subscriptionStatus,setSubscriptionStatus]=useState<CommercialStatus>('pending');
 const [moduleTenant,setModuleTenant]=useState('');
 const [modules,setModules]=useState<CustomerModule[]>([]);
 const [moduleBusy,setModuleBusy]=useState(false);
 async function refresh(){
  setLoading(true);setError('');
  try{setData(await loadPortalMaster());}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o Portal Master.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);
 function editCustomer(t:TenantOverview){setCustomerId(t.id);setCustomerName(t.name);setCustomerSlug(t.slug);setCustomerStatus(t.status==='inactive'?'inactive':'active');}
 function clearCustomer(){setCustomerId(null);setCustomerName('');setCustomerSlug('');setCustomerStatus('active');}
 async function saveCustomer(){
  setBusy(true);setError('');setNotice('');
  try{await saveSaasCustomer(customerId,customerName.trim(),customerSlug.trim().toLowerCase(),customerStatus);setNotice('Cliente salvo com sucesso.');clearCustomer();await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Falha ao salvar cliente.');}
  finally{setBusy(false);}
 }
 async function saveSubscription(){
  if(!tenantId||!planId)return;
  setBusy(true);setError('');setNotice('');
  try{
   await saveSaasSubscription(tenantId,planId,cycle,subscriptionStatus);
   setNotice('Assinatura atualizada. Nenhuma cobrança foi criada automaticamente.');
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar assinatura.');}
  finally{setBusy(false);}
 }
 async function saveOwner(){
  if(!ownerTenant||!ownerEmail.trim()||ownerCompany.trim().length<2)return;
  setBusy(true);setError('');setNotice('');
  try{await linkCustomerOwner(ownerTenant,ownerEmail,ownerCompany);setNotice('Responsável vinculado com sucesso.');setOwnerEmail('');setOwnerCompany('');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Falha ao vincular responsável.');}
  finally{setBusy(false);}
 }
 async function sendInvitation(){
  if(!ownerTenant||!ownerEmail.trim())return;
  setBusy(true);setError('');setNotice('');
  try{await inviteCustomerOwner(ownerTenant,ownerEmail);setNotice('Convite solicitado com sucesso. Após confirmação do e-mail, vincule o responsável.');}
  catch(e){setError(e instanceof Error?e.message:'Falha ao enviar convite.');}
  finally{setBusy(false);}
 }
 function editSubscription(t:TenantOverview){
  const sub=data?.subscriptions.find(s=>s.tenant_id===t.id&&s.status!=='cancelled');
  setTenantId(t.id);setPlanId(sub?.plan_id??'');setCycle(sub?.ciclo==='annual'?'annual':'monthly');
  setSubscriptionStatus(statuses.find(s=>s===sub?.status)??'pending');
 }
 async function openModules(id:string){
  setModuleTenant(id);setModules([]);setModuleBusy(true);setError('');
  try{setModules(await loadCustomerModules(id));}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar módulos.');}
  finally{setModuleBusy(false);}
 }
 async function changeModule(code:string,enabled:boolean|null){
  if(!moduleTenant)return;
  setModuleBusy(true);setError('');
  try{
   if(enabled===null)await resetCustomerModule(moduleTenant,code);
   else await setCustomerModule(moduleTenant,code,enabled);
   setModules(await loadCustomerModules(moduleTenant));
  }catch(e){setError(e instanceof Error?e.message:'Falha ao alterar módulo.');}
  finally{setModuleBusy(false);}
 }
 return <section className="app-company-sections">
  <header className="app-page__section-header"><div><small>ADMINISTRAÇÃO DA PLATAFORMA</small><h1>Clientes SaaS e permissões</h1><p>Portal Master · Gestão 3.0</p></div><Button size="sm" disabled={loading} onClick={()=>void refresh()}>Atualizar</Button></header>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {loading?<p>Carregando clientes…</p>:!data?.authorized?<p role="alert">Acesso restrito aos operadores da plataforma.</p>:<>
   <div className="portal-master__summary"><div><small>Clientes</small><strong>{data.tenants.length}</strong></div><div><small>Assinaturas</small><strong>{data.subscriptions.length}</strong></div><div><small>Planos</small><strong>{data.plans.length}</strong></div></div>
   <section className="portal-master__assignment"><h2>{customerId?'Editar cliente':'Cadastrar cliente SaaS'}</h2>
    <div className="portal-master__fields"><label>Nome<input value={customerName} maxLength={160} onChange={e=>setCustomerName(e.target.value)}/></label>
    <label>Identificador<input value={customerSlug} maxLength={80} onChange={e=>setCustomerSlug(e.target.value)} placeholder="cliente-exemplo"/></label>
    <label>Situação<select value={customerStatus} onChange={e=>setCustomerStatus(e.target.value as 'active'|'inactive')}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
    <Button size="sm" disabled={busy||customerName.trim().length<2||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(customerSlug)} onClick={()=>void saveCustomer()}>{busy?'Salvando…':'Salvar cliente'}</Button>
    {customerId&&<Button size="sm" variant="secondary" onClick={clearCustomer}>Cancelar edição</Button>}</div>
   </section>
   <section className="portal-master__assignment"><h2>Responsável e empresa</h2><p>O usuário deve ter uma conta existente com e-mail confirmado.</p>
    <div className="portal-master__fields">
     <label>Cliente<select value={ownerTenant} onChange={e=>setOwnerTenant(e.target.value)}><option value="">Selecionar</option>{data.tenants.filter(t=>t.status==='active').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
     <label>E-mail do responsável<input type="email" value={ownerEmail} maxLength={320} onChange={e=>setOwnerEmail(e.target.value)}/></label>
     <label>Nome da empresa<input value={ownerCompany} maxLength={160} onChange={e=>setOwnerCompany(e.target.value)}/></label>
     <Button size="sm" variant="secondary" disabled={busy||!ownerTenant||!ownerEmail.trim()} onClick={()=>void sendInvitation()}>Enviar convite por e-mail</Button>
     <Button size="sm" disabled={busy||!ownerTenant||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail.trim())||ownerCompany.trim().length<2} onClick={()=>void saveOwner()}>{busy?'Vinculando…':'Vincular responsável'}</Button>
    </div>
   </section>
   <section className="portal-master__assignment"><h2>Plano e assinatura</h2><p>Ativação é manual. Não gera cobrança.</p>
    <div className="portal-master__fields"><label>Cliente<select value={tenantId} onChange={e=>setTenantId(e.target.value)}><option value="">Selecionar</option>{data.tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Plano<select value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Selecionar</option>{data.plans.filter(p=>p.slug!=='owner').map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label>Ciclo<select value={cycle} onChange={e=>setCycle(e.target.value as 'monthly'|'annual')}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></label>
    <label>Status<select value={subscriptionStatus} onChange={e=>setSubscriptionStatus(e.target.value as CommercialStatus)}>{statuses.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
    <Button size="sm" disabled={busy||!tenantId||!planId} onClick={()=>void saveSubscription()}>{busy?'Salvando…':'Salvar assinatura'}</Button></div>
   </section>
   {moduleTenant&&<section className="portal-master__assignment"><h2>Módulos · {data.tenants.find(t=>t.id===moduleTenant)?.name}</h2><p>Personalização não ativa assinatura pendente ou suspensa.</p>
    <Button size="sm" variant="secondary" onClick={()=>setModuleTenant('')}>Fechar</Button>
    {moduleBusy?<p>Carregando…</p>:<div className="portal-master__list">{modules.map(m=><div className="portal-master__module" key={m.modulo}><strong>{m.nome}</strong><span>{m.habilitado?'Liberado no plano':'Bloqueado no plano'}{m.personalizado?' · Personalizado':' · Padrão'}</span>
    <Button size="sm" variant="secondary" onClick={()=>void changeModule(m.modulo,!m.habilitado)}>{m.habilitado?'Bloquear':'Liberar'}</Button>
    {m.personalizado&&<Button size="sm" variant="tertiary" onClick={()=>void changeModule(m.modulo,null)}>Restaurar</Button>}</div>)}</div>}
   </section>}
   <div className="portal-master__list">{data.tenants.map(t=>{
    const sub=data.subscriptions.find(s=>s.tenant_id===t.id&&s.status!=='cancelled');
    const plan=data.plans.find(p=>p.id===sub?.plan_id);
    return <article className="portal-master__tenant" key={t.id}><div><h3>{t.name}</h3><small>{t.slug}</small></div>
    <div><small>Cliente</small><strong>{t.status}</strong><Button size="sm" variant="secondary" onClick={()=>editCustomer(t)}>Editar</Button></div>
    <div><small>Plano</small><strong>{plan?.nome??'Não atribuído'}</strong><Button size="sm" variant="secondary" onClick={()=>editSubscription(t)}>Assinatura</Button></div>
    <div><small>Status</small><strong>{sub?.status??'Sem assinatura'}</strong><Button size="sm" variant="secondary" onClick={()=>void openModules(t.id)}>Módulos</Button></div></article>;
   })}</div>
   {data.tenants.length===0&&<p>Nenhum cliente cadastrado.</p>}
  </>}
 </section>;
}
