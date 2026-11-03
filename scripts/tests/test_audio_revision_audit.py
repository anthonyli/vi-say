"""Synthetic structure-only tests. No fake fixture is a real listening record."""
import unittest
import copy
import hashlib
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_audio_acceptance_candidate import GateTests
from audio_revision_audit import audit


class RevisionTests(GateTests):
    def setUp(self):
        super().setUp()
        ref={'path':str(self.base/'synthetic-evidence.txt'),'sha256':hashlib.sha256((self.base/'synthetic-evidence.txt').read_bytes()).hexdigest()}
        self.reject=[{'id':'rejected-sample-1','source_sha256':'1'*64,'final_sha256':'2'*64}]
        self.r['rejection_history']=[{**self.reject[0],'status':'rejected','feedback':'SYNTHETIC rejection; not actual user evidence','evidence':ref}]
        self.r['revision']={'status':'corrected_candidate_unverified','final_sha256':self.r['final_sha256'],'evidence':ref}
        self.r['dsp']={'DF3':'success','spectrum':'passed','ASR':'passed','deess':'success'}
        self.r['non_speech_regression_audit']={'final_sha256':self.r['final_sha256'],'method':'synthetic comparison','evidence':ref,'regions':[],'no_regions_rationale':'fixture only'}
        self.accept={'status':'accepted','scope':'full_final_track','final_sha256':self.r['final_sha256'],'evidence':ref}
    def revised(self):return audit(self.r,self.req,self.reject,self.final,self.base)
    def test_new_transient_regression_blocks(self):
        self.r['user_final_acceptance']=self.accept
        self.r['non_speech_regression_audit']['regions']=[{'classification_basis':'synthetic uncertain low-energy region','comparison':'synthetic baseline vs candidate','new_transient_flag':True,'resolution':'unresolved'}]
        self.assertFalse(self.revised()['evidence_record_validated'])
    def test_dsp_cannot_override_rejection(self):
        out=self.revised();self.assertFalse(out['evidence_record_validated']);self.assertEqual(out['status'],'corrected_candidate_unverified')
    def test_no_listening_remains_explicit(self):
        self.r.pop('listening');out=self.revised();self.assertEqual(out['listening_gate_status'],'needs_listening');self.assertFalse(out['evidence_record_validated'])
    def test_rejection_cannot_be_deleted(self):
        self.r['rejection_history']=[];self.r['user_final_acceptance']=self.accept;self.assertFalse(self.revised()['evidence_record_validated'])
    def test_rejected_sha_mismatch_fails(self):
        self.r['rejection_history'][0]['source_sha256']='3'*64;self.r['user_final_acceptance']=self.accept;self.assertFalse(self.revised()['evidence_record_validated'])
    def test_rejected_cannot_be_rewritten_passed(self):
        self.r['rejection_history'][0]['status']='passed';self.r['user_final_acceptance']=self.accept;self.assertFalse(self.revised()['evidence_record_validated'])
    def reject_current(self):
        self.reject[0]['final_sha256'] = self.r['final_sha256']
        self.r['rejection_history'][0]['final_sha256'] = self.r['final_sha256']
        self.r['rejection_history'][0]['observation_category'] = 'background_layer'
    def test_current_rejected_sha_cannot_be_corrected_candidate(self):
        self.reject_current()
        out=self.revised();self.assertEqual(out['status'],'rejected_by_user');self.assertFalse(out['evidence_record_validated'])
    def test_generic_acceptance_cannot_erase_later_rejection(self):
        self.reject_current();self.r['user_final_acceptance']=self.accept
        out=self.revised();self.assertEqual(out['status'],'rejected_by_user');self.assertFalse(out['evidence_record_validated'])
    def test_explicit_subsequent_same_sha_retraction_structure(self):
        self.reject_current();self.r['user_final_acceptance']=self.accept
        self.r['user_rejection_retraction']={**self.accept,'supersedes_rejection_ids':[self.reject[0]['id']],
            'subsequent_to_all_listed_rejections':True,'user_message_id':'SYNTHETIC-LATER',
            'explicit_user_statement':'SYNTHETIC fixture only: retract earlier rejection'}
        out=self.revised();self.assertEqual(out['status'],'evidence_record_validated');self.assertFalse(out['content_truth_verified'])
    def test_wrong_sha_retraction_cannot_clear_current_rejection(self):
        self.reject_current();self.r['user_rejection_retraction']={**self.accept,'final_sha256':'f'*64}
        self.assertEqual(self.revised()['status'],'rejected_by_user')
    def test_complete_synthetic_structure_only(self):
        self.r['user_final_acceptance']=self.accept;out=self.revised();self.assertTrue(out['evidence_record_validated']);self.assertFalse(out['content_truth_verified'])

if __name__=='__main__':unittest.main(verbosity=2)
