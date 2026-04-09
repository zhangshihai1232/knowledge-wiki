---
type: schema
name: change-proposal
version: 1.0
---

# Schema: Change Proposal

change proposal 文件存放于 `.wiki/changes/{status}/` 下，记录对 canon 知识库的变更请求。

## Frontmatter 字段

```yaml
---
type: change-proposal               # 固定值
action: create                      # 枚举: create | update | merge | split | archive
status: inbox                       # 枚举: inbox | review | approved | rejected | conflict
target_page: "ai/concepts/transformer-architecture"  # 必填，目标 canon 页面路径（相对 canon/domains/，格式：{domain}/{category}/{slug}）
target_type: concept                # 条件必填（action=create 时必填）：枚举 concept | entity | comparison | guide | decision
trigger_source: "sources/articles/2026-04-08-xxx.md"  # 必填，触发此提案的 source 文件路径（相对 .wiki/）
confidence: medium                  # 必填，AI 对此提案可信度的评估：high | medium | low
proposed_at: "2026-04-08"           # 必填，提案创建时间
reviewed_by: ~                      # 可选，审查人（approved/rejected 时必填）
reviewed_at: ~                      # 可选，审查时间（ISO 8601）
approve_note: ~                     # 条件必填，approve 时必填，≥20字，说明批准理由，不得为占位符
rejection_reason: ~                 # 可选，拒绝时必填
compiled: false                     # 是否已被 compile spec 处理
compiled_at: ~                      # 可选，compile 完成时间
auto_quality_score: ~               # 可选，ingest 阶段 AI 自动评分（0-1），低于 0.4 进入 changes/low-quality/
conflict_location: ~                # 可选，compile 检出冲突时填写（格式："{节标题} 第 {行号} 行"）
---
```

## 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| type | 是 | 固定为 `change-proposal` |
| action | 是 | 变更类型：create（新建）/ update（更新）/ merge（合并）/ split（分裂）/ archive（归档） |
| status | 是 | 流转状态：inbox → review → approved/rejected |
| target_page | 是 | 目标 canon 页面路径，相对于 `canon/domains/`，格式：`{domain}/{category}/{slug}` |
| target_type | 条件 | action=create 时必填：concept / entity / comparison / guide / decision |
| trigger_source | 是 | 触发此提案的 source 文件路径（相对 `.wiki/`） |
| confidence | 是 | AI 对提案可信度的评估：high / medium / low，默认 medium |
| proposed_at | 是 | 提案创建时间（ISO 8601 日期） |
| reviewed_by | 条件 | approved/rejected 时必填 |
| reviewed_at | 条件 | approved/rejected 时必填（ISO 8601 时间戳） |
| approve_note | 条件 | approved 时必填，≥20字，说明批准理由，不得为"同意"、"OK"、"approve"等占位符 |
| rejection_reason | 条件 | rejected 时必填，说明拒绝原因 |
| compiled | 是 | `false` = 待编译；`true` = 已被 compile spec 处理 |
| compiled_at | 条件 | compile 完成时由 compile spec 填写 |
| auto_quality_score | 否 | ingest 阶段 AI 评分（0-1）：≥0.4 进入正常 inbox；<0.4 进入 `changes/low-quality/` 暂存区 |
| conflict_location | 条件 | compile 检出冲突时必填，格式：`"{节标题} 第 {行号} 行"` |

## 正文结构

```markdown
{frontmatter}

## 提案摘要

{一句话说明此提案做什么}

## 变更内容

### 新增内容

{新增的章节或段落}

### 修改内容

{修改的具体内容，使用 diff 格式或直接描述}

### 删除内容

{删除的内容（如有）}

## Source 证据

{从 trigger_source 中摘录的支撑声明，带段落引用}

## AI 建议

{ingest spec 生成的建议说明}
```

## 文件命名规范

```
{proposed_at}-{action}-{target-slug}.md
```

示例：`2026-04-08-create-transformer-architecture.md`

## 状态流转

```
inbox ──────────────────────────────────────────────────────┐
  │ promote: approve                                         │ promote: reject
  ▼                                                          ▼
approved ──(compile 处理)──► compiled: true            rejected ──(promote: reopen)──► inbox
  │ promote: modify                                          （永久保留，可 reopen 重新提交）
  ▼
review ──(promote: approve/reject)──► approved / rejected

compile 检出冲突时：
approved ──(compile: conflict detected)──► conflict（移动至 changes/conflicts/，触发 reconcile spec）
```
