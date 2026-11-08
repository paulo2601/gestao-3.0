/**
 * Import the official CAEPI CSV supplied by MTE into Supabase.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-caepi.mjs ./caepi.csv
 * Do not commit the CSV or the service-role key. The source must be verified before importing.
 */
import { readFileSync } from 'node:fs';
const OFFICIAL_CSV='https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/equipamentos-de-protecao-individual-epi/base-de-dados-do-caepi-19052025.csv/@@download/file';
const file=process.argv[2];
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente privado.');
let raw;
if(file){raw=readFileSync(file,'utf8')}else{const response=await fetch(OFFICIAL_CSV,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('Falha ao obter CSV oficial: HTTP '+response.status);raw=await response.text()}
raw=raw.replace(/^\uFEFF/,'');
function parse(text){
 const firstLine=text.split(/\r?\n/,1)[0];const separator=firstLine.includes(';')?';':firstLine.includes('|')?'|':',';
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
 if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
 else if(!quoted&&(c===separator||c==='\n'||c==='\r')){if(c===separator ){row.push(cell);cell=''}else{if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell=''}}
 else cell+=c;
 }
 row.push(cell);if(row.some(Boolean))rows.push(row);return rows;
}
const rows=parse(raw);const header=rows.shift().map(x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''));
function col(...aliases){return header.findIndex(h=>aliases.some(a=>h===a||h.includes(a)))}
const idx={ca:col('numeroca','nroca','noca','certificadodeaprovacao','ca'),equipment:col('equipamento','descricaoepi','descricaoequipamento','descricaodoequipamento'),manufacturer:col('razaosocial','fabricante','importador'),model:col('modelo','referencia'),expires:col('validade','datavalidade'),situation:col('situacao','status')};
if(idx.ca<0||idx.equipment<0)throw Error('Colunas de CA/equipamento não identificadas: '+JSON.stringify(header));
const value=(row,index)=>index<0?'':(row[index]||'').trim();
const date=(s)=>{const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:/^\d{4}-\d{2}-\d{2}$/.test(s)?s:null};
const entries=new Map();
for(const row of rows){const ca=value(row,idx.ca).replace(/\D/g,'');const equipment=value(row,idx.equipment);if(!ca||!equipment)continue;
entries.set(ca,{ca_number:ca,equipment,manufacturer:value(row,idx.manufacturer)||null,model:value(row,idx.model)||null,expires_on:date(value(row,idx.expires)),situation:value(row,idx.situation)||null,source_updated_at:new Date('2025-05-19T00:00:00Z').toISOString()});}
if(entries.size<1000)throw Error('Importação interrompida: base parece incompleta ('+entries.size+' registros)');
const url=process.env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/hr_epi_ca_catalog?on_conflict=ca_number';
const records=[...entries.values()];
for(let i=0;i<records.length;i+=250){const response=await fetch(url,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(records.slice(i,i+250))});if(!response.ok)throw Error('Erro no lote '+i+': '+response.status+' '+await response.text());}
console.log('Fonte: '+(file||OFFICIAL_CSV));console.log('Importados '+entries.size+' CAs. Confira a origem e a data de atualização antes de usar como verificação oficial.');
