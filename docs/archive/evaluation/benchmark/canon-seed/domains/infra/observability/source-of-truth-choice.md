---
type: decision
title: "文档优先 vs 日志优先"
domain: "infra"
sources:
  - sources/articles/2026-04-09-sb-c-09-source-of-truth-choice.md
confidence: low
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
has_divergence: true
tags: [benchmark, observability, source-of-truth]
last_queried_at: ~
query_count: 0
---

## 背景与约束

文档和日志分别代表“稳定共识”与“现场证据”两种不同价值。

## 选项分析

- 文档优先：适合沉淀长期共识。  
- 日志优先：适合还原真实运行现场。

## 决策结论

当前 seed 只保留双方适用场景，不提供冲突裁决机制。

## 参考来源

- `sources/articles/2026-04-09-sb-c-09-source-of-truth-choice.md`

