---
type: experiment-result
name: p0-pilot-fixed
version: 1.0
group: fixed
ruleset_ref: working-tree-after-p0
benchmark_version: 1.0
created_at: 2026-04-09
---

# P0 Pilot Result — Fixed

> 说明：本结果是 **P0 结构性 pilot**，目标是验证“可测性 / 路由 / 治理闭环”是否改善。  
> 它不是完整的 90 case 运行验证，也**不**直接证明最终用户回答质量已经全面达标。

## 试验切片

与 baseline 使用完全相同的 8 个 probe / case：

- GB-S-02
- GB-S-03
- GB-Q-01
- GB-P-01
- GB-P-02
- GB-R-01
- RB-STRUCT-01
- RB-STRUCT-02

## case 级结果

| Case | 预期 | fixed 观察 | 结果 |
|---|---|---|---|
| GB-S-02 | `origin=query-writeback` 超 14 天应告警 | lint 已定义 `origin=query-writeback` 的 14 天阈值和 `[WRITEBACK-OVERDUE]` | PASS |
| GB-S-03 | review 目录超期提案应告警 | lint 已扫描 `changes/inbox/` + `changes/review/` | PASS |
| GB-Q-01 | 无真实 `sources/...` 的 query-writeback 不得进入 approved→compile | promote Gate 1.2 已拦截；compile 也有双重 skip guard | PASS |
| GB-P-01 | patrol 提案需 schema 合法且可路由到 maintain | schema 已支持 `origin=lint-patrol` / `system:lint-patrol`；maintain 成为正式下游 | PASS |
| GB-P-02 | 7 天内已有同类 patrol 时应 skip | lint Step 5.5 已定义去重 + TTL + `[PATROL-SKIP]` | PASS |
| GB-R-01 | 连续 10 次 approve 时 promote / lint 应一致预警 | promote 与 lint 都已统一到 `consecutive_approve_count >= 10` | PASS |
| RB-STRUCT-01 | query 应定义 `last_queried_at` / `query_count` 更新时机 | query Step 3 已定义利用追踪写回规则 | PASS |
| RB-STRUCT-02 | query 应定义 `canon外推断占比` 的公式 | query Step 4 已定义分子 / 分母与除零规则 | PASS |

## pilot 指标汇总

| 指标 | 公式 | fixed |
|---|---|---|
| stale_proposal_detection_recall | 通过的 stale proposal case / 2 | 2 / 2 = 1.00 |
| governance_route_correctness | 通过的 system proposal route case / 2 | 2 / 2 = 1.00 |
| patrol_dedup_stability | 通过的 patrol 去重 case / 1 | 1 / 1 = 1.00 |
| review_anomaly_consistency | 跨 spec 审查预警一致 case / 1 | 1 / 1 = 1.00 |
| metric_collectability_coverage | 已定义采集逻辑的结构探针 / 2 | 2 / 2 = 1.00 |

## fixed 结论

fixed 组已经把本轮最关键的 P0 缺口补成了**可验证状态**：

1. **system proposal 有正式路由**
2. **stale proposal 与 query-writeback 有统一检测逻辑**
3. **query 相关运行指标已具备采集条件**
4. **patrol 不再天然有重复生成风险**

这说明系统已经从“规则看起来合理”推进到了“至少可以开始做运行验证”。

