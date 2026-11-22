#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Check delivery completeness and exact files, not visual/audio acceptance."""
import argparse
import hashlib
import json
import subprocess
import tempfile
import wave
from pathlib import Path

from path_safety import same_path

SELF_MEDIA = ('video', 'audio', 'script', 'captions', 'poster_16x9',
              'poster_4x3', 'poster_3x4', 'publishing_copy', 'delivery_note')
RATIOS = {'poster_16x9': 16/9, 'poster_4x3': 4/3, 'poster_3x4': 3/4}


def check(manifest, *, report_path=None):
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
    if profile == 'custom':
        basis = doc.get('scope_basis', {})
        if (not isinstance(basis, dict) or basis.get('kind') not in
                ('explicit_partial_request', 'standalone_artifact') or
                not str(basis.get('request', '')).strip()):
            raise ValueError('custom requires scope_basis with the actual partial request; an implementation route cannot narrow delivery')
    items = doc.get('artifacts')
    omissions = doc.get('omissions', {})
    if not isinstance(items, dict) or not isinstance(omissions, dict):
        raise ValueError('artifacts and omissions must be objects')
    errors, records, excluded = [], [], []
    protected_paths = {manifest}
    revision = doc.get('revision')
    if isinstance(revision, dict) and revision.get('baseline'):
        protected_paths.add(manifest.parent / revision['baseline'])
    from revise_delivery import validate as validate_revision
    errors.extend(validate_revision(doc, manifest.parent))
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
        protected_paths.add(path)
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f'{role}: missing or empty file');continue
        h = hashlib.sha256()
        with path.open('rb') as f:
            for block in iter(lambda: f.read(1024 * 1024), b''):h.update(block)
        digest = h.hexdigest()
        if item.get('sha256') != digest:
            errors.append(f'{role}: SHA256 missing or changed')
        if role in RATIOS:
            generation = item.get('generation', {})
            if generation.get('method') != 'imagegen':
                errors.append(f'{role}: missing imagegen provenance')
            else:
                inputs = [generation.get('prompt', {})] + generation.get('references', [])
                if not generation.get('references'):
                    errors.append(f'{role}: missing style references')
                for source in inputs:
                    source_path = manifest.parent / source.get('path', '')
                    if source.get('path'):
                        protected_paths.add(source_path)
                    if (not source_path.is_file() or not source.get('sha256') or
                            hashlib.sha256(source_path.read_bytes()).hexdigest() != source['sha256']):
                        errors.append(f'{role}: prompt/reference missing or changed')
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
    if 'recorded_edit' in doc:
        from check_recorded_edit import check as check_edit
        if doc['recorded_edit']:
            protected_paths.add(manifest.parent / doc['recorded_edit'])
        video = items.get('video', {}).get('path')
        captions = items.get('captions', {}).get('path')
        if not doc['recorded_edit'] or not video or not captions:
            errors.append('recorded_edit: needs a plan, rendered MP4 and bilingual SRT')
        else:
            try:
                edit = check_edit(manifest.parent / doc['recorded_edit'],
                                  manifest.parent / video, manifest.parent / captions,
                                  protected_paths=protected_paths if report_path is not None else None)
                errors.extend(f'recorded_edit: {error}' for error in edit['errors'])
            except (ValueError, TypeError, KeyError, OSError, wave.Error) as error:
                errors.append(f'recorded_edit: {error}')
    if doc.get('recorded_story'):
        from check_recorded_story import check as check_story
        from revise_delivery import digest
        import imageio_ffmpeg
        timeline_path = manifest.parent / doc['recorded_story']
        timeline = json.loads(timeline_path.read_text())
        protected_paths.update((timeline_path, timeline_path.parent / timeline['audioFile'],
                                timeline_path.parent / 'public' / timeline['video']))
        story = check_story(timeline_path, verify_video=True)
        errors.extend(f'recorded_story: {error}' for error in story['errors'])
        if items.get('audio') and digest(timeline_path.parent / timeline['audioFile']) != items['audio']['sha256']:
            errors.append('recorded_story: narration differs from delivered audio')
        video = items.get('video', {})
        if not video.get('path'):
            errors.append('recorded_story: missing final video')
        else:
            with tempfile.TemporaryDirectory(prefix='vi-say-audio-check-') as temporary:
                wav = Path(temporary) / 'export.wav'
                run = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-nostdin', '-v', 'error',
                    '-i', str((manifest.parent / video['path']).resolve()), '-map', '0:a:0',
                    '-vn', '-c:a', 'pcm_s16le', str(wav)], capture_output=True, text=True)
                if run.returncode:
                    errors.append('recorded_story: final video audio cannot be decoded')
                else:
                    exported = check_story(timeline_path, audio_override=wav)
                    errors.extend(f'exported_audio: {error}' for error in exported['errors'])
    if report_path is not None:
        for source in protected_paths:
            if same_path(report_path, source):
                raise ValueError(f'Report cannot overwrite a delivery input: {source}')
    return {'schema_version': 1, 'manifest': str(manifest), 'profile': profile,
            'complete': not errors, 'quality_assessed': False, 'publication_assessed': False,
            'artifacts': records, 'omissions': excluded, 'errors': errors}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('manifest', type=Path)
    ap.add_argument('--output', type=Path)
    args = ap.parse_args(argv)
    try:
        result = check(args.manifest, report_path=args.output)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result['complete'] else 1
    except (OSError, ValueError, TypeError, KeyError, ImportError, wave.Error) as exc:
        print(json.dumps({'error': str(exc)}, ensure_ascii=False))
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
