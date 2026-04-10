---
type: scorecard
version: 3.0
evaluated_at: 2026-04-08
evaluation_type: live-run（基于实际运行数据）
test_materials: 3份（技术文章/对话记录含冲突/个人笔记含不确定性）
---

# LLM Wiki 知识治理质量评分卡 v2

> 评估日期：2026-04-08
> 评估类型：实际运行测试（live-run）
> 评估对象：完整 ingest→promote→compile 流程 + 设计文档
> 测试材料：3 份（技术文章 / 对话记录含冲突 / 个人笔记含不确定性表达）

---

## 评分总览（与 v1 设计审查对比）

| # | 质量属性 | v1 设计审查 | v2 实际运行 | 变化 | 核心原因 |
|---|---------|------------|------------|------|---------|
| 1 | 知识提取保真度 | 6/10 | 7/10 | ↑+1 | 不确定性保留、冲突标注实际执行质量超预期；QG-2 被跳过和一处语义改写是主要扣分点，但整体保真好于设计阶段的悲观预期 |
| 2 | 来源可追溯性 | 7/10 | 8/10 | ↑+1 | 四级追溯链在实际中完整走通（canon→proposal→source→声明），sources 路径全部有效；扣分为 promote 执行偏差留下 inbox 残留文件和 proposal 遗漏1条声明 |
| 3 | 导航可达性 | 6/10 | 6/10 | = | 正文导航零孤立页面，领域自动初始化执行正确；但 `pages` frontmatter 字段始终为空列表这一 CRITICAL 问题在设计审查阶段未被发现，实际运行暴露了 lint L001 将对所有 canon 页面误报孤立 |
| 4 | 知识关联准确性 | 5/10 | 7/10 | ↑+2 | `[[slug]]` 扫描机制在实际中有效工作，3 页之间建立了有语义依据的关联；v1 担心的"应有未有"问题确实存在（1对单向缺失），但已有关联质量远超 v1 的悲观预期 |
| 5 | 冲突发现与解决 | 5/10 | 4/10 | ↓-1 | 冲突在 ingest 阶段被正确识别，但 compile 冲突检测机制完全未触发（`conflicts: 0`），`changes/conflicts/` 目录从未创建，reconcile 从未调用，系统用 ⚠️ 软标注绕过了正式冲突路径，发现→解决断链 |
| 6 | 置信度准确性 | 4/10 | 6/10 | ↑+2 | v1 认为置信度规则几乎空白，但实际运行发现 compile spec 有完整的初始值规则、staleness 衰减规则、三级升级路径；三个 canon 页的 confidence=low 赋值均正确；主要问题是升级路径在本次无法验证，且 proposal 与 canon 页 confidence 不一致 |
| 7 | 陈旧知识处理机制 | 4/10 | 3/10 | ↓-1 | v1 已预测 staleness_days 计时缺失，实际运行完全证实：canon-page schema 无 `last_updated` 字段，lint spec 依赖此字段动态计算，两文档字段断裂导致 L002 永不触发，整套时效性管理机制形同虚设；实际情况比 v1 预期更糟 |
| 8 | 知识库活跃度 | 3/10 | 3/10 | = | 实际运行验证了 v1 的判断：系统是纯被动响应式，STATE.md 只有静态计数，confidence 全部卡在 low 且无升级路径，staleness 计时失效导致衰减机制也无法运行；活跃度底层问题比 v1 预测的还要更系统性 |
| 9 | 人工审查有效性 | 6/10 | 5/10 | ↓-1 | 审查信息层次设计确实完整（v1 判断准确），但实际运行暴露了 v1 未能量化的核心问题：100% 批准率 / 0% 拒绝率，approve_note 是 schema 外扩展字段而非 spec 强制项，系统对"一键全 approve"完全无防护 |
| 10 | 审查负担可控性 | 4/10 | 7/10 | ↑+3 | v1 最大的担忧是积压失控，但实际运行中 auto_quality_score 路由机制有效工作（0.63 最低分也进入正常 inbox），3个 proposal 全部当日处理，无积压；主要扣分为 lint 从未运行（L008 未工作）和 inbox 残留文件导致 pending_proposals 计数失准 |
| 11 | 知识缺口主动发现 | 5/10 | 4/10 | ↓-1 | 测试全程未执行任何 query 操作，write-back 机制完全未被验证；缺口发现仍为纯被动模式；lint 10条规则无一覆盖内容层面缺口；实际运行使用率=0 |
| 12 | 查询回答可信度标注 | 7/10 | 7/10 | = | 模拟查询测试证实了三级标注体系可操作，Gate 1/2 规则清晰，声明级标注粒度合理；"合理推断"与"训练知识"界定模糊的问题在模拟测试中被实际复现；v1 判断基本准确 |

