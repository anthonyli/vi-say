#!/usr/bin/env python3
"""Deterministic10ms quiet-window regression flag; not a noise/listening classifier."""
import argparse,array,hashlib,json,math,subprocess,sys
from pathlib import Path

def detect(baseline,candidate,sample_rate=48000,quiet_db=-60,new_db=-45,rise_db=12):
    if len(baseline)!=len(candidate) or not baseline:return {'status':'blocked','issues':['unaligned or empty sample counts'],'flags':[]}
    if not all(math.isfinite(x) for seq in (baseline,candidate) for x in seq):return {'status':'blocked','issues':['nonfinite PCM'],'flags':[]}
    step=round(sample_rate*.01);flags=[]
    for i in range(0,len(baseline),step):
        b=baseline[i:i+step];c=candidate[i:i+step]
        rms=lambda x:20*math.log10(max(1e-12,math.sqrt(sum(v*v for v in x)/len(x))))
        peak=lambda x:20*math.log10(max(1e-12,max(abs(v) for v in x)))
        br,cr=rms(b),rms(c);bp,cp=peak(b),peak(c)
        # Both peak and RMS are retained. A quiet baseline + newly audible-scale peak is a flag, not proof of audible noise.
        if bp<quiet_db and (cp>new_db or (cp-bp>=rise_db and cp>quiet_db)):
            flags.append({'span':[i/sample_rate,(i+len(b))/sample_rate],'baseline_peak_dbfs':bp,'candidate_peak_dbfs':cp,'baseline_rms_dbfs':br,'candidate_rms_dbfs':cr,'peak_rise_db':cp-bp,'classification':'new_energy_regression_candidate_not_noise_diagnosis'})
    return {'status':'blocked' if flags else 'no_new_energy_flag_in_tested_rule','issues':['new quiet-window energy flags require investigation'] if flags else [],'flags':flags,'window_ms':10,'thresholds':{'baseline_peak_below_dbfs':quiet_db,'candidate_peak_above_dbfs':new_db,'alternate_peak_rise_db':rise_db},'sample_count':len(baseline),'sample_rate':sample_rate,'audio_quality_verified':False}

def decode(path):
    b=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','pipe:1']);a=array.array('f');a.frombytes(b)
    if sys.byteorder!='little':a.byteswap()
    return a

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('baseline',type=Path);ap.add_argument('candidate',type=Path);ap.add_argument('--alignment-note',required=True);ap.add_argument('--quiet-db',type=float,default=-60);ap.add_argument('--new-db',type=float,default=-45);ap.add_argument('--rise-db',type=float,default=12);ap.add_argument('--output',type=Path);a=ap.parse_args()
    r=detect(decode(a.baseline),decode(a.candidate),quiet_db=a.quiet_db,new_db=a.new_db,rise_db=a.rise_db);r['alignment_note']=a.alignment_note;r['input_sha256']=hashlib.sha256(a.baseline.read_bytes()).hexdigest();r['candidate_sha256']=hashlib.sha256(a.candidate.read_bytes()).hexdigest();s=json.dumps(r,indent=2)+'\n'
    if a.output:a.output.write_text(s)
    print(s,end='');return 1 if r['status']=='blocked' else 0
if __name__=='__main__':raise SystemExit(main())
