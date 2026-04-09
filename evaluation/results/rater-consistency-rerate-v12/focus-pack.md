---
type: blind-artifact-pack
name: rater-consistency-rerate-v12-focus-pack
version: 1.0
created_at: 2026-04-09
sample_size: 4
focus_goal:
  - mixed-sentence claim splitting
  - gap-case verdict aggregation
source_material:
  - evaluation/results/rater-consistency-pilot/artifact-pack.md
  - evaluation/benchmark/query-benchmark.md
  - evaluation/benchmark/fixtures/canon-seed/
---

# Rater Consistency Re-rate v1.2 — Focus Pack

> 本包只保留 v1.1 实验中仍存在歧义的 4 个 artifact：A06 / A08 / A09 / A11。  
> judge 可使用：
> - `evaluation/benchmark/query-benchmark.md`
> - `evaluation/benchmark/fixtures/canon-seed/`
> - `evaluation/benchmark/fixtures/templates/query-judging-rubric-v1.2.md`
>
> judge **不可假设** artifact 的组别，也不应阅读任何既有 judge 结果。

## Artifact A06

**Query**：向量数据库选型时如何考虑租户隔离？

**Observed Answer**

- 现有 canon 可以支持“选型要考虑部署控制权与混合检索能力”这一部分。[来源: ai/databases/vector-db-selection]
- 如果把“租户隔离”理解为部署控制权和实例边界，自托管方案通常更容易自定义隔离策略。[⚠️ canon 外推断：基于 ai/databases/vector-db-selection，建议验证]
- 但 canon 里没有单独定义租户隔离模型，因此这一点仍是知识缺口。

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "ai/databases/tenant-isolation"
trigger_source: "system:query-writeback"
origin: query-writeback
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

## Artifact A08

**Query**：文档优先和日志优先如何做冲突裁决？

**Observed Answer**

- canon 目前只定义了两种取向的适用场景，而没有冲突裁决机制。[来源: infra/observability/source-of-truth-choice]
- 文档优先适合沉淀稳定共识。[来源: infra/observability/source-of-truth-choice]
- 日志优先适合还原真实运行现场。[来源: infra/observability/source-of-truth-choice]
- 如果两者冲突，当前 canon 没有裁决规则，因此需要补充 write-back。

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "infra/observability/conflict-resolution"
trigger_source: "system:query-writeback"
origin: query-writeback
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

## Artifact A09

**Query**：如何评估 agent tool call 的平均 token 成本？

**Observed Answer**

- 当前 canon 中没有“agent tool call 平均 token 成本”的对应页面。
- 已生成知识缺口 proposal，建议后续补充相关规范。

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "ai/agents/tool-call-token-cost"
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

## Artifact A11

**Query**：如何把 patrol 与工单系统自动打通？

**Observed Answer**

- 当前 canon 中没有“patrol 与工单系统自动打通”的对应流程。
- 已生成 proposal，建议后续补充集成规范。

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "infra/ops/patrol-ticket-integration"
confidence: low
proposed_at: "2026-04-09"
compiled: false
```
