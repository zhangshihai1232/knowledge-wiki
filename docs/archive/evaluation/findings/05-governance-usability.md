---
type: findings
agent: A5-治理过程与可用性
evaluated_at: 2026-04-08
evaluation_type: live-run
---

# 治理过程与可用性评估报告

---

## 属性9：人工审查有效性

### 评分：5 / 10

### 评分依据

**核心问题**：3 份材料全部被 approve（100% 批准率），0 个被 reject，拒绝率 = 0%。

基于实际运行数据的观察：

**reviewed_by 字段**：3 个 approved proposal 均填写了 `reviewed_by: "test-evaluator"`，非空，满足 Gate 1。

**reviewed_at 字段**：3 个 proposal 分别标注 `reviewed_at: "2026-04-08T10:00:00+08:00"`、`"2026-04-08T10:10:00+08:00"`、`"2026-04-08T10:20:00+08:00"`，格式合规，时间差 20 分钟（3 个 proposal 各约 10 分钟），时间记录具有一定可信度。

**approve_note 字段（schema 外扩展字段）**：3 个 proposal 均填写了实质性说明：
- vector-db-comparison: `"技术数据有来源，声明准确"`
- chunk-size-strategy: `"冲突点已被识别：Alice（512最优，客服场景MRR@5=0.73）与Bob（1024最优，TechDocs NDCG@10=0.52）的实验数据分歧已在提案中正确标注为⚠️冲突，双方数据均保留，来源可追溯"`
- finetuning-vs-rag: `"不确定性声明已被正确标记：笔记中的⚠️待验证条目均已在提案中保留原始不确定性标注，未被平滑为确定性结论。approve理由：框架结构有价值，confidence=low可接受"`

approve_note 内容有实质性，不是走形式。然而这是 schema 未定义字段，是测试执行者自主添加，并非 promote spec 强制要求。

**rejection_reason 质量**：无任何被 reject 的 proposal，无法评估 rejection_reason 质量。

**防"一键全 approve"机制**：promote spec 中不存在任何防止审查者连续 approve 所有提案的机制——无强制阅读要求、无批量 approve 限制、无最低间隔要求。在本次测试中，3 份材料设计上分别具有不同挑战（冲突内容、不确定性），但全部被 approve，未触发任何 reject。

**设计评估**：spec 设计要求 reviewed_by 和 reviewed_at，并通过 Gate 1/Gate 2 强制检查，信息呈现层（Step 2 的 diff/canon 现状/原始证据/AI 建议四项）设计完整。但缺少 approve_note 作为必填字段的强制设计，缺少对 0% 拒绝率的预警机制。实际运行中 approve_note 由执行者自发填写，并非 spec 驱动的质量保障。

**评分说明**：按照评分标准，5-6 分对应"审查覆盖率 100% 但拒绝率 <3%（形式审查）"。本次 approved_rate = 100%，rejected_rate = 0%。虽然 approve_note 内容有一定实质性，但这是 schema 外字段而非 spec 强制项，整体判定为 5 分。

### 已做好的部分

- Step 2 四类审查信息设计完整：diff、canon 现状、原始证据、AI 建议，形成有效的审查信息层次
- Gate 1（approved 必须有 reviewed_by + reviewed_at）和 Gate 2（rejected 必须有实质性 rejection_reason）是硬性门禁
- 升级规则（Lock 级别）对高风险操作（删除/合并/大改写 >50%）有专门保护
- 实际运行中 3 份 proposal 的时间戳显示审查用时约 10 分钟/个，不是纯粒子式操作

### 问题与风险

- **[CRITICAL] spec 未将 approve_note 列为必填字段**：promote spec 操作 A 仅要求 `reviewed_by` 和 `reviewed_at`，不要求说明批准理由。本次 approve_note 存在是因为执行者超出 spec 要求主动添加，这不能作为设计保障
- **[CRITICAL] 无防止"一键全 approve"的机制**：3 个 proposal 全部被 approve，系统没有任何机制检测 0% 拒绝率的异常，也没有机制要求审查者对低置信度（如 `confidence: low`）的 proposal 给出更详细的批准理由
- **[HIGH] rejection_reason 质量无法从本次运行中评估**：无任何 rejected proposal，Gate 2 的实际效果未经验证
- **[HIGH] AI 建议（Step 2d）缺乏质量校验**：AI 建议可能引导审查者跟随，但设计中未要求审查者对 AI 建议的分歧做出说明
- **[MEDIUM] `confidence: low` 的 proposal 未收到额外审查约束**：finetuning-vs-rag proposal 的 `auto_quality_score: 0.63`、`confidence: low`，但审查流程与其他 proposal 完全相同，无额外提示

