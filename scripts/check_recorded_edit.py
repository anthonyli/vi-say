#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Check the reviewed timeline and rendered media for a screen-recording edit."""
import argparse
import array
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import wave

from audio_timing import ffmpeg
from render_captions import finite, srt_text, validate_captions
from revise_delivery import digest

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
OUTRO = ASSETS / 'production/outro.json'
TRANSITIONS = ASSETS / 'remotion/gl-transitions.json'


def interval(data, duration, name):
    start = finite(data.get('start'), f'{name}.start')
    end = finite(data.get('end'), f'{name}.end')
    if not start < end <= duration:
        raise ValueError(f'{name}: invalid interval')
    return start, end


def inside(cues, start, end):
    return [c for c in cues if start <= c['start'] and c['end'] <= end]


def normalized(text):
    return re.sub(r'[^\w]', '', text, flags=re.UNICODE)


def validate_plan(doc):
    if doc.get('schema_version') != 1:
        raise ValueError('Recorded edit schema_version must be 1')
    fps = doc['fps']
    if type(fps) is not int or not 12 <= fps <= 60:
        raise ValueError('Recorded edit fps must be an integer from 12 to 60')
    duration = finite(doc.get('duration'), 'duration')
    if duration <= 0 or abs(duration * fps - round(duration * fps)) > .001:
        raise ValueError('Recorded edit duration must be a positive whole number of frames')
    cues = validate_captions({**doc, 'bilingual': True})
    audible = []
    previous_end = 0
    if not isinstance(doc.get('playback'), list):
        raise ValueError('List the actual system playback windows, or use an explicit empty list')
    for index, playback in enumerate(doc['playback'], 1):
        start, end = interval(playback, duration, f'playback {index}')
        if start < previous_end:
            raise ValueError('Playback windows must be chronological and non-overlapping')
        # Existing footage need not acquire invented narration to pass validation.
        # Supplementing one gap must not force new intros for every other demo.
        if 'intro' in playback:
            intro = playback.get('intro', {})
            first, last = interval(intro, duration, f'playback {index} intro')
            if not previous_end <= first < last <= start:
                raise ValueError(f'Playback {index} needs a spoken intro before playback starts')
            if not inside(cues, first, last):
                raise ValueError(f'Playback {index} intro needs bilingual captions')
            audible.append((first, last, f'playback {index} intro'))
        if type(playback.get('embedded_captions')) is not bool:
            raise ValueError(f'Playback {index} must declare whether it has embedded captions')
        if playback['embedded_captions'] and any(c['start'] < end and c['end'] > start for c in cues):
            raise ValueError(f'Playback {index} overlaps added captions despite embedded captions')
        previous_end = end

    outro = doc.get('outro')
    if outro is not None:
        first, last = interval(outro['closing'], duration, 'closing line')
        closing_cues = inside(cues, first, last)
        if not closing_cues:
            raise ValueError('Outro needs a captioned closing line before the transition')
        closing_text = outro['closing'].get('text')
        if closing_text and normalized(closing_text) != normalized(''.join(c['text'] for c in closing_cues)):
            raise ValueError('Closing captions do not match the planned line')
        transition = outro['transition']
        enter, finish = interval(transition, duration, 'outro transition')
        if not previous_end <= first < last <= enter < finish:
            raise ValueError('Finish the demo and the closing line before the outro transition')
        transitions = json.loads(TRANSITIONS.read_text())['transitions']
        if transition.get('name') not in {t['name'] for t in transitions}:
            raise ValueError('Outro transition must name an implemented GL effect')
        if any(abs(t*fps - round(t*fps)) > .001 for t in (enter, finish)):
            raise ValueError('Outro transition must use video frame boundaries')
        template = json.loads(OUTRO.read_text())
        if outro.get('template') != template['id']:
            raise ValueError('Use the fixed interaction outro template')
        start, end = interval(outro['narration'], duration, 'outro narration')
        if finish > start:
            raise ValueError('Interaction narration must start after the transition')
        spoken = inside(cues, start, end)
        if normalized(''.join(c['text'] for c in spoken)) != normalized(template['narration']):
            raise ValueError('Outro captions must cover the complete fixed narration')
        if duration - end < .25:
            raise ValueError('Allow the outro to settle after the last spoken line')
        anchors = [item['anchor'] for item in template['items']]
        actions = outro['actions']
        if [a['anchor'] for a in actions] != anchors:
            raise ValueError('Outro actions must follow the fixed template order')
        previous = start
        for action in actions:
            at = finite(action['at'], 'outro action time')
            if at < previous or not any(c['start'] <= at < c['end'] and action['anchor'] in c['text']
                                        for c in spoken):
                raise ValueError(f"Outro action is not timed to its caption: {action['anchor']}")
            previous = at
        audible.append((first, last, 'closing line'))
        audible.extend((c['start'], c['end'], f'outro line {i}') for i, c in enumerate(spoken, 1))
    return cues, audible


