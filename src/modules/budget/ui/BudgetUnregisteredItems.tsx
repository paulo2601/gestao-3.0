import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import type { UnregisteredBudgetEntry } from '../application/budgetCommitments';

type Option={id:string;name:string;kind?:'income'|'expense'|'both'};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const date=(value:string)=>new Intl.DateTimeFormat('pt-BR').format(new Date(value+'T12:00:00'));
const sourceLabel=(value:string)=>value==='financial_installment'?'Parcelado':value==='card_installment'?'Cartão parcelado':'Lançamento';

export function BudgetUnregisteredItems({items,categories,costCenters,onClassify,onCreateCategory}:{items:UnregisteredBudgetEntry[];categories:Option[];costCenters:Option[];onClassify:(item:UnregisteredBudgetEntry,categoryId:string,costCenterId:string)=>Promise<void>;onCreateCategory:(item:UnregisteredBudgetEntry)=>void}){
 const [editing,setEditing]=useState<string|null>(null);
 const [categoryId,setCategoryId]=useState('');
 const [costCenterId,setCostCenterId]=useState('');
 const [saving,setSaving]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null);
 const classify=(item:UnregisteredBudgetEntry)=>{
  setSaving(item.key);setError(null);
  onClassify(item,categoryId,costCenterId).then(()=>{setEditing(null);setCategoryId('');setCostCenterId('');}).catch(reason=>setError(reason instanceof Error?reason.message:'Não foi possível classificar o lançamento.')).finally(()=>setSaving(null));
 };
 if(!items.length)return <div className="budget-unregistered-empty"><strong>Nenhum item pendente de classificação.</strong><span>Todo lançamento está vinculado a um item do orçamento financeiro.</span></div>;
 return <div className="budget-workspace__items">{items.map(item=>{const available=categories.filter(option=>!option.kind||option.kind===item.flowType||option.kind==='both');return <div className="budget-workspace__item" key={item.key}>
  <div className="budget-workspace__item-main"><strong>{item.description||'Item não cadastrado'}</strong><span>{item.counterpartyName?item.counterpartyName+' · ':''}Vencimento {date(item.dueDate)}</span><span>{item.flowType==='income'?'Entrada':'Despesa'} · Competência {item.competenceMonth.slice(0,7).split('-').reverse().join('/')} · {sourceLabel(item.sourceKind)}</span>{editing===item.key&&error&&<span role="alert">{error}</span>}</div>
  <div className="budget-annual-fields"><span className="budget-annual-actual">Valor {item.flowType==='income'?'previsto/realizado':'comprometido'} <b>{currency.format(item.amount)}</b></span></div>
  <div className="budget-workspace__item-actions">{editing===item.key?<><select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Categoria</option>{available.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><select value={costCenterId} onChange={e=>setCostCenterId(e.target.value)}><option value="">Sem centro de custo</option>{costCenters.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><Button size="sm" variant="secondary" onClick={()=>onCreateCategory(item)}>Nova categoria</Button><Button size="sm" disabled={!categoryId||saving===item.key} onClick={()=>classify(item)}>{saving===item.key?'Salvando…':'Confirmar'}</Button></>:<Button size="sm" onClick={()=>{setError(null);setEditing(item.key);setCategoryId(item.categoryId??'');setCostCenterId(item.costCenterId??'');}}>Classificar</Button>}</div>
 </div>;})}</div>;
}
