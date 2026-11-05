# 共用制作流程

本页只维护场景选择、阶段顺序和工具路由。每个阶段的默认偏好、输入输出和检查放在对应 `stages/*.md`，参数扩展见 [extensions.md](extensions.md)。

## 选择内容场景

| 场景 | 先理解什么 | 需要的素材 |
|---|---|---|
| GitHub／开源项目分享 | 问题、特点、用法和适用人群 | README、文档、真实演示 |
| 官网／产品分享 | 使用场景、功能与操作 | 官网说明、截图、录屏 |
| 文章／其他链接分享 | 原文结论、条件与重点 | 原文、数据和引用 |
| 已录视频剪辑 | 原声意思、有效片段、重复或口误 | 原视频、转写、剪辑区间 |
| 知识科普／原理解说 | 概念、因果、关系与理解难点 | 可靠资料和明确标识的示意 |
| 实战案例／过程复盘 | 目标、过程、前后变化与结果 | 原始状态、实际操作、完成效果 |

场景可以组合；底层复用同一组声音、海报、动画与交付能力。资料读取与写作由 Agent 使用当前可用工具完成，技能没有统一的链接抓取服务。

## 流程节点

| 顺序 | 节点与独立规范 | 输出 |
|---|---|---|
| 1 | [内容理解](stages/content.md) | 本期受众、主要问题、核心收益、提纲与素材依据 |
| 2 | [前置海报](stages/poster.md) | 先生成并展示一张代表海报，校准主题与视觉方向 |
| 3 | [脚本](stages/script.md) | 完整口播，或原声内容的保留与重组方案 |
| 4 | [分镜](stages/storyboard.md) | 各段的论点、对象、状态变化和预期触发词 |
| 5 | [声音](stages/voice.md) | 剪辑母版或授权配音、最终 WAV 和真实检查记录 |
| 6 | [字幕与语义时间](stages/captions.md) | 可靠词时间、字幕、画面动作锚点 |
| 7 | [画面与图解](stages/visuals.md) | 真实演示、角色、流程、比较或图表 |
| 8 | [动画与样片](stages/animation.md) | 连续动作、转场与实渲样片，修订后扩展全片 |
| 9 | [互动片尾](stages/outro.md) | 与本期声音一致的结尾口播、画面和动作 |
| 10 | [发布文案](stages/publishing-copy.md) | 本期标题、正文、相关链接、互动与话题 |
| 11 | [检查与交付](stages/delivery.md) | 成片、音轨、所需字幕、三比例海报及检查记录 |

片尾稿在生成完整声音时一并加入；先规划完整故事，再按节点分别核对，不把独立文档误解为最后才拼贴声音。无声样片跳过配音并标清范围，不能声称完成声音验收。

前置海报先于完整脚本和配音；有方向变化就同步修订提纲。海报内容均衡饱满并保留舒适边距，字形/材质基准持续作为实际图片输入，修订累计保留未被本轮明确修改的既定项；每个所需比例默认只生成一次，检查后展示，后续节点复用，补齐比例只生成尚未调用过的缺失项。用户明确要求修改时只生成指定比例的一版修订，详细停止条件见 [海报节点](stages/poster.md#生成次数与停止条件)。用户明确要求先确认时等待反馈，其他任务按已知要求继续。最终交付复核海报与成片一致，发现问题如实记录，不自动重生成，不把未回复当成认可。

## 工具接口

| 任务 | 技术说明 | 当前边界 |
|---|---|---|
| 默认小龙项目、预览与正式渲染 | [production.md](tools/production.md) | hero/steps/demo/cta；16:9 |
| 分模块选择 Bot、玻璃、汇聚分发、连接、聚焦与字幕 | [animation-modules.md](tools/animation-modules.md) | 接入同一小龙入口，含自由编排 stage；16:9 |
| 产品面板汇聚、节点拖放、关系图与报告生成 | [business-effects.md](tools/business-effects.md) | 六类效果与八种新转场；支持无角色 studio 预设 |
| 其他可执行复用能力 | [reuse-map.md](tools/reuse-map.md) | 已有脚本与当前自动化边界 |
| 原声同步剪辑 | [recorded-video.md](tools/recorded-video.md) | 脚本按单源 EDL 执行，多源先整理母版 |
| 本地合成 | [local-tts.md](tools/local-tts.md) | MLX／CPU，依赖、模型和声音另备 |
| 实录信息层 | [remotion.md](tools/remotion.md) | overlays，16:9／4:3／3:4 |
| 比较、流程、数据与状态 | [editorial-scenes.md](tools/editorial-scenes.md) | scenes，16:9 |
| 对象连续变化与空间迁移 | [shared-motion.md](tools/shared-motion.md) | 独立 Python API，含转场与空间接口 |
| 等距装置图解 | [anatomy-video.md](tools/anatomy-video.md) | 自编确定性 SVG 场景 |
| 简单图片讲义 | [timeline.md](tools/timeline.md) | 独立重排的图片与连续声音 |
| 声音问题修订 | [audio-repair.md](tools/audio-repair.md) | 按任务追加检查，不自动滤波或判定听感 |

Pillow 六类编辑式布局的可运行示例见 [布局接口](../assets/editorial-motion/README.md)。不同工具的 JSON 接口不能混用，也没有全部集成到默认命令。

## 更换自己的偏好

先改对应阶段的“可替换偏好”，参数修改指向实际配置，新增行为指向实际代码。默认角色与色板分别在 [character.md](styles/character.md)、[colors.md](styles/colors.md)，视频和海报可以有独立配色。

单期选择保存在本期任务记录，只有希望改变所有后续默认行为时才修改公共规范。修改一个模块不默认重做其他已认可内容；声音和时间变化则重绑相关字幕、口型与动作。真实素材、音画同步、最终声音时间、真实检查和私有资料边界持续保留。
