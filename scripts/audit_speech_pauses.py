#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Locate shorter pauses and segment joins without cutting speech or breathing."""
import argparse
import hashlib
import json
import math
import wave
from array import array
from pathlib import Path
import sys


def audit(path, joins=(), threshold_db=-40, minimum=.30):
    if minimum <= 0 or not math.isfinite(minimum) or not math.isfinite(threshold_db):
        raise ValueError('Finite threshold and positive minimum required')
    with wave.open(str(path)) as wav:
        if wav.getsampwidth()!=2:
            raise ValueError('Pause audit requires PCM16 WAV')
        rate,channels=wav.getframerate(),wav.getnchannels()
        data=array('h',wav.readframes(wav.getnframes()))
    if sys.byteorder!='little':data.byteswap()
    window=max(1,round(rate*.01))*channels
    limit=32768*10**(threshold_db/20)
    spans=[];start=None
    for offset in range(0,len(data),window):
        block=data[offset:offset+window]
        quiet=math.sqrt(sum(x*x for x in block)/len(block))<limit
        if quiet and start is None:start=offset/(rate*channels)
        end=min(offset+window,len(data))/(rate*channels)
        if start is not None and (not quiet or offset+window>=len(data)):
            stop=offset/(rate*channels) if not quiet else end
            if stop-start>=minimum-1e-8:
                spans.append({'start':round(start,3),'end':round(stop,3),'duration':round(stop-start,3),
                              'near_segment_join':any(start-.15<=j<=stop+.15 for j in joins),
                              'status':'needs_review'})
            start=None
    return {'audio_sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            'threshold_db':threshold_db,'minimum_seconds':minimum,'pauses':spans,
            'segment_joins':list(joins),'quality_assessed':False,
            'note':'Candidates only. Review speech context; do not auto-delete breathing. Any edit requires a timing map and renewed alignment.'}


def main():
    if __package__:
        from .path_safety import same_path
    else:
        from path_safety import same_path

    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('audio', type=Path)
    p.add_argument('--generation', type=Path)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--minimum', type=float, default=.30)
    p.add_argument('--threshold-db', type=float, default=-40)
    args = p.parse_args()
    if any(same_path(args.output, source) for source in (args.audio, args.generation) if source is not None):
        p.error('Report cannot overwrite input audio or generation metadata.')
    generation = json.loads(args.generation.read_text()) if args.generation else {}
    digest = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    if generation and generation.get('audio_sha256') != digest:
        raise ValueError('Generation metadata belongs to a different WAV')
    joins = [segment['start'] for segment in generation.get('segments', [])[1:]]
    result = audit(args.audio, joins, args.threshold_db, args.minimum)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False))



def repair_selected_pauses(source, destination, report, selections):
    """Explicitly selected pause centers only; retain exact PCM speech samples."""
    source,destination=Path(source),Path(destination)
    if source.resolve()==destination.resolve() or destination.exists():
        raise ValueError('Use a new destination; never overwrite audio')
    if report['audio_sha256']!=hashlib.sha256(source.read_bytes()).hexdigest():
        raise ValueError('Pause report belongs to a different audio file')
    with wave.open(str(source)) as wav:
        params=wav.getparams();data=wav.readframes(wav.getnframes())
    cuts=[];seen=set()
    for choice in selections:
        index=choice['index'];keep=choice['keep_seconds']
        if index in seen:raise ValueError('Duplicate pause selection')
        seen.add(index)
        pause=report['pauses'][index]
        if not choice.get('reason') or not .24<=keep<pause['duration']:
            raise ValueError('Each cut needs a reason and at least 240 ms of retained pause')
        cuts.append([round((pause['start']+keep/2)*params.framerate)/params.framerate,
                     round((pause['end']-keep/2)*params.framerate)/params.framerate])
    cuts.sort()
    if any(b>c for (_,b),(c,_) in zip(cuts,cuts[1:])):raise ValueError('Overlapping cuts')
    stride=params.nchannels*params.sampwidth;blocks=[];cursor=0
    for a,b in cuts:
        start,end=round(a*params.framerate)*stride,round(b*params.framerate)*stride
        blocks.append(data[cursor:start]);cursor=end
    blocks.append(data[cursor:]);result=b''.join(blocks)
    destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open('xb') as stream:
        with wave.open(stream,'wb') as wav:wav.setparams(params);wav.writeframes(result)
    return {'input_duration':params.nframes/params.framerate,
            'output_duration':len(result)/stride/params.framerate,'speed':1.0,'cuts':cuts,
            'source_sha256':report['audio_sha256'],
            'audio_sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),
            'selections':selections,'listening_status':'not_checked'}


if __name__=='__main__':main()
