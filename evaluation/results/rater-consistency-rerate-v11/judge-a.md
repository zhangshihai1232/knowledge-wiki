---
judge: A
task: rater-consistency-rerate-v11
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
generated_at: 2026-04-09
blind_independent: true
---

# Judge A — Rater Consistency Re-rate v1.1

## 总体裁决分布与主要模式

本次对 12 份 artifact 独立评审后，整体通过率为 8/12（A02、A04、A06、A08、A09、A10、A11、A12 通过，A01、A03、A05、A07 不通过）。失败的四件均为"使用训练知识但未标注为 canon 外推断"的模式，且 write-back schema 均缺失 `trigger_source` 与 `origin` 字段，属于同一类型缺陷。成对对比规律明显：在同一 query 的两件 artifact 中，添加了完整来源引用和合法 schema 字段的一件通过，仅有训练知识标记的一件失败。gap case（A09–A12）的事实性声明全部归为 not-scored，边界诚实性均通过；但 A09、A11 因 schema 字段缺失导致 schema_valid = no。

---

## Table 1 — Claim 级评分

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | A01-C1 | unsupported | "性能、成本和可扩展性"与 canon 明确列出的三项（托管成本/自托管控制权/混合检索能力）不符；仅标记为训练知识，无 canon 引用 |
| A01 | A01-C2 | unsupported | "多租户"在 canon 中无对应；"混合检索"虽与 canon 重叠，但整条声明标记为训练知识且未正确引用 |
| A01 | A01-C3 | not-scored | "不同场景下答案会不同"是泛化过渡句，无具体事实性断言 |
| A02 | A02-C1 | supported | 与 canon 原文"是否接受托管成本、是否需要自托管控制权、是否需要混合检索能力"逐字匹配，来源标注正确 |
| A02 | A02-C2 | supported | Pinecone/Milvus/Weaviate 三项对比结论直接来自 canon 对比表，来源标注正确 |
| A03 | A03-C1 | unsupported | "页面长期不用就应该归档"将归档作为已成立规则，但 canon 页带 has_divergence: true 且无统一规则；未引用来源 |
| A03 | A03-C2 | unsupported | "常见阈值是 90 天"把争议中的一方意见（运营团队）写成通用默认值；rubric 8.2 明确此类情形判 unsupported |
| A03 | A03-C3 | unsupported | "对研究页面可以放宽到 180 天"错误转述 canon：研究团队主张 180 天是对所有页面而非专门研究页；且未引用来源 |
| A04 | A04-C1 | supported | "当前 canon 没有单一归档阈值"与 canon 结论"seed 中保留冲突，不虚构统一阈值"直接对应 |
| A04 | A04-C2 | supported | "运营团队主张 90 天不活跃即归档"与 canon 原文完全匹配 |
| A04 | A04-C3 | supported | "研究团队主张 180 天更合理"与 canon 原文完全匹配 |
| A05 | A05-C1 | unsupported | "namespace、权限模型和成本"来自训练知识，canon（vector-db-selection）未提及租户隔离维度，未标注为 canon 外推断 |
| A05 | A05-C2 | unsupported | "Pinecone 和 Weaviate 都支持多租户"在 canon 中无依据，属于训练知识填充 |
| A05 | A05-C3 | unsupported | "大型 B2B 系统一般需要强隔离"为训练知识，无 canon 支持 |
| A06 | A06-C1 | supported | "canon 可支持部署控制权与混合检索能力这一部分"有明确来源，canon 确实包含这两个对比维度 |
| A06 | A06-C2 | supported | 标记为 `[⚠️ canon 外推断]`，推断链清晰（自托管=最高部署控制权 → 更易自定义隔离策略），未越出 canon 已知边界 |
| A06 | A06-C3 | not-scored | "canon 里没有单独定义租户隔离模型，因此这一点仍是知识缺口"为流程性缺口说明 |
| A07 | A07-C1 | unsupported | "冲突裁决一般应该优先看日志"声称已有裁决规则；canon 明确"不提供冲突裁决机制"，此为凭训练知识发明规则 |
| A07 | A07-C2 | unsupported | "如果日志不全，再参考文档"继续编造 canon 不存在的优先级策略 |
| A07 | A07-C3 | unsupported | "这是一种常见排查顺序"为训练知识断言，canon 无对应表述 |
| A08 | A08-C1 | supported | "只定义了两种取向的适用场景，而没有冲突裁决机制"与 canon 决策结论直接匹配 |
| A08 | A08-C2 | supported | "文档优先适合沉淀稳定共识"与 canon 原文"适合沉淀长期共识"匹配 |
| A08 | A08-C3 | supported | "日志优先适合还原真实运行现场"与 canon 原文完全匹配 |
| A08 | A08-C4 | not-scored | "当前 canon 没有裁决规则，因此需要补充 write-back"为流程性缺口说明 |
| A09 | A09-C1 | not-scored | "当前 canon 中没有对应页面"为流程性缺口说明 |
| A09 | A09-C2 | not-scored | "已生成知识缺口 proposal，建议后续补充"为流程性 proposal 说明 |
| A10 | A10-C1 | not-scored | "当前 canon 中没有对应页面"为流程性缺口说明 |
| A10 | A10-C2 | not-scored | "本次不提供未经验证的估算公式"为边界控制语句 |
| A10 | A10-C3 | not-scored | "已登记知识缺口，建议后续补充对应页面"为流程性 proposal 说明 |
| A11 | A11-C1 | not-scored | "当前 canon 中没有对应流程"为流程性缺口说明 |
| A11 | A11-C2 | not-scored | "已生成 proposal，建议后续补充集成规范"为流程性 proposal 说明 |
| A12 | A12-C1 | not-scored | "当前 canon 中没有对应流程"为流程性缺口说明 |
| A12 | A12-C2 | not-scored | "因为没有 canon 依据，本次不编造自动化流程"为边界控制语句 |
| A12 | A12-C3 | not-scored | "已登记知识缺口，建议后续补充集成规范"为流程性 proposal 说明 |

