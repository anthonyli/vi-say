#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Generate approximate phonetic mouth cues bound to one final PCM WAV."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave


def generate(audio, output, executable=None):
    audio=Path(audio).resolve();output=Path(output).resolve()
    if output.exists():raise FileExistsError(output)
    tool=str(executable) if executable else shutil.which('rhubarb')
    if not tool:raise ValueError('Install Rhubarb locally or provide --rhubarb; this command does not download a runtime')
    with wave.open(str(audio)) as wav:
        if wav.getcomptype()!='NONE' or wav.getsampwidth()!=2:
            raise ValueError('Use the final uncompressed PCM16 WAV')
        duration=wav.getnframes()/wav.getframerate()
    if duration<=0:raise ValueError('Audio is empty')
    audio_hash=hashlib.sha256(audio.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix='vi-say-mouth-') as tmp:
        result=Path(tmp)/'cues.json'
        completed=subprocess.run([str(tool),'-r','phonetic','-f','json','-o',str(result),str(audio),'--quiet'],capture_output=True,text=True)
        if completed.returncode:raise ValueError('Rhubarb failed: '+completed.stderr.strip())
        raw=json.loads(result.read_text())
    if abs(raw['metadata']['duration']-duration)>.02:raise ValueError('Rhubarb duration does not match final WAV')
    cues=raw['mouthCues']
    if not cues:raise ValueError('No mouth cues returned')
    end=0
    for cue in cues:
        if cue['value'] not in set('XABCDEFGH') or abs(cue['start']-end)>.001 or cue['end']<=cue['start']:
            raise ValueError('Mouth cues must be contiguous valid states')
        end=cue['end']
    # Rhubarb rounds seconds to hundredths; retain the exact PCM endpoint.
    if abs(end-duration)>.02:raise ValueError('Mouth cues do not cover the final WAV')
    cues[-1]['end']=duration
    if hashlib.sha256(audio.read_bytes()).hexdigest()!=audio_hash:raise ValueError('Audio changed during analysis')
    document={'audio_sha256':audio_hash,'duration':duration,'method':'Rhubarb phonetic; approximate 2D mouth states, not exact Mandarin forced alignment','quality_assessed':False,'mouthCues':cues}
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('x') as stream:stream.write(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
    return document


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--rhubarb',type=Path)
    args=parser.parse_args()
    doc=generate(args.audio,args.output,args.rhubarb)
    print(json.dumps({'output':str(args.output),'duration':doc['duration'],'states':len(doc['mouthCues']),'audio_sha256':doc['audio_sha256'],'quality_assessed':False}))


if __name__=='__main__':
    try:main()
    except (OSError,ValueError,KeyError,wave.Error) as error:raise SystemExit(str(error))
