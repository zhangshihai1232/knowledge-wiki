---
type: blind-artifact-pack
name: rater-consistency-pilot-pack
version: 1.0
created_at: 2026-04-09
sample_size: 12
blind: true
source_material:
  - evaluation/results/full-runtime/query-baseline-r1.md
  - evaluation/results/full-runtime/query-fixed-r1.md
  - evaluation/benchmark/query-benchmark.md
  - evaluation/benchmark/fixtures/canon-seed/
---

# Rater Consistency Pilot — Blind Artifact Pack

> 说明：本包用于 **pilot** 级多评审一致性实验。  
> judge 可使用：
> - `evaluation/benchmark/query-benchmark.md`
> - `evaluation/benchmark/fixtures/canon-seed/`
> - `evaluation/benchmark/fixtures/templates/query-judging-rubric.md`
>
> judge **不可假设** artifact 的组别，也不应提前知道其来自 baseline 还是 fixed。

## Artifact A01

**Query**：什么是向量数据库选型时最关键的三项权衡？

**Observed Answer**

- 向量数据库选型通常要权衡性能、成本和可扩展性。[⚠️ 训练知识，未经 canon 验证]
- 多租户和混合检索能力也很重要。[⚠️ 训练知识，未经 canon 验证]
- 不同场景下答案会不同。[⚠️ 训练知识，未经 canon 验证]

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "ai/databases/vector-db-selection"
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

## Artifact A02

**Query**：什么是向量数据库选型时最关键的三项权衡？

**Observed Answer**

- 选型时最关键的三项权衡是：是否接受托管成本、是否需要自托管控制权、是否需要混合检索能力。[来源: ai/databases/vector-db-selection]
- Pinecone 更偏免运维，Milvus 更偏自托管控制权，Weaviate 更偏混合检索友好。[来源: ai/databases/vector-db-selection]

## Artifact A03

**Query**：什么时候应该把页面归档？

**Observed Answer**

- 页面长期不用就应该归档。[⚠️ 训练知识，未经 canon 验证]
- 常见阈值是 90 天。[⚠️ 训练知识，未经 canon 验证]
- 对研究页面可以放宽到 180 天。[⚠️ 训练知识，未经 canon 验证]

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "ai/wiki/archive-threshold"
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

## Artifact A04

**Query**：什么时候应该把页面归档？

**Observed Answer**

- 当前 canon 没有单一归档阈值。[来源: ai/wiki/archive-threshold]
- 运营团队主张 90 天不活跃即归档。[来源: ai/wiki/archive-threshold]
- 研究团队主张 180 天更合理。[来源: ai/wiki/archive-threshold]

## Artifact A05

**Query**：向量数据库选型时如何考虑租户隔离？

**Observed Answer**

- 租户隔离通常要看 namespace、权限模型和成本。[⚠️ 训练知识，未经 canon 验证]
- Pinecone 和 Weaviate 都支持多租户。[⚠️ 训练知识，未经 canon 验证]
- 大型 B2B 系统一般都需要强隔离。[⚠️ 训练知识，未经 canon 验证]

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "ai/databases/tenant-isolation"
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

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

## Artifact A07

**Query**：文档优先和日志优先如何做冲突裁决？

**Observed Answer**

- 冲突裁决一般应该优先看日志。[⚠️ 训练知识，未经 canon 验证]
- 如果日志不全，再参考文档。[⚠️ 训练知识，未经 canon 验证]
- 这是一种常见排查顺序。[⚠️ 训练知识，未经 canon 验证]

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "infra/observability/conflict-resolution"
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

## Artifact A10

**Query**：如何评估 agent tool call 的平均 token 成本？

**Observed Answer**

- 当前 canon 中没有“agent tool call 平均 token 成本”的对应页面。
- 本次不提供未经验证的估算公式。
- 已登记知识缺口，建议后续补充对应页面。

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "ai/agents/tool-call-token-cost"
trigger_source: "system:query-writeback"
origin: query-writeback
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

## Artifact A12

**Query**：如何把 patrol 与工单系统自动打通？

**Observed Answer**

- 当前 canon 中没有“patrol 与工单系统自动打通”的对应流程。
- 因为没有 canon 依据，本次不编造自动化流程。
- 已登记知识缺口，建议后续补充集成规范。

**Write-back Excerpt**

```yaml
type: change-proposal
action: create
status: inbox
target_page: "infra/ops/patrol-ticket-integration"
trigger_source: "system:query-writeback"
origin: query-writeback
confidence: low
proposed_at: "2026-04-09"
compiled: false
```

