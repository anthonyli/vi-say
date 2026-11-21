// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {COMIC_LAYOUT, COMIC_TRANSITION_PARAMS, COMIC_TRANSITION_POOL, COMIC_OUTRO_TRANSITION,
  dropLand, fitFont, idle, markerSweep, popIn, push, shake, shakeAll, slam, textUnits} from '../effects/comic-motion.mjs';
import {comicLayout, validateComicScene} from '../comic-layout.mjs';
import {validateCartoon} from '../cartoon-contract.mjs';
import {resolveCartoonTransitions, transitionPlan} from '../cartoon-motion.mjs';
import {validateEffects} from '../effects/contract.mjs';
import {validateTransitionPool, resolveTransition} from '../cartoon-transitions.mjs';
import outro from '../../production/outro.json' with {type: 'json'};

const comicDoc = (scenes, modules = {}) => ({aspect: '16:9', fps: 30, duration: scenes.at(-1).end, character: 'dragon.png',
  styleId: 'colorful-dragon-v1', modules: {background: 'comic', ...modules}, cartoonScenes: scenes});
const outroScene = (start, end) => ({kind: 'cta', start, end, outroId: outro.id, title: outro.title, subtitle: outro.subtitle,
  items: outro.items.map((item, i) => ({...item, at: .5 + i * .9}))});
const story = () => [
  {kind: 'hero', start: 0, end: 4, title: '录屏前先查免费限制', subtitle: '一句话说清收益', highlight: '免费限制'},
  {kind: 'demo', start: 4, end: 9, title: '先看这三列', subtitle: '价格、麦克风、水印', image: 'shot.png'},
  {kind: 'steps', start: 9, end: 14, title: '三步判断', items: [
    {text: '看价格', at: .4}, {text: '看水印', at: 1.4}, {text: '看平台', at: 2.4}]},
  {kind: 'demo', start: 14, end: 19, title: '筛完只剩十四款', image: 'shot.png'},
  outroScene(19, 23.5),
];

test('motion primitives settle exactly and stay pure functions of time', () => {
  assert.deepEqual(slam(-1, 0), {opacity: 0, scale: 1.32, rotate: -3});
  assert.deepEqual(slam(.42, 0), {opacity: 1, scale: 1, rotate: 0});
  const mid = slam(.3, 0);
  assert.ok(mid.scale < 1, 'slam overshoots below its resting size before settling');
  assert.deepEqual(popIn(.5, 0), {opacity: 1, scale: 1});
  assert.ok(popIn(.2, 0).scale > 1, 'pop overshoots');
  assert.equal(slam(.25, .1).scale, slam(.25, .1).scale);
  assert.equal(markerSweep(0, .5), 0);
  assert.equal(markerSweep(2, .5), 1);
  assert.equal(push(0, 5), 1);
  assert.ok(Math.abs(push(5, 5) - 1.045) < 1e-9);
  assert.ok(Math.abs(idle(1.7)) <= .8);
});

test('bricks fall with gravity, squash at contact and come to rest', () => {
  const ys = [0, .1, .2, .3].map(t => dropLand(t, 0).y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1], 'falling bricks move downward');
  const speeds = ys.slice(1).map((y, i) => y - ys[i]);
  assert.ok(speeds[2] > speeds[0], 'the fall accelerates instead of easing out');
  const contact = dropLand(.62 * .62 + .001, 0);
  assert.ok(contact.landed && contact.scaleY < .9 && contact.scaleX > 1, 'contact squashes the brick');
  assert.deepEqual(dropLand(2, 0), {visible: true, y: 0, scaleX: 1, scaleY: 1, impact: 0, landed: true});
  assert.equal(dropLand(-.1, 0).visible, false);
});

test('camera shake decays to zero and combines impacts', () => {
  assert.deepEqual(shake(-.1, 0), {x: 0, y: 0});
  assert.deepEqual(shake(.3, 0), {x: 0, y: 0});
  assert.ok(Math.abs(shake(.02, 0).x) > Math.abs(shake(.25, 0).x));
  const both = shakeAll(1.02, [1, 3]);
  assert.deepEqual(both, shake(1.02, 1));
});

test('text fitting picks the largest readable size and refuses overflow', () => {
  assert.equal(textUnits('免费'), 2);
  assert.ok(textUnits('Compare') < 7);
  assert.equal(fitFont('短标题', {width: 900, height: 420, max: 118, min: 64}), 118);
  const long = fitFont('这是一个需要换行才能放下的长标题啊', {width: 900, height: 420, max: 118, min: 64});
  assert.ok(long < 118 && long >= 64);
  assert.throws(() => fitFont('超长'.repeat(40), {width: 300, height: 60, max: 40, min: 30}), /does not fit/);
});

