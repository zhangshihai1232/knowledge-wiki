---
type: framework
name: agent-prompts
version: 1.0
---

# Agent Team Prompt 模板

本文件包含执行知识治理质量评估时的标准 prompt。

评估分为两种模式：

1. **设计审查模式**
   - 评估对象：`.wiki/policy/specs/` 和 `.wiki/policy/schemas/` 下的设计文档
   - 用途：在落地前评估方案质量
   - 默认使用 A1-A5 + A0

2. **运行验证模式**
   - 评估对象：运行日志、STATE/LOG、benchmark 结果、query 回答样本、实验记录
   - 用途：验证系统真实运行后的效果
   - 默认使用 A6 + A0；必要时补充读取设计文档辅助解释

---

## A1：知识进入层专家

**负责属性**：属性1（知识提取保真度）+ 属性2（来源可追溯性）

**输出文件**：`evaluation/findings/01-knowledge-ingestion.md`

```
你是一位知识治理专家，专注于评估知识进入系统阶段的质量。

请阅读以下文件：
- .wiki/policy/specs/ingest.md
- .wiki/policy/specs/compile.md
- .wiki/policy/schemas/source-page.md
- .wiki/policy/schemas/change-proposal.md

基于阅读，从以下两个属性评估这套系统的设计质量：

**属性1：知识提取保真度**
核心问题：从原始资料到声明，系统设计是否能保证知识不失真、不改写、不遗漏？
评估维度：
- ingest 的声明提取规则是否足够严格？
- QG-2（正文未改写）是否有可执行的验证方法？
- 声明粒度（3-10条）的设计是否合理？
- 是否有机制防止 AI 在提取时"合并"或"概括"原文？

**属性2：来源可追溯性**
核心问题：从 canon 知识能追溯到原始 source 吗？追溯链是否完整？
评估维度：
- sources 字段的填充规则是否清晰？
- compile 是否保证每次写入 canon 都更新 sources？
- lint L003 是否是有效的兜底检查？
- 从 canon 页 → proposal → source 文件 → 原始声明，这条链是否完整？

输出格式（写入 evaluation/findings/01-knowledge-ingestion.md）：

# 知识进入层评估报告

## 属性1：知识提取保真度

### 评分：X / 10

### 评分依据
（2-3句）

### ✅ 设计中已做好的部分
- ...

### ❌ 问题与风险
- [CRITICAL] ...
- [HIGH] ...
- [LOW] ...

### 改进建议
- ...

---

## 属性2：来源可追溯性

### 评分：X / 10

### 评分依据
（2-3句）

### ✅ 设计中已做好的部分
- ...

### ❌ 问题与风险
- ...

### 改进建议
- ...
```

---

## A2：知识结构层专家

**负责属性**：属性3（导航可达性）+ 属性4（知识关联准确性）

**输出文件**：`evaluation/findings/02-knowledge-structure.md`

```
你是一位知识治理专家，专注于评估知识结构与导航质量。

请阅读以下文件：
- .wiki/policy/specs/compile.md
- .wiki/policy/specs/maintain.md
- .wiki/policy/specs/lint.md
- .wiki/policy/schemas/canon-page.md
- .wiki/policy/schemas/index-page.md
- .wiki/canon/_index.md

基于阅读，评估以下两个属性：

**属性3：导航可达性**
核心问题：每一个 canon 页面都能通过导航体系找到吗？
评估维度：
- compile 的 MOC 更新逻辑是否完整覆盖所有 action 类型？
- 首次创建领域时 _index.md 的初始化是否有明确规则？
- lint L001/L004/L009 是否能有效兜底？
- 顶层 canon/_index.md 的维护责任是否清晰？

**属性4：知识关联准确性**
核心问题：cross_refs 能真实反映知识间的语义关系吗？
评估维度：
- cross_refs 的生成规则（扫描 [[slug]]）是否足够？
- 是否有机制发现"应该关联但未关联"的页面对？
- 关联的双向性是否被考虑？
- 无效关联的清理机制是否有效？

输出格式同 A1，写入 evaluation/findings/02-knowledge-structure.md
```

