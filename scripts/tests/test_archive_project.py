# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

from copy import deepcopy
import json
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import archive_project as archive


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name).resolve()
        self.put('outputs/demo/final.mp4', b'finished video')
        self.put('outputs/demo/copy.txt', b'publication copy')
        self.put('work/demo/qa/check.json', b'process report')
        self.put('private/models/existing.bin', b'private model')
        self.spec = {
            'schema':1,'project':'demo','date':'2026-11-05','summary':'User accepted; not yet published.',
            'sources':['work/demo','outputs/demo'],
            'files':[{'source':'outputs/demo/final.mp4','to':'video/final.mp4','kind':'video'},
                     {'source':'outputs/demo/copy.txt','to':'copy.txt','kind':'copy'}],
            'resources':[], 'discard':['work/demo/qa/**'],
            'packages':[{'to':'delivery.zip','files':['video/final.mp4','copy.txt']}],
        }

    def put(self, name, data):
        p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        return p

    def plan(self):
        return archive.make_plan(self.root,self.spec)

    def destination(self):
        return self.root/'archive'/self.spec['date']/self.spec['project']

    def test_full_lifecycle_deduplicates_rebuilds_zip_and_protects_other_projects(self):
        self.put('outputs/demo/old.mp4',b'finished video')
        self.put('work/other/unrelated.txt',b'keep another project')
        self.spec['files'].append({'source':'outputs/demo/old.mp4','to':'history/old.mp4','kind':'video'})
        plan=self.plan()
        self.assertEqual(plan['aliases'],{'history/old.mp4':'video/final.mp4'})
        self.assertFalse(self.destination().exists())
        result=archive.run_plan(self.root,plan)
        self.assertEqual(result['status'],'complete')
        self.assertEqual((self.destination()/'video/final.mp4').read_bytes(),b'finished video')
        self.assertFalse((self.destination()/'history/old.mp4').exists())
        with zipfile.ZipFile(self.destination()/'delivery.zip') as z:
            self.assertEqual(set(z.namelist()),{'video/final.mp4','copy.txt','README.md'})
            self.assertNotIn('qa/check.json',z.namelist())
        self.assertEqual(len(archive.verify_folder(self.destination())),4)
        self.assertFalse((self.root/'work/demo').exists())
        self.assertFalse((self.root/'outputs/demo').exists())
        self.assertEqual((self.root/'private/models/existing.bin').read_bytes(),b'private model')
        self.assertTrue((self.root/'work/other/unrelated.txt').exists())
        self.put('work/demo/new-task.txt',b'a new task using the old directory name')
        self.assertEqual(archive.run_plan(self.root,plan)['status'],'already_complete')
        self.assertTrue((self.root/'work/demo/new-task.txt').exists())

    def test_copy_failure_leaves_sources_and_retry_resumes(self):
        plan=self.plan()
        original=archive.copy_verified
        def fail_copy(root,row,target):
            if row['to']=='copy.txt':raise OSError('disk full')
            return original(root,row,target)
        with patch.object(archive,'copy_verified',side_effect=fail_copy):
            with self.assertRaisesRegex(OSError,'disk full'):archive.run_plan(self.root,plan)
        self.assertTrue((self.root/'outputs/demo/final.mp4').exists())
        self.assertTrue((self.root/'work/demo/qa/check.json').exists())
        self.put('.cache/archive/staging/interrupted-copy',b'partial cached bytes')
        self.assertEqual(archive.run_plan(self.root,plan)['status'],'complete')
        self.assertEqual(list((self.root/'.cache/archive/staging').iterdir()),[])

    def test_partial_cleanup_can_resume_after_verifying_archive(self):
        plan=self.plan();original=Path.unlink;failed=[False]
        def fail_once(path,*args,**kwargs):
            if path==self.root/'outputs/demo/final.mp4' and not failed[0]:
                failed[0]=True;raise OSError('interrupted cleanup')
            return original(path,*args,**kwargs)
        with patch.object(Path,'unlink',fail_once):
            with self.assertRaisesRegex(OSError,'interrupted cleanup'):archive.run_plan(self.root,plan)
        self.assertTrue((self.root/'outputs/demo/final.mp4').exists())
        self.assertEqual(archive.run_plan(self.root,plan)['status'],'complete')

    def test_new_or_changed_files_after_plan_block_any_archive_mutation(self):
        plan=self.plan();self.put('work/demo/new.wav',b'ongoing narration')
        with self.assertRaisesRegex(ValueError,'Sources changed'):archive.run_plan(self.root,plan)
        self.assertFalse(self.destination().exists())
        (self.root/'work/demo/new.wav').unlink()
        self.put('outputs/demo/final.mp4',b'changed video!')
        with self.assertRaisesRegex(ValueError,'Sources changed'):archive.run_plan(self.root,plan)
        self.assertTrue((self.root/'outputs/demo/copy.txt').exists())

    def test_change_during_copy_preserves_all_sources(self):
        plan=self.plan();original=archive.copy_verified
        def change_source(root,row,target):
            original(root,row,target)
            if row['to']=='copy.txt':self.put('work/demo/qa/new.json',b'new process result')
        with patch.object(archive,'copy_verified',side_effect=change_source):
            with self.assertRaisesRegex(ValueError,'Sources changed'):archive.run_plan(self.root,plan)
        self.assertTrue((self.root/'outputs/demo/final.mp4').exists())

    def test_new_file_during_cleanup_is_never_recursively_deleted(self):
        plan=self.plan();original=Path.unlink
        def add_file(path,*args,**kwargs):
            result=original(path,*args,**kwargs)
            if path==self.root/'work/demo/qa/check.json':
                self.put('work/demo/qa/new-task.txt',b'new task data')
            return result
        with patch.object(Path,'unlink',add_file):
            with self.assertRaises(OSError):archive.run_plan(self.root,plan)
        self.assertEqual((self.root/'work/demo/qa/new-task.txt').read_bytes(),b'new task data')
        self.assertEqual((self.destination()/'video/final.mp4').read_bytes(),b'finished video')
        with self.assertRaisesRegex(ValueError,'new files appeared'):archive.run_plan(self.root,plan)

    def test_resource_tamper_after_copy_blocks_source_cleanup(self):
        self.put('work/demo/reference.wav',b'authorized reference')
        self.spec['resources']=[{'source':'work/demo/reference.wav','to':'private/voice/demo/reference.wav'}]
        plan=self.plan();original=archive.build_package
        def change_resource(*args):
            original(*args)
            self.put('private/voice/demo/reference.wav',b'changed resource')
        with patch.object(archive,'build_package',side_effect=change_resource):
            with self.assertRaisesRegex(ValueError,'Preserved resource changed'):archive.run_plan(self.root,plan)
        self.assertTrue((self.root/'work/demo/reference.wav').exists())
        self.assertTrue((self.root/'outputs/demo/final.mp4').exists())

    def test_archive_tamper_blocks_cleanup_retry(self):
        plan=self.plan()
        with patch.object(Path,'rmdir',side_effect=OSError('pause cleanup')):
            with self.assertRaises(OSError):archive.run_plan(self.root,plan)
        (self.destination()/'video/final.mp4').write_bytes(b'tampered archive')
        with self.assertRaisesRegex(ValueError,'hash mismatch'):archive.run_plan(self.root,plan)

    def test_unknown_files_require_explicit_classification(self):
        self.put('outputs/demo/extra.wav',b'do not silently lose this')
        with self.assertRaisesRegex(ValueError,'Unclassified'):self.plan()

    def test_reusable_font_requires_preservation_even_under_broad_discard(self):
        self.put('work/demo/font.otf',b'reusable font')
        self.spec['discard']=['work/demo/**']
        with self.assertRaisesRegex(ValueError,'reusable resource'):self.plan()
        self.spec['resources']=[{'source':'work/demo/font.otf','to':'.cache/fonts/demo.otf'}]
        archive.run_plan(self.root,self.plan())
        self.assertEqual((self.root/'.cache/fonts/demo.otf').read_bytes(),b'reusable font')

    def test_reusable_resource_collision_does_not_overwrite(self):
        self.put('work/demo/reference.wav',b'new reference')
        target=self.put('private/voice/demo/reference.wav',b'existing reference')
        self.spec['resources']=[{'source':'work/demo/reference.wav','to':'private/voice/demo/reference.wav'}]
        with self.assertRaisesRegex(ValueError,'resource target differs'):self.plan()
        self.assertEqual(target.read_bytes(),b'existing reference')

    def test_existing_archive_is_never_merged_or_overwritten(self):
        plan=self.plan();self.destination().mkdir(parents=True)
        note=self.destination()/'old.txt';note.write_text('existing archive')
        with self.assertRaisesRegex(ValueError,'Destination already exists'):archive.run_plan(self.root,plan)
        self.assertEqual(note.read_text(),'existing archive')
        self.assertTrue((self.root/'outputs/demo/final.mp4').exists())

    def test_selected_zip_member_survives_without_process_files(self):
        path=self.root/'outputs/demo/old.zip'
        with zipfile.ZipFile(path,'w') as z:
            z.writestr('episode/final.wav',b'final audio')
            z.writestr('episode/check.json',b'old process log')
        self.spec['files'].append({'source':'outputs/demo/old.zip','member':'episode/final.wav',
                                   'to':'audio.wav','kind':'audio'})
        self.spec['packages'][0]['files'].append('audio.wav')
        archive.run_plan(self.root,self.plan())
        self.assertEqual((self.destination()/'audio.wav').read_bytes(),b'final audio')
        with zipfile.ZipFile(self.destination()/'delivery.zip') as z:
            self.assertNotIn('episode/check.json',z.namelist())

    def test_zip_traversal_and_zip_symlink_are_rejected(self):
        path=self.root/'outputs/demo/old.zip'
        with zipfile.ZipFile(path,'w') as z:
            z.writestr('../outside.wav',b'bad path')
            entry=zipfile.ZipInfo('reference.wav');entry.create_system=3
            entry.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(entry,'/outside')
        for member in ['../outside.wav','reference.wav']:
            self.spec['files']=self.spec['files'][:2]+[{'source':'outputs/demo/old.zip','member':member,'to':'audio.wav','kind':'audio'}]
            with self.subTest(member=member),self.assertRaises(ValueError):self.plan()

    def test_private_root_cleanup_symlink_and_traversal_are_rejected(self):
        for source in ['private/voice','work','outputs','work/demo/../other','archive/2026-11-05']:
            spec=deepcopy(self.spec);spec['sources']=[source]
            with self.subTest(source=source),self.assertRaises(ValueError):archive.make_plan(self.root,spec)
        self.put('outside.mp4',b'outside')
        (self.root/'outputs/demo/final.mp4').unlink()
        (self.root/'outputs/demo/final.mp4').symlink_to(self.root/'outside.mp4')
        with self.assertRaisesRegex(ValueError,'Symlink'):self.plan()

    def test_edited_plan_is_rejected_before_deleting_sources(self):
        plan=self.plan();plan['files']=[]
        with self.assertRaisesRegex(ValueError,'Plan changed'):archive.run_plan(self.root,plan)
        self.assertTrue((self.root/'outputs/demo/final.mp4').exists())

    def test_unknown_historical_date_is_supported(self):
        self.spec['date']='日期待核对'
        result=archive.run_plan(self.root,self.plan())
        self.assertIn('archive/日期待核对/demo',result['archive'])

    def test_cli_plan_and_production_entry_are_executable(self):
        script=Path(archive.__file__)
        subprocess.run([sys.executable,str(script),'--root',str(self.root),'init','demo',
                        '--output','.cache/archive/draft.json'],check=True,capture_output=True)
        draft=json.loads((self.root/'.cache/archive/draft.json').read_text())
        self.assertIn('work/demo/qa/check.json',draft['_inventory'])
        (self.root/'.cache/archive/draft.json').write_text(json.dumps(self.spec))
        production=script.with_name('production.py')
        result=subprocess.run([sys.executable,str(production),'archive','--root',str(self.root),'plan',
                               '.cache/archive/draft.json','--output','.cache/archive/plan.json'],check=True,capture_output=True,text=True)
        self.assertEqual(json.loads(result.stdout)['archive'],'archive/2026-11-05/demo')
        subprocess.run([sys.executable,str(script),'--root',str(self.root),'run','.cache/archive/plan.json'],check=True,capture_output=True)
        verified=subprocess.run([sys.executable,str(script),'--root',str(self.root),'verify','archive/2026-11-05/demo'],check=True,capture_output=True,text=True)
        self.assertTrue(json.loads(verified.stdout)['valid'])


if __name__ == '__main__':
    unittest.main()
