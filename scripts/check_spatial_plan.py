#!/usr/bin/env python3
"""Validate declared spatial/timing evidence; cannot infer visual or listening quality."""
import argparse,json,math
from pathlib import Path


def number(v):return not isinstance(v,bool) and isinstance(v,(int,float)) and math.isfinite(v)

def check(plan):
    errors=[];warnings=[]
    def need(ok,msg):
        if not ok:errors.append(msg)
    need(plan.get('timebase')=='seconds','timebase must be seconds; no duration-ratio retiming')
    scenes=plan.get('scenes',[]);need(bool(scenes),'scenes required');lookup={}
    fields=('understanding','input','operation','result','carry_object','reading_state')
    for s in scenes:
        sid=s.get('id');need(isinstance(sid,str) and bool(sid),'scene id required')
        need(sid not in lookup,f'duplicate scene {sid}');lookup[sid]=s
        for f in fields:need(isinstance(s.get(f),str) and bool(s[f].strip()),f'{sid}: {f} required')
        valid=all(number(s.get(k)) for k in ('start','end'))
        need(valid,f'{sid}: finite start/end seconds required')
        if valid:need(0<=s['start']<s['end'],f'{sid}: invalid time range')
        layout=s.get('layout',{})
        need(bool(layout.get('topology')),f'{sid}: layout.topology required')
        box=layout.get('dominant_box',[])
        need(len(box)==4 and all(number(v) for v in box) and (len(box)!=4 or 0<=box[0]<box[2]<=1 and 0<=box[1]<box[3]<=1),f'{sid}: normalized dominant_box [l,t,r,b] required')
        for ev in s.get('audio_anchors',[]):
            ok=all(number(ev.get(k)) for k in ('speech_at','visible_at'))
            need(ok,f'{sid}: anchor times must be actual global seconds')
            need(bool(ev.get('word')) and bool(ev.get('visible_result')),f'{sid}: anchor needs word and visible_result')
            tolerance=ev.get('tolerance',.45)
            need(number(tolerance) and tolerance>=0,f'{sid}: tolerance must be nonnegative')
            if ok and number(tolerance) and tolerance>=0:
                need(abs(ev['speech_at']-ev['visible_at'])<=tolerance,f"{sid}: audio/visual anchor {ev.get('word')} exceeds {tolerance}s")
                if valid:need(all(s['start']<=ev[k]<=s['end'] for k in ('speech_at','visible_at')),f'{sid}: anchor outside scene')
        need(bool(s.get('audio_anchors')),f'{sid}: at least one audio/visual anchor required')
    for a,b in zip(scenes,scenes[1:]):
        if number(a.get('end')) and number(b.get('start')):need(abs(a['end']-b['start'])<1e-6,f"{b.get('id')}: scene gap/overlap")
    for tr in plan.get('transitions',[]):
        a,b=lookup.get(tr.get('from')),lookup.get(tr.get('to'));tag=f"{tr.get('from')}->{tr.get('to')}"
        need(a is not None and b is not None,tag+': scene reference missing')
        if a is not None and b is not None:
            need(scenes.index(b)==scenes.index(a)+1,tag+': transition must connect adjacent scenes in forward order')
            if number(a.get('end')) and number(b.get('start')):need(abs(a['end']-b['start'])<1e-6,tag+': transition scenes must share boundary')
        bt=tr.get('boundary_tolerance',.6)
        need(number(bt) and bt>=0,tag+': boundary_tolerance must be finite and nonnegative')
        for f in ('outgoing_anchor','incoming_anchor','direction','occlusion','semantic_boundary'):need(bool(tr.get(f)),tag+': '+f+' required')
        need(tr.get('kind') in ('slide','flip','radial','cut','dissolve'),tag+': unknown kind')
        ok=all(number(tr.get(k)) for k in ('start','duration','text_stable_at'))
        need(ok,tag+': start/duration/text_stable_at must be actual seconds')
        if ok:
            need(tr['duration']>0,tag+': positive duration required')
            need(tr['text_stable_at']>=tr['start']+tr['duration'],tag+': text declared stable inside active transition')
            if b and number(b.get('end')):need(tr['text_stable_at']<b['end'],tag+': no post-transition reading state')
            if b and number(b.get('start')) and number(bt) and bt>=0:need(abs(tr['start']-b['start'])<=bt,tag+': transition detached from scene boundary')
        if a and b and tr.get('major',False):
            la,lb=a.get('layout',{}),b.get('layout',{})
            ba,bb=la.get('dominant_box',[]),lb.get('dominant_box',[])
            samebox=len(ba)==len(bb)==4 and all(number(x) for x in ba+bb) and max(abs(x-y) for x,y in zip(ba,bb))<.08
            need(not (la.get('topology')==lb.get('topology') and samebox),tag+': major transition reuses same declared spatial structure')
            warnings.append(tag+': compare rendered before/mid/after; labels alone cannot prove structural change')
    need(bool(plan.get('transitions')),'transitions required')
    return {'passed':not errors,'errors':errors,'warnings':warnings,'scope':'Declared timing and structure only; not visual, audio, semantic or aesthetic approval.'}

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('plan',type=Path);ap.add_argument('--out',type=Path);a=ap.parse_args();r=check(json.loads(a.plan.read_text()))
    out=json.dumps(r,ensure_ascii=False,indent=2);print(out)
    if a.out:a.out.write_text(out+'\n')
    raise SystemExit(0 if r['passed'] else 1)
