---
type: experiment-report
name: focus-rerate-v1.2
version: 1.0
created_at: 2026-04-09
artifact_pack: evaluation/results/rater-consistency-rerate-v12/focus-pack.md
rubric: evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md
judge_files:
  - evaluation/results/rater-consistency-rerate-v12/judge-f.md
  - evaluation/results/rater-consistency-rerate-v12/judge-g.md
  - evaluation/results/rater-consistency-rerate-v12/judge-h.md
---

# Focus Re-rate Report (Rubric v1.2)

## 结论

**v1.2 已经把 v1.1 暴露出的两条主歧义基本收住了。**

这轮 focus 实验只重测 4 个最容易出分歧的 artifact：A06 / A08 / A09 / A11。结果表明：

1. mixed sentence 的 claim 切分已经稳定
2. `gap + schema_invalid` 的 artifact 总裁决已经稳定

因此，v1.2 的主目标是**通过**的。

不过，它还留下了一个更小的文本级矛盾：

> **纯 coverage-status 句子（如“当前 canon 中没有对应页面”）到底算 `supported` 还是 `not-scored`，v1.2 文本里仍有一处自相矛盾。**

这个问题已经不再影响本轮 focus pack 的 artifact 级结果，但还需要在下一版文案里清掉。

## 1. 实验对象

| 项目 | 值 |
|---|---:|
| artifact 数量 | 4 |
| judge 数量 | 3 |
| 目标 | mixed sentence 切分 + gap case 总裁决 |

## 2. 主结果

### 2.1 claim 切分稳定

| artifact | 三位 judge 的 claim 数 |
|---|---|
| A06 | `4 / 4 / 4` |
| A08 | `5 / 5 / 5` |
| A09 | `2 / 2 / 2` |
| A11 | `2 / 2 / 2` |

结论：

> **focus pack 上的 claim segmentation 已收敛。**

v1.1 中 A06/A08 的 `3/4/3/3/3`、`4/5/4/4/4` 漂移，在 v1.2 中已经不再出现。

### 2.2 artifact 总裁决稳定

| artifact | boundary_honesty | schema_valid | overall_verdict |
|---|---|---|---|
| A06 | `yes / yes / yes` | `yes / yes / yes` | `pass / pass / pass` |
| A08 | `yes / yes / yes` | `yes / yes / yes` | `pass / pass / pass` |
| A09 | `yes / yes / yes` | `no / no / no` | `partial / partial / partial` |
| A11 | `yes / yes / yes` | `no / no / no` | `partial / partial / partial` |

结论：

> **v1.2 的 deterministic artifact verdict rule 已经把 A09/A11 的 `pass/mixed/partial/fail` 漂移收敛成统一的 `partial`。**

## 3. 仍残留的微型歧义

在 A09 / A11 的第一句上，仍出现了一个更小的差异：

- Judge F：判 `supported`
- Judge G / H：判 `not-scored`

对应句型：

- “当前 canon 中没有对应页面”
- “当前 canon 中没有对应流程”

造成差异的原因不是 judge 随机漂移，而是 **rubric v1.2 内部有两段文字彼此冲突**：

1. 一处把“coverage-status 可核验结论”写进 factual claim
2. 另一处又把“当前 canon 中没有对应页面”列为 `not-scored` 示例

因此，这个分歧更准确地说是：

> **文本冲突残留，不是评审主干再度失稳。**

## 4. 当前判断

把主问题和余留小问题区分开，当前最准确的结论是：

1. v1.1 修掉了 `not-scored` / `unsupported` 主边界
2. v1.2 修掉了 mixed sentence 切分与 gap case 聚合漂移
3. 现在只剩一个更小的文案清理项：纯 coverage-status 句子归类

## 5. 最终结论

因此，v1.2 focus 实验后的最准确表述应为：

> **多评审协议的主歧义已经基本闭合；剩余的是一个不会改变当前 artifact 级结论的局部文字冲突。**
