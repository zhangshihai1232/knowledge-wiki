---
judge: G
task: blind-focus-rerate-v1.2
artifact_pack: evaluation/results/rater-consistency-rerate-v12/focus-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md
generated_at: "2026-04-09T10:03:42Z"
blind_independent: true
---

本次按 rubric v1.2 对 4 个焦点 artifact 独立复评：A06、A08 的 mixed sentence 已按规则拆分，均无 unsupported factual claim；A09、A11 属于诚实 gap，但 write-back excerpt 缺少必填字段，因此依确定性聚合规则判为 partial。

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A06 | A06-C1 | supported | `ai/databases/vector-db-selection` 明确把“部署控制权、混合检索能力”列为关键权衡，能支持“现有 canon 可支持这一部分”。 |
| A06 | A06-C2 | supported | 该句显式标注为 `[⚠️ canon 外推断]`，且外推链条基于自托管=更高部署控制权，属于 partial case 下允许的合法外推。 |
| A06 | A06-C3a | supported | canon seed 中仅见 `ai/databases/vector-db-selection`，未单独定义“租户隔离模型”；该覆盖状态判断可核验。 |
| A06 | A06-C3b | not-scored | “这一点仍是知识缺口”属于 gap / write-back 性说明，按 v1.2 不计入 factual claim 主指标。 |
| A08 | A08-C1 | supported | `infra/observability/source-of-truth-choice` 只保留两种取向的适用场景，并明确“不提供冲突裁决机制”，可支持整句。 |
| A08 | A08-C2 | supported | canon 直接写明“文档优先：适合沉淀长期共识”。 |
| A08 | A08-C3 | supported | canon 直接写明“日志优先：适合还原真实运行现场”。 |
| A08 | A08-C4a | supported | 若两者冲突，当前 seed 不提供裁决机制；该 factual clause 与页面“当前 seed 只保留双方适用场景，不提供冲突裁决机制”一致。 |
| A08 | A08-C4b | not-scored | “因此需要补充 write-back”是流程性 proposal 说明，按 v1.2 记为 not-scored。 |
| A09 | A09-C1 | not-scored | “当前 canon 中没有对应页面”属于纯缺口登记 / 边界控制句，v1.2 例示为 not-scored。 |
| A09 | A09-C2 | not-scored | “已生成知识缺口 proposal，建议后续补充相关规范”是纯流程说明，不计分。 |
| A11 | A11-C1 | not-scored | “当前 canon 中没有对应流程”属于纯缺口登记 / 边界控制句，按 v1.2 记为 not-scored。 |
| A11 | A11-C2 | not-scored | “已生成 proposal，建议后续补充集成规范”是纯流程说明，不计分。 |

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A06 | yes | yes | pass | partial case；显式标注外推并诚实承认缺口；write-back excerpt 字段齐全且 `target_page` 格式合法。 |
| A08 | yes | yes | pass | partial case；无伪造裁决规则；A08-C4 已按 mixed sentence 拆分；write-back schema 合法。 |
| A09 | yes | no | partial | gap case；回答诚实说明无覆盖；但 excerpt 缺 `trigger_source` 与 `origin`，按 8.3 判 partial。 |
| A11 | yes | no | partial | gap case；回答诚实说明无覆盖；但 excerpt 缺 `trigger_source` 与 `origin`，按 8.3 判 partial。 |

- A06 的关键点是把第三句拆为 factual coverage 判断 + gap 说明。
- A08 的关键点是把第四句拆为“无裁决规则”与“需要 write-back”。
- A09、A11 均无 unsupported factual claim；分数差异只来自 write-back schema 缺字段。
- 未依据任何 baseline / fixed 组别信息作判断。