test('every comic layout stays inside the frame and above the caption band', () => {
  for (const scene of story()) {
    const layout = comicLayout(scene);
    const boxes = [layout.title, layout.subtitle, layout.header, layout.bubble].filter(Boolean)
      .map(b => [b.x, b.y, b.w, b.h]);
    if (layout.media) boxes.push(layout.media);
    for (const b of layout.bricks ?? []) boxes.push([b.x, b.y, b.w + 36, b.h + 36]);
    for (const [x, y, w, h] of boxes) {
      assert.ok(x >= 0 && y >= 0 && x + w <= 1920, `${scene.kind} box fits horizontally`);
      assert.ok(y + h <= COMIC_LAYOUT.captionTop, `${scene.kind} box stays above captions`);
    }
  }
  const {left, top, width, height} = COMIC_LAYOUT.character.side;
  assert.ok(top + height <= COMIC_LAYOUT.captionTop && left >= COMIC_LAYOUT.media[0] + COMIC_LAYOUT.media[2]);
  assert.ok(comicLayout(story()[1], {character: false}).media[2] > COMIC_LAYOUT.media[2], 'no dragon widens the demo');
});

test('comic scene fields are validated before rendering', () => {
  assert.throws(() => validateComicScene({...story()[0], highlight: '不存在'}), /copied from the scene title/);
  assert.throws(() => validateComicScene({...story()[1], characterSide: 'left'}), /dragon on the right/);
  assert.throws(() => validateComicScene({...story()[1], tone: 'black'}), /tone/);
  // Contract limits (title 22, subtitle 38 characters) always fit; only oversize text reaches fitFont's guard.
  for (const kind of ['hero', 'demo', 'steps']) {
    const base = story().find(s => s.kind === kind);
    validateComicScene({...base, highlight: undefined, title: '标'.repeat(22), subtitle: '副'.repeat(38)});
  }
  assert.throws(() => validateComicScene({...story()[1], subtitle: '副'.repeat(120)}), /does not fit/);
  const glass = {...comicDoc(story()), modules: {background: 'glass'}};
  glass.cartoonScenes[0] = {...glass.cartoonScenes[0]};
  assert.throws(() => validateCartoon(glass), /comic theme field/);
});

test('comic theme picks from its own pool with palette-matched shader colours and a fixed outro', () => {
  assert.deepEqual(validateTransitionPool([...COMIC_TRANSITION_POOL]), [...COMIC_TRANSITION_POOL]);
  for (const [name, params] of Object.entries(COMIC_TRANSITION_PARAMS)) resolveTransition(name, params);
  for (const seed of ['a', 'b', 'c', 'episode-42']) {
    const doc = resolveCartoonTransitions(validateCartoon({...comicDoc(story()), transitionSeed: seed}));
    const plan = transitionPlan(doc);
    assert.ok(plan.every(t => COMIC_TRANSITION_POOL.includes(t.kind)), `seed ${seed} stays in the comic pool`);
    assert.equal(plan.at(-1).kind, COMIC_OUTRO_TRANSITION);
    assert.ok(plan.slice(0, -1).every(t => t.kind !== COMIC_OUTRO_TRANSITION), 'the outro entrance is reserved');
    for (const scene of doc.cartoonScenes.slice(1)) {
      if (COMIC_TRANSITION_PARAMS[scene.transition]) assert.deepEqual(scene.transitionParams, COMIC_TRANSITION_PARAMS[scene.transition]);
    }
  }
  const grid = resolveCartoonTransitions(validateCartoon(comicDoc(story()))).cartoonScenes.at(-1);
  assert.deepEqual(grid.transitionParams.bgcolor.slice(0, 3), [.094, .137, .235], 'grid gaps use the comic ink, not black');
  const explicit = story(); explicit[1] = {...explicit[1], transition: 'gl:Cube'};
  assert.equal(resolveCartoonTransitions(validateCartoon(comicDoc(explicit))).cartoonScenes[1].transition, 'gl:Cube',
    'an explicit scene choice still wins');
});

test('reusable comic effects are validated with fixed bounds', () => {
  const scene = {kind: 'stage', start: 0, end: 4, effects: []};
  const ok = [{type: 'bubble', position: [100, 200], text: '气泡跟着口播弹出', at: .3},
    {type: 'burst', position: [900, 400], size: 150, text: '砰', at: 1},
    {type: 'brick', position: [160, 600], width: 700, text: '积木效果', detail: '落地回弹', at: .9}];
  validateEffects({...scene, effects: ok});
  const bad = [
    [{type: 'bubble', position: [100, 200]}, /bubble text/],
    [{type: 'bubble', position: [1700, 200], width: 460, text: '越界'}, /bubble bounds/],
    [{type: 'burst', position: [100, 100], text: '太长的爆炸贴纸文字'}, /burst text/],
    [{type: 'brick', position: [100, 100], text: '积木', angle: 40}, /brick angle/],
    [{type: 'brick', position: [100, 100], text: '积木', at: 3.6}, /land|entry/],
    [{type: 'brick', text: '积木'}, /requires position/],
  ];
  for (const [effect, pattern] of bad) assert.throws(() => validateEffects({...scene, effects: [effect]}), pattern);
});

