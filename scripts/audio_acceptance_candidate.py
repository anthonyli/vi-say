#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Project-isolated audio evidence gate. Validates records, never hears audio."""
import argparse
import hashlib
import json
import math
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def interval(value):
    return (isinstance(value, list) and len(value) == 2
            and all(isinstance(x, (int, float)) and not isinstance(x, bool)
                    and math.isfinite(x) for x in value)
            and 0 <= value[0] < value[1])


def covers(spans, start, end):
    if not isinstance(spans, list) or not all(interval(x) for x in spans):
        return False
    cursor = start
    for a, b in sorted(spans):
        if a > cursor + 1e-6:
            return False
        cursor = max(cursor, b)
        if cursor >= end - 1e-6:
            return True
    return False


def validate(record, required_windows, final_path, base):
    """No network, audio edits, playback, or model use. Paths resolve from record dir."""
    errors = []
    listening_missing = False
    base = Path(base)
    final_path = Path(final_path)

    def error(message):
        errors.append(message)

    def evidence(ref, label):
        if not isinstance(ref, dict) or not ref.get('path') or not ref.get('sha256'):
            error(label + ': missing path/sha256 evidence')
            return False
        path = Path(ref['path'])
        path = path if path.is_absolute() else base / path
        try:
            valid = path.is_file() and digest(path) == ref['sha256']
        except OSError:
            valid = False
        if not valid:
            error(label + ': evidence absent or hash mismatch')
        return valid

    try:
        actual_sha = digest(final_path)
    except OSError:
        actual_sha = None
        error('final artifact cannot be read')
    if record.get('schema_version') != 1:
        error('unsupported schema_version')
    if record.get('final_sha256') != actual_sha or actual_sha is None:
        error('record final SHA does not match actual final artifact')
    duration = record.get('duration_seconds')
    if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not math.isfinite(duration) or duration <= 0:
        error('invalid final duration')
        duration = 0
    ids = set()
    if not isinstance(required_windows, list) or not required_windows:
        error('external required-window inventory is empty or invalid')
        required_windows = []
    for w in required_windows:
        if not isinstance(w, dict) or not w.get('id') or not interval(w.get('span')):
            error('required window lacks resolved id/span; resolve opening bounds explicitly')
            continue
        if w['id'] in ids:
            error('duplicate required window id')
        ids.add(w['id'])
        if w['span'][1] > duration:
            error('required window exceeds final duration')
    windows = record.get('windows', [])
    if not isinstance(windows, list):
        windows = []
        error('windows must be a list')
    by_id = {}
    for w in windows:
        if not isinstance(w, dict) or not w.get('id') or w['id'] in by_id:
            error('invalid or duplicate reviewed window')
            continue
        by_id[w['id']] = w
    if set(by_id) != ids:
        error('reviewed-window inventory does not exactly match external required windows')
    for req in required_windows:
        if not isinstance(req, dict) or req.get('id') not in by_id:
            continue
        w = by_id[req['id']]
        label = 'window ' + str(req['id'])
        if w.get('span') != req.get('span'):
            error(label + ': span differs from required user window')
        if not w.get('mapping_rationale'):
            error(label + ': missing original/master/final timeline mapping rationale')
        if w.get('resolution') not in ('fixed', 'reviewed_no_change_needed'):
            error(label + ': unresolved diagnosis/resolution')
        traces = w.get('traces', {})
        for stage in ('original_tts', 'master', 'final'):
            tr = traces.get(stage, {}) if isinstance(traces, dict) else {}
            artifact = tr.get('artifact', {})
            evidence(artifact, label + '/' + stage + '/artifact')
            evidence(tr.get('evidence'), label + '/' + stage + '/diagnosis')
            if not isinstance(tr.get('spans'), list) or not tr['spans'] or not all(interval(s) for s in tr['spans']):
                error(label + '/' + stage + ': invalid traced spans')
            if not tr.get('finding'):
                error(label + '/' + stage + ': missing finding')
            if stage == 'final':
                if artifact.get('sha256') != actual_sha:
                    error(label + ': final trace hash mismatch')
                if interval(req.get('span')) and not covers(tr.get('spans', []), *req['span']):
                    error(label + ': final trace does not cover entire marked window')
    audit = record.get('full_track_audit', {})
    if audit.get('final_sha256') != actual_sha or not covers(audit.get('coverage', []), 0, duration):
        error('full-track audit missing final binding or complete coverage')
    if not audit.get('method') or not isinstance(audit.get('findings'), list):
        error('full-track audit missing method/findings record')
    evidence(audit.get('evidence'), 'full-track audit')
    listen = record.get('listening', {})
    # ASR, decoding, clipping and spectral metrics deliberately never enter this gate.
    methods = ('human_direct_playback', 'direct_audio_inspection_interface')
    if (listen.get('method') not in methods or listen.get('scope') != 'full_final_track'
            or not covers(listen.get('coverage', []), 0, duration)
            or not listen.get('reviewer') or not listen.get('performed_at')
            or listen.get('verdict') != 'no_unresolved_anomaly_observed'):
        listening_missing = True
        error('real complete final-track listening not established; short-sample approval is insufficient')
    if listen.get('final_sha256') != actual_sha:
        error('listening evidence final SHA mismatch')
    evidence(listen.get('evidence'), 'listening')
    if set(listen.get('reviewed_window_ids', [])) != ids:
        error('listening does not explicitly address all user windows')
    if record.get('unresolved_items') != []:
        error('unresolved_items must be an explicitly empty list, not omitted')
    return {'schema_version': 1, 'status': 'needs_listening' if listening_missing else ('blocked' if errors else 'evidence_record_validated'),
            'evidence_record_validated': not errors, 'final_sha256': actual_sha,
            'audio_quality_independently_verified': False,
            'content_truth_verified': False,
            'quality_claim': 'Never infer audio passed from this structural gate. Attribute any listening conclusion to the named reviewer and bound evidence.',
            'issues': errors}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('record', type=Path)
    ap.add_argument('--required-windows', type=Path, required=True)
    ap.add_argument('--final', type=Path, required=True)
    ap.add_argument('--output', type=Path)
    args = ap.parse_args()
    try:
        result = validate(json.loads(args.record.read_text()), json.loads(args.required_windows.read_text()), args.final, args.record.parent)
    except (ValueError, TypeError, KeyError, AttributeError, OSError) as exc:
        result = {'status': 'blocked', 'evidence_record_validated': False,
                  'content_truth_verified': False, 'issues': ['invalid input: ' + str(exc)]}
    payload = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(payload)
    print(payload, end='')
    return 0 if result['evidence_record_validated'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
