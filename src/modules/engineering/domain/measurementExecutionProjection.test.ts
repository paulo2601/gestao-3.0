import { describe, expect, it } from 'vitest';
import { chooseActiveExecutionMeasurement, deriveExecutionProjection } from './measurementExecutionProjection';
import type { MeasurementParityModel } from '../infrastructure/LegacyMeasurementParityRepository';

const model:MeasurementParityModel={
 contractId:'contract',legacyContractId:'legacy',enterpriseType:'towers',houses:[],
 measurements:[
  {id:'m008',measurementNumber:'008',competence:'2026-09-01',status:'approved'},
  {id:'m009',measurementNumber:'009',competence:'2026-10-01',status:'draft'},
  {id:'m010',measurementNumber:'010',competence:'2026-11-01',status:'draft'}
 ],
 origins:[{id:'tower4',name:'Torre 4',type:'tower',floorCount:10,hasGround:false,unitsPerFloor:8,modes:[],
  services:[{legacyServiceId:'service',code:'26.1',name:'26.1 - Esgoto',description:'Rede de esgoto',unit:'un',contractedQuantity:96,unitPrice:100,scopeActive:true,startFloor:null,scopeFloors:[],scopeUnits:[],targetKind:'contract',targetId:'service'}]}],
 lines:[
  {id:'old',measurementId:'m008',measurementStatus:'approved',targetKind:'contract',targetId:'service',measuredQuantity:5,exactGrossValue:null,manualDescription:null,manualUnit:null,unitPriceSnapshot:100,reference:'1101',notes:null},
  {id:'apt1101',measurementId:'m009',measurementStatus:'draft',targetKind:'contract',targetId:'service',measuredQuantity:1,exactGrossValue:100,manualDescription:null,manualUnit:null,unitPriceSnapshot:100,reference:'1101',notes:null},
  {id:'apt1102',measurementId:'m009',measurementStatus:'draft',targetKind:'contract',targetId:'service',measuredQuantity:1,exactGrossValue:100,manualDescription:null,manualUnit:null,unitPriceSnapshot:100,reference:'1102',notes:null},
  {id:'next',measurementId:'m010',measurementStatus:'draft',targetKind:'contract',targetId:'service',measuredQuantity:2,exactGrossValue:null,manualDescription:null,manualUnit:null,unitPriceSnapshot:100,reference:'1201',notes:null}
 ]
};
describe('execução derivada da medição financeira',()=>{
 it('usa somente os itens da medição escolhida sem agrupar apartamentos distintos',()=>{
  const rows=deriveExecutionProjection(model,'m009');
  expect(rows.map(row=>[row.measurementLineId,row.reference,row.plannedQuantity])).toEqual([
   ['apt1101','1101',1],['apt1102','1102',1]
  ]);
  expect(rows.reduce((sum,row)=>sum+row.plannedValue,0)).toBe(200);
 });
 it('não usa medição inexistente',()=>expect(deriveExecutionProjection(model,'invalid')).toEqual([]));
 it('seleciona o rascunho mais recente como medição ativa',()=>expect(chooseActiveExecutionMeasurement(model)).toBe('m010'));
 it('não modifica os dados financeiros originais',()=>{
  const before=JSON.stringify(model.lines);
  deriveExecutionProjection(model,'m009');
  expect(JSON.stringify(model.lines)).toBe(before);
 });
});
