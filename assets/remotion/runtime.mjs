// Shared, lockfile-addressed dependencies. No npm install in project copies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const exists = p => fs.access(p).then(() => true, () => false);
export function cacheKey(lock, platform = process.platform, arch = process.arch, node = process.versions.node.split('.')[0]) {
  return createHash('sha256').update(lock).update(`\0${platform}\0${arch}\0${node}`).digest('hex').slice(0, 20);
}
export async function runtimeLocation(source = here) {
  const lock = await fs.readFile(path.join(source, 'package-lock.json'));
  const base = process.env.NARRATED_VIDEO_CACHE || path.resolve(here, '../../.cache');
  return path.resolve(base, 'remotion', cacheKey(lock));
}
async function healthy(dir, manifest) {
  if (!await exists(path.join(dir, '.ready.json'))) return false;
  try {
    for (const [name, version] of Object.entries(manifest.dependencies)) {
      const p = JSON.parse(await fs.readFile(path.join(dir, 'node_modules', name, 'package.json')));
      if (p.version !== version) return false;
    }
    return true;
  } catch { return false; }
}
export async function prepareRuntime(source = here) {
  const dir = await runtimeLocation(source);
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json')));
  if (await healthy(dir, manifest)) return {dir, reused: true};
  await fs.mkdir(path.dirname(dir), {recursive: true});
  const lockDir = `${dir}.install-lock`;
  const deadline = Date.now() + 300000;
  while (true) {
    try { await fs.mkdir(lockDir); break; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await healthy(dir, manifest)) return {dir, reused: true};
      if (Date.now() > deadline) throw new Error(`Shared install still locked: ${lockDir}. Check its owner before removing a stale lock.`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  try {
    if (await healthy(dir, manifest)) return {dir, reused: true};
    await fs.writeFile(path.join(lockDir, 'owner.json'), JSON.stringify({pid: process.pid, started: new Date().toISOString()}));
    await fs.mkdir(dir, {recursive: true});
    await fs.rm(path.join(dir, '.ready.json'), {force: true});
    for (const name of ['package.json', 'package-lock.json']) await fs.copyFile(path.join(source, name), path.join(dir, name));
    console.error(`Installing shared Remotion dependencies once: ${dir}`);
    await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], {cwd: dir, stdio: 'inherit'});
      child.on('error', reject);
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`npm ci failed (${code}); cache is not marked ready`)));
    });
    await fs.writeFile(path.join(dir, '.ready.json'), JSON.stringify({dependencies: manifest.dependencies, installed: new Date().toISOString()}));
    if (!await healthy(dir, manifest)) throw new Error('Shared dependency version check failed');
    return {dir, reused: false};
  } finally { await fs.rm(lockDir, {recursive: true, force: true}); }
}
export async function loadRuntime() {
  const runtime = await prepareRuntime();
  console.error(`Remotion shared runtime (${runtime.reused ? 'reused' : 'installed'}): ${runtime.dir}`);
  const require = createRequire(path.join(runtime.dir, 'package.json'));
  const [bundler, renderer] = await Promise.all(['@remotion/bundler', '@remotion/renderer'].map(name => import(pathToFileURL(require.resolve(name)).href)));
  return {...runtime, bundler, renderer, nodeModules: path.join(runtime.dir, 'node_modules')};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (process.argv.includes('--path') ? runtimeLocation().then(dir => ({dir})) : prepareRuntime())
    .then(x => console.log(JSON.stringify(x))).catch(e => {console.error(e.message); process.exitCode = 1;});
}
