---
type: experiment-analysis
name: p0-pilot-comparison
version: 1.0
created_at: 2026-04-09
---

# P0 Pilot Comparison

## 对照范围

- baseline：`9bb0a43`
- fixed：当前 working tree（P0 + P1 benchmark + protocol）
- benchmark：`evaluation/benchmark/` v1.0
- 切片：8 个 P0 高信号 case / probe

## 对照结果

| 指标 | baseline | fixed | 变化 |
|---|---|---|---|
| stale_proposal_detection_recall | 0.00 | 1.00 | +1.00 |
| governance_route_correctness | 0.00 | 1.00 | +1.00 |
| patrol_dedup_stability | 0.00 | 1.00 | +1.00 |
| review_anomaly_consistency | 0.00 | 1.00 | +1.00 |
| metric_collectability_coverage | 0.00 | 1.00 | +1.00 |

## 解释

本轮 pilot 的改善，主要来自 4 类修复：

1. **schema 可表达**：`origin`、system `trigger_source`、下游消费语义补齐  
2. **spec 可执行**：query 指标更新步骤、外推断占比公式补齐  
3. **路由可闭环**：`query-writeback` 和 `lint-patrol` 不再进入错误下游  
4. **治理可稳定**：patrol 去重、TTL、审查异常口径统一  

## 结论

### 能证明什么

本次 P0 pilot **可以证明**：

- 系统的“可测性”显著提升
- 治理闭环的路由正确性显著提升
- 已经具备运行验证所需的基础数据采集条件

### 还不能证明什么

本次 P0 pilot **还不能证明**：

- query 最终回答的 `unsupported_claim_rate` 是否显著下降
- source / conflict / uncertainty 的端到端处理质量是否显著提升
- 修复后系统在完整 90 case benchmark 上是否达到最终成功阈值

## 下一步

直接进入 full benchmark 运行：

1. 用 frozen benchmark 跑一轮 baseline
2. 用同一 benchmark 跑一轮 fixed
3. 补齐端到端主指标：
   - `unsupported_claim_rate`
   - `conflict_detection_recall`
   - `writeback_schema_valid_rate`
   - `review_anomaly_precision`
4. 再输出最终“有效 / 部分有效 / 证据不足”结论

