# GL 转场与原有转场

现有制作入口可直接选择 **30 种 GL shader + 5 种基础转场，共 35 种**。只增加场景切换的表现，继续使用原来的分镜、最终声音、字幕、口型、角色、海报和交付流程。新增第三方动画依赖只保留 GL Transitions。

## 查询、预览、使用

```sh
python scripts/production.py catalog
python scripts/production.py catalog --json
python scripts/production.py init work/transition-reel --title "转场组合" --subtitle "30 GL + 5 基础" --preset studio --template transitions
python scripts/production.py render work/transition-reel/project.json --output-dir outputs/transition-reel --preview
python scripts/check_transition_reel.py outputs/transition-reel/timeline.json outputs/transition-reel/video.mp4 --output work/transition-reel/transition-check.json
```

`transitions` 样例为 72 秒无声展示，前 30 项是 GL，后 5 项是基础转场。使用两张对比明显的原创示意画面，每项在画面字幕中显示编号、真实名称和中文说明，不依赖旁白。不是产品事实或声音验收样例。

默认 `init → compile/render` 会自动选择转场，35 种全部进入 `style.json.motion.transitionKinds`。编译后的 `timeline.json` 保存实际名称和自动选择依据；旧名称归一化为主名称与参数预设，并保留 `transitionAlias`。`render.mjs --audit-only` 的 `transitions` 输出引擎、时间、帧区间及自动选择记录。

## 自动选择顺序

1. **显式指定最高优先级。** 后一场的 `transition` 决定本次接点，场景判断不会改写它；旧名称同样生效。
2. **未指定时优先匹配场景。** 读取场景标题、副标题、条目、`kind`、已有 `effects`，并比较前后场的媒体。文档／报告优先翻页，细节／聚焦优先推近，流程／数据优先分片重排，空间场景优先立体切换，故障／代码优先数字效果，流体场景优先液体形变；同一素材接续和片尾优先柔和衔接。已有功能模块的信号强于文字线索，聚焦模块可以覆盖同素材的连续性偏好。
3. **在本轮未使用项中排序。** 匹配效果用完后继续选其他未使用项，全部 35 种走完再开始下一轮；显式指定也消耗对应主效果的位置，兼容别名不增加权重。自动选择避开跨轮的相邻重复，显式重复仍按指定执行。
4. **同分或没有线索时按种子轮换。** 项目可填顶层 `transitionSeed`，省略时用第一场标题。选择按时间顺序一次规划，重复渲染或跳帧保持一致；第一场没有入场转场。

这是根据已有场景字段执行的确定性规则，不读取图片像素或调用额外模型。新项目无需新增必填字段；需要精确艺术指导时直接指定 `transition`。自动场景的 `transitionSelection` 记录 `source: scene/rotation`、匹配到的 `intent` 和 `cycle`；目录 JSON 的 `automaticSelection` 可查询候选分组。规则在 `assets/remotion/transition-selection.mjs`，本期结果不写入技能上下文。

## 30 种真实 GL shader

下列名称加 `gl:` 前缀，例如 `gl:BookFlip`。名称大小写与官网一致；都是独立上游 shader，不用同一 CSS 效果改名凑数量。

| 表现 | 名称 | 适合的接点 |
|---|---|---|
| 立体翻页与空间 | `BookFlip`、`InvertedPageCurl`、`Cube`、`Doorway`、`Swap` | 文档换页、章节、对象进入新空间 |
| 推进与缩放 | `CrossWarp`、`CrossZoom`、`DirectionalWarp`、`DreamyZoom` | 产品聚焦、方向迁移、明显的章节推进 |
| 分片重组 | `GridFlip`、`WindowBlinds`、`WindowSlices`、`Mosaic` | 多窗口、内容重排、网格视图 |
| 液体与形变 | `WaterDrop`、`Ripple`、`Swirl`、`Morph` | 状态变化、抽象过程、主题转换 |
| 数字与故障 | `GlitchMemories`、`GlitchDisplace`、`Pixelize`、`Hexagonalize` | 技术章节、故障前后、数字视觉强调 |
| 图形遮罩 | `PolkaDotsCurtain`、`CircleIris`、`BowTieHorizontal`、`StarWipe` | 明确换场、轻松风格、重点揭示 |
| 纹理与光 | `Wind`、`BurnThrough`、`FilmBurn`、`InkBleed` | 风格化章节、颗粒消散、光与墨迹过渡 |
| 柔和衔接 | `Fade` | 信息连续、避免过度强调的镜头 |

基础机制只保留 `slide/radial/wipe/flip/converge` 五种。它们提供简洁的平移、硬边擦除、圆形揭示、单面透视与矩形汇聚；GL 的双画面扭曲、立体翻页等继续作为独立表现。

旧名称按下面规则合并，不再出现在独立效果数量与自动轮换权重中：

| 旧名称 | 主入口 | 保留方式 |
|---|---|---|
| `focus / zoom / merge` | `gl:CrossZoom` | 使用缩放虚化 shader，按 0.12／0.2／0.1 的强度预设区分；表现统一为 GL 的缩放叠化，画面不保证与旧 CSS 逐帧相同 |
| `iris` | `radial` | 保留半径 125%、圆心 `[0.5,0.46]` |
| `handoff` | `slide` | 保留 480 像素位移、4 像素虚化与裁切 |
| `evidence / report` | `flip` | 保留各自小角度透视、缩放／纵移、变换原点与淡入参数 |

