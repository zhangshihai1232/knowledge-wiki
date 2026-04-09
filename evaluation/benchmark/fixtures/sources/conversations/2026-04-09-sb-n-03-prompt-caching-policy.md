---
type: source
source_kind: conversation
title: "[SB-N-03] Prompt Cache 使用边界讨论"
url: "https://benchmark.local/source/sb-n-03"
author: "Platform Team Chat"
published_at: "2026-04-02"
ingested_at: "2026-04-09"
domain: "ai"
tags: [benchmark, agents, cache, prompt-cache]
extracted: false
authority: secondary
---

## 原始内容

**工程师 A**：开发环境默认禁用缓存，否则很难定位 prompt 变更带来的问题。  
**工程师 B**：生产环境可以对高频稳定模板开启缓存，这样能省延迟和成本。  
**工程师 C**：调试时必须提供显式绕过缓存的开关，否则线上复现会失真。

讨论结论只覆盖上述三条边界，不额外讨论缓存淘汰策略。

## 提取声明

