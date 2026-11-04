# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_audio_energy_regression import detect
class EnergyTests(unittest.TestCase):
 def test_new_impulse_blocked(self):
  a=[0.0]*960;b=a.copy();b[500]=10**(-25.64/20);self.assertEqual(detect(a,b)['status'],'blocked')
 def test_unchanged_quiet_not_flagged(self):self.assertEqual(detect([0.0]*480,[0.0]*480)['flags'],[])
 def test_unvoiced_speech_not_named_noise(self):
  a=[.05,-.05]*240;r=detect(a,a);self.assertEqual(r['flags'],[]);self.assertFalse(r['audio_quality_verified'])
 def test_misaligned_fails(self):self.assertEqual(detect([0.0]*480,[0.0]*481)['status'],'blocked')
if __name__=='__main__':unittest.main(verbosity=2)
