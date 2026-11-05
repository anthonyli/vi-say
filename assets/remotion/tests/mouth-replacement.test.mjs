import {test} from 'node:test';
import assert from 'node:assert/strict';
import {closedMouthOpacity} from '../cartoon-motion.mjs';

test('mouth replacement is opaque and holds its state through ambiguous energy',()=>{
  const energy=[0,.18,.29,.21,.15,.1,.2,.4,0];
  assert.deepEqual(energy.map((_,i)=>closedMouthOpacity(energy,i)),[1,1,0,0,0,1,1,0,1]);
  for(const i of [8,2,6,0,5]) assert.ok([0,1].includes(closedMouthOpacity(energy,i)));
  assert.equal(closedMouthOpacity([],0),0);
  assert.equal(closedMouthOpacity(energy,99),1);
});
