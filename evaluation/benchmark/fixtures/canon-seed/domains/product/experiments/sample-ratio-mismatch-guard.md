---
type: guide
title: "Sample Ratio Mismatch 守护规则"
domain: "product"
sources:
  - sources/articles/2026-04-09-sb-n-08-sample-ratio-mismatch-guard.md
confidence: medium
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
tags: [benchmark, experiments, srm]
last_queried_at: ~
query_count: 0
---

## 前提条件

实验已开始分流，并且具备实时样本监控。

## 步骤

1. 持续监控样本比例。  
2. 若偏差超过 1%，立即暂停实验。  
3. 优先排查埋点和分流实现。

## 常见问题

当前 seed 只覆盖暂停与排查动作，不提供更多扩展性统计结论。

## 参考来源

- `sources/articles/2026-04-09-sb-n-08-sample-ratio-mismatch-guard.md`

