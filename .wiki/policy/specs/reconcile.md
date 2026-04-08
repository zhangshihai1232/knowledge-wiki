---
type: spec
name: reconcile
autonomy: propose
triggers:
  - changes/conflicts/有新文件
inputs:
  - changes/conflicts/*.md
  - 对应canon页（含 <<<CONFLICT>>> 标记）
outputs:
  - 更新后的canon页（冲突已解决）
  - 归档后的conflict proposal
quality_gates:
  - canon页中 <<<CONFLICT>>> 标记已清除
  - conflict proposal 状态已更新为 resolved
  - LOG 中记录裁决依据
---

## Purpose

处理 compile 阶段检出的知识冲突，完成从"冲突标记"到"内容收敛"的完整解决流程。

compile spec 在检出冲突后将 proposal 路由至 `changes/conflicts/`，并在 canon 页插入 `<<<CONFLICT>>>` 标记，但不裁决哪方正确。reconcile spec 负责接管此后的解决工作：呈现冲突上下文、辅助人工裁决、执行内容合并、清除标记、恢复 confidence。

---

## When to Run

当 `changes/conflicts/` 目录下出现新文件时自动触发（autonomy=propose：生成裁决建议，等待人工确认后执行）。

---

## Steps

### Step 1：读取冲突 proposal，定位 canon 页冲突位置

读取 `changes/conflicts/` 中待处理的 conflict proposal，提取：

```yaml
target_page: <canon页路径>
conflict_location: <节标题 + 行号>
trigger_source: <触发冲突的 source 文件路径>
```

按 `conflict_location` 定位 canon 页中的 `<<<CONFLICT>>>` 标记块，提取现有内容和新内容：

```
<<<CONFLICT>>>
[现有内容]
---
[proposal 新内容]
<<<END_CONFLICT>>>
```

---

### Step 2：收集裁决依据

对冲突双方分别收集以下信息：

| 维度 | 现有内容 | 新内容 |
|------|----------|--------|
| 来源文件 | canon 页 `sources` 列表中对应路径 | conflict proposal 的 `trigger_source` |
| 来源 authority | 查询 source 文件 frontmatter `authority` 字段 | 同左 |
| 来源发布时间 | 查询 source 文件 `published_at` 字段 | 同左 |
| 内容时效性 | 根据 `published_at` 判断 | 同左 |

---

### Step 3：生成裁决建议

基于以下优先级规则，生成结构化裁决建议（不自动执行，提交人工确认）：

**裁决优先级规则**（按顺序应用，首个适用规则生效）：

1. **authority 优先**：若双方 authority 不同，`authoritative` > `secondary` > `unverified`，取高 authority 一方
2. **时效优先**：若 authority 相同，取 `published_at` 更新的一方
3. **并存**：若双方 authority 相同且时间相近（差距 ≤ 90 天），建议两种表述并存，加注时间范围（如"截至 YYYY 年"）
4. **人工裁决**：若无法自动判断（来源信息缺失、内容性质不同），标记为 `MANUAL_REQUIRED`，列出两方证据，等待人工指定

裁决建议格式：

```markdown
## 裁决建议

- 冲突位置：{节标题} 第 {行号} 行
- 推荐保留：{现有内容 | 新内容 | 并存}
- 裁决依据：{authority差异 | 时效差异 | 并存理由 | MANUAL_REQUIRED}
- 建议合并后内容：
  > {具体文字}
```

---

### Step 4：人工确认裁决方案

将 Step 3 的裁决建议呈现给人工审查者，等待以下决策之一：

- **approve**：接受 AI 建议的裁决方案，执行 Step 5
- **override**：人工指定保留哪一方或提供新的合并文字，执行 Step 5
- **defer**：暂缓处理，冲突标记保留，proposal 状态改为 `deferred`，不执行 Step 5

---

### Step 5：执行内容合并，清除冲突标记

按确认的裁决方案更新 canon 页：

1. 将 `<<<CONFLICT>>>` ... `<<<END_CONFLICT>>>` 整块替换为裁决后的合并内容
2. 更新 canon 页 frontmatter：
   ```yaml
   last_compiled: <今日日期>
   staleness_days: 0
   ```
3. 重新评估 confidence（使用 source 文件 frontmatter 的 `authority` 枚举：`authoritative` / `secondary` / `unverified`）：
   - 若裁决后 sources 中存在 `authority=authoritative` 的来源 → `confidence: medium`
   - 若所有来源均为 `secondary` 或 `unverified`（包括裁决为 `keep_existing`/`keep_proposed` 且来源 authority 均非 authoritative 的情形）→ `confidence: low`（此为合法结果，不触发 Gate 失败）
   - 若裁决为 `keep_both`（并存）→ `confidence: medium`（两方来源均已保留，视为多来源佐证）
   - 若页面在本次裁决前 confidence 已为 `high` → 维持 `medium`（high 需重新经 promote 流程授予）

---

### Step 6：归档 conflict proposal，更新 LOG

1. 将 conflict proposal 的 `status` 更新为 `resolved`，补写字段：
   ```yaml
   status: resolved
   resolved_at: <今日日期>
   resolved_by: <裁决人，approve/override 时填写>
   resolution: <保留现有 | 保留新内容 | 并存 | 人工合并>
   ```
2. 将 proposal 文件从 `changes/conflicts/` 移动到 `changes/resolved/`
3. 在 `changes/LOG.md` 末尾追加：

```markdown
## <YYYY-MM-DD> reconcile <proposal文件名>

- target: <target_page>
- conflict_location: <节标题 + 行号>
- resolution: <保留现有 | 保留新内容 | 并存 | 人工合并>
- resolved_by: <裁决人>
- authority_basis: <裁决依据简述>
```

---

## 冲突解决 SLA

| 冲突严重程度 | 判断标准 | 目标解决时限 |
|-------------|----------|-------------|
| 高 | 涉及 `confidence=high` 的 canon 页，或 `authority=authoritative` 双方冲突 | 3 个工作日内 |
| 中 | 涉及 `confidence=medium` 的 canon 页 | 7 个工作日内 |
| 低 | 涉及 `confidence=low` 的 canon 页，或来源均为 `unverified` | 30 个工作日内 |

超过 SLA 未解决的冲突，lint L006 将升级为 ERROR 级别（原为 WARNING）。

---

## Quality Gates

**Gate 1：冲突标记已清除**

```
assert "<<<CONFLICT>>>" not in canon_page.content
```

编译完成后 canon 页正文中不得残留 `<<<CONFLICT>>>` 标记。

**Gate 2：conflict proposal 状态已更新**

```
assert conflict_proposal.frontmatter.status in ["resolved", "deferred"]
```

**Gate 3：LOG 记录完整**

LOG 条目必须包含 `resolution` 和 `resolved_by` 字段（deferred 状态除外）。

---

## 调用示例

**触发**：`changes/conflicts/2026-04-08-update-transformer.md` 出现新文件

**执行过程**：

1. 读取 conflict proposal：`target_page=ai/architectures/transformer`，`conflict_location="## 位置编码 第 12 行"`
2. 定位 canon 页冲突块：现有内容"使用固定正弦位置编码"，新内容"现代变体已广泛采用 RoPE"
3. 收集依据：现有来源 `authority=secondary`，`published_at=2017-06-12`；新来源 `authority=secondary`，`published_at=2023-04-15`
4. 生成裁决建议：时效优先，建议并存（时间差 > 90 天，内容为演进关系而非矛盾）
5. 人工 approve 并存方案，合并文字："原始 Transformer 使用固定正弦位置编码（2017）；现代变体（如 LLaMA、GPT-NeoX）已广泛采用旋转位置编码（RoPE，2023）"
6. 清除 `<<<CONFLICT>>>` 标记，写入合并内容，更新 `confidence: medium`
7. 归档 proposal 到 `changes/resolved/`，追加 LOG
