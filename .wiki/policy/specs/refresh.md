---
type: spec
name: refresh
autonomy: propose
triggers:
  - lint L002 发现 1-2 条陈旧页面时
  - 手动触发（/refresh <slug>）
inputs:
  - 目标 canon 页（staleness_days > 90）
  - 对应 sources/ 文件
outputs:
  - 更新后的 canon 页（staleness_days 重置）或归档标记
quality_gates:
  - canon 页 last_compiled 已更新，或 status 已更新为 archived
  - LOG 中记录处理结果和维护者签名
---

## Purpose

处理 lint L002 发现的少量陈旧 canon 页（1-2 条）。

maintain spec 的触发条件是 ≥3 条 L002，对于仅有 1-2 条陈旧页面的情况，refresh spec 提供轻量级的单页处理流程：维护者确认内容有效性或重新摄入相关 sources，完成后重置 staleness 计时。

---

## When to Run

以下任一情形触发：

- lint 报告中 L002 条目为 1-2 条（不满足 maintain 的 ≥3 条阈值）
- 用户手动执行 `/refresh <slug>` 命令
- lint L005 生成的 confidence-review 任务文件被处理时，关联的 L002 陈旧问题需同步处理

---

## Steps

### Step 1：读取目标页面，评估陈旧程度

读取 canon 页 frontmatter，计算：

```
effective_staleness_days = (今日日期 - last_updated).days
```

同时读取页面 `sources` 列表，检查每个 source 文件是否仍然存在，以及是否有同领域的新 source 文件（`ingested_at` 晚于 `last_compiled`）。

---

### Step 2：判断处理路径

根据以下条件路由到对应处理路径：

| 条件 | 处理路径 |
|------|----------|
| 页面内容经维护者确认仍然有效，无新 source 可用 | 路径 A：内容确认，重置计时 |
| 存在同领域新 source 文件，内容需更新 | 路径 B：重新摄入，触发 compile |
| 页面内容已严重过时，且无近期引用 | 路径 C：建议归档 |

---

### Step 3A：内容确认路径

维护者审阅页面内容后，确认内容仍然有效：

1. 更新 canon 页 frontmatter：
   ```yaml
   last_updated: <今日日期>
   staleness_days: 0
   last_compiled: <今日日期>
   ```
2. 在 canon 页末尾追加维护记录节（若不存在则新建）：
   ```markdown
   ## 维护记录

   - {今日日期}：内容经 {维护者} 确认有效，无实质更新，staleness 重置
   ```
3. 在 LOG 中记录：
   ```
   [REFRESH] <页面路径> staleness_days=<N> → 0（内容确认，维护者: <name>）
   ```

---

### Step 3B：重新摄入路径

发现同领域新 source 文件时：

1. 对新 source 文件执行 ingest spec（提取声明，生成 proposal）
2. 生成的 proposal `action` 设为 `update`，`target_page` 指向当前陈旧页面
3. proposal 进入正常的 promote → compile 流程
4. compile 完成后 `staleness_days` 自动重置为 0
5. 在 LOG 中记录：
   ```
   [REFRESH] <页面路径> staleness_days=<N>，触发重新摄入：<source文件名>，待 compile 后重置
   ```

---

### Step 3C：归档建议路径

页面内容严重过时且无近期引用时，生成归档建议（不自动执行）：

1. 生成一个 `action: archive` 的 proposal，写入 `changes/inbox/`
2. proposal 摘要说明归档原因（staleness_days 值、无近期引用、内容时效性分析）
3. 在 LOG 中记录：
   ```
   [REFRESH] <页面路径> staleness_days=<N>，建议归档，已生成 proposal：<文件名>
   ```
4. 等待人工通过 promote 流程审批归档 proposal

---

### Step 4：更新 STATE.md

完成处理后更新 `STATE.md`：

- 路径 A/B：`last_compile` 更新为今日日期（B 路径在 compile 完成后更新）
- 路径 C：`pending_proposals` 计数更新（新增归档 proposal）

---

## Quality Gates

**Gate 1：处理结果已记录**

```
assert LOG 中存在本次 refresh 的 [REFRESH] 条目
```

**Gate 2：staleness 已处理**

```
assert (
    canon_page.frontmatter.last_updated == today  # 路径 A
    OR compile_triggered == true                   # 路径 B
    OR archive_proposal_created == true            # 路径 C
)
```

**Gate 3：维护者签名（路径 A 必须）**

路径 A 的维护记录节中必须包含维护者标识（非空）。

---

## 与其他 Spec 的边界

| 场景 | 使用的 Spec |
|------|------------|
| lint L002 发现 1-2 条陈旧页面 | refresh spec |
| lint L002 发现 ≥3 条陈旧页面 | maintain spec |
| 单页 confidence=low 且 staleness>30 | refresh spec（可与 L005 confidence-review 联动） |
| 批量结构性维护（孤立页面、断裂引用） | maintain spec |

---

## 调用示例

**场景**：lint 报告发现 `canon/domains/ai/concepts/embedding.md` 的 `staleness_days=95`（仅此 1 条 L002）

**执行过程**：

1. 读取页面，`last_updated=2025-12-25`，`effective_staleness_days=104`
2. 检查 sources：`sources/articles/2025-12-20-embedding-survey.md` 存在，`ingested_at` 早于 `last_compiled`；但发现新文件 `sources/articles/2026-03-10-matryoshka-embedding.md`（`ingested_at=2026-03-10`，晚于 `last_compiled=2025-12-25`）
3. 路由到路径 B：有新 source 可用
4. 对 `2026-03-10-matryoshka-embedding.md` 执行 ingest，生成 `update` proposal，`target_page=ai/concepts/embedding`
5. LOG 记录：`[REFRESH] canon/domains/ai/concepts/embedding.md staleness_days=104，触发重新摄入：2026-03-10-matryoshka-embedding.md，待 compile 后重置`
6. proposal 进入 promote → compile 流程，compile 完成后 `staleness_days=0`
