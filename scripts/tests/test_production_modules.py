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
            self.assertEqual(result['cartoonScenes'],doc['scenes'])
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
