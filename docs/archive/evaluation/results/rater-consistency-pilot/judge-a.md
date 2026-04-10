---
judge: A
pilot: rater-consistency-pilot
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
generated_at: 2026-04-09
blind: true
---

本次盲评里，A02/A04/A06/A08/A10/A12 基本遵守了 canon 边界；A01/A03/A05/A07 的主要问题是把训练知识或单边意见写成结论；A09/A11 虽然边界诚实，但 write-back schema 缺关键字段，因此仅给 partial。

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | claim_1 | unsupported | canon 只支持“托管成本/控制权/混合检索”，不支持“性能/成本/可扩展性”三分法。 |
| A01 | claim_2 | unsupported | “混合检索”有依据，但“多租户也很重要”无 canon 支撑，整条未被来源覆盖。 |
| A01 | claim_3 | unsupported | canon 未给出“不同场景答案会不同”这一结论，属泛化训练知识。 |
| A02 | claim_1 | supported | 与 `ai/databases/vector-db-selection` 的三项关键权衡完全一致。 |
| A02 | claim_2 | supported | Pinecone/ Milvus/ Weaviate 的侧重点与对比表一致。 |
| A03 | claim_1 | unsupported | canon 只保留 90/180 天冲突，不支持“长期不用就应该归档”的统一规则。 |
| A03 | claim_2 | unsupported | 90 天只是运营团队主张，不能写成“常见阈值”。 |
| A03 | claim_3 | unsupported | canon 说的是研究团队主张 180 天，不是“研究页面可放宽到 180 天”的规则。 |
| A04 | claim_1 | supported | `ai/wiki/archive-threshold` 明确写明没有单一归档阈值。 |
| A04 | claim_2 | supported | 运营团队 90 天不活跃即归档，和 canon 一致。 |
| A04 | claim_3 | supported | 研究团队认为 180 天更合理，和 canon 一致。 |
| A05 | claim_1 | unsupported | namespace/权限模型/成本三项都未出现在现有 canon。 |
| A05 | claim_2 | unsupported | canon 没有单独页面说明 Pinecone 或 Weaviate 的多租户能力。 |
| A05 | claim_3 | unsupported | “大型 B2B 一般都要强隔离”无 canon 依据。 |
| A06 | claim_1 | supported | 现有 canon 的确覆盖了部署控制权与混合检索能力这两项。 |
| A06 | claim_2 | supported | 已显式标为 canon 外推断，且由“更高部署控制权”推到“更易自定义隔离策略”，链条清楚。 |
| A06 | claim_3 | not-scored | 明确说明 canon 对租户隔离模型仍有缺口，按 rubric 不计分。 |
| A07 | claim_1 | unsupported | canon 明说没有冲突裁决机制，不能发明“优先看日志”。 |
| A07 | claim_2 | unsupported | “日志不全再看文档”是新编流程，canon 未定义。 |
| A07 | claim_3 | unsupported | “常见排查顺序”无来源支撑，且与题目所问裁决机制无关。 |
| A08 | claim_1 | supported | `infra/observability/source-of-truth-choice` 确实只给适用场景，不给裁决机制。 |
| A08 | claim_2 | supported | 文档优先适合沉淀稳定共识，和 canon 一致。 |
| A08 | claim_3 | supported | 日志优先适合还原运行现场，和 canon 一致。 |
| A08 | claim_4 | not-scored | 这是显式缺口说明与 write-back 建议，按 rubric 不计分。 |
| A09 | claim_1 | not-scored | 明确说明当前 canon 无对应页面，属缺口说明。 |
| A09 | claim_2 | not-scored | 这是 proposal/后续补充建议，不是领域事实性主张。 |
| A10 | claim_1 | not-scored | 明确说明当前 canon 无对应页面，属缺口说明。 |
| A10 | claim_2 | not-scored | “不提供未经验证公式”是边界声明，不计入事实性 claim。 |
| A10 | claim_3 | not-scored | 缺口登记与后续建议属流程说明，不计分。 |
| A11 | claim_1 | not-scored | 明确说明 canon 无该集成流程，属缺口说明。 |
| A11 | claim_2 | not-scored | proposal 已生成/建议补充规范，属于流程层说明。 |
| A12 | claim_1 | not-scored | 明确说明 canon 无该集成流程，属缺口说明。 |
| A12 | claim_2 | not-scored | “不编造自动化流程”是边界声明，不计入事实性 claim。 |
| A12 | claim_3 | not-scored | 缺口登记与后续建议属流程说明，不计分。 |

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | no | no | fail | covered case 直接输出 3 条未被 canon 支持的主张；额外 write-back 还缺 `trigger_source`/`origin`。 |
| A02 | yes | n/a | pass | 回答紧贴 canon，对比点与来源标注都正确。 |
| A03 | no | no | fail | 把冲突页面写成单一规则，且无来源；附带 proposal 也缺关键字段。 |
| A04 | yes | n/a | pass | 如实呈现 90/180 天分歧，没有虚构统一阈值。 |
| A05 | no | no | fail | partial case 未说明缺口，反而用训练知识扩写；proposal 缺关键字段。 |
| A06 | yes | yes | pass | 有限外推有标注且保留缺口说明，write-back schema 完整。 |
| A07 | no | no | fail | 在 canon 明确无裁决机制时仍编造“日志优先”流程；proposal 也不合格。 |
| A08 | yes | yes | pass | 先交代边界，再给出双方适用场景，并附合法 write-back。 |
| A09 | yes | no | partial | 缺口说明是诚实的，但 write-back 缺 `trigger_source`/`origin`。 |
| A10 | yes | yes | pass | gap case 处理规范：不编造公式，且 proposal 字段齐全。 |
| A11 | yes | no | partial | 缺口说明正确，但 write-back schema 缺关键字段。 |
| A12 | yes | yes | pass | gap case 处理完整，拒绝编造流程且 proposal 合法。 |

## Findings

- covered case 最常见的问题是把训练常识直接写成 canon 结论。
- 带 `has_divergence: true` 的页面一旦被写成单一规则，应直接从 supported 降到 unsupported。
- partial case 只要外推被明确标注、链条收敛且保留缺口说明，可以判 pass。
- gap case 的主要失分点不是幻觉，而是 write-back schema 漏掉 `trigger_source`/`origin`。
