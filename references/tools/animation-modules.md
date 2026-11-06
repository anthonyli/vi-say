# 可选择的动画模块

模块已接入 `production.py init/compile/render` 和统一 Remotion 入口，使用 1920×1080、16:9 的小龙场景时间轴。配置选择实际组件；未知模块、动作、参数或不完整的因果时间会报错。题材、文案、关键词、角色映射和实际触发时间属于项目输入。

## 直接运行

```sh
# 常规项目：默认玻璃背景、圆润口型、去标点高亮字幕和一个配角 Bot
python scripts/production.py init work/new-video --title "本期标题" --subtitle "本期收益" --preset glass

# 模块展示模板：用于检查效果的 29 秒无声样片
python scripts/production.py init work/effects-demo --title "动画模块" --subtitle "选择需要的效果" --preset glass --template effects
python scripts/production.py render work/effects-demo/project.json --output-dir outputs/effects-demo --preview
```

`--preset studio --template business` 选择无角色的产品演示样例，六类业务动效及八种新转场见 [产品演示动效](business-effects.md)。`python scripts/production.py catalog --json` 查询实际支持字段与已验证样例。

需要更多场景切换时读 [GL 转场](gl-transitions.md)；`--template transitions` 提供同一制作入口的 35 种转场无声展示。默认轮换已包含 GL，角色、字幕和声音继续沿用原流程。

`--preset classic` 选择原风格；老项目没有 `modules` 字段时继续原行为。示例模板提供画面编排，不是最终旁白时间；正式有声制作仍按最终音轨重新对齐。`--preview` 使用真正的静音 WAV。

## 背景、字幕、角色分别选择

`project.json.modules` 的起点来自 [glass.json](../../assets/production/presets/glass.json) 或 [classic.json](../../assets/production/presets/classic.json)：

```json
{
  "background": "glass",
  "captions": {
    "style": "highlight",
    "stripPunctuation": true,
    "keywords": [],
    "protectedTerms": []
  },
  "character": {
    "mode": "rounded",
    "travelSeconds": 0.9,
    "arc": 70,
    "tilt": 1.2
  }
}
```

- 背景：`glass/classic/studio`。玻璃效果实际包含浅色光场、弧面、地面网格和进度线。
- 字幕：`highlight/plain`；关键词与需保护完整拼写的术语分别传入数组。`captions` 接受内联字幕数组，或相对项目的 JSON 路径；文件可为数组或 `{"captions": [...]}`。显示去标点同时作用于视频与 SRT，TTS 原稿不变。只有传入真实词时间的普通 token 字幕才做逐词强调。
- 角色：`rounded/legacy/none`（none 隐藏角色）。每场可用 `characterPose: {left,top,width,height,turn,rotation}` 设置位置与景别；跨场按 `travelSeconds` 和 `arc` 连续迁移，`tilt` 控制轻微身体倾斜。坐标和尺寸单位为设计画布像素。

## 每场通过 effects 组合模块

保留 `hero/steps/demo/cta`，新增 `kind: "stage"` 用于自由编排效果。每场的 `effects` 是数组；数组顺序参与叠放，Bot 在独立持久层绘制，避免跨场同时出现两份。

通用字段：`type` 必填；`id` 为对象身份；`at/endAt` 为**场内秒数**；`enter` 可选 `fade/rise/pop/none`，`enterSeconds` 控制入场时长。`focus` 使用事件自身的 0.35 秒过渡，不接收这两个入场字段。`position: [x,y]`、`box: [x,y,width,height]` 均为画布像素；`color` 为六位十六进制色值。下列字段是各模块实际支持的输入，完整可运行组合见 [effects.json](../../assets/production/examples/effects.json)。

| type | 内容与关键字段 | 实际效果 |
|---|---|---|
| `bot` | `id, variant, position`；可选 `size, action, phase, actions, keyframes, compression, travelSeconds, arc, angle, label` | 五种造型、眨眼转眼、探头、弹跳、挤压、碰撞、工作、庆祝、旋转、跨场迁移 |
| `platform` | `position`；可选 `width,label` | 玻璃椭圆台座、前后高光与投影 |
| `card` | `position,title`；可选 `width,label,status,detail,rows,angle,keyframes,changes` | 玻璃卡片、弹出/移入、连续迁移、状态更新 |
| `paths` | `paths` 为 SVG 路径数组；可选 `speed` | 流动虚线与底部柔光连线 |
| `connection` | `position`；可选 `label,waiting,complete,seconds,scale` | 插头接近、接合与完成反馈 |
| `flow` | `box,sources,summary,targets` 与三个阶段的触发时间 | 多份输入汇聚、形成摘要、分发到目标 |
| `route` | `points` 为 2–6 个坐标；可选 `labels,label,seconds,loop` | 同一内容对象沿多段路径传递 |
| `focus` | `events`；仅用于 `demo` 场景 | 截图或视频的高亮区域、聚焦标签、平移与轻微缩放 |
| `pointer` | `points: [{at,position,click}]`；可选 `jump` | 连续或分时跳转的指针、点击反馈 |
| `counter` | `box,value`；可选 `from,prefix,suffix,label,seconds` | 数字增长与停稳，数值来自项目 |
| `tag` | `position,text` | 胶囊标签与状态点 |
| `text` | `position,text`；可选 `fontSize,weight` | 标题文字入场，可组合缩放弹出 |
| `list` | `box,items: [{at,text,detail,color}]` | 按触发时间亮起的条目与完成勾选 |

