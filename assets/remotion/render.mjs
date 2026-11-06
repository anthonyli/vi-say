// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {auditEditorial, editorialStillPoints, mapEditorialAssets, validateEditorial} from './editorial-contract.mjs';
import {validateCartoon, mapCartoonAssets, cartoonStillPoints} from './cartoon-contract.mjs';
import {loadRuntime} from './runtime.mjs';
import {resolveCartoonTransitions,transitionPlan} from './cartoon-motion.mjs';
import {GL_TRANSITIONS} from './gl-transitions.mjs';
import {createRequire} from 'node:module';
import {captionText} from './effects/captions.mjs';
import {inspectAudioReview, audioRenderDecision} from './audio-review.mjs';

const types = new Set(['big-title', 'keyword', 'bullet-list', 'number', 'quote', 'comparison', 'browser', 'code', 'diagram', 'progress', 'chapter-label', 'info-card', 'input-bar']);
const fail = message => {throw new Error(message);};
const finite = x => typeof x === 'number' && Number.isFinite(x);
const hasText = x => typeof x === 'string' && x.trim().length > 0;
const rect = box => Array.isArray(box) && box.length === 4 && box.every(finite) &&
  box[0] >= 0 && box[1] >= 0 && box[2] > 0 && box[3] > 0 && box[0] + box[2] <= 1 && box[1] + box[3] <= 1;

export function validate(doc) {
  if(doc.fontWeightRange!==undefined){const weights=typeof doc.fontWeightRange==='string'?doc.fontWeightRange.split(' ').map(Number):[];if(!doc.fontFile||weights.length!==2||weights.some(n=>!finite(n)||n<1||n>1000)||weights[0]>weights[1])fail('fontWeightRange needs a font file and an ascending weight range');}
  if(doc.modules!==undefined&&!Object.hasOwn(doc,'cartoonScenes'))fail('modules require a 16:9 cartoon scene timeline');
  // New scene timelines do not need legacy overlays. Preserve the old contract
  // for overlay-only documents, and normalize only an omitted editorial field.
  if (Object.hasOwn(doc, 'scenes') && !Object.hasOwn(doc, 'overlays')) doc = {...doc, overlays: []};
  if (!['16:9', '4:3', '3:4'].includes(doc.aspect)) fail('Choose aspect 16:9, 4:3 or 3:4');
  if (!Number.isInteger(doc.fps) || doc.fps < 12 || doc.fps > 60) fail('fps must be 12–60');
  if (!finite(doc.duration) || doc.duration <= 0) fail('duration must be measured from the final audio');
  if (!hasText(doc.audio)) fail('A continuous audio file is required');
  if (doc.video && doc.image) fail('Choose a video or an image base, not both');
  if (doc.videoFit && !['contain', 'cover'].includes(doc.videoFit)) fail('videoFit must be contain or cover');
  for (const key of ['videoBox', 'cardBox']) if (doc[key] && !rect(doc[key])) fail(`Invalid ${key}`);
  if (!Array.isArray(doc.captions) || !Array.isArray(doc.overlays)) fail('captions and overlays must be arrays');
  const interval = c => {
    if (!finite(c.start) || !finite(c.end) || c.start < 0 || c.end <= c.start || c.end > doc.duration + .001) fail('Invalid final-audio interval');
  };
  let lastEnd = 0;
  for (const cue of doc.captions) {
    interval(cue);
    if (cue.start < lastEnd || !hasText(cue.text)) fail('Captions must be ordered, non-overlapping and nonempty');
    if(!hasText(captionText(cue.text,doc.modules?.captions??{})))fail('Caption display text is empty after punctuation cleanup');
    if (cue.text.split('\n').length > 2 || [...cue.text].length > 44) fail('Split long captions into at most two short lines');
    lastEnd = cue.end;
    if (cue.tokens) {
      if (!Array.isArray(cue.tokens) || cue.tokens.map(t => t.text).join('') !== cue.text) fail('Tokens must preserve exact caption text including punctuation');
      let tokenEnd = cue.start;
      for (const token of cue.tokens) {
        interval(token);
        if (typeof token.text !== 'string' || !token.text.length || token.start < tokenEnd - .001 || token.end > cue.end + .001) fail('Tokens must be ordered within their caption');
        tokenEnd = token.end;
      }
    }
  }
  for (const cue of doc.overlays) {
    interval(cue);
    if (!types.has(cue.type)) fail(`Unknown overlay type: ${cue.type}`);
    if (!hasText(cue.text)) fail('Each overlay needs a short text/title');
    if (cue.box && !rect(cue.box)) fail('Invalid overlay box');
    if (cue.type === 'browser' && cue.image && !hasText(cue.image)) fail('browser image path must be a non-empty string');
    if (doc.scenes && cue.type === 'browser' && !hasText(cue.image)) fail('Editorial browser overlays require a real image; empty placeholders are unsupported');
    if (cue.type === 'code' && (!hasText(cue.code) || cue.code.split('\n').length > 8)) fail('code needs at most eight lines');
    if (['diagram', 'bullet-list'].includes(cue.type) && (!Array.isArray(cue.items) || cue.items.length < 1 || cue.items.length > 3 || !cue.items.every(hasText))) fail('Use one to three short items');
    if (cue.type === 'number' && !(hasText(cue.value) || finite(cue.value))) fail('number needs a value');
    if (cue.type === 'comparison' && ![cue.left, cue.right].every(s => s && hasText(s.title) && hasText(s.text))) fail('comparison needs left/right title and text');
  }
  for (const cue of doc.motions ?? []) {
    interval(cue);
    if (![cue.from ?? 1, cue.to ?? 1.025].every(n => finite(n) && n >= 1 && n <= 1.08)) fail('Use subtle zoom from 1 to at most 1.08');
  }
  return validateCartoon(validateEditorial(doc));
}

