---
type: experiment-report
name: claim-segmentation-consistency
version: 1.0
created_at: 2026-04-09
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
judge_files:
  - evaluation/results/rater-consistency-pilot/judge-a.md
  - evaluation/results/rater-consistency-pilot/judge-b.md
  - evaluation/results/rater-consistency-pilot/judge-c.md
---

# Claim Segmentation Consistency Report

## 结论

**当前 12 个 blind artifact 上，claim 切分不是问题。**

三位 judge 对每个 artifact 的 claim 数量和 claim_id 集合都完全一致：

- `mean_claim_segmentation_gap = 0.00`
- `max_claim_segmentation_gap = 0`
- `all_claim_id_sets_equal = true`

因此，三评审实验里剩余的 claim-level 分歧，**不是由 claim 切分不一致导致的**，而是标签边界本身仍有一条待澄清的规则。

## 1. 实验对象

| 项目 | 值 |
|---|---:|
| artifact 数量 | 12 |
| judge 数量 | 3 |
| 总 claim 单元 | 34 |
| 数据来源 | `judge-a.md` / `judge-b.md` / `judge-c.md` |

## 2. 检查方法

对每个 artifact，比对三位 judge 的：

1. claim 条数
2. claim_id 集合

如果 claim 条数不同，记为 segmentation gap；如果 claim_id 集合不同，记为切分口径不一致。

## 3. 核心结果

| 指标 | 结果 | 判断 |
|---|---:|---|
| mean_claim_segmentation_gap | 0.00 | 通过 |
| max_claim_segmentation_gap | 0 | 通过 |
| all_claim_id_sets_equal | true | 通过 |

## 4. artifact 级结果

| artifact_id | judge_a | judge_b | judge_c | claim_id_sets_equal |
|---|---:|---:|---:|---|
| A01 | 3 | 3 | 3 | true |
| A02 | 2 | 2 | 2 | true |
| A03 | 3 | 3 | 3 | true |
| A04 | 3 | 3 | 3 | true |
| A05 | 3 | 3 | 3 | true |
| A06 | 3 | 3 | 3 | true |
| A07 | 3 | 3 | 3 | true |
| A08 | 4 | 4 | 4 | true |
| A09 | 2 | 2 | 2 | true |
| A10 | 3 | 3 | 3 | true |
| A11 | 2 | 2 | 2 | true |
| A12 | 3 | 3 | 3 | true |

## 5. 与三评审结果合并后的解释

结合 `triangulation-report.md`，现在可以更准确地判断：

1. 三评审 artifact 级结果完全一致
2. claim 切分也完全一致
3. 剩余分歧只集中在**标签边界**

也就是说，当前最该修的不是“claim 怎么切”，而是：

- 流程性缺口说明默认算 `not-scored`
- `unsupported` 和 `uncertain` 的边界再写清一条

## 6. 当前判断

因此，下一轮正式多评审实验前，最有效的动作不是再猜测 judge 是否会切分不一致，而是：

> **先补标签边界培训说明，再扩 blind pack 重跑 claim-level 一致性。**
