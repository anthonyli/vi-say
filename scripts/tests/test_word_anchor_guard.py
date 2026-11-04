# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import importlib.util
from pathlib import Path
import unittest
p=Path(__file__).resolve().parents[2]/'assets/shared-motion/word_anchor_guard_candidate.py'
s=importlib.util.spec_from_file_location('word_guard',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class WordDependencyTests(unittest.TestCase):
 def test_ascending_but_incomplete_capture_rejected(self):
  with self.assertRaises(ValueError):m.require_completed({'record':.3,'move':.6},[('record',.35,'move')])
 def test_completed_real_second_chain_accepted(self):
  self.assertTrue(m.require_completed({'record':.2,'move':.6,'ready':1.46,'paste':1.72},[('record',.35,'move'),('move',.78,'ready'),('ready',.16,'paste')]))
 def test_recognition_overlap_rejected(self):
  with self.assertRaises(ValueError):m.require_completed({'move':.6,'ready':1.2},[('move',.78,'ready')])
 def test_nonpositive_duration_rejected(self):
  with self.assertRaises(ValueError):m.require_completed({'a':0,'b':1},[('a',0,'b')])
if __name__=='__main__':unittest.main()
