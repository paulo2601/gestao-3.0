import { Button } from '../../../shared/ui/Button';
import type { UnregisteredBudgetEntry } from '../application/budgetCommitments';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const date=(value:string)=>new Intl.DateTimeFormat('pt-BR').format(new Date(value+'T12:00:00'));
const sourceLabel=(value:string)=>value==='installment'?'Parcelado':value==='recurring'?'Fixo/recorrente':'Lançamento';

export function BudgetUnregisteredItems({items,onClassify}:{items:UnregisteredBudgetEntry[];onClassify:(item:UnregisteredBudgetEntry)=>void}){
 if(items.length===0)return <div className="budget-unregistered-empty"><strong>Nenhum item pendente de classificação.</strong><span>Todo lançamento está vinculado a um item do orçamento financeiro.</span></div>;
 return <div className="budget-workspace__items">{items.map(item=><div className="budget-workspace__item" key={item.key}><div className="budget-workspace__item-main"><strong>{item.description||'Item não cadastrado'}</strong><span>{item.counterpartyName?item.counterpartyName+' · ':''}Vencimento {date(item.dueDate)}</span><span>Competência {item.competenceMonth.slice(0,7).split('-').reverse().join('/')} · {sourceLabel(item.sourceKind)}</span></div><div className="budget-annual-fields"><span className="budget-annual-actual">Valor comprometido <b>{currency.format(item.amount)}</b></span></div><div className="budget-workspace__item-actions"><Button size="sm" onClick={()=>onClassify(item)}>Classificar / cadastrar</Button></div></div>)}</div>;
}
