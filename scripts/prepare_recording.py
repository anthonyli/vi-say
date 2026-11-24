#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Apply a single-source edit decision list to video and audio together."""
import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import wave

import imageio_ffmpeg

from audio_timing import ffmpeg

SAMPLE_RATE = 48000


def validate_edit_policy(doc):
    """Keep ordinary recording edits in source order and at source speed."""
    mode = doc.get('edit_mode', 'source_preserving')
    if mode not in ('source_preserving', 'editorial'):
        raise ValueError('edit_mode must be source_preserving or editorial')
    if mode == 'editorial':
        request = doc.get('user_request')
        if not isinstance(request, str) or not request.strip():
            raise ValueError('Editorial reordering or retiming requires the actual user_request')
        return mode
    previous_end = 0
    for segment in doc.get('segments', []):
        start, end = float(segment['in']), float(segment['out'])
        if float(segment.get('speed', 1)) != 1:
            raise ValueError('Source-preserving edits require speed=1')
        if start < previous_end:
            raise ValueError('Source-preserving edits require chronological, non-overlapping segments')
        previous_end = end
    return mode


def validate_continuous_ranges(windows, segments, fps):
    """Map protected source actions, rejecting gaps, repeats and retiming."""
    mapped = []
    for window in windows:
        start, end = float(window['in']), float(window['out'])
        reason = window.get('reason')
        if (not all(math.isfinite(x) for x in (start, end)) or not 0 <= start < end
                or not isinstance(reason, str) or not reason.strip()):
            raise ValueError('Continuous range needs a finite source interval and a reason')
        first, last = round(start * fps), round(end * fps)
        if first >= last:
            raise ValueError('Continuous range is shorter than one frame')
        cursor, output_start, output_end = first, None, None
        for segment in segments:
            left = max(first, round(segment['source_in'] * fps))
            right = min(last, round(segment['source_out'] * fps))
            if left >= right:
                continue
            at = round(segment['output_in'] * fps) + left - round(segment['source_in'] * fps)
            if (segment['speed'] != 1 or left != cursor
                    or (output_end is not None and at != output_end)):
                raise ValueError(f'Continuous range was cut, reordered, repeated or retimed: {reason}')
            if output_start is None:
                output_start = at
            cursor, output_end = right, at + right - left
        if cursor != last:
            raise ValueError(f'Continuous range is not fully retained: {reason}')
        mapped.append({'source_in': first / fps, 'source_out': last / fps,
                       'output_in': output_start / fps, 'output_out': output_end / fps,
                       'reason': reason})
    return mapped


def run(args):
    subprocess.run([ffmpeg(), '-hide_banner', '-loglevel', 'error', '-nostdin', *args], check=True)


