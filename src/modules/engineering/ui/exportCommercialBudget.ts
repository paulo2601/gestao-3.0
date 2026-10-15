import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { EngineeringCommercialBudget } from '../infrastructure/EngineeringCommercialBudgetRepository';

const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const esc = (v:unknown) => (typeof v==='string'?v:typeof v==='number'||typeof v==='boolean'?String(v):'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));
function report(b:EngineeringCommercialBudget):HTMLDivElement {
 const root=document.createElement('div');
 root.style.cssText='position:fixed;left:-20000px;top:0;width:794px;box-sizing:border-box;padding:46px 48px;background:white;color:#172638;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;z-index:-1';
 root.innerHTML=`<header style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #153b66;padding-bottom:18px;margin-bottom:22px"><img src="/company-cr.svg" alt="CR Engenharia" style="width:225px;height:70px;object-fit:contain"/><div style="text-align:right"><strong style="font-size:19px">ORÇAMENTO</strong><div>${esc(b.status)}</div></div></header>
 <h1 style="font-size:20px;margin:0 0 16px">${esc(b.title)}</h1>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px"><div><b>Cliente:</b> ${esc(b.customer)}</div><div><b>Emissão:</b> ${esc(b.issueDate)}</div><div><b>Obra:</b> ${esc(b.project)}</div><div><b>Validade:</b> ${esc(b.validityDays)} dias</div><div><b>Emitente:</b> ${esc(b.issuer)}</div></div>
 <table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#153b66;color:white"><th style="padding:9px;text-align:left">Serviço</th><th>Qtd.</th><th>Un.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${b.items.map((i,n)=>`<tr style="background:${n%2?'#f1f5f9':'white'};border-bottom:1px solid #ddd"><td style="padding:8px">${esc(i.description)}</td><td style="text-align:center">${esc(i.quantity)}</td><td style="text-align:center">${esc(i.unit)}</td><td style="text-align:right;padding:8px">${money.format(i.unitPrice)}</td><td style="text-align:right;padding:8px">${money.format(i.quantity*i.unitPrice)}</td></tr>`).join('')}</tbody></table>
 <div style="text-align:right;font-size:17px;font-weight:bold;margin-top:18px">TOTAL: ${money.format(b.total)}</div>
 ${b.paymentTerms?`<p><b>Condições de pagamento:</b> ${esc(b.paymentTerms)}</p>`:''}
 ${b.notes?`<p style="white-space:pre-wrap"><b>Observações:</b> ${esc(b.notes)}</p>`:''}
 <footer style="border-top:1px solid #ccc;margin-top:30px;padding-top:10px;font-size:10px;color:#666">CR Engenharia · Proposta comercial</footer>`;
 document.body.appendChild(root);return root;
}
async function makePdf(b:EngineeringCommercialBudget):Promise<Blob>{
 const root=report(b);
 try {
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img=>img.decode().catch(()=>undefined)));
  const canvas=await html2canvas(root,{scale:2,backgroundColor:'#ffffff',useCORS:true,windowWidth:900});
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const pageWidth=210,pageHeight=297,contentHeight=canvas.width*pageHeight/pageWidth;
  const pages=Math.max(1,Math.ceil(contentHeight/pageHeight));
  const img=canvas.toDataURL('image/png');
  for(let page=0;page<pages;page++){if(page)pdf.addPage();pdf.addImage(img,'PNG',0,-page*pageHeight,pageWidth,contentHeight);}
  return pdf.output('blob');
 }finally{root.remove();}
}
export async function exportCommercialBudget(b:EngineeringCommercialBudget,mode:'print'|'share'):Promise<void>{
 const pdf=await makePdf(b);
 const filename='Orcamento-'+(b.title||'CR-Engenharia').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-')+'.pdf';
 const file=new File([pdf],filename,{type:'application/pdf'});
 if(mode==='share'&&navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:b.title});return;}
 const url=URL.createObjectURL(pdf);
 if(mode==='print'){
  const win=window.open(url,'_blank');
  if(!win){const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
 }else{
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 }
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
