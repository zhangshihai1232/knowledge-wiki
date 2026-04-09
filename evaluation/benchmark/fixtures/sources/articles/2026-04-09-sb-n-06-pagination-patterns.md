---
type: source
source_kind: article
title: "[SB-N-06] API 分页模式对比"
url: "https://benchmark.local/source/sb-n-06"
author: "API Design Guild"
published_at: "2026-03-06"
ingested_at: "2026-04-09"
domain: "infra"
tags: [benchmark, api, pagination, comparison]
extracted: false
authority: secondary
---

## 原始内容

本文比较 cursor、offset、time-window 三种分页方式。

- cursor 在高写入场景中更稳定，不容易因新增数据导致翻页漂移。
- offset 容易在高写入表上出现漂移和重复读取问题。
- time-window 更适合 append-only 日志或时间序列场景。

本文是结构化对比，不把三种模式混成单一推荐。

## 提取声明

