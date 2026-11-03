import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import subprocess
import wave
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
                    'checks':{'pronunciation':'passed','term_fluency':'passed','voice_consistency':'passed'},
                    'unresolved_items':[],'evidence':{'path':'note.txt','sha256':digest(note)}}
            self.assertTrue(check_listening(p,audio,record,base)['record_validated'])
            audio.write_bytes(b'changed fixture');self.assertFalse(check_listening(p,audio,record,base)['record_validated'])
            record['audio_sha256']=digest(audio)
            self.assertFalse(check_listening(prepare('改稿。',{}),audio,record,base)['record_validated'])


class Production(unittest.TestCase):
    def listening_fixture(self, root):
        init(root/'project','演示','副标题','系列')
        base=root/'project'
        doc=json.loads((base/'project.json').read_text())
        narration=base/'narration.txt'
        narration.write_text('使用 CSS。\n'+narration.read_text())
        lexicon={'CSS':{'spoken':'CSS','notes':'synthetic test term'}}
        (base/'lexicon.json').write_text(json.dumps(lexicon))
        plan=prepare(narration.read_text(),lexicon)
        audio=root/'source.wav'
        with wave.open(str(audio),'wb') as w:
            w.setparams((1,2,48000,0,'NONE','not compressed'))
            w.writeframes(b'\x01\x00'*(13*48000))
        review_dir=root/'source-review';review_dir.mkdir()
        evidence=review_dir/'note.txt';evidence.write_text('Synthetic fixture; no actual listening performed.')
        record={'audio_sha256':digest(audio),'spoken_sha256':plan['spoken_sha256'],
                'method':'human_direct_playback','scope':'full_final_track','reviewer':'test fixture',
                'performed_at':'fixture','verdict':'no_unresolved_pronunciation_issue','reviewed_terms':['CSS'],
                'checks':{'pronunciation':'passed','term_fluency':'passed','voice_consistency':'passed'},
                'unresolved_items':[],'evidence':{'path':'note.txt','sha256':digest(evidence)}}
        listening=review_dir/'review.json';listening.write_text(json.dumps(record))
        return base,doc,audio,listening,record,evidence

    def test_final_carries_checked_listening_and_evidence_for_renderer(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            base,doc,audio,listening,record,evidence=self.listening_fixture(root)
            with patch('production.covers'):
                timeline=compile_project(base,doc,root/'final',audio=audio,listening=listening)
            data=json.loads(timeline.read_text())
            self.assertFalse(data['visualPreview'])
            self.assertEqual(data['audioReview'],{'pronunciation':'pronunciation.json','listening':'listening.json'})
            carried=json.loads((timeline.parent/'listening.json').read_text())
            self.assertEqual(carried['audio_sha256'],digest(timeline.parent/'audio.wav'))
            self.assertEqual(carried['evidence']['sha256'],digest(timeline.parent/carried['evidence']['path']))
            # The carried review remains independently usable after source notes move.
            evidence.unlink();listening.unlink()
            module=(Path(__file__).resolve().parents[2]/'assets/remotion/audio-review.mjs').as_uri()
            command=['node','--input-type=module','-e',
                     'import fs from "node:fs/promises";import {inspectAudioReview} from '+json.dumps(module)+';'
                     'const p=process.argv[1];console.log(JSON.stringify(await inspectAudioReview(JSON.parse(await fs.readFile(p,"utf8")),{timelinePath:p})));',str(timeline)]
            result=json.loads(subprocess.run(command,capture_output=True,text=True,check=True).stdout)
            self.assertTrue(result['recordValidated'])
            self.assertFalse(result['audioQualityAutomaticallyCertified'])
            render_cli=Path(__file__).resolve().parents[2]/'assets/remotion/render.mjs'
            audit=json.loads(subprocess.run(['node',str(render_cli),str(timeline),str(root/'checked.mp4'),'--audit-only'],
                                           capture_output=True,text=True,check=True).stdout)
            self.assertTrue(audit['audioReview']['recordValidated'])
            self.assertFalse(audit['qualityAssessed'])
            with (timeline.parent/'audio.wav').open('ab') as changed:changed.write(b'changed')
            result=json.loads(subprocess.run(command,capture_output=True,text=True,check=True).stdout)
            self.assertFalse(result['recordValidated'])

    def test_final_rejects_incomplete_or_stale_listening_before_writing(self):
        changes=[{'audio_sha256':'0'*64},{'scope':'sample'},{'reviewed_terms':[]},
                 {'checks':{}},
                 {'checks':{'pronunciation':'passed','term_fluency':'not_checked','voice_consistency':'passed'}},
                 {'checks':{'pronunciation':'passed','term_fluency':'passed','voice_consistency':'failed'}},
                 {'evidence':{'path':'missing.txt','sha256':'0'*64}}]
        for update in changes:
            with self.subTest(update=update),tempfile.TemporaryDirectory() as d:
                root=Path(d)
                base,doc,audio,listening,record,evidence=self.listening_fixture(root)
                record.update(update);listening.write_text(json.dumps(record))
                with self.assertRaises(ValueError):compile_project(base,doc,root/'final',audio=audio,listening=listening)
                self.assertFalse((root/'final').exists())

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
