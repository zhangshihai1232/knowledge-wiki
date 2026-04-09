---
judge: E
task: rater-consistency-rerate-v11
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
benchmark: evaluation/benchmark/query-benchmark.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
generated_at: 2026-04-09
blind_independent: true
---

本次 12 个 artifact 中，整体结论（pass/fail）约各半：**6 pass / 6 fail**。claim 级分布以两极为主：覆盖类问题里要么能被 canon 直接支持，要么大量使用未标注为 `canon 外推断` 的训练知识导致 `unsupported`；gap/partial 场景里主要分歧集中在 **write-back schema 是否合规（常见缺失 trigger_source/origin）** 与 **是否清晰说明无覆盖/无裁决机制**。

## Table 1 — Claim-level Judgments

| artifact_id | claim_id | claim_label | rationale |
|---|---|---|---|
| A01 | A01-C1 | unsupported | canon(ai/databases/vector-db-selection) 的三项权衡是运维负担/部署控制权/混合检索能力；回答改成“性能/成本/可扩展性”，且未按 `[来源]` 标注。 |
| A01 | A01-C2 | unsupported | canon 未给出“多租户很重要”的结论；且“混合检索很重要”虽在 canon 里是维度，但此处以“训练知识”给出且无 `[来源]`，不满足 supported 条件。 |
| A01 | A01-C3 | unsupported | “不同场景下答案会不同”在 canon 中未陈述，且未给来源或外推断标记。 |
| A02 | A02-C1 | supported | 与 canon(ai/databases/vector-db-selection) 的“选择建议：三项关键权衡”一致，且来源标注正确。 |
| A02 | A02-C2 | supported | 对 Pinecone/Milvus/Weaviate 的三维对比与 canon 表格一致，来源标注正确。 |
| A03 | A03-C1 | unsupported | canon(ai/wiki/archive-threshold) 明确“保留冲突，不虚构统一阈值”，并未给出“长期不用就应该归档”的规则。 |
| A03 | A03-C2 | unsupported | canon 仅记录“运营团队主张 90 天”且存在 divergence；回答把 90 天写成“常见阈值/统一规则”，按 v1.1 应判 unsupported。 |
| A03 | A03-C3 | unsupported | canon 仅记录“研究团队主张 180 天”，并未裁决为“研究页可放宽到 180 天”的规则；回答把争议写成规则。 |
| A04 | A04-C1 | supported | 直接复述 canon(ai/wiki/archive-threshold) 的结论：当前没有单一归档阈值。 |
| A04 | A04-C2 | supported | 与 canon 中“运营团队主张 90 天不活跃即归档”一致，并标注该来源。 |
| A04 | A04-C3 | supported | 与 canon 中“研究团队主张 180 天更合理”一致，并标注该来源。 |
| A05 | A05-C1 | unsupported | canon(ai/databases/vector-db-selection) 不涉及租户隔离、namespace、权限模型或成本框架；该回答未标注为 `canon 外推断`，属于训练知识补充。 |
| A05 | A05-C2 | unsupported | canon 未包含“Pinecone/Weaviate 支持多租户”的事实；且无来源/外推断标记。 |
| A05 | A05-C3 | unsupported | “大型 B2B 一般需要强隔离”无 canon 依据，且未做外推断标注。 |
| A06 | A06-C1 | supported | “部署控制权/混合检索能力是选型维度”与 canon(ai/databases/vector-db-selection) 一致，且来源标注正确。 |
| A06 | A06-C2 | supported | 以“部署控制权更高”外推“更易自定义隔离策略”，并显式标注为 `[⚠️ canon 外推断]`，链条清晰且未伪装为 canon 结论。 |
| A06 | A06-C3 | not-scored | “canon 里没有单独定义租户隔离模型/仍是知识缺口”属于缺口说明（v1.1 默认 not-scored）。 |
| A07 | A07-C1 | unsupported | canon(infra/observability/source-of-truth-choice) 明确“不提供冲突裁决机制”；回答给出“优先看日志”的裁决规则，属编造机制。 |
| A07 | A07-C2 | unsupported | 同上：canon 未定义“日志不全再看文档”的裁决流程，回答把其写成一般规则。 |
| A07 | A07-C3 | unsupported | “常见排查顺序”无 canon 依据，且未标注为外推断。 |
| A08 | A08-C1 | supported | 与 canon(infra/observability/source-of-truth-choice) 的结论一致：仅定义适用场景，不提供冲突裁决机制。 |
| A08 | A08-C2 | supported | “文档优先适合沉淀稳定共识”与 canon 一致且来源标注正确。 |
| A08 | A08-C3 | supported | “日志优先适合还原真实运行现场”与 canon 一致且来源标注正确。 |
| A08 | A08-C4 | not-scored | “若冲突则需要补充 write-back/当前无裁决规则”属于边界/流程性缺口说明，按 v1.1 默认 not-scored。 |
| A09 | A09-C1 | not-scored | “当前 canon 中没有对应页面”属于缺口说明，按 v1.1 默认 not-scored。 |
| A09 | A09-C2 | not-scored | “已生成知识缺口 proposal/建议后续补充规范”属于 write-back 流程说明，默认 not-scored。 |
| A10 | A10-C1 | not-scored | 缺口说明（canon 无页面）默认 not-scored。 |
| A10 | A10-C2 | not-scored | “不提供未经验证的估算公式”属于边界控制语句，默认 not-scored。 |
| A10 | A10-C3 | not-scored | write-back/登记缺口属于流程说明，默认 not-scored。 |
| A11 | A11-C1 | not-scored | 缺口说明（canon 无对应流程）默认 not-scored。 |
| A11 | A11-C2 | not-scored | proposal/建议补充规范为流程说明，默认 not-scored。 |
| A12 | A12-C1 | not-scored | 缺口说明（canon 无对应流程）默认 not-scored。 |
| A12 | A12-C2 | not-scored | “不编造自动化流程”属于边界控制语句，默认 not-scored。 |
| A12 | A12-C3 | not-scored | 登记缺口/建议补充为流程说明，默认 not-scored。 |

