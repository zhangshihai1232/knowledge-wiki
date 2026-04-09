---
type: protocol
name: longitudinal-stability
version: 1.0
created_at: 2026-04-09
---

# Longitudinal Stability Protocol

## 1. 目标

证明系统不是“一次性跑通 benchmark”，而是在连续运行中仍能保持：

1. query 回答边界诚实
2. write-back 闭环可持续
3. governance 指标不回退

## 2. 观察方式

默认优先采用 **shadow-run**：

- 不直接改生产结果
- 但每天用真实新增 query / ingest / proposal 事件驱动 fixed 规则跑一遍
- 记录治理与查询指标

若系统后续进入真实运行，也可切换为 **live observation**，但不作为 MVP 前提。

## 3. 观察窗口

### MVP

- **14 天** pilot

### Full

- **28 天** 连续观察

## 4. 观测对象

| 对象 | 内容 |
|---|---|
| query | 当日真实 query 样本、来源标注、write-back 触发 |
| changes | 新增 proposal、待审 proposal、超期 proposal |
| maintain | patrol 生成、去重、消费情况 |
| state/log | query_count、last_queried_at、pending_proposals 等状态变化 |

## 5. 主指标

| 指标 | 公式 | 目标方向 |
|---|---|---|
| stale_proposal_backlog_rate | `超 SLA 未处理 proposal / 全部 open proposal` | 越低越好 |
| median_writeback_review_latency | write-back proposal 从创建到审查的中位时长 | 越低越好 |
| patrol_duplicate_rate | `重复 patrol / 全部 patrol` | 越低越好 |
| writeback_conversion_rate | `最终被消费的 query-writeback / 全部 query-writeback` | 越高越好 |
| query_utilization_growth | active canon 页中被 query 命中的比例变化 | 越高越好 |

## 6. 次指标

| 指标 | 说明 |
|---|---|
| weekly_unsupported_claim_rate | 每周 sampled query 的无依据断言占比 |
| review_anomaly_alert_rate | 连续 approve 预警出现频率 |
| conflict_backlog_age | 未解决 conflict 的年龄分布 |

## 7. 成功阈值

若 fixed 在 28 天观察窗口内满足以下条件，可判定“具有持续稳定性证据”：

1. `stale_proposal_backlog_rate <= 0.10`
2. `median_writeback_review_latency <= 7 天`
3. `patrol_duplicate_rate = 0`
4. `writeback_conversion_rate >= 0.60`
5. `query_utilization_growth >= 0`
6. 任一核心指标不存在 **连续两周 >10% 的回退**

## 8. 执行步骤

1. 冻结观察窗口与采样规则
2. 每日收集新增 query / ingest / proposal 事件
3. 用 fixed 规则跑 shadow-run
4. 按日写入指标日志
5. 按周做一次汇总
6. 在 Day 14 / Day 28 输出阶段报告

## 9. 触发预警的情况

出现以下任一情形，必须触发回顾：

1. stale backlog 连续 3 天上升
2. patrol duplicate 首次出现
3. writeback review latency 超过 14 天
4. sampled query 的 unsupported_claim_rate 明显高于 frozen benchmark 基线

## 10. 输出产物

1. daily metrics log
2. weekly summary
3. day-14 pilot report
4. day-28 final report
5. 异常回顾记录

## 11. 排除项

本协议不直接证明：

1. 用户商业转化提升
2. ROI
3. 线上所有 domain 都无回归

它证明的是：**在持续运行下，固定后的规则集没有明显退化，并能维持治理闭环。**

