# 小龙系列：漫画分镜与积木搭建

本风格替换旧玻璃／灰绿系列默认。保留小龙、圆润嘴形与角色身份；每期按主题设计背景、色彩占比和道具，不把某一期产品、四个维度或台词写进模板。

## 视觉与叙事

- 漫画分镜使用深墨粗描边、略倾斜的框、硬偏移阴影、适量网点与放射线。气泡承担人物对话和短问题，标题承担结论；不三处重复整段旁白。
- 一个重点一块积木，逐块落下、接触、回弹、停稳，形成有意义的整体。顺序由实际语义决定，保持可见接触与遮挡；不把整片都做成积木罗列。
- 真正介绍产品时，界面／录屏是主角。入口 → 点击 → 结果 → 解释结果，至少完整讲清一条操作链。细字局部放大，旁白与界面当前状态一致；角色缩到不会遮挡的位置。
- 配色起点：墨蓝 `#18233c`、明黄 `#ffdb42`、天蓝 `#72ccf0`、珊瑚红 `#ff775f`、奶白 `#fffbef`、浅紫 `#bda6f4`。按每期主题调整组合、占比和背景道具；不回退为固定玻璃背景。

## 可运行组件

`assets/remotion/src/comic-kit.jsx` 导出 `ComicTheme`、`COMIC_PALETTE`、`Frame`、`Bubble`、`Brick`、`Dots`、`RayBurst`、`Burst`、`Dragon`、`BrowserShot` 及确定性缓动。使用共用 Remotion runtime，不逐期安装依赖。

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
