#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Compare sliding speaker embeddings to the fixed reference; diagnostic only."""
import argparse
from contextlib import redirect_stdout, redirect_stderr
import json
import math
import os
from pathlib import Path
import tempfile

from local_voice import (check_source_identity, default_voice_config, load_backend, local_path, prepare_plan,
                         require_generated_path)
from voice_consistency import file_digest


def window_starts(duration, window, stride):
    if not all(math.isfinite(v) and v > 0 for v in [duration, window, stride]) or stride > window:
        raise ValueError('Use positive finite times and stride <= window')
    tail = max(0, duration - window)
    starts = [i * stride for i in range(math.floor(tail / stride) + 1)]
    if tail - starts[-1] > 1e-6:
        starts.append(tail)
    return starts


def compare(model, reference, audio, rate, *, window=8, stride=4):
    import numpy as np
    from mlx import core as mx
    def embed(samples):
        encoded = model.extract_speaker_embedding(samples, sr=rate).astype(mx.float32)
        mx.eval(encoded)
        values = np.asarray(encoded).reshape(-1)
        norm = float(np.linalg.norm(values))
        if not np.isfinite(values).all() or norm < 1e-8:
            raise ValueError('Speaker encoder returned invalid features')
        return values / norm
    target = embed(reference)
    duration = audio.shape[0] / rate
    rows = []
    opening = None
    for start in window_starts(duration, window, stride):
        end = min(duration, start + window)
        samples = audio[round(start * rate):round(end * rate)]
        energy = float(mx.sqrt(mx.mean(samples * samples)))
        if energy < 10 ** (-45 / 20):
            rows.append({'start': start, 'end': end, 'skipped': 'low energy'})
            continue
        vector = embed(samples)
        if opening is None:
            opening = vector
        rows.append({'start': round(start, 4), 'end': round(end, 4),
                     'reference_cosine': round(float(np.clip(vector @ target, -1, 1)), 6),
                     'opening_cosine': round(float(np.clip(vector @ opening, -1, 1)), 6)})
    thirds = []
    for part in range(3):
        current = [r['reference_cosine'] for r in rows if 'reference_cosine' in r
                   and min(2, int((r['start'] + r['end']) / 2 / duration * 3)) == part]
        thirds.append(round(float(np.mean(current)), 6) if current else None)
    return {'duration': duration, 'windows': rows, 'reference_cosine_by_third': thirds}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config')
    parser.add_argument('--audio', action='append', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--window', type=float, default=8)
    parser.add_argument('--stride', type=float, default=4)
    args = parser.parse_args()
    output = require_generated_path(args.output)
    if output.exists() or output.is_symlink():
        raise FileExistsError('Use a new report path')
    window_starts(1, args.window, args.stride)
    config_path = Path(args.config or default_voice_config()).resolve()
    config = json.loads(config_path.read_text())
    text = local_path(config['reference_text_file'], config_path.parent, 'reference_text_file')
    plan = prepare_plan(config_path, text, output.with_suffix('.unused.wav'), mode='continuous')
    if plan.engine != 'mlx':
        raise ValueError('This optional diagnostic currently uses the local MLX Qwen speaker encoder')
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    with open(os.devnull, 'w') as quiet, redirect_stdout(quiet), redirect_stderr(quiet):
        from mlx_audio.utils import load_audio
        load, _ = load_backend()
        model = load(str(plan.model))
        reference = load_audio(str(plan.reference_audio), sample_rate=24000, volume_normalize=False)
        results = []
        for audio in args.audio:
            path = Path(audio).resolve()
            samples = load_audio(str(path), sample_rate=24000, volume_normalize=False)
            result = compare(model, reference, samples, 24000, window=args.window, stride=args.stride)
            results.append({'audio': str(path), 'audio_sha256': file_digest(path), **result})
        check_source_identity(plan)
    report = {'schema_version': 1, 'voice_id': plan.voice_id, 'voice_identity': plan.identity,
              'window_seconds': args.window, 'stride_seconds': args.stride,
              'method': 'Qwen speaker encoder cosine; same-model diagnostic, not independent verification',
              'threshold_calibrated': False, 'listening_performed': False,
              'voice_consistency_passed': None, 'results': results}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=output.parent, delete=False) as stream:
        temporary = Path(stream.name)
        json.dump(report, stream, ensure_ascii=False, indent=2)
    try:
        os.link(temporary, output)
    finally:
        temporary.unlink()
    print(json.dumps({'report': str(output), 'results': [
        {'audio': Path(r['audio']).name, 'thirds': r['reference_cosine_by_third']} for r in results],
        'voice_consistency_passed': None}, ensure_ascii=False))


if __name__ == '__main__':
    main()
