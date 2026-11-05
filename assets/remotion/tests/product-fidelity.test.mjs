// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validate} from '../render.mjs';
import {editorPose,editorState} from '../effects/node-editor.mjs';
import {catalog} from '../effects/catalog.mjs';
const sample=JSON.parse(fs.readFileSync(new URL('../../production/examples/business.json',import.meta.url)));
const doc=()=>({aspect:'16:9',fps:30,duration:45,audio:'audio.wav',character:'dragon.png',styleId:'colorful-dragon-v1',captions:[],overlays:[],modules:{background:'studio',character:{mode:'none'}},cartoonScenes:structuredClone(sample.scenes)});
const node=d=>d.cartoonScenes.flatMap(s=>s.effects).find(e=>e.type==='node-editor');
test('cursor stays attached to the dragged node and release precedes execution',()=>{
 const e=node(doc()),start=editorPose(e,e.dragAt),end=editorPose(e,e.dragAt+e.dragSeconds);
 assert.deepEqual(start.position,e.from.map((v,i)=>v*[1600,740][i]));assert.deepEqual(end.position,[850,265]);
 for(const t of [.8,1.1,1.6,2]){const p=editorPose(e,t);assert.ok(Math.abs(p.pointer[0]-p.position[0]-205)<1e-9);assert.ok(Math.abs(p.pointer[1]-p.position[1]-65)<1e-9);}
 assert.equal(end.connected,false);assert.equal(editorPose(e,2.25).connected,true);
 assert.equal(editorState(e,2.1).test,0);assert.equal(editorPose(e,4).pointerOpacity,0);
});
test('foreground metrics wait for the completed result and allow a readable hold',()=>{
 const d=doc(),e=node(d);e.metricsAt=2.8;assert.throws(()=>validate(d),/preceding phase/);
 e.metricsAt=4.5;assert.throws(()=>validate(d),/ending hold/);
 const good=node(doc());assert.equal(editorState(good,3.1).metrics,0);assert.equal(editorState(good,4).metrics,1);
});
test('product configuration validates nested fields, icons, palettes and table shape',()=>{
 for(const change of [e=>e.ui.unknown='x',e=>e.ui.nodeIcons=['bolt','invalid','bell'],e=>e.ui.nodeColors=['#abc','#123456','#123456'],e=>e.ui.activeNav=1.5,e=>e.bars=[1,-1],e=>e.metrics[0].value=12]){
  const d=doc();change(node(d));assert.throws(()=>validate(d));
 }
 const d=doc(),scan=d.cartoonScenes[1].effects[0];scan.ui.resultRow.pop();assert.throws(()=>validate(d),/columns/);
});
test('full UI inputs survive validation and are discoverable in the executable catalog',()=>{
 const d=doc();assert.equal(validate(d),d);
 assert.ok(catalog().effects.find(e=>e.type==='node-editor').uiFields.includes('nodeDetails'));
 assert.ok(catalog().effects.find(e=>e.type==='network').uiFields.includes('insights'));
 const e=node(d);const expected=editorPose(e,1.3);editorPose(e,30);assert.deepEqual(editorPose(e,1.3),expected);
});
