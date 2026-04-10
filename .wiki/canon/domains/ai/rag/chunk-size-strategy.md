---
type: guide
title: "RAG Chunk Size 选择策略"
domain: ai
sources:
  - sources/conversations/2026-04-08-rag-chunk-size-best-practice-debate.md
confidence: low
last_compiled: 2026-04-08
last_updated: 2026-04-08
staleness_days: 0
cross_refs:
  - vector-db-comparison
  - finetuning-vs-rag
status: active
tags:
  - rag
  - chunk-size
  - retrieval
  - embedding
  - context-window
  - pipeline
primary_type: guide
subtype: workflow
---

## 前提条件

本指南适用于构建 RAG Pipeline 时的文档分块策略选择。选择 chunk size 前需明确：

- 文档类型（短文档 vs 长文档）
- 延迟 SLA 要求（是否有 <100ms 端到端约束）
- embedding 模型的 max_tokens 限制
- 系统复杂度容忍度（是否接受额外存储开销）

## 步骤

### 步骤一：判断文档类型

- **短文档**（平均长度 < 3000 tokens，如客服 FAQ、短篇新闻）→ 使用 **512 tokens flat chunk**
- **长文档**（平均长度 > 5000 tokens，如技术文档、法律文书、代码库）→ 使用 **1024 tokens + 20% overlap**

### 步骤二：场景化配置建议

> ⚠️ 数据分歧：关于短文档场景下 512 vs 1024 chunk size 存在来自不同测试集的实验数据分歧，两种配置均有支撑数据，建议在自身场景进行 A/B 测试。

**支持 512 chunk 的数据**：
- 内部测试（客服知识库，平均文档长度 2000 tokens）：512 chunk MRR@5=**0.73**，1024 chunk MRR@5=0.67，差距约 8 个百分点

**支持 1024 chunk 的数据**：
- BEIR TechDocs 子集：1024 chunk NDCG@10=**0.52**，512 chunk=0.44，差距约 18%
- 法律文档场景：1024+20%overlap Recall@5=**0.81**，512 no-overlap=0.74，差距约 9 个百分点

两组数据使用了不同的测试集和评估指标，不可直接对比，结论依赖于实际场景。

### 步骤三：高级方案评估

| 方案 | 优点 | 缺点 |
|------|------|------|
| **512 flat chunk** | 精度高，与大多数 embedding 模型训练数据分布匹配 | 长文档碎片化严重，一个完整函数定义可能被切断 |
| **1024 + 20% overlap** | 语义完整性好，碎片化问题少，实现简单 | 索引体积增大 15-20%，存储和查询成本上升 |
| **sentence-window retrieval** | 兼顾 precision 和 recall，最灵活 | 需维护两套存储（sentence-level + paragraph-level），延迟增加约 30-40ms |

### 步骤四：embedding 模型对齐检查

chunk size 必须与 embedding 模型的 max_tokens 对齐：

- **text-embedding-ada-002**：max input tokens 为 8191，但超过 1024 tokens 后 embedding 质量会下降（受模型训练 context 长度限制）
- 更换 embedding 模型时，必须重新评估 chunk size 策略

## 常见问题

**Q：LLM 上下文窗口已达 128K+，chunk size 还重要吗？**

仍然重要。chunk size 主要影响检索精度（retrieval precision/recall），不是 LLM 端的 context 容量问题。过大的 chunk 会引入冗余信息，导致 diluted attention；过小的 chunk 会造成语义碎片化，检索到不完整的内容。

**Q：overlap 会引入 embedding 噪声吗？**

理论上 overlap 区域是冗余信息，可能轻微影响 embedding 质量。但实践中（法律文档场景）采用 20% overlap 后 Recall@5 提升约 9 个百分点，工程效益大于理论副作用。

**Q：sentence-window 方案适合有严格延迟 SLA 的场景吗？**

不适合。该方案延迟增加约 30-40ms。若系统 SLA 要求端到端 <100ms，不建议使用 sentence-window，优先考虑 1024+overlap。

## 参考来源

- `sources/conversations/2026-04-08-rag-chunk-size-best-practice-debate.md`（内部工程师对话，authority: secondary，数据为内部 A/B 测试，非公开 benchmark）

> 注意：本页面的实验数字来自内部测试（非公开 benchmark），适用于特定场景，请在自身数据集上验证后使用。
