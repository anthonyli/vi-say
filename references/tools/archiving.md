# 可复用归档工具

入口：`python scripts/production.py archive`。独立实现为 `scripts/archive_project.py`，仅依赖 Python 标准库，适用于当前 macOS/Linux 环境。

用户说“归档”时调用这个入口。Agent 根据本期资料填写清单并检查计划，随后执行；用户无需每次编写 JSON，也不需要为已授权的归档再次确认。用户明确要求先审阅时遵循其要求。不要再为每期生成临时 Python 归档脚本。

## 固定操作流程

先确保该项目的渲染、配音与写入任务已停止。每个归档项目使用一份清单；多项目归档顺序调用同一工具。所有命令默认当前目录为制作项目根目录；在别处运行时，在子命令前加 `--root /path/to/project`。

```sh
python scripts/production.py archive init demo \
  --source work/demo --source outputs/demo \
  --output .cache/archive/demo.json
```

`init` 只盘点文件，生成待填写的清单。日期默认取 Asia/Shanghai 的当天；明确的历史日期用 `--date YYYY-MM-DD`，无法核实则用 `--date 日期待核对`。未传 `--source` 时查找同名的 `work/demo` 和 `outputs/demo`。

Agent 查看 `_inventory`（含旧 ZIP 的成员名），填写 `summary`、`files`、`resources`、`discard`、`packages`。不要依据扩展名就把检查抽帧当海报、试音当最终旁白；这些语义选择由本期记录决定。

```sh
python scripts/production.py archive plan .cache/archive/demo.json \
  --output .cache/archive/demo.plan.json
python scripts/production.py archive run .cache/archive/demo.plan.json
```

`plan` 不修改归档或源文件，核对完整分类并绑定所有源文件哈希；输出保留清单、去重关系、资源转存位置和丢弃数量。`run` 先复制并验证、按成品重建交付包，再清理清单中已盘点的源目录。

只读核验已有项目：

```sh
python scripts/production.py archive verify archive/2026-11-05/demo
```

## 清单示例

```json
{
  "schema": 1,
  "project": "demo",
  "date": "2026-11-05",
  "summary": "当前为女声 v3，用户认可，尚未确认发布。历史版本未发布。",
  "sources": ["work/demo", "outputs/demo"],
  "files": [
    {"source": "outputs/demo/final.mp4", "to": "视频/final.mp4", "kind": "video"},
    {"source": "outputs/demo/narration.wav", "to": "音轨/narration.wav", "kind": "audio"},
    {"source": "outputs/demo/发布文案.txt", "to": "文案/发布文案.txt", "kind": "copy"},
    {"source": "outputs/demo/v1.zip", "member": "demo/old.mp4", "to": "历史产物/old.mp4", "kind": "video"}
  ],
  "resources": [
    {"source": "work/demo/reference.wav", "to": "private/voice/demo/reference.wav"},
    {"source": "work/demo/font.otf", "to": ".cache/fonts/demo.otf"}
  ],
  "discard": ["work/demo/**", "outputs/demo/检查记录.json"],
  "packages": [
    {"to": "交付包.zip", "files": ["视频/final.mp4", "音轨/narration.wav", "文案/发布文案.txt"]}
  ]
}
```

- `project` 是归档目录名；结果为 `archive/<date>/<project>/`，不覆盖、不合并已有目录。
- `summary` 是简短真实状态说明，写清当前版本、用户认可/发布原话及历史拒绝版状态；需要绑定认可时注明对应视频及哈希。`plan` 不会把生成成功推断为用户认可或已发布。
- `sources` 只能是 `work/<项目>` 或 `outputs/<项目>` 的直接子目录。归档后清理这些目录；不接受父目录、`private/`、`archive/` 或缓存目录作为清理范围。
- `files` 明确列出保留产物。类型包括 `video/audio/poster/captions/script/copy/document`；目标可使用 `历史产物/`。按 SHA256 去重，首条选择为保留路径，其余路径在索引中注明指向。
- `member` 从旧 ZIP 读取单个成品，不复制整个旧包，不执行解压路径。被选择 ZIP 中未列出的成员不会留存，盘点时必须核对是否还有独有成品。
- `resources` 把工作目录中需要继续使用的参考音频、模型、字体或配置保存到 `private/voice/`、`private/models/`、`.cache/fonts/`。已有同名且同哈希的资源直接复用，内容不同则停止。原本已位于 `private/` 或缓存的资源不在清理范围。
- `discard` 是相对根目录的 glob 清单，明确标记制作过程或已有副本；保留与资源映射优先。未分类文件阻止执行，字体、模型和命名为参考的音频不能被宽泛丢弃规则静默删除，须先明确保留或转存。
- `packages` 从明确列出的归档产物和简短 README 生成必要交付 ZIP，逐成员验证；不沿用夹带日志、ASR、脚本、检查记录的旧包。

目标名与内容类型需相符；不通过改扩展名把制作过程塞进成品。交付说明中的旧路径若需要修改，应在生成计划前改好。主归档只写产物、简短 `README.md` 和 `SHA256SUMS.txt`，不附带清单、时间轴或长篇复盘。

## 失败与重复执行

计划和小型恢复凭据保存在 `.cache/archive/`，不进入归档或分发包。复制中断后用同一条 `run` 命令重试，已有同哈希文件继续复用。校验失败时保留源文件；源文件新增或变化时停止清理，需要重新核对。

临时复制文件也放在 `.cache/archive/staging/`，使用同一文件系统的排他链接发布，避免中断后留下半个成品；下次执行在取得归档锁后清理自己的临时缓存。若归档目录或私有资源目录挂载在另一文件系统，原子发布会失败并保留源文件，需要先调整布局。

清理只逐项删除已盘点且内容未变的文件，再删除空目录，不递归删除未知内容。已经完成的计划再次执行时只验证归档并返回完成，不清理后来重建的同名工作目录。已有档案没有本次计划的恢复凭据时直接拒绝操作，不擅自覆盖。

需要改变保留选择时编辑原始清单，重新生成一个新计划；不要手改带哈希的执行计划。部分归档的恢复凭据缺失或目标被手动修改时停止并核对现有产物，不通过删除旧档案来重试。归档不会提交 Git、递增版本、生成 `.skill` 包或重新渲染素材。
