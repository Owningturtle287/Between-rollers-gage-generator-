import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editNumber,draftValue} from '../src/core/number-entry.mjs';
const type=(initial,keys)=>keys.reduce((s,key,i)=>editNumber(s,key,i===0),initial);

test('a new entry replaces the old dimension and retains decimal precision',()=>{
  const draft=type('4.3246',['0','decimal','0','2','5']);assert.equal(draft,'0.025');assert.equal(draftValue(draft),.025);
});
test('signed printer compensation can be entered and toggled',()=>{
  let draft=type('0',['decimal','0','1']);draft=editNumber(draft,'sign');assert.equal(draft,'-0.01');assert.equal(draftValue(draft),-.01);assert.equal(editNumber(draft,'sign'),'0.01');
});
test('backspace removes one character and clear does not commit an empty value',()=>{
  assert.equal(editNumber('12.75','backspace',true),'12.7');assert.equal(editNumber('12.7','clear'),'');assert.equal(draftValue(''),null);assert.equal(draftValue('-'),null);
});
test('a second decimal and unsupported characters cannot corrupt a number',()=>{
  assert.equal(editNumber('0.025','decimal'),'0.025');assert.equal(editNumber('0.025','x'),'0.025');assert.equal(editNumber('-','decimal'),'-0.');assert.equal(draftValue('1e10'),null);assert.equal(draftValue('0.'),0);
});
