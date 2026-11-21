# 小龙系列：漫画分镜与积木搭建

本风格替换旧玻璃／灰绿系列默认。保留小龙、圆润嘴形与角色身份；每期按主题设计背景、色彩占比和道具，不把某一期产品、四个维度或台词写进模板。

## 视觉与叙事

- 漫画分镜使用深墨粗描边、略倾斜的框、硬偏移阴影、适量网点与放射线。气泡承担人物对话和短问题，标题承担结论；不三处重复整段旁白。
- 一个重点一块积木，逐块落下、接触、回弹、停稳，形成有意义的整体。顺序由实际语义决定，保持可见接触与遮挡；不把整片都做成积木罗列。
- 真正介绍产品时，界面／录屏是主角。入口 → 点击 → 结果 → 解释结果，至少完整讲清一条操作链。细字局部放大，旁白与界面当前状态一致；角色缩到不会遮挡的位置。
- 配色起点：墨蓝 `#18233c`、明黄 `#ffdb42`、天蓝 `#72ccf0`、珊瑚红 `#ff775f`、奶白 `#fffbef`、浅紫 `#bda6f4`。按每期主题调整组合、占比和背景道具；不回退为固定玻璃背景。

## 主入口：comic 主题

小龙讲解视频直接用 `production.py init`，默认就是 `--preset comic`。编译、HTML 前审和 MP4 共用 [comic-scene.jsx](../../assets/remotion/src/effects/comic-scene.jsx)，不再每期另写 JSX 或 HTML 工程。版式由 [comic-layout.mjs](../../assets/remotion/comic-layout.mjs) 统一计算。标题和副标题的字数上限与版式容量是对应的，放得下就不会溢出；放不下会在编译时报错，不会出现在成片里。

| 场景 | 固定版式与动作 |
|---|---|
| `hero` | 默认黄底，配放射线和网点。大标题先砸入，副标题框随后弹出，小龙在右侧大景 |
| `demo` | 默认奶白底，左侧是粗描边截图框，没有聚焦时缓慢推近。小龙站在右下，副标题变成它头顶的对话气泡 |
| `steps` | 默认蓝底，每个 `items[]` 是一块积木，在 `at` 时落下、压扁回弹，整屏轻微震动。2–3 块自下而上叠成塔 |
| `stage` | 只有标题和背景，内容全部由 `effects` 组合 |
| `cta` + `outroId` | 共用乐高片尾 [comic-outro.jsx](../../assets/remotion/src/comic-outro.jsx)，三块积木分别落在"留言/关注/点赞"的实测词时间上，最后淡出到墨蓝；录屏路线的片尾用的也是它 |

场景可选字段（仅 comic 主题）：`tone` 改背景色（`yellow/blue/cream/purple/red/white`）；`highlight` 是从标题里原样摘出的一个短语，标题停稳后荧光笔从左到右划过它；`sourceLabel` 是截图左下角的来源标签，默认"界面素材展示"。comic 版式固定把小龙放在右侧，写 `characterSide: "left"` 会报错。`character.mode: "none"` 时截图框自动加宽，副标题改成标题下方的一行字。

可复用效果，在任意场景的 `effects` 里使用，入场动作自带，不叠加通用淡入：

| type | 字段 | 动作 |
|---|---|---|
| `bubble` | `position, text`；可选 `width, height, tail, fontSize` | 弹出后轻微摆动，字号按气泡大小自动选择 |
| `burst` | `position`；可选 `size, text`（不超过 6 字） | 爆炸贴纸弹出，持续轻摆 |
| `brick` | `position, text`；可选 `width, height, detail, angle` | 重力下落，触地压扁回弹，并带一次撞击星 |

