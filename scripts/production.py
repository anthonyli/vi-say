#!/usr/bin/env python3
"""One production entry: project, posters, pronunciation, timeline and shared Remotion."""
import argparse
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import wave
import zipfile
from pronunciation import prepare, check_listening
from production_design import ROOT, ASSETS, STYLE, font_path, poster
from local_voice import wav_info
SKILL_NAME='vi-say'
OUTRO=json.loads((ASSETS/'outro.json').read_text())


def write_json(path, data):
    Path(path).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


def outro_scene(start, end, anchors):
    """Use measured absolute word starts; no invented/fixed narration timing."""
    if set(anchors) != {item['anchor'] for item in OUTRO['items']}:
        raise ValueError('Provide measured 留言/关注/点赞 word starts')
    return {'kind':'cta','outroId':OUTRO['id'],'start':start,'end':end,
            'title':OUTRO['title'],'subtitle':OUTRO['subtitle'],
            'items':[{**item,'at':anchors[item['anchor']]-start} for item in OUTRO['items']]}


def project(path):
    path=Path(path).resolve();doc=json.loads(path.read_text())
    if doc.get('style_id') != STYLE['id']:
        raise ValueError('Use the installed colorful-dragon-v1 style')
    return path.parent,doc


def init(dest, title, subtitle, label):
    dest=Path(dest);dest.mkdir(parents=True,exist_ok=False)
    doc={'style_id':STYLE['id'],'title':title,'subtitle':subtitle,'series':label,
         'narration':'narration.txt','lexicon':'lexicon.json','font':None,'poster':{'theme':'yellow-comic'},
         'scenes':[
             {'kind':'hero','start':0,'end':4,'title':title,'subtitle':subtitle},
             {'kind':'steps','start':4,'end':9,'title':'把过程讲清楚','subtitle':'示例编排，正式制作须按最终口播重新填写时间',
              'items':[{'text':'看问题','detail':'明确要解决什么','at':.5},{'text':'做演示','detail':'展示真实变化','at':1.5},{'text':'看结果','detail':'用证据说明效果','at':2.5}]},
             {'kind':'cta','start':9,'end':13,'title':OUTRO['title'],'subtitle':OUTRO['subtitle'],
              'outroId':OUTRO['id'],'items':[{**item,'at':at} for item,at in zip(OUTRO['items'],[.4,1.2,2.0])]}]}
    write_json(dest/'project.json',doc);write_json(dest/'lexicon.json',{})
    (dest/'narration.txt').write_text('先看问题，再做演示，最后用证据说明结果。\n\n'+OUTRO['narration']+'\n')
    print(dest/'project.json')


def covers(base,doc,out):
    out.mkdir(parents=True,exist_ok=False)
    f=font_path(str(base/doc['font']) if doc.get('font') else None)
    records=[]
    for aspect in STYLE['covers']:
        options=copy.deepcopy(doc.get('poster',{}))
        if options.get('visual'):options['visual']=str((base/options['visual']).resolve())
        im,info=poster(doc['title'],doc['subtitle'],doc['series'],aspect,f,options)
        filename='cover-'+aspect.replace(':','x')+'.png';im.save(out/filename)
        records.append({'file':filename,**info})
    write_json(out/'layout.json',{'style_id':STYLE['id'],'font':str(f),'covers':records,'visual_review':'required'})
    return records


