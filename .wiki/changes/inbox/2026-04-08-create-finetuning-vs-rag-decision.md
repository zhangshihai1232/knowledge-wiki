---
type: change-proposal
action: create
status: inbox
target_page: "ai/decisions/finetuning-vs-rag"
target_type: decision
trigger_source: "sources/notes/2026-04-08-llm-finetuning-vs-rag-decision-criteria.md"
confidence: low
proposed_at: "2026-04-08"
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
auto_quality_score: 0.63
conflict_location: ~
---

## 提案摘要

新建 LLM 微调 vs RAG 决策框架 canon 页，基于个人实践笔记整理场景化选择标准，并明确标注其中未经验证的内容和待确认的外部引用。

## 变更内容

### 新增内容

**背景与约束**

本决策框架帮助工程师在实际项目中选择 Fine-tuning、RAG 或混合方案。注意：本页面部分内容来源于个人实践笔记和未经验证的外部引用，标注 ⚠️ 的内容需要后续验证。

**选项分析**

**选项 A：Fine-tuning（微调）**

适用于以下场景（明确建议）：
1. **格式/风格一致性**：需要模型始终以固定格式输出（如 JSON Schema、特定代码注释风格）
2. **领域术语内化**：需要模型深度理解领域专有术语，而非依赖上下文提示
3. **延迟敏感场景**：不能额外增加 100-500ms 的检索延迟
4. **知识固定不变**：训练数据更新频率 < 1次/月

局限性：
- 知识更新成本高（全量微调需重新训练；LoRA 相对轻量但也有成本）
- 无法提供引用溯源

⚠️ 待验证：微调后模型对越狱攻击的抵抗力是否更强（alignment fine-tuning 相关说法，来源不明）

⚠️ 个人观察（与部分说法相反，未经验证）：笔记作者的实践中微调后模型更容易编造细节，可能与训练数据质量有关，而非普遍规律

**选项 B：RAG（检索增强生成）**

适用于以下场景（明确建议）：
1. **知识需要频繁更新**（如实时新闻、日更产品文档）
2. **知识库超大**：远超模型上下文窗口
3. **需要引用溯源**：业务需明确标注答案来源文档
4. **多知识库切换**：不同客户有不同知识库

局限性：
- 检索质量高度依赖 embedding 模型和 chunk 策略，优化成本高
- 复杂推理场景效果差（top-k 检索难以覆盖所有所需片段）
- ⚠️ "Lost in the Middle"问题：据称来自 Stanford 论文（约 2023 年，具体引用待验证），LLM 对 context 中间内容的利用率显著低于开头和结尾，影响检索结果的实际使用率

**选项 C：混合方案（Fine-tuning + RAG）**

思路：用 Fine-tuning 让模型学会"如何使用检索结果"（few-shot 格式内化），用 RAG 提供实时知识。

笔记作者实践数据（⚠️ 样本量小，仅供参考）：
- 场景：法律咨询项目
- 规模：LoRA 微调 2000 条 + RAG 5 万篇文档
- 评测：人工评审 100 条，主观评分比纯 RAG 高约 15%
- 限制：样本量小，结论需更多数据支撑

**决策结论**

核心判断框架（⚠️ 来源疑似 Databricks 博客，原始链接未验证）：
- 行为问题（让模型以特定方式说话/输出）→ Fine-tuning 更适合
- 知识问题（让模型知道最新/私有信息）→ RAG 更适合
- 两者都需要 → 考虑混合方案

简化决策树：
1. 知识是否需要频繁更新？是 → RAG / 否 → 下一步
2. 是否需要引用溯源？是 → RAG / 否 → 下一步
3. 是否有严格延迟 SLA（<100ms）？是 → Fine-tuning / 否 → 下一步
4. 主要是格式/风格问题还是知识问题？格式/风格 → Fine-tuning / 知识 → RAG

### 修改内容

无（新建页面）

### 删除内容

无

## Source 证据

- 核心框架：行为问题 → Fine-tuning，知识问题 → RAG（来源于笔记，引用自疑似 Databricks 博客，待验证）（原文：§核心问题框架）
- Fine-tuning 明确适用场景：格式一致性、领域术语内化、延迟 <100-500ms 增量不可接受、知识更新 <1次/月（原文：§Fine-tuning 适用场景/确定适合的情况）
- 作者个人实践（反例）：微调后反而更容易编造细节，可能与训练数据质量相关（原文：§Fine-tuning 适用场景/可能适合但不确定的情况）
- RAG 局限："Lost in the Middle"问题据称来自 Stanford 约 2023 年论文（原文：§RAG 适用场景/局限性）
- 混合方案实践数据：法律咨询项目，LoRA 2000 条 + RAG 5 万篇，人工评审 100 条，混合方案主观得分比纯 RAG 高约 15%（原文：§混合方案）

## AI 建议

此提案来源为个人笔记（authority: unverified），confidence 定为 low。

建议在 canon 页面中：
1. 明确标注哪些结论已有外部依据、哪些为作者个人实践
2. 将 "Lost in the Middle" 引用替换为具体论文（Liu et al., 2023 "Lost in the Middle: How Language Models Use Long Contexts" — 可能是此论文，建议验证）
3. Databricks 框架来源建议后续补充，找到后可将 authority 升级为 secondary

由于不确定性较多，此提案的 confidence 设为 low，编译后 canon 页应明确标注这是基于未验证笔记的初稿。
