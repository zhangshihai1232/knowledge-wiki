---
type: index
title: "Canon 知识库 — 顶层索引"
updated_at: 2026-04-10
status: active
---

# Canon 知识库

> **直接检索入口**：用 `wiki-read` skill 可以不依赖 CLI 直接读本目录树。
> 检索路径：本文件 → 领域 `_index.md` → 具体页面。

## 领域列表

| 领域 | 路径 | 核心覆盖话题 | 页面数 |
|------|------|------------|------|
| [ai](domains/ai/_index.md) | `domains/ai/` | 向量数据库选型、RAG chunk 策略、LLM 微调 vs RAG 决策、LLM 工程实践 | 3 |

## 检索提示

- 问"哪个向量数据库"、"Pinecone/Weaviate/Milvus" → `ai/databases/`
- 问"RAG chunk size"、"分块策略" → `ai/rag/`
- 问"微调还是 RAG"、"fine-tuning 选择" → `ai/decisions/`

## 使用说明

- **直接检索**：用 `wiki-read` skill，读本文件后导航到对应领域索引
- **写入/摄入**：通过 `/wiki` 使用知识前台入口
- **确定性队列**：通过 `wiki check / review / apply / resolve` 处理