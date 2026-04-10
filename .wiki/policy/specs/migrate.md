---
type: spec
name: migrate
autonomy: propose
triggers:
  - 用户请求领域重命名、页面重分类、子类合并/废弃、重复页面合并
  - lint L007 domain-overflow 触发后进入 maintain Section 1
  - lint L012 unclassified-page ≥ 5 条时触发 maintain Section 7
  - reconcile Step 3 识别出结构性冲突（根因为路径/分类错误）
  - wiki.md spec Step 2.4 路由到 govern 任务类型
inputs:
  - 用户自然语言描述的迁移意图
  - 或 maintain/reconcile spec 传入的结构性问题描述
outputs:
  - migration plan（status: reviewed）
  - apply 后的 alias 记录（aliases.json 更新）
  - LOG 中的迁移记录
quality_gates:
  - dry-run 无 collision 或 collision 已人工裁决
  - apply 后 SQLite 索引已同步（wiki internal scan 无 L004 断裂引用）
  - rollback 可用（plan status 已记录 applied，支持 wiki migrate rollback）
---

## Purpose

管理 knowledge-wiki 中所有**结构性变更**的生命周期：领域重命名、页面重分类、子类合并/废弃、重复页面合并。

与内容提案（`changes/` 工作流）的核心区别：

| 维度 | 内容提案（compile 工作流） | 迁移计划（migrate 工作流） |
|------|--------------------------|--------------------------|
| 操作对象 | canon 页面**内容** | canon 页面**路径 / 分类** |
| 入口 | `changes/inbox/` → propose → approve → compile | `wiki migrate plan` → dry-run → apply |
| 回滚能力 | 靠 git history | 靠 `wiki migrate rollback <plan_id>` |
| 身份稳定性 | page_id 不变 | page_id 不变，路径变更，alias 保留旧路径 |
| 人工确认点 | promote Gate（approve/reject） | dry-run 后人工确认 apply |

---

## 步骤责任标记

| 标记 | 含义 | 执行者 |
|------|------|--------|
| 🧠 | 语义推理步骤 | LLM（Skill 层） |
| ⚙️ | 确定性操作步骤 | CLI（`wiki migrate` / `wiki internal` 工具） |
| 🤝 | 人机交互步骤 | 人工决策，LLM 辅助 |

---

## 支持的操作类型

| op | 描述 | 典型触发场景 |
|----|------|------------|
| `reclassify` | 修改页面的 domain/subtype，可移动文件路径 | 页面放错了领域或子类 |
| `relocate` | 移动页面到不同 collection（不改 domain） | collection 结构调整 |
| `rename-domain` | 领域重命名（批量影响该域所有页面） | L007 域分裂、命名不一致 |
| `merge-subtype` | 将两个子类合并为一个 | 两个细粒度子类过于相似 |
| `deprecate` | 标记 taxonomy 项为废弃，可指定替代项 | taxonomy 清理、1:N 拆分 |
| `merge-pages` | 将重复/相似页面合并为一个 canon 页 | reconcile 发现重复，L006 矛盾根因 |

---

## 工作流

### Step 1 🧠：意图理解与操作类型选择

根据用户描述，识别迁移意图，选择最合适的 op：

- "把 `ai/concepts/` 下的 RAG 页面移到 `ai/rag/`" → `reclassify`
- "领域 `devops` 重命名为 `platform-engineering`" → `rename-domain`
- "这两个页面内容重复" → `merge-pages`
- "taxonomy 里 `fine-tuning` 已废弃，合并到 `training`" → `deprecate`
- "把 `ml/` 下未分类的页面批量补充 subtype" → `reclassify --filter subtype_is_null=true`

若意图不够明确（如仅说"整理一下 AI 领域"），必须追问：**要改的是路径位置还是分类标签？影响多少页面？**

### Step 2 ⚙️：创建迁移计划

