// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

// Export an existing HTML preview with its original composition and media.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {loadRuntime} from './runtime.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [input, output, ...args] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: render-preview.mjs PREVIEW_DIR OUTPUT --composition-entry FILE [--frames FIRST-LAST | --still FRAME] [--mute]');
let entry, frameRange, still, muted = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--composition-entry' && args[i + 1]) entry = path.resolve(args[++i]);
  else if (args[i] === '--frames' && /^\d+-\d+$/.test(args[i + 1] ?? '')) frameRange = args[++i].split('-').map(Number);
  else if (args[i] === '--still' && /^\d+$/.test(args[i + 1] ?? '')) still = Number(args[++i]);
  else if (args[i] === '--mute') muted = true;
  else throw new Error(`Unknown or incomplete option: ${args[i]}`);
}
if (!entry || (frameRange && still !== undefined)) throw new Error('Choose a composition and at most one frame selection');
const previewDir = path.resolve(input), destination = path.resolve(output);
const source = await fs.readFile(path.join(previewDir, 'timeline.js'), 'utf8');
const match = source.match(/^\s*window\.viSayPreview\s*=\s*([\s\S]+);\s*$/);
if (!match) throw new Error('Expected an HTML preview timeline.js JSON assignment');
const preview = JSON.parse(match[1]);
if (!preview.props || typeof preview.props !== 'object') throw new Error('Missing preview props');
await fs.access(entry);
try { await fs.access(destination); throw new Error('Refusing to overwrite output'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const runtime = await loadRuntime();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'vi-say-preview-render-'));
const previous = process.cwd();
try {
  process.chdir(runtime.dir);
  const bundleDir = path.join(temporary, 'bundle');
  const serveUrl = await runtime.bundler.bundle({
    entryPoint: path.join(here, 'src/preview-render-entry.jsx'),
    publicDir: previewDir, outDir: bundleDir, rootDir: runtime.dir,
    webpackOverride: config => ({...config, cache: {type: 'memory'},
      resolve: {...config.resolve, alias: {...config.resolve?.alias, 'vi-say-preview-composition': entry},
        modules: [runtime.nodeModules, ...(config.resolve?.modules ?? [])]},
      resolveLoader: {...config.resolveLoader, modules: [runtime.nodeModules, ...(config.resolveLoader?.modules ?? [])]},
    }),
  });
  // Legacy custom previews use new URL('media/...', location.href), while
  // standard compositions use staticFile(). Support both without changing them.
  try { await fs.symlink(path.join(previewDir, 'media'), path.join(bundleDir, 'media'), 'dir'); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const options = {serveUrl, id: 'ApprovedPreview', inputProps: preview,
    chromiumOptions: {gl: process.env.VI_SAY_GL ?? (process.platform === 'darwin' ? 'angle' : 'swangle')}};
  const composition = await runtime.renderer.selectComposition(options);
  const frames = frameRange ?? (still === undefined ? [0, composition.durationInFrames - 1] : [still, still]);
  if (frames[0] > frames[1] || frames[1] >= composition.durationInFrames) throw new Error('Frame selection is outside the composition');
  await fs.mkdir(path.dirname(destination), {recursive: true});
  if (still !== undefined) await runtime.renderer.renderStill({...options, composition, frame: still, output: destination});
  else {
    let last = -1;
    await runtime.renderer.renderMedia({...options, composition, frameRange,
      outputLocation: destination, codec: 'h264', audioCodec: 'aac',
      muted, pixelFormat: 'yuv420p', crf: 16, concurrency: 2, overwrite: false,
      onProgress: ({progress}) => {
        const step = Math.floor(progress * 20);
        if (step > last) { last = step; console.log(`Rendered ${step * 5}%`); }
      },
    });
  }
  console.log(JSON.stringify({output: destination, width: composition.width, height: composition.height,
    fps: composition.fps, frames, muted}));
} finally {
  process.chdir(previous);
  await fs.rm(temporary, {recursive: true, force: true});
}
