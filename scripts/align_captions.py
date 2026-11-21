#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Bind authored captions to ASR word timing of the final narration.

Accepts DashScope-style millisecond words or Whisper/faster-whisper style
`segments[].words[]` in seconds. Authored cues (with English `en`) can be
passed directly, so a project never needs its own alignment script. Any
mismatch between the script and ASR is listed; the run only continues with
`--accept-differences REASON`, which records the reviewed differences.
"""
import argparse
import difflib
import json
from pathlib import Path
import re
import wave
from audio_timing import map_time


def normalized(text):
    return ''.join(c.lower() for c in text if c.isalnum())


def asr_words(document):
    """Yield (text, start_seconds, end_seconds) from supported ASR layouts."""
    if 'transcriptions' in document:
        for transcription in document['transcriptions']:
            for transcript in transcription['transcripts']:
                for sentence in transcript['sentences']:
                    for word in sentence['words']:
                        yield word['text'], word['begin_time'] / 1000, word['end_time'] / 1000
        return
    segments = document.get('segments') if isinstance(document, dict) else None
    words = ([w for s in segments for w in s.get('words') or []] if segments is not None
             else document.get('words') if isinstance(document, dict) else None)
    if not words:
        raise ValueError('Alignment needs word timestamps: transcriptions[] (ms) or segments[].words[] / words[] (seconds)')
    for word in words:
        yield word.get('word', word.get('text', '')), float(word['start']), float(word['end'])


def timed_characters(document, mapping):
    timed = []
    for text, a, b in asr_words(document):
        chars = normalized(text)
        if b < a:
            raise ValueError('Invalid ASR word timing.')
        for i, char in enumerate(chars):
            timed.append({'char': char,
                          'start': map_time(a + (b - a) * i / len(chars), mapping),
                          'end': min(mapping['output_duration'], map_time(a + (b - a) * (i + 1) / len(chars), mapping))})
    return timed


def bind(expected, timed):
    """Times for every authored character; mismatched spans interpolate between neighbours."""
    recognized = ''.join(c['char'] for c in timed)
    if expected == recognized:
        return timed, []
    mapped = [None] * len(expected)
    differences = []
    for tag, a, b, c, d in difflib.SequenceMatcher(None, expected, recognized, autojunk=False).get_opcodes():
        if tag == 'equal':
            mapped[a:b] = [{**timed[c + i], 'char': expected[a + i]} for i in range(b - a)]
            continue
        differences.append({'kind': tag, 'script': expected[a:b], 'asr': recognized[c:d],
                            'time': round(timed[min(c, len(timed) - 1)]['start'], 3) if timed else 0})
        if b == a:
            continue
        left = timed[c - 1]['end'] if c > 0 else (timed[0]['start'] if timed else 0)
        right = timed[d - 1]['end'] if d > c else (timed[d]['start'] if d < len(timed) else left)
        step = max(0.0, right - left) / (b - a)
        for i in range(b - a):
            mapped[a + i] = {'char': expected[a + i], 'start': left + i * step, 'end': left + (i + 1) * step,
                             'interpolated': True}
    return mapped, differences


def auto_cues(authored):
    """Split at punctuation first; keep English tokens intact when splitting long clauses."""
    pieces = []
    for clause in re.findall(r'[^，。！？；、,!?;\n]+[，。！？；、,!?;]?', authored):
        current = ''
        for token in re.findall(r'[A-Za-z0-9]+|.', clause):
            if len(current + token) > 22 and current.strip():
                pieces.append(current.strip()); current = ''
            current += token
        if current.strip():
            pieces.append(current.strip())
    return [{'text': piece} for piece in pieces]


def load_cues(path):
    data = json.loads(Path(path).read_text())
    cues = data.get('captions', data.get('cues')) if isinstance(data, dict) else data
    if not isinstance(cues, list) or not cues or not all(isinstance(c, dict) and str(c.get('text', '')).strip() for c in cues):
        raise ValueError('--cues needs a nonempty list of {text, en?, keywords?, keywordsEn?}')
    keep = ('text', 'en', 'keywords', 'keywordsEn')
    return [{k: c[k] for k in keep if k in c} for c in cues]


def identity_map(audio):
    with wave.open(str(audio)) as w:
        duration = w.getnframes() / w.getframerate()
    return {'speed': 1, 'cuts': [], 'output_duration': duration}


def align(document, mapping, cues, *, accept_differences=None):
    timed = timed_characters(document, mapping)
    expected = normalized(''.join(c['text'] for c in cues))
    bound, differences = bind(expected, timed)
    if differences and not accept_differences:
        lines = '; '.join(f'{d["kind"]} at {d["time"]}s: script={d["script"]!r}, ASR={d["asr"]!r}' for d in differences)
        raise ValueError('Transcript differs; listen to each place, fix real audio errors, then rerun with '
                         '--accept-differences "<reason>" for ASR spellings (numbers, homophones). ' + lines)
    captions, cursor = [], 0
    for cue in cues:
        size = len(normalized(cue['text']))
        if not size:
            continue
        captions.append({**cue, 'start': bound[cursor]['start'], 'end': bound[cursor + size - 1]['end']})
        cursor += size
    if cursor != len(bound):
        raise ValueError('Caption splitting did not cover the entire script.')
    for i, cue in enumerate(captions):
        limit = captions[i + 1]['start'] - .02 if i + 1 < len(captions) else mapping['output_duration']
        cue['start'] = round(max(0.0, cue['start']), 3)
        cue['end'] = round(min(limit, cue['end'] + .10), 3)
        if cue['end'] <= cue['start']:
            raise ValueError(f'Invalid timing for caption {cue["text"]!r}; check the ASR around {cue["start"]}s.')
    return {'captions': captions, 'characters': bound,
            'timing_provenance': {'source': 'ASR word timestamps',
                                  'characters': 'estimated by interpolation within each word; not character forced alignment'},
            'verification': {'normalized_text_exact_match': not differences, 'characters': len(bound),
                             'differences': differences,
                             **({'accepted_differences_reason': accept_differences} if differences else {})}}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--alignment', required=True, help='ASR JSON with word timestamps')
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--text', help='Display script; captions are split automatically')
    source.add_argument('--cues', help='Authored caption list [{text, en, keywords?, keywordsEn?}] in order')
    timing = parser.add_mutually_exclusive_group(required=True)
    timing.add_argument('--map', help='timing map from audio_timing.py')
    timing.add_argument('--audio', help='final WAV; builds the identity map when the audio was not retimed')
    parser.add_argument('--accept-differences', metavar='REASON',
                        help='Continue past listed ASR differences after listening; the reason is recorded')
    parser.add_argument('--output', required=True)
    args = parser.parse_args(argv)
    document = json.loads(Path(args.alignment).read_text())
    mapping = json.loads(Path(args.map).read_text()) if args.map else identity_map(args.audio)
    cues = load_cues(args.cues) if args.cues else auto_cues(Path(args.text).read_text().strip())
    result = align(document, mapping, cues, accept_differences=args.accept_differences)
    output = Path(args.output)
    if output.exists():
        raise FileExistsError(f'Use a new output path: {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    differences = len(result['verification']['differences'])
    print(f'Bound {len(result["characters"])} characters to {len(result["captions"])} captions'
          + (f'; {differences} reviewed ASR differences recorded.' if differences else '; exact match.'))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(str(error))
