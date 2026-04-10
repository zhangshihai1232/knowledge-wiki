---
type: finding
version: v3
evaluated_at: 2026-04-09
agent: A4-knowledge-freshness
---

# 知识时效性层评估报告 v3

> 对比基准：v2（属性7=3/10，属性8=3/10）

## 属性7：陈旧知识处理机制

### 评分：7 / 10（vs v2: 3/10，变化：↑+4）

### 评分依据

P0-1 修复方案已完整落地：`canon-page.md` schema 新增了 `last_updated` 字段，`lint.md` Step 1 增加了动态计算逻辑（`effective_staleness_days = 今日 - last_updated`），L002 和 L005 触发条件均已更新为使用 `effective_staleness_days`，三个实际 canon 页面也已全部包含 `last_updated: "2026-04-08"`——这意味着 v2 发现的 CRITICAL-1（staleness 计时机制根本失效）已被彻底修复，整条时效性链条（lint L002/L005 → refresh → maintain → confidence 衰减触发）从理论上已恢复运转。但 `compile.md` 的 staleness 衰减规则仍读取静态 `staleness_days` 字段而非动态计算，在 `last_compiled` 超过阈值后衰减逻辑仍然失效，加之 `maintain.md` 的"无近期引用"归档条件依然缺乏可计算字段，整体距"完全可运行"还有局部残留问题。

### v2 问题修复状态（逐一核查）

- **canon-page.md 增加 `last_updated` 字段**：**已修复** — schema Frontmatter 字段表已明确列出 `last_updated`（必填，YYYY-MM-DD），说明为"由 compile 写入；lint 优先用此字段动态计算 effective_staleness_days"。三个实际 canon 页（vector-db-comparison、chunk-size-strategy、finetuning-vs-rag）均已包含 `last_updated: "2026-04-08"`。

- **lint.md 增加动态计算逻辑**：**已修复** — Step 1 第 2 步之后插入了完整的动态计算段落，规则为：若 `last_updated` 存在则 `effective_staleness_days = (今日日期 - last_updated).days`；`last_updated` 缺失则回退 frontmatter 静态值；静态值也缺失则视为 0。"不写回文件"的设计保持了 lint 无副作用原则。

- **L002 更新为 effective_staleness_days**：**已修复** — L002 触发条件已更新为 `effective_staleness_days > 90`，并附有括号说明动态计算逻辑及回退路径，与 Step 1 中的计算规则保持一致。

- **L005 更新为 effective_staleness_days**：**已修复** — L005 触发条件已更新为 `confidence=low` 且 `effective_staleness_days > 30`，并注明"lint 运行时动态计算，同 L002"，实现了与 L002 统一的计算语义。

- **整条时效性链条恢复运转**：**部分** — L002→refresh→maintain 这条主链已恢复（lint 现在可以正确触发 L002/L005，进而触发 refresh 和 maintain）。但有两处残留问题：
  1. `compile.md` 的 staleness 衰减规则（high > 90 天降 medium，medium > 180 天降 low）仍依赖 frontmatter 的静态 `staleness_days` 字段（该字段在每次 compile 后被重置为 0），而未改为读取 `(今日 - last_compiled).days`。这意味着 compile 的 staleness 衰减在实际中仍然无法触发——除非手动修改 frontmatter。
  2. `refresh.md` Step 1 和 Step 3A 的"计算 effective_staleness_days"和"重置 staleness_days"逻辑已与 P0-1 方案一致，可正常运行。

### 已做好的部分

- **P0-1 核心修复完整落地**：schema、lint spec、实际数据文件三层全部对齐，`last_updated` 字段已成为有效的时效性计时锚点，v2 的根本性机制空洞已被填补。

- **动态计算的设计选择正确**：选择"lint 运行时计算、不写回文件"而非"后台定时任务写回 frontmatter"，避免了大量 git diff 噪音和额外调度系统复杂度，符合 lint.md Purpose 中"不修改 canon 内容本身"的原则。

- **回退路径有充分的向后兼容性**：对缺少 `last_updated` 的历史页面，依次回退至静态 `staleness_days`、再回退至 0，保证旧数据不会因字段缺失导致计算崩溃。

- **compile.md Step 3 同步更新了 `last_updated`**：明确写入 `last_updated: <今日日期>`，并注释"供 lint 动态计算 staleness"，形成了 compile → lint 的完整闭环。

- **refresh.md 已与新字段体系对齐**：Step 1 使用 `effective_staleness_days = (今日日期 - last_updated).days`，与 lint 的计算语义完全一致。

- **分层阈值和归档机制设计保持完整**：30 天（L005 低置信预警）→ 90 天（L002 陈旧警告）→ 180 天（归档候选）的梯度不变，refresh/maintain 的边界划分（1-2 条 vs ≥3 条 L002）清晰。

### 仍存在的问题

- **[HIGH] compile.md 的 staleness 衰减规则仍依赖静态字段**：`compile.md` "staleness 衰减规则"一节，衰减条件为 `staleness_days > 90`（high 降 medium）和 `staleness_days > 180`（medium 降 low），读取的是 frontmatter 中的静态 `staleness_days` 字段，而该字段在每次 compile 后被重置为 0。P0-1 方案只修复了 lint spec，未同步修复 compile spec 的衰减逻辑。正确做法应改为 `(今日 - last_compiled).days`，与 lint 的动态计算保持一致。

- **[MEDIUM] "无近期引用"归档条件仍不可计算**：`maintain.md` 内容归档触发条件为"staleness > 180 天且无近期引用"，但 schema 中仍不存在 `last_referenced_date` 字段，"近期"的天数定义也未明确，该条件在现有系统中仍无法客观计算，实际执行时只能依靠人工判断。

