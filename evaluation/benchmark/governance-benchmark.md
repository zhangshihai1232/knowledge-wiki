---
type: benchmark
name: governance-benchmark
version: 1.0
created_at: 2026-04-09
case_count: 15
---

# Governance Benchmark

用于评估 lint / promote / patrol / maintain 对治理异常的发现与处理能力。

| ID | 类别 | 冻结场景 | 预期检测 / 路由 | 主指标 |
|---|---|---|---|---|
| GB-S-01 | stale proposal | `changes/inbox/` 有普通 proposal 已 9 天未处理 | 触发 L008 | stale_proposal_detection_recall |
| GB-S-02 | stale proposal | `origin=query-writeback` proposal 已 16 天未处理 | 触发 L008 + `[WRITEBACK-OVERDUE]` | stale_proposal_detection_recall |
| GB-S-03 | stale proposal | `changes/review/` 中提案 8 天未处理 | 触发 L008 | stale_proposal_detection_recall |
| GB-R-01 | review anomaly | 最近连续 approve 10 次，无 reject | 触发 Gate 1.5 与 L011 | review_anomaly_precision |
| GB-R-02 | review anomaly | 最近连续 approve 6 次，随后 1 次 reject | 不触发 L011 | review_anomaly_precision |
| GB-R-03 | review anomaly | approve_note 全部短句、模板化 | promote 应拦截或至少提示 | review_anomaly_precision |
| GB-Q-01 | query writeback | `origin=query-writeback`，`trigger_source=system:query-writeback`，试图 approve | Gate 1.2 拦截，不得进入 compile | writeback_schema_valid_rate |
| GB-Q-02 | query writeback | 已补齐真实 `sources/...` 依据的 query-writeback proposal | 可进入 approved → compile | writeback_conversion_readiness |
| GB-Q-03 | query writeback | write-back proposal 缺 `origin` 字段 | schema 不合法 | writeback_schema_valid_rate |
| GB-P-01 | patrol | low-confidence 页面占比 65%，inbox 中无同类维护提案 | 生成 1 个 lint-patrol proposal | patrol_dedup_stability |
| GB-P-02 | patrol | 7 天内已有同类 lint-patrol proposal 未消费 | 触发 `[PATROL-SKIP]`，不得重复生成 | patrol_dedup_stability |
| GB-P-03 | patrol | TTL 已过但问题仍在 | 可重新生成新的维护提案 | patrol_dedup_stability |
| GB-C-01 | conflict | canon 页正文含 `<<<CONFLICT>>>` 仍未 reconcile | 触发 L006 | conflict_detection_recall |
| GB-C-02 | source missing | canon 页 `sources=[]` | 触发 L003 ERROR | source_traceability |
| GB-D-01 | domain overflow | 某领域 active 页面数 52 | 触发 L007，并允许 patrol/maintain 路由 | maintain_trigger_precision |

## 治理 Gold 规则

1. 检测类 case 要有**明确 rule ID**  
2. route 类 case 要有**明确下游 spec**  
3. patrol 类 case 要验证**不重复生成**  

