import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import json,math,tempfile,unittest,wave,array
from pathlib import Path
from check_recorded_story import check
class RecordedStoryTest(unittest.TestCase):
 def test_continuity_and_required_visual_inputs(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);rate=8000;tone=[int(8000*math.sin(i*.2)) for i in range(rate)]
   def audio(values):
    with wave.open(str(p/'a.wav'),'wb') as w:w.setparams((1,2,rate,0,'NONE',''));w.writeframes(array.array('h',values).tobytes())
   (p/'cover.png').write_bytes(b'fixture');(p/'prompt.txt').write_text('fixture')
   d={'cover':{'title':'Example','method':'imagegen','imageFile':'cover.png','promptFile':'prompt.txt'},'coverFrames':30,'videoFrames':60,'duration':3,'audioFile':'a.wav','keywords':['目标'],'captions':[{'text':'目标','en':'Goal','start':0,'end':1}]}
   def run():
    (p/'t.json').write_text(json.dumps(d));return check(p/'t.json')
   audio(tone*3);self.assertTrue(run()['complete'])
   audio(tone+[0]*(rate*2)+tone);self.assertFalse(run()['complete'])
   audio(tone*3);d['coverFrames']=0;self.assertFalse(run()['complete']);d['coverFrames']=30
   d['keywords']=['不存在'];self.assertFalse(run()['complete']);d['keywords']=['目标']
   d['duration']=2;self.assertFalse(run()['complete'])
if __name__=='__main__':unittest.main()
