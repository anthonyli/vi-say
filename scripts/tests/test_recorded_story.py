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

class SilentDemoTests(unittest.TestCase):
 def test_intentional_demo_keeps_silence_but_cannot_hide_missing_audio(self):
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp); rate=8000
   tone=[int(8000*math.sin(i*.2)) for i in range(rate)]
   doc={'cover':{'title':'Example'}, 'coverFrames':30, 'videoFrames':90,
        'duration':4, 'audioFile':'a.wav', 'keywords':['演示'],
        'captions':[{'text':'看演示','en':'Watch the demo','start':0,'end':1}],
        'silentWindows':[{'start':1,'end':4,'kind':'demo','reason':'等待保存完成并查看结果',
                          'user_request':'测试明确要求：此演示保留静默'}]}
   def run(values):
    with wave.open(str(p/'a.wav'),'wb') as wav:
     wav.setparams((1,2,rate,0,'NONE','')); wav.writeframes(array.array('h',values).tobytes())
    (p/'t.json').write_text(json.dumps(doc))
    return check(p/'t.json')
   result=run(tone+[0]*rate*3)
   self.assertTrue(result['complete'], result['errors'])
   self.assertFalse(result['listening_assessed'])
   self.assertEqual(result['intentional_silence'],doc['silentWindows'])
   # Exercise the media check used by render-recorded.mjs, not just declared timing.
   import subprocess
   from audio_timing import ffmpeg
   (p/'public').mkdir()
   subprocess.run([ffmpeg(), '-v', 'error', '-f', 'lavfi', '-i',
                   'testsrc2=s=64x64:r=30:d=3', '-c:v', 'libx264',
                   str(p/'public'/'demo.mp4')], check=True)
   doc['video']='demo.mp4'
   (p/'t.json').write_text(json.dumps(doc))
   verified=check(p/'t.json',verify_video=True)
   self.assertTrue(verified['complete'],verified['errors'])
   self.assertTrue(verified['source_media_checked'])
   doc['videoFrames']=91
   (p/'t.json').write_text(json.dumps(doc))
   self.assertFalse(check(p/'t.json',verify_video=True)['complete'])
   doc['videoFrames']=90
   result=run(tone)
   self.assertIn('Audio file ends before', ' '.join(result['errors']))
   doc['silentWindows'][0].pop('user_request')
   with self.assertRaisesRegex(ValueError,'request to retain silence'):
    run(tone+[0]*rate*3)
   doc['silentWindows']=[]
   self.assertIn('silence exceeds', ' '.join(run(tone+[0]*rate*3)['errors']))

 def test_demo_windows_must_reference_continuous_footage(self):
  from check_recorded_story import validate_silent_windows
  doc={'duration':5,'coverFrames':30,'videoFrames':90}
  for windows in (
      [{'start':0,'end':2,'kind':'demo','reason':'not source footage'}],
      [{'start':3,'end':5,'kind':'demo','reason':'past source footage'}],
      [{'start':1,'end':3,'kind':'demo'}],
      [{'start':1,'end':3,'kind':'demo','reason':'demo'},
       {'start':2,'end':4,'kind':'demo','reason':'overlap'}],
      [{'start':1,'end':float('nan'),'kind':'demo','reason':'invalid'}],
      [{'start':1,'end':3,'reason':'unspecified purpose'}]):
   for window in windows:
    if window.get('kind') == 'demo':
     window['user_request']='测试明确要求：保留静默'
   with self.subTest(windows=windows),self.assertRaises(ValueError):
    validate_silent_windows({**doc,'silentWindows':windows})
  legacy=[{'start':0,'end':1,'user_request':'保留开场静默'}]
  self.assertEqual(validate_silent_windows({**doc,'silentWindows':legacy}),legacy)

if __name__=='__main__':unittest.main()
