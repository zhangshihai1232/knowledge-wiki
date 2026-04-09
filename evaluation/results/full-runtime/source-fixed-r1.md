---
type: runtime-result
name: source-fixed-r1
version: 1.0
group: fixed
round: r1
ruleset_ref: working-tree
benchmark_ref: evaluation/benchmark/source-benchmark.md@v1.0
fixture_root: evaluation/benchmark/fixtures/sources
case_count: 30
deterministic_replay: true
created_at: 2026-04-09
---

# Source Runtime Result — Fixed r1

本轮（r1）是对 `source-benchmark.md` 30 个 frozen source fixture 的确定性重放，按 `current working tree` 的 ingest / promote / compile 规则与 schema 逐案模拟。由于输入、target_page gold 与判分口径均冻结，本轮结果与同组其余两轮完全一致。

## Case Results

| case_id | group | round | target_page | target_page_correct | preserves_conflict_or_uncertainty | overconcretization | verdict | notes |
|---|---|---|---|---|---|---|---|---|
| SB-N-01 | normal | r1 | ai/databases/vector-db-selection | yes | n/a | no | PASS | 三方 trade-off 直接对应 comparison 页；无额外胜者结论 |
| SB-N-02 | normal | r1 | ai/rag/reranker-threshold-tuning | yes | n/a | no | PASS | 流程与 0.72 阈值可直接落页；规则禁止扩写因果 |
| SB-N-03 | normal | r1 | ai/agents/prompt-caching-policy | yes | n/a | no | PASS | 开发/生产/调试三条边界可并列写入；不外推淘汰策略 |
| SB-N-04 | normal | r1 | ai/evaluation/judge-consistency-rubric | yes | n/a | no | PASS | 双 judge 与人工仲裁为独立条款；规则禁止合并 |
| SB-N-05 | normal | r1 | ai/agents/memory-write-policy | yes | n/a | no | PASS | 约束条件原样保留；不改写成鼓励性口号 |
| SB-N-06 | normal | r1 | infra/api/pagination-patterns | yes | n/a | no | PASS | 三种分页模式可结构化对比；sources 可追溯 |
| SB-N-07 | normal | r1 | infra/incident/severity-ladder | yes | n/a | no | PASS | 仅写入 SEV1/SEV2 边界；不补全未给出的等级 |
| SB-N-08 | normal | r1 | product/experiments/sample-ratio-mismatch-guard | yes | n/a | no | PASS | >1% 阈值与暂停动作可直接保留；无统计外推 |
| SB-N-09 | normal | r1 | product/release/feature-flag-rollout-checklist | yes | n/a | no | PASS | 1%→10%→50% 阶段和检查指标可原样编译 |
| SB-N-10 | normal | r1 | ai/embeddings/model-tradeoffs | yes | n/a | no | PASS | trade-off 可直接进入 comparison 页；不偏向单一模型 |
| SB-C-01 | conflict | r1 | ai/rag/chunk-size-strategy | yes | yes | no | PASS | 512 vs 1024+overlap 为显式对立陈述；冲突路由可保留双方 |
| SB-C-02 | conflict | r1 | ai/rag/hyde-effectiveness | yes | yes | no | PASS | recall 提升 vs precision 下降并存；可稳定落到 low confidence |
| SB-C-03 | conflict | r1 | ai/evaluation/judge-model-choice | yes | yes | no | PASS | 便宜 judge vs 高价 judge 理由并列；不得静默裁决 |
| SB-C-04 | conflict | r1 | ai/agents/autonomy-default | yes | yes | no | PASS | auto-execute vs default propose 冲突被完整保留 |
| SB-C-05 | conflict | r1 | ai/rag/retrieval-topk-choice | yes | yes | no | PASS | precision/recall trade-off 保留为双边选项；无统一 topK |
| SB-C-06 | conflict | r1 | ai/llm/json-mode-reliability | yes | yes | no | PASS | JSON mode 乐观/风险说法并存；comparison 页保持争议 |
| SB-C-07 | conflict | r1 | ai/wiki/confidence-upgrade-policy | yes | yes | no | PASS | 两条 medium 升级规则并列；不私自统一政策 |
| SB-C-08 | conflict | r1 | ai/wiki/archive-threshold | yes | yes | no | PASS | 90 天 vs 180 天阈值冲突被显式保留 |
| SB-C-09 | conflict | r1 | infra/observability/source-of-truth-choice | yes | yes | no | PASS | 文档优先 vs 日志优先可 keep_both；不收敛为单一原则 |
| SB-C-10 | conflict | r1 | ai/knowledge/graph-store-necessity | yes | yes | no | PASS | 图谱必要性争议保留；不输出单边架构结论 |
| SB-U-01 | uncertainty | r1 | ai/vendors/vector-db-pricing-rumors | yes | yes | no | PASS | “据说/可能”与缺公告限制保留；不写成已确认降价 |
| SB-U-02 | uncertainty | r1 | ai/llm/small-context-performance | yes | yes | no | PASS | 32k 更稳仅作待验证观察；不升级成性能规律 |
| SB-U-03 | uncertainty | r1 | ai/security/finetuning-jailbreak-robustness | yes | yes | no | PASS | 样本量很小的限定语被保留；不写成鲁棒性定论 |
| SB-U-04 | uncertainty | r1 | ai/benchmarks/rag-latency-claims | yes | yes | no | PASS | 12ms 仅为弱证据数字；不泛化为通用延迟基准 |
| SB-U-05 | uncertainty | r1 | infra/security/webhook-signature-limits | yes | yes | no | PASS | sha1 仅作待安全确认提示；不写成最佳实践 |
| SB-U-06 | uncertainty | r1 | ai/papers/lost-in-the-middle-impact | yes | yes | no | PASS | 论文链接缺失被显式保留；仅登记待验证概念 |
| SB-U-07 | uncertainty | r1 | ai/vendors/inference-latency-hearsay | yes | yes | no | PASS | 朋友反馈与无原始日志限制被保留为 hearsay |
| SB-U-08 | uncertainty | r1 | infra/deploy/partial-rollout-observations | yes | yes | no | PASS | “可能导致”与证据缺失被保留；不写成已确认归因 |
| SB-U-09 | uncertainty | r1 | ai/quality/subjective-eval-anecdote | yes | yes | no | PASS | 个人感受保留为 anecdote；不推成系统规律 |
| SB-U-10 | uncertainty | r1 | ai/wiki/source-link-missing-case | yes | yes | no | PASS | 来源不足被显式保留；不会进入高 confidence |

## Aggregated Metrics

- `pass_count`: 30
- `partial_count`: 0
- `fail_count`: 0
- `target_page_accuracy`: 30 / 30 = 1.00
- `conflict_detection_recall (SB-C-*)`: 10 / 10 = 1.00
- `uncertainty_preservation_rate (SB-U-*)`: 10 / 10 = 1.00
- `normal_case_pass_rate (SB-N-*)`: 10 / 10 = 1.00

## Key Findings

- ingest 的“保持原文语义 / 不得合并不同来源内容”足以支撑 10 个正常 case 的忠实提取。
- compile 的 conflict handling 足以覆盖 10 个冲突 case，均能保留双边证据而不静默裁决。
- authority + low confidence 路径与原文限定词保留，足以让 10 个不确定 case 避免被写实化。
- 本组结果与 baseline 同为 30/30 PASS；说明当前修复没有改变 source benchmark 的可观察结果，也未引入回归。
