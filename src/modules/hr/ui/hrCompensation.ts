import type { FixedCompensationItem } from '../application/HrOperationsRepository';

export type CompensationEmployee={employmentContractId:string;baseSalary:number};
export function fixedValue(item:FixedCompensationItem,salary:number){return item.valueType==='percent'?salary*item.value/100:item.value}
export function fixedTotals(employee:CompensationEmployee,items:readonly FixedCompensationItem[]){return items.filter(item=>item.employmentContractId===employee.employmentContractId&&item.active).reduce((total,item)=>{const value=fixedValue(item,employee.baseSalary);return item.kind==='earning'?{...total,earnings:total.earnings+value}:{...total,deductions:total.deductions+value}},{earnings:0,deductions:0})}
export function calculateInss(base:number){const bands:[[number,number],number][]=[[[0,1621],.075],[[1621,2902.84],.09],[[2902.84,4354.27],.12],[[4354.27,8475.55],.14]];return bands.reduce((v,[[from,to],rate])=>v+Math.max(0,Math.min(base,to)-from)*rate,0)}
export function calculateIrrf(base:number,inss:number){const taxable=Math.max(0,base-inss);let tax=taxable<=2428.8?0:taxable<=2826.65?taxable*.075-182.16:taxable<=3751.05?taxable*.15-394.16:taxable<=4664.68?taxable*.225-675.49:taxable*.275-908.73;tax=Math.max(0,tax);if(base<=5000)return 0;if(base<=7350)tax=Math.max(0,tax-(978.62-.133145*base));return tax}