- **[LOW] lint 报告示例仍使用静态 staleness_days 值**：lint.md 报告示例中仍显示 `staleness_days=95`（静态值），而非动态计算的 `effective_staleness_days=N` 表达，存在细微的文档与实现不一致。

### 新发现的问题

- **compile.md 与 lint.md 动态计算范围不对称**：lint 的动态计算已统一到 `effective_staleness_days`，但 compile 的衰减逻辑未跟进，形成同一系统内两套 staleness 计算方式共存的局面，增加了长期维护的认知负担。

---

## 属性8：知识库活跃度

### 评分：4 / 10（vs v2: 3/10，变化：↑+1）

### 评分依据

STATE.md 新增了 `confidence_distribution`（low/medium/high 各页面数）和 `avg_staleness_days` 等趋势指标，使知识库健康状态初步可量化，v2 "纯静态计数"的问题有所改善。但系统整体仍是被动响应式设计——所有质量提升动作（compile、refresh、maintain）均需外部事件触发，没有内置的主动质量驱动机制；`confidence` 体系在正常使用中极难突破 low 状态（three 个实际页面全部 confidence=low，升级条件过于苛刻）；属性7修复虽使 lint→refresh 链条在理论上恢复运转，但整体"正向飞轮"仍不存在。

### v2 问题修复状态

- **系统纯被动响应式**：**未改进** — 仍然没有任何 spec 会主动发起"这个页面质量不足，需要改善"的动作。lint 每日定期运行会被动发现问题，但 refresh 和 maintain 被动等待 lint 报告触发，compile 只在有 approved proposal 时运行。没有引入时间驱动的主动 review 机制（如"每季度对 confidence=low 且 staleness>60 的页面生成 review 清单"）。

### 已做好的部分

- **STATE.md 增加了趋势指标**：v3 的 STATE.md 已包含 `confidence_distribution`（high: 0, medium: 0, low: 3）和 `avg_staleness_days: 0`，使知识质量状态初步可量化跟踪。这是 v2 建议的改进之一，已得到落实。

- **属性7修复打通了 lint→refresh 链条**：`last_updated` 字段的引入使 lint L002/L005 可以在 91+ 天后真正触发，进而驱动 refresh spec 运行，系统的最基础自动化质量巡检能力已恢复。

- **confidence 衰减机制设计正确**：compile spec 中 high 置信页面长期未更新后自动降级的单向保鲜机制，体现了时效性意识。lint→L005→confidence-review 的联动链条设计合理，低置信长期未处理的页面会自动生成 review 任务。

- **归档机制防止低质量内容积累**：长期陈旧无引用的页面最终归档，active 知识库不会无限膨胀。

### 仍存在的问题

- **[CRITICAL] confidence=low 无实际升级路径**：三个实际 canon 页面全部 confidence=low（来源均为 secondary 或 unverified）。low→medium 需要"至少 1 个 authority=authoritative 来源且无冲突"（路径 A）或"至少 2 个 secondary 来源且内容一致且当日 staleness=0"（路径 B）。在真实使用中，绝大多数来源是 secondary 或 unverified，authoritative 来源极少；路径 B 的"当日 staleness=0"又要求当天刚完成 compile 才满足，条件苛刻。整体 confidence 体系实际是单向下行。

- **[CRITICAL] 系统缺乏主动质量驱动**：没有任何 spec 会在没有外部事件的情况下主动发起质量改善动作。lint 虽然每日定期运行，但只能"发现问题"，不能"主动推动改善"。low confidence 页面一旦产生，如果没有新资料摄入或人工触发，可能永久停留在 low 状态。

- **[HIGH] confidence 升级路径仍过于严苛**：medium→high 需要"人工 promote + staleness=0（当日刚编译）+ 距上次冲突 > 90 天"三个条件同时满足。high 状态对大多数知识库而言几乎不可达，导致 confidence 分布长期集中在 low，无法反映知识质量的真实状况。

- **[HIGH] 无使用反馈→知识改善路径**：用户使用 wiki 过程中发现错误或过时信息，没有标准路径将反馈转化为知识更新动作。v2 建议增加轻量级 `action: flag-stale` 提案类型，v3 未实现。

- **[MEDIUM] 领域分裂效果无追踪机制**：L007 触发领域分裂后，没有机制验证分裂是否有效解决了原问题，也没有记录分裂前后的状态对比。STATE.md 的 `maintenance_log` 格式有定义，但后续 lint 是否验证改善效果在设计中未明确。

- **[MEDIUM] compile_rate_30d 等关键活跃度指标仍为空**：STATE.md 虽新增了 `confidence_distribution` 等字段，但 `compile_rate_30d`、`archive_rate_30d` 等反映活跃度变化趋势的字段仍为 `~`（未记录），知识库"是否越来越活跃"仍无法量化判断。

### 新发现的问题

- **STATE.md 的 `avg_staleness_days: 0` 可能制造虚假健康信号**：当前三个 canon 页均在 2026-04-08 编译，今日（2026-04-09）计算 `avg_staleness_days` 为 1，接近 0。但随着时间推移，若不再有新资料摄入，该值会持续增长而不被注意到，直到 lint 触发 L002。STATE.md 没有设置对应的健康阈值告警，运营者可能在较长一段时间内不知道知识库正在老化。

- **confidence_distribution 全为 low 的状态未触发任何告警**：three 个页面全部 confidence=low，这是一个明显的健康信号，但 STATE.md 中"系统健康"节只记录 `status: active` 和 `open_conflicts: 0`，没有对 confidence_distribution 设置告警阈值（如"low 占比 > 80% 则标记为 degraded"），运营者看不到这一质量问题。
