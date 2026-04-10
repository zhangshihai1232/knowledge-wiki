---
type: findings
agent: A2-知识结构层
evaluated_at: 2026-04-08
evaluation_type: live-run
---

# 知识结构层评估报告

## 属性3：导航可达性

### 评分：6 / 10

### 评分依据

实际运行产出了 3 个 canon 页面和完整的索引层级（顶层 `_index.md` + 领域 `_index.md`）。3 个页面全部可通过正文导航条目找到，无孤立页面。但存在一个结构性缺陷：领域 `_index.md` 的 `pages` frontmatter 字段在实际运行中为空列表（`pages: []`），导致依赖该字段的工具（如 lint L001、程序化导航）无法通过正确路径发现这些页面，形成"视觉上可导航但结构上不可索引"的不一致状态。compile spec 对 `pages` 字段的维护责任未作规定，属于 spec 级别的设计遗漏。

### 实际运行中做好的部分

- **首次创建领域的自动初始化正确执行**：compile 在处理第一个 `ai` 领域页面时自动创建了 `canon/domains/ai/_index.md`，并在顶层 `canon/_index.md` 的 `## 领域列表` 节追加了 `- [ai](domains/ai/_index.md)` 条目，与 compile spec Step 5 的规范完全一致
- **顶层索引准确列出全部领域**：`canon/_index.md` 中 `## 领域列表` 仅列出 `ai` 一个领域，与实际存在的唯一领域一致，无遗漏、无多余条目
- **领域索引正文条目覆盖全部页面**：`ai/_index.md` 正文中按分类列出了全部 3 个 canon 页面，分类区块创建正确（`## databases`、`## rag`、`## decisions`），无遗漏
- **零孤立页面**：`canon/domains/_placeholder.md` 是系统占位文件（`type: placeholder`），不属于 canon 页面，不计入孤立页面统计。3 个实际 canon 页面全部被 `ai/_index.md` 正文条目引用
- **分类区块首次创建逻辑正常**：三个 canon 页面分属 databases、rag、decisions 三个此前从未存在的分类，compile 均正确新建了对应区块并写入条目

### 实际发现的问题

- **[CRITICAL] `pages` frontmatter 字段始终为空列表**：`ai/_index.md` 的 frontmatter 中 `pages: []`，与正文中列出的 3 个页面不一致。lint L001（孤立页面检测）的规则原文为"该页面未被任何 `_index.md` 的 `pages` 列表引用"——若 lint 严格按此定义执行，则 3 个 canon 页面均会被判定为孤立页面（ERROR），尽管它们在正文中已被列出

- **[HIGH] compile spec 未明确 `pages` 字段的维护责任**：compile spec Step 5 只规定了对正文条目（`- [[slug]] — <title>`）的增删，完全未提及对 `pages` 字段的同步更新。这是 spec 的设计遗漏，导致实际执行时 `pages` 字段被初始化后永远保持空状态

- **[MEDIUM] L001 规则定义与实际导航机制存在歧义**：lint L001 的检测依据是 `pages` frontmatter 字段，但 compile 实际维护的导航结构是正文中的 `[[slug]]` 条目。两套机制不同步，造成"正文有、frontmatter 无"的矛盾状态，lint 的检测结果将是误报

### 具体证据

```yaml
# canon/domains/ai/_index.md 的 frontmatter（实际内容）
pages: []   # ← 空列表，与正文条目不符

# 同文件正文（实际内容）
## databases
- [[vector-db-comparison]] — 向量数据库选型对比：Pinecone vs Weaviate vs Milvus

## rag
- [[chunk-size-strategy]] — RAG Chunk Size 选择策略

## decisions
- [[finetuning-vs-rag]] — LLM 微调 vs RAG 选择决策框架
```

```markdown
# canon/_index.md 的 ## 领域列表节（实际内容）
- [ai](domains/ai/_index.md) — AI/机器学习相关知识，含向量数据库、RAG 系统、模型训练策略等
```

lint L001 的检测逻辑（来自 lint spec）：
> 触发条件：该页面未被任何 `_index.md` 的 `pages` 列表引用

若按此逻辑检测，`vector-db-comparison.md`、`chunk-size-strategy.md`、`finetuning-vs-rag.md` 三个页面均不在任何 `pages` 列表中，将被误报为孤立页面。

### 改进建议

1. **compile spec Step 5 应补充 `pages` 字段同步规则**：在 create action 写入正文条目的同时，将 slug 追加到 `pages` 列表；在 archive action 移除正文条目的同时，从 `pages` 列表中移除对应项
2. **lint L001 应双轨检测**：改为同时检查 `pages` frontmatter 字段和正文 `[[slug]]` 条目两个来源，任一包含则认为已被索引，避免因 `pages` 字段维护滞后产生误报
3. **补充 `pages` 字段的 schema 说明**：在 `canon-page.md` schema 或 `_index.md` 设计文档中明确 `pages` 字段的语义和维护责任，防止实现者忽略

---

## 属性4：知识关联准确性

### 评分：7 / 10

### 评分依据

实际运行中 3 个 canon 页面之间建立了有意义的 cross_refs 关联，关联均有语义依据（RAG chunk 策略与向量数据库选型是 RAG pipeline 的两个配套决策，微调 vs RAG 的决策直接影响是否使用向量数据库和 chunk 策略），未出现无关联凑数的情况。`[[slug]]` 扫描机制有效运作，正文中写入的 wiki link 均被正确提取到 frontmatter。主要问题是一对关联存在单向不一致：`vector-db-comparison` 与 `finetuning-vs-rag` 之间的引用不对称，属于轻微的双向性缺失。

