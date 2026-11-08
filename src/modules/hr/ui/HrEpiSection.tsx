import { useEffect, useMemo, useState } from 'react';
import './hr-epi.css';
import type { HrEmployeeRow } from '../application/HrOperationsRepository';
import type { HrEpiDelivery } from '../infrastructure/HrWorkspaceService';
import { createEpiProduct,listEpiProducts,registerEpiStockEntry,registerStockEpiDelivery,type EpiProduct,lookupOfficialEpiCa,type OfficialCaRecord } from '../infrastructure/HrEpiInventoryService';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
type Employee=HrEmployeeRow&{companyId:string;companyName:string;tenantId:string};
export function HrEpiSection({deliveries,employees,activeEmployees}:{deliveries:HrEpiDelivery[];employees:Employee[];activeEmployees:Employee[]}){
 const [tab,setTab]=useState<'stock'|'delivery'|'history'>('stock');
 const [products,setProducts]=useState<EpiProduct[]>([]);
 const [notice,setNotice]=useState('');
 const [caStatus,setCaStatus]=useState('');
 const [officialCa,setOfficialCa]=useState<OfficialCaRecord|null>(null);
 const [busy,setBusy]=useState(false);
 const [revision,setRevision]=useState(0);
 const scopes=useMemo(()=>[...new Map(employees.map(e=>[e.companyId,{tenantId:e.tenantId,companyId:e.companyId,name:e.companyName}])).values()],[employees]);
 const [company,setCompany]=useState('');
 const [name,setName]=useState('');const [ca,setCa]=useState('');const [manufacturer,setManufacturer]=useState('');const [size,setSize]=useState('');const [minimum,setMinimum]=useState('0');
 const [productId,setProductId]=useState('');const [entryQty,setEntryQty]=useState('1');const [entryNotes,setEntryNotes]=useState('');
 const [contract,setContract]=useState('');const [qty,setQty]=useState('1');const [date,setDate]=useState(new Date().toISOString().slice(0,10));const [notes,setNotes]=useState('');
 const selectedCompany=company||scopes[0]?.companyId||'';
 useEffect(()=>{let active=true;void listEpiProducts(scopes).then(rows=>{if(active)setProducts(rows)}).catch(e=>{if(active)setNotice(e instanceof Error?e.message:String(e))});return()=>{active=false}},[scopes,revision]);
 const caMatch=products.find(p=>p.ca_number?.replace(/\D/g,'')===ca.replace(/\D/g,'')&&ca.replace(/\D/g,'').length>0);
 const onCaChange=(value:string)=>{setCa(value.replace(/[^0-9]/g,''));setOfficialCa(null);setCaStatus('');setName('');setManufacturer('');setNotice('');};
 useEffect(()=>{
  const digits=ca.replace(/\D/g,'');
  if(digits.length<3){setCaStatus('');return;}
  let cancelled=false;
  setCaStatus('Consultando CA...');
  const timer=setTimeout(()=>{void lookupOfficialEpiCa(digits).then(record=>{
   if(cancelled)return;
   if(record){setOfficialCa(record);setName(record.equipment);setManufacturer(record.manufacturer||'');setCaStatus('CA localizado na base CAEPI importada. Confira a situação e a validade.');return;}
   const matched=products.find(p=>p.ca_number?.replace(/\D/g,'')===digits);
   if(matched){setName(matched.name);setManufacturer(matched.manufacturer||'');setCaStatus('CA localizado apenas no cadastro interno; não verificado na base oficial.');}
   else setCaStatus('CA não localizado na base disponível. A importação oficial pode estar pendente; consulte o MTE.');
  }).catch(()=>{if(!cancelled)setCaStatus('Consulta indisponível. Não foi possível verificar o CA na base oficial.');});},500);
  return()=>{cancelled=true;clearTimeout(timer)};
 },[ca,products]);
 const available=products.filter(p=>p.company_id===selectedCompany&&p.active);
 const selected=products.find(p=>p.id===productId);
 async function execute(action:()=>Promise<void>){setBusy(true);setNotice('');try{await action();setNotice('Operação realizada com sucesso.');setRevision(v=>v+1)}catch(e){setNotice(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 return <div className="hr-workspace__content">
 <div className="hr-epi-tabs">
 <Button variant={tab==='stock'?'primary':'secondary'} onClick={()=>setTab('stock')}>Estoque</Button>
 <Button variant={tab==='delivery'?'primary':'secondary'} onClick={()=>setTab('delivery')}>Entrega</Button>
 <Button variant={tab==='history'?'primary':'secondary'} onClick={()=>setTab('history')}>Histórico ({deliveries.length})</Button>
 </div>
 {notice&&<p role="status">{String(notice)}</p>}
 {tab==='stock'&&<><Card title="Cadastro de EPIs"><div className="hr-workspace__form">
 <Select label="Empresa" value={selectedCompany} onChange={e=>setCompany(e.target.value)} options={scopes.map(c=>({value:c.companyId,label:c.name}))}/>
 <Input label="CA — buscar EPI" placeholder="Digite o número do CA" value={ca} onChange={e=>onCaChange(e.target.value)}/>
 <div className="hr-epi-ca-info" role="status">{caStatus||'Digite o CA para iniciar a consulta automática.'}{officialCa&&<p>Modelo: {officialCa.model||'Não informado'} · Situação: {officialCa.situation||'Não informada'} · Validade: {officialCa.expires_on||'Não informada'}</p>} <a href="https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx" target="_blank" rel="noreferrer">Conferir no Ministério do Trabalho</a></div>
 <Input label="Nome do EPI" value={name} onChange={e=>setName(e.target.value)}/>
 <Input label="Fabricante" value={manufacturer} onChange={e=>setManufacturer(e.target.value)}/>
 <Input label="Tamanho" value={size} onChange={e=>setSize(e.target.value)}/>
 <Input label="Estoque mínimo" type="number" min="0" value={minimum} onChange={e=>setMinimum(e.target.value)}/>
 <Button disabled={busy||!name.trim()||!selectedCompany||!!(caMatch&&caMatch.size?.trim().toLowerCase()===size.trim().toLowerCase())} onClick={()=>{const scope=scopes.find(c=>c.companyId===selectedCompany);if(scope)void execute(async()=>{await createEpiProduct({tenantId:scope.tenantId,companyId:scope.companyId,name,ca,manufacturer,size,minimum:Number(minimum)});setSize('');setNotice('EPI cadastrado. Para outra numeração, mantenha o mesmo CA e informe o novo tamanho.')})}}>Cadastrar EPI</Button>
 </div></Card>
 <Card title="Entrada no estoque"><div className="hr-workspace__form">
 <Select label="EPI cadastrado" value={productId} onChange={e=>setProductId(e.target.value)} options={[{value:'',label:'Selecione'},...available.map(p=>({value:p.id,label:p.name+' · Saldo '+p.quantity}))]}/>
 <Input label="Quantidade recebida" type="number" min="1" value={entryQty} onChange={e=>setEntryQty(e.target.value)}/>
 <Input label="Observações" value={entryNotes} onChange={e=>setEntryNotes(e.target.value)}/>
 <Button disabled={busy||!productId} onClick={()=>void execute(async()=>{await registerEpiStockEntry(productId,Number(entryQty),entryNotes);setEntryQty('1');setEntryNotes('')})}>Registrar entrada</Button>
 </div></Card>
 <Card title="Saldo de estoque"><div className="hr-epi-table-scroll"><table className="hr-epi-table"><thead><tr><th>EPI</th><th>CA</th><th>Disponível</th><th>Mínimo</th><th>Situação</th></tr></thead><tbody>{available.map(p=><tr key={p.id}><td>{p.name}{p.size?' · '+p.size:''}</td><td>{p.ca_number||'—'}</td><td>{p.quantity}</td><td>{p.minimum_stock}</td><td>{p.quantity<=p.minimum_stock?'Reposição necessária':'Normal'}</td></tr>)}</tbody></table></div></Card></>}
 {tab==='delivery'&&<Card title="Registrar entrega de EPI"><div className="hr-workspace__form">
 <Select label="Colaborador" value={contract} onChange={e=>{setContract(e.target.value);setProductId('')}} options={[{value:'',label:'Selecione'},...activeEmployees.map(e=>({value:e.employmentContractId,label:e.fullName+' · '+e.companyName}))]}/>
 <Select label="EPI do estoque" value={productId} onChange={e=>setProductId(e.target.value)} options={[{value:'',label:'Selecione'},...products.filter(p=>p.active&&p.company_id===activeEmployees.find(e=>e.employmentContractId===contract)?.companyId).map(p=>({value:p.id,label:p.name+' · '+p.quantity+' disponíveis'}))]}/>
 {selected&&<p>CA: {selected.ca_number||'Não informado'} · Saldo: {selected.quantity}</p>}
 <Input label="Quantidade" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/>
 <Input label="Data da entrega" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
 <Input label="Observações" value={notes} onChange={e=>setNotes(e.target.value)}/>
 <Button disabled={busy||!contract||!selected||Number(qty)<=0||Number(qty)>selected.quantity} onClick={()=>void execute(async()=>{await registerStockEpiDelivery(productId,contract,Number(qty),date,notes);setQty('1');setNotes('');onRegisterRefresh()})}>Registrar entrega e baixar estoque</Button>
 </div></Card>}
 {tab==='history'&&<Card title="Histórico de entregas">{deliveries.length===0?<p>Nenhuma entrega registrada.</p>:<div className="hr-workspace__list">{deliveries.map(item=><div className="hr-workspace__employee-row" key={item.id}><div><strong>{employees.find(e=>e.employmentContractId===item.employmentContractId)?.fullName??'Colaborador'}</strong><span>{item.epiName} · Qtd. {item.quantity} · CA {item.caNumber||'—'}</span></div><strong>{new Date(item.deliveredOn+'T12:00:00').toLocaleDateString('pt-BR')}</strong></div>)}</div>}</Card>}
 </div>;
 function onRegisterRefresh(){window.dispatchEvent(new Event('hr-epi-delivery-updated'))}
}
