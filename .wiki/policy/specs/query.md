---
type: spec
name: query
autonomy: auto
triggers:
  - 用户提问
inputs:
  - canon/_index.md
  - canon/domains/**/*.md
outputs:
  - 带来源标注的回答
  - 可选的 changes/inbox/ proposal
quality_gates:
  - 每个事实声明标注来源 canon 页
  - 无相关知识时明确说明而非编造
---

## Purpose

基于 canon 知识库回答用户的知识性问题。每个事实声明必须追溯到具体的 canon 页面，确保回答的可溯源性和可信度。当 canon 中存在知识缺口时，主动生成 proposal 补充知识库，形成知识自我完善的闭环。

---

## When to Run

用户提出任何知识性问题时触发本 spec，包括但不限于：

- 询问某个概念、术语或技术的定义与含义
- 请求对比分析两个或多个概念、方案
- 询问某类操作的步骤或最佳实践
- 请求解释某个领域的工作原理或背景

不适用场景：用户提出的是操作指令（如"帮我写代码"、"执行某任务"）而非知识性问题，此时应路由至对应的执行 spec。

---

## 步骤责任标记说明

每个步骤标题带有执行责任标记：

| 标记 | 含义 | 执行者 |
|------|------|--------|
| 🧠 | 语义推理步骤 | LLM（Skill 层） |
| ⚙️ | 确定性操作步骤 | CLI（优先高层 `wiki ask` / `wiki import` contract） |
| 🤝 | 人机交互步骤 | 人工决策，LLM 辅助 |

⚙️ 步骤中的文件操作**必须**通过 CLI 命令执行，不得由 LLM 直接操作文件系统。默认优先高层 workflow contract，仅在缺少公开 contract 时才落到 `wiki internal`。

## Steps

### Step 1 🧠：解析问题意图

读取用户输入，将问题归类为以下四种类型之一：

| 类型 | 特征 | 示例 |
|------|------|------|
| **事实查询** | 询问某个具体事实、定义、属性 | "什么是 RAG？" |
| **概念解释** | 需要展开说明原理、机制、背景 | "为什么 Transformer 比 RNN 效果更好？" |
| **对比分析** | 涉及两个或多个对象的比较 | "Fine-tuning 和 Prompt Engineering 有什么区别？" |
| **操作指南** | 询问如何完成某项任务的步骤 | "如何评估一个 LLM 的输出质量？" |

分类结果决定后续回答的组织结构与侧重点：事实查询重在精准定义，概念解释重在原理展开，对比分析重在维度对齐，操作指南重在步骤清晰。

---

### Step 2 🧠⚙️：导航定位候选 canon 页面

优先通过运行态索引缩圈，而不是每次从 `_index.md` 全量遍历开始。

**推荐 runtime hook**：

```bash
wiki ask "{用户问题}" --json
```

先读取 `wiki ask` 返回的候选 `pages / proposals / sources`，并结合 `retrieval.strategy / retrieval.tokens` 判断命中质量，再回到下面的层级结构做二次确认与阅读。只有当运行态索引结果明显不足时，才退回到 `_index.md` 的全量导航。

按照以下层级导航结构，定位与问题相关的 canon 页面：

```
canon/_index.md
  └── 列出所有领域（domains）及其简介
        └── canon/domains/{domain}/_index.md
              └── 列出该领域下所有 canon 页面的 slug 与摘要
                    └── canon/domains/{domain}/{category}/{slug}.md   ← 候选页面
```

**导航步骤**：

1. 读取 `canon/_index.md`，获取全部领域列表
2. 根据问题关键词，判断问题属于哪个或哪几个领域
3. 读取目标领域的 `_index.md`，获取该领域下的页面索引（索引项格式为 `{domain}/{category}/{slug}`）
4. 从索引中筛选出与问题最相关的候选页面（通常 1-3 个）
5. 若问题跨领域，需在多个领域中分别导航

若 `canon/_index.md` 不存在或领域索引为空，记录此缺口，进入 Step 5（write-back）。

---

