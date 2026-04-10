# P1-1：confidence 生命周期完整定义

## 背景

当前 wiki 系统中 confidence 字段（high / medium / low）存在四个设计缺口：

1. **初始值无规则**：compile spec 仅在 Step 3 注释 `confidence: <见冲突检测规则>`，实际初始值由 proposal 携带，缺乏系统性约束，导致不同维护者录入标准不一致。
2. **升级路径缺失**：冲突检测规则只定义了"降为 low"，没有定义 low→medium→high 的升级条件，confidence 一旦降级便缺乏恢复机制。
3. **staleness 对 confidence 的影响未定义**：high confidence 页面放置超过 90 天后是否应自动衰减，现有 spec 没有任何规定。
4. **L005 驱动力不足**：当前 L005 为 INFO 级别（最低），实际上低置信度超期是需要人工干预的状态，INFO 级别无法引起足够重视。

本方案在不引入外部依赖的前提下，通过在 source-page.md 新增 authority 字段、在 compile.md 补充三条新规则、在 lint.md 提升 L005 级别，完整定义 confidence 的生命周期。

---

## 修改文件

- `.wiki/policy/schemas/source-page.md`（新增 `authority` 字段）
- `.wiki/policy/specs/compile.md`（confidence 初始值规则 + staleness 衰减规则 + confidence 升级条件）
- `.wiki/policy/specs/lint.md`（L005 升级为 WARNING，建议动作改为自动生成 confidence-review 任务）

---

## source-page.md 修改内容

### 新增 authority 字段

**锚点（字段列表 frontmatter 代码块，插入位置：`checksum` 行之后）**：

```yaml
checksum: "sha256:abc123"           # 可选，内容哈希，用于去重检测
```

**插入内容**：

```yaml
authority: "authoritative"          # 可选，来源权威性：authoritative | secondary | unverified
```

**字段说明表格（锚点：`| checksum | 否 | 内容 SHA-256 哈希，用于检测重复摄入 |` 行之后追加一行）**：

```
| authority | 否 | 来源权威性评级：`authoritative`（权威来源，如官方文档、原始论文）/ `secondary`（二手解读、转述）/ `unverified`（未验证来源）；缺省视为 `unverified` |
```

---

## compile.md 修改内容

### 1. confidence 初始值规则

**插入位置**：Step 3 frontmatter 更新规则代码块中，`confidence: <见冲突检测规则>` 行替换为带注释的规则说明，并在 Step 3 代码块之后、Step 4 标题之前新增说明段落。

**Step 3 代码块中，将**：

```yaml
confidence: <见冲突检测规则>
```

**替换为**：

```yaml
confidence: <见初始值规则及冲突检测规则>
```

**在 Step 3 代码块之后（`sources 字段不得为空；...` 段落之前）新增以下内容**：

```markdown
**confidence 初始值规则**：

compile 执行 `create` 或 `update` action 时，按以下优先级确定 confidence 初始值：

1. 若本次编译后 canon 页的 `sources` 列表中存在至少 1 个 `authority=authoritative` 的 source 文件，且编译过程中**无冲突**，则将 confidence 设置为 `medium`。
2. 否则（所有来源均为 secondary / unverified，或来源 authority 字段缺失），将 confidence 设置为 `low`。

例外：若 canon 页当前 confidence 已为 `high`，且本次编译无冲突，则**保持 high 不变**（high 只能由 promote 流程中的人工 approve 设置，不由 compile 自动授予）。

注意：以上规则仅适用于 confidence 尚未被冲突检测规则覆盖的情况；冲突检测规则优先级更高。
```

---

### 2. staleness 衰减规则

**插入位置**：冲突检测规则一节末尾（`冲突标记需人工或后续 review spec 处理，compile spec 不自动裁决哪一方正确。` 段落之后），`## 增量合并策略` 标题之前。

**新增以下内容**：

```markdown
## staleness 衰减规则

每次 compile 运行时（含局部触发），对**未参与本次编译**的 canon 页执行以下衰减检查：

| 当前 confidence | staleness_days 条件 | 自动操作 |
|----------------|---------------------|----------|
| `high` | `> 90` | 自动降为 `medium` |
| `medium` | `> 180` | 自动降为 `low` |
| `low` | 任意 | 不变（由 lint L005 跟踪） |

执行衰减时：

1. 直接更新 canon 页 frontmatter 中的 `confidence` 字段。
2. 在 LOG 中记录衰减条目：
   ```
   [DECAY] <页面路径> confidence: <原值> → <新值>（staleness_days=<N>）
   ```
3. 衰减操作不重置 `staleness_days`，不触发 Quality Gates 检查。

**衰减不适用于以下情况**：
- 本次 compile 正在处理的目标页（由初始值规则和冲突检测规则控制）
- `status: archived` 的页面
```

