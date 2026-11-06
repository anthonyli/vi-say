# 产品演示动效

从已有成片提取时保留完整的界面容器、布局比例、字体层级、投影、前后景和动作节拍，再参数化文案、数据、配色与时间。用原片对应阶段的画面对照验证；不能把完整产品画面简化成几张卡片后，仅凭测试通过就视为完成提取。

这一组效果通过统一 `production.py` 与 Remotion 入口运行。用于说明对象如何聚合、操作如何发生、证据如何进入下一步。效果是可组合的通用组件；品牌、指标、领域术语、真实产品素材与口播锚点由当期项目提供。

## 查目录并运行

```sh
python scripts/production.py catalog
python scripts/production.py catalog --json
python scripts/production.py init work/product-effects --title "产品演示动效" --subtitle "通用流程示意" --series "产品演示" --preset studio --template business
python scripts/production.py render work/product-effects/project.json --output-dir outputs/product-effects --preview
```

`catalog` 从实际效果字段表、转场注册表、预设目录和样例读取能力，并验证每份样例。机器输出包含支持字段、Bot 动作、转场、预设、样例时长与采样点数量。新增效果缺少可运行样例时，目录检查和 `.skill` 打包都会失败；组件注册与效果声明不一致时，渲染入口报错。

`studio` 预设选择明亮薄荷色光场、缓慢漂移的弧带背景和 `character.mode=none`；需要小龙时可独立改为 `rounded`，需要 Bot 则添加 `bot` 效果。预设与样例分别从 `presets/*.json`、`examples/*.json` 发现，增加配置后可直接通过 init 选择。

`business` 是 45 秒无声效果样例，覆盖六类新效果及八种新转场。示意数据不代表产品能力；预设与示例时间不代替正式旁白对齐。已有海报继续复用。

## 六类效果

均放在场景 `effects` 中，通用字段见 [动画模块](animation-modules.md)。`box` 是 1920×1080 画布中的 `[x,y,w,h]`，至少 600×240；按原设计尺寸等比排布：编辑器、扫描与仪表盘 1600×740，关系图 1720×748，档案/报告 1720×738/742，双信号档案汇聚 1660×660。其他长宽比会留白。时间为场内秒数，阶段结束必须留下停稳时间。全部输入可运行示例见 [business.json](../../assets/production/examples/business.json)。

| type | 输入 | 可见动作 |
|---|---|---|
| `panel-merge` | `box,sources,title,mergeAt`；可选 `detail,seconds` | 默认 `variant=workspace`，2–4 个窗口汇入完整仪表盘；`variant=profile` 将两个信号面板以透视动作合成同一对象档案；默认 1.2 秒 |
| `scan` | `box,query,rows,scanAt,result`；可选 `seconds` | 背景仪表盘退后并虚化，前景检索窗展开，返回表格结果与流程栏；默认 1.5 秒。结果文案由项目传入，不自动推断业务结论 |
| `node-editor` | `box,nodes,moving,from,dragAt,testAt,result`；可选 `dragSeconds,dropSeconds,testSeconds,bars,metrics,metricsAt,ui` | 完整导航、工具侧栏、点阵画布与图标节点；拖拽指针跟随、松手连接、回测结果及可选前景指标卡。`moving` 为 0–2，`from` 为 1600×740 编辑器中节点左上角的归一化坐标，默认拖放 1.2 秒、松手 0.4 秒、执行 1 秒 |
| `chart` | `box,title,values`；可选 `labels,seconds` | 仪表盘中的图表与前景放大卡展示 2–32 个非负数值，按实际数据比例绘制折线与面积；默认 2 秒。点多时省略数值标签，分类文字应控制数量避免拥挤 |
| `network` | `box,nodes,edges`；可选 `seconds,boxFrames` | 保留标题栏、图例、分析侧栏和主体光晕；节点与关系逐步出现，连线上的点持续传递；同一张图可以连续缩入证据栏，默认连线 0.8 秒 |
| `document` | `box,sources,title,rows,gatherAt,writeAt,reviewAt,reviewLabel`；可选 `gatherSeconds,writeSeconds,reportAt,reportTitle` | `variant=case` 保留对象资料、图谱槽位、证据栏、摘要与审核动作；默认 `variant=report` 保留证据链、文稿、来源记录和审核角色；保留同一组数据，不自动生成业务报告内容 |

