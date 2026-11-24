# 字幕与语义时间

输入是最终声音、真实词时间戳、准确稿件和必要的时间映射；输出是字幕 JSON、SRT 或烧录字幕版本，以及画面动作所用的语义锚点。

录屏精剪和无声录屏素材配音默认使用清晰简洁的普通字幕，语言沿用本期约定。关键词气泡是独立提示层，不表示用户选择了漫画字幕。下文漫画积木样式与小龙系列规则仅在该风格已被选用时适用；不因复用某个字幕组件而改变任务的视觉风格。

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

漫画积木风的 1920×1080 默认值如下，由 [comic-captions.jsx](../../assets/remotion/src/comic-captions.jsx) 实际绘制，其他尺寸重新检查：

| 元素 | 默认样式 |
|---|---|
| 正文 | 白色中文 36 px（字重 700），英文 26 px；中文在上，英文在下 |
| 关键词 | 暖黄 `#ffe18c`，字重 900；只强调核心短语 |
| 底框 | 深色半透明圆角底 `#050914ed`、细描边与柔和投影 |
| 安全区 | 左右各留 13.5%，距底 70 px；comic 场景的内容统一停在 y=880 以上，不与字幕重叠 |

高亮可与整条字幕同时出现；需要逐词变色时，另接入当前声音的真实词时间。SRT 保持纯文本，关键词颜色实际渲染进视频。统一小龙入口已支持 `modules.captions`，由 [captions.mjs](../../assets/remotion/effects/captions.mjs) 处理保护词、显示标点与关键词，并保证视频和 SRT 使用同一显示文本；[动画模块接口](../tools/animation-modules.md) 说明如何接入字幕文件。独立的旧后处理脚本仍按其自身能力使用。

## 取得可靠时间

本地 TTS 不自动返回词时间。用当前可用的 ASR 识别最终 WAV，再交给 `align_captions.py`。它接受两种格式：DashScope 风格的毫秒词区间（`transcriptions[].transcripts[].sentences[].words[]`），以及 whisper / faster-whisper 的 `segments[].words[]`（`word/start/end`，单位为秒）。

本期写好的中英字幕用 `--cues` 按顺序传入，每条为 `{text, en, keywords?, keywordsEn?}`。声音没有做过剪辑或变速时，用 `--audio` 传最终 WAV，脚本会自动建立恒等映射；用 `audio_timing.py` 处理过静音或速度的，改用 `--map` 传它输出的时间映射。

```sh
python scripts/align_captions.py --alignment work/task/asr.json --cues work/task/cues.json \
  --audio work/task/narration.wav --output work/task/captions.json
```

稿件和识别结果不一致时，脚本会逐处列出差异，包括时间点、稿件写法和识别写法，然后停止。先去听这几处：真是读错了就重新生成声音；只是识别写法不同（数字与汉字、同音字），再加 `--accept-differences "听过：……"` 重新运行。差异区间的逐字时间由两侧插值得出，并标记 `interpolated`；放行理由会写进输出。不要通过改字幕来掩盖漏词。

输出的 `{"captions": [...], "characters": [...]}` 可以直接作为 `project.json` 的 `captions` 文件。字幕按 cue 绑定时间，`characters` 供场景和效果用 `cue` 词定时，见 [动画模块](../tools/animation-modules.md#跟着口播出现用词代替秒数)。只传 `--text` 时，脚本按标点自动分条。

`characters` 是词区间内插值的估算逐字时间，不是逐字强制对齐。强调词优先用真实词边界，不能把按字数均分的时间声称为精确同步。

## 渲染与检查

- Remotion 时间轴可直接使用 `captions`；旧信息层的 token 拼接必须保留完整字幕文本。参数见 [Remotion](../tools/remotion.md)。默认小龙编译入口不会自己生成字幕，需要接入 `align_captions.py` 的输出；有声成片缺字幕时，渲染前检查会拦下。
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

自编漫画 JSX 必须调用 `assets/remotion/src/comic-captions.jsx` 的 `ComicCaptions`，不要再次用纯 `{caption.text}` 绕开高亮。传 `caption={text,en,start,end}`，`options={bilingual:true,keywords:[...],keywordsEn:[...]}`；可逐条用 `keywords/keywordsEn` 覆盖。默认双语，缺英文直接报错；明确单语任务传 `bilingual:false`。制作时逐条编写译文到项目 captions[].en。新项目预设启用 modules.captions.bilingual；显式设为 false 可输出单语。高亮字幕默认使用深色圆角底、中文白色主行、较小英文副行及黄色关键词。HTML 与 MP4 共用这个组件，SRT 在同一时间段导出两行。关键词来自当期内容，组件复用已有 `captionSegments` 的长短语优先匹配。

SRT 每条按中文、英文两行输出，与渲染共用同一份 cue。SRT 本身无高亮颜色；高亮由画面组件实际绘制。检查最长译文、关键词、两行整体高度、字幕与录屏按钮及片尾的安全区。用户只要求修代码而不重出视频时，修订数据与音轨保存在 work，不能将旧 MP4 描述为已带新字幕。

`ComicCaptions.options` 可按本期画幅调整 `fontSize/fontSizeEn/lineHeight/lineGap/padding/borderWidth/borderRadius/shadow/bottom`，以及 `highlightColor/highlightBackground`。`RecordedComic.captionOptions` 直接传入同一接口；单期字号与配色保存在项目时间轴，不覆盖其他项目的默认风格。双语框过高时先减少字号、行距、上下留白并减轻阴影，保持两行可读且不遮挡录屏。
