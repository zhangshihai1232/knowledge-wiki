---
type: spec
name: lint
autonomy: auto
triggers:
  - 定期运行（建议每日一次）
  - 手动触发（运行 /lint 命令）
  - compile 完成后局部触发（仅检查受影响页面）
inputs:
  - canon/**/*.md
  - sources/**/*.md
  - changes/**/*.md
outputs:
  - 健康报告（按严重级别排序的问题列表，含健康分数）
  - 可选的自动修复（L001 更新 _index.md，L009 创建缺失 _index.md）
quality_gates:
  - 报告覆盖所有已定义规则（L001–L011）的检查结果
  - 每个发现条目必须包含：规则 ID、文件路径、严重级别、具体说明、建议动作
---

## Purpose

对整个 wiki 执行全面健康检查，发现结构性问题、过期内容、引用断裂、元数据异常等。
Lint 不修改 canon 内容本身，只报告问题并在有限范围内执行安全的结构性自动修复。
目标是让 wiki 始终处于可信、可导航、内部一致的状态。

---

## When to Run

| 触发方式 | 范围 | 说明 |
|---|---|---|
| 定期运行 | 全量 | 每日凌晨或低峰期，扫描所有 canon/sources/changes |
| 手动触发 | 全量或指定域 | 运行 `/lint` 或 `/lint domain:ai` |
| compile 后局部触发 | 受影响页面 | compile 完成后自动检查被修改的页面及其引用方 |

局部触发时，L001（孤页）和 L007（域溢出）跳过，仅检查与本次变更直接相关的规则。

---

## 步骤责任标记说明

每个步骤标题带有执行责任标记：

| 标记 | 含义 | 执行者 |
|------|------|--------|
| 🧠 | 语义推理步骤 | LLM（Skill 层） |
| ⚙️ | 确定性操作步骤 | CLI（`wiki-ops` 工具） |
| 🤝 | 人机交互步骤 | 人工决策，LLM 辅助 |

⚙️ 步骤中的文件操作**必须**通过 `wiki-ops` CLI 命令执行，不得由 LLM 直接操作文件系统。

**重要**：lint 规则中 L001–L005、L007–L011 均为确定性结构检查（⚙️），仅 L006 跨页矛盾检测需要语义理解（🧠）。`wiki-ops scan` 命令可执行所有结构性规则，LLM 仅需补充 L006 的语义分析。

## Lint 规则

### L001 orphan-page — 孤立页面

- **检查对象**：canon/ 下所有非 `_index.md` 的页面
- **触发条件**：该页面未被任何 `_index.md` 的 `pages` 列表引用
- **严重级别**：WARNING
- **说明**：孤立页面无法通过正常导航访问，可能是遗漏录入或被遗弃的草稿
- **建议动作**：将页面加入对应域的 `_index.md`，或确认后删除

---

### L002 stale-page — 过期页面

- **检查对象**：canon/ 下所有页面的 frontmatter `staleness_days` 字段
- **触发条件**：`effective_staleness_days > 90`（lint 运行时动态计算：今日日期 - `last_updated`；若 `last_updated` 缺失则回退使用 frontmatter 中的 `staleness_days` 静态值）
- **严重级别**：WARNING
- **说明**：页面长时间未更新，内容可能已不再准确，需要人工复核或重新 compile
- **建议动作**：触发针对该页面的 compile，或由维护者确认内容仍然有效并重置 `staleness_days`；如 lint 报告中 L002 条目为 1-2 条，参见 refresh spec

---

### L003 no-source — 缺少来源

- **检查对象**：canon/ 下所有页面的 frontmatter `sources` 字段
- **触发条件**：`sources` 字段为空列表（`[]`）或字段缺失
- **严重级别**：ERROR
- **说明**：canon 页面必须可追溯到原始资料，无来源的页面无法验证可信度
- **建议动作**：补充对应的 sources/ 文件路径，或标注来源为人工录入并说明依据

---

### L004 broken-ref — 断裂引用

