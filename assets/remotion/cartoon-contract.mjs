// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import {hasCartoonTransition, validateTransitionPool} from './cartoon-transitions.mjs';
export const style = JSON.parse(fs.readFileSync(new URL('../production/style.json', import.meta.url), 'utf8'));
const finite = x => typeof x === 'number' && Number.isFinite(x);
const fail = msg => {throw new Error(`cartoon: ${msg}`);};
const text = (s, max, label) => {if (typeof s !== 'string' || !s.trim() || [...s].length > max) fail(`${label} needs 1–${max} characters`);};
export function validateCartoon(doc) {
  if (!Object.hasOwn(doc, 'cartoonScenes')) return doc;
  validateTransitionPool(style.motion.transitionKinds);
  if (doc.aspect !== '16:9' || doc.scenes || doc.video || doc.image || doc.overlays?.length || doc.motions?.length) fail('use independent 16:9 cartoon scenes; do not mix legacy layout fields');
  if (doc.styleId !== style.id) fail('unknown styleId');
  text(doc.character, 4096, 'character path');
  if (doc.speechMotion || doc.characterClosed) {
    text(doc.characterClosed,4096,'closed mouth asset');
    const m=doc.speechMotion;
    if (!m || m.fps!==doc.fps || Math.abs(m.duration-doc.duration)>.001 || !Array.isArray(m.values) || m.values.length!==Math.ceil(doc.duration*doc.fps) || m.values.some(x=>!finite(x)||x<0||x>1) || !/^[a-f0-9]{64}$/.test(m.audio_sha256??'')) fail('mouth motion must match the final audio duration/fps/hash');
  }
  if (!Array.isArray(doc.cartoonScenes) || !doc.cartoonScenes.length) fail('scenes required');
  let end = 0;
  for (const s of doc.cartoonScenes) {
    if (!['hero','steps','demo','cta'].includes(s.kind)) fail('unsupported scene kind');
    if (!finite(s.start) || !finite(s.end) || Math.abs(s.start-end) > .001 || s.end-s.start < 1.5) fail('contiguous scenes of at least 1.5 seconds required');
    if (s.end > doc.duration + .001) fail('scene exceeds audio');
    end = s.end;
    text(s.title, 22, 'title');
    if (s.characterSide && !['left','right'].includes(s.characterSide)) fail('characterSide must be left or right');
    if (s.transition !== undefined && !hasCartoonTransition(s.transition)) fail('unsupported transition');
    if (s.outroId) {
      const outro=JSON.parse(fs.readFileSync(new URL('../production/outro.json',import.meta.url),'utf8'));
      if (s.outroId!==outro.id || s.kind!=='cta' || s!==doc.cartoonScenes.at(-1) || JSON.stringify(s.items?.map(x=>x.text))!==JSON.stringify(outro.items.map(x=>x.text))) fail('shared outro must end the video with the canonical actions');
    }
    if (s.subtitle) text(s.subtitle, 38, 'subtitle');
    if (s.label) text(s.label, 18, 'label');
    if (s.kind === 'demo') {
      if (Boolean(s.image) === Boolean(s.video)) fail('demo needs exactly one actual image or video');
      text(s.image || s.video, 4096, 'demo media');
      if (s.videoStart !== undefined && (!s.video || !finite(s.videoStart) || s.videoStart < 0)) fail('videoStart needs a video and finite nonnegative seconds');
    }
    if (['steps','cta'].includes(s.kind)) {
      if (!Array.isArray(s.items) || s.items.length < 2 || s.items.length > 3) fail('steps/cta need 2–3 items');
      let previous = -1;
      for (const item of s.items) {
        text(item.text, 6, 'item');
        if (item.detail) text(item.detail, 18, 'item detail');
        if (!finite(item.at) || item.at < 0 || item.at < previous + style.motion.enter || item.at + style.motion.enter > s.end - s.start - style.motion.exit) fail('item anchors must allow fixed-duration completion and end hold');
        previous = item.at;
      }
    }
  }
  if (Math.abs(end-doc.duration) > .001) fail('scenes must cover final audio');
  return doc;
}
export async function mapCartoonAssets(doc, resolve) {
  if (!doc.cartoonScenes) return;
  doc.character = await resolve(doc.character);
  if (doc.characterClosed) doc.characterClosed=await resolve(doc.characterClosed);
  for (const s of doc.cartoonScenes) for (const key of ['image','video']) if (s[key]) s[key] = await resolve(s[key]);
}
export function cartoonStillPoints(doc) {
  if (!doc.cartoonScenes) return null;
  return doc.cartoonScenes.flatMap((s, i) => {
    const times = [0, .35, Math.min(s.end-s.start-.25, 1.2),
      ...(s.kind==='hero'&&s.end-s.start>3.3?[2,3]:[]),
      ...(s.items ?? []).map(x => x.at + style.motion.enter)];
    return [...new Set(times)].map(t => ({frame: Math.min(Math.ceil(doc.duration*doc.fps)-1, Math.round((s.start+t)*doc.fps)), sceneId: `cartoon-${i+1}`, reason: 'entry / semantic state'}));
  });
}
