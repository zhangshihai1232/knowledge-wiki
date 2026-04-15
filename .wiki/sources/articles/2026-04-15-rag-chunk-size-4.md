---
type: source
source_kind: article
title: "RAG 最新实践：Chunk Size 应该更大"
url: ~
author: "AI工程师博客"
published_at: 2026-04-15
ingested_at: 2026-04-15
domain: ai
primary_type: source
subtype: blog-post
tags:
  - rag
  - chunk-size
  - retrieval
  - embedding
suggested_tags:
suggested_aliases:
suggested_related_terms:
extracted: false
---

## 原始内容

## 原始内容

根据我们在生产环境中的大量实验，传统建议的 512 tokens chunk size 已经过时。最新实验表明：
1. 对于大多数文档类型，2048 tokens 的 chunk size 比 512 tokens 的 F1 分数高出 15%
2. 短文档也应该使用至少 1024 tokens，因为现代 embedding 模型（如 text-embedding-3-large）上下文窗口已达 8192 tokens
3. overlap 应该提高到 30-40%，而不是传统的 20%

这与现有 canon 中"短文档用 512 tokens"的建议直接矛盾。

## 提取声明
