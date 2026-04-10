---
type: spec
name: maintain
autonomy: propose
triggers:
  - lint报告L007或多个L002
  - changes/approved/ 中出现 `origin=lint-patrol` 的治理提案
  - 人工指令
inputs:
  - lint报告
  - changes/approved/*.md（仅 `origin=lint-patrol` 或 `target_page="_system/maintenance"`）
  - canon/**/*.md
  - STATE.md
outputs:
  - 维护计划
  - 执行结果
  - 更新后的STATE.md
quality_gates:
  - 分裂后每子领域≤50页
  - 归档页面status=archived
  - MOC重组后所有页面可导航
---

## Purpose

执行影响面大的结构性维护，确保 wiki 可持续扩展。

本 spec 专注于处理 lint 报告中无法由单次写作操作自动修复的结构性问题——例如领域规模失控、大量内容陈旧、跨领域引用腐化等。这类操作会影响多个页面乃至整个领域的组织方式，因此默认自主级别为 **Propose**，部分高风险操作为 **Lock**（需人工明确批准方可执行）。

此外，本 spec 也是 `origin=lint-patrol` 治理提案的**正式下游执行器**：这类 proposal 经 promote 批准后进入 `changes/approved/`，由 maintain 消费，而不是交给 compile。

---

## When to Run

以下任一条件满足时触发本 spec：

| 触发条件 | 说明 |
|---|---|
| lint 报告出现 **L007**（领域溢出） | 某领域页面数超过 50，已超出可维护上限 |
| lint 报告出现 **≥3 条 L002**（陈旧页面） | 集中出现说明某领域整体失活，不宜逐页处理 |
| `changes/approved/` 中出现 `origin=lint-patrol` 的 proposal | 表示 lint 已将治理问题汇总成维护提案，并经 promote 批准，需要正式执行 |
| `wiki maintain --json` 报告 `unclassified_pages > 0` | 存在缺失 subtype 的页面，需批量补充分类 |
| `wiki taxonomy suggestions` 中出现 deprecated domain/subtype 的替换建议 | taxonomy 已演进，存量页面需通过迁移同步到新分类谱系 |
| 人工明确下达维护指令 | 例如："请对 `ai-tools` 领域做一次全面清理" |

**不触发本 spec 的情形**：单页 L002（由 refresh spec 处理）、格式错误 L001（由 lint 自动修复）。

---

## 可执行的维护操作

### 1. 领域分裂（Lock 级别）

**触发**：某领域页面数 > 50（L007）。

**操作（通过 migration 工作流执行）**：

领域分裂必须通过 `wiki migrate` 工作流完成，**禁止直接调用 `wiki internal` 移动文件**，以确保 dry-run 预览、reclassify collision 检测和 rollback 能力完整可用。

```bash
# 1. 生成迁移计划（对每个目标子域分别创建一个计划）
wiki migrate plan \
  --op reclassify \
  --scope "domain-split: {old-domain} → {sub-a}" \
  --from domain={old-domain} subtype={主题A关键词} \
  --to domain={sub-a} \
  --reason "L007: 页面数超过50上限，按主题拆分" \
  --json
# 记录返回的 PLAN_ID

# 2. 预演（必须先于 apply，不修改任何文件）
wiki migrate dry-run PLAN_ID --json
# 检查 affected_pages 列表与预期是否一致；若有误则修改 from 过滤条件后重新 dry-run

# 3. 人工批准后执行
wiki migrate apply PLAN_ID --json
# 若返回 reclassify collision 错误：先解决冲突页面，再重试 apply

# 4. 对 subtype_is_null 的剩余未分类页面单独创建计划，或手动逐一处理
wiki migrate plan \
  --op reclassify \
  --scope "domain-split: {old-domain} unclassified remainder" \
  --from domain={old-domain} subtype_is_null=true \
  --to domain={sub-b} \
  --json

# 5. 完成后 MOC 重组
wiki internal update-index --domain {sub-a} --sync
wiki internal update-index --domain {sub-b} --sync

# 6. 若需全部回滚
wiki migrate rollback PLAN_ID --json
```

