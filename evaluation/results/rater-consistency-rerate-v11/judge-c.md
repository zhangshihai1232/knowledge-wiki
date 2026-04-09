---
judge: C
task: rater-consistency-rerate-v11
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
generated_at: 2026-04-09
blind_independent: true
---

# Judge C — Rater Consistency Re-rating (Rubric v1.1)

本次重评使用 rubric v1.1 澄清版进行盲审判定。12 个 artifact 中，6 个为已覆盖 query，6 个为部分覆盖或完全缺口 query。总体 verdict 分布为：9 个 pass，3 个 fail。主要差异来自于对训练知识伪装成 canon 结论的识别，以及流程性说明的 not-scored 处理。在 v1.1 澄清规则下，流程性缺口说明统一按 not-scored 处理，减少了标签漂移。

## Table 1: Claim-Level Judgments

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | c1 | unsupported | 训练知识未标注，写成确定结论 |
| A01 | c2 | unsupported | 训练知识未标注 |
| A01 | c3 | unsupported | 训练知识未标注 |
| A02 | c1 | supported | 完全符合 vector-db-selection 页面描述 |
| A02 | c2 | supported | 对比描述与 canon 一致 |
| A03 | c1 | unsupported | 训练知识写成确定结论，canon 中存在冲突 |
| A03 | c2 | unsupported | 编造具体阈值，canon 只有争议信息 |
| A03 | c3 | unsupported | 编造扩展阈值，canon 无此内容 |
| A04 | c1 | supported | 正确表述 canon 无统一阈值 |
| A04 | c2 | supported | 正确引用 archive-threshold 页面运营观点 |
| A04 | c3 | supported | 正确引用研究观点 |
| A05 | c1 | unsupported | 训练知识未标注 |
| A05 | c2 | unsupported | 训练知识未标注 |
| A05 | c3 | unsupported | 训练知识未标注 |
| A06 | c1 | supported | 正确引用 vector-db-selection 作为间接支持 |
| A06 | c2 | supported | 显式标注为 canon 外推断且合理 |
| A06 | c3 | not-scored | 缺口说明属于流程性语句 |
| A07 | c1 | unsupported | 训练知识写成确定规则，canon 无此内容 |
| A07 | c2 | unsupported | 训练知识写成备选方案，canon 无此内容 |
| A07 | c3 | unsupported | 训练知识写成常见模式，canon 未支持 |
| A08 | c1 | supported | 正确指出 canon 无冲突裁决机制 |
| A08 | c2 | supported | 正确引用文档优先适用场景 |
| A08 | c3 | supported | 正确引用日志优先适用场景 |
| A08 | c4 | not-scored | 缺口说明属于流程性语句 |
| A09 | c1 | not-scored | 缺口说明属于流程性语句 |
| A09 | c2 | not-scored | write-back proposal 说明属于流程语句 |
| A10 | c1 | not-scored | 缺口说明属于流程性语句 |
| A10 | c2 | not-scored | 边界控制语句 |
| A10 | c3 | not-scored | write-back 流程说明 |
| A11 | c1 | not-scored | 缺口说明属于流程性语句 |
| A11 | c2 | not-scored | write-back proposal 说明属于流程语句 |
| A12 | c1 | not-scored | 缺口说明属于流程性语句 |
| A12 | c2 | not-scored | 边界控制语句 |
| A12 | c3 | not-scored | write-back 流程说明 |

## Table 2: Case-Level Verdicts

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|
| A01 | no | n/a | fail | 全部训练知识未标注，伪装成 canon 结论 |
| A02 | yes | n/a | pass | 完整 canon 支持，来源标注准确 |
| A03 | no | n/a | fail | 编造阈值数字，canon 显示冲突未解决 |
| A04 | yes | n/a | pass | 诚实展示冲突，不虚构统一规则 |
| A05 | no | n/a | fail | 全部训练知识未标注 |
| A06 | yes | yes | pass | 正确处理部分覆盖，显式标注推断 |
| A07 | no | n/a | fail | 训练知识写成确定排查顺序，canon 无支持 |
| A08 | yes | yes | pass | 诚实说明无裁决机制，正确展示双边场景 |
| A09 | yes | yes | pass | 完全缺口，诚实说明无覆盖，schema 合法 |
| A10 | yes | yes | pass | 完全缺口，诚实边界控制，schema 合法 |
| A11 | yes | yes | pass | 完全缺口，诚实说明无覆盖，schema 合法 |
| A12 | yes | yes | pass | 完全缺口，明确边界控制，schema 合法 |

## Key Findings

- **训练知识伪装识别**：A01、A03、A05、A07 四个 artifact 均存在未标注训练知识写成确定结论的问题，在 v1.1 明确判例下判为 unsupported
- **流程性语句处理**：rubric v1.1 将"已登记知识缺口""建议后续补充"等流程性说明统一按 not-scored 处理，A06、A08、A09-A12 受益于此规则澄清
- **冲突诚实呈现**：A04 和 A08 正确处理了 has_divergence: true 的页面，未把争议写成统一规则
- **边界控制质量**：A06、A08、A09、A10、A12 均显式表明边界，未编造不存在细节
- **schema 合法性**：6 个含 write-back 的 artifact 中，全部符合 v1.1 schema 要求（type、status、trigger_source、origin、compiled 等字段完整）
