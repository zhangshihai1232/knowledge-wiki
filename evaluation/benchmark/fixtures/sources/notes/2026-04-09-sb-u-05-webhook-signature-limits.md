---
type: source
source_kind: note
title: "[SB-U-05] Webhook 签名校验边界待确认"
url: ~
author: "Security Review Notes"
published_at: ~
ingested_at: "2026-04-09"
domain: "infra"
tags: [benchmark, security, webhook, signature]
extracted: false
authority: unverified
---

## 原始内容

可能只校验 sha1 也够用，但这条判断还没有经过安全团队确认。

- 当前只能保留为风险提示。
- 不能写成正式最佳实践。

## 提取声明

