---
type: index
domain: ai
title: "ai 领域索引"
updated_at: 2026-04-10
pages:
  - ai/databases/vector-db-comparison
  - ai/decisions/finetuning-vs-rag
  - ai/rag/chunk-size-strategy
status: active
---

# ai 领域

> 本领域覆盖 LLM 工程实践，包括向量数据库选型、RAG 检索策略、LLM 知识注入方式决策。
> 直接读某页面：`cat .wiki/canon/domains/ai/{category}/{slug}.md`

## 页面摘要（快速导航）

| 页面 | 路径 | 一行摘要 | 类型 | 置信度 |
|------|------|---------|------|------|
| [向量数据库选型对比](databases/vector-db-comparison.md) | `databases/vector-db-comparison` | Pinecone/Weaviate/Milvus 四维对比（延迟/成本/运维/功能），含选择建议 | comparison | low |
| [LLM 微调 vs RAG 决策框架](decisions/finetuning-vs-rag.md) | `decisions/finetuning-vs-rag` | 行为问题选 Fine-tuning，知识问题选 RAG，含简化决策树和成本对比 | decision | low |
| [RAG Chunk Size 选择策略](rag/chunk-size-strategy.md) | `rag/chunk-size-strategy` | 短文档用 512 tokens，长文档用 1024+20% overlap，含实验数据和延迟建议 | guide | low |

## 分类目录

### databases — 向量数据库
- [[vector-db-comparison]] — 向量数据库选型对比：Pinecone vs Weaviate vs Milvus

### decisions — 架构决策
- [[finetuning-vs-rag]] — LLM 微调 vs RAG 选择决策框架

### rag — 检索增强生成
- [[chunk-size-strategy]] — RAG Chunk Size 选择策略