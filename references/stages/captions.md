# 字幕与语义时间

输入是最终声音、真实词时间戳、准确稿件和必要的时间映射；输出是字幕 JSON、SRT 或烧录字幕版本，以及画面动作所用的语义锚点。

## 可替换的字幕偏好

| 项目 | 默认与可选方式 | 调整位置 |
|---|---|---|
| 是否烧录 | 面向自媒体的有旁白产品宣传片默认交可直接看见的烧录字幕及 SRT；其他路线按用途选择 | 当次明确要求优先，或 `render_captions.py --mode burn/sidecar` |
| 字体和大小 | 清晰中文、短句、最多两行 | Remotion 字体／字幕组件；后处理的 `--font-name/--font-size/--font-file` |
| 位置和底框 | 不遮挡主体与操作 | 对应渲染器布局或 `render_captions.py`，不是通用 JSON 样式字段 |
| 强调 | 小龙中文口播对核心短语做高亮；其他路线按任务选择 | 本期字幕绘制组件，或 Remotion `captions[].tokens` 的真实词边界与 `highlight` |

## 中文口播的显示标点与关键词

当前小龙系列的中文口播字幕默认去掉逗号、句号、问号、顿号、冒号等显示标点，烧录画面与 SRT 保持一致。原始口播稿和送入 TTS 的稿件保留标点用于停连；先按完整原稿对齐，再派生无标点的显示文本。去标点不改变品牌拼写、英文词间空格或字幕时间，句内需要分隔时可保留一个空格。

按意群分条、按实际字体测宽，最多两行。每期从稿件建立保护词表，将多词产品名、术语和需要完整阅读的短语视作不可拆单元；换行与分条都不能把后半段留到下一条。关键词从本期核心问题、关键动作和可见收益中选取，按长短语优先匹配；词表作为项目输入，不内置某期产品名或主题词。

漫画积木风的 1920×1080 起点如下，其他尺寸重新检查：

| 元素 | 起始样式 |
|---|---|
| 正文 | 墨蓝中文 38 px，英文 25 px；中文在上，英文在下 |
| 关键词 | 深红 `#a82920`＋暖黄底 `#ffe18c`，字重 900；只强调核心短语 |
| 底框 | 奶白底、墨蓝描边、硬阴影；由公共漫画字幕组件绘制 |
| 安全区 | 居中，左右各留约 100 px，距底约 42 px；按主体和平台遮挡复核 |

高亮可与整条字幕同时出现；需要逐词变色时，另接入当前声音的真实词时间。SRT 保持纯文本，关键词颜色实际渲染进视频。统一小龙入口已支持 `modules.captions`，由 [captions.mjs](../../assets/remotion/effects/captions.mjs) 处理保护词、显示标点与关键词，并保证视频和 SRT 使用同一显示文本；[动画模块接口](../tools/animation-modules.md) 说明如何接入字幕文件。独立的旧后处理脚本仍按其自身能力使用。

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

## 英文产品片与可见性

- 交付前明确字幕是画面像素、可选字幕轨还是独立文件。自媒体播放中不能把默认关闭的 MP4 字幕轨或附带 SRT 当作“已经显示字幕”；从最终 MP4 抽取有旁白的帧，核实实际可见。
- 英文按完整词和意群断行，保留空格、品牌大小写与缩写。不要套用中文逐字截断或字数上限；以实际字体测宽，在画面安全区内最多两行，长句拆成顺序字幕。
- 在分镜阶段预留字幕区域，检查最长两行、产品按钮、页脚示意标识、转场和片尾。字号随最终尺寸与手机可读性选择，不把某期 1080p 参数用于所有比例。
- 仅补字幕时复用已认可视频与声音，输出新文件；可用音轨复制避免重混，核对时长与音频一致。现有 `render_captions.py` 的默认断行偏中文；英文需要确认断词行为，必要时使用本期适配器，不能假定传入英文就已经适配。

## 漫画系列的中英文字幕与高亮代码

默认中文主行＋英文译文副行，双语共用真实声音区间，不增加英文配音。中文显示去标点，英文保留自然标点与词间空格。翻译由本期内容编写、核对，不把中文逐词硬译或机器识别误词当译文。品牌和限定条件保留，长句先按意群分条。

自编漫画 JSX 必须调用 `assets/remotion/src/comic-captions.jsx` 的 `ComicCaptions`，不要再次用纯 `{caption.text}` 绕开高亮。传 `caption={text,en,start,end}`，`options={bilingual:true,keywords:[...],keywordsEn:[...]}`；可逐条用 `keywords/keywordsEn` 覆盖。默认双语，缺英文直接报错；明确单语任务传 `bilingual:false`。这是 JSX 接口，不是旧生产 JSON 已支持的新字段。关键词来自当期内容，组件复用已有 `captionSegments` 的长短语优先匹配。

SRT 每条按中文、英文两行输出，与渲染共用同一份 cue。SRT 本身无高亮颜色；高亮由画面组件实际绘制。检查最长译文、关键词、两行整体高度、字幕与录屏按钮及片尾的安全区。用户只要求修代码而不重出视频时，修订数据与音轨保存在 work，不能将旧 MP4 描述为已带新字幕。

`ComicCaptions.options` 可按本期画幅调整 `fontSize/fontSizeEn/lineHeight/lineGap/padding/borderWidth/borderRadius/shadow/bottom`，以及 `highlightColor/highlightBackground`。`RecordedComic.captionOptions` 直接传入同一接口；单期字号与配色保存在项目时间轴，不覆盖其他项目的默认风格。双语框过高时先减少字号、行距、上下留白并减轻阴影，保持两行可读且不遮挡录屏。
