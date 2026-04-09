---
type: protocol
name: query-adjudication-protocol
version: 1.0
created_at: 2026-04-09
---

# Query Adjudication Protocol

## 1. 双评审要求

每个 query case 默认由两位 judge 独立完成：

1. `query-answer-log-template.md`
2. `query-claim-annotation-template.md`

两位 judge 在看到对方结论前完成首轮标注。

## 2. 触发仲裁的条件

满足以下任一条件，进入第三方仲裁：

- 同一 claim 的标签不一致
- 对 `writeback_schema_valid_rate` 的判断不一致
- 对 case 是否“边界诚实”判断不一致
- 对 factual / non-factual 切分分歧超过 2 条 claim

## 3. 仲裁输出

仲裁人必须补一条 final record：

| 字段 | 值 |
|---|---|
| case_id | `QB-...` |
| disputed_claims | `{claim_id list}` |
| final_labels | `{最终标签}` |
| rationale | `{为何采纳该结论}` |

## 4. 汇总规则

- case 级最终结果以仲裁后标签为准
- run 级指标只统计最终标签
- 若某 case 因资料损坏无法判定，必须单列为异常，不得静默剔除

