---
type: findings
agent: A3-知识一致性层
evaluated_at: 2026-04-08
evaluation_type: live-run
---

# 知识一致性层评估报告

## 属性5：冲突发现与解决
### 评分：4 / 10

### 评分依据

chunk size 冲突在 ingest 阶段确实被识别并标注，但整个后续的标准化解决路径完全未被执行：compile 的 `<<<CONFLICT>>>` 插入机制未触发，reconcile spec 未被调用，`changes/conflicts/` 目录从未创建，canon 页中没有任何规范冲突标记。系统通过一个"变通做法"（在 proposal 正文中用 ⚠️ 软标注）绕过了正式冲突处理流程，导致冲突虽然被发现但没有进入闭环解决路径。这是"机制存在但未执行"的典型案例，对应评分区间 3-4 分。

### 实际运行中做好的部分

- **ingest 阶段识别冲突**：source 文件 `2026-04-08-rag-chunk-size-best-practice-debate.md` 的 `## 提取声明` 第3条，明确用 `⚠️ 冲突观点` 标注了 Alice（512 tokens）与 Bob（1024 tokens）的分歧，并注明"两者均有实验数据支撑，但测试场景不同"，识别动作到位。
- **proposal 中保留双方数据**：inbox 和 approved 两份 proposal 的 `## 变更内容 / 步骤二` 均用 `⚠️ 冲突` 标注，且两方的实验数字（MRR@5、NDCG@10、Recall@5）全部保留，未静默选取其中一方。
- **人工审查环节识别冲突**：approved proposal 的 `approve_note` 字段明确写道"冲突点已被识别：Alice（512最优，客服场景MRR@5=0.73）与Bob（1024最优，TechDocs NDCG@10=0.52）的实验数据分歧已在提案中正确标注为⚠️冲突"，说明审查者有意识地确认了冲突处理。
- **reconcile spec 定义了清晰的解决路径**：规范本身完整，包含触发条件、裁决优先级规则（authority > 时效 > 并存）、SLA 约束（高/中/低三档时限）、和 Quality Gates，设计无明显缺口。

### 实际发现的问题

- **[CRITICAL] compile 冲突检测机制完全未触发**：compile 阶段本应在合并内容时检测事实矛盾并插入 `<<<CONFLICT>>>` 块，但 `changes/LOG.md` 记录 `conflicts: 0, result: success`，且 canon 页 `chunk-size-strategy.md` 正文中无任何 `<<<CONFLICT>>>` 标记。
- **[CRITICAL] changes/conflicts/ 目录从未创建**：compile spec 定义冲突时应将 proposal 路由至 `changes/conflicts/` 并触发 reconcile，但整个测试运行中该目录不存在，reconcile spec 从未被调用。
- **[HIGH] 冲突处理路径被软标注取代**：系统将 ingest 阶段的软标注（`⚠️` 正文提示）当作冲突处理的终点。compile LOG 明确解释"未触发 compile 冲突检测（分歧已在 ingest 阶段标注，非两个 canon 页之间的矛盾）"——这是一个逻辑漏洞：将"同一资料内部的不同观点"与"需触发 compile 冲突机制的两 canon 页矛盾"混淆，导致 reconcile 永远不会被触发。
- **[HIGH] 最终 canon 页无法被 L006 检测**：lint L006 检查正文中的 `<<<CONFLICT>>>` 标记，但 canon 页用的是 `⚠️ 数据分歧` 软文本，L006 扫描时不会触发 WARNING，冲突对后续 lint 流程不可见。
- **[MEDIUM] 冲突解决流程形成死循环依赖**：compile spec 定义冲突触发条件为"proposal 内容与 canon 页现有内容产生事实矛盾"，但本次冲突是初次 create 一个新页面（无现有 canon 内容可对比），导致 compile 冲突检测天然不适用于新建场景。spec 未定义新建页面中的内部分歧如何走 reconcile 流程，是一个覆盖盲区。

### 具体证据（chunk size 冲突处理链路）

| 阶段 | 预期行为（spec） | 实际行为 | 是否符合 |
|------|----------------|---------|---------|
| ingest：source 文件 | 识别矛盾声明，在提取声明中标注 | 第3条声明用 ⚠️ 冲突观点标注，双方数据均保留 | 是 |
| ingest：proposal | 用 `⚠️ 冲突` 标注，`AI 建议` 写"存在冲突需人工判断" | 步骤二用 ⚠️ 标注，AI 建议提到冲突标注 | 部分符合（未按示例格式写明"现有 canon" vs "新 source"，因为是新建页）|
| compile：冲突检测 | 检测到矛盾后插入 `<<<CONFLICT>>>` 块，confidence 降为 low | `conflicts: 0`，无标记插入 | 否 |
| compile：路由 | 将 proposal 移入 `changes/conflicts/`，触发 reconcile | 未创建 conflicts/ 目录，reconcile 未触发 | 否 |
| canon 页最终状态 | 含 `<<<CONFLICT>>>` 标记，等待人工裁决 | 只有 ⚠️ 软标注，无 `<<<CONFLICT>>>` | 否 |
| reconcile：裁决 | 生成裁决建议，人工确认，清除标记，更新 confidence | 未执行 | 否 |

冲突在 ingest 阶段被发现，但从 compile 阶段开始的完整解决链路（标记→路由→裁决→清除）全部缺失，流程在第一个环节后断裂。

### 改进建议

