---
type: guide
title: "Reranker 阈值调优"
domain: "ai"
sources:
  - sources/articles/2026-04-09-sb-n-02-reranker-threshold-tuning.md
confidence: medium
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
tags: [benchmark, rag, reranker]
last_queried_at: ~
query_count: 0
---

## 前提条件

- 先完成 top-20 初检
- 再交给 reranker 二次排序

## 步骤

1. 用 top-20 召回候选结果。  
2. 运行 reranker。  
3. 本轮记录中，阈值 0.72 的综合 F1 最优。

## 常见问题

当前资料只记录流程和阈值结果，没有提供更深的因果解释。

## 参考来源

- `sources/articles/2026-04-09-sb-n-02-reranker-threshold-tuning.md`

