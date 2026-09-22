import { describe, expect, it } from 'vitest';
import { buildMeasurementReferences } from './measurementStructure';

const tower=(name:string,floorCount:number,hasGround:boolean,unitsPerFloor:number)=>({
  name,type:'tower' as const,floorCount,hasGround,unitsPerFloor,enterpriseType:'apartamentos',houses:[],
});

describe('measurement structure references',()=>{
  it('builds Tower 4 from explicit structure configuration',()=>{
    const references=buildMeasurementReferences(tower('TORRE 4',11,true,8));
    expect(references).toHaveLength(96);
    expect(references.slice(0,8)).toEqual(['TR-01','TR-02','TR-03','TR-04','TR-05','TR-06','TR-07','TR-08']);
    expect(references.slice(-8)).toEqual(['1101','1102','1103','1104','1105','1106','1107','1108']);
  });

  it('builds Tower 6 from the same structural rule without tower-specific branches',()=>{
    const references=buildMeasurementReferences(tower('TORRE 6',10,true,8));
    expect(references).toHaveLength(88);
    expect(references).not.toContain('1201');
  });

  it('does not infer apartment count from service quantity when structure is unconfigured',()=>{
    expect(buildMeasurementReferences(tower('TORRE FUTURA',10,true,0))).toEqual([]);
  });
});
