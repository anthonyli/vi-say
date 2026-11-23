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


def release_roles(doc):
    from check_delivery import SELF_MEDIA
    return list(dict.fromkeys([*SELF_MEDIA, *doc.get('required', [])]))


def create(baseline, output, roles, request, *, promote=False):
    from check_delivery import check, SELF_MEDIA
    baseline, output = Path(baseline).resolve(), Path(output).resolve()
    if not request.strip() or (not roles and not promote):
        raise ValueError('Specify the actual request and changed roles')
    doc = json.loads(baseline.read_text())
    result = check(baseline)
    allowed_errors = set()
    if promote:
        for role in release_roles(doc):
            if not doc['artifacts'].get(role, {}).get('path'):
                allowed_errors.update((f'{role}: missing artifact', f'{role}: text requirement has no artifact'))
    if set(result['errors']) - allowed_errors:
        raise ValueError('Baseline must pass delivery checks before revision')
    if set(roles) - set(doc['artifacts']):
        raise ValueError('Changed roles must exist in the baseline')
    roles = set(roles)
    new = copy.deepcopy(doc)
    for item in new['artifacts'].values():
        if item.get('path'):
            item['path'] = str((baseline.parent / item['path']).resolve())
        generation = item.get('generation', {})
        for source in ([generation['prompt']] if generation.get('prompt') else []) + generation.get('references', []):
            source['path'] = str((baseline.parent / source['path']).resolve())
    if new.get('recorded_story'):
        new['recorded_story'] = str((baseline.parent / new['recorded_story']).resolve())
    if new.get('recorded_edit'):
        new['recorded_edit'] = str((baseline.parent / new['recorded_edit']).resolve())
    if promote:
        new['profile'] = 'self_media_narrated'
        new['required'] = release_roles(doc)
        new.pop('scope_basis', None)
        new.pop('scope_reason', None)
        # A preview-stage deferral carries no release-stage exemption.
        new['omissions'] = {k: v for k, v in doc.get('omissions', {}).items() if k not in SELF_MEDIA}
        video = new['artifacts'].get('video', {}).get('path')
        if video and Path(video).suffix.lower() != '.mp4':
            roles.add('video')
        for role in dict.fromkeys([*new['required'], *sorted(roles)]):
            if role not in new['omissions'] and (role in roles or role not in new['artifacts']):
                new['artifacts'][role] = {'path': '', 'sha256': ''}
    new['revision'] = {'baseline': str(baseline), 'sha256': digest(baseline),
                       'changed_roles': sorted(roles), 'request': request}
    if promote:
        new['revision']['operation'] = 'promote'
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
    promote = revision.get('operation') == 'promote'
    if not isinstance(roles, list) or (not roles and not promote) or set(roles) - set(old['artifacts']):
        raise ValueError('Invalid revision changed_roles')
    errors = []
    if promote:
        if doc.get('profile') != 'self_media_narrated' or not set(release_roles(old)).issubset(doc.get('required', [])):
            errors.append('Promoted delivery must retain the full release scope')
        if old.get('recorded_story') and not doc.get('recorded_story'):
            errors.append('Promoted delivery dropped the recorded_story check')
        if any(test not in doc.get('text_requirements', []) for test in old.get('text_requirements', [])):
            errors.append('Promoted delivery dropped a text requirement')
    else:
        for key in ('profile', 'required', 'omissions', 'scope_basis'):
            if doc.get(key) != old.get(key):
                errors.append(f'Revision cannot silently change {key}')
    if old.get('recorded_edit') and not doc.get('recorded_edit'):
        errors.append('Revision dropped the recorded_edit check')
    for role, item in old['artifacts'].items():
        if promote and not item.get('path'):
            continue
        current = doc['artifacts'].get(role)
        if current is None:
            errors.append(f'Revision dropped {role}')
        elif role not in roles and current.get('sha256') != item['sha256']:
            errors.append(f'Revision changed protected artifact: {role}')
    return errors


def main(argv=None, *, promote=False):
    description = 'Promote a review manifest to full narrated release delivery.' if promote else __doc__
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--change', action='append', required=not promote, default=[],
                        help='An existing role to replace in this delivery')
    parser.add_argument('--request', required=True)
    args = parser.parse_args(argv)
    try:
        print(create(args.baseline, args.output, args.change, args.request, promote=promote))
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(2, str(exc) + '\n')


if __name__ == '__main__':
    main()
