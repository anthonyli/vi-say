# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audio_timing import ffmpeg
from check_recorded_edit import check, validate_plan
from render_captions import ass_text, srt_text
from revise_delivery import digest


class RecordedEditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plan = self.root/'plan.json'
        self.video = self.root/'video.mp4'
        self.srt = self.root/'captions.srt'
        self.doc = {
            'schema_version': 1, 'fps': 30, 'duration': 10,
            'keywords': ['预览'], 'keywordsEn': ['preview'],
            'captions': [
                {'start': .1, 'end': 1, 'text': '先看预览', 'en': 'First, watch the preview.'},
                {'start': 3.2, 'end': 4, 'text': '今天分享就到这里', 'en': "That's all for today."},
                {'start': 5, 'end': 6, 'text': '有想法 欢迎留言', 'en': 'Leave a comment.'},
                {'start': 6, 'end': 7, 'text': '想看更多 记得关注', 'en': 'Follow for more.'},
                {'start': 7, 'end': 8, 'text': '觉得有用 记得点赞', 'en': 'Give it a like.'},
                {'start': 8, 'end': 9, 'text': '我们下期见', 'en': 'See you next time.'},
            ],
            'playback': [{'start': 1.4, 'end': 3.0, 'intro': {'start': .1, 'end': 1},
                          'embedded_captions': True}],
            'outro': {'template': 'community-outro-v1', 'closing': {'start': 3.2, 'end': 4},
                      'transition': {'start': 4.2, 'end': 4.9, 'name': 'gl:GridFlip'},
                      'narration': {'start': 5, 'end': 9},
                      'actions': [{'anchor': '留言', 'at': 5.5}, {'anchor': '关注', 'at': 6.5},
                                  {'anchor': '点赞', 'at': 7.5}]},
        }

    def write_plan(self):
        self.plan.write_text(json.dumps(self.doc, ensure_ascii=False))
        cues, _ = validate_plan(self.doc)
        self.srt.write_text(srt_text(cues))

    def encode(self, video_duration=10, quiet=False):
        args = [ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i',
                f'color=c=blue:s=64x64:r=30:d={video_duration}', '-f', 'lavfi', '-i', 'sine=d=10:r=48000:f=330']
        if quiet:
            args += ['-af', "volume=0:enable='gte(t,5)'"]
        subprocess.run([*args, '-c:v', 'libx264', '-c:a', 'aac', str(self.video)], check=True)

    def test_bilingual_caption_generation_highlights_both_lines(self):
        cues, _ = validate_plan(self.doc)
        srt = srt_text(cues)
        self.assertIn('先看预览\nFirst, watch the preview.', srt)
        ass = ass_text(cues)
        self.assertIn(r'{\1c&H8CE1FF&}预览', ass)
        self.assertIn(r'{\1c&H8CE1FF&}preview', ass)

    def test_wrong_timing_and_incomplete_outro_are_rejected(self):
        mutations = [
            (lambda d: d['captions'][0].pop('en'), 'one English line'),
            (lambda d: d['playback'][0].pop('intro'), 'intro.start'),
            (lambda d: d['playback'][0].update(start=.8), 'before playback'),
            (lambda d: d['playback'][0].update(end=3.7), 'embedded captions'),
            (lambda d: d['outro']['transition'].update(start=3.8), 'closing line before'),
            (lambda d: d['outro']['transition'].update(name='hard cut'), 'implemented GL'),
            (lambda d: d['outro'].update(actions=d['outro']['actions'][1:]), 'template order'),
            (lambda d: d['captions'].pop(), 'complete fixed narration'),
        ]
        for mutate, message in mutations:
            changed = copy.deepcopy(self.doc)
            mutate(changed)
            with self.subTest(message), self.assertRaisesRegex(ValueError, message):
                validate_plan(changed)

    def test_real_export_and_duplicate_srt_check(self):
        self.write_plan()
        self.encode()
        self.assertTrue(check(self.plan, self.video, self.srt)['complete'])
        self.srt.write_text('wrong cue')
        self.assertIn('Delivered SRT differs', ' '.join(check(self.plan, self.video, self.srt)['errors']))

    def test_audio_tail_cannot_hide_missing_video_frames(self):
        self.write_plan()
        self.encode(video_duration=6)
        self.assertIn('frame count differs', ' '.join(check(self.plan, self.video, self.srt)['errors']))

    def test_silent_outro_is_rejected_even_with_captions_and_audio_track(self):
        self.write_plan()
        self.encode(quiet=True)
        self.assertIn('no audible signal in outro', ' '.join(check(self.plan, self.video, self.srt)['errors']))

    def test_current_source_voice_requires_real_pcm_and_matching_generation(self):
        self.encode()
        reference = self.root/'voice.wav'
        report = self.root/'voice.generation.json'
        subprocess.run([ffmpeg(), '-v', 'error', '-ss', '2.0', '-i', str(self.video), '-map', '0:a:0',
                        '-t', '1.0', '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', str(reference)],
                       check=True)
        report.write_text(json.dumps({'voice_identity': {'reference_audio_sha256': digest(reference)}}))
        self.doc['voice'] = {'mode':'current_recording', 'reference_audio':reference.name,
                             'generation_reports':[report.name],
                             'excerpt':{'source':self.video.name,'start':2.,'end':3.}}
        self.write_plan()
        self.assertTrue(check(self.plan)['complete'])
        self.doc['voice']['excerpt']['start'] = 1.
        self.write_plan()
        with self.assertRaisesRegex(ValueError, 'current-recording excerpt'):
            check(self.plan)


class RecordingMasterTests(unittest.TestCase):
    def test_short_cuts_keep_frame_count_and_exact_pcm(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, edl, out = root/'source.mp4', root/'edit.json', root/'result'
            subprocess.run([ffmpeg(), '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=80x64:r=29.97:d=3',
                            '-f', 'lavfi', '-i', 'sine=d=3:r=44100:f=290',
                            '-c:v', 'libx264', '-c:a', 'aac', str(source)], check=True)
            data = {'source': source.name, 'fps': 30,
                    'filler_cuts': [{'in': .4, 'out': .6, 'text': '然后'}],
                    'segments': [{'in': 0, 'out': .4}, {'in': .6, 'out': .8},
                                 {'in': 1.2, 'out': 2, 'speed': 1.12}]}
            edl.write_text(json.dumps(data))
            entry = Path(__file__).resolve().parents[1]/'prepare_recording.py'
            command = [sys.executable, str(entry), str(edl), '--output-dir']
            subprocess.run([*command, str(out)], check=True, capture_output=True)
            details = json.loads((out/'edit-map.json').read_text())
            self.assertEqual(sum(x['frames'] for x in details['segments']), 39)
            with wave.open(str(out/'narration.wav'), 'rb') as audio:
                self.assertEqual(audio.getnframes(), 39 * 1600)
            data['segments'][0]['out'] = .5
            edl.write_text(json.dumps(data))
            failure = subprocess.run([*command, str(root/'rejected')], capture_output=True, text=True)
            self.assertNotEqual(failure.returncode, 0)
            self.assertIn('overlaps reviewed filler cut', failure.stderr)


if __name__ == '__main__':
    unittest.main()
