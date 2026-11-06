// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRANSITION_NAMES,canonicalTransition} from '../cartoon-transitions.mjs';
import {SCENE_TRANSITION_GROUPS,selectSceneTransitions} from '../transition-selection.mjs';
import {sceneTransitionSettings,resolveCartoonTransitions,transitionPlan} from '../cartoon-motion.mjs';
import {validate} from '../render.mjs';
import {catalog} from '../effects/catalog.mjs';

const scenesDoc=(scenes,transitionSeed='scene-test')=>({transitionSeed,cartoonScenes:[{kind:'hero',start:0,end:2,title:'开始'},
  ...scenes.map((s,i)=>({kind:'hero',start:2+i*2,end:4+i*2,title:'下一幕',...s}))]});
const choose=scene=>selectSceneTransitions(scenesDoc([scene]))[1];

test('explicit transitions override scene meaning, including legacy aliases',()=>{
  for(const name of ['gl:GlitchMemories','slide','focus']){
    const selected=choose({kind:'cta',title:'阅读报告',transition:name});
    assert.equal(selected.name,name);assert.equal(selected.selection,undefined);
  }
});
test('scene descriptions, kinds and authored modules prefer appropriate mechanisms',()=>{
  for(const [scene,intent] of [
    [{title:'阅读报告'},'document'],[{title:'进入立体空间'},'spatial'],
    [{title:'观察液体波纹'},'organic'],[{title:'排查代码故障'},'digital'],
    [{title:'第三章 新主题'},'chapter'],[{title:'查看数据趋势'},'data'],
    [{kind:'steps'},'structure'],[{kind:'demo'},'detail'],[{kind:'cta'},'continuity'],
    [{effects:[{type:'document'}]},'document'],[{effects:[{type:'chart'}]},'data'],
    [{effects:[{type:'network'}]},'structure'],[{effects:[{type:'scan'}]},'digital'],
  ]){
    const selected=choose(scene);
    assert.equal(selected.selection.source,'scene');assert.equal(selected.selection.intent,intent);
    assert.ok(SCENE_TRANSITION_GROUPS[intent].includes(selected.name));
  }
});
test('same-media continuity uses both scenes while authored focus takes priority',()=>{
  const doc=scenesDoc([{image:'same.svg'},{image:'same.svg'},{image:'same.svg',effects:[{type:'focus'}]}]);
  const choices=selectSceneTransitions(doc);
  assert.equal(choices[2].selection.intent,'continuity');
  assert.equal(choices[3].selection.intent,'detail');
});
test('all 35 effects remain reachable even when every scene has the same meaning',()=>{
  const doc=scenesDoc(Array.from({length:70},()=>({kind:'demo',title:'阅读报告',image:'same.svg'})));
  const choices=selectSceneTransitions(doc).slice(1);
  for(let i=0;i<2;i++){
    const cycle=choices.slice(i*35,(i+1)*35);
    assert.deepEqual(new Set(cycle.map(c=>c.name)),new Set(TRANSITION_NAMES));
    assert.ok(cycle.every(c=>c.selection.cycle===i+1));
  }
  assert.ok(choices.every((c,i)=>!i||c.name!==choices[i-1].name));
  assert.deepEqual(selectSceneTransitions(doc).slice(1),choices);
  assert.deepEqual(new Set(catalog().defaultTransitionPool),new Set(TRANSITION_NAMES));
});
test('explicit effects consume their canonical place and aliases cannot multiply rotation weight',()=>{
  const doc=scenesDoc([{transition:'focus'},{},{},{}]);
  const choices=selectSceneTransitions(doc,['focus','gl:CrossZoom','wipe','slide']);
  assert.deepEqual(new Set(choices.slice(1,4).map(c=>canonicalTransition(c.name))),new Set(['gl:CrossZoom','wipe','slide']));
  assert.equal(choices[4].selection.cycle,2);
  assert.notEqual(choices[3].name,choices[4].name);
});
test('unknown semantics use the seeded full rotation with no title-independent forced effect',()=>{
  const doc=scenesDoc(Array.from({length:35},()=>({})));
  const a=selectSceneTransitions(doc),b=selectSceneTransitions({...doc,transitionSeed:'another-seed'});
  assert.ok(a.slice(1).every(c=>c.selection.source==='rotation'));
  assert.deepEqual(new Set(a.slice(1).map(c=>c.name)),new Set(TRANSITION_NAMES));
  assert.notDeepEqual(a,b);
});
test('compiled choices preserve content and timing, audit reasons, and out-of-order rendering',()=>{
  const doc={...scenesDoc([{title:'文档报告'},{title:'聚焦细节'},{title:'下一幕'}]),aspect:'16:9',fps:30,duration:8,
    audio:'audio.wav',character:'dragon.png',styleId:'colorful-dragon-v1',captions:[{start:2,end:3,text:'查看报告'}],overlays:[]};
  const original=structuredClone(doc);validate(doc);
  const resolved=resolveCartoonTransitions(doc);validate(resolved);
  assert.deepEqual(doc,original);assert.deepEqual(resolveCartoonTransitions(resolved),resolved);
  assert.deepEqual(transitionPlan(doc),transitionPlan(resolved));
  for(const index of [3,1,2,1])assert.equal(sceneTransitionSettings(doc.cartoonScenes[index],index,doc).name,resolved.cartoonScenes[index].transition);
  assert.deepEqual(resolved.captions,doc.captions);
  assert.deepEqual(resolved.cartoonScenes.map(s=>[s.start,s.end]),doc.cartoonScenes.map(s=>[s.start,s.end]));
  for(const seed of [42,'',null])assert.throws(()=>validate({...doc,transitionSeed:seed}),/transitionSeed/);
});
test('appending to a compiled timeline continues the full rotation rather than restarting',()=>{
  const doc=scenesDoc(Array.from({length:70},()=>({})));
  const resolved=resolveCartoonTransitions(doc);
  const extra={kind:'hero',start:142,end:144,title:'下一幕'};
  const raw=selectSceneTransitions({...doc,cartoonScenes:[...doc.cartoonScenes,extra]}).at(-1);
  const continued=selectSceneTransitions({...resolved,cartoonScenes:[...resolved.cartoonScenes,extra]}).at(-1);
  assert.deepEqual(continued,raw);assert.equal(continued.selection.cycle,3);
});