- **检查对象**：canon/ 下所有页面 frontmatter 的 `cross_refs` 字段
- **触发条件**：`cross_refs` 中列出的页面路径在 wiki 中不存在
- **严重级别**：ERROR
- **说明**：引用了不存在的页面，会导致读者或 LLM 上下文检索失败
- **建议动作**：修正路径拼写，或创建被引用页面，或移除已失效引用

---

### L005 low-confidence — 低置信度超期

- **检查对象**：canon/ 下 frontmatter `confidence=low` 的页面
- **触发条件**：`confidence=low` 且 `effective_staleness_days > 30`（lint 运行时动态计算，同 L002）
- **严重级别**：WARNING
- **说明**：低置信度页面本应是临时状态，长期未提升说明可能被遗忘或来源不足，此类页面内容可信度存疑，不应在知识检索中被优先引用
- **建议动作**：自动在 `changes/inbox/` 目录下生成 confidence-review 任务文件（命名格式：`{today}-confidence-review-{slug}.md`），任务文件包含页面路径、当前 staleness_days、现有 sources 列表，提示维护者补充权威来源后重新 compile

---

### L006 contradiction — 内容矛盾

- **检查对象**：canon/ 下所有页面正文
- **触发条件**：页面正文中包含 `<<<CONFLICT>>>` 标记，或两个 canon 页面对同一事实（相同实体 + 相同属性）表述不一致
- **严重级别**：WARNING
- **说明**：矛盾内容会降低 wiki 可信度，LLM 读取矛盾事实可能产生不一致输出
- **建议动作**：触发 reconcile 流程，确定权威来源后统一表述，清除 `<<<CONFLICT>>>` 标记

---

### L007 domain-overflow — 领域页面过多

- **检查对象**：canon/domains/ 下每个子域的页面数量
- **触发条件**：某一领域目录下页面总数 > 50
- **严重级别**：INFO
- **说明**：单一领域页面过多会导致导航困难，索引文件膨胀，建议拆分为子域
- **建议动作**：规划子域拆分方案，创建子目录 `_index.md` 并迁移相关页面

---

### L008 stale-proposal — 超期提案

- **检查对象**：`changes/inbox/` 与 `changes/review/` 下所有提案文件
- **触发条件**：读取 frontmatter 中的 `proposed_at` 与 `origin` 字段，若提案仍位于 `inbox` / `review` 且超过以下阈值则触发：
  - 默认阈值：7 天
  - `origin = query-writeback`：14 天（给知识补全留出补 source 的缓冲期）
- **严重级别**：WARNING
- **说明**：长期积压的提案说明 triage 流程停滞，可能造成知识更新延迟
- **建议动作**：处理或拒绝超期提案，如无人处理则上报 wiki 维护者

---

### L009 missing-index — 缺少目录索引

- **检查对象**：canon/domains/ 下所有领域子目录
- **触发条件**：子目录下不存在 `_index.md` 文件
- **严重级别**：ERROR
- **说明**：缺少 `_index.md` 会导致该域无法被正常导航和索引，域内页面全部变为孤立页面
- **建议动作**：自动创建最小化 `_index.md`（包含 type、domain、pages 字段），或由维护者补充

---

### L011 consecutive-approve — 连续批准率异常

- **检查对象**：`changes/approved/` 和 `changes/rejected/` 形成的最近审查决策序列
- **触发条件**：从最新决策向前回溯，直到遇到第一条 reject 为止，连续 approve 次数 `consecutive_approve_count >= 10`
- **严重级别**：WARNING
- **说明**：审查拒绝率过低可能意味着 promote 环节沦为形式审查，无法有效拦截低质量知识进入 canon
- **建议动作**：建议审查者回顾近期 approved 提案的质量，必要时对可疑提案执行 reopen + reject

---

### L010 type-path-mismatch — 类型与路径不匹配

