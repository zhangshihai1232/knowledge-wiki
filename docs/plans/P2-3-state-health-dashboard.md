# P2-3：STATE.md 升级为健康仪表板

## 背景

当前 STATE.md 仅记录静态计数字段（total_sources、total_canon_pages 等），无法反映知识库的质量趋势和健康演变。缺失的关键指标包括：confidence 分布、平均陈旧天数、归档速率、近期 compile 频率等。

此外，`last_lint_score` 字段虽然存在于 Schema 中，但其计算规则从未被定义，导致各 Spec 实现时无据可依，是一个悬空字段。

本方案在不破坏现有字段结构的前提下，向 `## 系统健康` 节追加趋势指标字段，并为 `last_lint_score` 补充明确的计算规则。

## 修改文件

- `.wiki/policy/schemas/state-log.md`

## state-log.md 修改内容

### 1. 在 `## 系统健康` 节增加趋势指标字段

**在以下文字之后插入**（以 `## 系统健康` 节现有最后一行为锚点）：

```
- open_conflicts: {整数}             # 当前 <<<CONFLICT>>> 标记数量
```

**插入内容**：

```yaml
- confidence_distribution: {high: N, medium: N, low: N}  # 各置信度级别的 canon 页面数；high=confidence≥0.8，medium=0.5–0.79，low<0.5
- avg_staleness_days: N                                    # 全库 canon 页面 staleness_days 的算术平均值，取整；~ 表示无数据
- archived_pages: N                                        # canon/domains/ 下 status: archived 的页面总数
- archive_rate_30d: N                                      # 近 30 天内完成归档操作的页面数
- compile_rate_30d: N                                      # 近 30 天内执行 compile 操作的次数（从 LOG.md 计数）
```

### 2. 明确 last_lint_score 计算规则

**替换现有 `last_lint_score` 行**：

原文（当前第 43 行）：
```
- last_lint_score: {百分比 | ~}      # 最后一次 lint 的健康分数
```

替换为：
```
- last_lint_score: {百分比 | ~}      # 最后一次 lint 的健康分数；计算规则：满分 100，L002 每条扣 3 分，L005 每条扣 1 分，L007 每条扣 2 分，其余 ERROR 每条扣 5 分，其余 WARNING 每条扣 1 分；公式：max(0, 100 - Σ扣分)，结果格式为 "N%"
```

### 3. 更新责任表

**在现有责任表末尾追加以下行**（插入位置：`活跃领域列表` 行之后）：

| 字段 | 由哪个 Spec 更新 | 更新时机 | 更新方式 |
|------|-----------------|----------|----------|
| `confidence_distribution` | lint | Step 6 末尾 | 遍历全部 canon 页，按 frontmatter `confidence` 字段分档计数 |
| `avg_staleness_days` | lint | Step 6 末尾 | 遍历全部 canon 页，取 `staleness_days` 字段均值，取整；若无数据则写 `~` |
| `archived_pages` | compile | Step 7 末尾（archive 时） | 重新计数 `canon/domains/` 下 `status: archived` 的页面数 |
| `archive_rate_30d` | maintain | 维护操作完成后 | 扫描 LOG.md，统计最近 30 天 `[maintain]` 条目中包含"归档"的记录数 |
| `compile_rate_30d` | compile | Step 7 末尾 | 扫描 LOG.md，统计最近 30 天 `[compile]` 条目数 |

## 验证方式

1. **字段完整性**：执行 lint 后，STATE.md 中 `## 系统健康` 节应包含全部 8 个字段（原有 3 个 + 新增 5 个），且均为非空值（无数据时写 `~`）。

2. **last_lint_score 可复现**：给定任意一次 lint 的 issue 列表，按公式手动计算分数，结果应与 STATE.md 中 `last_lint_score` 完全一致，误差为 0。

3. **confidence_distribution 总和一致**：`confidence_distribution.high + medium + low` 应等于 `total_canon_pages`（archived 页面不计入，需在 lint spec 中说明排除规则）。

4. **compile_rate_30d 可核查**：从 LOG.md 手动统计 30 天内 `[compile]` 条目数，结果应与 STATE.md 中 `compile_rate_30d` 一致。

5. **责任表覆盖性**：责任表中所有字段与 STATE.md 正文字段一一对应，无遗漏、无重复。