**约束**：
- 分裂方案须由人工明确批准（不可仅凭 AI 判断执行）
- 分裂后每个子领域页面数须 ≤ 50
- 禁止将单个页面拆分；分裂单位为领域（目录）
- `reclassify collision` 错误表示目标路径已有同名页面 — 须先处理冲突（合并或重命名），再重试 apply

**风险**：路径变更会导致外部链接失效；执行前须确认是否存在 wiki 外部的引用。

---

### 2. 内容归档（Propose 级别）

**触发**：页面 `staleness` > 180 天且无近期引用。

**操作**：
- 将目标页面 frontmatter 中的 `status` 字段改为 `archived`
- 在页面顶部追加归档说明块：`> 本页已归档，最后活跃于 {last_updated}，如需恢复请更新内容并移除 archived 状态。`
- 从对应领域的 `_index.md` 导航列表中移除该页面条目（归档页面不出现在 MOC 正文中）
- 在 STATE.md 中将该页面的 `status` 更新为 `archived`

**约束**：
- 需展示归档候选列表，由人工批量确认后执行
- 禁止归档 `status: pinned` 的页面
- 归档不等于删除，文件保留在原路径

---

### 3. MOC 重组（Auto 级别）

**触发**：领域分裂或大规模归档完成后。

**操作**：
- 重新生成受影响领域的 `_index.md`，确保：
  - 所有 `status: active` 页面均出现在导航列表中
  - 所有 `status: archived` 页面不出现在导航列表正文（可在"归档"折叠节中列出）
  - 子领域有独立的分组标题
- 检查 `_index.md` 中是否存在指向不存在文件的链接，若有则清除

**约束**：
- 本操作为 Auto 级别，可在 Propose/Lock 操作批准后自动跟随执行
- 执行后须通过 quality gate 3（所有页面可导航）验证

---

### 4. Source 清理（Propose 级别）

**触发**：某 `source` 目录下的文件长期（> 90 天）未被任何 canon 页面引用。

**操作**：
- 扫描 `source/**` 中所有文件，统计每个文件被 `canon/**` 引用的次数
- 对引用次数为 0 且超过 90 天未更新的 source 文件，标记为"归档候选"
- 生成候选列表，展示给人工确认
- 确认后将目标 source 文件移动至 `source/_archived/` 目录

**约束**：
- 需人工批量确认后执行
- 禁止删除 source 文件，仅移动至归档目录

---

### 5. Cross-ref 修复（Auto 级别）

**触发**：lint 报告中出现无效 `cross_refs`（引用路径不存在或已归档）。

**操作**：
- 对每条无效引用，按以下优先级处理：
  1. 若目标页面已移动（领域分裂导致），更新引用路径为新路径
  2. 若目标页面已归档，在引用处追加注释 `# [已归档]`，保留引用但不渲染为活跃链接
  3. 若目标页面已删除，直接移除该 `cross_refs` 条目
- 记录所有修改到执行摘要

**约束**：
- 本操作为 Auto 级别，但若涉及路径更新超过 20 条，须降级为 Propose 并请求人工确认
- 禁止自动新增 cross_refs（仅修复已有的无效引用）

---

### 6. 领域合并（Lock 级别）

**触发**：两个领域内容高度重叠（AI 判断相似度 > 70%，或人工指令明确指出）。

**操作（通过 migration 工作流执行）**：

```bash
# 1. 将被合并域所有页面迁移到目标域
wiki migrate plan \
  --op reclassify \
  --scope "domain-merge: {source-domain} → {target-domain}" \
  --from domain={source-domain} \
  --to domain={target-domain} \
  --reason "域合并：{source-domain} 与 {target-domain} 内容高度重叠" \
  --json

# 2. 预演确认
wiki migrate dry-run PLAN_ID --json

# 3. 人工批准后执行
wiki migrate apply PLAN_ID --json

# 4. 废弃原域名（记录迁移谱系）
wiki taxonomy deprecate domain {source-domain} --replaced-by {target-domain} --json
```

**约束**：
- 需人工明确批准（不可仅凭 AI 相似度判断执行）
- 合并后须通过 quality gate 1（子领域 ≤ 50 页）验证
- 执行 `taxonomy deprecate` 后，`replaced_by` 将以数组形式保存；`normalizeClassification` 检测到废弃域时会自动建议替换值

