// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../render.mjs';
import {mapPodcastAssets, podcastStillPoints} from '../podcast-contract.mjs';

function timeline() {
  return {
    aspect: '16:9', fps: 30, duration: 5.025, audio: 'narration.wav',
    captions: [{start: 0, end: 5, text: '新旁白', en: 'New narration'}],
    podcast: {
      title: '节目精华', source: '访谈画面',
      shots: [
        {start: 0, end: 2, video: 'clip.mp4', videoStart: 6, sourceTime: '12:32'},
        {start: 2, end: 5.025, image: 'example.png', source: '官方截图', label: '概念'},
      ],
      highlights: [{start: 1, end: 3, label: '重点', text: '通俗解释', detail: '一个例子'}],
    },
  };
}

test('podcast uses the normal validator and stages each clip or still', async () => {
  const doc = validate(timeline());
  assert.deepEqual(doc.overlays, []);
  await mapPodcastAssets(doc, name => `local/${name}`);
  assert.equal(doc.podcast.shots[0].video, 'local/clip.mp4');
  assert.equal(doc.podcast.shots[1].image, 'local/example.png');
  assert.equal(doc.podcast.shots[0].sourceTime, '12:32');

  const points = podcastStillPoints(doc);
  assert.deepEqual(points.slice(-3).map(({frame, reason}) => [frame, reason]), [
    [59, 'before-shot-cut'], [60, 'shot-in'], [150, 'last-frame'],
  ]);
  assert.ok(points.some(({reason}) => reason === 'highlight-enter'));
  assert.ok(points.some(({reason}) => reason === 'highlight-hold'));
});

test('podcast rejects mixed render modes, ambiguous footage, timeline gaps and colliding highlights', () => {
  const doc = timeline();
  assert.throws(() => validate({...doc, video: 'legacy.mp4'}), /podcast\.shots/);
  assert.throws(() => validate({...doc, aspect: '4:3'}), /requires 16:9/);
  assert.throws(() => validate({...doc, captions: []}), /final narration captions/);
  doc.podcast.shots[0].image = 'also-a-still.png';
  assert.throws(() => validate(doc), /one local image or video/);
  delete doc.podcast.shots[0].image;
  doc.podcast.shots[1].start = 2.2;
  assert.throws(() => validate(doc), /without gaps or overlaps/);
  doc.podcast.shots[1].start = 2;
  doc.podcast.shots[1].videoStart = 4;
  assert.throws(() => validate(doc), /source offset/);
  delete doc.podcast.shots[1].videoStart;
  doc.podcast.highlights.push({start: 2.99, end: 4, label: '下一点', text: '这里重叠'});
  assert.throws(() => validate(doc), /non-overlapping/);
});

test('podcast validates the callout appearance and safe corner', () => {
  const doc = timeline();
  doc.podcast.calloutStyle = 'comic';
  doc.podcast.highlights[0].position = 'bottom-left';
  assert.equal(validate(doc).podcast.calloutStyle, 'comic');
  assert.equal(validate(doc).podcast.highlights[0].position, 'bottom-left');

  doc.podcast.calloutStyle = 'constructor';
  assert.throws(() => validate(doc), /choose editorial or comic/);
  doc.podcast.calloutStyle = 'editorial';
  doc.podcast.highlights[0].position = 'center';
  assert.throws(() => validate(doc), /choose top-left/);
});
