---
type: guide
title: "长期记忆写入约束"
domain: "ai"
sources:
  - sources/notes/2026-04-09-sb-n-05-memory-write-policy.md
confidence: low
last_compiled: "2026-04-09"
staleness_days: 0
last_updated: "2026-04-09"
status: active
tags: [benchmark, agents, memory]
last_queried_at: ~
query_count: 0
---

## 前提条件

仅考虑长期、可复用的记忆写入，不处理会话临时缓存。

## 步骤

1. 只写入高价值事实。  
2. 只写入可复用事实。  
3. 非敏感内容才允许进入长期记忆。

## 常见问题

当前 seed 只提供“避免敏感内容”的原则，没有更细的隐私等级分层。

## 参考来源

- `sources/notes/2026-04-09-sb-n-05-memory-write-policy.md`

