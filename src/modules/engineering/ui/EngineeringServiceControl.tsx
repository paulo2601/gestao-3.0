import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { EngineeringContractSummary } from '../domain/overview';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { sharePrintableElement } from '../../../shared/utils/reportShare';
import { addServiceControlEntry, importContractToServiceControl, listServiceControls, type ServiceControl } from '../infrastructure/EngineeringServiceControlRepository';
import './engineering-service-control.css';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const qty=(v:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4}).format(v);
const monthNow=()=>new Date().toISOString().slice(0,7);
const today=()=>new Date().toISOString().slice(0,10);
interface Props{contracts:readonly EngineeringContractSummary[];companies:readonly CompanySummary[]}
export function EngineeringServiceControl({contracts,companies}:Props){
 const [selectedContractId,setSelectedContractId]=useState(''),[control,setControl]=useState<ServiceControl|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[month,setMonth]=useState(monthNow()),[entryItem,setEntryItem]=useState(''),[date,setDate]=useState(today()),[quantity,setQuantity]=useState(''),[notes,setNotes]=useState('');
 const selectedContract=contracts.find(c=>c.contractId===selectedContractId)??null;
 const company=selectedContract?companies.find(c=>c.id===selectedContract.companyId)??null:null;
 const scope=company?{tenantId:company.tenantId,companyId:company.id}:null;
 async function load(){
  if(!scope||!selectedContract)return setControl(null);setLoading(true);setError('');
  try{const all=await listServiceControls(scope);setControl(all.find(x=>x.contractId===selectedContract.contractId)??null);}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar o controle.');}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[selectedContractId]);
 async function importSelected(){if(!scope||!selectedContract)return;setLoading(true);setError('');try{await importContractToServiceControl(scope,selectedContract.contractId,selectedContract.workName+' · '+selectedContract.contractNumber);await load();}catch(e){setError(e instanceof Error?e.message:'Falha ao importar contrato.');setLoading(false);}}
 async function saveEntry(){if(!scope||!control||!entryItem||Number(quantity.replace(',','.'))<=0)return;setLoading(true);setError('');try{await addServiceControlEntry(scope,control.id,entryItem,date,Number(quantity.replace(',','.')),notes);setQuantity('');setNotes('');await load();}catch(e){setError(e instanceof Error?e.message:'Falha ao salvar lançamento.');setLoading(false);}}
 const rows=useMemo(()=>control?.items.map(item=>{const entries=control.entries.filter(e=>e.itemId===item.id),acc=entries.reduce((s,e)=>s+e.executedQuantity,0),monthly=entries.filter(e=>e.executionDate.slice(0,7)===month).reduce((s,e)=>s+e.executedQuantity,0),remaining=Math.max(0,item.contractedQuantity-acc);return {...item,acc,monthly,remaining,monthlyValue:monthly*item.unitPrice,accValue:acc*item.unitPrice,remainingValue:remaining*item.unitPrice,percent:item.contractedQuantity>0?acc/item.contractedQuantity*100:0};})??[],[control,month]);
 const totals=rows.reduce((a,r)=>({contracted:a.contracted+r.contractedValue,monthly:a.monthly+r.monthlyValue,acc:a.acc+r.accValue,remaining:a.remaining+r.remainingValue}),{contracted:0,monthly:0,acc:0,remaining:0});
 const options=[{value:'',label:'Selecione o contrato…'},...contracts.map(c=>({value:c.contractId,label:c.workName+' · '+c.contractNumber}))];
 const itemOptions=[{value:'',label:'Selecione o serviço…'},...rows.map(r=>({value:r.id,label:r.description+' · saldo '+qty(r.remaining)+' '+r.unit}))];
 return <div className="service-control">
  <div className="service-control__tools"><Select label="Contrato para controle" value={selectedContractId} onChange={e=>setSelectedContractId(e.target.value)} options={options}/>{selectedContract&&!control&&<Button onClick={()=>void importSelected()} disabled={loading}>Importar este contrato</Button>}{control&&<Input label="Competência" type="month" value={month} onChange={e=>setMonth(e.target.value)}/>}</div>
  {error&&<p className="ui-error">{error}</p>}{loading&&<p className="ui-muted">Atualizando…</p>}
  {selectedContract&&!control&&!loading&&<Card title="Controle ainda não criado"><p className="ui-muted">Somente este contrato será copiado para o Controle de Serviço. A cópia não altera Medição, Produção nem o contrato original.</p></Card>}
  {control&&<><div className="service-control__kpis"><Card title="Contratado"><strong>{currency.format(totals.contracted)}</strong></Card><Card title={'Executado em '+month.split('-').reverse().join('/')}><strong>{currency.format(totals.monthly)}</strong></Card><Card title="Executado acumulado"><strong>{currency.format(totals.acc)}</strong><span>{totals.contracted?((totals.acc/totals.contracted)*100).toFixed(1):'0.0'}%</span></Card><Card title="Saldo"><strong>{currency.format(totals.remaining)}</strong></Card></div>
  <Card title="Lançamento diário"><div className="service-control__entry"><Select label="Serviço" value={entryItem} onChange={e=>setEntryItem(e.target.value)} options={itemOptions}/><Input label="Data" type="date" value={date} onChange={e=>setDate(e.target.value)}/><Input label="Quantidade executada" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0,00"/><Input label="Observação" value={notes} onChange={e=>setNotes(e.target.value)}/><Button onClick={()=>void saveEntry()} disabled={loading||!entryItem||!quantity}>Salvar lançamento</Button></div></Card>
  <section className="service-control__report" id="service-control-report"><div className="service-control__report-head"><div><h2>Fechamento mensal · Controle de Serviço</h2><p>{selectedContract?.workName} · {selectedContract?.contractNumber} · {month.split('-').reverse().join('/')}</p></div><div className="report-actions"><Button size="sm" variant="secondary" onClick={()=>window.print()}>Imprimir</Button><Button size="sm" variant="secondary" onClick={()=>{const el=document.getElementById('service-control-report');if(el)void sharePrintableElement(el,'Controle de Serviço '+(selectedContract?.workName??'')+' '+month,'landscape');}}>Compartilhar PDF</Button></div></div>
   <div className="service-control__table"><table><thead><tr><th>Grupo</th><th>Serviço</th><th>Contratado</th><th>Unitário</th><th>Mês</th><th>Valor mês</th><th>Acumulado</th><th>%</th><th>Saldo</th><th>Saldo R$</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.category??'Infra'}</td><td>{r.description}</td><td>{qty(r.contractedQuantity)} {r.unit}</td><td>{currency.format(r.unitPrice)}</td><td>{qty(r.monthly)} {r.unit}</td><td>{currency.format(r.monthlyValue)}</td><td>{qty(r.acc)} {r.unit}</td><td>{r.percent.toFixed(1)}%</td><td>{qty(r.remaining)} {r.unit}</td><td>{currency.format(r.remainingValue)}</td></tr>)}</tbody></table></div>
   <div className="service-control__totals"><strong>Contratado {currency.format(totals.contracted)}</strong><strong>Mês {currency.format(totals.monthly)}</strong><strong>Acumulado {currency.format(totals.acc)}</strong><strong>Saldo {currency.format(totals.remaining)}</strong></div>
  </section></>}
 </div>;
}
