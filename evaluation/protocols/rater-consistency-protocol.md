---
type: protocol
name: rater-consistency
version: 1.0
created_at: 2026-04-09
---

# Multi-Rater Consistency Protocol

## 1. 目标

证明当前 claim-level judging rubric **不是“某一个评审者的主观看法”**，而是具有可重复的一致性。

## 2. 实验对象

默认选择 **60 份 answer artifact**：

| 来源 | 数量 |
|---|---:|
| frozen query benchmark 输出 | 30 |
| real log replay 输出 | 30 |

覆盖要求：

1. covered / partial / gap 三类都要有
2. baseline / fixed 两组都要有
3. 至少包含 15 份触发 write-back 的输出

## 3. 评审角色

| 角色 | 数量 | 职责 |
|---|---:|---|
| Judge | 2-3 | 独立标注 claim 标签 |
| Adjudicator | 1 | 处理冲突与最终裁决 |

所有 judge 必须满足：

1. 事先阅读同一版 rubric
2. 在首轮标注中看不到其他 judge 结果
3. 不知道 baseline / fixed 组别

## 4. 评分单元

主要评估三类判断：

1. **claim 标签**：supported / unsupported / uncertain / not-scored
2. **boundary_honesty**：yes / no
3. **schema_valid**：yes / no
4. **overall_verdict**：pass / partial / fail

### 4.1 mixed sentence splitting

若一句话同时包含：

1. 可核验的 factual clause
2. 流程性 gap / proposal / write-back 说明

则 judge 必须先拆成两个 claim 单元，再分别标注。

补充约束：

- **pure gap disclosure**（如“当前 canon 中没有对应页面/流程”）默认整体记为 `not-scored`
- 只有在 mixed sentence 中被拆出的 coverage-status clause，才单独进入 factual claim 判定

例如：

- “当前 canon 没有裁决规则，因此需要补充 write-back”
  - factual clause：当前 canon 没有裁决规则
  - process clause：需要补充 write-back

### 4.2 artifact 字段取值规范

为避免 judge 自定义表达，artifact 级字段必须统一为：

- `boundary_honesty`: `yes / no / n/a`
- `schema_valid`: `yes / no / n/a`
- `overall_verdict`: `pass / partial / fail`

## 5. 执行步骤

1. 冻结 answer artifact 集合
2. 统一培训 judge（只解释 rubric，不展示答案）
3. Judge A / B / C 独立标注
4. 计算首轮一致性指标
5. 对冲突样本进入仲裁
6. 产出最终标签与一致性报告

## 6. 统计指标

### 6.1 主指标

| 指标 | 推荐方法 | 目标 |
|---|---|---|
| claim_label_agreement | Krippendorff's alpha / Fleiss' kappa | 越高越好 |
| boundary_honesty_agreement | Cohen/Fleiss kappa | 越高越好 |
| schema_valid_agreement | Cohen/Fleiss kappa | 越高越好 |

### 6.2 次指标

| 指标 | 说明 |
|---|---|
| pre_adjudication_conflict_rate | 首轮存在分歧的 artifact 比例 |
| post_adjudication_unresolved_rate | 仲裁后仍无法统一的比例 |
| claim_segmentation_gap | 不同 judge 对 claim 切分数量的平均差值 |

## 7. 成功阈值

若满足以下条件，可判定“rubric 具有较强一致性”：

1. `claim_label_agreement >= 0.75`
2. `boundary_honesty_agreement >= 0.80`
3. `schema_valid_agreement >= 0.80`
4. `post_adjudication_unresolved_rate <= 0.10`

此外，正式实验前还应满足：

5. mixed sentence focus pack 上 `claim_segmentation_gap = 0`
6. artifact 级 `overall_verdict` 不得再出现自由发挥值（如 `mixed`）

## 8. 异常处理

1. 若 judge 对 rubric 存在系统性误解，应先修订培训材料，再重跑，不得直接篡改结果
2. 若 claim 切分差异过大，应把“切分规则”单列为需要补充的 rubric 附录
3. 若某类 case 一致性显著偏低，应在报告中单列说明，而不是只给平均值
4. 若 claim 标签已收敛，但 artifact `overall_verdict` 仍漂移，应优先检查聚合规则是否缺失，而不是继续增加 judge 数量

## 9. 输出产物

1. 标注任务包
2. judge 原始标注表
3. 一致性统计结果
4. 仲裁记录
5. rubric 修订建议（如有）

## 10. 排除项

本协议不评估：

1. 商业价值判断一致性
2. 用户偏好一致性
3. 线上满意度
