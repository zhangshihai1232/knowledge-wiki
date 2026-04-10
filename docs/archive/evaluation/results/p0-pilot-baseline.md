---
type: experiment-result
name: p0-pilot-baseline
version: 1.0
group: baseline
ruleset_ref: 9bb0a43
benchmark_version: 1.0
created_at: 2026-04-09
---

# P0 Pilot Result — Baseline

> 说明：本结果是 **P0 结构性 pilot**，目标是验证“可测性 / 路由 / 治理闭环”是否改善。  
> 它不是完整的 90 case 运行验证，也**不**代表最终端到端有效性结论。

## 试验切片

使用 benchmark 中最能反映本轮修复价值的 8 个 probe / case：

- GB-S-02：query-writeback 超期提案
- GB-S-03：review 目录超期提案
- GB-Q-01：缺真实来源的 query-writeback 审批
- GB-P-01：patrol 生成治理提案的 schema / route
- GB-P-02：7 天内同类 patrol 去重
- GB-R-01：连续 approve 预警的一致性
- RB-STRUCT-01：`last_queried_at` / `query_count` 可采性
- RB-STRUCT-02：`canon外推断占比` 可采性

## case 级结果

| Case | 预期 | baseline 观察 | 结果 |
|---|---|---|---|
| GB-S-02 | `origin=query-writeback` 超 14 天应告警 | baseline 仅定义 inbox + pending + 7 天；无 query-writeback 特判 | FAIL |
| GB-S-03 | review 目录超期提案应告警 | baseline 只扫描 `changes/inbox/` | FAIL |
| GB-Q-01 | 无真实 `sources/...` 的 query-writeback 不得进入 approved→compile | baseline 无 `origin` 字段、无 Gate 1.2 | FAIL |
| GB-P-01 | patrol 提案需 schema 合法且可路由到 maintain | baseline 使用 `lint-auto-patrol`，无 `origin`，无 maintain 正式路由 | FAIL |
| GB-P-02 | 7 天内已有同类 patrol 时应 skip | baseline 无去重 / TTL 规则 | FAIL |
| GB-R-01 | 连续 10 次 approve 时 promote / lint 应一致预警 | baseline promote 用“最近10次100%”，lint 用“最近20次≥90%”，口径不一致 | FAIL |
| RB-STRUCT-01 | query 应定义 `last_queried_at` / `query_count` 更新时机 | baseline schema 有字段，但 query spec 无更新步骤 | FAIL |
| RB-STRUCT-02 | query 应定义 `canon外推断占比` 的公式 | baseline 只引用“>25%”条件，未定义分子 / 分母 | FAIL |

## pilot 指标汇总

| 指标 | 公式 | baseline |
|---|---|---|
| stale_proposal_detection_recall | 通过的 stale proposal case / 2 | 0 / 2 = 0.00 |
| governance_route_correctness | 通过的 system proposal route case / 2 | 0 / 2 = 0.00 |
| patrol_dedup_stability | 通过的 patrol 去重 case / 1 | 0 / 1 = 0.00 |
| review_anomaly_consistency | 跨 spec 审查预警一致 case / 1 | 0 / 1 = 0.00 |
| metric_collectability_coverage | 已定义采集逻辑的结构探针 / 2 | 0 / 2 = 0.00 |

## baseline 结论

baseline 的主要问题不是“完全没有治理规则”，而是：

1. **规则口径不一致**：promote 与 lint 对连续 approve 的定义不同  
2. **system proposal 无正式路由**：query-writeback / patrol proposal 无法稳定落到 compile / maintain  
3. **指标不可采**：query 相关运行指标只有字段，没有更新逻辑或计算公式  

因此，baseline 适合作为“修复前对照组”，但不适合作为正式运行验证的终版规则集。