### Step 3 🧠：读取候选页面，综合回答

逐一读取 Step 2 筛选出的候选 canon 页面，执行以下操作：

1. **提取相关内容**：从页面中摘取与问题直接相关的段落、定义、列表或示例
2. **组织回答结构**：根据 Step 1 确定的问题类型，选择合适的回答结构：
   - 事实查询：直接给出定义 → 必要时补充背景
   - 概念解释：核心原理 → 工作机制 → 典型应用场景
   - 对比分析：建立对比维度表格 → 逐维度说明差异 → 给出选择建议
   - 操作指南：前置条件 → 分步骤说明 → 注意事项
3. **整合多源内容**：若答案来自多个 canon 页面，需在行文中自然整合，避免割裂感
4. **保留来源映射**：记录每个关键声明对应的 canon 页 slug，为 Step 4 的来源标注做准备
5. **更新利用追踪字段**：对本次最终回答中**实际贡献了至少 1 条保留事实性声明**的 canon 页面，更新：
   - `last_queried_at = 今日日期`
   - `query_count = query_count + 1`

   同一页面在同一次回答中最多累计 1 次，避免单次回答多处引用造成重复计数。

---

### Step 4 🧠：来源完整性检查

在输出回答前，对每个关键声明进行来源审查：

**检查规则**：

- 每个事实性声明（定义、数据、因果关系、最佳实践等）必须能映射到至少一个具体的 canon 页 slug
- 若某声明来自 canon 页面的直接内容 → 标注 `[来源: {slug}]`
- 若某声明是基于 canon 内容的合理推断（能写出"基于 canon 中 [slug] 的 X，推断 Z"，且推断链清晰）→ 标注 `[⚠️ canon 外推断：基于 {slug}，建议验证]`
- 若某声明来自模型训练知识、无法追溯到任何 canon 内容 → 标注 `[⚠️ 训练知识，未经 canon 验证]`，或从回答中移除，不得以"推断"名义混入
- 若某声明完全无法在 canon 中找到依据且非推断 → 从回答中移除，转移到"知识缺口说明"部分

**不允许的行为**：

- 凭训练知识补充 canon 中不存在的内容而不加标注
- 使用模糊表述（"通常认为"、"一般来说"）掩盖来源缺失

完成检查后，回答中每个保留的关键声明均应带有来源标注。

同时，按以下口径统计本次回答的事实性声明数量，供 write-back 触发与日志记录使用：

- `source_claim_count`：标注为 `[来源: slug]` 的事实性声明数
- `inference_claim_count`：标注为 `[⚠️ canon 外推断]` 的事实性声明数
- `training_claim_count`：标注为 `[⚠️ 训练知识，未经 canon 验证]` 的事实性声明数
- `total_factual_claims = source_claim_count + inference_claim_count + training_claim_count`
- `canon外推断占比 = inference_claim_count / total_factual_claims`

若 `total_factual_claims = 0`，则将 `canon外推断占比` 视为 0，不得因除零而报错。

---

### Step 5 ⚙️🧠（可选）：write-back——发现知识缺口时生成 proposal

触发条件：在 Step 2 或 Step 4 中发现以下任一情况：

- canon 中完全没有覆盖用户问题所属领域
- canon 中有相关领域，但缺少用户问题涉及的具体概念或页面
- 按 Step 4 统计得到的 `canon外推断占比` 超过 **25%**，说明 canon 覆盖度不足

**执行动作**：

1. 在 `changes/inbox/` 目录下生成一个 proposal 文件，文件名格式为：`{YYYY-MM-DD}-query-gap-{slug-建议}.md`
2. proposal frontmatter 至少包含：
   ```yaml
   ---
   type: change-proposal
   action: create
   status: inbox
   target_page: "{domain}/{category}/{slug}"
   trigger_source: "system:query-writeback"
   origin: query-writeback
   confidence: low
   proposed_at: "{today}"
   compiled: false
   ---
   ```

**推荐 CLI**：

```bash
wiki import --input query-writeback.json --json
```

