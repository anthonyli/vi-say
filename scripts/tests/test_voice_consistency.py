# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
from pathlib import Path
import sys
import tempfile
import unittest
import wave
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from voice_consistency import semantic_segments, join_pcm
from check_voice_identity import window_starts


class SemanticVoiceTests(unittest.TestCase):
    def test_sentence_boundaries_preserve_whole_phrases_and_paragraphs(self):
        text = '先保留整个句子。再使用同一声音。第三个完整句子。\n\n下一段继续。'
        parts = semantic_segments(text, 20)
        self.assertEqual(parts[-1], '下一段继续。')
        self.assertTrue(all(len(s) <= 20 for s in parts))
        self.assertEqual(''.join(parts), text.replace('\n\n', ''))

    def test_oversized_sentence_is_not_cut_into_subtitle_fragments(self):
        with self.assertRaisesRegex(ValueError, 'complete sentence'):
            semantic_segments('这是一个' * 20 + '。', 30)

    def test_english_decimal_is_not_a_sentence_boundary(self):
        self.assertEqual(semantic_segments('Keep 1.25 as written. Next sentence!', 40), ['Keep 1.25 as written. Next sentence!'])

    def test_mixed_pcm_rates_cannot_be_joined_as_if_they_matched(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sources = []
            for rate in [24000, 48000]:
                path = root / f'{rate}.wav'
                with wave.open(str(path), 'wb') as audio:
                    audio.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
                    audio.writeframes(b'\x01\x00' * 100)
                sources.append(path)
            with self.assertRaisesRegex(ValueError, 'identical'):
                join_pcm(sources, root / 'joined.wav')

    def test_sliding_windows_include_the_tail_without_short_final_windows(self):
        self.assertEqual(window_starts(19, 8, 4), [0, 4, 8, 11])
        self.assertEqual(window_starts(3, 8, 4), [0])
        for args in [(0, 8, 4), (20, 8, 9), (20, float('nan'), 4)]:
            with self.assertRaises(ValueError):
                window_starts(*args)


if __name__ == '__main__':
    unittest.main()
