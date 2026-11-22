from contextlib import redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_delivery import check, main, SELF_MEDIA
from revise_delivery import create

class Delivery(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name);self.manifest = self.root/'delivery.json'
        self.doc = {'schema_version':1,'profile':'self_media_narrated','artifacts':{}}
        sizes = {'poster_16x9':(160,90),'poster_4x3':(120,90),'poster_3x4':(90,120)}
        for role in SELF_MEDIA:
            p=self.root/(role+('.png' if role in sizes else '.txt'))
            if role in sizes:Image.new('RGB',sizes[role]).save(p)
            else:p.write_text('synthetic test fixture')
            self.bind(role,p)
    def bind(self,role,p):
        self.doc['artifacts'][role]={'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        if role.startswith('poster_'):
            prompt=self.root/'prompt.txt';prompt.write_text('Actual generation prompt fixture')
            ref=self.root/'reference.png'
            Image.new('RGB',(10,10)).save(ref)
            def binding(f):return {'path':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
            self.doc['artifacts'][role]['generation']={'method':'imagegen','prompt':binding(prompt),'references':[binding(ref)]}
    def run_check(self):
        self.manifest.write_text(json.dumps(self.doc));return check(self.manifest)
    def test_complete_is_not_quality_approval(self):
        r=self.run_check();self.assertTrue(r['complete']);self.assertFalse(r['quality_assessed'])
    def test_unlisted_copy_and_deleted_poster_fail(self):
        del self.doc['artifacts']['publishing_copy']
        (self.root/'poster_3x4.png').unlink()
        self.assertEqual(len(self.run_check()['errors']),2)
    def test_modified_artifact_fails(self):
        (self.root/'video.txt').write_text('different video fixture')
        self.assertFalse(self.run_check()['complete'])
    def test_wrong_ratio_even_with_new_hash_fails(self):
        p=self.root/'poster_3x4.png';Image.new('RGB',(160,90)).save(p);self.bind('poster_3x4',p)
        self.assertFalse(self.run_check()['complete'])
    def test_missing_like_follow_not_satisfied_by_comment(self):
        p=self.root/'script.txt';p.write_text('欢迎评论区留言');self.bind('script',p)
        self.doc['text_requirements']=[{'id':x,'role':'script','any_of':[x]} for x in ['点赞','关注','留言']]
        self.assertEqual(len(self.run_check()['errors']),2)
        p.write_text('欢迎留言 关注 点赞');self.bind('script',p)
        self.assertTrue(self.run_check()['complete'])
    def test_poster_requires_bound_generation_inputs(self):
        del self.doc['artifacts']['poster_16x9']['generation']
        self.assertIn('poster_16x9: missing imagegen provenance', self.run_check()['errors'])
        self.bind('poster_16x9', self.root/'poster_16x9.png')
        (self.root/'prompt.txt').write_text('changed prompt')
        self.assertFalse(self.run_check()['complete'])
    def test_scoped_copy_only(self):
        self.doc={'schema_version':1,'profile':'custom','required':['publishing_copy'],'scope_reason':'User requested copy only','scope_basis':{'kind':'explicit_partial_request','request':'Only update the publishing copy'},'artifacts':{'publishing_copy':self.doc['artifacts']['publishing_copy']}}
        self.assertTrue(self.run_check()['complete'])
    def test_omission_requires_actual_basis(self):
        del self.doc['artifacts']['audio'];self.doc['omissions']={'audio':{'reason':'not needed'}}
        with self.assertRaises(ValueError):self.run_check()
        self.doc['omissions']['audio']['basis']='User requested video only, no separate WAV'
        self.assertTrue(self.run_check()['complete'])
    def test_report_cannot_overwrite_manifest_or_artifact(self):
        self.run_check();original=self.manifest.read_bytes()
        self.assertEqual(main([str(self.manifest),'--output',str(self.manifest)]),2)
        self.assertEqual(self.manifest.read_bytes(),original)
        self.assertEqual(main([str(self.manifest),'--output',str(self.root/'video.txt')]),2)

    def test_revision_report_preserves_baseline_and_poster_sources(self):
        self.assertTrue(self.run_check()['complete'])
        revision = self.root / 'revision.json'
        create(self.manifest, revision, ['publishing_copy'], 'Only revise the copy')
        baseline_alias = self.root / 'baseline-link.json'
        baseline_alias.hardlink_to(self.manifest)
        inputs = [self.manifest, baseline_alias, self.root / 'prompt.txt', self.root / 'reference.png']
        before = [source.read_bytes() for source in inputs]
        for source in inputs:
            with self.subTest(source=source), redirect_stdout(io.StringIO()):
                self.assertEqual(main([str(revision), '--output', str(source)]), 2)
                self.assertEqual([path.read_bytes() for path in inputs], before)
        report = self.root / 'report.json'
        with redirect_stdout(io.StringIO()):
            self.assertEqual(main([str(revision), '--output', str(report)]), 0)
        self.assertTrue(json.loads(report.read_text())['complete'])

if __name__=='__main__':unittest.main()
