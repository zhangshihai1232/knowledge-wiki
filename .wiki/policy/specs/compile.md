---
type: spec
name: compile
autonomy: auto
triggers:
  - changes/approved/有新文件
inputs:
  - changes/approved/*.md
  - 对应canon页
outputs:
  - 更新后的canon页
  - 更新后的_index.md
quality_gates:
  - sources非空
  - last_compiled已更新
  - 原有内容未丢弃
---

## Purpose

将人工 approved 的 proposal 编译为 canon 知识页面。

Proposal 经过人工审核后进入 `changes/approved/` 目录，compile spec 负责将其中的知识变更实际写入 canon 页面，同时维护索引、交叉引用和编译日志的一致性。编译结果必须保证 canon 页面内容完整、来源可追溯、元数据准确。

---

## When to Run

当 `changes/approved/` 目录下出现新文件时触发。

触发条件的判定逻辑：

- 监测 `changes/approved/` 下所有 `.md` 文件
- 文件 frontmatter 中 `compiled` 字段为空或为 `false` 时视为待编译
- 同一次运行可批量处理多个待编译 proposal，按文件创建时间升序执行

---

## Steps

### Step 1：读取 approved proposal，解析 target_page / action / proposed diff

读取待编译 proposal 文件，提取以下关键字段：

```yaml
target_page: <canon页相对路径，格式：{domain}/{category}/{slug}，例如 ai/architectures/transformer>
target_type: <concept | entity | comparison | guide | decision>  # action=create 时必须存在
action: <create | update | merge | split | archive>
confidence: <high | medium | low>
trigger_source: <触发来源的 source 文件路径>
```

**target_page 转换规则**：将 `target_page` 转换为文件系统路径时，统一使用：

```
canon/domains/{target_page}.md
```

例如：`target_page: ai/architectures/transformer` → 文件路径 `canon/domains/ai/architectures/transformer.md`

**变更内容（proposed diff）**读取位置：proposal 正文的 `## 变更内容` 节，包含"新增内容"、"修改内容"、"删除内容"三个子节。

**错误处理**：如果 `target_page` 对应的 canon 页不存在且 `action` 不是 `create`，则终止当前 proposal 的编译，在 LOG 中记录 `ERROR: target not found`，将 proposal 的 `compiled` 字段标记为 `error`，继续处理下一个。

---

### Step 2：按 action 分支处理

根据 `action` 字段路由到对应的合并策略（详见"增量合并策略"一节）：

| action  | 描述                                                 |
|---------|------------------------------------------------------|
| create  | 按 type 使用对应模板新建 canon 页                     |
| update  | 定向修改 canon 页中受影响的节，保留其余节             |
| merge   | 将多个 canon 页合并为一个，sources 取并集             |
| split   | 将一个 canon 页拆分为多个，按相关性分配内容           |
| archive | 将 canon 页标记为已归档，从 _index.md 移除条目        |

---

### Step 3：更新 canon 页 frontmatter

完成内容合并后，更新 canon 页的元数据字段：

```yaml
sources:          # 追加 proposal 中的新来源，去重，保留原有来源
  - <原有来源...>
  - <新来源（来自 proposal.sources）>
last_compiled: <今日日期，格式 YYYY-MM-DD>
last_updated: <今日日期，格式 YYYY-MM-DD>   # 同步更新，供 lint 动态计算 staleness
staleness_days: 0
confidence: <见冲突检测规则>
```

`sources` 字段不得为空；若 proposal 未提供 sources，使用 proposal 文件路径本身作为兜底来源。

**confidence 初始值规则**：

compile 执行 `create` 或 `update` action 时，按以下优先级确定 confidence 初始值：

1. 若本次编译后 canon 页的 `sources` 列表中存在至少 1 个 `authority=authoritative` 的 source 文件，且编译过程中**无冲突**，则将 confidence 设置为 `medium`。
2. 否则（所有来源均为 secondary / unverified，或来源 authority 字段缺失），将 confidence 设置为 `low`。

例外：若 canon 页当前 confidence 已为 `high`，且本次编译无冲突，则**保持 high 不变**（high 只能由 promote 流程中的人工 approve 设置，不由 compile 自动授予）。

注意：以上规则仅适用于 confidence 尚未被冲突检测规则覆盖的情况；冲突检测规则优先级更高。

---

### Step 4：更新 cross_refs

扫描更新后的 canon 页正文，识别所有 `[[slug]]` 格式的 wiki link，同步更新 frontmatter 中的 `cross_refs` 列表：

```yaml
cross_refs:
  - slug-a
  - slug-b
```

规则：
- 只记录 slug，不记录完整路径
- 去除正文中已删除节里的失效引用
- 若目标 slug 对应的 canon 页不存在，保留引用但在 LOG 中记录 `WARN: dangling ref [[slug]]`

---

### Step 5：更新 MOC（_index.md）

根据 action 对对应分类的 `_index.md` 进行修改：

- **create**：
  1. 在 `_index.md` 的对应分类区块下新增一行条目，格式为 `- [[slug]] — <页面 title>`
  2. **同步更新 frontmatter `pages` 字段**：将 `{domain}/{category}/{slug}` 追加到 `pages` 列表（去重，幂等）
- **archive**：
  1. 从 `_index.md` 正文中移除该页面的条目
  2. **同步从 frontmatter `pages` 字段中移除**对应路径（幂等）
- **update / merge / split**：若 slug 或 title 发生变化则同步更新正文条目和 `pages` 字段，否则不改动

`_index.md` 的分类区块由 `## <分类名>` 标题标识，条目追加在对应区块末尾。若分类区块不存在，则在文件末尾新建该区块。

**首次创建领域时的初始化**：若 `canon/domains/{domain}/_index.md` 不存在，在写入条目前**自动创建**，内容如下：

```markdown
---
type: index
domain: {domain}
title: "{domain} 领域索引"
updated_at: {今日日期}
pages:
  - {domain}/{category}/{slug}
---

# {domain} 领域

## {category}

- [[{slug}]] — {title}
```

同时，在顶层 `canon/_index.md` 的 `## 领域列表` 节追加该领域条目：

```markdown
- [{domain}](domains/{domain}/_index.md) — {领域简述，取自 target_page 的 domain 字段}
```

---

### Step 6：归档 proposal

编译完成后，对 proposal 文件执行归档操作：

1. 在 proposal 文件的 frontmatter 中添加或更新字段：
   ```yaml
   compiled: true
   compiled_at: <今日日期，格式 YYYY-MM-DD>
   ```
2. 文件保留在 `changes/approved/` 目录，不移动，以便审计追溯。

---

### Step 7：追加 LOG，更新 STATE.md

**追加编译日志**：在 `changes/LOG.md` 末尾追加一条记录，格式如下：

```markdown
## <YYYY-MM-DD> compile <proposal文件名>

- action: <create | update | merge | split | archive>
- target: <target_page>
- sources_added: <新增来源数量>
- cross_refs_updated: <更新的交叉引用数量>
- conflicts: <冲突数量，0 表示无冲突>
- result: success | partial（有冲突标记但编译完成）| error（编译终止）
```

**更新 STATE.md**：

```yaml
last_compiled: <今日日期>
pending_proposals: <changes/inbox/ + changes/review/ 文件数之和>
total_canon_pages: <pages/ 目录下非 archived 的 canon 页数量>
```

---

### Step 8：触发 compile-后局部 lint

所有 proposal 编译完成后，自动触发一次局部 lint，范围为**本次编译涉及的页面及其 cross_refs 引用方**。

执行规则（局部触发时适用）：
- 检查 L001（孤立页面）、L003（缺少来源）、L004（断裂引用）、L006（内容矛盾）
- 跳过 L007（域溢出）——局部触发时不执行全域统计
- L008（超期提案）——局部触发时不执行

lint 结果追加到 `changes/LOG.md`，格式：

```
[POST-COMPILE-LINT] <YYYY-MM-DD> 涉及页面: <N>个 | 发现: ERROR <X>条 WARNING <Y>条 | 健康分: <Z>%
```

同步更新 STATE.md：

```yaml
last_lint: <ISO8601 时间戳>
last_lint_score: <百分比>
```

若 lint 发现 ERROR 级别问题，在 LOG 中标注 `[NEEDS_ATTENTION]`，提示维护者处理。

---

## 冲突检测规则

在 Step 2 合并内容时，若检测到 proposal 内容与 canon 页现有内容存在**事实矛盾**（同一事实两种不同断言），执行以下操作：

1. 在 canon 页对应位置插入冲突标记块：

   ```
   <<<CONFLICT>>>
   [现有内容]
   ---
   [proposal 新内容]
   <<<END_CONFLICT>>>
   ```

2. 将该 canon 页的 `confidence` 自动降为 `low`：
   ```yaml
   confidence: low
   ```

3. **不阻塞编译**：冲突标记插入后继续执行 Step 3 至 Step 7，完整走完编译流程。

4. 在 LOG 中将 `result` 标记为 `partial`，并列出冲突位置（节标题 + 行号）。

冲突标记需人工或后续 review spec 处理，compile spec 不自动裁决哪一方正确。

**create-with-conflict 场景**：当 `action=create` 时，目标 canon 页尚不存在，无现有内容可比对，但 proposal 本身可能已在 ingest 阶段识别出内部分歧（声明列表中含 `⚠️` 标注，或 proposal 正文的 `## 变更内容` 节中包含对立陈述）。此场景下执行以下操作：

1. 正常创建 canon 页，将所有内容写入。
2. 检查 proposal 正文是否包含以下任一标志：
   - `## 变更内容` 节中存在以 `> ⚠️ 冲突：` 开头的 blockquote 行（ingest 阶段的冲突标注格式）
   - `## 变更内容` 节中出现对立数值或对立结论（如"A 认为 X，B 认为 Y"）
3. 若检测到内部分歧，在 canon 页对应位置插入 `<<<CONFLICT>>>` 标记，将 `confidence` 设置为 `low`，并将 proposal 路由到 `changes/conflicts/`（同常规冲突处理）。
4. 在 LOG 中将 `result` 标记为 `partial`，注明"create-with-conflict"。

5. **路由冲突 proposal**：将触发此次冲突的 proposal 文件的 `status` 更新为 `conflict`，并将文件从当前目录移动到 `changes/conflicts/`，同时在 proposal frontmatter 中补写冲突位置信息：
   ```yaml
   status: conflict
   conflict_location: "<节标题> 第 <行号> 行"
   ```
   **目录初始化**：在移动文件前，检查 `changes/conflicts/` 目录是否存在；若不存在，**自动创建该目录**（同时创建 `changes/resolved/` 目录，供 reconcile spec 使用），然后再执行移动。
   移动完成后，reconcile spec 将自动触发（因 `changes/conflicts/` 出现新文件）。

---

## staleness 衰减规则

每次 compile 运行时（含局部触发），对**未参与本次编译**的 canon 页执行以下衰减检查：

**动态计算 effective_staleness_days**：对每个待检查页面，使用以下规则计算实际过期天数（仅在内存中计算，不写回文件）：
- 若 frontmatter 存在 `last_updated` 字段，则：`effective_staleness_days = (今日日期 - last_updated).days`
- 若 `last_updated` 缺失，则回退使用 frontmatter 中的 `staleness_days` 静态值；若同样缺失，视为 0

| 当前 confidence | effective_staleness_days 条件 | 自动操作 |
|----------------|-------------------------------|----------|
| `high` | `> 90` | 自动降为 `medium` |
| `medium` | `> 180` | 自动降为 `low` |
| `low` | 任意 | 不变（由 lint L005 跟踪） |

执行衰减时：

1. 直接更新 canon 页 frontmatter 中的 `confidence` 字段。
2. 在 LOG 中记录衰减条目：
   ```
   [DECAY] <页面路径> confidence: <原值> → <新值>（effective_staleness_days=<N>，基于 last_updated=<日期>）
   ```
3. 衰减操作不重置 `staleness_days`，不触发 Quality Gates 检查。

**衰减不适用于以下情况**：
- 本次 compile 正在处理的目标页（由初始值规则和冲突检测规则控制）
- `status: archived` 的页面

---

## confidence 升级规则

confidence 升级路径为单向递进：`low → medium → high`，不可跨级。

### low → medium

触发条件（满足以下**任一**路径）：

**路径 A（权威来源路径）**：
1. 通过 compile 为该 canon 页补充了至少 1 个 `authority=authoritative` 的 source。
2. 本次 compile 过程中**无冲突**（冲突检测规则未触发）。

**路径 B（多来源一致路径）**：
1. 本次 compile 后该 canon 页的 `sources` 列表中存在至少 2 个 `authority=secondary` 的 source。
2. 本次 compile 过程中**无冲突**（冲突检测规则未触发）。
3. 本次 compile 后 `last_updated` 为今日日期（即本次 compile 更新了页面内容）。

操作：compile 自动将 confidence 从 `low` 提升为 `medium`，并在 LOG 中记录：

```
[PROMOTE] <页面路径> confidence: low → medium（路径A: 新增权威来源 <source路径> | 路径B: 2个secondary来源一致）
```

### medium → high

触发条件（全部满足）：

1. 人工在 promote 流程中对该页面执行 approve 操作，并在 frontmatter 中显式设置 `confidence: high`。
2. 该页面 `staleness_days` 在 approve 时为 0（即当日刚经过 compile 更新）。
3. 距上次产生冲突（confidence 曾被自动降为 low）已超过 90 天，或该页面从未发生过冲突。

操作：由人工在 promote 流程中设置，compile 不自动授予 high。compile 在后续运行中会通过 staleness 衰减规则监控 high 状态的有效期。

---

## 增量合并策略

### update

按 `##` 二级标题将 canon 页分节。

1. 定位 proposal `proposed_diff` 涉及的目标节（通过节标题匹配）
2. 仅替换或追加受影响节的内容
3. 其余节原文保留，不做任何修改
4. 若目标节不存在，在文件末尾新增该节

### create

按 `type` 字段选择对应模板初始化新 canon 页：

| type       | 模板位置                              |
|------------|---------------------------------------|
| concept    | policy/templates/concept.md           |
| entity     | policy/templates/entity.md            |
| comparison | policy/templates/comparison.md        |
| guide      | policy/templates/guide.md             |
| decision   | policy/templates/decision.md          |

将模板中的占位字段替换为 proposal 提供的内容，生成完整 canon 页后写入 `pages/<slug>.md`。

### merge

将 proposal 指定的多个 source 页合并为一个 target 页：

- `sources`：取所有参与合并页面的 sources 字段的**并集**，去重
- `confidence`：取所有参与合并页面中**最高**的 confidence 值
- 内容：按节合并，相同节标题的内容追加，不重复的节直接保留
- 合并完成后，将原 source 页的 action 标记为 `archive`，触发后续归档流程
- **MOC 清理（幂等）**：将所有被合并的源 slug 从对应 `_index.md` 中移除，若条目存在则追加注释行 `<!-- merged into [[目标slug]] -->`；若条目已不存在则跳过（幂等保证）

### split

将一个 canon 页拆分为多个目标页：

- 按各目标页与原页内容的**语义相关性**分配节
- 若某节与多个目标页均相关，复制到各目标页并在 cross_refs 中互相引用
- `sources`：根据各节所属的主题领域分配原 sources，无法明确归属的 sources 复制到所有目标页
- 拆分完成后，将原页标记为 `archive`
- **MOC 清理（幂等）**：将原 slug 从所有 `_index.md` 中移除，若条目存在则追加注释行 `<!-- split → [[新slug1]], [[新slug2]] -->`；若条目已不存在则跳过（幂等保证）

### archive

1. 在 canon 页 frontmatter 中设置：
   ```yaml
   status: archived
   archived_at: <今日日期>
   ```
2. 从对应分类的 `_index.md` 中移除该页面条目
3. canon 页文件保留，不删除，以便历史追溯

---

## Quality Gates

编译完成后执行以下三个检查点，任一失败则在 LOG 中记录 `QUALITY_GATE_FAIL` 并通知人工介入：

**Gate 1：sources 非空**

```
assert len(canon_page.frontmatter.sources) > 0
```

检查更新后的 canon 页 `sources` 字段不为空列表。若为空，说明来源信息丢失，canon 页可信度无法保证。

**Gate 1b：sources 路径有效性**

```
for path in canon_page.frontmatter.sources:
    if not file_exists(path):
        log WARNING: "INVALID_SOURCE_PATH: {path}"
```

对 sources 列表中每个路径执行 `file_exists()` 检查。失效路径不阻塞编译，但在 LOG 中记录 `WARNING: INVALID_SOURCE_PATH`，并在 lint 报告中体现。

特殊规则：若路径以 `changes/` 开头（即兜底机制写入的 proposal 路径），在 LOG 中额外标注 `[FALLBACK_SOURCE]`，提示该来源为临时兜底，需后续补充正式 source 文件。

**Gate 2：last_compiled 已更新**

```
assert canon_page.frontmatter.last_compiled == today
```

检查 `last_compiled` 字段已更新为今日日期。若未更新，说明 frontmatter 写入步骤未正确执行。

**Gate 3：原有内容未丢弃**

```
assert all_original_sections_present_or_intentionally_removed(canon_page, action)
```

对 `update` 类型的 action，检查 canon 页中非目标节的内容与编译前一致（字符级比对）。对 `archive` 类型，检查内容未被清空。`create` / `merge` / `split` 类型跳过此检查。

---

## 调用示例

编译一个 `create` 类型的 proposal：

**输入文件** `changes/approved/2026-04-08-create-transformer.md`：

```yaml
---
type: change-proposal
action: create
status: approved
target_page: "ai/architectures/transformer"
target_type: concept
trigger_source: "sources/articles/2026-04-08-attention-is-all-you-need.md"
confidence: medium
proposed_at: "2026-04-08"
reviewed_by: "alice"
reviewed_at: "2026-04-08T15:00:00+08:00"
compiled: false
compiled_at: ~
---

## 提案摘要

新建 Transformer 架构 canon 页，收录其核心设计原则与实验结果。

## 变更内容

### 新增内容

**Transformer 架构概述**

Transformer 是一种完全基于注意力机制的序列到序列架构，不依赖 RNN 或 CNN。

### 修改内容

无（新建页面）

### 删除内容

无
```

**执行过程**：

1. 解析 proposal：`action=create`，`target_page=ai/architectures/transformer`，`target_type=concept`
2. 转换文件路径：`canon/domains/ai/architectures/transformer.md`
3. 路由到 create 分支，按 concept 模板初始化新 canon 页
4. 将 `## 变更内容 / 新增内容` 填充到模板，写入 `canon/domains/ai/architectures/transformer.md`
5. 更新 frontmatter：`sources=[trigger_source 路径]`，`last_compiled=2026-04-08`，`staleness_days=0`，`confidence=medium`
6. 扫描正文，无 `[[slug]]` 引用，`cross_refs=[]`
7. 检查 `canon/domains/ai/_index.md` 是否存在 → **不存在**，自动创建，写入 `## architectures` 区块和条目 `- [[transformer]] — Transformer 架构`
8. 在 `canon/_index.md` 的 `## 领域列表` 节追加 `- [ai](domains/ai/_index.md)`
9. 在 proposal 写入 `compiled: true`，`compiled_at: 2026-04-08`
10. 追加 LOG，更新 STATE.md

**Quality Gates 结果**：

- Gate 1 通过：`sources` 包含 trigger_source 路径
- Gate 2 通过：`last_compiled=2026-04-08`
- Gate 3 跳过：create 类型不检查原有内容

**输出**：新建 `canon/domains/ai/architectures/transformer.md`，自动初始化 `canon/domains/ai/_index.md`，顶层 `canon/_index.md` 登记 ai 领域，LOG 记录 `result: success`。
