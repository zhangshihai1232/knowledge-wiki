---
type: findings
agent: A1-知识进入层
evaluated_at: 2026-04-08
evaluation_type: live-run（基于实际运行数据）
---

# 知识进入层评估报告

## 属性1：知识提取保真度

### 评分：7 / 10

### 评分依据

三个 source 文件的原始内容均得到完整保留，绝大多数声明保持了原文语义，不确定性标注（⚠️、"据说"、"需要验证"）也被正确传递到了 proposal 和 canon 页。但在 conversation source 的第3条声明中，AI 对两方观点进行了综合性改写（加入了"两者均有实验数据支撑，但测试场景不同"这一判断句，属于 AI 自己的结论而非原文陈述），而非直接引用。此外，QG-2（正文未改写）的验证方式仅为"目视检查"，在批量执行中被压缩跳过（未遵守 spec 的"两步走"），该质量门控在本次运行中未被严格执行。

### 实际运行中做好的部分

- **原始内容完整保留**：3个 source 文件的 `## 原始内容` 节均保留了资料原文，未出现摘要替换或润色改写。具体验证：`2026-04-08-vector-db-comparison-pinecone-weaviate-milvus.md` 的原始内容包含完整的性能数字表格（p99延迟、QPS、Recall@10）、定价数据和部署对比表，与声明一一对应。
- **不确定性表达被正确保留**：note source 中的"据说"、"需要验证"、"个人观察，未经严格验证"等标注，全部原样传递到了提取声明、proposal 和 canon 页。canon 页 `finetuning-vs-rag.md` 顶部有明确的 `⚠️ 可信度说明`，且每条待验证内容均保留了 ⚠️ 标记。
- **conversation 冲突点被识别和保留**：Alice 与 Bob 的不同实验数据（MRR@5 vs NDCG@10、不同测试集）均未被合并为单一结论，而是在声明中标注为"⚠️ 冲突观点"并保留了双方数据，符合 spec 的升级规则。
- **声明粒度基本合理**：information-dense 的 article 提取6条（spec 上限10条），包含3家产品的核心指标差异；note 提取5条，每条对应一个独立的决策要点，未过度合并。

### 实际发现的问题

- **[HIGH] QG-2 在执行中被实质性跳过**：ingest spec 要求"两步走"——先创建 `extracted: false`，Step 6 再改为 `true` 并追加声明，这个两步设计的目的是给 QG-2（目视检查正文未改写）创造操作窗口。但实际执行中，3个 source 文件直接以 `extracted: true` 写入并已包含提取声明（见 test-run-log.md 歧义记录1）。这意味着 QG-2 的检查时机消失，质量门控在批量执行场景下形同虚设。
- **[HIGH] conversation source 第3条声明存在语义改写**：`2026-04-08-rag-chunk-size-best-practice-debate.md` 的第3条提取声明为"⚠️ 冲突观点：……两者均有实验数据支撑，但测试场景不同"，其中后半句"两者均有实验数据支撑，但测试场景不同"是 AI 加入的评价性结论句，并非任何一位对话参与者的原话。原文 Bob 的结论是"没有普适的最优 chunk size"，并未对双方实验数据作横向比较。这一判断句是 AI 对整段对话的综合概括，属于 spec 明确禁止的"合并不同来源的内容"。
- **[LOW] article source 的"选型建议"声明存在轻微信息丢失**：提取声明第5条缩略了原文建议后半句的限定语（原文包含"但无法自托管"、"社区活跃"等内容），语义方向未变但丢失了部分限定信息。
- **[LOW] QG-2 缺乏可机械执行的验证方法**：spec 将 QG-2 定义为"目视检查"，没有给出任何可量化、可自动化的验证标准。在 AI 批量执行时，"目视检查"实际等于由 AI 自我声明通过，不具备独立验证效力。

### 具体证据

**证据1 — conversation 声明改写**

原文（source 文件 `## 原始内容`，Bob 最后一段）：
> "所以结论是：没有普适的最优 chunk size。需要根据场景选择：客服/FAQ 类短文档用 512，技术文档/长文用 1024+overlap。"

