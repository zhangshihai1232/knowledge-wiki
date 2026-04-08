# P1-3：审查负担控制

## 背景

LLM Wiki 系统中存在两个审查队列失控风险：

1. **ingest.md autonomy=auto**：每次摄入都可能生成提案，无质量预过滤、无去重机制，大量摄入时 `changes/inbox/` 快速膨胀，人工审查成本随提案数量线性增长。
2. **query.md write-back 触发条件模糊**："大量 canon 外推断"未量化，依赖 AI 自我判断，可能漏报（比例低时不触发）或误报（比例高但绝对数量少时过度触发）。

---

## 修改文件

- `.wiki/policy/specs/ingest.md`（提案质量预评分 + 去重机制）
- `.wiki/policy/specs/query.md`（量化 write-back 触发阈值）
- `.wiki/policy/schemas/change-proposal.md`（新增 `auto_quality_score` 字段）

---

## ingest.md 修改内容

### 1. 在 Step 4/5 之间增加质量预评分步骤

**锚点**：Step 4 末尾段落（`**分组原则**：多条声明若指向同一页面，合并为一个 proposal；分属不同页面则分别创建 proposal。`）与 Step 5 标题（`### Step 5：写入 proposal 到 \`.wiki/changes/inbox/\``）之间。

在两者之间插入以下内容：

---

```markdown
### Step 4.5：提案质量预评分

在写入 proposal 之前，对每个待生成的 proposal 计算 `auto_quality_score`（0–1 之间的浮点数），评分由以下三个维度加权得出：

| 维度 | 说明 | 权重 |
|------|------|------|
| **信息量**（informativeness） | 提案中包含的事实性声明数量与质量。≥3 条具体声明（含数值、因果、定义）得满分，0 条得 0 分，中间线性插值 | 0.4 |
| **与现有 canon 的差异度**（novelty） | 提案内容与 `target_page`（action=update 时）现有 canon 页面的内容重叠程度。全新内容得满分，完全重叠得 0 分。action=create 时，差异度默认为 1.0（全新页面） | 0.4 |
| **来源可信度**（source_authority） | 基于 source frontmatter 的 `source_kind` 字段估算：`reference` → 0.9，`article` → 0.7，`conversation` → 0.5，`note` → 0.4 | 0.2 |

**评分公式**：

```
auto_quality_score = informativeness × 0.4 + novelty × 0.4 + source_authority × 0.2
```

**路由规则**：

- `auto_quality_score ≥ 0.4`：正常写入 `changes/inbox/`，进入主审查队列
- `auto_quality_score < 0.4`：写入 `changes/low-quality/` 暂存区，**不进入**主审查队列；在 LOG.md 中记录但标注 `quality: low`

`changes/low-quality/` 中的提案不进入常规 review 流程，需人工决定是否提升（promote 到 inbox）或忽略。
```

---

### 2. 在 Step 4 增加去重检查

**锚点**：Step 4 正文中 `**分组原则**` 段落之前（即 `**命名建议路径规则（action: create 时）**` 段落之后）。

在命名建议路径规则段落之后、分组原则段落之前插入以下内容：

---

```markdown
**去重检查（在分组前执行）**：

对每个已确定 `target_page` 的 proposal，在正式分组和生成前，检查以下两个目录中是否已存在针对同一 `target_page` 的 pending 提案：

- `changes/inbox/`
- `changes/review/`

检查逻辑：扫描上述目录中所有 `.md` 文件的 frontmatter，比对 `target_page` 字段值是否与当前待生成 proposal 的 `target_page` 完全一致（字符串精确匹配）。

处理规则：

- **发现 pending 提案**：不创建新提案文件；将本次提取的新声明追加到现有提案的 `## Source 证据` 节末尾，并在 `## AI 建议` 节末尾追加一行：
  `> 📌 已合并来自 {trigger_source} 的 {N} 条新声明（{proposed_at}）`
  同时更新现有提案 frontmatter 中的 `trigger_source` 为最新 source 路径（或保留原值并在 AI 建议中注明多来源）。
- **未发现 pending 提案**：正常创建新提案文件。

去重检查结果记录到 Step 7 的 LOG 条目中，格式：`dedup: {merged/skipped/none}`。
```

---

## query.md 修改内容

**锚点**：Step 5 触发条件第 3 项原文：

```
- 用户问题答案存在大量 `[⚠️ canon 外推断]` 标注，说明 canon 覆盖度不足
```

将该行替换为：

```
- 用户问题答案中，`[⚠️ canon 外推断]` 标注的句子占所有事实性声明（定义、数据、因果关系、最佳实践）总数的比例 **> 25%**，说明 canon 覆盖度不足
```

**说明**：

- "事实性声明总数"的计数口径与 Gate 1 一致：定义、数据、因果关系、最佳实践类句子均计入；观点性、过渡性、连接性语句不计入。
- 比例计算时，分母为当次回答中所有带来源标注（`[来源: slug]`）和带推断标注（`[⚠️ canon 外推断]`）的句子之和；分子为带推断标注的句子数。
- 示例：回答包含 8 条事实性声明，其中 3 条带 `[⚠️ canon 外推断]`，比例 = 3/8 = 37.5% > 25%，触发 write-back。

---

## change-proposal.md 修改内容

**锚点**：frontmatter 示例块中 `confidence: medium` 字段所在行之后。

在 `confidence: medium` 行之后插入新字段：

```yaml
auto_quality_score: ~               # 可选，ingest spec 自动计算的提案质量分（0-1 浮点数）；query write-back 生成的提案填 ~
```

同时在字段说明表格中（`confidence` 行之后）新增一行：

| 字段 | 必填 | 说明 |
|------|------|------|
| auto_quality_score | 否 | ingest spec 自动计算的提案质量分，范围 0–1（浮点数）。< 0.4 的提案路由到 `changes/low-quality/`。query write-back 生成的提案此字段为空（`~`） |

---

## 验证方式

1. **质量预评分路由验证**：
   - 摄入一份内容与现有 canon 高度重叠的 source（例如将某 canon 页面内容重新摄入）
   - 预期：`novelty` 接近 0，`auto_quality_score < 0.4`，提案写入 `changes/low-quality/` 而非 `changes/inbox/`

2. **去重机制验证**：
   - 连续两次摄入针对同一 canon 页面的不同 source
   - 预期：第二次不创建新提案文件，而是将新声明追加到第一次生成的提案中，`dedup: merged` 记录在 LOG

3. **write-back 量化阈值验证**：
   - 构造一个 canon 覆盖度为零的问题（答案全部为 `[⚠️ canon 外推断]`），比例 = 100% > 25%，预期触发 write-back
   - 构造一个仅 1/8 声明为推断的问题，比例 = 12.5% < 25%，预期不触发 write-back

4. **字段完整性验证**：
   - 检查 ingest 生成的新提案 frontmatter 中 `auto_quality_score` 字段存在且为合法浮点数或 `~`
