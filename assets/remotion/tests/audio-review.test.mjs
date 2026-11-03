import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectAudioReview, audioRenderDecision} from '../audio-review.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
function wav(value = 0) {
  const b = Buffer.alloc(48);
  b.write('RIFF'); b.writeUInt32LE(40, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(48000, 24); b.writeUInt32LE(96000, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36);
  b.writeUInt32LE(4, 40); b.writeInt16LE(value, 44);
  return b;
}
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-review-test-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  const plan = {spoken_text: '使用 CSS。', spoken_sha256: hash('使用 CSS。'), ready_for_synthesis: true,
    unresolved_terms: [], terms: [{term: 'CSS', spoken: 'CSS'}]};
  const record = {audio_sha256: hash(wav(10)), spoken_sha256: plan.spoken_sha256,
    method: 'human_direct_playback', scope: 'full_final_track', reviewer: 'synthetic test fixture',
    performed_at: 'fixture, not actual listening', verdict: 'no_unresolved_pronunciation_issue',
    checks: {pronunciation: 'passed', term_fluency: 'passed', voice_consistency: 'passed'},
    reviewed_terms: ['CSS'], unresolved_items: [], evidence: {path: 'evidence.txt', sha256: hash('synthetic evidence')}};
  const doc = {audio: 'audio.wav', cartoonScenes: [{}], visualPreview: false,
    audioReview: {pronunciation: 'pronunciation.json', listening: 'listening.json'}};
  const save = async () => {
    await fs.writeFile(path.join(dir, 'audio.wav'), wav(10));
    await fs.writeFile(path.join(dir, 'pronunciation.json'), JSON.stringify(plan));
    await fs.writeFile(path.join(dir, 'listening.json'), JSON.stringify(record));
    await fs.writeFile(path.join(dir, 'evidence.txt'), 'synthetic evidence');
  };
  await save();
  const inspect = () => inspectAudioReview(doc, {timelinePath: path.join(dir, 'timeline.json')});
  return {dir, doc, plan, record, save, inspect};
}

test('matching complete listening record is validated without certifying sound', async t => {
  const f = await fixture(t), result = await f.inspect();
  assert.equal(result.recordValidated, true);
  assert.equal(result.audioQualityAutomaticallyCertified, false);
  assert.equal(audioRenderDecision(result, {output: 'final.mp4'}).listeningRecordValidated, true);
});

test('missing review blocks final even when filename says candidate', async t => {
  const f = await fixture(t); delete f.doc.audioReview;
  const result = await f.inspect();
  assert.equal(result.recordValidated, false);
  assert.throws(() => audioRenderDecision(result, {output: 'candidate.mp4'}), /requires a valid/);
  assert.throws(() => audioRenderDecision(result, {unreviewedAudio: true, output: 'final.mp4'}), /filename/);
  for (const output of ['候选.mp4', '声音预览.mp4', 'Preview.mp4', 'test-candidate.mp4']) {
    const decision = audioRenderDecision(result, {unreviewedAudio: true, output});
    assert.equal(decision.mode, 'unreviewed_audio_candidate');
    assert.equal(decision.listeningRecordValidated, false);
    assert.equal(decision.audioQualityAutomaticallyCertified, false);
  }
});

test('stale WAV, script, method, partial scope, verdict, terms and unresolved issues fail', async t => {
  const changes = [
    ['audio_sha256', '0'.repeat(64)], ['spoken_sha256', '0'.repeat(64)],
    ['method', 'asr'], ['scope', 'sample'], ['verdict', 'passed'],
    ['reviewed_terms', []], ['reviewed_terms', ['CSS', 'JSON']],
    ['reviewed_terms', 'CSS'], ['reviewer', ''], ['performed_at', ''],
    ['unresolved_items', ['CSS uncertain']], ['unresolved_items', null]
  ];
  for (const [key, value] of changes) {
    const f = await fixture(t); f.record[key] = value; await f.save();
    const result = await f.inspect();
    assert.equal(result.recordValidated, false, key);
    assert.throws(() => audioRenderDecision(result, {output: 'final.mp4'}));
  }
});

