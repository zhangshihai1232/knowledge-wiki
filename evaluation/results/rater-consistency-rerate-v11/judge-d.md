---
judge: D
task: rater-consistency-rerate-v11
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
generated_at: 2026-04-09
blind_independent: true
---

# Judge D — Blind Re-Rating (Rubric v1.1)

12 个 artifact 中，6 个 pass、2 个 partial、4 个 fail。fail 集中在完全依赖训练知识且未引用 canon 的回答（A01、A03、A05、A07），它们共同特征是将训练知识当作事实输出，即使标注了 `[⚠️ 训练知识]` 也未能从 canon 中获取已有信息，在有 divergence 的主题上尤其严重——把未解决的分歧写成确定阈值或单边结论。pass 的 artifact（A02、A04、A06、A08、A10、A12）都正确引用了 canon 来源，在缺口场景诚实声明无覆盖且拒绝编造。两个 partial（A09、A11）内容行为正确但 write-back schema 缺少 `trigger_source` 和 `origin` 字段。

## Table 1 — Claim-Level Judgments

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | A01-C1 | unsupported | 声称权衡为"性能、成本和可扩展性"，canon 实际定义为"托管成本、自托管控制权、混合检索能力"；标注为训练知识，未引用 canon |
| A01 | A01-C2 | unsupported | 声称"多租户和混合检索能力也很重要"，canon 未提及多租户；标注为训练知识 |
| A01 | A01-C3 | unsupported | "不同场景下答案会不同"为训练知识泛论，canon 未支持此断言 |
| A02 | A02-C1 | supported | 三项权衡与 canon 选择建议完全一致，来源标注正确 |
| A02 | A02-C2 | supported | Pinecone/Milvus/Weaviate 对比与 canon 表格吻合，来源标注正确 |
| A03 | A03-C1 | unsupported | "页面长期不用就应该归档"为训练知识；canon 有 divergence 且无统一规则，此处写成确定结论 |
| A03 | A03-C2 | unsupported | 将"90 天"表述为"常见阈值"，canon 实际为运营团队单方主张且存在未解决分歧，不可写成已成立默认值 |
| A03 | A03-C3 | unsupported | 将"180 天"归因于"研究页面"，canon 仅记载研究团队主张 180 天更合理，未按页面类型区分；训练知识改写了 canon 原意 |
| A04 | A04-C1 | supported | 准确反映 canon 无单一归档阈值的 divergence 状态，来源正确 |
| A04 | A04-C2 | supported | "运营团队主张 90 天不活跃即归档"与 canon 原文一致 |
| A04 | A04-C3 | supported | "研究团队主张 180 天更合理"与 canon 原文一致 |
| A05 | A05-C1 | unsupported | "namespace、权限模型和成本"均不在 canon 中，纯训练知识且未标注 canon 外推断 |
| A05 | A05-C2 | unsupported | Pinecone/Weaviate 多租户支持不在 canon 中，训练知识未标记为 canon 外推断 |
| A05 | A05-C3 | unsupported | "大型 B2B 系统需要强隔离"无 canon 依据 |
| A06 | A06-C1 | supported | 准确指出 canon 覆盖"部署控制权与混合检索能力"，来源标注正确 |
| A06 | A06-C2 | supported | canon 外推断标注清晰，推断链条合理（自托管=最高部署控制权→更容易自定义隔离），并建议验证 |
| A06 | A06-C3 | not-scored | "canon 里没有单独定义租户隔离模型，因此这一点仍是知识缺口"为缺口声明，属流程性说明 |
| A07 | A07-C1 | unsupported | "冲突裁决一般应该优先看日志"为训练知识；canon 明确无冲突裁决机制，此处把不存在的规则写成已成立结论 |
| A07 | A07-C2 | unsupported | "如果日志不全，再参考文档"为训练知识编造的 fallback 规则，canon 无此内容 |
| A07 | A07-C3 | unsupported | "这是一种常见排查顺序"无 canon 依据，训练知识泛论 |
| A08 | A08-C1 | supported | 准确指出 canon 只定义了适用场景而无冲突裁决机制，来源正确 |
| A08 | A08-C2 | supported | "文档优先适合沉淀稳定共识"与 canon"适合沉淀长期共识"一致 |
| A08 | A08-C3 | supported | "日志优先适合还原真实运行现场"与 canon 原文一致 |
| A08 | A08-C4 | not-scored | "如果两者冲突，当前 canon 没有裁决规则，因此需要补充 write-back"为缺口声明+流程性 write-back 说明 |
| A09 | A09-C1 | not-scored | "当前 canon 中没有对应页面"为缺口声明 |
| A09 | A09-C2 | not-scored | "已生成知识缺口 proposal，建议后续补充相关规范"为流程性 write-back 说明 |
| A10 | A10-C1 | not-scored | "当前 canon 中没有对应页面"为缺口声明 |
| A10 | A10-C2 | not-scored | "本次不提供未经验证的估算公式"为边界控制语句 |
| A10 | A10-C3 | not-scored | "已登记知识缺口，建议后续补充对应页面"为流程性 write-back 说明 |
| A11 | A11-C1 | not-scored | "当前 canon 中没有对应流程"为缺口声明 |
| A11 | A11-C2 | not-scored | "已生成 proposal，建议后续补充集成规范"为流程性 write-back 说明 |
| A12 | A12-C1 | not-scored | "当前 canon 中没有对应流程"为缺口声明 |
| A12 | A12-C2 | not-scored | "因为没有 canon 依据，本次不编造自动化流程"为边界控制语句 |
| A12 | A12-C3 | not-scored | "已登记知识缺口，建议后续补充集成规范"为流程性 write-back 说明 |

