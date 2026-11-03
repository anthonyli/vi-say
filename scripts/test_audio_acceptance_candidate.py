"""Synthetic fixtures only: no audio generation/listening and no claim of real quality."""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from audio_acceptance_candidate import validate


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.final = self.base/'synthetic-not-audio.bin'
        self.final.write_bytes(b'fixture not real audio')
        evidence = self.base/'synthetic-evidence.txt'
        evidence.write_text('FAKE fixture; structural test only; no listening occurred.')
        ref = lambda p: {'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
        self.req = [{'id': 'opening', 'span': [0, 2]}, {'id': 'w12_16', 'span': [12, 16]}, {'id': 'w34_36', 'span': [34, 36]}, {'id': 'w46_48', 'span': [46, 48]}, {'id': 'w57_59', 'span': [57, 59]}]
        self.r = {'schema_version': 1, 'final_sha256': ref(self.final)['sha256'], 'duration_seconds': 60,
                  'technical': {'asr': 'passed', 'clipping': 'none', 'decode': 'passed', 'spectrogram': 'passed'},
                  'windows': [], 'unresolved_items': [],
                  'full_track_audit': {'final_sha256': ref(self.final)['sha256'], 'coverage': [[0,60]], 'method': 'synthetic full audit', 'findings': [], 'evidence': ref(evidence)},
                  'listening': {'method': 'human_direct_playback', 'scope': 'full_final_track', 'reviewer': 'SYNTHETIC FIXTURE, NOT ACTUAL REVIEWER', 'performed_at': 'fixture-time', 'coverage': [[0,60]], 'final_sha256': ref(self.final)['sha256'], 'verdict': 'no_unresolved_anomaly_observed', 'reviewed_window_ids': [x['id'] for x in self.req], 'evidence': ref(evidence)}}
        for w in self.req:
            self.r['windows'].append({**w, 'resolution': 'fixed', 'mapping_rationale': 'synthetic identity mapping', 'traces': {s: {'artifact': ref(self.final), 'spans': [w['span']], 'evidence': ref(evidence), 'finding': 'synthetic finding, not real diagnosis'} for s in ('original_tts','master','final')}})

    def check(self):
        return validate(self.r, self.req, self.final, self.base)

    def test_technical_all_passed_without_listening_fails(self):
        self.r.pop('listening')
        result = self.check()
        self.assertEqual(result['status'], 'needs_listening')
        self.assertFalse(result['evidence_record_validated'])

    def test_short_sample_approval_fails(self):
        self.r['listening']['coverage'] = [[0,6]]
        self.r['listening']['scope'] = 'approved_short_sample'
        self.assertEqual(self.check()['status'], 'needs_listening')

    def test_missing_user_window_fails(self):
        self.r['windows'].pop()
        self.assertFalse(self.check()['evidence_record_validated'])

    def test_final_sha_mismatch_fails(self):
        self.final.write_bytes(b'changed after review')
        self.assertFalse(self.check()['evidence_record_validated'])

    def test_audit_gap_fails(self):
        self.r['full_track_audit']['coverage'] = [[0,20],[21,60]]
        self.assertFalse(self.check()['evidence_record_validated'])

    def test_unresolved_fails(self):
        self.r['unresolved_items'] = ['possible artifact at 15s']
        self.assertFalse(self.check()['evidence_record_validated'])

    def test_complete_fake_fixture_validates_structure_only(self):
        result = self.check()
        self.assertTrue(result['evidence_record_validated'])
        self.assertFalse(result['content_truth_verified'])
        self.assertFalse(result['audio_quality_independently_verified'])
        self.assertEqual(result['status'], 'evidence_record_validated')


if __name__ == '__main__':
    unittest.main(verbosity=2)
