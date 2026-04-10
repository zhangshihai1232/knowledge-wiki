# P2-2：compile Step 5 补充 split/merge 源条目清理规则

## 背景

compile.md Step 5 定义了 create/archive/update/merge/split 五类 action 对应的 MOC 更新逻辑，但
存在两处遗漏：

1. **split 操作**：只说"若 slug 或 title 变化则同步更新条目"，未规定原页面 slug 在拆分完成后
   须从所有 `_index.md` 中移除。原页被标记为 archive，但 MOC 中仍保留其条目，导致死链（L004 ERROR）。
2. **merge 操作**：只说"若 slug 或 title 变化则同步更新条目"，未说明被合并的各 source 页面的
   slug 是否从 MOC 中移除。source 页被标记为 archive，同样造成 MOC 死链。
3. **顶层 _index.md 追加领域条目**：首次创建领域时追加条目的逻辑无幂等性保护，若同一领域的
   第二个 create proposal 被编译，会重复追加同一领域条目。

## 修改文件

- `.wiki/policy/specs/compile.md`

## compile.md 修改内容

### split 操作末尾增加源条目清理规则

**在以下文字之后插入**：

```
- 拆分完成后，将原页标记为 `archive`
```

**插入内容**：

```markdown
- 清理原页 MOC 条目：从所有包含原页 slug 的 `_index.md`（领域索引及顶层索引）中移除该条目行；
  在 LOG 中追加注释行 `<!-- split: removed [[<原页slug>]] from MOC -->`
```

**说明**：split 完成后原页进入 archive 状态，等同于 archive action 对 MOC 的处理（compile.md
第 266 行），因此清理逻辑与 archive 保持一致，仅补充 LOG 注释以区分触发来源。

---

### merge 操作末尾增加源条目清理规则

**在以下文字之后插入**：

```
- 合并完成后，将原 source 页的 action 标记为 `archive`，触发后续归档流程
```

**插入内容**：

```markdown
- 清理 source 页 MOC 条目：对每个参与合并的 source slug，从其所在 `_index.md` 中移除对应条目行；
  在 LOG 中逐条追加注释行 `<!-- merge: removed [[<source_slug>]] from MOC -->`
```

**说明**：merge 后各 source 页同样进入 archive 状态，MOC 清理逻辑与 archive 一致。显式在此列出
是为了避免依赖"archive 触发后续归档流程"的隐式推断——Step 2 中 archive action 是独立路由，
不会自动被 merge 触发，须在 merge 分支内显式执行清理。

---

### 幂等性保证（顶层 _index.md 追加领域条目）

**在以下文字之后插入**：

```
同时，在顶层 `canon/_index.md` 的 `## 领域列表` 节追加该领域条目：
```

**将现有追加逻辑替换为**：

```markdown
同时，在顶层 `canon/_index.md` 的 `## 领域列表` 节追加该领域条目，**前提是该领域条目尚未存在**：

检查逻辑：扫描 `## 领域列表` 节下所有条目行，若已存在以 `[{domain}]` 开头的条目，则跳过追加；
否则在节末尾追加：

```markdown
- [{domain}](domains/{domain}/_index.md) — {领域简述，取自 target_page 的 domain 字段}
```

（此幂等性检查仅针对顶层 `_index.md` 的领域条目追加，不影响领域内 `_index.md` 的页面条目写入。）
```

## 验证方式

1. **split 死链消除**：执行一个 split proposal 后，检查原页 slug 不再出现在任何 `_index.md` 的
   条目列表中；新目标页 slug 正常出现在对应领域 `_index.md` 中。
2. **merge 死链消除**：执行一个 merge proposal 后，检查所有 source slug 均已从 `_index.md` 中
   移除；target slug 条目正常存在。
3. **LOG 注释可追溯**：LOG.md 中能找到对应的 `<!-- split: removed ... -->` 或
   `<!-- merge: removed ... -->` 注释行，数量与参与操作的 slug 数一致。
4. **顶层索引幂等**：对同一领域连续执行两次 create proposal，顶层 `canon/_index.md` 的
   `## 领域列表` 节中该领域条目仅出现一次。
5. **回归验证**：archive action 独立执行时 MOC 清理行为不受影响（Step 5 中 archive 分支逻辑
   未改动）。