```bash
# reclassify 示例：将指定页面从旧领域迁移到新领域
wiki migrate plan \
  --op reclassify \
  --from domain=ai/concepts \
  --to domain=ai/rag

# rename-domain 示例
wiki migrate plan \
  --op rename-domain \
  --from devops \
  --to platform-engineering

# 批量处理未分类页面（include_secondary 可匹配次要分类中的页面）
wiki migrate plan \
  --op reclassify \
  --filter subtype_is_null=true

# 合并重复页面（指定主页面和源页面）
wiki migrate plan \
  --op merge-pages \
  --primary canon/domains/ai/rag/retrieval-augmented-generation.md \
  --sources canon/domains/ai/concepts/rag-overview.md
```

`--from` 过滤参数说明：

| 参数 | 说明 |
|------|------|
| `domain=<name>` | 匹配主分类域名 |
| `subtype=<name>` | 匹配子类型 |
| `include_secondary=true` | 同时匹配 secondary_domains 中的领域（次要分类） |
| `subtype_is_null=true` | 仅匹配 subtype 为空的页面（未精细分类） |

> ⚠️ `--dry-run` 不是 `plan` 的参数。创建计划后，用 `wiki migrate dry-run <plan_id>` 单独执行预检。

dry-run 输出包含：
- 受影响页面列表（`path_changes[*].page_id / old_path / new_path`）
- collision 检测结果（`collisions_detected` + `collisions[*]`，表示目标路径是否已存在）
- cross_ref 断裂风险（哪些页面引用了将被移动的路径）
- plan_id（用于后续 apply / rollback）

### Step 3 🤝：展示计划，等待确认

将 dry-run 输出结构化呈现：

```
=== 迁移计划 {plan_id} ===

操作：reclassify
范围：ai/concepts/ → ai/rag/（共 8 页）

受影响页面：
  pg_abc123  ai/concepts/rag-overview.md → ai/rag/rag-overview.md
  pg_def456  ai/concepts/embedding.md   → ai/rag/embedding.md
  ...（共 8 条）

Collision 检测：✅ 无冲突
Cross-ref 风险：⚠️ 3 处引用将断裂（见下方列表）

需要你确认：
1. 批准执行（回复"批准"）
2. 修改范围（如只迁移部分页面）
3. 放弃本次计划
```

**Collision 处理（若存在）**：

若 dry-run 发现目标路径已存在页面，必须暂停并给出三选一问题：
1. **合并**：将源页面合并到目标页面 → 创建新的 merge-pages 计划：
   ```bash
   wiki migrate plan --op merge-pages \
     --primary <目标路径> \
     --sources <冲突源路径>
   wiki migrate dry-run <new_plan_id>
   wiki migrate apply <new_plan_id>
   ```
2. **重命名**：为源页面选择不冲突的新路径 → 修改 `--to` 参数重新创建计划
3. **放弃**：跳过该页面，其余正常迁移 → 从计划中排除冲突页面后重新创建计划

### Step 4 ⚙️：执行迁移

```bash
# 执行预检（必须在 apply 前执行）
wiki migrate dry-run <plan_id>

# 执行迁移（dry-run 无 collision 后）
wiki migrate apply <plan_id>
```

> ⚠️ `wiki migrate review <plan_id>` 命令**不存在**。  
> dry-run 执行成功（0 collision）后，plan status 自动置为 `reviewed`，无需单独确认命令。

apply 操作保证：
1. 文件系统路径变更（`fs.renameSync`）
2. SQLite 索引更新（upsertPageFile）
3. alias 记录写入（aliases.json：旧路径 → page_id）
4. plan status 更新为 `applied`

**merge-subtype 特殊行为**：`apply` 执行后，`--from.subtype` 指定的旧子类型会自动调用 `wiki taxonomy deprecate` 将其标记为 deprecated（前提是该 subtype 已在 taxonomy registry 中注册）。若尚未注册则跳过。

### Step 5 ⚙️🧠：迁移后验证

```bash
# 检查断裂引用（L004）
wiki internal scan --rule L004

# 检查 alias 是否写入
wiki internal alias list --page-id <page_id> --json

# 检查孤立页面（L001）
wiki internal scan --rule L001
```

若 L004 发现断裂引用，LLM 自动在受影响页面的 `cross_refs` 中将旧路径替换为新路径：
```bash
wiki internal frontmatter set <引用页路径> cross_refs <更新后的数组>
```

