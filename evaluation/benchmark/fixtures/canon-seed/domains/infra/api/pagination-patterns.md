---
type: comparison
title: "分页模式对比"
domain: "infra"
sources:
  - sources/articles/2026-04-09-sb-n-06-pagination-patterns.md
confidence: medium
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
tags: [benchmark, api, pagination]
last_queried_at: ~
query_count: 0
---

## 对比维度

- 数据稳定性
- 适用场景
- 实现复杂度

## 详细对比

| 模式 | 优点 | 风险 |
|---|---|---|
| cursor | 高写入场景更稳定 | 游标设计更复杂 |
| offset | 实现简单 | 高写入场景易漂移 |
| time-window | 适合 append-only 日志 | 不适合任意跳页 |

## 选择建议

当前 seed 只保留各模式的核心特点，没有提供更细的统一决策框架。

## 参考来源

- `sources/articles/2026-04-09-sb-n-06-pagination-patterns.md`

