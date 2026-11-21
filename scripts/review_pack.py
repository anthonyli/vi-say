#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Self-check pack built with every HTML review.

`production.py review` writes the playable HTML preview plus `self-check/`:
two contact sheets (each scene once it has settled, each transition at its
middle frame) and `report.json` with pacing findings computed from the real
timeline. The agent reads both sheets and the report, fixes what is wrong,
and only then hands the HTML to the user. Nothing here certifies taste.
"""
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

STATIC_LIMIT = 5.0       # seconds without a visible change in a non-media scene
IMAGE_DEMO_LIMIT = 8.0   # screenshots only drift with the slow push
MIN_CAPTION = 1.0        # captions shorter than this flash past
MAX_READING = 7.5        # Chinese characters per second


def _times(value):
    """Every authored change time inside an effect or item list (scene-relative)."""
    found = []
    if isinstance(value, dict):
        for key in ('at', 'endAt', 'gatherAt', 'summaryAt', 'sendAt'):
            if isinstance(value.get(key), (int, float)) and not isinstance(value.get(key), bool):
                found.append(float(value[key]))
        for key in ('items', 'events', 'points', 'keyframes', 'actions', 'changes'):
            for row in value.get(key) or []:
                found += _times(row)
    return found


def pacing(timeline):
    """Findings about holds and caption rhythm; advisory, based on authored timing."""
    findings = []
    for number, scene in enumerate(timeline.get('cartoonScenes') or [], 1):
        length = scene['end'] - scene['start']
        if scene.get('video'):
            continue  # continuous footage carries its own motion
        changes = [0.0, .6]  # entry and settle
        for item in scene.get('items') or []:
            changes += _times(item)
        for effect in scene.get('effects') or []:
            changes += _times(effect) or [0.0]
        changes = sorted({round(t, 3) for t in changes if 0 <= t <= length} | {round(length, 3)})
        gap, at = max(((b - a, a) for a, b in zip(changes, changes[1:])), default=(0, 0))
        limit = IMAGE_DEMO_LIMIT if scene.get('image') else STATIC_LIMIT
        if gap > limit:
            findings.append({'check': 'static_hold', 'scene': number,
                             'message': f'scene {number} ({scene["kind"]}) has no visible change for {gap:.1f}s '
                                        f'from {scene["start"] + at:.1f}s; add a cue-card, spotlight, sketch or split the scene'})
    for i, cue in enumerate(timeline.get('captions') or [], 1):
        seconds = cue['end'] - cue['start']
        chars = sum(1 for c in cue['text'] if c.isalnum())
        if seconds < MIN_CAPTION:
            findings.append({'check': 'caption_flash', 'caption': i,
                             'message': f'caption {i} is shown for only {seconds:.2f}s: {cue["text"]}'})
        elif chars / seconds > MAX_READING:
            findings.append({'check': 'caption_speed', 'caption': i,
                             'message': f'caption {i} needs {chars / seconds:.1f} characters/s: {cue["text"]}'})
    return findings


def fullest(scene):
    """Latest scene-relative time before the first authored exit begins."""
    length = scene['end'] - scene['start']
    exits = [e['endAt'] - e.get('exitSeconds', .35) for e in scene.get('effects') or []
             if e.get('exit') not in (None, 'none') and isinstance(e.get('endAt'), (int, float))]
    return min([length, *[t - .05 for t in exits]])


def _font(size):
    try:
        from production_design import font_path
        return ImageFont.truetype(str(font_path()), size)
    except (OSError, ImportError, ValueError):
        return ImageFont.load_default()


def contact_sheet(frames, output, columns=3, width=640):
    """Grid of labelled frames: [(png path, label)]."""
    if not frames:
        return None
    height, bar = width * 9 // 16, 40
    rows = (len(frames) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * width, rows * (height + bar)), '#18233c')
    draw, font = ImageDraw.Draw(sheet), _font(24)
    for index, (path, label) in enumerate(frames):
        x, y = (index % columns) * width, (index // columns) * (height + bar)
        with Image.open(path) as image:
            sheet.paste(image.convert('RGB').resize((width, height)), (x, y + bar))
        draw.text((x + 12, y + 6), label, fill='#ffdb42', font=font)
    sheet.save(output, quality=88)
    return output


def build(timeline_path, out_dir, renderer):
    """Render stills for the compiled timeline, build both sheets and the report."""
    timeline = json.loads(Path(timeline_path).read_text())
    check = Path(out_dir) / 'self-check'
    check.mkdir(parents=True, exist_ok=False)
    stills = check / 'stills'
    subprocess.run(['node', str(renderer), str(timeline_path), str(check / 'unused.mp4'), '--stills', str(stills)],
                   check=True, stdout=subprocess.DEVNULL)
    manifest = json.loads((stills / 'manifest.json').read_text())
    frames = manifest if isinstance(manifest, list) else manifest.get('frames', manifest.get('stills', []))
    fps, scenes = timeline['fps'], timeline.get('cartoonScenes') or []
    settled = {}
    for f in frames:
        number = int(f['sceneId'].rsplit('-', 1)[-1])
        scene = scenes[number - 1] if number <= len(scenes) else None
        # Show each scene at its fullest: before any effect starts putting itself away.
        if f.get('transition') or scene is None or f['frame'] / fps - scene['start'] > fullest(scene) + .001:
            continue
        if f['sceneId'] not in settled or f['frame'] > settled[f['sceneId']]['frame']:
            settled[f['sceneId']] = f
    scene_frames = []
    for sid, f in sorted(settled.items(), key=lambda kv: kv[1]['frame']):
        number = int(sid.rsplit('-', 1)[-1])
        kind = scenes[number - 1]['kind'] if number <= len(scenes) else ''
        scene_frames.append((stills / f['file'], f'场景 {number} · {kind} · {f["frame"] / fps:.1f}s'))
    cut_frames = [(stills / f['file'], f'转场 {f["sceneId"].rsplit("-", 1)[-1]} · {f["transition"]} · {f["frame"] / fps:.1f}s')
                  for f in frames if f.get('reason') == 'transition middle']
    report = {
        'scenes_sheet': contact_sheet(scene_frames, check / 'scenes.jpg') and 'scenes.jpg',
        'transitions_sheet': contact_sheet(cut_frames, check / 'transitions.jpg') and 'transitions.jpg',
        'stills': len(frames),
        'findings': pacing(timeline),
        'quality_assessed': False,
        'next': 'Open scenes.jpg and transitions.jpg, fix overlaps, empty or crowded frames and every finding, '
                'then send the HTML review to the user.',
    }
    (check / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    return report
