---
type: spec
name: promote
autonomy: propose
triggers:
  - changes/inbox/有待处理提案
  - changes/review/有待处理提案
inputs:
  - changes/inbox/*.md
  - changes/review/*.md
outputs:
  - changes/approved/*.md
  - changes/rejected/*.md
quality_gates:
  - approved proposal 必须包含 reviewed_by 字段
  - rejected proposal 必须包含 rejection_reason 字段
---

## Purpose

将 `changes/inbox/` 中积累的提案推进到 `changes/approved/` 或 `changes/rejected/`，完成提案生命周期中唯一的强制人工审查点。

AI 负责汇总信息、呈现对比视图、给出建议，但最终 approve / reject / modify 决策必须由人类明确操作。任何自动化流程（包括 CI/CD、定时任务）均不得绕过本节点直接写入 canon 页。

---

## When to Run

满足以下任一条件时触发本 spec：

- `changes/inbox/` 目录下存在至少一个 `.md` 文件（新提案尚未进入审查）
- `changes/review/` 目录下存在至少一个 `.md` 文件（已进入审查但尚未做出决策）

---

## Steps

### Step 1：列出待审提案

扫描 `changes/inbox/` 和 `changes/review/` 目录，合并两个来源的文件列表，按 frontmatter 中的 `proposed_at` 字段升序排列（最早提案优先处理）。

以表格形式展示摘要，供人工快速总览：

| # | 文件路径 | target_page | action | proposed_at | 来源目录 |
|---|---------|-------------|--------|-------------|---------|
| 1 | changes/inbox/2026-04-01_foo.md | wiki/foo.md | update | 2026-04-01T10:23:00Z | inbox |
| 2 | changes/review/2026-04-02_bar.md | wiki/bar.md | create | 2026-04-02T08:00:00Z | review |

若两个目录均为空，输出"当前无待处理提案"并终止。

---

### Step 2：逐个审查

对表格中每个提案，依次展示以下四类信息，供人工判断：

**2a. proposed diff（变更内容）**

以 unified diff 格式展示提案希望对 target_page 做出的改动。若 action 为 `create`，则展示完整的待创建内容。

```diff
--- a/wiki/foo.md
+++ b/wiki/foo.md
@@ -12,3 +12,5 @@
 现有内容保持不变
-旧的描述文字
+更新后的描述文字
+新增的补充段落
```

**2b. 当前 canon 页内容（如存在）**

若 target_page 对应的 canon 文件已存在，展示其完整内容或关键相关段落（超过 300 行时截取前后各 20 行并注明省略）。若为 `create` 类型提案，注明"目标页面尚不存在"。

**2c. trigger_source / origin 对应的触发证据**

按 proposal frontmatter 中的 `origin` 和 `trigger_source` 字段展示触发依据：

- 若 `origin = ingest` 或 `manual`：从 `trigger_source` 指向的 `sources/...` 文件中展示原始证据段落（对话摘录、文档片段、观测日志等）
- 若 `origin = query-writeback`：展示 proposal 正文中的原始用户问题摘录、覆盖缺口说明、建议补充的知识主题
- 若 `origin = lint-patrol`：展示 proposal 正文中的触发指标快照、涉及页面列表、巡检结论与建议动作

目标是让审查者能回溯提案依据，判断证据是否充分可信；对于 system proposal，不要求伪造 source 段落。

**2d. AI 建议**

AI 从以下维度给出结构化建议，并明确表态支持或反对：

- **准确性**：proposed diff 是否与 trigger_source 一致，有无信息失真
- **完整性**：变更是否足够完整，有无遗漏关键细节
- **风险**：是否可能引入歧义、破坏现有关联页面、或与其他 canon 内容矛盾
- **最终建议**：`支持 approve` / `建议 reject` / `建议先 modify`，并附简短理由（1-2 句）

---

### Step 3：人工决策

审查者在查看完 Step 2 呈现的信息后，执行以下三种操作之一：

**操作 A：approve（批准）**

1. 在提案文件的 frontmatter 中补充以下字段（**先写字段，再移动文件**）：
   ```yaml
   reviewed_by: <审查者姓名或标识>
   reviewed_at: <ISO 8601 时间戳，例如 2026-04-08T14:30:00+08:00>
   approve_note: <批准理由，≥20字，说明为何认为此提案质量达标>
   status: approved
   ```
2. 将提案文件从 `changes/inbox/` 或 `changes/review/` **移动**到 `changes/approved/`，文件名保持不变。**移动**意为：在目标目录写入文件后，**删除源目录的原始文件**，确保同一提案不在两个目录同时存在。
3. 后续由下游执行 spec 消费 approved 提案：
   - 普通知识提案：由 `compile` spec 写入 canon
   - `origin=lint-patrol` 且 `target_page="_system/maintenance"` 的治理提案：由 `maintain` spec 消费并执行

**操作 B：reject（拒绝）**

1. 在提案文件的 frontmatter 中补充以下字段（**先写字段，再移动文件**）：
   ```yaml
   reviewed_by: <审查者姓名或标识>
   reviewed_at: <ISO 8601 时间戳>
   rejection_reason: <拒绝原因，说明提案存在的问题或不适合纳入的理由>
   status: rejected
   ```
2. 将提案文件从 `changes/inbox/` 或 `changes/review/` **移动**到 `changes/rejected/`，文件名保持不变。移动后删除源目录原始文件。
3. rejected 文件永久保留，作为决策记录，不得删除。可通过操作 D（reopen）重新提交。

**操作 D：reopen（重新开放）**

适用于已 rejected 的提案，在修正原始问题后重新进入审查流程。

1. 将提案文件从 `changes/rejected/` 移回 `changes/inbox/`，文件名保持不变。
2. 在提案文件的 frontmatter 中更新以下字段：
   ```yaml
   status: inbox
   reopen_reason: <说明本次重新提交的原因和修正内容>
   reopened_at: <ISO 8601 时间戳>
   ```
3. 清空 `reviewed_by`、`reviewed_at`、`rejection_reason` 字段（置为 `~`），重新等待审查。
4. 建议在 `## 变更内容` 节追加说明本次修正的具体改动，便于审查者对比。

**操作 C：modify（修改后重审）**

1. 提案文件保留在 `changes/review/` 目录（若来自 inbox 则先移动至 review）。
2. 审查者或 AI 直接编辑该文件，修正 proposed diff 内容或更新 trigger_source。
3. 修改完成后，该文件重新进入本 spec 的 Step 2 流程。
4. 在提案文件的 frontmatter 中追加：
   ```yaml
   modify_note: <说明本次修改原因和主要改动>
   modified_at: <ISO 8601 时间戳>
   ```

---

### Step 4：追加 LOG，更新 STATE.md

每次完成一批提案决策后，执行以下收尾操作：

**4a. 追加审查日志**

在 `changes/LOG.md` 末尾追加本次审查记录（若文件不存在则创建）：

```markdown
## 2026-04-08T14:30:00+08:00

- **审查者**：<reviewed_by>
- **处理数量**：approved 2，rejected 1，modify 1
- **明细**：
  - APPROVED: changes/approved/2026-04-01_foo.md（target: wiki/foo.md, action: update）
  - APPROVED: changes/approved/2026-04-02_bar.md（target: wiki/bar.md, action: create）
  - REJECTED: changes/rejected/2026-04-03_baz.md（原因：证据不足）
  - MODIFY: changes/review/2026-04-04_qux.md（修改后待重审）
```

**4b. 更新 STATE.md 的 pending_proposals 计数**

读取 `STATE.md`，将 `pending_proposals` 字段更新为当前 `changes/inbox/` 和 `changes/review/` 目录中剩余文件的总数，并同步维护 `consecutive_approve_count`：

```yaml
pending_proposals: 0   # inbox + review 目录剩余文件数之和
last_promote_at: 2026-04-08T14:30:00+08:00
consecutive_approve_count: 4   # 若本批次最后一次决策为 approve，则基于最近一次 reject 起连续累计；若最后一次为 reject，则重置为 0
```

---

## 升级规则（Lock 级别）

以下情况属于高风险操作，AI **不得自动执行**，必须由人工在本 spec 的 Step 3 中明确操作，并在 `rejection_reason` 或 `modify_note` 中留下说明：

| 情形 | 描述 | 要求 |
|------|------|------|
| **canon 页删除** | 提案的 action 为 `delete`，目标为已存在的 canon 页 | 审查者必须明确说明删除理由，并确认无其他页面引用该页 |
| **领域合并（domain merge）** | 提案将两个独立领域的 canon 页合并为一个，或重新划分领域边界 | 需评估所有受影响页面，审查者需提供迁移方案说明 |
| **重大改写（>50% 内容变更）** | proposed diff 导致目标页面超过 50% 的内容被替换或删除 | AI 必须在 Step 2d 中明确标注"重大改写警告"，审查者需在 reviewed_by 旁附加确认标记 `[MAJOR_REWRITE_CONFIRMED]` |

上述三类情形中，AI 若判断条件成立，**必须在 Step 2d 的建议中首行以大写标注**（如 `[LOCK: MAJOR_REWRITE]`），并建议暂缓直到审查者明确确认。

---

## Quality Gates

**Gate 1：approved 提案完整性检查**

在将文件移动到 `changes/approved/` 之前，验证以下字段均已填写：

- `reviewed_by`：非空字符串
- `reviewed_at`：符合 ISO 8601 格式的时间戳
- `approve_note`：非空字符串，长度 ≥ 20 字，且不得为以下占位符（大小写不敏感）：`同意`、`ok`、`approve`、`通过`、`yes`、`好的`、`确认`

若任一字段缺失或 `approve_note` 为占位符，提示审查者补充，**不得将不完整的提案写入 approved 目录**。

**Gate 1.2：system 生成的知识缺口提案来源检查**

若 proposal 满足以下条件：

- `origin = query-writeback`
- `target_page` **不**以 `_system/` 开头

则在将文件移动到 `changes/approved/` 之前，必须确认其已补充至少 1 个真实 `sources/...` 路径作为来源依据。若 `trigger_source` 仍为 `system:query-writeback`，说明该提案仍处于“知识缺口登记”阶段，**只能进入 modify/review，不得直接进入 approved 并交给 compile**。

**Gate 1.3：lint-patrol 治理提案路由检查**

若 proposal 满足以下条件：

- `origin = lint-patrol`
- `target_page = "_system/maintenance"`

则其 `approve_note` 中必须明确写明“交由 maintain 执行”的处理意图。此类 proposal 在 approve 后进入 `changes/approved/`，但**不进入 compile**，由 maintain spec 作为结构治理任务消费。

**Gate 1.5：连续 approve 预警**

在每次 approve 操作后，从最新决策向前回溯，直到遇到第一条 reject 为止，计算 `consecutive_approve_count`。若 `consecutive_approve_count >= 10`，则向审查者输出以下预警：

> ⚠️ **审查模式预警**：自最近一次 reject 以来已连续 approve 10 次及以上。请确认审查是否充分，避免形式化审查导致低质量知识进入 canon。

此预警不阻断操作，仅作为提醒。同时在 LOG 中记录 `[REVIEW-PATTERN] consecutive_approve_count=<当前值>`。

**Gate 2：rejected 提案原因检查**

在将文件移动到 `changes/rejected/` 之前，验证以下字段均已填写：

- `reviewed_by`：非空字符串
- `reviewed_at`：符合 ISO 8601 格式的时间戳
- `rejection_reason`：非空字符串，且不得为占位符（如"待填"、"TBD"、"todo"）

若 `rejection_reason` 为空或为占位符，拒绝移动文件并提示审查者填写实质性原因。

---

## 调用示例

**场景：审查一批 inbox 中的 proposal**

```
用户：inbox 里有 3 个提案，帮我准备审查材料

AI 执行：
1. 扫描 changes/inbox/，发现 3 个文件，按 proposed_at 排序
2. 展示摘要表格（3 行）
3. 逐个展示每个提案的 diff、canon 页现状、原始证据、AI 建议
4. 等待用户对每个提案给出 approve / reject / modify 指令

用户：第 1 个 approve，第 2 个 reject（理由：证据来源不可靠），第 3 个先 modify

AI 执行：
- 移动 inbox/2026-04-01_foo.md → approved/，补充 reviewed_by 和 reviewed_at
- 移动 inbox/2026-04-02_bar.md → rejected/，补充 reviewed_by、reviewed_at、rejection_reason
- 移动 inbox/2026-04-03_baz.md → review/，提示用户编辑后重新触发审查
- 追加 LOG.md 记录
- 更新 STATE.md：pending_proposals 从 3 → 1（review 目录剩余 1 个）
```