提取声明第3条（source 文件 `## 提取声明`）：
> "⚠️ 冲突观点：Alice 认为 512 tokens 是大多数场景的最优 chunk size，因其与 embedding 模型训练数据分布匹配、检索精度更高；Bob 认为对于长篇技术文档，1024 tokens + 20% overlap 更优，因其语义完整性更好、碎片化问题更少。两者均有实验数据支撑，但测试场景不同。"

最后一句"两者均有实验数据支撑，但测试场景不同"为 AI 自主添加，不出自原文任何一处。

**证据2 — QG-2 执行跳过**

test-run-log.md 第70行：
> "source 文件创建：3 个文件按 schema 格式创建，`extracted: true`（直接写入，非两步走），`## 提取声明` 节已填写。"

QG 检查记录仅写"QG-2（正文未改写）：通过"，但两步走已经跳过，通过是 AI 自我声明而非独立验证。

**证据3 — 不确定性保留正确（正面证据）**

note source 原文（`§可能适合但不确定的情况`）：
> "有人说微调可以减少模型的'幻觉'，但我的实践经验恰好相反——在我测试的几个案例里，微调后的模型反而更容易编造细节，可能与训练数据质量有关"

canon 页 `finetuning-vs-rag.md` 对应位置：
> "⚠️ 个人实践中观察到微调后模型反而更容易编造细节（与'微调减少幻觉'的说法相反），可能与训练数据质量有关，非普遍规律，样本有限"

语义完整保留，不确定性标注未被平滑。

### 改进建议

- **对 QG-2 增加可执行验证机制**：建议 spec 明确要求在 source 文件写入后，对 `## 原始内容` 节与输入资料做字符级 diff 校验（或关键词保留率检验），而非仅依赖"目视检查"。技术上可通过 checksum 字段辅助实现。
- **对综合性声明加强约束**：在 spec Step 3 中增加说明：声明不得包含任何未出自原文的评价性判断句。跨多段提炼的声明必须加引号或明确标注"AI归纳"，与直接引用区分。
- **强制执行两步走逻辑**：即使在批量执行场景下，也应先完成所有 source 文件写入（extracted: false），再在单独的步骤中执行声明提取和 QG-2 检查，最后统一写 extracted: true，避免 QG-2 被跳过。

---

## 属性2：来源可追溯性

### 评分：8 / 10

### 评分依据

从 canon 页到 source 文件的正向追溯链完整且可验证：3个 canon 页的 `sources` 字段均包含有效路径，对应文件实际存在，canon → proposal → source → 原始声明的四级链条可以完整走通。主要扣分原因是：proposal 的 Source 证据节与 source 文件的提取声明之间存在一处数量不一致（article source 有6条声明但 proposal 只收录了5条），且 promote 阶段的"移动文件"执行偏差导致 inbox 中存在残留的 status=inbox 旧版文件，可能引起追溯混淆。

### 实际运行中做好的部分

- **canon 页 sources 字段路径全部有效**：3个 canon 页的 `sources` 列表均指向实际存在的文件，路径格式统一（相对 `.wiki/` 的相对路径），compile 的 Gate 1b 检查通过。
- **四级追溯链完整**：以 vector-db-comparison 为例，完整链条为：canon 页 frontmatter.sources[0] → source 文件（实际存在）→ 文件 extracted: true → `## 提取声明` 节6条声明（含段落引用）→ `## 原始内容` 对应段落。每个层级均有明确字段指向上一层，追溯可操作。
- **proposal Source 证据节含段落引用**：3个 proposal 的 Source 证据节均标注了来源段落（如"来源：§性能指标/Pinecone"、"来源：Alice 第一段发言"），具备细粒度追溯能力。
- **compile 每次写入均更新 sources 字段**：所有3个 canon 页的 `last_compiled` 均为 `2026-04-08`，sources 字段包含对应的 trigger_source，符合 compile spec Gate 1 和 Gate 2 要求。

### 实际发现的问题

