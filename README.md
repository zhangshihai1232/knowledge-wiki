# LLM Wiki 使用说明

## 系统概述

LLM Wiki 是一个**知识编译器**，不是笔记工具。它的核心定位是：把散乱的原始资料（文章、对话、笔记）通过受控流程编译成可信赖的权威知识库。普通笔记系统只是存储，LLM Wiki 强制要求每条知识都有来源追溯，每个变更都经过人工审查，才能进入 canon。

核心理念是一条单向管道：**资料 → 吸收 → 审查（review）→ 写入（apply）→ 权威知识库（canon）**。AI 负责提取和起草，人工负责审查和放行。任何绕过审查直接写入 canon 的操作都违背系统设计。

---

## 推荐入口（默认）

**现在推荐的默认使用方式，不是先选 6 个 Skill，而是先用一个入口：**

```text
/wiki {你的问题 / 资料 / 整理请求}
```

仓库中对应的真实前台 Skill 文件已经提供：

- `.claude/skills/wiki.md`
- `.wiki/policy/specs/wiki.md`

`/wiki` 会在内部自动判断你是在：

- 提问（走 query）
- 贴资料（走 ingest）
- 请求整理（走 reconcile / refresh / maintain）
- 要看细节（附加 audit 展示，而不是切走另一个入口）

### 推荐用法示例

```text
/wiki 什么时候应该把页面归档？
/wiki 请把这段会议纪要吸收进知识库
/wiki 帮我整理这批知识并补缺口
/wiki 这个结论的依据是什么？请展开细节
```

你默认不需要先理解：

- ingest / promote / compile 的边界
- schema 字段
- benchmark / protocol / rubric

如果你只是想“用起来”，优先从 `/wiki` 开始。  
下面那套多 Skill 方式保留给高级用户和手动控制场景。

---

## 搭建新的同类仓库

这个仓库本身也是一套工具包，但**公开入口只有一个命令：`wiki`**。

先全局安装：

```bash
tools/install-global.sh
```

然后只用这组命令：

```bash
wiki setup work /data/wiki/work
wiki new my-new-wiki --name "My New Wiki"
cd "$(wiki where)"
wiki status
```

默认安装位置：

- 主命令：`~/.local/bin/wiki`
- 资产目录：`~/.local/share/knowledge-wiki-toolkit`

如果你想换前缀：

```bash
tools/install-global.sh --prefix /usr/local --main-name wiki
```

默认配置文件：

```text
~/.config/knowledge-wiki-toolkit/namespaces.conf
```

如果你想把使用者和 agent 的认知压到最低，公开只记这几个 repo 命令：

```bash
wiki setup
wiki new
wiki use
wiki where
wiki status
```

建仓只是初始化。  
真正的知识编译 / 蒸馏主流程是在**新仓内部**通过 `/wiki` 完成：

```text
/wiki 请吸收这段资料
/wiki 帮我整理这批知识并补缺口
/wiki 这个结论的依据是什么？请展开细节
```

也就是说，最小心智模型其实分两段：

1. **repo 生命周期层**：`wiki`
2. **知识层**：`/wiki`

其中 `/wiki` 才是仓内真正的前台主入口，它会把 ingest / distill / reconcile / refresh / maintain / query 收敛起来。

### 建仓时会复制什么

- `.claude/skills/*.md`
- `.wiki/policy/specs/*.md`
- `.wiki/policy/schemas/*.md`
- `.wiki/policy/templates/*.md`
- `package.json`
- `src/`
- `tools/install-global.sh`
- `tools/wiki.js`
- `evaluation/` 下的协议与 rubric 模板骨架
- 空白的 `.wiki/` 运行时目录、`README.md`、`STATE.md`、`LOG.md`

### 建仓时不会复制什么

- 当前仓库的 `canon` 知识内容
- 当前仓库的 `sources` 原始资料
- 当前仓库的 `changes` 提案内容
- 当前仓库的 `evaluation/results` 实验结果

也就是说，**它搭出来的是一套新的空白治理内核，而不是当前仓库内容的克隆。**

---

## 快速上手

### Step 1：确认 `.wiki/` 目录已初始化

运行时目录 `.wiki/` 包含四个区，确认均存在：

```
.wiki/
  sources/    # 原始资料区（只读，不改写）
  canon/      # 权威知识区（只能由 compile 写入）
  changes/    # 变更提案区（inbox / review / approved / rejected）
  policy/     # 系统状态和 schema 定义
```

如果目录已存在（如本项目），直接进入 Step 2。

### Step 2：直接用 `/wiki`

```text
/wiki {问题 / 资料 / 整理请求}
```

系统会自动路由，并默认用最小认知负担的方式返回：

1. **结果**
2. **边界**
3. **系统动作**
4. **需要你决定**（如果有）

