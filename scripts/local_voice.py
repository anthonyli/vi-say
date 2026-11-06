#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Generate a continuous narration with an explicitly authorized local voice."""
from __future__ import annotations

import argparse
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import dataclass, field
from importlib.metadata import PackageNotFoundError, version as package_version
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile
import traceback
import wave

from voice_consistency import (file_digest, join_pcm, reference_identity, semantic_segments,
                               set_generation_seed, validate_lock)


@dataclass(frozen=True)
class VoicePlan:
    model: Path
    reference_audio: Path
    text: str = field(repr=False)
    reference_text: str = field(repr=False)
    output: Path
    language: str = "Chinese"
    max_tokens: int = 4096
    log: Path | None = None
    engine: str = "mlx"
    mode: str = "continuous"
    segment_chars: int = 120
    seed: int | None = None
    temperature: float = 0.7
    top_p: float = 1.0
    top_k: int = 50
    identity: dict = field(default_factory=dict, repr=False)
    voice_id: str | None = None
    reference_text_path: Path | None = field(default=None, repr=False)


def local_path(value, base, label):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a nonempty relative local path")
    if value.startswith(("~", "//", "\\\\")) or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", value):
        raise ValueError(f"{label} must be a relative local path, without a URL or ~")
    candidate = Path(value)
    if candidate.is_absolute():
        raise ValueError(f"{label} must be relative to the voice configuration")
    return (base / candidate).resolve()


def require_file(path, label):
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError(f"{label} must be an existing nonempty file")


def read_text(path, label):
    require_file(path, label)
    value = path.read_text(encoding="utf-8").strip()
    if not value:
        raise ValueError(f"{label} must not be blank")
    return value


def default_voice_config(voice_root='private/voice'):
    root = Path(voice_root).resolve()
    fixed = root / 'fixed-voice.json'
    if fixed.exists() or fixed.is_symlink():
        from select_voice import select_voice
        return Path(select_voice(root, fixed, 'default')['config'])
    return root / 'voice-preferences.json'


def require_generated_path(path, *, sources=()):
    """Keep synthesis artifacts out of private model/reference storage."""
    candidate = Path(path).absolute()
    roots = {Path.cwd() / "private", Path(__file__).resolve().parents[1] / "private"}
    # Include both lexical and resolved paths to cover symlinked private stores.
    # macOS /private is an OS directory, not a project resource directory.
    for source in (candidate, *sources):
        source = Path(source).absolute()
        for variant in (source, source.resolve()):
            roots.update(parent for parent in variant.parents
                         if parent.name == "private" and parent.parent != Path(parent.anchor))
    resolved = candidate.resolve()
    if any(resolved.is_relative_to(root.resolve()) for root in roots):
        raise ValueError("private/ is reserved for models and voice references; "
                         "write generated audio and logs to work/<project>/ or outputs/<project>/")
    return candidate


def wav_info(path):
    """Read every PCM frame; a valid header alone does not prove a complete WAV."""
    require_file(path, "WAV")
    try:
        with wave.open(str(path), "rb") as audio:
            frames = audio.getnframes()
            channels = audio.getnchannels()
            rate = audio.getframerate()
            if frames <= 0 or rate <= 0 or audio.getcomptype() != "NONE":
                raise ValueError("WAV must contain nonempty PCM audio")
            expected = frames * channels * audio.getsampwidth()
            observed = 0
            while block := audio.readframes(65536):
                observed += len(block)
            if observed != expected:
                raise ValueError("WAV sample data is truncated")
            return {"frames": frames, "sample_rate": rate, "channels": channels,
                    "duration_seconds": frames / rate}
    except (wave.Error, EOFError) as error:
        raise ValueError("WAV is not a readable PCM file") from error


