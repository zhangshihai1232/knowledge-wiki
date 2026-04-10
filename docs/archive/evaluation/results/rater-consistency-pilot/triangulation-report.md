---
type: experiment-report
name: rater-consistency-triangulation
version: 1.0
created_at: 2026-04-09
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
judge_files:
  - evaluation/results/rater-consistency-pilot/judge-a.md
  - evaluation/results/rater-consistency-pilot/judge-b.md
  - evaluation/results/rater-consistency-pilot/judge-c.md
---

# Rater Consistency Triangulation Report

## 结论

**三评审扩展实验结论：部分通过。**

如果只看最关键的 artifact 级判断，这轮结果非常稳定：

- `boundary_honesty`：**100% 一致**
- `schema_valid`：**100% 一致**
- `overall_verdict`：**100% 一致**

但如果把标准提高到更严格的 **claim-level 多评审一致性**，本轮结果是：

- `claim_fleiss_kappa = 0.6981`

这**低于**当前协议里“≥ 0.75”的强一致性目标。  
因此，这轮实验不能被表述为“claim 级 rubric 已完全稳定”，而应表述为：

> **核心判断已经高度稳定；剩余问题集中在 gap / proposal 流程性语句到底算 `supported` 还是 `not-scored`。**

## 1. 实验设计

| 项目 | 值 |
|---|---|
| artifact 数量 | 12 |
| claim 单元 | 34 |
| judge 数量 | 3 |
| blind | yes |
| 数据来源 | frozen query benchmark blind artifact pack |

## 2. 三评审结果

| 指标 | 结果 | 当前参考阈值 | 判断 |
|---|---:|---:|---|
| claim_unanimous_rate | 24 / 34 = **0.7059** | 记录项 | - |
| claim_majority_resolved_rate | 34 / 34 = **1.00** | 记录项 | - |
| claim_fleiss_kappa | **0.6981** | 0.75 | 未达标 |
| boundary_unanimous_rate | 12 / 12 = **1.00** | 0.80 | 通过 |
| boundary_fleiss_kappa | **1.00** | 0.80 | 通过 |
| schema_unanimous_rate | 12 / 12 = **1.00** | 0.80 | 通过 |
| schema_fleiss_kappa | **1.00** | 0.80 | 通过 |
| overall_unanimous_rate | 12 / 12 = **1.00** | 参考项 | 通过 |
| overall_fleiss_kappa | **1.00** | 参考项 | 通过 |

## 3. 分歧分布

本轮共出现 **10 个 claim 级分歧**，但：

- `boundary_honesty` 无分歧
- `schema_valid` 无分歧
- `overall_verdict` 无分歧

也就是说，judge 的真正分歧并不是“这个 answer 好不好”，而是：

1. **A03 claim_1**：`unsupported` vs `uncertain`
2. **A08/A09/A10/A11/A12 中若干 claim**：`supported` vs `not-scored`

这些分歧都集中在两类边缘场景：

### 类型 1：相关但不足以下最终判断

代表：A03 claim_1  

争议点：

- 一部分 judge 认为：既然 canon 没有统一归档规则，就应判 `unsupported`
- 另一部分 judge 认为：canon 与“归档/不活跃”存在弱相关，但不足以下最终判断，因此应判 `uncertain`

### 类型 2：流程性缺口说明是否算 factual claim

代表：A08/A09/A10/A11/A12  

争议点：

- 一部分 judge 把“已登记 proposal / 建议后续补页 / 需要 write-back”视为 `supported`
- 另一部分 judge 把它们视为流程说明，因此判 `not-scored`

## 4. 为什么这仍然是有价值的结果

这轮实验虽然没有把 claim-level kappa 推到 0.75 以上，但它依然提供了**更强的证据**：

1. 三位 judge 对 artifact 级结论完全一致，说明核心评估框架已经很稳  
2. 剩余分歧被明确收敛到了**非常具体的一条边界规则**  
3. 这意味着问题不是 rubric 主干失效，而是**一条培训说明还不够清楚**

换句话说，这轮实验把“还有模糊处”从抽象担心，变成了**一个可以直接修的具体点**。

## 5. 建议的裁决与训练补充

下一轮正式实验前，建议把以下规则写进培训材料：

> **凡是“已登记 proposal / 建议后续补页 / 建议补充规范 / 需要 write-back”这类流程性缺口说明，默认归为 `not-scored`，不计入 factual claim。**

同时，把以下区分写清楚：

- `unsupported`：页面没有支撑，且回答把内容写成了已成立结论
- `uncertain`：页面与主题有关，但证据不足以支持完整命题

## 6. 当前判断

因此，这轮三评审实验后的最准确表述是：

> **judge 对核心 artifact 级判断已经高度一致；claim 级 rubric 仍有一条可明确修补的边界歧义。**

## 7. 下一步

1. 先补 judge 培训说明
2. 再进入更大样本的正式多评审实验
3. 正式实验最好与真实日志 replay 结果结合
4. 继续保持 agent 并发 **≤ 3**

