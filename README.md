# vi-say

简体中文 | [English](README_EN.md)

**把内容讲给你看。**

`vi-say` 取 **Visual + Say**：用画面展示，用声音讲述。它是一套面向 AI 编程助手的视频制作 skill，将 GitHub 项目、官网、文章链接、已录视频或知识主题整理成讲解视频，并制作配套海报与发布文案。

随包提供小龙立体卡通示例风格；角色、配色、音色、海报和动画可以分别调整。Agent 入口是 [SKILL.md](SKILL.md)，调用名称为 `$vi-say`。

## 作品示例

完整视频可在自媒体平台搜索账号 **ABCD伐木雷** 观看。

| 宠物系统实战 | Handy 工具分享 |
|:---:|:---:|
| <img src="docs/examples/pet-system/poster-3x4.png" alt="宠物系统实战海报：Claude Code 接上 GPT，impeccable 实战" width="320"> | <img src="docs/examples/handy/poster-3x4.png" alt="Handy 工具分享海报：开口就能写" width="320"> |
| [3:4 原图](docs/examples/pet-system/poster-3x4.png) · [4:3 原图](docs/examples/pet-system/poster-4x3.png) · [宽版原图](docs/examples/pet-system/poster-wide.png) | [3:4 原图](docs/examples/handy/poster-3x4.png) · [4:3 原图](docs/examples/handy/poster-4x3.png) · [宽版原图](docs/examples/handy/poster-wide.png) |

## 安装与直接使用

### 1. 安装到 Agent

先下载或克隆本仓库，再进入包含 `SKILL.md` 的仓库根目录。以 Codex 首次本地安装为例，可以建立用户级软链接，让后续源码修改直接生效；已有同名技能目录时更新该副本，不在其中再次创建同名链接：

```sh
mkdir -p "$HOME/.agents/skills"
ln -s "$PWD" "$HOME/.agents/skills/vi-say"
```

也可以将完整技能目录复制为 `~/.agents/skills/vi-say/`；若已经取得 `vi-say.skill` 分发包，它是 ZIP，将包内的 `vi-say/` 解压到该技能目录即可。最终应能找到 `~/.agents/skills/vi-say/SKILL.md`，同时保留 `LICENSE`、`references/`、`scripts/` 和 `assets/`。

Codex 的项目级技能也可放在制作项目的 `.agents/skills/vi-say/`。本地发现目录、软链接支持及显式调用方式见 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills)。其他 Agent 按各自的技能目录与调用方式安装，本仓库没有逐个平台完成验证。

### 2. 显式调用 `$vi-say`

安装后，在制作项目中向 Agent 发送需求，推荐在提示词中写上 `$vi-say` 明确选用本技能。Codex CLI／IDE 扩展可用 `/skills` 或输入 `$` 查找；若安装后尚未发现，重启 Codex 再试。

可以直接复制下面的模板，替换方括号中的内容：

```text
使用 $vi-say，把 [项目链接／官网／文章／知识主题／本地视频路径] 做成讲解视频。
面向 [受众]，重点讲清 [一个问题或收益]。
目标时长 [时长]，视频比例 [比例]，声音使用 [保留原声／已授权的本地音色]。
先展示一张代表海报，再完成脚本、演示与动画，交付成片、海报和发布文案。
```

只需提供已有信息；没有特别要求的风格沿用随包默认，不必先手工填写所有配置。想先看方向再继续时，可以明确加一句：**“先只做海报和内容提纲，等我确认后再制作视频。”**

### 3. 按场景提需求

