# P0-1：staleness_days 改为动态计算

## 背景

`staleness_days` 字段在 compile.md Step 3 中被重置为 0，记录的是"上次 compile 时的页面新鲜度"。但整个系统规范中没有定义该值如何随日历时间自动增长：没有后台定时任务去修改文件，也没有在 lint 运行时将时间差回填到 frontmatter。

结果是：lint.md 的 L002（检查 `staleness_days > 90`）和 L005（检查 `staleness_days > 30`）所读取的值永远停留在上次 compile 写入的静态数字，不会随时间推移而增加。除非有人手动改写 frontmatter，否则这两条规则在实践中永远无法自动触发。

根本原因：`staleness_days` 被设计成"距上次 compile 的天数"，但 lint 读取时未将"当前日期 - last_updated"计算进去，导致语义断裂。

## 修改文件

- `.wiki/policy/specs/lint.md`

## 具体修改内容

### lint.md — 在 Step 1 中增加动态计算逻辑

在 lint.md 的 Step 1 加载完 frontmatter 字段后，lint 运行时立即用当前日期动态计算实际过期天数，替代直接使用 frontmatter 中存储的静态值。

**在以下文字之后插入**：

```
2. 读取每个页面的 frontmatter，提取：`sources`、`cross_refs`、`confidence`、`staleness_days`、`type`、`last_updated`。
```

**插入内容**：

```markdown
   **动态计算 staleness_days**：在读取完 frontmatter 后，立即用以下规则覆盖内存中的 `staleness_days` 值（不写回文件）：

   - 若 frontmatter 存在 `last_updated` 字段（格式 `YYYY-MM-DD` 或 ISO 8601），则：
     ```
     effective_staleness_days = (今日日期 - last_updated).days
     ```
   - 若 `last_updated` 字段缺失或无法解析，则回退使用 frontmatter 中存储的 `staleness_days` 静态值；若该值同样缺失，视为 `effective_staleness_days = 0`。
   - 后续所有规则检查（L002、L005）均使用 `effective_staleness_days`，而非 frontmatter 原始值。
```

完整插入位置在 Step 1 的第 2 步之后、第 3 步"并行执行以下检查"之前。

---

### lint.md — 更新 L002 和 L005 规则说明

**L002 触发条件**，将原文：

```
- **触发条件**：`staleness_days > 90`
```

更新为：

```
- **触发条件**：`effective_staleness_days > 90`（lint 运行时动态计算：今日日期 - `last_updated`；若 `last_updated` 缺失则回退使用 frontmatter 中的 `staleness_days` 静态值）
```

**L005 触发条件**，将原文：

```
- **触发条件**：`confidence=low` 且距最后更新超过 30 天（`staleness_days > 30`）
```

更新为：

```
- **触发条件**：`confidence=low` 且 `effective_staleness_days > 30`（lint 运行时动态计算，同 L002）
```

## 设计说明

本方案选择"lint 运行时动态计算、不写回文件"，而非"后台定时任务定期将天数写回 frontmatter"。理由如下：

**为何不选择"后台定时任务写回文件"**：

1. **引入不必要的写操作**：让一个定时任务每天修改所有 canon 页面的 frontmatter，会制造大量 git diff 噪音，使"页面变更历史"失去信号价值——每次 commit 都混入机械性的数字递增。
2. **增加系统复杂度**：需要额外定义定时任务的调度规范、失败处理、幂等性保障，这些都不在现有 spec 范围内。
3. **单点事实来源混乱**：`last_updated` 已经是"上次 compile 时间"的权威来源，`staleness_days` 本质上是它的衍生值。维护两个表达同一事实的字段（且需要保持同步）是冗余设计。

**为何选择"lint 运行时动态计算"**：

1. **零副作用**：计算结果只存在于 lint 的内存上下文中，不产生任何文件变更，符合 lint 规范"不修改 canon 内容本身"的原则（lint.md Purpose 第一段）。
2. **单一事实来源**：`last_updated` 是唯一需要维护的字段，`effective_staleness_days` 是它的纯函数推导，逻辑简单且可验证。
3. **改动范围最小**：仅在 lint 的 Step 1 中增加一次日期差计算，不需要新增任何触发器、调度器或额外 spec 文件。
4. **向后兼容**：对于 `last_updated` 缺失的旧页面，回退使用 frontmatter 中的静态 `staleness_days`，不破坏现有数据。

## 验证方式

1. **构造测试用例**：创建一个 `last_updated` 为 91 天前的 canon 页面，frontmatter 中 `staleness_days: 0`（模拟刚 compile 后未变化的状态）。运行 lint，预期该页面被 L002 标记为 WARNING。
2. **回退路径验证**：创建一个缺少 `last_updated` 字段、`staleness_days: 95` 的页面，运行 lint，预期仍触发 L002（回退使用静态值）。
3. **L005 联动验证**：创建 `confidence: low`、`last_updated` 为 31 天前的页面，运行 lint，预期触发 L005 INFO。
4. **无副作用验证**：lint 运行后检查所有 canon 页面的 frontmatter，确认 `staleness_days` 字段未被修改（git diff 应为空）。
