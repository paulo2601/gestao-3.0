import type { CompanySummary } from '../../platform/domain/AccessContext';

function normalizeSearch(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
function smartMatches(values:Array<string|null|undefined>,query:string){const q=normalizeSearch(query);if(!q)return true;const tokens=q.split(/\s+/).filter(Boolean);const searchable=normalizeSearch(values.filter(Boolean).join(' '));const words=searchable.split(/\s+/).filter(Boolean);return tokens.every(t=>words.some(w=>w.startsWith(t))||searchable.includes(t));}
function localToday(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function addDays(value:string,days:number){const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()+days);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function messageFrom(error: unknown){return error instanceof Error&&error.message?error.message:'Não foi possível concluir a operação.';}


