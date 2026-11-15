import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hashlib
import json
import tempfile
import unittest
from check_delivery import check
from revise_delivery import create

class RevisionDelivery(unittest.TestCase):
    def test_poster_revision_locks_video_even_if_new_hash_is_registered(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            artifacts = {}
            for role in ('video', 'poster'):
                p = root / role
                p.write_text(role)
                artifacts[role] = {'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
            doc = {'schema_version': 1, 'profile': 'custom', 'required': ['video', 'poster'],
                   'scope_reason': 'Fixture', 'scope_basis': {'kind': 'standalone_artifact', 'request': 'fixture'},
                   'artifacts': artifacts}
            base, revised = root/'baseline.json', root/'revision.json'
            base.write_text(json.dumps(doc))
            create(base, revised, ['poster'], '只改发布海报')
            self.assertTrue(check(revised)['complete'])
            with self.assertRaises(FileExistsError):
                create(base, revised, ['poster'], 'Only poster')
            change = json.loads(revised.read_text())
            (root/'video').write_text('wrong inserted poster')
            change['artifacts']['video']['sha256'] = hashlib.sha256((root/'video').read_bytes()).hexdigest()
            revised.write_text(json.dumps(change))
            self.assertIn('Revision changed protected artifact: video', check(revised)['errors'])
            base.write_text('{}')
            self.assertIn('Revision baseline changed', check(revised)['errors'])

    def test_missing_baseline_fails(self):
        from revise_delivery import main
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'missing.json'
            with self.assertRaises(SystemExit):main([str(p),str(p),'--change','video','--request','fixture'])

if __name__ == '__main__': unittest.main()
