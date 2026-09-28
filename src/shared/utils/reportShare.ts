export function safeReportFileName(value:string){return value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Relatorio';}

export async function sharePrintableElement(element:HTMLElement,suggestedName:string,orientation:'portrait'|'landscape'='portrait'){
  const requested=window.prompt('Nome do arquivo PDF',safeReportFileName(suggestedName));if(requested===null)return;
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
  const hidden=[...element.querySelectorAll<HTMLElement>('.print,.share-pdf,.statement-view__footer-actions,.statement-view__actions,.statement-view__period,.statement-view__filters')].map(node=>[node,node.style.display] as const);hidden.forEach(([node])=>{node.style.display='none';});let canvas:HTMLCanvasElement;try{canvas=await html2canvas(element,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});}finally{hidden.forEach(([node,display])=>{node.style.display=display;});}
  const portrait=orientation==='portrait',pageWidth=portrait?210:297,pageHeight=portrait?297:210,margin=8,imgWidth=pageWidth-margin*2,imgHeight=canvas.height*imgWidth/canvas.width;
  const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});let y=0,page=0;const usable=pageHeight-margin*2;
  while(y<imgHeight){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',margin,margin-y,imgWidth,imgHeight,undefined,'FAST');y+=usable;page++;}
  const name=safeReportFileName(requested);const file=new File([pdf.output('blob')],name+'.pdf',{type:'application/pdf'});const data={files:[file],title:name};
  if(!navigator.share||!navigator.canShare?.(data))throw new Error('Este navegador não permite compartilhar PDF diretamente.');
  await navigator.share(data);
}

export function installReportShareButton(reportWindow:Window,suggestedName:string,orientation:'portrait'|'landscape'='portrait'){
  const doc=reportWindow.document;doc.querySelectorAll('body > button').forEach(node=>node.classList.add('print'));const button=doc.createElement('button');button.type='button';button.className='share-pdf';button.textContent='Compartilhar PDF';
  button.style.cssText='padding:9px 14px;margin:0 0 8px 8px;border:1px solid #2563eb;border-radius:7px;background:#fff;color:#2563eb;font:600 14px Arial;cursor:pointer';
  const style=doc.createElement('style');style.textContent='@media print{.share-pdf{display:none!important}}';doc.head.appendChild(style);
  button.onclick=()=>{void sharePrintableElement(doc.body,suggestedName,orientation).catch(error=>reportWindow.alert(error instanceof Error?error.message:'Não foi possível compartilhar o PDF.'));};
  doc.body.insertBefore(button,doc.body.firstChild);
}

export async function sharePrintRoot(root:HTMLElement,printStyle:HTMLStyleElement,suggestedName:string,orientation:'portrait'|'landscape'='portrait',renderWidth=794){
  const requested=window.prompt('Nome do arquivo PDF',safeReportFileName(suggestedName));if(requested===null)return;
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);const css=printStyle.textContent??'',start=css.indexOf('@media print{'),exportCss=start>=0?css.slice(start+'@media print{'.length,-1):css;
  const canvas=await html2canvas(root,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:renderWidth,onclone:doc=>{const cloned=doc.getElementById(root.id);if(cloned){cloned.style.position='static';cloned.style.left='0';cloned.style.top='0';cloned.style.width=renderWidth+'px';cloned.style.height='auto';cloned.style.visibility='visible';}const s=doc.createElement('style');s.textContent=exportCss;doc.head.appendChild(s);}});
  const portrait=orientation==='portrait',pageWidth=portrait?210:297,pageHeight=portrait?297:210,margin=8,imgWidth=pageWidth-margin*2,imgHeight=canvas.height*imgWidth/canvas.width,usable=pageHeight-margin*2;const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});let y=0,page=0;while(y<imgHeight){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',margin,margin-y,imgWidth,imgHeight,undefined,'FAST');y+=usable;page++;}const name=safeReportFileName(requested),file=new File([pdf.output('blob')],name+'.pdf',{type:'application/pdf'}),data={files:[file],title:name};if(!navigator.share||!navigator.canShare?.(data))throw new Error('Este navegador não permite compartilhar PDF diretamente.');await navigator.share(data);
}