---

### 7. 未分类页面批量修复（Propose 级别）

**触发**：`wiki maintain --json` 报告 `unclassified_pages` 不为零，或人工请求。

**操作**：

```bash
# 1. 找出某域下所有未分配 subtype 的页面
wiki migrate plan \
  --op reclassify \
  --scope "fix-unclassified: {domain}" \
  --from domain={domain} subtype_is_null=true \
  --to domain={domain} subtype={target-subtype} \
  --reason "补充缺失 subtype" \
  --json

# 2. 预演确认
wiki migrate dry-run PLAN_ID --json

# 3. 批量修复
wiki migrate apply PLAN_ID --json
```

**约束**：对不同主题的未分类页面分批处理；每批对应单一 subtype 值，不得一次性套用同一个 subtype 给语义差异较大的页面集合

---

## 步骤责任标记说明

每个步骤标题带有执行责任标记：

| 标记 | 含义 | 执行者 |
|------|------|--------|
| 🧠 | 语义推理步骤 | LLM（Skill 层） |
| ⚙️ | 确定性操作步骤 | CLI（优先 `wiki maintain`，必要时才落到 `wiki internal`） |
| 🤝 | 人机交互步骤 | 人工决策，LLM 辅助 |

⚙️ 步骤中的文件操作**必须**通过 CLI 命令执行，不得由 LLM 直接操作文件系统。维护场景优先使用 `wiki maintain` 获取结构化输入。

## Steps

### Step 1 🧠⚙️：读取触发来源并分类问题

优先检查 `changes/approved/` 中是否存在满足以下条件的治理提案：

- `origin = lint-patrol`
- 或 `target_page = "_system/maintenance"`
- 且 `compiled = false`

若存在，则读取 proposal 正文中的触发指标、受影响页面列表、建议动作，将其视为本次维护的主输入；同时补充读取最新 lint 报告作为上下文验证。

若不存在上述治理提案，则读取最新一份 lint 报告（通常位于 `STATE.md` 的 `lint_summary` 节或独立 `lint_report.md`），提取所有结构性问题条目。

按以下两个维度分组：

**按严重级别**：
- Critical（L007 领域溢出、大规模 cross_ref 断链）
- High（≥3 条 L002 集中在同一领域）
- Medium（source 无引用、单领域 MOC 失效）

**按操作类型**：
- 领域类（分裂、合并）
- 页面类（归档、cross_ref 修复）
- 结构类（MOC 重组、source 清理）

输出分组摘要，格式示例：

```
[Critical] L007 - ai-tools 领域：62 页（建议：领域分裂）
[High]     L002 ×5 - legacy-tools 领域：5 页陈旧超 180 天（建议：内容归档）
[Medium]   Source 无引用：3 个文件超 90 天（建议：source 清理）
```

**CLI 辅助**：

优先使用高层 workflow contract：

```bash
wiki maintain --json
```

该命令默认返回 counts、findings、decays（可选），LLM 在进入维护规划前即可得到已缩圈的结构化输入。

**备选（仅在 `wiki maintain` 不可用或需要单项查询时）**：

```bash
# 获取系统统计
wiki internal count all

# 执行结构性扫描
wiki internal scan --format json

# 读取治理提案 frontmatter
wiki internal frontmatter get changes/approved/2026-04-08-maintain-staleness-refresh.md origin
```

---

### Step 2 🧠：生成维护计划

对每组问题生成具体操作项，每条操作项包含：

| 字段 | 说明 |
|---|---|
| 操作类型 | 分裂 / 归档 / MOC重组 / Source清理 / Cross-ref修复 / 合并 |
| 目标对象 | 受影响的领域名或页面路径列表 |
| 影响范围 | 受影响页面数（直接 + 间接） |
| 自主级别 | Auto / Propose / Lock |
| 执行条件 | 触发本操作的具体 lint 条目 |
| 预期结果 | 执行后 lint 报告对应条目应消失 |

示例计划条目：

