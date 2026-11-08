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

显式缩小范围：`profile=custom`，填写 `required` 角色列表与 `scope_reason`。self_media_narrated 的固定角色不会因 artifacts 漏列而消失。额外交付物直接增加 artifacts 角色，例如用户要求的 zip。重渲、换字幕、补文案后更新实际哈希再检查；不要让工具自动刷新旧哈希掩盖内容变化。

这个命令接入 production.py，但不会拦截任意外部渲染脚本。所有路线的最终交付步骤必须主动调用它。视听质量继续依照 delivery.md 和适用的 check_acceptance.py；不要再复制一套质量状态机。