**加权总分对比**：v1 设计审查 62/120（52%）→ v2 实际运行 67/120（56%）

---

## 跨维度 Top 问题（实际运行发现，按影响程度排序）

### [CRITICAL-1] staleness 计时机制根本失效，级联导致 4 个下游机制全部失效

canon-page schema 不含 `last_updated` 字段，lint spec 的动态计算逻辑（`effective_staleness_days = 今日 - last_updated`）依赖此字段，三个实际 canon 页均无该字段，静态 `staleness_days` 永为 0。结果：L002 永不触发 → refresh spec 永不被调用 → maintain 触发条件永不满足 → compile staleness 衰减规则永不执行。这是一个单点字段缺失导致的 4 层级联失效，影响属性 7 和属性 8 的完整性。

**受影响属性**：7、8
**根因**：`canon-page.md` schema 与 `lint.md` spec 之间的字段不一致（`last_updated` vs `last_compiled`）

### [CRITICAL-2] 冲突处理路径在"新建页面含内部分歧"场景下存在设计盲区

chunk size 冲突（Alice 512 vs Bob 1024）在 ingest 阶段被正确识别并用 ⚠️ 标注，但 compile 冲突检测机制的触发条件是"proposal 内容与现有 canon 内容产生事实矛盾"——对于首次 create 的新页面（不存在现有 canon 内容），该条件天然永不满足。`changes/conflicts/` 目录从未创建，reconcile 从未调用，冲突以 ⚠️ 软标注形式永久停留在 canon 正文，L006 也无法检测（L006 检测 `<<<CONFLICT>>>` 而非 ⚠️）。这是 spec 的覆盖盲区，而非执行失误。

**受影响属性**：5
**根因**：reconcile 触发条件设计未覆盖"新建页面内部多方观点分歧"场景

### [CRITICAL-3] `pages` frontmatter 字段始终为空，lint L001 将误报所有 canon 页面为孤立

`ai/_index.md` 的 frontmatter 中 `pages: []`，compile spec Step 5 只规定正文条目维护，完全未提及 `pages` 字段的同步更新。lint L001 的触发条件是"该页面未被任何 `_index.md` 的 `pages` 列表引用"，若 lint 严格执行，当前 3 个 canon 页面均会被误报为孤立页面（ERROR 级别），触发错误的自动修复动作。

**受影响属性**：3
**根因**：compile spec 对 `pages` 字段维护职责的设计遗漏

### [CRITICAL-4] 人工审查无有效防护机制，100% 批准率在设计层面完全合规

3 份 proposal 全部被 approve，拒绝率 0%。promote spec 的 Gate 1 只要求 `reviewed_by` 和 `reviewed_at` 非空，不要求 `approve_note`（该字段甚至不在 change-proposal schema 中）。系统没有任何机制能区分"认真审查后 approve"和"一键批量 approve"，也没有对 100% 批准率的任何预警。`approve_note` 在本次运行中由执行者自发填写，不能作为设计保障。

**受影响属性**：9

### [HIGH-1] promote 执行"移动文件"时实际新建副本，inbox 残留导致追溯混淆

promote spec 要求将文件从 inbox"移动"到 approved，实际执行是"新建 approved 版本 + 保留 inbox 原文件"，inbox 中 3 个文件状态仍为 `status: inbox`，与 approved 中 3 个 `status: approved` 文件并存。STATE.md 中 `pending_proposals: 0` 实际上是错误计数。追溯者在 inbox 中会发现权威版本和已处理版本无法区分。

**受影响属性**：2、10
**根因**：promote spec 对"移动"语义的实现方式未作明确规定

### [HIGH-2] 系统全程未执行 lint，健康检查机制完全空转

STATE.md 中 `last_lint: ~`，整个测试运行没有触发任何 lint 操作。L001（孤立页面）、L002（陈旧）、L006（冲突）、L008（积压预警）等关键规则从未执行。compile spec 完成后没有强制触发 lint 的机制，lint 是可选的外部操作而非流程内嵌环节。

**受影响属性**：3、5、7、10

### [HIGH-3] conversation source 第3条声明存在 AI 主动添加的评价性判断句

