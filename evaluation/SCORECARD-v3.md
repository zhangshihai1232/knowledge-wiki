---
type: scorecard
version: 3.0
evaluated_at: 2026-04-09
evaluation_type: design-review（基于 P0/P1 修复后的 spec/schema 文档）
p0_fixes_applied: P0-1（staleness动态计算）、P0-2（reconcile spec）
p1_fixes_applied: P1-1（confidence lifecycle）、P1-2（refresh spec）、P1-3（review burden control）
---

# LLM Wiki 知识治理质量评分卡 v3

> 评估日期：2026-04-09
> 评估类型：设计审查（P0/P1 修复后）
> 评估对象：.wiki/policy/specs/ + .wiki/policy/schemas/（修复后版本）

---

## 评分总览（三版对比）

| # | 质量属性 | v1 设计审查 | v2 实际运行 | v3 修复后 | 变化 | 核心原因 |
|---|---------|------------|------------|----------|------|---------|
| 1 | 知识提取保真度 | 6/10 | 7/10 | 7/10 | = | Step 4.5 新增质量预评分和去重机制是进步，但 QG-2 无可执行验证方法、AI 综合性归纳禁止条款缺失两项核心缺陷均未修复 |
| 2 | 来源可追溯性 | 7/10 | 8/10 | 9/10 | ↑+1 | promote 移动语义已明确（写入后删除源文件），compile 新增 Gate 1b 路径有效性检查和 FALLBACK_SOURCE 标注，四级追溯链设计趋于完整 |
| 3 | 导航可达性 | 6/10 | 6/10 | 8/10 | ↑+2 | CRITICAL-3（pages 字段始终为空）完整修复：compile Step 5 新增 pages 字段同步规则，实际数据文件已验证正确；剩余扣分为 L001 自动修复只写 pages 不写正文条目 |
| 4 | 知识关联准确性 | 5/10 | 7/10 | 7/10 | = | compile Step 4 扫描机制未变，v2 建议的反向引用一致性检查、新增 lint 规则、cross_refs 来源区分三项改进均未落实 |
| 5 | 冲突发现与解决 | 5/10 | 4/10 | 7/10 | ↑+3 | 三项 CRITICAL 问题均已修复：reconcile.md 新建且完整、compile 新增 create-with-conflict 场景、change-proposal 新增 conflict 状态；ingest 与 compile 冲突信号格式仍有衔接歧义 |
| 6 | 置信度准确性 | 4/10 | 6/10 | 6/10 | = | compile 升级规则已完整定义，staleness 衰减规则就位；但 proposal.confidence 与 canon.confidence 职责边界未说明，路径 B 的 staleness=0 条件在增量 compile 场景下实际不可达 |
| 7 | 陈旧知识处理机制 | 4/10 | 3/10 | 7/10 | ↑+4 | P0-1 完整落地：last_updated 字段写入 schema 和三个实际页面，lint L002/L005 动态计算逻辑就位；compile 的 staleness 衰减规则仍读取静态字段（P0-1 仅修复了 lint 侧），存在高严重性残留问题 |
| 8 | 知识库活跃度 | 3/10 | 3/10 | 4/10 | ↑+1 | STATE.md 新增 confidence_distribution 等趋势指标；但系统仍是纯被动响应式，三个实际页面全部 confidence=low 且升级路径苛刻，confidence 体系实质单向下行 |
| 9 | 人工审查有效性 | 6/10 | 5/10 | 8/10 | ↑+3 | CRITICAL-4（approve_note 非强制）已修复：schema 正式收录并设七项占位符黑名单；HIGH-1（移动变副本）已修复；100% approve 率无预警机制仍未解决 |
| 10 | 审查负担可控性 | 4/10 | 7/10 | 7/10 | = | P1-3 的 auto_quality_score 路由和去重机制写入 spec；但 pending_proposals 在 compile.md 与其他 spec 中定义仍不一致，LOG 文件路径歧义未解决 |
| 11 | 知识缺口主动发现 | 5/10 | 4/10 | 5/10 | ↑+1 | write-back 触发条件已量化为 25% 阈值，可操作性有实质提升；但缺口发现仍为完全被动模式，lint 10 条规则无一覆盖内容层面缺口 |
| 12 | 查询回答可信度标注 | 7/10 | 7/10 | 7/10 | = | 三级标注体系设计维持 v2 水平；"合理推断"与"训练知识"界定模糊问题未改进，P1-3 仅修复了 write-back 触发阈值而非标注本身 |

