# 角色与系列形象

输入是使用者选择的角色母版；输出是跨本期视频与海报可识别的同一形象。角色是可替换的表现，内容流程见 [workflow.md](../workflow.md)。

## 随包示例

默认角色为 `assets/production/dragon.png`：青绿色中国小龙、鹿角、细鳞片、长卷尾和少量金饰，无翅膀。生成提示与闭嘴素材记录在 `character.json`。默认采用柔和哑光材质和左上柔光，视频色板见 [colors.md](colors.md)，海报风格见 [poster.md](../stages/poster.md)。

`dragon.png` 保留为原始身份参考；当前小龙系列说话镜头优先使用下面已保留的圆润口型素材与多嘴形组件，不回到原始开嘴图的尖嘴或整排白牙外观。

复用母版保持身份；主题道具按本期选择。新姿态以母版作参考，核对五官、比例、角、鳞片、尾巴和光线，而不是每期重生一个不同角色。

## 替换成自己的角色

编辑 `style.json.character`：

- `file`：透明角色图。
- `closedFile`：与开嘴图准确配准的闭嘴素材。
- `imageSize`：原图宽高。
- `mouthMask.center/radii/solid`：归一化嘴部遮罩位置、半径与实心比例。

基础 `legacy` 路线依赖开／闭嘴两张素材；`rounded` 路线使用闭嘴角色、无嘴线底板与嘴形几何。只有一张新角色图时先制作无声预览，或补齐所选路线的素材与绘制实现，不能声称已完整启用新角色口型。替换图后必须检查嘴部坐标，不沿用小龙坐标。

随包基础路线采用透明图片图层；嘴部随最终 WAV 音量开闭，不是音素口型或三维骨骼。左右站位由场景 `characterSide` 控制，同时移动内容区；朝向是同一姿态的镜像。带文字、不可镜像标识或不对称设计时固定朝向，或另外实现独立姿态。

嘴部采用带滞回阈值的完整开／闭状态替换，不对两种嘴形做半透明叠化。闭嘴遮罩的实心区域须覆盖开闭两种嘴唇，羽化仅位于外围皮肤；修改素材后检查说话、静音与阈值切换的连续帧，避免双唇残影。身体和眼睛继续使用同一底图。

新角色加入后检查视频首尾、站位切换、嘴部、主要信息遮挡，以及三比例海报构图。新动作与更复杂姿态见 [扩展说明](../extensions.md)，不把图像生成成功当成身份一致或动画通过。

## 小龙系列的圆润口型

圆润口型采用圆嘴角、连续圆弧下唇；取消整条白牙带、下唇中央尖折和倒三角嘴角。宽开口可保留少量圆润小牙，窄口不画出像齿轮的整排硬边。圆 O/U 口与横向开口保留差别，不能只把同一张嘴按音量放大。

自编多嘴形路线使用同一角色底图、准确配准的无嘴线局部皮肤底板，以及一条随发音改变形状的口腔路径。局部底板完全盖住原嘴线，羽化留在外围皮肤；眼睛、身体与光照不随嘴部替换。嘴形切换可用约 40–50 毫秒的路径参数插值，不能叠放两张半透明嘴图。

口型依据最终 PCM 重新生成，区分闭嘴、窄口、横向开口、宽开口、圆 O 和圆 U。通过 [mouth_cues.py](../../scripts/mouth_cues.py) 调用本机 Rhubarb 的 `phonetic` 识别并绑定音轨哈希，可作为二维多嘴形的近似驱动，不能称为精确中文音素强制对齐。检查发声起止、停顿及快速换嘴的连续过程，不能以 ASR 文本一致证明口型吻合。

多嘴形素材和组件已接入统一小龙入口。选择 `modules.character.mode=rounded` 后使用圆润几何；通过项目 `mouth_cues` 文件接入当前音轨的近似音素时间，没有该文件时使用音量驱动的闭嘴、窄口与开口，无声预览闭嘴。`legacy` 保留原图替换路线。调用方式见 [动画模块接口](../tools/animation-modules.md#从当前音轨生成口型)；换角色后重新标定坐标。

## 已保留的最终素材

| 内容 | 可复用文件 |
|---|---|
| 闭嘴角色底图 | [dragon-closed.png](../../assets/production/dragon-closed.png) |
| 无嘴线局部底板母图 | [dragon-neutral.png](../../assets/production/dragon-neutral.png) |
| 九种定型口型 PNG | [dragon-mouth/](../../assets/production/dragon-mouth)，文件为 `mouth-X.png` 与 `mouth-A.png` 至 `mouth-H.png` |
| 坐标、遮罩与嘴形参数 | [dragon-mouth-shapes.json](../../assets/production/dragon-mouth-shapes.json) |
| 动态口型组件 | [dragon-mouth.jsx](../../assets/remotion/src/dragon-mouth.jsx) |
| PNG 导出入口 | [export-dragon-mouth.mjs](../../assets/remotion/export-dragon-mouth.mjs) |

PNG 是从保存的口型组件导出的 1134×1387 透明角色图，可用于静态分镜和嘴形参考；它们使用同一套曲线参数，可通过导出入口重现。`X/A` 都是闭嘴状态，细线略有区别；字母为识别器嘴形代码，不代表精确中文音素。文件大小和哈希在目录内的 `manifest.json` 中。

新任务的 Remotion `publicDir` 放入上述 `dragon-closed.png` 与 `dragon-neutral.png`，导入组件并传入当前最终 PCM 生成的 `cues`、当前秒数 `time`、位置 `x/y` 和宽度 `w`。组件从 JSON 读取母图尺寸、坐标和嘴形参数；无需重新生成底图。换声音只重算口型时间，不改角色图片。

通过 `production.py` 制作时，编译器与素材映射会自动暂存这两张图并传入组件；独立调用组件时可用 `closedFile/neutralFile` 指定暂存后的文件名。

需要重新导出静态嘴形时，选一个新的输出目录：

```sh
node assets/remotion/export-dragon-mouth.mjs work/xiaolong-mouth-export
```

这些是可复用角色素材与源码，保留在 `assets/` 并随技能分发；单期归档或清理 `work/` 时继续保留，不把工作目录作为唯一来源。
