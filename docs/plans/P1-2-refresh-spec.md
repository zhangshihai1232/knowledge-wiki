# P1-2：新增 refresh.md — 单页陈旧处理规范

## 背景

maintain.md 的触发条件要求 lint 报告出现 **≥3 条 L002**（陈旧页面集中）时才启动维护流程，且在"不触发本 spec 的情形"一节中已明确注明"单页 L002（由 refresh spec 处理）"。这意味着系统设计中已预留了 refresh spec 的槽位，但该 spec 尚不存在。

当 lint 报告出现 1-2 条 L002 时，受影响页面处于"已被发现、但无路径处理"的灰色地带：maintain spec 不会触发，compile spec 需要重新摄入 sources，而维护者确认内容仍有效的操作也缺乏规范化流程和可追踪的记录字段。

本方案新增 `refresh.md` spec，填补这一缺口，并在 `lint.md` 的 L002 建议动作中增加指向，形成完整闭环。

---

## 修改文件

- 新增 `.wiki/policy/specs/refresh.md`
- 修改 `.wiki/policy/specs/lint.md`（L002 建议动作末尾增加"如仅 1-2 条 L002，参见 refresh spec"的指向）

---

## refresh.md 完整内容

```markdown
---
type: spec
name: refresh
autonomy: propose
triggers:
  - lint 报告出现 1-2 条 L002（陈旧页面，staleness_days > 90）
  - 人工针对单页发起复核请求
inputs:
  - lint 报告（L002 条目）
  - 受影响的 canon 页面
outputs:
  - 更新后的 canon 页面 frontmatter（staleness_days 重置、last_refreshed、refreshed_by）
  - 可选：重新 compile 的 canon 页面正文
quality_gates:
  - staleness_days 重置为 0（或更新为当前距 last_compiled 的实际天数）
  - refreshed_by 字段非空
---

## Purpose

处理 lint 报告中少量（1-2 条）L002 陈旧页面，提供一条轻量的单页复核路径。

Refresh 不执行批量结构性维护（那是 maintain spec 的职责），也不等同于 compile（compile 需要重新摄入 sources 并重写正文）。Refresh 专注于解决一个问题：当一个 canon 页面超过 90 天未更新时，让维护者以最小代价做出明确决策——确认内容仍有效，或重新编译更新内容。

触发边界：
- 1-2 条 L002 → 触发本 spec（refresh）
- ≥3 条 L002 → 触发 maintain spec，不触发本 spec

---

## When to Run

| 触发条件 | 说明 |
|---|---|
| lint 报告出现 1-2 条 L002 | staleness_days > 90，但数量未达到 maintain 阈值 |
| 人工针对单页发起复核请求 | 例如："请帮我复核 `canon/domains/ai/concepts/rag.md` 是否仍然有效" |

---

## Steps

### Step 1：展示待 refresh 页面及其 staleness 情况

从 lint 报告中提取所有 L002 条目（此时为 1-2 条），对每条展示以下信息：

```
待 refresh 页面：

1. canon/domains/ai/concepts/rag.md
   - staleness_days: 112
   - last_compiled: 2026-01-07
   - sources: sources/articles/2026-01-05-rag-intro.md
   - 摘要首句：（读取正文第一段，不超过 80 字）

2. canon/domains/infra/deployment.md
   - staleness_days: 98
   - last_compiled: 2026-01-06
   - sources: sources/articles/2026-01-04-k8s-deploy.md
   - 摘要首句：（读取正文第一段，不超过 80 字）
