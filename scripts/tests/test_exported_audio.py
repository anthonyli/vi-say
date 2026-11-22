import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import array
import hashlib
import json
import math
import subprocess
import tempfile
import unittest
import wave
import imageio_ffmpeg
from contextlib import redirect_stdout
from io import StringIO
from check_delivery import check, main

class ExportedAudio(unittest.TestCase):
    def test_good_wav_cannot_hide_silent_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'public').mkdir()
            wav=p/'voice.wav'
            with wave.open(str(wav),'wb') as w:
                w.setparams((1,2,8000,0,'NONE',''))
                w.writeframes(array.array('h',[int(6000*math.sin(i*.2)) for i in range(32000)]).tobytes())
            ff=imageio_ffmpeg.get_ffmpeg_exe()
            def video(dest,seconds):
                subprocess.run([ff,'-v','error','-f','lavfi','-i','color=s=16x16:r=30',
                    '-f','lavfi','-i','anullsrc=r=8000:cl=mono','-t',str(seconds),
                    '-c:v','libx264','-c:a','aac',str(dest)],check=True,capture_output=True)
            video(p/'public/source.mp4',3);video(p/'export.mp4',4)
            timeline={'duration':4,'coverFrames':30,'cover':{'title':'Fixture'},'videoFrames':90,
                'video':'source.mp4','audioFile':'voice.wav','keywords':['目标'],
                'captions':[{'text':'目标','en':'Goal','start':0,'end':1}]}
            (p/'timeline.json').write_text(json.dumps(timeline))
            def item(f):return {'path':f.name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
            doc={'schema_version':1,'profile':'custom','required':['audio','video'],'scope_reason':'Test fixture',
                 'scope_basis':{'kind':'standalone_artifact','request':'test recording'},'recorded_story':'timeline.json',
                 'artifacts':{'audio':item(wav),'video':item(p/'export.mp4')}}
            (p/'delivery.json').write_text(json.dumps(doc))
            result=check(p/'delivery.json')
            self.assertIn('exported_audio: Narration contains no audible signal',result['errors'])
            self.assertFalse(any(x.startswith('recorded_story:') for x in result['errors']))
            for source in (p / 'timeline.json', p / 'public' / 'source.mp4'):
                with self.subTest(source=source), redirect_stdout(StringIO()):
                    original = source.read_bytes()
                    self.assertEqual(main([str(p / 'delivery.json'), '--output', str(source)]), 2)
                    self.assertEqual(source.read_bytes(), original)

if __name__=='__main__':unittest.main()
