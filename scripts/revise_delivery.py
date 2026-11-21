#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Create a revision manifest that locks unchanged artifacts and delivery scope."""
import argparse
import copy
import hashlib
import json
from pathlib import Path


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def create(baseline, output, roles, request):
    from check_delivery import check
    baseline, output = Path(baseline).resolve(), Path(output).resolve()
    if not request.strip() or not roles:
        raise ValueError('Specify the actual request and changed roles')
    result = check(baseline)
    if not result['complete']:
        raise ValueError('Baseline must pass delivery checks before revision')
    doc = json.loads(baseline.read_text())
    if set(roles) - set(doc['artifacts']):
        raise ValueError('Changed roles must exist in the baseline')
    new = copy.deepcopy(doc)
    for item in new['artifacts'].values():
        item['path'] = str((baseline.parent / item['path']).resolve())
        generation = item.get('generation', {})
        for source in ([generation['prompt']] if generation.get('prompt') else []) + generation.get('references', []):
            source['path'] = str((baseline.parent / source['path']).resolve())
    if new.get('recorded_story'):
        new['recorded_story'] = str((baseline.parent / new['recorded_story']).resolve())
    if new.get('recorded_edit'):
        new['recorded_edit'] = str((baseline.parent / new['recorded_edit']).resolve())
    new['revision'] = {'baseline': str(baseline), 'sha256': digest(baseline),
                       'changed_roles': sorted(set(roles)), 'request': request}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump(new, stream, ensure_ascii=False, indent=2)
    return output


def validate(doc, base):
    revision = doc.get('revision')
    if revision is None:
        return []
    if not isinstance(revision, dict) or not revision.get('request', '').strip():
        raise ValueError('Revision needs an actual request')
    path = (base / revision['baseline']).resolve()
    if digest(path) != revision['sha256']:
        return ['Revision baseline changed']
    old = json.loads(path.read_text())
    roles = revision.get('changed_roles')
    if not isinstance(roles, list) or not roles or set(roles) - set(old['artifacts']):
        raise ValueError('Invalid revision changed_roles')
    errors = []
    for key in ('profile', 'required', 'omissions', 'scope_basis'):
        if doc.get(key) != old.get(key):
            errors.append(f'Revision cannot silently change {key}')
    if old.get('recorded_edit') and not doc.get('recorded_edit'):
        errors.append('Revision dropped the recorded_edit check')
    for role, item in old['artifacts'].items():
        current = doc['artifacts'].get(role)
        if current is None:
            errors.append(f'Revision dropped {role}')
        elif role not in roles and current.get('sha256') != item['sha256']:
            errors.append(f'Revision changed protected artifact: {role}')
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--change', action='append', required=True)
    parser.add_argument('--request', required=True)
    args = parser.parse_args(argv)
    try:
        print(create(args.baseline, args.output, args.change, args.request))
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(2, str(exc) + '\n')


if __name__ == '__main__':
    main()
