import type { MeasurementParityModel, MeasurementParityOrigin } from '../infrastructure/LegacyMeasurementParityRepository';

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const safeText=(value:unknown)=>typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'?String(value):'';
function safeFileName(value:string){return value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Medicao';}
export interface PrintMeasurementInput{mode?:'print'|'share';model:MeasurementParityModel|null;activeMeasurementId:string;measurementGross:number;header:Record<string,string>;scope:{tenantId:string;companyId:string};inssValue:number;issValue:number;rtValue:number;measurementNet:number;originLabel:(origin:MeasurementParityOrigin)=>string;setError:(message:string)=>void;}

export function printMeasurement(input:PrintMeasurementInput){
    const {mode='print',model,activeMeasurementId,measurementGross,header,scope,inssValue,issValue,rtValue,measurementNet,originLabel,setError}=input;
    if(!model||!activeMeasurementId||measurementGross<=0)return;
    document.getElementById('measurement-print-root')?.remove();
    document.getElementById('measurement-print-style')?.remove();
    const esc=(value:unknown)=>safeText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
    const orderedOrigins=[...model.origins].sort((a,b)=>{
      const aLabel=originLabel(a);const bLabel=originLabel(b);
      const aTower=/torre\s*(\d+)/i.exec(aLabel);const bTower=/torre\s*(\d+)/i.exec(bLabel);
      if(aTower&&bTower)return Number(aTower[1])-Number(bTower[1]);
      if(aTower)return -1;if(bTower)return 1;
      return aLabel.localeCompare(bLabel,'pt-BR',{numeric:true,sensitivity:'base'});
    });
    const groupedRows=orderedOrigins.map(origin=>{
      const services=origin.services.flatMap(service=>{
        const lines=model.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind===service.targetKind&&line.targetId===service.targetId);
        if(!lines.length)return [];
        const quantity=lines.reduce((sum,line)=>sum+line.measuredQuantity,0);
        const total=lines.reduce((sum,line)=>sum+(line.exactGrossValue??line.measuredQuantity*service.unitPrice),0);
        const previous=model.lines.filter(line=>line.measurementId!==activeMeasurementId&&line.targetKind===service.targetKind&&line.targetId===service.targetId&&['closed','approved'].includes(line.measurementStatus)).reduce((sum,line)=>sum+line.measuredQuantity,0);
        const budgeted=service.contractedQuantity;
        const balance=Math.max(0,budgeted-previous-quantity);
        const referenceSort=(a:string,b:string)=>{const parse=(v:string)=>{const m=v.match(/^(?:TR-)?(\d+)$/i);return m?Number(m[1]):Number.MAX_SAFE_INTEGER;};const an=parse(a),bn=parse(b);return an!==bn?an-bn:a.localeCompare(b,'pt-BR',{numeric:true,sensitivity:'base'});};
        const references=[...new Set(lines.map(line=>line.reference).filter((value):value is string=>Boolean(value)))].sort(referenceSort).join(', ');
        return [{origin:originLabel(origin),code:service.code||'—',description:service.description,unit:service.unit,references,budgeted,quantity,balance,unitPrice:service.unitPrice,total}];
      });
      if(!services.length)return '';
      const subtotal=services.reduce((sum,item)=>sum+item.total,0);
      const rows=services.map(item=>`<tr><td>${esc(item.code)}</td><td>${esc(item.description)}</td><td>${esc(item.unit)}</td><td class="references">${esc(item.references||'—')}</td><td class="num">${esc(item.budgeted.toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td><td class="num">${esc(item.quantity.toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td><td class="num">${esc(item.balance.toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td><td class="num">${esc(currency.format(item.unitPrice))}</td><td class="num strong">${esc(currency.format(item.total))}</td></tr>`).join('');
      return `<section class="print-group" data-origin="${esc(originLabel(origin))}"><div class="print-group-title"><strong>${esc(originLabel(origin))}</strong><strong>Valor da medição: ${esc(currency.format(subtotal))}</strong></div><table><thead><tr><th>Código</th><th>Descrição do serviço</th><th>Un.</th><th>Unidades / apartamentos</th><th class="num">Qtd. contratada</th><th class="num">Qtd. medida</th><th class="num">Saldo</th><th class="num">Valor unit.</th><th class="num">Valor medido</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    }).join('');
    const manualLines=model.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind==='manual');
    const manualRows=manualLines.map(line=>`<tr><td>AVULSO</td><td>${esc(line.manualDescription||'Serviço avulso')}</td><td>${esc(line.manualUnit||'—')}</td><td class="num">${esc(line.measuredQuantity.toLocaleString('pt-BR',{maximumFractionDigits:3}))}</td><td class="num">${esc(currency.format(line.unitPriceSnapshot))}</td><td class="num strong">${esc(currency.format(line.exactGrossValue??line.measuredQuantity*line.unitPriceSnapshot))}</td></tr>`).join('');
    const manualTotal=manualLines.reduce((sum,line)=>sum+(line.exactGrossValue??line.measuredQuantity*line.unitPriceSnapshot),0);
    const manualBlock=manualLines.length?`<section class="print-group"><div class="print-group-title"><strong>SERVIÇOS AVULSOS</strong><strong>Subtotal: ${esc(currency.format(manualTotal))}</strong></div><table><thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead><tbody>${manualRows}</tbody></table></section>`:'';
    const competence=header.competence?new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(`${header.competence}-01T12:00:00`)):'—';
    const formatDate=(value:string)=>{if(!value)return '—';const [y,m,d]=value.split('-');return y&&m&&d?`${d}/${m}/${y}`:value;};
    const root=document.createElement('div');
    root.id='measurement-print-root';
    const companyLogos:Record<string,string>={
      '1ac1cde3-30fa-4fab-9ea0-8afbb34732e5':'/company-cr.webp',
      '68e55f19-6d77-45cf-a86b-6a661f4c285a':'/company-pr.webp',
    };
    const companyLogo=companyLogos[scope.companyId]??'/gestao-brand.svg';
    root.innerHTML=`<div class="watermark"><img src="${companyLogo}" alt=""></div><header class="print-header"><div class="brand"><img id="measurement-print-logo" src="${companyLogo}" alt="Logo da empresa"></div><div class="title"><h1>Medição ${esc(header.measurementNumber||'—')}</h1></div></header><main class="print-content"><section class="meta"><div class="box"><span>Competência</span><strong>${esc(competence)}</strong></div><div class="box"><span>Vencimento previsto</span><strong>${esc(formatDate(header.dueDate??''))}</strong></div><div class="box"><span>Forma de pagamento</span><strong>${esc(header.paymentMethod||'—')}</strong></div></section><section class="financial"><div class="box"><span>Bruto</span><strong>${esc(currency.format(measurementGross))}</strong></div><div class="box"><span>INSS</span><strong>${esc(currency.format(inssValue))}</strong></div><div class="box"><span>ISS</span><strong>${esc(currency.format(issValue))}</strong></div><div class="box"><span>Retenção</span><strong>${esc(currency.format(rtValue))}</strong></div><div class="box net"><span>Líquido</span><strong>${esc(currency.format(measurementNet))}</strong></div></section><h2>Serviços desta medição</h2>${groupedRows}${manualBlock}<div class="obs"><strong>Observações:</strong> ${esc(header.notes||'—')}</div></main>`;
    const style=document.createElement('style');
    style.id='measurement-print-style';
    style.textContent=`#measurement-print-root{position:fixed;left:-100000px;top:0;width:794px;visibility:hidden;background:#fff;color:#111827}@media print{@page{size:A4 portrait;margin:17mm 8mm 8mm}html,body{background:#fff!important}body>*{display:none!important}#measurement-print-root{display:block!important;position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;visibility:visible!important;color:#111827!important;font-family:Arial,Helvetica,sans-serif!important;font-size:9.5px!important}#measurement-print-root *{visibility:visible!important;box-sizing:border-box!important}#measurement-print-root .print-header{display:flex!important;position:fixed!important;top:0!important;left:0!important;right:0!important;height:11mm!important;justify-content:space-between!important;align-items:flex-start!important;border-bottom:2px solid #1d4ed8!important;padding-bottom:4px!important;background:#fff!important;z-index:5!important}#measurement-print-root .print-content{display:block!important}#measurement-print-root .watermark{display:flex!important;position:fixed!important;inset:0!important;align-items:center!important;justify-content:center!important;z-index:0!important;opacity:.055!important;pointer-events:none!important}#measurement-print-root .watermark img{display:block!important;width:105mm!important;max-height:105mm!important;object-fit:contain!important}#measurement-print-root .print-header{z-index:5!important}#measurement-print-root .print-content{position:relative!important;z-index:1!important}#measurement-print-root .brand{display:flex!important;align-items:center!important}#measurement-print-root .brand img{display:block!important;width:155px!important;max-height:46px!important;object-fit:contain!important;object-position:left center!important}#measurement-print-root .title{text-align:right!important}#measurement-print-root .title h1{font-size:15px!important;margin:0 0 2px!important}#measurement-print-root .print-group{display:block!important;border:1px solid #d1d5db!important;border-radius:8px!important;margin:0 0 7px!important;overflow:hidden!important;break-inside:auto!important}#measurement-print-root .print-group-title{display:flex!important;justify-content:space-between!important;padding:5px 7px!important;background:#eef2ff!important;border-bottom:1px solid #d1d5db!important}#measurement-print-root .meta{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:6px!important;margin-bottom:8px!important}#measurement-print-root .box{display:block!important;border:1px solid #d1d5db!important;border-radius:8px!important;padding:6px!important}#measurement-print-root .box span{display:block!important;color:#6b7280!important;font-size:8.5px!important;margin-bottom:3px!important;text-transform:uppercase!important}#measurement-print-root .box strong{font-size:11px!important}#measurement-print-root .financial{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:6px!important;margin:8px 0!important}#measurement-print-root .financial .box{padding:7px!important}#measurement-print-root .financial .net{border-color:#86efac!important;background:#f0fdf4!important}#measurement-print-root h2{font-size:12px!important;margin:9px 0 5px!important}#measurement-print-root table{display:table!important;width:100%!important;border-collapse:collapse!important;table-layout:fixed!important}#measurement-print-root thead{display:table-header-group!important}#measurement-print-root tbody{display:table-row-group!important}#measurement-print-root tr{display:table-row!important;break-inside:avoid!important}#measurement-print-root th,#measurement-print-root td{display:table-cell!important;border-bottom:1px solid #e5e7eb!important;padding:3px 3px!important;vertical-align:top!important;word-wrap:break-word!important}#measurement-print-root th:nth-child(1),#measurement-print-root td:nth-child(1){width:7%!important}#measurement-print-root th:nth-child(2),#measurement-print-root td:nth-child(2){width:23%!important}#measurement-print-root th:nth-child(3),#measurement-print-root td:nth-child(3){width:5%!important}#measurement-print-root th:nth-child(4),#measurement-print-root td:nth-child(4){width:18%!important;font-size:7.5px!important;line-height:1.18!important}#measurement-print-root th:nth-child(5),#measurement-print-root td:nth-child(5),#measurement-print-root th:nth-child(6),#measurement-print-root td:nth-child(6),#measurement-print-root th:nth-child(7),#measurement-print-root td:nth-child(7){width:8%!important}#measurement-print-root th:nth-child(8),#measurement-print-root td:nth-child(8){width:10%!important}#measurement-print-root th:nth-child(9),#measurement-print-root td:nth-child(9){width:13%!important}#measurement-print-root th{background:#f3f4f6!important;text-align:left!important;font-size:8px!important;text-transform:uppercase!important;color:#4b5563!important}#measurement-print-root .num{text-align:right!important}#measurement-print-root .strong{font-weight:700!important}#measurement-print-root .obs{display:block!important;margin-top:8px!important;border:1px solid #e5e7eb!important;border-radius:8px!important;padding:8px!important;min-height:24px!important;break-inside:avoid!important}#measurement-print-root .print-group:last-of-type{margin-bottom:4px!important}#measurement-print-root .print-group+.print-group{break-before:auto!important;page-break-before:auto!important}#measurement-print-root .print-group-title{display:flex!important;justify-content:space-between!important;align-items:center!important;break-after:avoid!important;page-break-after:avoid!important;margin:0 0 4px!important;padding:5px 6px!important;background:#f3f6fb!important;border:1px solid #dbe3ef!important;border-radius:5px!important;font-size:9px!important}#measurement-print-root .print-group table{margin-top:0!important}#measurement-print-root .references{white-space:normal!important;overflow-wrap:anywhere!important}body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}`;
    document.head.appendChild(style);
    document.body.appendChild(root);
    const createPdfFile=async(fileName:string)=>{
      const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
      const mediaStart=style.textContent.indexOf('@media print{');
      const exportCss=mediaStart>=0?style.textContent.slice(mediaStart+'@media print{'.length,-1):'';
      const canvas=await html2canvas(root,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,onclone:doc=>{
        const cloned=doc.getElementById('measurement-print-root');
        if(cloned){cloned.style.position='static';cloned.style.left='0';cloned.style.top='0';cloned.style.width='794px';cloned.style.height='auto';cloned.style.visibility='visible';}
        const exportStyle=doc.createElement('style');exportStyle.textContent=exportCss;doc.head.appendChild(exportStyle);
      }});
      const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
      const pageWidth=210,pageHeight=297,imgWidth=pageWidth,imgHeight=canvas.height*imgWidth/canvas.width;
      let y=0,page=0;
      while(y<imgHeight){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,-y,imgWidth,imgHeight,undefined,'FAST');y+=pageHeight;page++;}
      const blob=pdf.output('blob');return new File([blob],safeFileName(fileName)+'.pdf',{type:'application/pdf'});
    };
    const sharePdf=async()=>{
      const suggested=safeFileName(`Medicao ${header.measurementNumber||activeMeasurementId}`);
      const requested=window.prompt('Nome do arquivo PDF',suggested);if(requested===null)return;
      try{const file=await createPdfFile(requested);const data={files:[file],title:safeFileName(requested)};
        if(!navigator.share||!navigator.canShare?.(data)){setError('Este navegador não permite compartilhar PDF diretamente. Use Imprimir medição para salvar o PDF.');return;}
        await navigator.share(data);
      }catch(cause){if(cause instanceof DOMException&&cause.name==='AbortError')return;setError(cause instanceof Error?cause.message:'Não foi possível compartilhar o PDF.');}
    };
    const trigger=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const previousTitle=document.title;
      const suggested=safeFileName(`Medicao ${header.measurementNumber||activeMeasurementId}`);
      const requested=window.prompt('Nome do arquivo PDF',suggested);
      if(requested===null)return;
      document.title=safeFileName(requested);
      const restoreTitle=()=>{document.title=previousTitle;window.removeEventListener('afterprint',restoreTitle);};
      window.addEventListener('afterprint',restoreTitle,{once:true});
      window.print();
    }));
    const logo=root.querySelector<HTMLImageElement>('#measurement-print-logo');
    const run=()=>setTimeout(()=>{if(mode==='share')void sharePdf();else trigger();},150);
    const failLogo=()=>{root.remove();style.remove();setError('O logo da empresa não pôde ser renderizado. A impressão foi cancelada para não gerar um documento sem identificação.');};
    if(!logo){failLogo();return;}
    if(logo.complete){if(logo.naturalWidth>0)run();else failLogo();}
    else{logo.addEventListener('load',run,{once:true});logo.addEventListener('error',failLogo,{once:true});}
    // Deliberately keep the print DOM alive. Android's print spooler can snapshot
    // the page after window.print()/afterprint returns; removing it early creates
    // a blank PDF preview. It is removed on the next print invocation instead.
  }