def compile_project(base,doc,out,*,audio=None,listening=None,preview=False):
    """Never invent final audio timing; narration and scene coverage must agree."""
    if not isinstance(doc.get('scenes'),list) or not doc['scenes']:
        raise ValueError('Author scenes from final word timing first')
    if not preview and not doc.get('omit_outro') and doc['scenes'][-1].get('outroId') != OUTRO['id']:
        raise ValueError('Append the shared outro narration and its measured scene; omit_outro is only for an explicit user opt-out')
    text=(base/doc['narration']).read_text()
    plan=prepare(text,json.loads((base/doc['lexicon']).read_text()))
    f=font_path(str(base/doc['font']) if doc.get('font') else None)
    if preview:
        duration=doc['scenes'][-1]['end']
        if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not 0<duration<=600:
            raise ValueError('Preview duration must be 0..600 seconds')
    else:
        if audio is None or listening is None:
            raise ValueError('Final render requires --audio and --listening; use --preview only for visibly marked silent studies')
        duration=wav_info(audio)['duration_seconds']
        record=json.loads(Path(listening).read_text())
        result=check_listening(plan,audio,record,Path(listening).resolve().parent)
        if not result['record_validated']:
            raise ValueError('; '.join(result['issues']))
    if abs(doc['scenes'][-1]['end']-duration)>.001:
        raise ValueError('Scene endpoint must match measured final WAV duration; rebind word anchors, never stretch animation or audio')
    timeline={'aspect':'16:9','fps':STYLE['video']['fps'],'duration':duration,
              'audio':'audio.wav','character':'dragon.png','fontFile':'font'+f.suffix,
              'captions':[],'overlays':[],'styleId':STYLE['id'],'cartoonScenes':copy.deepcopy(doc['scenes']),
              'visualPreview':preview,'bg':STYLE['palette']['white'],'accent':STYLE['palette']['blue']}
    # Validate before reserving output; the exact renderer contract is authoritative.
    cmd=['node','--input-type=module','-e',
         "import {validate} from "+json.dumps((ROOT/'assets/remotion/render.mjs').as_uri())+";let s='';for await(const c of process.stdin)s+=c;validate(JSON.parse(s));"]
    subprocess.run(cmd,input=json.dumps(timeline),text=True,check=True)
    out.mkdir(parents=True,exist_ok=False)
    shutil.copyfile(ASSETS/STYLE['character']['file'],out/'dragon.png');shutil.copyfile(f,out/timeline['fontFile'])
    if preview:
        with wave.open(str(out/'audio.wav'),'wb') as w:
            w.setparams((1,2,48000,0,'NONE','not compressed'))
            remaining=round(duration*48000)
            while remaining:
                n=min(remaining,48000);w.writeframes(b'\0\0'*n);remaining-=n
    else:
        shutil.copy2(audio,out/'audio.wav')
        from speech_motion import analyze
        timeline['speechMotion']=analyze(audio,timeline['fps'])
        timeline['characterClosed']='dragon-closed.png'
        shutil.copyfile(ASSETS/STYLE['character']['closedFile'],out/'dragon-closed.png')
    # Copy only explicitly authored local screenshots; no synthetic interface claims.
    for i,s in enumerate(timeline['cartoonScenes']):
        for key in ['image','video']:
            if s.get(key):
                src=(base/s[key]).resolve()
                if not src.is_file():raise ValueError('Missing demo media: '+str(src))
                name=f'scene-{i}{src.suffix}';shutil.copy2(src,out/name);s[key]=name
    write_json(out/'timeline.json',timeline);write_json(out/'pronunciation.json',plan)
    (out/'spoken.txt').write_text(plan['spoken_text'])
    covers(base,doc,out/'covers')
    return out/'timeline.json'


def package_skill(output):
    """Ship runtime resources, not developer tests, reports, media outputs or caches."""
    output=Path(output).resolve()
    if output.exists():raise FileExistsError(output)
    files=[ROOT/'SKILL.md']
    excluded={'tests','__pycache__','node_modules','.cache','.remotion'}
    for folder in ['agents','references','scripts','assets']:
        for parent,dirs,names in os.walk(ROOT/folder):
            dirs[:]=[d for d in dirs if d not in excluded]
            for n in names:
                p=Path(parent)/n
                if n.startswith('test_') or n.endswith(('.pyc','.DS_Store')) or n=='.DS_Store':continue
                if p.is_symlink():raise ValueError('Unexpected symlink in distributable: '+str(p))
                files.append(p)
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'x',compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(files):z.write(p,Path(SKILL_NAME)/p.relative_to(ROOT))
    print(json.dumps({'archive':str(output),'files':len(files),'cache_included':False},ensure_ascii=False))


def main():
    ap=argparse.ArgumentParser(description=__doc__);sub=ap.add_subparsers(dest='command',required=True)
    a=sub.add_parser('init');a.add_argument('directory',type=Path);a.add_argument('--title',required=True);a.add_argument('--subtitle',required=True);a.add_argument('--series',default='小龙实战')
    for name in ['covers','compile','render']:
        a=sub.add_parser(name);a.add_argument('project',type=Path);a.add_argument('--output-dir',required=True,type=Path)
        if name!='covers':
            a.add_argument('--audio',type=Path);a.add_argument('--listening',type=Path);a.add_argument('--preview',action='store_true')
        if name=='render':a.add_argument('--stills',action='store_true')
    a=sub.add_parser('pack');a.add_argument('output',type=Path)
    args=ap.parse_args()
    if args.command=='init':return init(args.directory,args.title,args.subtitle,args.series)
    if args.command=='pack':return package_skill(args.output)
    base,doc=project(args.project);out=args.output_dir.resolve()
    if args.command=='covers':covers(base,doc,out);print(out);return
    timeline=compile_project(base,doc,out,audio=args.audio,listening=args.listening,preview=args.preview)
    if args.command=='render':
        cmd=['node',str(ROOT/'assets/remotion/render.mjs'),str(timeline),str(out/'video.mp4')]
        if args.stills:cmd+=['--stills',str(out/'stills')]
        subprocess.run(cmd,check=True)
    print(timeline)


if __name__=='__main__':
    try:main()
    except (ValueError,OSError,KeyError,subprocess.CalledProcessError) as error:
        print(str(error),file=sys.stderr);raise SystemExit(1)
