// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPreviewServer} from '../preview-server.mjs';

test('preview server honors byte ranges so narration can be seeked', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vi-say-preview-server-'));
  const body = Buffer.from('0123456789preview-audio');
  await fs.writeFile(path.join(directory, 'index.html'), '<!doctype html><title>preview</title>');
  await fs.writeFile(path.join(directory, 'clip.wav'), body);
  const server = createPreviewServer(directory);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const full = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(full.status, 200);
    assert.match(await full.text(), /preview/);
    const ranged = await fetch(`http://127.0.0.1:${port}/clip.wav`, {headers: {Range: 'bytes=2-5'}});
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get('accept-ranges'), 'bytes');
    assert.equal(ranged.headers.get('content-range'), `bytes 2-5/${body.length}`);
    assert.equal(Buffer.from(await ranged.arrayBuffer()).toString(), '2345');
    const missing = await fetch(`http://127.0.0.1:${port}/missing.wav`);
    assert.equal(missing.status, 404);
    const outside = await fetch(`http://127.0.0.1:${port}/%2e%2e/package.json`);
    assert.ok(outside.status === 403 || outside.status === 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, {recursive: true, force: true});
  }
});
