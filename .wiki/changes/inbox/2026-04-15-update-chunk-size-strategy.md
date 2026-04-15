---
type: change-proposal
action: update
status: inbox
target_page: ai/rag/chunk-size-strategy
target_type: guide
domain: ai
primary_type: guide
subtype: workflow
tags:
  - rag
  - chunk-size
  - retrieval
  - embedding
suggested_tags:
suggested_aliases:
suggested_related_terms:
trigger_source: sources/articles/2026-04-15-rag-chunk-size-larger.md
origin: ingest
confidence: medium
proposed_at: 2026-04-15
auto_quality_score: 0.65
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
---

## 提案摘要

更新 ai/rag/chunk-size-strategy 页面中关于短文档 chunk size 的建议，引入新实验数据：2048 tokens 在大多数文档类型上 F1 分数比 512 高 15%，且 overlap 建议从 20% 提高到 30-40%。

## 变更内容

### 修改内容

> ⚠️ 冲突：关于短文档 chunk size 存在矛盾陈述

- 现有 canon（`ai/rag/chunk-size-strategy`）：短文档（<3000 tokens）使用 **512 tokens flat chunk**，长文档使用 1024+20%overlap
- 新 source（`sources/articles/2026-04-15-rag-chunk-size-larger.md`）：2048 tokens 比 512 F1 高 15%；短文档应使用**至少 1024 tokens**；overlap 应提高到 **30-40%**

## Source 证据

- 对于大多数文档类型，2048 tokens 的 chunk size 比 512 tokens 的 F1 分数高出 15%。（原文：第1点）
- 短文档也应该使用至少 1024 tokens，因为现代 embedding 模型（如 text-embedding-3-large）上下文窗口已达 8192 tokens。（原文：第2点）
- overlap 应该提高到 30-40%，而不是传统的 20%。（原文：第3点）

## AI 建议

存在冲突，需人工判断：建议将 canon 页中"短文档用 512 tokens"更新为"推荐 1024-2048 tokens，overlap 30-40%"，但需注意现有 canon 中存在来自内部测试集的数据支撑（512 在特定场景下 MRR@5=0.73），两种配置均有实验依据，请在自身场景进行 A/B 测试后决定采纳哪方。