若 agent 直接生成 payload 流，可使用：

```bash
... | wiki import --input - --json
```

> **LLM 职责**：判断知识缺口、确定 `target_page`、生成 payload。  
> **runtime 职责**：去重检查、proposal 落盘、日志与状态更新。

其中 payload 中可固定：

- `proposal.origin = query-writeback`
- `proposal.trigger_source = system:query-writeback`

3. proposal 内容包括：
   - 缺失知识的主题描述
   - 建议新增的 canon 页面 slug 和所属领域
   - 触发此缺口的原始用户问题（摘录）
   - 建议的初始内容框架（可选）
4. `query-writeback` proposal 的定位是“知识缺口登记”，**不是可直接编译的 canon 内容**。在进入 `approved` 并交给 compile 之前，必须由后续 ingest / 人工补充至少 1 个真实 `sources/...` 路径作为依据。
5. 在当次回答的末尾，向用户告知：

   > 已发现知识缺口，已生成 proposal 到 `changes/inbox/`，建议后续补充 canon 页面：`{slug-建议}`

---

### Step 6 ⚙️（可选）：追加 LOG 与 write-back 追踪

仅当查询具有以下特征时才追加日志，避免日志噪音：

- 首次覆盖某个新领域的查询
- 触发了 write-back（Step 5）
- 用户问题导致了多跳导航（跨 2 个以上领域）

**日志追加规则**：

- write-back 相关日志：写入 `.wiki/changes/LOG.md`（因为 write-back 产生了 changes/ 目录下的文件变更）
- 纯查询日志：写入 `.wiki/policy/LOG.md`

日志格式：

```
[{timestamp}] Q: {问题摘要（≤50字）} | 类型: {问题类型} | 来源页: {slug列表} | write-back: {yes/no} | canon外推断占比: {百分比}
```

**CLI 执行**：

> **说明**：`wiki ask` 命令本身不写日志，此处 `wiki internal append-log` 是该场景的正确工具，非旧命令残留。query spec 没有对应的高层日志写入 contract，`wiki internal` 是唯一正确路径。

```bash
wiki internal append-log --spec query \
  --message "Q: {问题摘要} | 类型: {问题类型} | 来源页: {slug列表} | write-back: yes"
wiki internal update-state
```

**write-back 转化追踪**：

当 write-back 触发时，在生成的 proposal 文件 frontmatter 中增加 `origin: query-writeback` 标记，并使用 `trigger_source: system:query-writeback`。系统可据此统计：

- `writeback_proposal_count`：write-back 产生的 proposal 总数
- `writeback_conversion_rate`：write-back proposal 最终被 compiled 的比例（compiled 数 / 总数）

此指标由 lint 在 Step 5.5 中计算并写入 STATE.md。

**write-back SLA**：write-back 生成的 proposal 应在 14 天内完成 promote 审查。超过 14 天未审查的 write-back proposal 由 lint L008 以 WARNING 级别报告（与普通 proposal 的 7 天阈值区分，write-back proposal 标注 `[WRITEBACK-OVERDUE]`）。

---

## 回答格式规范

### 来源标注格式

每个关键声明后紧跟行内来源标注，不另起段落：

```
RAG（Retrieval-Augmented Generation）是一种将检索系统与生成模型结合的架构 [来源: llm/rag-basics]，
其核心思路是在生成前先从外部知识库中检索相关文档片段 [来源: llm/rag-basics]，
从而使模型能够利用训练数据之外的实时知识 [来源: llm/rag-advanced]。
```

### canon 外推断标注格式

```
在高并发场景下，向量数据库的查询延迟通常在 10-100ms 量级 [⚠️ canon 外推断，建议验证]。
```

### 训练知识标注格式（与推断区分）

```
GPT-4 的上下文窗口为 128k tokens [⚠️ 训练知识，未经 canon 验证]。
```

> 区分标准：能写出"基于 canon 中 X 推断 Z"的是推断；无法追溯到任何 canon 内容的是训练知识。

### write-back 告知格式（置于回答末尾）

