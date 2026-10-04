import type { CompanySummary } from '../../platform/domain/AccessContext';
export type FlowType='income'|'expense';
export type Treatment='operational_cost'|'tax_cost'|'retention';
export type CategoryRow={id:string;name:string;kind:'income'|'expense'|'both';status:string};
export type CostCenterRow={id:string;name:string;status:string};
export type PlanRow={id:string;category_id:string|null;cost_center_id:string|null;planned_amount:number|string;flow_type:FlowType;notes:string|null;competence_month?:string};
export type LimitRow={id:string;category_id:string|null;cost_center_id:string|null;limit_amount:number|string;warning_percent:number|string;notes:string|null;status:string;competence_month?:string};
export type ControlRow={category_id:string|null;cost_center_id:string|null;competence_month?:string;planned_income:number|string;planned_expense:number|string;actual_income:number|string;actual_expense:number|string};
export type AnnualPlanRow={id:string;category_id:string|null;cost_center_id:string|null;budget_year:number;flow_type:FlowType;annual_amount:number|string;start_month:number;notes:string|null};
export type TreatmentRow={id:string;category_id:string;cost_center_id:string|null;budget_year:number;treatment:Treatment};
export type ItemDraft={id:string|null;source:'plan'|'limit';flowType:FlowType;categoryId:string;costCenterId:string;amount:string;notes:string;treatment:Treatment};
export type CategoryDraft={id:string|null;name:string;kind:'income'|'expense'|'both'};
export type BudgetListRow={id:string|null;source:'plan'|'limit';categoryId:string|null;costCenterId:string|null;planned:number;actual:number;treatment:Treatment};
export type AnnualDraft={annualAmount:string;startMonth:number};
export const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
export const currentMonth=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
export const scopeKey=(categoryId:string|null,costCenterId:string|null)=>`${categoryId}:${costCenterId}`;
export const monthDate=(y:number,m:number)=>`${y}-${String(m).padStart(2,'0')}-01`;
export function companyLabel(company:CompanySummary){const raw=`${company.tradeName??''} ${company.legalName}`.toLocaleUpperCase('pt-BR');if(raw.includes('SARTORI'))return'Sartori';if(raw.includes('PESSOAL'))return'Pessoal';if(raw.includes('BLAZE'))return'Blaze';if(raw.includes('ADMIN'))return'Admin';if(raw.includes('PR-HIST')||/(^|\s)PR(\s|$)/.test(raw))return'PR';if(raw.includes('CR-HIST')||/(^|\s)CR(\s|$)/.test(raw))return'CR';return company.tradeName??company.legalName;}
export function errorMessage(e:unknown){return e instanceof Error?e.message:'Falha';}