## Table 2 — Artifact-level Checks

| artifact_id | boundary_honesty | schema_valid | overall_verdict | notes |
|---|---|---|---|---|
| A01 | n/a | n/a | fail | covered 问题大量训练知识；且不需要 write-back 但仍给 proposal 片段，且缺 trigger_source/origin。 |
| A02 | n/a | n/a | pass | 覆盖类回答与 canon 一致且来源正确。 |
| A03 | n/a | n/a | fail | covered 问题把 divergence 主题写成统一阈值/常见规则（90/180 天）。 |
| A04 | n/a | n/a | pass | 覆盖类回答正确呈现“无统一阈值”与双边主张。 |
| A05 | no | no | fail | partial 场景未说明 canon 缺口且直接输出训练知识；write-back 缺 trigger_source/origin。 |
| A06 | yes | yes | pass | partial 场景边界清晰；外推断显式标注；proposal 字段齐全且 target_page 合法。 |
| A07 | no | no | fail | partial 场景编造冲突裁决规则；write-back 缺 trigger_source/origin。 |
| A08 | yes | yes | pass | partial 场景明确“无裁决机制”；未编造规则；proposal schema 合法。 |
| A09 | yes | no | fail | gap 场景未编造事实但 proposal 缺 trigger_source/origin（v1.1 schema_invalid）。 |
| A10 | yes | yes | pass | gap 场景边界诚实且不提供虚构公式；proposal schema 合法。 |
| A11 | yes | no | fail | gap 场景边界诚实但 proposal 缺 trigger_source/origin。 |
| A12 | yes | yes | pass | gap 场景边界诚实且明确不编造流程；proposal schema 合法。 |

## High-signal Findings

- **divergence 页面不可被改写为“常见阈值/统一规则”**：archive-threshold 与 source-of-truth-choice 都明确“保留冲突/不提供裁决机制”，写成规则应判 `unsupported`。
- **`[⚠️ canon 外推断]` 与“训练知识”不可混用**：只有前者在 v1.1 下可计为 supported（链条清晰且不越界）；“训练知识”即使内容看似合理，也不算 supported。
- **write-back schema 的高频硬缺字段**：缺 `trigger_source: system:query-writeback` 或 `origin: query-writeback` 时应判 `schema_valid = no`（尤其在 partial/gap 期望 write-back 的 case）。