### Step 6 ⚙️（可选）：回滚

```bash
wiki migrate rollback <plan_id>
```

rollback 要求：plan status = `applied`（未 apply 的计划不可回滚）。
回滚后：
- 文件路径恢复到原位置
- SQLite 索引恢复（syncRuntimeFiles）
- **alias 条目清除**：aliases.json 中本次迁移新增的路径映射会被删除（路径已恢复原位，别名无意义）
- plan status 更新为 `rolled-back`

> ⚠️ `rolled-back` 状态的计划**不可重新 apply**，需重新执行 `wiki migrate plan` 创建新计划。

---

## 治理提案格式（govern 类 proposal）

当迁移计划需要经过 promote 审批流程时（如涉及大规模批量操作），在 `changes/inbox/` 中创建以下格式的 proposal：

```yaml
---
type: change-proposal
origin: govern
action: migrate
plan_id: <wiki migrate 生成的 plan_id>
proposed_at: <ISO 8601>
proposed_by: <维护者>
approve_note: "wiki migrate apply <plan_id>"
---

## 迁移摘要

操作：rename-domain
范围：ai-tools/ → ai/tools/（共 62 页）
dry-run 状态：已通过（0 collision）
影响：3 处 cross_ref 需同步更新

## 原因

L007 signal：ai-tools 域已有 62 页，超过阈值 50。
按 maintain Section 1 规范拆分，详见 maintain 计划。
```

审批后由 `wiki migrate apply <plan_id>` 消费，不经过 compile 流程。

---

## 与其他 Spec 的边界

| 场景 | 正确路由 |
|------|---------|
| 页面内容需要更新 | `ingest` → `compile` |
| 页面结构/路径需要调整 | `migrate`（本 spec） |
| 内容矛盾（两页面说法不同） | `reconcile` → Step 3 → 若根因是路径错误则 → `migrate` |
| 域页面过多（L007） | `lint` 发现 → `maintain Section 1` → `migrate reclassify`（按主题拆分到子域）|
| 未分类页面过多（L012） | `lint` 发现 → `maintain Section 7` → `migrate reclassify` |
| taxonomy 废弃 | `migrate deprecate` → `validateClassification` 检测废弃警告 |

---

## Quality Gates

1. **dry-run 必须在 apply 前执行**：plan status 必须经过 `reviewed`（dry-run 后确认）才能 apply。
2. **collision 零容忍**：apply 前若存在 collision（目标路径已有文件），强制要求人工裁决（合并/重命名/跳过）。
3. **apply 后 L004 无新增**：迁移完成后执行 `wiki internal scan --rule L004`，新增断裂引用须在本次任务中修复。
4. **alias 完整性**：apply 后 aliases.json 中包含本次所有被移动页面的旧路径记录。

---

## 调用示例

**场景：用户说"ai/concepts 下的 RAG 相关页面应该归到 ai/rag/ 去"**

```
AI 执行：
1. 🧠 识别意图：reclassify，from=ai/concepts（过滤 subtype=rag），to=ai/rag
2. ⚙️ wiki migrate plan --op reclassify --from domain=ai/concepts --filter subtype=rag --to domain=ai/rag
3. ⚙️ wiki migrate dry-run <plan_id>
4. 🤝 展示结果：发现 5 页，0 collision，2 处 cross_ref 风险，等待确认
5. 🤝 用户回复"批准"
6. ⚙️ wiki migrate apply <plan_id>
7. ⚙️ wiki internal scan --rule L004（验证 cross_ref）
8. ⚙️ 修复 2 处 cross_ref（frontmatter set）
9. 输出：迁移完成，5 页已移动，2 处引用已更新，alias 已记录

AI 输出（前台）：

结果：已将 ai/concepts/ 下 5 个 RAG 相关页面迁移到 ai/rag/
边界：cross_ref 引用已自动更新；旧路径通过 alias 保留可访问性
系统动作：migration plan {plan_id} applied，aliases.json 已更新
需要你决定：（无）
```