- **检查对象**：wiki 下所有 .md 文件的 frontmatter `type` 字段与文件所在目录路径
- **触发条件**：`type` 值与文件实际所在目录不符（例如 `type: source` 的文件位于 canon/ 下）
- **严重级别**：WARNING
- **说明**：类型与路径不一致会导致路由逻辑、检索过滤等功能出错
- **建议动作**：修正 frontmatter `type` 字段，或将文件移动到正确目录

---

## Steps

### Step 1 ⚙️🧠 — 扫描 canon/ 页面（检查 L001、L002、L003、L004、L005、L006、L010）

1. 遍历 `canon/**/*.md`，跳过 `_index.md`。
2. 读取每个页面的 frontmatter，提取：`sources`、`cross_refs`、`confidence`、`staleness_days`、`type`、`last_updated`。

   **动态计算 staleness_days**：在读取完 frontmatter 后，立即用以下规则覆盖内存中的 `staleness_days` 值（不写回文件）：

   - 若 frontmatter 存在 `last_updated` 字段（格式 `YYYY-MM-DD` 或 ISO 8601），则：
     ```
     effective_staleness_days = (今日日期 - last_updated).days
     ```
   - 若 `last_updated` 字段缺失或无法解析，则回退使用 frontmatter 中存储的 `staleness_days` 静态值；若该值同样缺失，视为 `effective_staleness_days = 0`。
   - 后续所有规则检查（L002、L005）均使用 `effective_staleness_days`，而非 frontmatter 原始值。

3. 并行执行以下检查：
   - **L001**：构建所有 `_index.md` 的 `pages` 合集，检查当前页面路径是否在其中。
   - **L002**：检查 `effective_staleness_days > 90`（lint 运行时动态计算：今日日期 - `last_updated`；若 `last_updated` 缺失则回退使用 frontmatter 中的 `staleness_days` 静态值）。
   - **L003**：检查 `sources` 是否为空或缺失。
   - **L004**：对 `cross_refs` 中每个路径，验证对应文件是否存在于 wiki 中。
   - **L005**：检查 `confidence == "low"` 且 `effective_staleness_days > 30`（lint 运行时动态计算，同 L002）。
   - **L006**：检查正文是否含 `<<<CONFLICT>>>` 标记；跨页矛盾检测需额外对比同一实体的属性断言。
   - **L010**：根据文件路径推断期望的 `type` 值，与 frontmatter `type` 对比。
4. 将所有发现追加到问题缓冲区，记录：规则 ID、文件路径、严重级别、具体说明。

**CLI 执行（结构性规则 L001–L005, L007–L011）**：

```bash
# 执行所有结构性 lint 检查
wiki-ops scan --format json

# 或查看文本格式报告
wiki-ops scan
```

`wiki-ops scan` 自动执行 L001（孤立页面）、L002（过期页面）、L003（缺少来源）、L004（断裂引用）、L005（低置信度超期）、L007（域溢出）、L008（超期提案）、L009（缺少索引）、L010（类型路径不匹配）、L011（连续批准率）的检查。

> **LLM 职责**：仅执行 L006 跨页矛盾检测——需语义理解两个 canon 页面对同一事实是否表述不一致，`wiki-ops scan` 不覆盖此规则。

### Step 2 ⚙️ — 扫描 sources/ 文件（检查未提取来源）

1. 遍历 `sources/**/*.md`，读取 frontmatter 中 `extracted` 和 `created_at` 字段。
2. 若 `extracted: false` 且距 `created_at` 超过 7 天，记录为 INFO 级别发现：
   ```
   [INFO] SOURCES sources/domains/ai/xxx.md — 已导入 N 天但未执行 extract
   ```
3. 此步骤不映射到 L001–L010，作为补充发现单独追加。

### Step 3 ⚙️ — 扫描 changes/ 提案（检查 L008）

