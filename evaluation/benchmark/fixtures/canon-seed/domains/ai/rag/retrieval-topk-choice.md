---
type: decision
title: "Retrieval TopK 取舍"
domain: "ai"
sources:
  - sources/articles/2026-04-09-sb-c-05-retrieval-topk-choice.md
confidence: low
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
has_divergence: true
tags: [benchmark, rag, topk]
last_queried_at: ~
query_count: 0
---

## 背景与约束

当前资料只说明 precision 与 recall 的取舍，没有统一最优值。

## 选项分析

- `topK=20`：precision 更高。  
- `topK=50`：recall 更高。

## 决策结论

seed 中仅保留 trade-off，本页不提供统一默认 topK。

## 参考来源

- `sources/articles/2026-04-09-sb-c-05-retrieval-topk-choice.md`

