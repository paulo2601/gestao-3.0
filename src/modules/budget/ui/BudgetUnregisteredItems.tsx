import { Button } from '../../../shared/ui/Button';

type UnregisteredItem={
 key:string;
 categoryId:string|null;
 costCenterId:string|null;
 categoryName:string;
 actual:number;
};

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export function BudgetUnregisteredItems({items,onClassify}:{items:UnregisteredItem[];onClassify:(categoryId:string|null,costCenterId:string|null)=>void}){
 if(items.length===0)return <div className="budget-unregistered-empty"><strong>Nenhum item pendente de classificação.</strong><span>Todo lançamento está vinculado a um item do orçamento financeiro.</span></div>;
 return <div className="budget-workspace__items">{items.map(item=><div className="budget-workspace__item" key={item.key}><div className="budget-workspace__item-main"><strong>{item.categoryName.toLocaleUpperCase('pt-BR')==='OUTROS'?'Item não cadastrado':item.categoryName}</strong><span>Este lançamento ainda não possui um item correspondente no orçamento. Ele continua sendo considerado nos totais.</span></div><div className="budget-annual-fields"><span className="budget-annual-actual">Realizado <b>{currency.format(item.actual)}</b></span></div><div className="budget-workspace__item-actions"><Button size="sm" onClick={()=>onClassify(item.categoryId,item.costCenterId)}>Classificar / cadastrar</Button></div></div>)}</div>;
}