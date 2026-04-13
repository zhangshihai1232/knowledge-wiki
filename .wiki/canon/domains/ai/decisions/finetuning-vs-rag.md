---
type: decision
title: "LLM 微调 vs RAG 选择决策框架"
summary: "行为/格式问题选Fine-tuning，知识频繁更新/需溯源选RAG，两者都要选混合；含五步简化决策树和四方案成本对比"
domain: ai
sources:
  - sources/notes/2026-04-08-llm-finetuning-vs-rag-decision-criteria.md
confidence: low
last_compiled: 2026-04-08
last_updated: 2026-04-08
staleness_days: 0
cross_refs:
  - chunk-size-strategy
  - vector-db-comparison
status: active
tags:
  - llm
  - fine-tuning
  - rag
  - decision-framework
  - knowledge-injection
  - lora
primary_type: decision
subtype: policy
---

> ⚠️ **可信度说明**：本页面基于个人实践笔记编译（authority: unverified），部分内容来源未经验证（标注 ⚠️ 处）。confidence 为 low，待后续补充权威来源后升级。

## 背景与约束

本决策框架帮助工程师在实际项目中选择 Fine-tuning、RAG 或混合方案。适用范围：中等规模以上的 LLM 应用，需要在知识注入方式上做出架构决策。

核心判断框架（⚠️ 来源疑似 Databricks 博客，原始链接待验证）：

- **行为问题**（让模型以特定方式说话/格式输出）→ Fine-tuning 更适合
- **知识问题**（让模型知道最新/私有信息）→ RAG 更适合
- 两者都需要 → 考虑混合方案

## 选项分析

### 选项 A：Fine-tuning（微调）

**明确适用场景**：

1. **格式/风格一致性**：需要模型始终以固定格式输出（如 JSON Schema、特定代码注释风格）
2. **领域术语内化**：需要模型深度理解领域专有术语，而非依赖上下文提示
3. **延迟敏感场景**：不能额外增加 100-500ms 的检索延迟
4. **知识固定不变**：训练数据更新频率 < 1次/月

**局限性**：

- 知识更新成本高：全量微调需重新训练；LoRA/PEFT 相对轻量但仍有迭代成本
- 无法提供引用溯源

**待验证内容**：

- ⚠️ 微调后模型对越狱攻击的抵抗力是否更强（alignment fine-tuning 相关说法，来源不明，待验证）
- ⚠️ 个人实践中观察到微调后模型反而更容易编造细节（与"微调减少幻觉"的说法相反），可能与训练数据质量有关，非普遍规律，样本有限

### 选项 B：RAG（检索增强生成）

**明确适用场景**：

1. **知识需要频繁更新**（如实时新闻、日更产品文档）
2. **知识库超大**：远超模型上下文窗口，无法全量注入
3. **需要引用溯源**：业务需明确标注答案来自哪个文档
4. **多知识库切换**：不同客户有不同知识库，不能为每个客户训练独立模型

**局限性**：

- 检索质量高度依赖 embedding 模型和 chunk 策略（参见 [[chunk-size-strategy]]），优化成本较高
- 复杂推理场景效果差：top-k 检索难以覆盖多文档综合推理所需的全部片段
- ⚠️ "Lost in the Middle"问题：LLM 对 context 中间内容的利用率显著低于开头和结尾（据称来自 Liu et al. 2023，具体引用待验证），影响检索结果的实际使用率

### 选项 C：混合方案（Fine-tuning + RAG）

**思路**：用 Fine-tuning 让模型内化"如何使用检索结果"的能力（few-shot 格式），用 RAG 提供实时知识内容。

**实践数据**（⚠️ 样本量小，仅供参考，不具统计显著性）：

- 场景：法律咨询项目
- 规模：LoRA 微调 2000 条样本 + RAG 知识库 5 万篇文档
- 评测方式：人工评审 100 条，主观评分
- 结果：混合方案比纯 RAG 高约 15%
- 限制：样本量小（100 条），主观评审，结论需更多数据支撑

**成本对比**（粗估，仅供参考）：

| 方案 | 一次性成本 | 持续运营成本 | 更新成本 |
|------|-----------|-------------|---------|
| RAG | 低 | 中（向量库+检索） | 低（增量更新） |
| Fine-tuning (full) | 高 | 低（无检索开销） | 高（需重新训练） |
| Fine-tuning (LoRA/PEFT) | 中 | 低 | 中 |
| 混合方案 | 高 | 中 | 中 |

## 决策结论

**简化决策树**：

1. 知识是否需要频繁更新（>1次/月）？ 是 → **RAG**
2. 是否需要引用溯源？ 是 → **RAG**
3. 是否有严格延迟 SLA（端到端 <100ms，无法接受检索延迟）？ 是 → **Fine-tuning**
4. 主要是格式/风格问题？ 是 → **Fine-tuning**；否（知识问题）→ **RAG**
5. 以上都不能单独满足需求 → **混合方案**

## 参考来源

- `sources/notes/2026-04-08-llm-finetuning-vs-rag-decision-criteria.md`（个人笔记，authority: unverified）

> 待补充：Databricks 框架原始链接；Liu et al. 2023 "Lost in the Middle" 论文正式引用；混合方案在更大样本上的实验数据。
