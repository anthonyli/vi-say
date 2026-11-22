# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import wave


SCRIPTS = Path(__file__).resolve().parents[1]


class AudioOutputPaths(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.source = self.root / 'source.wav'
        with wave.open(str(self.source), 'wb') as wav:
            wav.setparams((1, 2, 16000, 0, 'NONE', ''))
            wav.writeframes(struct.pack('<4h', 0, 5000, 0, -5000) * 4000)
        self.original = self.source.read_bytes()

    def cli(self, name, *args):
        return subprocess.run([sys.executable, str(SCRIPTS / name), *map(str, args)],
                              capture_output=True, text=True)

    def test_timing_map_cannot_overwrite_either_wav(self):
        output = self.root / 'new' / 'processed.wav'
        source_alias = self.root / 'source-link.wav'
        source_alias.symlink_to(self.source)
        for mapping in (self.source, source_alias, output):
            with self.subTest(mapping=mapping):
                run = self.cli('audio_timing.py', self.source, '--output', output, '--map', mapping)
                self.assertNotEqual(run.returncode, 0)
                self.assertIn('Timing map cannot overwrite', run.stderr)
                self.assertEqual(self.source.read_bytes(), self.original)
                self.assertFalse(output.parent.exists())

        existing = self.root / 'processed.wav'
        existing.write_bytes(self.original)
        mapping = self.root / 'processed-link.json'
        mapping.hardlink_to(existing)
        run = self.cli('audio_timing.py', self.source, '--output', existing, '--map', mapping)
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('Timing map cannot overwrite', run.stderr)
        self.assertEqual(existing.read_bytes(), self.original)

    def test_pause_audit_cannot_overwrite_audio_or_generation(self):
        generation = self.root / 'generation.json'
        metadata = json.dumps({'audio_sha256': hashlib.sha256(self.original).hexdigest()})
        generation.write_text(metadata)
        audio_alias = self.root / 'audio-link.wav'
        audio_alias.hardlink_to(self.source)
        for output in (self.source, audio_alias, generation):
            with self.subTest(output=output):
                run = self.cli('audit_speech_pauses.py', self.source, '--generation', generation, '--output', output)
                self.assertNotEqual(run.returncode, 0)
                self.assertIn('Report cannot overwrite', run.stderr)
                self.assertEqual(self.source.read_bytes(), self.original)
                self.assertEqual(generation.read_text(), metadata)
        report = self.root / 'pause-report.json'
        run = self.cli('audit_speech_pauses.py', self.source, '--generation', generation, '--output', report)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(json.loads(report.read_text())['audio_sha256'], json.loads(metadata)['audio_sha256'])

    def test_timing_with_separate_outputs_keeps_source_and_writes_both_files(self):
        output = self.root / 'processed.wav'
        mapping = self.root / 'timing.json'
        run = self.cli('audio_timing.py', self.source, '--output', output, '--map', mapping)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(self.source.read_bytes(), self.original)
        self.assertEqual(output.read_bytes()[:4], b'RIFF')
        self.assertIn('output_duration', json.loads(mapping.read_text()))

    def test_timing_preserves_wav_when_new_names_differ_only_by_case(self):
        if not (self.root / 'SOURCE.WAV').is_file():
            self.skipTest('Case-sensitive filesystem')
        output = self.root / 'processed.wav'
        run = self.cli('audio_timing.py', self.source, '--output', output, '--map', self.root / 'PROCESSED.WAV')
        self.assertNotEqual(run.returncode, 0)
        self.assertIn('Timing map cannot overwrite', run.stderr)
        self.assertEqual(self.source.read_bytes(), self.original)
        if output.exists():
            self.assertEqual(output.read_bytes()[:4], b'RIFF')