### 改进建议

- 将 `approve_note` 加入 change-proposal schema 并在 promote spec 的 Gate 1 中列为必填字段，内容不得少于20字
- 增加 lint 规则 L011：检测 approved 目录中 `approve_note` 缺失的 proposal，报 WARNING
- 对 `confidence: low` 的提案在 promote Step 2d 首行增加 `[LOW-CONFIDENCE]` 标注，并建议审查者在 approve_note 中说明为何接受低可信度内容

---

## 属性10：审查负担可控性

### 评分：7 / 10

### 评分依据

**核心问题**：3 份材料产生了 3 个 proposal，与预期相符（1 材料 1 proposal）。

**STATE.md 中的 pending_proposals 追踪**：STATE.md 显示 `pending_proposals: 0`，与实际状态不完全对应——inbox 目录中仍残留 3 个旧文件（status 仍为 inbox，是 promote 执行偏差的残留），但 STATE.md 已更新为 0。这是 promote 执行偏差造成的计数不准确（见 test-run-log.md 问题 #2：inbox 文件保留未删除）。

**积压预警机制（lint L008）**：lint spec 中 L008 规则在 `changes/inbox/` 下提案超过 7 天未处理时报 WARNING。机制设计存在，但本次运行中 lint 未被执行（`last_lint: ~`），L008 实际上没有运行。

**ingest autonomy 与提案量**：ingest spec 的 autonomy 未在 spec 文件中可见（需要检查 ingest.md），但 test-run-log.md 显示"3 source + 3 proposal"，ratio = 1:1，符合预期。auto_quality_score 路由机制存在：score < 0.4 进入 `changes/low-quality/`，≥ 0.4 进入正常 inbox。本次 3 份材料最低分为 0.63（finetuning 笔记），全部进入正常 inbox。

**3 份材料产生了多少 proposal**：
- 材料1（技术文章）→ 1 个 proposal（ai/databases/vector-db-comparison）
- 材料2（对话记录）→ 1 个 proposal（ai/rag/chunk-size-strategy）
- 材料3（个人笔记）→ 1 个 proposal（ai/decisions/finetuning-vs-rag）

合计：3 个 proposal，与 3 份材料一一对应，无多余提案生成。

**评分说明**：按评分标准，9-10 分对应"积压 <5 个，无超期"。本次运行产出 3 个 proposal，全部在当日完成 approve（无积压），STATE.md 中 `last_promote_at: 2026-04-08T10:20:00+08:00`。在规模上，3 份材料的测试量级下系统运转正常，不存在积压。但 inbox 残留文件（3 个状态不一致文件）是一个隐患，加上 lint 未运行（L008 未能执行），主动监控缺失。扣分原因：pending_proposals 计数不准确（STATE.md 显示 0 但 inbox 有残留）、lint 从未运行导致 L008 预警机制实际上未工作、系统缺乏对高摄入场景下的批量处理机制。评为 7 分。

### 已做好的部分

- lint L008 设计了超期提案预警（7 天 WARNING），提供了积压可见性机制
- promote Step 1 按 `proposed_at` 升序排列提案，确保先进先出处理顺序
- auto_quality_score 路由机制（<0.4 转 low-quality/）提供了质量预过滤，降低低质量提案进入主审查队列的概率
- 本次测试中 3 个 proposal 全部在同日处理完毕，未出现积压

### 问题与风险

- **[CRITICAL] lint 未被执行（`last_lint: ~`）**：L008 的积压预警机制完全未工作，系统在这次测试中没有完成任何健康检查，STATE.md 中 `last_lint_score: ~`
- **[HIGH] inbox 残留文件导致 pending_proposals 计数失准**：test-run-log.md 明确记录了 promote 执行偏差——inbox 原始文件未删除，STATE.md 中 `pending_proposals: 0` 实际上是错误的（inbox 有 3 个遗留文件），STATE.md 已不可信
- **[HIGH] 无批量审查设计**：promote 流程是线性逐个处理，高积压场景（20+ 提案）缺乏"快速通道"或"批量处理相似提案"的效率机制
- **[MEDIUM] L008 只有单一阈值（7 天 WARNING）**：缺乏更高级别的积压告警（如 14 天 ERROR、21 天 CRITICAL 或积压量超过阈值触发 CRITICAL）
- **[MEDIUM] query write-back 生成的 proposal 与 ingest 提案混合在 inbox 中，无优先级区分**

### 改进建议

