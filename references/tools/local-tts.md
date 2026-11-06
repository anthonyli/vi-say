# 本地配音后端

语言、音色与听感偏好由 [声音节点](../stages/voice.md) 维护。本页只说明配置、环境和合成接口；字幕接入见 [captions.md](../stages/captions.md)。工具不下载模型、不调用云端语音服务，也不自动切换音色。

## 选择后端

| 环境 | 配置 engine | 参考模型与依赖 |
|---|---|---|
| Apple Silicon Mac | mlx（默认） | mlx-audio 0.5.7、Qwen3-TTS Base 4-bit 本地目录 |
| Linux x86_64 CPU | qwen-pytorch-cpu | Python 3.12、匹配的 CPU PyTorch／torchaudio、官方 Qwen Base |

这些是当前实现的参考环境，不保证其他平台无需适配。配音模型默认下载到当前制作项目的 `private/models/`，与项目一起迁移或清理；依赖和声音也在制作项目准备，不进入技能分发包。首次安装与下载按当前任务授权准备；用户明确选择共享已有模型时，通过配置文件的相对路径或项目内软链接引用，不强制复制或重新下载。

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

## 多音色与每期选择

多个音色分别放在 `private/voice/female/`、`private/voice/male/` 等目录中，每个目录各有 `voice-preferences.json`、参考 WAV、准确转写和授权记录。子目录中的模型相对路径相应改为 `../../models/...`，共用项目内同一份权重。单音色的原有目录结构仍可使用。

固定音色时，先明确选择已有授权参考并创建项目默认配置记录，后续默认调用复用这一选择：

```sh
python scripts/select_voice.py --voice-root private/voice --voice female --output private/voice/fixed-voice.json
python scripts/select_voice.py --voice-root private/voice --output work/episode/voice-selection.json --print-config
```

`fixed-voice.json` 是长期必要配置，引用的参考或配置改变时拒绝继续，不回退成其他声音。每期记录仍写 `work/`。没有项目固定记录时保留旧版随机选择行为；用户明确要求随机时可用 `--voice random`，随机只在一期开始时执行一次。例如：

```sh
VOICE_CONFIG="$(.venv/bin/python "$SKILL_DIR/scripts/select_voice.py" --voice-root private/voice --voice random --output work/episode/voice-selection.json --print-config)"
.venv/bin/python "$SKILL_DIR/scripts/local_voice.py" --config "$VOICE_CONFIG" --text work/episode/spoken.txt --output work/episode/narration.wav
```

`--voice male` 或 `--voice female` 可明确指定；其他音色使用自己的目录名。随机池只包含当前制作项目中已配置且已有授权的音色。正文、补录和片尾复用同一个选择文件；已有文件不会重新抽取，音色配置、参考音频或转写改变时会拒绝复用。新一期使用新的选择文件。选择文件只固定参考配置，不锁定每次生成的实际音色，也不代表合成或听审通过。跨调用补录/择段时按 [声音节点](../stages/voice.md) 核对最终声线连续性。

不指定 `--config` 时优先校验并读取 `private/voice/fixed-voice.json` 所绑定的配置；没有固定记录时兼容读取 `private/voice/voice-preferences.json`。多音色项目也可将后者设为某个音色配置的项目内软链接；软链接漂移不会覆盖已固定的项目选择。显式 `--config` 用于用户有意选择其他已授权配置。

## Mac MLX

