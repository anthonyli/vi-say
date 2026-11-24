# Remotion＋FFmpeg 动态信息层

用于「跟着说话，页面有提示」的默认动画流程。时间轴由口播意义与最终声音共同决定。Remotion 负责逐帧动画、视频布局、字幕和信息层；FFmpeg 负责同步粗剪、音频处理、压制及验证。此模板提供基础组件，品牌风格和复杂图表可在任务副本扩展。

## 选择路线与时间轴接口

有原始讲解的录屏仅需精剪、字幕与关键词气泡时，先走[原声精剪](recorded-video.md)，连续母版为画面底层，本工具只叠信息层。不要将连续视频转换为 `scenes` 截图序列，不为适应模板比例裁去原片内容；现成布局不支持原画幅时适配叠加层，不改变原片。

- 录屏、真人口播的叠加提示，以及既有 4:3／3:4 布局，使用本文的 `overlays` 接口。
- 编辑式信息场景可使用 `scenes` 接口，具体字段、可运行示例和检查命令见 [editorial-scenes.md](editorial-scenes.md)。当前实现限 16:9，提供概念、比较、流程、数量图和多状态示意。真实截图、图表或明确标识的示意按解释任务选择；不要求每个场景都套浏览器窗框。不要将旧 `videoBox`、`cardBox` 或非空 `overlays` 混入该接口。
- 同一对象连续重排、聚焦、变形和跨镜头迁移，采用 [shared-motion.md](shared-motion.md)。它是独立路线，不把其字段直接塞入 Remotion `scenes`。保留已认可的源码、配色和对象身份，按实际实现调整时序。
- Anatomy 使用其独立适配流程。其他渲染工具的适配条件见 [扩展说明](../extensions.md#接入其他渲染工具)。比例不强制决定渲染器，现有接口不能覆盖的表达应在任务副本扩展并实渲验证。
- 下文的组件、JSON 与命令仅适用于 Remotion 模板。两种 Remotion 接口共享连续音轨约定；共享元素路线默认不烧录口播字幕，按该路线文档独立保存稿件与对齐结果。分镜记录与渲染参数分开，不能凭空添加 JSON 字段。

## 编辑与动画规则

- 按视觉分类组织画面：人物口播保持人物可见，可按空间安排侧边或上下卡片；全屏实录演示保持操作画面可读；知识解说型 MG 动画执行 [画面与图解](../stages/visuals.md)，可按观点组织窗口、图表和纸感拼贴。基础模板默认 contain 保护完整画面；如需 cover 或推近，先抽帧检查头、手和关键内容。给信息层留空间，不默认遮挡人物或操作区。
- 需要烧录字幕时，仅显示当下短字幕，约 10–22 个中文字、最多两行。关键词、卡片不重复整句字幕，同一时刻通常一个主重点，进度条可并存。
- 新章节使用 big-title，通常 1.5–3 秒；普通卡片通常保留 2–5 秒，复杂截图或代码更长。触发点取对应词时间，入场可提前约 0.1 秒以便读懂；根据语义退出。
- 强调词在说到时改变颜色或底色。tokens 使用实际词边界；逐字边界若由词区间插值，标明估算并抽查，不能宣称精确。标点和空格仍保留在字幕文本中。
- 卡片入场约 0.2–0.4 秒，离场约 0.15–0.25 秒，统一缓动。按语义需要安排 1–3% 推近、轻微位移或信息切换，避免每个镜头机械等待同样的秒数；适合阅读的静止时段应保留。连续推近段的 from/to 要接续，不能突然跳回原缩放。
- 动画用 useCurrentFrame、interpolate、spring 计算，不能依赖实时计时器、随机值或 CSS animation，否则不同渲染帧可能不一致。
- 不编造数据、证言和截图。browser 需要真实截图素材，示意图标明“示意”。code 只放能读懂的关键几行，复杂 diagram 使用生成并核实的 SVG／图片或扩展组件。
- 每种比例独立检查 videoBox、cardBox、字幕与平台按钮安全区；不要只改 aspect 就声称已经验收三种布局。

## 组件约定

| type | 必要内容 | 基础效果 |
| --- | --- | --- |
| big-title | text | 大标题弹入，用于章节和观点 |
| keyword | text | 强调色关键词 |
| bullet-list | text, items（1–3 项） | 要点错峰出现 |
| number | text, value, 可选 unit | 大数字卡片，保留原始数值 |
| quote | text, 可选 attribution | 金句卡片 |
| comparison | text, left/right 的 title、text | 左右两栏对照 |
| browser | text, image | 浏览器式截图卡片 |
| code | text, code（最多 8 行） | 等宽代码卡片 |
| diagram | text, items（1–3 项） | 简单纵向步骤箭头；复杂图另做 |
| progress | text | 当前章节内的进度条 |

卡片可带 label、detail、box。图标可以放在已准备的图片中，或在任务副本引入本地图标组件；基础模板不依赖在线图标请求。以上为可运行基础组件，不等于完整的二期品牌组件库。

## 时间轴

这是格式示例，实际所有秒数来自最终声音。路径相对 JSON 文件。已有视频的 video 与 audio 必须来自同次粗剪；video 在模板中静音，audio 只播放一次。仅配音场景可用 image 或无视频的背景，脚本不会自行生成素材或识别口误。

```json
{
  "aspect": "16:9",
  "fps": 30,
  "duration": 6,
  "video": "edit-v1/master.mov",
  "audio": "edit-v1/narration.wav",
  "accent": "#77efca",
  "videoFit": "contain",
  "videoBox": [0.045, 0.14, 0.5, 0.64],
  "cardBox": [0.59, 0.2, 0.365, 0.52],
  "captions": [
    {"start": 0.2, "end": 2.5, "text": "先找到真正的问题。", "tokens": [
      {"start": 0.2, "end": 1, "text": "先找到"},
      {"start": 1, "end": 1.7, "text": "真正的"},
      {"start": 1.7, "end": 2.5, "text": "问题。", "highlight": true}
    ]},
    {"start": 3, "end": 5.5, "text": "再分成三个步骤。"}
  ],
  "overlays": [
    {"type": "progress", "start": 0, "end": 6, "text": "01 / 问题"},
    {"type": "big-title", "start": 0.2, "end": 2.6, "text": "问题", "detail": "先明确要解决什么"},
    {"type": "bullet-list", "start": 3, "end": 6, "text": "怎么解决", "items": ["定位", "验证", "行动"]}
  ],
  "motions": [
    {"start": 0, "end": 3, "from": 1, "to": 1.02},
    {"start": 3, "end": 6, "from": 1.02, "to": 1}
  ]
}
```

`duration` 为实际最终音频时长，渲染向上取整到帧；差值应小于一帧。每个字幕和信息层的 start/end 都必须在此范围内。box 是画布中的 `[x, y, width, height]`，各值为 0–1。人物在右时调换 videoBox/cardBox。跨机器复用时，将有使用权限的字体放入项目 `private/fonts/`，由 `fontFile` 相对时间轴 JSON 引用，例如 `work/task/motion.json` 使用 `../../private/fonts/cjk.ttf`；项目未附带该示例字体。不指定字体时使用运行环境的字体回退，不能据此保证跨机器排版一致。

`tokens` 可省略，省略时显示普通字幕；提供时拼接文本必须与字幕完全一致，含标点。用 align_captions.py 的结果时 captions 可直接复用，characters 不能冒充真实逐字标注。渲染器只读取制作好的时间轴，不会从主题自动推断词时间。

## 运行

从当前项目根目录运行。`SKILL_DIR` 是规则与模板来源目录，由执行环境发现；在本仓库直接使用时可设为 `.`。所有 `work/`、`private/`、`outputs/` 路径仍相对当前项目，不相对外部技能安装目录。各 Remotion 包固定同版本，升级后重新实渲验证。

```sh
mkdir -p work/task
node "$SKILL_DIR/assets/remotion/runtime.mjs"
node "$SKILL_DIR/assets/remotion/render.mjs" work/task/motion.json outputs/video-v1.mp4 --validate-only
node "$SKILL_DIR/assets/remotion/render.mjs" work/task/motion.json outputs/video-v1.mp4
```

渲染器验证时间、素材存在性及基础内容，输出 MP4 与同名 SRT，拒绝覆盖；素材复制到临时目录供离屏渲染，结束后清理。依赖与浏览器统一使用技能根 `.cache/remotion/` 的共用环境，规则见 [共用 Remotion](production.md#共用-remotion)。

小龙 cartoonScenes 的有声输出另受 [完整听审门禁](production.md#底层有声小龙门禁) 约束：正式渲染需 timeline.audioReview 指向当前稿件计划、完整听审记录及证据，三项 pronunciation / term_fluency / voice_consistency 必须通过。未听审有声候选必须显式使用 --unreviewed-audio，且文件名含“候选/预览”或 candidate/preview；旁车保留真实听审状态。制作/审阅状态默认不进入视频画面，只有用户明确要求时才额外使用 --show-review-badge；它不改变听审结论。validate/audit/stills 仍可独立检查并报告听审状态。普通原视频 overlays/editorial 接口不因此更改。

## 三维情景样片

共用依赖包含 `three`、`@react-three/fiber` 和与 Remotion 同版的 `@remotion/three`。需要真实空间关系的知识演示，可在 `work/<项目>/` 编写独立场景，通过 `ThreeCanvas` 接入，不把单期场景写进公共模板。

对象、镜头与灯光状态均由 `useCurrentFrame()` 推导，不能使用实时累加的 `useFrame` 动画。复用 `runtime.mjs` 的共用依赖和浏览器；先检查静态关键帧与连续动作，再导出视频。二维标注可叠加于三维画面之上，但应使用同一镜头投影，避免标签与对象分离。此路线不改变既有 `overlays` / `scenes` JSON 接口，当前由各期入口独立编排。

## 验收

- FFmpeg 完整解码 MP4；检查尺寸、帧率、H.264/yuv420p、AAC、48 kHz，视频与最终 WAV 时差不超过一帧或已解释的编码延迟。
- 检视每种卡片入场中间帧和稳定帧，以及字幕较长处、所有剪辑接点、首尾。确认中文正常、没有遮挡人物、截字或卡片互盖，尤其 3:4。
- 复查语音触发点与高亮词，开头／中段／结尾及每处接点检查音画同步。长视频不能只验前三秒。
- 自动检查和听感判断分别记录。没有真实原片时只报告合成素材验证，不能声称完成真人口型同步验收。
- 视频之外仍完成三种独立排版海报、发布标题、描述与话题。动画模板或其演示不代替这些交付。

API 依据：[Remotion 渲染接口](https://www.remotion.dev/docs/renderer/render-media)、[动画属性](https://www.remotion.dev/docs/animating-properties)、[视频层](https://www.remotion.dev/docs/offthreadvideo)。

## 平台白色按钮叠层检查

目标为抖音、视频号等带白色操作叠层的平台时，尤其 9:16、3:4 竖屏，按实际目标比例检查。此检查不把平台版本的背景限制扩展到所有横版视频，也不自动替换用户认可的奶白风格。正文、转场和结尾都要检查，不能只验封面。

- 在验收预览中叠加白色点赞、评论、收藏、分享图标和底部白色文字，检查视频本身留白最多、明度最高的帧，以及明暗变化的转场。优先使用实际目标平台的叠层参考；没有参考时可用示意叠层，明确它不代表平台精确布局或已完成发布验收。
- 右侧和底部不仅要留位置，还要让白色图标及细线轮廓在手机尺寸下清楚可见。不要依赖平台可能存在的投影弥补浅底；近白背景、细网格或轻微灰度变化不能作为修复。
- 对比不足时为该平台版本调整相关区域底色，或在平台操作区域后方加足够深的有色渐变；不要靠把重点内容移到白色按钮下方来增加对比。浅色真实界面可保留在内容区。
- 叠层仅用于检查，导出视频不烧录这些仿平台按钮。记录实际检查的时间点与结果；只做模拟检查时，不声称抖音或视频号发布后已验收。

## 完整录屏的漫画积木路线

此路线用于已明确选择漫画风的录屏；无声素材需要新配音、普通字幕或关键词气泡，都不能单独作为进入此路线的理由。已有原声精剪继续使用[原声录屏入口](recorded-video.md)；下述固定封面、旁白与静音阈值不适用于保留真实无声操作的精剪任务。

已有系列风格在录屏增强任务中继续生效，不因使用自编工程而回退成普通卡片。使用 `assets/remotion/src/recorded-comic.jsx` 的 `RecordedComic`（1920×1200，30fps）：开头封面页、完整原速视频、漫画气泡、逐块搭建的积木与 `ComicCaptions` 双语高亮均为真实组件。`cover` 包含 title/subtitle/tag/bricks；`coverFrames` 为片头帧数；`videoFrames` 为完整原片帧数；`video/audio` 为 public 素材名。`steps` 使用 start/label/detail/brick，可选 transition/params；`captions` 与 keywords/keywordsEn 沿用漫画字幕接口。这里的 `cover` 仅指视频片头标题页，不能充当发布海报。视频片头可用代码构图；只有用户明确要求将图片用于片头时，才配置 `cover.image` 为 public 图片名。发布海报另外按海报节点生成三比例，并登记交付清单，不因本组件存在片头而省略。

先按完整录屏的实际界面切换编排口播；演示缺少讲解时适当补充 TTS，使用当前视频中已授权的音色，保持源视频连续播放。文案解释实际目标、动作或结果，不为填满每秒强行加话，也不为等旁白冻结画面。配音与完整录屏长度不符时调整讲解安排；封面在录屏之前、结尾可留合理停留，不能删掉原片帧来凑时长。

时间轴另含 `audioFile`（相对时间轴的 PCM16 WAV 路径）和 duration。执行 `python scripts/check_recorded_story.py <timeline.json>`，检查封面、关键词实际命中、双语字幕、原片覆盖时长和音轨中间超过1.2秒的低能量区间。该阈值用于暴露待处理断声，不代表听感验收。交付清单增加 `recorded_story` 指向该时间轴，`check-delivery` 会重新运行检查；实际转场、字幕高亮、画幅和末帧仍须从输出视频核对。用户明确选择其他风格或无声演示时使用对应路线，不强套此组件。

### 固定渲染入口

完整录屏工程使用 `node assets/remotion/render-recorded.mjs TIMELINE.json OUTPUT.mp4`，不逐期复制render.mjs。需要已有Python环境（默认仓库.venv，也可设VI_SAY_PYTHON）；素材位于时间轴同级public/。入口先检查实际源帧数、旁白、双语字幕与高亮配置，检查失败不启动浏览器；同时核对检查用WAV与实际播放音频逐字节一致。`--validate-only`仅校验；`--still=FRAME`导出PNG以检查布局。渲染复用共享运行环境并清理临时bundle，不覆盖产物。组件显式限制1920×1200/30fps，不再默默用错误帧率计算时间；字幕外观参数不能覆盖keywords或关闭双语。

断声检查覆盖首尾和中间，默认超过 1.2 秒报错。只有用户明确要求保留静默时才声明 `silentWindows:[{start,end,user_request,kind:"demo",reason:"实际演示内容"}]`，时间为最终成片时间；`user_request` 记录实际静默要求，`kind/reason` 不能单独豁免缺少讲解。检查器要求窗口有界、按时间排列且不重叠，并完全落在封面后的连续源视频区间；渲染入口同时检查实际源帧数与时长。未被窗口完整覆盖的长静音仍报错。其他用途的静默沿用 `{start,end,user_request}`，不得编造要求。音轨比成片短会单独报错，不能通过静音窗口豁免；需在完整混音里保留实际静音采样。记录与帧数不能证明动作语义完整，连续播放与听审仍须完成。
