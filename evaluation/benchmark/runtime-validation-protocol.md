---
type: protocol
name: runtime-validation-protocol
version: 1.0
created_at: 2026-04-09
---

# Runtime Validation Protocol

## 1. 目标

验证修复后的 knowledge-wiki 系统是否在**真实运行效果**上优于修复前版本，而不仅仅是规则写得更完整。

## 2. 实验对象

| 组别 | 定义 |
|---|---|
| baseline | 修复前规则版本 |
| fixed | 当前修复后规则版本 |

两组必须使用**完全相同**的 benchmark 版本：

- `source-benchmark.md`（30 case）
- `query-benchmark.md`（45 case）
- `governance-benchmark.md`（15 case）
- `evaluation/benchmark/fixtures/sources/`（30 个 source fixture）
- `evaluation/benchmark/fixtures/canon-seed/`（query 用 frozen canon 初始状态）
- `evaluation/benchmark/fixtures/templates/`（query answer log / claim judging 模板）

## 3. 实验轮次

- 每组至少 **3 轮**
- 每轮都要记录独立 run_id
- 若某轮中断，不得混入另一轮结果

## 4. 执行顺序

### Phase A：source pipeline

对 `fixtures/sources/` 中的 30 个 source case 逐个执行 ingest → promote → compile，记录：

- target_page 是否正确
- claims 是否失真
- conflict 是否被正确保留
- uncertainty 是否被错误写实

### Phase B：query pipeline

从同一份 `fixtures/canon-seed/` 起跑，对 45 个 query case 逐个执行 query，并用 `fixtures/templates/` 记录：

- 来源标注覆盖
- `canon外推断占比`
- 是否诚实说明缺口
- 是否生成合法 write-back proposal
- 是否更新 `last_queried_at` / `query_count`

### Phase C：governance pipeline

对 15 个 governance case 执行 lint / promote / maintain 相关流程，记录：

- 对应 rule 是否触发
- route 是否正确
- patrol 是否重复生成
- 审查异常是否被识别

## 5. 主指标

| 指标 | 公式 | 目标方向 |
|---|---|---|
| unsupported_claim_rate | 无 canon 依据的事实断言数 / 全部事实断言数 | 越低越好 |
| conflict_detection_recall | 被识别的冲突 case / 全部应识别冲突 case | 越高越好 |
| stale_proposal_detection_recall | 被识别超期 proposal case / 全部超期 proposal case | 越高越好 |
| writeback_schema_valid_rate | 合法 write-back proposal / 全部 write-back proposal | 越高越好 |
| review_anomaly_precision | 真正异常的审查预警 / 全部审查预警 | 越高越好 |
| metric_collectability_coverage | 可稳定采集的核心指标 / 计划核心指标总数 | 越高越好 |

## 6. 次指标

| 指标 | 公式 |
|---|---|
| writeback_conversion_rate | compiled 的 `origin=query-writeback` proposal / 全部 `origin=query-writeback` proposal |
| query_utilization_rate | 90 天内被 query 引用过的 canon 页 / 全部 active canon 页 |
| confidence_upgrade_precision | 被升级为 medium/high 且事后审查仍成立的页面 / 全部被升级页面 |
| patrol_dedup_stability | 未重复生成的 patrol case / 全部 patrol case |

## 7. 成功阈值（MVP）

若 fixed 组满足以下条件，可判定“存在有效性证据”：

1. `unsupported_claim_rate` 相对 baseline 下降 **≥ 30%**
2. `conflict_detection_recall` **≥ 0.85**
3. `stale_proposal_detection_recall` **≥ 0.85**
4. `writeback_schema_valid_rate` **= 1.00**
5. `review_anomaly_precision` **≥ 0.80**
6. `metric_collectability_coverage` **≥ 0.90**
7. `patrol_dedup_stability` **= 1.00**

若只满足部分条件，则结论为“部分有效”；若关键主指标无显著改善，则为“证据不足”。

## 8. 结果记录格式

每轮实验建议写入：

`evaluation/results/{group}/{run_id}.md`

每个结果文件至少包含：

- benchmark 版本
- 运行日期
- 组别（baseline / fixed）
- case 级结果表
- 主指标汇总
- 次指标汇总
- 异常说明

推荐模板：

- `evaluation/benchmark/fixtures/templates/query-answer-log-template.md`
- `evaluation/benchmark/fixtures/templates/query-claim-annotation-template.md`
- `evaluation/benchmark/fixtures/templates/query-judging-rubric.md`
- `evaluation/benchmark/fixtures/templates/query-adjudication-protocol.md`

## 9. 统计分析

### 比例类指标

- 优先：Fisher 精确检验 / 卡方检验
- 同时报告：绝对差值、相对提升、95% CI

### 连续值 / 分布类指标

- 优先：Mann-Whitney U
- 同时报告：中位数差、IQR、95% CI

## 10. 结论口径

最终报告只能使用以下三种口径之一：

1. **有效**：主指标改善稳定，且达到成功阈值  
2. **部分有效**：部分指标改善明显，但仍有关键短板  
3. **证据不足**：数据不足或组间差异不稳定，不能证明有效  

## 11. 禁止事项

1. 不得在 benchmark 运行中途修改规则  
2. 不得 baseline 用一版数据、fixed 用另一版数据  
3. 不得只挑有利 case 汇报  
4. 不得用设计文档分数替代运行效果分数  
5. 不得在 run 中途临时修改 fixture 或 judging rubric  