`2026-04-08-rag-chunk-size-best-practice-debate.md` 提取声明第3条末尾的"两者均有实验数据支撑，但测试场景不同"是 AI 自主添加的综合性结论，不出自对话原文任何一处。spec 明确禁止"合并不同来源内容"，但缺乏可执行的验证机制（QG-2 为自我声明式目视检查），该改写无法被客观发现。

**受影响属性**：1

---

## 新发现的问题（v1 未预测到的）

### [NEW-1] compile spec 存在"新建页面内部冲突"覆盖盲区（v1 未涉及）

v1 已预测"缺少 reconcile spec"，但 v1 的预测基于"新来源与现有 canon 产生矛盾"的场景。实际运行暴露了一个 v1 未覆盖的盲区：**当首次 create 一个新页面时，如果该页面的来源材料（如对话记录）内部已有观点分歧，compile 冲突检测天然不适用**（无现有 canon 可对比）。这类"新建页面含内部分歧"的情况需要一条专用处理路径，现有 spec 完全未定义，导致此类冲突永远绕过 reconcile 机制。

### [NEW-2] `pages` frontmatter 字段与正文 `[[slug]]` 条目的双轨不同步（v1 未发现）

v1 检查了导航结构设计，认为 compile Step 5 覆盖完整，评分 6/10。但实际运行发现 compile 只维护了正文条目，`pages` frontmatter 字段从未被更新（始终为空列表）。这不是执行偏差，而是 spec 的设计遗漏：compile spec 从未提及 `pages` 字段的维护职责。v1 在设计审查时未注意到这一双轨机制的不同步风险。

### [NEW-3] canon 模板文件不存在，compile spec 引用路径失效（v1 未覆盖）

compile spec 的 `action=create` 要求使用 `policy/templates/{type}.md` 模板，但实际运行发现 `.wiki/policy/templates/` 目录从未被初始化，模板文件不存在。执行者通过参考 schema 结构手动构建绕过了这一问题，但这属于 spec 引用了实际未存在的资源，是一个无声的文档基础设施缺口，v1 的设计审查未检测到。

### [NEW-4] `pending_proposals` 在两个 spec 中定义不一致（v1 未覆盖）

test-run-log 中记录了一个 v1 未发现的 spec 内部矛盾：compile spec 将 `pending_proposals` 定义为"approved/ 中 compiled!=true 的文件数"，而 promote spec 将其定义为"inbox+review 文件数"。两种定义在正常流程下结果相同，但在 promote 执行偏差（inbox 残留）后会产生计数分歧，STATE.md 的状态准确性无法保证。

### [NEW-5] confidence 升级路径在正常使用条件下实际不可达（v1 低估了这一风险）

v1 预测"confidence 初始值设置无规则"（[CRITICAL]），但实际运行发现 compile spec 已有完整的初始值规则（v1 判断有误）。然而实际运行暴露了一个更深的问题：`low→medium` 的升级条件要求"至少 1 个 authority=authoritative 来源"，而正常使用场景中大多数真实材料（博客文章、对话记录、个人笔记）都是 secondary 或 unverified，authoritative 来源（官方文档、权威论文）极少。这意味着 confidence 体系在真实使用中是单向下行的——大多数页面会永远停留在 low，medium 和 high 是设计上存在但实践上不可达的状态。

### [NEW-6] 两个 LOG 文件并存设计造成执行混淆（v1 未提及）

系统同时存在 `policy/LOG.md` 和 `changes/LOG.md`，两个文件各自被不同 spec 引用，用途有重叠（ingest/compile 日志 vs promote/compile 日志）。test-run-log 明确记录了"容易混淆"，执行者需要反复确认哪个操作写哪个文件。这是一个文档基础设施设计问题，会增加执行错误概率，v1 设计审查未涉及。

---

## v1 预测准确性分析

### 预测被实际运行完全验证的（v1 判断正确）

- **staleness_days 计时缺失**（属性7 [CRITICAL]）：v1 已预测整套阈值检测"在实践中无法自触发"。实际运行完全证实，且发现了更具体的根因（schema-spec 字段断裂）。
- **缺乏主动知识升级驱动力**（属性8 [CRITICAL]）：v1 预测"低置信页面一旦产生可能永久停留在 low 状态"，实际运行中 3 个 canon 页全部 confidence=low 且无升级路径，完全吻合。
- **无防止"一键全 approve"机制**（属性9 [CRITICAL]）：v1 已指出该问题，实际运行中 100% 批准率 / 0% 拒绝率，验证了这一风险不是理论担忧而是实际发生的。
- **"合理推断"界定模糊**（属性12 [HIGH]）：v1 已指出此问题，模拟查询测试中实际复现了 canon 外推断被混入推断标注的场景。
- **关联双向性未被系统保证**（属性4 [HIGH]）：v1 已预测，实际运行中发现 `vector-db-comparison` 与 `finetuning-vs-rag` 之间确实存在单向缺失。

