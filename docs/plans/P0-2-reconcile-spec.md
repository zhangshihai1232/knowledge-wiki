# P0-2：新增 reconcile.md — 冲突解决规范

## 背景

compile.md 在 Step 2 合并内容时若检测到事实矛盾，会在 canon 页插入 `<<<CONFLICT>>>` 标记并将 `confidence` 降为 `low`，但之后系统对冲突的处置完全空白：

- ingest.md 称"需人工判断"即止，无责任人、无 SLA、无流程定义
- change-proposal.md 的 `status` 枚举不包含冲突状态，冲突 proposal 永久停在 `inbox`
- 没有任何 spec 定义如何清除 `<<<CONFLICT>>>` 标记、如何恢复 `confidence`
- 系统因此无法"消化"冲突：canon 页带着冲突标记和 `confidence: low` 长期存在，知识库可信度持续降级

本方案新增第 7 个 spec（reconcile），并对 compile.md 和 change-proposal.md 做最小化修改，打通冲突解决闭环。

---

## 修改文件

- 新增 `.wiki/policy/specs/reconcile.md`
- 修改 `.wiki/policy/specs/compile.md`（在冲突检测规则末尾增加"将冲突 proposal 路由到 `changes/conflicts/` 并触发 reconcile"的指向）
- 修改 `.wiki/policy/schemas/change-proposal.md`（status 枚举增加 `conflict` 状态）

---

## reconcile.md 完整内容

```markdown
---
type: spec
name: reconcile
autonomy: semi-auto
triggers:
  - changes/conflicts/ 有新文件
inputs:
  - changes/conflicts/*.md
  - 对应 canon 页（含 <<<CONFLICT>>> 标记）
outputs:
  - 冲突已清除的 canon 页
  - resolve-conflict 类型 proposal（存入 changes/approved/）
  - 更新后的 LOG.md
---

## Purpose

裁决 compile 阶段检测到的事实冲突，生成最终裁决结果，并将 canon 页恢复到无冲突、confidence 准确的可信状态。

Reconcile spec 是冲突的终止点：每次执行后，`changes/conflicts/` 中对应的冲突 proposal 状态流转至 `resolved` 或 `deferred`，canon 页中的 `<<<CONFLICT>>>` 标记被清除，`confidence` 重新评估。

---

## 触发条件

当 `changes/conflicts/` 目录下出现新文件时触发。

触发条件的判定逻辑：

- 监测 `changes/conflicts/` 下所有 `.md` 文件
- 文件 frontmatter 中 `reconciled` 字段为空或为 `false` 时视为待裁决
- 同一次运行可批量处理多个待裁决文件，按文件创建时间升序执行

---

## Reconciler 角色定义

| 角色 | 说明 |
|------|------|
| **reconciler** | 负责执行裁决的人工审查者。由 wiki 维护者担任，或在有领域专家的情况下指定该领域专家。 |
| **system** | reconcile spec 的自动化部分，负责证据收集、标记清除、LOG 写入、confidence 重评估，但不自动裁决哪一方正确。 |

autonomy 为 `semi-auto`：证据收集和结果写入由 system 执行，裁决决策（Step 3）必须由 reconciler 完成。

---

## 决策准则

Reconciler 在裁决时依次按以下优先级判断：

1. **时间更近的 source 优先**：若两方证据的 source 文件创建时间或文档发布日期可考证，选择更新的一方作为正确内容。知识会随时间演化，最新来源更可能反映当前事实。

2. **authority 更高的 source 优先**：若两方证据来自不同权威等级的来源（如 peer-reviewed 论文 vs. 博客文章），选择 authority 更高的一方。Source 文件 frontmatter 中的 `authority` 字段（high / medium / low）为判断依据。

3. **无法判断时保留双方**：若无法通过上述两条准则裁决（来源时间相近、authority 相同或无法考证），则在 canon 页中保留双方内容，以并列形式呈现，并在该节添加注释说明分歧背景，`confidence` 标记为 `medium`。

---

## Steps

### Step 1：读取冲突 proposal，收集双方证据

读取 `changes/conflicts/` 中待裁决的 proposal 文件，提取以下字段：

```yaml
target_page:      # 冲突所在 canon 页路径
conflict_location: # 冲突在 canon 页中的节标题 + 行号（由 compile 写入）
existing_content:  # <<<CONFLICT>>> 块中的"现有内容"部分
proposed_content:  # <<<CONFLICT>>> 块中的"proposal 新内容"部分
trigger_source:    # 触发此 proposal 的 source 文件路径
```

同时读取：
- canon 页中完整的 `<<<CONFLICT>>>` 标记块，确认双方内容
- `trigger_source` 文件的 frontmatter（获取 `authority`、发布日期等元数据）
- canon 页现有内容对应的原始 source（从 canon 页 `sources` 字段中定位）

将上述信息整理为"证据摘要"，供 reconciler 审查。

---

### Step 2：呈现证据摘要，等待 reconciler 裁决

System 向 reconciler 呈现以下结构化信息：

```
冲突位置：{target_page} § {conflict_location}

