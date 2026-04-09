---
type: template
name: query-claim-annotation-template
version: 1.0
created_at: 2026-04-09
---

# Query Claim Annotation Template

## Metadata

| 字段 | 值 |
|---|---|
| run_id | `{baseline|fixed}-q-{YYYYMMDD}-{n}` |
| case_id | `QB-...` |
| judge | `{judge_id}` |

## Claim Table

| claim_id | claim_text | claim_kind | cited_marker | cited_page | judge_label | evidence_or_reason |
|---|---|---|---|---|---|---|
| 1 | `{声明文本}` | `factual / non-factual` | `[来源] / [⚠️ canon 外推断] / [⚠️ 训练知识] / none` | `{slug or ~}` | `supported / unsupported / uncertain / not-scored` | `{依据}` |

## Label Notes

- `factual`：定义、数据、因果、规范、步骤性要求等可判真伪的声明  
- `non-factual`：过渡语、总结语、礼貌语、结构引导语  
- `supported`：能被 canon 页面直接支持，或外推断链条与 rubric 一致  
- `unsupported`：没有 canon 依据、外推断越界、或把训练知识伪装成 canon 结论  
- `uncertain`：页面存在但证据不足以下最终判断  
- `not-scored`：非事实性语句，不参与主指标

