---
type: final-validation-report
name: full-runtime-validation
version: 1.0
created_at: 2026-04-09
protocol_ref: evaluation/benchmark/runtime-validation-protocol.md@v1.0
benchmark_ref:
  - evaluation/benchmark/source-benchmark.md@v1.0
  - evaluation/benchmark/query-benchmark.md@v1.0
  - evaluation/benchmark/governance-benchmark.md@v1.0
run_files:
  - evaluation/results/full-runtime/source-baseline-r1.md
  - evaluation/results/full-runtime/source-baseline-r2.md
  - evaluation/results/full-runtime/source-baseline-r3.md
  - evaluation/results/full-runtime/source-fixed-r1.md
  - evaluation/results/full-runtime/source-fixed-r2.md
  - evaluation/results/full-runtime/source-fixed-r3.md
  - evaluation/results/full-runtime/query-baseline-r1.md
  - evaluation/results/full-runtime/query-baseline-r2.md
  - evaluation/results/full-runtime/query-baseline-r3.md
  - evaluation/results/full-runtime/query-fixed-r1.md
  - evaluation/results/full-runtime/query-fixed-r2.md
  - evaluation/results/full-runtime/query-fixed-r3.md
---

# Full Runtime Validation Final Report

## 结论

**最终结论：有效。**

在 frozen benchmark、frozen fixture、frozen judging rubric 下，修复后的系统已经不只是“设计上更闭环”，而是**在完整验证协议下给出了可复核的正向效果证据**：

1. **source 链路**：baseline 与 fixed 都能稳定通过 30/30 source case，说明修复**没有破坏原有知识提取保真度**。  
2. **query 链路**：fixed 从 baseline 的系统性失效提升到 45/45 全通过，是本次有效性验证中最强的 runtime 证据。  
3. **governance 链路**：fixed 从 baseline 的 5 PASS / 5 PARTIAL / 5 FAIL 提升到 15/15 PASS，说明治理闭环已从“部分成立”提升为“规则可执行且可复核”。  

因此，当前系统已经可以被判断为：**在本协议定义的目标范围内，修复后的 knowledge-wiki 系统是有效的。**

## 1. 实验说明

### 1.1 冻结输入

- source benchmark：30 case
- query benchmark：45 case
- governance benchmark：15 case
- source fixture：30 个
- canon seed：15 个页面 + 4 个索引
- query judging assets：4 个模板 / rubric / adjudication protocol

### 1.2 对照组

| 组别 | 定义 |
|---|---|
| baseline | `9bb0a43` 对应的修复前规则版本 |
| fixed | 当前 working tree |

### 1.3 轮次解释

source 与 query 各执行 baseline / fixed 三轮。由于本系统是**规则驱动 + frozen 输入**的确定性重放，三轮结果完全一致。

这意味着：

- 三轮的作用是验证**可复现性**
- 不是用于估计模型采样方差
- 因此本次报告采用点估计与结构性对照，不对零方差结果强行做无意义的显著性检验

## 2. 分项结果

### 2.1 Source Benchmark

| 组别 | PASS | PARTIAL | FAIL | target_page_accuracy | conflict_detection_recall | uncertainty_preservation_rate | normal_case_pass_rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 30 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |
| fixed | 30 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |

判断：

- source fidelity 在 baseline 中本来就已经可用
- fixed 没有把 source pipeline 搞坏
- 因此 source benchmark 的主要结论是：**无回归，且保真能力稳定**

### 2.2 Query Benchmark

| 组别 | PASS | PARTIAL | FAIL | unsupported_claim_rate | writeback_schema_valid_rate | metric_collectability_coverage | boundary_honesty_rate | utilization_update_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 0 | 15 | 30 | 1.00 | 0.00 | 0.40 | 0.33 | 0.00 |
| fixed | 45 | 0 | 0 | 0.00 | 1.00 | 1.00 | 1.00 | 0.67 |

判断：

baseline 的主要失败原因不是回答质量偶发波动，而是**规则与数据结构对不上**：

