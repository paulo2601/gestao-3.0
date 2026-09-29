import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import type { UnregisteredBudgetEntry } from '../application/budgetCommitments';

type Option={id:string;name:string};
const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const date=(value:string)=>new Intl.DateTimeFormat('pt-BR').format(new Date(value+'T12:00:00'));
const sourceLabel=(value:string)=>value==='financial_installment'?'Parcelado':value==='card_installment'?'Cartão parcelado':'Lançamento';

export function BudgetUnregisteredItems({items,categories,costCenters,onClassify}:{items:UnregisteredBudgetEntry[];categories:Option[];costCenters:Option[];onClassify:(item:UnregisteredBudgetEntry,categoryId:string,costCenterId:string)=>Promise<void>}){
 const [editing,setEditing]=useState<string|null>(null);
 const [categoryId,setCategoryId]=useState('');
 const [costCenterId,setCostCenterId]=useState('');
 const [saving,setSaving]=useState<string|null>(null);
 const classify=(item:UnregisteredBudgetEntry)=>{
  setSaving(item.key);
  onClassify(item,categoryId,costCenterId).then(()=>{setEditing(null);setCategoryId('');setCostCenterId('');}).catch(()=>undefined).finally(()=>setSaving(null));
 };
 if(!items.length)return <div className="budget-unregistered-empty"><strong>Nenhum item pendente de classificação.</strong><span>Todo lançamento está vinculado a um item do orçamento financeiro.</span></div>;
 return <div className="budget-workspace__items">{items.map(item=><div className="budget-workspace__item" key={item.key}>
  <div className="budget-workspace__item-main"><strong>{item.description||'Item não cadastrado'}</strong><span>{item.counterpartyName?item.counterpartyName+' · ':''}Vencimento {date(item.dueDate)}</span><span>Competência {item.competenceMonth.slice(0,7).split('-').reverse().join('/')} · {sourceLabel(item.sourceKind)}</span></div>
  <div className="budget-annual-fields"><span className="budget-annual-actual">Valor comprometido <b>{currency.format(item.amount)}</b></span></div>
  <div className="budget-workspace__item-actions">{editing===item.key?<><select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Categoria</option>{categories.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><select value={costCenterId} onChange={e=>setCostCenterId(e.target.value)}><option value="">Sem centro de custo</option>{costCenters.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><Button size="sm" disabled={!categoryId||saving===item.key} onClick={()=>classify(item)}>{saving===item.key?'Salvando…':'Confirmar'}</Button></>:<Button size="sm" onClick={()=>{setEditing(item.key);setCategoryId(item.categoryId??'');setCostCenterId(item.costCenterId??'');}}>Classificar</Button>}</div>
 </div>)}</div>;
}
