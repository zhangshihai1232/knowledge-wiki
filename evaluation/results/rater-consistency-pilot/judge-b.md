---
judge: B
task: rater-consistency-pilot
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
generated_at: 2026-04-09
---

本次仅依据 query-benchmark、query-judging-rubric 与 canon-seed 逐条核对，不推断任何组别。我的判断是：A02/A04/A06/A08/A10/A12 为 pass，A09/A11 为 partial，A01/A03/A05/A07 为 fail；主要分水岭在于是否忠实贴合 canon、是否诚实承认缺口，以及 write-back schema 是否补齐关键字段。

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | claim_1 | unsupported | canon 只给出托管成本/控制权/混合检索三项；“性能/成本/可扩展性”无页内依据。 |
| A01 | claim_2 | unsupported | 混合检索有依据，但“多租户也很重要”不在该页；整条超出 canon。 |
| A01 | claim_3 | unsupported | 页内是三维取舍，不直接支持“不同场景下答案会不同”这一泛化结论。 |
| A02 | claim_1 | supported | 与 `ai/databases/vector-db-selection` 的选择建议基本逐字一致。 |
| A02 | claim_2 | supported | 与对比表一致：Pinecone 免运维、Milvus 控制权最高、Weaviate 混合检索更友好。 |
| A03 | claim_1 | uncertain | canon 讨论的是冲突阈值，能说明“不活跃与归档相关”，但未给出统一归档规则。 |
| A03 | claim_2 | unsupported | 90 天只是运营团队一方主张；“常见阈值”把分歧写成共识。 |
| A03 | claim_3 | unsupported | 180 天是研究团队主张，不是“研究页面放宽到 180 天”的明文规范。 |
| A04 | claim_1 | supported | `ai/wiki/archive-threshold` 明确写明当前没有单一归档阈值。 |
| A04 | claim_2 | supported | 与运营团队“90 天不活跃即归档”的主张一致。 |
| A04 | claim_3 | supported | 与研究团队“180 天更合理”的主张一致。 |
| A05 | claim_1 | unsupported | namespace/权限模型/成本这一组判断不在现有 canon 页中。 |
| A05 | claim_2 | unsupported | 现有 canon 未定义 Pinecone/Weaviate 的多租户支持矩阵。 |
| A05 | claim_3 | unsupported | “大型 B2B 一般都需要强隔离”属于外部常识，不是 canon 内容。 |
| A06 | claim_1 | supported | `vector-db-selection` 确有“部署控制权、混合检索能力”两项直接依据。 |
| A06 | claim_2 | supported | 已显式标注为 `canon 外推断`，链条基于“自托管=更高控制权”，且保留待验证。 |
| A06 | claim_3 | not-scored | 这是显式缺口说明，按 rubric 属不计分项。 |
| A07 | claim_1 | unsupported | `source-of-truth-choice` 明确说未提供冲突裁决机制，不能反推“先看日志”。 |
| A07 | claim_2 | unsupported | “日志不全再看文档”是新增规则，canon 无依据。 |
| A07 | claim_3 | unsupported | “常见排查顺序”是训练知识式泛化，无 canon 支撑。 |
| A08 | claim_1 | supported | 与“只保留适用场景，不提供冲突裁决机制”一致。 |
| A08 | claim_2 | supported | 与“文档优先适合沉淀长期共识”一致。 |
| A08 | claim_3 | supported | 与“日志优先适合还原真实运行现场”一致。 |
| A08 | claim_4 | supported | 前半句与 canon 一致，后半句也符合 QB-P-14 的 write-back 期望且 excerpt 已给出。 |
| A09 | claim_1 | not-scored | 明确的缺口说明本身，按 rubric 不计分。 |
| A09 | claim_2 | supported | excerpt 确有 proposal；建议后续补充规范也符合 gap case 方向。 |
| A10 | claim_1 | not-scored | 明确的缺口说明本身，按 rubric 不计分。 |
| A10 | claim_2 | not-scored | 显式拒绝未经验证公式，属于边界声明，不计分。 |
| A10 | claim_3 | supported | excerpt 已登记 proposal，且补页面建议符合 gap case。 |
| A11 | claim_1 | not-scored | 明确的缺口说明本身，按 rubric 不计分。 |
| A11 | claim_2 | supported | excerpt 确有 proposal；“补充集成规范”与 gap case 预期一致。 |
| A12 | claim_1 | not-scored | 明确的缺口说明本身，按 rubric 不计分。 |
| A12 | claim_2 | not-scored | 显式不编造流程，属于边界声明，不计分。 |
| A12 | claim_3 | supported | excerpt 已登记 proposal，建议补充集成规范合理。 |

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | no | no | fail | covered case 全部越界；还触发了不必要且缺字段的 write-back。 |
| A02 | yes | n/a | pass | covered case，答案紧贴 canon。 |
| A03 | no | no | fail | 把冲突阈值改写成统一规则；write-back 也缺关键字段。 |
| A04 | yes | n/a | pass | 忠实呈现冲突，不虚构统一阈值。 |
| A05 | no | no | fail | partial case 未承认缺口，三条均为训练知识。 |
| A06 | yes | yes | pass | 有据部分与外推部分边界清楚，且缺口与 write-back 处理到位。 |
| A07 | no | no | fail | 编造了冲突裁决顺序；schema 也不完整。 |
| A08 | yes | yes | pass | 如实说明无裁决机制，并正确触发 write-back。 |
| A09 | yes | no | partial | gap 处理基本诚实，但 proposal 缺 `trigger_source/origin`。 |
| A10 | yes | yes | pass | gap 处理完整且边界清楚，schema 合法。 |
| A11 | yes | no | partial | gap 处理诚实，但 proposal schema 不完整。 |
| A12 | yes | yes | pass | gap 处理完整，拒绝编造且 schema 合法。 |

- covered 题一旦把训练知识写成 canon 结论，我直接判为重度失真。
- partial 题可以少量外推，但必须显式标注并同时说明缺口。
- gap 题的高分关键不是“多答”，而是诚实拒答加合法 write-back。
- 本包里反复出现的 schema 问题是缺少 `trigger_source` 与 `origin`。
