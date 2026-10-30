import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activatesPadKey,editNumber,draftValue} from '../src/core/number-entry.mjs';
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

test('rapid taps register once each without waiting for a compatibility click',()=>{
  for(const pointerType of ['touch','pen','mouse']){
    let draft='4',replaceAll=true,accepted=0;
    for(const key of ['0','decimal','0','0','0','3','0','0','0']){
      for(const event of [{type:'pointerdown',button:0,pointerType},{type:'click',detail:1,pointerType}]){
        if(!activatesPadKey(event))continue;
        draft=editNumber(draft,key,replaceAll);replaceAll=false;accepted++;
      }
    }
    assert.equal(accepted,9);assert.equal(draft,'0.0003000');assert.equal(draftValue(draft),.0003);
  }
});

test('zero-valued drafts survive repeated entry, clearing, and correction',()=>{
  let draft=type('12',['0','0','decimal','0','0','0']);
  assert.equal(draft,'0.000');assert.equal(draftValue(draft),0);
  draft=editNumber(draft,'backspace');draft=editNumber(draft,'3');assert.equal(draft,'0.003');
  draft=editNumber(draft,'clear');assert.equal(draftValue(draft),null);
  draft=editNumber(draft,'0');draft=editNumber(draft,'decimal');draft=editNumber(draft,'0');assert.equal(draft,'0.0');
});

test('keyboard and assistive activation work without duplicating pointer clicks',()=>{
  assert.equal(activatesPadKey({type:'click',detail:0}),true);
  assert.equal(activatesPadKey({type:'click',detail:0,pointerType:'touch'}),false);
  assert.equal(activatesPadKey({type:'pointerdown',button:2,pointerType:'mouse'}),false);
  assert.equal(activatesPadKey({type:'pointercancel',pointerType:'touch'}),false);
  // Distinct fingers may arrive before the first finger releases.
  assert.equal([{type:'pointerdown',button:0,pointerType:'touch'},
    {type:'pointerdown',button:0,pointerType:'touch'},
    {type:'click',detail:1,pointerType:'touch'},
    {type:'click',detail:1,pointerType:'touch'}].filter(activatesPadKey).length,2);
});
