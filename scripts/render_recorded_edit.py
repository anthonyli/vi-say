#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Render a reviewed recorded edit to MP4 and bilingual SRT."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

import imageio_ffmpeg

from audio_timing import ffmpeg
from check_recorded_edit import ASSETS, validate_plan, verify_video, verify_voice
from render_captions import ass_text, srt_text

FIT = ('scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,'
       'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x101722,setsar=1,format=yuv420p')


def run(args, cwd):
    result = subprocess.run([ffmpeg(), '-hide_banner', '-nostdin', '-v', 'error', *args],
                            cwd=cwd, capture_output=True, text=True)
    if result.returncode:
        raise ValueError(result.stderr.strip() or 'FFmpeg edit export failed')


def prepare_outro(body, doc, cues, frames, root, font_file):
    fps = doc['fps']
    end = doc['outro']['transition']
    start = end['start']
    public = root / 'public'
    public.mkdir()
    run(['-i', str(body), '-vf', f'select=eq(n\\,{frames-1}),{FIT}',
         '-frames:v', '1', '-update', '1', 'public/last-frame.png'], root)
    props = {
        'fps': fps, 'duration': doc['duration'] - start, 'transitionSeconds': end['end'] - start,
        'transition': end['name'], 'transitionParams': end.get('params', {}),
        'actions': [{**item, 'at': item['at'] - start} for item in doc['outro']['actions']],
        'captions': [{**cue, 'start': cue['start']-start, 'end': cue['end']-start}
                     for cue in cues if cue['start'] >= start],
    }
    if font_file:
        props['font'] = font_file.name
        shutil.copyfile(font_file, public / font_file.name)
    (root/'outro.json').write_text(json.dumps(props, ensure_ascii=False))
    subprocess.run(['node', str(ASSETS/'remotion/render-recorded-outro.mjs'),
                    str(root/'outro.json'), str(root/'outro.mp4')], check=True)


def render(plan, body, audio, output, srt, font_name='PingFang SC', font_file=None):
    plan, body, audio = (Path(p).resolve() for p in (plan, body, audio))
    output, srt = (Path(p).absolute() for p in (output, srt))
    if output.suffix.lower() != '.mp4' or srt.suffix.lower() != '.srt':
        raise ValueError('Use MP4 and SRT outputs')
    if any(path.exists() or path.is_symlink() for path in (output, srt)):
        raise FileExistsError('Use new output paths')
    doc = json.loads(plan.read_text())
    cues, audible = validate_plan(doc)
    verify_voice(doc, plan.parent)
    if font_file:
        font_file = Path(font_file).resolve()
    fps = doc['fps']
    outro = doc.get('outro')
    start = outro['transition']['start'] if outro else doc['duration']
    frames = round(start * fps)
    if frames < 1 or abs(frames - start * fps) > .001:
        raise ValueError('The body must end on a video frame boundary')
    if imageio_ffmpeg.count_frames_and_secs(str(body))[0] != frames:
        raise ValueError(f'Body must contain {frames} frames before the outro transition')
    with wave.open(str(audio), 'rb') as wav:
        if abs(wav.getnframes() / wav.getframerate() - doc['duration']) > .005:
            raise ValueError('The final mixed WAV must cover the full timeline')
    output.parent.mkdir(parents=True, exist_ok=True)
    srt.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.recorded-edit-', dir=output.parent) as temp:
        root = Path(temp)
        (root/'fonts').mkdir()
        if font_file:
            shutil.copyfile(font_file, root/'fonts'/font_file.name)
        body_cues = [cue for cue in cues if cue['start'] < start]
        caption_filter = ''
        if body_cues:
            (root/'captions.ass').write_text(ass_text(body_cues, font_name, 46, font_file))
            caption_filter = ',ass=filename=captions.ass:fontsdir=fonts'
        frame_clock = f'settb=1/{fps},setpts=N'
        filters = f'[0:v]{frame_clock},{FIT}{caption_filter}'
        inputs = ['-i', str(body)]
        if outro:
            prepare_outro(body, doc, cues, frames, root, font_file)
            inputs += ['-i', 'outro.mp4']
            # Decode each file independently. Remotion and recording containers
            # use different H.264 extradata and time bases even at the same fps.
            filters += (f'[body];[1:v]{frame_clock},setsar=1,format=yuv420p[outro];'
                        f'[body][outro]concat=n=2:v=1:a=0,{frame_clock}')
        filters += '[video]'
        run([*inputs, '-i', str(audio), '-filter_complex_threads', '2',
             '-filter_complex', filters, '-map', '[video]', '-map', f'{len(inputs)//2}:a:0',
             '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-r', str(fps),
             '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
             'body-and-outro.mp4'], root)
        movie = root/'body-and-outro.mp4'
        errors = verify_video(movie, doc, audible)
        if errors:
            raise ValueError('; '.join(errors))
        text = srt_text(cues)
        with srt.open('x', encoding='utf-8') as target:
            target.write(text)
        try:
            os.link(movie, output)
        except OSError:
            srt.unlink()
            raise
    return {'video': str(output), 'captions': str(srt), 'duration': doc['duration'],
            'listening_assessed': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    for name in ('body', 'audio', 'output', 'srt'):
        parser.add_argument('--'+name, required=True, type=Path)
    parser.add_argument('--font-name', default='PingFang SC')
    parser.add_argument('--font-file', type=Path)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(render(**vars(args)), ensure_ascii=False))
    except (OSError, ValueError, TypeError, KeyError, RuntimeError, subprocess.SubprocessError, wave.Error) as error:
        parser.exit(1, str(error)+'\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
