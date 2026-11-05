// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../render.mjs';
import {businessState,networkBox} from '../effects/business.mjs';
import {catalog} from '../effects/catalog.mjs';
import {sceneVisibility,transitionStyle} from '../cartoon-motion.mjs';
const sample=JSON.parse(fs.readFileSync(new URL('../../production/examples/business.json',import.meta.url)));
const fixture=()=>({aspect:'16:9',fps:30,duration:45,audio:'audio.wav',character:'dragon.png',styleId:'colorful-dragon-v1',captions:[],overlays:[],modules:{background:'studio',character:{mode:'none'}},cartoonScenes:structuredClone(sample.scenes)});
const find=(doc,type)=>doc.cartoonScenes.flatMap(s=>s.effects).find(e=>e.type===type);

test('catalog derives all implemented inputs and validates every shipped recipe',()=>{
  const c=catalog();assert.equal(new Set(c.effects.map(e=>e.type)).size,c.effects.length);
  for(const template of c.templates)for(const type of template.effects)assert.ok(c.effects.some(e=>e.type===type));
  assert.ok(c.templates.find(t=>t.name==='business').sampleFrames>40);
  assert.equal(validate(fixture()).modules.character.mode,'none');
});
test('document cannot imply review before writing or report before review',()=>{
  for(const change of [{writeAt:.6},{reviewAt:2},{reportAt:3.4}]){
    const doc=fixture(),e=doc.cartoonScenes[5].effects[0];Object.assign(e,change);assert.throws(()=>validate(doc),/preceding phase/);
  }
  const e=sample.scenes[5].effects[0];assert.deepEqual(businessState(e,0),{gather:0,write:0,review:0,report:0});
  assert.deepEqual(businessState(e,6),{gather:1,write:1,review:1,report:1});
});
test('node drag must finish before running, and time offsets are honored',()=>{
  const doc=fixture(),e=find(doc,'node-editor');e.testAt=1;assert.throws(()=>validate(doc),/preceding phase/);
  const original=find(fixture(),'node-editor');assert.equal(businessState(original,.6).drag,0);assert.ok(Math.abs(businessState(original,1.9).drag-1)<1e-12);assert.equal(businessState(original,1.9).test,0);
});
test('network rejects dangling edges, duplicate identity and pre-node connections',()=>{
  for(const modify of [e=>e.edges[0].to='missing',e=>e.nodes[1].id=e.nodes[0].id,e=>e.edges[0].at=0]){
    const doc=fixture();modify(find(doc,'network'));assert.throws(()=>validate(doc));
  }
});
test('the same graph moves continuously to an inset and is deterministic on seeking',()=>{
  const e=find(fixture(),'network');assert.deepEqual(networkBox(e,0),e.box);assert.deepEqual(networkBox(e,3.6),e.box);
  assert.deepEqual(networkBox(e,5),e.boxFrames[1].box);
  const midpoint=(e.boxFrames[0].at+e.boxFrames[1].at)/2;const middle=networkBox(e,midpoint);assert.ok(middle[2]>e.boxFrames[1].box[2]&&middle[2]<e.box[2]);
  networkBox(e,100);assert.deepEqual(networkBox(e,midpoint),middle);
  assert.deepEqual(networkBox(e,12),networkBox(e,5));
});
test('new transitions settle exactly with no residual blur, perspective or clipping',()=>{
  for(const name of catalog().transitions){assert.deepEqual(transitionStyle(name,1),{});assert.deepEqual(transitionStyle(name,10),{});assert.notDeepEqual(transitionStyle(name,0),{});assert.deepEqual(transitionStyle(name,.5),transitionStyle(name,.5));}
});
test('all nested inputs are validated and delayed phases cannot run before effect visibility',()=>{
  const changes=[['scan',e=>e.scanAt=3.9],['chart',e=>e.values[0]=NaN],['document',e=>e.rows[0].txt='typo'],['panel-merge',e=>e.at=2],['network',e=>e.boxFrames[1].at=e.boxFrames[0].at],['node-editor',e=>e.moving=1.2]];
  for(const [type,modify] of changes){const d=fixture();modify(find(d,type));assert.throws(()=>validate(d),type);}
});

test('incoming and outgoing business scenes never show text layers simultaneously',()=>{
  for(const name of ['converge','focus','handoff','zoom','evidence','report','merge','iris']){
    for(let frame=0;frame<=24;frame++){
      const previous=sceneVisibility({index:0,frame:150+frame,duration:150,transitionFrames:24,transition:'slide',nextTransition:name});
      const next=sceneVisibility({index:1,frame,duration:150,transitionFrames:24,transition:name});
      assert.ok(previous===0||next===0,`${name} at ${frame}`);
    }
  }
  assert.equal(sceneVisibility({index:1,frame:5,duration:150,transitionFrames:24,transition:'slide'}),1);
});

test('catalog CLI produces JSON when reached through a symlink',()=>{
  const dir=fs.mkdtempSync(join(tmpdir(),'effect-catalog-'));
  try {
    const path=join(dir,'catalog.mjs');fs.symlinkSync(fileURLToPath(new URL('../effects/catalog.mjs',import.meta.url)),path);
    const r=spawnSync(process.execPath,[path,'--json'],{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);assert.ok(JSON.parse(r.stdout).templates.some(t=>t.name==='business'));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