def prepare_plan(config_path, text_path, output_path, *, language="Chinese", max_tokens=4096, log_path=None,
                 mode=None, segment_chars=None, seed=None, temperature=None, top_p=None, top_k=None):
    config_source = Path(config_path).absolute()
    config_path = Path(config_path).resolve()
    require_file(config_path, "voice configuration")
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeError) as error:
        raise ValueError("voice configuration must be UTF-8 JSON") from error
    if not isinstance(config, dict):
        raise ValueError("voice configuration must be a JSON object")
    if config.get("backend", "local") != "local":
        raise ValueError("Only backend=local is supported; there is no cloud fallback")
    consent = config.get("consent", {})
    if not isinstance(consent, dict) or consent.get("authorized") is not True or \
            consent.get("speaker") not in {"self", "authorized_speaker"} or \
            consent.get("scope") != "local_narration":
        raise ValueError("Record actual consent for self/authorized_speaker local_narration before synthesis")
    preferred = config.get("preferred_voice")
    if not isinstance(preferred, dict):
        raise ValueError("preferred_voice.model must name the local model directory")
    base = config_path.parent
    model = local_path(preferred.get("model"), base, "preferred_voice.model")
    if not model.is_dir():
        raise ValueError("Local model directory is missing; this script never downloads models")
    require_file(model / "config.json", "model config.json")
    if not any(p.is_file() and p.stat().st_size > 0 for p in model.glob("*.safetensors")):
        raise ValueError("Local model directory has no nonempty safetensors weights")
    reference = local_path(config.get("reference_audio"), base, "reference_audio")
    wav_info(reference)
    reference_text_path = local_path(config.get("reference_text_file"), base, "reference_text_file")
    reference_text = read_text(reference_text_path, "reference transcription")
    text = read_text(Path(text_path).resolve(), "narration text")
    sources = (config_source, model, reference)
    output = require_generated_path(output_path, sources=sources)
    if output.suffix.lower() != ".wav":
        raise ValueError("Output must use the .wav extension")
    if output.exists() or output.is_symlink():
        raise FileExistsError("Output already exists; choose a new filename to preserve it")
    if not isinstance(language, str) or not language.strip():
        raise ValueError("language must be nonempty")
    if isinstance(max_tokens, bool) or not isinstance(max_tokens, int) or max_tokens <= 0:
        raise ValueError("max_tokens must be a positive integer")
    log = require_generated_path(log_path, sources=sources) if log_path else None
    if log and (log.resolve() == output.resolve() or log.exists() or log.is_symlink()):
        raise FileExistsError("Log must use a new path distinct from the output")
    engine = config.get("engine", "mlx")
    if engine not in {"mlx", "qwen-pytorch-cpu"}:
        raise ValueError("engine must be mlx or qwen-pytorch-cpu")
    generation = config.get('generation', {})
    if not isinstance(generation, dict):
        raise ValueError('generation must be an object')
    def option(name, override, default):
        return generation.get(name, default) if override is None else override
    mode = option('mode', mode, 'continuous')
    segment_chars = option('segment_chars', segment_chars, 120)
    seed = option('seed', seed, None)
    temperature = option('temperature', temperature, .7)
    top_p = option('top_p', top_p, 1.0)
    top_k = option('top_k', top_k, 50)
    if mode not in {'continuous', 'anchored'}:
        raise ValueError('mode must be continuous or anchored')
    if seed is not None and (isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed < 2**32):
        raise ValueError('seed must be an integer from 0 to 2**32-1')
    if (isinstance(temperature, bool) or not isinstance(temperature, (int, float))
            or not math.isfinite(temperature) or not 0 <= temperature <= 2):
        raise ValueError('temperature must be a finite number from 0 to 2')
    if isinstance(top_p, bool) or not isinstance(top_p, (int, float)) or not 0 < top_p <= 1:
        raise ValueError('top_p must be a number in (0, 1]')
    if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 0:
        raise ValueError('top_k must be a nonnegative integer')
    if mode == 'anchored':
        semantic_segments(text, segment_chars)
    identity = reference_identity(model, reference, reference_text)
    voice_id = validate_lock(config.get('voice_lock'), identity)
    return VoicePlan(model, reference, text, reference_text, output, language, max_tokens, log, engine,
                     mode, segment_chars, seed, temperature, top_p, top_k, identity, voice_id, reference_text_path)


