---
type: findings
agent: A4-知识时效性层
evaluated_at: 2026-04-08
evaluation_type: live-run
---

# 知识时效性层评估报告

## 属性7：陈旧知识处理机制

### 评分：3 / 10

### 评分依据

系统设计了多级阈值（L005 30天低置信预警、L002 90天陈旧警告、maintain 180天归档）和 refresh spec 处理单页陈旧，结构上看起来完整。但存在一个**根本性机制空洞**：`staleness_days` 在 compile 后被重置为 0，但之后**没有任何 spec 或规则定义它如何随时间增长**。

lint L002 设计了双重计算路径：优先用 `(今日 - last_updated)` 动态计算，缺 `last_updated` 则回退静态字段。但 canon-page schema 中**不存在 `last_updated` 字段**，三个实际 canon 页均无该字段，静态 `staleness_days` 又永远是 compile 写入的 0。结果是：L002 的两条路径都失效，陈旧检测在实际中**永远不会触发**，整套时效性管理机制形同虚设。

### 实际运行中做好的部分

- **分层阈值设计合理**：30 天（L005 低置信预警）→ 90 天（L002 陈旧警告）→ 180 天（归档候选），梯度清晰，不同风险等级有对应处理规则。
- **lint L002 的动态计算意图正确**：spec 设计了用 `last_updated` 动态计算而非依赖静态字段，这个思路是对的——问题出在 schema 未定义该字段，导致意图无法落地。
- **refresh spec 存在且流程完整**：refresh.md 定义了 1-2 条 L002 时的单页处理流程（路径 A：内容确认；路径 B：重新摄入；路径 C：归档建议），与 maintain spec（≥3 条触发）的边界划分清晰。
- **归档触发条件有双重门禁**：staleness > 180 天且无近期引用，防止误归档仍被引用的历史稳定页面。
- **归档保留文件本体**：status=archived 不删除文件，仅从导航中移除，满足审计需求。

### 实际发现的问题

- **[CRITICAL] staleness_days 计时机制根本失效**：compile spec 在 Step 3 明确写入 `staleness_days: 0`，但整个系统（含 lint、refresh、maintain、STATE）中**没有任何规则定义 staleness_days 的递增逻辑**。lint spec Step 1 虽然提到"动态计算 effective_staleness_days = 今日 - last_updated"，但 canon-page schema 中无 `last_updated` 字段，三个实际 canon 页（vector-db-comparison、chunk-size-strategy、finetuning-vs-rag）均无该字段，静态 `staleness_days` 永为 0，导致 L002 永不触发。

- **[CRITICAL] schema 与 lint spec 之间存在字段断裂**：lint.md Step 1 依赖 `last_updated` 字段进行动态计算，但 canon-page.md schema Frontmatter 字段表中不包含 `last_updated`（仅有 `last_compiled`）。两个核心文档之间的字段不一致是本次运行机制失效的直接原因。

- **[HIGH] refresh spec 的触发条件在现实中永远不满足**：refresh spec 的触发条件是"lint 报告中 L002 条目为 1-2 条"，但由于 L002 永不触发（计时机制失效），refresh spec 也永远不会被调用。两层机制同时失效，产生级联问题。

- **[HIGH] compile 的 staleness 衰减规则无法执行**：compile.md 的"staleness 衰减规则"对未参与本次编译的页面，按 staleness_days 阈值降级 confidence。但该规则依赖 frontmatter 中有效的 `staleness_days` 值（需 > 90 或 > 180 才触发），而实际值永远是 0，衰减规则也实际失效。

- **[MEDIUM] "无近期引用"归档条件可操作性不足**：maintain.md 的归档触发要求"无近期引用"，但 schema 中无 `last_referenced_date` 字段，"近期"的天数定义也未明确，该条件在现有系统中无法客观计算。

### 具体证据

三个 canon 页面的关键字段（实际文件值）：