- 修复 promote spec 中的"移动"语义：明确实现方式为"删除源文件+创建目标文件"，或增加 inbox 清理步骤，避免残留文件污染计数
- 为 lint 设置自动触发条件（如 compile 完成后必须运行 lint），确保 L008 等规则持续监控
- 将 L008 升级为三级告警：>7 天 WARNING，>14 天 ERROR，>21 天或积压 >20 个 CRITICAL

---

## 属性11：知识缺口主动发现

### 评分：4 / 10

### 评分依据

**核心问题**：query write-back 机制在设计上存在，但完全未被执行；主动发现机制不存在；lint 规则不覆盖内容层面的缺口。

**query write-back 触发条件清晰度**：query.md Step 5 中三个触发条件明确：
1. canon 完全无覆盖用户问题领域
2. 有相关领域但缺少具体概念/页面
3. `[⚠️ canon 外推断]` 标注声明比例超过 **25%**

触发条件 3 已量化（25% 阈值），条件 1/2 有明确文字描述，清晰度较好。

**实际运行中 write-back 是否被触发**：test-run-log.md 中没有任何 write-back 被触发的记录，`changes/inbox/` 中无任何以 `query-gap-` 命名的 proposal，`logs/query.log` 不存在。write-back 从未运行——因为测试运行从未执行过任何 query 操作。

**"量子计算在 AI 中的应用"查询**：canon 只有一个领域（ai），三个页面（vector-db-comparison / chunk-size-strategy / finetuning-vs-rag），全部为 RAG/向量数据库/微调相关。如果用户查询"量子计算在 AI 中的应用"：
- Step 2 导航：`canon/_index.md` 只有 ai 领域 → `ai/_index.md` 列出三个页面 → 无任何与量子计算相关的页面
- Gate 2 应触发：必须告知"当前 canon 中未找到关于量子计算的相关页面"，而非伪装成 canon 内容
- Step 5 应生成 write-back proposal：`{date}-query-gap-quantum-computing-ai.md`

这个机制在设计层面是正确的，但在本次测试中完全未验证（无任何 query 操作记录）。

**lint 规则对内容层面缺口的覆盖**：lint.md 中 L001-L010 全部针对结构性问题（孤立页面、过期字段、来源缺失、断裂引用、低置信度、矛盾标记、领域溢出、超期提案、缺少索引、类型路径不匹配），无任何规则检测：
- canon 覆盖的知识领域是否有明显空白
- source 文件中的信息是否已被充分提取为 canon
- 用户高频查询的概念是否有对应 canon 页面

**评分说明**：write-back 机制设计存在，触发条件 25% 阈值清晰，但测试中完全未执行（无任何 query 操作）。缺口发现纯粹依赖用户查询被动触发，无主动扫描机制，lint 不覆盖内容缺口。按评分标准，5-6 分对应"机制存在但使用率低"，本次测试中使用率 = 0%，但机制本身设计质量不足5分（触发条件比5分水平更清晰），综合评为 4 分。

### 已做好的部分

- query write-back 的 25% 推断比例阈值是明确量化的触发条件，可执行性较好
- write-back 文件命名规范（`{date}-query-gap-{slug}.md`）和 proposal 内容要求（触发问题摘录、建议 slug、候选内容框架）设计合理
- Gate 2 强制要求 canon 无覆盖时告知用户，而非伪装输出，是诚实性的基础保障

### 问题与风险

- **[CRITICAL] 测试运行全程未执行任何 query 操作**：write-back 机制完全未被验证，其实际有效性未知
- **[CRITICAL] 缺口发现仅依赖用户查询触发（被动模式）**：从未被查询的知识盲区永远不会被发现，系统对"静默盲区"无任何主动探测能力
- **[HIGH] lint 10 条规则均为结构性检查，无一条覆盖知识内容层面的缺口**：如 source 文件摄入后 canon 未覆盖的概念、两个相关 canon 页面间存在知识断层等问题均无法检测
- **[MEDIUM] write-back 机制的"合理推断比例"判断依赖 AI 自我评估**：AI 在 Step 4 标注推断时，可能低估推断比例，导致 25% 阈值无法被准确触发
- **[LOW] 无缺口提案聚合机制**：多次查询触发的同一方向 write-back 会生成独立文件，无合并或聚合显示

### 改进建议

- 补充主动扫描任务：在 maintain spec 中增加"source-canon 覆盖率对照"任务，每月比对所有 source 文件的 `## 提取声明` 节与已有 canon 页面，输出"已摄入但未 canon 化"的知识列表
- 在 query spec 末尾增加 Step 6b：在每次 query 完成后统计本次回答的推断比例，无论是否超过 25%，均记录到 `logs/coverage-signal.log`，累计形成覆盖率热图
- 为 lint 增加 L011：检查 `sources/` 下 `extracted: true` 的文件，若其 target_page 对应的 canon 页面不存在，报 WARNING

