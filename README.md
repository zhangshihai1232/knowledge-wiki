# LLM Wiki 使用说明

## 系统概述

LLM Wiki 是一个**知识编译器**，不是笔记工具。它的核心定位是：把散乱的原始资料（文章、对话、笔记）通过受控流程编译成可信赖的权威知识库。普通笔记系统只是存储，LLM Wiki 强制要求每条知识都有来源追溯，每个变更都经过人工审查，才能进入 canon。

核心理念是一条单向管道：**资料 → 摄入（ingest）→ 审查（promote）→ 编译（compile）→ 权威知识库（canon）**。AI 负责提取和起草，人工负责审查和放行。任何绕过审查直接写入 canon 的操作都违背系统设计。

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

### Step 2：摄入第一份资料

```
/wiki-ingest
```

将资料粘贴或提供给 AI。Skill 会：
1. 在 `sources/{kind}/` 下创建 source 文件（保留原文）
2. 提取声明，在 `changes/inbox/` 下生成 change proposal
3. 更新 `policy/STATE.md`

### Step 3：审查生成的 proposal

```
/wiki-promote
```

AI 会列出 `changes/inbox/` 和 `changes/review/` 中的待审 proposal，你逐一决定：
- **approve**：移入 `changes/approved/`，等待编译
- **reject**：移入 `changes/rejected/`，填写拒绝原因
- **skip**：本次跳过，保留在 inbox/review

### Step 4：编译 approved proposal 到 canon

```
/wiki-compile
```

AI 处理所有 `changes/approved/` 中 `compiled: false` 的 proposal：
- `create`：在 `canon/domains/{domain}/` 下新建页面
- `update`：更新已有页面内容和 sources 列表
- 完成后标记 proposal `compiled: true`，更新 STATE.md

### Step 5：查询知识库

```
/wiki-query
```

用自然语言提问，AI 在 canon 中检索相关页面并给出有来源标注的回答。

---

## 6 个 Skill 使用方式

| Skill | 用途 | 触发方式 | Spec 文件 |
|-------|------|----------|-----------|
| `/wiki-ingest` | 摄入新资料，生成 source 文件和 change proposal | 有新文章、对话记录、笔记需要入库时 | `docs/plans/spec-ingest.md` |
| `/wiki-promote` | 审查 inbox 中的 proposal，决定 approve 或 reject | 摄入后，编译前 | `docs/plans/spec-promote.md` |
| `/wiki-compile` | 将 approved proposal 编译写入 canon | 审查完成，有待编译的 approved proposal 时 | `docs/plans/spec-compile.md` |
| `/wiki-query` | 查询 canon 知识库，回答问题 | 需要检索已有知识时 | `docs/plans/spec-query.md` |
| `/wiki-lint` | 检查系统健康状态，发现孤立文件、断链等问题 | 定期维护或怀疑系统状态异常时 | `docs/plans/spec-lint.md` |
| `/wiki-maintain` | 批量维护：更新 staleness、归档过期页面 | 定期维护，通常配合 lint 使用 | `docs/plans/spec-maintain.md` |

---

## 典型工作流

### 日常摄入流程

每次有新资料时：

```
新资料
  |
  v
/wiki-ingest  ──→  sources/{kind}/ 新文件
                   changes/inbox/  新 proposal
  |
  v
/wiki-promote ──→  approved proposal 移入 changes/approved/
  |
  v
/wiki-compile ──→  canon/domains/{domain}/ 更新
  |
  v
/wiki-query   ──→  查询并验证结果
```

### 定期维护流程

建议每周或积累一定量变更后执行一次：

```
/wiki-lint    ──→  检查孤立文件、断链、staleness 超限页面
  |
  v
/wiki-maintain──→  更新 staleness_days、归档过期页面、修复断链
  |
  v
/wiki-lint    ──→  再次检查，确认健康分达标
```

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

**Spec**：LLM 执行规范，即每个 Skill 背后的提示词文件（`docs/plans/spec-*.md`）。Spec 是完整可执行的 AI 操作说明，包含前置检查、执行步骤、输出格式和错误处理，保证每次调用行为一致。