| 想做什么 | 可直接使用的提示词（替换方括号内容） |
|---|---|
| GitHub 项目分享 | 使用 $vi-say 介绍这个项目：[仓库地址]。面向开发者，讲清解决的问题、主要特点和基本用法，先展示海报。 |
| 官网／产品分享 | 使用 $vi-say 把这个产品官网做成介绍视频：[官网地址]。围绕一个实际使用场景，展示真实界面与效果。 |
| 文章／链接解读 | 使用 $vi-say 解读这篇文章：[文章地址]。提炼三个关键观点，保留必要条件和来源，用图解辅助说明。 |
| 已录视频剪辑 | 使用 $vi-say 剪辑这个录屏：[本地视频路径]。保留原声和完整操作画面，删掉重复与多余停顿，加章节和重点提示。 |
| 知识科普 | 使用 $vi-say 解释 [知识主题]，面向初学者，用例子、流程图和状态变化讲清原理，先给海报与提纲。 |
| 实战复盘 | 使用 $vi-say 整理这次实践：[目标和素材路径]。先展示修改前后，再讲关键过程与最终结果。 |

### 4. 准备所需能力并逐步调整

Agent 按任务检查运行条件。剪辑和渲染需要 Python、Node/npm、FFmpeg、中文字体及对应依赖；生成配音还需本地模型和授权参考声音，配置见 [本地配音](references/tools/local-tts.md)。声音样本、准确转写和配置放在制作项目 `private/voice/`，不随公共技能分发。缺少配音条件时可以先明确要求无声样片。

配音模型默认下载到**当前制作项目的 `private/models/`**，随项目保存、迁移和清理。用户也可自行选择共享模型，通过配置文件的相对路径或项目内软链接引用已有权重。安装或移除 skill 不会自动下载或删除这些模型。

