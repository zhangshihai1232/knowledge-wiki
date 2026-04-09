---
type: spec
name: ingest
autonomy: auto
triggers:
  - 用户提供新资料
inputs:
  - 外部URL
  - 文件
  - 文本
outputs:
  - sources/{articles|conversations|notes|references}/{date}-{slug}.md
  - changes/inbox/{date}-{action}-{target-slug}.md
quality_gates:
  - source frontmatter 完整（type/source_kind/title/ingested_at/extracted 均已填写）
  - 正文未改写（原始内容原样保留，无摘要、无润色）
  - proposal 有 target_page（不得为空或占位符）
---

# Spec: Ingest（知识摄入）

## Purpose

将用户提供的外部资料（URL、文件、文本粘贴）转化为两样产物：

1. **source 文件**：存放于 `.wiki/sources/` 下的标准子目录（`articles/`、`conversations/`、`notes/`、`references/`），保留原始内容，不改写，作为持久证据。
2. **change proposal**：存放于 `.wiki/changes/inbox/`，基于 source 内容提取声明，映射到现有或新建的 canon 页面，等待后续 review/compile 处理。

ingest 是知识进入系统的**唯一入口**。所有外部资料必须经过此 spec 处理，不得绕过直接写入 canon。

---

## When to Run

以下任一情形触发本 spec：

- 用户粘贴一段文字并表示"这是新资料/文章/笔记/对话"
- 用户提供一个 URL，要求摄入或参考
- 用户上传或引用一个文件（PDF、Markdown、文本等）
- 用户说"记录这个"、"把这个加入知识库"、"这是新的信息"

**不触发本 spec 的情形**：用户只是提问、检索、讨论，没有提供需要持久化的外部资料。

---

## Steps

### Step 1：判断资料类型，确定存放子目录

根据资料性质，确定 `source_kind` 枚举值和对应子目录：

| source_kind  | 说明                                   | 子目录                          |
|--------------|----------------------------------------|---------------------------------|
| article      | 博客、论文、新闻、技术文章             | `.wiki/sources/articles/`       |
| conversation | 聊天记录、访谈、问答对话               | `.wiki/sources/conversations/`  |
| note         | 个人笔记、脑图、随手记录               | `.wiki/sources/notes/`          |
| reference    | 文档、规范、手册、数据表、代码片段     | `.wiki/sources/references/`     |

判断规则：
- 有明确作者和发布时间 → 优先 `article`
- 是对话形式（多人来回）→ `conversation`
- 是用户自己写的片段、想法 → `note`
- 是规范性/参考性文档（API 文档、标准等）→ `reference`
- 无法判断时，默认 `note`

文件名规范：`{ingested_at}-{slug}.md`
- `ingested_at`：今日日期，格式 `YYYY-MM-DD`
- `slug`：资料标题的小写连字符形式，去除特殊字符，最长 50 字符

示例：`2026-04-08-attention-is-all-you-need.md`

---

### Step 2：创建 source 文件

按 `.wiki/policy/schemas/source-page.md` 定义的 schema 创建文件。

**关键约束**：
- `extracted` 初始值必须为 `false`
- 正文 `## 原始内容` 下保留资料原文，**不改写、不摘要、不润色**
- 若资料有 URL，必须填写 `url` 字段
- `ingested_at` 填写当前日期

示例 frontmatter：

```yaml
---
type: source
source_kind: article
title: "Attention Is All You Need"
url: "https://arxiv.org/abs/1706.03762"
author: "Vaswani et al."
published_at: "2017-06-12"
ingested_at: "2026-04-08"
domain: "ai"
tags: [transformer, attention, nlp, deep-learning]
extracted: false
---
```

创建文件，写入 frontmatter 和 `## 原始内容` 节，将资料原文置于其下。`## 提取声明` 节暂时留空（Step 6 填写）。

---

### Step 3：从原始内容中提取 3–10 个关键声明

从 `## 原始内容` 中识别具体、可验证、有知识价值的陈述，提取为声明列表。

**声明要求**：
- 数量：3 个（资料较短）到 10 个（资料较长），不超过 10 个
- 格式：一句话陈述 + 括号内注明来源段落（段落标题或段落编号）
- 保持原文语义：不得改变命题方向，不得合并不同来源的内容
- 禁止归纳性结论句：声明中不得包含未出自原文任何位置的归纳性判断句；若需说明两方关系，必须以 `（AI归纳，非原文）` 显式标注，且该标注内容不得作为独立知识点引用
- 粒度：一条声明对应一个独立的知识点