```
操作：领域分裂
目标：canon/ai-tools/（62页）
影响范围：直接62页，间接涉及其他领域的cross_refs约18处
自主级别：Lock（需人工明确批准）
执行条件：L007 - ai-tools 页面数=62 > 50
预期结果：L007消除，ai-tools拆为 ai-tools/writing/ 和 ai-tools/coding/ 各≤50页
```

---

### Step 3 🤝：展示计划，等待确认

将完整维护计划以结构化形式展示给人工，并按自主级别说明确认要求：

```
=== 维护计划（共 N 项操作）===

【Lock 级别 - 需逐条明确批准】
1. 领域分裂：ai-tools → ai-tools/writing + ai-tools/coding
   影响：62页直接 + 18处cross_ref
   请回复"批准操作1"或"拒绝操作1 + 原因"

【Propose 级别 - 可批量确认】
2. 内容归档：legacy-tools 下 5 个陈旧页面（列表见下）
3. Source 清理：3 个无引用 source 文件（列表见下）
   请回复"批准操作2-3"或逐条说明

【Auto 级别 - 批准 Lock/Propose 后自动执行】
4. MOC 重组：ai-tools/_index.md（分裂完成后自动执行）
5. Cross-ref 修复：18处无效引用（分裂完成后自动更新）
```

**等待规则**：
- Lock 级别：收到明确"批准操作N"指令前，不执行任何操作
- Propose 级别：可批量确认；若人工无回应超过对话轮次限制，不自动执行
- Auto 级别：其所依赖的上级操作批准并完成后自动执行，无需单独确认

---

### Step 4 ⚙️🧠：执行已批准操作

按批准顺序依次执行，每完成一项操作后立即更新 STATE.md：

**STATE.md 更新格式**：
```yaml
maintenance_log:
  - timestamp: "YYYY-MM-DD HH:MM"
    operation: "领域分裂"
    target: "canon/ai-tools/"
    result: "completed"
    details: "拆为 ai-tools/writing（28页）和 ai-tools/coding（34页）"
    approved_by: "human"
```

**执行顺序原则**：
1. Lock 操作须等待对应批准，不可乱序
2. Auto 操作（MOC 重组、cross-ref 修复）紧跟其触发操作之后执行
3. 若某操作执行失败（如文件冲突），立即暂停并报告，不继续执行后续操作

**CLI 执行（维护子操作）**：

> 说明：操作类型不同，使用不同的 CLI 工具：
> - **领域分裂/合并/重分类** → `wiki migrate`（已在操作章节 1/6/7 详述）
> - **内容归档** → `wiki internal frontmatter set`（不涉及路径变更，无需 migrate）
> - **MOC 重组** → `wiki internal update-index`

```bash
# 内容归档：仅更新 frontmatter（不移动文件，不需要 wiki migrate）
wiki internal frontmatter set canon/domains/legacy-tools/tool-A.md status "archived"
wiki internal frontmatter set canon/domains/legacy-tools/tool-A.md archived_at "2026-04-09"

# MOC 重组：从索引移除归档页面
wiki internal update-index --domain legacy-tools --sync

# 标记治理提案为已消费
wiki internal mark-compiled changes/approved/2026-04-08-maintain-staleness-refresh.md
```

> **LLM 职责**：领域分裂方案设计（确定拆分边界、页面归属）、领域合并的重叠分析、内容归档候选评估。  
> **CLI 职责边界**：凡涉及文件路径变更的操作（分裂/合并/迁移），必须走 `wiki migrate` 工作流以获得 dry-run、collision 检测和 rollback 能力；仅修改 frontmatter 字段而不改变路径的操作（归档、标记等）可直接用 `wiki internal frontmatter set`。

---

### Step 5 ⚙️：追加 LOG，输出执行摘要

所有操作完成后，在 STATE.md 的 `log` 节追加本次维护记录，并输出执行摘要。

若本次维护由 approved 的 `lint-patrol` proposal 触发，则还需回写该 proposal：

```yaml
compiled: true
compiled_at: <ISO 8601 时间戳>
```

并在 `changes/LOG.md` 中追加一条消费记录：

```markdown
- [YYYY-MM-DD] [maintain] consumed approved maintenance proposal: {filename}
```

