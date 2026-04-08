---
type: finding
version: v3
evaluated_at: 2026-04-09
agent: A3-knowledge-consistency
---

# 知识一致性层评估报告 v3

> 对比基准：v2（属性5=4/10，属性6=6/10）

## 属性5：冲突发现与解决

### 评分：7 / 10（vs v2: 4/10，变化：↑+3）

### 评分依据

v3 完成了 v2 最关键的两项修复：reconcile.md 已新增且内容完整，change-proposal.md status 枚举已包含 `conflict` 状态，compile.md 已新增 `create-with-conflict` 场景处理规则并明确路由到 `changes/conflicts/`，冲突处理闭环在规范层面已打通。主要扣分点在于 ingest.md 升级规则与 compile.md create-with-conflict 场景存在轻微衔接裂缝——ingest 仍以"软标注（⚠️）"为主，而 compile 的 create-with-conflict 检测依赖识别 `⚠️` 前缀声明，两者语义对接是否稳健存疑；此外 reconcile spec 与 P0 方案原稿存在局部差异（autonomy 级别、步骤结构），但不影响核心闭环功能。

### v2 问题修复状态

- **[CRITICAL-2] 新建页面内部冲突盲区：已修复** — compile.md 已在"冲突检测规则"末尾新增专项 `create-with-conflict` 场景（第 257-264 行），明确当 `action=create` 时检查 proposal 正文中的 `⚠️` 前缀声明或对立陈述，若检测到内部分歧则在新建 canon 页插入 `<<<CONFLICT>>>` 标记、设置 `confidence: low`，并将 proposal 路由至 `changes/conflicts/`，最终触发 reconcile spec。
- **reconcile spec 缺失：已修复** — `.wiki/policy/specs/reconcile.md` 现已存在，内容完整：包含 Purpose、When to Run、Steps（读取冲突→收集裁决依据→生成裁决建议→人工确认→执行合并→归档和 LOG）、冲突解决 SLA（高/中/低三档时限）、Quality Gates（3 项），覆盖了从冲突触发到 confidence 恢复的完整闭环。
- **change-proposal conflict 状态：已修复** — change-proposal.md status 枚举现为 `inbox | review | approved | rejected | conflict`，字段说明表中新增 conflict 说明行，状态流转图已补充 `approved → conflict → reconcile 裁决 → resolved/deferred` 分支。

### 已做好的部分

- **冲突路由链路已闭合**：compile.md 冲突检测规则新增第 5 步"路由冲突 proposal"，明确将 proposal status 更新为 `conflict`、移动至 `changes/conflicts/`、补写 `conflict_location` 字段，并指出 reconcile spec 将自动触发。
- **reconcile spec 规则体系完整**：包含 autonomy 声明（propose）、裁决优先级规则（authority 优先→时效优先→并存→MANUAL_REQUIRED）、SLA 约束（高/中/低三档：3/7/30 工作日）、confidence 重评估逻辑、3 项 Quality Gates，设计无明显遗漏。
- **L006 lint 规则可触发**：reconcile 完成后 `<<<CONFLICT>>>` 标记被清除，若 reconcile 未执行则 L006 可检测到标记并升级告警（SLA 超期后从 WARNING 升为 ERROR）。
- **ingest 升级规则对矛盾声明处理明确**：ingest.md 升级规则段描述了"矛盾声明"的识别标准和 5 个处理步骤（识别→保留双方→标注来源→维持 status: inbox→LOG 记录 conflict: true），与 compile 侧的 create-with-conflict 检测形成接力。

### 仍存在的问题

- **ingest 与 compile 的冲突信号对接存在歧义**：ingest.md 升级规则要求在 proposal 的 `## 变更内容` 中用 `> ⚠️ 冲突` 标记矛盾点（Markdown blockquote + emoji 格式），而 compile.md create-with-conflict 场景检测"声明含 `⚠️` 前缀"。两者描述的格式并不完全一致：ingest 示例格式为 `> ⚠️ 冲突：…`（blockquote 嵌套），compile 检测的是"声明列表中含 `⚠️` 前缀"。在实际执行中，如果 AI 严格遵循 ingest 格式写 blockquote，compile 的字符串检测可能无法命中，导致 create-with-conflict 路径仍被绕过。
- **reconcile 的 autonomy 与 P0 方案原稿不一致**：P0 方案中 autonomy 为 `semi-auto`，实际 reconcile.md 中 autonomy 为 `propose`。两者含义相近但"propose"缺少明确的自动化边界定义，执行者需自行判断哪些步骤可自动、哪些步骤须等待人工确认。
- **compile create-with-conflict 对"对立陈述"的检测标准模糊**：spec 描述"检查 `## 变更内容` 节中出现对立数值或对立结论（如'A 认为 X，B 认为 Y'）"，但"对立"的判断没有形式化标准，依赖 AI 语义理解，存在误判（漏检或过度触发）风险。
- **reconcile Quality Gate 2 逻辑存在潜在误判**：Gate 2 断言 `confidence != "low" OR has_remaining_conflicts()`，但若裁决为 `keep_both` 且来源均为 secondary，reconcile.md 中 confidence 重评估表显示结果为 `medium`，Gate 2 可正常通过；但若裁决为 `keep_existing`/`keep_proposed` 且来源 authority 均为 `low`，confidence 重评估结果仍为 `low`，Gate 2 会误报失败，形成假阳性。

### 新发现的问题

