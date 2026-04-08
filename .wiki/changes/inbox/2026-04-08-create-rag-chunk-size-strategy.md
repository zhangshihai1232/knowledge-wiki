---
type: change-proposal
action: create
status: inbox
target_page: "ai/rag/chunk-size-strategy"
target_type: guide
trigger_source: "sources/conversations/2026-04-08-rag-chunk-size-best-practice-debate.md"
confidence: medium
proposed_at: "2026-04-08"
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
auto_quality_score: 0.80
conflict_location: ~
---

## 提案摘要

新建 RAG chunk size 策略 canon 页，收录不同文档类型下的分块策略选择指南，包含实验数据支撑的场景化建议，并如实标注两种主要观点之间的分歧。

## 变更内容

### 新增内容

**前提条件**

本指南适用于构建 RAG Pipeline 时的文档分块策略选择。选择 chunk size 前需明确：文档类型（短文档 vs 长文档）、延迟 SLA 要求、embedding 模型的 max_tokens 限制、系统复杂度容忍度。

**步骤**

**步骤一：判断文档类型**

- 短文档（平均长度 < 3000 tokens，如客服 FAQ、短篇新闻）→ 使用 512 tokens flat chunk
- 长文档（平均长度 > 5000 tokens，如技术文档、法律文书、代码库）→ 使用 1024 tokens + 20% overlap

**步骤二：场景化配置建议**

> ⚠️ 冲突：关于短文档场景下 512 vs 1024 chunk size 存在实验数据分歧

- 内部测试（客服知识库，平均 2000 tokens 文档）：512 chunk 的 MRR@5（0.73）比 1024 chunk（0.67）高 8 个百分点
- BEIR TechDocs 子集测试：1024 chunk 的 NDCG@10（0.52）比 512 chunk（0.44）高 18%
- 法律文档场景测试：1024+20%overlap 的 Recall@5（0.81）比 512 no-overlap（0.74）高 9 个百分点

两方均有实验数据，但测试数据集和评估指标不同，建议在自身场景上进行 A/B 测试后决定。

**步骤三：高级方案评估**

- **sentence-window retrieval**（LlamaIndex 有实现）：索引以句子为单位，检索后扩展前后各 2 句。优点：兼顾 precision 和 recall；缺点：需维护两套存储，延迟增加约 30-40ms
- **1024 + 20% overlap**：overlap 解决碎片化问题，语义完整性好，实现简单；缺点：索引体积增大 15-20%，存储和查询成本上升

**步骤四：embedding 模型对齐检查**

chunk size 必须与 embedding 模型的 max_tokens 对齐。以 text-embedding-ada-002 为例：max input tokens 为 8191，但超过 1024 tokens 后 embedding 质量会下降（受模型训练 context 长度限制）。更换 embedding 模型时需重新评估 chunk size 策略。

**常见问题**

Q：LLM 上下文窗口已达 128K+，chunk size 还重要吗？
A：仍然重要。chunk size 主要影响检索精度（retrieval precision/recall），不是 LLM 端的 context 容量问题。过大的 chunk 会引入冗余信息，导致 diluted attention；过小的 chunk 会造成语义碎片化。

Q：overlap 会引入 embedding 噪声吗？
A：理论上 overlap 区域是冗余信息，可能轻微影响 embedding 质量，但实践中（法律文档场景）采用 20% overlap 后 Recall@5 提升约 9 个百分点，效益大于副作用。

### 修改内容

无（新建页面）

### 删除内容

无

## Source 证据

- Alice（内部测试，客服知识库 2000 tokens）：512 chunk MRR@5=0.73，1024 chunk MRR@5=0.67，差距约 8 个百分点。（来源：Alice 第一段发言）
- Bob（BEIR TechDocs 子集）：1024 chunk NDCG@10=0.52，512 chunk=0.44，差距约 18%。（来源：Bob 第二段发言）
- Bob（法律文档场景）：1024+20%overlap Recall@5=0.81，512 no-overlap=0.74，差距约 9 个百分点。（来源：Bob 第四段发言）
- sentence-window 方案延迟增加约 30-40ms，需维护两套存储（Alice 第三段 / Bob 第三段发言）
- text-embedding-ada-002 超过 1024 tokens 后 embedding 质量下降（来源：Alice 最后发言）
- 双方共识：无普适最优 chunk size，应按文档类型配置（来源：Bob 第四段 / 对话结尾）

## AI 建议

建议将此页面放置于 `ai/rag/` 分类下，类型为 `guide`。

对话中存在两人的真实实验数据分歧，但已在正文中标注为冲突并保留双方数据，建议人工审查时确认冲突标注准确。

本资料来自内部工程师对话，authority 为 secondary，数据为内部 A/B 测试结果而非公开 benchmark，confidence 评估为 medium 但建议谨慎引用具体数字。
