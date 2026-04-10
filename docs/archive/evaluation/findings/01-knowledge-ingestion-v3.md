---
type: finding
version: v3
evaluated_at: 2026-04-09
agent: A1-knowledge-ingestion
---

# 知识进入层评估报告 v3

> 对比基准：v2（属性1=7/10，属性2=8/10）

## 属性1：知识提取保真度

### 评分：7 / 10（vs v2: 7/10，变化：=）

### 评分依据

ingest spec 的核心结构未变，三项 Quality Gate 和声明格式规范保持完整。Step 4.5 新增了质量预评分和去重机制，在流程完整性上是进步。但 v2 发现的两个核心缺陷——QG-2 缺乏可机械执行的验证方法、以及声明层面对 AI 主动添加评价性结论句缺乏显式禁止——在 spec 文本中均未得到实质修复。"保持原文语义：不得改变命题方向，不得合并不同来源的内容"这一表述仍是唯一约束，不能阻止 AI 在声明末尾追加综合性判断句。

### v2 问题修复状态

- [HIGH-3] AI 添加评价性判断句：**未修复** — ingest spec Step 3 声明要求仍仅为"保持原文语义：不得改变命题方向，不得合并不同来源的内容"，缺乏对"AI 自主归纳性结论句"的显式禁止。v2 中发现的问题根源（AI 在跨段落综合时主动添加"两者均有实验数据支撑，但测试场景不同"类评价句）在 spec 约束层面没有新增对应条款。

### 设计中已做好的部分

- **声明格式规范具体可操作**：Step 3 要求每条声明"一句话陈述 + 括号内注明来源段落"，并给出了完整示例（§Abstract、§3.2 格式），粒度和引用格式的可操作性较好。
- **冲突声明处理路径完整**：升级规则明确了矛盾声明的识别标准（事实层面相反/数值不兼容/明确否定），以及保留双方、标注来源、降级 action、LOG 记录的完整处理链。
- **Step 4.5 新增质量预评分和去重检查**：通过 `auto_quality_score` 多维评分（声明信息量40%、与canon差异度30%、来源可信度30%）和阈值路由（<0.4 进入 low-quality 暂存区），以及对已有 pending proposal 的去重追加机制，显著减少了低质量和重复 proposal 进入主审查队列的风险。
- **3–10 条声明数量上限约束合理**：对短资料（3条）和长资料（10条）的弹性上限设计，配合"一条声明对应一个独立知识点"的粒度要求，有效防止过度合并和过度拆分两个极端。
- **"不应提取的内容"有明确排除列表**：Step 3 明确排除纯背景介绍、引用他人工作的陈述、无法独立理解的片段，降低了低价值声明混入的概率。

### 仍存在的问题与风险

- [HIGH] **QG-2（正文未改写）仍无可执行验证方法**：spec 将 QG-2 定义为"目视检查 source 文件 `## 原始内容` 节是否与用户提供的原始资料内容一致"。在 AI 执行场景中，"目视检查"等同于 AI 自我声明通过，缺乏独立验证效力。v2 已发现批量执行时 QG-2 被实质性跳过，spec 中未增加字符级校验、checksum 比对或关键词保留率等可机械执行的验证手段。
- [HIGH] **Step 3 声明约束不能阻止 AI 综合性归纳**：现有约束为"不得改变命题方向，不得合并不同来源的内容"。这两条约束只能拦截命题方向改变和跨来源合并，不能阻止 AI 在单条声明末尾追加跨段落综合的评价性结论句（如对话来源中跨越 Alice、Bob 发言的横向比较结论）。缺少如下约束："声明中不得包含未出自原文任何位置的归纳性判断句；若需归纳，必须在声明末尾以'（AI归纳，非原文）'显式标注。"
- [LOW] **"保持原文语义"的边界未量化**：spec 仅要求"保持原文语义"，但未给出什么情形属于"语义改写"的判定标准（如是否允许语序调整、是否允许主动/被动句转换、是否允许繁简转化），在边缘情况下执行一致性存疑。

### 新发现的问题

- [LOW] **Step 4.5 质量预评分的"与 canon 差异度"维度依赖 AI 主观判断**：spec 定义该维度为"提案内容与现有 canon 页面的差异程度（完全重复得0分）"，但未给出差异度计算的具体方法（语义相似度？关键词重叠？）。在 AI 执行时，这一30%权重的维度实际上是 AI 对自身输出的主观评分，可能出现系统性偏高或偏低，影响 inbox/low-quality 路由决策的可靠性。
- [LOW] **Step 4.5 去重追加机制可能导致 proposal 声明列表无上限膨胀**：当同一 target_page 多次收到新声明时，spec 要求"将本次声明追加到现有 proposal 的 `## Source 证据` 节"，但未规定追加上限。若同一 target_page 被多次 ingest 但 proposal 长期未被 promote，Source 证据节可能无限增长，影响 promote 阶段的人工审查效率。

