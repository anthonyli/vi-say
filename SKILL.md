---
name: vi-say
description: 将 GitHub 项目、官网、文章链接、已录视频或知识主题制作成讲解视频、动态演示和三比例海报。先用海报呈现内容方向，再组织口播与画面；支持原声剪辑、授权本地配音和可扩展的角色、图解与动画。
---

# vi-say：把内容讲给你看

名称取 Visual + Say。适用于项目分享、产品介绍、文章解读、已录视频剪辑、知识科普和实战复盘。随包小龙是可替换的示例风格；当次品牌、参考、角色和已认可素材优先。

## 共用流程与按需读取

先读 [workflow.md](references/workflow.md) 选择场景与制作路线，再读取当前节点的文档。各节点分别维护输入输出、可替换偏好、实际工具和必要检查；不要每次加载全部工具说明。

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

## 风格与实现入口

- 改配色读 [色板](references/styles/colors.md)，换角色或口型读 [角色](references/styles/character.md)。
- 改参数、新增动画或接入新场景读 [extensions.md](references/extensions.md)。配置只使用已实现字段，新效果要同时落地画面、校验和实际样片。
- 默认角色路线的命令、项目格式和正式音频记录见 [production.md](references/tools/production.md)。其他工具按 workflow 的接口表选择，不混用 JSON schema。

## 共用约束

- 事实和效果依据本期资料与真实素材；模拟界面、对话和图解明确标示意。
- 已录视频默认保留原声、原速，剪辑音画同步；新声音使用当前获授权、已认可音色。默认速度 1.0，错音重生成完整语义段落。
- 正式字幕、口型与动画使用最终声音的可靠时间。改稿或换音轨重新对齐，动作时长不随整段等比例拉伸。
- 静态画面、连续运动、音画语义与听感分别检查。自动记录校验不等于审美或听感通过，没有实际检查就标明未检查。
- 默认小龙与编辑式完整场景为 16:9，其他比例需要对应实现；三比例海报分别独立构图。具体默认值在各节点与风格文件维护。

## 工作目录与分发

从技能根目录调用脚本；制作项目数据放自己的 `work/`、`outputs/` 和 `private/`。Remotion 共用技能根 `.cache/remotion/`，不逐项目复制依赖。安装、模型与浏览器按当前环境和任务授权准备。

分发用 `python scripts/production.py pack outputs/vi-say.skill`，排除测试、缓存、产物、私人声音、模型与密钥。私有音色配置只从当前制作项目读取，不自动查其他项目。全局安装副本不会随源码编辑自动更新。
