// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

export async function buildHtmlPreview(doc, assets, target, runtime, {recorded = false} = {}) {
  const require = createRequire(path.join(runtime.dir, 'package.json'));
  const {build} = require('esbuild');
  const {audioReview, reviewBadgeVisible, audioFile, silentWindows, ...props} = doc;
  const html = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vi-say 视频预览</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #12141a; color: #f6f3ec;
    font: 16px/1.5 "PingFang SC", "Microsoft YaHei", sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 28px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  summary { cursor: pointer; }
  .warn { color: #f0d48a; margin: 0 0 14px; }
  .stage { position: relative; margin: 0 auto 14px; background: #000; border-radius: 14px;
    overflow: hidden; cursor: pointer; }
  .stage .play { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    z-index: 3; display: grid; gap: 4px; justify-items: center; min-width: 220px;
    padding: 16px 22px; border: 0; border-radius: 999px; background: #f6f3ec; color: #17140f;
    font: 700 18px/1.2 inherit; box-shadow: 0 12px 40px #0008; }
  .stage .play small { font-weight: 600; font-size: 13px; color: #5c564c; }
  .loading { margin: 0; padding: 24px; text-align: center; }
  .transport { display: flex; gap: 10px; align-items: center; margin: 0 0 12px; }
  .transport button, .cues button { border: 0; border-radius: 999px; background: #2a3140;
    color: inherit; font: 600 14px/1 inherit; padding: 8px 14px; }
  .transport input[type="range"] { flex: 1; min-width: 80px; accent-color: #f0d48a; }
  .time { font-variant-numeric: tabular-nums; color: #c9c2b4; }
  .cues { list-style: none; margin: 0; padding: 0; max-height: 280px; overflow: auto; }
  .cues li { margin: 0; }
  .cues button { display: flex; gap: 12px; width: 100%; text-align: left; border-radius: 10px;
    background: transparent; }
  .cues .active button { background: #2a3140; }
  .cues button:disabled { opacity: .6; }
  .cues button span { color: #f0d48a; font-variant-numeric: tabular-nums; }
</style>
<div id="root">正在打开预览…</div>
<script defer src="./timeline.js"></script>
<script defer src="./player.js"></script>
</html>
`;
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.mkdir(target);
  try {
    const media = path.join(target, 'media');
    await fs.mkdir(media);
    for (const [source, name] of assets) {
      const destination = path.resolve(media, name);
      if (!destination.startsWith(media + path.sep)) throw new Error('Preview media needs a path inside media/');
      await fs.mkdir(path.dirname(destination), {recursive: true});
      await fs.copyFile(source, destination);
    }
    await build({
      entryPoints: [fileURLToPath(new URL('./src/preview.jsx', import.meta.url))],
      outfile: path.join(target, 'player.js'),
      nodePaths: [runtime.nodeModules],
      bundle: true,
      minify: true,
      charset: 'utf8',
      target: 'chrome110',
    });
    await fs.writeFile(path.join(target, 'timeline.js'), `window.viSayPreview = ${JSON.stringify({props, recorded})};\n`);
    await fs.writeFile(path.join(target, 'index.html'), html);
  } catch (error) {
    await fs.rm(target, {recursive: true, force: true});
    throw error;
  }
  return path.join(target, 'index.html');
}
