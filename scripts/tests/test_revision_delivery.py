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
    def test_review_promotion_adds_social_assets_and_protects_delivered_files(self):
        from check_delivery import SELF_MEDIA
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            review = root / 'review.json'
            release = root / 'release' / 'delivery.json'
            for name in ('film.mp4', 'sources.md'):
                (root / name).write_text(name)
            artifacts = {role: {'path': name, 'sha256': hashlib.sha256(name.encode()).hexdigest()}
                         for role, name in [('video', 'film.mp4'), ('sources', 'sources.md')]}
            review.write_text(json.dumps({'schema_version': 1, 'profile': 'custom',
                'required': ['video', 'sources', 'poster_4x3'], 'artifacts': artifacts,
                'scope_basis': {'kind': 'standalone_artifact', 'request': '仅前审'},
                'scope_reason': 'HTML 前审', 'omissions': {
                    'poster_4x3': {'reason': '前审暂缓', 'basis': '海报在正式发布阶段制作'}}}))
            original = review.read_bytes()
            create(review, release, [], '确认，生成正式发布包', promote=True)
            result = json.loads(release.read_text())
            self.assertEqual(review.read_bytes(), original)
            self.assertEqual(result['profile'], 'self_media_narrated')
            self.assertEqual(set(result['required']), set(SELF_MEDIA) | {'sources'})
            self.assertEqual(result['artifacts']['video']['path'], str((root / 'film.mp4').resolve()))
            self.assertFalse(result['omissions'])
            missing = set(check(release)['errors'])
            self.assertEqual(missing, {f'{role}: missing artifact' for role in SELF_MEDIA if role != 'video'})
            result['artifacts']['video'] = result['artifacts']['sources']
            release.write_text(json.dumps(result))
            self.assertIn('Revision changed protected artifact: video', check(release)['errors'])
            with self.assertRaises(FileExistsError):
                create(review, release, [], '重试', promote=True)

    def test_promotion_accepts_pending_roles_and_requires_proxy_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proxy = root / 'review.webm'
            proxy.write_bytes(b'preview')
            before = root / 'review.json'
            after = root / 'release.json'
            before.write_text(json.dumps({'schema_version': 1, 'profile': 'self_media_narrated',
                'artifacts': {'video': {'path': proxy.name, 'sha256': hashlib.sha256(b'preview').hexdigest()},
                              'script': {'path': '', 'sha256': ''}}}))
            create(before, after, [], '生成正式视频', promote=True)
            self.assertIn('video: missing artifact', check(after)['errors'])
            doc = json.loads(after.read_text())
            self.assertEqual(doc['artifacts']['script']['path'], '')
            doc['profile'] = 'custom'
            doc['required'] = ['video']
            doc['scope_basis'] = {'kind': 'standalone_artifact', 'request': 'fixture'}
            doc['scope_reason'] = 'fixture'
            after.write_text(json.dumps(doc))
            self.assertIn('Promoted delivery must retain the full release scope', check(after)['errors'])
            proxy.write_bytes(b'changed after review')
            with self.assertRaisesRegex(ValueError, 'Baseline'):
                create(before, root / 'invalid.json', [], '生成正式视频', promote=True)

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
