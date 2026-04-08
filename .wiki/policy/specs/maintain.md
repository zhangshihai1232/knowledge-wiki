---
type: spec
name: maintain
autonomy: propose
triggers:
  - lint报告L007或多个L002
  - 人工指令
inputs:
  - lint报告
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

---

## When to Run

以下任一条件满足时触发本 spec：

| 触发条件 | 说明 |
|---|---|
| lint 报告出现 **L007**（领域溢出） | 某领域页面数超过 50，已超出可维护上限 |
| lint 报告出现 **≥3 条 L002**（陈旧页面） | 集中出现说明某领域整体失活，不宜逐页处理 |
| 人工明确下达维护指令 | 例如："请对 `ai-tools` 领域做一次全面清理" |

**不触发本 spec 的情形**：单页 L002（由 refresh spec 处理）、格式错误 L001（由 lint 自动修复）。

---

## 可执行的维护操作

### 1. 领域分裂（Lock 级别）

**触发**：某领域页面数 > 50（L007）。

**操作**：
- 按主题或时间维度将该领域拆分为 2 个或更多子领域
- 在原领域路径下保留过渡性 `_index.md`，内容仅含子领域导航链接
- 将各页面移动至对应子领域目录，更新所有 `cross_refs` 中指向原路径的引用
- 在 STATE.md 中新增子领域条目，删除或降级原领域条目

**约束**：
- 分裂方案须由人工明确批准（不可仅凭 AI 判断执行）
- 分裂后每个子领域页面数须 ≤ 50
- 禁止将单个页面拆分；分裂单位为领域（目录）

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

**操作**：
- 分析两领域的页面主题、关键词分布，输出重叠分析报告
- 提出合并方案：保留哪个领域名称、如何处理冲突页面、如何合并 `_index.md`
- 人工批准后：
  1. 将一个领域的全部页面移入另一领域目录
  2. 更新所有 `cross_refs` 中指向被合并领域的路径
  3. 删除空领域目录，在原路径保留一个重定向占位 `_index.md`（内容仅含"本领域已合并至 {target}"）
  4. 更新 STATE.md

**约束**：
- 需人工明确批准（不可仅凭 AI 相似度判断执行）
- 合并后须通过 quality gate 1（子领域 ≤ 50 页）验证
- 重定向占位 `_index.md` 保留至少 30 天后方可删除

---

## Steps

### Step 1：读取并分类 lint 报告

读取最新一份 lint 报告（通常位于 `STATE.md` 的 `lint_summary` 节或独立 `lint_report.md`），提取所有结构性问题条目。

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

---

### Step 2：生成维护计划

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

### Step 3：展示计划，等待确认

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

### Step 4：执行已批准操作

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

---

### Step 5：追加 LOG，输出执行摘要

所有操作完成后，在 STATE.md 的 `log` 节追加本次维护记录，并输出执行摘要。

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
