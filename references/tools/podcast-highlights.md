# 播客精华视频

适用于把长播客或访谈提炼成一条能独立看懂的解说视频。来源画面用作静音引述，以新编旁白统领全片。需要保留节目原声时，使用[原声剪辑](recorded-video.md)。

## 从原节目提炼口播

1. 先核对节目标题、主持人、嘉宾、章节和时间码，用原始转写或对照节目确认重点前后的条件、例子和归属。区分节目人物的经验、外部可核对的事实和本片归纳。涉及规模、排名或结果时记清口径，证据只能支持相关性时，口播也保留这一点。
2. 用一个观众熟悉的场景开头，挑足以回答开场问题的几个重点。术语第一次出现时跟一句说人话的解释，尽量让观众先听懂具体的动作和结果。每个重点记录一条可核对依据、节目时间码与画面安排。口播作为对谈的独立转述，具体说法需要归属时写出是谁讲的。
3. 完成口播及授权配音。关键字、气泡、标签、字幕按最终音轨对齐。节目时间码用于核查、截取和署名，成片时间码控制镜头与提示。采用 [HTML 前审](../workflow.md#html-前审) 时，确认预览后制作海报与发布文案。

## 原画、标签和气泡

- 选能对应论点的原画短片，静音铺满 16:9 画幅。截图全幅等比显示，保留完整界面。节目署名和时间码放在画面角落，原节目链接写入发布稿。原画无法覆盖某条解释时，可使用官方画面、节目页、关键帧或标明「示意」的图解。
- **标签**写概念或关键词。**气泡**用一句话说清结论、例子或反差，旁白讲到该语义时才弹出并短暂停留。气泡属于解说层，靠近留空的角落，避免让尾部指向嘉宾。
- 逐镜选位置，给人脸、演示细节、来源和字幕留空间。一个气泡跨过切镜时检查两侧画面。手机宽度也应读得清，优先缩短文案和移动位置。

### 选用气泡样式

每期先根据素材选一款，在 `podcast.calloutStyle` 里记录选择。看代表镜头后确定位置和读字时间。

| 样式 | 外观 | 适用画面 |
| --- | --- | --- |
| `editorial`（默认） | 深色圆角气泡、暖色标签、短淡入 | 间隔切换人物和网页的访谈、需要较克制的信息提示 |
| `comic` | 奶白气泡、深描边和硬阴影 | 轻松故事或动漫感较强的剪辑 |

可用 `highlights[].position` 逐条指定 `top-left`、`top-right`、`bottom-left` 或 `bottom-right`，默认右上。靠下位置为字幕留出空间。颜色和外观由[气泡样式表](../../assets/remotion/podcast-callout-styles.mjs)维护，新增样式后用同一时间轴核对 HTML 和 MP4 的实际效果。

## 时间轴与工具

在项目制作目录中编写 `timeline.json`，使用 16:9 布局和最终旁白 WAV。资源路径相对该文件，`duration`、`start`、`end` 和 `videoStart` 的单位均为秒。`shots` 从 0 连续覆盖到成片结束，每段在本地 `image` 与 `video` 中选一种。`videoStart` 指该视频文件的入点，默认从文件开头播放。使用截取好的片段时，`sourceTime` 仍可写原节目的时间码，供画面识别。来自其他来源的画面在该镜头写 `source`，覆盖全片默认的节目署名。`highlights` 至少填一条，按成片出现时间排列，同一时刻最多一个气泡，可用 `detail` 补一句必要说明。字幕沿用[双语高亮字幕](../stages/captions.md)的写法。

文字上限按字段计算。标题 60 字符，来源 96 字符，镜头标签 36 字符，来源时间码 24 字符，提示标签 26 字符，提示正文 48 字符，补充说明 64 字符。按画面实际换行和阅读时间选更短的用词。

```json
{
  "aspect": "16:9",
  "fps": 30,
  "duration": 8,
  "audio": "narration.wav",
  "podcast": {
    "title": "为什么示例值得先做",
    "source": "节目名 · 访谈片段",
    "calloutStyle": "editorial",
    "shots": [
      {"start": 0, "end": 5, "video": "media/guest-clip.mp4", "sourceTime": "12:04", "label": "节目原画"},
      {"start": 5, "end": 8, "image": "media/example.png", "source": "本片制作", "label": "示意"}
    ],
    "highlights": [
      {"start": 2, "end": 7, "label": "先解决问题", "text": "给用户一个能直接试的例子", "position": "top-right"}
    ]
  },
  "captions": [
    {"start": 2, "end": 5, "text": "先给用户一个能直接试的例子", "en": "Start with an example people can try."}
  ]
}
```

依据本期前审设置，从技能根目录运行对应步骤。预览与 MP4 共用布局、媒体和时间；交付前保持版本一致。

```sh
node assets/remotion/render.mjs PROJECT/timeline.json OUTPUT/episode.mp4 --validate-only
node assets/remotion/render.mjs PROJECT/timeline.json PROJECT/review-v1 --html-preview
node assets/remotion/preview-server.mjs PROJECT/review-v1 8765
node assets/remotion/render.mjs PROJECT/timeline.json OUTPUT/episode.mp4
```

正式配音输出在时间轴顶部的 `audioReview` 对象内填 `pronunciation` 与 `listening` 两个相对路径，按[真实听审记录](production.md#真实听审记录)绑定音轨。可用 HTML 播放做直接听审，缺少记录时沿用[未听审候选命令](production.md#底层有声小龙门禁)。

## 播放与交付

按[本期 HTML 前审设置](../workflow.md#html-前审)检查同一时间轴的原画、旁白、字幕和提示。播放按钮在画面下方。抽看重点进入、提示停稳、离场和画面切换，实际播放核对节目原声静音、旁白术语、提示能否跟上句意。改音轨后更新字幕和提示时间。

按[交付清单](delivery-check.md)核对成片、独立音轨、口播稿、字幕、海报和发布文案。说明实际使用的节目画面与替代素材、预览或成片状态以及真实完成的检查。节目资料和本期用语留在本期项目目录。