**加权总分**：v1 62/120（52%）→ v2 67/120（56%）→ v3 82/120（68%）

---

## P0/P1 修复效果评估

### 已完全修复的问题

- **[CRITICAL-1] staleness 计时机制根本失效**（属性7）：`canon-page.md` schema 新增 `last_updated` 字段，lint spec Step 1 增加动态计算逻辑（`effective_staleness_days = 今日 - last_updated`），L002/L005 触发条件更新为 `effective_staleness_days`，三个实际页面已全部包含 `last_updated: "2026-04-08"`。lint→refresh→maintain 主链已恢复。

- **[CRITICAL-2] 新建页面内部冲突盲区**（属性5）：compile.md 新增专项 `create-with-conflict` 场景，检测到内部分歧后插入 `<<<CONFLICT>>>` 标记、设置 `confidence: low`，并将 proposal 路由至 `changes/conflicts/`。reconcile.md 已新建且包含完整的冲突处理闭环（Purpose/Steps/SLA/Quality Gates）。change-proposal.md status 枚举新增 `conflict` 状态。

- **[CRITICAL-3] pages 字段始终为空**（属性3）：compile spec Step 5 明确 pages 字段同步规则（create 追加、archive 移除、update/merge/split 条件同步），index-page schema 新增完整 pages 字段规范，实际 `ai/_index.md` 已验证 pages 字段正确填充。

- **[CRITICAL-4] approve_note 非强制**（属性9）：change-proposal.md schema 将 `approve_note` 列为条件必填（approved 时必填，≥10字），promote.md Gate 1 明确七项占位符黑名单（同意/ok/approve/通过/yes/好的/确认），字段已进入 schema 正式定义。

- **[HIGH-1] promote 移动变副本**（属性2/9）：promote.md Step 3 操作 A 新增明确说明："移动意为：在目标目录写入文件后，删除源目录的原始文件，确保同一提案不在两个目录同时存在。"approve 和 reject 两个分支均已覆盖。

### 已部分修复的问题

- **P0-1 staleness 动态计算**（属性7）：lint 侧已完整修复，但 compile.md 的 staleness 衰减规则仍读取静态 `staleness_days` 字段（每次 compile 后重置为 0），衰减逻辑在实际中仍无法触发。修复了发现机制（lint），未修复衰减机制（compile）。

- **[NEW-5] confidence 升级路径不可达**（属性6/8）：compile.md 新增路径 B（≥2 个 secondary 来源且内容一致且当日 staleness=0），改善了可达性设计。但路径 B 的 `staleness_days=0` 条件要求当日刚完成 compile，在多次增量 compile 的实际场景中仍几乎不可达。

- **P1-3 审查负担控制**（属性10/11）：ingest.md 新增质量预评分路由（auto_quality_score < 0.4 转 low-quality/）和同一 target_page 去重追加机制，query.md 的 write-back 触发阈值已量化为 25%。但 pending_proposals 在 compile.md 与其他 spec 中的定义矛盾未消除，LOG 文件路径歧义未修复。

### 未修复的问题

- **[HIGH-3] AI 添加评价性判断句**（属性1）：ingest spec Step 3 声明约束仍缺乏对"AI 自主归纳性结论句"的显式禁止，QG-2（正文未改写）仍无可机械执行的验证手段。