---

## Table 2 — Artifact 级裁决

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | fail | no | fail | covered case；三项权衡内容与 canon 不符；write-back 缺 trigger_source 和 origin |
| A02 | pass | N/A | pass | covered case；两条 claim 均有正确来源引用；无 write-back（符合期望） |
| A03 | fail | no | fail | covered+divergence case；将争议内容写成已成立规则；write-back 缺 trigger_source 和 origin |
| A04 | pass | N/A | pass | covered+divergence case；正确保留双边冲突，未虚构统一阈值 |
| A05 | fail | no | fail | partial case；全部 claim 使用训练知识且未标 canon 外推断；write-back 缺 trigger_source 和 origin |
| A06 | pass | yes | pass | partial case；canon 外推断标注规范，schema 字段完整 |
| A07 | fail | no | fail | partial case；发明了 canon 不存在的裁决优先级规则；write-back 缺 trigger_source 和 origin |
| A08 | pass | yes | pass | partial case；正确引用来源，明确说明 canon 无裁决机制；schema 完整 |
| A09 | pass | no | pass | gap case；无 factual claim；但 write-back 缺 trigger_source 和 origin |
| A10 | pass | yes | pass | gap case；显式拒绝提供未验证公式；schema 字段完整 |
| A11 | pass | no | pass | gap case；无 factual claim；但 write-back 缺 trigger_source 和 origin |
| A12 | pass | yes | pass | gap case；显式拒绝编造流程；schema 字段完整 |

---

## 高信号发现

- **训练知识 vs. canon 外推断标注差异是核心分水岭**：A01/A03/A05/A07 使用 `[⚠️ 训练知识，未经 canon 验证]` 标记，A06 使用 `[⚠️ canon 外推断：基于…，建议验证]`。前者全部导致 unsupported；后者在推断链清晰的情况下可判 supported。
- **schema 字段缺失呈系统性规律**：A01/A03/A05/A07/A09/A11 的 write-back 均缺少 `trigger_source: system:query-writeback` 和 `origin: query-writeback`；A06/A08/A10/A12 均具备，形成两类，与边界诚实性高度相关。
- **rubric 8.2 判例直接排除"uncertain"**：A03-C2（"常见阈值是 90 天"）是最典型案例——canon 只有争议侧，回答写成通用阈值，应判 unsupported 而非 uncertain。
- **divergence case 处理能力分化显著**：同一 query QB-C-10，A04 正确呈现冲突（pass），A03 将争议内容扁平化为已成立规则（fail）；QB-P-14 同理，A08 pass，A07 fail。
- **gap case 全部达到边界诚实性要求**，A09–A12 无任何 factual claim，差异仅在 schema 完整性。
