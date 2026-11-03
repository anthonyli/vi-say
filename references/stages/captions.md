# 字幕与语义时间

输入是最终声音、真实词时间戳、准确稿件和必要的时间映射；输出是字幕 JSON、SRT 或烧录字幕版本，以及画面动作所用的语义锚点。

## 可替换的字幕偏好

| 项目 | 默认与可选方式 | 调整位置 |
|---|---|---|
| 是否烧录 | 小龙和共享元素路线默认不烧录口播字幕；可交独立 SRT | 当次要求，或 `render_captions.py --mode burn/sidecar` |
| 字体和大小 | 清晰中文、短句、最多两行 | Remotion 字体／字幕组件；后处理的 `--font-name/--font-size/--font-file` |
| 位置和底框 | 不遮挡主体与操作 | 对应渲染器布局或 `render_captions.py`，不是通用 JSON 样式字段 |
| 强调 | 对应口播中的关键词 | Remotion `captions[].tokens` 的真实词边界与 `highlight` |

## 取得可靠时间

本地 TTS 不自动返回词时间。选择当前可用的 ASR／对齐工具并适配结果，仓库没有统一的模型安装和转写入口。`align_captions.py` 接受毫秒单位的词区间：

```json
{"transcriptions":[{"transcripts":[{"sentences":[{"words":[
  {"text":"你好","begin_time":100,"end_time":500}
]}]}]}]}
```

实际值必须来自当前声音。若 `audio_timing.py` 处理了静音或速度，使用其时间映射；原声剪辑按最终母版重新对齐或核对剪辑映射，不能沿用原片未转换的时间。

```sh
python scripts/align_captions.py --alignment work/task/words.json --text work/task/narration.txt --map work/task/timing-map.json --output work/task/captions.json
```

该脚本要求时间映射；未做声音处理时提供依据实际声音建立的恒等映射（`speed: 1`、`cuts: []`，`output_duration` 为当前 WAV 实测秒数），不为取得映射而改变已认可的声音。字幕文本与识别不一致时先核实声音和识别，不通过改字幕掩盖漏词。

`characters` 是词区间内插值的估算逐字时间，不是逐字强制对齐。强调词优先用真实词边界，不能把按字数均分的时间声称为精确同步。

## 渲染与检查

- Remotion 时间轴可直接使用 `captions`；旧信息层的 token 拼接必须保留完整字幕文本。参数见 [Remotion](../tools/remotion.md)。默认小龙编译入口不自动填入字幕，需显式接入或后处理。
- 后处理：`python scripts/render_captions.py --video VIDEO.mp4 --captions CAPTIONS.json --output SUBTITLED.mp4 --srt CAPTIONS.srt --mode burn`。`sidecar` 保留原视频，单独交 SRT。输出使用新路径。
- 后处理字幕版式以 1920×1080 设计，其他比例需检查并适配安全区，不默认保证通用排版。它不裁切、缩放或补边，也不改变音轨。
- 看最长字幕、所有接点、首尾及关键操作处；普通字幕约 10–22 个中文字，最多两行。改稿、换声音或改剪辑后重新对齐并复核。
