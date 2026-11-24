# 默认小龙制作命令与项目格式

跨场景的固定阶段见 [workflow.md](../workflow.md)，配置和新动画入口见 [extensions.md](../extensions.md)。本页维护默认小龙路线的实际命令与输入格式。

建项目后先确定 [HTML 前审设置](../workflow.md#html-前审)。默认先准备脚本、声音与画面，使用 `review` 送审。用户确认当前预览后再渲染完整 MP4，并按 [海报](../stages/poster.md) 与 [发布文案](../stages/publishing-copy.md) 节点完成配套产物。

所有命令从技能根目录调用。运行脚本需要 Python/Pillow、Node/npm；若现有 Python 缺少依赖，可用 `uv run --with pillow --with numpy python scripts/production.py ...`。uv 会缓存环境，不给每个项目重新安装。不要修改用户系统 Python。

## 项目与风格

`production.py init` 建立 `project.json`、`narration.txt`、`lexicon.json`。项目名与输出目录由任务决定；每次选择新的输出目录，脚本拒绝覆盖。

小龙系列默认走本入口的 `comic` 预设：`init` 省略 `--preset` 即为漫画积木主题，hero/steps/demo/stage/cta 五种场景由固定版式与动效渲染，HTML 前审和 MP4 共用同一组件。字段、动效与转场见 [漫画积木风](../styles/comic-bricks.md#主入口comic-主题)。讲解类视频不再另写 JSX/HTML 工程；固定版式确实表达不了时，先按 [扩展说明](../extensions.md) 补进公共组件。

基础 `style_id=colorful-dragon-v1`。`init` 默认 `--preset comic`；历史项目可显式选 `--preset glass/classic`，无角色产品片用 `--preset studio`。有角色却不用 comic 时，渲染前检查会拦下，需在 `preflight.allow.series_theme` 写明用户要求。预设不足时不要虚构未实现字段。选择保存为项目 `modules`，不按产品写公共分支。基础色板与传统动作参数来自 `assets/production/style.json`，模块预设来自 `assets/production/presets/`，Bot 外观来自 `bot-styles.json`。`dragon.png` 是身份母版，`character.json` 保存素材说明；圆润口型另外保存实际组件、图片和参数。

`--template effects` 可初始化完整的无声模块示例，`--template business` 提供产品演示动效样例；默认 `--template story` 建立常规分镜。已实现模块、字段与示例命令见 [动画模块接口](animation-modules.md)。新增题材只替换项目文案、对象、词表和实际触发时间，复用组件。

`project.json` 的 `title/subtitle/series` 用于脚本封面草稿；`narration/lexicon/font` 路径相对该文件。`font` 可省略，使用 `VIDEO_FONT_BOLD` 或探测到的中文字体。脚本三种比例各自排版，标题放不下会报错；最终海报按 [poster.md](../stages/poster.md) 使用图像生成工具独立制作。默认视频是横版，海报横竖版不意味着支持竖版视频。

`python scripts/production.py catalog --json` 从代码和配置读取可用效果及字段，同时验证随包示例；预设和模板按目录发现。`.skill` 打包前也执行此验证，缺少示例或非法时序会阻止打包。

## 发音准备

先写准确的完整稿，再填术语表。例如：

```json
{
  "PageOn": {"spoken":"PageOn","notes":"英语完整连读，先听包含它的完整句子"},
  "API": {"spoken":"API","notes":"按英语字母名读缩写，不读成一个单词"},
  "1.5倍": {"spoken":"一点五倍","notes":"按数值读，不读成一五"}
}
```

`spoken` 是实际送给 TTS 的文本。没有查证的读法不要编造；品牌需保持原意，不能擅自改成另一个中文产品名。普通英语词不拆成独立音节。多音词按上下文手动加表；脚本不能穷举中文读音歧义。

```sh
python scripts/pronunciation.py --text PROJECT/narration.txt \
  --lexicon PROJECT/lexicon.json --output-dir PROJECT/voice-preflight
python scripts/local_voice.py --help
```

前一命令输出 `spoken.txt`、`sample.txt`、`pronunciation.json`。英文、数字存在未声明项或短测未覆盖全部已用术语时退出 1；覆盖清单见 sample_covered_terms / sample_uncovered_terms。短测取完整句子，不拼字。ready_for_synthesis 只表示文字映射就绪，pronunciation_verified 仍为 false；notes 不会作为音素、SSML或连读指令传给 TTS。用已授权声音生成并实际听查短测的读法、缩写连贯性和音色，修正实际 spoken 或重生成完整段落；通过后以 `spoken.txt` 合成全文。显示稿保留原术语，后续按真实音频重新对齐。脚本只固定输入和检查清单，不保证模型发音。

## 真实听审记录

正式小龙入口要求最终 PCM WAV 和 REVIEW.json；所有 `sha256` 必须实际计算。以下是字段说明，不可把占位值写成通过：

```json
{
  "audio_sha256":"最终WAV的实际SHA256",
  "spoken_sha256":"pronunciation.json中的spoken_sha256",
  "method":"human_direct_playback",
  "scope":"full_final_track",
  "reviewer":"实际审听者",
  "performed_at":"实际审听时间",
  "verdict":"no_unresolved_pronunciation_issue",
  "checks":{"pronunciation":"passed","term_fluency":"passed","voice_consistency":"passed"},
  "reviewed_terms":["PageOn","API","1.5倍"],
  "evidence":{"path":"listening-notes.txt","sha256":"该真实记录的SHA256"},
  "unresolved_items":[]
}
```

三项 checks 分别对应术语读法、缩写/词间衔接、整轨声线一致性，缺失、failed 或 not_checked 均不能放行正式有声片。不同生成版本补录/拼接后，须覆盖接点两侧和全片；相同参考哈希不证明同声线。

也接受确有音频感知能力的 `direct_audio_inspection_interface`；ASR 或技术脚本不可冒充该方法。证据路径相对 REVIEW.json。改稿、换音轨、改声音处理后旧记录失效。用户拒绝过的版本另按 [audio-quality.md](audio-repair.md) 检查，不能只补一个新表绕过历史反馈。

## 场景与固定动作

每场 `kind/start/end/title/subtitle/label`；`start/end` 是最终音频秒数，必须从 0 无缝覆盖 WAV 的实测时长，每场至少 1.5 秒。小龙、标题和背景使用统一材质语言与色板；角色当前是透明图层动画，不是三维骨骼模型。

comic 主题下各场景的固定版式、可选字段（`tone/highlight/sourceLabel`）和动作见 [漫画积木风](../styles/comic-bricks.md#主入口comic-主题)。

- `hero`：角色和大标题开场。
- `steps`：2–3 个有语义顺序的步骤；`items` 含 `text/detail/at`，`at` 可改写成 `cue` 词。
- `demo`：真实截图或录屏展示；素材放在项目内，通过 `image` 或 `video` 指定，二者只选一个。视频可设 `videoStart` 为源视频起点秒数，声音统一来自最终 WAV。
- `cta`：2–3 个互动提示；`items[].at` 对应实际口播词起点，画面只做示意。
- `stage`：通过 `effects` 自由组合已实现模块，用于连接、汇聚分发、路径传递等操作解释；接口见 [动画模块](animation-modules.md)。

`items[].at` 是场内秒数，推荐写 `cue` 词由编译换算。每次动作使用配置中的固定时长；相邻动作不得挤掉前一动作，片尾要留完成和停留时间。只改时间锚点，不把整段按比例缩放。原始录屏声音与画面剪辑要同步；需要全屏操作证据时继续用 [录屏路线](recorded-video.md)，不要挤进不适合的小窗。

```sh
python scripts/production.py render PROJECT/project.json --output-dir OUTPUT/study --preview --stills
python scripts/production.py render PROJECT/project.json --output-dir OUTPUT/silent --preview
python scripts/production.py render PROJECT/project.json --output-dir OUTPUT/final \
  --audio PROJECT/final.wav --listening PROJECT/REVIEW.json
```

前两条用于检查画面与运动；送审前的固定自查用下一节的 `review`。修复遮挡、溢出、拖沓或生硬接点后再扩展。程序拒绝无声样片被无标识地当成配音成片。正式输出仍需检查 AAC 编码后的音轨、操作真实性及音画对应。

## 渲染前检查

`compile`、`render` 和 `preview-html` 在生成任何帧之前，都会运行 [preflight.py](../../scripts/preflight.py)，并把结果写入输出目录的 `preflight.json`。检查项全部来自以往成片里出过的问题：

| 检查 | 拦下什么 |
|---|---|
| `captions_present` | 有声成片没有字幕 |
| `caption_keywords` | 高亮字幕没有关键词，或关键词一条也没命中，画面上不会出现高亮 |
| `outro_voiced` | 片尾场景的字幕没讲到留言、关注、点赞，也就是片尾没有声音 |
| `leading_silence` / `audio_gaps` | 开头超过 1 秒才出声，或口播中间有超过 1.2 秒的静音 |
| `caption_coverage` | 有口播的地方超过 1.5 秒没有字幕，包括最后一条字幕之后到 WAV 结束的区间 |
| `poster_in_video` | 场景素材名带"海报/封面/poster/cover"，也就是把发布海报放进了视频 |
| `series_theme` | 有小龙却没用 comic 主题 |

无声预览里的字幕只是草稿，所以无声预览只对关键词、片尾口播和主题给出警告；海报进视频始终会被拦截。带正式 WAV 的 HTML 前审和最终渲染，上表各项都会强制拦截。确实需要例外时，在 `project.json` 写 `"preflight": {"allow": {"audio_gaps": "用户原话……"}}`，原因会记进 `preflight.json`。这一步只做机械检查，不代表画面审美或听感已经通过。

字幕时间用 `align_captions.py --cues` 从最终 WAV 的 ASR 结果生成，输出文件路径直接填进 `project.json` 的 `captions`，同时供 `cue` 词定时；用法见 [字幕节点](../stages/captions.md#取得可靠时间)。

## 浏览器前审

按[本期设置](../workflow.md#html-前审)决定是否执行前审。用新的预览目录保存每个送审版本。第一条使用项目当前画面时间轴和静音轨，第二条使用正式旁白 WAV 和根据它对齐的场景、字幕、口型。全轨听审记录在正式渲染时验证，HTML 可作为直接听审的播放入口。

送审一律用 `review`：它生成同样的 HTML，并在 `self-check/` 里输出 `scenes.jpg`（每个场景内容最满的一帧）、`transitions.jpg`（每个转场的中间帧）和 `report.json`（画面长时间无变化、字幕闪过或读速过快）。先打开两张总览图逐格检查遮挡、空洞、拥挤、文字可读性和转场是否露黑，处理完报告里的每一项，再把 HTML 交给用户；`preview-html` 只在不需要自查的局部核对时使用。

```sh
python scripts/production.py review PROJECT/project.json --output-dir PROJECT/review-v1
python scripts/production.py review PROJECT/project.json --audio PROJECT/final.wav --output-dir PROJECT/review-v2 --serve
node assets/remotion/preview-server.mjs PROJECT/review-v2 8765
```

`--serve` 在写完预览后用本机 `http://127.0.0.1:8765/` 继续提供文件，并支持分段请求。不要用 `python -m http.server`，它不响应 Range，Chrome 会无法拖动 WAV，画面和口播就对不齐。也不要直接双击 `index.html`。预览目录里的 `index.html`、播放器和 `media/` 要留在一起。点画面或按空格后，Remotion 画面、烧录字幕和口播从同一帧开始。默认高亮字幕在画面内同时显示中文和英文。这一步不生成 MP4。已有标准 Remotion 时间轴可直接用 `node assets/remotion/render.mjs TIMELINE.json PREVIEW_DIRECTORY --html-preview`。收到用户确认后，使用已审核的素材和时间轴进行正式渲染。底层 `render` 保持独立，调用方按本期设置选择是否执行前审。

已确认的自编录屏预览可用 `node assets/remotion/render-preview.mjs PREVIEW_DIRECTORY OUTPUT.mp4 --composition-entry PROJECT/player.jsx` 直接导出同一组件。入口读取前审 `timeline.js`，保留原画幅、帧率与素材，并复用共用运行环境；不需要每期复制渲染器。`--frames 120-359` 渲染含首尾帧的片段，`--still 150` 检查单帧。只在需要原封不动封装已确认的独立成品音轨时用 `--mute` 先导出画面，再将该音轨无重编码封装进 MP4。该入口不替代内容、音轨来源、用户确认和最终交付检查。

自编组件的录屏层在正式渲染时使用 `OffthreadVideo` 精确取帧；HTML 预览可继续用 `Html5Video`。沿用旧预览时只替换该媒体组件，保持布局与时间轴一致，并实渲包含转场的短片核对源帧，避免浏览器 seek 边界带来的重复帧或漏帧。

固定使用深色单栏页面。画面按原比例居中，暂停时中央显示播放按钮。画面下方依次为播放、时间、进度、静音、音量和全屏控件，窄屏自动换行。再往下是默认展开的「字幕导航」，每行显示时间和当句字幕，播放时高亮当前句。点字幕会跳到该条实际出现的第一帧，区间内没有可显示帧的字幕会标明原因。音量调到 0 后，点「打开声音」恢复上一次非零音量。浏览器缺少 Canvas Draw Element 或 WebGL 2 时，页面提示缺少哪项能力，并用可见叠化代替 shader 转场。Chrome 具备这两项能力时播放真实 shader。

播放结束时停在末帧，点击「重播」从头开始。自编 Remotion 录屏通过 `buildHtmlPreview(doc, assets, target, runtime, {compositionEntry})` 打包。`compositionEntry` 模块默认导出函数，接收 `{props, recorded}`，返回本期的 `component`、`inputProps`、`meta`（宽、高、帧率和帧数）及逐句 `captions`。可参照 `assets/remotion/src/preview-content.jsx`。所有入口都由公共播放器挂载画面，统一提供样式、控件和字幕导航。

漫画录屏项目可用 `node assets/remotion/render-recorded.mjs TIMELINE.json PREVIEW_DIRECTORY --html-preview`，预览调用录屏路线的同一画面组件、视频与声轨。

## 底层有声小龙门禁

正式 compile/render 会将 pronunciation.json、listening.json 与真实证据一并携带，timeline.audioReview 引用这两份 JSON；底层渲染器再次校验当前 WAV、实际 spoken 哈希、全部术语、三项听审结论和证据。手写时间轴或绕过 production.py 也不能让未听审旁白直接变成正式输出。这里只验证记录与文件一致性，不认证审听者身份或自动判断音质。

没有全轨听审时，独立画面仍可 validate/audit/stills；确需有声技术候选，必须显式指定并在文件名中标明候选：

```sh
node assets/remotion/render.mjs PROJECT/timeline.json OUTPUT/episode-未听审候选.mp4 --unreviewed-audio
```

此方式生成绑定音视频哈希的 .audio-review.json，候选状态默认只保留在文件名、交付说明和检查记录，不自动烧录到视频画面。用户明确要求画面显示审阅状态时，才额外传入 --show-review-badge。去掉画面提示不改变未听审状态，不能作为正式声音通过或发布。无声 visualPreview 只豁免实际全零 PCM16 WAV，不能靠布尔字段把有声片标成无声样片。

## 共用 Remotion

`node assets/remotion/runtime.mjs`：首次按锁文件安装，随后报告 `reused:true`。位置为技能根 `.cache/remotion/<锁文件+系统架构+Node主版本哈希>/`。不要移动或改写系统环境变量；可用任务专属 `NARRATED_VIDEO_CACHE` 指定其他目录。多个项目直接调用同一个技能入口，无需项目内 `npm install` 或复制 `node_modules`。并发首次安装通过目录锁协调，失败不会标记为就绪。

默认使用 Remotion 配套固定版本的 Chrome Headless Shell，自动下载到共用依赖目录；Mac 也不自动改用系统桌面 Chrome。桌面 Chrome 在并发截帧时可能偶发整帧平铺、重复或缺字，参见 [上游问题 #9473](https://github.com/remotion-dev/remotion/issues/9473)。`REMOTION_BROWSER_EXECUTABLE` 仅在明确需要自定义浏览器时设置；遇到这类闪帧先取消该覆盖并用配套内核复核。依赖可以共用，项目输入、字幕、截图和输出各自独立。发现可用新版时自主更新：所有 Remotion 包保持同版，同步 package.json 与锁文件，最小实渲验证通过后清理没有任务引用的旧缓存。根目录 `.remotion/` 只是运行时缓存，不属于技能源码或交付；每次安装或下载后，确认没有活动下载、共用浏览器可用，再删除它。如果里面是唯一完整的新浏览器，先迁入对应版本的共用缓存并验证。

## 交付完整性

渲染后、最终回复前执行 `python scripts/production.py check-delivery <delivery.json>`；清单格式与范围裁剪见[交付清单](delivery-check.md)。它检查具体产物而不是视听质量，自编工程也需调用。缺项不因视频渲染成功而放行，视听验收仍执行上面的对应检查。

## 精简分发

本节只在明确需要打包、安装或发布时执行；版本递增规则见仓库 `AGENTS.md`。

每期发布标题、正文与话题按 [发布文案规范](../stages/publishing-copy.md) 生成，独立保存为 UTF-8 纯文本 `发布文案.txt`。最终 ZIP 中的文案须与最新修订一致。

`python scripts/production.py pack outputs/vi-say/vi-say.skill` 打包 `SKILL.md/LICENSE/NOTICE/references/scripts/assets`；若另有 `agents/` 配置也会一并包含。交付包放在对应项目目录中，不散放到 `outputs/` 根目录。`LICENSE` 为 Apache-2.0 全文，`NOTICE` 保留 Anthony Li 的版权与署名声明。排除测试、依赖、缓存、私有声音、模型、产物和历史审计文件。开发测试继续留在源码中。`.skill` 是 ZIP，解压后目录名为 `vi-say`，调用名为 `$vi-say`。

## 风格与共用能力的接入

- `transition` 是场景字段，选择已注册效果；comic 主题的转场池与动作时长在 `comic-motion.mjs`，其他主题取 `style.json.motion`，`characterSide` 也只对其他主题生效。扩展见 [extensions.md](../extensions.md)。
- 正式 compile 从最终 WAV 生成 `speechMotion`，绑定 fps、时长与声音 SHA，拷贝配准的闭嘴素材；换声音需要重算。角色参数与素材替换规范统一在 [character.md](../styles/character.md)。
- `modules.character.mode=rounded` 同时拷贝无嘴线底板并调用圆润嘴形组件；可用 `mouth_cues` 接入绑定音轨哈希的完整嘴形时间。没有近似音素时间时使用音量开口，无声预览保持闭嘴。普通字幕文件通过项目 `captions` 接入，关键词与显示风格由 `modules.captions` 控制。
- 配色在 [colors.md](../styles/colors.md)，海报与脚本草稿在 [poster.md](../stages/poster.md)，默认输出的 `covers/` 仍为可选草稿。
- 初始项目自动带片尾稿与示例时间。正式片尾文案、词时间、`outroId` 与省略条件统一在 [outro.md](../stages/outro.md)。
- 字体在捕帧前加载，静止后不持续亚像素位移。需要不同字体或新布局时检查实际帧，不把三比例海报推定为三比例角色视频。

用户明确要求交付名不带“候选/预览”时，可在`--unreviewed-audio`同时传`--review-name-reason '用户的实际命名要求'`。正常文件名不会改变听审结论；旁车记录保留原因和`listening:not_checked`。缺原因或未显式启用未听审输出仍拒绝。不为改名重新合成旁白。