口播驱动的动效：呼吸卡片 `cue-cards`（逐条弹出，讲完收进底栏；也可以用手风琴模式）、聚光灯 `spotlight`、手绘圈注 `sketch`、打字机 `typewriter`、印章 `stamp`、逐条打勾 `checklist`。所有效果都可以加 `exit` 设定讲完怎么收起，加 `breathe` 让停留时轻微呼吸，并且可以用 `"cue": "口播里的词"` 代替手填秒数。字段见 [动画模块](../tools/animation-modules.md#每场通过-effects-组合模块)，可运行样例是 `--template cues`。卡片、台座、连线、列表这些旧效果在 comic 主题下会自动画成漫画样式。

动效词汇集中在 [comic-motion.mjs](../../assets/remotion/effects/comic-motion.mjs)：`slam`（标题砸入）、`popIn`（弹出）、`dropLand`（下落触地）、`shake/shakeAll`（撞击震动）、`markerSweep`（荧光笔）、`push`（截图缓推）、`idle`（轻摆）、`fitFont`（自动字号）。时长统一在 `COMIC_MOTION` 里设定。所有动作都是时间的纯函数，拖动进度、并行渲染和 HTML 预览得到的是同一帧。要调整全系列的节奏，就改这一处，不要在单期里重写动作。

转场只从漫画池里选：`gl:BookFlip`、`gl:GridFlip`、`gl:CrossZoom`、`gl:PolkaDotsCurtain`、`gl:CircleIris`、`gl:StarWipe`、`slide`、`wipe`。shader 的背景色会自动换成主题的墨蓝或明黄。片尾固定用 `gl:GridFlip` 进入，这一种不分给普通场景。单场写了 `transition` 仍然以单场为准。会整屏变黑、带反射地板或故障风的 shader 不进这个池。

## 可运行组件

自定义组合时，`assets/remotion/src/comic-kit.jsx` 导出 `ComicTheme`、`COMIC_PALETTE`、`Frame`、`Bubble`、`Brick`、`Dots`、`RayBurst`、`Burst`、`Dragon`、`BrowserShot` 及确定性缓动。使用共用 Remotion runtime，不逐期安装依赖。

```jsx
<ComicTheme.Provider value={{...COMIC_PALETTE, blue:'#72ccf0'}}>
  <Frame x={60} y={130} w={780} h={700} fill="#ffdb42" />
  <Bubble x={110} y={180} w={600} h={160}>本期的具体问题</Bubble>
  <Brick x={980} y={640} w={680} h={110}
    text="本期重点" sub="一句解释" at={4.2} t={time} />
</ComicTheme.Provider>
```

坐标基于 1920×1080；另选比例时重新构图。`Brick.at/t` 为秒，落下约 0.62 秒，`color/angle/small` 控制造型；`Bubble` 可设 `fill/tail/fontSize/rotate/scale`。`Dragon` 的 `t/cues` 绑定当前音轨，public 目录提供已有授权角色文件与本地字体。它们是 JSX 组件，不是旧 JSON 入口的新预设名。

## 转场与检查

读 [GL 转场](../tools/gl-transitions.md)，按镜头关系显式选择现有真实实现。漫画章节可用 `gl:BookFlip`，归纳重排可用 `gl:GridFlip`，进入实录可用低强度 `gl:CrossZoom`，轻松收尾可用 `gl:PolkaDotsCurtain`；这些是候选，不是每片固定顺序。连续产品操作不切碎。

自编工程复用 `assets/remotion/src/gl-transition.jsx`，前场冻结末帧、后场持续到停稳，字幕在合成层外；每场保留自己的层叠上下文。检查所选 shader 的背景参数：网格缝隙等要匹配当前主题，不直接沿用黑色默认；会整屏收黑的效果不适合此明亮系列的普通接点。实际渲染前／中／后和连续转场，检查文字恢复、遮挡、阅读时间、角色与字幕安全区。批准视觉风格不能自动标为整片或声音获认可。

字幕使用 `comic-captions.jsx` 的 `ComicCaptions`：中文主行＋英文副行，核心短语高亮；详见 [字幕接口](../stages/captions.md#漫画系列的中英文字幕与高亮代码)。不要在项目里另写纯文本字幕层而丢掉已设定的高亮。