- **[NEW-4] pending_proposals 定义不一致**（属性10）：compile.md 第 200 行仍将其定义为"approved/ 中 compiled!=true 的文件数"，其他 spec 定义为"inbox+review 文件数"，矛盾未消除。

- **[NEW-6] 两个 LOG 文件并存**（属性10）：promote.md 仍指向 `changes/LOG.md`，lint.md 仍使用"或"语法保留歧义，用途边界未统一说明。

- **单向关联无检测规则**（属性4）：lint L001–L010 无新增反向引用一致性检测规则，v2 建议的三项改进均未落实。

- **100% approve 率无预警机制**（属性9）：系统仍无任何机制检测连续全部批准的异常模式。

- **"合理推断"界定模糊**（属性12）：query.md Step 4 推断标注条件文字与 v2 完全相同，操作性定义未补充。

---

## 新发现的问题（v3 新增）

### 来自属性1（A1-knowledge-ingestion）

- **[LOW] Step 4.5 质量预评分"与 canon 差异度"维度依赖 AI 主观判断**：该维度（30%权重）未给出差异度计算方法，实质上是 AI 对自身输出的主观评分，可能出现系统性偏高或偏低，影响路由决策可靠性。
- **[LOW] Step 4.5 去重追加机制可能导致 proposal 声明列表无上限膨胀**：同一 target_page 多次 ingest 时声明列表无追加上限，若 proposal 长期未被 promote，Source 证据节可能无限增长。

### 来自属性2（A2-knowledge-structure）

- **[MEDIUM] lint L001 自动修复只写 pages，不写正文条目**：修复后的 `_index.md` 出现"pages 有条目但正文无对应行"的不对称状态，不符合 index-page schema 正文结构规范。
- **[LOW] index-page schema 的 pages 路径格式与 lint L001 检测逻辑未显式对齐**：两者路径格式存在实现时产生不匹配误报的风险。

### 来自属性3（A3-knowledge-consistency）

- **[HIGH] reconcile.md 与 compile.md 对 confidence 重评估规则不一致**：reconcile 使用 high/medium/low 枚举，compile 使用 authoritative/secondary/unverified 枚举，两套规则存在逻辑矛盾，维护者执行时可能产生歧义。
- **[CRITICAL] `changes/conflicts/` 目录初始化问题未解决**：compile.md 和 reconcile.md 均依赖该目录存在，但 spec 无任何步骤负责在目录不存在时创建，文件移动操作将失败导致触发链断裂。
- **[MEDIUM] reconcile Gate 2 与 confidence 重评估规则存在冲突**：Gate 2 断言逻辑在"裁决成功但来源 authority 均为 low"的合法场景下会误报失败，属于 Gate 设计本身的 bug。
- **[LOW] canon-page schema 中无 `has_divergence` 字段定义**：reconcile.md Step 5 规定 keep_both 裁决时追加该字段，但 schema 未定义，可能导致 lint 类型检查报错。

### 来自属性4（A4-knowledge-freshness）

- **[HIGH] compile.md 与 lint.md 动态计算范围不对称**：lint 已统一到 `effective_staleness_days`，compile 衰减逻辑未跟进，同一系统内两套 staleness 计算方式共存，增加长期维护认知负担。
- **[LOW] lint 报告示例仍使用静态 staleness_days 值**：文档示例与实现不一致，误导执行者。
- **[LOW] STATE.md 的 avg_staleness_days: 0 可能制造虚假健康信号**：无健康阈值告警，运营者可能长期不知道知识库正在老化。
- **[MEDIUM] confidence_distribution 全为 low 的状态未触发任何告警**：STATE.md 未对 confidence_distribution 设置健康阈值，质量退化不可见。

### 来自属性5（A5-governance-usability）

- **[LOW] approve_note 字数下限偏低**：10 字可以是模板化句子（如"来源可靠，内容准确，建议通过"），未真正强制实质性审查说明，v2 建议的 20 字更合理。
- **[LOW] P1-3 修复了 write-back 触发阈值但未修复推断标注本身**：触发条件量化了但 Step 4 的推断标注界定仍模糊，造成不一致。

