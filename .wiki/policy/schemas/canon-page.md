---
type: schema
name: canon-page
version: 1.0
---

# Schema: Canon Page

canon 页面存放于 `.wiki/canon/domains/{domain}/` 下，是经过编译的权威知识。

## Frontmatter 字段

```yaml
---
type: concept                       # 枚举: concept | entity | comparison | guide | decision
title: "页面标题"                    # 必填
domain: "ai"                        # 必填，所属领域
primary_type: concept               # 必填，稳定主类型；通常与 type 一致
subtype: architecture               # 可选，半稳定子类型
sources:                            # 必填，不可为空列表
  - sources/articles/2026-04-08-xxx.md
  - sources/conversations/2026-04-01-yyy.md
confidence: high                    # 枚举: high | medium | low
last_compiled: "2026-04-08"         # 必填，最后编译时间
staleness_days: 0                   # 必填，距上次编译的天数（由 compile 更新）
last_updated: "2026-04-08"          # 必填，最后一次内容变更日期（由 compile 写入，lint 用于动态计算 staleness）
cross_refs:                         # 可选，引用的其他 canon 页面 slug
  - transformer-architecture
  - attention-mechanism
status: active                      # 枚举: active | archived | draft
has_divergence: false               # 可选，reconcile keep_both 裁决后设为 true，表示该页面保留了并存的分歧观点
tags: [tag1, tag2]                  # 可选
last_queried_at: ~                  # 可选，最后一次被 query spec 引用的日期（由 query spec 更新）
query_count: 0                      # 可选，累计被 query spec 引用次数（由 query spec 更新）
---
```

## 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| type | 是 | 页面类型：concept（概念）/ entity（实体）/ comparison（对比）/ guide（指南）/ decision（决策） |
| title | 是 | 页面标题 |
| domain | 是 | 所属知识领域 |
| primary_type | 是 | 稳定主类型，供检索阶段先缩小范围；默认应与 `type` 一致 |
| subtype | 否 | 半稳定子类型；未进入 registry 的值可继续保留在页面，但正式 registry 需通过 taxonomy queue 吸收 |
| sources | 是 | 支撑此页面的 source 文件路径列表，**不可为空** |
| confidence | 是 | 可信度：high / medium / low |
| last_compiled | 是 | 最后一次 compile 操作的日期 |
| staleness_days | 是 | 距上次编译的天数，由 compile spec 自动更新 |
| last_updated | 是 | 最后一次内容变更日期（YYYY-MM-DD），由 compile 写入；lint 优先用此字段动态计算 effective_staleness_days |
| cross_refs | 否 | 正文中引用的其他 canon 页面 slug 列表 |
| status | 是 | active（活跃）/ archived（已归档）/ draft（草稿） |
| tags | 否 | 关键词标签 |
| last_queried_at | 否 | 最后一次被 query spec 引用的日期（YYYY-MM-DD），由 query spec 在 Step 3 读取页面时自动更新 |
| query_count | 否 | 累计被 query spec 引用次数，初始为 0，每次 query 引用时 +1 |
| has_divergence | 否 | reconcile keep_both 裁决后由 reconcile spec 设为 true，表示页面中保留了并存的分歧观点；默认 false 或缺失 |

## 页面类型模板

### concept（概念页）

```markdown
## 定义

## 核心特征

## 相关概念

## 参考来源
```

### entity（实体页）

```markdown
## 基本信息

## 关键属性

## 历史/背景

## 参考来源
```

### comparison（对比页）

```markdown
## 对比维度

## 详细对比

| 维度 | A | B |
|------|---|---|

## 选择建议

## 参考来源
```

### guide（指南页）

```markdown
## 前提条件

## 步骤

## 常见问题

## 参考来源
```

### decision（决策页）

```markdown
## 背景与约束

## 选项分析

## 决策结论

## 参考来源
```

## 文件命名规范

```
{slug}.md
```

示例：`transformer-architecture.md`