1. 遍历 `changes/inbox/*.md` 和 `changes/review/*.md`，读取 frontmatter 中的 `status`、`proposed_at`、`origin` 字段。
2. 计算距今天数，按以下规则触发 L008：
   - 若 `origin != "query-writeback"` 且距今超过 7 天，触发 L008
   - 若 `origin == "query-writeback"` 且距今超过 14 天，触发 L008，并在报告中追加 `[WRITEBACK-OVERDUE]` 标记
3. 若 frontmatter `status` 与所在目录不一致（例如文件位于 `changes/inbox/` 但 `status != inbox`），将其作为说明附加到 L008 条目，提示修正。
4. 将发现追加到问题缓冲区。

### Step 3.5 ⚙️ — 扫描审查模式（检查 L011）

1. 读取 `changes/approved/` 和 `changes/rejected/` 目录下最近的审查记录，按 `reviewed_at` 倒序排列。
2. 从最新决策开始向前回溯，直到遇到第一条 `rejected` 记录为止，计算连续 approve 次数 `consecutive_approve_count`。
3. 若 `consecutive_approve_count >= 10`，触发 L011。
4. 将发现追加到问题缓冲区。

**CLI 执行**：

```bash
wiki-ops consecutive-approve-count
# → 输出数字，如: 5
```

### Step 4 ⚙️ — 生成健康报告

1. 从问题缓冲区按严重级别排序输出：ERROR > WARNING > INFO。
2. 同一严重级别内，按规则 ID 升序排列。
3. 每条发现格式：
   ```
   [ERROR] L003 canon/domains/ai/concepts/foo.md — sources列表为空 → 建议：补充来源文件路径
   [WARN]  L002 canon/domains/ai/concepts/bar.md — staleness_days=95 → 建议：触发 compile 或人工复核
   [INFO]  L007 domain:ai — 52个页面，超出阈值50 → 建议：规划子域拆分
   ```
4. 报告末尾输出健康分数：
   ```
   健康分数: {通过规则检查数} / {总检查数} = {百分比}%
   ```
   计算方式：以页面为粒度，通过所有适用规则的页面数之和 / 全部页面适用规则检查次数之和。

### Step 5 ⚙️ — 可选自动修复（Auto 级别）

仅在 autonomy=auto 且规则风险可控时执行：

- **L001 自动修复**：将孤立页面路径追加到对应域 `_index.md` 的 `pages` 列表末尾。追加前记录原始状态，追加后在 LOG 中标注 `[AUTO-FIX]`。同时，在 `_index.md` 正文的对应分类区块末尾追加条目行（格式：`- [[{slug}]] — {title}`，title 取自该 canon 页 frontmatter 的 `title` 字段；若 title 缺失则使用 slug）。若对应分类区块不存在，则在文件末尾新建 `## 未分类` 区块后追加。

**CLI 执行（L001 自动修复）**：

```bash
wiki-ops update-index --domain ai --action add --slug chain-of-thought --title "Chain-of-Thought Prompting"
```

- **L009 自动修复**：在缺失 `_index.md` 的目录下创建最小化索引文件，内容模板：
  ```yaml
  ---
  type: index
  domain: {目录名}
  pages: []
  created_by: lint-auto
  created_at: {当前日期}
  ---
  ```
  创建后将该目录下现有页面路径填入 `pages`，解决 L001 联动问题。

以下情况不执行自动修复，仅报告：L002、L003、L004、L005、L006、L007、L008、L010、L011，以及任何涉及 canon 正文内容的修改。

### Step 5.5 🧠⚙️ — 主动健康巡检与维护提案生成

在自动修复完成后，基于全量扫描结果评估系统健康趋势。当以下任一退化阈值触发时，可在 `changes/inbox/` 生成维护提案。

**去重与 TTL 规则**：

- 维护提案统一标记 `origin: lint-patrol`
- 同类维护提案的 TTL 为 7 天
- 生成前先扫描 `changes/inbox/` 与 `changes/review/`：
  - 若已存在 `origin = lint-patrol`、`target_page = "_system/maintenance"`、且类型相同的提案，且其 `proposed_at` 距今 < 7 天，则**跳过生成**
  - 跳过时在 LOG 中记录：`[PATROL-SKIP] 已存在未过 TTL 的同类维护提案: {文件名}`