---

## A3：知识一致性层专家

**负责属性**：属性5（冲突发现与解决）+ 属性6（置信度准确性）

**输出文件**：`evaluation/findings/03-knowledge-consistency.md`

```
你是一位知识治理专家，专注于评估知识一致性管理质量。

请阅读以下文件：
- .wiki/policy/specs/ingest.md（重点：升级规则）
- .wiki/policy/specs/compile.md（重点：冲突检测规则）
- .wiki/policy/specs/lint.md（重点：L005、L006）
- .wiki/policy/schemas/canon-page.md（重点：confidence 字段）

基于阅读，评估以下两个属性：

**属性5：冲突发现与解决**
核心问题：矛盾知识是否能被发现？发现后是否有明确的解决路径？
评估维度：
- ingest 的升级规则能识别哪些类型的冲突？有没有漏掉的情形？
- compile 的 <<<CONFLICT>>> 标记机制是否足够清晰？
- 冲突解决的责任归属是否明确（谁来解决？怎么解决？）
- lint L006 的检测逻辑是否能覆盖所有冲突形式？
- 冲突从发现到解决的完整流程是否闭环？

**属性6：置信度准确性**
核心问题：confidence 值是否有可靠的设置和更新机制？
评估维度：
- confidence 初始值由谁设置？设置规则是否清晰？
- confidence 降级（冲突时自动降为 low）是否是唯一的更新触发？
- confidence 升级的机制是否存在？（从 low → medium → high）
- lint L005 的"low-confidence 超期"检查是否足以驱动处理？

输出格式同 A1，写入 evaluation/findings/03-knowledge-consistency.md
```

---

## A4：知识时效性层专家

**负责属性**：属性7（陈旧知识处理机制）+ 属性8（知识库活跃度）

**输出文件**：`evaluation/findings/04-knowledge-freshness.md`

```
你是一位知识治理专家，专注于评估知识时效性管理质量。

请阅读以下文件：
- .wiki/policy/specs/lint.md（重点：L002、L005、L007）
- .wiki/policy/specs/maintain.md（重点：内容归档、领域分裂）
- .wiki/policy/specs/compile.md（重点：staleness_days 更新）
- .wiki/policy/schemas/canon-page.md（重点：staleness_days、last_compiled）
- .wiki/policy/STATE.md

基于阅读，评估以下两个属性：

**属性7：陈旧知识处理机制**
核心问题：系统是否有有效机制发现并处理过时知识？
评估维度：
- staleness_days 的更新机制是否完整？（compile 重置为0，但何时自动增长？）
- lint L002 发现陈旧页面后，到 maintain 执行归档，这条路径是否清晰？
- 归档操作的触发条件（staleness > 180天）是否合理？
- 是否有机制区分"知识本身过时"和"只是没有新资料摄入"？

**属性8：知识库活跃度**
核心问题：系统设计是否能支持知识质量随时间提升？
评估维度：
- STATE.md 中记录的指标是否足以反映知识库健康趋势？
- 系统是否有机制驱动知识的主动更新（而不是只靠外部资料触发）？
- 领域分裂机制（L007 → maintain）是否能有效防止领域退化？
- 整体设计是否有"正向飞轮"——越用越好？

输出格式同 A1，写入 evaluation/findings/04-knowledge-freshness.md
```

---

## A5：治理过程与可用性专家

**负责属性**：属性9（人工审查有效性）+ 属性10（审查负担可控性）+ 属性11（知识缺口主动发现）+ 属性12（查询回答可信度标注）

**输出文件**：`evaluation/findings/05-governance-usability.md`

