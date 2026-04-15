---
type: change-proposal
action: create
status: inbox
target_page: ai/concepts/membership-tier-recommendation
target_type: concept
domain: ai
primary_type: concept
subtype: recommendation-algorithm
tags:
  - membership
  - recommendation
  - tier-system
  - user-ltv
  - ab-test
suggested_tags:
suggested_aliases:
suggested_related_terms:
trigger_source: sources/notes/2026-04-15-ai.md
origin: ingest
confidence: medium
proposed_at: 2026-04-15
auto_quality_score: 0.795
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
---

## 提案摘要

新建 AI 驱动的会员等级推荐系统概念页，收录其核心机制：embedding + 相似度推荐模型，以及与产品规则过滤的协同设计。

## 变更内容

### 新增内容

**会员等级推荐系统的双域特性**

会员等级推荐系统同时涉及 AI 算法（embedding + 相似度计算）和产品设计（用户分层、权益设计）。AI 侧提供用户-等级匹配能力，产品侧负责业务约束与权益体系。

**Embedding + 相似度推荐模型**

推荐模型使用用户行为序列 embedding，计算用户与会员等级的匹配分。核心流程：用户行为序列 → 向量 embedding → 与各会员等级向量计算相似度 → 排序输出候选等级。

**产品规则过滤层**

AI 模型的推荐结果需要经过产品规则过滤，包括黑名单（封禁用户/等级）、频控（推荐频率限制）、业务约束（最低门槛、互斥规则等）。

**效果数据**

A/B 测试表明 AI 推荐比规则推荐提升转化率 23%，验证了 AI 方法的有效性。

### 修改内容

无（新建页面）

### 删除内容

无

## Source 证据

- 会员等级推荐系统同时涉及 AI 算法（embedding + 相似度计算）和产品设计（用户分层、权益设计）。（原文：核心内容第1条）
- 推荐模型使用用户行为序列 embedding，计算用户与会员等级的匹配分。（原文：核心内容第2条）
- AI 模型的推荐结果需要经过产品规则过滤（黑名单、频控、业务约束）。（原文：核心内容第4条）
- A/B 测试表明 AI 推荐比规则推荐提升转化率 23%。（原文：核心内容第5条）

## AI 建议

主域选 ai（推荐算法是核心使能技术），次域登记 product。建议页面放置于 `ai/concepts/` 分类下，主题标签：membership / recommendation / user-matching。
产品侧的会员等级设计和 LTV/流失预测知识可在 `product/membership/` 下单独建页补充，本提案聚焦 AI 算法侧。