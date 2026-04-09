---
type: template
name: query-answer-log-template
version: 1.0
created_at: 2026-04-09
---

# Query Answer Log Template

## Run Metadata

| 字段 | 值 |
|---|---|
| run_id | `{baseline|fixed}-q-{YYYYMMDD}-{n}` |
| benchmark_ref | `evaluation/benchmark/query-benchmark.md@v1.0` |
| case_id | `QB-...` |
| group | `baseline` / `fixed` |
| executed_at | `{ISO 8601}` |
| operator | `{agent_or_reviewer}` |

## Query

`{原始问题}`

## Expected Coverage

- benchmark 标记：`covered` / `partial` / `gap`
- 主要指标：`{unsupported_claim_rate / write-back trigger / ...}`

## Candidate Canon Pages

- `{domain/category/slug}`
- `{domain/category/slug}`

## Raw Answer

```markdown
{系统原始回答，保留来源标注与知识缺口通知}
```

## Write-back Record

| 字段 | 值 |
|---|---|
| writeback_triggered | `yes` / `no` |
| proposal_path | `{changes/inbox/...}` |
| schema_valid | `yes` / `no` |
| notes | `{若无 proposal，说明原因}` |

## Claim Summary

| 指标 | 值 |
|---|---|
| source_claim_count | `{n}` |
| inference_claim_count | `{n}` |
| training_claim_count | `{n}` |
| total_factual_claims | `{n}` |
| canon_inference_ratio | `{0.xx}` |

## Utilization Update Check

| 页面 | cited_in_answer | query_count_before | query_count_after | last_queried_at_after |
|---|---|---:|---:|---|
| `{slug}` | `yes/no` | `{n}` | `{n}` | `{YYYY-MM-DD or ~}` |

## Reviewer Notes

- `{记录异常、边界诚实性、来源覆盖问题}`

