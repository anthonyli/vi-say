# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Reference identity and sentence-bounded synthesis; not a listening verdict."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import wave


@lru_cache(maxsize=128)
def _file_digest(path, size, modified, changed, inode):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def file_digest(path):
    path = Path(path).resolve()
    stat = path.stat()
    return _file_digest(str(path), stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns, stat.st_ino)


def reference_identity(model, reference_audio, reference_text):
    """Pin actual weights/tokenizer/config contents, not merely a model name."""
    model = Path(model).resolve()
    files = sorted(p for p in model.rglob('*') if p.is_file()
                   and p.suffix in {'.safetensors', '.json', '.txt', '.model', '.tiktoken', '.npz'}
                   and not any(part.startswith('.') for part in p.relative_to(model).parts))
    manifest = {str(p.relative_to(model)): file_digest(p) for p in files}
    return {
        'reference_audio_sha256': file_digest(reference_audio),
        'reference_text_sha256': hashlib.sha256(reference_text.encode('utf-8')).hexdigest(),
        'model_sha256': hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest(),
    }


def validate_lock(lock, identity):
    if lock is None:
        return None
    if (not isinstance(lock, dict) or lock.get('schema_version') != 1
            or not isinstance(lock.get('id'), str) or not lock['id'].strip()
            or lock.get('assets') != identity):
        raise ValueError('Locked voice reference/transcript/model changed; select and validate a new voice lock explicitly')
    return lock['id']


def semantic_segments(text, limit=120):
    """Keep paragraphs and complete sentences; never cut an oversized sentence."""
    if isinstance(limit, bool) or not isinstance(limit, int) or not 20 <= limit <= 500:
        raise ValueError('segment_chars must be an integer from 20 to 500')
    result = []
    for paragraph in re.split(r'\n\s*\n', text.strip()):
        sentences = [s.strip() for s in re.split(r'(?<=[。！？；])|(?<=[.!?;])\s+', paragraph) if s.strip()]
        current = ''
        for sentence in sentences:
            if len(sentence) > limit:
                raise ValueError('A complete sentence exceeds segment_chars; rewrite it or explicitly raise the limit')
            separator = ' ' if current and current[-1:].isascii() else ''
            if current and len(current + separator + sentence) > limit:
                result.append(current)
                current = ''
                separator = ''
            current += separator + sentence
        if current:
            result.append(current)
    if not result:
        raise ValueError('Narration must not be empty')
    return result


def set_generation_seed(engine, seed):
    if seed is None:
        return
    if engine == 'mlx':
        from mlx import core as mx
        mx.random.seed(seed)
    else:
        import torch
        torch.manual_seed(seed)


def join_pcm(sources, destination):
    """Join exact samples in order without respeeding, overlap, or padding."""
    segments = []
    cursor = 0
    expected = None
    with wave.open(str(destination), 'wb') as output:
        for source in sources:
            with wave.open(str(source), 'rb') as audio:
                params = (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype())
                if expected is None:
                    expected = params
                    output.setnchannels(params[0])
                    output.setsampwidth(params[1])
                    output.setframerate(params[2])
                if params != expected or params[3] != 'NONE':
                    raise ValueError('All voice segments must use identical uncompressed PCM parameters')
                count = audio.getnframes()
                seen = 0
                while block := audio.readframes(65536):
                    seen += len(block)
                    output.writeframesraw(block)
                if seen != count * params[0] * params[1]:
                    raise ValueError('Truncated voice segment')
                segments.append({'start_sample': cursor, 'end_sample': cursor + count,
                                 'start': cursor / params[2], 'end': (cursor + count) / params[2],
                                 'audio_sha256': file_digest(source)})
                cursor += count
    return segments