| 页面 | last_compiled | staleness_days | last_updated |
|------|---------------|----------------|--------------|
| vector-db-comparison.md | 2026-04-08 | 0 | （字段不存在） |
| chunk-size-strategy.md | 2026-04-08 | 0 | （字段不存在） |
| finetuning-vs-rag.md | 2026-04-08 | 0 | （字段不存在） |

lint.md Step 1 中的计算逻辑（原文）：
> 若 frontmatter 存在 `last_updated` 字段（格式 YYYY-MM-DD 或 ISO 8601），则 `effective_staleness_days = (今日日期 - last_updated).days`；若 `last_updated` 字段缺失或无法解析，则回退使用 frontmatter 中存储的 `staleness_days` 静态值；若该值同样缺失，视为 `effective_staleness_days = 0`。

canon-page.md schema 字段表中不包含 `last_updated`，三个实际页面均无此字段，回退到静态 staleness_days=0，effective_staleness_days=0，L002 阈值（> 90）永不满足。

STATE.md 中 `last_lint: ~`（未执行过 lint），进一步确认 lint 机制从未真正运行。

### 改进建议

1. **将 `last_updated` 加入 canon-page schema**（最高优先级）：与 `last_compiled` 并列，`last_compiled` 由系统写入，`last_updated` 记录实质内容更新时间。lint spec 的动态计算逻辑不变，但字段必须在 schema 中定义并在实际页面中存在。

2. **或者，改为基于 `last_compiled` 动态计算**：如果设计意图是"从上次编译后开始计时"，则 lint spec 应改为 `effective_staleness_days = (今日 - last_compiled).days`，无需新增字段，直接用现有字段即可，消除 schema-spec 断裂。

3. **明确 compile staleness 衰减的依赖关系**：compile spec 的衰减规则应使用 `(今日 - last_compiled).days` 而非依赖静态 staleness_days，确保衰减逻辑可执行。

4. **在 maintain.md 中量化"近期引用"**：增加 `last_referenced_date` 字段到 schema，并明确"近期"定义为 90 天，使归档条件完全可计算。

---

## 属性8：知识库活跃度

### 评分：3 / 10

### 评分依据

系统是**完全被动响应式**设计：知识库改善依赖外部事件（新资料摄入触发 compile、人工下达维护指令触发 maintain），没有内置的主动质量提升机制。STATE.md 仅记录 total_sources、total_canon_pages、total_domains 等静态计数，无 confidence 分布、avg_staleness、归档率等趋势指标，系统无法感知自身健康趋势。

本次实际运行后，3 个 canon 页全部 confidence=low，且 confidence 升级路径在实际中无法触发（没有 authoritative 来源）。设计上有 confidence 衰减机制（high→medium→low），但因 staleness 计时失效（属性7问题），衰减也无法执行。飞轮无法转动。

### 实际运行中做好的部分

- **L007 领域溢出 → 领域分裂的结构防退化机制**：单域超 50 页时触发 maintain 分裂，是少数几个主动防止结构退化的设计，防止知识库因膨胀而失去可导航性。

- **confidence 三级标注体系**：页面级 low/medium/high 标注提供了质量可见性基础，至少能区分哪些知识是暂定的。

- **compile 积累效应**：spec 定义每次 compile 将 sources 并集追加到 canon 页，多次 compile 同一页面会累积更多来源，理论上随使用增加内容变丰富。

- **归档机制防止低质量内容积累**：长期陈旧无引用的页面最终归档，活跃库不会被旧内容无限膨胀。

- **confidence 衰减规则的设计理念正确**：compile spec 中定义"高置信页面若长期未更新则自动降级"，这一单向保鲜机制体现了时效性意识，即使当前因 staleness 计时失效而无法运行。

### 实际发现的问题

- **[CRITICAL] 所有 canon 页 confidence 卡在 low，无升级路径**：3 个页面均为 confidence=low（来源均为 secondary/unverified，未达到 authoritative 阈值）。compile spec 定义 low→medium 需要"至少 1 个 authority=authoritative 来源且无冲突"，但系统中几乎所有真实来源都是 secondary 或 unverified，此条件在正常使用中极难满足，confidence 体系实际上是单向下行。

