# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from speech_cues import resolve_cues, has_cues
from production import init, compile_project


def characters(text, start=0.0, step=.2):
    return [{'char': c, 'start': round(start + i * step, 3), 'end': round(start + (i + 1) * step, 3)}
            for i, c in enumerate(text)]


class SpeechCues(unittest.TestCase):
    def test_cues_become_scene_relative_word_times(self):
        chars = characters('先导入再排版最后发布欢迎关注')
        scenes = [{'kind': 'stage', 'start': 0, 'end': 1.2, 'effects': []},
                  {'kind': 'stage', 'start': 1.2, 'end': 2.8, 'effects': [
                      {'type': 'cue-cards', 'box': [0, 0, 600, 400], 'cue': '发布', 'endCue': '关注', 'items': [
                          {'cue': '发布', 'title': 'a'}, {'cue': '欢迎', 'cueOffset': -.05, 'title': 'b'}]}],
                   'items': [{'text': 'x', 'cue': '最后'}]}]
        resolved = resolve_cues(scenes, chars)
        stage = resolved[1]
        self.assertEqual(stage['items'][0]['at'], 0.0)
        effect = stage['effects'][0]
        self.assertEqual(effect['at'], 0.4)
        self.assertEqual([i['at'] for i in effect['items']], [0.4, 0.75])
        self.assertEqual(effect['endAt'], 1.2)
        self.assertFalse(has_cues(resolved))
        self.assertTrue(has_cues(scenes), 'the input is not mutated')

    def test_unspoken_or_untimed_cues_fail_clearly(self):
        scenes = [{'kind': 'stage', 'start': 0, 'end': 1, 'effects': [{'type': 'stamp', 'cue': '关注'}]}]
        with self.assertRaisesRegex(ValueError, 'word timing'):
            resolve_cues(scenes, None)
        with self.assertRaisesRegex(ValueError, "cue '关注' is not spoken inside 0.00–1.00s"):
            resolve_cues(scenes, characters('先导入再关注', step=.5))
        plain = [{'kind': 'stage', 'start': 0, 'end': 1, 'effects': [{'type': 'cue-cards', 'items': []}]}]
        self.assertEqual(resolve_cues(plain, None), plain, 'an effect named cue-cards is not a cue')

    def test_compile_resolves_cues_from_the_aligned_captions_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            init(root / 'project', '演示', '副标题', '系列')
            base = root / 'project'
            doc = json.loads((base / 'project.json').read_text())
            spoken = '看问题做演示看结果'
            (base / 'captions.json').write_text(json.dumps({
                'captions': [{'start': 4.0, 'end': 8.9, 'text': spoken, 'en': 'Problem, demo, result.'}],
                'characters': characters(spoken, start=4.2, step=.4)}, ensure_ascii=False))
            doc['captions'] = 'captions.json'
            for item, word in zip(doc['scenes'][1]['items'], ['问题', '演示', '结果']):
                item.pop('at'); item['cue'] = word
            with patch('production.covers'):
                timeline = compile_project(base, doc, root / 'out', preview=True)
            items = json.loads(timeline.read_text())['cartoonScenes'][1]['items']
            self.assertEqual([i['at'] for i in items], [0.6, 1.8, 3.0])
            self.assertTrue(all('cue' not in i for i in items))


if __name__ == '__main__':
    unittest.main()
