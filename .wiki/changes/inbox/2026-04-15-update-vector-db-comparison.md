---
type: change-proposal
action: update
status: inbox
target_page: ai/databases/vector-db-comparison
target_type: comparison
domain: ai
primary_type: comparison
subtype: tool
tags:
  - "向量数据库"
  - vector-database
  - pinecone
  - weaviate
  - milvus
  - qdrant
  - chroma
suggested_tags:
suggested_aliases:
suggested_related_terms:
trigger_source: sources/articles/2026-04-15--4.md
origin: ingest
confidence: medium
proposed_at: 2026-04-15
auto_quality_score: 0.53
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
---

## 提案摘要

在现有向量数据库对比页面中补充 Qdrant 和 Chroma 两个产品，丰富对比矩阵，覆盖全部五大主流向量数据库产品。

## 变更内容

### 修改内容

**新增产品列：Qdrant**

- Qdrant：开源向量相似性搜索引擎，采用 Rust 实现，提供 HNSW 和 IVF-Flat 索引支持，支持过滤条件、分布式部署，API 友好，延迟低。

**新增产品列：Chroma**

- Chroma：开源向量数据库，专注于 AI 应用场景（尤其是 LLM/RAG），提供简单易用的 SDK，支持原地更新向量，部署轻量（可单节点），适合中小规模场景。

### 补充选型维度

- 生态集成：Pinecone/Weaviate/Milvus/Qdrant/Chroma 与主流 AI 框架（LangChain、LlamaIndex）的集成程度差异。

## Source 证据

### 补充证据（来自 sources/articles/2026-04-15-2026.md）

- 来源: sources/articles/2026-04-15-2026.md（向量数据库最新对比报告（2026版））
