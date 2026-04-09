---
type: experiment-roadmap
name: evidence-strengthening-roadmap
version: 1.0
created_at: 2026-04-09
---

# Evidence Strengthening Roadmap

## 背景

当前仓库已经完成一轮 **frozen benchmark + frozen fixture + frozen judging rubric** 的 full runtime validation，并得出结论：**有效**。

但这个结论的边界也很清楚：

- 它证明了 **受控条件下** 的有效性
- 它还没有充分覆盖 **真实日志、多人评审、长周期运行** 三个层面

因此，下一阶段的任务不是“继续修核心闭环”，而是**增强证据强度**。

## 用户故事

作为系统负责人 / 评审者 / 外部质疑者，我希望看到：

1. 这套系统在真实 query 上也比 baseline 更可靠  
2. 这个结论不是某一个 judge 的主观偏好  
3. 系统在持续运行中不会很快退化

## 证明层级

| 层级 | 目标 | 当前状态 |
|---|---|---|
| L1：受控有效性 | 证明 fixed 在 frozen benchmark 上优于 baseline | **已完成** |
| L2：真实场景有效性 | 证明 fixed 在真实日志回放上仍优于 baseline | 待做 |
| L3：判分可靠性 | 证明多评审者对 claim 级判断高度一致 | 待做 |
| L4：持续稳定性 | 证明系统连续运行后核心治理指标不回退 | 待做 |

## MVP 范围

### Must Have

1. **真实日志回放实验**
2. **多评审者一致性实验**
3. 同一 canon snapshot、同一 blind judging 规则下的 baseline vs fixed 对照

### Should Have

1. **14-28 天长周期稳定性观察**
2. 关键指标周报与异常回顾

### Not Now

1. 线上随机流量 A/B
2. 大规模自动化平台化评测
3. 商业价值 / ROI 的完整财务测算

## 成功标准

若完成 L2 + L3，并满足以下条件，可将当前结论从“受控条件有效”增强为“**真实场景下也有强证据支持有效**”：

1. 真实日志回放中，fixed 的 `unsupported_claim_rate` 相对 baseline 下降 **≥ 30%**
2. `boundary_honesty_rate` **≥ 0.85**
3. `writeback_schema_valid_rate` **≥ 0.95**
4. 多评审者 claim 标签一致性（Krippendorff's alpha 或同等级指标）**≥ 0.75**
5. `schema_valid` / `boundary_honesty` 二元判断一致性 **≥ 0.80**

若再完成 L4，并满足稳定性阈值，则可把结论增强为“**真实场景可复现且持续稳定有效**”。

## 执行顺序

1. 先做 **真实日志回放**
2. 再做 **多评审者一致性**
3. 最后做 **长周期稳定性**

原因：

- 日志回放先回答“真实场景是否成立”
- 多评审再回答“判分是不是可靠”
- 长周期最后回答“会不会过几周就退化”

## 产物要求

每个实验都至少产出：

1. 实验 protocol
2. 数据集 / 样本说明
3. baseline vs fixed 结果表
4. 结论报告
5. 异常与边界说明

## 执行约束

1. baseline 与 fixed 必须使用同一输入集
2. run 期间不得改规则 / rubric / snapshot
3. judge 必须盲评
4. 若使用子 agent 并行执行，**最大并发数为 3**