test('speech-cued motion: cards collapse in order, spotlight travels, typing and stamps settle', async () => {
  const {cueState, spotlightAt, typedCount, stampIn, exitStyle, exitProgress, breathe, drawProgress} = await import('../effects/comic-motion.mjs');
  const items = [{at: 0}, {at: 2}, {at: 4}];
  const early = cueState(items, 1);
  assert.equal(early.active, 0);
  assert.deepEqual(early.states.map(s => s.visible), [true, false, false]);
  const late = cueState(items, 4.6);
  assert.equal(late.active, 2);
  assert.deepEqual(late.states.map(s => s.collapse), [1, 1, 0]);
  assert.equal(late.states[0].breathing, 1, 'collapsed cards stop breathing');
  assert.ok(cueState(items, 2.2).states[0].collapse > 0 && cueState(items, 2.2).states[0].collapse < 1);
  const events = [{at: 0, region: [0, 0, 100, 100]}, {at: 2, region: [200, 200, 100, 100], label: '再看'}];
  assert.equal(spotlightAt(events, -1), null);
  assert.deepEqual(spotlightAt(events, 3).region, [200, 200, 100, 100]);
  const mid = spotlightAt(events, 2.2).region[0];
  assert.ok(mid > 0 && mid < 200, 'the spotlight glides between regions');
  assert.equal(spotlightAt(events, 3).label, '再看');
  assert.equal(typedCount('一二三四', 0, 0, 1), 0);
  assert.equal(typedCount('一二三四', .5, 0, 1), 2);
  assert.equal(typedCount('一二三四', 9, 0, 1), 4);
  assert.deepEqual(stampIn(1, 0, -12), {opacity: 1, scale: 1, rotate: -12});
  assert.equal(drawProgress(2, 0), 1);
  assert.deepEqual(exitStyle('shrink', 1), {opacity: 1, scaleX: 1, scaleY: 1, y: 0});
  assert.equal(exitStyle('collapse', 0).scaleY, .02);
  assert.equal(exitProgress(5, undefined), 1);
  assert.equal(exitProgress(5, 5), 0);
  assert.equal(breathe(0, 1), 1);
});

test('speech-cued effects and shared exits are validated before rendering', () => {
  const scene = {kind: 'stage', start: 0, end: 8, effects: []};
  const cards = {type: 'cue-cards', box: [80, 190, 1280, 650], items: [{at: .4, title: '一键导入'}, {at: 2.2, title: '自动排版'}]};
  validateEffects({...scene, effects: [cards,
    {type: 'spotlight', endAt: 4, exit: 'fade', events: [{at: .4, region: [100, 100, 300, 200], label: '先看'}]},
    {type: 'sketch', region: [100, 100, 300, 120], label: '这里', at: 1},
    {type: 'typewriter', position: [100, 200], text: '帮我做一期视频', at: .3, breathe: true},
    {type: 'stamp', position: [800, 600], text: '搞定', at: 2},
    {type: 'checklist', box: [100, 400, 800, 240], items: [{at: .5, text: '海报'}, {at: 1.5, text: '字幕'}]}]});
  const bad = [
    [{...cards, items: [{at: .4, title: 'a'}, {at: .6, title: 'b'}]}, /\.6 seconds each/],
    [{...cards, box: [80, 190, 1280, 200]}, /needs 300 px height/],
    [{...cards, mode: 'grid'}, /cue-cards mode/],
    [{...cards, exit: 'shrink'}, /exit needs endAt/],
    [{...cards, endAt: .8, exit: 'shrink'}, /after the entry/],
    [{type: 'spotlight', events: [{at: .4, region: [1800, 100, 300, 200]}]}, /spotlight region/],
    [{type: 'checklist', box: [100, 400, 800, 100], items: [{at: .5, text: '海报'}, {at: 1.5, text: '字幕'}]}, /px height/],
    [{type: 'typewriter', position: [100, 200], text: '很长'.repeat(30), at: 5}, /typing must finish/],
    [{type: 'stamp', position: [100, 100], text: '太长的印章文字'}, /stamp text/],
    [{type: 'bot', id: 'a', variant: 'pentagon', position: [100, 100], breathe: true}, /unknown bot field/],
  ];
  for (const [effect, pattern] of bad) assert.throws(() => validateEffects({...scene, effects: [effect]}), pattern);
});
