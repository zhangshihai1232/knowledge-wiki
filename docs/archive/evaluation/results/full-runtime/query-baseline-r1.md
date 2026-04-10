---
type: runtime-result
name: query-baseline-r1
group: baseline
round: 1
run_id: query-baseline-r1
ruleset_ref: 9bb0a43
benchmark_ref: evaluation/benchmark/query-benchmark.md@v1.0
canon_ref: evaluation/benchmark/fixtures/canon-seed/
judging_assets_ref: evaluation/benchmark/fixtures/templates/
protocol_ref: evaluation/benchmark/runtime-validation-protocol.md@v1.0
deterministic_replay: true
created_at: 2026-04-09
---

# Query Full Runtime Result — Baseline R1

本轮是 frozen query benchmark 的确定性回放，r1/r2/r3 仅在 run_id 与 round 元数据上不同，判定结果完全一致。按 `9bb0a43` 的原始 query / promote / compile 规则严格执行时，baseline 仍以 `canon/domains/{domain}/{slug}.md` 作为主要导航模型，不能稳定落到 seed 的 `{domain}/{category}/{slug}.md` 页面；因此 30 个 covered/partial case 被误判为缺口并回退到无 canon 依据回答，45 个 write-back 全触发但 schema 全部不合法。

注：`unsupported_claims` 按“无 canon 依据的事实断言”统计，显式 `[⚠️ 训练知识]` 回退不免责。

## case 级结果

| case_id | group | round | coverage_type | source_claim_count | inference_claim_count | training_claim_count | unsupported_claims | total_factual_claims | writeback | schema_valid | utilization_updated | boundary_honesty | verdict | notes |
|---|---|---:|---|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| QB-C-01 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-02 | baseline | 1 | covered | 0 | 0 | 4 | 4 | 4 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-03 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-04 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-05 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-06 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-07 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-08 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-09 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-10 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-11 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-12 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-13 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-14 | baseline | 1 | covered | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-C-15 | baseline | 1 | covered | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-01 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-02 | baseline | 1 | partial | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-03 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-04 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-05 | baseline | 1 | partial | 0 | 0 | 4 | 4 | 4 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-06 | baseline | 1 | partial | 0 | 0 | 2 | 2 | 2 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-07 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-08 | baseline | 1 | partial | 0 | 0 | 4 | 4 | 4 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-09 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-10 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-11 | baseline | 1 | partial | 0 | 0 | 4 | 4 | 4 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-12 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-13 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-14 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-P-15 | baseline | 1 | partial | 0 | 0 | 3 | 3 | 3 | yes | no | no | no | FAIL | 基线路径缺 category，误判缺口；无效 write-back |
| QB-G-01 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-02 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-03 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-04 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-05 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-06 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-07 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-08 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-09 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-10 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-11 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-12 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-13 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-14 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |
| QB-G-15 | baseline | 1 | gap | 0 | 0 | 0 | 0 | 0 | yes | no | no | yes | PARTIAL | 真实 gap；但 baseline write-back schema 不合法 |

## 聚合指标

| metric | value |
|---|---|
| pass_count | 0 |
| partial_count | 15 |
| fail_count | 30 |
| unsupported_claim_rate | 85/85 = 1.00 |
| writeback_schema_valid_rate | 0/45 = 0.00 |
| metric_collectability_coverage | 2/5 = 0.40（仅来源覆盖、boundary honesty 可稳定采集） |
| boundary_honesty_rate | 15/45 = 0.33 |
| utilization_update_rate | 0/45 = 0.00 |

## 关键发现

- r1/r2/r3 完全一致，说明本 benchmark 在 frozen seed 与 frozen judging assets 下是确定性重放。
- baseline 的主损伤来自导航模型：domain index 到 category-nested page 的路径没有闭环，30 个非 gap case 全部掉入“假缺口”。
- 45/45 write-back 都被触发，但 query spec 没有为 query-writeback 定义成型 frontmatter / origin / trigger 约束，所以 schema_valid_rate 为 0。
- `canon外推断占比` 与 `query_count / last_queried_at` 在 baseline 中都缺稳定采集逻辑，因此 metric_collectability_coverage 只有 0.40。