【现有内容】
来源：{existing_source}
Authority：{existing_source.authority}
来源日期：{existing_source.date}
内容：{existing_content}

【Proposal 新内容】
来源：{trigger_source}
Authority：{trigger_source.authority}
来源日期：{trigger_source.date}
内容：{proposed_content}

决策准则参考：
- 时间更近的 source 优先
- authority 更高的 source 优先
- 无法判断时保留双方
```

Reconciler 基于上述信息做出以下三种裁决之一：

| 裁决 | 含义 |
|------|------|
| `keep_existing` | 保留现有内容，丢弃 proposal 新内容 |
| `keep_proposed` | 采纳 proposal 新内容，替换现有内容 |
| `keep_both` | 保留双方，并列呈现 |

**特殊情况**：若 reconciler 判断当前证据不足以裁决，可将状态标记为 `deferred`，记录所缺证据描述，跳过后续步骤，待补充证据后重新触发。

---

### Step 3：生成 resolve-conflict 类型 proposal

根据裁决结果，system 生成一个新的 proposal 文件，存入 `changes/approved/`（直接 approved，无需再经 promote 流程）：

```yaml
---
type: change-proposal
action: update
status: approved
target_page: "{target_page}"
trigger_source: "changes/conflicts/{冲突proposal文件名}"
confidence: "{根据裁决结果评估：keep_existing/keep_proposed → medium 或 high；keep_both → medium}"
proposed_at: "{今日日期}"
reviewed_by: "{reconciler 标识}"
reviewed_at: "{裁决时间 ISO 8601}"
compiled: false
compiled_at: ~
reconcile_verdict: "{keep_existing | keep_proposed | keep_both}"
---

## 提案摘要

裁决冲突：{target_page} § {conflict_location}，裁决结果：{verdict}。

## 变更内容

### 修改内容

{根据 verdict 生成的具体修改内容：
  - keep_existing：删除 <<<CONFLICT>>> 块，保留现有内容
  - keep_proposed：删除 <<<CONFLICT>>> 块，替换为 proposal 新内容
  - keep_both：删除 <<<CONFLICT>>> 块，将双方内容以并列形式写入，加注分歧说明}

### 新增内容

无

### 删除内容

{<<<CONFLICT>>> 标记块（已内联到修改内容中）}

## Source 证据

{裁决所依据的 source 引用}
```

---

### Step 4：触发 compile，清除冲突标记

将 Step 3 生成的 resolve-conflict proposal 写入 `changes/approved/` 后，正常触发 compile spec 执行：

- Compile 按 `update` action 处理该 proposal
- 将 canon 页中的 `<<<CONFLICT>>>` 标记块替换为裁决后的最终内容
- `<<<CONFLICT>>>` 标记完全清除后，canon 页恢复为合法格式

---

### Step 5：confidence 重评估

Compile 完成后，reconcile spec 对 canon 页的 `confidence` 执行重评估：

| 条件 | confidence 设置 |
|------|----------------|
| canon 页中已无任何 `<<<CONFLICT>>>` 标记 | 按 canon 页所有 source 的 authority 重新计算：全部 high → `high`；存在 medium → `medium`；存在 low → `low` |
| canon 页中仍有其他未解决的 `<<<CONFLICT>>>` 标记 | 保持 `low`，不调整 |
| 裁决为 `keep_both`（保留分歧） | 固定设为 `medium`，并在 frontmatter 中追加 `has_divergence: true` |

---

### Step 6：归档冲突 proposal，写入 LOG

**归档冲突 proposal**：在 `changes/conflicts/` 中对应文件的 frontmatter 更新：

```yaml
reconciled: true
reconciled_at: "{今日日期}"
reconcile_verdict: "{keep_existing | keep_proposed | keep_both | deferred}"
```

文件保留在 `changes/conflicts/`，不移动，以便审计。

**追加 reconcile 日志**：在 `changes/LOG.md` 末尾追加：

```markdown
## {YYYY-MM-DD} reconcile {冲突proposal文件名}

