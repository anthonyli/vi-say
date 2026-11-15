import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import array
import math
import tempfile
import unittest
import wave
from check_recorded_story import audio_gaps

class AudioEdges(unittest.TestCase):
    def test_leading_trailing_and_missing_tail(self):
        rate=8000
        tone=[int(6000*math.sin(i*.2)) for i in range(rate)]
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'a.wav'
            def write(values):
                with wave.open(str(p),'wb') as w:
                    w.setparams((1,2,rate,0,'NONE',''));w.writeframes(array.array('h',values).tobytes())
            write([0]*rate*2+tone)
            self.assertEqual(audio_gaps(p,3)[0],[[0.0,2.0]])
            write(tone+[0]*rate*2)
            self.assertEqual(audio_gaps(p,3)[0],[[1.0,3.0]])
            write(tone)
            self.assertEqual(audio_gaps(p,3)[0],[[1.0,3.0]])
            write(tone*3)
            self.assertEqual(audio_gaps(p,3)[0],[])

if __name__ == '__main__':unittest.main()
