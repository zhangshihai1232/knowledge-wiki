---
type: source
source_kind: conversation
title: "RAG 系统中 chunk size 最佳实践讨论"
url: ~
author: "工程师 Alice & Bob（内部 Slack 对话记录）"
published_at: 2026-04-05
ingested_at: 2026-04-08
domain: ai
tags:
  - rag
  - chunk-size
  - retrieval
  - embedding
  - context-window
extracted: true
authority: secondary
primary_type: source
subtype: meeting-note
---

## 原始内容

# RAG 系统 chunk size 最佳实践讨论

**日期**：2026-04-05
**参与者**：Alice（NLP 工程师）、Bob（基础设施工程师）
**背景**：团队在设计新的 RAG Pipeline，需要确定文档分块策略

---

**Alice**：我看了 LlamaIndex 和 LangChain 的默认配置，都是 512 tokens 作为 chunk size。我觉得 512 是个经过实践验证的黄金标准。原因有三：第一，大多数 embedding 模型（text-embedding-ada-002, BGE, E5 等）的训练数据以句子和短段落为主，512 tokens 覆盖 2-4 个段落，语义完整性最高；第二，检索时 precision 更好，不会引入无关信息；第三，我们内部跑了 A/B 测试，在我们的客服知识库场景（平均文档长度 2000 tokens）上，512 chunk 的 MRR@5 比 1024 chunk 高出约 8 个百分点（0.73 vs 0.67）。

**Bob**：我不同意 512 是最优解。你说的那个测试只针对了客服场景，但我们新系统要处理的是长篇技术文档（平均 8000-15000 tokens）。对于代码注释、API 文档这类内容，上下文连贯性至关重要。我的论点：1) GPT-4o 和 Claude 3 的上下文窗口已经到 128K+，LLM 端的 context 压力不再是瓶颈；2) 我上周用 BEIR benchmark 跑了测试，在 TechDocs 子集上，1024 chunk 的 NDCG@10 是 0.52，512 chunk 只有 0.44，差了 18%；3) 短 chunk 的碎片化问题很严重，一个完整的函数定义被切成两半，检索到的内容完全没法用。

**Alice**：你说的碎片化问题我承认存在，这是 512 的一个真实缺陷。但你的 BEIR 测试我有疑问——BEIR 数据集本身偏向较长的文档，1024 在那上面占优不代表普适。另外，即使 LLM 窗口够大，把大量冗余内容塞进 context 会降低 LLM 的有效注意力（diluted attention 问题，Anthropic 的研究有提到），召回率高但准确率会下降。我的建议是用 **sentence-window retrieval**：索引时以句子为单位，检索后自动扩展到前后各 2 个句子，这样 precision 和 recall 都能保住。

**Bob**：sentence-window 这个方法我研究过，LlamaIndex 有实现。但它实际上增加了系统复杂度——需要维护两套存储（sentence-level embeddings + paragraph-level raw text），延迟也增加了约 30-40ms（我们的 SLA 是 <100ms 端到端）。如果要在延迟约束下做选择，我会选择 1024 flat chunk + overlap 策略（overlap 设 20%，即约 200 tokens 重叠）。这个方案：overlap 解决了碎片化问题，1024 保证了语义完整性，实现简单，延迟可控。我们内部在法律文档场景测试的结果：1024+20% overlap 的 Recall@5 达到 0.81，比 512 no-overlap 的 0.74 高出约 9 个百分点。

**Alice**：overlap 方案的缺点是索引体积增大 15-20%，存储和查询成本都会上升。而且 200 tokens 的 overlap 实际上是冗余信息，理论上会引入 embedding 噪声。不过你的延迟约束是个合理的工程考量，我同意对于技术文档场景，1024+overlap 可能确实比 512 更合适。

**Bob**：所以结论是：**没有普适的最优 chunk size**。需要根据场景选择：客服/FAQ 类短文档用 512，技术文档/长文用 1024+overlap。建议我们在系统里支持可配置的 chunk size，按文档类型设置不同策略。

**Alice**：同意这个结论。另外补充一点：chunk size 的选择还需要与 embedding 模型的 max_tokens 对齐。比如 text-embedding-ada-002 的 max input tokens 是 8191，理论上支持很大的 chunk，但实际上超过 1024 tokens 后 embedding 质量会下降（模型训练时的 context 长度限制导致）。这个和模型相关，需要针对具体模型测试。

**Bob**：很好的补充。这意味着我们如果换 embedding 模型，chunk size 策略也需要重新评估。

---

## 提取声明

- Alice 的内部测试显示，在客服知识库场景（平均文档长度 2000 tokens），512 chunk 的 MRR@5（0.73）比 1024 chunk（0.67）高约 8 个百分点。（原文：Alice 第一段发言）
- Bob 在 BEIR benchmark 的 TechDocs 子集上测试，1024 chunk 的 NDCG@10（0.52）比 512 chunk（0.44）高约 18%；在法律文档场景，1024+20%overlap 的 Recall@5（0.81）比 512 no-overlap（0.74）高约 9 个百分点。（原文：Bob 第二、四段发言）
- ⚠️ 冲突观点：Alice 认为 512 tokens 是大多数场景的最优 chunk size，因其与 embedding 模型训练数据分布匹配、检索精度更高；Bob 认为对于长篇技术文档，1024 tokens + 20% overlap 更优，因其语义完整性更好、碎片化问题更少。两者均有实验数据支撑，但测试场景不同。（原文：全文对话）
- Alice 提出 sentence-window retrieval 作为替代方案：索引以句子为单位，检索后扩展前后各 2 句；Bob 指出该方案延迟增加约 30-40ms，且需维护两套存储，工程复杂度更高。（原文：Alice 第二、三段 / Bob 第三段）
- 双方最终达成共识：没有普适的最优 chunk size，应根据文档类型配置：客服/FAQ 短文档用 512，技术/长文用 1024+overlap。（原文：Bob 第四段 / Alice 第三段）
- text-embedding-ada-002 的 max input tokens 为 8191，但超过 1024 tokens 后 embedding 质量会下降（受模型训练 context 长度限制影响）。（原文：Alice 最后发言）
