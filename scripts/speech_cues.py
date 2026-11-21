#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0
"""Resolve spoken cue words into measured scene-relative times.

Scenes may write `"cue": "关注"` instead of a hand-measured `at`, on scene
items, on effects, and on effect `items[]`/`events[]`/`points[]`. `endCue`
sets an effect's `endAt` (when it is put away) and `cueOffset` shifts a cue
by a few hundredths of a second. Times come from the `characters` list of
align_captions.py, which belongs to the final WAV; nothing is estimated.
"""
import copy


def _norm(text):
    return ''.join(c.lower() for c in text if c.isalnum())


class _Stream:
    def __init__(self, characters):
        self.chars = characters
        self.text = ''.join(c['char'] for c in characters)

    def find(self, phrase, start, end, after=-1):
        """Index of the first spoken `phrase` beginning inside [start, end), after `after`."""
        needle = _norm(phrase)
        if not needle:
            raise ValueError(f'cue {phrase!r} has no letters to match')
        position = self.text.find(needle, after + 1)
        while position >= 0:
            t = self.chars[position]['start']
            if start - .001 <= t < end:
                return position
            if t >= end:
                break
            position = self.text.find(needle, position + 1)
        return None


def _resolve(row, stream, scene, label, after, key='at', cue_key='cue'):
    phrase = row.pop(cue_key)
    offset = row.pop('cueOffset', 0) if cue_key == 'cue' else 0
    index = stream.find(phrase, scene['start'], scene['end'], after)
    if index is None:
        raise ValueError(f'{label}: cue {phrase!r} is not spoken inside {scene["start"]:.2f}–{scene["end"]:.2f}s; '
                         'check the narration or the scene boundaries')
    row[key] = round(max(0.0, stream.chars[index]['start'] - scene['start'] + offset), 3)
    return index


def has_cues(value):
    if isinstance(value, dict):
        return 'cue' in value or 'endCue' in value or any(has_cues(v) for v in value.values())
    if isinstance(value, list):
        return any(has_cues(v) for v in value)
    return False


def resolve_cues(scenes, characters):
    """Return scenes with every cue replaced by measured times; raise when a cue is not spoken."""
    scenes = copy.deepcopy(scenes)
    if not has_cues(scenes):
        return scenes
    if not characters:
        raise ValueError('cue words need word timing: set project captions to the align_captions.py output')
    stream = _Stream(characters)
    for number, scene in enumerate(scenes, 1):
        last = -1
        for i, item in enumerate(scene.get('items') or []):
            if 'cue' in item:
                last = _resolve(item, stream, scene, f'scene {number} item {i + 1}', last)
        for j, effect in enumerate(scene.get('effects') or []):
            label = f'scene {number} effect {j + 1} ({effect.get("type")})'
            if 'cue' in effect:
                _resolve(effect, stream, scene, label, -1)
            for field in ('items', 'events', 'points'):
                previous = -1
                for k, row in enumerate(effect.get(field) or []):
                    if isinstance(row, dict) and 'cue' in row:
                        previous = _resolve(row, stream, scene, f'{label} {field}[{k}]', previous)
            if 'endCue' in effect:
                _resolve(effect, stream, scene, label, -1, key='endAt', cue_key='endCue')
    return scenes