```

目的是让维护者在决策前对页面现状有清晰认知，不需要自行翻找文件。

---

### Step 2：维护者二选一——确认有效或重新编译

对每个待 refresh 页面，请维护者在以下两个选项中选择：

**选项 A：确认内容仍然有效（签名确认）**

适用场景：页面所描述的知识在这段时间内没有实质性变化，内容仍然准确。

执行内容：
- 维护者回复"确认 {页面路径} 仍有效"（可批量）
- AI 在该页面 frontmatter 写入：
  - `staleness_days: 0`
  - `last_refreshed: {当前日期}`
  - `refreshed_by: {维护者标识，取自回复上下文或要求维护者提供}`
- 不修改页面正文、sources、confidence 等其他字段

**选项 B：重新摄入 sources，触发 compile**

适用场景：页面对应领域已有新的 sources 文件，或维护者认为内容需要更新。

执行内容：
- AI 提示维护者确认相关 sources 路径（已有的或新导入的）
- 按 compile spec 流程对该页面执行重新编译
- compile 完成后，`staleness_days` 和 `last_compiled` 由 compile spec 自动更新
- 额外写入：
  - `last_refreshed: {当前日期}`
  - `refreshed_by: {维护者标识}`

展示格式示例：

```
请对以下页面选择处理方式：

1. canon/domains/ai/concepts/rag.md（staleness_days=112）
   A. 确认内容仍有效（仅重置 staleness，不改正文）
   B. 重新 compile（需提供或确认 sources）

请回复如"A: rag.md"或"B: rag.md，source: sources/articles/2026-04-07-rag-update.md"
```

等待规则：收到明确回复前不执行任何写入操作。

---

### Step 3：更新 canon 页 frontmatter

根据 Step 2 的选择执行写入，完成后输出确认摘要：

**选项 A 执行结果示例**：

```yaml
# canon/domains/ai/concepts/rag.md frontmatter 变更
staleness_days: 0          # 从 112 重置为 0
last_refreshed: "2026-04-08"   # 新增字段
refreshed_by: "zhang-shihai"   # 新增字段
# 其余字段不变
```

**选项 B 执行结果**：由 compile spec 记录正文变更，refresh spec 额外追加 `last_refreshed` 和 `refreshed_by`。

写入完成后，在 `STATE.md` 的 log 节追加本次 refresh 记录：

```yaml
refresh_log:
  - timestamp: "YYYY-MM-DD"
    pages:
      - path: "canon/domains/ai/concepts/rag.md"
        action: "confirmed"   # confirmed | recompiled
        refreshed_by: "zhang-shihai"
        staleness_before: 112
```

---

## Quality Gates

在 refresh 流程结束前，以下两项必须同时满足，否则不标记为完成：

| 检查点 | 验证方式 | 不通过时的处理 |
|---|---|---|
| **staleness_days 已重置** | 读取更新后页面的 frontmatter，确认 `staleness_days` 为 0（选项 A）或由 compile 更新为最新值（选项 B） | 重新写入，不得跳过 |
| **refreshed_by 非空** | 读取更新后页面的 frontmatter，确认 `refreshed_by` 字段存在且值非空字符串 | 要求维护者提供标识后补填，不得以空值或占位符通过 |
```

---

## lint.md 修改内容

定位 L002 规则的"建议动作"字段（当前文件第 59 行），将原文：

```
- **建议动作**：触发针对该页面的 compile，或由维护者确认内容仍然有效并重置 `staleness_days`
```

修改为：

```
- **建议动作**：触发针对该页面的 compile，或由维护者确认内容仍然有效并重置 `staleness_days`；如 lint 报告中 L002 条目为 1-2 条，参见 refresh spec
```

改动说明：仅在原有建议动作末尾追加一个分句，不改动规则的其他字段（触发条件、严重级别、说明）。

---

## 验证方式

1. **覆盖边界验证**：构造一份含 2 条 L002 的 lint 报告，确认触发 refresh spec 而非 maintain spec。
2. **字段完整性验证**：执行选项 A 后，读取目标页面 frontmatter，确认同时存在 `staleness_days: 0`、`last_refreshed`、`refreshed_by` 三个字段，且均非空。
3. **选项 B 联动验证**：执行选项 B 后，确认 compile spec 更新了 `last_compiled` 和 `staleness_days`，refresh spec 额外写入了 `last_refreshed` 和 `refreshed_by`，两者不冲突。
4. **maintain 边界验证**：当 lint 报告含 3 条或以上 L002 时，确认不触发 refresh spec，转由 maintain spec 处理。
5. **lint.md 指向验证**：在 lint 报告中出现 L002 时，建议动作文字能引导维护者找到 refresh spec 的入口。