示例声明格式：

```
- Transformer 架构完全基于注意力机制，不使用 RNN 或 CNN。（原文：§Abstract）
- Multi-head attention 允许模型同时关注来自不同位置的不同表示子空间。（原文：§3.2）
- 在 WMT 2014 英德翻译任务中，Transformer 的 BLEU 得分为 28.4，超过当时所有已知模型。（原文：§6.1）
```

**不应提取的内容**：纯背景介绍、引用他人工作的陈述（非资料本身的核心观点）、无法独立理解的片段。

---

### Step 4：读取 `.wiki/canon/_index.md`，匹配现有 canon 页

读取 `.wiki/canon/_index.md` 获取当前 canon 页面目录，对每条声明判断归属：

**匹配逻辑**：

1. 扫描 `_index.md` 中列出的 canon 页面路径和标题
2. 对每条声明，判断是否有语义相关的现有页面：
   - **找到匹配页面** → `action: update`，`target_page` 设为该页面路径
   - **未找到匹配页面** → `action: create`，`target_page` 设为建议的新页面路径

**命名建议路径规则（action: create 时）**：
- 格式：`{domain}/{category}/{concept-slug}`
- 示例：`ai/architectures/transformer`、`ai/concepts/attention-mechanism`
- domain 参考 source frontmatter 中的 `domain` 字段

**分组原则**：多条声明若指向同一页面，合并为一个 proposal；分属不同页面则分别创建 proposal。

---

### Step 4.5：提案质量预评分与去重检查

在生成 proposal 文件之前，执行以下两项检查：

**质量预评分**：

对每个待生成的 proposal，AI 评估以下维度并输出 `auto_quality_score`（0-1 浮点数）：

| 维度 | 权重 | 说明 |
|------|------|------|
| 声明信息量 | 40% | 提取的声明是否包含具体、可验证的知识点（非泛泛描述） |
| 与 canon 差异度 | 30% | 提案内容与现有 canon 页面的差异程度（完全重复得0分） |
| 来源可信度 | 30% | source 文件的 `authority` 字段（authoritative=1.0, secondary=0.6, unverified=0.3） |

路由规则：
- `auto_quality_score >= 0.4`：proposal 写入 `changes/inbox/`（正常流程）
- `auto_quality_score < 0.4`：proposal 写入 `changes/low-quality/`（暂存区，不进入主审查队列）

**提案去重检查**：

在写入前，检查 `changes/inbox/` 和 `changes/review/` 中是否已存在针对同一 `target_page` 的 pending proposal：

- 若存在：不生成新 proposal，在 LOG 中记录 `[DEDUP] 已存在针对 {target_page} 的待处理提案：{现有文件名}`，并将本次声明追加到现有 proposal 的 `## Source 证据` 节
- 若不存在：正常生成新 proposal

---

### Step 5：写入 proposal 到 `.wiki/changes/inbox/`

按 `.wiki/policy/schemas/change-proposal.md` 定义的 schema，为每个目标页面创建一个 proposal 文件。

文件名规范：`{proposed_at}-{action}-{target-slug}.md`

示例：`2026-04-08-update-transformer.md` 或 `2026-04-08-create-attention-mechanism.md`

**完整 proposal 示例**：

```yaml
---
type: change-proposal
action: create
status: inbox
target_page: "ai/architectures/transformer"
target_type: concept
trigger_source: "sources/articles/2026-04-08-attention-is-all-you-need.md"
confidence: medium
proposed_at: "2026-04-08"
reviewed_by: ~
reviewed_at: ~
rejection_reason: ~
compiled: false
compiled_at: ~
---
```