### 实际运行中做好的部分

- **`[[slug]]` 扫描机制有效工作**：`finetuning-vs-rag.md` 正文中包含 `[[chunk-size-strategy]]` wiki link，该 slug 被正确提取到 frontmatter 的 `cross_refs` 字段。compile spec Step 4 的机制在实际运行中验证可用
- **关联均有明确语义依据**：三个页面分别对应向量数据库选型、RAG chunk 策略、微调 vs RAG 决策，构成一组完整的 RAG 系统设计决策链，相互关联具有真实的知识依赖关系
- **大部分关联已实现双向一致**：chunk-size-strategy ↔ finetuning-vs-rag 双向引用；chunk-size-strategy ↔ vector-db-comparison 双向引用，两对关联的双向性均得到保证
- **测试运行日志确认了 cross_refs 生成的主动设计**：`test-run-log.md` 第四节明确记录"3个 canon 页之间存在相互引用（chunk-size-strategy ↔ finetuning-vs-rag ↔ vector-db-comparison），已在 frontmatter cross_refs 中列出，正文中使用 [[slug]] 格式"，说明关联是有意设计的，非偶然产生

### 实际发现的问题

- **[HIGH] `vector-db-comparison` 与 `finetuning-vs-rag` 的引用存在单向缺失**：`finetuning-vs-rag.md` 的 `cross_refs` 包含 `vector-db-comparison`，但 `vector-db-comparison.md` 的 `cross_refs` 中没有 `finetuning-vs-rag`。两者确有语义关联（向量数据库是 RAG 方案的基础设施，微调 vs RAG 的决策直接决定是否需要部署向量数据库），缺失这对双向引用会导致从向量数据库页面出发时无法发现微调 vs RAG 决策页面

- **[HIGH] `cross_refs` 生成依赖正文 `[[slug]]` 的覆盖范围，遗漏了未被正文显式链接的关联**：`vector-db-comparison.md` 正文中未写入 `[[finetuning-vs-rag]]` wiki link，导致该关联无法被 compile Step 4 的扫描机制捕获。这是机制性限制：系统只能捕获作者已写出的关联，不能发现应写但未写的关联

- **[MEDIUM] `cross_refs` 字段不区分关联方向语义**：三个页面的 cross_refs 无法区分"A 依赖 B"（单向知识依赖）和"A 与 B 相关"（对称关联），下游查询无法从关联结构中推断知识依赖方向

### 具体证据

**实际 cross_refs 对比表**：

| 页面 | cross_refs（实际值） |
|------|-------------------|
| vector-db-comparison | `[chunk-size-strategy]` |
| chunk-size-strategy | `[vector-db-comparison, finetuning-vs-rag]` |
| finetuning-vs-rag | `[chunk-size-strategy, vector-db-comparison]` |

**缺失的双向引用**：

- `vector-db-comparison` → `finetuning-vs-rag`：缺失（finetuning-vs-rag 已引用 vector-db-comparison，但反向未建立）
- 语义依据：`finetuning-vs-rag.md` 中有"选项 B：RAG — 知识库超大，远超模型上下文窗口"，RAG 方案直接需要向量数据库，两者存在真实的架构依赖关系

**`[[slug]]` 扫描机制验证**：

`finetuning-vs-rag.md` 正文原文：
```
检索质量高度依赖 embedding 模型和 chunk 策略（参见 [[chunk-size-strategy]]）
```
对应 frontmatter：
```yaml
cross_refs:
  - chunk-size-strategy   # ← 正确提取
  - vector-db-comparison  # ← 手动写入（正文无对应 wiki link）
```

注意：`finetuning-vs-rag.md` 的 cross_refs 中 `vector-db-comparison` 是在没有对应正文 `[[slug]]` 的情况下出现的，说明作者手动写入了该 cross_ref，而非通过扫描机制生成——这既体现了作者对关联的主动维护，也暴露了 cross_refs 来源的不透明性（部分扫描生成、部分手动写入，难以区分）

### 改进建议

1. **在 compile Step 4 完成后，执行反向引用一致性检查**：对新创建或更新页面的每个 cross_ref 目标，检查目标页面是否已将当前页面 slug 列入其 cross_refs；若未列入，在 LOG 中记录 `WARN: missing back-ref [[当前slug]] in [[目标slug]]`，提示维护者补充
2. **新增 lint 规则 L0xx（反向引用缺失检测）**：L004 当前只检测引用目标不存在（断裂），可补充一条规则检测"A 引用 B 但 B 未引用 A"的单向关联情况，级别为 INFO，作为知识图谱完整性的可选提示
3. **区分 cross_refs 的两种来源**：在 frontmatter 中将扫描生成的引用（`[[slug]]` 自动提取）和手动写入的引用分开记录（如 `cross_refs_auto` 和 `cross_refs_manual`），提高来源透明度，便于后续维护
4. **对同领域页面在 compile 时做关联推荐**：每次 create 新页面时，扫描同领域已有页面的 title 和 tags，若有高度重叠则在 LOG 中提示"建议检查与 [[slug-X]] 的关联关系"，协助作者发现遗漏的 cross_refs