def verify_voice(doc, base, *, protected_paths=None):
    voice = doc.get('voice', {'mode': 'original'})
    mode = voice['mode']
    if mode == 'original':
        if voice.get('generation_reports'):
            raise ValueError('Original audio cannot declare synthesized lines')
        return
    if mode not in {'current_recording', 'authorized_alternative'}:
        raise ValueError('Unknown recorded edit voice mode')
    reference = base / voice['reference_audio']
    if protected_paths is not None:
        protected_paths.add(reference)
        protected_paths.update(base / report for report in voice['generation_reports'])
        if mode == 'current_recording':
            protected_paths.add(base / voice['excerpt']['source'])
    reference_hash = digest(reference)
    reports = voice['generation_reports']
    if not reports:
        raise ValueError('Synthesized lines need generation reports')
    for report in reports:
        data = json.loads((base / report).read_text())
        if data['voice_identity']['reference_audio_sha256'] != reference_hash:
            raise ValueError(f'Generated speech used a different reference: {report}')
    if mode == 'authorized_alternative':
        if not voice.get('user_request', '').strip():
            raise ValueError('An alternate reference needs the actual user choice')
        return
    excerpt = voice['excerpt']
    start = finite(excerpt['start'], 'voice start')
    end = finite(excerpt['end'], 'voice end')
    if end <= start:
        raise ValueError('Voice excerpt needs a positive duration')
    with wave.open(str(reference), 'rb') as wav:
        if wav.getsampwidth() != 2 or wav.getnchannels() != 1:
            raise ValueError('Voice excerpt must be mono PCM16')
        rate = wav.getframerate()
        samples = wav.readframes(wav.getnframes())
    # Compare real samples, ignoring WAV container metadata.
    against = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-ss', str(start),
                              '-i', str(base / excerpt['source']), '-map', '0:a:0',
                              '-t', str(round(end-start, 9)), '-ar', str(rate), '-ac', '1',
                              '-f', 's16le', '-'], capture_output=True)
    if against.returncode or not samples or against.stdout != samples:
        raise ValueError('The voice reference does not match its current-recording excerpt')


def verify_video(movie, doc, intervals):
    if movie.suffix.lower() != '.mp4' or not movie.is_file() or movie.stat().st_size == 0:
        return ['Missing rendered MP4']
    with tempfile.TemporaryDirectory(prefix='vi-say-edit-check-') as tmp:
        pcm = Path(tmp) / 'audio.wav'
        result = subprocess.run([ffmpeg(), '-hide_banner', '-nostdin', '-v', 'info', '-xerror',
            '-i', str(movie), '-map', '0:v:0', '-an', '-vf', 'showinfo=checksum=0',
            '-fps_mode', 'passthrough', '-f', 'null', '-',
            '-map', '0:a:0', '-vn', '-ar', '8000', '-ac', '1', '-c:a', 'pcm_s16le', str(pcm)],
            capture_output=True, text=True)
        if result.returncode:
            return ['Rendered MP4 video/audio could not be fully decoded']
        stamps = re.findall(r'\bn:\s*\d+ pts:\s*\d+ pts_time:([0-9.eE+-]+)', result.stderr)
        errors = []
        expected = round(doc['duration'] * doc['fps'])
        if len(stamps) != expected:
            errors.append(f'Rendered MP4 frame count differs from {expected} planned frames')
        elif any(abs(float(value)-i/doc['fps']) > .002 for i, value in enumerate(stamps)):
            errors.append('Rendered MP4 frame timestamps differ from the planned frame clock')
        with wave.open(str(pcm), 'rb') as audio:
            rate = audio.getframerate()
            samples = array.array('h')
            samples.frombytes(audio.readframes(audio.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        if abs(len(samples) / rate - doc['duration']) > max(1/doc['fps'], .03):
            errors.append('Rendered MP4 audio duration differs from the timeline')
        for start, end, label in intervals:
            chunk = samples[round(start * rate):round(end * rate)]
            if not chunk or sum(x*x for x in chunk) / len(chunk) < (32768 * .004)**2:
                errors.append(f'Rendered MP4 has no audible signal in {label}')
        return errors


def check(path, video=None, srt=None, *, protected_paths=None):
    path = Path(path).resolve()
    doc = json.loads(path.read_text(encoding='utf-8'))
    if protected_paths is not None and doc.get('outro') is not None:
        protected_paths.update((OUTRO, TRANSITIONS))
    cues, audible = validate_plan(doc)
    verify_voice(doc, path.parent, protected_paths=protected_paths)
    errors = []
    if video is not None:
        errors.extend(verify_video(Path(video).resolve(), doc, audible))
        if srt is None:
            errors.append('Rendered edit also needs its bilingual SRT')
        elif Path(srt).read_text(encoding='utf-8-sig').strip() != srt_text(cues).strip():
            errors.append('Delivered SRT differs from the reviewed bilingual captions')
    return {'complete': not errors, 'media_checked': video is not None,
            'listening_assessed': False, 'errors': errors}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--video', type=Path)
    group.add_argument('--plan-only', action='store_true')
    parser.add_argument('--srt', type=Path)
    args = parser.parse_args(argv)
    try:
        result = check(args.plan, args.video, args.srt)
    except (OSError, ValueError, TypeError, KeyError, wave.Error) as error:
        parser.exit(2, str(error) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
