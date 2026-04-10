---
type: decision
title: "Prompt Cache 使用边界"
domain: "ai"
sources:
  - sources/conversations/2026-04-09-sb-n-03-prompt-caching-policy.md
confidence: medium
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
tags: [benchmark, agents, cache]
last_queried_at: ~
query_count: 0
---

## 背景与约束

目标是在效率、可调试性和可复现性之间取得平衡。

## 选项分析

- 开发环境：默认禁用缓存，避免 prompt 变更被隐藏。  
- 生产环境：允许对高频稳定模板启用缓存。  
- 调试场景：必须提供显式绕过缓存的能力。

## 决策结论

当前 seed 只确定“开发禁用 / 生产可用 / 调试可绕过”三条边界。

## 参考来源

- `sources/conversations/2026-04-09-sb-n-03-prompt-caching-policy.md`