```markdown
## 提案摘要

新建 Transformer 架构 canon 页，收录其核心设计原则与实验结果。

## 变更内容

### 新增内容

**Transformer 架构概述**

Transformer 是一种完全基于注意力机制的序列到序列架构，不依赖 RNN 或 CNN，
由编码器-解码器结构组成，使用 Multi-head Self-Attention 和 Position-wise Feed-Forward 网络。

**Multi-head Attention**

允许模型在不同位置同时关注来自不同表示子空间的信息，通过并行运行 h 个注意力头实现。

**实验结果**

WMT 2014 英德翻译：BLEU 28.4，超越当时所有已知结果。

### 修改内容

无（新建页面）

### 删除内容

无

## Source 证据

- Transformer 完全基于注意力机制，不使用 RNN 或 CNN。（来源：§Abstract）
- Multi-head attention 允许模型同时关注不同表示子空间的不同位置。（来源：§3.2）
- WMT 2014 英德翻译 BLEU 28.4，超越当时所有已知结果。（来源：§6.1）

## AI 建议

建议将此页面放置于 `ai/architectures/` 分类下，与 BERT、GPT 等相关页面并列。
初始内容可直接基于 source 证据构建，待后续资料补充完善。
```

---

### Step 6：更新 source 文件 extracted: true

回到 Step 2 创建的 source 文件：

1. 将 frontmatter 中 `extracted: false` 改为 `extracted: true`
2. 在 `## 提取声明` 节追加 Step 3 提取的声明列表（原样粘贴）

此步骤标志该 source 文件已完成处理，不会被重复摄入。

---

### Step 7：追加 LOG，更新 STATE.md

**追加操作记录到 `.wiki/policy/LOG.md`**：

在 `LOG.md` 末尾追加一条记录，格式如下：

```
## {ingested_at} ingest

- source: `sources/{kind}/{date}-{slug}.md`
- proposals: {N} 个（列出文件名，逗号分隔）
- action: {create/update/混合}
- note: {可选，一句话备注，如"首次摄入 Transformer 相关资料"}
```

示例：

```
## 2026-04-08 ingest

- source: `sources/articles/2026-04-08-attention-is-all-you-need.md`
- proposals: `2026-04-08-create-transformer.md`, `2026-04-08-create-attention-mechanism.md`
- action: create
- note: 首次摄入 Transformer 原始论文，提取 5 条声明，生成 2 个 create 提案
```

**更新 `.wiki/policy/STATE.md`**：

读取 `STATE.md`，更新以下字段后写回：

```yaml
total_sources: <sources/ 下非 .gitkeep 文件总数（重新计数）>
last_ingest: <今日日期，格式 YYYY-MM-DD>
pending_proposals: <changes/inbox/ + changes/review/ 文件数之和>
updated_at: <今日日期>
```

---

## Quality Gates

在完成全部步骤后，执行以下 3 项检查。任一项不通过，立即修正后再继续。

**QG-1：source frontmatter 完整**

检查 source 文件 frontmatter 中以下字段是否均已填写（非空）：
- `type`（必须为 `source`）
- `source_kind`（必须为枚举值之一）
- `title`（非空字符串）
- `ingested_at`（ISO 8601 日期格式）
- `extracted`（Step 6 后必须为 `true`）

**QG-2：正文未改写**

目视检查 source 文件 `## 原始内容` 节：
- 是否与用户提供的原始资料内容一致
- 是否存在概括性替换、语义改写、添加解释性语句

若有改写，必须还原为原文。

**QG-3：每个 proposal 有合法的 target_page**

检查所有 proposal 文件的 `target_page` 字段：
- 不得为空
- 不得为占位符（如 `"todo"`、`"unknown"`、`"TBD"`）
- 必须符合路径格式 `{domain}/{category}/{slug}`
- action 为 `update` 时，路径必须与 `_index.md` 中的现有页面路径完全匹配

---

## 调用示例

**场景**：用户粘贴了一篇关于 Transformer 架构的 AI 文章摘要，要求摄入知识库。

---

**原始输入**：

> 标题：Attention Is All You Need
> 来源：https://arxiv.org/abs/1706.03762
> 作者：Vaswani et al.，2017
>
> 摘要：我们提出了一种新的简单网络架构 Transformer，完全基于注意力机制，摒弃了递归和卷积。在两个机器翻译任务上，该模型在质量上更优，同时更可并行化，且所需训练时间显著减少。在 WMT 2014 英德翻译任务中，我们的模型达到 28.4 BLEU，超越现有最佳结果（包括集成模型）2 BLEU 以上。在 WMT 2014 英法翻译任务上，单一模型取得 41.0 BLEU，创下新的单模型最优成绩。

---

**执行过程**：

**Step 1**：资料有标题、作者、发布时间，且是学术文章 → `source_kind: article`，存入 `.wiki/sources/articles/`，slug 为 `attention-is-all-you-need`，文件名 `2026-04-08-attention-is-all-you-need.md`。

