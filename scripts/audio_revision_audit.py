#!/usr/bin/env python3
"""Revision audit wrapper: technical/DSP outcomes cannot erase user rejections."""
import argparse
import json
import re
from pathlib import Path
from audio_acceptance_candidate import validate, digest


def audit(record, windows, rejections, final, base):
    gate = validate(record, windows, final, base)
    issues = list(gate['issues'])
    base = Path(base)
    sha = gate.get('final_sha256')
    def ref_ok(ref):
        if not isinstance(ref, dict) or not isinstance(ref.get('path'), str):
            return False
        p = Path(ref['path']); p = p if p.is_absolute() else base / p
        return p.is_file() and digest(p) == ref.get('sha256')
    def valid_sha(s):
        return isinstance(s, str) and re.fullmatch('[0-9a-f]{64}', s) is not None
    if not isinstance(rejections, list):
        issues.append('external rejection inventory must be a list')
        rejections = []
    hist = record.get('rejection_history')
    if not isinstance(hist, list):
        issues.append('explicit rejection_history required, even if empty')
        hist = []
    index = {x.get('id'): x for x in hist if isinstance(x, dict)}
    req_ids = [x.get('id') for x in rejections if isinstance(x, dict)]
    if (len(index) != len(hist) or len(set(req_ids)) != len(req_ids)
            or len(req_ids) != len(rejections) or set(index) != set(req_ids)):
        issues.append('rejection inventory missing/duplicate/extra records')
    for req in rejections:
        if not isinstance(req, dict):
            issues.append('malformed rejection inventory item'); continue
        row = index.get(req.get('id'), {})
        if not req.get('id'):
            issues.append('rejection id required')
        for field in ('source_sha256', 'final_sha256'):
            if not valid_sha(req.get(field)) or row.get(field) != req.get(field):
                issues.append(str(req.get('id')) + ': rejected source/final SHA binding mismatch')
        if row.get('status') != 'rejected':
            issues.append(str(req.get('id')) + ': rejection must remain rejected; never rewrite it as passed')
        if not row.get('feedback') or not ref_ok(row.get('evidence')):
            issues.append(str(req.get('id')) + ': missing actual feedback evidence')
    regression = record.get('non_speech_regression_audit', {})
    if (regression.get('final_sha256') != sha or not regression.get('method')
            or not ref_ok(regression.get('evidence')) or not isinstance(regression.get('regions'), list)):
        issues.append('non-speech/low-energy candidate-region regression audit missing or stale')
    else:
        if not regression['regions'] and not regression.get('no_regions_rationale'):
            issues.append('empty regression regions need explicit rationale, not assumed silence')
        for region in regression['regions']:
            if (not isinstance(region, dict) or not region.get('classification_basis')
                    or not region.get('comparison') or region.get('new_transient_flag') not in (True, False)):
                issues.append('regression region lacks classification basis/baseline comparison/transient flag')
            elif region['new_transient_flag'] and region.get('resolution') != 'reviewed_and_resolved':
                issues.append('new transient peak regression remains unresolved; this flag is not a noise diagnosis')
    acceptance = record.get('user_final_acceptance', {})
    accepted = (acceptance.get('status') == 'accepted' and acceptance.get('scope') == 'full_final_track'
                and acceptance.get('final_sha256') == sha and ref_ok(acceptance.get('evidence')))
    if rejections and not accepted:
        issues.append('user rejections remain controlling until explicit full-final acceptance of this SHA')
    # A rejected artifact is not a new revision merely because metadata says so.
    same_sha_rejections = [x for x in rejections if isinstance(x, dict)
                           and x.get('final_sha256') == sha]
    required_retraction_ids = {x.get('id') for x in same_sha_rejections}
    retraction = record.get('user_rejection_retraction', {})
    # Explicit subsequent user evidence is separate from generic acceptance.
    # This is structural validation, never authentication of the user's words.
    retracted = (isinstance(retraction, dict)
                 and retraction.get('status') in ('retracted', 'accepted')
                 and retraction.get('final_sha256') == sha
                 and retraction.get('scope') == 'full_final_track'
                 and set(retraction.get('supersedes_rejection_ids', [])) == required_retraction_ids
                 and retraction.get('subsequent_to_all_listed_rejections') is True
                 and bool(retraction.get('user_message_id'))
                 and bool(retraction.get('explicit_user_statement'))
                 and ref_ok(retraction.get('evidence')))
    rejected_current = bool(same_sha_rejections) and not retracted
    if rejected_current:
        issues.append('current final SHA is user-rejected; no explicit subsequent same-SHA user retraction/acceptance evidence')
    # background_layer is an observed defect category, not a pronunciation error.
    # ASR, lexical rewrites and diagnostic successes cannot resolve rejection.
    revised = record.get('revision', {})
    has_revision = (revised.get('status') == 'corrected_candidate_unverified'
                    and revised.get('final_sha256') == sha and ref_ok(revised.get('evidence')))
    # Even a complete formal record is not a content-truth or listening verifier.
    validated = not issues
    if rejected_current:
        status = 'rejected_by_user'
    elif validated:
        status = 'evidence_record_validated'
    elif has_revision and not accepted:
        status = 'corrected_candidate_unverified'
    else:
        status = gate['status'] if gate['status'] != 'evidence_record_validated' else 'blocked'
    return {'status': status, 'evidence_record_validated': validated,
            'audio_quality_independently_verified': False, 'content_truth_verified': False,
            'active_default_changed': False, 'final_sha256': sha,
            'listening_gate_status': gate['status'],
            'rejected_version_count': len(rejections), 'current_sha_rejected': rejected_current,
            'issues': issues,
            'disclosure': 'DF3/desibilance/spectrum/ASR are DSP or diagnostic candidates, never approval. Corrected candidate status is not audio pass; exit remains1 until required evidence complete.'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('record', type=Path)
    ap.add_argument('--required-windows', required=True, type=Path)
    ap.add_argument('--rejections', required=True, type=Path)
    ap.add_argument('--final', required=True, type=Path)
    ap.add_argument('--output', type=Path)
    a = ap.parse_args()
    try:
        out = audit(json.loads(a.record.read_text()), json.loads(a.required_windows.read_text()),
                    json.loads(a.rejections.read_text()), a.final, a.record.parent)
    except (ValueError, TypeError, KeyError, AttributeError, OSError) as exc:
        out = {'status':'blocked','evidence_record_validated':False,'content_truth_verified':False,'issues':[str(exc)]}
    payload=json.dumps(out,ensure_ascii=False,indent=2)+'\n'
    if a.output:a.output.write_text(payload)
    print(payload,end='')
    return 0 if out['evidence_record_validated'] else 1


if __name__=='__main__':raise SystemExit(main())