```
---
**知识缺口通知**：本次查询涉及的"向量数据库性能基准"在 canon 中尚无对应页面。
已生成 proposal 到 `changes/inbox/2026-04-08-query-gap-vector-db-benchmark.md`，
建议后续补充 canon 页面：`infrastructure/vector-db-benchmark`。
```

### 整体回答结构模板

```markdown
## {问题或主题标题}

{回答正文，每个关键声明带 [来源: slug] 标注}

### {子主题（如有）}

{...}

---
**知识缺口通知**（仅在触发 write-back 时出现）：...
```

---

## Quality Gates

### Gate 1：来源覆盖率检查

**检查时机**：输出回答前

**规则**：

- 事实性声明（定义、因果、数据、规范）必须 100% 带有来源标注（`[来源: slug]`、`[⚠️ canon 外推断]` 或 `[⚠️ 训练知识，未经 canon 验证]`）
- 观点性、过渡性、连接性语句（如"因此"、"综上"）无需标注
- 禁止出现无标注的技术定义或无依据的绝对化陈述

**不通过示例**（禁止）：

> GPT-4 的上下文窗口为 128k tokens。

**通过示例**：

> GPT-4 的上下文窗口为 128k tokens [来源: llm/gpt4-specs]。

或（canon 无此内容时）：

> GPT-4 的上下文窗口为 128k tokens [⚠️ canon 外推断，建议验证]。

---

### Gate 2：知识边界诚实性检查

**检查时机**：完成 Step 2 导航后、组织回答前

**规则**：

- 若 canon 中完全没有相关内容，必须明确告知用户，禁止用模型训练知识伪装成 canon 内容
- 告知格式：

  > 当前 canon 中未找到关于"{问题主题}"的相关页面。以下内容为模型推断，**未经 canon 验证，请谨慎参考**：
  > ...
  > 建议将此问题标记为知识缺口，补充对应 canon 页面。

- 若 canon 部分覆盖（有相关领域但缺具体概念），则混合使用 `[来源: slug]` 和 `[⚠️ canon 外推断]` 标注，并在回答开头说明覆盖情况

---

## 调用示例

**用户问题**：什么是 Chain-of-Thought Prompting，它为什么能提升模型的推理能力？

---

**执行过程（内部，不展示给用户）**：

- Step 1：问题类型 = 概念解释
- Step 2：导航路径 → `canon/_index.md` → 发现领域 `llm` → 读取 `canon/domains/llm/_index.md` → 找到候选页面 `llm/chain-of-thought`、`llm/prompt-engineering`
- Step 3：读取两个页面，提取相关内容
- Step 4：检查来源标注，无 canon 外推断
- Step 5：canon 覆盖完整，无需 write-back
- Step 6：非首次、非跨域、无 write-back，不追加日志

---

**输出回答**：

## Chain-of-Thought Prompting

Chain-of-Thought（CoT）Prompting 是一种提示词技术，通过在 prompt 中引导模型逐步展示推理中间步骤，而非直接输出最终答案 [来源: llm/chain-of-thought]。

**核心机制**：CoT 的有效性来源于两个方面：一是将复杂问题分解为子步骤，降低单步推理难度 [来源: llm/chain-of-thought]；二是中间步骤作为"草稿空间"，使模型的注意力机制能够引用先前推导出的中间结论 [来源: llm/chain-of-thought]。

**典型形式**：

- **Few-shot CoT**：在 prompt 中提供带推理步骤的示例，模型模仿该模式作答 [来源: llm/chain-of-thought]
- **Zero-shot CoT**：在 prompt 末尾追加"Let's think step by step"等触发语，无需示例即可激活推理链 [来源: llm/prompt-engineering]

**适用场景**：数学推理、逻辑判断、多步骤问答等需要显式推导过程的任务；对于简单事实查询，CoT 收益有限 [来源: llm/chain-of-thought]。

**局限性**：CoT 对模型参数规模有依赖，在较小模型上（通常 <10B 参数）效果不稳定 [⚠️ canon 外推断，建议验证]。
