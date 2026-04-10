---
type: protocol
name: adversarial-high-scale
version: 1.0
created_at: 2026-04-10
---

# Adversarial High-Scale Protocol

## 1. 目标

把当前“已通过 frozen benchmark”的结论继续向前推进一层：  
在**更大数据量、更高迁移密度、更强失败注入、更恶意边界输入**下，验证系统仍能保持：

1. 大分类 / 小分类迁移正确
2. merge / rollback 一致
3. workflow 失败不留下半状态
4. repo 边界不被穿透
5. governance 信号在高密度数据下仍可见

## 2. 适用边界

本协议仍属于 **受控条件下的鲁棒性证明**，不替代：

1. 真实日志回放
2. 多评审者一致性
3. 长周期稳定性观察

它回答的是：**在 controlled benchmark 内，把复杂度和样本量抬高后，系统还能不能稳住。**

## 3. Workload Tiers

| Tier | 用途 | page_id 生成量 | 高密度 canon 页 | collision pair | merge fan-in | workflow failure injection |
|---|---|---:|---:|---:|---:|---:|
| `smoke` | CI / 快速回归 | 2,000 | 34+ | 6 | 6 | 3 |
| `challenge` | 默认强化评估 | 12,000 | 48+ | 12 | 12 | 9 |
| `extreme` | 边界探索 | 30,000 | 72+ | 20 | 20 | 15 |

## 4. 场景块

| 场景 | 目的 |
|---|---|
| Page ID Load | 高并发近似压力下检验 `generatePageId()` 唯一性 |
| Structural Signal Density | 在高密度 domain / subtype / suggestion drift 下触发 S001-S005 与 L012 |
| Migration Collision Matrix | 批量制造内部路径碰撞，验证 dry-run 与 apply 前置拦截 |
| Taxonomy Mobility | 同时覆盖 rename-domain 与 merge-subtype 的 apply / rollback 完整性 |
| Merge Fan-In | 验证多源归并、大 fan-in、alias 记录与 rollback 恢复 |
| Workflow Failure Injection | 对 compile / review / resolve 做后半程失败注入，验证原子回滚 |
| Repo Boundary Adversarial Inputs | 用 traversal / absolute path / symlink 测 repo 边界防护 |

## 5. 主指标

| 指标 | 说明 | 目标 |
|---|---|---|
| `page_id_collision_rate` | `重复 page_id / 生成总量` | `= 0` |
| `structural_signal_coverage_rate` | `命中的目标结构信号 / 5` | `= 1` |
| `l012_visibility_rate` | 高复杂场景下未分类页面是否仍被发现 | `= 1` |
| `internal_collision_detection_rate` | `dry-run 检出的内部碰撞 / 注入碰撞数` | `= 1` |
| `dry_run_schema_completeness_rate` | 关键 dry-run 字段是否齐全 | `= 1` |
| `collision_preflight_preservation_rate` | apply 被拦截时是否零突变 | `= 1` |
| `taxonomy_mobility_recovery_rate` | rename-domain / merge-subtype rollback 完整恢复率 | `= 1` |
| `merge_rollback_integrity_rate` | merge-pages apply+rollback 完整恢复率 | `= 1` |
| `workflow_atomic_recovery_rate` | compile / review / resolve 失败注入后的恢复率 | `= 1` |
| `repo_boundary_rejection_rate` | 恶意路径输入被拒绝比例 | `= 1` |

## 6. 成功阈值

若 `challenge` tier 满足以下条件，可判定：  
**系统在受控条件下已经具备更强的复杂度与数据量鲁棒性证据**。

1. 所有主指标均达到目标
2. 所有 scenario 均通过
3. `pages_generated`、`plans_created`、`workflow_failures_injected` 达到该 tier 的最小工作负载

## 7. 输出产物

每次运行至少产出：

1. benchmark runner 原始 JSON 结果
2. scenario 级 workload 与 metric 明细
3. PASS / FAIL verdict
4. 失败 scenario 的错误上下文

## 8. 执行方式

```bash
npm run benchmark:adversarial -- --json
npm run benchmark:adversarial -- --tier extreme --json --out evaluation/results/adversarial-high-scale-extreme.json
```

## 9. 约束

1. benchmark 运行期间不得修改规则 / fixture / runner
2. 结果文件必须标明 tier 与运行时间
3. 若执行成本受限，优先保留 `challenge` tier，而不是降成零碎单点测试
