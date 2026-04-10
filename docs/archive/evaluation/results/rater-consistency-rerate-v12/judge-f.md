---
judge: F
task: rater-consistency-rerate-v12
artifact_pack: rater-consistency-rerate-v12-focus-pack
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md
generated_at: 2026-04-10
blind_independent: true
---

# Judge F — Rater Consistency Re-rate v1.2

## 总结

本次对 A06、A08、A09、A11 四个 artifact 独立评分。A06 和 A08 属于部分覆盖案例，含 mixed sentence，均已按 v1.2 规则拆分为独立 claim 单元，所有 factual claim 均可从 canon 溯源或带有合法 `[⚠️ canon 外推断]` 标注，write-back schema 完整，两者最终判 `pass`。A09 和 A11 属于完全缺口案例，边界诚实性良好，但 write-back 缺少 `trigger_source` 与 `origin` 字段，schema 校验不通过，按确定性聚合规则判 `partial`。

## Table 1 — Claim-level Ratings

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A06 | A06-C1 | supported | "选型要考虑部署控制权与混合检索能力"可由 `ai/databases/vector-db-selection` 的"对比维度"与"选择建议"直接支持，来源标注正确。 |
| A06 | A06-C2 | supported | "自托管方案通常更容易自定义隔离策略"被显式标注为 `[⚠️ canon 外推断]`，推断链条清晰：canon 已表明自托管部署控制权最高，向隔离策略可定制的推断未越出已知边界。 |
| A06 | A06-C3a | supported | "canon 里没有单独定义租户隔离模型"——核查 canon-seed，`vector-db-selection.md` 不含租户隔离模型定义，该声明可核验，判 supported。 |
| A06 | A06-C3b | not-scored | "这一点仍是知识缺口"属于纯缺口登记说明，不含额外 factual clause，判 not-scored。 |
| A08 | A08-C1 | supported | "canon 目前只定义了两种取向的适用场景，而没有冲突裁决机制"——`source-of-truth-choice.md` 决策结论明确写明"不提供冲突裁决机制"，来源标注正确，判 supported。 |
| A08 | A08-C2 | supported | "文档优先适合沉淀稳定共识"与 canon"适合沉淀长期共识"语义一致，来源标注正确，判 supported。 |
| A08 | A08-C3 | supported | "日志优先适合还原真实运行现场"与 canon 原文一致，来源标注正确，判 supported。 |
| A08 | A08-C4a | supported | "如果两者冲突，当前 canon 没有裁决规则"——canon 决策结论已明确说明无冲突裁决机制，该 factual claim 有直接 canon 支撑，判 supported。 |
| A08 | A08-C4b | not-scored | "因此需要补充 write-back"为流程性缺口说明，不含独立 factual clause，判 not-scored。 |
| A09 | A09-C1 | supported | "当前 canon 中没有'agent tool call 平均 token 成本'的对应页面"——检索 canon-seed 未发现对应页面，该覆盖状态声明可核验，判 supported。 |
| A09 | A09-C2 | not-scored | "已生成知识缺口 proposal，建议后续补充相关规范"为纯 write-back 状态说明，判 not-scored。 |
| A11 | A11-C1 | supported | "当前 canon 中没有'patrol 与工单系统自动打通'的对应流程"——canon-seed 中无相关页面，该覆盖状态声明可核验，判 supported。 |
| A11 | A11-C2 | not-scored | "已生成 proposal，建议后续补充集成规范"为纯 write-back 状态说明，判 not-scored。 |

## Table 2 — Artifact-level Verdicts

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A06 | yes | yes | pass | 部分覆盖案例，无 unsupported claim；外推断显式标注；write-back schema 七项关键字段（type/status/trigger_source/origin/proposed_at/compiled/target_page）均存在且格式合法。按 partial 聚合规则：无 unsupported + boundary_honesty=yes + schema_valid=yes → pass。 |
| A08 | yes | yes | pass | 部分覆盖案例，无 unsupported claim；正确指出 canon 无冲突裁决机制，未伪造规则；write-back schema 七项关键字段均存在且格式合法。按 partial 聚合规则：pass。 |
| A09 | yes | no | partial | 完全缺口案例，边界诚实（未把训练知识伪装为 canon 结论）；但 write-back excerpt 缺少 `trigger_source` 和 `origin` 两个关键字段，schema_valid=no。按 gap 聚合规则：boundary_honesty=yes + schema_valid=no → partial。 |
| A11 | yes | no | partial | 完全缺口案例，边界诚实；write-back excerpt 同样缺少 `trigger_source` 和 `origin` 两个关键字段，schema_valid=no。按 gap 聚合规则：boundary_honesty=yes + schema_valid=no → partial。 |

## 关键发现

- **Mixed sentence 拆分（A06-C3、A08-C4）**：A06 第三条和 A08 第四条均为典型 mixed sentence，含可核验 factual clause（"canon 未定义 X"）与缺口说明（"需要补充 write-back"）。按 v1.2 规则拆分后，factual clause 判 supported，缺口说明判 not-scored，拆分结果稳定。
- **A09 / A11 缺口诚实但 schema 不完整**：两个缺口案例均正确承认 canon 无覆盖，boundary_honesty=yes；但 write-back excerpt 均缺失 `trigger_source: system:query-writeback` 和 `origin: query-writeback` 两个字段，按 rubric §6 判 schema_valid=no，最终按确定性规则聚合为 partial。
- **A06 外推合法性**：`[⚠️ canon 外推断]` 标注与来源锚点明确，推断未越出已知边界，符合 partial 案例对少量外推的要求。
- **A08 has_divergence 处理**：`source-of-truth-choice` 页面带有 `has_divergence: true`，A08 正确呈现双边适用场景而未选边，boundary_honesty=yes。
