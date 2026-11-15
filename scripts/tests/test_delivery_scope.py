import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hashlib,json,tempfile,unittest
from pathlib import Path
from check_delivery import check
class DeliveryScopeTest(unittest.TestCase):
 def test_full_delivery_cannot_drop_social_assets(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);f=p/'video.mp4';f.write_bytes(b'test artifact');d={'schema_version':1,'profile':'self_media_narrated','required':['video'],'artifacts':{'video':{'path':'video.mp4','sha256':hashlib.sha256(f.read_bytes()).hexdigest()}}};m=p/'delivery.json';m.write_text(json.dumps(d));r=check(m)
   self.assertFalse(r['complete'])
   for role in ['poster_16x9','poster_4x3','poster_3x4','publishing_copy']:self.assertIn(f'{role}: missing artifact',r['errors'])
 def test_custom_requires_explicit_scope_basis(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);d={'schema_version':1,'profile':'custom','required':['publishing_copy'],'scope_reason':'Only copy','artifacts':{}};m=p/'delivery.json';m.write_text(json.dumps(d))
   with self.assertRaises(ValueError):check(m)
   f=p/'copy.txt';f.write_text('Publishing copy');d['scope_basis']={'kind':'explicit_partial_request','request':'只修改发布文案'};d['artifacts']['publishing_copy']={'path':'copy.txt','sha256':hashlib.sha256(f.read_bytes()).hexdigest()};m.write_text(json.dumps(d));self.assertTrue(check(m)['complete'])
if __name__=='__main__':unittest.main()