- **[CRITICAL] STATE.md 缺少知识质量趋势指标**：现有字段仅有静态计数（total_sources=3, total_canon_pages=3, total_domains=1）和时间戳。缺失的关键趋势指标：confidence 分布（low/medium/high 各几页）、avg_staleness_days（整体新鲜度）、归档页数与总页数之比、近 30 天 compile 频率。没有这些数据，系统无法判断自己是否在变好。

- **[CRITICAL] 系统缺乏主动质量驱动**：没有任何 spec 会主动发起"这个页面质量不足，需要改善"。lint 发现问题但不驱动修复；refresh/maintain 被动等待 lint 触发；compile 只在有 proposal 时运行。low confidence 页面一旦产生，可能永久停留在 low 状态。

- **[HIGH] 没有使用反馈进入知识改善的路径**：用户使用 wiki 过程中发现错误或过时信息，没有标准路径将反馈转化为知识更新动作。知识质量的提升完全依赖维护者主动操作，而非使用量驱动。

- **[HIGH] confidence 升级路径过于严苛，实际不可达**：medium→high 需要"人工 promote 流程 + staleness_days=0（当日刚编译）+ 距上次冲突 > 90 天"三个条件同时满足，且 high 只能人工授予。这使 high confidence 成为几乎不可达的状态，知识库的整体置信度分布将长期停留在 low/medium。

- **[MEDIUM] 领域分裂机制效果无法追踪**：L007 触发领域分裂后，没有机制验证分裂是否解决了原有问题，也没有记录分裂前后子领域页面数变化。maintain 执行摘要虽有格式定义，但后续 lint 运行是否验证了改善效果，设计中未明确。

### 具体证据

STATE.md 实际内容（2026-04-08 运行后）：
- total_canon_pages: 3
- last_lint: ~（从未执行过 lint）
- last_lint_score: ~（无记录）
- open_conflicts: 0

三个 canon 页 confidence 全为 low，原因：所有来源均为 secondary 或 unverified，未达到 authoritative 阈值。compile spec 原文："若所有来源均为 secondary / unverified，或来源 authority 字段缺失，将 confidence 设置为 low。"

compile spec confidence 升级规则 medium→high 需要三个同时满足的苛刻条件（见"confidence 升级规则"一节），且 high 状态由 compile 的 staleness 衰减规则监控有效期（staleness_days > 90 自动降回 medium）——但因 staleness 计时失效，这一降级机制也无法运行。

测试运行日志记录："confidence 初始值：材料1、2（authority=secondary）→ confidence=low；材料3（authority=unverified）→ confidence=low。三份材料均未达到 authoritative，所以全部为 low。这是正确行为。"

### 改进建议

1. **在 STATE.md 中增加趋势指标**：新增 `confidence_distribution`（包含 low/medium/high 各页面数）、`avg_staleness_days`（所有 active 页面平均值）、`archived_total`、`last_30d_compiles` 等字段，使知识库健康趋势可量化跟踪。

2. **放宽 low→medium 升级条件**：将"至少 1 个 authoritative 来源"改为"至少 2 个 secondary 来源且内容互相一致"作为备选升级路径，使 medium confidence 在正常使用中可达。

3. **引入"周期性主动 review"触发条件**：在 maintain.md 或 lint spec 中增加时间驱动触发（如每季度一次），对 confidence=low 且 staleness_days > 60 的页面生成 review 清单，不只等待资料摄入被动触发。

4. **定义轻量级用户反馈通道**：新增一种最简提案类型（如 `action: flag-stale`），用户可通过提交该类型 proposal 标记页面为疑似过时，标记 ≥2 次自动触发 refresh spec 处理流程。

5. **修复 staleness 计时机制**（见属性7建议1/2）：属性7的修复是属性8活跃度机制运转的前提——confidence 衰减、L002 触发、refresh 流程、maintain 触发均依赖有效的 staleness 值。
