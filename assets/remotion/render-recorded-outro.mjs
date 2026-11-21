// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadRuntime} from './runtime.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: render-recorded-outro.mjs PROPS.json OUTPUT.mp4');
const props = path.resolve(input);
const outputLocation = path.resolve(output);
const doc = JSON.parse(await fs.readFile(props, 'utf8'));
const runtime = await loadRuntime();
const previous = process.cwd();
try {
  process.chdir(runtime.dir); // Reuse the shared browser as well as shared dependencies.
  const serveUrl = await runtime.bundler.bundle({
    entryPoint: path.join(here, 'src/recorded-outro.jsx'),
    publicDir: path.join(path.dirname(props), 'public'),
    outDir: path.join(path.dirname(props), 'bundle'),
    rootDir: runtime.dir,
    webpackOverride: c => ({...c, cache:{type:'memory'},
      resolve:{...c.resolve, modules:[runtime.nodeModules, ...(c.resolve?.modules ?? [])]},
      resolveLoader:{...c.resolveLoader, modules:[runtime.nodeModules, ...(c.resolveLoader?.modules ?? [])]}}),
  });
  const options = {serveUrl, id:'RecordedOutro', inputProps:{doc},
    chromiumOptions:{gl:process.env.VI_SAY_GL ?? (process.platform==='darwin'?'angle':'swangle')}};
  const composition = await runtime.renderer.selectComposition(options);
  await runtime.renderer.renderMedia({...options, composition, outputLocation, codec:'h264',
    pixelFormat:'yuv420p', muted:true, crf:17, concurrency:2, overwrite:false});
} finally {
  process.chdir(previous);
}
