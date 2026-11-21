# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import json
from pathlib import Path
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from align_captions import align, main

IDENTITY = {'speed': 1, 'cuts': [], 'output_duration': 6.0}


def whisper(*words):
    return {'segments': [{'words': [{'word': w, 'start': a, 'end': b} for w, a, b in words]}]}


class AlignCaptions(unittest.TestCase):
    def test_whisper_words_bind_authored_bilingual_cues(self):
        asr = whisper(('打开', 0.2, 0.6), ('Compare', 0.6, 1.2), ('软件', 1.3, 1.7), ('对比', 1.7, 2.1),
                      ('先看', 2.6, 3.0), ('价格', 3.0, 3.5))
        cues = [{'text': '打开 Compare 软件对比。', 'en': 'Open Compare.'}, {'text': '先看价格。', 'en': 'Check prices.', 'keywords': ['价格']}]
        result = align(asr, IDENTITY, cues)
        first, second = result['captions']
        self.assertEqual((first['start'], first['en']), (0.2, 'Open Compare.'))
        self.assertAlmostEqual(first['end'], 2.2)
        self.assertEqual((second['start'], second['keywords']), (2.6, ['价格']))
        self.assertTrue(result['verification']['normalized_text_exact_match'])

    def test_asr_spelling_differences_need_a_recorded_review(self):
        asr = whisper(('二零二七', 0.0, 1.0), ('版', 1.0, 1.2), ('每段', 1.4, 1.8), ('五分钟', 1.8, 2.6))
        cues = [{'text': '2027版，每段五分钟。', 'en': 'Five minutes each in 2027.'}]
        with self.assertRaisesRegex(ValueError, "script='2027'.*ASR='二零二七'"):
            align(asr, IDENTITY, cues)
        result = align(asr, IDENTITY, cues, accept_differences='听过：读作二零二七，字幕写数字')
        cue = result['captions'][0]
        self.assertEqual(cue['start'], 0.0)
        self.assertAlmostEqual(cue['end'], 2.7)
        chars = result['characters']
        self.assertTrue(all(c.get('interpolated') for c in chars[:4]))
        self.assertTrue(all(chars[i]['start'] <= chars[i + 1]['start'] for i in range(len(chars) - 1)))
        self.assertEqual(result['verification']['accepted_differences_reason'], '听过：读作二零二七，字幕写数字')

    def test_cli_accepts_dashscope_text_and_builds_the_identity_map_from_audio(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'words.json').write_text(json.dumps({'transcriptions': [{'transcripts': [{'sentences': [{'words': [
                {'text': '你好', 'begin_time': 100, 'end_time': 500}, {'text': '世界', 'begin_time': 600, 'end_time': 1000}]}]}]}]}))
            (root / 'narration.txt').write_text('你好，世界。')
            with wave.open(str(root / 'voice.wav'), 'wb') as w:
                w.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
                w.writeframes(b'\0\0' * 24000)
            args = ['--alignment', str(root / 'words.json'), '--text', str(root / 'narration.txt'),
                    '--audio', str(root / 'voice.wav'), '--output', str(root / 'captions.json')]
            main(args)
            captions = json.loads((root / 'captions.json').read_text())['captions']
            self.assertEqual([c['text'] for c in captions], ['你好，', '世界。'])
            self.assertLessEqual(captions[-1]['end'], 1.5)
            with self.assertRaises(FileExistsError):
                main(args)


if __name__ == '__main__':
    unittest.main()
