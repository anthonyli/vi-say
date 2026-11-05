#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Archive selected deliverables, verify them, then remove inventoried work copies."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import date, datetime
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import zipfile
from zoneinfo import ZoneInfo


KINDS = {
    'video': {'.mp4', '.mov', '.webm'}, 'audio': {'.wav', '.mp3', '.m4a', '.flac'},
    'poster': {'.png', '.jpg', '.jpeg', '.webp', '.svg'}, 'captions': {'.srt', '.vtt'},
    'script': {'.txt', '.md'}, 'copy': {'.txt', '.md'}, 'document': {'.txt', '.md', '.pdf'},
}
RESOURCES = {'.ttf', '.otf', '.woff', '.woff2', '.safetensors', '.onnx', '.rnnn'}
RESERVED = {'README.md', 'SHA256SUMS.txt'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def relative(value):
    require(isinstance(value, str) and value and '\\' not in value
            and not any(ord(c) < 32 for c in value), 'Use nonempty relative POSIX paths')
    p = PurePosixPath(value)
    require(not p.is_absolute() and all(x not in {'', '.', '..'} for x in value.split('/')),
            f'Unsafe relative path: {value}')
    return p


def local(root, value):
    p = relative(value)
    target = root
    for part in p.parts:
        target /= part
        require(not target.is_symlink(), f'Symlink is not allowed: {target}')
    require(target.resolve().is_relative_to(root), 'Path escapes the project root')
    return target


def fingerprint(stream):
    h, size = hashlib.sha256(), 0
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        size += len(block)
        h.update(block)
    return {'size': size, 'sha256': h.hexdigest()}


def file_info(path):
    require(path.is_file() and not path.is_symlink(), f'Missing regular file: {path}')
    with path.open('rb') as stream:
        return fingerprint(stream)


def inventory(root, sources, *, missing=False):
    result = {}
    for name in sources:
        folder = local(root, name)
        if missing and not folder.exists():
            continue
        require(folder.is_dir(), f'Missing source directory: {name}')
        for parent, dirs, files in os.walk(folder, followlinks=False):
            parent = Path(parent)
            result[parent.relative_to(root).as_posix()] = {'kind': 'directory'}
            for child in dirs + files:
                p = parent / child
                require(not p.is_symlink(), f'Relocate symlink inputs before archiving: {p}')
            for child in files:
                p = parent / child
                result[p.relative_to(root).as_posix()] = {'kind': 'file', **file_info(p)}
    return result


def validate_spec(root, spec):
    require(isinstance(spec, dict) and spec.get('schema') == 1, 'Expected archive schema 1')
    unknown = set(spec) - {'schema', 'project', 'date', 'summary', 'sources', 'files',
                           'resources', 'discard', 'packages', '_inventory'}
    require(not unknown, f'Unknown archive fields: {sorted(unknown)}')
    require(len(relative(spec['project']).parts) == 1, 'project must be one directory name')
    day = spec['date']
    if day != '日期待核对':
        require(isinstance(day, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', day), 'Use YYYY-MM-DD or 日期待核对')
        date.fromisoformat(day)
    require(isinstance(spec.get('summary'), str) and spec['summary'].strip(), 'Record the actual delivery/publication status in summary')
    sources = spec['sources']
    require(isinstance(sources, list) and sources and len(sources) == len(set(sources)), 'List distinct project source directories')
    for source in sources:
        p = relative(source)
        require(len(p.parts) == 2 and p.parts[0] in {'work', 'outputs'},
                'Cleanup sources must be work/<project> or outputs/<project>, never their parent or private/')
        local(root, source)
    require(isinstance(spec.get('files'), list) and spec['files'], 'Select at least one deliverable')
    for name in ['resources', 'discard', 'packages']:
        require(isinstance(spec.get(name, []), list), f'{name} must be an array')
    for pattern in spec.get('discard', []):
        relative(pattern)
        require(any(pattern.startswith(source + '/') for source in sources), 'Discard patterns must stay within a selected source')
    destinations = []
    for row in spec['files'] + spec.get('resources', []):
        require(isinstance(row, dict) and not (set(row) - {'source', 'member', 'to', 'kind'}), 'Unknown file mapping field')
        require(any(row['source'].startswith(s + '/') for s in sources), 'File sources must be inside the inventoried projects')
        local(root, row['source'])
        target = relative(row['to'])
        if row in spec['files']:
            require(row.get('kind') in KINDS and target.suffix.lower() in KINDS[row['kind']], 'Deliverable kind/extension mismatch; do not retain raw ZIPs or process files')
            require(relative(row.get('member', row['source'])).suffix.lower() in KINDS[row['kind']], 'Select a deliverable source or a specific ZIP member; do not rename process files into artifacts')
            require(target.as_posix() not in RESERVED, 'README.md and SHA256SUMS.txt are generated')
            destinations.append(target.as_posix())
        else:
            require(target.parts[:2] in {('private', 'voice'), ('private', 'models'), ('.cache', 'fonts')}
                    and len(target.parts) > 2, 'Reusable resources go to private/voice, private/models, or .cache/fonts')
            local(root, row['to'])
    file_destinations = set(destinations)
    resources = [row['to'] for row in spec.get('resources', [])]
    require(len(resources) == len(set(resources)), 'Reusable resource destination collision')
    packages = spec.get('packages', [])
    for package in packages:
        require(set(package) == {'to', 'files'}, 'Package needs to and explicit files')
        p = relative(package['to'])
        require(p.suffix == '.zip' and package['files'] and isinstance(package['files'], list), 'Package must be a ZIP of selected deliverables')
        require(all(n in file_destinations for n in package['files']), 'Package refers to an unselected deliverable')
        destinations.append(p.as_posix())
    require(len(destinations) == len(set(destinations)), 'Archive destination collision')
    all_destinations = destinations + list(RESERVED)
    require(not any(a != b and b.startswith(a + '/') for a in all_destinations for b in all_destinations), 'Archive file/directory collision')
    return local(root, f"archive/{day}/{spec['project']}")


@contextmanager
def source_stream(root, row):
    path = local(root, row['source'])
    if 'member' not in row:
        with path.open('rb') as stream:
            yield stream
        return
    member = relative(row['member']).as_posix()
    with zipfile.ZipFile(path) as archive:
        matches = [i for i in archive.infolist() if i.filename == member]
        require(len(matches) == 1 and not matches[0].is_dir(), 'ZIP member must be a unique file')
        require(not stat.S_ISLNK(matches[0].external_attr >> 16), 'ZIP symlinks are not allowed')
        with archive.open(matches[0]) as stream:
            yield stream


def protected_resource(name):
    p = PurePosixPath(name)
    return p.suffix.lower() in RESOURCES or (
        p.suffix.lower() in KINDS['audio'] and re.search(r'reference|参考', p.name, re.I))


def make_plan(root, spec, *, allow_existing=False):
    root = Path(root).resolve()
    destination = validate_spec(root, spec)
    require(allow_existing or not destination.exists(), f'Archive already exists; never overwrite: {destination}')
    snapshot = inventory(root, spec['sources'])
    files, resources, aliases, hashes = [], [], {}, {}
    for row in spec['files'] + spec.get('resources', []):
        require(row['source'] in snapshot and snapshot[row['source']]['kind'] == 'file', 'Selected source is not inventoried')
        with source_stream(root, row) as stream:
            entry = {**row, **fingerprint(stream)}
        if row in spec.get('resources', []):
            target = local(root, row['to'])
            require(not target.exists() or file_info(target) == {k: entry[k] for k in ['size', 'sha256']}, 'Reusable resource target differs; choose another name')
            resources.append(entry)
        elif entry['sha256'] in hashes:
            aliases[entry['to']] = hashes[entry['sha256']]
        else:
            hashes[entry['sha256']] = entry['to']
            files.append(entry)
    used = {row['source'] for row in spec['files'] + spec.get('resources', [])}
    discarded, unknown = [], []
    for name, info in snapshot.items():
        if info['kind'] != 'file' or name in used:
            continue
        if protected_resource(name):
            unknown.append(name + ' (reusable resource: preserve explicitly)')
        elif any(fnmatch.fnmatchcase(name, pattern) for pattern in spec.get('discard', [])):
            discarded.append(name)
        else:
            unknown.append(name)
    require(not unknown, f'Unclassified files; keep, preserve or explicitly discard: {unknown[:20]}')
    clean_spec = {k: v for k, v in spec.items() if k != '_inventory'}
    result = {'schema': 1, 'root': str(root), 'spec': clean_spec, 'snapshot': snapshot,
              'files': files, 'resources': resources, 'aliases': aliases, 'discarded': discarded}
    result['plan_id'] = plan_id(result)
    return result


def plan_id(plan):
    value = {k: v for k, v in plan.items() if k != 'plan_id'}
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def save_json(path, data, *, exclusive=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as out:
        temp = Path(out.name)
        out.write((json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode())
    try:
        if exclusive:
            os.link(temp, path)
        else:
            os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def copy_verified(root, row, target):
    expected = {k: row[k] for k in ['size', 'sha256']}
    if target.exists():
        require(file_info(target) == expected, f'Existing target differs: {target}')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = local(root, '.cache/archive/staging')
    staging.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=staging, delete=False) as out:
        temp = Path(out.name)
        try:
            with source_stream(root, row) as src:
                shutil.copyfileobj(src, out)
        except BaseException:
            temp.unlink(missing_ok=True)
            raise
    try:
        require(file_info(temp) == expected, 'Source changed while copying; cleanup is blocked')
        os.link(temp, target)
    finally:
        temp.unlink(missing_ok=True)


def write_new(path, text, staging):
    data = text.encode()
    if path.exists():
        require(not path.is_symlink() and path.read_bytes() == data, f'Existing generated document differs: {path}')
    else:
        with tempfile.NamedTemporaryFile(dir=staging, delete=False) as out:
            temp = Path(out.name)
            out.write(data)
        try:
            os.link(temp, path)
        finally:
            temp.unlink(missing_ok=True)


def build_package(folder, package, aliases, staging):
    names = list(dict.fromkeys(aliases.get(n, n) for n in package['files']))
    target = local(folder, package['to'])
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        with tempfile.NamedTemporaryFile(dir=staging, delete=False) as out:
            temp = Path(out.name)
        try:
            with zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED) as archive:
                for name in names:
                    archive.write(local(folder, name), name)
                archive.write(folder/'README.md', 'README.md')
            os.link(temp, target)
        finally:
            temp.unlink(missing_ok=True)
    with zipfile.ZipFile(target) as archive:
        require(set(archive.namelist()) == set(names + ['README.md'])
                and len(archive.namelist()) == len(names) + 1, 'ZIP contains unexpected or repeated members')
        for name in names + ['README.md']:
            with archive.open(name) as stream:
                require(fingerprint(stream) == file_info(local(folder, name)), f'ZIP verification failed: {name}')


def verify_folder(folder):
    require(folder.is_dir() and not folder.is_symlink(), 'Missing archive directory')
    manifest = folder/'SHA256SUMS.txt'
    require(manifest.is_file() and not manifest.is_symlink(), 'Missing archive checksums')
    expected = {}
    for line in manifest.read_text().splitlines():
        digest, name = line.split('  ', 1)
        require(re.fullmatch(r'[a-f0-9]{64}', digest) and name not in expected and name != manifest.name, 'Invalid checksum entry')
        target = local(folder, name)
        info = file_info(target)
        require(info['sha256'] == digest, f'Archive hash mismatch: {name}')
        expected[name] = info
    require(expected, 'Empty archive manifest')
    actual = set()
    for p in folder.rglob('*'):
        require(not p.is_symlink(), f'Archive contains a symlink: {p}')
        if p.is_file() and p != manifest:
            actual.add(p.relative_to(folder).as_posix())
    require(actual == set(expected), 'Archive has unlisted files')
    return expected


def verify_sources(root, plan, *, partial=False):
    actual = inventory(root, plan['spec']['sources'], missing=partial)
    expected = plan['snapshot']
    if partial:
        require(all(expected.get(name) == value for name, value in actual.items()), 'Source files changed or new files appeared; cleanup stopped')
    else:
        require(actual == expected, 'Sources changed after planning; create a fresh plan')


def validate_plan(root, plan):
    require(plan.get('schema') == 1 and plan.get('root') == str(root), 'Plan belongs to a different project root')
    require(plan.get('plan_id') == plan_id(plan), 'Plan changed; edit the manifest and create a new plan')
    destination = validate_spec(root, plan['spec'])
    sources = plan['spec']['sources']
    for name, info in plan['snapshot'].items():
        require(any(name == s or name.startswith(s + '/') for s in sources), 'Snapshot escapes cleanup scope')
        local(root, name)
        require(info.get('kind') in {'file', 'directory'}, 'Invalid snapshot kind')
    for row in plan['files'] + plan['resources']:
        original = {k: v for k, v in row.items() if k not in {'size', 'sha256'}}
        require(original in plan['spec']['files'] + plan['spec'].get('resources', []), 'Plan mapping differs from its specification')
        require(isinstance(row.get('size'), int) and row['size'] >= 0
                and re.fullmatch(r'[a-f0-9]{64}', row.get('sha256', '')), 'Invalid planned fingerprint')
    return destination


def run_plan(root, plan):
    """Replay safely; after a completed run, never touch a newly recreated work folder."""
    root = Path(root).resolve()
    target = validate_plan(root, plan)
    cache = local(root, '.cache/archive')
    cache.mkdir(parents=True, exist_ok=True)
    import fcntl
    lock = local(root, '.cache/archive/lock')
    with lock.open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another archive operation is running') from None
        staging = local(root, '.cache/archive/staging')
        staging.mkdir(exist_ok=True)
        # Only this locked tool owns the staging directory. A killed copy never
        # leaves a partial deliverable in archive/; remove its cache on retry.
        for temp in staging.iterdir():
            require(temp.is_file() and not temp.is_symlink(), 'Unexpected archive staging entry')
            temp.unlink()
        receipt_path = local(root, f'.cache/archive/{plan_id(plan)}.receipt.json')
        receipt = json.loads(receipt_path.read_text()) if receipt_path.exists() else None
        if receipt:
            require(receipt.get('plan_id') == plan_id(plan), 'Receipt belongs to another plan')
        if receipt and receipt['phase'] in {'verified', 'complete'}:
            require(verify_folder(target) == receipt['artifacts'], 'Archive differs from the verified receipt')
            for row in plan['resources']:
                require(file_info(local(root, row['to'])) == {k: row[k] for k in ['size','sha256']}, 'Preserved resource differs')
            if receipt['phase'] == 'complete':
                return {'status': 'already_complete', 'archive': str(target)}
        else:
            verify_sources(root, plan)
            require(make_plan(root, plan['spec'], allow_existing=True) == plan, 'Plan does not match its source selection; create a fresh plan')
            if receipt is None:
                require(not target.exists(), 'Destination already exists; no overwrite or merge')
                target.mkdir(parents=True, exist_ok=False)
                receipt = {'plan_id': plan_id(plan), 'phase': 'copying'}
                save_json(receipt_path, receipt, exclusive=True)
            require(target.is_dir(), 'Incomplete archive directory is missing')
            for row in plan['files']:
                copy_verified(root, row, local(target, row['to']))
            for row in plan['resources']:
                copy_verified(root, row, local(root, row['to']))
            spec = plan['spec']
            index = f"# {spec['project']}\n\n{spec['summary'].strip()}\n\n归档日期：{spec['date']}\n\n"
            index += '\n'.join(f"- `{row['to']}`" for row in plan['files']) + '\n'
            if plan['aliases']:
                index += '\n相同内容仅保留一份：\n' + '\n'.join(f'- `{a}` → `{b}`' for a,b in plan['aliases'].items()) + '\n'
            write_new(target/'README.md', index, staging)
            for package in spec.get('packages', []):
                build_package(target, package, plan['aliases'], staging)
            names = [r['to'] for r in plan['files']] + ['README.md'] + [p['to'] for p in spec.get('packages', [])]
            expected = {name: file_info(local(target, name)) for name in names}
            write_new(target/'SHA256SUMS.txt', ''.join(f"{expected[n]['sha256']}  {n}\n" for n in sorted(expected)), staging)
            require(verify_folder(target) == expected, 'Archive verification failed')
            verify_sources(root, plan)
            receipt.update(phase='verified', artifacts=expected)
            save_json(receipt_path, receipt)
        # Never recursively delete a directory: only remove exact, hashed inventory entries.
        require(verify_folder(target) == receipt['artifacts'], 'Archive changed before cleanup')
        for row in plan['resources']:
            require(file_info(local(root, row['to'])) == {k: row[k] for k in ['size','sha256']}, 'Preserved resource changed before cleanup')
        verify_sources(root, plan, partial=True)
        for name, info in plan['snapshot'].items():
            if info['kind'] != 'file':
                continue
            path = local(root, name)
            if path.exists():
                require(file_info(path) == {k: info[k] for k in ['size','sha256']}, 'Source changed during cleanup')
                path.unlink()
        dirs = [n for n,i in plan['snapshot'].items() if i['kind'] == 'directory']
        for name in sorted(dirs, key=lambda n: len(PurePosixPath(n).parts), reverse=True):
            path = local(root, name)
            if path.exists():
                path.rmdir()  # New/unplanned files keep their directory and abort cleanup.
        receipt['phase'] = 'complete'
        save_json(receipt_path, receipt)
        return {'status': 'complete', 'archive': str(target), 'files': len(plan['files']),
                'deduplicated': len(plan['aliases']), 'resources': len(plan['resources'])}


def main(argv=None, *, prog=None):
    ap = argparse.ArgumentParser(prog=prog, description=__doc__)
    ap.add_argument('--root', type=Path, default=Path.cwd(), help='Production project root; defaults to cwd')
    sub = ap.add_subparsers(dest='command', required=True)
    init = sub.add_parser('init', help='Create a draft manifest with a read-only inventory')
    init.add_argument('project'); init.add_argument('--source', action='append')
    init.add_argument('--date', default=datetime.now(ZoneInfo('Asia/Shanghai')).date().isoformat())
    init.add_argument('--output', required=True)
    plan = sub.add_parser('plan', help='Validate choices and bind all source hashes; no archive mutation')
    plan.add_argument('manifest'); plan.add_argument('--output', required=True)
    run = sub.add_parser('run', help='Copy, verify, rebuild packages and clean only planned sources')
    run.add_argument('plan')
    verify = sub.add_parser('verify', help='Read-only verification of an existing archive')
    verify.add_argument('directory')
    args = ap.parse_args(argv); root = args.root.resolve()
    if args.command in {'init','plan'}:
        output = local(root, args.output)
        require(relative(args.output).parts[:2] == ('.cache', 'archive'), 'Drafts/plans belong in .cache/archive/, outside cleanup directories')
        require(not output.exists(), 'Do not overwrite an existing manifest or plan')
    if args.command == 'init':
        relative(args.project)
        sources = args.source or [f'{prefix}/{args.project}' for prefix in ['work','outputs'] if (root/prefix/args.project).is_dir()]
        require(sources, 'No matching projects; specify --source work/<project> or outputs/<project>')
        draft = {'schema':1,'project':args.project,'date':args.date,'summary':'', 'sources':sources,
                 'files':[],'resources':[],'discard':[],'packages':[]}
        # Validate scope before walking. Empty choices are intentional in a draft.
        validate_spec(root, {**draft,'summary':'draft','files':[{'source':sources[0]+'/draft.txt','to':'稿件/draft.txt','kind':'script'}]})
        draft['_inventory'] = inventory(root, sources)
        for name, entry in draft['_inventory'].items():
            if name.endswith('.zip') and entry['kind'] == 'file':
                with zipfile.ZipFile(local(root,name)) as z:
                    entry['members'] = [i.filename for i in z.infolist() if not i.is_dir()]
        save_json(output,draft,exclusive=True)
        result = {'draft':str(output),'files_to_classify':sum(i['kind']=='file' for i in draft['_inventory'].values())}
    elif args.command == 'plan':
        spec = json.loads(local(root,args.manifest).read_text())
        result_plan = make_plan(root,spec)
        save_json(output,result_plan,exclusive=True)
        result = {'plan':str(output),'archive':f"archive/{spec['date']}/{spec['project']}",
                  'keep':[r['to'] for r in result_plan['files']], 'aliases':result_plan['aliases'],
                  'preserve':[r['to'] for r in result_plan['resources']], 'discard_count':len(result_plan['discarded'])}
    elif args.command == 'run':
        result = run_plan(root,json.loads(local(root,args.plan).read_text()))
    else:
        relative_path=relative(args.directory)
        require(relative_path.parts[0]=='archive' and len(relative_path.parts)>=3,'Verify an archive project directory')
        result={'valid':True,'files':len(verify_folder(local(root,args.directory)))}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return result


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, zipfile.BadZipFile) as error:
        raise SystemExit(str(error))
