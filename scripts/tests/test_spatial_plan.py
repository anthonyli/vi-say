import copy,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts'))
from check_spatial_plan import check
class PlanTests(unittest.TestCase):
 def setUp(self):self.p=json.loads((ROOT/'assets/acceptance/spatial-plan.example.json').read_text())
 def test_reverse_chain_rejected(self):
  self.p['transitions'][0].update({'from':'session','to':'files','start':0,'text_stable_at':.8});self.assertFalse(check(self.p)['passed'])
 def test_invalid_tolerance_rejected(self):
  self.p['transitions'][0]['boundary_tolerance']='x';self.assertFalse(check(self.p)['passed'])
 def test_valid(self):self.assertTrue(check(self.p)['passed'])
 def test_normalized_time_rejected(self):self.p['timebase']='normalized';self.assertFalse(check(self.p)['passed'])
 def test_same_layout_rejected(self):self.p['scenes'][1]['layout']=copy.deepcopy(self.p['scenes'][0]['layout']);self.assertFalse(check(self.p)['passed'])
 def test_late_visual_rejected(self):self.p['scenes'][1]['audio_anchors'][0]['visible_at']=8;self.assertFalse(check(self.p)['passed'])
 def test_missing_result_rejected(self):del self.p['scenes'][0]['result'];self.assertFalse(check(self.p)['passed'])
 def test_gap_rejected(self):self.p['scenes'][1]['start']=5.2;self.assertFalse(check(self.p)['passed'])
 def test_no_reading_window_rejected(self):self.p['transitions'][0]['text_stable_at']=11;self.assertFalse(check(self.p)['passed'])
if __name__=='__main__':unittest.main()