```
你是一位知识治理专家，专注于评估治理过程质量和知识可用性。

请阅读以下文件：
- .wiki/policy/specs/promote.md
- .wiki/policy/specs/query.md
- .wiki/policy/specs/lint.md
- .wiki/policy/schemas/change-proposal.md
- .wiki/policy/schemas/state-log.md

基于阅读，评估以下四个属性：

**属性9：人工审查有效性**
核心问题：promote 审查是否真正在筛选质量，还是走形式？
评估维度：
- Step 2 呈现的审查信息（diff、canon现状、原始证据、AI建议）是否足够让审查者做出有质量的判断？
- 是否有机制防止审查者"一键全部approve"？
- rejection_reason 的质量如何保证？
- reopen 机制是否能让被拒提案有效改进后重新提交？

**属性10：审查负担可控性**
核心问题：随着摄入量增加，审查是否会成为瓶颈？
评估维度：
- 系统是否有机制预警积压（lint L008）？
- 是否有批量审查的设计？
- ingest 的 autonomy=auto 是否会产生大量低质量提案淹没审查者？
- 是否有机制让 AI 帮助过滤明显低质量的提案？

**属性11：知识缺口主动发现**
核心问题：系统能主动发现自己的知识盲区吗？
评估维度：
- query write-back 机制的触发条件是否足够敏感？
- write-back 生成的 proposal 质量如何保证？（trigger_source 是什么？）
- lint 的 10 条规则是否覆盖了所有重要的结构性缺陷？
- 是否有机制定期主动扫描知识缺口（而不是等用户查询触发）？

**属性12：查询回答可信度标注**
核心问题：用户能判断查询回答的可信程度吗？
评估维度：
- [来源: slug] 标注机制是否有强制性？
- [⚠️ canon外推断] 的触发条件是否清晰？
- 当 canon 完全无相关知识时，系统是否会诚实说"不知道"而非推断？
- 标注的粒度（每个声明还是每个段落）是否合理？

输出格式同 A1，但包含四个属性节，写入 evaluation/findings/05-governance-usability.md
```

---

## A6：系统效能层专家

**负责属性**：属性13（知识利用效率）+ 属性14（蒸馏效率）+ 属性15（跨领域一致性）+ 属性16（系统可演化性）

**输出文件**：`evaluation/findings/06-system-efficiency.md`

```
你是一位知识治理专家，专注于评估知识系统的整体效能与可持续性。

**本 Agent 默认用于运行验证模式，而非纯设计审查。**

请优先阅读以下运行时材料（若存在）：
- .wiki/policy/STATE.md
- .wiki/policy/LOG.md
- .wiki/changes/LOG.md
- evaluation/test-run-log.md
- benchmark 数据集的实验记录、query 回答样本、统计结果文件

必要时补充阅读以下设计文件，用于解释运行结果：
- .wiki/policy/specs/query.md（重点：write-back 机制、利用追踪）
- .wiki/policy/specs/ingest.md（重点：提取效率）
- .wiki/policy/specs/compile.md（重点：编译效率、跨域处理）
- .wiki/policy/specs/lint.md（重点：跨域一致性检查、主动巡检）
- .wiki/policy/specs/maintain.md（重点：领域管理、系统扩展）
- .wiki/policy/schemas/canon-page.md（重点：last_queried_at、query_count）
- .wiki/policy/schemas/state-log.md（重点：writeback 指标、健康度追踪）

基于阅读，评估以下四个属性：

**重要约束**：
- 若缺少支持某属性评分的运行数据，不得凭设计文档猜测分数
- 数据不足时，必须标记为 `N/A（缺少运行数据）`

**属性13：知识利用效率**
核心问题：被编译入 canon 的知识是否真正被查询使用？是否存在大量"沉睡知识"？
评估维度：
- canon-page schema 是否支持利用追踪（last_queried_at、query_count）？
- query spec 是否有机制更新利用追踪字段？
- 系统是否能基于利用数据驱动知识库优化（如归档沉睡页面、优先更新高频页面）？
- 利用效率指标是否被纳入 STATE.md 的健康度评估？

**属性14：蒸馏效率**
核心问题：从原始资料到 canon 知识的转化链路是否高效？
评估维度：
- source → proposal → compiled 的端到端转化率是否可度量？
- 各环节（ingest、promote、compile）是否有明确的 SLA 或时效预期？
- 低质量提案过滤（auto_quality_score < 0.4）是否有效减少审查负担？
- writeback_conversion_rate 指标是否能反映知识补充效率？

**属性15：跨领域一致性**
核心问题：不同领域的知识在质量标准和结构规范上是否一致？
评估维度：
- lint 规则是否跨领域统一执行？
- 各领域是否可能出现 confidence 分布严重偏斜？
- 模板遵循是否由 spec 强制执行？
- 领域间 cross_refs 的准确性如何保证？

**属性16：系统可演化性**
核心问题：系统是否能低成本适应新领域、新规则、新场景？
评估维度：
- 新增领域的配置成本如何？
- lint 规则是否可独立扩展（新增 L012 不影响 L001-L011）？
- schema 的 version 字段是否支持向后兼容演化？
- spec 间耦合度如何？修改一个 spec 需要连锁修改几个其他 spec？

输出格式同 A1，但包含四个属性节，写入 evaluation/findings/06-system-efficiency.md
```

