export function safeReportFileName(value:string){return value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Relatorio';}

export async function sharePrintableElement(element:HTMLElement,suggestedName:string,orientation:'portrait'|'landscape'='portrait'){
  const requested=window.prompt('Nome do arquivo PDF',safeReportFileName(suggestedName));if(requested===null)return;
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
  const hidden=[...element.querySelectorAll<HTMLElement>('.print,.share-pdf')].map(node=>[node,node.style.display] as const);hidden.forEach(([node])=>{node.style.display='none';});const canvas=await html2canvas(element,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});hidden.forEach(([node,display])=>{node.style.display=display;});
  const portrait=orientation==='portrait',pageWidth=portrait?210:297,pageHeight=portrait?297:210,margin=8,imgWidth=pageWidth-margin*2,imgHeight=canvas.height*imgWidth/canvas.width;
  const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});let y=0,page=0;const usable=pageHeight-margin*2;
  while(y<imgHeight){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',margin,margin-y,imgWidth,imgHeight,undefined,'FAST');y+=usable;page++;}
  const name=safeReportFileName(requested);const file=new File([pdf.output('blob')],name+'.pdf',{type:'application/pdf'});const data={files:[file],title:name};
  if(!navigator.share||!navigator.canShare?.(data))throw new Error('Este navegador não permite compartilhar PDF diretamente.');
  await navigator.share(data);
}

export function installReportShareButton(reportWindow:Window,suggestedName:string,orientation:'portrait'|'landscape'='portrait'){
  const doc=reportWindow.document;const button=doc.createElement('button');button.type='button';button.className='share-pdf';button.textContent='Compartilhar PDF';
  button.style.cssText='padding:9px 14px;margin:0 0 8px 8px;border:1px solid #2563eb;border-radius:7px;background:#fff;color:#2563eb;font:600 14px Arial;cursor:pointer';
  const style=doc.createElement('style');style.textContent='@media print{.share-pdf{display:none!important}}';doc.head.appendChild(style);
  button.onclick=()=>{void sharePrintableElement(doc.body,suggestedName,orientation).catch(error=>reportWindow.alert(error instanceof Error?error.message:'Não foi possível compartilhar o PDF.'));};
  doc.body.insertBefore(button,doc.body.firstChild);
}