def _generate_mlx_with_qwen_057_decode_fix(generate_audio, kwargs, *, backend_version, make_array):
    """Correct only the known unpadded, single-utterance Qwen ICL decode path.

    mlx-audio 0.5.7 counts positive codebook-0 values as valid frames, although
    zero is a legitimate codec value. Its variable-length batch decoder instead
    uses the actual sequence length. This local non-streaming ICL call creates
    [1, reference_frames + generated_frames, Q] without padding, so decoding it
    as one variable-length sequence preserves both the reference cut and tail.
    """
    model = kwargs.get("model")
    tokenizer = getattr(model, "speech_tokenizer", None)
    eligible = (
        backend_version == "0.5.7"
        and getattr(model, "model_type", None) == "qwen3_tts"
        and getattr(getattr(model, "config", None), "tts_model_type", None) == "base"
        and getattr(tokenizer, "has_encoder", False) is True
        and isinstance(kwargs.get("text"), str)
        and isinstance(kwargs.get("ref_audio"), str) and bool(kwargs["ref_audio"])
        and isinstance(kwargs.get("ref_text"), str) and bool(kwargs["ref_text"].strip())
        and kwargs.get("voice") is None and kwargs.get("stt_model") is None
        and kwargs.get("stream", False) is False and kwargs.get("join_audio") is True
    )
    if not eligible:
        return generate_audio(**kwargs)
    original_decode = getattr(tokenizer, "decode", None)
    batch_decode = getattr(tokenizer, "batch_decode", None)
    if not callable(original_decode) or not callable(batch_decode) or not callable(make_array):
        raise RuntimeError("Qwen3 ICL length-correct decoder is unavailable; refusing the known-bad decode path")
    owned_decode = "decode" in vars(tokenizer)
    previous_decode = vars(tokenizer).get("decode")

    def decode_single_unpadded(audio_codes, *args, **decode_kwargs):
        shape = tuple(getattr(audio_codes, "shape", ()))
        # Real padded batches and other decode interfaces keep their own logic.
        # Do not infer padding from code values: code 0 is valid speech data.
        if args or decode_kwargs or len(shape) != 3 or shape[0] != 1:
            return original_decode(audio_codes, *args, **decode_kwargs)
        rate = getattr(tokenizer, "decode_upsample_rate", None)
        if shape[1] <= 0 or shape[2] <= 0 or not isinstance(rate, int) or rate <= 0:
            raise RuntimeError("Invalid single-sequence Qwen3 ICL decoder shape or upsample rate")
        expected = shape[1] * rate
        audios, lengths = batch_decode([audio_codes])
        if len(audios) != 1 or len(lengths) != 1 or int(lengths[0]) != expected:
            raise RuntimeError("Qwen3 ICL batch decoder did not preserve the complete codec sequence")
        audio = audios[0]
        if tuple(getattr(audio, "shape", ())) != (expected,):
            raise RuntimeError("Qwen3 ICL decoder returned an incomplete waveform")
        return audio[None, :], make_array([expected])

    tokenizer.decode = decode_single_unpadded
    try:
        return generate_audio(**kwargs)
    finally:
        if owned_decode:
            tokenizer.decode = previous_decode
        else:
            delattr(tokenizer, "decode")


def load_backend():
    # Imported only after offline mode is set; --check-only never imports MLX.
    from mlx_audio.tts.generate import generate_audio
    from mlx_audio.tts.utils import load_model
    try:
        backend_version = package_version("mlx-audio")
    except PackageNotFoundError:
        backend_version = None
    # MLX stays a synthesis-only import. Unknown/future versions retain their
    # native decoder and do not receive this version-specific compatibility fix.
    make_array = None
    if backend_version == "0.5.7":
        from mlx import core as mx
        make_array = mx.array
    def generate_local(**kwargs):
        return _generate_mlx_with_qwen_057_decode_fix(
            generate_audio, kwargs, backend_version=backend_version, make_array=make_array)
    return load_model, generate_local


