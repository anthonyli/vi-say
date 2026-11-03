# 默认小龙制作命令与项目格式

跨场景的固定阶段见 [workflow.md](../workflow.md)，配置和新动画入口见 [extensions.md](../extensions.md)。本页维护默认小龙路线的实际命令与输入格式。

建项目并提炼主题后，先按 [poster.md](../stages/poster.md) 生成并展示一张代表海报，让用户尽早看到内容方向，再展开完整脚本、配音和动画。原声路线先理解录屏内容；成片交付前复核海报并补齐其他比例。

所有命令从技能根目录调用。运行脚本需要 Python/Pillow、Node/npm；若现有 Python 缺少依赖，可用 `uv run --with pillow --with numpy python scripts/production.py ...`。uv 会缓存环境，不给每个项目重新安装。不要修改用户系统 Python。

## 项目与风格

`production.py init` 建立 `project.json`、`narration.txt`、`lexicon.json`。项目名与输出目录由任务决定；每次选择新的输出目录，脚本拒绝覆盖。

默认 `style_id=colorful-dragon-v1`。角色、颜色和动作参数的唯一来源为 `assets/production/style.json`。新增主题不复制一套颜色常量；需要改变系列风格时，改源配置并重新验证。`dragon.png` 是母版，`character.json` 保存生成方式与提示。

`project.json` 的 `title/subtitle/series` 用于脚本封面草稿；`narration/lexicon/font` 路径相对该文件。`font` 可省略，使用 `VIDEO_FONT_BOLD` 或探测到的中文字体。脚本三种比例各自排版，标题放不下会报错；最终海报按 [poster.md](../stages/poster.md) 使用图像生成工具独立制作。默认视频是横版，海报横竖版不意味着支持竖版视频。

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

前一命令输出 `spoken.txt`、`sample.txt`、`pronunciation.json`。英文、数字存在未声明项时退出 1。短测取完整句子，不拼字。用已授权声音生成并听短测，修正发音表或重生成完整段落；满意后以 `spoken.txt` 正式合成。显示稿保留原术语，后续按真实音频重新对齐。脚本只固定输入和检查清单，不保证模型发音。

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
  "reviewed_terms":["PageOn","API","1.5倍"],
  "evidence":{"path":"listening-notes.txt","sha256":"该真实记录的SHA256"},
  "unresolved_items":[]
}
```

也接受确有音频感知能力的 `direct_audio_inspection_interface`；ASR 或技术脚本不可冒充该方法。证据路径相对 REVIEW.json。改稿、换音轨、改声音处理后旧记录失效。用户拒绝过的版本另按 [audio-quality.md](audio-repair.md) 检查，不能只补一个新表绕过历史反馈。

## 场景与固定动作

每场 `kind/start/end/title/subtitle/label`；`start/end` 是最终音频秒数，必须从 0 无缝覆盖 WAV 的实测时长，每场至少 1.5 秒。小龙、标题和背景使用统一材质语言与色板；角色当前是透明图层动画，不是三维骨骼模型。

- `hero`：角色和大标题开场。
- `steps`：2–3 个有语义顺序的步骤；`items` 含 `text/detail/at`。
- `demo`：真实截图或录屏展示；素材放在项目内，通过 `image` 或 `video` 指定，二者只选一个。视频可设 `videoStart` 为源视频起点秒数，声音统一来自最终 WAV。
- `cta`：2–3 个互动提示；`items[].at` 对应实际口播词起点，画面只做示意。

`items[].at` 是场内秒数。每次动作使用配置中的固定时长；相邻动作不得挤掉前一动作，片尾要留完成和停留时间。只改时间锚点，不把整段按比例缩放。原始录屏声音与画面剪辑要同步；需要全屏操作证据时继续用 [录屏路线](recorded-video.md)，不要挤进不适合的小窗。

```sh
python scripts/production.py render PROJECT/project.json --output-dir OUTPUT/study --preview --stills
python scripts/production.py render PROJECT/project.json --output-dir OUTPUT/silent --preview
python scripts/production.py render PROJECT/project.json --output-dir OUTPUT/final \
  --audio PROJECT/final.wav --listening PROJECT/REVIEW.json
```

前两条用于自动检查画面与运动。先看海报、入场中间帧和完成帧，再以原速观看短片；修复遮挡、溢出、拖沓或生硬接点后再扩展。程序拒绝无声样片被无标识地当成配音成片。正式输出仍需检查 AAC 编码后的音轨、操作真实性及音画对应。

## 共用 Remotion

`node assets/remotion/runtime.mjs`：首次按锁文件安装，随后报告 `reused:true`。位置为技能根 `.cache/remotion/<锁文件+系统架构+Node主版本哈希>/`。不要移动或改写系统环境变量；可用任务专属 `NARRATED_VIDEO_CACHE` 指定其他目录。多个项目直接调用同一个技能入口，无需项目内 `npm install` 或复制 `node_modules`。并发首次安装通过目录锁协调，失败不会标记为就绪。

`REMOTION_BROWSER_EXECUTABLE` 可指定已有 Chrome；Mac 默认探测标准安装位置。需要自动下载浏览器时，下载位置也在共用依赖目录下。版本相同的依赖复用，不共享项目输入、字幕、截图或输出。素材暂存与输出路径独立。依赖升级修改 package.json 与 lockfile 后才会建立新缓存；旧缓存可留作旧项目复现。

## 精简分发

每期交付的发布标题、正文与话题按 [publishing-copy.md](../stages/publishing-copy.md) 生成，独立保存为 `发布文案.txt` 或 `发布文案.md`。该文件统一维护默认口吻与示例。最终 ZIP 中的文案须与最新修订一致。

`python scripts/production.py pack outputs/vi-say.skill` 打包 `SKILL.md/references/scripts/assets`；若另有 `agents/` 配置也会一并包含。排除测试、依赖、缓存、私有声音、模型、产物和历史审计文件。开发测试继续留在源码中。`.skill` 是 ZIP，解压后目录名为 `vi-say`，调用名为 `$vi-say`。

## 风格与共用能力的接入

- 项目 `characterSide`、`transition` 是场景字段；前者选择左右站位，后者选择已注册效果。默认转场池与动作时长取 `style.json.motion`，扩展见 [extensions.md](../extensions.md)。
- 正式 compile 从最终 WAV 生成 `speechMotion`，绑定 fps、时长与声音 SHA，拷贝配准的闭嘴素材；换声音需要重算。角色参数与素材替换规范统一在 [character.md](../styles/character.md)。
- 配色在 [colors.md](../styles/colors.md)，海报与脚本草稿在 [poster.md](../stages/poster.md)，默认输出的 `covers/` 仍为可选草稿。
- 初始项目自动带片尾稿与示例时间。正式片尾文案、词时间、`outroId` 与省略条件统一在 [outro.md](../stages/outro.md)。
- 字体在捕帧前加载，静止后不持续亚像素位移。需要不同字体或新布局时检查实际帧，不把三比例海报推定为三比例角色视频。