多种授权音色可分别放在 `private/voice/female/`、`private/voice/male/` 等目录。可以指定一种，也可以每期随机选择一次；正文、补录与片尾保持同一音色，配置方法见 [多音色与每期选择](references/tools/local-tts.md#多音色与每期选择)。

默认最终海报需要 Agent 环境中可用的图像生成工具；脚本封面是可选排版草稿。链接取材依赖 Agent 可用的浏览器或连接器，本地素材应提供它能访问的路径。

看到海报或样片后，可以直接继续说“标题换成这个角度”“保留海报，只调整口播”“把这一段改成流程图”或“新增一种转场，先看连续样片”。单期要求写在对话与任务记录里；要修改长期默认风格，按 [流程节点](references/workflow.md) 找到对应 Markdown，新增行为按 [扩展说明](references/extensions.md) 接入。

## 制作场景

| 场景 | 输入 | 内容组织 |
|---|---|---|
| GitHub／开源项目分享 | 仓库地址、README、文档、演示素材 | 解决什么问题、主要特点、用法与适用人群 |
| 官网／产品分享 | 官网、功能页面、截图、录屏 | 使用场景、功能亮点、操作与效果 |
| 文章／其他链接分享 | 文章、教程、报告、文档地址 | 提炼重点、解释结论、整理步骤 |
| 已录视频剪辑 | 真人口播、操作录屏、原始片段 | 选段、去重复和多余停顿、重排、重点提示 |
| 知识科普／原理解说 | 主题、提纲、可靠参考资料 | 概念、流程、关系、比较与案例 |
| 实战案例／过程复盘 | 目标、过程记录、修改前后素材 | 问题、过程、变化和结果 |

这些是内容入口，可以组合；GitHub 分享也可以包含真实操作和原理图解。资料读取、事实核实和脚本组织由 Agent 使用当前可用工具完成，仓库没有统一的链接抓取服务。

## 共用制作流程

**理解素材 → 提炼主题 → 海报预览 → 完整脚本与分镜 → 原声剪辑／配音 → 时间轴与画面 → 样片 → 检查与交付。**

详细执行标准集中在 [共用流程](references/workflow.md)。各场景复用以下阶段，按任务保留原声或生成配音、选择图解与演示方式：

| 阶段 | 应得到什么 |
|---|---|
| 理解与提炼 | 明确受众、一个核心问题、真实收益及支持素材 |
| **前置海报** | 先生成并展示一张代表海报，让用户尽早看到主题、内容重点和视觉方向 |
| 脚本与分镜 | 完整口播或原声保留区间，以及每段要展示的对象、动作和结果 |
| 声音 | 原声剪辑母版，或经过术语预检和实际听审的本地配音 |
| 时间轴与画面 | 根据最终音轨编排字幕、角色、流程图、操作演示、强调和转场 |
| 样片 | 检查关键布局、动作、接点与声音对应关系，再扩展全片 |
| 交付 | 成片、音轨、所需字幕、三比例海报、发布文案及实际检查记录 |

海报在完整脚本和配音之前提供内容预览。海报内容均衡饱满、四周留白舒适；16:9 横向展开。每次调用持续提供固定字形/材质参考，局部修改保留未被本轮明确修改的字号、排字、主体比例与点缀。每个所需比例默认只生成一次，检查后展示，后续制作与交付复用；发现问题如实标注，不由 Agent 自动反复生成。用户明确要求修改时，只对指定比例生成一版修订，详见 [海报停止条件](references/stages/poster.md#生成次数与停止条件)。最终交付核对它与视频是否一致，只补齐未生成的比例。海报只能帮助判断主题和视觉方向，运动、发音与操作真实性仍在后续检查。用户明确要求先确认海报时等待其反馈；其他任务按已有要求继续制作。


新合成声音先用完整语句覆盖全部术语做短测，再核对最终整轨的发音、连贯性与声线一致。正式有声小龙输出会校验听审记录与文件哈希；未听审只能显式生成带标识的候选，详见[声音节点](references/stages/voice.md)与[制作门禁](references/tools/production.md#底层有声小龙门禁)。


## 各场景共用的能力

| 能力 | 已有实现与规范 |
|---|---|
| 内容与脚本 | 素材理解、主题提炼、口播、分镜与事实依据，由 Agent 按流程编排 |
| 语言、音色与声音 | 原声保留、本地授权参考声音、语言参数、术语表、停顿和响度处理 |
| 字幕与语义时点 | 时间戳接入、字幕对齐、强调词、SRT 与字幕后处理 |
| 角色与视觉 | 小龙母版、左右站位、镜像、音量驱动开闭嘴、色板和字体 |
| 图解与演示 | 步骤、比较、流程关系、柱状图、截图／录屏和状态变化 |
| 动画与转场 | 固定实际时长、角色迁移、四种默认转场、共享元素专项路线 |
| 统一互动片尾 | 留言→关注→点赞，同音色口播及实测词时间 |
| 海报 | 前置预览、图像生成规范、三比例独立构图；代码排版作为可选草稿 |
| 发布文案 | 本期标题、正文、相关链接、互动问题和话题，由 Agent 按规范撰写 |
| 检查与交付 | 时间与结构检查、证据和文件哈希、样片审看、音频修改记录、打包 |

`production.py` 集成默认角色场景、素材整理、口型分析、封面草稿和 Remotion 调用；配音、录屏剪辑、字幕和专项动画有独立入口。最终海报需要当前环境的图像生成工具。这里描述的是 Agent 与脚本协作的流程，单条渲染命令不会自动完成资料搜集、写稿、配音和所有验收。

## 脚本命令（开发与手动调试）

日常使用可直接通过上面的对话方式交给 Agent 编排；需要手动调试项目、封面草稿或渲染时使用本节命令。

从本仓库根目录运行：

```sh
python scripts/production.py init work/demo --title '让好想法动起来' --subtitle '有角色、有节奏、有色彩'
```

先按 [海报规范](references/stages/poster.md) 制作并展示代表海报。需要快速代码排版草稿时，也可独立调用：

```sh
python scripts/production.py covers work/demo/project.json --output-dir outputs/demo-covers
```

之后填写完整 `narration.txt`、术语表和项目场景。初始化场景只是无声编排示例。以下命令用于观察画面，正式版必须按最终音轨重新绑定时间：

```sh
python scripts/production.py render work/demo/project.json --output-dir outputs/demo-preview --preview
```

正式渲染还需要最终 WAV 与真实听审记录，格式见 [制作入口](references/tools/production.md)：

```sh
python scripts/production.py render work/demo/project.json --output-dir outputs/demo-final --audio work/demo/final.wav --listening work/demo/REVIEW.json
```

Python 需要 Pillow，口型与部分图形工具另需 NumPy；音视频处理需要 FFmpeg（部分脚本可用 imageio-ffmpeg）。Remotion 需要 Node/npm 与兼容浏览器。使用有权限的本机中文字体，必要时设置 `VIDEO_FONT_BOLD`。本地配音环境、模型和参考声音另按 [配音说明](references/tools/local-tts.md) 准备。

Remotion 依赖按锁文件、系统架构和 Node 主版本缓存在 `.cache/remotion/`，跨项目复用；不要每个项目复制工程并重新安装依赖。

## 代码组织与扩展

```text
SKILL.md                    Agent 入口、场景选择与必要约束
LICENSE                     Apache-2.0 许可证全文
NOTICE                      Anthony Li 版权与署名声明
README_EN.md                英文安装、使用与扩展说明
references/workflow.md      共用制作流程与各场景的差异
references/extensions.md    配置修改、新动画与新场景的扩展位置
references/stages/          各流程节点的写法、风格与检查要求
references/tools/           配音、剪辑、渲染和修复工具的接口
references/styles/          可替换的角色和视频色板
references/runtime/         CPU 环境的固定依赖与模型来源记录
scripts/                    项目、配音、剪辑、字幕、海报草稿与检查工具
scripts/tests/              Python 回归测试，不随 skill 分发
assets/production/          默认角色、色板、动作参数、互动片尾与海报参考
assets/remotion/            默认场景、信息层、知识动画、转场注册表与渲染
assets/shared-motion/       共享元素及空间迁移专项工具
assets/editorial-motion/    六类编辑式视觉布局及无声示例
assets/anatomy-video/       时间驱动的 SVG 原理解说渲染接口
```

### 脚本分工

`scripts/` 顶层保留运行入口与内部模块，按制作路线或待解决的问题调用：

| 用途 | 脚本 |
|---|---|
| 默认制作、海报草稿与口型 | `production.py`、`production_design.py`、`speech_motion.py` |
| 音色选择、本地配音与语速／术语处理 | `select_voice.py`、`local_voice.py`、`local_voice_segments.py`、`run_cpu_voice.sh`、`audio_timing.py`、`pronunciation.py` |
| 原声剪辑与字幕 | `prepare_recording.py`、`align_captions.py`、`render_captions.py` |
| 简单图片时间轴视频 | `render_video.py` |
| 动画／空间计划、画面变化与交付记录检查 | `audit_motion.py`、`scan_visual_holds.py`、`check_spatial_plan.py`、`check_visual_plan.py`、`check_acceptance.py` |
| 音频修订记录、能量变化与降噪效果证据复核 | `audio_acceptance_candidate.py`、`audio_revision_audit.py`、`check_audio_energy_regression.py`、`check_background_utility.py` |

Python 回归测试统一放在 `scripts/tests/`。安装上述 Python 依赖后运行：

```sh
python -m unittest discover -s scripts/tests -p 'test_*.py'
```

固定流程与具体表现分开维护。后续某项效果不满意，可以先调整参数、替换该项实现，或增加新效果。已实现的转场集中在 `assets/remotion/cartoon-transitions.mjs`；自动选择哪些效果由 `style.json.motion.transitionKinds` 决定。新增动画的接入与验证见 [扩展说明](references/extensions.md)。

| 修改对象 | 入口 |
|---|---|
| 视频色系 | [colors.md](references/styles/colors.md)、`style.json.palette` |
| 海报风格 | [poster.md](references/stages/poster.md)、`style.json.poster` 和参考图 |
| 音色与语言 | [local-tts.md](references/tools/local-tts.md)、制作项目的私有声音配置 |
| 角色与口型 | `style.json.character`、角色素材、`src/cartoon.jsx` |
| 动作时长与默认转场池 | `style.json.motion` |
| 新增／替换转场 | `cartoon-transitions.mjs`，统一由 `cartoon-motion.mjs` 调用 |
| 新图解或场景 | 对应 JSX／Python／SVG 实现及其输入校验，见扩展说明 |
| 互动片尾 | `assets/production/outro.json`，每期重新绑定实际口播词时间 |
| 发布文案 | [publishing-copy.md](references/stages/publishing-copy.md) |

每个流程节点都有独立 Markdown，默认偏好在对应节点维护。想换自己的选题角度看 [内容](references/stages/content.md)，换口播写法看 [脚本](references/stages/script.md)，换叙事与镜头组织看 [分镜](references/stages/storyboard.md)，换语言和音色看 [声音](references/stages/voice.md)，换流程图与画面表现看 [图解](references/stages/visuals.md)，改动画看 [动画](references/stages/animation.md)，改收尾看 [片尾](references/stages/outro.md)。完整的十一节点索引见 [workflow.md](references/workflow.md)。

单期偏好保存在本期任务记录；要改变所有后续默认行为时再修改公共节点文档。描述偏好只需改文档，超出现有参数的效果还要修改对应配置或代码，接入规则见扩展说明。

## 当前范围

- 默认小龙和 Remotion 编辑式完整场景支持 16:9；三比例海报分别为 4:3、3:4、16:9。竖版角色视频需要单独实现布局。
- 角色是具有立体美术风格的透明图片图层；开闭嘴根据音量变化，不是三维骨骼或音素口型。
- 配音后端为本地 MLX 或 PyTorch CPU。字幕工具需要外部 ASR／对齐结果，尚无统一的 ASR 安装与转换入口。
- 自动检查验证结构、时间和记录对应关系，画面与听感仍需实际审看。专项路线并非全部接入默认制作命令。

## 分发

版本号统一维护在 [SKILL.md](SKILL.md) 的 `metadata.version`，使用 [Agent Skills 规范支持的元数据字段](https://agentskills.io/specification#metadata-field)。开发版本带 `-dev` 后缀；正式发布时更新为不带该后缀的版本号，再创建对应 Git 标签。已有 `0.0.1` 标签保留为此前的主分支基线。

```sh
python scripts/production.py pack outputs/vi-say/vi-say.skill
```

`.skill` 是 ZIP，解压后的目录名为 `vi-say`，安装到所用 Agent 的技能目录后通过 `$vi-say` 调用。包内的 `SKILL.md` 保留同一版本号，无需维护另一份包版本。打包包含 `LICENSE`、`NOTICE` 和运行所需规则、脚本与素材，排除测试、缓存、工作目录、产物和私人资料。全局已安装的旧技能不会随编辑本仓库自动更新。仓库地址为 [anthonyli/vi-say](https://github.com/anthonyli/vi-say)，包名和调用名为 `vi-say`。

## 许可证

本仓库的原创代码与 skill 文档采用 [Apache License 2.0](LICENSE)，作者为 **Anthony Li**，版权与署名声明见 [NOTICE](NOTICE)。源码文件使用 `SPDX-License-Identifier: Apache-2.0` 标识许可证。再分发时须遵守许可证第 4 条，包括附带许可证、保留适用的版权与署名声明，以及在修改过的文件中标明修改。

角色生成记录见 `assets/production/character.json`；第三方依赖、参考素材、字体与声音各自遵循其实际许可，不因本仓库更换许可证而改变。私人声音、模型、字体、密钥和依赖缓存不随技能分发。
