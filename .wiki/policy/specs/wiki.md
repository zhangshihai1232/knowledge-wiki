---
type: spec
name: wiki
autonomy: semi-auto
triggers:
  - 用户提出任意正常知识工作请求
inputs:
  - 自然语言请求
  - 可选：粘贴资料 / 文件 / URL
outputs:
  - 默认模式结果
  - 可选：后台摘要
  - 可选：audit 模式细节
  - 可选：changes/inbox/ proposal
quality_gates:
  - 默认输出必须遵循“结果 / 边界 / 系统动作 / 需要你决定”四段结构
  - 不得要求用户先选择 ingest/query/maintain 等内部动作
  - audit 细节不得默认展开，除非用户明确要求或系统命中高风险拦截
  - 后台摘要只在系统实际做了事或发现了需要关注的问题时出现，且核心内容不得超过 6 行
  - 高风险动作不得绕过确认门
---

# Spec: Wiki（单入口 Skill）

## Purpose

`wiki` 是整个知识治理系统的**默认前台入口**。

它的职责不是替代底层 spec，而是把：

- `query`
- `ingest`
- `reconcile`
- `refresh`
- `maintain`

这些内部能力收敛到一个低认知负担的用户入口中。

用户只需要用自然语言提出问题、贴资料、或请求整理；系统内部自动路由到合适的底层 spec，并把复杂度隐藏在后台。

---

## When to Run

以下任一情况，默认优先触发本 spec：

- 用户提问，希望得到知识回答
- 用户提供新资料，希望系统吸收
- 用户要求整理、合并、补缺、更新知识
- 用户要求查看本次处理依据、proposal、内部路由细节

**不建议用户优先直接调用** `query / ingest / maintain` 等底层 spec。  
那些 spec 保留给：

- 高级用户
- 调试场景
- 系统内部路由

---

## Default User Contract

用户前台只面对一个入口：

```text
/wiki {自然语言请求或资料}
```

系统默认不要求用户显式说明：

- “这是 query 还是 ingest”
- “要不要 write-back”
- “要不要 lint / maintain”
- schema 字段是什么

---

## 步骤责任标记说明

每个步骤标题带有执行责任标记：

| 标记 | 含义 | 执行者 |
|------|------|--------|
| 🧠 | 语义推理步骤 | LLM（Skill 层） |
| ⚙️ | 确定性操作步骤 | CLI（`wiki` 运行时） |
| 🤝 | 人机交互步骤 | 人工决策，LLM 辅助 |

⚙️ 步骤中的文件操作**必须**通过 `wiki` 运行时执行，不得由 LLM 直接操作文件系统。

## Steps

### Step 1 🧠：拆分主任务与可见性需求

先把用户输入拆成两个维度，而不是只分一个类型：

1. **主任务类型**
2. **是否需要展开细节**

主任务类型只归入以下 3 类之一：

| 类型 | 特征 | 内部路由 |
|---|---|---|
| `answer` | 提问、询问结论、寻求解释 | `query` |
| `absorb` | 提供资料、要求入库、要求吸收 | `ingest` |
| `organize` | 请求整理、补缺、批量更新 | `reconcile / refresh / maintain` |

同时独立判断是否存在 `audit_requested = yes`。以下表达应视为 audit 触发信号：

- “看依据”
- “展开细节”
- “为什么这么判断”
- “看 proposal”
- “看内部路由”

若用户一句话包含多个目标，允许内部拆分处理，不要求用户重写输入。

---

### Step 2 🧠：选择主路由

根据 Step 1 的主任务结果，选择主处理链：

#### 2.1 `answer`

- 调用 `query.md`
- 若发现知识缺口，自动触发 query-writeback

#### 2.2 `absorb`

- 调用 `ingest.md`
- 生成 source 与 proposal

#### 2.3 `organize`

- 根据范围选择：
  - 冲突解决 → `reconcile.md`
  - 内容刷新 → `refresh.md`
  - 结构维护 → `maintain.md`

---

### Step 3 🧠⚙️：自动接管系统内部动作

系统必须自动完成以下动作，而不是让用户手动决定：

1. schema 填充（如 `origin`、`trigger_source`）
2. 缺口登记（proposal 起草）
3. 边界控制（避免无依据确定结论）
4. 低风险后台动作后台化执行

> **CLI 协作原则**：Step 3 中所有涉及文件系统的操作（schema 填充、proposal 写入、LOG 追加、STATE 更新）均通过 `wiki` 运行时执行。LLM 负责语义判断和内容生成，CLI 负责确定性写入。