function stamp(t) {
  const ms = Math.round(t * 1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
}

async function main() {
  const [timeline, output, ...flags] = process.argv.slice(2);
  const usage = 'Usage: node render.mjs timeline.json output.mp4 [--unreviewed-audio] [--show-review-badge] [--validate-only | --audit-only | --stills directory]';
  if (!timeline || !output) fail(usage);
  let mode = 'render';
  let stillDirectory;
  let unreviewedAudio = false;
  let showReviewBadge = false;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--unreviewed-audio' && !unreviewedAudio) { unreviewedAudio = true; continue; }
    if (flags[i] === '--show-review-badge' && !showReviewBadge) { showReviewBadge = true; continue; }
    if (mode !== 'render') fail(usage);
    if (flags[i] === '--validate-only') mode = 'validate';
    else if (flags[i] === '--audit-only') mode = 'audit';
    else if (flags[i] === '--stills' && flags[i + 1] && !flags[i + 1].startsWith('--')) {
      mode = 'stills';
      stillDirectory = path.resolve(flags[++i]);
    } else fail(usage);
  }
  if (!output.endsWith('.mp4')) fail('Use an .mp4 output path');
  const input = path.resolve(timeline);
  const target = path.resolve(output);
  const subtitle = target.slice(0, -4) + '.srt';
  let doc;
  let warnings;
  let audioReview;
  let audioDecision;
  const assets = new Map();
  async function resolveAsset(value) {
    if (!hasText(value) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) fail('Stage media locally before rendering');
    const source = path.resolve(path.dirname(input), value);
    const stat = await fs.stat(source);
    if (!stat.isFile() || stat.size === 0) fail(`Not a nonempty media file: ${source}`);
    if (!assets.has(source)) assets.set(source, `asset-${assets.size}${path.extname(source)}`);
    return assets.get(source);
  }
  try {
    doc = resolveCartoonTransitions(validate(JSON.parse(await fs.readFile(input, 'utf8'))));
    audioReview = await inspectAudioReview(doc, {timelinePath: input});
    if (doc.speechMotion||doc.mouthCues) {
      const bytes=await fs.readFile(path.resolve(path.dirname(input),doc.audio));
      const hash=createHash('sha256').update(bytes).digest('hex');
      if(doc.speechMotion&&hash!==doc.speechMotion.audio_sha256) fail('Mouth motion belongs to a different audio file; regenerate it');
      if(doc.mouthCues&&hash!==doc.mouthCueAudioSha256)fail('Mouth cues belong to a different audio file; regenerate them');
    }
    warnings = doc.cartoonScenes ? [{code:'CARTOON_REVIEW',message:'Review real frames, word timing and original-speed playback; fixed styling does not certify visual quality.'}] : auditEditorial(doc);
    for (const key of ['audio', 'video', 'image', 'fontFile']) if (doc[key]) doc[key] = await resolveAsset(doc[key]);
    for (const cue of doc.overlays) if (cue.image) cue.image = await resolveAsset(cue.image);
    await mapEditorialAssets(doc, resolveAsset);
    await mapCartoonAssets(doc, resolveAsset);
  } catch (error) {
    if (mode !== 'audit') throw error;
    console.log(JSON.stringify({valid: false, errors: [error.message], warnings: warnings ?? [], qualityAssessed: false}, null, 2));
    process.exitCode = 1;
    return;
  }
  if (doc.fontFile) doc.fontFamily = 'VideoFont, sans-serif';
  if (mode === 'validate') { console.log(JSON.stringify({valid: true, qualityAssessed: false, audioReview})); return; }
  if (mode === 'audit') {
    console.log(JSON.stringify({valid: true, errors: [], warnings, qualityAssessed: false,
      localAssets: assets.size, audioReview, transitions:transitionPlan(doc),stillPoints: cartoonStillPoints(doc) ?? editorialStillPoints(doc)}, null, 2));
    return;
  }
  if (mode === 'render') {
    audioDecision = audioRenderDecision(audioReview, {unreviewedAudio, showReviewBadge, output: target});
    // Review status belongs in the sidecar by default. Burning a production
    // status into the viewer's picture requires a separate explicit choice.
    doc.reviewBadgeVisible = audioDecision.reviewBadgeVisible;
    for (const name of [target, subtitle, ...(audioReview.required ? [target.slice(0, -4) + '.audio-review.json'] : [])]) {
      const exists = await fs.access(name).then(() => true, () => false);
      if (exists) fail(`Output already exists: ${name}`);
    }
    await fs.mkdir(path.dirname(target), {recursive: true});
  } else {
    // Reserve a fresh directory, so a preview can never overwrite previous evidence.
    await fs.mkdir(path.dirname(stillDirectory), {recursive: true});
    await fs.mkdir(stillDirectory);
  }
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'narrated-motion-'));
  const originalCwd = process.cwd();
  try {
    const runtime = await loadRuntime();
    const usesGL=transitionPlan(doc).some(t=>t.engine==='gl');
    // Remotion locates downloaded Chrome relative to cwd's package.json.
    // Keep that browser in the same shared cache, not each video project.
    process.chdir(runtime.dir);
    const {bundle} = runtime.bundler;
    const {renderMedia, renderStill, selectComposition} = runtime.renderer;
    const publicDir = path.join(tmp, 'public');
    await fs.mkdir(publicDir);
    for (const [source, name] of assets) await fs.copyFile(source, path.join(publicDir, name));
    const root = path.dirname(fileURLToPath(import.meta.url));
    if(usesGL){
      const require=createRequire(path.join(runtime.dir,'package.json')),upstream=require('gl-transitions');
      for(const preset of GL_TRANSITIONS){
        const shader=upstream.find(t=>t.name===preset.shader);
        if(!shader||createHash('sha256').update(shader.glsl).digest('hex')!==preset.shaderSha256)fail(`GL shader source does not match the verified catalog: ${preset.name}`);
      }
    }
    const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.jsx'), publicDir, outDir: path.join(tmp, 'bundle'),
      rootDir: runtime.dir,
      webpackOverride: config => ({...config,
        // Concurrent video jobs share dependencies, not writable disk packs.
        // The bundle itself is task-local and is removed in finally below.
        cache:{type:'memory'},
        resolve: {...config.resolve, modules: [runtime.nodeModules, ...(config.resolve?.modules ?? ['node_modules'])]},
        resolveLoader: {...config.resolveLoader, modules: [runtime.nodeModules, ...(config.resolveLoader?.modules ?? ['node_modules'])]}})});
    // Use Remotion's pinned Headless Shell by default. Desktop Chrome can emit
    // isolated tiled/corrupt frames during parallel capture (upstream #9473).
    const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
    const gl=process.env.VI_SAY_GL??(process.platform==='darwin'?'angle':'swangle');
    if(usesGL&&!['angle','swangle'].includes(gl))fail('VI_SAY_GL must be angle or swangle');
    const chromiumOptions=usesGL?{gl}:undefined;
    const composition = await selectComposition({serveUrl, id: 'NarratedVideo', inputProps: doc, browserExecutable,chromiumOptions});
    if (mode === 'stills') {
      const points = cartoonStillPoints(doc) ?? editorialStillPoints(doc);
      const manifest = [];
      for (const [index, point] of points.entries()) {
        const name = `${String(index + 1).padStart(3, '0')}-frame-${String(point.frame).padStart(6, '0')}.png`;
        const outputLocation = path.join(stillDirectory, name);
        await renderStill({serveUrl, composition, inputProps: doc, frame: point.frame,
          imageFormat: 'png', output: outputLocation, overwrite: false, browserExecutable,chromiumOptions});
        manifest.push({...point, file: name});
      }
      await fs.writeFile(path.join(stillDirectory, 'manifest.json'), JSON.stringify({timeline: input,
        fps: doc.fps, width: composition.width, height: composition.height, qualityAssessed: false,
        warnings, audioReview, frames: manifest}, null, 2) + '\n', {flag: 'wx'});
      console.log(JSON.stringify({stills: stillDirectory, frames: manifest.length, warnings, audioReview}));
      return;
    }
    await renderMedia({serveUrl, composition, inputProps: doc, codec: 'h264', audioCodec: 'aac',
      pixelFormat: 'yuv420p', colorSpace: 'bt709', imageFormat: 'png', audioBitrate: '192k', crf: 18, sampleRate: 48000,
      outputLocation: target, overwrite: false, concurrency: 2, browserExecutable,chromiumOptions});
    await fs.writeFile(subtitle, doc.captions.map((c,i) => `${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${captionText(c.text,doc.modules?.captions)}\n`).join('\n'), {flag: 'wx'});
    if (audioReview.required) await fs.writeFile(target.slice(0, -4) + '.audio-review.json', JSON.stringify({
      schema_version: 1, output: target, video_sha256: createHash('sha256').update(await fs.readFile(target)).digest('hex'),
      audio_sha256: audioReview.audioSha256, ...audioDecision, review: audioReview,
      note: 'Record validation does not authenticate the listener or automatically certify sound quality.'
    }, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({output: target, subtitles: subtitle, duration: composition.durationInFrames / doc.fps,
      width: composition.width, height: composition.height, fps: doc.fps, audioReview: audioDecision}));
  } finally { process.chdir(originalCwd); await fs.rm(tmp, {recursive: true, force: true}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
