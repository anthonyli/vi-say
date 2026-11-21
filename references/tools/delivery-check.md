# 跨路线交付清单

用于完整视频项目的最后交付，包括自编 Three.js/Remotion 工程；不改变渲染器的 schema，不把“文件齐全”混同视听验收。仅改一段文案、单张海报或明确样片时，按本次范围使用 custom，不擅自扩成完整制作。

## 从制作开始维护

从 `assets/acceptance/delivery.template.json` 复制到 `work/<项目>/delivery.json`。完整自媒体有旁白项目默认交付 video、audio、script、captions、poster_16x9、poster_4x3、poster_3x4、publishing_copy、delivery_note。先列范围，文件完成后填写实际路径和 SHA256。只有用户明确不需要或任务本就不适用时才填 omissions 的 reason 与 basis；不能因尚未做完而省略。已有授权和偏好直接沿用，不新增一次审批。

复用已确认海报时填写旧版文件的真实路径与哈希，不为凑齐清单再次生图。不同角色可以引用同一文件，例如已要求的口播与发布稿合集；但 Agent 必须核实实际包含各项内容，检查器不能读懂语义。最终回复同时提供视频和配套入口，不能只贴 MP4 后等用户追问。跨版本引用在交付说明列清楚；需要独立下载包时再把这些真实文件收齐打包，不能只打包 JSON 或失效链接。

## 开场与片尾的文本漏项

模板含小龙系列默认开场和留言、关注、点赞的 `text_requirements`。其他系列按项目约定替换或删除这些文本项；用户明确省略时记录依据，不强加小龙。每项指定 role 和 any_of（至少出现一个文本）；可对 script 或 captions 做相同检查，别拿发布稿里的三连替代视频脚本。此检查仅证明稿件含文字，最终声音是否读出、字幕是否出现、画面是否有对应引导仍按互动片尾节点实际核对。

## 执行

```sh
python scripts/production.py check-delivery work/episode/delivery.json \
  --output work/episode/delivery-check.json
```

可独立运行 `scripts/check_delivery.py`；仅海报尺寸检查依赖 Pillow，统一入口另需已有生产环境依赖。清单中的相对路径以清单目录解析。图像检查允许比例相对误差2%。

- 0：范围内文件非空、SHA256匹配、海报可读且比例匹配；**不表示质量通过或已经发布**。
- 1：缺文件、文件已变化、比例错误等不完整状态。已授权的缺项继续补齐；可先提供预览，但说明缺什么，不能称完整交付。
- 2：清单格式、输入或运行错误。

显式缩小范围：`profile=custom`，填写 `required`、`scope_reason` 和 `scope_basis={"kind":"explicit_partial_request"或"standalone_artifact","request":"实际局部请求原话"}`。只有用户明确缩小范围或任务本身是独立单项时才使用；“已有录屏”“自编工程”“只修视频”不是取消原完整项目剩余交付的依据。字段记录来源，检查器不认证原话真实性。完整项目修订时沿用 `self_media_narrated`，引用已经完成的产物，仅补齐或替换受影响项。self_media_narrated 的固定角色不会因 artifacts 漏列而消失。额外交付物直接增加 artifacts 角色，例如用户要求的 zip。重渲、换字幕、补文案后更新实际哈希再检查；不要让工具自动刷新旧哈希掩盖内容变化。

这个命令接入 production.py，但不会拦截任意外部渲染脚本。所有路线的最终交付步骤必须主动调用它。视听质量继续依照 delivery.md 和适用的 check_acceptance.py；不要再复制一套质量状态机。

漫画完整录屏使用 `recorded_story`（相对清单的时间轴路径）接入 `check_recorded_story.py`，交付检查同时核对封面、字幕高亮输入、完整原片覆盖和实际WAV内部长静音。不能以仅文件齐全代替这些检查；本检查仍不认证视听质量。

发布海报（poster_16x9/poster_4x3/poster_3x4）与视频片头（可选intro_frame）分开登记。片头截图不能冒充三比例海报，海报生成也不授权改视频。新制发布文案使用独立的 `发布文案.txt`，按 [发布文案节点](../stages/publishing-copy.md) 交付。

## 局部修订的可执行保护

真实录屏剪辑在清单中登记 `recorded_edit`，值为[原声录屏计划](recorded-video.md#双语成片与有声片尾)路径。检查读取最终 `video`、`captions`，核对 MP4 的可解码帧数、时间戳和有声区间，同时检查引入与播放的先后、原字幕区间、收束句及有声互动。后续修订继续保留 `recorded_edit`。

在修改产物之前执行 `python scripts/production.py revise-delivery BASELINE.json REVISION.json --change poster_3x4 --change publishing_copy --request '本次用户原话'`。脚本先检查基线，再继承完整交付范围；未列在 `--change` 中的产物用原哈希锁定。`check-delivery REVISION.json` 会拦住改动视频、删除未授权角色、偷换范围或修改基线等情况，即使重新填写了新视频哈希也不能通过。输出清单拒绝覆盖。角色列表和原话是可审查输入，脚本不能认证人是否准确转述用户；基线文件须保留，不能事后改写。

漫画录屏交付检查现会校验真实源视频帧数/时长、时间轴WAV与交付WAV一致，并从最终MP4抽取音轨检查首尾及中间长静音。音轨文字与听感、画面是否实际高亮、海报是否由某工具生成仍需相应证据与目视/听审；不能将元数据检查表述为自动质量认证。原产物发生变化会报哈希错误，先辨明修改来源，不自动重算旧清单来消除错误。

发布海报的artifact另带`generation={method:"imagegen",prompt:{path,sha256},references:[{path,sha256}]}`。检查器验证实际提示词和参考图片存在且哈希不变，防止只登记一张代码截图就通过。记录由实际调用结果填写；它验证证据绑定，不独立证明图像生成来源或独立构图。脚本草稿不占正式poster角色。生成次数和人工确认仍按poster节点记录，不能靠重复检查重新生图。
