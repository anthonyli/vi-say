# 扩展与替换能力

共用流程见 [workflow.md](workflow.md)。本页列出当前实际存在的配置和代码入口；它们是明确的扩展位置，不是已实现的任意插件加载系统。

## 先判断修改层级

| 需要改变什么 | 当前入口 | 何时需要代码 |
|---|---|---|
| 颜色、固定动作时长 | `assets/production/style.json` 的 `palette/motion` | 现有参数无法描述所需表现时 |
| 默认转场组合 | `style.json.motion.transitionKinds` | 效果尚未在注册表实现时 |
| 单场转场／角色站位 | 项目场景的 `transition/characterSide` | 新效果或新布局时 |
| 角色和嘴部素材 | `style.json.character`、透明素材 | 真实新姿态或更复杂口型时 |
| 海报风格 | [海报节点](stages/poster.md)、参考图、`style.json.poster` | 选择代码排字且需新布局时 |
| 语言、参考声音 | 制作项目的私有声音配置、`local_voice.py --language` | 新增推理后端时；语言效果仍须实际短测 |
| 统一片尾 | `assets/production/outro.json` | 新图标或新的互动布局时 |
| 发布口吻 | [发布文案](stages/publishing-copy.md) | 通常无需改代码 |
| Bot、玻璃、连接、汇聚分发、路径、聚焦与高亮 | 项目 `modules` 和场景 `effects`，见 [动画模块接口](tools/animation-modules.md) | 已实现模块直接选择；新类型同时扩展 contract、motion、绘制与实际样片 |

配置只能使用当前实现支持的字段。修改全局默认前先在任务副本验证；单期偏好写入本期记录，不自动变为所有任务的默认。

## 新增或替换小龙转场

现有十二种效果集中在 `assets/remotion/cartoon-transitions.mjs` 的 `CARTOON_TRANSITIONS` 注册表。调用关系：

```text
场景 transition／style.json 自动转场池
  → cartoon-contract.mjs 校验效果确已实现
  → cartoon-motion.mjs 统一计算时间进度和缓动
  → cartoon-transitions.mjs 生成转场样式
  → src/cartoon.jsx 合成前后场景
```

新增步骤：

1. 在注册表增加一个具名函数，接收已经缓动的 `p`（0 到 1），返回 React/CSS 样式对象。需要多个文件时可从独立模块导入，注册表保留统一入口。
2. 效果只依赖传入进度，不用实时时钟、无种子随机或跨帧状态。完成时样式由统一调用层归为 `{}`，使后一场完整呈现。需要新素材或参数时必须同时扩展校验与素材映射，不在样式中偷偷引用外部资源。
3. 指定场景的 `transition` 即可使用已注册效果。只有希望它参与自动轮换时，才加入 `style.json.motion.transitionKinds`；注册表与默认选择池分开维护，未实现的名称会被拒绝。
4. 补充效果的起始、中间和完成状态测试，实渲接点并看连续过程。核对露底、重影、标题叠字、可读落点和真实动作时长，再决定是否加入默认池。

替换某个已有效果可修改同名函数；需要保留旧项目表现时使用新名称。默认池的种子选择保持确定性。当前这些场景固定为 1920×1080 横版，新比例要同时实现布局与几何。

运行基础回归：

```sh
node --test assets/remotion/tests/cartoon-contract.test.mjs assets/remotion/tests/editorial-contract.test.mjs
```

## 入场、强调、角色动作与新场景

转场注册表只负责场景切换。元素入场、强调和角色运动仍分别在 `src/cartoon.jsx`、`cartoon-motion.mjs`，时长取 `style.json.motion`；新增这些行为时修改对应实现并检查实际帧。

可选模块现通过 `effects/contract.mjs → effects/motion.mjs → src/effects/ → src/cartoon.jsx` 调用。Bot 外观与动作分开；SceneEffects 组合非角色效果，BotActors 保持跨场单一身份；新项目预设由 `assets/production/presets/` 选择。完整接口见 [动画模块](tools/animation-modules.md) 与 [产品演示动效](tools/business-effects.md)，不需要为新题材复制单期工程。

| 新表现 | 应同时更新的代码 |
|---|---|
| 小龙新场景类型 | `src/cartoon.jsx` 的画面、`cartoon-contract.mjs` 的类型与字段校验；新增素材需更新 `mapCartoonAssets`，新增状态需更新 `cartoonStillPoints` |
| 编辑式新图解 | `src/editorial.jsx` 和 `editorial-contract.mjs` 的校验、素材映射、关键帧取样 |
| 实录新信息层 | `src/index.jsx` 的绘制、`render.mjs` 的类型与内容校验 |
| 共享元素新结构 | 任务 Python 适配器的 `create_scenes(config, config_dir)`，复用 `shared-motion/core.py` 与转场工具 |
| 新 SVG 装置 | Anatomy `scene.mjs` 的元数据与 `renderFrame(seconds)`，使用独立 SVG 渲染入口 |

真实参数、画面实现、校验和预览取样一起落地，才能对外描述为已支持。复杂图解不强塞进 `steps` 的两三张卡片；可以选择专项路线或补充合适的新场景。需要重复使用时再提取公共组件，不创建空的未来实现目录。

## 已有可执行能力

动效之外，字幕、语音时间、素材绑定和质量检查也已有代码入口；查看 [代码复用地图](tools/reuse-map.md)。优先复用这些入口，新增确定性行为连同校验和可运行输入一起保存。选题判断、事实真实性、真实使用感受和审美结论继续依据实际资料与人工评价，不能由结构校验自动宣布通过。

## 保留共用时间与交付约束

新动画使用最终音轨的语义锚点，固定动作时长与停稳阅读时间分开。默认小龙时间轴无缝覆盖音轨；字幕、口型和互动片尾沿用同一声音。换音频后重新计算词时间和口型，不用新动画改变整段语速或拿历史时间戳凑长度。

海报、语言音色、字幕与发布文案独立于转场实现；只改转场不要求重做其他已经认可的内容。重渲后重新绑定受影响的检查记录，不把自动测试当作审美或听感通过。

## 接入其他渲染工具

当前未附通用 GSAP／WebGL 渲染工程。已有可信本地工程可作为专项适配，但先确认输入接口、锁定依赖、画布、帧率、时长与按时间 seek 的逐帧导出；关闭不符本期的默认品牌和声音行为。复用本技能最终音轨，先验证连续样片与所有接点再扩展，不靠实时计时器录制冒充确定性渲染。

公共能力更新后，用不同解释结构的主题检查新实现，而不只是换产品名。实际观察支持到哪里就描述到哪里；自动测试与文档完整不代表任意主题同样达标。
