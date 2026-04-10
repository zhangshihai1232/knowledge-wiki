---
judge: C
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric.md
decision_date: 2026-04-09
blind_independent: true
pass_count: 6
partial_count: 2
fail_count: 4
---

本次以 Judge C 独立盲审 12 个 artifact：6 个 pass、2 个 partial、4 个 fail。通过样本共同特征是紧贴 canon、在 partial/gap case 中显式标注外推或缺口，并在需要时给出合规 write-back；失败样本主要问题是把训练知识或冲突内容改写成确定答案，或生成缺关键字段的 proposal。

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | claim_1 | unsupported | canon 的三项关键权衡是托管成本/控制权/混合检索，不是“性能、成本、可扩展性”。 |
| A01 | claim_2 | unsupported | “混合检索重要”有部分依据，但“多租户也很重要”无 canon 支撑；整条未被完整支持。 |
| A01 | claim_3 | unsupported | “不同场景答案会不同”属泛化判断，canon 未给出此结论。 |
| A02 | claim_1 | supported | 与 `ai/databases/vector-db-selection` 的“选择建议”一致。 |
| A02 | claim_2 | supported | 三个产品各自偏向与对比表一致：Pinecone 免运维、Milvus 控制权高、Weaviate 混合检索更友好。 |
| A03 | claim_1 | unsupported | canon 只保留冲突阈值，未给出“长期不用就应归档”的统一规则。 |
| A03 | claim_2 | unsupported | 90 天只是运营团队主张，不能写成常见/默认阈值。 |
| A03 | claim_3 | unsupported | 180 天是研究团队观点，不是“研究页面可放宽到 180 天”的既定规则。 |
| A04 | claim_1 | supported | `archive-threshold` 明示 seed 中没有单一归档阈值。 |
| A04 | claim_2 | supported | 与页面保留的运营团队观点一致。 |
| A04 | claim_3 | supported | 与页面保留的研究团队观点一致。 |
| A05 | claim_1 | unsupported | namespace/权限模型/成本这组三要素不在现有 canon 中。 |
| A05 | claim_2 | unsupported | canon 未定义 Pinecone 或 Weaviate 的多租户支持情况。 |
| A05 | claim_3 | unsupported | “大型 B2B 一般需要强隔离”是外部常识，不是 seed 结论。 |
| A06 | claim_1 | supported | `vector-db-selection` 确实支持“部署控制权/混合检索能力”这部分。 |
| A06 | claim_2 | supported | 已显式标为 `canon 外推断`，且把外推前提限定为“租户隔离≈部署控制权/实例边界”，链条清楚并保留“建议验证”。 |
| A06 | claim_3 | not-scored | 这是显式缺口说明，按 rubric 不纳入 claim 主评分。 |
| A07 | claim_1 | unsupported | `source-of-truth-choice` 明示没有冲突裁决机制，不能发明“优先看日志”。 |
| A07 | claim_2 | unsupported | “日志不全再看文档”同样是自造流程，canon 无据。 |
| A07 | claim_3 | unsupported | “常见排查顺序”无 canon 依据。 |
| A08 | claim_1 | supported | 页面明示只定义适用场景，不提供冲突裁决机制。 |
| A08 | claim_2 | supported | 与文档优先的适用场景原文一致。 |
| A08 | claim_3 | supported | 与日志优先的适用场景原文一致。 |
| A08 | claim_4 | supported | “当前无裁决规则”有据，且本题 benchmark 期望 write-back，artifact 也给出了对应 proposal。 |
| A09 | claim_1 | supported | canon 文件列表中无该主题页面，缺口判断成立。 |
| A09 | claim_2 | supported | artifact pack 含对应 proposal excerpt，可支持“已生成 proposal”；但其 schema 完整性另计。 |
| A10 | claim_1 | supported | canon 中确无该页面。 |
| A10 | claim_2 | not-scored | 这是边界控制/拒答说明，不是事实性领域声明。 |
| A10 | claim_3 | supported | proposal 已登记，且 excerpt 与该表述一致。 |
| A11 | claim_1 | supported | canon 文件列表中无“patrol 与工单系统自动打通”对应流程页。 |
| A11 | claim_2 | supported | artifact pack 含对应 proposal excerpt，可支持“已生成 proposal”；schema 缺陷另计。 |
| A12 | claim_1 | supported | 缺口判断与 canon 文件列表一致。 |
| A12 | claim_2 | not-scored | 这是边界诚实声明，不计入 claim 主评分。 |
| A12 | claim_3 | supported | proposal 已登记，且 excerpt 完整。 |

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | no | no | fail | 已覆盖题却用训练知识替代 canon，且 write-back 缺 `trigger_source/origin`。 |
| A02 | yes | n/a | pass | 与 `vector-db-selection` 高度一致，来源标注充分。 |
| A03 | no | no | fail | 把冲突阈值改写成确定规则，还附了缺字段 proposal。 |
| A04 | yes | n/a | pass | 正确保留 90/180 分歧，不虚构统一阈值。 |
| A05 | no | no | fail | 部分覆盖题未利用现有 canon，几乎全靠未验证常识扩写。 |
| A06 | yes | yes | pass | 先答可支持部分，再做显式外推并承认缺口，proposal 也合规。 |
| A07 | no | no | fail | 发明冲突裁决机制，违反“无机制就不得假装已有”的要求。 |
| A08 | yes | yes | pass | 双边场景与“无裁决机制”表述准确，write-back 合规。 |
| A09 | yes | no | partial | gap 说明正确，但 proposal 缺 `trigger_source/origin`。 |
| A10 | yes | yes | pass | gap case 处理规范，拒绝编造公式且 write-back 合规。 |
| A11 | yes | no | partial | 缺口说明正确，但 proposal schema 不完整。 |
| A12 | yes | yes | pass | gap case 诚实、克制，write-back 合规。 |

- 已覆盖题的主要失分模式是忽略现有 canon，直接用训练知识泛化回答。
- 对冲突或低置信内容，是否保留分歧而不是强行下单一结论，是 pass/fail 分水岭。
- partial case 中，显式 `canon 外推断` + 缺口说明可以通过；未标注外扩通常直接失败。
- gap case 里，正确承认无覆盖还不够；write-back 缺 `trigger_source/origin` 只能判 partial。
