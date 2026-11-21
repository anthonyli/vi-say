#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Pre-render gate for narrated dragon timelines.

Every rule here comes from a defect that reached a finished video before:
missing captions or highlights, a silent outro, long gaps in the narration,
captions that skip spoken lines, a publishing poster rendered inside the
video, or a series video that silently fell back to an old theme. The gate
runs inside compile/preview, before any frame is rendered. A failed check
can only be waived with a recorded reason in project.json:

    "preflight": {"allow": {"audio_gaps": "用户原话：中间留 2 秒看动画"}}
"""
import argparse
import json
import math
from pathlib import Path
import re
import sys
import wave
from array import array

from audit_speech_pauses import audit

CHECKS = ('captions_present', 'caption_keywords', 'outro_voiced', 'leading_silence',
          'audio_gaps', 'caption_coverage', 'poster_in_video', 'series_theme')
PREVIEW_SOFT = frozenset({'caption_keywords', 'outro_voiced', 'series_theme'})
POSTER_NAME = re.compile(r'(poster|cover|海报|封面)', re.IGNORECASE)
MAX_GAP = 1.2
MAX_LEADING = 1.0
MAX_UNCAPTIONED = 1.5


def _voiced_seconds(path, start, end, threshold_db=-40):
    """Seconds of speech-level energy inside [start, end) of a PCM16 WAV."""
    with wave.open(str(path)) as wav:
        if wav.getsampwidth() != 2:
            return None
        rate, channels = wav.getframerate(), wav.getnchannels()
        wav.setpos(max(0, int(start * rate)))
        data = array('h', wav.readframes(max(0, int((end - start) * rate))))
    if sys.byteorder != 'little':
        data.byteswap()
    window = max(1, round(rate * .02)) * channels
    limit = 32768 * 10 ** (threshold_db / 20)
    voiced = 0
    for offset in range(0, len(data), window):
        block = data[offset:offset + window]
        if block and math.sqrt(sum(x * x for x in block) / len(block)) >= limit:
            voiced += len(block) / (rate * channels)
    return voiced


def _contains(text, term):
    return term.lower() in text.lower()


def run(project, timeline, audio=None, *, preview=False, outro=None):
    """Return {'errors', 'warnings', 'waived', 'checks'}; never certifies taste or listening."""
    allow = (project.get('preflight') or {}).get('allow') or {}
    if not isinstance(allow, dict) or any(k not in CHECKS or not isinstance(v, str) or not v.strip()
                                          for k, v in allow.items()):
        raise ValueError(f'preflight.allow maps one of {list(CHECKS)} to a recorded reason')
    found = {name: [] for name in CHECKS}
    warnings = []
    captions = timeline.get('captions') or []
    scenes = timeline.get('cartoonScenes') or []
    modules = timeline.get('modules') or {}
    caption_module = modules.get('captions') or {}
    duration = timeline['duration']

    if not preview and not captions:
        found['captions_present'].append('Final narration has no captions; align them from the final WAV')
    if captions and caption_module.get('style') == 'highlight':
        terms = caption_module.get('keywords') or []
        hits = sum(1 for c in captions if any(_contains(c['text'], t) for t in (c.get('keywords') or terms)))
        if not terms and not any(c.get('keywords') for c in captions):
            found['caption_keywords'].append('Highlight captions need modules.captions.keywords from this episode')
        elif not hits:
            found['caption_keywords'].append('No caption contains a keyword, so nothing will be highlighted')
        if caption_module.get('bilingual'):
            terms_en = caption_module.get('keywordsEn') or []
            if not terms_en and not any(c.get('keywordsEn') for c in captions):
                warnings.append('English caption line has no keywordsEn; only the Chinese line will be highlighted')

    last = scenes[-1] if scenes else {}
    if last.get('outroId') and outro is not None:
        spoken = ''.join(c['text'] for c in captions if c['end'] > last['start'] and c['start'] < last['end'])
        missing = [item['anchor'] for item in outro['items'] if item['anchor'] not in spoken]
        if captions and missing:
            found['outro_voiced'].append(f'Outro captions do not speak {"/".join(missing)}; narrate the shared outro over its scene')

    for i, scene in enumerate(scenes):
        for key in ('image', 'video'):
            if scene.get(key) and POSTER_NAME.search(Path(scene[key]).name):
                found['poster_in_video'].append(
                    f'Scene {i + 1} uses {Path(scene[key]).name}; publishing posters are delivered separately, not rendered into the video')

    character = (modules.get('character') or {}).get('mode')
    if character != 'none' and modules.get('background') != 'comic':
        found['series_theme'].append(
            f'Dragon series videos default to the comic theme; background is {modules.get("background", "unset")}')

    if audio is not None and not preview:
        report = audit(audio, minimum=MAX_GAP)
        for pause in report['pauses']:
            if pause['start'] <= .001 and pause['duration'] > MAX_LEADING:
                found['leading_silence'].append(f'Narration starts after {pause["end"]:.2f}s of silence')
            elif pause['end'] < duration - .05:
                found['audio_gaps'].append(f'{pause["duration"]:.2f}s silence at {pause["start"]:.2f}–{pause["end"]:.2f}s')
        edges = [(0.0, captions[0]['start'])] if captions else []
        edges += [(a['end'], b['start']) for a, b in zip(captions, captions[1:])]
        for start, end in edges:
            if end - start > MAX_UNCAPTIONED:
                voiced = _voiced_seconds(audio, start, end)
                if voiced is not None and voiced > .6:
                    found['caption_coverage'].append(f'{voiced:.1f}s of speech between {start:.2f}s and {end:.2f}s has no caption')

    errors, waived = [], []
    for name, problems in found.items():
        for problem in problems:
            # Silent studies carry draft captions and may compare older themes;
            # narrated HTML reviews and final renders may not drift.
            if preview and name in PREVIEW_SOFT and name not in allow:
                warnings.append(f'[{name}] {problem}')
                continue
            (waived if name in allow else errors).append({'check': name, 'message': problem,
                                                          **({'reason': allow[name]} if name in allow else {})})
    return {'errors': errors, 'warnings': warnings, 'waived': waived,
            'checks': [name for name in CHECKS if name not in allow],
            'quality_assessed': False,
            'note': 'Mechanical gate only; frames, motion and listening still need real review.'}


def enforce(result):
    if result['errors']:
        lines = '\n'.join(f'- [{e["check"]}] {e["message"]}' for e in result['errors'])
        raise ValueError('Preflight failed before rendering:\n' + lines +
                         '\nFix the timeline, or record a reason under project.json preflight.allow.')
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('project', type=Path)
    parser.add_argument('timeline', type=Path, help='timeline.json written by production.py compile')
    parser.add_argument('--audio', type=Path)
    args = parser.parse_args(argv)
    from production import OUTRO
    result = run(json.loads(args.project.read_text()), json.loads(args.timeline.read_text()),
                 args.audio, outro=OUTRO)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