- 超过 TTL 的旧提案不自动覆盖；保留旧提案，并在本次报告中继续提示相同风险

完成去重检查后，当以下任一退化阈值触发时，才生成新的维护提案：

| 退化指标 | 阈值 | 生成提案类型 |
|----------|------|-------------|
| low-confidence 页面占比 | > 60% | `{today}-maintain-confidence-review-batch.md`：批量 confidence 复查任务 |
| avg_staleness_days | > 60 | `{today}-maintain-staleness-refresh.md`：陈旧页面批量刷新任务 |
| open_conflicts 数量 | > 3 | `{today}-maintain-conflict-resolution.md`：冲突集中解决任务 |
| L003 (no-source) ERROR 数量 | > 2 | `{today}-maintain-source-backfill.md`：来源补充任务 |
| L011 连续批准率预警 | 触发 | `{today}-maintain-review-audit.md`：审查质量审计任务 |

维护提案 frontmatter 格式：

```yaml
---
type: change-proposal
action: update
status: inbox
target_page: "_system/maintenance"
trigger_source: "system:lint-patrol"
origin: lint-patrol
confidence: high
proposed_at: "{today}"
auto_quality_score: 1.0
---
```

正文包含：触发指标、当前值、涉及页面列表、建议操作。LOG 记录：`[PATROL] 触发维护提案: {提案文件名}，原因: {指标}={值}`。

### Step 6 ⚙️ — 记录日志与更新 STATE.md

1. 向 `.wiki/policy/LOG.md` 追加本次 lint 运行记录（lint 属于系统状态检查操作，写入 policy LOG），包含：
   - 运行时间戳
   - 触发方式（定期 / 手动 / compile-后）
   - 发现问题总数（按级别分类）
   - 自动修复操作列表
   - 健康分数
2. 更新 `STATE.md` 中以下字段：
   ```yaml
   last_lint: {ISO8601 时间戳}
   last_lint_score: {百分比，如 87.3}
   ```

**CLI 执行**：

```bash
wiki-ops append-log --spec lint \
  --message "触发: 手动 | ERROR: 2 | WARNING: 3 | INFO: 1 | 健康分: 96.2%"
wiki-ops update-state
```

---

## 报告格式

完整报告示例：

```
========== WIKI LINT REPORT ==========
运行时间: 2026-04-08T09:00:00+08:00
触发方式: 定期运行（全量）
扫描范围: canon/（83页） sources/（41个） changes/inbox/（5个）

---------- ERROR（3条）----------
[ERROR] L003 canon/domains/ai/concepts/embedding.md — sources列表为空
        → 建议：补充对应 sources/ 文件路径，或标注人工录入依据

[ERROR] L004 canon/domains/infra/deployment.md — cross_refs引用路径不存在: canon/domains/infra/k8s-setup.md
        → 建议：修正路径拼写，或创建被引用页面，或移除该引用

[ERROR] L009 canon/domains/security/ — 目录缺少 _index.md
        → 已自动修复：创建最小化 _index.md [AUTO-FIX]

---------- WARNING（4条）----------
[WARN]  L001 canon/domains/ai/prompts/chain-of-thought.md — 未被任何 _index.md 引用
        → 建议：加入 canon/domains/ai/_index.md 的 pages 列表

[WARN]  L002 canon/domains/product/roadmap-2024.md — staleness_days=112
        → 建议：触发 compile 更新，或人工确认内容有效性

[WARN]  L006 canon/domains/ai/concepts/llm-context.md — 正文含 <<<CONFLICT>>> 标记
        → 建议：触发 reconcile，统一矛盾表述后清除标记

[WARN]  L008 changes/inbox/update-pricing-logic.md — inbox状态已持续9天
        → 建议：立即处理或拒绝，并通知相关维护者

---------- INFO（2条）----------
[WARN]  L005 canon/domains/ai/concepts/fine-tuning.md — confidence=low，已35天未更新
        → 已生成 confidence-review 任务：changes/inbox/2026-04-08-confidence-review-fine-tuning.md

[INFO]  L007 domain:ai — 当前页面数=52，超出阈值50
        → 建议：将 prompts/ 子类拆分为独立子域

---------- 来源未提取（1条）----------
[INFO]  SOURCES sources/domains/product/interview-notes-0320.md — 已导入19天但 extracted=false
        → 建议：执行 extract 流程或确认是否需要处理

======================================
通过检查: 734 / 总检查数: 743
健康分数: 98.8%
======================================
```

