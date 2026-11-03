# 本地配音后端

语言、音色与听感偏好由 [声音节点](../stages/voice.md) 维护。本页只说明配置、环境和合成接口；字幕接入见 [captions.md](../stages/captions.md)。工具不下载模型、不调用云端语音服务，也不自动切换音色。

## 选择后端

| 环境 | 配置 engine | 参考模型与依赖 |
|---|---|---|
| Apple Silicon Mac | mlx（默认） | mlx-audio 0.5.7、Qwen3-TTS Base 4-bit 本地目录 |
| Linux x86_64 CPU | qwen-pytorch-cpu | Python 3.12、匹配的 CPU PyTorch／torchaudio、官方 Qwen Base |

这些是当前实现的参考环境，不保证其他平台无需适配。模型、依赖和声音放在制作项目，不放技能分发目录。首次安装与下载按当前任务授权准备；已有资源优先复用。

## 授权声音与配置

在制作项目 `private/voice/` 保存清晰单人 PCM WAV、准确参考转写和 `voice-preferences.json`。配置路径相对配置文件解析；模型指向该项目已有目录。例如：

```json
{
  "backend": "local",
  "engine": "mlx",
  "reference_audio": "reference.wav",
  "reference_text_file": "reference.txt",
  "consent": {"authorized": false, "speaker": "self", "scope": "local_narration"},
  "preferred_voice": {"model": "../models/Qwen3-TTS-12Hz-1.7B-Base-4bit"}
}
```

`authorized: false` 是待填写示例，只有实际已有本人或声音权利人的授权才能据实设为 true。当前会话已有授权可直接记录，不重复询问。参考风格不等于声音复刻授权。模型目录须有配置与实际权重，参考文件须为完整 PCM WAV；不接受 URL、绝对路径或未展开的 `~`。

## Mac MLX

在制作项目准备隔离环境和本地权重：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install "mlx-audio==0.5.7" huggingface_hub
.venv/bin/hf download mlx-community/Qwen3-TTS-12Hz-1.7B-Base-4bit --local-dir private/models/Qwen3-TTS-12Hz-1.7B-Base-4bit
```

根据当前环境选择 Python 3.10+。权重及分词器、音频资源需完整下载；4-bit 不表示任意机器都能流畅合成长稿。示例中的模型路径相对 `private/voice/`，实际按自己的目录调整。

从制作项目调用已安装技能的脚本（`SKILL_DIR` 是实际技能目录）：

```sh
.venv/bin/python "$SKILL_DIR/scripts/local_voice.py" --text work/narration.txt --output work/raw-v1.wav --check-only
.venv/bin/python "$SKILL_DIR/scripts/local_voice.py" --text work/narration.txt --output work/raw-v1.wav
```

`--check-only` 不导入推理后端、不合成。正式合成前强制 HF／Transformers 离线，只传本地模型与显式参考转写，关闭自动 ASR、播放和流式输出；整稿一次交给上游，不按字幕切句。默认语言 Chinese、原速 1.0、max-tokens 4096，token 上限不证明全文已读完。

## Linux CPU

配置 engine 为 `qwen-pytorch-cpu`，模型指向官方 `Qwen/Qwen3-TTS-12Hz-0.6B-Base` 的完整本地目录（包含 `speech_tokenizer/`）。参考版本与来源在 [运行清单](../runtime/cloud-runtime-manifest.json)，额外依赖在 [requirements](../runtime/cloud-cpu-requirements.txt)。这些资源用于重建 CPU 参考环境，不参与每次推理。

以下从技能根目录运行，创建隔离环境；模型和声音仍放在制作项目：

```sh
python3.12 -m venv .venv-cloud-tts
.venv-cloud-tts/bin/python -m pip install torch==2.9.1+cpu torchaudio==2.9.1+cpu --index-url https://download.pytorch.org/whl/cpu
.venv-cloud-tts/bin/python -m pip install -r references/runtime/cloud-cpu-requirements.txt
.venv-cloud-tts/bin/python -c 'import torch,torchaudio; assert torch.__version__ == torchaudio.__version__ == "2.9.1+cpu"'
```

依赖解析若换掉 CPU 包，先恢复匹配的 CPU 版本再运行，不通过安装 CUDA 解决。后端采用 CPU float32、eager attention 和四线程。

必须使用 `run_cpu_voice.sh` 启动，它在 Python 初始化前设置官方 `ORT_DISABLE_TELEMETRY=1` 与 HF 离线标志；CPU 后端拒绝缺少该设置的直接调用。保留后端的 API 禁用作为补充。旧的仅在导入后调用禁用 API 的方式曾仍尝试遥测连接，不再作为操作路径。

```sh
PYTHON=.venv-cloud-tts/bin/python scripts/run_cpu_voice.sh --segments --config PROJECT/private/voice/voice-preferences.json --text PROJECT/narration.txt --output-dir PROJECT/work/voice-segments
```

CPU 长稿优先分段入口：空行分隔完整语义段落，每段最多 120 字符；模型加载一次，缓存段落，限制生成 token。进程中断后确认旧进程退出并检查锁，再用相同输入加 `--resume`。输入改变会拒绝复用，不能两个写进程共用输出目录。

段落缓存生成后逐段核对、实际听审，再按实测采样长度拼接，不加静音填画面。资源有限时不要并发运行 ASR 和 TTS。启动设置不等于完整网络审计或长期无人值守可用性证明。

## 输出与故障处理

`local_voice.py` 完整读取实际 PCM 数据后才发布 WAV，不覆盖已有或并发创建的目标。上游有可能捕获错误后正常返回；没有实际文件或数据不完整仍判失败，不自动重试或换服务。

默认抑制可能包含稿件的上游日志；需要排查时显式提供新的 `--log` 私有路径。日志可能含口播和参考转写，不进入公共包。

合成返回 `quality_assessed: false`，仍需检查音色、术语、漏句、重复、末尾和接点。完成环境检查或仅启动命令不能当作完成本人配音。换环境时重新核实资源和做真实短测，不依赖作者机器的私人目录。