---

## 属性12：查询回答可信度标注

### 评分：7 / 10

### 评分依据

**核心问题**：query spec 的三级标注体系设计清晰完整，Gate 2 强制性明确，但"合理推断"与"训练知识补充"的界定存在实际歧义，且标注执行依赖 AI 自律而无外部校验机制。

**三级标注体系**：query.md Step 4 定义了三个层级：
1. 直接引用 → `[来源: slug]`（有明确文字规范和示例）
2. 基于 canon 的合理推断 → `[⚠️ canon 外推断，建议验证]`（有格式示例）
3. 完全无依据 → 从回答中移除或转入"知识缺口说明"

三个层级的处理逻辑清晰，`[来源: slug]` 标注粒度为声明级（每个事实性声明单独标注），与段落级标注相比粒度更细、更可追溯。Gate 1 要求事实性声明 100% 带来源标注，无模糊表述（"通常认为"）掩盖来源缺失。

**Gate 2 强制性**：query.md Gate 2 的规则明确：若 canon 完全无相关内容，必须明确告知，"禁止用模型训练知识伪装成 canon 内容"。格式也被明确规定（"当前 canon 中未找到关于...的相关页面，以下内容为模型推断，未经 canon 验证"）。强制性通过文字规范体现，但没有技术手段强制执行（纯依赖 AI 遵守）。

**"合理推断"与"训练知识补充"的界定**：这是最关键的模糊点。query.md 中仅说"若某声明是基于 canon 内容的合理推断（非直接引用）"，未说明什么构成"基于 canon 内容的推断"。实际上，"A 比 B 更快（canon 有A的速度和B的速度）"算推断，"A 通常在生产环境需要做监控（canon 无此内容，来自 AI 训练知识）"也可以被 AI 归类为"推断"，两者本质不同，但标注格式相同。

**标注粒度（声明级）的合理性**：声明级标注（每个事实性声明后紧跟 `[来源: slug]`）是合理的——粒度细，来源可追溯，用户可以分辨哪些具体声明有来源、哪些是推断。相对段落级标注是进步。

**实际运行中的标注验证**：测试运行中未执行任何 query 操作，无实际标注质量数据可验证。以下进行模拟查询测试。

**评分说明**：设计层面标注体系完整（三级），Gate 1/2 有明确规定，标注格式有示例，触发条件清晰。扣分原因：推断界定模糊（可能被滥用）、Gate 执行依赖 AI 自律无外部校验、slug 标注对用户可用性低（内部标识符不可点击）。评为 7 分。

### 已做好的部分

- 三级标注体系覆盖完整可信度谱系，每级都有明确的处理规则和格式示例
- Gate 2 的禁止措辞是强制性的（"禁止"），不是建议性的
- 声明级标注粒度合理，每个事实性声明可单独追溯来源
- query.md 调用示例中提供了完整的标注样本，可作为 AI 执行参考

### 问题与风险

- **[HIGH] "合理推断"与"训练知识补充"界定模糊**：未说明推断必须有 canon 中的间接支撑，AI 可能将训练知识以"推断"名义混入回答，绕过 Gate 2 对"伪装成 canon 内容"的禁止
- **[HIGH] Gate 1 执行依赖 AI 自律，无外部校验**：没有在回答输出后的自动扫描机制检测未标注陈述句，违反 Gate 1 的回答无法被自动发现
- **[MEDIUM] "事实性声明"范围未定义**：比较性（A比B更好）、评价性（这是最佳实践）、条件性陈述是否需要标注，设计中无判断标准
- **[MEDIUM] slug 标注对用户可用性低**：`[来源: ai/databases/vector-db-comparison]` 是系统内部路径，用户不知如何访问验证，标注的实际可用性打折

### 模拟查询测试

**模拟查询**："向量数据库选型时应该考虑哪些因素？"

按照 query spec 步骤执行：

**Step 1 — 问题类型**：对比分析（涉及多个向量数据库的比较）。回答结构：建立对比维度表格 → 逐维度说明差异 → 给出选择建议。

**Step 2 — 导航定位**：
- 读取 `canon/_index.md` → 发现 ai 领域
- 读取 `canon/domains/ai/_index.md` → 找到三个页面：`databases/vector-db-comparison`、`rag/chunk-size-strategy`、`decisions/finetuning-vs-rag`
- 候选页面：`ai/databases/vector-db-comparison`（直接相关），`ai/decisions/finetuning-vs-rag` 可能有补充信息（RAG 场景下的选型视角）

