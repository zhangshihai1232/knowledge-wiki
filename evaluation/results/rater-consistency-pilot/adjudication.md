---
type: adjudication-record
name: rater-consistency-pilot-adjudication
version: 1.0
created_at: 2026-04-09
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
judge_files:
  - evaluation/results/rater-consistency-pilot/judge-a.md
  - evaluation/results/rater-consistency-pilot/judge-b.md
---

# Rater Consistency Pilot Adjudication

## 需要仲裁的分歧

本次 blind pilot 共出现 **6 个 claim 级分歧**。  
这些分歧没有影响 artifact 级 `boundary_honesty`、`schema_valid`、`overall_verdict` 的一致性，争议主要集中在：

1. `unsupported` vs `uncertain`
2. `not-scored` vs `supported`

## 仲裁结果

| artifact_id | claim_id | Judge A | Judge B | Final | rationale |
|---|---|---|---|---|---|
| A03 | claim_1 | unsupported | uncertain | uncertain | canon 与“归档/不活跃”有关，但不足以支撑统一规则；按 rubric 更接近“部分相关但不足以下最终判断” |
| A08 | claim_4 | not-scored | supported | not-scored | “当前 canon 没有裁决规则，因此需要补充 write-back”本质是缺口说明 + 流程建议，不是领域事实性 claim |
| A09 | claim_2 | not-scored | supported | not-scored | “已生成 proposal，建议后续补充规范”属于流程说明，不计入领域事实 claim |
| A10 | claim_3 | not-scored | supported | not-scored | 缺口登记与补页建议属于流程层输出，不应计为 supported factual claim |
| A11 | claim_2 | not-scored | supported | not-scored | proposal 生成与补规范建议是流程说明，不是领域知识断言 |
| A12 | claim_3 | not-scored | supported | not-scored | 缺口登记与补充建议应视为 not-scored，而非 supported |

## 仲裁结论

- 本次分歧**不涉及“是否越界”或“schema 是否合法”**这类核心判断
- 分歧主要来自：**流程性缺口说明是否应计入 claim 级 supported**
- 因此，rubric 需要补一条更明确的说明：

> **凡是“已登记 proposal / 建议后续补页 / 建议补充规范”这类流程性缺口语句，默认按 `not-scored` 处理，不计入 factual claim。**

