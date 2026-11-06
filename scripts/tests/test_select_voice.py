# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import sys
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("select_voice", Path(__file__).resolve().parents[1] / "select_voice.py")
voice = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(voice)


class VoiceSelectionTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.library = self.root / "private/voice"
        self.selection = self.root / "work/episode/voice-selection.json"
        for name in ("male", "female"):
            directory = self.library / name
            directory.mkdir(parents=True)
            (directory / "reference.wav").write_bytes(b"private test audio")
            (directory / "reference.txt").write_text("reference transcription")
            config = {"reference_audio": "reference.wav", "reference_text_file": "reference.txt",
                      "consent": {"authorized": True, "speaker": "authorized_speaker", "scope": "local_narration"}}
            (directory / "voice-preferences.json").write_text(json.dumps(config))

    def test_random_choice_is_persisted_across_narration_and_outro(self):
        with patch.object(voice.secrets, "choice", return_value="male") as choose:
            first = voice.select_voice(self.library, self.selection)
            second = voice.select_voice(self.library, self.selection)
        self.assertEqual(first, second)
        choose.assert_called_once()

    def test_unauthorized_profile_is_excluded(self):
        config = self.library / "male/voice-preferences.json"
        data = json.loads(config.read_text())
        data["consent"]["authorized"] = False
        config.write_text(json.dumps(data))
        self.assertEqual(voice.select_voice(self.library, self.selection)["voice"], "female")

    def test_explicit_switch_cannot_change_an_existing_episode(self):
        voice.select_voice(self.library, self.selection, "male")
        with self.assertRaisesRegex(ValueError, "already selected"):
            voice.select_voice(self.library, self.selection, "female")

    def test_reference_changes_invalidate_selection(self):
        voice.select_voice(self.library, self.selection, "female")
        (self.library / "female/reference.wav").write_bytes(b"another speaker")
        with self.assertRaisesRegex(ValueError, "assets changed"):
            voice.select_voice(self.library, self.selection)

    def test_concurrent_choices_reuse_the_same_complete_record(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: voice.select_voice(self.library, self.selection), range(8)))
        self.assertTrue(all(item == results[0] for item in results))
        self.assertIn(json.loads(self.selection.read_text())["voice"], {"male", "female"})

    def test_selection_from_another_library_is_rejected(self):
        voice.select_voice(self.library, self.selection, "female")
        with self.assertRaisesRegex(ValueError, "another voice library"):
            voice.select_voice(self.root / "other-library", self.selection)

    def test_invalid_profile_names_are_rejected(self):
        for name in ("..", ".", "../male"):
            with self.assertRaises(ValueError):
                voice.select_voice(self.library, self.selection, name)

    def test_pinned_default_is_reused_across_episodes_without_random_selection(self):
        voice.select_voice(self.library, self.library / 'fixed-voice.json', 'female')
        with patch.object(voice.secrets, 'choice', side_effect=AssertionError('must not choose randomly')):
            self.assertEqual(voice.select_voice(self.library, self.selection)['voice'], 'female')
            self.assertEqual(voice.select_voice(self.library, self.root / 'work/another.json')['voice'], 'female')

    def test_changed_pinned_reference_fails_instead_of_falling_back_to_another_voice(self):
        voice.select_voice(self.library, self.library / 'fixed-voice.json', 'female')
        (self.library / 'female/reference.wav').write_bytes(b'changed speaker')
        with self.assertRaisesRegex(ValueError, 'assets changed'):
            voice.select_voice(self.library, self.selection)

    def test_invalid_pinned_alias_cannot_recurse(self):
        (self.library / 'fixed-voice.json').write_text(json.dumps({'voice': 'default'}))
        with self.assertRaisesRegex(ValueError, 'Invalid pinned'):
            voice.select_voice(self.library, self.selection)

    def test_default_synthesis_config_uses_pin_even_if_old_alias_points_elsewhere(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from local_voice import default_voice_config
        voice.select_voice(self.library, self.library / 'fixed-voice.json', 'female')
        (self.library / 'voice-preferences.json').symlink_to('male/voice-preferences.json')
        self.assertEqual(default_voice_config(self.library), (self.library / 'female/voice-preferences.json').resolve())


if __name__ == "__main__":
    unittest.main()
