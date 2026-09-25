import type { CompanySummary } from '../../platform/domain/AccessContext';

export function companyLabel(company: CompanySummary): string { const raw=`${company.tradeName??''} ${company.legalName}`.toLocaleUpperCase('pt-BR'); if(raw.includes('PESSOAL'))return'Pessoal'; if(raw.includes('PR-HIST')||/(^|\s)PR(\s|$)/.test(raw))return'PR'; if(raw.includes('CR-HIST')||/(^|\s)CR(\s|$)/.test(raw))return'CR'; return company.tradeName??company.legalName; }
export function normalizeSearch(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
export function smartMatches(values:Array<string|null|undefined>,query:string){const q=normalizeSearch(query);if(!q)return true;const tokens=q.split(/\s+/).filter(Boolean);const searchable=normalizeSearch(values.filter(Boolean).join(' '));const words=searchable.split(/\s+/).filter(Boolean);return tokens.every(t=>words.some(w=>w.startsWith(t))||searchable.includes(t));}
export function localToday(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function addDays(value:string,days:number){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function messageFrom(error: unknown){return error instanceof Error&&error.message?error.message:'Não foi possível concluir a operação.';}