def load_cpu_backend():
    """Official Qwen PyTorch model, offline CPU only; no network/service fallback."""
    if os.environ.get("ORT_DISABLE_TELEMETRY") != "1":
        raise RuntimeError("Use run_cpu_voice.sh: ORT_DISABLE_TELEMETRY=1 must be set before starting Python")
    import torch
    import soundfile as sf
    import onnxruntime
    onnxruntime.disable_telemetry_events()
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(4)
    def load_model(path):
        return Qwen3TTSModel.from_pretrained(path, device_map="cpu", dtype=torch.float32,
                                           attn_implementation="eager", local_files_only=True)
    def generate_audio(**kwargs):
        wavs, rate = kwargs["model"].generate_voice_clone(
            text=kwargs["text"], language=kwargs["lang_code"],
            ref_audio=kwargs["ref_audio"], ref_text=kwargs["ref_text"],
            max_new_tokens=kwargs["max_tokens"], temperature=kwargs["temperature"],
            top_p=kwargs["top_p"], top_k=kwargs["top_k"])
        sf.write(kwargs["file_prefix"] + ".wav", wavs[0], rate, subtype="PCM_16")
    return load_model, generate_audio


def check_source_identity(plan):
    reference_text = read_text(plan.reference_text_path, 'reference transcription') if plan.reference_text_path else plan.reference_text
    actual = reference_identity(plan.model, plan.reference_audio, reference_text)
    if actual != plan.identity:
        raise ValueError('Voice reference/transcript/model changed after planning; refusing synthesis')


