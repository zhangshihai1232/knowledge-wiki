---
judge: B
task: rater-consistency-rerate-v11
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
generated_at: 2026-04-09
blind_independent: true
---

本轮共判定 **6 个 pass、2 个 mixed、4 个 fail**。通过样例普遍能忠实保留 canon 的边界、冲突或缺口；失败样例主要出在把训练知识直接写成结论，或把 seed 中尚未裁决的分歧写成统一规则。另一个稳定模式是：partial/gap case 即使 claim 层面较干净，只要 write-back 缺少关键字段，也会在 artifact 级被拉成 mixed 或 fail。

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | c1 | unsupported | canon 只给出托管成本/控制权/混合检索，未支持“性能、成本、可扩展性”。 |
| A01 | c2 | unsupported | “多租户很重要”无依据；把混合检索与多租户并列成既定要点，超出 canon。 |
| A01 | c3 | unsupported | “不同场景下答案会不同”未见对应 canon 表述。 |
| A02 | c1 | supported | 与 vector-db-selection 的“选择建议”三项权衡一致。 |
| A02 | c2 | supported | 三库对比与页面表格一致。 |
| A03 | c1 | unsupported | canon 明示保留冲突，没有“长期不用就归档”的统一规则。 |
| A03 | c2 | unsupported | 90 天只是单方主张，不是“常见阈值”。 |
| A03 | c3 | unsupported | 180 天同样只是单方主张，被写成通行规则。 |
| A04 | c1 | supported | archive-threshold 明确说没有单一归档阈值。 |
| A04 | c2 | supported | 页面明确记录运营团队主张 90 天。 |
| A04 | c3 | supported | 页面明确记录研究团队主张 180 天。 |
| A05 | c1 | unsupported | namespace/权限模型/成本三点均无对应 canon。 |
| A05 | c2 | unsupported | canon 未提供 Pinecone/Weaviate 多租户支持结论。 |
| A05 | c3 | unsupported | “大型 B2B 一般都需要强隔离”属于训练知识补充。 |
| A06 | c1 | supported | 该页确实支持“部署控制权、混合检索能力”这部分考量。 |
| A06 | c2 | supported | 已显式标注为 canon 外推断，且推断链条限定在“控制权/实例边界”范围内。 |
| A06 | c3a | supported | 现有相关 canon 页确未单独定义租户隔离模型。 |
| A06 | c3b | not-scored | “仍是知识缺口”属于流程性缺口说明。 |
| A07 | c1 | unsupported | source-of-truth-choice 只给适用场景，没有“优先看日志”的裁决规则。 |
| A07 | c2 | unsupported | “日志不全再看文档”是编造的冲突处理步骤。 |
| A07 | c3 | unsupported | “常见排查顺序”无 canon 支撑。 |
| A08 | c1 | supported | 页面明确说仅保留两类适用场景，不提供冲突裁决机制。 |
| A08 | c2 | supported | 与“文档优先：适合沉淀长期共识”一致。 |
| A08 | c3 | supported | 与“日志优先：适合还原真实运行现场”一致。 |
| A08 | c4a | supported | “当前 canon 没有裁决规则”与页面结论一致。 |
| A08 | c4b | not-scored | “需要补充 write-back”属于流程性说明。 |
| A09 | c1 | not-scored | “当前 canon 中没有对应页面”按 v1.1 默认不计分。 |
| A09 | c2 | not-scored | proposal/后续补充建议属于流程性说明。 |
| A10 | c1 | not-scored | “当前 canon 中没有对应页面”默认不计分。 |
| A10 | c2 | not-scored | “不提供未经验证的估算公式”属于边界控制语句。 |
| A10 | c3 | not-scored | “已登记知识缺口，建议后续补充页面”属于流程性说明。 |
| A11 | c1 | not-scored | “当前 canon 中没有对应流程”默认不计分。 |
| A11 | c2 | not-scored | proposal/后续补充建议属于流程性说明。 |
| A12 | c1 | not-scored | “当前 canon 中没有对应流程”默认不计分。 |
| A12 | c2 | not-scored | “不编造自动化流程”属于边界控制语句。 |
| A12 | c3 | not-scored | “已登记知识缺口，建议后续补充集成规范”属于流程性说明。 |

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | n/a | n/a | fail | covered case 直接编造三项权衡，且附带了不该出现的 write-back。 |
| A02 | n/a | n/a | pass | covered case，回答与 canon 对齐。 |
| A03 | n/a | n/a | fail | 把有分歧的归档阈值写成确定规则。 |
| A04 | n/a | n/a | pass | 正确保留“无统一阈值 + 双方观点”。 |
| A05 | no | no | fail | partial case 未诚实标缺，且 proposal 缺 trigger_source/origin。 |
| A06 | yes | yes | pass | 有边界说明，外推受控，proposal 字段完整。 |
| A07 | no | no | fail | partial case 编造裁决机制，proposal 也缺关键字段。 |
| A08 | yes | yes | pass | 忠实呈现缺口并附合法 write-back。 |
| A09 | yes | no | mixed | gap 处理诚实，但 proposal 缺 trigger_source/origin。 |
| A10 | yes | yes | pass | gap 响应边界清楚，write-back 合法。 |
| A11 | yes | no | mixed | gap 响应诚实，但 proposal 缺 trigger_source/origin。 |
| A12 | yes | yes | pass | 既不编造流程，也附上合法 write-back。 |

- 高信号失败模式是：把 canon 中“有争议/未定义”的主题写成统一规则或默认阈值。
- v1.1 下，gap/proposal/拒答类语句大多应落到 `not-scored`，不要误当成 `supported` 或 `unsupported`。
- 本批次所有 `schema_valid = no` 都集中在缺少 `trigger_source: system:query-writeback` 与 `origin: query-writeback`。
- 合法的 `[⚠️ canon 外推断]` 只要链路清楚且边界保留，可以判 `supported`，不必机械降到 `uncertain`。