---

## 跨维度 Top 问题（v3 视角，按影响程度排序）

1. **[CRITICAL] `changes/conflicts/` 目录初始化缺失**（属性5）：compile 和 reconcile 均依赖该目录，目录不存在时整条冲突治理链断裂，是新修复的 reconcile 路径的隐患根源。
2. **[CRITICAL] confidence=low 无实际升级路径**（属性8）：三个实际页面全部 confidence=low，升级条件在真实使用中几乎不可达，confidence 体系实质单向下行，知识质量无法正向积累。
3. **[HIGH] compile.md staleness 衰减规则仍依赖静态字段**（属性7）：P0-1 只修复了 lint 侧，compile 的衰减逻辑仍读取每次 compile 后重置为 0 的静态字段，衰减机制在实际中仍无法触发。
4. **[HIGH] reconcile.md 与 compile.md 的 confidence 枚举不一致**（属性5/6）：两套规则使用不同枚举体系，存在逻辑矛盾，是冲突闭环修复后引入的新一致性风险。
5. **[HIGH] compile.md 与 lint.md 动态计算范围不对称**（属性7）：同一系统内两套 staleness 计算方式共存，长期维护认知负担高。
6. **[HIGH] QG-2 无可机械执行的验证方法**（属性1）：AI 自我声明式目视检查无法阻止批量执行时的跳过，保真度质量门形同虚设。
7. **[HIGH] 系统缺乏主动质量驱动机制**（属性8）：所有质量改善动作均需外部事件触发，low confidence 页面一旦产生若无新资料摄入可能永久停留。
8. **[MEDIUM] ingest 与 compile 冲突信号格式衔接歧义**（属性5）：ingest 写 blockquote 格式 `> ⚠️ 冲突：…`，compile 检测"声明含 `⚠️` 前缀"，两者格式不完全一致，create-with-conflict 路径可能被绕过。
9. **[MEDIUM] pending_proposals 定义在 compile.md 与其他 spec 中仍不一致**（属性10）：STATE.md 状态准确性无法保证。
10. **[MEDIUM] "合理推断"界定缺乏操作性标准**（属性12）：AI 可将训练知识以"推断"名义标注，绕过 Gate 2 禁止。

---

## 优先改进建议（v3 后续）