`network.nodes` 每项为 `{id,label,position,at,color?,main?,badge?,icon?}`。`position` 为 0–1 的内部布局坐标；`edges` 为 `{from,to,at,color?}`，必须引用已有节点且不得早于两端节点出现。循环关系允许，自环与悬空关系拒绝。`boxFrames:[{at,box}]` 从当前 box 连续插值；需要先停留，先写一个维持原 box 的关键帧，再写目标关键帧。缩入后的图主要保留关系概览，不用于阅读细字。

`document.rows` 为 `{label,text}` 数组。`gather → write → review → report` 按时间校验因果顺序；默认汇入 1 秒、写入 1.5 秒、复核 0.5 秒、转换 0.8 秒。图谱与文档可在同一场组合，参考样例的证据栏镜头。当前支持同场对象连续运动，跨场同一图谱身份需另行实现，不能套用 Bot 的持久身份机制。

## 保留设计的配置层

所有产品效果支持按类型划分的 `ui` 输入，具体允许字段通过 `catalog --json` 的 `uiFields` 查询，完整配置见 business.json。

- 编辑器：`ui` 管理品牌、导航、工具列表、节点说明/图标/颜色、历史范围、按钮与结果说明。`bars` 是实际传入的回测柱状值；`metrics:[{value,unit?,label,color?}]` 和 `metricsAt` 控制 2–3 项前景指标。只有提供指标才绘制，必须等执行完成再升起并留出停稳。
- 汇聚与图表：完整产品壳复用 [product-shell.jsx](../../assets/remotion/src/effects/product-shell.jsx)，`ui.stats`、单行 `ui.rows`、`ui.columns` 替换仪表盘输入；`ui.trend` 为汇聚场景的独立趋势数据，不拿不同单位的指标拼成曲线。`profile` 变体使用 `ui.tags/followups/note`。
- 扫描：`ui.columns/resultRow` 保持列数一致，`subtitle/methods/action/footer/steps` 替换前景说明与底部流程。
- 关系图：`ui.legend`、`ui.insights` 分别控制图例与分析卡。图谱缩入 `case` 的证据槽时，先绘制档案，再绘制同一图谱，避免被档案背景遮住；示例给出了对应 boxFrames。
- 文档：`ui` 替换来源详情、对象信息、审核角色和记录说明。官网人物照片与商标仍作为单期素材处理，通用样例使用对象资料卡；不把照片和品牌永久打包进组件。

`studio` 编译默认使用随包 Manrope 可变字体及其 OFL 许可证，字重范围按 200–800 加载，避免把正文也变成粗黑体。中文使用浏览器的系统字体回退；跨平台交付需按实际字体检查或明确传入项目字体。其它预设的字体选择保留原行为。

## 业务名称的兼容映射

原先八个业务转场名称已去重：`converge` 保留为矩形汇聚基础机制；`focus/zoom/merge → gl:CrossZoom`，`handoff → slide`，`evidence/report → flip`，`iris → radial`。别名的位移、圆心和面板透视差异通过参数预设保留，默认 0.6 秒及前后文字顺序仍可读取；缩放虚化类统一采用 GL 表现。

新项目从 [35 个主入口](gl-transitions.md) 选择，不再把兼容别名当作独立特效。`report` 的场景切换与 `document` 模块的来源汇入、内容显现、复核流程分别处理；合并转场不会更改业务动画或音轨。

## 扩展一个效果

1. 在 [business.mjs](../../assets/remotion/effects/business.mjs) 增加字段定义、结构与时间校验、确定性状态计算和采样时间；其他效果可维护在独立文件，再由公共 contract 接入。
2. 在 [business.jsx](../../assets/remotion/src/effects/business.jsx) 注册绘制；完整产品壳、编辑器、其它产品视图分别在 `product-shell.jsx`、`node-editor.jsx`、`product-views.jsx` 维护；状态只依赖输入与帧时间，随机跳帧、倒序渲染要保持同一结果。
3. 增加通用 JSON 示例；运行 `production.py catalog` 验证发现、字段和采样。新媒体按样例中的 image/video 相对路径复制，不加载外部地址。
4. 对状态变化、边界和非法输入补行为测试，实渲样例并检查中间过程、最终落点和文字。测试与静态帧检查不代替原速审看。

原宣传片中的品牌锁定、官网人物素材、业务字段和指标仍属于单期作品。公共模块保留视觉与动作结构，通用样例只使用示意数据。
