import sys,tempfile,wave,unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from speech_motion import analyze
from production import outro_scene

class SpeechMotion(unittest.TestCase):
    def test_silence_closes_mouth_and_energy_drives_it_without_randomness(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'test.wav';sr=24000;t=np.arange(sr)/sr
            a=np.concatenate([np.zeros(sr),.3*np.sin(2*np.pi*180*t),np.zeros(sr)])
            with wave.open(str(p),'wb') as w:w.setparams((1,2,sr,0,'NONE','not compressed'));w.writeframes((a*32767).astype('<i2').tobytes())
            m=analyze(p);self.assertEqual(m,analyze(p));self.assertEqual(len(m['values']),90)
            self.assertEqual(max(m['values'][:30]),0);self.assertGreater(max(m['values'][30:60]),.9);self.assertEqual(m['values'][-1],0)
    def test_outro_uses_absolute_measured_word_anchors(self):
        s=outro_scene(20,26,{'留言':21,'关注':22.5,'点赞':24})
        self.assertEqual([i['text'] for i in s['items']],['留言','关注','点赞'])
        self.assertEqual([i['at'] for i in s['items']],[1,2.5,4])
        with self.assertRaises(ValueError):outro_scene(20,26,{'留言':21})
if __name__=='__main__':unittest.main()
