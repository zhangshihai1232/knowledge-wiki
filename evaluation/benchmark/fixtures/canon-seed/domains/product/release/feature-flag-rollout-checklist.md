---
type: guide
title: "Feature Flag 灰度发布检查单"
domain: "product"
sources:
  - sources/notes/2026-04-09-sb-n-09-feature-flag-rollout-checklist.md
confidence: low
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
tags: [benchmark, release, feature-flag]
last_queried_at: ~
query_count: 0
---

## 前提条件

灰度发布按阶段推进，每一步都需要手动确认指标。

## 步骤

1. 先灰度 1%。  
2. 再灰度 10%。  
3. 再灰度 50%。  
4. 每一步都检查错误率与投诉量。

## 常见问题

当前 seed 未定义收入波动联动规则，也未定义回滚时间窗标准。

## 参考来源

- `sources/notes/2026-04-09-sb-n-09-feature-flag-rollout-checklist.md`