先进入当前制作项目根目录，再准备隔离环境和本地权重。以下下载命令显式指定项目内目录：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install "mlx-audio==0.5.7" huggingface_hub
.venv/bin/hf download mlx-community/Qwen3-TTS-12Hz-1.7B-Base-4bit --local-dir private/models/Qwen3-TTS-12Hz-1.7B-Base-4bit
```

根据当前环境选择 Python 3.10+。权重及分词器、音频资源需完整下载；4-bit 不表示任意机器都能流畅合成长稿。示例中的模型路径相对 `private/voice/`，实际按自己的目录调整。安装或移除技能不会自动下载或删除模型；采用默认目录时，模型随制作项目保留，删除该项目才会一起移除。

从制作项目调用已安装技能的脚本（`SKILL_DIR` 是实际技能目录）：

```sh
.venv/bin/python "$SKILL_DIR/scripts/local_voice.py" --text work/narration.txt --output work/raw-v1.wav --check-only
.venv/bin/python "$SKILL_DIR/scripts/local_voice.py" --text work/narration.txt --output work/raw-v1.wav
```

`--check-only` 不导入推理后端、不合成。正式合成前强制 HF／Transformers 离线，只传本地模型与显式参考转写，关闭自动 ASR、播放和流式输出。默认语言 Chinese、原速1.0、max-tokens 4096，token上限不证明全文已读完。兼容旧配置时使用整稿一次生成；配置了下面的 `anchored` 策略时由本仓库脚本先分段，不能依赖上游 `split_pattern`，因为当前MLX的Base克隆分支在普通分段逻辑之前已返回。

### 固定参考与长口播声线控制

参考配置可以包含生成策略；命令行同名参数可用于明确的对照试验：

```json
{
  "generation": {
    "mode": "anchored",
    "segment_chars": 120,
    "seed": 42,
    "temperature": 0.4,
    "top_p": 1.0,
    "top_k": 50
  }
}
```

这是初测策略，不是已证明适用于全部音色的最佳参数。`seed`帮助同环境复现，不能保证身份一致；较低温度也可能降低表达自然度。`anchored` 按完整句子组织段落，超过字符上限的单句会报错，要求改写或显式调大限制，不按字幕或单个字硬切。模型只加载一次，每段都重新传入同一原始参考与转写；重新设定seed，不延续上一段生成声作为新参考。采样参数在Mac与CPU单次入口中真实传给后端。

```sh
.venv/bin/python scripts/local_voice.py --config private/voice/voice-preferences.json --text work/episode/spoken.txt --output work/episode/anchored-candidate.wav --mode anchored --segment-chars 120 --seed 42 --temperature 0.4
```

每次输出同名 `.generation.json`，记录参考/转写/模型内容哈希、固定音色ID、实际采样参数、各段音轨哈希及最终采样区间。按实际PCM采样拼接，不变速、不重叠人声、不为画面补静音；参考、转写或模型在准备后发生变化会失败。元数据与WAV均不覆盖旧文件。

需要内容锁时，以 `scripts/voice_consistency.py` 的 `reference_identity(model, reference_audio, reference_text)` 计算实际哈希，将 `{"schema_version":1,"id":"项目自定音色ID","assets":计算结果}` 写入当前参考配置的 `voice_lock`；不要手填占位哈希。锁覆盖模型权重、分词器与配置内容，路径名相同也不能掩盖权重替换。配置及音色锁放项目私有资料，不分发真人参考、哈希或本期声音偏好。

固定输入与分段都不自动证明听感稳定。先用相同全文做连续/分段对照，再做目标时长测试；分别实际听查每个接点、开头/中间/结尾及整轨。说话人相似度可辅助定位，阈值需校准，不能以ASR、单一相似度或响度检查清除用户已报告的变声阻塞项。

可选本地诊断复用已安装Qwen模型的说话人编码器，不另下模型。以8秒窗口、4秒步长比较原始固定参考，也记录相对该音轨首窗口的变化供定位；首窗口只用于诊断，不成为新的合成参考。它是同模型辅助指标，没有校准阈值，不自动输出通过结论。

```sh
.venv/bin/python scripts/check_voice_identity.py --config private/voice/voice-preferences.json --audio work/episode/continuous-candidate.wav --audio work/episode/anchored-candidate.wav --output work/episode/speaker-comparison.json
```

该诊断目前仅支持MLX Qwen，输入与输出保持本地，输出新报告，不覆盖旧结果。不要与TTS或ASR同时占用有限推理资源。旧的CPU可续跑入口仍使用其原采样逻辑；需要显式固定采样参数时使用本节的 `local_voice.py` 入口。

### mlx-audio 0.5.7 的 ICL 长度兼容

该版本 Qwen3-TTS 的普通 `decode()` 按首码本中大于 0 的数量推算有效长度，但 0 也是合法语音码值；随后 ICL 再按参考占比裁切，可能残留参考尾音并截掉生成结尾。`local_voice.py` 仅在此版本、本地 Qwen3 Base、显式参考音频与转写、单字符串、非流式的 ICL 合成调用中，临时将 `[1, time, Q]` 解码交给同版 `batch_decode([codes])`，按实际时间步数返回完整波形与长度。

兼容层不改 site-packages；调用结束即恢复原方法，CPU、其他模型／版本、流式及真正多样本批输入沿用原路径。接管后的解码异常或长度不完整会失败，不回退到已知有误的裁法；默认速度仍为 1.0。此修复只校正样本长度，不代表术语、音色、结尾或听感已通过检查。

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

`private/` 只存模型、音色参考与必要配置。试音、完整旁白、分段缓存和诊断日志写入 `work/<项目>/`，最终交付音轨写入 `outputs/<项目>/`；不在 `private/` 下建立单期制作目录。`local_voice.py` 和分段入口在导入模型、创建输出前拒绝写入项目的 `private/`，也检查指向该目录的软链接。用户选定用于后续复用的参考样本可再整理到 `private/voice/`。

`local_voice.py` 完整读取实际 PCM 数据后才发布 WAV，不覆盖已有或并发创建的目标。上游有可能捕获错误后正常返回；没有实际文件或数据不完整仍判失败，不自动重试或换服务。

默认抑制可能包含稿件的上游日志；需要排查时显式提供新的 `--log work/<项目>/voice.log`。日志可能含口播和参考转写，保持本地私有，不进入公共包；这里的私有指保密属性，不是 `private/` 存放目录。

合成返回 `quality_assessed: false`，仍需检查音色、术语、漏句、重复、末尾和接点。完成环境检查或仅启动命令不能当作完成本人配音。换环境时重新核实资源和做真实短测，不依赖作者机器的私人目录。
