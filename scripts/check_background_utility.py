#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Task-scoped background-effect evidence gate; never a listening/quality pass."""
import argparse,json,hashlib,math
from pathlib import Path

def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8388608),b''):h.update(b)
 return h.hexdigest()
def check(record,required,final,base):
 actual=sha(final);issues=[];base=Path(base)
 def evidence(r):
  if not isinstance(r,dict) or not isinstance(r.get('path'),str):return False
  p=Path(r['path']);p=p if p.is_absolute() else base/p
  return p.is_file() and sha(p)==r.get('sha256')
 def number(x):return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
 if record.get('final_sha256')!=actual:issues.append('final SHA mismatch')
 if not isinstance(required,list) or not required:issues.append('task-declared nonempty required window inventory missing');required=[]
 rows=record.get('windows',[])
 if not isinstance(rows,list):rows=[]
 idx={r.get('id'):r for r in rows if isinstance(r,dict)}
 ids=[r.get('id') for r in required if isinstance(r,dict)]
 if len(ids)!=len(required) or len(set(ids))!=len(ids) or len(idx)!=len(rows) or set(idx)!=set(ids):issues.append('missing/duplicate/extra windows')
 for req in required:
  if not isinstance(req,dict):continue
  key=req.get('id');r=idx.get(key,{})
  span=req.get('span')
  if not isinstance(span,list) or len(span)!=2 or not all(number(x) for x in span) or not 0<=span[0]<span[1]:issues.append(str(key)+': invalid task window span')
  threshold=req.get('min_background_reduction_db');value=r.get('measured_background_reduction_db')
  if not key or not number(threshold) or threshold<=0:issues.append(str(key)+': invalid task threshold');continue
  if r.get('span')!=req.get('span') or r.get('final_sha256')!=actual:issues.append(str(key)+': window span/SHA mismatch')
  if not number(value) or value<threshold:issues.append(str(key)+': required measured effect absent/insufficient')
  if not evidence(r.get('measurement_evidence')):issues.append(str(key)+': missing actual measurement evidence')
  t=r.get('template_validation',{})
  for flag in ('actual_word_boundaries_checked','periodicity_and_spectral_stability_checked','held_out_validation_checked'):
   if t.get(flag) is not True:issues.append(str(key)+': template '+flag+' missing')
  if not evidence(t.get('evidence')):issues.append(str(key)+': template evidence missing')
  if r.get('observation_category')!='background_layer':issues.append(str(key)+': preserve background-layer observation; lexical fixes are not resolution')
 risks=record.get('risks',{})
 for kind in ('speech_in_residual','new_transients','voice_fidelity','musical_noise'):
  item=risks.get(kind,{})
  if item.get('status') not in ('not_checked','observed','not_observed') or not item.get('note'):issues.append(kind+': explicit risk record required')
 ok=not issues
 return {'status':'measured_effect_record_validated_needs_listening' if ok else 'blocked_insufficient_background_effect','measured_effect_record_validated':ok,'audio_pass':False,'content_truth_verified':False,'listening':'not_verified_by_this_tool','final_sha256':actual,'issues':issues}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('record',type=Path);p.add_argument('--required-windows',required=True,type=Path);p.add_argument('--final',required=True,type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
 try:r=check(json.loads(a.record.read_text()),json.loads(a.required_windows.read_text()),a.final,a.record.parent)
 except (ValueError,TypeError,AttributeError,OSError) as e:r={'status':'blocked','measured_effect_record_validated':False,'audio_pass':False,'issues':[str(e)]}
 s=json.dumps(r,ensure_ascii=False,indent=2)+'\n';print(s,end='')
 if a.output:a.output.write_text(s)
 return 0 if r['measured_effect_record_validated'] else 1
if __name__=='__main__':raise SystemExit(main())