如果你明确说“看依据 / 展开细节 / 看 proposal / 看内部路由”，  
系统会在主结果后附加 **audit 模式**，不需要你切换到别的 Skill。

如果本次处理自动触发了补缺、proposal、后台维护或风险提醒，  
系统会额外附加一个**很短的后台摘要**，你不需要切换到别的入口。

### Step 2.5：需要确定性操作时，用 `wiki`

`/wiki` 负责语义判断，`wiki` 负责确定性执行。  
如果你想少记命令，只优先记这几个任务词：

```bash
wiki status    # 当前 repo + 队列概览
wiki check     # 结构性健康检查
wiki review    # 审查队列
wiki apply     # 已批准提案队列 / 编译收尾
wiki resolve   # 冲突队列 / 冲突收尾
```

如果你是在给 agent 或 `/wiki` 做结构化运行时对接，补充记这三条 workflow contract：

```bash
wiki ask "你的问题" --json
wiki import --input payload.json --json
wiki maintain --json
wiki review --json
wiki apply --json
wiki resolve --json
```

它们分别负责：

1. `ask`：用运行态索引做候选检索与排序，JSON 输出带 `contract_version` 与检索元信息
2. `import`：按单个 JSON payload 一次性写入 source + proposal，并可同步写入 claims / extracted / dedup evidence；`--input -` 可从 stdin 读入
3. `maintain`：输出结构健康、队列统计与可选衰减动作
4. `review / apply / resolve --json`：供 agent 读取确定性队列，避免解析表格文本

没有其他公开 Skill。  
对用户和 agent，公开语义入口始终只有 `/wiki`。

---

## 典型工作流

### 日常知识流

每次有新资料、问题或整理请求时：

```
输入资料 / 提问 / 整理请求
  |
  v
/wiki       ──→  语义判断、抽取、匹配、综合、风险门
  |
  v
wiki review ──→  审查确定性队列
wiki apply  ──→  完成编译收尾
wiki resolve──→  完成冲突收尾
wiki check  ──→  查看结构性健康状态
```

### 默认维护方式（推荐）

普通使用下，优先继续使用 `/wiki`。  
系统应在后台完成轻量巡检、缺口登记和必要的维护动作，只在真的有结果或风险时回传简短摘要。  
只有当你明确要处理确定性队列或查看结构健康时，再手动执行 `wiki review / apply / resolve / check`。

---

## 目录结构说明

```
.wiki/
|-- sources/                        # 原始资料区，只读，不改写
|   |-- articles/                   # 摄入的文章（含提取声明）
|   |-- conversations/              # 对话记录
|   |-- notes/                      # 个人笔记
|   `-- references/                 # 参考资料（规范、论文等）
|
|-- canon/                          # 权威知识区，只能由 compile 写入
|   |-- _index.md                   # 顶层索引，列出所有活跃领域
|   `-- domains/                    # 按领域组织的知识页面
|       `-- {domain}/
|           |-- _index.md           # 领域索引页
|           `-- {slug}.md           # 单个知识页面（含来源追溯）
|
|-- changes/                        # 变更提案区，记录所有变更请求
|   |-- inbox/                      # 新生成的 proposal，待初步审查
|   |-- review/                     # 移入深度审查的 proposal
|   |-- approved/                   # 已批准，等待 compile 处理
|   `-- rejected/                   # 已拒绝，保留记录
|
`-- policy/                         # 系统配置和状态
    |-- STATE.md                    # 系统全局状态（统计数字、健康指标）
    |-- LOG.md                      # 操作日志（每次 ingest/compile 追加）
    `-- schemas/                    # 各类文件的 schema 定义
        |-- source-page.md          # source 文件的 frontmatter 和正文规范
        |-- canon-page.md           # canon 页面的 frontmatter 和正文规范
        |-- change-proposal.md      # proposal 文件的结构和状态流转规范
        `-- state-log.md            # STATE.md 和 LOG.md 的格式规范
```

---

## 核心概念

**Source**：原始资料文件，存放于 `sources/` 下。摄入后保留原文，不改写。每个 source 文件记录资料来源、摄入时间，以及提取出的声明列表。Source 是 canon 知识的原始依据。

**Canon**：权威知识页面，存放于 `canon/domains/` 下。每个页面都通过 `sources` 字段追溯到支撑它的所有 source 文件。Canon 只能由 compile 操作写入，不能手动编辑内容。

**Proposal**：变更请求文件，存放于 `changes/` 的各状态子目录下。每个 proposal 描述对某个 canon 页面的具体变更（新建、更新、合并等），必须经人工审查（approve）后才能被 compile 执行。这是系统防止未经验证内容污染知识库的核心机制。

**Spec**：LLM 执行规范，即每个 Skill 背后的提示词文件（`.wiki/policy/specs/*.md`）。Spec 是完整可执行的 AI 操作说明，包含前置检查、执行步骤、输出格式和错误处理，保证每次调用行为一致。
