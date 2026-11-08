#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Check delivery completeness and exact files, not visual/audio acceptance."""
import argparse
import hashlib
import json
from pathlib import Path

SELF_MEDIA = ('video', 'audio', 'script', 'captions', 'poster_16x9',
              'poster_4x3', 'poster_3x4', 'publishing_copy', 'delivery_note')
RATIOS = {'poster_16x9': 16/9, 'poster_4x3': 4/3, 'poster_3x4': 3/4}


def check(manifest):
    manifest = Path(manifest).resolve()
    doc = json.loads(manifest.read_text(encoding='utf-8'))
    if doc.get('schema_version') != 1:
        raise ValueError('schema_version must be 1')
    profile = doc.get('profile')
    if profile not in ('self_media_narrated', 'custom'):
        raise ValueError('Unknown delivery profile')
    required = list(SELF_MEDIA) if profile == 'self_media_narrated' else doc.get('required')
    if not isinstance(required, list) or not required or not all(isinstance(x, str) and x for x in required):
        raise ValueError('custom requires a nonempty role list')
    if profile == 'custom' and not str(doc.get('scope_reason', '')).strip():
        raise ValueError('custom requires scope_reason from the actual task')
    items = doc.get('artifacts')
    omissions = doc.get('omissions', {})
    if not isinstance(items, dict) or not isinstance(omissions, dict):
        raise ValueError('artifacts and omissions must be objects')
    errors, records, excluded = [], [], []
    for role, reason in omissions.items():
        if role not in required or not isinstance(reason, dict) or not reason.get('reason') or not reason.get('basis'):
            raise ValueError('Each omission needs a required role, reason and task/user basis')
        if role in items:
            raise ValueError(f'{role}: cannot both deliver and omit')
        excluded.append({'role': role, **reason})
    for role in dict.fromkeys([*required, *items]):
        if role in omissions:
            continue
        item = items.get(role)
        if not isinstance(item, dict) or not item.get('path'):
            errors.append(f'{role}: missing artifact');continue
        path = (manifest.parent / item['path']).resolve()
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f'{role}: missing or empty file');continue
        h = hashlib.sha256()
        with path.open('rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):h.update(block)
        digest = h.hexdigest()
        if item.get('sha256') != digest:
            errors.append(f'{role}: SHA256 missing or changed')
        if role in RATIOS:
            from PIL import Image
            try:
                with Image.open(path) as im:
                    w, height = im.size;im.verify()
                if abs(w / height / RATIOS[role] - 1) > .02:
                    errors.append(f'{role}: wrong image aspect ratio {w}x{height}')
            except (OSError, ValueError) as exc:
                errors.append(f'{role}: unreadable image: {exc}')
        records.append({'role': role, 'path': str(path), 'sha256': digest, 'bytes': path.stat().st_size})
    for requirement in doc.get('text_requirements', []):
        if not isinstance(requirement, dict):raise ValueError('Invalid text requirement')
        role, choices = requirement.get('role'), requirement.get('any_of')
        if not isinstance(role, str) or not isinstance(choices, list) or not choices or not all(isinstance(x, str) and x.strip() for x in choices):
            raise ValueError('Text requirement needs role and nonempty any_of')
        item = items.get(role)
        if not item:
            errors.append(f'{role}: text requirement has no artifact');continue
        path = (manifest.parent / item['path']).resolve()
        if not path.is_file():continue
        content = path.read_text(encoding='utf-8')
        if not any(x in content for x in choices):
            errors.append(f'{role}: missing required text {requirement.get("id", choices)}')
    return {'schema_version': 1, 'manifest': str(manifest), 'profile': profile,
            'complete': not errors, 'quality_assessed': False, 'publication_assessed': False,
            'artifacts': records, 'omissions': excluded, 'errors': errors}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('manifest', type=Path)
    ap.add_argument('--output', type=Path)
    args = ap.parse_args(argv)
    try:
        if args.output and args.output.resolve() == args.manifest.resolve():
            raise ValueError('Report cannot overwrite manifest')
        result = check(args.manifest)
        if args.output:
            raw = json.loads(args.manifest.read_text(encoding='utf-8'))
            sources = {(args.manifest.resolve().parent / x['path']).resolve() for x in raw['artifacts'].values() if isinstance(x, dict) and x.get('path')}
            if args.output.resolve() in sources:raise ValueError('Report cannot overwrite artifact')
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result['complete'] else 1
    except (OSError, ValueError, TypeError, KeyError, ImportError) as exc:
        print(json.dumps({'error': str(exc)}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
