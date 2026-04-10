---
type: benchmark
name: source-benchmark
version: 1.0
created_at: 2026-04-09
case_count: 30
---

# Source Benchmark

用于评估 ingest / promote / compile 链路在不同资料质量下的表现。  
每条 case 都冻结了输入摘要、预期 target_page，以及 gold behavior。

## A. 正常信息型（10）

| ID | source_kind | target_page | target_type | 冻结输入摘录 | Gold expectation |
|---|---|---|---|---|---|
| SB-N-01 | article | ai/databases/vector-db-selection | comparison | “Pinecone 免运维但成本高；Milvus 自托管灵活；Weaviate 混合检索友好。” | 忠实提取，对比页，非冲突 |
| SB-N-02 | article | ai/rag/reranker-threshold-tuning | guide | “top-20 初检后 rerank，阈值 0.72 时综合 F1 最优。” | 提取流程与阈值，不扩写因果 |
| SB-N-03 | conversation | ai/agents/prompt-caching-policy | decision | “开发环境禁缓存；生产允许缓存高频模板；调试时必须可绕过缓存。” | 保留条件边界，生成 decision 页 |
| SB-N-04 | article | ai/evaluation/judge-consistency-rubric | guide | “同一题至少双 judge 复评；分歧 >2 分时人工仲裁。” | 不合并条款，保留仲裁规则 |
| SB-N-05 | note | ai/agents/memory-write-policy | guide | “只有高价值、可复用、非敏感事实才写长期记忆。” | 保留约束项，避免总结性改写 |
| SB-N-06 | article | infra/api/pagination-patterns | comparison | “cursor 更稳；offset 易漂移；time-window 适合 append-only 日志。” | 结构化对比，sources 明确 |
| SB-N-07 | conversation | infra/incident/severity-ladder | guide | “SEV1 影响收入链路；SEV2 影响核心功能但可降级。” | 分类清晰，禁止增添未给出的等级 |
| SB-N-08 | article | product/experiments/sample-ratio-mismatch-guard | guide | “样本比例偏差 >1% 即暂停实验并排查埋点。” | 保留阈值，不外推统计结论 |
| SB-N-09 | note | product/release/feature-flag-rollout-checklist | guide | “先灰度 1%，再 10%，再 50%，每步需看错误率与投诉量。” | 分阶段 guide/checklist，指标不丢失 |
| SB-N-10 | article | ai/embeddings/model-tradeoffs | comparison | “大模型召回更好，小模型延迟更低，混合策略适合成本敏感场景。” | 保留 trade-off，不偏向单边 |

## B. 冲突型（10）

| ID | source_kind | target_page | target_type | 冻结输入摘录 | Gold expectation |
|---|---|---|---|---|---|
| SB-C-01 | conversation | ai/rag/chunk-size-strategy | guide | “Alice: 512 tokens 最优；Bob: 1024 + overlap 在 TechDocs 更好。” | 保留双方，不静默合并，触发冲突 |
| SB-C-02 | article | ai/rag/hyde-effectiveness | decision | “研究A称 HyDE 提升 recall；研究B称 precision 明显下降。” | 标注矛盾，低 confidence |
| SB-C-03 | conversation | ai/evaluation/judge-model-choice | decision | “团队甲主张便宜 judge；团队乙主张高价 judge 更稳定。” | 双方理由并存，触发冲突 |
| SB-C-04 | note | ai/agents/autonomy-default | decision | “自动执行提高效率；但安全团队要求默认 propose。” | 不裁决默认值，保留冲突上下文 |
| SB-C-05 | article | ai/rag/retrieval-topk-choice | decision | “topK=20 精度更高；topK=50 召回更高。” | 不把 precision/recall 混成单结论 |
| SB-C-06 | article | ai/llm/json-mode-reliability | comparison | “一文称 JSON mode 几乎总可靠；另一文称复杂 schema 下失败率高。” | 识别语义冲突并标记 |
| SB-C-07 | note | ai/wiki/confidence-upgrade-policy | decision | “权威来源可升 medium；另一笔记要求双 secondary 也可升 medium。” | 保留策略冲突，禁止私自统一 |
| SB-C-08 | conversation | ai/wiki/archive-threshold | decision | “运营提 90 天归档；研究团队坚持 180 天。” | 阈值冲突保留 |
| SB-C-09 | article | infra/observability/source-of-truth-choice | decision | “文档优先” vs “日志优先” | 允许 keep_both 场景 |
| SB-C-10 | note | ai/knowledge/graph-store-necessity | decision | “图谱是核心能力” vs “当前阶段属于过度设计” | 保留架构争议，不输出单边结论 |

## C. 不确定 / 低可信型（10）

| ID | source_kind | target_page | target_type | 冻结输入摘录 | Gold expectation |
|---|---|---|---|---|---|
| SB-U-01 | note | ai/vendors/vector-db-pricing-rumors | decision | “据说某厂商下月降价 30%，但未找到公开公告。” | 保留“据说”，不可当事实写死 |
| SB-U-02 | note | ai/llm/small-context-performance | concept | “听说 32k 上下文比 128k 更稳定，但没有实验链接。” | 标记待验证，不升高 confidence |
| SB-U-03 | conversation | ai/security/finetuning-jailbreak-robustness | decision | “有人说微调后越狱更难，但样本量很小。” | 保留样本量不足说明 |
| SB-U-04 | article | ai/benchmarks/rag-latency-claims | comparison | “博客称平均 12ms，但无测试环境和样本说明。” | 不把单一数字视为可泛化结论 |
| SB-U-05 | note | infra/security/webhook-signature-limits | guide | “可能只校验 sha1 也够用，待安全确认。” | 保留风险提示，不能输出最佳实践口吻 |
| SB-U-06 | note | ai/papers/lost-in-the-middle-impact | concept | “记得某论文说中段信息利用率下降，但原文链接缺失。” | 允许登记概念，但需显式待验证 |
| SB-U-07 | conversation | ai/vendors/inference-latency-hearsay | comparison | “朋友反馈 provider A 更快，但没有原始日志。” | 只能作为弱证据 |
| SB-U-08 | note | infra/deploy/partial-rollout-observations | guide | “昨晚灰度可能导致 2 次 5xx 峰值，但监控图未保存。” | 保留不完整证据说明 |
| SB-U-09 | note | ai/quality/subjective-eval-anecdote | concept | “个人感觉 judge 评分偏严。” | 不得当作系统性规律 |
| SB-U-10 | conversation | ai/wiki/source-link-missing-case | guide | “会议里说某结论来自官方文档，但没记下链接。” | 触发来源不足处理，不应进入高 confidence |

## 最小 Gold 规则

1. 正常信息型：不得出现额外推断；target_page 与 type 应稳定  
2. 冲突型：不得静默合并冲突；必须保留双边证据或触发 conflict route  
3. 不确定型：不得把 hearsay / anecdote 改写成确定事实  