### v1 预测被实际运行推翻的（v1 判断有误）

- **属性6 confidence 机制几乎空白**（v1 [CRITICAL]）：v1 认为"初始置信度设置无规则"，实际运行发现 compile spec 已有相当完整的初始值规则（authoritative 来源→medium，否则→low）、staleness 衰减规则和三级升级路径。v1 的 [CRITICAL] 判断过于严厉，实际情况升级为评分从 4→6，是最大的正向偏差。
- **属性10 审查队列失控风险**（v1 [CRITICAL]）：v1 最担心积压失控，但实际运行中 auto_quality_score 路由机制有效（最低分 0.63 正常进入 inbox），3 个 proposal 全部当日处理，无积压发生。v1 对高摄入场景积压的担忧在小规模测试中未被触发，评分从 4 升至 7。
- **属性4 关联准确性悲观**（v1 5/10）：v1 认为"系统完全缺乏'应有未有'的发现机制"是 [CRITICAL]，对已有关联质量也不乐观。实际运行中 `[[slug]]` 扫描机制工作良好，3 页关联均有真实语义依据，大部分关联已实现双向一致。评分 5→7，比 v1 好得多。

### v1 预测比实际情况更乐观的（实际情况更糟）

- **属性7 陈旧知识**（v1 4/10，实际 3/10）：v1 已判定问题严重，但将 refresh spec 缺失列为与 staleness_days 并列的 [CRITICAL]。实际运行发现 refresh spec 已存在（并非 v1 说的"完全缺失"），但 staleness_days 的根本问题比 v1 预期更严重——是 schema 与 spec 跨文档的字段断裂，而非仅仅"未定义增长逻辑"。
- **属性5 冲突处理**（v1 5/10，实际 4/10）：v1 预测"reconcile spec 缺失"是主要问题。实际运行发现 reconcile spec 已存在，但暴露了一个 v1 未预测到的盲区：spec 的触发条件设计使得"新建页面内部分歧"永远绕过正式冲突路径，这是比"缺 reconcile spec"更深层的设计问题。
- **属性9 人工审查**（v1 6/10，实际 5/10）：v1 给出了偏乐观的分数，因为设计层面的审查信息结构确实完整。但实际运行暴露了 approve_note 是 schema 外字段、100% 批准率是可接受的系统状态，这些是 v1 在设计层面无法发现的执行层风险。

---

## 优先改进建议（基于实际运行，按优先级排序）

