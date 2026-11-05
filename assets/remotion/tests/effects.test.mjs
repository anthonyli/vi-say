// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../render.mjs';
import {actorPose,trackPose,sampleBotMotion,flowState,routePoint,actionAt,counterValue,pop} from '../effects/motion.mjs';
import {characterPose} from '../cartoon-motion.mjs';
import {captionText,captionSegments} from '../effects/captions.mjs';

const fixture=effects=>({aspect:'16:9',fps:30,duration:6,audio:'audio.wav',character:'dragon.png',styleId:'colorful-dragon-v1',captions:[],overlays:[],modules:{background:'glass'},cartoonScenes:[{kind:'stage',start:0,end:6,title:'动画演示',effects}]});
const bot=()=>({type:'bot',id:'helper',variant:'blob',position:[400,600],size:160,action:'hop'});
const flow=()=>({type:'flow',box:[350,330,1400,550],sources:[{title:'素材甲'},{title:'素材乙'}],summary:{title:'摘要',sections:[{text:'共同重点'}]},targets:[{title:'后续动作'}],gatherAt:.3,gatherSeconds:.9,summaryAt:1.5,summarySeconds:.6,sendAt:3.2,sendSeconds:1});

test('jump has a real airborne stretch and landing squash at fixed seconds',()=>{
  const air=sampleBotMotion(.475,'hop'),land=sampleBotMotion(1.02,'hop');
  assert.ok(air.y<-60&&air.scaleY>1&&air.scaleX<1);
  assert.ok(land.scaleY<.9&&land.scaleX>1&&land.y===0);
  assert.ok(air.shadowX<land.shadowX);
  const expected=sampleBotMotion(.475,'hop');sampleBotMotion(30,'spin');sampleBotMotion(.01,'look');
  assert.deepEqual(sampleBotMotion(.475,'hop'),expected);
});

test('cross-scene actors start at the old pose and settle in a fixed travel duration',()=>{
  const e={...bot(),position:[1200,650],travelSeconds:.95,arc:85},before={position:[400,600],size:100};
  assert.deepEqual(actorPose(e,before,0).position,before.position);
  assert.deepEqual(actorPose(e,before,.95).position,e.position);
  assert.ok(actorPose(e,before,.475).position[1]<625);
  assert.deepEqual(actorPose(e,before,20),actorPose(e,before,1));
  const path={position:[100,200],keyframes:[{at:1,position:[400,300]},{at:2,position:[700,400]}]};
  assert.deepEqual(trackPose(path,1).position,[400,300]);
});

test('invalid modules, action names and duplicate or changing actor identities are rejected',()=>{
  assert.equal(validate(fixture([bot()])).cartoonScenes.length,1);
  for(const change of [{action:'dancing'},{variant:'unknown'},{szie:200},{position:[1910,1060]}])assert.throws(()=>validate(fixture([{...bot(),...change}])));
  assert.throws(()=>validate(fixture([bot(),bot()])),/duplicate/);
  const doc=fixture([bot()]);doc.duration=12;doc.cartoonScenes.push({kind:'stage',start:6,end:12,title:'第二场',effects:[{...bot(),variant:'triangle'}]});assert.throws(()=>validate(doc),/keep its variant/);
  const typo=fixture([bot()]);typo.modules.background='glas';assert.throws(()=>validate(typo),/background/);
});

test('causal flow and action timing cannot overlap or get cut off at the ending',()=>{
  assert.equal(validate(fixture([flow()])).duration,6);
  const overlap=flow();overlap.summaryAt=.5;assert.throws(()=>validate(fixture([overlap])),/causal/);
  const cutoff=flow();cutoff.sendAt=5.5;assert.throws(()=>validate(fixture([cutoff])),/ending hold/);
  const action=bot();action.actions=[{name:'hop',at:1,duration:2},{name:'peek',at:2,duration:1}];assert.throws(()=>validate(fixture([action])),/overlap/);
  assert.deepEqual(flowState(flow(),0),{gather:0,summary:0,send:0});
  assert.deepEqual(flowState(flow(),5),{gather:1,summary:1,send:1});
});

