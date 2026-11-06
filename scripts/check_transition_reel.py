#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Detect hidden/frozen transitions in the fixed two-image transition recipe."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageChops, ImageStat
from audio_timing import ffmpeg

ROOT=Path(__file__).resolve().parents[1]


def compare_frames(before,start,middle,end,settled):
    def difference(a,b):
        return sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
    metrics={'start_vs_before':difference(start,before),
             'middle_vs_before':difference(middle,before),
             'middle_vs_after':difference(middle,settled),
             'end_vs_settled':difference(end,settled)}
    metrics['passed']=(metrics['middle_vs_before']>5 and metrics['middle_vs_after']>5
                       and metrics['start_vs_before']<3 and metrics['end_vs_settled']<3)
    return metrics


def compare_transition_samples(before,start,interiors,end,settled):
    # Some genuine shaders reveal early or late (StarWipe, flash transitions).
    # Require visible motion in at least one interior phase, not at 50% only.
    results=[compare_frames(before,start,image,end,settled) for image in interiors]
    best=max(range(len(results)),key=lambda i:min(results[i]['middle_vs_before'],results[i]['middle_vs_after']))
    return {**results[best],'checkedInteriorFractions':[.25,.5,.75],
            'selectedInteriorFraction':[.25,.5,.75][best]}


def check(timeline,video):
    timeline=Path(timeline).resolve();doc=json.loads(timeline.read_text())
    known={hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'assets/production/examples/transition-media').glob('*.svg')}
    for scene in doc['cartoonScenes']:
        if scene.get('mediaBox')!=[0,0,1920,1080] or not scene.get('image'):
            raise ValueError('Use the fixed-image transitions template for this regression check')
        if hashlib.sha256((timeline.parent/scene['image']).read_bytes()).hexdigest() not in known:
            raise ValueError('This regression check requires the two supplied contrasting images')
    code=("import {validate} from "+json.dumps((ROOT/'assets/remotion/render.mjs').as_uri())+";"
          "import {transitionPlan} from "+json.dumps((ROOT/'assets/remotion/cartoon-motion.mjs').as_uri())+";"
          "let s='';for await(const c of process.stdin)s+=c;console.log(JSON.stringify(transitionPlan(validate(JSON.parse(s)))));")
    cuts=json.loads(subprocess.run(['node','--input-type=module','-e',code],input=json.dumps(doc),text=True,capture_output=True,check=True).stdout)
    if not cuts:raise ValueError('No transitions to check')
    points={}
    for cut in cuts:
        for label,frame in [('before',cut['startFrame']-1),('start',cut['startFrame']),('quarter',cut['startFrame']+cut['frames']//4),('middle',cut['startFrame']+cut['frames']//2),('threeQuarter',cut['startFrame']+cut['frames']*3//4),('end',cut['endFrame']),('settled',cut['endFrame']+6)]:
            if frame>=round(doc['duration']*doc['fps']):raise ValueError('Recipe needs an ending hold')
            points.setdefault(frame,[]).append((cut['sceneIndex'],label))
    ordered=sorted(points)
    expression='+'.join(f'eq(n{chr(92)},{frame})' for frame in ordered)
    video=Path(video).resolve()
    decoded=subprocess.run([ffmpeg(),'-v','error','-xerror','-i',str(video),'-vf','select='+expression+',scale=320:180','-fps_mode','vfr','-pix_fmt','rgb24','-f','rawvideo','-'],capture_output=True,check=True).stdout
    size=320*180*3
    if len(decoded)!=len(ordered)*size:raise ValueError('Rendered frames do not cover the entire recipe')
    frames={}
    for index,frame in enumerate(ordered):
        image=Image.frombytes('RGB',(320,180),decoded[index*size:(index+1)*size]).crop((16,26,304,142))
        for key in points[frame]:frames[key]=image
    checks=[]
    for cut in cuts:
        i=cut['sceneIndex']
        checks.append({'transition':cut['kind'],'engine':cut['engine'],
                       **compare_transition_samples(frames[i,'before'],frames[i,'start'],
                           [frames[i,label] for label in ['quarter','middle','threeQuarter']],
                           frames[i,'end'],frames[i,'settled'])})
    return {'passed':all(c['passed'] for c in checks),'scope':'fixed-image transition visibility and endpoints',
            'video':str(video),'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),
            'timeline_sha256':hashlib.sha256(timeline.read_bytes()).hexdigest(),
            'visualAcceptanceAutomaticallyCertified':False,'sampledFrames':len(ordered),'transitions':checks}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('timeline',type=Path);parser.add_argument('video',type=Path)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args();result=check(args.timeline,args.video)
    payload=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.write_text(payload)
    print(json.dumps({'passed':result['passed'],'checked':len(result['transitions']),
                      'failed':[c['transition'] for c in result['transitions'] if not c['passed']]}))
    return 0 if result['passed'] else 1


if __name__=='__main__':
    try:raise SystemExit(main())
    except (ValueError,OSError,KeyError,subprocess.CalledProcessError) as error:
        print(str(error),file=sys.stderr);raise SystemExit(1)