- **[HIGH] promote 偏差导致 inbox 存在状态异常的残留文件**：promote spec 要求将文件从 inbox 移动到 approved，但实际执行是"新建+保留原文件"，inbox 中 3 个原始文件的 `status` 仍为 `inbox`（而非被删除或更新），见 test-run-log.md 歧义记录2。当追溯者在 inbox 中查找 proposal 时，会发现 status=inbox 的版本与 approved 中 status=approved 的版本并存，无法直观判断哪个是权威版本，追溯链存在二义性风险。
- **[MEDIUM] article proposal Source 证据节遗漏1条声明**：source 文件 `## 提取声明` 有6条，但 `2026-04-08-create-vector-db-comparison.md` 的 Source 证据节只有5条（第6条"Milvus 运维复杂度高，依赖 etcd 和 pulsar/kafka，冷启动需 5-15 分钟"在 Source 证据节中未单独列出，仅被合并进第5条的表述中）。从 proposal 向下追溯时，并非所有提取声明都能在 Source 证据节中找到对应条目，追溯链在 proposal 层出现了轻微断裂。
- **[LOW] canon 页未直接列出 proposal 文件路径**：canon 页的 sources 字段只指向原始 source 文件，没有记录对应的 proposal 文件路径。若需审查某条 canon 内容经过了什么 proposal 处理，需要从 proposal 文件的 trigger_source 字段反向推导，追溯方向单一（只能 canon→source，不能 canon→proposal）。

### 具体证据

**证据1 — 四级链条验证（vector-db-comparison 完整路径）**

```
canon/domains/ai/databases/vector-db-comparison.md
  frontmatter.sources[0]: "sources/articles/2026-04-08-vector-db-comparison-pinecone-weaviate-milvus.md"
  → 文件实际存在 ✓
  → 文件 frontmatter.extracted: true ✓
  → "## 提取声明" 节存在6条声明 ✓
  → 声明均有段落引用（"原文：§性能指标/Pinecone"等）✓
```

**证据2 — article proposal Source 证据节遗漏**

source 文件提取声明第6条（实际存在）：
> "Milvus 的运维复杂度高，依赖 etcd 和 pulsar/kafka 等外部组件，冷启动需 5-15 分钟。（原文：§部署复杂度）"

`2026-04-08-create-vector-db-comparison.md` Source 证据节共5条，最后一条为：
> "Milvus 部署依赖 etcd 和 pulsar/kafka，冷启动需 5-15 分钟，运维复杂度最高。（来源：§部署复杂度）"

可以看出，source 文件第6条声明确实在 proposal 中有对应（内容上被合并为 Source 证据第5条），但并非独立条目，追溯时需要依赖人工比对而非一一对应关系。

**证据3 — inbox 残留文件状态异常**

test-run-log.md 产出文件列表：
> "Change Proposals — inbox（3个，应已被替代，为 promote 执行偏差残留）"

inbox 中3个文件 `status: inbox` 与 approved 中3个文件 `status: approved` 并存，追溯者无法通过文件目录直接判断 inbox 版本是否已被处理。

**证据4 — sources 路径有效性（正面证据）**

三个 canon 页的 sources 字段路径均可实际访问：
- `sources/articles/2026-04-08-vector-db-comparison-pinecone-weaviate-milvus.md` — 存在 ✓
- `sources/conversations/2026-04-08-rag-chunk-size-best-practice-debate.md` — 存在 ✓
- `sources/notes/2026-04-08-llm-finetuning-vs-rag-decision-criteria.md` — 存在 ✓

### 改进建议

- **明确 promote 的"移动"语义**：spec 应说明"移动"等同于"创建新文件 + 删除原文件"，不得保留原文件。或者允许"新建+标记原文件为 superseded"，但必须在 inbox 原文件中追加 `status: superseded` 和 `superseded_by: <approved文件路径>` 字段，避免追溯混淆。
- **要求 proposal Source 证据节覆盖所有提取声明**：在 ingest spec Step 5 中增加约束：Source 证据节的条目数必须与 source 文件 `## 提取声明` 节的声明数一致，每条 source 声明都必须在 proposal 中有对应的证据条目。
- **canon 页增加 proposals 字段**：在 canon 页 frontmatter 中增加可选字段 `proposals: [<proposal文件路径列表>]`，支持从 canon 正向追溯到所有历史 proposal，构建双向追溯链。
