#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Validate recorded-comic timing and PCM16 audio; never certify listening quality."""
import argparse
import array
import json
import math
from pathlib import Path
import sys
import wave


def audio_gaps(audio, duration):
    with wave.open(str(audio), 'rb') as stream:
        if stream.getsampwidth() != 2:
            raise ValueError('Narration check requires PCM16 WAV')
        rate, channels = stream.getframerate(), stream.getnchannels()
        seconds = stream.getnframes() / rate
        samples = array.array('h', stream.readframes(stream.getnframes()))
    if sys.byteorder != 'little':
        samples.byteswap()
    step = max(1, round(rate * .01)) * channels
    quiet = []
    for offset in range(0, len(samples), step):
        block = samples[offset:offset + step]
        quiet.append(math.sqrt(sum(x*x for x in block) / len(block)) < 32768 * 10**(-45/20))
    audible = bool(quiet) and not all(quiet)
    quiet.extend([True] * max(0, math.ceil((duration - seconds) / .01)))
    gaps, start = [], None
    for index, silent in enumerate(quiet + [False]):
        if silent and start is None:
            start = index
        elif not silent and start is not None:
            if (index - start) * .01 > 1.2:
                gaps.append([round(start * .01, 2), round(index * .01, 2)])
            start = None
    return gaps, audible, seconds


def check(path, audio_override=None, verify_video=False):
    path = Path(path)
    doc = json.loads(path.read_text())
    errors = []
    duration = doc['duration']
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
        raise ValueError('duration must be finite and positive')
    if doc.get('fps', 30) != 30:
        errors.append('RecordedComic supports 30 fps only')
    cover_frames, video_frames = doc.get('coverFrames', 0), doc.get('videoFrames', 0)
    if not doc.get('cover', {}).get('title') or not isinstance(cover_frames, int) or cover_frames <= 0:
        errors.append('Missing opening cover')
    if not isinstance(video_frames, int) or video_frames <= 0:
        errors.append('Invalid videoFrames')
    elif duration * 30 + .01 < cover_frames + video_frames:
        errors.append('Timeline truncates recorded footage')
    if verify_video:
        import imageio_ffmpeg
        source = path.parent / 'public' / doc['video']
        frames, source_seconds = imageio_ffmpeg.count_frames_and_secs(str(source))
        if frames != video_frames or abs(source_seconds - video_frames / 30) > .1:
            errors.append('Source video frame count or timing differs from declared 30fps footage')
    cues = doc.get('captions', [])
    options = doc.get('captionOptions', {})
    if any(key in options for key in ('keywords', 'keywordsEn', 'bilingual')):
        errors.append('captionOptions cannot override caption content or disable bilingual highlighting')
    if not cues or any(not c.get('en', '').strip() for c in cues):
        errors.append('Missing bilingual captions')
    keys = doc.get('keywords', [])
    if not keys or not any(k.casefold() in c.get('text', '').casefold()
                          for c in cues for k in c.get('keywords', keys)):
        errors.append('No visible caption keyword match')
    previous_end = 0
    for cue in cues:
        start, end = cue.get('start', -1), cue.get('end', -1)
        if not (previous_end <= start < end <= duration):
            errors.append('Invalid, overlapping or unordered caption interval')
        previous_end = end
    audio = Path(audio_override) if audio_override else path.parent / doc['audioFile']
    gaps, audible, seconds = audio_gaps(audio, duration)
    if not audible:
        errors.append('Narration contains no audible signal')
    if seconds > duration + .1:
        errors.append('Narration is truncated by the timeline')
    uncovered = []
    windows = doc.get('silentWindows', [])
    for window in windows:
        if not window.get('user_request', '').strip() or not (0 <= window['start'] < window['end'] <= duration):
            raise ValueError('Silent window requires its actual user request and bounded interval')
    for start, end in gaps:
        if not any(w['start'] <= start + .03 and w['end'] >= end - .03 for w in windows):
            uncovered.append([start, end])
    if uncovered:
        errors.append(f'Narration silence exceeds 1.2s: {uncovered}')
    return {'complete': not errors, 'errors': errors, 'silences': gaps,
            'audio_duration': seconds, 'listening_assessed': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('timeline', type=Path)
    args = parser.parse_args(argv)
    try:
        result = check(args.timeline, verify_video=True)
    except (OSError, ValueError, KeyError, TypeError, wave.Error) as exc:
        parser.exit(2, str(exc) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['complete'] else 1


if __name__ == '__main__':
    sys.exit(main())
