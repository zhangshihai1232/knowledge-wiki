---
type: finding
version: v3
evaluated_at: 2026-04-09
agent: A2-knowledge-structure
---

# 知识结构层评估报告 v3

> 对比基准：v2（属性3=6/10，属性4=7/10）

## 属性3：导航可达性

### 评分：8 / 10（vs v2: 6/10，变化：↑）

### 评分依据

v2 的 CRITICAL 问题（`pages` 字段始终为空导致 lint L001 大规模误报）在 v3 中已被完整修复：compile spec Step 5 新增了 `pages` 字段同步规则，index-page schema 也将该字段标记为必填并给出维护规则，实际的 `ai/_index.md` 中 `pages` 字段已正确列出 3 个页面路径，与正文条目一致。导航体系的"双轨不同步"结构缺陷已消除。剩余扣分点在于：lint L001 的自动修复逻辑仍仅追加 `pages` 列表，未同步写入正文条目（两者更新不对称），以及顶层 `canon/_index.md` 的 frontmatter 中仍不含 `pages` 字段，导致顶层索引自身无法被 L001 机制完整覆盖。

### v2 问题修复状态

- **[CRITICAL-3] `pages` 字段始终为空：已修复** — compile spec Step 5 明确规定：create 时将 `{domain}/{category}/{slug}` 追加到 `pages` 列表（去重幂等），archive 时从 `pages` 列表中移除，update/merge/split 在 slug 或 title 变化时同步更新。实际 `ai/_index.md` 已验证 `pages` 字段填充正确（3 个路径条目与正文条目一一对应）。

- **[NEW-2] 双轨不同步：已修复** — compile spec Step 5 现将正文条目维护与 `pages` 字段维护并列为同一步骤的两个动作，二者绑定执行；index-page schema 的"更新规则"表格也同步说明了每类操作需同时更新 `pages` 列表和正文区块。规范层已消除双轨分离的根因。

### ✅ 已做好的部分

- **compile spec Step 5 的 `pages` 字段同步规则完整**：涵盖 create（追加）、archive（移除）、update/merge/split（条件同步）三种 action，逻辑闭环，无遗漏分支
- **index-page schema 新增完整的 `pages` 字段规范**：v2 未见该 schema，v3 中 `index-page.md` 将 `pages` 标注为必填字段，给出格式要求（`{domain}/{category}/{slug}`，不含 `_index.md` 自身），并以表格形式规定各操作的更新责任方
- **lint L001 检测逻辑与 compile 输出对齐**：L001 依赖 `pages` 列表检测孤立页面，现在 compile 已保证 `pages` 字段的及时更新，L001 的误报问题从根源上消除
- **lint L001 自动修复机制兜底**：即使 compile 遗漏写入 `pages`，lint Step 5 的自动修复也会将孤儿页面路径追加到 `pages` 列表，提供双重保障
- **首次创建领域的初始化模板已包含 `pages` 字段**：compile spec Step 5 的"首次创建领域"模板中明确写入 `pages: [{domain}/{category}/{slug}]`，不再以空列表初始化

### ❌ 仍存在的问题

- **lint L001 自动修复只写 `pages`，不写正文条目**：lint spec Step 5 规定 L001 自动修复时将孤儿路径"追加到 `pages` 列表末尾"，但未规定同步在正文中写入对应的 `- [[slug]] — title` 条目（条目追加到"其他"区块）。这导致修复后的 `_index.md` 出现"`pages` 有条目但正文无对应行"的不对称状态，影响人工浏览体验，也不符合 index-page schema 的正文结构规范。

- **顶层 `canon/_index.md` 的 frontmatter 无 `pages` 字段**：顶层索引 frontmatter 只有 `type`、`title`、`updated_at` 三个字段，不含 `pages`，这是设计预期（顶层索引通过正文链接到各领域 `_index.md`，不直接列出 canon 页面），但 lint L001 扫描"所有 `_index.md` 的 `pages` 合集"时，顶层索引不贡献任何条目，若某领域 `_index.md` 缺失，其下页面将直接被判为孤立页面而无顶层兜底——这一设计依赖是隐式的，schema 未作说明。

