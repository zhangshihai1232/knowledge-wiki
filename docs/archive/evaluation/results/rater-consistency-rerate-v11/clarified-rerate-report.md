---
type: experiment-report
name: clarified-rerate-v1.1
version: 1.0
created_at: 2026-04-09
artifact_pack: evaluation/results/rater-consistency-pilot/artifact-pack.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.1.md
judge_files:
  - evaluation/results/rater-consistency-rerate-v11/judge-a.md
  - evaluation/results/rater-consistency-rerate-v11/judge-b.md
  - evaluation/results/rater-consistency-rerate-v11/judge-c.md
  - evaluation/results/rater-consistency-rerate-v11/judge-d.md
  - evaluation/results/rater-consistency-rerate-v11/judge-e.md
---

# Clarified Re-rate Report (Rubric v1.1)

## 结论

**v1.1 成功消除了原来的主标签歧义，但没有把整套多评审协议完全稳定下来。**

它解决了两件原来最关键的问题：

1. 纯流程性缺口说明被稳定收敛到 `not-scored`
2. 原先 `unsupported` vs `uncertain` 的争议 case 已收敛到 `unsupported`

但它又暴露出两个新的协议层问题：

1. **mixed sentence claim 切分规则还不够明确**
2. **artifact 总裁决如何处理“gap case + schema_invalid”还没有统一**

所以，v1.1 的最准确评价不是“完全通过”，而是：

> **它成功修复了原来的 claim 标签边界歧义，但把剩余不一致收缩成了两个更上层、也更容易补齐的规则缺口。**

## 1. 实验对象

| 项目 | 值 |
|---|---:|
| artifact 数量 | 12 |
| judge 数量 | 5 |
| rubric 版本 | v1.1 |
| judge 文件 | A / B / C / D / E |

## 2. v1.1 已明确修复的部分

### 2.1 纯流程性缺口说明

对 A09-A12 的纯流程性 / 缺口说明句，共 **10 个 claim 单元**：

- `pure_procedural_not_scored_unanimity = 10 / 10 = 1.0000`

也就是说，五位 judge 对这些句子的判断已经完全一致：

> **全部都是 `not-scored`**

这说明“已登记 proposal / 建议后续补页 / 当前无对应页面 / 不提供未经验证公式”这一类句子的标签边界已经被澄清成功。

### 2.2 `unsupported` vs `uncertain`

对原来最有代表性的 A03 三条 claim：

- `A03_unsupported_unanimity = 3 / 3 = 1.0000`

五位 judge 全部判为 `unsupported`。

这意味着：

> **当 canon 只有争议或局部相关信息，而回答把它写成统一规则、常见阈值或默认结论时，judge 已稳定地不再把它判成 `uncertain`。**

## 3. 新暴露出的协议缺口

### 3.1 mixed sentence 的 claim 切分

受影响 artifact：

- A06
- A08

指标：

- `segmentation_affected_artifacts = 2 / 12 = 0.1667`

现象：

1. Judge A/C/D/E 都把 mixed sentence 作为 **1 条 claim**
2. Judge B 把它拆成“事实部分 + 流程说明部分”两条 claim

具体地说：

- A06：`3 / 4 / 3 / 3 / 3`
- A08：`4 / 5 / 4 / 4 / 4`

这说明 v1.1 虽然明确了 `not-scored` 的含义，但还没有写清楚：

> **如果同一句话同时包含“可核验的事实部分”和“流程性缺口说明”，judge 是应该整句打一个标签，还是先拆成两个 claim 再分别打标签。**

### 3.2 artifact 总裁决规则

受影响 artifact：

- A09
- A11

指标：

- `artifact_overall_unanimity = 10 / 12 = 0.8333`

这两个 case 的 claim 标签已经完全收敛：

- claim 全部 `not-scored`
- `boundary_honesty` 基本都认为通过
- `schema_valid` 多数票为 `no`（`4/5` judge）

但 `overall_verdict` 却出现了五种写法混杂：

| artifact | 五位 judge 的 overall_verdict |
|---|---|
| A09 | `pass / mixed / pass / partial / fail` |
| A11 | `pass / mixed / pass / partial / fail` |

这说明当前没有统一回答：

> **对于“gap case 本身很诚实，但 write-back schema 不合法”的情况，artifact 应该判 `pass`、`partial` 还是 `fail`？**

## 4. 当前最准确判断

把 v1.1 的效果拆开看，结论其实很清楚：

1. **原始的标签边界问题已经被修掉了**
2. 剩余不一致不再集中在 `supported/not-scored/uncertain` 这些 claim 标签上
3. 剩余不一致已经上移到：
   - claim 切分规则
   - artifact 聚合规则

所以，这轮实验是**有效推进**，不是失败：

> **它把问题从“judge 对 claim 标签本身理解不一致”，推进成了“协议上还差两条更高层的机械规则”。**

## 5. 下一步最合理的补丁方向

### 5.1 增加 claim splitting appendix

明确规定：

- 如果一句话同时包含可核验的 factual clause 和流程性说明，**先拆成两个 claim**
- factual clause 单独评分
- proposal / write-back / gap 说明部分单独记为 `not-scored`

### 5.2 增加 deterministic artifact verdict rule

明确规定：

- `gap + boundary_honesty = yes + schema_valid = no` 应统一判为什么
- covered / partial / gap 三类 case 的 `overall_verdict` 聚合顺序与优先级

## 6. 最终结论

因此，v1.1 这轮澄清实验后的最终表述应为：

> **claim 标签边界已经基本收敛；下一轮不该继续争论 `not-scored` 本身，而应补“mixed sentence 切分规则”和“artifact 总裁决规则”。**
