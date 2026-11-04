#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Derive deterministic mouth openness from a real PCM WAV; not phoneme lip sync."""
import argparse, hashlib, json, math, wave
from pathlib import Path
import numpy as np

def analyze(path,fps=30):
    with wave.open(str(path)) as w:
        if w.getsampwidth()!=2:raise ValueError('Use PCM16 WAV for mouth analysis')
        sr=w.getframerate();channels=w.getnchannels();frames=w.getnframes()
        a=np.frombuffer(w.readframes(frames),dtype='<i2').astype(np.float64).reshape(-1,channels)/32768
    mono=np.sqrt(np.mean(a*a,axis=1));count=math.ceil(frames/sr*fps)
    rms=np.array([np.sqrt(np.mean(mono[int(i*sr/fps):min(frames,int((i+1)*sr/fps))]**2)) for i in range(count)])
    voiced=rms[rms>10**(-45/20)];high=float(np.percentile(voiced,85)) if len(voiced) else 1
    low=10**(-45/20);values=[];previous=0
    for r in rms:
        target=0 if r<low else min(1,max(0,(r-low)/max(high-low,1e-6)))**.65
        previous=previous+(.8 if target>previous else .55)*(target-previous)
        values.append(round(0 if previous<.06 else previous,4))
    return {'method':'RMS envelope; not phoneme-aligned','fps':fps,'duration':frames/sr,'audio_sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'values':values}

def main():
    p=argparse.ArgumentParser();p.add_argument('audio',type=Path);p.add_argument('output',type=Path);p.add_argument('--fps',type=int,default=30);a=p.parse_args()
    data=analyze(a.audio,a.fps)
    with a.output.open('x') as f:json.dump(data,f,ensure_ascii=False)
    print(json.dumps({'frames':len(data['values']),'duration':data['duration'],'method':data['method']}))
if __name__=='__main__':main()