### 新发现的问题

- **index-page schema 规定 `pages` 中条目格式为 `{domain}/{category}/{slug}`，但 lint L001 检测逻辑对路径格式的要求未显式对齐**：lint spec L001 描述为"该页面未被任何 `_index.md` 的 `pages` 列表引用"，未明确路径格式要求；若 compile 写入的格式为 `ai/databases/vector-db-comparison`，而 lint 扫描 canon 页时使用的路径为 `canon/domains/ai/databases/vector-db-comparison.md`，两者需要有规范化匹配逻辑，但 lint spec 未对此作出规定，存在实现时产生路径不匹配误报的风险。

---

## 属性4：知识关联准确性

### 评分：7 / 10（vs v2: 7/10，变化：=）

### 评分依据

v3 的 compile spec Step 4（`[[slug]]` 扫描更新 `cross_refs`）与 v2 完全相同，未引入任何新的关联发现或双向性保障机制。v2 提出的三项改进建议（反向引用一致性检查、新增 lint 规则 L0xx、区分 cross_refs 来源）在 v3 spec 中均未落实。现有机制的优点（扫描准确、正向关联有效）保持不变，原有问题（遗漏隐性关联、单向关联无检测）同样保持不变，评分维持 7 分。

### v2 问题修复状态

- **单向关联缺失：未修复** — compile spec Step 4 仍仅执行 `[[slug]]` 正向扫描，不检查反向引用是否存在；lint 规则列表（L001–L010）中无新增的单向关联检测规则；v2 识别的 `vector-db-comparison` 未引用 `finetuning-vs-rag` 的问题，在 v3 spec 层面没有任何机制能自动发现或修复此类问题。

### ✅ 已做好的部分

- **`[[slug]]` 扫描机制准确可靠**：compile Step 4 基于正文扫描同步 `cross_refs`，已在 v2 实际运行中验证有效，v3 保留该机制，未引入回归
- **断裂引用的检测与保留策略清晰**：compile Step 4 规定目标 slug 不存在时保留引用并记录 `WARN: dangling ref`，lint L004 补充检测；两层覆盖确保无效引用不会静默失效
- **compile 后局部 lint 包含 L004 检查**：每次编译后自动触发 L004（断裂引用）检查，能在关联被破坏时及时发现，关联存活性有保障
- **正文 wiki link 是关联的单一可信来源**：`cross_refs` 字段完全由正文扫描驱动（加上允许手动追加），语义基础明确，不依赖猜测

### ❌ 仍存在的问题

- **无机制发现"应关联但未关联"的页面对**：`[[slug]]` 扫描只捕获作者已写出的关联，对于语义上应互相引用但正文中未写 wiki link 的情况（如 v2 发现的 `vector-db-comparison` ↔ `finetuning-vs-rag`），系统完全静默，无任何提示或检测

- **单向关联无检测规则**：lint L001–L010 中没有检测"A 引用 B 但 B 未引用 A"的规则，单向关联可以无限期存在而不被发现，影响知识图谱的对称完整性

- **cross_refs 来源不透明**：v2 已发现部分 `cross_refs` 条目是手动写入（正文无对应 `[[slug]]`），部分是扫描生成，v3 未引入区分机制（如 `cross_refs_auto` / `cross_refs_manual`），维护者无法判断哪些条目需要在正文中补写对应 wiki link

### 新发现的问题

- **compile Step 4 删除"失效引用"的范围定义模糊**：规则描述为"去除正文中已删除节里的失效引用"，但"已删除节"的界定依赖 update action 的节级比对，对于 merge/split action 中被归并或拆分的节，哪些 `[[slug]]` 应保留、哪些应删除，并无明确规则，存在关联被错误清除的风险
