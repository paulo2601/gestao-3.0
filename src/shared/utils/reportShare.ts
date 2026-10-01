export function safeReportFileName(value:string){return value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'Relatorio';}

export async function sharePrintableElement(element:HTMLElement,suggestedName:string,orientation:'portrait'|'landscape'='portrait',shareWindow:Window=window){
  const requested=shareWindow.prompt('Nome do arquivo PDF',safeReportFileName(suggestedName));if(requested===null)return;
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
  const hidden=[...element.querySelectorAll<HTMLElement>('.print,.share-pdf,.report-actions,.report-action,.statement-view__footer-actions,.statement-view__actions,.statement-view__period,.statement-view__filters')].map(node=>[node,node.style.display] as const);hidden.forEach(([node])=>{node.style.display='none';});let canvas:HTMLCanvasElement;try{canvas=await html2canvas(element,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false});}finally{hidden.forEach(([node,display])=>{node.style.display=display;});}
  const portrait=orientation==='portrait',pageWidth=portrait?210:297,pageHeight=portrait?297:210,margin=8,imgWidth=pageWidth-margin*2,imgHeight=canvas.height*imgWidth/canvas.width;
  const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});let y=0,page=0;const usable=pageHeight-margin*2;
  while(y<imgHeight){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',margin,margin-y,imgWidth,imgHeight,undefined,'FAST');y+=usable;page++;}
  const name=safeReportFileName(requested);const file=new File([pdf.output('blob')],name+'.pdf',{type:'application/pdf'});const data={files:[file],title:name};
  // Relatórios podem estar em about:blank. No Android/PWA essa janela secundária
  // frequentemente não expõe Web Share com arquivos, embora a janela principal exponha.
  // Prioriza o contexto principal do app e mantém a janela do relatório como fallback.
  const navigators=[window.navigator,shareWindow.navigator].filter((nav,index,list)=>list.indexOf(nav)===index);
  for(const nav of navigators){
    if(!('share' in nav)||nav.canShare?.(data)!==true)continue;
    await nav.share(data);
    return;
  }
  throw new Error('Este navegador não permite compartilhar PDF diretamente.');
}

export function installReportShareButton(reportWindow:Window,suggestedName:string,orientation:'portrait'|'landscape'='portrait'){
  const doc=reportWindow.document;doc.querySelectorAll('body > button').forEach(node=>node.classList.add('report-action'));const bar=doc.createElement('div');bar.className='report-actions';bar.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px';
  const printButton=doc.createElement('button');printButton.type='button';printButton.textContent='Imprimir / Salvar PDF';printButton.style.cssText='padding:9px 14px;border:1px solid #2563eb;border-radius:7px;background:#2563eb;color:#fff;font:600 14px Arial;cursor:pointer';printButton.onclick=()=>reportWindow.print();
  const shareButton=doc.createElement('button');shareButton.type='button';shareButton.textContent='Compartilhar PDF';shareButton.style.cssText='padding:9px 14px;border:1px solid #2563eb;border-radius:7px;background:#fff;color:#2563eb;font:600 14px Arial;cursor:pointer';shareButton.onclick=()=>{void sharePrintableElement(doc.body,suggestedName,orientation,reportWindow).catch(error=>reportWindow.alert(error instanceof Error?error.message:'Não foi possível compartilhar o PDF.'));};
  const style=doc.createElement('style');style.textContent='@media print{.report-actions,.report-action{display:none!important}}';doc.head.appendChild(style);doc.querySelectorAll<HTMLElement>('body > .report-action').forEach(node=>{node.style.display='none';});bar.append(printButton,shareButton);doc.body.insertBefore(bar,doc.body.firstChild);
}

export async function sharePrintRoot(root:HTMLElement,printStyle:HTMLStyleElement,suggestedName:string,orientation:'portrait'|'landscape'='portrait',renderWidth=794){
  const requested=window.prompt('Nome do arquivo PDF',safeReportFileName(suggestedName));if(requested===null)return;
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);const css=printStyle.textContent??'',start=css.indexOf('@media print{'),exportCss=start>=0?css.slice(start+'@media print{'.length,-1):css;
  const canvas=await html2canvas(root,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:renderWidth,onclone:doc=>{const cloned=doc.getElementById(root.id);if(cloned){cloned.style.position='static';cloned.style.left='0';cloned.style.top='0';cloned.style.width=renderWidth+'px';cloned.style.height='auto';cloned.style.visibility='visible';}const s=doc.createElement('style');s.textContent=exportCss;doc.head.appendChild(s);}});
  const portrait=orientation==='portrait',pageWidth=portrait?210:297,pageHeight=portrait?297:210,margin=8,imgWidth=pageWidth-margin*2,imgHeight=canvas.height*imgWidth/canvas.width,usable=pageHeight-margin*2;const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});let y=0,page=0;while(y<imgHeight){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',margin,margin-y,imgWidth,imgHeight,undefined,'FAST');y+=usable;page++;}const name=safeReportFileName(requested),file=new File([pdf.output('blob')],name+'.pdf',{type:'application/pdf'}),data={files:[file],title:name};if(!navigator.share||!navigator.canShare?.(data))throw new Error('Este navegador não permite compartilhar PDF diretamente.');await navigator.share(data);
}