推荐的运行态协作 contract：

- `answer/query` 路由：先调用 `wiki ask "{query}" --json` 做轻量分类（`domain / primary_type / subtype`）并缩小候选上下文，再做语义综合；优先消费其 `contract_version / retrieval / pages / proposals / sources` 结构
- `absorb/ingest` 路由：由 LLM 先生成结构化 payload，再调用 `wiki import --input payload.json --json`，让 runtime 一次性完成 source / proposal / claims / extracted / dedup evidence 收尾；批处理场景可用 `--input -` 从 stdin 读入
- `organize/maintain` 路由：优先调用 `wiki maintain --json` 获取统计、结构发现与衰减建议
- 分类治理使用：`wiki taxonomy suggestions / wiki taxonomy accept / wiki taxonomy reject`，用于显式吸收 registry 候选值
- 队列收尾仍使用：`wiki review / wiki apply / wiki resolve`；其中 agent 读取队列时优先消费 `wiki review --json / wiki apply list --json / wiki resolve --json`，避免解析表格文本

5. 是否生成“后台摘要”的判定
6. 是否追加“audit 视图”的判定

其中：

- `background_summary_needed = yes` 当且仅当本次触发了 proposal / write-back、触发了后台维护、发现了需要人工关注的风险项，或到达约定摘要窗口
- `audit_needed = yes` 当且仅当：
  - `audit_requested = yes`
  - 命中高风险确认门，需要解释为什么被拦截
  - 用户明确质疑当前结论与已有知识冲突

---

### Step 4 🤝：应用风险确认门

以下动作不得自动穿透：

1. 直接影响 canon 稳定结论的高风险改写
2. 冲突裁决
3. 低置信 source 覆盖高置信内容
4. 批量关键页替换

一旦命中高风险动作，必须向用户抬出**单个最小确认问题**，而不是暴露内部术语。

---

### Step 5 🧠：输出默认模式结果

默认模式固定返回 4 段：

1. **结果**
2. **边界**
3. **系统动作**
4. **需要你决定**

示例：

```text
结果：当前没有统一归档阈值。
边界：运营团队主张 90 天，研究团队主张 180 天；当前 canon 未裁决。
系统动作：已自动登记补充 proposal。
需要你决定：无
```

---

### Step 6 🧠（可选）：追加后台摘要

若 `background_summary_needed = yes`，则在默认 4 段之后追加一个**低打扰摘要块**。

后台摘要固定返回 4 段：

1. **本次自动动作**
2. **发现的问题**
3. **需要你处理**
4. **系统状态**

约束：

- 核心内容默认不超过 6 行
- 不默认暴露路径、schema 字段、技术告警细节
- 如果用户要看更多，再进入 audit 视图展开

示例：

```text
本次自动动作：
- 已自动登记知识缺口 1 条

发现的问题：
- 当前 canon 对归档阈值仍无统一裁决

需要你处理：
- 若要形成统一规则，请确认采用 90 天还是 180 天

系统状态：
- 健康状态稳定
```

---

### Step 7 🧠（可选）：输出 audit 模式结果

若 `audit_needed = yes`，则在默认结果与（若有）后台摘要之后附加 audit 视图。

Audit 视图固定返回 5 段：

1. **结果**
2. **命中依据**
3. **内部路由**
4. **系统动作**
5. **风险拦截**

模板：

```text
结果：
{最终给用户的结果}

命中依据：
- canon 页面：{slug 列表}
- 外推断句子：{如有}
- 缺口说明：{如有}

内部路由：
- 一级路由：{answer | absorb | organize}
- 二级动作：{query / ingest / refresh / maintain / write-back}

系统动作：
- 是否生成 proposal：{yes/no}
- proposal 位置：{如有}
- 是否触发后台维护：{yes/no}

风险拦截：
- 是否命中确认门：{yes/no}
- 拦截原因：{如有}
```

Audit 视图的目的只是让复杂度**可按需查看**，不是把用户重新带回多入口系统。

---

## Non-Goals

本 spec 不追求：

1. 让用户直接理解全部底层 spec
2. 把 benchmark / protocol / rubric 暴露成前台接口
3. 让 CI 成为主入口

---

## Current Position

`wiki` 不是新的治理内核，而是**前台入口壳层**。

它的核心价值是：

> **把复杂系统变成一个可直接使用的入口，同时保留后台的强治理能力。**
