---
type: readiness-report
name: real-log-replay-readiness
version: 1.0
created_at: 2026-04-09
protocol_ref: evaluation/protocols/real-log-replay-protocol.md
---

# Real Log Replay Readiness

## 结论

**当前仓库内没有可直接执行 `real-log-replay-protocol.md` 的真实用户 query 日志样本。**

因此，真实日志回放实验目前的状态是：

- **协议已完成**
- **执行资产未齐**
- **下一步所需输入已明确**

## 已检查位置

本次已检查：

- `evaluation/`
- `.wiki/policy/LOG.md`
- `.wiki/changes/LOG.md`
- `evaluation/test-run-log.md`
- 现有 benchmark / runtime result 目录

检查结果：

1. 存在 benchmark、runtime result、设计日志
2. **不存在可直接用于 replay 的脱敏真实 query 样本**
3. 也不存在冻结好的真实 canon snapshot + log sample 绑定关系

## 当前阻塞点

真实日志回放至少还缺三项：

1. **脱敏后的真实 query 样本**
2. **与样本对应的 canon snapshot**
3. **样本抽样说明**（时间窗口 / 去重 / 分层策略）

## 最小输入要求

若要开始执行 MVP，需要至少提供：

1. 最近 30 天的真实 query 日志抽样池
2. 脱敏版问题文本
3. 样本时间戳（可模糊到天）
4. query 所在 domain 或可用于后续分层的标签
5. 对应时点的 canon snapshot 标识

## 建议的下一步

1. 先冻结 query 抽样规则
2. 再做脱敏
3. 然后导出 120 条 MVP 样本
4. 最后按 `real-log-replay-protocol.md` 做 baseline vs fixed replay

## 当前判断

**所以，现在可以继续做的实验是：多评审者一致性 pilot；真实日志回放则需要先补日志输入。**

