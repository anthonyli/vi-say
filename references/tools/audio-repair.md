# 发音、噪声与用户反馈

正常制作先执行 [production.md](production.md) 的术语预检和全轨听审。以下工具只在需要修音、已有用户反馈或反复拒绝时追加使用，不把一次历史项目的窗口、降噪阈值和运行平台变成全局流程。

## 错音与连续口播

英文品牌以完整自然单词衔接；缩写按核实的读法处理，数字与单位在项目发音表中明确。发音表保存原文和实际合成文本，不能替用户杜撰官方中文名。ASR 可以发现漏词、重复或文本差异，不能判定发音自然、重音标准或背景干净。错音重新生成完整语义段落，不拼接单个字母或音节、不用倍速掩盖。

默认原速 1.0。`audio_timing.py` 仍会处理长静音和响度，只有任务确有需要且边界已复核时调用。非 1.0 要求 `--speed-authorization` 与 `--listening-evidence`；文件存在只证明结构条件，不证明内容真实。裁切保护清辅音、声母和尾音，不能把低能量或无基频直接当成噪声。

## 用户标注区间的验收

```sh
python scripts/audio_acceptance_candidate.py PROJECT/audio-record.json \
  --required-windows PROJECT/user-windows.json --final FINAL.mp4 \
  --output PROJECT/audio-result.json
```

文件引用统一 `{ "path":"相对record的文件路径", "sha256":"实际SHA256" }`。外部 `user-windows.json` 是 `{id,span:[start,end]}` 的列表，来自当次用户反馈；模糊的“开头”需定位范围并记录理由，不复制其他任务的秒数。不得删除已报窗口以通过检查。

record 必填：

- `schema_version:1`、`final_sha256`、`duration_seconds`，绑定实际最终 MP4 或明确交付的独立音轨。
- `windows` 与外部 ID/区间完全一致。每项含 `mapping_rationale`、`resolution:fixed|reviewed_no_change_needed`、`traces`。其中 `original_tts/master/final` 各含 `artifact` 文件引用、`spans` 区间列表、`evidence` 引用、`finding`；跨分段时用真实追踪清单保留各段哈希及映射。
- `full_track_audit`：`final_sha256`、`coverage` 覆盖 0 到全长、`method`、`findings` 列表、`evidence`。检查全轨、拼接处、开头和结尾，不能只听报错区间。
- `listening`：实际 `method:human_direct_playback|direct_audio_inspection_interface`、`scope:full_final_track`、`reviewer`、`performed_at`、`final_sha256`、全轨 `coverage`、全部 `reviewed_window_ids`、`evidence`、`verdict:no_unresolved_anomaly_observed`。
- `unresolved_items:[]` 必须是真实无未解决项。技术统计可附在 `technical`，不能代替听审。

无实际听审保持 `needs_listening`。退出 0 只说明记录结构及哈希验证通过，不能宣称程序已听过或认证音质。换成片后需要重新绑定证据。

## 用户拒绝记录

```sh
python scripts/audio_revision_audit.py PROJECT/audio-record.json \
  --required-windows PROJECT/user-windows.json --rejections PROJECT/rejections.json \
  --final FINAL.mp4 --output PROJECT/revision-result.json
```

外部 `rejections` 列表为 `{id,source_sha256,final_sha256}`；record 的 `rejection_history` 使用相同 ID/哈希，另有 `status:rejected`、准确 `feedback` 和 `evidence`。保留每次否定，DSP、ASR 或模型更换不能把它改成通过。

修改后只可记 `revision:{status:corrected_candidate_unverified,final_sha256,evidence}`。实际全片认可另记 `user_final_acceptance:{status:accepted,scope:full_final_track,final_sha256,evidence}`。同一 SHA 已遭用户拒绝时，泛化的 acceptance 不足以清除：需要后续明确的 `user_rejection_retraction`，包含 `status:accepted|retracted`、`scope:full_final_track`、同 SHA、全部 `supersedes_rejection_ids`、`subsequent_to_all_listed_rejections:true`、`user_message_id`、`explicit_user_statement`、真实 `evidence`。这是记录检查，不是用户身份认证；没有实际后续认可就不能填写。

同时填写 `non_speech_regression_audit:{final_sha256,method,evidence,regions}`。每区含 `classification_basis`、`comparison`、`new_transient_flag`；新增异常需有 `resolution:reviewed_and_resolved`。无区间时填写实际 `no_regions_rationale`，不以 ASR 无词断定静音。

## 降噪有用且没有新增问题

`check_audio_energy_regression.py BASELINE CANDIDATE --alignment-note "实际对齐依据" --output REPORT.json` 用 10ms 窗筛查新能量峰；要求同采样数，但仍须核对延时、首尾补齐及响度变化。筛查不是噪声识别或自动滤波许可。

当反馈是“人声背后的风声/底噪”，保持这个问题分类；换词、去齿音、裁辅音都不能替代解决背景层。逐窗口验证实际效果，按 [背景噪声效果检查](#背景噪声修复的效果检查) 运行 `check_background_utility.py`。阈值由当次任务在评估前确定，不照搬历史数字，也不在失败后调低门槛。所有技术和效果检查后，仍需真实全轨听审。


## 背景噪声修复的效果检查

Preserve the user's observation category `background_layer`: “behind the speech, not the voice.” Do not substitute lexical rewrites, de-essing or consonant clipping for this complaint. Keep same-SHA rejection precedence from `audio_revision_audit.py`; all original rejection records remain. No automatic full-track processing or model retry is authorized by this skill.

### Required gates
1. Declare required windows and positive minimum background reduction in a task-owned JSON before evaluating. No universal reduction threshold is supplied. Preserve exact IDs/spans; an unmeasured window cannot pass. Do not lower thresholds after seeing a failed candidate.
2. Validate each noise-profile/template using actual word boundaries, periodicity and spectral stability, plus a held-out interval not used to estimate the profile. ASR windows and low energy alone do not establish pure noise; unvoiced consonants are not disposable noise. Record actual evidence hashes. Candidate-window RMS reduction is only a proxy when speech contamination remains; do not rename it proven noise removal.
3. Run `python scripts/check_background_utility.py record.json --required-windows task-windows.json --final candidate.wav --output utility-result.json`. Required-window entries contain `id`, `[start,end]` in `span`, and task-declared `min_background_reduction_db`. Record `final_sha256`, exact window list with `measured_background_reduction_db`, `measurement_evidence` `{path,sha256}`, `observation_category: background_layer`, and `template_validation` with actual-word-boundary/periodicity-and-spectral-stability/held-out checks and evidence (see tests for exact schema). Global `risks` must explicitly describe `speech_in_residual`, `new_transients`, `voice_fidelity`, `musical_noise`; unknown is `not_checked`, not “safe”.
4. Any missing evidence, weak target-window effect or invalid template blocks utility even when original phase, duration, silence, codec and transient safeguards pass. A successful CLI means only measured-effect record structure validated, never content-truth or audio pass. Then separately require the audio acceptance and rejection gates plus real full-track listening. No listening means no audio approval.
