# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import importlib.util
from pathlib import Path
import tempfile
import unittest
p=Path(__file__).resolve().parents[1]/'audio_timing.py'
spec=importlib.util.spec_from_file_location('audio_timing_candidate',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class TimingDefaults(unittest.TestCase):
 def args(self,*extra):return m.parse_args(['not-read.wav','--output','not-written.wav','--map','not-written.json',*extra])
 def test_default_original_speed(self):
  a=m.validate_options(self.args());self.assertEqual(a.speed,1.0);self.assertEqual(m.map_time(3,{'cuts':[],'speed':a.speed}),3)
 def test_explicit_speed_without_authority_rejected(self):
  with self.assertRaises(ValueError):m.validate_options(self.args('--speed','1.12'))
 def test_authorization_without_actual_evidence_rejected(self):
  with self.assertRaises(ValueError):m.validate_options(self.args('--speed','1.12','--speed-authorization','fixture authorization'))
 def test_structural_authorized_speed_option(self):
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/'evidence.txt';f.write_text('Synthetic fixture only, not a real listening approval.')
   a=m.validate_options(self.args('--speed','1.08','--speed-authorization','synthetic fixture','--listening-evidence',str(f)));self.assertEqual(a.speed,1.08)
if __name__=='__main__':unittest.main()
