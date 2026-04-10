---
type: feasibility-report
name: query-source-feasibility
version: 1.0
created_at: 2026-04-09
---

# Query / Source Full Benchmark Feasibility

## 结论

**在当前仓库状态下，governance benchmark 可以严谨执行；source / query 的 full benchmark 现在也已经具备严谨执行所需的 runtime 载体。**

当前缺的已不再是 fixture 或判分模板，而是**baseline / fixed 的实际全量执行与结果沉淀**。

## 已经具备的条件

1. **benchmark 已冻结**
   - source：30 case
   - query：45 case
   - governance：15 case

2. **protocol 已冻结**
   - 有组别定义
   - 有主指标 / 次指标
   - 有结果目录约定

3. **P0 可测性问题已补齐**
    - `query_count`
    - `last_queried_at`
    - `canon外推断占比`
    - system proposal route
4. **source fixture 已补齐**
   - `evaluation/benchmark/fixtures/sources/`
   - 共 30 个 schema 合法 source fixture

5. **frozen canon seed 已补齐**
   - `evaluation/benchmark/fixtures/canon-seed/`
   - 含 15 个可查询 canon 页面 + 顶层 / 领域索引

6. **query answer log 与 claim judging 模板已补齐**
   - `evaluation/benchmark/fixtures/templates/query-answer-log-template.md`
   - `evaluation/benchmark/fixtures/templates/query-claim-annotation-template.md`
   - `evaluation/benchmark/fixtures/templates/query-judging-rubric.md`
   - `evaluation/benchmark/fixtures/templates/query-adjudication-protocol.md`

## 当前可严谨执行的部分

| 部分 | 当前是否可严谨执行 | 说明 |
|---|---|---|
| governance benchmark | yes | 规则触发、路由、去重、schema 合法性可直接由 spec 判定 |
| query 结构可测性检查 | yes | 能判断是否具备采集条件 |
| source/query 端到端 runtime | yes | 已具备 source fixture、canon seed、answer log 与 judging rubric |

## 最短执行路径

### Step 1：运行 baseline 全量

使用冻结的 `fixtures/sources/`、`fixtures/canon-seed/` 与 `fixtures/templates/` 跑 baseline source/query 全量 case。

### Step 2：运行 fixed 全量

在**完全相同**的 fixture 上跑 fixed source/query 全量 case。

### Step 3：按 rubric 判分

对 query 结果按 claim 级 rubric 标注，并汇总主指标 / 次指标。

### Step 4：输出最终结论

只允许输出 `有效 / 部分有效 / 证据不足` 三种结论口径。

## 最终判断

**如果继续往前推进，最合理的顺序已经变成直接运行 baseline / fixed 的 source/query full benchmark。**  
现在跑出来的结果可以被组织成可复核的 runtime validation 数据，而不再只是“试答记录”。
