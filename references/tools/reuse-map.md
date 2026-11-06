# 代码复用地图

供选择实现入口使用。可由代码可靠执行的参数转换、时间计算、素材绑定和结构检查直接复用现有工具；内容判断与实际审看仍按节点文档执行。

| 能力 | 已有代码入口 | 执行范围 |
|---|---|---|
| 效果发现与可运行样例 | `scripts/production.py catalog`、`assets/remotion/effects/catalog.mjs` | 从实际字段表和注册表读取效果，校验所有模板，检查每种效果有示例；打包前自动执行 |
| 分镜、预设、素材复制 | `production.py init/compile`、`assets/production/presets/`、`examples/` | 按配置选择效果、复制本地媒体、生成统一时间轴，拒绝未知字段和非法时序 |
| 完整产品界面与字体 | `src/effects/product-shell.jsx`、`node-editor.jsx`、`product-views.jsx`、`assets/production/fonts/` | 保留成熟画面的比例、导航、工具栏、证据与审核布局；文案和数据通过 ui 配置，可变字体保留真实字重 |
| 动效与转场 | `assets/remotion/effects/`、`src/effects/`、`cartoon-transitions.mjs` | 帧时间驱动动作、对象变化与转场，支持跳帧重现；新增实现须接入校验、绘制、采样和样例 |
| GL 与原有转场 | `gl-transitions.json/mjs`、`src/gl-transition.jsx`、`cartoon-transitions.mjs`、`transition-selection.mjs` | 30 种上游 shader 与 5 种基础机制全部进入轮换，显式指定优先，其次场景匹配；7 个旧名兼容但不重复计数；保持声音与角色时间不变 |
| 字幕显示 | `effects/captions.mjs`、`src/effects/highlight-caption.jsx` | 去显示标点、保护术语、关键词高亮，与导出的 SRT 一致 |
| 字幕与语义时间 | `scripts/align_captions.py`、`audio_timing.py` | 基于实际声音生成或整理时间；ASR 有误时仍需修正，不能用文字估时替代 |
| 口型与角色 | `scripts/mouth_cues.py`、`speech_motion.py`、`src/dragon-mouth.jsx` | 绑定当前音频哈希、验证完整时间、驱动嘴形；口型和声音好坏仍须观察和听查 |
| 实录／图解／共享对象 | `prepare_recording.py`、`assets/remotion/src/editorial.jsx`、`assets/shared-motion/` | 分别复用原声剪辑、编辑式图解和对象迁移路线，接口见各工具文档，不混用 schema |
| 结构与运动检查 | `check_visual_plan.py`、`check_spatial_plan.py`、`audit_motion.py`、`scan_visual_holds.py` | 检查计划、空间、运动记录与静止区段；静止检测只是线索，不能直接判定镜头无效 |
| 声音与验收记录 | `check_audio_energy_regression.py`、`audio_revision_audit.py`、`check_acceptance.py` | 检查技术变化、版本绑定与记录完整性；不能自动补造真人听审、真实体验或发布状态 |
| 技能分发 | `production.py pack` | 打包实际实现与通用素材，验证模板，排除项目产物、私人声音、模型与缓存 |
| 交付产物归档 | `production.py archive`、`scripts/archive_project.py` | 本期清单驱动成品保留、哈希去重、ZIP 重建、资源转存和验证后清理；支持失败重试，说明见 [归档工具](archiving.md) |

发布文案的语气、真实体验与事实判断继续由 [发布文案流程](../stages/publishing-copy.md) 引导。代码可以核对字段、来源引用或文件一致性，不能仅凭填写了一个字段就证明使用体验真实。新增自动化优先针对实际重复步骤，不另建一个只有空字段的全流程系统。

新增特效时，以 [产品演示动效](business-effects.md#扩展一个效果) 为入口。样例负责提供可执行输入，测试负责验证行为，实际渲染负责暴露画面问题；三者各自保留。