---

## Quality Gates

在 lint 流程结束前，执行以下两项 Quality Gate 检查，任意一项未通过则在报告末尾标注 `[GATE FAILED]` 并阻止自动修复写入：

1. **覆盖率检查**：L001–L011 十一条规则均已被执行，且每条规则的检查结果（即使为零发现）均已写入报告。若任一规则因异常被跳过，报告该规则为 `[SKIPPED]` 状态并标记 Gate 失败。

2. **发现完整性检查**：问题缓冲区中每条发现记录必须包含完整的四个字段：规则 ID、文件路径、严重级别、建议动作。缺少任意字段则该条发现被标记为 `[INCOMPLETE]`，并计入 Gate 失败统计。

---

## 调用示例

**场景**：对一个包含若干问题的 wiki 运行全量 lint。

**wiki 状态**：
- `canon/domains/ai/concepts/embedding.md` 的 `sources: []`（触发 L003）
- `canon/domains/ml/overview.md` 的 `staleness_days=95`（触发 L002）
- `canon/domains/security/` 目录下有 3 个页面但无 `_index.md`（触发 L009，自动修复）
- `changes/inbox/add-rag-section.md` 的 `status=pending`，创建于 10 天前（触发 L008）
- `canon/domains/ai/` 目录共 55 个页面（触发 L007）

**执行过程**：

```
Step 1: 扫描 canon/（共91页）
  - L003 发现 1 处 ERROR
  - L002 发现 1 处 WARNING
  - L007 发现 1 处 INFO（domain:ai，55页）
  - L001/L004/L005/L006/L010 均无发现

Step 2: 扫描 sources/（共28个）
  - 无超期未提取文件

Step 3: 扫描 changes/inbox/（共3个）
  - L008 发现 1 处 WARNING（add-rag-section.md，已10天）

Step 4: 生成报告（见下方输出）

Step 5: 自动修复
  - L009: 在 canon/domains/security/ 创建 _index.md，pages 填入现有3个页面路径 [AUTO-FIX]

Step 6: 更新 STATE.md
  - last_lint: 2026-04-08T10:23:41+08:00
  - last_lint_score: 96.2
```

**输出报告**：

```
========== WIKI LINT REPORT ==========
运行时间: 2026-04-08T10:23:41+08:00
触发方式: 手动触发（全量）
扫描范围: canon/（91页） sources/（28个） changes/inbox/（3个）

---------- ERROR（2条）----------
[ERROR] L003 canon/domains/ai/concepts/embedding.md — sources列表为空
        → 建议：补充对应 sources/ 文件路径

[ERROR] L009 canon/domains/security/ — 目录缺少 _index.md
        → 已自动修复：创建 canon/domains/security/_index.md，收录3个页面 [AUTO-FIX]

---------- WARNING（2条）----------
[WARN]  L002 canon/domains/ml/overview.md — staleness_days=95
        → 建议：触发 compile 或人工复核

[WARN]  L008 changes/inbox/add-rag-section.md — pending状态已持续10天
        → 建议：立即处理或拒绝该提案

---------- INFO（1条）----------
[INFO]  L007 domain:ai — 当前页面数=55，超出阈值50
        → 建议：将子类（如 prompts/）拆分为独立子域

======================================
通过检查: 893 / 总检查数: 898
健康分数: 99.4%
======================================
```
