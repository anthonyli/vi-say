// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import {podcastCalloutStyles} from './podcast-callout-styles.mjs';

const isText = value => typeof value === 'string' && value.trim().length > 0;
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = (field, reason) => { throw new Error(`${field}: ${reason}`); };
export const podcastFrameAt = (seconds, fps) => Math.ceil(seconds * fps);
export const podcastCaptionOptions = {stripPunctuation: true, bottom: 24};

function checkFields(value, field, allowed) {
  if (!isObject(value)) fail(field, 'must be an object');
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${field}.${key}`, 'unsupported field');
  }
}

function requireText(value, field, maxLength) {
  if (!isText(value)) fail(field, 'must be nonempty text');
  if ([...value].length > maxLength) fail(field, `limit text to ${maxLength} characters`);
}

function checkIntervals(items, field, duration, fps, {contiguous, validateItem}) {
  if (!Array.isArray(items) || !items.length) fail(field, 'must be a nonempty list');
  let previousEnd = 0;
  for (const [index, item] of items.entries()) {
    const at = `${field}[${index}]`;
    validateItem(item, at);
    const {start, end} = item;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > duration || end <= start) {
      fail(at, 'start and end must be within the final narration');
    }
    if (podcastFrameAt(end, fps) <= podcastFrameAt(start, fps)) fail(at, 'interval must occupy a frame');
    if (contiguous ? start !== previousEnd : start < previousEnd) {
      fail(at, contiguous ? 'shots must cover the narration without gaps or overlaps' : 'highlights must be ordered and non-overlapping');
    }
    previousEnd = end;
  }
  if (contiguous && previousEnd !== duration) fail(field, 'last shot must end at duration');
}

function validateShot(shot, field) {
  checkFields(shot, field, ['start', 'end', 'image', 'video', 'videoStart', 'label', 'source', 'sourceTime']);
  const assets = ['image', 'video'].filter(key => Object.hasOwn(shot, key));
  if (assets.length !== 1 || !isText(shot[assets[0]])) fail(field, 'choose one local image or video');
  if (Object.hasOwn(shot, 'videoStart') &&
      (!shot.video || !Number.isFinite(shot.videoStart) || shot.videoStart < 0)) {
    fail(`${field}.videoStart`, 'needs a video and a nonnegative source offset in seconds');
  }
  for (const [key, limit] of [['label', 36], ['source', 96], ['sourceTime', 24]]) {
    if (Object.hasOwn(shot, key)) requireText(shot[key], `${field}.${key}`, limit);
  }
}

function validateHighlight(item, field) {
  checkFields(item, field, ['start', 'end', 'label', 'text', 'detail', 'position']);
  requireText(item.label, `${field}.label`, 26);
  requireText(item.text, `${field}.text`, 48);
  if (Object.hasOwn(item, 'detail')) requireText(item.detail, `${field}.detail`, 64);
  if (Object.hasOwn(item, 'position') &&
      !['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(item.position)) {
    fail(`${field}.position`, 'choose top-left, top-right, bottom-left, or bottom-right');
  }
}

export function validatePodcast(doc) {
  if (!Object.hasOwn(doc, 'podcast')) return doc;
  const {podcast, aspect, duration, fps, captions} = doc;
  if (aspect !== '16:9') fail('podcast', 'requires 16:9');
  for (const key of ['video', 'image', 'scenes', 'cartoonScenes', 'videoBox', 'videoFit', 'videoPosition', 'cardBox']) {
    if (Object.hasOwn(doc, key)) fail(key, 'use podcast.shots for the footage layout');
  }
  if (doc.overlays.length || doc.motions?.length) fail('podcast', 'use podcast.highlights for callouts');
  checkFields(podcast, 'podcast', ['title', 'source', 'calloutStyle', 'shots', 'highlights']);
  if (Object.hasOwn(podcast, 'calloutStyle') &&
      (typeof podcast.calloutStyle !== 'string' || !Object.hasOwn(podcastCalloutStyles, podcast.calloutStyle))) {
    fail('podcast.calloutStyle', `choose ${Object.keys(podcastCalloutStyles).join(' or ')}`);
  }
  requireText(podcast.title, 'podcast.title', 60);
  requireText(podcast.source, 'podcast.source', 96);
  if (!captions.length) fail('captions', 'provide the final narration captions');
  checkIntervals(podcast.shots, 'podcast.shots', duration, fps, {contiguous: true, validateItem: validateShot});
  checkIntervals(podcast.highlights, 'podcast.highlights', duration, fps, {contiguous: false, validateItem: validateHighlight});
  return doc;
}

export async function mapPodcastAssets(doc, mapper) {
  for (const shot of doc.podcast?.shots ?? []) {
    const key = shot.video ? 'video' : 'image';
    shot[key] = await mapper(shot[key]);
  }
}

export function podcastStillPoints(doc) {
  if (!doc.podcast) return null;
  const {fps, podcast, duration} = doc;
  const points = new Map();
  const last = podcastFrameAt(duration, fps) - 1;
  function add(frame, reason) {
    if (!points.has(frame)) points.set(frame, {frame, time: frame / fps, reason});
  }
  for (const shot of podcast.shots) {
    const from = podcastFrameAt(shot.start, fps);
    add(from, 'shot-in');
    if (from > 0) add(from - 1, 'before-shot-cut');
  }
  for (const cue of podcast.highlights) {
    const from = podcastFrameAt(cue.start, fps);
    const end = podcastFrameAt(cue.end, fps);
    const hold = Math.max(1, end - from - 1);
    add(Math.min(end - 1, from + Math.round(Math.min(fps * .16, hold / 3))), 'highlight-enter');
    add(Math.min(end - 1, from + Math.round(Math.min(fps * .5, hold / 2))), 'highlight-hold');
  }
  add(last, 'last-frame');
  return [...points.values()].sort((a, b) => a.frame - b.frame);
}
