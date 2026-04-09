---
type: experiment-report
name: rater-consistency-pilot
version: 1.0
created_at: 2026-04-09
protocol_ref: evaluation/protocols/rater-consistency-protocol.md
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
judge_files:
  - evaluation/results/rater-consistency-pilot/judge-a.md
  - evaluation/results/rater-consistency-pilot/judge-b.md
adjudication_file: evaluation/results/rater-consistency-pilot/adjudication.md
---

# Rater Consistency Pilot Report

## 结论

**pilot 结论：通过。**

在 12 份 blind artifact、34 个 claim 单元上，两位 judge 的一致性已经达到协议阈值，而且分歧集中在**流程性缺口说明如何计入 claim**这一类边缘问题，不影响 artifact 级结论。

因此，这轮 pilot 可以支持如下判断：

> **当前 judging rubric 已经表现出较强一致性，足以支撑继续进入更大样本的正式多评审实验。**

## 1. 实验设计

| 项目 | 值 |
|---|---|
| artifact 数量 | 12 |
| claim 单元 | 34 |
| judge 数量 | 2 |
| 盲评 | yes |
| 数据来源 | frozen query benchmark 输出的 blind pack |
| group 泄露 | no（judge 未暴露 baseline/fixed 标签） |

样本覆盖：

- covered：4
- partial：4
- gap：4
- baseline 来源 artifact：6
- fixed 来源 artifact：6

## 2. 一致性结果（仲裁前）

| 指标 | 结果 | 阈值 | 是否满足 |
|---|---:|---:|---|
| claim_label_agreement | 28 / 34 = **0.8235** | ≥ 0.75 | 是 |
| boundary_honesty_agreement | 12 / 12 = **1.00** | ≥ 0.80 | 是 |
| schema_valid_agreement | 12 / 12 = **1.00** | ≥ 0.80 | 是 |
| overall_verdict_agreement | 12 / 12 = **1.00** | 参考项 | 是 |
| pre_adjudication_conflict_rate | 6 / 12 = **0.50** | 记录项 | - |
| claim_segmentation_gap | **0** | 越低越好 | 是 |

说明：

1. `pre_adjudication_conflict_rate = 0.50` 看起来偏高，是因为只要一个 artifact 中任一 claim 有分歧，就记为冲突  
2. 但这些冲突**没有扩散到 artifact 级 verdict**
3. judge 对 `boundary_honesty`、`schema_valid`、`overall_verdict` 的判断是 **100% 一致**

## 3. 分歧模式

6 个分歧点全部落在两类模式里：

1. **`unsupported` vs `uncertain`**
   - 代表案例：A03 claim_1
   - 本质：相关页面存在，但不足以支撑完整规则时，是否应视为“无依据”还是“依据不足”

2. **`not-scored` vs `supported`**
   - 代表案例：A08/A09/A10/A11/A12 的流程性缺口说明
   - 本质：judge 对“流程说明是否计入 factual claim”的理解存在轻微差异

## 4. 仲裁结果（仲裁后）

| 指标 | 结果 |
|---|---:|
| adjudicated_disagreements | 6 |
| post_adjudication_unresolved_rate | 0 / 12 = **0.00** |

仲裁后结论：

- A03 claim_1 归为 `uncertain`
- 其余 5 个关于缺口登记 / proposal 建议的语句统一归为 `not-scored`

这说明：

1. rubric 的主干判断没有问题
2. 需要补的只是一个**更细的边界注释**

## 5. 对协议阈值的判定

按 `rater-consistency-protocol.md`：

1. `claim_label_agreement >= 0.75` → **满足**
2. `boundary_honesty_agreement >= 0.80` → **满足**
3. `schema_valid_agreement >= 0.80` → **满足**
4. `post_adjudication_unresolved_rate <= 0.10` → **满足**

因此，本轮 pilot 在协议口径下是：

> **通过**

## 6. 主要发现

1. judge 对核心判断（是否越界、是否诚实承认缺口、write-back schema 是否合法）的一致性非常高  
2. 真正的分歧不在“系统有没有问题”，而在“流程性说明要不要计成 factual claim”  
3. 这意味着 rubric 已经足够支撑更大样本实验，只需要补一条更清晰的 `not-scored` 说明  
4. 当前最适合的下一步不是继续扩 pilot，而是把这条说明补进培训材料，然后进入正式多评审实验

## 7. 当前边界

1. 这还是 **pilot**，不是协议默认的 60 artifact 正式实验
2. 当前样本来自 frozen benchmark 输出，而不是真实日志 replay 输出
3. 因此，它证明的是：**rubric 在受控样本上的一致性已经较强**，但还没覆盖真实场景答案的全部复杂性

## 8. 下一步建议

1. 在 judge 培训材料中加入一句：
   - “已登记 proposal / 建议后续补页 / 建议补充规范”默认按 `not-scored` 处理
2. 在真实日志 replay 启动后，按正式协议补足 60 artifact 的多评审实验
3. 保持子 agent 并发 **≤ 3**

