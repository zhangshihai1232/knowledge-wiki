---
type: source
source_kind: article
title: "[SB-N-02] Reranker 阈值调优记录"
url: "https://benchmark.local/source/sb-n-02"
author: "Search Quality Group"
published_at: "2026-03-12"
ingested_at: "2026-04-09"
domain: "ai"
tags: [benchmark, rag, reranker, threshold]
extracted: false
authority: secondary
---

## 原始内容

本次调优先用 top-20 做初检，再交给 reranker 二次排序。

- 当 rerank 阈值设为 0.72 时，综合 F1 达到本轮最佳。
- 该结果用于说明流程和阈值选择，不额外声明更深的因果关系。
- 其他阈值方案可以保留做对照，但当前记录不展开。

## 提取声明