旧 JSON 继续可用。编译后 `transition` 写主名称，`transitionParams` 写参数预设，`transitionAlias` 仅记录旧名称以保持原有 0.6 秒及顺序淡入约定；新项目直接选主入口。兼容别名在 `catalog --json` 的 `transitionAliases` 中单列，不作为七种额外特效计数。`catalog` 统一列出 35 项，并提供中文名称、分类、引擎、建议时长、是否在默认池，以及 GL 的官网预览、参数、作者、许可和源代码哈希。

按信息关系选择；复杂转场不能替代对象操作或过程动画。全部 35 项既可显式指定，也参与默认轮换；短片只使用实际切点需要的数量。场景偏好用于排序，不把不匹配项永久排除。

## 场景参数

在**后一场**填写转场。例如在现有 `demo` 场景中：

```json
{
  "kind": "demo",
  "start": 4,
  "end": 8,
  "title": "进入产品细节",
  "image": "screenshots/product.png",
  "transition": "gl:Cube",
  "transitionSeconds": 1,
  "transitionParams": {"persp": 0.65, "reflection": 0.2}
}
```

- `transition`：统一目录中的名称；GL 需要 `gl:` 前缀。第一场没有前场，不使用 GL 转场。
- `transitionSeconds`：可选，0.1–1.5 秒且不超过后一场时长。原有转场默认沿用 `motion.transition`；GL 按具体效果取约 0.6–1 秒。调整转场不移动场景起止或改旁白速度。
- `transitionParams`：按具体机制校验。GL 使用 shader 的真实参数名、数值／整数／向量／布尔类型及上游范围；基础机制使用 `catalog` 中列出的位移、圆心或透视等字段。省略的参数补该入口默认值；未知参数会报错。先查 `catalog --json` 的 `transitionDetails[].params`，不猜字段。

例如 `gl:CrossZoom` 的 `strength` 控制缩放模糊，`gl:GridFlip` 的 `size:[4,4]` 控制网格，`gl:Wind` 的 `reversed:true` 改方向。镜头时长仍来自最终音轨；转场完成后留出阅读时间。

## 真实合成与验证

```text
显式 transition / 场景关系 / 全部 35 种轮换池
  → 编译并保存实际 transition 与自动选择依据
  → contract 校验名称、参数与时长
  → 原有 CSS 合成 / GL 双场景 WebGL 合成
  → 当前 NarratedVideo、连续音轨、字幕与持久角色层
```

GL 使用 `@gl-transitions/remotion` 和官方 `gl-transitions` 的 GLSL。前场冻结在末帧，后场从自己的局部第零帧开始，在已编排的接点内重叠合成，不缩短总片长。持续角色与字幕保留独立层。CSS 与 GL 可以在同一时间轴相邻使用，时长分别计算；结束后切回正常后场，不遗留模糊或变换。

渲染入口核对所选目录与实际安装 shader 的 SHA-256，防止只登记名称却调用其他实现。目录检查要求 35 项都有可运行样例；新增 shader 同步维护 `gl-transitions.json` 的来源、参数、许可与样例，并实渲前／中／后帧及连续过程。

每场的媒体与效果必须隔离在自己的层叠上下文中，避免前场截图的 `z-index` 盖住新场 shader 或 CSS 变换。固定示例通过 `check_transition_reel.py` 检查每项前帧、起始、25%／50%／75% 过程、结束和停稳帧；过程若始终被旧截图覆盖会失败。提前完成揭示或中途闪光的 shader 按实际可见阶段检查，结果绑定视频与时间轴哈希。这个回归工具只适用于随包的两张对比示意图，不把任意产品片的相似画面自动判成失败，也不认证审美或听感。

## 共用环境与来源

沿用一份 `package.json`、锁文件、共用 `node_modules` 和已验证浏览器。所有 `remotion/@remotion/*` 包统一为 4.0.540；兼容组合为 `@gl-transitions/remotion 1.0.0` 与 `gl-transitions 2.5.0`。不按库或视频建立环境副本。更新后验证、复用浏览器，再清理没有任务使用的旧缓存及仓库根多余 `.remotion/`。

视频 bundle 使用任务临时目录并在结束后清理；Webpack 只用进程内缓存，避免并行视频争写同一磁盘缓存或积累大量构建包。

GL 离屏渲染使用 WebGL 2 与 HTML-in-canvas。Mac 默认使用硬件 `angle`；其他系统默认软件 `swangle`。可设置 `VI_SAY_GL=angle` 或 `VI_SAY_GL=swangle` 显式选择，有 GPU 时优先验证硬件路径，复杂模糊或纹理 shader 的软件渲染可能很慢。两种路径共用原浏览器与依赖，不另装环境。Studio 还需上游要求的 Chrome 版本与 `canvas-draw-element` 开关；Studio 表现与离屏成片分别核对。样例通过不等于所有题材的审美验收。

上游 shader 的许可和作者保存在目录中，依赖保留原始声明。当前选入的 `InvertedPageCurl` 为 BSD 3 Clause，其余为 MIT；项目的 Apache-2.0 不替代第三方许可。

参考：[官方效果画廊](https://gl-transitions.com/gallery)、[官方 Remotion 接入说明](https://github.com/gl-transitions/gl-transitions/tree/master/packages/remotion)、[效果与参数规范](https://github.com/gl-transitions/gl-transitions/tree/master/packages/gl-transitions)。