- target: {target_page}
- conflict_location: {节标题 + 行号}
- verdict: {keep_existing | keep_proposed | keep_both | deferred}
- reconciler: {reconciler 标识}
- confidence_after: {重评估后的 confidence 值}
- result: resolved | deferred
```

---

## Quality Gates

Reconcile 完成后执行以下检查，任一失败则在 LOG 中记录 `QUALITY_GATE_FAIL` 并通知 reconciler 介入：

**Gate 1：冲突标记已清除**

```
assert "<<<CONFLICT>>>" not in canon_page.content
```

检查 canon 页正文中不再包含 `<<<CONFLICT>>>` 字符串。若仍存在，说明 compile 步骤未正确执行。（crverdict=deferred 时跳过此 Gate）

**Gate 2：confidence 已重评估**

```
assert canon_page.frontmatter.confidence != "low" OR canon_page.has_remaining_conflicts()
```

检查 canon 页 `confidence` 不再为 `low`，除非页面中仍有其他未解决冲突。防止冲突清除后 confidence 遗留 low 状态。

**Gate 3：resolve-conflict proposal 已编译**

```
assert resolve_proposal.frontmatter.compiled == true
```

检查 Step 3 生成的 resolve-conflict proposal 的 `compiled` 字段已被 compile spec 更新为 `true`。
```

---

## compile.md 修改内容

在 `## 冲突检测规则` 节末尾（当前最后一行"compile spec 不自动裁决哪一方正确。"之后），追加以下内容：

```markdown
5. **路由冲突 proposal**：将触发此次冲突的 proposal 文件的 `status` 更新为 `conflict`，并将文件从当前目录移动到 `changes/conflicts/`，同时在 proposal frontmatter 中补写冲突位置信息：
   ```yaml
   status: conflict
   conflict_location: "<节标题> 第 <行号> 行"
   ```
   移动完成后，reconcile spec 将自动触发（因 `changes/conflicts/` 出现新文件）。
```

该修改将冲突检测与冲突解决流程打通，确保冲突 proposal 不再停留在 `inbox` 状态，而是进入有明确责任人和 SLA 的 reconcile 流程。

---

## change-proposal.md 修改内容

在 `status` 字段说明中，将枚举值从：

```
inbox | review | approved | rejected
```

扩展为：

```
inbox | review | approved | rejected | conflict
```

新增 `conflict` 状态的说明行：

| 字段 | 必填 | 说明 |
|------|------|------|
| status | 是 | 流转状态：inbox → review → approved/rejected；compile 检测到冲突时自动流转至 conflict，进入 reconcile 流程 |

同时在"状态流转"图中补充 conflict 分支：

```
inbox ──(promote: approve)──► approved ──(compile 处理)──► compiled: true
  │                                │
  │                                └──(compile 检测到冲突)──► conflict ──(reconcile 裁决)──► resolved
  │ promote: reject                                                       │
  ▼                                                                       └──► deferred（证据不足，待补充）
rejected ──(promote: reopen)──► inbox
```

---

## 验证方式

1. **单冲突裁决验证**：
   - 手动在 `changes/conflicts/` 下放置一个带冲突字段的 proposal
   - 执行 reconcile spec
   - 检查对应 canon 页中 `<<<CONFLICT>>>` 已清除
   - 检查 `confidence` 已从 `low` 恢复
   - 检查 `changes/LOG.md` 末尾有对应 reconcile 条目

2. **deferred 场景验证**：
   - reconciler 将裁决标记为 `deferred`
   - 检查 canon 页保持不变（`<<<CONFLICT>>>` 保留）
   - 检查 `confidence` 保持 `low`
   - 检查 LOG 记录 `result: deferred`

3. **keep_both 场景验证**：
   - reconciler 裁决为 `keep_both`
   - 检查 canon 页中双方内容并列存在，无 `<<<CONFLICT>>>` 标记
   - 检查 `confidence` 为 `medium`，frontmatter 含 `has_divergence: true`

4. **compile 集成验证**：
   - 构造一个会产生冲突的 proposal，执行 compile
   - 检查该 proposal 的 `status` 已变为 `conflict`
   - 检查文件已移动到 `changes/conflicts/`
   - 检查 reconcile spec 被触发
