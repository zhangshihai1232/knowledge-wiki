---
type: protocol
name: real-log-replay
version: 1.0
created_at: 2026-04-09
---

# Real Log Replay Protocol

## 1. 目标

证明修复后的系统在**真实用户 query** 上也优于 baseline，而不是只在合成 benchmark 上表现更好。

## 2. 适用对象

本协议默认针对 **query 场景**。  
如后续需要，也可扩展到 ingest / source 回放，但第一阶段不要求。

## 3. 样本设计

### 3.1 抽样范围

- 时间窗口：最近 **30 天**
- 数据来源：真实用户 query 日志
- 去重规则：同义重复问题按归一化问题文本去重
- 脱敏要求：去除用户身份、业务敏感字段、内部链接、票据编号

### 3.2 MVP 样本量

最小样本量：**120 条 query**

建议分层：

| 分层 | 目标数量 |
|---|---:|
| 事实 / 概念解释类 | 30 |
| 对比 / 选择类 | 30 |
| 操作 / 指南类 | 30 |
| 高新颖度 / 高缺口 / 模糊问题 | 30 |

附加约束：

1. 任一单领域样本不得超过 **50%**
2. 任一单用户来源样本不得超过 **10%**

## 4. 对照设计

| 组别 | 定义 |
|---|---|
| baseline | `9bb0a43` 规则版本 |
| fixed | 当前 working tree |

控制条件：

1. 两组使用**同一份**脱敏日志样本
2. 两组使用**同一份** canon snapshot
3. 两组使用**同一份** judging rubric
4. 输出在进入 judge 前必须做组别脱敏（如 `Output A` / `Output B`）

## 5. 执行步骤

1. 冻结 query 日志样本
2. 冻结 canon snapshot
3. 用 baseline 回放 120 条 query
4. 用 fixed 回放同样 120 条 query
5. 为每条输出生成 claim annotation sheet
6. 由 2 位 judge 独立盲评
7. 对分歧 case 进入仲裁
8. 汇总最终指标

## 6. 主指标

| 指标 | 公式 | 目标方向 |
|---|---|---|
| unsupported_claim_rate | `unsupported claims / all factual claims` | 越低越好 |
| boundary_honesty_rate | `边界诚实 case / 全部 case` | 越高越好 |
| writeback_schema_valid_rate | `合法 write-back / 全部 write-back` | 越高越好 |
| false_gap_rate | `被误判为 gap 的 covered/partial case / covered+partial case` | 越低越好 |

## 7. 次指标

| 指标 | 说明 |
|---|---|
| judged_usefulness_win_rate | fixed 在盲评中被认为“更有用”的比例 |
| utilization_update_rate | 命中 canon 的 case 中，query_count / last_queried_at 被正确更新的比例 |
| citation_coverage_rate | factual claims 中带正确来源标注的比例 |

## 8. 成功阈值

若 fixed 满足以下条件，可判定“真实场景有效性得到增强证据”：

1. `unsupported_claim_rate` 相对 baseline 下降 **≥ 30%**
2. `boundary_honesty_rate` **≥ 0.85**
3. `writeback_schema_valid_rate` **≥ 0.95**
4. `false_gap_rate` **≤ 0.10**

若 `judged_usefulness_win_rate ≥ 0.60`，则可作为附加正向证据，但不是 MVP 必要条件。

## 9. 排除项

以下样本不纳入本协议：

1. 代码执行 / 命令执行请求
2. 非知识性寒暄
3. 明显越权或敏感信息请求
4. 无法完成脱敏的日志

## 10. 输出产物

1. 脱敏样本清单
2. baseline / fixed 回放结果
3. judge 标注表
4. 仲裁记录
5. 对照报告

## 11. 风险与控制

| 风险 | 控制方式 |
|---|---|
| 样本被挑得过于有利 | 先冻结抽样规则，再抽样 |
| judge 被组别信息影响 | 输出匿名化后再评审 |
| 回放期间规则漂移 | run 期间禁止改规则 |
| agent 过并发被 kill | 执行时子 agent 并发 **≤ 3** |

