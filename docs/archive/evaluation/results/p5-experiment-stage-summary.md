---
type: stage-summary
name: p5-experiment-stage-summary
version: 1.0
created_at: 2026-04-09
---

# P5 Experiment Stage Summary

## 当前阶段结论

Phase P5 的“增强外部说服力”实验目前已推进到：

1. **真实日志 replay 协议已完成，但执行资产缺失**
2. **多评审者一致性 blind pilot 已完成且通过**
3. **三评审 triangulation 已完成，发现 1 条明确可修的 claim 标签边界歧义**

因此，当前最准确的判断是：

> **rubric 的一致性已经出现明确正向证据，但 claim 级标签仍有一条边界歧义待收紧；下一步的主要阻塞项仍然是缺少脱敏真实日志样本。**

## 已完成

### 1. 真实日志 replay 可执行性检查

已产出：`evaluation/results/real-log-replay-readiness.md`

结论：

- 仓库内暂无可直接执行 replay 的脱敏真实 query 样本
- 当前阻塞的是**输入资产**，不是协议本身

### 2. 多评审者一致性 blind pilot

已产出：

- `evaluation/results/rater-consistency-pilot/artifact-pack.md`
- `evaluation/results/rater-consistency-pilot/judge-a.md`
- `evaluation/results/rater-consistency-pilot/judge-b.md`
- `evaluation/results/rater-consistency-pilot/adjudication.md`
- `evaluation/results/rater-consistency-pilot/pilot-report.md`

核心结果：

| 指标 | 结果 | 阈值 | 结论 |
|---|---:|---:|---|
| claim_label_agreement | 0.8235 | 0.75 | 通过 |
| boundary_honesty_agreement | 1.00 | 0.80 | 通过 |
| schema_valid_agreement | 1.00 | 0.80 | 通过 |
| post_adjudication_unresolved_rate | 0.00 | 0.10 | 通过 |

## 关键发现

1. judge 对 artifact 级 `boundary_honesty` / `schema_valid` / `overall_verdict` 已达到 **100% 一致**
2. 分歧主要集中在：**流程性缺口说明到底算 `supported` 还是 `not-scored`**
3. 三位 judge 的 claim 切分也已验证为**完全一致**，说明当前分歧不是切分问题
4. 这类分歧可以通过一条更明确的培训说明收敛，不构成核心 rubric 主干失效
5. 因此，当前最大的外部说服力短板已经从“judge 会不会乱判”转移到“真实日志 replay 还没启动”

### 3. 三评审 triangulation

已产出：

- `evaluation/results/rater-consistency-pilot/judge-c.md`
- `evaluation/results/rater-consistency-pilot/triangulation-report.md`

核心结果：

| 指标 | 结果 | 判断 |
|---|---:|---|
| claim_fleiss_kappa | 0.6981 | 略低于 0.75 强一致性目标 |
| boundary_fleiss_kappa | 1.00 | 通过 |
| schema_fleiss_kappa | 1.00 | 通过 |
| overall_fleiss_kappa | 1.00 | 通过 |

解释：

1. 三位 judge 在 artifact 级结论上仍是 **100% 一致**
2. 剩余分歧全部集中在：流程性缺口说明到底算 `supported` 还是 `not-scored`
3. 这说明问题已经从“judge 是否稳定”收缩成“培训边界是否足够明确”

### 4. claim segmentation consistency quick check

已产出：

- `evaluation/results/rater-consistency-pilot/segmentation-consistency-report.md`

核心结果：

| 指标 | 结果 | 判断 |
|---|---:|---|
| mean_claim_segmentation_gap | 0.00 | 通过 |
| max_claim_segmentation_gap | 0 | 通过 |
| all_claim_id_sets_equal | true | 通过 |

解释：

1. 三位 judge 对 12 个 artifact 的 claim 条数完全一致
2. 三位 judge 的 claim_id 集合完全一致
3. 因此，当前 claim-level 分歧不是“claim 切分方式不一致”，而是**标签边界尚有一条规则待澄清**

### 5. clarified rerate (rubric v1.1)

已产出：

- `evaluation/results/rater-consistency-rerate-v11/clarified-rerate-report.md`

核心结果：

| 指标 | 结果 | 判断 |
|---|---:|---|
| pure_procedural_not_scored_unanimity | 10 / 10 = 1.00 | 通过 |
| A03_unsupported_unanimity | 3 / 3 = 1.00 | 通过 |
| segmentation_affected_artifacts | 2 / 12 = 0.1667 | 新问题暴露 |
| artifact_overall_unanimity | 10 / 12 = 0.8333 | 新问题暴露 |

解释：

1. v1.1 已成功修掉原来的 `not-scored` / `unsupported` 主标签歧义
2. 但新的不一致上移到了：mixed sentence 切分 + `gap + schema_invalid` 的 artifact 总裁决

### 6. focus rerate (rubric v1.2)

已产出：

- `evaluation/results/rater-consistency-rerate-v12/focus-pack.md`
- `evaluation/results/rater-consistency-rerate-v12/focus-rerate-report.md`

核心结果：

| 指标 | 结果 | 判断 |
|---|---:|---|
| focus claim count drift | 0 | 通过 |
| focus artifact verdict unanimity | 4 / 4 = 1.00 | 通过 |
| A09/A11 verdict | partial / partial / partial | 通过 |

解释：

1. v1.2 已把 A06/A08 的 mixed sentence 切分收敛
2. v1.2 已把 A09/A11 的 `pass/mixed/partial/fail` 漂移收敛为统一的 `partial`
3. v1.2 wording cleanup 已完成：pure gap disclosure 默认 `not-scored`，只有 mixed sentence 中拆出的 coverage-status clause 才单独计分

## 当前阻塞项

当前关键阻塞项：

- **缺少脱敏真实 query 日志样本**
- **正式多评审实验前，需要用扩 blind pack 再做一次正式多评审实验**

## 下一步

1. 用扩 blind pack 做一次正式多评审实验
2. 获取真实 query 日志抽样池
3. 完成脱敏与样本冻结
4. 冻结对应 canon snapshot
5. 启动 `real-log-replay-protocol.md`
6. 在 replay 输出上执行正式多评审实验

## 执行约束

- 子 agent 并发数 **不得超过 3**