---

## A0：汇总 Agent

**读取**：设计审查模式读取 A1-A5 findings；运行验证模式读取 A1-A6 findings（若 A6 缺失，则属性 13-16 记为 `N/A`）

**输出文件**：`evaluation/SCORECARD.md`

```
你是知识治理评估的汇总专家。

请先判断当前评估模式：

- 若输入主要是 specs / schemas / framework 文档，则为**设计审查模式**
- 若输入包含 STATE/LOG、实验日志、benchmark 结果、query 回答样本，则为**运行验证模式**

然后按模式读取以下报告：
- 设计审查模式：evaluation/findings/01-knowledge-ingestion.md ~ evaluation/findings/05-governance-usability.md
- 运行验证模式：额外读取 evaluation/findings/06-system-efficiency.md

基于相应报告，生成 evaluation/SCORECARD.md，格式如下：

# LLM Wiki 知识治理质量评分卡

> 评估日期：{日期}
> 评估类型：{设计审查（落地前） | 运行验证（基于实验与日志）}
> 评估对象：{.wiki/policy/specs/ + .wiki/policy/schemas/ | 运行日志 + benchmark + 回答样本 + 相关设计文档}

## 评分总览

| # | 质量属性 | 评分 | 一句话结论 |
|---|---------|------|-----------|
| 1 | 知识提取保真度 | x/10 | ... |
| 2 | 来源可追溯性 | x/10 | ... |
| 3 | 导航可达性 | x/10 | ... |
| 4 | 知识关联准确性 | x/10 | ... |
| 5 | 冲突发现与解决 | x/10 | ... |
| 6 | 置信度准确性 | x/10 | ... |
| 7 | 陈旧知识处理机制 | x/10 | ... |
| 8 | 知识库活跃度 | x/10 | ... |
| 9 | 人工审查有效性 | x/10 | ... |
| 10 | 审查负担可控性 | x/10 | ... |
| 11 | 知识缺口主动发现 | x/10 | ... |
| 12 | 查询回答可信度标注 | x/10 | ... |
| 13 | 知识利用效率 | {x/10 或 N/A} | ... |
| 14 | 蒸馏效率 | {x/10 或 N/A} | ... |
| 15 | 跨领域一致性 | {x/10 或 N/A} | ... |
| 16 | 系统可演化性 | {x/10 或 N/A} | ... |

## 跨维度 Top 问题（按影响程度排序）

1. [CRITICAL] ...（来自属性X）
2. [CRITICAL] ...
3. [HIGH] ...
4. [HIGH] ...
5. [HIGH] ...

## 优先改进建议

（3-5条，每条说明改进什么、改哪个文件、预期效果）

## 整体评估结论

（2-3段，回答：这套设计是否能实现"知识编译器"的核心承诺？哪些方面已经做得很好？哪些方面是落地前必须解决的？）
```
