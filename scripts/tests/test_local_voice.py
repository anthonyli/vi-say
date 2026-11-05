# Copyright 2026 Anthony Li
# SPDX-License-Identifier: Apache-2.0

import contextlib
from dataclasses import replace
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch, MagicMock
import wave

import numpy as np


MODULE_PATH = Path(__file__).resolve().parents[1] / "local_voice.py"
SPEC = importlib.util.spec_from_file_location("local_voice", MODULE_PATH)
voice = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = voice
SPEC.loader.exec_module(voice)


def write_wav(path, frames=100):
    with wave.open(str(path), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(24000)
        audio.writeframes(b"\x01\x00" * frames)


class LocalVoiceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.voice_dir = self.root / "private" / "voice"
        self.voice_dir.mkdir(parents=True)
        self.model = self.root / "private" / "models" / "base"
        self.model.mkdir(parents=True)
        (self.model / "config.json").write_text("{}")
        (self.model / "model.safetensors").write_bytes(b"fixture, never loaded")
        write_wav(self.voice_dir / "reference.wav")
        (self.voice_dir / "reference.txt").write_text("private reference transcript", encoding="utf-8")
        self.text = self.root / "narration.txt"
        self.text.write_text("complete narration in one paragraph", encoding="utf-8")
        self.output = self.root / "work" / "raw.wav"
        self.config_path = self.voice_dir / "voice-preferences.json"
        self.config = {
            "backend": "local", "reference_audio": "reference.wav",
            "reference_text_file": "reference.txt", "preferred_voice": {"model": "../models/base"},
            "consent": {"authorized": True, "speaker": "self", "scope": "local_narration"},
        }
        self.save_config()

    def save_config(self):
        self.config_path.write_text(json.dumps(self.config), encoding="utf-8")

    def plan(self, **kwargs):
        return voice.prepare_plan(self.config_path, self.text, self.output, **kwargs)

    def test_cpu_backend_rejects_missing_process_optout(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "before starting Python"):
                voice.load_cpu_backend()

    def test_cpu_backend_disables_onnx_telemetry_before_model_load(self):
        ort = MagicMock()
        torch = MagicMock()
        qwen = MagicMock()
        with patch.dict(os.environ, {"ORT_DISABLE_TELEMETRY": "1"}), patch.dict(sys.modules, {"onnxruntime": ort, "torch": torch,
                                      "soundfile": MagicMock(), "qwen_tts": qwen}):
            load, generate = voice.load_cpu_backend()
            ort.disable_telemetry_events.assert_called_once_with()
            qwen.Qwen3TTSModel.from_pretrained.assert_not_called()
            load("/existing/local/model")
            self.assertTrue(qwen.Qwen3TTSModel.from_pretrained.call_args.kwargs["local_files_only"])

    def test_explicit_cpu_engine_and_unknown_engine_rejected(self):
        self.config["engine"] = "qwen-pytorch-cpu"
        self.save_config()
        self.assertEqual(self.plan().engine, "qwen-pytorch-cpu")
        self.config["engine"] = "remote-api"
        self.save_config()
        with self.assertRaisesRegex(ValueError, "engine must"):
            self.plan()

    def test_cpu_check_only_does_not_import_cpu_backend(self):
        self.config["engine"] = "qwen-pytorch-cpu"
        self.save_config()
        with patch.object(voice, "load_cpu_backend", side_effect=AssertionError("must not import")), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(voice.main(["--config", str(self.config_path), "--text", str(self.text), "--output", str(self.output), "--check-only"]), 0)
        self.assertFalse(self.output.parent.exists())

    def test_resolves_config_paths_independently_of_working_directory(self):
        plan = self.plan()
        self.assertEqual(plan.model, self.model.resolve())
        self.assertEqual(plan.reference_audio, (self.voice_dir / "reference.wav").resolve())
        self.assertNotIn("private reference transcript", repr(plan))

    def test_check_only_does_not_import_backend_or_create_outputs(self):
        with patch.object(voice, "load_backend", side_effect=AssertionError("must not import")), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            result = voice.main(["--config", str(self.config_path), "--text", str(self.text),
                                 "--output", str(self.output), "--check-only"])
        self.assertEqual(result, 0)
        self.assertFalse(self.output.parent.exists())
        self.assertFalse(json.loads(output.getvalue())["audio_generated"])

    def test_generated_audio_and_logs_cannot_enter_private_storage(self):
        for relative in ["episode/raw.wav", "voice/new.wav", "models/new.wav"]:
            self.output = self.root / "private" / relative
            with self.subTest(relative=relative), self.assertRaisesRegex(ValueError, "reserved for models"):
                self.plan()
            self.assertFalse(self.output.exists())
        self.output = self.root / "work" / "raw.wav"
        with self.assertRaisesRegex(ValueError, "reserved for models"):
            self.plan(log_path=self.root / "private" / "episode" / "raw.log")
        self.assertFalse((self.root / "private" / "episode").exists())

    def test_work_alias_into_private_storage_is_rejected(self):
        alias = self.root / "work-alias"
        alias.symlink_to(self.root / "private", target_is_directory=True)
        self.output = alias / "episode" / "raw.wav"
        with self.assertRaisesRegex(ValueError, "reserved for models"):
            self.plan()

    def test_symlinked_private_store_is_protected_through_other_aliases(self):
        store = self.root / "resource-store"
        (self.root / "private").rename(store)
        (self.root / "private").symlink_to(store, target_is_directory=True)
        self.output = store / "episode" / "raw.wav"
        with self.assertRaisesRegex(ValueError, "reserved for models"):
            self.plan()

    def test_synthesis_rechecks_a_redirected_output_before_backend_import(self):
        plan = self.plan()
        redirected = replace(plan, output=self.root / "private" / "episode" / "raw.wav")
        with patch.object(voice, "load_backend", side_effect=AssertionError("must not import")), \
                self.assertRaisesRegex(ValueError, "reserved for models"):
            voice.synthesize(redirected)
        self.assertFalse(redirected.output.parent.exists())

    def test_macos_system_private_directory_is_not_a_project_store(self):
        path = Path("/private/var/tmp/voice-episode/work/raw.wav")
        self.assertEqual(voice.require_generated_path(path), path)

    def test_rejects_cloud_and_unrecorded_consent(self):
        self.config["backend"] = "cloud"
        self.save_config()
        with self.assertRaisesRegex(ValueError, "no cloud fallback"):
            self.plan()
        self.config["backend"] = "local"
        for consent in [{}, {"authorized": "true", "speaker": "self", "scope": "local_narration"},
                        {"authorized": True, "speaker": "reference_style", "scope": "local_narration"}]:
            self.config["consent"] = consent
            self.save_config()
            with self.assertRaisesRegex(ValueError, "actual consent"):
                self.plan()

    def test_rejects_remote_absolute_tilde_or_missing_model(self):
        for model in ["https://example.invalid/model", "hf://org/model", "~/models/base", "/models/base", "org/missing"]:
            self.config["preferred_voice"]["model"] = model
            self.save_config()
            with self.assertRaises(ValueError):
                self.plan()

    def test_rejects_missing_reference_and_blank_texts(self):
        self.config["reference_audio"] = "absent.wav"
        self.save_config()
        with self.assertRaisesRegex(ValueError, "existing nonempty"):
            self.plan()
        self.config["reference_audio"] = "reference.wav"
        self.save_config()
        for path in [self.text, self.voice_dir / "reference.txt"]:
            previous = path.read_text()
            path.write_text(" \n")
            with self.assertRaisesRegex(ValueError, "blank"):
                self.plan()
            path.write_text(previous)

    def test_preserves_old_output_before_backend_import(self):
        self.output.parent.mkdir()
        self.output.write_bytes(b"old output")
        with self.assertRaises(FileExistsError):
            self.plan()
        self.assertEqual(self.output.read_bytes(), b"old output")

    def test_forces_offline_before_import_and_makes_one_continuous_call(self):
        calls = []
        def load_backend():
            self.assertEqual(os.environ["HF_HUB_OFFLINE"], "1")
            self.assertEqual(os.environ["TRANSFORMERS_OFFLINE"], "1")
            def load_model(path):
                self.assertEqual(path, str(self.model.resolve()))
                return "loaded-local-model"
            def generate(**kwargs):
                calls.append(kwargs)
                print(kwargs["ref_text"])
                print(kwargs["text"])
                write_wav(Path(kwargs["file_prefix"] + ".wav"))
            return load_model, generate
        with patch.dict(os.environ, {"HF_HUB_OFFLINE": "0", "TRANSFORMERS_OFFLINE": "0"}), \
                patch.object(voice, "load_backend", side_effect=load_backend), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            result = voice.synthesize(self.plan())
        self.assertEqual(output.getvalue(), "")
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0]["join_audio"])
        self.assertIsNone(calls[0]["stt_model"])
        self.assertIsNone(calls[0]["voice"])
        self.assertEqual(calls[0]["speed"], 1.0)
        self.assertFalse(result["quality_assessed"])
        self.assertEqual(voice.wav_info(self.output)["frames"], 100)

    def test_upstream_swallowed_error_is_not_success(self):
        with patch.object(voice, "load_backend", return_value=(lambda _: object(), lambda **_: None)):
            with self.assertRaisesRegex(RuntimeError, "produced no WAV"):
                voice.synthesize(self.plan())
        self.assertFalse(self.output.exists())

    def test_bad_or_truncated_generated_wav_is_not_published(self):
        for data in [b"not audio", b"RIFF"]:
            def generate(**kwargs):
                Path(kwargs["file_prefix"] + ".wav").write_bytes(data)
            with patch.object(voice, "load_backend", return_value=(lambda _: object(), generate)):
                with self.assertRaises(ValueError):
                    voice.synthesize(self.plan())
            self.assertFalse(self.output.exists())
        sample = self.root / "truncated.wav"
        write_wav(sample)
        sample.write_bytes(sample.read_bytes()[:-10])
        with self.assertRaisesRegex(ValueError, "truncated"):
            voice.wav_info(sample)

    def test_concurrent_output_is_preserved(self):
        def generate(**kwargs):
            write_wav(Path(kwargs["file_prefix"] + ".wav"))
            self.output.write_bytes(b"concurrent writer")
        with patch.object(voice, "load_backend", return_value=(lambda _: object(), generate)):
            with self.assertRaises(FileExistsError):
                voice.synthesize(self.plan())
        self.assertEqual(self.output.read_bytes(), b"concurrent writer")

    def test_backend_exception_does_not_echo_private_text(self):
        def load_backend():
            raise RuntimeError("private reference transcript")
        with patch.object(voice, "load_backend", side_effect=load_backend):
            with self.assertRaises(RuntimeError) as caught:
                voice.synthesize(self.plan())
        self.assertNotIn("private reference transcript", str(caught.exception))

    def test_private_log_is_opt_in_exclusive_and_restrictive(self):
        log = self.root / "work" / "raw.log"
        def generate(**kwargs):
            print("private diagnostics")
            write_wav(Path(kwargs["file_prefix"] + ".wav"))
        with patch.object(voice, "load_backend", return_value=(lambda _: object(), generate)):
            voice.synthesize(self.plan(log_path=log))
        self.assertIn("private diagnostics", log.read_text())
        if os.name == "posix":
            self.assertEqual(log.stat().st_mode & 0o777, 0o600)
        self.output.unlink()
        with self.assertRaises(FileExistsError):
            self.plan(log_path=log)