def synthesize(plan):
    report_path = plan.output.with_suffix('.generation.json')
    for path in (plan.output, plan.log):
        if path is not None:
            require_generated_path(path, sources=(plan.model, plan.reference_audio))
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    if (plan.output.exists() or plan.output.is_symlink()
            or report_path.exists() or report_path.is_symlink()):
        raise FileExistsError("Output already exists; choose a new filename to preserve it")
    check_source_identity(plan)
    parts = semantic_segments(plan.text, plan.segment_chars) if plan.mode == 'anchored' else [plan.text]
    plan.output.parent.mkdir(parents=True, exist_ok=True)
    if plan.log:
        plan.log.parent.mkdir(parents=True, exist_ok=True)
        # Upstream may print narration even with verbose=False. Logs are opt-in.
        descriptor = os.open(plan.log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        diagnostics = os.fdopen(descriptor, "w", encoding="utf-8")
    else:
        diagnostics = open(os.devnull, "w", encoding="utf-8")
    with diagnostics, tempfile.TemporaryDirectory(prefix=".local-voice-", dir=plan.output.parent) as temporary:
        generated = Path(temporary) / "narration.wav"
        try:
            with redirect_stdout(diagnostics), redirect_stderr(diagnostics):
                try:
                    load_model, generate_audio = load_cpu_backend() if plan.engine == "qwen-pytorch-cpu" else load_backend()
                    model = load_model(str(plan.model))
                    sources, segment_details = [], []
                    for index, text in enumerate(parts):
                        print(f'VOICE_SEGMENT {index + 1}/{len(parts)} START chars={len(text)}', flush=True)
                        check_source_identity(plan)
                        set_generation_seed(plan.engine, plan.seed)
                        segment = Path(temporary) / f'part-{index + 1:03}.wav'
                        cap = min(plan.max_tokens, max(256, len(text) * 6)) if plan.mode == 'anchored' else plan.max_tokens
                        generate_audio(model=model, text=text,
                                       ref_audio=str(plan.reference_audio), ref_text=plan.reference_text,
                                       lang_code=plan.language, max_tokens=cap,
                                       temperature=plan.temperature, top_p=plan.top_p, top_k=plan.top_k,
                                       voice=None, stt_model=None, speed=1.0,
                                       file_prefix=str(segment.with_suffix("")), audio_format="wav",
                                       join_audio=True, play=False, stream=False, verbose=False)
                        if not segment.is_file():
                            raise RuntimeError('Local backend produced no WAV')
                        wav_info(segment)
                        print(f'VOICE_SEGMENT {index + 1}/{len(parts)} DONE', flush=True)
                        sources.append(segment)
                        segment_details.append({'index': index + 1, 'text_sha256': hashlib.sha256(text.encode()).hexdigest(),
                                                'max_tokens': cap, 'seed': plan.seed})
                    ranges = join_pcm(sources, generated)
                    check_source_identity(plan)
                except Exception:
                    traceback.print_exc()
                    raise
        except Exception as error:
            message = 'Local backend produced no WAV' if isinstance(error, RuntimeError) and str(error) == 'Local backend produced no WAV' else f'Local voice execution failed ({type(error).__name__}); check the local environment'
            if isinstance(error, ValueError) and str(error) in {'WAV is not a readable PCM file', 'WAV must contain nonempty PCM audio', 'WAV sample data is truncated'}:
                raise ValueError(str(error)) from None
            raise RuntimeError(message
                               + (" and the private log" if plan.log else "")) from None
        # generate_audio in mlx-audio 0.5.7 can catch errors internally and return.
        if not generated.is_file():
            raise RuntimeError("Local backend produced no WAV; check dependencies/model resources"
                               + (" in the private log" if plan.log else "; use --log for private diagnostics"))
        info = wav_info(generated)
        try:
            backend_version = package_version('mlx-audio' if plan.engine == 'mlx' else 'qwen-tts')
        except PackageNotFoundError:
            backend_version = None
        result = {"output": str(plan.output), **info, "backend": "local", "engine": plan.engine, "offline": True,
                  'backend_version': backend_version,
                  'mode': plan.mode, 'voice_id': plan.voice_id, 'voice_identity': plan.identity,
                  'sampling': {'seed': plan.seed, 'temperature': plan.temperature, 'top_p': plan.top_p, 'top_k': plan.top_k},
                  'segments': [{**detail, **span} for detail, span in zip(segment_details, ranges)],
                  'audio_sha256': file_digest(generated),
                  "quality_assessed": False, 'voice_consistency_assessed': False,
                  "review_required": "Listen for identity, missing words, repetition, paragraph joins and a complete ending"}
        report = Path(temporary) / 'generation.json'
        report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        # The temporary file shares the output filesystem. link is exclusive,
        # unlike replace/rename, so a concurrent writer's output is preserved.
        os.link(report, report_path)
        try:
            os.link(generated, plan.output)
        except BaseException:
            report_path.unlink()
            raise
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", help='Explicit profile override; otherwise use the pinned project voice when configured')
    parser.add_argument("--text", required=True, help="UTF-8 complete narration file; relative to the working directory")
    parser.add_argument("--output", required=True, help="New WAV in work/<project>/ or outputs/<project>/; private/ is reserved")
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--max-tokens", type=int, default=4096)
    parser.add_argument('--mode', choices=['continuous', 'anchored'], help='Use profile default, or explicitly select sentence-bounded reference-anchored generation')
    parser.add_argument('--segment-chars', type=int, help='Maximum characters per complete semantic segment')
    parser.add_argument('--seed', type=int, help='Reproducibility seed; does not certify speaker identity')
    parser.add_argument('--temperature', type=float)
    parser.add_argument('--top-p', type=float)
    parser.add_argument('--top-k', type=int)
    parser.add_argument("--log", help="Optional new log in work/<project>/; can contain narration and reference text")
    parser.add_argument("--check-only", action="store_true", help="Check configuration/local files without importing MLX or synthesizing")
    args = parser.parse_args(argv)
    try:
        plan = prepare_plan(args.config or default_voice_config(), args.text, args.output, language=args.language,
                            max_tokens=args.max_tokens, log_path=args.log, mode=args.mode,
                            segment_chars=args.segment_chars, seed=args.seed, temperature=args.temperature,
                            top_p=args.top_p, top_k=args.top_k)
        result = {"valid": True, "backend": "local", "model_loaded": False,
                  "audio_generated": False, "quality_assessed": False, 'voice_id': plan.voice_id,
                  'voice_identity': plan.identity, 'mode': plan.mode,
                  'segments': len(semantic_segments(plan.text, plan.segment_chars)) if plan.mode == 'anchored' else 1} if args.check_only else synthesize(plan)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ValueError, OSError, RuntimeError, UnicodeError) as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