test('focus boxes use the actual media coordinate system',()=>{
  const doc=fixture([{type:'focus',events:[{at:.3,region:[.1,.1,.4,.5],label:'聚焦'}]}]);
  doc.cartoonScenes[0].kind='demo';doc.cartoonScenes[0].image='screen.png';
  assert.throws(()=>validate(doc),/mediaSize/);doc.cartoonScenes[0].mediaSize=[1440,900];validate(doc);
  doc.cartoonScenes[0].effects[0].events[0].region=[.9,.1,.4,.5];assert.throws(()=>validate(doc),/source image/);
});

test('punctuation cleanup and highlights preserve protected names and literal regex characters',()=>{
  const options={stripPunctuation:true,keywords:['C++','摘要结果','摘要'],protectedTerms:['Node.js']};
  assert.equal(captionText('使用 Node.js、C++，形成摘要结果。',options),'使用 Node.js C++ 形成摘要结果');
  const parts=captionSegments('摘要与摘要结果',options);
  assert.deepEqual(parts,[{text:'摘要',highlight:true},{text:'与',highlight:false},{text:'摘要结果',highlight:true}]);
  assert.equal(captionSegments('普通文字',{}).map(p=>p.text).join(''),'普通文字');
});

test('route endpoints and loops do not drift when scene duration changes',()=>{
  const points=[[100,600],[700,600],[1400,500]];
  assert.deepEqual(routePoint(points,0,0,3),points[0]);
  assert.deepEqual(routePoint(points,3,0,3),points.at(-1));
  assert.deepEqual(routePoint(points,30,0,3),points.at(-1));
  assert.deepEqual(routePoint(points,3,0,3,true),points[0]);
});

test('delayed actions use their own clock and cannot be silently cut off',()=>{
  assert.equal(actionAt({...bot(),at:2},2).time,0);
  const e=bot();e.endAt=1;e.keyframes=[{at:1.5,position:[500,600]}];assert.throws(()=>validate(fixture([e])),/keyframe/);
  const late=bot();late.at=5.5;assert.throws(()=>validate(fixture([late])),/entry/);
  const cut=flow();cut.endAt=3.5;assert.throws(()=>validate(fixture([cut])),/causal/);
});

test('custom character angles stay continuous when returning to the default pose',()=>{
  const scenes=[{kind:'hero',start:0,end:3,characterPose:{left:1000,top:200,width:500,height:650,rotation:12}},{kind:'steps',start:3,end:7}];
  assert.equal(characterPose(scenes,2.999).rotation,12);
  assert.equal(characterPose(scenes,3).rotation,12);
  assert.ok(Math.abs(characterPose(scenes,3.65).rotation)<1e-8);
});

test('phonetic mouth cues require complete contiguous time and an explicit rounded module',()=>{
  const doc=fixture([bot()]);doc.modules.character={mode:'rounded'};doc.characterClosed='closed.png';doc.characterNeutral='neutral.png';
  doc.mouthCues=[{start:0,end:6,value:'X'}];doc.mouthCueAudioSha256='a'.repeat(64);validate(doc);
  doc.mouthCues[0].start=.1;assert.throws(()=>validate(doc),/contiguous/);
  doc.mouthCues[0].start=0;doc.mouthCues[0].end=5;assert.throws(()=>validate(doc),/cover/);
  delete doc.modules;assert.throws(()=>validate(doc),/modules/);
});

test('counters retain the actual numeric endpoint and entry duration is configurable',()=>{
  for(const value of [5,1.25,-2.75,.000000015])assert.equal(counterValue({value,seconds:1},2),value);
  assert.equal(counterValue({value:5,seconds:1},0),0);
  assert.ok(Math.abs(pop(.35,0,.7)-pop(.7,0,1.4))<1e-9);
});