1. **补充新建页面内部分歧的处理规则**：ingest spec 的升级规则当前只处理"新声明与现有 canon 内容的矛盾"，需增加"同一 source 内多方观点分歧"的处理路径——将此类 proposal 的 `action` 改为 `create-with-conflict`，在 compile 时强制触发 `<<<CONFLICT>>>` 插入和 reconcile 流程。
2. **强制区分软标注与硬标注**：明确规定 `⚠️` 符号为"信息性提示"，只有 `<<<CONFLICT>>>` 才是触发 reconcile 的信号，两者不可互换。lint L006 应同时扫描 `⚠️ 冲突` 软文本，防止漏报。
3. **为 conflicts/ 目录创建初始化条件**：compile spec 应在"当前页面为首次 create 且 proposal 中含冲突标注时"也触发冲突路由，而不仅限于"proposal 内容与现有 canon 内容矛盾"的场景。

---

## 属性6：置信度准确性
### 评分：6 / 10

### 评分依据

confidence 初始值规则和升级路径在 compile spec 中均有明确定义（low/medium/high 的条件、staleness 衰减规则、low→medium 的触发条件、medium→high 的人工 promote 流程）。本次运行中，三个 canon 页的 confidence 均被正确设置为 `low`（无 authoritative 来源），规则执行准确。含不确定性的笔记材料对应页面也正确保持了 low 并加了可信度说明。主要扣分点是：proposal 层写了 `confidence: medium` 而 canon 页最终为 `low`，存在轻微不一致，且 confidence 升级路径在本次运行中无法验证（无 authoritative 来源导致不可能触发升级）。整体属于"基本准确，规则已定义，但有小瑕疵"的水平，对应 5-6 分区间。考虑到 compile spec 中规则完整度较高，取 6 分。

### 实际运行中做好的部分

- **compile spec 有完整的 confidence 规则体系**：包含初始值规则（authoritative 来源且无冲突→medium，否则→low）、staleness 衰减规则（high>90天降medium，medium>180天降low）、升级路径（low→medium 由 compile 自动触发，medium→high 需人工 promote），设计层面已相当完整。
- **三个 canon 页的 confidence 值均正确**：
  - `vector-db-comparison.md`：来源 authority=secondary → `confidence: low` ✓
  - `chunk-size-strategy.md`：来源 authority=secondary → `confidence: low` ✓
  - `finetuning-vs-rag.md`：来源 authority=unverified → `confidence: low` ✓
  三个页面均无 authoritative 来源，设置为 low 完全符合 compile spec 第 2 条规则。
- **含不确定性的笔记材料处理正确**：`finetuning-vs-rag.md` 来自 authority=unverified 的个人笔记，canon 页顶部主动加了 `⚠️ 可信度说明`，说明 confidence=low 的原因和待补充内容，用户可感知不确定性。
- **staleness_days 初始值正确**：三个页面编译当日的 `staleness_days: 0`，`last_compiled: 2026-04-08`，符合规范。

### 实际发现的问题

- **[HIGH] proposal 与 canon 页的 confidence 值不一致**：`chunk-size-strategy` 的 approved proposal 中 `confidence: medium`，但最终编译出的 canon 页 `confidence: low`。compile spec 明确"冲突检测规则优先级高于初始值规则"，且"无 authoritative 来源则为 low"——因此 canon 页的 low 是正确的，但 proposal 中写 medium 造成混淆，审查者的 `approve_note` 也未指出这一不一致。这说明 proposal 的 confidence 字段与 compile 最终决定的 confidence 没有同步机制，二者职责边界模糊。
- **[MEDIUM] confidence 升级路径在实际运行中无法验证**：由于三份材料均缺乏 authoritative 来源，所有 canon 页只能停留在 low，compile 的 `low→medium` 自动升级条件（补充 authoritative 来源且无冲突）在本次测试中没有被触发。测试材料设计未覆盖"升级路径"这条关键链路。
- **[MEDIUM] staleness 衰减规则未被测试**：衰减规则（high>90天、medium>180天降级）在单日测试中无法触发，其实际执行准确性无法验证。
- **[LOW] canon 页无 authority 汇总字段**：当一个 canon 页有多个 sources 时，哪个 source 的 authority 决定 confidence，spec 按"至少1个 authoritative"设为 medium，但 canon 页 frontmatter 中没有显示"最高 authority 级别"字段，维护者无法直接从 canon 页判断下次编译后 confidence 是否会升级。

### 具体证据

| canon 页 | 来源 authority | 预期 confidence | 实际 confidence | 是否符合 |
|---------|--------------|----------------|----------------|---------|
| vector-db-comparison.md | secondary | low | low | 是 |
| chunk-size-strategy.md | secondary | low | low | 是（proposal 写 medium 但 compile 正确覆盖为 low）|
| finetuning-vs-rag.md | unverified | low | low | 是 |

approved proposal 中 `chunk-size-strategy` 的 `confidence: medium` 字段：与 compile 规则不一致，属于 proposal 作者的误判，但 compile 阶段按规则正确覆盖。这说明 confidence 规则在 compile 层执行是对的，但 proposal 层没有规则校验，留下了信息误导的隐患。

### 改进建议

1. **明确 proposal.confidence 与 canon.confidence 的职责边界**：在 ingest spec 或 change-proposal schema 中说明"proposal 中的 confidence 字段是提案人的初步建议，compile 阶段将按规则重新计算，两者可能不同"，避免审查者或提案人对该字段产生错误预期。
2. **测试材料应包含 authoritative 来源**：未来端到端测试应至少包含一份 authority=authoritative 的材料，以验证 `low→medium` 自动升级路径能正确触发。
3. **在 canon 页 frontmatter 增加 max_source_authority 字段**（可选）：显示 sources 中最高的 authority 级别，让维护者一眼判断再次 compile 后 confidence 是否有升级可能，降低管理负担。
4. **staleness 衰减规则需长周期测试**：当前规则正确但未经运行验证，建议在定期 lint 测试中补充"模拟 staleness_days 超阈值"的场景用例。