- **reconcile.md 与 compile.md 对 confidence 重评估规则不一致**：reconcile.md Step 5 的重评估规则为"全部 high → high；存在 medium → medium；存在 low → low"（按最低来源 authority 决定），而 compile.md 的 confidence 初始值规则为"至少 1 个 authoritative 且无冲突→medium，否则→low"。两个规则的 authority 等级枚举值甚至不同（reconcile 用 high/medium/low，compile 用 authoritative/secondary/unverified），存在逻辑矛盾，维护者执行时可能产生歧义。
- **`changes/conflicts/` 目录初始化问题未解决**：compile.md 和 reconcile.md 均依赖 `changes/conflicts/` 目录存在，但 spec 中无任何步骤负责在目录不存在时创建它。若目录不存在，文件移动操作将失败，触发链断裂（该问题在 v2 中已被发现为 CRITICAL）。虽然 v3 的 spec 设计正确，但缺少防御性初始化步骤。

---

## 属性6：置信度准确性

### 评分：6 / 10（vs v2: 6/10，变化：=）

### 评分依据

v3 在 compile.md 中已补充完整的 confidence 升级规则（low→medium 的路径 A 和路径 B，medium→high 的人工 promote 条件），staleness 衰减规则也已就位，规则体系在规范层面比 v2 更完整。但 v2 报告中指出的核心问题——confidence 升级路径在实际运行中几乎不可达（无 authoritative 来源场景下 low→medium 无法触发），以及 proposal.confidence 与 canon.confidence 职责边界模糊——在 v3 spec 中均未被直接修复：ingest.md 和 change-proposal.md 仍未说明 proposal 的 confidence 字段仅为"建议值"，compile 仍会用自身规则覆盖，潜在误导未消除。综合评分维持 6/10，规则完整但关键可用性问题未改善。

### v2 问题修复状态

- **[NEW-5] confidence 升级路径不可达：未修复** — compile.md 已定义 low→medium 的两条升级路径（路径 A：authoritative 来源且无冲突；路径 B：≥2 个 secondary 来源且无冲突且 staleness_days=0），但这两条路径的可达性仍依赖外部资料的 authority 属性，spec 本身无法控制。v2 指出"测试材料设计未覆盖升级路径"是测试问题而非 spec 问题，但路径 B（多 secondary 来源）实际是可触发的，且 v3 已明确列出，这在一定程度上改善了可达性，但未从设计层面解决根因（低 authority 资料无法升级到 medium 的问题仍然存在）。

### 已做好的部分

- **compile.md confidence 升级规则已完整定义**：low→medium 提供两条路径（权威来源路径 + 多来源一致路径），medium→high 明确要求人工 promote + staleness_days=0 + 距上次冲突超 90 天，规则覆盖了全部升级场景，每个路径的触发 LOG 格式也已定义。
- **staleness 衰减规则已完整**：compile.md 定义了 high>90天降 medium、medium>180天降 low 的自动衰减，衰减操作不重置 staleness_days，LOG 记录格式明确。
- **reconcile.md confidence 重评估逻辑已定义**：冲突解决后的 confidence 重评估有三种情形（无残余冲突→按 authority 重算；仍有冲突→保持 low；keep_both→固定 medium），兜底了冲突场景下 confidence 的恢复路径。
- **L005 lint 规则设计合理**：confidence=low 且 effective_staleness_days>30 时自动生成 confidence-review 任务文件到 `changes/reviews/`，任务文件包含页面路径、staleness_days、现有 sources 列表，能有效驱动 low-confidence 页面的人工处理。

### 仍存在的问题

- **proposal.confidence 与 canon.confidence 职责边界仍未明确**：change-proposal.md 中 confidence 字段说明为"AI 对此提案可信度的评估"，ingest.md 中 proposal 示例直接写 `confidence: medium`，但 compile 会按自身规则重新计算最终值并覆盖。v2 已指出这是潜在误导，v3 未在任何 spec 或 schema 中添加说明（如"此字段为建议值，compile 阶段将按规则重新确定"），问题依然存在。
- **confidence 升级路径 B 的 staleness_days=0 条件过于严格**：路径 B 要求"`staleness_days == 0`（即当日刚完成 compile）"，这意味着如果第一次 compile 引入第 1 个 secondary source、第二次 compile 引入第 2 个 secondary source（隔日操作），路径 B 永远无法触发——因为第二次 compile 当天 staleness_days=0，但第一次来源 staleness_days 已不为 0。这是一个设计缺陷，导致路径 B 在多次增量 compile 的实际使用场景中几乎不可达。
- **reconcile confidence 重评估与 compile 规则使用不同的 authority 枚举**：已在属性5中指出，此处再次确认：reconcile.md 重评估规则使用 high/medium/low 枚举，compile.md 初始值规则使用 authoritative/secondary/unverified 枚举，authority 字段的枚举值不统一是规范层面的一致性问题，可能导致执行者按错误枚举评估 confidence。

### 新发现的问题

- **reconcile Gate 2 与 confidence 重评估规则存在冲突**：如上属性5"仍存在问题"第3条所述，Gate 2 的断言逻辑在"裁决成功但来源 authority 均为 low"的合法场景下会误报失败，属于 Gate 设计本身的 bug，可能导致正常的 reconcile 流程被错误标记为 `QUALITY_GATE_FAIL`。
- **canon-page schema 中无 `has_divergence` 字段定义**：reconcile.md Step 5 规定 `keep_both` 裁决时在 canon 页 frontmatter 追加 `has_divergence: true`，但 canon-page.md schema 中未定义此字段，亦无字段说明。这是 reconcile spec 与 schema 之间的不一致：spec 产生的字段在 schema 中不存在，可能导致 lint L010 类型检查报错或维护者无法理解该字段含义。