class FakeQwenTokenizer:
    has_encoder = True
    decode_upsample_rate = 1920

    def __init__(self):
        self.original_calls = 0
        self.batch_inputs = []

    def waveform(self, codes):
        samples = codes.shape[1] * self.decode_upsample_rate
        return np.arange(codes.shape[0] * samples, dtype=np.float32).reshape(codes.shape[0], samples)

    def decode(self, codes):
        self.original_calls += 1
        # Reproduce the installed 0.5.7 bug; the vocoder itself returns all data.
        return self.waveform(codes), (codes[..., 0] > 0).sum(axis=1) * self.decode_upsample_rate

    def batch_decode(self, codes_list):
        self.batch_inputs.append(codes_list)
        return ([self.waveform(c)[0] for c in codes_list],
                [c.shape[1] * self.decode_upsample_rate for c in codes_list])


class QwenIclDecodeCompatibilityTests(unittest.TestCase):
    def model(self):
        return SimpleNamespace(model_type="qwen3_tts", config=SimpleNamespace(tts_model_type="base"),
                               speech_tokenizer=FakeQwenTokenizer())

    def kwargs(self, model):
        return {"model": model, "text": "完整语义段落", "ref_audio": "local-reference.wav",
                "ref_text": "准确参考转写", "voice": None, "stt_model": None,
                "stream": False, "join_audio": True, "speed": 1.0}

    def run_fixed(self, generate, kwargs, version="0.5.7"):
        return voice._generate_mlx_with_qwen_057_decode_fix(
            generate, kwargs, backend_version=version, make_array=np.array)

    def test_valid_zero_codes_preserve_all_samples_and_the_icl_reference_cut(self):
        model = self.model()
        # The first two frames are reference; both zeros are generated speech,
        # not trailing batch padding. The old rule retains reference and loses tail.
        codes = np.array([[[2, 8], [3, 7], [0, 6], [4, 5], [0, 4], [5, 3]]], dtype=np.int32)
        unchanged = codes.copy()
        vocoder_wave = model.speech_tokenizer.waveform(codes)
        observed = {}
        def generate(**kwargs):
            audio, lengths = kwargs["model"].speech_tokenizer.decode(codes)
            observed.update(audio=audio, lengths=lengths)
            valid = audio[0, :int(lengths[0])]
            return valid[int(2 / codes.shape[1] * valid.shape[0]):]
        result = self.run_fixed(generate, self.kwargs(model))
        expected_length = codes.shape[1] * 1920
        self.assertEqual(observed["audio"].shape, (1, expected_length))
        self.assertEqual(observed["lengths"].shape, (1,))
        self.assertEqual(int(observed["lengths"][0]), expected_length)
        np.testing.assert_array_equal(observed["audio"], vocoder_wave)
        np.testing.assert_array_equal(result, vocoder_wave[0, 2 * 1920:])
        np.testing.assert_array_equal(codes, unchanged)
        self.assertIs(model.speech_tokenizer.batch_inputs[0][0], codes)
        self.assertEqual(model.speech_tokenizer.original_calls, 0)
        self.assertNotIn("decode", vars(model.speech_tokenizer))

    def test_single_unpadded_sequence_can_end_with_a_valid_zero_code(self):
        model = self.model()
        codes = np.array([[[1], [2], [0]]], dtype=np.int32)
        audio, lengths = self.run_fixed(lambda **k: k["model"].speech_tokenizer.decode(codes), self.kwargs(model))
        self.assertEqual(int(lengths[0]), 3 * 1920)
        np.testing.assert_array_equal(audio, model.speech_tokenizer.waveform(codes))

    def test_other_versions_models_and_non_icl_calls_keep_native_behavior(self):
        cases = [
            ("future version", "0.5.8", {}, {}),
            ("unknown version", None, {}, {}),
            ("other model", "0.5.7", {"model_type": "other-tts"}, {}),
            ("custom voice", "0.5.7", {"config": SimpleNamespace(tts_model_type="custom_voice")}, {}),
            ("batched text", "0.5.7", {}, {"text": ["one", "two"]}),
            ("no transcript", "0.5.7", {}, {"ref_text": None}),
            ("no reference", "0.5.7", {}, {"ref_audio": None}),
            ("streaming", "0.5.7", {}, {"stream": True}),
            ("outside local joined call", "0.5.7", {}, {"join_audio": False}),
        ]
        for label, version, model_fields, call_fields in cases:
            with self.subTest(label=label):
                model = self.model()
                for key, value in model_fields.items():
                    setattr(model, key, value)
                kwargs = self.kwargs(model)
                kwargs.update(call_fields)
                codes = np.array([[[1], [0], [2]]], dtype=np.int32)
                audio, lengths = self.run_fixed(lambda **k: k["model"].speech_tokenizer.decode(codes), kwargs, version)
                self.assertEqual(int(lengths[0]), 2 * 1920)
                np.testing.assert_array_equal(audio, model.speech_tokenizer.waveform(codes))
                self.assertEqual(model.speech_tokenizer.batch_inputs, [])
                self.assertEqual(model.speech_tokenizer.original_calls, 1)

    def test_real_padded_multi_sample_decode_is_not_reinterpreted(self):
        model = self.model()
        codes = np.array([[[1], [2], [0], [0]], [[3], [4], [5], [0]]], dtype=np.int32)
        audio, lengths = self.run_fixed(lambda **k: k["model"].speech_tokenizer.decode(codes), self.kwargs(model))
        np.testing.assert_array_equal(lengths, [2 * 1920, 3 * 1920])
        np.testing.assert_array_equal(audio, model.speech_tokenizer.waveform(codes))
        self.assertEqual(model.speech_tokenizer.batch_inputs, [])
        self.assertEqual(model.speech_tokenizer.original_calls, 1)
        # Outside the local ICL call, even single-row padded data retains native
        # length handling; the compatibility path is not installed permanently.
        _, single_lengths = model.speech_tokenizer.decode(codes[:1])
        np.testing.assert_array_equal(single_lengths, [2 * 1920])

    def test_failed_correct_decoder_raises_without_fallback_and_restores_method(self):
        model = self.model()
        codes = np.array([[[1], [0], [2]]], dtype=np.int32)
        model.speech_tokenizer.batch_decode = MagicMock(side_effect=RuntimeError("decoder failed"))
        with self.assertRaisesRegex(RuntimeError, "decoder failed"):
            self.run_fixed(lambda **k: k["model"].speech_tokenizer.decode(codes), self.kwargs(model))
        self.assertEqual(model.speech_tokenizer.original_calls, 0)
        self.assertNotIn("decode", vars(model.speech_tokenizer))

    def test_incomplete_correct_decoder_output_is_rejected_instead_of_truncated(self):
        for bad_lengths in (True, False):
            with self.subTest(bad_lengths=bad_lengths):
                model = self.model()
                codes = np.array([[[1], [0], [2]]], dtype=np.int32)
                expected = 3 * 1920
                model.speech_tokenizer.batch_decode = MagicMock(return_value=(
                    [np.arange(expected if bad_lengths else expected - 1)], [expected - 1 if bad_lengths else expected]))
                with self.assertRaisesRegex(RuntimeError, "complete codec sequence|incomplete waveform"):
                    self.run_fixed(lambda **k: k["model"].speech_tokenizer.decode(codes), self.kwargs(model))
                self.assertEqual(model.speech_tokenizer.original_calls, 0)
                self.assertNotIn("decode", vars(model.speech_tokenizer))

    def test_existing_instance_decode_override_is_restored_exactly(self):
        model = self.model()
        original = MagicMock(return_value="existing decoder")
        model.speech_tokenizer.decode = original
        codes = np.array([[[1], [0], [2]]], dtype=np.int32)
        self.run_fixed(lambda **k: k["model"].speech_tokenizer.decode(codes), self.kwargs(model))
        self.assertIs(model.speech_tokenizer.decode, original)
        original.assert_not_called()

    def test_load_backend_wires_the_version_scoped_fix_without_loading_a_model(self):
        model = self.model()
        codes = np.array([[[1], [0], [2]]], dtype=np.int32)
        load = MagicMock(return_value=model)
        generate = lambda **k: k["model"].speech_tokenizer.decode(codes)
        modules = {
            "mlx_audio.tts.generate": SimpleNamespace(generate_audio=generate),
            "mlx_audio.tts.utils": SimpleNamespace(load_model=load),
            "mlx": SimpleNamespace(core=SimpleNamespace(array=np.array)),
        }
        with patch.dict(sys.modules, modules), patch.object(voice, "package_version", return_value="0.5.7"):
            backend_load, backend_generate = voice.load_backend()
            load.assert_not_called()
            self.assertIs(backend_load("local-model"), model)
            audio, lengths = backend_generate(**self.kwargs(model))
        self.assertEqual(int(lengths[0]), 3 * 1920)
        np.testing.assert_array_equal(audio, model.speech_tokenizer.waveform(codes))


if __name__ == "__main__":
    unittest.main()