---

### 3. confidence 升级条件

**插入位置**：staleness 衰减规则一节之后，`## 增量合并策略` 标题之前。

**新增以下内容**：

```markdown
## confidence 升级规则

confidence 升级路径为单向递进：`low → medium → high`，不可跨级。

### low → medium

触发条件（全部满足）：

1. 通过 compile 为该 canon 页补充了至少 1 个 `authority=authoritative` 的 source。
2. 本次 compile 过程中**无冲突**（冲突检测规则未触发）。

操作：compile 自动将 confidence 从 `low` 提升为 `medium`，并在 LOG 中记录：

```
[PROMOTE] <页面路径> confidence: low → medium（新增权威来源: <source路径>）
```

### medium → high

触发条件（全部满足）：

1. 人工在 promote 流程中对该页面执行 approve 操作，并在 frontmatter 中显式设置 `confidence: high`。
2. 该页面 `staleness_days` 在 approve 时为 0（即当日刚经过 compile 更新）。
3. 距上次产生冲突（confidence 曾被自动降为 low）已超过 90 天，或该页面从未发生过冲突。

操作：由人工在 promote 流程中设置，compile 不自动授予 high。compile 在后续运行中会通过 staleness 衰减规则监控 high 状态的有效期。
```

---

## lint.md 修改内容

### L005 级别和建议动作修改

**锚点（L005 规则块）**：

```markdown
- **严重级别**：INFO
- **说明**：低置信度页面本应是临时状态，长期未提升说明可能被遗忘或来源不足
- **建议动作**：补充来源后重新 compile 提升置信度，或由维护者审核后手动标注
```

**替换为**：

```markdown
- **严重级别**：WARNING
- **说明**：低置信度页面本应是临时状态，长期未提升说明可能被遗忘或来源不足，此类页面内容可信度存疑，不应在知识检索中被优先引用
- **建议动作**：自动在 `changes/reviews/` 目录下生成 confidence-review 任务文件（命名格式：`{today}-confidence-review-{slug}.md`），任务文件包含页面路径、当前 staleness_days、现有 sources 列表，提示维护者补充权威来源后重新 compile
```

同步修改 Step 1 说明中 L005 的描述（**锚点**：`- **L005**：检查 \`confidence == "low"\` 且 \`staleness_days > 30\``），将其下方对应的报告输出示例中的 `[INFO]  L005` 改为 `[WARN]  L005`。

**报告格式示例中的锚点**（位于 `## 报告格式` 一节的完整报告示例代码块内）：

```
[INFO]  L005 canon/domains/ai/concepts/fine-tuning.md — confidence=low，已35天未更新
        → 建议：补充高质量来源后重新 compile
```

**替换为**：

```
[WARN]  L005 canon/domains/ai/concepts/fine-tuning.md — confidence=low，已35天未更新
        → 已生成 confidence-review 任务：changes/reviews/2026-04-08-confidence-review-fine-tuning.md
```

---

## 验证方式

| 场景 | 预期结果 |
|------|----------|
| compile 一个仅有 `authority=unverified` 来源的 create proposal | canon 页 `confidence=low` |
| compile 一个含 `authority=authoritative` 来源、无冲突的 create proposal | canon 页 `confidence=medium` |
| compile 触发冲突检测 | canon 页 `confidence=low`（冲突规则优先，覆盖初始值规则） |
| canon 页 `confidence=high`，`staleness_days` 从 89 跨越到 91 | 下次 compile 运行时自动衰减为 `medium`，LOG 记录 `[DECAY]` |
| canon 页 `confidence=medium`，`staleness_days=181` | 下次 compile 运行时自动衰减为 `low`，LOG 记录 `[DECAY]` |
| 为 `confidence=low` 页面补充 `authority=authoritative` 来源后重新 compile，无冲突 | `confidence` 自动升为 `medium`，LOG 记录 `[PROMOTE]` |
| lint 扫描到 `confidence=low` 且 `staleness_days>30` 的页面 | 报告输出 `[WARN] L005`（而非 `[INFO]`），并在 `changes/reviews/` 生成 confidence-review 任务文件 |
| 人工 approve + `staleness_days=0` + 距上次冲突 ≥90 天 | 维护者可在 promote 流程中设置 `confidence=high` |
