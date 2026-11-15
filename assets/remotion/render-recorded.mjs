// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadRuntime} from './runtime.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const [input,output,...flags]=process.argv.slice(2);
if(!input||!output)throw new Error('Usage: render-recorded.mjs TIMELINE OUTPUT [--still=FRAME] [--validate-only]');
if(flags.some(x=>x!=='--validate-only'&&!/^--still=\d+$/.test(x)))throw new Error('Unknown option');
const timeline=path.resolve(input),destination=path.resolve(output);
const python=process.env.VI_SAY_PYTHON??path.resolve(here,'../../.venv/bin/python');
const audit=spawnSync(python,[path.resolve(here,'../../scripts/check_recorded_story.py'),timeline],{encoding:'utf8'});
if(audit.status!==0)throw new Error(audit.stderr||audit.stdout||String(audit.error));
const props=JSON.parse(await fs.readFile(timeline,'utf8'));
const publicDir=path.resolve(path.dirname(timeline),'public');
for(const asset of [props.video,props.audio,props.cover?.image].filter(Boolean)){
 const resolved=path.resolve(publicDir,asset);
 if(!resolved.startsWith(publicDir+path.sep))throw new Error('Media must be inside public/');
 await fs.access(resolved);
}
// Rendering must consume exactly the audio inspected by the Python check.
const inspected=await fs.readFile(path.resolve(path.dirname(timeline),props.audioFile));
if(!inspected.equals(await fs.readFile(path.resolve(publicDir,props.audio))))throw new Error('Rendered and checked audio differ');
if(flags.includes('--validate-only')){process.stdout.write(audit.stdout);process.exit(0);}
try{await fs.access(destination);throw new Error('Refusing to overwrite output');}catch(e){if(e.code!=='ENOENT')throw e;}
const runtime=await loadRuntime();
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'vi-say-recorded-'));
const previous=process.cwd();
try{
 process.chdir(runtime.dir);
 const serveUrl=await runtime.bundler.bundle({entryPoint:path.join(here,'src/recorded-entry.jsx'),publicDir,outDir:path.join(temporary,'bundle'),rootDir:runtime.dir,
 webpackOverride:c=>({...c,cache:{type:'memory'},resolve:{...c.resolve,modules:[runtime.nodeModules,...(c.resolve?.modules??[])]},resolveLoader:{...c.resolveLoader,modules:[runtime.nodeModules,...(c.resolveLoader?.modules??[])]}})});
 const options={serveUrl,id:'RecordedComic',inputProps:props,chromiumOptions:{gl:process.env.VI_SAY_GL??(process.platform==='darwin'?'angle':'swangle')}};
 const composition=await runtime.renderer.selectComposition(options);
 await fs.mkdir(path.dirname(destination),{recursive:true});
 const still=flags.find(x=>x.startsWith('--still='));
 if(still)await runtime.renderer.renderStill({...options,composition,frame:Number(still.split('=')[1]),output:destination});
 else await runtime.renderer.renderMedia({...options,composition,outputLocation:destination,codec:'h264',audioCodec:'aac',pixelFormat:'yuv420p',crf:18,concurrency:2,overwrite:false});
}finally{process.chdir(previous);await fs.rm(temporary,{recursive:true,force:true});}
