import fs from 'node:fs';

const path = 'src/modules/engineering/ui/GuidedMeasurementFlow.tsx';
let source = fs.readFileSync(path, 'utf8');

const oldOpenService = `function openService(index:number){setServiceIndex(index);setSearch('');setError(null);setAddendumMeasureMode('quantity');const item=stages[index];const lines=model?.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind===item?.targetKind&&line.targetId===item?.targetId)??[];setManualQuantity(lines.length&&item&&!stageReferences(model!,origin!,item).length?String(lines.reduce((sum,line)=>sum+line.measuredQuantity,0)).replace('.',','):'');setServiceEditOpen(true);setUnitPickerOpen(false);} function openUnitEditor(){setSelectedUnits(currentLines.map(line=>line.reference).filter((value):value is string=>Boolean(value)));setSearch('');setError(null);setUnitPickerOpen(true);}`;

const newOpenService = `function openService(index:number){setServiceIndex(index);setSearch('');setError(null);setAddendumMeasureMode('quantity');const item=stages[index];const lines=model?.lines.filter(line=>line.measurementId===activeMeasurementId&&line.targetKind===item?.targetKind&&line.targetId===item?.targetId)??[];const itemRefs=item&&model&&origin?stageReferences(model,origin,item):[];if(itemRefs.length>0&&origin?.type!=='addendum'){setSelectedUnits(lines.map(line=>line.reference).filter((value):value is string=>Boolean(value)));setManualQuantity('');setServiceEditOpen(false);setUnitPickerOpen(true);return;}setManualQuantity(lines.length&&item&&!itemRefs.length?String(lines.reduce((sum,line)=>sum+line.measuredQuantity,0)).replace('.',','):'');setServiceEditOpen(true);setUnitPickerOpen(false);} function openUnitEditor(){setSelectedUnits(currentLines.map(line=>line.reference).filter((value):value is string=>Boolean(value)));setSearch('');setError(null);setServiceEditOpen(false);setUnitPickerOpen(true);}`;

if (!source.includes(newOpenService)) {
  if (!source.includes(oldOpenService)) throw new Error('Trecho openService não encontrado; correção não aplicada.');
  source = source.replace(oldOpenService, newOpenService);
}

const oldUnitButton = `{itemRefs.length>0?<Button size="sm" onClick={event=>{event.stopPropagation();openService(index);}}>Editar apartamentos/unidades</Button>:<Button size="sm" onClick={event=>{event.stopPropagation();openService(index);}}>Editar quantidade</Button>}`;
const newUnitButton = `{itemRefs.length>0?<Button size="sm" onClick={event=>{event.stopPropagation();openService(index);}}>{current>0?'Editar unidades':'Adicionar unidades'}</Button>:<Button size="sm" onClick={event=>{event.stopPropagation();openService(index);}}>{current>0?'Editar quantidade':'Adicionar quantidade'}</Button>}`;

if (!source.includes(newUnitButton)) {
  if (!source.includes(oldUnitButton)) throw new Error('Botão de unidades não encontrado; correção não aplicada.');
  source = source.replace(oldUnitButton, newUnitButton);
}

const oldEditorButton = `<Button className="measurement-service-editor__units" onClick={openUnitEditor}>Editar apartamentos/unidades</Button>`;
const newEditorButton = `<Button className="measurement-service-editor__units" onClick={openUnitEditor}>{currentLines.length>0?'Editar unidades':'Adicionar unidades'}</Button>`;
if (!source.includes(newEditorButton) && source.includes(oldEditorButton)) source = source.replace(oldEditorButton, newEditorButton);

fs.writeFileSync(path, source);
console.log('Correção do seletor de unidades aplicada.');