| 优先级 | 改进项 | 涉及文件 | 预期效果 |
|--------|--------|----------|----------|
| P0 | 初始化 `changes/conflicts/` 目录（在 compile spec 或系统初始化步骤中补充目录创建逻辑） | `compile.md` 或初始化 spec | 防止新修复的冲突治理链在目录不存在时断裂，保护 reconcile 路径可用性 |
| P0 | 修复 compile.md 的 staleness 衰减逻辑，将 `staleness_days > 90/180` 改为 `(今日 - last_compiled).days > 90/180` | `compile.md` | 打通 P0-1 未完成的后半段修复，使 confidence 衰减机制在实际中可触发 |
| P0 | 统一 reconcile.md 与 compile.md 的 confidence authority 枚举体系（选定一套后两个 spec 对齐） | `reconcile.md` + `compile.md` | 消除冲突解决后 confidence 重评估的逻辑矛盾，防止 reconcile 结果被误判 |
| P1 | 放宽 confidence 升级路径 B 的触发条件：将 `staleness_days=0` 改为"30天内有 compile"或"来源数≥2 且近期无冲突"，使 medium confidence 在正常使用中可达 | `compile.md` | 解决 confidence 体系单向下行问题，使知识质量提升成为可能 |
| P1 | 在 canon-page schema 中新增 `has_divergence` 字段定义，并在 reconcile Gate 2 断言中修复"keep_both 且来源均为 low 时的假阳性"逻辑 | `canon-page.md` + `reconcile.md` | 消除 schema-spec 不一致和 Gate 设计 bug，使 reconcile 流程可靠完成 |
| P1 | 在 ingest spec Step 3 中明确禁止 AI 归纳性结论句："声明中不得包含未出自原文任何位置的归纳性判断句；若需归纳，必须以'（AI归纳，非原文）'显式标注" | `ingest.md` | 关闭 QG-2 无法发现的 AI 语义改写漏洞，提升保真度 |
| P1 | 在 ingest 与 compile spec 中统一冲突信号格式：明确规定 compile create-with-conflict 检测的是 blockquote `> ⚠️` 格式 | `ingest.md` + `compile.md` | 消除冲突信号格式衔接歧义，确保 ingest 标注的冲突能被 compile 正确识别 |
| P2 | 统一 pending_proposals 定义：将 compile.md 中的定义与 promote/ingest/state-log 对齐，均为"inbox+review 文件数" | `compile.md` | 保证 STATE.md 状态准确性，消除 spec 内部矛盾 |
| P2 | 合并或明确区分两个 LOG 文件（`policy/LOG.md` vs `changes/LOG.md`），在所有 spec 中统一路径引用 | 所有相关 spec | 消除执行者在日志写入时的选择混乱 |
| P2 | 在 STATE.md 健康节中增加 confidence_distribution 告警阈值（如"low 占比 > 80% 标记为 degraded"）和 avg_staleness_days 趋势告警 | `state-log.md` + STATE.md | 使知识库健康退化可见，运营者能主动干预而非等待 lint 触发 |
| P2 | 在 query spec 中为"合理推断"补充操作性定义，并增加独立的"训练知识"标注级别与推断明确区分 | `query.md` | 使 Gate 2 的"禁止伪装"约束真正可执行 |

---

## 整体评估结论

**P0/P1 修复是否有效？哪些修复效果最显著？**

P0/P1 修复整体有效，四项 CRITICAL 问题（staleness 计时失效、新建页面冲突盲区、pages 字段为空、approve_note 非强制）均已在规范层面得到修复，加权总分从 v2 的 67/120（56%）提升至 82/120（68%），提升幅度 12 个百分点。效果最显著的三项修复是：staleness 动态计算（属性7 从 3→7，提升 4 分，打通了整条时效性链条）、新建页面冲突路径（属性5 从 4→7，提升 3 分，关闭了最大的逻辑覆盖盲区）、approve_note 强制化（属性9 从 5→8，提升 3 分，使人工审查有效性从设计上具备可信度）。

**系统现在处于什么状态？距离"能自主治理知识健康"还差什么？**

系统已从"能存储知识但无法治理健康"进化为"能发现问题并提供治理路径"，核心 spec 覆盖盲区已基本修补，各质量保障机制在设计层面已大部分闭环。但系统仍距"自主治理知识健康"有三个关键差距：一是 confidence 体系实质单向下行（三个实际页面全部 confidence=low，升级路径在真实场景中几乎不可达），知识质量无法正向积累；二是仍是被动响应式架构（所有质量改善依赖外部事件触发，无主动质量驱动机制，静默盲区无法探测）；三是存在若干修复引入的新一致性问题（reconcile 与 compile 的 confidence 枚举矛盾、`changes/conflicts/` 目录初始化缺失）可能导致新修复的冲突治理路径在实际执行时断裂。

**下一步最值得投入的改进方向是什么？**

最值得投入的方向有两个：第一，完成 P0-1 的后半段修复——将 compile.md 的 staleness 衰减逻辑改为动态计算，并修复 reconcile 与 compile 的 confidence 枚举不一致，这两处修复成本极低但能保护已有修复成果不被新引入的逻辑矛盾抵消；第二，重新设计 confidence 升级路径，放宽路径 B 的触发条件，使 medium confidence 在正常使用（多次增量 compile）中可达——这是解锁知识质量正向飞轮的前置条件，只要 confidence 体系维持单向下行，整个知识库的长期健康质量就无法通过设计机制保障。
