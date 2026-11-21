# 主题＋已录制视频

收到主题和视频路径后直接完成剪辑。只有缺少视频本身或存在会改变表达的关键歧义时才询问。默认保留真人原声、原速；默认成片 16:9，封面仍交付 4:3、3:4、16:9，附标题、描述和话题。

沿用 [共用流程](../workflow.md)，先转写、审片并提炼主题，再剪辑与制作信息层。采用 HTML 前审时，确认当前预览后制作海报和发布文案。已有用户认可的本期海报可直接复用，交付前核对与成片一致。

## 从原片到成片

1. 检查视频时长、尺寸、旋转、帧率、音轨及可读性。抽帧看人物位置、手势和已有字幕；转写全部原声并取得词时间戳。ASR 使用已授权服务或本机工具，外部服务不可用时如实说明缺口，不能靠字数编造对齐。
2. 用转写规划开场、论点、例子、结论。逐项列出源视频保留区间和剪辑原因，删除明确的重录、重复、口误和长空白，保留否定、条件、限定和自然呼吸。不要为了主题添加原视频没有说过的事实。已有内容可以连贯讲清时，不强行打乱顺序。
3. 将剪辑决策写入 EDL。先做音画一起剪的母版，再规划最终时间轴。scripts/prepare_recording.py 支持单个源视频、按清单顺序拼接保留片段、每段保调变速。多个源视频先统一尺寸、帧率与音轨并整理母版；不要把不同源文件的时间误当成同一源时间。
4. 对剪辑母版的最终 WAV 重新对齐。源时间戳也可通过剪辑映射转换，但删节边界的词需人工核对，重排后需重新排序。母版锁定后字幕、强调词、卡片都使用最终时间；变更剪辑就重新对齐。
5. 在最终时间轴区分真人口播与系统播放。每段真实演示先说清接下来会看到什么，再点击播放。标记实际点击帧，不能用较晚的系统声音起点代替。用户口播补中英双语；系统已经有字幕的播放窗口只保留原字幕。复看控件和字幕安全区。原声录屏保持真人呈现，不加入小龙或其他角色；明确选择角色时按对应路线执行。
6. 有互动片尾时，先在正文说完收束句，再转入积木互动。固定模板的留言、关注、点赞随实际词时间逐项出现，最后一声结束后留停稳。需补录时优先用已授权的本段真人口播作参考。使用下方入口导出并检查实际 MP4。
7. 按 [海报节点](../stages/poster.md) 完成三种独立构图并检查尺寸，核对海报与最终剪辑一致。交付成片、独立音轨、SRT、三种海报和发布文案。

## EDL 与执行

路径相对 JSON 所在目录。此处秒数仅示范结构，实际值来自原片；`segments` 顺序即成片顺序。每段 `reason` 记录人工判断；工具不会自动识别语义口误。

```json
{
  "source": "source.mp4",
  "fps": 30,
  "filler_cuts": [{"in": 8.7, "out": 9.1, "text": "然后"}],
  "segments": [
    {"in": 1.2, "out": 8.6, "speed": 1, "reason": "保留完整开场"},
    {"in": 10.1, "out": 19.5, "speed": 1, "reason": "去掉重录，保留有效说明"}
  ]
}
```

```sh
python "$SKILL_DIR/scripts/prepare_recording.py" work/task/edit.json --output-dir work/task/edit-v1
```

输出 `master.mov`（H.264＋PCM）、`narration.wav`、`edit-map.json`。脚本默认拒绝覆盖，重做使用新目录。源时间四舍五入到项目帧，保留映射；编码和保调变速会有帧／采样量化，最终对齐使用实际 WAV。音量处理在拼接后统一执行；默认 -16 LUFS，仍需检查峰值和听感。

人工确认的冗余「然后」「其实」「可能」写入可选的 `filler_cuts`，保留区间不能与这些切除区间重叠。保留表达先后、假设或限定的同形词。剪辑后从实际声音核对残留口头语、被截断的字和接缝。工具分别按帧和累计样本对齐，验证解码帧数再交付母版。

`master.mov` 在合成中静音播放，使用同次处理得到的 `narration.wav` 或加入补录后的最终混音 WAV。补录可用暂停画面的界面特写，避免冻结的嘴型与新口播不一致。

## 双语成片与有声片尾

正文母版包含播放前引入和片尾收束句，结束帧就是转场起点。最终 WAV 包含完整原声、补录、系统播放声、片尾口播及末尾停留。计划中的秒数采用**最终成片时间**。任务无需互动片尾时省略 `outro`，正文母版与全片同长。

| 字段 | 填写 |
| --- | --- |
| `schema_version`、`fps`、`duration` | 版本 1，项目帧率和总时长，时长精确到帧 |
| `captions` | 每条填写 `start`、`end`、`text`、`en`，中文一行、英文一行，长句按意群拆分 |
| `keywords`、`keywordsEn` | 可选双语关键词，字幕可以逐条覆盖 |
| `playback` | 每次系统播放的 `start`、`end`、`embedded_captions` 和 `intro:{start,end}`。无系统播放时填 `[]` |
| `outro.template` | `community-outro-v1`，文案和动作取自 [outro.json](../../assets/production/outro.json) |
| `outro.closing` | 收束句 `start`、`end`，可用 `text` 核对指定台词 |
| `outro.transition` | 帧边界上的 `start`、`end`、真实 GL 效果 `name` 和可选 `params`，积木片尾可用 `gl:GridFlip` |
| `outro.narration`、`outro.actions` | 片尾口播 `start/end`，依模板顺序提供实际词起点 `[{anchor,at}]`。末句后至少留 0.25 秒 |
| `voice` | 全部原声用 `{mode:"original"}` 或省略。补录用 `mode:"current_recording"`，提供 `reference_audio`、`excerpt:{source,start,end}`、`generation_reports`。明确要求其他授权音色时用 `authorized_alternative` 并记录 `user_request` |

路径相对计划文件。补录样本可以由原录屏或同一录屏剪辑后的原声音轨抽取。按单人连续口播选段，附真实参考转写，调用 [本地配音](local-tts.md)。样本用单声道 PCM16，检查器复抽比对采样数据，并核对合成报告的参考哈希。

```sh
python scripts/production.py check-recorded-edit work/task/timeline.json --plan-only
python scripts/production.py render-recorded-edit work/task/timeline.json \
  --body work/task/body.mov --audio work/task/final-mix.wav \
  --output outputs/task/video.mp4 --srt outputs/task/captions.srt
python scripts/production.py check-recorded-edit work/task/timeline.json \
  --video outputs/task/video.mp4 --srt outputs/task/captions.srt
```

需要本地字体时用 `--font-name/--font-file`。导出入口复用积木和双语字幕组件，独立解码录屏与 Remotion 后拼接，防止音轨长度掩盖视频在片尾前中断。检查实际 MP4 帧数、时间戳、音轨、有声区间和配套字幕后再发布输出文件。还需实际检查播放按钮、积木落位、字幕避让和新旧音色的衔接，区间内有声和自动转写不能代替听感验收。