**摘要格式**：

```
=== 维护执行摘要 ===
执行时间：YYYY-MM-DD
触发原因：L007（ai-tools 62页）+ L002×5（legacy-tools）

已执行操作（N项）：
✓ 领域分裂：ai-tools → writing（28页）+ coding（34页）
✓ 内容归档：5页（legacy-tools/tool-A.md 等）
✓ MOC 重组：ai-tools/_index.md、legacy-tools/_index.md
✓ Cross-ref 修复：18处路径更新

未执行操作（M项）：
✗ Source 清理：人工拒绝（"这些source后续可能使用"）

Quality Gates 检查：
✓ 分裂后每子领域 ≤ 50页（writing=28, coding=34）
✓ 归档页面 status=archived（5页均已更新）
✓ MOC重组后所有页面可导航（验证通过，0条无效链接）

STATE.md 已更新。
```

**CLI 执行**：

```bash
wiki internal append-log --spec maintain \
  --message "操作: 内容归档 | 目标: legacy-tools/5页 | 结果: completed"
wiki internal update-state
```

---

## Quality Gates

本 spec 有以下 3 个检查点，所有检查须在输出执行摘要前通过：

| 检查点 | 验证方式 | 不通过时的处理 |
|---|---|---|
| **分裂后每子领域 ≤ 50 页** | 统计分裂后各子领域目录下 `.md` 文件数 | 重新调整分裂边界，不得在未满足此条件时标记操作为完成 |
| **归档页面 status=archived** | 读取每个归档目标页面的 frontmatter，确认 `status` 字段值 | 重新写入 frontmatter，不得跳过 |
| **MOC 重组后所有页面可导航** | 遍历受影响领域的 `_index.md`，确认每个 active 页面均出现在导航中，且所有链接路径有效 | 补充缺失条目或修复无效路径，直至验证通过 |

---

## 调用示例

**场景**：`ai-tools` 领域触发 L007（当前 62 页，超出 50 页上限）。

**第一轮（Step 1-2，生成计划）**：

```
用户：最新 lint 报告显示 ai-tools 领域有 L007，请处理。

AI：已读取 lint 报告，分析如下：

[Critical] L007 - canon/ai-tools/：当前 62 页 > 50 页上限

分析页面主题分布：
- 写作辅助类：28 页（prompt-writing, copyedit, outline 等）
- 编码辅助类：30 页（code-review, refactor, test-gen 等）
- 通用工具类：4 页（overview, glossary, faq, changelog）

建议分裂方案：
- canon/ai-tools/writing/（28 页，写作辅助类）
- canon/ai-tools/coding/（30 页，编码辅助类）
- 通用工具类 4 页保留在 canon/ai-tools/（作为入口层）

维护计划：

【Lock - 需明确批准】
操作1：领域分裂 ai-tools → writing + coding
  影响：62页直接 + 约 23 处 cross_refs 需更新
  请回复"批准操作1"确认，或提出调整意见。

【Auto - 操作1完成后自动执行】
操作2：MOC 重组（ai-tools/_index.md + 两个子领域 _index.md）
操作3：Cross-ref 修复（23 处路径更新）
```

**第二轮（Step 3，等待确认）**：

```
用户：批准操作1，但 writing 目录名改为 ai-writing。

AI：已记录，将分裂为：
- canon/ai-tools/ai-writing/（28 页）
- canon/ai-tools/coding/（30 页）
开始执行……
```

**第三轮（Step 4-5，执行并汇报）**：

```
AI：执行完成。

=== 维护执行摘要 ===
执行时间：2026-04-08
触发原因：L007（ai-tools 62页）

已执行操作（3项）：
✓ 领域分裂：ai-tools → ai-writing（28页）+ coding（30页）+ 入口层（4页）
✓ MOC 重组：ai-tools/_index.md、ai-writing/_index.md、coding/_index.md
✓ Cross-ref 修复：23 处路径更新

Quality Gates：
✓ 分裂后每子领域 ≤ 50页（ai-writing=28, coding=30, 入口层=4）
✓ MOC重组后所有页面可导航（验证通过，0条无效链接）

STATE.md 已更新。
```