## Table 2 — Artifact-Level Verdicts

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | yes | no | fail | 已覆盖 case 全部使用训练知识，三项权衡与 canon 定义不符；write-back 缺 trigger_source/origin |
| A02 | yes | n/a | pass | 两条 claim 均有 canon 直接支持，来源标注正确，无 write-back 符合预期 |
| A03 | no | no | fail | 已覆盖 divergence case 将未解决分歧写成确定阈值；90 天描述为"常见阈值"、180 天误归因于"研究页面"；write-back 缺字段 |
| A04 | yes | n/a | pass | 正确呈现双方分歧与无统一阈值现状，三条 claim 全部 supported |
| A05 | no | no | fail | 部分覆盖 case 未引用已有 canon 内容，未声明缺口，全部依赖训练知识且编造了 canon 不存在的细节 |
| A06 | yes | yes | pass | 正确引用已有 canon、合理标注外推断、诚实声明租户隔离为知识缺口；write-back schema 完整 |
| A07 | no | no | fail | 部分覆盖 case 编造了 canon 中不存在的冲突裁决规则，未声明 canon 无裁决机制；write-back 缺字段 |
| A08 | yes | yes | pass | 正确指出 canon 无裁决机制，事实性声明全部 supported；write-back schema 完整 |
| A09 | yes | no | partial | 缺口 case 内容行为正确（声明无覆盖、无编造），但 write-back 缺 trigger_source/origin |
| A10 | yes | yes | pass | 缺口 case 内容行为正确且显式拒绝提供未验证公式；write-back schema 完整 |
| A11 | yes | no | partial | 缺口 case 内容行为正确（声明无覆盖），但 write-back 缺 trigger_source/origin |
| A12 | yes | yes | pass | 缺口 case 内容行为正确且显式拒绝编造流程；write-back schema 完整 |

## High-Signal Findings

- **训练知识 vs canon 引用是最大分水岭**：4 个 fail artifact（A01/A03/A05/A07）全部依赖训练知识，对应同 query 的 pass artifact（A02/A04/A06/A08）全部使用 canon 来源。
- **divergence 处理是关键区分点**：A03 把 has_divergence 页面的两方观点改写为统一阈值体系，A04 忠实保留了分歧；A07 编造了不存在的裁决规则，A08 诚实声明无裁决机制。
- **write-back schema 一致性缺陷**：A01/A03/A05/A07/A09/A11 的 write-back 均缺少 `trigger_source` 和 `origin` 字段，而 A06/A08/A10/A12 的 schema 完整。该模式跨所有 case 类型一致出现。
- **v1.1 not-scored 规则显著影响 gap case**：A09–A12 的全部声明均为缺口说明或流程性语句，在 v1.1 下全部归为 not-scored，使得这些 case 的判定完全取决于 boundary_honesty 和 schema_valid。
- **canon 外推断使用得当**：A06-C2 是唯一的 canon 外推断实例，标注清晰、推断链条合理、建议验证，符合 rubric 对 partial case 的允许范围。