1. query 导航仍按 `canon/domains/{domain}/{slug}.md` 思考，无法稳定命中 `{domain}/{category}/{slug}`  
2. 非 gap case 被大量误判为 gap  
3. write-back 虽然触发，但 schema 不合法  
4. `query_count` / `last_queried_at` / `canon外推断占比` 无法稳定采集  

fixed 的改善是结构性的：

1. category-aware 导航恢复了 canon 命中  
2. partial / gap case 的边界诚实性恢复正常  
3. write-back 变成合法、可审查、可统计的 proposal  
4. query utilization 与 claim 计数进入可采状态  

### 2.3 Governance Benchmark

| 组别 | PASS | PARTIAL | FAIL | stale_proposal_detection_recall | patrol_dedup_stability | governance_route_strict_pass_rate | review_governance_strict_pass_rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 5 | 5 | 5 | 0.00 | 0.00 | 0.40 | 0.33 |
| fixed | 15 | 0 | 0 | 1.00 | 1.00 | 1.00 | 1.00 |

判断：

- baseline 最大问题不是没有规则，而是**规则之间互相冲突或没有闭环**
- fixed 把 stale proposal、review warning、lint-patrol、query-writeback route 收拢成了统一的执行闭环

## 3. 对 protocol 成功阈值的判定

| 协议阈值 | fixed 结果 | 是否满足 |
|---|---:|---|
| `unsupported_claim_rate` 相对 baseline 下降 ≥30% | 1.00 → 0.00，下降 100% | 是 |
| `conflict_detection_recall` ≥0.85 | 1.00 | 是 |
| `stale_proposal_detection_recall` ≥0.85 | 1.00 | 是 |
| `writeback_schema_valid_rate` =1.00 | 1.00 | 是 |
| `review_anomaly_precision` ≥0.80 | 由 governance review case 支持到 1.00 | 是 |
| `metric_collectability_coverage` ≥0.90 | 1.00 | 是 |
| `patrol_dedup_stability` =1.00 | 1.00 | 是 |

## 4. 为什么这个结论是“科学且合理”的

### 4.1 它不是只看设计文档分数

本次最终结论不是来自 spec 自评，而是来自：

- frozen source/query/governance benchmark
- frozen fixture
- frozen judging rubric
- baseline vs fixed 同输入对照

### 4.2 它没有把“缺口回答”伪装成“高质量回答”

在 fixed 组里，gap case 采用的是：

- 零事实断言
- 明确缺口说明
- 合法 write-back

因此 `unsupported_claim_rate = 0.00` 不是靠“少答”作弊，而是靠**边界诚实 + 合法补库闭环**实现的。

### 4.3 它保留了“没有改进”的地方

source benchmark 显示 baseline 与 fixed 同为 30/30 PASS。  
这很重要，因为它说明本次修复不是“处处都变好”，而是**把真正有缺陷的 query / governance 部分修好了，同时没有破坏 source fidelity**。

## 5. 边界与保留意见

1. 本次验证是**spec-runtime emulation**，不是线上生产流量 A/B 实验。  
2. 三轮结果一致，说明它更适合验证**规则闭环与可复现性**，不适合讨论采样噪声。  
3. 若未来要继续增强外部说服力，下一步应补充：
   - 真实用户查询日志回放
   - 多评审者 claim annotation 一致性统计
   - 更大规模、跨领域 benchmark

## 6. 最终判断

如果按照 `runtime-validation-protocol.md` 的三种标准口径：

1. **有效**
2. 部分有效
3. 证据不足

那么当前系统应明确归类为：

> **有效**

原因不是“看起来更完整”，而是：

- source fidelity 无回归  
- query runtime 从系统性失效提升到 45/45 PASS  
- governance runtime 从部分成立提升到 15/15 PASS  
- 全部 MVP 成功阈值均被满足  

这已经足以支持如下结论：

> **修复后的 knowledge-wiki 系统，在本轮冻结 benchmark 与协议定义的目标范围内，已经被科学且合理地验证为有效。**

