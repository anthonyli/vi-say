import hashlib
import tempfile
import unittest
import wave
from array import array
from pathlib import Path
from scripts.audit_speech_pauses import audit, repair_selected_pauses

class PauseTests(unittest.TestCase):
    def test_selected_silence_preserves_speech(self):
        with tempfile.TemporaryDirectory() as folder:
            src=Path(folder)/'source.wav';dst=Path(folder)/'fixed.wav'
            samples=array('h',[3000]*1000+[0]*800+[3000]*1000)
            with wave.open(str(src),'wb') as w:
                w.setnchannels(1);w.setsampwidth(2);w.setframerate(1000);w.writeframes(samples.tobytes())
            r=audit(src,[1.4]);self.assertEqual(len(r['pauses']),1)
            self.assertTrue(r['pauses'][0]['near_segment_join'])
            m=repair_selected_pauses(src,dst,r,[dict(index=0,keep_seconds=.3,reason='test gap')])
            self.assertAlmostEqual(m['output_duration'],2.3)
            with wave.open(str(dst)) as w:actual=array('h',w.readframes(w.getnframes()))
            self.assertEqual(actual,array('h',[3000]*1000+[0]*300+[3000]*1000))
            with self.assertRaises(ValueError):repair_selected_pauses(src,dst,r,[])
            r['audio_sha256']='stale'
            with self.assertRaises(ValueError):repair_selected_pauses(src,Path(folder)/'bad.wav',r,[])

if __name__=='__main__':unittest.main()
