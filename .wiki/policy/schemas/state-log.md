---
type: schema
name: state-log
version: 1.0
---

# Schema: STATE.md 和 LOG.md

## STATE.md 字段规范

STATE.md 存放于 `.wiki/policy/STATE.md`，记录系统当前状态快照。

### Frontmatter

```yaml
---
type: state                         # 固定值
version: 1.0                        # schema 版本
updated_at: "2026-04-08"            # 最后更新时间，每次操作后更新
---
```

### 正文字段

```markdown
## 统计

- total_sources: {整数}              # sources/ 下的文件总数（不含 .gitkeep）
- total_canon_pages: {整数}          # canon/domains/ 下的 .md 文件总数（不含 _index.md）
- total_domains: {整数}              # canon/domains/ 下的子目录数
- pending_proposals: {整数}          # changes/inbox/ + changes/review/ 的文件数
- last_ingest: {日期 | ~}            # 最后一次 ingest 操作时间
- last_compile: {日期 | ~}           # 最后一次 compile 操作时间
- last_lint: {日期 | ~}              # 最后一次 lint 操作时间

## 活跃领域

- {domain}: {page_count} 页          # 每个活跃领域一行

## 系统健康

- status: {initialized | healthy | warning | error}
- confidence_health: {healthy | degraded | critical}  # healthy: low占比<50%; degraded: low占比50-80%; critical: low占比>80%
- staleness_health: {healthy | warning | critical}    # healthy: avg_staleness_days<30; warning: 30-90; critical: >90
- last_lint_score: {百分比 | ~}      # 最后一次 lint 的健康分数（计算规则：满分100，L002每条-3，L005每条-1，L007每条-2，其余ERROR每条-5，WARNING每条-2）
- open_conflicts: {整数}             # 当前 <<<CONFLICT>>> 标记数量
- confidence_distribution: {high: N, medium: N, low: N}  # 各置信度等级页面数量分布
- avg_staleness_days: {浮点数 | ~}   # 所有非 archived canon 页的 effective_staleness_days 均值
- archived_pages: {整数}             # status=archived 的 canon 页总数
- archive_rate_30d: {整数}           # 近30天内新增归档页数
- compile_rate_30d: {整数}           # 近30天内 compile 操作次数
- writeback_proposal_count: {整数}   # query write-back 产生的 proposal 累计总数
- writeback_conversion_rate: {浮点数 | ~}  # write-back proposal 被 compiled 的比例（compiled数 / 总数），无数据时为 ~
- consecutive_approve_count: {整数}  # 最近连续 approve 次数（遇到 reject 重置为 0），用于审查模式预警
- total_queries_with_writeback: {整数}  # 触发 write-back 的查询总次数
```

### 更新规则

- 每次 ingest/compile/promote/lint/maintain 操作完成后必须更新
- `updated_at` 每次写入时更新为当前日期
- 统计数字通过实际文件计数得出，不可手动估算

### 各 Spec 的 STATE.md 更新责任

| 字段 | 由哪个 Spec 更新 | 更新时机 | 更新方式 |
|------|-----------------|----------|----------|
| `total_sources` | ingest | Step 7 末尾 | 重新计数 `sources/` 下非 `.gitkeep` 文件 |
| `total_canon_pages` | compile | Step 7 末尾 | 重新计数 `canon/domains/` 下非 `_index.md` 的 `.md` 文件 |
| `total_domains` | compile | Step 7 末尾（create/archive 时） | 重新计数 `canon/domains/` 下子目录数 |
| `pending_proposals` | ingest、promote、compile | 各自 Step 7 末尾 | 重新计数 `changes/inbox/` + `changes/review/` 文件数 |
| `last_ingest` | ingest | Step 7 末尾 | 设为今日日期 |
| `last_compile` | compile | Step 7 末尾 | 设为今日日期 |
| `last_lint` | lint | Step 6 末尾 | 设为今日日期 |
| `last_promote_at` | promote | Step 4 末尾 | 设为当前时间戳（ISO 8601） |
| `last_lint_score` | lint | Step 6 末尾 | 设为本次健康分数（百分比字符串） |
| `open_conflicts` | compile | Step 7 末尾（有冲突时） | 重新扫描全部 canon 页中 `<<<CONFLICT>>>` 标记数量 |
| `status` | lint | Step 6 末尾 | 按规则：0 ERROR → healthy；有 ERROR → error；仅 WARN → warning |
| `活跃领域列表` | compile | Step 7 末尾（create/archive 时） | 重新统计各领域页面数 |
| `confidence_health` | compile | Step 7 末尾 | 按阈值计算：low页数/总页数 < 50% → healthy；50-80% → degraded；> 80% → critical |
| `staleness_health` | lint | Step 6 末尾 | 按阈值计算：avg_staleness_days < 30 → healthy；30-90 → warning；> 90 → critical |
| `writeback_proposal_count` | lint | Step 5.5 | 计数 `changes/` 下 `origin: query-writeback` 的 proposal 文件 |
| `writeback_conversion_rate` | lint | Step 5.5 | 计算 write-back proposal 中 `compiled: true` 的比例 |
| `consecutive_approve_count` | promote | Step 4 末尾 | 每次 approve +1；每次 reject 重置为 0 |
| `total_queries_with_writeback` | query | Step 6 | 每次 write-back 触发时 +1 |

---

## LOG.md 字段规范

### 两个 LOG 文件的职责分工

系统存在两个 LOG 文件，各有明确职责，不得混用：

| 文件 | 路径 | 负责记录 |
|------|------|---------|
| policy LOG | `.wiki/policy/LOG.md` | ingest、lint、maintain 的主体执行日志 |
| changes LOG | `.wiki/changes/LOG.md` | promote、compile、reconcile，以及 consume approved maintenance proposal 的记录 |

**判断规则**：操作涉及 `changes/` 目录下文件变更的，写 `changes/LOG.md`；操作涉及 `sources/` 或系统状态检查的，写 `policy/LOG.md`。compile 会写 `changes/LOG.md`；maintain 默认写 `policy/LOG.md`，若本次消费了 approved maintenance proposal，则额外写 `changes/LOG.md` 记录消费动作。

LOG.md 存放于 `.wiki/policy/LOG.md`，记录所有操作的追加日志。

### Frontmatter

```yaml
---
type: log                           # 固定值
version: 1.0                        # schema 版本
started_at: "2026-04-08"            # 系统初始化时间，不变
---
```

### 日志格式

每条记录格式：

```
- [{日期}] [{操作类型}] {详情}
```

### 操作类型枚举

| 操作类型 | 说明 |
|----------|------|
| system | 系统级操作（初始化、配置变更） |
| ingest | 摄入新资料 |
| compile | 编译 approved proposal 到 canon |
| promote | 审查并决定 proposal |
| query | 查询操作（可选记录） |
| lint | 健康检查 |
| maintain | 结构性维护操作 |

### 示例

```markdown
## 日志

- [2026-04-08] [system] LLM Wiki 初始化完成
- [2026-04-08] [ingest] 摄入 article: attention-is-all-you-need，生成 2 个 proposal
- [2026-04-09] [promote] approved: 2026-04-08-create-transformer-architecture.md
- [2026-04-09] [compile] 编译 transformer-architecture.md，新建 canon 页面
- [2026-04-10] [lint] 健康检查完成，score: 95%，发现 1 个 WARNING
```

### 追加规则

- **只追加，不修改**历史记录
- 每次操作追加到 `## 日志` 节末尾
- 详情应足够具体，能从日志重建操作历史