def clip_audio(source, master, segment, root):
    rate = source.getframerate()
    start = round(segment['source_in'] * rate)
    end = round(segment['source_out'] * rate)
    length = round(segment['output_out'] * rate) - round(segment['output_in'] * rate)
    source.setpos(start)
    pcm = source.readframes(end - start)
    sample_bytes = source.getsampwidth() * source.getnchannels()
    if segment['speed'] != 1:
        chunk, stretched = root / 'cut.pcm', root / 'stretched.pcm'
        chunk.write_bytes(pcm)
        run(['-y', '-f', 's16le', '-ar', str(rate), '-ac', '2', '-i', str(chunk),
             '-af', f"apad=pad_dur=0.08,atempo={segment['speed']}", '-f', 's16le', str(stretched)])
        pcm = stretched.read_bytes()
    target = length * sample_bytes
    master.writeframesraw(pcm[:target].ljust(target, b'\x00'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('edl')
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    path = Path(args.edl).resolve()
    doc = json.loads(path.read_text())
    edit_mode = validate_edit_policy(doc)
    source = (path.parent / doc['source']).resolve()
    if not source.is_file():
        raise ValueError(f'Missing source: {source}')
    fps = doc.get('fps', 30)
    if not isinstance(fps, int) or not 12 <= fps <= 60:
        raise ValueError('fps must be an integer from 12 to 60')
    segments = doc.get('segments', [])
    if not segments:
        raise ValueError('Provide at least one kept segment')
    resolved = []
    cursor = 0
    for segment in segments:
        start = float(segment['in'])
        end = float(segment['out'])
        speed = float(segment.get('speed', 1))
        if not all(math.isfinite(x) for x in (start, end, speed)) or not 0 <= start < end or not .85 <= speed <= 1.25:
            raise ValueError('Invalid interval or speed outside 0.85–1.25')
        first, last = round(start * fps), round(end * fps)
        start, end = first / fps, last / fps
        frames = round((last - first) / speed)
        if frames < 1:
            raise ValueError('A segment must contain at least one output frame')
        resolved.append({'source_in': start, 'source_out': end, 'speed': speed,
                         'output_in': cursor / fps, 'output_out': (cursor + frames) / fps,
                         'frames': frames, 'reason': segment.get('reason', '')})
        cursor += frames
    continuous = validate_continuous_ranges(doc.get('continuous_ranges', []), resolved, fps)
    for cut in doc.get('filler_cuts', []):
        start, end = float(cut['in']), float(cut['out'])
        if not math.isfinite(start) or not math.isfinite(end) or not 0 <= start < end:
            raise ValueError('Invalid reviewed filler cut')
        first, last = round(start * fps), round(end * fps)
        if first == last:
            raise ValueError('Reviewed filler cut is shorter than the edit resolution')
        if any(round(s['source_in'] * fps) < last and round(s['source_out'] * fps) > first
               for s in resolved):
            raise ValueError(f"Kept footage overlaps reviewed filler cut: {cut.get('text', [start, end])}")
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    targets = [output / x for x in ('master.mov', 'narration.wav', 'edit-map.json')]
    if any(p.exists() or p.is_symlink() for p in targets):
        raise ValueError('Use a new output directory; existing outputs are preserved')
    with tempfile.TemporaryDirectory(dir=output) as temporary:
        root = Path(temporary)
        # Decode the audio once to validate source duration and require a real audio track.
        raw = root / 'source.wav'
        run(['-i', str(source), '-map', '0:a:0', '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', str(raw)])
        with wave.open(str(raw)) as audio:
            source_duration = audio.getnframes() / audio.getframerate()
        if any(s['source_out'] > source_duration + .5 / fps for s in resolved):
            raise ValueError('A kept segment extends past the source audio')
        for index, segment in enumerate(resolved):
            start, end, speed = segment['source_in'], segment['source_out'], segment['speed']
            frames = segment['frames']
            clip = root / f'clip-{index:04d}.mov'
            filters = (f'trim=duration={end-start},setpts=(PTS-STARTPTS)/{speed},fps={fps},'
                       f'tpad=stop_mode=clone:stop={max(2, round(fps * .08))},'
                       f'trim=end_frame={frames},scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1')
            run(['-ss', str(start), '-i', str(source), '-map', '0:v:0', '-an', '-vf', filters,
                 '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', '-pix_fmt', 'yuv420p',
                 '-video_track_timescale', str(fps * 1000), str(clip)])
        listing = root / 'clips.txt'
        listing.write_text(''.join(f"file 'clip-{i:04d}.mov'\nduration {s['frames'] / fps:.9f}\n"
                                   for i, s in enumerate(resolved)))
        joined = root / 'joined.wav'
        with wave.open(str(raw), 'rb') as source_audio, wave.open(str(joined), 'wb') as edited_audio:
            edited_audio.setparams(source_audio.getparams())
            for segment in resolved:
                clip_audio(source_audio, edited_audio, segment, root)
        narration = root / 'narration.wav'
        samples = round(cursor / fps * SAMPLE_RATE)
        run(['-i', str(joined), '-af', f'loudnorm=I=-16:TP=-1.5:LRA=9,'
             f'aresample={SAMPLE_RATE},apad,atrim=end_sample={samples}',
             '-c:a', 'pcm_s16le', str(narration)])
        master = root / 'master.mov'
        run(['-f', 'concat', '-safe', '1', '-i', str(listing), '-i', str(narration),
             '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', str(master)])
        frames, _ = imageio_ffmpeg.count_frames_and_secs(str(master))
        with wave.open(str(narration)) as audio:
            actual_duration = audio.getnframes() / audio.getframerate()
        if frames != cursor or round(actual_duration * SAMPLE_RATE) != samples:
            raise ValueError(f'Unexpected duration drift: decoded {frames} of {cursor} expected frames')
        mapping = root / 'edit-map.json'
        result = {'source': str(source), 'fps': fps, 'edit_mode': edit_mode, 'segments': resolved,
                  'continuous_ranges': continuous,
                  'expected_video_duration': cursor / fps, 'audio_duration': actual_duration,
                  'timing_note': 'Frame-rounded source intervals. Align captions to the final WAV.'}
        mapping.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        published = []
        try:
            for staged, target in zip((master, narration, mapping), targets):
                os.link(staged, target)
                published.append(target)
        except OSError:
            for target in published:
                target.unlink()
            raise
    print(json.dumps({'master': str(targets[0]), 'audio': str(targets[1]), 'duration': actual_duration}))


if __name__ == '__main__':
    main()