**Step 3 — 综合回答（模拟）**：

> ## 向量数据库选型考量因素
>
> 选型向量数据库时需从以下四个核心维度评估 [来源: ai/databases/vector-db-comparison]：
>
> **1. 性能指标**
> 主要关注 p99 延迟和吞吐量：Pinecone 的 p99 延迟约 20-30ms（100 万向量托管版）[来源: ai/databases/vector-db-comparison]，Weaviate 约 15-25ms（自托管，8 核 32GB）[来源: ai/databases/vector-db-comparison]，Milvus 在分布式模式下可达 5-15ms [来源: ai/databases/vector-db-comparison]。Recall 质量方面，三款数据库默认参数下 Recall@10 均在 95-96% 左右 [来源: ai/databases/vector-db-comparison]。
>
> **2. 部署方式与运维成本**
> 自托管需求是重要过滤条件：Pinecone 不支持自托管，Milvus 和 Weaviate 均支持开源自托管 [来源: ai/databases/vector-db-comparison]。Milvus 运维复杂度最高，依赖 etcd 和 pulsar/kafka，冷启动需 5-15 分钟 [来源: ai/databases/vector-db-comparison]。
>
> **3. 成本结构**
> Milvus 开源完全免费（MIT 许可证），Weaviate 开源自托管免费（Apache 2.0），Pinecone 最低 $70/月起，无自托管选项 [来源: ai/databases/vector-db-comparison]。注意：定价数据截止 2026-03-15，使用前建议核对官方文档 [来源: ai/databases/vector-db-comparison]。
>
> **4. 功能特性需求**
> 若需要混合搜索（向量 + 关键词），Weaviate 原生支持 BM25+向量混合检索，Pinecone 和 Milvus 需额外配置 [来源: ai/databases/vector-db-comparison]。大规模场景（10 亿+向量）下 Milvus 扩展性最佳 [来源: ai/databases/vector-db-comparison]。
>
> **选择建议**
> - 快速验证/SaaS 场景，无自托管需求 → Pinecone [来源: ai/databases/vector-db-comparison]
> - 中等规模 + 需要混合搜索 → Weaviate [来源: ai/databases/vector-db-comparison]
> - 大规模生产/成本敏感/需要自定义索引 → Milvus [来源: ai/databases/vector-db-comparison]
>
> **注意**：如果选型背景是构建 RAG 系统，chunk size 策略也会影响向量数据库的实际检索效果，建议同步参考 [来源: ai/databases/vector-db-comparison 中 cross_refs 引用 ai/rag/chunk-size-strategy]。

**Step 4 — 来源完整性检查**：

| 声明 | 来源标注 | 是否合规 |
|------|----------|----------|
| Pinecone p99 延迟 20-30ms | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| Weaviate 15-25ms，Milvus 5-15ms | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| Recall@10 均在 95-96% | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| 自托管支持情况 | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| Milvus 运维复杂度/冷启动时间 | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| 成本数据 | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| Weaviate 原生混合搜索 | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| 选择建议三条 | `[来源: ai/databases/vector-db-comparison]` | 合规 |
| "对 RAG 系统建议参考 chunk-size-strategy" | 基于 cross_refs，属于有据推断 | 应标注为 `[⚠️ canon 外推断，建议验证]` — **此处标注可改进** |

**检验结论**：大部分事实性声明均有来源标注，符合 Gate 1 要求。最后一条关于 RAG 与 chunk size 关联的建议是从 cross_refs 推断而来，而非 vector-db-comparison 页面的直接内容，严格执行 spec 应标注为 canon 外推断。这验证了"合理推断"界定模糊导致的执行风险。

**canon 覆盖情况**：本次查询 canon 完全覆盖（有直接对应页面），无需触发 write-back（Step 5 不触发）。

### 改进建议

- 在 query spec 中为"合理推断"增加操作性定义：推断必须能写出"基于 canon 中 X（来自 slug-a）和 Y（来自 slug-b）推断 Z"，否则归入训练知识补充，标注为 `[⚠️ 训练知识，未在 canon 中验证]` 与推断明确区分
- 在 query 流程结束时增加 Step 4b 自检：AI 扫描自身生成的回答，统计未带标注的陈述句（含主谓宾结构的句子），若 > 0 则强制补充标注
- 将 slug 格式标注升级为包含可访问路径提示，如 `[来源: ai/databases/vector-db-comparison]（查看：.wiki/canon/domains/ai/databases/vector-db-comparison.md）`
