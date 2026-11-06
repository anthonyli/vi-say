// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate} from '../render.mjs';
import {catalog} from '../effects/catalog.mjs';
import {GL_TRANSITIONS,isGLTransition,glOptions,validateGLParams} from '../gl-transitions.mjs';
import {TRANSITION_NAMES,TRANSITION_ALIASES,resolveTransition,validateTransitionPool} from '../cartoon-transitions.mjs';
import {transitionFor,transitionPlan,resolveCartoonTransitions,sceneVisibility,transitionStyle} from '../cartoon-motion.mjs';
import {cartoonStillPoints} from '../cartoon-contract.mjs';
import {validateRuntimeVersions} from '../runtime.mjs';
const fixture=()=>({aspect:'16:9',fps:30,duration:6,audio:'audio.wav',character:'dragon.png',styleId:'colorful-dragon-v1',captions:[],overlays:[],cartoonScenes:[{kind:'hero',start:0,end:3,title:'前一场'},{kind:'hero',start:3,end:6,title:'后一场'}]});

test('catalog deduplicates the original effects into 30 GL and five CSS mechanisms',()=>{
  const c=catalog();assert.equal(c.transitions.length,35);assert.equal(c.glTransitions.length,30);assert.equal(c.cssTransitions.length,5);
  assert.equal(c.transitionAliases.length,7);
  for(const alias of Object.keys(TRANSITION_ALIASES))assert.ok(!c.transitions.includes(alias));
  assert.equal(new Set(GL_TRANSITIONS.map(t=>t.shaderSha256)).size,30);
  assert.deepEqual(c.transitions,TRANSITION_NAMES);
  const reel=c.templates.find(t=>t.name==='transitions');
  assert.equal(reel.transitions.length,35);
  for(const t of GL_TRANSITIONS){assert.ok(t.author);assert.ok(/^https:\/\/gl-transitions.com\/editor\//.test(t.preview));assert.ok(['MIT','BSD 3 Clause'].includes(t.license));}
});
test('legacy names resolve to shared renderers and stay stable after compilation',()=>{
  const expected={iris:'radial',handoff:'slide',evidence:'flip',report:'flip',focus:'gl:CrossZoom',zoom:'gl:CrossZoom',merge:'gl:CrossZoom'};
  for(const [alias,target] of Object.entries(expected)){
    const d=fixture();d.cartoonScenes[1].transition=alias;validate(d);
    const resolved=resolveCartoonTransitions(d);validate(resolved);
    assert.equal(resolved.cartoonScenes[1].transition,target);
    assert.equal(resolved.cartoonScenes[1].transitionAlias,alias);
    assert.deepEqual(resolveCartoonTransitions(resolved),resolved);
    assert.equal(transitionPlan(resolved)[0].seconds,.6);
    assert.equal(transitionPlan(resolved)[0].alias,alias);
    for(let frame=0;frame<=18;frame++){
      const previous=sceneVisibility({index:0,frame:90+frame,duration:90,transitionFrames:18,transition:'slide',nextTransition:target,nextTransitionAlias:alias});
      const incoming=sceneVisibility({index:1,frame,duration:90,transitionFrames:18,transition:target,transitionAlias:alias});
      assert.ok(previous===0||incoming===0,`${alias} normalized visibility at ${frame}`);
    }
  }
  assert.deepEqual(validateTransitionPool(['iris','radial','focus','gl:CrossZoom']),['iris','focus']);
});
test('merged CSS presets retain circle, handoff and panel geometry',()=>{
  assert.deepEqual(transitionStyle('iris',.5),{clipPath:'circle(62.5% at 50% 46%)'});
  assert.deepEqual(transitionStyle('handoff',.5),{clipPath:'inset(0 0 0 50%)',transform:'translateX(240px)',filter:'blur(2px)'});
  const evidence=transitionStyle('evidence',.5),report=transitionStyle('report',.5);
  assert.equal(evidence.transform,'perspective(2400px) rotateY(-2deg) scale(0.98)');
  assert.equal(evidence.filter,'blur(1.5px)');assert.equal(evidence.opacity,.5);
  assert.equal(report.transform,'perspective(2500px) rotateY(-4deg) translateY(80px)');
  assert.equal(report.transformOrigin,'50% 100%');
  assert.equal(resolveTransition('focus').params.strength,.12);
  assert.equal(resolveTransition('zoom').params.strength,.2);
  assert.equal(resolveTransition('merge').params.strength,.1);
});
test('CSS parameter overrides are validated and alias metadata cannot mismatch',()=>{
  const d=fixture();Object.assign(d.cartoonScenes[1],{transition:'radial',transitionParams:{center:[.3,.4],radius:130}});validate(d);
  for(const [name,params] of [['radial',{center:[1.1,0]}],['flip',{angle:100}],['slide',{reveal:1}],['flip',{typo:1}],['flip',{toString:0}]])assert.throws(()=>resolveTransition(name,params));
  const mismatch=fixture();Object.assign(mismatch.cartoonScenes[1],{transition:'slide',transitionAlias:'report'});assert.throws(()=>validate(mismatch),/does not match/);
});
test('automatic fallback cycles through all 35 effects and remains stable across workers',()=>{
  for(const seed of ['fixture','产品演示','a','b','123','different topic']){
    const a=Array.from({length:35},(_,i)=>transitionFor(i+1,seed));
    assert.deepEqual(new Set(a),new Set(TRANSITION_NAMES));
    assert.deepEqual(a,Array.from({length:35},(_,i)=>transitionFor(i+1,seed)));
    assert.equal(transitionFor(36,seed),a[0]);
  }
  validateTransitionPool(['slide','gl:BookFlip']);
  for(const p of [[],['gl:Typo'],['gl:Cube','gl:Cube'],[['slide']]])assert.throws(()=>validateTransitionPool(p));
});
test('resolving automatic choices preserves authored times, captions and explicit CSS',()=>{
  const d=fixture();d.captions=[{start:3.2,end:4,text:'结果出现'}];const before=structuredClone(d);
  const resolved=resolveCartoonTransitions(validate(d));
  assert.deepEqual(d,before);assert.ok(TRANSITION_NAMES.includes(resolved.cartoonScenes[1].transition));
  assert.equal(resolved.cartoonScenes[1].transitionSelection.source,'rotation');
  assert.deepEqual(resolved.cartoonScenes.map(s=>[s.start,s.end]),[[0,3],[3,6]]);assert.deepEqual(resolved.captions,d.captions);
  d.cartoonScenes[1].transition='flip';assert.equal(resolveCartoonTransitions(d).cartoonScenes[1].transition,'flip');
  assert.equal(transitionPlan(d)[0].engine,'css');
});
test('every GL selection validates on the existing scene contract',()=>{
  for(const t of GL_TRANSITIONS){const d=fixture();d.cartoonScenes[1].transition=t.name;validate(d);assert.equal(transitionPlan(d)[0].kind,t.name);}
  const d=fixture();d.cartoonScenes[0].transition='gl:Cube';assert.throws(()=>validate(d),/previous scene/);
});
test('parameters are supplied from upstream defaults and typed overrides',()=>{
  const cube=glOptions('gl:Cube',{persp:.6});assert.equal(cube.name,'Cube');assert.equal(cube.params.persp,.6);assert.equal(cube.params.reflection,.4);assert.equal(cube.params.floating,3);
  assert.deepEqual(glOptions('gl:GridFlip',{size:[3,5]}).params.size,[3,5]);
  assert.equal(glOptions('gl:Wind',{reversed:true}).params.reversed,true);
  for(const [name,params] of [['gl:Cube',{persp:2}],['gl:Cube',{typo:1}],['gl:Wind',{reversed:1}],['gl:GridFlip',{size:[3.5,4]}],['gl:GridFlip',{size:[0,4]}],['gl:DirectionalWarp',{direction:[0,0]}],['gl:CrossZoom',{strength:NaN}],['gl:Cube',[]]])assert.throws(()=>validateGLParams(name,params));
});
test('cut durations keep frame boundaries and previous-scene fade causality',()=>{
  const d=fixture();Object.assign(d.cartoonScenes[1],{transition:'gl:Cube',transitionSeconds:1.2,transitionParams:{persp:.5}});validate(d);
  assert.deepEqual(transitionPlan(d)[0],{sceneIndex:1,kind:'gl:Cube',engine:'gl',seconds:1.2,frames:36,startFrame:90,endFrame:126});
  const pts=cartoonStillPoints(d).filter(p=>p.transition==='gl:Cube');
  for(const frame of [89,90,99,108,117,126])assert.ok(pts.some(p=>p.frame===frame));
  for(const change of [{transitionSeconds:2},{transitionSeconds:NaN},{transition:'flip',transitionParams:{persp:.5}}]){const x=fixture();Object.assign(x.cartoonScenes[1],change);assert.throws(()=>validate(x));}
  const outgoing=sceneVisibility({index:0,frame:160,duration:150,transitionFrames:18,outgoingTransitionFrames:30,transition:'gl:Cube',nextTransition:'report'});
  const incoming=sceneVisibility({index:1,frame:10,duration:150,transitionFrames:30,transition:'report'});
  assert.ok(outgoing===0||incoming===0);
});
test('only GL additions remain and all Remotion packages share one version',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));validateRuntimeVersions(manifest);
  for(const name of ['three','@react-three/fiber','@remotion/three','pixi.js','pixi-filters','lottie-web','@remotion/lottie','animejs'])assert.ok(!Object.hasOwn(manifest.dependencies,name));
  for(const type of ['three','pixi','lottie','anime','clip']){const d=fixture();d.cartoonScenes[0].effects=[{type}];assert.throws(()=>validate(d),/effect type/);}
  assert.throws(()=>validateRuntimeVersions({dependencies:{remotion:'4.0.540','@remotion/transitions':'4.0.500'}}),/shared Remotion version/);
});