**Step 2**：创建 source 文件：

```
.wiki/sources/articles/2026-04-08-attention-is-all-you-need.md
```

frontmatter 填写 `type: source`，`source_kind: article`，`url: https://arxiv.org/abs/1706.03762`，`extracted: false`，`## 原始内容` 下粘贴原文。

**Step 3**：提取 4 条声明：
1. Transformer 完全基于注意力机制，不使用递归或卷积。（原文：摘要第1句）
2. Transformer 比基于 RNN 的模型更可并行化，训练时间显著减少。（原文：摘要第2句）
3. WMT 2014 英德翻译 BLEU 28.4，超越现有最佳 2 BLEU 以上。（原文：摘要第3句）
4. WMT 2014 英法翻译单模型 BLEU 41.0，创单模型新纪录。（原文：摘要第4句）

**Step 4**：读取 `.wiki/canon/_index.md`，未找到 `transformer` 或 `attention-mechanism` 相关页面 → 全部声明归入一个 `action: create` 的 proposal，`target_page: ai/architectures/transformer`。

**Step 5**：创建 proposal 文件：

```
.wiki/changes/inbox/2026-04-08-create-transformer.md
```

写入完整 frontmatter 和正文（含提案摘要、变更内容、Source 证据、AI 建议）。

**Step 6**：将 source 文件 `extracted` 改为 `true`，追加 4 条声明到 `## 提取声明` 节。

**Step 7**：在 `LOG.md` 追加：

```
## 2026-04-08 ingest

- source: `sources/articles/2026-04-08-attention-is-all-you-need.md`
- proposals: `2026-04-08-create-transformer.md`
- action: create
- note: 摄入 Transformer 原始论文摘要，提取 4 条声明，生成 1 个 create 提案
```

**Quality Gates 检查**：
- QG-1：frontmatter 完整，`extracted: true` ✓
- QG-2：`## 原始内容` 与用户粘贴原文一致，未改写 ✓
- QG-3：`target_page: ai/architectures/transformer` 格式合法 ✓

**输出产物**：
- `.wiki/sources/articles/2026-04-08-attention-is-all-you-need.md`
- `.wiki/changes/inbox/2026-04-08-create-transformer.md`

---

## 升级规则

当提取的声明与 canon 中已有内容产生**矛盾**时，不得静默覆盖，必须按以下规则处理：

### 什么是矛盾声明

满足以下任一条件：
- 新声明与现有 canon 页面中的陈述在事实层面相反或不兼容
- 新声明的数值/结论与现有内容数值/结论不同，且两者均有来源
- 新资料明确否定或修正了 canon 中的某个观点

### 处理步骤

1. **识别冲突**：在 proposal 的 `## 变更内容` 中，用 `> ⚠️ 冲突` 标记出矛盾点
2. **保留双方**：同时引用现有 canon 内容和新声明，不删除任何一方
3. **标注来源**：明确列出两方的来源（canon 页面路径 + source 文件路径）
4. **降级 action**：将 `action` 从 `update` 改为 `update`，但在 `## AI 建议` 中明确写出"存在冲突，需人工判断"

示例冲突标注格式：

**格式说明**：`> ⚠️ 冲突：` 为 blockquote 格式，compile create-with-conflict 检测时识别 `## 变更内容` 节中包含此前缀的 blockquote 行作为内部分歧标志。

```markdown
## 变更内容

### 修改内容

> ⚠️ 冲突：关于 Transformer 是否需要位置编码存在矛盾陈述

- 现有 canon（`ai/architectures/transformer`）：Transformer 使用固定正弦位置编码
- 新 source（`2026-04-08-rotary-position-embedding.md`）：RoPE 等旋转位置编码已取代固定编码

## AI 建议

存在冲突，需人工判断：建议将 canon 页更新为"原始 Transformer 使用固定正弦编码，现代变体已广泛采用旋转位置编码（RoPE）等改进方案"，保留历史描述的同时补充演进信息。请人工 review 后决定是否采纳。
```

5. **保持 status: inbox**：矛盾 proposal 不得自动晋升到 `review`，必须等待人工处理
6. **LOG.md 记录**：在本次摄入的 LOG 条目中追加 `conflict: true`，并简述冲突内容
