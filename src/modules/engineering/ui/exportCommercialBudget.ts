import { jsPDF } from 'jspdf';
import type { EngineeringCommercialBudget } from '../infrastructure/EngineeringCommercialBudgetRepository';

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const quantity=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const blue:[number,number,number]=[20,49,86];
const gray:[number,number,number]=[239,242,245];
const margin=17;
const pageBottom=273;
type BudgetPdf=InstanceType<typeof jsPDF>;

async function companyLogo():Promise<string|null>{
 try{
  const response=await fetch('/company-cr.svg',{cache:'no-store'});
  if(!response.ok)return null;
  const svg=await response.text();
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{
   const img=new Image();
   await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Logo indisponível'));img.src=url;});
   const canvas=document.createElement('canvas');canvas.width=1040;canvas.height=320;
   const ctx=canvas.getContext('2d');if(!ctx)return null;
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1040,320);ctx.drawImage(img,0,0,1040,320);
   return canvas.toDataURL('image/png');
  }finally{URL.revokeObjectURL(url);}
 }catch{return null;}
}
function drawHeader(pdf:BudgetPdf,logo:string|null,page:number){
 pdf.setFillColor(255,255,255);pdf.rect(0,0,210,297,'F');
 if(logo)pdf.addImage(logo,'PNG',margin,10,63,19);
 else{pdf.setTextColor(...blue);pdf.setFont('helvetica','bold');pdf.setFontSize(18);pdf.text('CR ENGENHARIA',margin,22);}
 pdf.setDrawColor(...blue);pdf.setLineWidth(.5);pdf.line(margin,34,210-margin,34);
 pdf.setDrawColor(170,180,192);pdf.setLineWidth(.25);pdf.line(margin,283,210-margin,283);
 pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(95,107,122);
 pdf.text('CR Engenharia  |  Proposta comercial',margin,288);
 pdf.text(String(page),210-margin,288,{align:'right'});
 pdf.setTextColor(30,41,59);
}
function addLines(pdf:BudgetPdf,value:string,x:number,y:number,maxWidth:number,fontSize=9,lineHeight=4.7):number{
 pdf.setFontSize(fontSize);
 const lines=pdf.splitTextToSize(value||'-',maxWidth) as string[];
 for(const line of lines){pdf.text(line,x,y);y+=lineHeight;}
 return y;
}
async function makePdf(b:EngineeringCommercialBudget):Promise<Blob>{
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 const logo=await companyLogo();
 let page=1,y=43;
 drawHeader(pdf,logo,page);
 function nextPage(){pdf.addPage();page++;drawHeader(pdf,logo,page);y=43;}
 function ensure(height:number){if(y+height>pageBottom)nextPage();}
 pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.setTextColor(...blue);
 y=addLines(pdf,b.title||'ORÇAMENTO',margin,y,176,14,7)+3;
 pdf.setTextColor(30,41,59);pdf.setFont('helvetica','normal');
 const meta=[['Cliente',b.customer],['Obra / projeto',b.project],['Emitente',b.issuer],['Data de emissão',b.issueDate],['Validade',String(b.validityDays)+' dias'],['Situação',b.status]];
 for(const [label,value] of meta){ensure(7);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.text(label+':',margin,y);pdf.setFont('helvetica','normal');y=addLines(pdf,value||'-',margin+34,y,140,9,4.8)+2;}
 y+=5;
 const col={service:margin+2,qty:127,unit:143,price:171,total:191};
 function tableHeader(){
  ensure(10);pdf.setFillColor(...blue);pdf.rect(margin,y,176,9,'F');
  pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(8);
  pdf.text('SERVIÇO',col.service,y+5.8);
  pdf.text('QTD.',col.qty,y+5.8,{align:'right'});
  pdf.text('UN.',col.unit,y+5.8,{align:'right'});
  pdf.text('UNITÁRIO',col.price,y+5.8,{align:'right'});
  pdf.text('TOTAL',col.total,y+5.8,{align:'right'});
  pdf.setTextColor(30,41,59);y+=9;
 }
 tableHeader();
 for(const [index,item] of b.items.entries()){
  pdf.setFont('helvetica','normal');pdf.setFontSize(8);
  const lines=pdf.splitTextToSize(item.description||'-',104) as string[];
  const height=Math.max(8,lines.length*4.1+3);
  if(y+height>pageBottom){nextPage();tableHeader();}
  if(index%2===1){pdf.setFillColor(...gray);pdf.rect(margin,y,176,height,'F');}
  pdf.setFontSize(8);pdf.setTextColor(30,41,59);
  lines.forEach((line,i)=>pdf.text(line,col.service,y+5+i*4.1));
  pdf.text(quantity.format(item.quantity),col.qty,y+5,{align:'right'});
  pdf.text(item.unit||'-',col.unit,y+5,{align:'right'});
  pdf.text(money.format(item.unitPrice),col.price,y+5,{align:'right'});
  pdf.setFont('helvetica','bold');pdf.text(money.format(item.quantity*item.unitPrice),col.total,y+5,{align:'right'});
  y+=height;
 }
 ensure(18);y+=5;
 pdf.setFillColor(...blue);pdf.roundedRect(101,y,92,12,1.5,1.5,'F');
 pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(11);
 pdf.text('TOTAL: '+money.format(b.total),190,y+8,{align:'right'});pdf.setTextColor(30,41,59);y+=20;
 function section(title:string,value:string){
  if(!value.trim())return;
  ensure(16);pdf.setFont('helvetica','bold');pdf.setFontSize(9);pdf.setTextColor(...blue);pdf.text(title,margin,y);y+=6;
  pdf.setFont('helvetica','normal');pdf.setTextColor(30,41,59);pdf.setFontSize(9);
  const lines=pdf.splitTextToSize(value,176) as string[];
  for(const line of lines){ensure(5);pdf.text(line,margin,y);y+=5;}
  y+=5;
 }
 section('CONDIÇÕES DE PAGAMENTO',b.paymentTerms||'');
 section('OBSERVAÇÕES',b.notes||'');
 return pdf.output('blob');
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
 }else{const a=document.createElement('a');a.href=url;a.download=filename;a.click();}
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
