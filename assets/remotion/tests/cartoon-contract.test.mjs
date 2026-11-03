import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../render.mjs';
import {mapCartoonAssets, cartoonStillPoints, style} from '../cartoon-contract.mjs';
import {cacheKey, prepareRuntime, runtimeLocation} from '../runtime.mjs';
import {characterPose, transitionStyle} from '../cartoon-motion.mjs';
import {validateTransitionPool} from '../cartoon-transitions.mjs';
const fixture=()=>({aspect:'16:9',fps:30,duration:4,audio:'audio.wav',character:'dragon.png',styleId:'colorful-dragon-v1',captions:[],overlays:[],cartoonScenes:[{kind:'cta',start:0,end:4,title:'一起探索',items:[{text:'留言',at:.4},{text:'点赞',at:1.2},{text:'关注',at:2}]}]});
test('real-second actions reject causal overlap and uncompleted ending',()=>{
  assert.equal(validate(fixture()).duration,4);
  const a=fixture();a.cartoonScenes[0].items[1].at=.7;assert.throws(()=>validate(a),/completion/);
  const b=fixture();b.cartoonScenes[0].items[2].at=3.5;assert.throws(()=>validate(b),/completion/);
});
test('new renderer cannot silently drop legacy fields or gaps',()=>{
  const a=fixture();a.video='recording.mp4';assert.throws(()=>validate(a),/mix/);
  const b=fixture();b.cartoonScenes[0].start=.1;assert.throws(()=>validate(b),/contiguous/);
  const c=fixture();c.cartoonScenes[0].end=3;assert.throws(()=>validate(c));
});
test('demo media and character are both staged; frame points stay in range',async()=>{
  const a=fixture();a.cartoonScenes=[{kind:'demo',start:0,end:4,title:'真实界面',video:'recording.mp4',videoStart:1}];
  validate(a);const mapped=[];await mapCartoonAssets(a,async x=>{mapped.push(x);return 'staged-'+x;});
  assert.deepEqual(mapped,['dragon.png','recording.mp4']);
  assert.ok(cartoonStillPoints(a).every(x=>x.frame>=0&&x.frame<120));
});
test('dependency key changes with lockfile and ABI, not project inputs',()=>{
  assert.equal(cacheKey('lock','darwin','arm64','22'),cacheKey('lock','darwin','arm64','22'));
  assert.notEqual(cacheKey('lock','darwin','arm64','22'),cacheKey('new lock','darwin','arm64','22'));
  assert.notEqual(cacheKey('lock','darwin','arm64','22'),cacheKey('lock','darwin','arm64','24'));
});
test('dragon stays continuous at handoff and moves for a fixed duration',()=>{
  const scenes=[{kind:'hero',start:0,end:4},{kind:'steps',start:4,end:9}];
  assert.deepEqual(characterPose(scenes,3.999),characterPose(scenes,4));
  assert.equal(characterPose(scenes,4.65).left,75);
  const a=characterPose(scenes,4.3), b=characterPose([{kind:'hero',start:0,end:14},{kind:'steps',start:14,end:30}],14.3);
  for (const key of Object.keys(a)) assert.ok(Math.abs(a[key]-b[key])<1e-8);
  assert.ok(a.top>300, 'mid-handoff character travels below the heading');
  for(let t=4;t<=4.65;t+=.01){const pose=characterPose(scenes,t);assert.ok(pose.top+pose.height<=1080);}
});

test('transition choices are repeatable, varied, and finish with an untransformed scene',async()=>{
  const {transitionFor,transitionStyle}=await import('../cartoon-motion.mjs');
  const a=[1,2,3,4].map(i=>transitionFor(i,'fixture'));
  assert.equal(new Set(a).size,4);
  assert.deepEqual(a,[1,2,3,4].map(i=>transitionFor(i,'fixture')));
  for(const kind of a)assert.deepEqual(transitionStyle(kind,1),{});
});
test('implemented effects can be selected explicitly outside the automatic pool',()=>{
  const original=style.motion.transitionKinds;
  try {
    style.motion.transitionKinds=['slide'];
    const doc=fixture();doc.cartoonScenes[0].transition='radial';
    assert.equal(validate(doc).cartoonScenes[0].transition,'radial');
    assert.deepEqual(transitionStyle('radial',.5),{clipPath:'circle(75% at 70% 55%)'});
    doc.cartoonScenes[0].transition='not-implemented';
    assert.throws(()=>validate(doc),/unsupported transition/);
  } finally { style.motion.transitionKinds=original; }
});
test('invalid effect pools and unknown or nonfinite render requests fail before rendering',()=>{
  for(const pool of [[],['slide','slide'],['not-implemented'],[['slide']],[null],'slide'])
    assert.throws(()=>validateTransitionPool(pool),/implemented effect names/);
  for(const progress of [0,.5,1])assert.throws(()=>transitionStyle('not-implemented',progress),/Unknown/);
  for(const progress of [NaN,Infinity])assert.throws(()=>transitionStyle('slide',progress),/finite/);
});
test('registered transitions preserve their visual endpoints and clamped completion',()=>{
  assert.deepEqual(transitionStyle('slide',0),{transform:'translateX(1920px)'});
  assert.deepEqual(transitionStyle('slide',.5),{transform:'translateX(960px)'});
  assert.deepEqual(transitionStyle('wipe',.5),{clipPath:'inset(0 50% 0 0)'});
  assert.deepEqual(transitionStyle('flip',.5),{transform:'perspective(2400px) rotateY(45deg)',transformOrigin:'left center',backfaceVisibility:'hidden'});
  for(const kind of ['slide','radial','wipe','flip'])assert.deepEqual(transitionStyle(kind,1.1),{});
});
test('right-side placement moves the character away from the left content panel',()=>{
  const scenes=[{kind:'steps',start:0,end:4,characterSide:'left'},{kind:'steps',start:4,end:8,characterSide:'right'}];
  assert.equal(characterPose(scenes,4).left,75);
  assert.equal(characterPose(scenes,4.65).left,1275);
  assert.equal(characterPose(scenes,4.65).turn,180);
  for(let t=4;t<4.65;t+=.01){const p=characterPose(scenes,t);assert.ok(p.top+p.height<=1080);}
});
test('stale or incomplete mouth analysis and noncanonical shared outro cannot pass',()=>{
  const a=fixture();a.characterClosed='closed.png';a.speechMotion={fps:30,duration:4,audio_sha256:'0'.repeat(64),values:Array(120).fill(.5)};validate(a);
  a.speechMotion.values.pop();assert.throws(()=>validate(a),/mouth motion/);
  const b=fixture();b.cartoonScenes[0].outroId='community-outro-v1';assert.throws(()=>validate(b),/canonical actions/);
  [b.cartoonScenes[0].items[1],b.cartoonScenes[0].items[2]]=[{text:'关注',at:1.2},{text:'点赞',at:2}];validate(b);
});
