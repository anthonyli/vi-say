#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""One production entry: project, posters, pronunciation, timeline and shared Remotion."""
import argparse
import copy
import hashlib
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
INTRO=json.loads((ASSETS/'intro.json').read_text())
PRESETS=sorted(p.stem for p in (ASSETS/'presets').glob('*.json'))
TEMPLATES=['story',*sorted(p.stem for p in (ASSETS/'examples').glob('*.json'))]


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


def init(dest, title, subtitle, label, preset='glass', template='story'):
    if preset not in PRESETS or template not in TEMPLATES:
        raise ValueError(f'Choose preset {PRESETS} and template {TEMPLATES}')
    dest=Path(dest);dest.mkdir(parents=True,exist_ok=False)
    doc={'style_id':STYLE['id'],'title':title,'subtitle':subtitle,'series':label,
         'modules':json.loads((ASSETS/'presets'/f'{preset}.json').read_text()),
         'narration':'narration.txt','lexicon':'lexicon.json','font':None,'poster':{'theme':'yellow-comic'},
         'scenes':[
             {'kind':'hero','start':0,'end':4,'title':title,'subtitle':subtitle},
             {'kind':'steps','start':4,'end':9,'title':'把过程讲清楚','subtitle':'示例编排，正式制作须按最终口播重新填写时间',
              'items':[{'text':'看问题','detail':'明确要解决什么','at':.5},{'text':'做演示','detail':'展示真实变化','at':1.5},{'text':'看结果','detail':'用证据说明效果','at':2.5}]},
             {'kind':'cta','start':9,'end':13,'title':OUTRO['title'],'subtitle':OUTRO['subtitle'],
              'outroId':OUTRO['id'],'items':[{**item,'at':at} for item,at in zip(OUTRO['items'],[.4,1.2,2.0])]}]}
    doc['modules']['captions']['keywords']=[title]
    if template!='story':
        example=json.loads((ASSETS/'examples'/f'{template}.json').read_text())
        doc['modules']['captions']['keywords']=example.pop('keywords')
        doc.update(example)
        for scene in doc['scenes']:
            for key in ['image','video']:
                if scene.get(key):
                    relative=Path(scene[key])
                    if relative.is_absolute() or '..' in relative.parts:
                        raise ValueError('Template media needs a safe relative path')
                    source=(ASSETS/'examples'/relative).resolve()
                    if not source.is_relative_to((ASSETS/'examples').resolve()):
                        raise ValueError('Template media must stay within examples')
                    target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True)
                    shutil.copyfile(source,target)
    elif preset=='glass':
        for scene,position,action in zip(doc['scenes'],[[830,735],[1780,830],[1720,815]],['peek','hop','celebrate']):
            scene['effects']=[{'type':'bot','id':'helper','variant':'hexagon','position':position,'size':90,'action':action}]
    write_json(dest/'project.json',doc);write_json(dest/'lexicon.json',{})
    (dest/'narration.txt').write_text(('' if doc['modules'].get('character',{}).get('mode')=='none' else INTRO['narration'])+'\n先看问题，再做演示，最后用证据说明结果。\n\n'+OUTRO['narration']+'\n')
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
    f=font_path(str(base/doc['font']) if doc.get('font') else str(ASSETS/'fonts/Manrope.ttf') if doc.get('modules',{}).get('background')=='studio' else None)
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
    caption_input=doc.get('captions',[])
    if isinstance(caption_input,str):caption_input=json.loads((base/caption_input).read_text())
    if isinstance(caption_input,dict):caption_input=caption_input.get('captions')
    timeline={'aspect':'16:9','fps':STYLE['video']['fps'],'duration':duration,
              'audio':'audio.wav','character':'dragon.png','fontFile':'font'+f.suffix,
              'captions':copy.deepcopy(caption_input),'overlays':[],'styleId':STYLE['id'],'cartoonScenes':copy.deepcopy(doc['scenes']),
              'visualPreview':preview,'bg':STYLE['palette']['white'],'accent':STYLE['palette']['blue']}
    if doc.get('modules') is not None:timeline['modules']=copy.deepcopy(doc['modules'])
    if f.name=='Manrope.ttf':timeline['fontWeightRange']='200 800'
    timeline['series']=doc.get('series','小龙带你看')
    rounded=doc.get('modules',{}).get('character',{}).get('mode')=='rounded'
    if rounded:
        timeline['characterClosed']='dragon-closed.png';timeline['characterNeutral']='dragon-neutral.png'
    if doc.get('mouth_cues'):
        if preview or not audio:raise ValueError('mouth_cues requires its final audio; silent studies use a closed mouth')
        cues=json.loads((base/doc['mouth_cues']).read_text())
        if cues.get('audio_sha256')!=hashlib.sha256(Path(audio).read_bytes()).hexdigest():
            raise ValueError('mouth_cues must be bound to the exact final audio')
        timeline['mouthCues']=cues['mouthCues'];timeline['mouthCueAudioSha256']=cues['audio_sha256']
    for scene in timeline['cartoonScenes']:
        if scene.get('image') and not scene.get('mediaSize') and any(e.get('type')=='focus' for e in scene.get('effects',[])):
            from PIL import Image,UnidentifiedImageError
            try:
                with Image.open(base/scene['image']) as image:scene['mediaSize']=list(image.size)
            except UnidentifiedImageError:
                raise ValueError('Provide mediaSize for vector demo media with focus effects')
    # Validate before reserving output; the exact renderer contract is authoritative.
    cmd=['node','--input-type=module','-e',
         "import {validate} from "+json.dumps((ROOT/'assets/remotion/render.mjs').as_uri())+";let s='';for await(const c of process.stdin)s+=c;validate(JSON.parse(s));"]
    subprocess.run(cmd,input=json.dumps(timeline),text=True,check=True)
    out.mkdir(parents=True,exist_ok=False)
    shutil.copyfile(ASSETS/STYLE['character']['file'],out/'dragon.png');shutil.copyfile(f,out/timeline['fontFile'])
    if rounded:
        shutil.copyfile(ASSETS/STYLE['character']['closedFile'],out/'dragon-closed.png')
        shutil.copyfile(ASSETS/'dragon-neutral.png',out/'dragon-neutral.png')
    if preview:
        with wave.open(str(out/'audio.wav'),'wb') as w:
            w.setparams((1,2,48000,0,'NONE','not compressed'))
            remaining=round(duration*48000)
            while remaining:
                n=min(remaining,48000);w.writeframes(b'\0\0'*n);remaining-=n
    else:
        shutil.copy2(audio,out/'audio.wav')
        # Carry the exact checked conclusion and its evidence with the timeline.
        # The low-level renderer revalidates these against the staged WAV.
        carried_record=copy.deepcopy(record)
        evidence_source=Path(listening).resolve().parent/record['evidence']['path']
        evidence_name='listening-evidence'+evidence_source.suffix
        shutil.copyfile(evidence_source,out/evidence_name)
        carried_record['evidence']['path']=evidence_name
        write_json(out/'listening.json',carried_record)
        timeline['audioReview']={'pronunciation':'pronunciation.json','listening':'listening.json'}
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
    # Validate all distributable recipes through the actual effect contract.
    subprocess.run(['node',str(ROOT/'assets/remotion/effects/catalog.mjs'),'--json'],check=True,capture_output=True,text=True)
    files=[ROOT/'SKILL.md',ROOT/'LICENSE',ROOT/'NOTICE']
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
    if sys.argv[1:2] == ['archive']:
        from archive_project import main as archive_main
        return archive_main(sys.argv[2:], prog=f'{Path(sys.argv[0]).name} archive')
    ap=argparse.ArgumentParser(description=__doc__);sub=ap.add_subparsers(dest='command',required=True)
    a=sub.add_parser('init');a.add_argument('directory',type=Path);a.add_argument('--title',required=True);a.add_argument('--subtitle',required=True);a.add_argument('--series',default='小龙实战');a.add_argument('--preset',choices=PRESETS,default='glass');a.add_argument('--template',choices=TEMPLATES,default='story')
    for name in ['covers','compile','render']:
        a=sub.add_parser(name);a.add_argument('project',type=Path);a.add_argument('--output-dir',required=True,type=Path)
        if name!='covers':
            a.add_argument('--audio',type=Path);a.add_argument('--listening',type=Path);a.add_argument('--preview',action='store_true')
        if name=='render':a.add_argument('--stills',action='store_true')
    a=sub.add_parser('pack');a.add_argument('output',type=Path)
    sub.add_parser('archive',help='Archive deliverables from a reusable manifest; see archive --help')
    a=sub.add_parser('catalog',help='List implemented effects, parameters and validated templates');a.add_argument('--json',action='store_true')
    args=ap.parse_args()
    if args.command=='catalog':
        return subprocess.run(['node',str(ROOT/'assets/remotion/effects/catalog.mjs')]+(['--json'] if args.json else []),check=True)
    if args.command=='init':return init(args.directory,args.title,args.subtitle,args.series,args.preset,args.template)
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
    except (ValueError,OSError,KeyError,TypeError,zipfile.BadZipFile,subprocess.CalledProcessError) as error:
        print(str(error),file=sys.stderr);raise SystemExit(1)