### Bot 外观与动作分开

`variant` 从 [bot-styles.json](../../assets/production/bot-styles.json) 选择：`pentagon/blob/hexagon/triangle/square`。轮廓、主色、阴影色和五官在该文件中维护，独立于动作计算。

`action` 可选 `idle/look/peek/hop/nudge/work/celebrate/spin`。弹跳包含蓄力、空中拉伸、落地压扁与回弹，阴影同步变化。`actions: [{at,duration,name,hideLabel}]` 安排局部动作，不能重叠或超过场景；`phase` 错开各个角色的节拍。

`keyframes: [{at,position,size,angle,compression}]` 控制连续位置、比例、角度与挤压。相邻场景用相同 `id` 保持同一只 Bot，外观不可暗换；新场景从前一场的最终位置迁移到新位置。碰撞要给双方编排接近、接触形变、分开与恢复，不能只改一行状态文案。

### 汇聚、摘要、分发的因果时间

`flow.sources/targets` 各项为 `{title,label,status,color}`；`summary` 为 `{title,sections:[{label,text,color}]}`。

`gatherAt/gatherSeconds`、`summaryAt/summarySeconds`、`sendAt/sendSeconds` 分别控制三个阶段；时间不能相互抢占，最后留出停稳。默认动作时长分别为 1.05、0.65、1.1 秒，触发时间必须按当前语义填写。普通卡片的 `changes: [{at,status}]` 在对象到位时更新状态。

### 截图与视频聚焦

`demo` 仍需真实 `image/video`。`mediaSize: [原始宽,原始高]` 建立正确坐标系；编译器可读取位图尺寸，矢量或视频需显式填写。可用场景 `mediaBox` 设置画布中的展示框。

每个 `demo` 使用一个 `focus` 模块，在 `events` 中组合焦点。各项为 `{at,region,label,color,zoom,pan}`。`region: [x,y,w,h]` 是**原素材的 0–1 归一化区域**；`zoom` 为 1–1.5，`pan: [dx,dy]` 为画布像素。高亮与媒体使用同一缩放、平移和留边计算。示例画板明确为示意素材，实际产品镜头继续保留来源与真实状态。

## 从当前音轨生成口型

```sh
python scripts/mouth_cues.py --audio PROJECT/final.wav --output PROJECT/mouth-cues.json --rhubarb PATH_TO_LOCAL_RHUBARB
```

工具只调用本机 Rhubarb，不下载运行环境；输出绑定最终 PCM 的 SHA256 与完整嘴形时间。项目设置 `"mouth_cues": "mouth-cues.json"` 后，编译器与渲染器分别检查当前音轨哈希、连续时间和终点，再交给圆润口型组件。更换音轨后重新生成。

未提供音素近似时间时，`rounded` 使用最终音量分析驱动闭嘴、窄口和开口；无声预览保持闭嘴。Rhubarb 的 `phonetic` 仍是二维近似，不是精确中文音素强制对齐。底图、九种 PNG、几何参数和导出入口见 [角色模块](../styles/character.md#已保留的最终素材)。

## 实现位置

- 参数校验和效果目录：[contract.mjs](../../assets/remotion/effects/contract.mjs)。
- 确定性动作、路径、形变与阶段进度：[motion.mjs](../../assets/remotion/effects/motion.mjs)。
- 外观、玻璃、操作、字幕与持久角色层：[src/effects/](../../assets/remotion/src/effects/)。
- 35 种转场（30 种 GL 与 5 种基础机制）通过场景 `transition` 统一选择；未指定时按场景关系在全部 35 种中轮换。`transitionSeconds` 调整本次时长，GL 的 `transitionParams` 按各 shader 参数校验，见 [GL 转场](gl-transitions.md)。

静态渲染、连续采样、技术检查与听感分开记录。测试通过表示接口和相应行为已验证，不代替新题材的布局与原速审看。