---

## 属性2：来源可追溯性

### 评分：9 / 10（vs v2: 8/10，变化：↑）

### 评分依据

promote spec 已对"移动文件"语义作出明确定义，修复了 v2 发现的 inbox 残留导致追溯二义性的主要问题。compile spec 新增了 Gate 1b（sources 路径有效性检查）和 FALLBACK_SOURCE 标注机制，进一步强化了追溯链的完整性保障。从 canon 页 → proposal（trigger_source 反向） → source 文件 → 原始声明的四级链条在 spec 设计层面已趋于完整，评分相应提升至9分。剩余主要风险是 compile sources 字段使用 proposal 路径兜底时的语义降级（兜底来源不指向原始资料），以及 canon 页无法正向追溯到 proposal 的单向链路限制（v2 LOW 问题，本版本未改进）。

### v2 问题修复状态

- [HIGH-1] promote 移动文件变新建副本：**已修复** — promote spec Step 3 操作 A 第2步现已明确写出："**移动**意为：在目标目录写入文件后，**删除源目录的原始文件**，确保同一提案不在两个目录同时存在。"操作 B（reject）同样有"移动后删除源目录原始文件"的明确要求，语义歧义已消除。

### 设计中已做好的部分

- **compile Gate 1b（sources 路径有效性）为新增的有效兜底**：对 sources 列表中每个路径执行 `file_exists()` 检查，失效路径触发 `WARNING: INVALID_SOURCE_PATH` 记录，不阻塞编译但确保问题可见。FALLBACK_SOURCE 标注机制（sources 为 proposal 路径时特别标注）使兜底状态透明，便于后续补充正式 source 文件。
- **compile Gate 1（sources 非空）强制要求**：canon 页 sources 字段不得为空列表的 ERROR 级别检查，与 L003 形成双重保障，确保每个 canon 页都有可见的来源记录。
- **lint L003（缺少来源）为 ERROR 级别的全量兜底**：即使 compile 阶段出现 sources 写入遗漏，L003 每日全量扫描可在 24 小时内发现并标记为 ERROR，提供了独立于 compile 的最终防线。
- **compile Step 3 sources 追加去重逻辑设计合理**：`sources` 字段采用"追加新来源、去重、保留原有来源"的策略，确保每次 compile 都会扩充而非覆盖来源记录，多次 update 后 canon 页 sources 列表完整反映所有历史来源。
- **promote spec 明确了 approve_note ≥10 字且禁止占位符的强约束**：确保批准记录有实质内容，为追溯 canon 内容的人工审查决策依据提供了保障。

### 仍存在的问题与风险

- [MEDIUM] **compile sources 字段兜底机制使追溯链降级**：compile Step 3 规定"若 proposal 未提供 sources，使用 proposal 文件路径本身作为兜底来源"。当兜底生效时，canon 页的 sources 指向的是 `changes/approved/xxx.md`（一个中间层文件），而非原始 source 文件（`sources/articles/xxx.md`）。追溯者从 canon 页出发，得到的是一个 proposal 路径而非原始资料，需要再多跳一级才能到达原始内容。Gate 1b 中的 FALLBACK_SOURCE 标注可见此情况，但并不阻止其发生，且 ingest spec 中未明确哪些场景会导致 proposal 不携带 sources 信息（在规范执行良好时，trigger_source 字段始终存在）。
- [LOW] **canon 页无法正向追溯到 proposal（v2 已知问题，未改进）**：canon 页 frontmatter 中没有 `proposals` 字段，从 canon 页出发只能通过 sources 追溯到原始资料，无法直接知晓该页面经过了哪些 proposal 和人工审查。需要通过 proposal 的 `trigger_source` 反向推导，追溯路径单向。canon-page schema v1.0 本版本未新增此字段。
- [LOW] **proposal Source 证据节与 source 文件提取声明条数对应约束仍缺失**：ingest spec Step 5 未要求 Source 证据节条目数与 source 文件 `## 提取声明` 节声明数一致。v2 发现的 article proposal 遗漏1条声明（被合并进其他条目）的问题，在 spec 层面未增加对应约束，该风险仍然存在。

### 新发现的问题

- [LOW] **promote spec 操作 D（reopen）清空 reviewed_by 后的 LOG 连续性**：reopen 操作要求"清空 `reviewed_by`、`reviewed_at`、`rejection_reason` 字段（置为 `~`）"，这会导致该提案在 LOG 中之前的 rejected 记录与现有文件内容产生断裂——文件中已无 rejection 信息，但 LOG.md 中仍有 REJECTED 记录。spec 未要求在 reopen 时在 proposal 中保留原 rejection 信息的历史副本（如 `previous_rejection_reason`），可能导致提案审查历史无法从单一文件完整还原。
