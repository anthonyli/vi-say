import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from pronunciation import prepare, check_listening, digest
from production_design import STYLE, font_path, poster, fit_text
from production import init, compile_project, package_skill


class Pronunciation(unittest.TestCase):
    def test_longest_terms_and_no_partial_brand_replacement(self):
        p=prepare('PageOn、Page 和 MAIL 用 AI。',{'PageOn':{'spoken':'PageOn'},'Page':{'spoken':'Page'},'AI':{'spoken':'AI'}})
        self.assertEqual([r['term'] for r in p['terms']],['PageOn','Page','AI'])
        self.assertEqual(p['unresolved_terms'],['MAIL'])
        self.assertIn('MAIL',p['spoken_text'])

    def test_numbers_and_unknown_brands_block(self):
        self.assertFalse(prepare('速度1.5倍，打开Qwen。',{})['ready_for_synthesis'])
        p=prepare('速度1.5倍。',{'1.5倍':{'spoken':'一点五倍'}})
        self.assertTrue(p['ready_for_synthesis']);self.assertEqual(p['spoken_text'],'速度一点五倍。')

    def test_stale_audio_and_script_cannot_reuse_listening(self):
        with tempfile.TemporaryDirectory() as d:
            base=Path(d);audio=base/'audio.wav';audio.write_bytes(b'synthetic audio fixture')
            note=base/'note.txt';note.write_text('synthetic evidence; not actual listening')
            p=prepare('中文。',{})
            record={'audio_sha256':digest(audio),'spoken_sha256':p['spoken_sha256'],
                    'method':'human_direct_playback','scope':'full_final_track','reviewer':'fixture',
                    'performed_at':'fixture','verdict':'no_unresolved_pronunciation_issue','reviewed_terms':[],
                    'unresolved_items':[],'evidence':{'path':'note.txt','sha256':digest(note)}}
            self.assertTrue(check_listening(p,audio,record,base)['record_validated'])
            audio.write_bytes(b'changed fixture');self.assertFalse(check_listening(p,audio,record,base)['record_validated'])
            record['audio_sha256']=digest(audio)
            self.assertFalse(check_listening(prepare('改稿。',{}),audio,record,base)['record_validated'])


class Production(unittest.TestCase):
    def test_three_actual_covers_have_independent_bounds(self):
        f=font_path()
        for aspect,size in STYLE['covers'].items():
            im,info=poster('让好想法动起来','有角色、有节奏、有色彩','小龙创作课',aspect,f)
            self.assertEqual(im.size,tuple(size))
            for block in info['text']:
                x,y,w,h=block['box'];self.assertLessEqual(x+w,size[0]);self.assertLessEqual(y+h,size[1])
            x,y,w,h=info['character_box'];self.assertGreaterEqual(x,0);self.assertGreaterEqual(y,0)
            self.assertLessEqual(x+w,size[0]);self.assertLessEqual(y+h,size[1])

    def test_long_title_rejected_instead_of_unreadable_shrink(self):
        with self.assertRaises(ValueError):
            poster('很长的标题'*40,'副标题','系列','3:4',font_path())

    def test_preview_is_marked_and_final_needs_audio(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);init(p/'project','演示','副标题','系列')
            doc=json.loads((p/'project/project.json').read_text())
            with self.assertRaises(ValueError):compile_project(p/'project',doc,p/'bad')
            timeline=compile_project(p/'project',doc,p/'preview',preview=True)
            data=json.loads(timeline.read_text());self.assertTrue(data['visualPreview'])
            self.assertTrue((p/'preview/audio.wav').is_file())
            with self.assertRaises(FileExistsError):compile_project(p/'project',doc,p/'preview',preview=True)

    def test_pack_excludes_runtime_and_developer_artifacts(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'skill.zip';package_skill(p)
            with zipfile.ZipFile(p) as z:
                names=z.namelist()
                self.assertIn('vi-say/assets/production/dragon.png',names)
                self.assertIn('vi-say/assets/remotion/package-lock.json',names)
                self.assertEqual({Path(n).parts[0] for n in names},{'vi-say'})
                self.assertIn('name: vi-say',z.read('vi-say/SKILL.md').decode())
                self.assertEqual(z.read('vi-say/LICENSE'),(Path(__file__).resolve().parents[2]/'LICENSE').read_bytes())
                self.assertIn('vi-say/references/workflow.md',names)
                self.assertIn('vi-say/references/extensions.md',names)
                self.assertIn('vi-say/assets/remotion/cartoon-transitions.mjs',names)
                self.assertFalse(any('/tests/' in n or '/.cache/' in n or '/node_modules/' in n or '/validation/' in n for n in names))


if __name__=='__main__':unittest.main()
