import { useEffect, useMemo, useState } from 'react';
import './hr-epi.css';
import type { HrEmployeeRow } from '../application/HrOperationsRepository';
import type { HrEpiDelivery } from '../infrastructure/HrWorkspaceService';
import { createEpiProduct,listEpiProducts,registerEpiStockEntry,registerStockEpiDelivery,type EpiProduct } from '../infrastructure/HrEpiInventoryService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
type Employee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
export function HrEpiSection({deliveries,employees,activeEmployees}:{deliveries:HrEpiDelivery[];employees:Employee[];activeEmployees:Employee[]}){
 const [tab,setTab]=useState<'stock'|'entry'|'delivery'|'history'>('stock');
 const [products,setProducts]=useState<EpiProduct[]>([]);
 const [notice,setNotice]=useState('');
 const [historyQuery,setHistoryQuery]=useState('');
 const [historyEmployee,setHistoryEmployee]=useState('');
 const [historyEpi,setHistoryEpi]=useState('');
 const [historyStart,setHistoryStart]=useState('');
 const [historyEnd,setHistoryEnd]=useState('');
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 const scopes=useMemo(()=>[...new Map(employees.map(e=>[e.companyId,{tenantId:e.tenantId,companyId:e.companyId,name:e.companyName}])).values()],[employees]);
 const [company,setCompany]=useState('');
 const [name,setName]=useState('');const [ca,setCa]=useState('');const [manufacturer,setManufacturer]=useState('');const [size,setSize]=useState('');const [minimum,setMinimum]=useState('0');
 const [productId,setProductId]=useState('');const [entryQty,setEntryQty]=useState('1');const [entryNotes,setEntryNotes]=useState('');
 const [contract,setContract]=useState('');const [qty,setQty]=useState('1');const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [notes,setNotes]=useState('');
 const selectedCompany=company||scopes[0]?.companyId||'';
 useEffect(()=>{let active=true;void listEpiProducts(scopes).then(rows=>{if(active)setProducts(rows)}).catch(e=>{if(active)setNotice(e instanceof Error?e.message:String(e))});return()=>{active=false}},[scopes,revision]);
 const onCaChange=(value:string)=>{const digits=value.replace(/[^0-9]/g,'');setCa(digits);setNotice('');const matched=products.find(p=>p.company_id===selectedCompany&&p.ca_number?.replace(/\D/g,'')===digits);if(matched){setName(matched.name);setManufacturer(matched.manufacturer||'');}}
 const available=products.filter(p=>p.company_id===selectedCompany&&p.active);
 const selected=products.find(p=>p.id===productId);
 const historyRows=deliveries.filter(item=>{const employee=employees.find(e=>e.employmentContractId===item.employmentContractId);const query=historyQuery.toLocaleLowerCase('pt-BR');return (!historyEmployee||item.employmentContractId===historyEmployee)&&(!historyEpi||item.epiName===historyEpi)&&(!historyStart||item.deliveredOn>=historyStart)&&(!historyEnd||item.deliveredOn<=historyEnd)&&((employee?.fullName||'').toLocaleLowerCase('pt-BR').includes(query)||item.epiName.toLocaleLowerCase('pt-BR').includes(query)||String(item.caNumber||'').includes(query))});
 async function execute(action:()=>Promise<void>){setBusy(true);setNotice('');try{await action();setNotice('Operação realizada com sucesso.');setRevision(v=>v+1)}catch(e){setNotice(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <div className="hr-workspace__content">
 <div className="hr-epi-tabs" role="tablist" aria-label="EPIs">
 <Button variant={tab==='stock'?'primary':'secondary'} onClick={()=>{setTab('stock');setProductId('')}}>▣ Estoque</Button>
 <Button variant={tab==='entry'?'primary':'secondary'} onClick={()=>{setTab('entry');setProductId('')}}>↧ Entrada</Button>
 <Button variant={tab==='delivery'?'primary':'secondary'} onClick={()=>{setTab('delivery');setProductId('')}}>⇄ Entrega</Button>
 <Button variant={tab==='history'?'primary':'secondary'} onClick={()=>setTab('history')}>◷ Histórico</Button>
 </div>
 {notice&&<div className="hr-epi-notice" role="status">{String(notice)}</div>}
 {tab==='stock'&&<><div className="hr-epi-heading"><span className="hr-epi-heading-icon">♧</span><div><strong>Cadastro de EPIs</strong><small>Cadastre ou atualize um equipamento de proteção individual</small></div></div><Card title="Cadastro de EPIs"><p className="hr-epi-description">Cadastre ou atualize os equipamentos de proteção individual.</p><div className="hr-workspace__form hr-epi-form">
 <Select label="Empresa" value={selectedCompany} onChange={e=>setCompany(e.target.value)} options={scopes.map(c=>({value:c.companyId,label:c.name}))}/>
 <Input label="CA" placeholder="Digite o número do CA" value={ca} onChange={e=>onCaChange(e.target.value)}/>
 <Input label="Nome do EPI" value={name} onChange={e=>setName(e.target.value)}/>
 <Input label="Fabricante" value={manufacturer} onChange={e=>setManufacturer(e.target.value)}/>
 <div className="hr-epi-fields-row"><Input label="Tamanho" value={size} onChange={e=>setSize(e.target.value)}/>
 <Input label="Estoque mínimo" type="number" min="0" value={minimum} onChange={e=>setMinimum(e.target.value)}/></div>
 <div className="hr-epi-actions"><Button variant="secondary" disabled={busy} onClick={()=>{setCa('');setName('');setManufacturer('');setSize('');setMinimum('0');setNotice('')}}>Limpar</Button><Button disabled={busy||!name.trim()||!selectedCompany||products.some(p=>p.company_id===selectedCompany&&p.ca_number?.replace(/\D/g,'')===ca.replace(/\D/g,'')&&!!ca.trim()&&p.size?.trim().toLowerCase()===size.trim().toLowerCase())} onClick={()=>{const scope=scopes.find(c=>c.companyId===selectedCompany);if(scope)void execute(async()=>{await createEpiProduct({tenantId:scope.tenantId,companyId:scope.companyId,name,ca,manufacturer,size,minimum:Number(minimum)});setSize('');setNotice('EPI cadastrado. Para outra numeração, mantenha o mesmo CA e informe o novo tamanho.')})}}>Salvar EPI</Button></div>
 </div></Card>
 </>}
 {tab==='entry'&&<><div className="hr-epi-heading hr-epi-heading--green"><span className="hr-epi-heading-icon">▣</span><div><strong>Entrada no Estoque</strong><small>Registre a reposição de EPIs</small></div></div><Card title="Entrada no estoque"><p className="hr-epi-description">Registre o recebimento e a reposição dos equipamentos.</p><div className="hr-workspace__form hr-epi-form">
 <Select label="EPI cadastrado" value={productId} onChange={e=>setProductId(e.target.value)} options={[{value:'',label:'Selecione'},...available.map(p=>({value:p.id,label:p.name+' · Saldo '+p.quantity}))]}/>
 {selected&&<div className="hr-epi-stats"><div><small>Saldo atual</small><strong>{selected.quantity} un</strong></div><div><small>Estoque mínimo</small><strong>{selected.minimum_stock} un</strong></div><div><small>Situação</small><strong>{selected.quantity<=selected.minimum_stock?'Repor':'Normal'}</strong></div></div>}
 <div className="hr-epi-quantity"><span>Quantidade recebida</span><div><button type="button" aria-label="Diminuir quantidade recebida" onClick={()=>setEntryQty(v=>String(Math.max(1,Number(v||1)-1)))}>−</button><input aria-label="Quantidade recebida" type="number" min="1" value={entryQty} onChange={e=>setEntryQty(e.target.value)}/><button type="button" aria-label="Aumentar quantidade recebida" onClick={()=>setEntryQty(v=>String(Math.max(1,Number(v||0)+1)))}>+</button></div></div>
 <Input label="Observações" value={entryNotes} onChange={e=>setEntryNotes(e.target.value)}/>
 <Button disabled={busy||!productId||!Number.isInteger(Number(entryQty))||Number(entryQty)<=0} onClick={()=>void execute(async()=>{await registerEpiStockEntry(productId,Number(entryQty),entryNotes);setEntryQty('1');setEntryNotes('')})}>Registrar entrada</Button>
 </div></Card>
 <Card title="Saldo de estoque"><p className="hr-epi-description">Acompanhe a disponibilidade por equipamento e tamanho.</p><div className="hr-epi-table-scroll"><table className="hr-epi-table"><thead><tr><th>EPI</th><th>CA</th><th>Disponível</th><th>Mínimo</th><th>Situação</th></tr></thead><tbody>{available.map(p=><tr key={p.id}><td>{p.name}{p.size?' · '+p.size:''}</td><td>{p.ca_number||'—'}</td><td>{p.quantity}</td><td>{p.minimum_stock}</td><td>{p.quantity<=p.minimum_stock?'Reposição necessária':'Normal'}</td></tr>)}</tbody></table></div></Card></>}
 {tab==='delivery'&&<><div className="hr-epi-heading"><span className="hr-epi-heading-icon">⇄</span><div><strong>Registrar Entrega de EPI</strong><small>Entregue EPIs aos colaboradores e baixe o estoque</small></div></div><Card title="Registrar entrega de EPI"><p className="hr-epi-description">Entregue EPIs aos colaboradores e dê baixa no estoque.</p><div className="hr-workspace__form hr-epi-form">
 <Select label="Colaborador" value={contract} onChange={e=>{setContract(e.target.value);setProductId('')}} options={[{value:'',label:'Selecione'},...activeEmployees.map(e=>({value:e.employmentContractId,label:e.fullName+' · '+e.companyName}))]}/>
 <Select label="EPI do estoque" value={productId} onChange={e=>setProductId(e.target.value)} options={[{value:'',label:'Selecione'},...products.filter(p=>p.active&&p.company_id===activeEmployees.find(e=>e.employmentContractId===contract)?.companyId).map(p=>({value:p.id,label:p.name+' · '+p.quantity+' disponíveis'}))]}/>
 {selected&&<div className="hr-epi-stats"><div><small>CA</small><strong>{selected.ca_number||'—'}</strong></div><div><small>Disponível</small><strong>{selected.quantity} un</strong></div><div><small>Situação</small><strong>{selected.quantity<=selected.minimum_stock?'Repor':'Normal'}</strong></div></div>}
 <div className="hr-epi-fields-row"><div className="hr-epi-quantity"><span>Quantidade</span><div><button type="button" aria-label="Diminuir quantidade" onClick={()=>setQty(v=>String(Math.max(1,Number(v||1)-1)))}>−</button><input aria-label="Quantidade" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/><button type="button" aria-label="Aumentar quantidade" onClick={()=>setQty(v=>String(Math.max(1,Number(v||0)+1)))}>+</button></div></div>
 <Input label="Data da entrega" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
 <Input label="Observações" value={notes} onChange={e=>setNotes(e.target.value)}/>
 <Button disabled={busy||!contract||!selected||!Number.isInteger(Number(qty))||Number(qty)<=0||Number(qty)>selected.quantity} onClick={()=>void execute(async()=>{await registerStockEpiDelivery(productId,contract,Number(qty),date,notes);setQty('1');setNotes('');onRegisterRefresh()})}>Registrar entrega e baixar estoque</Button>
 </div></Card></>}
 {tab==='history'&&<><div className="hr-epi-heading"><span className="hr-epi-heading-icon">◷</span><div><strong>Histórico de Entregas</strong><small>Confira todas as entregas de EPIs</small></div></div><Card title="Histórico de entregas"><p className="hr-epi-description">Consulte as entregas realizadas aos colaboradores.</p><div className="hr-epi-history-search"><Input label="Buscar colaborador, EPI ou CA" value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)}/></div><div className="hr-epi-filters"><Select label="Colaborador" value={historyEmployee} onChange={e=>setHistoryEmployee(e.target.value)} options={[{value:'',label:'Todos'},...employees.map(e=>({value:e.employmentContractId,label:e.fullName}))]}/><Select label="EPI" value={historyEpi} onChange={e=>setHistoryEpi(e.target.value)} options={[{value:'',label:'Todos'},...[...new Set(deliveries.map(d=>d.epiName))].map(n=>({value:n,label:n}))]}/><Input label="De" type="date" value={historyStart} onChange={e=>setHistoryStart(e.target.value)}/><Input label="Até" type="date" value={historyEnd} onChange={e=>setHistoryEnd(e.target.value)}/></div>{historyRows.length===0?<p>Nenhuma entrega encontrada.</p>:<div className="hr-epi-history-list">{historyRows.map(item=><div className="hr-epi-history-item" key={item.id}><div><strong>{employees.find(e=>e.employmentContractId===item.employmentContractId)?.fullName??'Colaborador'}</strong><span>{item.epiName} · Qtd. {item.quantity} · CA {item.caNumber||'—'}</span></div><strong>{new Date(item.deliveredOn+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>)}</div>}</Card></>}
 </div>;
 function onRegisterRefresh(){window.dispatchEvent(new Event('hr-epi-delivery-updated'))}
}
