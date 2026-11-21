# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from review_pack import contact_sheet, fullest, pacing


def scene(kind, start, end, **extra):
    return {'kind': kind, 'start': start, 'end': end, 'title': 't', **extra}


class ReviewPack(unittest.TestCase):
    def test_long_holds_without_visible_change_are_reported(self):
        timeline = {'cartoonScenes': [
            scene('stage', 0, 9, effects=[{'type': 'stamp', 'at': 1}]),
            scene('stage', 9, 14, effects=[{'type': 'cue-cards', 'items': [{'at': .4}, {'at': 2.2}, {'at': 4.0}]}]),
            scene('demo', 14, 22, image='a.png'),
            scene('demo', 22, 40, video='b.mp4'),
        ], 'captions': []}
        findings = pacing(timeline)
        self.assertEqual([f['scene'] for f in findings], [1])
        self.assertIn('8.0s', findings[0]['message'])

    def test_caption_rhythm_flags_flashes_and_fast_reading(self):
        timeline = {'cartoonScenes': [], 'captions': [
            {'start': 0, 'end': .6, 'text': '太快'},
            {'start': 1, 'end': 2, 'text': '这一句有十个字要在一秒读完'},
            {'start': 3, 'end': 5, 'text': '正常速度的一句字幕'},
        ]}
        self.assertEqual([f['check'] for f in pacing(timeline)], ['caption_flash', 'caption_speed'])

    def test_sheet_frames_come_before_effects_put_themselves_away(self):
        self.assertEqual(fullest(scene('stage', 0, 7)), 7)
        self.assertAlmostEqual(fullest(scene('stage', 0, 7, effects=[{'endAt': 6.6, 'exit': 'shrink'}])), 6.2)
        self.assertEqual(fullest(scene('stage', 0, 7, effects=[{'endAt': 6.6}])), 7)

    def test_contact_sheet_lays_out_labelled_frames(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            frames = []
            for i in range(4):
                path = root / f'{i}.png'
                Image.new('RGB', (1920, 1080), (i * 60, 80, 120)).save(path)
                frames.append((path, f'场景 {i + 1}'))
            out = contact_sheet(frames, root / 'sheet.jpg', columns=3, width=320)
            with Image.open(out) as sheet:
                self.assertEqual(sheet.size, (960, 2 * (180 + 40)))
            self.assertIsNone(contact_sheet([], root / 'empty.jpg'))


if __name__ == '__main__':
    unittest.main()
