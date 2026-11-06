# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from production import init, compile_project


class ProductionModules(unittest.TestCase):
    def test_regular_project_compiles_scene_choices_without_changing_the_workflow(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);init(root/'project','原有流程','自动使用 GL','系列')
            base=root/'project';doc=json.loads((base/'project.json').read_text())
            with patch('production.covers'):
                timeline=compile_project(base,doc,root/'compiled',preview=True)
            result=json.loads(timeline.read_text())
            self.assertIn(result['cartoonScenes'][1]['transitionSelection']['source'],['scene','rotation'])
            self.assertEqual([(s['start'],s['end']) for s in result['cartoonScenes']],[(s['start'],s['end']) for s in doc['scenes']])
            self.assertNotIn('transition',doc['scenes'][1])
            renderer=Path(__file__).resolve().parents[2]/'assets/remotion/render.mjs'
            audit=json.loads(subprocess.run(['node',str(renderer),str(timeline),str(root/'unused.mp4'),'--audit-only'],capture_output=True,text=True,check=True).stdout)
            self.assertEqual(audit['transitions'][0]['selection'],result['cartoonScenes'][1]['transitionSelection'])
            self.assertEqual(audit['transitions'][0]['kind'],result['cartoonScenes'][1]['transition'])

    def test_transition_template_stages_both_media_sources_and_covers_35_canonical_effects(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);init(root/'project','转场目录','实际 shader','系列','studio','transitions')
            base=root/'project';doc=json.loads((base/'project.json').read_text())
            with patch('production.covers'):
                timeline=compile_project(base,doc,root/'compiled',preview=True)
            result=json.loads(timeline.read_text())
            cuts=[s['transition'] for s in result['cartoonScenes'][1:]]
            self.assertEqual(len(set(cuts)),35)
            self.assertEqual(sum(c.startswith('gl:') for c in cuts),30)
            for original,staged in zip(doc['scenes'],result['cartoonScenes']):
                self.assertEqual((base/original['image']).read_bytes(),(timeline.parent/staged['image']).read_bytes())
            self.assertEqual(result['duration'],72)

    def test_all_effects_rotate_automatically_through_compile_and_project_seed_is_honored(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);init(root/'project','场景选择','自动轮换','系列','studio','transitions')
            base=root/'project';doc=json.loads((base/'project.json').read_text())
            for scene in doc['scenes']:
                scene.pop('transition',None)
                scene['title']='阅读报告'
            choices=[]
            for seed in ['seed-a','seed-b']:
                doc['transitionSeed']=seed
                with patch('production.covers'):
                    timeline=compile_project(base,doc,root/seed,preview=True)
                result=json.loads(timeline.read_text())
                self.assertEqual(result['transitionSeed'],seed)
                cuts=result['cartoonScenes'][1:]
                self.assertEqual(len(set(s['transition'] for s in cuts)),35)
                self.assertEqual(cuts[0]['transitionSelection']['intent'],'document')
                self.assertTrue(all(s['transitionSelection']['cycle']==1 for s in cuts))
                choices.append([s['transition'] for s in cuts])
            self.assertNotEqual(*choices)

    def test_selected_modules_and_caption_input_survive_the_real_compile_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            init(root/'project', '模块演示', '可选择效果', '示例系列', 'glass', 'effects')
            base=root/'project';doc=json.loads((base/'project.json').read_text())
            # Exercise the same captions-file input produced by alignment tools.
            captions=doc['captions'];(base/'captions.json').write_text(json.dumps({'captions':captions}))
            doc['captions']='captions.json'
            with patch('production.covers'):
                timeline=compile_project(base,doc,root/'compiled',preview=True)
            result=json.loads(timeline.read_text())
            self.assertEqual(result['modules']['background'],'glass')
            self.assertEqual(result['captions'],captions)
            self.assertEqual(result['cartoonScenes'][3]['effects'][0]['type'],'flow')
            self.assertEqual(result['duration'],29)
            self.assertTrue(result['visualPreview'])
            for name in ['characterClosed','characterNeutral','fontFile']:
                self.assertTrue((timeline.parent/result[name]).is_file())
            media=result['cartoonScenes'][5]
            self.assertEqual(media['mediaSize'],[1440,900])
            self.assertEqual((timeline.parent/media['image']).read_bytes(),(base/'board.svg').read_bytes())
            renderer=Path(__file__).resolve().parents[2]/'assets/remotion/render.mjs'
            audited=json.loads(subprocess.run(['node',str(renderer),str(timeline),str(root/'unused.mp4'),'--audit-only'],capture_output=True,text=True,check=True).stdout)
            self.assertTrue(audited['valid'])
            self.assertEqual(audited['audioReview']['status'],'silent_visual_preview')
            self.assertGreater(len(audited['stillPoints']),30)

    def test_classic_and_glass_presets_are_explicit_and_independent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            init(root/'classic','原风格','可继续选择','系列','classic')
            init(root/'glass','玻璃风','可独立换造型','系列')
            classic=json.loads((root/'classic/project.json').read_text())
            glass=json.loads((root/'glass/project.json').read_text())
            self.assertEqual(classic['modules']['character']['mode'],'legacy')
            self.assertEqual(glass['modules']['character']['mode'],'rounded')
            self.assertNotIn('effects',classic['scenes'][0])
            self.assertEqual(glass['scenes'][0]['effects'][0]['variant'],'hexagon')
            self.assertTrue((root/'glass/narration.txt').read_text().startswith('大家好，我是小龙'))

    def test_studio_business_template_compiles_without_character_or_episode_assets(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);init(root/'project','产品演示','通用动效','演示系列','studio','business')
            base=root/'project';doc=json.loads((base/'project.json').read_text())
            self.assertNotIn('我是小龙',(base/'narration.txt').read_text())
            with patch('production.covers'):
                timeline=compile_project(base,doc,root/'compiled',preview=True)
            result=json.loads(timeline.read_text())
            self.assertEqual(result['modules']['background'],'studio')
            self.assertEqual(result['modules']['character']['mode'],'none')
            self.assertEqual(result['duration'],45)
            content=lambda scenes:[{k:v for k,v in s.items() if k not in ['transition','transitionAlias','transitionParams']} for s in scenes]
            self.assertEqual(content(result['cartoonScenes']),content(doc['scenes']))
            self.assertEqual([s['transition'] for s in result['cartoonScenes'][1:]],['gl:CrossZoom','slide','gl:CrossZoom','flip','flip','gl:CrossZoom','radial','converge'])
            catalog=json.loads(subprocess.run([sys.executable,str(Path(__file__).resolve().parents[1]/'production.py'),'catalog','--json'],check=True,text=True,capture_output=True).stdout)
            self.assertIn('business',[t['name'] for t in catalog['templates']])
            self.assertIn('network',[e['type'] for e in catalog['effects']])

    def test_unknown_effect_is_rejected_before_reserving_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);init(root/'project','演示','参数检查','系列')
            doc=json.loads((root/'project/project.json').read_text())
            doc['scenes'][0]['effects'][0]['type']='not-implemented'
            with self.assertRaises(subprocess.CalledProcessError),patch('production.covers'):
                compile_project(root/'project',doc,root/'bad',preview=True)
            self.assertFalse((root/'bad').exists())


if __name__=='__main__':unittest.main()