| 优先级 | 改进项 | 涉及文件 | 预期效果 | 难度 |
|--------|--------|----------|----------|------|
| P0 | 在 `canon-page.md` schema 中增加 `last_updated` 字段，或将 `lint.md` 的动态计算逻辑改为基于 `last_compiled`（二选一，消除 schema-spec 字段断裂） | `canon-page.md` + `lint.md` | 解锁 L002/L005/refresh/maintain/衰减规则的完整时效性链条，级联修复属性7和属性8的底层问题 | 低 |
| P0 | 在 `compile.md` Step 5 中补充 `pages` 字段同步规则（create action 同步追加 slug，archive action 同步移除），或将 lint L001 改为双轨检测（pages 字段 OR 正文 `[[slug]]` 条目，任一满足即通过） | `compile.md` + `lint.md` | 消除 L001 对所有 canon 页面的误报风险，防止正确的导航结构被错误标记为 ERROR | 低 |
| P0 | 在 ingest spec 中补充"新建页面内部多方观点分歧"的处理路径：此类 proposal 的 `action` 标记为 `create-with-conflict`，compile 阶段强制插入 `<<<CONFLICT>>>` 并触发 reconcile | `ingest.md` + `compile.md` | 消除冲突处理路径在新建场景下的覆盖盲区，确保所有冲突能进入正式 reconcile 闭环 | 中 |
| P1 | 将 `approve_note` 加入 `change-proposal.md` schema，并在 `promote.md` Gate 1 中设为必填（≥20字），增加 lint 规则 L011 检测 approved/ 中缺失 approve_note 的 proposal | `change-proposal.md` + `promote.md` + `lint.md` | 为人工审查引入最低限度认知摩擦，使"一键全 approve"产生合规成本，提升属性9实质有效性 | 低 |
| P1 | 明确 `promote.md` 中"移动"的语义：实现方式为"创建目标文件 + 删除源文件"，或允许"新建+标记原文件为 superseded"（在 inbox 原文件追加 `status: superseded` 和 `superseded_by` 字段） | `promote.md` | 消除 inbox 残留文件导致的追溯混淆和 pending_proposals 计数失准 | 低 |
| P1 | 放宽 `low→medium` 升级条件：增加备选路径"至少 2 个 secondary 来源且内容互相一致"，使 medium confidence 在正常使用中可达 | `compile.md` | 解决 confidence 体系单向下行问题，使知识质量提升在真实使用场景中成为可能 | 中 |
| P1 | 初始化 `policy/templates/` 目录，创建 comparison/guide/decision 三种类型的模板文件 | 新增 `policy/templates/*.md` | 消除 compile spec 引用路径失效问题，为后续 create action 提供一致的结构基础 | 低 |
| P2 | 在 compile 流程末尾设置强制 lint 触发（compile 完成后必须运行 lint），确保 L001/L002/L006/L008 等规则持续监控 | `compile.md` + `lint.md` | 将 lint 从"可选外部操作"变为"流程内嵌环节"，使健康检查持续有效而非永久空转 | 低 |
| P2 | 在 STATE.md schema 中增加趋势指标字段：`confidence_distribution`（low/medium/high 各几页）、`avg_staleness_days`、`last_lint_score`（数值化）、`open_conflicts`（按优先级分布） | `state-log.md` + STATE.md | 为知识库健康趋势提供可量化数据，使系统能自知"是否在变好" | 低 |
| P2 | 在 query spec 中为"合理推断"增加操作性定义（推断必须能写出"基于 canon 中 X 推断 Z"，否则归入训练知识），并增加 `[⚠️ 训练知识，未在 canon 中验证]` 标注级别与推断明确区分 | `query.md` | 消除推断与训练知识的混用风险，使 Gate 2 的"禁止伪装"约束更可执行 | 中 |

---

## 整体评估结论

**系统是否能实现"知识编译器"的核心承诺？**

在小规模单日测试（3份材料，1个领域，3个 canon 页）的条件下，系统基本实现了核心承诺——原始内容能够经过 ingest→promote→compile 的完整链路转化为带来源标注、带置信度标记、带交叉引用的结构化知识页面，不确定性表达被正确传递。ingest 和 compile 的执行质量超过 v1 的预期。然而，系统的"知识治理"功能（区别于"知识存储"功能）在本次测试中几乎未能真正运作：lint 从未执行、冲突未走正式路径、时效性管理完全失效。结论是：**这是一个能存储知识的系统，但还不是一个能自主治理知识健康的系统**。

**实际表现超出预期的方面**

置信度初始值规则（compile spec 已有完整规则，v1 认为空白）、审查负担控制（auto_quality_score 路由有效，小规模无积压）、知识关联建立质量（`[[slug]]` 扫描有效，关联有语义依据）三个方面的实际表现明显好于 v1 设计审查的预判。其中置信度规则的偏差最大：v1 给出 4/10 的低分，实际运行揭示规则已完整，升级为 6/10。

**实际表现不如预期的方面**

冲突处理是最大的落差：v1 预测"缺 reconcile spec"是主要问题，实际运行发现 reconcile spec 已存在，但暴露了一个更根本的设计盲区——触发条件设计使得新建页面的内部分歧永远绕过正式冲突路径，导致 ⚠️ 软标注成为冲突的终点而非起点。此外，时效性管理机制因一个字段断裂（`last_updated` 缺失）级联导致 4 个下游机制同时失效，这是 v1 已预测但实际暴露得更加彻底的根本性问题。

**落地前最关键的 1-2 个修复点**

第一优先：修复 staleness 计时机制（在 canon-page schema 增加 `last_updated` 字段，或将 lint 动态计算改为基于 `last_compiled`）。这是单改动成本最低但解锁收益最大的修复——一个字段的补充可以使整套时效性管理链条（L002→refresh→maintain→confidence 衰减）从失效状态恢复运转，直接影响属性 7 和属性 8。第二优先：补充"新建页面含内部分歧"的冲突处理路径（新增 `create-with-conflict` action，强制触发 `<<<CONFLICT>>>` 插入）。这是当前最大的逻辑覆盖盲区，不修复则任何通过对话记录或含多方观点资料首次创建的 canon 页面都会绕过冲突治理机制，冲突永远以软标注形式沉积在知识库中而无法进入正式解决流程。