test('changed plan text, unresolved terms and malformed plans fail closed', async t => {
  for (const update of [{spoken_text: '改稿。'}, {ready_for_synthesis: false},
    {unresolved_terms: ['JSON']}, {terms: null}, {terms: [{}]}]) {
    const f = await fixture(t); Object.assign(f.plan, update); await f.save();
    assert.equal((await f.inspect()).recordValidated, false);
  }
  const f = await fixture(t);
  await fs.writeFile(path.join(f.dir, 'listening.json'), '[]');
  assert.equal((await f.inspect()).recordValidated, false);
});

test('pronunciation, term fluency and voice consistency each require explicit passed listening conclusions', async t => {
  for (const checks of [undefined, null, [], 'passed']) {
    const f = await fixture(t); f.record.checks = checks; await f.save();
    assert.equal((await f.inspect()).recordValidated, false);
  }
  for (const name of ['pronunciation', 'term_fluency', 'voice_consistency']) {
    for (const value of [undefined, 'failed', 'not_checked', true]) {
      const f = await fixture(t); f.record.checks[name] = value; await f.save();
      const result = await f.inspect();
      assert.equal(result.recordValidated, false, `${name}: ${value}`);
      assert.ok(result.issues.some(issue => issue.includes(name)));
      assert.throws(() => audioRenderDecision(result, {output: 'final.mp4'}));
    }
  }
});

test('missing, stale or remote evidence never validates', async t => {
  for (const pathValue of ['missing.txt', 'https://example.com/evidence', '/tmp/evidence']) {
    const f = await fixture(t); f.record.evidence.path = pathValue; await f.save();
    assert.equal((await f.inspect()).recordValidated, false);
  }
  const f = await fixture(t);
  await fs.writeFile(path.join(f.dir, 'evidence.txt'), 'changed evidence');
  assert.equal((await f.inspect()).recordValidated, false);
});

test('overlay/editorial routes are unaffected; silent preview must really be silent', async t => {
  const f = await fixture(t);
  assert.equal((await inspectAudioReview({audio: 'missing', overlays: []}, {timelinePath: 'none'})).required, false);
  assert.equal((await inspectAudioReview({audio: 'missing', scenes: [{}]}, {timelinePath: 'none'})).required, false);
  f.doc.visualPreview = true;
  const audiblePreview = await f.inspect();
  assert.throws(() => audioRenderDecision(audiblePreview, {unreviewedAudio: true, output: 'candidate.mp4'}), /genuinely silent/);
  await fs.writeFile(path.join(f.dir, 'audio.wav'), wav());
  const result = await f.inspect();
  assert.equal(result.required, false);
  assert.equal(result.status, 'silent_visual_preview');
});

test('CLI independently reports gate status and blocks missing review before browser runtime', async t => {
  const f = await fixture(t);
  delete f.doc.audioReview;
  const doc = {...f.doc, aspect: '16:9', fps: 30, duration: 2, captions: [], overlays: [],
    styleId: 'colorful-dragon-v1', character: 'dragon.png',
    cartoonScenes: [{kind: 'hero', start: 0, end: 2, title: '测试', subtitle: '合成测试夹具'}]};
  await fs.copyFile(path.join(ROOT, 'assets/production/dragon.png'), path.join(f.dir, 'dragon.png'));
  const input = path.join(f.dir, 'timeline.json');
  await fs.writeFile(input, JSON.stringify(doc));
  const run = flags => spawnSync(process.execPath, [path.join(ROOT, 'assets/remotion/render.mjs'), input,
    path.join(f.dir, 'final.mp4'), ...flags], {encoding: 'utf8', timeout: 15000});
  const check = run(['--validate-only']);
  assert.equal(check.status, 0, check.stderr);
  const status = JSON.parse(check.stdout);
  assert.equal(status.valid, true); assert.equal(status.audioReview.recordValidated, false);
  const audit = run(['--audit-only']);
  assert.equal(audit.status, 0, audit.stderr);
  assert.equal(JSON.parse(audit.stdout).audioReview.recordValidated, false);
  assert.equal(JSON.parse(audit.stdout).qualityAssessed, false);
  const render = run([]);
  assert.equal(render.status, 1); assert.match(render.stderr, /requires a valid full-track listening record/);
  assert.doesNotMatch(render.stdout + render.stderr, /shared runtime|Downloading/);
  const badCandidate = run(['--unreviewed-audio']);
  assert.equal(badCandidate.status, 1); assert.match(badCandidate.stderr, /filename/);
});
