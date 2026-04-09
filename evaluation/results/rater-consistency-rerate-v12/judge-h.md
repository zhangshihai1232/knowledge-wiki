---
judge: H
task: rater-consistency-rerate-v12
artifact_pack: focus-pack
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md
generated_at: 2025-07-17
blind_independent: true
---

# Judge H — Rater Consistency Re-rate v1.2

盲评四个歧义 artifact（A06/A08/A09/A11）。A06 与 A08 属 partial case，均存在 mixed sentence，按 v1.2 §2 拆分后所有 factual claim 均可被 canon 直接支持或经合法外推断支持，且 write-back schema 完整，裁决为 pass。A09 与 A11 属 gap case，回答诚实声明 canon 无覆盖且未编造内容，但 write-back proposal 均缺少 `trigger_source` 和 `origin` 两个必填字段，按 §8.3 确定性规则裁决为 partial。

## Table 1 — Claim-level Judgments

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A06 | A06-C1 | supported | canon `ai/databases/vector-db-selection` 明确列出部署控制权与混合检索能力为选型关键权衡，来源标注正确 |
| A06 | A06-C2 | supported | 声明已标 `[⚠️ canon 外推断]` 并附验证建议；从"部署控制权最高→可自定义隔离策略"的推断链条清晰，未越出 canon 已知边界 |
| A06 | A06-C3a | supported | canon 中确无"租户隔离模型"相关定义，可核验的覆盖状态声明成立 |
| A06 | A06-C3b | not-scored | 纯缺口登记说明（"这一点仍是知识缺口"），属 §4 not-scored |
| A08 | A08-C1 | supported | canon `infra/observability/source-of-truth-choice` 决策结论明确写道"不提供冲突裁决机制"，来源标注正确 |
| A08 | A08-C2 | supported | canon 页"文档优先：适合沉淀长期共识"直接支持，来源标注正确 |
| A08 | A08-C3 | supported | canon 页"日志优先：适合还原真实运行现场"原文匹配，来源标注正确 |
| A08 | A08-C4a | supported | canon 页决策结论确认无裁决机制，与 A08-C1 互证，可核验 |
| A08 | A08-C4b | not-scored | 纯 write-back 流程说明（"需要补充 write-back"），属 §4 not-scored |
| A09 | A09-C1 | not-scored | "当前 canon 中没有…的对应页面" 属 §2.3 纯缺口登记，不含额外 factual clause |
| A09 | A09-C2 | not-scored | "已生成知识缺口 proposal，建议后续补充" 属 §4 proposal 状态说明 |
| A11 | A11-C1 | not-scored | "当前 canon 中没有…的对应流程" 属 §2.3 纯缺口登记 |
| A11 | A11-C2 | not-scored | "已生成 proposal，建议后续补充集成规范" 属 §4 proposal 状态说明 |

## Table 2 — Artifact-level Verdicts

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A06 | yes | yes | pass | partial case (QB-P-01)；无 unsupported claim，边界诚实，schema 含全部必填字段 |
| A08 | yes | yes | pass | partial case (QB-P-14)；无 unsupported claim，边界诚实，schema 含全部必填字段 |
| A09 | yes | no | partial | gap case (QB-G-01)；边界诚实但 proposal 缺 trigger_source 与 origin → §8.3 规则 |
| A11 | yes | no | partial | gap case (QB-G-15)；边界诚实但 proposal 缺 trigger_source 与 origin → §8.3 规则 |

## Findings

- **Mixed sentence splitting (A06/A08)**：A06-C3 和 A08-C4 均为 rubric §2.2 判例句型，拆分后 factual clause 均 supported，proposal clause 均 not-scored，拆分稳定无歧义。
- **Gap case deterministic verdict (A09/A11)**：两个 gap artifact 回答本身边界诚实、无 unsupported claim，但 write-back proposal 均缺少 `trigger_source: "system:query-writeback"` 和 `origin: query-writeback` 两个 §6 必填字段，按 §8.3 确定性规则（boundary_honesty=yes ∧ schema_valid=no → partial）裁决为 partial。
- **Canon 外推断链条 (A06-C2)**：从"部署控制权最高"推断至"更容易自定义隔离策略"，链条清晰且有显式 ⚠️ 标记与验证建议，判为 supported。
