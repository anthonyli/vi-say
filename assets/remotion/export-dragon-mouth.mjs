// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadRuntime} from './runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
if (!process.argv[2]) throw new Error('Usage: node assets/remotion/export-dragon-mouth.mjs OUTPUT_DIRECTORY');
const outputDir=path.resolve(process.argv[2]);
const geometry=JSON.parse(await fs.readFile(path.join(root,'assets/production/dragon-mouth-shapes.json')));
await fs.mkdir(outputDir,{recursive:true});
const targets=[...Object.keys(geometry.shapes).map(cue=>`mouth-${cue}.png`),'manifest.json'];
for (const name of targets) {
  try {await fs.access(path.join(outputDir,name));}
  catch {continue;}
  throw new Error(`Output already exists: ${path.join(outputDir,name)}. Choose a new directory.`);
}

const runtime=await loadRuntime();
process.chdir(runtime.dir);
const bundleDir=await fs.mkdtemp(path.join(os.tmpdir(),'vi-say-mouth-'));
const sha=data=>createHash('sha256').update(data).digest('hex');
try {
  const serveUrl=await runtime.bundler.bundle({
    entryPoint:path.join(here,'src/dragon-mouth-stills.jsx'),
    publicDir:path.join(root,'assets/production'),outDir:bundleDir,rootDir:runtime.dir,
    webpackOverride:c=>({...c,resolve:{...c.resolve,modules:[runtime.nodeModules,...(c.resolve?.modules??['node_modules'])]},resolveLoader:{...c.resolveLoader,modules:[runtime.nodeModules,...(c.resolveLoader?.modules??['node_modules'])]}}),
  });
  const images=[];
  for (const cue of Object.keys(geometry.shapes)) {
    const composition=await runtime.renderer.selectComposition({serveUrl,id:'DragonMouth',inputProps:{cue}});
    const file=`mouth-${cue}.png`,output=path.join(outputDir,file);
    await runtime.renderer.renderStill({serveUrl,composition,frame:0,inputProps:{cue},output,imageFormat:'png'});
    const data=await fs.readFile(output);
    images.push({cue,file,bytes:data.length,sha256:sha(data)});
    console.log(output);
  }
  if (new Set(images.map(image=>image.sha256)).size!==images.length) {
    throw new Error('Mouth states produced duplicate PNGs; verify cue props before reusing the export.');
  }
  const sources=[];
  for (const file of ['assets/production/dragon-closed.png','assets/production/dragon-neutral.png','assets/production/dragon-mouth-shapes.json','assets/remotion/src/dragon-mouth.jsx']) {
    sources.push({file,sha256:sha(await fs.readFile(path.join(root,file)))});
  }
  await fs.writeFile(path.join(outputDir,'manifest.json'),JSON.stringify({id:geometry.id,imageSize:geometry.imageSize,sourcePathBase:'skill repository root',sources,images},null,2)+'\n');
} finally {
  await fs.rm(bundleDir,{recursive:true,force:true});
}
