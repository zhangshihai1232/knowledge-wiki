---
type: experiment-analysis
name: governance-full-comparison
version: 1.0
created_at: 2026-04-09
benchmark_ref: evaluation/benchmark/governance-benchmark.md@v1.0
---

# Governance Full Benchmark Comparison

> 说明：本文件对 `governance-benchmark.md` 的 15 个 case 做 **baseline（HEAD@9bb0a43） vs fixed（当前 working tree）** 的逐项判定。  
> 判定依据仅来自 benchmark 定义与 spec/schema 文本，不假设额外运行时行为。

## case 级对照

> 复核口径：`PARTIAL` = 有局部文本支持，但字段 / 规则 / 路由未闭环。下方指标只按 `PASS` 计分，不把 `PARTIAL` 折算为通过。

| Case | 预期 | baseline | fixed | 说明 |
|---|---|---|---|---|
| GB-S-01 | inbox 普通超期提案触发 L008 | FAIL | PASS | baseline lint 要求 `status=="pending"`，与 schema `status: inbox` 冲突；fixed 已统一为 inbox/review + proposed_at |
| GB-S-02 | query-writeback 超 14 天触发 L008 + `[WRITEBACK-OVERDUE]` | PARTIAL | PASS | baseline `query` 写了 14 天 SLA，但 `lint`/schema 没闭环；fixed 已形成 query + lint 闭环 |
| GB-S-03 | review 目录超期提案触发 L008 | FAIL | PASS | baseline 仅扫 inbox；fixed 扫 inbox + review |
| GB-R-01 | 连续 10 次 approve 触发 promote + lint 一致预警 | PARTIAL | PASS | baseline promote=最近10次100%，lint=最近20次≥90%，口径不一致；fixed 统一为 `consecutive_approve_count >= 10` |
| GB-R-02 | 6 approve 后 1 reject 不触发 L011 | PARTIAL | PASS | baseline 文本下大概率不触发，但受“最近20次 approve 率≥90%”口径影响，不能严格保证；fixed 连续 approve 口径可稳定不触发 |
| GB-R-03 | 模板化 / 过短 approve_note 被拦截或至少提示 | PASS | PASS | baseline 与 fixed 都保留 ≥20 字 gate |
| GB-Q-01 | 无真实来源的 query-writeback 不得进入 compile | FAIL | PASS | baseline 无 Gate 1.2；fixed promote + compile 双重拦截 |
| GB-Q-02 | 已补真实来源的 query-writeback 可进入 compile | PASS | PASS | baseline 可作为普通知识提案进入 compile，但 route 语义不显式；fixed 路由明确 |
| GB-Q-03 | 缺 `origin` 的 write-back proposal 视为 schema 不合法 | FAIL | PASS | baseline schema 无 `origin`；fixed 已把 `origin` 改为必填字段，write-back / lint-patrol 都可被稳定判定 |
| GB-P-01 | patrol 生成 1 个合法且可消费的治理提案 | PARTIAL | PASS | baseline 会生成 proposal，但 schema / trigger_source / 下游路由不完整；fixed 可被 maintain 正式消费 |
| GB-P-02 | 7 天内已有同类 patrol 时 skip | FAIL | PASS | baseline 无去重 / TTL；fixed 有 `[PATROL-SKIP]` |
| GB-P-03 | TTL 过期后可重新生成 | PARTIAL | PASS | baseline 会“再次生成”，但不是基于 TTL 机制；fixed 有明确 TTL 语义 |
| GB-C-01 | unresolved conflict 触发 L006 | PASS | PASS | baseline/fixed 都支持 L006 |
| GB-C-02 | `sources=[]` 触发 L003 | PASS | PASS | baseline/fixed 都支持 L003 |
| GB-D-01 | 52 页触发 L007，并能进入 patrol/maintain 路由 | PASS | PASS | baseline 有 L007 且可触发 maintain；fixed 额外补齐 patrol proposal 的正式路由 |

## 汇总判定

- baseline：**5 PASS / 5 PARTIAL / 5 FAIL**
- fixed：**15 PASS / 0 PARTIAL / 0 FAIL**

## 可支持的指标变化

### 1. stale_proposal_detection_recall

使用 case：GB-S-01 / GB-S-02 / GB-S-03

| 组别 | 通过数 | 总数 | 结果 |
|---|---:|---:|---:|
| baseline | 0 | 3 | 0.00 |
| fixed | 3 | 3 | 1.00 |

### 2. patrol_dedup_stability

使用 case：GB-P-02 / GB-P-03

| 组别 | 通过数 | 总数 | 结果 |
|---|---:|---:|---:|
| baseline | 0 | 2 | 0.00 |
| fixed | 2 | 2 | 1.00 |

### 3. governance route strict pass rate

使用 case：GB-Q-01 / GB-Q-02 / GB-Q-03 / GB-P-01 / GB-D-01

| 组别 | 通过数 | 总数 | 结果 |
|---|---:|---:|---:|
| baseline | 2 | 5 | 0.40 |
| fixed | 5 | 5 | 1.00 |

### 4. review governance strict pass rate

使用 case：GB-R-01 / GB-R-02 / GB-R-03

| 组别 | 通过数 | 总数 | 结果 |
|---|---:|---:|---:|
| baseline | 1 | 3 | 0.33 |
| fixed | 3 | 3 | 1.00 |

## 结论

governance full benchmark 给出的信号很清晰：

1. baseline 最大的问题不是“完全没有规则”，而是**规则之间对不上**  
2. fixed 的改善集中在 **stale proposal、system proposal route、patrol dedup、review warning consistency**  
3. 经复核并补齐 `origin` 必填后，fixed 在这 15 个治理 case 上已达到 **15/15 全通过**

这说明：**至少在治理闭环层，修复后的系统已经不是“看起来更完整”，而是“确实更可执行、且可被复核证明更完整”。**
