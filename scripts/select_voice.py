#!/usr/bin/env python3
# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

"""Choose an authorized project voice once, then reuse it for the whole episode."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import tempfile


def profile_state(config):
    config = config.resolve()
    data = json.loads(config.read_text(encoding="utf-8"))
    consent = data.get("consent", {})
    if (data.get("backend", "local") != "local" or consent.get("authorized") is not True
            or consent.get("speaker") not in {"self", "authorized_speaker"}
            or consent.get("scope") != "local_narration"):
        raise ValueError("Voice profile must have actual local narration authorization")
    assets = {"config": config}
    for field in ("reference_audio", "reference_text_file"):
        value = data.get(field)
        if not isinstance(value, str) or not value.strip() or Path(value).is_absolute() or value.startswith("~"):
            raise ValueError(f"{field} must be a relative local path")
        assets[field] = (config.parent / value).resolve()
    result = {}
    for key, path in assets.items():
        content = path.read_bytes()
        if not content:
            raise ValueError(f"Empty voice asset: {key}")
        result[key] = hashlib.sha256(content).hexdigest()
    return result


def select_voice(voice_root, output, requested="default"):
    root = Path(voice_root).resolve()
    output = Path(output).resolve()
    if requested == 'default':
        fixed = root / 'fixed-voice.json'
        if fixed.exists() or fixed.is_symlink():
            pinned = json.loads(fixed.read_text(encoding='utf-8'))
            name = pinned.get('voice')
            if not isinstance(name, str) or name in {'default', 'random', '', '.', '..'} or Path(name).name != name:
                raise ValueError('Invalid pinned project voice')
            selected = select_voice(root, fixed, name)
            requested = selected['voice']
        else:
            requested = 'random'
    if requested != "random" and (requested in {".", ".."} or Path(requested).name != requested):
        raise ValueError("Voice must be a profile directory name or random")

    def reuse():
        record = json.loads(output.read_text(encoding="utf-8"))
        name = record.get("voice")
        if not isinstance(name, str) or name in {".", ".."} or Path(name).name != name:
            raise ValueError("Invalid voice selection record")
        config = root / name / "voice-preferences.json"
        if record.get("schema_version") != 1 or (output.parent / record.get("config", "")).resolve() != config.resolve():
            raise ValueError("Selection belongs to another voice library")
        if requested != "random" and requested != name:
            raise ValueError("This episode already selected another voice; use a new selection file")
        if profile_state(config) != record.get("assets"):
            raise ValueError("Selected voice assets changed; review them and use a new selection file")
        return {"voice": name, "config": str(config.resolve()), "selection": str(output)}

    if output.exists() or output.is_symlink():
        return reuse()
    candidates = {}
    for directory in sorted(root.iterdir()):
        config = directory / "voice-preferences.json"
        if directory.is_dir() and config.is_file():
            try:
                candidates[directory.name] = (config, profile_state(config))
            except (ValueError, OSError, TypeError, AttributeError):
                continue
    if requested == "random":
        if not candidates:
            raise ValueError("No configured, authorized voices in this project")
        name = secrets.choice(list(candidates))
    else:
        name = requested
        if name not in candidates:
            raise ValueError("Requested voice is missing, incomplete, or not authorized")
    config, assets = candidates[name]
    record = {"schema_version": 1, "voice": name,
              "config": os.path.relpath(config, output.parent), "assets": assets}
    encoded = json.dumps(record, ensure_ascii=False, indent=2) + "\n"
    output.parent.mkdir(parents=True, exist_ok=True)
    # Publish a complete record exclusively; concurrent requests reuse the winner.
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent,
                                     prefix=".voice-selection-", delete=False) as stream:
        temporary = Path(stream.name)
        stream.write(encoded)
    try:
        try:
            os.link(temporary, output)
        except FileExistsError:
            pass
    finally:
        temporary.unlink()
    return reuse()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voice-root", default="private/voice")
    parser.add_argument("--voice", default="default", help="Pinned project default when configured; explicit profile name or random also supported")
    parser.add_argument("--output", required=True, help="One persistent selection file per episode")
    parser.add_argument("--print-config", action="store_true", help="Print only the selected configuration path")
    args = parser.parse_args(argv)
    try:
        result = select_voice(args.voice_root, args.output, args.voice)
    except (ValueError, OSError, TypeError, AttributeError) as error:
        parser.exit(1, f"{type(error).__name__}: {error}\n")
    print(result["config"] if args.print_config else json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
