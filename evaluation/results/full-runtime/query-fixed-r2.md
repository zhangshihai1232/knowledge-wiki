---
type: runtime-result
name: query-fixed-r2
group: fixed
round: 2
run_id: query-fixed-r2
ruleset_ref: working-tree
benchmark_ref: evaluation/benchmark/query-benchmark.md@v1.0
canon_ref: evaluation/benchmark/fixtures/canon-seed/
judging_assets_ref: evaluation/benchmark/fixtures/templates/
protocol_ref: evaluation/benchmark/runtime-validation-protocol.md@v1.0
deterministic_replay: true
created_at: 2026-04-09
---

# Query Full Runtime Result — Fixed R2

本轮同样是冻结输入的确定性回放，r1/r2/r3 结果完全一致。按当前 working tree 规则执行时，fixed 已补齐 category-aware 路径、claim 计数、合法 query-writeback frontmatter 与 utilization 更新时机，所以 30 个 covered/partial case 能稳定命中 canon seed，15 个 gap case 则按“诚实缺口 + 合法 write-back”处理。

注：`unsupported_claims` 按“无 canon 依据的事实断言”统计；15 个 pure gap case 选择零事实断言，因此不会靠训练知识刷低风险。

## case 级结果

| case_id | group | round | coverage_type | source_claim_count | inference_claim_count | training_claim_count | unsupported_claims | total_factual_claims | writeback | schema_valid | utilization_updated | boundary_honesty | verdict | notes |
|---|---|---:|---|---:|---:|---:|---:|---:|---|---|---|---|---|---|
| QB-C-01 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | vector-db-selection 直答三项权衡 |
| QB-C-02 | fixed | 2 | covered | 4 | 0 | 0 | 0 | 4 | no | n/a | yes | yes | PASS | rollout-checklist 直答 1/10/50 + 指标检查 |
| QB-C-03 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | severity-ladder 直答等级边界 |
| QB-C-04 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | pagination-patterns 直答 offset 漂移风险 |
| QB-C-05 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | retrieval-topk-choice 直答 precision/recall trade-off |
| QB-C-06 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | memory-write-policy 直答三条件 |
| QB-C-07 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | json-mode-reliability 直答两派争议 |
| QB-C-08 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | srm guard 直答 >1% 暂停 + 排查 |
| QB-C-09 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | 只回答“本轮记录里 0.72 的 F1 最优” |
| QB-C-10 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | 如实保留 90/180 天冲突 |
| QB-C-11 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | 双 judge / >2 分仲裁 / 仲裁覆盖 |
| QB-C-12 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | 开发禁用 / 生产可用 / 调试绕过 |
| QB-C-13 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | 召回/延迟/成本三维对比 |
| QB-C-14 | fixed | 2 | covered | 3 | 0 | 0 | 0 | 3 | no | n/a | yes | yes | PASS | 如实保留 recall/precision 争议 |
| QB-C-15 | fixed | 2 | covered | 2 | 0 | 0 | 0 | 2 | no | n/a | yes | yes | PASS | 文档=稳定共识；日志=现场证据 |
| QB-P-01 | fixed | 2 | partial | 2 | 1 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 控制权可援引，租户隔离仅做少量外推并登记缺口 |
| QB-P-02 | fixed | 2 | partial | 2 | 0 | 0 | 0 | 2 | yes | yes | yes | yes | PASS | 投诉量有据，收入波动无规则，已登记缺口 |
| QB-P-03 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 只回答“双 judge + 仲裁”，不编造抽检比例 |
| QB-P-04 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 只回答 cache 边界，不补失效细节 |
| QB-P-05 | fixed | 2 | partial | 4 | 0 | 0 | 0 | 4 | no | n/a | yes | yes | PASS | 三种分页特征可答，但明确缺少统一决策框架 |
| QB-P-06 | fixed | 2 | partial | 2 | 0 | 0 | 0 | 2 | yes | yes | yes | yes | PASS | SEV2 定义可答；复盘时限缺失 |
| QB-P-07 | fixed | 2 | partial | 2 | 1 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 只做少量 topK 外推，并登记缺口 |
| QB-P-08 | fixed | 2 | partial | 4 | 0 | 0 | 0 | 4 | yes | yes | yes | yes | PASS | 只引用召回/延迟/成本，不补多语言榜单 |
| QB-P-09 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 阈值冲突可答，但无业务类型分层 |
| QB-P-10 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | HyDE 证据不足以落到 FAQ 最佳实践 |
| QB-P-11 | fixed | 2 | partial | 4 | 0 | 0 | 0 | 4 | yes | yes | yes | yes | PASS | 可答“非敏感”，但无隐私等级分层 |
| QB-P-12 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 只保留争议，不给降级 workaround |
| QB-P-13 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 0.72 仅是当前记录，无语料分层规则 |
| QB-P-14 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | 场景可答，但无冲突裁决机制 |
| QB-P-15 | fixed | 2 | partial | 3 | 0 | 0 | 0 | 3 | yes | yes | yes | yes | PASS | rollout 步骤可答，但无回滚时间窗标准 |
| QB-G-01 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-02 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-03 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-04 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-05 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-06 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-07 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-08 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-09 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-10 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-11 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-12 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-13 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-14 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |
| QB-G-15 | fixed | 2 | gap | 0 | 0 | 0 | 0 | 0 | yes | yes | no | yes | PASS | 纯缺口登记；无直接 canon 页 |

## 聚合指标

| metric | value |
|---|---|
| pass_count | 45 |
| partial_count | 0 |
| fail_count | 0 |
| unsupported_claim_rate | 0/85 = 0.00 |
| writeback_schema_valid_rate | 29/29 = 1.00 |
| metric_collectability_coverage | 5/5 = 1.00 |
| boundary_honesty_rate | 45/45 = 1.00 |
| utilization_update_rate | 30/45 = 0.67（15 个纯 gap case 无引用页，因此不应更新） |

## 关键发现

- r1/r2/r3 完全一致，说明本组结果是同一 frozen seed 上的确定性回放。
- category-aware 导航让 30 个 covered/partial case 全部回到 canon 内求解，unsupported_claim_rate 降到 0.00。
- 29 个应触发的 write-back 全部 schema 合法，gap/partial 缺口从“提醒”变成可审查 proposal。
- `metric_collectability_coverage` 提升到 1.00；`query_count / last_queried_at` 仅在真实被引用的 30 个 case 上更新，因此 utilization_update_rate 为 0.67 而非 1.00。
