# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import json
import math
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import wave
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from preflight import run, enforce
from production import OUTRO, init, compile_project

RATE = 16000


def write_wav(path, plan):
    """plan: [(seconds, voiced)] -> PCM16 mono tone/silence segments."""
    frames = bytearray()
    for seconds, voiced in plan:
        for n in range(round(seconds * RATE)):
            value = int(8000 * math.sin(2 * math.pi * 220 * n / RATE)) if voiced else 0
            frames += struct.pack('<h', value)
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        w.writeframes(bytes(frames))
    return path


def timeline(**changes):
    doc = {
        'duration': 10.0,
        'modules': {'background': 'comic', 'character': {'mode': 'rounded'},
                    'captions': {'style': 'highlight', 'bilingual': True, 'keywords': ['积木'], 'keywordsEn': ['brick']}},
        'cartoonScenes': [
            {'kind': 'hero', 'start': 0, 'end': 6, 'title': '积木'},
            {'kind': 'cta', 'start': 6, 'end': 10, 'outroId': OUTRO['id']},
        ],
        'captions': [
            {'start': 0.0, 'end': 5.9, 'text': '这期讲积木', 'en': 'Bricks.'},
            {'start': 6.0, 'end': 9.6, 'text': '欢迎留言，记得关注和点赞', 'en': 'Comment, follow and like.'},
        ],
    }
    doc.update(changes)
    return doc


class Preflight(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.voice = write_wav(self.root / 'voice.wav', [(9.6, True), (0.4, False)])

    def tearDown(self):
        self.tmp.cleanup()

    def checks(self, result):
        return {e['check'] for e in result['errors']}

    def test_complete_narrated_timeline_passes(self):
        result = run({}, timeline(), self.voice, outro=OUTRO)
        self.assertEqual(result['errors'], [])
        self.assertFalse(result['quality_assessed'])

    def test_each_past_defect_is_caught(self):
        cases = {
            'captions_present': (timeline(captions=[]), self.voice),
            'caption_keywords': (timeline(modules={**timeline()['modules'], 'captions': {
                'style': 'highlight', 'keywords': ['不存在']}}), self.voice),
            'outro_voiced': (timeline(captions=[timeline()['captions'][0],
                                                {'start': 6.0, 'end': 9.6, 'text': '我们下期见', 'en': 'See you.'}]), self.voice),
            'leading_silence': (timeline(), write_wav(self.root / 'late.wav', [(2.0, False), (7.6, True), (0.4, False)])),
            'audio_gaps': (timeline(), write_wav(self.root / 'gap.wav', [(3.0, True), (2.0, False), (4.6, True), (0.4, False)])),
            'caption_coverage': (timeline(captions=[{'start': 0.0, 'end': 2.0, 'text': '积木', 'en': 'Bricks.'},
                                                    {'start': 6.0, 'end': 9.6, 'text': '留言关注点赞', 'en': 'Outro.'}]), self.voice),
            'poster_in_video': (timeline(cartoonScenes=[{'kind': 'demo', 'start': 0, 'end': 6, 'image': '海报-16x9.png'},
                                                        timeline()['cartoonScenes'][1]]), self.voice),
            'series_theme': (timeline(modules={**timeline()['modules'], 'background': 'glass'}), self.voice),
        }
        for check, (doc, audio) in cases.items():
            with self.subTest(check=check):
                result = run({}, doc, audio, outro=OUTRO)
                self.assertIn(check, self.checks(result), result)
                with self.assertRaisesRegex(ValueError, check):
                    enforce(result)

    def test_silent_previews_warn_on_draft_content_but_still_block_posters(self):
        doc = timeline(modules={**timeline()['modules'], 'background': 'glass'}, captions=[])
        result = run({}, doc, None, preview=True, outro=OUTRO)
        self.assertEqual(result['errors'], [])
        self.assertTrue(any('series_theme' in w for w in result['warnings']))
        poster = timeline(cartoonScenes=[{'kind': 'demo', 'start': 0, 'end': 6, 'image': 'cover-16x9.png'},
                                         timeline()['cartoonScenes'][1]])
        self.assertIn('poster_in_video', self.checks(run({}, poster, None, preview=True, outro=OUTRO)))

    def test_waivers_need_a_recorded_reason(self):
        doc = timeline(captions=[])
        result = run({'preflight': {'allow': {'captions_present': '用户原话：这期不要字幕'}}}, doc, self.voice, outro=OUTRO)
        self.assertEqual(result['errors'], [])
        self.assertEqual(result['waived'][0]['reason'], '用户原话：这期不要字幕')
        self.assertNotIn('captions_present', result['checks'])
        for allow in ({'captions_present': ''}, {'unknown': 'reason'}, ['captions_present']):
            with self.subTest(allow=allow), self.assertRaises(ValueError):
                run({'preflight': {'allow': allow}}, doc, self.voice, outro=OUTRO)

    def test_compile_blocks_a_poster_inside_the_video_before_reserving_output(self):
        init(self.root / 'project', '演示', '副标题', '系列')
        base = self.root / 'project'
        doc = json.loads((base / 'project.json').read_text())
        (base / '海报-16x9.png').write_bytes((Path(__file__).resolve().parents[2] / 'assets/branding/vi-say-logo.png').read_bytes())
        doc['scenes'][0] = {'kind': 'demo', 'start': 0, 'end': 4, 'title': '封面', 'image': '海报-16x9.png'}
        with patch('production.covers'), self.assertRaisesRegex(ValueError, 'poster_in_video'):
            compile_project(base, doc, self.root / 'out', preview=True)
        self.assertFalse((self.root / 'out').exists())

    def test_compile_records_the_gate_result_next_to_the_timeline(self):
        init(self.root / 'project', '演示', '副标题', '系列')
        base = self.root / 'project'
        doc = json.loads((base / 'project.json').read_text())
        with patch('production.covers'):
            timeline_path = compile_project(base, doc, self.root / 'out', preview=True)
        record = json.loads((timeline_path.parent / 'preflight.json').read_text())
        self.assertEqual(record['errors'], [])
        self.assertEqual(json.loads(timeline_path.read_text())['modules']['background'], 'comic')


if __name__ == '__main__':
    unittest.main()
