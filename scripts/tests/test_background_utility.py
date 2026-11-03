"""Synthetic structural fixtures, not real background/listening validation."""
import unittest,tempfile,json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_background_utility import check,sha
class UtilityTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.p=Path(self.tmp.name);self.f=self.p/'synthetic.txt';self.f.write_text('synthetic nonaudio evidence');h=sha(self.f);ref={'path':str(self.f),'sha256':h}
  self.req=[{'id':x,'span':[i,i+1],'min_background_reduction_db':1.0} for i,x in enumerate(['P1','P7','P8'])]
  self.r={'final_sha256':h,'windows':[dict(x,final_sha256=h,measured_background_reduction_db=2,measurement_evidence=ref,observation_category='background_layer',template_validation={'actual_word_boundaries_checked':True,'periodicity_and_spectral_stability_checked':True,'held_out_validation_checked':True,'evidence':ref}) for x in self.req],'risks':{k:{'status':'not_checked','note':'synthetic; no listening'} for k in ['speech_in_residual','new_transients','voice_fidelity','musical_noise']}}
 def run_gate(self):return check(self.r,self.req,self.f,self.p)
 def test_structural_success_never_audio_pass(self):
  r=self.run_gate();self.assertTrue(r['measured_effect_record_validated']);self.assertFalse(r['audio_pass'])
 def test_mask_control_weak_targets_block_despite_safeguards(self):
  self.r['safeguards']='phase/silence/codec pass'
  for row,v in zip(self.r['windows'],[.0534,0,.3127]):row['measured_background_reduction_db']=v
  self.assertFalse(self.run_gate()['measured_effect_record_validated'])
 def test_missing_window_blocks(self):
  self.r['windows'].pop();self.assertFalse(self.run_gate()['measured_effect_record_validated'])
 def test_asr_or_low_energy_not_template(self):
  self.r['windows'][0]['template_validation']={'ASR':'passed','low_energy':True};self.assertFalse(self.run_gate()['measured_effect_record_validated'])
 def test_missing_risk_blocks(self):
  self.r['risks'].pop('speech_in_residual');self.assertFalse(self.run_gate()['measured_effect_record_validated'])
 def test_stale_sha_blocks(self):
  self.r['final_sha256']='0'*64;self.assertFalse(self.run_gate()['measured_effect_record_validated'])
 def test_no_evidence_blocks(self):
  self.r['windows'][0]['measurement_evidence']={};self.assertFalse(self.run_gate()['measured_effect_record_validated'])
if __name__=='__main__':unittest.main()
