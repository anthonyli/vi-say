// Copyright 2026 Anthony Li
// SPDX-License-Identifier: Apache-2.0

import {execFile} from 'node:child_process';
import {dirname} from 'node:path';
import {promisify} from 'node:util';
import {podcastFrameAt} from './podcast-contract.mjs';

const exec = promisify(execFile);

async function streamDuration(ffprobe, file, type) {
  let meta;
  try {
    const binaries = dirname(ffprobe);
    const {stdout} = await exec(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file',
      '-show_entries', 'format=duration:stream=codec_type,duration:stream_disposition=attached_pic',
      '-of', 'json', '-i', file], {cwd: binaries,
      env: {...process.env, DYLD_LIBRARY_PATH: binaries, LD_LIBRARY_PATH: binaries}});
    meta = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Cannot read media duration for ${file}: ${error.stderr?.trim() || error.message}`);
  }
  const stream = meta.streams?.find(item => item.codec_type === type && !item.disposition?.attached_pic);
  if (!stream) throw new Error(`Missing ${type} stream in ${file}`);
  const reported = Number.parseFloat(stream.duration);
  const seconds = Number.isFinite(reported) ? reported : Number.parseFloat(meta.format?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`Missing ${type} duration in ${file}`);
  return seconds;
}

export async function validatePodcastMedia(doc, assets, ffprobe) {
  const sources = new Map([...assets].map(([source, name]) => [name, source]));
  const {fps, duration} = doc;
  const narration = await streamDuration(ffprobe, sources.get(doc.audio), 'audio');
  if (Math.abs(narration - duration) > 1 / fps + .000001) {
    throw new Error(`Podcast duration ${duration}s differs from final narration ${narration}s by more than one frame`);
  }

  const measured = new Map();
  for (const [i, shot] of doc.podcast.shots.entries()) {
    if (!shot.video) continue;
    const source = sources.get(shot.video);
    if (!measured.has(source)) measured.set(source, await streamDuration(ffprobe, source, 'video'));
    const span = podcastFrameAt(shot.end, fps) - podcastFrameAt(shot.start, fps);
    const lastSourceFrame = Math.round((shot.videoStart ?? 0) * fps) + span - 1;
    const videoDuration = measured.get(source);
    if (lastSourceFrame / fps >= videoDuration) {
      throw new Error(`podcast.shots[${i}] requests ${lastSourceFrame / fps}s in a ${videoDuration}s video. Trim the shot or provide more footage.`);
    }
  }
}
