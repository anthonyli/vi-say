---
name: vi-say
description: 将 GitHub 项目、官网、文章链接、已录视频或知识主题制作成讲解视频、动态演示和三比例海报。先用海报呈现内容方向，再组织口播与画面；支持原声剪辑、授权本地配音和可扩展的角色、图解与动画。
license: Apache-2.0
metadata:
  author: Anthony Li
  version: "0.0.7"
---

# vi-say：把内容讲给你看

名称取 Visual + Say。适用于项目分享、产品介绍、文章解读、已录视频剪辑、知识科普和实战复盘。随包小龙是可替换的示例风格；当次品牌、参考、角色和已认可素材优先。

## 共用流程与按需读取

先读 [workflow.md](references/workflow.md) 选择场景与制作路线，再读取当前节点的文档。各节点分别维护输入输出、可替换偏好、实际工具和必要检查；不要每次加载全部工具说明。

模块沉淀可复用的方法、可替换偏好、参数、素材与验证方式。单期产品、定制台词、能力名单、事实数字、参考来源和发布状态保存在项目资料中；小龙固定开场与角色素材属于系列配置，不携带某期选题。

GitHub 项目介绍默认核对并说明当期 Star 数，采集可用的真实产品截图用于成片，口播前 3–5 秒先给出吸引人的具体问题或收益；细节见 [内容](references/stages/content.md#github-项目介绍默认项)、[脚本](references/stages/script.md) 与 [画面](references/stages/visuals.md#真实产品截图)。

| 流程节点 | 独立文档 | 可以调整什么 |
|---|---|---|
| 1. 理解与提炼 | [content.md](references/stages/content.md) | 受众、选题角度、内容范围 |
| 2. 前置海报 | [poster.md](references/stages/poster.md) | 参考图、标题、配色、构图 |
| 3. 完整脚本 | [script.md](references/stages/script.md) | 表达口吻、叙事结构、传播目标 |
| 4. 分镜 | [storyboard.md](references/stages/storyboard.md) | 解释方式、镜头组织、阅读顺序 |
| 5. 声音 | [voice.md](references/stages/voice.md) | 原声／配音、语言、授权音色、节奏 |
| 6. 字幕与语义时间 | [captions.md](references/stages/captions.md) | 显示方式、字体、强调、位置 |
| 7. 画面与图解 | [visuals.md](references/stages/visuals.md) | 视觉风格、流程图、比较、操作演示 |
| 8. 动画与样片 | [animation.md](references/stages/animation.md) | 动作、转场组合、新增效果 |
| 9. 互动片尾 | [outro.md](references/stages/outro.md) | 文案、行动、图标和布局 |
| 10. 发布文案 | [publishing-copy.md](references/stages/publishing-copy.md) | 标题、正文、互动问题、话题 |
| 11. 检查与交付 | [delivery.md](references/stages/delivery.md) | 交付组合、实际检查记录 |

海报在内容提炼之后、完整口播和配音之前先生成并展示。用户明确要求先确认时等待反馈，其他任务按已有要求继续；未回复不能记为认可。片尾在最终声音与时间轴中编排，按序号单独审看不代表最后才拼入另一段声音。

海报默认每个所需比例只调用一次图像生成，已有本期海报直接复用；检查、交付和工具等待不触发再次生成。用户明确要求修改时，只对指定比例生成一版修订。海报内容均衡饱满，同时保留舒适边距；每次调用持续携带固定的圆润字形/材质参考，修订保留未被本轮明确修改的既定排字、字号、主体比例与点缀。16:9 横向展开。具体停止条件与构图见 [poster.md](references/stages/poster.md)。

## 风格与实现入口

- 改配色读 [色板](references/styles/colors.md)，换角色或口型读 [角色](references/styles/character.md)。
- 沿用小龙系列时，固定开场与问题切入见 [脚本](references/stages/script.md#小龙系列固定开场)，女声选择见 [声音](references/stages/voice.md#小龙系列的声音选择)，去标点与关键词高亮见 [字幕](references/stages/captions.md#中文口播的显示标点与关键词)。其他角色、原声剪辑及当次明确要求继续按各自任务处理。
- 小龙系列的明亮玻璃科技风见 [玻璃视觉](references/styles/glass.md)；造型独立放在 [Bot 样式](references/styles/bots.md)，动作另见 [动画](references/stages/animation.md#小龙与-bot-的动作编排)。已实现的可选模块、字段与运行命令见 [动画模块接口](references/tools/animation-modules.md)；新项目默认使用 `glass` 预设，也可显式选择 `classic`。
- 企业产品片可选择 [产品演示动效](references/tools/business-effects.md)：面板汇聚、节点拖放、关系图、扫描、图表、文档交接；`studio` 预设可隐藏角色。先用 `python scripts/production.py catalog` 查询实际模块，再按 JSON 示例组合。其他可执行能力见 [代码复用地图](references/tools/reuse-map.md)。
- 改参数、新增动画或接入新场景读 [extensions.md](references/extensions.md)。配置只使用已实现字段，新效果要同时落地画面、校验和实际样片。
- 需要丰富转场时，按需读 [GL 转场](references/tools/gl-transitions.md)：30 种真实 shader 与 5 种基础转场全部参与自动轮换；场景指定优先，未指定时按场景关系排序，旧名称兼容，沿用当前流程与共用 Remotion 环境。
- 默认角色路线的命令、项目格式和正式音频记录见 [production.md](references/tools/production.md)。其他工具按 workflow 的接口表选择，不混用 JSON schema。

## 共用约束

- 事实和效果依据本期资料与真实素材；模拟界面、对话和图解明确标示意。
- 已录视频默认保留原声、原速，剪辑音画同步；新声音使用获授权的当前参考。参考认可不等于合成整轨认可，术语短测和最终全轨听审分别核对；跨生成版本替换还须听查声线连续性。默认速度 1.0，错音修订完整语义段落，未听审只交付明确候选。
- 正式字幕、口型与动画使用最终声音的可靠时间。改稿或换音轨重新对齐，动作时长不随整段等比例拉伸。
- 自媒体有旁白产品片默认交付可见字幕；英文按词与意群断行。声音模板集中放当前项目 `private/voice/`，具体见 [字幕](references/stages/captions.md) 与 [声音模板](references/tools/voice-templates.md)。
- 静态画面、连续运动、音画语义与听感分别检查。自动记录校验不等于审美或听感通过，没有实际检查就标明未检查。
- 制作、候选和听审状态默认写入文件名、交付说明与检查记录，不自动烧录到视频画面。只有用户明确要求时才显示这类状态提示；去掉画面提示不改变真实检查结论。
- 默认小龙与编辑式完整场景为 16:9，其他比例需要对应实现；三比例海报分别独立构图。具体默认值在各节点与风格文件维护。

## 工作目录与分发

从技能根目录调用脚本；`private/` 只存用户私有模型、音色参考及必要配置，不放单期制作生成物。试音、旁白、分段缓存、日志与检查记录写入 `work/<项目>/`，成品交付写入 `outputs/<项目>/`；用户明确选为可复用音色的参考样本才保存到 `private/voice/`。本地配音模型默认下载到当前制作项目的 `private/models/`；用户选择共享模型时，按其指定的本地路径配置，不重复下载。Remotion 共用技能根 `.cache/remotion/`，不逐项目复制依赖。安装、模型与浏览器按当前环境和任务授权准备。

日常修改与验证不递增技能版本，也不生成 `.skill` 交付包。执行用户要求的代码提交并推送时，为这一批改动统一递增一次版本，版本改动随代码一起提交推送；推送重试不重复递增。仅在用户要求打包、安装或发布时执行相应分发。打包功能的自动化测试使用临时目录，不留下交付包。

`outputs/` 根目录只放项目目录；视频、音轨、海报和 ZIP 等交付文件放在对应项目内，已有版本子目录时与该版本产物放在一起，不把打包文件另放到根目录。

用户要求归档时，使用 `python scripts/production.py archive`，按 [归档工具](references/tools/archiving.md) 填写本期清单并执行。固定脚本负责按日期与项目保存成品、哈希去重、重建交付包和验证后清理工作副本；不为每期重写临时脚本，不把制作过程放进归档。

需要分发时用 `python scripts/production.py pack outputs/vi-say/vi-say.skill`，排除测试、缓存、产物、私人声音、模型与密钥。私有音色配置只从当前制作项目读取，不自动查其他项目。全局安装副本不会随源码编辑自动更新。

本技能的原创代码与文档作者为 Anthony Li，采用 [Apache-2.0 许可证](LICENSE)，版权声明见 [NOTICE](NOTICE)。分发包须携带这两个文件；第三方依赖与素材保留各自许可及声明。
